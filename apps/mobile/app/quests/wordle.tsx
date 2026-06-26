import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { captureRef } from "react-native-view-shot";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ApiClientError } from "@adventure-time/api-client";
import type {
  WordleLocale,
  WordleStateResponse,
  WordleSubmitResponse,
} from "@adventure-time/api-client";
import { apiClient } from "../../src/lib/api";
import { PageLoadingState } from "../../src/components/loading-state";
import { WordleQuestShareCard } from "../../src/features/quests/wordle/quest-share-card";
import { buildWordleShareResult, buildWordleShareFileName } from "../../src/features/quests/wordle/share-result";
import { useTranslation } from "../../src/i18n";
import { useQuestResetStore } from "../../src/stores/quest-reset-store";
import { useThemeStore } from "../../src/stores/theme-store";
import { useWordleLanguageStore } from "../../src/stores/wordle-language-store";
import { THEME_COLORS, THEME_VARS } from "../../src/theme/themes";

const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;
const QWERTY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const AZERTY_ROWS = ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];
const WORDLE_LANGUAGE_OPTIONS: WordleLocale[] = ["fr", "en"];
const KEY_TOUCH_PADDING_X = 3;
const KEY_TOUCH_PADDING_Y = 4;
const KEY_HIT_SLOP = {
  top: KEY_TOUCH_PADDING_Y,
  bottom: KEY_TOUCH_PADDING_Y,
  left: KEY_TOUCH_PADDING_X,
  right: KEY_TOUCH_PADDING_X,
} as const;
const NARROW_TILE_LETTER_STYLE = {
  minWidth: 12,
  textAlign: "center" as const,
};
const LETTER_PRIORITY: Record<string, number> = {
  absent: 0,
  present: 1,
  correct: 2,
};

type LetterState = "correct" | "present" | "absent";
type GuessResult = { guess: string; evaluation: LetterState[] };

function tileBgBorderClass(state?: LetterState): string {
  if (state === "correct") return "bg-successDark border-successDark";
  if (state === "present") return "bg-secondary border-secondary";
  if (state === "absent") return "bg-muted border-muted";
  return "bg-surface border-primaryTint";
}

function tileLetterClass(state?: LetterState): string {
  if (state === "correct" || state === "present") return "text-white";
  if (state === "absent") return "text-fg";
  return "text-primaryDark";
}

function keyBgBorderClass(state?: LetterState): string {
  if (state === "correct") return "bg-successDark border-successDark";
  if (state === "present") return "bg-secondary border-secondary";
  if (state === "absent") return "bg-surfaceMuted border-primaryTint";
  return "bg-surface border-primaryTint";
}

function keyLetterClass(state?: LetterState): string {
  if (state === "correct" || state === "present") return "text-white";
  if (state === "absent") return "text-fgMuted";
  return "text-primaryStrong";
}

function formatShareDate(dateKey: string | null, locale: string): string | undefined {
  if (!dateKey) return undefined;
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  if (!year || !month || !day) return dateKey;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function WordleScreen() {
  const { t, locale } = useTranslation();
  const themeName = useThemeStore((s) => s.themeName);
  const hydrateWordleLanguage = useWordleLanguageStore(
    (state) => state.hydrateFromStorage,
  );
  const wordleLanguageHydrated = useWordleLanguageStore(
    (state) => state.hydrated,
  );
  const setWordleLanguage = useWordleLanguageStore(
    (state) => state.setWordleLanguage,
  );
  const wordleLanguage = useWordleLanguageStore(
    (state) => state.wordleLanguage,
  );
  const tc = THEME_COLORS[themeName];
  const lastQuestResetAt = useQuestResetStore((state) => state.lastResetAt);
  const lastQuestResetPayload = useQuestResetStore(
    (state) => state.lastPayload,
  );

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { language: languageParam } = useLocalSearchParams<{
    language?: string;
  }>();

  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [currentGuess, setCurrentGuess] = useState<(string | null)[]>(
    Array(WORD_LENGTH).fill(null),
  );
  const [solved, setSolved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [targetWord, setTargetWord] = useState<string | null>(null);
  const [activeDateKey, setActiveDateKey] = useState<string | null>(null);
  const [resetModalKind, setResetModalKind] = useState<
    null | "rollover" | "admin"
  >(null);
  const [definitionModalVisible, setDefinitionModalVisible] = useState(false);
  const [expandedDefinitionWord, setExpandedDefinitionWord] = useState<
    string | null
  >(null);
  const [removingCellIndex, setRemovingCellIndex] = useState<number | null>(
    null,
  );
  const [animatingRows, setAnimatingRows] = useState<Set<number>>(new Set());
  const [tileFaceUp, setTileFaceUp] = useState<Set<string>>(new Set());
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<View>(null);

  const attemptsUsed = guesses.length;
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attemptsUsed);
  const gameOver = solved || attemptsUsed >= MAX_ATTEMPTS;
  const canShowDefinition = gameOver;
  const inputLocked = gameOver || submitting;
  const submitLocked =
    inputLocked || currentGuess.every((letter) => letter === null);
  const rowClearDisabled = currentGuess.every((l) => l === null) || inputLocked;

  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [rowContainerWidth, setRowContainerWidth] = useState(0);

  // Stable refs for async closures
  const guessesRef = useRef(guesses);
  guessesRef.current = guesses;
  const solvedRef = useRef(solved);
  solvedRef.current = solved;
  const currentGuessRef = useRef(currentGuess);
  currentGuessRef.current = currentGuess;
  const targetWordRef = useRef(targetWord);
  targetWordRef.current = targetWord;
  const submittingRef = useRef(submitting);
  submittingRef.current = submitting;
  const activeWordleLanguageRef = useRef<WordleLocale | null>(null);
  const questVersionRef = useRef<string | null>(null);
  const resetByNameRef = useRef<string | null>(null);
  const lastHandledResetAtRef = useRef(0);
  const appliedLanguageParamRef = useRef<string | null>(null);

  // Animation values — initialized once, stable across renders
  const popAnims = useRef(
    Array.from({ length: WORD_LENGTH }, () => new Animated.Value(1)),
  ).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const rowFlipAnimsRef = useRef<Record<number, Animated.Value[]>>({});
  const revealTimersRef = useRef<
    Record<number, ReturnType<typeof setTimeout>[]>
  >({});
  const removeAnim = useRef({
    scale: new Animated.Value(1),
    opacity: new Animated.Value(1),
  }).current;

  const replaceCurrentGuess = useCallback((next: (string | null)[]) => {
    currentGuessRef.current = next;
    setCurrentGuess(next);
  }, []);

  const clearCurrentGuess = useCallback(() => {
    replaceCurrentGuess(Array(WORD_LENGTH).fill(null));
  }, [replaceCurrentGuess]);

  const clearRevealAnimations = useCallback(() => {
    Object.values(revealTimersRef.current).forEach((timers) => {
      timers.forEach((timer) => clearTimeout(timer));
    });
    revealTimersRef.current = {};
    rowFlipAnimsRef.current = {};
    setAnimatingRows(new Set());
    setTileFaceUp(new Set());
  }, []);

  useEffect(() => {
    void hydrateWordleLanguage();
  }, [hydrateWordleLanguage]);

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

  // Spoiler-safe share model — only tile evaluations are passed in, never the
  // guessed letters or the answer.
  const wordleShareResult = useMemo(
    () =>
      buildWordleShareResult({
        questTitle: t("quests.wordle.title"),
        date: activeDateKey,
        solved,
        maxAttempts: MAX_ATTEMPTS,
        wordLength: WORD_LENGTH,
        evaluations: guesses.map((guess) => guess.evaluation),
      }),
    [guesses, solved, activeDateKey, t],
  );

  const wordleShareStrings = useMemo(
    () => ({
      brand: t("quests.wordle.shareBrand"),
      footer: t("quests.wordle.shareFooter"),
      date: formatShareDate(activeDateKey, locale),
      resultLine: solved
        ? t("quests.wordle.shareSolved", {
            used: attemptsUsed,
            total: MAX_ATTEMPTS,
          })
        : t("quests.wordle.shareFailed", {
            used: attemptsUsed,
            total: MAX_ATTEMPTS,
          }),
    }),
    [t, locale, activeDateKey, solved, attemptsUsed],
  );

  // ── API ──────────────────────────────────────────────────────────────────

  const stateQuery = useQuery({
    queryKey: ["wordle", wordleLanguage],
    queryFn: () => apiClient.wordleState(wordleLanguage),
    enabled: wordleLanguageHydrated,
    staleTime: 30_000,
  });

  const wordleDefinitionDateKey = stateQuery.data?.date ?? activeDateKey;

  const definitionQuery = useQuery({
    queryKey: ["wordleDefinition", wordleLanguage, wordleDefinitionDateKey],
    queryFn: () => apiClient.wordleDefinition(wordleLanguage),
    enabled: wordleLanguageHydrated && wordleDefinitionDateKey != null,
    staleTime: Infinity,
    retry: 1,
  });

  useEffect(() => {
    const data = stateQuery.data;
    if (!data) return;

    const serverDate = data.date;
    const localeChanged = activeWordleLanguageRef.current !== data.locale;

    setActiveDateKey((prevDate) => {
      if (!prevDate || localeChanged) {
        // Initial load
        clearRevealAnimations();
        setGuesses(data.guesses as GuessResult[]);
        setSolved(data.solved);
        clearCurrentGuess();
        setMessage(null);
        setTargetWord(data.targetWord ?? null);
        questVersionRef.current = data.questVersion ?? null;
        activeWordleLanguageRef.current = data.locale;
        return serverDate;
      }

      if (prevDate !== serverDate) {
        // Date changed mid-session (day rollover)
        const hadProgress = guessesRef.current.length > 0;
        clearRevealAnimations();
        setGuesses(data.guesses as GuessResult[]);
        setSolved(data.solved);
        clearCurrentGuess();
        setMessage(null);
        setTargetWord(data.targetWord ?? null);
        questVersionRef.current = data.questVersion ?? null;
        activeWordleLanguageRef.current = data.locale;
        if (hadProgress) setResetModalKind("rollover");
        return serverDate;
      }

      // Same date — detect admin reset via questVersion or guess count going backwards
      const versionChanged =
        data.questVersion != null &&
        data.questVersion !== questVersionRef.current;
      const adminReset =
        versionChanged || data.guesses.length < guessesRef.current.length;
      if (adminReset) {
        const alreadyHandledReset =
          lastQuestResetAt > 0 &&
          lastQuestResetAt === lastHandledResetAtRef.current;

        clearRevealAnimations();
        setGuesses(data.guesses as GuessResult[]);
        setSolved(data.solved);
        clearCurrentGuess();
        setMessage(null);
        setTargetWord(data.targetWord ?? null);
        questVersionRef.current = data.questVersion ?? null;
        activeWordleLanguageRef.current = data.locale;
        if (
          !alreadyHandledReset &&
          (guessesRef.current.length > 0 || solvedRef.current)
        ) {
          resetByNameRef.current = data.resetByName ?? null;
          setResetModalKind("admin");
        }
        return prevDate;
      }

      const hasDraft = currentGuessRef.current.some(
        (letter) => letter !== null,
      );
      const busy = submittingRef.current;
      const serverAhead =
        data.guesses.length > guessesRef.current.length ||
        (data.solved && !solvedRef.current);

      if (!serverAhead) {
        if (data.targetWord && !targetWordRef.current) {
          setTargetWord(data.targetWord);
        }
        questVersionRef.current = data.questVersion ?? null;
        activeWordleLanguageRef.current = data.locale;
        return prevDate;
      }

      if (busy || hasDraft) {
        questVersionRef.current = data.questVersion ?? null;
        return prevDate;
      }

      // Same date — sync if server is ahead and local UI is idle
      setGuesses(data.guesses as GuessResult[]);
      setSolved(data.solved);
      setTargetWord(data.targetWord ?? null);
      questVersionRef.current = data.questVersion ?? null;
      activeWordleLanguageRef.current = data.locale;

      return prevDate;
    });
  }, [
    clearCurrentGuess,
    clearRevealAnimations,
    lastQuestResetAt,
    stateQuery.data,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ──────────────────────────────────────────────────────────────

  const resetBoardForNewDay = useCallback(() => {
    clearRevealAnimations();
    setGuesses([]);
    clearCurrentGuess();
    setSolved(false);
    setMessage(null);
    setTargetWord(null);
    setResetModalKind("rollover");
  }, [clearCurrentGuess, clearRevealAnimations]);

  const applyImmediateAdminReset = useCallback(
    (resetByName?: string | null) => {
      const hadProgress = guessesRef.current.length > 0 || solvedRef.current;

      clearRevealAnimations();
      setGuesses([]);
      clearCurrentGuess();
      setSolved(false);
      setSubmitting(false);
      setMessage(null);
      setTargetWord(null);
      questVersionRef.current = null;
      resetByNameRef.current = resetByName ?? null;

      if (hadProgress) {
        setResetModalKind("admin");
      }
    },
    [clearCurrentGuess, clearRevealAnimations],
  );

  useEffect(() => {
    if (!lastQuestResetAt || !lastQuestResetPayload) return;
    if (lastQuestResetAt === lastHandledResetAtRef.current) return;

    const resetQuestType = lastQuestResetPayload.questType;

    if (resetQuestType) {
      const resetLanguage =
        resetQuestType === "wordle_daily_fr"
          ? "fr"
          : resetQuestType === "wordle_daily_en"
            ? "en"
            : null;

      if (!resetLanguage || resetLanguage !== wordleLanguage) {
        return;
      }
    }

    lastHandledResetAtRef.current = lastQuestResetAt;
    applyImmediateAdminReset(lastQuestResetPayload.resetByName);
  }, [
    applyImmediateAdminReset,
    lastQuestResetAt,
    lastQuestResetPayload,
    wordleLanguage,
  ]);

  useEffect(() => {
    return () => {
      Object.values(revealTimersRef.current).forEach((timers) => {
        timers.forEach((timer) => clearTimeout(timer));
      });
    };
  }, []);

  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: -5,
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
        toValue: 5,
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

  const addLetter = useCallback(
    (letter: string) => {
      if (inputLocked) return;
      const firstNull = currentGuessRef.current.findIndex((l) => l === null);
      if (firstNull === -1) return;

      // Mutate ref immediately so rapid successive calls see the updated slot
      const next = [...currentGuessRef.current];
      next[firstNull] = letter;
      currentGuessRef.current = next;

      popAnims[firstNull].setValue(0.82);
      Animated.spring(popAnims[firstNull], {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 8,
      }).start();

      replaceCurrentGuess(next);
    },
    [inputLocked, popAnims, replaceCurrentGuess],
  );

  const handleRemoveAnimationEnd = useCallback(
    (colIndex: number) => {
      const next = [...currentGuessRef.current];
      next[colIndex] = null;
      replaceCurrentGuess(next);
      setRemovingCellIndex(null);
      removeAnim.scale.setValue(1);
      removeAnim.opacity.setValue(1);
    },
    [removeAnim, replaceCurrentGuess],
  );

  const removeLetter = useCallback(
    (index?: number) => {
      if (inputLocked || removingCellIndex !== null) return;

      let targetIndex: number;
      if (index !== undefined) {
        if (currentGuess[index] === null) return;
        targetIndex = index;
      } else {
        const lastFilled = [...currentGuess]
          .reverse()
          .findIndex((l) => l !== null);
        if (lastFilled === -1) return;
        targetIndex = currentGuess.length - 1 - lastFilled;
      }

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setRemovingCellIndex(targetIndex);
      removeAnim.scale.setValue(1);
      removeAnim.opacity.setValue(1);
      Animated.parallel([
        Animated.timing(removeAnim.scale, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(removeAnim.opacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => handleRemoveAnimationEnd(targetIndex));
    },
    [
      inputLocked,
      removingCellIndex,
      currentGuess,
      removeAnim,
      handleRemoveAnimationEnd,
    ],
  );

  const clearRow = useCallback(() => {
    if (inputLocked) return;
    clearCurrentGuess();
    triggerShake();
  }, [clearCurrentGuess, inputLocked, triggerShake]);

  const getRowFlipAnims = useCallback((rowIndex: number) => {
    if (!rowFlipAnimsRef.current[rowIndex]) {
      rowFlipAnimsRef.current[rowIndex] = Array.from(
        { length: WORD_LENGTH },
        () => new Animated.Value(1),
      );
    }

    return rowFlipAnimsRef.current[rowIndex];
  }, []);

  const patchWordleCaches = useCallback(
    (result: WordleSubmitResponse, nextGuesses: GuessResult[]) => {
      queryClient.setQueryData<WordleStateResponse>(
        ["wordle", wordleLanguage],
        (previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            locale: result.locale,
            date: result.date,
            guesses: nextGuesses,
            solved: result.solved,
            targetWord: result.targetWord ?? previous.targetWord ?? null,
          };
        },
      );

      void queryClient.invalidateQueries({ queryKey: ["quests"] });
    },
    [queryClient, wordleLanguage],
  );

  const submitGuess = useCallback(async () => {
    if (submitLocked) return;

    const normalizedGuess = currentGuess
      .filter((l) => l !== null)
      .join("")
      .toUpperCase();
    if (normalizedGuess.length !== WORD_LENGTH) {
      setMessage(t("quests.wordle.wordLength"));
      triggerShake();
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await apiClient.submitWordle({
        locale: wordleLanguage,
        guess: normalizedGuess,
        expectedDate: activeDateKey ?? undefined,
        questVersion: questVersionRef.current ?? undefined,
      });

      const rowIndex = guesses.length;
      const newGuess: GuessResult = {
        guess: normalizedGuess,
        evaluation: result.evaluation as LetterState[],
      };
      const nextGuesses = [...guesses, newGuess];

      patchWordleCaches(result, nextGuesses);

      setGuesses(nextGuesses);
      clearCurrentGuess();
      setActiveDateKey(result.date);
      setAnimatingRows((prev) => new Set(prev).add(rowIndex));
      const rowFlipAnims = getRowFlipAnims(rowIndex);
      const revealTimers: ReturnType<typeof setTimeout>[] = [];

      // Flip reveal: each tile flips in sequence, 90ms stagger
      const flipSequences: Animated.CompositeAnimation[] = [];
      for (let col = 0; col < WORD_LENGTH; col++) {
        rowFlipAnims[col].setValue(1);
        const delay = col * 90;
        flipSequences.push(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(rowFlipAnims[col], {
              toValue: 0,
              duration: 260,
              useNativeDriver: true,
            }),
            Animated.timing(rowFlipAnims[col], {
              toValue: 1,
              duration: 260,
              useNativeDriver: true,
            }),
          ]),
        );
        // Flip color at the midpoint (tile is edge-on)
        const timer = setTimeout(() => {
          setTileFaceUp((prev) => new Set([...prev, `${rowIndex}-${col}`]));
        }, delay + 260);
        revealTimers.push(timer);
      }
      revealTimersRef.current[rowIndex] = revealTimers;
      Animated.parallel(flipSequences).start(() => {
        setAnimatingRows((prev) => {
          const next = new Set(prev);
          next.delete(rowIndex);
          return next;
        });
        delete revealTimersRef.current[rowIndex];
        if (result.solved) {
          setSolved(true);
          setMessage(
            result.questJustCompleted
              ? t("quests.wordle.solvedQuest")
              : t("quests.wordle.solved"),
          );
        } else if (nextGuesses.length >= MAX_ATTEMPTS) {
          setMessage(t("quests.wordle.failed"));
          setTargetWord(result.targetWord ?? null);
        }
      });

      setSubmitting(false);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 409 && err.code === "WORDLE_RESET") {
          resetBoardForNewDay();
          return;
        }
        if (err.code === "WORD_NOT_FOUND") {
          setMessage(t("quests.wordle.wordNotFound"));
        } else {
          setMessage(t("quests.wordle.tryAgain"));
        }
      } else {
        setMessage(t("quests.wordle.tryAgain"));
      }
      triggerShake();
    } finally {
      if (submittingRef.current) {
        setSubmitting(false);
      }
    }
  }, [
    activeDateKey,
    clearCurrentGuess,
    currentGuess,
    guesses,
    getRowFlipAnims,
    wordleLanguage,
    t,
    triggerShake,
    resetBoardForNewDay,
    patchWordleCaches,
  ]);

  // ── Keyboard press helpers ───────────────────────────────────────────────

  const clearActiveKeys = useCallback(() => {
    setActiveKeys([]);
  }, []);

  useEffect(() => {
    if (!definitionModalVisible) {
      setExpandedDefinitionWord(null);
    }
  }, [definitionModalVisible]);

  useEffect(() => {
    if (!canShowDefinition && definitionModalVisible) {
      setDefinitionModalVisible(false);
    }
  }, [canShowDefinition, definitionModalVisible]);

  useEffect(() => {
    const variants = definitionQuery.data?.variants ?? [];

    if (variants.length === 0) {
      return;
    }

    setExpandedDefinitionWord((previous) => {
      if (
        previous &&
        variants.some((variant) => variant.displayWord === previous)
      ) {
        return previous;
      }

      return variants[0]?.displayWord ?? null;
    });
  }, [definitionQuery.data]);

  const handleWordleLanguageChange = useCallback(
    (nextLanguage: WordleLocale) => {
      if (nextLanguage === wordleLanguage) {
        return;
      }

      clearRevealAnimations();
      clearActiveKeys();
      setGuesses([]);
      setSolved(false);
      setSubmitting(false);
      clearCurrentGuess();
      setMessage(null);
      setTargetWord(null);
      setDefinitionModalVisible(false);
      setExpandedDefinitionWord(null);
      setResetModalKind(null);
      setActiveDateKey(null);
      questVersionRef.current = null;
      activeWordleLanguageRef.current = null;
      void setWordleLanguage(nextLanguage);
    },
    [
      clearActiveKeys,
      clearCurrentGuess,
      clearRevealAnimations,
      setWordleLanguage,
      wordleLanguage,
    ],
  );

  useEffect(() => {
    if (!wordleLanguageHydrated) {
      return;
    }

    if (typeof languageParam !== "string") {
      return;
    }

    if (languageParam !== "fr" && languageParam !== "en") {
      return;
    }

    if (appliedLanguageParamRef.current === languageParam) {
      return;
    }

    appliedLanguageParamRef.current = languageParam;
    handleWordleLanguageChange(languageParam);
  }, [handleWordleLanguageChange, languageParam, wordleLanguageHydrated]);

  const activateKey = useCallback(
    (keyId: string) => {
      if (keyId === "CLEAR") {
        if (rowClearDisabled) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        clearRow();
      } else if (keyId === "SUBMIT") {
        if (submitLocked) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        void submitGuess();
      } else {
        if (inputLocked) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        addLetter(keyId);
      }
    },
    [
      rowClearDisabled,
      submitLocked,
      inputLocked,
      clearRow,
      submitGuess,
      addLetter,
    ],
  );

  const setKeyPressed = useCallback((keyId: string, pressed: boolean) => {
    setActiveKeys((previous) => {
      const next = new Set(previous);
      if (pressed) {
        next.add(keyId);
      } else {
        next.delete(keyId);
      }
      return Array.from(next);
    });
  }, []);

  const handleShareResult = useCallback(async () => {
    if (isSharing || !shareCardRef.current) {
      return;
    }

    setIsSharing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Run the availability check while the offscreen card settles its layout.
      const [canShare] = await Promise.all([
        Sharing.isAvailableAsync(),
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
      ]);
      if (!canShare) {
        setMessage(t("quests.wordle.shareUnavailable"));
        return;
      }

      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      // Copy the temp capture to a readable file name so the share sheet and
      // saved file are recognizable (e.g. adventure-time-wordle-…-solved-3of6.png).
      let shareUri = uri;
      try {
        const fileName = buildWordleShareFileName(wordleShareResult);
        const destination = new File(Paths.cache, fileName);
        if (destination.exists) {
          destination.delete();
        }
        await new File(uri).copy(destination);
        shareUri = destination.uri;
      } catch (copyError) {
        console.warn("Failed to rename Wordle share image", copyError);
      }

      await Sharing.shareAsync(shareUri, {
        mimeType: "image/png",
        dialogTitle: t("quests.wordle.shareDialogTitle"),
        UTI: "public.png",
      });
    } catch (error) {
      console.warn("Failed to share Wordle result", error);
      setMessage(t("quests.wordle.shareError"));
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, t, wordleShareResult]);

  // ── Tile helpers ─────────────────────────────────────────────────────────

  const getTileState = (
    rowIndex: number,
    colIndex: number,
  ): LetterState | undefined => {
    const rowGuess = guesses[rowIndex];
    if (!rowGuess) return undefined;
    if (animatingRows.has(rowIndex)) {
      return tileFaceUp.has(`${rowIndex}-${colIndex}`)
        ? rowGuess.evaluation[colIndex]
        : undefined;
    }
    return rowGuess.evaluation[colIndex];
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if ((!wordleLanguageHydrated || stateQuery.isLoading) && !stateQuery.data) {
    return (
      <PageLoadingState
        title={t("quests.wordle.title")}
        message={t("common.loadingStates.pageBody")}
        icon="grid"
      />
    );
  }

  const attemptsClass = solved
    ? "text-successDark"
    : gameOver
      ? "text-dangerDark"
      : "text-primaryStrong";

  return (
    <ScrollView
      className="flex-1 bg-bg"
      style={THEME_VARS[themeName]}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 24,
        gap: 16,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View className="items-center gap-2 mb-1">
        <Text className="text-[30px] font-nunito-extrabold text-primaryDark">
          {t("quests.wordle.title")}
        </Text>
        <Text className="text-sm text-primaryDark font-nunito">
          {t("quests.wordle.subtitle")}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-full rounded-xl overflow-hidden"
          activeOpacity={0.8}
        >
          <View className="bg-primary py-2 items-center">
            <Text className="text-white font-nunito-semibold text-sm">
              {t("quests.wordle.backToQuests")}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View className="rounded-2xl border-2 border-primaryTint bg-surface p-4 shadow shadow-black/10">
        <Text className="mb-3 text-center text-xs font-nunito-bold uppercase tracking-[1px] text-fgMuted">
          {t("quests.wordle.languageLabel")}
        </Text>
        <View className="flex-row gap-3">
          {WORDLE_LANGUAGE_OPTIONS.map((option) => {
            const selected = wordleLanguage === option;
            return (
              <TouchableOpacity
                key={option}
                onPress={() => handleWordleLanguageChange(option)}
                activeOpacity={0.8}
                className={`flex-1 rounded-2xl border-2 px-4 py-3 ${selected ? "border-primary bg-primaryTint" : "border-primaryTint bg-bg"}`}
              >
                <Text
                  className={`text-center text-sm font-nunito-bold ${selected ? "text-primaryStrong" : "text-fg"}`}
                >
                  {option === "fr"
                    ? t("quests.wordle.frenchWords")
                    : t("quests.wordle.englishWords")}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Board card ──────────────────────────────────────────────────── */}
      <View className="bg-surface rounded-2xl border-2 border-primaryTint p-4 gap-4 shadow shadow-black/10">
        {/* Attempts row */}
        <View className="flex-row justify-between">
          <Text className={`text-[13px] font-nunito-bold ${attemptsClass}`}>
            {solved
              ? t("quests.wordle.attemptsUsed")
              : t("quests.wordle.attempts")}
          </Text>
          <Text className={`text-[13px] font-nunito-bold ${attemptsClass}`}>
            {solved ? attemptsUsed : attemptsLeft} / {MAX_ATTEMPTS}
          </Text>
        </View>

        {/* Grid */}
        <View className="gap-4">
          {Array.from({ length: MAX_ATTEMPTS }).map((_, rowIndex) => {
            const rowGuess = guesses[rowIndex];
            const isActiveRow = rowIndex === attemptsUsed && !rowGuess;
            const letters: string[] = rowGuess
              ? rowGuess.guess.split("")
              : isActiveRow
                ? currentGuess.map((l) => l?.toUpperCase() ?? "")
                : Array<string>(WORD_LENGTH).fill("");

            const rowTiles = (
              <View className="flex-row gap-2">
                {letters.map((letter, colIndex) => {
                  const evalState = getTileState(rowIndex, colIndex);
                  const bgBorderCls = tileBgBorderClass(evalState);
                  const letterCls = tileLetterClass(evalState);
                  const isAnimatingRow = animatingRows.has(rowIndex);
                  const rowFlipAnims = getRowFlipAnims(rowIndex);
                  const isRemovingCell =
                    isActiveRow && colIndex === removingCellIndex;

                  // Build transform and opacity for animated values
                  const animStyle: Record<string, unknown> = {};
                  const transforms: unknown[] = [];

                  if (isRemovingCell) {
                    transforms.push({ scale: removeAnim.scale });
                    animStyle.opacity = removeAnim.opacity;
                  } else if (isActiveRow && letter) {
                    transforms.push({ scale: popAnims[colIndex] });
                  }

                  if (isAnimatingRow) {
                    transforms.push({ scaleX: rowFlipAnims[colIndex] });
                  }

                  if (transforms.length > 0) {
                    animStyle.transform = transforms;
                  }

                  const letterEl = (
                    <Text
                      className={`text-xl font-nunito-extrabold ${letterCls}`}
                      style={
                        letter === "I" ? NARROW_TILE_LETTER_STYLE : undefined
                      }
                    >
                      {letter}
                    </Text>
                  );

                  const isTappable = isActiveRow && !!letter && !inputLocked;
                  return (
                    <TouchableOpacity
                      key={`${rowIndex}-${colIndex}`}
                      style={{ flex: 1, height: 48 }}
                      activeOpacity={isTappable ? 0.7 : 1}
                      onPress={
                        isTappable ? () => removeLetter(colIndex) : undefined
                      }
                      disabled={!isTappable}
                    >
                      <Animated.View
                        className={`rounded-xl border-2 items-center justify-center ${bgBorderCls}`}
                        style={[{ width: "100%", height: 48 }, animStyle]}
                      >
                        {letterEl}
                      </Animated.View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );

            if (isActiveRow) {
              return (
                <Animated.View
                  key={rowIndex}
                  style={{ transform: [{ translateX: shakeAnim }] }}
                >
                  {rowTiles}
                </Animated.View>
              );
            }

            return <View key={rowIndex}>{rowTiles}</View>;
          })}
        </View>

        {/* Message */}
        {message !== null && (
          <Text className="text-[13px] font-nunito-bold text-center text-primaryStrong">
            {message}
          </Text>
        )}

        {/* Revealed word on loss */}
        {gameOver && !solved && targetWord !== null && (
          <Text className="text-[13px] font-nunito-bold text-center text-dangerDark">
            {t("quests.wordle.revealedWord", { word: targetWord })}
          </Text>
        )}

        {gameOver ? (
          <TouchableOpacity
            onPress={() => {
              void handleShareResult();
            }}
            disabled={isSharing}
            activeOpacity={0.8}
            accessibilityRole="button"
            testID="wordle-share-result"
            className="h-12 rounded-xl overflow-hidden"
          >
            <LinearGradient
              colors={[tc.primary, tc.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: isSharing ? 0.7 : 1,
              }}
            >
              {isSharing ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : null}
              <Text className="text-sm font-nunito-bold text-white">
                {isSharing
                  ? t("quests.wordle.sharePreparing")
                  : t("quests.wordle.shareResult")}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}

        {canShowDefinition ? (
          <TouchableOpacity
            onPress={() => setDefinitionModalVisible(true)}
            activeOpacity={0.8}
            className="items-center rounded-xl border-2 border-primaryTint bg-bg px-4 py-3"
          >
            <Text className="text-sm font-nunito-bold text-primaryStrong">
              {t("quests.wordle.showDefinition")}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Keyboard card ───────────────────────────────────────────────── */}
      <View className="rounded-[28px] border-2 border-primaryTint bg-surface p-3 shadow shadow-black/10">
        <View
          onLayout={(e) => setRowContainerWidth(e.nativeEvent.layout.width)}
          className="gap-2"
        >
          {(() => {
            const KEY_GAP = 6;
            const maxRowKeys = Math.max(...keyboardRows.map((r) => r.length));
            const keyWidth =
              rowContainerWidth > 0
                ? Math.floor(
                    (rowContainerWidth - (maxRowKeys - 1) * KEY_GAP) /
                      maxRowKeys,
                  )
                : 0;

            return keyboardRows.map((row, rowIdx) => (
              <View key={row} className={rowIdx > 0 ? "mt-1" : undefined}>
                <View className="flex-row justify-center gap-1.5">
                  {row.split("").map((letter) => {
                    const kState = keyboardState[letter];
                    const pressed =
                      activeKeys.includes(letter) && !inputLocked;
                    const keyCls = keyBgBorderClass(kState);
                    const keyStyle = {
                      width: keyWidth || undefined,
                      opacity: inputLocked ? 0.45 : pressed ? 0.82 : 1,
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                    };

                    return (
                      <Pressable
                        key={letter}
                        accessibilityLabel={`wordle-key-${letter}`}
                        accessibilityRole="button"
                        className={`h-[56px] rounded-2xl border-2 items-center justify-center shadow shadow-black/10 ${keyCls}`}
                        disabled={inputLocked}
                        hitSlop={KEY_HIT_SLOP}
                        onPress={() => {
                          activateKey(letter);
                        }}
                        onPressIn={() => {
                          setKeyPressed(letter, true);
                        }}
                        onPressOut={() => {
                          setKeyPressed(letter, false);
                        }}
                        style={keyStyle}
                        testID={`wordle-key-${letter}`}
                      >
                        <Text
                          className={`text-sm font-nunito-extrabold ${keyLetterClass(kState)}`}
                        >
                          {letter}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ));
          })()}
        </View>

        <View className="mt-3 h-px bg-primaryTint" />
        {/* Clear + Submit row */}
        <View className="mt-3 flex-row gap-2">
          <Pressable
            accessibilityLabel="wordle-key-CLEAR"
            accessibilityRole="button"
            className="flex-1 h-[56px] rounded-2xl border-2 border-primaryTint bg-surfaceMuted items-center justify-center shadow shadow-black/10"
            disabled={rowClearDisabled}
            hitSlop={KEY_HIT_SLOP}
            onPress={() => {
              activateKey("CLEAR");
            }}
            onPressIn={() => {
              setKeyPressed("CLEAR", true);
            }}
            onPressOut={() => {
              setKeyPressed("CLEAR", false);
            }}
            style={{
              opacity: rowClearDisabled
                ? 0.4
                : activeKeys.includes("CLEAR")
                  ? 0.82
                  : 1,
              transform: [
                {
                  scale:
                    activeKeys.includes("CLEAR") && !rowClearDisabled
                      ? 0.96
                      : 1,
                },
              ],
            }}
            testID="wordle-key-CLEAR"
          >
            <Text className="text-xs font-nunito-extrabold text-primaryStrong">
              {t("quests.wordle.clear")}
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="wordle-key-SUBMIT"
            accessibilityRole="button"
            className="flex-1 h-[56px] rounded-2xl overflow-hidden shadow shadow-black/10"
            disabled={submitLocked}
            hitSlop={KEY_HIT_SLOP}
            onPress={() => {
              activateKey("SUBMIT");
            }}
            onPressIn={() => {
              setKeyPressed("SUBMIT", true);
            }}
            onPressOut={() => {
              setKeyPressed("SUBMIT", false);
            }}
            style={{
              opacity: submitLocked
                ? 0.4
                : activeKeys.includes("SUBMIT")
                  ? 0.88
                  : 1,
              transform: [
                {
                  scale:
                    activeKeys.includes("SUBMIT") && !submitLocked ? 0.96 : 1,
                },
              ],
            }}
            testID="wordle-key-SUBMIT"
          >
            <LinearGradient
              colors={[tc.primary, tc.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text className="text-xs font-nunito-extrabold text-white">
                {submitting ? "…" : t("quests.wordle.submit")}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      {/* Offscreen, capture-friendly share card. Rendered (not display:none)
          and laid out off-screen so react-native-view-shot can snapshot it. */}
      {gameOver ? (
        <View
          pointerEvents="none"
          collapsable={false}
          style={{ position: "absolute", left: -9999, top: 0 }}
        >
          <View ref={shareCardRef} collapsable={false}>
            <WordleQuestShareCard
              result={wordleShareResult}
              colors={tc}
              strings={wordleShareStrings}
            />
          </View>
        </View>
      ) : null}

      <Modal
        visible={definitionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDefinitionModalVisible(false)}
      >
        <View className="flex-1 bg-black/45 items-center justify-center p-4">
          <View className="bg-surface rounded-2xl border-2 border-primaryTint p-5 w-full max-w-[360px] shadow shadow-black/20">
            <Text className="text-lg font-nunito-extrabold text-primaryStrong">
              {t("quests.wordle.definitionTitle")}
            </Text>

            {definitionQuery.isLoading && !definitionQuery.data ? (
              <Text className="mt-3 text-sm leading-5 font-nunito text-primaryStrong">
                {t("quests.wordle.definitionLoading")}
              </Text>
            ) : null}

            {definitionQuery.error && !definitionQuery.data ? (
              <Text className="mt-3 text-sm leading-5 font-nunito text-dangerDark">
                {t("quests.wordle.definitionError")}
              </Text>
            ) : null}

            {definitionQuery.data ? (
              <ScrollView
                className="mt-3 max-h-[320px]"
                contentContainerStyle={{ gap: 10 }}
              >
                <View className="rounded-2xl border border-primaryTint bg-bg px-3 py-2">
                  <Text className="text-xs font-nunito-bold uppercase tracking-[1px] text-fgMuted">
                    {t("quests.wordle.definitionWordLabel")}
                  </Text>
                  <Text className="mt-1 text-base font-nunito-extrabold text-primaryStrong">
                    {definitionQuery.data.word}
                  </Text>
                </View>

                {definitionQuery.data.variants.length > 1 ? (
                  <Text className="text-xs font-nunito-bold uppercase tracking-[1px] text-fgMuted">
                    {t("quests.wordle.definitionChoicesLabel")}
                  </Text>
                ) : null}

                {definitionQuery.data.variants.map((variant) => {
                  const expandable = definitionQuery.data.variants.length > 1;
                  const expanded =
                    !expandable ||
                    expandedDefinitionWord === variant.displayWord;

                  return (
                    <View
                      key={variant.displayWord}
                      className="rounded-2xl border border-primaryTint bg-bg px-3 py-2"
                    >
                      <TouchableOpacity
                        activeOpacity={expandable ? 0.8 : 1}
                        onPress={() => {
                          if (!expandable) {
                            return;
                          }

                          setExpandedDefinitionWord((previous) =>
                            previous === variant.displayWord
                              ? null
                              : variant.displayWord,
                          );
                        }}
                        className="flex-row items-start justify-between gap-3"
                      >
                        <View className="flex-1">
                          <Text className="text-base font-nunito-extrabold text-primaryStrong">
                            {variant.displayWord}
                          </Text>
                          {variant.partOfSpeech ? (
                            <Text className="mt-1 text-sm font-nunito text-fgMuted">
                              {variant.partOfSpeech}
                            </Text>
                          ) : null}
                        </View>

                        {expandable ? (
                          <Text className="text-lg font-nunito-extrabold text-primaryStrong">
                            {expanded ? "-" : "+"}
                          </Text>
                        ) : null}
                      </TouchableOpacity>

                      {expanded ? (
                        <View className="mt-3 gap-2">
                          <Text className="text-sm leading-6 font-nunito text-primaryStrong">
                            {variant.definition}
                          </Text>

                          <Text className="text-xs leading-5 font-nunito text-fgMuted">
                            {t("quests.wordle.definitionSource", {
                              source: variant.sourceName,
                            })}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
            ) : null}

            <TouchableOpacity
              onPress={() => setDefinitionModalVisible(false)}
              activeOpacity={0.8}
              className="mt-5 h-11 rounded-xl overflow-hidden"
            >
              <LinearGradient
                colors={[tc.primary, tc.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text className="text-sm font-nunito-bold text-white">
                  {t("quests.wordle.definitionClose")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Reset modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={resetModalKind !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setResetModalKind(null)}
      >
        <View className="flex-1 bg-black/45 items-center justify-center p-4">
          <View className="bg-surface rounded-2xl border-2 border-primaryTint p-5 w-full max-w-[360px] shadow shadow-black/20">
            <Text className="text-lg font-nunito-extrabold text-primaryStrong">
              {resetModalKind === "admin"
                ? t("quests.wordle.adminResetTitle")
                : t("quests.wordle.resetTitle")}
            </Text>
            <Text className="mt-2 text-sm leading-5 font-nunito text-primaryStrong">
              {resetModalKind === "admin"
                ? t("quests.wordle.adminResetBody", {
                    name:
                      resetByNameRef.current ??
                      (locale === "fr" ? "un administrateur" : "an admin"),
                  })
                : t("quests.wordle.resetBody")}
            </Text>
            <TouchableOpacity
              onPress={() => setResetModalKind(null)}
              activeOpacity={0.8}
              className="mt-5 h-11 rounded-xl overflow-hidden"
            >
              <LinearGradient
                colors={[tc.primary, tc.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text className="text-sm font-nunito-bold text-white">
                  {t("quests.wordle.resetCta")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
