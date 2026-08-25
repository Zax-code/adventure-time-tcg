import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSpeedCalculusShareResult } from "../src/features/quests/speed-calculus/share-result.ts";

describe("Speed Calculus share results", () => {
  it("includes every recorded run with errors, correct answers, accuracy, and score", () => {
    const result = buildSpeedCalculusShareResult({
      questTitle: "Speed Calculus",
      date: "2026-08-25",
      runs: [
        {
          runNumber: 1,
          score: 7,
          totalAnswered: 10,
          correctAnswers: 7,
        },
        {
          runNumber: 2,
          score: 9,
          totalAnswered: 11,
          correctAnswers: 9,
        },
        {
          runNumber: 3,
          score: 12,
          totalAnswered: 12,
          correctAnswers: 12,
        },
      ],
    });

    assert.deepEqual(result.runs, [
      {
        runNumber: 1,
        incorrectAnswers: 3,
        correctAnswers: 7,
        accuracyPercentage: 70,
        score: 7,
      },
      {
        runNumber: 2,
        incorrectAnswers: 2,
        correctAnswers: 9,
        accuracyPercentage: 82,
        score: 9,
      },
      {
        runNumber: 3,
        incorrectAnswers: 0,
        correctAnswers: 12,
        accuracyPercentage: 100,
        score: 12,
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
          score: 0,
          totalAnswered: 0,
          correctAnswers: 0,
        },
        {
          runNumber: 1,
          score: 4,
          totalAnswered: 5,
          correctAnswers: 4,
        },
      ],
    });

    assert.deepEqual(
      result.runs.map((run) => ({
        runNumber: run.runNumber,
        ratio: `${run.incorrectAnswers}/${run.correctAnswers}`,
        accuracyPercentage: run.accuracyPercentage,
        score: run.score,
      })),
      [
        { runNumber: 1, ratio: "1/4", accuracyPercentage: 80, score: 4 },
        { runNumber: 2, ratio: "0/0", accuracyPercentage: 0, score: 0 },
      ],
    );
  });

  it("shares a single result when only the first run is available", () => {
    const result = buildSpeedCalculusShareResult({
      questTitle: "Speed Calculus",
      runs: [
        {
          runNumber: 1,
          score: 6,
          totalAnswered: 8,
          correctAnswers: 6,
        },
      ],
    });

    assert.deepEqual(result.runs, [
      {
        runNumber: 1,
        incorrectAnswers: 2,
        correctAnswers: 6,
        accuracyPercentage: 75,
        score: 6,
      },
    ]);
  });
});
