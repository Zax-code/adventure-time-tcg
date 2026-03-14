import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";

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

  if (questsQuery.isLoading) return <View className="flex-1 bg-parchment p-6"><Text>Loading quests...</Text></View>;
  if (questsQuery.isError || !questsQuery.data) return <View className="flex-1 bg-parchment p-6"><Text>{questsQuery.error?.message ?? "Quest data unavailable."}</Text></View>;

  return (
    <ScrollView className="flex-1 bg-parchment" contentContainerClassName="gap-4 p-5">
      <Text className="text-3xl font-bold text-amber-900">Quests</Text>
      {questsQuery.data.quests.map((quest) => (
        <View key={quest.id} className="gap-3 rounded-3xl bg-white p-4">
          <Text className="text-xl font-bold text-stone-900">{quest.title}</Text>
          <Text className="text-stone-700">{quest.description}</Text>
          <Text className="text-stone-700">Progress: {quest.progress}/{quest.target}</Text>
          <Text className="text-stone-700">Reward: {quest.reward}</Text>
          {quest.actionPath ? (
            <Pressable className="rounded-2xl bg-orange-100 px-4 py-3" onPress={() => router.push(quest.actionPath as any)}>
              <Text className="font-semibold text-orange-900">Open quest</Text>
            </Pressable>
          ) : null}
          {quest.completed && !quest.claimed ? (
            <Pressable className="rounded-2xl bg-orange-600 px-4 py-3" onPress={() => void claimQuestMutation.mutateAsync(quest.id)}>
              <Text className="font-semibold text-white">Claim reward</Text>
            </Pressable>
          ) : null}
          {quest.failed ? <Text className="text-red-700">This quest failed for today.</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}
