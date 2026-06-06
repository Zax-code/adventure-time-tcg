import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type {
  CollectionResponse,
  OpenPackResponse,
  PacksResponse,
} from "@adventure-time/api-client";
import { CardTile } from "../../src/components/card-tile";
import { PageErrorState } from "../../src/components/error-state";
import {
  BoxIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CoinIcon,
  CrownIcon,
  DiamondIcon,
  EyeIcon,
  GiftBoxIcon,
  PackIcon,
  SparkleIcon,
  SparklesIcon,
  ZapIcon,
} from "../../src/components/icons";
import { PageLoadingState } from "../../src/components/loading-state";
import {
  RARITY_COLORS,
  RARITY_COLORS_ICE,
  RARITY_COLORS_NIGHTOSPHERE,
} from "../../src/components/theme";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { useThemeStore } from "../../src/stores/theme-store";
import { useBottomTabBarContentPadding } from "../../src/theme/layout";
import { THEME_COLORS, type ThemeName } from "../../src/theme/themes";

import type { ViewStyle } from "react-native";

type Pack = PacksResponse["packs"][number];
type OpenedCard = OpenPackResponse["cards"][number];
type CardTileEntry = CollectionResponse["cards"][number];
type AbsolutePosition = Pick<ViewStyle, "top" | "right" | "bottom" | "left">;
type RarityName = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
type BurstCrack = {
  angle: number;
  lengths: [number, number, number];
  bends: [number, number];
  thickness: number;
  branchAt: number;
  branchAngleOffset: number;
  branchLength: number;
};
type BurstDebris = {
  angle: number;
  originDistance: number;
  distance: number;
  crossOffset: number;
  size: number;
  stretch: number;
  rotate: string;
  scale: number;
  zIndex: number;
};
type PackBurstPattern = {
  cracks: BurstCrack[];
  debris: BurstDebris[];
};
type OpeningPhase =
  | "selecting"
  | "shaking"
  | "bursting"
  | "loading"
  | "readyToReveal"
  | "revealing"
  | "complete";

const PACK_CARD_RATIO = 320 / 460;
const IS_E2E_BUILD = process.env.EXPO_PUBLIC_E2E_AUTH === "1";
const PACK_OPEN_SHAKE_MS = IS_E2E_BUILD ? 3200 : 950;
const PACK_OPEN_BURST_MS = IS_E2E_BUILD ? 2100 : 1100;
const PACK_OPEN_PROGRESS_MS = IS_E2E_BUILD
  ? {
      first: 1400,
      second: 1400,
      final: 720,
    }
  : {
      first: 420,
      second: 420,
      final: 220,
    };

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugifyPackName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toCardTileEntry(card: OpenedCard): CardTileEntry {
  return {
    id: `opened-${card.id}`,
    cardId: card.id,
    card,
    obtainedAt: new Date(0).toISOString(),
    quantity: 1,
  };
}

function getRarityGlowColor(rarityName: string): string {
  switch (rarityName) {
    case "Legendary":
      return "#FFD166";
    case "Epic":
      return "#C084FC";
    case "Rare":
      return "#60A5FA";
    case "Uncommon":
      return "#34D399";
    default:
      return "#F472B6";
  }
}

function getPackIcon(packName: string, size = 34) {
  if (packName.includes("Legendary")) {
    return <CrownIcon size={size} color="#D97706" />;
  }
  if (packName.includes("Epic")) {
    return <DiamondIcon size={size} color="#7C3AED" />;
  }
  if (packName.includes("Premium")) {
    return <SparkleIcon size={size} color="#8B5CF6" />;
  }
  if (packName.includes("Standard")) {
    return <GiftBoxIcon size={size} color="#2563EB" />;
  }
  return <BoxIcon size={size} color="#6B7280" />;
}

function getThemeRarityPalette(themeName: ThemeName, rarityName: RarityName) {
  const paletteMap =
    themeName === "ice"
      ? RARITY_COLORS_ICE
      : themeName === "nightosphere"
        ? RARITY_COLORS_NIGHTOSPHERE
        : RARITY_COLORS;

  return paletteMap[rarityName] ?? paletteMap.Common;
}

function polarOffset(angle: number, distance: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: Math.cos(radians) * distance,
    y: Math.sin(radians) * distance,
  };
}

function distanceToRectEdge(
  originX: number,
  originY: number,
  angle: number,
  width: number,
  height: number,
  inset = 0,
) {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  const minX = inset;
  const maxX = width - inset;
  const minY = inset;
  const maxY = height - inset;
  const candidates: number[] = [];

  if (Math.abs(dx) > 0.0001) {
    const tx = dx > 0 ? (maxX - originX) / dx : (minX - originX) / dx;
    if (tx > 0) {
      candidates.push(tx);
    }
  }

  if (Math.abs(dy) > 0.0001) {
    const ty = dy > 0 ? (maxY - originY) / dy : (minY - originY) / dy;
    if (ty > 0) {
      candidates.push(ty);
    }
  }

  return candidates.length > 0 ? Math.min(...candidates) : 0;
}

function createBurstPattern(): PackBurstPattern {
  const baseAngles = [
    -150 + Math.random() * 26,
    -58 + Math.random() * 28,
    26 + Math.random() * 30,
    126 + Math.random() * 24,
  ];

  const cracks: BurstCrack[] = baseAngles.map((angle, index) => ({
    angle,
    lengths: [
      32 + Math.round(Math.random() * 8),
      24 + Math.round(Math.random() * 10),
      10 + Math.round(Math.random() * 6),
    ],
    bends: [
      (index % 2 === 0 ? 1 : -1) * (6 + Math.round(Math.random() * 6)),
      (index % 3 === 0 ? -1 : 1) * (5 + Math.round(Math.random() * 7)),
    ],
    thickness: 2.8 + Math.random() * 1.1,
    branchAt: 28 + Math.round(Math.random() * 12),
    branchAngleOffset:
      (index % 2 === 0 ? -1 : 1) * (14 + Math.round(Math.random() * 8)),
    branchLength: 8 + Math.round(Math.random() * 5),
  }));

  const debris: BurstDebris[] = cracks.flatMap((crack, crackIndex) =>
    [0, 1, 2].map((pieceIndex) => ({
      angle:
        crack.angle +
        (pieceIndex - 1) * (8 + Math.random() * 8) +
        (Math.random() * 6 - 3),
      originDistance: 34 + pieceIndex * 18 + Math.random() * 14,
      distance: 72 + pieceIndex * 18 + Math.random() * 26,
      crossOffset: (pieceIndex - 1) * (7 + Math.random() * 5),
      size: 12 + Math.round(Math.random() * 7),
      stretch: 1 + Math.random() * 0.7,
      rotate: `${Math.round(Math.random() * 90 - 45)}deg`,
      scale: 1 + Math.random() * 0.22,
      zIndex: 20 - crackIndex * 3 - pieceIndex,
    })),
  );

  return { cracks, debris };
}

function withAlpha(hex: string, alpha: string) {
  if (hex.startsWith("#") && hex.length === 7) {
    return `${hex}${alpha}`;
  }

  return hex;
}

function getPackProgressStep(phase: OpeningPhase) {
  switch (phase) {
    case "shaking":
    case "bursting":
      return 0;
    case "loading":
      return 1;
    case "readyToReveal":
    case "revealing":
      return 2;
    case "complete":
      return 3;
    default:
      return -1;
  }
}

function getHapticForCard(card: OpenedCard) {
  const rarityName = card.rarity?.name ?? "Common";
  if (rarityName === "Legendary") {
    return Haptics.NotificationFeedbackType.Success;
  }
  if (rarityName === "Epic" || rarityName === "Rare") {
    return Haptics.NotificationFeedbackType.Warning;
  }
  return null;
}

function toRarityName(value: string | undefined): RarityName {
  if (
    value === "Common" ||
    value === "Uncommon" ||
    value === "Rare" ||
    value === "Epic" ||
    value === "Legendary"
  ) {
    return value;
  }

  return "Common";
}

function BackgroundOrbs({
  primary,
  secondary,
  accent,
}: {
  primary: string;
  secondary: string;
  accent: string;
}) {
  void primary;
  void secondary;
  void accent;
  return null;
}

function PackFaceInterior({
  pack,
  tc,
  compact = false,
}: {
  pack: Pack;
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const iconSize = compact ? 30 : 72;
  const nameSize = compact ? 15 : 28;

  return (
    <View style={{ flex: 1, padding: compact ? 16 : 24 }}>
      <View className="flex-1 items-center justify-center gap-4">
        <View className="items-center justify-center">
          {getPackIcon(pack.name, iconSize)}
        </View>
        <Text
          className="text-center font-nunito-extrabold text-fg"
          style={{ fontSize: nameSize, lineHeight: nameSize + 4 }}
        >
          {pack.name}
        </Text>
        <View
          className="rounded-full px-4 py-1.5"
          style={{ backgroundColor: tc.surface }}
        >
          <Text className="font-nunito-bold text-[13px] text-fgMuted">
            {t("packs.cardsCount", { count: pack.cardCount })}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PackPreviewCard({
  pack,
  width,
  tc,
  compact = false,
  pulseAnim,
  chargeAnim,
  burstScaleAnim,
}: {
  pack: Pack;
  width: number;
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
  compact?: boolean;
  pulseAnim?: Animated.Value;
  chargeAnim?: Animated.Value;
  burstScaleAnim?: Animated.Value;
}) {
  const height = width / PACK_CARD_RATIO;
  const accentColor = pack.color || tc.primary;
  const packSurfaceColor = pack.color || tc.surfaceMuted;

  const animatedTransforms = [
    ...(chargeAnim
      ? [
          {
            translateY: chargeAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [6, -8, 6],
            }),
          },
        ]
      : []),
    ...(burstScaleAnim ? [{ scale: burstScaleAnim }] : []),
    ...(pulseAnim
      ? [
          {
            scale: pulseAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 1.014, 1],
            }),
          },
        ]
      : []),
    ...(chargeAnim
      ? [
          {
            scale: chargeAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 1.015, 1],
            }),
          },
        ]
      : []),
  ];

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: compact ? 24 : 32,
        overflow: "hidden",
        borderWidth: compact ? 1.5 : 2,
        borderColor: withAlpha(accentColor, compact ? "52" : "66"),
        backgroundColor: packSurfaceColor,
        transform: animatedTransforms,
      }}
    >
      <PackFaceInterior pack={pack} tc={tc} compact={compact} />
    </Animated.View>
  );
}

function PackFaceCanvas({
  pack,
  width,
  height,
  tc,
}: {
  pack: Pack;
  width: number;
  height: number;
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
}) {
  const accentColor = pack.color || tc.primary;
  const packSurfaceColor = pack.color || tc.surfaceMuted;

  return (
    <View
      style={{
        width,
        height,
        borderRadius: 32,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: withAlpha(accentColor, "66"),
        backgroundColor: packSurfaceColor,
      }}
    >
      <PackFaceInterior pack={pack} tc={tc} />
    </View>
  );
}

function getCardBackPalette(
  themeName: ThemeName,
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS],
) {
  switch (themeName) {
    case "ice":
      return {
        base: tc.infoTint,
        border: tc.infoBorder,
        frame: tc.surface,
        emblemBg: tc.secondaryTint,
        emblemBorder: tc.secondaryBorder,
        emblemIcon: tc.infoDark,
        stripe: tc.infoDark,
        pip: tc.secondaryDark,
        chipBg: tc.surface,
        chipText: tc.infoText,
      };
    case "nightosphere":
      return {
        base: tc.surface,
        border: tc.primaryBorder,
        frame: tc.surfaceMuted,
        emblemBg: tc.accentTint,
        emblemBorder: tc.accentBorder,
        emblemIcon: tc.primaryDark,
        stripe: tc.primaryText,
        pip: tc.accentText,
        chipBg: tc.surfaceMuted,
        chipText: tc.accentText,
      };
    case "candy":
    default:
      return {
        base: tc.primaryTint,
        border: tc.primaryBorder,
        frame: tc.surface,
        emblemBg: tc.secondaryTint,
        emblemBorder: tc.secondaryBorder,
        emblemIcon: tc.primaryStrong,
        stripe: tc.accentDark,
        pip: tc.primaryDark,
        chipBg: tc.surface,
        chipText: tc.primaryText,
      };
  }
}

function ThemeCardBackGlyph({
  themeName,
  size,
  color,
}: {
  themeName: ThemeName;
  size: number;
  color: string;
}) {
  if (themeName === "ice") {
    return <DiamondIcon size={size} color={color} />;
  }

  if (themeName === "nightosphere") {
    return <EyeIcon size={size} color={color} />;
  }

  return <SparklesIcon size={size} color={color} />;
}

function CardBackFace({
  width,
  tc,
  themeName,
  rarityName,
}: {
  width: number;
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
  themeName: ThemeName;
  rarityName: RarityName;
}) {
  const height = width / PACK_CARD_RATIO;
  const themePalette = getCardBackPalette(themeName, tc);
  const rarityPalette = getThemeRarityPalette(themeName, rarityName);
  const emblemSize = Math.max(84, width * 0.29);
  const stripeWidth = width * 0.58;

  return (
    <View
      style={{
        width,
        height,
        borderRadius: 32,
        overflow: "hidden",
        borderWidth: 1.5,
        borderColor: withAlpha(rarityPalette.ring, "88"),
        backgroundColor: withAlpha(rarityPalette.from, "E2"),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 18,
          right: 18,
          bottom: 18,
          left: 18,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: withAlpha(rarityPalette.ring, "42"),
          backgroundColor: withAlpha(rarityPalette.to, "7A"),
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 58,
          left: 28,
          right: 28,
          height: 8,
          borderRadius: 999,
          backgroundColor: withAlpha(themePalette.stripe, "2E"),
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: 58,
          left: 28,
          right: 28,
          height: 8,
          borderRadius: 999,
          backgroundColor: withAlpha(themePalette.stripe, "2E"),
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 84,
          bottom: 84,
          left: 34,
          width: 16,
          borderRadius: 999,
          backgroundColor: withAlpha(themePalette.emblemBg, "24"),
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 84,
          bottom: 84,
          right: 34,
          width: 16,
          borderRadius: 999,
          backgroundColor: withAlpha(themePalette.emblemBg, "24"),
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 118,
          left: 72,
          right: 72,
          height: 2,
          backgroundColor: withAlpha(rarityPalette.ring, "36"),
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: 118,
          left: 72,
          right: 72,
          height: 2,
          backgroundColor: withAlpha(rarityPalette.ring, "36"),
        }}
      />

      <View className="flex-1 items-center justify-between px-7 py-7">
        <View
          className="rounded-full px-3 py-1.5"
          style={{ backgroundColor: withAlpha(rarityPalette.to, "7A") }}
        >
          <Text
            className="font-nunito-extrabold text-[11px]"
            style={{ color: withAlpha(tc.fg, "D4"), letterSpacing: 1.1 }}
          >
            ATCG
          </Text>
        </View>

        <View className="items-center gap-5">
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: emblemSize,
              height: emblemSize,
              borderWidth: 2,
              borderColor: withAlpha(rarityPalette.ring, "80"),
              backgroundColor: withAlpha(themePalette.emblemBg, "76"),
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: emblemSize * 0.74,
                height: emblemSize * 0.74,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: withAlpha(rarityPalette.ring, "44"),
                backgroundColor: withAlpha(rarityPalette.to, "4E"),
              }}
            />
            <ThemeCardBackGlyph
              themeName={themeName}
              size={Math.max(36, emblemSize * 0.44)}
              color={withAlpha(tc.fg, "CC")}
            />
          </View>

          <View className="items-center gap-2">
            <View
              style={{
                width: stripeWidth,
                height: 8,
                borderRadius: 999,
                backgroundColor: withAlpha(rarityPalette.ring, "5E"),
              }}
            />
            <View
              style={{
                width: stripeWidth * 0.72,
                height: 8,
                borderRadius: 999,
                backgroundColor: withAlpha(themePalette.stripe, "42"),
              }}
            />
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {[0, 1, 2, 3, 4].map((pip) => (
            <View
              key={pip}
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                backgroundColor: withAlpha(
                  pip === 2 ? rarityPalette.ring : themePalette.pip,
                  pip === 2 ? "B6" : "64",
                ),
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function CardBackStack({
  width,
  tc,
  themeName,
  rarityNames,
  spreadAnim,
  idleAnim,
  pulseAnim,
}: {
  width: number;
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
  themeName: ThemeName;
  rarityNames?: RarityName[];
  spreadAnim: Animated.Value;
  idleAnim?: Animated.Value;
  pulseAnim?: Animated.Value;
}) {
  const cardHeight = width / PACK_CARD_RATIO;
  const stackHeight = cardHeight + 44;
  const stackRarities: [RarityName, RarityName, RarityName] = [
    rarityNames?.[0] ?? "Common",
    rarityNames?.[1] ?? rarityNames?.[0] ?? "Common",
    rarityNames?.[2] ?? rarityNames?.[1] ?? rarityNames?.[0] ?? "Common",
  ];
  const wrapperTransforms = [
    ...(idleAnim
      ? [
          {
            translateY: idleAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [8, -8, 8],
            }),
          },
          {
            scale: idleAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.994, 1.008, 0.994],
            }),
          },
        ]
      : []),
    ...(pulseAnim
      ? [
          {
            scale: pulseAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 1.014, 1],
            }),
          },
        ]
      : []),
  ];

  return (
    <Animated.View
      style={{
        width: width + 90,
        height: stackHeight,
        alignItems: "center",
        justifyContent: "center",
        transform: wrapperTransforms,
      }}
    >
      {[
          {
            key: "left",
            rarityName: stackRarities[0],
            finalX: -30,
            finalY: 12,
            finalRotate: "-8deg",
          collapsedX: -6,
          collapsedY: 5,
          collapsedRotate: "-2deg",
          scale: 0.96,
          zIndex: 1,
        },
          {
            key: "right",
            rarityName: stackRarities[1],
            finalX: 30,
            finalY: 12,
            finalRotate: "8deg",
          collapsedX: 6,
          collapsedY: 5,
          collapsedRotate: "2deg",
          scale: 0.96,
          zIndex: 2,
        },
          {
            key: "center",
            rarityName: stackRarities[2],
            finalX: 0,
            finalY: -10,
            finalRotate: "0deg",
          collapsedX: 0,
          collapsedY: 0,
          collapsedRotate: "0deg",
          scale: 1,
          zIndex: 3,
        },
      ].map((card) => (
        <Animated.View
          key={card.key}
          style={{
            position: "absolute",
            zIndex: card.zIndex,
            transform: [
              {
                translateX: spreadAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [card.collapsedX, card.finalX],
                }),
              },
              {
                translateY: spreadAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [card.collapsedY, card.finalY],
                }),
              },
              {
                rotate: spreadAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [card.collapsedRotate, card.finalRotate],
                }),
              },
              {
                scale: spreadAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.98, card.scale],
                }),
              },
            ],
          }}
        >
          <CardBackFace
            width={width}
            tc={tc}
            themeName={themeName}
            rarityName={card.rarityName}
          />
        </Animated.View>
      ))}
    </Animated.View>
  );
}

function CrackedPackPreview({
  pack,
  width,
  tc,
  openAnim,
  burstPattern,
}: {
  pack: Pack;
  width: number;
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
  openAnim: Animated.Value;
  burstPattern?: PackBurstPattern;
}) {
  const height = width / PACK_CARD_RATIO;
  const crackGlowWidth = Math.max(22, width * 0.1);
  const resolvedPattern = burstPattern ?? createBurstPattern();
  const centerX = width / 2;
  const centerY = height / 2;

  return (
    <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
      <PackFaceCanvas pack={pack} width={width} height={height} tc={tc} />
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: crackGlowWidth,
          height: height - 46,
          borderRadius: 999,
          backgroundColor: tc.surface,
          opacity: openAnim.interpolate({
            inputRange: [0, 0.25, 1],
            outputRange: [0, 0.85, 0],
          }),
          transform: [
            {
              scaleY: openAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 1.18],
              }),
            },
            {
              scaleX: openAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1.7],
              }),
            },
          ],
        }}
      />
      {resolvedPattern.cracks.map((crack, crackIndex) => {
        const first = polarOffset(crack.angle, crack.lengths[0] / 2);
        const secondStart = polarOffset(crack.angle, crack.lengths[0]);
        const secondAngle = crack.angle + crack.bends[0];
        const secondCenter = polarOffset(
          secondAngle,
          crack.lengths[1] / 2,
        );
        const thirdStart = {
          x: secondStart.x + polarOffset(secondAngle, crack.lengths[1]).x,
          y: secondStart.y + polarOffset(secondAngle, crack.lengths[1]).y,
        };
        const thirdAngle = secondAngle + crack.bends[1];
        const thirdCenter = polarOffset(thirdAngle, crack.lengths[2] / 2);
        const mainCrackOriginX = centerX + thirdStart.x;
        const mainCrackOriginY = centerY + thirdStart.y;
        const finalLength = Math.max(
          28,
          distanceToRectEdge(
            mainCrackOriginX,
            mainCrackOriginY,
            thirdAngle,
            width,
            height,
            6,
          ) + 2,
        );
        const finalCenter = polarOffset(thirdAngle, finalLength / 2);
        const branchStart = polarOffset(crack.angle, crack.branchAt);
        const branchAngle = crack.angle + crack.branchAngleOffset;
        const branchCenter = polarOffset(branchAngle, crack.branchLength / 2);

        const segments = [
          {
            key: `${crackIndex}-a`,
            left: centerX + first.x - crack.thickness / 2,
            top: centerY + first.y - crack.lengths[0] / 2,
            length: crack.lengths[0],
            rotate: `${crack.angle + 90}deg`,
            thickness: crack.thickness,
          },
          {
            key: `${crackIndex}-b`,
            left: centerX + secondStart.x + secondCenter.x - crack.thickness / 2,
            top: centerY + secondStart.y + secondCenter.y - crack.lengths[1] / 2,
            length: crack.lengths[1],
            rotate: `${secondAngle + 90}deg`,
            thickness: Math.max(1.6, crack.thickness - 0.3),
          },
          {
            key: `${crackIndex}-edge`,
            left:
              centerX + thirdStart.x + finalCenter.x - crack.thickness / 2,
            top:
              centerY + thirdStart.y + finalCenter.y - finalLength / 2,
            length: finalLength,
            rotate: `${thirdAngle + 90}deg`,
            thickness: Math.max(1.6, crack.thickness - 0.55),
          },
          ...(crackIndex % 2 === 0
            ? [{
            key: `${crackIndex}-d`,
            left: centerX + branchStart.x + branchCenter.x - crack.thickness / 2,
            top: centerY + branchStart.y + branchCenter.y - crack.branchLength / 2,
            length: crack.branchLength,
            rotate: `${branchAngle + 90}deg`,
            thickness: Math.max(1.2, crack.thickness - 0.95),
          }]
            : []),
        ];

        return segments.map((segment) => (
          <Animated.View
            key={segment.key}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: segment.left,
              top: segment.top,
              width: segment.thickness,
              height: segment.length,
              borderRadius: 999,
              backgroundColor: tc.surface,
              opacity: openAnim.interpolate({
                inputRange: [0, 0.05, 0.82, 1],
                outputRange: [0, 1, 0.68, 0],
              }),
              transform: [
                {
                  scaleY: openAnim.interpolate({
                    inputRange: [0, 0.2, 1],
                    outputRange: [0.1, 1, 1.03],
                  }),
                },
                {
                  rotate: segment.rotate,
                },
              ],
            }}
          />
        ));
      })}
      {resolvedPattern.debris.map((piece, index) => {
        const origin = polarOffset(piece.angle, piece.originDistance);
        const travel = polarOffset(piece.angle, piece.distance);
        const perpendicular = polarOffset(piece.angle + 90, piece.crossOffset);
        const pieceLeft = centerX + origin.x + perpendicular.x - piece.size / 2;
        const pieceTop = centerY + origin.y + perpendicular.y - piece.size / 2;
        const pieceWidth = piece.size * piece.stretch;
        return (
          <Animated.View
            key={`debris-${index}`}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: pieceLeft,
              top: pieceTop,
              width: pieceWidth,
              height: piece.size,
              borderRadius: 4,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: withAlpha(pack.color || tc.primaryDark, "B8"),
              zIndex: piece.zIndex,
              opacity: openAnim.interpolate({
                inputRange: [0, 0.14, 0.84, 1],
                outputRange: [0, 1, 0.74, 0],
              }),
              transform: [
                {
                  translateX: openAnim.interpolate({
                    inputRange: [0, 0.34, 1],
                    outputRange: [0, travel.x * 0.16, travel.x],
                  }),
                },
                {
                  translateY: openAnim.interpolate({
                    inputRange: [0, 0.34, 1],
                    outputRange: [0, travel.y * 0.16, travel.y],
                  }),
                },
                {
                  rotate: piece.rotate,
                },
                {
                  scale: openAnim.interpolate({
                    inputRange: [0, 0.26, 1],
                    outputRange: [0.35, 0.9, piece.scale],
                  }),
                },
              ],
            }}
          >
            <View
              style={{
                position: "absolute",
                left: -pieceLeft,
                top: -pieceTop,
              }}
            >
              <PackFaceCanvas pack={pack} width={width} height={height} tc={tc} />
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

function OpeningProgress({
  tc,
  activeStep,
}: {
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
  activeStep: number;
}) {
  return (
    <View className="flex-row gap-2">
      {[0, 1, 2, 3].map((step) => {
        const isActive = step <= activeStep;
        return (
          <View
            key={step}
            style={{
              height: 6,
              width: step === activeStep ? 40 : 28,
              borderRadius: 999,
              backgroundColor: isActive ? tc.primaryDark : tc.primaryBorder,
              opacity: isActive ? 1 : 0.5,
            }}
          />
        );
      })}
    </View>
  );
}

function SectionBadge({
  icon,
  label,
  backgroundColor,
  textColor,
}: {
  icon: ReactNode;
  label: string;
  backgroundColor: string;
  textColor: string;
}) {
  return (
    <View
      className="flex-row items-center gap-2 rounded-full px-3 py-1.5"
      style={{ backgroundColor }}
    >
      {icon}
      <Text className="font-nunito-bold text-[11px]" style={{ color: textColor }}>
        {label}
      </Text>
    </View>
  );
}

export default function PacksScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((state) => state.accessToken);
  const patchUser = useSessionStore((state) => state.patchUser);
  const coins = useSessionStore((state) => state.user?.coins ?? 0);
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const { t } = useTranslation();
  const bottomTabPadding = useBottomTabBarContentPadding();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [phase, setPhase] = useState<OpeningPhase>("selecting");
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [openedCards, setOpenedCards] = useState<OpenedCard[]>([]);
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [burstPattern, setBurstPattern] = useState<PackBurstPattern>(() =>
    createBurstPattern(),
  );
  const shouldHideTabBar = phase !== "selecting" && phase !== "complete";
  const openingBottomPadding = shouldHideTabBar
    ? Math.max(safeAreaBottom + 16, 24)
    : bottomTabPadding;

  const revealCardWidth = Math.min(
    width - 28,
    356,
    Math.max(244, height - openingBottomPadding - 352) * PACK_CARD_RATIO,
  );
  const stageCardWidth = revealCardWidth;
  const loadingDeckWidth = revealCardWidth;

  const chargeAnim = useRef(new Animated.Value(0)).current;
  const burstScaleAnim = useRef(new Animated.Value(1)).current;
  const burstFlashAnim = useRef(new Animated.Value(0)).current;
  const loadingIdleAnim = useRef(new Animated.Value(0)).current;
  const loadingProgressAnim = useRef(new Animated.Value(0)).current;
  const stackSpreadAnim = useRef(new Animated.Value(0)).current;
  const readyRevealAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const burstOpenAnim = useRef(new Animated.Value(0)).current;
  const chargeLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const loadingLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: shouldHideTabBar ? { display: "none" } : undefined,
    });

    return () => {
      navigation.setOptions({
        tabBarStyle: undefined,
      });
    };
  }, [navigation, shouldHideTabBar]);

  useEffect(() => {
    if (phase !== "readyToReveal") {
      return;
    }

    readyRevealAnim.setValue(0);
    pulseAnim.setValue(0);
    stackSpreadAnim.setValue(0);

    let pulseLoop: Animated.CompositeAnimation | null = null;

    Animated.parallel([
      Animated.timing(readyRevealAnim, {
        toValue: 1,
        duration: IS_E2E_BUILD ? 900 : 1350,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(stackSpreadAnim, {
        toValue: 1,
        duration: IS_E2E_BUILD ? 950 : 1600,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      pulseLoop = Animated.loop(
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      pulseLoop.start();
    });

    return () => pulseLoop?.stop();
  }, [phase, pulseAnim, readyRevealAnim, stackSpreadAnim]);

  useEffect(() => {
    if (phase !== "loading") {
      loadingLoopRef.current?.stop();
      loadingLoopRef.current = null;
      loadingIdleAnim.setValue(0);
      return;
    }

    loadingIdleAnim.setValue(0);
    loadingLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(loadingIdleAnim, {
          toValue: 1,
          duration: 1650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(loadingIdleAnim, {
          toValue: 0,
          duration: 1650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loadingLoopRef.current.start();

    return () => {
      loadingLoopRef.current?.stop();
      loadingLoopRef.current = null;
    };
  }, [loadingIdleAnim, phase]);

  function stopChargeAnimations() {
    chargeLoopRef.current?.stop();
    chargeLoopRef.current = null;
  }

  function startChargeAnimation() {
    stopChargeAnimations();
    chargeAnim.setValue(0);

    chargeLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(chargeAnim, {
          toValue: 1,
          duration: 920,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(chargeAnim, {
          toValue: 0,
          duration: 920,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    chargeLoopRef.current.start();
  }

  function startBurstAnimation() {
    stopChargeAnimations();
    burstScaleAnim.setValue(1);
    burstFlashAnim.setValue(0);
    burstOpenAnim.setValue(0);
    setBurstPattern(createBurstPattern());

    Animated.parallel([
      Animated.sequence([
        Animated.timing(burstScaleAnim, {
          toValue: 1.04,
          duration: Math.round(PACK_OPEN_BURST_MS * 0.45),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(burstScaleAnim, {
          toValue: 1,
          duration: Math.round(PACK_OPEN_BURST_MS * 0.55),
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(burstFlashAnim, {
          toValue: 1,
          duration: Math.round(PACK_OPEN_BURST_MS * 0.3),
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(burstFlashAnim, {
          toValue: 0,
          duration: Math.round(PACK_OPEN_BURST_MS * 0.7),
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(burstOpenAnim, {
        toValue: 1,
        duration: PACK_OPEN_BURST_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }

  function animateLoadingProgress(from: number, to: number, duration: number) {
    setLoadingProgress(Math.round(to));
    loadingProgressAnim.setValue(from);

    return new Promise<void>((resolve) => {
      Animated.timing(loadingProgressAnim, {
        toValue: to,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }).start(() => resolve());
    });
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
    setOpenedCards([]);
    setRevealedIndex(-1);
    setLoadingProgress(0);
    loadingProgressAnim.setValue(0);
    stackSpreadAnim.setValue(0);
    setNewBalance(null);
    setIsOpening(true);

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

      await animateLoadingProgress(44, 82, PACK_OPEN_PROGRESS_MS.second);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
        queryClient.invalidateQueries({ queryKey: ["daily-claim"] }),
        patchUser({ coins: result.newBalance }),
      ]);
      await animateLoadingProgress(82, 100, PACK_OPEN_PROGRESS_MS.final);

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        .catch(() => null);
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
      setLoadingProgress(0);
      setNewBalance(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        .catch(() => null);
    } finally {
      setIsOpening(false);
    }
  }

  function revealNext() {
    const nextIndex = revealedIndex + 1;

    if (nextIndex >= openedCards.length) {
      setPhase("complete");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        .catch(() => null);
      return;
    }

    const nextCard = openedCards[nextIndex];
    const hapticType = getHapticForCard(nextCard);

    flipAnim.setValue(0);
    Animated.spring(flipAnim, {
      toValue: 1,
      friction: 7,
      tension: 82,
      useNativeDriver: true,
    }).start();

    setRevealedIndex(nextIndex);
    setPhase("revealing");

    if (hapticType) {
      void Haptics.notificationAsync(hapticType).catch(() => null);
    } else {
      void Haptics.selectionAsync().catch(() => null);
    }
  }

  function reset() {
    setPhase("selecting");
    setSelectedPack(null);
    setOpenedCards([]);
    setRevealedIndex(-1);
    setNewBalance(null);
    setLoadingProgress(0);
    setOpenError(null);
    setIsOpening(false);
    stopChargeAnimations();
    chargeAnim.setValue(0);
    burstScaleAnim.setValue(1);
    burstFlashAnim.setValue(0);
    loadingIdleAnim.setValue(0);
    loadingProgressAnim.setValue(0);
    stackSpreadAnim.setValue(0);
    readyRevealAnim.setValue(0);
    pulseAnim.setValue(1);
    flipAnim.setValue(0);
    burstOpenAnim.setValue(0);
  }

  const packsQuery = useQuery({
    queryKey: ["packs"],
    queryFn: () => apiClient.packs(),
  });

  if (packsQuery.isLoading) {
    return (
      <PageLoadingState
        title={t("nav.pack")}
        message={t("common.loadingStates.pageBody")}
        icon="gift"
      />
    );
  }

  if (packsQuery.isError || !packsQuery.data) {
    return (
      <PageErrorState
        error={packsQuery.error}
        title={packsQuery.error ? undefined : t("packs.unavailable")}
        body={
          packsQuery.error
            ? undefined
            : t("common.errorStates.generic.body")
        }
        detail={
          packsQuery.error
            ? undefined
            : t("common.errorStates.generic.detail")
        }
        onRetry={() => {
          void packsQuery.refetch();
        }}
      />
    );
  }

  const packs = packsQuery.data.packs;
  const affordablePacks = packs.filter((pack) => pack.cost <= coins);
  const cheapestLockedPack = packs.reduce<Pack | undefined>((cheapest, pack) => {
    if (pack.cost <= coins) {
      return cheapest;
    }

    if (!cheapest || pack.cost < cheapest.cost) {
      return pack;
    }

    return cheapest;
  }, undefined);
  const featuredPack =
    affordablePacks.reduce<Pack | undefined>((best, pack) => {
      if (!best || pack.cardCount > best.cardCount) {
        return pack;
      }

      return best;
    }, undefined) ||
    packs.reduce<Pack | undefined>((cheapest, pack) => {
      if (!cheapest || pack.cost < cheapest.cost) {
        return pack;
      }

      return cheapest;
    }, undefined);
  const heroPack = featuredPack ?? cheapestLockedPack ?? packs[0];
  const heroCanAfford = heroPack ? heroPack.cost <= coins : false;
  const openingStep = getPackProgressStep(phase);
  const openingStackRarities = openedCards
    .slice(0, 3)
    .map((card) => toRarityName(card.rarity?.name));

  if ((phase === "shaking" || phase === "bursting") && selectedPack) {
    return (
      <View testID="pack-opening-shaking" className="flex-1 bg-bg">
        <BackgroundOrbs
          primary={tc.primaryTint}
          secondary={tc.secondaryTint}
          accent={tc.accentTint}
        />
        <View
          className="flex-1 px-4 pt-6"
          style={{ paddingBottom: openingBottomPadding }}
        >
          <View className="w-full items-center gap-3">
            <Text className="text-center font-nunito-extrabold text-[28px] leading-[34px] text-fg">
              {t("packs.opening.chargeTitle")}
            </Text>
            <Text className="max-w-[320px] text-center font-nunito text-sm leading-6 text-fgMuted">
              {t("packs.opening.chargeBody")}
            </Text>
          </View>

          <View className="flex-1 items-center justify-center py-5">
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: stageCardWidth + 52,
                height: stageCardWidth / PACK_CARD_RATIO + 52,
                borderRadius: 44,
                backgroundColor: selectedPack.color || tc.primary,
                opacity:
                  phase === "bursting"
                    ? burstFlashAnim.interpolate({
                        inputRange: [0, 0.35, 1],
                        outputRange: [0.18, 0.34, 0],
                      })
                    : chargeAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.12, 0.22, 0.12],
                      }),
                transform: [
                  {
                    scale:
                      phase === "bursting"
                        ? burstFlashAnim.interpolate({
                            inputRange: [0, 0.35, 1],
                            outputRange: [0.96, 1.08, 1.16],
                          })
                        : chargeAnim.interpolate({
                            inputRange: [0, 0.5, 1],
                            outputRange: [0.96, 1.04, 0.96],
                          }),
                  },
                ],
              }}
            />
            {phase === "bursting" ? (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: tc.surface,
                  opacity: burstFlashAnim.interpolate({
                    inputRange: [0, 0.18, 1],
                    outputRange: [0, 0.2, 0],
                  }),
                }}
              />
            ) : null}

            {phase === "bursting" ? (
              <Animated.View
                style={{
                  transform: [{ scale: burstScaleAnim }],
                }}
              >
                <CrackedPackPreview
                  pack={selectedPack}
                  width={stageCardWidth}
                  tc={tc}
                  openAnim={burstOpenAnim}
                  burstPattern={burstPattern}
                />
              </Animated.View>
            ) : (
              <PackPreviewCard
                pack={selectedPack}
                width={stageCardWidth}
                tc={tc}
                chargeAnim={chargeAnim}
              />
            )}
          </View>

          <View className="items-center gap-4 pb-2">
            <OpeningProgress tc={tc} activeStep={openingStep} />
            <Text className="font-nunito-bold text-sm text-primaryText">
              {t("packs.opening.packOpened", { name: selectedPack.name })}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (phase === "loading" && selectedPack) {
    return (
      <View testID="pack-opening-loading" className="flex-1 bg-bg">
        <BackgroundOrbs
          primary={tc.primaryTint}
          secondary={tc.secondaryTint}
          accent={tc.infoTint}
        />
        <View
          className="flex-1 px-4 pt-6"
          style={{ paddingBottom: openingBottomPadding }}
        >
          <View className="w-full items-center gap-3">
            <Text className="text-center font-nunito-extrabold text-[28px] leading-[34px] text-fg">
              {t("packs.opening.sortingTitle")}
            </Text>
            <Text className="max-w-[330px] text-center font-nunito text-sm leading-6 text-fgMuted">
              {t("packs.opening.sortingBody")}
            </Text>
          </View>

          <View className="flex-1 items-center justify-center py-5">
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: loadingDeckWidth + 168,
                height: loadingDeckWidth / PACK_CARD_RATIO + 168,
                borderRadius: 999,
                backgroundColor: tc.surface,
                opacity: loadingIdleAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.16, 0.26, 0.16],
                }),
                transform: [
                  {
                    scale: loadingIdleAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.98, 1.04, 0.98],
                    }),
                  },
                ],
              }}
            />
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: loadingDeckWidth + 104,
                height: loadingDeckWidth / PACK_CARD_RATIO + 104,
                borderRadius: 999,
                backgroundColor: selectedPack.color || tc.primary,
                opacity: loadingIdleAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.08, 0.16, 0.08],
                }),
                transform: [
                  {
                    scale: loadingIdleAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.97, 1.03, 0.97],
                    }),
                  },
                ],
              }}
            />
            <Animated.View
              pointerEvents="none"
              style={{
                width: loadingDeckWidth * 0.86,
                height: loadingDeckWidth * 0.86,
                borderRadius: 999,
                backgroundColor: tc.surface,
                opacity: loadingIdleAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.2, 0.34, 0.2],
                }),
                transform: [
                  {
                    scale: loadingIdleAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.96, 1.05, 0.96],
                    }),
                  },
                ],
              }}
            />
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: loadingDeckWidth * 0.44,
                height: loadingDeckWidth * 0.44,
                borderRadius: 999,
                backgroundColor: tc.surface,
                opacity: loadingIdleAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.26, 0.42, 0.26],
                }),
                transform: [
                  {
                    scale: loadingIdleAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.94, 1.08, 0.94],
                    }),
                  },
                ],
              }}
            />
          </View>

          <View className="w-full max-w-[340px] self-center gap-4 pb-2">
            <OpeningProgress tc={tc} activeStep={openingStep} />
            <SectionBadge
              icon={<EyeIcon size={12} color={tc.primaryText} />}
              label={t("packs.opening.syncingProgress")}
              backgroundColor={tc.primaryTint}
              textColor={tc.primaryText}
            />
            <View
              className="overflow-hidden rounded-full"
              style={{ backgroundColor: tc.surfaceMuted, height: 12 }}
            >
              <Animated.View
                style={{
                  width: loadingProgressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ["0%", "100%"],
                  }),
                  height: "100%",
                  borderRadius: 999,
                  backgroundColor: tc.primaryDark,
                }}
              />
            </View>
            <Text className="text-center font-nunito text-sm text-fgMuted">
              {loadingProgress}%
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (phase === "readyToReveal" && selectedPack) {
    return (
      <TouchableOpacity
        testID="pack-opening-ready"
        activeOpacity={0.92}
        onPress={revealNext}
        className="flex-1 bg-bg"
      >
        <BackgroundOrbs
          primary={tc.primaryTint}
          secondary={tc.secondaryTint}
          accent={tc.accentTint}
        />
        <View
          className="flex-1 px-4 pt-6"
          style={{ paddingBottom: openingBottomPadding }}
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
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: stageCardWidth + 118,
                height: stageCardWidth / PACK_CARD_RATIO + 118,
                borderRadius: 999,
                backgroundColor: tc.surface,
                opacity: readyRevealAnim.interpolate({
                  inputRange: [0, 0.45, 1],
                  outputRange: [0.56, 0.2, 0],
                }),
                transform: [
                  {
                    scale: readyRevealAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.88, 1.16],
                    }),
                  },
                ],
              }}
            />
            <Animated.View
              style={{
                opacity: readyRevealAnim.interpolate({
                  inputRange: [0, 0.28, 1],
                  outputRange: [0, 0.22, 1],
                }),
                transform: [
                  {
                    scale: readyRevealAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.86, 1],
                    }),
                  },
                ],
              }}
            >
              <CardBackStack
                width={stageCardWidth}
                tc={tc}
                themeName={themeName}
                rarityNames={openingStackRarities}
                spreadAnim={stackSpreadAnim}
                pulseAnim={pulseAnim}
              />
            </Animated.View>
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
      </TouchableOpacity>
    );
  }

  if (
    phase === "revealing" &&
    selectedPack &&
    revealedIndex >= 0 &&
    revealedIndex < openedCards.length
  ) {
    const card = openedCards[revealedIndex];
    const rarityName = card.rarity?.name ?? "Common";
    const rarityRing = RARITY_COLORS[rarityName]?.ring ?? tc.primaryDark;
    const glowColor = getRarityGlowColor(rarityName);
    const isHighRarity = ["Legendary", "Epic", "Rare"].includes(rarityName);
    const isLastCard = revealedIndex === openedCards.length - 1;
    const cardScale = flipAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.78, 1],
    });

    return (
      <TouchableOpacity
        testID="pack-opening-reveal"
        activeOpacity={0.92}
        onPress={revealNext}
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
          className="flex-1 px-4 pt-5"
          style={{ paddingBottom: openingBottomPadding }}
        >
          <View className="w-full max-w-[360px] self-center gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-nunito-bold text-base" style={{ color: rarityRing }}>
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
            <Animated.View
              style={{
                width: revealCardWidth,
                transform: [{ scale: cardScale }],
              }}
            >
              <View
                style={{
                  position: "absolute",
                  inset: -4,
                  borderRadius: 22,
                  borderWidth: 3,
                  borderColor: rarityRing,
                  zIndex: 20,
                }}
              />
              <CardTile
                entry={toCardTileEntry(card)}
                size="large"
                fitContainer
                accessToken={accessToken}
              />

              {card.isNewForUser ? (
                <View className="absolute right-3 top-3 z-30">
                  <LinearGradient
                    colors={[tc.success, tc.successDark]}
                    style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}
                  >
                    <Text className="font-nunito-extrabold text-[10px] text-white">
                      {t("packs.openResult.newBadge")}
                    </Text>
                  </LinearGradient>
                </View>
              ) : null}
            </Animated.View>
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
      </TouchableOpacity>
    );
  }

  if (phase === "complete" && selectedPack) {
    const newCards = openedCards.filter((card) => card.isNewForUser);
    const duplicateCards = openedCards.filter((card) => !card.isNewForUser);
    const nextBalance = newBalance ?? coins;
    const canReopenSelected = nextBalance >= selectedPack.cost;
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
      <ScrollView
        testID="pack-opening-summary"
        className="flex-1 bg-bg"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: bottomTabPadding,
          gap: 18,
        }}
      >
        <BackgroundOrbs
          primary={tc.primaryTint}
          secondary={tc.secondaryTint}
          accent={tc.accentTint}
        />

        <View
          style={{
            borderRadius: 30,
            padding: 22,
            borderWidth: 1,
            borderColor: tc.primaryBorder,
            backgroundColor: tc.surface,
          }}
        >
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1 gap-2">
              <SectionBadge
                icon={<SparklesIcon size={14} color={tc.primaryText} />}
                label={t("packs.summary.title")}
                backgroundColor={tc.primaryTint}
                textColor={tc.primaryText}
              />
              <Text className="font-nunito-extrabold text-[28px] leading-[34px] text-fg">
                {selectedPack.name}
              </Text>
              <Text className="font-nunito text-sm leading-6 text-fgMuted">
                {t("packs.summary.subtitle")}
              </Text>
            </View>
            <View
              className="items-center rounded-[24px] px-4 py-3"
              style={{ backgroundColor: tc.primaryTint }}
            >
              <CoinIcon size={18} />
              <Text className="mt-2 font-nunito-extrabold text-[22px] text-fg">
                {nextBalance}
              </Text>
              <Text className="font-nunito text-[11px] text-fgMuted">
                {t("packs.summary.remainingCoins")}
              </Text>
            </View>
          </View>

          <View className="mt-6 flex-row gap-3">
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
          style={{ backgroundColor: tc.surface, borderColor: tc.primaryBorder }}
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
            {(["Legendary", "Epic", "Rare", "Uncommon", "Common"] as const).map(
              (rarityName) => {
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
              },
            )}
          </View>
        </View>

        {newCards.length > 0 ? (
          <View className="gap-3">
            <Text className="font-nunito-bold text-lg text-fg">
              {t("packs.summary.newCards")}
            </Text>
            <View className="flex-row flex-wrap">
              {newCards.map((card, index) => (
                <View key={`${card.id}-${index}`} className="w-1/2 px-1.5 pb-3">
                  <CardTile
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
            {[...newCards, ...duplicateCards].map((card, index) => (
              <View key={`${card.id}-${index}`} className="w-1/2 px-1.5 pb-3">
                <CardTile
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
            <Pressable
              testID={`pack-summary-open-again-${slugifyPackName(selectedPack.name)}`}
              onPress={() => void openPack(selectedPack)}
              disabled={isOpening}
            >
              <LinearGradient
                colors={[tc.primary, tc.primaryDark]}
                style={{
                  borderRadius: 22,
                  paddingVertical: 16,
                  alignItems: "center",
                }}
              >
                <Text className="font-nunito-extrabold text-base text-white">
                  {t("packs.summary.openSamePack")}
                </Text>
              </LinearGradient>
            </Pressable>
          ) : null}

          <Pressable testID="pack-summary-browse" onPress={reset}>
            <View
              className="flex-row items-center justify-center gap-2 rounded-[22px] border px-5 py-4"
              style={{ backgroundColor: tc.surface, borderColor: tc.primaryBorder }}
            >
              <Text className="font-nunito-bold text-base text-primaryStrong">
                {t("packs.summary.browsePacks")}
              </Text>
              <ChevronRightIcon size={16} color={tc.primaryStrong} />
            </View>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <View testID="pack-storefront" className="flex-1 bg-bg">
      <BackgroundOrbs
        primary={tc.primaryTint}
        secondary={tc.secondaryTint}
        accent={tc.accentTint}
      />

      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: bottomTabPadding,
          gap: 18,
        }}
      >
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
              label={t("packs.affordableCount", { count: affordablePacks.length })}
              backgroundColor={tc.successTint}
              textColor={tc.successText}
            />

            {heroPack ? (
              <Pressable
                onPress={() => !isOpening && heroCanAfford && void openPack(heroPack)}
                disabled={isOpening || !heroCanAfford}
                style={{ opacity: heroCanAfford ? 1 : 0.82 }}
              >
                <View
                  className="flex-row items-center justify-between rounded-[24px] px-5 py-4"
                  style={{
                    backgroundColor: heroCanAfford ? tc.primaryStrong : tc.surfaceMuted,
                  }}
                >
                  <View className="flex-1 gap-1 pr-3">
                    <Text
                      className="font-nunito-extrabold text-lg"
                      style={{ color: heroCanAfford ? "#FFFFFF" : tc.fg }}
                    >
                      {heroPack.name}
                    </Text>
                    <Text
                      className="font-nunito text-sm"
                      style={{ color: heroCanAfford ? "rgba(255,255,255,0.82)" : tc.fgMuted }}
                    >
                      {heroCanAfford
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
                      style={{ color: heroCanAfford ? "#FFFFFF" : tc.primaryStrong }}
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
            const slug = slugifyPackName(pack.name);
            const coinsNeeded = Math.max(0, pack.cost - coins);
            const isFeatured = featuredPack?.id === pack.id;
            const packSurfaceColor = pack.color
              ? withAlpha(pack.color, "33")
              : tc.surfaceMuted;

            return (
              <Pressable
                key={pack.id}
                testID={`pack-card-${slug}`}
                onPress={() => !isOpening && canAfford && void openPack(pack)}
                disabled={isOpening || !canAfford}
                style={{ opacity: canAfford ? 1 : 0.7 }}
              >
                <View
                  className="rounded-[30px] border p-4"
                  style={{
                    backgroundColor: packSurfaceColor,
                    borderColor: isFeatured
                      ? withAlpha(pack.color || tc.primary, "66")
                      : withAlpha(pack.color || tc.primaryBorder, "2E"),
                  }}
                >
                  <View className="flex-row items-start gap-4">
                    <View className="items-center justify-center p-4">
                      {getPackIcon(pack.name, 34)}
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
                            icon={<SparklesIcon size={11} color={tc.accentText} />}
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

                      <View className="flex-row items-center justify-between gap-3">
                        <Text
                          className="font-nunito text-xs"
                          style={{
                            color: canAfford ? tc.successText : tc.dangerText,
                          }}
                        >
                          {canAfford
                            ? t("packs.readyNow")
                            : t("packs.needMoreCoinsShort", {
                                count: coinsNeeded,
                              })}
                        </Text>

                        <Text
                          testID={`pack-open-cta-${slug}`}
                          className="font-nunito-bold text-sm"
                          style={{ color: canAfford ? tc.primaryText : tc.fgMuted }}
                        >
                          {t("packs.tapToOpen")}
                        </Text>
                      </View>
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
