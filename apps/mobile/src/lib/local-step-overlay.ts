import type { AuthUser, QuestsResponse } from "@adventure-time/api-client";

const STEP_GOAL = 10_000;
const DEFAULT_STEP_REWARD = 75;

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

// Strip a previous local overlay so re-applying it never grows the version string.
function serverQuestVersion(version: string | null | undefined) {
  if (!version || version.startsWith("local:")) {
    return null;
  }

  const localOverlayStart = version.indexOf(":local:");
  return localOverlayStart === -1 ? version : version.slice(0, localOverlayStart);
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
  const serverVersion = serverQuestVersion(currentStepQuest?.version);
  const stepQuest = {
    id: currentStepQuest?.id ?? `local-steps_10k-${snapshot.recordedFor}`,
    version: serverVersion
      ? `${serverVersion}:local:${snapshot.recordedFor}:${progress}`
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

  // Keep the same reference when the overlay is already applied, so react-query
  // observers are not notified of an identical value.
  if (
    currentQuests &&
    currentStepQuest &&
    (Object.keys(stepQuest) as Array<keyof typeof stepQuest>).every(
      (key) => currentStepQuest[key] === stepQuest[key],
    )
  ) {
    return currentQuests;
  }

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
