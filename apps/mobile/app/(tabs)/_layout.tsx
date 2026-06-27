import { View } from "react-native";
import { Tabs, Redirect, Stack } from "expo-router";

import { useSessionStore } from "../../src/stores/session-store";
import { AppHeader } from "../../src/components/app-header";
import { BottomTabBar } from "../../src/components/bottom-tab-bar";
import { useTranslation } from "../../src/i18n";

export default function TabLayout() {
  const hydrated = useSessionStore((state) => state.hydrated);
  const user = useSessionStore((state) => state.user);
  const { t } = useTranslation();

  if (!hydrated) {
    return null;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ orientation: "portrait_up" }} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          sceneStyle: { backgroundColor: "transparent" },
          tabBarStyle: {
            position: "absolute",
            backgroundColor: "transparent",
            borderTopWidth: 0,
            elevation: 0,
          },
        }}
        tabBar={(props) => <BottomTabBar {...props} />}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("nav.home"),
            tabBarButtonTestID: "tab-home",
          }}
        />
        <Tabs.Screen
          name="packs"
          options={{
            title: t("nav.pack"),
            tabBarButtonTestID: "tab-packs",
          }}
        />
        <Tabs.Screen
          name="quests"
          options={{
            title: t("nav.quests"),
            tabBarButtonTestID: "tab-quests",
          }}
        />
        <Tabs.Screen
          name="pvp"
          options={{
            title: t("nav.pvp"),
            tabBarButtonTestID: "tab-pvp",
          }}
        />
        <Tabs.Screen
          name="gifts"
          options={{
            title: t("nav.gifts"),
            tabBarButtonTestID: "tab-gifts",
          }}
        />
        <Tabs.Screen
          name="collection"
          options={{
            title: t("nav.collection"),
            tabBarButtonTestID: "tab-collection",
          }}
        />
      </Tabs>
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
        }}
      >
        <AppHeader />
      </View>
    </View>
  );
}
