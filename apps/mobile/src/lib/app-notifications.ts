import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { AuthUser } from "@adventure-time/api-client";

import { getTranslation } from "../i18n";
import {
  type StepSyncPermissionStatus,
  useStepSyncStore,
} from "../stores/step-sync-store";

const DAILY_RESET_NOTIFICATION_ID_KEY = "daily-reset-notification-id-v1";
const NOTIFICATION_PROMPT_HIDDEN_KEY_PREFIX =
  "notification-permission-prompt-hidden";
const SESSION_SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
} as const;

export const GENERAL_NOTIFICATION_CHANNEL_ID = "game-updates";
export const STEP_NOTIFICATION_CHANNEL_ID = "step-goals";

function notificationPromptHiddenKey(userId: string) {
  return `${NOTIFICATION_PROMPT_HIDDEN_KEY_PREFIX}:${userId}`;
}

function notificationsGranted(settings: Notifications.NotificationPermissionsStatus) {
  return (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

function mapPermissionStatus(
  settings: Notifications.NotificationPermissionsStatus,
): StepSyncPermissionStatus {
  if (notificationsGranted(settings)) {
    return "granted";
  }

  if (settings.canAskAgain || !settings.status) {
    return "not_requested";
  }

  return "denied";
}

function setNotificationPermissionStatus(status: StepSyncPermissionStatus) {
  useStepSyncStore
    .getState()
    .setPartial({ notificationPermissionStatus: status });
}

async function cancelDailyResetNotification() {
  const notificationId = await SecureStore.getItemAsync(
    DAILY_RESET_NOTIFICATION_ID_KEY,
    SESSION_SECURE_STORE_OPTIONS,
  );

  if (!notificationId) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(
    () => {
      // Best-effort cleanup.
    },
  );

  await SecureStore.deleteItemAsync(
    DAILY_RESET_NOTIFICATION_ID_KEY,
    SESSION_SECURE_STORE_OPTIONS,
  );
}

export async function configureAppNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS !== "android") {
    return;
  }

  await Promise.all([
    Notifications.setNotificationChannelAsync(GENERAL_NOTIFICATION_CHANNEL_ID, {
      name: "Game updates",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    }),
    Notifications.setNotificationChannelAsync(STEP_NOTIFICATION_CHANNEL_ID, {
      name: "Step goals",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    }),
  ]);
}

export async function getNotificationPermissionStatus() {
  const current = await Notifications.getPermissionsAsync();
  const status = mapPermissionStatus(current);
  setNotificationPermissionStatus(status);
  return status;
}

export async function ensureAppNotificationPermission(interactive: boolean) {
  const current = await Notifications.getPermissionsAsync();
  const currentStatus = mapPermissionStatus(current);
  setNotificationPermissionStatus(currentStatus);

  if (currentStatus === "granted") {
    return true;
  }

  if (!interactive || !current.canAskAgain) {
    return false;
  }

  const next = await Notifications.requestPermissionsAsync();
  const nextStatus = mapPermissionStatus(next);
  setNotificationPermissionStatus(nextStatus);
  return nextStatus === "granted";
}

export function shouldRegisterForPushNotifications(
  user: Pick<AuthUser, "preferredStepSource" | "notificationPreferences">,
) {
  const prefs = user.notificationPreferences;

  return (
    user.preferredStepSource === "fitbit" ||
    prefs.pvpInvite ||
    prefs.pvpTurn ||
    prefs.giftReceived
  );
}

export async function syncLocalNotificationSchedules(
  user: Pick<AuthUser, "notificationPreferences" | "preferredLanguage" | "timezone"> | null,
) {
  await cancelDailyResetNotification();

  if (!user?.notificationPreferences.dailyReset) {
    return;
  }

  const granted = await ensureAppNotificationPermission(false);
  if (!granted) {
    return;
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: getTranslation(user.preferredLanguage, "settings.dailyResetNotificationTitle"),
      body: getTranslation(user.preferredLanguage, "settings.dailyResetNotificationBody"),
      sound: true,
      data: {
        eventType: "daily_reset",
      },
      ...(Platform.OS === "android"
        ? { channelId: GENERAL_NOTIFICATION_CHANNEL_ID }
        : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 0,
      minute: 0,
      repeats: true,
      timezone: user.timezone,
      ...(Platform.OS === "android"
        ? { channelId: GENERAL_NOTIFICATION_CHANNEL_ID }
        : {}),
    },
  });

  await SecureStore.setItemAsync(
    DAILY_RESET_NOTIFICATION_ID_KEY,
    notificationId,
    SESSION_SECURE_STORE_OPTIONS,
  );
}

export async function clearScheduledNotificationPreferencesForSession() {
  await cancelDailyResetNotification();
}

export async function getNotificationPermissionPromptHidden(userId: string) {
  return (
    (await SecureStore.getItemAsync(
      notificationPromptHiddenKey(userId),
      SESSION_SECURE_STORE_OPTIONS,
    )) === "1"
  );
}

export async function setNotificationPermissionPromptHidden(
  userId: string,
  hidden: boolean,
) {
  if (hidden) {
    await SecureStore.setItemAsync(
      notificationPromptHiddenKey(userId),
      "1",
      SESSION_SECURE_STORE_OPTIONS,
    );
    return;
  }

  await SecureStore.deleteItemAsync(
    notificationPromptHiddenKey(userId),
    SESSION_SECURE_STORE_OPTIONS,
  );
}
