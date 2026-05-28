import "react-native-reanimated";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
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
import { useStepQuestWidgetSync } from "../src/hooks/use-step-quest-widget-sync";
import { useUserTimezoneSync } from "../src/hooks/use-user-timezone-sync";
import { AppLaunchScreen } from "../src/components/app-launch-screen";
import { queryClient } from "../src/lib/query-client";
import { useBootstrap } from "../src/hooks/use-bootstrap";
import { apiClient, API_BASE_URL } from "../src/lib/api";
import {
  connectQuestRealtime,
  disconnectQuestRealtime,
} from "../src/lib/quest-realtime";
import {
  type QuestResetPayload,
  useQuestResetStore,
} from "../src/stores/quest-reset-store";
import { useSessionStore } from "../src/stores/session-store";
import { useLocaleStore } from "../src/stores/locale-store";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS, THEME_VARS } from "../src/theme/themes";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useBootstrap();
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
  const authUserId = useSessionStore((state) => state.user?.id ?? null);
  const publishReset = useQuestResetStore((state) => state.publishReset);
  const tc = THEME_COLORS[themeName];

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

              if (questType === "wordle_daily") {
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

              return nextQuest;
            });

            return {
              ...current,
              quests: nextQuests,
            };
          },
        );

        if (!resetPayload.questType || resetPayload.questType === "wordle_daily") {
          queryClient.setQueryData(
            ["wordle"],
            (
              current:
                | {
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
          <View style={[{ flex: 1 }, THEME_VARS[themeName]]}>
            <StatusBar style="dark" />
            {bootstrapPhase !== "ready" ? (
              <AppLaunchScreen phase={bootstrapPhase} />
            ) : (
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen
                  name="admin-card-editor"
                  options={{ presentation: "modal", headerShown: false }}
                />
                <Stack.Screen
                  name="admin-ability-editor"
                  options={{ presentation: "modal", headerShown: false }}
                />
                <Stack.Screen
                  name="admin-user-editor"
                  options={{ presentation: "modal", headerShown: false }}
                />
                <Stack.Screen
                  name="settings"
                  options={{ presentation: "modal", headerShown: false }}
                />
                <Stack.Screen
                  name="pvp-mechanics"
                  options={{ presentation: "modal", headerShown: false }}
                />
                <Stack.Screen
                  name="pvp-reference"
                  options={{ presentation: "modal", headerShown: false }}
                />
                <Stack.Screen
                  name="pvp-card-details"
                  options={{ presentation: "modal", headerShown: false }}
                />
                <Stack.Screen
                  name="collection-card-detail"
                  options={{ presentation: "modal", headerShown: false }}
                />
              </Stack>
            )}
          </View>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
