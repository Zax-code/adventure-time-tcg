import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const questsTabPath = new URL("../app/(tabs)/quests.tsx", import.meta.url);
const overlayPortalPath = new URL(
  "../src/components/app-overlay-portal.tsx",
  import.meta.url,
);

describe("app-root overlays follow screen focus", () => {
  it("mounts the quest hub sheets only while the Quests tab is focused", async () => {
    const source = await readFile(questsTabPath, "utf8");

    assert.match(source, /const screenFocused = useIsFocused\(\);/);
    assert.match(
      source,
      /\{screenFocused && activeLauncher === "wordle" \? \(\s*<QuestLaunchSheet/,
    );
    assert.match(source, /\{screenFocused \? \(\s*<QuestOrderSheet/);
    assert.match(
      source,
      /\{screenFocused && activeLauncher === "dailyNumbers" \? \(\s*<QuestLaunchSheet/,
    );
    assert.match(
      source,
      /\{screenFocused && recapActions\.length > 0 \? \(\s*<QuestRecapSheet/,
    );
  });

  it("drops a portal overlay while its owning screen is blurred", async () => {
    const source = await readFile(overlayPortalPath, "utf8");

    assert.match(source, /const isFocused = useIsFocused\(\);/);
    assert.match(
      source,
      /if \(isFocused\) \{\s*context\?\.addOverlay\(id, children\);\s*\} else \{\s*context\?\.removeOverlay\(id\);/,
    );
  });
});
