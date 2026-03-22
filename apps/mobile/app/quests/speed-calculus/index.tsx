import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as Haptics from "expo-haptics";
import { Animated, LayoutAnimation, Platform, Pressable, ScrollView, Text, UIManager, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import type { SpeedRunState } from "@adventure-time/shared";

import { apiClient } from "../../../src/lib/api";
import { useTranslation } from "../../../src/i18n";

import { ActiveRunPanel } from "../../../src/features/quests/speed-calculus/active-run-panel";
import { RunHistoryCard } from "../../../src/features/quests/speed-calculus/run-history";
import { SummaryCard } from "../../../src/features/quests/speed-calculus/summary-card";
import {
  appendDigit, deleteDigit, toggleSign, canSubmitAnswer,
  type ToastType, type FeedbackType,
} from "../../../src/features/quests/speed-calculus/constants";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SpeedCalculusScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

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
  const pauseStartedRef = useRef<number | null>(null);
  const finishRequestedRef = useRef(false);
  const resumedOnMountRef = useRef(false);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerRef = useRef("");
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const feedbackSlide = useRef(new Animated.Value(-20)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  // ── Derived ──────────────────────────────────────────────────────
  const activeRun = state?.activeRun ?? null;
  const currentQuestion = useMemo(() => {
    if (!activeRun) return null;
    return activeRun.questions[activeRun.questionIndex] ?? null;
  }, [activeRun]);
  const keypadLocked = !currentQuestion || submitting || pauseRemainingSeconds > 0;
  const submitDisabled = keypadLocked || !canSubmitAnswer(answer);

  // ── Apply state from API ─────────────────────────────────────────
  const applyState = useCallback((next: SpeedRunState) => {
    setState(next);
    if (!next.activeRun) {
      playDeadlineRef.current = null;
      pauseDeadlineRef.current = null;
      setRemainingSeconds(0);
      setPauseRemainingSeconds(0);
      answerRef.current = "";
      setAnswer("");
      setFeedback(null);
      return;
    }
    const pauseDeadline = next.activeRun.pauseExpiresAt
      ? new Date(next.activeRun.pauseExpiresAt).getTime()
      : null;
    const playDeadline = new Date(next.activeRun.startedAt).getTime() + (next.activeRun.durationSeconds * 1000);

    pauseDeadlineRef.current = pauseDeadline;
    pauseStartedRef.current = pauseDeadline ? Date.now() : null;
    playDeadlineRef.current = playDeadline;

    const now = Date.now();
    setPauseRemainingSeconds(pauseDeadline ? Math.max(0, Math.ceil((pauseDeadline - now) / 1000)) : 0);
    setRemainingSeconds(Math.max(0, Math.ceil((playDeadline - now) / 1000)));
    answerRef.current = "";
    setAnswer("");
  }, []);

  // ── Load state ───────────────────────────────────────────────────
  const loadState = useCallback(async (resumeActive: boolean) => {
    try {
      let data = await apiClient.speedCalculusState();
      if (resumeActive && data.activeRun && !resumedOnMountRef.current) {
        resumedOnMountRef.current = true;
        data = await apiClient.resumeSpeedCalculus();
      }
      applyState(data);
    } catch (error) {
      setToast({ type: "error", message: t("quests.speedCalculusLoadError") });
    } finally {
      setLoading(false);
    }
  }, [applyState, t]);

  useEffect(() => { void loadState(true); }, [loadState]);

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
  const finishRun = useCallback(async () => {
    if (finishRequestedRef.current || !state?.activeRun) return;
    finishRequestedRef.current = true;
    const finishingRunNumber = state.activeRun.runNumber;
    setSubmitting(true);
    try {
      const result = await apiClient.finishSpeedCalculus(state.activeRun.runId);
      setRoundOverRunNumber(finishingRunNumber);
      setRoundOverScore(result.correctAnswers ?? 0);
      applyState(result); // clears activeRun before showing overlay
      setShowRoundOver(true); // safe to show now: activeRun is null, modal won't re-open
      setToast({
        type: "success",
        message: result.locked
          ? t("quests.speedCalculusRunLocked", { score: result.correctAnswers ?? 0, reward: result.reward ?? 0 })
          : t("quests.speedCalculusRunFinished", { score: result.correctAnswers ?? 0, reward: result.reward ?? 0 }),
      });
    } catch {
      setShowRoundOver(false);
      setModalVisible(false);
      setToast({ type: "error", message: t("quests.speedCalculusFinishError") });
      await loadState(false);
    } finally {
      finishRequestedRef.current = false;
      setSubmitting(false);
    }
  }, [applyState, loadState, state?.activeRun, t]);

  // ── Countdown timer ──────────────────────────────────────────────
  useEffect(() => {
    if (!state?.activeRun) return;
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
        const pauseDuration = pauseStartedRef.current !== null ? now - pauseStartedRef.current : 0;
        if (playDeadlineRef.current) {
          playDeadlineRef.current += pauseDuration;
        }
        pauseStartedRef.current = null;
        pauseDeadlineRef.current = null;
        setPauseRemainingSeconds(0);
      }
      const nextRemaining = playDeadlineRef.current
        ? Math.max(0, Math.ceil((playDeadlineRef.current - now) / 1000))
        : 0;
      setRemainingSeconds(nextRemaining);
      if (nextRemaining === 0) {
        clearInterval(interval);
        void finishRun();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [finishRun, state?.activeRun]);

  // ── Auto-finish when all questions answered ──────────────────────
  useEffect(() => {
    if (!activeRun || pauseRemainingSeconds > 0) return;
    if (activeRun.questionIndex >= activeRun.questions.length) {
      void finishRun();
    }
  }, [activeRun, finishRun, pauseRemainingSeconds]);

  // ── Animation helpers ────────────────────────────────────────────
  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 7, duration: 68, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7, duration: 68, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 68, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 68, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 68, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const showFeedback = useCallback((fb: FeedbackType) => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setFeedback(fb);
    feedbackSlide.setValue(-20);
    feedbackOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(feedbackSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(feedbackOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimeoutRef.current = null;
    }, 1600);
  }, [feedbackSlide, feedbackOpacity]);

  // ── Keypad handlers ──────────────────────────────────────────────
  const handleDigit = useCallback((digit: string) => {
    if (keypadLocked) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = appendDigit(answerRef.current, digit);
    answerRef.current = next;
    setAnswer(next);
  }, [keypadLocked]);

  const handleDelete = useCallback(() => {
    if (keypadLocked) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = deleteDigit(answerRef.current);
    answerRef.current = next;
    setAnswer(next);
  }, [keypadLocked]);

  const handleClear = useCallback(() => {
    if (keypadLocked) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    answerRef.current = "";
    setAnswer("");
  }, [keypadLocked]);

  const handleToggleSign = useCallback(() => {
    if (keypadLocked) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = toggleSign(answerRef.current);
    answerRef.current = next;
    setAnswer(next);
  }, [keypadLocked]);

  // ── Submit answer ────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!currentQuestion || submitting || pauseRemainingSeconds > 0) return;
    const trimmed = answerRef.current.trim();
    if (!canSubmitAnswer(trimmed)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      triggerShake();
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);

    const expectedAnswer = currentQuestion.operator === "+"
      ? currentQuestion.left + currentQuestion.right
      : currentQuestion.left - currentQuestion.right;
    const parsed = parseInt(trimmed, 10);
    const runId = activeRun?.runId;
    if (!runId) return;

    // Show feedback immediately — correctness is known locally
    if (parsed === expectedAnswer) {
      showFeedback({ kind: "correct", message: t("quests.speedCalculusCorrectFeedback") });
    } else {
      showFeedback({
        kind: "incorrect",
        message: t("quests.speedCalculusWrongFeedback", { answer: expectedAnswer }),
        questionLabel: `${currentQuestion.left} ${currentQuestion.operator} ${currentQuestion.right}`,
        correctAnswer: expectedAnswer,
      });
      triggerShake();
    }

    // Clear answer immediately
    answerRef.current = "";
    setAnswer("");

    // Optimistically advance to next question. Skip on the last question to avoid
    // triggering the auto-finish effect before the answer is recorded server-side.
    const isLastQuestion = activeRun != null &&
      activeRun.questionIndex + 1 >= activeRun.questions.length;
    if (!isLastQuestion) {
      setState((prev) =>
        prev?.activeRun
          ? { ...prev, activeRun: { ...prev.activeRun, questionIndex: prev.activeRun.questionIndex + 1 } }
          : prev
      );
    }

    try {
      const data = await apiClient.answerSpeedCalculus(runId, parsed);
      applyState(data);
      if (data.activeRun && data.activeRun.questionIndex >= data.activeRun.questions.length) {
        await finishRun();
      }
    } catch {
      setToast({ type: "error", message: t("quests.speedCalculusFinishError") });
      await loadState(false);
    } finally {
      setSubmitting(false);
    }
  }, [activeRun, applyState, currentQuestion, finishRun, loadState, pauseRemainingSeconds, showFeedback, submitting, t, triggerShake]);

  // ── Start run ────────────────────────────────────────────────────
  const startRun = useCallback(async () => {
    setSubmitting(true);
    try {
      const data = await apiClient.startSpeedCalculus();
      resumedOnMountRef.current = true;
      applyState(data);
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : t("quests.speedCalculusStartError"),
      });
    } finally {
      setSubmitting(false);
    }
  }, [applyState, t]);

  // ── Cash out ─────────────────────────────────────────────────────
  const cashOut = useCallback(async () => {
    setSubmitting(true);
    try {
      const data = await apiClient.cashoutSpeedCalculus();
      applyState(data);
      setToast({
        type: "success",
        message: t("quests.speedCalculusCashOutSuccess", { reward: data.rewardPreview }),
      });
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : t("quests.speedCalculusCashOutError"),
      });
    } finally {
      setSubmitting(false);
    }
  }, [applyState, t]);

  // ── Toggle run history accordion ─────────────────────────────────
  const toggleRunHistory = useCallback((runNumber: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenRuns((prev) => ({ ...prev, [runNumber]: !prev[runNumber] }));
  }, []);

  // ── Modal visibility ─────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [showRoundOver, setShowRoundOver] = useState(false);

  useEffect(() => {
    if (activeRun && !modalVisible) {
      setModalVisible(true);
      setShowRoundOver(false);
    }
  }, [activeRun, modalVisible]);

  const handleRoundOverDismiss = useCallback(() => {
    setShowRoundOver(false);
    setModalVisible(false);
  }, []);

  // ── Answer box colors (tristate: correct / incorrect / default) ──
  const answerBoxBg = feedback?.kind === "correct" ? "#CCFBF1" : feedback?.kind === "incorrect" ? "#FFE4E6" : "#FFFFFF";
  const answerBoxBorder = feedback?.kind === "correct" ? "rgba(20,184,166,0.3)" : feedback?.kind === "incorrect" ? "#FECDD3" : "#FCE7F3";
  const answerBoxText = feedback?.kind === "correct" ? "#005F5A" : feedback?.kind === "incorrect" ? "#A50036" : "#EC4899";

  // ── Loading state ────────────────────────────────────────────────
  if (loading) {
    return (
      <View className="flex-1 bg-primaryBg items-center justify-center">
        <Text className="text-primaryDark font-nunito-semibold">
          {t("quests.speedCalculusTitle")}...
        </Text>
      </View>
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
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Text className="text-white font-nunito-semibold text-sm">
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
              shadowColor: "#EC4899",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.18,
              shadowRadius: 4,
            }}
          >
            {t("quests.speedCalculusTitle")}
          </Text>
          <Text className="text-sm font-nunito text-center text-primaryDark/80 max-w-[340px]">
            {t("quests.speedCalculusSubtitle", { seconds: state?.runDurationSeconds ?? 30 })}
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="w-full rounded-xl overflow-hidden"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <View className="bg-primary py-2 items-center rounded-xl">
              <Text className="text-primaryBg font-nunito-semibold text-sm">
                {t("native.wordle.backToQuests")}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* ── Rules Card ──────────────────────────────────────────── */}
        <View
          className="rounded-3xl border-2 border-primaryTint p-5 bg-white/85"
          style={{
            shadowColor: "#000",
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
                {t("quests.speedCalculusRuleLine", { seconds: state?.runDurationSeconds ?? 30, reward: state?.rewardPerAnswer ?? 4 })}
              </Text>
            </View>
            <View className="rounded-2xl bg-primaryTint px-4 py-3 items-center">
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
          onCashOut={() => void cashOut()}
        />


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
        roundOverRunNumber={roundOverRunNumber}
        state={state!}
        remainingSeconds={remainingSeconds}
        pauseRemainingSeconds={pauseRemainingSeconds}
        feedback={feedback}
        feedbackSlide={feedbackSlide}
        feedbackOpacity={feedbackOpacity}
        answer={answer}
        shakeAnim={shakeAnim}
        answerBoxBg={answerBoxBg}
        answerBoxBorder={answerBoxBorder}
        answerBoxText={answerBoxText}
        submitting={submitting}
        keypadLocked={keypadLocked}
        submitDisabled={submitDisabled}
        currentQuestion={currentQuestion}
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
