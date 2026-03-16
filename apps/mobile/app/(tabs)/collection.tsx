import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";

import type { CollectionResponse } from "@adventure-time/shared";
import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { CardDetailModal } from "../../src/components/card-detail-modal";
import { CardTile } from "../../src/components/card-tile";
import { RARITY_COLORS } from "../../src/components/theme";
import { DustIcon, RecycleIcon, CraftIcon } from "../../src/components/icons";
import { useTranslation } from "../../src/i18n";

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
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((state) => state.accessToken);
  const { t } = useTranslation();

  const [filterRarity, setFilterRarity] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "rarity" | "name" | "quantity" | "newest"
  >("rarity");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<CollectionEntry | null>(
    null,
  );
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showDustModal, setShowDustModal] = useState(false);

  const collectionQuery = useQuery({
    queryKey: ["collection"],
    queryFn: () => apiClient.collection(),
  });

  const recycleMutation = useMutation({
    mutationFn: ({ cardId, quantity }: { cardId: string; quantity: number }) =>
      apiClient.recycleCard(cardId, quantity),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
    },
  });

  const craftMutation = useMutation({
    mutationFn: (cardId: string) => apiClient.craftCard(cardId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
    },
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
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-fgMuted">{t("common.loading")}</Text>
      </View>
    );
  }

  if (collectionQuery.isError) {
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-red-600">
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

  const handleRecycle = async (cardId: string, quantity: number) => {
    try {
      await recycleMutation.mutateAsync({ cardId, quantity });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Recycle failed",
      };
    }
  };

  const handleCraft = async (cardId: string) => {
    try {
      await craftMutation.mutateAsync(cardId);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Craft failed",
      };
    }
  };

  const listHeader = (
    <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
      {/* Title */}
      <Text
        style={{
          fontSize: 30,
          fontFamily: "Nunito_800ExtraBold",
          color: "#111827",
          marginBottom: 12,
        }}
      >
        {t("collection.title")}
      </Text>

      {/* Dust + Stats pills */}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <Pressable
          onPress={() => setShowDustModal(true)}
          style={{
            backgroundColor: "#FEF9C3",
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 14 }}>✨</Text>
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Nunito_700Bold",
              color: "#92400E",
            }}
          >
            {collection.dust} {t("native.collection.dust")}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setShowStatsModal(true)}
          style={{
            backgroundColor: "#EDE9FE",
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 14 }}>📊</Text>
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Nunito_700Bold",
              color: "#5B21B6",
            }}
          >
            {t("native.collection.cardStats")} ({collection.stats.uniqueOwned})
          </Text>
        </Pressable>
      </View>

      {/* Search */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#F9FAFB",
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: "#E5E7EB",
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 14, marginRight: 6, color: "#9CA3AF" }}>
          🔍
        </Text>
        <TextInput
          style={{
            flex: 1,
            fontFamily: "Nunito_400Regular",
            fontSize: 14,
            color: "#111827",
          }}
          placeholder={t("native.collection.searchByNameOrCharacter")}
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
            <Text style={{ fontSize: 16, color: "#9CA3AF" }}>✕</Text>
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
              backgroundColor: filterRarity === "all" ? "#7C3AED" : "#EDE9FE",
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text
              style={{
                fontFamily: "Nunito_600SemiBold",
                fontSize: 13,
                color: filterRarity === "all" ? "#fff" : "#5B21B6",
              }}
            >
              {t("native.collection.all")} ({collection.cards.length})
            </Text>
          </Pressable>
          {rarityGroups.map(({ name, count }) => (
            <Pressable
              key={name}
              onPress={() => setFilterRarity(name)}
              style={{
                backgroundColor: filterRarity === name ? "#7C3AED" : "#EDE9FE",
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: "Nunito_600SemiBold",
                  fontSize: 13,
                  color: filterRarity === name ? "#fff" : "#5B21B6",
                }}
              >
                {name} ({count})
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Sort by */}
      <Pressable
        onPress={() => setShowSortModal(true)}
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
      >
        <Text
          style={{
            fontFamily: "Nunito_600SemiBold",
            fontSize: 13,
            color: "#6B7280",
          }}
        >
          {t("native.collection.sortBy")}:{" "}
        </Text>
        <Text
          style={{
            fontFamily: "Nunito_700Bold",
            fontSize: 13,
            color: "#7C3AED",
          }}
        >
          {SORT_LABELS[sortBy]} ▼
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View className="flex-1 bg-bg">
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-evenly" }}
        data={filteredCards}
        keyExtractor={(entry: CollectionEntry) => entry.id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text
              style={{
                fontFamily: "Nunito_600SemiBold",
                color: "#DB2777",
                fontSize: 16,
                textAlign: "center",
              }}
            >
              {searchQuery || filterRarity !== "all"
                ? t("native.collection.noFilterMatches")
                : t("native.collection.empty")}
            </Text>
          </View>
        }
        renderItem={({ item }: { item: CollectionEntry }) => (
          <CardTile
            entry={item}
            accessToken={accessToken}
            onPress={() => setSelectedEntry(item)}
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
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 24,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 12,
            }}
            onStartShouldSetResponder={() => true}
          >
            <Text
              style={{
                fontSize: 18,
                fontFamily: "Nunito_800ExtraBold",
                color: "#111827",
                textAlign: "center",
                marginBottom: 12,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: "#F3F4F6",
              }}
            >
              {t("native.collection.cardStats")}
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
                      backgroundColor: "#F9FAFB",
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
                        fontFamily: "Nunito_800ExtraBold",
                        color: rc.from,
                      }}
                    >
                      {count}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "Nunito_600SemiBold",
                        color: "#6B7280",
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
                colors={["#F472B6", "#EC4899"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 12, alignItems: "center" }}
              >
                <Text
                  style={{
                    fontFamily: "Nunito_700Bold",
                    color: "#fff",
                    fontSize: 14,
                  }}
                >
                  Close
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
            style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20 }}
            onStartShouldSetResponder={() => true}
          >
            <Text
              style={{
                fontSize: 20,
                fontFamily: "Nunito_800ExtraBold",
                color: "#111827",
                marginBottom: 12,
              }}
            >
              {t("native.collection.sortTitle")}
            </Text>
            {(["rarity", "name", "quantity", "newest"] as const).map(
              (option, idx, arr) => (
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
                    borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                    borderBottomColor: "#F3F4F6",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Nunito_600SemiBold",
                      fontSize: 15,
                      color: sortBy === option ? "#7C3AED" : "#374151",
                    }}
                  >
                    {SORT_LABELS[option]}
                  </Text>
                  {sortBy === option ? (
                    <Text style={{ color: "#7C3AED", fontSize: 16 }}>✓</Text>
                  ) : null}
                </Pressable>
              ),
            )}
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
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 20,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 12,
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
              <DustIcon size={22} color="#92400E" />
              <Text
                style={{
                  flex: 1,
                  fontSize: 18,
                  fontFamily: "Nunito_800ExtraBold",
                  color: "#92400E",
                }}
              >
                {t("native.collection.dust")}
              </Text>
              <Pressable onPress={() => setShowDustModal(false)} hitSlop={8}>
                <Text style={{ fontSize: 18, color: "#9CA3AF" }}>✕</Text>
              </Pressable>
            </View>

            <Text
              style={{
                fontSize: 13,
                color: "#6B7280",
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
                    color: "#92400E",
                    fontSize: 12,
                  }}
                >
                  {t("native.cardDetail.rarity")}
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
                  <RecycleIcon size={14} color="#065F46" />
                  <Text
                    style={{
                      fontFamily: "Nunito_700Bold",
                      color: "#065F46",
                      fontSize: 12,
                    }}
                  >
                    {t("native.cardDetail.recycle")}
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
                  <CraftIcon size={14} color="#DB2777" />
                  <Text
                    style={{
                      fontFamily: "Nunito_700Bold",
                      color: "#DB2777",
                      fontSize: 12,
                    }}
                  >
                    {t("native.cardDetail.craft")}
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
                      backgroundColor: idx % 2 === 0 ? "#fff" : "#F9FAFB",
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
                      <DustIcon size={12} color="#059669" />
                      <Text
                        style={{
                          fontFamily: "Nunito_700Bold",
                          color: "#059669",
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
                      <DustIcon size={12} color="#DB2777" />
                      <Text
                        style={{
                          fontFamily: "Nunito_700Bold",
                          color: "#DB2777",
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

      {/* Card Detail Modal */}
      <CardDetailModal
        entry={selectedEntry}
        dust={collection.dust}
        onClose={() => setSelectedEntry(null)}
        onRecycle={handleRecycle}
        onCraft={handleCraft}
        accessToken={accessToken}
      />
    </View>
  );
}
