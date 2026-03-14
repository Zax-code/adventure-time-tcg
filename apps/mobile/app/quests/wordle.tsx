import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, Text, TextInput, View } from "react-native";

import { apiClient } from "../../src/lib/api";

export default function WordleScreen() {
  const queryClient = useQueryClient();
  const [guess, setGuess] = useState("");
  const stateQuery = useQuery({ queryKey: ["wordle"], queryFn: () => apiClient.wordleState() });
  const submitMutation = useMutation({
    mutationFn: (payload: { guess: string; expectedDate?: string }) => apiClient.submitWordle(payload),
    onSuccess: async () => {
      setGuess("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["wordle"] }),
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
      ]);
    },
  });

  const board = useMemo(() => stateQuery.data?.guesses ?? [], [stateQuery.data]);

  if (stateQuery.isLoading) return <View className="flex-1 bg-parchment p-6"><Text>Loading Wordle...</Text></View>;
  if (stateQuery.isError || !stateQuery.data) return <View className="flex-1 bg-parchment p-6"><Text>{stateQuery.error?.message ?? "Wordle unavailable."}</Text></View>;

  return (
    <View className="flex-1 gap-4 bg-parchment p-6">
      <Text className="text-3xl font-bold text-amber-900">Daily Wordle</Text>
      <Text className="text-stone-700">Attempts used: {board.length}/6</Text>
      {board.map((row, rowIndex) => (
        <View key={`${row.guess}-${rowIndex}`} className="flex-row gap-2">
          {row.guess.split("").map((char, index) => (
            <View key={`${row.guess}-${index}`} className={`h-12 w-12 items-center justify-center rounded-xl ${row.evaluation[index] === "correct" ? "bg-green-600" : row.evaluation[index] === "present" ? "bg-yellow-500" : "bg-stone-400"}`}>
              <Text className="font-bold text-white">{char}</Text>
            </View>
          ))}
        </View>
      ))}
      <TextInput value={guess} onChangeText={setGuess} autoCapitalize="characters" maxLength={5} placeholder="Enter a 5-letter word" className="rounded-2xl border border-orange-300 bg-white px-4 py-3" />
      <Pressable className="items-center rounded-2xl bg-orange-600 px-4 py-4" onPress={() => void submitMutation.mutateAsync({ guess, expectedDate: stateQuery.data?.date })}>
        <Text className="font-bold text-white">Submit guess</Text>
      </Pressable>
      {stateQuery.data.targetWord ? <Text className="text-stone-700">The word was {stateQuery.data.targetWord}</Text> : null}
      {stateQuery.data.solved ? <Text className="text-green-700">Solved!</Text> : null}
    </View>
  );
}
