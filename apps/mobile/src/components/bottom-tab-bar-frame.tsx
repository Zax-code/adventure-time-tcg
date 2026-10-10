import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RADIUS, SHADOW } from "@adventure-time/theme";

import { useThemeStore } from "../stores/theme-store";
import { BOTTOM_TAB_BAR_OVERLAY_HEIGHT } from "../theme/layout";
import { THEME_COLORS } from "../theme/themes";
import { useKeyboardVisibility } from "./keyboard-screen-view";
import { type IconSlot, SlotIcon } from "./ui/tokens";

// Floating dock shared by the player and admin tab bars: 68 high, surface
// fill, pill radius, primaryTint selector behind the active item.
const DOCK_PADDING = 6;
const DOCK_SHADOW_OFFSET_Y = 8;
const DOCK_SHADOW_BLUR = 24;

export type ThemeColorKey = keyof (typeof THEME_COLORS)["candy"];

type BottomTabBarFrameProps = {
  activeIndex: number;
  children: ReactNode;
  itemCount: number;
};

export function BottomTabBarFrame({
  activeIndex,
  children,
  itemCount,
}: BottomTabBarFrameProps) {
  const { bottom } = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisibility();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const [barWidth, setBarWidth] = useState(0);
  const selectorOffset = useSharedValue(0);
  const selectorInset = DOCK_PADDING;
  const selectorWidth =
    itemCount > 0 && barWidth > selectorInset * 2
      ? (barWidth - selectorInset * 2) / itemCount
      : 0;
  const selectorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: selectorOffset.value }],
  }));

  useEffect(() => {
    if (!selectorWidth) {
      return;
    }

    selectorOffset.value = withSpring(selectorWidth * activeIndex, {
      damping: 20,
      mass: 0.9,
      stiffness: 240,
    });
  }, [activeIndex, selectorOffset, selectorWidth]);

  if (keyboardVisible) {
    return null;
  }

  return (
    <View
      accessibilityElementsHidden={false}
      collapsable={false}
      importantForAccessibility="yes"
      pointerEvents="box-none"
      style={[
        styles.root,
        {
          minHeight: BOTTOM_TAB_BAR_OVERLAY_HEIGHT + bottom,
        },
      ]}
    >
      <View
        accessibilityElementsHidden={false}
        collapsable={false}
        className="px-ds-3"
        importantForAccessibility="yes"
        style={{ paddingBottom: Math.max(bottom, DOCK_PADDING) }}
      >
        <View
          accessibilityElementsHidden={false}
          collapsable={false}
          className="h-tab-bar rounded-ds-pill border border-primaryBorder bg-surface"
          importantForAccessibility="yes"
          style={{
            boxShadow: `0px ${DOCK_SHADOW_OFFSET_Y}px ${DOCK_SHADOW_BLUR}px ${SHADOW[themeName].float.color}`,
          }}
        >
          <View
            accessibilityElementsHidden={false}
            collapsable={false}
            className="relative flex-1 p-[6px]"
            importantForAccessibility="yes"
            onLayout={(event) => {
              const nextWidth = Math.round(event.nativeEvent.layout.width);
              setBarWidth((currentWidth) =>
                currentWidth === nextWidth ? currentWidth : nextWidth,
              );
            }}
          >
            {selectorWidth ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: "absolute",
                    top: selectorInset,
                    bottom: selectorInset,
                    left: selectorInset,
                    width: selectorWidth,
                    borderRadius: RADIUS.pill,
                    backgroundColor: tc.primaryTint,
                  },
                  selectorStyle,
                ]}
              />
            ) : null}
            {children}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    backgroundColor: "transparent",
  },
});

type TabBarItemProps = {
  icon: IconSlot;
  label: string;
  focused: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
};

export function TabBarItem({
  icon,
  label,
  focused,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
}: TabBarItemProps) {
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const color = focused ? tc.primaryText : tc.fgMuted;

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      className="h-full min-w-0 flex-1 items-center justify-center gap-[3px] rounded-ds-pill"
    >
      <SlotIcon icon={icon} color={color} size={22} />
      <Text
        className={`shrink text-center font-nunito-bold text-ds-overline ${
          focused ? "text-primaryText" : "text-fgMuted"
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
