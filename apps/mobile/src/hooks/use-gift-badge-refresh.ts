import { useEffect } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";

import { queryClient } from "../lib/query-client";

function refreshGifts() {
  void queryClient.invalidateQueries({ queryKey: ["gifts"] });
}

/**
 * Keeps the header gift badge fresh without polling from every tab: refresh when a
 * gift notification arrives in the foreground and when the app becomes active.
 */
export function useGiftBadgeRefresh(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const notificationSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as { eventType?: unknown };

        if (data?.eventType === "gift_received") {
          refreshGifts();
        }
      },
    );

    let currentState = AppState.currentState;
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      const becameActive =
        currentState.match(/inactive|background/) && nextState === "active";

      currentState = nextState;

      if (becameActive) {
        refreshGifts();
      }
    });

    return () => {
      notificationSubscription.remove();
      appStateSubscription.remove();
    };
  }, [enabled]);
}
