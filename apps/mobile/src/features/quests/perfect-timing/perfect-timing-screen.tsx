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
  type RefObject,
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
  type PerfectTimingAttempt,
  type PerfectTimingClientStopReason,
  type PerfectTimingState,
  type PerfectTimingStopInput,
  type PerfectTimingTier,
} from "@adventure-time/api-client";

import { CoinIcon } from "../../../components/icons";
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
import {
  clearPendingPerfectTimingStop,
  loadPendingPerfectTimingStop,
  savePendingPerfectTimingStop,
} from "./pending-stop";
import {
  PerfectTimingQuestShareCard,
  type PerfectTimingQuestShareCardStrings,
} from "./quest-share-card";
import {
  buildPerfectTimingShareFileName,
  buildPerfectTimingShareResult,
  type PerfectTimingShareResult,
} from "./share-result";

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;
type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
type TimerOwner = "official" | "training";
type TimerSnapshot = {
  owner: TimerOwner;
  attemptId: string | null;
  startedAt: number;
  targetMs: number | null;
};
type TrainingPhase = "ready" | "active" | "result";

const OFFICIAL_QUERY_KEY = ["perfect-timing"] as const;

function tierLabel(t: Translate, tier: PerfectTimingTier) {
  return t(`quests.perfectTiming.tiers.${tier}`);
}

function directionLabel(
  t: Translate,
  direction: "early" | "late" | "exact",
) {
  if (direction === "early") return t("quests.perfectTiming.tooEarly");
  if (direction === "late") return t("quests.perfectTiming.tooLate");
  return t("quests.perfectTiming.exact");
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
      setDecisionError(false);
      applyOfficialState(next);
    },
    onError: () => setDecisionError(true),
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

    Alert.alert(
      t("quests.perfectTiming.continueConfirmTitle"),
      t("quests.perfectTiming.continueConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("quests.perfectTiming.continueConfirmAction"),
          style: "destructive",
          onPress: () => continueMutation.mutate(result.id),
        },
      ],
    );
  }, [continueMutation, t]);

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
      contentContainerStyle={{
        paddingTop: Math.max(insets.top, 12),
        paddingBottom: Math.max(insets.bottom, 28),
        paddingHorizontal: 16,
        gap: 16,
      }}
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

function TargetCard({
  label,
  targetMs,
  locale,
}: {
  label: string;
  targetMs: number;
  locale: Locale;
}) {
  return (
    <View
      className="items-center gap-2 rounded-3xl border-2 border-primaryBorder bg-primaryTint px-5 py-6"
      testID="perfect-timing-target-card"
    >
      <Text className="font-nunito-bold text-xs uppercase tracking-widest text-primaryText">
        {label}
      </Text>
      <Text
        className="font-nunito-extrabold text-[40px] leading-[48px] text-primaryStrong"
        style={{ fontVariant: ["tabular-nums"] }}
        testID="perfect-timing-target"
      >
        {formatPerfectTimingMilliseconds(targetMs, locale)}
      </Text>
    </View>
  );
}

function TimerCard({
  timerRunning,
  timerText,
  t,
}: {
  timerRunning: boolean;
  timerText: string;
  t: Translate;
}) {
  return (
    <View className="items-center gap-2 rounded-3xl border-2 border-primaryTint bg-surface px-5 py-8">
      <Text className="font-nunito-bold text-xs uppercase tracking-widest text-fgMuted">
        {t("quests.perfectTiming.timer")}
      </Text>
      <View
        accessibilityElementsHidden={timerRunning}
        importantForAccessibility={timerRunning ? "no-hide-descendants" : "auto"}
      >
        <Text
          className="font-nunito-extrabold text-[48px] leading-[56px] text-fg"
          style={{ fontVariant: ["tabular-nums"] }}
          testID="perfect-timing-timer"
        >
          {timerText}
        </Text>
      </View>
    </View>
  );
}

function OfficialPanel({
  continuePending,
  decisionError,
  isSharing,
  keepPending,
  locale,
  onContinue,
  onKeep,
  onRetrySave,
  onShare,
  onStart,
  onStop,
  result,
  startError,
  startPending,
  state,
  stopError,
  t,
  tc,
  timerRunning,
  timerText,
}: {
  continuePending: boolean;
  decisionError: boolean;
  isSharing: boolean;
  keepPending: boolean;
  locale: Locale;
  onContinue: () => void;
  onKeep: () => void;
  onRetrySave: () => void;
  onShare: () => void;
  onStart: () => void;
  onStop: () => void;
  result: PerfectTimingAttempt | null;
  startError: boolean;
  startPending: boolean;
  state: PerfectTimingState;
  stopError: boolean;
  t: Translate;
  tc: ThemeColors;
  timerRunning: boolean;
  timerText: string;
}) {
  const showKeep =
    state.status === "result" && result?.tier != null && result.tier !== "miss";

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between px-1">
        <Text className="font-nunito-bold text-sm text-fgMuted">
          {t("quests.perfectTiming.attemptsRemaining")}
        </Text>
        <Text className="font-nunito-extrabold text-sm text-fg">
          {state.remainingAttempts} / {state.maxAttempts}
        </Text>
      </View>

      {timerRunning ? (
        <>
          <TimerCard timerRunning timerText={timerText} t={t} />
          <QuestActionButton
            label={t("quests.perfectTiming.stop")}
            onPress={onStop}
            backgroundColor={tc.dangerDark}
            minHeight={56}
            testID="perfect-timing-stop"
          />
        </>
      ) : null}

      {stopError ? (
        <View className="gap-3 rounded-2xl border border-dangerBorder bg-dangerTint p-4">
          <Text className="font-nunito-bold text-sm leading-5 text-dangerDark">
            {t("quests.perfectTiming.stopError")}
          </Text>
          <QuestActionButton
            label={t("quests.perfectTiming.retrySave")}
            onPress={onRetrySave}
            backgroundColor={tc.dangerDark}
            testID="perfect-timing-retry-save"
          />
        </View>
      ) : null}

      {!timerRunning && state.status === "ready" && !stopError ? (
        <View className="gap-3">
          <QuestActionButton
            label={t("quests.perfectTiming.start")}
            onPress={onStart}
            loading={startPending}
            backgroundColor={tc.primary}
            minHeight={56}
            testID="perfect-timing-start"
          />
          {startError ? (
            <Text
              accessibilityRole="alert"
              className="text-center font-nunito-bold text-sm text-dangerDark"
            >
              {t("quests.perfectTiming.startError")}
            </Text>
          ) : null}
        </View>
      ) : null}

      {!timerRunning && result && (state.status === "result" || state.finalized) ? (
        <ResultCard
          elapsedMs={result.elapsedMs ?? 0}
          final={state.finalized}
          locale={locale}
          result={{
            deviationMs: result.deviationMs ?? 0,
            direction: result.direction ?? "exact",
            tier: result.tier ?? "miss",
            reward: result.reward,
          }}
          rewardGranted={state.rewardGranted}
          t={t}
        />
      ) : null}

      {decisionError ? (
        <Text
          accessibilityRole="alert"
          className="text-center font-nunito-bold text-sm text-dangerDark"
        >
          {t("quests.perfectTiming.decisionError")}
        </Text>
      ) : null}

      {!timerRunning && state.status === "result" ? (
        <View className="gap-3">
          {showKeep ? (
            <QuestActionButton
              label={t("quests.perfectTiming.keepResult")}
              onPress={onKeep}
              loading={keepPending}
              backgroundColor={tc.successDark}
              minHeight={52}
              testID="perfect-timing-keep"
            />
          ) : null}
          <QuestActionButton
            label={t("quests.perfectTiming.continue")}
            onPress={onContinue}
            loading={continuePending}
            backgroundColor={tc.primary}
            minHeight={52}
            testID="perfect-timing-continue"
          />
        </View>
      ) : null}

      {state.finalized ? (
        <QuestActionButton
          label={
            isSharing
              ? t("quests.perfectTiming.sharePreparing")
              : t("quests.perfectTiming.shareResult")
          }
          onPress={onShare}
          loading={isSharing}
          loadingMode="inline"
          backgroundColor={tc.surface}
          foregroundColor={tc.primaryDark}
          borderColor={tc.primaryBorder}
          minHeight={50}
          testID="perfect-timing-share"
        />
      ) : null}
    </View>
  );
}

function TrainingPanel({
  elapsedMs,
  hasError,
  isLoading,
  isRefreshing,
  locale,
  onNewTarget,
  onRetry,
  onStart,
  onStop,
  phase,
  result,
  t,
  tc,
  timerRunning,
  timerText,
}: {
  elapsedMs: number | null;
  hasError: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  locale: Locale;
  onNewTarget: () => void;
  onRetry: () => void;
  onStart: () => void;
  onStop: () => void;
  phase: TrainingPhase;
  result: PerfectTimingLocalResult | null;
  t: Translate;
  tc: ThemeColors;
  timerRunning: boolean;
  timerText: string;
}) {
  return (
    <View className="gap-4">
      <Text className="rounded-2xl border border-infoBorder bg-infoTint p-4 font-nunito text-sm leading-5 text-infoText">
        {t("quests.perfectTiming.trainingBody")}
      </Text>

      {isLoading ? <ActivityIndicator color={tc.primaryDark} /> : null}

      {hasError ? (
        <View className="gap-3 rounded-2xl border border-dangerBorder bg-dangerTint p-4">
          <Text
            accessibilityRole="alert"
            className="text-center font-nunito-bold text-sm text-dangerDark"
          >
            {t("quests.perfectTiming.trainingTargetError")}
          </Text>
          <QuestActionButton
            label={t("common.tryAgain")}
            onPress={onNewTarget}
            loading={isRefreshing}
            backgroundColor={tc.dangerDark}
            testID="perfect-timing-training-target-retry"
          />
        </View>
      ) : null}

      {timerRunning ? (
        <>
          <TimerCard timerRunning timerText={timerText} t={t} />
          <QuestActionButton
            label={t("quests.perfectTiming.stop")}
            onPress={onStop}
            backgroundColor={tc.dangerDark}
            minHeight={56}
            testID="perfect-timing-training-stop"
          />
        </>
      ) : null}

      {!timerRunning && phase === "ready" && !isLoading && !isRefreshing ? (
        <QuestActionButton
          label={t("quests.perfectTiming.start")}
          onPress={onStart}
          backgroundColor={tc.primary}
          minHeight={56}
          testID="perfect-timing-training-start"
        />
      ) : null}

      {phase !== "result" && !isLoading && !hasError ? (
        <QuestActionButton
          label={t("quests.perfectTiming.newTarget")}
          onPress={onNewTarget}
          loading={isRefreshing}
          backgroundColor={tc.surface}
          foregroundColor={tc.primaryDark}
          borderColor={tc.primaryBorder}
          minHeight={50}
          testID="perfect-timing-training-new-target"
        />
      ) : null}

      {!timerRunning && phase === "result" && result && elapsedMs != null ? (
        <>
          <ResultCard
            elapsedMs={elapsedMs}
            final={false}
            locale={locale}
            result={result}
            rewardGranted={false}
            training
            t={t}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <QuestActionButton
                label={t("quests.perfectTiming.retry")}
                onPress={onRetry}
                backgroundColor={tc.primary}
                minHeight={50}
                testID="perfect-timing-training-retry"
              />
            </View>
            <View className="flex-1">
              <QuestActionButton
                label={t("quests.perfectTiming.newTarget")}
                onPress={onNewTarget}
                loading={isRefreshing}
                backgroundColor={tc.surface}
                foregroundColor={tc.primaryDark}
                borderColor={tc.primaryBorder}
                minHeight={50}
                testID="perfect-timing-training-new-target"
              />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

function ResultCard({
  elapsedMs,
  final,
  locale,
  result,
  rewardGranted,
  training = false,
  t,
}: {
  elapsedMs: number;
  final: boolean;
  locale: Locale;
  result: PerfectTimingLocalResult;
  rewardGranted: boolean;
  training?: boolean;
  t: Translate;
}) {
  const successful = result.tier !== "miss";
  return (
    <View
      className={`gap-4 rounded-3xl border-2 p-5 ${
        successful
          ? "border-successBorder bg-successTint"
          : "border-dangerBorder bg-dangerTint"
      }`}
      testID="perfect-timing-result"
    >
      <Text
        accessibilityRole="header"
        className={`text-center font-nunito-extrabold text-xl ${
          successful ? "text-successText" : "text-dangerText"
        }`}
      >
        {final
          ? t("quests.perfectTiming.finalResultTitle")
          : t("quests.perfectTiming.resultTitle")}
      </Text>

      <View className="flex-row gap-3">
        <ResultMetric
          label={t("quests.perfectTiming.achievedTime")}
          value={formatPerfectTimingMilliseconds(elapsedMs, locale)}
        />
        <ResultMetric
          label={t("quests.perfectTiming.deviation")}
          value={formatPerfectTimingMilliseconds(result.deviationMs, locale)}
        />
      </View>

      <Text className="text-center font-nunito-bold text-sm text-fg">
        {directionLabel(t, result.direction)}
      </Text>
      <Text className="text-center font-nunito-extrabold text-2xl text-fg">
        {tierLabel(t, result.tier)}
      </Text>

      <View className="flex-row items-center justify-center gap-2">
        <CoinIcon size={22} />
        <Text className="font-nunito-extrabold text-lg text-fg">
          {training ? "0" : result.reward}
        </Text>
      </View>

      <Text className="text-center font-nunito-bold text-sm leading-5 text-fgMuted">
        {training || result.tier === "miss"
          ? t("quests.perfectTiming.noReward")
          : rewardGranted
            ? t("quests.perfectTiming.rewardGranted", { amount: result.reward })
            : t("quests.perfectTiming.rewardPreview", { amount: result.reward })}
      </Text>

      {final ? (
        <Text className="text-center font-nunito-extrabold text-sm text-fg">
          {successful
            ? t("quests.perfectTiming.finalSuccess")
            : t("quests.perfectTiming.finalFailure")}
        </Text>
      ) : null}
    </View>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center gap-1 rounded-2xl bg-surface px-2 py-3">
      <Text className="text-center font-nunito-bold text-[11px] uppercase text-fgMuted">
        {label}
      </Text>
      <Text
        className="text-center font-nunito-extrabold text-lg text-fg"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </View>
  );
}

function OffscreenShareCard({
  cardRef,
  colors,
  result,
  strings,
}: {
  cardRef: RefObject<View | null>;
  colors: ThemeColors;
  result: PerfectTimingShareResult;
  strings: PerfectTimingQuestShareCardStrings;
}) {
  return (
    <View
      accessibilityElementsHidden
      pointerEvents="none"
      collapsable={false}
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", left: -9999, top: 0 }}
    >
      <View ref={cardRef} collapsable={false}>
        <PerfectTimingQuestShareCard
          colors={colors}
          result={result}
          strings={strings}
        />
      </View>
    </View>
  );
}
