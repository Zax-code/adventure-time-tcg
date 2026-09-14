import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiClient, type PackOdds } from "../src/index.ts";

const odds: PackOdds = {
  guaranteedSlotCount: 0,
  guaranteedRarity: null,
  randomSlotCount: 2,
  baseRarityPercentages: [
    { rarity: "Common", percentage: 60 },
    { rarity: "Uncommon", percentage: 20 },
    { rarity: "Rare", percentage: 10 },
    { rarity: "Epic", percentage: 7 },
    { rarity: "Legendary", percentage: 3 },
  ],
  weeklyLimit: false,
};
const pack = {
  id: "pack",
  name: "Pack",
  description: "Two cards",
  cardCount: 2,
  cost: 150,
  color: "#ffffff",
  isActive: true,
  guaranteedRarity: null,
  packArtAssetId: null,
  odds,
};

describe("pack odds transport", () => {
  it("returns server-authored odds unchanged for listing and purchase", async () => {
    const originalFetch = globalThis.fetch;
    const requests: { url: string; body?: BodyInit | null }[] = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      requests.push({ url, body: init?.body });
      return Response.json(
        url.endsWith("/open")
          ? { pack, cards: [], newBalance: 50 }
          : { packs: [pack], cardBackVisuals: [] },
      );
    };
    try {
      const client = new ApiClient({ baseUrl: "https://example.test" });
      assert.deepEqual((await client.packs()).packs[0].odds, odds);
      assert.deepEqual(
        (await client.openPack({ packId: "pack" })).pack.odds,
        odds,
      );
      assert.equal(requests[1].body, JSON.stringify({ packId: "pack" }));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it("rejects malformed odds on both response paths", async () => {
    const originalFetch = globalThis.fetch;
    const malformed = { ...pack, odds: { ...odds, randomSlotCount: -1 } };
    globalThis.fetch = async (input) =>
      Response.json(
        String(input).endsWith("/open")
          ? { pack: malformed, cards: [], newBalance: 50 }
          : { packs: [malformed], cardBackVisuals: [] },
      );
    try {
      const client = new ApiClient({ baseUrl: "https://example.test" });
      await assert.rejects(client.packs());
      await assert.rejects(client.openPack({ packId: "pack" }));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
