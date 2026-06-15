import { memo, useEffect, useRef } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import type { CollectionResponse } from "@adventure-time/api-client";

import {
  CARD_TYPE_COLORS,
  CARD_TYPE_COLORS_ICE,
  CARD_TYPE_COLORS_NIGHTOSPHERE,
  RARITY_COLORS,
  RARITY_COLORS_ICE,
  RARITY_COLORS_NIGHTOSPHERE,
} from "./theme";
import { CARD_ART_RATIO, type CardBackcoverRarityName } from "./card-back-cover-art";
import { CARD_OUTLINE_SAFE_AREA, getCardOutlineSource } from "./card-outline-frame";
import { RarityIcon } from "./icons";
import { getCardImageCacheKey, getCardImageUrl } from "../lib/card-images";
import { useThemeStore } from "../stores/theme-store";
import { THEME_COLORS } from "../theme/themes";

type CollectionEntry = CollectionResponse["cards"][number];

interface CardTileProps {
  entry: CollectionEntry;
  accessToken?: string | null;
  onPress?: () => void;
  onRecycle?: () => void;
  onCraft?: () => void;
  size?: "small" | "large";
  fitContainer?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

const sizeConfig = {
  small: {
    width: 152,
    height: 228,
    borderRadius: 16,
    typeFontSize: 6.5,
    typePaddingH: 8,
    typePaddingV: 4,
    rarityFontSize: 5.5,
    rarityPaddingH: 6,
    rarityPaddingV: 4,
    quantityFontSize: 8.5,
    quantityPaddingH: 8,
    quantityPaddingV: 3,
    contentPaddingX: 6,
    contentPaddingTop: 6,
    contentPaddingBottom: 6,
    panelRadius: 10,
    panelPadding: 6,
    topGap: 5,
    bodyGap: 6,
    nameFontSize: 10,
    charFontSize: 6.5,
    descFontSize: 6.2,
    descLineHeight: 8.5,
    descLines: 3,
    statGap: 5,
    statLabelFontSize: 4.8,
    statValueFontSize: 9.8,
  },
  large: {
    width: 320,
    height: 480,
    borderRadius: 28,
    typeFontSize: 10,
    typePaddingH: 12,
    typePaddingV: 6,
    rarityFontSize: 9,
    rarityPaddingH: 10,
    rarityPaddingV: 6,
    quantityFontSize: 13,
    quantityPaddingH: 12,
    quantityPaddingV: 6,
    contentPaddingX: 12,
    contentPaddingTop: 12,
    contentPaddingBottom: 12,
    panelRadius: 18,
    panelPadding: 10,
    topGap: 8,
    bodyGap: 10,
    nameFontSize: 18,
    charFontSize: 10.5,
    descFontSize: 11.5,
    descLineHeight: 15.5,
    descLines: 4,
    statGap: 8,
    statLabelFontSize: 7,
    statValueFontSize: 16,
  },
} as const;

const COMPACT_LABELS: Record<string, string> = {
  Common: "COM",
  Uncommon: "UNC",
  Rare: "RAR",
  Epic: "EPC",
  Legendary: "LGD",
};

function withAlpha(color: string, opacity: number) {
  if (color.startsWith("#") && color.length === 7) {
    const alpha = Math.max(0, Math.min(255, Math.round(opacity * 255)))
      .toString(16)
      .padStart(2, "0");
    return `${color}${alpha}`;
  }

  return color;
}

function RarityCrest({
  rarityName,
  rarity,
  cfg,
}: {
  rarityName: string;
  rarity: { from: string; to: string };
  cfg: (typeof sizeConfig)[keyof typeof sizeConfig];
}) {
  const label =
    COMPACT_LABELS[rarityName] ?? rarityName.slice(0, 3).toUpperCase();

  return (
    <LinearGradient
      colors={[rarity.from, rarity.to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderRadius: 999,
        paddingHorizontal: cfg.rarityPaddingH,
        paddingVertical: cfg.rarityPaddingV,
      }}
    >
      <RarityIcon
        rarityName={rarityName}
        size={cfg.rarityFontSize + 4}
        color="#FFF9F2"
      />
      <Text
        className="font-nunito-extrabold text-white"
        style={{ fontSize: cfg.rarityFontSize }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </LinearGradient>
  );
}

function StatPill({
  label,
  value,
  bg,
  border,
  cfg,
}: {
  label: string;
  value: string | number;
  bg: string;
  border: string;
  cfg: (typeof sizeConfig)[keyof typeof sizeConfig];
}) {
  return (
    <View
      style={{
        width: "48%",
        borderRadius: cfg.panelRadius,
        paddingHorizontal: cfg.panelPadding,
        paddingVertical: Math.max(4, cfg.panelPadding - 2),
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <Text
        className="font-nunito-extrabold text-white/80"
        style={{
          fontSize: cfg.statLabelFontSize,
          letterSpacing: 0.7,
        }}
      >
        {label}
      </Text>
      <Text
        className="font-nunito-extrabold text-white"
        style={{ fontSize: cfg.statValueFontSize }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

export const CardTile = memo(function CardTile({
  entry,
  accessToken: _accessToken,
  onPress,
  onRecycle,
  onCraft,
  size = "small",
  fitContainer = false,
  containerStyle,
  testID,
}: CardTileProps) {
  const { card, quantity } = entry;
  const cfg = sizeConfig[size];
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const typePalette =
    themeName === "ice"
      ? CARD_TYPE_COLORS_ICE
      : themeName === "nightosphere"
        ? CARD_TYPE_COLORS_NIGHTOSPHERE
        : CARD_TYPE_COLORS;
  const rarityPalette =
    themeName === "ice"
      ? RARITY_COLORS_ICE
      : themeName === "nightosphere"
        ? RARITY_COLORS_NIGHTOSPHERE
        : RARITY_COLORS;
  const typeColor = typePalette[card.type] ?? {
    frame: tc.primary,
    light: tc.primaryTint,
    dark: tc.primaryText,
  };
  const rarityColor = rarityPalette[card.rarity.name] ?? rarityPalette.Common;
  const outlineSource = getCardOutlineSource(
    themeName,
    card.rarity.name as CardBackcoverRarityName,
  );
  const isLegendary = card.rarity.name === "Legendary";
  const isEpic = card.rarity.name === "Epic";
  const hasShimmer = isLegendary || isEpic;
  const cardAspectRatio = CARD_ART_RATIO;

  const bounceAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (size !== "small" || quantity <= 1) {
      bounceAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -4,
          duration: 420,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 420,
          useNativeDriver: true,
          easing: Easing.in(Easing.quad),
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounceAnim, quantity, size]);

  const shimmerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!hasShimmer) {
      shimmerAnim.setValue(0);
      return;
    }

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
  }, [hasShimmer, isLegendary, shimmerAnim]);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-cfg.width * 3, cfg.width],
  });
  const contentFrameStyle = {
    position: "absolute" as const,
    left: CARD_OUTLINE_SAFE_AREA.left,
    right: CARD_OUTLINE_SAFE_AREA.right,
    top: CARD_OUTLINE_SAFE_AREA.top,
    bottom: CARD_OUTLINE_SAFE_AREA.bottom,
    paddingHorizontal: cfg.contentPaddingX,
    paddingTop: cfg.contentPaddingTop,
    paddingBottom: cfg.contentPaddingBottom,
    justifyContent: "space-between" as const,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      style={[
        {
          width: fitContainer ? "100%" : cfg.width,
          margin: fitContainer ? 0 : size === "small" ? 4 : 0,
          opacity: onPress ? 1 : 0.98,
        },
        containerStyle,
      ]}
    >
      <View
        className="overflow-hidden"
        style={{
          borderRadius: cfg.borderRadius,
          backgroundColor: withAlpha(typeColor.frame, 0.2),
          height: fitContainer ? undefined : cfg.height,
          aspectRatio: fitContainer ? cardAspectRatio : undefined,
          boxShadow:
            size === "large"
              ? `0px 18px 42px ${withAlpha(rarityColor.to, 0.22)}`
              : `0px 10px 24px ${withAlpha(rarityColor.to, 0.18)}`,
        }}
      >
        {card.imageAssetId ? (
          <Image
            source={{
              uri: getCardImageUrl(card.imageAssetId),
              cacheKey: getCardImageCacheKey(card.imageAssetId),
            }}
            placeholder={{ blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH" }}
            style={{ position: "absolute", inset: 0 }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View
            className="absolute inset-0 items-center justify-center"
            style={{ backgroundColor: typeColor.light }}
          >
            <Text
              className="font-nunito-extrabold"
              style={{
                color: typeColor.dark,
                fontSize: cfg.nameFontSize * 4,
              }}
            >
              {(card.character || card.name || "?").charAt(0)}
            </Text>
          </View>
        )}

        <LinearGradient
          colors={[
            withAlpha("#120914", themeName === "nightosphere" ? 0.14 : 0.05),
            withAlpha("#120914", themeName === "nightosphere" ? 0.2 : 0.12),
            withAlpha("#120914", 0.78),
          ]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />

        {hasShimmer ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              height: fitContainer ? "100%" : cfg.height,
              width: cfg.width * 3,
              transform: [{ translateX: shimmerTranslate }],
            }}
          >
            <LinearGradient
              colors={[
                withAlpha("#FFFFFF", 0),
                withAlpha(isLegendary ? tc.secondary : tc.accent, isLegendary ? 0.2 : 0.16),
                withAlpha("#FFFFFF", 0),
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        ) : null}

        <Image
          pointerEvents="none"
          source={outlineSource}
          style={{ position: "absolute", inset: 0 }}
          contentFit="fill"
        />

        <View style={contentFrameStyle}>
          <View style={{ gap: cfg.topGap }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: cfg.topGap,
              }}
            >
              <View
                style={{
                  maxWidth: "52%",
                  borderRadius: 999,
                  paddingHorizontal: cfg.typePaddingH,
                  paddingVertical: cfg.typePaddingV,
                  backgroundColor: withAlpha(typeColor.dark, themeName === "nightosphere" ? 0.72 : 0.64),
                  borderWidth: 1,
                  borderColor: withAlpha("#FFFFFF", themeName === "nightosphere" ? 0.1 : 0.18),
                }}
              >
                <Text
                  className="font-nunito-extrabold text-white"
                  style={{ fontSize: cfg.typeFontSize }}
                  numberOfLines={1}
                >
                  {card.type}
                </Text>
              </View>

              <RarityCrest
                rarityName={card.rarity.name}
                rarity={rarityColor}
                cfg={cfg}
              />
            </View>

            {quantity > 1 ? (
              <Animated.View
                style={{
                  alignSelf: "flex-end",
                  transform: size === "small" ? [{ translateY: bounceAnim }] : undefined,
                }}
              >
                <LinearGradient
                  colors={[tc.secondary, tc.secondaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: cfg.quantityPaddingH,
                    paddingVertical: cfg.quantityPaddingV,
                  }}
                >
                  <Text
                    className="font-nunito-extrabold"
                    style={{ color: tc.secondaryText, fontSize: cfg.quantityFontSize }}
                  >
                    x{quantity}
                  </Text>
                </LinearGradient>
              </Animated.View>
            ) : null}
          </View>

          <View style={{ gap: cfg.bodyGap }}>
            <View
              style={{
                borderRadius: cfg.panelRadius,
                paddingHorizontal: cfg.panelPadding,
                paddingVertical: cfg.panelPadding,
                backgroundColor:
                  themeName === "nightosphere"
                    ? withAlpha("#08020A", 0.78)
                    : withAlpha("#120914", 0.5),
                borderWidth: 1,
                borderColor: withAlpha("#FFFFFF", themeName === "nightosphere" ? 0.08 : 0.14),
              }}
            >
              <Text
                className="font-nunito-extrabold text-white"
                style={{ fontSize: cfg.nameFontSize }}
                numberOfLines={2}
              >
                {card.name}
              </Text>
              {card.character ? (
                <Text
                  className="font-nunito-bold text-white/85"
                  style={{
                    fontSize: cfg.charFontSize,
                    letterSpacing: 0.4,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {card.character}
                </Text>
              ) : null}
            </View>

            <View
              style={{
                borderRadius: cfg.panelRadius,
                padding: cfg.panelPadding,
                backgroundColor:
                  themeName === "nightosphere"
                    ? withAlpha("#070109", 0.84)
                    : withAlpha("#FFF9F2", 0.8),
                borderWidth: 1,
                borderColor: withAlpha(rarityColor.ring, themeName === "nightosphere" ? 0.24 : 0.18),
              }}
            >
              <Text
                className="font-nunito"
                style={{
                  color: tc.fg,
                  fontSize: cfg.descFontSize,
                  lineHeight: cfg.descLineHeight,
                }}
                numberOfLines={cfg.descLines}
              >
                {card.description}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
                rowGap: cfg.statGap,
              }}
            >
              <StatPill
                label="ATK"
                value={card.attack}
                bg={withAlpha(tc.dangerDark, themeName === "nightosphere" ? 0.34 : 0.7)}
                border={withAlpha(tc.danger, themeName === "nightosphere" ? 0.26 : 0.3)}
                cfg={cfg}
              />
              <StatPill
                label="HP"
                value={card.hp}
                bg={withAlpha(rarityColor.to, themeName === "nightosphere" ? 0.34 : 0.68)}
                border={withAlpha(rarityColor.from, themeName === "nightosphere" ? 0.28 : 0.3)}
                cfg={cfg}
              />
              <StatPill
                label="DEF"
                value={card.defense}
                bg={withAlpha(tc.infoDark, themeName === "nightosphere" ? 0.34 : 0.68)}
                border={withAlpha(tc.info, themeName === "nightosphere" ? 0.28 : 0.3)}
                cfg={cfg}
              />
              <StatPill
                label="SPD"
                value={card.speed}
                bg={withAlpha(tc.successDark, themeName === "nightosphere" ? 0.34 : 0.68)}
                border={withAlpha(tc.success, themeName === "nightosphere" ? 0.28 : 0.3)}
                cfg={cfg}
              />
            </View>
          </View>
        </View>
      </View>

      {onRecycle || onCraft ? (
        <View className="mt-2 flex-row gap-2">
          {onRecycle ? (
            <Pressable
              onPress={onRecycle}
              className="flex-1 items-center rounded-full"
              style={{
                backgroundColor: tc.surface,
                borderWidth: 1,
                borderColor: tc.primaryBorder,
                paddingVertical: 8,
              }}
            >
              <Text className="font-nunito-bold text-primaryText">Recycle</Text>
            </Pressable>
          ) : null}
          {onCraft ? (
            <Pressable
              onPress={onCraft}
              className="flex-1 items-center rounded-full"
              style={{
                backgroundColor: tc.primaryTint,
                borderWidth: 1,
                borderColor: tc.primaryBorder,
                paddingVertical: 8,
              }}
            >
              <Text className="font-nunito-bold text-primaryText">Craft</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
});
