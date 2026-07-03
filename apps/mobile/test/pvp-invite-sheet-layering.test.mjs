import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const rootLayoutPath = new URL("../app/_layout.tsx", import.meta.url);
const pvpTabPath = new URL("../app/(tabs)/pvp.tsx", import.meta.url);
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
      /if \(Platform\.OS === "ios" && iosPresentation === "portal"\) \{[\s\S]*return <AppOverlayPortal>\{sheet\}<\/AppOverlayPortal>;/,
    );
    assert.doesNotMatch(
      battleSheetSource,
      /if \(Platform\.OS === "ios"\) \{[\s\S]*return sheet;/,
    );
  });

  it("uses the native iOS modal path for the portrait invite sheet", async () => {
    const [pvpTabSource, battleSheetSource] = await Promise.all([
      readFile(pvpTabPath, "utf8"),
      readFile(battleSheetPath, "utf8"),
    ]);

    assert.match(battleSheetSource, /iosPresentation = "portal"/);
    assert.match(
      pvpTabSource,
      /testID="pvp-invite-sheet"[\s\S]*iosPresentation="modal"/,
    );
    assert.match(
      pvpTabSource,
      /testID="pvp-invite-sheet"[\s\S]*showCloseButton=\{false\}/,
    );
  });
});
