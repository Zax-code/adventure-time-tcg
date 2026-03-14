import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";

import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { PrimaryButton } from "../../src/components/button";

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
    return <View className="flex-1 bg-bg p-6"><Text className="font-nunito text-fgMuted">Loading packs...</Text></View>;
  }

  if (packsQuery.isError || !packsQuery.data) {
    return <View className="flex-1 bg-bg p-6"><Text className="font-nunito text-red-600">{packsQuery.error?.message ?? "Packs unavailable."}</Text></View>;
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-4 p-5">
      <Text className="font-nunito-extrabold text-2xl text-fg">Packs</Text>
      {packsQuery.data.packs.map((pack) => {
        const justOpened = openPackMutation.data?.pack.id === pack.id ? openPackMutation.data : null;
        return (
          <View key={pack.id} className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
            <View className="gap-1">
              <Text className="font-nunito-bold text-lg text-fg">{pack.name}</Text>
              <Text className="font-nunito text-fgMuted">{pack.description}</Text>
              <Text className="font-nunito text-fgMuted">Cost: {pack.cost} coins</Text>
              <Text className="font-nunito text-fgMuted">Cards: {pack.cardCount}</Text>
              {pack.guaranteedRarity ? (
                <View className="self-start rounded-full bg-secondary px-3 py-1">
                  <Text className="font-nunito-bold text-xs text-fg">Guaranteed: {pack.guaranteedRarity}</Text>
                </View>
              ) : null}
            </View>
            <PrimaryButton
              disabled={openPackMutation.isPending}
              loading={openPackMutation.isPending}
              onPress={() => void openPackMutation.mutateAsync(pack.id)}
            >
              {`Open for ${pack.cost}`}
            </PrimaryButton>
            {justOpened ? (
              <View className="gap-1 rounded-2xl bg-primaryTint p-3">
                <Text className="font-nunito-bold text-primaryStrong">Latest pull</Text>
                {justOpened.cards.map((card) => (
                  <Text key={`${justOpened.pack.id}-${card.id}-${card.name}`} className="font-nunito text-fgMuted">
                    {card.name} {card.isNewForUser ? "(new)" : ""}
                  </Text>
                ))}
                <Text className="font-nunito text-fgMuted">New balance: {justOpened.newBalance}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}
