import { useEffect } from "react";
import { AppState } from "react-native";

import {
  configureStepNotifications,
  clearLocalDeviceStepState,
  disableBackgroundStepSync,
  ensureBackgroundStepTaskRegistered,
  hydrateLocalStepSyncState,
  resetStepSyncState,
  startForegroundStepTracking,
  startIosHealthSubscription,
  stepSyncIntervalMs,
  stopStepTracking,
  syncDeviceStepsNow,
} from "../lib/step-sync";
import { useSessionStore } from "../stores/session-store";
import { clearStepQuestWidgetSnapshot } from "../lib/step-quest-widget";

export function useStepSyncManager() {
  const userId = useSessionStore((state) => state.user?.id ?? null);
  const preferredStepSource = useSessionStore(
    (state) => state.user?.preferredStepSource ?? "device_health",
  );

  useEffect(() => {
    void configureStepNotifications();
  }, []);

  useEffect(() => {
    if (!userId || preferredStepSource !== "device_health") {
      if (userId) {
        void clearLocalDeviceStepState(userId);
        void clearStepQuestWidgetSnapshot();
      }
      void disableBackgroundStepSync();
      resetStepSyncState();
      return;
    }

    let cancelled = false;

    const syncNow = (source: "interval" | "resume" | "focus") =>
      syncDeviceStepsNow({ interactive: false, source });

    void ensureBackgroundStepTaskRegistered();
    void hydrateLocalStepSyncState(userId);

    void syncNow("focus").then(() => {
      if (cancelled) {
        return;
      }

      void startForegroundStepTracking();
      void startIosHealthSubscription();
    });

    const interval = setInterval(() => {
      void syncNow("interval");
    }, stepSyncIntervalMs());

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void syncNow("resume");
      }
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      subscription.remove();
      stopStepTracking();
    };
  }, [preferredStepSource, userId]);
}
