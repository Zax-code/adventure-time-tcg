import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View, Pressable } from "react-native";
import { Image } from "expo-image";

import { API_BASE_URL, apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function CollectionScreen() {
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((state) => state.accessToken);
  const collectionQuery = useQuery({
    queryKey: ["collection"],
    queryFn: () => apiClient.collection(),
  });
  const recycleMutation = useMutation({
    mutationFn: (cardId: string) => apiClient.recycleCard(cardId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
    },
  });
  const craftMutation = useMutation({
    mutationFn: (cardId: string) => apiClient.craftCard(cardId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
    },
  });

  if (collectionQuery.isLoading) {
    return <View className="flex-1 bg-parchment p-6"><Text>Loading collection...</Text></View>;
  }

  if (collectionQuery.isError) {
    return <View className="flex-1 bg-parchment p-6"><Text>{collectionQuery.error.message}</Text></View>;
  }

  const collection = collectionQuery.data;
  if (!collection) {
    return <View className="flex-1 bg-parchment p-6"><Text>Collection is unavailable.</Text></View>;
  }

  return (
    <ScrollView className="flex-1 bg-parchment" contentContainerClassName="gap-4 p-5">
      <Text className="text-3xl font-bold text-amber-900">Collection</Text>
      <Text className="text-base text-orange-800">Dust: {collection.dust}</Text>
      {collection.cards.map((entry) => (
        <View key={entry.id} className="flex-row gap-4 rounded-3xl bg-white p-3">
          {entry.card.imageAssetId ? (
            <Image
              source={{
                uri: `${API_BASE_URL}/media/card/${entry.card.imageAssetId}`,
                headers: {
                  ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
              }}
              placeholder={{ blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH" }}
              className="h-32 w-24 rounded-2xl bg-orange-200"
              contentFit="cover"
            />
          ) : (
            <View className="h-32 w-24 rounded-2xl bg-orange-200 opacity-60" />
          )}
          <View className="flex-1 gap-1">
            <Text className="text-lg font-bold text-stone-900">{entry.card.name}</Text>
            <Text>{entry.card.character}</Text>
            <Text>Qty: {entry.quantity}</Text>
            <Text>{entry.card.rarity.name}</Text>
            <View className="mt-2 flex-row gap-2">
              <Pressable className="rounded-xl bg-stone-900 px-3 py-2" onPress={() => void recycleMutation.mutateAsync(entry.cardId)}>
                <Text className="text-xs font-semibold text-white">Recycle</Text>
              </Pressable>
              <Pressable className="rounded-xl bg-orange-600 px-3 py-2" onPress={() => void craftMutation.mutateAsync(entry.cardId)}>
                <Text className="text-xs font-semibold text-white">Craft</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
