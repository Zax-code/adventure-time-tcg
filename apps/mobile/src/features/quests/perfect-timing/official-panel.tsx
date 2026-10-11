import { Text, View } from "react-native";
import Play from "lucide-react-native/icons/play";

import type {
  PerfectTimingAttempt,
  PerfectTimingState,
} from "@adventure-time/api-client";

import { StatTile } from "../../../components/ui/stat-tile";
import type { Locale } from "../../../i18n/types";
import { QuestActionButton } from "../quest-action-button";
import { formatPerfectTimingMilliseconds } from "./model";
import { ResultCard } from "./result-card";
import { TargetCard } from "./target-card";
import { TimerCard } from "./timer-card";
import type { Translate } from "./types";

// Elapsed time of today's closest stopped attempt, or a dash before any.
function bestTodayLabel(state: PerfectTimingState, locale: Locale) {
  let best: PerfectTimingAttempt | null = null;
  for (const attempt of state.attempts) {
    if (attempt.deviationMs == null || attempt.elapsedMs == null) continue;
    if (best == null || attempt.deviationMs < (best.deviationMs ?? Infinity)) {
      best = attempt;
    }
  }
  return best?.elapsedMs != null
    ? formatPerfectTimingMilliseconds(best.elapsedMs, locale)
    : "\u2014";
}

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
  targetLabel,
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
  targetLabel: string;
  timerRunning: boolean;
  timerText: string;
}) {
  const canStart = !timerRunning && state.status === "ready" && !stopError;
  const showKeep =
    state.status === "result" && result?.tier != null && result.tier !== "miss";

  return (
    <View className="gap-ds-3">
      <TargetCard label={targetLabel} targetMs={state.targetMs} locale={locale}>
        <View className="flex-row gap-ds-2">
          <StatTile
            className="flex-1"
            label={t("quests.perfectTiming.attemptsRemaining")}
            value={`${state.remainingAttempts} / ${state.maxAttempts}`}
            testID="perfect-timing-attempts-remaining"
          />
          <StatTile
            className="flex-1"
            label={t("quests.perfectTiming.bestToday")}
            value={bestTodayLabel(state, locale)}
            testID="perfect-timing-best-today"
          />
        </View>
        {canStart ? (
          <QuestActionButton
            tone="primary"
            size="lg"
            leadingIcon={Play}
            label={t("quests.perfectTiming.start")}
            onPress={onStart}
            loading={startPending}
            testID="perfect-timing-start"
          />
        ) : null}
        {canStart && startError ? (
          <Text
            accessibilityRole="alert"
            className="text-center font-nunito-bold text-ds-sm text-dangerText"
          >
            {t("quests.perfectTiming.startError")}
          </Text>
        ) : null}
      </TargetCard>

      {timerRunning ? (
        <TimerCard
          timerRunning
          timerText={timerText}
          onStop={onStop}
          stopTestID="perfect-timing-stop"
          t={t}
        />
      ) : null}

      {stopError ? (
        <View className="gap-3 rounded-ds-md border border-dangerBorder bg-dangerTint p-4">
          <Text className="font-nunito-bold text-sm leading-5 text-dangerDark">
            {t("quests.perfectTiming.stopError")}
          </Text>
          <QuestActionButton
            tone="danger"
            label={t("quests.perfectTiming.retrySave")}
            onPress={onRetrySave}
            testID="perfect-timing-retry-save"
          />
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
              tone="secondary"
              size="lg"
              label={t("quests.perfectTiming.keepResult")}
              onPress={onKeep}
              loading={keepPending}
              testID="perfect-timing-keep"
            />
          ) : null}
          <QuestActionButton
            tone="primary"
            size="lg"
            label={t("quests.perfectTiming.continue")}
            onPress={onContinue}
            loading={continuePending}
            testID="perfect-timing-continue"
          />
        </View>
      ) : null}

      {state.finalized ? (
        <QuestActionButton
          tone="ghost"
          size="lg"
          label={
            isSharing
              ? t("quests.perfectTiming.sharePreparing")
              : t("quests.perfectTiming.shareResult")
          }
          onPress={onShare}
          loading={isSharing}
          loadingMode="inline"
          testID="perfect-timing-share"
        />
      ) : null}
    </View>
  );
}
