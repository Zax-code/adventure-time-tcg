import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import type { LucideIcon } from "lucide-react-native";
import Activity from "lucide-react-native/icons/activity";
import Bell from "lucide-react-native/icons/bell";
import Camera from "lucide-react-native/icons/camera";
import Candy from "lucide-react-native/icons/candy";
import CircleCheck from "lucide-react-native/icons/circle-check";
import ExternalLink from "lucide-react-native/icons/external-link";
import Footprints from "lucide-react-native/icons/footprints";
import Gift from "lucide-react-native/icons/gift";
import HeartPulse from "lucide-react-native/icons/heart-pulse";
import Hourglass from "lucide-react-native/icons/hourglass";
import KeyRound from "lucide-react-native/icons/key-round";
import Lock from "lucide-react-native/icons/lock";
import LogOut from "lucide-react-native/icons/log-out";
import Moon from "lucide-react-native/icons/moon";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import Snowflake from "lucide-react-native/icons/snowflake";
import Sunrise from "lucide-react-native/icons/sunrise";
import Swords from "lucide-react-native/icons/swords";
import Trash from "lucide-react-native/icons/trash";
import Watch from "lucide-react-native/icons/watch";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ON_PRIMARY } from "@adventure-time/theme";

import { KEYBOARD_AWARE_SCROLL_PROPS } from "../src/components/keyboard-aware-scroll-props";
import { KeyboardScreenView } from "../src/components/keyboard-screen-view";
import { ModalSheetRoute } from "../src/components/modal-sheet-route";
import { Button } from "../src/components/ui/button";
import { Card } from "../src/components/ui/card";
import { Chip } from "../src/components/ui/chip";
import { IconTile } from "../src/components/ui/icon-tile";
import { Input } from "../src/components/ui/input";
import { Notice } from "../src/components/ui/notice";
import { SectionHeader } from "../src/components/ui/section-header";
import { SegmentedControl } from "../src/components/ui/segmented-control";
import { ICON_STROKE_WIDTH } from "../src/components/ui/tokens";
import {
  CardTitle,
  CompactStat,
  SelectList,
  SelectRow,
  ToggleRow,
} from "../src/features/settings/settings-rows";
import { useTranslation } from "../src/i18n";
import {
  apiClient,
  API_BASE_URL,
  ApiClientError,
  clearAppSession,
} from "../src/lib/api";
import {
  ensureAppNotificationPermission,
  getNotificationPermissionStatus,
} from "../src/lib/app-notifications";
import { connectFitbit } from "../src/lib/fitbit";
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
const THEME_ICONS: Record<ThemeName, LucideIcon> = {
  candy: Candy,
  ice: Snowflake,
  nightosphere: Moon,
};
const PRIVACY_POLICY_URL = `${API_BASE_URL}/privacy`;
const ACCOUNT_DELETION_URL = `${API_BASE_URL}/account-deletion`;

type StepSource = (typeof STEP_SOURCE_OPTIONS)[number];
type NotificationPreferenceKey =
  | "dailyReset"
  | "stepGoal"
  | "pvpInvite"
  | "pvpTurn"
  | "giftReceived";

const NOTIFICATION_ROWS: {
  key: NotificationPreferenceKey;
  icon: LucideIcon;
}[] = [
  { key: "dailyReset", icon: Sunrise },
  { key: "stepGoal", icon: Footprints },
  { key: "pvpInvite", icon: Swords },
  { key: "pvpTurn", icon: Hourglass },
  { key: "giftReceived", icon: Gift },
];

function getStepSourceLabel({
  healthSystemLabel,
  source,
  t,
}: {
  healthSystemLabel: string;
  source: StepSource;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  if (source === "device_health") {
    return healthSystemLabel;
  }

  return t(`settings.stepSources.${source}`);
}

export default function SettingsScreen() {
  return useSettingsScreenView();
}

function useSettingsScreenView() {
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
  const stepSync = useStepSyncStore(
    useShallow((state) => ({
      availability: state.availability,
      deviceStepCount: state.deviceStepCount,
      healthPermissionStatus: state.healthPermissionStatus,
      isSyncing: state.isSyncing,
      lastError: state.lastError,
      notificationPermissionStatus: state.notificationPermissionStatus,
    })),
  );
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
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const notificationsSectionYRef = useRef<number | null>(null);

  const { data: stepQueryData, refetch: stepQueryRefetch } = useQuery({
    queryKey: ["health-steps"],
    queryFn: () => apiClient.getHealthSteps(),
    enabled: Boolean(user),
  });

  const { data: fitbitStatusQueryData, refetch: fitbitStatusQueryRefetch } = useQuery({
    queryKey: ["fitbit-status"],
    queryFn: () => apiClient.fitbitStatus(),
    enabled: Boolean(user),
  });

  const updateSourceMutation = useMutation({
    mutationFn: (preferredStepSource: "device_health" | "fitbit") =>
      apiClient.updateStepSource({ preferredStepSource }),
    onSuccess: async (nextUser) => {
      await Promise.all([
        setUser(nextUser),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
        queryClient.invalidateQueries({ queryKey: ["health-steps"] }),
      ]);
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

  const changePasswordMutation = useMutation({
    mutationFn: (input: {
      currentPassword?: string;
      newPassword: string;
      mode: "create" | "change";
    }) =>
      apiClient.changePassword({
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      }),
    onSuccess: async (nextUser, input) => {
      await setUser(nextUser);
      await queryClient.invalidateQueries({ queryKey: ["home"] });
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      setPasswordStatus({
        type: "success",
        message:
          input.mode === "create"
            ? t("settings.passwordCreated")
            : t("settings.passwordUpdated"),
      });
    },
    onError: (error) => {
      setPasswordStatus({
        type: "error",
        message: settingsErrorMessage(error, t("settings.passwordChangeFailed")),
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => apiClient.deleteAccount(),
    onSuccess: async () => {
      await clearAppSession();
      queryClient.clear();
      router.replace("/login");
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
  const authMethods = user?.authMethods ?? {
    password: false,
    google: false,
    apple: false,
  };
  const hasPasswordAuth = authMethods.password;
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
  const fitbitConnected = fitbitStatusQueryData?.connected ?? false;
  const prefersFitbit = currentStepSource === "fitbit";
  const displayNameValue = displayNameInput.trim();
  const canSaveDisplayName =
    displayNameValue.length > 0 &&
    displayNameValue !== (user?.displayName ?? "").trim();
  const latestStepSource = stepQueryData?.latest?.source ?? currentStepSource;
  const currentStepSourceLabel = getStepSourceLabel({
    healthSystemLabel,
    source: currentStepSource,
    t,
  });
  const latestStepSourceLabel = getStepSourceLabel({
    healthSystemLabel,
    source: latestStepSource,
    t,
  });
  const latestSyncedDate = formatSettingsDate(
    stepQueryData?.latest?.updatedAt ?? null,
    currentLanguage,
  );
  const recordedForDate = formatRecordedForDate(
    stepQueryData?.latest?.recordedFor ?? null,
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
  const syncHealthy = prefersFitbit
    ? fitbitConnected
    : stepSync.healthPermissionStatus === "granted";
  const notificationsGranted =
    stepSync.notificationPermissionStatus === "granted";
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
  const passwordSubmitDisabled =
    changePasswordMutation.isPending ||
    newPasswordInput.length < 8 ||
    confirmPasswordInput.length === 0 ||
    (hasPasswordAuth && currentPasswordInput.length === 0);
  const authMethodChips = [
    authMethods.password ? t("settings.authMethods.password") : null,
    authMethods.google ? t("settings.authMethods.google") : null,
    authMethods.apple ? t("settings.authMethods.apple") : null,
  ].filter((label): label is string => label !== null);

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

  const scrollToNotificationsSection = useCallback(() => {
    const notificationsSectionY = notificationsSectionYRef.current;
    if (notificationsSectionY === null) {
      return;
    }

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(notificationsSectionY - 20, 0),
        animated: true,
      });
    });
  }, []);

  useEffect(() => {
    if (params.section !== "notifications") {
      return;
    }

    scrollToNotificationsSection();
  }, [params.section, scrollToNotificationsSection]);

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
          fitbitStatusQueryRefetch(),
          stepQueryRefetch(),
          queryClient.invalidateQueries({ queryKey: ["quests"] }),
        ]);
        return;
      }

      await Promise.all([
        fitbitStatusQueryRefetch(),
        stepQueryRefetch(),
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

  const handleChooseFitbit = () => {
    setFitbitError(null);

    if (fitbitConnected) {
      updateSourceMutation.mutate("fitbit");
      return;
    }

    updateSourceMutation.mutate("fitbit", {
      onSuccess: async () => {
        setIsConnectingFitbit(true);
        try {
          const result = await connectFitbit("/settings");

          if (result.type === "error") {
            setFitbitError(t("settings.fitbitConnectFailed"));
          }

          await Promise.all([
            fitbitStatusQueryRefetch(),
            stepQueryRefetch(),
            queryClient.invalidateQueries({ queryKey: ["quests"] }),
          ]);
        } catch {
          setFitbitError(t("settings.fitbitConnectFailed"));
        } finally {
          setIsConnectingFitbit(false);
        }
      },
      onError: () => {
        setFitbitError(t("settings.fitbitConnectFailed"));
      },
    });
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

    updateNotificationPreferencesMutation.mutate({
      ...notificationPreferences,
      [key]: nextValue,
    });
  };

  const handlePasswordSubmit = () => {
    setPasswordStatus(null);

    if (hasPasswordAuth && currentPasswordInput.length === 0) {
      setPasswordStatus({
        type: "error",
        message: t("settings.currentPasswordRequired"),
      });
      return;
    }

    if (newPasswordInput.length < 8) {
      setPasswordStatus({
        type: "error",
        message: t("settings.passwordTooShort"),
      });
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordStatus({
        type: "error",
        message: t("settings.passwordMismatch"),
      });
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: hasPasswordAuth ? currentPasswordInput : undefined,
      newPassword: newPasswordInput,
      mode: hasPasswordAuth ? "change" : "create",
    });
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      t("settings.deleteAccountConfirmTitle"),
      t("settings.deleteAccountConfirmBody"),
      [
        { text: t("settings.deleteAccountCancel"), style: "cancel" },
        {
          text: t("settings.deleteAccountConfirmAction"),
          style: "destructive",
          onPress: () => {
            deleteAccountMutation.mutate();
          },
        },
      ],
    );
  };

  return (
    <ModalSheetRoute
      onClose={() => router.back()}
      sheetBackgroundColor={tc.bg}
      sheetStyle={THEME_VARS[themeName]}
      title={t("settings.title")}
      subtitle={t("settings.subtitle")}
    >
      <KeyboardScreenView style={THEME_VARS[themeName]}>
        <View className="flex-1 bg-bg">
          <ScrollView
            ref={scrollViewRef}
            {...KEYBOARD_AWARE_SCROLL_PROPS}
            className="flex-1"
            contentContainerStyle={{
              padding: 16,
              paddingBottom: 40,
            }}
            contentInset={{ bottom: insets.bottom }}
            scrollIndicatorInsets={{ bottom: insets.bottom }}
          >
            <View className="gap-ds-3">
              <Card>
                <View className="flex-row items-center gap-ds-3">
                  <Pressable
                    onPress={() =>
                      editing ? uploadAvatarMutation.mutate() : undefined
                    }
                    disabled={!editing || uploadAvatarMutation.isPending}
                    accessibilityRole={editing ? "button" : undefined}
                    accessibilityLabel={
                      editing ? t("settings.profileEditTip") : undefined
                    }
                    className="relative"
                  >
                    {avatarUri ? (
                      <Image
                        source={{
                          uri: avatarUri,
                          headers: { Authorization: `Bearer ${accessToken}` },
                        }}
                        style={{ width: 56, height: 56, borderRadius: 28 }}
                        contentFit="cover"
                      />
                    ) : (
                      <View className="h-[56px] w-[56px] items-center justify-center rounded-ds-pill bg-primary">
                        <Text className="font-nunito-extrabold text-[24px] leading-[33px] text-white">
                          {user?.displayName?.[0]?.toUpperCase() ?? "?"}
                        </Text>
                      </View>
                    )}
                    {editing ? (
                      <View className="absolute -bottom-1 -right-1 h-[24px] w-[24px] items-center justify-center rounded-ds-pill border-2 border-surface bg-primaryDark">
                        {uploadAvatarMutation.isPending ? (
                          <ActivityIndicator size="small" color={ON_PRIMARY} />
                        ) : (
                          <Camera
                            size={12}
                            color={ON_PRIMARY}
                            strokeWidth={ICON_STROKE_WIDTH}
                          />
                        )}
                      </View>
                    ) : null}
                  </Pressable>

                  <View className="flex-1 gap-[2px]">
                    <Text
                      className="font-nunito-extrabold text-ds-h3 text-fg"
                      numberOfLines={1}
                    >
                      {user?.displayName ?? user?.email ?? ""}
                    </Text>
                    <Text
                      className="font-nunito text-ds-sm text-fgMuted"
                      numberOfLines={1}
                    >
                      {user?.email}
                    </Text>
                  </View>

                  {editing ? null : (
                    <Button
                      tone="ghost"
                      size="sm"
                      testID="settings-profile-edit"
                      onPress={() => {
                        setDisplayNameInput(user?.displayName ?? "");
                        setEditing(true);
                      }}
                    >
                      {t("settings.edit")}
                    </Button>
                  )}
                </View>

                {editing ? (
                  <View className="gap-ds-3">
                    <Text className="font-nunito text-ds-sm text-fgMuted">
                      {t("settings.profileEditTip")}
                    </Text>
                    <Input
                      value={displayNameInput}
                      onChangeText={setDisplayNameInput}
                      placeholder={t("settings.displayNamePlaceholder")}
                      autoFocus
                    />
                    <View className="flex-row gap-ds-3">
                      <Button
                        tone="ghost"
                        size="sm"
                        className="flex-1"
                        testID="settings-profile-cancel-edit"
                        onPress={() => {
                          setEditing(false);
                          setDisplayNameInput(user?.displayName ?? "");
                        }}
                      >
                        {t("settings.cancelEdit")}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        testID="settings-profile-save-display-name"
                        onPress={() =>
                          updateDisplayNameMutation.mutate(displayNameValue)
                        }
                        disabled={!canSaveDisplayName}
                        loading={updateDisplayNameMutation.isPending}
                      >
                        {t("settings.saveDisplayName")}
                      </Button>
                    </View>
                  </View>
                ) : null}

                <View className="flex-row gap-ds-3">
                  <CompactStat
                    label={t("settings.language")}
                    value={t(`settings.languageNames.${currentLanguage}`)}
                  />
                  <CompactStat
                    label={t("settings.theme")}
                    value={t(`settings.themeNames.${themeName}`)}
                  />
                  <CompactStat
                    label={t("settings.stepsLabel")}
                    value={currentStepSourceLabel}
                  />
                </View>
              </Card>

              <SectionHeader
                title={t("settings.preferencesTitle")}
                subtitle={t("settings.preferencesIntro")}
              />

              <Card>
                <CardTitle>{t("settings.language")}</CardTitle>
                <SegmentedControl
                  value={currentLanguage}
                  onChange={(language) => {
                    if (
                      language === currentLanguage ||
                      updateLanguageMutation.isPending
                    ) {
                      return;
                    }
                    updateLanguageMutation.mutate(language);
                  }}
                  options={LANGUAGE_OPTIONS.map((language) => ({
                    value: language,
                    label: t(`settings.languageNames.${language}`),
                    testID: `settings-language-${language}`,
                  }))}
                />
              </Card>

              <Card>
                <CardTitle>{t("settings.theme")}</CardTitle>
                <SelectList>
                  {THEME_OPTIONS.map((name, index) => (
                    <SelectRow
                      key={name}
                      icon={THEME_ICONS[name]}
                      title={t(`settings.themeNames.${name}`)}
                      meta={t(`settings.themeDescriptions.${name}`)}
                      selected={themeName === name}
                      divider={index < THEME_OPTIONS.length - 1}
                      testID={`settings-theme-${name}`}
                      titleTestID={`settings-theme-${name}-label`}
                      onPress={() => void setTheme(name)}
                    />
                  ))}
                </SelectList>
              </Card>

              <SectionHeader
                className="mt-ds-3"
                title={t("settings.activityTitle")}
                subtitle={t("settings.activityIntro")}
              />

              <Card>
                <View className="gap-[2px]">
                  <CardTitle>{t("settings.stepSource")}</CardTitle>
                  <Text className="font-nunito text-ds-sm text-fgMuted">
                    {t("settings.stepSourceHelp")}
                  </Text>
                </View>
                <SelectList>
                  {STEP_SOURCE_OPTIONS.map((source, index) => {
                    const isFitbitSource = source === "fitbit";
                    return (
                      <SelectRow
                        key={source}
                        icon={isFitbitSource ? Watch : HeartPulse}
                        title={getStepSourceLabel({
                          healthSystemLabel,
                          source,
                          t,
                        })}
                        meta={
                          isFitbitSource
                            ? fitbitConnected
                              ? t("settings.fitbitConnectedHelp")
                              : t("settings.fitbitHelp")
                            : t("settings.useDeviceHealth", {
                                healthSystem: healthSystemLabel,
                              })
                        }
                        selected={currentStepSource === source}
                        disabled={updateSourceMutation.isPending}
                        divider={index < STEP_SOURCE_OPTIONS.length - 1}
                        testID={`settings-step-source-${source}`}
                        onPress={() => {
                          if (isFitbitSource) {
                            void handleChooseFitbit();
                            return;
                          }

                          setFitbitError(null);
                          updateSourceMutation.mutate("device_health");
                        }}
                      />
                    );
                  })}
                </SelectList>
              </Card>

              <Card>
                <View className="gap-[2px]">
                  <CardTitle>{t("settings.syncOverview")}</CardTitle>
                  <Text className="font-nunito text-ds-sm text-fgMuted">
                    {syncSummary}
                  </Text>
                </View>

                <Notice
                  tone={syncHealthy ? "success" : "info"}
                  icon={syncHealthy ? CircleCheck : Activity}
                  title={`${syncStatusLabel} · ${syncStatusValue}`}
                />

                <View className="flex-row gap-ds-3">
                  <CompactStat
                    label={t("settings.latestSyncedLabel")}
                    value={t("settings.stepCountValue", {
                      count: stepQueryData?.latest?.stepCount ?? 0,
                    })}
                  />
                  <CompactStat
                    label={t("settings.deviceTodayLabel")}
                    value={t("settings.stepCountValue", {
                      count: stepSync.deviceStepCount ?? 0,
                    })}
                  />
                </View>
                <View className="flex-row gap-ds-3">
                  <CompactStat
                    label={t("settings.recordedFor")}
                    value={recordedForDate ?? "—"}
                  />
                  <CompactStat
                    label={t("settings.lastUpdated")}
                    value={latestSyncedDate ?? "—"}
                  />
                </View>
                <View className="flex-row gap-ds-3">
                  <CompactStat
                    label={t("settings.sourceLabel")}
                    value={latestStepSourceLabel}
                  />
                  <CompactStat
                    label={t("settings.goalNotificationsLabel")}
                    value={notificationStatusLabel}
                  />
                </View>

                {stepSync.lastError ? (
                  <Notice tone="danger" title={stepSync.lastError} />
                ) : null}

                {fitbitError ? <Notice tone="danger" title={fitbitError} /> : null}

                <Button
                  tone="ghost"
                  size="md"
                  icon={RefreshCw}
                  testID="settings-step-sync-action"
                  onPress={() => {
                    void handleStepAction();
                  }}
                  loading={stepSync.isSyncing || isConnectingFitbit}
                >
                  {stepActionLabel}
                </Button>
              </Card>

              <View
                className="mt-ds-3 gap-ds-3"
                onLayout={(event) => {
                  notificationsSectionYRef.current = event.nativeEvent.layout.y;

                  if (params.section === "notifications") {
                    scrollToNotificationsSection();
                  }
                }}
              >
                <SectionHeader
                  title={t("settings.notificationsTitle")}
                  subtitle={t("settings.notificationsIntro")}
                />

                <Card>
                  <View className="gap-[2px]">
                    <CardTitle>
                      {t("settings.notificationsPreferencesTitle")}
                    </CardTitle>
                    <Text className="font-nunito text-ds-sm text-fgMuted">
                      {t("settings.notificationsPreferencesHelp")}
                    </Text>
                  </View>

                  <Notice
                    tone={notificationsGranted ? "success" : "info"}
                    icon={Bell}
                    title={`${t("settings.notificationsPermissionLabel")} · ${notificationStatusLabel}`}
                    body={notificationPermissionSummary}
                  >
                    {notificationsGranted ? null : (
                      <Button
                        tone="ghost"
                        size="sm"
                        testID="settings-notification-permission-action"
                        onPress={() => void handleNotificationPermissionAction()}
                      >
                        {notificationPermissionCta}
                      </Button>
                    )}
                  </Notice>

                  <SelectList>
                    {NOTIFICATION_ROWS.map(({ key, icon }, index) => (
                      <ToggleRow
                        key={key}
                        icon={icon}
                        title={t(`settings.notificationOptions.${key}.title`)}
                        description={t(
                          `settings.notificationOptions.${key}.description`,
                        )}
                        testIDPrefix={`settings-notification-${key}`}
                        value={notificationPreferences[key]}
                        disabled={updateNotificationPreferencesMutation.isPending}
                        divider={index < NOTIFICATION_ROWS.length - 1}
                        onToggle={(value) => {
                          void handleNotificationPreferenceToggle(key, value);
                        }}
                      />
                    ))}
                  </SelectList>

                  {notificationError ? (
                    <Notice tone="danger" title={notificationError} />
                  ) : null}
                </Card>
              </View>

              <SectionHeader
                className="mt-ds-3"
                title={t("settings.sessionTitle")}
                subtitle={t("settings.sessionIntro")}
              />

              <Card>
                <View className="flex-row items-center gap-ds-3">
                  <IconTile icon={KeyRound} />
                  <View className="flex-1 gap-[2px]">
                    <CardTitle>{t("settings.passwordTitle")}</CardTitle>
                    <Text className="font-nunito text-ds-sm text-fgMuted">
                      {hasPasswordAuth
                        ? t("settings.passwordChangeHelp")
                        : t("settings.passwordCreateHelp")}
                    </Text>
                  </View>
                </View>

                {authMethodChips.length > 0 ? (
                  <View className="flex-row flex-wrap gap-ds-2">
                    {authMethodChips.map((label) => (
                      <Chip key={label} label={label} tone="neutral" />
                    ))}
                  </View>
                ) : null}

                {hasPasswordAuth ? (
                  <Input
                    value={currentPasswordInput}
                    onChangeText={(value) => {
                      setCurrentPasswordInput(value);
                      setPasswordStatus(null);
                    }}
                    placeholder={t("settings.currentPasswordPlaceholder")}
                    autoComplete="current-password"
                    secureTextEntry
                    icon={Lock}
                    testID="settings-current-password-input"
                  />
                ) : null}
                <Input
                  value={newPasswordInput}
                  onChangeText={(value) => {
                    setNewPasswordInput(value);
                    setPasswordStatus(null);
                  }}
                  placeholder={t("settings.newPasswordPlaceholder")}
                  autoComplete="new-password"
                  secureTextEntry
                  icon={Lock}
                  testID="settings-new-password-input"
                />
                <Input
                  value={confirmPasswordInput}
                  onChangeText={(value) => {
                    setConfirmPasswordInput(value);
                    setPasswordStatus(null);
                  }}
                  placeholder={t("settings.confirmNewPasswordPlaceholder")}
                  autoComplete="new-password"
                  secureTextEntry
                  icon={Lock}
                  testID="settings-confirm-password-input"
                />

                {passwordStatus ? (
                  <Notice
                    tone={passwordStatus.type === "success" ? "success" : "danger"}
                    title={passwordStatus.message}
                  />
                ) : null}

                <Button
                  size="md"
                  testID="settings-password-submit"
                  onPress={handlePasswordSubmit}
                  disabled={passwordSubmitDisabled}
                  loading={changePasswordMutation.isPending}
                >
                  {hasPasswordAuth
                    ? t("settings.changePasswordAction")
                    : t("settings.createPasswordAction")}
                </Button>
              </Card>

              <Card>
                <Text className="font-nunito text-ds-sm text-fgMuted">
                  {t("settings.sessionHelp")}
                </Text>
                <Button
                  tone="danger"
                  size="md"
                  icon={LogOut}
                  testID="settings-logout-action"
                  onPress={() =>
                    void clearAppSession().then(() => router.replace("/login"))
                  }
                >
                  {t("home.logout")}
                </Button>
              </Card>

              <SectionHeader
                className="mt-ds-3"
                title={t("settings.privacyTitle")}
                subtitle={t("settings.privacyIntro")}
              />

              <Card>
                <Text className="font-nunito text-ds-sm text-fgMuted">
                  {t("settings.privacyHelp")}
                </Text>
                <Button
                  tone="ghost"
                  size="md"
                  icon={ExternalLink}
                  testID="settings-privacy-policy-action"
                  onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
                >
                  {t("settings.openPrivacyPolicy")}
                </Button>
                <Button
                  tone="ghost"
                  size="md"
                  icon={ExternalLink}
                  testID="settings-account-deletion-info-action"
                  onPress={() => void Linking.openURL(ACCOUNT_DELETION_URL)}
                >
                  {t("settings.openAccountDeletionInfo")}
                </Button>
              </Card>

              <Card tone="danger">
                <View className="gap-[2px]">
                  <Text className="font-nunito-extrabold text-ds-h3 text-dangerText">
                    {t("settings.deleteAccountTitle")}
                  </Text>
                  <Text className="font-nunito text-ds-sm text-fg">
                    {t("settings.deleteAccountHelp")}
                  </Text>
                </View>
                {deleteAccountMutation.error ? (
                  <Notice tone="danger" title={t("settings.deleteAccountFailed")} />
                ) : null}
                <Button
                  tone="danger"
                  size="md"
                  icon={Trash}
                  testID="settings-delete-account-action"
                  onPress={confirmDeleteAccount}
                  loading={deleteAccountMutation.isPending}
                >
                  {t("settings.deleteAccountAction")}
                </Button>
              </Card>
            </View>
          </ScrollView>
        </View>
      </KeyboardScreenView>
    </ModalSheetRoute>
  );
}

function settingsErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function formatSettingsDate(value: string | null, locale: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRecordedForDate(value: string | null, locale: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
