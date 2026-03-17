import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
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
      <View style={styles.rowWrap}>
        <View style={[styles.tileWrap, { width: tileWidth }]}> 
          <View style={featured ? styles.featuredRing : styles.candidateWrap}>
            <AdminCardTile card={row.left} fitContainer />
            <Pressable
              disabled={!featured && maxReached}
              style={[
                styles.starButton,
                featured
                  ? null
                  : maxReached
                    ? styles.starButtonDisabled
                    : styles.starButtonMuted,
              ]}
              onPress={() =>
                toggleRef.current({ cardId: row.left.id, isFeatured: !featured })
              }
            >
              <Ionicons
                name={featured ? "star" : "star-outline"}
                size={16}
                color={featured ? "#FFFFFF" : maxReached ? "#6B7280" : "#A16207"}
              />
            </Pressable>
          </View>
        </View>
        {row.right ? (
          <View style={[styles.tileWrap, { width: tileWidth }]}> 
            <View
              style={[
                featured ? styles.featuredRing : styles.candidateWrap,
                !featured && maxReached ? styles.dimmed : null,
              ]}
            >
              <AdminCardTile card={row.right} fitContainer />
              <Pressable
                disabled={!featured && maxReached}
                style={[
                  styles.starButton,
                  featured
                    ? null
                    : maxReached
                      ? styles.starButtonDisabled
                      : styles.starButtonMuted,
                ]}
                onPress={() =>
                  toggleRef.current({ cardId: row.right!.id, isFeatured: !featured })
                }
              >
                <Ionicons
                  name={featured ? "star" : "star-outline"}
                  size={16}
                  color={featured ? "#FFFFFF" : maxReached ? "#6B7280" : "#A16207"}
                />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={{ width: tileWidth }} />
        )}
      </View>
    ),
    [maxReached, tileWidth],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeaturedListItem }) => {
      if (item.type === "featured-header") {
        return (
          <View style={styles.sectionPanel}>
            <AdminSectionTitle title={`Currently featured (${derived.featuredCards.length})`} />
            <View style={styles.sectionStateWrap}>
              {isCardsLoading ? (
                <Text style={styles.stateCopy}>Loading cards...</Text>
              ) : cardsError ? (
                <Text style={styles.errorCopy}>{cardsError}</Text>
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
          <View style={styles.sectionPanel}>
            <AdminSectionTitle title={`All cards (${derived.nonFeaturedCards.length})`} />
            <View style={styles.sectionStateWrap}>
              {isCardsLoading ? (
                <Text style={styles.stateCopy}>Loading cards...</Text>
              ) : cardsError ? (
                <Text style={styles.errorCopy}>{cardsError}</Text>
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
        <View style={{ height: 12 }} />
        <AdminSearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search featured candidates"
        />
        <View style={styles.metaRow}>
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
          <View style={styles.warningPanel}>
            <Text style={styles.warningText}>
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
      contentContainerStyle={styles.pageContent}
      ListHeaderComponent={listHeader}
      removeClippedSubviews
      windowSize={5}
      maxToRenderPerBatch={6}
      initialNumToRender={8}
    />
  );
}

const styles = StyleSheet.create({
  pageContent: {
    paddingHorizontal: SCREEN_SIDE_PADDING,
    paddingTop: 8,
    paddingBottom: CONTENT_BOTTOM_PADDING,
    gap: 16,
  },
  metaRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  warningPanel: {
    marginTop: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  warningText: {
    fontFamily: "Nunito_700Bold",
    fontSize: 13,
    color: "#A16207",
  },
  sectionPanel: {
    marginTop: 16,
  },
  sectionStateWrap: {
    marginTop: 12,
  },
  stateCopy: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
  errorCopy: {
    fontFamily: "Nunito_700Bold",
    fontSize: 13,
    color: "#BE123C",
    textAlign: "center",
  },
  rowWrap: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: GRID_GAP,
    paddingHorizontal: PANEL_INNER_PADDING,
  },
  tileWrap: {
    alignItems: "center",
  },
  featuredRing: {
    borderWidth: 2,
    borderColor: "#FACC15",
    borderRadius: 18,
    padding: 0,
  },
  candidateWrap: {
    position: "relative",
  },
  starButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#CA8A04",
  },
  starButtonMuted: {
    backgroundColor: "rgba(255,255,255,0.86)",
  },
  starButtonDisabled: {
    backgroundColor: "rgba(209,213,219,0.9)",
  },
  dimmed: {
    opacity: 0.55,
  },
});
