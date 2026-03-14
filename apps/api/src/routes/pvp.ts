import { FastifyInstance } from "fastify";

import { pvpInviteSchema } from "@adventure-time/shared";

import { createInvite, getMatch, listInvites, listMatches, setMatchStatus } from "../services/pvp-service";

function serializeMatch(match: any) {
  return {
    id: match.id,
    inviterId: match.inviterId,
    inviteeId: match.inviteeId,
    status: match.status,
    inviterLoadout: JSON.parse(match.inviterLoadout),
    inviteeLoadout: JSON.parse(match.inviteeLoadout),
    winnerId: match.winnerId,
    createdAt: match.createdAt.toISOString(),
    updatedAt: match.updatedAt.toISOString(),
  };
}

export async function pvpRoutes(fastify: FastifyInstance) {
  fastify.get("/pvp/invites", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const invites = await listInvites(request.authUser.id);
    return { invites: invites.map(serializeMatch) };
  });

  fastify.post("/pvp/invites", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const body = pvpInviteSchema.parse(request.body);
    try {
      await createInvite(request.authUser.id, body.inviteeEmail, body.loadout);
      return reply.code(201).send({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create invite";
      return reply.code(400).send({ error: message });
    }
  });

  fastify.get("/pvp/matches", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const matches = await listMatches(request.authUser.id);
    return { matches: matches.map(serializeMatch) };
  });

  fastify.get("/pvp/history", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const matches = (await listMatches(request.authUser.id)).filter((match) => match.status === "COMPLETED");
    return { matches: matches.map(serializeMatch) };
  });

  fastify.post("/pvp/matches/:id/accept", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    const body = request.body as { loadout?: string[] };
    try {
      await setMatchStatus(id, request.authUser.id, "accept", body.loadout);
      const match = await getMatch(id, request.authUser.id);
      return serializeMatch(match);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Failed to accept invite" });
    }
  });

  fastify.post("/pvp/matches/:id/decline", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    try {
      await setMatchStatus(id, request.authUser.id, "decline");
      return { success: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Failed to decline invite" });
    }
  });

  fastify.post("/pvp/matches/:id/concede", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const { id } = request.params as { id: string };
    try {
      await setMatchStatus(id, request.authUser.id, "concede");
      return { success: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Failed to concede" });
    }
  });
}
