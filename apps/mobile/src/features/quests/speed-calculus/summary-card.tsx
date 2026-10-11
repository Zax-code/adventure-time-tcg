import { Text, useWindowDimensions, View } from "react-native";
import type { SpeedRunState } from "@adventure-time/api-client";

import { Button } from "../../../components/ui/button";
import { useTranslation } from "../../../i18n";
import { CoinIcon, ShareIcon } from "../../../components/icons";
import { QuestActionButton } from "../quest-action-button";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";

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
      className="rounded-ds-lg border p-ds-4 gap-3"
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
        <Button
          tone="primary"
          size="lg"
          onPress={onResumeRun}
          disabled={submitting}
        >
          {submitting ? "..." : t("quests.speedCalculusResume")}
        </Button>
      ) : null}

      {!activeRun && state?.canStartRun && (
        <Button
          tone="primary"
          size="lg"
          onPress={onStartRun}
          disabled={submitting}
        >
          {submitting
                ? "..."
                : t("quests.speedCalculusStartRun", {
                    run: (state?.runsUsed ?? 0) + 1,
                  })}
        </Button>
      )}

      {!activeRun && state?.canCashOut && (
        <Button
          tone="secondary"
          size="lg"
          onPress={onCashOut}
          disabled={submitting}
        >
          {submitting
                ? "..."
                : t("quests.speedCalculusCashOut", {
                    reward: state?.rewardPreview ?? 0,
                  })}
        </Button>
      )}

      {!activeRun && (state?.history.length ?? 0) > 0 ? (
        <QuestActionButton
          tone="ghost"
          label={
            sharing
              ? t("quests.speedCalculusSharePreparing")
              : t("quests.speedCalculusShareResult")
          }
          onPress={onShare}
          disabled={sharing}
          loading={sharing}
          loadingMode="inline"
          leadingIcon={ShareIcon}
          testID="speed-calculus-share"
        />
      ) : null}

      {state?.locked && (
        <View className="rounded-ds-md border border-successBorder bg-successTint p-4 mt-2">
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
                  tone="secondary"
                  label={t("quests.speedCalculusClaimReward", {
                    reward: state.rewardPreview,
                  })}
                  onPress={onClaim}
                  loading={claiming}
                  loadingMode="inline"
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
