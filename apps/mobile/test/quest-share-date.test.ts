import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatQuestShareDate,
  resolveQuestShareDateKey,
} from "../src/features/quests/quest-share-date.ts";

describe("quest share dates", () => {
  it("uses the device's current calendar date for an active daily quest", () => {
    const deviceNow = new Date(2026, 6, 15, 0, 30);

    const dateKey = resolveQuestShareDateKey({
      deviceNow,
      questDateKey: "2026-07-14",
    });

    assert.equal(dateKey, "2026-07-15");
    assert.equal(formatQuestShareDate(dateKey, "en"), "Jul 15, 2026");
  });

  it("keeps the original puzzle date when sharing an archive result", () => {
    const dateKey = resolveQuestShareDateKey({
      archive: true,
      deviceNow: new Date(2026, 6, 15, 0, 30),
      questDateKey: "2026-07-14",
    });

    assert.equal(dateKey, "2026-07-14");
    assert.equal(formatQuestShareDate(dateKey, "fr"), "14 juil. 2026");
  });
});
