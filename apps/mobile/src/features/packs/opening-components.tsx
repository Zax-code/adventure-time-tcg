import { useState, useMemo, type ReactNode } from "react";
import { ModalBottomSheet } from "@swmansion/react-native-bottom-sheet";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Path,
  RadialGradient as SvgRadialGradient,
  Stop,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CardTile } from "../../components/card-tile";
import { getCardBackcoverSource } from "../../components/card-back-cover-art";
import { getCardOutlineSource } from "../../components/card-outline-frame";
import {
  BoxIcon,
  CrownIcon,
  DiamondIcon,
  GiftBoxIcon,
  SparkleIcon,
  SparklesIcon,
} from "../../components/icons";
import { getPackOpeningArtSource } from "../../components/pack-opening-art";
import { getPackOpeningVisualProfile } from "../../components/pack-opening-visuals";
import { RARITY_COLORS } from "../../components/theme";
import { useTranslation } from "../../i18n";
import { asStyle } from "../../lib/style-object";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS, type ThemeName } from "../../theme/themes";

import {
  CARD_BACK_STACK_SPECS,
  IS_E2E_BUILD,
  PACK_CARD_RATIO,
  PACK_OPEN_BURST_MS,
  PACK_OPEN_PROGRESS_MS,
  PACK_OPEN_SHAKE_MS,
  REVEAL_CARD_RATIO,
  REVEAL_FLIP_MS,
  REVEAL_START_DELAY_MS,
  SPARK_REVEAL_FLIP_MS,
  SPARK_REVEAL_START_DELAY_MS,
  TREASURE_RAY_SPECS,
  buildCardBackVisualMap,
  canOpenPackWithBalance,
  createBurstPattern,
  createLoadingSparkles,
  delay,
  formatPackAvailabilityDate,
  getHapticForCard,
  getPackArtUrl,
  getRarityGlowColor,
  getThemeRarityPalette,
  getCardBackVisualKey,
  getTreasureRayPath,
  isPackLimited,
  slugifyPackName,
  toCardTileEntry,
  toRarityName,
  withAlpha,
  type CardBackVisualMap,
  type LoadingSparkle,
  type OpenedCard,
  type OpeningPhase,
  type Pack,
  type PackBurstPattern,
  type RarityName,
} from "./opening-model";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const packScreenStyles = StyleSheet.create({
  burstFlare: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#FFF2AA",
    boxShadow:
      "0 0 18px rgba(255, 242, 170, 0.95), 0 0 42px rgba(255, 156, 37, 0.8), 0 0 80px rgba(255, 91, 18, 0.6)",
  },
  burstShockwave: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "rgba(255, 228, 130, 0.9)",
  },
  burstParticle: {
    position: "absolute",
    borderRadius: 999,
  },
});

export function BackgroundOrbs({
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

export function PackIconVisual({
  pack,
  size = 34,
}: {
  pack: Pack;
  size?: number;
}) {
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
          <PackIconVisual pack={pack} size={iconSize} />
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

export function PackPreviewCard({
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
  pulseAnim?: SharedValue<number>;
  chargeAnim?: SharedValue<number>;
  sheenAnim?: SharedValue<number>;
}) {
  const height = width / PACK_CARD_RATIO;
  const packArtSource = getPackOpeningArtSource({
    guaranteedRarity: pack.guaranteedRarity,
    name: pack.name,
    packArtAssetId: pack.packArtAssetId,
    packArtUrl: getPackArtUrl(pack),
  });
  const cardAnimatedStyle = useAnimatedStyle(() => {
    const transforms = [];

    if (chargeAnim) {
      transforms.push(
        {
          translateY: interpolate(chargeAnim.value, [0, 0.5, 1], [6, -8, 6]),
        },
        {
          rotateX: `${interpolate(chargeAnim.value, [0, 0.5, 1], [0, 6, 0])}deg`,
        },
        {
          rotateZ: `${interpolate(chargeAnim.value, [0, 0.5, 1], [-1, 1, -1])}deg`,
        },
      );
    }

    if (pulseAnim) {
      transforms.push({
        scale: interpolate(pulseAnim.value, [0, 0.5, 1], [1, 1.014, 1]),
      });
    }

    if (chargeAnim) {
      transforms.push({
        scale: interpolate(chargeAnim.value, [0, 0.5, 1], [1, 1.015, 1]),
      });
    }

    return {
      transform: transforms,
    };
  });

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: sheenAnim
          ? interpolate(
              sheenAnim.value,
              [0, 0.45, 0.7, 1],
              [-width * 1.2, -width * 1.2, width * 1.2, width * 1.2],
            )
          : -width * 1.2,
      },
      { rotate: "16deg" },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          overflow: "visible",
          backgroundColor: "transparent",
        },
        cardAnimatedStyle,
      ]}
    >
      <Image
        source={packArtSource}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          opacity: compact ? 0.14 : 0.18,
          transform: [{ translateY: compact ? 10 : 14 }, { scale: 0.96 }],
        }}
        contentFit="contain"
        transition={0}
        blurRadius={compact ? 12 : 18}
      />
      <Image
        source={packArtSource}
        style={{ width: "100%", height: "100%" }}
        contentFit="contain"
        transition={0}
      />
      {sheenAnim ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: -height * 0.08,
              bottom: -height * 0.08,
              width: width * 0.54,
              opacity: 0.42,
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
      ) : null}
    </Animated.View>
  );
}

const PackFaceCanvas = packFaceCanvas;

function packFaceCanvas({
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

export const PackOpeningAura = packOpeningAura;

function packOpeningAura({
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

function LoadingSparkleView({
  anim,
  centerX,
  centerY,
  sparkle,
  width,
}: {
  anim: SharedValue<number>;
  centerX: number;
  centerY: number;
  sparkle: LoadingSparkle;
  width: number;
}) {
  const rise = Math.max(20, width * 0.18);
  const appearAt = sparkle.delay;
  const settleAt = Math.min(1, appearAt + 0.18);
  const driftAt = Math.min(1, appearAt + 0.55);
  const vanishAt = Math.min(1, appearAt + 0.86);
  const inputRange = [0, appearAt, settleAt, driftAt, vanishAt, 1];
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      anim.value,
      inputRange,
      [0, 0, 1, 0.95, 0, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateX: interpolate(
          anim.value,
          inputRange,
          [
            0,
            0,
            sparkle.travelX * 0.82,
            sparkle.travelX,
            sparkle.travelX * 1.12,
            sparkle.travelX * 1.12,
          ],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          anim.value,
          inputRange,
          [
            0,
            0,
            sparkle.travelY * 0.82,
            sparkle.travelY,
            sparkle.travelY * 1.12 - rise,
            sparkle.travelY * 1.12 - rise,
          ],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(
          anim.value,
          inputRange,
          [0.15, 0.15, 1, 0.65, 0.1, 0.1],
          Extrapolation.CLAMP,
        ),
      },
      {
        rotate: `${interpolate(
          anim.value,
          inputRange,
          [
            sparkle.rotation,
            sparkle.rotation,
            sparkle.rotation + 70,
            sparkle.rotation + 145,
            sparkle.rotation + 250,
            sparkle.rotation + 250,
          ],
          Extrapolation.CLAMP,
        )}deg`,
      },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: centerX - sparkle.size / 2,
          top: centerY - sparkle.size / 2,
          width: sparkle.size,
          height: sparkle.size,
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
}

export function PackLoadingGlow({
  width,
  anim,
  sparkles,
}: {
  width: number;
  anim: SharedValue<number>;
  sparkles: LoadingSparkle[];
}) {
  const size = width * 1.58;
  const centerX = size / 2;
  const centerY = size * 0.47;
  const glowBlurStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(
        anim.value,
        [0, 0.2, 0.55, 1],
        [0, 0.82, 0.74, 0.38],
        Extrapolation.CLAMP,
      ) * 0.34,
    transform: [
      {
        scale: interpolate(
          anim.value,
          [0, 0.2, 0.55, 1],
          [0.18, 1.02, 1.28, 1.48],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const raysStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      anim.value,
      [0, 0.22, 1],
      [0, 0.86, 0.42],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          anim.value,
          [0, 0.22, 1],
          [0.15, 0.95, 1.18],
          Extrapolation.CLAMP,
        ),
      },
      {
        rotate: `${interpolate(
          anim.value,
          [0, 0.22, 1],
          [0, 12, 36],
          Extrapolation.CLAMP,
        )}deg`,
      },
    ],
  }));
  const glowCoreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      anim.value,
      [0, 0.2, 0.55, 1],
      [0, 0.82, 0.74, 0.38],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          anim.value,
          [0, 0.2, 0.55, 1],
          [0.12, 0.95, 1.2, 1.35],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

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
        style={[
          {
            position: "absolute",
            width: size * 0.98,
            height: size * 0.98,
          },
          glowBlurStyle,
        ]}
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
        style={[
          {
            position: "absolute",
            width: size,
            height: size,
          },
          raysStyle,
        ]}
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
        style={[
          {
            position: "absolute",
            width: size * 0.86,
            height: size * 0.86,
          },
          glowCoreStyle,
        ]}
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

      {sparkles.map((sparkle) => (
        <LoadingSparkleView
          key={sparkle.id}
          anim={anim}
          centerX={centerX}
          centerY={centerY}
          sparkle={sparkle}
          width={width}
        />
      ))}
    </View>
  );
}

const CardBackFace = cardBackFace;

function cardBackFace({
  width,
  themeName,
  rarityName,
  cardBackVisualMap,
}: {
  width: number;
  themeName: ThemeName;
  rarityName: RarityName;
  cardBackVisualMap: CardBackVisualMap;
}) {
  const height = width / REVEAL_CARD_RATIO;
  const backcoverSource = getCardBackcoverSource(
    themeName,
    rarityName,
    cardBackVisualMap.get(getCardBackVisualKey(themeName, rarityName)),
  );

  return (
    <View
      style={{
        width,
        height,
        borderRadius: 32,
        overflow: "hidden",
      }}
    >
      <Image
        source={backcoverSource}
        contentFit="cover"
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </View>
  );
}

function RevealCardHalo({
  color,
  opacityAnim,
  rarityName,
  isSparkReveal = false,
  themeName,
  width,
}: {
  color: string;
  opacityAnim: SharedValue<number>;
  rarityName: RarityName;
  isSparkReveal?: boolean;
  themeName: ThemeName;
  width: number;
}) {
  const height = width / REVEAL_CARD_RATIO;
  const haloShapeSource = getCardOutlineSource(themeName, rarityName);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      opacityAnim.value,
      [0, 1],
      [0, isSparkReveal ? 0.38 : 0.22],
    ),
    transform: [
      {
        scale: interpolate(
          opacityAnim.value,
          [0, 1],
          [0.995, isSparkReveal ? 1.055 : 1.025],
        ),
      },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        asStyle({
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height,
          zIndex: 0,
        }),
        haloStyle,
      ]}
    >
      <Image
        pointerEvents="none"
        source={haloShapeSource}
        contentFit="fill"
        blurRadius={7}
        tintColor={color}
        style={{
          position: "absolute",
          top: -4,
          right: -4,
          bottom: -4,
          left: -4,
        }}
      />
    </Animated.View>
  );
}

function SparkRevealOverlay({
  color,
  anim,
  width,
}: {
  color: string;
  anim: SharedValue<number>;
  width: number;
}) {
  const height = width / REVEAL_CARD_RATIO;
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(anim.value, [0, 0.25, 0.62, 1], [0, 0.92, 0.34, 0]),
    transform: [{ scale: interpolate(anim.value, [0, 1], [0.78, 1.36]) }],
  }));
  const glintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(anim.value, [0, 0.32, 0.68, 1], [0, 0.8, 0.22, 0]),
    transform: [
      {
        translateX: interpolate(
          anim.value,
          [0, 1],
          [-width * 0.8, width * 0.8],
        ),
      },
      { rotate: "18deg" },
    ],
  }));
  const starStyle = useAnimatedStyle(() => ({
    opacity: interpolate(anim.value, [0, 0.32, 0.68, 1], [0, 0.8, 0.22, 0]),
    transform: [
      {
        scale: interpolate(
          anim.value,
          [0, 0.45, 0.72, 1],
          [0.75, 1.22, 1.04, 0.9],
        ),
      },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        asStyle({
          position: "absolute",
          top: -18,
          right: -18,
          bottom: -18,
          left: -18,
          zIndex: 24,
        }),
        pulseStyle,
      ]}
    >
      <View
        style={asStyle({
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          borderRadius: 36,
          borderWidth: 2,
          borderColor: color,
          backgroundColor: withAlpha(color, "16"),
        })}
      />
      <Animated.View
        style={[
          asStyle({
            position: "absolute",
            top: height * 0.12,
            bottom: height * 0.12,
            left: width * 0.42,
            width: 22,
            borderRadius: 999,
            backgroundColor: "rgba(255, 255, 255, 0.72)",
          }),
          glintStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            position: "absolute",
            right: 18,
            top: 16,
          },
          starStyle,
        ]}
      >
        <SparklesIcon size={30} color="#FFF8D6" />
      </Animated.View>
    </Animated.View>
  );
}

function CardBackStackItem({
  card,
  cardBackVisualMap,
  spreadAnim,
  themeName,
  width,
}: {
  card: (typeof CARD_BACK_STACK_SPECS)[number] & { rarityName: RarityName };
  cardBackVisualMap: CardBackVisualMap;
  spreadAnim: SharedValue<number>;
  themeName: ThemeName;
  width: number;
}) {
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          spreadAnim.value,
          [0, 1],
          [card.collapsedX, card.finalX],
        ),
      },
      {
        translateY: interpolate(
          spreadAnim.value,
          [0, 1],
          [card.collapsedY, card.finalY],
        ),
      },
      {
        rotate: `${interpolate(
          spreadAnim.value,
          [0, 1],
          [
            Number.parseFloat(card.collapsedRotate),
            Number.parseFloat(card.finalRotate),
          ],
        )}deg`,
      },
      {
        scale: interpolate(spreadAnim.value, [0, 1], [0.98, card.scale]),
      },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          zIndex: card.zIndex,
        },
        cardStyle,
      ]}
    >
      <CardBackFace
        width={width}
        themeName={themeName}
        rarityName={card.rarityName}
        cardBackVisualMap={cardBackVisualMap}
      />
    </Animated.View>
  );
}

export function CardBackStack({
  width,
  tc,
  themeName,
  cardBackVisualMap,
  rarityNames,
  spreadAnim,
  idleAnim,
  pulseAnim,
}: {
  width: number;
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
  themeName: ThemeName;
  cardBackVisualMap: CardBackVisualMap;
  rarityNames: RarityName[];
  spreadAnim: SharedValue<number>;
  idleAnim?: SharedValue<number>;
  pulseAnim?: SharedValue<number>;
}) {
  const cardHeight = width / REVEAL_CARD_RATIO;
  const stackHeight = cardHeight + 44;
  const visibleRarityNames =
    rarityNames.length > 3
      ? rarityNames.slice(0, 3)
      : rarityNames.length > 0
        ? rarityNames
        : (["Common"] as RarityName[]);
  const visibleCardCount = visibleRarityNames.length;
  const visibleStackCards =
    visibleCardCount === 1
      ? [CARD_BACK_STACK_SPECS[2]]
      : visibleCardCount === 2
        ? CARD_BACK_STACK_SPECS.slice(0, 2)
        : CARD_BACK_STACK_SPECS;
  const visibleStackEntries = visibleStackCards.map((card, index) => ({
    ...card,
    rarityName: visibleRarityNames[index] ?? "Common",
  }));
  const wrapperStyle = useAnimatedStyle(() => {
    const transforms = [];

    if (idleAnim) {
      transforms.push(
        { translateY: interpolate(idleAnim.value, [0, 0.5, 1], [8, -8, 8]) },
        {
          scale: interpolate(
            idleAnim.value,
            [0, 0.5, 1],
            [0.994, 1.008, 0.994],
          ),
        },
      );
    }

    if (pulseAnim) {
      transforms.push({
        scale: interpolate(pulseAnim.value, [0, 0.5, 1], [1, 1.014, 1]),
      });
    }

    return { transform: transforms };
  });

  return (
    <Animated.View
      style={[
        {
          width: width + 90,
          height: stackHeight,
          alignItems: "center",
          justifyContent: "center",
        },
        wrapperStyle,
      ]}
    >
      {visibleStackEntries.map((card) => (
        <CardBackStackItem
          key={card.key}
          card={card}
          cardBackVisualMap={cardBackVisualMap}
          spreadAnim={spreadAnim}
          themeName={themeName}
          width={width}
        />
      ))}
    </Animated.View>
  );
}

function AnimatedCrackPaths({
  crack,
  crackIndex,
  openAnim,
}: {
  crack: PackBurstPattern["cracks"][number];
  crackIndex: number;
  openAnim: SharedValue<number>;
}) {
  const crackDrawEnd = Math.min(0.72, crack.delay + 0.24);
  const crackFadeStart = Math.min(0.82, crackDrawEnd + 0.18);
  const animatedProps = useAnimatedProps(() => ({
    opacity: interpolate(
      openAnim.value,
      [0, crack.delay, crackDrawEnd, crackFadeStart, 1],
      [0, 0, 1, 0.8, 0],
      Extrapolation.CLAMP,
    ),
    strokeDashoffset: interpolate(
      openAnim.value,
      [0, crack.delay, crackDrawEnd, 1],
      [crack.dashLength, crack.dashLength, 0, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <>
      <AnimatedPath
        key={`crack-glow-${crackIndex}`}
        d={crack.path}
        fill="none"
        stroke="rgba(255, 116, 24, 0.85)"
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={crack.dashLength}
        animatedProps={animatedProps}
      />
      <AnimatedPath
        key={`crack-core-${crackIndex}`}
        d={crack.path}
        fill="none"
        stroke="#FFF8BF"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={crack.dashLength}
        animatedProps={animatedProps}
      />
    </>
  );
}

function BurstParticleView({
  centerX,
  centerY,
  openAnim,
  particle,
}: {
  centerX: number;
  centerY: number;
  openAnim: SharedValue<number>;
  particle: PackBurstPattern["particles"][number];
}) {
  const particleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      openAnim.value,
      [0, 0.62, 0.68, 1],
      [0, 0, 1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateX: interpolate(
          openAnim.value,
          [0, 0.62, 0.76, 1],
          [0, 0, particle.travelX * 0.16, particle.travelX],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          openAnim.value,
          [0, 0.62, 0.76, 1],
          [0, 0, particle.travelY * 0.16, particle.travelY],
          Extrapolation.CLAMP,
        ),
      },
      { rotate: particle.spin },
      {
        scale: interpolate(
          openAnim.value,
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
        packScreenStyles.burstParticle,
        {
          left: centerX - particle.size / 2,
          top: centerY - particle.size / 2,
          width: particle.size,
          height: particle.size,
          backgroundColor: particle.color,
          boxShadow: `0 0 14px ${particle.color}`,
        },
        particleStyle,
      ]}
    />
  );
}

function BurstShardView({
  accentColor,
  centerX,
  centerY,
  openAnim,
  shard,
}: {
  accentColor: string;
  centerX: number;
  centerY: number;
  openAnim: SharedValue<number>;
  shard: PackBurstPattern["shards"][number];
}) {
  const shardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      openAnim.value,
      [0, 0.62, 0.68, 1],
      [0, 0, 1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateX: interpolate(
          openAnim.value,
          [0, 0.62, 0.76, 1],
          [0, 0, shard.travelX * 0.16, shard.travelX],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          openAnim.value,
          [0, 0.62, 0.76, 1],
          [0, 0, shard.travelY * 0.16, shard.travelY],
          Extrapolation.CLAMP,
        ),
      },
      { rotate: shard.spin },
      {
        scale: interpolate(
          openAnim.value,
          [0, 0.62, 0.74, 1],
          [0.8, 0.8, 1, 1.25],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View
      key={shard.id}
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: centerX - shard.width / 2,
          top: centerY - shard.height / 2,
          width: shard.width,
          height: shard.height,
        },
        shardStyle,
      ]}
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
}

export function CrackedPackPreview({
  pack,
  width,
  tc,
  openAnim,
  burstPattern,
}: {
  pack: Pack;
  width: number;
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
  openAnim: SharedValue<number>;
  burstPattern?: PackBurstPattern;
}) {
  const height = width / PACK_CARD_RATIO;
  const resolvedPattern =
    burstPattern ?? createBurstPattern(width, height, pack);
  const centerX = width / 2;
  const centerY = height * 0.47;
  const accentColor = pack.color || tc.primary;
  const packStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      openAnim.value,
      [0, 0.45, 0.72, 1],
      [1, 1, 1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateX: interpolate(
          openAnim.value,
          [0, 0.18, 0.34, 0.52, 0.72, 0.94, 1],
          [0, -2, 2, -3, 4, 3, 0],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          openAnim.value,
          [0, 0.18, 0.34, 0.52, 0.72, 0.94, 1],
          [0, 1, -2, -1, 2, -3, 0],
          Extrapolation.CLAMP,
        ),
      },
      {
        rotateZ: `${interpolate(
          openAnim.value,
          [0, 0.18, 0.34, 0.52, 0.72, 0.94, 1],
          [0, -1, 1.1, -1.4, 1.9, 2.4, 25],
          Extrapolation.CLAMP,
        )}deg`,
      },
      {
        scale: interpolate(
          openAnim.value,
          [0, 0.45, 0.72, 1],
          [1, 1.06, 1.2, 0.42],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const seamStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      openAnim.value,
      [0, 0.18, 0.62, 1],
      [0, 0.85, 0, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scaleY: interpolate(
          openAnim.value,
          [0, 0.62, 1],
          [0.5, 1.18, 1.18],
          Extrapolation.CLAMP,
        ),
      },
      {
        scaleX: interpolate(
          openAnim.value,
          [0, 0.62, 1],
          [0.6, 1.7, 1.7],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const flareStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      openAnim.value,
      [0, 0.38, 0.68, 1],
      [0, 0, 1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          openAnim.value,
          [0, 0.38, 0.68, 0.82, 1],
          [0.2, 0.2, 3.5, 14, 14],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const shockwaveStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      openAnim.value,
      [0, 0.62, 0.72, 1],
      [0, 0, 0.95, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          openAnim.value,
          [0, 0.62, 1],
          [0.2, 0.2, 5.5],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          alignItems: "center",
          justifyContent: "center",
        },
        packStyle,
      ]}
    >
      <PackFaceCanvas pack={pack} width={width} height={height} tc={tc} />
      <Animated.View
        pointerEvents="none"
        style={[
          asStyle({
            position: "absolute",
            left: centerX - Math.max(18, width * 0.065),
            top: 24,
            width: Math.max(36, width * 0.16),
            height: height - 46,
            borderRadius: 999,
            backgroundColor: "rgba(255, 242, 170, 0.92)",
          }),
          seamStyle,
        ]}
      />
      <Svg
        pointerEvents="none"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        {resolvedPattern.cracks.map((crack, crackIndex) => (
          <AnimatedCrackPaths
            key={`crack-${crackIndex}`}
            crack={crack}
            crackIndex={crackIndex}
            openAnim={openAnim}
          />
        ))}
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={[
          packScreenStyles.burstFlare,
          {
            left: centerX - 15,
            top: centerY - 15,
          },
          flareStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          packScreenStyles.burstShockwave,
          {
            left: centerX - 60,
            top: centerY - 60,
          },
          shockwaveStyle,
        ]}
      />
      {resolvedPattern.particles.map((particle) => (
        <BurstParticleView
          key={particle.id}
          centerX={centerX}
          centerY={centerY}
          openAnim={openAnim}
          particle={particle}
        />
      ))}
      {resolvedPattern.shards.map((shard) => (
        <BurstShardView
          key={shard.id}
          accentColor={accentColor}
          centerX={centerX}
          centerY={centerY}
          openAnim={openAnim}
          shard={shard}
        />
      ))}
    </Animated.View>
  );
}

export function RevealPullProgress({
  cards,
  revealProgress,
  revealedIndex,
  tc,
  themeName,
}: {
  cards: OpenedCard[];
  revealProgress: SharedValue<number>;
  revealedIndex: number;
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
  themeName: ThemeName;
}) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <View className="w-full flex-row gap-1.5">
      {cards.map((card, index) => {
        const rarityName = toRarityName(card.rarity?.name);
        const rarityPalette =
          getThemeRarityPalette(themeName, rarityName) ??
          getThemeRarityPalette(themeName, "Common");

        return (
          <RevealPullProgressSegment
            key={`${card.id}-${index}`}
            colorFrom={rarityPalette.from}
            colorTo={rarityPalette.to}
            index={index}
            revealProgress={revealProgress}
            revealedIndex={revealedIndex}
            trackColor={withAlpha(tc.primaryBorder, "66")}
          />
        );
      })}
    </View>
  );
}

function RevealPullProgressSegment({
  colorFrom,
  colorTo,
  index,
  revealProgress,
  revealedIndex,
  trackColor,
}: {
  colorFrom: string;
  colorTo: string;
  index: number;
  revealProgress: SharedValue<number>;
  revealedIndex: number;
  trackColor: string;
}) {
  const isPast = index < revealedIndex;
  const isCurrent = index === revealedIndex;
  const fillStyle = useAnimatedStyle(() => ({
    opacity: isPast
      ? 1
      : interpolate(revealProgress.value, [0, 0.42, 1], [0, 0.35, 1]),
  }));

  return (
    <View
      className="h-2 flex-1 overflow-hidden rounded-full"
      style={{ backgroundColor: trackColor }}
    >
      {isPast || isCurrent ? (
        <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
          <LinearGradient
            colors={[colorFrom, colorTo]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

export function LoadingProgressFill({
  color,
  progress,
}: {
  color: string;
  progress: SharedValue<number>;
}) {
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return (
    <Animated.View
      style={[
        {
          height: "100%",
          borderRadius: 999,
          backgroundColor: color,
        },
        progressStyle,
      ]}
    />
  );
}

export function ReadyRevealGlow({
  anim,
  height,
  surfaceColor,
  width,
}: {
  anim: SharedValue<number>;
  height: number;
  surfaceColor: string;
  width: number;
}) {
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(anim.value, [0, 0.45, 1], [0.56, 0.2, 0]),
    transform: [{ scale: interpolate(anim.value, [0, 1], [0.88, 1.16]) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width,
          height,
          borderRadius: 999,
          backgroundColor: surfaceColor,
        },
        glowStyle,
      ]}
    />
  );
}

export function ReadyRevealStackWrapper({
  anim,
  children,
}: {
  anim: SharedValue<number>;
  children: ReactNode;
}) {
  const stackStyle = useAnimatedStyle(() => ({
    opacity: interpolate(anim.value, [0, 0.28, 1], [0, 0.22, 1]),
    transform: [{ scale: interpolate(anim.value, [0, 1], [0.86, 1]) }],
  }));

  return <Animated.View style={stackStyle}>{children}</Animated.View>;
}

export function RevealCardStage({
  accessToken,
  card,
  cardBackVisualMap,
  flipAnim,
  isRevealSettled,
  isSparkReveal,
  newBadgeLabel,
  rarityName,
  rarityRing,
  revealCardWidth,
  revealHaloAnim,
  revealSparkAnim,
  tc,
  themeName,
}: {
  accessToken: string | null;
  card: OpenedCard;
  cardBackVisualMap: CardBackVisualMap;
  flipAnim: SharedValue<number>;
  isRevealSettled: boolean;
  isSparkReveal: boolean;
  newBadgeLabel: string;
  rarityName: RarityName;
  rarityRing: string;
  revealCardWidth: number;
  revealHaloAnim: SharedValue<number>;
  revealSparkAnim: SharedValue<number>;
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
  themeName: ThemeName;
}) {
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(flipAnim.value, [0, 1], [0.94, 1]) }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      flipAnim.value,
      [0, 0.42, 0.58, 1],
      [1, 1, 0, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      { perspective: 1400 },
      { rotateY: `${interpolate(flipAnim.value, [0, 1], [0, 180])}deg` },
    ],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      flipAnim.value,
      [0, 0.42, 0.58, 1],
      [0, 0, 1, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      { perspective: 1400 },
      { rotateY: `${interpolate(flipAnim.value, [0, 1], [180, 360])}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          width: revealCardWidth,
          aspectRatio: REVEAL_CARD_RATIO,
        },
        cardStyle,
      ]}
    >
      <RevealCardHalo
        color={rarityRing}
        opacityAnim={revealHaloAnim}
        rarityName={rarityName}
        isSparkReveal={isSparkReveal}
        themeName={themeName}
        width={revealCardWidth}
      />
      {isSparkReveal ? (
        <SparkRevealOverlay
          color={rarityRing}
          anim={revealSparkAnim}
          width={revealCardWidth}
        />
      ) : null}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            inset: 0,
            zIndex: 5,
            backfaceVisibility: "hidden",
          },
          backStyle,
        ]}
      >
        <CardBackFace
          width={revealCardWidth}
          themeName={themeName}
          rarityName={rarityName}
          cardBackVisualMap={cardBackVisualMap}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            inset: 0,
            zIndex: 10,
            backfaceVisibility: "hidden",
          },
          frontStyle,
        ]}
      >
        <CardTile
          entry={toCardTileEntry(card)}
          size="large"
          fitContainer
          accessToken={accessToken}
        />
      </Animated.View>

      {card.isNewForUser ? (
        <View
          className="absolute right-3 top-3 z-30"
          style={{ opacity: isRevealSettled ? 1 : 0 }}
        >
          <LinearGradient
            colors={[tc.success, tc.successDark]}
            style={{
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Text className="font-nunito-extrabold text-[10px] text-white">
              {newBadgeLabel}
            </Text>
          </LinearGradient>
        </View>
      ) : null}
    </Animated.View>
  );
}

export const SectionBadge = sectionBadge;

function sectionBadge({
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

export const PackSummaryCardSheet = usePackSummaryCardSheetView;

function usePackSummaryCardSheetView({
  card,
  accessToken,
  onClose,
}: {
  card: OpenedCard;
  accessToken: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const [index, setIndex] = useState(1);
  const topGap = Math.max(insets.top + 16, 56);
  const maxSheetHeight = Math.max(0, height - topGap);
  const bottomContentPadding = Math.max(insets.bottom + 36, 64);
  const cardWidth = Math.min(width - 48, 340);
  const rarityName = card.rarity?.name ?? "Common";
  const rarityColor = RARITY_COLORS[rarityName] ?? RARITY_COLORS.Common;
  const sheetSurface = useMemo(
    () => (
      <View
        className="bg-bg"
        style={[
          StyleSheet.absoluteFill,
          {
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
          },
        ]}
      />
    ),
    [],
  );

  const stats = [
    {
      label: "HP",
      value: card.hp,
      color: tc.dangerDark,
      backgroundColor: tc.dangerTint,
    },
    {
      label: "ATK",
      value: card.attack,
      color: tc.secondaryText,
      backgroundColor: tc.secondaryTint,
    },
    {
      label: "DEF",
      value: card.defense,
      color: tc.infoText,
      backgroundColor: tc.infoTint,
    },
    {
      label: "SPD",
      value: card.speed,
      color: tc.successText,
      backgroundColor: tc.successTint,
    },
  ];

  return (
    <ModalBottomSheet
      index={index}
      onIndexChange={setIndex}
      onSettle={(nextIndex) => {
        if (nextIndex === 0) {
          onClose();
        }
      }}
      detents={[0, "content"]}
      scrimColor="rgba(0,0,0,0.4)"
      surface={sheetSurface}
    >
      <View
        className="bg-bg"
        style={{
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          maxHeight: maxSheetHeight,
          minHeight: Math.min(maxSheetHeight, height * 0.7),
          overflow: "hidden",
        }}
        testID="pack-summary-card-preview-sheet"
      >
        <View className="items-center pb-2 pt-3">
          <View
            className="h-1.5 w-10 rounded-full"
            style={{ backgroundColor: tc.muted }}
          />
        </View>
        <View
          className="border-b border-primaryTint px-6 py-4"
          testID="pack-summary-card-preview-header"
        >
          <View>
            <View>
              <Text
                className="font-nunito-extrabold text-2xl text-fg"
                numberOfLines={1}
              >
                {card.name}
              </Text>
              <Text
                className="mt-1 font-nunito-semibold text-sm text-fgMuted"
                numberOfLines={1}
              >
                {t("packs.summary.cardDetailsSubtitle", {
                  character: card.character,
                })}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentInset={{ bottom: bottomContentPadding }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 18,
            paddingBottom: 96,
            gap: 16,
          }}
        >
          <View className="items-center">
            <View style={{ width: cardWidth }}>
              <CardTile
                entry={toCardTileEntry(card)}
                accessToken={accessToken}
                size="large"
                fitContainer
              />
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {[
              {
                label: t("packs.summary.cardRarity"),
                value: rarityName,
                textColor: rarityColor.to,
                backgroundColor: withAlpha(rarityColor.ring, "22"),
                borderColor: withAlpha(rarityColor.ring, "66"),
              },
              {
                label: t("packs.summary.cardType"),
                value: card.type,
                textColor: tc.primaryStrong,
                backgroundColor: tc.surface,
                borderColor: tc.primaryBorder,
              },
              {
                label: t("packs.summary.cardPull"),
                value: card.isNewForUser
                  ? t("packs.reveal.newCard")
                  : t("packs.reveal.duplicate"),
                textColor: card.isNewForUser ? tc.successText : tc.fgMuted,
                backgroundColor: card.isNewForUser
                  ? tc.successTint
                  : tc.surfaceMuted,
                borderColor: card.isNewForUser
                  ? tc.successBorder
                  : tc.primaryBorder,
              },
              {
                label: t("packs.summary.cardCharacter"),
                value: card.character,
                textColor: tc.secondaryText,
                backgroundColor: tc.secondaryTint,
                borderColor: tc.secondaryBorder,
              },
            ].map((metric) => (
              <View
                key={metric.label}
                className="w-[47.5%] gap-1 rounded-[18px] border px-[14px] py-3"
                style={{
                  borderColor: metric.borderColor,
                  backgroundColor: metric.backgroundColor,
                }}
              >
                <Text className="font-nunito-semibold text-[12px] text-fgMuted">
                  {metric.label}
                </Text>
                <Text
                  className="font-nunito-extrabold text-[18px]"
                  numberOfLines={1}
                  style={{ color: metric.textColor }}
                >
                  {metric.value}
                </Text>
              </View>
            ))}
          </View>

          <View
            className="gap-4 rounded-[24px] border p-4"
            style={{
              backgroundColor: tc.surface,
              borderColor: tc.primaryBorder,
            }}
            testID="pack-summary-card-preview-stats"
          >
            <View className="flex-row items-center justify-between gap-3">
              <Text className="font-nunito-extrabold text-base text-fg">
                {t("collection.detail.stats")}
              </Text>
              <LinearGradient
                colors={[rarityColor.from, rarityColor.to]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                }}
              >
                <Text className="font-nunito-extrabold text-[11px] text-white">
                  {rarityName.toUpperCase()}
                </Text>
              </LinearGradient>
            </View>

            <View className="flex-row gap-2.5">
              {stats.map((stat) => (
                <View
                  key={stat.label}
                  className="flex-1 items-center gap-0.5 rounded-[18px] px-2 py-3"
                  style={{ backgroundColor: stat.backgroundColor }}
                >
                  <Text
                    className="font-nunito-extrabold text-[20px]"
                    style={{ color: stat.color }}
                  >
                    {stat.value}
                  </Text>
                  <Text className="font-nunito-bold text-[11px] text-fgMuted">
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </ModalBottomSheet>
  );
}
