import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";

import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";

export default function HomeScreen() {
  const queryClient = useQueryClient();
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
    return <View className="flex-1 bg-parchment p-6"><Text>Loading home...</Text></View>;
  }

  if (homeQuery.isError) {
    return <View className="flex-1 bg-parchment p-6"><Text>{homeQuery.error.message}</Text></View>;
  }

  const home = homeQuery.data;
  if (!home) {
    return <View className="flex-1 bg-parchment p-6"><Text>Home is unavailable.</Text></View>;
  }

  return (
    <View className="flex-1 gap-3 bg-parchment p-6">
      <Text className="text-3xl font-bold text-amber-900">
        Hey, {home.user.displayName ?? home.user.email}
      </Text>
      <Text className="text-lg text-orange-800">Coins: {home.user.coins}</Text>
      <Text className="text-lg text-orange-800">Dust: {home.user.dust}</Text>
      <Text className="text-lg text-orange-800">
        Collection: {home.collectionStats.uniqueOwned}/{home.collectionStats.totalCards}
      </Text>
      <Text className="text-lg text-orange-800">
        Completion: {home.collectionStats.completionPercentage}%
      </Text>
      <Text className="mt-3 text-stone-600">
        Default steps source: {home.user.preferredStepSource}
      </Text>
      <View className="mt-4 gap-2 rounded-3xl bg-white p-4">
        <Text className="text-lg font-bold text-amber-900">Daily Claim</Text>
        <Text className="text-stone-700">
          Reward: {dailyClaimQuery.data?.dailyReward ?? 100} coins
        </Text>
        <Text className="text-stone-700">
          {dailyClaimQuery.data?.canClaim
            ? "Ready to claim now."
            : `Next claim in ${Math.ceil((dailyClaimQuery.data?.timeUntilNextClaim ?? 0) / 3600000)}h`}
        </Text>
        <Pressable
          className={`items-center rounded-2xl px-4 py-4 ${dailyClaimQuery.data?.canClaim ? "bg-orange-600" : "bg-stone-300"}`}
          disabled={!dailyClaimQuery.data?.canClaim || claimMutation.isPending}
          onPress={() => void claimMutation.mutateAsync()}
        >
          <Text className="font-bold text-white">
            {claimMutation.isPending ? "Claiming..." : "Claim daily reward"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
