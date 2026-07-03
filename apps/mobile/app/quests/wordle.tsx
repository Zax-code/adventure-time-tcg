import { useState, useCallback, useMemo, useRef } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  cancelAnimation,
  type SharedValue,
  useSharedValue,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { captureRef } from "react-native-view-shot";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ApiClientError } from "@adventure-time/api-client";
import type {
  QuestsResponse,
  WordleDefinitionVariant,
  WordleLocale,
  WordleStateResponse,
  WordleSubmitResponse,
} from "@adventure-time/api-client";
import { apiClient } from "../../src/lib/api";
import { ShareIcon } from "../../src/components/icons";
import { PageLoadingState } from "../../src/components/loading-state";
import { QuestActionButton } from "../../src/features/quests/quest-action-button";
import { WordleActiveRow } from "../../src/features/quests/wordle/active-row";
import { WordleDefinitionVariantCard } from "../../src/features/quests/wordle/definition-variant-card";
import { WordleQuestShareCard } from "../../src/features/quests/wordle/quest-share-card";
import {
  buildWordleShareFileName,
  buildWordleShareResult,
} from "../../src/features/quests/wordle/share-result";
import { WordleTile } from "../../src/features/quests/wordle/tile";
import { useTranslation } from "../../src/i18n";
import { useQuestResetStore } from "../../src/stores/quest-reset-store";
import { useSessionStore } from "../../src/stores/session-store";
import { useThemeStore } from "../../src/stores/theme-store";
import { useWordleLanguageStore } from "../../src/stores/wordle-language-store";
import { THEME_COLORS, THEME_VARS } from "../../src/theme/themes";
import { reactEffect } from "../../src/lib/react-primitives";

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
const WORDLE_REMOVE_MS = 160;
const WORDLE_REVEAL_HALF_MS = 260;
const WORDLE_REVEAL_STAGGER_MS = 90;
const LETTER_PRIORITY: Record<string, number> = {
  absent: 0,
  present: 1,
  correct: 2,
};

type LetterState = "correct" | "present" | "absent";
type GuessResult = { guess: string; evaluation: LetterState[] };
type Quest = QuestsResponse["quests"][number];

function useWordleColumnValues(initialValue: number): SharedValue<number>[] {
  const first = useSharedValue(initialValue);
  const second = useSharedValue(initialValue);
  const third = useSharedValue(initialValue);
  const fourth = useSharedValue(initialValue);
  const fifth = useSharedValue(initialValue);

  return useMemo(
    () => [first, second, third, fourth, fifth],
    [fifth, first, fourth, second, third],
  );
}

function useWordleBoardValues(initialValue: number): SharedValue<number>[][] {
  const first = useWordleColumnValues(initialValue);
  const second = useWordleColumnValues(initialValue);
  const third = useWordleColumnValues(initialValue);
  const fourth = useWordleColumnValues(initialValue);
  const fifth = useWordleColumnValues(initialValue);
  const sixth = useWordleColumnValues(initialValue);

  return useMemo(
    () => [first, second, third, fourth, fifth, sixth],
    [fifth, first, fourth, second, sixth, third],
  );
}

function getWordleQuestType(locale: WordleLocale) {
  return locale === "fr" ? "wordle_daily_fr" : "wordle_daily_en";
}

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

function formatShareDate(
  dateKey: string | null,
  locale: string,
): string | undefined {
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
  return useWordleScreenView();
}

function useWordleScreenView() {
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
  const patchUser = useSessionStore((state) => state.patchUser);
  const { language: languageParam } = useLocalSearchParams<{
    language?: string;
  }>();

  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [currentGuess, setCurrentGuess] = useState<(string | null)[]>(() =>
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
  const [removingCells, setRemovingCells] = useState<Record<number, string>>(
    {},
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

  const shakeAnim = useSharedValue(0);
  const rowFlipAnims = useWordleBoardValues(1);
  const revealTimersRef = useRef<
    Record<number, ReturnType<typeof setTimeout>[]>
  >({});
  const removeAnimationTimersRef = useRef<
    Record<number, ReturnType<typeof setTimeout>>
  >({});

  const replaceCurrentGuess = useCallback((next: (string | null)[]) => {
    currentGuessRef.current = next;
    setCurrentGuess(next);
  }, []);

  const clearCurrentGuess = useCallback(() => {
    Object.values(removeAnimationTimersRef.current).forEach((timer) =>
      clearTimeout(timer),
    );
    removeAnimationTimersRef.current = {};
    setRemovingCells({});
    replaceCurrentGuess(Array(WORD_LENGTH).fill(null));
  }, [replaceCurrentGuess]);

  const clearRevealAnimations = useCallback(() => {
    Object.values(revealTimersRef.current).forEach((timers) => {
      timers.forEach((timer) => clearTimeout(timer));
    });
    revealTimersRef.current = {};
    rowFlipAnims.forEach((row) => {
      row.forEach((anim) => {
        anim.value = 1;
      });
    });
    setAnimatingRows(new Set());
    setTileFaceUp(new Set());
  }, [rowFlipAnims]);

  reactEffect(() => {
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
        wordLocale: wordleLanguage,
        solved,
        maxAttempts: MAX_ATTEMPTS,
        wordLength: WORD_LENGTH,
        evaluations: guesses.map((guess) => guess.evaluation),
      }),
    [guesses, solved, activeDateKey, t, wordleLanguage],
  );

  const wordleShareStrings = useMemo(
    () => ({
      brand: t("quests.wordle.shareBrand"),
      footer: t("quests.wordle.shareFooter"),
      date: formatShareDate(activeDateKey, locale),
      wordLanguage:
        wordleLanguage === "fr"
          ? t("quests.wordle.shareFrenchWord")
          : t("quests.wordle.shareEnglishWord"),
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
    [t, locale, activeDateKey, wordleLanguage, solved, attemptsUsed],
  );

  // ── API ──────────────────────────────────────────────────────────────────

  const { data: stateQueryData, isLoading: stateQueryIsLoading } = useQuery({
    queryKey: ["wordle", wordleLanguage],
    queryFn: () => apiClient.wordleState(wordleLanguage),
    enabled: wordleLanguageHydrated,
    staleTime: 30_000,
  });

  const { data: questsData } = useQuery({
    queryKey: ["quests"],
    queryFn: () => apiClient.quests(),
    enabled: wordleLanguageHydrated,
    staleTime: 30_000,
  });

  const currentWordleQuest: Quest | undefined = useMemo(() => {
    const questType = getWordleQuestType(wordleLanguage);
    return questsData?.quests.find((quest) => quest.type === questType);
  }, [questsData?.quests, wordleLanguage]);

  const claimableQuest =
    currentWordleQuest?.completed && !currentWordleQuest.claimed
      ? currentWordleQuest
      : null;

  const wordleDefinitionDateKey = stateQueryData?.date ?? activeDateKey;

  const {
    data: definitionQueryData,
    error: definitionQueryError,
    isLoading: definitionQueryIsLoading,
  } = useQuery({
    queryKey: ["wordleDefinition", wordleLanguage, wordleDefinitionDateKey],
    queryFn: () => apiClient.wordleDefinition(wordleLanguage),
    enabled: wordleLanguageHydrated && wordleDefinitionDateKey != null,
    staleTime: Infinity,
    retry: 1,
  });

  const definitionVariantCount = definitionQueryData?.variants.length ?? 0;
  const handleDefinitionVariantToggle = useCallback(
    (displayWord: string, expandable: boolean) => {
      if (!expandable) {
        return;
      }

      setExpandedDefinitionWord((previous) =>
        previous === displayWord ? null : displayWord,
      );
    },
    [],
  );
  const renderDefinitionVariant = useCallback(
    ({ item: variant }: { item: WordleDefinitionVariant }) => {
      const expandable = definitionVariantCount > 1;
      const expanded =
        !expandable || expandedDefinitionWord === variant.displayWord;

      return (
        <WordleDefinitionVariantCard
          definitionSourceLabel={t("quests.wordle.definitionSource", {
            source: variant.sourceName,
          })}
          expanded={expanded}
          expandable={expandable}
          onToggle={handleDefinitionVariantToggle}
          variant={variant}
        />
      );
    },
    [
      definitionVariantCount,
      expandedDefinitionWord,
      handleDefinitionVariantToggle,
      t,
    ],
  );

  reactEffect(() => {
    const data = stateQueryData;
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
    stateQueryData,
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

  reactEffect(() => {
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

  reactEffect(() => {
    const revealTimersSnapshot = revealTimersRef.current;

    return () => {
      Object.values(revealTimersSnapshot).forEach((timers) => {
        timers.forEach((timer) => clearTimeout(timer));
      });
      Object.values(removeAnimationTimersRef.current).forEach((timer) =>
        clearTimeout(timer),
      );
      removeAnimationTimersRef.current = {};
    };
  }, []);

  const triggerShake = useCallback(() => {
    cancelAnimation(shakeAnim);
    shakeAnim.value = 0;
    shakeAnim.value = withSequence(
      withTiming(-5, { duration: 68 }),
      withTiming(5, { duration: 68 }),
      withTiming(-5, { duration: 68 }),
      withTiming(5, { duration: 68 }),
      withTiming(0, { duration: 68 }),
    );
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

      replaceCurrentGuess(next);
    },
    [inputLocked, replaceCurrentGuess],
  );

  const handleRemoveAnimationEnd = useCallback((colIndex: number) => {
    if (removeAnimationTimersRef.current[colIndex]) {
      clearTimeout(removeAnimationTimersRef.current[colIndex]);
      delete removeAnimationTimersRef.current[colIndex];
    }
    setRemovingCells((previous) => {
      if (!(colIndex in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[colIndex];
      return next;
    });
  }, []);

  const removeLetter = useCallback(
    (index?: number) => {
      if (inputLocked) return;

      let targetIndex: number;
      const guessSnapshot = currentGuessRef.current;
      if (index !== undefined) {
        if (guessSnapshot[index] === null) return;
        targetIndex = index;
      } else {
        const lastFilled = [...guessSnapshot]
          .reverse()
          .findIndex((l) => l !== null);
        if (lastFilled === -1) return;
        targetIndex = guessSnapshot.length - 1 - lastFilled;
      }

      const removedLetter = guessSnapshot[targetIndex];
      if (!removedLetter) return;

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (removeAnimationTimersRef.current[targetIndex]) {
        clearTimeout(removeAnimationTimersRef.current[targetIndex]);
      }

      const next = [...guessSnapshot];
      next[targetIndex] = null;
      setRemovingCells((previous) => ({
        ...previous,
        [targetIndex]: removedLetter.toUpperCase(),
      }));
      replaceCurrentGuess(next);

      removeAnimationTimersRef.current[targetIndex] = setTimeout(
        () => handleRemoveAnimationEnd(targetIndex),
        WORDLE_REMOVE_MS,
      );
    },
    [inputLocked, handleRemoveAnimationEnd, replaceCurrentGuess],
  );

  const clearRow = useCallback(() => {
    if (inputLocked) return;
    clearCurrentGuess();
    triggerShake();
  }, [clearCurrentGuess, inputLocked, triggerShake]);

  const patchWordleCaches = useCallback(
    (result: WordleSubmitResponse, nextGuesses: GuessResult[]) => {
      const questId = questVersionRef.current;

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

      if (questId && result.solved) {
        queryClient.setQueryData<QuestsResponse>(["quests"], (previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            quests: previous.quests.map((quest) =>
              quest.id === questId
                ? {
                    ...quest,
                    completed: true,
                    progress: quest.target,
                  }
                : quest,
            ),
          };
        });
      }

      void queryClient.invalidateQueries({ queryKey: ["quests"] });
    },
    [queryClient, wordleLanguage],
  );

  const claimQuestMutation = useMutation({
    mutationFn: (questId: string) => apiClient.claimQuest({ questId }),
    onSuccess: async (data) => {
      queryClient.setQueryData<QuestsResponse>(["quests"], (previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          quests: previous.quests.map((quest) =>
            quest.id === data.quest.id
              ? {
                  ...quest,
                  completed: data.quest.completed,
                  claimed: data.quest.claimed,
                  progress: quest.target,
                }
              : quest,
          ),
        };
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
      await patchUser({ coins: data.newBalance });
      setMessage(
        t("quests.claimSuccess", {
          amount: data.reward,
        }),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quests"] });
      setMessage(t("quests.claimFailed"));
    },
  });

  const submitGuess = useCallback(async () => {
    if (submitLocked) return;

    const normalizedGuess = currentGuessRef.current
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
      const rowFlipAnimValues = rowFlipAnims[rowIndex];
      const revealTimers: ReturnType<typeof setTimeout>[] = [];

      // Flip reveal: each tile flips in a short sequence so validation feels immediate.
      for (let col = 0; col < WORD_LENGTH; col++) {
        cancelAnimation(rowFlipAnimValues[col]);
        rowFlipAnimValues[col].value = 1;
        const delay = col * WORDLE_REVEAL_STAGGER_MS;
        rowFlipAnimValues[col].value = withDelay(
          delay,
          withSequence(
            withTiming(0, { duration: WORDLE_REVEAL_HALF_MS }),
            withTiming(1, { duration: WORDLE_REVEAL_HALF_MS }),
          ),
        );
        // Flip color at the midpoint (tile is edge-on)
        const timer = setTimeout(() => {
          setTileFaceUp((prev) => new Set([...prev, `${rowIndex}-${col}`]));
        }, delay + WORDLE_REVEAL_HALF_MS);
        revealTimers.push(timer);
      }
      const revealDoneTimer = setTimeout(
        () => {
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
        },
        (WORD_LENGTH - 1) * WORDLE_REVEAL_STAGGER_MS +
          WORDLE_REVEAL_HALF_MS * 2,
      );
      revealTimers.push(revealDoneTimer);
      revealTimersRef.current[rowIndex] = revealTimers;

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
    guesses,
    rowFlipAnims,
    wordleLanguage,
    t,
    triggerShake,
    resetBoardForNewDay,
    patchWordleCaches,
    submitLocked,
  ]);

  // ── Keyboard press helpers ───────────────────────────────────────────────

  const clearActiveKeys = useCallback(() => {
    setActiveKeys([]);
  }, []);

  reactEffect(() => {
    if (!definitionModalVisible) {
      setExpandedDefinitionWord(null);
    }
  }, [definitionModalVisible]);

  reactEffect(() => {
    if (!canShowDefinition && definitionModalVisible) {
      setDefinitionModalVisible(false);
    }
  }, [canShowDefinition, definitionModalVisible]);

  reactEffect(() => {
    const variants = definitionQueryData?.variants ?? [];

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
  }, [definitionQueryData]);

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

  reactEffect(() => {
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

  if ((!wordleLanguageHydrated || stateQueryIsLoading) && !stateQueryData) {
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
        paddingVertical: 16,
        gap: 16,
      }}
      contentInset={{ top: insets.top, bottom: insets.bottom + 8 }}
      scrollIndicatorInsets={{ top: insets.top, bottom: insets.bottom + 8 }}
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
        <Pressable
          onPress={() => router.back()}
          className="w-full rounded-xl overflow-hidden"
        >
          <View className="bg-primary py-2 items-center">
            <Text className="text-white font-nunito-semibold text-sm">
              {t("quests.wordle.backToQuests")}
            </Text>
          </View>
        </Pressable>
      </View>

      <View className="rounded-2xl border-2 border-primaryTint bg-surface p-4 shadow shadow-black/10">
        <Text className="mb-3 text-center text-xs font-nunito-bold uppercase tracking-[1px] text-fgMuted">
          {t("quests.wordle.languageLabel")}
        </Text>
        <View className="flex-row gap-3">
          {WORDLE_LANGUAGE_OPTIONS.map((option) => {
            const selected = wordleLanguage === option;
            return (
              <Pressable
                key={option}
                onPress={() => handleWordleLanguageChange(option)}
                className={`flex-1 rounded-2xl border-2 px-4 py-3 ${selected ? "border-primary bg-primaryTint" : "border-primaryTint bg-bg"}`}
              >
                <Text
                  className={`text-center text-sm font-nunito-bold ${selected ? "text-primaryStrong" : "text-fg"}`}
                >
                  {option === "fr"
                    ? t("quests.wordle.frenchWords")
                    : t("quests.wordle.englishWords")}
                </Text>
              </Pressable>
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
                  const removingLetter = isActiveRow
                    ? removingCells[colIndex]
                    : undefined;
                  const displayLetter = removingLetter ?? letter;
                  const evalState = getTileState(rowIndex, colIndex);
                  const bgBorderCls = tileBgBorderClass(evalState);
                  const letterCls = tileLetterClass(evalState);
                  const isAnimatingRow = animatingRows.has(rowIndex);
                  const isRemovingCell = removingLetter != null;

                  const isTappable =
                    isActiveRow && !!letter && !isRemovingCell && !inputLocked;
                  return (
                    <Pressable
                      key={`${rowIndex}-${colIndex}`}
                      style={{ flex: 1, height: 48 }}
                      onPress={
                        isTappable ? () => removeLetter(colIndex) : undefined
                      }
                      disabled={!isTappable}
                    >
                      <WordleTile
                        bgBorderCls={bgBorderCls}
                        isActiveLetter={isActiveRow && !!letter}
                        isAnimatingRow={isAnimatingRow}
                        isRemovingCell={isRemovingCell}
                        letter={displayLetter}
                        letterCls={letterCls}
                        rowFlipAnim={rowFlipAnims[rowIndex][colIndex]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            );

            if (isActiveRow) {
              return (
                <WordleActiveRow key={rowIndex} shakeAnim={shakeAnim}>
                  {rowTiles}
                </WordleActiveRow>
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

        {claimableQuest ? (
          <QuestActionButton
            label={t("quests.wordle.claimReward", {
              reward: claimableQuest.reward,
            })}
            onPress={() => {
              void claimQuestMutation.mutateAsync(claimableQuest.id);
            }}
            loading={
              claimQuestMutation.isPending &&
              claimQuestMutation.variables === claimableQuest.id
            }
            loadingMode="inline"
            backgroundColor={tc.successDark}
            foregroundColor="#FFFFFF"
            minHeight={48}
            accessibilityLabel={t("quests.claim")}
            testID="wordle-claim-reward"
          />
        ) : null}

        {gameOver ? (
          <QuestActionButton
            label={
              isSharing
                ? t("quests.wordle.sharePreparing")
                : t("quests.wordle.shareResult")
            }
            onPress={() => {
              void handleShareResult();
            }}
            loading={isSharing}
            loadingMode="inline"
            backgroundColor={solved ? tc.successDark : tc.dangerDark}
            foregroundColor="#FFFFFF"
            leadingIcon={ShareIcon}
            minHeight={48}
            testID="wordle-share-result"
          />
        ) : null}

        {canShowDefinition ? (
          <Pressable
            onPress={() => setDefinitionModalVisible(true)}
            className="items-center rounded-xl border-2 border-primaryTint bg-bg px-4 py-3"
          >
            <Text className="text-sm font-nunito-bold text-primaryStrong">
              {t("quests.wordle.showDefinition")}
            </Text>
          </Pressable>
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
                    const pressed = activeKeys.includes(letter) && !inputLocked;
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

            {definitionQueryIsLoading && !definitionQueryData ? (
              <Text className="mt-3 text-sm leading-5 font-nunito text-primaryStrong">
                {t("quests.wordle.definitionLoading")}
              </Text>
            ) : null}

            {definitionQueryError && !definitionQueryData ? (
              <Text className="mt-3 text-sm leading-5 font-nunito text-dangerDark">
                {t("quests.wordle.definitionError")}
              </Text>
            ) : null}

            {definitionQueryData ? (
              <FlatList
                className="mt-3 max-h-[320px]"
                contentContainerStyle={{ gap: 10 }}
                data={definitionQueryData.variants}
                keyExtractor={(variant) => variant.displayWord}
                ListHeaderComponent={
                  <View className="gap-3">
                    <View className="rounded-2xl border border-primaryTint bg-bg px-3 py-2">
                      <Text className="text-xs font-nunito-bold uppercase tracking-[1px] text-fgMuted">
                        {t("quests.wordle.definitionWordLabel")}
                      </Text>
                      <Text className="mt-1 text-base font-nunito-extrabold text-primaryStrong">
                        {definitionQueryData.word}
                      </Text>
                    </View>

                    {definitionQueryData.variants.length > 1 ? (
                      <Text className="text-xs font-nunito-bold uppercase tracking-[1px] text-fgMuted">
                        {t("quests.wordle.definitionChoicesLabel")}
                      </Text>
                    ) : null}
                  </View>
                }
                renderItem={renderDefinitionVariant}
              />
            ) : null}

            <Pressable
              onPress={() => setDefinitionModalVisible(false)}
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
            </Pressable>
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
            <Pressable
              onPress={() => setResetModalKind(null)}
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
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
