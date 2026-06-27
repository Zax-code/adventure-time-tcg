import "react-native-reanimated";
import { useEffect } from "react";
import { BottomSheetProvider } from "@swmansion/react-native-bottom-sheet";
import { ActivityIndicator, View } from "react-native";
import { Stack, usePathname } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as ScreenOrientation from "expo-screen-orientation";
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
import { AppLaunchScreen } from "../src/components/app-launch-screen";
import { queryClient } from "../src/lib/query-client";
import { useBootstrap } from "../src/hooks/use-bootstrap";
import { apiClient } from "../src/lib/api";
import { API_BASE_URL } from "../src/lib/api-config";
import { registerWidgetRefreshNotificationTask } from "../src/lib/widget-refresh-notification-task";
import { rememberContentPathname } from "../src/lib/widget-route-history";
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
import { THEME_COLORS, THEME_VARS } from "../src/theme/themes";

SplashScreen.preventAutoHideAsync();

const DEFAULT_NOTIFICATION_PREFERENCES = {
  dailyReset: true,
  stepGoal: true,
  pvpInvite: true,
  pvpTurn: true,
  giftReceived: true,
} as const;

const LANDSCAPE_ORIENTATION_PATHS = new Set([
  "/pvp-match",
  "/pvp-replay",
  "/pvp-spectate-match",
]);

export default function RootLayout() {
  const pathname = usePathname();

  useBootstrap();
  useRetryFailedQueriesOnAppActive();
  useUserTimezoneSync();
  useStepSyncManager();
  useStepQuestWidgetSync();

  const hydrateTheme = useThemeStore((state) => state.hydrateFromStorage);
  const themeHydrated = useThemeStore((state) => state.hydrated);
  const themeName = useThemeStore((state) => state.themeName);
  const hydrateLocale = useLocaleStore((state) => state.hydrateFromStorage);
  const localeHydrated = useLocaleStore((state) => state.hydrated);
  const sessionHydrated = useSessionStore((state) => state.hydrated);
  const bootstrapPhase = useSessionStore((state) => state.bootstrapPhase);
  const accessToken = useSessionStore((state) => state.accessToken);
  const user = useSessionStore((state) => state.user);
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

  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const localBootReady =
    fontsLoaded && themeHydrated && localeHydrated && sessionHydrated;

  useEffect(() => {
    void hydrateTheme();
  }, [hydrateTheme]);

  useEffect(() => {
    void hydrateLocale();
  }, [hydrateLocale]);

  useEffect(() => {
    rememberContentPathname(pathname);
  }, [pathname]);

  useEffect(() => {
    const orientationLock = LANDSCAPE_ORIENTATION_PATHS.has(pathname)
      ? ScreenOrientation.OrientationLock.LANDSCAPE
      : ScreenOrientation.OrientationLock.PORTRAIT;

    ScreenOrientation.lockAsync(orientationLock).catch(() => {});
  }, [pathname]);

  useEffect(() => {
    void registerWidgetRefreshNotificationTask();
  }, []);

  useEffect(() => {
    if (localBootReady) {
      void SplashScreen.hideAsync();
    }
  }, [localBootReady]);

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
            <View style={[{ flex: 1 }, THEME_VARS[themeName]]}>
              <StatusBar style="dark" />
              {bootstrapPhase !== "ready" ? (
                <AppLaunchScreen phase={bootstrapPhase} />
              ) : (
                <Stack screenOptions={{ headerShown: false }}>
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
            </View>
          </BottomSheetProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
