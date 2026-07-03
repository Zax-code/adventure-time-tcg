import { useState, useCallback, useMemo, useRef } from "react";
import {
  Platform,
  ScrollView,
  Text,
  View,
  useWindowDimensions } from "react-native";
import { useSharedValue, withTiming } from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type {
  CollectionResponse,
  HomeResponse } from "@adventure-time/api-client";
import { apiClient } from "../src/lib/api";
import { useCollectionFeedbackStore } from "../src/stores/collection-feedback-store";
import { useSessionStore } from "../src/stores/session-store";
import { useThemeStore } from "../src/stores/theme-store";
import { useTranslation } from "../src/i18n";
import { CardTile } from "../src/components/card-tile";
import {
  CARD_DUST_ACTION_DURATION_MS,
  type CardDustActionAnimationState,
  type CardDustActionType } from "../src/components/card-dust-action-animation-config";
import {
  CardDustActionFrame } from "../src/components/card-dust-action-animation";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../src/components/keyboard-aware-scroll-props";
import { KeyboardScreenView } from "../src/components/keyboard-screen-view";
import { ModalSheetRoute } from "../src/components/modal-sheet-route";
import {
  LoadingPanel,
  PageLoadingState } from "../src/components/loading-state";
import { ThemedExpoButton } from "../src/components/expo-ui/themed-button";
import { ThemedExpoTextInput } from "../src/components/expo-ui/themed-text-input";
import { RARITY_COLORS } from "../src/components/theme";
import { THEME_COLORS } from "../src/theme/themes";
import {
  CheckIcon,
  ChevronDownIcon,
  CraftIcon,
  DustIcon,
  GiftHeartIcon,
  RecycleIcon } from "../src/components/icons";
import { ToastBanner } from "../src/components/toast-banner";
import { getDustSacrificeValue, getDustCraftCost } from "../src/lib/dust";
import { asStyle } from "../src/lib/style-object";
import { reactEffect } from "../src/lib/react-primitives";

function estimateCatalogCount(stats: CollectionResponse["stats"]) {
  if (stats.uniqueOwned <= 0 || stats.completionPercentage <= 0) {
    return null;
  }

  return Math.max(
    stats.uniqueOwned,
    Math.round((stats.uniqueOwned * 100) / stats.completionPercentage),
  );
}

function patchCollectionAfterDustAction(
  current: CollectionResponse | undefined,
  cardId: string,
  quantityDelta: number,
  nextDust: number,
): CollectionResponse | undefined {
  if (!current) return current;

  const nextCards = current.cards
    .map((entry) => {
      if (entry.cardId !== cardId) {
        return entry;
      }

      const nextQuantity = Math.max(entry.quantity + quantityDelta, 0);

      return {
        ...entry,
        quantity: nextQuantity,
        obtainedAt:
          nextQuantity > 0 ? entry.obtainedAt ?? new Date().toISOString() : null };
    });

  const totalCards = nextCards.reduce((sum, entry) => sum + entry.quantity, 0);
  const uniqueOwned = nextCards.filter((entry) => entry.quantity > 0).length;
  const estimatedCatalogCount = estimateCatalogCount(current.stats);
  const completionPercentage =
    estimatedCatalogCount && estimatedCatalogCount > 0
      ? Math.round((uniqueOwned / estimatedCatalogCount) * 100)
      : current.stats.completionPercentage;

  return {
    ...current,
    cards: nextCards,
    dust: nextDust,
    stats: {
      totalCards,
      uniqueOwned,
      completionPercentage } };
}

function patchHomeDust(
  current: HomeResponse | undefined,
  nextDust: number,
): HomeResponse | undefined {
  if (!current) return current;

  return {
    ...current,
    user: {
      ...current.user,
      dust: nextDust } };
}

const DUST_ACTION_SCROLL_DELAY_MS = 420;
const DUST_ACTION_SCROLL_THRESHOLD = 48;

function triggerDustActionHaptic(type: CardDustActionType) {
  if (Platform.OS !== "ios") {
    return;
  }

  if (type === "craft") {
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => null);
    return;
  }

  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
    () => null,
  );
}

export default function CollectionCardDetailScreen() {
  return useCollectionCardDetailScreenView();
}

function useCollectionCardDetailScreenView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ cardId?: string }>();
  const accessToken = useSessionStore((state) => state.accessToken);
  const currentUserId = useSessionStore((state) => state.user?.id);
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const publishCollectionFeedback = useCollectionFeedbackStore(
    (state) => state.publish,
  );

  const [recycleExpanded, setRecycleExpanded] = useState(false);
  const [giftExpanded, setGiftExpanded] = useState(false);
  const [recycleQuantity, setRecycleQuantity] = useState(1);
  const [recycleError, setRecycleError] = useState("");
  const [craftError, setCraftError] = useState("");
  const [giftError, setGiftError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [dustActionAnimation, setDustActionAnimation] =
    useState<CardDustActionAnimationState | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const toastAnim = useSharedValue(-60);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollOffsetYRef = useRef(0);
  const dustActionTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const waitForDustActionDelay = useCallback(
    (duration: number) =>
      new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          dustActionTimeoutsRef.current =
            dustActionTimeoutsRef.current.filter((item) => item !== timeout);
          resolve();
        }, duration);

        dustActionTimeoutsRef.current.push(timeout);
      }),
    [],
  );

  const scrollCardIntoViewBeforeDustAction = useCallback(async () => {
    if (scrollOffsetYRef.current <= DUST_ACTION_SCROLL_THRESHOLD) {
      return;
    }

    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    await waitForDustActionDelay(DUST_ACTION_SCROLL_DELAY_MS);
  }, [waitForDustActionDelay]);

  const runDustActionAnimation = useCallback(
    (animation: Omit<CardDustActionAnimationState, "id">) =>
      new Promise<void>((resolve) => {
        const id = Date.now();
        const duration = CARD_DUST_ACTION_DURATION_MS[animation.type];
        void waitForDustActionDelay(duration).then(() => {
          setDustActionAnimation((current) =>
            current?.id === id ? null : current,
          );
          resolve();
        });

        setDustActionAnimation({ ...animation, id });
        triggerDustActionHaptic(animation.type);
      }),
    [waitForDustActionDelay],
  );

  reactEffect(
    () => () => {
      dustActionTimeoutsRef.current.forEach(clearTimeout);
      dustActionTimeoutsRef.current = [];
    },
    [],
  );

  const { data: collectionQueryData, isLoading: collectionQueryIsLoading } = useQuery({
    queryKey: ["collection"],
    queryFn: () => apiClient.collection() });

  const { data: usersQueryData, isLoading: usersQueryIsLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.users(),
    enabled: giftExpanded });

  const entry =
    collectionQueryData?.cards.find((e) => e.cardId === params.cardId) ?? null;

  const dust = collectionQueryData?.dust ?? 0;
  const homeQueryKey = useMemo(() => ["home"] as const, []);
  const collectionQueryKey = useMemo(() => ["collection"] as const, []);

  reactEffect(() => {
    if (!toast) {
      return;
    }

    toastAnim.value = -60;
    toastAnim.value = withTiming(0, { duration: 250 });

    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast, toastAnim]);

  reactEffect(() => {
    setRecycleExpanded(false);
    setGiftExpanded(false);
    setRecycleQuantity(1);
    setRecycleError("");
    setCraftError("");
    setGiftError("");
    setSelectedUserId("");
    setGiftMessage("");
    setUserSearch("");
    setIsBusy(false);
    setToast(null);
    setDustActionAnimation(null);
  }, [params.cardId]);

  const recycleMutation = useMutation({
    mutationFn: ({ cardId, quantity }: { cardId: string; quantity: number }) =>
      apiClient.recycleCard(cardId, quantity),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
    } });

  const craftMutation = useMutation({
    mutationFn: (cardId: string) => apiClient.craftCard(cardId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
    } });

  const sendGiftMutation = useMutation({
    mutationFn: ({
      cardId,
      toUserId,
      message }: {
      cardId: string;
      toUserId: string;
      message?: string;
    }) => apiClient.sendGift({ cardId, toUserId, quantity: 1, message }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["gifts"] }),
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
      ]);
      router.back();
    } });

  const handleRecycle = async () => {
    if (!entry) return;
    setIsBusy(true);
    setRecycleError("");
    try {
      const remainingQuantity = entry.quantity - recycleQuantity;
      const result = await recycleMutation.mutateAsync({
        cardId: entry.cardId,
        quantity: recycleQuantity });
      const recycledCount = result.quantityRecycled ?? recycleQuantity;
      const dustGained =
        result.dustGained ??
        getDustSacrificeValue(entry.card.rarity.name) * recycleQuantity;
      const successMessage = t("collection.detail.recycleSuccess", {
        count: recycledCount,
        dust: dustGained });

      await scrollCardIntoViewBeforeDustAction();
      await runDustActionAnimation({
        type: "recycle",
        disappearCard: remainingQuantity <= 0 });

      queryClient.setQueryData(
        collectionQueryKey,
        (current: CollectionResponse | undefined) =>
          patchCollectionAfterDustAction(
            current,
            result.cardId,
            -recycledCount,
            result.newDustBalance,
          ),
      );
      queryClient.setQueryData(
        homeQueryKey,
        (current: HomeResponse | undefined) =>
          patchHomeDust(current, result.newDustBalance),
      );

      if (remainingQuantity <= 0) {
        publishCollectionFeedback(successMessage);
        router.back();
      } else {
        setIsBusy(false);
        setRecycleExpanded(false);
        setRecycleQuantity(1);
        setToast({
          type: "success",
          message: successMessage });
      }

      void queryClient.invalidateQueries({
        queryKey: collectionQueryKey,
        refetchType: "active" });
      void queryClient.invalidateQueries({
        queryKey: homeQueryKey,
        refetchType: "inactive" });
    } catch (err) {
      setRecycleError(
        err instanceof Error
          ? err.message
          : t("collection.detail.recycleFailed"),
      );
      setIsBusy(false);
    }
  };

  const handleCraft = async () => {
    if (!entry) return;
    setIsBusy(true);
    setCraftError("");
    try {
      const wasOwned = entry.quantity > 0;
      const result = await craftMutation.mutateAsync(entry.cardId);
      const craftedCount = result.quantityCrafted ?? 1;
      const dustSpent =
        result.dustSpent ?? getDustCraftCost(entry.card.rarity.name);
      const successMessage = t("collection.detail.craftSuccess", {
        count: craftedCount,
        dust: dustSpent });

      await scrollCardIntoViewBeforeDustAction();

      queryClient.setQueryData(
        collectionQueryKey,
        (current: CollectionResponse | undefined) =>
          patchCollectionAfterDustAction(
            current,
            result.cardId,
            craftedCount,
            result.newDustBalance,
          ),
      );
      queryClient.setQueryData(
        homeQueryKey,
        (current: HomeResponse | undefined) =>
          patchHomeDust(current, result.newDustBalance),
      );

      await runDustActionAnimation({
        type: "craft",
        revealLockedCard: !wasOwned });

      setIsBusy(false);
      setToast({
        type: "success",
        message: successMessage });

      void queryClient.invalidateQueries({
        queryKey: collectionQueryKey,
        refetchType: "active" });
      void queryClient.invalidateQueries({
        queryKey: homeQueryKey,
        refetchType: "inactive" });
    } catch (err) {
      setCraftError(
        err instanceof Error ? err.message : t("collection.detail.craftFailed"),
      );
      setIsBusy(false);
    }
  };

  const handleSendGift = async () => {
    if (!entry || !selectedUserId) return;
    setIsBusy(true);
    setGiftError("");
    try {
      await sendGiftMutation.mutateAsync({
        cardId: entry.cardId,
        toUserId: selectedUserId,
        message: giftMessage || undefined });
    } catch (err) {
      setGiftError(err instanceof Error ? err.message : "Gift failed");
      setIsBusy(false);
    }
  };

  const otherUsers = (usersQueryData?.users ?? []).filter(
    (u) => u.id !== currentUserId,
  );
  const filteredUsers = otherUsers.filter((u) =>
    u.displayName.toLowerCase().includes(userSearch.toLowerCase()),
  );
  const lockedCard = useMemo(
    () =>
      entry ? (
        <CardTile
          entry={entry}
          size="large"
          isLocked
          accessToken={accessToken}
        />
      ) : null,
    [accessToken, entry],
  );

  if (collectionQueryIsLoading) {
    return (
      <ModalSheetRoute
        onClose={() => {
          if (!isBusy) {
            router.back();
          }
        }}
        sheetBackgroundColor={tc.bg}
        handleColor={tc.muted}
        title={t("pvp.cardDetailsTitle")}
      >
        <KeyboardScreenView>
          <PageLoadingState
            title={t("pvp.cardDetailsTitle")}
            message={t("common.loadingStates.pageBody")}
            icon="sparkles"
          />
        </KeyboardScreenView>
      </ModalSheetRoute>
    );
  }

  const rarityColor = entry
    ? (RARITY_COLORS[entry.card.rarity.name] ?? RARITY_COLORS.Common)
    : RARITY_COLORS.Common;
  const recycleValue = entry
    ? getDustSacrificeValue(entry.card.rarity.name)
    : 0;
  const craftCost = entry ? getDustCraftCost(entry.card.rarity.name) : 0;
  const canCraft = dust >= craftCost;
  const isOwned = (entry?.quantity ?? 0) > 0;
  const selectedUser = otherUsers.find((user) => user.id === selectedUserId);
  const cardStageMaxWidth = Math.max(260, viewportWidth - 32);

  return (
    <ModalSheetRoute
      onClose={() => {
        if (!isBusy) {
          router.back();
        }
      }}
      sheetBackgroundColor={tc.bg}
      handleColor={tc.muted}
      title={t("pvp.cardDetailsTitle")}
      subtitle={t("collection.detail.manageCard")}
    >
      <KeyboardScreenView>
        <View className="flex-1 bg-bg">
          {toast ? (
            <ToastBanner
              message={toast.message}
              type={toast.type}
              translateY={toastAnim}
              successColor={tc.successDark}
              errorColor={tc.dangerDark}
            />
          ) : null}

          {!entry ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-center font-nunito text-fgMuted">
                {t("pvp.cardMissingTitle")}
              </Text>
            </View>
          ) : (
            <ScrollView
              {...KEYBOARD_AWARE_SCROLL_PROPS}
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentInsetAdjustmentBehavior="automatic"
              contentContainerStyle={{
                paddingVertical: 20,
                paddingHorizontal: 16,
                gap: 16,
                paddingBottom: 24 }}
              contentInset={{ bottom: insets.bottom }}
              scrollIndicatorInsets={{ bottom: insets.bottom }}
              onScroll={({ nativeEvent }) => {
                scrollOffsetYRef.current = nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              testID="collection-card-detail-sheet"
            >
              <View
                style={{
                  gap: 16 }}
                testID="collection-card-detail-overview"
              >
                <View className="items-center">
                  <CardDustActionFrame
                    animation={dustActionAnimation}
                    craftColor={tc.secondaryDark}
                    maxWidth={cardStageMaxWidth}
                    recycleColor={tc.successDark}
                    testID="collection-card-detail-card-animation"
                    lockedCard={lockedCard}
                  >
                    <CardTile
                      entry={entry}
                      size="large"
                      accessToken={accessToken}
                      testID="collection-card-detail-card"
                    />
                  </CardDustActionFrame>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 10 }}
                >
                  {[
                    {
                      label: t("collection.detail.ownedCopies"),
                      value: String(entry.quantity),
                      textColor: tc.primaryStrong,
                      backgroundColor: tc.surface,
                      borderColor: tc.primaryBorder },
                    {
                      label: t("collection.detail.dustBalance"),
                      value: String(dust),
                      textColor: tc.secondaryText,
                      backgroundColor: tc.secondaryTint,
                      borderColor: tc.secondaryBorder },
                    {
                      label: t("collection.detail.recycleValue"),
                      value: `+${recycleValue}`,
                      textColor: tc.successText,
                      backgroundColor: tc.successTint,
                      borderColor: tc.successBorder },
                    {
                      label: t("collection.detail.craftCost"),
                      value: `-${craftCost}`,
                      textColor: tc.infoText,
                      backgroundColor: tc.infoTint,
                      borderColor: tc.infoBorder },
                  ].map((metric) => (
                    <View
                      key={metric.label}
                      style={asStyle({
                        width: "47.5%",
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: metric.borderColor,
                        backgroundColor: metric.backgroundColor,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        gap: 4 })}
                    >
                      <Text
                        style={{
                          fontFamily: "Nunito_600SemiBold",
                          fontSize: 12,
                          color: tc.fgMuted }}
                      >
                        {metric.label}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Nunito_800ExtraBold",
                          fontSize: 20,
                          color: metric.textColor }}
                      >
                        {metric.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View
                style={{
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: tc.primaryBorder,
                  backgroundColor: tc.surface,
                  padding: 16,
                  gap: 14,
                  boxShadow: "0px 0px 10px rgba(0, 0, 0, 0.06)" }}
                testID="collection-card-detail-stats"
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: "Nunito_800ExtraBold",
                      color: tc.fg }}
                  >
                    {t("collection.detail.stats")}
                  </Text>
                  <LinearGradient
                    colors={[rarityColor.from, rarityColor.to]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 6 }}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontFamily: "Nunito_800ExtraBold",
                        fontSize: 12 }}
                    >
                      {entry.card.rarity.name.toUpperCase()}
                    </Text>
                  </LinearGradient>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    gap: 10 }}
                >
                  {[
                    {
                      label: "HP",
                      value: isOwned ? String(entry.card.hp) : "??",
                      color: tc.dangerDark,
                      backgroundColor: tc.dangerTint },
                    {
                      label: "ATK",
                      value: isOwned ? String(entry.card.attack) : "??",
                      color: tc.secondaryText,
                      backgroundColor: tc.secondaryTint },
                    {
                      label: "DEF",
                      value: isOwned ? String(entry.card.defense) : "??",
                      color: tc.infoText,
                      backgroundColor: tc.infoTint },
                    {
                      label: "SPD",
                      value: isOwned ? String(entry.card.speed) : "??",
                      color: tc.successText,
                      backgroundColor: tc.successTint },
                  ].map((stat) => (
                    <View
                      key={stat.label}
                      style={{
                        flex: 1,
                        borderRadius: 18,
                        backgroundColor: stat.backgroundColor,
                        paddingVertical: 12,
                        paddingHorizontal: 8,
                        alignItems: "center",
                        gap: 2 }}
                    >
                      <Text
                        style={{
                          fontSize: 20,
                          fontFamily: "Nunito_800ExtraBold",
                          color: stat.color }}
                      >
                        {stat.value}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "Nunito_700Bold",
                          color: tc.fgMuted }}
                      >
                        {stat.label}
                      </Text>
                    </View>
                  ))}
                </View>

                {!isOwned ? (
                  <Text
                    style={{
                      fontSize: 13,
                      lineHeight: 19,
                      fontFamily: "Nunito_600SemiBold",
                      color: tc.fgMuted,
                      textAlign: "center" }}
                  >
                    {t("collection.locked.statsHint")}
                  </Text>
                ) : null}
              </View>

              <View
                style={{
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: tc.secondaryBorder,
                  backgroundColor: tc.secondaryTint,
                  padding: 16,
                  gap: 12,
                  boxShadow: "0px 0px 10px rgba(0, 0, 0, 0.06)" }}
                testID="collection-card-detail-craft"
              >
                <View className="flex-row items-start gap-3">
                  <View
                    style={{
                      height: 42,
                      width: 42,
                      borderRadius: 21,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: tc.secondary }}
                  >
                    <CraftIcon size={18} color={tc.secondaryText} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text
                        style={{
                          fontSize: 16,
                          fontFamily: "Nunito_800ExtraBold",
                          color: tc.secondaryText }}
                      >
                        {t("collection.detail.craft")}
                      </Text>
                      <View
                        style={asStyle({
                          borderRadius: 999,
                          backgroundColor: tc.surface,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderWidth: 1,
                          borderColor: tc.secondaryBorder,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4 })}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontFamily: "Nunito_700Bold",
                            color: tc.secondaryText }}
                        >
                          -{craftCost}
                        </Text>
                        <DustIcon size={12} color={tc.secondaryText} />
                      </View>
                    </View>
                    <Text
                      style={{
                        marginTop: 4,
                        fontSize: 13,
                        lineHeight: 20,
                        fontFamily: "Nunito_400Regular",
                        color: tc.secondaryText }}
                    >
                      {canCraft
                        ? t("collection.detail.craftReadyHint")
                        : t("collection.detail.craftNeedMoreDust", {
                            amount: craftCost - dust })}
                    </Text>
                  </View>
                </View>

                <ThemedExpoButton
                  onPress={() => void handleCraft()}
                  disabled={isBusy || !canCraft}
                  preferFallback
                  fallbackLayout="stretch"
                  fallbackAppearance={{
                    backgroundColor: tc.secondary,
                    borderColor: tc.secondaryDark,
                    borderRadius: 16,
                    foregroundColor: tc.secondaryText,
                    gradientColors: [tc.secondary, tc.secondaryDark],
                    minHeight: 0,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    textStyle: {
                      fontFamily: "Nunito_800ExtraBold",
                      fontSize: 15 } }}
                  style={{
                    width: "100%",
                    opacity: isBusy || !canCraft ? 0.55 : 1 }}
                  testID="collection-card-detail-craft-button"
                  variant="secondary"
                >
                  {t("collection.detail.craft")}
                </ThemedExpoButton>
              </View>

              {isOwned ? (
                <>
                  <View
                    style={{
                      borderRadius: 24,
                      borderWidth: 1,
                      borderColor: tc.successBorder,
                      backgroundColor: tc.successTint,
                      overflow: "hidden",
                      boxShadow: "0px 0px 10px rgba(0, 0, 0, 0.06)" }}
                    testID="collection-card-detail-recycle"
                  >
                    <ThemedExpoButton
                      onPress={() => setRecycleExpanded(!recycleExpanded)}
                      preferFallback
                      fallbackLayout="stretch"
                      fallbackAppearance={{
                        backgroundColor: "transparent",
                        borderColor: "transparent",
                        borderRadius: 0,
                        foregroundColor: tc.successText,
                        gradientColors: null,
                        minHeight: 0,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        textStyle: {
                          fontFamily: "Nunito_800ExtraBold",
                          fontSize: 16 } }}
                      testID="collection-card-detail-recycle-toggle"
                      variant="ghost"
                    >
                      <View
                        style={{
                          width: "100%",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12 }}
                      >
                        <View
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10 }}
                        >
                          <RecycleIcon size={18} color={tc.successText} />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 16,
                                fontFamily: "Nunito_800ExtraBold",
                                color: tc.successText }}
                            >
                              {t("collection.detail.recycle")}
                            </Text>
                            <Text
                              style={{
                                marginTop: 2,
                                fontSize: 12,
                                fontFamily: "Nunito_400Regular",
                                color: tc.successText }}
                            >
                              {t("collection.detail.recycleHint")}
                            </Text>
                          </View>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8 }}
                        >
                          <View
                            style={asStyle({
                              borderRadius: 999,
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              backgroundColor: tc.surface,
                              borderWidth: 1,
                              borderColor: tc.successBorder,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4 })}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontFamily: "Nunito_700Bold",
                                color: tc.successText }}
                            >
                              +{recycleValue}
                            </Text>
                            <DustIcon size={12} color={tc.successText} />
                          </View>
                          <View
                            style={{
                              transform: [
                                { rotate: recycleExpanded ? "180deg" : "0deg" },
                              ] }}
                          >
                            <ChevronDownIcon size={18} color={tc.successText} />
                          </View>
                        </View>
                      </View>
                    </ThemedExpoButton>

                    {recycleExpanded ? (
                      <View
                        style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 10 }}
                        >
                          <View
                            style={asStyle({
                              flex: 1,
                              borderRadius: 16,
                              backgroundColor: tc.surface,
                              borderWidth: 1,
                              borderColor: tc.successBorder,
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              gap: 2 })}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontFamily: "Nunito_600SemiBold",
                                color: tc.fgMuted }}
                            >
                              {t("collection.detail.ownedCopies")}
                            </Text>
                            <Text
                              style={{
                                fontSize: 16,
                                fontFamily: "Nunito_800ExtraBold",
                                color: tc.successText }}
                            >
                              {entry.quantity}
                            </Text>
                          </View>
                          <View
                            style={asStyle({
                              flex: 1,
                              borderRadius: 16,
                              backgroundColor: tc.surface,
                              borderWidth: 1,
                              borderColor: tc.successBorder,
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              gap: 2 })}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontFamily: "Nunito_600SemiBold",
                                color: tc.fgMuted }}
                            >
                              {t("collection.detail.recycleValue")}
                            </Text>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4 }}
                            >
                              <Text
                                style={{
                                  fontSize: 16,
                                  fontFamily: "Nunito_800ExtraBold",
                                  color: tc.successText }}
                              >
                                +{recycleValue * recycleQuantity}
                              </Text>
                              <DustIcon size={13} color={tc.successText} />
                            </View>
                          </View>
                        </View>

                        <View
                          style={{
                            borderRadius: 18,
                            backgroundColor: tc.surface,
                            borderWidth: 1,
                            borderColor: tc.successBorder,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            gap: 8 }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontFamily: "Nunito_600SemiBold",
                              color: tc.fgMuted }}
                          >
                            {t("collection.detail.recycleCount")}
                          </Text>
                          {entry.quantity > 1 ? (
                            <View
                              className="flex-row items-center justify-center"
                              style={{ gap: 12 }}
                            >
                              <ThemedExpoButton
                                onPress={() =>
                                  setRecycleQuantity(Math.max(1, recycleQuantity - 1))
                                }
                                label="−"
                                preferFallback
                                fallbackAppearance={{
                                  backgroundColor: tc.surface,
                                  borderColor: tc.successBorder,
                                  borderRadius: 18,
                                  foregroundColor: tc.successText,
                                  gradientColors: null,
                                  minHeight: 0,
                                  paddingHorizontal: 0,
                                  paddingVertical: 0,
                                  textStyle: {
                                    fontFamily: "Nunito_800ExtraBold",
                                    fontSize: 22 } }}
                                style={{ width: 42, height: 42 }}
                                testID="collection-card-detail-recycle-minus"
                                variant="ghost"
                              />
                              <View
                                style={asStyle({
                                  minWidth: 110,
                                  borderRadius: 18,
                                  backgroundColor: tc.successTint,
                                  borderWidth: 1,
                                  borderColor: tc.successBorder,
                                  paddingHorizontal: 16,
                                  paddingVertical: 10,
                                  alignItems: "center" })}
                              >
                                <Text
                                  style={{
                                    fontSize: 18,
                                    fontFamily: "Nunito_800ExtraBold",
                                    color: tc.successText }}
                                >
                                  {recycleQuantity}
                                </Text>
                              </View>
                              <ThemedExpoButton
                                onPress={() =>
                                  setRecycleQuantity(
                                    Math.min(entry.quantity, recycleQuantity + 1),
                                  )
                                }
                                label="+"
                                preferFallback
                                fallbackAppearance={{
                                  backgroundColor: tc.surface,
                                  borderColor: tc.successBorder,
                                  borderRadius: 18,
                                  foregroundColor: tc.successText,
                                  gradientColors: null,
                                  minHeight: 0,
                                  paddingHorizontal: 0,
                                  paddingVertical: 0,
                                  textStyle: {
                                    fontFamily: "Nunito_800ExtraBold",
                                    fontSize: 22 } }}
                                style={{ width: 42, height: 42 }}
                                testID="collection-card-detail-recycle-plus"
                                variant="ghost"
                              />
                            </View>
                          ) : (
                            <Text
                              style={{
                                fontSize: 18,
                                fontFamily: "Nunito_800ExtraBold",
                                color: tc.successText,
                                textAlign: "center" }}
                            >
                              1
                            </Text>
                          )}
                        </View>

                        <ThemedExpoButton
                          onPress={() => void handleRecycle()}
                          disabled={isBusy}
                          preferFallback
                          fallbackLayout="stretch"
                          fallbackAppearance={{
                            backgroundColor: tc.successDark,
                            borderColor: tc.successDark,
                            borderRadius: 16,
                            foregroundColor: "#FFFFFF",
                            gradientColors: [tc.success, tc.successDark],
                            minHeight: 0,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            textStyle: {
                              fontFamily: "Nunito_800ExtraBold",
                              fontSize: 15 } }}
                          style={{
                            width: "100%",
                            opacity: isBusy ? 0.6 : 1 }}
                          testID="collection-card-detail-recycle-button"
                          variant="primary"
                        >
                          {isBusy ? (
                            t("collection.detail.recycling")
                          ) : (
                            t("collection.detail.confirmRecycle", {
                              amount: recycleValue * recycleQuantity })
                          )}
                        </ThemedExpoButton>
                      </View>
                    ) : null}
                  </View>

                  <View
                    style={{
                      borderRadius: 24,
                      borderWidth: 1,
                      borderColor: tc.infoBorder,
                      backgroundColor: tc.infoTint,
                      overflow: "hidden",
                      boxShadow: "0px 0px 10px rgba(0, 0, 0, 0.06)" }}
                    testID="collection-card-detail-gift"
                  >
                    <ThemedExpoButton
                      onPress={() => setGiftExpanded(!giftExpanded)}
                      preferFallback
                      fallbackLayout="stretch"
                      fallbackAppearance={{
                        backgroundColor: "transparent",
                        borderColor: "transparent",
                        borderRadius: 0,
                        foregroundColor: tc.infoText,
                        gradientColors: null,
                        minHeight: 0,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        textStyle: {
                          fontFamily: "Nunito_800ExtraBold",
                          fontSize: 16 } }}
                      testID="collection-card-detail-gift-toggle"
                      variant="ghost"
                    >
                      <View
                        style={{
                          width: "100%",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12 }}
                      >
                        <View
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10 }}
                        >
                          <GiftHeartIcon size={18} color={tc.infoText} />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 16,
                                fontFamily: "Nunito_800ExtraBold",
                                color: tc.infoText }}
                            >
                              {t("gifts.sendGift")}
                            </Text>
                            <Text
                              style={{
                                marginTop: 2,
                                fontSize: 12,
                                fontFamily: "Nunito_400Regular",
                                color: tc.infoText }}
                            >
                              {selectedUser
                                ? t("collection.detail.selectedRecipient", {
                                    name: selectedUser.displayName })
                                : t("collection.detail.giftHint")}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8 }}
                        >
                          {selectedUser ? (
                            <View
                              style={asStyle({
                                height: 24,
                                width: 24,
                                borderRadius: 12,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: tc.surface,
                                borderWidth: 1,
                                borderColor: tc.infoBorder })}
                            >
                              <CheckIcon size={14} color={tc.infoText} />
                            </View>
                          ) : null}
                          <View
                            style={{
                              transform: [
                                { rotate: giftExpanded ? "180deg" : "0deg" },
                              ] }}
                          >
                            <ChevronDownIcon size={18} color={tc.infoText} />
                          </View>
                        </View>
                      </View>
                    </ThemedExpoButton>

                    {giftExpanded ? (
                      <View
                        style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}
                      >
                        <View style={{ gap: 6 }}>
                          <Text
                            style={{
                              fontSize: 12,
                              fontFamily: "Nunito_700Bold",
                              color: tc.infoText }}
                          >
                            {t("gifts.giftTo")}
                          </Text>
                          <ThemedExpoTextInput
                            value={userSearch}
                            onChangeText={setUserSearch}
                            placeholder={t(
                              "collection.gift.searchPlayersPlaceholder",
                            )}
                            hostStyle={{ width: "100%" }}
                            style={{
                              backgroundColor: tc.surface,
                              borderRadius: 14,
                              borderWidth: 1,
                              borderColor: tc.infoBorder,
                              height: 46,
                              paddingHorizontal: 12,
                              width: "100%" }}
                            textStyle={{
                              color: tc.fg,
                              fontFamily: "Nunito_400Regular",
                              fontSize: 14 }}
                          />
                        </View>

                        <ScrollView
                          style={{
                            maxHeight: 180,
                            backgroundColor: tc.surface,
                            borderRadius: 18,
                            borderWidth: 1,
                            borderColor: tc.infoBorder }}
                          nestedScrollEnabled
                          keyboardShouldPersistTaps="handled"
                          testID="collection-card-detail-gift-user-list"
                        >
                          {usersQueryIsLoading ? (
                            <View style={{ padding: 12 }}>
                              <LoadingPanel
                                title={t("gifts.users")}
                                message={t("common.loadingStates.sectionBody")}
                                icon="people"
                              />
                            </View>
                          ) : filteredUsers.length === 0 ? (
                            <Text
                              style={{
                                fontFamily: "Nunito_400Regular",
                                fontSize: 13,
                                color: tc.fgMuted,
                                textAlign: "center",
                                padding: 12 }}
                            >
                              {t("collection.gift.noPlayersFound")}
                            </Text>
                          ) : (
                            <View style={{ padding: 8, gap: 6 }}>
                              {filteredUsers.map((user) => {
                                const isSelected = selectedUserId === user.id;

                                return (
                                  <ThemedExpoButton
                                    key={user.id}
                                    onPress={() => setSelectedUserId(user.id)}
                                    preferFallback
                                    fallbackLayout="stretch"
                                    fallbackAppearance={{
                                      backgroundColor: isSelected
                                        ? tc.primaryTint
                                        : tc.surface,
                                      borderColor: isSelected
                                        ? tc.primaryBorder
                                        : tc.infoBorder,
                                      borderRadius: 14,
                                      foregroundColor: tc.fg,
                                      gradientColors: null,
                                      minHeight: 0,
                                      paddingHorizontal: 12,
                                      paddingVertical: 10,
                                      textStyle: {
                                        fontFamily: isSelected
                                          ? "Nunito_700Bold"
                                          : "Nunito_600SemiBold",
                                        fontSize: 14 } }}
                                    testID={`collection-card-detail-gift-user-${user.id}`}
                                    variant="ghost"
                                  >
                                    <Text
                                      style={{
                                        flex: 1,
                                        fontFamily: isSelected
                                          ? "Nunito_700Bold"
                                          : "Nunito_600SemiBold",
                                        fontSize: 14,
                                        color: tc.fg }}
                                    >
                                      {user.displayName}
                                    </Text>
                                    {isSelected ? (
                                      <CheckIcon size={16} color={tc.primaryText} />
                                    ) : null}
                                  </ThemedExpoButton>
                                );
                              })}
                            </View>
                          )}
                        </ScrollView>

                        <ThemedExpoTextInput
                          value={giftMessage}
                          onChangeText={setGiftMessage}
                          placeholder={t(
                            "collection.gift.messageOptionalPlaceholder",
                          )}
                          hostStyle={{ width: "100%" }}
                          style={{
                            backgroundColor: tc.surface,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: tc.infoBorder,
                            height: 46,
                            paddingHorizontal: 12,
                            width: "100%" }}
                          textStyle={{
                            color: tc.fg,
                            fontFamily: "Nunito_400Regular",
                            fontSize: 14 }}
                        />

                        <ThemedExpoButton
                          onPress={() => void handleSendGift()}
                          disabled={isBusy || !selectedUserId}
                          preferFallback
                          fallbackLayout="stretch"
                          fallbackAppearance={{
                            backgroundColor: tc.infoDark,
                            borderColor: tc.infoDark,
                            borderRadius: 16,
                            foregroundColor: "#FFFFFF",
                            gradientColors: [tc.info, tc.infoDark],
                            minHeight: 0,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            textStyle: {
                              fontFamily: "Nunito_800ExtraBold",
                              fontSize: 15 } }}
                          style={{
                            width: "100%",
                            opacity: isBusy || !selectedUserId ? 0.55 : 1 }}
                          testID="collection-card-detail-gift-send"
                          variant="secondary"
                        >
                          {isBusy
                            ? t("collection.gift.sending")
                            : t("gifts.sendGiftButton")}
                        </ThemedExpoButton>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : (
                <View
                  style={{
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: tc.infoBorder,
                    backgroundColor: tc.infoTint,
                    paddingHorizontal: 14,
                    paddingVertical: 12 }}
                >
                  <Text
                    style={{
                      color: tc.infoText,
                      fontFamily: "Nunito_600SemiBold",
                      fontSize: 13,
                      lineHeight: 19,
                      textAlign: "center" }}
                  >
                    {t("collection.detail.craftFirstHint")}
                  </Text>
                </View>
              )}

              {recycleError || craftError || giftError ? (
                <View
                  style={{
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: tc.dangerBorder,
                    backgroundColor: tc.dangerTint,
                    paddingHorizontal: 14,
                    paddingVertical: 12 }}
                >
                  <Text
                    style={{
                      color: tc.dangerText,
                      fontFamily: "Nunito_600SemiBold",
                      fontSize: 13,
                      textAlign: "center" }}
                  >
                    {recycleError || craftError || giftError}
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          )}
        </View>
      </KeyboardScreenView>
    </ModalSheetRoute>
  );
}
