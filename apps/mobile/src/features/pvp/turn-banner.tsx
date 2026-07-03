import { useCallback, useEffect, useRef } from "react";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

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
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const handleDone = useCallback(() => {
    onDoneRef.current();
  }, []);

  useEffect(() => {
    scale.value = 0.8;
    opacity.value = 0;
    translateY.value = 12;

    scale.value = withSequence(
      withSpring(1, { damping: 12, stiffness: 150 }),
      withDelay(920, withTiming(0.92, { duration: 220 })),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 180 }),
      withDelay(
        980,
        withTiming(0, { duration: 220 }, (finished) => {
          if (finished) {
            runOnJS(handleDone)();
          }
        }),
      ),
    );
    translateY.value = withSequence(
      withSpring(0, { damping: 13, stiffness: 160 }),
      withDelay(940, withTiming(-10, { duration: 220 })),
    );
  }, [handleDone, isMyTurn, opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Animated.View
      testID="pvp-turn-banner"
      pointerEvents="none"
      style={[
        asStyle({
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 200,
          alignItems: "center",
          justifyContent: "center",
        }),
        animatedStyle,
      ]}
    >
      <View
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
          <Text
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
            {isMyTurn
              ? t("pvp.turnBanner.yourTurn")
              : t("pvp.turnBanner.opponentTurn")}
          </Text>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}
