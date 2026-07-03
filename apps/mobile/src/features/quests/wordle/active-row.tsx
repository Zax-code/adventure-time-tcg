import type { ReactNode } from "react";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

export function WordleActiveRow({
  children,
  shakeAnim,
}: {
  children: ReactNode;
  shakeAnim: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}
