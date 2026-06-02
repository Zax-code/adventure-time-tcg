import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { useTranslation } from "../../i18n";

interface TurnBannerProps {
  isMyTurn: boolean;
  onDone: () => void;
}

export function TurnBanner({ isMyTurn, onDone }: TurnBannerProps) {
  const { t } = useTranslation();
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(scale, { toValue: 0.8, duration: 250, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
  }, []);

  return (
    <Animated.View
      testID="pvp-turn-banner"
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 200,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale }],
          opacity,
        },
      ]}
    >
      <Animated.View
        style={{
          paddingHorizontal: 32,
          paddingVertical: 16,
          borderRadius: 16,
          backgroundColor: isMyTurn ? "#2DD4BF" : "#6B7280",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <Animated.Text
          style={{
            color: "#fff",
            fontSize: 24,
            fontFamily: "Nunito_800ExtraBold",
            textAlign: "center",
          }}
        >
          {isMyTurn ? t("pvp.turnBanner.yourTurn") : t("pvp.turnBanner.opponentTurn")}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}
