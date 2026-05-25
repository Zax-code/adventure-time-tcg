import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import type { Locale } from "../i18n/types";

const LOCALES: Locale[] = ["en", "fr"];

interface LocaleState {
  locale: Locale;
  hydrated: boolean;
  setLocale: (locale: Locale) => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: "en",
  hydrated: false,
  async setLocale(locale) {
    await SecureStore.setItemAsync("locale", locale);
    set({ locale });
  },
  async hydrateFromStorage() {
    const stored = await SecureStore.getItemAsync("locale");
    const locale: Locale =
      stored && LOCALES.includes(stored as Locale) ? (stored as Locale) : "en";
    set({ locale, hydrated: true });
  },
}));
