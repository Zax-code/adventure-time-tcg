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
} from "react";
import {
  AppState,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
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
import { ShareIcon } from "../../src/components/icons";
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
type FinishTone = {
  shellBorder: string;
  shellBg: string;
  resultBorder: string;
  resultBg: string;
  resultText: string;
  summaryText: string;
  statusText: string;
};
type FinishStateProps = {
  claimable: boolean;
  claimPending: boolean;
  compact: boolean;
  exactHitState: boolean;
  finishCompleted: boolean;
  finishDistance: number | null;
  finishScore: number | null;
  finishSummary: string | null;
  finishTone: FinishTone;
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
  t: TranslateFn;
  tc: ThemeColors;
};
type AvailableNumbersGridProps = {
  availableTiles: BoardTile[];
  compact: boolean;
  interactionLocked: boolean;
  modeAccent: ReturnType<typeof getModeAccent>;
  onTilePress: (tileId: string) => void;
  selectedLeftTile: BoardTile | null;
  selectedOperator: Operator | null;
  selectedRightTile: BoardTile | null;
  t: TranslateFn;
  tc: ThemeColors;
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

function formatNumbersShareDate(
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

function buildSubmissionSummary(
  t: TranslateFn,
  submission: NonNullable<DailyNumbersBoardState["submission"]>,
) {
  if (submission.distance === 0) {
    return t("quests.dailyNumbers.exactResult", {
      score: submission.score,
    });
  }

  return t("quests.dailyNumbers.closeResult", {
    value: submission.finalValue,
    distance: submission.distance,
    score: submission.score,
  });
}

function buildBoardIdentity(state: DailyNumbersBoardState) {
  const numbersIdentity = state.numbers
    .map((tile) => `${tile.id}:${tile.value}`)
    .join("|");
  return [
    state.mode,
    state.date,
    isArchiveState(state) ? "archive" : "daily",
    state.questVersion ?? "no-version",
    state.submitted ? "submitted" : "fresh",
    state.submission?.finalValue ?? "no-result",
    state.submission?.elapsedMs ?? "no-time",
    numbersIdentity,
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
    <View
      accessible
      accessibilityLabel={message.text}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className={`mb-1 rounded-2xl border px-3 py-1.5 ${message.type === "success" ? "border-successBorder bg-successTint" : "border-dangerBorder bg-dangerTint"}`}
    >
      <Text
        className={`font-nunito-semibold text-xs ${message.type === "success" ? "text-successText" : "text-dangerText"}`}
      >
        {message.text}
      </Text>
    </View>
  );
}

function ModeTabs({
  activeMode,
  modeCards,
  onSelectMode,
  t,
  tc,
}: {
  activeMode: DailyNumbersMode;
  modeCards: ModeCard[];
  onSelectMode: (mode: DailyNumbersMode) => void;
  t: TranslateFn;
  tc: ThemeColors;
}) {
  return (
    <View className="mb-2 flex-row gap-2">
      {modeCards.map(({ mode, state, isLoading }) => {
        const selected = mode === activeMode;
        const accent = getModeAccent(mode, tc);
        const statusLabel = getModeStatusLabel(state, isLoading, t);

        return (
          <Pressable
            key={mode}
            onPress={() => {
              triggerSelectionHaptic();
              onSelectMode(mode);
            }}
            className="flex-1 rounded-2xl border px-3 py-2"
            style={{
              borderColor: selected ? accent.text : tc.primaryBorder,
              backgroundColor: selected ? accent.bg : tc.surface,
            }}
            testID={`daily-numbers-mode-${mode}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={t(getModeLabelKey(mode))}
          >
            <Text className="text-center font-nunito-bold text-sm text-fg">
              {t(getModeLabelKey(mode))}
            </Text>
            <Text
              className="mt-1 text-center font-nunito-bold text-[11px]"
              style={{ color: selected ? accent.text : tc.fgMuted }}
            >
              {statusLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StatCard({
  compact,
  label,
  value,
}: {
  compact: boolean;
  label: string;
  value: number | string;
}) {
  return (
    <View className="min-w-[140px] flex-1 rounded-2xl bg-primaryBg px-4 py-3">
      <Text className="font-nunito-semibold text-[10px] uppercase tracking-[1px] text-fgMuted">
        {label}
      </Text>
      <Text
        className={`font-nunito-extrabold ${compact ? "text-[28px]" : "text-[32px]"} text-fg`}
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
  state,
  t,
  tc,
}: {
  compact: boolean;
  currentBestTile: BoardTile | null;
  currentDistance: number | undefined;
  formattedElapsedTime: string;
  state: DailyNumbersBoardState;
  t: TranslateFn;
  tc: ThemeColors;
}) {
  return (
    <View className="gap-2">
      <View
        className="rounded-2xl border px-4 py-3"
        style={{ backgroundColor: tc.infoTint, borderColor: tc.infoBorder }}
      >
        <Text
          className="font-nunito-semibold text-[10px] uppercase tracking-[1px]"
          style={{ color: tc.infoText }}
        >
          {t("quests.dailyNumbers.target")}
        </Text>
        <Text
          className={`font-nunito-extrabold ${compact ? "text-[32px]" : "text-[38px]"}`}
          style={{ color: tc.infoText }}
        >
          {state.target}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <StatCard
          compact={compact}
          label={t("quests.dailyNumbers.bestResult")}
          value={currentBestTile?.value ?? "—"}
        />
        <StatCard
          compact={compact}
          label={t("quests.dailyNumbers.bestDistance")}
          value={currentDistance ?? state.bestDistance}
        />
        <StatCard
          compact={compact}
          label={t("quests.dailyNumbers.solveTime")}
          value={formattedElapsedTime}
        />
      </View>
    </View>
  );
}

function SuccessCallout({
  archiveMode,
  completionReached,
  t,
}: {
  archiveMode: boolean;
  completionReached: boolean;
  t: TranslateFn;
}) {
  return (
    <View className="mb-1 rounded-2xl border border-successBorder bg-successTint px-3 py-2">
      <Text className="font-nunito-bold text-xs text-successText">
        {completionReached
          ? archiveMode
            ? t("quests.dailyNumbers.archiveImproved")
            : t("quests.dailyNumbers.clearReached")
          : t("quests.dailyNumbers.lockedSuccess")}
      </Text>
    </View>
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
    <View className="mt-2">
      <View className="mt-2 flex-row items-center justify-between rounded-2xl bg-primaryBg px-3 py-2.5">
        <Text className="font-nunito-semibold text-sm text-fg">{title}</Text>
        <Text className="font-nunito-bold text-sm text-fgMuted">
          {steps.length}
        </Text>
      </View>
      {steps.length > 0 ? (
        <View className="mt-2 gap-2">
          {steps.map((step, index) => (
            <View
              key={`${step.resultId}-${index}`}
              className="rounded-2xl border border-primaryBorder bg-surface px-3 py-2.5"
            >
              <Text className="font-nunito-semibold text-xs text-fgMuted">
                {t("quests.dailyNumbers.stepNumber", {
                  step: index + 1,
                })}
              </Text>
              <Text className="mt-1 font-nunito-bold text-sm text-fg">
                {t("quests.dailyNumbers.stepSummary", {
                  leftValue: step.leftValue,
                  operator: displayOperator(step.operator),
                  rightValue: step.rightValue,
                  resultValue: step.resultValue,
                })}
              </Text>
            </View>
          ))}
        </View>
      ) : emptyCopy ? (
        <Text className="mt-2 px-1 font-nunito text-sm text-fgMuted">
          {emptyCopy}
        </Text>
      ) : null}
    </View>
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
  finishSummary,
  finishTone,
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
  return (
    <View
      className="rounded-[28px] border px-5 py-6"
      style={{
        borderColor: finishTone.shellBorder,
        backgroundColor: finishTone.shellBg,
      }}
    >
      <Text className="text-center font-nunito-bold text-xs uppercase tracking-[1px] text-fgMuted">
        {exactHitState
          ? t("quests.dailyNumbers.exactHitLabel")
          : t("quests.dailyNumbers.resultLockedLabel")}
      </Text>
      <View
        className="mt-3 w-full rounded-[28px] border bg-surface px-4 py-5"
        style={{
          borderColor: finishTone.resultBorder,
          backgroundColor: finishTone.resultBg,
        }}
      >
        <Text className="text-center font-nunito-semibold text-[10px] uppercase tracking-[1px] text-fgMuted">
          {t("quests.dailyNumbers.finalResult")}
        </Text>
        <Text
          className={`mt-2 text-center font-nunito-extrabold ${exactHitState ? "text-[40px]" : compact ? "text-[32px]" : "text-[36px]"}`}
          style={{ color: finishTone.resultText }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {finishValue ?? state.target}
        </Text>
        <Text className="mt-2 text-center font-nunito-semibold text-xs text-fgMuted">
          {t("quests.dailyNumbers.targetValue", {
            target: state.target,
          })}
        </Text>
      </View>
      <Text
        className="mt-3 text-center font-nunito-bold text-[11px]"
        style={{ color: finishTone.statusText }}
      >
        {finishCompleted
          ? t("quests.dailyNumbers.completedLabel")
          : t("quests.dailyNumbers.incompleteLabel")}
      </Text>
      {finishSummary ? (
        <Text
          className="mt-2 text-center font-nunito-bold text-sm"
          style={{ color: finishTone.summaryText }}
        >
          {finishSummary}
        </Text>
      ) : null}
      {interaction.submitting && !state.submitted && exactHitState ? (
        <Text className="mt-2 text-center font-nunito-semibold text-xs text-fgMuted">
          {t("quests.dailyNumbers.autoSubmittingSuccess")}
        </Text>
      ) : null}
      <View className="mt-5 flex-row flex-wrap gap-2">
        <View className="min-w-[96px] flex-1 rounded-2xl border border-primaryBorder bg-surface px-3 py-3">
          <Text className="font-nunito-semibold text-[10px] uppercase tracking-[1px] text-fgMuted">
            {t("quests.dailyNumbers.distanceLabel")}
          </Text>
          <Text className="font-nunito-extrabold text-2xl text-fg">
            {finishDistance ?? "—"}
          </Text>
        </View>
        <View className="min-w-[96px] flex-1 rounded-2xl border border-primaryBorder bg-surface px-3 py-3">
          <Text className="font-nunito-semibold text-[10px] uppercase tracking-[1px] text-fgMuted">
            {t("quests.dailyNumbers.scoreLabel")}
          </Text>
          <Text className="font-nunito-extrabold text-2xl text-fg">
            {finishScore != null ? `${finishScore}%` : "—"}
          </Text>
        </View>
        {!archiveMode ? (
          <View className="min-w-[96px] flex-1 rounded-2xl border border-primaryBorder bg-surface px-3 py-3">
            <Text className="font-nunito-semibold text-[10px] uppercase tracking-[1px] text-fgMuted">
              {t("quests.dailyNumbers.reward")}
            </Text>
            <Text className="font-nunito-extrabold text-2xl text-secondaryDark">
              {state.reward}
            </Text>
          </View>
        ) : null}
        <View className="min-w-[96px] flex-1 rounded-2xl border border-primaryBorder bg-surface px-3 py-3">
          <Text className="font-nunito-semibold text-[10px] uppercase tracking-[1px] text-fgMuted">
            {t("quests.dailyNumbers.solveTime")}
          </Text>
          <Text className="font-nunito-extrabold text-2xl text-fg">
            {formattedElapsedTime}
          </Text>
        </View>
      </View>
      {archiveMode ? (
        <Text className="mt-5 text-center font-nunito-semibold text-sm text-fgMuted">
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
          backgroundColor={tc.successTint}
          foregroundColor={tc.successText}
          borderColor={tc.successBorder}
          minHeight={48}
          accessibilityLabel={t("quests.dailyNumbers.claimReward", {
            reward: state.reward,
          })}
          testID="daily-numbers-claim-reward"
          style={{ marginTop: 20 }}
        />
      ) : (
        <Text className="mt-5 text-center font-nunito-semibold text-sm text-fgMuted">
          {state.claimed
            ? t("quests.dailyNumbers.alreadyClaimed")
            : !state.submitted && exactHitState
              ? t("quests.dailyNumbers.autoSubmittingSuccess")
              : finishCompleted
                ? t("quests.dailyNumbers.rewardReminder", {
                    reward: state.reward,
                  })
                : t("quests.dailyNumbers.resultLockedNote")}
        </Text>
      )}
      {archiveMode && canRetryArchive ? (
        <Pressable
          onPress={onStartRetry}
          className="mt-4 rounded-2xl border border-primaryBorder bg-surface px-4 py-3"
          testID="daily-numbers-archive-retry"
          accessibilityRole="button"
          accessibilityLabel={t("quests.dailyNumbers.archiveTryAgain")}
        >
          <Text className="text-center font-nunito-bold text-fg">
            {t("quests.dailyNumbers.archiveTryAgain")}
          </Text>
        </Pressable>
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
        foregroundColor={tc.primaryDark}
        borderColor={tc.primaryBorder}
        leadingIcon={ShareIcon}
        minHeight={48}
        accessibilityLabel={t("quests.dailyNumbers.shareResult")}
        testID="daily-numbers-share-result"
        style={{ marginTop: 20 }}
      />
      <View className="mt-5 w-full rounded-2xl border border-primaryBorder bg-surface px-3 py-3">
        <Text className="font-nunito-bold text-sm text-fg">
          {t("quests.dailyNumbers.startingNumbersTitle")}
        </Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {state.numbers.map((tile) => (
            <View
              key={tile.id}
              className="min-w-[56px] rounded-2xl bg-primaryBg px-3 py-2"
            >
              <Text className="text-center font-nunito-extrabold text-base text-fg">
                {tile.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
      {submittedSolutionSteps.length > 0 ? (
        <View className="mt-5 w-full rounded-2xl border border-primaryBorder bg-surface px-3 py-3">
          <Text className="font-nunito-bold text-sm text-fg">
            {t("quests.dailyNumbers.solutionUsedTitle")}
          </Text>
          <View className="mt-2 gap-2">
            {submittedSolutionSteps.map((step, index) => (
              <View
                key={`${step.resultId}-${index}`}
                className="rounded-2xl bg-primaryBg px-3 py-2"
              >
                <Text className="font-nunito-bold text-[13px] text-fg">
                  {t("quests.dailyNumbers.stepSummary", {
                    leftValue: step.leftValue,
                    operator: displayOperator(step.operator),
                    rightValue: step.rightValue,
                    resultValue: step.resultValue,
                  })}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {officialSolutionSteps.length > 0 ? (
        <>
          <Pressable
            onPress={onToggleSolution}
            className="mt-5 rounded-2xl border border-primaryBorder bg-surface px-4 py-3"
            testID="daily-numbers-reveal-solution"
            accessibilityRole="button"
            accessibilityState={{ expanded: interaction.revealedSolution }}
            accessibilityLabel={
              interaction.revealedSolution
                ? t("quests.dailyNumbers.hideSolution")
                : t("quests.dailyNumbers.revealSolution")
            }
          >
            <Text className="text-center font-nunito-bold text-fg">
              {interaction.revealedSolution
                ? t("quests.dailyNumbers.hideSolution")
                : t("quests.dailyNumbers.revealSolution")}
            </Text>
          </Pressable>
          {interaction.revealedSolution ? (
            <View className="mt-3 w-full rounded-2xl border border-primaryBorder bg-surface px-3 py-3">
              <Text className="font-nunito-bold text-sm text-fg">
                {t("quests.dailyNumbers.officialSolutionTitle")}
              </Text>
              <Text className="mt-1 font-nunito text-sm text-fgMuted">
                {t("quests.dailyNumbers.officialSolutionBody")}
              </Text>
              <View className="mt-3 gap-2">
                {officialSolutionSteps.map((step, index) => (
                  <View
                    key={`${step.resultId}-${index}`}
                    className="rounded-2xl bg-primaryBg px-3 py-2"
                  >
                    <Text className="font-nunito-bold text-[13px] text-fg">
                      {t("quests.dailyNumbers.stepSummary", {
                        leftValue: step.leftValue,
                        operator: displayOperator(step.operator),
                        rightValue: step.rightValue,
                        resultValue: step.resultValue,
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function AvailableNumbersGrid({
  availableTiles,
  compact,
  interactionLocked,
  modeAccent,
  onTilePress,
  selectedLeftTile,
  selectedOperator,
  selectedRightTile,
  t,
  tc,
}: AvailableNumbersGridProps) {
  return (
    <>
      <Text className="mt-3 font-nunito-bold text-sm text-fg">
        {t("quests.dailyNumbers.availableNumbers")}
      </Text>
      <View className="mt-2 flex-row flex-wrap justify-between gap-y-2">
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
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(140)}
              layout={LinearTransition.duration(200)}
              style={{ width: "31.5%" }}
            >
              <Pressable
                onPress={() => onTilePress(tile.id)}
                disabled={availability.disabled}
                className="rounded-2xl border px-2 py-2.5"
                style={{
                  borderColor: availability.selected
                    ? modeAccent.text
                    : tc.primaryBorder,
                  backgroundColor: availability.selected
                    ? tc.surface
                    : tc.primaryBg,
                  opacity:
                    availability.disabled && !availability.selected ? 0.4 : 1,
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
                <Text
                  className={`text-center font-nunito-extrabold ${compact ? "text-[20px]" : "text-[22px]"}`}
                  style={{
                    color: availability.selected ? modeAccent.text : tc.fg,
                  }}
                >
                  {tile.value}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </>
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
  return (
    <>
      <Text className="mt-3 font-nunito-bold text-sm text-fg">
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
              className="flex-1 rounded-2xl border px-3 py-3"
              style={{
                borderColor: availability.selected
                  ? tc.accentStrong
                  : tc.primaryBorder,
                backgroundColor: availability.selected
                  ? tc.accentTint
                  : tc.primaryBg,
                opacity:
                  availability.disabled && !availability.selected ? 0.4 : 1,
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
                className={`text-center font-nunito-extrabold ${compact ? "text-lg" : "text-xl"}`}
                style={{
                  color: availability.selected ? tc.accentStrong : tc.fg,
                }}
              >
                {operator === "*" ? "×" : operator}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
  t,
  tc,
}: LivePlayProps) {
  return (
    <>
      <View
        className="mt-3 flex-1 rounded-2xl border px-3 py-3"
        style={{
          borderColor: modeAccent.border,
          backgroundColor: modeAccent.bg,
        }}
      >
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => onClearSlot("left")}
            className="h-12 flex-1 items-center justify-center rounded-2xl border border-primaryBorder bg-surface px-3"
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
            <Text className="text-center font-nunito-bold text-sm text-fg">
              {selectedLeftTile?.value ?? t("quests.dailyNumbers.pickNumber")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onClearSlot("operator")}
            className="h-12 w-12 items-center justify-center rounded-2xl border border-primaryBorder bg-surfaceMuted px-2"
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
            <Text className="text-center font-nunito-extrabold text-lg text-fg">
              {selectedOperator === "*" ? "×" : (selectedOperator ?? "?")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onClearSlot("right")}
            className="h-12 flex-1 items-center justify-center rounded-2xl border border-primaryBorder bg-surface px-3"
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
            <Text className="text-center font-nunito-bold text-sm text-fg">
              {selectedRightTile?.value ?? t("quests.dailyNumbers.pickNumber")}
            </Text>
          </Pressable>
        </View>

        <View className="mt-2 rounded-2xl border border-primaryBorder bg-surface px-3 py-2.5">
          <Text
            className="font-nunito-semibold text-[10px] uppercase tracking-[1px]"
            style={{ color: modeAccent.text }}
          >
            {t("quests.dailyNumbers.nextResult")}
          </Text>
          <Text
            className={`mt-1 font-nunito-bold text-sm ${previewState.kind === "invalid" ? "text-dangerDark" : "text-fg"}`}
          >
            {previewState.kind === "ready"
              ? previewState.result
              : previewState.kind === "invalid"
                ? previewState.reason === "division"
                  ? t("quests.dailyNumbers.invalidDivision")
                  : t("quests.dailyNumbers.invalidPositive")
                : t("quests.dailyNumbers.noPreview")}
          </Text>
        </View>

        <Pressable
          onPress={onApplyStep}
          disabled={interactionLocked}
          className="mt-2 rounded-2xl px-3 py-3"
          style={{
            backgroundColor: interactionLocked
              ? tc.surfaceMuted
              : tc.accentDark,
          }}
          testID="daily-numbers-apply-step"
          accessibilityRole="button"
          accessibilityState={{ disabled: interactionLocked }}
          accessibilityLabel={t("quests.dailyNumbers.applyStep")}
        >
          <Text
            className="text-center font-nunito-bold text-sm"
            style={{ color: interactionLocked ? tc.fgMuted : tc.primaryBg }}
          >
            {t("quests.dailyNumbers.applyStep")}
          </Text>
        </Pressable>

        <AvailableNumbersGrid
          availableTiles={availableTiles}
          compact={compact}
          interactionLocked={interactionLocked}
          modeAccent={modeAccent}
          onTilePress={onTilePress}
          selectedLeftTile={selectedLeftTile}
          selectedOperator={selectedOperator}
          selectedRightTile={selectedRightTile}
          t={t}
          tc={tc}
        />

        <OperatorPicker
          compact={compact}
          interactionLocked={interactionLocked}
          onOperatorPress={onOperatorPress}
          selectedLeftTile={selectedLeftTile}
          selectedOperator={selectedOperator}
          selectedRightTile={selectedRightTile}
          t={t}
          tc={tc}
        />
      </View>

      <View className="mt-3 flex-row gap-2">
        <Pressable
          onPress={onSubmitPress}
          disabled={interactionLocked}
          className="flex-1 rounded-2xl px-3 py-3"
          style={{
            backgroundColor: interactionLocked ? tc.surfaceMuted : tc.primary,
          }}
          testID="daily-numbers-submit"
          accessibilityRole="button"
          accessibilityState={{ disabled: interactionLocked }}
          accessibilityLabel={
            archiveMode
              ? t("quests.dailyNumbers.archiveSaveResult")
              : t("quests.dailyNumbers.submit")
          }
        >
          <Text
            className="text-center font-nunito-bold text-sm"
            style={{ color: interactionLocked ? tc.fgMuted : tc.primaryBg }}
          >
            {submitting
              ? "…"
              : archiveMode
                ? t("quests.dailyNumbers.archiveSaveResult")
                : t("quests.dailyNumbers.submit")}
          </Text>
        </Pressable>
      </View>

      <View className="mt-2 flex-row gap-2">
        <Pressable
          onPress={onUndoStep}
          disabled={interactionLocked}
          className="flex-1 rounded-2xl border border-primaryBorder bg-surfaceMuted px-3 py-3"
          style={{ opacity: interactionLocked ? 0.55 : 1 }}
          testID="daily-numbers-undo"
          accessibilityRole="button"
          accessibilityState={{ disabled: interactionLocked }}
          accessibilityLabel={t("quests.dailyNumbers.undo")}
        >
          <Text className="text-center font-nunito-bold text-sm text-fg">
            {t("quests.dailyNumbers.undo")}
          </Text>
        </Pressable>
        <Pressable
          onPress={onResetBoard}
          disabled={interactionLocked}
          className="flex-1 rounded-2xl border border-primaryBorder bg-surfaceMuted px-3 py-3"
          style={{ opacity: interactionLocked ? 0.55 : 1 }}
          testID="daily-numbers-reset"
          accessibilityRole="button"
          accessibilityState={{ disabled: interactionLocked }}
          accessibilityLabel={t("quests.dailyNumbers.reset")}
        >
          <Text className="text-center font-nunito-bold text-sm text-fg">
            {t("quests.dailyNumbers.reset")}
          </Text>
        </Pressable>
      </View>

      <StepList
        emptyCopy={t("quests.dailyNumbers.noStepsYet")}
        steps={localSteps}
        t={t}
        title={t("quests.dailyNumbers.stepHistoryTitle")}
      />
      {archiveMode && officialSolutionSteps.length > 0 ? (
        <>
          <Pressable
            onPress={() => {
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
            }}
            className="mt-3 rounded-2xl border border-primaryBorder bg-surface px-4 py-3"
            testID="daily-numbers-archive-reveal-solution"
            accessibilityRole="button"
            accessibilityState={{ expanded: revealedSolution }}
            accessibilityLabel={
              revealedSolution
                ? t("quests.dailyNumbers.hideSolution")
                : t("quests.dailyNumbers.revealSolution")
            }
          >
            <Text className="text-center font-nunito-bold text-fg">
              {revealedSolution
                ? t("quests.dailyNumbers.hideSolution")
                : t("quests.dailyNumbers.revealSolution")}
            </Text>
          </Pressable>
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
  const successState =
    (hasLockedSubmission && state.submission?.completed === true) ||
    completionReached;
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

  const finishTone: FinishTone = exactHitState
    ? {
        shellBorder: modeAccent.border,
        shellBg: modeAccent.bg,
        resultBorder: tc.successBorder,
        resultBg: tc.surface,
        resultText: tc.successText,
        summaryText: tc.successText,
        statusText: tc.successText,
      }
    : finishCompleted(state, successState)
      ? {
          shellBorder: tc.infoBorder,
          shellBg: tc.infoTint,
          resultBorder: tc.infoBorder,
          resultBg: tc.surface,
          resultText: tc.infoText,
          summaryText: tc.infoText,
          statusText: tc.infoText,
        }
      : {
          shellBorder: tc.primaryBorder,
          shellBg: tc.primaryBg,
          resultBorder: tc.primaryBorder,
          resultBg: tc.surface,
          resultText: tc.fg,
          summaryText: tc.fg,
          statusText: tc.fgMuted,
        };
  const finishCompletedState =
    exactHitState || state.submission?.completed === true;
  const submissionSummary = state.submission
    ? archiveMode
      ? state.submission.distance === 0
        ? t("quests.dailyNumbers.archiveExactResult", {
            score: state.submission.score,
          })
        : t("quests.dailyNumbers.archiveCloseResult", {
            value: state.submission.finalValue,
            distance: state.submission.distance,
            score: state.submission.score,
          })
      : buildSubmissionSummary(t, state.submission)
    : null;
  const exactHitScore =
    state.submission?.score ?? (exactHitState ? EXACT_HIT_PERCENT : null);
  const exactHitSummary =
    exactHitScore === null
      ? null
      : t("quests.dailyNumbers.exactResult", {
          score: exactHitScore,
        });
  const archiveExactHitSummary =
    exactHitScore === null
      ? null
      : t("quests.dailyNumbers.archiveExactResult", {
          score: exactHitScore,
        });
  const finishSummary = exactHitState
    ? archiveMode
      ? archiveExactHitSummary
      : exactHitSummary
    : submissionSummary;
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
    finishSummary,
    finishTone,
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

  const { locale } = useTranslation();
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<View>(null);

  // Spoiler-safe share model — only the player's outcome is surfaced, never the
  // solution steps or the official solution.
  const shareResult = useMemo(
    () =>
      buildDailyNumbersShareResult({
        questTitle: controller.t("quests.dailyNumbers.title"),
        modeLabel: controller.t(getModeLabelKey(controller.state.mode)),
        mode: controller.state.mode,
        date: controller.state.date,
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
      controller.state.date,
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
      date: formatNumbersShareDate(controller.state.date, locale),
    };
  }, [
    controller.t,
    controller.state.mode,
    controller.state.date,
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
        const fileName = buildDailyNumbersShareFileName(shareResult);
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
  }, [isSharing, controller.t, shareResult]);

  return (
    <>
      <MessageBanner message={controller.visibleMessage} />
      {controller.completionReached && !controller.finishScreenState ? (
        <SuccessCallout
          archiveMode={archiveMode}
          completionReached={controller.completionReached}
          t={controller.t}
        />
      ) : null}

      <View
        className="flex-1 rounded-[28px] border bg-surface p-3"
        style={{ borderColor: controller.modeAccent.border }}
      >
        {!controller.finishScreenState ? (
          <MetricsSection
            compact={controller.compact}
            currentBestTile={controller.currentBestTile}
            currentDistance={controller.currentDistance}
            formattedElapsedTime={controller.formattedElapsedTime}
            state={controller.state}
            t={controller.t}
            tc={controller.tc}
          />
        ) : null}

        {controller.finishScreenState ? (
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
            finishSummary={controller.finishSummary}
            finishTone={controller.finishTone}
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
        ) : (
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
            t={controller.t}
            tc={controller.tc}
          />
        )}
      </View>

      {/* Offscreen, capture-friendly share card. Rendered (not display:none)
          and laid out off-screen so react-native-view-shot can snapshot it. */}
      {controller.finishScreenState ? (
        <View
          pointerEvents="none"
          collapsable={false}
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

function finishCompleted(state: DailyNumbersBoardState, successState: boolean) {
  return state.submission?.completed === true || successState;
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
  return (
    <View className="flex-1 bg-bg">
      <View
        className="bg-bg pb-2"
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: compact ? 10 : 14,
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
        className="flex-1 bg-bg"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            paddingTop: 8,
            paddingBottom: insets.bottom + 10,
            paddingHorizontal: compact ? 10 : 14,
          }}
        >
          <QuestScreenDescription>
            {archiveMode
              ? t("quests.dailyNumbers.archiveSubtitle")
              : t("quests.dailyNumbers.subtitle")}
          </QuestScreenDescription>

          <View className="mb-3 gap-3">
            {archiveMode ? (
              <View className="flex-row flex-wrap items-center justify-center gap-2">
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
          </View>

          <ModeTabs
            activeMode={activeMode}
            modeCards={modeCards}
            onSelectMode={onModeSelect}
            t={t}
            tc={tc}
          />

          <Text className="mb-2 px-1 text-center font-nunito-semibold text-xs text-fgMuted">
            {archiveMode
              ? t("quests.dailyNumbers.archiveHelperLine")
              : t("quests.dailyNumbers.helperLine")}
          </Text>

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
    [activeMode, archiveDate, archiveMode, queryClient],
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
