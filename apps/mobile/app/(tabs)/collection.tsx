import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";

import type { CollectionResponse } from "@adventure-time/api-client";
import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { CardTile } from "../../src/components/card-tile";
import { RARITY_COLORS } from "../../src/components/theme";
import {
  DustIcon,
  RecycleIcon,
  CraftIcon,
  BarChartIcon,
} from "../../src/components/icons";
import { PageLoadingState } from "../../src/components/loading-state";
import { ToastBanner } from "../../src/components/toast-banner";
import { useTranslation } from "../../src/i18n";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../../src/components/keyboard-screen-view";
import { useCollectionFeedbackStore } from "../../src/stores/collection-feedback-store";
import { useThemeStore } from "../../src/stores/theme-store";
import { useBottomTabBarContentPadding } from "../../src/theme/layout";
import { THEME_COLORS } from "../../src/theme/themes";

type CollectionEntry = CollectionResponse["cards"][number];

const SORT_LABELS: Record<string, string> = {
  rarity: "Rarity",
  name: "Name",
  quantity: "Quantity",
  newest: "Newest",
};

const DUST_TABLE = [
  { rarity: "Common", recycle: 1, craft: 5 },
  { rarity: "Uncommon", recycle: 5, craft: 25 },
  { rarity: "Rare", recycle: 20, craft: 100 },
  { rarity: "Epic", recycle: 50, craft: 250 },
  { rarity: "Legendary", recycle: 100, craft: 500 },
];

export default function CollectionScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((state) => state.accessToken);
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  const bottomTabPadding = useBottomTabBarContentPadding();
  const collectionFeedbackMessage = useCollectionFeedbackStore(
    (state) => state.message,
  );
  const clearCollectionFeedback = useCollectionFeedbackStore(
    (state) => state.clear,
  );

  const [filterRarity, setFilterRarity] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "rarity" | "name" | "quantity" | "newest"
  >("rarity");
  const [searchQuery, setSearchQuery] = useState("");
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showDustModal, setShowDustModal] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const toastAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    if (!toast) {
      return;
    }

    toastAnim.setValue(-60);
    Animated.timing(toastAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast, toastAnim]);

  useEffect(() => {
    if (!collectionFeedbackMessage) {
      return;
    }

    setToast({ type: "success", message: collectionFeedbackMessage });
    clearCollectionFeedback();
  }, [clearCollectionFeedback, collectionFeedbackMessage]);

  const collectionQuery = useQuery({
    queryKey: ["collection"],
    queryFn: () => apiClient.collection(),
  });

  // Derived data — computed before early returns to satisfy Rules of Hooks
  const rawCards = collectionQuery.data?.cards ?? [];

  const rarityGroups = useMemo(() => {
    const groups = new Map<string, { count: number; dropRate: number }>();
    for (const entry of rawCards) {
      const { name, dropRate } = entry.card.rarity;
      const existing = groups.get(name);
      if (existing) {
        existing.count++;
      } else {
        groups.set(name, { count: 1, dropRate });
      }
    }
    return Array.from(groups.entries())
      .sort(([, a], [, b]) => a.dropRate - b.dropRate)
      .map(([name, data]) => ({ name, ...data }));
  }, [rawCards]);

  const filteredCards = useMemo((): CollectionEntry[] => {
    let result = rawCards;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.card.name.toLowerCase().includes(q) ||
          e.card.character.toLowerCase().includes(q),
      );
    }
    if (filterRarity !== "all") {
      result = result.filter((e) => e.card.rarity.name === filterRarity);
    }
    switch (sortBy) {
      case "rarity":
        return [...result].sort(
          (a, b) => a.card.rarity.dropRate - b.card.rarity.dropRate,
        );
      case "name":
        return [...result].sort((a, b) =>
          a.card.name.localeCompare(b.card.name),
        );
      case "quantity":
        return [...result].sort((a, b) => b.quantity - a.quantity);
      case "newest":
        return [...result].sort(
          (a, b) =>
            new Date(b.obtainedAt).getTime() - new Date(a.obtainedAt).getTime(),
        );
      default:
        return result;
    }
  }, [rawCards, searchQuery, filterRarity, sortBy]);

  if (collectionQuery.isLoading) {
    return (
      <PageLoadingState
        title={t("nav.collection")}
        message={t("common.loadingStates.pageBody")}
        icon="albums"
      />
    );
  }

  if (collectionQuery.isError) {
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-danger">
          {collectionQuery.error.message}
        </Text>
      </View>
    );
  }

  const collection = collectionQuery.data;
  if (!collection) {
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-fgMuted">
          {t("collection.noCards")}
        </Text>
      </View>
    );
  }

  const listHeader = (
    <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
      {/* Title */}
      <Text
        style={{
          fontSize: 30,
          fontFamily: "Nunito_800ExtraBold",
          color: tc.primaryDark,
          textAlign: "center",
          marginBottom: 12,
          textShadowColor: "rgba(0,0,0,0.15)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
        }}
      >
        {t("collection.title")}
      </Text>

      {/* Dust pill — centered */}
      <View style={{ alignItems: "center", marginBottom: 8 }}>
        <Pressable
          onPress={() => setShowDustModal(true)}
          className="bg-secondaryTint"
          style={{
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 4,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <DustIcon size={16} color={tc.secondaryText} />
          <Text
            className="text-secondaryText"
            style={{ fontSize: 14, fontFamily: "Nunito_700Bold" }}
          >
            {t("collection.dust")}
          </Text>
          <Text
            className="text-secondaryText"
            style={{ fontSize: 14, fontFamily: "Nunito_700Bold" }}
          >
            {collection.dust}
          </Text>
        </Pressable>
      </View>

      {/* Stats button — centered, glassmorphic */}
      <View style={{ alignItems: "center", marginBottom: 16 }}>
        <Pressable
          onPress={() => setShowStatsModal(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: "rgba(255,255,255,0.6)",
            borderWidth: 1,
            borderColor: tc.primaryTint,
            borderRadius: 999,
            paddingHorizontal: 20,
            paddingVertical: 8,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <BarChartIcon size={20} color={tc.primaryText} />
          <Text
            style={{
              fontFamily: "Nunito_700Bold",
              fontSize: 14,
              color: tc.primaryText,
            }}
          >
            {t("collection.cardStats")}
          </Text>
          <View
            style={{
              backgroundColor: tc.primaryTint,
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                fontFamily: "Nunito_700Bold",
                fontSize: 12,
                color: tc.primaryStrong,
              }}
            >
              {collection.stats.uniqueOwned}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Search */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "rgba(255,255,255,0.7)",
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: tc.primaryBorder,
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 14, marginRight: 6, color: tc.muted }}>
          🔍
        </Text>
        <TextInput
          style={{
            flex: 1,
            fontFamily: "Nunito_400Regular",
            fontSize: 14,
            color: tc.fg,
          }}
          placeholder={t("collection.searchByNameOrCharacter")}
          placeholderTextColor={tc.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
            <Text style={{ fontSize: 16, color: tc.muted }}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Rarity pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 12 }}
      >
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => setFilterRarity("all")}
            style={{
              backgroundColor:
                filterRarity === "all" ? tc.accentDark : tc.accentTint,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              ...(filterRarity === "all"
                ? {
                    shadowColor: "#000",
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    elevation: 2,
                  }
                : {}),
            }}
          >
            <Text
              style={{
                fontFamily: "Nunito_600SemiBold",
                fontSize: 13,
                color: filterRarity === "all" ? tc.accentTint : tc.accentText,
              }}
            >
              {t("collection.all")} ({collection.cards.length})
            </Text>
          </Pressable>
          {rarityGroups.map(({ name, count }) => (
            <Pressable
              key={name}
              onPress={() => setFilterRarity(name)}
              style={{
                backgroundColor:
                  filterRarity === name ? tc.accentDark : tc.accentTint,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
                ...(filterRarity === name
                  ? {
                      shadowColor: "#000",
                      shadowOpacity: 0.15,
                      shadowRadius: 4,
                      elevation: 2,
                    }
                  : {}),
              }}
            >
              <Text
                style={{
                  fontFamily: "Nunito_600SemiBold",
                  fontSize: 13,
                  color: filterRarity === name ? tc.accentTint : tc.accentText,
                }}
              >
                {name} ({count})
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Sort button */}
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
      >
        <Pressable
          onPress={() => setShowSortModal(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: "rgba(255,255,255,0.6)",
            borderWidth: 1,
            borderColor: tc.primaryTint,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 6,
          }}
        >
          <Text
            style={{
              fontFamily: "Nunito_600SemiBold",
              fontSize: 13,
              color: tc.fg,
            }}
          >
            {t("collection.sortBy")}:{" "}
          </Text>
          <Text
            style={{
              fontFamily: "Nunito_700Bold",
              fontSize: 13,
              color: tc.primaryStrong,
            }}
          >
            {SORT_LABELS[sortBy]}
          </Text>
        </Pressable>
      </View>
    </View>
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

      <FlatList
        {...KEYBOARD_AWARE_SCROLL_PROPS}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomTabPadding }}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-evenly" }}
        data={filteredCards}
        keyExtractor={(entry: CollectionEntry) => entry.id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text
              className="text-primaryText"
              style={{
                fontFamily: "Nunito_600SemiBold",
                fontSize: 16,
                textAlign: "center",
              }}
            >
              {searchQuery || filterRarity !== "all"
                ? t("collection.noFilterMatches")
                : t("collection.empty")}
            </Text>
          </View>
        }
        renderItem={({ item }: { item: CollectionEntry }) => (
          <CardTile
            entry={item}
            accessToken={accessToken}
            onPress={() =>
              router.push({
                pathname: "/collection-card-detail",
                params: { cardId: item.cardId },
              })
            }
          />
        )}
      />

      {/* Stats Modal */}
      <Modal
        visible={showStatsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatsModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            padding: 24,
          }}
          onPress={() => setShowStatsModal(false)}
        >
          <View
            style={{
              backgroundColor: tc.surface,
              borderRadius: 16,
              padding: 24,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            }}
            onStartShouldSetResponder={() => true}
          >
            <Text
              style={{
                fontSize: 18,
                fontFamily: "Nunito_700Bold",
                color: tc.fg,
                textAlign: "center",
                marginBottom: 12,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: tc.accentBorder,
              }}
            >
              {t("collection.cardStats")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 12,
                marginTop: 4,
              }}
            >
              {rarityGroups.map(({ name, count }) => {
                const rc = RARITY_COLORS[name] ?? RARITY_COLORS.Common;
                return (
                  <View
                    key={name}
                    style={{
                      backgroundColor: tc.surfaceMuted,
                      borderRadius: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      flexGrow: 1,
                      flexBasis: "30%",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 24,
                        fontFamily: "Nunito_700Bold",
                        color: rc.from,
                      }}
                    >
                      {count}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "Nunito_600SemiBold",
                        color: tc.fgMuted,
                        marginTop: 2,
                      }}
                    >
                      {name}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Pressable
              onPress={() => setShowStatsModal(false)}
              style={{ marginTop: 20, borderRadius: 12, overflow: "hidden" }}
            >
              <LinearGradient
                colors={[tc.primary, tc.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 12, alignItems: "center" }}
              >
                <Text
                  style={{
                    fontFamily: "Nunito_700Bold",
                    color: tc.surface,
                    fontSize: 14,
                  }}
                >
                  {t("common.close")}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            padding: 24,
          }}
          onPress={() => setShowSortModal(false)}
        >
          <View
            style={{
              backgroundColor: tc.surface,
              borderRadius: 16,
              padding: 20,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            }}
            onStartShouldSetResponder={() => true}
          >
            <Text
              style={{
                fontSize: 18,
                fontFamily: "Nunito_700Bold",
                color: tc.fg,
                textAlign: "center",
                marginBottom: 12,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: tc.accentBorder,
              }}
            >
              {t("collection.sortTitle")}
            </Text>
            <View style={{ gap: 8 }}>
              {(["rarity", "name", "quantity", "newest"] as const).map(
                (option) => {
                  const isActive = sortBy === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        setSortBy(option);
                        setShowSortModal(false);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        borderWidth: 2,
                        backgroundColor: isActive
                          ? tc.primaryTint
                          : tc.surfaceMuted,
                        borderColor: isActive
                          ? tc.primaryBorder
                          : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: isActive
                            ? "Nunito_700Bold"
                            : "Nunito_600SemiBold",
                          fontSize: 15,
                          color: isActive ? tc.primaryStrong : tc.fg,
                        }}
                      >
                        {SORT_LABELS[option]}
                      </Text>
                      {isActive ? (
                        <Text
                          style={{
                            color: tc.primaryStrong,
                            fontSize: 16,
                            fontFamily: "Nunito_700Bold",
                          }}
                        >
                          ✓
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                },
              )}
            </View>
            <Pressable
              onPress={() => setShowSortModal(false)}
              style={{ marginTop: 16, borderRadius: 12, overflow: "hidden" }}
            >
              <LinearGradient
                colors={[tc.primary, tc.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 12, alignItems: "center" }}
              >
                <Text
                  style={{
                    fontFamily: "Nunito_700Bold",
                    color: tc.surface,
                    fontSize: 14,
                  }}
                >
                  {t("common.close")}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Dust Info Modal */}
      <Modal
        visible={showDustModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDustModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            padding: 24,
          }}
          onPress={() => setShowDustModal(false)}
        >
          <View
            style={{
              backgroundColor: tc.surface,
              borderRadius: 16,
              padding: 20,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            }}
            onStartShouldSetResponder={() => true}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <DustIcon size={22} color={tc.secondaryText} />
              <Text
                className="text-secondaryText"
                style={{
                  flex: 1,
                  fontSize: 18,
                  fontFamily: "Nunito_800ExtraBold",
                }}
              >
                {t("collection.dust")}
              </Text>
              <Pressable onPress={() => setShowDustModal(false)} hitSlop={8}>
                <Text style={{ fontSize: 18, color: tc.muted }}>✕</Text>
              </Pressable>
            </View>

            <Text
              style={{
                fontSize: 13,
                color: tc.fgMuted,
                fontFamily: "Nunito_400Regular",
                marginBottom: 20,
                lineHeight: 20,
              }}
            >
              {t("collection.dustModal.description")}
            </Text>

            {/* Table */}
            <View
              style={{
                borderRadius: 12,
                overflow: "hidden",
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 8,
              }}
            >
              {/* Header row */}
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: "rgba(253,224,71,0.15)",
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                }}
              >
                <Text
                  style={{
                    flex: 2,
                    fontFamily: "Nunito_700Bold",
                    color: tc.secondaryText,
                    fontSize: 12,
                  }}
                >
                  {t("collection.detail.rarity")}
                </Text>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 3,
                  }}
                >
                  <RecycleIcon size={14} color={tc.successText} />
                  <Text
                    style={{
                      fontFamily: "Nunito_700Bold",
                      color: tc.successText,
                      fontSize: 12,
                    }}
                  >
                    {t("collection.detail.recycle")}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 3,
                  }}
                >
                  <CraftIcon size={14} color={tc.primaryText} />
                  <Text
                    style={{
                      fontFamily: "Nunito_700Bold",
                      color: tc.primaryText,
                      fontSize: 12,
                    }}
                  >
                    {t("collection.detail.craft")}
                  </Text>
                </View>
              </View>
              {DUST_TABLE.map((row, idx) => {
                const rc = RARITY_COLORS[row.rarity] ?? RARITY_COLORS.Common;
                return (
                  <View
                    key={row.rarity}
                    style={{
                      flexDirection: "row",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      backgroundColor:
                        idx % 2 === 0 ? tc.surface : tc.surfaceMuted,
                    }}
                  >
                    <Text
                      style={{
                        flex: 2,
                        fontFamily: "Nunito_600SemiBold",
                        color: rc.from,
                        fontSize: 14,
                      }}
                    >
                      {row.rarity}
                    </Text>
                    <View
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 3,
                      }}
                    >
                      <DustIcon size={12} color={tc.successDark} />
                      <Text
                        style={{
                          fontFamily: "Nunito_700Bold",
                          color: tc.successDark,
                          fontSize: 14,
                        }}
                      >
                        {row.recycle}
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 3,
                      }}
                    >
                      <DustIcon size={12} color={tc.primaryText} />
                      <Text
                        style={{
                          fontFamily: "Nunito_700Bold",
                          color: tc.primaryText,
                          fontSize: 14,
                        }}
                      >
                        {row.craft}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
