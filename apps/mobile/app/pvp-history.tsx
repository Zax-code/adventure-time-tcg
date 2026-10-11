import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScrollView,
  Text,
  View,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import Swords from "lucide-react-native/icons/swords";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RADIUS } from "@adventure-time/theme";

import { apiClient } from "../src/lib/api";
import { StatePanel } from "../src/components/ui/state-panel";
import { StatTile } from "../src/components/ui/stat-tile";
import { StackHeader } from "../src/components/ui/stack-header";
import { SectionErrorState } from "../src/components/error-state";
import { LoadingPanel } from "../src/components/loading-state";
import { getPvpMatchResultView } from "../src/features/pvp/match-result";
import { useFocusedRefetchInterval } from "../src/hooks/use-focused-refetch-interval";
import { useTranslation } from "../src/i18n";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS } from "../src/theme/themes";
import { ChevronRightIcon, ClockIcon } from "../src/components/icons";

const PVP_HISTORY_REFETCH_INTERVAL_MS = 5_000;

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
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];

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

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={{ paddingTop: insets.top }}>
        <StackHeader
          title={t("pvp.matchHistory")}
          onBack={() => router.push("/(tabs)/pvp")}
          backLabel={t("common.errorStates.backAction")}
        />
        <Text className="px-ds-4 text-center font-nunito text-ds-sm text-fgMuted">
          {t("pvp.completedMatches", {
            count: historyQueryData?.totalCount ?? completedMatches.length,
          })}
        </Text>
      </View>

      <View className="px-4 pt-5">
        <View className="mb-ds-6 flex-row flex-wrap gap-ds-3">
          <StatTile
            className="grow basis-[45%]"
            tone="success"
            label={t("pvp.wins")}
            value={historyQueryData?.stats?.wins ?? 0}
          />
          <StatTile
            className="grow basis-[45%]"
            tone="danger"
            label={t("pvp.losses")}
            value={historyQueryData?.stats?.losses ?? 0}
          />
          <StatTile
            className="grow basis-[45%]"
            label={t("pvp.draws")}
            value={historyQueryData?.stats?.draws ?? 0}
          />
          <StatTile
            className="grow basis-[45%]"
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
          <View className="gap-3">
            {completedMatches.map((match) => {
              const currentUserId = historyQueryData?.currentUserId;
              const opponentName =
                match.inviterId === currentUserId
                  ? match.inviteeName ?? match.inviteeId.slice(0, 8)
                  : match.inviterName ?? match.inviterId.slice(0, 8);
              const result = getPvpMatchResultView(match, currentUserId);

              return (
                <Pressable
                  key={match.id}
                  onPress={() => {
                    if (match.hasReplayData) {
                      router.push(`/pvp-replay?id=${match.id}` as never);
                    }
                  }}
                  disabled={!match.hasReplayData}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    {
                      borderRadius: RADIUS.md,
                      borderWidth: 1,
                      borderColor: result.tone === "draw"
                        ? tc.infoBorder
                        : result.tone === "win"
                          ? tc.successBorder
                          : tc.dangerBorder,
                      backgroundColor: tc.surface,
                      paddingHorizontal: 16,
                      paddingVertical: 16,
                      opacity: !match.hasReplayData ? 0.6 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View className="flex-row items-center gap-4">
                    <View
                      className={`h-14 w-14 items-center justify-center rounded-ds-sm ${
                        result.tone === "draw"
                          ? "bg-info"
                          : result.tone === "win"
                            ? "bg-successDark"
                            : "bg-dangerDark"
                      }`}
                    >
                      <Text className="font-nunito-extrabold text-lg text-white">
                        {result.badge}
                      </Text>
                      <Text className="font-nunito text-[10px] text-white/80">
                        T{match.currentTurn ?? 1}
                      </Text>
                    </View>

                    <View className="flex-1">
                      <Text className="font-nunito-bold text-fg">vs {opponentName}</Text>
                      <View className="mt-1 flex-row items-center gap-2">
                        <ClockIcon size={14} color={tc.fgMuted} />
                        <Text className="font-nunito text-sm text-fgMuted">
                          {formatDate(match.updatedAt, t)}
                        </Text>
                      </View>
                      <Text
                        className={`mt-1 font-nunito-bold text-xs ${
                          result.tone === "draw"
                            ? "text-infoDark"
                            : result.tone === "win"
                              ? "text-successDark"
                              : "text-dangerDark"
                        }`}
                      >
                        {t(result.labelKey)}
                      </Text>
                    </View>

                    {match.hasReplayData ? (
                      <View className="flex-row items-center gap-1">
                        <Text className="font-nunito-semibold text-accentText">
                          {t("pvp.replay")}
                        </Text>
                        <ChevronRightIcon size={16} color={tc.accentText} />
                      </View>
                    ) : (
                      <Text className="font-nunito text-xs text-fgMuted">
                        {t("pvp.noReplay")}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
