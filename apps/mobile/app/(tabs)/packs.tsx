import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState, useEffect } from "react";

import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { CardTile } from "../../src/components/card-tile";
import {
  CoinIcon,
  CrownIcon,
  DiamondIcon,
  GiftBoxIcon,
  BoxIcon,
  SparkleIcon,
  SparklesIcon,
} from "../../src/components/icons";
import { RARITY_COLORS } from "../../src/components/theme";
import { useTranslation } from "../../src/i18n";
import { useThemeStore } from "../../src/stores/theme-store";
import { useBottomTabBarContentPadding } from "../../src/theme/layout";
import { THEME_COLORS } from "../../src/theme/themes";

import type { PacksResponse, OpenPackResponse } from "@adventure-time/api-client";
import type { ViewStyle } from "react-native";

type Pack = PacksResponse["packs"][number];
type OpenedCard = OpenPackResponse["cards"][number];
type AbsolutePosition = Pick<ViewStyle, "top" | "right" | "bottom" | "left">;
type OpeningPhase =
  | "selecting"
  | "shaking"
  | "bursting"
  | "loading"
  | "readyToReveal"
  | "revealing"
  | "complete";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PARTICLE_CONFIGS = [
  { angle: 0, dist: 140, isSparkle: false },
  { angle: 45, dist: 160, isSparkle: false },
  { angle: 90, dist: 130, isSparkle: false },
  { angle: 135, dist: 155, isSparkle: false },
  { angle: 180, dist: 140, isSparkle: false },
  { angle: 225, dist: 150, isSparkle: false },
  { angle: 270, dist: 135, isSparkle: false },
  { angle: 315, dist: 160, isSparkle: false },
  { angle: 22, dist: 180, isSparkle: true },
  { angle: 112, dist: 175, isSparkle: true },
  { angle: 202, dist: 185, isSparkle: true },
  { angle: 292, dist: 170, isSparkle: true },
];

const READY_REVEAL_SPARKLE_POSITIONS: AbsolutePosition[] = [
  { top: 40, left: 40 },
  { top: 40, right: 40 },
  { bottom: 40, left: 40 },
  { bottom: 40, right: 40 },
  { top: "40%", left: 10 },
  { top: "40%", right: 10 },
];

const HIGH_RARITY_SPARKLE_POSITIONS: AbsolutePosition[] = [
  { top: 80, left: 40 },
  { top: 80, right: 40 },
  { top: "35%", left: 20 },
  { top: "35%", right: 20 },
  { top: "65%", left: 30 },
  { top: "65%", right: 30 },
  { bottom: 120, left: 50 },
  { bottom: 120, right: 50 },
];

const HEART_POSITIONS: AbsolutePosition[] = [
  { left: "10%", top: "15%" },
  { left: "25%", top: "5%" },
  { left: "45%", top: "20%" },
  { left: "65%", top: "8%" },
  { left: "80%", top: "18%" },
  { left: "15%", top: "70%" },
  { left: "60%", top: "75%" },
  { left: "85%", top: "65%" },
];

function getRarityGlowColor(rarityName: string): string {
  switch (rarityName) {
    case "Legendary":
      return "#FFD700";
    case "Epic":
      return "#A855F7";
    case "Rare":
      return "#3B82F6";
    default:
      return "#EC4899";
  }
}

function getPackIcon(packName: string, size = 36) {
  if (packName.includes("Legendary"))
    return <CrownIcon size={size} color="#D97706" />;
  if (packName.includes("Epic"))
    return <DiamondIcon size={size} color="#7C3AED" />;
  if (packName.includes("Premium"))
    return <SparkleIcon size={size} color="#DB2777" />;
  if (packName.includes("Standard"))
    return <GiftBoxIcon size={size} color="#DC2626" />;
  return <BoxIcon size={size} color="#6B7280" />;
}

export default function PacksScreen() {
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((state) => state.accessToken);
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  const patchUser = useSessionStore((state) => state.patchUser);
  const coins = useSessionStore((state) => state.user?.coins ?? 0);
  const { t } = useTranslation();
  const bottomTabPadding = useBottomTabBarContentPadding();

  const [phase, setPhase] = useState<OpeningPhase>("selecting");
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [openedCards, setOpenedCards] = useState<OpenedCard[]>([]);
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Animated values
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const burstScaleAnim = useRef(new Animated.Value(1)).current;
  const burstParticleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 2)).current;
  const floatAnims = useRef(
    [...Array(8)].map(() => new Animated.Value(0)),
  ).current;

  // Floating hearts background animation
  useEffect(() => {
    if (phase !== "selecting") return;
    const animations = floatAnims.map((anim, i) => {
      anim.setValue(0);
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000 + i * 300,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 2000 + i * 300,
            useNativeDriver: true,
          }),
        ]),
        { iterations: -1 },
      );
    });
    const stagger = Animated.stagger(200, animations);
    stagger.start();
    return () => stagger.stop();
  }, [phase]);

  // Pulse animation for readyToReveal
  useEffect(() => {
    if (phase !== "readyToReveal") return;
    pulseAnim.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.97,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);

  // Loading spinner
  useEffect(() => {
    if (phase !== "loading") return;
    spinAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);

  function startShakeAnimation() {
    shakeAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 12,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -12,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 8,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -8,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 4,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }),
      ]),
      { iterations: 8 },
    ).start();

    // Shimmer sweep
    shimmerAnim.setValue(-SCREEN_WIDTH * 2);
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: SCREEN_WIDTH * 2,
        duration: 1000,
        useNativeDriver: true,
      }),
    ).start();
  }

  function startBurstAnimation() {
    burstScaleAnim.setValue(1);
    Animated.timing(burstScaleAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();

    burstParticleAnim.setValue(0);
    Animated.timing(burstParticleAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }

  async function openPack(pack: Pack) {
    if (coins < pack.cost) {
      setOpenError(
        t("packs.needCoins", { required: pack.cost, current: coins }),
      );
      return;
    }
    setOpenError(null);
    setSelectedPack(pack);
    setIsOpening(true);

    // 1. Start shake animation
    setPhase("shaking");
    startShakeAnimation();

    // 2. Make API call IN PARALLEL during shake
    const apiCallPromise = apiClient.openPack({ packId: pack.id });

    await new Promise((r) => setTimeout(r, 3000));
    setPhase("bursting");
    startBurstAnimation();

    await new Promise((r) => setTimeout(r, 600));

    try {
      const result = await apiCallPromise;
      setOpenedCards(result.cards);
      setNewBalance(result.newBalance);
      setPhase("loading");
      setLoadingProgress(0);

      // Animate progress 0→100 over 1.5s
      const start = Date.now();
      const progressTimer = setInterval(() => {
        const pct = Math.min(100, ((Date.now() - start) / 1500) * 100);
        setLoadingProgress(Math.round(pct));
        if (pct >= 100) clearInterval(progressTimer);
      }, 40);
      await new Promise((r) => setTimeout(r, 1500));
      clearInterval(progressTimer);
      setLoadingProgress(100);

      // Invalidate queries + refresh user
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
        queryClient.invalidateQueries({ queryKey: ["daily-claim"] }),
      ]);
      await patchUser({ coins: result.newBalance });

      setPhase("readyToReveal");
      setRevealedIndex(-1);
    } catch (err) {
      setOpenError(
        err instanceof Error ? err.message : t("packs.openFailed"),
      );
      setPhase("selecting");
    } finally {
      setIsOpening(false);
    }
  }

  function revealNext() {
    const next = revealedIndex + 1;
    flipAnim.setValue(0);
    Animated.spring(flipAnim, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
    if (next < openedCards.length) {
      setRevealedIndex(next);
      setPhase("revealing");
    } else {
      setPhase("complete");
    }
  }

  function reset() {
    setPhase("selecting");
    setSelectedPack(null);
    setOpenedCards([]);
    setRevealedIndex(-1);
    setNewBalance(null);
    shakeAnim.setValue(0);
    burstScaleAnim.setValue(1);
    burstParticleAnim.setValue(0);
    pulseAnim.setValue(1);
    flipAnim.setValue(0);
    shimmerAnim.setValue(-SCREEN_WIDTH * 2);
  }

  const packsQuery = useQuery({
    queryKey: ["packs"],
    queryFn: () => apiClient.packs(),
  });

  if (packsQuery.isLoading) {
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-fgMuted">
          {t("packs.loading")}
        </Text>
      </View>
    );
  }

  if (packsQuery.isError || !packsQuery.data) {
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-danger">
          {packsQuery.error?.message ?? t("packs.unavailable")}
        </Text>
      </View>
    );
  }

  const packs = packsQuery.data.packs;

  // ── SHAKING / BURSTING phase ──────────────────────────────────────────────
  if ((phase === "shaking" || phase === "bursting") && selectedPack) {
    const spin = spinAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <Text className="font-nunito-extrabold text-2xl text-fg mb-8">
          {t("packs.title")}
        </Text>
        {phase === "bursting" && selectedPack ? (
          <View
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              overflow: "hidden",
            }}
          >
            {PARTICLE_CONFIGS.map(({ angle, dist, isSparkle }, i) => {
              const rad = (angle * Math.PI) / 180;
              const tx = burstParticleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, Math.cos(rad) * dist],
              });
              const ty = burstParticleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, Math.sin(rad) * dist],
              });
              const opacity = burstParticleAnim.interpolate({
                inputRange: [0, 0.4, 1],
                outputRange: [1, 0.8, 0],
              });
              return (
                <Animated.View
                  key={i}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: [{ translateX: tx }, { translateY: ty }],
                    opacity,
                  }}
                >
                  {isSparkle ? (
                    <SparkleIcon
                      size={20}
                      color={selectedPack.color || "#EC4899"}
                    />
                  ) : (
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: selectedPack.color || "#EC4899",
                      }}
                    />
                  )}
                </Animated.View>
              );
            })}
          </View>
        ) : null}
        <Animated.View
          style={{
            transform: [
              {
                translateX:
                  phase === "shaking" ? shakeAnim : new Animated.Value(0),
              },
              { scale: burstScaleAnim },
            ],
            width: 320,
            height: 480,
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: selectedPack.color || "#EC4899",
          }}
        >
          <LinearGradient
            colors={[
              "rgba(255,255,255,0.2)",
              "transparent",
              "rgba(0,0,0,0.15)",
            ]}
            style={{ position: "absolute", inset: 0 }}
          />
          {/* Shimmer overlay — shaking phase only */}
          {phase === "shaking" ? (
            <Animated.View
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: 80,
                transform: [{ translateX: shimmerAnim }],
              }}
            >
              <LinearGradient
                colors={["transparent", "rgba(255,255,255,0.6)", "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
          ) : null}
          <View className="flex-1 items-center justify-center gap-2">
            {getPackIcon(selectedPack.name, 80)}
            <Text className="font-nunito-bold text-white text-lg">
              {selectedPack.name}
            </Text>
            <Text className="font-nunito text-white/80 text-sm">
              {selectedPack.cardCount} cards
            </Text>
          </View>
        </Animated.View>
        <Text className="font-nunito text-fgMuted mt-6 text-base">
          Opening...
        </Text>
      </View>
    );
  }

  // ── LOADING phase ─────────────────────────────────────────────────────────
  if (phase === "loading" && selectedPack) {
    const spin = spinAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });
    return (
      <View className="flex-1 bg-bg items-center justify-center gap-6">
        {/* Stacked card backs */}
        <View style={{ width: 320, height: 480, position: "relative" }}>
          {[
            { rotate: "-8deg", tx: -12, ty: 8 },
            { rotate: "-4deg", tx: -6, ty: 4 },
            { rotate: "2deg", tx: 4, ty: 2 },
            { rotate: "0deg", tx: 0, ty: 0 },
          ].map((s, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 16,
                overflow: "hidden",
                transform: [
                  { rotate: s.rotate },
                  { translateX: s.tx },
                  { translateY: s.ty },
                ],
                borderWidth: 2,
                borderColor: tc.primaryBorder,
              }}
            >
              <LinearGradient
                colors={[tc.primaryTint, tc.primaryBorder]}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SparklesIcon size={32} color={tc.primaryText} />
              </LinearGradient>
            </View>
          ))}

          {/* Spinning overlay */}
          <Animated.View
            style={{
              position: "absolute",
              inset: -24,
              borderRadius: 9999,
              borderWidth: 4,
              borderColor: tc.primaryBorder,
              borderTopColor: tc.primaryDark,
              transform: [{ rotate: spin }],
            }}
          />
        </View>

        {/* Progress bar */}
        <View
          style={{
            width: 256,
            height: 12,
            backgroundColor: tc.surfaceMuted,
            borderRadius: 9999,
            overflow: "hidden",
          }}
        >
          <LinearGradient
            colors={[tc.primary, tc.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: "100%",
              width: `${loadingProgress}%`,
              borderRadius: 9999,
            }}
          />
        </View>
        <Text className="font-nunito text-fgMuted">
          Preparing cards... {loadingProgress}%
        </Text>
      </View>
    );
  }

  // ── READY TO REVEAL phase ─────────────────────────────────────────────────
  if (phase === "readyToReveal") {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={revealNext}
        className="flex-1 bg-bg items-center justify-center gap-6"
      >
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <LinearGradient
            colors={[tc.primaryTint, tc.primaryBorder, tc.primaryDark]}
            style={{
              width: 320,
              height: 480,
              borderRadius: 20,
              borderWidth: 4,
              borderColor: tc.primaryBorder,
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Scattered sparkles */}
            {READY_REVEAL_SPARKLE_POSITIONS.map((pos, i) => (
              <View key={i} style={{ position: "absolute", ...pos }}>
                <SparkleIcon size={16} color="rgba(255,255,255,0.6)" />
              </View>
            ))}
            <Text
              style={{
                color: "#fff",
                fontSize: 64,
                fontFamily: "Nunito_800ExtraBold",
              }}
            >
              ?
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* Dot indicators */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {openedCards.map((_, i) => (
            <View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: tc.primaryBorder,
                opacity: 0.5,
              }}
            />
          ))}
        </View>

        <Text
          style={{
            fontFamily: "Nunito_700Bold",
            fontSize: 18,
            color: tc.primaryText,
          }}
        >
          {t("packs.tapToReveal")}
        </Text>
      </TouchableOpacity>
    );
  }

  // ── REVEALING phase ───────────────────────────────────────────────────────
  if (
    phase === "revealing" &&
    revealedIndex >= 0 &&
    revealedIndex < openedCards.length
  ) {
    const card = openedCards[revealedIndex];
    const rarityName = card.rarity?.name ?? "Common";
    const glowColor = getRarityGlowColor(rarityName);
    const rarityRing = RARITY_COLORS[rarityName]?.ring ?? "#9CA3AF";
    const isHighRarity = ["Legendary", "Epic", "Rare"].includes(rarityName);
    const cardScale = flipAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.6, 1],
    });
    const isLast = revealedIndex === openedCards.length - 1;
    const entry = { card: card as any, quantity: 1 };

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={revealNext}
        className="flex-1 bg-bg"
      >
        {/* Rarity glow background */}
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: glowColor,
            opacity: 0.08,
          }}
        />

        <View className="flex-1 items-center justify-center gap-4">
          {/* Sparkles for high rarity */}
          {isHighRarity
            ? HIGH_RARITY_SPARKLE_POSITIONS.map((pos, i) => (
                <View key={i} style={{ position: "absolute", ...pos }}>
                  <SparkleIcon size={14} color={glowColor} />
                </View>
              ))
            : null}

          {/* Card */}
          <Animated.View
            style={{
              transform: [{ scale: cardScale }],
              shadowColor: glowColor,
              shadowRadius: 24,
              shadowOpacity: 0.6,
              shadowOffset: { width: 0, height: 0 },
              elevation: 12,
            }}
          >
            {/* Rarity glow ring */}
            <View
              style={{
                position: "absolute",
                inset: -4,
                borderRadius: 20,
                borderWidth: 3,
                borderColor: rarityRing,
                zIndex: 10,
              }}
            />
            <CardTile
              entry={entry as any}
              size="large"
              accessToken={accessToken}
            />

            {/* NEW! badge */}
            {card.isNewForUser ? (
              <View
                style={{
                  position: "absolute",
                  top: -10,
                  right: -10,
                  zIndex: 20,
                }}
              >
                <LinearGradient
                  colors={["#34D399", "#059669"]}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 9999,
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 10,
                      fontFamily: "Nunito_800ExtraBold",
                    }}
                  >
                    {t("packs.openResult.newBadge")}
                  </Text>
                </LinearGradient>
              </View>
            ) : null}
          </Animated.View>

          {/* Dot indicators */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {openedCards.map((c, i) => {
              const rName = c.rarity?.name ?? "Common";
              const dotColor =
                i === revealedIndex
                  ? (RARITY_COLORS[rName]?.ring ?? tc.primaryDark)
                  : i < revealedIndex
                    ? tc.primaryDark
                    : tc.primaryBorder;
              return (
                <View
                  key={i}
                  style={{
                    width: i === revealedIndex ? 12 : 8,
                    height: i === revealedIndex ? 12 : 8,
                    borderRadius: 6,
                    backgroundColor: dotColor,
                    opacity: i > revealedIndex ? 0.4 : 1,
                  }}
                />
              );
            })}
          </View>

          <Text
            style={{
              fontFamily: "Nunito_700Bold",
              fontSize: 18,
              color: tc.primaryText,
            }}
          >
            {isLast
              ? t("packs.tapToSeeSummary")
              : `${revealedIndex + 1} / ${openedCards.length}`}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── COMPLETE phase ────────────────────────────────────────────────────────
  if (phase === "complete") {
    const newCount = openedCards.filter((c) => c.isNewForUser).length;
    const rarityBreakdown = openedCards.reduce<
      Record<string, { total: number; newCount: number }>
    >((acc, c) => {
      const rName = c.rarity?.name ?? "Common";
      if (!acc[rName]) acc[rName] = { total: 0, newCount: 0 };
      acc[rName].total++;
      if (c.isNewForUser) acc[rName].newCount++;
      return acc;
    }, {});

    return (
      <ScrollView
        className="flex-1 bg-bg"
        contentContainerStyle={{ padding: 16, paddingBottom: bottomTabPadding }}
      >
        <Text className="font-nunito-extrabold text-2xl text-fg mb-4">
          {t("packs.yourCards")}
        </Text>

        {/* 2-column card grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {openedCards.map((card, i) => {
            const entry = { card: card as any, quantity: 1 };
            return (
              <View
                key={`${card.id}-${i}`}
                style={{ width: "50%", padding: 4, alignItems: "center" }}
              >
                <CardTile entry={entry as any} accessToken={accessToken} />
                {card.isNewForUser ? (
                  <View style={{ alignItems: "center", marginTop: 4 }}>
                    <LinearGradient
                      colors={["#34D399", "#059669"]}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 9999,
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 10,
                          fontFamily: "Nunito_800ExtraBold",
                        }}
                      >
                        {t("packs.openResult.newBadge")}
                      </Text>
                    </LinearGradient>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Summary panel */}
        <View
          style={{
            backgroundColor: tc.surfaceMuted,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: tc.primaryBorder,
            padding: 16,
            marginTop: 12,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <SparkleIcon size={20} color={tc.primaryText} />
            <Text className="font-nunito-bold text-lg text-fg">{t("packs.openResult.summary")}</Text>
          </View>

          {newCount > 0 ? (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: 10,
                marginBottom: 8,
                borderBottomWidth: 1,
                borderBottomColor: tc.primaryBorder,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <SparkleIcon size={16} color={tc.successDark} />
                <Text
                  style={{
                    fontFamily: "Nunito_600SemiBold",
                    color: tc.successDark,
                  }}
                >
                  {t("packs.openResult.newCardsDiscovered")}
                </Text>
              </View>
              <Text
                style={{ fontFamily: "Nunito_700Bold", color: tc.successDark }}
              >
                {newCount} / {openedCards.length}
              </Text>
            </View>
          ) : null}

          {(["Legendary", "Epic", "Rare", "Uncommon", "Common"] as const).map(
            (rName) => {
              const info = rarityBreakdown[rName];
              if (!info) return null;
              const rc = RARITY_COLORS[rName] ?? RARITY_COLORS.Common;
              return (
                <View
                  key={rName}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{ fontFamily: "Nunito_600SemiBold", color: rc.from }}
                  >
                    {rName}
                  </Text>
                  <Text style={{ fontFamily: "Nunito_700Bold", color: rc.to }}>
                    x{info.total}
                    {info.newCount > 0 ? (
                      <Text style={{ fontSize: 11, color: tc.successDark }}>
                        {" "}
                        {t("packs.openResult.newCount", { count: info.newCount })}
                      </Text>
                    ) : null}
                  </Text>
                </View>
              );
            },
          )}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: tc.primaryBorder,
            }}
          >
            <CoinIcon size={18} />
            <Text
              style={{ fontFamily: "Nunito_400Regular", color: tc.fgMuted }}
            >
              {t("packs.openResult.remainingCoins", { count: newBalance ?? coins })}
            </Text>
          </View>
        </View>

        {/* Open Another Pack button */}
        <Pressable onPress={reset} style={{ marginTop: 16 }}>
          <LinearGradient
            colors={[tc.primary, tc.primaryDark]}
            style={{
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: tc.surface,
                fontFamily: "Nunito_800ExtraBold",
                fontSize: 16,
              }}
            >
              {t("packs.openAnother")}
            </Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    );
  }

  // ── SELECTING phase (default) ─────────────────────────────────────────────
  return (
    <View className="flex-1 bg-bg">
      {/* Floating hearts background */}
      {floatAnims.map((anim, i) => {
        const pos = HEART_POSITIONS[i];
        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -80],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              ...pos,
              opacity: anim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.3, 0.6, 0.3],
              }),
              transform: [{ translateY }],
              zIndex: 0,
            }}
          >
            <Text style={{ fontSize: 20 }}>💕</Text>
          </Animated.View>
        );
      })}

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          gap: 16,
          zIndex: 1,
          paddingBottom: bottomTabPadding,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text className="font-nunito-extrabold text-2xl text-fg">
               {t("packs.title")}
             </Text>
             <Text className="font-nunito text-fgMuted text-sm">
               {t("packs.subtitle")}
             </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <CoinIcon size={20} />
            <Text className="font-nunito-bold text-fg">{coins}</Text>
          </View>
        </View>

        {openError ? (
          <View className="rounded-2xl bg-dangerTint border border-dangerBorder p-3">
            <Text className="font-nunito text-danger text-sm">{openError}</Text>
          </View>
        ) : null}

        {/* Pack list */}
        {packs.map((pack) => {
          const canAfford = coins >= pack.cost;
          return (
            <Pressable
              key={pack.id}
              onPress={() => !isOpening && canAfford && void openPack(pack)}
              style={{ opacity: canAfford ? 1 : 0.6 }}
            >
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: pack.color || tc.primaryBorder,
                  backgroundColor: tc.surface,
                  overflow: "hidden",
                }}
              >
                {/* Icon + content row */}
                <View
                  style={{
                    flexDirection: "row",
                    padding: 16,
                    gap: 14,
                    alignItems: "flex-start",
                  }}
                >
                  {/* Icon box */}
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 12,
                      backgroundColor: (pack.color || "#EC4899") + "30",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {getPackIcon(pack.name, 36)}
                  </View>

                  {/* Text content */}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={{
                        fontFamily: "Nunito_700Bold",
                        fontSize: 16,
                        color: tc.fg,
                      }}
                    >
                      {pack.name}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Nunito_400Regular",
                        fontSize: 13,
                        color: tc.fgMuted,
                        paddingBottom: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: tc.surfaceMuted,
                      }}
                    >
                      {pack.description}
                    </Text>

                    {/* Chips row */}
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 6,
                        marginTop: 4,
                      }}
                    >
                      {/* Cost chip */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          backgroundColor: canAfford
                            ? tc.secondaryTint
                            : tc.dangerTint,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 9999,
                        }}
                      >
                        <CoinIcon size={14} />
                        <Text
                          style={{
                            fontFamily: "Nunito_700Bold",
                            fontSize: 12,
                            color: canAfford ? tc.secondaryText : tc.dangerText,
                          }}
                        >
                          {pack.cost}
                        </Text>
                      </View>

                      {/* Card count chip */}
                      <View
                        style={{
                          backgroundColor: tc.successTint,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 9999,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Nunito_600SemiBold",
                            fontSize: 12,
                            color: tc.successText,
                          }}
                        >
                          {pack.cardCount} cards
                        </Text>
                      </View>

                      {/* Guaranteed rarity chip */}
                      {pack.guaranteedRarity ? (
                        <View
                          style={{
                            backgroundColor: tc.accentTint,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 9999,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Nunito_600SemiBold",
                              fontSize: 12,
                              color: tc.accentText,
                            }}
                          >
                            Guaranteed: {pack.guaranteedRarity}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
