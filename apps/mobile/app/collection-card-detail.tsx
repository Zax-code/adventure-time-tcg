import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiClient } from "../src/lib/api";
import { useCollectionFeedbackStore } from "../src/stores/collection-feedback-store";
import { useSessionStore } from "../src/stores/session-store";
import { useThemeStore } from "../src/stores/theme-store";
import { useTranslation } from "../src/i18n";
import { CardTile } from "../src/components/card-tile";
import { RARITY_COLORS } from "../src/components/theme";
import { THEME_COLORS } from "../src/theme/themes";
import {
  ChevronDownIcon,
  CraftIcon,
  DustIcon,
  GiftHeartIcon,
  RecycleIcon,
  SwordsIcon,
} from "../src/components/icons";
import { ToastBanner } from "../src/components/toast-banner";
import { getDustSacrificeValue, getDustCraftCost } from "../src/lib/dust";
import type { CollectionResponse, HomeResponse } from "@adventure-time/api-client";

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

      const nextQuantity = entry.quantity + quantityDelta;
      if (nextQuantity <= 0) {
        return null;
      }

      return {
        ...entry,
        quantity: nextQuantity,
      };
    })
    .filter(
      (entry): entry is CollectionResponse["cards"][number] => entry !== null,
    );

  const totalCards = nextCards.reduce((sum, entry) => sum + entry.quantity, 0);
  const uniqueOwned = nextCards.length;
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
      completionPercentage,
    },
  };
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
      dust: nextDust,
    },
  };
}

export default function CollectionCardDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ cardId?: string }>();
  const accessToken = useSessionStore((state) => state.accessToken);
  const currentUserId = useSessionStore((state) => state.user?.id);
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const publishCollectionFeedback = useCollectionFeedbackStore(
    (state) => state.publish,
  );

  const [recycleExpanded, setRecycleExpanded] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [giftExpanded, setGiftExpanded] = useState(false);
  const [recycleQuantity, setRecycleQuantity] = useState(1);
  const [recycleError, setRecycleError] = useState("");
  const [craftError, setCraftError] = useState("");
  const [giftError, setGiftError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const toastAnim = useRef(new Animated.Value(-60)).current;

  const collectionQuery = useQuery({
    queryKey: ["collection"],
    queryFn: () => apiClient.collection(),
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.users(),
    enabled: giftExpanded,
  });

  const entry =
    collectionQuery.data?.cards.find((e) => e.cardId === params.cardId) ?? null;

  const dust = collectionQuery.data?.dust ?? 0;
  const homeQueryKey = useMemo(() => ["home"] as const, []);
  const collectionQueryKey = useMemo(() => ["collection"] as const, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    toastAnim.setValue(-60);
    Animated.timing(toastAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast, toastAnim]);

  useEffect(() => {
    setRecycleExpanded(false);
    setStatsExpanded(false);
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
  }, [params.cardId]);

  const recycleMutation = useMutation({
    mutationFn: ({ cardId, quantity }: { cardId: string; quantity: number }) =>
      apiClient.recycleCard(cardId, quantity),
  });

  const craftMutation = useMutation({
    mutationFn: (cardId: string) => apiClient.craftCard(cardId),
  });

  const sendGiftMutation = useMutation({
    mutationFn: ({
      cardId,
      toUserId,
      message,
    }: {
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
    },
  });

  const handleRecycle = async () => {
    if (!entry) return;
    setIsBusy(true);
    setRecycleError("");
    try {
      const remainingQuantity = entry.quantity - recycleQuantity;
      const result = await recycleMutation.mutateAsync({
        cardId: entry.cardId,
        quantity: recycleQuantity,
      });

      queryClient.setQueryData(
        collectionQueryKey,
        (current: CollectionResponse | undefined) =>
          patchCollectionAfterDustAction(
            current,
            result.cardId,
            -(result.quantityRecycled ?? recycleQuantity),
            result.newDustBalance,
          ),
      );
      queryClient.setQueryData(
        homeQueryKey,
        (current: HomeResponse | undefined) =>
          patchHomeDust(current, result.newDustBalance),
      );

      if (remainingQuantity <= 0) {
        publishCollectionFeedback(
          t("collection.detail.recycleSuccess", {
            count: result.quantityRecycled ?? recycleQuantity,
            dust:
              result.dustGained ??
              getDustSacrificeValue(entry.card.rarity.name) * recycleQuantity,
          }),
        );
        router.back();
      } else {
        setIsBusy(false);
        setRecycleExpanded(false);
        setRecycleQuantity(1);
        setToast({
          type: "success",
          message: t("collection.detail.recycleSuccess", {
            count: result.quantityRecycled ?? recycleQuantity,
            dust:
              result.dustGained ??
              getDustSacrificeValue(entry.card.rarity.name) * recycleQuantity,
          }),
        });
      }

      void queryClient.invalidateQueries({
        queryKey: collectionQueryKey,
        refetchType: "active",
      });
      void queryClient.invalidateQueries({
        queryKey: homeQueryKey,
        refetchType: "inactive",
      });
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
      const result = await craftMutation.mutateAsync(entry.cardId);

      queryClient.setQueryData(
        collectionQueryKey,
        (current: CollectionResponse | undefined) =>
          patchCollectionAfterDustAction(
            current,
            result.cardId,
            result.quantityCrafted ?? 1,
            result.newDustBalance,
          ),
      );
      queryClient.setQueryData(
        homeQueryKey,
        (current: HomeResponse | undefined) =>
          patchHomeDust(current, result.newDustBalance),
      );

      setIsBusy(false);
      setToast({
        type: "success",
        message: t("collection.detail.craftSuccess", {
          count: result.quantityCrafted ?? 1,
          dust: result.dustSpent ?? getDustCraftCost(entry.card.rarity.name),
        }),
      });

      void queryClient.invalidateQueries({
        queryKey: collectionQueryKey,
        refetchType: "active",
      });
      void queryClient.invalidateQueries({
        queryKey: homeQueryKey,
        refetchType: "inactive",
      });
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
        message: giftMessage || undefined,
      });
    } catch (err) {
      setGiftError(err instanceof Error ? err.message : "Gift failed");
      setIsBusy(false);
    }
  };

  const otherUsers = (usersQuery.data?.users ?? []).filter(
    (u) => u.id !== currentUserId,
  );

  return (
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

      <View
        className="h-1 w-9 self-center rounded-full bg-muted"
        style={{ marginTop: 8, marginBottom: 4 }}
      />

      <View className="items-center border-b border-primaryTint px-6 py-4">
        <Text className="font-nunito-extrabold text-2xl text-fg">
          {t("pvp.cardDetailsTitle")}
        </Text>
      </View>

      {collectionQuery.isLoading ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="font-nunito text-fgMuted">
            {t("common.loading")}
          </Text>
        </View>
      ) : !entry ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-nunito text-fgMuted">
            {t("pvp.cardMissingTitle")}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            alignItems: "center",
            paddingVertical: 24,
            paddingHorizontal: 16,
            gap: 14,
            paddingBottom: insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Large card */}
          <View style={{ marginTop: 4 }}>
            <CardTile entry={entry} size="large" accessToken={accessToken} />
          </View>

          {/* Rarity panel */}
          {(() => {
            const rarityColor =
              RARITY_COLORS[entry.card.rarity.name] ?? RARITY_COLORS.Common;
            return (
              <View
                style={{
                  width: "100%",
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#FCE7F3",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  shadowColor: "#000",
                  shadowOpacity: 0.08,
                  shadowRadius: 6,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: "Nunito_600SemiBold",
                    color: "#9CA3AF",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {t("collection.detail.rarity")}
                </Text>
                <LinearGradient
                  colors={[rarityColor.from, rarityColor.to]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontFamily: "Nunito_800ExtraBold",
                      fontSize: 12,
                    }}
                  >
                    {entry.card.rarity.name.toUpperCase()}
                  </Text>
                </LinearGradient>
              </View>
            );
          })()}

          {/* Stats panel */}
          <View
            style={{
              width: "100%",
              backgroundColor: "#fff",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#FCE7F3",
              shadowColor: "#000",
              shadowOpacity: 0.1,
              shadowRadius: 8,
              overflow: "hidden",
            }}
          >
            <Pressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 12,
                gap: 8,
              }}
              onPress={() => setStatsExpanded(!statsExpanded)}
            >
              <SwordsIcon size={18} color="#1F2937" />
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontFamily: "Nunito_700Bold",
                  color: "#1F2937",
                }}
              >
                {t("collection.detail.stats")}
              </Text>
              <View
                style={{
                  transform: [{ rotate: statsExpanded ? "180deg" : "0deg" }],
                }}
              >
                <ChevronDownIcon size={18} color="#DB2777" />
              </View>
            </Pressable>
            {statsExpanded && (
              <View
                style={{
                  flexDirection: "row",
                  paddingHorizontal: 12,
                  paddingBottom: 14,
                  gap: 8,
                }}
              >
                {[
                  { label: "HP", value: entry.card.hp, color: "#FB7185" },
                  { label: "ATK", value: entry.card.attack, color: "#FBBF24" },
                  { label: "DEF", value: entry.card.defense, color: "#818CF8" },
                  { label: "SPD", value: entry.card.speed, color: "#2DD4BF" },
                ].map(({ label, value, color }) => (
                  <View
                    key={label}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      backgroundColor: "#F9FAFB",
                      borderRadius: 10,
                      paddingVertical: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontFamily: "Nunito_800ExtraBold",
                        color,
                      }}
                    >
                      {value}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: "Nunito_600SemiBold",
                        color: "#6B7280",
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Recycle section */}
          <View
            style={{
              width: "100%",
              backgroundColor: "#ECFDF5",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#6EE7B7",
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 8,
              overflow: "hidden",
            }}
          >
            <Pressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 12,
                gap: 8,
              }}
              onPress={() => setRecycleExpanded(!recycleExpanded)}
            >
              <RecycleIcon size={18} color="#065F46" />
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontFamily: "Nunito_700Bold",
                  color: "#065F46",
                }}
              >
                {t("collection.detail.recycle")}
              </Text>
              <View
                style={{
                  backgroundColor: "#D1FAE5",
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "Nunito_600SemiBold",
                    color: "#065F46",
                  }}
                >
                  +{getDustSacrificeValue(entry.card.rarity.name)}
                </Text>
                <DustIcon size={12} color="#065F46" />
              </View>
              <View
                style={{
                  transform: [{ rotate: recycleExpanded ? "180deg" : "0deg" }],
                }}
              >
                <ChevronDownIcon size={18} color="#065F46" />
              </View>
            </Pressable>
            {recycleExpanded && (
              <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                {entry.quantity > 1 && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 12,
                      justifyContent: "center",
                    }}
                  >
                    <Pressable
                      onPress={() =>
                        setRecycleQuantity(Math.max(1, recycleQuantity - 1))
                      }
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: "#D1FAE5",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "#065F46",
                          fontFamily: "Nunito_700Bold",
                          fontSize: 18,
                        }}
                      >
                        −
                      </Text>
                    </Pressable>
                    <Text
                      style={{
                        fontSize: 15,
                        fontFamily: "Nunito_700Bold",
                        color: "#065F46",
                        minWidth: 80,
                        textAlign: "center",
                      }}
                    >
                      {recycleQuantity}
                    </Text>
                    <Pressable
                      onPress={() =>
                        setRecycleQuantity(
                          Math.min(entry.quantity, recycleQuantity + 1),
                        )
                      }
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: "#D1FAE5",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "#065F46",
                          fontFamily: "Nunito_700Bold",
                          fontSize: 18,
                        }}
                      >
                        +
                      </Text>
                    </Pressable>
                  </View>
                )}
                <Pressable
                  onPress={() => void handleRecycle()}
                  disabled={isBusy}
                  style={{
                    backgroundColor: "#059669",
                    borderRadius: 8,
                    paddingVertical: 10,
                    alignItems: "center",
                    opacity: isBusy ? 0.6 : 1,
                  }}
                >
                  {isBusy ? (
                    <Text
                      style={{
                        color: "#fff",
                        fontFamily: "Nunito_700Bold",
                        fontSize: 14,
                      }}
                    >
                      {t("collection.detail.recycling")}
                    </Text>
                  ) : (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontFamily: "Nunito_700Bold",
                          fontSize: 14,
                        }}
                      >
                        {t("collection.detail.confirmRecycle", {
                          amount:
                            getDustSacrificeValue(entry.card.rarity.name) *
                            recycleQuantity,
                        })}
                      </Text>
                      <DustIcon size={14} color="#fff" />
                    </View>
                  )}
                </Pressable>
              </View>
            )}
          </View>

          {/* Craft button */}
          <Pressable
            onPress={() => void handleCraft()}
            disabled={isBusy || dust < getDustCraftCost(entry.card.rarity.name)}
            style={{
              width: "100%",
              backgroundColor: "#FEF9C3",
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: "#FDE047",
              opacity:
                isBusy || dust < getDustCraftCost(entry.card.rarity.name)
                  ? 0.5
                  : 1,
            }}
          >
            <CraftIcon size={18} color="#92400E" />
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                fontFamily: "Nunito_700Bold",
                color: "#92400E",
              }}
            >
              {t("collection.detail.craft")}
            </Text>
            <View
              style={{
                backgroundColor: "#FDE047",
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 3,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Nunito_700Bold",
                  color: "#92400E",
                }}
              >
                −{getDustCraftCost(entry.card.rarity.name)}
              </Text>
              <DustIcon size={12} color="#92400E" />
            </View>
          </Pressable>

          {/* Gift section */}
          <View
            style={{
              width: "100%",
              backgroundColor: "#EFF6FF",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#93C5FD",
              shadowColor: "#000",
              shadowOpacity: 0.1,
              shadowRadius: 8,
              overflow: "hidden",
            }}
          >
            <Pressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 12,
                gap: 8,
              }}
              onPress={() => setGiftExpanded(!giftExpanded)}
            >
              <GiftHeartIcon size={18} color="#1D4ED8" />
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontFamily: "Nunito_700Bold",
                  color: "#1D4ED8",
                }}
              >
                {t("gifts.sendGift")}
              </Text>
              <View
                style={{
                  transform: [{ rotate: giftExpanded ? "180deg" : "0deg" }],
                }}
              >
                <ChevronDownIcon size={18} color="#1D4ED8" />
              </View>
            </Pressable>
            {giftExpanded && (
              <View
                style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}
              >
                <View style={{ gap: 6 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "Nunito_600SemiBold",
                      color: "#1D4ED8",
                      marginBottom: 2,
                    }}
                  >
                    {t("gifts.giftTo")}
                  </Text>
                  <TextInput
                    value={userSearch}
                    onChangeText={setUserSearch}
                    placeholder={t("collection.gift.searchPlayersPlaceholder")}
                    placeholderTextColor="#93C5FD"
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "#BFDBFE",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontFamily: "Nunito_400Regular",
                      fontSize: 14,
                      color: "#1E3A8A",
                    }}
                  />
                  <ScrollView
                    style={{
                      maxHeight: 180,
                      backgroundColor: "#F0F9FF",
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: "#BFDBFE",
                    }}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {usersQuery.isLoading ? (
                      <Text
                        style={{
                          fontFamily: "Nunito_400Regular",
                          fontSize: 13,
                          color: "#6B7280",
                          textAlign: "center",
                          padding: 12,
                        }}
                      >
                        {t("common.loading")}
                      </Text>
                    ) : otherUsers.filter((u) =>
                        u.displayName
                          .toLowerCase()
                          .includes(userSearch.toLowerCase()),
                      ).length === 0 ? (
                      <Text
                        style={{
                          fontFamily: "Nunito_400Regular",
                          fontSize: 13,
                          color: "#6B7280",
                          textAlign: "center",
                          padding: 12,
                        }}
                      >
                        {t("collection.gift.noPlayersFound")}
                      </Text>
                    ) : (
                      <View style={{ padding: 6, gap: 4 }}>
                        {otherUsers
                          .filter((u) =>
                            u.displayName
                              .toLowerCase()
                              .includes(userSearch.toLowerCase()),
                          )
                          .map((u) => (
                            <Pressable
                              key={u.id}
                              onPress={() => setSelectedUserId(u.id)}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                borderRadius: 8,
                                borderWidth: 2,
                                backgroundColor:
                                  selectedUserId === u.id ? "#DBEAFE" : "#fff",
                                borderColor:
                                  selectedUserId === u.id
                                    ? "#3B82F6"
                                    : "transparent",
                              }}
                            >
                              <Text
                                style={{
                                  flex: 1,
                                  fontFamily:
                                    selectedUserId === u.id
                                      ? "Nunito_700Bold"
                                      : "Nunito_600SemiBold",
                                  fontSize: 14,
                                  color: "#1E3A8A",
                                }}
                              >
                                {u.displayName}
                              </Text>
                              {selectedUserId === u.id && (
                                <Text
                                  style={{
                                    color: "#3B82F6",
                                    fontSize: 16,
                                    fontFamily: "Nunito_700Bold",
                                  }}
                                >
                                  ✓
                                </Text>
                              )}
                            </Pressable>
                          ))}
                      </View>
                    )}
                  </ScrollView>
                </View>
                <TextInput
                  value={giftMessage}
                  onChangeText={setGiftMessage}
                  placeholder={t("collection.gift.messageOptionalPlaceholder")}
                  placeholderTextColor="#93C5FD"
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#BFDBFE",
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    fontFamily: "Nunito_400Regular",
                    fontSize: 14,
                    color: "#1E3A8A",
                  }}
                />
                <Pressable
                  onPress={() => void handleSendGift()}
                  disabled={isBusy || !selectedUserId}
                  style={{
                    backgroundColor: "#2563EB",
                    borderRadius: 8,
                    paddingVertical: 10,
                    alignItems: "center",
                    opacity: isBusy || !selectedUserId ? 0.5 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontFamily: "Nunito_700Bold",
                      fontSize: 14,
                    }}
                  >
                    {isBusy ? t("collection.gift.sending") : t("gifts.sendGiftButton")}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Errors */}
          {recycleError || craftError || giftError ? (
            <Text
              style={{
                color: "#DC2626",
                fontFamily: "Nunito_400Regular",
                fontSize: 12,
                textAlign: "center",
              }}
            >
              {recycleError || craftError || giftError}
            </Text>
          ) : null}

          {/* Close button */}
          <Pressable
            onPress={() => {
              if (!isBusy) router.back();
            }}
            style={{
              width: "100%",
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
              backgroundColor: "#fff",
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 6,
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                fontFamily: "Nunito_600SemiBold",
                color: "#DB2777",
                fontSize: 14,
              }}
            >
              {t("common.close")}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
