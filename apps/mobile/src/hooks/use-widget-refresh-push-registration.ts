import type { AuthUser } from "@adventure-time/api-client";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";

import { syncLocalNotificationSchedules } from "../lib/app-notifications";
import {
  registerWidgetRefreshPushTokenFromDeviceToken,
  syncNotificationDeviceRegistration,
} from "../lib/widget-refresh-push";
import type { StepSyncPermissionStatus } from "../stores/step-sync-store";

export function useWidgetRefreshPushRegistration(params: {
  accessToken: string | null;
  notificationPermissionStatus: StepSyncPermissionStatus;
  notificationPreferences: AuthUser["notificationPreferences"];
  preferredStepSource: "device_health" | "fitbit";
  preferredLanguage: AuthUser["preferredLanguage"];
  timezone: string;
  userId: string | null;
}) {
  const {
    accessToken,
    notificationPermissionStatus,
    notificationPreferences,
    preferredLanguage,
    preferredStepSource,
    timezone,
    userId,
  } = params;

  useEffect(() => {
    if (!userId) {
      void syncLocalNotificationSchedules(null);
      return;
    }

    void syncLocalNotificationSchedules({
      notificationPreferences,
      preferredLanguage,
      timezone,
    });
  }, [notificationPreferences, preferredLanguage, timezone, userId]);

  useEffect(() => {
    if (!accessToken || !userId) {
      return;
    }

    void syncNotificationDeviceRegistration({
      accessToken,
      notificationPermissionStatus,
      notificationPreferences,
      preferredStepSource,
    });

    const subscription = Notifications.addPushTokenListener((devicePushToken) => {
      void registerWidgetRefreshPushTokenFromDeviceToken(
        accessToken,
        devicePushToken,
      ).catch(() => {
        // Token rotation should stay best-effort.
      });
    });

    return () => {
      subscription.remove();
    };
  }, [
    accessToken,
    notificationPermissionStatus,
    notificationPreferences,
    preferredStepSource,
    userId,
  ]);
}
