import { asc, eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import { randomUUID } from "node:crypto";

import {
  db,
  abilityDefs,
  cardAbilities,
  cards,
  imageAssets,
} from "@adventure-time/db";
import {
  adminAbilityEditSchema,
  adminCardAbilityAssignSchema,
  adminCardEditSchema,
  adminCardMutationSchema,
} from "@adventure-time/shared";
import { putPrivateObject } from "../services/media-service";
import { translateAbilityToFrench } from "../services/ability-translation-service";

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
  fastify.post(
    "/admin/cards",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const body = adminCardEditSchema.parse(request.body);
      const inserted = await db
        .insert(cards)
        .values({
          id: randomUUID(),
          name: body.name,
          character: body.character,
          description: body.description,
          hp: body.hp,
          attack: body.attack,
          defense: body.defense,
          speed: body.speed,
          type: body.type,
          rarityId: body.rarityId,
          isFeatured: body.isFeatured ?? false,
          isArchived: body.isArchived ?? false,
          updatedAt: new Date(),
        })
        .returning()
        .then((rows) => rows[0]);
      const card = await db.query.cards.findFirst({
        where: eq(cards.id, inserted.id),
        with: { rarity: true },
      });
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
    },
  );

  fastify.post(
    "/admin/cards/:id/image",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const { id } = request.params as { id: string };
      const existing = await db.query.cards.findFirst({
        where: eq(cards.id, id),
      });
      if (!existing) return reply.code(404).send({ error: "Card not found" });
      const data = await (request as any).file();
      if (!data) return reply.code(400).send({ error: "No file uploaded" });
      const buffer = await data.toBuffer();
      const mimeType = data.mimetype as string;
      const objectKey = `card/${id}/${randomUUID()}`;
      await putPrivateObject(objectKey, buffer, mimeType);
      const assetId = randomUUID();
      await db
        .insert(imageAssets)
        .values({ id: assetId, kind: "card", mimeType, objectKey });
      await db
        .update(cards)
        .set({ imageAssetId: assetId, updatedAt: new Date() })
        .where(eq(cards.id, id));
      return { assetId };
    },
  );

  fastify.get(
    "/admin/cards",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const rows = await db.query.cards.findMany({
        with: { rarity: true },
        orderBy: [asc(cards.name)],
      });
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
    },
  );

  fastify.patch(
    "/admin/cards/:id",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const { id } = request.params as { id: string };
      const body = adminCardMutationSchema.parse(request.body);
      const existing = await db.query.cards.findFirst({
        where: eq(cards.id, id),
        with: { rarity: true },
      });
      if (!existing) {
        return reply.code(404).send({ error: "Card not found" });
      }

      await db
        .update(cards)
        .set({
          ...(body.isFeatured !== undefined
            ? { isFeatured: body.isFeatured }
            : {}),
          ...(body.isArchived !== undefined
            ? { isArchived: body.isArchived }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(cards.id, id));

      const card = await db.query.cards.findFirst({
        where: eq(cards.id, id),
        with: { rarity: true },
      });
      return {
        id: card!.id,
        name: card!.name,
        character: card!.character,
        rarityName: card!.rarity.name,
        isArchived: card!.isArchived,
        isFeatured: card!.isFeatured,
      };
    },
  );

  fastify.get(
    "/admin/cards/:id",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const { id } = request.params as { id: string };
      const card = await db.query.cards.findFirst({
        where: eq(cards.id, id),
        with: { rarity: true },
      });
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
    },
  );

  fastify.put(
    "/admin/cards/:id",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const { id } = request.params as { id: string };
      const body = adminCardEditSchema.parse(request.body);
      const existing = await db.query.cards.findFirst({
        where: eq(cards.id, id),
        with: { rarity: true },
      });
      if (!existing) {
        return reply.code(404).send({ error: "Card not found" });
      }
      await db
        .update(cards)
        .set({
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
        })
        .where(eq(cards.id, id));
      const card = await db.query.cards.findFirst({
        where: eq(cards.id, id),
        with: { rarity: true },
      });
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
    },
  );

  fastify.get(
    "/admin/abilities",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const [abilities, assignments, cardRows] = await Promise.all([
        db.query.abilityDefs.findMany({
          orderBy: [asc(abilityDefs.type), asc(abilityDefs.key)],
        }),
        db.query.cardAbilities.findMany(),
        db.query.cards.findMany({ orderBy: [asc(cards.name)] }),
      ]);
      return {
        abilities: abilities.map((ability) => ({
          id: ability.id,
          key: ability.key,
          name: ability.name,
          description: ability.description,
          descriptionFr: ability.descriptionFr,
          nameFr: ability.nameFr,
          type: ability.type,
          cost: ability.cost,
          cooldown: ability.cooldown,
          oncePerMatch: ability.oncePerMatch,
          payload: JSON.parse(ability.payload),
        })),
        cardAbilities: assignments,
        cards: cardRows.map((card) => ({
          id: card.id,
          name: card.name,
          character: card.character,
          type: card.type,
        })),
      };
    },
  );

  fastify.post(
    "/admin/abilities",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const body = adminAbilityEditSchema.parse(request.body);
      const existing = await db.query.abilityDefs.findFirst({
        where: eq(abilityDefs.key, body.key),
      });
      if (existing) {
        return reply
          .code(400)
          .send({ error: "An ability with this key already exists" });
      }
      const translated = await translateAbilityToFrench({
        name: body.name,
        description: body.description,
      });
      const inserted = await db
        .insert(abilityDefs)
        .values({
          id: randomUUID(),
          key: body.key,
          name: body.name,
          description: body.description,
          descriptionFr: body.descriptionFr ?? translated.descriptionFr,
          nameFr: body.nameFr ?? translated.nameFr,
          type: body.type,
          cost: body.cost,
          cooldown: body.cooldown ?? null,
          oncePerMatch: body.oncePerMatch ?? false,
          payload: JSON.stringify(body.payload ?? {}),
          updatedAt: new Date(),
        })
        .returning()
        .then((rows) => rows[0]);
      return {
        ability: {
          ...inserted,
          payload: JSON.parse(inserted.payload),
        },
      };
    },
  );

  fastify.patch(
    "/admin/abilities/:id",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const { id } = request.params as { id: string };
      const body = adminAbilityEditSchema.parse(request.body);
      const existing = await db.query.abilityDefs.findFirst({
        where: eq(abilityDefs.id, id),
      });
      if (!existing) {
        return reply.code(404).send({ error: "Ability not found" });
      }
      if (body.key !== existing.key) {
        const duplicate = await db.query.abilityDefs.findFirst({
          where: eq(abilityDefs.key, body.key),
        });
        if (duplicate) {
          return reply
            .code(400)
            .send({ error: "An ability with this key already exists" });
        }
      }
      const shouldAutotranslate =
        body.nameFr == null || body.descriptionFr == null;
      const translated = shouldAutotranslate
        ? await translateAbilityToFrench({
            name: body.name,
            description: body.description,
          })
        : null;
      await db
        .update(abilityDefs)
        .set({
          key: body.key,
          name: body.name,
          description: body.description,
          descriptionFr:
            body.descriptionFr ??
            translated?.descriptionFr ??
            existing.descriptionFr,
          nameFr: body.nameFr ?? translated?.nameFr ?? existing.nameFr,
          type: body.type,
          cost: body.cost,
          cooldown: body.cooldown ?? null,
          oncePerMatch: body.oncePerMatch ?? false,
          payload: JSON.stringify(body.payload ?? {}),
          updatedAt: new Date(),
        })
        .where(eq(abilityDefs.id, id));
      const ability = await db.query.abilityDefs.findFirst({
        where: eq(abilityDefs.id, id),
      });
      return {
        ability: {
          ...ability!,
          payload: JSON.parse(ability!.payload),
        },
      };
    },
  );

  fastify.delete(
    "/admin/abilities/:id",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const { id } = request.params as { id: string };
      const existing = await db.query.abilityDefs.findFirst({
        where: eq(abilityDefs.id, id),
      });
      if (!existing) {
        return reply.code(404).send({ error: "Ability not found" });
      }
      await db.delete(abilityDefs).where(eq(abilityDefs.id, id));
      return { success: true };
    },
  );

  fastify.post(
    "/admin/abilities/assign",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const body = adminCardAbilityAssignSchema.parse(request.body);
      const existingCard = await db.query.cards.findFirst({
        where: eq(cards.id, body.cardId),
      });
      if (!existingCard) {
        return reply.code(404).send({ error: "Card not found" });
      }
      const existing = await db.query.cardAbilities.findFirst({
        where: eq(cardAbilities.cardId, body.cardId),
      });
      if (existing) {
        await db
          .update(cardAbilities)
          .set({
            passiveId: body.passiveId ?? null,
            skillId: body.skillId ?? null,
            ultimateId: body.ultimateId ?? null,
            updatedAt: new Date(),
          })
          .where(eq(cardAbilities.id, existing.id));
      } else {
        await db.insert(cardAbilities).values({
          id: randomUUID(),
          cardId: body.cardId,
          passiveId: body.passiveId ?? null,
          skillId: body.skillId ?? null,
          ultimateId: body.ultimateId ?? null,
          updatedAt: new Date(),
        });
      }
      const assignment = await db.query.cardAbilities.findFirst({
        where: eq(cardAbilities.cardId, body.cardId),
      });
      return { cardAbility: assignment };
    },
  );

  fastify.delete(
    "/admin/abilities/assign/:cardId",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const { cardId } = request.params as { cardId: string };
      const existing = await db.query.cardAbilities.findFirst({
        where: eq(cardAbilities.cardId, cardId),
      });
      if (!existing) {
        return reply
          .code(404)
          .send({ error: "No ability assignment found for this card" });
      }
      await db.delete(cardAbilities).where(eq(cardAbilities.id, existing.id));
      return { success: true };
    },
  );
}
