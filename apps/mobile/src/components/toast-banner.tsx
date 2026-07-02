import { Text, View } from "react-native";
import { Animated } from "../lib/native-animated";
import type { AnimatedValue } from "../lib/native-animated";

type ToastType = "success" | "error";

export function ToastBanner({
  message,
  type,
  translateY,
  successColor,
  errorColor,
  topOffset = 16,
}: {
  message: string;
  type: ToastType;
  translateY: AnimatedValue;
  successColor: string;
  errorColor: string;
  topOffset?: number;
}) {
  return (
    <Animated.View
      style={{
        position: "absolute",
        top: topOffset,
        left: 16,
        right: 16,
        zIndex: 50,
        transform: [{ translateY }],
      }}
    >
      <View
        style={{
          backgroundColor: type === "success" ? successColor : errorColor,
        }}
        className="rounded-xl p-4 shadow-lg"
      >
        <Text className="font-nunito-bold text-white">{message}</Text>
      </View>
    </Animated.View>
  );
}
