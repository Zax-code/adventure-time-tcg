import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";

import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";

export default function PacksScreen() {
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((state) => state.accessToken);
  const refreshToken = useSessionStore((state) => state.refreshToken);
  const setSession = useSessionStore((state) => state.setSession);

  const packsQuery = useQuery({
    queryKey: ["packs"],
    queryFn: () => apiClient.packs(),
  });

  const openPackMutation = useMutation({
    mutationFn: (packId: string) => apiClient.openPack({ packId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
        queryClient.invalidateQueries({ queryKey: ["daily-claim"] }),
      ]);

      if (accessToken && refreshToken) {
        const me = await apiClient.me();
        await setSession({ user: me, accessToken, refreshToken });
      }
    },
  });

  if (packsQuery.isLoading) {
    return <View className="flex-1 bg-parchment p-6"><Text>Loading packs...</Text></View>;
  }

  if (packsQuery.isError || !packsQuery.data) {
    return <View className="flex-1 bg-parchment p-6"><Text>{packsQuery.error?.message ?? "Packs unavailable."}</Text></View>;
  }

  return (
    <ScrollView className="flex-1 bg-parchment" contentContainerClassName="gap-4 p-5">
      <Text className="text-3xl font-bold text-amber-900">Packs</Text>
      {packsQuery.data.packs.map((pack) => {
        const justOpened = openPackMutation.data?.pack.id === pack.id ? openPackMutation.data : null;
        return (
          <View key={pack.id} className="gap-3 rounded-3xl bg-white p-4">
            <View className="gap-1">
              <Text className="text-xl font-bold text-stone-900">{pack.name}</Text>
              <Text className="text-stone-700">{pack.description}</Text>
              <Text className="text-stone-700">Cost: {pack.cost} coins</Text>
              <Text className="text-stone-700">Cards: {pack.cardCount}</Text>
              {pack.guaranteedRarity ? <Text className="text-orange-700">Guaranteed: {pack.guaranteedRarity}</Text> : null}
            </View>
            <Pressable
              className="items-center rounded-2xl bg-orange-600 px-4 py-4"
              disabled={openPackMutation.isPending}
              onPress={() => void openPackMutation.mutateAsync(pack.id)}
            >
              <Text className="font-bold text-white">
                {openPackMutation.isPending ? "Opening..." : `Open for ${pack.cost}`}
              </Text>
            </Pressable>
            {justOpened ? (
              <View className="gap-1 rounded-2xl bg-orange-50 p-3">
                <Text className="font-bold text-amber-900">Latest pull</Text>
                {justOpened.cards.map((card) => (
                  <Text key={`${justOpened.pack.id}-${card.id}-${card.name}`} className="text-stone-700">
                    {card.name} {card.isNewForUser ? "(new)" : ""}
                  </Text>
                ))}
                <Text className="text-stone-700">New balance: {justOpened.newBalance}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}
