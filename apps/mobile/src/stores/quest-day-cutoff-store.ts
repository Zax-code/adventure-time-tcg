import { create } from "zustand";

type QuestDayCutoffStore = {
  cutoffVersion: number;
  lastCutoffDayKey: string | null;
  publishCutoff: (dayKey: string) => void;
};

export const useQuestDayCutoffStore = create<QuestDayCutoffStore>((set) => ({
  cutoffVersion: 0,
  lastCutoffDayKey: null,
  publishCutoff: (dayKey) =>
    set((state) => ({
      cutoffVersion: state.cutoffVersion + 1,
      lastCutoffDayKey: dayKey,
    })),
}));
