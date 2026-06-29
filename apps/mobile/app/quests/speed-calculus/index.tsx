import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useEffectEvent,
} from "react";
import * as Haptics from "expo-haptics";
import {
  AppState,
  type AppStateStatus,
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import type {
  SpeedRunState,
} from "@adventure-time/api-client";

import { ApiClientError, apiClient } from "../../../src/lib/api";
import { useTranslation } from "../../../src/i18n";
import { PageLoadingState } from "../../../src/components/loading-state";
import { useQuestResetStore } from "../../../src/stores/quest-reset-store";
import { useThemeStore } from "../../../src/stores/theme-store";
import { THEME_COLORS } from "../../../src/theme/themes";

import { ActiveRunPanel } from "../../../src/features/quests/speed-calculus/active-run-panel";
import { RunHistoryCard } from "../../../src/features/quests/speed-calculus/run-history";
import { SummaryCard } from "../../../src/features/quests/speed-calculus/summary-card";
import {
  appendDigit,
  deleteDigit,
  toggleSign,
  canSubmitAnswer,
  type ToastType,
  type FeedbackType,
} from "../../../src/features/quests/speed-calculus/constants";
import {
  getAnswerBoxPalette,
  withAlpha,
} from "../../../src/features/quests/speed-calculus/palette";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ActiveSpeedRun = NonNullable<SpeedRunState["activeRun"]>;

export default function SpeedCalculusScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const lastQuestResetAt = useQuestResetStore((state) => state.lastResetAt);
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];

  // ── Core state ───────────────────────────────────────────────────
  const [state, setState] = useState<SpeedRunState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answer, setAnswer] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [pauseRemainingSeconds, setPauseRemainingSeconds] = useState(0);
  const [toast, setToast] = useState<ToastType>(null);
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [openRuns, setOpenRuns] = useState<Record<number, boolean>>({});
  const [roundOverScore, setRoundOverScore] = useState(0);
  const [roundOverRunNumber, setRoundOverRunNumber] = useState(1);

  // ── Refs ─────────────────────────────────────────────────────────
  const playDeadlineRef = useRef<number | null>(null);
  const pauseDeadlineRef = useRef<number | null>(null);
  const finishRequestedRef = useRef(false);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerRef = useRef("");
  const activeRunRef = useRef<ActiveSpeedRun | null>(null);
  const remainingSecondsRef = useRef(0);
  const pauseRemainingSecondsRef = useRef(0);
  const stateRef = useRef<SpeedRunState | null>(null);
  const questVersionRef = useRef<string | null>(null);
  const mutationEpochRef = useRef(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const feedbackSlide = useRef(new Animated.Value(-20)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  // ── Derived ──────────────────────────────────────────────────────
  const activeRun = state?.activeRun ?? null;
  const currentQuestion = useMemo(() => {
    if (!activeRun) return null;
    return activeRun.questions[activeRun.questionIndex] ?? null;
  }, [activeRun]);
  const isManuallyPaused = activeRun?.isManuallyPaused ?? false;
  const keypadLocked =
    !currentQuestion ||
    submitting ||
    pauseRemainingSeconds > 0 ||
    isManuallyPaused;
  const submitDisabled = keypadLocked || !canSubmitAnswer(answer);

  // ── Apply state from API ─────────────────────────────────────────
  const applyState = useCallback((next: SpeedRunState) => {
    stateRef.current = next;
    setState(next);
    if (!next.activeRun) {
      activeRunRef.current = null;
      playDeadlineRef.current = null;
      pauseDeadlineRef.current = null;
      remainingSecondsRef.current = 0;
      pauseRemainingSecondsRef.current = 0;
      setRemainingSeconds(0);
      setPauseRemainingSeconds(0);
      answerRef.current = "";
      setAnswer("");
      setFeedback(null);
      return;
    }
    const now = Date.now();
    const nextPauseRemainingSeconds = next.activeRun.pauseRemainingSeconds;
    const nextRemainingSeconds = next.activeRun.remainingSeconds;

    if (nextPauseRemainingSeconds > 0) {
      pauseDeadlineRef.current = now + nextPauseRemainingSeconds * 1000;
      playDeadlineRef.current =
        pauseDeadlineRef.current + nextRemainingSeconds * 1000;
    } else {
      pauseDeadlineRef.current = null;
      playDeadlineRef.current = now + nextRemainingSeconds * 1000;
    }

    activeRunRef.current = next.activeRun;
    remainingSecondsRef.current = nextRemainingSeconds;
    pauseRemainingSecondsRef.current = nextPauseRemainingSeconds;
    setPauseRemainingSeconds(nextPauseRemainingSeconds);
    setRemainingSeconds(nextRemainingSeconds);
    answerRef.current = "";
    setAnswer("");
  }, []);

  const notifySpeedReset = useCallback(
    (nextState?: SpeedRunState | null) => {
      setShowRoundOver(false);
      setModalVisible(false);
      setOpenRuns({});
      setToast({
        type: "success",
        message: nextState?.resetByName
          ? t("quests.speedCalculusResetByAdmin", {
              name: nextState.resetByName,
            })
          : t("quests.speedCalculusReset"),
      });
      void queryClient.invalidateQueries({ queryKey: ["quests"] });
    },
    [queryClient, t],
  );

  const syncLoadedState = useCallback(
    (next: SpeedRunState) => {
      const previousVersion = questVersionRef.current;
      const nextVersion = next.questVersion ?? null;

      if (previousVersion && nextVersion && previousVersion !== nextVersion) {
        notifySpeedReset(next);
      }

      questVersionRef.current = nextVersion;
      applyState(next);
    },
    [applyState, notifySpeedReset],
  );

  // ── Load state ───────────────────────────────────────────────────
  const loadState = useCallback(async () => {
    const requestEpoch = mutationEpochRef.current;

    try {
      const data = await apiClient.speedCalculusState();
      if (requestEpoch !== mutationEpochRef.current) {
        return;
      }

      syncLoadedState(data);
    } catch (error) {
      if (requestEpoch !== mutationEpochRef.current) {
        return;
      }

      if (__DEV__) {
        console.warn("[speed-calculus] failed to load state", error);
      }

      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : t("quests.speedCalculusLoadError"),
      });
    } finally {
      if (requestEpoch === mutationEpochRef.current) {
        setLoading(false);
      }
    }
  }, [syncLoadedState, t]);

  const commitActiveRun = useCallback((nextRun: ActiveSpeedRun) => {
    activeRunRef.current = nextRun;
    remainingSecondsRef.current = nextRun.remainingSeconds;
    pauseRemainingSecondsRef.current = nextRun.pauseRemainingSeconds;
    setRemainingSeconds(nextRun.remainingSeconds);
    setPauseRemainingSeconds(nextRun.pauseRemainingSeconds);
    setState((prev) => {
      if (!prev?.activeRun || prev.activeRun.runId !== nextRun.runId) {
        return prev;
      }

      const next = { ...prev, activeRun: nextRun };
      stateRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    if (activeRun) {
      return;
    }

    const intervalMs = 15_000;
    const interval = setInterval(() => {
      void loadState();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [activeRun, loadState]);

  useEffect(() => {
    if (!lastQuestResetAt) return;
    void loadState();
  }, [lastQuestResetAt, loadState]);

  const handleSpeedResetError = useCallback(
    async (error: unknown) => {
      if (
        error instanceof ApiClientError &&
        error.status === 409 &&
        error.code === "SPEED_CALCULUS_RESET"
      ) {
        notifySpeedReset(state);
        await loadState();
        return true;
      }

      return false;
    },
    [loadState, notifySpeedReset, state],
  );

  // ── Toast auto-dismiss ───────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // ── Feedback cleanup ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  // ── Finish run ───────────────────────────────────────────────────
  const finishRun = useCallback(async (runSnapshot?: ActiveSpeedRun | null) => {
    const runToFinish = runSnapshot ?? activeRunRef.current;
    const currentState = stateRef.current;

    if (finishRequestedRef.current || !runToFinish) return;
    finishRequestedRef.current = true;
    mutationEpochRef.current += 1;
    const finishingRunNumber = runToFinish.runNumber;
    setSubmitting(true);
    try {
      const result = await apiClient.finishSpeedCalculus(
        runToFinish.runId,
        currentState?.questVersion ?? undefined,
        runToFinish.answers,
      );
      setRoundOverRunNumber(finishingRunNumber);
      setRoundOverScore(result.correctAnswers ?? 0);
      syncLoadedState(result); // clears activeRun before showing overlay
      setShowRoundOver(true); // safe to show now: activeRun is null, modal won't re-open
      void queryClient.invalidateQueries({ queryKey: ["quests"] });
      setToast({
        type: "success",
        message: result.locked
          ? t("quests.speedCalculusRunLocked", {
              score: result.correctAnswers ?? 0,
              reward: result.reward ?? 0,
            })
          : t("quests.speedCalculusRunFinished", {
              score: result.correctAnswers ?? 0,
              reward: result.reward ?? 0,
            }),
      });
    } catch (error) {
      if (await handleSpeedResetError(error)) {
        return;
      }
      setShowRoundOver(false);
      setModalVisible(false);
      setToast({
        type: "error",
        message: t("quests.speedCalculusFinishError"),
      });
      await loadState();
    } finally {
      finishRequestedRef.current = false;
      setSubmitting(false);
    }
  }, [
    handleSpeedResetError,
    loadState,
    queryClient,
    syncLoadedState,
    t,
  ]);

  // ── Countdown timer ──────────────────────────────────────────────
  useEffect(() => {
    if (!state?.activeRun) return;

    if (isManuallyPaused) {
      if (pauseDeadlineRef.current) {
        pauseDeadlineRef.current = null;
      }

      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const nextPause = pauseDeadlineRef.current
        ? Math.max(0, Math.ceil((pauseDeadlineRef.current - now) / 1000))
        : 0;
      if (nextPause > 0) {
        pauseRemainingSecondsRef.current = nextPause;
        setPauseRemainingSeconds(nextPause);
        return;
      }
      if (pauseDeadlineRef.current) {
        pauseDeadlineRef.current = null;
        pauseRemainingSecondsRef.current = 0;
        setPauseRemainingSeconds(0);
      }
      const nextRemaining = playDeadlineRef.current
        ? Math.max(0, Math.ceil((playDeadlineRef.current - now) / 1000))
        : 0;
      remainingSecondsRef.current = nextRemaining;
      setRemainingSeconds(nextRemaining);
      if (nextRemaining === 0) {
        clearInterval(interval);
        void finishRun(activeRunRef.current);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [finishRun, isManuallyPaused, state?.activeRun]);

  // ── Auto-finish when all questions answered ──────────────────────
  useEffect(() => {
    if (!activeRun || pauseRemainingSeconds > 0 || isManuallyPaused) return;
    if (activeRun.questionIndex >= activeRun.questions.length) {
      void finishRun(activeRunRef.current);
    }
  }, [activeRun, finishRun, isManuallyPaused, pauseRemainingSeconds]);

  // ── Animation helpers ────────────────────────────────────────────
  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 7,
        duration: 68,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -7,
        duration: 68,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 5,
        duration: 68,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -5,
        duration: 68,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 68,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shakeAnim]);

  const showFeedback = useCallback(
    (fb: FeedbackType) => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      setFeedback(fb);
      feedbackSlide.setValue(-20);
      feedbackOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(feedbackSlide, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(feedbackOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedback(null);
        feedbackTimeoutRef.current = null;
      }, 1600);
    },
    [feedbackSlide, feedbackOpacity],
  );

  // ── Keypad handlers ──────────────────────────────────────────────
  const handleDigit = useCallback(
    (digit: string) => {
      if (keypadLocked) return;
      const next = appendDigit(answerRef.current, digit);
      answerRef.current = next;
      setAnswer(next);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [keypadLocked],
  );

  const handleDelete = useCallback(() => {
    if (keypadLocked) return;
    const next = deleteDigit(answerRef.current);
    answerRef.current = next;
    setAnswer(next);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [keypadLocked]);

  const handleClear = useCallback(() => {
    if (keypadLocked) return;
    answerRef.current = "";
    setAnswer("");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [keypadLocked]);

  const handleToggleSign = useCallback(() => {
    if (keypadLocked) return;
    const next = toggleSign(answerRef.current);
    answerRef.current = next;
    setAnswer(next);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [keypadLocked]);

  // ── Submit answer ────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    const run = activeRunRef.current;
    const question = run?.questions[run.questionIndex] ?? null;

    if (!run || !question || submitting || pauseRemainingSeconds > 0 || isManuallyPaused) {
      return;
    }

    const trimmed = answerRef.current.trim();
    if (!canSubmitAnswer(trimmed)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      triggerShake();
      return;
    }
    const expectedAnswer =
      question.operator === "+"
        ? question.left + question.right
        : question.left - question.right;
    const parsed = parseInt(trimmed, 10);
    const isCorrect = parsed === expectedAnswer;
    const nextAnswers = [...run.answers, parsed];
    const nextQuestionIndex = Math.min(nextAnswers.length, run.questions.length);
    const nextRun: ActiveSpeedRun = {
      ...run,
      answers: nextAnswers,
      correctAnswers: run.correctAnswers + (isCorrect ? 1 : 0),
      questionIndex: nextQuestionIndex,
      remainingSeconds: remainingSecondsRef.current,
      pauseRemainingSeconds: pauseRemainingSecondsRef.current,
    };

    if (isCorrect) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFeedback({
        kind: "correct",
        message: t("quests.speedCalculusCorrectFeedback"),
      });
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFeedback({
        kind: "incorrect",
        message: t("quests.speedCalculusWrongFeedback", {
          answer: expectedAnswer,
        }),
        questionLabel: `${question.left} ${question.operator} ${question.right}`,
        correctAnswer: expectedAnswer,
      });
      triggerShake();
    }

    answerRef.current = "";
    setAnswer("");
    commitActiveRun(nextRun);

    if (nextQuestionIndex >= run.questions.length) {
      void finishRun(nextRun);
    }
  }, [
    commitActiveRun,
    finishRun,
    pauseRemainingSeconds,
    isManuallyPaused,
    showFeedback,
    submitting,
    t,
    triggerShake,
  ]);

  // ── Start run ────────────────────────────────────────────────────
  const startRun = useCallback(async () => {
    mutationEpochRef.current += 1;
    setSubmitting(true);
    try {
      const data = await apiClient.startSpeedCalculus();
      syncLoadedState(data);
      void queryClient.invalidateQueries({ queryKey: ["quests"] });
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : t("quests.speedCalculusStartError"),
      });
    } finally {
      setSubmitting(false);
    }
  }, [queryClient, syncLoadedState, t]);

  // ── Cash out ─────────────────────────────────────────────────────
  const cashOut = useCallback(async () => {
    mutationEpochRef.current += 1;
    setSubmitting(true);
    try {
      const data = await apiClient.cashoutSpeedCalculus();
      syncLoadedState(data);
      void queryClient.invalidateQueries({ queryKey: ["quests"] });
      setToast({
        type: "success",
        message: t("quests.speedCalculusCashOutSuccess", {
          reward: data.rewardPreview,
        }),
      });
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : t("quests.speedCalculusCashOutError"),
      });
    } finally {
      setSubmitting(false);
    }
  }, [queryClient, syncLoadedState, t]);

  const pauseRun = useCallback(() => {
    const run = activeRunRef.current;

    if (
      !run ||
      pauseRemainingSeconds > 0 ||
      run.isManuallyPaused ||
      submitting
    ) {
      return;
    }

    const pausedRun: ActiveSpeedRun = {
      ...run,
      isManuallyPaused: true,
      remainingSeconds: remainingSecondsRef.current,
      pauseRemainingSeconds: 0,
      pauseExpiresAt: null,
    };

    playDeadlineRef.current = null;
    pauseDeadlineRef.current = null;
    commitActiveRun(pausedRun);
    setSubmitting(true);
    mutationEpochRef.current += 1;

    apiClient
      .pauseSpeedCalculusWithAnswers({
        answers: pausedRun.answers,
        questVersion: stateRef.current?.questVersion ?? undefined,
      })
      .then((data) => {
        syncLoadedState(data);
      })
      .catch(async (error) => {
        if (await handleSpeedResetError(error)) {
          return;
        }

        setToast({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : t("quests.speedCalculusPauseError"),
        });
        void loadState();
      })
      .finally(() => {
        setSubmitting(false);
      });
  }, [
    commitActiveRun,
    handleSpeedResetError,
    loadState,
    pauseRemainingSeconds,
    submitting,
    syncLoadedState,
    t,
  ]);

  const resumeRun = useCallback(async () => {
    if (!activeRun || !isManuallyPaused || submitting) {
      return;
    }

    setSubmitting(true);
    mutationEpochRef.current += 1;

    try {
      const data = await apiClient.resumeSpeedCalculus();
      syncLoadedState(data);
    } catch (error) {
      if (await handleSpeedResetError(error)) {
        return;
      }

      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : t("quests.speedCalculusResumeError"),
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    activeRun,
    handleSpeedResetError,
    isManuallyPaused,
    submitting,
    syncLoadedState,
    t,
  ]);

  const handleAppStateChange = useEffectEvent((nextState: AppStateStatus) => {
    if (nextState === "active") {
      void loadState();
      return;
    }

    if (activeRunRef.current && !activeRunRef.current.isManuallyPaused) {
      pauseRun();
    }
  });

  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // ── Toggle run history accordion ─────────────────────────────────
  const toggleRunHistory = useCallback((runNumber: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenRuns((prev) => ({ ...prev, [runNumber]: !prev[runNumber] }));
  }, []);

  // ── Modal visibility ─────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [showRoundOver, setShowRoundOver] = useState(false);
  const displayedCorrectAnswers =
    activeRun?.correctAnswers ?? (showRoundOver ? roundOverScore : 0);

  useEffect(() => {
    if (activeRun && !activeRun.isManuallyPaused && !modalVisible) {
      setModalVisible(true);
      setShowRoundOver(false);
    }
  }, [activeRun, modalVisible]);

  const handleRoundOverDismiss = useCallback(() => {
    setShowRoundOver(false);
    setModalVisible(false);
  }, []);

  // ── Answer box colors (tristate: correct / incorrect / default) ──
  const answerBoxPalette = getAnswerBoxPalette(tc, feedback?.kind);

  // ── Loading state ────────────────────────────────────────────────
  if (loading) {
    return (
      <PageLoadingState
        title={t("quests.speedCalculusTitle")}
        message={t("common.loadingStates.pageBody")}
        icon="flash"
      />
    );
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-primaryBg">
      {/* Toast */}
      {toast && (
        <View
          className={`absolute left-4 right-4 z-[100] rounded-xl p-4 ${toast.type === "success" ? "bg-successDark" : "bg-dangerDark"}`}
          style={{
            top: insets.top + 8,
            shadowColor: withAlpha(
              toast.type === "success" ? tc.successDark : tc.dangerDark,
              "2E",
            ),
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Text
            className="font-nunito-semibold text-sm"
            style={{
              color: toast.type === "success" ? tc.successTint : tc.dangerTint,
            }}
          >
            {toast.message}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <View className="items-center gap-2">
          <Text
            className="text-[28px] font-nunito-extrabold text-primaryDark"
            style={{
              shadowColor: withAlpha(tc.primaryDark, "2E"),
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.18,
              shadowRadius: 4,
            }}
          >
            {t("quests.speedCalculusTitle")}
          </Text>
          <Text className="text-sm font-nunito text-center text-primaryDark/80 max-w-[340px]">
            {t("quests.speedCalculusSubtitle", {
              seconds: state?.runDurationSeconds ?? 30,
            })}
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="w-full rounded-xl overflow-hidden"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <View className="bg-primary py-2 items-center rounded-xl">
              <Text className="text-primaryBg font-nunito-semibold text-sm">
                {t("quests.wordle.backToQuests")}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* ── Rules Card ──────────────────────────────────────────── */}
        <View
          className="rounded-3xl border-2 border-primaryTint p-5"
          style={{
            backgroundColor: tc.surfaceMuted,
            shadowColor: withAlpha(tc.primaryDark, "24"),
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 4,
          }}
        >
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1">
              <Text className="text-xs font-nunito-bold uppercase text-primary/70 tracking-[3.5px]">
                {t("quests.speedCalculusRules")}
              </Text>
              <Text className="text-sm font-nunito mt-2 text-primaryDark/80 leading-5">
                {t("quests.speedCalculusRuleLine", {
                  seconds: state?.runDurationSeconds ?? 30,
                  reward: state?.rewardPerAnswer ?? 2,
                })}
              </Text>
            </View>
            <View
              className="rounded-2xl px-4 py-3 items-center"
              style={{ backgroundColor: tc.primaryTint }}
            >
              <Text className="text-xs font-nunito-semibold text-primaryDark/70">
                {t("quests.speedCalculusRunsLeft")}
              </Text>
              <Text className="text-2xl font-nunito-extrabold text-primaryDark">
                {Math.max(0, (state?.maxRuns ?? 0) - (state?.runsUsed ?? 0))}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Summary Card ────────────────────────────────────────── */}
        <SummaryCard
          state={state}
          activeRun={activeRun}
          submitting={submitting}
          onStartRun={() => void startRun()}
          onResumeRun={() => void resumeRun()}
          onCashOut={() => void cashOut()}
        />

        <View
          className="rounded-3xl border-2 p-5"
          style={{
            borderColor: tc.secondaryBorder,
            backgroundColor: tc.surface,
            shadowColor: withAlpha(tc.secondaryDark, "24"),
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 4,
          }}
        >
          <Text className="text-xs font-nunito-bold uppercase tracking-[3.5px] text-secondaryText/80">
            {t("quests.speedCalculusTrainingTitle")}
          </Text>
          <Text className="mt-2 text-sm font-nunito leading-5 text-primaryDark/80">
            {t("quests.speedCalculusTrainingBody")}
          </Text>
          <Pressable
            onPress={() => router.push("/quests/speed-calculus/training")}
            className="mt-4 rounded-2xl overflow-hidden"
            style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
          >
            <View
              className="items-center rounded-2xl px-5 py-4"
              style={{ backgroundColor: tc.secondary }}
            >
              <Text className="font-nunito-bold text-[15px] text-secondaryText">
                {t("quests.speedCalculusTrainingOpen")}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* ── Run History ──────────────────────────────────────────── */}
        <RunHistoryCard
          state={state}
          openRuns={openRuns}
          onToggle={toggleRunHistory}
        />
      </ScrollView>

      <ActiveRunPanel
        visible={modalVisible}
        showRoundOver={showRoundOver}
        activeRun={activeRun}
        roundOverScore={roundOverScore}
        sessionLabel={t("quests.speedCalculusRunLabel", {
          run: activeRun?.runNumber ?? roundOverRunNumber,
          total: state?.maxRuns ?? 3,
        })}
        roundOverBackLabel={t("quests.speedCalculusBackToMain")}
        pausedBackLabel={t("quests.speedCalculusBackToMain")}
        runDurationSeconds={state?.runDurationSeconds ?? 30}
        remainingSeconds={remainingSeconds}
        pauseRemainingSeconds={pauseRemainingSeconds}
        displayedCorrectAnswers={displayedCorrectAnswers}
        isManuallyPaused={isManuallyPaused}
        feedback={feedback}
        feedbackSlide={feedbackSlide}
        feedbackOpacity={feedbackOpacity}
        answer={answer}
        shakeAnim={shakeAnim}
        answerBoxBg={answerBoxPalette.background}
        answerBoxBorder={answerBoxPalette.border}
        answerBoxText={answerBoxPalette.text}
        answerPlaceholderText={answerBoxPalette.placeholder}
        submitting={submitting}
        keypadLocked={keypadLocked}
        submitDisabled={submitDisabled}
        currentQuestion={currentQuestion}
        onPause={pauseRun}
        onResume={() => void resumeRun()}
        onLeavePaused={handleRoundOverDismiss}
        onDigit={handleDigit}
        onDelete={handleDelete}
        onClear={handleClear}
        onToggleSign={handleToggleSign}
        onSubmit={() => void handleSubmit()}
        onDismiss={handleRoundOverDismiss}
      />
    </View>
  );
}
