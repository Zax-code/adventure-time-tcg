import * as SecureStore from "expo-secure-store";

import type { AuthUser, QuestsResponse } from "@adventure-time/api-client";

const LOCAL_STEP_SNAPSHOT_KEY_PREFIX = "local-step-snapshot-v1";
const STEP_GOAL = 10_000;
const DEFAULT_STEP_REWARD = 150;
const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
} as const;

export interface LocalStepSnapshot {
  userId: string;
  source: "device_health";
  recordedFor: string;
  stepCount: number;
  updatedAt: string;
}

export function formatLocalStepDate(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

export function applyLocalStepSnapshotToQuests(
  currentQuests: QuestsResponse | undefined,
  snapshot: LocalStepSnapshot | null,
  user: Pick<AuthUser, "preferredStepSource"> | null | undefined,
): QuestsResponse | undefined {
  if (
    !snapshot ||
    !user ||
    user.preferredStepSource !== "device_health" ||
    snapshot.recordedFor !== formatLocalStepDate()
  ) {
    return currentQuests;
  }

  const currentStepQuest = currentQuests?.quests.find(
    (quest) => quest.type === "steps_10k",
  );
  const progress = Math.max(
    currentStepQuest?.claimed || currentStepQuest?.failed
      ? (currentStepQuest?.progress ?? 0)
      : Math.max(currentStepQuest?.progress ?? 0, snapshot.stepCount),
    0,
  );
  const target = Math.max(currentStepQuest?.target ?? STEP_GOAL, 1);
  const claimed = currentStepQuest?.claimed ?? false;
  const failed = currentStepQuest?.failed ?? false;
  const completed = claimed
    ? (currentStepQuest?.completed ?? true)
    : !failed && (currentStepQuest?.completed || progress >= target);
  const stepQuest = {
    id: currentStepQuest?.id ?? `local-steps_10k-${snapshot.recordedFor}`,
    version: currentStepQuest?.version
      ? `${currentStepQuest.version}:local:${snapshot.recordedFor}:${progress}`
      : `local:${snapshot.recordedFor}:${progress}`,
    type: "steps_10k",
    title: currentStepQuest?.title ?? "steps_10k",
    description: currentStepQuest?.description ?? "steps_10k_desc",
    target,
    progress,
    completed,
    claimed,
    reward: currentStepQuest?.reward ?? DEFAULT_STEP_REWARD,
    icon: currentStepQuest?.icon ?? "walking",
    actionPath: currentStepQuest?.actionPath ?? null,
    failed,
  } satisfies QuestsResponse["quests"][number];

  if (!currentQuests) {
    return {
      quests: [stepQuest],
      fitbitConnected: false,
    };
  }

  return {
    ...currentQuests,
    quests: currentStepQuest
      ? currentQuests.quests.map((quest) =>
          quest.type === "steps_10k" ? { ...quest, ...stepQuest } : quest,
        )
      : [...currentQuests.quests, stepQuest],
  };
}
