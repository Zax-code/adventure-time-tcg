import { useEffect } from "react";
import { AppState } from "react-native";

import {
  configureStepNotifications,
  disableBackgroundStepSync,
  ensureBackgroundStepTaskRegistered,
  resetStepSyncState,
  startForegroundStepTracking,
  startIosHealthSubscription,
  stepSyncIntervalMs,
  stopStepTracking,
  syncDeviceStepsNow,
} from "../lib/step-sync";
import { useSessionStore } from "../stores/session-store";

export function useStepSyncManager() {
  const userId = useSessionStore((state) => state.user?.id ?? null);

  useEffect(() => {
    void configureStepNotifications();
  }, []);

  useEffect(() => {
    if (!userId) {
      void disableBackgroundStepSync();
      resetStepSyncState();
      return;
    }

    let cancelled = false;

    const syncNow = (source: "interval" | "resume" | "focus") =>
      syncDeviceStepsNow({ interactive: false, source });

    void ensureBackgroundStepTaskRegistered();

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
  }, [userId]);
}
