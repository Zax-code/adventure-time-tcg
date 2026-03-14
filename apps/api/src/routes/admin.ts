import { asc } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import { db, cards } from "@adventure-time/db";

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.get("/admin/cards", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    if (!request.authUser.isAdmin) return reply.code(403).send({ error: "Forbidden" });
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
}
