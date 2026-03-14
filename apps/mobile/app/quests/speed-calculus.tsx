import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";

import { apiClient } from "../../src/lib/api";

export default function SpeedCalculusScreen() {
  const queryClient = useQueryClient();
  const stateQuery = useQuery({ queryKey: ["speed-calculus"], queryFn: () => apiClient.speedCalculusState() });
  const startMutation = useMutation({
    mutationFn: () => apiClient.startSpeedCalculus(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["speed-calculus"] }),
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
      ]);
    },
  });
  const answerMutation = useMutation({
    mutationFn: (answer: number) => {
      const runId = stateQuery.data?.activeRun?.runId;
      if (!runId) throw new Error("No active run");
      return apiClient.answerSpeedCalculus(runId, answer);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["speed-calculus"] });
    },
  });
  const finishMutation = useMutation({
    mutationFn: () => {
      const runId = stateQuery.data?.activeRun?.runId;
      if (!runId) throw new Error("No active run");
      return apiClient.finishSpeedCalculus(runId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["speed-calculus"] }),
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
      ]);
    },
  });

  const currentQuestion = useMemo(() => {
    const run = stateQuery.data?.activeRun;
    if (!run) return null;
    return run.questions[run.questionIndex] ?? null;
  }, [stateQuery.data]);

  if (stateQuery.isLoading) return <View className="flex-1 bg-parchment p-6"><Text>Loading speed calculus...</Text></View>;
  if (stateQuery.isError || !stateQuery.data) return <View className="flex-1 bg-parchment p-6"><Text>{stateQuery.error?.message ?? "Speed Calculus unavailable."}</Text></View>;

  return (
    <ScrollView className="flex-1 bg-parchment" contentContainerClassName="gap-4 p-6">
      <Text className="text-3xl font-bold text-amber-900">Speed Calculus</Text>
      <Text className="text-stone-700">Runs used: {stateQuery.data.runsUsed}/{stateQuery.data.maxRuns}</Text>
      <Text className="text-stone-700">Latest reward preview: {stateQuery.data.rewardPreview}</Text>
      {!stateQuery.data.activeRun ? (
        <Pressable className="items-center rounded-2xl bg-orange-600 px-4 py-4" onPress={() => void startMutation.mutateAsync()}>
          <Text className="font-bold text-white">Start run</Text>
        </Pressable>
      ) : (
        <View className="gap-3 rounded-3xl bg-white p-4">
          <Text className="text-lg font-bold text-stone-900">Run {stateQuery.data.activeRun.runNumber}</Text>
          {currentQuestion ? <Text className="text-2xl text-stone-900">{currentQuestion.left} {currentQuestion.operator} {currentQuestion.right} = ?</Text> : <Text className="text-stone-700">No more visible questions. Finish the run.</Text>}
          <View className="flex-row flex-wrap gap-2">
            {[0,1,2,3,4,5,6,7,8,9].map((value) => (
              <Pressable key={value} className="rounded-xl bg-orange-100 px-4 py-3" onPress={() => void answerMutation.mutateAsync(value)}>
                <Text className="font-semibold text-orange-900">{value}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable className="items-center rounded-2xl bg-stone-900 px-4 py-4" onPress={() => void finishMutation.mutateAsync()}>
            <Text className="font-bold text-white">Finish run</Text>
          </Pressable>
        </View>
      )}
      <View className="gap-2 rounded-3xl bg-white p-4">
        <Text className="text-lg font-bold text-stone-900">History</Text>
        {stateQuery.data.history.map((run) => (
          <Text key={run.runId} className="text-stone-700">Run {run.runNumber}: {run.status} - score {run.score} - reward {run.reward}</Text>
        ))}
      </View>
    </ScrollView>
  );
}
