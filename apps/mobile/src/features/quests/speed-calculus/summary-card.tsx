import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { SpeedRunState } from "@adventure-time/api-client";

import { useTranslation } from "../../../i18n";
import { CoinIcon, ShareIcon } from "../../../components/icons";
import { QuestActionButton } from "../quest-action-button";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";
import { withAlpha } from "./palette";

type SummaryCardProps = {
  state: SpeedRunState | null;
  activeRun: SpeedRunState["activeRun"];
  submitting: boolean;
  claiming: boolean;
  onStartRun: () => void;
  onResumeRun: () => void;
  onCashOut: () => void;
  onClaim: () => void;
  onShare: () => void;
  sharing: boolean;
};

export function SummaryCard({
  state,
  activeRun,
  submitting,
  claiming,
  onStartRun,
  onResumeRun,
  onCashOut,
  onClaim,
  onShare,
  sharing,
}: SummaryCardProps) {
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  const { fontScale } = useWindowDimensions();
  const stackMetadata = fontScale >= 1.6;
  return (
    <View
      className="rounded-3xl border-2 p-5 gap-3"
      style={{
        borderColor: tc.secondaryBorder,
        backgroundColor: tc.surface,
        boxShadow: `0px 4px 12px ${withAlpha(tc.secondaryDark, "24")}`,
      }}
    >
      <View
        className={
          stackMetadata
            ? "items-stretch gap-3"
            : "flex-row items-center justify-between gap-3"
        }
      >
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
        <View className={stackMetadata ? "items-start" : "items-end"}>
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

      {!activeRun && (state?.history.length ?? 0) > 0 ? (
        <QuestActionButton
          label={
            sharing
              ? t("quests.speedCalculusSharePreparing")
              : t("quests.speedCalculusShareResult")
          }
          onPress={onShare}
          disabled={sharing}
          loading={sharing}
          loadingMode="inline"
          backgroundColor={tc.surface}
          foregroundColor={tc.primaryText}
          borderColor={tc.primaryBorder}
          leadingIcon={ShareIcon}
          minHeight={48}
          testID="speed-calculus-share"
        />
      ) : null}

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
            <>
              <Text className="font-nunito text-successText text-[13px] mt-1">
                {t("quests.speedCalculusClaimReminder")}
              </Text>
              {state.questVersion ? (
                <QuestActionButton
                  label={t("quests.speedCalculusClaimReward", {
                    reward: state.rewardPreview,
                  })}
                  onPress={onClaim}
                  loading={claiming}
                  loadingMode="inline"
                  backgroundColor={tc.successTint}
                  foregroundColor={tc.successText}
                  borderColor={tc.successBorder}
                  minHeight={48}
                  style={{ marginTop: 12 }}
                  accessibilityLabel={t("quests.speedCalculusClaimReward", {
                    reward: state.rewardPreview,
                  })}
                  testID="speed-calculus-claim-reward"
                />
              ) : null}
            </>
          )}
        </View>
      )}
    </View>
  );
}
