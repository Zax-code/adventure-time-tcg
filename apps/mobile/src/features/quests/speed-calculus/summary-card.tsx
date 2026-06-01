import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { SpeedRunState } from "@adventure-time/api-client";

import { useTranslation } from "../../../i18n";
import { CoinIcon } from "../../../components/icons";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";
import { withAlpha } from "./palette";

type SummaryCardProps = {
  state: SpeedRunState | null;
  activeRun: SpeedRunState["activeRun"];
  submitting: boolean;
  onStartRun: () => void;
  onResumeRun: () => void;
  onCashOut: () => void;
};

export function SummaryCard({
  state,
  activeRun,
  submitting,
  onStartRun,
  onResumeRun,
  onCashOut,
}: SummaryCardProps) {
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  return (
    <View
      className="rounded-3xl border-2 p-5 gap-3"
      style={{
        borderColor: tc.secondaryBorder,
        backgroundColor: tc.surface,
        shadowColor: withAlpha(tc.secondaryDark, "24"),
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
      }}
    >
      <View className="flex-row justify-between items-center gap-3">
        <View>
          <Text className="text-sm font-nunito-semibold text-primaryDark/70">
            {t("quests.speedCalculusLatestReward")}
          </Text>
          <View className="flex-row items-center gap-2 mt-1">
            <CoinIcon size={22} />
            <Text className="text-2xl font-nunito-extrabold text-secondaryText">
              {state?.rewardPreview ?? 0}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-sm font-nunito-semibold text-primaryDark/70">
            {t("quests.speedCalculusLatestScore")}
          </Text>
          <Text className="text-2xl font-nunito-extrabold text-primaryDark mt-1">
            {state?.latestScore ?? 0}
          </Text>
        </View>
      </View>

      {activeRun?.isManuallyPaused ? (
        <Pressable
          onPress={onResumeRun}
          disabled={submitting}
          className="rounded-2xl overflow-hidden mt-2"
          style={({ pressed }) => ({
            opacity: submitting ? 0.5 : pressed ? 0.9 : 1,
          })}
        >
          <LinearGradient
            colors={[tc.secondary, tc.secondaryDark]}
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
              style={{ color: tc.secondaryText }}
            >
              {submitting ? "..." : t("quests.speedCalculusResume")}
            </Text>
          </LinearGradient>
        </Pressable>
      ) : null}

      {!activeRun && state?.canStartRun && (
        <Pressable
          onPress={onStartRun}
          disabled={submitting}
          className="rounded-2xl overflow-hidden mt-2"
          style={({ pressed }) => ({
            opacity: submitting ? 0.5 : pressed ? 0.9 : 1,
          })}
        >
          <LinearGradient
            colors={[tc.primary, tc.primaryDark]}
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
              style={{ color: tc.primaryBg }}
            >
              {submitting
                ? "..."
                : t("quests.speedCalculusStartRun", {
                    run: (state?.runsUsed ?? 0) + 1,
                  })}
            </Text>
          </LinearGradient>
        </Pressable>
      )}

      {!activeRun && state?.canCashOut && (
        <Pressable
          onPress={onCashOut}
          disabled={submitting}
          className="rounded-2xl overflow-hidden"
          style={({ pressed }) => ({
            opacity: submitting ? 0.5 : pressed ? 0.9 : 1,
          })}
        >
          <LinearGradient
            colors={[tc.success, tc.successDark]}
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
              style={{ color: tc.successText }}
            >
              {submitting
                ? "..."
                : t("quests.speedCalculusCashOut", {
                    reward: state?.rewardPreview ?? 0,
                  })}
            </Text>
          </LinearGradient>
        </Pressable>
      )}

      {state?.locked && (
        <View className="rounded-2xl border border-successBorder bg-successTint p-4 mt-2">
          <Text className="font-nunito-bold text-successText text-sm">
            {state.claimed
              ? t("quests.speedCalculusClaimed")
              : t("quests.speedCalculusLocked", {
                  reward: state.rewardPreview,
                })}
          </Text>
          {!state.claimed && (
            <Text className="font-nunito text-successText text-[13px] mt-1">
              {t("quests.speedCalculusClaimReminder")}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
