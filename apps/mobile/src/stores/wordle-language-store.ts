import { create } from "zustand";

import type { WordleLocale } from "@adventure-time/api-client";

import { createPersistedPreference } from "./persisted-preference";

const WORDLE_LANGUAGES: readonly string[] = ["fr", "en"] satisfies WordleLocale[];

const wordleLanguagePreference = createPersistedPreference<WordleLocale>({
  key: "wordleLanguageAfterFirstUnlockV1",
  legacyKey: "wordleLanguage",
  isValid: (value): value is WordleLocale => WORDLE_LANGUAGES.includes(value),
  defaultValue: "fr",
});

interface WordleLanguageState {
  hydrated: boolean;
  wordleLanguage: WordleLocale;
  setWordleLanguage: (language: WordleLocale) => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
}

export const useWordleLanguageStore = create<WordleLanguageState>((set) => ({
  hydrated: false,
  wordleLanguage: "fr",
  async setWordleLanguage(language) {
    set({ wordleLanguage: language });
    await wordleLanguagePreference.write(language);
  },
  async hydrateFromStorage() {
    const result = await wordleLanguagePreference.read();
    set({
      hydrated: true,
      wordleLanguage: result.ok
        ? result.value
        : wordleLanguagePreference.defaultValue,
    });
  },
}));
