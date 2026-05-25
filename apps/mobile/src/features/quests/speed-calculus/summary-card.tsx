import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { SpeedRunState } from "@adventure-time/shared";

import { useTranslation } from "../../../i18n";
import { CoinIcon } from "../../../components/icons";

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
  return (
    <View
      className="rounded-3xl border-2 p-5 gap-3 border-secondary/30 bg-white/90"
      style={{
        shadowColor: "#000",
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
          style={({ pressed }) => ({ opacity: submitting ? 0.5 : pressed ? 0.9 : 1 })}
        >
          <LinearGradient
            colors={["#F59E0B", "#EF4444"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 14, alignItems: "center", borderRadius: 16 }}
          >
            <Text className="font-nunito-bold text-white text-[15px]">
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
          style={({ pressed }) => ({ opacity: submitting ? 0.5 : pressed ? 0.9 : 1 })}
        >
          <LinearGradient
            colors={["#F472B6", "#EC4899"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 14, alignItems: "center", borderRadius: 16 }}
          >
            <Text className="font-nunito-bold text-white text-[15px]">
              {submitting ? "..." : t("quests.speedCalculusStartRun", { run: (state?.runsUsed ?? 0) + 1 })}
            </Text>
          </LinearGradient>
        </Pressable>
      )}

      {!activeRun && state?.canCashOut && (
        <Pressable
          onPress={onCashOut}
          disabled={submitting}
          className="rounded-2xl overflow-hidden"
          style={({ pressed }) => ({ opacity: submitting ? 0.5 : pressed ? 0.9 : 1 })}
        >
          <LinearGradient
            colors={["#2DD4BF", "#14B8A6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 14, alignItems: "center", borderRadius: 16 }}
          >
            <Text className="font-nunito-bold text-white text-[15px]">
              {submitting ? "..." : t("quests.speedCalculusCashOut", { reward: state?.rewardPreview ?? 0 })}
            </Text>
          </LinearGradient>
        </Pressable>
      )}

      {state?.locked && (
        <View className="rounded-2xl border border-successBorder bg-successTint p-4 mt-2">
          <Text className="font-nunito-bold text-successText text-sm">
            {state.claimed
              ? t("quests.speedCalculusClaimed")
              : t("quests.speedCalculusLocked", { reward: state.rewardPreview })}
          </Text>
          {!state.claimed && (
            <Text className="font-nunito text-successText text-[13px] mt-1 opacity-80">
              {t("quests.speedCalculusClaimReminder")}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
