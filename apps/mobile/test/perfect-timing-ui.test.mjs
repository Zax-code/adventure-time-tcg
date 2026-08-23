import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const screenSource = readFileSync(
  "src/features/quests/perfect-timing/perfect-timing-screen.tsx",
  "utf8",
);
const pendingStopSource = readFileSync(
  "src/features/quests/perfect-timing/pending-stop.ts",
  "utf8",
);
const timerCardSource = readFileSync(
  "src/features/quests/perfect-timing/timer-card.tsx",
  "utf8",
);
const trainingPanelSource = readFileSync(
  "src/features/quests/perfect-timing/training-panel.tsx",
  "utf8",
);
const officialPanelSource = readFileSync(
  "src/features/quests/perfect-timing/official-panel.tsx",
  "utf8",
);
const continueConfirmationModalSource = readFileSync(
  "src/features/quests/perfect-timing/continue-confirmation-modal.tsx",
  "utf8",
);

describe("Perfect Timing UI behavior", () => {
  it("derives elapsed time from monotonic timestamps without interval counting", () => {
    assert.match(screenSource, /const startedAt = performance\.now\(\)/);
    assert.match(screenSource, /const stoppedAt = performance\.now\(\)/);
    assert.match(
      screenSource,
      /elapsedMilliseconds\(timer\.startedAt, stoppedAt\)/,
    );
    assert.doesNotMatch(screenSource, /setInterval\(|Date\.now\(\)/);
  });

  it("stops the render loop after replacing the first-second timer with question marks", () => {
    assert.match(screenSource, /const nextText = visibleTimerText/);
    assert.match(
      screenSource,
      /if \(nextText === "\?\?\?"\) \{\s*animationFrameRef\.current = null;\s*return;/,
    );
    assert.match(timerCardSource, /accessibilityElementsHidden=\{timerRunning\}/);
  });

  it("automatically stops official attempts for background and navigation transitions", () => {
    assert.match(screenSource, /stopCurrentRef\.current\("background"\)/);
    assert.match(screenSource, /stopCurrentRef\.current\("navigation"\)/);
    assert.match(screenSource, /savePendingPerfectTimingStop\(userId, input\)/);
    assert.match(pendingStopSource, /SecureStore\.setItem\(/);
    assert.doesNotMatch(pendingStopSource, /setItemAsync/);
  });

  it("clears stale pending stops across resets and disables recovery refetches while active", () => {
    assert.match(screenSource, /error\.status === 404/);
    assert.match(screenSource, /error\.code === "PERFECT_TIMING_RESET"/);
    assert.match(screenSource, /refetchOnReconnect: false/);
    assert.match(screenSource, /refetchOnWindowFocus: false/);
    assert.match(
      screenSource,
      /timerRef\.current\?\.owner === "official" && stateRef\.current/,
    );
    assert.match(screenSource, /state\.activeAttempt\?\.id === timer\.attemptId/);
  });

  it("snapshots a training target and prevents starts while a new target is loading", () => {
    assert.match(screenSource, /targetMs: number \| null/);
    assert.match(screenSource, /const targetMs = timer\.targetMs/);
    assert.match(
      trainingPanelSource,
      /phase === "ready" && !isLoading && !isRefreshing/,
    );
  });

  it("uses the themed design-system modal to confirm staying or continuing", () => {
    assert.match(screenSource, /<ContinueConfirmationModal/);
    assert.match(continueConfirmationModalSource, /<ThemedModal/);
    assert.match(continueConfirmationModalSource, /variant="secondary"/);
    assert.match(continueConfirmationModalSource, /variant="danger"/);
    assert.match(
      continueConfirmationModalSource,
      /testID="perfect-timing-continue-confirmation-stay"/,
    );
    assert.match(
      continueConfirmationModalSource,
      /testID="perfect-timing-continue-confirmation-discard"/,
    );
    assert.doesNotMatch(
      screenSource,
      /Alert\.alert\(\s*t\("quests\.perfectTiming\.continueConfirmTitle"\)/,
    );
    assert.match(screenSource, /continueMutation\.mutate\(result\.id\)/);
  });

  it("shows Keep only for a non-Miss candidate and offers sharing for every finalized result", () => {
    assert.match(
      officialPanelSource,
      /state\.status === "result" && result\?\.tier != null && result\.tier !== "miss"/,
    );
    assert.match(officialPanelSource, /\{state\.finalized \? \(/);
    assert.match(officialPanelSource, /testID="perfect-timing-share"/);
  });
});
