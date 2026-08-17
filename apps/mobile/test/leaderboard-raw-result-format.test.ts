import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatLeaderboardRawResult } from "../src/features/leaderboards/format-raw-result.ts";

const translations: Record<string, string> = {
  "rankings.results.seconds": "{seconds} s",
  "rankings.results.minutesSeconds": "{minutes} min {seconds} s",
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
});
