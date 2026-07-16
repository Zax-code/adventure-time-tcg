import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const hudSource = readFileSync(
  "src/features/quests/speed-calculus/hud-card.tsx",
  "utf8",
);
const questHubSource = readFileSync(
  "src/features/quests/quest-hub-components.tsx",
  "utf8",
);
const collectionSource = readFileSync("app/(tabs)/collection.tsx", "utf8");

describe("mobile UI regression contracts", () => {
  it("keeps the Speed Calculus timer drain on one uninterrupted animation", () => {
    assert.match(
      hudSource,
      /const timerRunning =/,
      "the progress animation should be controlled by stable running/paused transitions",
    );
    assert.doesNotMatch(
      hudSource,
      /reactEffect\(\(\) => \{[\s\S]*?progressAnim\.value = withTiming\(0,[\s\S]*?\}, \[[\s\S]*?remainingSeconds[\s\S]*?\]\);/,
      "ordinary timer ticks must not cancel and restart the progress animation",
    );
  });

  it("gives the quest completion counter an unclipped, shared baseline", () => {
    assert.match(
      questHubSource,
      /accessible[\s\S]*?accessibilityLabel=\{`\$\{finishedCount\} \/ \$\{totalCount\}`\}[\s\S]*?className="flex-row items-baseline/,
      "the counter should use sibling text nodes in a baseline-aligned row",
    );
    assert.match(
      questHubSource,
      /text-\[28px\] leading-10[\s\S]*?\{finishedCount\}/,
      "the large counter value needs a line box with vertical breathing room",
    );
  });

  it("keeps the collection mounted behind its transparent card-detail route", () => {
    assert.doesNotMatch(
      collectionSource,
      /if \(!screenFocused\) \{\s*return null;\s*\}/,
      "losing route focus must stop animation work without blanking the collection",
    );
    assert.match(
      collectionSource,
      /animationsEnabled=\{\s*screenFocused &&\s*appActive &&\s*visibleCardIds\.has\(item\.id\)\s*\}/,
      "off-focus collection cards should remain mounted but stop their animations",
    );
    assert.match(
      collectionSource,
      /\[accessToken, appActive, router, screenFocused, visibleCardIds\]/,
      "focus changes should refresh visible tiles so their animations actually stop and resume",
    );
  });
});
