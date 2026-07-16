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
  type LayoutChangeEvent,
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
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import {
  ApiClientError,
  type DailyNumbersArchiveStateResponse,
  type DailyNumbersMode,
  type DailyNumbersStateResponse,
  type DailyNumbersStep,
  type DailyNumbersStepInput,
} from "@adventure-time/api-client";

import { PageErrorState } from "../../src/components/error-state";
import {
  CheckIcon,
  ClockIcon,
  CoinIcon,
  EyeIcon,
  RecycleIcon,
  ShareIcon,
  SkipBackIcon,
} from "../../src/components/icons";
import { PageLoadingState } from "../../src/components/loading-state";
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
import {
  navigateBackFromQuest,
  QuestScreenDescription,
  QuestScreenHeader,
} from "../../src/features/quests/quest-screen-header";
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
  onToggleSolution: () => void;
  state: DailyNumbersBoardState;
  submittedSolutionSteps: DailyNumbersStep[];
  officialSolutionSteps: DailyNumbersStep[];
  t: TranslateFn;
  tc: ThemeColors;
};
type LivePlayProps = {
  availableTiles: BoardTile[];
  compact: boolean;
  interactionLocked: boolean;
  localSteps: DailyNumbersStep[];
  modeAccent: ReturnType<typeof getModeAccent>;
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
  compact: boolean;
  committingResultId: string | null;
  committingTileIds: ReadonlySet<string>;
  futureResultRef: RefObject<View | null>;
  interactionLocked: boolean;
  modeAccent: ReturnType<typeof getModeAccent>;
  onTileRef: (tileId: string, node: View | null) => void;
  onTilePress: (tileId: string) => void;
  selectedLeftTile: BoardTile | null;
  selectedOperator: Operator | null;
  selectedRightTile: BoardTile | null;
  t: TranslateFn;
  tc: ThemeColors;
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
  compact: boolean;
  interactionLocked: boolean;
  onOperatorPress: (operator: Operator) => void;
  selectedLeftTile: BoardTile | null;
  selectedOperator: Operator | null;
  selectedRightTile: BoardTile | null;
  t: TranslateFn;
  tc: ThemeColors;
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

function getBoardNumberTextClass(compact: boolean) {
  return compact ? "text-[22px] leading-[28px]" : "text-[25px] leading-[32px]";
}

function getBoardTileHeightClass(compact: boolean) {
  return compact ? "h-[58px]" : "h-16";
}

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
    };
  }

  return {
    ...state,
    revealedSolution: !state.revealedSolution,
  };
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

  const resetElapsedMs = useCallback(() => {
    elapsedMsRef.current = 0;
    startedAtRef.current = active && !submitted ? Date.now() : null;
    lastSavedAtRef.current = Date.now();
    void SecureStore.setItemAsync(storageKey, "0");
    forceTick();
  }, [active, storageKey, submitted]);

  const elapsedMs = submitted ? submittedElapsedMs : getElapsedMs();

  return {
    elapsedMs,
    formattedElapsedTime: formatDailyNumbersElapsedTime(elapsedMs),
    getElapsedMs,
    resetElapsedMs,
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
      className={`mb-3 rounded-xl px-3 py-2.5 ${message.type === "success" ? "bg-successTint" : "bg-dangerTint"}`}
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
  tc,
}: {
  activeMode: DailyNumbersMode;
  archiveMode: boolean;
  modeCards: ModeCard[];
  onSelectMode: (mode: DailyNumbersMode) => void;
  t: TranslateFn;
  tc: ThemeColors;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const indicatorX = useSharedValue(0);
  const tabGap = 6;
  const tabPadding = 4;
  const activeIndex = Math.max(
    0,
    modeCards.findIndex(({ mode }) => mode === activeMode),
  );
  const tabWidth =
    containerWidth > 0 ? (containerWidth - tabPadding * 2 - tabGap * 2) / 3 : 0;
  const activeAccent = getModeAccent(activeMode, tc);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  useEffect(() => {
    if (tabWidth <= 0) {
      return;
    }

    indicatorX.value = withSpring(
      tabPadding + activeIndex * (tabWidth + tabGap),
      {
        damping: 20,
        stiffness: 210,
        mass: 0.72,
      },
    );
  }, [activeIndex, indicatorX, tabWidth]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <View
      className="relative mb-4 flex-row gap-1.5 rounded-2xl p-1"
      onLayout={handleLayout}
    >
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          className="absolute bottom-1 left-0 top-1 rounded-xl"
          style={[
            {
              width: tabWidth,
              backgroundColor: activeAccent.bg,
            },
            indicatorStyle,
          ]}
        />
      ) : null}
      {modeCards.map(({ mode, state, isLoading }) => {
        const selected = mode === activeMode;
        const statusLabel =
          archiveMode && state?.submission
            ? t("quests.dailyNumbers.archiveSavedLabel")
            : getModeStatusLabel(state, isLoading, t);
        const modeLabel = t(getModeLabelKey(mode));
        const modeAccent = getModeAccent(mode, tc);

        return (
          <Pressable
            key={mode}
            onPress={() => {
              triggerSelectionHaptic();
              onSelectMode(mode);
            }}
            className="min-h-[64px] flex-1 items-center justify-center rounded-xl px-1.5 py-2.5"
            style={({ pressed }) => ({
              opacity: pressed ? 0.72 : 1,
              zIndex: 1,
            })}
            testID={`daily-numbers-mode-${mode}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${modeLabel}. ${statusLabel}`}
          >
            <Text
              className="text-center font-nunito-extrabold text-[15px]"
              style={{ color: selected ? modeAccent.text : tc.fg }}
              numberOfLines={1}
            >
              {modeLabel}
            </Text>
            <Text
              className="mt-0.5 min-h-6 text-center font-nunito-bold text-[10px] leading-3"
              style={{ color: selected ? modeAccent.text : tc.fgMuted }}
              numberOfLines={2}
            >
              {statusLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function InlineMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <View className="min-w-0 items-center justify-center px-1.5 py-2.5">
      <Text
        className="text-center font-nunito-bold text-[9px] uppercase tracking-[0.8px] text-fgMuted"
        numberOfLines={2}
      >
        {label}
      </Text>
      <Text
        className="mt-0.5 text-center font-nunito-extrabold text-lg leading-6 text-fg"
        style={{ fontVariant: ["tabular-nums"] }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function MetricsSection({
  compact,
  currentBestTile,
  currentDistance,
  formattedElapsedTime,
  modeAccent,
  state,
  t,
  tc,
}: {
  compact: boolean;
  currentBestTile: BoardTile | null;
  currentDistance: number | undefined;
  formattedElapsedTime: string;
  modeAccent: ReturnType<typeof getModeAccent>;
  state: DailyNumbersBoardState;
  t: TranslateFn;
  tc: ThemeColors;
}) {
  const { fontScale } = useWindowDimensions();
  const stackMetrics = fontScale >= 1.4;

  return (
    <View className="pb-4">
      <View className={`${compact ? "py-2" : "py-3"} items-center`}>
        <Text className="font-nunito-extrabold text-[10px] uppercase tracking-[1.4px] text-fgMuted">
          {t("quests.dailyNumbers.target")}
        </Text>
        <Text
          className={`${compact ? "text-[52px] leading-[58px]" : "text-[60px] leading-[66px]"} font-nunito-extrabold`}
          style={{ color: modeAccent.text, fontVariant: ["tabular-nums"] }}
          numberOfLines={1}
          selectable
          testID="daily-numbers-target"
        >
          {state.target}
        </Text>
      </View>
      <View
        className={`${stackMetrics ? "flex-col" : "flex-row"} border-y border-primaryBorder`}
      >
        {stackMetrics ? (
          <>
            <View className="w-full flex-row">
              <View className="flex-1">
                <InlineMetric
                  label={t("quests.dailyNumbers.bestResult")}
                  value={currentBestTile?.value ?? "—"}
                />
              </View>
              <View className="my-2.5 w-px bg-primaryBorder" />
              <View className="flex-1">
                <InlineMetric
                  label={t("quests.dailyNumbers.bestDistance")}
                  value={currentDistance ?? state.bestDistance}
                />
              </View>
            </View>
            <View className="h-px w-full bg-primaryBorder" />
            <View className="w-full">
              <InlineMetric
                label={t("quests.dailyNumbers.solveTime")}
                value={formattedElapsedTime}
              />
            </View>
          </>
        ) : (
          <>
            <View className="flex-1">
              <InlineMetric
                label={t("quests.dailyNumbers.bestResult")}
                value={currentBestTile?.value ?? "—"}
              />
            </View>
            <View className="my-2.5 w-px bg-primaryBorder" />
            <View className="flex-1">
              <InlineMetric
                label={t("quests.dailyNumbers.bestDistance")}
                value={currentDistance ?? state.bestDistance}
              />
            </View>
            <View className="my-2.5 w-px bg-primaryBorder" />
            <View className="flex-1">
              <InlineMetric
                label={t("quests.dailyNumbers.solveTime")}
                value={formattedElapsedTime}
              />
            </View>
          </>
        )}
      </View>
    </View>
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
      className="mb-3 flex-row items-start gap-2 px-1"
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
  return (
    <>
      <View className="mt-6 border-t border-primaryBorder pt-4">
        <Text className="font-nunito-extrabold text-sm text-fg">
          {t("quests.dailyNumbers.startingNumbersTitle")}
        </Text>
        <View className="mt-2 flex-row flex-wrap items-center gap-2">
          {state.numbers.map((tile) => (
            <View
              className="h-11 min-w-[46px] items-center justify-center rounded-xl border border-primaryBorder bg-surface px-2"
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
      {submittedSolutionSteps.length > 0 ? (
        <StepList
          steps={submittedSolutionSteps}
          t={t}
          title={t("quests.dailyNumbers.solutionUsedTitle")}
        />
      ) : null}
      {officialSolutionSteps.length > 0 ? (
        <>
          <QuestActionButton
            label={
              interaction.revealedSolution
                ? t("quests.dailyNumbers.hideSolution")
                : t("quests.dailyNumbers.revealSolution")
            }
            onPress={onToggleSolution}
            backgroundColor={tc.bg}
            foregroundColor={tc.primaryText}
            leadingIcon={EyeIcon}
            minHeight={48}
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

  return (
    <View className="pt-1" testID="daily-numbers-result">
      <Animated.View
        entering={FadeIn.duration(220)}
        className="relative mb-1 items-center overflow-hidden rounded-[28px] border px-4 pb-5 pt-5"
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
          label={t("quests.dailyNumbers.claimReward", {
            reward: state.reward,
          })}
          onPress={onClaimReward}
          loading={claimPending}
          loadingMode="inline"
          backgroundColor={tc.primaryStrong}
          foregroundColor="#FFFFFF"
          leadingAccessory={<CoinIcon size={18} />}
          minHeight={48}
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
          label={t("quests.dailyNumbers.archiveTryAgain")}
          onPress={onStartRetry}
          backgroundColor={tc.primaryStrong}
          foregroundColor="#FFFFFF"
          leadingIcon={RecycleIcon}
          minHeight={48}
          style={{ marginTop: 12 }}
          testID="daily-numbers-archive-retry"
          accessibilityLabel={t("quests.dailyNumbers.archiveTryAgain")}
        />
      ) : null}
      <QuestActionButton
        label={
          isSharing
            ? t("quests.dailyNumbers.sharePreparing")
            : t("quests.dailyNumbers.shareResult")
        }
        onPress={onShareResult}
        loading={isSharing}
        loadingMode="inline"
        backgroundColor={tc.surface}
        foregroundColor={tc.primaryText}
        borderColor={tc.primaryBorder}
        leadingIcon={ShareIcon}
        minHeight={48}
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

function AvailableNumbersGrid({
  availableTiles,
  compact,
  committingResultId,
  committingTileIds,
  futureResultRef,
  interactionLocked,
  modeAccent,
  onTileRef,
  onTilePress,
  selectedLeftTile,
  selectedOperator,
  selectedRightTile,
  t,
  tc,
}: AvailableNumbersGridProps) {
  const boardNumberTextClass = getBoardNumberTextClass(compact);
  const commitInProgress =
    committingTileIds.size > 0 || committingResultId !== null;
  const futureTileCount =
    selectedLeftTile && selectedOperator && selectedRightTile
      ? Math.max(1, availableTiles.length - 1)
      : 0;

  return (
    <View className="mt-5">
      <View className="flex-row items-baseline justify-between">
        <Text className="font-nunito-extrabold text-sm text-fg">
          {t("quests.dailyNumbers.availableNumbers")}
        </Text>
        <Text
          className="font-nunito-bold text-xs text-fgMuted"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {availableTiles.length}
        </Text>
      </View>
      <View className="relative mt-2.5 flex-row flex-wrap justify-between gap-y-2">
        {futureTileCount > 0 ? (
          <View
            pointerEvents="none"
            className="absolute inset-0 flex-row flex-wrap justify-between gap-y-2 opacity-0"
          >
            {Array.from({ length: futureTileCount }, (_, index) => (
              <View
                key={`future-slot-${index}`}
                ref={
                  index === futureTileCount - 1 ? futureResultRef : undefined
                }
                collapsable={false}
                className={getBoardTileHeightClass(compact)}
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

          return (
            <Animated.View
              key={tile.id}
              ref={(node: View | null) => onTileRef(tile.id, node)}
              collapsable={false}
              entering={
                tile.source === "derived" ? undefined : FadeIn.duration(180)
              }
              exiting={FadeOut.duration(140)}
              layout={LinearTransition.duration(200)}
              style={{ width: BOARD_TILE_WIDTH }}
            >
              <Pressable
                onPress={() => onTilePress(tile.id)}
                disabled={availability.disabled}
                className={`${getBoardTileHeightClass(compact)} items-center justify-center overflow-hidden rounded-xl px-2 py-2`}
                style={{
                  borderColor: availability.selected
                    ? modeAccent.text
                    : tile.source === "derived"
                      ? tc.primaryStrong
                      : "transparent",
                  borderWidth: 2,
                  backgroundColor: availability.selected
                    ? modeAccent.bg
                    : tile.source === "derived"
                      ? tc.surface
                      : tc.surface,
                  opacity:
                    committingTileIds.has(tile.id) ||
                    tile.id === committingResultId
                      ? 0
                      : !commitInProgress &&
                          availability.disabled &&
                          !availability.selected
                        ? 0.4
                        : 1,
                }}
                testID={`daily-numbers-tile-${tile.id}`}
                accessibilityRole="button"
                accessibilityState={{
                  selected: availability.selected,
                  disabled: availability.disabled,
                }}
                accessibilityLabel={t("quests.dailyNumbers.tileValue", {
                  value: tile.value,
                })}
              >
                {tile.source === "derived" ? (
                  <Text
                    className="absolute right-2 top-1 font-nunito-extrabold text-[10px] text-fgMuted"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    ✦
                  </Text>
                ) : null}
                <Text
                  className={`${boardNumberTextClass} text-center font-nunito-extrabold`}
                  style={{
                    color: availability.selected
                      ? modeAccent.text
                      : tile.source === "derived"
                        ? tc.primaryStrong
                        : tc.fg,
                    fontVariant: ["tabular-nums"],
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit={String(tile.value).length > 3}
                  minimumFontScale={0.68}
                >
                  {tile.value}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

function OperatorPicker({
  compact,
  interactionLocked,
  onOperatorPress,
  selectedLeftTile,
  selectedOperator,
  selectedRightTile,
  t,
  tc,
}: OperatorPickerProps) {
  const boardNumberTextClass = getBoardNumberTextClass(compact);

  return (
    <View className="mt-5">
      <Text className="font-nunito-extrabold text-sm text-fg">
        {t("quests.dailyNumbers.operators")}
      </Text>
      <View className="mt-2 flex-row gap-2">
        {OPERATORS.map((operator) => {
          const availability = getDailyNumbersOperatorAvailability({
            interactionLocked,
            operator,
            selectedLeftTile,
            selectedOperator,
            selectedRightTile,
          });

          return (
            <Pressable
              key={operator}
              onPress={() => onOperatorPress(operator)}
              disabled={availability.disabled}
              className={`${compact ? "min-h-[58px]" : "min-h-[64px]"} flex-1 items-center justify-center rounded-xl border px-2 py-2`}
              style={{
                borderColor: availability.selected
                  ? tc.accentStrong
                  : tc.primaryBorder,
                backgroundColor: availability.selected
                  ? tc.accentTint
                  : tc.surface,
                opacity:
                  availability.disabled && !availability.selected
                    ? 0.2
                    : availability.wouldBeInvalid
                      ? 0.34
                      : 1,
              }}
              testID={`daily-numbers-operator-${operator === "*" ? "multiply" : operator === "/" ? "divide" : operator === "+" ? "plus" : "minus"}`}
              accessibilityRole="button"
              accessibilityState={{
                selected: availability.selected,
                disabled: availability.disabled,
              }}
              accessibilityLabel={t("quests.dailyNumbers.operatorValue", {
                operator: displayOperator(operator),
              })}
            >
              <Text
                className={`${boardNumberTextClass} text-center font-nunito-extrabold`}
                style={{
                  color: availability.selected ? tc.accentStrong : tc.fg,
                }}
              >
                {displayOperator(operator)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function EquationResult({
  compact,
  committing,
  exactHitPreview,
  interactionLocked,
  onApplyStep,
  previewState,
  resultRef,
  t,
}: {
  compact: boolean;
  committing: boolean;
  exactHitPreview: boolean;
  interactionLocked: boolean;
  onApplyStep: () => void;
  previewState: PreviewState;
  resultRef: RefObject<View | null>;
  t: TranslateFn;
}) {
  const boardNumberTextClass = getBoardNumberTextClass(compact);
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

  return (
    <View
      className={`${getBoardTileHeightClass(compact)} items-center justify-center`}
      style={{ width: BOARD_TILE_WIDTH }}
    >
      {previewState.kind === "ready" ? (
        <Animated.View
          key={`ready-${previewState.result}`}
          entering={FadeIn.duration(150)}
          className="h-full w-full"
          testID={exactHitPreview ? "daily-numbers-exact-preview" : undefined}
        >
          <View ref={resultRef} collapsable={false} className="h-full w-full">
            <Pressable
              onPress={onApplyStep}
              disabled={interactionLocked || committing}
              className={`${resultSurfaceClassName} relative h-full w-full items-center justify-center rounded-xl border-2 px-2 py-2`}
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
                className={`${boardNumberTextClass} w-full ${compact ? "px-2" : "px-3"} text-center font-nunito-extrabold ${resultTextClassName}`}
                numberOfLines={1}
                adjustsFontSizeToFit={String(previewState.result).length > 4}
                minimumFontScale={0.68}
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {previewState.result}
              </Text>
              {!committing ? (
                <View
                  pointerEvents="none"
                  className="absolute inset-y-0 right-2 items-center justify-center"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Text
                    className={`font-nunito-extrabold text-lg ${exactHitPreview ? "text-successDark" : "text-white"}`}
                  >
                    {exactHitPreview ? "✦" : "↓"}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </Animated.View>
      ) : (
        <Animated.View key={previewState.kind} entering={FadeIn.duration(120)}>
          <Text
            className={`${boardNumberTextClass} text-center font-nunito-extrabold ${previewState.kind === "invalid" ? "text-dangerText" : "text-fgMuted"}`}
            numberOfLines={1}
            minimumFontScale={0.68}
            style={{ fontVariant: ["tabular-nums"] }}
          >
            —
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

function EquationWorkbench({
  compact,
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
  tc,
}: {
  compact: boolean;
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
  tc: ThemeColors;
}) {
  const { fontScale, width } = useWindowDimensions();
  const stackResult = fontScale >= 1.35 || width < 380;
  const equationTextClassName = getBoardNumberTextClass(compact);
  const equationControlHeight = compact ? "h-[58px]" : "h-16";
  const exactHitPreview =
    previewState.kind === "ready" && previewState.result === target;

  return (
    <View>
      <View className="mb-2 flex-row items-baseline justify-between">
        <Text className="font-nunito-extrabold text-sm text-fg">
          {t("quests.dailyNumbers.selection")}
        </Text>
        <Text className="font-nunito-bold text-xs text-fgMuted">
          {t("quests.dailyNumbers.stepNumber", {
            step: localSteps.length + 1,
          })}
        </Text>
      </View>

      <View className="border-y border-primaryBorder py-2">
        <View className="flex-row items-center gap-1.5">
          <Pressable
            onPress={() => onClearSlot("left")}
            className={`${equationControlHeight} min-w-0 flex-1 items-center justify-center rounded-lg px-1.5`}
            style={({ pressed }) => ({
              backgroundColor: selectedLeftTile
                ? tc.primaryTint
                : "transparent",
              opacity: interactionLocked ? 0.34 : pressed ? 0.7 : 1,
            })}
            disabled={interactionLocked}
            accessibilityRole="button"
            accessibilityState={{ disabled: interactionLocked }}
            accessibilityLabel={
              selectedLeftTile
                ? t("quests.dailyNumbers.selectedLeftValue", {
                    value: selectedLeftTile.value,
                  })
                : t("quests.dailyNumbers.pickLeft")
            }
          >
            <Text
              className={`${equationTextClassName} text-center font-nunito-extrabold ${selectedLeftTile ? "text-fg" : "text-fgMuted"}`}
              numberOfLines={1}
              adjustsFontSizeToFit={
                String(selectedLeftTile?.value ?? "—").length > 3
              }
              minimumFontScale={0.68}
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {selectedLeftTile?.value ?? "—"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onClearSlot("operator")}
            className={`${equationControlHeight} w-14 items-center justify-center rounded-lg px-1`}
            style={({ pressed }) => ({
              backgroundColor: selectedOperator
                ? tc.primaryTint
                : "transparent",
              opacity: interactionLocked ? 0.34 : pressed ? 0.7 : 1,
            })}
            disabled={interactionLocked}
            accessibilityRole="button"
            accessibilityState={{ disabled: interactionLocked }}
            accessibilityLabel={
              selectedOperator
                ? t("quests.dailyNumbers.selectedOperatorValue", {
                    operator: displayOperator(selectedOperator),
                  })
                : t("quests.dailyNumbers.pickOperator")
            }
          >
            <Text
              className={`${equationTextClassName} text-center font-nunito-extrabold ${selectedOperator ? "text-fg" : "text-fgMuted"}`}
            >
              {selectedOperator ? displayOperator(selectedOperator) : "?"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onClearSlot("right")}
            className={`${equationControlHeight} min-w-0 flex-1 items-center justify-center rounded-lg px-1.5`}
            style={({ pressed }) => ({
              backgroundColor: selectedRightTile
                ? tc.primaryTint
                : "transparent",
              opacity: interactionLocked ? 0.34 : pressed ? 0.7 : 1,
            })}
            disabled={interactionLocked}
            accessibilityRole="button"
            accessibilityState={{ disabled: interactionLocked }}
            accessibilityLabel={
              selectedRightTile
                ? t("quests.dailyNumbers.selectedRightValue", {
                    value: selectedRightTile.value,
                  })
                : t("quests.dailyNumbers.pickRight")
            }
          >
            <Text
              className={`${equationTextClassName} text-center font-nunito-extrabold ${selectedRightTile ? "text-fg" : "text-fgMuted"}`}
              numberOfLines={1}
              adjustsFontSizeToFit={
                String(selectedRightTile?.value ?? "—").length > 3
              }
              minimumFontScale={0.68}
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {selectedRightTile?.value ?? "—"}
            </Text>
          </Pressable>
          {!stackResult ? (
            <>
              <Text
                className={`${equationTextClassName} px-0.5 font-nunito-extrabold text-fgMuted`}
              >
                =
              </Text>
              <EquationResult
                compact={compact}
                committing={committing}
                exactHitPreview={exactHitPreview}
                interactionLocked={interactionLocked}
                onApplyStep={onApplyStep}
                previewState={previewState}
                resultRef={resultRef}
                t={t}
              />
            </>
          ) : null}
        </View>
        {stackResult ? (
          <View className="mt-2 flex-row items-center justify-end gap-2 border-t border-primaryBorder pt-2">
            <Text
              className={`${equationTextClassName} w-8 text-center font-nunito-extrabold text-fgMuted`}
            >
              =
            </Text>
            <EquationResult
              compact={compact}
              committing={committing}
              exactHitPreview={exactHitPreview}
              interactionLocked={interactionLocked}
              onApplyStep={onApplyStep}
              previewState={previewState}
              resultRef={resultRef}
              t={t}
            />
          </View>
        ) : null}
        <Text
          className={`mt-2 px-1 font-nunito-bold text-[11px] leading-4 ${previewState.kind === "invalid" ? "text-dangerText" : "text-fgMuted"}`}
          numberOfLines={2}
        >
          {previewState.kind === "ready"
            ? t("quests.dailyNumbers.nextResult")
            : previewState.kind === "invalid"
              ? previewState.reason === "division"
                ? t("quests.dailyNumbers.invalidDivision")
                : t("quests.dailyNumbers.invalidPositive")
              : t("quests.dailyNumbers.noPreview")}
        </Text>
      </View>
    </View>
  );
}

function ConsumedNumberTile({
  compact,
  modeAccent,
  progress,
  rect,
  resultRect,
  value,
}: {
  compact: boolean;
  modeAccent: ReturnType<typeof getModeAccent>;
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
      className="absolute items-center justify-center rounded-xl border-2"
      style={[
        {
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          backgroundColor: modeAccent.bg,
          borderColor: modeAccent.text,
        },
        animatedStyle,
      ]}
    >
      <Text
        className={`${getBoardNumberTextClass(compact)} text-center font-nunito-extrabold`}
        style={{
          color: modeAccent.text,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </Animated.View>
  );
}

function CommittedResultTile({
  compact,
  progress,
  resultRect,
  targetRect,
  value,
}: {
  compact: boolean;
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
      className="absolute items-center justify-center rounded-xl border-2 border-primaryStrong bg-surface"
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
        className="absolute right-2 top-1 font-nunito-extrabold text-[10px] text-fgMuted"
        style={derivedMarkStyle}
      >
        ✦
      </Animated.Text>
      <Text
        className={`${getBoardNumberTextClass(compact)} text-center font-nunito-extrabold text-primaryStrong`}
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </Animated.View>
  );
}

function OperationCommitOverlay({
  animation,
  compact,
  modeAccent,
  onMerged,
  onFinished,
}: {
  animation: ResultCommitAnimation;
  compact: boolean;
  modeAccent: ReturnType<typeof getModeAccent>;
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

        runOnJS(mergedCallback)();
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
                runOnJS(finishedCallback)();
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
        compact={compact}
        modeAccent={modeAccent}
        progress={progress}
        rect={animation.leftRect}
        resultRect={animation.resultRect}
        value={animation.leftValue}
      />
      <ConsumedNumberTile
        compact={compact}
        modeAccent={modeAccent}
        progress={progress}
        rect={animation.rightRect}
        resultRect={animation.resultRect}
        value={animation.rightValue}
      />
      <CommittedResultTile
        compact={compact}
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
      <QuestActionButton
        label={
          archiveMode
            ? t("quests.dailyNumbers.archiveSaveResult")
            : t("quests.dailyNumbers.submit")
        }
        onPress={onSubmitPress}
        disabled={interactionLocked}
        loading={submitting}
        loadingMode="inline"
        backgroundColor={interactionLocked ? tc.surfaceMuted : tc.surface}
        foregroundColor={interactionLocked ? tc.fgMuted : tc.primaryText}
        borderColor={tc.primaryBorder}
        leadingIcon={CheckIcon}
        minHeight={50}
        accessibilityLabel={
          archiveMode
            ? t("quests.dailyNumbers.archiveSaveResult")
            : t("quests.dailyNumbers.submit")
        }
        testID="daily-numbers-submit"
        style={{ marginTop: 12, opacity: interactionLocked ? 0.38 : 1 }}
      />

      <View className="mt-2 flex-row gap-2">
        <View className="min-w-0 flex-1">
          <QuestActionButton
            label={t("quests.dailyNumbers.undo")}
            onPress={onUndoStep}
            disabled={interactionLocked}
            backgroundColor={tc.primaryTint}
            foregroundColor={tc.primaryText}
            borderColor={tc.primaryBorder}
            leadingIcon={SkipBackIcon}
            leadingIconSize={16}
            minHeight={46}
            textClassName="font-nunito-bold text-xs"
            accessibilityLabel={t("quests.dailyNumbers.undo")}
            testID="daily-numbers-undo"
            style={{ opacity: interactionLocked ? 0.38 : 1 }}
          />
        </View>
        <View className="min-w-0 flex-1">
          <QuestActionButton
            label={t("quests.dailyNumbers.reset")}
            onPress={onResetBoard}
            disabled={interactionLocked}
            backgroundColor={tc.accentTint}
            foregroundColor={tc.accentStrong}
            borderColor={tc.accentBorder}
            leadingIcon={RecycleIcon}
            leadingIconSize={16}
            minHeight={46}
            textClassName="font-nunito-bold text-xs"
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
            label={
              revealedSolution
                ? t("quests.dailyNumbers.hideSolution")
                : t("quests.dailyNumbers.revealSolution")
            }
            onPress={handleToggleSolution}
            backgroundColor={tc.bg}
            foregroundColor={tc.primaryText}
            leadingIcon={EyeIcon}
            minHeight={48}
            style={{ marginTop: 12 }}
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
  compact,
  interactionLocked,
  localSteps,
  modeAccent,
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
      <View ref={stageRef} collapsable={false} className="relative">
        <EquationWorkbench
          compact={compact}
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
          tc={tc}
        />
        <AvailableNumbersGrid
          availableTiles={availableTiles}
          compact={compact}
          committingResultId={commitAnimation?.resultId ?? null}
          committingTileIds={committingTileIds}
          futureResultRef={futureResultRef}
          interactionLocked={commitLocked}
          modeAccent={modeAccent}
          onTileRef={handleTileRef}
          onTilePress={onTilePress}
          selectedLeftTile={selectedLeftTile}
          selectedOperator={selectedOperator}
          selectedRightTile={selectedRightTile}
          t={t}
          tc={tc}
        />

        <OperatorPicker
          compact={compact}
          interactionLocked={commitLocked}
          onOperatorPress={onOperatorPress}
          selectedLeftTile={selectedLeftTile}
          selectedOperator={selectedOperator}
          selectedRightTile={selectedRightTile}
          t={t}
          tc={tc}
        />
        {commitAnimation ? (
          <OperationCommitOverlay
            animation={commitAnimation}
            compact={compact}
            modeAccent={modeAccent}
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
  const hasLockedSubmission = state.submitted === true && !interaction.retrying;
  const chronometer = useDailyNumbersChronometer({
    active: chronometerActive && !hasLockedSubmission,
    attemptScope: interaction.retrying ? "retry" : "initial",
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
        const elapsedMs = Math.round(chronometer.getElapsedMs());
        const steps = toStepInputs(stepsToSubmit);
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
      onSubmissionApplied,
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
        : t("quests.dailyNumbers.submitConfirmTitle"),
      archiveMode
        ? t("quests.dailyNumbers.archiveSubmitConfirmBody")
        : t("quests.dailyNumbers.submitConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: archiveMode
            ? t("quests.dailyNumbers.archiveSubmitConfirmAction")
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
    onTilePress: handleTilePress,
    onToggleSolution: handleToggleSolution,
    onUndoStep: handleUndoStep,
    previewState,
    selectedLeftTile,
    selectedOperator: interaction.selectedOperator,
    selectedRightTile,
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
      {!controller.finishScreenState ? (
        <View className="mb-3">
          <QuestScreenDescription>
            {archiveMode
              ? controller.t("quests.dailyNumbers.archiveSubtitle")
              : controller.t("quests.dailyNumbers.subtitle")}
          </QuestScreenDescription>
        </View>
      ) : null}
      <MessageBanner message={controller.visibleMessage} />
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
            className="flex-1"
          >
            <MetricsSection
              compact={controller.compact}
              currentBestTile={controller.currentBestTile}
              currentDistance={controller.currentDistance}
              formattedElapsedTime={controller.formattedElapsedTime}
              modeAccent={controller.modeAccent}
              state={controller.state}
              t={controller.t}
              tc={controller.tc}
            />
            <LivePlayPanel
              availableTiles={controller.board.availableTiles}
              archiveMode={archiveMode}
              compact={controller.compact}
              interactionLocked={controller.interactionLocked}
              localSteps={controller.interaction.steps}
              modeAccent={controller.modeAccent}
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
        <Text className="mt-5 border-t border-primaryBorder px-1 pt-4 font-nunito-semibold text-[11px] leading-4 text-fgMuted">
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
  onSubmissionApplied,
  state,
  t,
  tc,
}: DailyNumbersPlayViewProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  return (
    <View className="flex-1 bg-bg">
      <View
        className="bg-bg pb-2"
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: compact ? 12 : 16,
        }}
      >
        <QuestScreenHeader
          title={t("quests.dailyNumbers.title")}
          backLabel={
            archiveMode
              ? t("quests.dailyNumbers.backToHistory")
              : t("quests.dailyNumbers.backToQuests")
          }
          backTestID="daily-numbers-back"
          fallbackHref={
            archiveMode ? "/quests/daily-numbers-history" : "/(tabs)/quests"
          }
        />
      </View>

      <ScrollView
        ref={scrollViewRef}
        className="flex-1 bg-bg"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            paddingTop: 8,
            paddingBottom: insets.bottom + 10,
            paddingHorizontal: compact ? 12 : 16,
          }}
        >
          {archiveMode ? (
            <View className="mb-3 flex-row flex-wrap items-center justify-center gap-2">
              <View
                className="rounded-full border px-4 py-1.5"
                style={{
                  backgroundColor: tc.secondaryDark,
                  borderColor: tc.secondaryBorder,
                }}
                testID="daily-numbers-archive-pill"
              >
                <Text
                  className="text-center font-nunito-extrabold text-xs uppercase tracking-[1px]"
                  style={{ color: tc.secondaryText }}
                >
                  {t("quests.dailyNumbers.archiveResultLabel")}
                </Text>
              </View>
              <Text className="text-center font-nunito-bold text-sm text-primaryDark">
                {archiveDate}
              </Text>
            </View>
          ) : null}

          <ModeTabs
            activeMode={activeMode}
            archiveMode={archiveMode}
            modeCards={modeCards}
            onSelectMode={onModeSelect}
            t={t}
            tc={tc}
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
          void claimQuestMutation.mutateAsync(state.questVersion);
        }
      }}
      onModeSelect={handleModeSelect}
      onResolveResetError={handleResetError}
      onSubmissionApplied={handleSubmissionApplied}
      state={state}
      t={t}
      tc={tc}
    />
  );
}
