import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import type { WordleLocale } from "@adventure-time/api-client";

const WORDLE_LANGUAGES: WordleLocale[] = ["fr", "en"];

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
    await SecureStore.setItemAsync("wordleLanguage", language);
  },
  async hydrateFromStorage() {
    const stored = await SecureStore.getItemAsync("wordleLanguage");
    const wordleLanguage =
      stored && WORDLE_LANGUAGES.includes(stored as WordleLocale)
        ? (stored as WordleLocale)
        : "fr";

    set({ hydrated: true, wordleLanguage });
  },
}));
