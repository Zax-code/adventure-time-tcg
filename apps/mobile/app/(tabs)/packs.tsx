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

import type { PacksResponse, OpenPackResponse } from "@adventure-time/shared";

type Pack = PacksResponse["packs"][number];
type OpenedCard = OpenPackResponse["cards"][number];
type OpeningPhase =
  | "selecting"
  | "shaking"
  | "bursting"
  | "loading"
  | "readyToReveal"
  | "revealing"
  | "complete";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function getRarityGlowColor(rarityName: string): string {
  switch (rarityName) {
    case "Legendary": return "#FFD700";
    case "Epic":      return "#A855F7";
    case "Rare":      return "#3B82F6";
    default:          return "#EC4899";
  }
}

function getPackIcon(packName: string, size = 36) {
  if (packName.includes("Legendary")) return <CrownIcon size={size} color="#D97706" />;
  if (packName.includes("Epic"))      return <DiamondIcon size={size} color="#7C3AED" />;
  if (packName.includes("Premium"))   return <SparkleIcon size={size} color="#DB2777" />;
  if (packName.includes("Standard"))  return <GiftBoxIcon size={size} color="#DC2626" />;
  return <BoxIcon size={size} color="#6B7280" />;
}

export default function PacksScreen() {
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((state) => state.accessToken);
  const refreshToken = useSessionStore((state) => state.refreshToken);
  const setSession = useSessionStore((state) => state.setSession);
  const coins = useSessionStore((state) => state.user?.coins ?? 0);

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
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 2)).current;
  const floatAnims = useRef([...Array(8)].map(() => new Animated.Value(0))).current;

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
        { iterations: -1 }
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
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.97, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);

  // Loading spinner
  useEffect(() => {
    if (phase !== "loading") return;
    spinAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 800, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);

  function startShakeAnimation() {
    shakeAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]),
      { iterations: 8 }
    ).start();

    // Shimmer sweep
    shimmerAnim.setValue(-SCREEN_WIDTH * 2);
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: SCREEN_WIDTH * 2,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
  }

  function startBurstAnimation() {
    burstScaleAnim.setValue(1);
    Animated.timing(burstScaleAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }

  async function openPack(pack: Pack) {
    if (coins < pack.cost) {
      setOpenError(`Need ${pack.cost} coins (have ${coins})`);
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
      if (accessToken && refreshToken) {
        const me = await apiClient.me();
        await setSession({ user: me, accessToken, refreshToken });
      }

      setPhase("readyToReveal");
      setRevealedIndex(-1);
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : "Failed to open pack.");
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
        <Text className="font-nunito text-fgMuted">Loading packs...</Text>
      </View>
    );
  }

  if (packsQuery.isError || !packsQuery.data) {
    return (
      <View className="flex-1 bg-bg p-6">
        <Text className="font-nunito text-red-600">
          {packsQuery.error?.message ?? "Packs unavailable."}
        </Text>
      </View>
    );
  }

  const packs = packsQuery.data.packs;

  // ── SHAKING / BURSTING phase ──────────────────────────────────────────────
  if ((phase === "shaking" || phase === "bursting") && selectedPack) {
    const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <Text className="font-nunito-extrabold text-2xl text-fg mb-8">Card Packs</Text>
        <Animated.View
          style={{
            transform: [
              { translateX: phase === "shaking" ? shakeAnim : new Animated.Value(0) },
              { scale: burstScaleAnim },
            ],
            width: 200,
            height: 280,
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: selectedPack.color || "#EC4899",
          }}
        >
          <LinearGradient
            colors={["rgba(255,255,255,0.2)", "transparent", "rgba(0,0,0,0.15)"]}
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
            <Text className="font-nunito-bold text-white text-lg">{selectedPack.name}</Text>
            <Text className="font-nunito text-white/80 text-sm">{selectedPack.cardCount} cards</Text>
          </View>
        </Animated.View>
        <Text className="font-nunito text-fgMuted mt-6 text-base">Opening...</Text>
      </View>
    );
  }

  // ── LOADING phase ─────────────────────────────────────────────────────────
  if (phase === "loading" && selectedPack) {
    const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    return (
      <View className="flex-1 bg-bg items-center justify-center gap-6">
        {/* Stacked card backs */}
        <View style={{ width: 200, height: 280, position: "relative" }}>
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
                transform: [{ rotate: s.rotate }, { translateX: s.tx }, { translateY: s.ty }],
                borderWidth: 2,
                borderColor: "#F9A8D4",
              }}
            >
              <LinearGradient
                colors={["#FCE7F3", "#FBCFE8", "#F9A8D4"]}
                style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
              >
                <SparklesIcon size={32} color="#DB2777" />
              </LinearGradient>
            </View>
          ))}

          {/* Spinning overlay */}
          <Animated.View
            style={{
              position: "absolute",
              inset: -20,
              borderRadius: 9999,
              borderWidth: 4,
              borderColor: "#F9A8D4",
              borderTopColor: "#EC4899",
              transform: [{ rotate: spin }],
            }}
          />
        </View>

        {/* Progress bar */}
        <View style={{ width: 256, height: 12, backgroundColor: "#F3F4F6", borderRadius: 9999, overflow: "hidden" }}>
          <LinearGradient
            colors={["#F472B6", "#EC4899"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: "100%", width: `${loadingProgress}%`, borderRadius: 9999 }}
          />
        </View>
        <Text className="font-nunito text-fgMuted">Preparing cards... {loadingProgress}%</Text>
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
            colors={["#FCE7F3", "#F9A8D4", "#EC4899"]}
            style={{
              width: 200,
              height: 280,
              borderRadius: 16,
              borderWidth: 4,
              borderColor: "#F9A8D4",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Scattered sparkles */}
            {[
              { top: 20, left: 20 },
              { top: 20, right: 20 },
              { bottom: 20, left: 20 },
              { bottom: 20, right: 20 },
              { top: "40%", left: 10 },
              { top: "40%", right: 10 },
            ].map((pos, i) => (
              <View key={i} style={{ position: "absolute", ...pos }}>
                <SparkleIcon size={16} color="rgba(255,255,255,0.6)" />
              </View>
            ))}
            <Text style={{ color: "#fff", fontSize: 64, fontFamily: "Nunito_800ExtraBold" }}>?</Text>
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
                backgroundColor: "#F9A8D4",
                opacity: 0.5,
              }}
            />
          ))}
        </View>

        <Text className="font-nunito text-fgMuted">Tap to reveal</Text>
      </TouchableOpacity>
    );
  }

  // ── REVEALING phase ───────────────────────────────────────────────────────
  if (phase === "revealing" && revealedIndex >= 0 && revealedIndex < openedCards.length) {
    const card = openedCards[revealedIndex];
    const rarityName = card.rarity?.name ?? "Common";
    const glowColor = getRarityGlowColor(rarityName);
    const rarityRing = RARITY_COLORS[rarityName]?.ring ?? "#9CA3AF";
    const isHighRarity = ["Legendary", "Epic", "Rare"].includes(rarityName);
    const cardScale = flipAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
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
            ? [
                { top: 80, left: 40 },
                { top: 80, right: 40 },
                { top: "35%", left: 20 },
                { top: "35%", right: 20 },
                { top: "65%", left: 30 },
                { top: "65%", right: 30 },
                { bottom: 120, left: 50 },
                { bottom: 120, right: 50 },
              ].map((pos, i) => (
                <View key={i} style={{ position: "absolute", ...pos }}>
                  <SparkleIcon size={14} color={glowColor} />
                </View>
              ))
            : null}

          {/* Card */}
          <Animated.View
            style={{
              transform: [{ scale: cardScale }],
              width: 240,
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
                borderRadius: 16,
                borderWidth: 3,
                borderColor: rarityRing,
                zIndex: 10,
              }}
            />
            <CardTile entry={entry as any} accessToken={accessToken} />

            {/* NEW! badge */}
            {card.isNewForUser ? (
              <View style={{ position: "absolute", top: -10, right: -10, zIndex: 20 }}>
                <LinearGradient
                  colors={["#34D399", "#059669"]}
                  style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 }}
                >
                  <Text style={{ color: "#fff", fontSize: 10, fontFamily: "Nunito_800ExtraBold" }}>
                    NEW!
                  </Text>
                </LinearGradient>
              </View>
            ) : null}
          </Animated.View>

          {/* Dot indicators */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {openedCards.map((c, i) => {
              const rName = c.rarity?.name ?? "Common";
              const dotColor = i === revealedIndex
                ? (RARITY_COLORS[rName]?.ring ?? "#EC4899")
                : i < revealedIndex
                ? "#EC4899"
                : "#F9A8D4";
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

          <Text className="font-nunito text-fgMuted">
            {isLast ? "Tap to see summary" : `${revealedIndex + 1} / ${openedCards.length}`}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── COMPLETE phase ────────────────────────────────────────────────────────
  if (phase === "complete") {
    const newCount = openedCards.filter((c) => c.isNewForUser).length;
    const rarityBreakdown = openedCards.reduce<Record<string, { total: number; newCount: number }>>(
      (acc, c) => {
        const rName = c.rarity?.name ?? "Common";
        if (!acc[rName]) acc[rName] = { total: 0, newCount: 0 };
        acc[rName].total++;
        if (c.isNewForUser) acc[rName].newCount++;
        return acc;
      },
      {}
    );

    return (
      <ScrollView className="flex-1 bg-bg" contentContainerClassName="p-4 pb-8">
        <Text className="font-nunito-extrabold text-2xl text-fg mb-4">Your Cards!</Text>

        {/* 2-column card grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {openedCards.map((card, i) => {
            const entry = { card: card as any, quantity: 1 };
            return (
              <View key={`${card.id}-${i}`} style={{ width: "50%", padding: 4 }}>
                <CardTile entry={entry as any} accessToken={accessToken} />
                {card.isNewForUser ? (
                  <View style={{ alignItems: "center", marginTop: 4 }}>
                    <LinearGradient
                      colors={["#34D399", "#059669"]}
                      style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 }}
                    >
                      <Text style={{ color: "#fff", fontSize: 10, fontFamily: "Nunito_800ExtraBold" }}>
                        NEW!
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
            backgroundColor: "rgba(255,255,255,0.6)",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#F9A8D4",
            padding: 16,
            marginTop: 12,
            gap: 8,
          }}
        >
          <Text className="font-nunito-bold text-lg text-fg">Summary</Text>

          {newCount > 0 ? (
            <Text className="font-nunito text-fgMuted">
              ✨ New cards: {newCount}/{openedCards.length}
            </Text>
          ) : null}

          {Object.entries(rarityBreakdown).map(([rName, info]) => (
            <Text key={rName} className="font-nunito text-fgMuted">
              {rName} x{info.total}
              {info.newCount > 0 ? ` (${info.newCount} new)` : ""}
            </Text>
          ))}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <CoinIcon size={18} />
            <Text className="font-nunito text-fgMuted">
              Remaining coins: {newBalance ?? coins}
            </Text>
          </View>
        </View>

        {/* Open Another Pack button */}
        <Pressable onPress={reset} style={{ marginTop: 16 }}>
          <LinearGradient
            colors={["#F472B6", "#EC4899"]}
            style={{ borderRadius: 16, paddingVertical: 14, alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontFamily: "Nunito_800ExtraBold", fontSize: 16 }}>
              Open Another Pack
            </Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    );
  }

  // ── SELECTING phase (default) ─────────────────────────────────────────────
  const heartPositions = [
    { left: "10%", top: "15%" },
    { left: "25%", top: "5%" },
    { left: "45%", top: "20%" },
    { left: "65%", top: "8%" },
    { left: "80%", top: "18%" },
    { left: "15%", top: "70%" },
    { left: "60%", top: "75%" },
    { left: "85%", top: "65%" },
  ] as const;

  return (
    <View className="flex-1 bg-bg">
      {/* Floating hearts background */}
      {floatAnims.map((anim, i) => {
        const pos = heartPositions[i];
        const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -80] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              ...pos,
              opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.6, 0.3] }),
              transform: [{ translateY }],
              zIndex: 0,
            }}
          >
            <Text style={{ fontSize: 20 }}>💕</Text>
          </Animated.View>
        );
      })}

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, zIndex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text className="font-nunito-extrabold text-2xl text-fg">Card Packs</Text>
            <Text className="font-nunito text-fgMuted text-sm">Choose a pack to open</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <CoinIcon size={20} />
            <Text className="font-nunito-bold text-fg">{coins}</Text>
          </View>
        </View>

        {openError ? (
          <View className="rounded-2xl bg-red-50 border border-red-200 p-3">
            <Text className="font-nunito text-red-600 text-sm">{openError}</Text>
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
                  borderColor: pack.color || "#F9A8D4",
                  backgroundColor: "#fff",
                  overflow: "hidden",
                }}
              >
                {/* Icon + content row */}
                <View style={{ flexDirection: "row", padding: 16, gap: 14, alignItems: "flex-start" }}>
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
                    <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 16, color: "#1F2937" }}>
                      {pack.name}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Nunito_400Regular",
                        fontSize: 13,
                        color: "#6B7280",
                        paddingBottom: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: "#F3F4F6",
                      }}
                    >
                      {pack.description}
                    </Text>

                    {/* Chips row */}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      {/* Cost chip */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          backgroundColor: canAfford ? "#FEF3C7" : "#FEE2E2",
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
                            color: canAfford ? "#92400E" : "#B91C1C",
                          }}
                        >
                          {pack.cost}
                        </Text>
                      </View>

                      {/* Card count chip */}
                      <View
                        style={{
                          backgroundColor: "#F0FDF4",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 9999,
                        }}
                      >
                        <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 12, color: "#166534" }}>
                          {pack.cardCount} cards
                        </Text>
                      </View>

                      {/* Guaranteed rarity chip */}
                      {pack.guaranteedRarity ? (
                        <View
                          style={{
                            backgroundColor: "#FDF4FF",
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 9999,
                          }}
                        >
                          <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 12, color: "#7E22CE" }}>
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
