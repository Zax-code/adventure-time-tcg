import { ActivityIndicator, Text, View } from "react-native";

import type { Locale } from "../../../i18n/types";
import { QuestActionButton } from "../quest-action-button";
import type { PerfectTimingLocalResult } from "./model";
import { ResultCard } from "./result-card";
import { TimerCard } from "./timer-card";
import type { ThemeColors, TrainingPhase, Translate } from "./types";

export function TrainingPanel({
  elapsedMs,
  hasError,
  isLoading,
  isRefreshing,
  locale,
  onNewTarget,
  onRetry,
  onStart,
  onStop,
  phase,
  result,
  t,
  tc,
  timerRunning,
  timerText,
}: {
  elapsedMs: number | null;
  hasError: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  locale: Locale;
  onNewTarget: () => void;
  onRetry: () => void;
  onStart: () => void;
  onStop: () => void;
  phase: TrainingPhase;
  result: PerfectTimingLocalResult | null;
  t: Translate;
  tc: ThemeColors;
  timerRunning: boolean;
  timerText: string;
}) {
  return (
    <View className="gap-4">
      <Text className="rounded-2xl border border-infoBorder bg-infoTint p-4 font-nunito text-sm leading-5 text-infoText">
        {t("quests.perfectTiming.trainingBody")}
      </Text>

      {isLoading ? <ActivityIndicator color={tc.primaryDark} /> : null}

      {hasError ? (
        <View className="gap-3 rounded-2xl border border-dangerBorder bg-dangerTint p-4">
          <Text
            accessibilityRole="alert"
            className="text-center font-nunito-bold text-sm text-dangerDark"
          >
            {t("quests.perfectTiming.trainingTargetError")}
          </Text>
          <QuestActionButton
            label={t("common.tryAgain")}
            onPress={onNewTarget}
            loading={isRefreshing}
            backgroundColor={tc.dangerDark}
            testID="perfect-timing-training-target-retry"
          />
        </View>
      ) : null}

      {timerRunning ? (
        <>
          <TimerCard timerRunning timerText={timerText} t={t} />
          <QuestActionButton
            label={t("quests.perfectTiming.stop")}
            onPress={onStop}
            backgroundColor={tc.dangerDark}
            minHeight={56}
            testID="perfect-timing-training-stop"
          />
        </>
      ) : null}

      {!timerRunning && phase === "ready" && !isLoading && !isRefreshing ? (
        <QuestActionButton
          label={t("quests.perfectTiming.start")}
          onPress={onStart}
          backgroundColor={tc.primary}
          minHeight={56}
          testID="perfect-timing-training-start"
        />
      ) : null}

      {phase !== "result" && !isLoading && !hasError ? (
        <QuestActionButton
          label={t("quests.perfectTiming.newTarget")}
          onPress={onNewTarget}
          loading={isRefreshing}
          backgroundColor={tc.surface}
          foregroundColor={tc.primaryDark}
          borderColor={tc.primaryBorder}
          minHeight={50}
          testID="perfect-timing-training-new-target"
        />
      ) : null}

      {!timerRunning && phase === "result" && result && elapsedMs != null ? (
        <>
          <ResultCard
            elapsedMs={elapsedMs}
            final={false}
            locale={locale}
            result={result}
            rewardGranted={false}
            training
            t={t}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <QuestActionButton
                label={t("quests.perfectTiming.retry")}
                onPress={onRetry}
                backgroundColor={tc.primary}
                minHeight={50}
                testID="perfect-timing-training-retry"
              />
            </View>
            <View className="flex-1">
              <QuestActionButton
                label={t("quests.perfectTiming.newTarget")}
                onPress={onNewTarget}
                loading={isRefreshing}
                backgroundColor={tc.surface}
                foregroundColor={tc.primaryDark}
                borderColor={tc.primaryBorder}
                minHeight={50}
                testID="perfect-timing-training-new-target"
              />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}
