import { useEffect } from "react";
import { AppState } from "react-native";
import * as SplashScreen from "expo-splash-screen";

import { SPLASH_HIDE_RETRY_DELAYS_MS } from "../lib/startup-recovery";

function hideNativeSplash() {
  void SplashScreen.hideAsync().catch(() => undefined);
}

export function useNativeSplashDismissal(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timeoutIds = SPLASH_HIDE_RETRY_DELAYS_MS.map((delayMs) =>
      setTimeout(hideNativeSplash, delayMs),
    );
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        hideNativeSplash();
      }
    });

    return () => {
      timeoutIds.forEach(clearTimeout);
      subscription.remove();
    };
  }, [enabled]);
}
