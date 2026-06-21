import { useEffect, type ReactNode } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import {
  CARD_DUST_ACTION_DURATION_MS,
  type CardDustActionAnimationState,
  type CardDustActionType,
} from "./card-dust-action-animation-config";
import { CraftIcon, DustIcon } from "./icons";

type CardDustActionFrameProps = {
  animation: CardDustActionAnimationState | null;
  children: ReactNode;
  lockedCard?: ReactNode;
  craftColor: string;
  maxWidth?: number;
  recycleColor: string;
  testID?: string;
};

type ParticleConfig = {
  id: string;
  left: `${number}%`;
  top: `${number}%`;
  size: number;
  dx: number;
  dy: number;
  delay: number;
};

const CARD_STAGE_WIDTH = 320;
const CARD_STAGE_HEIGHT = 480;
const CARD_STAGE_RADIUS = 22;
const ABSOLUTE_FILL = {
  bottom: 0,
  left: 0,
  position: "absolute",
  right: 0,
  top: 0,
} as const;

const CRAFT_PARTICLES: ParticleConfig[] = [
  {
    id: "upper-left",
    left: "19%",
    top: "20%",
    size: 5,
    dx: -34,
    dy: -42,
    delay: 0.04,
  },
  {
    id: "upper-right",
    left: "74%",
    top: "18%",
    size: 4,
    dx: 30,
    dy: -48,
    delay: 0.1,
  },
  {
    id: "middle-left",
    left: "31%",
    top: "42%",
    size: 6,
    dx: -48,
    dy: -10,
    delay: 0.16,
  },
  {
    id: "middle-right",
    left: "66%",
    top: "45%",
    size: 5,
    dx: 46,
    dy: -14,
    delay: 0.2,
  },
  {
    id: "lower-left",
    left: "22%",
    top: "70%",
    size: 4,
    dx: -24,
    dy: 34,
    delay: 0.24,
  },
  {
    id: "lower-right",
    left: "78%",
    top: "72%",
    size: 5,
    dx: 30,
    dy: 34,
    delay: 0.28,
  },
  {
    id: "top-center",
    left: "48%",
    top: "26%",
    size: 3,
    dx: 4,
    dy: -56,
    delay: 0.12,
  },
  {
    id: "bottom-center",
    left: "50%",
    top: "78%",
    size: 4,
    dx: 0,
    dy: 48,
    delay: 0.3,
  },
];

const RECYCLE_PARTICLES: ParticleConfig[] = [
  {
    id: "top-left",
    left: "20%",
    top: "28%",
    size: 5,
    dx: -16,
    dy: -96,
    delay: 0.02,
  },
  {
    id: "top-center",
    left: "43%",
    top: "22%",
    size: 4,
    dx: 10,
    dy: -116,
    delay: 0.1,
  },
  {
    id: "top-right",
    left: "68%",
    top: "30%",
    size: 5,
    dx: 28,
    dy: -104,
    delay: 0.14,
  },
  {
    id: "middle-left",
    left: "29%",
    top: "50%",
    size: 4,
    dx: -32,
    dy: -88,
    delay: 0.2,
  },
  {
    id: "middle-right",
    left: "61%",
    top: "53%",
    size: 6,
    dx: 34,
    dy: -92,
    delay: 0.24,
  },
  {
    id: "lower-center",
    left: "50%",
    top: "72%",
    size: 5,
    dx: 2,
    dy: -112,
    delay: 0.3,
  },
  {
    id: "lower-right",
    left: "76%",
    top: "66%",
    size: 3,
    dx: 22,
    dy: -84,
    delay: 0.34,
  },
  {
    id: "lower-left",
    left: "17%",
    top: "74%",
    size: 3,
    dx: -18,
    dy: -78,
    delay: 0.38,
  },
];

function actionProgress(progress: number, delay: number) {
  "worklet";
  return Math.max(0, Math.min(1, (progress - delay) / (1 - delay)));
}

function ActionParticle({
  color,
  particle,
  progress,
  type,
}: {
  color: string;
  particle: ParticleConfig;
  progress: SharedValue<number>;
  type: CardDustActionType;
}) {
  const particleStyle = useAnimatedStyle(() => {
    const local = actionProgress(progress.value, particle.delay);
    const opacity = interpolate(
      local,
      [0, 0.14, 0.72, 1],
      [0, 1, type === "craft" ? 0.82 : 0.64, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      local,
      [0, 0.2, 1],
      [0.45, type === "craft" ? 1.2 : 1, 0.25],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [
        { translateX: particle.dx * local },
        { translateY: particle.dy * local },
        { scale },
      ],
    };
  });

  return (
    <Animated.View
      className="absolute rounded-full"
      style={[
        {
          backgroundColor: color,
          height: particle.size,
          left: particle.left,
          top: particle.top,
          width: particle.size,
        },
        particleStyle,
      ]}
    />
  );
}

function ActionCore({
  color,
  progress,
  type,
}: {
  color: string;
  progress: SharedValue<number>;
  type: CardDustActionType;
}) {
  const coreStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      type === "craft" ? [0, 0.16, 0.56, 1] : [0, 0.18, 0.62, 1],
      type === "craft" ? [0, 1, 0.82, 0] : [0, 0.9, 0.72, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      progress.value,
      type === "craft" ? [0, 0.2, 0.58, 1] : [0, 0.24, 1],
      type === "craft" ? [0.55, 1.12, 0.9, 0.72] : [0.6, 1, 0.36],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      progress.value,
      [0, 1],
      [0, type === "craft" ? -8 : -104],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  return (
    <Animated.View
      className="absolute items-center justify-center rounded-full"
      style={[
        {
          backgroundColor: color,
          height: type === "craft" ? 58 : 50,
          left: (CARD_STAGE_WIDTH - (type === "craft" ? 58 : 50)) / 2,
          top: type === "craft" ? 204 : 226,
          width: type === "craft" ? 58 : 50,
        },
        coreStyle,
      ]}
    >
      {type === "craft" ? (
        <CraftIcon size={25} color="#FFFFFF" />
      ) : (
        <DustIcon size={24} color="#FFFFFF" />
      )}
    </Animated.View>
  );
}

function ActionEffects({
  color,
  progress,
  type,
}: {
  color: string;
  progress: SharedValue<number>;
  type: CardDustActionType;
}) {
  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      type === "craft" ? [0, 0.22, 0.38, 0.62] : [0, 0.2, 0.48, 1],
      type === "craft" ? [0, 0.12, 0.72, 0] : [0, 0.1, 0.2, 0],
      Extrapolation.CLAMP,
    ),
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      type === "craft" ? [0, 0.18, 0.72, 1] : [0, 0.2, 0.74, 1],
      type === "craft" ? [0, 0.82, 0.32, 0] : [0, 0.72, 0.22, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          type === "craft" ? [0.94, 1.12] : [1, 0.9],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.18, 0.62, 0.9],
      type === "craft" ? [0, 0.72, 0.4, 0] : [0, 0.28, 0.2, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          type === "craft"
            ? [-CARD_STAGE_WIDTH * 0.52, CARD_STAGE_WIDTH * 1.04]
            : [CARD_STAGE_WIDTH * 0.18, CARD_STAGE_WIDTH * 0.48],
          Extrapolation.CLAMP,
        ),
      },
      { rotate: type === "craft" ? "-16deg" : "9deg" },
    ],
  }));

  const particles = type === "craft" ? CRAFT_PARTICLES : RECYCLE_PARTICLES;

  return (
    <View
      pointerEvents="none"
      style={ABSOLUTE_FILL}
      testID={`card-dust-action-${type}-effect`}
    >
      <Animated.View
        className="absolute"
        style={[
          {
            borderColor: color,
            borderRadius: CARD_STAGE_RADIUS + 8,
            borderWidth: type === "craft" ? 2 : 1,
            bottom: -6,
            left: -6,
            right: -6,
            top: -6,
          },
          haloStyle,
        ]}
      />

      <Animated.View
        className="absolute inset-0"
        style={[
          {
            backgroundColor:
              type === "craft"
                ? "rgba(255, 255, 255, 0.82)"
                : "rgba(236, 253, 245, 0.54)",
            borderRadius: CARD_STAGE_RADIUS,
          },
          flashStyle,
        ]}
      />

      <Animated.View
        className="absolute overflow-hidden"
        style={[
          {
            height: CARD_STAGE_HEIGHT * 1.36,
            top: -CARD_STAGE_HEIGHT * 0.18,
            width: type === "craft" ? 84 : 54,
          },
          sweepStyle,
        ]}
      >
        <LinearGradient
          colors={[
            "rgba(255,255,255,0)",
            type === "craft"
              ? "rgba(255,255,255,0.78)"
              : "rgba(209,250,229,0.42)",
            "rgba(255,255,255,0)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <ActionCore color={color} progress={progress} type={type} />
      {particles.map((particle) => (
        <ActionParticle
          key={`${type}-${particle.id}`}
          color={color}
          particle={particle}
          progress={progress}
          type={type}
        />
      ))}
    </View>
  );
}

export function CardDustActionFrame({
  animation,
  children,
  lockedCard,
  craftColor,
  maxWidth,
  recycleColor,
  testID,
}: CardDustActionFrameProps) {
  const progress = useSharedValue(1);
  const stageScale = Math.min(
    1,
    Math.max(0.82, (maxWidth ?? CARD_STAGE_WIDTH) / CARD_STAGE_WIDTH),
  );
  const stageWidth = CARD_STAGE_WIDTH * stageScale;
  const stageHeight = CARD_STAGE_HEIGHT * stageScale;
  const recycleDisappears =
    animation?.type === "recycle" && animation.disappearCard === true;

  useEffect(() => {
    progress.value = animation
      ? withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, {
            duration: CARD_DUST_ACTION_DURATION_MS[animation.type],
            easing:
              animation.type === "craft"
                ? Easing.out(Easing.cubic)
                : Easing.inOut(Easing.quad),
          }),
        )
      : 1;
  }, [animation, progress]);

  const cardStyle = useAnimatedStyle(() => {
    if (!animation) {
      return {};
    }

    if (animation.type === "craft") {
      return {
        transform: [
          {
            scale: interpolate(
              progress.value,
              [0, 0.28, 0.52, 1],
              [0.985, 1.018, 1.035, 1],
              Extrapolation.CLAMP,
            ),
          },
          {
            rotate: `${interpolate(
              progress.value,
              [0, 0.24, 0.52, 1],
              [0, -0.7, 0.55, 0],
              Extrapolation.CLAMP,
            )}deg`,
          },
        ],
      };
    }

    return {
      opacity: recycleDisappears
        ? interpolate(
            progress.value,
            [0, 0.46, 0.78, 1],
            [1, 1, 0.38, 0],
            Extrapolation.CLAMP,
          )
        : interpolate(
            progress.value,
            [0, 0.7, 1],
            [1, 0.94, 1],
            Extrapolation.CLAMP,
          ),
      transform: [
        {
          translateX: interpolate(
            progress.value,
            [0, 0.14, 0.28, 0.42, 0.56, 1],
            [0, -3, 3, -2, 1, 0],
            Extrapolation.CLAMP,
          ),
        },
        {
          translateY: recycleDisappears
            ? interpolate(
                progress.value,
                [0, 0.52, 1],
                [0, -2, -28],
                Extrapolation.CLAMP,
              )
            : 0,
        },
        {
          scale: interpolate(
            progress.value,
            [0, 0.22, 0.62, 1],
            recycleDisappears
              ? [1, 0.982, 0.86, 0.62]
              : [1, 0.982, 0.968, 1],
            Extrapolation.CLAMP,
          ),
        },
        {
          rotate: `${interpolate(
            progress.value,
            [0, 0.18, 0.36, 0.54, 1],
            recycleDisappears
              ? [0, -0.8, 0.8, -0.35, 2.4]
              : [0, -0.8, 0.8, -0.35, 0],
            Extrapolation.CLAMP,
          )}deg`,
        },
      ],
    };
  });

  const lockedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.24, 0.54, 0.72],
      [1, 1, 0.12, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 0.32, 0.72],
          [1, 1.012, 0.986],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const color = animation?.type === "recycle" ? recycleColor : craftColor;

  return (
    <View
      className="overflow-visible"
      style={{
        height: stageHeight,
        width: stageWidth,
      }}
      testID={testID}
    >
      <View
        style={{
          height: CARD_STAGE_HEIGHT,
          left: (stageWidth - CARD_STAGE_WIDTH) / 2,
          position: "absolute",
          top: (stageHeight - CARD_STAGE_HEIGHT) / 2,
          transform: [{ scale: stageScale }],
          width: CARD_STAGE_WIDTH,
        }}
      >
        <Animated.View style={[ABSOLUTE_FILL, cardStyle]}>
          {children}
        </Animated.View>

        {animation?.type === "craft" &&
        animation.revealLockedCard &&
        lockedCard ? (
          <Animated.View
            pointerEvents="none"
            style={[ABSOLUTE_FILL, lockedStyle]}
            testID="card-dust-action-locked-reveal"
          >
            {lockedCard}
          </Animated.View>
        ) : null}

        {animation ? (
          <ActionEffects
            color={color}
            progress={progress}
            type={animation.type}
          />
        ) : null}
      </View>
    </View>
  );
}
