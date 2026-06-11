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
import Svg, {
  Circle,
  Defs,
  Path,
  RadialGradient as SvgRadialGradient,
  Stop,
} from "react-native-svg";
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
import { getPackOpeningVisualProfile } from "../../src/components/pack-opening-visuals";
import PackOpeningSequenceDom from "../../src/components/pack-opening-sequence-dom";
import {
  RARITY_COLORS,
  RARITY_COLORS_ICE,
  RARITY_COLORS_NIGHTOSPHERE,
} from "../../src/components/theme";
import { useTranslation } from "../../src/i18n";
import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { useThemeStore } from "../../src/stores/theme-store";
import {
  useAppHeaderHeight,
  useBottomTabBarContentPadding,
} from "../../src/theme/layout";
import { THEME_COLORS, type ThemeName } from "../../src/theme/themes";

import type { ViewStyle } from "react-native";

type Pack = PacksResponse["packs"][number];
type OpenedCard = OpenPackResponse["cards"][number];
type CardTileEntry = CollectionResponse["cards"][number];
type AbsolutePosition = Pick<ViewStyle, "top" | "right" | "bottom" | "left">;
type RarityName = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
type BurstCrack = {
  path: string;
  dashLength: number;
  delay: number;
};
type BurstParticle = {
  id: string;
  travelX: number;
  travelY: number;
  size: number;
  spin: string;
  color: string;
};
type BurstShard = {
  id: string;
  travelX: number;
  travelY: number;
  width: number;
  height: number;
  spin: string;
};
type PackBurstPattern = {
  cracks: BurstCrack[];
  particles: BurstParticle[];
  shards: BurstShard[];
};
type LoadingSparkle = {
  id: string;
  travelX: number;
  travelY: number;
  size: number;
  delay: number;
  rotation: number;
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
const PACK_OPEN_BURST_MS = IS_E2E_BUILD ? 2400 : 2200;
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
const BURST_PARTICLE_COLORS = [
  "#FFF2A8",
  "#FFC247",
  "#FF7622",
  "#FF3B16",
  "#7BD6FF",
];
const TREASURE_RAY_SPECS = [
  {
    angle: 16,
    spread: 6,
    inner: 0.18,
    outer: 0.48,
    color: "rgba(255, 242, 168, 0.52)",
  },
  {
    angle: 52,
    spread: 7,
    inner: 0.2,
    outer: 0.44,
    color: "rgba(255, 194, 70, 0.42)",
  },
  {
    angle: 88,
    spread: 6,
    inner: 0.18,
    outer: 0.46,
    color: "rgba(255, 255, 210, 0.5)",
  },
  {
    angle: 124,
    spread: 7,
    inner: 0.2,
    outer: 0.42,
    color: "rgba(255, 202, 88, 0.38)",
  },
  {
    angle: 164,
    spread: 8,
    inner: 0.22,
    outer: 0.46,
    color: "rgba(255, 244, 180, 0.5)",
  },
  {
    angle: 214,
    spread: 7,
    inner: 0.2,
    outer: 0.42,
    color: "rgba(255, 177, 54, 0.38)",
  },
  {
    angle: 258,
    spread: 6,
    inner: 0.19,
    outer: 0.45,
    color: "rgba(255, 255, 218, 0.48)",
  },
  {
    angle: 304,
    spread: 7,
    inner: 0.2,
    outer: 0.43,
    color: "rgba(255, 203, 80, 0.42)",
  },
];
const AnimatedPath = Animated.createAnimatedComponent(Path);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function useAnimatedValue(initialValue: number) {
  const ref = useRef<Animated.Value | null>(null);

  if (ref.current === null) {
    ref.current = new Animated.Value(initialValue);
  }

  return ref.current;
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

function getPackIcon(pack: Pack, size = 34) {
  const visualProfile = getPackOpeningVisualProfile({
    guaranteedRarity: pack.guaranteedRarity,
    name: pack.name,
  });

  switch (visualProfile.iconKind) {
    case "crown":
      return <CrownIcon size={size} color={visualProfile.iconColor} />;
    case "diamond":
      return <DiamondIcon size={size} color={visualProfile.iconColor} />;
    case "sparkle":
      return <SparkleIcon size={size} color={visualProfile.iconColor} />;
    case "gift-box":
      return <GiftBoxIcon size={size} color={visualProfile.iconColor} />;
    default:
      return <BoxIcon size={size} color={visualProfile.iconColor} />;
  }
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

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function shuffleArray<T>(items: T[]) {
  return items
    .map((item) => ({ item, sort: Math.random() }))
    .sort((left, right) => left.sort - right.sort)
    .map(({ item }) => item);
}

function getPathLength(points: Array<{ x: number; y: number }>) {
  let length = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    length += Math.hypot(current.x - previous.x, current.y - previous.y);
  }

  return length;
}

function getRayToPackEdge(
  centerX: number,
  centerY: number,
  angle: number,
  width: number,
  height: number,
) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const candidates: number[] = [];

  if (dx > 0) {
    candidates.push((width - centerX) / dx);
  } else if (dx < 0) {
    candidates.push((0 - centerX) / dx);
  }

  if (dy > 0) {
    candidates.push((height - centerY) / dy);
  } else if (dy < 0) {
    candidates.push((0 - centerY) / dy);
  }

  const distance = Math.min(...candidates.filter((candidate) => candidate > 0));

  return {
    x: centerX + dx * distance,
    y: centerY + dy * distance,
    dx,
    dy,
    distance,
  };
}

function createLightningCrackPath(
  centerX: number,
  centerY: number,
  angle: number,
  width: number,
  height: number,
) {
  const edge = getRayToPackEdge(centerX, centerY, angle, width, height);
  const normalX = -edge.dy;
  const normalY = edge.dx;
  const points = [{ x: centerX, y: centerY }];
  const segments = Math.floor(randomBetween(5, 8));

  for (let index = 1; index < segments; index += 1) {
    const progress = index / segments;
    const baseX = centerX + edge.dx * edge.distance * progress;
    const baseY = centerY + edge.dy * edge.distance * progress;
    const amplitude =
      Math.min(width * 0.1, edge.distance * 0.11) *
      Math.sin(Math.PI * progress);
    const offset = randomBetween(-amplitude, amplitude);

    points.push({
      x: baseX + normalX * offset,
      y: baseY + normalY * offset,
    });
  }

  points.push({ x: edge.x, y: edge.y });

  return {
    path: points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
      )
      .join(" "),
    dashLength: Math.ceil(getPathLength(points)),
  };
}

function createBurstPattern(width: number, height: number): PackBurstPattern {
  const centerX = width * 0.5;
  const centerY = height * 0.47;
  const crackCount = 9;
  const startAngle = randomBetween(0, Math.PI * 2);
  const crackAngles = Array.from({ length: crackCount }, (_, index) => {
    const evenlySpaced = startAngle + (Math.PI * 2 * index) / crackCount;
    return evenlySpaced + randomBetween(-0.24, 0.24);
  });

  const cracks = shuffleArray(crackAngles).map((angle, index) => {
    const crackPath = createLightningCrackPath(
      centerX,
      centerY,
      angle,
      width,
      height,
    );

    return {
      ...crackPath,
      delay: index * 0.05 + randomBetween(0, 0.03),
    };
  });

  const particles = Array.from({ length: 82 }, (_, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(140, 390);
    return {
      id: `particle-${index}`,
      travelX: Math.cos(angle) * distance,
      travelY: Math.sin(angle) * distance,
      size: randomBetween(4, 13),
      spin: `${Math.round(randomBetween(-540, 540))}deg`,
      color:
        BURST_PARTICLE_COLORS[
          Math.floor(randomBetween(0, BURST_PARTICLE_COLORS.length))
        ] ?? BURST_PARTICLE_COLORS[0],
    };
  });

  const shards = Array.from({ length: 18 }, (_, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(120, 330);
    return {
      id: `shard-${index}`,
      travelX: Math.cos(angle) * distance,
      travelY: Math.sin(angle) * distance,
      width: randomBetween(18, 28),
      height: randomBetween(30, 48),
      spin: `${Math.round(randomBetween(-760, 760))}deg`,
    };
  });

  return { cracks, particles, shards };
}

function createLoadingSparkles(baseSize: number) {
  const maxDistance = baseSize * 0.92;
  const minDistance = baseSize * 0.19;

  return Array.from({ length: 36 }, (_, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(minDistance, maxDistance);

    return {
      id: `sparkle-${index}`,
      travelX: Math.cos(angle) * distance,
      travelY: Math.sin(angle) * distance,
      size: randomBetween(baseSize * 0.028, baseSize * 0.074),
      delay: randomBetween(0, 0.18),
      rotation: randomBetween(0, 80),
    };
  });
}

function getTreasureRayPath(
  centerX: number,
  centerY: number,
  angleDeg: number,
  innerRadius: number,
  outerRadius: number,
  spreadDeg: number,
) {
  const startAngle = ((angleDeg - spreadDeg) * Math.PI) / 180;
  const endAngle = ((angleDeg + spreadDeg) * Math.PI) / 180;
  const tipAngle = (angleDeg * Math.PI) / 180;

  const startX = centerX + Math.cos(startAngle) * innerRadius;
  const startY = centerY + Math.sin(startAngle) * innerRadius;
  const endX = centerX + Math.cos(endAngle) * innerRadius;
  const endY = centerY + Math.sin(endAngle) * innerRadius;
  const tipX = centerX + Math.cos(tipAngle) * outerRadius;
  const tipY = centerY + Math.sin(tipAngle) * outerRadius;

  return `M ${startX.toFixed(1)} ${startY.toFixed(1)} L ${tipX.toFixed(1)} ${tipY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)} Z`;
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
          {getPackIcon(pack, iconSize)}
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
  sheenAnim,
}: {
  pack: Pack;
  width: number;
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
  compact?: boolean;
  pulseAnim?: Animated.Value;
  chargeAnim?: Animated.Value;
  sheenAnim?: Animated.Value;
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
          {
            rotateX: chargeAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: ["0deg", "6deg", "0deg"],
            }),
          },
          {
            rotateZ: chargeAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: ["-1deg", "1deg", "-1deg"],
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
        boxShadow: compact
          ? `0 18px 38px ${withAlpha("#000000", "52")}`
          : `0 22px 55px ${withAlpha("#000000", "72")}`,
        transform: animatedTransforms,
      }}
    >
      <PackFaceInterior pack={pack} tc={tc} compact={compact} />
      {sheenAnim ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -height * 0.08,
            bottom: -height * 0.08,
            width: width * 0.54,
            opacity: 0.42,
            transform: [
              {
                translateX: sheenAnim.interpolate({
                  inputRange: [0, 0.45, 0.7, 1],
                  outputRange: [
                    -width * 1.2,
                    -width * 1.2,
                    width * 1.2,
                    width * 1.2,
                  ],
                }),
              },
              { rotate: "16deg" },
            ],
          }}
        >
          <LinearGradient
            colors={[
              "rgba(255,255,255,0)",
              "rgba(255,255,255,0.35)",
              "rgba(255,255,255,0)",
            ]}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}
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

function PackOpeningAura({
  width,
  height,
  gradientId,
}: {
  width: number;
  height: number;
  gradientId: string;
}) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <SvgRadialGradient id={gradientId} cx="50%" cy="44%" r="58%">
          <Stop offset="0%" stopColor="rgba(255,226,128,0.5)" />
          <Stop offset="35%" stopColor="rgba(255,115,19,0.16)" />
          <Stop offset="68%" stopColor="rgba(255,115,19,0)" />
          <Stop offset="100%" stopColor="rgba(255,115,19,0)" />
        </SvgRadialGradient>
      </Defs>
      <Circle
        cx={width / 2}
        cy={height * 0.44}
        r={Math.min(width, height) * 0.38}
        fill={`url(#${gradientId})`}
      />
    </Svg>
  );
}

function PackLoadingGlow({
  width,
  anim,
  sparkles,
}: {
  width: number;
  anim: Animated.Value;
  sparkles: LoadingSparkle[];
}) {
  const size = width * 1.58;
  const centerX = size / 2;
  const centerY = size * 0.47;
  const glowOpacity = anim.interpolate({
    inputRange: [0, 0.2, 0.55, 1],
    outputRange: [0, 0.82, 0.74, 0.38],
    extrapolate: "clamp",
  });
  const glowScale = anim.interpolate({
    inputRange: [0, 0.2, 0.55, 1],
    outputRange: [0.12, 0.95, 1.2, 1.35],
    extrapolate: "clamp",
  });
  const glowBlurScale = anim.interpolate({
    inputRange: [0, 0.2, 0.55, 1],
    outputRange: [0.18, 1.02, 1.28, 1.48],
    extrapolate: "clamp",
  });
  const raysOpacity = anim.interpolate({
    inputRange: [0, 0.22, 1],
    outputRange: [0, 0.86, 0.42],
    extrapolate: "clamp",
  });
  const raysScale = anim.interpolate({
    inputRange: [0, 0.22, 1],
    outputRange: [0.15, 0.95, 1.18],
    extrapolate: "clamp",
  });
  const raysRotate = anim.interpolate({
    inputRange: [0, 0.22, 1],
    outputRange: ["0deg", "12deg", "36deg"],
    extrapolate: "clamp",
  });

  return (
    <View
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: size * 0.98,
          height: size * 0.98,
          opacity: glowOpacity.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0.34],
          }),
          transform: [{ scale: glowBlurScale }],
        }}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <SvgRadialGradient
              id="pack-loading-glow-blur"
              cx="50%"
              cy="50%"
              r="50%"
            >
              <Stop offset="0%" stopColor="rgba(255,255,235,0.34)" />
              <Stop offset="24%" stopColor="rgba(255,228,126,0.16)" />
              <Stop offset="54%" stopColor="rgba(255,172,45,0.05)" />
              <Stop offset="100%" stopColor="rgba(255,116,22,0)" />
            </SvgRadialGradient>
          </Defs>
          <Circle
            cx={centerX}
            cy={centerY}
            r={size * 0.49}
            fill="url(#pack-loading-glow-blur)"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          opacity: raysOpacity,
          transform: [{ scale: raysScale }, { rotate: raysRotate }],
        }}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`}>
          {TREASURE_RAY_SPECS.map((ray) => (
            <Path
              key={`treasure-ray-${ray.angle}`}
              d={getTreasureRayPath(
                centerX,
                centerY,
                ray.angle,
                size * ray.inner,
                size * ray.outer,
                ray.spread,
              )}
              fill={ray.color}
            />
          ))}
        </Svg>
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          width: size * 0.86,
          height: size * 0.86,
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
        }}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <SvgRadialGradient
              id="pack-loading-glow-core"
              cx="50%"
              cy="50%"
              r="50%"
            >
              <Stop offset="0%" stopColor="rgba(255,255,235,0.98)" />
              <Stop offset="8%" stopColor="rgba(255,255,235,0.98)" />
              <Stop offset="16%" stopColor="rgba(255,228,126,0.76)" />
              <Stop offset="35%" stopColor="rgba(255,172,45,0.24)" />
              <Stop offset="58%" stopColor="rgba(255,116,22,0.08)" />
              <Stop offset="73%" stopColor="rgba(255,116,22,0)" />
              <Stop offset="100%" stopColor="rgba(255,116,22,0)" />
            </SvgRadialGradient>
          </Defs>
          <Circle
            cx={centerX}
            cy={centerY}
            r={size * 0.43}
            fill="url(#pack-loading-glow-core)"
          />
        </Svg>
      </Animated.View>

      {sparkles.map((sparkle) => {
        const rise = Math.max(20, width * 0.18);
        const appearAt = sparkle.delay;
        const settleAt = Math.min(1, appearAt + 0.18);
        const driftAt = Math.min(1, appearAt + 0.55);
        const vanishAt = Math.min(1, appearAt + 0.86);

        return (
          <Animated.View
            key={sparkle.id}
            style={{
              position: "absolute",
              left: centerX - sparkle.size / 2,
              top: centerY - sparkle.size / 2,
              width: sparkle.size,
              height: sparkle.size,
              opacity: anim.interpolate({
                inputRange: [0, appearAt, settleAt, driftAt, vanishAt, 1],
                outputRange: [0, 0, 1, 0.95, 0, 0],
                extrapolate: "clamp",
              }),
              transform: [
                {
                  translateX: anim.interpolate({
                    inputRange: [0, appearAt, settleAt, driftAt, vanishAt, 1],
                    outputRange: [
                      0,
                      0,
                      sparkle.travelX * 0.82,
                      sparkle.travelX,
                      sparkle.travelX * 1.12,
                      sparkle.travelX * 1.12,
                    ],
                    extrapolate: "clamp",
                  }),
                },
                {
                  translateY: anim.interpolate({
                    inputRange: [0, appearAt, settleAt, driftAt, vanishAt, 1],
                    outputRange: [
                      0,
                      0,
                      sparkle.travelY * 0.82,
                      sparkle.travelY,
                      sparkle.travelY * 1.12 - rise,
                      sparkle.travelY * 1.12 - rise,
                    ],
                    extrapolate: "clamp",
                  }),
                },
                {
                  scale: anim.interpolate({
                    inputRange: [0, appearAt, settleAt, driftAt, vanishAt, 1],
                    outputRange: [0.15, 0.15, 1, 0.65, 0.1, 0.1],
                    extrapolate: "clamp",
                  }),
                },
                {
                  rotate: anim.interpolate({
                    inputRange: [0, appearAt, settleAt, driftAt, vanishAt, 1],
                    outputRange: [
                      `${sparkle.rotation}deg`,
                      `${sparkle.rotation}deg`,
                      `${sparkle.rotation + 70}deg`,
                      `${sparkle.rotation + 145}deg`,
                      `${sparkle.rotation + 250}deg`,
                      `${sparkle.rotation + 250}deg`,
                    ],
                    extrapolate: "clamp",
                  }),
                },
              ],
            }}
          >
            <View
              style={{
                position: "absolute",
                left: sparkle.size * 0.4,
                top: 0,
                width: sparkle.size * 0.2,
                height: sparkle.size,
                borderRadius: 999,
                backgroundColor: "#FFF9D8",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 0,
                top: sparkle.size * 0.4,
                width: sparkle.size,
                height: sparkle.size * 0.2,
                borderRadius: 999,
                backgroundColor: "#FFF9D8",
              }}
            />
          </Animated.View>
        );
      })}
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
  const resolvedPattern = burstPattern ?? createBurstPattern(width, height);
  const centerX = width / 2;
  const centerY = height * 0.47;
  const accentColor = pack.color || tc.primary;
  const packOpacity = openAnim.interpolate({
    inputRange: [0, 0.45, 0.72, 1],
    outputRange: [1, 1, 1, 0],
    extrapolate: "clamp",
  });
  const flareOpacity = openAnim.interpolate({
    inputRange: [0, 0.38, 0.68, 1],
    outputRange: [0, 0, 1, 0],
    extrapolate: "clamp",
  });
  const flareScale = openAnim.interpolate({
    inputRange: [0, 0.38, 0.68, 0.82, 1],
    outputRange: [0.2, 0.2, 3.5, 14, 14],
    extrapolate: "clamp",
  });
  const shockwaveOpacity = openAnim.interpolate({
    inputRange: [0, 0.62, 0.72, 1],
    outputRange: [0, 0, 0.95, 0],
    extrapolate: "clamp",
  });
  const shockwaveScale = openAnim.interpolate({
    inputRange: [0, 0.62, 1],
    outputRange: [0.2, 0.2, 5.5],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      style={{
        width,
        height,
        alignItems: "center",
        justifyContent: "center",
        opacity: packOpacity,
        transform: [
          {
            translateX: openAnim.interpolate({
              inputRange: [0, 0.18, 0.34, 0.52, 0.72, 0.94, 1],
              outputRange: [0, -2, 2, -3, 4, 3, 0],
              extrapolate: "clamp",
            }),
          },
          {
            translateY: openAnim.interpolate({
              inputRange: [0, 0.18, 0.34, 0.52, 0.72, 0.94, 1],
              outputRange: [0, 1, -2, -1, 2, -3, 0],
              extrapolate: "clamp",
            }),
          },
          {
            rotateZ: openAnim.interpolate({
              inputRange: [0, 0.18, 0.34, 0.52, 0.72, 0.94, 1],
              outputRange: [
                "0deg",
                "-1deg",
                "1.1deg",
                "-1.4deg",
                "1.9deg",
                "2.4deg",
                "25deg",
              ],
              extrapolate: "clamp",
            }),
          },
          {
            scale: openAnim.interpolate({
              inputRange: [0, 0.45, 0.72, 1],
              outputRange: [1, 1.06, 1.2, 0.42],
              extrapolate: "clamp",
            }),
          },
        ],
      }}
    >
      <PackFaceCanvas pack={pack} width={width} height={height} tc={tc} />
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: centerX - Math.max(18, width * 0.065),
          top: 24,
          width: Math.max(36, width * 0.16),
          height: height - 46,
          borderRadius: 999,
          backgroundColor: "rgba(255, 242, 170, 0.92)",
          opacity: openAnim.interpolate({
            inputRange: [0, 0.18, 0.62, 1],
            outputRange: [0, 0.85, 0, 0],
            extrapolate: "clamp",
          }),
          transform: [
            {
              scaleY: openAnim.interpolate({
                inputRange: [0, 0.62, 1],
                outputRange: [0.5, 1.18, 1.18],
                extrapolate: "clamp",
              }),
            },
            {
              scaleX: openAnim.interpolate({
                inputRange: [0, 0.62, 1],
                outputRange: [0.6, 1.7, 1.7],
                extrapolate: "clamp",
              }),
            },
          ],
        }}
      />
      <Svg
        pointerEvents="none"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        {resolvedPattern.cracks.flatMap((crack, crackIndex) => {
          const crackDrawEnd = Math.min(0.72, crack.delay + 0.24);
          const crackFadeStart = Math.min(0.82, crackDrawEnd + 0.18);
          const crackDashOffset = openAnim.interpolate({
            inputRange: [0, crack.delay, crackDrawEnd, 1],
            outputRange: [crack.dashLength, crack.dashLength, 0, 0],
            extrapolate: "clamp",
          });
          const crackOpacity = openAnim.interpolate({
            inputRange: [0, crack.delay, crackDrawEnd, crackFadeStart, 1],
            outputRange: [0, 0, 1, 0.8, 0],
            extrapolate: "clamp",
          });

          return [
            <AnimatedPath
              key={`crack-glow-${crackIndex}`}
              d={crack.path}
              fill="none"
              stroke="rgba(255, 116, 24, 0.85)"
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={crack.dashLength}
              strokeDashoffset={crackDashOffset}
              opacity={crackOpacity}
            />,
            <AnimatedPath
              key={`crack-core-${crackIndex}`}
              d={crack.path}
              fill="none"
              stroke="#FFF8BF"
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={crack.dashLength}
              strokeDashoffset={crackDashOffset}
              opacity={crackOpacity}
            />,
          ];
        })}
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: centerX - 15,
          top: centerY - 15,
          width: 30,
          height: 30,
          borderRadius: 999,
          backgroundColor: "#FFF2AA",
          opacity: flareOpacity,
          boxShadow:
            "0 0 18px rgba(255, 242, 170, 0.95), 0 0 42px rgba(255, 156, 37, 0.8), 0 0 80px rgba(255, 91, 18, 0.6)",
          transform: [{ scale: flareScale }],
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: centerX - 60,
          top: centerY - 60,
          width: 120,
          height: 120,
          borderRadius: 999,
          borderWidth: 3,
          borderColor: "rgba(255, 228, 130, 0.9)",
          opacity: shockwaveOpacity,
          transform: [{ scale: shockwaveScale }],
        }}
      />
      {resolvedPattern.particles.map((particle) => {
        return (
          <Animated.View
            key={particle.id}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: centerX - particle.size / 2,
              top: centerY - particle.size / 2,
              width: particle.size,
              height: particle.size,
              borderRadius: 999,
              backgroundColor: particle.color,
              boxShadow: `0 0 14px ${particle.color}`,
              opacity: openAnim.interpolate({
                inputRange: [0, 0.62, 0.68, 1],
                outputRange: [0, 0, 1, 0],
                extrapolate: "clamp",
              }),
              transform: [
                {
                  translateX: openAnim.interpolate({
                    inputRange: [0, 0.62, 0.76, 1],
                    outputRange: [
                      0,
                      0,
                      particle.travelX * 0.16,
                      particle.travelX,
                    ],
                    extrapolate: "clamp",
                  }),
                },
                {
                  translateY: openAnim.interpolate({
                    inputRange: [0, 0.62, 0.76, 1],
                    outputRange: [
                      0,
                      0,
                      particle.travelY * 0.16,
                      particle.travelY,
                    ],
                    extrapolate: "clamp",
                  }),
                },
                {
                  rotate: particle.spin,
                },
                {
                  scale: openAnim.interpolate({
                    inputRange: [0, 0.62, 0.74, 1],
                    outputRange: [0.5, 0.5, 1, 0],
                    extrapolate: "clamp",
                  }),
                },
              ],
            }}
          />
        );
      })}
      {resolvedPattern.shards.map((shard) => {
        return (
          <Animated.View
            key={shard.id}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: centerX - shard.width / 2,
              top: centerY - shard.height / 2,
              width: shard.width,
              height: shard.height,
              opacity: openAnim.interpolate({
                inputRange: [0, 0.62, 0.68, 1],
                outputRange: [0, 0, 1, 0],
                extrapolate: "clamp",
              }),
              transform: [
                {
                  translateX: openAnim.interpolate({
                    inputRange: [0, 0.62, 0.76, 1],
                    outputRange: [0, 0, shard.travelX * 0.16, shard.travelX],
                    extrapolate: "clamp",
                  }),
                },
                {
                  translateY: openAnim.interpolate({
                    inputRange: [0, 0.62, 0.76, 1],
                    outputRange: [0, 0, shard.travelY * 0.16, shard.travelY],
                    extrapolate: "clamp",
                  }),
                },
                { rotate: shard.spin },
                {
                  scale: openAnim.interpolate({
                    inputRange: [0, 0.62, 0.74, 1],
                    outputRange: [0.8, 0.8, 1, 1.25],
                    extrapolate: "clamp",
                  }),
                },
              ],
            }}
          >
            <LinearGradient
              colors={["rgba(255,225,121,0.95)", "rgba(137,54,12,0.95)"]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={{
                flex: 1,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: withAlpha(accentColor, "88"),
                boxShadow: "0 0 14px rgba(255, 168, 42, 0.6)",
                transform: [{ rotate: "18deg" }],
              }}
            />
          </Animated.View>
        );
      })}
    </Animated.View>
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
      <Text
        className="font-nunito-bold text-[11px]"
        style={{ color: textColor }}
      >
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
  const headerHeight = useAppHeaderHeight();
  const bottomTabPadding = useBottomTabBarContentPadding();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [phase, setPhase] = useState<OpeningPhase>("selecting");
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [openedCards, setOpenedCards] = useState<OpenedCard[]>([]);
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [openingRunId, setOpeningRunId] = useState(0);
  const [openError, setOpenError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [burstPattern, setBurstPattern] = useState<PackBurstPattern>(() =>
    createBurstPattern(320, 320 / PACK_CARD_RATIO),
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
  const sheenAnim = useAnimatedValue(0);
  const burstFlashAnim = useRef(new Animated.Value(0)).current;
  const loadingIdleAnim = useRef(new Animated.Value(0)).current;
  const loadingProgressAnim = useRef(new Animated.Value(0)).current;
  const stackSpreadAnim = useRef(new Animated.Value(0)).current;
  const readyRevealAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const burstOpenAnim = useRef(new Animated.Value(0)).current;
  const chargeLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const sheenLoopRef = useRef<Animated.CompositeAnimation | null>(null);
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
      Animated.timing(loadingIdleAnim, {
        toValue: 1,
        duration: 2450,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
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
    sheenLoopRef.current?.stop();
    sheenLoopRef.current = null;
  }

  function startChargeAnimation() {
    stopChargeAnimations();
    chargeAnim.setValue(0);
    sheenAnim.setValue(0);

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

    sheenLoopRef.current = Animated.loop(
      Animated.timing(sheenAnim, {
        toValue: 1,
        duration: 3400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    sheenLoopRef.current.start();
  }

  function startBurstAnimation() {
    stopChargeAnimations();
    burstFlashAnim.setValue(0);
    burstOpenAnim.setValue(0);
    setBurstPattern(
      createBurstPattern(stageCardWidth, stageCardWidth / PACK_CARD_RATIO),
    );

    Animated.parallel([
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
    setOpeningRunId((value) => value + 1);

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

      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => null);
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
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      ).catch(() => null);
    } finally {
      setIsOpening(false);
    }
  }

  function revealNext() {
    const nextIndex = revealedIndex + 1;

    if (nextIndex >= openedCards.length) {
      setPhase("complete");
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => null);
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
    sheenAnim.setValue(0);
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
          packsQuery.error ? undefined : t("common.errorStates.generic.body")
        }
        detail={
          packsQuery.error ? undefined : t("common.errorStates.generic.detail")
        }
        onRetry={() => {
          void packsQuery.refetch();
        }}
      />
    );
  }

  const packs = packsQuery.data.packs;
  const affordablePacks = packs.filter((pack) => pack.cost <= coins);
  const cheapestLockedPack = packs.reduce<Pack | undefined>(
    (cheapest, pack) => {
      if (pack.cost <= coins) {
        return cheapest;
      }

      if (!cheapest || pack.cost < cheapest.cost) {
        return pack;
      }

      return cheapest;
    },
    undefined,
  );
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

  if (
    (phase === "shaking" || phase === "bursting" || phase === "loading") &&
    selectedPack
  ) {
    const isLoadingPhase = phase === "loading";
    const isChargePhase = phase === "shaking";
    const openingAccent = selectedPack.color || "#D58524";
    const chargePreviewWidth = Math.min(stageCardWidth, 230);
    const openingStageHeight = Math.min(Math.max(height * 0.62, 420), 620);
    const openingFooterReserve = Math.min(Math.max(height * 0.24, 196), 252);
    const badgeBackgroundColor = withAlpha(
      openingAccent,
      themeName === "nightosphere" ? "26" : "1F",
    );
    const titleChipBackgroundColor =
      themeName === "nightosphere"
        ? withAlpha(tc.surface, "CC")
        : withAlpha(tc.surface, "E8");
    const progressTrackColor =
      themeName === "nightosphere"
        ? withAlpha(tc.primaryBorder, "44")
        : withAlpha(tc.fgMuted, "22");

    return (
      <View
        testID={
          isLoadingPhase ? "pack-opening-loading" : "pack-opening-shaking"
        }
        className="flex-1 bg-bg"
      >
        <View
          className="flex-1 px-4"
          style={{
            paddingTop: headerHeight + 16,
            paddingBottom: openingBottomPadding,
          }}
        >
          <View className="flex-1 justify-center">
            <View
              className="self-center overflow-hidden rounded-[28px]"
              style={{
                width: "100%",
                maxWidth: 520,
                height: openingStageHeight,
              }}
            >
              <PackOpeningSequenceDom
                key={`${openingRunId}`}
                mode={
                  isLoadingPhase
                    ? "loading"
                    : phase === "bursting"
                      ? "burst"
                      : "charge"
                }
                pack={{
                  backgroundColor: tc.bg,
                  cardCountLabel: t("packs.cardsCount", {
                    count: selectedPack.cardCount,
                  }),
                  color: selectedPack.color || "#C96A24",
                  guaranteedRarity: selectedPack.guaranteedRarity,
                  name: selectedPack.name,
                }}
                dom={{
                  contentInsetAdjustmentBehavior: "never",
                  scrollEnabled: false,
                  style: {
                    backgroundColor: "transparent",
                    flex: 1,
                    opacity: isChargePhase ? 0 : 1,
                  },
                }}
              />
              {isChargePhase ? (
                <View className="absolute inset-0 items-center justify-center">
                  <PackPreviewCard
                    pack={selectedPack}
                    width={chargePreviewWidth}
                    tc={tc}
                    chargeAnim={chargeAnim}
                    sheenAnim={sheenAnim}
                  />
                </View>
              ) : null}
            </View>
          </View>

          <View
            className="w-full max-w-[340px] self-center gap-3 pb-2"
            style={{ minHeight: openingFooterReserve }}
          >
            {isLoadingPhase ? (
              <>
                <SectionBadge
                  icon={<EyeIcon size={12} color={openingAccent} />}
                  label={t("packs.opening.syncingProgress")}
                  backgroundColor={badgeBackgroundColor}
                  textColor={openingAccent}
                />
                <Text
                  className="text-center font-nunito text-sm"
                  style={{ color: tc.fgMuted }}
                >
                  {t("packs.opening.sortingBody")}
                </Text>
                <View
                  className="overflow-hidden rounded-full"
                  style={{
                    backgroundColor: progressTrackColor,
                    height: 12,
                  }}
                >
                  <Animated.View
                    style={{
                      width: loadingProgressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ["0%", "100%"],
                      }),
                      height: "100%",
                      borderRadius: 999,
                      backgroundColor: openingAccent,
                    }}
                  />
                </View>
                <Text
                  className="text-center font-nunito text-sm"
                  style={{ color: tc.fgMuted }}
                >
                  {loadingProgress}%
                </Text>
              </>
            ) : (
              <Text
                className="text-center font-nunito-bold text-sm"
                style={{ color: tc.fg }}
              >
                {t("packs.opening.packOpened", { name: selectedPack.name })}
              </Text>
            )}

            <View
              className="self-center rounded-full px-4 py-1.5"
              style={{ backgroundColor: titleChipBackgroundColor }}
            >
              <Text
                className="font-nunito-bold text-[12px]"
                style={{ color: tc.fgMuted }}
              >
                {isLoadingPhase
                  ? t("packs.opening.sortingTitle")
                  : t("packs.opening.chargeTitle")}
              </Text>
            </View>
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
          className="flex-1 px-4"
          style={{
            paddingTop: headerHeight + 24,
            paddingBottom: openingBottomPadding,
          }}
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
          className="flex-1 px-4"
          style={{
            paddingTop: headerHeight + 20,
            paddingBottom: openingBottomPadding,
          }}
        >
          <View className="w-full max-w-[360px] self-center gap-3">
            <View className="flex-row items-center justify-between">
              <Text
                className="font-nunito-bold text-base"
                style={{ color: rarityRing }}
              >
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
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: bottomTabPadding,
          gap: 18,
        }}
      >
        <View style={{ height: headerHeight }} />
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
              style={{
                backgroundColor: tc.surface,
                borderColor: tc.primaryBorder,
              }}
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
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: bottomTabPadding,
          gap: 18,
        }}
      >
        <View style={{ height: headerHeight }} />
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
              label={t("packs.affordableCount", {
                count: affordablePacks.length,
              })}
              backgroundColor={tc.successTint}
              textColor={tc.successText}
            />

            {heroPack ? (
              <Pressable
                onPress={() =>
                  !isOpening && heroCanAfford && void openPack(heroPack)
                }
                disabled={isOpening || !heroCanAfford}
                style={{ opacity: heroCanAfford ? 1 : 0.82 }}
              >
                <View
                  className="flex-row items-center justify-between rounded-[24px] px-5 py-4"
                  style={{
                    backgroundColor: heroCanAfford
                      ? tc.primaryStrong
                      : tc.surfaceMuted,
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
                      style={{
                        color: heroCanAfford
                          ? "rgba(255,255,255,0.82)"
                          : tc.fgMuted,
                      }}
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
                      style={{
                        color: heroCanAfford ? "#FFFFFF" : tc.primaryStrong,
                      }}
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
                      {getPackIcon(pack, 34)}
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
                            icon={
                              <SparklesIcon size={11} color={tc.accentText} />
                            }
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
                          style={{
                            color: canAfford ? tc.primaryText : tc.fgMuted,
                          }}
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
