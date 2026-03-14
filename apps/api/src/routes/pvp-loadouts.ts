import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import { db, cards, ownedCards, pvpLoadouts } from "@adventure-time/db";
import { pvpLoadoutMutationSchema } from "@adventure-time/shared";

import { validateLoadoutRarityCaps } from "../lib/loadout-rules";

function serializeLoadout(loadout: typeof pvpLoadouts.$inferSelect, invalidCardIds: string[]) {
  return {
    id: loadout.id,
    ownerId: loadout.ownerId,
    name: loadout.name,
    cardIds: loadout.cardIds.split(",").filter(Boolean),
    invalidCardIds,
    createdAt: loadout.createdAt.toISOString(),
    updatedAt: loadout.updatedAt.toISOString(),
  };
}

async function validateLoadoutOwnership(userId: string, cardIds: string[]) {
  if (cardIds.length !== 6) {
    throw new Error("Loadout must have exactly 6 cards");
  }
  const uniqueCards = new Set(cardIds);
  if (uniqueCards.size !== cardIds.length) {
    throw new Error("Loadout cannot have duplicate cards");
  }
  const owned = await db.query.ownedCards.findMany({ where: and(eq(ownedCards.userId, userId), inArray(ownedCards.cardId, cardIds)) });
  const ownedIds = new Set(owned.map((entry) => entry.cardId));
  const missing = cardIds.filter((cardId) => !ownedIds.has(cardId));
  if (missing.length > 0) {
    throw new Error("You don't own all selected cards");
  }
  const cardRows = await db.query.cards.findMany({ where: inArray(cards.id, cardIds), with: { rarity: true } });
  const rarityValidation = validateLoadoutRarityCaps(cardRows.map((card) => card.rarity));
  if (!rarityValidation.valid) {
    throw new Error(rarityValidation.error);
  }
}

export async function pvpLoadoutRoutes(fastify: FastifyInstance) {
  fastify.get("/pvp/loadouts", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const loadouts = await db.query.pvpLoadouts.findMany({ where: eq(pvpLoadouts.ownerId, request.authUser.id), orderBy: [desc(pvpLoadouts.createdAt)] });
    const allCardIds = [...new Set(loadouts.flatMap((loadout) => loadout.cardIds.split(",").filter(Boolean)))];
    const owned = await db.query.ownedCards.findMany({ where: and(eq(ownedCards.userId, request.authUser.id), inArray(ownedCards.cardId, allCardIds.length > 0 ? allCardIds : ["__none__"])) });
    const ownedSet = new Set(owned.map((entry) => entry.cardId));
    return {
      loadouts: loadouts.map((loadout) => serializeLoadout(loadout, loadout.cardIds.split(",").filter(Boolean).filter((cardId) => !ownedSet.has(cardId)))),
    };
  });

  fastify.post("/pvp/loadouts", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const body = pvpLoadoutMutationSchema.parse(request.body);
    try {
      await validateLoadoutOwnership(request.authUser.id, body.cardIds);
      const loadout = await db.insert(pvpLoadouts).values({
        id: randomUUID(),
        ownerId: request.authUser.id,
        name: body.name,
        cardIds: body.cardIds.join(","),
      }).returning().then((rows) => rows[0]);
      return reply.code(201).send({ loadout: serializeLoadout(loadout, []) });
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Failed to create loadout" });
    }
  });

  fastify.put("/pvp/loadouts/:id", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const body = pvpLoadoutMutationSchema.parse(request.body);
    const existing = await db.query.pvpLoadouts.findFirst({ where: eq(pvpLoadouts.id, id) });
    if (!existing || existing.ownerId !== request.authUser.id) return reply.code(404).send({ error: "Loadout not found" });
    try {
      await validateLoadoutOwnership(request.authUser.id, body.cardIds);
      await db.update(pvpLoadouts).set({ name: body.name, cardIds: body.cardIds.join(","), updatedAt: new Date() }).where(eq(pvpLoadouts.id, id));
      const loadout = await db.query.pvpLoadouts.findFirst({ where: eq(pvpLoadouts.id, id) });
      return { loadout: serializeLoadout(loadout!, []) };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Failed to update loadout" });
    }
  });

  fastify.delete("/pvp/loadouts/:id", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const existing = await db.query.pvpLoadouts.findFirst({ where: eq(pvpLoadouts.id, id) });
    if (!existing || existing.ownerId !== request.authUser.id) return reply.code(404).send({ error: "Loadout not found" });
    await db.delete(pvpLoadouts).where(eq(pvpLoadouts.id, id));
    return { success: true };
  });
}
