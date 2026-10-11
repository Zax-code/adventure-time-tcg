import { useMemo, useRef, useState, type ReactNode } from "react";
import { BottomSheet } from "@swmansion/react-native-bottom-sheet";
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RADIUS } from "@adventure-time/theme";

import { SheetHeader } from "./ui/sheet-header";
import { getBackdropColor, useThemeName } from "./ui/tokens";

const MIN_TOP_GAP = 56;
const TOP_PADDING = 16;

export function ModalSheetRoute({
  children,
  onClose,
  sheetBackgroundColor,
  sheetStyle,
  title,
  subtitle,
}: {
  children: ReactNode;
  onClose: () => void;
  sheetBackgroundColor: string;
  sheetStyle?: StyleProp<ViewStyle>;
  title?: string;
  subtitle?: string;
}) {
  const insets = useSafeAreaInsets();
  const themeName = useThemeName();
  const { height } = useWindowDimensions();
  const topGap = Math.max(insets.top + TOP_PADDING, MIN_TOP_GAP);
  const sheetHeight = Math.max(0, height - topGap);
  const [index, setIndex] = useState(1);
  const hasRequestedCloseRef = useRef(false);
  const sheetPosition = useSharedValue(sheetHeight);
  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      sheetPosition.value,
      [0, Math.max(sheetHeight, 1)],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));
  const surface = useMemo(
    () => (
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: sheetBackgroundColor,
            borderTopLeftRadius: RADIUS.xl,
            borderTopRightRadius: RADIUS.xl,
          },
        ]}
      />
    ),
    [sheetBackgroundColor],
  );

  const requestClose = () => {
    if (hasRequestedCloseRef.current) {
      return;
    }

    hasRequestedCloseRef.current = true;
    onClose();
  };

  return (
    <View className="flex-1" pointerEvents="box-none">
      <Animated.View
        className="absolute inset-0"
        style={[
          { backgroundColor: getBackdropColor(themeName) },
          backdropAnimatedStyle,
        ]}
      >
        <Pressable className="flex-1" onPress={() => setIndex(0)} />
      </Animated.View>
      <BottomSheet
        index={index}
        onIndexChange={setIndex}
        onSettle={(nextIndex) => {
          if (nextIndex === 0) {
            requestClose();
          }
        }}
        detents={[0, sheetHeight]}
        onPositionChange={(position) => {
          sheetPosition.value = position;
          if (index === 0 && position <= 0.5) {
            requestClose();
          }
        }}
        surface={surface}
      >
        <View
          style={[
            {
              height: sheetHeight,
              overflow: "hidden",
              borderTopLeftRadius: RADIUS.xl,
              borderTopRightRadius: RADIUS.xl,
              backgroundColor: sheetBackgroundColor,
            },
            sheetStyle,
          ]}
        >
          <SheetHeader title={title} subtitle={subtitle} />

          <View className="flex-1">{children}</View>
        </View>
      </BottomSheet>
    </View>
  );
}
