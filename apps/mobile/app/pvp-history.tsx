import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiClient } from "../src/lib/api";
import { ThemedExpoButton } from "../src/components/expo-ui/themed-button";
import { SectionErrorState } from "../src/components/error-state";
import { LoadingPanel } from "../src/components/loading-state";
import { getPvpMatchResultView } from "../src/features/pvp/match-result";
import { useTranslation } from "../src/i18n";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS } from "../src/theme/themes";
import {
  ChevronRightIcon,
  ClockIcon,
  SwordsIcon,
  TrophyIcon,
} from "../src/components/icons";

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

  const { data: historyQueryData, error: historyQueryError, isError: historyQueryIsError, isLoading: historyQueryIsLoading, refetch: historyQueryRefetch } = useQuery({
    queryKey: ["pvp-history"],
    queryFn: () => apiClient.pvpHistory(),
    refetchOnMount: "always",
    refetchInterval: (query) =>
      query.state.status === "error" ? false : PVP_HISTORY_REFETCH_INTERVAL_MS,
  });

  const completedMatches = useMemo(
    () =>
      (historyQueryData?.matches ?? []).filter((match) => match.status === "COMPLETED"),
    [historyQueryData?.matches],
  );

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingBottom: 32 }}>
      <View
        className="border-b border-primaryTint bg-white/90 px-4 pb-4"
        style={{ paddingTop: insets.top + 8 }}
      >
        <View className="flex-row items-center gap-3">
          <ThemedExpoButton
            onPress={() => router.push("/(tabs)/pvp")}
            variant="ghost"
            fallbackAppearance={{
              backgroundColor: "transparent",
              borderColor: "transparent",
              borderRadius: 12,
              foregroundColor: tc.fgMuted,
              gradientColors: null,
              minHeight: 36,
              paddingHorizontal: 8,
              paddingVertical: 8,
            }}
            style={{ minHeight: 36, minWidth: 36 }}
          >
            <View style={{ transform: [{ rotate: "180deg" }] }}>
              <ChevronRightIcon size={20} color={tc.fgMuted} />
            </View>
          </ThemedExpoButton>
          <View>
            <Text className="font-nunito-extrabold text-2xl text-primaryDark">
              {t("pvp.matchHistory")}
            </Text>
            <Text className="font-nunito text-sm text-fgMuted">
              {t("pvp.completedMatches", {
                count: historyQueryData?.totalCount ?? completedMatches.length,
              })}
            </Text>
          </View>
        </View>
      </View>

      <View className="px-4 pt-5">
        <View className="mb-6 rounded-2xl bg-primaryDark px-4 py-5">
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="font-nunito-extrabold text-3xl text-white">
                {historyQueryData?.stats?.wins ?? 0}
              </Text>
              <Text className="font-nunito text-sm text-white/80">{t("pvp.wins")}</Text>
            </View>
            <View className="items-center">
              <Text className="font-nunito-extrabold text-3xl text-white">
                {historyQueryData?.stats?.losses ?? 0}
              </Text>
              <Text className="font-nunito text-sm text-white/80">{t("pvp.losses")}</Text>
            </View>
            <View className="items-center">
              <Text className="font-nunito-extrabold text-3xl text-white">
                {historyQueryData?.stats?.draws ?? 0}
              </Text>
              <Text className="font-nunito text-sm text-white/80">{t("pvp.draws")}</Text>
            </View>
            <View className="items-center">
              <Text className="font-nunito-extrabold text-3xl text-white">
                {historyQueryData?.stats?.winRate ?? 0}%
              </Text>
              <Text className="font-nunito text-sm text-white/80">{t("pvp.winRate")}</Text>
            </View>
          </View>
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
          <View className="items-center rounded-2xl border border-primaryTint bg-surface p-8">
            <SwordsIcon size={48} color={tc.primaryBorder} />
            <Text className="mt-4 font-nunito-bold text-lg text-fg">
              {t("pvp.noCompletedMatches")}
            </Text>
            <Text className="mt-2 text-center font-nunito text-sm text-fgMuted">
              {t("pvp.noCompletedMatchesHint")}
            </Text>
            <ThemedExpoButton
              onPress={() => router.push("/(tabs)/pvp")}
              preferFallback
              variant="primary"
              fallbackAppearance={{
                backgroundColor: tc.primaryDark,
                borderColor: tc.primaryDark,
                borderRadius: 12,
                foregroundColor: "#FFFFFF",
                gradientColors: null,
                minHeight: 0,
                paddingHorizontal: 24,
                paddingVertical: 12,
                textStyle: {
                  fontFamily: "Nunito_700Bold",
                  fontSize: 14,
                },
              }}
              style={{ marginTop: 16 }}
            >
              {t("pvp.findBattle")}
            </ThemedExpoButton>
          </View>
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
                <ThemedExpoButton
                  key={match.id}
                  onPress={() => {
                    if (match.hasReplayData) {
                      router.push(`/pvp-replay?id=${match.id}` as never);
                    }
                  }}
                  disabled={!match.hasReplayData}
                  preferFallback
                  variant={
                    result.tone === "draw"
                      ? "secondary"
                      : result.tone === "win"
                        ? "primary"
                        : "danger"
                  }
                  fallbackLayout="stretch"
                  fallbackAppearance={{
                    backgroundColor: tc.surface,
                    borderColor:
                      result.tone === "draw"
                        ? tc.infoBorder
                        : result.tone === "win"
                          ? tc.successBorder
                          : tc.dangerBorder,
                    borderRadius: 16,
                    foregroundColor: tc.fg,
                    gradientColors: null,
                    minHeight: 0,
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                  }}
                >
                  <View className="flex-row items-center gap-4">
                    <View
                      className={`h-14 w-14 items-center justify-center rounded-xl ${
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
                </ThemedExpoButton>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
