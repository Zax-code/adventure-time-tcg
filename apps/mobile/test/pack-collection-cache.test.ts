import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  CollectionResponse,
  HomeResponse,
  OpenPackResponse,
} from "@adventure-time/api-client";
import {
  patchCollectionAfterPackOpen,
  patchHomeAfterPackOpen,
} from "../src/features/packs/collection-cache.ts";

const rarity = {
  id: "rarity-common",
  name: "Common",
  dropRate: 1,
  color: "#ffffff",
};

const card = (id: string, name: string) => ({
  id,
  name,
  character: name,
  description: `${name} description`,
  hp: 10,
  attack: 3,
  defense: 2,
  speed: 4,
  type: "Hero" as const,
  rarity,
  imageAssetId: null,
});

const cachedCollection: CollectionResponse = {
  cards: [
    {
      id: "owned-card-existing",
      cardId: "card-existing",
      quantity: 2,
      obtainedAt: "2026-06-01T00:00:00Z",
      card: card("card-existing", "Existing Card"),
    },
    {
      id: "catalog:card-new",
      cardId: "card-new",
      quantity: 0,
      obtainedAt: null,
      card: card("card-new", "New Card"),
    },
  ],
  dust: 25,
  stats: {
    totalCards: 2,
    uniqueOwned: 1,
    completionPercentage: 50,
  },
};

const openResult: OpenPackResponse = {
  pack: {
    id: "pack-basic",
    name: "Basic Pack",
    description: "A basic pack.",
    cardCount: 3,
    cost: 100,
    color: "#ffffff",
    isActive: true,
    guaranteedRarity: null,
    packArtAssetId: null,
    availability: {
      canOpen: true,
      reason: null,
      nextAvailableAt: null,
      opensRemaining: null,
      limit: null,
    },
  },
  cards: [
    { ...card("card-existing", "Existing Card"), isNewForUser: false },
    { ...card("card-new", "New Card"), isNewForUser: true },
    { ...card("card-new", "New Card"), isNewForUser: true },
  ],
  newBalance: 400,
};

describe("pack opening collection cache patches", () => {
  it("increments cached collection quantities immediately after a pack opens", () => {
    const patched = patchCollectionAfterPackOpen(
      cachedCollection,
      openResult,
    );

    assert.equal(
      patched?.cards.find((entry) => entry.cardId === "card-existing")
        ?.quantity,
      3,
    );
    const newEntry = patched?.cards.find(
      (entry) => entry.cardId === "card-new",
    );
    assert.equal(newEntry?.quantity, 2);
    assert.ok(newEntry?.obtainedAt, "newly owned cards need an obtained date");
    assert.equal(patched?.stats.totalCards, 5);
    assert.equal(patched?.stats.uniqueOwned, 2);
    assert.equal(patched?.stats.completionPercentage, 100);
  });

  it("updates cached home collection progress from distinct newly-owned cards", () => {
    const home: HomeResponse = {
      user: {
        id: "user-1",
        email: "user@example.com",
        displayName: "Finn",
        avatarAssetId: null,
        coins: 500,
        dust: 25,
        authMethods: {
          password: true,
          google: false,
          apple: false,
        },
        isAdmin: false,
        isSuperAdmin: false,
        preferredStepSource: "device_health",
        preferredLanguage: "en",
        timezone: "Europe/Paris",
        notificationPreferences: {
          dailyReset: true,
          stepGoal: true,
          pvpInvite: true,
          pvpTurn: true,
          giftReceived: true,
        },
      },
      collectionStats: {
        totalCards: 10,
        uniqueOwned: 4,
        completionPercentage: 40,
      },
    };

    const patched = patchHomeAfterPackOpen(home, openResult);

    assert.equal(patched?.user.coins, 400);
    assert.equal(patched?.collectionStats.totalCards, 10);
    assert.equal(patched?.collectionStats.uniqueOwned, 5);
    assert.equal(patched?.collectionStats.completionPercentage, 50);
  });
});
