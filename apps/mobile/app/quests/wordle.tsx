import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementRef,
} from "react";
import {
  Animated,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { ApiClientError } from "@adventure-time/api-client";
import type { QuestsResponse, WordleStateResponse, WordleSubmitResponse } from "@adventure-time/api-client";
import { apiClient } from "../../src/lib/api";
import { PageLoadingState } from "../../src/components/loading-state";
import { useTranslation } from "../../src/i18n";
import { useQuestResetStore } from "../../src/stores/quest-reset-store";
import { useThemeStore } from "../../src/stores/theme-store";
import { THEME_COLORS, THEME_VARS } from "../../src/theme/themes";

const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;
const QWERTY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const AZERTY_ROWS = ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];
const LETTER_PRIORITY: Record<string, number> = {
  absent: 0,
  present: 1,
  correct: 2,
};

type LetterState = "correct" | "present" | "absent";
type GuessResult = { guess: string; evaluation: LetterState[] };

type KeyLayout = { x: number; y: number; width: number; height: number };

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

export default function WordleScreen() {
  const { t, locale } = useTranslation();
  const themeName = useThemeStore((s) => s.themeName);
  const tc = THEME_COLORS[themeName];
  const lastQuestResetAt = useQuestResetStore((state) => state.lastResetAt);
  const lastQuestResetPayload = useQuestResetStore((state) => state.lastPayload);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

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
  const [removingCellIndex, setRemovingCellIndex] = useState<number | null>(
    null,
  );
  const [animatingRows, setAnimatingRows] = useState<Set<number>>(new Set());
  const [tileFaceUp, setTileFaceUp] = useState<Set<string>>(new Set());

  const attemptsUsed = guesses.length;
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attemptsUsed);
  const gameOver = solved || attemptsUsed >= MAX_ATTEMPTS;
  const inputLocked = gameOver || submitting;
  const submitLocked =
    inputLocked || currentGuess.every((letter) => letter === null);
  const rowClearDisabled = currentGuess.every((l) => l === null) || inputLocked;

  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [rowContainerWidth, setRowContainerWidth] = useState(0);
  const keyLayoutsRef = useRef<Partial<Record<string, KeyLayout>>>({});
  const keyRefs = useRef<
    Partial<Record<string, ElementRef<typeof View> | null>>
  >({});
  const containerRef = useRef<View>(null);
  const activeTouchesRef = useRef<Record<number, string>>({});
  const touchStartYRef = useRef<Record<number, number>>({});
  const touchCountSV = useSharedValue(0);

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
  const questVersionRef = useRef<string | null>(null);
  const resetByNameRef = useRef<string | null>(null);
  const lastHandledResetAtRef = useRef(0);

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

  const clearRevealAnimations = useCallback(() => {
    Object.values(revealTimersRef.current).forEach((timers) => {
      timers.forEach((timer) => clearTimeout(timer));
    });
    revealTimersRef.current = {};
    rowFlipAnimsRef.current = {};
    setAnimatingRows(new Set());
    setTileFaceUp(new Set());
  }, []);

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
    staleTime: 30_000,
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
        setTargetWord(data.targetWord ?? null);
        questVersionRef.current = data.questVersion ?? null;
        return serverDate;
      }

      if (prevDate !== serverDate) {
        // Date changed mid-session (day rollover)
        const hadProgress = guessesRef.current.length > 0;
        clearRevealAnimations();
        setGuesses(data.guesses as GuessResult[]);
        setSolved(data.solved);
        setCurrentGuess(Array(WORD_LENGTH).fill(null));
        setMessage(null);
        setTargetWord(data.targetWord ?? null);
        questVersionRef.current = data.questVersion ?? null;
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
        setCurrentGuess(Array(WORD_LENGTH).fill(null));
        setMessage(null);
        setTargetWord(data.targetWord ?? null);
        questVersionRef.current = data.questVersion ?? null;
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

      return prevDate;
    });
  }, [clearRevealAnimations, lastQuestResetAt, stateQuery.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ──────────────────────────────────────────────────────────────

  const resetBoardForNewDay = useCallback(() => {
    clearRevealAnimations();
    setGuesses([]);
    setCurrentGuess(Array(WORD_LENGTH).fill(null));
    setSolved(false);
    setMessage(null);
    setTargetWord(null);
    setResetModalKind("rollover");
  }, [clearRevealAnimations]);

  const applyImmediateAdminReset = useCallback(
    (resetByName?: string | null) => {
      const hadProgress = guessesRef.current.length > 0 || solvedRef.current;

      clearRevealAnimations();
      setGuesses([]);
      setCurrentGuess(Array(WORD_LENGTH).fill(null));
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
    [clearRevealAnimations],
  );

  useEffect(() => {
    if (!lastQuestResetAt || !lastQuestResetPayload) return;
    if (lastQuestResetAt === lastHandledResetAtRef.current) return;

    if (
      lastQuestResetPayload.questType &&
      lastQuestResetPayload.questType !== "wordle_daily"
    ) {
      return;
    }

    lastHandledResetAtRef.current = lastQuestResetAt;
    applyImmediateAdminReset(lastQuestResetPayload.resetByName);
  }, [
    applyImmediateAdminReset,
    lastQuestResetAt,
    lastQuestResetPayload,
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

      setCurrentGuess(next);
    },
    [inputLocked, popAnims],
  );

  const handleRemoveAnimationEnd = useCallback(
    (colIndex: number) => {
      setCurrentGuess((prev) => {
        const next = [...prev];
        next[colIndex] = null;
        return next;
      });
      setRemovingCellIndex(null);
      removeAnim.scale.setValue(1);
      removeAnim.opacity.setValue(1);
    },
    [removeAnim],
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
    setCurrentGuess(Array(WORD_LENGTH).fill(null));
    triggerShake();
  }, [inputLocked, triggerShake]);

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
    (
      result: WordleSubmitResponse,
      nextGuesses: GuessResult[],
    ) => {
      queryClient.setQueryData<WordleStateResponse>(["wordle"], (previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          date: result.date,
          guesses: nextGuesses,
          solved: result.solved,
          targetWord: result.targetWord ?? previous.targetWord ?? null,
        };
      });

      queryClient.setQueryData<QuestsResponse>(["quests"], (previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          quests: previous.quests.map((quest) => {
            if (quest.type !== "wordle_daily") {
              return quest;
            }

            const attempts_used = nextGuesses.length;
            const completed = result.solved || quest.completed;
            const failed = !completed && attempts_used >= MAX_ATTEMPTS;

            return {
              ...quest,
              progress: completed ? quest.target : attempts_used,
              completed,
              failed,
              attemptsUsed: attempts_used,
            };
          }),
        };
      });
    },
    [queryClient],
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
      setCurrentGuess(Array(WORD_LENGTH).fill(null));
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
    submitLocked,
    currentGuess,
    activeDateKey,
    guesses,
    getRowFlipAnims,
    t,
    triggerShake,
    resetBoardForNewDay,
    patchWordleCaches,
  ]);

  // ── Keyboard gesture helpers ─────────────────────────────────────────────

  const syncActiveKeys = useCallback(() => {
    setActiveKeys(Array.from(new Set(Object.values(activeTouchesRef.current))));
  }, []);

  const clearActiveTouches = useCallback(() => {
    activeTouchesRef.current = {};
    touchStartYRef.current = {};
    setActiveKeys([]);
  }, []);

  const updateKeyLayout = useCallback((keyId: string) => {
    const keyRef = keyRefs.current[keyId];
    if (!keyRef || !containerRef.current) return;
    keyRef.measureLayout(
      containerRef.current,
      (x, y, width, height) => {
        keyLayoutsRef.current[keyId] = { x, y, width, height };
      },
      () => {},
    );
  }, []);

  const findKeyAtPoint = useCallback((x: number, y: number) => {
    const layoutEntries = Object.entries(keyLayoutsRef.current) as Array<
      [string, KeyLayout]
    >;
    return (
      layoutEntries.find(([, layout]) => {
        return (
          x >= layout.x &&
          x <= layout.x + layout.width &&
          y >= layout.y &&
          y <= layout.y + layout.height
        );
      })?.[0] ?? null
    );
  }, []);

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

  const releaseTouches = useCallback(
    (
      touches: Array<{ id: number; x?: number; y?: number }>,
      activate = false,
    ) => {
      let changed = false;
      touches.forEach((touch) => {
        const keyId = activeTouchesRef.current[touch.id];
        if (keyId) {
          if (activate) activateKey(keyId);
          delete activeTouchesRef.current[touch.id];
          delete touchStartYRef.current[touch.id];
          changed = true;
        }
      });
      if (changed) syncActiveKeys();
    },
    [activateKey, syncActiveKeys],
  );

  const handleTouchesDown = useCallback(
    (touches: Array<{ id: number; x: number; y: number }>) => {
      let changed = false;
      touches.forEach((touch) => {
        if (activeTouchesRef.current[touch.id]) return;
        const keyId = findKeyAtPoint(touch.x, touch.y);
        if (!keyId) return;
        activeTouchesRef.current[touch.id] = keyId;
        touchStartYRef.current[touch.id] = touch.y;
        changed = true;
      });
      if (changed) syncActiveKeys();
    },
    [findKeyAtPoint, syncActiveKeys],
  );

  const handleTouchesMove = useCallback(
    (touches: Array<{ id: number; x: number; y: number }>) => {
      const SCROLL_THRESHOLD = 8;
      let changed = false;
      touches.forEach((touch) => {
        const activeKeyId = activeTouchesRef.current[touch.id];
        if (!activeKeyId) return;
        const startY = touchStartYRef.current[touch.id];
        if (
          startY !== undefined &&
          Math.abs(touch.y - startY) > SCROLL_THRESHOLD
        ) {
          delete activeTouchesRef.current[touch.id];
          delete touchStartYRef.current[touch.id];
          changed = true;
          return;
        }
        const currentKeyId = findKeyAtPoint(touch.x, touch.y);
        if (currentKeyId === activeKeyId) return;
        delete activeTouchesRef.current[touch.id];
        delete touchStartYRef.current[touch.id];
        changed = true;
      });
      if (changed) syncActiveKeys();
    },
    [findKeyAtPoint, syncActiveKeys],
  );

  const handleTouchesUp = useCallback(
    (touches: Array<{ id: number }>) => {
      releaseTouches(touches, true);
    },
    [releaseTouches],
  );

  const handleTouchesCancel = useCallback(
    (touches: Array<{ id: number }>) => {
      releaseTouches(touches, false);
    },
    [releaseTouches],
  );

  const keyboardGesture = useMemo(
    () =>
      Gesture.Manual()
        .shouldCancelWhenOutside(false)
        .onTouchesDown((event, manager) => {
          "worklet";
          if (touchCountSV.value === 0) manager.activate();
          touchCountSV.value += event.changedTouches.length;
          runOnJS(handleTouchesDown)(
            event.changedTouches.map((t) => ({ id: t.id, x: t.x, y: t.y })),
          );
        })
        .onTouchesMove((event) => {
          "worklet";
          runOnJS(handleTouchesMove)(
            event.changedTouches.map((t) => ({ id: t.id, x: t.x, y: t.y })),
          );
        })
        .onTouchesUp((event, manager) => {
          "worklet";
          touchCountSV.value = Math.max(
            0,
            touchCountSV.value - event.changedTouches.length,
          );
          runOnJS(handleTouchesUp)(
            event.changedTouches.map((t) => ({ id: t.id })),
          );
          if (touchCountSV.value === 0) manager.end();
        })
        .onTouchesCancelled((event, manager) => {
          "worklet";
          touchCountSV.value = Math.max(
            0,
            touchCountSV.value - event.changedTouches.length,
          );
          runOnJS(handleTouchesCancel)(
            event.changedTouches.map((t) => ({ id: t.id })),
          );
          if (touchCountSV.value === 0) manager.end();
        })
        .onFinalize(() => {
          "worklet";
          touchCountSV.value = 0;
          runOnJS(clearActiveTouches)();
        }),
    [
      handleTouchesDown,
      handleTouchesMove,
      handleTouchesUp,
      handleTouchesCancel,
      clearActiveTouches,
      touchCountSV,
    ],
  );

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

  if (stateQuery.isLoading && !stateQuery.data) {
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
            <Text className="text-primaryText font-nunito-semibold text-sm">
              {t("quests.wordle.backToQuests")}
            </Text>
          </View>
        </TouchableOpacity>
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
      </View>

      {/* ── Keyboard card ───────────────────────────────────────────────── */}
      <GestureDetector gesture={keyboardGesture}>
        <View
          ref={containerRef}
          className="rounded-[28px] border-2 border-primaryTint bg-surface p-3 shadow shadow-black/10"
        >
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
                    {row.split("").map((letter, i) => {
                      const kState = keyboardState[letter];
                      const pressed =
                        activeKeys.includes(letter) && !inputLocked;
                      const keyCls = keyBgBorderClass(kState);
                      return (
                        <View
                          key={letter}
                          ref={(node) => {
                            keyRefs.current[letter] = node;
                          }}
                          onLayout={() => {
                            requestAnimationFrame(() =>
                              updateKeyLayout(letter),
                            );
                          }}
                          className={`h-[56px] rounded-2xl border-2 items-center justify-center shadow shadow-black/10 ${keyCls}`}
                          pointerEvents="none"
                          style={{
                            width: keyWidth || undefined,
                            opacity: inputLocked ? 0.45 : pressed ? 0.82 : 1,
                            transform: [{ scale: pressed ? 0.96 : 1 }],
                          }}
                        >
                          <Text
                            className={`text-sm font-nunito-extrabold ${keyLetterClass(kState)}`}
                          >
                            {letter}
                          </Text>
                        </View>
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
            <View
              ref={(node) => {
                keyRefs.current["CLEAR"] = node;
              }}
              onLayout={() => {
                requestAnimationFrame(() => updateKeyLayout("CLEAR"));
              }}
              pointerEvents="none"
              className="flex-1 h-[56px] rounded-2xl border-2 border-primaryTint bg-surfaceMuted items-center justify-center shadow shadow-black/10"
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
            >
              <Text className="text-xs font-nunito-extrabold text-primaryStrong">
                {t("quests.wordle.clear")}
              </Text>
            </View>

            <View
              ref={(node) => {
                keyRefs.current["SUBMIT"] = node;
              }}
              onLayout={() => {
                requestAnimationFrame(() => updateKeyLayout("SUBMIT"));
              }}
              pointerEvents="none"
              className="flex-1 h-[56px] rounded-2xl overflow-hidden shadow shadow-black/10"
              style={{
                opacity: submitLocked
                  ? 0.4
                  : activeKeys.includes("SUBMIT")
                    ? 0.88
                    : 1,
                transform: [
                  {
                    scale:
                      activeKeys.includes("SUBMIT") && !submitLocked
                        ? 0.96
                        : 1,
                  },
                ],
              }}
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
            </View>
          </View>
        </View>
      </GestureDetector>

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
