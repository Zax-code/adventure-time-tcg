import { create } from "zustand";

export interface QuestResetPayload {
  questType?: string | null;
  resetByName?: string | null;
  resetDate?: string;
  resetMode?: string;
}

interface QuestResetState {
  lastResetAt: number;
  lastPayload: QuestResetPayload | null;
  publishReset: (payload: QuestResetPayload) => void;
}

export const useQuestResetStore = create<QuestResetState>((set) => ({
  lastResetAt: 0,
  lastPayload: null,
  publishReset: (payload) =>
    set({
      lastResetAt: Date.now(),
      lastPayload: payload,
    }),
}));
