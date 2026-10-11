import { ActivityIndicator, Text, View } from "react-native";
import Play from "lucide-react-native/icons/play";

import type { Locale } from "../../../i18n/types";
import { QuestActionButton } from "../quest-action-button";
import type { PerfectTimingLocalResult } from "./model";
import { ResultCard } from "./result-card";
import { TargetCard } from "./target-card";
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
  targetLabel,
  targetMs,
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
  targetLabel: string;
  targetMs: number | null;
  tc: ThemeColors;
  timerRunning: boolean;
  timerText: string;
}) {
  const canStart =
    !timerRunning && phase === "ready" && !isLoading && !isRefreshing;

  return (
    <View className="gap-ds-3">
      {targetMs != null ? (
        <TargetCard label={targetLabel} targetMs={targetMs} locale={locale}>
          {canStart ? (
            <QuestActionButton
              tone="primary"
              size="lg"
              leadingIcon={Play}
              label={t("quests.perfectTiming.start")}
              onPress={onStart}
              testID="perfect-timing-training-start"
            />
          ) : null}
        </TargetCard>
      ) : null}

      {timerRunning ? (
        <TimerCard
          timerRunning
          timerText={timerText}
          onStop={onStop}
          stopTestID="perfect-timing-training-stop"
          t={t}
        />
      ) : null}

      <Text className="rounded-ds-md border border-infoBorder bg-infoTint p-4 font-nunito text-sm leading-5 text-infoText">
        {t("quests.perfectTiming.trainingBody")}
      </Text>

      {isLoading ? <ActivityIndicator color={tc.primaryDark} /> : null}

      {hasError ? (
        <View className="gap-3 rounded-ds-md border border-dangerBorder bg-dangerTint p-4">
          <Text
            accessibilityRole="alert"
            className="text-center font-nunito-bold text-sm text-dangerDark"
          >
            {t("quests.perfectTiming.trainingTargetError")}
          </Text>
          <QuestActionButton
            tone="danger"
            label={t("common.tryAgain")}
            onPress={onNewTarget}
            loading={isRefreshing}
            testID="perfect-timing-training-target-retry"
          />
        </View>
      ) : null}

      {phase !== "result" && !isLoading && !hasError ? (
        <QuestActionButton
          tone="ghost"
          size="lg"
          label={t("quests.perfectTiming.newTarget")}
          onPress={onNewTarget}
          loading={isRefreshing}
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
                tone="primary"
                size="lg"
                label={t("quests.perfectTiming.retry")}
                onPress={onRetry}
                testID="perfect-timing-training-retry"
              />
            </View>
            <View className="flex-1">
              <QuestActionButton
                tone="ghost"
                size="lg"
                label={t("quests.perfectTiming.newTarget")}
                onPress={onNewTarget}
                loading={isRefreshing}
                testID="perfect-timing-training-new-target"
              />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}
