import { memo, useEffect, useMemo, useRef } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import type { CollectionResponse } from "@adventure-time/api-client";

import { CARD_ART_RATIO } from "./card-back-cover-art";
import type { CardBackcoverRarityName } from "./card-back-cover-art";
import { getCardOutlineSource } from "./card-outline-frame";
import {
  CARD_TYPE_COLORS,
  CARD_TYPE_COLORS_ICE,
  CARD_TYPE_COLORS_NIGHTOSPHERE,
  RARITY_COLORS,
  RARITY_COLORS_ICE,
  RARITY_COLORS_NIGHTOSPHERE,
} from "./theme";
import { useTranslation } from "../i18n";
import { getCardImageCacheKey, getCardImageUrl } from "../lib/card-images";
import { useThemeStore } from "../stores/theme-store";
import type { ThemeName } from "../theme/themes";
import { THEME_COLORS } from "../theme/themes";

type CollectionEntry = CollectionResponse["cards"][number];

export type CardTileSize = "small" | "medium" | "large";

export type CardTileCard = {
  id?: string;
  name: string;
  character: string;
  description: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  type: string;
  rarityName: string;
  imageAssetId?: string | null;
  isArchived?: boolean;
};

interface CardTileProps {
  card?: CardTileCard;
  entry?: CollectionEntry;
  quantity?: number;
  isLocked?: boolean;
  accessToken?: string | null;
  onPress?: () => void;
  onRecycle?: () => void;
  onCraft?: () => void;
  muted?: boolean;
  size?: CardTileSize;
  fitContainer?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

const SIZE_CONFIG = {
  small: {
    width: 152,
    height: 228,
    borderRadius: 12,
    fillLeft: "9.5%",
    fillRight: "9.5%",
    fillTop: "7.5%",
    fillBottom: "7.5%",
    contentLeft: "14%",
    contentRight: "14%",
    contentTop: "17.5%",
    contentBottom: "14.5%",
    gap: 4,
    panelRadius: 6,
    artFlex: 1.08,
    artMinHeight: 84,
    descFlex: 0.9,
    descMinHeight: 60,
    typeIndicatorHeight: 8,
    typeIndicatorBottom: "9.4%",
    typeIndicatorFontSize: 5.1,
    typeIndicatorPaddingH: 4,
    typeIndicatorSide: "33%",
    nameFontSize: 9,
    characterFontSize: 7,
    titlePaddingH: 6,
    titlePaddingV: 5,
    descFontSize: 6.8,
    descLineHeight: 8.5,
    descPadding: 4,
    descLines: 7,
    quantityFontSize: 11,
    shimmerWidthMultiplier: 3,
  },
  medium: {
    width: 184,
    height: 276,
    borderRadius: 14,
    fillLeft: "9.5%",
    fillRight: "9.5%",
    fillTop: "7.5%",
    fillBottom: "7.5%",
    contentLeft: "14%",
    contentRight: "14%",
    contentTop: "17.5%",
    contentBottom: "14.5%",
    gap: 5,
    panelRadius: 8,
    artFlex: 1.08,
    artMinHeight: 104,
    descFlex: 0.92,
    descMinHeight: 74,
    typeIndicatorHeight: 10,
    typeIndicatorBottom: "9.4%",
    typeIndicatorFontSize: 6.2,
    typeIndicatorPaddingH: 5,
    typeIndicatorSide: "33%",
    nameFontSize: 11,
    characterFontSize: 8.5,
    titlePaddingH: 8,
    titlePaddingV: 6,
    descFontSize: 7.8,
    descLineHeight: 9.6,
    descPadding: 5,
    descLines: 7,
    quantityFontSize: 12,
    shimmerWidthMultiplier: 3,
  },
  large: {
    width: 320,
    height: 480,
    borderRadius: 22,
    fillLeft: "9.5%",
    fillRight: "9.5%",
    fillTop: "7.5%",
    fillBottom: "7.5%",
    contentLeft: "14%",
    contentRight: "14%",
    contentTop: "18.75%",
    contentBottom: "13.75%",
    gap: 10,
    panelRadius: 14,
    artFlex: 1.0,
    artMinHeight: 178,
    descFlex: 1.12,
    descMinHeight: 142,
    typeIndicatorHeight: 14,
    typeIndicatorBottom: "9.4%",
    typeIndicatorFontSize: 8.6,
    typeIndicatorPaddingH: 10,
    typeIndicatorSide: "33%",
    nameFontSize: 19,
    characterFontSize: 13,
    titlePaddingH: 14,
    titlePaddingV: 10,
    descFontSize: 12.2,
    descLineHeight: 16,
    descPadding: 10,
    descLines: 10,
    quantityFontSize: 13,
    shimmerWidthMultiplier: 3,
  },
} as const;

const RARITY_NAMES: CardBackcoverRarityName[] = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
];

type Palette = {
  frame: string;
  light: string;
  dark: string;
};

type RarityPalette = {
  from: string;
  to: string;
  ring: string;
};

type Rgb = { r: number; g: number; b: number };

function normalizeEntry(entry: CollectionEntry): CardTileCard {
  return {
    id: entry.card.id,
    name: entry.card.name,
    character: entry.card.character,
    description: entry.card.description,
    hp: entry.card.hp,
    attack: entry.card.attack,
    defense: entry.card.defense,
    speed: entry.card.speed,
    type: entry.card.type,
    rarityName: entry.card.rarity.name,
    imageAssetId: entry.card.imageAssetId,
  };
}

function toRarityName(rarityName: string): CardBackcoverRarityName {
  return RARITY_NAMES.includes(rarityName as CardBackcoverRarityName)
    ? (rarityName as CardBackcoverRarityName)
    : "Common";
}

function getTypePalette(themeName: ThemeName) {
  if (themeName === "ice") {
    return CARD_TYPE_COLORS_ICE;
  }

  if (themeName === "nightosphere") {
    return CARD_TYPE_COLORS_NIGHTOSPHERE;
  }

  return CARD_TYPE_COLORS;
}

function getRarityPalette(themeName: ThemeName) {
  if (themeName === "ice") {
    return RARITY_COLORS_ICE;
  }

  if (themeName === "nightosphere") {
    return RARITY_COLORS_NIGHTOSPHERE;
  }

  return RARITY_COLORS;
}

function parseHex(color: string): Rgb | null {
  const normalized = color.replace("#", "");

  if (normalized.length !== 6 && normalized.length !== 8) {
    return null;
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function parseRgb(color: string): Rgb | null {
  const match = color.match(/^rgba?\(([^)]+)\)$/);
  if (!match) {
    return null;
  }

  const [r, g, b] = match[1]
    .split(",")
    .slice(0, 3)
    .map((part) => Number.parseFloat(part.trim()));

  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return null;
  }

  return { r, g, b };
}

function toRgb(color: string): Rgb | null {
  if (color.startsWith("#")) {
    return parseHex(color);
  }

  return parseRgb(color);
}

function luminance({ r, g, b }: Rgb) {
  const channels = [r, g, b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string, b: string) {
  const rgbA = toRgb(a);
  const rgbB = toRgb(b);

  if (!rgbA || !rgbB) {
    return 1;
  }

  const light = Math.max(luminance(rgbA), luminance(rgbB));
  const dark = Math.min(luminance(rgbA), luminance(rgbB));

  return (light + 0.05) / (dark + 0.05);
}

function pickReadableTextColor(
  background: string,
  darkText: string,
  lightText: string,
) {
  return contrastRatio(background, darkText) >=
    contrastRatio(background, lightText)
    ? darkText
    : lightText;
}

function withAlpha(color: string, alpha: string) {
  const opacity = Number.parseInt(alpha, 16) / 255;

  if (color.startsWith("#")) {
    if (color.length === 7) {
      return `${color}${alpha}`;
    }

    if (color.length === 9) {
      return `${color.slice(0, 7)}${alpha}`;
    }
  }

  const rgb = toRgb(color);
  if (!rgb) {
    return color;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

function LockedIllustration({
  cfg,
  typeColor,
  rarityColor,
  textColor,
  label,
}: {
  cfg: (typeof SIZE_CONFIG)[CardTileSize];
  typeColor: Palette;
  rarityColor: RarityPalette;
  textColor: string;
  label: string;
}) {
  return (
    <LinearGradient
      colors={[typeColor.dark, rarityColor.ring, typeColor.frame]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="flex-1 items-center justify-center"
      style={{ gap: 4 }}
    >
      <Text
        className="font-nunito-extrabold"
        style={{ color: textColor, fontSize: cfg.nameFontSize * 2.8 }}
      >
        ?
      </Text>
      <Text
        className="font-nunito-bold"
        numberOfLines={1}
        style={{ color: textColor, fontSize: cfg.characterFontSize }}
      >
        {label}
      </Text>
    </LinearGradient>
  );
}

export const CardTile = memo(function CardTile(props: CardTileProps) {
  const {
    accessToken: _accessToken,
    onPress,
    onRecycle,
    onCraft,
    muted = false,
    fitContainer = false,
    containerStyle,
    testID,
  } = props;
  const size = props.size ?? "small";
  const cfg = SIZE_CONFIG[size];
  const entry = props.entry;
  const card = props.card ?? (entry ? normalizeEntry(entry) : undefined);
  if (!card) {
    throw new Error("CardTile requires either a card or collection entry.");
  }

  const quantity = entry?.quantity ?? props.quantity ?? 1;
  const { t } = useTranslation();
  const themeName = useThemeStore((s) => s.themeName);
  const tc = THEME_COLORS[themeName];
  const isLocked = props.isLocked ?? quantity <= 0;
  const displayRarityName = toRarityName(card.rarityName);
  const typePalette = getTypePalette(themeName);
  const rarityPalette = getRarityPalette(themeName);
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
  const isArchived = Boolean(card.isArchived);
  const isLegendary = displayRarityName === "Legendary";
  const isEpic = displayRarityName === "Epic";
  const hasShimmer = isLegendary || isEpic;
  const cardContentOpacity = muted || isArchived ? 0.58 : 1;
  const badgeTextColor = pickReadableTextColor(typeColor.dark, tc.fg, "#FFFFFF");
  const typeIndicatorTextColor = pickReadableTextColor(
    typeColor.dark,
    tc.fg,
    "#FFFFFF",
  );
  const descriptionTextColor = pickReadableTextColor(
    typeColor.light,
    tc.fg,
    "#FFFFFF",
  );
  const frameSource = getCardOutlineSource(themeName, displayRarityName);

  const bounceAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (size !== "small" || quantity <= 1) {
      return;
    }

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
  }, [bounceAnim, quantity, size]);

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
    ? "rgba(255, 231, 122, 0.23)"
    : "rgba(202, 132, 255, 0.2)";
  const shimmerColorEdge = isLegendary
    ? "rgba(255, 231, 122, 0)"
    : "rgba(202, 132, 255, 0)";
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-cfg.width * cfg.shimmerWidthMultiplier, cfg.width],
  });
  const descriptionPanelStyle = useMemo<ViewStyle>(
    () => ({
      flex: cfg.descFlex,
      minHeight: cfg.descMinHeight,
      paddingHorizontal: cfg.descPadding,
      paddingVertical: Math.max(2, cfg.descPadding * 0.5),
    }),
    [cfg],
  );
  const typeIndicatorStyle = useMemo<ViewStyle>(
    () => ({
      alignItems: "center",
      bottom: cfg.typeIndicatorBottom,
      borderColor: withAlpha(rarityColor.ring, "D9"),
      borderRadius: cfg.typeIndicatorHeight,
      borderWidth: 1,
      height: cfg.typeIndicatorHeight,
      justifyContent: "center",
      left: cfg.typeIndicatorSide,
      paddingHorizontal: cfg.typeIndicatorPaddingH,
      position: "absolute",
      right: cfg.typeIndicatorSide,
      zIndex: 35,
    }),
    [cfg, rarityColor.ring],
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      style={[
        {
          width: fitContainer ? "100%" : cfg.width,
          margin: fitContainer ? 0 : size === "small" ? 4 : 0,
        },
        containerStyle,
      ]}
    >
      <View
        className="overflow-hidden"
        style={{
          borderRadius: cfg.borderRadius,
          backgroundColor: "transparent",
          height: fitContainer ? undefined : cfg.height,
          aspectRatio: fitContainer ? CARD_ART_RATIO : undefined,
          boxShadow:
            size === "large"
              ? `0px 14px 30px ${withAlpha(rarityColor.ring, "2E")}`
              : `0px 6px 14px ${withAlpha(rarityColor.ring, "24")}`,
        }}
      >
        <View
          className="absolute overflow-hidden"
          style={{
            left: cfg.fillLeft,
            right: cfg.fillRight,
            top: cfg.fillTop,
            bottom: cfg.fillBottom,
            borderRadius: cfg.panelRadius,
          }}
        >
          <LinearGradient
            colors={[
              withAlpha(typeColor.frame, "E8"),
              typeColor.light,
              withAlpha(typeColor.frame, "D9"),
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </View>

        <View
          className="absolute"
          style={{
            left: cfg.contentLeft,
            right: cfg.contentRight,
            top: cfg.contentTop,
            bottom: cfg.contentBottom,
            gap: cfg.gap,
            opacity: cardContentOpacity,
          }}
        >
          <View
            className="overflow-hidden"
            style={{
              flex: cfg.artFlex,
              minHeight: cfg.artMinHeight,
              borderRadius: cfg.panelRadius,
              borderWidth: 1,
              borderColor: withAlpha(rarityColor.ring, "99"),
              backgroundColor: typeColor.light,
            }}
          >
            {isLocked ? (
              <LockedIllustration
                cfg={cfg}
                typeColor={typeColor}
                rarityColor={rarityColor}
                textColor={badgeTextColor}
                label={t("collection.locked.illustration")}
              />
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

            <LinearGradient
              pointerEvents="none"
              colors={[
                "rgba(0,0,0,0)",
                "rgba(0,0,0,0.28)",
                "rgba(0,0,0,0.62)",
              ]}
              className="absolute inset-x-0 bottom-0"
              style={{ height: "48%" }}
            />

            <View
              className="absolute bottom-0 left-0 right-0 items-center"
              style={{
                paddingHorizontal: cfg.titlePaddingH,
                paddingBottom: cfg.titlePaddingV,
                paddingTop: cfg.titlePaddingV * 1.4,
              }}
            >
              <Text
                className="font-nunito-extrabold"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                style={{
                  color: "#FFFFFF",
                  fontSize: cfg.nameFontSize,
                  textAlign: "center",
                  textShadowColor: "rgba(0,0,0,0.55)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }}
              >
                {isLocked ? t("collection.locked.title") : card.name}
              </Text>
              <Text
                className="font-nunito-semibold italic"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                style={{
                  color: "rgba(255, 255, 255, 0.86)",
                  fontSize: cfg.characterFontSize,
                  textAlign: "center",
                  textShadowColor: "rgba(0,0,0,0.55)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }}
              >
                {isLocked ? displayRarityName : card.character}
              </Text>
            </View>
          </View>

          <View style={descriptionPanelStyle}>
            <Text
              className="font-nunito-semibold"
              numberOfLines={cfg.descLines}
              style={{
                color: descriptionTextColor,
                flexShrink: 1,
                fontSize: cfg.descFontSize,
                lineHeight: cfg.descLineHeight,
                textShadowColor:
                  themeName === "nightosphere"
                    ? "rgba(0,0,0,0.28)"
                    : "rgba(255,255,255,0.28)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 1,
              }}
            >
              {isLocked ? t("collection.locked.description") : card.description}
            </Text>
          </View>
        </View>

        <LinearGradient
          pointerEvents="none"
          colors={[
            withAlpha(typeColor.dark, "F2"),
            typeColor.frame,
            withAlpha(typeColor.dark, "F2"),
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="absolute items-center justify-center"
          style={typeIndicatorStyle}
        >
          <Text
            className="font-nunito-extrabold"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            style={{
              color: typeIndicatorTextColor,
              fontSize: cfg.typeIndicatorFontSize,
              textAlign: "center",
            }}
          >
            {card.type}
          </Text>
        </LinearGradient>

        {hasShimmer ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              height: cfg.height,
              width: cfg.width * cfg.shimmerWidthMultiplier,
              transform: [{ translateX: shimmerTranslate }],
              zIndex: 20,
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

        <Image
          pointerEvents="none"
          source={frameSource}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 30,
          }}
          contentFit="fill"
        />

        {isArchived ? (
          <View className="absolute right-3 top-3 z-40 rounded-full bg-dangerDark/90 px-2 py-1">
            <Text className="font-nunito-extrabold text-[10px] text-white">
              Archived
            </Text>
          </View>
        ) : null}
      </View>

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
              className="items-center rounded-full"
              style={{
                backgroundColor: rarityColor.ring,
                paddingHorizontal: 10,
                paddingVertical: 2,
                width: 50,
              }}
            >
              <Text
                className="font-nunito-bold text-white"
                style={{ fontSize: cfg.quantityFontSize }}
              >
                x{quantity}
              </Text>
            </View>
          </Animated.View>
        ) : muted || isLocked ? (
          <View className="items-center" style={{ marginTop: 4 }}>
            <View
              className="items-center rounded-full border border-primaryBorder bg-surfaceMuted"
              style={{
                paddingHorizontal: 10,
                paddingVertical: 2,
                minWidth: 76,
              }}
            >
              <Text
                className="font-nunito-bold text-fgMuted"
                style={{ fontSize: 12 }}
              >
                {t("collection.notOwned")}
              </Text>
            </View>
          </View>
        ) : (
          <View className="h-5" />
        ))}

      {onRecycle || onCraft ? (
        <View className="mt-1 flex-row gap-1">
          {onRecycle ? (
            <Pressable
              onPress={onRecycle}
              className="flex-1 items-center rounded-lg border border-primaryBorder"
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
              className="flex-1 items-center rounded-lg border border-primaryBorder"
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
