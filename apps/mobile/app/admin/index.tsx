import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, Pressable, Text, View } from "react-native";

import { apiClient } from "../../src/lib/api";

export default function AdminScreen() {
  const queryClient = useQueryClient();
  const cardsQuery = useQuery({ queryKey: ["admin-cards"], queryFn: () => apiClient.adminCards() });
  const updateCardMutation = useMutation({
    mutationFn: (input: { cardId: string; isFeatured?: boolean; isArchived?: boolean }) => apiClient.updateAdminCard(input.cardId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-cards"] });
    },
  });

  return (
    <ScrollView className="flex-1 bg-parchment" contentContainerClassName="gap-4 p-6">
      <Text className="text-3xl font-bold text-amber-900">Admin</Text>
      <Text className="text-stone-700">This route group is intentionally hidden from normal navigation.</Text>
      <View className="gap-3 rounded-3xl bg-white p-4">
        <Text className="text-lg font-bold text-stone-900">Card Catalog</Text>
        {cardsQuery.data?.cards.slice(0, 50).map((card) => (
          <View key={card.id} className="gap-2 rounded-2xl bg-orange-50 p-3">
            <Text className="font-semibold text-stone-900">{card.name}</Text>
            <Text className="text-stone-700">{card.character} · {card.rarityName}</Text>
            <Text className="text-stone-700">Featured: {card.isFeatured ? "yes" : "no"} · Archived: {card.isArchived ? "yes" : "no"}</Text>
            <View className="flex-row gap-2">
              <Pressable className="rounded-xl bg-orange-600 px-4 py-2" onPress={() => void updateCardMutation.mutateAsync({ cardId: card.id, isFeatured: !card.isFeatured })}>
                <Text className="font-semibold text-white">Toggle featured</Text>
              </Pressable>
              <Pressable className="rounded-xl bg-stone-900 px-4 py-2" onPress={() => void updateCardMutation.mutateAsync({ cardId: card.id, isArchived: !card.isArchived })}>
                <Text className="font-semibold text-white">Toggle archive</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
