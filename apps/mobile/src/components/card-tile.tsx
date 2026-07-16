import { memo, useEffect, useMemo, useState } from "react";
import type {
  ColorValue,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

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

export type CardTileSize = "small" | "large";

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
  animationsEnabled?: boolean;
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
    typeIndicatorHeight: 15,
    typeIndicatorBottom: "6.5%",
    typeIndicatorFontSize: 6,
    typeIndicatorPaddingH: 5,
    typeIndicatorSide: "10%",
    nameFontSize: 9,
    characterFontSize: 7,
    titlePaddingH: 6,
    titlePaddingV: 5,
    descFontSize: 6.8,
    descLineHeight: 8.5,
    descPadding: 4,
    descLines: 7,
    quantityFontSize: 11,
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
    typeIndicatorHeight: 30,
    typeIndicatorBottom: "6.5%",
    typeIndicatorFontSize: 12,
    typeIndicatorPaddingH: 10,
    typeIndicatorSide: "10%",
    nameFontSize: 19,
    characterFontSize: 13,
    titlePaddingH: 14,
    titlePaddingV: 10,
    descFontSize: 12.2,
    descLineHeight: 16,
    descPadding: 10,
    descLines: 10,
    quantityFontSize: 13,
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
type PremiumRarityName = "Epic" | "Legendary";
type ShimmerLayout = { width: number; height: number };
type GradientColors = readonly [ColorValue, ColorValue, ...ColorValue[]];

const DEFAULT_ART_TITLE_GRADIENT_COLORS: GradientColors = [
  "rgba(0,0,0,0)",
  "rgba(0,0,0,0.28)",
  "rgba(0,0,0,0.62)",
];

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

const LOCKED_TYPE_PALETTE: Palette = {
  frame: "#6B7280",
  light: "#D1D5DB",
  dark: "#374151",
};

function LockedIllustration({
  cfg,
  imageAssetId,
}: {
  cfg: (typeof SIZE_CONFIG)[CardTileSize];
  imageAssetId?: string | null;
}) {
  const blurRadius = Math.max(28, cfg.nameFontSize * 2.2);

  return (
    <View
      className="flex-1 items-center justify-center overflow-hidden"
      style={{ backgroundColor: LOCKED_TYPE_PALETTE.light }}
    >
      {imageAssetId ? (
        <Image
          source={{
            uri: getCardImageUrl(imageAssetId),
            cacheKey: getCardImageCacheKey(imageAssetId),
          }}
          blurRadius={blurRadius}
          contentFit="cover"
          cachePolicy="memory-disk"
          style={{
            bottom: -14,
            left: -14,
            opacity: 0.72,
            position: "absolute",
            right: -14,
            top: -14,
          }}
        />
      ) : (
        <LinearGradient
          colors={["#E5E7EB", "#9CA3AF", "#4B5563"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, height: "100%", width: "100%" }}
        />
      )}
      <View
        pointerEvents="none"
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(229, 231, 235, 0.36)" }}
      />
    </View>
  );
}

function getShimmerTone(rarityName: PremiumRarityName) {
  if (rarityName === "Legendary") {
    return {
      wash: "rgba(255, 174, 26, 0.22)",
      washPeak: "rgba(255, 226, 82, 0.36)",
      beamEdge: "rgba(255, 197, 51, 0)",
      beamSoft: "rgba(255, 183, 36, 0.36)",
      beamPeak: "rgba(255, 247, 153, 0.78)",
      fleck: "rgba(255, 231, 122, 0.88)",
    };
  }

  return {
    wash: "rgba(124, 58, 237, 0.2)",
    washPeak: "rgba(217, 70, 239, 0.32)",
    beamEdge: "rgba(192, 132, 252, 0)",
    beamSoft: "rgba(168, 85, 247, 0.34)",
    beamPeak: "rgba(233, 181, 255, 0.72)",
    fleck: "rgba(216, 180, 254, 0.82)",
  };
}

function RarityShimmerOverlay({
  cfg,
  rarityName,
}: {
  cfg: (typeof SIZE_CONFIG)[CardTileSize];
  rarityName: PremiumRarityName;
}) {
  const tone = getShimmerTone(rarityName);
  const sweepAnim = useSharedValue(0);
  const pulseAnim = useSharedValue(0);
  const [layout, setLayout] = useState<ShimmerLayout>({
    width: cfg.width,
    height: cfg.height,
  });

  useEffect(() => {
    sweepAnim.value = 0;
    pulseAnim.value = 0;

    sweepAnim.value = withRepeat(
      withTiming(1, {
        duration: rarityName === "Legendary" ? 2300 : 2800,
        easing: Easing.inOut(Easing.cubic),
      }),
      -1,
      false,
    );
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: rarityName === "Legendary" ? 900 : 1200,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(0, {
          duration: rarityName === "Legendary" ? 1200 : 1500,
          easing: Easing.in(Easing.quad),
        }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(sweepAnim);
      cancelAnimation(pulseAnim);
    };
  }, [pulseAnim, rarityName, sweepAnim]);

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;

    if (
      width > 0 &&
      height > 0 &&
      (Math.abs(width - layout.width) > 0.5 ||
        Math.abs(height - layout.height) > 0.5)
    ) {
      setLayout({ width, height });
    }
  };

  const beamWidth = Math.max(30, layout.width * 0.24);
  const beamHeight = layout.height * 1.55;
  const leadPeakOpacity = rarityName === "Legendary" ? 0.82 : 0.66;
  const trailPeakOpacity = rarityName === "Legendary" ? 0.36 : 0.26;
  const washPeakOpacity = rarityName === "Legendary" ? 0.62 : 0.48;
  const fleckPeakOpacity = rarityName === "Legendary" ? 0.7 : 0.44;
  const leadBeamStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      sweepAnim.value,
      [0, 0.12, 0.48, 0.86, 1],
      [0, 0.24, leadPeakOpacity, 0.2, 0],
    ),
    transform: [
      {
        translateX: interpolate(
          sweepAnim.value,
          [0, 1],
          [-layout.width * 0.45 - beamWidth, layout.width * 1.08],
        ),
      },
      { rotate: "-18deg" },
    ],
  }));
  const trailBeamStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      sweepAnim.value,
      [0, 0.24, 0.62, 1],
      [0, 0.18, trailPeakOpacity, 0],
    ),
    transform: [
      {
        translateX: interpolate(
          sweepAnim.value,
          [0, 1],
          [-layout.width * 0.86 - beamWidth, layout.width * 0.78],
        ),
      },
      { rotate: "-18deg" },
    ],
  }));
  const washStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseAnim.value, [0, 1], [0.28, washPeakOpacity]),
  }));
  const fleckStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      pulseAnim.value,
      [0, 0.45, 1],
      [0.12, fleckPeakOpacity, 0.18],
    ),
  }));
  const fleckGrowStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(pulseAnim.value, [0, 1], [0.7, 1.25]),
      },
    ],
  }));
  const fleckShrinkStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(pulseAnim.value, [0, 1], [1.15, 0.75]),
      },
    ],
  }));
  const legendaryFleckStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(pulseAnim.value, [0, 1], [0.8, 1.35]),
      },
    ],
  }));

  return (
    <View
      pointerEvents="none"
      onLayout={handleLayout}
      className="absolute inset-0 overflow-hidden"
      style={{ zIndex: 35 }}
    >
      <Animated.View className="absolute inset-0" style={washStyle}>
        <LinearGradient
          colors={[tone.wash, "rgba(255,255,255,0)", tone.washPeak]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <Animated.View
        style={[
          {
            height: beamHeight,
            left: 0,
            position: "absolute",
            top: -layout.height * 0.28,
            width: beamWidth,
          },
          leadBeamStyle,
        ]}
      >
        <LinearGradient
          colors={[
            tone.beamEdge,
            tone.beamSoft,
            tone.beamPeak,
            tone.beamSoft,
            tone.beamEdge,
          ]}
          locations={[0, 0.28, 0.5, 0.72, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <Animated.View
        style={[
          {
            height: beamHeight,
            left: 0,
            position: "absolute",
            top: -layout.height * 0.18,
            width: Math.max(18, beamWidth * 0.55),
          },
          trailBeamStyle,
        ]}
      >
        <LinearGradient
          colors={[tone.beamEdge, tone.beamSoft, tone.beamEdge]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <Animated.View
        className="absolute rounded-full"
        style={[
          {
            backgroundColor: tone.fleck,
            height: Math.max(2, layout.width * 0.018),
            left: "18%",
            top: "19%",
            width: Math.max(2, layout.width * 0.018),
          },
          fleckStyle,
          fleckGrowStyle,
        ]}
      />
      <Animated.View
        className="absolute rounded-full"
        style={[
          {
            backgroundColor: tone.fleck,
            height: Math.max(2, layout.width * 0.012),
            right: "17%",
            top: "52%",
            width: Math.max(2, layout.width * 0.012),
          },
          fleckStyle,
          fleckShrinkStyle,
        ]}
      />
      {rarityName === "Legendary" ? (
        <Animated.View
          className="absolute rounded-full"
          style={[
            {
              backgroundColor: tone.fleck,
              bottom: "20%",
              height: Math.max(2, layout.width * 0.015),
              right: "28%",
              width: Math.max(2, layout.width * 0.015),
            },
            fleckStyle,
            legendaryFleckStyle,
          ]}
        />
      ) : null}
    </View>
  );
}

type CardFaceProps = {
  animationsEnabled: boolean;
  card: CardTileCard;
  cardContentOpacity: number;
  cfg: (typeof SIZE_CONFIG)[CardTileSize];
  descriptionPanelStyle: ViewStyle;
  descriptionTextColor: string;
  fitContainer: boolean;
  frameSource: ReturnType<typeof getCardOutlineSource>;
  isArchived: boolean;
  isLocked: boolean;
  premiumRarityName: PremiumRarityName | null;
  rarityColor: RarityPalette;
  size: CardTileSize;
  themeName: ThemeName;
  typeColor: Palette;
  typeIndicatorStyle: ViewStyle;
  typeIndicatorTextColor: string;
};

function CardFace({
  animationsEnabled,
  card,
  cardContentOpacity,
  cfg,
  descriptionPanelStyle,
  descriptionTextColor,
  fitContainer,
  frameSource,
  isArchived,
  isLocked,
  premiumRarityName,
  rarityColor,
  size,
  themeName,
  typeColor,
  typeIndicatorStyle,
  typeIndicatorTextColor,
}: CardFaceProps) {
  return (
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
            <LockedIllustration cfg={cfg} imageAssetId={card.imageAssetId} />
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

          {!isLocked ? (
            <LinearGradient
              pointerEvents="none"
              colors={DEFAULT_ART_TITLE_GRADIENT_COLORS}
              className="absolute inset-x-0 bottom-0"
              style={{ height: "48%" }}
            />
          ) : null}

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
              {card.name}
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
              {card.character}
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
            {isLocked ? "" : card.description}
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
          {isLocked ? "????" : card.type}
        </Text>
      </LinearGradient>

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

      {premiumRarityName && animationsEnabled ? (
        <RarityShimmerOverlay cfg={cfg} rarityName={premiumRarityName} />
      ) : null}

      {isArchived ? (
        <View className="absolute right-3 top-3 z-40 rounded-full bg-dangerDark/90 px-2 py-1">
          <Text className="font-nunito-extrabold text-[10px] text-white">
            Archived
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const CardTile = memo(function CardTile(props: CardTileProps) {
  const {
    accessToken: _accessToken,
    animationsEnabled = true,
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
  const typeColor = isLocked
    ? LOCKED_TYPE_PALETTE
    : (typePalette[card.type] ?? {
        frame: tc.muted,
        light: tc.surfaceMuted,
        dark: tc.fg,
      });
  const rarityColor = rarityPalette[card.rarityName] ?? {
    from: tc.muted,
    to: tc.fgMuted,
    ring: tc.muted,
  };
  const isArchived = Boolean(card.isArchived);
  const isLegendary = displayRarityName === "Legendary";
  const isEpic = displayRarityName === "Epic";
  const premiumRarityName: PremiumRarityName | null = isLegendary
    ? "Legendary"
    : isEpic
      ? "Epic"
      : null;
  const cardContentOpacity = muted || isArchived ? 0.58 : 1;
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

  const bounceAnim = useSharedValue(0);
  useEffect(() => {
    if (!animationsEnabled || size !== "small" || quantity <= 1) {
      cancelAnimation(bounceAnim);
      bounceAnim.value = 0;
      return;
    }

    bounceAnim.value = withRepeat(
      withSequence(
        withTiming(-5, {
          duration: 400,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(0, {
          duration: 400,
          easing: Easing.in(Easing.quad),
        }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(bounceAnim);
      bounceAnim.value = 0;
    };
  }, [animationsEnabled, bounceAnim, quantity, size]);
  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounceAnim.value }],
  }));

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
      borderRadius: cfg.typeIndicatorHeight,
      height: cfg.typeIndicatorHeight,
      justifyContent: "center",
      left: cfg.typeIndicatorSide,
      paddingHorizontal: cfg.typeIndicatorPaddingH,
      position: "absolute",
      right: cfg.typeIndicatorSide,
    }),
    [cfg],
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
      <CardFace
        animationsEnabled={animationsEnabled}
        card={card}
        cardContentOpacity={cardContentOpacity}
        cfg={cfg}
        descriptionPanelStyle={descriptionPanelStyle}
        descriptionTextColor={descriptionTextColor}
        fitContainer={fitContainer}
        frameSource={frameSource}
        isArchived={isArchived}
        isLocked={isLocked}
        premiumRarityName={premiumRarityName}
        rarityColor={rarityColor}
        size={size}
        themeName={themeName}
        typeColor={typeColor}
        typeIndicatorStyle={typeIndicatorStyle}
        typeIndicatorTextColor={typeIndicatorTextColor}
      />

      {size === "small" &&
        (quantity > 1 ? (
          <Animated.View
            style={[
              {
                alignItems: "center",
                marginTop: 4,
              },
              bounceStyle,
            ]}
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
                style={{ fontSize: 12 }}
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
                style={{ fontSize: 12 }}
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
