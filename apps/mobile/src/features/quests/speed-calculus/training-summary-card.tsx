import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { SpeedRunState } from "@adventure-time/api-client";

import { useTranslation } from "../../../i18n";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";
import { withAlpha } from "./palette";

type TrainingSummaryCardProps = {
  activeRun: NonNullable<SpeedRunState["activeRun"]> | null;
  submitting: boolean;
  lastRunScore: number | null;
  onStartRun: () => void;
  onResumeRun: () => void;
};

export function TrainingSummaryCard({
  activeRun,
  submitting,
  lastRunScore,
  onStartRun,
  onResumeRun,
}: TrainingSummaryCardProps) {
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];

  return (
    <View
      className="rounded-3xl border-2 p-5 gap-4"
      style={{
        borderColor: tc.secondaryBorder,
        backgroundColor: tc.surface,
        boxShadow: `0px 4px 12px ${withAlpha(tc.secondaryDark, "24")}`,
      }}
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="text-xs font-nunito-bold uppercase tracking-[3.5px] text-secondaryText/80">
            {t("quests.speedCalculusTrainingTitle")}
          </Text>
          <Text className="mt-2 text-sm font-nunito leading-5 text-primaryDark/80">
            {t("quests.speedCalculusTrainingScreenSubtitle")}
          </Text>
        </View>
        <View
          className="items-end rounded-2xl px-4 py-3"
          style={{ backgroundColor: tc.secondaryTint }}
        >
          <Text className="text-xs font-nunito-semibold text-primaryDark/70">
            {t("quests.speedCalculusLatestScore")}
          </Text>
          <Text className="mt-1 text-2xl font-nunito-extrabold text-primaryDark">
            {lastRunScore ?? "\u2014"}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={activeRun?.isManuallyPaused ? onResumeRun : onStartRun}
        disabled={submitting}
        className="rounded-2xl overflow-hidden"
        style={({ pressed }) => ({
          opacity: submitting ? 0.5 : pressed ? 0.9 : 1,
        })}
      >
        <LinearGradient
          colors={
            activeRun?.isManuallyPaused
              ? [tc.secondary, tc.secondaryDark]
              : [tc.success, tc.successDark]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            paddingVertical: 14,
            alignItems: "center",
            borderRadius: 16,
          }}
        >
          <Text
            className="font-nunito-bold text-[15px]"
            style={{
              color: activeRun?.isManuallyPaused
                ? tc.secondaryText
                : tc.successText,
            }}
          >
            {submitting
              ? "..."
              : activeRun?.isManuallyPaused
                ? t("quests.speedCalculusTrainingResume")
                : t("quests.speedCalculusTrainingStart")}
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
