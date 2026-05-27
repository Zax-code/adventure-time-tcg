import { Platform } from "react-native";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import { Pedometer } from "expo-sensors";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import {
  AuthorizationRequestStatus,
  AuthorizationStatus,
  type EmitterSubscription,
  UpdateFrequency,
  authorizationStatusFor,
  clearBackgroundTypes,
  configureBackgroundTypes,
  enableBackgroundDelivery,
  getRequestStatusForAuthorization,
  isHealthDataAvailableAsync,
  queryStatisticsForQuantity,
  requestAuthorization,
  subscribeToChanges,
} from "@kingstinct/react-native-healthkit";
import {
  SdkAvailabilityStatus,
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  requestPermission,
} from "react-native-health-connect";

import { apiClient, getStoredUser } from "./api";
import { getTranslation } from "../i18n";
import { queryClient } from "./query-client";
import { syncStepQuestWidgetSnapshot } from "./step-quest-widget";
import {
  type StepSyncAvailability,
  useStepSyncStore,
} from "../stores/step-sync-store";
import { useLocaleStore } from "../stores/locale-store";
import { useSessionStore } from "../stores/session-store";

const IOS_STEP_TYPE = "HKQuantityTypeIdentifierStepCount";
const STEP_GOAL = 10_000;
const STEP_SYNC_INTERVAL_MS = 60_000;
const FOREGROUND_SYNC_DEBOUNCE_MS = 15_000;
const HEALTH_PERMISSION_PROMPT_KEY = "step-sync-health-permission-prompted-v1";
const PEDOMETER_PERMISSION_PROMPT_KEY =
  "step-sync-pedometer-permission-prompted-v1";
const NOTIFICATION_PERMISSION_PROMPT_KEY =
  "step-sync-notification-permission-prompted-v1";
const STEP_NOTIFICATION_CHANNEL_ID = "step-goals";
const STEP_SYNC_BACKGROUND_TASK = "step-sync-background-task";
const BACKGROUND_STEP_SYNC_INTERVAL_MINUTES = 15;

let activeSyncPromise: Promise<void> | null = null;
let pedometerSubscription: ReturnType<typeof Pedometer.watchStepCount> | null =
  null;
let iosHealthSubscription: EmitterSubscription | null = null;
let pedometerBaseSteps: number | null = null;
let pedometerSyncTimeout: ReturnType<typeof setTimeout> | null = null;

type SyncSource =
  | "manual"
  | "interval"
  | "resume"
  | "focus"
  | "foreground_pedometer"
  | "background_task";

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function notificationKeyForDate(userId: string, recordedFor: string) {
  return `step-goal-notified:${userId}:${recordedFor}`;
}

async function markPrompted(key: string) {
  await SecureStore.setItemAsync(key, "1");
}

async function hasPrompted(key: string) {
  return (await SecureStore.getItemAsync(key)) === "1";
}

async function getStepSyncUser() {
  return getStoredUser();
}

function setStore(
  updates: Partial<
    Omit<
      ReturnType<typeof useStepSyncStore.getState>,
      "setPartial" | "reset"
    >
  >,
) {
  useStepSyncStore.getState().setPartial(updates);
}

function setSyncError(message: string) {
  setStore({
    isSyncing: false,
    lastError: message,
  });
}

function clearScheduledForegroundSync() {
  if (pedometerSyncTimeout) {
    clearTimeout(pedometerSyncTimeout);
    pedometerSyncTimeout = null;
  }
}

async function ensureNotificationPermission(interactive: boolean) {
  const current = await Notifications.getPermissionsAsync();

  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    setStore({ notificationPermissionStatus: "granted" });
    return true;
  }

  setStore({
    notificationPermissionStatus:
      current.canAskAgain || !current.status ? "not_requested" : "denied",
  });

  if (!interactive || !current.canAskAgain) {
    return false;
  }

  const next = await Notifications.requestPermissionsAsync();
  await markPrompted(NOTIFICATION_PERMISSION_PROMPT_KEY);

  const granted =
    next.granted || next.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  setStore({
    notificationPermissionStatus: granted ? "granted" : "denied",
  });

  return granted;
}

async function notifyStepGoalReached(userId: string, recordedFor: string) {
  const key = notificationKeyForDate(userId, recordedFor);
  if (await SecureStore.getItemAsync(key)) {
    return;
  }

  const notificationsGranted = await ensureNotificationPermission(false);
  if (!notificationsGranted) {
    return;
  }

  const user = await getStepSyncUser();
  const locale =
    user?.preferredLanguage ?? useLocaleStore.getState().locale;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: getTranslation(locale, "settings.stepGoalReachedTitle"),
      body: getTranslation(locale, "settings.stepGoalReachedBody"),
      sound: true,
      ...(Platform.OS === "android"
        ? { channelId: STEP_NOTIFICATION_CHANNEL_ID }
        : {}),
    },
    trigger: null,
  });

  await SecureStore.setItemAsync(key, "1");
}

async function ensureIosBackgroundDeliveryConfigured() {
  try {
    await configureBackgroundTypes([IOS_STEP_TYPE], UpdateFrequency.immediate);
    return;
  } catch {
    // Fall back to the direct HealthKit registration if the helper fails.
  }

  try {
    await enableBackgroundDelivery(IOS_STEP_TYPE, UpdateFrequency.immediate);
  } catch {
    // Foreground sync still works if background delivery cannot be enabled.
  }
}

async function readIosHealthStepsToday() {
  const available = await isHealthDataAvailableAsync();
  if (!available) {
    setStore({
      availability: "unavailable",
      healthPermissionStatus: "denied",
    });
    return null;
  }

  const status = authorizationStatusFor(IOS_STEP_TYPE);
  const requestStatus = await getRequestStatusForAuthorization({
    toRead: [IOS_STEP_TYPE],
  });

  if (status !== AuthorizationStatus.sharingAuthorized) {
    setStore({
      availability: "available",
      healthPermissionStatus:
        requestStatus === AuthorizationRequestStatus.shouldRequest
          ? "not_requested"
          : "denied",
    });
    return null;
  }

  const now = new Date();
  const result = await queryStatisticsForQuantity(
    IOS_STEP_TYPE,
    ["cumulativeSum"],
    {
      filter: {
        date: {
          startDate: startOfLocalDay(now),
          endDate: now,
          strictStartDate: true,
        },
      },
      unit: "count",
    },
  );

  return Math.max(0, Math.round(result.sumQuantity?.quantity ?? 0));
}

async function readIosPedometerStepsToday(interactive: boolean) {
  const granted = await ensurePedometerPermission(interactive);
  if (!granted) {
    return null;
  }

  const now = new Date();
  const result = await Pedometer.getStepCountAsync(startOfLocalDay(now), now);
  return Math.max(0, Math.round(result.steps ?? 0));
}

async function readIosDeviceStepsToday(interactive: boolean) {
  let healthSteps: number | null = null;

  const healthGranted = await ensureIosHealthPermission(interactive);
  if (healthGranted) {
    healthSteps = await readIosHealthStepsToday();
  }

  const pedometerSteps = await readIosPedometerStepsToday(interactive);

  if (healthSteps == null) {
    return pedometerSteps;
  }

  if (pedometerSteps == null) {
    return healthSteps;
  }

  // HealthKit and CMPedometer can disagree briefly; trust the higher total for today.
  return Math.max(healthSteps, pedometerSteps);
}

async function ensureIosHealthPermission(interactive: boolean) {
  const available = await isHealthDataAvailableAsync();
  if (!available) {
    setStore({
      availability: "unavailable",
      healthPermissionStatus: "denied",
    });
    return false;
  }

  const currentStatus = authorizationStatusFor(IOS_STEP_TYPE);
  if (currentStatus === AuthorizationStatus.sharingAuthorized) {
    await ensureIosBackgroundDeliveryConfigured();
    setStore({
      availability: "available",
      healthPermissionStatus: "granted",
    });
    return true;
  }

  const requestStatus = await getRequestStatusForAuthorization({
    toRead: [IOS_STEP_TYPE],
  });

  setStore({
    availability: "available",
    healthPermissionStatus:
      requestStatus === AuthorizationRequestStatus.shouldRequest
        ? "not_requested"
        : "denied",
  });

  if (!interactive && requestStatus !== AuthorizationRequestStatus.shouldRequest) {
    return false;
  }

  if (!interactive) {
    return false;
  }

  const granted = await requestAuthorization({
    toRead: [IOS_STEP_TYPE],
  });
  await markPrompted(HEALTH_PERMISSION_PROMPT_KEY);

  if (granted) {
    setStore({
      availability: "available",
      healthPermissionStatus: "granted",
      lastError: null,
    });
    await ensureIosBackgroundDeliveryConfigured();

    return true;
  }

  setStore({
    availability: "available",
    healthPermissionStatus: "denied",
  });
  return false;
}

function hasAndroidStepsPermission(
  permissions: Awaited<ReturnType<typeof getGrantedPermissions>>,
) {
  return permissions.some(
    (permission) =>
      permission.accessType === "read" && permission.recordType === "Steps",
  );
}

async function ensureAndroidHealthPermission(interactive: boolean) {
  const sdkStatus = await getSdkStatus();

  if (sdkStatus !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    const availability: StepSyncAvailability =
      sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
        ? "setup_required"
        : "unavailable";

    setStore({
      availability,
      healthPermissionStatus:
        availability === "setup_required" ? "not_requested" : "denied",
    });
    return false;
  }

  const initialized = await initialize();
  if (!initialized) {
    setStore({
      availability: "unavailable",
      healthPermissionStatus: "denied",
    });
    return false;
  }

  const grantedPermissions = await getGrantedPermissions();
  if (hasAndroidStepsPermission(grantedPermissions)) {
    setStore({
      availability: "available",
      healthPermissionStatus: "granted",
    });
    return true;
  }

  setStore({
    availability: "available",
    healthPermissionStatus: "not_requested",
  });

  if (!interactive) {
    return false;
  }

  const requested = await requestPermission([
    {
      accessType: "read",
      recordType: "Steps",
    },
  ]);
  await markPrompted(HEALTH_PERMISSION_PROMPT_KEY);

  const granted = requested.some(
    (permission) =>
      permission.accessType === "read" && permission.recordType === "Steps",
  );

  setStore({
    availability: "available",
    healthPermissionStatus: granted ? "granted" : "denied",
  });
  return granted;
}

async function readAndroidHealthStepsToday() {
  const result = await aggregateRecord({
    recordType: "Steps",
    timeRangeFilter: {
      operator: "between",
      startTime: startOfLocalDay(new Date()).toISOString(),
      endTime: new Date().toISOString(),
    },
  });

  return Math.max(0, Math.round(result.COUNT_TOTAL ?? 0));
}

async function readAuthoritativeDeviceStepsToday(interactive: boolean) {
  if (Platform.OS === "ios") {
    return readIosDeviceStepsToday(interactive);
  }

  if (Platform.OS === "android") {
    const granted = await ensureAndroidHealthPermission(interactive);
    if (!granted) {
      return null;
    }

    return readAndroidHealthStepsToday();
  }

  setStore({
    availability: "unavailable",
    healthPermissionStatus: "denied",
  });
  return null;
}

async function ensurePedometerPermission(interactive: boolean) {
  const available = await Pedometer.isAvailableAsync();
  if (!available) {
    return false;
  }

  const current = await Pedometer.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const alreadyPrompted = await hasPrompted(PEDOMETER_PERMISSION_PROMPT_KEY);
  if (!interactive && alreadyPrompted) {
    return false;
  }

  const next = await Pedometer.requestPermissionsAsync();
  await markPrompted(PEDOMETER_PERMISSION_PROMPT_KEY);
  return next.granted;
}

function updateLiveDeviceSteps(steps: number) {
  setStore({
    deviceStepCount: Math.max(0, steps),
  });
}

function scheduleForegroundSync() {
  clearScheduledForegroundSync();
  pedometerSyncTimeout = setTimeout(() => {
    void syncDeviceStepsNow({
      interactive: false,
      source: "foreground_pedometer",
    });
  }, FOREGROUND_SYNC_DEBOUNCE_MS);
}

export async function configureStepNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(STEP_NOTIFICATION_CHANNEL_ID, {
      name: "Step goals",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

async function backgroundTaskAvailable() {
  const [taskManagerAvailable, backgroundTaskStatus] = await Promise.all([
    TaskManager.isAvailableAsync().catch(() => false),
    BackgroundTask.getStatusAsync().catch(() => null),
  ]);

  return (
    taskManagerAvailable &&
    backgroundTaskStatus === BackgroundTask.BackgroundTaskStatus.Available
  );
}

export async function ensureBackgroundStepTaskRegistered() {
  const available = await backgroundTaskAvailable();
  if (!available) {
    return false;
  }

  const registered = await TaskManager.isTaskRegisteredAsync(
    STEP_SYNC_BACKGROUND_TASK,
  );

  if (!registered) {
    await BackgroundTask.registerTaskAsync(STEP_SYNC_BACKGROUND_TASK, {
      minimumInterval: BACKGROUND_STEP_SYNC_INTERVAL_MINUTES,
    });
  }

  return true;
}

export async function unregisterBackgroundStepTask() {
  const registered = await TaskManager.isTaskRegisteredAsync(
    STEP_SYNC_BACKGROUND_TASK,
  ).catch(() => false);

  if (registered) {
    await BackgroundTask.unregisterTaskAsync(STEP_SYNC_BACKGROUND_TASK);
  }
}

export async function disableBackgroundStepSync() {
  await unregisterBackgroundStepTask();

  if (Platform.OS === "ios") {
    try {
      await clearBackgroundTypes();
    } catch {
      // Ignore teardown failures on logout.
    }
  }
}

export async function syncDeviceStepsNow({
  interactive = false,
  allowPermissionPrompt = interactive,
  source = "manual",
}: {
  interactive?: boolean;
  allowPermissionPrompt?: boolean;
  source?: SyncSource;
} = {}) {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    const user = await getStepSyncUser();
    if (!user?.id) {
      return;
    }

    setStore({
      isSyncing: true,
      lastError: null,
    });

    try {
      const steps = await readAuthoritativeDeviceStepsToday(
        allowPermissionPrompt,
      );
      if (steps == null) {
        setStore({ isSyncing: false });
        return;
      }

      const now = new Date();
      const recordedFor = formatLocalDate(now);
      updateLiveDeviceSteps(steps);
      pedometerBaseSteps = steps;

      await apiClient.syncSteps({
        source: "device_health",
        stepCount: steps,
        recordedFor,
      });

      setStore({
        isSyncing: false,
        deviceStepCount: steps,
        lastSyncedCount: steps,
        lastRecordedFor: recordedFor,
        lastSyncedAt: now.toISOString(),
        lastError: null,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["health-steps"] }),
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);

      const questsResponse = await queryClient.fetchQuery({
        queryKey: ["quests"],
        queryFn: () => apiClient.quests(),
        staleTime: 0,
      });

      await syncStepQuestWidgetSnapshot(
        questsResponse,
        user.preferredLanguage ?? useLocaleStore.getState().locale,
      );

      if (steps >= STEP_GOAL) {
        await notifyStepGoalReached(user.id, recordedFor);
      }

      if (source === "manual") {
        await ensureNotificationPermission(false);
        void startForegroundStepTracking();
        void startIosHealthSubscription();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to sync device steps";
      setSyncError(message);
    }
  })();

  try {
    await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
}

export async function openDeviceHealthSetup() {
  if (Platform.OS === "android") {
    openHealthConnectSettings();
    return;
  }

  await syncDeviceStepsNow({ interactive: true, source: "manual" });
}

export async function startForegroundStepTracking() {
  const pedometerAvailable = await Pedometer.isAvailableAsync();
  if (!pedometerAvailable) {
    return;
  }

  const permissionGranted = await ensurePedometerPermission(false);
  if (!permissionGranted) {
    return;
  }

  if (pedometerSubscription) {
    pedometerSubscription.remove();
  }

  pedometerSubscription = Pedometer.watchStepCount(({ steps }) => {
    const baseSteps = pedometerBaseSteps ?? useStepSyncStore.getState().deviceStepCount ?? 0;
    const nextSteps = baseSteps + steps;

    updateLiveDeviceSteps(nextSteps);

    if (nextSteps >= STEP_GOAL) {
      clearScheduledForegroundSync();
      void syncDeviceStepsNow({
        interactive: false,
        source: "foreground_pedometer",
      });
      return;
    }

    scheduleForegroundSync();
  });
}

export async function startIosHealthSubscription() {
  if (Platform.OS !== "ios") {
    return;
  }

  const granted = await ensureIosHealthPermission(false);
  if (!granted) {
    return;
  }

  iosHealthSubscription?.remove();
  iosHealthSubscription = subscribeToChanges(IOS_STEP_TYPE, () => {
    void syncDeviceStepsNow({
      interactive: false,
      source: "foreground_pedometer",
    });
  });
}

export function stopStepTracking() {
  clearScheduledForegroundSync();
  pedometerSubscription?.remove();
  iosHealthSubscription?.remove();
  pedometerSubscription = null;
  iosHealthSubscription = null;
  pedometerBaseSteps = null;
}

export function resetStepSyncState() {
  stopStepTracking();
  useStepSyncStore.getState().reset();
}

export function stepSyncIntervalMs() {
  return STEP_SYNC_INTERVAL_MS;
}

export {
  BACKGROUND_STEP_SYNC_INTERVAL_MINUTES,
  STEP_SYNC_BACKGROUND_TASK,
};
