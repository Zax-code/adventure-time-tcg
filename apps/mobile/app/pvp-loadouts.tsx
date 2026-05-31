import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
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
import { useTranslation } from "../src/i18n";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS } from "../src/theme/themes";
import { CARD_TYPE_COLORS, RARITY_COLORS } from "../src/components/theme";
import {
  CheckIcon,
  ChevronRightIcon,
  SwordsIcon,
  XIcon,
} from "../src/components/icons";
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

function getRarityBorderClass(rarity: string) {
  switch (rarity) {
    case "Legendary":
      return "border-secondaryDark";
    case "Epic":
      return "border-accent";
    case "Rare":
      return "border-info";
    case "Uncommon":
      return "border-success";
    default:
      return "border-primaryBorder";
  }
}

function BuilderCardPressable({
  className,
  onPress,
  onLongPress,
  style,
  children,
}: {
  className?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
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
      selectedCardIds
        .map((id) => cardMap.get(id))
        .filter(Boolean) as BuilderCard[],
    [cardMap, selectedCardIds],
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
    return ownedCards.filter((entry) => {
      if (filter === "all") {
        return true;
      }
      return entry.card.type === filter;
    });
  }, [filter, ownedCards]);

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
      <View className="flex-1 items-center justify-center bg-bg px-6">
        <Text className="font-nunito text-center text-danger">
          {collectionQuery.error?.message ?? loadoutsQuery.error?.message}
        </Text>
      </View>
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
            <Pressable onPress={() => router.back()} className="rounded-xl p-2">
              <View style={{ transform: [{ rotate: "180deg" }] }}>
                <ChevronRightIcon size={20} color={tc.fgMuted} />
              </View>
            </Pressable>
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
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {loadouts.length > 0 ? (
            <View className="border-b border-primaryTint bg-white/60 px-4 py-4">
              <Text className="mb-2 font-nunito-semibold text-sm text-fgMuted">
                {t("pvp.yourLoadouts")}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingRight: 16 }}
              >
                {loadouts.map((loadout) => {
                  const active = editingLoadoutId === loadout.id;
                  return (
                    <Pressable
                      key={loadout.id}
                      onPress={() => editLoadout(loadout.id)}
                      className={`rounded-xl px-4 py-2 ${active ? "bg-accentDark" : "bg-accentTint"}`}
                    >
                      <Text
                        className={`font-nunito-semibold text-sm ${active ? "text-white" : "text-accentText"}`}
                      >
                        {loadout.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {editingLoadout ? (
                <Pressable
                  onPress={createNewLoadout}
                  className="mt-4 rounded-xl bg-primaryDark px-4 py-2.5"
                >
                  <Text className="text-center font-nunito-bold text-xs text-white">
                    {t("pvp.createLoadout")}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View className="border-b border-primaryTint bg-white/80 px-4 py-4">
            <View className="flex-row items-center gap-2">
              <TextInput
                value={loadoutName}
                onChangeText={setLoadoutName}
                placeholder={t("pvp.loadoutNamePlaceholder")}
                placeholderTextColor={tc.muted}
                className="flex-1 rounded-xl border border-primaryTint bg-white px-3 py-2 font-nunito text-fg"
              />
              <Text className="font-nunito-semibold text-sm text-fgMuted">
                {selectedCards.length}/6
              </Text>
            </View>
            <Text className="mt-2 font-nunito text-xs text-fgMuted">
              {t("pvp.rarityCapLegendary", { count: rarityCounts.legendary })},{" "}
              {t("pvp.rarityCapEpic", { count: rarityCounts.epic })}
            </Text>

            <View className="gap-6 px-2 py-4">
              <View className="flex-row items-center justify-center gap-8">
                {[0, 1, 2].map((index) => {
                  const card = selectedCards[index];
                  return (
                    <View
                      key={index}
                      className={`relative h-28 w-20 overflow-hidden rounded-xl border-2 ${card ? `${getRarityBorderClass(card.rarity.name)} bg-white border-success` : "border-dashed border-success bg-white/60"}`}
                    >
                      {card ? (
                        <>
                          <BuilderCardPressable
                            className="h-full w-full"
                            onLongPress={() => openCardDetails(card.id)}
                          >
                            {card.imageAssetId ? (
                              <Image
                                source={{
                                  uri: getCardImageUrl(card.imageAssetId),
                                  cacheKey: getCardImageCacheKey(
                                    card.imageAssetId,
                                  ),
                                }}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                style={{ width: "100%", height: "100%" }}
                              />
                            ) : (
                              <View className="h-full w-full items-center justify-center bg-primaryTint">
                                <Text className="font-nunito-extrabold text-3xl text-primaryDark">
                                  {(card.character || card.name || "?").charAt(
                                    0,
                                  )}
                                </Text>
                              </View>
                            )}
                          </BuilderCardPressable>

                          <Pressable
                            onPress={() => removeCard(index)}
                            className="absolute -right-2 -top-2 rounded-full bg-dangerDark p-1"
                          >
                            <XIcon size={12} color="#fff" />
                          </Pressable>

                          <View className="absolute left-0 right-0 top-1 flex-row justify-between px-1">
                            {index > 0 ? (
                              <Pressable
                                onPress={() => moveCard(index, "up")}
                                className="rounded bg-black/50 px-1 py-0.5"
                              >
                                <Text className="font-nunito-bold text-[10px] text-white">
                                  {"<"}
                                </Text>
                              </Pressable>
                            ) : (
                              <View />
                            )}
                            {index < selectedCards.length - 1 ? (
                              <Pressable
                                onPress={() => moveCard(index, "down")}
                                className="rounded bg-black/50 px-1 py-0.5"
                              >
                                <Text className="font-nunito-bold text-[10px] text-white">
                                  {">"}
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>

                          <View className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-1">
                            <Text
                              className="font-nunito text-[10px] text-white"
                              numberOfLines={1}
                            >
                              {card.name}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <View className="flex-1 items-center justify-center px-2">
                          <Text className="text-center font-nunito text-xs text-fgMuted">
                            {t("pvp.activeSlot", { index: index + 1 })}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              <View className="flex-row items-center justify-center gap-8">
                {[3, 4, 5].map((index) => {
                  const card = selectedCards[index];
                  return (
                    <View
                      key={index}
                      className={`relative h-28 w-20 overflow-hidden rounded-xl border-2 ${card ? `${getRarityBorderClass(card.rarity.name)} bg-white` : "border-dashed border-primaryBorder bg-white/60"}`}
                    >
                      {card ? (
                        <>
                          <BuilderCardPressable
                            className="h-full w-full"
                            onLongPress={() => openCardDetails(card.id)}
                          >
                            {card.imageAssetId ? (
                              <Image
                                source={{
                                  uri: getCardImageUrl(card.imageAssetId),
                                  cacheKey: getCardImageCacheKey(
                                    card.imageAssetId,
                                  ),
                                }}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                style={{ width: "100%", height: "100%" }}
                              />
                            ) : (
                              <View className="h-full w-full items-center justify-center bg-primaryTint">
                                <Text className="font-nunito-extrabold text-3xl text-primaryDark">
                                  {(card.character || card.name || "?").charAt(
                                    0,
                                  )}
                                </Text>
                              </View>
                            )}
                          </BuilderCardPressable>

                          <Pressable
                            onPress={() => removeCard(index)}
                            className="absolute -right-2 -top-2 rounded-full bg-dangerDark p-1"
                          >
                            <XIcon size={12} color="#fff" />
                          </Pressable>

                          <View className="absolute left-0 right-0 top-1 flex-row justify-between px-1">
                            {index > 0 ? (
                              <Pressable
                                onPress={() => moveCard(index, "up")}
                                className="rounded bg-black/50 px-1 py-0.5"
                              >
                                <Text className="font-nunito-bold text-[10px] text-white">
                                  {"<"}
                                </Text>
                              </Pressable>
                            ) : (
                              <View />
                            )}
                            {index < selectedCards.length - 1 ? (
                              <Pressable
                                onPress={() => moveCard(index, "down")}
                                className="rounded bg-black/50 px-1 py-0.5"
                              >
                                <Text className="font-nunito-bold text-[10px] text-white">
                                  {">"}
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>

                          <View className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-1">
                            <Text
                              className="font-nunito text-[10px] text-white"
                              numberOfLines={1}
                            >
                              {card.name}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <View className="flex-1 items-center justify-center px-2">
                          <Text className="text-center font-nunito text-xs text-fgMuted">
                            {t("pvp.benchSlot", { index: index - 2 })}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            <Text className="font-nunito text-xs text-fgMuted">
              {t("pvp.activeBenchHint")}
            </Text>

            <View className="mt-4 flex-row gap-3">
              {editingLoadout ? (
                <Pressable
                  onPress={() => deleteMutation.mutate(editingLoadout.id)}
                  className="rounded-2xl bg-dangerTint px-4 py-3"
                >
                  <Text className="font-nunito-bold text-dangerDark">
                    {t("common.delete")}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setSelectedCardIds([])}
                className="flex-1 rounded-2xl bg-surfaceMuted px-4 py-3"
              >
                <Text className="text-center font-nunito-bold text-fgMuted">
                  {t("common.clear")}
                </Text>
              </Pressable>
              <Pressable
                disabled={
                  selectedCardIds.length !== 6 ||
                  !loadoutName.trim() ||
                  saveMutation.isPending
                }
                onPress={saveLoadout}
                className="flex-1 overflow-hidden rounded-2xl"
              >
                <LinearGradient
                  colors={[tc.primary, tc.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingHorizontal: 16, paddingVertical: 12 }}
                >
                  <Text className="text-center font-nunito-bold text-white">
                    {saveMutation.isPending
                      ? t("admin.saving")
                      : editingLoadout
                        ? t("pvp.update")
                        : t("pvp.create")}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>

          <View className="px-4 py-3">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 16 }}
            >
              {LOADOUT_TYPES.map((type) => {
                const active = filter === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setFilter(type)}
                    className={`rounded-full px-3 py-1.5 ${active ? "bg-primaryDark" : "bg-white"}`}
                  >
                    <Text
                      className={`font-nunito-semibold text-sm ${active ? "text-white" : "text-fgMuted"}`}
                    >
                      {type === "all"
                        ? t("pvp.all")
                        : localizeTypeName(type, t)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View className="px-4 pb-4">
            <View className="flex-row flex-wrap justify-between gap-y-3">
              {filteredCollection.map((entry) => {
                const card = entry.card;
                const isSelected = selectedCardIds.includes(card.id);
                const rarity =
                  RARITY_COLORS[card.rarity.name] ?? RARITY_COLORS.Common;
                const typeColor =
                  CARD_TYPE_COLORS[card.type] ?? CARD_TYPE_COLORS.Hero;

                return (
                  <BuilderCardPressable
                    key={entry.id}
                    onPress={() => toggleCardSelection(card)}
                    onLongPress={() => openCardDetails(card.id)}
                    className={`relative mb-0 overflow-hidden rounded-xl border-2 ${isSelected ? "border-primaryDark bg-primaryDark" : `${getRarityBorderClass(card.rarity.name)} bg-white`}`}
                    style={{ width: "31.5%" }}
                  >
                    <View
                      className="overflow-hidden"
                      style={{ aspectRatio: 3 / 4 }}
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
                    </View>

                    <LinearGradient
                      colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.85)"]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        paddingHorizontal: 8,
                        paddingVertical: 8,
                      }}
                    >
                      <Text
                        className="font-nunito text-xs text-white"
                        numberOfLines={1}
                      >
                        {card.name}
                      </Text>
                      <Text className="font-nunito text-[10px] text-white/80">
                        {t("pvp.hp")}:{card.hp} {t("pvp.atk")}:{card.attack}{" "}
                        {t("pvp.def")}:{card.defense}
                      </Text>
                    </LinearGradient>

                    {isSelected ? (
                      <View className="absolute right-2 top-2 rounded-full bg-primaryDark p-1.5">
                        <CheckIcon size={12} color="#fff" />
                      </View>
                    ) : null}

                    {entry.quantity > 1 ? (
                      <View className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5">
                        <Text className="font-nunito-bold text-[10px] text-white">
                          x{entry.quantity}
                        </Text>
                      </View>
                    ) : null}

                    {!isSelected ? (
                      <View
                        className="absolute inset-0 border"
                        style={{ borderColor: rarity.ring }}
                        pointerEvents="none"
                      />
                    ) : null}
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
        </ScrollView>
      </KeyboardScreenView>
    </LinearGradient>
  );
}
