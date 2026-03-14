import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSessionStore } from "../../src/stores/session-store";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function tabIcon(active: IoniconName, inactive: IoniconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={22} color={color} />
  );
}

export default function TabLayout() {
  const hydrated = useSessionStore((state) => state.hydrated);
  const user = useSessionStore((state) => state.user);

  if (!hydrated) {
    return null;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#EC4899",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          backgroundColor: "#FDF2F8",
          borderTopColor: "#F9A8D4",
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: "Nunito_600SemiBold",
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: tabIcon("home", "home-outline") }}
      />
      <Tabs.Screen
        name="packs"
        options={{ title: "Packs", tabBarIcon: tabIcon("albums", "albums-outline") }}
      />
      <Tabs.Screen
        name="quests"
        options={{ title: "Quests", tabBarIcon: tabIcon("trophy", "trophy-outline") }}
      />
      <Tabs.Screen
        name="pvp"
        options={{ title: "PvP", tabBarIcon: tabIcon("flash", "flash-outline") }}
      />
      <Tabs.Screen
        name="gifts"
        options={{ title: "Gifts", tabBarIcon: tabIcon("gift", "gift-outline") }}
      />
      <Tabs.Screen
        name="collection"
        options={{ title: "Collection", tabBarIcon: tabIcon("layers", "layers-outline") }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: tabIcon("settings", "settings-outline") }}
      />
    </Tabs>
  );
}
