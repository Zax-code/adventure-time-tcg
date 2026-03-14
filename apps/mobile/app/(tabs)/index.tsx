import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";

import { apiClient } from "../../src/lib/api";

export default function HomeScreen() {
  const homeQuery = useQuery({
    queryKey: ["home"],
    queryFn: () => apiClient.home(),
  });

  if (homeQuery.isLoading) {
    return <View className="flex-1 bg-parchment p-6"><Text>Loading home...</Text></View>;
  }

  if (homeQuery.isError) {
    return <View className="flex-1 bg-parchment p-6"><Text>{homeQuery.error.message}</Text></View>;
  }

  return (
    <View className="flex-1 gap-3 bg-parchment p-6">
      <Text className="text-3xl font-bold text-amber-900">
        Hey, {homeQuery.data.user.displayName ?? homeQuery.data.user.email}
      </Text>
      <Text className="text-lg text-orange-800">Coins: {homeQuery.data.user.coins}</Text>
      <Text className="text-lg text-orange-800">Dust: {homeQuery.data.user.dust}</Text>
      <Text className="text-lg text-orange-800">
        Collection: {homeQuery.data.collectionStats.uniqueOwned}/{homeQuery.data.collectionStats.totalCards}
      </Text>
      <Text className="text-lg text-orange-800">
        Completion: {homeQuery.data.collectionStats.completionPercentage}%
      </Text>
      <Text className="mt-3 text-stone-600">
        Default steps source: {homeQuery.data.user.preferredStepSource}
      </Text>
    </View>
  );
}
