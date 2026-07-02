import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import type { Locale } from "../i18n/types";

const LOCALE_STORAGE_KEY = "locale";
const VALID_LOCALES = ["en", "fr"] as const;

function normalizeLocale(value: string | null | undefined): Locale {
  return VALID_LOCALES.includes(value as Locale) ? (value as Locale) : "en";
}

export async function getStoredLocale() {
  const stored = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
  return normalizeLocale(stored);
}

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
    await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, locale);
    set({ locale });
  },
  async hydrateFromStorage() {
    const locale = await getStoredLocale();
    set({ locale, hydrated: true });
  },
}));
