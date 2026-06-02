import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";
import {
  AppState,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { ApiClientError, apiClient } from "../../src/lib/api";
import {
  getNotificationPermissionPromptHidden,
  getNotificationPermissionStatus,
  setNotificationPermissionPromptHidden,
} from "../../src/lib/app-notifications";
import { useSessionStore } from "../../src/stores/session-store";
import { useStepSyncStore } from "../../src/stores/step-sync-store";
import { useThemeStore } from "../../src/stores/theme-store";
import { useBottomTabBarContentPadding } from "../../src/theme/layout";
import { THEME_COLORS } from "../../src/theme/themes";
import { PrimaryButton, SecondaryButton } from "../../src/components/button";
import { CardTile } from "../../src/components/card-tile";
import { PageErrorState } from "../../src/components/error-state";
import { PageLoadingState } from "../../src/components/loading-state";
import { useTranslation } from "../../src/i18n";

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const accessToken = useSessionStore((state) => state.accessToken);
  const user = useSessionStore((state) => state.user);
  const patchUser = useSessionStore((state) => state.patchUser);
  const notificationPermissionStatus = useStepSyncStore(
    (state) => state.notificationPermissionStatus,
  );
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
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["daily-claim"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      await patchUser({ coins: data.newBalance });
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
  const wantsNotifications = Boolean(
    user?.notificationPreferences.dailyReset ||
      user?.notificationPreferences.stepGoal ||
      user?.notificationPreferences.pvpInvite ||
      user?.notificationPreferences.pvpTurn ||
      user?.notificationPreferences.giftReceived,
  );

  const [liveTime, setLiveTime] = useState(0);
  const [notificationPromptIgnored, setNotificationPromptIgnored] =
    useState(false);
  const [notificationPromptHidden, setNotificationPromptHidden] =
    useState(false);

  useEffect(() => {
    setLiveTime(dailyClaimQuery.data?.timeUntilNextClaim ?? 0);
  }, [dailyClaimQuery.data]);

  useEffect(() => {
    let cancelled = false;

    setNotificationPromptIgnored(false);

    if (!user?.id) {
      setNotificationPromptHidden(false);
      return;
    }

    const syncNotificationPromptState = async () => {
      const hidden = await getNotificationPermissionPromptHidden(user.id);
      if (!cancelled) {
        setNotificationPromptHidden(hidden);
      }
    };

    void getNotificationPermissionStatus();
    void syncNotificationPromptState();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void getNotificationPermissionStatus();
        void syncNotificationPromptState();
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [user?.id]);

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
  }, [liveTime, canClaim, queryClient]);

  const shouldShowNotificationPrompt =
    Boolean(user?.id) &&
    wantsNotifications &&
    !notificationPromptIgnored &&
    !notificationPromptHidden &&
    (notificationPermissionStatus === "not_requested" ||
      notificationPermissionStatus === "denied");

  function formatTimeRemaining(ms: number) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  }

  if (homeQuery.isLoading) {
    return (
      <PageLoadingState
        title={t("nav.home")}
        message={t("common.loadingStates.pageBody")}
        icon="sunny"
      />
    );
  }

  if (homeQuery.isError) {
    return (
      <PageErrorState
        error={homeQuery.error}
        onRetry={() => {
          void homeQuery.refetch();
        }}
      />
    );
  }

  const home = homeQuery.data;
  if (!home) {
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-fgMuted">
          {t("home.homeUnavailable")}
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
      {shouldShowNotificationPrompt ? (
        <View className="mx-5 rounded-3xl border border-primaryBorder bg-surface px-4 py-4">
          <View className="flex-row items-start gap-3">
            <View
              className="h-11 w-11 items-center justify-center rounded-2xl"
              style={{ backgroundColor: tc.primaryTint }}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color={tc.primaryText}
              />
            </View>
            <View className="flex-1 gap-1 pr-1">
              <Text className="font-nunito-bold text-lg text-fg">
                {t("home.notificationsPromptTitle")}
              </Text>
              <Text className="font-nunito text-sm leading-5 text-fgMuted">
                {t("home.notificationsPromptBody")}
              </Text>
            </View>
          </View>

          <View className="mt-4 gap-2">
            <PrimaryButton
              onPress={() => {
                router.push({
                  pathname: "/settings",
                  params: { section: "notifications" },
                });
              }}
            >
              {t("home.notificationsPromptSettings")}
            </PrimaryButton>

            <View className="flex-row gap-2">
              <Pressable
                className="flex-1 rounded-full border border-primaryBorder bg-surfaceMuted px-4 py-3"
                onPress={() => {
                  setNotificationPromptIgnored(true);
                }}
              >
                <Text className="text-center font-nunito-semibold text-sm text-fgMuted">
                  {t("home.notificationsPromptIgnore")}
                </Text>
              </Pressable>

              <Pressable
                className="flex-1 rounded-full border border-primaryBorder bg-surfaceMuted px-4 py-3"
                onPress={() => {
                  if (!user?.id) {
                    return;
                  }

                  void setNotificationPermissionPromptHidden(user.id, true).then(
                    () => {
                      setNotificationPromptHidden(true);
                    },
                  );
                }}
              >
                <Text className="text-center font-nunito-semibold text-sm text-fgMuted">
                  {t("home.notificationsPromptHide")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

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
            <View
              className="rounded-full px-4 py-2"
              style={{ backgroundColor: tc.infoTint + "99" }}
            >
              <Text
                className="font-nunito-bold text-sm"
                style={{ color: tc.infoDark + "99" }}
              >
                {t("home.claimed")}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Collection Progress */}
      <View
        className="mx-5 rounded-2xl border border-secondaryBorder p-4"
        style={{ backgroundColor: tc.secondaryTint + "99" }}
      >
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
        <Text
          className="mt-2 font-nunito text-sm"
          style={{ color: tc.primaryDark + "b3" }}
        >
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
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingVertical: 32,
            }}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      {/* Drop Rates */}
      {rarities.length > 0 && (
        <View
          className="mx-5 rounded-2xl border border-secondaryBorder p-4"
          style={{ marginTop: -40, backgroundColor: tc.secondaryTint + "99" }}
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
