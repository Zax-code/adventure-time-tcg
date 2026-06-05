import { useQuery } from "@tanstack/react-query";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiClient } from "../lib/api";
import { useTranslation } from "../i18n";
import { useKeyboardVisibility } from "./keyboard-screen-view";
import { useThemeStore } from "../stores/theme-store";
import { BOTTOM_TAB_BAR_OVERLAY_HEIGHT } from "../theme/layout";
import { THEME_COLORS } from "../theme/themes";
import {
  CardsIcon,
  GiftHeartIcon,
  HomeIcon,
  PackIcon,
  QuestIcon,
  SwordsIcon,
} from "./icons";

type VisibleTabName =
  | "index"
  | "packs"
  | "pvp"
  | "quests"
  | "collection"
  | "gifts";

const TAB_ORDER: VisibleTabName[] = [
  "index",
  "packs",
  "pvp",
  "quests",
  "collection",
  "gifts",
];

export function BottomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const { bottom } = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisibility();
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const [barWidth, setBarWidth] = useState(0);
  const selectorOffset = useSharedValue(0);
  const giftsQuery = useQuery({
    queryKey: ["gifts"],
    queryFn: () => apiClient.gifts(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const tabs = TAB_ORDER.map((name) => {
    const routeIndex = state.routes.findIndex((route) => route.name === name);
    if (routeIndex === -1) {
      return null;
    }

    const route = state.routes[routeIndex];
    const focused = state.index === routeIndex;
    const color = focused ? tc.primaryText : tc.primary;
    const label =
      name === "index"
        ? t("nav.home")
        : name === "packs"
          ? t("nav.pack")
        : name === "pvp"
          ? t("nav.pvp")
          : name === "quests"
            ? t("nav.quests")
            : name === "collection"
              ? t("nav.collection")
              : t("nav.gifts");

    const badge =
      name === "gifts" && (giftsQuery.data?.pendingCount ?? 0) > 0
        ? (giftsQuery.data?.pendingCount ?? 0)
        : undefined;

    return { route, routeIndex, focused, color, label, badge };
  }).filter((tab): tab is NonNullable<typeof tab> => tab !== null);

  const activeTabIndex = Math.max(
    tabs.findIndex((tab) => tab.focused),
    0,
  );
  const selectorInset = 6;
  const selectorWidth =
    barWidth > selectorInset * 2
      ? (barWidth - selectorInset * 2) / tabs.length
      : 0;
  const selectorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: selectorOffset.value }],
  }));

  useEffect(() => {
    if (!selectorWidth) {
      return;
    }

    selectorOffset.value = withSpring(selectorWidth * activeTabIndex, {
      damping: 20,
      mass: 0.9,
      stiffness: 240,
    });
  }, [activeTabIndex, selectorOffset, selectorWidth]);

  if (keyboardVisible) {
    return null;
  }

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        minHeight: BOTTOM_TAB_BAR_OVERLAY_HEIGHT + bottom,
        backgroundColor: "transparent",
        shadowColor: tc.primaryStrong,
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
        elevation: 14,
      }}
    >
      <View
        className="px-1"
        style={{ paddingBottom: Math.max(bottom, 6) }}
      >
        <View
          className="rounded-[30px] border"
          style={{
            borderColor: withAlpha(tc.primaryBorder, "73"),
            backgroundColor: withAlpha(tc.surface, "F2"),
          }}
        >
          <View
            className="relative p-[6px]"
            onLayout={(event) => {
              setBarWidth(event.nativeEvent.layout.width);
            }}
          >
            {selectorWidth ? (
              <Animated.View
                pointerEvents="none"
                className="absolute rounded-[22px]"
                style={[
                  {
                    top: selectorInset,
                    bottom: selectorInset,
                    left: selectorInset,
                    width: selectorWidth,
                    backgroundColor: withAlpha(tc.primaryTint, "E8"),
                    borderWidth: 1,
                    borderColor: withAlpha(tc.primaryBorder, "4D"),
                  },
                  selectorStyle,
                ]}
              />
            ) : null}
            <View className="flex-row items-center">
              {tabs.map((tab) => {
                const descriptor = descriptors[tab.route.key];

                const onPress = () => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: tab.route.key,
                    canPreventDefault: true,
                  });

                  if (!tab.focused && !event.defaultPrevented) {
                    navigation.navigate(tab.route.name, tab.route.params);
                  }
                };

                const onLongPress = () => {
                  navigation.emit({
                    type: "tabLongPress",
                    target: tab.route.key,
                  });
                };

                return (
                  <Pressable
                    key={tab.route.key}
                    accessibilityRole="button"
                    accessibilityState={tab.focused ? { selected: true } : {}}
                    accessibilityLabel={
                      descriptor.options.tabBarAccessibilityLabel
                    }
                    testID={descriptor.options.tabBarButtonTestID}
                    onPress={onPress}
                    onLongPress={onLongPress}
                    className="flex-1 items-center justify-center gap-1 rounded-[22px] px-0 py-2"
                    style={{ minWidth: 0 }}
                  >
                    <View className="relative">
                      <TabIcon
                        routeName={tab.route.name as VisibleTabName}
                        color={tab.color}
                      />
                      {tab.badge ? (
                        <View
                          className="absolute size-4 items-center justify-center rounded bg-dangerDark"
                          style={{ top: -8, right: -8 }}
                        >
                          <Text className="font-nunito-bold text-[9px] text-white">
                            {tab.badge > 9 ? "9+" : tab.badge}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      className={`text-center text-[9px] ${tab.focused ? "font-nunito-bold text-primaryText" : "font-nunito-semibold text-primary"}`}
                      numberOfLines={1}
                      style={{ flexShrink: 1 }}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function withAlpha(hex: string, alpha: string) {
  if (hex.startsWith("#") && hex.length === 7) {
    return `${hex}${alpha}`;
  }

  return hex;
}

function TabIcon({
  routeName,
  color,
}: {
  routeName: VisibleTabName;
  color: string;
}) {
  switch (routeName) {
    case "index":
      return <HomeIcon size={24} color={color} />;
    case "packs":
      return <PackIcon size={24} color={color} />;
    case "pvp":
      return <SwordsIcon size={24} color={color} />;
    case "quests":
      return <QuestIcon size={24} color={color} />;
    case "collection":
      return <CardsIcon size={24} color={color} />;
    case "gifts":
      return <GiftHeartIcon size={24} color={color} />;
  }
}
