import { useEffect, useRef } from "react";
import { Text } from "react-native";
import { Animated } from "../../lib/native-animated";
import type { AnimatedValue } from "../../lib/native-animated";

interface FloatingNumberProps {
  amount: number;
  type: "damage" | "crit" | "shieldCrit" | "heal" | "miss";
  onDone: () => void;
}

const TYPE_CONFIG: Record<
  FloatingNumberProps["type"],
  { color: string; fontSize: number; prefix: string }
> = {
  damage: { color: "#FEE2E2", fontSize: 17, prefix: "-" },
  crit: { color: "#FFFBEB", fontSize: 19, prefix: "-" },
  shieldCrit: { color: "#ECFEFF", fontSize: 19, prefix: "-" },
  heal: { color: "#D1FAE5", fontSize: 17, prefix: "+" },
  miss: { color: "#E5E7EB", fontSize: 15, prefix: "" },
};

export function FloatingNumber({ amount, type, onDone }: FloatingNumberProps) {
  const translateYRef = useRef<AnimatedValue | null>(null);
  const opacityRef = useRef<AnimatedValue | null>(null);
  const scaleRef = useRef<AnimatedValue | null>(null);

  if (translateYRef.current === null) {
    translateYRef.current = new Animated.Value(0);
  }
  if (opacityRef.current === null) {
    opacityRef.current = new Animated.Value(1);
  }
  if (scaleRef.current === null) {
    scaleRef.current = new Animated.Value(0.78);
  }

  const translateY = translateYRef.current;
  const opacity = opacityRef.current;
  const scale = scaleRef.current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -72,
        duration: 820,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.16,
          damping: 8,
          stiffness: 180,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(520),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [opacity, onDone, scale, translateY]);

  const cfg = TYPE_CONFIG[type];
  const isCritical = type === "crit" || type === "shieldCrit";
  const label =
    type === "miss"
      ? "MISS"
      : isCritical
        ? `CRIT ${cfg.prefix}${amount}`
        : `${cfg.prefix}${amount}`;
  const bg =
    type === "heal"
      ? "rgba(5,150,105,0.92)"
      : type === "miss"
        ? "rgba(71,85,105,0.92)"
        : isCritical
          ? "rgba(217,119,6,0.96)"
          : "rgba(220,38,38,0.94)";
  const borderColor = isCritical
    ? "rgba(253,224,71,0.92)"
    : "rgba(255,255,255,0.62)";

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { transform: [{ translateY }, { scale }], opacity },
        {
          position: "absolute",
          alignSelf: "center",
          top: "28%",
          zIndex: 100,
          backgroundColor: bg,
          borderColor,
          borderWidth: isCritical ? 3 : 2,
          borderRadius: isCritical ? 8 : 999,
          paddingHorizontal: isCritical ? 12 : 10,
          paddingVertical: isCritical ? 5 : 3,
        },
      ]}
    >
      <Text
        style={{
          color: cfg.color,
          fontSize: cfg.fontSize,
          fontFamily: "Nunito_800ExtraBold",
          textShadowColor: "rgba(0,0,0,0.45)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}
