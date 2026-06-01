import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import type { ThemeName } from "../theme/themes";

const THEME_STORAGE_KEY = "themeName";
export const VALID_THEME_NAMES = ["candy", "ice", "nightosphere"] as const;

export function normalizeThemeName(value: string | null | undefined): ThemeName {
  return VALID_THEME_NAMES.includes(value as ThemeName)
    ? (value as ThemeName)
    : "candy";
}

export async function getStoredThemeName() {
  const stored = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
  return normalizeThemeName(stored);
}

interface ThemeState {
  themeName: ThemeName;
  hydrated: boolean;
  setTheme: (name: ThemeName) => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeName: "candy",
  hydrated: false,
  async setTheme(name) {
    await SecureStore.setItemAsync(THEME_STORAGE_KEY, name);
    set({ themeName: name });
  },
  async hydrateFromStorage() {
    const themeName = await getStoredThemeName();
    set({ themeName, hydrated: true });
  },
}));
