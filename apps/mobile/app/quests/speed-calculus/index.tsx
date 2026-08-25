import { useState, useRef, useMemo, useCallback } from "react";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import {
  Alert,
  AppState,
  type AppStateStatus,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import type { SpeedRunState } from "@adventure-time/api-client";

import { ApiClientError, apiClient } from "../../../src/lib/api";
import { useTranslation } from "../../../src/i18n";
import { PageLoadingState } from "../../../src/components/loading-state";
import { PageErrorState } from "../../../src/components/error-state";
import { navigateBackFromQuest } from "../../../src/features/quests/quest-navigation";
import { formatQuestShareDate } from "../../../src/features/quests/quest-share-date";
import {
  QuestScreenDescription,
  QuestScreenHeader,
} from "../../../src/features/quests/quest-screen-header";
import { useQuestResetStore } from "../../../src/stores/quest-reset-store";
import { useSessionStore } from "../../../src/stores/session-store";
import { useThemeStore } from "../../../src/stores/theme-store";
import { THEME_COLORS } from "../../../src/theme/themes";

import { ActiveRunPanel } from "../../../src/features/quests/speed-calculus/active-run-panel";
import { SpeedCalculusOffscreenShareCard } from "../../../src/features/quests/speed-calculus/offscreen-share-card";
import { RunHistoryCard } from "../../../src/features/quests/speed-calculus/run-history";
import {
  buildSpeedCalculusShareFileName,
  buildSpeedCalculusShareResult,
} from "../../../src/features/quests/speed-calculus/share-result";
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
import { reactEffect, effectEvent } from "../../../src/lib/react-primitives";

type ActiveSpeedRun = NonNullable<SpeedRunState["activeRun"]>;

export default function SpeedCalculusScreen() {
  return useSpeedCalculusScreenView();
}

function useSpeedCalculusScreenView() {
  const { locale, t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const stackMetadata = fontScale >= 1.6;
  const queryClient = useQueryClient();
  const patchUser = useSessionStore((session) => session.patchUser);
  const lastQuestResetAt = useQuestResetStore((state) => state.lastResetAt);
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];

  // ── Core state ───────────────────────────────────────────────────
  const [state, setState] = useState<SpeedRunState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answer, setAnswer] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [pauseRemainingSeconds, setPauseRemainingSeconds] = useState(0);
  const [toast, setToast] = useState<ToastType>(null);
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [openRuns, setOpenRuns] = useState<Record<number, boolean>>({});
  const [roundOverScore, setRoundOverScore] = useState(0);
  const [roundOverRunNumber, setRoundOverRunNumber] = useState(1);
  const [isSharing, setIsSharing] = useState(false);

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
  const shareCardRef = useRef<View>(null);
  const shakeAnim = useSharedValue(0);
  const feedbackSlide = useSharedValue(-20);
  const feedbackOpacity = useSharedValue(0);
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
    setLoadError(null);

    try {
      const data = await apiClient.speedCalculusState();
      const isStaleRequest = requestEpoch !== mutationEpochRef.current;
      if (isStaleRequest) {
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

      setLoadError(error);

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
    const currentState = stateRef.current;
    if (
      !currentState?.activeRun ||
      currentState.activeRun.runId !== nextRun.runId
    ) {
      return;
    }

    const nextState = { ...currentState, activeRun: nextRun };
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  reactEffect(() => {
    void loadState();
  }, [loadState]);

  const loadStateEvent = effectEvent(() => {
    void loadState();
  });

  reactEffect(() => {
    if (activeRun) {
      return;
    }

    const intervalMs = 15_000;
    const interval = setInterval(() => {
      loadStateEvent();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [activeRun]);

  reactEffect(() => {
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
  reactEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // ── Feedback cleanup ─────────────────────────────────────────────
  reactEffect(() => {
    const feedbackTimeoutRefSnapshot = feedbackTimeoutRef.current;

    return () => {
      if (feedbackTimeoutRefSnapshot) {
        clearTimeout(feedbackTimeoutRefSnapshot);
      }
    };
  }, []);

  // ── Finish run ───────────────────────────────────────────────────
  const finishRun = useCallback(
    async (runSnapshot?: ActiveSpeedRun | null) => {
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
    },
    [handleSpeedResetError, loadState, queryClient, syncLoadedState, t],
  );

  // ── Countdown timer ──────────────────────────────────────────────
  reactEffect(() => {
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
  reactEffect(() => {
    if (!activeRun || pauseRemainingSeconds > 0 || isManuallyPaused) return;
    if (activeRun.questionIndex >= activeRun.questions.length) {
      void finishRun(activeRunRef.current);
    }
  }, [activeRun, finishRun, isManuallyPaused, pauseRemainingSeconds]);

  // ── Animation helpers ────────────────────────────────────────────
  const triggerShake = useCallback(() => {
    shakeAnim.value = 0;
    shakeAnim.value = withSequence(
      withTiming(7, { duration: 68 }),
      withTiming(-7, { duration: 68 }),
      withTiming(5, { duration: 68 }),
      withTiming(-5, { duration: 68 }),
      withTiming(0, { duration: 68 }),
    );
  }, [shakeAnim]);

  const showFeedback = useCallback(
    (fb: FeedbackType) => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      setFeedback(fb);
      feedbackSlide.value = -20;
      feedbackOpacity.value = 0;
      feedbackSlide.value = withTiming(0, { duration: 300 });
      feedbackOpacity.value = withTiming(1, { duration: 300 });
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

    if (
      !run ||
      !question ||
      submitting ||
      pauseRemainingSeconds > 0 ||
      isManuallyPaused
    ) {
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
    const nextQuestionIndex = Math.min(
      nextAnswers.length,
      run.questions.length,
    );
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
      console.warn("[speed-calculus] failed to cash out", error);
      setToast({
        type: "error",
        message: t("quests.speedCalculusCashOutError"),
      });
    } finally {
      setSubmitting(false);
    }
  }, [queryClient, syncLoadedState, t]);

  const claimReward = useCallback(async () => {
    const currentState = stateRef.current;
    const questVersion = currentState?.questVersion;
    if (!questVersion || submitting) return;

    setSubmitting(true);
    try {
      const response = await apiClient.claimQuest({ questId: questVersion });
      await patchUser({ coins: response.newBalance });
      const latestState = stateRef.current;
      if (latestState) {
        const nextState = { ...latestState, claimed: true };
        stateRef.current = nextState;
        setState(nextState);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
      setToast({
        type: "success",
        message: t("quests.claimSuccess", {
          amount:
            latestState?.rewardPreview ?? currentState?.rewardPreview ?? 0,
        }),
      });
    } catch (error) {
      console.warn("[speed-calculus] failed to claim reward", error);
      setToast({
        type: "error",
        message: t("quests.claimFailed"),
      });
    } finally {
      setSubmitting(false);
    }
  }, [patchUser, queryClient, submitting, t]);

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

  const handleAppStateChange = effectEvent((nextState: AppStateStatus) => {
    if (nextState === "active") {
      void loadState();
      return;
    }

    if (activeRunRef.current && !activeRunRef.current.isManuallyPaused) {
      pauseRun();
    }
  });

  reactEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, []);

  // ── Toggle run history accordion ─────────────────────────────────
  const toggleRunHistory = useCallback((runNumber: number) => {
    setOpenRuns((prev) => ({ ...prev, [runNumber]: !prev[runNumber] }));
  }, []);

  const shareResult = useMemo(() => {
    if (!state || state.history.length === 0) return null;

    return buildSpeedCalculusShareResult({
      questTitle: t("quests.speedCalculusTitle"),
      date: state.date,
      runs: state.history,
    });
  }, [state, t]);
  const shareStrings = useMemo(() => {
    if (!shareResult) return null;

    return {
      brand: t("quests.speedCalculusShareBrand"),
      date: formatQuestShareDate(shareResult.date, locale),
      runLabel: (runNumber: number) =>
        t("quests.speedCalculusShareRun", { run: runNumber }),
      correctLabel: t("quests.speedCalculusShareCorrect"),
      errorsLabel: t("quests.speedCalculusShareErrors"),
      summary: (
        correctAnswers: number,
        totalAnswers: number,
        accuracyPercentage: number,
      ) =>
        t("quests.speedCalculusShareSummary", {
          correct: correctAnswers,
          total: totalAnswers,
          accuracy: accuracyPercentage,
        }),
      footer: t("quests.speedCalculusShareFooter"),
    };
  }, [locale, shareResult, t]);

  const shareSpeedCalculusResult = useCallback(async () => {
    if (isSharing || !shareCardRef.current || !shareResult) return;
    setIsSharing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t("quests.speedCalculusShareUnavailable"));
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
          buildSpeedCalculusShareFileName(shareResult),
        );
        if (destination.exists) destination.delete();
        await new File(uri).copy(destination);
        shareUri = destination.uri;
      } catch (copyError) {
        console.warn("Failed to rename Speed Calculus share image", copyError);
      }

      await Sharing.shareAsync(shareUri, {
        mimeType: "image/png",
        dialogTitle: t("quests.speedCalculusShareDialogTitle"),
        UTI: "public.png",
      });
    } catch (error) {
      console.warn("Failed to share Speed Calculus results", error);
      Alert.alert(t("quests.speedCalculusShareError"));
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, shareResult, t]);

  // ── Modal visibility ─────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [showRoundOver, setShowRoundOver] = useState(false);
  const displayedCorrectAnswers =
    activeRun?.correctAnswers ?? (showRoundOver ? roundOverScore : 0);

  reactEffect(() => {
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

  if (loadError && !state) {
    return (
      <PageErrorState
        error={loadError}
        title={t("quests.speedCalculusLoadError")}
        onRetry={() => {
          setLoading(true);
          void loadState();
        }}
        onBack={() => navigateBackFromQuest(router, "/(tabs)/quests")}
        backLabel={t("quests.wordle.backToQuests")}
      />
    );
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-primaryBg">
      {/* Toast */}
      {toast && (
        <View
          accessible
          accessibilityLabel={toast.message}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          className={`absolute left-4 right-4 z-[100] rounded-xl p-4 ${toast.type === "success" ? "bg-successDark" : "bg-dangerDark"}`}
          style={{
            top: insets.top + 8,
            boxShadow: `0px 4px 8px ${withAlpha(toast.type === "success" ? tc.successDark : tc.dangerDark, "2E")}`,
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

      <View className="bg-bg px-4 pb-2" style={{ paddingTop: insets.top + 12 }}>
        <QuestScreenHeader
          title={t("quests.speedCalculusTitle")}
          backLabel={t("quests.wordle.backToQuests")}
          backTestID="speed-calculus-back"
          fallbackHref="/(tabs)/quests"
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          gap: 16,
        }}
        contentInset={{ bottom: insets.bottom + 16 }}
        scrollIndicatorInsets={{ bottom: insets.bottom + 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <QuestScreenDescription>
          {t("quests.speedCalculusSubtitle", {
            seconds: state?.runDurationSeconds ?? 30,
          })}
        </QuestScreenDescription>

        {/* ── Rules Card ──────────────────────────────────────────── */}
        <View
          className="rounded-3xl border-2 border-primaryTint p-5"
          style={{
            backgroundColor: tc.surfaceMuted,
            boxShadow: `0px 4px 12px ${withAlpha(tc.primaryDark, "24")}`,
          }}
        >
          <View
            className={
              stackMetadata
                ? "items-stretch gap-4"
                : "flex-row items-center justify-between gap-4"
            }
          >
            <View className="min-w-0 flex-1">
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
              className={`${stackMetadata ? "items-start self-stretch" : "items-center"} rounded-2xl px-4 py-3`}
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
          claiming={submitting && Boolean(state?.locked && !state.claimed)}
          onStartRun={() => void startRun()}
          onResumeRun={() => void resumeRun()}
          onCashOut={() => void cashOut()}
          onClaim={() => void claimReward()}
          onShare={() => void shareSpeedCalculusResult()}
          sharing={isSharing}
        />

        <View
          className="rounded-3xl border-2 p-5"
          style={{
            borderColor: tc.secondaryBorder,
            backgroundColor: tc.surface,
            boxShadow: `0px 4px 12px ${withAlpha(tc.secondaryDark, "24")}`,
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

      {shareResult && shareStrings ? (
        <SpeedCalculusOffscreenShareCard
          cardRef={shareCardRef}
          colors={tc}
          result={shareResult}
          strings={shareStrings}
        />
      ) : null}
    </View>
  );
}
