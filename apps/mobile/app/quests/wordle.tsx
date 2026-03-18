import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { ApiClientError } from "@adventure-time/api-client";
import { apiClient } from "../../src/lib/api";
import { useTranslation } from "../../src/i18n";

const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;
const QWERTY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const AZERTY_ROWS = ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];
const LETTER_PRIORITY: Record<string, number> = { absent: 0, present: 1, correct: 2 };

type LetterState = "correct" | "present" | "absent";
type GuessResult = { guess: string; evaluation: LetterState[] };

const C = {
  correct: "#14B8A6",
  present: "#FACC15",
  absent: "#9CA3AF",
  emptyBg: "#FFFFFF",
  emptyBorder: "#FCE7F3",
  emptyText: "#EC4899",
  evalTextAbsent: "#4a3728",
  evalTextOther: "#FFFFFF",
  keyBg: "#FCE7F3",
  keyText: "#9D174D",
  surface: "#FFFFFF",
  surfaceBorder: "#FCE7F3",
  primary: "#F472B6",
  primaryText: "#FCE7F3",
  primaryDark: "#EC4899",
  primaryStrong: "#9D174D",
  successDark: "#14B8A6",
  dangerDark: "#F43F5E",
  screenBg: "#fff0f5",
};

function tileVisuals(state?: LetterState): { bg: string; border: string; text: string } {
  if (state === "correct") return { bg: C.correct, border: C.correct, text: C.evalTextOther };
  if (state === "present") return { bg: C.present, border: C.present, text: C.evalTextOther };
  if (state === "absent") return { bg: C.absent, border: C.absent, text: C.evalTextAbsent };
  return { bg: C.emptyBg, border: C.emptyBorder, text: C.emptyText };
}

function keyVisuals(state?: LetterState): { bg: string; border: string; text: string } {
  if (state === "correct") return { bg: C.correct, border: C.correct, text: C.evalTextOther };
  if (state === "present") return { bg: C.present, border: C.present, text: C.evalTextOther };
  if (state === "absent") return { bg: C.absent, border: C.absent, text: C.evalTextAbsent };
  return { bg: C.keyBg, border: C.keyBg, text: C.keyText };
}

const SCREEN_H_PADDING = 32;
const CARD_H_PADDING = 32;
const KEY_GAP = 6;
const MAX_ROW_KEYS = 10;

export default function WordleScreen() {
  const { t, locale } = useTranslation();
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get("window").width;
  const keyWidth = Math.max(
    24,
    Math.floor((screenWidth - SCREEN_H_PADDING - CARD_H_PADDING - KEY_GAP * (MAX_ROW_KEYS - 1)) / MAX_ROW_KEYS)
  );
  const router = useRouter();
  const queryClient = useQueryClient();

  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [currentGuess, setCurrentGuess] = useState<(string | null)[]>(Array(WORD_LENGTH).fill(null));
  const [solved, setSolved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [targetWord, setTargetWord] = useState<string | null>(null);
  const [activeDateKey, setActiveDateKey] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [removingCellIndex, setRemovingCellIndex] = useState<number | null>(null);
  const [animatingRowIndex, setAnimatingRowIndex] = useState<number | null>(null);
  const [tileFaceUp, setTileFaceUp] = useState<Set<string>>(new Set());

  const attemptsUsed = guesses.length;
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attemptsUsed);
  const gameOver = solved || attemptsUsed >= MAX_ATTEMPTS;
  const keyboardLocked = gameOver || submitting;

  // Stable refs for async closures
  const guessesRef = useRef(guesses);
  guessesRef.current = guesses;
  const solvedRef = useRef(solved);
  solvedRef.current = solved;

  // Animation values — initialized once, stable across renders
  const popAnims = useRef(Array.from({ length: WORD_LENGTH }, () => new Animated.Value(1))).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const flipAnims = useRef(Array.from({ length: WORD_LENGTH }, () => new Animated.Value(1))).current;
  const removeAnim = useRef({
    scale: new Animated.Value(1),
    opacity: new Animated.Value(1),
  }).current;

  const keyboardState = useMemo<Record<string, LetterState>>(() => {
    const state: Record<string, LetterState> = {};
    for (const guess of guesses) {
      guess.guess.split("").forEach((letter, i) => {
        const next = guess.evaluation[i];
        const cur = state[letter];
        if (!cur || LETTER_PRIORITY[next] > LETTER_PRIORITY[cur]) {
          state[letter] = next;
        }
      });
    }
    return state;
  }, [guesses]);

  const keyboardRows = locale === "fr" ? AZERTY_ROWS : QWERTY_ROWS;

  // ── API ──────────────────────────────────────────────────────────────────

  const stateQuery = useQuery({
    queryKey: ["wordle"],
    queryFn: () => apiClient.wordleState(),
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const data = stateQuery.data;
    if (!data) return;

    const serverDate = data.date;

    setActiveDateKey((prevDate) => {
      if (!prevDate) {
        // Initial load
        setGuesses(data.guesses as GuessResult[]);
        setSolved(data.solved);
        if (data.targetWord) setTargetWord(data.targetWord);
        return serverDate;
      }

      if (prevDate !== serverDate) {
        // Date changed mid-session
        const hadProgress = guessesRef.current.length > 0;
        setGuesses(data.guesses as GuessResult[]);
        setSolved(data.solved);
        setCurrentGuess(Array(WORD_LENGTH).fill(null));
        setMessage(null);
        setTargetWord(data.targetWord ?? null);
        if (hadProgress) setShowResetModal(true);
        return serverDate;
      }

      // Same date — sync only if server is ahead
      if (data.guesses.length > guessesRef.current.length || (data.solved && !solvedRef.current)) {
        setGuesses(data.guesses as GuessResult[]);
        setSolved(data.solved);
        if (data.targetWord) setTargetWord(data.targetWord);
      }

      return prevDate;
    });
  }, [stateQuery.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ──────────────────────────────────────────────────────────────

  const resetBoardForNewDay = useCallback(() => {
    setGuesses([]);
    setCurrentGuess(Array(WORD_LENGTH).fill(null));
    setSolved(false);
    setMessage(null);
    setTargetWord(null);
    setShowResetModal(true);
  }, []);

  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -5, duration: 68, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 68, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 68, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 68, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 68, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const addLetter = useCallback((letter: string) => {
    if (keyboardLocked || currentGuess.every((l) => l !== null)) return;
    const firstNull = currentGuess.findIndex((l) => l === null);
    if (firstNull === -1) return;

    popAnims[firstNull].setValue(0.82);
    Animated.spring(popAnims[firstNull], {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();

    setCurrentGuess((prev) => {
      const next = [...prev];
      next[firstNull] = letter;
      return next;
    });
  }, [keyboardLocked, currentGuess, popAnims]);

  const handleRemoveAnimationEnd = useCallback((colIndex: number) => {
    setCurrentGuess((prev) => {
      const next = [...prev];
      next[colIndex] = null;
      return next;
    });
    setRemovingCellIndex(null);
    removeAnim.scale.setValue(1);
    removeAnim.opacity.setValue(1);
  }, [removeAnim]);

  const removeLetter = useCallback((index?: number) => {
    if (keyboardLocked || removingCellIndex !== null) return;

    let targetIndex: number;
    if (index !== undefined) {
      if (currentGuess[index] === null) return;
      targetIndex = index;
    } else {
      const lastFilled = [...currentGuess].reverse().findIndex((l) => l !== null);
      if (lastFilled === -1) return;
      targetIndex = currentGuess.length - 1 - lastFilled;
    }

    setRemovingCellIndex(targetIndex);
    removeAnim.scale.setValue(1);
    removeAnim.opacity.setValue(1);
    Animated.parallel([
      Animated.timing(removeAnim.scale, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(removeAnim.opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => handleRemoveAnimationEnd(targetIndex));
  }, [keyboardLocked, removingCellIndex, currentGuess, removeAnim, handleRemoveAnimationEnd]);

  const clearRow = useCallback(() => {
    if (keyboardLocked) return;
    setCurrentGuess(Array(WORD_LENGTH).fill(null));
    triggerShake();
  }, [keyboardLocked, triggerShake]);

  const submitGuess = useCallback(async () => {
    if (keyboardLocked) return;

    const normalizedGuess = currentGuess.filter((l) => l !== null).join("").toUpperCase();
    if (normalizedGuess.length !== WORD_LENGTH) {
      setMessage(t("native.wordle.wordLength"));
      triggerShake();
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await apiClient.submitWordle({
        guess: normalizedGuess,
        expectedDate: activeDateKey ?? undefined,
      });

      const rowIndex = guesses.length;
      const newGuess: GuessResult = {
        guess: normalizedGuess,
        evaluation: result.evaluation as LetterState[],
      };
      const nextGuesses = [...guesses, newGuess];

      setGuesses(nextGuesses);
      setCurrentGuess(Array(WORD_LENGTH).fill(null));
      setAnimatingRowIndex(rowIndex);
      setTileFaceUp(new Set());

      // Flip reveal: each tile flips in sequence, 90ms stagger
      for (let col = 0; col < WORD_LENGTH; col++) {
        flipAnims[col].setValue(1);
        const delay = col * 90;
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(flipAnims[col], { toValue: 0, duration: 260, useNativeDriver: true }),
          Animated.timing(flipAnims[col], { toValue: 1, duration: 260, useNativeDriver: true }),
        ]).start();
        // Flip color at the midpoint (tile is edge-on)
        setTimeout(() => {
          setTileFaceUp((prev) => new Set([...prev, `${rowIndex}-${col}`]));
        }, delay + 260);
      }

      // Total animation: last tile starts at (WORD_LENGTH-1)*90, takes 520ms total
      const totalAnimMs = (WORD_LENGTH - 1) * 90 + 520;
      setTimeout(() => {
        setAnimatingRowIndex(null);
        if (result.solved) {
          setSolved(true);
          setMessage(result.questJustCompleted ? t("native.wordle.solvedQuest") : t("native.wordle.solved"));
        } else if (nextGuesses.length >= MAX_ATTEMPTS) {
          setMessage(t("native.wordle.failed"));
          void apiClient.wordleState().then((state) => {
            if (state.targetWord) setTargetWord(state.targetWord);
          }).catch(() => {});
        }
      }, totalAnimMs);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["wordle"] }),
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
      ]);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 409 && err.code === "WORDLE_RESET") {
          resetBoardForNewDay();
          return;
        }
        if (err.code === "WORD_NOT_FOUND") {
          setMessage(t("native.wordle.wordNotFound"));
        } else {
          setMessage(t("native.wordle.tryAgain"));
        }
      } else {
        setMessage(t("native.wordle.tryAgain"));
      }
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  }, [keyboardLocked, currentGuess, activeDateKey, guesses, flipAnims, t, triggerShake, resetBoardForNewDay, queryClient]);

  // ── Tile helpers ─────────────────────────────────────────────────────────

  const getTileState = (rowIndex: number, colIndex: number): LetterState | undefined => {
    const rowGuess = guesses[rowIndex];
    if (!rowGuess) return undefined;
    if (animatingRowIndex === rowIndex) {
      return tileFaceUp.has(`${rowIndex}-${colIndex}`) ? rowGuess.evaluation[colIndex] : undefined;
    }
    return rowGuess.evaluation[colIndex];
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (stateQuery.isLoading && !stateQuery.data) {
    return (
      <View style={{ flex: 1, backgroundColor: C.screenBg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: C.primaryStrong, fontFamily: "Nunito_600SemiBold" }}>
          {t("native.wordle.title")}…
        </Text>
      </View>
    );
  }

  const attemptsColor = solved ? C.successDark : gameOver ? C.dangerDark : C.primaryStrong;
  const rowClearDisabled = currentGuess.every((l) => l === null) || keyboardLocked;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.screenBg }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, gap: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={{ alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Text style={{ fontSize: 30, fontFamily: "Nunito_800ExtraBold", color: C.primaryDark }}>
          {t("native.wordle.title")}
        </Text>
        <Text style={{ fontSize: 14, color: "rgba(236,72,153,0.8)", fontFamily: "Nunito_400Regular" }}>
          {t("native.wordle.subtitle")}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: "100%", borderRadius: 12, overflow: "hidden" }}
          activeOpacity={0.8}
        >
          <View style={{ backgroundColor: C.primary, paddingVertical: 8, alignItems: "center" }}>
            <Text style={{ color: C.primaryText, fontFamily: "Nunito_600SemiBold", fontSize: 14 }}>
              {t("native.wordle.backToQuests")}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Board card ──────────────────────────────────────────────────── */}
      <View style={{
        backgroundColor: C.surface,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: C.surfaceBorder,
        padding: 16,
        gap: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
      }}>
        {/* Attempts row */}
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 13, fontFamily: "Nunito_700Bold", color: attemptsColor }}>
            {solved ? t("native.wordle.attemptsUsed") : t("native.wordle.attempts")}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: "Nunito_700Bold", color: attemptsColor }}>
            {solved ? attemptsUsed : attemptsLeft} / {MAX_ATTEMPTS}
          </Text>
        </View>

        {/* Grid */}
        <View style={{ gap: 16 }}>
          {Array.from({ length: MAX_ATTEMPTS }).map((_, rowIndex) => {
            const rowGuess = guesses[rowIndex];
            const isActiveRow = rowIndex === attemptsUsed && !rowGuess;
            const letters: string[] = rowGuess
              ? rowGuess.guess.split("")
              : isActiveRow
                ? currentGuess.map((l) => l?.toUpperCase() ?? "")
                : Array<string>(WORD_LENGTH).fill("");

            const rowTiles = (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {letters.map((letter, colIndex) => {
                  const evalState = getTileState(rowIndex, colIndex);
                  const v = tileVisuals(evalState);
                  const isAnimatingRow = animatingRowIndex === rowIndex;
                  const isRemovingCell = isActiveRow && colIndex === removingCellIndex;

                  const tileStyle = {
                    height: 48,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: v.border,
                    backgroundColor: v.bg,
                    alignItems: "center" as const,
                    justifyContent: "center" as const,
                  };

                  // Build transform and opacity
                  const animStyle: Record<string, unknown> = {};
                  const transforms: unknown[] = [];

                  if (isRemovingCell) {
                    transforms.push({ scale: removeAnim.scale });
                    animStyle.opacity = removeAnim.opacity;
                  } else if (isActiveRow && letter) {
                    transforms.push({ scale: popAnims[colIndex] });
                  }

                  if (isAnimatingRow) {
                    transforms.push({ scaleX: flipAnims[colIndex] });
                  }

                  if (transforms.length > 0) {
                    animStyle.transform = transforms;
                  }

                  const letterEl = (
                    <Text style={{ fontSize: 20, fontFamily: "Nunito_800ExtraBold", color: v.text }}>
                      {letter}
                    </Text>
                  );

                  if (isActiveRow && letter && !keyboardLocked) {
                    return (
                      <TouchableOpacity
                        key={`${rowIndex}-${colIndex}`}
                        style={{ flex: 1 }}
                        activeOpacity={0.7}
                        onPress={() => removeLetter(colIndex)}
                      >
                        <Animated.View style={[{ width: "100%", ...tileStyle }, animStyle]}>
                          {letterEl}
                        </Animated.View>
                      </TouchableOpacity>
                    );
                  }

                  return (
                    <Animated.View
                      key={`${rowIndex}-${colIndex}`}
                      style={[{ flex: 1, ...tileStyle }, animStyle]}
                    >
                      {letterEl}
                    </Animated.View>
                  );
                })}
              </View>
            );

            if (isActiveRow) {
              return (
                <Animated.View key={rowIndex} style={{ transform: [{ translateX: shakeAnim }] }}>
                  {rowTiles}
                </Animated.View>
              );
            }

            return <View key={rowIndex}>{rowTiles}</View>;
          })}
        </View>

        {/* Message */}
        {message !== null && (
          <Text style={{ fontSize: 13, fontFamily: "Nunito_700Bold", textAlign: "center", color: C.primaryStrong }}>
            {message}
          </Text>
        )}

        {/* Revealed word on loss */}
        {gameOver && !solved && targetWord !== null && (
          <Text style={{ fontSize: 13, fontFamily: "Nunito_700Bold", textAlign: "center", color: C.dangerDark }}>
            {t("native.wordle.revealedWord", { word: targetWord })}
          </Text>
        )}
      </View>

      {/* ── Keyboard card ───────────────────────────────────────────────── */}
      <View style={{
        backgroundColor: C.surface,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: C.surfaceBorder,
        padding: 16,
        gap: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
      }}>
        {keyboardRows.map((row) => (
          <View key={row} style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
            {row.split("").map((letter) => {
              const kv = keyVisuals(keyboardState[letter]);
              return (
                <TouchableOpacity
                  key={letter}
                  disabled={keyboardLocked}
                  onPress={() => addLetter(letter)}
                  activeOpacity={0.7}
                  style={{
                    width: keyWidth,
                    height: 44,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: kv.border,
                    backgroundColor: kv.bg,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: keyboardLocked ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontSize: 12, fontFamily: "Nunito_800ExtraBold", color: kv.text }}>
                    {letter}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Clear + Guess row */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <TouchableOpacity
            onPress={clearRow}
            disabled={rowClearDisabled}
            activeOpacity={0.7}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: C.surfaceBorder,
              backgroundColor: C.keyBg,
              alignItems: "center",
              justifyContent: "center",
              opacity: rowClearDisabled ? 0.5 : 1,
            }}
          >
            <Text style={{ fontSize: 12, fontFamily: "Nunito_800ExtraBold", color: C.primaryStrong }}>
              {t("native.wordle.clear")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => void submitGuess()}
            disabled={keyboardLocked}
            activeOpacity={0.8}
            style={{ flex: 1, height: 44, borderRadius: 12, overflow: "hidden", opacity: keyboardLocked ? 0.5 : 1 }}
          >
            <LinearGradient
              colors={[C.primary, C.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontSize: 12, fontFamily: "Nunito_800ExtraBold", color: "#FFFFFF" }}>
                {submitting ? "…" : t("native.wordle.submit")}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Reset modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={showResetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}>
          <View style={{
            backgroundColor: C.surface,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: C.surfaceBorder,
            padding: 20,
            width: "100%",
            maxWidth: 360,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 24,
            elevation: 8,
          }}>
            <Text style={{ fontSize: 18, fontFamily: "Nunito_800ExtraBold", color: C.primaryStrong }}>
              {t("native.wordle.resetTitle")}
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, fontFamily: "Nunito_400Regular", color: C.primaryStrong }}>
              {t("native.wordle.resetBody")}
            </Text>
            <TouchableOpacity
              onPress={() => setShowResetModal(false)}
              activeOpacity={0.8}
              style={{ marginTop: 20, height: 44, borderRadius: 12, overflow: "hidden" }}
            >
              <LinearGradient
                colors={[C.primary, C.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 14, fontFamily: "Nunito_700Bold", color: "#FFFFFF" }}>
                  {t("native.wordle.resetCta")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
