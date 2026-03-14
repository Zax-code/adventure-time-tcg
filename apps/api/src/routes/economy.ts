import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import { db, cards, ownedCards, users } from "@adventure-time/db";
import { dustActionSchema } from "@adventure-time/shared";

import { getDustCraftCost, getDustSacrificeValue } from "../lib/dust";

export async function economyRoutes(fastify: FastifyInstance) {
  fastify.post("/collection/craft", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const body = dustActionSchema.parse(request.body);
    const card = await db.query.cards.findFirst({ where: eq(cards.id, body.cardId), with: { rarity: true } });
    const user = await db.query.users.findFirst({ where: eq(users.id, request.authUser.id) });
    if (!card) return reply.code(404).send({ error: "Card not found" });
    if (!user) return reply.code(404).send({ error: "User not found" });
    const dustCost = getDustCraftCost(card.rarity.name) * body.quantity;
    if (user.dust < dustCost) return reply.code(400).send({ error: "Not enough dust", required: dustCost, current: user.dust });

    const result = await db.transaction(async (tx) => {
      await tx.update(users).set({ dust: user.dust - dustCost, updatedAt: new Date() }).where(eq(users.id, user.id));
      const existing = await tx.query.ownedCards.findFirst({ where: and(eq(ownedCards.cardId, body.cardId), eq(ownedCards.userId, user.id)) });
      if (existing) {
        await tx.update(ownedCards).set({ quantity: existing.quantity + body.quantity }).where(eq(ownedCards.id, existing.id));
      } else {
        await tx.insert(ownedCards).values({ id: randomUUID(), cardId: body.cardId, userId: user.id, quantity: body.quantity, obtainedAt: new Date() });
      }
      return user.dust - dustCost;
    });

    return { success: true, cardId: body.cardId, quantityCrafted: body.quantity, dustSpent: dustCost, newDustBalance: result };
  });

  fastify.post("/collection/recycle", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const body = dustActionSchema.parse(request.body);
    const owned = await db.query.ownedCards.findFirst({ where: and(eq(ownedCards.cardId, body.cardId), eq(ownedCards.userId, request.authUser.id)), with: { card: { with: { rarity: true } } } });
    if (!owned) return reply.code(404).send({ error: "You do not own this card" });
    if (owned.quantity < body.quantity) return reply.code(400).send({ error: "Not enough copies to recycle", owned: owned.quantity, requested: body.quantity });
    const user = await db.query.users.findFirst({ where: eq(users.id, request.authUser.id) });
    if (!user) return reply.code(404).send({ error: "User not found" });
    const activeLock = false;
    if (activeLock && owned.quantity === body.quantity) return reply.code(400).send({ error: "This card is currently in use in an active PvP match" });
    const dustGained = getDustSacrificeValue(owned.card.rarity.name) * body.quantity;
    const nextDust = user.dust + dustGained;
    await db.transaction(async (tx) => {
      if (owned.quantity === body.quantity) {
        await tx.delete(ownedCards).where(eq(ownedCards.id, owned.id));
      } else {
        await tx.update(ownedCards).set({ quantity: owned.quantity - body.quantity }).where(eq(ownedCards.id, owned.id));
      }
      await tx.update(users).set({ dust: nextDust, updatedAt: new Date() }).where(eq(users.id, user.id));
    });
    return { success: true, cardId: body.cardId, quantityRecycled: body.quantity, dustGained, newDustBalance: nextDust };
  });
}
