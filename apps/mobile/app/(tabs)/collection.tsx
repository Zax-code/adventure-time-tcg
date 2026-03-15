import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FlatList, Text, View } from "react-native";

import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { CardTile } from "../../src/components/card-tile";

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
    return <View className="flex-1 bg-bg p-6"><Text className="font-nunito text-fgMuted">Loading collection...</Text></View>;
  }

  if (collectionQuery.isError) {
    return <View className="flex-1 bg-bg p-6"><Text className="font-nunito text-red-600">{collectionQuery.error.message}</Text></View>;
  }

  const collection = collectionQuery.data;
  if (!collection) {
    return <View className="flex-1 bg-bg p-6"><Text className="font-nunito text-fgMuted">Collection is unavailable.</Text></View>;
  }

  return (
    <FlatList
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: 16 }}
      numColumns={2}
      columnWrapperStyle={{ justifyContent: 'space-evenly' }}
      data={collection.cards}
      keyExtractor={(entry) => entry.id}
      ListHeaderComponent={
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="font-nunito-extrabold text-2xl text-fg">Collection</Text>
          <View className="rounded-full bg-primaryTint px-3 py-1">
            <Text className="font-nunito-bold text-sm text-primaryText">{collection.dust} dust ✨</Text>
          </View>
        </View>
      }
      renderItem={({ item: entry }) => (
        <CardTile
          entry={entry}
          accessToken={accessToken}
          onRecycle={() => void recycleMutation.mutateAsync(entry.cardId)}
          onCraft={() => void craftMutation.mutateAsync(entry.cardId)}
        />
      )}
    />
  );
}
