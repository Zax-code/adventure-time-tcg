import { useEffect, useRef } from "react";
import { Animated, Text } from "react-native";

interface FloatingNumberProps {
  amount: number;
  type: "damage" | "crit" | "shieldCrit" | "heal" | "miss";
  onDone: () => void;
}

const TYPE_CONFIG: Record<FloatingNumberProps["type"], { color: string; fontSize: number; prefix: string }> = {
  damage: { color: "#EF4444", fontSize: 16, prefix: "-" },
  crit: { color: "#F97316", fontSize: 22, prefix: "-" },
  shieldCrit: { color: "#22D3EE", fontSize: 22, prefix: "-" },
  heal: { color: "#10B981", fontSize: 16, prefix: "+" },
  miss: { color: "#9CA3AF", fontSize: 14, prefix: "" },
};

export function FloatingNumber({ amount, type, onDone }: FloatingNumberProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -60, duration: 700, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
  }, []);

  const cfg = TYPE_CONFIG[type];
  const label = type === "miss" ? "MISS" : `${cfg.prefix}${amount}`;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { transform: [{ translateY }], opacity },
        {
          position: "absolute",
          alignSelf: "center",
          top: "30%",
          zIndex: 100,
        },
      ]}
    >
      <Text
        style={{
          color: cfg.color,
          fontSize: cfg.fontSize,
          fontFamily: "Nunito_800ExtraBold",
          textShadowColor: "rgba(0,0,0,0.8)",
          textShadowOffset: { width: 1, height: 1 },
          textShadowRadius: 2,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}
