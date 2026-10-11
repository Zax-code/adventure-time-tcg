import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync("app/quests/daily-numbers-play.tsx", "utf8");
const resultStart = source.indexOf("function EquationResult(");
const resultEnd = source.indexOf("function EquationWorkbench(", resultStart);
const equationResultSource = source.slice(resultStart, resultEnd);

describe("Daily Numbers equation result width", () => {
  it("fits 1000 and 1200 without single-line truncation", () => {
    assert.match(
      equationResultSource,
      /w-full text-center[\s\S]*?numberOfLines=\{1\}[\s\S]*?minimumFontScale=\{0\.6\}/,
      "the result text should own the tile width and shrink instead of truncating",
    );

    // Selection row: card padding 16 + 16, four 8px gaps, two 48px operator
    // and "=" tiles, three equal number tiles, 4px text padding per side.
    const laneWidth = (screen) => (screen - 32 - 32 - 4 * 8 - 2 * 48) / 3 - 8;
    // Four tabular Nunito digits at 24px are about 0.6em each.
    const fourDigits = 4 * 24 * 0.6;

    assert.ok(
      laneWidth(390) >= fourDigits * 0.98,
      "regular tiles should fit four digits at (almost) full size",
    );
    assert.ok(
      laneWidth(320) >= fourDigits * 0.6,
      "compact tiles should fit four digits within the minimum font scale",
    );
  });
});
