import type { BottomTabBarProps } from "expo-router/js-tabs";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { useTranslation } from "../i18n";
import { useThemeStore } from "../stores/theme-store";
import { THEME_COLORS } from "../theme/themes";
import { BottomTabBarFrame, type ThemeColorKey } from "./bottom-tab-bar-frame";
import {
  CardsIcon,
  HomeIcon,
  PackIcon,
  QuestIcon,
  SwordsIcon,
  TrophyIcon,
} from "./icons";

type VisibleTabName =
  | "index"
  | "packs"
  | "pvp"
  | "quests"
  | "collection"
  | "rankings";

const TAB_CONFIG: Record<
  VisibleTabName,
  {
    labelKey: string;
    tintKey: ThemeColorKey;
  }
> = {
  index: { labelKey: "nav.home", tintKey: "primaryText" },
  packs: { labelKey: "nav.pack", tintKey: "secondaryText" },
  pvp: { labelKey: "nav.pvp", tintKey: "accentText" },
  quests: { labelKey: "nav.quests", tintKey: "infoText" },
  collection: { labelKey: "nav.collection", tintKey: "primaryText" },
  rankings: { labelKey: "nav.rankings", tintKey: "accentText" },
};

const TAB_ORDER: VisibleTabName[] = Object.keys(TAB_CONFIG) as VisibleTabName[];

const TAB_TEST_IDS: Record<VisibleTabName, string> = {
  index: "tab-home",
  packs: "tab-packs",
  pvp: "tab-pvp",
  quests: "tab-quests",
  collection: "tab-collection",
  rankings: "tab-rankings",
};

export function BottomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const tabs = TAB_ORDER.map((name) => {
    const routeIndex = state.routes.findIndex((route) => route.name === name);
    if (routeIndex === -1) {
      return null;
    }

    const route = state.routes[routeIndex];
    const focused = state.index === routeIndex;
    const config = TAB_CONFIG[name];
    const color = focused ? tc[config.tintKey] : tc.fgMuted;
    const label = t(config.labelKey);

    return { route, routeIndex, focused, color, label };
  }).filter((tab): tab is NonNullable<typeof tab> => tab !== null);

  const activeTabIndex = Math.max(
    tabs.findIndex((tab) => tab.focused),
    0,
  );
  const activeDescriptor = descriptors[state.routes[state.index]?.key];
  const activeTabBarStyle = StyleSheet.flatten(
    activeDescriptor?.options.tabBarStyle,
  ) as ViewStyle | undefined;

  if (activeTabBarStyle?.display === "none") {
    return null;
  }

  return (
    <BottomTabBarFrame activeIndex={activeTabIndex} itemCount={tabs.length}>
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
              accessible
              accessibilityRole="button"
              accessibilityState={tab.focused ? { selected: true } : {}}
              accessibilityLabel={
                descriptor.options.tabBarAccessibilityLabel ?? tab.label
              }
              testID={
                descriptor.options.tabBarButtonTestID ??
                TAB_TEST_IDS[tab.route.name as VisibleTabName]
              }
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
              </View>
              <Text
                className={`text-center text-[9px] ${
                  tab.focused ? "font-nunito-bold" : "font-nunito-semibold"
                }`}
                numberOfLines={1}
                style={{ color: tab.color, flexShrink: 1 }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BottomTabBarFrame>
  );
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
    case "rankings":
      return <TrophyIcon size={24} color={color} />;
  }
}
