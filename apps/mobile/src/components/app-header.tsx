import { View, Text, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { CoinIcon } from "./icons";
import { useSessionStore } from "../stores/session-store";

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const coins = useSessionStore((state) => state.user?.coins ?? 0);

  return (
    <LinearGradient
      colors={["#fce7f3", "#fdf2f8"]}
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-row items-center justify-between px-4 py-2">
        <View className="flex-row items-center gap-1.5 rounded-full bg-[#FDE047] px-3 py-1.5">
          <CoinIcon size={16} />
          <Text className="font-nunito-bold text-sm text-gray-800">{coins}</Text>
        </View>
        <Pressable
          onPress={() => router.push("/(tabs)/settings")}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={22} color="#9CA3AF" />
        </Pressable>
      </View>
    </LinearGradient>
  );
}
