import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePerfectTimingResult,
  elapsedMilliseconds,
  formatPerfectTimingMilliseconds,
  visibleTimerText,
} from "../src/features/quests/perfect-timing/model.ts";
import { buildPerfectTimingShareResult } from "../src/features/quests/perfect-timing/share-result.ts";

test("elapsed time is rounded from monotonic timestamp differences", () => {
  assert.equal(elapsedMilliseconds(10.2, 6_510.69), 6_500);
  assert.equal(elapsedMilliseconds(1_000, 1_010.49), 10);
});

test("the live timer is visible before one second and exactly hidden at one second", () => {
  assert.equal(visibleTimerText(0, 999.9, "en"), "0.999 s");
  assert.equal(visibleTimerText(0, 1_000, "en"), "???");
  assert.equal(visibleTimerText(0, 8_500, "fr"), "???");
});

test("millisecond formatting uses three decimals and the selected locale", () => {
  assert.equal(formatPerfectTimingMilliseconds(6_500, "en"), "6.500 s");
  assert.equal(formatPerfectTimingMilliseconds(6_500, "fr"), "6,500 s");
});

test("training scoring mirrors all exact integer tier boundaries", () => {
  const target = 6_500;
  assert.deepEqual(calculatePerfectTimingResult(target, target + 10), {
    deviationMs: 10,
    direction: "late",
    tier: "perfect",
    reward: 100,
  });
  assert.equal(calculatePerfectTimingResult(target, target + 11).tier, "amazing");
  assert.equal(calculatePerfectTimingResult(target, target + 50).tier, "amazing");
  assert.equal(calculatePerfectTimingResult(target, target + 51).tier, "great");
  assert.equal(calculatePerfectTimingResult(target, target + 150).reward, 63);
  assert.equal(calculatePerfectTimingResult(target, target + 151).tier, "close");
  assert.equal(calculatePerfectTimingResult(target, target + 300).tier, "close");
  assert.equal(calculatePerfectTimingResult(target, target + 301).tier, "miss");
});

test("share results always contain three rows and preserve unused attempts", () => {
  const result = buildPerfectTimingShareResult({
    questTitle: "Perfect Timing",
    date: "2026-08-08",
    targetMs: 6_500,
    finalTier: "perfect",
    finalizedAttemptNumber: 1,
    attempts: [
      {
        attemptNumber: 1,
        elapsedMs: 6_505,
        tier: "perfect",
      },
    ],
  });

  assert.equal(result.attempts.length, 3);
  assert.equal(result.attempts[0].elapsedMs, 6_505);
  assert.equal(result.attempts[0].finalized, true);
  assert.equal(result.attempts[1].unused, true);
  assert.equal(result.attempts[2].unused, true);
});

test("failed third-attempt shares preserve every performed row and the finalized miss", () => {
  const result = buildPerfectTimingShareResult({
    questTitle: "Timing parfait",
    date: "2026-08-08",
    targetMs: 6_500,
    finalTier: "miss",
    finalizedAttemptNumber: 3,
    attempts: [
      { attemptNumber: 1, elapsedMs: 5_900, tier: "miss" },
      { attemptNumber: 2, elapsedMs: 7_000, tier: "miss" },
      { attemptNumber: 3, elapsedMs: 6_801, tier: "miss" },
    ],
  });

  assert.deepEqual(
    result.attempts.map(({ elapsedMs, unused, finalized }) => ({
      elapsedMs,
      unused,
      finalized,
    })),
    [
      { elapsedMs: 5_900, unused: false, finalized: false },
      { elapsedMs: 7_000, unused: false, finalized: false },
      { elapsedMs: 6_801, unused: false, finalized: true },
    ],
  );
  assert.equal(result.finalTier, "miss");
});
