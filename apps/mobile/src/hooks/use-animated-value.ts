import { useRef } from "react";
import { Animated } from "react-native";

export function useAnimatedValue(initialValue: number) {
  const ref = useRef<Animated.Value | null>(null);

  if (ref.current === null) {
    ref.current = new Animated.Value(initialValue);
  }

  return ref.current;
}
