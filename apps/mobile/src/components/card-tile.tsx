import { memo, useEffect, useRef } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import type { CollectionResponse } from "@adventure-time/api-client";
import { CARD_ART_RATIO } from "./card-back-cover-art";
import { getCardImageCacheKey, getCardImageUrl } from "../lib/card-images";
import { CARD_TYPE_COLORS, RARITY_COLORS, SECONDARY_TINT } from "./theme";
import { HPIcon, SpeedIcon, RarityIcon } from "./icons";
import { useTranslation } from "../i18n";
import { useThemeStore } from "../stores/theme-store";
import { THEME_COLORS } from "../theme/themes";

type CollectionEntry = CollectionResponse["cards"][number];

interface CardTileProps {
  entry: CollectionEntry;
  accessToken?: string | null;
  onPress?: () => void;
  onRecycle?: () => void;
  onCraft?: () => void;
  muted?: boolean;
  size?: "small" | "large";
  fitContainer?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

const sizeConfig = {
  small: {
    width: 152,
    height: 228,
    paddingH: 6,
    paddingT: 4,
    paddingB: 2,
    headerFontSize: 8,
    hpIconSize: 30,
    nameFontSize: 9,
    charFontSize: 8,
    descFontSize: 7,
    descPadding: 4,
    descLineHeight: 10,
    speedHeight: 16,
    speedIconSize: 30,
    typeFontSize: 6,
    rarityFontSize: 5,
    borderRadius: 12,
    imageAspect: 5 / 3,
    headerHeight: 18,
    headerHpOffset: -15,
    headerHpTop: -2,
    descMarginTop: 3,
    descMinHeight: 28,
    nameMarginTop: 2,
    nameGap: 1,
    speedMarginTop: 2,
    speedIconTop: -12,
    typePaddingH: 6,
    typePaddingV: 2,
    rarityBadgeRadius: 4,
  },
  large: {
    width: 320,
    height: 480,
    paddingH: 16,
    paddingT: 8,
    paddingB: 4,
    headerFontSize: 16,
    hpIconSize: 60,
    nameFontSize: 18,
    charFontSize: 16,
    descFontSize: 12,
    descPadding: 16,
    descLineHeight: 20,
    speedHeight: 40,
    speedIconSize: 60,
    typeFontSize: 10,
    rarityFontSize: 9,
    borderRadius: 16,
    imageAspect: 320 / 192,
    headerHeight: 36,
    headerHpOffset: -30,
    headerHpTop: -4,
    descMarginTop: 6,
    descMinHeight: 56,
    nameMarginTop: 4,
    nameGap: 2,
    speedMarginTop: 4,
    speedIconTop: -24,
    typePaddingH: 12,
    typePaddingV: 4,
    rarityBadgeRadius: 8,
  },
};

const COMPACT_LABELS: Record<string, string> = {
  Common: "COM",
  Uncommon: "UNC",
  Rare: "RAR",
  Epic: "EPC",
  Legendary: "LGD",
};

function RarityCrest({
  rarityName,
  cfg,
}: {
  rarityName: string;
  cfg: typeof sizeConfig.small;
}) {
  const rarity = RARITY_COLORS[rarityName] ?? RARITY_COLORS.Common;
  const label =
    COMPACT_LABELS[rarityName] ?? rarityName.slice(0, 3).toUpperCase();
  return (
    <LinearGradient
      colors={[rarity.from, rarity.to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ gap: 2, paddingHorizontal: 4, paddingVertical: 1 }}
      className="flex-row items-center"
    >
      <RarityIcon
        rarityName={rarityName}
        size={cfg.rarityFontSize + 3}
        color="#fff"
      />
      <Text
        className="text-white font-nunito-extrabold"
        style={{ fontSize: cfg.rarityFontSize }}
      >
        {label}
      </Text>
    </LinearGradient>
  );
}

export const CardTile = memo(function CardTile({
  entry,
  accessToken: _accessToken,
  onPress,
  onRecycle,
  onCraft,
  muted = false,
  size = "small",
  fitContainer = false,
  containerStyle,
  testID,
}: CardTileProps) {
  const { card, quantity } = entry;
  const cfg = sizeConfig[size];
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  const isLocked = quantity <= 0;
  const typeColor = CARD_TYPE_COLORS[card.type] ?? {
    frame: "#9CA3AF",
    light: "#F3F4F6",
    dark: "#374151",
  };
  const rarityColor = RARITY_COLORS[card.rarity.name] ?? {
    from: "#9CA3AF",
    to: "#6B7280",
    ring: "#9CA3AF",
  };

  const isLegendary = card.rarity.name === "Legendary";
  const isEpic = card.rarity.name === "Epic";
  const hasShimmer = isLegendary || isEpic;

  const bounceAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (size !== "small" || quantity <= 1) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -5,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.in(Easing.quad),
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [quantity, size]);

  const shimmerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!hasShimmer) return;
    const duration = isLegendary ? 2600 : 3100;
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [hasShimmer, isLegendary]);

  const shimmerColorPeak = isLegendary
    ? "rgba(239, 217, 72, 0.18)"
    : "rgba(174, 82, 255, 0.16)";
  const shimmerColorEdge = isLegendary
    ? "rgba(239, 217, 72, 0)"
    : "rgba(174, 82, 255, 0)";
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-cfg.width * 3, cfg.width],
  });
  const cardAspectRatio = CARD_ART_RATIO;
  const cardContentOpacity = muted
    ? tc.bg === "#0D0010"
      ? 0.46
      : 0.58
    : 1;
  const concealedStat = size === "large" ? "??" : "?";

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={[
        {
          width: fitContainer ? "100%" : cfg.width,
          margin: fitContainer ? 0 : size === "small" ? 4 : 0,
        },
        containerStyle,
      ]}
    >
      {/* Outer card: type-colored frame background */}
      <View
        className="overflow-hidden"
        style={{
          borderRadius: cfg.borderRadius,
          backgroundColor: typeColor.frame,
          height: fitContainer ? undefined : cfg.height,
          aspectRatio: fitContainer ? cardAspectRatio : undefined,
        }}
      >
        {/* Rarity ring overlay */}
        <View
          pointerEvents="none"
          className="absolute inset-0 z-10"
          style={{
            borderRadius: cfg.borderRadius,
            borderWidth: 1,
            borderColor: rarityColor.ring,
          }}
        />

        {/* Rarity shimmer sweep (Legendary / Epic) */}
        {hasShimmer && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              height: cfg.height,
              width: cfg.width * 3,
              transform: [{ translateX: shimmerTranslate }],
              zIndex: 15,
            }}
          >
            <LinearGradient
              colors={[shimmerColorEdge, shimmerColorPeak, shimmerColorEdge]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        )}

        {/* Inner content */}
        <View
          className="flex-1"
          style={{
            paddingHorizontal: cfg.paddingH,
            paddingTop: cfg.paddingT,
            paddingBottom: cfg.paddingB,
            opacity: cardContentOpacity,
          }}
        >
          {/* === HEADER: ATK / HP / DEF === */}
          <View
            className="flex-row items-center relative"
            style={{ marginBottom: 2, height: cfg.headerHeight }}
          >
            <Text
              className="flex-1 text-center text-white font-nunito-extrabold"
              style={{ fontSize: cfg.headerFontSize }}
            >
              {isLocked ? concealedStat : card.attack} ATK
            </Text>
            {/* HP floats center, slightly overlapping down */}
            <View
              style={{
                position: "absolute",
                left: "50%",
                transform: [{ translateX: cfg.headerHpOffset }],
                top: cfg.headerHpTop,
                zIndex: 5,
              }}
            >
              {isLocked ? (
                <View
                  className="items-center justify-center border-2"
                  style={{
                    width: cfg.hpIconSize,
                    height: cfg.hpIconSize,
                    borderRadius: cfg.hpIconSize / 2,
                    backgroundColor: tc.surface,
                    borderColor: rarityColor.ring,
                  }}
                >
                  <Text
                    className="font-nunito-extrabold"
                    style={{
                      color: tc.primaryText,
                      fontSize: cfg.headerFontSize,
                    }}
                  >
                    {concealedStat}
                  </Text>
                </View>
              ) : (
                <HPIcon size={cfg.hpIconSize} hpVal={card.hp} />
              )}
            </View>
            <Text
              className="flex-1 text-center text-white font-nunito-bold"
              style={{ fontSize: cfg.headerFontSize }}
            >
              {isLocked ? concealedStat : card.defense} DEF
            </Text>
          </View>

          {/* === IMAGE SECTION === */}
          <View
            className="overflow-hidden relative"
            style={{
              aspectRatio: cfg.imageAspect,
              borderRadius: cfg.rarityBadgeRadius,
            }}
          >
            {isLocked ? (
              <LinearGradient
                colors={[typeColor.dark, rarityColor.ring, typeColor.frame]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <Text
                  className="text-white font-nunito-extrabold"
                  style={{ fontSize: cfg.nameFontSize * 2.6 }}
                >
                  ?
                </Text>
                <Text
                  className="text-white font-nunito-bold"
                  style={{ fontSize: cfg.typeFontSize }}
                >
                  {t("collection.locked.illustration")}
                </Text>
              </LinearGradient>
            ) : card.imageAssetId ? (
              <Image
                source={{
                  uri: getCardImageUrl(card.imageAssetId),
                  cacheKey: getCardImageCacheKey(card.imageAssetId),
                }}
                placeholder={{ blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH" }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View
                className="flex-1 items-center justify-center"
                style={{ backgroundColor: typeColor.light }}
              >
                <Text
                  className="font-nunito-extrabold"
                  style={{
                    color: typeColor.dark,
                    fontSize: cfg.nameFontSize * 2,
                  }}
                >
                  {(card.character || card.name || "?").charAt(0)}
                </Text>
              </View>
            )}

            {/* Type badge — bottom right */}
            <View
              className="absolute bottom-0 right-0"
              style={{
                backgroundColor: typeColor.dark,
                paddingHorizontal: cfg.typePaddingH,
                paddingVertical: cfg.typePaddingV,
                borderTopLeftRadius: cfg.rarityBadgeRadius / 2,
              }}
            >
              <Text
                className="text-white font-nunito-bold"
                style={{ fontSize: cfg.typeFontSize }}
              >
                {card.type}
              </Text>
            </View>

            {/* Rarity crest — bottom left */}
            <View
              className="absolute bottom-0 left-0 overflow-hidden"
              style={{ borderTopRightRadius: cfg.rarityBadgeRadius / 2 }}
            >
              <RarityCrest rarityName={card.rarity.name} cfg={cfg} />
            </View>
          </View>

          {/* === NAME & CHARACTER === */}
          <View
            className="items-center"
            style={{ marginTop: cfg.nameMarginTop, gap: cfg.nameGap }}
          >
            <Text
              className="text-white font-nunito-bold"
              style={{ fontSize: cfg.nameFontSize }}
              numberOfLines={1}
            >
              {card.name}
            </Text>
            <Text
              className="text-white font-nunito-semibold italic"
              style={{ fontSize: cfg.charFontSize }}
              numberOfLines={1}
            >
              {card.character}
            </Text>
          </View>

          {/* === DESCRIPTION === */}
          <View
            style={{
              backgroundColor: SECONDARY_TINT,
              borderRadius: cfg.rarityBadgeRadius / 2,
              padding: cfg.descPadding,
              marginTop: cfg.descMarginTop,
              flex: 1,
              minHeight: cfg.descMinHeight,
            }}
          >
            <Text
              className="font-nunito"
              style={{
                color: tc.primaryText,
                fontSize: cfg.descFontSize,
                lineHeight: cfg.descLineHeight,
              }}
              numberOfLines={size === "large" ? 6 : 4}
            >
              {isLocked
                ? t("collection.locked.description")
                : card.description}
            </Text>
          </View>

          {/* === SPEED SECTION === */}
          <View
            className="items-center justify-center relative"
            style={{ height: cfg.speedHeight, marginTop: cfg.speedMarginTop }}
          >
            {isLocked ? (
              <View
                className="absolute items-center justify-center border-2"
                style={{
                  top: cfg.speedIconTop,
                  width: cfg.speedIconSize,
                  height: cfg.speedIconSize,
                  borderRadius: cfg.speedIconSize / 2,
                  backgroundColor: tc.surface,
                  borderColor: rarityColor.ring,
                }}
              >
                <Text
                  className="font-nunito-extrabold"
                  style={{
                    color: tc.primaryText,
                    fontSize: cfg.headerFontSize,
                  }}
                >
                  {concealedStat}
                </Text>
              </View>
            ) : (
              <View style={{ position: "absolute", top: cfg.speedIconTop }}>
                <SpeedIcon size={cfg.speedIconSize} speedVal={card.speed} />
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Quantity badge below card — only for small size */}
      {size === "small" &&
        (quantity > 1 ? (
          <Animated.View
            style={{
              alignItems: "center",
              marginTop: 4,
              transform: [{ translateY: bounceAnim }],
            }}
          >
            <View
              className="rounded-full items-center"
              style={{
                backgroundColor: rarityColor.ring,
                paddingHorizontal: 10,
                paddingVertical: 2,
                width: 50,
              }}
            >
              <Text
                className="text-white font-nunito-bold"
                style={{ fontSize: 11 }}
              >
                x{quantity}
              </Text>
            </View>
          </Animated.View>
        ) : muted || isLocked ? (
          <View className="items-center" style={{ marginTop: 4 }}>
            <View
              className="rounded-full items-center"
              style={{
                backgroundColor: tc.surfaceMuted,
                borderWidth: 1,
                borderColor: tc.primaryBorder,
                paddingHorizontal: 10,
                paddingVertical: 2,
                minWidth: 76,
              }}
            >
              <Text
                className="font-nunito-bold"
                style={{ fontSize: 12, color: tc.fgMuted }}
              >
                {t("collection.notOwned")}
              </Text>
            </View>
          </View>
        ) : (
          <View className="h-5" />
        ))}

      {/* Action buttons below card */}
      {onRecycle || onCraft ? (
        <View className="flex-row gap-1 mt-1">
          {onRecycle ? (
            <Pressable
              onPress={onRecycle}
              className="flex-1 items-center border rounded-lg border-primaryBorder"
              style={{ paddingVertical: 4 }}
            >
              <Text
                className="font-nunito-semibold text-primaryText"
                style={{ fontSize: 10 }}
              >
                Recycle
              </Text>
            </Pressable>
          ) : null}
          {onCraft ? (
            <Pressable
              onPress={onCraft}
              className="flex-1 items-center border rounded-lg border-primaryBorder"
              style={{ paddingVertical: 4 }}
            >
              <Text
                className="font-nunito-semibold text-primaryText"
                style={{ fontSize: 10 }}
              >
                Craft
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
});
