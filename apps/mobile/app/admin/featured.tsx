import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  InteractionManager,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AdminCardsResponse } from "@adventure-time/api-client";

import { CardTile } from "../../src/components/card-tile";
import { withAlpha } from "../../src/components/admin/admin-palette";
import {
  AdminButton,
  AdminChip,
  AdminEmptyState,
  AdminHero,
  AdminLoadingState,
  AdminNotice,
  AdminPanel,
  AdminSearchInput,
  AdminSectionTitle,
  AdminStat,
} from "../../src/components/admin/admin-ui";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../../src/components/keyboard-aware-scroll-props";
import { useTranslation } from "../../src/i18n";
import { prefetchCardImages } from "../../src/lib/card-images";
import { apiClient } from "../../src/lib/api";
import { useThemeStore } from "../../src/stores/theme-store";
import { THEME_COLORS } from "../../src/theme/themes";

const SCREEN_SIDE_PADDING = 16;
const CONTENT_BOTTOM_PADDING = 132;
const SELECTED_CARD_WIDTH = 118;
const ROW_CARD_WIDTH = 82;

const styles = StyleSheet.create({
  selectedCard: {
    width: SELECTED_CARD_WIDTH,
  },
});

type AdminCard = AdminCardsResponse["cards"][number];

type FeaturedListItem = {
  id: string;
  card: AdminCard;
};

const keyExtractor = (item: FeaturedListItem) => item.id;
const cardKeyExtractor = (card: AdminCard) => card.id;

const SelectedFeaturedCard = memo(function SelectedFeaturedCard({
  card,
  disabled,
  onRemove,
  removeLabel,
}: {
  card: AdminCard;
  disabled: boolean;
  onRemove: (card: AdminCard) => void;
  removeLabel: string;
}) {
  const handlePress = useCallback(() => {
    onRemove(card);
  }, [card, onRemove]);

  return (
    <View className="gap-2" style={styles.selectedCard}>
      <CardTile card={card} fitContainer />
      <AdminButton
        label={removeLabel}
        icon="remove-circle-outline"
        variant="danger"
        disabled={disabled}
        onPress={handlePress}
      />
    </View>
  );
});

export default function AdminFeaturedScreen() {
  return useAdminFeaturedScreenView();
}

function useAdminFeaturedScreenView() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];
  const { t } = useTranslation();

  const { data: cardsQueryData, error: cardsQueryError, isLoading: cardsQueryIsLoading } = useQuery({
    queryKey: ["admin-cards"],
    queryFn: () => apiClient.adminCards(),
  });
  const toggleMutation = useMutation({
    mutationFn: ({
      cardId,
      isFeatured,
    }: {
      cardId: string;
      isFeatured: boolean;
    }) => apiClient.updateAdminCard(cardId, { isFeatured }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-cards"] });
    },
  });

  const cards = useMemo(
    () => cardsQueryData?.cards ?? [],
    [cardsQueryData?.cards],
  );
  const isCardsLoading = cardsQueryIsLoading;
  const cardsError =
    cardsQueryError instanceof Error ? cardsQueryError.message : null;

  const toggleRef = useRef(toggleMutation.mutate);
  toggleRef.current = toggleMutation.mutate;

  const prefetchKey = useMemo(
    () =>
      cards
        .slice(0, 48)
        .flatMap((card) => (card.imageAssetId ? [card.imageAssetId] : []))
        .join(","),
    [cards],
  );

  useEffect(() => {
    if (!prefetchKey) {
      return undefined;
    }

    const handle = InteractionManager.runAfterInteractions(() => {
      void prefetchCardImages(prefetchKey.split(","));
    });

    return () => handle.cancel();
  }, [prefetchKey]);

  const derived = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const activeCards = cards.filter((card) => !card.isArchived);
    const featuredCards = activeCards.filter((card) => card.isFeatured);
    const visibleCards = activeCards.filter((card) => {
      if (!query) {
        return true;
      }

      return `${card.name} ${card.character}`.toLowerCase().includes(query);
    });

    return { featuredCards, visibleCards };
  }, [cards, searchQuery]);

  const maxReached = derived.featuredCards.length >= 5;
  const listData = useMemo(
    () =>
      derived.visibleCards.map((card) => ({
        id: card.id,
        card,
      })),
    [derived.visibleCards],
  );

  const toggleFeatured = useCallback((card: AdminCard) => {
    toggleRef.current({
      cardId: card.id,
      isFeatured: !card.isFeatured,
    });
  }, []);

  const renderSelectedCard = useCallback(
    ({ item }: { item: AdminCard }) => (
      <SelectedFeaturedCard
        card={item}
        disabled={toggleMutation.isPending}
        onRemove={toggleFeatured}
        removeLabel={t("admin.featured.removeAction")}
      />
    ),
    [t, toggleFeatured, toggleMutation.isPending],
  );

  const selectedStrip = useMemo(
    () => (
      <AdminPanel>
        <AdminSectionTitle
          title={t("admin.featured.currentTitle", {
            count: derived.featuredCards.length,
          })}
          subtitle={t("admin.featured.currentSubtitle")}
          right={
            <AdminChip
              label={t("admin.featured.featuredCount", {
                count: isCardsLoading ? "..." : derived.featuredCards.length,
              })}
              tone="warning"
            />
          }
        />

        {!isCardsLoading && !cardsError && !derived.featuredCards.length ? (
          <View className="mt-3">
            <AdminEmptyState
              icon="albums-outline"
              title={t("admin.featured.noFeaturedTitle")}
              body={t("admin.featured.noFeaturedBody")}
            />
          </View>
        ) : null}

        {derived.featuredCards.length ? (
          <FlatList
            horizontal
            data={derived.featuredCards}
            keyExtractor={cardKeyExtractor}
            renderItem={renderSelectedCard}
            showsHorizontalScrollIndicator={false}
            className="mt-4 -mx-4"
            contentContainerStyle={{
              gap: 12,
              paddingHorizontal: 16,
              paddingBottom: 2,
            }}
          />
        ) : null}
      </AdminPanel>
    ),
    [cardsError, derived.featuredCards, isCardsLoading, renderSelectedCard, t],
  );

  const listHeader = useMemo(
    () => (
      <View className="gap-4">
        <AdminHero
          title={t("admin.featured.title")}
          subtitle={t("admin.featured.subtitle")}
        >
          <View className="flex-row flex-wrap gap-3">
            <AdminStat
              label={t("admin.featured.selectedLabel")}
              value={String(derived.featuredCards.length)}
              tone="warning"
            />
            <AdminStat
              label={t("admin.featured.slotsLeftLabel")}
              value={String(Math.max(0, 5 - derived.featuredCards.length))}
              tone="info"
            />
          </View>
          <AdminSearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("admin.featured.searchPlaceholder")}
          />
        </AdminHero>

        {cardsError ? (
          <AdminPanel>
            <Text className="font-nunito-bold text-[13px] text-dangerText">
              {cardsError}
            </Text>
          </AdminPanel>
        ) : isCardsLoading ? (
          <AdminPanel>
            <AdminLoadingState
              title={t("admin.featured.loading")}
              body={t("common.loadingStates.adminBody")}
              icon="albums-outline"
            />
          </AdminPanel>
        ) : maxReached ? (
          <AdminNotice
            title={t("admin.featured.limitTitle")}
            body={t("admin.featured.maxReached")}
            tone="warning"
            icon="lock-closed-outline"
          />
        ) : (
          <AdminNotice
            title={t("admin.featured.guidanceTitle")}
            body={t("admin.featured.guidanceBody")}
            tone="info"
            icon="sparkles-outline"
          />
        )}

        {selectedStrip}

        <AdminPanel chrome="soft">
          <AdminSectionTitle
            title={t("admin.featured.allCardsTitle", {
              count: derived.visibleCards.length,
            })}
            subtitle={t("admin.featured.allCardsSubtitle")}
          />
        </AdminPanel>
      </View>
    ),
    [
      cardsError,
      derived.featuredCards.length,
      derived.visibleCards.length,
      isCardsLoading,
      maxReached,
      searchQuery,
      selectedStrip,
      t,
    ],
  );

  const listEmpty = useMemo(() => {
    if (isCardsLoading || cardsError) {
      return null;
    }

    return (
      <AdminPanel>
        <AdminEmptyState
          icon="search"
          title={t("admin.featured.noMatchesTitle")}
          body={t("admin.featured.noMatchesBody")}
        />
      </AdminPanel>
    );
  }, [cardsError, isCardsLoading, t]);

  const renderItem = useCallback(
    ({ item }: { item: FeaturedListItem }) => {
      const card = item.card;
      const featured = Boolean(card.isFeatured);
      const cannotAdd = !featured && maxReached;
      const disabled = toggleMutation.isPending || cannotAdd;

      return (
        <View
          className="flex-row gap-3 rounded-[24] border bg-surface p-3"
          style={{
            borderColor: featured
              ? tc.secondaryBorder
              : withAlpha(tc.primaryBorder, "66"),
            opacity: cannotAdd ? 0.68 : 1,
          }}
        >
          <View style={{ width: ROW_CARD_WIDTH }}>
            <CardTile card={card} fitContainer />
          </View>

          <View className="min-w-0 flex-1 gap-2">
            <View className="gap-[2]">
              <Text
                className="font-nunito-extrabold text-base leading-5 text-fg"
                numberOfLines={1}
              >
                {card.name}
              </Text>
              <Text
                className="font-nunito-semibold text-xs text-fgMuted"
                numberOfLines={1}
              >
                {card.character}
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
              {featured ? (
                <AdminChip
                  label={t("admin.featured.selectedBadge")}
                  tone="warning"
                />
              ) : null}
              <AdminChip label={card.rarityName} tone="default" />
              <AdminChip label={card.type} tone="info" />
            </View>

            <Text
              className="font-nunito-semibold text-xs leading-[17px] text-fgMuted"
              numberOfLines={2}
            >
              {card.description}
            </Text>

            <AdminButton
              label={
                featured
                  ? t("admin.featured.removeAction")
                  : cannotAdd
                    ? t("admin.featured.fullAction")
                    : t("admin.featured.addAction")
              }
              icon={featured ? "remove-circle-outline" : "add-circle-outline"}
              variant={featured ? "danger" : cannotAdd ? "ghost" : "primary"}
              disabled={disabled}
              onPress={() => toggleFeatured(card)}
              style={{ marginTop: 4 }}
            />
          </View>
        </View>
      );
    },
    [maxReached, t, tc, toggleFeatured, toggleMutation.isPending],
  );

  return (
    <FlatList
      {...KEYBOARD_AWARE_SCROLL_PROPS}
      data={listData}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: SCREEN_SIDE_PADDING,
        paddingTop: 8,
        paddingBottom: CONTENT_BOTTOM_PADDING,
        gap: 12,
      }}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      removeClippedSubviews={false}
      windowSize={7}
      maxToRenderPerBatch={8}
      initialNumToRender={8}
    />
  );
}
