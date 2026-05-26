import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiClient } from "../src/lib/api";
import { useTranslation } from "../src/i18n";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS } from "../src/theme/themes";
import {
  ChevronRightIcon,
  ClockIcon,
  SwordsIcon,
  TrophyIcon,
} from "../src/components/icons";

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

  const historyQuery = useQuery({
    queryKey: ["pvp-history"],
    queryFn: () => apiClient.pvpHistory(),
  });

  const completedMatches = useMemo(
    () =>
      (historyQuery.data?.matches ?? []).filter((match) => match.status === "COMPLETED"),
    [historyQuery.data?.matches],
  );

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingBottom: 32 }}>
      <View
        className="border-b border-primaryTint bg-white/90 px-4 pb-4"
        style={{ paddingTop: insets.top + 8 }}
      >
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.push("/(tabs)/pvp")} className="rounded-xl p-2">
            <View style={{ transform: [{ rotate: "180deg" }] }}>
              <ChevronRightIcon size={20} color={tc.fgMuted} />
            </View>
          </Pressable>
          <View>
            <Text className="font-nunito-extrabold text-2xl text-primaryDark">
              {t("pvp.matchHistory")}
            </Text>
            <Text className="font-nunito text-sm text-fgMuted">
              {t("pvp.completedMatches", {
                count: historyQuery.data?.totalCount ?? completedMatches.length,
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
                {historyQuery.data?.stats?.wins ?? 0}
              </Text>
              <Text className="font-nunito text-sm text-white/80">{t("pvp.wins")}</Text>
            </View>
            <View className="items-center">
              <Text className="font-nunito-extrabold text-3xl text-white">
                {historyQuery.data?.stats?.losses ?? 0}
              </Text>
              <Text className="font-nunito text-sm text-white/80">{t("pvp.losses")}</Text>
            </View>
            <View className="items-center">
              <Text className="font-nunito-extrabold text-3xl text-white">
                {historyQuery.data?.stats?.winRate ?? 0}%
              </Text>
              <Text className="font-nunito text-sm text-white/80">{t("pvp.winRate")}</Text>
            </View>
          </View>
        </View>

        {historyQuery.isLoading ? (
          <View className="items-center justify-center rounded-2xl border border-primaryTint bg-surface p-8">
            <Text className="font-nunito text-fgMuted">{t("common.loading")}</Text>
          </View>
        ) : historyQuery.isError ? (
          <View className="items-center justify-center rounded-2xl border border-dangerBorder bg-dangerTint p-8">
            <Text className="text-center font-nunito text-dangerDark">
              {historyQuery.error instanceof Error
                ? historyQuery.error.message
                : t("pvp.failedLoadReplay")}
            </Text>
          </View>
        ) : completedMatches.length === 0 ? (
          <View className="items-center rounded-2xl border border-primaryTint bg-surface p-8">
            <SwordsIcon size={48} color={tc.primaryBorder} />
            <Text className="mt-4 font-nunito-bold text-lg text-fg">
              {t("pvp.noCompletedMatches")}
            </Text>
            <Text className="mt-2 text-center font-nunito text-sm text-fgMuted">
              {t("pvp.noCompletedMatchesHint")}
            </Text>
            <Pressable
              onPress={() => router.push("/(tabs)/pvp")}
              className="mt-4 rounded-xl bg-primaryDark px-6 py-3"
            >
              <Text className="font-nunito-bold text-white">{t("pvp.findBattle")}</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-3">
            {completedMatches.map((match) => {
              const currentUserId = historyQuery.data?.currentUserId;
              const opponentName =
                match.inviterId === currentUserId
                  ? match.inviteeName ?? match.inviteeId.slice(0, 8)
                  : match.inviterName ?? match.inviterId.slice(0, 8);
              const won = match.winnerId === currentUserId;

              return (
                <Pressable
                  key={match.id}
                  onPress={() => {
                    if (match.hasReplayData) {
                      router.push(`/pvp-replay?id=${match.id}` as never);
                    }
                  }}
                  disabled={!match.hasReplayData}
                  className={`rounded-2xl border-2 bg-surface p-4 ${
                    won ? "border-successBorder" : "border-dangerBorder"
                  } ${match.hasReplayData ? "" : "opacity-70"}`}
                >
                  <View className="flex-row items-center gap-4">
                    <View
                      className={`h-14 w-14 items-center justify-center rounded-xl ${
                        won ? "bg-successDark" : "bg-dangerDark"
                      }`}
                    >
                      <Text className="font-nunito-extrabold text-lg text-white">
                        {won ? "W" : "L"}
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
