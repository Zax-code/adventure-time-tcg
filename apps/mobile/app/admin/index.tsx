import { Text, View } from "react-native";

export default function AdminScreen() {
  return (
    <View className="flex-1 gap-4 bg-parchment p-6">
      <Text className="text-3xl font-bold text-amber-900">Admin</Text>
      <Text className="text-stone-700">
        This route group is intentionally hidden from normal navigation.
      </Text>
      <Text className="text-stone-700">
        Future in-app admin tooling will manage cards, media, access, and balance operations.
      </Text>
    </View>
  );
}
