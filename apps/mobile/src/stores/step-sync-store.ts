import { create } from "zustand";

export type StepSyncAvailability =
  | "unknown"
  | "available"
  | "setup_required"
  | "unavailable";

export type StepSyncPermissionStatus =
  | "unknown"
  | "not_requested"
  | "granted"
  | "denied";

interface StepSyncState {
  availability: StepSyncAvailability;
  healthPermissionStatus: StepSyncPermissionStatus;
  notificationPermissionStatus: StepSyncPermissionStatus;
  isSyncing: boolean;
  deviceStepCount: number | null;
  lastSyncedCount: number | null;
  lastRecordedFor: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  setPartial: (
    updates: Partial<
      Omit<StepSyncState, "setPartial" | "reset">
    >,
  ) => void;
  reset: () => void;
}

const initialState = {
  availability: "unknown" as StepSyncAvailability,
  healthPermissionStatus: "unknown" as StepSyncPermissionStatus,
  notificationPermissionStatus: "unknown" as StepSyncPermissionStatus,
  isSyncing: false,
  deviceStepCount: null,
  lastSyncedCount: null,
  lastRecordedFor: null,
  lastSyncedAt: null,
  lastError: null,
};

export const useStepSyncStore = create<StepSyncState>((set) => ({
  ...initialState,
  setPartial(updates) {
    set(updates);
  },
  reset() {
    set(initialState);
  },
}));
