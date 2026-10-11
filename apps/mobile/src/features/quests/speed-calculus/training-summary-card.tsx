import { Text, useWindowDimensions, View } from "react-native";
import type { SpeedRunState } from "@adventure-time/api-client";

import { Button } from "../../../components/ui/button";
import { useTranslation } from "../../../i18n";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";

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
  const { fontScale } = useWindowDimensions();
  const stackMetadata = fontScale >= 1.6;

  return (
    <View
      className="rounded-ds-lg border p-ds-4 gap-4"
      style={{
        borderColor: tc.secondaryBorder,
        backgroundColor: tc.surface,
      }}
    >
      <View
        className={
          stackMetadata
            ? "items-stretch gap-3"
            : "flex-row items-center justify-between gap-3"
        }
      >
        <View className="min-w-0 flex-1">
          <Text className="text-ds-overline font-nunito-bold uppercase tracking-[1px] text-secondaryText/80">
            {t("quests.speedCalculusTrainingTitle")}
          </Text>
          <Text className="mt-2 text-sm font-nunito leading-5 text-primaryDark/80">
            {t("quests.speedCalculusTrainingScreenSubtitle")}
          </Text>
        </View>
        <View
          className={`${stackMetadata ? "items-start self-stretch" : "items-end"} rounded-ds-md px-4 py-3`}
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

      <Button
        size="lg"
        onPress={activeRun?.isManuallyPaused ? onResumeRun : onStartRun}
        disabled={submitting}
      >
        {submitting
          ? "..."
          : activeRun?.isManuallyPaused
            ? t("quests.speedCalculusTrainingResume")
            : t("quests.speedCalculusTrainingStart")}
      </Button>
    </View>
  );
}
