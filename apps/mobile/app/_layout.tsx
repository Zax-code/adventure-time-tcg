import "react-native-reanimated";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import { useEffect, useState } from "react";
import { BottomSheetProvider } from "@swmansion/react-native-bottom-sheet";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Orientation from "react-native-orientation-locker";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";

import "../global.css";

import { useStepSyncManager } from "../src/hooks/use-step-sync-manager";
import { useRetryFailedQueriesOnAppActive } from "../src/hooks/use-retry-failed-queries-on-app-active";
import { useStepQuestWidgetSync } from "../src/hooks/use-step-quest-widget-sync";
import { useUserTimezoneSync } from "../src/hooks/use-user-timezone-sync";
import { useWidgetRefreshPushRegistration } from "../src/hooks/use-widget-refresh-push-registration";
import { useWarmPackVisuals } from "../src/hooks/use-warm-pack-visuals";
import { useGiftBadgeRefresh } from "../src/hooks/use-gift-badge-refresh";
import { useNativeSplashDismissal } from "../src/hooks/use-native-splash-dismissal";
import { AppLaunchScreen } from "../src/components/app-launch-screen";
import { AppOverlayProvider } from "../src/components/app-overlay-portal";
import { PageErrorState } from "../src/components/error-state";
import { RootRouteEffects } from "../src/components/root-route-effects";
import { useTranslation } from "../src/i18n";
import { queryClient } from "../src/lib/query-client";
import {
  FONT_STARTUP_TIMEOUT_MS,
  isFontStartupSettled,
} from "../src/lib/startup-recovery";
import { useBootstrap } from "../src/hooks/use-bootstrap";
import { apiClient } from "../src/lib/api";
import { API_BASE_URL } from "../src/lib/api-config";
import { registerWidgetRefreshNotificationTask } from "../src/lib/widget-refresh-notification-task";
import { preparePlayIntegrity } from "../src/lib/play-integrity";
import {
  connectQuestRealtime,
  disconnectQuestRealtime,
} from "../src/lib/quest-realtime";
import {
  type QuestResetPayload,
  useQuestResetStore,
} from "../src/stores/quest-reset-store";
import { useSessionStore } from "../src/stores/session-store";
import { useStepSyncStore } from "../src/stores/step-sync-store";
import { useLocaleStore } from "../src/stores/locale-store";
import { useThemeStore } from "../src/stores/theme-store";
import { getExpoUIColorScheme, THEME_COLORS, THEME_VARS } from "../src/theme/themes";

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const DEFAULT_NOTIFICATION_PREFERENCES = {
  dailyReset: true,
  stepGoal: true,
  pvpInvite: true,
  pvpTurn: true,
  giftReceived: true,
} as const;

const PORTRAIT_SCREEN_OPTIONS = {
  headerShown: false,
  orientation: "portrait_up",
} as const;

const LANDSCAPE_SCREEN_OPTIONS = {
  headerShown: false,
  orientation: "landscape",
} as const;

export default function RootLayout() {
  return useRootLayoutView();
}

function useRootLayoutView() {
  useBootstrap();

  useEffect(() => {
    void preparePlayIntegrity();
  }, []);
  useRetryFailedQueriesOnAppActive();
  useUserTimezoneSync();
  useStepSyncManager();
  useStepQuestWidgetSync();

  const hydrateTheme = useThemeStore((state) => state.hydrateFromStorage);
  const themeHydrated = useThemeStore((state) => state.hydrated);
  const themeHydrationFailure = useThemeStore(
    (state) => state.hydrationFailure,
  );
  const themeName = useThemeStore((state) => state.themeName);
  const hydrateLocale = useLocaleStore((state) => state.hydrateFromStorage);
  const localeHydrated = useLocaleStore((state) => state.hydrated);
  const localeHydrationFailure = useLocaleStore(
    (state) => state.hydrationFailure,
  );
  const sessionHydrated = useSessionStore((state) => state.hydrated);
  const bootstrapPhase = useSessionStore((state) => state.bootstrapPhase);
  const bootstrapFailure = useSessionStore((state) => state.bootstrapFailure);
  const retryBootstrap = useSessionStore((state) => state.retryBootstrap);
  const accessToken = useSessionStore((state) => state.accessToken);
  const user = useSessionStore((state) => state.user);
  const { t } = useTranslation();
  const authUserId = user?.id ?? null;
  const notificationPreferences =
    user?.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
  const preferredLanguage = user?.preferredLanguage ?? "en";
  const preferredStepSource = user?.preferredStepSource ?? "device_health";
  const timezone = user?.timezone ?? "Europe/Paris";
  const notificationPermissionStatus = useStepSyncStore(
    (state) => state.notificationPermissionStatus,
  );
  const publishReset = useQuestResetStore((state) => state.publishReset);
  const tc = THEME_COLORS[themeName];
  useWidgetRefreshPushRegistration({
    accessToken,
    notificationPermissionStatus,
    notificationPreferences,
    preferredLanguage,
    preferredStepSource,
    timezone,
    userId: authUserId,
  });
  useWarmPackVisuals(accessToken, bootstrapPhase);

  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  const fontsSettled = isFontStartupSettled({
    loaded: fontsLoaded,
    failed: Boolean(fontError),
    timedOut: fontsTimedOut,
  });
  const localBootReady =
    fontsSettled && themeHydrated && localeHydrated && sessionHydrated;

  useNativeSplashDismissal(localBootReady);

  useGiftBadgeRefresh(localBootReady && bootstrapPhase === "ready");

  useEffect(() => {
    void hydrateTheme();
  }, [hydrateTheme]);

  useEffect(() => {
    void hydrateLocale();
  }, [hydrateLocale]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setFontsTimedOut(true);
    }, FONT_STARTUP_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [fontError, fontsLoaded]);

  useEffect(() => {
    if (fontError) {
      console.warn("[startup] Bundled fonts failed; using system fonts.");
    } else if (fontsTimedOut) {
      console.warn("[startup] Bundled fonts timed out; using system fonts.");
    }
  }, [fontError, fontsTimedOut]);

  useEffect(() => {
    if (themeHydrationFailure) {
      console.warn(
        `[startup] Theme hydration ${themeHydrationFailure}; using default theme.`,
      );
    }
    if (localeHydrationFailure) {
      console.warn(
        `[startup] Locale hydration ${localeHydrationFailure}; using default locale.`,
      );
    }
  }, [localeHydrationFailure, themeHydrationFailure]);

  useEffect(() => {
    Orientation.lockToPortrait();
  }, []);

  useEffect(() => {
    void registerWidgetRefreshNotificationTask();
  }, []);

  useEffect(() => {
    if (!accessToken || !authUserId) {
      disconnectQuestRealtime();
      return;
    }

    return connectQuestRealtime({
      baseUrl: API_BASE_URL,
      token: accessToken,
      userId: authUserId,
      onQuestReset: (payload) => {
        const resetPayload = (payload ?? {}) as QuestResetPayload;
        const resetMarker = `${resetPayload.resetDate ?? "unknown"}:reset:${Date.now()}`;

        publishReset(resetPayload);
        queryClient.setQueryData(
          ["quests"],
          (
            current:
              | {
                  fitbitConnected: boolean;
                  quests: Array<Record<string, unknown>>;
                }
              | undefined,
          ) => {
            if (!current) return current;

            const nextQuests = current.quests.map((quest) => {
              const questType = quest.type;
              if (
                resetPayload.questType &&
                questType !== resetPayload.questType
              ) {
                return quest;
              }

              const nextQuest = {
                ...quest,
                version: `${String(quest.version ?? quest.id ?? questType)}:${resetMarker}`,
                resetByName: resetPayload.resetByName ?? null,
                progress: 0,
                completed: false,
                claimed: false,
                failed: false,
              };

              if (
                questType === "wordle_daily_fr" ||
                questType === "wordle_daily_en"
              ) {
                return {
                  ...nextQuest,
                  attemptsUsed: 0,
                };
              }

              if (questType === "speed_calculus_daily") {
                return {
                  ...nextQuest,
                  runsUsed: 0,
                  latestScore: 0,
                  rewardPreview: 0,
                  locked: false,
                };
              }

              if (
                questType === "daily_numbers_1_5" ||
                questType === "daily_numbers_2_4" ||
                questType === "daily_numbers_3_3"
              ) {
                return {
                  ...nextQuest,
                  score: undefined,
                  distance: undefined,
                  finalValue: undefined,
                };
              }

              return nextQuest;
            });

            return {
              ...current,
              quests: nextQuests,
            };
          },
        );

        const resetWordleLocale =
          resetPayload.questType === "wordle_daily_fr"
            ? "fr"
            : resetPayload.questType === "wordle_daily_en"
              ? "en"
              : null;

        if (
          !resetPayload.questType ||
          resetPayload.questType === "wordle_daily_fr" ||
          resetPayload.questType === "wordle_daily_en"
        ) {
          queryClient.setQueriesData(
            {
              queryKey: resetWordleLocale
                ? ["wordle", resetWordleLocale]
                : ["wordle"],
            },
            (
              current:
                | {
                    locale?: string;
                    availableLocales?: string[];
                    date: string;
                    resetTimezone: string;
                    guesses: Array<Record<string, unknown>>;
                    solved: boolean;
                    targetWord?: string | null;
                    questVersion?: string | null;
                    resetByName?: string | null;
                  }
                | undefined,
            ) => {
              if (!current) return current;

              return {
                ...current,
                guesses: [],
                solved: false,
                targetWord: null,
                questVersion: null,
                resetByName: resetPayload.resetByName ?? null,
              };
            },
          );
        }

        void queryClient.fetchQuery({
          queryKey: ["quests"],
          queryFn: () => apiClient.quests(),
          staleTime: 0,
        });
        void queryClient.invalidateQueries({ queryKey: ["speed-calculus"] });
        void queryClient.invalidateQueries({ queryKey: ["daily-numbers"] });
        void queryClient.invalidateQueries({ queryKey: ["perfect-timing"] });
      },
    });
  }, [accessToken, authUserId, publishReset]);

  if (!localBootReady) {
    return (
      <View
        style={[
          { flex: 1, alignItems: "center", justifyContent: "center" },
          THEME_VARS[themeName],
        ]}
      >
        <ActivityIndicator size="large" color={tc.primaryDark} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <BottomSheetProvider>
            <AppOverlayProvider>
              <View style={[{ flex: 1 }, THEME_VARS[themeName]]}>
                <StatusBar
                  style={getExpoUIColorScheme(themeName) === "dark" ? "light" : "dark"}
                />
                {bootstrapPhase === "error" ? (
                  <PageErrorState
                    title={t("common.launch.errorTitle")}
                    body={t("common.launch.errorBody")}
                    detail={t(
                      bootstrapFailure === "timeout"
                        ? "common.launch.errorTimeoutDetail"
                        : "common.launch.errorRejectedDetail",
                    )}
                    retryLabel={t("common.launch.retry")}
                    onRetry={retryBootstrap}
                  />
                ) : bootstrapPhase !== "ready" ? (
                  <AppLaunchScreen phase={bootstrapPhase} />
                ) : (
                  <Stack screenOptions={PORTRAIT_SCREEN_OPTIONS}>
                    <Stack.Screen
                      name="(tabs)"
                      options={PORTRAIT_SCREEN_OPTIONS}
                    />
                    <Stack.Screen
                      name="pvp-match"
                      options={LANDSCAPE_SCREEN_OPTIONS}
                    />
                    <Stack.Screen
                      name="pvp-replay"
                      options={LANDSCAPE_SCREEN_OPTIONS}
                    />
                    <Stack.Screen
                      name="pvp-spectate-match"
                      options={LANDSCAPE_SCREEN_OPTIONS}
                    />
                    <Stack.Screen
                      name="admin-card-editor"
                      options={{
                        presentation: "transparentModal",
                        animation: "none",
                        contentStyle: { backgroundColor: "transparent" },
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="admin-ability-editor"
                      options={{
                        presentation: "transparentModal",
                        animation: "none",
                        contentStyle: { backgroundColor: "transparent" },
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="admin-user-editor"
                      options={{
                        presentation: "transparentModal",
                        animation: "none",
                        contentStyle: { backgroundColor: "transparent" },
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="settings"
                      options={{
                        presentation: "transparentModal",
                        animation: "none",
                        contentStyle: { backgroundColor: "transparent" },
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="pvp-mechanics"
                      options={{
                        presentation: "transparentModal",
                        animation: "none",
                        contentStyle: { backgroundColor: "transparent" },
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="pvp-reference"
                      options={{
                        presentation: "transparentModal",
                        animation: "none",
                        contentStyle: { backgroundColor: "transparent" },
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="leaderboard-help"
                      options={{
                        presentation: "transparentModal",
                        animation: "none",
                        contentStyle: { backgroundColor: "transparent" },
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="pvp-card-details"
                      options={{
                        presentation: "transparentModal",
                        animation: "none",
                        contentStyle: { backgroundColor: "transparent" },
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="collection-card-detail"
                      options={{
                        presentation: "transparentModal",
                        animation: "none",
                        contentStyle: { backgroundColor: "transparent" },
                        headerShown: false,
                      }}
                    />
                  </Stack>
                )}
                <RootRouteEffects />
              </View>
            </AppOverlayProvider>
          </BottomSheetProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
