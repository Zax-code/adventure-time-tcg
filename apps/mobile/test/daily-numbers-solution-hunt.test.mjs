import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const playSource = readFileSync(
  new URL("../app/quests/daily-numbers-play.tsx", import.meta.url),
  "utf8",
);
const englishSource = readFileSync(
  new URL("../src/i18n/locales/en/quests.ts", import.meta.url),
  "utf8",
);
const frenchSource = readFileSync(
  new URL("../src/i18n/locales/fr/quests.ts", import.meta.url),
  "utf8",
);

test("Daily Numbers exposes every post-completion Solution Hunt state", () => {
  assert.match(playSource, /submitDailyNumbersSolutionHunt/);
  assert.match(playSource, /testID="daily-numbers-solution-hunt"/);
  assert.match(playSource, /testID="daily-numbers-solution-hunt-playing"/);
  assert.match(playSource, /testID="daily-numbers-solution-hunt-new"/);
  assert.match(playSource, /testID="daily-numbers-solution-hunt-duplicate"/);
  assert.match(playSource, /testID="daily-numbers-solution-hunt-complete"/);
});

test("Solution Hunt copy stays aligned in English and French", () => {
  for (const key of [
    "solutionHuntTitle",
    "solutionHuntProgress",
    "solutionHuntFindAnother",
    "solutionHuntNewSolution",
    "solutionHuntAlreadyFound",
    "solutionHuntAllFound",
    "solutionHuntNoRewards",
    "solutionHuntPlayingBody",
  ]) {
    assert.match(englishSource, new RegExp(`${key}:`));
    assert.match(frenchSource, new RegExp(`${key}:`));
  }
});
