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
    </View>
  );
}
