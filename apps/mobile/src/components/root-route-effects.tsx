import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";

import { QuestDayCutoffModal } from "../features/quests/quest-day-cutoff-modal";
import {
  isQuestExperiencePath,
  isQuestHubPath,
  type QuestDayCutoffEvent,
  type QuestRouteContext,
} from "../features/quests/quest-day-cutoff";
import { useNotificationResponseRouting } from "../hooks/use-notification-response-routing";
import { useQuestDayCutoff } from "../hooks/use-quest-day-cutoff";
import { useTranslation } from "../i18n";
import { apiClient } from "../lib/api";
import { queryClient } from "../lib/query-client";
import { rememberContentPathname } from "../lib/widget-route-history";
import { useQuestDayCutoffStore } from "../stores/quest-day-cutoff-store";
import { useSessionStore } from "../stores/session-store";

const QUEST_DAY_CACHE_KEYS = [
  ["quests"],
  ["wordle"],
  ["wordleDefinition"],
  ["daily-numbers"],
  ["speed-calculus"],
  ["perfect-timing"],
] as const;

async function refreshQuestDayData() {
  await Promise.allSettled(
    QUEST_DAY_CACHE_KEYS.map((queryKey) =>
      queryClient.cancelQueries({ queryKey }),
    ),
  );

  for (const queryKey of QUEST_DAY_CACHE_KEYS.slice(1)) {
    queryClient.removeQueries({ queryKey });
  }

  const secondaryRefreshes = Promise.allSettled([
    queryClient.invalidateQueries({
      queryKey: ["home"],
      refetchType: "all",
    }),
    queryClient.invalidateQueries({
      queryKey: ["daily-claim"],
      refetchType: "all",
    }),
    queryClient.invalidateQueries({
      queryKey: ["health-steps"],
      refetchType: "all",
    }),
  ]);

  try {
    await queryClient.fetchQuery({
      queryKey: ["quests"],
      queryFn: () => apiClient.quests(),
      staleTime: 0,
    });
  } catch (error) {
    const questsQuery = queryClient.getQueryCache().find({
      queryKey: ["quests"],
      exact: true,
    });
    if (!questsQuery?.isActive()) {
      queryClient.removeQueries({ queryKey: ["quests"], exact: true });
    }
    throw error;
  } finally {
    await secondaryRefreshes;
  }
}

// Everything that depends on the current route lives in this leaf so that a
// navigation re-renders it alone, not the root layout, its providers and the
// Stack. It mounts once local boot is ready, like the cutoff modal it renders.
export function RootRouteEffects() {
  const pathname = usePathname();
  const router = useRouter();
  const globalSearchParams = useGlobalSearchParams<{
    archiveDate?: string | string[];
    _e2eQuestCutoff?: string | string[];
  }>();
  const archiveDateParam = globalSearchParams.archiveDate;
  const questCutoffTestParam = globalSearchParams._e2eQuestCutoff;
  const bootstrapPhase = useSessionStore((state) => state.bootstrapPhase);
  const accessToken = useSessionStore((state) => state.accessToken);
  const authUserId = useSessionStore((state) => state.user?.id ?? null);
  const timezone = useSessionStore(
    (state) => state.user?.timezone ?? "Europe/Paris",
  );
  const { t } = useTranslation();

  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [questDayCutoff, setQuestDayCutoff] = useState<{
    event: QuestDayCutoffEvent;
    sessionKey: string;
    status: "error" | "ready" | "refreshing";
  } | null>(null);
  const archiveDate =
    typeof archiveDateParam === "string" ? archiveDateParam : null;
  const questCutoffTestTrigger =
    typeof questCutoffTestParam === "string" ? questCutoffTestParam : null;
  const questRouteContext = useMemo(
    () => ({ pathname, archiveDate }),
    [archiveDate, pathname],
  );

  const handleQuestDayChanged = useCallback(
    (event: QuestDayCutoffEvent) => {
      if (refreshTimeoutRef.current !== null) {
        clearTimeout(refreshTimeoutRef.current);
      }

      const refreshSessionKey = authUserId;
      const shouldAnnounce = isQuestExperiencePath(questRouteContext);
      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        void refreshQuestDayData().then(
          () => {
            setQuestDayCutoff((current) =>
              current?.sessionKey === refreshSessionKey &&
              current.event.currentDayKey === event.currentDayKey
                ? { ...current, status: "ready" }
                : current,
            );
            if (
              shouldAnnounce &&
              useSessionStore.getState().user?.id === refreshSessionKey
            ) {
              AccessibilityInfo.announceForAccessibility(
                t("quests.dailyCutoff.body"),
              );
            }
          },
          () => {
            setQuestDayCutoff((current) =>
              current?.sessionKey === refreshSessionKey &&
              current.event.currentDayKey === event.currentDayKey
                ? { ...current, status: "error" }
                : current,
            );
            if (
              shouldAnnounce &&
              useSessionStore.getState().user?.id === refreshSessionKey
            ) {
              AccessibilityInfo.announceForAccessibility(
                t("quests.dailyCutoff.errorBody"),
              );
            }
          },
        );
      }, 0);
    },
    [authUserId, questRouteContext, t],
  );

  const handleQuestCutoff = useCallback(
    (event: QuestDayCutoffEvent, routeContext: QuestRouteContext) => {
      if (!authUserId) return;

      useQuestDayCutoffStore.getState().publishCutoff(event.currentDayKey);
      setQuestDayCutoff({
        event,
        sessionKey: authUserId,
        status: "refreshing",
      });

      if (!isQuestHubPath(routeContext)) {
        router.dismissTo("/(tabs)/quests" as never);
      }
    },
    [authUserId, router],
  );

  useQuestDayCutoff({
    enabled: bootstrapPhase === "ready" && Boolean(accessToken && authUserId),
    sessionKey: authUserId,
    testTrigger: questCutoffTestTrigger,
    timeZone: timezone,
    onTestTriggerConsumed: () => {
      router.setParams({ _e2eQuestCutoff: undefined } as never);
    },
    routeContext: questRouteContext,
    onDayChanged: handleQuestDayChanged,
    onQuestCutoff: handleQuestCutoff,
  });

  useEffect(
    () => () => {
      if (refreshTimeoutRef.current !== null) {
        clearTimeout(refreshTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    rememberContentPathname(pathname);
  }, [pathname]);

  useNotificationResponseRouting(bootstrapPhase === "ready");

  return (
    <QuestDayCutoffModal
      visible={
        bootstrapPhase === "ready" &&
        questDayCutoff?.sessionKey === authUserId &&
        isQuestHubPath({ pathname })
      }
      status={questDayCutoff?.status ?? "refreshing"}
      onContinue={() => setQuestDayCutoff(null)}
      onRetry={() => {
        if (!questDayCutoff) return;
        setQuestDayCutoff((current) =>
          current ? { ...current, status: "refreshing" } : current,
        );
        handleQuestDayChanged(questDayCutoff.event);
      }}
    />
  );
}
