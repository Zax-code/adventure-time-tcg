import { useEffect } from "react";

import type { QuestsResponse } from "@adventure-time/api-client";

import { apiClient } from "../lib/api";
import { queryClient } from "../lib/query-client";
import {
  clearStepQuestWidgetSnapshot,
  isWidgetSnapshotBridgeAvailable,
  syncStepQuestWidgetSnapshot,
} from "../lib/step-quest-widget";
import { useLocaleStore } from "../stores/locale-store";
import { useSessionStore } from "../stores/session-store";

export function useStepQuestWidgetSync() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const userId = useSessionStore((state) => state.user?.id ?? null);
  const userLocale = useSessionStore((state) => state.user?.preferredLanguage);
  const guestLocale = useLocaleStore((state) => state.locale);
  const locale = userLocale ?? guestLocale;

  useEffect(() => {
    if (!isWidgetSnapshotBridgeAvailable()) {
      return;
    }

    if (!accessToken || !userId) {
      void clearStepQuestWidgetSnapshot();
      return;
    }

    let cancelled = false;
    let lastSnapshotVersion = "";

    const syncFromData = async (data: QuestsResponse | undefined) => {
      if (!data || cancelled) {
        return;
      }

      const stepQuest = data.quests.find((quest) => quest.type === "steps_10k");
      const snapshotVersion = JSON.stringify({
        locale,
        fitbitConnected: data.fitbitConnected,
        stepQuest,
      });

      if (snapshotVersion === lastSnapshotVersion) {
        return;
      }

      lastSnapshotVersion = snapshotVersion;
      await syncStepQuestWidgetSnapshot(data, locale);
    };

    const currentData = queryClient.getQueryData<QuestsResponse>(["quests"]);
    void syncFromData(currentData);

    void queryClient
      .fetchQuery({
        queryKey: ["quests"],
        queryFn: () => apiClient.quests(),
        staleTime: 30_000,
      })
      .then((data) => {
        void syncFromData(data);
      })
      .catch(() => {
        // Keep the last widget snapshot when a background refresh fails.
      });

    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      const nextData = queryClient.getQueryData<QuestsResponse>(["quests"]);
      void syncFromData(nextData);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [accessToken, locale, userId]);
}
