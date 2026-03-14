import { asc, eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import { db, cards } from "@adventure-time/db";
import { adminCardMutationSchema } from "@adventure-time/shared";

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
}
