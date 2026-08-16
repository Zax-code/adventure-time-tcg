import { Text, View } from "react-native";

import type {
  PerfectTimingAttempt,
  PerfectTimingState,
} from "@adventure-time/api-client";

import type { Locale } from "../../../i18n/types";
import { QuestActionButton } from "../quest-action-button";
import { ResultCard } from "./result-card";
import { TimerCard } from "./timer-card";
import type { ThemeColors, Translate } from "./types";

export function OfficialPanel({
  continuePending,
  decisionError,
  isSharing,
  keepPending,
  locale,
  onContinue,
  onKeep,
  onRetrySave,
  onShare,
  onStart,
  onStop,
  result,
  startError,
  startPending,
  state,
  stopError,
  t,
  tc,
  timerRunning,
  timerText,
}: {
  continuePending: boolean;
  decisionError: boolean;
  isSharing: boolean;
  keepPending: boolean;
  locale: Locale;
  onContinue: () => void;
  onKeep: () => void;
  onRetrySave: () => void;
  onShare: () => void;
  onStart: () => void;
  onStop: () => void;
  result: PerfectTimingAttempt | null;
  startError: boolean;
  startPending: boolean;
  state: PerfectTimingState;
  stopError: boolean;
  t: Translate;
  tc: ThemeColors;
  timerRunning: boolean;
  timerText: string;
}) {
  const showKeep =
    state.status === "result" && result?.tier != null && result.tier !== "miss";

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between px-1">
        <Text className="font-nunito-bold text-sm text-fgMuted">
          {t("quests.perfectTiming.attemptsRemaining")}
        </Text>
        <Text className="font-nunito-extrabold text-sm text-fg">
          {state.remainingAttempts} / {state.maxAttempts}
        </Text>
      </View>

      {timerRunning ? (
        <>
          <TimerCard timerRunning timerText={timerText} t={t} />
          <QuestActionButton
            label={t("quests.perfectTiming.stop")}
            onPress={onStop}
            backgroundColor={tc.dangerDark}
            minHeight={56}
            testID="perfect-timing-stop"
          />
        </>
      ) : null}

      {stopError ? (
        <View className="gap-3 rounded-2xl border border-dangerBorder bg-dangerTint p-4">
          <Text className="font-nunito-bold text-sm leading-5 text-dangerDark">
            {t("quests.perfectTiming.stopError")}
          </Text>
          <QuestActionButton
            label={t("quests.perfectTiming.retrySave")}
            onPress={onRetrySave}
            backgroundColor={tc.dangerDark}
            testID="perfect-timing-retry-save"
          />
        </View>
      ) : null}

      {!timerRunning && state.status === "ready" && !stopError ? (
        <View className="gap-3">
          <QuestActionButton
            label={t("quests.perfectTiming.start")}
            onPress={onStart}
            loading={startPending}
            backgroundColor={tc.primary}
            minHeight={56}
            testID="perfect-timing-start"
          />
          {startError ? (
            <Text
              accessibilityRole="alert"
              className="text-center font-nunito-bold text-sm text-dangerDark"
            >
              {t("quests.perfectTiming.startError")}
            </Text>
          ) : null}
        </View>
      ) : null}

      {!timerRunning && result && (state.status === "result" || state.finalized) ? (
        <ResultCard
          elapsedMs={result.elapsedMs ?? 0}
          final={state.finalized}
          locale={locale}
          result={{
            deviationMs: result.deviationMs ?? 0,
            direction: result.direction ?? "exact",
            tier: result.tier ?? "miss",
            reward: result.reward,
          }}
          rewardGranted={state.rewardGranted}
          t={t}
        />
      ) : null}

      {decisionError ? (
        <Text
          accessibilityRole="alert"
          className="text-center font-nunito-bold text-sm text-dangerDark"
        >
          {t("quests.perfectTiming.decisionError")}
        </Text>
      ) : null}

      {!timerRunning && state.status === "result" ? (
        <View className="gap-3">
          {showKeep ? (
            <QuestActionButton
              label={t("quests.perfectTiming.keepResult")}
              onPress={onKeep}
              loading={keepPending}
              backgroundColor={tc.successDark}
              minHeight={52}
              testID="perfect-timing-keep"
            />
          ) : null}
          <QuestActionButton
            label={t("quests.perfectTiming.continue")}
            onPress={onContinue}
            loading={continuePending}
            backgroundColor={tc.primary}
            minHeight={52}
            testID="perfect-timing-continue"
          />
        </View>
      ) : null}

      {state.finalized ? (
        <QuestActionButton
          label={
            isSharing
              ? t("quests.perfectTiming.sharePreparing")
              : t("quests.perfectTiming.shareResult")
          }
          onPress={onShare}
          loading={isSharing}
          loadingMode="inline"
          backgroundColor={tc.surface}
          foregroundColor={tc.primaryDark}
          borderColor={tc.primaryBorder}
          minHeight={50}
          testID="perfect-timing-share"
        />
      ) : null}
    </View>
  );
}
