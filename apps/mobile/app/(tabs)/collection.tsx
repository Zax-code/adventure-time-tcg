import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";

import { API_BASE_URL, apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";

export default function CollectionScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const collectionQuery = useQuery({
    queryKey: ["collection"],
    queryFn: () => apiClient.collection(),
  });

  if (collectionQuery.isLoading) {
    return <View className="flex-1 bg-parchment p-6"><Text>Loading collection...</Text></View>;
  }

  if (collectionQuery.isError) {
    return <View className="flex-1 bg-parchment p-6"><Text>{collectionQuery.error.message}</Text></View>;
  }

  return (
    <ScrollView className="flex-1 bg-parchment" contentContainerClassName="gap-4 p-5">
      <Text className="text-3xl font-bold text-amber-900">Collection</Text>
      <Text className="text-base text-orange-800">Dust: {collectionQuery.data.dust}</Text>
      {collectionQuery.data.cards.map((entry) => (
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
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
