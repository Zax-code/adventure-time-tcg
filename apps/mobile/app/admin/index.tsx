import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";

import { apiClient } from "../../src/lib/api";

export default function AdminScreen() {
  const cardsQuery = useQuery({ queryKey: ["admin-cards"], queryFn: () => apiClient.adminCards() });

  return (
    <ScrollView className="flex-1 bg-parchment" contentContainerClassName="gap-4 p-6">
      <Text className="text-3xl font-bold text-amber-900">Admin</Text>
      <Text className="text-stone-700">This route group is intentionally hidden from normal navigation.</Text>
      <View className="gap-3 rounded-3xl bg-white p-4">
        <Text className="text-lg font-bold text-stone-900">Card Catalog</Text>
        {cardsQuery.data?.cards.slice(0, 50).map((card) => (
          <View key={card.id} className="rounded-2xl bg-orange-50 p-3">
            <Text className="font-semibold text-stone-900">{card.name}</Text>
            <Text className="text-stone-700">{card.character} · {card.rarityName}</Text>
            <Text className="text-stone-700">Featured: {card.isFeatured ? "yes" : "no"} · Archived: {card.isArchived ? "yes" : "no"}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
