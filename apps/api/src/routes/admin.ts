import { asc, eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import { db, cards } from "@adventure-time/db";
import { adminCardEditSchema, adminCardMutationSchema } from "@adventure-time/shared";

function ensureAdmin(request: any, reply: any) {
  if (!request.authUser) {
    reply.code(401).send({ error: "Unauthorized" });
    return false;
  }
  if (!request.authUser.isAdmin) {
    reply.code(403).send({ error: "Forbidden" });
    return false;
  }
  return true;
}

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.get("/admin/cards", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const rows = await db.query.cards.findMany({ with: { rarity: true }, orderBy: [asc(cards.name)] });
    return {
      cards: rows.map((card) => ({
        id: card.id,
        name: card.name,
        character: card.character,
        rarityName: card.rarity.name,
        isArchived: card.isArchived,
        isFeatured: card.isFeatured,
      })),
    };
  });

  fastify.patch("/admin/cards/:id", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = adminCardMutationSchema.parse(request.body);
    const existing = await db.query.cards.findFirst({ where: eq(cards.id, id), with: { rarity: true } });
    if (!existing) {
      return reply.code(404).send({ error: "Card not found" });
    }

    await db.update(cards).set({
      ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
      ...(body.isArchived !== undefined ? { isArchived: body.isArchived } : {}),
      updatedAt: new Date(),
    }).where(eq(cards.id, id));

    const card = await db.query.cards.findFirst({ where: eq(cards.id, id), with: { rarity: true } });
    return {
      id: card!.id,
      name: card!.name,
      character: card!.character,
      rarityName: card!.rarity.name,
      isArchived: card!.isArchived,
      isFeatured: card!.isFeatured,
    };
  });

  fastify.get("/admin/cards/:id", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const card = await db.query.cards.findFirst({ where: eq(cards.id, id), with: { rarity: true } });
    if (!card) {
      return reply.code(404).send({ error: "Card not found" });
    }
    return {
      id: card.id,
      name: card.name,
      character: card.character,
      rarityName: card.rarity.name,
      rarityId: card.rarityId,
      isArchived: card.isArchived,
      isFeatured: card.isFeatured,
      description: card.description,
      hp: card.hp,
      attack: card.attack,
      defense: card.defense,
      speed: card.speed,
      type: card.type,
    };
  });

  fastify.put("/admin/cards/:id", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = adminCardEditSchema.parse(request.body);
    const existing = await db.query.cards.findFirst({ where: eq(cards.id, id), with: { rarity: true } });
    if (!existing) {
      return reply.code(404).send({ error: "Card not found" });
    }
    await db.update(cards).set({
      name: body.name,
      character: body.character,
      description: body.description,
      hp: body.hp,
      attack: body.attack,
      defense: body.defense,
      speed: body.speed,
      type: body.type,
      rarityId: body.rarityId,
      isFeatured: body.isFeatured ?? existing.isFeatured,
      isArchived: body.isArchived ?? existing.isArchived,
      updatedAt: new Date(),
    }).where(eq(cards.id, id));
    const card = await db.query.cards.findFirst({ where: eq(cards.id, id), with: { rarity: true } });
    return {
      id: card!.id,
      name: card!.name,
      character: card!.character,
      rarityName: card!.rarity.name,
      rarityId: card!.rarityId,
      isArchived: card!.isArchived,
      isFeatured: card!.isFeatured,
      description: card!.description,
      hp: card!.hp,
      attack: card!.attack,
      defense: card!.defense,
      speed: card!.speed,
      type: card!.type,
    };
  });
}
