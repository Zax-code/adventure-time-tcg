import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useNavigation } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useState, useMemo, useRef } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton, SecondaryButton } from "../../src/components/button";
import { CardTile } from "../../src/components/card-tile";
import { CARD_ART_RATIO } from "../../src/components/card-back-cover-art";
import { PageErrorState } from "../../src/components/error-state";
import {
  CheckIcon,
  ClockIcon,
  CoinIcon,
  EyeIcon,
  PackIcon,
  SparklesIcon,
  ZapIcon,
} from "../../src/components/icons";
import { PageLoadingState } from "../../src/components/loading-state";
import { getPackOpeningArtSource } from "../../src/components/pack-opening-art";
import PackOpeningSequenceDom from "../../src/components/pack-opening-sequence-dom";
import { RARITY_COLORS } from "../../src/components/theme";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";
import { prefetchCatalogImages } from "../../src/lib/catalog-images";
import { prefetchCardImages } from "../../src/lib/card-images";
import { useSessionStore } from "../../src/stores/session-store";
import { useThemeStore } from "../../src/stores/theme-store";
import {
  useAppHeaderHeight,
  useBottomTabBarContentPadding,
} from "../../src/theme/layout";
import { THEME_COLORS } from "../../src/theme/themes";
import { reactEffect } from "../../src/lib/react-primitives";

import {
  BackgroundOrbs,
  CardBackStack,
  CrackedPackPreview,
  LoadingProgressFill,
  OpeningProgress,
  PackIconVisual,
  PackLoadingGlow,
  PackOpeningAura,
  PackPreviewCard,
  PackSummaryCardSheet,
  ReadyRevealGlow,
  ReadyRevealStackWrapper,
  RevealCardStage,
  SectionBadge,
} from "../../src/features/packs/opening-components";
import {
  IS_E2E_BUILD,
  PACK_CARD_RATIO,
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
  createBurstPattern,
  createLoadingSparkles,
  delay,
  formatPackAvailabilityDate,
  getHapticForCard,
  getPackArtUrl,
  getPackProgressStep,
  getRarityGlowColor,
  getThemeRarityPalette,
  isPackLimited,
  slugifyPackName,
  toCardTileEntry,
  toRarityName,
  withAlpha,
  type CardBackVisualMap,
  type LoadingSparkle,
  type OpenedCard,
  type OpeningPhase,
  type Pack,
  type PackBurstPattern,
  type RarityName,
} from "../../src/features/packs/opening-model";

export default function PacksScreen() {
  return usePacksScreenView();
}

function usePacksScreenView() {
  const navigation = useNavigation();
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
  const burstPatternRef = useRef<PackBurstPattern | null>(null);
  if (burstPatternRef.current === null) {
    burstPatternRef.current = createBurstPattern(320, 320 / PACK_CARD_RATIO);
  }
  const isCardPreviewVisible = previewedCard !== null;
  const shouldHideTabBar =
    (phase !== "selecting" && phase !== "complete") || isCardPreviewVisible;
  const openingBottomPadding = shouldHideTabBar
    ? Math.max(safeAreaBottom + 16, 24)
    : bottomTabPadding;

  const revealCardWidth = Math.min(
    width - 36,
    344,
    Math.max(236, height - openingBottomPadding - 364) * CARD_ART_RATIO,
  );
  const stageCardWidth = revealCardWidth;
  const loadingDeckWidth = revealCardWidth;

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

  reactEffect(() => {
    navigation.setOptions({
      tabBarStyle: shouldHideTabBar ? { display: "none" } : undefined,
    });

    return () => {
      navigation.setOptions({
        tabBarStyle: undefined,
      });
    };
  }, [navigation, shouldHideTabBar]);

  reactEffect(() => {
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

  reactEffect(() => {
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
    burstPatternRef.current = createBurstPattern(
      stageCardWidth,
      stageCardWidth / PACK_CARD_RATIO,
      selectedPack ?? undefined,
    );

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
          runOnJS(resolve)();
        },
      );
    });
  }

  async function openPack(pack: Pack) {
    if (isPackLimited(pack)) {
      setOpenError(
        pack.availability?.nextAvailableAt
          ? t("packs.weeklyLimitAvailable", {
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

    await delay(PACK_OPEN_SHAKE_MS);
    setPhase("bursting");
    startBurstAnimation();

    await delay(PACK_OPEN_BURST_MS);
    setPhase("loading");

    try {
      await animateLoadingProgress(12, 44, PACK_OPEN_PROGRESS_MS.first);
      const result = await apiCallPromise;

      setOpenedCards(result.cards);
      setNewBalance(result.newBalance);
      setSelectedPack(result.pack);

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

  reactEffect(() => {
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
  const openingStep = getPackProgressStep(phase);
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
    const openingAccent = selectedPack.color || "#D58524";
    const chargePreviewWidth = Math.min(stageCardWidth * 1.4, 320);
    const openingStageHeight = Math.min(Math.max(height * 0.62, 420), 620);
    const openingStageTranslateY = 10;
    const loadingFooterTranslateY = 56;
    const openingFooterReserve = Math.min(Math.max(height * 0.24, 196), 252);
    const badgeBackgroundColor = withAlpha(
      openingAccent,
      themeName === "nightosphere" ? "26" : "1F",
    );
    const titleChipBackgroundColor =
      themeName === "nightosphere"
        ? withAlpha(tc.surface, "CC")
        : withAlpha(tc.surface, "E8");
    const progressTrackColor =
      themeName === "nightosphere"
        ? withAlpha(tc.primaryBorder, "44")
        : withAlpha(tc.fgMuted, "22");

    return (
      <View
        testID={
          isLoadingPhase ? "pack-opening-loading" : "pack-opening-shaking"
        }
        className="flex-1 bg-bg"
      >
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
              <PackOpeningSequenceDom
                key={`${openingRunId}`}
                mode={
                  isLoadingPhase
                    ? "loading"
                    : phase === "bursting"
                      ? "burst"
                      : "charge"
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
            className="w-full max-w-[360px] self-center items-center gap-4 pb-2"
            style={{
              minHeight: isLoadingPhase ? openingFooterReserve : undefined,
              transform: isLoadingPhase
                ? [{ translateY: loadingFooterTranslateY }]
                : undefined,
            }}
          >
            {isLoadingPhase ? (
              <>
                <SectionBadge
                  icon={<EyeIcon size={12} color={openingAccent} />}
                  label={t("packs.opening.syncingProgress")}
                  backgroundColor={badgeBackgroundColor}
                  textColor={openingAccent}
                />
                <Text
                  className="max-w-[330px] text-center font-nunito text-sm"
                  style={{ color: tc.fgMuted }}
                >
                  {t("packs.opening.sortingBody")}
                </Text>
                <View
                  className="w-full overflow-hidden rounded-full"
                  style={{
                    backgroundColor: progressTrackColor,
                    height: 12,
                  }}
                >
                  <LoadingProgressFill
                    color={openingAccent}
                    progress={loadingProgressAnim}
                  />
                </View>
                <Text
                  className="text-center font-nunito text-sm"
                  style={{ color: tc.fgMuted }}
                >
                  {loadingProgress}%
                </Text>
              </>
            ) : (
              <Text
                className="max-w-[330px] text-center font-nunito-bold text-sm"
                style={{ color: tc.fg }}
              >
                {t("packs.opening.packOpened", { name: selectedPack.name })}
              </Text>
            )}

            <View
              className="self-center rounded-full px-4 py-1.5"
              style={{ backgroundColor: titleChipBackgroundColor }}
            >
              <Text
                className="font-nunito-bold text-[12px]"
                style={{ color: tc.fgMuted }}
              >
                {isLoadingPhase
                  ? t("packs.opening.sortingTitle")
                  : t("packs.opening.chargeTitle")}
              </Text>
            </View>
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
        <BackgroundOrbs
          primary={tc.primaryTint}
          secondary={tc.secondaryTint}
          accent={tc.accentTint}
        />
        <View
          className="flex-1 px-4"
          style={{
            paddingTop: headerHeight + 24,
            paddingBottom: openingBottomPadding,
          }}
        >
          <View className="w-full items-center gap-3">
            <Text className="text-center font-nunito-extrabold text-[28px] leading-[34px] text-fg">
              {t("packs.opening.readyTitle")}
            </Text>
            <Text className="max-w-[330px] text-center font-nunito text-sm leading-6 text-fgMuted">
              {t("packs.opening.readyBody")}
            </Text>
          </View>

          <View className="flex-1 items-center justify-center py-5">
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

          <View className="items-center gap-4 pb-2">
            <OpeningProgress tc={tc} activeStep={openingStep} />
            <SectionBadge
              icon={<PackIcon size={14} color={tc.primaryText} />}
              label={t("packs.opening.revealProgress", {
                count: openedCards.length,
              })}
              backgroundColor={tc.primaryTint}
              textColor={tc.primaryText}
            />
            <Text className="text-center font-nunito-bold text-base text-primaryStrong">
              {t("packs.opening.revealCta")}
            </Text>
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
    const isHighRarity = ["Legendary", "Epic", "Rare"].includes(rarityName);
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
        <BackgroundOrbs
          primary={tc.surfaceMuted}
          secondary={tc.primaryTint}
          accent={glowColor}
        />

        <View
          className="flex-1 px-4"
          style={{
            paddingTop: headerHeight + 20,
            paddingBottom: openingBottomPadding,
          }}
        >
          <View className="w-full max-w-[360px] self-center gap-3">
            <View className="flex-row items-center justify-between">
              <Text
                className="font-nunito-bold text-base"
                style={{ color: rarityRing }}
              >
                {rarityName}
              </Text>
              <Text className="font-nunito-bold text-sm text-fgMuted">
                {t("packs.reveal.cardProgress", {
                  current: revealedIndex + 1,
                  total: openedCards.length,
                })}
              </Text>
            </View>
            <OpeningProgress tc={tc} activeStep={openingStep} />
          </View>

          <View className="flex-1 items-center justify-center py-3">
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

          <View className="items-center gap-3 pb-2">
            <View className="flex-row flex-wrap items-center justify-center gap-2">
              <SectionBadge
                icon={
                  card.isNewForUser ? (
                    <CheckIcon size={12} color={tc.successText} />
                  ) : (
                    <ClockIcon size={12} color={tc.fgMuted} />
                  )
                }
                label={
                  card.isNewForUser
                    ? t("packs.reveal.newCard")
                    : t("packs.reveal.duplicate")
                }
                backgroundColor={
                  card.isNewForUser ? tc.successTint : tc.surfaceMuted
                }
                textColor={card.isNewForUser ? tc.successText : tc.fgMuted}
              />
              {isLastCard ? (
                <SectionBadge
                  icon={<SparklesIcon size={12} color={tc.accentText} />}
                  label={t("packs.reveal.finalCard")}
                  backgroundColor={tc.accentTint}
                  textColor={tc.accentText}
                />
              ) : null}
            </View>
            <Text className="text-center font-nunito-bold text-base text-primaryStrong">
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
    const rarityBreakdown = openedCards.reduce<
      Record<string, { total: number; newCount: number }>
    >((accumulator, card) => {
      const rarityName = card.rarity?.name ?? "Common";
      if (!accumulator[rarityName]) {
        accumulator[rarityName] = { total: 0, newCount: 0 };
      }
      accumulator[rarityName].total += 1;
      if (card.isNewForUser) {
        accumulator[rarityName].newCount += 1;
      }
      return accumulator;
    }, {});

    return (
      <>
        <ScrollView
          testID="pack-opening-summary"
          className="flex-1 bg-bg"
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 24,
            gap: 18,
          }}
          contentInset={{ bottom: bottomTabPadding }}
          scrollIndicatorInsets={{ bottom: bottomTabPadding }}
        >
          <View style={{ height: headerHeight }} />
          <BackgroundOrbs
            primary={tc.primaryTint}
            secondary={tc.secondaryTint}
            accent={tc.accentTint}
          />

          <View
            className="gap-5"
            style={{
              borderRadius: 30,
              padding: 22,
              borderWidth: 1,
              borderColor: tc.primaryBorder,
              backgroundColor: tc.surface,
            }}
          >
            <View className="gap-3">
              <SectionBadge
                icon={<SparklesIcon size={14} color={tc.primaryText} />}
                label={t("packs.summary.title")}
                backgroundColor={tc.primaryTint}
                textColor={tc.primaryText}
              />
              <View className="gap-2">
                <Text className="font-nunito-extrabold text-[28px] leading-[34px] text-fg">
                  {selectedPack.name}
                </Text>
                <Text className="font-nunito text-sm leading-6 text-fgMuted">
                  {t("packs.summary.subtitle")}
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View
                className="flex-1 rounded-[22px] p-4"
                style={{ backgroundColor: tc.surfaceMuted }}
              >
                <Text className="font-nunito text-[11px] uppercase tracking-[0.7px] text-fgMuted">
                  {t("packs.summary.totalCards")}
                </Text>
                <Text className="mt-2 font-nunito-extrabold text-[26px] text-fg">
                  {openedCards.length}
                </Text>
              </View>
              <View
                className="flex-1 rounded-[22px] p-4"
                style={{ backgroundColor: tc.surfaceMuted }}
              >
                <Text className="font-nunito text-[11px] uppercase tracking-[0.7px] text-fgMuted">
                  {t("packs.summary.newCards")}
                </Text>
                <Text className="mt-2 font-nunito-extrabold text-[26px] text-fg">
                  {newCards.length}
                </Text>
              </View>
            </View>
          </View>

          <View
            className="gap-4 rounded-[28px] border p-5"
            style={{
              backgroundColor: tc.surface,
              borderColor: tc.primaryBorder,
            }}
          >
            <View className="flex-row items-center gap-3">
              <View
                className="items-center justify-center rounded-[18px] p-3"
                style={{ backgroundColor: tc.primaryTint }}
              >
                <PackIcon size={20} color={tc.primaryText} />
              </View>
              <View className="flex-1">
                <Text className="font-nunito-bold text-base text-fg">
                  {t("packs.summary.rarityBreakdown")}
                </Text>
                <Text className="mt-1 font-nunito text-xs text-fgMuted">
                  {selectedPack.guaranteedRarity
                    ? t("packs.guaranteed", {
                        rarity: selectedPack.guaranteedRarity,
                      })
                    : t("packs.standardOdds")}
                </Text>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-2">
              {(
                ["Legendary", "Epic", "Rare", "Uncommon", "Common"] as const
              ).map((rarityName) => {
                const info = rarityBreakdown[rarityName];
                if (!info) {
                  return null;
                }

                const rarityColors =
                  RARITY_COLORS[rarityName] ?? RARITY_COLORS.Common;

                return (
                  <View
                    key={rarityName}
                    className="rounded-full px-3 py-2"
                    style={{ backgroundColor: rarityColors.ring + "22" }}
                  >
                    <Text
                      className="font-nunito-bold text-[12px]"
                      style={{ color: rarityColors.to }}
                    >
                      {rarityName} x{info.total}
                      {info.newCount > 0
                        ? ` ${t("packs.openResult.newCount", {
                            count: info.newCount,
                          })}`
                        : ""}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {newCards.length > 0 ? (
            <View className="gap-3">
              <Text className="font-nunito-bold text-lg text-fg">
                {t("packs.summary.newCards")}
              </Text>
              <View className="flex-row flex-wrap">
                {newCards.map((card, index) => (
                  <View
                    key={`${card.id}-${index}`}
                    className="w-1/2 px-1.5 pb-3"
                  >
                    <CardTile
                      testID={`pack-summary-card-new-${index}`}
                      onPress={() => setPreviewedCard(card)}
                      entry={toCardTileEntry(card)}
                      accessToken={accessToken}
                      fitContainer
                    />
                    <View className="mt-2 items-center">
                      <LinearGradient
                        colors={[tc.success, tc.successDark]}
                        style={{
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                        }}
                      >
                        <Text className="font-nunito-extrabold text-[10px] text-white">
                          {t("packs.openResult.newBadge")}
                        </Text>
                      </LinearGradient>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View className="gap-3">
            <Text className="font-nunito-bold text-lg text-fg">
              {t("packs.summary.allCards")}
            </Text>
            <View className="flex-row flex-wrap">
              {summaryCards.map((card, index) => (
                <View key={`${card.id}-${index}`} className="w-1/2 px-1.5 pb-3">
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
          </View>

          <View className="gap-3 pb-4">
            {canReopenSelected ? (
              <PrimaryButton
                testID={`pack-summary-open-again-${slugifyPackName(selectedPack.name)}`}
                onPress={() => void openPack(selectedPack)}
                disabled={isOpening}
                style={{ width: "100%" }}
              >
                {t("packs.summary.openSamePack")}
              </PrimaryButton>
            ) : null}

            <SecondaryButton
              testID="pack-summary-browse"
              onPress={reset}
              style={{ width: "100%" }}
            >
              {t("packs.summary.browsePacks")}
            </SecondaryButton>
          </View>
        </ScrollView>

        {previewedCard ? (
          <PackSummaryCardSheet
            key={previewedCard.id}
            card={previewedCard}
            accessToken={accessToken}
            onClose={() => setPreviewedCard(null)}
          />
        ) : null}
      </>
    );
  }

  return (
    <View testID="pack-storefront" className="flex-1 bg-bg">
      <BackgroundOrbs
        primary={tc.primaryTint}
        secondary={tc.secondaryTint}
        accent={tc.accentTint}
      />
      {heroPack ? (
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
          paddingHorizontal: 20,
          paddingBottom: 24,
          gap: 18,
        }}
        contentInset={{ bottom: bottomTabPadding }}
        scrollIndicatorInsets={{ bottom: bottomTabPadding }}
      >
        <View style={{ height: headerHeight }} />
        <View
          style={{
            borderRadius: 30,
            padding: 22,
            borderWidth: 1,
            borderColor: tc.primaryBorder,
            backgroundColor: tc.surface,
          }}
        >
          <View className="gap-3">
            <View className="gap-3">
              <SectionBadge
                icon={<PackIcon size={14} color={tc.primaryText} />}
                label={t("packs.title")}
                backgroundColor={tc.surfaceMuted}
                textColor={tc.primaryText}
              />
              <Text className="font-nunito-extrabold text-[28px] leading-[34px] text-fg">
                {t("packs.subtitle")}
              </Text>
              <Text className="font-nunito text-sm leading-6 text-fgMuted">
                {featuredPack
                  ? t("packs.nextGoalValue", {
                      name: featuredPack.name,
                      count: featuredPack.cardCount,
                    })
                  : t("packs.noAffordable")}
              </Text>
            </View>
          </View>

          <View className="mt-5 gap-3">
            <SectionBadge
              icon={<CheckIcon size={12} color={tc.successText} />}
              label={t("packs.affordableCount", {
                count: affordablePacks.length,
              })}
              backgroundColor={tc.successTint}
              textColor={tc.successText}
            />

            {heroPack ? (
              <Pressable
                onPress={() =>
                  !isOpening && heroCanOpen && void openPack(heroPack)
                }
                disabled={isOpening || !heroCanOpen}
                style={{ opacity: heroCanOpen ? 1 : 0.62 }}
              >
                <View
                  className="flex-row items-center justify-between rounded-[24px] px-5 py-4"
                  style={{
                    backgroundColor: heroCanOpen
                      ? tc.primaryStrong
                      : tc.surfaceMuted,
                  }}
                >
                  <View className="flex-1 gap-1 pr-3">
                    <Text
                      className="font-nunito-extrabold text-lg"
                      style={{ color: heroCanOpen ? "#FFFFFF" : tc.fg }}
                    >
                      {heroPack.name}
                    </Text>
                    <Text
                      className="font-nunito text-sm"
                      style={{
                        color: heroCanOpen
                          ? "rgba(255,255,255,0.82)"
                          : tc.fgMuted,
                      }}
                    >
                      {isPackLimited(heroPack)
                        ? heroPack.availability?.nextAvailableAt
                          ? t("packs.weeklyLimitAvailable", {
                              date: formatPackAvailabilityDate(
                                heroPack.availability.nextAvailableAt,
                              ),
                            })
                          : t("packs.weeklyLimitReached")
                        : heroCanOpen
                          ? t("packs.tapToOpen")
                          : cheapestLockedPack
                            ? t("packs.nextGoal", {
                                name: heroPack.name,
                                count: heroPack.cost - coins,
                              })
                            : t("packs.allAffordable")}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <CoinIcon size={16} />
                    <Text
                      className="font-nunito-extrabold text-lg"
                      style={{
                        color: heroCanOpen ? "#FFFFFF" : tc.primaryStrong,
                      }}
                    >
                      {heroPack.cost}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ) : null}
          </View>
        </View>

        {openError ? (
          <View
            className="rounded-[24px] border p-4"
            style={{
              backgroundColor: tc.dangerTint,
              borderColor: tc.dangerBorder,
            }}
          >
            <Text className="font-nunito-semibold text-sm leading-6 text-dangerText">
              {openError}
            </Text>
          </View>
        ) : null}

        <View className="gap-4">
          {packs.map((pack) => {
            const canAfford = coins >= pack.cost;
            const limitReached = isPackLimited(pack);
            const canOpen = canOpenPackWithBalance(pack, coins);
            const slug = slugifyPackName(pack.name);
            const coinsNeeded = Math.max(0, pack.cost - coins);
            const isFeatured = featuredPack?.id === pack.id;
            const packSurfaceColor = pack.color
              ? withAlpha(pack.color, "33")
              : tc.surfaceMuted;
            const statusLabel = canAfford
              ? t("packs.readyNow")
              : t("packs.needMoreCoinsShort", {
                  count: coinsNeeded,
                });
            const limitAvailableLabel =
              limitReached && pack.availability?.nextAvailableAt
                ? t("packs.weeklyLimitAvailable", {
                    date: formatPackAvailabilityDate(
                      pack.availability.nextAvailableAt,
                    ),
                  })
                : null;

            return (
              <Pressable
                key={pack.id}
                testID={`pack-card-${slug}`}
                onPress={() => !isOpening && canOpen && void openPack(pack)}
                disabled={isOpening || !canOpen}
                style={{ opacity: canOpen ? 1 : 0.54 }}
              >
                <View
                  className="rounded-[30px] border p-4"
                  style={{
                    backgroundColor: limitReached
                      ? tc.surfaceMuted
                      : packSurfaceColor,
                    borderColor: limitReached
                      ? tc.primaryBorder
                      : isFeatured
                        ? withAlpha(pack.color || tc.primary, "66")
                        : withAlpha(pack.color || tc.primaryBorder, "2E"),
                  }}
                >
                  <View className="flex-row items-start gap-4">
                    <View className="items-center justify-center p-4">
                      <PackIconVisual pack={pack} size={34} />
                    </View>

                    <View className="flex-1 gap-4">
                      <View className="gap-2">
                        <View className="flex-row items-center justify-between gap-3">
                          <Text className="flex-1 font-nunito-extrabold text-[22px] leading-[26px] text-fg">
                            {pack.name}
                          </Text>
                          <View className="shrink-0 flex-row items-center gap-2">
                            <CoinIcon size={18} />
                            <Text className="font-nunito-extrabold text-lg leading-[26px] text-fg">
                              {pack.cost}
                            </Text>
                          </View>
                        </View>
                        {isFeatured ? (
                          <SectionBadge
                            icon={
                              <SparklesIcon size={11} color={tc.accentText} />
                            }
                            label={t("packs.recommended")}
                            backgroundColor={tc.accentTint}
                            textColor={tc.accentText}
                          />
                        ) : null}
                        <Text className="font-nunito text-sm leading-6 text-fgMuted">
                          {t("packs.cardsCount", { count: pack.cardCount })}
                          {" · "}
                          {pack.guaranteedRarity
                            ? t("packs.guaranteed", {
                                rarity: pack.guaranteedRarity,
                              })
                            : t("packs.standardOdds")}
                        </Text>
                      </View>

                      {limitReached ? (
                        <View
                          className="flex-row items-center gap-3 rounded-2xl border px-3 py-2"
                          style={{
                            backgroundColor: tc.bg,
                            borderColor: tc.primaryBorder,
                          }}
                        >
                          <View
                            className="h-8 w-8 items-center justify-center rounded-full"
                            style={{ backgroundColor: tc.primaryTint }}
                          >
                            <ClockIcon size={15} color={tc.primaryText} />
                          </View>
                          <View className="min-w-0 flex-1 gap-0.5">
                            <Text className="font-nunito-bold text-sm leading-5 text-fg">
                              {t("packs.weeklyLimitReached")}
                            </Text>
                            {limitAvailableLabel ? (
                              <Text className="font-nunito text-xs leading-4 text-fgMuted">
                                {limitAvailableLabel}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ) : (
                        <View className="flex-row items-center justify-between gap-3">
                          <Text
                            className="font-nunito text-xs"
                            style={{
                              color: canAfford ? tc.successText : tc.dangerText,
                            }}
                          >
                            {statusLabel}
                          </Text>

                          <Text
                            testID={`pack-open-cta-${slug}`}
                            className="font-nunito-bold text-sm"
                            style={{
                              color: canOpen ? tc.primaryText : tc.fgMuted,
                            }}
                          >
                            {t("packs.tapToOpen")}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
