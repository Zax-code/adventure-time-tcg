import { Text, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

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
  translateY: SharedValue<number>;
  successColor: string;
  errorColor: string;
  topOffset?: number;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: topOffset,
          left: 16,
          right: 16,
          zIndex: 50,
        },
        animatedStyle,
      ]}
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
