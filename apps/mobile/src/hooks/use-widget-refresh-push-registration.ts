import { useEffect } from "react";
import * as Notifications from "expo-notifications";

import {
  registerWidgetRefreshPushTokenFromDeviceToken,
  syncWidgetRefreshPushRegistration,
} from "../lib/widget-refresh-push";

export function useWidgetRefreshPushRegistration(params: {
  accessToken: string | null;
  preferredStepSource: "device_health" | "fitbit";
  userId: string | null;
}) {
  const { accessToken, preferredStepSource, userId } = params;

  useEffect(() => {
    if (!accessToken || !userId) {
      return;
    }

    void syncWidgetRefreshPushRegistration({
      accessToken,
      preferredStepSource,
    });

    if (preferredStepSource !== "fitbit") {
      return;
    }

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
  }, [accessToken, preferredStepSource, userId]);
}
