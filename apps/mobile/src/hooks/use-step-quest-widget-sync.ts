import { useEffect } from "react";

import type { QuestsResponse } from "@adventure-time/api-client";

import { API_BASE_URL } from "../lib/api-config";
import { queryClient } from "../lib/query-client";
import { applyLocalStepProgressToQuests } from "../lib/step-sync";
import {
  clearStepQuestWidgetSnapshot,
  isWidgetSnapshotBridgeAvailable,
  setStepQuestWidgetSyncContext,
  syncStepQuestWidgetSnapshot,
} from "../lib/step-quest-widget";
import { useLocaleStore } from "../stores/locale-store";
import { useSessionStore } from "../stores/session-store";
import { useThemeStore } from "../stores/theme-store";

export function useStepQuestWidgetSync() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const refreshToken = useSessionStore((state) => state.refreshToken);
  const user = useSessionStore((state) => state.user);
  const userId = useSessionStore((state) => state.user?.id ?? null);
  const preferredStepSource = useSessionStore(
    (state) => state.user?.preferredStepSource ?? "device_health",
  );
  const userLocale = useSessionStore((state) => state.user?.preferredLanguage);
  const guestLocale = useLocaleStore((state) => state.locale);
  const themeName = useThemeStore((state) => state.themeName);
  const locale = userLocale ?? guestLocale;

  useEffect(() => {
    if (!isWidgetSnapshotBridgeAvailable()) {
      return;
    }

    void setStepQuestWidgetSyncContext({
      apiBaseUrl: API_BASE_URL,
      accessToken,
      locale,
      refreshToken,
      themeName,
      user: user
        ? {
            id: user.id,
            notificationPreferences: {
              stepGoal: user.notificationPreferences.stepGoal,
            },
            preferredLanguage: user.preferredLanguage,
            preferredStepSource: user.preferredStepSource,
          }
        : null,
    }).catch(() => {
      // Keep the last known native sync configuration if this write fails.
    });

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

      const snapshotData =
        applyLocalStepProgressToQuests(data, { preferredStepSource }) ?? data;
      const snapshotStepQuest = snapshotData.quests.find(
        (quest) => quest.type === "steps_10k",
      );
      const snapshotVersion = JSON.stringify({
        locale,
        themeName,
        fitbitConnected: snapshotData.fitbitConnected,
        stepQuest: snapshotStepQuest,
      });

      if (snapshotVersion === lastSnapshotVersion) {
        return;
      }

      lastSnapshotVersion = snapshotVersion;
      await syncStepQuestWidgetSnapshot(snapshotData, locale, themeName);
    };

    const currentData = queryClient.getQueryData<QuestsResponse>(["quests"]);
    void syncFromData(currentData);

    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      const nextData = queryClient.getQueryData<QuestsResponse>(["quests"]);
      void syncFromData(nextData);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [accessToken, locale, preferredStepSource, refreshToken, themeName, user, userId]);
}
