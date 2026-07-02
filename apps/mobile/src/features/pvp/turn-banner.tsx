import { useEffect, useRef } from "react";
import { Animated } from "../../lib/native-animated";
import type { AnimatedValue } from "../../lib/native-animated";
import { LinearGradient } from "expo-linear-gradient";

import { useTranslation } from "../../i18n";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";
import { asStyle } from "../../lib/style-object";

interface TurnBannerProps {
  isMyTurn: boolean;
  onDone: () => void;
}

export function TurnBanner({ isMyTurn, onDone }: TurnBannerProps) {
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const scaleRef = useRef<AnimatedValue | null>(null);
  const opacityRef = useRef<AnimatedValue | null>(null);
  const translateYRef = useRef<AnimatedValue | null>(null);

  if (scaleRef.current === null) {
    scaleRef.current = new Animated.Value(0.8);
  }
  if (opacityRef.current === null) {
    opacityRef.current = new Animated.Value(0);
  }
  if (translateYRef.current === null) {
    translateYRef.current = new Animated.Value(12);
  }

  const scale = scaleRef.current;
  const opacity = opacityRef.current;
  const translateY = translateYRef.current;

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 150, useNativeDriver: true }),
        Animated.delay(920),
        Animated.timing(scale, { toValue: 0.92, duration: 220, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(980),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.spring(translateY, { toValue: 0, damping: 13, stiffness: 160, useNativeDriver: true }),
        Animated.delay(940),
        Animated.timing(translateY, { toValue: -10, duration: 220, useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [onDone, opacity, scale, translateY]);

  return (
    <Animated.View
      testID="pvp-turn-banner"
      pointerEvents="none"
      style={asStyle({
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 200,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale }, { translateY }],
        opacity,
      })}
    >
      <Animated.View
        style={{
          overflow: "hidden",
          borderRadius: 26,
          borderWidth: 2,
          borderColor: "rgba(255,255,255,0.38)",
          boxShadow: isMyTurn
            ? "0 10px 18px rgba(20,184,166,0.28)"
            : "0 10px 18px rgba(244,63,94,0.28)",
        }}
      >
        <LinearGradient
          colors={
            isMyTurn
              ? [tc.success, tc.infoDark]
              : [tc.dangerDark, tc.accentDark]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: 36,
            paddingVertical: 18,
          }}
        >
        <Animated.Text
          style={{
            color: "#fff",
            fontSize: 26,
            fontFamily: "Nunito_800ExtraBold",
            textAlign: "center",
            textShadowColor: "rgba(0,0,0,0.28)",
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 4,
          }}
        >
          {isMyTurn ? t("pvp.turnBanner.yourTurn") : t("pvp.turnBanner.opponentTurn")}
        </Animated.Text>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}
