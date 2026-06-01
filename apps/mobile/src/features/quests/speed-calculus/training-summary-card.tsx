import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { SpeedRunState } from "@adventure-time/api-client";

import { useTranslation } from "../../../i18n";

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

  return (
    <View
      className="rounded-3xl border-2 border-secondary/30 bg-white/90 p-5 gap-4"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
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
        <View className="items-end rounded-2xl bg-secondary/10 px-4 py-3">
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
        style={({ pressed }) => ({ opacity: submitting ? 0.5 : pressed ? 0.9 : 1 })}
      >
        <LinearGradient
          colors={activeRun?.isManuallyPaused ? ["#F59E0B", "#EF4444"] : ["#0F766E", "#14B8A6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ paddingVertical: 14, alignItems: "center", borderRadius: 16 }}
        >
          <Text className="font-nunito-bold text-[15px] text-white">
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
