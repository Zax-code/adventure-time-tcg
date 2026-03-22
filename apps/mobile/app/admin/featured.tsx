import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AdminCardsResponse } from "@adventure-time/shared";

import { apiClient } from "../../src/lib/api";
import { prefetchCardImages } from "../../src/lib/card-images";
import { AdminCardTile } from "../../src/components/admin/admin-card-tile";
import {
  AdminChip,
  AdminEmptyState,
  AdminPanel,
  AdminSearchInput,
  AdminSectionTitle,
} from "../../src/components/admin/admin-ui";
import { useThemeStore } from "../../src/stores/theme-store";
import { THEME_COLORS } from "../../src/theme/themes";

const GRID_GAP = 12;
const SCREEN_SIDE_PADDING = 16;
const PANEL_INNER_PADDING = 16;
const CONTENT_BOTTOM_PADDING = 128;

type AdminCard = AdminCardsResponse["cards"][number];

type CardRow = {
  id: string;
  left: AdminCard;
  right?: AdminCard;
};

type FeaturedListItem =
  | { id: string; type: "featured-header" }
  | { id: string; type: "featured-row"; row: CardRow }
  | { id: string; type: "candidate-header" }
  | { id: string; type: "candidate-row"; row: CardRow };

const keyExtractor = (item: FeaturedListItem) => item.id;

function getFeaturedTileWidth(screenWidth: number) {
  const availableWidth = screenWidth - SCREEN_SIDE_PADDING * 2 - PANEL_INNER_PADDING * 2;
  return Math.floor((availableWidth - GRID_GAP) / 2) - 2;
}

function chunkCards(cards: AdminCard[]) {
  const rows: CardRow[] = [];

  for (let index = 0; index < cards.length; index += 2) {
    rows.push({
      id: `row-${cards[index].id}-${cards[index + 1]?.id ?? "empty"}`,
      left: cards[index],
      right: cards[index + 1],
    });
  }

  return rows;
}

export default function AdminFeaturedScreen() {
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState("");
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];

  const cardsQuery = useQuery({
    queryKey: ["admin-cards"],
    queryFn: () => apiClient.adminCards(),
  });
  const toggleMutation = useMutation({
    mutationFn: ({ cardId, isFeatured }: { cardId: string; isFeatured: boolean }) =>
      apiClient.updateAdminCard(cardId, { isFeatured }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-cards"] });
    },
  });

  const cards = cardsQuery.data?.cards ?? [];
  const tileWidth = getFeaturedTileWidth(width);
  const isCardsLoading = cardsQuery.isLoading;
  const cardsError = cardsQuery.error instanceof Error ? cardsQuery.error.message : null;

  // Stable ref for mutation so renderRow's useCallback doesn't depend on toggleMutation object
  const toggleRef = useRef(toggleMutation.mutate);
  toggleRef.current = toggleMutation.mutate;

  // Stabilize prefetch — key on a joined string of asset IDs, not the array reference
  const prefetchKey = useMemo(
    () => cards.slice(0, 48).map((c) => c.imageAssetId).filter(Boolean).join(","),
    [cards],
  );
  useEffect(() => {
    if (prefetchKey) {
      void prefetchCardImages(prefetchKey.split(","));
    }
  }, [prefetchKey]);

  const derived = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const featuredCards: AdminCard[] = [];
    const nonFeaturedCards: AdminCard[] = [];

    for (const card of cards) {
      if (card.isArchived) {
        continue;
      }

      if (query && !`${card.name} ${card.character}`.toLowerCase().includes(query)) {
        continue;
      }

      if (card.isFeatured) {
        featuredCards.push(card);
      } else {
        nonFeaturedCards.push(card);
      }
    }

    return { featuredCards, nonFeaturedCards };
  }, [cards, searchQuery]);

  const maxReached = derived.featuredCards.length >= 5;

  const listData = useMemo(() => {
    const items: FeaturedListItem[] = [{ id: "featured-header", type: "featured-header" }];
    chunkCards(derived.featuredCards).forEach((row) => {
      items.push({ id: `featured-${row.id}`, type: "featured-row", row });
    });
    items.push({ id: "candidate-header", type: "candidate-header" });
    chunkCards(derived.nonFeaturedCards).forEach((row) => {
      items.push({ id: `candidate-${row.id}`, type: "candidate-row", row });
    });
    return items;
  }, [derived.featuredCards, derived.nonFeaturedCards]);

  const renderRow = useCallback(
    (row: CardRow, featured: boolean) => (
      <View className="mt-3 flex-row justify-between gap-3 px-4">
        <View className="items-center" style={{ width: tileWidth }}>
          <View
            className={featured ? "border-2 rounded-[18]" : "relative"}
            style={featured ? { borderColor: tc.secondaryDark } : undefined}
          >
            <AdminCardTile card={row.left} fitContainer />
            <Pressable
              disabled={!featured && maxReached}
              className="absolute -top-2 -right-2 w-8 h-8 rounded-full items-center justify-center"
              style={{
                backgroundColor: featured
                  ? tc.secondaryText
                  : maxReached
                    ? "rgba(209,213,219,0.9)"
                    : tc.surfaceMuted,
              }}
              onPress={() =>
                toggleRef.current({ cardId: row.left.id, isFeatured: !featured })
              }
            >
              <Ionicons
                name={featured ? "star" : "star-outline"}
                size={16}
                color={featured ? "#FFFFFF" : maxReached ? tc.fgMuted : tc.secondaryText}
              />
            </Pressable>
          </View>
        </View>
        {row.right ? (
          <View
            className="items-center"
            style={{ width: tileWidth, opacity: !featured && maxReached ? 0.55 : 1 }}
          >
            <View
              className={featured ? "border-2 rounded-[18]" : "relative"}
              style={featured ? { borderColor: tc.secondaryDark } : undefined}
            >
              <AdminCardTile card={row.right} fitContainer />
              <Pressable
                disabled={!featured && maxReached}
                className="absolute -top-2 -right-2 w-8 h-8 rounded-full items-center justify-center"
                style={{
                  backgroundColor: featured
                    ? tc.secondaryText
                    : maxReached
                      ? "rgba(209,213,219,0.9)"
                      : tc.surfaceMuted,
                }}
                onPress={() =>
                  toggleRef.current({ cardId: row.right!.id, isFeatured: !featured })
                }
              >
                <Ionicons
                  name={featured ? "star" : "star-outline"}
                  size={16}
                  color={featured ? "#FFFFFF" : maxReached ? tc.fgMuted : tc.secondaryText}
                />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={{ width: tileWidth }} />
        )}
      </View>
    ),
    [maxReached, tileWidth, tc],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeaturedListItem }) => {
      if (item.type === "featured-header") {
        return (
          <View className="mt-4">
            <AdminSectionTitle title={`Currently featured (${derived.featuredCards.length})`} />
            <View className="mt-3">
              {isCardsLoading ? (
                <Text className="font-nunito-semibold text-[13px] text-fgMuted text-center">Loading cards...</Text>
              ) : cardsError ? (
                <Text className="font-nunito-bold text-[13px] text-dangerText text-center">{cardsError}</Text>
              ) : derived.featuredCards.length ? null : (
                <AdminEmptyState
                  icon="star-outline"
                  title="No featured cards"
                  body="Tap any card below to promote it into the featured set."
                />
              )}
            </View>
          </View>
        );
      }

      if (item.type === "candidate-header") {
        return (
          <View className="mt-4">
            <AdminSectionTitle title={`All cards (${derived.nonFeaturedCards.length})`} />
            <View className="mt-3">
              {isCardsLoading ? (
                <Text className="font-nunito-semibold text-[13px] text-fgMuted text-center">Loading cards...</Text>
              ) : cardsError ? (
                <Text className="font-nunito-bold text-[13px] text-dangerText text-center">{cardsError}</Text>
              ) : derived.nonFeaturedCards.length ? null : (
                <AdminEmptyState
                  icon="search"
                  title="No cards match"
                  body="Clear the search or add more cards on the cards tab."
                />
              )}
            </View>
          </View>
        );
      }

      return renderRow(item.row, item.type === "featured-row");
    },
    [cardsError, derived.featuredCards.length, derived.nonFeaturedCards.length, isCardsLoading, renderRow],
  );

  const listHeader = useMemo(
    () => (
      <AdminPanel>
        <AdminSectionTitle
          title="Featured cards"
          subtitle="Highlight the showcase roster exactly like the PWA carousel selection flow."
        />
        <View className="h-3" />
        <AdminSearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search featured candidates"
        />
        <View className="mt-3 flex-row gap-2 flex-wrap">
          <AdminChip
            label={`${isCardsLoading ? "..." : derived.featuredCards.length} / 5 featured`}
            tone="warning"
          />
          <AdminChip
            label={`${isCardsLoading ? "..." : derived.nonFeaturedCards.length} waiting`}
            tone="default"
          />
        </View>
        {maxReached ? (
          <View className="mt-3 rounded-2xl px-[14] py-3 bg-secondaryTint border border-secondaryBorder">
            <Text className="font-nunito-bold text-[13px] text-secondaryText">
              Maximum of five featured cards reached. Remove one above before adding another.
            </Text>
          </View>
        ) : null}
      </AdminPanel>
    ),
    [searchQuery, derived.featuredCards.length, derived.nonFeaturedCards.length, isCardsLoading, maxReached],
  );

  return (
    <FlatList
      data={listData}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: SCREEN_SIDE_PADDING,
        paddingTop: 8,
        paddingBottom: CONTENT_BOTTOM_PADDING,
        gap: 16,
      }}
      ListHeaderComponent={listHeader}
      removeClippedSubviews
      windowSize={5}
      maxToRenderPerBatch={6}
      initialNumToRender={8}
    />
  );
}
