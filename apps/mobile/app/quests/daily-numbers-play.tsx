import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Text, View, useWindowDimensions } from "react-native";
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

const OPERATORS: Operator[] = ["+", "-", "*", "/"];
const EXACT_HIT_SCORE = 1000;

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

function applyOperation(leftValue: number, operator: Operator, rightValue: number) {
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
  t: (key: string, params?: Record<string, string | number>) => string,
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

export default function DailyNumbersPlayScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const lastQuestResetAt = useQuestResetStore((state) => state.lastResetAt);
  const lastQuestResetPayload = useQuestResetStore((state) => state.lastPayload);

  const compact = height < 820 || width < 390;
  const initialMode = params.mode === "expert" ? "expert" : "classic";
  const [activeMode, setActiveMode] = useState<DailyNumbersMode>(initialMode);
  const [localSteps, setLocalSteps] = useState<DailyNumbersStep[]>([]);
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [selectedRightId, setSelectedRightId] = useState<string | null>(null);
  const [message, setMessage] = useState<MessageState>(null);
  const [submitting, setSubmitting] = useState(false);
  const boardIdentityRef = useRef<string | null>(null);
  const autoSubmitKeyRef = useRef<string | null>(null);

  const modeQueries = useQueries({
    queries: DAILY_NUMBERS_MODES.map((mode) => ({
      queryKey: ["daily-numbers", mode] as const,
      queryFn: () => apiClient.dailyNumbersState(mode),
    })),
  });

  const activeQueryIndex = activeMode === "classic" ? 0 : 1;
  const activeQuery = modeQueries[activeQueryIndex];
  const modeStateMap: Record<
    DailyNumbersMode,
    DailyNumbersStateResponse | undefined
  > = {
    classic: modeQueries[0].data,
    expert: modeQueries[1].data,
  };
  const state = modeStateMap[activeMode];
  const modeAccent = getModeAccent(activeMode, tc);

  const board = useMemo(() => {
    if (!state) {
      return { allTiles: [], availableTiles: [], usedTiles: [] };
    }

    return buildBoard(state.numbers, localSteps);
  }, [localSteps, state]);

  const availableTileMap = useMemo(
    () => new Map(board.availableTiles.map((tile) => [tile.id, tile])),
    [board.availableTiles],
  );

  const selectedLeftTile = selectedLeftId
    ? availableTileMap.get(selectedLeftId) ?? null
    : null;
  const selectedRightTile = selectedRightId
    ? availableTileMap.get(selectedRightId) ?? null
    : null;

  const currentBestTile = useMemo(() => {
    if (!state || board.availableTiles.length === 0) {
      return null;
    }

    return chooseClosestTile(board.availableTiles, state.target);
  }, [board.availableTiles, state]);

  const currentDistance =
    currentBestTile && state
      ? Math.abs(currentBestTile.value - state.target)
      : state?.bestDistance;
  const exactHitReached =
    state?.submitted !== true &&
    localSteps.length > 0 &&
    typeof currentDistance === "number" &&
    currentDistance === 0;
  const completionReached =
    state?.submitted !== true &&
    localSteps.length > 0 &&
    typeof currentDistance === "number" &&
    currentDistance <= 10;
  const successState = state?.submission?.completed === true || completionReached;
  const exactHitState = state?.submission?.exact === true || exactHitReached;
  const finishScreenState = exactHitState || state?.submitted === true;
  const interactionLocked =
    submitting || state?.submitted === true || completionReached;
  const submissionSummary =
    state?.submission ? buildSubmissionSummary(t, state.submission) : null;
  const exactHitScore = state?.submission?.score ?? (exactHitState ? EXACT_HIT_SCORE : null);
  const exactHitValue =
    state?.submission?.finalValue ?? (exactHitState ? currentBestTile?.value ?? null : null);
  const exactHitSummary =
    exactHitScore === null
      ? null
      : t("quests.dailyNumbers.exactResult", {
          score: exactHitScore,
        });
  const finishSummary = exactHitState ? exactHitSummary : submissionSummary;
  const finishValue =
    state?.submission?.finalValue ?? (finishScreenState ? currentBestTile?.value ?? null : null);
  const submittedSolutionSteps =
    state?.submission?.steps ?? (exactHitState ? localSteps : []);
  const finishCompleted = exactHitState || state?.submission?.completed === true;
  const finishTone = exactHitState
    ? {
        shellBorder: modeAccent.border,
        shellBg: modeAccent.bg,
        resultBorder: tc.successBorder,
        resultBg: tc.surface,
        resultText: tc.successText,
        summaryText: tc.successText,
        statusText: tc.successText,
      }
    : finishCompleted
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

  const previewState = useMemo<PreviewState>(() => {
    if (!selectedLeftTile || !selectedOperator || !selectedRightTile) {
      return { kind: "empty" };
    }

    const result = applyOperation(
      selectedLeftTile.value,
      selectedOperator,
      selectedRightTile.value,
    );

    if (!result.ok) {
      return { kind: "invalid", reason: result.reason };
    }

    return { kind: "ready", result: result.result };
  }, [selectedLeftTile, selectedOperator, selectedRightTile]);

  useEffect(() => {
    if (params.mode === "classic" || params.mode === "expert") {
      setActiveMode(params.mode);
    }
  }, [params.mode]);

  useEffect(() => {
    if (!state) {
      return;
    }

    const nextIdentity = [
      state.mode,
      state.date,
      state.questVersion ?? "no-version",
      state.submitted ? "submitted" : "fresh",
    ].join(":");

    if (boardIdentityRef.current === nextIdentity) {
      return;
    }

    boardIdentityRef.current = nextIdentity;
    autoSubmitKeyRef.current = null;
    setLocalSteps(state.submission?.steps ?? []);
    setSelectedLeftId(null);
    setSelectedOperator(null);
    setSelectedRightId(null);
  }, [state]);

  useEffect(() => {
    if (!lastQuestResetAt || !lastQuestResetPayload) {
      return;
    }

    const expectedQuestType = getQuestTypeForMode(activeMode);
    if (
      lastQuestResetPayload.questType &&
      lastQuestResetPayload.questType !== expectedQuestType
    ) {
      return;
    }

    boardIdentityRef.current = null;
    autoSubmitKeyRef.current = null;
    setMessage({
      type: "success",
      text: lastQuestResetPayload.resetByName
        ? t("quests.dailyNumbers.adminResetNotice", {
            name: lastQuestResetPayload.resetByName,
          })
        : t("quests.dailyNumbers.resetNotice"),
    });
    void queryClient.refetchQueries({
      queryKey: ["daily-numbers", activeMode],
      exact: true,
    });
  }, [activeMode, lastQuestResetAt, lastQuestResetPayload, queryClient, t]);

  const setMode = useCallback((mode: DailyNumbersMode) => {
    setActiveMode(mode);
    autoSubmitKeyRef.current = null;
    setMessage(null);
    setSelectedLeftId(null);
    setSelectedOperator(null);
    setSelectedRightId(null);
  }, []);

  const handleResetError = useCallback(
    async (error: unknown) => {
      if (error instanceof ApiClientError && error.code === "DAILY_NUMBERS_RESET") {
        boardIdentityRef.current = null;
        autoSubmitKeyRef.current = null;
        setMessage({
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

  const handleTilePress = useCallback(
    (tileId: string) => {
      if (interactionLocked) {
        return;
      }

      setMessage(null);

      if (tileId === selectedLeftId || tileId === selectedRightId) {
        return;
      }

      if (!selectedLeftId) {
        setSelectedLeftId(tileId);
        return;
      }

      if (!selectedRightId) {
        setSelectedRightId(tileId);
        return;
      }
    },
    [interactionLocked, selectedLeftId, selectedRightId],
  );

  const handleOperatorPress = useCallback(
    (operator: Operator) => {
      if (interactionLocked) {
        return;
      }

      if (!selectedLeftId) {
        setMessage({
          type: "error",
          text: t("quests.dailyNumbers.invalidSelection"),
        });
        return;
      }

      setMessage(null);
      setSelectedOperator((current) => (current === operator ? null : operator));
    },
    [interactionLocked, selectedLeftId, t],
  );

  const handleLeftSelectionPress = useCallback(() => {
    if (interactionLocked || !selectedLeftId) {
      return;
    }

    setMessage(null);
    setSelectedLeftId(null);
  }, [interactionLocked, selectedLeftId]);

  const handleOperatorSelectionPress = useCallback(() => {
    if (interactionLocked || !selectedOperator) {
      return;
    }

    setMessage(null);
    setSelectedOperator(null);
  }, [interactionLocked, selectedOperator]);

  const handleRightSelectionPress = useCallback(() => {
    if (interactionLocked || !selectedRightId) {
      return;
    }

    setMessage(null);
    setSelectedRightId(null);
  }, [interactionLocked, selectedRightId]);

  const applyLocalStep = useCallback(() => {
    if (interactionLocked) {
      return;
    }

    if (!state || !selectedLeftId || !selectedOperator || !selectedRightId) {
      setMessage({
        type: "error",
        text: t("quests.dailyNumbers.invalidSelection"),
      });
      return;
    }

    if (selectedLeftId === selectedRightId) {
      setMessage({
        type: "error",
        text: t("quests.dailyNumbers.invalidDifferentNumbers"),
      });
      return;
    }

    const leftTile = availableTileMap.get(selectedLeftId);
    const rightTile = availableTileMap.get(selectedRightId);

    if (!leftTile || !rightTile) {
      setMessage({
        type: "error",
        text: t("quests.dailyNumbers.invalidDifferentNumbers"),
      });
      return;
    }

    const operation = applyOperation(leftTile.value, selectedOperator, rightTile.value);

    if (!operation.ok) {
      setMessage({
        type: "error",
        text:
          operation.reason === "division"
            ? t("quests.dailyNumbers.invalidDivision")
            : t("quests.dailyNumbers.invalidPositive"),
      });
      return;
    }

    const nextStep: DailyNumbersStep = {
      leftId: leftTile.id,
      leftValue: leftTile.value,
      operator: selectedOperator,
      rightId: rightTile.id,
      rightValue: rightTile.value,
      resultId: `r${localSteps.length}`,
      resultValue: operation.result,
    };

    setLocalSteps((current) => [...current, nextStep]);
    setSelectedLeftId(null);
    setSelectedOperator(null);
    setSelectedRightId(null);
    setMessage(null);
  }, [
    availableTileMap,
    localSteps.length,
    selectedLeftId,
    selectedOperator,
    selectedRightId,
    state,
    t,
    interactionLocked,
  ]);

  const undoLastStep = useCallback(() => {
    if (interactionLocked) {
      return;
    }

    if (localSteps.length === 0) {
      setMessage({ type: "error", text: t("quests.dailyNumbers.noUndo") });
      return;
    }

    setLocalSteps((current) => current.slice(0, -1));
    setSelectedLeftId(null);
    setSelectedOperator(null);
    setSelectedRightId(null);
    setMessage(null);
  }, [interactionLocked, localSteps.length, t]);

  const resetBoard = useCallback(() => {
    if (interactionLocked) {
      return;
    }

    if (localSteps.length === 0) {
      setMessage({ type: "error", text: t("quests.dailyNumbers.noReset") });
      return;
    }

    setLocalSteps([]);
    setSelectedLeftId(null);
    setSelectedOperator(null);
    setSelectedRightId(null);
    setMessage(null);
    autoSubmitKeyRef.current = null;
  }, [interactionLocked, localSteps.length, t]);

  const submitBoard = useCallback(async () => {
    if (!state || submitting || state.submitted) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const nextState = await apiClient.submitDailyNumbers({
        mode: activeMode,
        dateKey: state.date,
        questVersion: state.questVersion ?? undefined,
        steps: toStepInputs(localSteps),
      });

      queryClient.setQueryData(["daily-numbers", activeMode], nextState);
      void queryClient.invalidateQueries({ queryKey: ["quests"] });
      setMessage(null);
    } catch (error) {
      if (await handleResetError(error)) {
        autoSubmitKeyRef.current = null;
        setSubmitting(false);
        return;
      }

      autoSubmitKeyRef.current = null;
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : t("quests.dailyNumbers.submitError"),
      });
    } finally {
      setSubmitting(false);
    }
  }, [activeMode, handleResetError, localSteps, queryClient, state, submitting, t]);

  const handleSubmitPress = useCallback(() => {
    if (!state || submitting || state.submitted) {
      return;
    }

    if (completionReached) {
      void submitBoard();
      return;
    }

    Alert.alert(
      t("quests.dailyNumbers.submitConfirmTitle"),
      t("quests.dailyNumbers.submitConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("quests.dailyNumbers.submitConfirmAction"),
          style: "destructive",
          onPress: () => {
            void submitBoard();
          },
        },
      ],
    );
  }, [completionReached, state, submitBoard, submitting, t]);

  useEffect(() => {
    if (!state || state.submitted || submitting || !completionReached) {
      return;
    }

    const nextAutoSubmitKey = [
      activeMode,
      state.date,
      state.questVersion ?? "no-version",
      currentBestTile?.id ?? "no-best-tile",
      currentBestTile?.value ?? "no-best-value",
      localSteps.length,
    ].join(":");

    if (autoSubmitKeyRef.current === nextAutoSubmitKey) {
      return;
    }

    autoSubmitKeyRef.current = nextAutoSubmitKey;
    void submitBoard();
  }, [
    activeMode,
    completionReached,
    currentBestTile?.id,
    currentBestTile?.value,
    localSteps.length,
    state,
    submitBoard,
    submitting,
  ]);

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
    <View
      className="flex-1 bg-bg"
      style={{
        paddingTop: insets.top + 10,
        paddingBottom: insets.bottom + 10,
        paddingHorizontal: compact ? 10 : 14,
      }}
    >
      <View className="mb-2 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          className="rounded-full border border-primaryBorder bg-surface px-4 py-2"
        >
          <Text className="font-nunito-bold text-sm text-primaryText">
            {t("quests.dailyNumbers.backToOverview")}
          </Text>
        </Pressable>
      </View>

      {message ? (
        <View
          className={`mb-1 rounded-2xl border px-3 py-1.5 ${message.type === "success" ? "border-successBorder bg-successTint" : "border-dangerBorder bg-dangerTint"}`}
        >
          <Text
            className={`font-nunito-semibold text-xs ${message.type === "success" ? "text-successText" : "text-dangerText"}`}
          >
            {message.text}
          </Text>
        </View>
      ) : null}

      {successState && !finishScreenState ? (
        <View className="mb-1 rounded-2xl border border-successBorder bg-successTint px-3 py-2">
          <Text className="font-nunito-bold text-xs text-successText">
            {state.submission?.completed
              ? t("quests.dailyNumbers.lockedSuccess")
              : t("quests.dailyNumbers.autoSubmittingSuccess")}
          </Text>
        </View>
      ) : null}

      <View className="mb-2 flex-row gap-2">
        {DAILY_NUMBERS_MODES.map((mode, index) => {
          const modeState = modeStateMap[mode];
          const selected = mode === activeMode;
          const accent = getModeAccent(mode, tc);
          const statusLabel = getModeStatusLabel(
            modeState,
            modeQueries[index].isLoading || modeQueries[index].isPending,
            t,
          );

          return (
            <Pressable
              key={mode}
              onPress={() => setMode(mode)}
              className="flex-1 rounded-2xl border px-3 py-2"
              style={{
                borderColor: selected ? accent.text : tc.primaryBorder,
                backgroundColor: selected ? accent.bg : tc.surface,
              }}
              testID={`daily-numbers-mode-${mode}`}
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

      <View className="flex-1 rounded-[28px] border bg-surface p-3" style={{ borderColor: modeAccent.border }}>
        {!finishScreenState ? (
          <View className="flex-row flex-wrap gap-2">
            <View className="min-w-[140px] flex-1 rounded-2xl bg-primaryBg px-4 py-3">
              <Text className="font-nunito-semibold text-[10px] uppercase tracking-[1px] text-fgMuted">
                {t("quests.dailyNumbers.target")}
              </Text>
              <Text className={`font-nunito-extrabold ${compact ? "text-[28px]" : "text-[32px]"} text-fg`}>
                {state.target}
              </Text>
            </View>
            <View className="min-w-[140px] flex-1 rounded-2xl bg-primaryBg px-4 py-3">
              <Text className="font-nunito-semibold text-[10px] uppercase tracking-[1px] text-fgMuted">
                {t("quests.dailyNumbers.bestDistance")}
              </Text>
              <Text className={`font-nunito-extrabold ${compact ? "text-[28px]" : "text-[32px]"} text-fg`}>
                {currentDistance ?? state.bestDistance}
              </Text>
            </View>
          </View>
        ) : null}

        {finishScreenState ? (
          <View
            className="flex-1 items-center justify-center rounded-[28px] border px-5 py-6"
            style={{
              borderColor: finishTone.shellBorder,
              backgroundColor: finishTone.shellBg,
            }}
          >
            <View className={`w-full ${exactHitState ? "items-center" : "flex-row items-stretch gap-2"}`}>
              <View
                className={exactHitState ? "w-full max-w-[280px] self-center" : "min-w-0 flex-1"}
                style={exactHitState ? undefined : { flexBasis: 0 }}
              >
                <Text className="text-center font-nunito-semibold text-[10px] uppercase tracking-[1px] text-fgMuted">
                  {t("quests.dailyNumbers.finalResult")}
                </Text>
                <View
                  className="mt-3 w-full rounded-[28px] border bg-surface px-4 py-5"
                  style={{
                    borderColor: finishTone.resultBorder,
                    backgroundColor: finishTone.resultBg,
                    boxShadow: "0 10px 24px rgba(0, 0, 0, 0.08)",
                  }}
                >
                  <Text
                    className={`text-center font-nunito-extrabold ${exactHitState ? "text-[40px]" : compact ? "text-[28px]" : "text-[32px]"}`}
                    style={{ color: finishTone.resultText }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {finishValue ?? state.target}
                  </Text>
                </View>
              </View>
              {!exactHitState ? (
                <View className="min-w-0 flex-1" style={{ flexBasis: 0 }}>
                  <Text className="text-center font-nunito-semibold text-[10px] uppercase tracking-[1px] text-fgMuted">
                    {t("quests.dailyNumbers.target")}
                  </Text>
                  <View className="mt-3 w-full rounded-[28px] border border-primaryBorder bg-surface px-4 py-5">
                    <Text
                      className={`text-center font-nunito-extrabold ${compact ? "text-[28px]" : "text-[32px]"} text-fg`}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {state.target}
                    </Text>
                  </View>
                </View>
              ) : null}
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
            {submitting && !state.submitted && exactHitState ? (
              <Text className="mt-2 text-center font-nunito-semibold text-xs text-fgMuted">
                {t("quests.dailyNumbers.autoSubmittingSuccess")}
              </Text>
            ) : null}
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
                <View className="flex-row items-center justify-between">
                  <Text className="font-nunito-bold text-sm text-fg">
                    {t("quests.dailyNumbers.solutionUsedTitle")}
                  </Text>
                  <Text className="font-nunito-bold text-xs text-fgMuted">
                    {submittedSolutionSteps.length}
                  </Text>
                </View>
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
          </View>
        ) : (
          <>
            <View
              className="mt-3 rounded-2xl border px-3 py-3"
              style={{ borderColor: modeAccent.border, backgroundColor: modeAccent.bg }}
            >
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={handleLeftSelectionPress}
                  className="flex-1 rounded-2xl border border-primaryBorder bg-surface px-3 py-3"
                  disabled={interactionLocked}
                >
                  <Text className="text-center font-nunito-bold text-sm text-fg">
                    {selectedLeftTile?.value ?? t("quests.dailyNumbers.pickNumber")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleOperatorSelectionPress}
                  className="w-12 rounded-2xl border border-primaryBorder bg-surfaceMuted px-2 py-3"
                  disabled={interactionLocked}
                >
                  <Text className="text-center font-nunito-extrabold text-lg text-fg">
                    {selectedOperator === "*" ? "×" : selectedOperator ?? "?"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleRightSelectionPress}
                  className="flex-1 rounded-2xl border border-primaryBorder bg-surface px-3 py-3"
                  disabled={interactionLocked}
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
                onPress={applyLocalStep}
                disabled={interactionLocked}
                className="mt-2 rounded-2xl px-3 py-3"
                style={{
                  backgroundColor: interactionLocked ? tc.surfaceMuted : tc.accentDark,
                }}
                testID="daily-numbers-apply-step"
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
                {board.availableTiles.map((tile) => {
                  const selected = tile.id === selectedLeftId || tile.id === selectedRightId;
                  return (
                    <Pressable
                      key={tile.id}
                      onPress={() => handleTilePress(tile.id)}
                      disabled={interactionLocked}
                      className="w-[31.5%] rounded-2xl border px-2 py-2.5"
                      style={{
                        borderColor: selected ? modeAccent.text : tc.primaryBorder,
                        backgroundColor: selected ? modeAccent.bg : tc.primaryBg,
                      }}
                      testID={`daily-numbers-tile-${tile.id}`}
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
                      onPress={() => handleOperatorPress(operator)}
                      disabled={interactionLocked}
                      className="flex-1 rounded-2xl border px-3 py-3"
                      style={{
                        borderColor: selected ? tc.accentStrong : tc.primaryBorder,
                        backgroundColor: selected ? tc.accentTint : tc.primaryBg,
                      }}
                      testID={`daily-numbers-operator-${operator === "*" ? "multiply" : operator === "/" ? "divide" : operator === "+" ? "plus" : "minus"}`}
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

            <View className="mt-2">
              {state.submitted && submissionSummary ? (
                <View className="rounded-2xl border border-primaryBorder bg-primaryBg px-3 py-2.5">
                  <Text className="font-nunito-semibold text-[10px] uppercase tracking-[1px] text-fgMuted">
                    {t("quests.dailyNumbers.resultCardTitle")}
                  </Text>
                  <Text className="mt-1 font-nunito-bold text-sm text-fg">
                    {submissionSummary}
                  </Text>
                </View>
              ) : (
                <>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={handleSubmitPress}
                      disabled={interactionLocked}
                      className="flex-1 rounded-2xl px-3 py-3"
                      style={{
                        backgroundColor: interactionLocked ? tc.surfaceMuted : tc.primary,
                      }}
                      testID="daily-numbers-submit"
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
                      onPress={undoLastStep}
                      disabled={interactionLocked}
                      className="flex-1 rounded-2xl border border-primaryBorder bg-surfaceMuted px-3 py-3"
                      style={{ opacity: interactionLocked ? 0.55 : 1 }}
                      testID="daily-numbers-undo"
                    >
                      <Text className="text-center font-nunito-bold text-sm text-fg">
                        {t("quests.dailyNumbers.undo")}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={resetBoard}
                      disabled={interactionLocked}
                      className="flex-1 rounded-2xl border border-primaryBorder bg-surfaceMuted px-3 py-3"
                      style={{ opacity: interactionLocked ? 0.55 : 1 }}
                      testID="daily-numbers-reset"
                    >
                      <Text className="text-center font-nunito-bold text-sm text-fg">
                        {t("quests.dailyNumbers.reset")}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}

              <View className="mt-2 flex-row items-center justify-between rounded-2xl bg-primaryBg px-3 py-2.5">
                <Text className="font-nunito-semibold text-sm text-fg">
                  {t("quests.dailyNumbers.stepHistoryTitle")}
                </Text>
                <Text className="font-nunito-bold text-sm text-fgMuted">
                  {localSteps.length}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
