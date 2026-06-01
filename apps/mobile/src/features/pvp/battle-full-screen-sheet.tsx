import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { XIcon } from "../../components/icons";

interface BattleFullScreenSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  scrollable?: boolean;
}

export function BattleFullScreenSheet({
  visible,
  title,
  onClose,
  children,
  footer,
  scrollable = true,
}: BattleFullScreenSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(900)).current;
  const topGap = Math.max(insets.top + 16, 56);

  useEffect(() => {
    if (!visible) {
      translateY.setValue(900);
      return;
    }

    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  }, [translateY, visible]);

  const closeSheet = () => {
    Animated.timing(translateY, {
      toValue: 900,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onClose();
      }
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_, gestureState) => {
          translateY.setValue(Math.max(0, gestureState.dy));
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 120 || gestureState.vy > 0.9) {
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
    [translateY],
  );

  if (!visible) {
    return null;
  }

  const content = scrollable ? (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View className="flex-1">{children}</View>
  );

  return (
    <View className="absolute inset-0 z-[90] bg-black/65">
      <Pressable className="absolute inset-0" onPress={closeSheet} />
      <Animated.View
        className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[30px] bg-bg"
        style={{
          maxHeight: height - topGap,
          minHeight: Math.min(height - topGap, height * 0.68),
          transform: [{ translateY }],
        }}
      >
        <View {...panResponder.panHandlers}>
          <View className="h-1 w-9 self-center rounded-full bg-muted" style={{ marginBottom: 8, marginTop: 12 }} />

          <View className="flex-row items-center border-b border-primaryTint px-5 pb-4">
            <View className="flex-1 items-center">
              <Text className="font-nunito-extrabold text-2xl text-fg">{title}</Text>
            </View>
            <Pressable onPress={closeSheet} className="absolute right-5 top-0 rounded-full bg-surfaceMuted p-2">
              <XIcon size={18} color="#475569" />
            </Pressable>
          </View>
        </View>

        {content}

        {footer ? (
          <View
            className="border-t border-primaryTint bg-white/95 px-4 pt-4"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            {footer}
          </View>
        ) : (
          <View style={{ height: Math.max(insets.bottom, 12) }} />
        )}
      </Animated.View>
    </View>
  );
}
