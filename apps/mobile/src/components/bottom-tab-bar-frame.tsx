import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeStore } from "../stores/theme-store";
import { BOTTOM_TAB_BAR_OVERLAY_HEIGHT } from "../theme/layout";
import { THEME_COLORS } from "../theme/themes";
import { useKeyboardVisibility } from "./keyboard-screen-view";

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
  const selectorInset = 6;
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
        className="px-1"
        importantForAccessibility="yes"
        style={{ paddingBottom: Math.max(bottom, 6) }}
      >
        <View
          accessibilityElementsHidden={false}
          collapsable={false}
          className="rounded-[30px] border"
          importantForAccessibility="yes"
          style={{
            borderColor: withAlpha(tc.primaryBorder, "73"),
            backgroundColor: withAlpha(tc.surface, "F2"),
            boxShadow: `0px -4px 16px ${withAlpha(tc.primaryStrong, "2E")}`,
          }}
        >
          <View
            accessibilityElementsHidden={false}
            collapsable={false}
            className="relative p-[6px]"
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
                    borderRadius: 22,
                    backgroundColor: withAlpha(tc.primaryTint, "E8"),
                    borderWidth: 1,
                    borderColor: withAlpha(tc.primaryBorder, "4D"),
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

function withAlpha(color: string, alpha: string) {
  const opacity = Number.parseInt(alpha, 16) / 255;

  if (color.startsWith("#")) {
    if (color.length === 7) {
      return `${color}${alpha}`;
    }

    if (color.length === 9) {
      return `${color.slice(0, 7)}${alpha}`;
    }
  }

  const match = color.match(/^rgba?\(([^)]+)\)$/);
  if (!match) {
    return color;
  }

  const [r, g, b] = match[1]
    .split(",")
    .slice(0, 3)
    .map((part) => Number.parseFloat(part.trim()));

  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return color;
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
