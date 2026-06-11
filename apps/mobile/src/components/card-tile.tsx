import { memo, useEffect, useRef } from "react";
import type { ComponentType } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import type { CollectionResponse } from "@adventure-time/api-client";

import { CARD_ART_RATIO } from "./card-back-cover-art";
import {
  AttackStatIcon,
  DefenseStatIcon,
  HealthStatIcon,
  RarityIcon,
  SpeedStatIcon,
} from "./icons";
import { getCardImageCacheKey, getCardImageUrl } from "../lib/card-images";
import { useThemeStore } from "../stores/theme-store";
import { THEME_COLORS } from "../theme/themes";
import {
  CARD_TYPE_COLORS,
  CARD_TYPE_COLORS_ICE,
  CARD_TYPE_COLORS_NIGHTOSPHERE,
  RARITY_COLORS,
  RARITY_COLORS_ICE,
  RARITY_COLORS_NIGHTOSPHERE,
} from "./theme";

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
    outerPadding: 5,
    innerPadding: 7,
    borderRadius: 16,
    innerRadius: 13,
    artRadius: 11,
    badgeFontSize: 6,
    badgeIconSize: 8,
    badgePaddingH: 7,
    badgePaddingV: 4,
    nameFontSize: 11,
    characterFontSize: 7,
    statValueFontSize: 12,
    statLabelFontSize: 5,
    statRadius: 10,
    statPaddingY: 6,
    statPaddingX: 6,
    statGap: 4,
    statIconSize: 16,
    statOrbSize: 24,
    statValueLineHeight: 13,
    descriptionFontSize: 7,
    descriptionLineHeight: 10,
    descriptionPadding: 6,
    descriptionLines: 3,
    descriptionHeight: 46,
    quantityFontSize: 9,
    quantityPaddingH: 8,
    quantityPaddingV: 4,
    metaGap: 7,
    titleBottomPadding: 8,
    bodyGap: 6,
  },
  large: {
    width: 320,
    height: 480,
    outerPadding: 9,
    innerPadding: 14,
    borderRadius: 24,
    innerRadius: 20,
    artRadius: 16,
    badgeFontSize: 10,
    badgeIconSize: 12,
    badgePaddingH: 12,
    badgePaddingV: 6,
    nameFontSize: 21,
    characterFontSize: 12,
    statValueFontSize: 20,
    statLabelFontSize: 8,
    statRadius: 16,
    statPaddingY: 10,
    statPaddingX: 10,
    statGap: 8,
    statIconSize: 26,
    statOrbSize: 38,
    statValueLineHeight: 21,
    descriptionFontSize: 13,
    descriptionLineHeight: 18,
    descriptionPadding: 10,
    descriptionLines: 4,
    descriptionHeight: 96,
    quantityFontSize: 13,
    quantityPaddingH: 12,
    quantityPaddingV: 6,
    metaGap: 12,
    titleBottomPadding: 12,
    bodyGap: 10,
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

function RarityRibbon({
  rarityName,
  rarity,
  compact,
  cfg,
}: {
  rarityName: string;
  rarity: { from: string; to: string; ring: string };
  compact: boolean;
  cfg: (typeof sizeConfig)[keyof typeof sizeConfig];
}) {
  const label = compact
    ? (COMPACT_LABELS[rarityName] ?? rarityName.slice(0, 3).toUpperCase())
    : rarityName;

  return (
    <LinearGradient
      colors={[rarity.from, rarity.to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 999,
        paddingHorizontal: cfg.badgePaddingH,
        paddingVertical: cfg.badgePaddingV,
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 4 : 6,
      }}
    >
      <RarityIcon rarityName={rarityName} size={cfg.badgeIconSize} color="#FFF9F2" />
      <Text
        className="font-nunito-extrabold text-white"
        style={{ fontSize: cfg.badgeFontSize }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </LinearGradient>
  );
}

function StatChip({
  label,
  value,
  colors,
  Icon,
  cfg,
}: {
  label: string;
  value: string | number;
  colors: [string, string];
  Icon: ComponentType<{ size?: number }>;
  cfg: (typeof sizeConfig)[keyof typeof sizeConfig];
}) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: cfg.statRadius,
        paddingVertical: cfg.statPaddingY,
        paddingHorizontal: cfg.statPaddingX,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: withAlpha(colors[0], 0.13),
        borderWidth: 1,
        borderColor: withAlpha(colors[1], 0.2),
      }}
    >
      <LinearGradient
        colors={[withAlpha(colors[0], 0.22), withAlpha(colors[1], 0.38)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: cfg.statOrbSize,
          height: cfg.statOrbSize,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 4,
        }}
      >
        <Icon size={cfg.statIconSize} />
      </LinearGradient>
      <Text
        className="font-nunito-extrabold"
        style={{
          fontSize: cfg.statValueFontSize,
          lineHeight: cfg.statValueLineHeight,
          color: colors[1],
        }}
      >
        {value}
      </Text>
      <Text
        className="font-nunito-extrabold"
        style={{
          fontSize: cfg.statLabelFontSize,
          letterSpacing: 0.7,
          marginTop: 2,
          color: withAlpha(colors[1], 0.84),
        }}
      >
        {label}
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
  const cardAspectRatio = CARD_ART_RATIO;
  const isLegendary = card.rarity.name === "Legendary";
  const isEpic = card.rarity.name === "Epic";
  const hasShimmer = isLegendary || isEpic;
  const panelColor =
    themeName === "nightosphere"
      ? withAlpha(tc.surface, 0.94)
      : withAlpha("#FFF8F0", 0.94);
  const descriptionColor =
    themeName === "nightosphere"
      ? withAlpha(typeColor.light, 0.44)
      : withAlpha(typeColor.light, 0.76);
  const statPalettes: Array<{
    label: string;
    value: string | number;
    colors: [string, string];
    Icon: ComponentType<{ size?: number }>;
  }> = [
    { label: "ATK", value: card.attack, colors: [tc.secondaryDark, tc.danger], Icon: AttackStatIcon },
    { label: "HP", value: card.hp, colors: [tc.danger, tc.dangerDark], Icon: HealthStatIcon },
    { label: "DEF", value: card.defense, colors: [tc.info, tc.infoDark], Icon: DefenseStatIcon },
    { label: "SPD", value: card.speed, colors: [tc.success, tc.successDark], Icon: SpeedStatIcon },
  ];

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
          backgroundColor: rarityColor.ring,
          height: fitContainer ? undefined : cfg.height,
          aspectRatio: fitContainer ? cardAspectRatio : undefined,
          boxShadow:
            size === "large"
              ? `0px 18px 42px ${withAlpha(rarityColor.to, 0.22)}`
              : `0px 10px 24px ${withAlpha(rarityColor.to, 0.18)}`,
        }}
      >
        <LinearGradient
          colors={[rarityColor.from, typeColor.frame, rarityColor.to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />

        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -cfg.width * 0.12,
            right: -cfg.width * 0.05,
            width: cfg.width * 0.5,
            height: cfg.width * 0.5,
            borderRadius: 999,
            backgroundColor: withAlpha("#FFFFFF", themeName === "nightosphere" ? 0.05 : 0.16),
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: -cfg.width * 0.18,
            left: -cfg.width * 0.08,
            width: cfg.width * 0.45,
            height: cfg.width * 0.45,
            borderRadius: 999,
            backgroundColor: withAlpha(typeColor.light, themeName === "nightosphere" ? 0.12 : 0.32),
          }}
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
                withAlpha(isLegendary ? tc.secondary : tc.accent, isLegendary ? 0.18 : 0.16),
                withAlpha("#FFFFFF", 0),
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        ) : null}

        <View
          style={{
            flex: 1,
            margin: cfg.outerPadding,
            borderRadius: cfg.innerRadius,
            padding: cfg.innerPadding,
            backgroundColor: panelColor,
            borderWidth: 1,
            borderColor: withAlpha("#FFFFFF", themeName === "nightosphere" ? 0.1 : 0.42),
          }}
        >
          <View
            className="overflow-hidden"
            style={{
              flex: size === "large" ? 1.55 : 1.38,
              borderRadius: cfg.artRadius,
              backgroundColor: typeColor.light,
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
                    fontSize: cfg.nameFontSize * 2.4,
                  }}
                >
                  {(card.character || card.name || "?").charAt(0)}
                </Text>
              </View>
            )}

            <LinearGradient
              colors={[
                withAlpha("#120914", 0),
                withAlpha("#120914", 0.22),
                withAlpha("#120914", 0.88),
              ]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ position: "absolute", inset: 0 }}
            />

            <View
              style={{
                position: "absolute",
                top: cfg.innerPadding,
                left: cfg.innerPadding,
                right: cfg.innerPadding,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <View
                style={{
                  borderRadius: 999,
                  paddingHorizontal: cfg.badgePaddingH,
                  paddingVertical: cfg.badgePaddingV,
                  backgroundColor: withAlpha(typeColor.dark, themeName === "nightosphere" ? 0.9 : 0.84),
                  maxWidth: "54%",
                }}
              >
                <Text
                  className="font-nunito-extrabold text-white"
                  style={{ fontSize: cfg.badgeFontSize }}
                  numberOfLines={1}
                >
                  {card.type}
                </Text>
              </View>

              <RarityRibbon
                rarityName={card.rarity.name}
                rarity={rarityColor}
                compact={size === "small"}
                cfg={cfg}
              />
            </View>

            {size === "small" && quantity > 1 ? (
              <Animated.View
                style={{
                  position: "absolute",
                  top: cfg.innerPadding + 22,
                  right: cfg.innerPadding,
                  transform: [{ translateY: bounceAnim }],
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

            <View
              style={{
                position: "absolute",
                left: cfg.innerPadding,
                right: cfg.innerPadding,
                bottom: cfg.titleBottomPadding,
                gap: 2,
              }}
            >
              <Text
                className="font-nunito-extrabold text-white"
                style={{
                  fontSize: cfg.nameFontSize,
                  textShadowColor: withAlpha("#120914", 0.6),
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 5,
                }}
                numberOfLines={2}
              >
                {card.name}
              </Text>
              {card.character ? (
                <Text
                  className="font-nunito-bold text-white/85"
                  style={{
                    fontSize: cfg.characterFontSize,
                    letterSpacing: 0.4,
                  }}
                  numberOfLines={1}
                >
                  {card.character}
                </Text>
              ) : null}
            </View>
          </View>

          <View
            style={{
              marginTop: cfg.metaGap,
              height: cfg.descriptionHeight,
              borderRadius: cfg.artRadius,
              padding: cfg.descriptionPadding,
              backgroundColor: descriptionColor,
              borderWidth: 1,
              borderColor: withAlpha(rarityColor.ring, themeName === "nightosphere" ? 0.32 : 0.22),
            }}
          >
            <Text
              className="font-nunito"
              style={{
                color: tc.fg,
                fontSize: cfg.descriptionFontSize,
                lineHeight: cfg.descriptionLineHeight,
              }}
              numberOfLines={cfg.descriptionLines}
            >
              {card.description}
            </Text>
          </View>

          <View
            style={{
              marginTop: cfg.metaGap,
              borderRadius: cfg.artRadius,
              padding: cfg.bodyGap,
              backgroundColor: withAlpha("#FFFFFF", themeName === "nightosphere" ? 0.08 : 0.62),
              borderWidth: 1,
              borderColor: withAlpha(rarityColor.ring, themeName === "nightosphere" ? 0.24 : 0.18),
            }}
          >
            <View
              style={{
                flexDirection: "row",
                gap: cfg.statGap,
              }}
            >
              {statPalettes.map((stat) => (
                <StatChip
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  colors={stat.colors}
                  Icon={stat.Icon}
                  cfg={cfg}
                />
              ))}
            </View>
          </View>
        </View>
      </View>

      {size === "large" && quantity > 1 ? (
        <View className="items-center pt-3">
          <LinearGradient
            colors={[tc.secondary, tc.secondaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 999,
              paddingHorizontal: cfg.quantityPaddingH + 4,
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
        </View>
      ) : null}

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
