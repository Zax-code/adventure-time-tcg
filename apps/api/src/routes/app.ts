import { FastifyInstance } from "fastify";

import {
  getCollectionForUser,
  getImageAssetById,
  getLatestStepSnapshot,
  getUserWithCollectionStats,
  updatePreferredStepSource,
  upsertStepSnapshot,
} from "@adventure-time/db";
import { syncStepsSchema, updateStepSourceSchema } from "@adventure-time/shared";

import { getPrivateObject } from "../services/media-service";

export async function appRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async () => ({ status: "ok" }));
  fastify.get("/ready", async () => ({ status: "ready" }));

  fastify.get("/me", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
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
    };
  });

  fastify.get("/home", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
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
      },
      collectionStats: result.stats,
    };
  });

  fastify.get("/collection", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const userContext = request.authUser;
    if (!userContext) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    return getCollectionForUser(userContext.id);
  });

  fastify.patch("/settings/step-source", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const userContext = request.authUser;
    if (!userContext) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const body = updateStepSourceSchema.parse(request.body);
    const user = await updatePreferredStepSource(userContext.id, body.preferredStepSource);
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
    };
  });

  fastify.get("/health/steps", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
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
  });

  fastify.post("/health/steps", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
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
  });

  fastify.get("/media/card/:id", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
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
  });

  fastify.get("/media/profile/:id", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
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
  });
}
