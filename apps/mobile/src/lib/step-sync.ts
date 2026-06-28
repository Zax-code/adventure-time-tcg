import { Linking, Platform } from "react-native";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import { Pedometer } from "expo-sensors";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { isCancelledError } from "@tanstack/react-query";
import {
  AuthorizationRequestStatus,
  type EmitterSubscription,
  UpdateFrequency,
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

import type { QuestsResponse } from "@adventure-time/api-client";

import { apiClient, getStoredUser } from "./api";
import { getTranslation } from "../i18n";
import {
  applyLocalStepSnapshotToQuests,
  clearLocalStepSnapshotForUser,
  formatLocalStepDate,
  getLocalStepSnapshotForToday,
  persistLocalStepSnapshot,
  type LocalStepSnapshot,
} from "./local-step-snapshot";
import { queryClient } from "./query-client";
import {
  getStepQuestWidgetNotificationDelivered,
  markStepQuestWidgetNotificationDelivered,
  startStepQuestWidgetBackgroundSync,
  syncStepQuestWidgetSnapshot,
} from "./step-quest-widget";
import {
  type StepSyncAvailability,
  type StepSyncPermissionStatus,
  useStepSyncStore,
} from "../stores/step-sync-store";
import { useLocaleStore } from "../stores/locale-store";
import { useSessionStore } from "../stores/session-store";
import { useThemeStore } from "../stores/theme-store";
import {
  configureAppNotifications,
  ensureAppNotificationPermission,
  STEP_NOTIFICATION_CHANNEL_ID,
} from "./app-notifications";

const IOS_STEP_TYPE = "HKQuantityTypeIdentifierStepCount";
const STEP_GOAL = 10_000;
const STEP_SYNC_INTERVAL_MS = 60_000;
const FOREGROUND_SYNC_DEBOUNCE_MS = 15_000;
const SERVER_STEP_SYNC_THROTTLE_MS = 15 * 60_000;
const HEALTH_PERMISSION_PROMPT_KEY = "step-sync-health-permission-prompted-v1";
const PEDOMETER_PERMISSION_PROMPT_KEY =
  "step-sync-pedometer-permission-prompted-v1";
const STEP_SERVER_SYNC_ATTEMPT_KEY_PREFIX = "step-server-sync-attempt-v1";
const STEP_SYNC_BACKGROUND_TASK = "step-sync-background-task";
const BACKGROUND_STEP_SYNC_INTERVAL_MINUTES = 15;
const HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata";
const HEALTH_CONNECT_MARKET_URL = `market://details?id=${HEALTH_CONNECT_PACKAGE}`;
const HEALTH_CONNECT_WEB_URL =
  `https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PACKAGE}`;

let activeSyncPromise: Promise<void> | null = null;
let pedometerSubscription: ReturnType<typeof Pedometer.watchStepCount> | null =
  null;
let iosHealthSubscription: EmitterSubscription | null = null;
let pedometerBaseSteps: number | null = null;
let pedometerSyncTimeout: ReturnType<typeof setTimeout> | null = null;
let pedometerCallbackCount = 0;

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

function secureStoreKeySegment(value: string) {
  return value.replace(/[^0-9A-Za-z._-]/g, "_");
}

function notificationKeyForDate(userId: string, recordedFor: string) {
  return `step-goal-notified.${secureStoreKeySegment(userId)}.${secureStoreKeySegment(recordedFor)}`;
}

function serverSyncAttemptKey(userId: string) {
  return `${STEP_SERVER_SYNC_ATTEMPT_KEY_PREFIX}.${secureStoreKeySegment(userId)}`;
}

interface ServerSyncAttemptState {
  recordedFor: string;
  lastAttemptAt: string | null;
  completionAttemptedFor: string | null;
}

async function markPrompted(key: string) {
  await SecureStore.setItemAsync(key, "1");
}

async function hasPrompted(key: string) {
  return (await SecureStore.getItemAsync(key)) === "1";
}

async function readServerSyncAttemptState(userId: string) {
  const rawState = await SecureStore.getItemAsync(serverSyncAttemptKey(userId));
  if (!rawState) {
    return null;
  }

  try {
    return JSON.parse(rawState) as ServerSyncAttemptState;
  } catch {
    return null;
  }
}

async function writeServerSyncAttemptState(
  userId: string,
  state: ServerSyncAttemptState,
) {
  await SecureStore.setItemAsync(
    serverSyncAttemptKey(userId),
    JSON.stringify(state),
  );
}

async function clearServerSyncAttemptState(userId: string) {
  await SecureStore.deleteItemAsync(serverSyncAttemptKey(userId));
}

async function shouldAttemptServerStepSync({
  force,
  recordedFor,
  stepCount,
  userId,
}: {
  force: boolean;
  recordedFor: string;
  stepCount: number;
  userId: string;
}) {
  if (force) {
    return true;
  }

  const state = await readServerSyncAttemptState(userId);

  if (stepCount >= STEP_GOAL) {
    return state?.completionAttemptedFor !== recordedFor;
  }

  if (!state || state.recordedFor !== recordedFor || !state.lastAttemptAt) {
    return true;
  }

  return (
    Date.now() - new Date(state.lastAttemptAt).getTime() >=
    SERVER_STEP_SYNC_THROTTLE_MS
  );
}

async function markServerStepSyncAttempt({
  recordedFor,
  stepCount,
  userId,
}: {
  recordedFor: string;
  stepCount: number;
  userId: string;
}) {
  const now = new Date().toISOString();
  const existing = await readServerSyncAttemptState(userId);

  await writeServerSyncAttemptState(userId, {
    recordedFor,
    lastAttemptAt: now,
    completionAttemptedFor:
      stepCount >= STEP_GOAL
        ? recordedFor
        : existing?.recordedFor === recordedFor
          ? existing.completionAttemptedFor
          : null,
  });
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

function isQueryCancellationError(error: unknown) {
  return (
    isCancelledError(error) ||
    (error instanceof Error && error.message === "CancelledError")
  );
}

async function invalidateStepSyncQueries() {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ["health-steps"],
      refetchType: "none",
    }),
    queryClient.invalidateQueries({
      queryKey: ["quests"],
      refetchType: "none",
    }),
    queryClient.invalidateQueries({
      queryKey: ["home"],
      refetchType: "none",
    }),
  ]);
}

async function fetchQuestsAfterStepSync() {
  try {
    return await queryClient.fetchQuery({
      queryKey: ["quests"],
      queryFn: () => apiClient.quests(),
      staleTime: 0,
    });
  } catch (error) {
    if (isQueryCancellationError(error)) {
      return apiClient.quests();
    }

    throw error;
  }
}

function clearScheduledForegroundSync() {
  if (pedometerSyncTimeout) {
    clearTimeout(pedometerSyncTimeout);
    pedometerSyncTimeout = null;
  }
}

async function notifyStepGoalReached(userId: string, recordedFor: string) {
  const key = notificationKeyForDate(userId, recordedFor);
  if (
    (await SecureStore.getItemAsync(key)) ||
    (await getStepQuestWidgetNotificationDelivered(userId, recordedFor))
  ) {
    await SecureStore.setItemAsync(key, "1");
    return;
  }

  const user = await getStepSyncUser();
  if (!user?.notificationPreferences.stepGoal) {
    return;
  }

  const notificationsGranted = await ensureAppNotificationPermission(false);
  if (!notificationsGranted || !user) {
    return;
  }

  const locale =
    user?.preferredLanguage ?? useLocaleStore.getState().locale;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: getTranslation(locale, "settings.stepGoalReachedTitle"),
      body: getTranslation(locale, "settings.stepGoalReachedBody"),
      sound: true,
      data: {
        eventType: "step_goal_reached",
      },
      ...(Platform.OS === "android"
        ? { channelId: STEP_NOTIFICATION_CHANNEL_ID }
        : {}),
    },
    trigger: null,
  });

  await SecureStore.setItemAsync(key, "1");
  await markStepQuestWidgetNotificationDelivered(userId, recordedFor);
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

function mapIosRequestStatusToPermissionStatus(
  requestStatus: AuthorizationRequestStatus,
): StepSyncPermissionStatus {
  if (requestStatus === AuthorizationRequestStatus.unnecessary) {
    return "granted";
  }

  if (requestStatus === AuthorizationRequestStatus.shouldRequest) {
    return "not_requested";
  }

  return "unknown";
}

async function getIosHealthPermissionStatus() {
  const requestStatus = await getRequestStatusForAuthorization({
    toRead: [IOS_STEP_TYPE],
  });

  return mapIosRequestStatusToPermissionStatus(requestStatus);
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

  const permissionStatus = await getIosHealthPermissionStatus();
  if (permissionStatus !== "granted") {
    setStore({
      availability: "available",
      healthPermissionStatus: permissionStatus,
    });
    return null;
  }

  setStore({
    availability: "available",
    healthPermissionStatus: "granted",
  });

  const now = new Date();
  const result = await queryStatisticsForQuantity(
    IOS_STEP_TYPE,
    ["cumulativeSum"],
    {
      filter: {
        date: {
          // Step samples can span midnight; a strict start predicate can drop
          // samples that still contribute to today's total in HealthKit.
          startDate: startOfLocalDay(now),
          endDate: now,
        },
      },
      unit: "count",
    },
  );

  return Math.max(0, Math.round(result.sumQuantity?.quantity ?? 0));
}

async function readPedometerStepsToday(interactive: boolean) {
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

  const pedometerSteps = await readPedometerStepsToday(interactive);

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

  const currentPermissionStatus = await getIosHealthPermissionStatus();
  if (currentPermissionStatus === "granted") {
    await ensureIosBackgroundDeliveryConfigured();
    setStore({
      availability: "available",
      healthPermissionStatus: "granted",
    });
    return true;
  }

  setStore({
    availability: "available",
    healthPermissionStatus: currentPermissionStatus,
  });

  if (!interactive) {
    return false;
  }

  await requestAuthorization({
    toRead: [IOS_STEP_TYPE],
  });
  await markPrompted(HEALTH_PERMISSION_PROMPT_KEY);

  const nextPermissionStatus = await getIosHealthPermissionStatus();

  if (nextPermissionStatus === "granted") {
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
    healthPermissionStatus: nextPermissionStatus,
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
    void startStepQuestWidgetBackgroundSync().catch(() => {
      // Foreground and JS background sync still work if the native worker cannot start.
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
    {
      accessType: "read",
      recordType: "BackgroundAccessPermission",
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

  if (granted) {
    void startStepQuestWidgetBackgroundSync().catch(() => {
      // Foreground and JS background sync still work if the native worker cannot start.
    });
  }

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

async function readAndroidDeviceStepsToday(interactive: boolean) {
  let healthSteps: number | null = null;

  const healthGranted = await ensureAndroidHealthPermission(interactive);
  if (healthGranted) {
    healthSteps = await readAndroidHealthStepsToday();
  }

  const pedometerSteps = await readPedometerStepsToday(interactive);

  if (healthSteps == null) {
    return pedometerSteps;
  }

  if (pedometerSteps == null) {
    return healthSteps;
  }

  // Health Connect and the hardware step counter can differ while providers catch up.
  return Math.max(healthSteps, pedometerSteps);
}

async function openAndroidHealthConnectInstall() {
  try {
    await Linking.openURL(HEALTH_CONNECT_MARKET_URL);
    return;
  } catch {
    // Some devices do not handle market:// URLs. The web URL still gets users
    // to the Health Connect provider without invoking the unavailable settings intent.
  }

  try {
    await Linking.openURL(HEALTH_CONNECT_WEB_URL);
  } catch {
    setSyncError("Health Connect could not be opened on this device.");
  }
}

async function readAuthoritativeDeviceStepsToday(interactive: boolean) {
  if (Platform.OS === "ios") {
    return readIosDeviceStepsToday(interactive);
  }

  if (Platform.OS === "android") {
    return readAndroidDeviceStepsToday(interactive);
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

async function syncLocalStepQuestWidgetSnapshot(
  snapshot: LocalStepSnapshot,
  user: Awaited<ReturnType<typeof getStepSyncUser>>,
) {
  if (!user || user.preferredStepSource !== "device_health") {
    return;
  }

  const currentQuests = queryClient.getQueryData<QuestsResponse>(["quests"]);
  const localQuests = applyLocalStepSnapshotToQuests(
    currentQuests,
    snapshot,
    user,
  );

  if (!localQuests) {
    return;
  }

  await syncStepQuestWidgetSnapshot(
    localQuests,
    user.preferredLanguage ?? useLocaleStore.getState().locale,
    useThemeStore.getState().themeName,
  );
}

export function applyLocalStepProgressToQuests(
  quests: QuestsResponse | undefined,
  user:
    | Pick<NonNullable<Awaited<ReturnType<typeof getStepSyncUser>>>, "preferredStepSource">
    | null
    | undefined,
) {
  const stepSync = useStepSyncStore.getState();

  if (!user || stepSync.lastRecordedFor !== formatLocalStepDate()) {
    return quests;
  }

  return applyLocalStepSnapshotToQuests(
    quests,
    stepSync.deviceStepCount == null
      ? null
      : {
          userId: "local-store",
          source: "device_health",
          recordedFor: stepSync.lastRecordedFor,
          stepCount: stepSync.deviceStepCount,
          updatedAt: stepSync.lastSyncedAt ?? new Date().toISOString(),
        },
    user,
  );
}

export async function hydrateLocalStepSyncState(userId: string) {
  const snapshot = await getLocalStepSnapshotForToday(userId);

  if (!snapshot) {
    return;
  }

  setStore({
    deviceStepCount: snapshot.stepCount,
    lastRecordedFor: snapshot.recordedFor,
    lastSyncedAt: snapshot.updatedAt,
  });

  queryClient.setQueryData<QuestsResponse | undefined>(
    ["quests"],
    (current) =>
      applyLocalStepSnapshotToQuests(current, snapshot, {
        preferredStepSource: "device_health",
      }),
  );
}

export async function clearLocalDeviceStepState(userId: string) {
  await Promise.all([
    clearLocalStepSnapshotForUser(userId),
    clearServerSyncAttemptState(userId),
  ]);
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
  await configureAppNotifications();
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
  forceServerSync = false,
  source = "manual",
}: {
  interactive?: boolean;
  allowPermissionPrompt?: boolean;
  forceServerSync?: boolean;
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
      const localSnapshot = await persistLocalStepSnapshot({
        userId: user.id,
        recordedFor,
        stepCount: steps,
      });
      updateLiveDeviceSteps(localSnapshot.stepCount);
      if (!pedometerSubscription) {
        pedometerBaseSteps = localSnapshot.stepCount;
      }
      await syncLocalStepQuestWidgetSnapshot(localSnapshot, user);

      queryClient.setQueryData<QuestsResponse | undefined>(
        ["quests"],
        (current) => applyLocalStepSnapshotToQuests(current, localSnapshot, user),
      );

      setStore({
        isSyncing: false,
        deviceStepCount: localSnapshot.stepCount,
        lastRecordedFor: recordedFor,
        lastError: null,
      });

      if (localSnapshot.stepCount >= STEP_GOAL) {
        await notifyStepGoalReached(user.id, recordedFor);
      }

      const shouldSyncServer = await shouldAttemptServerStepSync({
        force: forceServerSync || source === "manual",
        recordedFor,
        stepCount: localSnapshot.stepCount,
        userId: user.id,
      });

      if (shouldSyncServer) {
        await markServerStepSyncAttempt({
          recordedFor,
          stepCount: localSnapshot.stepCount,
          userId: user.id,
        });

        await apiClient.syncSteps({
          source: "device_health",
          stepCount: localSnapshot.stepCount,
          recordedFor,
        });

        setStore({
          lastSyncedCount: localSnapshot.stepCount,
          lastSyncedAt: now.toISOString(),
        });

        await invalidateStepSyncQueries();

        const questsResponse = await fetchQuestsAfterStepSync();
        const reconciledQuests =
          applyLocalStepSnapshotToQuests(questsResponse, localSnapshot, user) ??
          questsResponse;

        queryClient.setQueryData(["quests"], reconciledQuests);

        await syncStepQuestWidgetSnapshot(
          reconciledQuests,
          user.preferredLanguage ?? useLocaleStore.getState().locale,
          useThemeStore.getState().themeName,
        );
      }

      if (source === "manual") {
        await ensureAppNotificationPermission(false);
        void startForegroundStepTracking();
        void startIosHealthSubscription();
      }
    } catch (error) {
      if (isQueryCancellationError(error)) {
        setStore({ isSyncing: false });
        return;
      }

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
    try {
      const sdkStatus = await getSdkStatus();

      if (sdkStatus !== SdkAvailabilityStatus.SDK_AVAILABLE) {
        await openAndroidHealthConnectInstall();
        return;
      }

      openHealthConnectSettings();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Health Connect could not be opened on this device.";
      setSyncError(message);
    }
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

  pedometerCallbackCount = 0;
  pedometerBaseSteps = useStepSyncStore.getState().deviceStepCount ?? 0;

  pedometerSubscription = Pedometer.watchStepCount(({ steps }) => {
    const baseSteps = pedometerBaseSteps ?? useStepSyncStore.getState().deviceStepCount ?? 0;
    const nextSteps = baseSteps + steps;
    pedometerCallbackCount += 1;

    if (nextSteps >= STEP_GOAL || pedometerCallbackCount % 5 === 0) {
      updateLiveDeviceSteps(nextSteps);
    }

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

  void startStepQuestWidgetBackgroundSync().catch(() => {
    // Foreground HealthKit updates still work if the native background hook is unavailable.
  });

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
  pedometerCallbackCount = 0;
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
