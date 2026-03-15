import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { PrimaryButton, SecondaryButton } from "../../src/components/button";
import { CardTile } from "../../src/components/card-tile";

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const accessToken = useSessionStore((state) => state.accessToken);
  const refreshToken = useSessionStore((state) => state.refreshToken);
  const setSession = useSessionStore((state) => state.setSession);
  const homeQuery = useQuery({
    queryKey: ["home"],
    queryFn: () => apiClient.home(),
  });
  const dailyClaimQuery = useQuery({
    queryKey: ["daily-claim"],
    queryFn: () => apiClient.getDailyClaimStatus(),
  });
  const featuredQuery = useQuery({
    queryKey: ["featured-cards"],
    queryFn: () => apiClient.featuredCards(),
  });
  const raritiesQuery = useQuery({
    queryKey: ["rarities"],
    queryFn: () => apiClient.rarities(),
  });

  const claimMutation = useMutation({
    mutationFn: () => apiClient.claimDailyReward(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["daily-claim"] });
      await queryClient.invalidateQueries({ queryKey: ["home"] });

      if (accessToken && refreshToken) {
        const me = await apiClient.me();
        await setSession({ user: me, accessToken, refreshToken });
      }
    },
  });

  if (homeQuery.isLoading) {
    return <View className="flex-1 bg-bg p-6"><Text className="font-nunito text-fgMuted">Loading...</Text></View>;
  }

  if (homeQuery.isError) {
    return <View className="flex-1 bg-bg p-6"><Text className="font-nunito text-red-600">{homeQuery.error.message}</Text></View>;
  }

  const home = homeQuery.data;
  if (!home) {
    return <View className="flex-1 bg-bg p-6"><Text className="font-nunito text-fgMuted">Home is unavailable.</Text></View>;
  }

  const canClaim = dailyClaimQuery.data?.canClaim ?? false;
  const rarities = raritiesQuery.data?.rarities ?? [];
  const totalDropRate = rarities.reduce((s, r) => s + r.dropRate, 0);

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-4 pb-6">
      {/* Collection progress bar */}
      <View className="mx-5 gap-2 rounded-3xl border border-primaryBorder bg-white p-5">
        <Text className="font-nunito-bold text-lg text-fg">Collection Progress</Text>
        <View className="flex-row justify-between">
          <Text className="font-nunito text-sm text-fgMuted">{home.collectionStats.uniqueOwned}/{home.collectionStats.totalCards}</Text>
          <Text className="font-nunito text-sm text-fgMuted">{home.collectionStats.completionPercentage}% complete</Text>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-primaryTint">
          <View style={{ width: `${home.collectionStats.completionPercentage}%` }} className="h-full rounded-full bg-primary" />
        </View>
      </View>

      {/* Quick action buttons */}
      <View className="mx-5 flex-row gap-3">
        <PrimaryButton onPress={() => router.push("/(tabs)/packs")} style={{ flex: 1 }}>
          Open Packs
        </PrimaryButton>
        <SecondaryButton onPress={() => router.push("/(tabs)/collection")} style={{ flex: 1 }}>
          My Cards
        </SecondaryButton>
      </View>

      {/* Daily Claim card */}
      <View className="mx-5 gap-3 rounded-3xl border border-primaryBorder bg-white p-5">
        <Text className="font-nunito-bold text-lg text-fg">Daily Claim</Text>
        <Text className="font-nunito text-fgMuted">
          Reward: {dailyClaimQuery.data?.dailyReward ?? 100} coins
        </Text>
        <Text className="font-nunito text-fgMuted">
          {canClaim
            ? "Ready to claim now."
            : `Next claim in ${Math.ceil((dailyClaimQuery.data?.timeUntilNextClaim ?? 0) / 3600000)}h`}
        </Text>
        {canClaim ? (
          <PrimaryButton
            onPress={() => void claimMutation.mutateAsync()}
            loading={claimMutation.isPending}
          >
            Claim daily reward
          </PrimaryButton>
        ) : (
          <View className="items-center rounded-full bg-primaryTint px-4 py-3">
            <Text className="font-nunito-semibold text-primaryText">Already claimed today</Text>
          </View>
        )}
      </View>

      {/* Featured Cards carousel */}
      {(featuredQuery.data?.cards.length ?? 0) > 0 && (
        <View className="gap-2">
          <Text className="px-5 font-nunito-bold text-lg text-fg">Featured Cards</Text>
          <FlatList
            horizontal
            data={featuredQuery.data?.cards ?? []}
            keyExtractor={(item) => item.card.id}
            renderItem={({ item }) => (
              <View style={{ width: 160, marginHorizontal: 4 }}>
                <CardTile entry={item} accessToken={accessToken} />
              </View>
            )}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      {/* Drop Rates */}
      {rarities.length > 0 && (
        <View className="mx-5 gap-3 rounded-3xl border border-primaryBorder bg-white p-5">
          <Text className="font-nunito-bold text-lg text-fg">Drop Rates</Text>
          {rarities.map((rarity) => {
            const pct = totalDropRate > 0 ? Math.round((rarity.dropRate / totalDropRate) * 100) : 0;
            return (
              <View key={rarity.id} className="flex-row justify-between">
                <Text style={{ color: rarity.color }} className="font-nunito-semibold">{rarity.name}</Text>
                <Text className="font-nunito text-fgMuted">×{rarity.dropRate} (≈{pct}%)</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
