import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiClient, API_BASE_URL } from "../src/lib/api";
import { useSessionStore } from "../src/stores/session-store";
import { useThemeStore } from "../src/stores/theme-store";
import type { ThemeName } from "../src/theme/themes";
import { THEME_COLORS, THEME_VARS } from "../src/theme/themes";
import { PrimaryButton } from "../src/components/button";
import { useTranslation } from "../src/i18n";

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const user = useSessionStore((state) => state.user);
  const clearSession = useSessionStore((state) => state.clearSession);
  const setSession = useSessionStore((state) => state.setSession);
  const accessToken = useSessionStore((state) => state.accessToken);
  const refreshToken = useSessionStore((state) => state.refreshToken);
  const { locale, t } = useTranslation();

  const themeName = useThemeStore((state) => state.themeName);
  const setTheme = useThemeStore((state) => state.setTheme);
  const tc = THEME_COLORS[themeName];

  const [editing, setEditing] = useState(false);
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
      setEditing(false);
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

  const avatarUri = user?.avatarAssetId
    ? `${API_BASE_URL}/media/profile/${user.avatarAssetId}`
    : null;

  return (
    <View style={[{ flex: 1 }, THEME_VARS[themeName]]}>
      <View className="flex-1 bg-bg">
        {/* Drag handle */}
        <View className="w-9 h-1 rounded-full bg-muted self-center mt-2 mb-1" />

        {/* Header */}
        <View
          className="items-center px-6 py-4"
          style={{ borderBottomColor: tc.primaryBorder, borderBottomWidth: 1 }}
        >
          <Text className="font-nunito-extrabold text-2xl text-fg">
            {t("settings.title")}
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            gap: 16,
            padding: 24,
            paddingBottom: insets.bottom + 24,
          }}
        >
          {/* Profile */}
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Ionicons
                name="person-circle-outline"
                size={22}
                color={tc.primaryDark}
              />
              <Text className="font-nunito-bold text-lg text-primaryStrong">
                {t("native.settings.profile")}
              </Text>
            </View>

            <View
              className="rounded-3xl border border-primaryBorder bg-surface p-4"
              style={{
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            >
              <View className="items-center gap-3">
                {/* Avatar — always visible; camera badge in edit mode */}
                <Pressable
                  onPress={() =>
                    editing ? void uploadAvatarMutation.mutateAsync() : undefined
                  }
                  disabled={!editing}
                  className="relative"
                >
                  {avatarUri ? (
                    <Image
                      source={{
                        uri: avatarUri,
                        headers: { Authorization: `Bearer ${accessToken}` },
                      }}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        borderWidth: 2,
                        borderColor: tc.primaryBorder,
                      }}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: tc.primary,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Nunito_700Bold",
                          fontSize: 24,
                          color: "#fff",
                        }}
                      >
                        {user?.displayName?.[0]?.toUpperCase() ?? "?"}
                      </Text>
                    </View>
                  )}
                  {editing && (
                    <View
                      className="absolute bottom-0 right-0 w-5 h-5 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: tc.primaryDark,
                        borderWidth: 2,
                        borderColor: tc.surface,
                      }}
                    >
                      <Ionicons name="camera" size={11} color="#fff" />
                    </View>
                  )}
                </Pressable>

                {/* Name line */}
                {editing ? (
                  <TextInput
                    value={displayNameInput}
                    onChangeText={setDisplayNameInput}
                    placeholder={t("native.settings.displayNamePlaceholder")}
                    placeholderTextColor={tc.muted}
                    autoFocus
                    className="w-full text-center font-nunito-bold text-base py-1 px-0"
                    style={{
                      color: tc.fg,
                      borderBottomWidth: 1,
                      borderBottomColor: tc.primary,
                    }}
                  />
                ) : (
                  <Text
                    className="font-nunito-bold text-base text-fg"
                    numberOfLines={1}
                  >
                    {user?.displayName ?? user?.email ?? ""}
                  </Text>
                )}

                {/* Email line — identical in both modes */}
                <Text className="font-nunito text-sm text-fgMuted" numberOfLines={1}>
                  {user?.email}
                </Text>

                {/* Action row */}
                {editing ? (
                  <View className="flex-row gap-2 mt-1 w-full">
                    <Pressable
                      onPress={() => {
                        setEditing(false);
                        setDisplayNameInput(user?.displayName ?? "");
                      }}
                      className="flex-1 items-center justify-center py-2 rounded-full border border-primaryBorder"
                    >
                      <Text className="font-nunito-semibold text-sm text-primaryText">
                        {t("native.settings.cancelEdit")}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        void updateDisplayNameMutation.mutateAsync(
                          displayNameInput,
                        )
                      }
                      className="flex-1 items-center justify-center py-2 rounded-full bg-primary"
                    >
                      <Text className="font-nunito-semibold text-sm text-white">
                        {updateDisplayNameMutation.isPending
                          ? "..."
                          : t("native.settings.saveDisplayName")}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      setDisplayNameInput(user?.displayName ?? "");
                      setEditing(true);
                    }}
                    className="px-5 py-2 rounded-full border border-primaryBorder mt-1"
                  >
                    <Text className="font-nunito-semibold text-sm text-primaryText">
                      {t("native.settings.edit")}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>

          {/* Language */}
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Ionicons
                name="language-outline"
                size={22}
                color={tc.primaryDark}
              />
              <Text className="font-nunito-bold text-lg text-primaryStrong">
                {t("native.settings.language")}
              </Text>
            </View>
            <View
              className="rounded-3xl border border-primaryBorder bg-surface p-4"
              style={{
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            >
              <Text className="font-nunito text-fgMuted mb-3">
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
                    onPress={() =>
                      void updateLanguageMutation.mutateAsync(language)
                    }
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
          </View>

          {/* Step Source */}
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Ionicons
                name="footsteps-outline"
                size={22}
                color={tc.primaryDark}
              />
              <Text className="font-nunito-bold text-lg text-primaryStrong">
                {t("native.settings.stepSource")}
              </Text>
            </View>
            <View
              className="rounded-3xl border border-primaryBorder bg-surface p-4"
              style={{
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            >
              <Text className="font-nunito text-fgMuted mb-3">
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
              <View style={{ height: 8 }} />
              <Pressable
                className="items-center rounded-full border border-primaryBorder px-4 py-3"
                onPress={() => updateSourceMutation.mutate("fitbit")}
              >
                <Text className="font-nunito-semibold text-primaryText">
                  {t("native.settings.preferFitbit")}
                </Text>
              </Pressable>
              <Text className="font-nunito text-xs text-fgMuted mt-2">
                {t("native.settings.fitbitHelp")}
              </Text>
            </View>
          </View>

          {/* Health Steps */}
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Ionicons
                name="heart-outline"
                size={22}
                color={tc.primaryDark}
              />
              <Text className="font-nunito-bold text-lg text-primaryStrong">
                {t("native.settings.healthSteps")}
              </Text>
            </View>
            <View
              className="rounded-3xl border border-primaryBorder bg-surface p-4"
              style={{
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            >
              <Text className="font-nunito text-fgMuted">
                {t("native.settings.latestSynced", {
                  count: stepQuery.data?.latest?.stepCount ?? 0,
                })}
              </Text>
              <Text className="font-nunito text-fgMuted mb-3">
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
          </View>

          {/* Theme */}
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Ionicons
                name="color-palette-outline"
                size={22}
                color={tc.primaryDark}
              />
              <Text className="font-nunito-bold text-lg text-primaryStrong">
                {t("native.settings.theme")}
              </Text>
            </View>
            <View
              className="rounded-3xl border border-primaryBorder bg-surface p-4"
              style={{
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            >
              <View className="flex-row gap-2">
                {(["candy", "ice", "nightosphere"] as ThemeName[]).map(
                  (name) => (
                    <Pressable
                      key={name}
                      className={`flex-1 items-center rounded-full border px-2 py-3 ${
                        themeName === name
                          ? "border-primary bg-primary"
                          : "border-primaryBorder"
                      }`}
                      onPress={() => void setTheme(name)}
                    >
                      <Text
                        className={`font-nunito-semibold text-xs capitalize ${
                          themeName === name ? "text-white" : "text-primaryText"
                        }`}
                      >
                        {name}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
            </View>
          </View>

          {/* Logout */}
          <Pressable
            className="items-center rounded-full bg-primaryDark py-4 flex-row justify-center gap-2"
            onPress={() =>
              void clearSession().then(() => router.replace("/login"))
            }
          >
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text className="font-nunito-bold text-white">
              {t("home.logout")}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}
