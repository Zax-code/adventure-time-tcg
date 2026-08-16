import { Text, View } from "react-native";

import type { Translate } from "./types";

export function TimerCard({
  timerRunning,
  timerText,
  t,
}: {
  timerRunning: boolean;
  timerText: string;
  t: Translate;
}) {
  return (
    <View className="items-center gap-2 rounded-3xl border-2 border-primaryTint bg-surface px-5 py-8">
      <Text className="font-nunito-bold text-xs uppercase tracking-widest text-fgMuted">
        {t("quests.perfectTiming.timer")}
      </Text>
      <View
        accessibilityElementsHidden={timerRunning}
        importantForAccessibility={timerRunning ? "no-hide-descendants" : "auto"}
      >
        <Text
          className="font-nunito-extrabold text-[48px] leading-[56px] text-fg"
          style={{ fontVariant: ["tabular-nums"] }}
          testID="perfect-timing-timer"
        >
          {timerText}
        </Text>
      </View>
    </View>
  );
}
