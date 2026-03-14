import { and, eq } from "drizzle-orm";

import { calculateCollectionCompletion } from "@adventure-time/game-engine";

import { db } from "./client";
import { cards, imageAssets, ownedCards, users } from "./schema";

export async function getUserByEmail(email: string) {
  return db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
}

export async function getUserWithCollectionStats(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return null;
  }

  const collection = await db.query.ownedCards.findMany({
    where: eq(ownedCards.userId, userId),
    with: {
      card: {
        with: {
          rarity: true,
          imageAsset: true,
        },
      },
    },
    orderBy: (table, { desc }) => [desc(table.obtainedAt)],
  });

  const totalCardsRows = await db.select({ id: cards.id }).from(cards).where(eq(cards.isArchived, false));
  const totalCards = totalCardsRows.length;
  const uniqueOwned = collection.filter((entry) => !entry.card.isArchived).length;

  return {
    user,
    stats: {
      totalCards,
      uniqueOwned,
      completionPercentage: calculateCollectionCompletion(totalCards, uniqueOwned),
    },
  };
}

export async function getCollectionForUser(userId: string) {
  const rows = await db.query.ownedCards.findMany({
    where: eq(ownedCards.userId, userId),
    with: {
      card: {
        with: {
          rarity: true,
          imageAsset: true,
        },
      },
    },
    orderBy: (table, { desc }) => [desc(table.obtainedAt)],
  });

  const filteredRows = rows.filter((row) => !row.card.isArchived);
  const totalCardsRows = await db.select({ id: cards.id }).from(cards).where(eq(cards.isArchived, false));
  const totalCards = totalCardsRows.length;
  const uniqueOwned = filteredRows.length;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });

  return {
    cards: filteredRows.map((row) => ({
      id: row.id,
      cardId: row.cardId,
      quantity: row.quantity,
      obtainedAt: row.obtainedAt.toISOString(),
      card: {
        id: row.card.id,
        name: row.card.name,
        character: row.card.character,
        description: row.card.description,
        hp: row.card.hp,
        attack: row.card.attack,
        defense: row.card.defense,
        speed: row.card.speed,
        type: row.card.type,
        imageAssetId: row.card.imageAssetId,
        rarity: {
          id: row.card.rarity.id,
          name: row.card.rarity.name,
          dropRate: row.card.rarity.dropRate,
          color: row.card.rarity.color,
        },
      },
    })),
    dust: user?.dust ?? 0,
    stats: {
      totalCards,
      uniqueOwned,
      completionPercentage: calculateCollectionCompletion(totalCards, uniqueOwned),
    },
  };
}

export async function getImageAssetById(assetId: string, kind: "card" | "profile") {
  return db.query.imageAssets.findFirst({
    where: and(eq(imageAssets.id, assetId), eq(imageAssets.kind, kind)),
  });
}
