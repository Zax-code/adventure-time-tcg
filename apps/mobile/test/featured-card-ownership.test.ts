import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync("app/(tabs)/index.tsx", "utf8");

describe("Home featured-card ownership", () => {
  it("locks featured cards from the live collection cache when they are not owned", () => {
    assert.match(
      source,
      /queryKey:\s*\["collection"\][\s\S]*?apiClient\.collection\(\)/,
      "The home screen must subscribe to the shared collection query so ownership changes update without restarting the app.",
    );
    assert.match(
      source,
      /const ownedCardIds = useMemo\([\s\S]*?entry\.quantity > 0[\s\S]*?ids\.add\(entry\.cardId\)/,
      "Featured-card ownership must be derived from positive collection quantities.",
    );
    assert.match(
      source,
      /const isOwned = ownedCardIds\.has\(item\.cardId\)[\s\S]*?<CardTile[\s\S]*?isLocked=\{!isOwned\}[\s\S]*?muted=\{!isOwned\}/,
      "Unowned featured cards must use the same locked presentation as collection cards.",
    );
    assert.match(
      source,
      /\[accessToken, ownedCardIds\]/,
      "The featured-card renderer must refresh when ownership changes.",
    );
  });
});
