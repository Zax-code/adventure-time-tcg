import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const rootLayoutPath = new URL("../app/_layout.tsx", import.meta.url);
const battleSheetPath = new URL(
  "../src/features/pvp/battle-full-screen-sheet.tsx",
  import.meta.url,
);

describe("PvP invite sheet layering", () => {
  it("keeps the iOS full-screen PvP sheet in the app-root overlay portal", async () => {
    const [rootLayoutSource, battleSheetSource] = await Promise.all([
      readFile(rootLayoutPath, "utf8"),
      readFile(battleSheetPath, "utf8"),
    ]);

    assert.match(rootLayoutSource, /<BottomSheetProvider>\s*<AppOverlayProvider>/);
    assert.match(
      battleSheetSource,
      /if \(Platform\.OS === "ios"\) \{[\s\S]*return <AppOverlayPortal>\{sheet\}<\/AppOverlayPortal>;/,
    );
    assert.doesNotMatch(
      battleSheetSource,
      /if \(Platform\.OS === "ios"\) \{[\s\S]*return sheet;/,
    );
  });
});
