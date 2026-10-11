import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import Flag from "lucide-react-native/icons/flag";
import Swords from "lucide-react-native/icons/swords";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiClient } from "../src/lib/api";
import { Card } from "../src/components/ui/card";
import { ListRow } from "../src/components/ui/list-row";
import { SectionHeader } from "../src/components/ui/section-header";
import { StatePanel } from "../src/components/ui/state-panel";
import { StatTile } from "../src/components/ui/stat-tile";
import { StackHeader } from "../src/components/ui/stack-header";
import type { Tone } from "../src/components/ui/tokens";
import { SectionErrorState } from "../src/components/error-state";
import { LoadingPanel } from "../src/components/loading-state";
import { getPvpMatchResultView } from "../src/features/pvp/match-result";
import { useFocusedRefetchInterval } from "../src/hooks/use-focused-refetch-interval";
import { useTranslation } from "../src/i18n";

const PVP_HISTORY_REFETCH_INTERVAL_MS = 5_000;

const RESULT_TONE: Record<"win" | "loss" | "draw", Tone> = {
  win: "success",
  loss: "danger",
  draw: "info",
};

function formatDate(
  dateStr: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const date = new Date(dateStr);
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDays === 1) {
    return t("pvp.yesterday");
  }
  if (diffDays < 7) {
    return t("pvp.daysAgo", { count: diffDays });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function PvpHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const historyRefetchInterval = useFocusedRefetchInterval(
    PVP_HISTORY_REFETCH_INTERVAL_MS,
  );
  const { data: historyQueryData, error: historyQueryError, isError: historyQueryIsError, isLoading: historyQueryIsLoading, refetch: historyQueryRefetch } = useQuery({
    queryKey: ["pvp-history"],
    queryFn: () => apiClient.pvpHistory(),
    refetchOnMount: "always",
    refetchInterval: historyRefetchInterval,
  });

  const completedMatches = useMemo(
    () =>
      (historyQueryData?.matches ?? []).filter((match) => match.status === "COMPLETED"),
    [historyQueryData?.matches],
  );
  const completedCount = historyQueryData?.totalCount ?? completedMatches.length;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={{ height: insets.top }} />
      <StackHeader
        title={t("pvp.matchHistory")}
        onBack={() => router.push("/(tabs)/pvp")}
        backLabel={t("common.errorStates.backAction")}
      />

      <View className="gap-ds-3 px-ds-4 pt-ds-3">
        <View className="flex-row gap-ds-3">
          <StatTile
            className="flex-1"
            tone="success"
            label={t("pvp.wins")}
            value={historyQueryData?.stats?.wins ?? 0}
          />
          <StatTile
            className="flex-1"
            tone="danger"
            label={t("pvp.losses")}
            value={historyQueryData?.stats?.losses ?? 0}
          />
          <StatTile
            className="flex-1"
            label={t("pvp.draws")}
            value={historyQueryData?.stats?.draws ?? 0}
          />
          <StatTile
            className="flex-1"
            tone="info"
            label={t("pvp.winRate")}
            value={`${historyQueryData?.stats?.winRate ?? 0}%`}
          />
        </View>

        {historyQueryIsLoading ? (
          <LoadingPanel
            title={t("pvp.matchHistory")}
            message={t("common.loadingStates.sectionBody")}
            icon="time"
          />
        ) : historyQueryIsError ? (
          <SectionErrorState
            error={historyQueryError}
            title={t("pvp.failedLoadReplay")}
            onRetry={() => {
              void historyQueryRefetch();
            }}
          />
        ) : completedMatches.length === 0 ? (
          <StatePanel
            icon={Swords}
            title={t("pvp.noCompletedMatches")}
            body={t("pvp.noCompletedMatchesHint")}
            action={{
              label: t("pvp.findBattle"),
              onPress: () => router.push("/(tabs)/pvp"),
            }}
          />
        ) : (
          <>
            <SectionHeader
              title={t("pvp.historyCompleted")}
              subtitle={
                completedCount === 1
                  ? t("pvp.historyMatchCountOne")
                  : t("pvp.historyMatchCount", { count: completedCount })
              }
            />
            <Card flush>
              {completedMatches.map((match, index) => {
                const currentUserId = historyQueryData?.currentUserId;
                const opponentName =
                  match.inviterId === currentUserId
                    ? match.inviteeName ?? match.inviteeId.slice(0, 8)
                    : match.inviterName ?? match.inviterId.slice(0, 8);
                const result = getPvpMatchResultView(match, currentUserId);
                const turns = match.currentTurn ?? 1;
                const meta = [
                  formatDate(match.updatedAt, t),
                  turns === 1
                    ? t("pvp.historyTurnOne")
                    : t("pvp.historyTurns", { count: turns }),
                  ...(match.hasReplayData ? [] : [t("pvp.noReplay")]),
                ].join(" \u00b7 ");

                return (
                  <ListRow
                    key={match.id}
                    icon={Flag}
                    iconTone={RESULT_TONE[result.tone]}
                    title={t("pvp.historyVersus", { name: opponentName })}
                    meta={meta}
                    trailingChip={{
                      tone: RESULT_TONE[result.tone],
                      label: t(
                        result.labelKey.replace("pvp.", "pvp.historyResult."),
                      ),
                    }}
                    chevron={Boolean(match.hasReplayData)}
                    divider={index < completedMatches.length - 1}
                    onPress={
                      match.hasReplayData
                        ? () => router.push(`/pvp-replay?id=${match.id}` as never)
                        : undefined
                    }
                    testID={`pvp-history-match-${match.id}`}
                  />
                );
              })}
            </Card>
            <StatePanel
              icon={Swords}
              title={t("pvp.historyEndTitle")}
              body={t("pvp.historyEndBody")}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}
