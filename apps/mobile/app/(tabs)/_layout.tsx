import { View } from "react-native";
import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSessionStore } from "../../src/stores/session-store";
import { AppHeader } from "../../src/components/app-header";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function tabIcon(active: IoniconName, inactive: IoniconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={22} color={color} />
  );
}

export default function TabLayout() {
  const hydrated = useSessionStore((state) => state.hydrated);
  const user = useSessionStore((state) => state.user);
  const insets = useSafeAreaInsets();

  if (!hydrated) {
    return null;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <AppHeader />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#EC4899",
          tabBarInactiveTintColor: "#9CA3AF",
          tabBarStyle: {
            backgroundColor: "#FDF2F8",
            borderTopColor: "#F9A8D4",
            borderTopWidth: 1,
            paddingBottom: insets.bottom,
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
    </View>
  );
}
