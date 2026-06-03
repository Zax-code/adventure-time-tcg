import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@react-native-vector-icons/ionicons";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedExpoButton } from "../src/components/expo-ui/themed-button";
import { ThemedExpoSwitch } from "../src/components/expo-ui/themed-switch";
import { ThemedExpoTextInput } from "../src/components/expo-ui/themed-text-input";
import {
  KEYBOARD_AWARE_SCROLL_PROPS,
  KeyboardScreenView,
} from "../src/components/keyboard-screen-view";
import { ModalSheetRoute } from "../src/components/modal-sheet-route";
import { useTranslation } from "../src/i18n";
import { apiClient, API_BASE_URL, clearAppSession } from "../src/lib/api";
import {
  ensureAppNotificationPermission,
  getNotificationPermissionStatus,
} from "../src/lib/app-notifications";
import { connectFitbit } from "../src/lib/fitbit";
import type { IoniconName } from "../src/lib/ionicons";
import {
  openDeviceHealthSetup,
  syncDeviceStepsNow,
} from "../src/lib/step-sync";
import { useSessionStore } from "../src/stores/session-store";
import { useStepSyncStore } from "../src/stores/step-sync-store";
import { useThemeStore } from "../src/stores/theme-store";
import type { ThemeName } from "../src/theme/themes";
import { THEME_COLORS, THEME_VARS } from "../src/theme/themes";

const LANGUAGE_OPTIONS = ["en", "fr"] as const;
const STEP_SOURCE_OPTIONS = ["device_health", "fitbit"] as const;
const THEME_OPTIONS: ThemeName[] = ["candy", "ice", "nightosphere"];

type ToneName = "primary" | "success" | "danger" | "neutral";
type NotificationPreferenceKey =
  | "dailyReset"
  | "stepGoal"
  | "pvpInvite"
  | "pvpTurn"
  | "giftReceived";

export default function SettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const user = useSessionStore((state) => state.user);
  const setUser = useSessionStore((state) => state.setUser);
  const accessToken = useSessionStore((state) => state.accessToken);
  const { locale, t } = useTranslation();

  const themeName = useThemeStore((state) => state.themeName);
  const setTheme = useThemeStore((state) => state.setTheme);
  const stepSync = useStepSyncStore();
  const tc = THEME_COLORS[themeName];

  const [editing, setEditing] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(
    user?.displayName ?? "",
  );
  const [fitbitError, setFitbitError] = useState<string | null>(null);
  const [isConnectingFitbit, setIsConnectingFitbit] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(
    null,
  );
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [notificationsSectionY, setNotificationsSectionY] = useState<
    number | null
  >(null);

  const stepQuery = useQuery({
    queryKey: ["health-steps"],
    queryFn: () => apiClient.getHealthSteps(),
    enabled: Boolean(user),
  });

  const fitbitStatusQuery = useQuery({
    queryKey: ["fitbit-status"],
    queryFn: () => apiClient.fitbitStatus(),
    enabled: Boolean(user),
  });

  const updateSourceMutation = useMutation({
    mutationFn: (preferredStepSource: "device_health" | "fitbit") =>
      apiClient.updateStepSource({ preferredStepSource }),
    onSuccess: async (nextUser) => {
      await setUser(nextUser);
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      await queryClient.invalidateQueries({ queryKey: ["health-steps"] });
    },
  });

  const updateDisplayNameMutation = useMutation({
    mutationFn: (displayName: string) =>
      apiClient.updateDisplayName(displayName),
    onSuccess: async (nextUser) => {
      await setUser(nextUser);
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      setEditing(false);
    },
  });

  const updateLanguageMutation = useMutation({
    mutationFn: (preferredLanguage: "en" | "fr") =>
      apiClient.updateLanguage({ preferredLanguage }),
    onSuccess: async (nextUser) => {
      await setUser(nextUser);
      await queryClient.invalidateQueries({ queryKey: ["home"] });
    },
  });

  const updateNotificationPreferencesMutation = useMutation({
    mutationFn: (notificationPreferences: NonNullable<typeof user>["notificationPreferences"]) =>
      apiClient.updateNotificationPreferences({ notificationPreferences }),
    onSuccess: async (nextUser) => {
      await setUser(nextUser);
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
      if (result.canceled || !result.assets[0]) {
        throw new Error("Cancelled");
      }
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

  const avatarUri = user?.avatarAssetId
    ? `${API_BASE_URL}/media/profile/${user.avatarAssetId}`
    : null;
  const currentLanguage = user?.preferredLanguage ?? locale;
  const currentStepSource = user?.preferredStepSource ?? "device_health";
  const notificationPreferences = user?.notificationPreferences ?? {
    dailyReset: true,
    stepGoal: true,
    pvpInvite: true,
    pvpTurn: true,
    giftReceived: true,
  };
  const healthStatusLabel = t(
    `settings.permissionStates.${stepSync.healthPermissionStatus}`,
  );
  const healthSystemLabel = t(
    Platform.OS === "ios"
      ? "settings.healthSystems.ios"
      : Platform.OS === "android"
        ? "settings.healthSystems.android"
        : "settings.healthSystems.default",
  );
  const notificationStatusLabel = t(
    `settings.permissionStates.${stepSync.notificationPermissionStatus}`,
  );
  const fitbitConnected = fitbitStatusQuery.data?.connected ?? false;
  const prefersFitbit = currentStepSource === "fitbit";
  const displayNameValue = displayNameInput.trim();
  const canSaveDisplayName =
    displayNameValue.length > 0 &&
    displayNameValue !== (user?.displayName ?? "").trim();
  const latestStepSource = stepQuery.data?.latest?.source ?? currentStepSource;
  const latestSyncedDate = formatSettingsDate(
    stepQuery.data?.latest?.updatedAt ?? null,
    currentLanguage,
  );
  const recordedForDate = formatRecordedForDate(
    stepQuery.data?.latest?.recordedFor ?? null,
    currentLanguage,
  );
  const fitbitStatusLabel = fitbitConnected
    ? t("settings.fitbitConnected")
    : t("settings.fitbitNotConnected");
  const notificationPermissionCta =
    stepSync.notificationPermissionStatus === "denied"
      ? t("settings.openNotificationSettings")
      : t("settings.enableNotifications");
  const notificationPermissionSummary =
    stepSync.notificationPermissionStatus === "granted"
      ? t("settings.notificationsEnabledHelp")
      : t("settings.notificationsDisabledHelp");
  const syncTone: ToneName = prefersFitbit
    ? fitbitConnected
      ? "success"
      : "neutral"
    : stepSync.healthPermissionStatus === "granted"
      ? "success"
      : "neutral";
  const syncSummary = prefersFitbit
    ? fitbitConnected
      ? t("settings.fitbitConnectedHelp")
      : t("settings.fitbitHelp")
    : t("settings.stepSyncHelp", { healthSystem: healthSystemLabel });
  const syncStatusValue = prefersFitbit ? fitbitStatusLabel : healthStatusLabel;
  const syncStatusLabel = prefersFitbit
    ? t("settings.fitbitStatus")
    : t("settings.healthAccessLabel");
  const stepActionLabel = prefersFitbit
    ? fitbitConnected
      ? t("settings.syncNow")
      : isConnectingFitbit
        ? t("settings.connectingFitbit")
        : t("settings.connectFitbit")
    : stepSync.availability === "setup_required"
      ? t("settings.openHealthConnect", {
          healthSystem: healthSystemLabel,
        })
      : stepSync.healthPermissionStatus === "granted"
        ? t("settings.syncNow")
        : t("settings.enableStepSync");

  useEffect(() => {
    void getNotificationPermissionStatus();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void getNotificationPermissionStatus();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (params.section !== "notifications" || notificationsSectionY === null) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(notificationsSectionY - 20, 0),
        animated: true,
      });
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [notificationsSectionY, params.section]);

  const handleStepAction = async () => {
    if (prefersFitbit) {
      setFitbitError(null);

      if (!fitbitConnected) {
        setIsConnectingFitbit(true);

        try {
          const result = await connectFitbit("/settings");

          if (result.type === "error") {
            setFitbitError(t("settings.fitbitConnectFailed"));
          }
        } catch {
          setFitbitError(t("settings.fitbitConnectFailed"));
        } finally {
          setIsConnectingFitbit(false);
        }

        await Promise.all([
          fitbitStatusQuery.refetch(),
          stepQuery.refetch(),
          queryClient.invalidateQueries({ queryKey: ["quests"] }),
        ]);
        return;
      }

      await Promise.all([
        fitbitStatusQuery.refetch(),
        stepQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
      ]);
      return;
    }

    if (stepSync.availability === "setup_required") {
      await openDeviceHealthSetup();
      return;
    }

    await syncDeviceStepsNow({
      interactive: true,
      source: "manual",
    });
  };

  const handleChooseFitbit = async () => {
    setFitbitError(null);

    await updateSourceMutation.mutateAsync("fitbit");

    if (fitbitConnected) {
      return;
    }

    setIsConnectingFitbit(true);

    try {
      const result = await connectFitbit("/settings");

      if (result.type === "error") {
        setFitbitError(t("settings.fitbitConnectFailed"));
      }
    } catch {
      setFitbitError(t("settings.fitbitConnectFailed"));
    } finally {
      setIsConnectingFitbit(false);
    }

    await Promise.all([
      fitbitStatusQuery.refetch(),
      stepQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ["quests"] }),
    ]);
  };

  const handleNotificationPermissionAction = async () => {
    setNotificationError(null);

    if (stepSync.notificationPermissionStatus === "denied") {
      await Linking.openSettings();
      return;
    }

    const granted = await ensureAppNotificationPermission(true);

    if (!granted) {
      setNotificationError(t("settings.notificationsPermissionRequired"));
    }
  };

  const handleNotificationPreferenceToggle = async (
    key: NotificationPreferenceKey,
    nextValue: boolean,
  ) => {
    setNotificationError(null);

    if (nextValue) {
      const granted = await ensureAppNotificationPermission(true);

      if (!granted) {
        setNotificationError(t("settings.notificationsPermissionRequired"));
        return;
      }
    }

    await updateNotificationPreferencesMutation.mutateAsync({
      ...notificationPreferences,
      [key]: nextValue,
    });
  };

  return (
    <ModalSheetRoute
      onClose={() => router.back()}
      sheetBackgroundColor={tc.bg}
      handleColor={tc.primaryBorder}
      sheetStyle={THEME_VARS[themeName]}
    >
      <KeyboardScreenView style={THEME_VARS[themeName]}>
        <View className="flex-1 bg-bg">

          <ScrollView
            ref={scrollViewRef}
            {...KEYBOARD_AWARE_SCROLL_PROPS}
            className="flex-1"
            contentContainerStyle={{
              paddingTop: 20,
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 32,
            }}
          >
            <View className="gap-6">
              <View className="gap-4">
                <View className="flex-row items-start justify-between gap-4 px-1">
                  <View className="flex-1 gap-1">
                    <Text className="font-nunito-extrabold text-3xl text-fg">
                      {t("settings.title")}
                    </Text>
                    <Text className="font-nunito text-sm leading-5 text-fgMuted">
                      {t("settings.subtitle")}
                    </Text>
                  </View>
                </View>

                <View
                  className="rounded-3xl border border-primaryBorder px-5 py-5"
                  style={{
                    backgroundColor: tc.surface,
                    shadowColor: "#000",
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 2,
                  }}
                >
                  <View className="gap-4">
                    <View className="flex-row items-center gap-4">
                      <Pressable
                        onPress={() =>
                          editing
                            ? void uploadAvatarMutation.mutateAsync()
                            : undefined
                        }
                        disabled={!editing || uploadAvatarMutation.isPending}
                        className="relative"
                      >
                        {avatarUri ? (
                          <Image
                            source={{
                              uri: avatarUri,
                              headers: { Authorization: `Bearer ${accessToken}` },
                            }}
                            style={{
                              width: 84,
                              height: 84,
                              borderRadius: 42,
                              borderWidth: 2,
                              borderColor: tc.primaryBorder,
                            }}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            className="items-center justify-center rounded-full bg-primary"
                            style={{
                              width: 84,
                              height: 84,
                              borderWidth: 2,
                              borderColor: tc.primaryBorder,
                            }}
                          >
                            <Text className="font-nunito-extrabold text-3xl text-white">
                              {user?.displayName?.[0]?.toUpperCase() ?? "?"}
                            </Text>
                          </View>
                        )}
                        {editing ? (
                          <View
                            className="absolute bottom-0 right-0 h-7 w-7 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: tc.primaryDark,
                              borderWidth: 2,
                              borderColor: tc.surface,
                            }}
                          >
                            {uploadAvatarMutation.isPending ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="camera" size={14} color="#fff" />
                            )}
                          </View>
                        ) : null}
                      </Pressable>

                      <View className="flex-1 gap-1">
                        <Text
                          className="font-nunito-extrabold text-2xl text-fg"
                          numberOfLines={1}
                        >
                          {user?.displayName ?? user?.email ?? ""}
                        </Text>
                        <Text className="font-nunito text-sm text-fgMuted">
                          {user?.email}
                        </Text>
                        <Text className="font-nunito text-sm leading-5 text-fgMuted">
                          {editing
                            ? t("settings.profileEditTip")
                            : t("settings.accountIntro")}
                        </Text>
                      </View>
                    </View>

                    {editing ? (
                      <View className="gap-3">
                        <ThemedExpoTextInput
                          value={displayNameInput}
                          onChangeText={setDisplayNameInput}
                          placeholder={t("settings.displayNamePlaceholder")}
                          autoFocus
                          hostStyle={{ width: "100%" }}
                          style={{
                            backgroundColor: tc.surface,
                            borderColor: tc.primaryBorder,
                            borderRadius: 16,
                            borderWidth: 1,
                            height: 52,
                            paddingHorizontal: 16,
                            width: "100%",
                          }}
                          textStyle={{
                            color: tc.fg,
                            fontFamily: "Nunito-SemiBold",
                            fontSize: 16,
                          }}
                        />
                        <View className="flex-row gap-3">
                          <View className="flex-1">
                        <SettingsActionButton
                          compact
                          testID="settings-profile-cancel-edit"
                          onPress={() => {
                            setEditing(false);
                            setDisplayNameInput(user?.displayName ?? "");
                              }}
                              tc={tc}
                              variant="secondary"
                            >
                              {t("settings.cancelEdit")}
                            </SettingsActionButton>
                          </View>
                          <View className="flex-1">
                            <SettingsActionButton
                              compact
                              testID="settings-profile-save-display-name"
                              onPress={() =>
                                void updateDisplayNameMutation.mutateAsync(
                                  displayNameValue,
                                )
                              }
                              disabled={!canSaveDisplayName}
                              loading={updateDisplayNameMutation.isPending}
                              tc={tc}
                              variant="primary"
                            >
                              {t("settings.saveDisplayName")}
                            </SettingsActionButton>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View className="w-full pt-1">
                        <SettingsActionButton
                          compact
                          testID="settings-profile-edit"
                          onPress={() => {
                            setDisplayNameInput(user?.displayName ?? "");
                            setEditing(true);
                          }}
                          tc={tc}
                          variant="secondary"
                        >
                          {t("settings.edit")}
                        </SettingsActionButton>
                      </View>
                    )}

                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <SummaryChip
                          label={t("settings.language")}
                          value={
                            currentLanguage === "fr"
                              ? t("settings.french")
                              : t("settings.english")
                          }
                          tone="neutral"
                          tc={tc}
                        />
                      </View>
                      <View className="flex-1">
                        <SummaryChip
                          label={t("settings.theme")}
                          value={t(`settings.themeNames.${themeName}`)}
                          tone="primary"
                          tc={tc}
                        />
                      </View>
                      <View className="flex-1">
                        <SummaryChip
                          label={t("settings.stepSource")}
                          value={t(`settings.stepSources.${currentStepSource}`)}
                          tone="neutral"
                          tc={tc}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              </View>

            <View className="gap-4">
              <SectionHeader
                icon="sparkles-outline"
                title={t("settings.preferencesTitle")}
                description={t("settings.preferencesIntro")}
                tc={tc}
              />

              <SurfaceCard tc={tc}>
                <View className="gap-3">
                  <View className="gap-1">
                    <Text className="font-nunito-bold text-lg text-fg">
                      {t("settings.language")}
                    </Text>
                    <Text className="font-nunito text-sm leading-5 text-fgMuted">
                      {t("settings.languageHelp")}
                    </Text>
                  </View>
                  <View className="flex-row gap-3">
                    {LANGUAGE_OPTIONS.map((language) => {
                      const selected = currentLanguage === language;
                      return (
                        <ChoiceCard
                          key={language}
                          selected={selected}
                          disabled={updateLanguageMutation.isPending}
                          testID={`settings-language-${language}`}
                          onPress={() =>
                            void updateLanguageMutation.mutateAsync(language)
                          }
                          tc={tc}
                        >
                          <View className="gap-2">
                            <View className="flex-row items-center justify-between">
                              <Text
                                className={`font-nunito-bold text-base ${
                                  selected ? "text-accentStrong" : "text-fg"
                                }`}
                              >
                                {language === "fr"
                                  ? t("settings.french")
                                  : t("settings.english")}
                              </Text>
                              {selected ? (
                                <Ionicons
                                  name="checkmark-circle"
                                  size={18}
                                  color={tc.primaryText}
                                />
                              ) : null}
                            </View>
                            <Text className="font-nunito text-xs uppercase text-fgMuted">
                              {language.toUpperCase()}
                            </Text>
                          </View>
                        </ChoiceCard>
                      );
                    })}
                  </View>
                </View>
              </SurfaceCard>

              <SurfaceCard tc={tc}>
                <View className="gap-4">
                  <View className="gap-1">
                    <Text className="font-nunito-bold text-lg text-fg">
                      {t("settings.theme")}
                    </Text>
                    <Text className="font-nunito text-sm leading-5 text-fgMuted">
                      {t("settings.themeHelp")}
                    </Text>
                  </View>
                  <View className="gap-3">
                    {THEME_OPTIONS.map((name) => {
                      const selected = themeName === name;
                      return (
                        <ChoiceCard
                          key={name}
                          selected={selected}
                          testID={`settings-theme-${name}`}
                          onPress={() => void setTheme(name)}
                          tc={tc}
                        >
                          <View className="flex-row items-center gap-3">
                            <ThemePreview themeName={name} />
                            <View className="flex-1">
                              <Text
                                className={`font-nunito-bold text-base ${
                                  selected ? "text-primaryStrong" : "text-fg"
                                }`}
                                testID={`settings-theme-${name}-label`}
                              >
                                {t(`settings.themeNames.${name}`)}
                              </Text>
                              <Text
                                className="font-nunito text-sm text-fgMuted"
                                testID={`settings-theme-${name}-preview`}
                              >
                                {t("settings.themePreview")}
                              </Text>
                            </View>
                            {selected ? (
                              <Ionicons
                                name="checkmark-circle"
                                size={20}
                                color={tc.primaryText}
                              />
                            ) : null}
                          </View>
                        </ChoiceCard>
                      );
                    })}
                  </View>
                </View>
              </SurfaceCard>
            </View>

            <View className="gap-4">
              <SectionHeader
                icon="footsteps-outline"
                title={t("settings.activityTitle")}
                description={t("settings.activityIntro")}
                tc={tc}
              />

              <SurfaceCard tc={tc}>
                <View className="gap-4">
                  <View className="gap-1">
                    <Text className="font-nunito-bold text-lg text-fg">
                      {t("settings.stepSource")}
                    </Text>
                    <Text className="font-nunito text-sm leading-5 text-fgMuted">
                      {t("settings.stepSourceHelp")}
                    </Text>
                  </View>
                  <View className="gap-3">
                    {STEP_SOURCE_OPTIONS.map((source) => {
                      const selected = currentStepSource === source;
                      const isFitbitSource = source === "fitbit";
                      return (
                        <ChoiceCard
                          key={source}
                          selected={selected}
                          disabled={updateSourceMutation.isPending}
                          testID={`settings-step-source-${source}`}
                          onPress={() => {
                            if (isFitbitSource) {
                              void handleChooseFitbit();
                              return;
                            }

                            setFitbitError(null);
                            void updateSourceMutation.mutateAsync("device_health");
                          }}
                          tc={tc}
                        >
                          <View className="gap-2">
                            <View className="flex-row items-center justify-between gap-3">
                              <View className="flex-1 gap-1">
                                <Text
                                  className="font-nunito-bold text-base text-fg"
                                >
                                  {t(`settings.stepSources.${source}`)}
                                </Text>
                                <Text className="font-nunito text-sm leading-5 text-fgMuted">
                                  {isFitbitSource
                                    ? fitbitConnected
                                      ? t("settings.fitbitConnectedHelp")
                                      : t("settings.fitbitHelp")
                                    : t("settings.useDeviceHealth", {
                                        healthSystem: healthSystemLabel,
                                      })}
                                </Text>
                              </View>
                              {selected ? (
                                <View className="self-stretch items-center justify-center">
                                  <Ionicons
                                    name="checkmark-circle"
                                    size={20}
                                    color={tc.primaryText}
                                  />
                                </View>
                              ) : null}
                            </View>
                          </View>
                        </ChoiceCard>
                      );
                    })}
                  </View>
                </View>
              </SurfaceCard>

              <SurfaceCard tc={tc}>
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="font-nunito-bold text-lg text-fg">
                      {t("settings.syncOverview")}
                    </Text>
                    <Text className="font-nunito text-sm leading-5 text-fgMuted">
                      {syncSummary}
                    </Text>
                  </View>

                  <ToneBanner tone={syncTone} tc={tc}>
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-1 gap-1">
                        <Text className="font-nunito-semibold text-xs uppercase text-fgMuted">
                          {syncStatusLabel}
                        </Text>
                        <Text className="font-nunito-extrabold text-xl text-fg">
                          {syncStatusValue}
                        </Text>
                      </View>
                      <Ionicons
                        name={syncTone === "success" ? "checkmark-circle" : "pulse"}
                        size={24}
                        color={toneColors(tc, syncTone).text}
                      />
                    </View>
                  </ToneBanner>

                  <View className="gap-3 rounded-[26px] bg-surfaceMuted p-3">
                    <View className="flex-row gap-3">
                      <StatTile
                        label={t("settings.latestSyncedLabel")}
                        value={t("settings.stepCountValue", {
                          count: stepQuery.data?.latest?.stepCount ?? 0,
                        })}
                        tone="neutral"
                        tc={tc}
                      />
                      <StatTile
                        label={t("settings.deviceTodayLabel")}
                        value={t("settings.stepCountValue", {
                          count: stepSync.deviceStepCount ?? 0,
                        })}
                        tone="neutral"
                        tc={tc}
                      />
                    </View>
                    <View className="flex-row gap-3">
                      <StatTile
                        label={t("settings.recordedFor")}
                        value={recordedForDate ?? "—"}
                        tone="neutral"
                        tc={tc}
                      />
                      <StatTile
                        label={t("settings.lastUpdated")}
                        value={latestSyncedDate ?? "—"}
                        tone="neutral"
                        tc={tc}
                      />
                    </View>
                  </View>

                  <View className="flex-row justify-center gap-3 px-4">
                    <View className="w-[148px]">
                      <SummaryChip
                        label={t("settings.sourceLabel")}
                        value={t(`settings.stepSources.${latestStepSource}`)}
                        tone="neutral"
                        tc={tc}
                      />
                    </View>
                    <View className="w-[148px]">
                      <SummaryChip
                        label={t("settings.goalNotificationsLabel")}
                        value={notificationStatusLabel}
                        tone="neutral"
                        tc={tc}
                      />
                    </View>
                  </View>

                  {stepSync.lastError ? (
                    <ToneBanner tone="danger" tc={tc}>
                      <Text className="font-nunito-semibold text-sm leading-5 text-dangerText">
                        {stepSync.lastError}
                      </Text>
                    </ToneBanner>
                  ) : null}

                  {fitbitError ? (
                    <ToneBanner tone="danger" tc={tc}>
                      <Text className="font-nunito-semibold text-sm leading-5 text-dangerText">
                        {fitbitError}
                      </Text>
                    </ToneBanner>
                  ) : null}

                  <SettingsActionButton
                    compact
                    testID="settings-step-sync-action"
                    onPress={() => {
                      void handleStepAction();
                    }}
                    loading={stepSync.isSyncing || isConnectingFitbit}
                    tc={tc}
                    variant="surface"
                  >
                    {stepActionLabel}
                  </SettingsActionButton>
                </View>
              </SurfaceCard>
            </View>

            <View
              className="gap-4"
              onLayout={(event) => {
                setNotificationsSectionY(event.nativeEvent.layout.y);
              }}
            >
              <SectionHeader
                icon="notifications-outline"
                title={t("settings.notificationsTitle")}
                description={t("settings.notificationsIntro")}
                tc={tc}
              />

              <SurfaceCard tc={tc}>
                <View className="gap-5">
                  <View className="gap-1">
                    <Text className="font-nunito-bold text-lg text-fg">
                      {t("settings.notificationsPreferencesTitle")}
                    </Text>
                    <Text className="font-nunito text-sm leading-5 text-fgMuted">
                      {t("settings.notificationsPreferencesHelp")}
                    </Text>
                  </View>

                  <ToneBanner
                    tone={
                      stepSync.notificationPermissionStatus === "granted"
                        ? "success"
                        : "neutral"
                    }
                    tc={tc}
                  >
                    <View className="gap-4">
                      <View className="gap-1">
                        <Text className="font-nunito-semibold text-xs uppercase text-fgMuted">
                          {t("settings.notificationsPermissionLabel")}
                        </Text>
                        <Text className="font-nunito-extrabold text-xl text-fg">
                          {notificationStatusLabel}
                        </Text>
                        <Text className="font-nunito text-sm leading-5 text-fgMuted">
                          {notificationPermissionSummary}
                        </Text>
                      </View>

                      {stepSync.notificationPermissionStatus !== "granted" ? (
                        <View className="self-start">
                          <SettingsActionButton
                            compact
                            fullWidth={false}
                            testID="settings-notification-permission-action"
                            onPress={() => void handleNotificationPermissionAction()}
                            tc={tc}
                            variant="secondary"
                          >
                            {notificationPermissionCta}
                          </SettingsActionButton>
                        </View>
                      ) : null}
                    </View>
                  </ToneBanner>

                  <View className="gap-3">
                    <SettingsToggleRow
                      title={t("settings.notificationOptions.dailyReset.title")}
                      description={t(
                        "settings.notificationOptions.dailyReset.description",
                      )}
                      testIDPrefix="settings-notification-dailyReset"
                      value={notificationPreferences.dailyReset}
                      disabled={updateNotificationPreferencesMutation.isPending}
                      onToggle={(value) => {
                        void handleNotificationPreferenceToggle("dailyReset", value);
                      }}
                      tc={tc}
                    />
                    <SettingsToggleRow
                      title={t("settings.notificationOptions.stepGoal.title")}
                      description={t(
                        "settings.notificationOptions.stepGoal.description",
                      )}
                      testIDPrefix="settings-notification-stepGoal"
                      value={notificationPreferences.stepGoal}
                      disabled={updateNotificationPreferencesMutation.isPending}
                      onToggle={(value) => {
                        void handleNotificationPreferenceToggle("stepGoal", value);
                      }}
                      tc={tc}
                    />
                    <SettingsToggleRow
                      title={t("settings.notificationOptions.pvpInvite.title")}
                      description={t(
                        "settings.notificationOptions.pvpInvite.description",
                      )}
                      testIDPrefix="settings-notification-pvpInvite"
                      value={notificationPreferences.pvpInvite}
                      disabled={updateNotificationPreferencesMutation.isPending}
                      onToggle={(value) => {
                        void handleNotificationPreferenceToggle("pvpInvite", value);
                      }}
                      tc={tc}
                    />
                    <SettingsToggleRow
                      title={t("settings.notificationOptions.pvpTurn.title")}
                      description={t(
                        "settings.notificationOptions.pvpTurn.description",
                      )}
                      testIDPrefix="settings-notification-pvpTurn"
                      value={notificationPreferences.pvpTurn}
                      disabled={updateNotificationPreferencesMutation.isPending}
                      onToggle={(value) => {
                        void handleNotificationPreferenceToggle("pvpTurn", value);
                      }}
                      tc={tc}
                    />
                    <SettingsToggleRow
                      title={t("settings.notificationOptions.giftReceived.title")}
                      description={t(
                        "settings.notificationOptions.giftReceived.description",
                      )}
                      testIDPrefix="settings-notification-giftReceived"
                      value={notificationPreferences.giftReceived}
                      disabled={updateNotificationPreferencesMutation.isPending}
                      onToggle={(value) => {
                        void handleNotificationPreferenceToggle("giftReceived", value);
                      }}
                      tc={tc}
                    />
                  </View>

                  {notificationError ? (
                    <ToneBanner tone="danger" tc={tc}>
                      <Text className="font-nunito-semibold text-sm leading-5 text-dangerText">
                        {notificationError}
                      </Text>
                    </ToneBanner>
                  ) : null}
                </View>
              </SurfaceCard>
            </View>

            <View className="gap-4">
              <SectionHeader
                icon="shield-checkmark-outline"
                title={t("settings.sessionTitle")}
                description={t("settings.sessionIntro")}
                tc={tc}
              />
              <SurfaceCard tc={tc}>
                <View className="gap-4">
                  <Text className="font-nunito text-sm leading-5 text-fgMuted">
                    {t("settings.sessionHelp")}
                  </Text>
                  <SettingsActionButton
                    compact
                    testID="settings-logout-action"
                    onPress={() =>
                      void clearAppSession().then(() => router.replace("/login"))
                    }
                    leadingAccessory={
                      <View
                        className="items-center justify-center"
                        style={{ width: 16, height: 16 }}
                      >
                        <Ionicons name="log-out" size={16} color="#FFFFFF" />
                      </View>
                    }
                    tc={tc}
                    variant="danger"
                  >
                    {t("home.logout")}
                  </SettingsActionButton>
                </View>
              </SurfaceCard>
            </View>
          </View>
          </ScrollView>
        </View>
      </KeyboardScreenView>
    </ModalSheetRoute>
  );
}

function SectionHeader({
  description,
  icon,
  tc,
  title,
}: {
  description: string;
  icon: IoniconName;
  tc: (typeof THEME_COLORS)[ThemeName];
  title: string;
}) {
  return (
    <View className="flex-row items-start gap-3 px-1">
      <Ionicons name={icon} size={20} color={tc.primaryText} />
      <View className="flex-1 gap-1">
        <Text className="font-nunito-bold text-xl text-fg">{title}</Text>
        <Text className="font-nunito text-sm leading-5 text-fgMuted">
          {description}
        </Text>
      </View>
    </View>
  );
}

function SurfaceCard({
  children,
  tc,
}: {
  children: ReactNode;
  tc: (typeof THEME_COLORS)[ThemeName];
}) {
  return (
    <View
      className="rounded-3xl border border-primaryBorder bg-surface p-5"
      style={{
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}
    >
      {children}
    </View>
  );
}

function ChoiceCard({
  children,
  disabled,
  onPress,
  selected,
  testID,
  tc,
}: {
  children: ReactNode;
  disabled?: boolean;
  onPress: () => void;
  selected: boolean;
  testID?: string;
  tc: (typeof THEME_COLORS)[ThemeName];
}) {
  return (
    <ThemedExpoButton
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      fallbackAppearance={{
        backgroundColor: selected ? tc.primaryBg : tc.surface,
        borderColor: tc.primaryBorder,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 16,
        gradientColors: null,
      }}
      fallbackLayout="stretch"
      preserveChildLayout
      style={{
        flex: 1,
        opacity: disabled ? 0.65 : 1,
      }}
      variant="ghost"
    >
      {children}
    </ThemedExpoButton>
  );
}

function ThemePreview({ themeName }: { themeName: ThemeName }) {
  const preview = THEME_COLORS[themeName];

  return (
    <View className="flex-row gap-1">
      <View
        className="h-4 w-4 rounded-full"
        style={{ backgroundColor: preview.primary }}
      />
      <View
        className="h-4 w-4 rounded-full"
        style={{ backgroundColor: preview.secondary }}
      />
      <View
        className="h-4 w-4 rounded-full"
        style={{ backgroundColor: preview.accent }}
      />
    </View>
  );
}

function SummaryChip({
  label,
  tc,
  tone,
  value,
}: {
  label: string;
  tc: (typeof THEME_COLORS)[ThemeName];
  tone: ToneName;
  value: string;
}) {
  const colors = toneColors(tc, tone);

  return (
    <View
      className="min-w-[104px] rounded-2xl px-4 py-3"
      style={{
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text className="font-nunito-semibold text-xs text-fgMuted">{label}</Text>
      <Text
        className="mt-1 font-nunito-bold text-sm"
        style={{ color: colors.text }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function SettingsToggleRow({
  description,
  disabled,
  onToggle,
  testIDPrefix,
  tc,
  title,
  value,
}: {
  description: string;
  disabled?: boolean;
  onToggle: (nextValue: boolean) => void;
  testIDPrefix?: string;
  tc: (typeof THEME_COLORS)[ThemeName];
  title: string;
  value: boolean;
}) {
  return (
    <ThemedExpoButton
      onPress={() => onToggle(!value)}
      disabled={disabled}
      fallbackAppearance={{
        backgroundColor: tc.surfaceMuted,
        borderColor: tc.primaryBorder,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 16,
        gradientColors: null,
      }}
      fallbackLayout="stretch"
      preserveChildLayout
      style={{ opacity: disabled ? 0.65 : 1 }}
      variant="ghost"
    >
      <View className="flex-row items-start gap-4">
        <View className="flex-1 gap-1">
          <Text
            className="font-nunito-bold text-base text-fg"
            testID={testIDPrefix ? `${testIDPrefix}-title` : undefined}
          >
            {title}
          </Text>
          <Text
            className="font-nunito text-sm leading-5 text-fgMuted"
            testID={testIDPrefix ? `${testIDPrefix}-description` : undefined}
          >
            {description}
          </Text>
        </View>
        <ThemedExpoSwitch
          disabled={disabled}
          onValueChange={onToggle}
          value={value}
        />
      </View>
    </ThemedExpoButton>
  );
}

function StatTile({
  label,
  tc,
  tone,
  value,
}: {
  label: string;
  tc: (typeof THEME_COLORS)[ThemeName];
  tone: ToneName;
  value: string;
}) {
  const colors = toneColors(tc, tone);

  return (
    <View
      className="flex-1 rounded-3xl p-4"
      style={{
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text className="font-nunito-semibold text-xs uppercase text-fgMuted">
        {label}
      </Text>
      <Text
        className="mt-2 font-nunito-extrabold text-lg"
        style={{ color: colors.text }}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function ToneBanner({
  children,
  tc,
  tone,
}: {
  children: ReactNode;
  tc: (typeof THEME_COLORS)[ThemeName];
  tone: ToneName;
}) {
  const colors = toneColors(tc, tone);

  return (
    <View
      className="rounded-3xl p-4"
      style={{
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {children}
    </View>
  );
}

function SettingsActionButton({
  children,
  compact,
  disabled,
  fullWidth = true,
  leadingAccessory,
  loading,
  onPress,
  testID,
  tc,
  variant,
}: {
  children: ReactNode;
  compact?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leadingAccessory?: ReactNode;
  loading?: boolean;
  onPress: () => void;
  testID?: string;
  tc: (typeof THEME_COLORS)[ThemeName];
  variant: "primary" | "secondary" | "surface" | "danger";
}) {
  const isPrimary = variant === "primary";
  const isSurface = variant === "surface";
  const isDanger = variant === "danger";

  return (
    <ThemedExpoButton
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      leadingAccessory={leadingAccessory}
      preferFallback
      testID={testID}
      variant={isDanger ? "danger" : isPrimary ? "primary" : "ghost"}
      fallbackAppearance={{
        backgroundColor: isDanger
          ? tc.dangerDark
          : isPrimary
          ? tc.primary
          : isSurface
            ? tc.surfaceMuted
            : tc.primaryBg,
        borderColor: isDanger
          ? tc.dangerDark
          : isPrimary
            ? tc.primaryDark
            : tc.primaryBorder,
        borderRadius: compact ? 14 : 14,
        height: compact ? 34 : 30,
        paddingHorizontal: compact ? 16 : 14,
        paddingVertical: 0,
        minHeight: compact ? 34 : 30,
        gradientColors: isDanger
          ? ([tc.dangerDark, tc.danger] as const)
          : isPrimary
          ? ([tc.primary, tc.primaryDark] as const)
          : null,
        foregroundColor: isPrimary || isDanger ? "#FFFFFF" : tc.primaryStrong,
        textStyle: {
          fontFamily: "Nunito_700Bold",
          fontSize: compact ? 13 : 12,
          lineHeight: compact ? 16 : 14,
        },
      }}
      style={fullWidth ? { width: "100%" } : undefined}
    >
      {children}
    </ThemedExpoButton>
  );
}

function toneColors(tc: (typeof THEME_COLORS)[ThemeName], tone: ToneName) {
  switch (tone) {
    case "success":
      return {
        bg: tc.successTint,
        border: tc.successBorder,
        text: tc.successText,
      };
    case "danger":
      return {
        bg: tc.dangerTint,
        border: tc.dangerBorder,
        text: tc.dangerText,
      };
    case "neutral":
      return {
        bg: tc.surfaceMuted,
        border: tc.primaryBorder,
        text: tc.fg,
      };
    case "primary":
    default:
      return {
        bg: tc.primaryBg,
        border: tc.primaryBorder,
        text: tc.primaryText,
      };
  }
}

function formatSettingsDate(value: string | null, locale: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRecordedForDate(value: string | null, locale: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
