import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  AccessibilityInfo,
  AppState,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import Archive from "lucide-react-native/icons/archive";
import Check from "lucide-react-native/icons/check";
import RotateCcwClock from "lucide-react-native/icons/rotate-ccw-clock";

import {
  ApiClientError,
  type DailyNumbersArchiveStateResponse,
  type DailyNumbersMode,
  type DailyNumbersSolutionListItem,
  type DailyNumbersSolutionHuntSubmitResponse,
  type DailyNumbersStateResponse,
  type DailyNumbersStep,
  type DailyNumbersStepInput,
} from "@adventure-time/api-client";

import { PageErrorState } from "../../src/components/error-state";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  CoinIcon,
  EyeIcon,
  RecycleIcon,
  ShareIcon,
  SkipBackIcon,
} from "../../src/components/icons";
import { PageLoadingState } from "../../src/components/loading-state";
import { Button } from "../../src/components/ui/button";
import { Card } from "../../src/components/ui/card";
import { KeypadKey } from "../../src/components/ui/game/keypad-key";
import { Notice } from "../../src/components/ui/notice";
import { SegmentedControl } from "../../src/components/ui/segmented-control";
import { StackHeader } from "../../src/components/ui/stack-header";
import { StatTile } from "../../src/components/ui/stat-tile";
import { DailyNumbersQuestShareCard } from "../../src/features/quests/daily-numbers/quest-share-card";
import {
  applyDailyNumbersOperation,
  getDailyNumbersOperatorAvailability,
  getDailyNumbersOperatorPressResult,
  getDailyNumbersTileAvailability,
  type DailyNumbersOperator,
} from "../../src/features/quests/daily-numbers/board-interaction";
import {
  buildDailyNumbersShareFileName,
  buildDailyNumbersShareResult,
} from "../../src/features/quests/daily-numbers/share-result";
import {
  DAILY_NUMBERS_MODES,
  formatDailyNumbersElapsedTime,
  getModeAccent,
  getModeLabelKey,
  getModeStatusLabel,
  getQuestTypeForMode,
} from "../../src/features/quests/daily-numbers/shared";
import { QuestActionButton } from "../../src/features/quests/quest-action-button";
import {
  DEFAULT_QUEST_TIME_ZONE,
  isCurrentQuestDay,
} from "../../src/features/quests/quest-day-cutoff";
import {
  formatQuestShareDate,
  resolveQuestShareDateKey,
} from "../../src/features/quests/quest-share-date";
import { navigateBackFromQuest } from "../../src/features/quests/quest-navigation";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";
import { useQuestResetStore } from "../../src/stores/quest-reset-store";
import { useSessionStore } from "../../src/stores/session-store";
import { useThemeStore } from "../../src/stores/theme-store";
import { THEME_COLORS } from "../../src/theme/themes";

type BoardTile = {
  id: string;
  value: number;
  source: "initial" | "derived";
  status: "available" | "used";
};

type MessageState = { type: "success" | "error"; text: string } | null;
type Operator = DailyNumbersOperator;
type PreviewState =
  | { kind: "empty" }
  | { kind: "invalid"; reason: "division" | "positive" }
  | { kind: "ready"; result: number };
type TranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;
type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
type DailyNumbersBoardState =
  DailyNumbersStateResponse | DailyNumbersArchiveStateResponse;
type DailyNumbersSolutionLists = Pick<
  DailyNumbersSolutionHuntSubmitResponse,
  | "solutionsFound"
  | "totalSolutions"
  | "allSolutionsFound"
  | "yourSolutions"
  | "otherSolutions"
>;
type ModeCard = {
  mode: DailyNumbersMode;
  state: DailyNumbersBoardState | undefined;
  isLoading: boolean;
};
type SlotKey = "left" | "operator" | "right";
type BoardInteractionState = {
  steps: DailyNumbersStep[];
  selectedLeftId: string | null;
  selectedOperator: Operator | null;
  selectedRightId: string | null;
  message: MessageState;
  submitting: boolean;
  revealedSolution: boolean;
  retrying: boolean;
  retryAttempt: number;
  solutionHuntResult: DailyNumbersSolutionHuntSubmitResponse | null;
};
type BoardAction =
  | { type: "selectTile"; tileId: string }
  | { type: "toggleOperator"; operator: Operator }
  | { type: "clearSlot"; slot: SlotKey }
  | { type: "applyStep"; step: DailyNumbersStep; autoSubmitting: boolean }
  | { type: "undoStep" }
  | { type: "resetBoard" }
  | { type: "setMessage"; message: MessageState }
  | { type: "submitStarted" }
  | { type: "submitFailed"; message: MessageState }
  | { type: "submitFinished" }
  | {
      type: "solutionHuntSubmitted";
      result: DailyNumbersSolutionHuntSubmitResponse;
    }
  | { type: "startRetry" }
  | { type: "toggleSolution" };
type FinishStateProps = {
  claimable: boolean;
  claimPending: boolean;
  compact: boolean;
  exactHitState: boolean;
  finishCompleted: boolean;
  finishDistance: number | null;
  finishScore: number | null;
  finishValue: number | null;
  formattedElapsedTime: string;
  interaction: BoardInteractionState;
  isSharing: boolean;
  archiveMode: boolean;
  canRetryArchive: boolean;
  onClaimReward: () => void;
  onShareResult: () => void;
  onStartRetry: () => void;
  onStartSolutionHunt: () => void;
  onToggleSolution: () => void;
  state: DailyNumbersBoardState;
  submittedSolutionSteps: DailyNumbersStep[];
  officialSolutionSteps: DailyNumbersStep[];
  t: TranslateFn;
  tc: ThemeColors;
};
type LivePlayProps = {
  availableTiles: BoardTile[];
  interactionLocked: boolean;
  localSteps: DailyNumbersStep[];
  onApplyStep: () => void;
  onClearSlot: (slot: SlotKey) => void;
  onOperatorPress: (operator: Operator) => void;
  onResetBoard: () => void;
  onSubmitPress: () => void;
  onTilePress: (tileId: string) => void;
  onToggleSolution: () => void;
  onUndoStep: () => void;
  archiveMode: boolean;
  officialSolutionSteps: DailyNumbersStep[];
  revealedSolution: boolean;
  previewState: PreviewState;
  selectedLeftTile: BoardTile | null;
  selectedOperator: Operator | null;
  selectedRightTile: BoardTile | null;
  submitting: boolean;
  target: number;
  t: TranslateFn;
  tc: ThemeColors;
};
type AvailableNumbersGridProps = {
  availableTiles: BoardTile[];
  committingResultId: string | null;
  committingTileIds: ReadonlySet<string>;
  futureResultRef: RefObject<View | null>;
  interactionLocked: boolean;
  onTileRef: (tileId: string, node: View | null) => void;
  onTilePress: (tileId: string) => void;
  selectedLeftTile: BoardTile | null;
  selectedOperator: Operator | null;
  selectedRightTile: BoardTile | null;
  t: TranslateFn;
};
type MeasuredRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type ResultCommitAnimation = {
  leftId: string;
  leftRect: MeasuredRect;
  leftValue: number;
  resultRect: MeasuredRect;
  resultId: string;
  resultValue: number;
  rightId: string;
  rightRect: MeasuredRect;
  rightValue: number;
  targetRect: MeasuredRect;
};
type OperatorPickerProps = {
  interactionLocked: boolean;
  onOperatorPress: (operator: Operator) => void;
  selectedLeftTile: BoardTile | null;
  selectedOperator: Operator | null;
  selectedRightTile: BoardTile | null;
  t: TranslateFn;
};

const OPERATORS: Operator[] = ["+", "-", "*", "/"];
const EXACT_HIT_PERCENT = 100;
const CHRONOMETER_STORAGE_PREFIX = "dailyNumbersChronometer";
const CHRONOMETER_SAVE_INTERVAL_MS = 5000;
const SECURE_STORE_KEY_UNSAFE_CHARS = /[^A-Za-z0-9._-]/g;

function isArchiveState(
  state: DailyNumbersBoardState,
): state is DailyNumbersArchiveStateResponse {
  return "archive" in state && state.archive === true;
}

function buildChronometerStorageKey(
  state: DailyNumbersBoardState,
  attemptScope: string,
) {
  return [
    CHRONOMETER_STORAGE_PREFIX,
    isArchiveState(state) ? "archive" : "daily",
    state.date,
    state.mode,
    state.questVersion ?? "no-version",
    attemptScope,
  ]
    .map((part) => part.replace(SECURE_STORE_KEY_UNSAFE_CHARS, "_"))
    .join(".");
}

function parseStoredElapsedMs(value: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeDailyNumbersMode(mode: string | undefined): DailyNumbersMode {
  if (mode === "1-5" || mode === "2-4" || mode === "3-3") {
    return mode;
  }

  if (mode === "expert") {
    return "3-3";
  }

  if (mode === "balanced") {
    return "2-4";
  }

  return "1-5";
}

function normalizeArchiveDateParam(dateKey: string | undefined) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }

  return dateKey;
}

function triggerSelectionHaptic() {
  void Haptics.selectionAsync();
}

function triggerLightHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function triggerPrimaryHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

function triggerErrorHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

function sortTiles(a: BoardTile, b: BoardTile) {
  if (a.status !== b.status) {
    return a.status === "available" ? -1 : 1;
  }

  return a.id.localeCompare(b.id);
}

function buildBoard(
  numbers: DailyNumbersBoardState["numbers"],
  steps: DailyNumbersStep[],
) {
  const tiles = new Map<string, BoardTile>(
    numbers.map((tile) => [
      tile.id,
      {
        ...tile,
        status: "available" as const,
      } satisfies BoardTile,
    ]),
  );

  const availableIds = new Set(numbers.map((tile) => tile.id));

  for (const step of steps) {
    const left = tiles.get(step.leftId);
    const right = tiles.get(step.rightId);

    if (!left || !right) {
      continue;
    }

    left.status = "used";
    right.status = "used";
    availableIds.delete(step.leftId);
    availableIds.delete(step.rightId);

    tiles.set(step.resultId, {
      id: step.resultId,
      value: step.resultValue,
      source: "derived",
      status: "available",
    });
    availableIds.add(step.resultId);
  }

  const allTiles = Array.from(tiles.values()).sort(sortTiles);
  const availableTiles = allTiles.filter((tile) => availableIds.has(tile.id));
  const usedTiles = allTiles.filter((tile) => !availableIds.has(tile.id));

  return { allTiles, availableTiles, usedTiles };
}

function chooseClosestTile(tiles: BoardTile[], target: number) {
  return tiles.reduce((best, candidate) => {
    const bestDistance = Math.abs(best.value - target);
    const candidateDistance = Math.abs(candidate.value - target);

    if (candidateDistance < bestDistance) {
      return candidate;
    }

    if (candidateDistance > bestDistance) {
      return best;
    }

    if (candidate.value < best.value) {
      return candidate;
    }

    if (candidate.value > best.value) {
      return best;
    }

    return candidate.id.localeCompare(best.id) < 0 ? candidate : best;
  });
}

function getDefaultDistance(
  numbers: DailyNumbersBoardState["numbers"],
  target: number,
) {
  return Math.abs(chooseClosestTile(numbers, target).value - target);
}

function toStepInputs(steps: DailyNumbersStep[]): DailyNumbersStepInput[] {
  return steps.map(({ leftId, operator, rightId, resultId }) => ({
    leftId,
    operator,
    rightId,
    resultId,
  }));
}

function displayOperator(operator: Operator) {
  return operator === "*" ? "×" : operator === "/" ? "÷" : operator;
}

// Keypad Key metrics (board 02): 56 high, radius 16, 24/800 numbers.
const BOARD_NUMBER_TEXT_CLASS = "text-[24px] leading-[29px]";
const BOARD_TILE_HEIGHT_CLASS = "h-[56px]";

const BOARD_TILE_WIDTH = "31.5%";

function measureView(view: View): Promise<MeasuredRect> {
  return new Promise((resolve, reject) => {
    view.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        reject(new Error("Daily Numbers animation target is not measurable."));
        return;
      }

      resolve({ x, y, width, height });
    });
  });
}

function relativeRect(
  rect: MeasuredRect,
  rootRect: MeasuredRect,
): MeasuredRect {
  return {
    x: rect.x - rootRect.x,
    y: rect.y - rootRect.y,
    width: rect.width,
    height: rect.height,
  };
}

function buildPuzzleIdentity(state: DailyNumbersBoardState) {
  const numbersIdentity = state.numbers
    .map((tile) => `${tile.id}:${tile.value}`)
    .join("|");

  return [
    state.mode,
    state.date,
    isArchiveState(state) ? "archive" : "daily",
    state.questVersion ?? "no-version",
    numbersIdentity,
  ].join(":");
}

function buildBoardIdentity(state: DailyNumbersBoardState) {
  return [
    buildPuzzleIdentity(state),
    state.submitted ? "submitted" : "fresh",
    state.submission?.finalValue ?? "no-result",
    state.submission?.elapsedMs ?? "no-time",
  ].join(":");
}

function createBoardInteractionState(
  state: DailyNumbersBoardState,
): BoardInteractionState {
  return {
    steps: state.submission?.steps ?? [],
    selectedLeftId: null,
    selectedOperator: null,
    selectedRightId: null,
    message: null,
    submitting: false,
    revealedSolution: false,
    retrying: false,
    retryAttempt: 0,
    solutionHuntResult: null,
  };
}

function boardReducer(
  state: BoardInteractionState,
  action: BoardAction,
): BoardInteractionState {
  if (action.type === "selectTile") {
    if (action.tileId === state.selectedLeftId) {
      return {
        ...state,
        selectedLeftId: null,
        message: null,
      };
    }

    if (action.tileId === state.selectedRightId) {
      return {
        ...state,
        selectedRightId: null,
        message: null,
      };
    }

    if (!state.selectedLeftId) {
      return {
        ...state,
        selectedLeftId: action.tileId,
        message: null,
      };
    }

    if (!state.selectedRightId) {
      return {
        ...state,
        selectedRightId: action.tileId,
        message: null,
      };
    }

    return state;
  }

  if (action.type === "toggleOperator") {
    return {
      ...state,
      selectedOperator:
        state.selectedOperator === action.operator ? null : action.operator,
      message: null,
    };
  }

  if (action.type === "clearSlot") {
    if (action.slot === "left") {
      return {
        ...state,
        selectedLeftId: null,
        message: null,
      };
    }

    if (action.slot === "operator") {
      return {
        ...state,
        selectedOperator: null,
        message: null,
      };
    }

    return {
      ...state,
      selectedRightId: null,
      message: null,
    };
  }

  if (action.type === "applyStep") {
    return {
      ...state,
      steps: [...state.steps, action.step],
      selectedLeftId: null,
      selectedOperator: null,
      selectedRightId: null,
      message: null,
      submitting: action.autoSubmitting,
    };
  }

  if (action.type === "undoStep") {
    return {
      ...state,
      steps: state.steps.slice(0, -1),
      selectedLeftId: null,
      selectedOperator: null,
      selectedRightId: null,
      message: null,
    };
  }

  if (action.type === "resetBoard") {
    return {
      ...state,
      steps: [],
      selectedLeftId: null,
      selectedOperator: null,
      selectedRightId: null,
      message: null,
    };
  }

  if (action.type === "setMessage") {
    return {
      ...state,
      message: action.message,
    };
  }

  if (action.type === "submitStarted") {
    return {
      ...state,
      submitting: true,
      message: null,
    };
  }

  if (action.type === "submitFailed") {
    return {
      ...state,
      submitting: false,
      message: action.message,
    };
  }

  if (action.type === "submitFinished") {
    return {
      ...state,
      submitting: false,
      retrying: false,
    };
  }

  if (action.type === "solutionHuntSubmitted") {
    return {
      ...state,
      submitting: false,
      retrying: false,
      solutionHuntResult: action.result,
    };
  }

  if (action.type === "startRetry") {
    return {
      steps: [],
      selectedLeftId: null,
      selectedOperator: null,
      selectedRightId: null,
      message: null,
      submitting: false,
      revealedSolution: false,
      retrying: true,
      retryAttempt: state.retryAttempt + 1,
      solutionHuntResult: state.solutionHuntResult,
    };
  }

  return {
    ...state,
    revealedSolution: !state.revealedSolution,
  };
}

const RANKED_START_STORAGE_PREFIX = "dailyNumbersRankedStart";
const rankedStartsThisLaunch = new Set<string>();

/**
 * Opens the server-timed ranked session the first time the official board is on
 * screen for a date and mode. It is integrity evidence only: the score keeps using
 * the paused-when-hidden chronometer, and failures never block play.
 */
function useDailyNumbersRankedSessionStart({
  enabled,
  date,
  mode,
}: {
  enabled: boolean;
  date: string;
  mode: DailyNumbersMode;
}) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const key = [RANKED_START_STORAGE_PREFIX, date, mode]
      .map((part) => part.replace(SECURE_STORE_KEY_UNSAFE_CHARS, "_"))
      .join(".");

    if (rankedStartsThisLaunch.has(key)) {
      return;
    }
    rankedStartsThisLaunch.add(key);

    void (async () => {
      if ((await SecureStore.getItemAsync(key).catch(() => null)) === "1") {
        return;
      }

      try {
        await apiClient.startDailyNumbersRanked(mode);
        await SecureStore.setItemAsync(key, "1").catch(() => undefined);
      } catch {
        // Offline or server error: the submission is accepted without a session.
        rankedStartsThisLaunch.delete(key);
      }
    })();
  }, [date, enabled, mode]);
}

function useDailyNumbersChronometer({
  active,
  attemptScope,
  resetSignal,
  submitted,
  state,
}: {
  active: boolean;
  attemptScope: string;
  resetSignal: number;
  submitted: boolean;
  state: DailyNumbersBoardState;
}) {
  const storageKey = buildChronometerStorageKey(state, attemptScope);
  const submittedElapsedMs = submitted ? (state.submission?.elapsedMs ?? 0) : 0;
  const [, forceTick] = useReducer((value: number) => value + 1, 0);
  const elapsedMsRef = useRef(submittedElapsedMs);
  const startedAtRef = useRef<number | null>(null);
  const lastSavedAtRef = useRef(0);

  const getElapsedMs = useCallback(() => {
    const startedAt = startedAtRef.current;
    if (startedAt === null) {
      return elapsedMsRef.current;
    }

    return elapsedMsRef.current + Date.now() - startedAt;
  }, []);

  const saveElapsedMs = useCallback(
    (nextElapsedMs: number) => {
      lastSavedAtRef.current = Date.now();
      void SecureStore.setItemAsync(
        storageKey,
        String(Math.max(0, nextElapsedMs)),
      );
    },
    [storageKey],
  );

  useEffect(() => {
    let cancelled = false;

    startedAtRef.current = null;
    lastSavedAtRef.current = 0;

    if (submitted) {
      elapsedMsRef.current = submittedElapsedMs;
      forceTick();
      void SecureStore.deleteItemAsync(storageKey);
      return () => {
        cancelled = true;
      };
    }

    elapsedMsRef.current = 0;
    forceTick();

    if (resetSignal > 0) {
      saveElapsedMs(0);
      return () => {
        cancelled = true;
        const finalElapsedMs = getElapsedMs();
        elapsedMsRef.current = finalElapsedMs;
        startedAtRef.current = null;
        saveElapsedMs(finalElapsedMs);
      };
    }

    void SecureStore.getItemAsync(storageKey).then((storedValue) => {
      if (cancelled) {
        return;
      }

      const storedElapsedMs = parseStoredElapsedMs(storedValue);
      elapsedMsRef.current = storedElapsedMs;
      forceTick();
    });

    return () => {
      cancelled = true;
      const finalElapsedMs = getElapsedMs();
      elapsedMsRef.current = finalElapsedMs;
      startedAtRef.current = null;
      saveElapsedMs(finalElapsedMs);
    };
  }, [
    getElapsedMs,
    resetSignal,
    saveElapsedMs,
    submitted,
    storageKey,
    submittedElapsedMs,
  ]);

  useEffect(() => {
    if (submitted || !active) {
      return;
    }

    if (startedAtRef.current === null) {
      startedAtRef.current = Date.now();
    }
    forceTick();

    const interval = setInterval(() => {
      const nextElapsedMs = getElapsedMs();
      forceTick();

      if (Date.now() - lastSavedAtRef.current >= CHRONOMETER_SAVE_INTERVAL_MS) {
        saveElapsedMs(nextElapsedMs);
      }
    }, 1000);

    return () => {
      clearInterval(interval);

      const startedAt = startedAtRef.current;
      if (startedAt !== null) {
        const nextElapsedMs = elapsedMsRef.current + Date.now() - startedAt;
        elapsedMsRef.current = nextElapsedMs;
        startedAtRef.current = null;
        saveElapsedMs(nextElapsedMs);
      }
    };
  }, [active, getElapsedMs, saveElapsedMs, submitted]);

  const elapsedMs = submitted ? submittedElapsedMs : getElapsedMs();

  return {
    elapsedMs,
    formattedElapsedTime: formatDailyNumbersElapsedTime(elapsedMs),
    getElapsedMs,
  };
}

function MessageBanner({ message }: { message: MessageState }) {
  if (!message) {
    return null;
  }

  return (
    <Animated.View
      accessible
      accessibilityLabel={message.text}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(140)}
      className={`rounded-ds-sm px-3 py-2.5 ${message.type === "success" ? "bg-successTint" : "bg-dangerTint"}`}
    >
      <Text
        className={`font-nunito-bold text-xs leading-4 ${message.type === "success" ? "text-successText" : "text-dangerText"}`}
      >
        {message.text}
      </Text>
    </Animated.View>
  );
}

function ModeTabs({
  activeMode,
  archiveMode,
  modeCards,
  onSelectMode,
  t,
}: {
  activeMode: DailyNumbersMode;
  archiveMode: boolean;
  modeCards: ModeCard[];
  onSelectMode: (mode: DailyNumbersMode) => void;
  t: TranslateFn;
}) {
  // The played/fresh status has no room in a Segmented Control; it stays in
  // each segment's accessibility label.
  const options = modeCards.map(({ mode, state, isLoading }) => {
    const statusLabel =
      archiveMode && state?.submission
        ? t("quests.dailyNumbers.archiveSavedLabel")
        : getModeStatusLabel(state, isLoading, t);
    const modeLabel = t(getModeLabelKey(mode));

    return {
      value: mode,
      label: modeLabel,
      accessibilityLabel: `${modeLabel}. ${statusLabel}`,
      testID: `daily-numbers-mode-${mode}`,
    };
  });

  return (
    <SegmentedControl
      options={options}
      value={activeMode}
      onChange={(mode) => {
        triggerSelectionHaptic();
        onSelectMode(mode);
      }}
      testID="daily-numbers-mode-tabs"
    />
  );
}

function MetricsSection({
  currentBestTile,
  currentDistance,
  formattedElapsedTime,
  showSolutionFound,
  state,
  t,
}: {
  currentBestTile: BoardTile | null;
  currentDistance: number | undefined;
  formattedElapsedTime: string;
  showSolutionFound: boolean;
  state: DailyNumbersBoardState;
  t: TranslateFn;
}) {
  const { fontScale } = useWindowDimensions();
  const stackMetrics = fontScale >= 1.4;
  const tileClass = stackMetrics ? "w-full" : "min-w-0 flex-1";

  return (
    <Card tone="accent">
      <View className="items-center">
        <Text className="font-nunito-bold text-ds-overline uppercase tracking-[1.2px] text-accentText">
          {t("quests.dailyNumbers.target")}
        </Text>
        <Text
          className="font-nunito-extrabold text-[48px] leading-[53px] text-accentText"
          style={{ fontVariant: ["tabular-nums"] }}
          numberOfLines={1}
          selectable
          testID="daily-numbers-target"
        >
          {state.target}
        </Text>
      </View>
      <View className={`${stackMetrics ? "flex-col" : "flex-row"} gap-ds-2`}>
        <StatTile
          className={tileClass}
          label={t("quests.dailyNumbers.bestResult")}
          value={currentBestTile?.value ?? "—"}
        />
        <StatTile
          className={tileClass}
          label={t("quests.dailyNumbers.bestDistance")}
          value={currentDistance ?? state.bestDistance}
        />
        <StatTile
          className={tileClass}
          label={
            showSolutionFound
              ? t("quests.dailyNumbers.solutionHuntTitle")
              : t("quests.dailyNumbers.solveTime")
          }
          value={
            showSolutionFound
              ? t("quests.dailyNumbers.solutionHuntSolutionFound")
              : formattedElapsedTime
          }
        />
      </View>
    </Card>
  );
}

function SuccessCallout({
  archiveMode,
  completionReached,
  t,
  tc,
}: {
  archiveMode: boolean;
  completionReached: boolean;
  t: TranslateFn;
  tc: ThemeColors;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      className="flex-row items-start gap-2 px-1"
    >
      <CheckIcon size={17} color={tc.successText} />
      <Text className="min-w-0 flex-1 font-nunito-bold text-xs leading-4 text-successText">
        {completionReached
          ? archiveMode
            ? t("quests.dailyNumbers.archiveImproved")
            : t("quests.dailyNumbers.clearReached")
          : t("quests.dailyNumbers.lockedSuccess")}
      </Text>
    </Animated.View>
  );
}

function StepList({
  emptyCopy,
  steps,
  t,
  title,
}: {
  emptyCopy?: string;
  steps: DailyNumbersStep[];
  t: TranslateFn;
  title: string;
}) {
  return (
    <View className="mt-5">
      <View className="flex-row items-baseline justify-between">
        <Text className="font-nunito-extrabold text-sm text-fg">{title}</Text>
        <Text
          className="font-nunito-bold text-xs text-fgMuted"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {steps.length}
        </Text>
      </View>
      {steps.length > 0 ? (
        <View className="mt-1.5 border-t border-primaryBorder">
          {steps.map((step, index) => (
            <Animated.View
              key={step.resultId}
              entering={FadeIn.duration(160).delay(index * 35)}
              layout={LinearTransition.duration(180)}
              className="flex-row items-center gap-3 border-b border-primaryBorder py-2.5"
            >
              <Text
                className="w-5 text-center font-nunito-extrabold text-xs text-fgMuted"
                style={{ fontVariant: ["tabular-nums"] }}
                accessibilityLabel={t("quests.dailyNumbers.stepNumber", {
                  step: index + 1,
                })}
              >
                {index + 1}
              </Text>
              <Text className="min-w-0 flex-1 font-nunito-extrabold text-sm leading-5 text-fg">
                {t("quests.dailyNumbers.stepSummary", {
                  leftValue: step.leftValue,
                  operator: displayOperator(step.operator),
                  rightValue: step.rightValue,
                  resultValue: step.resultValue,
                })}
              </Text>
            </Animated.View>
          ))}
        </View>
      ) : emptyCopy ? (
        <Text className="mt-2 font-nunito-semibold text-xs leading-4 text-fgMuted">
          {emptyCopy}
        </Text>
      ) : null}
    </View>
  );
}

function SolutionAccordionItem({
  solution,
  t,
}: {
  solution: DailyNumbersSolutionListItem;
  t: TranslateFn;
}) {
  const [expanded, setExpanded] = useState(false);
  const label = t("quests.dailyNumbers.solutionHuntSolutionNumber", {
    number: solution.number,
  });

  return (
    <View className="border-b border-primaryBorder">
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="min-h-12 flex-row items-center gap-2 py-3"
        onPress={() => setExpanded((current) => !current)}
        testID={`daily-numbers-solution-${solution.number}`}
      >
        {expanded ? (
          <ChevronDownIcon size={18} />
        ) : (
          <ChevronRightIcon size={18} />
        )}
        <Text className="min-w-0 flex-1 font-nunito-extrabold text-sm text-fg">
          {label}
        </Text>
        <Text className="font-nunito-bold text-xs text-fgMuted">
          {solution.steps.length}
        </Text>
      </Pressable>
      {expanded ? (
        <Animated.View entering={FadeIn.duration(160)} className="pb-3 pl-6">
          <StepList
            steps={solution.steps}
            t={t}
            title={t("quests.dailyNumbers.solutionHuntStepsTitle")}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

function SolutionAccordionList({
  solutions,
  t,
  title,
}: {
  solutions: DailyNumbersSolutionListItem[];
  t: TranslateFn;
  title: string;
}) {
  if (solutions.length === 0) return null;

  return (
    <View className="mt-5">
      <Text className="font-nunito-extrabold text-base text-fg">{title}</Text>
      <View className="mt-2 border-t border-primaryBorder">
        {solutions.map((solution) => (
          <SolutionAccordionItem
            key={`${solution.number}-${solution.steps.map((step) => step.resultId).join("-")}`}
            solution={solution}
            t={t}
          />
        ))}
      </View>
    </View>
  );
}

function SolutionHuntLists({
  onToggleOtherSolutions,
  progress,
  revealedOtherSolutions,
  t,
  tc,
}: {
  onToggleOtherSolutions: () => void;
  progress: DailyNumbersSolutionLists;
  revealedOtherSolutions: boolean;
  t: TranslateFn;
  tc: ThemeColors;
}) {
  const hasDiscoveries = progress.yourSolutions.length > 0;
  const otherTitle = t(
    hasDiscoveries
      ? "quests.dailyNumbers.solutionHuntOtherSolutions"
      : "quests.dailyNumbers.solutionHuntExistingSolutions",
  );

  return (
    <>
      <SolutionAccordionList
        solutions={progress.yourSolutions}
        t={t}
        title={t("quests.dailyNumbers.solutionHuntYourSolutions")}
      />
      {progress.otherSolutions.length > 0 ? (
        <>
          <QuestActionButton
            tone="ghost"
            accessibilityLabel={
              revealedOtherSolutions
                ? t("quests.dailyNumbers.solutionHuntHideSolutions", {
                    title: otherTitle,
                  })
                : t("quests.dailyNumbers.solutionHuntShowSolutions", {
                    title: otherTitle,
                  })
            }
            accessibilityState={{ expanded: revealedOtherSolutions }}
            label={
              revealedOtherSolutions
                ? t("quests.dailyNumbers.solutionHuntHideSolutions", {
                    title: otherTitle,
                  })
                : t("quests.dailyNumbers.solutionHuntShowSolutions", {
                    title: otherTitle,
                  })
            }
            leadingIcon={EyeIcon}
            onPress={onToggleOtherSolutions}
            style={{ marginTop: 14 }}
            testID="daily-numbers-reveal-other-solutions"
          />
          {revealedOtherSolutions ? (
            <Animated.View entering={FadeIn.duration(180)}>
              <SolutionAccordionList
                solutions={progress.otherSolutions}
                t={t}
                title={otherTitle}
              />
            </Animated.View>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function ResultDetails({
  interaction,
  officialSolutionSteps,
  onToggleSolution,
  state,
  submittedSolutionSteps,
  t,
  tc,
}: {
  interaction: BoardInteractionState;
  officialSolutionSteps: DailyNumbersStep[];
  onToggleSolution: () => void;
  state: DailyNumbersBoardState;
  submittedSolutionSteps: DailyNumbersStep[];
  t: TranslateFn;
  tc: ThemeColors;
}) {
  const solutionHuntProgress = interaction.solutionHuntResult ?? state.solutionHunt;

  return (
    <>
      <View className="mt-6 border-t border-primaryBorder pt-4">
        <Text className="font-nunito-extrabold text-sm text-fg">
          {t("quests.dailyNumbers.startingNumbersTitle")}
        </Text>
        <View className="mt-2 flex-row flex-wrap items-center gap-2">
          {state.numbers.map((tile) => (
            <View
              className="h-11 min-w-[46px] items-center justify-center rounded-ds-sm border border-primaryBorder bg-surface px-2"
              key={tile.id}
            >
              <Text
                className="text-center font-nunito-extrabold text-base text-fg"
                style={{ fontVariant: ["tabular-nums"] }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                selectable
              >
                {tile.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
      {submittedSolutionSteps.length > 0 &&
      (!solutionHuntProgress || solutionHuntProgress.yourSolutions.length === 0) ? (
        <StepList
          steps={submittedSolutionSteps}
          t={t}
          title={t("quests.dailyNumbers.solutionUsedTitle")}
        />
      ) : null}
      {!solutionHuntProgress && officialSolutionSteps.length > 0 ? (
        <>
          <QuestActionButton
            tone="ghost"
            label={
              interaction.revealedSolution
                ? t("quests.dailyNumbers.hideSolution")
                : t("quests.dailyNumbers.revealSolution")
            }
            onPress={onToggleSolution}
            leadingIcon={EyeIcon}
            style={{ marginTop: 14 }}
            testID="daily-numbers-reveal-solution"
            accessibilityLabel={
              interaction.revealedSolution
                ? t("quests.dailyNumbers.hideSolution")
                : t("quests.dailyNumbers.revealSolution")
            }
            accessibilityState={{ expanded: interaction.revealedSolution }}
          />
          {interaction.revealedSolution ? (
            <Animated.View
              entering={FadeIn.duration(180)}
              className="mt-4 border-t border-primaryBorder pt-4"
            >
              <Text className="font-nunito text-sm leading-5 text-fgMuted">
                {t("quests.dailyNumbers.officialSolutionBody")}
              </Text>
              <StepList
                steps={officialSolutionSteps}
                t={t}
                title={t("quests.dailyNumbers.officialSolutionTitle")}
              />
            </Animated.View>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function FinishStatePanel({
  archiveMode,
  canRetryArchive,
  claimable,
  claimPending,
  compact,
  exactHitState,
  finishCompleted,
  finishDistance,
  finishScore,
  finishValue,
  formattedElapsedTime,
  interaction,
  isSharing,
  onClaimReward,
  onShareResult,
  onStartRetry,
  onStartSolutionHunt,
  onToggleSolution,
  officialSolutionSteps,
  state,
  submittedSolutionSteps,
  t,
  tc,
}: FinishStateProps) {
  const { fontScale } = useWindowDimensions();
  const stackMetrics = fontScale >= 1.4;
  const resultEmphasisClass = compact
    ? "text-[42px] leading-[48px]"
    : "text-[48px] leading-[54px]";
  const resultColor = exactHitState
    ? tc.successDark
    : finishCompleted
      ? tc.infoDark
      : tc.dangerDark;
  const resultTint = exactHitState
    ? tc.successTint
    : finishCompleted
      ? tc.infoTint
      : tc.dangerTint;
  const resultBorder = exactHitState
    ? tc.successBorder
    : finishCompleted
      ? tc.infoBorder
      : tc.dangerBorder;
  const outcomeLabel = exactHitState
    ? t("quests.dailyNumbers.exactHitLabel")
    : finishDistance == null
      ? t("quests.dailyNumbers.resultLockedLabel")
      : t("quests.dailyNumbers.distanceOutcome", {
          distance: finishDistance,
        });
  const resultNote = state.claimed
    ? t("quests.dailyNumbers.alreadyClaimed")
    : !state.submitted && exactHitState
      ? null
      : finishCompleted
        ? t("quests.dailyNumbers.rewardReminder", {
            reward: state.reward,
          })
        : t("quests.dailyNumbers.resultLockedNote");
  const solutionHuntProgress = interaction.solutionHuntResult ?? state.solutionHunt;

  return (
    <View className="pt-1" testID="daily-numbers-result">
      <Animated.View
        entering={FadeIn.duration(220)}
        className="relative mb-1 items-center overflow-hidden rounded-ds-lg border px-4 pb-5 pt-5"
        style={{ backgroundColor: resultTint, borderColor: resultBorder }}
      >
        <Text
          className="absolute right-8 top-3 font-nunito-extrabold text-xl"
          style={{ color: resultColor, opacity: 0.55 }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          ✦
        </Text>
        <Text
          className="absolute bottom-3 left-8 font-nunito-extrabold text-sm"
          style={{ color: resultColor, opacity: 0.42 }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          ✦
        </Text>
        {archiveMode ? (
          <Text
            className="mb-2 font-nunito-bold text-[10px] uppercase tracking-[1.2px]"
            style={{ color: resultColor }}
          >
            {t("quests.dailyNumbers.archiveResultLabel")}
          </Text>
        ) : null}
        {!exactHitState ? (
          <Text
            className={`${resultEmphasisClass} text-center font-nunito-extrabold`}
            style={{ color: resultColor, fontVariant: ["tabular-nums"] }}
            selectable
            testID="daily-numbers-result-outcome"
          >
            {outcomeLabel}
          </Text>
        ) : null}
        {exactHitState ? (
          <View className="items-center" testID="daily-numbers-exact-target">
            <Text
              className={`${resultEmphasisClass} text-center font-nunito-extrabold`}
              style={{ color: resultColor, fontVariant: ["tabular-nums"] }}
              selectable
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {state.target}
            </Text>
            <Text
              className="font-nunito-extrabold text-[10px] uppercase tracking-[1.4px]"
              style={{ color: resultColor }}
            >
              {t("quests.dailyNumbers.target")}
            </Text>
          </View>
        ) : null}
        <Text
          className="mt-2 text-center font-nunito-bold text-xs"
          style={{ color: resultColor }}
        >
          {archiveMode
            ? t("quests.dailyNumbers.archiveSavedLabel")
            : finishCompleted
              ? t("quests.dailyNumbers.completedLabel")
              : t("quests.dailyNumbers.incompleteLabel")}
        </Text>
        {interaction.submitting && !state.submitted && exactHitState ? (
          <Text className="mt-2 text-center font-nunito-semibold text-xs text-fgMuted">
            {t("quests.dailyNumbers.autoSubmittingSuccess")}
          </Text>
        ) : null}
      </Animated.View>
      {exactHitState ? (
        <Animated.Text
          entering={FadeIn.duration(180).delay(80)}
          className={`${resultEmphasisClass} py-3 text-center font-nunito-extrabold`}
          style={{ color: resultColor }}
          selectable
          testID="daily-numbers-result-outcome"
        >
          {outcomeLabel}
        </Animated.Text>
      ) : null}

      <View
        className={`${stackMetrics ? "flex-col" : "flex-row"} border-b border-primaryBorder`}
      >
        <View
          className={`${stackMetrics ? "px-1" : "pr-5"} min-w-0 flex-1 py-4`}
        >
          <View className="min-h-5 flex-row items-center gap-1.5">
            <ClockIcon size={15} color={tc.fgMuted} />
            <Text className="font-nunito-extrabold text-[10px] leading-4 uppercase tracking-[1px] text-fgMuted">
              {t("quests.dailyNumbers.solveTime")}
            </Text>
          </View>
          <Text
            className="mt-2 font-nunito-extrabold text-[30px] leading-10 text-fg"
            style={{ fontVariant: ["tabular-nums"] }}
            selectable
            testID="daily-numbers-result-time"
          >
            {formattedElapsedTime}
          </Text>
        </View>
        <View
          className={
            stackMetrics
              ? "h-px w-full bg-primaryBorder"
              : "my-3 w-px bg-primaryBorder"
          }
        />
        <View
          className={`${stackMetrics ? "px-1" : "pl-5"} min-w-0 flex-1 py-4`}
        >
          <Text className="min-h-5 font-nunito-extrabold text-[10px] leading-4 uppercase tracking-[1px] text-fgMuted">
            {t("quests.dailyNumbers.finalResult")}
          </Text>
          <Text
            className="mt-2 font-nunito-extrabold text-2xl leading-9 text-fg"
            style={{ fontVariant: ["tabular-nums"] }}
            selectable
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {finishValue ?? "—"} {exactHitState ? "=" : "→"} {state.target}
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap items-center gap-x-5 gap-y-2 py-3">
        <Text className="font-nunito-bold text-xs text-fgMuted">
          {t("quests.dailyNumbers.distanceLabel")}: {finishDistance ?? "—"}
        </Text>
        <Text className="font-nunito-bold text-xs text-fgMuted">
          {t("quests.dailyNumbers.scoreLabel")}:{" "}
          {finishScore != null ? `${finishScore}%` : "—"}
        </Text>
        {!archiveMode ? (
          <View className="flex-row items-center gap-1.5">
            <CoinIcon size={16} />
            <Text className="font-nunito-bold text-xs text-fgMuted">
              {t("quests.dailyNumbers.reward")}: {state.reward}
            </Text>
          </View>
        ) : null}
      </View>
      {archiveMode ? (
        <Text className="px-1 py-2 text-center font-nunito-bold text-xs leading-4 text-fgMuted">
          {t("quests.dailyNumbers.archiveNoReward")}
        </Text>
      ) : claimable && state.questVersion ? (
        <QuestActionButton
          tone="secondary"
          label={t("quests.dailyNumbers.claimReward", {
            reward: state.reward,
          })}
          onPress={onClaimReward}
          loading={claimPending}
          loadingMode="inline"
          leadingAccessory={<CoinIcon size={18} />}
          accessibilityLabel={t("quests.dailyNumbers.claimReward", {
            reward: state.reward,
          })}
          testID="daily-numbers-claim-reward"
          style={{ marginTop: 12 }}
        />
      ) : resultNote ? (
        <Text className="px-1 py-2 text-center font-nunito-semibold text-xs leading-4 text-fgMuted">
          {resultNote}
        </Text>
      ) : null}
      {archiveMode && canRetryArchive ? (
        <QuestActionButton
          tone="primary"
          label={t("quests.dailyNumbers.archiveTryAgain")}
          onPress={onStartRetry}
          leadingIcon={RecycleIcon}
          style={{ marginTop: 12 }}
          testID="daily-numbers-archive-retry"
          accessibilityLabel={t("quests.dailyNumbers.archiveTryAgain")}
        />
      ) : null}
      {!archiveMode && solutionHuntProgress ? (
        <View
          className="mt-5 border-t border-primaryBorder pt-5"
          testID="daily-numbers-solution-hunt"
        >
          <Text className="font-nunito-extrabold text-xl text-fg">
            {t("quests.dailyNumbers.solutionHuntTitle")}
          </Text>
          <Text
            className="mt-1 font-nunito-extrabold text-base text-primaryText"
            style={{ fontVariant: ["tabular-nums"] }}
            testID="daily-numbers-solution-hunt-progress"
          >
            {t("quests.dailyNumbers.solutionHuntProgress", {
              found: solutionHuntProgress.solutionsFound,
              total: solutionHuntProgress.totalSolutions,
            })}
          </Text>
          {solutionHuntProgress.allSolutionsFound ? (
            <Text
              className="mt-2 font-nunito-extrabold text-sm text-successText"
              testID="daily-numbers-solution-hunt-complete"
            >
              {t("quests.dailyNumbers.solutionHuntAllFound")}
            </Text>
          ) : interaction.solutionHuntResult?.newSolution ? (
            <Text
              className="mt-2 font-nunito-extrabold text-sm text-successText"
              testID="daily-numbers-solution-hunt-new"
            >
              {t("quests.dailyNumbers.solutionHuntNewSolution")}
            </Text>
          ) : interaction.solutionHuntResult?.alreadyFound ? (
            <Text
              className="mt-2 font-nunito-bold text-sm leading-5 text-infoText"
              testID="daily-numbers-solution-hunt-duplicate"
            >
              {t("quests.dailyNumbers.solutionHuntAlreadyFound")}
            </Text>
          ) : null}
          <Text className="mt-2 font-nunito-semibold text-xs leading-4 text-fgMuted">
            {t("quests.dailyNumbers.solutionHuntNoRewards")}
          </Text>
          <SolutionHuntLists
            onToggleOtherSolutions={onToggleSolution}
            progress={solutionHuntProgress}
            revealedOtherSolutions={interaction.revealedSolution}
            t={t}
            tc={tc}
          />
          {!solutionHuntProgress.allSolutionsFound ? (
            <View className="mt-3">
              <QuestActionButton
                tone="primary"
                label={t("quests.dailyNumbers.solutionHuntFindAnother")}
                onPress={onStartSolutionHunt}
                testID="daily-numbers-solution-hunt-start"
                accessibilityLabel={t(
                  "quests.dailyNumbers.solutionHuntFindAnother",
                )}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      <QuestActionButton
        tone="ghost"
        label={
          isSharing
            ? t("quests.dailyNumbers.sharePreparing")
            : t("quests.dailyNumbers.shareResult")
        }
        onPress={onShareResult}
        loading={isSharing}
        loadingMode="inline"
        leadingIcon={ShareIcon}
        accessibilityLabel={t("quests.dailyNumbers.shareResult")}
        testID="daily-numbers-share-result"
        style={{ marginTop: 12 }}
      />
      <ResultDetails
        interaction={interaction}
        officialSolutionSteps={officialSolutionSteps}
        onToggleSolution={onToggleSolution}
        state={state}
        submittedSolutionSteps={submittedSolutionSteps}
        t={t}
        tc={tc}
      />
    </View>
  );
}

function SectionTitle({
  title,
  count,
}: {
  title: string;
  count?: number;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text
        accessibilityRole="header"
        className="font-nunito-extrabold text-ds-body text-fg"
      >
        {title}
      </Text>
      {count != null ? (
        <Text
          className="font-nunito-bold text-ds-sm text-fgMuted"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {count}
        </Text>
      ) : null}
    </View>
  );
}

function AvailableNumbersGrid({
  availableTiles,
  committingResultId,
  committingTileIds,
  futureResultRef,
  interactionLocked,
  onTileRef,
  onTilePress,
  selectedLeftTile,
  selectedOperator,
  selectedRightTile,
  t,
}: AvailableNumbersGridProps) {
  const commitInProgress =
    committingTileIds.size > 0 || committingResultId !== null;
  const futureTileCount =
    selectedLeftTile && selectedOperator && selectedRightTile
      ? Math.max(1, availableTiles.length - 1)
      : 0;

  return (
    <View className="gap-ds-3">
      <SectionTitle
        title={t("quests.dailyNumbers.availableNumbers")}
        count={availableTiles.length}
      />
      <View className="relative flex-row flex-wrap justify-between gap-y-ds-2">
        {futureTileCount > 0 ? (
          <View
            pointerEvents="none"
            className="absolute inset-0 flex-row flex-wrap justify-between gap-y-ds-2 opacity-0"
          >
            {Array.from({ length: futureTileCount }, (_, index) => (
              <View
                key={`future-slot-${index}`}
                ref={
                  index === futureTileCount - 1 ? futureResultRef : undefined
                }
                collapsable={false}
                className={BOARD_TILE_HEIGHT_CLASS}
                style={{ width: BOARD_TILE_WIDTH }}
              />
            ))}
          </View>
        ) : null}
        {availableTiles.map((tile) => {
          const availability = getDailyNumbersTileAvailability({
            interactionLocked,
            selectedLeftTile,
            selectedOperator,
            selectedRightTile,
            tile,
          });
          const hidden =
            committingTileIds.has(tile.id) || tile.id === committingResultId;
          const dimmed =
            !commitInProgress && availability.disabled && !availability.selected;
          const derived = tile.source === "derived";

          return (
            <Animated.View
              key={tile.id}
              ref={(node: View | null) => onTileRef(tile.id, node)}
              collapsable={false}
              entering={derived ? undefined : FadeIn.duration(180)}
              exiting={FadeOut.duration(140)}
              layout={LinearTransition.duration(200)}
              style={{ width: BOARD_TILE_WIDTH }}
            >
              <KeypadKey
                variant={availability.selected ? "selected" : "default"}
                onPress={() => onTilePress(tile.id)}
                disabled={availability.disabled}
                className={`overflow-hidden px-ds-2 ${
                  hidden ? "opacity-0" : dimmed ? "opacity-40" : ""
                }`}
                testID={`daily-numbers-tile-${tile.id}`}
                accessibilityLabel={t("quests.dailyNumbers.tileValue", {
                  value: tile.value,
                })}
              >
                {derived ? (
                  <Text
                    className={`absolute right-2 top-1 font-nunito-extrabold text-[10px] ${
                      availability.selected ? "text-white" : "text-primaryText"
                    }`}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    ✦
                  </Text>
                ) : null}
                <Text
                  className={`${BOARD_NUMBER_TEXT_CLASS} text-center font-nunito-extrabold ${
                    availability.selected
                      ? "text-white"
                      : derived
                        ? "text-primaryText"
                        : "text-fg"
                  }`}
                  style={{ fontVariant: ["tabular-nums"] }}
                  numberOfLines={1}
                  adjustsFontSizeToFit={String(tile.value).length > 3}
                  minimumFontScale={0.68}
                >
                  {tile.value}
                </Text>
              </KeypadKey>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

function getOperatorTestID(operator: Operator) {
  return `daily-numbers-operator-${operator === "*" ? "multiply" : operator === "/" ? "divide" : operator === "+" ? "plus" : "minus"}`;
}

function OperatorPicker({
  interactionLocked,
  onOperatorPress,
  selectedLeftTile,
  selectedOperator,
  selectedRightTile,
  t,
}: OperatorPickerProps) {
  return (
    <View className="gap-ds-3">
      <SectionTitle title={t("quests.dailyNumbers.operators")} />
      <View className="flex-row gap-ds-2">
        {OPERATORS.map((operator) => {
          const availability = getDailyNumbersOperatorAvailability({
            interactionLocked,
            operator,
            selectedLeftTile,
            selectedOperator,
            selectedRightTile,
          });
          const opacityClass =
            availability.disabled && !availability.selected
              ? "opacity-20"
              : availability.wouldBeInvalid
                ? "opacity-[0.34]"
                : "";

          return (
            <KeypadKey
              key={operator}
              label={displayOperator(operator)}
              variant={availability.selected ? "selected" : "operator"}
              onPress={() => onOperatorPress(operator)}
              disabled={availability.disabled}
              className={`min-w-0 flex-1 ${opacityClass}`}
              testID={getOperatorTestID(operator)}
              accessibilityLabel={t("quests.dailyNumbers.operatorValue", {
                operator: displayOperator(operator),
              })}
            />
          );
        })}
      </View>
    </View>
  );
}

function EquationResult({
  committing,
  exactHitPreview,
  interactionLocked,
  onApplyStep,
  previewState,
  resultRef,
  t,
}: {
  committing: boolean;
  exactHitPreview: boolean;
  interactionLocked: boolean;
  onApplyStep: () => void;
  previewState: PreviewState;
  resultRef: RefObject<View | null>;
  t: TranslateFn;
}) {
  const resultSurfaceClassName = exactHitPreview
    ? "bg-successTint border-successBorder"
    : committing
      ? "bg-surface border-primaryStrong"
      : "bg-primaryStrong border-primaryStrong";
  const resultTextClassName = exactHitPreview
    ? "text-successDark"
    : committing
      ? "text-primaryStrong"
      : "text-white";

  if (previewState.kind !== "ready") {
    return (
      <Animated.View
        key={previewState.kind}
        entering={FadeIn.duration(120)}
        className={`${BOARD_TILE_HEIGHT_CLASS} min-w-0 flex-1 items-center justify-center rounded-ds-md border ${
          previewState.kind === "invalid"
            ? "border-dangerBorder bg-dangerTint"
            : "border-primaryBorder bg-surface"
        }`}
      >
        <Text
          className={`${BOARD_NUMBER_TEXT_CLASS} text-center font-nunito-extrabold ${
            previewState.kind === "invalid" ? "text-dangerText" : "text-fg"
          }`}
          numberOfLines={1}
        >
          —
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      key={`ready-${previewState.result}`}
      entering={FadeIn.duration(150)}
      className={`${BOARD_TILE_HEIGHT_CLASS} min-w-0 flex-1`}
      testID={exactHitPreview ? "daily-numbers-exact-preview" : undefined}
    >
      <View ref={resultRef} collapsable={false} className="h-full w-full">
        <Pressable
          onPress={onApplyStep}
          disabled={interactionLocked || committing}
          className={`${resultSurfaceClassName} relative h-full w-full items-center justify-center rounded-ds-md border px-ds-1`}
          style={({ pressed }) => ({
            opacity:
              interactionLocked && !committing ? 0.38 : pressed ? 0.76 : 1,
          })}
          accessibilityRole="button"
          accessibilityState={{
            disabled: interactionLocked || committing,
          }}
          accessibilityLabel={t("quests.dailyNumbers.applyResult", {
            result: previewState.result,
          })}
          accessibilityHint={
            exactHitPreview
              ? t("quests.dailyNumbers.exactHitLabel")
              : t("quests.dailyNumbers.applyResultHint")
          }
          testID="daily-numbers-apply-step"
        >
          <Text
            className={`${BOARD_NUMBER_TEXT_CLASS} w-full text-center font-nunito-extrabold ${resultTextClassName}`}
            numberOfLines={1}
            adjustsFontSizeToFit={String(previewState.result).length > 3}
            minimumFontScale={0.6}
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {previewState.result}
          </Text>
          {!committing ? (
            <View
              pointerEvents="none"
              className="absolute bottom-0.5 right-1.5"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Text
                className={`font-nunito-extrabold text-[11px] ${exactHitPreview ? "text-successDark" : "text-white"}`}
              >
                {exactHitPreview ? "✦" : "↓"}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </Animated.View>
  );
}

// Selection tile states: a picked number is the selected Keypad Key, the
// operator and "=" use the operator tint, an empty slot is a neutral "?".
function SelectionSlot({
  accessibilityLabel,
  disabled,
  filled,
  label,
  narrow,
  onPress,
  operator,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  filled: boolean;
  label: string;
  narrow?: boolean;
  onPress: () => void;
  operator?: boolean;
}) {
  const surface = operator
    ? "bg-primaryTint border-primaryBorder"
    : filled
      ? "bg-primary border-primary"
      : "bg-surface border-primaryBorder";
  const text = operator ? "text-primaryText" : filled ? "text-white" : "text-fg";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`${BOARD_TILE_HEIGHT_CLASS} ${
        narrow ? "w-12" : "min-w-0 flex-1"
      } items-center justify-center rounded-ds-md border px-ds-1 active:opacity-70 ${surface} ${
        disabled ? "opacity-[0.34]" : ""
      }`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel}
    >
      <Text
        className={`${BOARD_NUMBER_TEXT_CLASS} text-center font-nunito-extrabold ${text}`}
        numberOfLines={1}
        adjustsFontSizeToFit={label.length > 2}
        minimumFontScale={0.6}
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function EquationWorkbench({
  committing,
  interactionLocked,
  localSteps,
  onApplyStep,
  onClearSlot,
  previewState,
  resultRef,
  selectedLeftTile,
  selectedOperator,
  selectedRightTile,
  target,
  t,
}: {
  committing: boolean;
  interactionLocked: boolean;
  localSteps: DailyNumbersStep[];
  onApplyStep: () => void;
  onClearSlot: (slot: SlotKey) => void;
  previewState: PreviewState;
  resultRef: RefObject<View | null>;
  selectedLeftTile: BoardTile | null;
  selectedOperator: Operator | null;
  selectedRightTile: BoardTile | null;
  target: number;
  t: TranslateFn;
}) {
  const { fontScale } = useWindowDimensions();
  const stackResult = fontScale >= 1.35;
  const exactHitPreview =
    previewState.kind === "ready" && previewState.result === target;
  const result = (
    <EquationResult
      committing={committing}
      exactHitPreview={exactHitPreview}
      interactionLocked={interactionLocked}
      onApplyStep={onApplyStep}
      previewState={previewState}
      resultRef={resultRef}
      t={t}
    />
  );
  const equals = (
    <View
      className={`${BOARD_TILE_HEIGHT_CLASS} w-12 items-center justify-center rounded-ds-md border border-primaryBorder bg-primaryTint`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        className={`${BOARD_NUMBER_TEXT_CLASS} font-nunito-extrabold text-primaryText`}
      >
        =
      </Text>
    </View>
  );

  return (
    <Card testID="daily-numbers-selection">
      <View className="flex-row items-center justify-between">
        <Text
          accessibilityRole="header"
          className="font-nunito-extrabold text-ds-body text-fg"
        >
          {t("quests.dailyNumbers.selection")}
        </Text>
        <Text className="font-nunito-bold text-ds-sm text-fgMuted">
          {t("quests.dailyNumbers.stepNumber", {
            step: localSteps.length + 1,
          })}
        </Text>
      </View>

      <View className="flex-row items-center gap-ds-2">
        <SelectionSlot
          onPress={() => onClearSlot("left")}
          disabled={interactionLocked}
          filled={selectedLeftTile != null}
          label={selectedLeftTile ? String(selectedLeftTile.value) : "?"}
          accessibilityLabel={
            selectedLeftTile
              ? t("quests.dailyNumbers.selectedLeftValue", {
                  value: selectedLeftTile.value,
                })
              : t("quests.dailyNumbers.pickLeft")
          }
        />
        <SelectionSlot
          onPress={() => onClearSlot("operator")}
          disabled={interactionLocked}
          filled={selectedOperator != null}
          operator
          narrow
          label={selectedOperator ? displayOperator(selectedOperator) : "?"}
          accessibilityLabel={
            selectedOperator
              ? t("quests.dailyNumbers.selectedOperatorValue", {
                  operator: displayOperator(selectedOperator),
                })
              : t("quests.dailyNumbers.pickOperator")
          }
        />
        <SelectionSlot
          onPress={() => onClearSlot("right")}
          disabled={interactionLocked}
          filled={selectedRightTile != null}
          label={selectedRightTile ? String(selectedRightTile.value) : "?"}
          accessibilityLabel={
            selectedRightTile
              ? t("quests.dailyNumbers.selectedRightValue", {
                  value: selectedRightTile.value,
                })
              : t("quests.dailyNumbers.pickRight")
          }
        />
        {!stackResult ? (
          <>
            {equals}
            {result}
          </>
        ) : null}
      </View>
      {stackResult ? (
        <View className="flex-row items-center gap-ds-2">
          {equals}
          {result}
        </View>
      ) : null}
      {previewState.kind === "invalid" ? (
        <Text
          accessibilityLiveRegion="polite"
          className="font-nunito-bold text-ds-caption text-dangerText"
          numberOfLines={2}
        >
          {previewState.reason === "division"
            ? t("quests.dailyNumbers.invalidDivision")
            : t("quests.dailyNumbers.invalidPositive")}
        </Text>
      ) : null}
    </Card>
  );
}

function ConsumedNumberTile({
  progress,
  rect,
  resultRect,
  value,
}: {
  progress: SharedValue<number>;
  rect: MeasuredRect;
  resultRect: MeasuredRect;
  value: number;
}) {
  const translateX =
    resultRect.x + resultRect.width / 2 - (rect.x + rect.width / 2);
  const translateY =
    resultRect.y + resultRect.height / 2 - (rect.y + rect.height / 2);
  const animatedStyle = useAnimatedStyle(() => {
    const mergeProgress = interpolate(
      progress.value,
      [0, 0.3],
      [0, 1],
      "clamp",
    );

    return {
      opacity: interpolate(
        progress.value,
        [0, 0.22, 0.32],
        [1, 0.82, 0],
        "clamp",
      ),
      transform: [
        { translateX: translateX * mergeProgress },
        { translateY: translateY * mergeProgress },
        { scale: interpolate(mergeProgress, [0, 1], [1, 0.28]) },
      ],
    };
  });

  return (
    <Animated.View
      className="absolute items-center justify-center rounded-ds-md border border-primary bg-primary"
      style={[
        {
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
        },
        animatedStyle,
      ]}
    >
      <Text
        className={`${BOARD_NUMBER_TEXT_CLASS} text-center font-nunito-extrabold text-white`}
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </Animated.View>
  );
}

function CommittedResultTile({
  progress,
  resultRect,
  targetRect,
  value,
}: {
  progress: SharedValue<number>;
  resultRect: MeasuredRect;
  targetRect: MeasuredRect;
  value: number;
}) {
  const resultCenterX = resultRect.x + resultRect.width / 2;
  const resultCenterY = resultRect.y + resultRect.height / 2;
  const targetCenterX = targetRect.x + targetRect.width / 2;
  const targetCenterY = targetRect.y + targetRect.height / 2;
  const animatedStyle = useAnimatedStyle(() => {
    const transferProgress = interpolate(
      progress.value,
      [0.3, 1],
      [0, 1],
      "clamp",
    );
    return {
      transform: [
        {
          translateX: (resultCenterX - targetCenterX) * (1 - transferProgress),
        },
        {
          translateY: (resultCenterY - targetCenterY) * (1 - transferProgress),
        },
      ],
    };
  });
  const derivedMarkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.68, 0.9], [0, 1], "clamp"),
  }));

  return (
    <Animated.View
      className="absolute items-center justify-center rounded-ds-md border border-primaryBorder bg-surface"
      style={[
        {
          left: targetRect.x,
          top: targetRect.y,
          width: targetRect.width,
          height: targetRect.height,
          zIndex: 2,
        },
        animatedStyle,
      ]}
    >
      <Animated.Text
        className="absolute right-2 top-1 font-nunito-extrabold text-[10px] text-primaryText"
        style={derivedMarkStyle}
      >
        ✦
      </Animated.Text>
      <Text
        className={`${BOARD_NUMBER_TEXT_CLASS} text-center font-nunito-extrabold text-primaryText`}
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </Animated.View>
  );
}

function OperationCommitOverlay({
  animation,
  onMerged,
  onFinished,
}: {
  animation: ResultCommitAnimation;
  onMerged: () => void;
  onFinished: () => void;
}) {
  const progress = useSharedValue(0);
  const mergedCallback = useRef(onMerged).current;
  const finishedCallback = useRef(onFinished).current;

  useEffect(() => {
    progress.value = withTiming(
      0.3,
      {
        duration: 170,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (!finished) {
          return;
        }

        scheduleOnRN(mergedCallback);
        progress.value = withDelay(
          16,
          withTiming(
            1,
            {
              duration: 390,
              easing: Easing.bezier(0.2, 0.78, 0.2, 1),
            },
            (transferFinished) => {
              if (transferFinished) {
                scheduleOnRN(finishedCallback);
              }
            },
          ),
        );
      },
    );
  }, [finishedCallback, mergedCallback, progress]);

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0 z-20"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <ConsumedNumberTile
        progress={progress}
        rect={animation.leftRect}
        resultRect={animation.resultRect}
        value={animation.leftValue}
      />
      <ConsumedNumberTile
        progress={progress}
        rect={animation.rightRect}
        resultRect={animation.resultRect}
        value={animation.rightValue}
      />
      <CommittedResultTile
        progress={progress}
        resultRect={animation.resultRect}
        targetRect={animation.targetRect}
        value={animation.resultValue}
      />
    </View>
  );
}

function LivePlayControls({
  archiveMode,
  interactionLocked,
  localSteps,
  officialSolutionSteps,
  onResetBoard,
  onSubmitPress,
  onToggleSolution,
  onUndoStep,
  revealedSolution,
  submitting,
  t,
  tc,
}: {
  archiveMode: boolean;
  interactionLocked: boolean;
  localSteps: DailyNumbersStep[];
  officialSolutionSteps: DailyNumbersStep[];
  onResetBoard: () => void;
  onSubmitPress: () => void;
  onToggleSolution: () => void;
  onUndoStep: () => void;
  revealedSolution: boolean;
  submitting: boolean;
  t: TranslateFn;
  tc: ThemeColors;
}) {
  const handleToggleSolution = () => {
    if (revealedSolution) {
      onToggleSolution();
      return;
    }

    Alert.alert(
      t("quests.dailyNumbers.revealSolutionConfirmTitle"),
      t("quests.dailyNumbers.revealSolutionConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("quests.dailyNumbers.revealSolution"),
          style: "destructive",
          onPress: onToggleSolution,
        },
      ],
    );
  };

  return (
    <>
      <Button
        tone="primary"
        size="md"
        icon={Check}
        onPress={onSubmitPress}
        disabled={interactionLocked}
        loading={submitting}
        testID="daily-numbers-submit"
        className="w-full"
      >
        {archiveMode
          ? t("quests.dailyNumbers.archiveSaveResult")
          : t("quests.dailyNumbers.submit")}
      </Button>

      <View className="flex-row gap-ds-2">
        <View className="min-w-0 flex-1">
          <QuestActionButton
            tone="ghost"
            label={t("quests.dailyNumbers.undo")}
            onPress={onUndoStep}
            disabled={interactionLocked}
            leadingIcon={SkipBackIcon}
            leadingIconSize={16}
            accessibilityLabel={t("quests.dailyNumbers.undo")}
            testID="daily-numbers-undo"
            style={{ opacity: interactionLocked ? 0.38 : 1 }}
          />
        </View>
        <View className="min-w-0 flex-1">
          <QuestActionButton
            tone="ghost"
            label={t("quests.dailyNumbers.reset")}
            onPress={onResetBoard}
            disabled={interactionLocked}
            leadingIcon={RecycleIcon}
            leadingIconSize={16}
            accessibilityLabel={t("quests.dailyNumbers.reset")}
            testID="daily-numbers-reset"
            style={{ opacity: interactionLocked ? 0.38 : 1 }}
          />
        </View>
      </View>

      <StepList
        emptyCopy={t("quests.dailyNumbers.noStepsYet")}
        steps={localSteps}
        t={t}
        title={t("quests.dailyNumbers.stepHistoryTitle")}
      />
      {archiveMode && officialSolutionSteps.length > 0 ? (
        <>
          <QuestActionButton
            tone="ghost"
            label={
              revealedSolution
                ? t("quests.dailyNumbers.hideSolution")
                : t("quests.dailyNumbers.revealSolution")
            }
            onPress={handleToggleSolution}
            leadingIcon={EyeIcon}
            testID="daily-numbers-archive-reveal-solution"
            accessibilityLabel={
              revealedSolution
                ? t("quests.dailyNumbers.hideSolution")
                : t("quests.dailyNumbers.revealSolution")
            }
            accessibilityState={{ expanded: revealedSolution }}
          />
          {revealedSolution ? (
            <StepList
              steps={officialSolutionSteps}
              t={t}
              title={t("quests.dailyNumbers.officialSolutionTitle")}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}

function LivePlayPanel({
  archiveMode,
  availableTiles,
  interactionLocked,
  localSteps,
  onApplyStep,
  onClearSlot,
  onOperatorPress,
  onResetBoard,
  onSubmitPress,
  onTilePress,
  onToggleSolution,
  onUndoStep,
  officialSolutionSteps,
  previewState,
  revealedSolution,
  selectedLeftTile,
  selectedOperator,
  selectedRightTile,
  submitting,
  target,
  t,
  tc,
}: LivePlayProps) {
  const stageRef = useRef<View>(null);
  const resultRef = useRef<View>(null);
  const futureResultRef = useRef<View>(null);
  const tileRefs = useRef(new Map<string, View>());
  const [commitAnimation, setCommitAnimation] =
    useState<ResultCommitAnimation | null>(null);
  const [preparingCommit, setPreparingCommit] = useState(false);
  const commitLocked =
    interactionLocked || preparingCommit || commitAnimation !== null;
  const committingTileIds = useMemo(
    () =>
      new Set(
        commitAnimation
          ? [commitAnimation.leftId, commitAnimation.rightId]
          : [],
      ),
    [commitAnimation],
  );

  const handleTileRef = useCallback((tileId: string, node: View | null) => {
    if (node) {
      tileRefs.current.set(tileId, node);
      return;
    }

    tileRefs.current.delete(tileId);
  }, []);

  const handleApplyResult = useCallback(async () => {
    if (
      commitLocked ||
      previewState.kind !== "ready" ||
      !selectedLeftTile ||
      !selectedRightTile
    ) {
      return;
    }

    if (previewState.result === target) {
      onApplyStep();
      return;
    }

    const stageNode = stageRef.current;
    const resultNode = resultRef.current;
    const targetNode = futureResultRef.current;
    const leftNode = tileRefs.current.get(selectedLeftTile.id);
    const rightNode = tileRefs.current.get(selectedRightTile.id);

    if (!stageNode || !resultNode || !targetNode || !leftNode || !rightNode) {
      onApplyStep();
      return;
    }

    setPreparingCommit(true);

    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      const [stageRect, resultRect, targetRect, leftRect, rightRect] =
        await Promise.all([
          measureView(stageNode),
          measureView(resultNode),
          measureView(targetNode),
          measureView(leftNode),
          measureView(rightNode),
        ]);

      setCommitAnimation({
        leftId: selectedLeftTile.id,
        leftRect: relativeRect(leftRect, stageRect),
        leftValue: selectedLeftTile.value,
        resultRect: relativeRect(resultRect, stageRect),
        resultId: `r${localSteps.length}`,
        resultValue: previewState.result,
        rightId: selectedRightTile.id,
        rightRect: relativeRect(rightRect, stageRect),
        rightValue: selectedRightTile.value,
        targetRect: relativeRect(targetRect, stageRect),
      });
    } catch (error) {
      console.warn("Failed to measure Daily Numbers result animation", error);
      onApplyStep();
    } finally {
      setPreparingCommit(false);
    }
  }, [
    commitLocked,
    localSteps.length,
    onApplyStep,
    previewState,
    selectedLeftTile,
    selectedRightTile,
    target,
  ]);

  const handleCommitMerged = useCallback(() => {
    onApplyStep();
  }, [onApplyStep]);

  const handleCommitFinished = useCallback(() => {
    requestAnimationFrame(() => setCommitAnimation(null));
  }, []);

  return (
    <>
      <View ref={stageRef} collapsable={false} className="relative gap-ds-3">
        <EquationWorkbench
          committing={preparingCommit || commitAnimation !== null}
          interactionLocked={commitLocked}
          localSteps={localSteps}
          onApplyStep={handleApplyResult}
          onClearSlot={onClearSlot}
          previewState={previewState}
          resultRef={resultRef}
          selectedLeftTile={selectedLeftTile}
          selectedOperator={selectedOperator}
          selectedRightTile={selectedRightTile}
          target={target}
          t={t}
        />
        <AvailableNumbersGrid
          availableTiles={availableTiles}
          committingResultId={commitAnimation?.resultId ?? null}
          committingTileIds={committingTileIds}
          futureResultRef={futureResultRef}
          interactionLocked={commitLocked}
          onTileRef={handleTileRef}
          onTilePress={onTilePress}
          selectedLeftTile={selectedLeftTile}
          selectedOperator={selectedOperator}
          selectedRightTile={selectedRightTile}
          t={t}
        />

        <OperatorPicker
          interactionLocked={commitLocked}
          onOperatorPress={onOperatorPress}
          selectedLeftTile={selectedLeftTile}
          selectedOperator={selectedOperator}
          selectedRightTile={selectedRightTile}
          t={t}
        />
        {commitAnimation ? (
          <OperationCommitOverlay
            animation={commitAnimation}
            onMerged={handleCommitMerged}
            onFinished={handleCommitFinished}
          />
        ) : null}
      </View>

      <LivePlayControls
        archiveMode={archiveMode}
        interactionLocked={commitLocked}
        localSteps={localSteps}
        officialSolutionSteps={officialSolutionSteps}
        onResetBoard={onResetBoard}
        onSubmitPress={onSubmitPress}
        onToggleSolution={onToggleSolution}
        onUndoStep={onUndoStep}
        revealedSolution={revealedSolution}
        submitting={submitting}
        t={t}
        tc={tc}
      />
    </>
  );
}

function useDailyNumbersBoardController({
  activeMode,
  archiveMode,
  bannerMessage,
  chronometerActive,
  claimPending,
  compact,
  modeAccent,
  onClaimReward,
  onResolveResetError,
  onSolutionHuntApplied,
  onSubmissionApplied,
  state,
  t,
  tc,
}: {
  activeMode: DailyNumbersMode;
  archiveMode: boolean;
  bannerMessage: MessageState;
  chronometerActive: boolean;
  claimPending: boolean;
  compact: boolean;
  modeAccent: ReturnType<typeof getModeAccent>;
  onClaimReward: () => void;
  onResolveResetError: (error: unknown) => Promise<boolean>;
  onSolutionHuntApplied: (
    result: DailyNumbersSolutionHuntSubmitResponse,
  ) => void;
  onSubmissionApplied: (nextState: DailyNumbersBoardState) => void;
  state: DailyNumbersBoardState;
  t: TranslateFn;
  tc: ThemeColors;
}) {
  const [interaction, dispatch] = useReducer(
    boardReducer,
    state,
    createBoardInteractionState,
  );
  const solutionHuntActive =
    !archiveMode &&
    state.solutionHunt?.available === true &&
    interaction.retrying;
  const hasLockedSubmission = state.submitted === true && !interaction.retrying;
  useDailyNumbersRankedSessionStart({
    enabled:
      chronometerActive &&
      !archiveMode &&
      !isArchiveState(state) &&
      !state.submitted &&
      !interaction.retrying,
    date: state.date,
    mode: state.mode,
  });
  const chronometer = useDailyNumbersChronometer({
    active:
      chronometerActive && !hasLockedSubmission && !solutionHuntActive,
    attemptScope: solutionHuntActive
      ? "solution-hunt"
      : interaction.retrying
        ? "retry"
        : "initial",
    resetSignal: interaction.retrying ? interaction.retryAttempt : 0,
    submitted: hasLockedSubmission,
    state,
  });

  const board = useMemo(
    () => buildBoard(state.numbers, interaction.steps),
    [interaction.steps, state.numbers],
  );
  const availableTileMap = useMemo(
    () => new Map(board.availableTiles.map((tile) => [tile.id, tile])),
    [board.availableTiles],
  );

  const selectedLeftTile = interaction.selectedLeftId
    ? (availableTileMap.get(interaction.selectedLeftId) ?? null)
    : null;
  const selectedRightTile = interaction.selectedRightId
    ? (availableTileMap.get(interaction.selectedRightId) ?? null)
    : null;

  const currentBestTile = useMemo(() => {
    if (board.availableTiles.length === 0) {
      return null;
    }

    return chooseClosestTile(board.availableTiles, state.target);
  }, [board.availableTiles, state.target]);

  const currentDistance =
    currentBestTile !== null
      ? Math.abs(currentBestTile.value - state.target)
      : state.bestDistance;
  const defaultDistance = useMemo(
    () => getDefaultDistance(state.numbers, state.target),
    [state.numbers, state.target],
  );
  const exactHitReached =
    !hasLockedSubmission &&
    interaction.steps.length > 0 &&
    currentDistance === 0;
  const completionReached =
    !hasLockedSubmission &&
    interaction.steps.length > 0 &&
    currentDistance < defaultDistance;
  const exactHitState =
    (hasLockedSubmission && state.submission?.exact === true) ||
    exactHitReached;
  const finishScreenState = exactHitState || hasLockedSubmission;
  const interactionLocked =
    interaction.submitting || hasLockedSubmission || exactHitReached;
  const previewState = useMemo<PreviewState>(() => {
    if (
      !selectedLeftTile ||
      !interaction.selectedOperator ||
      !selectedRightTile
    ) {
      return { kind: "empty" };
    }

    const result = applyDailyNumbersOperation(
      selectedLeftTile.value,
      interaction.selectedOperator,
      selectedRightTile.value,
    );

    if (!result.ok) {
      return { kind: "invalid", reason: result.reason };
    }

    return { kind: "ready", result: result.result };
  }, [interaction.selectedOperator, selectedLeftTile, selectedRightTile]);

  const submitBoard = useCallback(
    async (stepsToSubmit: DailyNumbersStep[], alreadyStarted = false) => {
      if (hasLockedSubmission || interaction.submitting) {
        return;
      }

      if (!alreadyStarted) {
        dispatch({ type: "submitStarted" });
      }

      try {
        const steps = toStepInputs(stepsToSubmit);

        if (solutionHuntActive) {
          const result = await apiClient.submitDailyNumbersSolutionHunt({
            mode: activeMode,
            dateKey: state.date,
            questVersion: state.questVersion ?? undefined,
            steps,
          });

          dispatch({ type: "solutionHuntSubmitted", result });
          onSolutionHuntApplied(result);
          return;
        }

        const elapsedMs = Math.round(chronometer.getElapsedMs());
        const nextState = archiveMode
          ? await apiClient.submitDailyNumbersArchive({
              mode: activeMode,
              dateKey: state.date,
              elapsedMs,
              steps,
            })
          : await apiClient.submitDailyNumbers({
              mode: activeMode,
              dateKey: state.date,
              questVersion: state.questVersion ?? undefined,
              elapsedMs,
              steps,
            });

        dispatch({ type: "submitFinished" });
        onSubmissionApplied(nextState);
      } catch (error) {
        const handledReset = await onResolveResetError(error);

        if (handledReset) {
          dispatch({ type: "submitFailed", message: null });
          return;
        }

        triggerErrorHaptic();
        dispatch({
          type: "submitFailed",
          message: {
            type: "error",
            text:
              error instanceof Error
                ? error.message
                : t("quests.dailyNumbers.submitError"),
          },
        });
      }
    },
    [
      activeMode,
      archiveMode,
      chronometer.getElapsedMs,
      hasLockedSubmission,
      interaction.submitting,
      onResolveResetError,
      onSolutionHuntApplied,
      onSubmissionApplied,
      solutionHuntActive,
      state,
      t,
    ],
  );

  const handleTilePress = useCallback(
    (tileId: string) => {
      const tile = availableTileMap.get(tileId);

      if (!tile) {
        return;
      }

      const availability = getDailyNumbersTileAvailability({
        interactionLocked,
        selectedLeftTile,
        selectedOperator: interaction.selectedOperator,
        selectedRightTile,
        tile,
      });

      if (availability.disabled) {
        return;
      }

      triggerSelectionHaptic();
      dispatch({ type: "selectTile", tileId });
    },
    [
      availableTileMap,
      interaction.selectedOperator,
      interactionLocked,
      selectedLeftTile,
      selectedRightTile,
    ],
  );

  const handleOperatorPress = useCallback(
    (operator: Operator) => {
      const pressResult = getDailyNumbersOperatorPressResult({
        interactionLocked,
        operator,
        selectedOperator: interaction.selectedOperator,
      });

      if (!pressResult.accepted) {
        return;
      }

      triggerSelectionHaptic();
      dispatch({ type: "toggleOperator", operator });
    },
    [interaction.selectedOperator, interactionLocked],
  );

  const handleClearSlot = useCallback(
    (slot: SlotKey) => {
      if (interactionLocked) {
        return;
      }

      if (
        (slot === "left" && !interaction.selectedLeftId) ||
        (slot === "operator" && !interaction.selectedOperator) ||
        (slot === "right" && !interaction.selectedRightId)
      ) {
        return;
      }

      triggerLightHaptic();
      dispatch({ type: "clearSlot", slot });
    },
    [
      interaction.selectedLeftId,
      interaction.selectedOperator,
      interaction.selectedRightId,
      interactionLocked,
    ],
  );

  const handleApplyStep = useCallback(() => {
    if (interactionLocked) {
      return;
    }

    if (
      !interaction.selectedLeftId ||
      !interaction.selectedOperator ||
      !interaction.selectedRightId
    ) {
      triggerErrorHaptic();
      dispatch({
        type: "setMessage",
        message: {
          type: "error",
          text: t("quests.dailyNumbers.invalidSelection"),
        },
      });
      return;
    }

    if (interaction.selectedLeftId === interaction.selectedRightId) {
      triggerErrorHaptic();
      dispatch({
        type: "setMessage",
        message: {
          type: "error",
          text: t("quests.dailyNumbers.invalidDifferentNumbers"),
        },
      });
      return;
    }

    const leftTile = availableTileMap.get(interaction.selectedLeftId);
    const rightTile = availableTileMap.get(interaction.selectedRightId);

    if (!leftTile || !rightTile) {
      triggerErrorHaptic();
      dispatch({
        type: "setMessage",
        message: {
          type: "error",
          text: t("quests.dailyNumbers.invalidDifferentNumbers"),
        },
      });
      return;
    }

    const operation = applyDailyNumbersOperation(
      leftTile.value,
      interaction.selectedOperator,
      rightTile.value,
    );

    if (!operation.ok) {
      triggerErrorHaptic();
      dispatch({
        type: "setMessage",
        message: {
          type: "error",
          text:
            operation.reason === "division"
              ? t("quests.dailyNumbers.invalidDivision")
              : t("quests.dailyNumbers.invalidPositive"),
        },
      });
      return;
    }

    const nextStep: DailyNumbersStep = {
      leftId: leftTile.id,
      leftValue: leftTile.value,
      operator: interaction.selectedOperator,
      rightId: rightTile.id,
      rightValue: rightTile.value,
      resultId: `r${interaction.steps.length}`,
      resultValue: operation.result,
    };
    const nextSteps = [...interaction.steps, nextStep];
    const nextBoard = buildBoard(state.numbers, nextSteps);
    const nextBestTile =
      nextBoard.availableTiles.length > 0
        ? chooseClosestTile(nextBoard.availableTiles, state.target)
        : null;
    const exactHit =
      nextBestTile !== null && nextBestTile.value === state.target;

    dispatch({
      type: "applyStep",
      step: nextStep,
      autoSubmitting: exactHit,
    });

    triggerPrimaryHaptic();

    if (exactHit) {
      void submitBoard(nextSteps, true);
    }
  }, [availableTileMap, interaction, interactionLocked, state, submitBoard, t]);

  const handleUndoStep = useCallback(() => {
    if (interactionLocked) {
      return;
    }

    if (interaction.steps.length === 0) {
      triggerErrorHaptic();
      dispatch({
        type: "setMessage",
        message: {
          type: "error",
          text: t("quests.dailyNumbers.noUndo"),
        },
      });
      return;
    }

    triggerLightHaptic();
    dispatch({ type: "undoStep" });
  }, [interaction.steps.length, interactionLocked, t]);

  const handleResetBoard = useCallback(() => {
    if (interactionLocked) {
      return;
    }

    if (
      interaction.steps.length === 0 &&
      !interaction.selectedLeftId &&
      !interaction.selectedOperator &&
      !interaction.selectedRightId
    ) {
      triggerErrorHaptic();
      dispatch({
        type: "setMessage",
        message: {
          type: "error",
          text: t("quests.dailyNumbers.noReset"),
        },
      });
      return;
    }

    triggerLightHaptic();
    dispatch({ type: "resetBoard" });
  }, [
    interaction.selectedLeftId,
    interaction.selectedOperator,
    interaction.selectedRightId,
    interaction.steps.length,
    interactionLocked,
    t,
  ]);

  const handleSubmitPress = useCallback(() => {
    if (interaction.submitting || hasLockedSubmission) {
      return;
    }

    triggerPrimaryHaptic();
    Alert.alert(
      archiveMode
        ? t("quests.dailyNumbers.archiveSubmitConfirmTitle")
        : solutionHuntActive
          ? t("quests.dailyNumbers.solutionHuntSubmitConfirmTitle")
        : t("quests.dailyNumbers.submitConfirmTitle"),
      archiveMode
        ? t("quests.dailyNumbers.archiveSubmitConfirmBody")
        : solutionHuntActive
          ? t("quests.dailyNumbers.solutionHuntSubmitConfirmBody")
        : t("quests.dailyNumbers.submitConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: archiveMode
            ? t("quests.dailyNumbers.archiveSubmitConfirmAction")
            : solutionHuntActive
              ? t("quests.dailyNumbers.solutionHuntSubmitConfirmAction")
            : t("quests.dailyNumbers.submitConfirmAction"),
          style: "destructive",
          onPress: () => {
            void submitBoard(interaction.steps);
          },
        },
      ],
    );
  }, [
    archiveMode,
    interaction.steps,
    interaction.submitting,
    hasLockedSubmission,
    solutionHuntActive,
    submitBoard,
    t,
  ]);

  const handleClaimReward = useCallback(() => {
    if (claimPending) {
      return;
    }

    triggerPrimaryHaptic();
    onClaimReward();
  }, [claimPending, onClaimReward]);

  const handleToggleSolution = useCallback(() => {
    triggerLightHaptic();
    dispatch({ type: "toggleSolution" });
  }, []);

  const handleStartRetry = useCallback(() => {
    triggerLightHaptic();
    dispatch({ type: "startRetry" });
  }, []);

  const finishCompletedState =
    exactHitState || state.submission?.completed === true;
  const finishValue =
    (hasLockedSubmission ? state.submission?.finalValue : null) ??
    (finishScreenState ? (currentBestTile?.value ?? null) : null);
  const finishDistance =
    (hasLockedSubmission ? state.submission?.distance : null) ??
    (finishScreenState ? currentDistance : null);
  const finishScore =
    (hasLockedSubmission ? state.submission?.score : null) ??
    (exactHitState ? EXACT_HIT_PERCENT : null);
  const submittedSolutionSteps =
    (hasLockedSubmission ? state.submission?.steps : null) ??
    (exactHitState ? interaction.steps : []);
  const claimable =
    !archiveMode &&
    hasLockedSubmission &&
    state.completed &&
    !state.claimed &&
    Boolean(state.questVersion);
  const visibleMessage = interaction.message ?? bannerMessage;

  return {
    board,
    claimPending,
    claimable,
    compact,
    completionReached,
    currentBestTile,
    currentDistance,
    exactHitState,
    finishCompletedState,
    finishDistance,
    finishScreenState,
    finishScore,
    finishValue,
    formattedElapsedTime:
      hasLockedSubmission && state.submission?.elapsedMs != null
        ? formatDailyNumbersElapsedTime(state.submission.elapsedMs)
        : chronometer.formattedElapsedTime,
    interaction,
    interactionLocked,
    modeAccent,
    onApplyStep: handleApplyStep,
    onClaimReward: handleClaimReward,
    onClearSlot: handleClearSlot,
    onOperatorPress: handleOperatorPress,
    onResetBoard: handleResetBoard,
    onSubmitPress: handleSubmitPress,
    onStartRetry: handleStartRetry,
    onStartSolutionHunt: handleStartRetry,
    onTilePress: handleTilePress,
    onToggleSolution: handleToggleSolution,
    onUndoStep: handleUndoStep,
    previewState,
    selectedLeftTile,
    selectedOperator: interaction.selectedOperator,
    selectedRightTile,
    solutionHuntActive,
    state,
    submittedSolutionSteps,
    officialSolutionSteps: isArchiveState(state)
      ? state.officialSolutionSteps
      : (state.submission?.officialSolutionSteps ?? []),
    t,
    tc,
    visibleMessage,
  };
}

type DailyNumbersBoardController = ReturnType<
  typeof useDailyNumbersBoardController
>;

function useDailyNumbersShare(
  controller: DailyNumbersBoardController,
  archiveMode: boolean,
) {
  const { locale } = useTranslation();
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<View>(null);
  const [shareDateKey, setShareDateKey] = useState(() =>
    resolveQuestShareDateKey({
      archive: archiveMode,
      questDateKey: controller.state.date,
    }),
  );

  // Spoiler-safe share model — only the player's outcome is surfaced, never the
  // solution steps or the official solution.
  const shareResult = useMemo(
    () =>
      buildDailyNumbersShareResult({
        questTitle: controller.t("quests.dailyNumbers.title"),
        modeLabel: controller.t(getModeLabelKey(controller.state.mode)),
        mode: controller.state.mode,
        date: shareDateKey,
        target: controller.state.target,
        finalValue: controller.finishValue,
        distance: controller.finishDistance,
        score: controller.finishScore,
        elapsedTime: controller.formattedElapsedTime,
        exact: controller.exactHitState,
        completed: controller.state.completed,
        archive: archiveMode,
      }),
    [
      controller.t,
      controller.state.mode,
      shareDateKey,
      controller.state.target,
      controller.finishValue,
      controller.finishDistance,
      controller.finishScore,
      controller.formattedElapsedTime,
      controller.exactHitState,
      controller.state.completed,
      archiveMode,
    ],
  );

  const shareStrings = useMemo(() => {
    const resultLine = controller.exactHitState
      ? controller.t("quests.dailyNumbers.shareExact", {
          score: controller.finishScore ?? 100,
        })
      : controller.state.completed
        ? controller.t("quests.dailyNumbers.shareScore", {
            score: controller.finishScore ?? 0,
            distance: controller.finishDistance ?? 0,
          })
        : controller.t("quests.dailyNumbers.shareMissed", {
            distance: controller.finishDistance ?? 0,
          });

    const modeLabelKey =
      controller.state.mode === "1-5"
        ? "quests.dailyNumbers.shareMode1_5"
        : controller.state.mode === "2-4"
          ? "quests.dailyNumbers.shareMode2_4"
          : "quests.dailyNumbers.shareMode3_3";

    return {
      brand: controller.t("quests.dailyNumbers.shareBrand"),
      modeLabel: controller.t(modeLabelKey),
      resultLine,
      targetLabel: controller.t("quests.dailyNumbers.target"),
      resultValueLabel: controller.t(
        "quests.dailyNumbers.shareResultValueLabel",
      ),
      timeLabel: controller.t("quests.dailyNumbers.solveTime"),
      archiveLabel: controller.t("quests.dailyNumbers.archiveResultLabel"),
      footer: archiveMode
        ? controller.t("quests.dailyNumbers.archiveShareFooter")
        : controller.t("quests.dailyNumbers.shareFooter"),
      date: formatQuestShareDate(shareDateKey, locale),
    };
  }, [
    controller.t,
    controller.state.mode,
    shareDateKey,
    controller.exactHitState,
    controller.state.completed,
    controller.finishScore,
    controller.finishDistance,
    locale,
    archiveMode,
  ]);

  const handleShareResult = useCallback(async () => {
    if (isSharing || !shareCardRef.current) {
      return;
    }

    const currentShareDateKey = resolveQuestShareDateKey({
      archive: archiveMode,
      questDateKey: controller.state.date,
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
        Alert.alert(controller.t("quests.dailyNumbers.shareUnavailable"));
        return;
      }

      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      // Copy the temp capture to a readable file name so the share sheet and
      // saved file are recognizable.
      let shareUri = uri;
      try {
        const fileName = buildDailyNumbersShareFileName({
          ...shareResult,
          date: currentShareDateKey,
        });
        const destination = new File(Paths.cache, fileName);
        if (destination.exists) {
          destination.delete();
        }
        await new File(uri).copy(destination);
        shareUri = destination.uri;
      } catch (copyError) {
        console.warn("Failed to rename Daily Numbers share image", copyError);
      }

      await Sharing.shareAsync(shareUri, {
        mimeType: "image/png",
        dialogTitle: controller.t("quests.dailyNumbers.shareDialogTitle"),
        UTI: "public.png",
      });
    } catch (error) {
      console.warn("Failed to share Daily Numbers result", error);
      Alert.alert(controller.t("quests.dailyNumbers.shareError"));
    } finally {
      setIsSharing(false);
    }
  }, [
    archiveMode,
    controller.state.date,
    controller.t,
    isSharing,
    shareResult,
  ]);

  return {
    handleShareResult,
    isSharing,
    shareCardRef,
    shareResult,
    shareStrings,
  };
}

function DailyNumbersBoard({
  activeMode,
  archiveMode,
  bannerMessage,
  chronometerActive,
  claimPending,
  compact,
  modeAccent,
  onClaimReward,
  onResolveResetError,
  onSolutionHuntApplied,
  onSubmissionApplied,
  scrollViewRef,
  state,
  t,
  tc,
}: {
  activeMode: DailyNumbersMode;
  archiveMode: boolean;
  bannerMessage: MessageState;
  chronometerActive: boolean;
  claimPending: boolean;
  compact: boolean;
  modeAccent: ReturnType<typeof getModeAccent>;
  onClaimReward: () => void;
  onResolveResetError: (error: unknown) => Promise<boolean>;
  onSolutionHuntApplied: (
    result: DailyNumbersSolutionHuntSubmitResponse,
  ) => void;
  onSubmissionApplied: (nextState: DailyNumbersBoardState) => void;
  scrollViewRef: RefObject<ScrollView | null>;
  state: DailyNumbersBoardState;
  t: TranslateFn;
  tc: ThemeColors;
}) {
  const controller = useDailyNumbersBoardController({
    activeMode,
    archiveMode,
    bannerMessage,
    chronometerActive,
    claimPending,
    compact,
    modeAccent,
    onClaimReward,
    onResolveResetError,
    onSolutionHuntApplied,
    onSubmissionApplied,
    state,
    t,
    tc,
  });

  const {
    handleShareResult,
    isSharing,
    shareCardRef,
    shareResult,
    shareStrings,
  } = useDailyNumbersShare(controller, archiveMode);
  const announcedResultKeyRef = useRef<string | null>(null);
  const resultKey = buildPuzzleIdentity(controller.state);

  useEffect(() => {
    if (!controller.finishScreenState) {
      if (announcedResultKeyRef.current === resultKey) {
        announcedResultKeyRef.current = null;
      }
      return;
    }

    const announcement = controller.exactHitState
      ? controller.t("quests.dailyNumbers.exactHitLabel")
      : controller.finishDistance == null
        ? controller.t("quests.dailyNumbers.resultLockedLabel")
        : controller.t("quests.dailyNumbers.distanceOutcome", {
            distance: controller.finishDistance,
          });

    if (!announcement || announcedResultKeyRef.current === resultKey) {
      return;
    }

    announcedResultKeyRef.current = resultKey;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        AccessibilityInfo.announceForAccessibility(announcement);
      });
    });
  }, [
    controller.exactHitState,
    controller.finishDistance,
    controller.finishScreenState,
    controller.t,
    resultKey,
    scrollViewRef,
  ]);

  return (
    <>
      <MessageBanner message={controller.visibleMessage} />
      {controller.solutionHuntActive ? (
        <Notice
          tone="info"
          title={controller.t("quests.dailyNumbers.solutionHuntTitle")}
          body={controller.t("quests.dailyNumbers.solutionHuntPlayingBody")}
          testID="daily-numbers-solution-hunt-playing"
        />
      ) : null}
      {controller.completionReached && !controller.finishScreenState ? (
        <SuccessCallout
          archiveMode={archiveMode}
          completionReached={controller.completionReached}
          t={controller.t}
          tc={controller.tc}
        />
      ) : null}

      <View collapsable={false} className="flex-1">
        {controller.finishScreenState ? (
          <Animated.View
            key="daily-numbers-finish"
            entering={FadeInUp.duration(240)}
            className="flex-1"
          >
            <FinishStatePanel
              claimable={controller.claimable}
              claimPending={controller.claimPending}
              archiveMode={archiveMode}
              canRetryArchive={archiveMode && !controller.exactHitState}
              compact={controller.compact}
              exactHitState={controller.exactHitState}
              finishCompleted={controller.finishCompletedState}
              finishDistance={controller.finishDistance}
              finishScore={controller.finishScore}
              finishValue={controller.finishValue}
              formattedElapsedTime={controller.formattedElapsedTime}
              interaction={controller.interaction}
              isSharing={isSharing}
              onClaimReward={controller.onClaimReward}
              onShareResult={handleShareResult}
              onStartRetry={controller.onStartRetry}
              onStartSolutionHunt={controller.onStartSolutionHunt}
              onToggleSolution={controller.onToggleSolution}
              officialSolutionSteps={controller.officialSolutionSteps}
              state={controller.state}
              submittedSolutionSteps={controller.submittedSolutionSteps}
              t={controller.t}
              tc={controller.tc}
            />
          </Animated.View>
        ) : (
          <Animated.View
            key="daily-numbers-live"
            exiting={FadeOutUp.duration(180)}
            className="flex-1 gap-ds-3"
          >
            <MetricsSection
              currentBestTile={controller.currentBestTile}
              currentDistance={controller.currentDistance}
              formattedElapsedTime={controller.formattedElapsedTime}
              showSolutionFound={
                controller.solutionHuntActive &&
                ((controller.interaction.solutionHuntResult ??
                  controller.state.solutionHunt)?.solutionsFound ?? 0) > 0
              }
              state={controller.state}
              t={controller.t}
            />
            <LivePlayPanel
              availableTiles={controller.board.availableTiles}
              archiveMode={archiveMode}
              interactionLocked={controller.interactionLocked}
              localSteps={controller.interaction.steps}
              onApplyStep={controller.onApplyStep}
              onClearSlot={controller.onClearSlot}
              onOperatorPress={controller.onOperatorPress}
              onResetBoard={controller.onResetBoard}
              onSubmitPress={controller.onSubmitPress}
              onTilePress={controller.onTilePress}
              onToggleSolution={controller.onToggleSolution}
              onUndoStep={controller.onUndoStep}
              officialSolutionSteps={controller.officialSolutionSteps}
              previewState={controller.previewState}
              revealedSolution={controller.interaction.revealedSolution}
              selectedLeftTile={controller.selectedLeftTile}
              selectedOperator={controller.selectedOperator}
              selectedRightTile={controller.selectedRightTile}
              submitting={controller.interaction.submitting}
              target={controller.state.target}
              t={controller.t}
              tc={controller.tc}
            />
          </Animated.View>
        )}
      </View>

      {!controller.finishScreenState ? (
        <Text className="mt-ds-5 px-ds-1 font-nunito text-ds-caption text-fgMuted">
          {archiveMode
            ? controller.t("quests.dailyNumbers.archiveHelperLine")
            : controller.t("quests.dailyNumbers.helperLine")}
        </Text>
      ) : null}

      {/* Offscreen, capture-friendly share card. Rendered (not display:none)
          and laid out off-screen so react-native-view-shot can snapshot it. */}
      {controller.finishScreenState ? (
        <View
          accessibilityElementsHidden
          pointerEvents="none"
          collapsable={false}
          importantForAccessibility="no-hide-descendants"
          style={{ position: "absolute", left: -9999, top: 0 }}
        >
          <View ref={shareCardRef} collapsable={false}>
            <DailyNumbersQuestShareCard
              result={shareResult}
              colors={controller.tc}
              strings={shareStrings}
            />
          </View>
        </View>
      ) : null}
    </>
  );
}

type DailyNumbersPlayViewProps = {
  activeMode: DailyNumbersMode;
  archiveDate: string | null;
  archiveMode: boolean;
  bannerMessage: MessageState;
  boardIdentity: string | null;
  chronometerActive: boolean;
  claimPending: boolean;
  compact: boolean;
  insets: ReturnType<typeof useSafeAreaInsets>;
  modeAccent: ReturnType<typeof getModeAccent>;
  modeCards: ModeCard[];
  onClaimReward: () => void;
  onModeSelect: (mode: DailyNumbersMode) => void;
  onResolveResetError: (error: unknown) => Promise<boolean>;
  onSolutionHuntApplied: (
    result: DailyNumbersSolutionHuntSubmitResponse,
  ) => void;
  onSubmissionApplied: (nextState: DailyNumbersBoardState) => void;
  state: DailyNumbersBoardState;
  t: TranslateFn;
  tc: ThemeColors;
};

function DailyNumbersPlayView({
  activeMode,
  archiveDate,
  archiveMode,
  bannerMessage,
  boardIdentity,
  chronometerActive,
  claimPending,
  compact,
  insets,
  modeAccent,
  modeCards,
  onClaimReward,
  onModeSelect,
  onResolveResetError,
  onSolutionHuntApplied,
  onSubmissionApplied,
  state,
  t,
  tc,
}: DailyNumbersPlayViewProps) {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <StackHeader
        title={t("quests.dailyNumbers.title")}
        backLabel={
          archiveMode
            ? t("quests.dailyNumbers.backToHistory")
            : t("quests.dailyNumbers.backToQuests")
        }
        backTestID="daily-numbers-back"
        onBack={() =>
          navigateBackFromQuest(
            router,
            archiveMode ? "/quests/daily-numbers-history" : "/(tabs)/quests",
          )
        }
        trailing={
          archiveMode
            ? undefined
            : {
                icon: RotateCcwClock,
                accessibilityLabel: t("quests.dailyNumbers.historyAction"),
                onPress: () =>
                  router.push("/quests/daily-numbers-history" as never),
                testID: "daily-numbers-history-button",
              }
        }
      />

      <ScrollView
        ref={scrollViewRef}
        className="flex-1 bg-bg"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="gap-ds-3 px-ds-4 pt-ds-3"
          style={{ paddingBottom: insets.bottom + 24 }}
        >
          {archiveMode ? (
            <Notice
              tone="info"
              icon={Archive}
              title={t("quests.dailyNumbers.archiveDateMeta", {
                date: archiveDate ?? "",
              })}
              body={t("quests.dailyNumbers.archiveSubtitle")}
              testID="daily-numbers-archive-pill"
            />
          ) : null}

          <ModeTabs
            activeMode={activeMode}
            archiveMode={archiveMode}
            modeCards={modeCards}
            onSelectMode={onModeSelect}
            t={t}
          />

          <DailyNumbersBoard
            key={boardIdentity}
            activeMode={activeMode}
            archiveMode={archiveMode}
            bannerMessage={bannerMessage}
            chronometerActive={chronometerActive}
            claimPending={claimPending}
            compact={compact}
            modeAccent={modeAccent}
            onClaimReward={onClaimReward}
            onResolveResetError={onResolveResetError}
            onSolutionHuntApplied={onSolutionHuntApplied}
            onSubmissionApplied={onSubmissionApplied}
            scrollViewRef={scrollViewRef}
            state={state}
            t={t}
            tc={tc}
          />
        </View>
      </ScrollView>
    </View>
  );
}

export default function DailyNumbersPlayScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string;
    archiveDate?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const patchUser = useSessionStore((state) => state.patchUser);
  const questTimeZone = useSessionStore(
    (state) => state.user?.timezone ?? DEFAULT_QUEST_TIME_ZONE,
  );
  const lastQuestResetAt = useQuestResetStore((state) => state.lastResetAt);
  const lastQuestResetPayload = useQuestResetStore(
    (state) => state.lastPayload,
  );
  const resetNoticeKeyRef = useRef<string | null>(null);

  const compact = height < 820 || width < 390;
  const initialMode = normalizeDailyNumbersMode(params.mode);
  const archiveDate = normalizeArchiveDateParam(params.archiveDate);
  const archiveMode = archiveDate !== null;
  const [activeMode, setActiveMode] = useState<DailyNumbersMode>(initialMode);
  const [screenFocused, setScreenFocused] = useState(false);
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active",
  );
  const [uiMessage, setUiMessage] = useState<MessageState>(null);

  const modeQueries = useQueries({
    queries: DAILY_NUMBERS_MODES.map((mode) => ({
      queryKey: archiveMode
        ? (["daily-numbers-archive", archiveDate, mode] as const)
        : (["daily-numbers", mode] as const),
      queryFn: () =>
        archiveMode
          ? apiClient.dailyNumbersArchiveState(archiveDate ?? "", mode)
          : apiClient.dailyNumbersState(mode),
    })),
  });

  const modeCards = useMemo<ModeCard[]>(
    () =>
      DAILY_NUMBERS_MODES.map((mode, index) => ({
        mode,
        state: modeQueries[index].data,
        isLoading: modeQueries[index].isLoading || modeQueries[index].isPending,
      })),
    [modeQueries],
  );
  const activeQueryIndex = Math.max(DAILY_NUMBERS_MODES.indexOf(activeMode), 0);
  const activeQuery = modeQueries[activeQueryIndex];
  const state = modeCards[activeQueryIndex].state;
  const modeAccent = getModeAccent(activeMode, tc);
  const resetNoticeMessage = useMemo<MessageState>(() => {
    if (archiveMode) {
      return null;
    }

    if (!lastQuestResetAt || !lastQuestResetPayload) {
      return null;
    }

    const expectedQuestType = getQuestTypeForMode(activeMode);

    if (
      lastQuestResetPayload.questType &&
      lastQuestResetPayload.questType !== expectedQuestType
    ) {
      return null;
    }

    return {
      type: "success",
      text: lastQuestResetPayload.resetByName
        ? t("quests.dailyNumbers.adminResetNotice", {
            name: lastQuestResetPayload.resetByName,
          })
        : t("quests.dailyNumbers.resetNotice"),
    };
  }, [activeMode, archiveMode, lastQuestResetAt, lastQuestResetPayload, t]);

  useEffect(() => {
    setActiveMode(normalizeDailyNumbersMode(params.mode));
  }, [params.mode]);

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);

      return () => {
        setScreenFocused(false);
      };
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppActive(nextState === "active");
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!resetNoticeMessage || !lastQuestResetAt || !lastQuestResetPayload) {
      return;
    }

    const resetNoticeKey = [
      activeMode,
      lastQuestResetAt,
      lastQuestResetPayload.questType ?? "all",
      lastQuestResetPayload.resetDate ?? "no-date",
    ].join(":");

    if (resetNoticeKeyRef.current === resetNoticeKey) {
      return;
    }

    resetNoticeKeyRef.current = resetNoticeKey;
    void queryClient.refetchQueries({
      queryKey: ["daily-numbers", activeMode],
      exact: true,
    });
  }, [
    activeMode,
    lastQuestResetAt,
    lastQuestResetPayload,
    queryClient,
    resetNoticeMessage,
  ]);

  const claimQuestMutation = useMutation({
    mutationFn: (questId: string) => apiClient.claimQuest({ questId }),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["daily-numbers", activeMode],
          exact: true,
        }),
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
      await patchUser({ coins: data.newBalance });
      setUiMessage({
        type: "success",
        text: t("quests.claimSuccess", {
          amount: state?.reward ?? 0,
        }),
      });
    },
    onError: () => {
      setUiMessage({
        type: "error",
        text: t("quests.claimFailed"),
      });
    },
  });

  const handleModeSelect = useCallback(
    (mode: DailyNumbersMode) => {
      setActiveMode(mode);
      setUiMessage(null);
      router.setParams({ mode });
    },
    [router],
  );

  const handleResetError = useCallback(
    async (error: unknown) => {
      if (archiveMode) {
        return false;
      }

      if (
        error instanceof ApiClientError &&
        error.code === "DAILY_NUMBERS_RESET"
      ) {
        setUiMessage({
          type: "error",
          text: t("quests.dailyNumbers.resetNotice"),
        });
        await queryClient.refetchQueries({
          queryKey: ["daily-numbers", activeMode],
          exact: true,
        });
        void queryClient.invalidateQueries({ queryKey: ["quests"] });
        return true;
      }

      return false;
    },
    [activeMode, archiveMode, queryClient, t],
  );

  const handleSubmissionApplied = useCallback(
    (nextState: DailyNumbersBoardState) => {
      if (!archiveMode && !isCurrentQuestDay(nextState.date, questTimeZone)) {
        return;
      }

      if (archiveMode) {
        queryClient.setQueryData(
          ["daily-numbers-archive", archiveDate, activeMode],
          nextState,
        );
        void queryClient.invalidateQueries({
          queryKey: ["daily-numbers-archive-history"],
        });
      } else {
        queryClient.setQueryData(["daily-numbers", activeMode], nextState);
        void queryClient.invalidateQueries({ queryKey: ["quests"] });
      }
      setUiMessage(null);
    },
    [activeMode, archiveDate, archiveMode, queryClient, questTimeZone],
  );

  const handleSolutionHuntApplied = useCallback(
    (result: DailyNumbersSolutionHuntSubmitResponse) => {
      queryClient.setQueryData<DailyNumbersStateResponse>(
        ["daily-numbers", activeMode],
        (current) =>
          current
            ? {
                ...current,
                solutionHunt: {
                  available: true,
                  solutionsFound: result.solutionsFound,
                  totalSolutions: result.totalSolutions,
                  allSolutionsFound: result.allSolutionsFound,
                  yourSolutions: result.yourSolutions,
                  otherSolutions: result.otherSolutions,
                },
              }
            : current,
      );
      setUiMessage(null);
    },
    [activeMode, queryClient],
  );

  const boardIdentity = state ? buildBoardIdentity(state) : null;
  const bannerMessage = uiMessage ?? resetNoticeMessage;
  const chronometerActive = screenFocused && appActive;

  if ((activeQuery.isLoading || activeQuery.isPending) && !state) {
    return (
      <PageLoadingState
        title={t("quests.dailyNumbers.title")}
        message={t("common.loadingStates.pageBody")}
        icon="sparkles"
      />
    );
  }

  if (activeQuery.isError || !state) {
    return (
      <PageErrorState
        error={activeQuery.error}
        title={t("quests.dailyNumbers.loadError")}
        body={t("common.errorStates.generic.body")}
        detail={t("common.errorStates.generic.detail")}
        onRetry={() => {
          void activeQuery.refetch();
        }}
        onBack={() =>
          navigateBackFromQuest(
            router,
            archiveMode ? "/quests/daily-numbers-history" : "/(tabs)/quests",
          )
        }
        backLabel={
          archiveMode
            ? t("quests.dailyNumbers.backToHistory")
            : t("quests.dailyNumbers.backToQuests")
        }
      />
    );
  }

  return (
    <DailyNumbersPlayView
      activeMode={activeMode}
      archiveDate={archiveDate}
      archiveMode={archiveMode}
      bannerMessage={bannerMessage}
      boardIdentity={boardIdentity}
      chronometerActive={chronometerActive}
      claimPending={claimQuestMutation.isPending}
      compact={compact}
      insets={insets}
      modeAccent={modeAccent}
      modeCards={modeCards}
      onClaimReward={() => {
        if (state.questVersion) {
          claimQuestMutation.mutate(state.questVersion);
        }
      }}
      onModeSelect={handleModeSelect}
      onResolveResetError={handleResetError}
      onSolutionHuntApplied={handleSolutionHuntApplied}
      onSubmissionApplied={handleSubmissionApplied}
      state={state}
      t={t}
      tc={tc}
    />
  );
}
