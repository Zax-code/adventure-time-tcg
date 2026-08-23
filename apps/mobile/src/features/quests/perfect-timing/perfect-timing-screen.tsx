import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  ScrollView,
  Text,
  View,
  type AppStateStatus,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ApiClientError,
  type PerfectTimingClientStopReason,
  type PerfectTimingState,
  type PerfectTimingStopInput,
  type PerfectTimingTier,
} from "@adventure-time/api-client";

import {
  QuestScreenDescription,
  QuestScreenHeader,
} from "../quest-screen-header";
import { QuestActionButton } from "../quest-action-button";
import { formatQuestShareDate } from "../quest-share-date";
import { useTranslation } from "../../../i18n";
import type { Locale } from "../../../i18n/types";
import { apiClient } from "../../../lib/api";
import { useSessionStore } from "../../../stores/session-store";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";
import {
  calculatePerfectTimingResult,
  elapsedMilliseconds,
  formatPerfectTimingMilliseconds,
  visibleTimerText,
  type PerfectTimingLocalResult,
} from "./model";
import { OffscreenShareCard } from "./offscreen-share-card";
import { OfficialPanel } from "./official-panel";
import {
  clearPendingPerfectTimingStop,
  loadPendingPerfectTimingStop,
  savePendingPerfectTimingStop,
} from "./pending-stop";
import { ContinueConfirmationModal } from "./continue-confirmation-modal";
import type { PerfectTimingQuestShareCardStrings } from "./quest-share-card";
import {
  buildPerfectTimingShareFileName,
  buildPerfectTimingShareResult,
  type PerfectTimingShareResult,
} from "./share-result";
import { TargetCard } from "./target-card";
import { TrainingPanel } from "./training-panel";
import type { TrainingPhase, Translate } from "./types";

type TimerOwner = "official" | "training";
type TimerSnapshot = {
  owner: TimerOwner;
  attemptId: string | null;
  startedAt: number;
  targetMs: number | null;
};

const OFFICIAL_QUERY_KEY = ["perfect-timing"] as const;

function tierLabel(t: Translate, tier: PerfectTimingTier) {
  return t(`quests.perfectTiming.tiers.${tier}`);
}

async function fetchPerfectTimingState(userId: string) {
  const pending = await loadPendingPerfectTimingStop(userId);
  if (pending) {
    try {
      await apiClient.stopPerfectTiming(pending);
      await clearPendingPerfectTimingStop(userId, pending.attemptId);
    } catch (error) {
      const stalePendingStop =
        error instanceof ApiClientError &&
        (error.status === 404 || error.code === "PERFECT_TIMING_RESET");

      if (!stalePendingStop) throw error;
      await clearPendingPerfectTimingStop(userId, pending.attemptId);
    }
  }

  return apiClient.perfectTimingState();
}

export default function PerfectTimingScreen() {
  return usePerfectTimingScreenView();
}

function usePerfectTimingScreenView() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const trainingMode = mode === "training";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reactQueryClient = useQueryClient();
  const { locale, t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const user = useSessionStore((state) => state.user);
  const patchUser = useSessionStore((state) => state.patchUser);
  const userId = user?.id ?? null;

  const [timerText, setTimerText] = useState(() =>
    formatPerfectTimingMilliseconds(0, locale),
  );
  const [timerRunning, setTimerRunning] = useState(false);
  const [stopError, setStopError] = useState(false);
  const [decisionError, setDecisionError] = useState(false);
  const [continueConfirmationVisible, setContinueConfirmationVisible] =
    useState(false);
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase>("ready");
  const [trainingResult, setTrainingResult] =
    useState<PerfectTimingLocalResult | null>(null);
  const [trainingElapsedMs, setTrainingElapsedMs] = useState<number | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const timerRef = useRef<TimerSnapshot | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const stopLockRef = useRef(false);
  const stateRef = useRef<PerfectTimingState | null>(null);
  const stopCurrentRef = useRef<
    (reason: PerfectTimingClientStopReason) => Promise<void>
  >(async () => undefined);
  const shareCardRef = useRef<View>(null);

  const stateQuery = useQuery({
    queryKey: OFFICIAL_QUERY_KEY,
    queryFn: () => {
      if (!userId) throw new Error("Missing user session");
      if (timerRef.current?.owner === "official" && stateRef.current) {
        return stateRef.current;
      }
      return fetchPerfectTimingState(userId);
    },
    enabled: Boolean(userId),
    staleTime: 0,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });
  const state = stateQuery.data ?? null;

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const trainingTargetQuery = useQuery({
    queryKey: ["perfect-timing-training-target", state?.date ?? "today"],
    queryFn: () => apiClient.perfectTimingTrainingTarget(),
    enabled: trainingMode && Boolean(userId),
    staleTime: Infinity,
  });
  const trainingTargetMs = trainingTargetQuery.data?.targetMs ?? null;
  const scrollContentStyle = useMemo(
    () => ({
      paddingTop: Math.max(insets.top, 12),
      paddingBottom: Math.max(insets.bottom, 28),
      paddingHorizontal: 16,
      gap: 16,
    }),
    [insets.bottom, insets.top],
  );

  useEffect(() => {
    if (state && user && state.coinBalance !== user.coins) {
      void patchUser({ coins: state.coinBalance });
    }
  }, [patchUser, state, user]);

  const applyOfficialState = useCallback(
    (next: PerfectTimingState) => {
      stateRef.current = next;
      reactQueryClient.setQueryData(OFFICIAL_QUERY_KEY, next);
      if (user && next.coinBalance !== user.coins) {
        void patchUser({ coins: next.coinBalance });
      }
      void reactQueryClient.invalidateQueries({ queryKey: ["quests"] });
    },
    [patchUser, reactQueryClient, user],
  );

  const stopRenderLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    const timer = timerRef.current;
    if (
      timer?.owner !== "official" ||
      !state ||
      state.activeAttempt?.id === timer.attemptId
    ) {
      return;
    }

    timerRef.current = null;
    stopRenderLoop();
    setTimerRunning(false);
  }, [state, stopRenderLoop]);

  const beginTimer = useCallback(
    (owner: TimerOwner, attemptId: string | null, targetMs: number | null) => {
      stopRenderLoop();
      const startedAt = performance.now();
      timerRef.current = { owner, attemptId, startedAt, targetMs };
      stopLockRef.current = false;
      setStopError(false);
      setTimerRunning(true);
      setTimerText(formatPerfectTimingMilliseconds(0, locale));

      const renderVisibleTime = (currentTime: number) => {
        const activeTimer = timerRef.current;
        if (!activeTimer || activeTimer.startedAt !== startedAt) return;

        const nextText = visibleTimerText(startedAt, currentTime, locale);
        setTimerText(nextText);
        if (nextText === "???") {
          animationFrameRef.current = null;
          return;
        }
        animationFrameRef.current = requestAnimationFrame(renderVisibleTime);
      };

      animationFrameRef.current = requestAnimationFrame(renderVisibleTime);
    },
    [locale, stopRenderLoop],
  );

  const startOfficialMutation = useMutation({
    mutationFn: async () => {
      const current = stateRef.current;
      if (!current) throw new Error("Perfect Timing state is unavailable");
      return apiClient.startPerfectTiming({
        dateKey: current.date,
        questVersion: current.questVersion,
      });
    },
    onSuccess: (next) => {
      applyOfficialState(next);
      if (next.activeAttempt) {
        beginTimer("official", next.activeAttempt.id, null);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    onError: () => {
      void stateQuery.refetch();
    },
  });

  const continueMutation = useMutation({
    mutationFn: async (attemptId: string) => {
      const current = stateRef.current;
      if (!current) throw new Error("Perfect Timing state is unavailable");
      return apiClient.continuePerfectTiming({
        attemptId,
        dateKey: current.date,
        questVersion: current.questVersion,
      });
    },
    onSuccess: (next) => {
      setContinueConfirmationVisible(false);
      setDecisionError(false);
      reactQueryClient.setQueryData(OFFICIAL_QUERY_KEY, next);
      applyOfficialState(next);
    },
    onError: () => {
      setContinueConfirmationVisible(false);
      setDecisionError(true);
    },
  });

  const keepMutation = useMutation({
    mutationFn: async (attemptId: string) => {
      const current = stateRef.current;
      if (!current) throw new Error("Perfect Timing state is unavailable");
      return apiClient.keepPerfectTiming({
        attemptId,
        dateKey: current.date,
        questVersion: current.questVersion,
      });
    },
    onSuccess: (next) => {
      setDecisionError(false);
      reactQueryClient.setQueryData(OFFICIAL_QUERY_KEY, next);
      applyOfficialState(next);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => setDecisionError(true),
  });

  const notifyResult = useCallback((tier: PerfectTimingTier | null) => {
    if (!tier) return;
    void Haptics.notificationAsync(
      tier === "miss"
        ? Haptics.NotificationFeedbackType.Error
        : Haptics.NotificationFeedbackType.Success,
    );
  }, []);

  const stopCurrent = useCallback(
    async (reason: PerfectTimingClientStopReason) => {
      const timer = timerRef.current;
      if (!timer || stopLockRef.current) return;

      const stoppedAt = performance.now();
      stopLockRef.current = true;
      timerRef.current = null;
      stopRenderLoop();
      setTimerRunning(false);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const elapsedMs = elapsedMilliseconds(timer.startedAt, stoppedAt);

      if (timer.owner === "training") {
        const targetMs = timer.targetMs;
        if (targetMs != null) {
          const result = calculatePerfectTimingResult(targetMs, elapsedMs);
          setTrainingElapsedMs(elapsedMs);
          setTrainingResult(result);
          setTrainingPhase("result");
          notifyResult(result.tier);
        }
        stopLockRef.current = false;
        return;
      }

      const current = stateRef.current;
      if (!userId || !current || !timer.attemptId) {
        stopLockRef.current = false;
        return;
      }

      const input: PerfectTimingStopInput = {
        attemptId: timer.attemptId,
        elapsedMs,
        stopReason: reason,
        dateKey: current.date,
        questVersion: current.questVersion,
      };

      try {
        await savePendingPerfectTimingStop(userId, input);
        const next = await apiClient.stopPerfectTiming(input);
        await clearPendingPerfectTimingStop(userId, input.attemptId);
        setStopError(false);
        applyOfficialState(next);
        notifyResult(next.currentResult?.tier ?? null);
      } catch {
        setStopError(true);
      } finally {
        stopLockRef.current = false;
      }
    },
    [
      applyOfficialState,
      notifyResult,
      stopRenderLoop,
      userId,
    ],
  );

  useEffect(() => {
    stopCurrentRef.current = stopCurrent;
  }, [stopCurrent]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState !== "active" && timerRef.current) {
          void stopCurrentRef.current("background");
        }
        if (nextState === "active" && stopError) {
          void stateQuery.refetch();
        }
      },
    );
    return () => subscription.remove();
  }, [stateQuery, stopError]);

  useFocusEffect(
    useCallback(
      () => () => {
        if (timerRef.current) {
          void stopCurrentRef.current("navigation");
        }
      },
      [],
    ),
  );

  useEffect(
    () => () => {
      stopRenderLoop();
    },
    [stopRenderLoop],
  );

  const changeMode = useCallback(
    async (nextMode: TimerOwner) => {
      if (timerRef.current) {
        await stopCurrentRef.current("navigation");
      }
      router.setParams({ mode: nextMode === "training" ? "training" : undefined });
    },
    [router],
  );

  const startTraining = useCallback(() => {
    if (trainingTargetMs == null || timerRunning) return;
    setTrainingResult(null);
    setTrainingElapsedMs(null);
    setTrainingPhase("active");
    beginTimer("training", null, trainingTargetMs);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [beginTimer, timerRunning, trainingTargetMs]);

  const newTrainingTarget = useCallback(async () => {
    if (timerRef.current?.owner === "training") {
      await stopCurrent("navigation");
    }
    setTrainingResult(null);
    setTrainingElapsedMs(null);
    setTrainingPhase("ready");
    await trainingTargetQuery.refetch();
  }, [stopCurrent, trainingTargetQuery]);

  const confirmContinue = useCallback(() => {
    const result = stateRef.current?.currentResult;
    if (!result || continueMutation.isPending) return;
    setContinueConfirmationVisible(true);
  }, [continueMutation.isPending]);

  const discardAndContinue = useCallback(() => {
    const result = stateRef.current?.currentResult;
    if (!result || continueMutation.isPending) return;
    continueMutation.mutate(result.id);
  }, [continueMutation]);

  const shareResult = useMemo<PerfectTimingShareResult | null>(() => {
    if (
      !state?.finalized ||
      !state.finalTier ||
      !state.finalizedAttemptNumber
    ) {
      return null;
    }
    return buildPerfectTimingShareResult({
      questTitle: t("quests.perfectTiming.title"),
      date: state.date,
      targetMs: state.targetMs,
      finalTier: state.finalTier,
      finalizedAttemptNumber: state.finalizedAttemptNumber,
      attempts: state.attempts.map((attempt) => ({
        attemptNumber: attempt.attemptNumber,
        elapsedMs: attempt.elapsedMs,
        tier: attempt.tier,
      })),
    });
  }, [state, t]);

  const shareStrings = useMemo<PerfectTimingQuestShareCardStrings | null>(() => {
    if (!shareResult) return null;
    const attemptLabels = shareResult.attempts.map((attempt) =>
      t("quests.perfectTiming.attempt", { number: attempt.attemptNumber }),
    ) as [string, string, string];
    const attemptValues = shareResult.attempts.map((attempt) =>
      attempt.elapsedMs == null
        ? t("quests.perfectTiming.unused")
        : formatPerfectTimingMilliseconds(attempt.elapsedMs, locale),
    ) as [string, string, string];

    return {
      brand: t("quests.perfectTiming.shareBrand"),
      date: formatQuestShareDate(shareResult.date, locale),
      targetLabel: t("quests.perfectTiming.todaysTarget"),
      targetValue: formatPerfectTimingMilliseconds(shareResult.targetMs, locale),
      attemptLabels,
      attemptValues,
      finalTierLabel: t("quests.perfectTiming.shareFinalTier"),
      finalTier: tierLabel(t, shareResult.finalTier),
      finalized: t("quests.perfectTiming.finalized"),
      unused: t("quests.perfectTiming.unused"),
      footer: t("quests.perfectTiming.shareFooter"),
    };
  }, [locale, shareResult, t]);

  const handleShareResult = useCallback(async () => {
    if (isSharing || !shareCardRef.current || !shareResult) return;
    setIsSharing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const [canShare] = await Promise.all([
        Sharing.isAvailableAsync(),
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
      ]);
      if (!canShare) {
        Alert.alert(t("quests.perfectTiming.shareUnavailable"));
        return;
      }

      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      let shareUri = uri;
      try {
        const destination = new File(
          Paths.cache,
          buildPerfectTimingShareFileName(shareResult),
        );
        if (destination.exists) destination.delete();
        await new File(uri).copy(destination);
        shareUri = destination.uri;
      } catch (copyError) {
        console.warn("Failed to rename Perfect Timing share image", copyError);
      }

      await Sharing.shareAsync(shareUri, {
        mimeType: "image/png",
        dialogTitle: t("quests.perfectTiming.shareDialogTitle"),
        UTI: "public.png",
      });
    } catch (error) {
      console.warn("Failed to share Perfect Timing result", error);
      Alert.alert(t("quests.perfectTiming.shareError"));
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, shareResult, t]);

  if (stateQuery.isError) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-bg px-6">
        <Text className="text-center font-nunito-bold text-dangerDark">
          {t("quests.perfectTiming.loadError")}
        </Text>
        <QuestActionButton
          label={t("common.tryAgain")}
          onPress={() => void stateQuery.refetch()}
          backgroundColor={tc.primary}
        />
      </View>
    );
  }

  if (stateQuery.isLoading || !state) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={tc.primaryDark} size="large" />
        <Text className="pt-3 font-nunito-bold text-fgMuted">
          {t("quests.perfectTiming.loading")}
        </Text>
      </View>
    );
  }

  const officialResult = state.currentResult;
  const displayTargetMs = trainingMode ? trainingTargetMs : state.targetMs;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={scrollContentStyle}
      keyboardShouldPersistTaps="handled"
    >
      <QuestScreenHeader
        title={t("quests.perfectTiming.title")}
        backLabel={t("quests.perfectTiming.backToQuests")}
        backTestID="perfect-timing-back"
      />
      <QuestScreenDescription>
        {t("quests.perfectTiming.subtitle")}
      </QuestScreenDescription>

      <ModeSelector
        trainingMode={trainingMode}
        onChange={(next) => void changeMode(next)}
        t={t}
      />

      {displayTargetMs != null ? (
        <TargetCard
          label={t(
            trainingMode
              ? "quests.perfectTiming.trainingTarget"
              : "quests.perfectTiming.todaysTarget",
          )}
          targetMs={displayTargetMs}
          locale={locale}
        />
      ) : null}

      {trainingMode ? (
        <TrainingPanel
          elapsedMs={trainingElapsedMs}
          hasError={trainingTargetQuery.isError}
          isLoading={trainingTargetQuery.isLoading}
          isRefreshing={trainingTargetQuery.isFetching}
          locale={locale}
          onNewTarget={() => void newTrainingTarget()}
          onRetry={startTraining}
          onStart={startTraining}
          onStop={() => void stopCurrent("manual")}
          phase={trainingPhase}
          result={trainingResult}
          t={t}
          tc={tc}
          timerRunning={timerRunning}
          timerText={timerText}
        />
      ) : (
        <OfficialPanel
          continuePending={continueMutation.isPending}
          decisionError={decisionError}
          isSharing={isSharing}
          keepPending={keepMutation.isPending}
          locale={locale}
          onContinue={confirmContinue}
          onKeep={() => {
            if (officialResult) keepMutation.mutate(officialResult.id);
          }}
          onRetrySave={() => void stateQuery.refetch()}
          onShare={() => void handleShareResult()}
          onStart={() => startOfficialMutation.mutate()}
          onStop={() => void stopCurrent("manual")}
          result={officialResult}
          startError={startOfficialMutation.isError}
          startPending={startOfficialMutation.isPending}
          state={state}
          stopError={stopError}
          t={t}
          tc={tc}
          timerRunning={timerRunning}
          timerText={timerText}
        />
      )}

      {shareResult && shareStrings ? (
        <OffscreenShareCard
          cardRef={shareCardRef}
          colors={tc}
          result={shareResult}
          strings={shareStrings}
        />
      ) : null}

      <ContinueConfirmationModal
        visible={continueConfirmationVisible}
        loading={continueMutation.isPending}
        onDiscard={discardAndContinue}
        onStay={() => setContinueConfirmationVisible(false)}
        t={t}
      />
    </ScrollView>
  );
}

function ModeSelector({
  trainingMode,
  onChange,
  t,
}: {
  trainingMode: boolean;
  onChange: (mode: TimerOwner) => void;
  t: Translate;
}) {
  return (
    <View
      className="flex-row rounded-2xl border border-primaryBorder bg-surfaceMuted p-1"
      accessibilityRole="tablist"
    >
      {(["official", "training"] as const).map((mode) => {
        const selected = trainingMode ? mode === "training" : mode === "official";
        return (
          <Pressable
            key={mode}
            onPress={() => onChange(mode)}
            className={`min-h-11 flex-1 items-center justify-center rounded-xl px-3 ${
              selected ? "bg-surface" : "bg-transparent"
            }`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            testID={`perfect-timing-mode-${mode}`}
          >
            <Text
              className={`font-nunito-bold text-sm ${
                selected ? "text-primaryStrong" : "text-fgMuted"
              }`}
            >
              {t(`quests.perfectTiming.${mode}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
