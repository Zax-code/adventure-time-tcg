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
          abilities: {
            with: {
              passive: true,
              skill: true,
              ultimate: true,
            },
          },
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
    cards: filteredRows.map((row) => {
      const card = row.card as typeof row.card & {
        abilities?: {
          passive?: {
            key: string;
            name: string;
            nameFr: string | null;
            description: string;
            descriptionFr: string | null;
            type: string;
            cost: number;
            cooldown: number | null;
            oncePerMatch: boolean;
          } | null;
          skill?: {
            key: string;
            name: string;
            nameFr: string | null;
            description: string;
            descriptionFr: string | null;
            type: string;
            cost: number;
            cooldown: number | null;
            oncePerMatch: boolean;
          } | null;
          ultimate?: {
            key: string;
            name: string;
            nameFr: string | null;
            description: string;
            descriptionFr: string | null;
            type: string;
            cost: number;
            cooldown: number | null;
            oncePerMatch: boolean;
          } | null;
        } | null;
      };

      return {
      id: row.id,
      cardId: row.cardId,
      quantity: row.quantity,
      obtainedAt: row.obtainedAt.toISOString(),
      card: {
        id: card.id,
        name: card.name,
        character: card.character,
        description: card.description,
        hp: card.hp,
        attack: card.attack,
        defense: card.defense,
        speed: card.speed,
        type: card.type,
        imageAssetId: card.imageAssetId,
        abilities: card.abilities
          ? {
              passive: card.abilities.passive
                ? {
                    key: card.abilities.passive.key,
                    name: card.abilities.passive.name,
                    nameFr: card.abilities.passive.nameFr,
                    description: card.abilities.passive.description,
                    descriptionFr: card.abilities.passive.descriptionFr,
                    type: card.abilities.passive.type as
                      | "PASSIVE"
                      | "SKILL"
                      | "ULTIMATE",
                    cost: card.abilities.passive.cost,
                    cooldown: card.abilities.passive.cooldown,
                    oncePerMatch: card.abilities.passive.oncePerMatch,
                  }
                : null,
              skill: card.abilities.skill
                ? {
                    key: card.abilities.skill.key,
                    name: card.abilities.skill.name,
                    nameFr: card.abilities.skill.nameFr,
                    description: card.abilities.skill.description,
                    descriptionFr: card.abilities.skill.descriptionFr,
                    type: card.abilities.skill.type as
                      | "PASSIVE"
                      | "SKILL"
                      | "ULTIMATE",
                    cost: card.abilities.skill.cost,
                    cooldown: card.abilities.skill.cooldown,
                    oncePerMatch: card.abilities.skill.oncePerMatch,
                  }
                : null,
              ultimate: card.abilities.ultimate
                ? {
                    key: card.abilities.ultimate.key,
                    name: card.abilities.ultimate.name,
                    nameFr: card.abilities.ultimate.nameFr,
                    description: card.abilities.ultimate.description,
                    descriptionFr: card.abilities.ultimate.descriptionFr,
                    type: card.abilities.ultimate.type as
                      | "PASSIVE"
                      | "SKILL"
                      | "ULTIMATE",
                    cost: card.abilities.ultimate.cost,
                    cooldown: card.abilities.ultimate.cooldown,
                    oncePerMatch: card.abilities.ultimate.oncePerMatch,
                  }
                : null,
            }
          : null,
        rarity: {
          id: card.rarity.id,
          name: card.rarity.name,
          dropRate: card.rarity.dropRate,
          color: card.rarity.color,
        },
      },
      };
    }),
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
