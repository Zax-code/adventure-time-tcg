import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";

import { calculateCollectionCompletion } from "@adventure-time/game-engine";

import { db } from "./client";
import {
  cards,
  imageAssets,
  ownedCards,
  packs,
  userStepSnapshots,
  users,
} from "./schema";

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

  const totalCardsRows = await db
    .select({ id: cards.id })
    .from(cards)
    .where(eq(cards.isArchived, false));
  const totalCards = totalCardsRows.length;
  const uniqueOwned = collection.filter(
    (entry) => !entry.card.isArchived,
  ).length;

  return {
    user,
    stats: {
      totalCards,
      uniqueOwned,
      completionPercentage: calculateCollectionCompletion(
        totalCards,
        uniqueOwned,
      ),
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
  const totalCardsRows = await db
    .select({ id: cards.id })
    .from(cards)
    .where(eq(cards.isArchived, false));
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
      completionPercentage: calculateCollectionCompletion(
        totalCards,
        uniqueOwned,
      ),
    },
  };
}

export async function getImageAssetById(
  assetId: string,
  kind: "card" | "profile",
) {
  return db.query.imageAssets.findFirst({
    where: and(eq(imageAssets.id, assetId), eq(imageAssets.kind, kind)),
  });
}

export async function updatePreferredStepSource(
  userId: string,
  preferredStepSource: "device_health" | "fitbit",
) {
  await db
    .update(users)
    .set({ preferredStepSource, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return db.query.users.findFirst({
    where: eq(users.id, userId),
  });
}

export async function updatePreferredLanguage(
  userId: string,
  preferredLanguage: "en" | "fr",
) {
  await db
    .update(users)
    .set({ preferredLanguage, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return db.query.users.findFirst({
    where: eq(users.id, userId),
  });
}

export async function upsertStepSnapshot(input: {
  userId: string;
  source: "device_health" | "fitbit";
  stepCount: number;
  recordedFor: string;
}) {
  const existing = await db.query.userStepSnapshots.findFirst({
    where: and(
      eq(userStepSnapshots.userId, input.userId),
      eq(userStepSnapshots.source, input.source),
      eq(userStepSnapshots.recordedFor, input.recordedFor),
    ),
  });

  if (existing) {
    await db
      .update(userStepSnapshots)
      .set({
        stepCount: input.stepCount,
        updatedAt: new Date(),
      })
      .where(eq(userStepSnapshots.id, existing.id));

    return db.query.userStepSnapshots.findFirst({
      where: eq(userStepSnapshots.id, existing.id),
    });
  }

  await db.insert(userStepSnapshots).values({
    id: randomUUID(),
    userId: input.userId,
    source: input.source,
    stepCount: input.stepCount,
    recordedFor: input.recordedFor,
    updatedAt: new Date(),
  });

  return db.query.userStepSnapshots.findFirst({
    where: and(
      eq(userStepSnapshots.userId, input.userId),
      eq(userStepSnapshots.source, input.source),
      eq(userStepSnapshots.recordedFor, input.recordedFor),
    ),
  });
}

export async function getLatestStepSnapshot(userId: string) {
  return db.query.userStepSnapshots.findFirst({
    where: eq(userStepSnapshots.userId, userId),
    orderBy: [
      desc(userStepSnapshots.recordedFor),
      desc(userStepSnapshots.updatedAt),
    ],
  });
}

export async function getActivePacks() {
  return db.query.packs.findMany({
    where: eq(packs.isActive, true),
    orderBy: [asc(packs.cost)],
  });
}
