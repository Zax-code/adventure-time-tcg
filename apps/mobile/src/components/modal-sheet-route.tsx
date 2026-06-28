import { useMemo, useRef, useState, type ReactNode } from "react";
import { BottomSheet } from "@swmansion/react-native-bottom-sheet";
import {
  Pressable,
  StyleSheet,
  Text,
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

const MIN_TOP_GAP = 56;
const TOP_PADDING = 16;

export function ModalSheetRoute({
  children,
  onClose,
  sheetBackgroundColor,
  handleColor,
  sheetStyle,
  title,
  subtitle,
}: {
  children: ReactNode;
  onClose: () => void;
  sheetBackgroundColor: string;
  handleColor: string;
  sheetStyle?: StyleProp<ViewStyle>;
  title?: string;
  subtitle?: string;
}) {
  const insets = useSafeAreaInsets();
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
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
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
          { backgroundColor: "rgba(0,0,0,0.4)" },
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
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              backgroundColor: sheetBackgroundColor,
            },
            sheetStyle,
          ]}
        >
          <View className="border-b border-primaryTint px-5 pb-4 pt-3">
            <View
              className="mx-auto h-1.5 w-10 rounded-full"
              style={{ backgroundColor: handleColor }}
            />
            {title ? (
              <Text
                className="mt-3 text-center font-nunito-extrabold text-2xl leading-8 text-fg"
                numberOfLines={2}
              >
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text
                className="mt-1 text-center font-nunito-semibold text-sm leading-5 text-fgMuted"
                numberOfLines={2}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          <View className="flex-1">{children}</View>
        </View>
      </BottomSheet>
    </View>
  );
}
