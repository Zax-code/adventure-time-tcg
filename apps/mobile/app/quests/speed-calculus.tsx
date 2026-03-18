import { useState, useEffect, useRef, useMemo } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import { apiClient } from "../../src/lib/api";
import { useTranslation } from "../../src/i18n";
import { CoinIcon, SparklesIcon } from "../../src/components/icons";

const RUN_DURATION_SECONDS = 30;

const C = {
  primary: "#F472B6",
  primaryDark: "#EC4899",
  primaryTint: "#FCE7F3",
  primaryBg: "#FDF2F8",
  primaryText: "#DB2777",
  secondary: "#FDE047",
  secondaryDark: "#EAB308",
  success: "#2DD4BF",
  successDark: "#14B8A6",
  successTint: "#CCFBF1",
  successBorder: "#96F7E4",
  successText: "#0F766E",
  danger: "#FB7185",
  dangerDark: "#F43F5E",
  dangerTint: "#FFE4E6",
  dangerBorder: "#FECDD3",
  dangerText: "#BE123C",
  screenBg: "#fff0f5",
  white: "#FFFFFF",
  fg: "#4a3728",
};

const DIGIT_ROWS = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]];

export default function SpeedCalculusScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [pauseRemainingSeconds, setPauseRemainingSeconds] = useState(0);
  const [openRunIds, setOpenRunIds] = useState(new Set<string>());

  const shakeAnswerAnim = useRef(new Animated.Value(0)).current;
  const feedbackSlide = useRef(new Animated.Value(-20)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;

  const stateQuery = useQuery({
    queryKey: ["speed-calculus"],
    queryFn: () => apiClient.speedCalculusState(),
    refetchInterval: 5_000,
  });

  const startMutation = useMutation({
    mutationFn: () => apiClient.startSpeedCalculus(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["speed-calculus"] }),
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
      ]);
    },
  });

  const finishMutation = useMutation({
    mutationFn: () => {
      const runId = stateQuery.data?.activeRun?.runId;
      if (!runId) throw new Error("No active run");
      return apiClient.finishSpeedCalculus(runId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["speed-calculus"] }),
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
      ]);
    },
  });

  const currentQuestion = useMemo(() => {
    const run = stateQuery.data?.activeRun;
    if (!run) return null;
    return run.questions[run.questionIndex] ?? null;
  }, [stateQuery.data?.activeRun]);

  const keypadLocked = !currentQuestion || submitting || pauseRemainingSeconds > 0;

  // Keep ref current so timer closure always reads latest activeRun
  const activeRunRef = useRef(stateQuery.data?.activeRun ?? null);
  activeRunRef.current = stateQuery.data?.activeRun ?? null;

  useEffect(() => {
    if (!stateQuery.data?.activeRun) {
      setRemainingSeconds(null);
      setPauseRemainingSeconds(0);
      return;
    }
    const tick = () => {
      const run = activeRunRef.current;
      if (!run) return;
      const elapsed = Math.floor((Date.now() - Date.parse(run.startedAt)) / 1000);
      setRemainingSeconds(Math.max(0, RUN_DURATION_SECONDS - elapsed));
      if (run.pauseExpiresAt) {
        setPauseRemainingSeconds(
          Math.max(0, Math.ceil((Date.parse(run.pauseExpiresAt) - Date.now()) / 1000)),
        );
      } else {
        setPauseRemainingSeconds(0);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateQuery.data?.activeRun?.runId]);

  const triggerShake = () => {
    shakeAnswerAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnswerAnim, { toValue: 7, duration: 68, useNativeDriver: true }),
      Animated.timing(shakeAnswerAnim, { toValue: -7, duration: 68, useNativeDriver: true }),
      Animated.timing(shakeAnswerAnim, { toValue: 5, duration: 68, useNativeDriver: true }),
      Animated.timing(shakeAnswerAnim, { toValue: -5, duration: 68, useNativeDriver: true }),
      Animated.timing(shakeAnswerAnim, { toValue: 0, duration: 68, useNativeDriver: true }),
    ]).start();
  };

  const showFeedback = (type: "correct" | "incorrect", msg: string) => {
    setFeedback(type);
    setFeedbackMsg(msg);
    feedbackSlide.setValue(-20);
    feedbackOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(feedbackSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(feedbackOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setFeedback(null), 1600);
  };

  const handleDigit = (digit: string) => {
    if (keypadLocked) return;
    setAnswer((prev) => prev + digit);
  };

  const handleDelete = () => {
    if (keypadLocked || answer === "") return;
    setAnswer((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (keypadLocked) return;
    setAnswer("");
  };

  const handleToggleSign = () => {
    if (keypadLocked) return;
    setAnswer((prev) => {
      if (prev.startsWith("-")) return prev.slice(1);
      return "-" + prev;
    });
  };

  const handleSubmit = async () => {
    if (keypadLocked || answer === "" || answer === "-") return;
    const runId = stateQuery.data?.activeRun?.runId;
    if (!runId) return;
    const numAnswer = parseInt(answer, 10);
    if (isNaN(numAnswer)) return;

    setSubmitting(true);
    try {
      const result = await apiClient.answerSpeedCalculus(runId, numAnswer);
      setAnswer("");
      if (result.ok) {
        showFeedback("correct", t("quests.speedCalculusCorrectFeedback"));
      } else {
        triggerShake();
        const q = currentQuestion;
        const correctAnswer = q
          ? q.operator === "+" ? q.left + q.right : q.left - q.right
          : "?";
        showFeedback(
          "incorrect",
          t("quests.speedCalculusWrongFeedback", { answer: String(correctAnswer) }),
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["speed-calculus"] }),
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
      ]);
    } catch {
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRun = (runId: string) => {
    setOpenRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  if (stateQuery.isLoading && !stateQuery.data) {
    return (
      <View style={{ flex: 1, backgroundColor: C.screenBg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: C.primaryDark, fontFamily: "Nunito_600SemiBold" }}>
          {t("quests.speedCalculusTitle")}…
        </Text>
      </View>
    );
  }

  if (stateQuery.isError || !stateQuery.data) {
    return (
      <View style={{ flex: 1, backgroundColor: C.screenBg, padding: 24 }}>
        <Text style={{ color: C.dangerDark, fontFamily: "Nunito_400Regular" }}>
          {stateQuery.error instanceof Error
            ? stateQuery.error.message
            : t("quests.speedCalculusLoadError")}
        </Text>
      </View>
    );
  }

  const { runsUsed, maxRuns, latestScore, rewardPreview, activeRun, locked, history } =
    stateQuery.data;

  const answerBoxBg =
    feedback === "correct"
      ? C.successTint
      : feedback === "incorrect"
        ? C.dangerTint
        : C.white;
  const answerBoxBorder =
    feedback === "correct"
      ? C.successBorder
      : feedback === "incorrect"
        ? C.dangerBorder
        : C.primaryTint;
  const answerBoxText =
    feedback === "correct"
      ? C.successText
      : feedback === "incorrect"
        ? C.dangerText
        : answer
          ? C.primaryDark
          : C.primaryTint;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.screenBg }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 32,
        gap: 16,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={{ alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Text
          style={{
            fontSize: 30,
            fontFamily: "Nunito_800ExtraBold",
            color: C.primaryDark,
            shadowColor: C.primaryDark,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.18,
            shadowRadius: 4,
          }}
        >
          {t("quests.speedCalculusTitle")}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: "rgba(236,72,153,0.8)",
            fontFamily: "Nunito_400Regular",
          }}
        >
          {t("quests.speedCalculusRunsLeft")}: {runsUsed}/{maxRuns}
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }: { pressed: boolean }) => ({
            width: "100%",
            borderRadius: 12,
            overflow: "hidden",
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <View style={{ backgroundColor: C.primary, paddingVertical: 8, alignItems: "center" }}>
            <Text style={{ color: C.white, fontFamily: "Nunito_600SemiBold", fontSize: 14 }}>
              {t("native.wordle.backToQuests")}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* ── Rules Card ─────────────────────────────────────────────────────── */}
      <View
        style={{
          borderRadius: 24,
          borderWidth: 2,
          borderColor: C.primaryTint,
          backgroundColor: "rgba(255,255,255,0.85)",
          padding: 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 4,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Nunito_700Bold",
                color: C.primaryText,
                textTransform: "uppercase",
                letterSpacing: 4,
                marginBottom: 6,
              }}
            >
              {t("quests.speedCalculusRules")}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Nunito_400Regular", color: C.fg, lineHeight: 20 }}>
              {t("quests.speedCalculusRuleLine")}
            </Text>
          </View>
          <View
            style={{
              borderRadius: 16,
              backgroundColor: C.primaryTint,
              paddingHorizontal: 16,
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 11, fontFamily: "Nunito_600SemiBold", color: C.primaryText, marginBottom: 2 }}>
              {t("quests.speedCalculusRunsLeft")}
            </Text>
            <Text style={{ fontSize: 24, fontFamily: "Nunito_800ExtraBold", color: C.primaryDark }}>
              {Math.max(0, maxRuns - runsUsed)}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Summary Card ───────────────────────────────────────────────────── */}
      <View
        style={{
          borderRadius: 24,
          borderWidth: 2,
          borderColor: "rgba(253,224,71,0.3)",
          backgroundColor: "rgba(255,255,255,0.9)",
          padding: 16,
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 11, fontFamily: "Nunito_600SemiBold", color: C.primaryText }}>
              {t("quests.speedCalculusLatestReward")}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 24, fontFamily: "Nunito_800ExtraBold", color: C.primaryDark }}>
                {rewardPreview}
              </Text>
              <CoinIcon size={22} />
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Text style={{ fontSize: 11, fontFamily: "Nunito_600SemiBold", color: C.primaryText }}>
              {t("quests.speedCalculusLatestScore")}
            </Text>
            <Text style={{ fontSize: 24, fontFamily: "Nunito_800ExtraBold", color: C.primaryDark }}>
              {latestScore}
            </Text>
          </View>
        </View>

        {locked ? (
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: C.successBorder,
              backgroundColor: C.successTint,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontFamily: "Nunito_700Bold", color: C.successText, fontSize: 14 }}>
              {t("quests.speedCalculusLocked")}
            </Text>
          </View>
        ) : activeRun ? (
          <Pressable
            onPress={() => void finishMutation.mutateAsync()}
            disabled={finishMutation.isPending}
            style={({ pressed }: { pressed: boolean }) => ({ borderRadius: 16, overflow: "hidden", opacity: pressed || finishMutation.isPending ? 0.75 : 1, height: 48 })}
          >
            <LinearGradient
              colors={[C.success, C.successDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontFamily: "Nunito_700Bold", color: C.white, fontSize: 15 }}>
                {finishMutation.isPending
                  ? "…"
                  : t("quests.speedCalculusCashOut", { reward: rewardPreview })}
              </Text>
            </LinearGradient>
          </Pressable>
        ) : runsUsed < maxRuns ? (
          <Pressable
            onPress={() => void startMutation.mutateAsync()}
            disabled={startMutation.isPending}
            style={({ pressed }: { pressed: boolean }) => ({ borderRadius: 16, overflow: "hidden", opacity: pressed || startMutation.isPending ? 0.75 : 1, height: 48 })}
          >
            <LinearGradient
              colors={[C.primary, C.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontFamily: "Nunito_700Bold", color: C.white, fontSize: 15 }}>
                {startMutation.isPending
                  ? "…"
                  : t("quests.speedCalculusStartRun", { run: runsUsed + 1 })}
              </Text>
            </LinearGradient>
          </Pressable>
        ) : null}
      </View>

      {/* ── Active Run Panel ───────────────────────────────────────────────── */}
      {activeRun && (
        <View
          style={{
            borderRadius: 24,
            borderWidth: 2,
            borderColor: C.primaryTint,
            backgroundColor: C.white,
            padding: 20,
            gap: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          {/* Header row: timer + score */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ gap: 1 }}>
              <Text style={{ fontSize: 11, fontFamily: "Nunito_600SemiBold", color: C.primaryText }}>
                {t("quests.speedCalculusRunLabel", { run: activeRun.runNumber, total: maxRuns })}
              </Text>
              <Text
                style={{
                  fontSize: 28,
                  fontFamily: "Nunito_800ExtraBold",
                  color:
                    remainingSeconds !== null && remainingSeconds <= 5
                      ? C.dangerDark
                      : C.primaryDark,
                }}
              >
                {remainingSeconds !== null ? remainingSeconds : "–"}s
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 1 }}>
              <Text style={{ fontSize: 11, fontFamily: "Nunito_600SemiBold", color: C.primaryText }}>
                {t("quests.speedCalculusCorrectNow")}
              </Text>
              <Text style={{ fontSize: 28, fontFamily: "Nunito_800ExtraBold", color: C.primaryDark }}>
                {activeRun.answers.length}
              </Text>
            </View>
          </View>

          {/* Question area */}
          <View
            style={{
              borderRadius: 24,
              backgroundColor: "rgba(253,242,248,0.7)",
              padding: 24,
              alignItems: "center",
              gap: 8,
              position: "relative",
            }}
          >
            {/* Feedback banner */}
            {feedback && (
              <Animated.View
                style={{
                  position: "absolute",
                  top: -16,
                  left: 16,
                  right: 16,
                  borderRadius: 12,
                  backgroundColor:
                    feedback === "correct" ? C.successTint : C.dangerTint,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  alignItems: "center",
                  zIndex: 10,
                  transform: [{ translateY: feedbackSlide }],
                  opacity: feedbackOpacity,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Nunito_700Bold",
                    fontSize: 13,
                    color: feedback === "correct" ? C.successText : C.dangerText,
                  }}
                >
                  {feedbackMsg}
                </Text>
              </Animated.View>
            )}

            {pauseRemainingSeconds > 0 ? (
              <>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: "Nunito_700Bold",
                    color: C.primaryText,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  {t("quests.speedCalculusResumeCountdownTitle")}
                </Text>
                <Text style={{ fontSize: 48, fontFamily: "Nunito_800ExtraBold", color: C.primaryDark }}>
                  {pauseRemainingSeconds}
                </Text>
                <Text style={{ fontSize: 13, fontFamily: "Nunito_400Regular", color: C.fg }}>
                  {t("quests.speedCalculusResumeCountdownBody")}
                </Text>
              </>
            ) : currentQuestion ? (
              <>
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: "Nunito_700Bold",
                    color: C.primaryText,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  {t("quests.speedCalculusQuestionNumber", {
                    current: activeRun.questionIndex + 1,
                  })}
                </Text>
                <Text style={{ fontSize: 48, fontFamily: "Nunito_800ExtraBold", color: C.fg }}>
                  {currentQuestion.left} {currentQuestion.operator} {currentQuestion.right}
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: 15, fontFamily: "Nunito_600SemiBold", color: C.primaryText }}>
                {t("quests.speedCalculusRunFinished")}
              </Text>
            )}
          </View>

          {/* Answer display */}
          <Animated.View
            style={{
              borderRadius: 24,
              borderWidth: 2,
              borderColor: answerBoxBorder,
              backgroundColor: answerBoxBg,
              paddingHorizontal: 20,
              paddingVertical: 16,
              alignItems: "center",
              transform: [{ translateX: shakeAnswerAnim }],
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontFamily: "Nunito_700Bold",
                textTransform: "uppercase",
                letterSpacing: 3,
                color: answerBoxText,
                opacity: 0.7,
                marginBottom: 2,
              }}
            >
              {t("quests.speedCalculusAnswerPlaceholder")}
            </Text>
            <Text
              style={{
                fontSize: 36,
                fontFamily: "Nunito_800ExtraBold",
                color: answerBoxText,
                minHeight: 44,
                opacity: answer ? 1 : 0.35,
              }}
            >
              {answer || "—"}
            </Text>
          </Animated.View>

          {/* Keypad */}
          <View
            style={{
              borderRadius: 24,
              borderWidth: 2,
              borderColor: C.primaryTint,
              backgroundColor: "rgba(255,255,255,0.9)",
              padding: 12,
              gap: 8,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            {DIGIT_ROWS.map((row) => (
              <View key={row.join("")} style={{ flexDirection: "row", gap: 8 }}>
                {row.map((digit) => (
                  <Pressable
                    key={digit}
                    onPress={() => handleDigit(digit)}
                    disabled={keypadLocked}
                    style={({ pressed }: { pressed: boolean }) => ({
                      flex: 1,
                      height: 56,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: C.primaryTint,
                      backgroundColor: C.primaryBg,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: keypadLocked ? 0.4 : pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 22, fontFamily: "Nunito_800ExtraBold", color: C.fg }}>
                      {digit}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}

            {/* Bottom digit row: ±, 0, ⌫ */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={handleToggleSign}
                disabled={keypadLocked}
                style={({ pressed }: { pressed: boolean }) => ({
                  flex: 1,
                  height: 56,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: C.primaryTint,
                  backgroundColor: C.primaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: keypadLocked ? 0.4 : pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 22, fontFamily: "Nunito_800ExtraBold", color: C.fg }}>
                  {t("quests.speedCalculusToggleNegative")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleDigit("0")}
                disabled={keypadLocked}
                style={({ pressed }: { pressed: boolean }) => ({
                  flex: 1,
                  height: 56,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: C.primaryTint,
                  backgroundColor: C.primaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: keypadLocked ? 0.4 : pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 22, fontFamily: "Nunito_800ExtraBold", color: C.fg }}>0</Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                disabled={keypadLocked || answer === ""}
                style={({ pressed }: { pressed: boolean }) => ({
                  flex: 1,
                  height: 56,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: C.primaryTint,
                  backgroundColor: C.primaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: keypadLocked || answer === "" ? 0.4 : pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 22, fontFamily: "Nunito_800ExtraBold", color: C.fg }}>
                  {t("quests.speedCalculusDelete")}
                </Text>
              </Pressable>
            </View>

            {/* Action row: Clear + Submit */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <Pressable
                onPress={handleClear}
                disabled={keypadLocked}
                style={({ pressed }: { pressed: boolean }) => ({
                  flex: 1,
                  height: 48,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: C.primaryTint,
                  backgroundColor: C.white,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: keypadLocked ? 0.4 : pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 13, fontFamily: "Nunito_800ExtraBold", color: C.primaryDark }}>
                  {t("quests.speedCalculusClear")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void handleSubmit()}
                disabled={keypadLocked || answer === "" || answer === "-"}
                style={({ pressed }: { pressed: boolean }) => ({
                  flex: 2,
                  height: 48,
                  borderRadius: 16,
                  overflow: "hidden",
                  opacity:
                    keypadLocked || answer === "" || answer === "-"
                      ? 0.4
                      : pressed
                        ? 0.8
                        : 1,
                })}
              >
                <LinearGradient
                  colors={[C.secondary, C.secondaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 14, fontFamily: "Nunito_800ExtraBold", color: C.white }}>
                    {submitting ? "…" : t("quests.speedCalculusSubmit")}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* ── Run History ────────────────────────────────────────────────────── */}
      <View
        style={{
          borderRadius: 24,
          borderWidth: 2,
          borderColor: C.primaryTint,
          backgroundColor: "rgba(255,255,255,0.85)",
          padding: 20,
          gap: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <SparklesIcon size={20} color={C.primaryDark} />
          <Text style={{ fontSize: 16, fontFamily: "Nunito_700Bold", color: C.primaryDark }}>
            {t("quests.speedCalculusRunHistory")}
          </Text>
        </View>

        {history.length === 0 ? (
          <Text
            style={{ fontSize: 13, fontFamily: "Nunito_400Regular", color: "rgba(236,72,153,0.7)" }}
          >
            {t("quests.speedCalculusNoRunsYet")}
          </Text>
        ) : (
          history.map((run) => {
            const isOpen = openRunIds.has(run.runId);
            const statusOk = run.status === "completed";
            return (
              <Pressable
                key={run.runId}
                onPress={() => toggleRun(run.runId)}
                style={({ pressed }: { pressed: boolean }) => ({
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: C.primaryTint,
                  backgroundColor: pressed ? C.primaryBg : "rgba(253,242,248,0.4)",
                  padding: 16,
                  gap: 8,
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Nunito_700Bold", color: C.fg }}>
                      {t("quests.speedCalculusRunLabel", {
                        run: run.runNumber,
                        total: maxRuns,
                      })}
                    </Text>
                    <Text
                      style={{ fontSize: 12, fontFamily: "Nunito_400Regular", color: C.primaryText }}
                    >
                      {t("quests.speedCalculusRunSummary", {
                        score: run.score,
                        reward: run.reward,
                      })}
                    </Text>
                  </View>
                  <View
                    style={{
                      borderRadius: 10,
                      backgroundColor: statusOk ? C.successTint : C.dangerTint,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    {run.reward > 0 ? (
                      <>
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: "Nunito_700Bold",
                            color: statusOk ? C.successText : C.dangerText,
                          }}
                        >
                          +{run.reward}
                        </Text>
                        <CoinIcon size={14} />
                      </>
                    ) : (
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: "Nunito_700Bold",
                          color: statusOk ? C.successText : C.dangerText,
                        }}
                      >
                        {run.status}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 16,
                      color: C.primaryText,
                      transform: [{ rotate: isOpen ? "90deg" : "0deg" }],
                    }}
                  >
                    ›
                  </Text>
                </View>

                {isOpen && (
                  <View
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: C.primaryTint,
                      paddingTop: 10,
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View
                        style={{
                          borderRadius: 8,
                          backgroundColor: statusOk ? C.successTint : C.dangerTint,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: "Nunito_700Bold",
                            color: statusOk ? C.successText : C.dangerText,
                          }}
                        >
                          {run.status}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={{ fontSize: 13, fontFamily: "Nunito_400Regular", color: C.fg }}>
                        {run.score} {t("quests.speedCalculusCorrectNow").toLowerCase()} ·{" "}
                        {run.reward}
                      </Text>
                      <CoinIcon size={14} />
                    </View>
                  </View>
                )}
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
