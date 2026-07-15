import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync("app/quests/daily-numbers-play.tsx", "utf8");
const resultStart = source.indexOf("function EquationResult(");
const resultEnd = source.indexOf("function EquationWorkbench(", resultStart);
const equationResultSource = source.slice(resultStart, resultEnd);
const resultDetailsStart = source.indexOf("function ResultDetails(");
const resultDetailsEnd = source.indexOf(
  "function FinishStatePanel(",
  resultDetailsStart,
);
const resultDetailsSource = source.slice(resultDetailsStart, resultDetailsEnd);
const finishStateStart = source.indexOf("function FinishStatePanel(");
const finishStateEnd = source.indexOf(
  "function AvailableNumbersGrid(",
  finishStateStart,
);
const finishStateSource = source.slice(finishStateStart, finishStateEnd);

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

describe("Daily Numbers finish state layout", () => {
  it("separates every starting number into its own compact cell", () => {
    assert.match(
      resultDetailsSource,
      /h-11 min-w-\[46px\].*rounded-xl border border-primaryBorder bg-surface/,
      "starting numbers should render in distinct themed cells",
    );
  });

  it("gives an exact-hit target equal typographic weight to the outcome", () => {
    assert.match(
      finishStateSource,
      /testID="daily-numbers-exact-target"/,
      "exact hits should promote the target into the celebration panel",
    );
    assert.match(
      finishStateSource,
      /const resultEmphasisClass = compact[\s\S]*?testID="daily-numbers-exact-target"[\s\S]*?className=\{`\$\{resultEmphasisClass\}[\s\S]*?testID="daily-numbers-result-outcome"/,
      "the exact target and outcome should share the same responsive emphasis",
    );
    assert.match(
      finishStateSource,
      /<\/Animated\.View>\s*\{exactHitState \? \(\s*<Animated\.Text[\s\S]*?testID="daily-numbers-result-outcome"/,
      "the exact-hit label should sit outside and below the tinted result panel",
    );
  });

  it("uses star particles without oversized square decorations", () => {
    assert.equal(
      finishStateSource.match(/✦/g)?.length,
      2,
      "the result hero should keep its two star particles",
    );
    assert.doesNotMatch(
      finishStateSource,
      /absolute -left-4 top-5 h-12 w-12|absolute -right-5 bottom-4 h-16 w-16/,
      "the result hero should not contain large rounded-square particles",
    );
  });
});
