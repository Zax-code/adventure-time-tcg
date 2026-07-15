import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync("app/quests/daily-numbers-play.tsx", "utf8");
const resultStart = source.indexOf("function EquationResult(");
const resultEnd = source.indexOf("function EquationWorkbench(", resultStart);
const equationResultSource = source.slice(resultStart, resultEnd);

describe("Daily Numbers equation result layout", () => {
  it("keeps 1000 and 10000 in a dedicated full-width text lane", () => {
    assert.match(
      equationResultSource,
      /className=\{`\$\{boardNumberTextClass\} w-full /,
      "the result number should own the tile width before native font fitting",
    );
    assert.match(
      equationResultSource,
      /className="absolute inset-y-0 right-2/,
      "the action arrow should not consume result-number layout width",
    );
    assert.match(
      equationResultSource,
      /adjustsFontSizeToFit=\{String\(previewState\.result\)\.length > 4\}/,
      "four-digit results should keep normal tile typography while longer results may auto-fit",
    );
  });
});
