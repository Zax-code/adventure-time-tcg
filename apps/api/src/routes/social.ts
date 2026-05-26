import { randomUUID } from "node:crypto";

import { and, desc, eq, or } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import { cardGifts, cards, db, ownedCards, users } from "@adventure-time/db";
import { processGiftSchema, sendGiftSchema } from "@adventure-time/contracts";

function serializeUser(user: { id: string; email: string; displayName: string | null }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? user.email.split("@")[0],
  };
}

export async function socialRoutes(fastify: FastifyInstance) {
  fastify.get("/users", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const rows = await db.query.users.findMany({ where: or(eq(users.isAdmin, true), eq(users.isAdmin, false)) });
    return { users: rows.filter((user) => user.id !== request.authUser!.id).map(serializeUser) };
  });

  fastify.get("/gifts", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const gifts = await db.query.cardGifts.findMany({
      where: or(eq(cardGifts.toUserId, request.authUser.id), eq(cardGifts.fromUserId, request.authUser.id)),
      with: { card: { with: { rarity: true } }, fromUser: true, toUser: true },
      orderBy: [desc(cardGifts.createdAt)],
    });
    return {
      gifts: gifts.map((gift) => ({
        id: gift.id,
        cardId: gift.cardId,
        quantity: gift.quantity,
        message: gift.message ?? null,
        status: gift.status,
        createdAt: gift.createdAt.toISOString(),
        fromUser: serializeUser(gift.fromUser),
        toUser: serializeUser(gift.toUser),
        card: { id: gift.card.id, name: gift.card.name, character: gift.card.character, rarity: { id: gift.card.rarity.id, name: gift.card.rarity.name, dropRate: gift.card.rarity.dropRate, color: gift.card.rarity.color } },
      })),
      pendingCount: gifts.filter((gift) => gift.toUserId === request.authUser!.id && gift.status === "pending").length,
    };
  });

  fastify.post("/gifts", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const body = sendGiftSchema.parse(request.body);
    if (body.toUserId === request.authUser.id) return reply.code(400).send({ error: "Cannot send a gift to yourself" });
    const toUser = await db.query.users.findFirst({ where: eq(users.id, body.toUserId) });
    if (!toUser) return reply.code(404).send({ error: "Recipient not found" });
    const owned = await db.query.ownedCards.findFirst({ where: and(eq(ownedCards.cardId, body.cardId), eq(ownedCards.userId, request.authUser.id)) });
    if (!owned || owned.quantity < body.quantity) return reply.code(400).send({ error: "You do not own enough of this card to gift" });
    const card = await db.query.cards.findFirst({ where: eq(cards.id, body.cardId), with: { rarity: true } });
    if (!card) return reply.code(404).send({ error: "Card not found" });
    const gift = await db.transaction(async (tx) => {
      if (owned.quantity === body.quantity) {
        await tx.delete(ownedCards).where(eq(ownedCards.id, owned.id));
      } else {
        await tx.update(ownedCards).set({ quantity: owned.quantity - body.quantity }).where(eq(ownedCards.id, owned.id));
      }
      await tx.insert(cardGifts).values({ id: randomUUID(), cardId: body.cardId, fromUserId: request.authUser!.id, toUserId: body.toUserId, quantity: body.quantity, message: body.message, status: "pending" });
      return tx.query.cardGifts.findFirst({ where: and(eq(cardGifts.cardId, body.cardId), eq(cardGifts.fromUserId, request.authUser!.id), eq(cardGifts.toUserId, body.toUserId), eq(cardGifts.status, "pending")), with: { fromUser: true, toUser: true, card: { with: { rarity: true } } }, orderBy: [desc(cardGifts.createdAt)] });
    });
    return { gift: { id: gift!.id } };
  });

  fastify.patch("/gifts", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const body = processGiftSchema.parse(request.body);
    const gift = await db.query.cardGifts.findFirst({ where: eq(cardGifts.id, body.giftId) });
    if (!gift) return reply.code(404).send({ error: "Gift not found" });
    if (gift.toUserId !== request.authUser.id) return reply.code(403).send({ error: "This gift is not for you" });
    if (gift.status !== "pending") return reply.code(400).send({ error: "This gift has already been processed" });
    if (body.action === "accept") {
      await db.transaction(async (tx) => {
        const existing = await tx.query.ownedCards.findFirst({ where: and(eq(ownedCards.cardId, gift.cardId), eq(ownedCards.userId, gift.toUserId)) });
        if (existing) {
          await tx.update(ownedCards).set({ quantity: existing.quantity + gift.quantity }).where(eq(ownedCards.id, existing.id));
        } else {
          await tx.insert(ownedCards).values({ id: randomUUID(), cardId: gift.cardId, userId: gift.toUserId, quantity: gift.quantity, obtainedAt: new Date() });
        }
        await tx.update(cardGifts).set({ status: "accepted", updatedAt: new Date() }).where(eq(cardGifts.id, gift.id));
      });
      return { success: true, status: "accepted" };
    }
    await db.transaction(async (tx) => {
      const existing = await tx.query.ownedCards.findFirst({ where: and(eq(ownedCards.cardId, gift.cardId), eq(ownedCards.userId, gift.fromUserId)) });
      if (existing) {
        await tx.update(ownedCards).set({ quantity: existing.quantity + gift.quantity }).where(eq(ownedCards.id, existing.id));
      } else {
        await tx.insert(ownedCards).values({ id: randomUUID(), cardId: gift.cardId, userId: gift.fromUserId, quantity: gift.quantity, obtainedAt: new Date() });
      }
      await tx.update(cardGifts).set({ status: "rejected", updatedAt: new Date() }).where(eq(cardGifts.id, gift.id));
    });
    return { success: true, status: "rejected" };
  });
}
