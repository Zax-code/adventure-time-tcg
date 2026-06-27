import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import {
  useGlobalSearchParams,
  usePathname,
  useRouter,
} from "expo-router";

type NotificationData = {
  eventType?: unknown;
  matchId?: unknown;
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function isPvpTabPathname(pathname: string) {
  return pathname === "/pvp" || pathname === "/(tabs)/pvp";
}

function getNotificationData(response: Notifications.NotificationResponse) {
  return response.notification.request.content.data as NotificationData;
}

export function useNotificationResponseRouting(enabled: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ id?: string }>();
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!enabled || !lastNotificationResponse) {
      return;
    }

    if (
      lastNotificationResponse.actionIdentifier !==
      Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      return;
    }

    const data = getNotificationData(lastNotificationResponse);
    const eventType = stringValue(data.eventType);

    if (eventType === "pvp_turn") {
      const matchId = stringValue(data.matchId);

      if (!matchId) {
        if (!isPvpTabPathname(pathname)) {
          router.push("/(tabs)/pvp");
        }
        Notifications.clearLastNotificationResponse();
        return;
      }

      if (pathname !== "/pvp-match" || params.id !== matchId) {
        router.push(`/pvp-match?id=${encodeURIComponent(matchId)}`);
      }

      Notifications.clearLastNotificationResponse();
      return;
    }

    if (eventType === "pvp_invite") {
      if (!isPvpTabPathname(pathname)) {
        router.push("/(tabs)/pvp");
      }

      Notifications.clearLastNotificationResponse();
    }
  }, [enabled, lastNotificationResponse, params.id, pathname, router]);
}
