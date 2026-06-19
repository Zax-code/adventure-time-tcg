import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
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

const MODES: DailyNumbersMode[] = ["classic", "expert"];
const OPERATORS: Operator[] = ["+", "-", "*", "/"];

function getQuestTypeForMode(mode: DailyNumbersMode) {
  return mode === "classic" ? "daily_numbers_classic" : "daily_numbers_expert";
}

function sortTiles(a: BoardTile, b: BoardTile) {
  if (a.status !== b.status) {
    return a.status === "available" ? -1 : 1;
  }

  return a.id.localeCompare(b.id);
}

function buildBoard(numbers: DailyNumbersStateResponse["numbers"], steps: DailyNumbersStep[]) {
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
  return [...tiles].sort((left, right) => {
    const leftDistance = Math.abs(left.value - target);
    const rightDistance = Math.abs(right.value - target);

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    if (left.value !== right.value) {
      return left.value - right.value;
    }

    return left.id.localeCompare(right.id);
  })[0];
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

export default function DailyNumbersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const lastQuestResetAt = useQuestResetStore((state) => state.lastResetAt);
  const lastQuestResetPayload = useQuestResetStore((state) => state.lastPayload);

  const initialMode = params.mode === "expert" ? "expert" : "classic";
  const [activeMode, setActiveMode] = useState<DailyNumbersMode>(initialMode);
  const [localSteps, setLocalSteps] = useState<DailyNumbersStep[]>([]);
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [selectedRightId, setSelectedRightId] = useState<string | null>(null);
  const [message, setMessage] = useState<MessageState>(null);
  const [revealedSolution, setRevealedSolution] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const boardIdentityRef = useRef<string | null>(null);

  const stateQuery = useQuery({
    queryKey: ["daily-numbers", activeMode],
    queryFn: () => apiClient.dailyNumbersState(activeMode),
  });

  const state = stateQuery.data;
  const locked = submitting || state?.submitted === true;
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

  const currentBestTile = useMemo(() => {
    if (!state || board.availableTiles.length === 0) {
      return null;
    }

    return chooseClosestTile(board.availableTiles, state.target);
  }, [board.availableTiles, state]);

  const currentDistance =
    currentBestTile && state ? Math.abs(currentBestTile.value - state.target) : state?.bestDistance;

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
    setLocalSteps(state.submission?.steps ?? []);
    setSelectedLeftId(null);
    setSelectedOperator(null);
    setSelectedRightId(null);
    setRevealedSolution(false);
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
    setMessage({
      type: "success",
      text: lastQuestResetPayload.resetByName
        ? t("quests.dailyNumbers.adminResetNotice", {
            name: lastQuestResetPayload.resetByName,
          })
        : t("quests.dailyNumbers.resetNotice"),
    });
    void stateQuery.refetch();
  }, [activeMode, lastQuestResetAt, lastQuestResetPayload, stateQuery, t]);

  const setMode = useCallback((mode: DailyNumbersMode) => {
    setActiveMode(mode);
    setMessage(null);
    setSelectedLeftId(null);
    setSelectedOperator(null);
    setSelectedRightId(null);
  }, []);

  const handleResetError = useCallback(
    async (error: unknown) => {
      if (error instanceof ApiClientError && error.code === "DAILY_NUMBERS_RESET") {
        boardIdentityRef.current = null;
        setMessage({
          type: "error",
          text: t("quests.dailyNumbers.resetNotice"),
        });
        await stateQuery.refetch();
        void queryClient.invalidateQueries({ queryKey: ["quests"] });
        return true;
      }

      return false;
    },
    [queryClient, stateQuery, t],
  );

  const handleTilePress = useCallback(
    (tileId: string) => {
      if (locked) {
        return;
      }

      setMessage(null);

      if (!selectedLeftId || (selectedLeftId && selectedOperator && selectedRightId)) {
        setSelectedLeftId(tileId);
        setSelectedOperator(null);
        setSelectedRightId(null);
        return;
      }

      if (!selectedOperator) {
        setSelectedLeftId(tileId);
        return;
      }

      if (tileId === selectedLeftId) {
        setMessage({
          type: "error",
          text: t("quests.dailyNumbers.invalidDifferentNumbers"),
        });
        return;
      }

      setSelectedRightId(tileId);
    },
    [locked, selectedLeftId, selectedOperator, selectedRightId, t],
  );

  const handleOperatorPress = useCallback(
    (operator: Operator) => {
      if (locked) {
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
      setSelectedOperator(operator);
    },
    [locked, selectedLeftId, t],
  );

  const applyLocalStep = useCallback(() => {
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
  ]);

  const undoLastStep = useCallback(() => {
    if (locked) {
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
  }, [localSteps.length, locked, t]);

  const resetBoard = useCallback(() => {
    if (locked) {
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
  }, [localSteps.length, locked, t]);

  const submitBoard = useCallback(async () => {
    if (!state || locked) {
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
      setMessage({
        type: nextState.submission?.completed ? "success" : "error",
        text:
          nextState.submission?.distance === 0
            ? t("quests.dailyNumbers.exactResult", {
                score: nextState.submission.score,
              })
            : t("quests.dailyNumbers.closeResult", {
                value: nextState.submission?.finalValue ?? 0,
                distance: nextState.submission?.distance ?? 0,
                score: nextState.submission?.score ?? 0,
              }),
      });
    } catch (error) {
      if (await handleResetError(error)) {
        setSubmitting(false);
        return;
      }

      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : t("quests.dailyNumbers.submitError"),
      });
    } finally {
      setSubmitting(false);
    }
  }, [activeMode, handleResetError, localSteps, locked, queryClient, state, t]);

  if (stateQuery.isLoading && !state) {
    return (
      <PageLoadingState
        title={t("quests.dailyNumbers.title")}
        message={t("common.loadingStates.pageBody")}
        icon="sparkles"
      />
    );
  }

  if (stateQuery.isError || !state) {
    return (
      <PageErrorState
        error={stateQuery.error}
        title={t("quests.dailyNumbers.loadError")}
        body={t("common.errorStates.generic.body")}
        detail={t("common.errorStates.generic.detail")}
        onRetry={() => {
          void stateQuery.refetch();
        }}
      />
    );
  }

  const selectedLeftTile = selectedLeftId ? availableTileMap.get(selectedLeftId) ?? null : null;
  const selectedRightTile = selectedRightId ? availableTileMap.get(selectedRightId) ?? null : null;

  return (
    <View className="flex-1 bg-primaryBg">
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center gap-2">
          <Text className="font-nunito-extrabold text-[30px] text-primaryDark">
            {t("quests.dailyNumbers.title")}
          </Text>
          <Text className="max-w-[340px] text-center font-nunito text-sm text-primaryStrong">
            {t("quests.dailyNumbers.subtitle")}
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-1 w-full rounded-2xl bg-primary px-4 py-3"
          >
            <Text className="text-center font-nunito-bold text-primaryBg">
              {t("quests.dailyNumbers.backToQuests")}
            </Text>
          </Pressable>
        </View>

        {message ? (
          <View
            className={`rounded-2xl border px-4 py-3 ${message.type === "success" ? "border-successBorder bg-successTint" : "border-dangerBorder bg-dangerTint"}`}
          >
            <Text
              className={`font-nunito-semibold text-sm ${message.type === "success" ? "text-successText" : "text-dangerText"}`}
            >
              {message.text}
            </Text>
          </View>
        ) : null}

        <View className="flex-row gap-3">
          {MODES.map((mode) => {
            const active = mode === activeMode;
            return (
              <Pressable
                key={mode}
                onPress={() => setMode(mode)}
                className={`flex-1 rounded-2xl border px-4 py-3 ${active ? "border-primaryDark bg-primaryTint" : "border-primaryBorder bg-surface"}`}
                testID={`daily-numbers-mode-${mode}`}
              >
                <Text
                  className={`text-center font-nunito-bold ${active ? "text-primaryStrong" : "text-fg"}`}
                >
                  {t(
                    mode === "classic"
                      ? "quests.dailyNumbers.classic"
                      : "quests.dailyNumbers.expert",
                  )}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <LinearGradient
          colors={[tc.primary, tc.accentDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 18 }}
        >
          <View className="gap-4">
            <View className="flex-row items-end justify-between">
              <View>
                <Text className="font-nunito-semibold text-xs uppercase tracking-[1px] text-white/80">
                  {t("quests.dailyNumbers.target")}
                </Text>
                <Text className="font-nunito-extrabold text-[42px] text-white">
                  {state.target}
                </Text>
              </View>
              <View className="items-end">
                <Text className="font-nunito-semibold text-xs uppercase tracking-[1px] text-white/80">
                  {t("quests.dailyNumbers.reward")}
                </Text>
                <Text className="font-nunito-bold text-2xl text-white">
                  {state.reward}
                </Text>
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1 rounded-2xl bg-white/15 px-3 py-3">
                <Text className="font-nunito-semibold text-xs uppercase tracking-[1px] text-white/80">
                  {t("quests.dailyNumbers.bestDistance")}
                </Text>
                <Text className="font-nunito-extrabold text-2xl text-white">
                  {currentDistance ?? state.bestDistance}
                </Text>
              </View>
              <View className="flex-1 rounded-2xl bg-white/15 px-3 py-3">
                <Text className="font-nunito-semibold text-xs uppercase tracking-[1px] text-white/80">
                  {t("quests.dailyNumbers.finalResult")}
                </Text>
                <Text className="font-nunito-extrabold text-2xl text-white">
                  {currentBestTile?.value ?? "—"}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View className="rounded-3xl border border-primaryBorder bg-surface p-4">
          <Text className="font-nunito-bold text-base text-fg">
            {t("quests.dailyNumbers.availableNumbers")}
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-3">
            {board.availableTiles.map((tile) => {
              const selected = tile.id === selectedLeftId || tile.id === selectedRightId;
              return (
                <Pressable
                  key={tile.id}
                  onPress={() => handleTilePress(tile.id)}
                  disabled={locked}
                  className={`min-w-[72px] rounded-2xl border px-4 py-4 ${selected ? "border-primaryDark bg-primaryTint" : "border-primaryBorder bg-primaryBg"}`}
                  testID={`daily-numbers-tile-${tile.id}`}
                >
                  <Text
                    className={`text-center font-nunito-extrabold text-2xl ${selected ? "text-primaryStrong" : "text-fg"}`}
                  >
                    {tile.value}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="mt-5 font-nunito-bold text-base text-fg">
            {t("quests.dailyNumbers.usedNumbers")}
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-3">
            {board.usedTiles.length ? (
              board.usedTiles.map((tile) => (
                <View
                  key={tile.id}
                  className="min-w-[64px] rounded-2xl border border-primaryBorder bg-surfaceMuted px-3 py-3 opacity-70"
                >
                  <Text className="text-center font-nunito-bold text-lg text-fgMuted">
                    {tile.value}
                  </Text>
                </View>
              ))
            ) : (
              <Text className="font-nunito text-sm text-fgMuted">
                {t("quests.dailyNumbers.notSubmitted")}
              </Text>
            )}
          </View>
        </View>

        <View className="rounded-3xl border border-primaryBorder bg-surface p-4">
          <Text className="font-nunito-bold text-base text-fg">
            {t("quests.dailyNumbers.operators")}
          </Text>
          <View className="mt-3 flex-row gap-3">
            {OPERATORS.map((operator) => {
              const selected = selectedOperator === operator;
              return (
                <Pressable
                  key={operator}
                  onPress={() => handleOperatorPress(operator)}
                  disabled={locked}
                  className={`flex-1 rounded-2xl border px-4 py-4 ${selected ? "border-accentDark bg-accentTint" : "border-primaryBorder bg-primaryBg"}`}
                  testID={`daily-numbers-operator-${operator === "*" ? "multiply" : operator === "/" ? "divide" : operator === "+" ? "plus" : "minus"}`}
                >
                  <Text
                    className={`text-center font-nunito-extrabold text-2xl ${selected ? "text-accentStrong" : "text-fg"}`}
                  >
                    {operator === "*" ? "×" : operator}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="mt-5 font-nunito-bold text-base text-fg">
            {t("quests.dailyNumbers.selection")}
          </Text>
          <View className="mt-3 flex-row items-center gap-3">
            <View className="flex-1 rounded-2xl border border-primaryBorder bg-primaryBg px-3 py-4">
              <Text className="text-center font-nunito-bold text-base text-fg">
                {selectedLeftTile?.value ?? t("quests.dailyNumbers.pickLeft")}
              </Text>
            </View>
            <View className="w-14 rounded-2xl border border-primaryBorder bg-surfaceMuted px-3 py-4">
              <Text className="text-center font-nunito-extrabold text-xl text-fg">
                {selectedOperator === "*" ? "×" : selectedOperator ?? "?"}
              </Text>
            </View>
            <View className="flex-1 rounded-2xl border border-primaryBorder bg-primaryBg px-3 py-4">
              <Text className="text-center font-nunito-bold text-base text-fg">
                {selectedRightTile?.value ?? t("quests.dailyNumbers.pickRight")}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={applyLocalStep}
            disabled={locked}
            className="mt-4 rounded-2xl bg-accent px-4 py-4"
            testID="daily-numbers-apply-step"
          >
            <Text className="text-center font-nunito-bold text-accentText">
              {t("quests.dailyNumbers.applyStep")}
            </Text>
          </Pressable>

          <View className="mt-4 flex-row gap-3">
            <Pressable
              onPress={undoLastStep}
              disabled={locked}
              className="flex-1 rounded-2xl border border-primaryBorder bg-surfaceMuted px-4 py-3"
              testID="daily-numbers-undo"
            >
              <Text className="text-center font-nunito-bold text-fg">
                {t("quests.dailyNumbers.undo")}
              </Text>
            </Pressable>
            <Pressable
              onPress={resetBoard}
              disabled={locked}
              className="flex-1 rounded-2xl border border-primaryBorder bg-surfaceMuted px-4 py-3"
              testID="daily-numbers-reset"
            >
              <Text className="text-center font-nunito-bold text-fg">
                {t("quests.dailyNumbers.reset")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void submitBoard();
              }}
              disabled={locked}
              className="flex-1 rounded-2xl bg-primary px-4 py-3"
              testID="daily-numbers-submit"
            >
              <Text className="text-center font-nunito-bold text-primaryBg">
                {submitting ? "…" : t("quests.dailyNumbers.submit")}
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="rounded-3xl border border-primaryBorder bg-surface p-4">
          <Text className="font-nunito-bold text-base text-fg">
            {t("quests.dailyNumbers.resultCardTitle")}
          </Text>
          {state.submission ? (
            <View className="mt-3 gap-3">
              <Text
                className={`font-nunito-semibold text-sm ${state.submission.completed ? "text-successText" : "text-dangerText"}`}
              >
                {state.submission.completed
                  ? t("quests.dailyNumbers.completedLabel")
                  : t("quests.dailyNumbers.incompleteLabel")}
              </Text>
              <View className="flex-row gap-3">
                <View className="flex-1 rounded-2xl bg-primaryBg px-3 py-3">
                  <Text className="font-nunito-semibold text-xs uppercase text-fgMuted">
                    {t("quests.dailyNumbers.finalResult")}
                  </Text>
                  <Text className="font-nunito-extrabold text-2xl text-fg">
                    {state.submission.finalValue}
                  </Text>
                </View>
                <View className="flex-1 rounded-2xl bg-primaryBg px-3 py-3">
                  <Text className="font-nunito-semibold text-xs uppercase text-fgMuted">
                    {t("quests.dailyNumbers.distanceLabel")}
                  </Text>
                  <Text className="font-nunito-extrabold text-2xl text-fg">
                    {state.submission.distance}
                  </Text>
                </View>
                <View className="flex-1 rounded-2xl bg-primaryBg px-3 py-3">
                  <Text className="font-nunito-semibold text-xs uppercase text-fgMuted">
                    {t("quests.dailyNumbers.scoreLabel")}
                  </Text>
                  <Text className="font-nunito-extrabold text-2xl text-fg">
                    {state.submission.score}
                  </Text>
                </View>
              </View>
              <Text className="font-nunito text-sm text-fgMuted">
                {state.claimed
                  ? t("quests.dailyNumbers.alreadyClaimed")
                  : t("quests.dailyNumbers.rewardReminder", {
                      reward: state.reward,
                    })}
              </Text>
              <Pressable
                onPress={() => setRevealedSolution((current) => !current)}
                className="rounded-2xl border border-primaryBorder bg-surfaceMuted px-4 py-3"
                testID="daily-numbers-reveal-solution"
              >
                <Text className="text-center font-nunito-bold text-fg">
                  {revealedSolution
                    ? t("quests.dailyNumbers.hideSolution")
                    : t("quests.dailyNumbers.revealSolution")}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Text className="mt-3 font-nunito text-sm text-fgMuted">
              {t("quests.dailyNumbers.notSubmitted")}
            </Text>
          )}
        </View>

        {state.submission && revealedSolution ? (
          <View className="rounded-3xl border border-primaryBorder bg-surface p-4">
            <Text className="font-nunito-bold text-base text-fg">
              {t("quests.dailyNumbers.officialSolutionTitle")}
            </Text>
            <Text className="mt-2 font-nunito text-sm text-fgMuted">
              {t("quests.dailyNumbers.officialSolutionBody")}
            </Text>
            <View className="mt-4 gap-2">
              {state.submission.officialSolutionSteps.map((step) => (
                <View
                  key={`${step.resultId}-${step.leftId}-${step.rightId}`}
                  className="rounded-2xl bg-primaryBg px-3 py-3"
                >
                  <Text className="font-nunito-semibold text-sm text-fg">
                    {t("quests.dailyNumbers.stepSummary", {
                      leftValue: step.leftValue,
                      operator: step.operator === "*" ? "×" : step.operator,
                      rightValue: step.rightValue,
                      resultValue: step.resultValue,
                    })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
