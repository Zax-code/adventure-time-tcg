import { useEffect, useRef, type ReactNode } from "react";
import { Pressable, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MIN_TOP_GAP = 56;
const TOP_PADDING = 16;
const CLOSE_DISTANCE = 140;
const CLOSE_VELOCITY = 900;
const OPEN_BACKDROP_DURATION = 220;
const CLOSE_BACKDROP_DURATION = 180;
const CLOSE_SHEET_DURATION = 280;
const OPEN_SPRING_CONFIG = {
  damping: 24,
  mass: 1,
  overshootClamping: true,
  stiffness: 180,
};
const RESET_SPRING_CONFIG = {
  damping: 26,
  mass: 1,
  overshootClamping: true,
  stiffness: 220,
};

export function ModalSheetRoute({
  children,
  onClose,
  sheetBackgroundColor,
  handleColor,
  sheetStyle,
}: {
  children: ReactNode;
  onClose: () => void;
  sheetBackgroundColor: string;
  handleColor: string;
  sheetStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const topGap = Math.max(insets.top + TOP_PADDING, MIN_TOP_GAP);
  const openHeight = Math.max(0, height - topGap);
  const hasAnimatedInRef = useRef(false);
  const translateY = useSharedValue(openHeight);
  const backdropOpacity = useSharedValue(0);
  const maxTranslateY = useSharedValue(openHeight);
  const isClosing = useSharedValue(0);

  const animateOpen = (nextOpenHeight: number, isInitialMount: boolean) => {
    "worklet";

    maxTranslateY.value = nextOpenHeight;

    if (isInitialMount) {
      isClosing.value = 0;
      cancelAnimation(translateY);
      cancelAnimation(backdropOpacity);
      translateY.value = nextOpenHeight;
      backdropOpacity.value = 0;
      translateY.value = withSpring(0, OPEN_SPRING_CONFIG);
      backdropOpacity.value = withTiming(1, {
        duration: OPEN_BACKDROP_DURATION,
        easing: Easing.out(Easing.quad),
      });
      return;
    }

    if (!isClosing.value) {
      translateY.value = Math.min(translateY.value, nextOpenHeight);
    }
  };

  const animateReset = () => {
    "worklet";

    if (isClosing.value) {
      return;
    }

    cancelAnimation(translateY);
    translateY.value = withSpring(0, RESET_SPRING_CONFIG);
  };

  const animateClose = () => {
    "worklet";

    if (isClosing.value) {
      return;
    }

    isClosing.value = 1;
    cancelAnimation(translateY);
    cancelAnimation(backdropOpacity);
    backdropOpacity.value = withTiming(0, {
      duration: CLOSE_BACKDROP_DURATION,
      easing: Easing.inOut(Easing.quad),
    });
    translateY.value = withTiming(maxTranslateY.value, {
      duration: CLOSE_SHEET_DURATION,
      easing: Easing.out(Easing.cubic),
    }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  };

  useEffect(() => {
    const isInitialMount = !hasAnimatedInRef.current;
    hasAnimatedInRef.current = true;
    runOnUI(animateOpen)(openHeight, isInitialMount);
  }, [openHeight]);

  const panGesture = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-12, 12])
    .onUpdate((event) => {
      if (isClosing.value) {
        return;
      }

      translateY.value = Math.min(
        maxTranslateY.value,
        Math.max(0, event.translationY),
      );
    })
    .onEnd((event) => {
      if (
        event.translationY > CLOSE_DISTANCE ||
        event.velocityY > CLOSE_VELOCITY
      ) {
        animateClose();
        return;
      }

      animateReset();
    })
    .onFinalize(() => {
      if (!isClosing.value && translateY.value > 0) {
        animateReset();
      }
    });

  const handleBackdropPress = () => {
    runOnUI(animateClose)();
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View className="flex-1 justify-end" pointerEvents="box-none">
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          },
          backdropStyle,
        ]}
      >
        <Pressable
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={handleBackdropPress}
        />
      </Animated.View>

      <Animated.View
        style={[
          {
            height: openHeight,
            overflow: "hidden",
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            backgroundColor: sheetBackgroundColor,
          },
          sheetAnimatedStyle,
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={panGesture}>
          <View
            className="items-center pb-2 pt-3"
            style={{ backgroundColor: sheetBackgroundColor }}
          >
            <View
              className="h-1.5 w-10 rounded-full"
              style={{ backgroundColor: handleColor }}
            />
          </View>
        </GestureDetector>

        <View
          className="flex-1"
          onStartShouldSetResponderCapture={() => false}
          onMoveShouldSetResponderCapture={() => false}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}
