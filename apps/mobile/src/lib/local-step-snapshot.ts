import * as SecureStore from "expo-secure-store";

import {
  formatLocalStepDate,
  type LocalStepSnapshot,
} from "./local-step-overlay";

export {
  applyLocalStepSnapshotToQuests,
  formatLocalStepDate,
  type LocalStepSnapshot,
} from "./local-step-overlay";

const LOCAL_STEP_SNAPSHOT_KEY_PREFIX = "local-step-snapshot-v1";
const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
} as const;

function snapshotKey(userId: string) {
  return `${LOCAL_STEP_SNAPSHOT_KEY_PREFIX}.${userId}`;
}

function isCurrentLocalSnapshot(snapshot: LocalStepSnapshot, userId: string) {
  return (
    snapshot.userId === userId &&
    snapshot.source === "device_health" &&
    snapshot.recordedFor === formatLocalStepDate()
  );
}

export async function getLocalStepSnapshotForToday(userId: string) {
  const rawSnapshot = await SecureStore.getItemAsync(
    snapshotKey(userId),
    SECURE_STORE_OPTIONS,
  );

  if (!rawSnapshot) {
    return null;
  }

  try {
    const snapshot = JSON.parse(rawSnapshot) as LocalStepSnapshot;
    return isCurrentLocalSnapshot(snapshot, userId) ? snapshot : null;
  } catch {
    return null;
  }
}

export async function persistLocalStepSnapshot(input: {
  userId: string;
  recordedFor: string;
  stepCount: number;
}) {
  const existing = await getLocalStepSnapshotForToday(input.userId);
  const stepCount =
    existing && existing.recordedFor === input.recordedFor
      ? Math.max(existing.stepCount, input.stepCount)
      : input.stepCount;

  const snapshot: LocalStepSnapshot = {
    userId: input.userId,
    source: "device_health",
    recordedFor: input.recordedFor,
    stepCount: Math.max(0, Math.round(stepCount)),
    updatedAt: new Date().toISOString(),
  };

  await SecureStore.setItemAsync(
    snapshotKey(input.userId),
    JSON.stringify(snapshot),
    SECURE_STORE_OPTIONS,
  );

  return snapshot;
}

export async function clearLocalStepSnapshotForUser(userId: string) {
  await SecureStore.deleteItemAsync(snapshotKey(userId), SECURE_STORE_OPTIONS);
}
