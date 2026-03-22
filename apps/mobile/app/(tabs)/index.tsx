import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { ApiClientError, apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { useThemeStore } from "../../src/stores/theme-store";
import { useBottomTabBarContentPadding } from "../../src/theme/layout";
import { THEME_COLORS } from "../../src/theme/themes";
import { PrimaryButton, SecondaryButton } from "../../src/components/button";
import { CardTile } from "../../src/components/card-tile";
import { useTranslation } from "../../src/i18n";

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const accessToken = useSessionStore((state) => state.accessToken);
  const refreshToken = useSessionStore((state) => state.refreshToken);
  const setSession = useSessionStore((state) => state.setSession);
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  const bottomTabPadding = useBottomTabBarContentPadding();

  const homeQuery = useQuery({
    queryKey: ["home"],
    queryFn: () => apiClient.home(),
  });
  const dailyClaimQuery = useQuery({
    queryKey: ["daily-claim"],
    queryFn: () => apiClient.getDailyClaimStatus(),
  });
  const featuredQuery = useQuery({
    queryKey: ["featured-cards"],
    queryFn: () => apiClient.featuredCards(),
  });
  const raritiesQuery = useQuery({
    queryKey: ["rarities"],
    queryFn: () => apiClient.rarities(),
  });

  const claimMutation = useMutation({
    mutationFn: () => apiClient.claimDailyReward(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["daily-claim"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });

      if (accessToken && refreshToken) {
        const me = await apiClient.me();
        await setSession({ user: me, accessToken, refreshToken });
      }
    },
    onError: async (error) => {
      if (
        error instanceof ApiClientError &&
        error.status === 409 &&
        error.code === "DAILY_ALREADY_CLAIMED"
      ) {
        await queryClient.invalidateQueries({ queryKey: ["daily-claim"] });
        await queryClient.invalidateQueries({ queryKey: ["home"] });
      }
    },
  });

  const canClaim = dailyClaimQuery.data?.canClaim ?? false;

  const [liveTime, setLiveTime] = useState(0);

  useEffect(() => {
    setLiveTime(dailyClaimQuery.data?.timeUntilNextClaim ?? 0);
  }, [dailyClaimQuery.data]);

  useEffect(() => {
    if (liveTime <= 0 || canClaim) return;
    const id = setInterval(() => {
      setLiveTime((prev) => {
        if (prev <= 1000) {
          queryClient.invalidateQueries({ queryKey: ["daily-claim"] });
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [liveTime, canClaim]);

  function formatTimeRemaining(ms: number) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  }

  if (homeQuery.isLoading) {
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-fgMuted">{t("common.loading")}</Text>
      </View>
    );
  }

  if (homeQuery.isError) {
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-danger">
          {homeQuery.error.message}
        </Text>
      </View>
    );
  }

  const home = homeQuery.data;
  if (!home) {
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-fgMuted">
          {t("native.home.homeUnavailable")}
        </Text>
      </View>
    );
  }

  const rarities = raritiesQuery.data?.rarities ?? [];
  const totalDropRate = rarities.reduce((s, r) => s + r.dropRate, 0);

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ gap: 24, paddingBottom: bottomTabPadding }}
    >
      {/* Daily Claim */}
      <View className="mx-5 rounded-2xl border border-secondaryBorder bg-secondaryTint px-4 py-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="font-nunito-bold text-lg text-secondaryText">
              {t("home.dailyReward")}
            </Text>
            <Text className="font-nunito text-sm text-secondaryText">
              {canClaim
                ? t("home.claimCoins", {
                    amount: dailyClaimQuery.data?.dailyReward ?? 100,
                  })
                : t("home.nextClaim", {
                    time: formatTimeRemaining(liveTime),
                  })}
            </Text>
          </View>
          {canClaim ? (
            <Pressable
              onPress={() => claimMutation.mutate()}
              disabled={claimMutation.isPending}
            >
              <LinearGradient
                colors={[tc.secondary, tc.secondaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderRadius: 999,
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                }}
              >
                <Text className="font-nunito-bold text-sm text-secondaryText">
                  {claimMutation.isPending ? "..." : t("home.claim")}
                </Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <View className="rounded-full px-4 py-2" style={{ backgroundColor: tc.infoTint + '99' }}>
              <Text className="font-nunito-bold text-sm" style={{ color: tc.infoDark + '99' }}>
                {t("home.claimed")}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Collection Progress */}
      <View className="mx-5 rounded-2xl border border-secondaryBorder p-4" style={{ backgroundColor: tc.secondaryTint + '99' }}>
        <Text className="mb-2 font-nunito-bold text-lg text-primaryText">
          {t("home.collectionProgress")}
        </Text>
        <View className="flex-row items-center gap-4">
          <View className="h-4 flex-1 overflow-hidden rounded-full bg-primaryTint">
            <LinearGradient
              colors={[tc.primary, tc.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                width: `${home.collectionStats.completionPercentage}%`,
                height: "100%",
                borderRadius: 999,
              }}
            />
          </View>
          <Text className="font-nunito-bold text-primaryStrong">
            {home.collectionStats.uniqueOwned}/{home.collectionStats.totalCards}
          </Text>
        </View>
        <Text className="mt-2 font-nunito text-sm" style={{ color: tc.primaryDark + 'b3' }}>
          {t("home.complete", {
            percent: home.collectionStats.completionPercentage,
          })}
        </Text>
      </View>

      {/* Quick Actions */}
      <View className="mx-5 flex-row gap-4">
        <PrimaryButton
          onPress={() => router.push("/(tabs)/packs")}
          style={{ flex: 1 }}
        >
          {t("home.openPack")}
        </PrimaryButton>
        <SecondaryButton
          onPress={() => router.push("/(tabs)/collection")}
          style={{ flex: 1 }}
        >
          {t("home.myCards")}
        </SecondaryButton>
      </View>

      {/* Featured Cards */}
      {(featuredQuery.data?.cards.length ?? 0) > 0 && (
        <View className="gap-2" style={{ marginTop: -16 }}>
          <Text className="px-5 font-nunito-bold text-xl text-primaryText">
            {t("home.featuredCards")}
          </Text>
          <FlatList
            horizontal
            data={featuredQuery.data?.cards ?? []}
            keyExtractor={(item) => item.card.id}
            renderItem={({ item }) => (
              <View style={{ width: 160, marginHorizontal: 12 }}>
                <CardTile entry={item} accessToken={accessToken} />
              </View>
            )}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 32 }}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      {/* Drop Rates */}
      {rarities.length > 0 && (
        <View
          className="mx-5 rounded-2xl border border-secondaryBorder p-4"
          style={{ marginTop: -40, backgroundColor: tc.secondaryTint + '99' }}
        >
          <Text className="mb-3 font-nunito-bold text-lg text-secondaryText">
            {t("home.dropRates")}
          </Text>
          {rarities.map((rarity) => {
            const pct =
              totalDropRate > 0
                ? Math.round((rarity.dropRate / totalDropRate) * 100)
                : 0;
            return (
              <View key={rarity.id} className="flex-row justify-between">
                <Text
                  style={{ color: rarity.color }}
                  className="font-nunito-semibold"
                >
                  {rarity.name}
                </Text>
                <Text
                  style={{ color: rarity.color }}
                  className="font-nunito-bold"
                >
                  ×{rarity.dropRate} (≈{pct}%)
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
