import { create } from "zustand";

import type { ThemeName } from "../theme/themes";
import { createPersistedPreference } from "./persisted-preference";

const VALID_THEME_NAMES: readonly string[] = [
  "candy",
  "ice",
  "nightosphere",
] satisfies ThemeName[];

const themePreference = createPersistedPreference<ThemeName>({
  key: "themeNameAfterFirstUnlockV1",
  legacyKey: "themeName",
  isValid: (value): value is ThemeName => VALID_THEME_NAMES.includes(value),
  defaultValue: "candy",
});

export function getStoredThemeName() {
  return themePreference.readOrDefault();
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
    const result = await themePreference.write(name);
    set({
      themeName: name,
      hydrationFailure: result.ok ? null : result.reason,
    });
  },
  async hydrateFromStorage() {
    const result = await themePreference.read();
    set({
      themeName: result.ok ? result.value : themePreference.defaultValue,
      hydrated: true,
      hydrationFailure: result.ok ? null : result.reason,
    });
  },
}));
