import { Animated, Text, View } from "react-native";

type ToastType = "success" | "error";

export function ToastBanner({
  message,
  type,
  translateY,
  successColor,
  errorColor,
}: {
  message: string;
  type: ToastType;
  translateY: Animated.Value;
  successColor: string;
  errorColor: string;
}) {
  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 16,
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
