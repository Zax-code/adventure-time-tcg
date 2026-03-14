import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { PrimaryButton } from "../../src/components/button";

export default function QuestsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((state) => state.accessToken);
  const refreshToken = useSessionStore((state) => state.refreshToken);
  const setSession = useSessionStore((state) => state.setSession);

  const questsQuery = useQuery({ queryKey: ["quests"], queryFn: () => apiClient.quests() });
  const claimQuestMutation = useMutation({
    mutationFn: (questId: string) => apiClient.claimQuest({ questId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
      if (accessToken && refreshToken) {
        const me = await apiClient.me();
        await setSession({ user: me, accessToken, refreshToken });
      }
    },
  });

  if (questsQuery.isLoading) return <View className="flex-1 bg-bg p-6"><Text className="font-nunito text-fgMuted">Loading quests...</Text></View>;
  if (questsQuery.isError || !questsQuery.data) return <View className="flex-1 bg-bg p-6"><Text className="font-nunito text-red-600">{questsQuery.error?.message ?? "Quest data unavailable."}</Text></View>;

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-4 p-5">
      <Text className="font-nunito-extrabold text-2xl text-fg">Quests</Text>
      {questsQuery.data.quests.map((quest) => (
        <View key={quest.id} className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
          <Text className="font-nunito-bold text-lg text-fg">{quest.title}</Text>
          <Text className="font-nunito text-fgMuted">{quest.description}</Text>
          <Text className="font-nunito text-fgMuted">Progress: {quest.progress}/{quest.target}</Text>
          <View className="self-start rounded-full bg-secondary px-3 py-1">
            <Text className="font-nunito-bold text-xs text-fg">Reward: {quest.reward}</Text>
          </View>
          {quest.actionPath ? (
            <Pressable className="rounded-2xl bg-primaryTint px-4 py-3" onPress={() => router.push(quest.actionPath as any)}>
              <Text className="font-nunito-semibold text-primaryText">Open quest</Text>
            </Pressable>
          ) : null}
          {quest.completed && !quest.claimed ? (
            <PrimaryButton onPress={() => void claimQuestMutation.mutateAsync(quest.id)}>
              Claim reward
            </PrimaryButton>
          ) : null}
          {quest.failed ? <Text className="font-nunito text-sm text-red-600">This quest failed for today.</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}
