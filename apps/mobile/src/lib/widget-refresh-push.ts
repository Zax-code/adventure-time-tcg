import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { AuthUser } from "@adventure-time/api-client";

import { API_BASE_URL } from "./api-config";
import type { StepSyncPermissionStatus } from "../stores/step-sync-store";

const WIDGET_REFRESH_INSTALLATION_ID_KEY =
  "widget-refresh-push-installation-id";
const SESSION_SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
} as const;
const STEP_NOTIFICATION_CHANNEL_ID = "step-goals";

export const WIDGET_REFRESH_NOTIFICATION_TASK =
  "widget-refresh-notification-task";
export const WIDGET_REFRESH_PUSH_EVENT = "fitbit_widget_refresh";

function isSupportedPlatform() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

async function ensureNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(STEP_NOTIFICATION_CHANNEL_ID, {
    name: "Step Goal Progress",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function getInstallationId() {
  let installationId = await SecureStore.getItemAsync(
    WIDGET_REFRESH_INSTALLATION_ID_KEY,
    SESSION_SECURE_STORE_OPTIONS,
  );

  if (installationId) {
    return installationId;
  }

  installationId = Crypto.randomUUID();

  await SecureStore.setItemAsync(
    WIDGET_REFRESH_INSTALLATION_ID_KEY,
    installationId,
    SESSION_SECURE_STORE_OPTIONS,
  );

  return installationId;
}

function getProjectId() {
  return (
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    null
  );
}

async function getExpoPushToken() {
  const projectId = getProjectId();
  if (!projectId) {
    return null;
  }

  await ensureNotificationChannel();

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

async function registerInstallation(accessToken: string) {
  const [installationId, expoPushToken] = await Promise.all([
    getInstallationId(),
    getExpoPushToken(),
  ]);

  if (!expoPushToken) {
    return false;
  }

  const response = await fetch(`${API_BASE_URL}/notifications/device`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      installationId,
      expoPushToken,
      platform: Platform.OS,
    }),
  });

  return response.ok;
}

async function unregisterInstallation(accessToken: string) {
  const installationId = await SecureStore.getItemAsync(
    WIDGET_REFRESH_INSTALLATION_ID_KEY,
    SESSION_SECURE_STORE_OPTIONS,
  );

  if (!installationId) {
    return false;
  }

  const response = await fetch(
    `${API_BASE_URL}/notifications/device/${encodeURIComponent(installationId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return response.ok;
}

export async function syncNotificationDeviceRegistration(params: {
  accessToken: string;
  preferredStepSource: "device_health" | "fitbit";
  notificationPermissionStatus: StepSyncPermissionStatus;
  notificationPreferences: AuthUser["notificationPreferences"];
}) {
  if (!isSupportedPlatform()) {
    return;
  }

  const wantsWidgetRefresh = params.preferredStepSource === "fitbit";
  const wantsVisiblePushes =
    params.notificationPreferences.pvpInvite ||
    params.notificationPreferences.pvpTurn ||
    params.notificationPreferences.giftReceived;

  if (!wantsWidgetRefresh && !wantsVisiblePushes) {
    await unregisterInstallation(params.accessToken).catch(() => {
      // Registration cleanup should stay best-effort.
    });
    return;
  }

  if (
    wantsVisiblePushes &&
    params.notificationPermissionStatus !== "granted" &&
    !wantsWidgetRefresh
  ) {
    await unregisterInstallation(params.accessToken).catch(() => {
      // Visible push cleanup should stay best-effort.
    });
    return;
  }

  await registerInstallation(params.accessToken).catch(() => {
    // Push registration should never block the app or widget sync.
  });
}

export async function registerWidgetRefreshPushTokenFromDeviceToken(
  accessToken: string,
  devicePushToken: Notifications.DevicePushToken,
) {
  if (!isSupportedPlatform() || Platform.OS === "web") {
    return;
  }

  const projectId = getProjectId();
  if (!projectId) {
    return;
  }

  const installationId = await getInstallationId();
  const expoPushToken = await Notifications.getExpoPushTokenAsync({
    projectId,
    devicePushToken,
  });

  await fetch(`${API_BASE_URL}/notifications/device`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      installationId,
      expoPushToken: expoPushToken.data,
      platform: Platform.OS,
    }),
  });
}

export async function unregisterNotificationDeviceBeforeSessionClear() {
  if (!isSupportedPlatform()) {
    return;
  }

  const accessToken = await SecureStore.getItemAsync(
    "accessToken",
    SESSION_SECURE_STORE_OPTIONS,
  );

  if (!accessToken) {
    return;
  }

  await Promise.race([
    unregisterInstallation(accessToken),
    new Promise<false>((resolve) => {
      setTimeout(() => resolve(false), 1_500);
    }),
  ]).catch(() => {
    // Session clearing should proceed even if the server cannot be reached.
  });
}
