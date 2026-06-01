import { useEffect, useMemo, useRef, type ReactNode } from "react";
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
const CLOSE_DISTANCE = 140;
const CLOSE_VELOCITY = 1.1;

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
  const translateY = useRef(new Animated.Value(height)).current;
  const closingRef = useRef(false);
  const topGap = Math.max(insets.top + TOP_PADDING, MIN_TOP_GAP);

  useEffect(() => {
    closingRef.current = false;
    translateY.setValue(height);

    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  }, [height, translateY]);

  const closeSheet = () => {
    if (closingRef.current) {
      return;
    }

    closingRef.current = true;

    Animated.timing(translateY, {
      toValue: height,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onClose();
      } else {
        closingRef.current = false;
      }
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 8 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (
            gestureState.dy > CLOSE_DISTANCE ||
            gestureState.vy > CLOSE_VELOCITY
          ) {
            closeSheet();
            return;
          }

          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
      }),
    [translateY, height],
  );

  return (
    <View className="flex-1 justify-end bg-black/40">
      <Pressable className="absolute inset-0" onPress={closeSheet} />
      <Animated.View
        className="overflow-hidden rounded-t-[32px]"
        style={[
          {
            backgroundColor: sheetBackgroundColor,
            maxHeight: height - topGap,
            minHeight: Math.min(height - topGap, height * 0.68),
            transform: [{ translateY }],
          },
          sheetStyle,
        ]}
      >
        <View
          {...panResponder.panHandlers}
          className="items-center pb-1 pt-2"
          style={{ backgroundColor: sheetBackgroundColor }}
        >
          <View
            className="h-1.5 w-10 rounded-full"
            style={{ backgroundColor: handleColor }}
          />
        </View>
        {children}
      </Animated.View>
    </View>
  );
}
