import { randomUUID } from "node:crypto";

import { FastifyInstance } from "fastify";

import {
  getCollectionForUser,
  getImageAssetById,
  getLatestStepSnapshot,
  getActivePacks,
  getUserWithCollectionStats,
  updatePreferredLanguage,
  updatePreferredStepSource,
  upsertStepSnapshot,
  db,
  users,
  cards,
  imageAssets,
  rarities,
} from "@adventure-time/db";
import { and, eq } from "drizzle-orm";
import {
  openPackSchema,
  syncStepsSchema,
  updateStepSourceSchema,
  updateLanguageSchema,
  updateDisplayNameSchema,
} from "@adventure-time/shared";

import {
  DAILY_REWARD,
  RESET_TIMEZONE,
  canClaimDaily,
  getTimeUntilNextClaim,
} from "../lib/reset-clock";
import { getPrivateObject, putPrivateObject } from "../services/media-service";
import { openPackForUser } from "../services/pack-service";

export async function appRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async () => ({ status: "ok" }));
  fastify.get("/ready", async () => ({ status: "ready" }));

  fastify.get(
    "/me",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      const userContext = request.authUser;
      if (!userContext) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const result = await getUserWithCollectionStats(userContext.id);
      if (!result) {
        return reply.code(404).send({ error: "User not found" });
      }

      return {
        id: result.user.id,
        email: result.user.email,
        displayName: result.user.displayName,
        avatarAssetId: result.user.avatarAssetId,
        coins: result.user.coins,
        dust: result.user.dust,
        isAdmin: result.user.isAdmin,
        preferredStepSource: result.user.preferredStepSource,
        preferredLanguage: result.user.preferredLanguage,
      };
    },
  );

  fastify.get(
    "/home",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      const userContext = request.authUser;
      if (!userContext) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const result = await getUserWithCollectionStats(userContext.id);
      if (!result) {
        return reply.code(404).send({ error: "User not found" });
      }

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          displayName: result.user.displayName,
          avatarAssetId: result.user.avatarAssetId,
          coins: result.user.coins,
          dust: result.user.dust,
          isAdmin: result.user.isAdmin,
          preferredStepSource: result.user.preferredStepSource,
          preferredLanguage: result.user.preferredLanguage,
        },
        collectionStats: result.stats,
      };
    },
  );

  fastify.get(
    "/collection",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      const userContext = request.authUser;
      if (!userContext) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      return getCollectionForUser(userContext.id);
    },
  );

  fastify.get(
    "/packs",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!request.authUser) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const activePacks = await getActivePacks();
      return { packs: activePacks };
    },
  );

  fastify.post(
    "/packs/open",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      const userContext = request.authUser;
      if (!userContext) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const body = openPackSchema.parse(request.body);

      try {
        return await openPackForUser(userContext.id, body.packId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to open pack";
        if (message === "Not enough coins") {
          return reply.code(400).send({ error: message });
        }
        if (
          message === "Pack not found or inactive" ||
          message === "No cards available"
        ) {
          return reply.code(404).send({ error: message });
        }
        if (message === "User not found") {
          return reply.code(404).send({ error: message });
        }
        return reply.code(500).send({ error: message });
      }
    },
  );

  fastify.get(
    "/daily-claim",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      const userContext = request.authUser;
      if (!userContext) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, userContext.id),
      });
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      const canClaim = canClaimDaily(user.lastDailyClaim ?? null);

      return {
        coins: user.coins,
        canClaim,
        timeUntilNextClaim: canClaim ? 0 : getTimeUntilNextClaim(),
        dailyReward: DAILY_REWARD,
        timezone: RESET_TIMEZONE,
      };
    },
  );

  fastify.post(
    "/daily-claim",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      const userContext = request.authUser;
      if (!userContext) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, userContext.id),
      });
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      if (!canClaimDaily(user.lastDailyClaim ?? null)) {
        return reply.code(400).send({
          error: "Already claimed today",
          timeUntilNextClaim: getTimeUntilNextClaim(),
          timezone: RESET_TIMEZONE,
        });
      }

      const newBalance = user.coins + DAILY_REWARD;
      await db
        .update(users)
        .set({
          coins: newBalance,
          lastDailyClaim: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userContext.id));

      return {
        success: true,
        coinsAwarded: DAILY_REWARD,
        newBalance,
      };
    },
  );

  fastify.get(
    "/admin/status",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!request.authUser) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      if (!request.authUser.isAdmin) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      return {
        ok: true,
        message: "Admin access granted",
      };
    },
  );

  fastify.patch(
    "/settings/step-source",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      const userContext = request.authUser;
      if (!userContext) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const body = updateStepSourceSchema.parse(request.body);
      const user = await updatePreferredStepSource(
        userContext.id,
        body.preferredStepSource,
      );
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarAssetId: user.avatarAssetId,
        coins: user.coins,
        dust: user.dust,
        isAdmin: user.isAdmin,
        preferredStepSource: user.preferredStepSource,
        preferredLanguage: user.preferredLanguage,
      };
    },
  );

  fastify.patch(
    "/settings/language",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      const userContext = request.authUser;
      if (!userContext) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const body = updateLanguageSchema.parse(request.body);
      const user = await updatePreferredLanguage(
        userContext.id,
        body.preferredLanguage,
      );
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarAssetId: user.avatarAssetId,
        coins: user.coins,
        dust: user.dust,
        isAdmin: user.isAdmin,
        preferredStepSource: user.preferredStepSource,
        preferredLanguage: user.preferredLanguage,
      };
    },
  );

  fastify.get(
    "/health/steps",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      const userContext = request.authUser;
      if (!userContext) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const result = await getUserWithCollectionStats(userContext.id);
      if (!result) {
        return reply.code(404).send({ error: "User not found" });
      }

      const latest = await getLatestStepSnapshot(userContext.id);

      return {
        preferredSource: result.user.preferredStepSource,
        latest: latest
          ? {
              source: latest.source,
              stepCount: latest.stepCount,
              recordedFor: latest.recordedFor,
              updatedAt: latest.updatedAt.toISOString(),
            }
          : null,
      };
    },
  );

  fastify.post(
    "/health/steps",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      const userContext = request.authUser;
      if (!userContext) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const body = syncStepsSchema.parse(request.body);
      const snapshot = await upsertStepSnapshot({
        userId: userContext.id,
        source: body.source,
        stepCount: body.stepCount,
        recordedFor: body.recordedFor,
      });

      if (!snapshot) {
        return reply.code(500).send({ error: "Failed to store step data" });
      }

      return reply.code(201).send({
        source: snapshot.source,
        stepCount: snapshot.stepCount,
        recordedFor: snapshot.recordedFor,
        updatedAt: snapshot.updatedAt.toISOString(),
      });
    },
  );

  fastify.get(
    "/rarities",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!request.authUser)
        return reply.code(401).send({ error: "Unauthorized" });
      const rows = await db.query.rarities.findMany();
      return { rarities: rows };
    },
  );

  fastify.get(
    "/featured-cards",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!request.authUser)
        return reply.code(401).send({ error: "Unauthorized" });
      const featuredCards = await db.query.cards.findMany({
        where: and(eq(cards.isFeatured, true), eq(cards.isArchived, false)),
        with: { rarity: true },
      });
      return {
        cards: featuredCards.map((c) => ({
          id: c.id,
          cardId: c.id,
          quantity: 1,
          obtainedAt: new Date().toISOString(),
          card: {
            id: c.id,
            name: c.name,
            character: c.character,
            description: c.description,
            hp: c.hp,
            attack: c.attack,
            defense: c.defense,
            speed: c.speed,
            type: c.type,
            rarity: c.rarity,
            imageAssetId: c.imageAssetId ?? null,
          },
        })),
      };
    },
  );

  fastify.patch(
    "/settings/display-name",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      const userContext = request.authUser;
      if (!userContext) return reply.code(401).send({ error: "Unauthorized" });
      const body = updateDisplayNameSchema.parse(request.body);
      await db
        .update(users)
        .set({ displayName: body.displayName, updatedAt: new Date() })
        .where(eq(users.id, userContext.id));
      const user = await db.query.users.findFirst({
        where: eq(users.id, userContext.id),
      });
      if (!user) return reply.code(404).send({ error: "User not found" });
      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarAssetId: user.avatarAssetId,
        coins: user.coins,
        dust: user.dust,
        isAdmin: user.isAdmin,
        preferredStepSource: user.preferredStepSource,
        preferredLanguage: user.preferredLanguage,
      };
    },
  );

  fastify.post(
    "/settings/upload",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      const userContext = request.authUser;
      if (!userContext) return reply.code(401).send({ error: "Unauthorized" });
      const data = await (request as any).file();
      if (!data) return reply.code(400).send({ error: "No file uploaded" });
      const buffer = await data.toBuffer();
      const mimeType = data.mimetype as string;
      const objectKey = `profile/${userContext.id}/${randomUUID()}`;
      await putPrivateObject(objectKey, buffer, mimeType);
      const assetId = randomUUID();
      await db
        .insert(imageAssets)
        .values({ id: assetId, kind: "profile", mimeType, objectKey });
      await db
        .update(users)
        .set({ avatarAssetId: assetId, updatedAt: new Date() })
        .where(eq(users.id, userContext.id));
      return { assetId };
    },
  );

  fastify.get(
    "/media/card/:id",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const asset = await getImageAssetById(id, "card");

      if (!asset) {
        return reply.code(404).send({ error: "Image not found" });
      }

      const body = asset.objectKey
        ? await getPrivateObject(asset.objectKey)
        : Buffer.from(
            asset.placeholderSvg ??
              `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" fill="#1f2937"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#f9fafb" font-size="28">Adventure Time Card</text></svg>`,
          );
      reply.header("Content-Type", asset.mimeType || "image/svg+xml");
      reply.header("Cache-Control", "private, max-age=3600");
      return reply.send(body);
    },
  );

  fastify.get(
    "/media/profile/:id",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const asset = await getImageAssetById(id, "profile");

      if (!asset) {
        return reply.code(404).send({ error: "Image not found" });
      }

      const body = asset.objectKey
        ? await getPrivateObject(asset.objectKey)
        : Buffer.from(
            asset.placeholderSvg ??
              `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="100%" height="100%" rx="128" fill="#0f766e"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ecfeff" font-size="24">AT</text></svg>`,
          );
      reply.header("Content-Type", asset.mimeType || "image/svg+xml");
      reply.header("Cache-Control", "private, max-age=3600");
      return reply.send(body);
    },
  );
}
