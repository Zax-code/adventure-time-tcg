import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CollectionResponse } from "@adventure-time/api-client";

import { apiClient } from "../src/lib/api";
import { localizeTypeName } from "../src/lib/combat-i18n";
import { getCardImageCacheKey, getCardImageUrl } from "../src/lib/card-images";
import {
  KEYBOARD_AWARE_SCROLL_PROPS,
  KeyboardScreenView,
} from "../src/components/keyboard-screen-view";
import { ThemedExpoButton } from "../src/components/expo-ui/themed-button";
import { ThemedExpoTextInput } from "../src/components/expo-ui/themed-text-input";
import { useTranslation } from "../src/i18n";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS } from "../src/theme/themes";
import { CARD_TYPE_COLORS, RARITY_COLORS } from "../src/components/theme";
import {
  CardsIcon,
  CheckIcon,
  ChevronRightIcon,
  SwordsIcon,
  XIcon,
} from "../src/components/icons";
import { PageErrorState } from "../src/components/error-state";
import { PageLoadingState } from "../src/components/loading-state";

type CollectionEntry = CollectionResponse["cards"][number];
type BuilderCard = CollectionEntry["card"];

const LOADOUT_TYPES = [
  "all",
  "Hero",
  "Tech",
  "Royalty",
  "Candy",
  "Undead",
  "Ice",
  "Fire",
  "Magic",
  "Demon",
  "Cosmic",
] as const;

function BuilderCardPressable({
  className,
  onPress,
  onLongPress,
  style,
  testID,
  children,
}: {
  className?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
  testID?: string;
  children: ReactNode;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <Pressable
      testID={testID}
      className={className}
      style={style}
      onPressIn={() => {
        longPressTriggeredRef.current = false;
        if (!onLongPress) {
          return;
        }
        timerRef.current = setTimeout(() => {
          longPressTriggeredRef.current = true;
          onLongPress();
        }, 400);
      }}
      onPressOut={clearTimer}
      onPress={() => {
        if (!longPressTriggeredRef.current) {
          onPress?.();
        }
        longPressTriggeredRef.current = false;
      }}
    >
      {children}
    </Pressable>
  );
}

function InfoPill({
  label,
  backgroundColor,
  borderColor,
  textColor,
}: {
  label: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}) {
  return (
    <View
      className="rounded-full border px-3 py-2"
      style={{ backgroundColor, borderColor }}
    >
      <Text
        className="font-nunito-bold text-xs"
        style={{ color: textColor }}
      >
        {label}
      </Text>
    </View>
  );
}

function CompactStat({
  label,
  value,
  backgroundColor,
  textColor,
}: {
  label: string;
  value: number;
  backgroundColor: string;
  textColor: string;
}) {
  return (
    <View
      className="flex-1 rounded-2xl p-2"
      style={{ backgroundColor }}
    >
      <Text
        className="text-center font-nunito-extrabold text-sm"
        style={{ color: textColor, fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
      <Text
        className="mt-0.5 text-center font-nunito-bold text-[10px]"
        style={{ color: textColor }}
      >
        {label}
      </Text>
    </View>
  );
}

function LoadoutSlotCard({
  card,
  index,
  label,
  borderColor,
  emptyBackgroundColor,
  emptyBorderColor,
  emptyTextColor,
  badgeColor,
  onLongPress,
  onMoveBack,
  onMoveForward,
  onRemove,
  canMoveBack,
  canMoveForward,
}: {
  card?: BuilderCard;
  index: number;
  label: string;
  borderColor: string;
  emptyBackgroundColor: string;
  emptyBorderColor: string;
  emptyTextColor: string;
  badgeColor: string;
  onLongPress: () => void;
  onMoveBack: () => void;
  onMoveForward: () => void;
  onRemove: () => void;
  canMoveBack: boolean;
  canMoveForward: boolean;
}) {
  return (
    <View
      testID={`pvp-loadout-slot-${index}`}
      className="gap-2"
      style={{ width: "31.5%" }}
    >
      <Text
        className="font-nunito-bold text-xs"
        style={{ color: badgeColor }}
        numberOfLines={1}
      >
        {label}
      </Text>

      <View
        className="relative overflow-hidden rounded-[22px] border"
        style={{
          aspectRatio: 0.72,
          backgroundColor: card ? "#FFFFFF" : emptyBackgroundColor,
          borderColor: card ? borderColor : emptyBorderColor,
          borderWidth: card ? 1.5 : 1,
        }}
      >
        {card ? (
          <>
            <BuilderCardPressable
              className="h-full w-full"
              onLongPress={onLongPress}
            >
              {card.imageAssetId ? (
                <Image
                  source={{
                    uri: getCardImageUrl(card.imageAssetId),
                    cacheKey: getCardImageCacheKey(card.imageAssetId),
                  }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <View className="h-full w-full items-center justify-center bg-primaryTint">
                  <Text className="font-nunito-extrabold text-4xl text-primaryDark">
                    {(card.character || card.name || "?").charAt(0)}
                  </Text>
                </View>
              )}
            </BuilderCardPressable>

            <View
              className="absolute left-2 top-2 rounded-full px-2 py-1"
              style={{ backgroundColor: `${badgeColor}E6` }}
            >
              <Text className="font-nunito-bold text-[10px] text-white">
                #{index + 1}
              </Text>
            </View>

            <Pressable
              onPress={onRemove}
              className="absolute right-2 top-2 size-7 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.88)" }}
            >
              <XIcon size={12} color={badgeColor} />
            </Pressable>

            <LinearGradient
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.88)"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                paddingHorizontal: 8,
                paddingBottom: 8,
                paddingTop: 24,
              }}
            >
              <Text
                className="font-nunito-bold text-[11px] text-white"
                numberOfLines={2}
              >
                {card.name}
              </Text>
              <View className="mt-2 flex-row items-center justify-between">
                <Pressable
                  onPress={onMoveBack}
                  disabled={!canMoveBack}
                  className="rounded-full px-2.5 py-1"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.9)",
                    opacity: canMoveBack ? 1 : 0.35,
                  }}
                  hitSlop={6}
                  accessibilityLabel={`${label} move left`}
                >
                  <Text
                    className="font-nunito-bold text-[10px]"
                    style={{ color: badgeColor }}
                  >
                    {"<"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onMoveForward}
                  disabled={!canMoveForward}
                  className="rounded-full px-2.5 py-1"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.9)",
                    opacity: canMoveForward ? 1 : 0.35,
                  }}
                  hitSlop={6}
                  accessibilityLabel={`${label} move right`}
                >
                  <Text
                    className="font-nunito-bold text-[10px]"
                    style={{ color: badgeColor }}
                  >
                    {">"}
                  </Text>
                </Pressable>
              </View>
            </LinearGradient>
          </>
        ) : (
          <View className="flex-1 items-center justify-center px-3">
            <Text
              className="text-center font-nunito-bold text-sm"
              style={{ color: emptyTextColor }}
            >
              {label}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function PvpLoadoutsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];

  const [loadoutName, setLoadoutName] = useState("");
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [editingLoadoutId, setEditingLoadoutId] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof LOADOUT_TYPES)[number]>("all");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const collectionQuery = useQuery({
    queryKey: ["collection"],
    queryFn: () => apiClient.collection(),
  });
  const loadoutsQuery = useQuery({
    queryKey: ["pvp-loadouts"],
    queryFn: () => apiClient.pvpLoadouts(),
  });

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const ownedCards = collectionQuery.data?.cards ?? [];
  const loadouts = loadoutsQuery.data?.loadouts ?? [];

  const cardMap = useMemo(() => {
    return new Map(ownedCards.map((entry) => [entry.cardId, entry.card]));
  }, [ownedCards]);

  const editingLoadout = useMemo(
    () => loadouts.find((loadout) => loadout.id === editingLoadoutId) ?? null,
    [editingLoadoutId, loadouts],
  );

  const selectedCards = useMemo(
    () =>
      selectedCardIds.flatMap((id) => {
        const card = cardMap.get(id);
        return card ? [card] : [];
      }),
    [cardMap, selectedCardIds],
  );
  const selectedCardIndexMap = useMemo(
    () => new Map(selectedCardIds.map((cardId, index) => [cardId, index])),
    [selectedCardIds],
  );

  const rarityCounts = selectedCards.reduce(
    (acc, card) => {
      if (card.rarity.name === "Legendary") acc.legendary += 1;
      if (card.rarity.name === "Epic") acc.epic += 1;
      return acc;
    },
    { legendary: 0, epic: 0 },
  );

  const filteredCollection = useMemo(() => {
    const filtered = ownedCards.filter((entry) => {
      if (filter === "all") {
        return true;
      }
      return entry.card.type === filter;
    });

    return [...filtered].sort((left, right) => {
      const leftIndex = selectedCardIndexMap.get(left.card.id);
      const rightIndex = selectedCardIndexMap.get(right.card.id);

      if (leftIndex != null && rightIndex != null) {
        return leftIndex - rightIndex;
      }

      if (leftIndex != null) {
        return -1;
      }

      if (rightIndex != null) {
        return 1;
      }

      return left.card.name.localeCompare(right.card.name);
    });
  }, [filter, ownedCards, selectedCardIndexMap]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingLoadout) {
        return apiClient.updatePvpLoadout(
          editingLoadout.id,
          loadoutName.trim(),
          selectedCardIds,
        );
      }
      return apiClient.createPvpLoadout(loadoutName.trim(), selectedCardIds);
    },
    onSuccess: async () => {
      setToast({
        message: editingLoadout
          ? t("pvp.loadoutUpdated")
          : t("pvp.loadoutCreated"),
        type: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["pvp-loadouts"] });
      setTimeout(() => router.back(), 1000);
    },
    onError: (error) => {
      setToast({
        message:
          error instanceof Error
            ? error.message
            : t("messages.somethingWentWrong"),
        type: "error",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (loadoutId: string) => apiClient.deletePvpLoadout(loadoutId),
    onSuccess: async () => {
      setToast({ message: t("pvp.loadoutDeleted"), type: "success" });
      await queryClient.invalidateQueries({ queryKey: ["pvp-loadouts"] });
      router.back();
    },
    onError: (error) => {
      setToast({
        message:
          error instanceof Error
            ? error.message
            : t("messages.somethingWentWrong"),
        type: "error",
      });
    },
  });

  const editLoadout = (loadoutId: string) => {
    const loadout = loadouts.find((entry) => entry.id === loadoutId);
    if (!loadout) {
      return;
    }

    setEditingLoadoutId(loadout.id);
    setLoadoutName(loadout.name);
    setSelectedCardIds(loadout.cardIds.filter((cardId) => cardMap.has(cardId)));
  };

  const createNewLoadout = () => {
    setEditingLoadoutId(null);
    setLoadoutName("");
    setSelectedCardIds([]);
  };

  const toggleCardSelection = (card: BuilderCard) => {
    const isSelected = selectedCardIds.includes(card.id);

    if (isSelected) {
      setSelectedCardIds((current) =>
        current.filter((cardId) => cardId !== card.id),
      );
      return;
    }

    if (selectedCardIds.length >= 6) {
      setToast({ message: t("pvp.maxCards"), type: "error" });
      return;
    }
    if (card.rarity.name === "Legendary" && rarityCounts.legendary >= 1) {
      setToast({ message: t("pvp.maxLegendaryOne"), type: "error" });
      return;
    }
    if (card.rarity.name === "Epic" && rarityCounts.epic >= 2) {
      setToast({ message: t("pvp.maxEpicTwo"), type: "error" });
      return;
    }

    setSelectedCardIds((current) => [...current, card.id]);
  };

  const moveCard = (index: number, direction: "up" | "down") => {
    setSelectedCardIds((current) => {
      const next = [...current];
      if (direction === "up" && index > 0) {
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
      }
      if (direction === "down" && index < next.length - 1) {
        [next[index + 1], next[index]] = [next[index], next[index + 1]];
      }
      return next;
    });
  };

  const removeCard = (index: number) => {
    setSelectedCardIds((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const saveLoadout = () => {
    if (selectedCardIds.length !== 6) {
      setToast({ message: t("pvp.selectExactlySix"), type: "error" });
      return;
    }
    if (!loadoutName.trim()) {
      setToast({ message: t("pvp.enterLoadoutName"), type: "error" });
      return;
    }
    saveMutation.mutate();
  };

  const openCardDetails = (cardId: string) => {
    router.push({
      pathname: "/pvp-card-details",
      params: { cardId },
    });
  };
  const remainingSlots = Math.max(0, 6 - selectedCards.length);

  if (collectionQuery.isLoading || loadoutsQuery.isLoading) {
    return (
      <PageLoadingState
        title={t("pvp.yourLoadouts")}
        message={t("common.loadingStates.rosterBody")}
        icon="shield-half"
      />
    );
  }

  if (collectionQuery.isError || loadoutsQuery.isError) {
    return (
      <PageErrorState
        error={collectionQuery.error ?? loadoutsQuery.error}
        onRetry={() => {
          void collectionQuery.refetch();
          void loadoutsQuery.refetch();
        }}
      />
    );
  }

  return (
    <LinearGradient
      colors={[tc.primaryBg, tc.accentTint]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ flex: 1 }}
    >
      <KeyboardScreenView>
        {toast ? (
          <View
            className="absolute left-4 right-4 z-50 items-center"
            style={{ top: insets.top + 12 }}
            pointerEvents="box-none"
          >
            <View
              className={`w-full max-w-[420px] rounded-2xl px-4 py-3 ${toast.type === "success" ? "bg-successDark" : "bg-dangerDark"}`}
            >
              <Text className="text-center font-nunito-bold text-white">
                {toast.message}
              </Text>
            </View>
          </View>
        ) : null}

        <View
          className="border-b border-primaryTint bg-white/90 px-4 pb-4"
          style={{ paddingTop: insets.top + 8 }}
        >
          <View className="flex-row items-center gap-2">
            <ThemedExpoButton
              onPress={() => router.back()}
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
            <View className="flex-1 flex-row items-center gap-2">
              <SwordsIcon size={22} color={tc.primaryText} />
              <Text className="font-nunito-bold text-xl text-primaryText">
                {editingLoadout ? t("pvp.editLoadout") : t("pvp.createLoadout")}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          {...KEYBOARD_AWARE_SCROLL_PROPS}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 180 }}
        >
          <View className="gap-4 p-4">
            {loadouts.length > 0 ? (
              <View
                testID="pvp-loadout-saved-section"
                className="rounded-[28px] border border-primaryBorder/50 bg-surface/95 p-4"
              >
                <Text className="font-nunito-bold text-base text-fg">
                  {t("pvp.yourLoadouts")}
                </Text>
                <Text className="mt-1 font-nunito text-sm text-fgMuted">
                  {t("pvp.savedLoadoutsHint")}
                </Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingRight: 4, paddingTop: 12 }}
                >
                  {loadouts.map((loadout) => {
                    const active = editingLoadoutId === loadout.id;
                    const isValid = loadout.invalidCardIds.length === 0;

                    return (
                      <Pressable
                        key={loadout.id}
                        testID={`pvp-loadout-saved-${loadout.id}`}
                        onPress={() => editLoadout(loadout.id)}
                        className="rounded-[24px] p-4"
                        style={{
                          width: 208,
                          borderWidth: 1,
                          borderColor: active ? tc.accentDark : `${tc.primaryBorder}88`,
                          backgroundColor: active ? tc.accentTint : tc.surfaceMuted,
                        }}
                      >
                        <View className="flex-row items-start justify-between gap-3">
                          <Text
                            className={`flex-1 font-nunito-bold text-base ${
                              active ? "text-accentStrong" : "text-fg"
                            }`}
                            numberOfLines={2}
                          >
                            {loadout.name}
                          </Text>
                          {active ? (
                            <View className="rounded-full bg-accentDark px-2 py-1">
                              <Text className="font-nunito-bold text-[10px] text-white">
                                {t("pvp.editing")}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <Text className="mt-3 font-nunito-semibold text-xs text-fgMuted">
                          {loadout.cardIds.length}/6
                        </Text>
                        <Text
                          className={`mt-1 font-nunito text-xs ${
                            isValid ? "text-fgMuted" : "text-dangerDark"
                          }`}
                        >
                          {isValid
                            ? t("pvp.firstThreeActive")
                            : t("pvp.invalidLoadout", {
                                count: loadout.invalidCardIds.length,
                              })}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {editingLoadout ? (
                  <ThemedExpoButton
                    testID="pvp-loadout-new-button"
                    onPress={createNewLoadout}
                    preferFallback
                    variant="secondary"
                    fallbackAppearance={{
                      backgroundColor: tc.secondaryTint,
                      borderColor: tc.secondaryBorder,
                      borderRadius: 16,
                      foregroundColor: tc.secondaryText,
                      gradientColors: null,
                      minHeight: 0,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      textStyle: {
                        fontFamily: "Nunito_700Bold",
                        fontSize: 14,
                      },
                    }}
                    style={{ marginTop: 12 }}
                  >
                    {t("pvp.newLoadout")}
                  </ThemedExpoButton>
                ) : null}
              </View>
            ) : null}

            <View
              testID="pvp-loadout-summary-card"
              className="rounded-[28px] border border-primaryBorder/50 bg-surface/95 p-4"
            >
              <View
                className="rounded-[24px] p-4"
                style={{ backgroundColor: tc.primaryBg }}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="font-nunito-bold text-base text-primaryStrong">
                      {t("pvp.loadoutDetails")}
                    </Text>
                    <Text className="mt-1 font-nunito text-sm text-fgMuted">
                      {t("pvp.loadoutDetailsHint")}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-nunito-extrabold text-3xl text-primaryStrong">
                      {selectedCards.length}
                    </Text>
                    <Text className="font-nunito-semibold text-xs text-primaryText">
                      / 6
                    </Text>
                  </View>
                </View>

                <ThemedExpoTextInput
                  testID="pvp-loadout-name-input"
                  value={loadoutName}
                  onChangeText={setLoadoutName}
                  placeholder={t("pvp.loadoutNamePlaceholder")}
                  hostStyle={{ marginTop: 14 }}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: tc.primaryBorder,
                    borderRadius: 16,
                    borderWidth: 1,
                    height: 48,
                    paddingHorizontal: 14,
                    width: "100%",
                  }}
                  textStyle={{
                    color: tc.fg,
                    fontFamily: "Nunito_600SemiBold",
                    fontSize: 15,
                  }}
                />

                <View className="mt-3 flex-row flex-wrap gap-2">
                  <InfoPill
                    label={`${selectedCards.length}/6 ${t("pvp.cardsSelected")}`}
                    backgroundColor={
                      selectedCards.length === 6 ? tc.successTint : tc.surface
                    }
                    borderColor={
                      selectedCards.length === 6
                        ? tc.successBorder
                        : tc.primaryBorder
                    }
                    textColor={
                      selectedCards.length === 6
                        ? tc.successText
                        : tc.primaryStrong
                    }
                  />
                  <InfoPill
                    label={t("pvp.rarityCapLegendary", {
                      count: rarityCounts.legendary,
                    })}
                    backgroundColor={tc.secondaryTint}
                    borderColor={tc.secondaryBorder}
                    textColor={tc.secondaryText}
                  />
                  <InfoPill
                    label={t("pvp.rarityCapEpic", { count: rarityCounts.epic })}
                    backgroundColor={tc.accentTint}
                    borderColor={tc.accentBorder}
                    textColor={tc.accentText}
                  />
                </View>
              </View>

              <View className="mt-4 gap-3">
                <View
                  className="rounded-[24px] p-4"
                  style={{ backgroundColor: tc.successTint }}
                >
                  <Text className="font-nunito-bold text-base text-successText">
                    {t("pvp.activeTeam")}
                  </Text>
                  <Text className="mt-1 font-nunito text-xs text-successText">
                    {t("pvp.activeTeamHint")}
                  </Text>

                  <View className="mt-4 flex-row justify-between">
                    {[0, 1, 2].map((index) => (
                      <LoadoutSlotCard
                        key={index}
                        card={selectedCards[index]}
                        index={index}
                        label={t("pvp.activeSlot", { index: index + 1 })}
                        borderColor={`${tc.successDark}B3`}
                        emptyBackgroundColor={tc.successTint}
                        emptyBorderColor={`${tc.successBorder}CC`}
                        emptyTextColor={tc.successText}
                        badgeColor={tc.successDark}
                        onLongPress={() => {
                          const card = selectedCards[index];
                          if (card) {
                            openCardDetails(card.id);
                          }
                        }}
                        onMoveBack={() => moveCard(index, "up")}
                        onMoveForward={() => moveCard(index, "down")}
                        onRemove={() => removeCard(index)}
                        canMoveBack={index > 0}
                        canMoveForward={index < selectedCards.length - 1}
                      />
                    ))}
                  </View>
                </View>

                <View
                  className="rounded-[24px] p-4"
                  style={{ backgroundColor: tc.accentTint }}
                >
                  <Text className="font-nunito-bold text-base text-accentStrong">
                    {t("pvp.benchTeam")}
                  </Text>
                  <Text className="mt-1 font-nunito text-xs text-accentText">
                    {t("pvp.benchTeamHint")}
                  </Text>

                  <View className="mt-4 flex-row justify-between">
                    {[3, 4, 5].map((index) => (
                      <LoadoutSlotCard
                        key={index}
                        card={selectedCards[index]}
                        index={index}
                        label={t("pvp.benchSlot", { index: index - 2 })}
                        borderColor={`${tc.accentDark}B3`}
                        emptyBackgroundColor={tc.accentTint}
                        emptyBorderColor={`${tc.accentBorder}CC`}
                        emptyTextColor={tc.accentText}
                        badgeColor={tc.accentDark}
                        onLongPress={() => {
                          const card = selectedCards[index];
                          if (card) {
                            openCardDetails(card.id);
                          }
                        }}
                        onMoveBack={() => moveCard(index, "up")}
                        onMoveForward={() => moveCard(index, "down")}
                        onRemove={() => removeCard(index)}
                        canMoveBack={index > 0}
                        canMoveForward={index < selectedCards.length - 1}
                      />
                    ))}
                  </View>
                </View>
              </View>
            </View>

            <View
              testID="pvp-loadout-collection"
              className="rounded-[28px] border border-primaryBorder/50 bg-surface/95 p-4"
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <CardsIcon size={18} color={tc.primaryText} />
                    <Text className="font-nunito-bold text-base text-fg">
                      {t("pvp.browseCards")}
                    </Text>
                  </View>
                  <Text className="mt-1 font-nunito text-sm text-fgMuted">
                    {t("pvp.browseCardsHint")}
                  </Text>
                </View>
                <View className="rounded-full bg-primaryBg px-3 py-1.5">
                  <Text className="font-nunito-bold text-xs text-primaryStrong">
                    {filteredCollection.length}
                  </Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingRight: 4, paddingTop: 14 }}
              >
                {LOADOUT_TYPES.map((type) => {
                  const active = filter === type;
                  return (
                    <ThemedExpoButton
                      key={type}
                      testID={`pvp-loadout-filter-${type}`}
                      onPress={() => setFilter(type)}
                      preferFallback
                      variant={active ? "primary" : "ghost"}
                      fallbackAppearance={{
                        backgroundColor: active ? tc.primaryDark : "#FFFFFF",
                        borderColor: active ? tc.primaryDark : tc.primaryBorder,
                        borderRadius: 999,
                        foregroundColor: active ? "#FFFFFF" : tc.fgMuted,
                        gradientColors: null,
                        minHeight: 0,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        textStyle: {
                          fontFamily: "Nunito_600SemiBold",
                          fontSize: 14,
                        },
                      }}
                    >
                      {type === "all" ? t("pvp.all") : localizeTypeName(type, t)}
                    </ThemedExpoButton>
                  );
                })}
              </ScrollView>

              <View className="mt-4 flex-row flex-wrap justify-between gap-y-3">
                {filteredCollection.map((entry) => {
                  const card = entry.card;
                  const selectedIndex = selectedCardIndexMap.get(card.id);
                  const isSelected = selectedIndex != null;
                  const rarity =
                    RARITY_COLORS[card.rarity.name] ?? RARITY_COLORS.Common;
                  const typeColor =
                    CARD_TYPE_COLORS[card.type] ?? CARD_TYPE_COLORS.Hero;

                  return (
                    <BuilderCardPressable
                      key={entry.id}
                      onPress={() => toggleCardSelection(card)}
                      onLongPress={() => openCardDetails(card.id)}
                      className="relative mb-0 overflow-hidden rounded-[24px] bg-white"
                      style={{
                        width: "48.5%",
                        borderColor: isSelected
                          ? tc.primaryDark
                          : `${rarity.ring}66`,
                        borderWidth: isSelected ? 2 : 1,
                        backgroundColor: isSelected ? tc.primaryBg : "#FFFFFF",
                      }}
                      testID={`pvp-loadout-card-${card.id}`}
                    >
                      <View
                        className="relative overflow-hidden"
                        style={{
                          aspectRatio: 1.08,
                          backgroundColor: typeColor.light,
                        }}
                      >
                        {card.imageAssetId ? (
                          <Image
                            source={{
                              uri: getCardImageUrl(card.imageAssetId),
                              cacheKey: getCardImageCacheKey(card.imageAssetId),
                            }}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            style={{ width: "100%", height: "100%" }}
                          />
                        ) : (
                          <View
                            className="h-full w-full items-center justify-center"
                            style={{ backgroundColor: typeColor.light }}
                          >
                            <Text
                              className="font-nunito-extrabold text-4xl"
                              style={{ color: typeColor.dark }}
                            >
                              {(card.character || card.name || "?").charAt(0)}
                            </Text>
                          </View>
                        )}

                        <LinearGradient
                          colors={["rgba(255,255,255,0.04)", "rgba(0,0,0,0.18)"]}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 1 }}
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: 0,
                            bottom: 0,
                          }}
                        />

                        <View className="absolute left-2 right-2 top-2 flex-row items-start justify-between gap-2">
                          <View
                            className="rounded-full px-2.5 py-1"
                            style={{ backgroundColor: `${typeColor.dark}E6` }}
                          >
                            <Text className="font-nunito-bold text-[10px] text-white">
                              {localizeTypeName(card.type, t)}
                            </Text>
                          </View>

                          {isSelected ? (
                            <View
                              className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
                              style={{ backgroundColor: tc.primaryDark }}
                            >
                              <CheckIcon size={10} color="#FFFFFF" />
                              <Text className="font-nunito-bold text-[10px] text-white">
                                #{selectedIndex + 1}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>

                      <LinearGradient
                        colors={[rarity.from, rarity.to]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={{ height: 4 }}
                      />

                      <View
                        className="gap-3 px-3 pb-3 pt-3"
                        style={{
                          backgroundColor: isSelected ? tc.primaryTint : "#FFFFFF",
                        }}
                      >
                        <View className="gap-1">
                          <Text
                            className="font-nunito-bold text-sm text-fg"
                            numberOfLines={2}
                          >
                            {card.name}
                          </Text>
                          <Text
                            className="font-nunito text-xs text-fgMuted"
                            numberOfLines={1}
                          >
                            {card.character || localizeTypeName(card.type, t)}
                          </Text>
                        </View>

                        <View className="flex-row flex-wrap gap-1.5">
                          <View
                            className="rounded-full px-2.5 py-1"
                            style={{
                              backgroundColor: `${rarity.from}20`,
                            }}
                          >
                            <Text
                              className="font-nunito-bold text-[10px]"
                              style={{ color: rarity.to }}
                            >
                              {card.rarity.name}
                            </Text>
                          </View>

                          {entry.quantity > 1 ? (
                            <View
                              className="rounded-full px-2.5 py-1"
                              style={{
                                backgroundColor: tc.surfaceMuted,
                              }}
                            >
                              <Text
                                className="font-nunito-bold text-[10px]"
                                style={{ color: tc.fgMuted }}
                              >
                                x{entry.quantity}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <View className="flex-row gap-1.5">
                          <CompactStat
                            label={t("pvp.hp")}
                            value={card.hp}
                            backgroundColor={`${typeColor.light}CC`}
                            textColor={typeColor.dark}
                          />
                          <CompactStat
                            label={t("pvp.atk")}
                            value={card.attack}
                            backgroundColor={tc.dangerTint}
                            textColor={tc.dangerDark}
                          />
                          <CompactStat
                            label={t("pvp.def")}
                            value={card.defense}
                            backgroundColor={tc.infoTint}
                            textColor={tc.infoDark}
                          />
                        </View>
                      </View>
                    </BuilderCardPressable>
                  );
                })}
              </View>

              {filteredCollection.length === 0 ? (
                <View className="items-center px-6 py-12">
                  <Text className="text-center font-nunito text-fgMuted">
                    {t("pvp.noCardsFound")}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>

        <View
          className="border-t border-primaryTint bg-white/95 px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <View className="mb-3 flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="font-nunito-bold text-sm text-fg">
                {selectedCards.length}/6 {t("pvp.cardsSelected")}
              </Text>
              <Text className="mt-1 font-nunito text-xs text-fgMuted">
                {selectedCards.length === 6
                  ? t("pvp.readyToSave")
                  : t("pvp.slotsRemaining", { count: remainingSlots })}
              </Text>
            </View>
            {editingLoadout ? (
              <View className="rounded-full bg-accentTint px-3 py-1.5">
                <Text className="font-nunito-bold text-xs text-accentText">
                  {t("pvp.editing")}
                </Text>
              </View>
            ) : null}
          </View>

          <View className="flex-row gap-3">
            {editingLoadout ? (
              <ThemedExpoButton
                testID="pvp-loadout-delete-button"
                onPress={() => deleteMutation.mutate(editingLoadout.id)}
                variant="danger"
                fallbackAppearance={{
                  backgroundColor: tc.dangerTint,
                  borderColor: tc.dangerTint,
                  borderRadius: 18,
                  foregroundColor: tc.dangerDark,
                  gradientColors: null,
                  minHeight: 0,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  textStyle: {
                    fontFamily: "Nunito_700Bold",
                    fontSize: 14,
                  },
                }}
              >
                {t("common.delete")}
              </ThemedExpoButton>
            ) : null}

            <ThemedExpoButton
              testID="pvp-loadout-clear-button"
              onPress={() => setSelectedCardIds([])}
              style={{ flexGrow: 0, flexShrink: 0 }}
              variant="ghost"
              fallbackAppearance={{
                backgroundColor: tc.surfaceMuted,
                borderColor: tc.primaryBorder,
                borderRadius: 18,
                foregroundColor: tc.fgMuted,
                gradientColors: null,
                minHeight: 0,
                paddingHorizontal: 14,
                paddingVertical: 14,
                textStyle: {
                  fontFamily: "Nunito_700Bold",
                  fontSize: 14,
                },
              }}
            >
              {t("pvp.clearSelection")}
            </ThemedExpoButton>

            <ThemedExpoButton
              testID="pvp-loadout-save-button"
              disabled={
                selectedCardIds.length !== 6 ||
                !loadoutName.trim() ||
                saveMutation.isPending
              }
              onPress={saveLoadout}
              loading={saveMutation.isPending}
              style={{ flex: 1, minWidth: 0 }}
              variant="primary"
              fallbackAppearance={{
                backgroundColor: tc.primary,
                borderColor: tc.primary,
                borderRadius: 18,
                foregroundColor: "#FFFFFF",
                gradientColors: [tc.primary, tc.primaryDark],
                minHeight: 0,
                paddingHorizontal: 16,
                paddingVertical: 14,
                textStyle: {
                  fontFamily: "Nunito_700Bold",
                  fontSize: 14,
                },
              }}
            >
              {saveMutation.isPending
                ? t("admin.saving")
                : editingLoadout
                  ? t("pvp.update")
                  : t("pvp.create")}
            </ThemedExpoButton>
          </View>
        </View>
      </KeyboardScreenView>
    </LinearGradient>
  );
}
