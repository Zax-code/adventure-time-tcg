import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ModalBottomSheet } from "@swmansion/react-native-bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
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
import { PageErrorState } from "../../src/components/error-state";
import { PageLoadingState } from "../../src/components/loading-state";
import { PrimaryButton } from "../../src/components/button";
import { ThemedExpoTextInput } from "../../src/components/expo-ui/themed-text-input";
import { ThemedModal } from "../../src/components/themed-modal";
import { ToastBanner } from "../../src/components/toast-banner";
import { useTranslation } from "../../src/i18n";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../../src/components/keyboard-screen-view";
import { useCollectionFeedbackStore } from "../../src/stores/collection-feedback-store";
import { useThemeStore } from "../../src/stores/theme-store";
import {
  useAppHeaderHeight,
  useBottomTabBarContentPadding,
} from "../../src/theme/layout";
import { THEME_COLORS } from "../../src/theme/themes";
import { useAnimatedValue } from "../../src/hooks/use-animated-value";

type CollectionEntry = CollectionResponse["cards"][number];
type OwnershipFilter = "all" | "owned" | "not-owned";
type SortOption = "rarity" | "name" | "quantity" | "newest";

const SORT_OPTIONS: SortOption[] = ["rarity", "name", "quantity", "newest"];

const MODAL_TITLE_STYLE = {
  fontSize: 22,
  fontFamily: "Nunito_800ExtraBold",
  textAlign: "center",
  marginBottom: 14,
  paddingBottom: 14,
  borderBottomWidth: 1,
} as const;

const DUST_TABLE = [
  { rarity: "Common", recycle: 1, craft: 5 },
  { rarity: "Uncommon", recycle: 5, craft: 25 },
  { rarity: "Rare", recycle: 20, craft: 100 },
  { rarity: "Epic", recycle: 50, craft: 250 },
  { rarity: "Legendary", recycle: 100, craft: 500 },
];

const DUST_SHEET_TOP_GAP = 56;

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
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
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
  const router = useRouter();
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
  const [showDustModal, setShowDustModal] = useState(false);
  const [dustSheetIndex, setDustSheetIndex] = useState(0);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const toastAnim = useAnimatedValue(-60);

  const openDustSheet = () => {
    setShowDustModal(true);
    setDustSheetIndex(1);
  };

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

  const { data: collectionQueryData, error: collectionQueryError, isError: collectionQueryIsError, isLoading: collectionQueryIsLoading, refetch: collectionQueryRefetch } = useQuery({
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
  const sortOptionBaseStyle = useMemo(
    () =>
      ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 2,
      }) as const,
    [],
  );

  const renderCollectionItem = useCallback(
    ({ item, index }: { item: CollectionEntry; index: number }) => (
      <CardTile
        entry={item}
        accessToken={accessToken}
        muted={item.quantity === 0}
        testID={`collection-card-tile-${index}`}
        onPress={() =>
          router.push({
            pathname: "/collection-card-detail",
            params: { cardId: item.cardId },
          })
        }
      />
    ),
    [accessToken, router],
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
  const dustSheetScrim =
    themeName === "nightosphere"
      ? "rgba(6,1,10,0.84)"
      : "rgba(74,34,50,0.44)";

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
          onPress={openDustSheet}
          className="bg-secondaryTint"
          style={{
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 4,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            boxShadow: "0px 0px 6px rgba(0, 0, 0, 0.1)",
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
            boxShadow: "0px 0px 6px rgba(0, 0, 0, 0.1)",
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
        <ThemedExpoTextInput
          placeholder={t("collection.searchByNameOrCharacter")}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          hostStyle={{ flex: 1 }}
          style={{ backgroundColor: "transparent", height: 20, width: "100%" }}
          textStyle={{
            color: tc.fg,
            fontFamily: "Nunito_400Regular",
            fontSize: 14,
          }}
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
            <Text style={{ fontSize: 16, color: tc.muted }}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {(
          [
            {
              key: "all" as const,
              label: t("collection.ownershipFilters.all"),
              count: allCards.length,
            },
            {
              key: "owned" as const,
              label: t("collection.ownershipFilters.owned"),
              count: ownedCount,
            },
            {
              key: "not-owned" as const,
              label: t("collection.ownershipFilters.notOwned"),
              count: notOwnedCount,
            },
          ] satisfies Array<{
            key: OwnershipFilter;
            label: string;
            count: number;
          }>
        ).map((option) => {
          const isActive = ownershipFilter === option.key;

          return (
            <Pressable
              key={option.key}
              onPress={() => setOwnershipFilter(option.key)}
              style={{
                flex: 1,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: isActive ? tc.primaryBorder : tc.accentBorder,
                backgroundColor: isActive ? tc.primaryTint : tc.surfaceMuted,
                paddingHorizontal: 10,
                paddingVertical: 10,
                alignItems: "center",
                gap: 2,
              }}
              testID={`collection-ownership-filter-${option.key}`}
            >
              <Text
                style={{
                  fontFamily: isActive
                    ? "Nunito_800ExtraBold"
                    : "Nunito_700Bold",
                  fontSize: 13,
                  color: isActive ? tc.primaryText : tc.fg,
                }}
              >
                {option.label}
              </Text>
              <Text
                style={{
                  fontFamily: "Nunito_700Bold",
                  fontSize: 12,
                  color: isActive ? tc.primaryStrong : tc.fgMuted,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {option.count}
              </Text>
            </Pressable>
          );
        })}
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
                    boxShadow: "0px 0px 4px rgba(0, 0, 0, 0.15)",
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
              {t("collection.all")} ({allCards.length})
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
                      boxShadow: "0px 0px 4px rgba(0, 0, 0, 0.15)",
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
            {t(`collection.sortOptions.${sortBy}`)}
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
          topOffset={headerHeight + 16}
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
        ListHeaderComponent={
          <View style={{ paddingTop: headerHeight }}>{listHeader}</View>
        }
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
              {allCards.length > 0
                ? t("collection.noFilterMatches")
                : t("collection.empty")}
            </Text>
          </View>
        }
        renderItem={renderCollectionItem}
      />

      {/* Stats Modal */}
      <ThemedModal
        visible={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        testID="collection-stats-modal"
      >
        <Text
          style={[
            MODAL_TITLE_STYLE,
            { color: tc.fg, borderBottomColor: tc.accentBorder },
          ]}
        >
          {t("collection.cardStats")}
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {ownedRarityGroups.length > 0 ? (
            ownedRarityGroups.map(({ name, count }) => {
              const rc = RARITY_COLORS[name] ?? RARITY_COLORS.Common;
              return (
                <View
                  key={name}
                  style={{
                    backgroundColor: tc.surfaceMuted,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: tc.primaryBorder,
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
                      fontVariant: ["tabular-nums"],
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
            })
          ) : (
            <View
              style={{
                width: "100%",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: tc.primaryBorder,
                backgroundColor: tc.surfaceMuted,
                paddingVertical: 18,
                paddingHorizontal: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 19,
                  fontFamily: "Nunito_600SemiBold",
                  color: tc.fgMuted,
                  textAlign: "center",
                }}
              >
                {t("collection.empty")}
              </Text>
            </View>
          )}
        </View>
        <PrimaryButton
          onPress={() => setShowStatsModal(false)}
          style={{ marginTop: 20 }}
          fallbackAppearance={{ borderRadius: 16 }}
        >
          {t("common.close")}
        </PrimaryButton>
      </ThemedModal>

      {/* Sort Modal */}
      <ThemedModal
        visible={showSortModal}
        onClose={() => setShowSortModal(false)}
        testID="collection-sort-modal"
      >
        <Text
          style={[
            MODAL_TITLE_STYLE,
            { color: tc.fg, borderBottomColor: tc.accentBorder },
          ]}
        >
          {t("collection.sortTitle")}
        </Text>
        <View style={{ gap: 8 }}>
          {SORT_OPTIONS.map((option) => {
            const isActive = sortBy === option;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  setSortBy(option);
                  setShowSortModal(false);
                }}
                style={[
                  sortOptionBaseStyle,
                  {
                    backgroundColor: isActive
                      ? tc.primaryTint
                      : tc.surfaceMuted,
                    borderColor: isActive ? tc.primaryBorder : "transparent",
                  },
                ]}
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
                  {t(`collection.sortOptions.${option}`)}
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
          })}
        </View>
        <PrimaryButton
          onPress={() => setShowSortModal(false)}
          style={{ marginTop: 16 }}
          fallbackAppearance={{ borderRadius: 16 }}
        >
          {t("common.close")}
        </PrimaryButton>
      </ThemedModal>

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
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 999,
                    backgroundColor: tc.secondaryBorder,
                  }}
                />
                <View
                  style={{
                    width: "100%",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      flex: 1,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: tc.secondary,
                      }}
                    >
                      <DustIcon size={20} color={tc.secondaryText} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        className="text-secondaryText"
                        style={{
                          fontSize: 18,
                          fontFamily: "Nunito_800ExtraBold",
                        }}
                      >
                        {t("collection.dustModal.title")}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          lineHeight: 17,
                          color: tc.fgMuted,
                          fontFamily: "Nunito_400Regular",
                        }}
                      >
                        {t("collection.dustModal.description")}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

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
