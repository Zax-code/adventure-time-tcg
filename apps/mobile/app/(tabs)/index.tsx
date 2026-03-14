import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { PrimaryButton } from "../../src/components/button";

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

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-4 pb-6">
      {/* Header banner */}
      <LinearGradient colors={["#fce7f3", "#fdf2f8"]} className="px-6 pb-5 pt-14">
        <View className="flex-row items-center justify-between">
          <Text className="font-nunito-extrabold text-2xl text-fg">
            Hey, {home.user.displayName ?? home.user.email} 👋
          </Text>
          <View className="flex-row gap-2">
            <View className="rounded-full bg-secondary px-3 py-1">
              <Text className="font-nunito-bold text-sm text-fg">{home.user.coins} 🪙</Text>
            </View>
            <View className="rounded-full bg-primaryTint px-3 py-1">
              <Text className="font-nunito-bold text-sm text-primaryText">{home.user.dust} ✨</Text>
            </View>
          </View>
        </View>
        <View className="mt-3 flex-row gap-3">
          <Text className="font-nunito text-sm text-fgMuted">
            Collection: {home.collectionStats.uniqueOwned}/{home.collectionStats.totalCards}
          </Text>
          <Text className="font-nunito text-sm text-fgMuted">
            {home.collectionStats.completionPercentage}% complete
          </Text>
        </View>
      </LinearGradient>

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

      <Text className="px-5 font-nunito text-xs text-fgMuted">
        Steps source: {home.user.preferredStepSource}
      </Text>
    </ScrollView>
  );
}
