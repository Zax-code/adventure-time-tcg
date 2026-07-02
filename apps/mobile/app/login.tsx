import { LinearGradient } from "expo-linear-gradient";
import { useRef, useEffect } from "react";
import { Animated, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthForm } from "../src/components/auth-form";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "../src/components/keyboard-aware-scroll-props";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS, THEME_VARS } from "../src/theme/themes";
import { useAnimatedValue } from "../src/hooks/use-animated-value";

const PARTICLES = [
  { left: "8%", top: "12%", size: 14, delay: 0, duration: 3200 },
  { left: "78%", top: "8%", size: 10, delay: 500, duration: 2800 },
  { left: "22%", top: "28%", size: 8, delay: 1000, duration: 3600 },
  { left: "88%", top: "35%", size: 12, delay: 300, duration: 3000 },
  { left: "5%", top: "55%", size: 9, delay: 700, duration: 2600 },
  { left: "92%", top: "60%", size: 11, delay: 1200, duration: 3400 },
  { left: "15%", top: "72%", size: 7, delay: 400, duration: 2900 },
  { left: "82%", top: "78%", size: 13, delay: 900, duration: 3100 },
  { left: "45%", top: "5%", size: 8, delay: 600, duration: 3300 },
  { left: "55%", top: "88%", size: 10, delay: 1100, duration: 2700 },
  { left: "35%", top: "92%", size: 7, delay: 200, duration: 3500 },
  { left: "70%", top: "20%", size: 9, delay: 800, duration: 2950 },
] as const;

function FloatingHeart({
  left,
  top,
  size,
  delay,
  duration,
  color,
}: (typeof PARTICLES)[number] & { color: string }) {
  const anim = useAnimatedValue(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay, duration]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.7, 0.3],
  });

  return (
    <Animated.View
      style={{
        position: "absolute",
        left,
        top,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        transform: [{ translateY }],
        opacity,
      }}
    />
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const params = useLocalSearchParams<{
    email?: string;
    code?: string;
    locale?: "en" | "fr";
    mode?: "login" | "verify" | "reset-password";
    auto_verify?: string;
  }>();

  return (
    <LinearGradient
      colors={[tc.bg, tc.primaryBg, tc.primaryTint]}
      style={[{ flex: 1 }, THEME_VARS[themeName] as never]}
    >
      {PARTICLES.map((p) => (
        <FloatingHeart
          {...p}
          key={`${p.left}-${p.top}-${p.size}`}
          color={tc.primary}
        />
      ))}
      <ScrollView
        {...KEYBOARD_AWARE_SCROLL_PROPS}
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 20,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <AuthForm
            prefill={{
              email:
                typeof params.email === "string" ? params.email : undefined,
              code: typeof params.code === "string" ? params.code : undefined,
              locale:
                params.locale === "fr"
                  ? "fr"
                  : params.locale === "en"
                    ? "en"
                    : undefined,
              mode:
                params.mode === "verify"
                  ? "verify"
                  : params.mode === "reset-password"
                    ? "reset-password"
                    : params.mode === "login"
                      ? "login"
                      : undefined,
              autoVerify: params.auto_verify === "true",
            }}
          />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
