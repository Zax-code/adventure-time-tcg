import type { BottomTabBarProps } from "expo-router/js-tabs";
import { StyleSheet, View, type ViewStyle } from "react-native";

import House from "lucide-react-native/icons/house";
import Layers from "lucide-react-native/icons/layers";
import Package from "lucide-react-native/icons/package";
import ScrollText from "lucide-react-native/icons/scroll-text";
import Swords from "lucide-react-native/icons/swords";
import Trophy from "lucide-react-native/icons/trophy";
import type { LucideIcon } from "lucide-react-native";

import { useTranslation } from "../i18n";
import { BottomTabBarFrame, TabBarItem } from "./bottom-tab-bar-frame";

type VisibleTabName =
  | "index"
  | "packs"
  | "pvp"
  | "quests"
  | "collection"
  | "rankings";

// Order matches the web dock: Home, Packs, PvP, Quests, Collection, Rankings.
const TAB_CONFIG: Record<VisibleTabName, { labelKey: string; icon: LucideIcon }> = {
  index: { labelKey: "nav.home", icon: House },
  packs: { labelKey: "nav.pack", icon: Package },
  pvp: { labelKey: "nav.pvp", icon: Swords },
  quests: { labelKey: "nav.quests", icon: ScrollText },
  collection: { labelKey: "nav.collection", icon: Layers },
  rankings: { labelKey: "nav.rankings", icon: Trophy },
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
  const tabs = TAB_ORDER.map((name) => {
    const routeIndex = state.routes.findIndex((route) => route.name === name);
    if (routeIndex === -1) {
      return null;
    }

    const route = state.routes[routeIndex];
    const focused = state.index === routeIndex;
    const config = TAB_CONFIG[name];

    return { route, focused, icon: config.icon, label: t(config.labelKey) };
  }).filter((tab): tab is NonNullable<typeof tab> => tab !== null);

  // -1 on hidden tabs such as Gifts: no item is highlighted.
  const activeTabIndex = tabs.findIndex((tab) => tab.focused);
  const activeDescriptor = descriptors[state.routes[state.index]?.key];
  const activeTabBarStyle = StyleSheet.flatten(
    activeDescriptor?.options.tabBarStyle,
  ) as ViewStyle | undefined;

  if (activeTabBarStyle?.display === "none") {
    return null;
  }

  return (
    <BottomTabBarFrame activeIndex={activeTabIndex} itemCount={tabs.length}>
      <View className="flex-1 flex-row items-stretch">
        {tabs.map((tab) => {
          const descriptor = descriptors[tab.route.key];

          return (
            <TabBarItem
              key={tab.route.key}
              icon={tab.icon}
              label={tab.label}
              focused={tab.focused}
              accessibilityLabel={descriptor.options.tabBarAccessibilityLabel}
              testID={
                descriptor.options.tabBarButtonTestID ??
                TAB_TEST_IDS[tab.route.name as VisibleTabName]
              }
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: tab.route.key,
                  canPreventDefault: true,
                });

                if (!tab.focused && !event.defaultPrevented) {
                  navigation.navigate(tab.route.name, tab.route.params);
                }
              }}
              onLongPress={() => {
                navigation.emit({
                  type: "tabLongPress",
                  target: tab.route.key,
                });
              }}
            />
          );
        })}
      </View>
    </BottomTabBarFrame>
  );
}
