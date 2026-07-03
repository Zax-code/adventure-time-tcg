import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const rootLayoutPath = new URL("../app/_layout.tsx", import.meta.url);
const orientationHookPath = new URL(
  "../src/hooks/use-orientation-lock.ts",
  import.meta.url,
);

describe("PvP landscape route orientation", () => {
  it("uses native stack orientation on iOS instead of a second manual lock", async () => {
    const [rootLayoutSource, orientationHookSource] = await Promise.all([
      readFile(rootLayoutPath, "utf8"),
      readFile(orientationHookPath, "utf8"),
    ]);

    assert.match(
      rootLayoutSource,
      /const LANDSCAPE_SCREEN_OPTIONS = \{[\s\S]*orientation: "landscape"/,
    );
    assert.match(
      orientationHookSource,
      /if \(Platform\.OS === "ios"\) \{[\s\S]*return;/,
    );
  });
});
