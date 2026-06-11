import { memo, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import type {
  AdminCardDetail,
  AdminCardsResponse,
} from "@adventure-time/api-client";

import { CARD_ART_RATIO } from "../card-back-cover-art";
import { getCardImageCacheKey, getCardImageUrl } from "../../lib/card-images";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";
import { HPIcon, RarityIcon, SpeedIcon } from "../icons";
import {
  CARD_TYPE_COLORS,
  CARD_TYPE_COLORS_ICE,
  CARD_TYPE_COLORS_NIGHTOSPHERE,
  RARITY_COLORS,
  RARITY_COLORS_ICE,
  RARITY_COLORS_NIGHTOSPHERE,
} from "../theme";
import { pickReadableTextColor, withAlpha } from "./admin-palette";

type AdminCard = AdminCardsResponse["cards"][number] | AdminCardDetail;

const SIZE_CONFIG = {
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
  medium: {
    width: 184,
    height: 276,
    paddingH: 7,
    paddingT: 5,
    paddingB: 3,
    headerFontSize: 10,
    hpIconSize: 36,
    nameFontSize: 11,
    charFontSize: 9,
    descFontSize: 8,
    descPadding: 5,
    descLineHeight: 11,
    speedHeight: 19,
    speedIconSize: 36,
    typeFontSize: 7,
    rarityFontSize: 6,
    borderRadius: 13,
    imageAspect: 5 / 3,
    headerHeight: 21,
    headerHpOffset: -18,
    headerHpTop: -3,
    descMarginTop: 4,
    descMinHeight: 34,
    nameMarginTop: 3,
    nameGap: 1,
    speedMarginTop: 2,
    speedIconTop: -14,
    typePaddingH: 7,
    typePaddingV: 2,
    rarityBadgeRadius: 5,
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
} as const;

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
  textColor,
  rarity,
}: {
  rarityName: string;
  cfg: (typeof SIZE_CONFIG)[keyof typeof SIZE_CONFIG];
  textColor: string;
  rarity: { from: string; to: string; ring: string };
}) {
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
        color={textColor}
      />
      <Text
        className="font-nunito-extrabold"
        style={{ color: textColor, fontSize: cfg.rarityFontSize }}
      >
        {label}
      </Text>
    </LinearGradient>
  );
}

export const AdminCardTile = memo(
  function AdminCardTile({
    card,
    onPress,
    size = "small",
    fitContainer = false,
  }: {
    card: AdminCard;
    onPress?: () => void;
    size?: "small" | "medium" | "large";
    fitContainer?: boolean;
  }) {
    const cfg = SIZE_CONFIG[size];
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
      frame: tc.muted,
      light: tc.surfaceMuted,
      dark: tc.fg,
    };
    const rarityColor = rarityPalette[card.rarityName] ?? {
      from: tc.muted,
      to: tc.fgMuted,
      ring: tc.muted,
    };
    const frameTextColor = pickReadableTextColor(
      typeColor.frame,
      tc.fg,
      tc.surface,
    );
    const typeBadgeTextColor = pickReadableTextColor(
      typeColor.dark,
      tc.fg,
      tc.surface,
    );
    const rarityTextColor = pickReadableTextColor(
      rarityColor.to,
      tc.fg,
      tc.surface,
    );
    const descriptionBg = withAlpha(
      tc.secondary,
      themeName === "nightosphere" ? "30" : "24",
    );

    const isLegendary = card.rarityName === "Legendary";
    const isEpic = card.rarityName === "Epic";
    const hasShimmer = isLegendary || isEpic;
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (!hasShimmer) {
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

    const shimmerColorPeak = isLegendary
      ? withAlpha(tc.secondary, "2E")
      : withAlpha(tc.accent, "29");
    const shimmerColorEdge = isLegendary
      ? withAlpha(tc.secondary, "00")
      : withAlpha(tc.accent, "00");
    const shimmerTranslate = shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-cfg.width * 3, cfg.width],
    });
    const cardAspectRatio = CARD_ART_RATIO;

    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={{
          width: fitContainer ? "100%" : cfg.width,
          opacity: card.isArchived ? 0.7 : onPress ? 1 : 0.98,
        }}
      >
        <View
          className="overflow-hidden"
          style={{
            borderRadius: cfg.borderRadius,
            backgroundColor: typeColor.frame,
            height: fitContainer ? undefined : cfg.height,
            aspectRatio: fitContainer ? cardAspectRatio : undefined,
          }}
        >
          <View
            pointerEvents="none"
            className="absolute inset-0 z-10"
            style={{
              borderRadius: cfg.borderRadius,
              borderWidth: 1,
              borderColor: card.isArchived
                ? withAlpha(tc.muted, "A6")
                : rarityColor.ring,
            }}
          />

          {hasShimmer ? (
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
          ) : null}

          {card.isArchived ? (
            <View className="absolute right-2 top-2 z-20 rounded-full bg-dangerDark/90 px-2 py-1">
              <Text
                className="font-nunito-extrabold text-[10px]"
                style={{
                  color: pickReadableTextColor(
                    tc.dangerDark,
                    tc.fg,
                    tc.surface,
                  ),
                }}
              >
                Archived
              </Text>
            </View>
          ) : null}

          <View
            className="flex-1"
            style={{
              paddingHorizontal: cfg.paddingH,
              paddingTop: cfg.paddingT,
              paddingBottom: cfg.paddingB,
            }}
          >
            <View
              className="relative mb-[2] flex-row items-center"
              style={{ height: cfg.headerHeight }}
            >
              <Text
                className="flex-1 text-center font-nunito-extrabold"
                style={{ color: frameTextColor, fontSize: cfg.headerFontSize }}
              >
                {card.attack} ATK
              </Text>
              <View
                style={{
                  position: "absolute",
                  left: "50%",
                  transform: [{ translateX: cfg.headerHpOffset }],
                  top: cfg.headerHpTop,
                  zIndex: 5,
                }}
              >
                <HPIcon size={cfg.hpIconSize} hpVal={card.hp} />
              </View>
              <Text
                className="flex-1 text-center font-nunito-bold"
                style={{ color: frameTextColor, fontSize: cfg.headerFontSize }}
              >
                {card.defense} DEF
              </Text>
            </View>

            <View
              className="relative overflow-hidden"
              style={{
                aspectRatio: cfg.imageAspect,
                borderRadius: cfg.rarityBadgeRadius,
              }}
            >
              {card.imageAssetId ? (
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
                  className="font-nunito-bold"
                  style={{
                    color: typeBadgeTextColor,
                    fontSize: cfg.typeFontSize,
                  }}
                >
                  {card.type}
                </Text>
              </View>

              <View
                className="absolute bottom-0 left-0 overflow-hidden"
                style={{ borderTopRightRadius: cfg.rarityBadgeRadius / 2 }}
              >
                <RarityCrest
                  rarity={rarityColor}
                  rarityName={card.rarityName}
                  cfg={cfg}
                  textColor={rarityTextColor}
                />
              </View>
            </View>

            <View
              className="items-center"
              style={{ marginTop: cfg.nameMarginTop, gap: cfg.nameGap }}
            >
              <Text
                className="font-nunito-bold"
                style={{ color: frameTextColor, fontSize: cfg.nameFontSize }}
                numberOfLines={1}
              >
                {card.name}
              </Text>
              <Text
                className="font-nunito-semibold italic"
                style={{
                  color: withAlpha(frameTextColor, "DB"),
                  fontSize: cfg.charFontSize,
                }}
                numberOfLines={1}
              >
                {card.character}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: descriptionBg,
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
                numberOfLines={size === "large" ? 6 : size === "medium" ? 5 : 4}
              >
                {card.description}
              </Text>
            </View>

            <View
              className="relative items-center justify-center"
              style={{
                height: cfg.speedHeight,
                marginTop: cfg.speedMarginTop,
              }}
            >
              <View style={{ position: "absolute", top: cfg.speedIconTop }}>
                <SpeedIcon size={cfg.speedIconSize} speedVal={card.speed} />
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.card.id === next.card.id &&
    prev.card.name === next.card.name &&
    prev.card.character === next.card.character &&
    prev.card.description === next.card.description &&
    prev.card.hp === next.card.hp &&
    prev.card.attack === next.card.attack &&
    prev.card.defense === next.card.defense &&
    prev.card.speed === next.card.speed &&
    prev.card.type === next.card.type &&
    prev.card.rarityId === next.card.rarityId &&
    prev.card.rarityName === next.card.rarityName &&
    prev.card.imageAssetId === next.card.imageAssetId &&
    prev.card.isArchived === next.card.isArchived &&
    prev.size === next.size &&
    prev.fitContainer === next.fitContainer &&
    prev.onPress === next.onPress,
);
