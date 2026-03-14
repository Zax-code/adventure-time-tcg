import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useSessionStore } from "../../src/stores/session-store";

export default function SettingsScreen() {
  const router = useRouter();
  const user = useSessionStore((state) => state.user);
  const clearSession = useSessionStore((state) => state.clearSession);

  return (
    <View className="flex-1 gap-4 bg-parchment p-6">
      <Text className="text-3xl font-bold text-amber-900">Settings</Text>
      <Text className="text-stone-700">
        Preferred steps source: {user?.preferredStepSource ?? "device_health"}
      </Text>
      <Text className="text-stone-700">Fitbit connection: optional, not yet wired</Text>
      {user?.isAdmin ? (
        <Text className="text-stone-700">Admin tools will live behind a hidden route group.</Text>
      ) : null}
      <Pressable
        className="mt-4 items-center rounded-2xl bg-stone-900 py-4"
        onPress={() => void clearSession().then(() => router.replace("/login"))}
      >
        <Text className="font-bold text-white">Log out</Text>
      </Pressable>
    </View>
  );
}
