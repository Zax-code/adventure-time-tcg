import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useSessionStore((state) => state.user);
  const clearSession = useSessionStore((state) => state.clearSession);
  const setSession = useSessionStore((state) => state.setSession);
  const accessToken = useSessionStore((state) => state.accessToken);
  const refreshToken = useSessionStore((state) => state.refreshToken);

  const stepQuery = useQuery({
    queryKey: ["health-steps"],
    queryFn: () => apiClient.getHealthSteps(),
    enabled: Boolean(user),
  });

  const updateSourceMutation = useMutation({
    mutationFn: (preferredStepSource: "device_health" | "fitbit") =>
      apiClient.updateStepSource({ preferredStepSource }),
    onSuccess: async (nextUser) => {
      if (accessToken && refreshToken) {
        await setSession({ user: nextUser, accessToken, refreshToken });
      }
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      await queryClient.invalidateQueries({ queryKey: ["health-steps"] });
    },
  });

  const syncSampleStepsMutation = useMutation({
    mutationFn: () =>
      apiClient.syncSteps({
        source: "device_health",
        stepCount: 7421,
        recordedFor: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["health-steps"] });
    },
  });

  return (
    <View className="flex-1 gap-4 bg-parchment p-6">
      <Text className="text-3xl font-bold text-amber-900">Settings</Text>
      <Text className="text-stone-700">
        Preferred steps source: {user?.preferredStepSource ?? "device_health"}
      </Text>
      <View className="gap-2">
        <Pressable
          className="rounded-2xl bg-orange-600 px-4 py-3"
          onPress={() => updateSourceMutation.mutate("device_health")}
        >
          <Text className="font-semibold text-white">Use Apple Health / Health Connect</Text>
        </Pressable>
        <Pressable
          className="rounded-2xl bg-orange-200 px-4 py-3"
          onPress={() => updateSourceMutation.mutate("fitbit")}
        >
          <Text className="font-semibold text-orange-900">Prefer Fitbit when connected</Text>
        </Pressable>
      </View>
      <Text className="text-stone-700">Fitbit connection remains optional and will be wired later.</Text>
      <Text className="text-stone-700">
        Latest synced steps: {stepQuery.data?.latest?.stepCount ?? 0}
      </Text>
      <Text className="text-stone-700">
        Latest step source: {stepQuery.data?.latest?.source ?? user?.preferredStepSource ?? "device_health"}
      </Text>
      <Pressable
        className="rounded-2xl bg-teal-700 px-4 py-3"
        onPress={() => syncSampleStepsMutation.mutate()}
      >
        <Text className="font-semibold text-white">Sync sample device steps</Text>
      </Pressable>
      {user?.isAdmin ? (
        <Text className="text-stone-700">Admin tools will live behind a hidden route group.</Text>
      ) : null}
      <Pressable
        className="mt-4 items-center rounded-2xl bg-stone-900 py-4"
        onPress={() => void clearSession().then(() => router.replace("/login"))}
      >
        <Text className="font-bold text-white">Log out</Text>
      </Pressable>
    </View>
  );
}
