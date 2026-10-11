import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useIsFocused, useNavigation } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Check from "lucide-react-native/icons/check";
import Coins from "lucide-react-native/icons/coins";
import Copy from "lucide-react-native/icons/copy";
import Lock from "lucide-react-native/icons/lock";
import LockKeyhole from "lucide-react-native/icons/lock-keyhole";
import PackageIcon from "lucide-react-native/icons/package";
import PackageOpen from "lucide-react-native/icons/package-open";
import Percent from "lucide-react-native/icons/percent";
import Pointer from "lucide-react-native/icons/pointer";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import Sparkles from "lucide-react-native/icons/sparkles";
import Zap from "lucide-react-native/icons/zap";
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import type {
  CollectionResponse,
  HomeResponse,
  PvpLoadoutsResponse,
} from "@adventure-time/api-client";

import { CardTile } from "../../src/components/card-tile";
import { CARD_ART_RATIO } from "../../src/components/card-back-cover-art";
import { PageErrorState } from "../../src/components/error-state";
import { PageLoadingState } from "../../src/components/loading-state";
import { getPackOpeningArtSource } from "../../src/components/pack-opening-art";
import PackOpeningSequenceDom from "../../src/components/pack-opening-sequence-dom";
import { Button } from "../../src/components/ui/button";
import { Card } from "../../src/components/ui/card";
import { Chip } from "../../src/components/ui/chip";
import { ListRow } from "../../src/components/ui/list-row";
import { Notice } from "../../src/components/ui/notice";
import { PageTitle } from "../../src/components/ui/page-title";
import { ProgressBar } from "../../src/components/ui/progress-bar";
import { SectionHeader } from "../../src/components/ui/section-header";
import { StatTile } from "../../src/components/ui/stat-tile";
import { ICON_STROKE_WIDTH } from "../../src/components/ui/tokens";
import { useTranslation } from "../../src/i18n";
import { apiClient, wait } from "../../src/lib/api";
import { prefetchCatalogImages } from "../../src/lib/catalog-images";
import { prefetchCardImages } from "../../src/lib/card-images";
import { useSessionStore } from "../../src/stores/session-store";
import { useThemeStore } from "../../src/stores/theme-store";
import {
  useAppHeaderHeight,
  useBottomTabBarContentPadding,
} from "../../src/theme/layout";
import { THEME_COLORS } from "../../src/theme/themes";

import {
  CardBackStack,
  LoadingProgressFill,
  PackPreviewCard,
  PackSummaryCardSheet,
  ReadyRevealGlow,
  ReadyRevealStackWrapper,
  RevealCardStage,
} from "../../src/features/packs/opening-components";
import { DropRatesSheet } from "../../src/features/packs/drop-rates-sheet";
import {
  patchCollectionAfterPackOpen,
  patchHomeAfterPackOpen,
  patchPvpLoadoutsAfterPackOpen,
} from "../../src/features/packs/collection-cache";
import {
  IS_E2E_BUILD,
  PACK_OPEN_BURST_MS,
  PACK_OPEN_PROGRESS_MS,
  PACK_OPEN_SHAKE_MS,
  REVEAL_CARD_RATIO,
  REVEAL_FLIP_MS,
  REVEAL_START_DELAY_MS,
  SPARK_REVEAL_FLIP_MS,
  SPARK_REVEAL_START_DELAY_MS,
  buildCardBackVisualMap,
  canOpenPackWithBalance,
  formatPackAvailabilityDate,
  getHapticForCard,
  getPackArtUrl,
  getPackTone,
  getRarityGlowColor,
  getRarityIcon,
  getRarityTone,
  getThemeRarityPalette,
  isPackLimited,
  slugifyPackName,
  toCardTileEntry,
  toRarityName,
  withOccurrenceKeys,
  type OpenedCard,
  type OpeningPhase,
  type Pack,
} from "../../src/features/packs/opening-model";

export default function PacksScreen() {
  return usePacksScreenView();
}

function usePacksScreenView() {
  const navigation = useNavigation();
  // The hidden pre-warm WebView only matters while the Packs tab is on screen.
  const screenFocused = useIsFocused();
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((state) => state.accessToken);
  const patchUser = useSessionStore((state) => state.patchUser);
  const coins = useSessionStore((state) => state.user?.coins ?? 0);
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const { t } = useTranslation();
  const headerHeight = useAppHeaderHeight();
  const bottomTabPadding = useBottomTabBarContentPadding();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [phase, setPhase] = useState<OpeningPhase>("selecting");
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [openedCards, setOpenedCards] = useState<OpenedCard[]>([]);
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const [isRevealSettled, setIsRevealSettled] = useState(false);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [previewedCard, setPreviewedCard] = useState<OpenedCard | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [openingRunId, setOpeningRunId] = useState(0);
  const [openError, setOpenError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const isCardPreviewVisible = previewedCard !== null;
  const shouldHideTabBar =
    (phase !== "selecting" && phase !== "complete") || isCardPreviewVisible;
  const openingBottomPadding = shouldHideTabBar
    ? Math.max(safeAreaBottom + 16, 24)
    : bottomTabPadding;
  const storefrontScrollBottomSpacerHeight = bottomTabPadding;
  const summaryScrollBottomSpacerHeight = Math.max(92, bottomTabPadding);

  const revealCardWidth = Math.min(
    width - 36,
    344,
    Math.max(236, height - openingBottomPadding - 364) * CARD_ART_RATIO,
  );
  const stageCardWidth = revealCardWidth;

  const chargeAnim = useSharedValue(0);
  const sheenAnim = useSharedValue(0);
  const burstFlashAnim = useSharedValue(0);
  const loadingIdleAnim = useSharedValue(0);
  const loadingProgressAnim = useSharedValue(0);
  const stackSpreadAnim = useSharedValue(0);
  const readyRevealAnim = useSharedValue(0);
  const pulseAnim = useSharedValue(1);
  const flipAnim = useSharedValue(0);
  const revealHaloAnim = useSharedValue(0);
  const revealSparkAnim = useSharedValue(0);
  const burstOpenAnim = useSharedValue(0);
  const readyPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealAnimationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isRevealAnimatingRef = useRef(false);

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: shouldHideTabBar ? { display: "none" } : undefined,
    });

    return () => {
      navigation.setOptions({
        tabBarStyle: undefined,
      });
    };
  }, [navigation, shouldHideTabBar]);

  useEffect(() => {
    if (phase !== "readyToReveal") {
      return;
    }

    readyRevealAnim.value = 0;
    pulseAnim.value = 0;
    stackSpreadAnim.value = 0;

    readyRevealAnim.value = withTiming(1, {
      duration: IS_E2E_BUILD ? 900 : 1350,
      easing: Easing.inOut(Easing.cubic),
    });
    stackSpreadAnim.value = withTiming(1, {
      duration: IS_E2E_BUILD ? 950 : 1600,
      easing: Easing.inOut(Easing.cubic),
    });
    readyPulseTimerRef.current = setTimeout(
      () => {
        pulseAnim.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 2400, easing: Easing.linear }),
            withTiming(0, { duration: 0 }),
          ),
          -1,
        );
      },
      IS_E2E_BUILD ? 950 : 1600,
    );

    return () => {
      if (readyPulseTimerRef.current) {
        clearTimeout(readyPulseTimerRef.current);
        readyPulseTimerRef.current = null;
      }
      cancelAnimation(pulseAnim);
    };
  }, [phase, pulseAnim, readyRevealAnim, stackSpreadAnim]);

  useEffect(() => {
    if (phase !== "loading") {
      cancelAnimation(loadingIdleAnim);
      loadingIdleAnim.value = 0;
      return;
    }

    loadingIdleAnim.value = 0;
    loadingIdleAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2450, easing: Easing.linear }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
    );

    return () => {
      cancelAnimation(loadingIdleAnim);
    };
  }, [loadingIdleAnim, phase]);

  function stopChargeAnimations() {
    cancelAnimation(chargeAnim);
    cancelAnimation(sheenAnim);
  }

  function startChargeAnimation() {
    stopChargeAnimations();
    chargeAnim.value = 0;
    sheenAnim.value = 0;

    chargeAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 920, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 920, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    sheenAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3400, easing: Easing.linear }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
    );
  }

  function startBurstAnimation() {
    stopChargeAnimations();
    burstFlashAnim.value = 0;
    burstOpenAnim.value = 0;
    burstFlashAnim.value = withSequence(
      withTiming(1, {
        duration: Math.round(PACK_OPEN_BURST_MS * 0.3),
        easing: Easing.out(Easing.quad),
      }),
      withTiming(0, {
        duration: Math.round(PACK_OPEN_BURST_MS * 0.7),
        easing: Easing.in(Easing.quad),
      }),
    );
    burstOpenAnim.value = withTiming(1, {
      duration: PACK_OPEN_BURST_MS,
      easing: Easing.out(Easing.cubic),
    });
  }

  function animateLoadingProgress(from: number, to: number, duration: number) {
    setLoadingProgress(Math.round(to));
    loadingProgressAnim.value = from;

    return new Promise<void>((resolve) => {
      loadingProgressAnim.value = withTiming(
        to,
        {
          duration,
          easing: Easing.inOut(Easing.quad),
        },
        () => {
          scheduleOnRN(resolve);
        },
      );
    });
  }

  async function openPack(pack: Pack) {
    if (isPackLimited(pack)) {
      setOpenError(
        pack.availability?.nextAvailableAt
          ? t("packs.weeklyLimitCaption", {
              date: formatPackAvailabilityDate(
                pack.availability.nextAvailableAt,
              ),
            })
          : t("packs.weeklyLimitReached"),
      );
      return;
    }

    if (coins < pack.cost) {
      setOpenError(
        t("packs.needCoins", { required: pack.cost, current: coins }),
      );
      return;
    }

    setOpenError(null);
    setSelectedPack(pack);
    setOpenedCards([]);
    setRevealedIndex(-1);
    setPreviewedCard(null);
    setLoadingProgress(0);
    loadingProgressAnim.value = 0;
    stackSpreadAnim.value = 0;
    setNewBalance(null);
    setIsOpening(true);
    setOpeningRunId((value) => value + 1);

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => null,
    );

    setPhase("shaking");
    startChargeAnimation();

    const apiCallPromise = apiClient.openPack({ packId: pack.id });

    await wait(PACK_OPEN_SHAKE_MS);
    setPhase("bursting");
    startBurstAnimation();

    await wait(PACK_OPEN_BURST_MS);
    setPhase("loading");

    try {
      await animateLoadingProgress(12, 44, PACK_OPEN_PROGRESS_MS.first);
      const result = await apiCallPromise;

      setOpenedCards(result.cards);
      setNewBalance(result.newBalance);
      setSelectedPack(result.pack);
      queryClient.setQueryData<CollectionResponse | undefined>(
        ["collection"],
        (current) => patchCollectionAfterPackOpen(current, result),
      );
      queryClient.setQueryData<HomeResponse | undefined>(
        ["home"],
        (current) => patchHomeAfterPackOpen(current, result),
      );
      queryClient.setQueryData<PvpLoadoutsResponse | undefined>(
        ["pvp-loadouts"],
        (current) => patchPvpLoadoutsAfterPackOpen(current, result),
      );

      await Promise.all([
        prefetchCardImages(result.cards.map((card) => card.imageAssetId)),
        prefetchCatalogImages([
          result.pack.packArtAssetId,
          ...(packsQueryData?.cardBackVisuals.map(
            (visual) => visual.imageAssetId,
          ) ?? []),
        ]),
        animateLoadingProgress(44, 82, PACK_OPEN_PROGRESS_MS.second),
      ]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
        queryClient.invalidateQueries({ queryKey: ["daily-claim"] }),
        queryClient.invalidateQueries({ queryKey: ["packs"] }),
        queryClient.invalidateQueries({ queryKey: ["pvp-loadouts"] }),
        patchUser({ coins: result.newBalance }),
        animateLoadingProgress(82, 100, PACK_OPEN_PROGRESS_MS.final),
      ]);

      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => null);
      setPhase("readyToReveal");
      setRevealedIndex(-1);
    } catch (error) {
      setOpenError(
        error instanceof Error ? error.message : t("packs.openFailed"),
      );
      setPhase("selecting");
      setSelectedPack(null);
      setOpenedCards([]);
      setRevealedIndex(-1);
      setPreviewedCard(null);
      setLoadingProgress(0);
      setNewBalance(null);
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      ).catch(() => null);
    } finally {
      setIsOpening(false);
    }
  }

  function revealNext() {
    if (isRevealAnimatingRef.current) {
      return;
    }

    const nextIndex = revealedIndex + 1;

    if (nextIndex >= openedCards.length) {
      setPhase("complete");
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => null);
      return;
    }

    const nextCard = openedCards[nextIndex];
    const hapticType = getHapticForCard(nextCard);

    isRevealAnimatingRef.current = true;
    setIsRevealSettled(false);
    setRevealedIndex(nextIndex);
    setPhase("revealing");
    flipAnim.value = 0;
    revealHaloAnim.value = 0;
    revealSparkAnim.value = 0;
    if (revealAnimationTimerRef.current) {
      clearTimeout(revealAnimationTimerRef.current);
      revealAnimationTimerRef.current = null;
    }
    cancelAnimation(flipAnim);
    cancelAnimation(revealHaloAnim);
    cancelAnimation(revealSparkAnim);
    const isSparkReveal = nextCard.revealSource === "spark";
    const revealStartDelay = isSparkReveal
      ? SPARK_REVEAL_START_DELAY_MS
      : REVEAL_START_DELAY_MS;
    const flipDuration = isSparkReveal ? SPARK_REVEAL_FLIP_MS : REVEAL_FLIP_MS;
    const haloDuration = isSparkReveal ? 360 : IS_E2E_BUILD ? 120 : 220;
    flipAnim.value = withDelay(
      revealStartDelay,
      withTiming(1, {
        duration: flipDuration,
        easing: Easing.bezier(0.22, 0.61, 0.36, 1),
      }),
    );
    revealSparkAnim.value = withDelay(
      revealStartDelay,
      withTiming(isSparkReveal ? 1 : 0, {
        duration: isSparkReveal ? SPARK_REVEAL_FLIP_MS + 260 : 1,
        easing: Easing.out(Easing.cubic),
      }),
    );
    revealHaloAnim.value = withDelay(
      revealStartDelay + flipDuration,
      withTiming(1, {
        duration: haloDuration,
        easing: Easing.out(Easing.quad),
      }),
    );
    revealAnimationTimerRef.current = setTimeout(
      () => {
        revealAnimationTimerRef.current = null;
        isRevealAnimatingRef.current = false;
        setIsRevealSettled(true);
      },
      revealStartDelay + flipDuration + haloDuration,
    );

    if (hapticType) {
      void Haptics.notificationAsync(hapticType).catch(() => null);
    } else {
      void Haptics.selectionAsync().catch(() => null);
    }
  }

  function finishRevealAnimation() {
    if (revealAnimationTimerRef.current) {
      clearTimeout(revealAnimationTimerRef.current);
      revealAnimationTimerRef.current = null;
    }
    cancelAnimation(flipAnim);
    cancelAnimation(revealHaloAnim);
    cancelAnimation(revealSparkAnim);
    flipAnim.value = 1;
    revealHaloAnim.value = 1;
    revealSparkAnim.value = 1;
    isRevealAnimatingRef.current = false;
    setIsRevealSettled(true);
  }

  function handleRevealTap() {
    if (isRevealAnimatingRef.current) {
      finishRevealAnimation();
      return;
    }

    revealNext();
  }

  function reset() {
    setPhase("selecting");
    setSelectedPack(null);
    setOpenedCards([]);
    setRevealedIndex(-1);
    setPreviewedCard(null);
    isRevealAnimatingRef.current = false;
    setIsRevealSettled(false);
    setNewBalance(null);
    setLoadingProgress(0);
    setOpenError(null);
    setIsOpening(false);
    stopChargeAnimations();
    if (revealAnimationTimerRef.current) {
      clearTimeout(revealAnimationTimerRef.current);
      revealAnimationTimerRef.current = null;
    }
    [
      burstFlashAnim,
      loadingIdleAnim,
      loadingProgressAnim,
      stackSpreadAnim,
      readyRevealAnim,
      pulseAnim,
      flipAnim,
      revealHaloAnim,
      revealSparkAnim,
      burstOpenAnim,
    ].forEach((anim) => cancelAnimation(anim));
    chargeAnim.value = 0;
    sheenAnim.value = 0;
    burstFlashAnim.value = 0;
    loadingIdleAnim.value = 0;
    loadingProgressAnim.value = 0;
    stackSpreadAnim.value = 0;
    readyRevealAnim.value = 0;
    pulseAnim.value = 1;
    flipAnim.value = 0;
    revealHaloAnim.value = 0;
    revealSparkAnim.value = 0;
    burstOpenAnim.value = 0;
  }

  const {
    data: packsQueryData,
    error: packsQueryError,
    isError: packsQueryIsError,
    isLoading: packsQueryIsLoading,
    refetch: packsQueryRefetch,
  } = useQuery({
    queryKey: ["packs"],
    queryFn: () => apiClient.packs(),
  });
  const { data: raritiesQueryData } = useQuery({
    queryKey: ["rarities"],
    queryFn: () => apiClient.rarities(),
  });
  const rarities = raritiesQueryData?.rarities ?? [];
  const [dropRatesOpen, setDropRatesOpen] = useState(false);

  const cardBackVisualMap = useMemo(
    () => buildCardBackVisualMap(packsQueryData?.cardBackVisuals ?? []),
    [packsQueryData?.cardBackVisuals],
  );

  const packVisualPrefetchKey = useMemo(() => {
    if (!packsQueryData) {
      return "";
    }

    return [
      ...packsQueryData.packs.map((pack) => pack.packArtAssetId ?? ""),
      ...packsQueryData.cardBackVisuals.map(
        (visual) => visual.imageAssetId ?? "",
      ),
    ].join(",");
  }, [packsQueryData]);

  useEffect(() => {
    if (!packsQueryData || !packVisualPrefetchKey) {
      return;
    }

    void prefetchCatalogImages([
      ...packsQueryData.packs.map((pack) => pack.packArtAssetId),
      ...packsQueryData.cardBackVisuals.map((visual) => visual.imageAssetId),
    ]);
  }, [packVisualPrefetchKey, packsQueryData]);

  if (packsQueryIsLoading) {
    return (
      <PageLoadingState
        title={t("nav.pack")}
        message={t("common.loadingStates.pageBody")}
        icon="gift"
      />
    );
  }

  if (packsQueryIsError || !packsQueryData) {
    return (
      <PageErrorState
        error={packsQueryError}
        title={packsQueryError ? undefined : t("packs.unavailable")}
        body={
          packsQueryError ? undefined : t("common.errorStates.generic.body")
        }
        detail={
          packsQueryError ? undefined : t("common.errorStates.generic.detail")
        }
        onRetry={() => {
          void packsQueryRefetch();
        }}
      />
    );
  }

  const packs = packsQueryData.packs;
  const availablePacks = packs.filter((pack) => !isPackLimited(pack));
  const affordablePacks = availablePacks.filter((pack) =>
    canOpenPackWithBalance(pack, coins),
  );
  const cheapestLockedPack = packs.reduce<Pack | undefined>(
    (cheapest, pack) => {
      if (isPackLimited(pack) || pack.cost <= coins) {
        return cheapest;
      }

      if (!cheapest || pack.cost < cheapest.cost) {
        return pack;
      }

      return cheapest;
    },
    undefined,
  );
  const featuredPack =
    affordablePacks.reduce<Pack | undefined>((best, pack) => {
      if (!best || pack.cardCount > best.cardCount) {
        return pack;
      }

      return best;
    }, undefined) ||
    availablePacks.reduce<Pack | undefined>((cheapest, pack) => {
      if (!cheapest || pack.cost < cheapest.cost) {
        return pack;
      }

      return cheapest;
    }, undefined);
  const heroPack = featuredPack ?? cheapestLockedPack ?? packs[0];
  const heroCanOpen = heroPack
    ? canOpenPackWithBalance(heroPack, coins)
    : false;
  const otherPacks = packs.filter((pack) => pack.id !== heroPack?.id);

  function getPackCaption(pack: Pack) {
    if (isPackLimited(pack)) {
      return pack.availability?.nextAvailableAt
        ? t("packs.weeklyLimitCaption", {
            date: formatPackAvailabilityDate(pack.availability.nextAvailableAt),
          })
        : t("packs.weeklyLimitReached");
    }

    const parts = [
      t("packs.cardsCount", { count: pack.cardCount }),
      pack.guaranteedRarity
        ? t("packs.guaranteed", { rarity: pack.guaranteedRarity })
        : t("packs.standardOdds"),
    ];
    if (pack.cost > coins) {
      parts.push(t("packs.needMoreCoinsShort", { count: pack.cost - coins }));
    }

    return parts.join(" · ");
  }

  function getPackAccessibilityLabel(pack: Pack) {
    return `${pack.name}, ${t("packs.tapToOpen")}, ${pack.cost}`;
  }
  const openingStackRarities = openedCards.slice(0, 3).map((card) => {
    if (card.revealSource === "spark") {
      return "Common";
    }

    return toRarityName(card.rarity?.name);
  });

  if (
    (phase === "shaking" || phase === "bursting" || phase === "loading") &&
    selectedPack
  ) {
    const isLoadingPhase = phase === "loading";
    const isChargePhase = phase === "shaking";
    const prewarmDomOpacity = 0.001;
    const chargePreviewWidth = Math.min(stageCardWidth * 1.4, 320);
    const openingStageHeight = Math.min(Math.max(height * 0.62, 420), 620);
    const openingStageTranslateY = 10;
    const loadingFooterTranslateY = 56;
    const openingFooterReserve = Math.min(Math.max(height * 0.24, 196), 252);
    const openingDom = (
      <PackOpeningSequenceDom
        key={`${openingRunId}`}
        mode={
          isLoadingPhase ? "loading" : phase === "bursting" ? "burst" : "charge"
        }
        pack={{
          backgroundColor: tc.bg,
          cardCountLabel: t("packs.cardsCount", {
            count: selectedPack.cardCount,
          }),
          color: selectedPack.color || "#C96A24",
          guaranteedRarity: selectedPack.guaranteedRarity,
          name: selectedPack.name,
          packArtAssetId: selectedPack.packArtAssetId,
          packArtUrl: getPackArtUrl(selectedPack),
        }}
        stageOffsetY={openingStageTranslateY}
        dom={{
          contentInsetAdjustmentBehavior: "never",
          scrollEnabled: false,
          style: {
            backgroundColor: "transparent",
            flex: 1,
            opacity: isChargePhase ? prewarmDomOpacity : 1,
          },
        }}
      />
    );

    return (
      <View
        testID={
          isLoadingPhase ? "pack-opening-loading" : "pack-opening-shaking"
        }
        className="flex-1 bg-bg"
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          }}
        >
          {openingDom}
        </View>
        <View
          className="flex-1 px-4"
          style={{
            paddingTop: headerHeight + 16,
            paddingBottom: openingBottomPadding,
          }}
        >
          <View className="flex-1 justify-center">
            <View
              className="self-center overflow-hidden rounded-[28px]"
              style={{
                width: "100%",
                maxWidth: 520,
                height: openingStageHeight,
                transform: [{ translateY: openingStageTranslateY }],
              }}
            >
              {isChargePhase ? (
                <View className="absolute inset-0 items-center justify-center">
                  <PackPreviewCard
                    pack={selectedPack}
                    width={chargePreviewWidth}
                    tc={tc}
                    chargeAnim={chargeAnim}
                    sheenAnim={sheenAnim}
                  />
                </View>
              ) : null}
            </View>
          </View>

          <View
            className="w-full max-w-[360px] items-center gap-ds-3 self-center rounded-ds-lg border border-primaryBorder bg-surface p-ds-6"
            style={{
              minHeight: isLoadingPhase ? openingFooterReserve : undefined,
              transform: isLoadingPhase
                ? [{ translateY: loadingFooterTranslateY }]
                : undefined,
            }}
          >
            <Chip
              tone="accent"
              icon={isLoadingPhase ? LockKeyhole : Zap}
              label={
                isLoadingPhase
                  ? t("packs.opening.syncingProgress")
                  : t("packs.opening.packOpened", { name: selectedPack.name })
              }
              className="self-center"
            />
            <Text className="text-center font-nunito-extrabold text-ds-h3 text-fg">
              {isLoadingPhase
                ? t("packs.opening.sortingTitle")
                : t("packs.opening.chargeTitle")}
            </Text>
            {isLoadingPhase ? (
              <>
                <Text className="text-center font-nunito text-ds-body text-fgMuted">
                  {t("packs.opening.sortingBody")}
                </Text>
                <View className="h-ds-2 w-full overflow-hidden rounded-ds-pill bg-primaryTint">
                  <LoadingProgressFill
                    color={tc.primary}
                    progress={loadingProgressAnim}
                  />
                </View>
                <Text className="text-center font-nunito-bold text-ds-sm text-fgMuted">
                  {loadingProgress}%
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  if (phase === "readyToReveal" && selectedPack) {
    return (
      <Pressable
        testID="pack-opening-ready"
        onPress={revealNext}
        className="flex-1 bg-bg"
      >
        <View
          className="flex-1 items-center gap-ds-4 px-ds-4"
          style={{
            paddingTop: headerHeight + 8,
            paddingBottom: openingBottomPadding,
          }}
        >
          <Chip
            tone="accent"
            icon={PackageIcon}
            label={`${selectedPack.name} · ${t("packs.cardsCount", {
              count: openedCards.length,
            })}`}
            className="self-center"
          />
          <View className="w-full items-center gap-[6px]">
            <Text
              accessibilityRole="header"
              className="text-center font-nunito-extrabold text-ds-h1 text-fg"
            >
              {t("packs.opening.readyTitle")}
            </Text>
            <Text className="text-center font-nunito text-ds-body text-fgMuted">
              {t("packs.opening.readyBody")}
            </Text>
          </View>

          <View className="w-full flex-1 items-center justify-center">
            <ReadyRevealGlow
              anim={readyRevealAnim}
              height={stageCardWidth / REVEAL_CARD_RATIO + 118}
              surfaceColor={tc.surface}
              width={stageCardWidth + 118}
            />
            <ReadyRevealStackWrapper anim={readyRevealAnim}>
              <CardBackStack
                width={stageCardWidth}
                tc={tc}
                themeName={themeName}
                cardBackVisualMap={cardBackVisualMap}
                rarityNames={openingStackRarities}
                spreadAnim={stackSpreadAnim}
                pulseAnim={pulseAnim}
              />
            </ReadyRevealStackWrapper>
          </View>

          <View className="w-full items-center gap-[10px]">
            <ProgressBar value={0} className="w-full" />
            <View className="flex-row items-center gap-[6px]">
              <Pointer
                size={18}
                color={tc.primaryText}
                strokeWidth={ICON_STROKE_WIDTH}
              />
              <Text className="text-center font-nunito-bold text-ds-body text-primaryText">
                {t("packs.opening.revealCta")}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  if (
    phase === "revealing" &&
    selectedPack &&
    revealedIndex >= 0 &&
    revealedIndex < openedCards.length
  ) {
    const card = openedCards[revealedIndex];
    const rarityName = toRarityName(card.rarity?.name);
    const rarityRing =
      getThemeRarityPalette(themeName, rarityName)?.ring ?? tc.primaryDark;
    const glowColor = getRarityGlowColor(rarityName);
    const isLastCard = revealedIndex === openedCards.length - 1;
    const isSparkReveal = card.revealSource === "spark";
    return (
      <Pressable
        testID="pack-opening-reveal"
        onPress={handleRevealTap}
        className="flex-1 bg-bg"
      >
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: glowColor,
            opacity: 0.1,
          }}
        />

        <View
          className="flex-1 gap-ds-4 px-ds-4"
          style={{
            paddingTop: headerHeight + 8,
            paddingBottom: openingBottomPadding,
          }}
        >
          <View className="w-full max-w-[360px] gap-ds-2 self-center">
            <View className="flex-row items-center justify-between gap-ds-3">
              <Chip
                tone={getRarityTone(rarityName)}
                icon={getRarityIcon(rarityName)}
                label={rarityName}
              />
              <Text className="font-nunito-bold text-ds-sm text-fgMuted">
                {t("packs.reveal.cardProgress", {
                  current: revealedIndex + 1,
                  total: openedCards.length,
                })}
              </Text>
            </View>
            <ProgressBar
              value={(revealedIndex + 1) / openedCards.length}
              complete={false}
            />
          </View>

          <View className="flex-1 items-center justify-center">
            <RevealCardStage
              accessToken={accessToken}
              card={card}
              cardBackVisualMap={cardBackVisualMap}
              flipAnim={flipAnim}
              isRevealSettled={isRevealSettled}
              isSparkReveal={isSparkReveal}
              newBadgeLabel={t("packs.openResult.newBadge")}
              rarityName={rarityName}
              rarityRing={rarityRing}
              revealCardWidth={revealCardWidth}
              revealHaloAnim={revealHaloAnim}
              revealSparkAnim={revealSparkAnim}
              tc={tc}
              themeName={themeName}
            />
          </View>

          <View className="items-center gap-[10px]">
            <Chip
              tone={card.isNewForUser ? "success" : "neutral"}
              icon={card.isNewForUser ? Sparkles : Copy}
              label={
                card.isNewForUser
                  ? t("packs.reveal.newCard")
                  : t("packs.reveal.duplicate")
              }
              className="self-center"
            />
            <Text className="text-center font-nunito-bold text-ds-body text-primaryText">
              {isLastCard
                ? t("packs.reveal.tapSummary")
                : t("packs.reveal.tapNext")}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  if (phase === "complete" && selectedPack) {
    const newCards = openedCards.filter((card) => card.isNewForUser);
    const duplicateCards = openedCards.filter((card) => !card.isNewForUser);
    const nextBalance = newBalance ?? coins;
    const canReopenSelected =
      nextBalance >= selectedPack.cost && !isPackLimited(selectedPack);
    const summaryCards = [...newCards, ...duplicateCards];
    const keyedSummaryCards = withOccurrenceKeys(summaryCards, (card) => card.id);
    const rarityCounts = openedCards.reduce<Record<string, number>>(
      (accumulator, card) => {
        const rarityName = toRarityName(card.rarity?.name);
        accumulator[rarityName] = (accumulator[rarityName] ?? 0) + 1;
        return accumulator;
      },
      {},
    );
    const previewedPullIndex = previewedCard
      ? Math.max(0, openedCards.indexOf(previewedCard))
      : 0;

    return (
      <>
        <ScrollView
          testID="pack-opening-summary"
          className="flex-1 bg-bg"
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 12,
            gap: 12,
          }}
          scrollIndicatorInsets={{ bottom: bottomTabPadding }}
        >
          <View style={{ height: headerHeight }} />
          <PageTitle
            title={selectedPack.name}
            subtitle={t("packs.summary.subtitle")}
          />

          <View className="flex-row gap-ds-3">
            <StatTile
              tone="primary"
              label={t("packs.summary.totalCards")}
              value={openedCards.length}
              className="flex-1"
            />
            <StatTile
              tone="success"
              label={t("packs.summary.newCards")}
              value={newCards.length}
              className="flex-1"
            />
          </View>

          <Card>
            <Text className="font-nunito-extrabold text-ds-h3 text-fg">
              {t("packs.summary.rarityBreakdown")}
            </Text>
            <View className="flex-row flex-wrap gap-ds-2">
              {(
                ["Legendary", "Epic", "Rare", "Uncommon", "Common"] as const
              ).map((rarityName) => {
                const count = rarityCounts[rarityName];
                if (!count) {
                  return null;
                }

                return (
                  <Chip
                    key={rarityName}
                    tone={getRarityTone(rarityName)}
                    icon={getRarityIcon(rarityName)}
                    label={t("packs.summary.rarityCount", {
                      rarity: rarityName,
                      count,
                    })}
                  />
                );
              })}
            </View>
          </Card>

          <SectionHeader
            title={t("packs.summary.allCards")}
            subtitle={t("packs.summary.allCardsHint")}
            className="mt-ds-2"
          />
          <View className="flex-row flex-wrap justify-between gap-y-ds-3">
            {keyedSummaryCards.map(({ item: card, key }, index) => (
              <View key={key} style={{ width: "48.3%" }}>
                <CardTile
                  testID={`pack-summary-card-all-${index}`}
                  onPress={() => setPreviewedCard(card)}
                  entry={toCardTileEntry(card)}
                  accessToken={accessToken}
                  fitContainer
                />
              </View>
            ))}
          </View>

          <View className="gap-ds-2 pt-ds-2">
            {canReopenSelected ? (
              <Button
                tone="primary"
                icon={RotateCcw}
                testID={`pack-summary-open-again-${slugifyPackName(selectedPack.name)}`}
                onPress={() => void openPack(selectedPack)}
                disabled={isOpening}
                style={{ width: "100%" }}
              >
                {t("packs.summary.openSamePack")}
              </Button>
            ) : null}

            <Button
              tone="secondary"
              icon={PackageIcon}
              testID="pack-summary-browse"
              onPress={reset}
              style={{ width: "100%" }}
            >
              {t("packs.summary.browsePacks")}
            </Button>
          </View>

          <View style={{ height: summaryScrollBottomSpacerHeight }} />
        </ScrollView>

        {previewedCard ? (
          <PackSummaryCardSheet
            key={previewedCard.id}
            card={previewedCard}
            pullIndex={previewedPullIndex}
            pullTotal={openedCards.length}
            accessToken={accessToken}
            onClose={() => setPreviewedCard(null)}
          />
        ) : null}
      </>
    );
  }

  return (
    <View testID="pack-storefront" className="flex-1 bg-bg">
      {heroPack && screenFocused ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1,
            height: 1,
            opacity: 0,
            overflow: "hidden",
          }}
        >
          <PackOpeningSequenceDom
            mode="charge"
            pack={{
              backgroundColor: tc.bg,
              cardCountLabel: t("packs.cardsCount", {
                count: heroPack.cardCount,
              }),
              color: heroPack.color || "#C96A24",
              guaranteedRarity: heroPack.guaranteedRarity,
              name: heroPack.name,
              packArtAssetId: heroPack.packArtAssetId,
              packArtUrl: getPackArtUrl(heroPack),
            }}
            stageOffsetY={0}
            dom={{
              contentInsetAdjustmentBehavior: "never",
              scrollEnabled: false,
              style: {
                backgroundColor: "transparent",
                flex: 1,
              },
            }}
          />
        </View>
      ) : null}

      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 24,
          gap: 12,
        }}
        scrollIndicatorInsets={{ bottom: bottomTabPadding }}
      >
        <View style={{ height: headerHeight }} />
        <PageTitle title={t("packs.title")} subtitle={t("packs.subtitle")} />

        {heroPack ? (
          <Card testID="pack-featured">
            <View className="flex-row items-center justify-between gap-ds-2">
              {featuredPack ? (
                <Chip
                  tone="accent"
                  icon={Sparkles}
                  label={t("packs.recommended")}
                />
              ) : (
                <View />
              )}
              <Chip
                tone="success"
                icon={Check}
                label={t("packs.affordableCount", {
                  count: affordablePacks.length,
                })}
              />
            </View>

            <View
              className="h-[148px] items-center justify-center overflow-hidden rounded-ds-md"
              style={{ opacity: heroCanOpen ? 1 : 0.62 }}
            >
              <LinearGradient
                colors={[tc.primary, tc.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Image
                source={getPackOpeningArtSource({
                  guaranteedRarity: heroPack.guaranteedRarity,
                  name: heroPack.name,
                  packArtAssetId: heroPack.packArtAssetId,
                  packArtUrl: getPackArtUrl(heroPack),
                })}
                style={{ width: "100%", height: 132 }}
                contentFit="contain"
                transition={0}
                accessibilityIgnoresInvertColors
              />
            </View>

            <View className="gap-[2px]">
              <Text className="font-nunito-extrabold text-ds-h3 text-fg">
                {heroPack.name}
              </Text>
              <Text className="font-nunito text-ds-sm text-fgMuted">
                {getPackCaption(heroPack)}
              </Text>
            </View>

            <View className="flex-row items-center gap-ds-3">
              {isPackLimited(heroPack) ? (
                <Chip tone="neutral" icon={Lock} label={t("packs.locked")} />
              ) : (
                <Chip
                  tone="secondary"
                  icon={Coins}
                  label={String(heroPack.cost)}
                />
              )}
              <Button
                tone="primary"
                icon={PackageOpen}
                testID={`pack-card-${slugifyPackName(heroPack.name)}`}
                accessibilityLabel={getPackAccessibilityLabel(heroPack)}
                onPress={() => void openPack(heroPack)}
                disabled={isOpening || !heroCanOpen}
                style={{ flex: 1 }}
              >
                {t("packs.openPack")}
              </Button>
            </View>
          </Card>
        ) : null}

        {openError ? <Notice tone="danger" title={openError} /> : null}

        {otherPacks.length > 0 ? (
          <>
            <SectionHeader
              title={t("packs.allPacks")}
              subtitle={t("packs.coinBalance", { count: coins })}
              action={
                rarities.length > 0
                  ? {
                      label: t("packs.dropRates"),
                      icon: Percent,
                      onPress: () => setDropRatesOpen(true),
                      testID: "packs-drop-rates-button",
                    }
                  : undefined
              }
            />
            <Card flush>
              {otherPacks.map((pack, index) => {
                const limitReached = isPackLimited(pack);
                const canOpen = canOpenPackWithBalance(pack, coins);

                return (
                  <View
                    key={pack.id}
                    style={{ opacity: canOpen || limitReached ? 1 : 0.62 }}
                  >
                    <ListRow
                      testID={`pack-card-${slugifyPackName(pack.name)}`}
                      title={pack.name}
                      meta={getPackCaption(pack)}
                      icon={PackageIcon}
                      iconTone={getPackTone(pack)}
                      trailingChip={
                        limitReached
                          ? {
                              tone: "neutral",
                              icon: Lock,
                              label: t("packs.locked"),
                            }
                          : {
                              tone: "secondary",
                              icon: Coins,
                              label: String(pack.cost),
                            }
                      }
                      chevron
                      divider={index < otherPacks.length - 1}
                      accessibilityLabel={getPackAccessibilityLabel(pack)}
                      onPress={() => {
                        if (!isOpening) {
                          void openPack(pack);
                        }
                      }}
                    />
                  </View>
                );
              })}
            </Card>
          </>
        ) : null}

        <View style={{ height: storefrontScrollBottomSpacerHeight }} />
      </ScrollView>

      {dropRatesOpen && rarities.length > 0 ? (
        <DropRatesSheet
          rarities={rarities}
          onClose={() => setDropRatesOpen(false)}
        />
      ) : null}
    </View>
  );
}
