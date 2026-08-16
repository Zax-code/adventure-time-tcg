import { Text, View } from "react-native";

import type { PerfectTimingTier } from "@adventure-time/api-client";

import { CoinIcon } from "../../../components/icons";
import type { Locale } from "../../../i18n/types";
import {
  formatPerfectTimingMilliseconds,
  type PerfectTimingLocalResult,
} from "./model";
import { ResultMetric } from "./result-metric";
import type { Translate } from "./types";

function tierLabel(t: Translate, tier: PerfectTimingTier) {
  return t(`quests.perfectTiming.tiers.${tier}`);
}

function directionLabel(
  t: Translate,
  direction: "early" | "late" | "exact",
) {
  if (direction === "early") return t("quests.perfectTiming.tooEarly");
  if (direction === "late") return t("quests.perfectTiming.tooLate");
  return t("quests.perfectTiming.exact");
}

export function ResultCard({
  elapsedMs,
  final,
  locale,
  result,
  rewardGranted,
  training = false,
  t,
}: {
  elapsedMs: number;
  final: boolean;
  locale: Locale;
  result: PerfectTimingLocalResult;
  rewardGranted: boolean;
  training?: boolean;
  t: Translate;
}) {
  const successful = result.tier !== "miss";
  return (
    <View
      className={`gap-4 rounded-3xl border-2 p-5 ${
        successful
          ? "border-successBorder bg-successTint"
          : "border-dangerBorder bg-dangerTint"
      }`}
      testID="perfect-timing-result"
    >
      <Text
        accessibilityRole="header"
        className={`text-center font-nunito-extrabold text-xl ${
          successful ? "text-successText" : "text-dangerText"
        }`}
      >
        {final
          ? t("quests.perfectTiming.finalResultTitle")
          : t("quests.perfectTiming.resultTitle")}
      </Text>

      <View className="flex-row gap-3">
        <ResultMetric
          label={t("quests.perfectTiming.achievedTime")}
          value={formatPerfectTimingMilliseconds(elapsedMs, locale)}
        />
        <ResultMetric
          label={t("quests.perfectTiming.deviation")}
          value={formatPerfectTimingMilliseconds(result.deviationMs, locale)}
        />
      </View>

      <Text className="text-center font-nunito-bold text-sm text-fg">
        {directionLabel(t, result.direction)}
      </Text>
      <Text className="text-center font-nunito-extrabold text-2xl text-fg">
        {tierLabel(t, result.tier)}
      </Text>

      <View className="flex-row items-center justify-center gap-2">
        <CoinIcon size={22} />
        <Text className="font-nunito-extrabold text-lg text-fg">
          {training ? "0" : result.reward}
        </Text>
      </View>

      <Text className="text-center font-nunito-bold text-sm leading-5 text-fgMuted">
        {training || result.tier === "miss"
          ? t("quests.perfectTiming.noReward")
          : rewardGranted
            ? t("quests.perfectTiming.rewardGranted", { amount: result.reward })
            : t("quests.perfectTiming.rewardPreview", { amount: result.reward })}
      </Text>

      {final ? (
        <Text className="text-center font-nunito-extrabold text-sm text-fg">
          {successful
            ? t("quests.perfectTiming.finalSuccess")
            : t("quests.perfectTiming.finalFailure")}
        </Text>
      ) : null}
    </View>
  );
}
