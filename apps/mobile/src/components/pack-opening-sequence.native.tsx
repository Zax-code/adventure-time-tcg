import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path as SkiaPath,
  RadialGradient,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import Svg, { Path as SvgPath } from "react-native-svg";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import {
  BoxIcon,
  CrownIcon,
  DiamondIcon,
  GiftBoxIcon,
  SparkleIcon,
} from "./icons";
import {
  CARD_H,
  CARD_W,
  PACK_CARD_RATIO,
  createPackOpeningPalette,
  createPackOpeningPattern,
  createTreasureRaySpecs,
  getPackOpeningIconProps,
  getTreasureRayPath,
  mixHex,
  withAlpha,
  type PackOpeningCrack,
  type PackOpeningPalette,
  type PackOpeningParticle,
  type PackOpeningShard,
  type PackOpeningSparkle,
} from "./pack-opening-sequence.shared";
import type { PackAnimationData, PackOpeningSequenceProps } from "./pack-opening-sequence.types";
import type { PackVisualIconKind } from "./pack-opening-visuals";

const AnimatedSvgPath = Animated.createAnimatedComponent(SvgPath);
const DEFAULT_BURST_DURATION_MS = 2200;
const CHARGE_CAPTURE_DELAY_MS = 900;
const BURST_FLASH_CAPTURE_DELAY_MS = 240;
const BURST_FRACTURE_CAPTURE_DELAY_MS = 980;
const LOADING_CAPTURE_DELAY_MS = 420;

type CaptureMarker =
  | null
  | "pack-opening-capture-charge"
  | "pack-opening-capture-burst-flash"
  | "pack-opening-capture-burst-fracture"
  | "pack-opening-capture-loading";

function CaptureMarker({
  delayMs,
  testID,
}: {
  delayMs: number;
  testID: NonNullable<CaptureMarker>;
}) {
  const [visible, setVisible] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setVisible(true);
    }, delayMs);

    return () => clearTimeout(timeout);
  }, [delayMs]);

  if (!visible) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      testID={testID}
      style={styles.captureMarker}
    />
  );
}

function CaptureMarkersOverlay({
  burstDurationMs,
  mode,
}: {
  burstDurationMs: number;
  mode: PackOpeningSequenceProps["mode"];
}) {
  if (mode === "charge") {
    return (
      <CaptureMarker
        delayMs={CHARGE_CAPTURE_DELAY_MS}
        testID="pack-opening-capture-charge"
      />
    );
  }

  if (mode === "burst") {
    return (
      <>
        <CaptureMarker
          delayMs={Math.min(BURST_FLASH_CAPTURE_DELAY_MS, burstDurationMs)}
          testID="pack-opening-capture-burst-flash"
        />
        <CaptureMarker
          delayMs={Math.min(BURST_FRACTURE_CAPTURE_DELAY_MS, burstDurationMs)}
          testID="pack-opening-capture-burst-fracture"
        />
      </>
    );
  }

  if (mode === "loading") {
    return (
      <CaptureMarker
        delayMs={LOADING_CAPTURE_DELAY_MS}
        testID="pack-opening-capture-loading"
      />
    );
  }

  return null;
}

function getCardShadow(packColor: string) {
  return `0 22px 55px rgba(0,0,0,0.72), 0 0 42px ${withAlpha(packColor, "6B")}`;
}

function PackOpeningIcon({
  color,
  iconKind,
  size,
}: {
  color: string;
  iconKind: PackVisualIconKind;
  size: number;
}) {
  switch (iconKind) {
    case "crown":
      return <CrownIcon size={size} color={color} />;
    case "diamond":
      return <DiamondIcon size={size} color={color} />;
    case "gift-box":
      return <GiftBoxIcon size={size} color={color} />;
    case "sparkle":
      return <SparkleIcon size={size} color={color} />;
    default:
      return <BoxIcon size={size} color={color} />;
  }
}

function StageBackdrop({
  backgroundColor,
  height,
  palette,
  width,
}: {
  backgroundColor: string;
  height: number;
  palette: PackOpeningPalette;
  width: number;
}) {
  return (
    <Canvas
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor }]}
    >
      <Circle cx={width * 0.5} cy={height * 0.36} r={Math.min(width, height) * 0.18}>
        <RadialGradient
          c={vec(width * 0.5, height * 0.36)}
          r={Math.min(width, height) * 0.18}
          colors={[withAlpha(palette.highlight, "2E"), withAlpha(palette.highlight, "00")]}
        />
      </Circle>
      <Circle cx={width * 0.5} cy={height * 0.54} r={Math.min(width, height) * 0.24}>
        <RadialGradient
          c={vec(width * 0.5, height * 0.54)}
          r={Math.min(width, height) * 0.24}
          colors={[withAlpha(palette.base, "1F"), withAlpha(palette.base, "00")]}
        />
      </Circle>
      <Circle cx={width * 0.5} cy={height * 0.68} r={Math.min(width, height) * 0.34}>
        <RadialGradient
          c={vec(width * 0.5, height * 0.68)}
          r={Math.min(width, height) * 0.34}
          colors={[withAlpha(palette.shadow, "24"), withAlpha(palette.shadow, "00")]}
        />
      </Circle>
    </Canvas>
  );
}

function BurstCrackPath({
  crack,
  progress,
  stroke,
  strokeWidth,
}: {
  crack: PackOpeningCrack;
  progress: SharedValue<number>;
  stroke: string;
  strokeWidth: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    const drawEnd = Math.min(0.72, crack.delay + 0.24);
    const fadeStart = Math.min(0.82, drawEnd + 0.18);

    return {
      opacity: interpolate(
        progress.value,
        [0, crack.delay, drawEnd, fadeStart, 1],
        [0, 0, 1, 0.8, 0],
        Extrapolation.CLAMP,
      ),
      strokeDashoffset: interpolate(
        progress.value,
        [0, crack.delay, drawEnd, 1],
        [crack.dashLength, crack.dashLength, 0, 0],
        Extrapolation.CLAMP,
      ),
    };
  });

  return (
    <AnimatedSvgPath
      animatedProps={animatedProps}
      d={crack.path}
      fill="none"
      stroke={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      strokeDasharray={crack.dashLength}
    />
  );
}

function BurstParticleView({
  centerX,
  centerY,
  particle,
  progress,
}: {
  centerX: number;
  centerY: number;
  particle: PackOpeningParticle;
  progress: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.62, 0.68, 1],
      [0, 0, 1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 0.62, 0.76, 1],
          [0, 0, particle.x * 0.16, particle.x],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          progress.value,
          [0, 0.62, 0.76, 1],
          [0, 0, particle.y * 0.16, particle.y],
          Extrapolation.CLAMP,
        ),
      },
      { rotate: `${particle.spinDeg}deg` },
      {
        scale: interpolate(
          progress.value,
          [0, 0.62, 0.74, 1],
          [0.5, 0.5, 1, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: centerX - particle.size / 2,
          top: centerY - particle.size / 2,
          width: particle.size,
          height: particle.size,
          borderRadius: 999,
          backgroundColor: particle.color,
          boxShadow: `0 0 14px ${particle.color}`,
        },
        animatedStyle,
      ]}
    />
  );
}

function BurstShardView({
  centerX,
  centerY,
  palette,
  progress,
  shard,
}: {
  centerX: number;
  centerY: number;
  palette: PackOpeningPalette;
  progress: SharedValue<number>;
  shard: PackOpeningShard;
}) {
  const width = 36;
  const height = 56;
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.62, 0.68, 1],
      [0, 0, 1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 0.62, 0.76, 1],
          [0, 0, shard.x * 0.16, shard.x],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          progress.value,
          [0, 0.62, 0.76, 1],
          [0, 0, shard.y * 0.16, shard.y],
          Extrapolation.CLAMP,
        ),
      },
      { rotate: `${shard.spinDeg}deg` },
      {
        scale: interpolate(
          progress.value,
          [0, 0.62, 0.74, 1],
          [0.8, 0.8, 1, 1.25],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: centerX - width / 2,
          top: centerY - height / 2,
          width,
          height,
          overflow: "hidden",
          boxShadow: `0 0 14px ${withAlpha(palette.base, "99")}`,
        },
        animatedStyle,
      ]}
    >
      <Svg width={width} height={height} viewBox="0 0 36 56">
        <SvgPath
          d="M18 0L36 40L16 56L0 24Z"
          fill={palette.highlight}
          fillOpacity={0.95}
          stroke={withAlpha(palette.shadow, "CC")}
          strokeWidth={1}
        />
        <SvgPath
          d="M18 0L36 40L16 56"
          fill="none"
          stroke={withAlpha(palette.shadow, "99")}
          strokeWidth={1.5}
        />
      </Svg>
    </Animated.View>
  );
}

function BurstSparkleView({
  centerX,
  centerY,
  palette,
  progress,
  sparkle,
}: {
  centerX: number;
  centerY: number;
  palette: PackOpeningPalette;
  progress: SharedValue<number>;
  sparkle: PackOpeningSparkle;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const appearAt = sparkle.burstDelayProgress;
    const settleAt = Math.min(1, appearAt + 0.12);
    const driftAt = Math.min(1, appearAt + 0.32);
    const vanishAt = Math.min(1, appearAt + 0.5);
    const rise = 42;

    return {
      opacity: interpolate(
        progress.value,
        [0, appearAt, settleAt, driftAt, vanishAt, 1],
        [0, 0, 1, 0.95, 0, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateX: interpolate(
            progress.value,
            [0, appearAt, settleAt, driftAt, vanishAt, 1],
            [0, 0, sparkle.x * 0.82, sparkle.x, sparkle.x * 1.12, sparkle.x * 1.12],
            Extrapolation.CLAMP,
          ),
        },
        {
          translateY: interpolate(
            progress.value,
            [0, appearAt, settleAt, driftAt, vanishAt, 1],
            [0, 0, sparkle.y * 0.82, sparkle.y, sparkle.y * 1.12 - rise, sparkle.y * 1.12 - rise],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(
            progress.value,
            [0, appearAt, settleAt, driftAt, vanishAt, 1],
            [0.15, 0.15, 1, 0.65, 0.1, 0.1],
            Extrapolation.CLAMP,
          ),
        },
        {
          rotate: `${interpolate(
            progress.value,
            [0, appearAt, settleAt, driftAt, vanishAt, 1],
            [
              sparkle.rotationDeg,
              sparkle.rotationDeg,
              sparkle.rotationDeg + 70,
              sparkle.rotationDeg + 145,
              sparkle.rotationDeg + 250,
              sparkle.rotationDeg + 250,
            ],
            Extrapolation.CLAMP,
          )}deg`,
        },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: centerX - sparkle.size / 2,
          top: centerY - sparkle.size / 2,
          width: sparkle.size,
          height: sparkle.size,
          boxShadow: `0 0 8px ${withAlpha(palette.highlight, "C7")}, 0 0 18px ${withAlpha(palette.base, "B8")}`,
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          position: "absolute",
          left: sparkle.size * 0.4,
          top: 0,
          width: sparkle.size * 0.2,
          height: sparkle.size,
          borderRadius: 999,
          backgroundColor: "#FFFFFFF5",
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
          backgroundColor: "#FFFFFFF5",
        }}
      />
    </Animated.View>
  );
}

function LoadingSparkleView({
  centerX,
  centerY,
  palette,
  progress,
  sparkle,
}: {
  centerX: number;
  centerY: number;
  palette: PackOpeningPalette;
  progress: SharedValue<number>;
  sparkle: PackOpeningSparkle;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const local = (progress.value + sparkle.loadingOffsetProgress) % 1;

    return {
      opacity: interpolate(
        local,
        [0, 0.2, 0.55, 1],
        [0.24, 1, 0.82, 0.22],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateX: interpolate(
            local,
            [0, 0.2, 0.55, 1],
            [sparkle.x * 0.88, sparkle.x * 1.02, sparkle.x * 1.08, sparkle.x * 0.84],
            Extrapolation.CLAMP,
          ),
        },
        {
          translateY: interpolate(
            local,
            [0, 0.2, 0.55, 1],
            [sparkle.y * 0.9, sparkle.y - 10, sparkle.y * 1.04 - 20, sparkle.y * 0.82 - 30],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(
            local,
            [0, 0.2, 0.55, 1],
            [0.48, 1.08, 0.78, 0.38],
            Extrapolation.CLAMP,
          ),
        },
        {
          rotate: `${interpolate(
            local,
            [0, 0.2, 0.55, 1],
            [sparkle.rotationDeg, sparkle.rotationDeg + 92, sparkle.rotationDeg + 168, sparkle.rotationDeg + 248],
            Extrapolation.CLAMP,
          )}deg`,
        },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: centerX - sparkle.size / 2,
          top: centerY - sparkle.size / 2,
          width: sparkle.size,
          height: sparkle.size,
          boxShadow: `0 0 8px ${withAlpha(palette.highlight, "C7")}, 0 0 18px ${withAlpha(palette.base, "B8")}`,
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          position: "absolute",
          left: sparkle.size * 0.4,
          top: 0,
          width: sparkle.size * 0.2,
          height: sparkle.size,
          borderRadius: 999,
          backgroundColor: "#FFFFFFF5",
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
          backgroundColor: "#FFFFFFF5",
        }}
      />
    </Animated.View>
  );
}

function PackCard({
  burstProgress,
  centerX,
  centerY,
  chargeProgress,
  cracks,
  height,
  iconColor,
  iconKind,
  mode,
  pack,
  palette,
  sheenProgress,
  width,
}: {
  burstProgress: SharedValue<number>;
  centerX: number;
  centerY: number;
  chargeProgress: SharedValue<number>;
  cracks: PackOpeningCrack[];
  height: number;
  iconColor: string;
  iconKind: PackVisualIconKind;
  mode: PackOpeningSequenceProps["mode"];
  pack: PackAnimationData;
  palette: PackOpeningPalette;
  sheenProgress: SharedValue<number>;
  width: number;
}) {
  const outerRadius = width * (18 / CARD_W);
  const innerInset = width * (17 / CARD_W);
  const innerRadius = width * (13 / CARD_W);
  const iconFrameSize = width * (108 / CARD_W);
  const iconSize = width * (68 / CARD_W);
  const titleSize = width * (28 / CARD_W);
  const titleLineHeight = titleSize * 1.05;

  const animatedStyle = useAnimatedStyle(() => {
    if (mode === "loading") {
      return { opacity: 0 };
    }

    if (mode === "burst") {
      return {
        opacity: interpolate(
          burstProgress.value,
          [0, 0.72, 0.82, 1],
          [1, 1, 1, 0],
          Extrapolation.CLAMP,
        ),
        transform: [
          {
            translateX: interpolate(
              burstProgress.value,
              [0, 0.18, 0.34, 0.52, 0.72, 0.94, 1],
              [0, -2, 2, -3, 4, 3, 0],
              Extrapolation.CLAMP,
            ),
          },
          {
            translateY: interpolate(
              burstProgress.value,
              [0, 0.18, 0.34, 0.52, 0.72, 0.94, 1],
              [0, 1, -2, -1, 2, -3, 0],
              Extrapolation.CLAMP,
            ),
          },
          {
            rotateZ: `${interpolate(
              burstProgress.value,
              [0, 0.18, 0.34, 0.52, 0.72, 0.94, 1],
              [0, -1, 1.1, -1.4, 1.9, 2.4, 25],
              Extrapolation.CLAMP,
            )}deg`,
          },
          {
            scale: interpolate(
              burstProgress.value,
              [0, 0.18, 0.34, 0.52, 0.72, 0.94, 1],
              [1, 1.01, 1.015, 1.025, 1.06, 1.2, 0.42],
              Extrapolation.CLAMP,
            ),
          },
        ],
      };
    }

    return {
      opacity: 1,
      transform: [
        { perspective: 1000 },
        {
          translateY: interpolate(chargeProgress.value, [0, 0.5, 1], [0, -8, 0]),
        },
        {
          rotateX: `${interpolate(chargeProgress.value, [0, 0.5, 1], [0, 6, 0])}deg`,
        },
        {
          rotateZ: `${interpolate(chargeProgress.value, [0, 0.5, 1], [-1, 1, -1])}deg`,
        },
      ],
    };
  });

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: mode === "charge" ? 0.35 : 0,
    transform: [
      {
        translateX: interpolate(
          sheenProgress.value,
          [0, 0.45, 0.7, 1],
          [-width * 1.2, -width * 1.2, width * 1.2, width * 1.2],
          Extrapolation.CLAMP,
        ),
      },
      { rotate: "16deg" },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: centerX - width / 2,
          top: centerY - height / 2,
          width,
          height,
          borderRadius: outerRadius,
          boxShadow: getCardShadow(palette.base),
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          flex: 1,
          borderRadius: outerRadius,
          overflow: "hidden",
        }}
      >
      <View
        style={{
          flex: 1,
          borderRadius: outerRadius,
          padding: width * (5 / CARD_W),
          backgroundColor: "#2A1407",
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: outerRadius - width * (5 / CARD_W),
            padding: width * (4 / CARD_W),
            backgroundColor: palette.border,
          }}
        >
          <LinearGradient
            colors={[
              palette.soft,
              palette.base,
              palette.deep,
              palette.dark,
              palette.bright,
            ]}
            start={{ x: 0.08, y: 0.04 }}
            end={{ x: 0.94, y: 0.98 }}
            style={{ flex: 1, borderRadius: outerRadius - width * (9 / CARD_W) }}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  top: -height * 0.08,
                  bottom: -height * 0.08,
                  width: width * 0.54,
                },
                sheenStyle,
              ]}
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
              pointerEvents="none"
              style={{
                position: "absolute",
                inset: innerInset,
                borderRadius: innerRadius,
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={[
                  withAlpha(palette.surface, "FF"),
                  withAlpha(palette.soft, "F0"),
                  withAlpha(palette.base, "F5"),
                  palette.dark,
                ]}
                start={{ x: 0.26, y: 0.04 }}
                end={{ x: 0.74, y: 1 }}
                style={{ flex: 1 }}
              />
              <Canvas
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
              >
                <Circle cx={width / 2} cy={height * 0.18} r={width * 0.24}>
                  <RadialGradient
                    c={vec(width / 2, height * 0.18)}
                    r={width * 0.24}
                    colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]}
                  />
                </Circle>
              </Canvas>
            </View>

            <View
              style={{
                position: "absolute",
                inset: innerInset,
                borderRadius: innerRadius,
                paddingTop: height * 0.09,
                paddingHorizontal: width * 0.08,
                paddingBottom: height * 0.072,
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: iconFrameSize,
                  height: iconFrameSize,
                  borderRadius: width * (28 / CARD_W),
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.16)",
                  boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.22), 0 18px 34px ${withAlpha(palette.shadow, "38")}`,
                }}
              >
                <View
                  style={{
                    boxShadow: `0 0 14px ${withAlpha(palette.highlight, "6B")}`,
                  }}
                >
                  <PackOpeningIcon
                    color={iconColor}
                    iconKind={iconKind}
                    size={iconSize}
                  />
                </View>
              </View>

              <View style={{ flex: 1 }} />

              <View style={{ width: "100%", alignItems: "center", gap: 12 }}>
                <Text
                  className="font-nunito-extrabold text-center text-[#FFF8F0]"
                  style={{
                    fontSize: titleSize,
                    lineHeight: titleLineHeight,
                    textShadowColor: "rgba(0,0,0,0.3)",
                    textShadowOffset: { width: 0, height: 2 },
                    textShadowRadius: 12,
                  }}
                >
                  {pack.name}
                </Text>
                <View
                  style={{
                    paddingHorizontal: width * (14 / CARD_W),
                    paddingVertical: height * (8 / CARD_H),
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.16)",
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
                  }}
                >
                  <Text
                    className="font-nunito-bold text-center text-white"
                    style={{ fontSize: width * (13 / CARD_W) }}
                  >
                    {pack.cardCountLabel}
                  </Text>
                </View>
              </View>
            </View>

            {mode === "burst" ? (
              <Svg
                pointerEvents="none"
                width={width}
                height={height}
                viewBox={`0 0 ${CARD_W} ${CARD_H}`}
                style={StyleSheet.absoluteFill}
              >
                {cracks.flatMap((crack) => [
                  <BurstCrackPath
                    key={`${crack.id}-glow`}
                    crack={crack}
                    progress={burstProgress}
                    stroke={withAlpha(palette.base, "D9")}
                    strokeWidth={9}
                  />,
                  <BurstCrackPath
                    key={`${crack.id}-core`}
                    crack={crack}
                    progress={burstProgress}
                    stroke={withAlpha(palette.highlight, "FA")}
                    strokeWidth={3.2}
                  />,
                ])}
              </Svg>
            ) : null}
          </LinearGradient>
        </View>
      </View>
      </View>
    </Animated.View>
  );
}

export default function PackOpeningSequence({
  burstDurationMs = DEFAULT_BURST_DURATION_MS,
  mode,
  pack,
}: PackOpeningSequenceProps) {
  const [{ iconColor, iconKind }] = useState(() => getPackOpeningIconProps(pack));
  const [pattern] = useState(() => createPackOpeningPattern(pack));
  const [layout, setLayout] = useState({ height: 0, width: 0 });
  const palette = createPackOpeningPalette(pack, iconColor);

  const chargeProgress = useSharedValue(0);
  const sheenProgress = useSharedValue(0);
  const burstProgress = useSharedValue(0);
  const loadingGlowProgress = useSharedValue(0);
  const loadingRayProgress = useSharedValue(0);
  const loadingSparkleProgress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(chargeProgress);
    cancelAnimation(sheenProgress);
    cancelAnimation(burstProgress);
    cancelAnimation(loadingGlowProgress);
    cancelAnimation(loadingRayProgress);
    cancelAnimation(loadingSparkleProgress);

    if (mode === "charge") {
      burstProgress.value = 0;
      loadingGlowProgress.value = 0;
      loadingRayProgress.value = 0;
      loadingSparkleProgress.value = 0;
      chargeProgress.value = 0;
      sheenProgress.value = 0;
      chargeProgress.value = withRepeat(
        withTiming(1, {
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      );
      sheenProgress.value = withRepeat(
        withTiming(1, {
          duration: 3400,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
      return;
    }

    if (mode === "burst") {
      chargeProgress.value = 0;
      sheenProgress.value = 0;
      loadingGlowProgress.value = 0;
      loadingRayProgress.value = 0;
      loadingSparkleProgress.value = 0;
      burstProgress.value = 0;
      burstProgress.value = withTiming(1, {
        duration: burstDurationMs,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      });
      return;
    }

    chargeProgress.value = 0;
    sheenProgress.value = 0;
    burstProgress.value = 0;
    loadingGlowProgress.value = 0;
    loadingRayProgress.value = 0;
    loadingSparkleProgress.value = 0;
    loadingGlowProgress.value = withRepeat(
      withTiming(1, {
        duration: 3400,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    loadingRayProgress.value = withRepeat(
      withTiming(1, {
        duration: 7200,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    loadingSparkleProgress.value = withRepeat(
      withTiming(1, {
        duration: 2900,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [
    burstDurationMs,
    burstProgress,
    chargeProgress,
    loadingGlowProgress,
    loadingRayProgress,
    loadingSparkleProgress,
    mode,
    sheenProgress,
  ]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    if (height === layout.height && width === layout.width) {
      return;
    }
    setLayout({ height, width });
  };

  const stageWidth = layout.width;
  const stageHeight = layout.height;
  const centerX = stageWidth * 0.5;
  const centerY = stageHeight * 0.47;
  const stageBase = Math.min(stageWidth, stageHeight, 520);
  const auraSize = Math.min(390, stageBase * 0.75);
  const lightSize = Math.min(440, stageBase * 0.846);
  const raySize = Math.min(520, stageBase);
  const cardWidth = Math.min(230, stageWidth * 0.46, stageHeight * 0.54 * PACK_CARD_RATIO);
  const cardHeight = cardWidth / PACK_CARD_RATIO;

  const auraStyle = useAnimatedStyle(() => {
    if (mode === "loading") {
      return {
        opacity: 0.34,
        transform: [{ scale: 0.9 }],
      };
    }

    if (mode === "burst") {
      return {
        opacity: interpolate(
          burstProgress.value,
          [0, 0.42, 0.72, 1],
          [0.72, 0.92, 0.84, 0.38],
          Extrapolation.CLAMP,
        ),
        transform: [
          {
            scale: interpolate(
              burstProgress.value,
              [0, 0.42, 0.72, 1],
              [0.9, 1, 1.08, 1.2],
              Extrapolation.CLAMP,
            ),
          },
        ],
      };
    }

    return {
      opacity: interpolate(chargeProgress.value, [0, 0.5, 1], [0.45, 0.72, 0.45]),
      transform: [
        {
          scale: interpolate(chargeProgress.value, [0, 0.5, 1], [0.74, 0.94, 0.74]),
        },
      ],
    };
  });

  const lightStyle = useAnimatedStyle(() => {
    if (mode === "loading") {
      return {
        opacity: interpolate(
          loadingGlowProgress.value,
          [0, 0.5, 1],
          [0.5, 0.68, 0.5],
          Extrapolation.CLAMP,
        ),
        transform: [
          {
            scale: interpolate(
              loadingGlowProgress.value,
              [0, 0.5, 1],
              [0.82, 0.94, 0.82],
              Extrapolation.CLAMP,
            ),
          },
        ],
      };
    }

    if (mode === "burst") {
      return {
        opacity: interpolate(
          burstProgress.value,
          [0, 0.2, 0.55, 1],
          [0, 0.95, 0.82, 0.48],
          Extrapolation.CLAMP,
        ),
        transform: [
          {
            scale: interpolate(
              burstProgress.value,
              [0, 0.2, 0.55, 1],
              [0.12, 0.95, 1.2, 1.35],
              Extrapolation.CLAMP,
            ),
          },
        ],
      };
    }

    return {
      opacity: 0,
      transform: [{ scale: 0.12 }],
    };
  });

  const raysStyle = useAnimatedStyle(() => {
    if (mode === "loading") {
      return {
        opacity: interpolate(
          loadingRayProgress.value,
          [0, 0.5, 1],
          [0.28, 0.42, 0.3],
          Extrapolation.CLAMP,
        ),
        transform: [
          {
            scale: interpolate(
              loadingRayProgress.value,
              [0, 0.5, 1],
              [0.76, 0.84, 0.78],
              Extrapolation.CLAMP,
            ),
          },
          {
            rotate: `${interpolate(
              loadingRayProgress.value,
              [0, 0.5, 1],
              [20, 34, 48],
              Extrapolation.CLAMP,
            )}deg`,
          },
        ],
      };
    }

    if (mode === "burst") {
      return {
        opacity: interpolate(
          burstProgress.value,
          [0, 0.22, 1],
          [0, 0.72, 0.28],
          Extrapolation.CLAMP,
        ),
        transform: [
          {
            scale: interpolate(
              burstProgress.value,
              [0, 0.22, 1],
              [0.15, 0.95, 1.18],
              Extrapolation.CLAMP,
            ),
          },
          {
            rotate: `${interpolate(
              burstProgress.value,
              [0, 0.22, 1],
              [0, 12, 36],
              Extrapolation.CLAMP,
            )}deg`,
          },
        ],
      };
    }

    return {
      opacity: 0,
      transform: [{ scale: 0.1 }],
    };
  });

  const flareStyle = useAnimatedStyle(() => ({
    opacity:
      mode === "burst"
        ? interpolate(
            burstProgress.value,
            [0, 0.38, 0.68, 1],
            [0, 0, 1, 0],
            Extrapolation.CLAMP,
          )
        : 0,
    transform: [
      {
        scale:
          mode === "burst"
            ? interpolate(
                burstProgress.value,
                [0, 0.38, 0.68, 0.82, 1],
                [0.2, 0.2, 3.5, 14, 14],
                Extrapolation.CLAMP,
              )
            : 0.2,
      },
    ],
  }));

  const shockwaveStyle = useAnimatedStyle(() => ({
    opacity:
      mode === "burst"
        ? interpolate(
            burstProgress.value,
            [0, 0.62, 0.72, 1],
            [0, 0, 0.95, 0],
            Extrapolation.CLAMP,
          )
        : 0,
    transform: [
      {
        scale:
          mode === "burst"
            ? interpolate(
                burstProgress.value,
                [0, 0.62, 1],
                [0.2, 0.2, 5.5],
                Extrapolation.CLAMP,
              )
            : 0.2,
      },
    ],
  }));

  const burstPatternHighlight = mixHex(palette.highlight, "#FFFFFF", 0.28);
  const rayPaths = createTreasureRaySpecs(palette)
    .map((spec) => ({
      ...spec,
      path: Skia.Path.MakeFromSVGString(
        getTreasureRayPath(
          raySize / 2,
          raySize * 0.47,
          spec.angle,
          raySize * spec.inner,
          raySize * spec.outer,
          spec.spread,
        ),
      ),
    }))
    .filter(
      (
        ray,
      ): ray is ReturnType<typeof createTreasureRaySpecs>[number] & {
        path: NonNullable<ReturnType<typeof Skia.Path.MakeFromSVGString>>;
      } => ray.path !== null,
    );

  return (
    <View
      onLayout={onLayout}
      style={[
        StyleSheet.absoluteFill,
        { overflow: "hidden", backgroundColor: pack.backgroundColor },
      ]}
    >
      <CaptureMarkersOverlay
        burstDurationMs={burstDurationMs}
        mode={mode}
      />
      {stageWidth > 0 && stageHeight > 0 ? (
        <>
          <StageBackdrop
            backgroundColor={pack.backgroundColor}
            height={stageHeight}
            palette={palette}
            width={stageWidth}
          />

          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: centerX - auraSize / 2,
                top: centerY - auraSize / 2,
                width: auraSize,
                height: auraSize,
              },
              auraStyle,
            ]}
          >
            <Canvas style={{ flex: 1 }}>
              <Circle cx={auraSize / 2} cy={auraSize / 2} r={auraSize * 0.5}>
                <RadialGradient
                  c={vec(auraSize / 2, auraSize / 2)}
                  r={auraSize * 0.5}
                  colors={[
                    withAlpha(palette.highlight, "80"),
                    withAlpha(palette.base, "2E"),
                    withAlpha(palette.base, "00"),
                  ]}
                  positions={[0, 0.35, 0.68]}
                />
                <BlurMask blur={14} style="normal" />
              </Circle>
            </Canvas>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: centerX - raySize / 2,
                top: centerY - raySize / 2,
                width: raySize,
                height: raySize,
              },
              raysStyle,
            ]}
          >
            <Canvas style={{ flex: 1 }}>
              <Group blendMode="screen">
                {rayPaths.map((ray) => (
                  <SkiaPath key={`${ray.angle}`} path={ray.path} color={ray.color}>
                    <BlurMask blur={2} style="normal" />
                  </SkiaPath>
                ))}
              </Group>
            </Canvas>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: centerX - lightSize / 2,
                top: centerY - lightSize / 2,
                width: lightSize,
                height: lightSize,
              },
              lightStyle,
            ]}
          >
            <Canvas style={{ flex: 1 }}>
              <Circle cx={lightSize / 2} cy={lightSize * 0.47} r={lightSize * 0.44}>
                <RadialGradient
                  c={vec(lightSize / 2, lightSize * 0.47)}
                  r={lightSize * 0.44}
                  colors={[
                    "rgba(255,255,245,0.98)",
                    withAlpha(palette.highlight, "DB"),
                    withAlpha(palette.base, "6B"),
                    withAlpha(palette.shadow, "24"),
                    withAlpha(palette.shadow, "00"),
                  ]}
                  positions={[0.08, 0.16, 0.35, 0.58, 0.73]}
                />
                <BlurMask blur={6} style="normal" />
              </Circle>
            </Canvas>
          </Animated.View>

          <PackCard
            burstProgress={burstProgress}
            centerX={centerX}
            centerY={centerY}
            chargeProgress={chargeProgress}
            cracks={pattern.cracks}
            height={cardHeight}
            iconColor={iconColor}
            iconKind={iconKind}
            mode={mode}
            pack={pack}
            palette={palette}
            sheenProgress={sheenProgress}
            width={cardWidth}
          />

          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: centerX - 15,
                top: centerY - 15,
                width: 30,
                height: 30,
              },
              flareStyle,
            ]}
          >
            <Canvas style={{ flex: 1 }}>
              <Circle cx={15} cy={15} r={15} color={burstPatternHighlight}>
                <BlurMask blur={8} style="solid" />
              </Circle>
            </Canvas>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: centerX - 60,
                top: centerY - 60,
                width: 120,
                height: 120,
              },
              shockwaveStyle,
            ]}
          >
            <View
              style={{
                flex: 1,
                borderRadius: 999,
                borderWidth: 3,
                borderColor: withAlpha(palette.highlight, "E6"),
              }}
            />
          </Animated.View>

          {mode === "burst"
            ? pattern.particles.map((particle) => (
                <BurstParticleView
                  key={particle.id}
                  centerX={centerX}
                  centerY={centerY}
                  particle={particle}
                  progress={burstProgress}
                />
              ))
            : null}

          {mode === "burst"
            ? pattern.shards.map((shard) => (
                <BurstShardView
                  key={shard.id}
                  centerX={centerX}
                  centerY={centerY}
                  palette={palette}
                  progress={burstProgress}
                  shard={shard}
                />
              ))
            : null}

          {mode === "burst"
            ? pattern.sparkles.map((sparkle) => (
                <BurstSparkleView
                  key={`burst-${sparkle.id}`}
                  centerX={centerX}
                  centerY={centerY}
                  palette={palette}
                  progress={burstProgress}
                  sparkle={sparkle}
                />
              ))
            : null}

          {mode === "loading"
            ? pattern.sparkles.map((sparkle) => (
                <LoadingSparkleView
                  key={`loading-${sparkle.id}`}
                  centerX={centerX}
                  centerY={centerY}
                  palette={palette}
                  progress={loadingSparkleProgress}
                  sparkle={sparkle}
                />
              ))
            : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  captureMarker: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 2,
    height: 2,
    opacity: 0.01,
    backgroundColor: "#FFFFFF",
  },
});
