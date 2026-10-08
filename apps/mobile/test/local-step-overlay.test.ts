import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { QuestsResponse } from "@adventure-time/api-client";

import {
  applyLocalStepSnapshotToQuests,
  formatLocalStepDate,
  type LocalStepSnapshot,
} from "../src/lib/local-step-overlay.ts";

const user = { preferredStepSource: "device_health" } as const;

function snapshot(stepCount: number): LocalStepSnapshot {
  return {
    userId: "user-1",
    source: "device_health",
    recordedFor: formatLocalStepDate(),
    stepCount,
    updatedAt: new Date().toISOString(),
  };
}

function serverQuests(progress: number): QuestsResponse {
  return {
    fitbitConnected: false,
    quests: [
      {
        id: "quest-steps",
        version: "server-v1",
        type: "steps_10k",
        title: "steps_10k",
        description: "steps_10k_desc",
        target: 10_000,
        progress,
        completed: false,
        claimed: false,
        reward: 75,
        icon: "walking",
        actionPath: null,
        failed: false,
      },
    ],
  } as QuestsResponse;
}

describe("applyLocalStepSnapshotToQuests", () => {
  it("keeps a stable version when the same overlay is applied repeatedly", () => {
    const first = applyLocalStepSnapshotToQuests(serverQuests(1_000), snapshot(4_200), user);
    const second = applyLocalStepSnapshotToQuests(first, snapshot(4_200), user);
    const date = formatLocalStepDate();

    assert.equal(first?.quests[0]?.version, `server-v1:local:${date}:4200`);
    assert.equal(second?.quests[0]?.version, `server-v1:local:${date}:4200`);
    assert.equal(second, first);
  });

  it("replaces the previous overlay instead of appending to it", () => {
    const first = applyLocalStepSnapshotToQuests(serverQuests(1_000), snapshot(4_200), user);
    const second = applyLocalStepSnapshotToQuests(first, snapshot(5_000), user);

    assert.notEqual(second, first);
    assert.equal(second?.quests[0]?.progress, 5_000);
    assert.equal(
      second?.quests[0]?.version,
      `server-v1:local:${formatLocalStepDate()}:5000`,
    );
  });

  it("keeps local-only quest versions stable", () => {
    const first = applyLocalStepSnapshotToQuests(undefined, snapshot(300), user);
    const second = applyLocalStepSnapshotToQuests(first, snapshot(300), user);

    assert.equal(first?.quests[0]?.version, `local:${formatLocalStepDate()}:300`);
    assert.equal(second, first);
  });
});
