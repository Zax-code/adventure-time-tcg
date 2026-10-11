import { useCallback, useEffect, useMemo, useState } from "react";
import { InteractionManager, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Circle from "lucide-react-native/icons/circle";
import Crown from "lucide-react-native/icons/crown";
import Diamond from "lucide-react-native/icons/diamond";
import Gem from "lucide-react-native/icons/gem";
import Leaf from "lucide-react-native/icons/leaf";
import Sparkles from "lucide-react-native/icons/sparkles";
import type { LucideIcon } from "lucide-react-native";

import type { AdminCardsResponse } from "@adventure-time/api-client";

import { CardTile } from "../../src/components/card-tile";
import {
  AdminButton,
  AdminEmptyState,
  AdminLoadingState,
  AdminModal,
  AdminSearchInput,
} from "../../src/components/admin/admin-ui";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../../src/components/keyboard-aware-scroll-props";
import { Card } from "../../src/components/ui/card";
import { ListRow } from "../../src/components/ui/list-row";
import { Notice } from "../../src/components/ui/notice";
import { SectionHeader } from "../../src/components/ui/section-header";
import { StatTile } from "../../src/components/ui/stat-tile";
import type { Tone } from "../../src/components/ui/tokens";
import { useTranslation } from "../../src/i18n";
import { prefetchCardImages } from "../../src/lib/card-images";
import { apiClient } from "../../src/lib/api";

const CONTENT_BOTTOM_PADDING = 132;

type AdminCard = AdminCardsResponse["cards"][number];

// Row icon tile per rarity: Legendary crown on yellow, Epic gem on purple.
const RARITY_ICON: Record<string, { icon: LucideIcon; tone: Tone }> = {
  Legendary: { icon: Crown, tone: "secondary" },
  Epic: { icon: Gem, tone: "accent" },
  Rare: { icon: Diamond, tone: "info" },
  Uncommon: { icon: Leaf, tone: "success" },
  Common: { icon: Circle, tone: "primary" },
};
const FALLBACK_RARITY_ICON = { icon: Sparkles, tone: "primary" as Tone };

export default function AdminCardsScreen() {
  return useAdminCardsScreenView();
}

function useAdminCardsScreenView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArchivedCardId, setSelectedArchivedCardId] = useState<
    string | null
  >(null);

  const {
    data: cardsQueryData,
    error: cardsQueryError,
    isLoading: isCardsLoading,
  } = useQuery({
    queryKey: ["admin-cards"],
    queryFn: () => apiClient.adminCards(),
  });
  const { data: raritiesQueryData } = useQuery({
    queryKey: ["admin-rarities"],
    queryFn: () => apiClient.rarities(),
  });
  const restoreMutation = useMutation({
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

  const cards = useMemo(
    () => cardsQueryData?.cards ?? [],
    [cardsQueryData?.cards],
  );
  const cardsError =
    cardsQueryError instanceof Error ? cardsQueryError.message : null;

  const derived = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const visible: AdminCard[] = [];
    const visibleArchived: AdminCard[] = [];
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
        visibleArchived.push(card);
      } else {
        visible.push(card);
      }
    }

    // Live cards first, archived cards at the end of the catalog.
    return {
      catalog: [...visible, ...visibleArchived],
      allActiveCount,
      allArchivedCount,
      featuredCount,
      rarityCounts,
      cardById,
    };
  }, [cards, searchQuery]);

  const rarityBreakdown = useMemo(
    () =>
      [...(raritiesQueryData?.rarities ?? [])]
        .sort((left, right) => left.dropRate - right.dropRate)
        .map(
          (rarity) =>
            `${rarity.name} ${derived.rarityCounts.get(rarity.id) ?? 0}`,
        )
        .join(" · "),
    [derived.rarityCounts, raritiesQueryData?.rarities],
  );

  const selectedArchivedCard = selectedArchivedCardId
    ? (derived.cardById.get(selectedArchivedCardId) ?? null)
    : null;

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

  const openCardEditor = useCallback(
    (mode: "create" | "edit", cardId?: string) => {
      router.push({
        pathname: "/admin-card-editor",
        params: cardId ? { mode, cardId } : { mode },
      } as never);
    },
    [router],
  );

  const isReady = !isCardsLoading && !cardsError;

  return (
    <>
      <ScrollView
        {...KEYBOARD_AWARE_SCROLL_PROPS}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: CONTENT_BOTTOM_PADDING,
          gap: 12,
        }}
      >
        <Card>
          <SectionHeader
            title={t("admin.cards.title")}
            subtitle={t("admin.cards.subtitle")}
            action={{
              label: t("admin.cards.create"),
              onPress: () => openCardEditor("create"),
              testID: "admin-cards-create-button",
            }}
          />
          <View className="flex-row gap-ds-3">
            <StatTile
              className="flex-1"
              tone="accent"
              label={t("admin.cards.activeLabel")}
              value={String(derived.allActiveCount)}
            />
            <StatTile
              className="flex-1"
              tone="secondary"
              label={t("admin.cards.archivedLabel")}
              value={String(derived.allArchivedCount)}
            />
          </View>
          <View className="flex-row items-start gap-ds-3">
            <StatTile
              className="flex-1"
              tone="info"
              label={t("admin.cards.featuredLabel")}
              value={String(derived.featuredCount)}
            />
            <StatTile
              className="flex-1"
              label={t("admin.cards.resultsLabel")}
              value={String(derived.catalog.length)}
              caption={
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
        </Card>

        {cardsError ? (
          <Notice tone="danger" title={t("admin.cards.loadFailed")} body={cardsError} />
        ) : null}

        {isCardsLoading ? (
          <Card>
            <AdminLoadingState
              title={t("admin.cards.loading")}
              body={t("common.loadingStates.adminBody")}
              icon="albums"
            />
          </Card>
        ) : null}

        {isReady && rarityBreakdown ? (
          <Notice
            tone="info"
            icon={Sparkles}
            title={t("admin.cards.rarityBreakdown")}
            body={rarityBreakdown}
          />
        ) : null}

        {isReady ? (
          <SectionHeader
            title={t("admin.cards.catalogTitle")}
            subtitle={t("admin.cards.catalogCount", {
              count: String(derived.catalog.length),
            })}
          />
        ) : null}

        {isReady && derived.catalog.length ? (
          <Card flush>
            {derived.catalog.map((card, index) => {
              const rarity =
                RARITY_ICON[card.rarityName] ?? FALLBACK_RARITY_ICON;

              return (
                <ListRow
                  key={card.id}
                  icon={rarity.icon}
                  iconTone={rarity.tone}
                  title={card.name}
                  meta={`${card.character} · ${card.rarityName}`}
                  trailingChip={
                    card.isArchived
                      ? {
                          tone: "secondary",
                          label: t("admin.cards.archivedLabel"),
                        }
                      : { tone: "success", label: t("admin.cards.live") }
                  }
                  chevron
                  divider={index < derived.catalog.length - 1}
                  onPress={() =>
                    card.isArchived
                      ? setSelectedArchivedCardId(card.id)
                      : openCardEditor("edit", card.id)
                  }
                  testID={`admin-cards-row-${card.id}`}
                />
              );
            })}
          </Card>
        ) : null}

        {isReady && !derived.catalog.length ? (
          <Card>
            <AdminEmptyState
              icon="albums"
              title={
                searchQuery
                  ? t("admin.cards.noResultsTitle")
                  : t("admin.cards.emptyTitle")
              }
              body={
                searchQuery
                  ? t("admin.cards.noResultsBody")
                  : t("admin.cards.emptyBody")
              }
            />
          </Card>
        ) : null}
      </ScrollView>

      {selectedArchivedCard ? (
        <AdminModal
          visible
          title={t("admin.cards.archivedCardTitle")}
          onClose={() => setSelectedArchivedCardId(null)}
        >
          <View className="mb-4 items-center">
            <CardTile card={selectedArchivedCard} size="large" />
          </View>
          <Text className="mb-[18] text-center font-nunito-bold text-[16px] text-primaryText">
            {selectedArchivedCard.name}
          </Text>
          <View className="gap-[10]">
            <AdminButton
              label={t("admin.cards.restoreCard")}
              variant="secondary"
              onPress={() => {
                restoreMutation.mutate({
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
