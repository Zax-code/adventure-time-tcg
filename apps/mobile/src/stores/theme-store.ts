import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import type { ThemeName } from "../theme/themes";

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
    await SecureStore.setItemAsync("themeName", name);
    set({ themeName: name });
  },
  async hydrateFromStorage() {
    const stored = await SecureStore.getItemAsync("themeName");
    const valid: ThemeName[] = ["candy", "ice", "nightosphere"];
    const themeName: ThemeName =
      stored && valid.includes(stored as ThemeName)
        ? (stored as ThemeName)
        : "candy";
    set({ themeName, hydrated: true });
  },
}));
