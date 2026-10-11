import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Bell from "lucide-react-native/icons/bell";
import BellOff from "lucide-react-native/icons/bell-off";
import Calendar from "lucide-react-native/icons/calendar";
import Check from "lucide-react-native/icons/check";
import Clock from "lucide-react-native/icons/clock";
import Coins from "lucide-react-native/icons/coins";
import Layers from "lucide-react-native/icons/layers";
import Package from "lucide-react-native/icons/package";
import Swords from "lucide-react-native/icons/swords";
import {
  AppState,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
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
import { PageTitle } from "../../src/components/ui/page-title";
import { ProgressBar } from "../../src/components/ui/progress-bar";
import { SectionHeader } from "../../src/components/ui/section-header";
import { StatTile } from "../../src/components/ui/stat-tile";
import { ICON_STROKE_WIDTH, useThemePalette } from "../../src/components/ui/tokens";
import { PageErrorState } from "../../src/components/error-state";
import { PageLoadingState } from "../../src/components/loading-state";
import { useTranslation } from "../../src/i18n";

const FEATURED_CARD_WIDTH = 150;
const FEATURED_CARD_GAP = 12;

const styles = StyleSheet.create({
  featuredCardFrame: {
    width: FEATURED_CARD_WIDTH } });

function getFeaturedPageIndex(
  event: NativeSyntheticEvent<NativeScrollEvent>,
  count: number,
) {
  const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
  if (count <= 0) return 0;
  // The last cards never reach the left edge, so the end of the scroll
  // selects the last dot.
  if (contentOffset.x + layoutMeasurement.width >= contentSize.width - 4) {
    return count - 1;
  }
  const index = Math.round(
    contentOffset.x / (FEATURED_CARD_WIDTH + FEATURED_CARD_GAP),
  );
  return Math.min(count - 1, Math.max(0, index));
}

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

type DayPeriod = "morning" | "afternoon" | "evening";

function getDayPeriod(date: Date): DayPeriod {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
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
  const tc = useThemePalette();
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
  const [featuredPage, setFeaturedPage] = useState(0);
  const featuredCount = featuredCards.length;
  const handleFeaturedScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = getFeaturedPageIndex(event, featuredCount);
      setFeaturedPage((prev) => (prev === next ? prev : next));
    },
    [featuredCount],
  );
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
  const { data: packsQueryData } = useQuery({
    queryKey: ["packs"],
    queryFn: () => apiClient.packs() });
  const { data: pvpMatchesQueryData } = useQuery({
    queryKey: ["pvp-matches"],
    queryFn: () => apiClient.pvpMatches() });

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
  const coins = user?.coins ?? home.user.coins;
  const packsReady = packsQueryData
    ? packsQueryData.packs.filter(
        (pack) =>
          pack.isActive &&
          pack.cost <= coins &&
          (pack.availability?.canOpen ?? true),
      ).length
    : null;
  const liveMatches = pvpMatchesQueryData?.matches.length ?? null;
  const displayName = (user?.displayName ?? home.user.displayName)?.trim();
  const greeting = t(`home.greeting.${getDayPeriod(new Date())}`);
  const dailyReward = dailyClaimQueryData?.dailyReward ?? 50;

  return (
    <ScrollView className="flex-1 bg-bg">
      <View className="gap-ds-3 px-ds-4" style={{ paddingTop: headerHeight }}>
        <PageTitle
          title={
            displayName
              ? t("home.greetingWithName", { greeting, name: displayName })
              : greeting
          }
          subtitle={t("home.subtitle")}
        />

        {shouldShowNotificationPrompt ? (
          <>
            <Notice
              icon={Bell}
              title={t("home.notificationsPromptTitle")}
              body={t("home.notificationsPromptBody")}
            />
            <View className="flex-row flex-wrap gap-ds-2 pb-ds-1">
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
                onPress={() => {
                  router.push({
                    pathname: "/settings",
                    params: { section: "notifications" } });
                }}
              >
                {t("home.notificationsPromptSettings")}
              </Button>
            </View>
            <Pressable
              testID="home-notifications-prompt-hide"
              accessibilityRole="button"
              hitSlop={8}
              className="flex-row items-center gap-[6px] self-start px-ds-1"
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
              <BellOff
                size={14}
                color={tc.fgMuted}
                strokeWidth={ICON_STROKE_WIDTH}
              />
              <Text className="font-nunito-bold text-ds-sm text-fgMuted underline">
                {t("home.notificationsPromptHide")}
              </Text>
            </Pressable>
          </>
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
                {t("home.claimCoins", { amount: dailyReward })}
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
            {canClaim
              ? t("home.claimAmount", { amount: dailyReward })
              : t("home.claimed")}
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
          <ProgressBar
            value={collectionPercent / 100}
            accessibilityLabel={t("home.collectionProgress")}
          />
          <View className="flex-row items-start gap-ds-3">
            <StatTile
              className="flex-1"
              tone="secondary"
              label={t("home.uniqueCards")}
              value={home.collectionStats.uniqueOwned}
              caption={t("home.uniqueCardsCaption", {
                total: home.collectionStats.totalCards })}
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
            meta={
              packsReady == null
                ? t("home.openPackHint")
                : packsReady === 0
                  ? t("home.packsReadyNone")
                  : packsReady === 1
                    ? t("home.packsReadyOne")
                    : t("home.packsReadyMany", { count: packsReady })
            }
            chevron
            onPress={() => router.push("/(tabs)/packs")}
          />
          <ListRow
            icon={Layers}
            title={t("home.myCards")}
            meta={t("home.myCardsHint")}
            chevron
            onPress={() => router.push("/(tabs)/collection")}
          />
          <ListRow
            icon={Swords}
            iconTone="accent"
            title={t("home.pvp")}
            meta={
              liveMatches == null || liveMatches === 0
                ? t("home.pvpHint")
                : liveMatches === 1
                  ? t("home.liveMatchesOne")
                  : t("home.liveMatchesMany", { count: liveMatches })
            }
            chevron
            divider={false}
            onPress={() => router.push("/(tabs)/pvp")}
          />
        </Card>

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
              onScroll={handleFeaturedScroll}
              scrollEventThrottle={32}
              contentContainerStyle={{
                gap: FEATURED_CARD_GAP,
                paddingBottom: 4,
                paddingLeft: 16,
                paddingRight: 16 }}
              showsHorizontalScrollIndicator={false}
            />

            {featuredCount > 1 ? (
              <View
                className="flex-row items-center justify-center gap-[6px]"
                testID="home-featured-dots"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {featuredCards.map((item, index) => (
                  <View
                    key={item.card.id}
                    className={
                      index === featuredPage
                        ? "h-[6px] w-[18px] rounded-ds-pill bg-primary"
                        : "h-[6px] w-[6px] rounded-ds-pill bg-primaryBorder"
                    }
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ height: bottomTabPadding }} />
      </View>
    </ScrollView>
  );
}
