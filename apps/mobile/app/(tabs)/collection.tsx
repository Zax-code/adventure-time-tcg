import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ModalBottomSheet } from "@swmansion/react-native-bottom-sheet";
import ArrowUpDown from "lucide-react-native/icons/arrow-up-down";
import Circle from "lucide-react-native/icons/circle";
import CircleCheck from "lucide-react-native/icons/circle-check";
import Search from "lucide-react-native/icons/search";
import X from "lucide-react-native/icons/x";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused, useRouter } from "expo-router";
import { create } from "zustand";
import {
  AppState,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
  type ViewToken,
  useWindowDimensions,
} from "react-native";
import { useSharedValue, withTiming } from "react-native-reanimated";

import { LinearGradient } from "expo-linear-gradient";

import type { CollectionResponse } from "@adventure-time/api-client";
import { RADIUS } from "@adventure-time/theme";
import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { CardTile } from "../../src/components/card-tile";
import { RARITY_COLORS } from "../../src/components/theme";
import {
  RecycleIcon,
  CraftIcon,
} from "../../src/components/icons";
import { PageErrorState } from "../../src/components/error-state";
import { PageLoadingState } from "../../src/components/loading-state";
import { Chip } from "../../src/components/ui/chip";
import { Dialog } from "../../src/components/ui/dialog";
import { Input } from "../../src/components/ui/input";
import { ListRow } from "../../src/components/ui/list-row";
import { PageTitle } from "../../src/components/ui/page-title";
import { SectionHeader } from "../../src/components/ui/section-header";
import { SegmentedControl } from "../../src/components/ui/segmented-control";
import { StatePanel } from "../../src/components/ui/state-panel";
import { StatTile } from "../../src/components/ui/stat-tile";
import { SheetHeader } from "../../src/components/ui/sheet-header";
import {
  getBackdropColor,
  ICON_STROKE_WIDTH,
  type Tone,
} from "../../src/components/ui/tokens";
import { ToastBanner } from "../../src/components/toast-banner";
import { useTranslation } from "../../src/i18n";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../../src/components/keyboard-aware-scroll-props";
import { useCollectionFeedbackStore } from "../../src/stores/collection-feedback-store";
import { useThemeStore } from "../../src/stores/theme-store";
import {
  useAppHeaderHeight,
  useBottomTabBarContentPadding,
} from "../../src/theme/layout";
import { THEME_COLORS } from "../../src/theme/themes";

type CollectionEntry = CollectionResponse["cards"][number];
type OwnershipFilter = "all" | "owned" | "not-owned";
type SortOption = "rarity" | "name" | "quantity" | "newest";

const SORT_OPTIONS: SortOption[] = ["rarity", "name", "quantity", "newest"];
const COLLECTION_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 25,
} as const;

const DUST_TABLE = [
  { rarity: "Common", recycle: 1, craft: 5 },
  { rarity: "Uncommon", recycle: 5, craft: 25 },
  { rarity: "Rare", recycle: 20, craft: 100 },
  { rarity: "Epic", recycle: 50, craft: 250 },
  { rarity: "Legendary", recycle: 100, craft: 500 },
];

const DUST_SHEET_TOP_GAP = 56;

// Rarity filter chips wear their rarity color until selected.
const RARITY_CHIP_TONE: Record<string, Tone | "neutral"> = {
  Common: "neutral",
  Uncommon: "success",
  Rare: "info",
  Epic: "accent",
  Legendary: "secondary",
};

const OWNERSHIP_SECTION_TITLE_KEYS: Record<OwnershipFilter, string> = {
  all: "collection.sectionTitles.all",
  owned: "collection.sectionTitles.owned",
  "not-owned": "collection.sectionTitles.notOwned",
};

function DustInfoSheet({
  children,
  index,
  onIndexChange,
  onDismiss,
  scrimColor,
  surfaceColor,
}: {
  children: ReactNode;
  index: number;
  onIndexChange: (index: number) => void;
  onDismiss: () => void;
  scrimColor: string;
  surfaceColor: string;
}) {
  const surface = useMemo(
    () => (
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: surfaceColor,
            borderTopLeftRadius: RADIUS.xl,
            borderTopRightRadius: RADIUS.xl,
          },
        ]}
      />
    ),
    [surfaceColor],
  );

  return (
    <ModalBottomSheet
      index={index}
      onIndexChange={onIndexChange}
      onSettle={(nextIndex) => {
        if (nextIndex === 0) {
          onDismiss();
        }
      }}
      detents={[0, "content"]}
      scrimColor={scrimColor}
      surface={surface}
    >
      {children}
    </ModalBottomSheet>
  );
}

export default function CollectionScreen() {
  return useCollectionScreenView();
}

const useVisibleCollectionCards = create<{ ids: ReadonlySet<string> }>(() => ({
  ids: new Set<string>(),
}));

const CollectionGridTile = memo(function CollectionGridTile({
  accessToken,
  animationsAllowed,
  entry,
  index,
  onOpenCard,
}: {
  accessToken: string | null;
  animationsAllowed: boolean;
  entry: CollectionEntry;
  index: number;
  onOpenCard: (cardId: string) => void;
}) {
  const visible = useVisibleCollectionCards((state) => state.ids.has(entry.id));
  const onPress = useCallback(() => onOpenCard(entry.cardId), [entry.cardId, onOpenCard]);

  return (
    <CardTile
      entry={entry}
      accessToken={accessToken}
      animationsEnabled={animationsAllowed && visible}
      muted={entry.quantity === 0}
      testID={`collection-card-tile-${index}`}
      onPress={onPress}
    />
  );
});

function useCollectionScreenView() {
  const router = useRouter();
  const screenFocused = useIsFocused();
  const accessToken = useSessionStore((state) => state.accessToken);
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const headerHeight = useAppHeaderHeight();
  const bottomTabPadding = useBottomTabBarContentPadding();
  const { height } = useWindowDimensions();
  const collectionFeedbackMessage = useCollectionFeedbackStore(
    (state) => state.message,
  );
  const clearCollectionFeedback = useCollectionFeedbackStore(
    (state) => state.clear,
  );

  const [filterRarity, setFilterRarity] = useState<string>("all");
  const [ownershipFilter, setOwnershipFilter] =
    useState<OwnershipFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("rarity");
  const [searchQuery, setSearchQuery] = useState("");
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [sortDraft, setSortDraft] = useState<SortOption>("rarity");
  const [showDustModal, setShowDustModal] = useState(false);
  const [dustSheetIndex, setDustSheetIndex] = useState(0);
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active",
  );
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const toastAnim = useSharedValue(-60);

  const openSortDialog = () => {
    setSortDraft(sortBy);
    setShowSortModal(true);
  };
  const openDustSheet = () => {
    setShowDustModal(true);
    setDustSheetIndex(1);
  };
  useEffect(() => {
    if (!toast) {
      return;
    }

    toastAnim.value = -60;
    toastAnim.value = withTiming(0, { duration: 300 });
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

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      setAppActive(nextState === "active");
    };
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(
    () => () => {
      useVisibleCollectionCards.setState({ ids: new Set<string>() });
    },
    [],
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<CollectionEntry>[] }) => {
      const nextVisibleCardIds = new Set(
        viewableItems.map(({ item }) => item.id),
      );
      const currentVisibleCardIds = useVisibleCollectionCards.getState().ids;
      if (
        currentVisibleCardIds.size === nextVisibleCardIds.size &&
        [...nextVisibleCardIds].every((id) => currentVisibleCardIds.has(id))
      ) {
        return;
      }

      useVisibleCollectionCards.setState({ ids: nextVisibleCardIds });
    },
  ).current;

  const {
    data: collectionQueryData,
    error: collectionQueryError,
    isError: collectionQueryIsError,
    isLoading: collectionQueryIsLoading,
    refetch: collectionQueryRefetch,
  } = useQuery({
    queryKey: ["collection"],
    queryFn: () => apiClient.collection(),
  });

  // Derived data — computed before early returns to satisfy Rules of Hooks
  const rawCards = collectionQueryData?.cards;
  const ownedCards = useMemo(
    () => (rawCards ?? []).filter((entry) => entry.quantity > 0),
    [rawCards],
  );

  const rarityGroups = useMemo(() => {
    const groups = new Map<string, { count: number; dropRate: number }>();
    for (const entry of rawCards ?? []) {
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

  const ownedRarityGroups = useMemo(() => {
    const groups = new Map<string, { count: number; dropRate: number }>();
    for (const entry of ownedCards) {
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
  }, [ownedCards]);

  const filteredCards = useMemo((): CollectionEntry[] => {
    let result = rawCards ?? [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.card.name.toLowerCase().includes(q) ||
          e.card.character.toLowerCase().includes(q),
      );
    }
    if (ownershipFilter === "owned") {
      result = result.filter((entry) => entry.quantity > 0);
    }
    if (ownershipFilter === "not-owned") {
      result = result.filter((entry) => entry.quantity === 0);
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
            (b.obtainedAt ? new Date(b.obtainedAt).getTime() : -Infinity) -
            (a.obtainedAt ? new Date(a.obtainedAt).getTime() : -Infinity),
        );
      default:
        return result;
    }
  }, [rawCards, searchQuery, ownershipFilter, filterRarity, sortBy]);

  const dustModalStyles = useMemo(
    () => ({
      craftRulePill: {
        flexShrink: 1,
        maxWidth: "58%",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: tc.secondaryTint,
        borderWidth: 1,
        borderColor: tc.secondaryBorder,
      } as const,
      rarityChip: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
        backgroundColor: tc.surfaceMuted,
        borderWidth: 1,
        borderColor: tc.primaryBorder,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      } as const,
      recycleCard: {
        flex: 1,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: tc.successBorder,
        backgroundColor: tc.successTint,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 5,
      } as const,
      craftCard: {
        flex: 1,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: tc.primaryBorder,
        backgroundColor: tc.primaryTint,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 5,
      } as const,
      hintCard: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: tc.secondaryBorder,
        backgroundColor: tc.secondaryTint,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      } as const,
      heroCard: {
        borderRadius: 22,
        borderWidth: 1,
        borderColor: tc.secondaryBorder,
        backgroundColor: tc.surface,
        padding: 14,
        gap: 10,
        width: "100%",
        boxShadow:
          themeName === "nightosphere"
            ? "0 10px 24px rgba(0, 0, 0, 0.26)"
            : "0 10px 24px rgba(122, 86, 24, 0.12)",
      } as const,
      sheetContainer: {
        backgroundColor: tc.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: tc.secondaryBorder,
        overflow: "hidden",
        maxHeight: Math.max(0, height - DUST_SHEET_TOP_GAP),
        boxShadow:
          themeName === "nightosphere"
            ? "0 24px 56px rgba(0, 0, 0, 0.5)"
            : "0 22px 52px rgba(73, 36, 54, 0.18)",
      } as const,
    }),
    [tc, themeName, height],
  );

  const openCard = useCallback(
    (cardId: string) =>
      router.push({
        pathname: "/collection-card-detail",
        params: { cardId },
      }),
    [router],
  );
  const animationsAllowed = screenFocused && appActive;

  // Visibility is read per tile from a store, so a scroll only re-renders the tiles
  // whose visibility changed instead of every row.
  const renderCollectionItem = useCallback(
    ({ item, index }: { item: CollectionEntry; index: number }) => (
      <CollectionGridTile
        accessToken={accessToken}
        animationsAllowed={animationsAllowed}
        entry={item}
        index={index}
        onOpenCard={openCard}
      />
    ),
    [accessToken, animationsAllowed, openCard],
  );

  const clearSearchControl = useMemo(
    () =>
      searchQuery ? (
        <Pressable
          onPress={() => setSearchQuery("")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
        >
          <X size={18} color={tc.muted} strokeWidth={ICON_STROKE_WIDTH} />
        </Pressable>
      ) : null,
    [searchQuery, t, tc.muted],
  );

  if (collectionQueryIsLoading) {
    return (
      <PageLoadingState
        title={t("nav.collection")}
        message={t("common.loadingStates.pageBody")}
        icon="albums"
      />
    );
  }

  if (collectionQueryIsError) {
    return (
      <PageErrorState
        error={collectionQueryError}
        onRetry={() => {
          void collectionQueryRefetch();
        }}
      />
    );
  }

  const collection = collectionQueryData;
  if (!collection) {
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-fgMuted">
          {t("collection.noCards")}
        </Text>
      </View>
    );
  }

  const craftableDustRows = DUST_TABLE.filter(
    (row) => collection.dust >= row.craft,
  );
  const nextDustGoal =
    DUST_TABLE.find((row) => collection.dust < row.craft) ?? null;
  const allCards = rawCards ?? [];
  const ownedCount = ownedCards.length;
  const notOwnedCount = Math.max(allCards.length - ownedCount, 0);
  const dustSheetScrim = getBackdropColor(themeName);

  const listHeader = (
    <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
      <PageTitle
        title={t("collection.title")}
        subtitle={t("collection.subtitle", {
          owned: collection.stats.uniqueOwned,
          total: allCards.length,
        })}
        className="mb-ds-3"
      />

      <View className="mb-ds-3 flex-row gap-ds-3">
        <Pressable
          className="flex-1"
          onPress={openDustSheet}
          accessibilityRole="button"
          accessibilityLabel={`${t("collection.dust")} ${collection.dust}`}
          testID="collection-dust-tile"
        >
          <StatTile
            tone="secondary"
            label={t("collection.dust")}
            value={collection.dust}
            caption={t("collection.dustCaption")}
          />
        </Pressable>
        <Pressable
          className="flex-1"
          onPress={() => setShowStatsModal(true)}
          accessibilityRole="button"
          accessibilityLabel={`${t("collection.cardsOwned")} ${collection.stats.uniqueOwned}`}
          testID="collection-stats-tile"
        >
          <StatTile
            tone="primary"
            label={t("collection.cardsOwned")}
            value={collection.stats.uniqueOwned}
            caption={t("collection.cardsOwnedCaption")}
          />
        </Pressable>
      </View>

      <Input
        className="mb-ds-3"
        icon={Search}
        placeholder={t("collection.searchByNameOrCharacter")}
        value={searchQuery}
        onChangeText={setSearchQuery}
        returnKeyType="search"
        trailing={clearSearchControl}
      />

      <SegmentedControl<OwnershipFilter>
        className="mb-ds-3"
        options={[
          {
            value: "all",
            label: t("collection.ownershipFilters.all"),
            count: allCards.length,
            testID: "collection-ownership-filter-all",
          },
          {
            value: "owned",
            label: t("collection.ownershipFilters.owned"),
            count: ownedCount,
            testID: "collection-ownership-filter-owned",
          },
          {
            value: "not-owned",
            label: t("collection.ownershipFilters.notOwned"),
            count: notOwnedCount,
            testID: "collection-ownership-filter-not-owned",
          },
        ]}
        value={ownershipFilter}
        onChange={setOwnershipFilter}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-ds-3"
        contentContainerClassName="gap-ds-2"
      >
        <Chip
          tone={filterRarity === "all" ? "selected" : "neutral"}
          label={`${t("collection.all")} ${allCards.length}`}
          onPress={() => setFilterRarity("all")}
          accessibilityState={{ selected: filterRarity === "all" }}
          testID="collection-rarity-filter-all"
        />
        {/* Five rarities at most; virtualization would add overhead. */}
        {/* react-doctor-disable-next-line react-doctor/rn-no-scrollview-mapped-list */}
        {rarityGroups.map(({ name, count }) => (
          <Chip
            key={name}
            tone={
              filterRarity === name
                ? "selected"
                : (RARITY_CHIP_TONE[name] ?? "neutral")
            }
            label={`${name} ${count}`}
            onPress={() => setFilterRarity(name)}
            accessibilityState={{ selected: filterRarity === name }}
          />
        ))}
      </ScrollView>

      <SectionHeader
        className="mb-ds-3"
        title={t(OWNERSHIP_SECTION_TITLE_KEYS[ownershipFilter])}
        subtitle={t(`collection.sortedBy.${sortBy}`)}
        action={{
          label: t("collection.sort"),
          onPress: openSortDialog,
          testID: "collection-sort-button",
        }}
      />
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
          topOffset={headerHeight + 16}
        />
      ) : null}

      <FlatList
        {...KEYBOARD_AWARE_SCROLL_PROPS}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        contentInset={{ bottom: bottomTabPadding }}
        scrollIndicatorInsets={{ bottom: bottomTabPadding }}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-evenly" }}
        data={filteredCards}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={COLLECTION_VIEWABILITY_CONFIG}
        keyExtractor={(entry: CollectionEntry) => entry.id}
        ListHeaderComponent={
          <View style={{ paddingTop: headerHeight }}>{listHeader}</View>
        }
        ListEmptyComponent={
          <View className="px-ds-4">
            <StatePanel
              title={
                allCards.length > 0
                  ? t("collection.noFilterMatches")
                  : t("collection.empty")
              }
            />
          </View>
        }
        renderItem={renderCollectionItem}
      />

      {/* Stats Modal */}
      <Dialog
        visible={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        title={t("collection.cardStats")}
        confirm={{
          label: t("common.close"),
          onPress: () => setShowStatsModal(false),
        }}
        testID="collection-stats-modal"
      >
        <View className="flex-row flex-wrap gap-ds-3">
          {ownedRarityGroups.length > 0 ? (
            ownedRarityGroups.map(({ name, count }) => {
              const rc = RARITY_COLORS[name] ?? RARITY_COLORS.Common;
              return (
                <View
                  key={name}
                  className="grow basis-[30%] items-center rounded-ds-md border border-primaryBorder bg-surfaceMuted p-ds-3"
                >
                  <Text
                    className="font-nunito-extrabold text-[24px] leading-[29px]"
                    style={{ color: rc.from, fontVariant: ["tabular-nums"] }}
                  >
                    {count}
                  </Text>
                  <Text className="font-nunito-bold text-ds-caption text-fgMuted">
                    {name}
                  </Text>
                </View>
              );
            })
          ) : (
            <View className="w-full rounded-ds-md border border-primaryBorder bg-surfaceMuted px-ds-4 py-ds-4">
              <Text className="text-center font-nunito text-ds-sm text-fgMuted">
                {t("collection.empty")}
              </Text>
            </View>
          )}
        </View>
      </Dialog>

      {/* Sort Modal */}
      <Dialog
        visible={showSortModal}
        onClose={() => setShowSortModal(false)}
        icon={ArrowUpDown}
        title={t("collection.sortTitle")}
        cancel={{
          label: t("common.cancel"),
          onPress: () => setShowSortModal(false),
          testID: "collection-sort-cancel",
        }}
        confirm={{
          label: t("collection.applySort"),
          onPress: () => {
            setSortBy(sortDraft);
            setShowSortModal(false);
          },
          testID: "collection-sort-apply",
        }}
        testID="collection-sort-modal"
      >
        <View className="overflow-hidden rounded-ds-md border border-primaryBorder">
          {SORT_OPTIONS.map((option, index) => {
            const isActive = sortDraft === option;
            const Indicator = isActive ? CircleCheck : Circle;
            return (
              <View
                key={option}
                className={isActive ? "bg-primaryTint" : undefined}
                accessibilityState={{ selected: isActive }}
              >
                <ListRow
                  title={t(`collection.sortOptions.${option}`)}
                  divider={index < SORT_OPTIONS.length - 1}
                  onPress={() => setSortDraft(option)}
                  testID={`collection-sort-option-${option}`}
                  trailingIcon={{
                    icon: Indicator,
                    size: 22,
                    color: isActive ? tc.primaryText : tc.muted,
                  }}
                />
              </View>
            );
          })}
        </View>
      </Dialog>

      {/* Dust Info Sheet */}
      {showDustModal ? (
        <DustInfoSheet
          index={dustSheetIndex}
          onIndexChange={setDustSheetIndex}
          onDismiss={() => setShowDustModal(false)}
          scrimColor={dustSheetScrim}
          surfaceColor={tc.surface}
        >
          <View style={dustModalStyles.sheetContainer}>
            <SheetHeader
              title={t("collection.dustModal.title")}
              subtitle={t("collection.dustModal.description")}
            />
            <LinearGradient
              colors={[tc.secondaryTint, tc.primaryBg]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: 14,
                gap: 12,
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View style={dustModalStyles.heroCard}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <View style={{ gap: 4 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "Nunito_700Bold",
                          color: tc.fgMuted,
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                        }}
                      >
                        {t("collection.dustModal.balanceLabel")}
                      </Text>
                      <Text
                        style={{
                          fontSize: 28,
                          fontFamily: "Nunito_800ExtraBold",
                          color: tc.secondaryText,
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {collection.dust}
                      </Text>
                    </View>
                    <View style={dustModalStyles.craftRulePill}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "Nunito_700Bold",
                          color: tc.secondaryText,
                          textAlign: "right",
                        }}
                      >
                        {t("collection.dustModal.craftRule")}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={{
                      fontSize: 13,
                      lineHeight: 18,
                      fontFamily: "Nunito_600SemiBold",
                      color: tc.fg,
                    }}
                  >
                    {craftableDustRows.length > 0
                      ? t("collection.dustModal.balanceReady")
                      : t("collection.dustModal.balanceNeedMore", {
                          amount:
                            (nextDustGoal?.craft ?? DUST_TABLE[0].craft) -
                            collection.dust,
                        })}
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        backgroundColor:
                          craftableDustRows.length > 0
                            ? tc.successTint
                            : tc.infoTint,
                        borderWidth: 1,
                        borderColor:
                          craftableDustRows.length > 0
                            ? tc.successBorder
                            : tc.infoBorder,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "Nunito_700Bold",
                          color:
                            craftableDustRows.length > 0
                              ? tc.successText
                              : tc.infoText,
                        }}
                      >
                        {craftableDustRows.length > 0
                          ? t("collection.dustModal.availableNow")
                          : t("collection.dustModal.nextTarget")}
                      </Text>
                    </View>
                    {(craftableDustRows.length > 0
                      ? craftableDustRows
                      : nextDustGoal
                        ? [nextDustGoal]
                        : []
                    ).map((row) => (
                      <View key={row.rarity} style={dustModalStyles.rarityChip}>
                        <Text
                          style={{
                            fontSize: 12,
                            fontFamily: "Nunito_700Bold",
                            color: tc.fg,
                          }}
                        >
                          {row.rarity}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            fontFamily: "Nunito_700Bold",
                            color: tc.fgMuted,
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {row.craft}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </LinearGradient>

            <ScrollView
              contentInsetAdjustmentBehavior="automatic"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: 18,
                paddingBottom: 20,
                gap: 16,
              }}
            >
              <View style={{ gap: 10 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: "Nunito_800ExtraBold",
                    color: tc.fg,
                  }}
                >
                  {t("collection.dustModal.stepsTitle")}
                </Text>
                {[
                  {
                    key: "recycle",
                    title: t("collection.dustModal.stepRecycleTitle"),
                    body: t("collection.dustModal.stepRecycleBody"),
                    backgroundColor: tc.successTint,
                    borderColor: tc.successBorder,
                    badgeColor: tc.successText,
                  },
                  {
                    key: "track",
                    title: t("collection.dustModal.stepTrackTitle"),
                    body: t("collection.dustModal.stepTrackBody"),
                    backgroundColor: tc.infoTint,
                    borderColor: tc.infoBorder,
                    badgeColor: tc.infoText,
                  },
                  {
                    key: "craft",
                    title: t("collection.dustModal.stepCraftTitle"),
                    body: t("collection.dustModal.stepCraftBody"),
                    backgroundColor: tc.primaryTint,
                    borderColor: tc.primaryBorder,
                    badgeColor: tc.primaryText,
                  },
                ].map((step, index) => (
                  <View
                    key={step.key}
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: step.borderColor,
                      backgroundColor: step.backgroundColor,
                      padding: 14,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: tc.surface,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: "Nunito_800ExtraBold",
                          color: step.badgeColor,
                        }}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: "Nunito_800ExtraBold",
                          color: tc.fg,
                        }}
                      >
                        {step.title}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          lineHeight: 19,
                          fontFamily: "Nunito_400Regular",
                          color: tc.fgMuted,
                        }}
                      >
                        {step.body}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={{ gap: 8 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: "Nunito_800ExtraBold",
                    color: tc.fg,
                  }}
                >
                  {t("collection.dustModal.valuesTitle")}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    lineHeight: 19,
                    fontFamily: "Nunito_400Regular",
                    color: tc.fgMuted,
                  }}
                >
                  {t("collection.dustModal.valuesDescription")}
                </Text>
                <View style={{ gap: 10 }}>
                  {DUST_TABLE.map((row) => {
                    const rc =
                      RARITY_COLORS[row.rarity] ?? RARITY_COLORS.Common;
                    const isReady = collection.dust >= row.craft;
                    const missingDust = Math.max(
                      row.craft - collection.dust,
                      0,
                    );

                    return (
                      <View
                        key={row.rarity}
                        style={{
                          borderRadius: 22,
                          borderWidth: 1,
                          borderColor: tc.primaryBorder,
                          backgroundColor: tc.surfaceMuted,
                          padding: 14,
                          gap: 12,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <LinearGradient
                            colors={[rc.from, rc.to]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                              borderRadius: 999,
                              paddingHorizontal: 12,
                              paddingVertical: 7,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontFamily: "Nunito_800ExtraBold",
                                color: "#FFFFFF",
                              }}
                            >
                              {row.rarity.toUpperCase()}
                            </Text>
                          </LinearGradient>
                          <View
                            style={{
                              borderRadius: 999,
                              paddingHorizontal: 12,
                              paddingVertical: 7,
                              backgroundColor: isReady
                                ? tc.successTint
                                : tc.infoTint,
                              borderWidth: 1,
                              borderColor: isReady
                                ? tc.successBorder
                                : tc.infoBorder,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontFamily: "Nunito_700Bold",
                                color: isReady ? tc.successText : tc.infoText,
                                fontVariant: ["tabular-nums"],
                              }}
                            >
                              {isReady
                                ? t("collection.dustModal.readyNow")
                                : t("collection.dustModal.needMore", {
                                    amount: missingDust,
                                  })}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={{
                            flexDirection: "row",
                            gap: 10,
                          }}
                        >
                          <View style={dustModalStyles.recycleCard}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <RecycleIcon size={15} color={tc.successText} />
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontFamily: "Nunito_700Bold",
                                  color: tc.successText,
                                }}
                              >
                                {t("collection.detail.recycle")}
                              </Text>
                            </View>
                            <Text
                              style={{
                                fontSize: 20,
                                fontFamily: "Nunito_800ExtraBold",
                                color: tc.successText,
                                fontVariant: ["tabular-nums"],
                              }}
                            >
                              +{row.recycle}
                            </Text>
                          </View>

                          <View style={dustModalStyles.craftCard}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <CraftIcon size={15} color={tc.primaryText} />
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontFamily: "Nunito_700Bold",
                                  color: tc.primaryText,
                                }}
                              >
                                {t("collection.detail.craft")}
                              </Text>
                            </View>
                            <Text
                              style={{
                                fontSize: 20,
                                fontFamily: "Nunito_800ExtraBold",
                                color: tc.primaryText,
                                fontVariant: ["tabular-nums"],
                              }}
                            >
                              -{row.craft}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={dustModalStyles.hintCard}>
                <CraftIcon size={18} color={tc.secondaryText} />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    lineHeight: 19,
                    fontFamily: "Nunito_600SemiBold",
                    color: tc.secondaryText,
                  }}
                >
                  {t("collection.dustModal.openCardHint")}
                </Text>
              </View>
            </ScrollView>
          </View>
        </DustInfoSheet>
      ) : null}
    </View>
  );
}
