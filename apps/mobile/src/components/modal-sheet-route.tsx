import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MIN_TOP_GAP = 56;
const TOP_PADDING = 16;

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
  const translateY = useRef(new Animated.Value(openHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const [dragEnabled, setDragEnabled] = useState(true);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
        speed: 18,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, translateY]);

  const resetToOpen = () => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  };

  const closeAnimated = () => {
    if (closingRef.current) {
      return;
    }

    closingRef.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: openHeight,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          dragEnabled &&
          gestureState.dy > 8 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 140 || gestureState.vy > 1.1) {
            closeAnimated();
            return;
          }

          resetToOpen();
        },
        onPanResponderTerminate: () => {
          resetToOpen();
        },
      }),
    [dragEnabled, openHeight, translateY],
  );

  return (
    <View className="flex-1 justify-end" pointerEvents="box-none">
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          opacity: backdropOpacity,
        }}
      >
        <Pressable
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={closeAnimated}
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
            transform: [{ translateY }],
          },
          sheetStyle,
        ]}
      >
        <View
          {...panResponder.panHandlers}
          className="items-center pb-2 pt-3"
          style={{ backgroundColor: sheetBackgroundColor }}
        >
          <View
            className="h-1.5 w-10 rounded-full"
            style={{ backgroundColor: handleColor }}
          />
        </View>

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
