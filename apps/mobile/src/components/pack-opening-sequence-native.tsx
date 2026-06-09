import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Animated, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient as SvgRadialGradient,
  Stop,
} from "react-native-svg";

import {
  BoxIcon,
  CrownIcon,
  DiamondIcon,
  GiftBoxIcon,
  SparkleIcon,
} from "./icons";
import {
  getPackOpeningVisualProfile,
  type PackVisualIconKind,
} from "./pack-opening-visuals";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const CARD_W = 230;
const CARD_H = 330;
const SHELL_W = 620;
const SHELL_H = 620;
const CENTER = { x: CARD_W * 0.5, y: CARD_H * 0.47 };
const SHELL_CENTER = { x: SHELL_W * 0.5, y: SHELL_H * 0.47 };
const CARD_ORIGIN = {
  x: SHELL_CENTER.x - CENTER.x,
  y: SHELL_CENTER.y - CENTER.y,
};
const BURST_FRACTIONS = {
  crackDraw: 0.5 / 2.2,
  crackFadeStart: 1.42 / 2.2,
  flareBuildEnd: 1.45 / 2.2,
  flarePopEnd: 1.87 / 2.2,
  shockwaveStart: 1.45 / 2.2,
  shockwaveEnd: 2.15 / 2.2,
  particleStart: 1.45 / 2.2,
  lightStart: 1.52 / 2.2,
};
const RAY_SEGMENTS = [
  { from: 14, to: 20, tone: "highlight", opacity: 0.56 },
  { from: 41, to: 48, tone: "soft", opacity: 0.42 },
  { from: 77, to: 84, tone: "white", opacity: 0.5 },
  { from: 117, to: 124, tone: "base", opacity: 0.38 },
  { from: 161, to: 169, tone: "highlight", opacity: 0.5 },
  { from: 211, to: 218, tone: "base", opacity: 0.38 },
  { from: 255, to: 262, tone: "white", opacity: 0.48 },
  { from: 303, to: 310, tone: "soft", opacity: 0.42 },
] as const;

type PackAnimationData = {
  backgroundColor: string;
  cardCountLabel: string;
  color: string;
  guaranteedRarity?: string | null;
  name: string;
};

type PackOpeningSequenceMode = "burst" | "charge" | "loading";

type Crack = {
  dashLength: number;
  delay: number;
  id: string;
  path: string;
};

type Particle = {
  color: string;
  id: string;
  size: number;
  spin: number;
  x: number;
  y: number;
};

type Shard = {
  id: string;
  spin: number;
  x: number;
  y: number;
};

type Sparkle = {
  delay: number;
  id: string;
  loadingDelay: number;
  size: number;
  x: number;
  y: number;
};

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string) {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#C96A24";
  return {
    b: Number.parseInt(normalized.slice(5, 7), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    r: Number.parseInt(normalized.slice(1, 3), 16),
  };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHex(baseHex: string, targetHex: string, amount: number) {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  const channels: Array<keyof typeof base> = ["r", "g", "b"];

  return `#${channels
    .map((channel) =>
      clampChannel(
        base[channel] + (target[channel] - base[channel]) * amount,
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function shuffleArray<T>(items: T[]) {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((left, right) => left.sort - right.sort)
    .map(({ item }) => item);
}

function getRayToCardEdge(angle: number) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const candidates: number[] = [];

  if (dx > 0) {
    candidates.push((CARD_W - CENTER.x) / dx);
  }
  if (dx < 0) {
    candidates.push((0 - CENTER.x) / dx);
  }
  if (dy > 0) {
    candidates.push((CARD_H - CENTER.y) / dy);
  }
  if (dy < 0) {
    candidates.push((0 - CENTER.y) / dy);
  }

  const distance = Math.min(...candidates.filter((candidate) => candidate > 0));

  return {
    x: CENTER.x + dx * distance,
    y: CENTER.y + dy * distance,
    dx,
    dy,
    distance,
  };
}

function createLightningCrackPath(angle: number) {
  const edge = getRayToCardEdge(angle);
  const normalX = -edge.dy;
  const normalY = edge.dx;
  const points = [CENTER];
  const segments = Math.floor(randomBetween(5, 8));

  for (let index = 1; index < segments; index += 1) {
    const progress = index / segments;
    const baseX = CENTER.x + edge.dx * edge.distance * progress;
    const baseY = CENTER.y + edge.dy * edge.distance * progress;
    const amplitude =
      Math.min(22, edge.distance * 0.11) * Math.sin(Math.PI * progress);
    const offset = randomBetween(-amplitude, amplitude);

    points.push({
      x: baseX + normalX * offset,
      y: baseY + normalY * offset,
    });
  }

  points.push({ x: edge.x, y: edge.y });

  return {
    dashLength: Math.ceil(
      points.slice(1).reduce((length, point, index) => {
        const previousPoint = points[index];
        if (!previousPoint) {
          return length;
        }
        return (
          length +
          Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y)
        );
      }, 0),
    ),
    path: points
      .map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
      )
      .join(" "),
  };
}

function buildCracks(): Crack[] {
  const count = 7;
  const start = randomBetween(0, Math.PI * 2);
  const angles = Array.from({ length: count }, (_, index) => {
    const evenlySpaced = start + (Math.PI * 2 * index) / count;
    return evenlySpaced + randomBetween(-0.24, 0.24);
  });

  return shuffleArray(angles).map((angle, index) => {
    const path = createLightningCrackPath(angle);
    return {
      ...path,
      delay: index * 0.075 + randomBetween(0, 0.045),
      id: `crack-${index}`,
    };
  });
}

function buildParticlePalette(packColor: string, iconColor: string) {
  return [
    mixHex(packColor, "#FFFFFF", 0.74),
    mixHex(packColor, "#FFFFFF", 0.46),
    packColor,
    iconColor,
    mixHex(packColor, "#140707", 0.34),
  ];
}

function buildBurstElements(pack: PackAnimationData) {
  const profile = getPackOpeningVisualProfile(pack);
  const particlePalette = buildParticlePalette(pack.color, profile.iconColor);
  const particles = Array.from({ length: 18 }, (_, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(135, 290);
    return {
      color:
        particlePalette[
          Math.floor(randomBetween(0, particlePalette.length))
        ] ?? particlePalette[0],
      id: `particle-${index}`,
      size: randomBetween(5, 11),
      spin: randomBetween(-360, 360),
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  });

  const shards = Array.from({ length: 6 }, (_, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(110, 240);
    return {
      id: `shard-${index}`,
      spin: randomBetween(-520, 520),
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  });

  return { particles, shards };
}

function buildSparkles(count: number): Sparkle[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(52, 190);
    return {
      delay: 1.54 + randomBetween(0, 0.55),
      id: `sparkle-${index}`,
      loadingDelay: randomBetween(0, 3.4),
      size: randomBetween(7, 15),
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  });
}

function createBurstPattern(pack: PackAnimationData) {
  const visualProfile = getPackOpeningVisualProfile(pack);
  const burst = buildBurstElements(pack);

  return {
    cracks: buildCracks(),
    particles: burst.particles,
    shards: burst.shards,
    sparkles: buildSparkles(visualProfile.sparkCount),
  };
}

function buildRayRingPath(
  startDeg: number,
  endDeg: number,
  innerRadius: number,
  outerRadius: number,
) {
  const start = (startDeg * Math.PI) / 180;
  const end = (endDeg * Math.PI) / 180;
  const outerStartX = SHELL_CENTER.x + Math.cos(start) * outerRadius;
  const outerStartY = SHELL_CENTER.y + Math.sin(start) * outerRadius;
  const outerEndX = SHELL_CENTER.x + Math.cos(end) * outerRadius;
  const outerEndY = SHELL_CENTER.y + Math.sin(end) * outerRadius;
  const innerEndX = SHELL_CENTER.x + Math.cos(end) * innerRadius;
  const innerEndY = SHELL_CENTER.y + Math.sin(end) * innerRadius;
  const innerStartX = SHELL_CENTER.x + Math.cos(start) * innerRadius;
  const innerStartY = SHELL_CENTER.y + Math.sin(start) * innerRadius;
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  return [
    `M ${outerStartX.toFixed(1)} ${outerStartY.toFixed(1)}`,
    `A ${outerRadius.toFixed(1)} ${outerRadius.toFixed(1)} 0 ${largeArc} 1 ${outerEndX.toFixed(1)} ${outerEndY.toFixed(1)}`,
    `L ${innerEndX.toFixed(1)} ${innerEndY.toFixed(1)}`,
    `A ${innerRadius.toFixed(1)} ${innerRadius.toFixed(1)} 0 ${largeArc} 0 ${innerStartX.toFixed(1)} ${innerStartY.toFixed(1)}`,
    "Z",
  ].join(" ");
}

function PackOpeningIcon({
  iconKind,
  iconColor,
}: {
  iconColor: string;
  iconKind: PackVisualIconKind;
}) {
  const iconSize = 68;

  switch (iconKind) {
    case "crown":
      return <CrownIcon size={iconSize} color={iconColor} />;
    case "diamond":
      return <DiamondIcon size={iconSize} color={iconColor} />;
    case "sparkle":
      return <SparkleIcon size={iconSize} color={iconColor} />;
    case "gift-box":
      return <GiftBoxIcon size={iconSize} color={iconColor} />;
    default:
      return <BoxIcon size={iconSize} color={iconColor} />;
  }
}

function SparkleGlyph({ size }: { size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
      }}
    >
      <View
        style={{
          position: "absolute",
          left: size * 0.4,
          top: 0,
          width: size * 0.2,
          height: size,
          borderRadius: 999,
          backgroundColor: "rgba(255, 250, 232, 0.92)",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 0,
          top: size * 0.4,
          width: size,
          height: size * 0.2,
          borderRadius: 999,
          backgroundColor: "rgba(255, 250, 232, 0.92)",
        }}
      />
    </View>
  );
}

function CardShell({
  chargeAnim,
  chargeEnabled = true,
  glowColor,
  highlightColor,
  iconColor,
  iconKind,
  pack,
  packBorder,
  packBright,
  packDark,
  packDeep,
  packSoft,
  packSurface,
  positioned = true,
  sheenAnim,
}: {
  chargeAnim: Animated.Value;
  chargeEnabled?: boolean;
  glowColor: string;
  highlightColor: string;
  iconColor: string;
  iconKind: PackVisualIconKind;
  pack: PackAnimationData;
  packBorder: string;
  packBright: string;
  packDark: string;
  packDeep: string;
  packSoft: string;
  packSurface: string;
  positioned?: boolean;
  sheenAnim: Animated.Value;
}) {
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: positioned ? CARD_ORIGIN.x : 0,
        top: positioned ? CARD_ORIGIN.y : 0,
        width: CARD_W,
        height: CARD_H,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: `0 0 0 5px #2A1407, 0 0 0 9px ${packBorder}, 0 18px 38px rgba(0, 0, 0, 0.62), 0 0 24px ${rgba(pack.color, 0.28)}`,
        transform: chargeEnabled
          ? [
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
              {
                translateY: chargeAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, -8, 0],
                }),
              },
            ]
          : undefined,
      }}
    >
      <LinearGradient
        colors={[packSoft, pack.color, packDeep, packDark, packBright]}
        locations={[0, 0.16, 0.34, 0.72, 1]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={{ position: "absolute", inset: 0 }}
      />

      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          inset: 0,
          opacity: chargeAnim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.06, 0.16, 0.06],
          }),
          backgroundColor: "rgba(255,255,255,0.12)",
        }}
      />

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          inset: 17,
          borderRadius: 13,
          overflow: "hidden",
          boxShadow:
            "inset 0 0 0 4px #1D0D04, inset 0 0 0 9px rgba(255,255,255,0.08), inset 0 0 32px rgba(0,0,0,0.65)",
        }}
      >
        <LinearGradient
          colors={[
            rgba("#FFFFFF", 0.18),
            packSurface,
            rgba(packSoft, 0.94),
            rgba(pack.color, 0.96),
            packDark,
          ]}
          locations={[0, 0.08, 0.24, 0.52, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 40,
            right: 40,
            top: -12,
            height: 80,
            borderRadius: 80,
            backgroundColor: rgba("#FFFFFF", 0.22),
            opacity: 0.55,
          }}
        />
      </View>

      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: 130,
          opacity: 0.52,
          transform: [
            {
              translateX: sheenAnim.interpolate({
                inputRange: [0, 0.45, 0.7, 1],
                outputRange: [-276, -276, 276, 276],
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

      <View
        style={{
          position: "absolute",
          inset: 17,
          borderRadius: 13,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 30,
          paddingBottom: 24,
          paddingHorizontal: 18,
        }}
      >
        <View
          style={{
            width: 108,
            height: 108,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255, 255, 255, 0.16)",
            boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.22), 0 10px 18px ${rgba(glowColor, 0.16)}`,
          }}
        >
          <View
            style={{
              boxShadow: `0 0 8px ${rgba(highlightColor, 0.3)}`,
            }}
          >
            <PackOpeningIcon iconKind={iconKind} iconColor={iconColor} />
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ width: "100%", alignItems: "center", gap: 12 }}>
          <Text
            style={{
              color: "#FFF8F0",
              fontFamily: "Nunito_800ExtraBold",
              fontSize: 28,
              lineHeight: 29,
              letterSpacing: 0.56,
              textAlign: "center",
              textShadowColor: "rgba(0,0,0,0.3)",
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 12,
            }}
          >
            {pack.name}
          </Text>
          <View
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.16)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
            }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,0.92)",
                fontFamily: "Nunito_700Bold",
                fontSize: 13,
              }}
            >
              {pack.cardCountLabel}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export default function PackOpeningSequenceNative({
  burstAnim,
  chargeAnim,
  mode,
  loadingAnim,
  pack,
  sheenAnim,
  width,
}: {
  burstAnim: Animated.Value;
  chargeAnim: Animated.Value;
  mode: PackOpeningSequenceMode;
  loadingAnim: Animated.Value;
  pack: PackAnimationData;
  sheenAnim: Animated.Value;
  width: number;
}) {
  const visualProfile = getPackOpeningVisualProfile(pack);
  const [{ cracks, particles, shards, sparkles }] = useState(() =>
    createBurstPattern(pack),
  );

  const scale = width / CARD_W;
  const packBright = mixHex(pack.color, "#FFF7DF", 0.52);
  const packSoft = mixHex(pack.color, "#FFF4EC", 0.28);
  const packSurface = mixHex(pack.color, "#FFF7F3", 0.48);
  const packDark = mixHex(pack.color, "#2A1407", 0.56);
  const packDeep = mixHex(pack.color, "#130907", 0.74);
  const packBorder = mixHex(pack.color, "#F3C55E", 0.38);
  const packHighlight = mixHex(pack.color, "#FFF6C5", 0.72);
  const packShadow = mixHex(pack.color, "#331007", 0.72);

  const lightOpacity =
    mode === "loading"
      ? loadingAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.58, 0.74, 0.58],
        })
      : burstAnim.interpolate({
          inputRange: [
            0,
            BURST_FRACTIONS.lightStart,
            0.82,
            1,
          ],
          outputRange: [0, 0, 0.95, 0.66],
          extrapolate: "clamp",
        });
  const lightScale =
    mode === "loading"
      ? loadingAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.9, 1, 0.9],
        })
      : burstAnim.interpolate({
          inputRange: [0, BURST_FRACTIONS.lightStart, 0.82, 1],
          outputRange: [0.12, 0.12, 1.02, 0.9],
          extrapolate: "clamp",
        });
  const raysOpacity =
    mode === "loading"
      ? loadingAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.34, 0.46, 0.36],
        })
      : burstAnim.interpolate({
          inputRange: [0, BURST_FRACTIONS.lightStart, 0.78, 1],
          outputRange: [0, 0, 0.72, 0.34],
          extrapolate: "clamp",
        });
  const raysScale =
    mode === "loading"
      ? loadingAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.8, 0.88, 0.82],
        })
      : burstAnim.interpolate({
          inputRange: [0, BURST_FRACTIONS.lightStart, 0.78, 1],
          outputRange: [0.15, 0.15, 0.95, 0.8],
          extrapolate: "clamp",
        });
  const raysRotate =
    mode === "loading"
      ? loadingAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: ["20deg", "34deg", "48deg"],
        })
      : burstAnim.interpolate({
          inputRange: [0, BURST_FRACTIONS.lightStart, 0.78, 1],
          outputRange: ["0deg", "0deg", "12deg", "20deg"],
          extrapolate: "clamp",
        });

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        inset: 0,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          width: SHELL_W,
          height: SHELL_H,
          transform: [{ scale }],
        }}
      >
        <Svg
          width={SHELL_W}
          height={SHELL_H}
          viewBox={`0 0 ${SHELL_W} ${SHELL_H}`}
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          <Defs>
            <SvgRadialGradient id="pack-backdrop-1" cx="50%" cy="38%" r="42%">
              <Stop offset="0%" stopColor={rgba(packHighlight, 0.14)} />
              <Stop offset="100%" stopColor={rgba(packHighlight, 0)} />
            </SvgRadialGradient>
            <SvgRadialGradient id="pack-backdrop-2" cx="50%" cy="56%" r="48%">
              <Stop offset="0%" stopColor={rgba(pack.color, 0.1)} />
              <Stop offset="100%" stopColor={rgba(pack.color, 0)} />
            </SvgRadialGradient>
            <SvgRadialGradient id="pack-backdrop-3" cx="50%" cy="68%" r="58%">
              <Stop offset="0%" stopColor={rgba(packShadow, 0.1)} />
              <Stop offset="100%" stopColor={rgba(packShadow, 0)} />
            </SvgRadialGradient>
            <SvgRadialGradient id="pack-aura-gradient" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={rgba(packHighlight, 0.42)} />
              <Stop offset="36%" stopColor={rgba(pack.color, 0.14)} />
              <Stop offset="66%" stopColor={rgba(pack.color, 0)} />
            </SvgRadialGradient>
            <SvgRadialGradient id="pack-light-gradient" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="rgba(255,255,245,0.98)" />
              <Stop offset="8%" stopColor="rgba(255,255,245,0.98)" />
              <Stop offset="16%" stopColor={rgba(packHighlight, 0.86)} />
              <Stop offset="35%" stopColor={rgba(pack.color, 0.42)} />
              <Stop offset="58%" stopColor={rgba(packShadow, 0.14)} />
              <Stop offset="73%" stopColor={rgba(packShadow, 0)} />
            </SvgRadialGradient>
            <SvgLinearGradient id="pack-shard-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={rgba(packHighlight, 0.95)} />
              <Stop offset="100%" stopColor={rgba(packShadow, 0.95)} />
            </SvgLinearGradient>
          </Defs>

          <Circle cx={SHELL_CENTER.x} cy={SHELL_H * 0.38} r={110} fill="url(#pack-backdrop-1)" />
          <Circle cx={SHELL_CENTER.x} cy={SHELL_H * 0.56} r={140} fill="url(#pack-backdrop-2)" />
          <Circle cx={SHELL_CENTER.x} cy={SHELL_H * 0.68} r={175} fill="url(#pack-backdrop-3)" />
        </Svg>

        <Animated.View
          style={{
            position: "absolute",
            left: SHELL_CENTER.x - 175,
            top: SHELL_CENTER.y - 175,
            width: 350,
            height: 350,
            opacity:
              mode === "charge"
                ? chargeAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.45, 0.72, 0.45],
                  })
                : mode === "burst"
                  ? burstAnim.interpolate({
                      inputRange: [0, 0.42, 0.72, 1],
                      outputRange: [0.72, 0.92, 0.84, 0.4],
                      extrapolate: "clamp",
                    })
                  : loadingAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.4, 0.5, 0.4],
                    }),
            transform: [
              {
                scale:
                  mode === "charge"
                    ? chargeAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.74, 0.94, 0.74],
                      })
                    : mode === "burst"
                      ? burstAnim.interpolate({
                          inputRange: [0, 0.42, 0.72, 1],
                          outputRange: [0.9, 1, 1.08, 0.95],
                          extrapolate: "clamp",
                        })
                      : loadingAnim.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [0.95, 1.02, 0.95],
                        }),
              },
            ],
          }}
        >
          <Svg width={350} height={350} viewBox="0 0 350 350">
            <Circle cx="175" cy="175" r="175" fill="url(#pack-aura-gradient)" />
          </Svg>
        </Animated.View>

        {mode !== "charge" ? (
          <>
            <Animated.View
              style={{
                position: "absolute",
                left: SHELL_CENTER.x - 220,
                top: SHELL_CENTER.y - 220,
                width: 440,
                height: 440,
                opacity: lightOpacity,
                transform: [{ scale: lightScale }],
              }}
            >
              <Svg width={440} height={440} viewBox="0 0 440 440">
                <Circle cx="220" cy="220" r="220" fill="url(#pack-light-gradient)" />
              </Svg>
            </Animated.View>

            <Animated.View
              style={{
                position: "absolute",
                left: SHELL_CENTER.x - 260,
                top: SHELL_CENTER.y - 260,
                width: 520,
                height: 520,
                opacity: raysOpacity,
                transform: [{ scale: raysScale }, { rotate: raysRotate }],
              }}
            >
              <Svg width={520} height={520} viewBox={`0 0 ${SHELL_W} ${SHELL_H}`}>
                {RAY_SEGMENTS.map((segment) => {
                  const fill =
                    segment.tone === "highlight"
                      ? rgba(packHighlight, segment.opacity)
                      : segment.tone === "soft"
                        ? rgba(packSoft, segment.opacity)
                        : segment.tone === "base"
                          ? rgba(pack.color, segment.opacity)
                          : `rgba(255,255,255,${segment.opacity})`;

                  return (
                    <Path
                      key={`${segment.from}-${segment.to}`}
                      d={buildRayRingPath(segment.from + 8, segment.to + 8, 95, 300)}
                      fill={fill}
                    />
                  );
                })}
              </Svg>
            </Animated.View>
          </>
        ) : null}

        {mode === "charge" ? (
          <CardShell
            chargeAnim={chargeAnim}
            glowColor={packShadow}
            highlightColor={packHighlight}
            iconColor={visualProfile.iconColor}
            iconKind={visualProfile.iconKind}
            pack={pack}
            packBorder={packBorder}
            packBright={packBright}
            packDark={packDark}
            packDeep={packDeep}
            packSoft={packSoft}
            packSurface={packSurface}
            sheenAnim={sheenAnim}
          />
        ) : null}

        {mode === "burst" ? (
          <>
            <Animated.View
              style={{
                position: "absolute",
                left: CARD_ORIGIN.x,
                top: CARD_ORIGIN.y,
                width: CARD_W,
                height: CARD_H,
                opacity: burstAnim.interpolate({
                  inputRange: [0, 0.78, 1],
                  outputRange: [1, 1, 0],
                  extrapolate: "clamp",
                }),
                transform: [
                  {
                    translateX: burstAnim.interpolate({
                      inputRange: [0, 0.18, 0.34, 0.52, 0.72, 0.94, 1],
                      outputRange: [0, -2, 2, -3, 4, 3, 0],
                    }),
                  },
                  {
                    translateY: burstAnim.interpolate({
                      inputRange: [0, 0.18, 0.34, 0.52, 0.72, 0.94, 1],
                      outputRange: [0, 1, -2, -1, 2, -3, 0],
                    }),
                  },
                  {
                    rotateZ: burstAnim.interpolate({
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
                    }),
                  },
                  {
                    scale: burstAnim.interpolate({
                      inputRange: [0, 0.66, 0.78, 1],
                      outputRange: [1, 1.06, 1.2, 0.42],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              }}
            >
              <CardShell
                chargeAnim={chargeAnim}
                chargeEnabled={false}
                glowColor={packShadow}
                highlightColor={packHighlight}
                iconColor={visualProfile.iconColor}
                iconKind={visualProfile.iconKind}
                pack={pack}
                packBorder={packBorder}
                packBright={packBright}
                packDark={packDark}
                packDeep={packDeep}
                packSoft={packSoft}
                packSurface={packSurface}
                positioned={false}
                sheenAnim={sheenAnim}
              />

              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: burstAnim.interpolate({
                    inputRange: [0, 0.72, 0.9, 1],
                    outputRange: [0, 0.05, 0.38, 0],
                    extrapolate: "clamp",
                  }),
                  backgroundColor: "rgba(255,255,255,0.92)",
                }}
              />

              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: CENTER.x - 18,
                  top: 24,
                  width: 36,
                  height: CARD_H - 46,
                  borderRadius: 999,
                  backgroundColor: "rgba(255, 242, 170, 0.92)",
                  opacity: burstAnim.interpolate({
                    inputRange: [0, 0.18, 0.62, 1],
                    outputRange: [0, 0.85, 0, 0],
                  }),
                  transform: [
                    {
                      scaleY: burstAnim.interpolate({
                        inputRange: [0, 0.62, 1],
                        outputRange: [0.5, 1.18, 1.18],
                      }),
                    },
                    {
                      scaleX: burstAnim.interpolate({
                        inputRange: [0, 0.62, 1],
                        outputRange: [0.6, 1.7, 1.7],
                      }),
                    },
                  ],
                }}
              />

              <Svg
                width={CARD_W}
                height={CARD_H}
                viewBox={`0 0 ${CARD_W} ${CARD_H}`}
                style={{ position: "absolute", left: 0, top: 0 }}
              >
                {cracks.flatMap((crack, index) => {
                  const delay = crack.delay / 2.2;
                  const crackDrawEnd = Math.min(
                    1,
                    delay + BURST_FRACTIONS.crackDraw,
                  );
                  const crackDashOffset = burstAnim.interpolate({
                    inputRange: [0, delay, crackDrawEnd, 1],
                    outputRange: [crack.dashLength, crack.dashLength, 0, 0],
                    extrapolate: "clamp",
                  });
                  const crackOpacity = burstAnim.interpolate({
                    inputRange: [
                      0,
                      delay,
                      crackDrawEnd,
                      BURST_FRACTIONS.crackFadeStart,
                      1,
                    ],
                    outputRange: [0, 0, 1, 1, 0],
                    extrapolate: "clamp",
                  });

                  return [
                    <AnimatedPath
                      key={`glow-${index}`}
                      d={crack.path}
                      fill="none"
                      opacity={crackOpacity}
                      stroke={rgba(pack.color, 0.85)}
                      strokeDasharray={crack.dashLength}
                      strokeDashoffset={crackDashOffset}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={9}
                    />,
                    <AnimatedPath
                      key={`core-${index}`}
                      d={crack.path}
                      fill="none"
                      opacity={crackOpacity}
                      stroke={rgba(packHighlight, 0.98)}
                      strokeDasharray={crack.dashLength}
                      strokeDashoffset={crackDashOffset}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3.2}
                    />,
                  ];
                })}
              </Svg>
            </Animated.View>

            <Animated.View
              style={{
                position: "absolute",
                left: SHELL_CENTER.x - 15,
                top: SHELL_CENTER.y - 15,
                width: 30,
                height: 30,
                borderRadius: 999,
                backgroundColor: packHighlight,
                boxShadow: `0 0 16px ${rgba(packHighlight, 0.88)}, 0 0 30px ${rgba(pack.color, 0.64)}`,
                opacity: burstAnim.interpolate({
                  inputRange: [0, 0.25, BURST_FRACTIONS.flareBuildEnd, BURST_FRACTIONS.flarePopEnd, 1],
                  outputRange: [0, 0, 1, 0, 0],
                  extrapolate: "clamp",
                }),
                transform: [
                  {
                    scale: burstAnim.interpolate({
                      inputRange: [0, 0.25, BURST_FRACTIONS.flareBuildEnd, BURST_FRACTIONS.flarePopEnd, 1],
                      outputRange: [0.2, 0.2, 3.5, 14, 14],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              }}
            />

            <Animated.View
              style={{
                position: "absolute",
                left: SHELL_CENTER.x - 60,
                top: SHELL_CENTER.y - 60,
                width: 120,
                height: 120,
                borderRadius: 999,
                borderWidth: 3,
                borderColor: rgba(packHighlight, 0.9),
                opacity: burstAnim.interpolate({
                  inputRange: [0, BURST_FRACTIONS.shockwaveStart, BURST_FRACTIONS.shockwaveEnd, 1],
                  outputRange: [0, 0.95, 0, 0],
                  extrapolate: "clamp",
                }),
                transform: [
                  {
                    scale: burstAnim.interpolate({
                      inputRange: [0, BURST_FRACTIONS.shockwaveStart, BURST_FRACTIONS.shockwaveEnd, 1],
                      outputRange: [0.2, 0.2, 5.5, 5.5],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              }}
            />

            {particles.map((particle) => (
              <Animated.View
                key={particle.id}
                style={{
                  position: "absolute",
                  left: SHELL_CENTER.x - particle.size / 2,
                  top: SHELL_CENTER.y - particle.size / 2,
                  width: particle.size,
                  height: particle.size,
                  borderRadius: 999,
                  opacity: burstAnim.interpolate({
                    inputRange: [0, BURST_FRACTIONS.particleStart, 1],
                    outputRange: [0, 1, 0],
                    extrapolate: "clamp",
                  }),
                  transform: [
                    {
                      translateX: burstAnim.interpolate({
                        inputRange: [0, BURST_FRACTIONS.particleStart, 1],
                        outputRange: [0, 0, particle.x],
                        extrapolate: "clamp",
                      }),
                    },
                    {
                      translateY: burstAnim.interpolate({
                        inputRange: [0, BURST_FRACTIONS.particleStart, 1],
                        outputRange: [0, 0, particle.y],
                        extrapolate: "clamp",
                      }),
                    },
                    {
                      scale: burstAnim.interpolate({
                        inputRange: [0, BURST_FRACTIONS.particleStart, 1],
                        outputRange: [0.5, 0.5, 0],
                        extrapolate: "clamp",
                      }),
                    },
                    {
                      rotate: burstAnim.interpolate({
                        inputRange: [0, BURST_FRACTIONS.particleStart, 1],
                        outputRange: ["0deg", "0deg", `${particle.spin}deg`],
                        extrapolate: "clamp",
                      }),
                    },
                  ],
                }}
              >
                <View
                  style={{
                    flex: 1,
                    borderRadius: 999,
                    backgroundColor: particle.color,
                    boxShadow: `0 0 14px ${rgba(particle.color, 0.65)}`,
                  }}
                />
              </Animated.View>
            ))}

            {shards.map((shard) => (
              <Animated.View
                key={shard.id}
                style={{
                  position: "absolute",
                  left: SHELL_CENTER.x - 18,
                  top: SHELL_CENTER.y - 28,
                  width: 36,
                  height: 56,
                  opacity: burstAnim.interpolate({
                    inputRange: [0, BURST_FRACTIONS.particleStart, 1],
                    outputRange: [0, 1, 0],
                    extrapolate: "clamp",
                  }),
                  transform: [
                    {
                      translateX: burstAnim.interpolate({
                        inputRange: [0, BURST_FRACTIONS.particleStart, 1],
                        outputRange: [0, 0, shard.x],
                        extrapolate: "clamp",
                      }),
                    },
                    {
                      translateY: burstAnim.interpolate({
                        inputRange: [0, BURST_FRACTIONS.particleStart, 1],
                        outputRange: [0, 0, shard.y],
                        extrapolate: "clamp",
                      }),
                    },
                    {
                      scale: burstAnim.interpolate({
                        inputRange: [0, BURST_FRACTIONS.particleStart, 1],
                        outputRange: [0.8, 0.8, 1.25],
                        extrapolate: "clamp",
                      }),
                    },
                    {
                      rotate: burstAnim.interpolate({
                        inputRange: [0, BURST_FRACTIONS.particleStart, 1],
                        outputRange: ["0deg", "0deg", `${shard.spin}deg`],
                        extrapolate: "clamp",
                      }),
                    },
                  ],
                }}
              >
                <Svg width={36} height={56} viewBox="0 0 36 56">
                  <Path
                    d="M18 0 L36 40.32 L14.4 56 L0 25.2 Z"
                    fill="url(#pack-shard-gradient)"
                  />
                </Svg>
              </Animated.View>
            ))}
          </>
        ) : null}

        {mode !== "charge"
          ? sparkles.map((sparkle) => {
              const revealDelay = sparkle.delay / 2.2;
              const revealSettle = Math.min(1, revealDelay + 0.18);
              const revealEnd = Math.min(1, revealDelay + 0.55);
              const loadingBaseRotation = 0;

              const opacity =
                mode === "loading"
                  ? loadingAnim.interpolate({
                      inputRange: [0, 0.2, 0.55, 1],
                      outputRange: [0.24, 1, 0.82, 0.22],
                    })
                  : burstAnim.interpolate({
                      inputRange: [0, revealDelay, revealSettle, revealEnd, 1],
                      outputRange: [0, 0, 1, 0.95, 0.24],
                      extrapolate: "clamp",
                    });
              const translateX =
                mode === "loading"
                  ? loadingAnim.interpolate({
                      inputRange: [0, 0.2, 0.55, 1],
                      outputRange: [
                        sparkle.x * 0.88,
                        sparkle.x * 1.02,
                        sparkle.x * 1.08,
                        sparkle.x * 0.84,
                      ],
                    })
                  : burstAnim.interpolate({
                      inputRange: [0, revealDelay, revealSettle, revealEnd, 1],
                      outputRange: [
                        0,
                        0,
                        sparkle.x * 0.82,
                        sparkle.x,
                        sparkle.x * 0.88,
                      ],
                      extrapolate: "clamp",
                    });
              const translateY =
                mode === "loading"
                  ? loadingAnim.interpolate({
                      inputRange: [0, 0.2, 0.55, 1],
                      outputRange: [
                        sparkle.y * 0.9,
                        sparkle.y - 10,
                        sparkle.y * 1.04 - 20,
                        sparkle.y * 0.82 - 30,
                      ],
                    })
                  : burstAnim.interpolate({
                      inputRange: [0, revealDelay, revealSettle, revealEnd, 1],
                      outputRange: [
                        0,
                        0,
                        sparkle.y * 0.82,
                        sparkle.y,
                        sparkle.y * 0.9,
                      ],
                      extrapolate: "clamp",
                    });
              const scaleValue =
                mode === "loading"
                  ? loadingAnim.interpolate({
                      inputRange: [0, 0.2, 0.55, 1],
                      outputRange: [0.48, 1.08, 0.78, 0.38],
                    })
                  : burstAnim.interpolate({
                      inputRange: [0, revealDelay, revealSettle, revealEnd, 1],
                      outputRange: [0.15, 0.15, 1, 0.65, 0.48],
                      extrapolate: "clamp",
                    });
              const rotateValue =
                mode === "loading"
                  ? loadingAnim.interpolate({
                      inputRange: [0, 0.2, 0.55, 1],
                      outputRange: [
                        `${loadingBaseRotation}deg`,
                        "92deg",
                        "168deg",
                        "248deg",
                      ],
                    })
                  : burstAnim.interpolate({
                      inputRange: [0, revealDelay, revealSettle, revealEnd, 1],
                      outputRange: ["0deg", "0deg", "70deg", "145deg", "0deg"],
                      extrapolate: "clamp",
                    });

              return (
                <Animated.View
                  key={sparkle.id}
                  style={{
                    position: "absolute",
                    left: SHELL_CENTER.x - sparkle.size / 2,
                    top: SHELL_CENTER.y - sparkle.size / 2,
                    opacity,
                    transform: [
                      { translateX },
                      { translateY },
                      { scale: scaleValue },
                      { rotate: rotateValue },
                    ],
                  }}
                >
                  <SparkleGlyph size={sparkle.size} />
                </Animated.View>
              );
            })
          : null}
      </Animated.View>
    </View>
  );
}
