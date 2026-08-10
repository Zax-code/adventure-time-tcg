import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import { runStartupTask } from "../lib/startup-recovery";
import type { Locale } from "../i18n/types";

const LOCALE_STORAGE_KEY = "localeAfterFirstUnlockV1";
const LEGACY_LOCALE_STORAGE_KEY = "locale";
const VALID_LOCALES = ["en", "fr"] as const;
const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
} as const;

function normalizeLocale(value: string | null | undefined): Locale {
  return VALID_LOCALES.includes(value as Locale) ? (value as Locale) : "en";
}

async function readStoredLocale() {
  return runStartupTask(async () => {
    const stored = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
    if (stored) {
      return normalizeLocale(stored);
    }

    const legacyStored = await SecureStore.getItemAsync(
      LEGACY_LOCALE_STORAGE_KEY,
    );
    const locale = normalizeLocale(legacyStored);

    if (legacyStored) {
      await SecureStore.setItemAsync(
        LOCALE_STORAGE_KEY,
        locale,
        SECURE_STORE_OPTIONS,
      );
    }

    return locale;
  });
}

export async function getStoredLocale() {
  const result = await readStoredLocale();
  return result.ok ? result.value : "en";
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
    const result = await runStartupTask(() =>
      SecureStore.setItemAsync(
        LOCALE_STORAGE_KEY,
        locale,
        SECURE_STORE_OPTIONS,
      ),
    );
    set({
      locale,
      hydrationFailure: result.ok ? null : result.reason,
    });
  },
  async hydrateFromStorage() {
    const result = await readStoredLocale();
    set({
      locale: result.ok ? result.value : "en",
      hydrated: true,
      hydrationFailure: result.ok ? null : result.reason,
    });
  },
}));
