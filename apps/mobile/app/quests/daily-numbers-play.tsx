import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
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
import {
  CheckIcon,
  ClockIcon,
  CoinIcon,
  EyeIcon,
  RecycleIcon,
  ShareIcon,
  SkipBackIcon,
  SparklesIcon,
} from "../../src/components/icons";
import { PageLoadingState } from "../../src/components/loading-state";
import { DailyNumbersGameShareCard } from "../../src/features/quests/daily-numbers/game-share-card";
import {
  applyDailyNumbersOperation,
  getDailyNumbersOperatorAvailability,
  getDailyNumbersOperatorPressResult,
  getDailyNumbersTileAvailability,
  type DailyNumbersOperator,
} from "../../src/features/quests/daily-numbers/board-interaction";
import {
  createDailyNumbersBoardInteractionState,
  dailyNumbersBoardReducer,
  getDailyNumbersAttemptTiming,
  type DailyNumbersBoardInteractionState,
  type DailyNumbersMessageState,
  type DailyNumbersSlotKey,
} from "../../src/features/quests/daily-numbers/board-state";
import {
  buildDailyNumbersShareFileName,
  buildDailyNumbersShareResult,
} from "../../src/features/quests/daily-numbers/share-result";
import {
  DAILY_NUMBERS_MODES,
  formatDailyNumbersElapsedTime,
  getModeAccent,
  getModeLabelKey,
  getModeMixLabelKey,
  getModeStatusLabel,
  getQuestTypeForMode,
} from "../../src/features/quests/daily-numbers/shared";
import { QuestActionButton } from "../../src/features/quests/quest-action-button";
import {
  DEFAULT_QUEST_TIME_ZONE,
  isCurrentQuestDay,
} from "../../src/features/quests/quest-day-cutoff";
import {
  navigateBackFromQuest,
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

type MessageState = DailyNumbersMessageState;
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
type SlotKey = DailyNumbersSlotKey;
type BoardInteractionState = DailyNumbersBoardInteractionState;
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

function withAlpha(color: string, alpha: string) {
  if (color.startsWith("#") && color.length >= 7) {
    return `${color.slice(0, 7)}${alpha}`;
  }

  return color;
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
      className={`mb-2 flex-row items-center gap-2 rounded-2xl border px-3 py-2 ${message.type === "success" ? "border-successBorder bg-successTint" : "border-dangerBorder bg-dangerTint"}`}
    >
      <View
        className={`h-2.5 w-2.5 rounded-full ${message.type === "success" ? "bg-success" : "bg-danger"}`}
      />
      <Text
        className={`flex-1 font-nunito-bold text-xs leading-4 ${message.type === "success" ? "text-successText" : "text-dangerText"}`}
      >
        {message.text}
      </Text>
    </Animated.View>
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
    <View
      className="mb-2 flex-row gap-1.5 rounded-[22px] border border-primaryBorder bg-surface p-1.5"
      style={{ boxShadow: `0px 3px 10px ${withAlpha(tc.primaryDark, "12")}` }}
    >
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
            className="min-h-[56px] flex-1 items-center justify-center rounded-[17px] border px-1.5 py-1.5"
            style={({ pressed }) => ({
              borderColor: selected ? accent.border : "transparent",
              backgroundColor: selected ? accent.bg : "transparent",
              opacity: pressed ? 0.78 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
            testID={`daily-numbers-mode-${mode}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${t(getModeLabelKey(mode))}, ${t(getModeMixLabelKey(mode))}, ${statusLabel}`}
          >
            <Text
              className="text-center font-nunito-extrabold text-[15px] text-fg"
              numberOfLines={1}
            >
              {t(getModeLabelKey(mode))}
            </Text>
            <View className="mt-0.5 flex-row items-center justify-center gap-1">
              <View
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: selected ? accent.text : tc.muted,
                }}
              />
              <Text
                className="font-nunito-bold text-[10px] leading-3"
                style={{ color: selected ? accent.text : tc.fgMuted }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {statusLabel}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <View className="min-w-0 flex-1 items-center justify-center px-1.5 py-3">
      <Text
        className="text-center font-nunito-bold text-[9px] uppercase tracking-[0.8px] text-fgMuted"
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {label}
      </Text>
      <Text
        className="mt-0.5 text-center font-nunito-extrabold text-[19px] leading-6 text-fg"
        style={{ fontVariant: ["tabular-nums"] }}
        maxFontSizeMultiplier={1.2}
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
  const accent = getModeAccent(state.mode, tc);
  const { fontScale } = useWindowDimensions();
  const stackMetrics = fontScale >= 1.4;

  return (
    <View
      className="overflow-hidden rounded-[24px] border-2 bg-surface"
      style={{
        borderColor: accent.border,
        boxShadow: `0px 5px 14px ${withAlpha(accent.text, "18")}`,
      }}
    >
      <LinearGradient
        colors={[accent.bg, tc.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          flexDirection: stackMetrics ? "column" : "row",
          minHeight: stackMetrics ? undefined : compact ? 96 : 104,
        }}
      >
        <View
          className={`${stackMetrics ? "min-h-[82px] w-full border-b" : "w-[34%] border-r"} items-center justify-center px-2 py-3`}
          style={{ borderColor: accent.border }}
        >
          <Text
            className="font-nunito-extrabold text-[10px] uppercase tracking-[1.4px]"
            style={{ color: accent.text }}
          >
            {t("quests.dailyNumbers.target")}
          </Text>
          <Text
            className={`${compact ? "text-[34px]" : "text-[40px]"} mt-0.5 font-nunito-extrabold leading-[44px]`}
            style={{ color: accent.text, fontVariant: ["tabular-nums"] }}
            maxFontSizeMultiplier={1.2}
            numberOfLines={1}
          >
            {state.target}
          </Text>
        </View>
        <View
          className={`${stackMetrics ? "min-h-[82px] w-full" : "min-w-0 flex-1"} flex-row`}
        >
          <StatCard
            label={t("quests.dailyNumbers.bestResult")}
            value={currentBestTile?.value ?? "—"}
          />
          <View className="my-3 w-px bg-primaryBorder" />
          <StatCard
            label={t("quests.dailyNumbers.bestDistance")}
            value={currentDistance ?? state.bestDistance}
          />
          <View className="my-3 w-px bg-primaryBorder" />
          <StatCard
            label={t("quests.dailyNumbers.solveTime")}
            value={formattedElapsedTime}
          />
        </View>
      </LinearGradient>
      <View
        className="h-1"
        style={{ backgroundColor: accent.text, opacity: 0.8 }}
      />
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
    <Animated.View
      entering={FadeIn.duration(180)}
      className="mb-2 flex-row items-center gap-2 rounded-2xl border border-successBorder bg-successTint px-3 py-2.5"
    >
      <View className="h-7 w-7 items-center justify-center rounded-full bg-success">
        <CheckIcon size={16} color="#FFFFFF" />
      </View>
      <Text className="flex-1 font-nunito-bold text-xs leading-4 text-successText">
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
    <View className="mt-4">
      <View className="flex-row items-center justify-between px-1">
        <Text className="font-nunito-extrabold text-sm text-fg">{title}</Text>
        <View className="min-w-7 items-center rounded-full bg-primaryTint px-2 py-1">
          <Text className="font-nunito-extrabold text-[11px] text-primaryText">
            {steps.length}
          </Text>
        </View>
      </View>
      {steps.length > 0 ? (
        <View className="mt-2 gap-1.5">
          {steps.map((step, index) => (
            <Animated.View
              key={`${step.resultId}-${index}`}
              entering={FadeIn.duration(160).delay(index * 35)}
              layout={LinearTransition.duration(180)}
              className="flex-row items-center gap-2 rounded-2xl border border-primaryBorder bg-surface px-2.5 py-2"
            >
              <View className="h-7 w-7 items-center justify-center rounded-full bg-primaryTint">
                <Text className="font-nunito-extrabold text-xs text-primaryText">
                  {index + 1}
                </Text>
              </View>
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
        <View className="mt-2 rounded-2xl border border-dashed border-primaryBorder bg-surfaceMuted px-3 py-3">
          <Text className="text-center font-nunito-semibold text-xs leading-4 text-fgMuted">
            {emptyCopy}
          </Text>
        </View>
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
      <View className="mt-4 w-full rounded-[22px] border border-primaryBorder bg-surface px-3 py-3">
        <Text className="font-nunito-extrabold text-sm text-fg">
          {t("quests.dailyNumbers.startingNumbersTitle")}
        </Text>
        <View className="mt-2 flex-row flex-wrap justify-between gap-y-2">
          {state.numbers.map((tile) => (
            <View
              key={tile.id}
              className="w-[31.5%] rounded-[15px] border border-primaryBorder bg-primaryBg px-2 py-2"
            >
              <Text
                className="text-center font-nunito-extrabold text-base text-fg"
                style={{ fontVariant: ["tabular-nums"] }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
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
            backgroundColor={tc.surface}
            foregroundColor={tc.primaryText}
            borderColor={tc.primaryBorder}
            leadingIcon={EyeIcon}
            minHeight={48}
            style={{ marginTop: 14 }}
            testID="daily-numbers-reveal-solution"
            accessibilityState={{
              expanded: interaction.revealedSolution,
            }}
            accessibilityLabel={
              interaction.revealedSolution
                ? t("quests.dailyNumbers.hideSolution")
                : t("quests.dailyNumbers.revealSolution")
            }
          />
          {interaction.revealedSolution ? (
            <Animated.View
              entering={FadeIn.duration(180)}
              className="mt-3 w-full rounded-[22px] border border-primaryBorder bg-surface px-3 py-3"
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
  const progressActionAvailable = claimable || (archiveMode && canRetryArchive);
  const { fontScale } = useWindowDimensions();
  const stackHero = fontScale >= 1.4;

  return (
    <View
      className="rounded-[30px] border-2 p-3"
      style={{
        borderColor: finishTone.shellBorder,
        backgroundColor: finishTone.shellBg,
        boxShadow: `0px 6px 18px ${withAlpha(finishTone.resultText, "16")}`,
      }}
    >
      <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2 px-1">
        <View
          className="rounded-full border px-3 py-1.5"
          style={{
            backgroundColor: finishTone.resultBg,
            borderColor: finishTone.resultBorder,
          }}
        >
          <Text
            className="font-nunito-extrabold text-[10px] uppercase tracking-[1.2px]"
            style={{ color: finishTone.statusText }}
          >
            {exactHitState
              ? t("quests.dailyNumbers.exactHitLabel")
              : t("quests.dailyNumbers.resultLockedLabel")}
          </Text>
        </View>
        {archiveMode ? (
          <View className="rounded-full border border-secondaryBorder bg-secondaryTint px-3 py-1.5">
            <Text className="font-nunito-extrabold text-[10px] uppercase tracking-[1.2px] text-secondaryText">
              {t("quests.dailyNumbers.archiveResultLabel")}
            </Text>
          </View>
        ) : null}
      </View>

      <LinearGradient
        colors={[finishTone.resultBg, tc.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderColor: finishTone.resultBorder,
          borderCurve: "continuous",
          borderRadius: 26,
          borderWidth: 2,
          overflow: "hidden",
          paddingHorizontal: 16,
          paddingVertical: 16,
        }}
      >
        <View
          className={
            stackHero ? "items-stretch gap-3" : "flex-row items-center gap-3"
          }
        >
          <View className="min-w-0 flex-1">
            <Text className="font-nunito-extrabold text-[10px] uppercase tracking-[1.2px] text-fgMuted">
              {t("quests.dailyNumbers.finalResult")}
            </Text>
            <Text
              className={`${exactHitState ? "text-[48px]" : compact ? "text-[38px]" : "text-[44px]"} mt-0.5 font-nunito-extrabold leading-[52px]`}
              style={{
                color: finishTone.resultText,
                fontVariant: ["tabular-nums"],
              }}
              maxFontSizeMultiplier={1.25}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.64}
            >
              {finishValue ?? state.target}
            </Text>
            <Text className="font-nunito-bold text-xs text-fgMuted">
              {t("quests.dailyNumbers.targetValue", {
                target: state.target,
              })}
            </Text>
          </View>

          <View
            className={`${compact ? "h-[88px] w-[88px]" : "h-[98px] w-[98px]"} ${stackHero ? "self-center" : ""} items-center justify-center rounded-full border-[3px]`}
            style={{
              backgroundColor: exactHitState ? tc.successTint : tc.surface,
              borderColor: finishTone.resultBorder,
              boxShadow: `0px 4px 10px ${withAlpha(finishTone.resultText, "1C")}`,
            }}
          >
            <Text className="font-nunito-extrabold text-[9px] uppercase tracking-[1px] text-fgMuted">
              {t("quests.dailyNumbers.scoreLabel")}
            </Text>
            <Text
              className={`${compact ? "text-[26px]" : "text-[30px]"} font-nunito-extrabold`}
              style={{
                color: finishTone.resultText,
                fontVariant: ["tabular-nums"],
              }}
              maxFontSizeMultiplier={1.2}
            >
              {finishScore != null ? `${finishScore}%` : "—"}
            </Text>
          </View>
        </View>

        <View className="mt-3 h-px bg-primaryBorder" />
        <View className="mt-3 flex-row items-center gap-2">
          <View
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: finishTone.statusText }}
          />
          <Text
            className="font-nunito-extrabold text-[11px]"
            style={{ color: finishTone.statusText }}
          >
            {finishCompleted
              ? t("quests.dailyNumbers.completedLabel")
              : t("quests.dailyNumbers.incompleteLabel")}
          </Text>
        </View>
        {finishSummary ? (
          <Text
            className="mt-1.5 font-nunito-bold text-sm leading-5"
            style={{ color: finishTone.summaryText }}
          >
            {finishSummary}
          </Text>
        ) : null}
        {interaction.submitting && !state.submitted && exactHitState ? (
          <Text className="mt-1.5 font-nunito-semibold text-xs text-fgMuted">
            {t("quests.dailyNumbers.autoSubmittingSuccess")}
          </Text>
        ) : null}
      </LinearGradient>
      <View className="mt-3 flex-row gap-2">
        <View className="min-w-0 flex-1 rounded-[18px] border border-primaryBorder bg-surface px-3 py-3">
          <Text className="font-nunito-extrabold text-[9px] uppercase tracking-[1px] text-fgMuted">
            {t("quests.dailyNumbers.distanceLabel")}
          </Text>
          <Text
            className="mt-0.5 font-nunito-extrabold text-xl text-fg"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {finishDistance ?? "—"}
          </Text>
        </View>
        {!archiveMode ? (
          <View className="min-w-0 flex-1 rounded-[18px] border border-secondaryBorder bg-secondaryTint px-3 py-3">
            <View className="flex-row items-center gap-1.5">
              <CoinIcon size={14} />
              <Text className="font-nunito-extrabold text-[9px] uppercase tracking-[1px] text-secondaryText">
                {t("quests.dailyNumbers.reward")}
              </Text>
            </View>
            <Text
              className="mt-0.5 font-nunito-extrabold text-xl text-secondaryText"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {state.reward}
            </Text>
          </View>
        ) : null}
        <View className="min-w-0 flex-1 rounded-[18px] border border-primaryBorder bg-surface px-3 py-3">
          <View className="flex-row items-center gap-1.5">
            <ClockIcon size={14} color={tc.fgMuted} />
            <Text className="font-nunito-extrabold text-[9px] uppercase tracking-[1px] text-fgMuted">
              {t("quests.dailyNumbers.solveTime")}
            </Text>
          </View>
          <Text
            className="mt-0.5 font-nunito-extrabold text-xl text-fg"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {formattedElapsedTime}
          </Text>
        </View>
      </View>
      {archiveMode ? (
        <View className="mt-3 rounded-2xl border border-secondaryBorder bg-secondaryTint px-3 py-2.5">
          <Text className="text-center font-nunito-bold text-xs leading-4 text-secondaryText">
            {t("quests.dailyNumbers.archiveNoReward")}
          </Text>
        </View>
      ) : claimable && state.questVersion ? (
        <QuestActionButton
          label={t("quests.dailyNumbers.claimReward", {
            reward: state.reward,
          })}
          onPress={onClaimReward}
          loading={claimPending}
          loadingMode="inline"
          backgroundColor={tc.successDark}
          foregroundColor="#FFFFFF"
          borderColor={tc.successText}
          leadingAccessory={<CoinIcon size={18} />}
          minHeight={48}
          accessibilityLabel={t("quests.dailyNumbers.claimReward", {
            reward: state.reward,
          })}
          testID="daily-numbers-claim-reward"
          style={{ marginTop: 12 }}
        />
      ) : (
        <View className="mt-3 rounded-2xl border border-primaryBorder bg-surfaceMuted px-3 py-2.5">
          <Text className="text-center font-nunito-semibold text-xs leading-4 text-fgMuted">
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
        </View>
      )}
      {archiveMode && canRetryArchive ? (
        <QuestActionButton
          label={t("quests.dailyNumbers.archiveTryAgain")}
          onPress={onStartRetry}
          backgroundColor={tc.primary}
          foregroundColor="#FFFFFF"
          borderColor={tc.primaryDark}
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
        backgroundColor={progressActionAvailable ? tc.surface : tc.primary}
        foregroundColor={progressActionAvailable ? tc.primaryText : "#FFFFFF"}
        borderColor={
          progressActionAvailable ? tc.primaryBorder : tc.primaryDark
        }
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
    <View className="mt-3">
      <View className="flex-row items-center justify-between px-1">
        <Text className="font-nunito-extrabold text-sm text-fg">
          {t("quests.dailyNumbers.availableNumbers")}
        </Text>
        <View className="rounded-full bg-primaryTint px-2.5 py-1">
          <Text className="font-nunito-extrabold text-[10px] text-primaryText">
            {availableTiles.length}
          </Text>
        </View>
      </View>
      <View className="mt-2 flex-row flex-wrap justify-between gap-y-2">
        {availableTiles.map((tile) => {
          const availability = getDailyNumbersTileAvailability({
            interactionLocked,
            selectedLeftTile,
            selectedOperator,
            selectedRightTile,
            tile,
          });
          const selectionOrder =
            tile.id === selectedLeftTile?.id
              ? 1
              : tile.id === selectedRightTile?.id
                ? 2
                : null;

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
                className={`${compact ? "min-h-[58px]" : "min-h-[64px]"} items-center justify-center overflow-hidden rounded-[18px] border-2 px-2 py-2`}
                style={({ pressed }) => ({
                  borderColor: availability.selected
                    ? modeAccent.text
                    : tc.primaryBorder,
                  backgroundColor: availability.selected
                    ? modeAccent.bg
                    : tile.source === "derived"
                      ? tc.accentTint
                      : tc.surface,
                  opacity:
                    availability.disabled && !availability.selected
                      ? availability.wouldBeInvalid
                        ? 0.58
                        : 0.42
                      : pressed
                        ? 0.78
                        : 1,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                  boxShadow:
                    availability.disabled && !availability.selected
                      ? undefined
                      : `0px 3px 7px ${withAlpha(
                          availability.selected
                            ? modeAccent.text
                            : tc.primaryDark,
                          "16",
                        )}`,
                })}
                testID={`daily-numbers-tile-${tile.id}`}
                accessibilityRole="button"
                accessibilityState={{
                  selected: availability.selected,
                  disabled: availability.disabled,
                }}
                accessibilityLabel={
                  selectionOrder
                    ? t("quests.dailyNumbers.selectedTilePosition", {
                        value: tile.value,
                        position: selectionOrder,
                      })
                    : availability.disabled
                      ? t("quests.dailyNumbers.tileUnavailable", {
                          value: tile.value,
                        })
                      : t("quests.dailyNumbers.tileValue", {
                          value: tile.value,
                        })
                }
              >
                {tile.source === "derived" ? (
                  <Text
                    className="absolute right-2 top-1 font-nunito-extrabold text-[10px] text-accentStrong"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    ✦
                  </Text>
                ) : null}
                <Text
                  className={`text-center font-nunito-extrabold ${compact ? "text-[22px]" : "text-[25px]"}`}
                  style={{
                    color: availability.selected ? modeAccent.text : tc.fg,
                    fontVariant: ["tabular-nums"],
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.68}
                >
                  {tile.value}
                </Text>
                {selectionOrder ? (
                  <View
                    className="absolute bottom-1 left-1 h-5 w-5 items-center justify-center rounded-full"
                    style={{ backgroundColor: modeAccent.text }}
                  >
                    <Text className="font-nunito-extrabold text-[10px] text-white">
                      {selectionOrder}
                    </Text>
                  </View>
                ) : availability.wouldBeInvalid ? (
                  <Text className="absolute bottom-1 left-2 font-nunito-extrabold text-xs text-dangerText">
                    ×
                  </Text>
                ) : null}
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
  return (
    <View className="mt-3">
      <Text className="px-1 font-nunito-extrabold text-sm text-fg">
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
              className={`${compact ? "min-h-[48px]" : "min-h-[52px]"} flex-1 items-center justify-center rounded-[16px] border-2 px-2 py-2`}
              style={({ pressed }) => ({
                borderColor: availability.selected
                  ? tc.accentStrong
                  : tc.primaryBorder,
                backgroundColor: availability.selected
                  ? tc.accentTint
                  : tc.surface,
                opacity:
                  availability.disabled && !availability.selected
                    ? 0.34
                    : pressed
                      ? 0.76
                      : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
                boxShadow: availability.selected
                  ? `0px 3px 7px ${withAlpha(tc.accentStrong, "20")}`
                  : undefined,
              })}
              testID={`daily-numbers-operator-${operator === "*" ? "multiply" : operator === "/" ? "divide" : operator === "+" ? "plus" : "minus"}`}
              accessibilityRole="button"
              accessibilityState={{
                selected: availability.selected,
                disabled: availability.disabled,
              }}
              accessibilityLabel={
                availability.wouldBeInvalid && !availability.selected
                  ? t("quests.dailyNumbers.operatorUnavailable", {
                      operator: displayOperator(operator),
                    })
                  : t("quests.dailyNumbers.operatorValue", {
                      operator: displayOperator(operator),
                    })
              }
            >
              <Text
                className={`text-center font-nunito-extrabold ${compact ? "text-[20px]" : "text-[23px]"}`}
                style={{
                  color: availability.selected ? tc.accentStrong : tc.fg,
                }}
              >
                {displayOperator(operator)}
              </Text>
              {availability.selected ? (
                <View className="absolute bottom-1.5 right-1.5 h-4 w-4 items-center justify-center rounded-full bg-accentStrong">
                  <CheckIcon size={10} color="#FFFFFF" />
                </View>
              ) : availability.wouldBeInvalid ? (
                <View className="absolute right-1.5 top-1.5 h-3.5 w-3.5 items-center justify-center rounded-full bg-dangerTint">
                  <Text className="font-nunito-extrabold text-[9px] text-dangerText">
                    ×
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function EquationResult({
  expanded,
  modeAccent,
  previewState,
  tc,
}: {
  expanded?: boolean;
  modeAccent: ReturnType<typeof getModeAccent>;
  previewState: PreviewState;
  tc: ThemeColors;
}) {
  return (
    <View
      className={`${expanded ? "flex-1" : "min-w-[58px] max-w-[72px] flex-1"} h-12 items-center justify-center rounded-[15px] border-2 border-dashed bg-surface px-1.5`}
      style={{
        borderColor:
          previewState.kind === "invalid" ? tc.dangerBorder : modeAccent.text,
      }}
    >
      <Text
        className={`text-center font-nunito-extrabold text-base ${previewState.kind === "invalid" ? "text-dangerText" : "text-fg"}`}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {previewState.kind === "ready" ? previewState.result : "—"}
      </Text>
    </View>
  );
}

function EquationWorkbench({
  interactionLocked,
  localSteps,
  modeAccent,
  onClearSlot,
  previewState,
  selectedLeftTile,
  selectedOperator,
  selectedRightTile,
  t,
  tc,
}: {
  interactionLocked: boolean;
  localSteps: DailyNumbersStep[];
  modeAccent: ReturnType<typeof getModeAccent>;
  onClearSlot: (slot: SlotKey) => void;
  previewState: PreviewState;
  selectedLeftTile: BoardTile | null;
  selectedOperator: Operator | null;
  selectedRightTile: BoardTile | null;
  t: TranslateFn;
  tc: ThemeColors;
}) {
  const { fontScale, width } = useWindowDimensions();
  const stackResult = fontScale >= 1.35 || width < 350;

  return (
    <>
      <View className="mb-2 flex-row items-center justify-between px-1">
        <Text className="font-nunito-extrabold text-sm text-fg">
          {t("quests.dailyNumbers.selection")}
        </Text>
        <View
          className="rounded-full px-2.5 py-1"
          style={{ backgroundColor: modeAccent.bg }}
        >
          <Text
            className="font-nunito-extrabold text-[10px]"
            style={{ color: modeAccent.text }}
          >
            {t("quests.dailyNumbers.stepNumber", {
              step: localSteps.length + 1,
            })}
          </Text>
        </View>
      </View>

      <View
        className="rounded-[20px] border p-2.5"
        style={{
          backgroundColor: modeAccent.bg,
          borderColor: modeAccent.border,
        }}
      >
        <View className="flex-row items-center gap-1.5">
          <Pressable
            onPress={() => onClearSlot("left")}
            className="h-12 min-w-0 flex-1 items-center justify-center rounded-[15px] border-2 bg-surface px-1.5"
            style={{
              borderColor: selectedLeftTile
                ? modeAccent.text
                : tc.primaryBorder,
            }}
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
              className="text-center font-nunito-extrabold text-base text-fg"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.68}
            >
              {selectedLeftTile?.value ?? "—"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onClearSlot("operator")}
            className="h-12 w-11 items-center justify-center rounded-[15px] border-2 px-1"
            style={{
              backgroundColor: selectedOperator ? tc.accentTint : tc.surface,
              borderColor: selectedOperator
                ? tc.accentStrong
                : tc.primaryBorder,
            }}
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
              {selectedOperator ? displayOperator(selectedOperator) : "?"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onClearSlot("right")}
            className="h-12 min-w-0 flex-1 items-center justify-center rounded-[15px] border-2 bg-surface px-1.5"
            style={{
              borderColor: selectedRightTile
                ? modeAccent.text
                : tc.primaryBorder,
            }}
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
              className="text-center font-nunito-extrabold text-base text-fg"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.68}
            >
              {selectedRightTile?.value ?? "—"}
            </Text>
          </Pressable>
          {!stackResult ? (
            <>
              <Text className="px-0.5 font-nunito-extrabold text-base text-fgMuted">
                =
              </Text>
              <EquationResult
                modeAccent={modeAccent}
                previewState={previewState}
                tc={tc}
              />
            </>
          ) : null}
        </View>
        {stackResult ? (
          <View className="mt-2 flex-row items-center gap-2">
            <Text className="w-6 text-center font-nunito-extrabold text-lg text-fgMuted">
              =
            </Text>
            <EquationResult
              expanded
              modeAccent={modeAccent}
              previewState={previewState}
              tc={tc}
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
        className="mt-3 rounded-[26px] border-2 bg-surface px-3 py-3"
        style={{
          borderColor: modeAccent.border,
          boxShadow: `0px 5px 14px ${withAlpha(modeAccent.text, "14")}`,
        }}
      >
        <EquationWorkbench
          interactionLocked={interactionLocked}
          localSteps={localSteps}
          modeAccent={modeAccent}
          onClearSlot={onClearSlot}
          previewState={previewState}
          selectedLeftTile={selectedLeftTile}
          selectedOperator={selectedOperator}
          selectedRightTile={selectedRightTile}
          t={t}
          tc={tc}
        />

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

        <QuestActionButton
          label={t("quests.dailyNumbers.applyStep")}
          onPress={onApplyStep}
          disabled={interactionLocked}
          backgroundColor={interactionLocked ? tc.surfaceMuted : tc.accentDark}
          foregroundColor={interactionLocked ? tc.fgMuted : "#FFFFFF"}
          borderColor={interactionLocked ? tc.primaryBorder : tc.accentStrong}
          leadingIcon={SparklesIcon}
          minHeight={50}
          accessibilityLabel={t("quests.dailyNumbers.applyStep")}
          testID="daily-numbers-apply-step"
          style={{ marginTop: 12 }}
        />
      </View>

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
        backgroundColor={interactionLocked ? tc.surfaceMuted : tc.primary}
        foregroundColor={interactionLocked ? tc.fgMuted : "#FFFFFF"}
        borderColor={interactionLocked ? tc.primaryBorder : tc.primaryDark}
        leadingIcon={CheckIcon}
        minHeight={50}
        accessibilityLabel={
          archiveMode
            ? t("quests.dailyNumbers.archiveSaveResult")
            : t("quests.dailyNumbers.submit")
        }
        testID="daily-numbers-submit"
        style={{ marginTop: 12 }}
      />

      <View className="mt-2 flex-row gap-2">
        <View className="min-w-0 flex-1">
          <QuestActionButton
            label={t("quests.dailyNumbers.undo")}
            onPress={onUndoStep}
            disabled={interactionLocked}
            backgroundColor={tc.surface}
            foregroundColor={tc.fg}
            borderColor={tc.primaryBorder}
            leadingIcon={SkipBackIcon}
            leadingIconSize={16}
            minHeight={46}
            textClassName="font-nunito-bold text-xs"
            accessibilityLabel={t("quests.dailyNumbers.undo")}
            testID="daily-numbers-undo"
          />
        </View>
        <View className="min-w-0 flex-1">
          <QuestActionButton
            label={t("quests.dailyNumbers.reset")}
            onPress={onResetBoard}
            disabled={interactionLocked}
            backgroundColor={tc.surface}
            foregroundColor={tc.fg}
            borderColor={tc.primaryBorder}
            leadingIcon={RecycleIcon}
            leadingIconSize={16}
            minHeight={46}
            textClassName="font-nunito-bold text-xs"
            accessibilityLabel={t("quests.dailyNumbers.reset")}
            testID="daily-numbers-reset"
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
            backgroundColor={tc.surface}
            foregroundColor={tc.primaryText}
            borderColor={tc.primaryBorder}
            leadingIcon={EyeIcon}
            minHeight={48}
            style={{ marginTop: 12 }}
            testID="daily-numbers-archive-reveal-solution"
            accessibilityState={{ expanded: revealedSolution }}
            accessibilityLabel={
              revealedSolution
                ? t("quests.dailyNumbers.hideSolution")
                : t("quests.dailyNumbers.revealSolution")
            }
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
    dailyNumbersBoardReducer,
    state,
    createDailyNumbersBoardInteractionState,
  );
  const hasLockedSubmission = state.submitted === true && !interaction.retrying;
  const attemptTiming = getDailyNumbersAttemptTiming(interaction);
  const chronometer = useDailyNumbersChronometer({
    active: chronometerActive && !hasLockedSubmission,
    attemptScope: attemptTiming.attemptScope,
    resetSignal: attemptTiming.resetSignal,
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
        shellBorder: tc.successBorder,
        shellBg: tc.successTint,
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
          shellBorder: tc.dangerBorder,
          shellBg: tc.dangerTint,
          resultBorder: tc.dangerBorder,
          resultBg: tc.surface,
          resultText: tc.dangerText,
          summaryText: tc.dangerText,
          statusText: tc.dangerText,
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
      distanceLabel: controller.t("quests.dailyNumbers.distanceLabel"),
      scoreLabel: controller.t("quests.dailyNumbers.scoreLabel"),
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
  const finishAnnouncementSentRef = useRef(false);

  useEffect(() => {
    if (!controller.finishScreenState) {
      finishAnnouncementSentRef.current = false;
      return;
    }

    if (finishAnnouncementSentRef.current) {
      return;
    }

    finishAnnouncementSentRef.current = true;
    const announcement =
      controller.finishSummary ??
      controller.t(
        controller.exactHitState
          ? "quests.dailyNumbers.exactHitLabel"
          : "quests.dailyNumbers.resultLockedLabel",
      );

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        AccessibilityInfo.announceForAccessibility(announcement);
      });
    });
  }, [
    controller.exactHitState,
    controller.finishScreenState,
    controller.finishSummary,
    controller.t,
    scrollViewRef,
  ]);

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

      <View className="flex-1">
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
          accessibilityElementsHidden
          pointerEvents="none"
          collapsable={false}
          importantForAccessibility="no-hide-descendants"
          style={{ position: "absolute", left: -9999, top: 0 }}
        >
          <View ref={shareCardRef} collapsable={false}>
            <DailyNumbersGameShareCard
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
  const scrollViewRef = useRef<ScrollView>(null);

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
        ref={scrollViewRef}
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
          {archiveMode ? (
            <View className="mb-2 flex-row flex-wrap items-center justify-center gap-2 rounded-2xl border border-secondaryBorder bg-secondaryTint px-3 py-2">
              <View
                className="rounded-full border border-secondaryBorder bg-secondary px-3 py-1"
                testID="daily-numbers-archive-pill"
              >
                <Text className="text-center font-nunito-extrabold text-[10px] uppercase tracking-[1px] text-secondaryText">
                  {t("quests.dailyNumbers.archiveResultLabel")}
                </Text>
              </View>
              <Text className="text-center font-nunito-extrabold text-xs text-secondaryText">
                {archiveDate}
              </Text>
            </View>
          ) : null}

          <ModeTabs
            activeMode={activeMode}
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
          {!state.submitted ? (
            <View className="mt-3 flex-row items-center gap-2 rounded-2xl border border-primaryBorder bg-surfaceMuted px-3 py-2">
              <SparklesIcon size={15} color={modeAccent.text} />
              <Text className="min-w-0 flex-1 font-nunito-semibold text-[11px] leading-4 text-fgMuted">
                {archiveMode
                  ? t("quests.dailyNumbers.archiveHelperLine")
                  : t("quests.dailyNumbers.helperLine")}
              </Text>
            </View>
          ) : null}
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
