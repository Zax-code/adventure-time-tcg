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
      /w-full \$\{compact \? "px-2" : "px-3"\} text-center/,
      "the result text should use responsive padding",
    );

    const compactLaneWidth = (320 - 24) * 0.315 - 4 - 16 - 16;
    const regularLaneWidth = (390 - 32) * 0.315 - 4 - 16 - 24;

    assert.ok(
      compactLaneWidth >= 52.8,
      "compact tiles should fit four tabular Nunito digits at 22px",
    );
    assert.ok(
      regularLaneWidth >= 60,
      "regular tiles should fit four tabular Nunito digits at 25px",
    );
  });
});
