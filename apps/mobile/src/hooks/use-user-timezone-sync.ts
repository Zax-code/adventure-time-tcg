import { useEffect } from "react";
import { AppState } from "react-native";

import { apiClient } from "../lib/api";
import { queryClient } from "../lib/query-client";
import { syncDeviceStepsNow } from "../lib/step-sync";
import { useSessionStore } from "../stores/session-store";

function getDeviceTimezone() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
  return timezone ? timezone : null;
}

export function useUserTimezoneSync() {
  const userId = useSessionStore((state) => state.user?.id ?? null);
  const currentTimezone = useSessionStore((state) => state.user?.timezone ?? null);
  const preferredStepSource = useSessionStore(
    (state) => state.user?.preferredStepSource ?? "device_health",
  );
  const patchUser = useSessionStore((state) => state.patchUser);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;

    const syncTimezone = async () => {
      const deviceTimezone = getDeviceTimezone();
      if (!deviceTimezone || deviceTimezone === currentTimezone) {
        return;
      }

      try {
        const nextUser = await apiClient.updateTimezone({
          timezone: deviceTimezone,
        });

        if (cancelled) {
          return;
        }

        await patchUser(nextUser);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["daily-claim"] }),
          queryClient.invalidateQueries({ queryKey: ["quests"] }),
          queryClient.invalidateQueries({ queryKey: ["wordle"] }),
          queryClient.invalidateQueries({ queryKey: ["speed-calculus"] }),
          queryClient.invalidateQueries({ queryKey: ["daily-numbers"] }),
          queryClient.invalidateQueries({ queryKey: ["perfect-timing"] }),
          queryClient.invalidateQueries({ queryKey: ["health-steps"] }),
          queryClient.invalidateQueries({ queryKey: ["home"] }),
        ]);

        if (preferredStepSource === "device_health") {
          await syncDeviceStepsNow({
            interactive: false,
            source: "focus",
          });
        }
      } catch {
        // Keep using the last known backend timezone if sync fails.
      }
    };

    void syncTimezone();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void syncTimezone();
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [currentTimezone, patchUser, preferredStepSource, userId]);
}
