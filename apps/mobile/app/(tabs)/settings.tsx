import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { PrimaryButton } from "../../src/components/button";

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useSessionStore((state) => state.user);
  const clearSession = useSessionStore((state) => state.clearSession);
  const setSession = useSessionStore((state) => state.setSession);
  const accessToken = useSessionStore((state) => state.accessToken);
  const refreshToken = useSessionStore((state) => state.refreshToken);

  const [displayNameInput, setDisplayNameInput] = useState(user?.displayName ?? "");

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

  const updateDisplayNameMutation = useMutation({
    mutationFn: (displayName: string) => apiClient.updateDisplayName(displayName),
    onSuccess: async (nextUser) => {
      if (accessToken && refreshToken) {
        await setSession({ user: nextUser, accessToken, refreshToken });
      }
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) throw new Error("Cancelled");
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: "avatar.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as any);
      return apiClient.uploadProfileImage(formData);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["home"] });
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
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-4 p-6">
      <Text className="font-nunito-extrabold text-2xl text-fg">Settings</Text>

      <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
        <Text className="font-nunito-bold text-primaryStrong">Display Name</Text>
        <TextInput
          value={displayNameInput}
          onChangeText={setDisplayNameInput}
          placeholder="Enter display name"
          placeholderTextColor="#9CA3AF"
          className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
        />
        <PrimaryButton onPress={() => void updateDisplayNameMutation.mutateAsync(displayNameInput)}>
          Save display name
        </PrimaryButton>
        <Pressable
          className="items-center rounded-full border border-primaryBorder px-4 py-3"
          onPress={() => void uploadAvatarMutation.mutateAsync()}
        >
          <Text className="font-nunito-semibold text-primaryText">
            {uploadAvatarMutation.isPending ? "Uploading…" : "Change profile picture"}
          </Text>
        </Pressable>
      </View>

      <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
        <Text className="font-nunito-bold text-primaryStrong">Step Source</Text>
        <Text className="font-nunito text-fgMuted">
          Preferred: {user?.preferredStepSource ?? "device_health"}
        </Text>
        <PrimaryButton onPress={() => updateSourceMutation.mutate("device_health")}>
          Use Apple Health / Health Connect
        </PrimaryButton>
        <Pressable
          className="items-center rounded-full border border-primaryBorder px-4 py-3"
          onPress={() => updateSourceMutation.mutate("fitbit")}
        >
          <Text className="font-nunito-semibold text-primaryText">Prefer Fitbit when connected</Text>
        </Pressable>
        <Text className="font-nunito text-xs text-fgMuted">Fitbit connection remains optional and will be wired later.</Text>
      </View>

      <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
        <Text className="font-nunito-bold text-primaryStrong">Health Steps</Text>
        <Text className="font-nunito text-fgMuted">
          Latest synced: {stepQuery.data?.latest?.stepCount ?? 0} steps
        </Text>
        <Text className="font-nunito text-fgMuted">
          Source: {stepQuery.data?.latest?.source ?? user?.preferredStepSource ?? "device_health"}
        </Text>
        <Pressable
          className="items-center rounded-full border border-primaryBorder px-4 py-3"
          onPress={() => syncSampleStepsMutation.mutate()}
        >
          <Text className="font-nunito-semibold text-primaryText">Sync sample device steps</Text>
        </Pressable>
      </View>

      {user?.isAdmin ? (
        <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
          <Text className="font-nunito-bold text-primaryStrong">Admin</Text>
          <Text className="font-nunito text-fgMuted">Admin tools live behind a hidden route group.</Text>
          <Pressable
            className="items-center rounded-full bg-fg px-4 py-3"
            onPress={() => router.push("/admin")}
          >
            <Text className="font-nunito-bold text-white">Open hidden admin tools</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        className="items-center rounded-full bg-primaryDark py-4"
        onPress={() => void clearSession().then(() => router.replace("/login"))}
      >
        <Text className="font-nunito-bold text-white">Log out</Text>
      </Pressable>
    </ScrollView>
  );
}
