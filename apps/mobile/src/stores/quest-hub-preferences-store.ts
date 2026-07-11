import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import {
  DEFAULT_QUEST_HUB_ORDER,
  normalizeQuestHubOrder,
  type QuestHubPreferenceId,
} from "../features/quests/quest-hub-model";

const STORAGE_KEY_PREFIX = "questHubOrder";
let preferenceRevision = 0;

interface QuestHubPreferencesState {
  hydrated: boolean;
  order: QuestHubPreferenceId[];
  userId: string | null;
  hydrateForUser: (userId: string) => Promise<void>;
  setOrderForUser: (
    userId: string,
    order: readonly QuestHubPreferenceId[],
  ) => Promise<void>;
}

function getStorageKey(userId: string) {
  const safeUserId = userId.replace(/[^A-Za-z0-9._-]/g, "_");
  return `${STORAGE_KEY_PREFIX}.${safeUserId}`;
}

export const useQuestHubPreferencesStore = create<QuestHubPreferencesState>(
  (set, get) => ({
    hydrated: false,
    order: [...DEFAULT_QUEST_HUB_ORDER],
    userId: null,
    async hydrateForUser(userId) {
      if (get().userId === userId && get().hydrated) return;
      const hydrationRevision = preferenceRevision;

      set({
        hydrated: false,
        order: [...DEFAULT_QUEST_HUB_ORDER],
        userId,
      });

      let stored: string | null = null;
      try {
        stored = await SecureStore.getItemAsync(getStorageKey(userId));
      } catch (error) {
        console.warn("Failed to load the quest hub order", error);
      }
      if (get().userId !== userId || preferenceRevision !== hydrationRevision) {
        return;
      }

      let parsed: unknown = null;
      try {
        parsed = stored ? JSON.parse(stored) : null;
      } catch {
        parsed = null;
      }

      set({
        hydrated: true,
        order: normalizeQuestHubOrder(Array.isArray(parsed) ? parsed : null),
      });
    },
    async setOrderForUser(userId, order) {
      preferenceRevision += 1;
      const normalized = normalizeQuestHubOrder(order);
      set({ hydrated: true, order: normalized, userId });

      try {
        await SecureStore.setItemAsync(
          getStorageKey(userId),
          JSON.stringify(normalized),
        );
      } catch (error) {
        console.warn("Failed to save the quest hub order", error);
      }
    },
  }),
);
