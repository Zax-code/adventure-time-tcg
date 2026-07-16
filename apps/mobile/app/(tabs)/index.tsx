import { useState, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";
import {
  AppState,
  FlatList,
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
import { useThemeStore } from "../../src/stores/theme-store";
import {
  useAppHeaderHeight,
  useBottomTabBarContentPadding } from "../../src/theme/layout";
import { THEME_COLORS } from "../../src/theme/themes";
import {
  GhostButton,
  PrimaryButton,
  SecondaryButton } from "../../src/components/button";
import { CardTile } from "../../src/components/card-tile";
import {
  CardsIcon,
  ChevronRightIcon,
  ClockIcon,
  DailyLoginQuestIcon,
  PackIcon } from "../../src/components/icons";
import { PageErrorState } from "../../src/components/error-state";
import { PageLoadingState } from "../../src/components/loading-state";
import { useTranslation } from "../../src/i18n";
import { reactEffect } from "../../src/lib/react-primitives";

const styles = StyleSheet.create({
  featuredCardFrame: {
    width: 144 } });

function formatTimeRemaining(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

function NotificationSettingsButton({
  color,
  label,
  onPress }: {
  color: string;
  label: string;
  onPress: () => void;
}) {
  const leadingAccessory = useMemo(
    () => <Ionicons name="settings-outline" size={16} color={color} />,
    [color],
  );

  return (
    <SecondaryButton
      onPress={onPress}
      leadingAccessory={leadingAccessory}
      style={{ flex: 1 }}
    >
      {label}
    </SecondaryButton>
  );
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
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
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

  const [liveTime, setLiveTime] = useState(0);
  const [notificationPromptIgnored, setNotificationPromptIgnored] =
    useState(false);
  const [notificationPromptHidden, setNotificationPromptHidden] =
    useState(false);

  reactEffect(() => {
    setLiveTime(dailyClaimQueryData?.timeUntilNextClaim ?? 0);
  }, [dailyClaimQueryData]);

  reactEffect(() => {
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

  reactEffect(() => {
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
      <View className="gap-5 px-5" style={{ paddingTop: headerHeight }}>
        {shouldShowNotificationPrompt ? (
          <View className="rounded-2xl border border-primaryBorder bg-surface px-4 py-4">
            <View className="flex-row items-center gap-3">
              <View
                className="h-10 w-10 items-center justify-center rounded-2xl"
                style={{ backgroundColor: tc.primaryTint }}
              >
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color={tc.primaryText}
                />
              </View>
              <View className="flex-1 gap-1 pr-1">
                <Text className="font-nunito-bold text-base text-fg">
                  {t("home.notificationsPromptTitle")}
                </Text>
                <Text className="font-nunito text-sm leading-5 text-fgMuted">
                  {t("home.notificationsPromptBody")}
                </Text>
              </View>
            </View>

            <View className="mt-3 flex-row gap-2">
              <NotificationSettingsButton
                onPress={() => {
                  router.push({
                    pathname: "/settings",
                    params: { section: "notifications" } });
                }}
                color={tc.secondaryText}
                label={t("home.notificationsPromptSettings")}
              />

              <GhostButton
                onPress={() => {
                  setNotificationPromptIgnored(true);
                }}
              >
                {t("home.notificationsPromptIgnore")}
              </GhostButton>
            </View>

            <Pressable
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
              className="mt-3 self-start"
              hitSlop={8}
            >
              <Text className="font-nunito-semibold text-xs text-fgMuted">
                {t("home.notificationsPromptHide")}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View
          style={{
            backgroundColor: tc.surface,
            borderColor: tc.primaryBorder,
            borderRadius: 24,
            borderWidth: 1 }}
        >
          <View className="gap-4 px-5 py-5">
            <View className="flex-row items-start justify-between gap-4">
              <View className="flex-1 gap-1">
                <Text className="font-nunito-semibold text-sm uppercase text-primaryText">
                  {t("home.todayStatus")}
                </Text>
                <Text className="font-nunito-extrabold text-2xl leading-8 text-fg">
                  {canClaim ? t("home.rewardReady") : t("home.rewardClaimed")}
                </Text>
                <Text className="font-nunito text-sm leading-5 text-fgMuted">
                  {canClaim
                    ? t("home.claimCoins", {
                        amount: dailyClaimQueryData?.dailyReward ?? 50 })
                    : t("home.nextClaim", {
                        time: formatTimeRemaining(liveTime) })}
                </Text>
              </View>

              <View
                className="h-14 w-14 items-center justify-center rounded-3xl border"
                style={{
                  backgroundColor: canClaim ? tc.secondaryTint : tc.infoTint,
                  borderColor: canClaim ? tc.secondaryBorder : tc.infoBorder }}
              >
                {canClaim ? (
                  <DailyLoginQuestIcon size={28} color={tc.secondaryText} />
                ) : (
                  <ClockIcon size={28} color={tc.infoText} />
                )}
              </View>
            </View>

            <PrimaryButton
              onPress={() => claimMutation.mutate()}
              disabled={!canClaim || claimMutation.isPending}
              loading={claimMutation.isPending}
              fallbackAppearance={{
                backgroundColor: tc.primaryDark,
                borderColor: tc.primaryDark,
                borderRadius: 999,
                gradientColors: null,
                foregroundColor: "#FFFFFF",
                paddingHorizontal: 18,
                paddingVertical: 12,
                textStyle: {
                  fontFamily: "Nunito_700Bold",
                  fontSize: 15 } }}
              style={{ alignSelf: "stretch" }}
            >
              {canClaim ? t("home.claim") : t("home.claimed")}
            </PrimaryButton>
          </View>
        </View>

        <View className="rounded-3xl border border-primaryBorder bg-surface px-5 py-5">
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1 gap-1">
              <Text className="font-nunito-bold text-lg text-fg">
                {t("home.collectionProgress")}
              </Text>
              <Text className="font-nunito text-sm leading-5 text-fgMuted">
                {t("home.cardsCollected", {
                  owned: home.collectionStats.uniqueOwned,
                  total: home.collectionStats.totalCards })}
              </Text>
            </View>

            <View
              className="rounded-2xl px-3 py-2"
              style={{ backgroundColor: tc.primaryTint }}
            >
              <Text className="font-nunito-extrabold text-lg text-primaryStrong">
                {collectionPercent}%
              </Text>
            </View>
          </View>

          <View className="mt-4 h-3 overflow-hidden rounded-full bg-primaryTint">
            <View
              style={{
                backgroundColor: tc.primaryDark,
                width: `${collectionPercent}%`,
                height: "100%",
                borderRadius: 999 }}
            />
          </View>

          <View className="mt-4 flex-row gap-3">
            <View
              className="flex-1 rounded-2xl border px-4 py-3"
              style={{
                backgroundColor: tc.secondaryTint,
                borderColor: tc.secondaryBorder }}
            >
              <Text className="font-nunito-extrabold text-xl text-secondaryText">
                {home.collectionStats.uniqueOwned}
              </Text>
              <Text className="font-nunito text-xs text-secondaryText">
                {t("home.uniqueCards")}
              </Text>
            </View>
            <View
              className="flex-1 rounded-2xl border px-4 py-3"
              style={{
                backgroundColor: tc.accentTint,
                borderColor: tc.accentBorder }}
            >
              <Text className="font-nunito-extrabold text-xl text-accentText">
                {cardsRemaining}
              </Text>
              <Text className="font-nunito text-xs text-accentText">
                {t("home.cardsRemaining")}
              </Text>
            </View>
          </View>
        </View>

        <View className="gap-3">
          <Text className="font-nunito-bold text-lg text-fg">
            {t("home.quickActions")}
          </Text>

          <Pressable
            onPress={() => router.push("/(tabs)/packs")}
            className="rounded-3xl border border-secondaryBorder bg-surface px-4 py-4"
          >
            <View className="flex-row items-center gap-3">
              <View
                className="h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: tc.secondaryTint }}
              >
                <PackIcon size={26} color={tc.secondaryText} />
              </View>
              <View className="flex-1 gap-1">
                <Text className="font-nunito-bold text-base text-fg">
                  {t("home.openPack")}
                </Text>
                <Text className="font-nunito text-sm leading-5 text-fgMuted">
                  {t("home.openPackHint")}
                </Text>
              </View>
              <ChevronRightIcon size={22} color={tc.primaryText} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(tabs)/collection")}
            className="rounded-3xl border border-primaryBorder bg-surface px-4 py-4"
          >
            <View className="flex-row items-center gap-3">
              <View
                className="h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: tc.primaryTint }}
              >
                <CardsIcon size={26} color={tc.primaryText} />
              </View>
              <View className="flex-1 gap-1">
                <Text className="font-nunito-bold text-base text-fg">
                  {t("home.myCards")}
                </Text>
                <Text className="font-nunito text-sm leading-5 text-fgMuted">
                  {t("home.myCardsHint")}
                </Text>
              </View>
              <ChevronRightIcon size={22} color={tc.primaryText} />
            </View>
          </Pressable>
        </View>

        {rarities.length > 0 ? (
          <View className="gap-3 rounded-3xl border border-primaryBorder bg-surface px-5 py-5">
            <View className="gap-1">
              <Text className="font-nunito-bold text-lg text-fg">
                {t("home.dropRates")}
              </Text>
              <Text className="font-nunito text-sm leading-5 text-fgMuted">
                {t("home.dropRatesHint")}
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
              {rarities.map((rarity) => (
                <View
                  key={rarity.id}
                  className="rounded-2xl border px-3 py-2"
                  style={{
                    backgroundColor: tc.surfaceMuted,
                    borderColor: rarity.color,
                    minHeight: 56,
                    width: "48%" }}
                >
                  <View className="flex-row items-center justify-between gap-2">
                    <Text
                      className="flex-1 font-nunito-extrabold text-sm"
                      style={{ color: rarity.color }}
                      numberOfLines={1}
                    >
                      {rarity.name}
                    </Text>
                    <Text className="font-nunito-bold text-xs text-fgMuted">
                      {formatDropRatePercentage(rarity.dropRate)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {featuredCards.length > 0 ? (
          <View className="-mx-5 gap-3">
            <View className="gap-1 px-5">
              <Text className="font-nunito-bold text-lg text-fg">
                {t("home.featuredCards")}
              </Text>
              <Text className="font-nunito text-sm leading-5 text-fgMuted">
                {t("home.featuredHint")}
              </Text>
            </View>

            <FlatList
              horizontal
              data={featuredCards}
              keyExtractor={(item) => item.card.id}
              renderItem={renderFeaturedCard}
              contentContainerStyle={{
                gap: 12,
                paddingBottom: 4,
                paddingLeft: 20,
                paddingRight: 20 }}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        ) : null}

        <View style={{ height: bottomTabPadding }} />
      </View>
    </ScrollView>
  );
}
