import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync("app/quests/daily-numbers-play.tsx", "utf8");
const resultStart = source.indexOf("function EquationResult(");
const resultEnd = source.indexOf("function EquationWorkbench(", resultStart);
const equationResultSource = source.slice(resultStart, resultEnd);

describe("Daily Numbers equation result width", () => {
  it("fits 1000 to 100000 without single-line truncation", () => {
    assert.match(
      equationResultSource,
      /w-full text-center[\s\S]*?numberOfLines=\{1\}[\s\S]*?getBoardNumberTextStyle\(previewState\.result\)/,
      "the result text should own the tile width and size itself by digit count",
    );
    const helper = source.match(
      /length <= 3 \? (\d+) : length === 4 \? (\d+) : length === 5 \? (\d+) : (\d+)/,
    );
    assert.ok(helper, "getBoardNumberTextStyle should step sizes by digit count");
    const [, three, four, five, six] = helper.map(Number);

    // Selection row: card padding 16 + 16, four 8px gaps, two 48px operator
    // and "=" tiles, three equal number tiles, 4px text padding per side.
    const laneWidth = (screen) => (screen - 32 - 32 - 4 * 8 - 2 * 48) / 3 - 8;
    // Tabular Nunito digits are about 0.6em each.
    const textWidth = (digits, size) => digits * size * 0.6;

    // 360 is the narrowest phone width still in use (small Android; every
    // current iPhone is at least 375).
    for (const screen of [360, 390]) {
      for (const [digits, size] of [[3, three], [4, four], [5, five], [6, six]]) {
        assert.ok(
          laneWidth(screen) >= textWidth(digits, size),
          `${screen}pt tiles should fit ${digits} digits at ${size}px`,
        );
      }
    }
  });
});
