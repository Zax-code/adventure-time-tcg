import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
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
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { captureRef } from "react-native-view-shot";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Delete from "lucide-react-native/icons/delete";
import Info from "lucide-react-native/icons/info";

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
import { PageErrorState } from "../../src/components/error-state";
import { PageLoadingState } from "../../src/components/loading-state";
import { Dialog } from "../../src/components/ui/dialog";
import { GameHud } from "../../src/components/ui/game/game-hud";
import { GameKey } from "../../src/components/ui/game/game-key";
import { GAME_CELL_CLASS, type GameCellState } from "../../src/components/ui/game/game-state";
import { SegmentedControl } from "../../src/components/ui/segmented-control";
import { StackHeader } from "../../src/components/ui/stack-header";
import { QuestActionButton } from "../../src/features/quests/quest-action-button";
import { navigateBackFromQuest } from "../../src/features/quests/quest-navigation";
import {
  DEFAULT_QUEST_TIME_ZONE,
  isCurrentQuestDay,
} from "../../src/features/quests/quest-day-cutoff";
import {
  formatQuestShareDate,
  resolveQuestShareDateKey,
} from "../../src/features/quests/quest-share-date";
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
// Game Key widths on board 04: letters 32, Enter 56, Delete 44, 4 apart.
const KEY_GAP = 4;
const LETTER_KEY_UNITS = 32;
const DELETE_KEY_UNITS = 44;
const KEY_HEIGHT = 40;
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

const HELP_LEGEND = [
  { state: "correct", letter: "A", key: "quests.wordle.helpCorrect" },
  { state: "present", letter: "B", key: "quests.wordle.helpPresent" },
  { state: "absent", letter: "C", key: "quests.wordle.helpAbsent" },
] as const satisfies readonly {
  state: GameCellState;
  letter: string;
  key: string;
}[];

function keyPressStyle(
  pressed: boolean,
  width: number | undefined,
): StyleProp<ViewStyle> {
  return {
    width,
    height: KEY_HEIGHT,
    opacity: pressed ? 0.82 : undefined,
    transform: [{ scale: pressed ? 0.96 : 1 }],
  };
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
  const questTimeZone = useSessionStore(
    (state) => state.user?.timezone ?? DEFAULT_QUEST_TIME_ZONE,
  );
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
  const [helpVisible, setHelpVisible] = useState(false);
  const [expandedDefinitionWord, setExpandedDefinitionWord] = useState<
    string | null
  >(null);
  const [removingCells, setRemovingCells] = useState<Record<number, string>>(
    {},
  );
  const [animatingRows, setAnimatingRows] = useState<Set<number>>(new Set());
  const [tileFaceUp, setTileFaceUp] = useState<Set<string>>(new Set());
  const [isSharing, setIsSharing] = useState(false);
  const [shareDateKey, setShareDateKey] = useState(() =>
    resolveQuestShareDateKey({ questDateKey: null }),
  );
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
  const activeKeySet = useMemo(() => new Set(activeKeys), [activeKeys]);
  const [rowContainerWidth, setRowContainerWidth] = useState(0);

  // Stable refs for async closures
  const guessesRef = useRef(guesses);
  const solvedRef = useRef(solved);
  const currentGuessRef = useRef(currentGuess);
  const targetWordRef = useRef(targetWord);
  const submittingRef = useRef(submitting);
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

  useEffect(() => {
    guessesRef.current = guesses;
    solvedRef.current = solved;
    currentGuessRef.current = currentGuess;
    targetWordRef.current = targetWord;
    submittingRef.current = submitting;
  }, [currentGuess, guesses, solved, submitting, targetWord]);

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
        date: shareDateKey,
        wordLocale: wordleLanguage,
        solved,
        maxAttempts: MAX_ATTEMPTS,
        wordLength: WORD_LENGTH,
        evaluations: guesses.map((guess) => guess.evaluation),
      }),
    [guesses, solved, shareDateKey, t, wordleLanguage],
  );

  const wordleShareStrings = useMemo(
    () => ({
      brand: t("quests.wordle.shareBrand"),
      footer: t("quests.wordle.shareFooter"),
      date: formatQuestShareDate(shareDateKey, locale),
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
    [t, locale, shareDateKey, wordleLanguage, solved, attemptsUsed],
  );

  // ── API ──────────────────────────────────────────────────────────────────

  const {
    data: stateQueryData,
    error: stateQueryError,
    isError: stateQueryIsError,
    isLoading: stateQueryIsLoading,
    refetch: refetchWordleState,
  } = useQuery({
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

  useEffect(() => {
    const data = stateQueryData;
    if (!data) return;

    const serverDate = data.date;
    const localeChanged = activeWordleLanguageRef.current !== data.locale;

    if (!activeDateKey || localeChanged) {
      // Initial load
      clearRevealAnimations();
      setGuesses(data.guesses as GuessResult[]);
      setSolved(data.solved);
      clearCurrentGuess();
      setMessage(null);
      setTargetWord(data.targetWord ?? null);
      questVersionRef.current = data.questVersion ?? null;
      activeWordleLanguageRef.current = data.locale;
      setActiveDateKey(serverDate);
      return;
    }

    if (activeDateKey !== serverDate) {
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
      setActiveDateKey(serverDate);
      return;
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
      return;
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
      return;
    }

    if (busy || hasDraft) {
      questVersionRef.current = data.questVersion ?? null;
      return;
    }

    // Same date — sync if server is ahead and local UI is idle
    setGuesses(data.guesses as GuessResult[]);
    setSolved(data.solved);
    setTargetWord(data.targetWord ?? null);
    questVersionRef.current = data.questVersion ?? null;
    activeWordleLanguageRef.current = data.locale;
  }, [
    activeDateKey,
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

      if (!isCurrentQuestDay(result.date, questTimeZone)) {
        return;
      }

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
      setSubmitting(false);
    }
  }, [
    activeDateKey,
    clearCurrentGuess,
    guesses,
    rowFlipAnims,
    questTimeZone,
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
      appliedLanguageParamRef.current = nextLanguage;
      void setWordleLanguage(nextLanguage);
      router.setParams({ language: nextLanguage });
    },
    [
      clearActiveKeys,
      clearCurrentGuess,
      clearRevealAnimations,
      router,
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
        // Delete removes one letter, like a backspace; removeLetter owns the
        // haptic and the tile remove animation.
        if (rowClearDisabled) return;
        removeLetter();
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
      removeLetter,
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

    const currentShareDateKey = resolveQuestShareDateKey({
      questDateKey: activeDateKey,
    });
    setShareDateKey(currentShareDateKey);
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
        const fileName = buildWordleShareFileName({
          ...wordleShareResult,
          date: currentShareDateKey,
        });
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
  }, [activeDateKey, isSharing, t, wordleShareResult]);

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

  if (stateQueryIsError && !stateQueryData) {
    return (
      <PageErrorState
        error={stateQueryError}
        title={t("quests.wordle.tryAgain")}
        onRetry={() => {
          void refetchWordleState();
        }}
        onBack={() => navigateBackFromQuest(router, "/(tabs)/quests")}
        backLabel={t("quests.wordle.backToQuests")}
      />
    );
  }

  const languageOptions = WORDLE_LANGUAGE_OPTIONS.map((option) => ({
    value: option,
    label:
      option === "fr"
        ? t("quests.wordle.frenchWords")
        : t("quests.wordle.englishWords"),
    testID: `wordle-language-${option}`,
  }));

  const maxRowKeys = Math.max(...keyboardRows.map((row) => row.length));
  const keyWidth =
    rowContainerWidth > 0
      ? Math.floor(
          (rowContainerWidth - (maxRowKeys - 1) * KEY_GAP) / maxRowKeys,
        )
      : 0;

  const renderLetterKey = (letter: string) => {
    const pressed = activeKeySet.has(letter) && !inputLocked;
    return (
      <GameKey
        key={letter}
        label={letter}
        state={keyboardState[letter] ?? "empty"}
        accessibilityLabel={`wordle-key-${letter}`}
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
        style={keyPressStyle(pressed, keyWidth || undefined)}
        testID={`wordle-key-${letter}`}
      />
    );
  };

  const renderActionKeys = () => {
    const deleteWidth = keyWidth
      ? Math.round((keyWidth * DELETE_KEY_UNITS) / LETTER_KEY_UNITS)
      : undefined;
    const enterPressed = activeKeySet.has("SUBMIT") && !submitLocked;
    const deletePressed = activeKeySet.has("CLEAR") && !rowClearDisabled;

    return {
      enter: (
        <GameKey
          key="SUBMIT"
          kind="enter"
          label={submitting ? "…" : t("quests.wordle.enter")}
          accessibilityLabel="wordle-key-SUBMIT"
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
          style={keyPressStyle(enterPressed, undefined)}
          testID="wordle-key-SUBMIT"
        />
      ),
      delete: (
        <GameKey
          key="CLEAR"
          kind="delete"
          label={t("quests.wordle.delete")}
          icon={Delete}
          accessibilityLabel="wordle-key-CLEAR"
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
          style={keyPressStyle(deletePressed, deleteWidth)}
          testID="wordle-key-CLEAR"
        />
      ),
    };
  };

  const submitAndDelete = renderActionKeys();

  const showStatus =
    message !== null ||
    (gameOver && !solved && targetWord !== null) ||
    claimableQuest !== null ||
    gameOver;

  return (
    <View className="flex-1 bg-bg" style={THEME_VARS[themeName]}>
      <View style={{ paddingTop: insets.top }}>
        <StackHeader
          title={t("quests.wordle.title")}
          backLabel={t("quests.wordle.backToQuests")}
          backTestID="wordle-back"
          onBack={() => navigateBackFromQuest(router, "/(tabs)/quests")}
          trailing={{
            icon: Info,
            accessibilityLabel: t("quests.wordle.helpButton"),
            onPress: () => setHelpVisible(true),
            testID: "wordle-help-button",
          }}
        />
      </View>

      <ScrollView
        className="flex-1 bg-bg"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 24,
          gap: 12,
        }}
        contentInset={{ bottom: insets.bottom }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <SegmentedControl
          options={languageOptions}
          value={wordleLanguage}
          onChange={handleWordleLanguageChange}
          testID="wordle-language"
        />

        <GameHud
          testID="wordle-hud"
          left={{
            value: `${solved ? attemptsUsed : attemptsLeft} / ${MAX_ATTEMPTS}`,
            label: solved
              ? t("quests.wordle.attemptsUsed")
              : t("quests.wordle.attempts"),
            testID: "wordle-attempts",
          }}
          right={
            currentWordleQuest
              ? {
                  value: currentWordleQuest.reward,
                  label: t("quests.wordle.reward"),
                  testID: "wordle-reward",
                }
              : undefined
          }
          progress={attemptsUsed / MAX_ATTEMPTS}
        />

        {/* ── Board ───────────────────────────────────────────────────────── */}
        <View className="items-center gap-[6px]">
          {Array.from({ length: MAX_ATTEMPTS }).map((_, rowIndex) => {
            const rowGuess = guesses[rowIndex];
            const isActiveRow = rowIndex === attemptsUsed && !rowGuess;
            const letters: string[] = rowGuess
              ? rowGuess.guess.split("")
              : isActiveRow
                ? currentGuess.map((l) => l?.toUpperCase() ?? "")
                : Array<string>(WORD_LENGTH).fill("");

            const rowTiles = (
              <View className="flex-row gap-[6px]">
                {letters.map((letter, colIndex) => {
                  const removingLetter = isActiveRow
                    ? removingCells[colIndex]
                    : undefined;
                  const displayLetter = removingLetter ?? letter;
                  const evalState = getTileState(rowIndex, colIndex);
                  const tileState: GameCellState =
                    evalState ?? (displayLetter ? "filled" : "empty");
                  const bgBorderCls = GAME_CELL_CLASS[tileState].container;
                  const letterCls = GAME_CELL_CLASS[tileState].text;
                  const isAnimatingRow = animatingRows.has(rowIndex);
                  const isRemovingCell = removingLetter != null;

                  const isTappable =
                    isActiveRow &&
                    !!letter &&
                    !isRemovingCell &&
                    !inputLocked;
                  return (
                    <Pressable
                      key={`${rowIndex}-${colIndex}`}
                      className="h-[50px] w-[50px]"
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

        {showStatus ? (
          <View className="gap-ds-3">
            {message !== null ? (
              <Text
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                className="text-center font-nunito-bold text-ds-sm text-primaryText"
              >
                {message}
              </Text>
            ) : null}

            {gameOver && !solved && targetWord !== null ? (
              <Text className="text-center font-nunito-bold text-ds-sm text-dangerDark">
                {t("quests.wordle.revealedWord", { word: targetWord })}
              </Text>
            ) : null}

            {claimableQuest ? (
              <QuestActionButton
                tone="secondary"
                label={t("quests.wordle.claimReward", {
                  reward: claimableQuest.reward,
                })}
                onPress={() => {
                  claimQuestMutation.mutate(claimableQuest.id);
                }}
                loading={
                  claimQuestMutation.isPending &&
                  claimQuestMutation.variables === claimableQuest.id
                }
                loadingMode="inline"
                accessibilityLabel={t("quests.wordle.claimReward", {
                  reward: claimableQuest.reward,
                })}
                testID="wordle-claim-reward"
              />
            ) : null}

            {gameOver ? (
              <View className="flex-row gap-ds-3">
                <QuestActionButton
                  tone="ghost"
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
                  leadingIcon={ShareIcon}
                  style={{ flex: 1 }}
                  testID="wordle-share-result"
                />
                <QuestActionButton
                  tone="ghost"
                  label={t("quests.wordle.showDefinition")}
                  onPress={() => setDefinitionModalVisible(true)}
                  style={{ flex: 1 }}
                  testID="wordle-show-definition"
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Keyboard ────────────────────────────────────────────────────── */}
        <View
          onLayout={(e) => setRowContainerWidth(e.nativeEvent.layout.width)}
          className="gap-[6px]"
        >
          {keyboardRows.map((row, rowIdx) => {
            const isLastRow = rowIdx === keyboardRows.length - 1;
            const letterKeys = row.split("").map(renderLetterKey);
            return (
              <View key={row} className="flex-row justify-center gap-ds-1">
                {letterKeys}
                {isLastRow ? submitAndDelete.delete : null}
              </View>
            );
          })}
          {submitAndDelete.enter}
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
      </ScrollView>

      <Dialog
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        icon={Info}
        title={t("quests.wordle.helpTitle")}
        body={t("quests.wordle.helpBody")}
        confirm={{
          label: t("quests.wordle.helpClose"),
          onPress: () => setHelpVisible(false),
          testID: "wordle-help-close",
        }}
        testID="wordle-help-dialog"
      >
        <View className="gap-ds-2">
          {HELP_LEGEND.map(({ state, letter, key }) => (
            <View key={state} className="flex-row items-center gap-ds-3">
              <View
                className={`h-[32px] w-[32px] items-center justify-center rounded-ds-sm border ${GAME_CELL_CLASS[state].container}`}
              >
                <Text
                  className={`font-nunito-extrabold text-ds-body ${GAME_CELL_CLASS[state].text}`}
                >
                  {letter}
                </Text>
              </View>
              <Text className="flex-1 font-nunito text-ds-sm text-fg">
                {t(key)}
              </Text>
            </View>
          ))}
          <Text className="font-nunito text-ds-sm text-fgMuted">
            {t("quests.wordle.helpKeys")}
          </Text>
        </View>
      </Dialog>

      <Dialog
        visible={definitionModalVisible}
        onClose={() => setDefinitionModalVisible(false)}
        title={t("quests.wordle.definitionTitle")}
        confirm={{
          label: t("quests.wordle.definitionClose"),
          onPress: () => setDefinitionModalVisible(false),
        }}
        testID="wordle-definition-dialog"
      >
        {definitionQueryIsLoading && !definitionQueryData ? (
          <Text className="text-center font-nunito text-ds-sm text-fgMuted">
            {t("quests.wordle.definitionLoading")}
          </Text>
        ) : null}

        {definitionQueryError && !definitionQueryData ? (
          <Text className="text-center font-nunito text-ds-sm text-dangerDark">
            {t("quests.wordle.definitionError")}
          </Text>
        ) : null}

        {definitionQueryData ? (
          <FlatList
            className="max-h-[320px]"
            contentContainerStyle={{ gap: 10 }}
            data={definitionQueryData.variants}
            keyExtractor={(variant) => variant.displayWord}
            ListHeaderComponent={
              <View className="gap-ds-3">
                <View className="rounded-ds-md border border-primaryBorder bg-bg px-ds-3 py-ds-2">
                  <Text className="text-ds-overline font-nunito-bold uppercase tracking-[1px] text-fgMuted">
                    {t("quests.wordle.definitionWordLabel")}
                  </Text>
                  <Text className="mt-1 text-base font-nunito-extrabold text-primaryText">
                    {definitionQueryData.word}
                  </Text>
                </View>

                {definitionQueryData.variants.length > 1 ? (
                  <Text className="text-ds-overline font-nunito-bold uppercase tracking-[1px] text-fgMuted">
                    {t("quests.wordle.definitionChoicesLabel")}
                  </Text>
                ) : null}
              </View>
            }
            renderItem={renderDefinitionVariant}
          />
        ) : null}
      </Dialog>

      {/* ── Reset dialog ──────────────────────────────────────────────────── */}
      <Dialog
        visible={resetModalKind !== null}
        onClose={() => setResetModalKind(null)}
        title={
          resetModalKind === "admin"
            ? t("quests.wordle.adminResetTitle")
            : t("quests.wordle.resetTitle")
        }
        body={
          resetModalKind === "admin"
            ? t("quests.wordle.adminResetBody", {
                name:
                  resetByNameRef.current ??
                  (locale === "fr" ? "un administrateur" : "an admin"),
              })
            : t("quests.wordle.resetBody")
        }
        confirm={{
          label: t("quests.wordle.resetCta"),
          onPress: () => setResetModalKind(null),
        }}
      />
    </View>
  );
}
