import { useRef } from "react";
import { Animated } from "../lib/native-animated";
import type { AnimatedValue } from "../lib/native-animated";

export function useAnimatedValue(initialValue: number) {
  const ref = useRef<AnimatedValue | null>(null);

  if (ref.current === null) {
    ref.current = new Animated.Value(initialValue);
  }

  return ref.current;
}
