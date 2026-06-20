import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  InteractionManager,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import type { AdminCardsResponse } from "@adventure-time/api-client";

import { AdminCardTile } from "../../src/components/admin/admin-card-tile";
import {
  AdminButton,
  AdminChip,
  AdminEmptyState,
  AdminHero,
  AdminLoadingState,
  AdminModal,
  AdminNotice,
  AdminPanel,
  AdminSearchInput,
  AdminSectionTitle,
  AdminStat,
} from "../../src/components/admin/admin-ui";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../../src/components/keyboard-screen-view";
import { useTranslation } from "../../src/i18n";
import { prefetchCardImages } from "../../src/lib/card-images";
import { apiClient } from "../../src/lib/api";
import { useThemeStore } from "../../src/stores/theme-store";
import { THEME_COLORS } from "../../src/theme/themes";

const GRID_GAP = 12;
const SCREEN_SIDE_PADDING = 16;
const COLLECTION_SIDE_PADDING = 12;
const CONTENT_BOTTOM_PADDING = 132;

type AdminCard = AdminCardsResponse["cards"][number];

type CardRow = {
  id: string;
  left: AdminCard;
  right?: AdminCard;
};

type CardsListItem =
  | { id: string; type: "active-header" }
  | { id: string; type: "active-row"; row: CardRow }
  | { id: string; type: "archived-header" }
  | { id: string; type: "archived-row"; row: CardRow };

const keyExtractor = (item: CardsListItem) => item.id;

function getTwoColumnWidth(screenWidth: number) {
  const availableWidth =
    screenWidth - SCREEN_SIDE_PADDING * 2 - COLLECTION_SIDE_PADDING * 2;

  return Math.floor((availableWidth - GRID_GAP) / 2);
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

function SectionHeader({
  title,
  subtitle,
  open,
  onPress,
  tint = "default",
}: {
  title: string;
  subtitle: string;
  open: boolean;
  onPress: () => void;
  tint?: "default" | "secondary" | "accent";
}) {
  return (
    <AdminPanel tint={tint}>
      <Pressable onPress={onPress} className="gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <AdminSectionTitle title={title} subtitle={subtitle} />
          <Ionicons
            name="chevron-down"
            size={20}
            style={{
              transform: [{ rotate: open ? "180deg" : "0deg" }],
            }}
          />
        </View>
      </Pressable>
    </AdminPanel>
  );
}

export default function AdminCardsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArchivedCardId, setSelectedArchivedCardId] = useState<
    string | null
  >(null);
  const [isActiveCardsOpen, setIsActiveCardsOpen] = useState(true);
  const [isArchivedCardsOpen, setIsArchivedCardsOpen] = useState(false);
  const { themeName } = useThemeStore();
  const tc = THEME_COLORS[themeName];

  const cardsQuery = useQuery({
    queryKey: ["admin-cards"],
    queryFn: () => apiClient.adminCards(),
  });
  const raritiesQuery = useQuery({
    queryKey: ["admin-rarities"],
    queryFn: () => apiClient.rarities(),
  });
  const featureMutation = useMutation({
    mutationFn: ({
      cardId,
      isArchived,
    }: {
      cardId: string;
      isArchived: boolean;
    }) => apiClient.updateAdminCard(cardId, { isArchived }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-cards"] });
    },
  });

  const tileWidth = getTwoColumnWidth(width);
  const cards = cardsQuery.data?.cards ?? [];
  const isCardsLoading = cardsQuery.isLoading;
  const cardsError =
    cardsQuery.error instanceof Error ? cardsQuery.error.message : null;

  const derived = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const active: AdminCard[] = [];
    const archived: AdminCard[] = [];
    const rarityCounts = new Map<string, number>();
    const cardById = new Map<string, AdminCard>();
    let allActiveCount = 0;
    let allArchivedCount = 0;
    let featuredCount = 0;

    for (const card of cards) {
      cardById.set(card.id, card);
      rarityCounts.set(
        card.rarityId,
        (rarityCounts.get(card.rarityId) ?? 0) + 1,
      );

      if (card.isArchived) {
        allArchivedCount += 1;
      } else {
        allActiveCount += 1;

        if (card.isFeatured) {
          featuredCount += 1;
        }
      }

      const matchesSearch =
        !query ||
        `${card.name} ${card.character}`.toLowerCase().includes(query);

      if (!matchesSearch) {
        continue;
      }

      if (card.isArchived) {
        archived.push(card);
      } else {
        active.push(card);
      }
    }

    return {
      activeCards: active,
      archivedCards: archived,
      allActiveCount,
      allArchivedCount,
      featuredCount,
      rarityCounts,
      cardById,
    };
  }, [cards, searchQuery]);

  const selectedArchivedCard = selectedArchivedCardId
    ? (derived.cardById.get(selectedArchivedCardId) ?? null)
    : null;

  const prefetchKey = useMemo(
    () =>
      cards
        .slice(0, 48)
        .map((card) => card.imageAssetId)
        .filter(Boolean)
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

  const listData = useMemo(() => {
    const items: CardsListItem[] = [
      { id: "active-header", type: "active-header" },
    ];

    if (isActiveCardsOpen) {
      chunkCards(derived.activeCards).forEach((row) => {
        items.push({ id: `active-${row.id}`, type: "active-row", row });
      });
    }

    items.push({ id: "archived-header", type: "archived-header" });

    if (isArchivedCardsOpen) {
      chunkCards(derived.archivedCards).forEach((row) => {
        items.push({ id: `archived-${row.id}`, type: "archived-row", row });
      });
    }

    return items;
  }, [
    derived.activeCards,
    derived.archivedCards,
    isActiveCardsOpen,
    isArchivedCardsOpen,
  ]);

  const openCardEditor = useCallback(
    (mode: "create" | "edit", cardId?: string) => {
      router.push({
        pathname: "/admin-card-editor",
        params: cardId ? { mode, cardId } : { mode },
      } as any);
    },
    [router],
  );

  const renderCardRow = useCallback(
    (row: CardRow, archived: boolean) => (
      <View className="mt-3 flex-row justify-between gap-3 px-3">
        <View
          className="items-center"
          style={{ width: tileWidth, opacity: archived ? 0.7 : 1 }}
        >
          <AdminCardTile
            card={row.left}
            fitContainer
            onPress={() =>
              archived
                ? setSelectedArchivedCardId(row.left.id)
                : openCardEditor("edit", row.left.id)
            }
          />
        </View>
        {row.right ? (
          <View
            className="items-center"
            style={{ width: tileWidth, opacity: archived ? 0.7 : 1 }}
          >
            <AdminCardTile
              card={row.right}
              fitContainer
              onPress={() =>
                archived
                  ? setSelectedArchivedCardId(row.right!.id)
                  : openCardEditor("edit", row.right!.id)
              }
            />
          </View>
        ) : (
          <View style={{ width: tileWidth }} />
        )}
      </View>
    ),
    [openCardEditor, tileWidth],
  );

  const renderItem = useCallback(
    ({ item }: { item: CardsListItem }) => {
      if (item.type === "active-header") {
        return (
          <SectionHeader
            title={t("admin.cards.activeTitle", {
              count: String(derived.activeCards.length),
            })}
            subtitle={t("admin.cards.activeSubtitle")}
            open={isActiveCardsOpen}
            onPress={() => setIsActiveCardsOpen((current) => !current)}
            tint="accent"
          />
        );
      }

      if (item.type === "archived-header") {
        return (
          <SectionHeader
            title={t("admin.cards.archivedTitle", {
              count: String(derived.archivedCards.length),
            })}
            subtitle={t("admin.cards.archivedSubtitle")}
            open={isArchivedCardsOpen}
            onPress={() => setIsArchivedCardsOpen((current) => !current)}
            tint="secondary"
          />
        );
      }

      if (item.type === "active-row") {
        return renderCardRow(item.row, false);
      }

      return renderCardRow(item.row, true);
    },
    [
      derived.activeCards.length,
      derived.archivedCards.length,
      isActiveCardsOpen,
      isArchivedCardsOpen,
      renderCardRow,
      t,
    ],
  );

  const listHeader = useMemo(
    () => (
      <View className="gap-4">
        <AdminHero
          title={t("admin.cards.title")}
          subtitle={t("admin.cards.subtitle")}
          actions={
            <AdminButton
              label={t("admin.cards.createCard")}
              icon="add"
              onPress={() => openCardEditor("create")}
            />
          }
        >
          <View className="flex-row flex-wrap gap-3">
            <AdminStat
              label={t("admin.cards.activeLabel")}
              value={String(derived.allActiveCount)}
              tone="accent"
            />
            <AdminStat
              label={t("admin.cards.archivedLabel")}
              value={String(derived.allArchivedCount)}
              tone="warning"
            />
          </View>
          <View className="flex-row flex-wrap gap-3">
            <AdminStat
              label={t("admin.cards.featuredLabel")}
              value={String(derived.featuredCount)}
              tone="info"
            />
            <AdminStat
              label={t("admin.cards.resultsLabel")}
              value={String(
                derived.activeCards.length + derived.archivedCards.length,
              )}
              helper={
                searchQuery
                  ? t("admin.cards.filteredResults")
                  : t("admin.cards.totalCatalog")
              }
            />
          </View>
          <AdminSearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("admin.cards.searchPlaceholder")}
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
              title={t("admin.cards.loading")}
              body={t("common.loadingStates.adminBody")}
              icon="albums"
            />
          </AdminPanel>
        ) : (
          <>
            <AdminPanel>
              <AdminSectionTitle
                title={t("admin.cards.rarityBreakdown")}
                subtitle={t("admin.cards.rarityBreakdownSubtitle")}
              />
              <View className="mt-3 flex-row flex-wrap gap-2">
                {(raritiesQuery.data?.rarities ?? []).map((rarity) => (
                  <AdminChip
                    key={rarity.id}
                    label={`${rarity.name}: ${derived.rarityCounts.get(rarity.id) ?? 0}`}
                    tone="default"
                  />
                ))}
              </View>
            </AdminPanel>
            <AdminNotice
              title={t("admin.cards.activeHintTitle")}
              body={t("admin.cards.activeHintBody")}
              tone="info"
              icon="create-outline"
            />
          </>
        )}

        {!isCardsLoading &&
        !cardsError &&
        !derived.activeCards.length &&
        !derived.archivedCards.length ? (
          <AdminPanel>
            <AdminEmptyState
              icon="albums"
              title={t("admin.cards.emptyTitle")}
              body={t("admin.cards.noActiveBody")}
            />
          </AdminPanel>
        ) : null}

        {!isCardsLoading &&
        !cardsError &&
        isActiveCardsOpen &&
        !derived.activeCards.length ? (
          <AdminPanel>
            <AdminEmptyState
              icon="albums"
              title={t("admin.cards.noActiveTitle")}
              body={t("admin.cards.noActiveBody")}
            />
          </AdminPanel>
        ) : null}

        {!isCardsLoading &&
        !cardsError &&
        isArchivedCardsOpen &&
        !derived.archivedCards.length ? (
          <AdminPanel>
            <AdminEmptyState
              icon="archive"
              title={t("admin.cards.noArchivedTitle")}
              body={
                searchQuery
                  ? t("admin.cards.noArchivedSearchBody")
                  : t("admin.cards.noArchivedBody")
              }
            />
          </AdminPanel>
        ) : null}
      </View>
    ),
    [
      cardsError,
      derived.activeCards.length,
      derived.allActiveCount,
      derived.allArchivedCount,
      derived.archivedCards.length,
      derived.featuredCount,
      derived.rarityCounts,
      isActiveCardsOpen,
      isArchivedCardsOpen,
      isCardsLoading,
      openCardEditor,
      raritiesQuery.data?.rarities,
      searchQuery,
      t,
    ],
  );

  return (
    <>
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
          gap: 16,
        }}
        ListHeaderComponent={listHeader}
        removeClippedSubviews
        windowSize={5}
        maxToRenderPerBatch={6}
        initialNumToRender={8}
      />

      {selectedArchivedCard ? (
        <AdminModal
          visible
          title={t("admin.cards.archivedCardTitle")}
          onClose={() => setSelectedArchivedCardId(null)}
        >
          <View className="items-center mb-4">
            <AdminCardTile card={selectedArchivedCard} size="large" />
          </View>
          <Text className="mb-[18] text-center font-nunito-bold text-[16px] text-primaryText">
            {selectedArchivedCard.name}
          </Text>
          <View className="gap-[10]">
            <AdminButton
              label={t("admin.cards.restoreCard")}
              variant="secondary"
              onPress={() => {
                featureMutation.mutate({
                  cardId: selectedArchivedCard.id,
                  isArchived: false,
                });
                setSelectedArchivedCardId(null);
              }}
            />
            <AdminButton
              label={t("common.cancel")}
              variant="ghost"
              onPress={() => setSelectedArchivedCardId(null)}
            />
          </View>
        </AdminModal>
      ) : null}
    </>
  );
}
