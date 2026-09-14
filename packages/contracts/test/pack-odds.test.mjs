import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminPackSchema,
  openPackResponseSchema,
  packOddsSchema,
  packsResponseSchema,
  rarityNameValues,
} from "../src/index.ts";

const percentages = [52, 28, 15, 4, 1];
const odds = {
  guaranteedSlotCount: 0,
  guaranteedRarity: null,
  randomSlotCount: 2,
  baseRarityPercentages: rarityNameValues.map((rarity, index) => ({
    rarity,
    percentage: percentages[index],
  })),
  weeklyLimit: false,
};
const pack = {
  id: "basic",
  name: "Basic",
  description: "Two cards",
  cardCount: 2,
  cost: 150,
  color: "#ffffff",
  isActive: true,
  guaranteedRarity: null,
  packArtAssetId: null,
  odds,
};
const response = (value) => ({ packs: [value], cardBackVisuals: [] });

describe("server-authored pack odds", () => {
  it("validates both storefront and opening responses", () => {
    assert.deepEqual(
      packsResponseSchema.parse(response(pack)).packs[0].odds,
      odds,
    );
    assert.deepEqual(
      openPackResponseSchema.parse({ pack, cards: [], newBalance: 0 }).pack
        .odds,
      odds,
    );
  });
  it("accepts exact guarantees and Legendary adjusted base percentages", () => {
    const adjusted = {
      ...odds,
      guaranteedSlotCount: 1,
      guaranteedRarity: "Legendary",
      randomSlotCount: 6,
      weeklyLimit: true,
      baseRarityPercentages: odds.baseRarityPercentages.map((row) => ({
        ...row,
        percentage:
          row.rarity === "Common"
            ? 52.75
            : row.rarity === "Legendary"
              ? 0.25
              : row.percentage,
      })),
    };
    assert.equal(
      packsResponseSchema.safeParse(
        response({
          ...pack,
          cardCount: 7,
          guaranteedRarity: "Legendary",
          odds: adjusted,
        }),
      ).success,
      true,
    );
  });
  it("represents unavailable odds without inventing percentages", () => {
    assert.equal(
      packOddsSchema.safeParse({ ...odds, baseRarityPercentages: null })
        .success,
      true,
    );
    assert.equal(
      packOddsSchema.safeParse({
        ...odds,
        guaranteedSlotCount: 1,
        guaranteedRarity: "Rare",
        randomSlotCount: 0,
        baseRarityPercentages: null,
      }).success,
      true,
    );
    assert.equal(
      packOddsSchema.safeParse({ ...odds, randomSlotCount: 0 }).success,
      false,
    );
  });
  it("requires odds for players while preserving the separate admin shape", () => {
    const { odds: _odds, ...withoutOdds } = pack;
    assert.equal(
      packsResponseSchema.safeParse(response(withoutOdds)).success,
      false,
    );
    assert.equal(adminPackSchema.safeParse(withoutOdds).success, true);
  });
  it("rejects malformed slot counts, guarantees, and weekly flags", () => {
    for (const invalid of [
      { guaranteedSlotCount: -1 },
      { guaranteedSlotCount: 2 },
      { guaranteedSlotCount: 0.5 },
      { guaranteedSlotCount: 1 },
      { guaranteedRarity: "Rare" },
      { randomSlotCount: -1 },
      { randomSlotCount: 1.5 },
      { weeklyLimit: "true" },
    ])
      assert.equal(
        packOddsSchema.safeParse({ ...odds, ...invalid }).success,
        false,
      );
    assert.equal(
      packsResponseSchema.safeParse(response({ ...pack, cardCount: 3 }))
        .success,
      false,
    );
    assert.equal(
      packsResponseSchema.safeParse(
        response({ ...pack, guaranteedRarity: "Rare" }),
      ).success,
      false,
    );
  });
  it("rejects nonfinite, negative, excessive, and unnormalized percentages", () => {
    for (const percentage of [NaN, Infinity, -Infinity, -1, 101, "52", 51]) {
      const baseRarityPercentages = odds.baseRarityPercentages.map((row, i) =>
        i === 0 ? { ...row, percentage } : row,
      );
      assert.equal(
        packOddsSchema.safeParse({ ...odds, baseRarityPercentages }).success,
        false,
      );
    }
  });
  it("requires all canonical rarities once in deterministic order", () => {
    for (const baseRarityPercentages of [
      odds.baseRarityPercentages.slice(1),
      [...odds.baseRarityPercentages].reverse(),
      odds.baseRarityPercentages.map((row) => ({ ...row, rarity: "Common" })),
      odds.baseRarityPercentages.map((row) => ({ ...row, rarity: "Mythic" })),
    ])
      assert.equal(
        packOddsSchema.safeParse({ ...odds, baseRarityPercentages }).success,
        false,
      );
  });
  it("rejects hidden protection and internal fields in odds", () => {
    for (const key of [
      "sparkCounter",
      "sparkThreshold",
      "protectionProgress",
      "revealSource",
    ])
      assert.equal(
        packOddsSchema.safeParse({ ...odds, [key]: 1 }).success,
        false,
      );
  });
});
