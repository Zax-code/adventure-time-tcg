import 'react-native-reanimated';
import { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

import { useBootstrap } from "../src/hooks/use-bootstrap";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_VARS } from "../src/theme/themes";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  useBootstrap();

  const hydrateTheme = useThemeStore((state) => state.hydrateFromStorage);
  const themeHydrated = useThemeStore((state) => state.hydrated);
  const themeName = useThemeStore((state) => state.themeName);

  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    void hydrateTheme();
  }, [hydrateTheme]);

  useEffect(() => {
    if (fontsLoaded && themeHydrated) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, themeHydrated]);

  if (!fontsLoaded || !themeHydrated) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <View style={[{ flex: 1 }, THEME_VARS[themeName]]}>
            <StatusBar style="dark" />
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
          </View>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
