import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../src/lib/api";
import { AdminCardTile } from "../../src/components/admin/admin-card-tile";
import {
  AdminButton,
  AdminChip,
  AdminEmptyState,
  AdminPageScroll,
  AdminPanel,
  AdminSearchInput,
  AdminSectionTitle,
} from "../../src/components/admin/admin-ui";

export default function AdminFeaturedScreen() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const cardsQuery = useQuery({ queryKey: ["admin-cards"], queryFn: () => apiClient.adminCards() });
  const toggleMutation = useMutation({
    mutationFn: ({ cardId, isFeatured }: { cardId: string; isFeatured: boolean }) =>
      apiClient.updateAdminCard(cardId, { isFeatured }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-cards"] });
    },
  });

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (cardsQuery.data?.cards ?? []).filter((card) => {
      if (!query) return true;
      return `${card.name} ${card.character}`.toLowerCase().includes(query);
    });
  }, [cardsQuery.data?.cards, searchQuery]);

  const featuredCards = filtered.filter((card) => card.isFeatured && !card.isArchived);
  const nonFeaturedCards = filtered.filter((card) => !card.isFeatured && !card.isArchived);
  const maxReached = featuredCards.length >= 5;

  return (
    <AdminPageScroll>
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
          <AdminChip label={`${featuredCards.length} / 5 featured`} tone="warning" />
          <AdminChip label={`${nonFeaturedCards.length} waiting`} tone="default" />
        </View>
      </AdminPanel>

      <AdminPanel>
        <AdminSectionTitle title={`Currently featured (${featuredCards.length})`} />
        <View style={styles.grid}>
          {featuredCards.length ? (
            featuredCards.map((card) => (
              <View key={card.id} style={styles.tileWrap}>
                <View style={styles.featuredRing}>
                  <AdminCardTile card={card} />
                  <Pressable
                    style={styles.starButton}
                    onPress={() => toggleMutation.mutate({ cardId: card.id, isFeatured: false })}
                  >
                    <Ionicons name="star" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
                <AdminButton label="Remove" variant="warning" onPress={() => toggleMutation.mutate({ cardId: card.id, isFeatured: false })} />
              </View>
            ))
          ) : (
            <AdminEmptyState icon="star-outline" title="No featured cards" body="Tap any card below to promote it into the featured set." />
          )}
        </View>
      </AdminPanel>

      <AdminPanel>
        <AdminSectionTitle title={`All cards (${nonFeaturedCards.length})`} subtitle={maxReached ? "Maximum of five featured cards reached. Remove one above before adding another." : undefined} />
        <View style={styles.grid}>
          {nonFeaturedCards.length ? (
            nonFeaturedCards.map((card) => (
              <View key={card.id} style={styles.tileWrap}>
                <View style={[maxReached ? styles.dimmed : null]}>
                  <AdminCardTile card={card} />
                  <Pressable
                    disabled={maxReached}
                    style={[styles.starButton, maxReached ? styles.starButtonDisabled : styles.starButtonMuted]}
                    onPress={() => toggleMutation.mutate({ cardId: card.id, isFeatured: true })}
                  >
                    <Ionicons name="star-outline" size={16} color={maxReached ? "#6B7280" : "#A16207"} />
                  </Pressable>
                </View>
                <AdminButton
                  label="Feature"
                  variant="secondary"
                  disabled={maxReached}
                  onPress={() => toggleMutation.mutate({ cardId: card.id, isFeatured: true })}
                />
              </View>
            ))
          ) : (
            <AdminEmptyState icon="search" title="No cards match" body="Clear the search or add more cards on the cards tab." />
          )}
        </View>
      </AdminPanel>
    </AdminPageScroll>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  grid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
  },
  tileWrap: {
    width: "48%",
    gap: 8,
    alignItems: "center",
  },
  featuredRing: {
    borderWidth: 4,
    borderColor: "#FACC15",
    borderRadius: 18,
    padding: 2,
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
