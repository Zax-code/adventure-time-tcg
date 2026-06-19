import { useQueries } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { DailyNumbersMode, DailyNumbersStateResponse } from "@adventure-time/api-client";

import { PageErrorState } from "../../src/components/error-state";
import { PageLoadingState } from "../../src/components/loading-state";
import {
  DAILY_NUMBERS_MODES,
  getModeAccent,
  getModeStatusLabel,
} from "../../src/features/quests/daily-numbers/shared";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";
import { useThemeStore } from "../../src/stores/theme-store";
import { THEME_COLORS } from "../../src/theme/themes";

export default function DailyNumbersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];

  const initialMode = params.mode === "expert" ? "expert" : "classic";
  const [activeMode, setActiveMode] = useState<DailyNumbersMode>(initialMode);
  const [revealedSolution, setRevealedSolution] = useState(false);

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

  useEffect(() => {
    if (params.mode === "classic" || params.mode === "expert") {
      setActiveMode(params.mode);
    }
  }, [params.mode]);

  useEffect(() => {
    setRevealedSolution(false);
  }, [activeMode]);

  const summaryText = useMemo(() => {
    if (!state?.submission) {
      return t(
        activeMode === "classic"
          ? "quests.daily_numbers_classic_desc"
          : "quests.daily_numbers_expert_desc",
      );
    }

    if (state.submission.distance === 0) {
      return t("quests.dailyNumbersQuestCardExact", {
        score: state.submission.score,
      });
    }

    return t("quests.dailyNumbersQuestCardMeta", {
      value: state.submission.finalValue,
      distance: state.submission.distance,
      score: state.submission.score,
    });
  }, [activeMode, state?.submission, t]);

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
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
        gap: 16,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ height: insets.top + 16 }} />

      <View className="items-center gap-2">
        <View className="items-center gap-2">
          <Text className="text-center font-nunito-extrabold text-[30px] text-primaryDark">
            {t("quests.dailyNumbers.title")}
          </Text>
          <Text className="max-w-[360px] text-center font-nunito text-sm text-primaryStrong">
            {t("quests.dailyNumbers.subtitle")}
          </Text>
        </View>

        <Pressable
          onPress={() => router.back()}
          className="w-full rounded-xl overflow-hidden"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <View className="items-center rounded-xl bg-primary py-2">
            <Text className="font-nunito-semibold text-sm text-primaryBg">
              {t("quests.dailyNumbers.backToQuests")}
            </Text>
          </View>
        </Pressable>
      </View>

      <View className="rounded-[28px] border border-primaryBorder bg-surface p-4">
        <Text className="font-nunito-bold text-base text-fg">
          {t("quests.dailyNumbers.chooseLevel")}
        </Text>
        <View className="mt-3 flex-row gap-3">
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
                onPress={() => setActiveMode(mode)}
                className="flex-1"
                testID={`daily-numbers-mode-${mode}`}
              >
                <View
                  className="rounded-[24px] border p-4"
                  style={{
                    borderColor: selected ? accent.text : tc.primaryBorder,
                    backgroundColor: selected ? accent.bg : tc.surfaceMuted,
                  }}
                >
                  <View className="gap-2">
                    <View className="flex-row items-start justify-between gap-2">
                      <Text className="font-nunito-extrabold text-lg text-fg">
                        {t(
                          mode === "classic"
                            ? "quests.dailyNumbers.classic"
                            : "quests.dailyNumbers.expert",
                        )}
                      </Text>
                      <View
                        className="rounded-full px-2 py-1"
                        style={{
                          backgroundColor: selected ? accent.tint : tc.surface,
                        }}
                      >
                        <Text
                          className="font-nunito-bold text-[11px]"
                          style={{ color: accent.text }}
                        >
                          {statusLabel}
                        </Text>
                      </View>
                    </View>

                    <Text className="font-nunito text-xs text-fgMuted">
                      {t(
                        mode === "classic"
                          ? "quests.dailyNumbers.classicMix"
                          : "quests.dailyNumbers.expertMix",
                      )}
                    </Text>

                    <View className="flex-row items-center justify-between">
                      <Text className="font-nunito-semibold text-xs uppercase tracking-[1px] text-fgMuted">
                        {t("quests.dailyNumbers.reward")}
                      </Text>
                      <Text className="font-nunito-extrabold text-base text-secondaryDark">
                        {modeState?.reward ?? "—"}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="rounded-[28px] border border-primaryBorder bg-surface p-4">
        <Text className="font-nunito-bold text-base text-fg">
          {t("quests.dailyNumbers.howToPlayTitle")}
        </Text>
        <View className="mt-3 gap-2">
          {[1, 2, 3].map((step) => {
            const stepKey =
              step === 1
                ? "quests.dailyNumbers.howToPlayStepOne"
                : step === 2
                  ? "quests.dailyNumbers.howToPlayStepTwo"
                  : "quests.dailyNumbers.howToPlayStepThree";

            return (
              <View
                key={step}
                className="flex-row items-center gap-3 rounded-2xl bg-primaryBg px-3 py-2.5"
              >
                <View className="h-8 w-8 items-center justify-center rounded-full bg-primaryTint">
                  <Text className="font-nunito-extrabold text-primaryStrong">
                    {step}
                  </Text>
                </View>
                <Text className="flex-1 font-nunito-semibold text-sm text-fg">
                  {t(stepKey)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View
        className="rounded-[28px] border bg-surface p-4"
        style={{ borderColor: modeAccent.border }}
      >
        <View className="flex-row flex-wrap gap-3">
          <View
            className="min-w-[132px] flex-1 rounded-2xl px-3 py-3"
            style={{ backgroundColor: modeAccent.bg }}
          >
            <Text className="font-nunito-semibold text-[11px] uppercase tracking-[1px] text-fgMuted">
              {t("quests.dailyNumbers.currentMode")}
            </Text>
            <Text className="font-nunito-extrabold text-[28px] text-fg">
              {t(
                activeMode === "classic"
                  ? "quests.dailyNumbers.classic"
                  : "quests.dailyNumbers.expert",
              )}
            </Text>
          </View>

          <View className="min-w-[132px] flex-1 rounded-2xl bg-primaryBg px-3 py-3">
            <Text className="font-nunito-semibold text-[11px] uppercase tracking-[1px] text-fgMuted">
              {t("quests.dailyNumbers.target")}
            </Text>
            <Text className="font-nunito-extrabold text-[28px] text-fg">
              {state.target}
            </Text>
          </View>
        </View>

        <Text className="mt-4 font-nunito-bold text-sm text-fg">
          {summaryText}
        </Text>

        <Pressable
          onPress={() =>
            router.push(`/quests/daily-numbers-play?mode=${activeMode}` as never)
          }
          className="mt-4 rounded-2xl px-4 py-4"
          style={{ backgroundColor: modeAccent.text }}
        >
          <Text className="text-center font-nunito-bold text-sm text-white">
            {t("quests.dailyNumbers.openGame")}
          </Text>
        </Pressable>
      </View>

      <View className="rounded-[28px] border border-primaryBorder bg-surface p-4">
        <Text className="font-nunito-bold text-base text-fg">
          {t("quests.dailyNumbers.resultCardTitle")}
        </Text>
        {state.submission ? (
          <View className="mt-3 gap-3">
            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[96px] flex-1 rounded-2xl bg-primaryBg px-3 py-3">
                <Text className="font-nunito-semibold text-xs uppercase text-fgMuted">
                  {t("quests.dailyNumbers.finalResult")}
                </Text>
                <Text className="font-nunito-extrabold text-2xl text-fg">
                  {state.submission.finalValue}
                </Text>
              </View>
              <View className="min-w-[96px] flex-1 rounded-2xl bg-primaryBg px-3 py-3">
                <Text className="font-nunito-semibold text-xs uppercase text-fgMuted">
                  {t("quests.dailyNumbers.distanceLabel")}
                </Text>
                <Text className="font-nunito-extrabold text-2xl text-fg">
                  {state.submission.distance}
                </Text>
              </View>
              <View className="min-w-[96px] flex-1 rounded-2xl bg-primaryBg px-3 py-3">
                <Text className="font-nunito-semibold text-xs uppercase text-fgMuted">
                  {t("quests.dailyNumbers.scoreLabel")}
                </Text>
                <Text className="font-nunito-extrabold text-2xl text-fg">
                  {state.submission.score}
                </Text>
              </View>
            </View>

            <Text
              className={`font-nunito-semibold text-sm ${state.submission.completed ? "text-successText" : "text-dangerText"}`}
            >
              {state.submission.completed
                ? t("quests.dailyNumbers.completedLabel")
                : t("quests.dailyNumbers.incompleteLabel")}
            </Text>

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
        <View className="rounded-[28px] border border-primaryBorder bg-surface p-4">
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
  );
}
