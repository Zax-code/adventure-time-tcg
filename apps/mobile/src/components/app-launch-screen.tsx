import { useEffect, useRef } from "react";
import { Text, View, type ViewStyle } from "react-native";
import { Animated } from "../lib/native-animated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { useTranslation } from "../i18n";
import { useThemeStore } from "../stores/theme-store";
import { THEME_COLORS, type ThemeName } from "../theme/themes";
import { useAnimatedValue } from "../hooks/use-animated-value";

const LAUNCH_GRADIENTS: Record<ThemeName, [string, string, string]> = {
  candy: ["#FFE3F1", "#FF8BC1", "#FF4AA2"],
  ice: ["#E0F2FE", "#7DD3FC", "#60A5FA"],
  nightosphere: ["#120813", "#3B0A45", "#0D0010"],
};

const PHASE_DOT_DELAYS = [0, 180, 360] as const;

function PulseDot({ delay, color }: { delay: number; color: string }) {
  const anim = useAnimatedValue(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 900,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [anim, delay]);

  return (
    <Animated.View
      style={{
        width: 10,
        height: 10,
        borderRadius: 999,
        backgroundColor: color,
        opacity: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.35, 1],
        }),
        transform: [
          {
            scale: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.85, 1.15],
            }),
          },
        ],
      }}
    />
  );
}

function OrbitBubble({
  style,
  color,
  scale,
}: {
  style: ViewStyle;
  color: string;
  scale: number;
}) {
  return (
    <View
      className="absolute rounded-full"
      style={{
        backgroundColor: color,
        opacity: 0.2,
        transform: [{ scale }],
        ...style,
      }}
    />
  );
}

export function AppLaunchScreen({
  phase,
}: {
  phase: "hydrating" | "restoring";
}) {
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const statusText =
    phase === "restoring"
      ? t("common.launch.restoring")
      : t("common.launch.preparing");

  return (
    <LinearGradient
      colors={LAUNCH_GRADIENTS[themeName]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <View className="flex-1 overflow-hidden px-6 py-10">
        <OrbitBubble
          style={{ left: -48, top: 64, width: 160, height: 160 }}
          color={tc.secondaryTint}
          scale={1}
        />
        <OrbitBubble
          style={{ right: -28, top: 96, width: 112, height: 112 }}
          color={tc.accentTint}
          scale={1.2}
        />
        <OrbitBubble
          style={{ bottom: 48, left: 16, width: 128, height: 128 }}
          color={tc.primaryTint}
          scale={1.1}
        />
        <OrbitBubble
          style={{ right: 8, bottom: 96, width: 192, height: 192 }}
          color={tc.infoTint}
          scale={1}
        />

        <View className="flex-1 items-center justify-center">
          <View
            className="w-full overflow-hidden border bg-white/15 p-3"
            style={{
              maxWidth: 360,
              borderRadius: 36,
              borderColor: "rgba(255,255,255,0.35)",
              boxShadow: "0px 10px 20px rgba(0, 0, 0, 0.16)",
            }}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0.85)", "rgba(255,255,255,0.2)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 28, padding: 10 }}
            >
              <View
                className="overflow-hidden border bg-white/30"
                style={{
                  borderRadius: 24,
                  borderColor: "rgba(255,255,255,0.4)",
                }}
              >
                <Image
                  source={require("../../assets/splash-icon.png")}
                  style={{ width: "100%", aspectRatio: 941 / 1672 }}
                  contentFit="cover"
                />
              </View>
            </LinearGradient>
          </View>

          <View
            className="mt-8 w-full items-center gap-4"
            style={{ maxWidth: 360 }}
          >
            <View
              className="rounded-full border bg-white/15 px-4 py-2"
              style={{ borderColor: "rgba(255,255,255,0.35)" }}
            >
              <Text
                className="font-nunito-bold text-xs uppercase text-white"
                style={{ letterSpacing: 2, opacity: 0.9 }}
              >
                {t("common.launch.eyebrow")}
              </Text>
            </View>

            <View className="gap-2 px-3">
              <Text className="text-center font-nunito-extrabold text-4xl leading-10 text-white">
                {t("common.launch.title")}
              </Text>
              <Text className="text-center font-nunito text-base leading-6 text-white/85">
                {t("common.launch.subtitle")}
              </Text>
            </View>

            <View
              className="mt-2 w-full border bg-white/15 px-5 py-4"
              style={{
                borderRadius: 28,
                borderColor: "rgba(255,255,255,0.3)",
              }}
            >
              <View className="flex-row items-center justify-center gap-2">
                {PHASE_DOT_DELAYS.map((delay) => (
                  <PulseDot
                    key={delay}
                    delay={delay}
                    color={tc.secondaryDark}
                  />
                ))}
              </View>
              <Text className="mt-3 text-center font-nunito-semibold text-sm text-white">
                {statusText}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}
