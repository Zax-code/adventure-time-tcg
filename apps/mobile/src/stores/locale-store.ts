import { create } from "zustand";

import type { Locale } from "../i18n/types";
import { createPersistedPreference } from "./persisted-preference";

const VALID_LOCALES: readonly string[] = ["en", "fr"] satisfies Locale[];

const localePreference = createPersistedPreference<Locale>({
  key: "localeAfterFirstUnlockV1",
  legacyKey: "locale",
  isValid: (value): value is Locale => VALID_LOCALES.includes(value),
  defaultValue: "en",
});

export function getStoredLocale() {
  return localePreference.readOrDefault();
}

interface LocaleState {
  locale: Locale;
  hydrated: boolean;
  hydrationFailure: "rejected" | "timeout" | null;
  setLocale: (locale: Locale) => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: "en",
  hydrated: false,
  hydrationFailure: null,
  async setLocale(locale) {
    const result = await localePreference.write(locale);
    set({
      locale,
      hydrationFailure: result.ok ? null : result.reason,
    });
  },
  async hydrateFromStorage() {
    const result = await localePreference.read();
    set({
      locale: result.ok ? result.value : localePreference.defaultValue,
      hydrated: true,
      hydrationFailure: result.ok ? null : result.reason,
    });
  },
}));
