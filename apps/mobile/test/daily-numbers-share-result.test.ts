import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDailyNumbersShareFileName,
  buildDailyNumbersShareResult,
} from "../src/features/quests/daily-numbers/share-result.ts";

describe("Daily Numbers share result", () => {
  it("keeps the share model spoiler-safe", () => {
    const result = buildDailyNumbersShareResult({
      questTitle: "Daily Numbers",
      modeLabel: "2 - 4",
      mode: "2-4",
      date: "2026-07-11",
      target: 586,
      finalValue: 586,
      distance: 0,
      score: 100,
      elapsedTime: "0:42",
      exact: true,
      completed: true,
    });

    assert.deepEqual(Object.keys(result).sort(), [
      "archive",
      "completed",
      "date",
      "distance",
      "elapsedTime",
      "exact",
      "finalValue",
      "mode",
      "modeLabel",
      "questTitle",
      "score",
      "target",
    ]);
    assert.equal("steps" in result, false);
    assert.equal("officialSolutionSteps" in result, false);
    assert.equal("numbers" in result, false);
  });

  it("keeps exact, solved, missed, and archive filenames recognizable", () => {
    const base = {
      questTitle: "Daily Numbers",
      modeLabel: "1 - 5",
      mode: "1-5" as const,
      date: "2026-07-11",
      target: 586,
      finalValue: 580,
      distance: 6,
      score: 82,
      elapsedTime: "1:23",
    };

    assert.equal(
      buildDailyNumbersShareFileName({
        ...base,
        finalValue: 586,
        distance: 0,
        score: 100,
        exact: true,
        completed: true,
      }),
      "adventure-time-numbers-2026-07-11-1-5-exact-100.png",
    );
    assert.equal(
      buildDailyNumbersShareFileName({
        ...base,
        exact: false,
        completed: true,
      }),
      "adventure-time-numbers-2026-07-11-1-5-solved-82.png",
    );
    assert.equal(
      buildDailyNumbersShareFileName({
        ...base,
        archive: true,
        exact: false,
        completed: false,
      }),
      "adventure-time-numbers-archive-2026-07-11-1-5-missed-82.png",
    );
  });
});
