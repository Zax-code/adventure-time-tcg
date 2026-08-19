import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatLeaderboardRawResult } from "../src/features/leaderboards/format-raw-result.ts";

const translations: Record<string, string> = {
  "rankings.results.seconds": "{seconds} s",
  "rankings.results.minutesSeconds": "{minutes} min {seconds} s",
  "rankings.results.weeklyCorrect": "{count} correct",
  "rankings.results.weeklyExact": "{exact}/{results} exact · {duration}",
  "rankings.results.weeklyHits": "{hits}/{results} hits · {error} ms",
  "rankings.results.weeklyMinutesSeconds": "{minutes}m {seconds}s",
  "rankings.results.weeklyScoring": "{scoring}/{results} scored",
  "rankings.results.weeklyWordleGuesses":
    "{solved}/{results} solved · {guesses} guesses",
};

function translate(key: string, params?: Record<string, string | number>) {
  return Object.entries(params ?? {}).reduce(
    (result, [name, value]) => result.replace(`{${name}}`, String(value)),
    translations[key] ?? key,
  );
}

describe("leaderboard raw result formatting", () => {
  it("shows Daily Numbers durations as minutes and decimal seconds", () => {
    assert.equal(
      formatLeaderboardRawResult(
        {
          kind: "exact_completion_time",
          exact: true,
          elapsedMs: 65_432,
        },
        "en",
        translate,
      ),
      "1 min 5.43 s",
    );

    assert.equal(
      formatLeaderboardRawResult(
        {
          kind: "exact_completion_time",
          exact: true,
          elapsedMs: 18_064,
        },
        "en",
        translate,
      ),
      "18.06 s",
    );

    assert.equal(
      formatLeaderboardRawResult(
        {
          kind: "exact_completion_time",
          exact: true,
          elapsedMs: 59_999,
        },
        "en",
        translate,
      ),
      "1 min 0.00 s",
    );

    assert.equal(
      formatLeaderboardRawResult(
        {
          kind: "exact_completion_time",
          exact: true,
          elapsedMs: 65_432,
        },
        "fr",
        translate,
      ),
      "1 min 5,43 s",
    );

    assert.equal(
      formatLeaderboardRawResult(
        {
          kind: "exact_completion_time",
          exact: true,
          elapsedMs: 18_064,
        },
        "fr",
        translate,
      ),
      "18,06 s",
    );
  });

  it("shows successful weekly totals instead of a single daily result", () => {
    assert.equal(
      formatLeaderboardRawResult(
        {
          kind: "weekly_exact_completion",
          exactResults: 5,
          resultCount: 7,
          scoringResultCount: 5,
          totalElapsedMs: 134_000,
        },
        "en",
        translate,
      ),
      "5/7 exact · 2m 14s",
    );

    assert.equal(
      formatLeaderboardRawResult(
        {
          kind: "weekly_wordle",
          solvedResults: 6,
          resultCount: 7,
          scoringResultCount: 6,
          totalGuesses: 21,
        },
        "en",
        translate,
      ),
      "6/7 solved · 21 guesses",
    );

    assert.equal(
      formatLeaderboardRawResult(
        {
          kind: "weekly_correct_answers",
          correctAnswers: 84,
          resultCount: 7,
          scoringResultCount: 7,
        },
        "en",
        translate,
      ),
      "84 correct",
    );

    assert.equal(
      formatLeaderboardRawResult(
        {
          kind: "weekly_duration_error",
          successfulResults: 5,
          resultCount: 6,
          scoringResultCount: 5,
          totalAbsoluteErrorMs: 184,
        },
        "en",
        translate,
      ),
      "5/6 hits · 184 ms",
    );

    assert.equal(
      formatLeaderboardRawResult(
        {
          kind: "weekly_overall",
          familiesPlayed: 5,
          resultCount: 38,
          scoringResultCount: 31,
        },
        "en",
        translate,
      ),
      "31/38 scored",
    );
  });
});
