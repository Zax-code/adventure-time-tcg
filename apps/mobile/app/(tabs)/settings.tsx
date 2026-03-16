import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { apiClient } from "../../src/lib/api";
import { useSessionStore } from "../../src/stores/session-store";
import { PrimaryButton } from "../../src/components/button";
import { useTranslation } from "../../src/i18n";

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useSessionStore((state) => state.user);
  const clearSession = useSessionStore((state) => state.clearSession);
  const setSession = useSessionStore((state) => state.setSession);
  const accessToken = useSessionStore((state) => state.accessToken);
  const refreshToken = useSessionStore((state) => state.refreshToken);
  const { locale, t } = useTranslation();

  const [displayNameInput, setDisplayNameInput] = useState(
    user?.displayName ?? "",
  );

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
    mutationFn: (displayName: string) =>
      apiClient.updateDisplayName(displayName),
    onSuccess: async (nextUser) => {
      if (accessToken && refreshToken) {
        await setSession({ user: nextUser, accessToken, refreshToken });
      }
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    },
  });

  const updateLanguageMutation = useMutation({
    mutationFn: (preferredLanguage: "en" | "fr") =>
      apiClient.updateLanguage({ preferredLanguage }),
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
      <Text className="font-nunito-extrabold text-2xl text-fg">
        {t("settings.title")}
      </Text>

      <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
        <Text className="font-nunito-bold text-primaryStrong">
          {t("settings.displayName")}
        </Text>
        <TextInput
          value={displayNameInput}
          onChangeText={setDisplayNameInput}
          placeholder={t("native.settings.displayNamePlaceholder")}
          placeholderTextColor="#9CA3AF"
          className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
        />
        <PrimaryButton
          onPress={() =>
            void updateDisplayNameMutation.mutateAsync(displayNameInput)
          }
        >
          {t("native.settings.saveDisplayName")}
        </PrimaryButton>
        <Pressable
          className="items-center rounded-full border border-primaryBorder px-4 py-3"
          onPress={() => void uploadAvatarMutation.mutateAsync()}
        >
          <Text className="font-nunito-semibold text-primaryText">
            {uploadAvatarMutation.isPending
              ? t("native.settings.uploading")
              : t("native.settings.changeProfilePicture")}
          </Text>
        </Pressable>
      </View>

      <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
        <Text className="font-nunito-bold text-primaryStrong">
          {t("native.settings.language")}
        </Text>
        <Text className="font-nunito text-fgMuted">
          {t("native.settings.preferredLanguage", {
            language:
              (user?.preferredLanguage ?? locale) === "fr"
                ? t("settings.french")
                : t("settings.english"),
          })}
        </Text>
        <View className="flex-row gap-2">
          {(["en", "fr"] as const).map((language) => (
            <Pressable
              key={language}
              className={`flex-1 items-center rounded-full border px-4 py-3 ${
                (user?.preferredLanguage ?? locale) === language
                  ? "border-primary bg-primary"
                  : "border-primaryBorder"
              }`}
              onPress={() => void updateLanguageMutation.mutateAsync(language)}
            >
              <Text
                className={`font-nunito-semibold ${
                  (user?.preferredLanguage ?? locale) === language
                    ? "text-white"
                    : "text-primaryText"
                }`}
              >
                {language === "fr"
                  ? t("settings.french")
                  : t("settings.english")}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
        <Text className="font-nunito-bold text-primaryStrong">
          {t("native.settings.stepSource")}
        </Text>
        <Text className="font-nunito text-fgMuted">
          {t("native.settings.preferredStepSource", {
            source: t(
              `native.settings.stepSources.${user?.preferredStepSource ?? "device_health"}`,
            ),
          })}
        </Text>
        <PrimaryButton
          onPress={() => updateSourceMutation.mutate("device_health")}
        >
          {t("native.settings.useDeviceHealth")}
        </PrimaryButton>
        <Pressable
          className="items-center rounded-full border border-primaryBorder px-4 py-3"
          onPress={() => updateSourceMutation.mutate("fitbit")}
        >
          <Text className="font-nunito-semibold text-primaryText">
            {t("native.settings.preferFitbit")}
          </Text>
        </Pressable>
        <Text className="font-nunito text-xs text-fgMuted">
          {t("native.settings.fitbitHelp")}
        </Text>
      </View>

      <View className="gap-3 rounded-3xl border border-primaryBorder bg-white p-4">
        <Text className="font-nunito-bold text-primaryStrong">
          {t("native.settings.healthSteps")}
        </Text>
        <Text className="font-nunito text-fgMuted">
          {t("native.settings.latestSynced", {
            count: stepQuery.data?.latest?.stepCount ?? 0,
          })}
        </Text>
        <Text className="font-nunito text-fgMuted">
          {t("native.settings.source", {
            source: t(
              `native.settings.stepSources.${stepQuery.data?.latest?.source ?? user?.preferredStepSource ?? "device_health"}`,
            ),
          })}
        </Text>
        <Pressable
          className="items-center rounded-full border border-primaryBorder px-4 py-3"
          onPress={() => syncSampleStepsMutation.mutate()}
        >
          <Text className="font-nunito-semibold text-primaryText">
            {t("native.settings.syncSample")}
          </Text>
        </Pressable>
      </View>

      <Pressable
        className="items-center rounded-full bg-primaryDark py-4"
        onPress={() => void clearSession().then(() => router.replace("/login"))}
      >
        <Text className="font-nunito-bold text-white">{t("home.logout")}</Text>
      </Pressable>
    </ScrollView>
  );
}
