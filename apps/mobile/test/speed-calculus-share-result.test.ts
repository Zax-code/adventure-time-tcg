import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSpeedCalculusShareResult } from "../src/features/quests/speed-calculus/share-result.ts";

describe("Speed Calculus share results", () => {
  it("includes every recorded run with correct answers, errors, total answers, and accuracy", () => {
    const result = buildSpeedCalculusShareResult({
      questTitle: "Speed Calculus",
      date: "2026-08-25",
      runs: [
        {
          runNumber: 1,
          totalAnswered: 10,
          correctAnswers: 7,
        },
        {
          runNumber: 2,
          totalAnswered: 11,
          correctAnswers: 9,
        },
        {
          runNumber: 3,
          totalAnswered: 12,
          correctAnswers: 12,
        },
      ],
    });

    assert.deepEqual(result.runs, [
      {
        runNumber: 1,
        correctAnswers: 7,
        errorAnswers: 3,
        totalAnswers: 10,
        accuracyPercentage: 70,
      },
      {
        runNumber: 2,
        correctAnswers: 9,
        errorAnswers: 2,
        totalAnswers: 11,
        accuracyPercentage: 82,
      },
      {
        runNumber: 3,
        correctAnswers: 12,
        errorAnswers: 0,
        totalAnswers: 12,
        accuracyPercentage: 100,
      },
    ]);
  });

  it("shares only the runs performed so far in run order", () => {
    const result = buildSpeedCalculusShareResult({
      questTitle: "Calcul mental rapide",
      date: "2026-08-25",
      runs: [
        {
          runNumber: 2,
          totalAnswered: 0,
          correctAnswers: 0,
        },
        {
          runNumber: 1,
          totalAnswered: 5,
          correctAnswers: 4,
        },
      ],
    });

    assert.deepEqual(
      result.runs.map((run) => ({
        runNumber: run.runNumber,
        ratio: `${run.correctAnswers}/${run.totalAnswers}`,
        errors: run.errorAnswers,
        accuracyPercentage: run.accuracyPercentage,
      })),
      [
        { runNumber: 1, ratio: "4/5", errors: 1, accuracyPercentage: 80 },
        { runNumber: 2, ratio: "0/0", errors: 0, accuracyPercentage: 0 },
      ],
    );
  });

  it("shares a single result when only the first run is available", () => {
    const result = buildSpeedCalculusShareResult({
      questTitle: "Speed Calculus",
      runs: [
        {
          runNumber: 1,
          totalAnswered: 8,
          correctAnswers: 6,
        },
      ],
    });

    assert.deepEqual(result.runs, [
      {
        runNumber: 1,
        correctAnswers: 6,
        errorAnswers: 2,
        totalAnswers: 8,
        accuracyPercentage: 75,
      },
    ]);
  });
});
