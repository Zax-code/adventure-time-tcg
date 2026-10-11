import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Bell from "lucide-react-native/icons/bell";
import Calendar from "lucide-react-native/icons/calendar";
import Check from "lucide-react-native/icons/check";
import Clock from "lucide-react-native/icons/clock";
import Coins from "lucide-react-native/icons/coins";
import Layers from "lucide-react-native/icons/layers";
import Package from "lucide-react-native/icons/package";
import Settings from "lucide-react-native/icons/settings";
import {
  AppState,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View } from "react-native";
import { useRouter } from "expo-router";

import { ApiClientError, apiClient } from "../../src/lib/api";
import {
  getNotificationPermissionPromptHidden,
  getNotificationPermissionStatus,
  setNotificationPermissionPromptHidden } from "../../src/lib/app-notifications";
import { useSessionStore } from "../../src/stores/session-store";
import { useStepSyncStore } from "../../src/stores/step-sync-store";
import {
  useAppHeaderHeight,
  useBottomTabBarContentPadding } from "../../src/theme/layout";
import { CardTile } from "../../src/components/card-tile";
import { Button } from "../../src/components/ui/button";
import { Card } from "../../src/components/ui/card";
import { Chip } from "../../src/components/ui/chip";
import { ListRow } from "../../src/components/ui/list-row";
import { Notice } from "../../src/components/ui/notice";
import { ProgressBar } from "../../src/components/ui/progress-bar";
import { SectionHeader } from "../../src/components/ui/section-header";
import { StatTile } from "../../src/components/ui/stat-tile";
import { PageErrorState } from "../../src/components/error-state";
import { PageLoadingState } from "../../src/components/loading-state";
import { useTranslation } from "../../src/i18n";

const styles = StyleSheet.create({
  featuredCardFrame: {
    width: 144 } });

// Owns the one-second ticker so only this line re-renders, not the whole Home tab.
function DailyClaimCountdown({ timeUntilNextClaim }: { timeUntilNextClaim: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [liveTime, setLiveTime] = useState(timeUntilNextClaim);

  useEffect(() => {
    setLiveTime(timeUntilNextClaim);
  }, [timeUntilNextClaim]);

  useEffect(() => {
    if (liveTime <= 0) return;
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
  }, [liveTime, queryClient]);

  return (
    <Text className="font-nunito text-ds-body text-fgMuted">
      {t("home.nextClaim", { time: formatTimeRemaining(liveTime) })}
    </Text>
  );
}

function formatTimeRemaining(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

export default function HomeScreen() {
  return useHomeScreenView();
}

function useHomeScreenView() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const accessToken = useSessionStore((state) => state.accessToken);
  const user = useSessionStore((state) => state.user);
  const patchUser = useSessionStore((state) => state.patchUser);
  const notificationPermissionStatus = useStepSyncStore(
    (state) => state.notificationPermissionStatus,
  );
  const { t } = useTranslation();
  const headerHeight = useAppHeaderHeight();
  const bottomTabPadding = useBottomTabBarContentPadding();

  const { data: homeQueryData, error: homeQueryError, isError: homeQueryIsError, isLoading: homeQueryIsLoading, refetch: homeQueryRefetch } = useQuery({
    queryKey: ["home"],
    queryFn: () => apiClient.home() });
  const { data: dailyClaimQueryData } = useQuery({
    queryKey: ["daily-claim"],
    queryFn: () => apiClient.getDailyClaimStatus() });
  const { data: featuredQueryData } = useQuery({
    queryKey: ["featured-cards"],
    queryFn: () => apiClient.featuredCards() });
  const { data: collectionQueryData } = useQuery({
    queryKey: ["collection"],
    queryFn: () => apiClient.collection() });
  const featuredCards = featuredQueryData?.cards ?? [];
  const ownedCardIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of collectionQueryData?.cards ?? []) {
      if (entry.quantity > 0) {
        ids.add(entry.cardId);
      }
    }
    return ids;
  }, [collectionQueryData?.cards]);
  const renderFeaturedCard = useCallback(
    ({ item }: { item: (typeof featuredCards)[number] }) => {
      const isOwned = ownedCardIds.has(item.cardId);
      return (
        <View style={styles.featuredCardFrame}>
          <CardTile
            entry={item}
            accessToken={accessToken}
            isLocked={!isOwned}
            muted={!isOwned}
          />
        </View>
      );
    },
    [accessToken, ownedCardIds],
  );
  const { data: raritiesQueryData } = useQuery({
    queryKey: ["rarities"],
    queryFn: () => apiClient.rarities() });

  const claimMutation = useMutation({
    mutationFn: () => apiClient.claimDailyReward(),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["daily-claim"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
        patchUser({ coins: data.newBalance }),
      ]);
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
    } });

  const canClaim = dailyClaimQueryData?.canClaim ?? false;
  const wantsNotifications = Boolean(
    user?.notificationPreferences.dailyReset ||
    user?.notificationPreferences.stepGoal ||
    user?.notificationPreferences.pvpInvite ||
    user?.notificationPreferences.pvpTurn ||
    user?.notificationPreferences.giftReceived,
  );

  const [notificationPromptIgnored, setNotificationPromptIgnored] =
    useState(false);
  const [notificationPromptHidden, setNotificationPromptHidden] =
    useState(false);

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

  const shouldShowNotificationPrompt =
    Boolean(user?.id) &&
    wantsNotifications &&
    !notificationPromptIgnored &&
    !notificationPromptHidden &&
    (notificationPermissionStatus === "not_requested" ||
      notificationPermissionStatus === "denied");

  function formatDropRatePercentage(dropRate: number) {
    if (totalDropRate <= 0) {
      return "0%";
    }

    const percentage = (dropRate / totalDropRate) * 100;
    if (percentage > 0 && percentage < 1) {
      return "<1%";
    }

    return `${Math.round(percentage)}%`;
  }

  if (homeQueryIsLoading) {
    return (
      <PageLoadingState
        title={t("nav.home")}
        message={t("common.loadingStates.pageBody")}
        icon="sunny"
      />
    );
  }

  if (homeQueryIsError) {
    return (
      <PageErrorState
        error={homeQueryError}
        onRetry={() => {
          void homeQueryRefetch();
        }}
      />
    );
  }

  const home = homeQueryData;
  if (!home) {
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-fgMuted">
          {t("home.homeUnavailable")}
        </Text>
      </View>
    );
  }

  const collectionPercent = Math.min(
    100,
    Math.max(0, home.collectionStats.completionPercentage),
  );
  const cardsRemaining = Math.max(
    0,
    home.collectionStats.totalCards - home.collectionStats.uniqueOwned,
  );
  const rarities = raritiesQueryData?.rarities ?? [];
  const totalDropRate = rarities.reduce((sum, rarity) => {
    return sum + rarity.dropRate;
  }, 0);

  return (
    <ScrollView className="flex-1 bg-bg">
      <View className="gap-ds-3 px-ds-4" style={{ paddingTop: headerHeight + 12 }}>
        {shouldShowNotificationPrompt ? (
          <Notice
            icon={Bell}
            title={t("home.notificationsPromptTitle")}
            body={t("home.notificationsPromptBody")}
          >
            <Button
              tone="ghost"
              size="sm"
              onPress={() => {
                setNotificationPromptIgnored(true);
              }}
            >
              {t("home.notificationsPromptIgnore")}
            </Button>
            <Button
              size="sm"
              icon={Settings}
              onPress={() => {
                router.push({
                  pathname: "/settings",
                  params: { section: "notifications" } });
              }}
            >
              {t("home.notificationsPromptSettings")}
            </Button>
            <Button
              tone="ghost"
              size="sm"
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
              {t("home.notificationsPromptHide")}
            </Button>
          </Notice>
        ) : null}

        <Card tone={canClaim ? "secondary" : "neutral"}>
          <Chip
            tone={canClaim ? "secondary" : "info"}
            icon={canClaim ? Calendar : Clock}
            label={t("home.todayStatus")}
          />
          <View className="gap-[2px]">
            <Text className="font-nunito-extrabold text-ds-h2 text-fg">
              {canClaim ? t("home.rewardReady") : t("home.rewardClaimed")}
            </Text>
            {canClaim ? (
              <Text className="font-nunito text-ds-body text-fgMuted">
                {t("home.claimCoins", {
                  amount: dailyClaimQueryData?.dailyReward ?? 50 })}
              </Text>
            ) : (
              <DailyClaimCountdown
                timeUntilNextClaim={dailyClaimQueryData?.timeUntilNextClaim ?? 0}
              />
            )}
          </View>
          <Button
            size="lg"
            icon={Coins}
            onPress={() => claimMutation.mutate()}
            disabled={!canClaim || claimMutation.isPending}
            loading={claimMutation.isPending}
          >
            {canClaim ? t("home.claim") : t("home.claimed")}
          </Button>
        </Card>

        <Card>
          <View className="flex-row items-center justify-between gap-ds-3">
            <Text className="flex-1 font-nunito-extrabold text-ds-h3 text-fg">
              {t("home.collectionProgress")}
            </Text>
            <Chip
              tone={collectionPercent >= 100 ? "success" : "primary"}
              icon={collectionPercent >= 100 ? Check : undefined}
              label={`${collectionPercent}%`}
            />
          </View>
          <Text className="font-nunito text-ds-sm text-fgMuted">
            {t("home.cardsCollected", {
              owned: home.collectionStats.uniqueOwned,
              total: home.collectionStats.totalCards })}
          </Text>
          <ProgressBar value={collectionPercent / 100} />
          <View className="flex-row gap-ds-3">
            <StatTile
              className="flex-1"
              tone="secondary"
              label={t("home.uniqueCards")}
              value={home.collectionStats.uniqueOwned}
            />
            <StatTile
              className="flex-1"
              tone="accent"
              label={t("home.cardsRemaining")}
              value={cardsRemaining}
            />
          </View>
        </Card>

        <SectionHeader title={t("home.quickActions")} className="mt-ds-3" />
        <Card flush>
          <ListRow
            icon={Package}
            iconTone="secondary"
            title={t("home.openPack")}
            meta={t("home.openPackHint")}
            chevron
            onPress={() => router.push("/(tabs)/packs")}
          />
          <ListRow
            icon={Layers}
            title={t("home.myCards")}
            meta={t("home.myCardsHint")}
            chevron
            divider={false}
            onPress={() => router.push("/(tabs)/collection")}
          />
        </Card>

        {rarities.length > 0 ? (
          <Card>
            <View className="gap-[2px]">
              <Text className="font-nunito-extrabold text-ds-h3 text-fg">
                {t("home.dropRates")}
              </Text>
              <Text className="font-nunito text-ds-sm text-fgMuted">
                {t("home.dropRatesHint")}
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
              {rarities.map((rarity) => (
                <View
                  key={rarity.id}
                  className="min-h-[56px] w-[48%] justify-center rounded-ds-md border bg-surfaceMuted px-ds-3 py-ds-2"
                  style={{ borderColor: rarity.color }}
                >
                  <View className="flex-row items-center justify-between gap-2">
                    <Text
                      className="flex-1 font-nunito-extrabold text-ds-sm"
                      style={{ color: rarity.color }}
                      numberOfLines={1}
                    >
                      {rarity.name}
                    </Text>
                    <Text className="font-nunito-bold text-ds-caption text-fgMuted">
                      {formatDropRatePercentage(rarity.dropRate)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {featuredCards.length > 0 ? (
          <View className="-mx-ds-4 mt-ds-3 gap-ds-3">
            <SectionHeader
              title={t("home.featuredCards")}
              subtitle={t("home.featuredHint")}
              className="px-ds-4"
            />

            <FlatList
              horizontal
              data={featuredCards}
              keyExtractor={(item) => item.card.id}
              renderItem={renderFeaturedCard}
              contentContainerStyle={{
                gap: 12,
                paddingBottom: 4,
                paddingLeft: 16,
                paddingRight: 16 }}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        ) : null}

        <View style={{ height: bottomTabPadding }} />
      </View>
    </ScrollView>
  );
}
