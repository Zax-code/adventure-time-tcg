import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import type { AdminCardsResponse } from "@adventure-time/api-client";

import { apiClient } from "../../src/lib/api";
import { prefetchCardImages } from "../../src/lib/card-images";
import { AdminCardTile } from "../../src/components/admin/admin-card-tile";
import {
  AdminButton,
  AdminLoadingState,
  AdminModal,
  AdminPanel,
  AdminSearchInput,
} from "../../src/components/admin/admin-ui";
import { useTranslation } from "../../src/i18n";
import { useThemeStore } from "../../src/stores/theme-store";
import { THEME_COLORS } from "../../src/theme/themes";

const GRID_GAP = 12;
const SCREEN_SIDE_PADDING = 16;
const COLLECTION_SIDE_PADDING = 12;
const CONTENT_BOTTOM_PADDING = 128;

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

export default function AdminCardsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArchivedCardId, setSelectedArchivedCardId] = useState<string | null>(
    null,
  );
  const [isActiveCardsOpen, setIsActiveCardsOpen] = useState(true);
  const [isArchivedCardsOpen, setIsArchivedCardsOpen] = useState(true);
  const { t } = useTranslation();

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
      isFeatured,
      isArchived,
    }: {
      cardId: string;
      isFeatured?: boolean;
      isArchived?: boolean;
    }) => apiClient.updateAdminCard(cardId, { isFeatured, isArchived }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-cards"] });
    },
  });

  const tileWidth = getTwoColumnWidth(width);
  const cards = cardsQuery.data?.cards ?? [];
  const isCardsLoading = cardsQuery.isLoading;
  const cardsError = cardsQuery.error instanceof Error ? cardsQuery.error.message : null;

  const derived = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const active: AdminCard[] = [];
    const archived: AdminCard[] = [];
    const rarityCounts = new Map<string, number>();
    const cardById = new Map<string, AdminCard>();

    for (const card of cards) {
      cardById.set(card.id, card);
      rarityCounts.set(card.rarityId, (rarityCounts.get(card.rarityId) ?? 0) + 1);

      const matchesSearch =
        !query || `${card.name} ${card.character}`.toLowerCase().includes(query);

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
      allActiveCount: cards.filter((card) => !card.isArchived).length,
      allArchivedCount: cards.filter((card) => card.isArchived).length,
      rarityCounts,
      cardById,
    };
  }, [cards, searchQuery]);

  const selectedArchivedCard = selectedArchivedCardId
    ? derived.cardById.get(selectedArchivedCardId) ?? null
    : null;

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

  const listData = useMemo(() => {
    const items: CardsListItem[] = [{ id: "active-header", type: "active-header" }];

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
  }, [derived.activeCards, derived.archivedCards, isActiveCardsOpen, isArchivedCardsOpen]);

  const openCardEditor = useCallback(
    (mode: "create" | "edit", cardId?: string) => {
      router.push({ pathname: "/admin-card-editor", params: cardId ? { mode, cardId } : { mode } } as any);
    },
    [router],
  );

  const renderCardRow = useCallback(
    (row: CardRow, archived: boolean) => (
      <View className="mt-3 flex-row justify-between gap-3 px-3">
        <View className="items-center" style={{ width: tileWidth, opacity: archived ? 0.6 : 1 }}>
          <AdminCardTile
            card={row.left}
            fitContainer
            onPress={() =>
              archived ? setSelectedArchivedCardId(row.left.id) : openCardEditor("edit", row.left.id)
            }
          />
        </View>
        {row.right ? (
          <View className="items-center" style={{ width: tileWidth, opacity: archived ? 0.6 : 1 }}>
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
        const activeCountLabel = isCardsLoading ? "..." : String(derived.activeCards.length);
        const activeTotalLabel = isCardsLoading ? "..." : String(derived.allActiveCount);

        return (
          <View className="mt-2">
            <Pressable
              className="flex-row items-center justify-between px-4 py-[14] rounded-2xl bg-primaryTint"
              onPress={() => setIsActiveCardsOpen((current) => !current)}
            >
              <Text className="font-nunito-extrabold text-[18px] text-primaryText">
                {searchQuery
                  ? t("admin.cards.activeTitleWithTotal", {
                      count: activeCountLabel,
                      total: activeTotalLabel,
                    })
                  : t("admin.cards.activeTitle", { count: activeCountLabel })}
              </Text>
              <Ionicons
                name="chevron-down"
                size={20}
                color={tc.primaryStrong}
                style={isActiveCardsOpen ? { transform: [{ rotate: "180deg" }] } : { transform: [{ rotate: "0deg" }] }}
              />
            </Pressable>
            {isActiveCardsOpen ? (
              <View className="items-center px-3 pt-[14] pb-1">
                {isCardsLoading ? (
                  <AdminLoadingState
                    title={t("admin.cards.loading")}
                    body={t("common.loadingStates.adminBody")}
                    icon="albums"
                  />
                ) : cardsError ? (
                  <Text className="font-nunito-bold text-[13px] text-dangerText text-center">{cardsError}</Text>
                ) : derived.activeCards.length ? (
                  <Text className="mb-3 font-nunito-semibold text-xs text-fgMuted">{t("admin.cards.tapToEdit")}</Text>
                ) : (
                  <Text className="font-nunito-semibold text-sm text-fgMuted text-center">{t("admin.cards.noActiveBody")}</Text>
                )}
              </View>
            ) : null}
          </View>
        );
      }

      if (item.type === "archived-header") {
        const archivedCountLabel = isCardsLoading ? "..." : String(derived.archivedCards.length);
        const archivedTotalLabel = isCardsLoading ? "..." : String(derived.allArchivedCount);

        return (
          <View className="mt-2">
            <Pressable
              className="flex-row items-center justify-between px-4 py-[14] rounded-2xl bg-dangerTint"
              onPress={() => setIsArchivedCardsOpen((current) => !current)}
            >
              <Text className="font-nunito-extrabold text-[18px] text-dangerText">
                {searchQuery
                  ? t("admin.cards.archivedTitleWithTotal", {
                      count: archivedCountLabel,
                      total: archivedTotalLabel,
                    })
                  : t("admin.cards.archivedTitle", { count: archivedCountLabel })}
              </Text>
              <Ionicons
                name="chevron-down"
                size={20}
                color={tc.dangerText}
                style={isArchivedCardsOpen ? { transform: [{ rotate: "180deg" }] } : { transform: [{ rotate: "0deg" }] }}
              />
            </Pressable>
            {isArchivedCardsOpen ? (
              <View className="items-center px-3 pt-[14] pb-1">
                {isCardsLoading ? (
                  <AdminLoadingState
                    title={t("admin.cards.loading")}
                    body={t("common.loadingStates.adminBody")}
                    icon="archive"
                  />
                ) : cardsError ? (
                  <Text className="font-nunito-bold text-[13px] text-dangerText text-center">{cardsError}</Text>
                ) : derived.archivedCards.length ? (
                  <Text className="mb-3 font-nunito-semibold text-xs text-fgMuted">{t("admin.cards.tapToManage")}</Text>
                ) : (
                  <Text className="font-nunito-semibold text-sm text-fgMuted text-center">
                    {searchQuery
                      ? t("admin.cards.noArchivedSearchBody")
                      : t("admin.cards.noArchivedBody")}
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        );
      }

      if (item.type === "active-row") {
        return renderCardRow(item.row, false);
      }

      return renderCardRow(item.row, true);
    },
    [
      cardsError,
      derived.activeCards.length,
      derived.allActiveCount,
      derived.allArchivedCount,
      derived.archivedCards.length,
      isActiveCardsOpen,
      isArchivedCardsOpen,
      isCardsLoading,
      renderCardRow,
      searchQuery,
      tc,
    ],
  );

  const listHeader = useMemo(
    () => (
      <>
        <View className="items-center pt-1">
          <Text className="font-nunito-extrabold text-[28px] text-primaryStrong">{t("admin.cards.title")}</Text>
        </View>

        <View className="mt-4">
          <AdminButton label={t("admin.cards.createCard")} icon="add" onPress={() => openCardEditor("create")} />
        </View>

        <AdminPanel style={{ marginTop: 16, paddingBottom: 18 }}>
          <Text className="font-nunito-extrabold text-[20px] text-primaryText mb-3">{t("admin.cards.stats")}</Text>
          {isCardsLoading ? (
            <AdminLoadingState
              title={t("admin.cards.loading")}
              body={t("common.loadingStates.adminBody")}
              icon="stats-chart"
            />
          ) : cardsError ? (
            <Text className="font-nunito-bold text-[13px] text-dangerText text-center">{cardsError}</Text>
          ) : (
            <View className="flex-row flex-wrap justify-between gap-[10]">
              {raritiesQuery.data?.rarities.map((rarity) => (
                <View key={rarity.id} className="w-[48%] rounded-2xl py-[14] px-[10] items-center bg-surface/60">
                  <Text className="font-nunito-extrabold text-[26px]" style={{ color: rarity.color || tc.primaryText }}>
                    {derived.rarityCounts.get(rarity.id) ?? 0}
                  </Text>
                  <Text className="mt-[3] font-nunito-bold text-[13px] text-fgMuted">{rarity.name}</Text>
                </View>
              ))}
            </View>
          )}
        </AdminPanel>

        <View className="mt-4">
          <AdminSearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("admin.cards.searchPlaceholder")}
          />
        </View>
      </>
    ),
    [searchQuery, isCardsLoading, cardsError, raritiesQuery.data?.rarities, derived.rarityCounts, openCardEditor, tc],
  );

  return (
    <>
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

      {selectedArchivedCard ? (
        <AdminModal
          visible
          title={t("admin.cards.archivedCardTitle")}
          onClose={() => setSelectedArchivedCardId(null)}
        >
          <View className="items-center mb-4">
            <AdminCardTile card={selectedArchivedCard} size="large" />
          </View>
          <Text className="text-center font-nunito-bold text-[16px] text-primaryText mb-[18]">{selectedArchivedCard.name}</Text>
          <View className="gap-[10]">
            <AdminButton
              label={t("admin.cards.restoreCard")}
              variant="secondary"
              onPress={() => {
                featureMutation.mutate({ cardId: selectedArchivedCard.id, isArchived: false });
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
