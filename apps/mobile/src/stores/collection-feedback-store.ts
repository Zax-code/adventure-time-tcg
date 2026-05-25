import { create } from "zustand";

interface CollectionFeedbackState {
  message: string | null;
  publish: (message: string) => void;
  clear: () => void;
}

export const useCollectionFeedbackStore = create<CollectionFeedbackState>(
  (set) => ({
    message: null,
    publish: (message) => set({ message }),
    clear: () => set({ message: null }),
  }),
);
