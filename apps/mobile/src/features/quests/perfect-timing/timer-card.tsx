import { Text, View } from "react-native";
import Square from "lucide-react-native/icons/square";

import { Card } from "../../../components/ui/card";
import { QuestActionButton } from "../quest-action-button";
import type { Translate } from "./types";

// "While running" Card: the live timer, its hint and the Stop action.
export function TimerCard({
  timerRunning,
  timerText,
  onStop,
  stopTestID,
  t,
}: {
  timerRunning: boolean;
  timerText: string;
  onStop: () => void;
  stopTestID: string;
  t: Translate;
}) {
  return (
    <Card testID="perfect-timing-timer-card">
      <Text
        accessibilityRole="header"
        className="font-nunito-extrabold text-ds-body text-fg"
      >
        {t("quests.perfectTiming.whileRunning")}
      </Text>
      <View className="items-center">
        <View
          accessibilityElementsHidden={timerRunning}
          importantForAccessibility={timerRunning ? "no-hide-descendants" : "auto"}
        >
          <Text
            className="font-nunito-extrabold text-[48px] leading-[53px] text-fg"
            style={{ fontVariant: ["tabular-nums"] }}
            testID="perfect-timing-timer"
          >
            {timerText}
          </Text>
        </View>
        <Text className="text-center font-nunito text-ds-caption text-fgMuted">
          {t("quests.perfectTiming.timerHint")}
        </Text>
      </View>
      <QuestActionButton
        tone="danger"
        size="lg"
        leadingIcon={Square}
        label={t("quests.perfectTiming.stop")}
        onPress={onStop}
        testID={stopTestID}
      />
    </Card>
  );
}
