import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import { db, users, allowedEmails, emailAccessRequests } from "@adventure-time/db";
import {
  adminCoinAdjustSchema,
  adminAllowedEmailSchema,
  adminEmailRequestActionSchema,
} from "@adventure-time/shared";

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

export async function adminUsersRoutes(fastify: FastifyInstance) {
  fastify.get("/admin/users", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const rows = await db.query.users.findMany({ orderBy: [asc(users.email)] });
    return {
      users: rows.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        coins: u.coins,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  });

  fastify.patch("/admin/users/:id/coins", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = adminCoinAdjustSchema.parse(request.body);
    const user = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!user) return reply.code(404).send({ error: "User not found" });
    const newCoins = Math.max(0, user.coins + body.delta);
    await db.update(users).set({ coins: newCoins, updatedAt: new Date() }).where(eq(users.id, id));
    return { id, coins: newCoins };
  });

  fastify.get("/admin/emails", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const rows = await db.query.allowedEmails.findMany({ orderBy: [asc(allowedEmails.email)] });
    return {
      emails: rows.map((row) => ({
        id: row.id,
        email: row.email,
        isAdmin: row.isAdmin,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  });

  fastify.post("/admin/emails", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const body = adminAllowedEmailSchema.parse(request.body);
    const existing = await db.query.allowedEmails.findFirst({ where: eq(allowedEmails.email, body.email.toLowerCase()) });
    if (existing) return reply.code(400).send({ error: "Email already in allowlist" });
    const inserted = await db.insert(allowedEmails).values({
      id: randomUUID(),
      email: body.email.toLowerCase(),
      isAdmin: body.isAdmin ?? false,
    }).returning().then((rows) => rows[0]);
    return { id: inserted.id, email: inserted.email, isAdmin: inserted.isAdmin, createdAt: inserted.createdAt.toISOString() };
  });

  fastify.patch("/admin/emails/:id", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = adminAllowedEmailSchema.parse(request.body);
    const existing = await db.query.allowedEmails.findFirst({ where: eq(allowedEmails.id, id) });
    if (!existing) return reply.code(404).send({ error: "Allowed email not found" });
    await db.update(allowedEmails).set({
      ...(body.isAdmin !== undefined ? { isAdmin: body.isAdmin } : {}),
    }).where(eq(allowedEmails.id, id));
    const updated = await db.query.allowedEmails.findFirst({ where: eq(allowedEmails.id, id) });
    return { id: updated!.id, email: updated!.email, isAdmin: updated!.isAdmin, createdAt: updated!.createdAt.toISOString() };
  });

  fastify.delete("/admin/emails/:id", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const existing = await db.query.allowedEmails.findFirst({ where: eq(allowedEmails.id, id) });
    if (!existing) return reply.code(404).send({ error: "Allowed email not found" });
    await db.delete(allowedEmails).where(eq(allowedEmails.id, id));
    return { success: true };
  });

  fastify.get("/admin/email-requests", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const rows = await db.query.emailAccessRequests.findMany({ orderBy: [asc(emailAccessRequests.createdAt)] });
    return {
      requests: rows.map((row) => ({
        id: row.id,
        email: row.email,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  });

  fastify.patch("/admin/email-requests/:id", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = adminEmailRequestActionSchema.parse(request.body);
    const existing = await db.query.emailAccessRequests.findFirst({ where: eq(emailAccessRequests.id, id) });
    if (!existing) return reply.code(404).send({ error: "Access request not found" });
    await db.update(emailAccessRequests).set({ status: body.status, updatedAt: new Date() }).where(eq(emailAccessRequests.id, id));
    if (body.status === "approved") {
      const inAllowlist = await db.query.allowedEmails.findFirst({ where: eq(allowedEmails.email, existing.email) });
      if (!inAllowlist) {
        await db.insert(allowedEmails).values({ id: randomUUID(), email: existing.email, isAdmin: false });
      }
    }
    return { id, status: body.status };
  });
}
