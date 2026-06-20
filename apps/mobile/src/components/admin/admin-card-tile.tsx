import { memo, useEffect, useRef } from "react";
import type { ComponentType } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import type { ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import type {
  AdminCardDetail,
  AdminCardsResponse,
} from "@adventure-time/api-client";

import { CARD_ART_RATIO } from "../card-back-cover-art";
import {
  CARD_OUTLINE_SAFE_AREA,
  getCardOutlineSource,
} from "../card-outline-art";
import {
  AttackStatIcon,
  DefenseStatIcon,
  HealthStatIcon,
  RarityIcon,
  SpeedStatIcon,
} from "../icons";
import { getCardImageCacheKey, getCardImageUrl } from "../../lib/card-images";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";
import {
  CARD_TYPE_COLORS,
  CARD_TYPE_COLORS_ICE,
  CARD_TYPE_COLORS_NIGHTOSPHERE,
  RARITY_COLORS,
  RARITY_COLORS_ICE,
  RARITY_COLORS_NIGHTOSPHERE,
} from "../theme";
import { pickReadableTextColor } from "./admin-palette";

type AdminCard = AdminCardsResponse["cards"][number] | AdminCardDetail;

// Local numeric-opacity variant that mirrors card-tile.tsx's helper so the two
// card components stay visually aligned. The admin-palette version expects a
// hex string; this accepts a 0-1 number.
function withAlpha(color: string, opacity: number) {
  if (color.startsWith("#") && color.length === 7) {
    const alpha = Math.max(0, Math.min(255, Math.round(opacity * 255)))
      .toString(16)
      .padStart(2, "0");
    return `${color}${alpha}`;
  }

  return color;
}

type AdminCardSize = "small" | "medium" | "large";

type AdminCardTileMetrics = {
  width: number;
  height: number;
  outerPadding: number;
  innerPadding: number;
  borderRadius: number;
  innerRadius: number;
  artRadius: number;
  badgeFontSize: number;
  badgeIconSize: number;
  badgePaddingH: number;
  badgePaddingV: number;
  nameFontSize: number;
  characterFontSize: number;
  statValueFontSize: number;
  statLabelFontSize: number;
  statRadius: number;
  statPaddingY: number;
  statPaddingX: number;
  statGap: number;
  statIconSize: number;
  statOrbSize: number;
  statValueLineHeight: number;
  descriptionFontSize: number;
  descriptionLineHeight: number;
  descriptionPadding: number;
  descriptionLines: number;
  descriptionHeight: number;
  metaGap: number;
  titleBottomPadding: number;
  bodyGap: number;
  archivedFontSize: number;
  archivedPaddingH: number;
  archivedPaddingV: number;
};

const SIZE_CONFIG: Record<AdminCardSize, AdminCardTileMetrics> = {
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
    statValueFontSize: 11,
    statLabelFontSize: 4.5,
    statRadius: 10,
    statPaddingY: 6,
    statPaddingX: 6,
    statGap: 4,
    statIconSize: 16,
    statOrbSize: 24,
    statValueLineHeight: 12,
    descriptionFontSize: 7,
    descriptionLineHeight: 10,
    descriptionPadding: 6,
    descriptionLines: 3,
    descriptionHeight: 46,
    metaGap: 7,
    titleBottomPadding: 8,
    bodyGap: 6,
    archivedFontSize: 8,
    archivedPaddingH: 8,
    archivedPaddingV: 3,
  },
  medium: {
    width: 184,
    height: 276,
    outerPadding: 6,
    innerPadding: 8,
    borderRadius: 18,
    innerRadius: 15,
    artRadius: 13,
    badgeFontSize: 7,
    badgeIconSize: 10,
    badgePaddingH: 9,
    badgePaddingV: 5,
    nameFontSize: 13,
    characterFontSize: 9,
    statValueFontSize: 13,
    statLabelFontSize: 5.5,
    statRadius: 12,
    statPaddingY: 8,
    statPaddingX: 7,
    statGap: 5,
    statIconSize: 20,
    statOrbSize: 30,
    statValueLineHeight: 14,
    descriptionFontSize: 8,
    descriptionLineHeight: 12,
    descriptionPadding: 8,
    descriptionLines: 3,
    descriptionHeight: 54,
    metaGap: 9,
    titleBottomPadding: 10,
    bodyGap: 8,
    archivedFontSize: 9,
    archivedPaddingH: 10,
    archivedPaddingV: 4,
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
    statValueFontSize: 18,
    statLabelFontSize: 7,
    statRadius: 16,
    statPaddingY: 10,
    statPaddingX: 10,
    statGap: 8,
    statIconSize: 26,
    statOrbSize: 38,
    statValueLineHeight: 19,
    descriptionFontSize: 13,
    descriptionLineHeight: 18,
    descriptionPadding: 10,
    descriptionLines: 4,
    descriptionHeight: 96,
    metaGap: 12,
    titleBottomPadding: 12,
    bodyGap: 10,
    archivedFontSize: 11,
    archivedPaddingH: 12,
    archivedPaddingV: 5,
  },
} as const;

const COMPACT_LABELS: Record<string, string> = {
  Common: "COM",
  Uncommon: "UNC",
  Rare: "RAR",
  Epic: "EPC",
  Legendary: "LGD",
};

function RarityRibbon({
  rarityName,
  rarity,
  compact,
  cfg,
}: {
  rarityName: string;
  rarity: { from: string; to: string; ring: string };
  compact: boolean;
  cfg: AdminCardTileMetrics;
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
  cfg: AdminCardTileMetrics;
}) {
  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ paddingVertical: cfg.statPaddingY, paddingHorizontal: cfg.statPaddingX }}
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
          marginTop: 1,
          color: withAlpha(colors[1], 0.84),
        }}
      >
        {label}
      </Text>
    </View>
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
    size?: AdminCardSize;
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
      frame: tc.primary,
      light: tc.primaryTint,
      dark: tc.primaryText,
    };
    const rarityColor = rarityPalette[card.rarityName] ?? rarityPalette.Common;
    const cardAspectRatio = CARD_ART_RATIO;
    const outlineSource = getCardOutlineSource(themeName, card.rarityName);
    const hasOutline = outlineSource != null;
    const bodyCfg = cfg;
    const isLegendary = card.rarityName === "Legendary";
    const isEpic = card.rarityName === "Epic";
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

    const archivedTextColor = pickReadableTextColor(tc.dangerDark, tc.fg, tc.surface);

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
    const outlineSafeAreaStyle: ViewStyle = {
      position: "absolute",
      top: `${CARD_OUTLINE_SAFE_AREA.top * 100}%`,
      bottom: `${CARD_OUTLINE_SAFE_AREA.bottom * 100}%`,
      borderRadius: bodyCfg.innerRadius,
    };
    const outlinedBodyInset = size === "large" ? 6 : 3;

    const cardPanel = (
      <View
        style={{
          flex: 1,
          borderRadius: bodyCfg.innerRadius,
          backgroundColor: hasOutline ? "transparent" : panelColor,
          borderWidth: 0,
          borderColor: hasOutline
            ? "transparent"
            : withAlpha("#FFFFFF", themeName === "nightosphere" ? 0.1 : 0.42),
        }}
      >
        <View
          className="overflow-hidden"
          style={{
            flex: size === "large" ? 1.55 : 1.38,
            borderRadius: bodyCfg.artRadius,
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
                  fontSize: bodyCfg.nameFontSize * 2.4,
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

          {card.isArchived ? (
            <View
              style={{
                position: "absolute",
                top: bodyCfg.innerPadding,
                left: bodyCfg.innerPadding,
                borderRadius: 999,
                paddingHorizontal: cfg.archivedPaddingH,
                paddingVertical: cfg.archivedPaddingV,
                backgroundColor: withAlpha(tc.dangerDark, 0.9),
              }}
            >
              <Text
                className="font-nunito-extrabold"
                style={{ color: archivedTextColor, fontSize: cfg.archivedFontSize }}
              >
                Archived
              </Text>
            </View>
          ) : null}

          {!hasOutline ? (
            <View
              style={{
                position: "absolute",
                top: bodyCfg.innerPadding,
                right: bodyCfg.innerPadding,
                flexDirection: "row",
                justifyContent: "flex-end",
                alignItems: "flex-start",
              }}
            >
              <RarityRibbon
                rarityName={card.rarityName}
                rarity={rarityColor}
                compact={size !== "large"}
                cfg={bodyCfg}
              />
            </View>
          ) : null}

          <View
            style={{
              position: "absolute",
              right: hasOutline ? outlinedBodyInset : bodyCfg.innerPadding,
              bottom: hasOutline ? outlinedBodyInset : bodyCfg.innerPadding,
              borderRadius: 999,
              paddingHorizontal: bodyCfg.badgePaddingH,
              paddingVertical: bodyCfg.badgePaddingV,
              backgroundColor: withAlpha(typeColor.dark, themeName === "nightosphere" ? 0.9 : 0.84),
              maxWidth: "42%",
            }}
          >
            <Text
              className="font-nunito-extrabold text-white"
              style={{ fontSize: bodyCfg.badgeFontSize }}
              numberOfLines={1}
            >
              {card.type}
            </Text>
          </View>

          <View
            style={{
              position: "absolute",
              left: hasOutline ? outlinedBodyInset : bodyCfg.innerPadding,
              right: hasOutline ? outlinedBodyInset + 86 : bodyCfg.innerPadding,
              bottom: bodyCfg.titleBottomPadding,
              gap: 2,
            }}
          >
            <Text
              className="font-nunito-extrabold text-white"
              style={{
                fontSize: bodyCfg.nameFontSize,
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
                  fontSize: bodyCfg.characterFontSize,
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
            marginTop: hasOutline ? bodyCfg.metaGap * 0.72 : bodyCfg.metaGap,
            height: bodyCfg.descriptionHeight,
            borderRadius: bodyCfg.artRadius,
            padding: bodyCfg.descriptionPadding,
            backgroundColor: descriptionColor,
            borderWidth: hasOutline ? 0 : 1,
            borderColor: hasOutline
              ? "transparent"
              : withAlpha(rarityColor.ring, themeName === "nightosphere" ? 0.32 : 0.22),
            marginHorizontal: hasOutline ? outlinedBodyInset : 0,
          }}
        >
          <Text
            className="font-nunito"
            style={{
              color: tc.fg,
              fontSize: bodyCfg.descriptionFontSize,
              lineHeight: bodyCfg.descriptionLineHeight,
            }}
            numberOfLines={bodyCfg.descriptionLines}
          >
            {card.description}
          </Text>
        </View>

        <View
          style={{
            marginTop: hasOutline ? bodyCfg.metaGap * 0.72 : bodyCfg.metaGap,
            flexDirection: "row",
            gap: bodyCfg.statGap,
            marginHorizontal: hasOutline ? outlinedBodyInset : 0,
          }}
        >
          {statPalettes.map((stat) => (
            <StatChip
              key={stat.label}
              label={stat.label}
              value={stat.value}
              colors={stat.colors}
              Icon={stat.Icon}
              cfg={bodyCfg}
            />
          ))}
        </View>
      </View>
    );

    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={{
          width: fitContainer ? "100%" : cfg.width,
          opacity: card.isArchived ? 0.78 : onPress ? 1 : 0.98,
        }}
      >
        <View
          className="overflow-hidden"
          style={{
            borderRadius: cfg.borderRadius,
            backgroundColor: hasOutline ? "transparent" : rarityColor.ring,
            height: fitContainer ? undefined : cfg.height,
            aspectRatio: fitContainer ? cardAspectRatio : undefined,
            boxShadow:
              hasOutline
                ? "none"
                : size === "large"
                ? `0px 18px 42px ${withAlpha(rarityColor.to, 0.22)}`
                : `0px 10px 24px ${withAlpha(rarityColor.to, 0.18)}`,
          }}
        >
          {!hasOutline ? (
            <>
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
            </>
          ) : null}

          {hasShimmer && !hasOutline ? (
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

          {hasOutline ? (
            <>
              <View
                style={{
                  ...outlineSafeAreaStyle,
                  overflow: "hidden",
                }}
              >
                {cardPanel}
                {hasShimmer ? (
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
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
              </View>
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  inset: 0,
                  boxShadow:
                    size === "large"
                      ? `0px 18px 42px ${withAlpha(rarityColor.to, 0.22)}`
                      : `0px 10px 24px ${withAlpha(rarityColor.to, 0.18)}`,
                }}
              >
                <Image
                  source={outlineSource}
                  style={{ position: "absolute", inset: 0 }}
                  contentFit="fill"
                />
              </View>
            </>
          ) : (
            <View
              style={{
                flex: 1,
                margin: cfg.outerPadding,
              }}
            >
              {cardPanel}
            </View>
          )}
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