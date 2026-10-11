import { View } from "react-native";
import Play from "lucide-react-native/icons/play";
import Timer from "lucide-react-native/icons/timer";
import type { SpeedRunState } from "@adventure-time/api-client";

import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Notice } from "../../../components/ui/notice";
import { StatTile } from "../../../components/ui/stat-tile";
import { useTranslation } from "../../../i18n";
import { ShareIcon } from "../../../components/icons";
import { QuestActionButton } from "../quest-action-button";

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

// Board 04 reward Card: three StatTiles over the run commands (start,
// resume, cash out, share) and the locked / claim notice.
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
  const runsLeft = Math.max(0, (state?.maxRuns ?? 0) - (state?.runsUsed ?? 0));

  return (
    <Card tone="secondary" testID="speed-calculus-summary-card">
      <View className="flex-row gap-ds-3">
        <StatTile
          className="flex-1"
          label={t("quests.speedCalculusLatestReward")}
          value={state?.rewardPreview ?? 0}
          caption={t("quests.speedCalculusCoinsCaption")}
        />
        <StatTile
          className="flex-1"
          label={t("quests.speedCalculusLatestScore")}
          value={state?.latestScore ?? 0}
        />
        <StatTile
          className="flex-1"
          label={t("quests.speedCalculusRunsLeft")}
          value={runsLeft}
        />
      </View>

      {activeRun?.isManuallyPaused ? (
        <Button
          tone="primary"
          size="lg"
          icon={Play}
          onPress={onResumeRun}
          disabled={submitting}
          loading={submitting}
        >
          {t("quests.speedCalculusResume")}
        </Button>
      ) : null}

      {!activeRun && state?.canStartRun ? (
        <Button
          tone="primary"
          size="lg"
          icon={Timer}
          onPress={onStartRun}
          disabled={submitting}
          loading={submitting}
          testID="speed-calculus-start-run"
        >
          {t("quests.speedCalculusStartRun", {
            run: (state?.runsUsed ?? 0) + 1,
          })}
        </Button>
      ) : null}

      {!activeRun && state?.canCashOut ? (
        <Button
          tone="secondary"
          size="lg"
          onPress={onCashOut}
          disabled={submitting}
          loading={submitting}
        >
          {t("quests.speedCalculusCashOut", {
            reward: state?.rewardPreview ?? 0,
          })}
        </Button>
      ) : null}

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

      {state?.locked ? (
        <Notice
          tone="success"
          title={
            state.claimed
              ? t("quests.speedCalculusClaimed")
              : t("quests.speedCalculusLocked", {
                  reward: state.rewardPreview,
                })
          }
          body={state.claimed ? undefined : t("quests.speedCalculusClaimReminder")}
        >
          {!state.claimed && state.questVersion ? (
            <QuestActionButton
              tone="secondary"
              size="sm"
              label={t("quests.speedCalculusClaimReward", {
                reward: state.rewardPreview,
              })}
              onPress={onClaim}
              loading={claiming}
              loadingMode="inline"
              accessibilityLabel={t("quests.speedCalculusClaimReward", {
                reward: state.rewardPreview,
              })}
              testID="speed-calculus-claim-reward"
            />
          ) : null}
        </Notice>
      ) : null}
    </Card>
  );
}
