import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import { runStartupTask } from "../lib/startup-recovery";
import type { ThemeName } from "../theme/themes";

const THEME_STORAGE_KEY = "themeNameAfterFirstUnlockV1";
const LEGACY_THEME_STORAGE_KEY = "themeName";
const VALID_THEME_NAMES = ["candy", "ice", "nightosphere"] as const;
const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
} as const;

function normalizeThemeName(value: string | null | undefined): ThemeName {
  return VALID_THEME_NAMES.includes(value as ThemeName)
    ? (value as ThemeName)
    : "candy";
}

async function readStoredThemeName() {
  return runStartupTask(async () => {
    const stored = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
    if (stored) {
      return normalizeThemeName(stored);
    }

    const legacyStored = await SecureStore.getItemAsync(
      LEGACY_THEME_STORAGE_KEY,
    );
    const themeName = normalizeThemeName(legacyStored);

    if (legacyStored) {
      await SecureStore.setItemAsync(
        THEME_STORAGE_KEY,
        themeName,
        SECURE_STORE_OPTIONS,
      );
    }

    return themeName;
  });
}

export async function getStoredThemeName() {
  const result = await readStoredThemeName();
  return result.ok ? result.value : "candy";
}

interface ThemeState {
  themeName: ThemeName;
  hydrated: boolean;
  hydrationFailure: "rejected" | "timeout" | null;
  setTheme: (name: ThemeName) => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeName: "candy",
  hydrated: false,
  hydrationFailure: null,
  async setTheme(name) {
    const result = await runStartupTask(() =>
      SecureStore.setItemAsync(
        THEME_STORAGE_KEY,
        name,
        SECURE_STORE_OPTIONS,
      ),
    );
    set({
      themeName: name,
      hydrationFailure: result.ok ? null : result.reason,
    });
  },
  async hydrateFromStorage() {
    const result = await readStoredThemeName();
    set({
      themeName: result.ok ? result.value : "candy",
      hydrated: true,
      hydrationFailure: result.ok ? null : result.reason,
    });
  },
}));
