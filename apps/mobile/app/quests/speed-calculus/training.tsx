import { useState,
  useCallback,
  useMemo,
  useRef } from "react";
import * as Haptics from "expo-haptics";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  UIManager,
  View } from "react-native";
import { Animated, LayoutAnimation } from "../../../src/lib/native-animated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import type {
  SpeedRunState,
  SpeedTrainingRun } from "@adventure-time/api-client";

import { apiClient } from "../../../src/lib/api";
import { useTranslation } from "../../../src/i18n";
import { useThemeStore } from "../../../src/stores/theme-store";
import { THEME_COLORS } from "../../../src/theme/themes";
import { ActiveRunPanel } from "../../../src/features/quests/speed-calculus/active-run-panel";
import {
  appendDigit,
  canSubmitAnswer,
  deleteDigit,
  toggleSign,
  type FeedbackType,
  type ToastType } from "../../../src/features/quests/speed-calculus/constants";
import {
  getAnswerBoxPalette,
  withAlpha } from "../../../src/features/quests/speed-calculus/palette";
import { TrainingHistoryCard } from "../../../src/features/quests/speed-calculus/training-history-card";
import { TrainingSummaryCard } from "../../../src/features/quests/speed-calculus/training-summary-card";
import { useAnimatedValue } from "../../../src/hooks/use-animated-value";
import { reactEffect, effectEvent } from "../../../src/lib/react-primitives";

const DEFAULT_RUN_DURATION_SECONDS = 30;
const E2E_RUN_DURATION_SECONDS = 120;
const DEFAULT_PAUSE_DURATION_SECONDS = 5;
const IS_E2E_BUILD = process.env.EXPO_PUBLIC_E2E_AUTH === "1";

type TrainingActiveRun = NonNullable<SpeedRunState["activeRun"]>;
type TrainingHistoryRun = SpeedRunState["history"][number];

function positiveDuration(
  value: number | null | undefined,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function trainingRunDuration(value: number | null | undefined): number {
  const duration = positiveDuration(value, DEFAULT_RUN_DURATION_SECONDS);

  return IS_E2E_BUILD ? Math.max(duration, E2E_RUN_DURATION_SECONDS) : duration;
}

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function buildTrainingActiveRun(session: SpeedTrainingRun): TrainingActiveRun {
  const startedAt = new Date();
  const runDurationSeconds = trainingRunDuration(session.runDurationSeconds);
  const pauseDurationSeconds = Math.max(
    0,
    positiveDuration(session.pauseDurationSeconds, DEFAULT_PAUSE_DURATION_SECONDS),
  );
  const pauseExpiresAt = new Date(
    startedAt.getTime() + pauseDurationSeconds * 1000,
  );

  return {
    runId: session.runId,
    runNumber: 1,
    seed: session.seed,
    questionIndex: 0,
    questions: session.questions,
    answers: [],
    correctAnswers: 0,
    remainingSeconds: runDurationSeconds,
    pauseRemainingSeconds: pauseDurationSeconds,
    isManuallyPaused: false,
    durationSeconds: runDurationSeconds,
    pauseExpiresAt: pauseExpiresAt.toISOString(),
    startedAt: startedAt.toISOString() };
}

function buildTrainingHistory(run: TrainingActiveRun): TrainingHistoryRun {
  const history = run.answers.map((userAnswer, index) => {
    const question = run.questions[index];
    const correctAnswer =
      question.operator === "+"
        ? question.left + question.right
        : question.left - question.right;
    const isCorrect = userAnswer === correctAnswer;

    return {
      index: question.index,
      left: question.left,
      right: question.right,
      operator: question.operator,
      userAnswer,
      wasAnswered: true,
      isCorrect,
      correctAnswer: isCorrect ? null : correctAnswer };
  });

  return {
    runId: run.runId,
    runNumber: 1,
    status: "completed",
    score: run.correctAnswers,
    reward: 0,
    totalAnswered: run.answers.length,
    correctAnswers: run.correctAnswers,
    history };
}

export default function SpeedCalculusTrainingScreen() {
  return useSpeedCalculusTrainingScreenView();
}

function useSpeedCalculusTrainingScreenView() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];

  const [activeRun, setActiveRun] = useState<TrainingActiveRun | null>(null);
  const [lastRun, setLastRun] = useState<TrainingHistoryRun | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answer, setAnswer] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [pauseRemainingSeconds, setPauseRemainingSeconds] = useState(0);
  const [toast, setToast] = useState<ToastType>(null);
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [roundOverScore, setRoundOverScore] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [showRoundOver, setShowRoundOver] = useState(false);
  const [runDurationSeconds, setRunDurationSeconds] = useState(
    DEFAULT_RUN_DURATION_SECONDS,
  );
  const pauseDurationSecondsRef = useRef(DEFAULT_PAUSE_DURATION_SECONDS);

  const playDeadlineRef = useRef<number | null>(null);
  const pauseDeadlineRef = useRef<number | null>(null);
  const finishRequestedRef = useRef(false);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerRef = useRef("");
  const shakeAnim = useAnimatedValue(0);
  const feedbackSlide = useAnimatedValue(-20);
  const feedbackOpacity = useAnimatedValue(0);

  const currentQuestion = useMemo(() => {
    if (!activeRun) {
      return null;
    }

    return activeRun.questions[activeRun.questionIndex] ?? null;
  }, [activeRun]);

  const isManuallyPaused = activeRun?.isManuallyPaused ?? false;
  const keypadLocked =
    !currentQuestion ||
    submitting ||
    pauseRemainingSeconds > 0 ||
    isManuallyPaused;
  const submitDisabled = keypadLocked || !canSubmitAnswer(answer);
  const displayedCorrectAnswers =
    activeRun?.correctAnswers ?? (showRoundOver ? roundOverScore : 0);

  const applyActiveRun = useCallback((next: TrainingActiveRun | null) => {
    if (!next) {
      playDeadlineRef.current = null;
      pauseDeadlineRef.current = null;
      setRemainingSeconds(0);
      setPauseRemainingSeconds(0);
      answerRef.current = "";
      setAnswer("");
      setFeedback(null);
      setActiveRun(null);
      return;
    }

    const now = Date.now();

    if (next.pauseRemainingSeconds > 0) {
      pauseDeadlineRef.current = now + next.pauseRemainingSeconds * 1000;
      playDeadlineRef.current =
        pauseDeadlineRef.current + next.remainingSeconds * 1000;
    } else {
      pauseDeadlineRef.current = null;
      playDeadlineRef.current = now + next.remainingSeconds * 1000;
    }

    setPauseRemainingSeconds(next.pauseRemainingSeconds);
    setRemainingSeconds(next.remainingSeconds);
    answerRef.current = "";
    setAnswer("");
    setActiveRun(next);
  }, []);

  const finishRun = useCallback(
    (runSnapshot?: TrainingActiveRun | null) => {
      const runToFinish = runSnapshot ?? activeRun;

      if (finishRequestedRef.current || !runToFinish) {
        return;
      }

      finishRequestedRef.current = true;
      setSubmitting(true);

      try {
        setLastRun(buildTrainingHistory(runToFinish));
        setHistoryOpen(true);
        setRoundOverScore(runToFinish.correctAnswers);
        applyActiveRun(null);
        setModalVisible(true);
        setShowRoundOver(true);
        setToast({
          type: "success",
          message: t("quests.speedCalculusTrainingFinish", {
            score: runToFinish.correctAnswers }) });
      } finally {
        finishRequestedRef.current = false;
        setSubmitting(false);
      }
    },
    [activeRun, applyActiveRun, t],
  );

  reactEffect(() => {
    if (!toast) {
      return;
    }

    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  reactEffect(() => {
    const feedbackTimeoutRefSnapshot = feedbackTimeoutRef.current;

    return () => {
      if (feedbackTimeoutRefSnapshot) {
        clearTimeout(feedbackTimeoutRefSnapshot);
      }
    };
  }, []);

  reactEffect(() => {
    if (activeRun && !activeRun.isManuallyPaused && !modalVisible) {
      setModalVisible(true);
      setShowRoundOver(false);
    }
  }, [activeRun, modalVisible]);

  const finishRunEvent = effectEvent(() => {
    finishRun();
  });

  reactEffect(() => {
    if (!activeRun) {
      return;
    }

    if (isManuallyPaused) {
      pauseDeadlineRef.current = null;
      return;
    }

    const now = Date.now();
    const nextRemainingSeconds = positiveDuration(
      activeRun.remainingSeconds,
      runDurationSeconds || DEFAULT_RUN_DURATION_SECONDS,
    );
    const nextPauseRemainingSeconds = Math.max(
      0,
      activeRun.pauseRemainingSeconds || 0,
    );

    if (!playDeadlineRef.current || playDeadlineRef.current <= now) {
      if (nextPauseRemainingSeconds > 0) {
        pauseDeadlineRef.current = now + nextPauseRemainingSeconds * 1000;
        playDeadlineRef.current =
          pauseDeadlineRef.current + nextRemainingSeconds * 1000;
      } else {
        pauseDeadlineRef.current = null;
        playDeadlineRef.current = now + nextRemainingSeconds * 1000;
      }

      setPauseRemainingSeconds(nextPauseRemainingSeconds);
      setRemainingSeconds(nextRemainingSeconds);
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const nextPause = pauseDeadlineRef.current
        ? Math.max(0, Math.ceil((pauseDeadlineRef.current - now) / 1000))
        : 0;

      if (nextPause > 0) {
        setPauseRemainingSeconds(nextPause);
        return;
      }

      if (pauseDeadlineRef.current) {
        pauseDeadlineRef.current = null;
        setPauseRemainingSeconds(0);
      }

      const nextRemaining = playDeadlineRef.current
        ? Math.max(0, Math.ceil((playDeadlineRef.current - now) / 1000))
        : 0;

      setRemainingSeconds(nextRemaining);

      if (nextRemaining === 0) {
        clearInterval(interval);
        finishRunEvent();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [activeRun, isManuallyPaused, runDurationSeconds]);

  reactEffect(() => {
    if (!activeRun || pauseRemainingSeconds > 0 || isManuallyPaused) {
      return;
    }

    if (activeRun.questionIndex >= activeRun.questions.length) {
      finishRun();
    }
  }, [activeRun, finishRun, isManuallyPaused, pauseRemainingSeconds]);

  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 7,
        duration: 68,
        useNativeDriver: true }),
      Animated.timing(shakeAnim, {
        toValue: -7,
        duration: 68,
        useNativeDriver: true }),
      Animated.timing(shakeAnim, {
        toValue: 5,
        duration: 68,
        useNativeDriver: true }),
      Animated.timing(shakeAnim, {
        toValue: -5,
        duration: 68,
        useNativeDriver: true }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 68,
        useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const showFeedback = useCallback(
    (nextFeedback: FeedbackType) => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }

      setFeedback(nextFeedback);
      feedbackSlide.setValue(-20);
      feedbackOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(feedbackSlide, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true }),
        Animated.timing(feedbackOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true }),
      ]).start();

      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedback(null);
        feedbackTimeoutRef.current = null;
      }, 1600);
    },
    [feedbackOpacity, feedbackSlide],
  );

  const startRun = useCallback(async () => {
    if (submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const session = await apiClient.startSpeedCalculusTraining();
      const nextRunDurationSeconds = trainingRunDuration(
        session.runDurationSeconds,
      );
      const nextPauseDurationSeconds = Math.max(
        0,
        positiveDuration(
          session.pauseDurationSeconds,
          DEFAULT_PAUSE_DURATION_SECONDS,
        ),
      );
      setRunDurationSeconds(nextRunDurationSeconds);
      pauseDurationSecondsRef.current = nextPauseDurationSeconds;
      setShowRoundOver(false);
      setRoundOverScore(0);
      applyActiveRun(buildTrainingActiveRun(session));
      setModalVisible(true);
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : t("quests.speedCalculusTrainingStartError") });
    } finally {
      setSubmitting(false);
    }
  }, [applyActiveRun, submitting, t]);

  const pauseRun = useCallback(() => {
    if (
      !activeRun ||
      pauseRemainingSeconds > 0 ||
      isManuallyPaused ||
      submitting
    ) {
      return;
    }

    playDeadlineRef.current = null;
    pauseDeadlineRef.current = null;
    setPauseRemainingSeconds(0);

    setActiveRun((current) =>
      current
        ? {
            ...current,
            isManuallyPaused: true,
            remainingSeconds,
            pauseRemainingSeconds: 0,
            pauseExpiresAt: null }
        : current,
    );
  }, [
    activeRun,
    isManuallyPaused,
    pauseRemainingSeconds,
    remainingSeconds,
    submitting,
  ]);

  const resumeRun = useCallback(() => {
    if (!activeRun || !isManuallyPaused || submitting) {
      return;
    }

    const now = Date.now();
    const pauseDurationSeconds = pauseDurationSecondsRef.current;
    const nextPauseDeadline = now + pauseDurationSeconds * 1000;

    pauseDeadlineRef.current = nextPauseDeadline;
    playDeadlineRef.current = nextPauseDeadline + remainingSeconds * 1000;
    setPauseRemainingSeconds(pauseDurationSeconds);

    setActiveRun((current) =>
      current
        ? {
            ...current,
            isManuallyPaused: false,
            pauseRemainingSeconds: pauseDurationSeconds,
            remainingSeconds,
            pauseExpiresAt: new Date(nextPauseDeadline).toISOString() }
        : current,
    );
  }, [
    activeRun,
    isManuallyPaused,
    remainingSeconds,
    submitting,
  ]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (keypadLocked) {
        return;
      }

      const nextAnswer = appendDigit(answerRef.current, digit);
      answerRef.current = nextAnswer;
      setAnswer(nextAnswer);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [keypadLocked],
  );

  const handleDelete = useCallback(() => {
      if (keypadLocked) {
        return;
      }

      const nextAnswer = deleteDigit(answerRef.current);
      answerRef.current = nextAnswer;
      setAnswer(nextAnswer);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [keypadLocked]);

  const handleClear = useCallback(() => {
      if (keypadLocked) {
        return;
      }

      answerRef.current = "";
      setAnswer("");
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [keypadLocked]);

  const handleToggleSign = useCallback(() => {
      if (keypadLocked) {
        return;
      }

      const nextAnswer = toggleSign(answerRef.current);
      answerRef.current = nextAnswer;
      setAnswer(nextAnswer);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [keypadLocked]);

  const handleSubmit = useCallback(() => {
    if (
      !activeRun ||
      !currentQuestion ||
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
      currentQuestion.operator === "+"
        ? currentQuestion.left + currentQuestion.right
        : currentQuestion.left - currentQuestion.right;
    const parsed = parseInt(trimmed, 10);
    const nextAnswers = [...activeRun.answers, parsed];
    const nextCorrectAnswers =
      activeRun.correctAnswers + (parsed === expectedAnswer ? 1 : 0);
    const isLastQuestion =
      activeRun.questionIndex + 1 >= activeRun.questions.length;

    if (parsed === expectedAnswer) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFeedback({
        kind: "correct",
        message: t("quests.speedCalculusCorrectFeedback") });
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFeedback({
        kind: "incorrect",
        message: t("quests.speedCalculusWrongFeedback", {
          answer: expectedAnswer }),
        questionLabel: `${currentQuestion.left} ${currentQuestion.operator} ${currentQuestion.right}`,
        correctAnswer: expectedAnswer });
      triggerShake();
    }

    answerRef.current = "";
    setAnswer("");

    if (isLastQuestion) {
      finishRun({
        ...activeRun,
        answers: nextAnswers,
        correctAnswers: nextCorrectAnswers,
        remainingSeconds,
        pauseRemainingSeconds });
      return;
    }

    setActiveRun((current) =>
      current && current.runId === activeRun.runId
        ? {
            ...current,
            answers: nextAnswers,
            questionIndex: current.questionIndex + 1,
            correctAnswers: nextCorrectAnswers,
            remainingSeconds,
            pauseRemainingSeconds }
        : current,
    );
  }, [
    activeRun,
    currentQuestion,
    finishRun,
    isManuallyPaused,
    pauseRemainingSeconds,
    remainingSeconds,
    showFeedback,
    submitting,
    t,
    triggerShake,
  ]);

  const toggleHistory = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setHistoryOpen((current) => !current);
  }, []);

  const handleRoundOverDismiss = useCallback(() => {
    setShowRoundOver(false);
    setModalVisible(false);
  }, []);

  const answerBoxPalette = getAnswerBoxPalette(tc, feedback?.kind);

  return (
    <View className="flex-1 bg-primaryBg">
      {toast ? (
        <View
          className={`absolute left-4 right-4 z-[100] rounded-xl p-4 ${toast.type === "success" ? "bg-successDark" : "bg-dangerDark"}`}
          style={{
            top: insets.top + 8,
            boxShadow: `0px 4px 8px ${withAlpha( toast.type === "success" ? tc.successDark : tc.dangerDark, "2E", )}` }}
        >
          <Text
            className="font-nunito-semibold text-sm"
            style={{
              color: toast.type === "success" ? tc.successTint : tc.dangerTint }}
          >
            {toast.message}
          </Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          gap: 16 }}
        contentInset={{ top: insets.top, bottom: insets.bottom + 16 }}
        scrollIndicatorInsets={{ top: insets.top, bottom: insets.bottom + 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center gap-2">
          <Text
            className="text-[28px] font-nunito-extrabold text-primaryDark"
            style={{
              boxShadow: `0px 1px 4px ${withAlpha(tc.successDark, "2E")}` }}
          >
            {t("quests.speedCalculusTrainingTitle")}
          </Text>
          <Text className="max-w-[340px] text-center text-sm font-nunito text-primaryDark/80">
            {t("quests.speedCalculusTrainingBody")}
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="w-full rounded-xl overflow-hidden"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <View className="items-center rounded-xl bg-primary py-2">
              <Text className="font-nunito-semibold text-sm text-primaryBg">
                {t("quests.speedCalculusBackToMain")}
              </Text>
            </View>
          </Pressable>
        </View>

        <TrainingSummaryCard
          activeRun={activeRun}
          submitting={submitting}
          lastRunScore={lastRun?.score ?? null}
          onStartRun={() => void startRun()}
          onResumeRun={resumeRun}
        />

        <TrainingHistoryCard
          lastRun={lastRun}
          isOpen={historyOpen}
          onToggle={toggleHistory}
        />
      </ScrollView>

      <ActiveRunPanel
        visible={modalVisible}
        showRoundOver={showRoundOver}
        activeRun={activeRun}
        roundOverScore={roundOverScore}
        sessionLabel={t("quests.speedCalculusTrainingSessionLabel")}
        roundOverBackLabel={t("quests.speedCalculusTrainingBack")}
        pausedBackLabel={t("quests.speedCalculusTrainingBack")}
        runDurationSeconds={runDurationSeconds}
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
        onResume={resumeRun}
        onLeavePaused={() => setModalVisible(false)}
        onDigit={handleDigit}
        onDelete={handleDelete}
        onClear={handleClear}
        onToggleSign={handleToggleSign}
        onSubmit={handleSubmit}
        onDismiss={handleRoundOverDismiss}
      />
    </View>
  );
}
