import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ApiClientError,
  type DailyNumbersMode,
  type DailyNumbersStateResponse,
  type DailyNumbersStep,
  type DailyNumbersStepInput,
} from "@adventure-time/api-client";

import { PageErrorState } from "../../src/components/error-state";
import { PageLoadingState } from "../../src/components/loading-state";
import {
  DAILY_NUMBERS_MODES,
  getModeAccent,
  getModeStatusLabel,
  getQuestTypeForMode,
} from "../../src/features/quests/daily-numbers/shared";
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
type Operator = DailyNumbersStep["operator"];
type PreviewState =
  | { kind: "empty" }
  | { kind: "invalid"; reason: "division" | "positive" }
  | { kind: "ready"; result: number };
type TranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;
type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
type ModeCard = {
  mode: DailyNumbersMode;
  state: DailyNumbersStateResponse | undefined;
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
  interaction: BoardInteractionState;
  onClaimReward: () => void;
  onToggleSolution: () => void;
  state: DailyNumbersStateResponse;
  submittedSolutionSteps: DailyNumbersStep[];
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
  onUndoStep: () => void;
  previewState: PreviewState;
  selectedLeftTile: BoardTile | null;
  selectedOperator: Operator | null;
  selectedRightTile: BoardTile | null;
  submitting: boolean;
  t: TranslateFn;
  tc: ThemeColors;
};

const OPERATORS: Operator[] = ["+", "-", "*", "/"];
const EXACT_HIT_PERCENT = 100;

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
  numbers: DailyNumbersStateResponse["numbers"],
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
  numbers: DailyNumbersStateResponse["numbers"],
  target: number,
) {
  return Math.abs(chooseClosestTile(numbers, target).value - target);
}

function applyOperation(
  leftValue: number,
  operator: Operator,
  rightValue: number,
) {
  if (operator === "+") {
    return { ok: true as const, result: leftValue + rightValue };
  }

  if (operator === "*") {
    return { ok: true as const, result: leftValue * rightValue };
  }

  if (operator === "-") {
    const result = leftValue - rightValue;
    return result > 0
      ? { ok: true as const, result }
      : { ok: false as const, reason: "positive" as const };
  }

  if (rightValue === 0 || leftValue % rightValue !== 0) {
    return { ok: false as const, reason: "division" as const };
  }

  const result = leftValue / rightValue;
  return result > 0
    ? { ok: true as const, result }
    : { ok: false as const, reason: "positive" as const };
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

function buildSubmissionSummary(
  t: TranslateFn,
  submission: NonNullable<DailyNumbersStateResponse["submission"]>,
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

function buildBoardIdentity(state: DailyNumbersStateResponse) {
  const numbersIdentity = state.numbers
    .map((tile) => `${tile.id}:${tile.value}`)
    .join("|");
  return [
    state.mode,
    state.date,
    state.questVersion ?? "no-version",
    state.submitted ? "submitted" : "fresh",
    numbersIdentity,
  ].join(":");
}

function createBoardInteractionState(
  state: DailyNumbersStateResponse,
): BoardInteractionState {
  return {
    steps: state.submission?.steps ?? [],
    selectedLeftId: null,
    selectedOperator: null,
    selectedRightId: null,
    message: null,
    submitting: false,
    revealedSolution: false,
  };
}

function boardReducer(
  state: BoardInteractionState,
  action: BoardAction,
): BoardInteractionState {
  if (action.type === "selectTile") {
    if (
      action.tileId === state.selectedLeftId ||
      action.tileId === state.selectedRightId
    ) {
      return state;
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
    };
  }

  return {
    ...state,
    revealedSolution: !state.revealedSolution,
  };
}

function MessageBanner({ message }: { message: MessageState }) {
  if (!message) {
    return null;
  }

  return (
    <View
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

function BackButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        triggerLightHaptic();
        onPress();
      }}
      className="w-full overflow-hidden rounded-xl"
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View className="items-center rounded-xl bg-primary py-2">
        <Text className="font-nunito-semibold text-sm text-primaryBg">
          {label}
        </Text>
      </View>
    </Pressable>
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
            accessibilityLabel={t(
              mode === "classic"
                ? "quests.dailyNumbers.classic"
                : "quests.dailyNumbers.expert",
            )}
          >
            <Text className="text-center font-nunito-bold text-sm text-fg">
              {t(
                mode === "classic"
                  ? "quests.dailyNumbers.classic"
                  : "quests.dailyNumbers.expert",
              )}
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
  state,
  t,
  tc,
}: {
  compact: boolean;
  currentBestTile: BoardTile | null;
  currentDistance: number | undefined;
  state: DailyNumbersStateResponse;
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
      </View>
    </View>
  );
}

function SuccessCallout({
  completionReached,
  t,
}: {
  completionReached: boolean;
  t: TranslateFn;
}) {
  return (
    <View className="mb-1 rounded-2xl border border-successBorder bg-successTint px-3 py-2">
      <Text className="font-nunito-bold text-xs text-successText">
        {completionReached
          ? t("quests.dailyNumbers.clearReached")
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
  interaction,
  onClaimReward,
  onToggleSolution,
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
        <View className="min-w-[96px] flex-1 rounded-2xl border border-primaryBorder bg-surface px-3 py-3">
          <Text className="font-nunito-semibold text-[10px] uppercase tracking-[1px] text-fgMuted">
            {t("quests.dailyNumbers.reward")}
          </Text>
          <Text className="font-nunito-extrabold text-2xl text-secondaryDark">
            {state.reward}
          </Text>
        </View>
      </View>
      {claimable && state.questVersion ? (
        <Pressable
          onPress={onClaimReward}
          disabled={claimPending}
          className="mt-5 rounded-2xl px-4 py-4"
          style={{
            backgroundColor: claimPending ? tc.surfaceMuted : tc.successDark,
          }}
          accessibilityRole="button"
          accessibilityLabel={t("quests.claim")}
        >
          <Text className="text-center font-nunito-bold text-sm text-white">
            {claimPending
              ? "…"
              : t("quests.dailyNumbers.claimReward", {
                  reward: state.reward,
                })}
          </Text>
        </Pressable>
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
      {state.submission?.officialSolutionUnlocked ? (
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
                {state.submission.officialSolutionSteps.map((step, index) => (
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

function LivePlayPanel({
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
  onUndoStep,
  previewState,
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
        className="mt-3 rounded-2xl border px-3 py-3"
        style={{
          borderColor: modeAccent.border,
          backgroundColor: modeAccent.bg,
        }}
      >
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => onClearSlot("left")}
            className="flex-1 rounded-2xl border border-primaryBorder bg-surface px-3 py-3"
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
            className="w-12 rounded-2xl border border-primaryBorder bg-surfaceMuted px-2 py-3"
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
            className="flex-1 rounded-2xl border border-primaryBorder bg-surface px-3 py-3"
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
      </View>

      <View className="mt-2 flex-1">
        <Text className="font-nunito-bold text-sm text-fg">
          {t("quests.dailyNumbers.availableNumbers")}
        </Text>
        <View className="mt-2 flex-row flex-wrap justify-between gap-y-2">
          {availableTiles.map((tile) => {
            const selected =
              tile.id === selectedLeftTile?.id ||
              tile.id === selectedRightTile?.id;

            return (
              <Pressable
                key={tile.id}
                onPress={() => onTilePress(tile.id)}
                disabled={interactionLocked}
                className="w-[31.5%] rounded-2xl border px-2 py-2.5"
                style={{
                  borderColor: selected ? modeAccent.text : tc.primaryBorder,
                  backgroundColor: selected ? modeAccent.bg : tc.primaryBg,
                }}
                testID={`daily-numbers-tile-${tile.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: interactionLocked }}
                accessibilityLabel={t("quests.dailyNumbers.tileValue", {
                  value: tile.value,
                })}
              >
                <Text
                  className={`text-center font-nunito-extrabold ${compact ? "text-[20px]" : "text-[22px]"}`}
                  style={{ color: selected ? modeAccent.text : tc.fg }}
                >
                  {tile.value}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="mt-2 font-nunito-bold text-sm text-fg">
          {t("quests.dailyNumbers.operators")}
        </Text>
        <View className="mt-2 flex-row gap-2">
          {OPERATORS.map((operator) => {
            const selected = selectedOperator === operator;

            return (
              <Pressable
                key={operator}
                onPress={() => onOperatorPress(operator)}
                disabled={interactionLocked}
                className="flex-1 rounded-2xl border px-3 py-3"
                style={{
                  borderColor: selected ? tc.accentStrong : tc.primaryBorder,
                  backgroundColor: selected ? tc.accentTint : tc.primaryBg,
                }}
                testID={`daily-numbers-operator-${operator === "*" ? "multiply" : operator === "/" ? "divide" : operator === "+" ? "plus" : "minus"}`}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: interactionLocked }}
                accessibilityLabel={t("quests.dailyNumbers.operatorValue", {
                  operator: displayOperator(operator),
                })}
              >
                <Text
                  className={`text-center font-nunito-extrabold ${compact ? "text-lg" : "text-xl"}`}
                  style={{ color: selected ? tc.accentStrong : tc.fg }}
                >
                  {operator === "*" ? "×" : operator}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <StepList
        emptyCopy={t("quests.dailyNumbers.noStepsYet")}
        steps={localSteps}
        t={t}
        title={t("quests.dailyNumbers.stepHistoryTitle")}
      />

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
          accessibilityLabel={t("quests.dailyNumbers.submit")}
        >
          <Text
            className="text-center font-nunito-bold text-sm"
            style={{ color: interactionLocked ? tc.fgMuted : tc.primaryBg }}
          >
            {submitting ? "…" : t("quests.dailyNumbers.submit")}
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
    </>
  );
}

function useDailyNumbersBoardController({
  activeMode,
  bannerMessage,
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
  bannerMessage: MessageState;
  claimPending: boolean;
  compact: boolean;
  modeAccent: ReturnType<typeof getModeAccent>;
  onClaimReward: () => void;
  onResolveResetError: (error: unknown) => Promise<boolean>;
  onSubmissionApplied: (nextState: DailyNumbersStateResponse) => void;
  state: DailyNumbersStateResponse;
  t: TranslateFn;
  tc: ThemeColors;
}) {
  const [interaction, dispatch] = useReducer(
    boardReducer,
    state,
    createBoardInteractionState,
  );

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
    state.submitted !== true &&
    interaction.steps.length > 0 &&
    currentDistance === 0;
  const completionReached =
    state.submitted !== true &&
    interaction.steps.length > 0 &&
    currentDistance < defaultDistance;
  const successState =
    state.submission?.completed === true || completionReached;
  const exactHitState = state.submission?.exact === true || exactHitReached;
  const finishScreenState = exactHitState || state.submitted === true;
  const interactionLocked =
    interaction.submitting || state.submitted === true || exactHitReached;
  const previewState = useMemo<PreviewState>(() => {
    if (
      !selectedLeftTile ||
      !interaction.selectedOperator ||
      !selectedRightTile
    ) {
      return { kind: "empty" };
    }

    const result = applyOperation(
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
      if (state.submitted || interaction.submitting) {
        return;
      }

      if (!alreadyStarted) {
        dispatch({ type: "submitStarted" });
      }

      try {
        const nextState = await apiClient.submitDailyNumbers({
          mode: activeMode,
          dateKey: state.date,
          questVersion: state.questVersion ?? undefined,
          steps: toStepInputs(stepsToSubmit),
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
      interaction.submitting,
      onResolveResetError,
      onSubmissionApplied,
      state,
      t,
    ],
  );

  const handleTilePress = useCallback(
    (tileId: string) => {
      if (interactionLocked) {
        return;
      }

      if (
        tileId === interaction.selectedLeftId ||
        tileId === interaction.selectedRightId ||
        (interaction.selectedLeftId && interaction.selectedRightId)
      ) {
        return;
      }

      triggerSelectionHaptic();
      dispatch({ type: "selectTile", tileId });
    },
    [
      interaction.selectedLeftId,
      interaction.selectedRightId,
      interactionLocked,
    ],
  );

  const handleOperatorPress = useCallback(
    (operator: Operator) => {
      if (interactionLocked) {
        return;
      }

      if (!interaction.selectedLeftId) {
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

      triggerSelectionHaptic();
      dispatch({ type: "toggleOperator", operator });
    },
    [interaction.selectedLeftId, interactionLocked, t],
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

    const operation = applyOperation(
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

    if (interaction.steps.length === 0) {
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
  }, [interaction.steps.length, interactionLocked, t]);

  const handleSubmitPress = useCallback(() => {
    if (interaction.submitting || state.submitted) {
      return;
    }

    triggerPrimaryHaptic();
    Alert.alert(
      t("quests.dailyNumbers.submitConfirmTitle"),
      t("quests.dailyNumbers.submitConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("quests.dailyNumbers.submitConfirmAction"),
          style: "destructive",
          onPress: () => {
            void submitBoard(interaction.steps);
          },
        },
      ],
    );
  }, [
    interaction.steps,
    interaction.submitting,
    state.submitted,
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
          shellBorder: modeAccent.border,
          shellBg: modeAccent.bg,
          resultBorder: modeAccent.border,
          resultBg: tc.surface,
          resultText: modeAccent.text,
          summaryText: modeAccent.text,
          statusText: modeAccent.text,
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
    ? buildSubmissionSummary(t, state.submission)
    : null;
  const exactHitScore =
    state.submission?.score ?? (exactHitState ? EXACT_HIT_PERCENT : null);
  const exactHitSummary =
    exactHitScore === null
      ? null
      : t("quests.dailyNumbers.exactResult", {
          score: exactHitScore,
        });
  const finishSummary = exactHitState ? exactHitSummary : submissionSummary;
  const finishValue =
    state.submission?.finalValue ??
    (finishScreenState ? (currentBestTile?.value ?? null) : null);
  const finishDistance =
    state.submission?.distance ?? (finishScreenState ? currentDistance : null);
  const finishScore =
    state.submission?.score ?? (exactHitState ? EXACT_HIT_PERCENT : null);
  const submittedSolutionSteps =
    state.submission?.steps ?? (exactHitState ? interaction.steps : []);
  const claimable =
    state.submitted === true &&
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
    interaction,
    interactionLocked,
    modeAccent,
    onApplyStep: handleApplyStep,
    onClaimReward: handleClaimReward,
    onClearSlot: handleClearSlot,
    onOperatorPress: handleOperatorPress,
    onResetBoard: handleResetBoard,
    onSubmitPress: handleSubmitPress,
    onTilePress: handleTilePress,
    onToggleSolution: handleToggleSolution,
    onUndoStep: handleUndoStep,
    previewState,
    selectedLeftTile,
    selectedOperator: interaction.selectedOperator,
    selectedRightTile,
    state,
    submittedSolutionSteps,
    t,
    tc,
    visibleMessage,
  };
}

function DailyNumbersBoard({
  activeMode,
  bannerMessage,
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
  bannerMessage: MessageState;
  claimPending: boolean;
  compact: boolean;
  modeAccent: ReturnType<typeof getModeAccent>;
  onClaimReward: () => void;
  onResolveResetError: (error: unknown) => Promise<boolean>;
  onSubmissionApplied: (nextState: DailyNumbersStateResponse) => void;
  state: DailyNumbersStateResponse;
  t: TranslateFn;
  tc: ThemeColors;
}) {
  const controller = useDailyNumbersBoardController({
    activeMode,
    bannerMessage,
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

  return (
    <>
      <MessageBanner message={controller.visibleMessage} />
      {controller.completionReached && !controller.finishScreenState ? (
        <SuccessCallout
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
            state={controller.state}
            t={controller.t}
            tc={controller.tc}
          />
        ) : null}

        {controller.finishScreenState ? (
          <FinishStatePanel
            claimable={controller.claimable}
            claimPending={controller.claimPending}
            compact={controller.compact}
            exactHitState={controller.exactHitState}
            finishCompleted={controller.finishCompletedState}
            finishDistance={controller.finishDistance}
            finishScore={controller.finishScore}
            finishSummary={controller.finishSummary}
            finishTone={controller.finishTone}
            finishValue={controller.finishValue}
            interaction={controller.interaction}
            onClaimReward={controller.onClaimReward}
            onToggleSolution={controller.onToggleSolution}
            state={controller.state}
            submittedSolutionSteps={controller.submittedSolutionSteps}
            t={controller.t}
            tc={controller.tc}
          />
        ) : (
          <LivePlayPanel
            availableTiles={controller.board.availableTiles}
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
            onUndoStep={controller.onUndoStep}
            previewState={controller.previewState}
            selectedLeftTile={controller.selectedLeftTile}
            selectedOperator={controller.selectedOperator}
            selectedRightTile={controller.selectedRightTile}
            submitting={controller.interaction.submitting}
            t={controller.t}
            tc={controller.tc}
          />
        )}
      </View>
    </>
  );
}

function finishCompleted(
  state: DailyNumbersStateResponse,
  successState: boolean,
) {
  return state.submission?.completed === true || successState;
}

export default function DailyNumbersPlayScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
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
  const initialMode = params.mode === "expert" ? "expert" : "classic";
  const [activeMode, setActiveMode] = useState<DailyNumbersMode>(initialMode);
  const [uiMessage, setUiMessage] = useState<MessageState>(null);

  const modeQueries = useQueries({
    queries: DAILY_NUMBERS_MODES.map((mode) => ({
      queryKey: ["daily-numbers", mode] as const,
      queryFn: () => apiClient.dailyNumbersState(mode),
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
  const activeQueryIndex = activeMode === "classic" ? 0 : 1;
  const activeQuery = modeQueries[activeQueryIndex];
  const state = modeCards[activeQueryIndex].state;
  const modeAccent = getModeAccent(activeMode, tc);
  const resetNoticeMessage = useMemo<MessageState>(() => {
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
  }, [activeMode, lastQuestResetAt, lastQuestResetPayload, t]);

  useEffect(() => {
    if (params.mode === "classic" || params.mode === "expert") {
      setActiveMode(params.mode);
    }
  }, [params.mode]);

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

  const handleModeSelect = useCallback((mode: DailyNumbersMode) => {
    setActiveMode(mode);
    setUiMessage(null);
  }, []);

  const handleResetError = useCallback(
    async (error: unknown) => {
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
    [activeMode, queryClient, t],
  );

  const handleSubmissionApplied = useCallback(
    (nextState: DailyNumbersStateResponse) => {
      queryClient.setQueryData(["daily-numbers", activeMode], nextState);
      void queryClient.invalidateQueries({ queryKey: ["quests"] });
      setUiMessage(null);
    },
    [activeMode, queryClient],
  );

  const boardIdentity = state ? buildBoardIdentity(state) : null;
  const bannerMessage = uiMessage ?? resetNoticeMessage;

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
      />
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 10,
          paddingHorizontal: compact ? 10 : 14,
        }}
      >
        <View className="mb-3 items-center gap-2">
          <Text className="text-center font-nunito-extrabold text-[28px] text-primaryDark">
            {t("quests.dailyNumbers.title")}
          </Text>
          <Text className="max-w-[340px] text-center font-nunito text-sm text-primaryDark/80">
            {t("quests.dailyNumbers.subtitle")}
          </Text>
          <BackButton
            label={t("quests.dailyNumbers.backToQuests")}
            onPress={() => router.back()}
          />
        </View>

        <ModeTabs
          activeMode={activeMode}
          modeCards={modeCards}
          onSelectMode={handleModeSelect}
          t={t}
          tc={tc}
        />

        <Text className="mb-2 px-1 text-center font-nunito-semibold text-xs text-fgMuted">
          {t("quests.dailyNumbers.helperLine")}
        </Text>

        <DailyNumbersBoard
          key={boardIdentity}
          activeMode={activeMode}
          bannerMessage={bannerMessage}
          claimPending={claimQuestMutation.isPending}
          compact={compact}
          modeAccent={modeAccent}
          onClaimReward={() => {
            if (state.questVersion) {
              void claimQuestMutation.mutateAsync(state.questVersion);
            }
          }}
          onResolveResetError={handleResetError}
          onSubmissionApplied={handleSubmissionApplied}
          state={state}
          t={t}
          tc={tc}
        />
      </View>
    </ScrollView>
  );
}
