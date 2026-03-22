import { randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import {
  allowedEmails,
  db,
  emailAccessRequests,
  questDefinitions,
  users,
} from "@adventure-time/db";
import {
  adminAllowedEmailSchema,
  adminAllowedEmailUpdateSchema,
  adminCoinAdjustSchema,
  adminEmailRequestActionSchema,
  adminUserQuestResetInputSchema,
  adminUserRoleUpdateSchema,
} from "@adventure-time/shared";

import {
  buildQuestList,
  materializeDailyQuestsForUser,
  resetDailyQuestsForAdmin,
} from "../services/quest-service";
import { getResetDateKey } from "../lib/reset-clock";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

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

function ensureSuperAdmin(request: any, reply: any) {
  if (!ensureAdmin(request, reply)) {
    return false;
  }
  if (!request.authUser.isSuperAdmin) {
    reply.code(403).send({ error: "Super admin access required" });
    return false;
  }
  return true;
}

function serializeAllowedEmail(row: typeof allowedEmails.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    isAdmin: row.isAdmin,
    isSuperAdmin: row.isSuperAdmin,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function adminUsersRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/admin/users",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const authUser = request.authUser!;

      const [rows, allowlistRows] = await Promise.all([
        db.query.users.findMany({ orderBy: [asc(users.email)] }),
        db.query.allowedEmails.findMany(),
      ]);
      const allowlistByEmail = new Map(
        allowlistRows.map((entry) => [normalizeEmail(entry.email), entry]),
      );

      return {
        users: rows.map((u) => {
          const allowEntry = allowlistByEmail.get(normalizeEmail(u.email));

          return {
            id: u.id,
            email: u.email,
            displayName: u.displayName,
            coins: u.coins,
            isAdmin: u.isAdmin,
            isSuperAdmin: allowEntry?.isSuperAdmin ?? false,
            createdAt: u.createdAt.toISOString(),
          };
        }),
      };
    },
  );

  fastify.get(
    "/admin/users/:id",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const authUser = request.authUser!;

      const { id } = request.params as { id: string };
      const user = await db.query.users.findFirst({ where: eq(users.id, id) });
      if (!user) return reply.code(404).send({ error: "User not found" });

      const todayDate = getResetDateKey(new Date());
      const allowEntry = await db.query.allowedEmails.findFirst({
        where: eq(allowedEmails.email, normalizeEmail(user.email)),
      });

      await materializeDailyQuestsForUser(user.id, todayDate);
      const quests = await buildQuestList(user.id, todayDate);

      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        coins: user.coins,
        isAdmin: user.isAdmin,
        isSuperAdmin: allowEntry?.isSuperAdmin ?? false,
        createdAt: user.createdAt.toISOString(),
        todayDate,
        dailyQuests: quests.quests,
        viewerPermissions: {
          canManageCoins: authUser.isSuperAdmin,
          canManageAdminRights: authUser.isSuperAdmin,
          canResetDailyQuests: authUser.isSuperAdmin,
          canDeleteUser: authUser.isSuperAdmin,
        },
      };
    },
  );

  fastify.patch(
    "/admin/users/:id/coins",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureSuperAdmin(request, reply)) return;
      const authUser = request.authUser!;

      const { id } = request.params as { id: string };
      const body = adminCoinAdjustSchema.parse(request.body);
      const user = await db.query.users.findFirst({ where: eq(users.id, id) });
      if (!user) return reply.code(404).send({ error: "User not found" });

      const newCoins = Math.max(0, user.coins + body.delta);
      await db
        .update(users)
        .set({ coins: newCoins, updatedAt: new Date() })
        .where(eq(users.id, id));
      return { id, coins: newCoins };
    },
  );

  fastify.patch(
    "/admin/users/:id/role",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureSuperAdmin(request, reply)) return;
      const authUser = request.authUser!;

      const { id } = request.params as { id: string };
      const body = adminUserRoleUpdateSchema.parse(request.body);
      const user = await db.query.users.findFirst({ where: eq(users.id, id) });
      if (!user) return reply.code(404).send({ error: "User not found" });

      const normalizedEmail = normalizeEmail(user.email);
      if (normalizeEmail(authUser.email) === normalizedEmail && !body.isAdmin) {
        return reply
          .code(403)
          .send({ error: "Cannot revoke your own admin rights" });
      }

      const existing = await db.query.allowedEmails.findFirst({
        where: eq(allowedEmails.email, normalizedEmail),
      });

      if (body.isAdmin) {
        if (existing) {
          await db
            .update(allowedEmails)
            .set({ isAdmin: true })
            .where(eq(allowedEmails.id, existing.id));
        } else {
          await db.insert(allowedEmails).values({
            id: randomUUID(),
            email: normalizedEmail,
            isAdmin: true,
            isSuperAdmin: false,
          });
        }
      } else if (existing) {
        await db
          .update(allowedEmails)
          .set({ isAdmin: false, isSuperAdmin: false })
          .where(eq(allowedEmails.id, existing.id));
      }

      await db
        .update(users)
        .set({ isAdmin: body.isAdmin, updatedAt: new Date() })
        .where(eq(users.id, user.id));

      const nextAllowEntry = body.isAdmin
        ? await db.query.allowedEmails.findFirst({
            where: eq(allowedEmails.email, normalizedEmail),
          })
        : null;

      return {
        id: user.id,
        isAdmin: body.isAdmin,
        isSuperAdmin: nextAllowEntry?.isSuperAdmin ?? false,
      };
    },
  );

  fastify.post(
    "/admin/users/:id/reset-daily-quests",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureSuperAdmin(request, reply)) return;

      const { id } = request.params as { id: string };
      const body = adminUserQuestResetInputSchema.parse(request.body);
      const user = await db.query.users.findFirst({ where: eq(users.id, id) });
      if (!user) return reply.code(404).send({ error: "User not found" });

      if (body.mode === "single") {
        const definition = await db.query.questDefinitions.findFirst({
          where: eq(questDefinitions.questType, body.questType),
        });
        if (!definition) {
          return reply.code(400).send({ error: "Unknown quest type" });
        }
      }

      const result = await resetDailyQuestsForAdmin(user.id, {
        questType: body.mode === "single" ? body.questType : undefined,
        adminId: request.authUser!.id,
      });

      return {
        success: true,
        resetDate: result.resetDate,
        resetMode: result.resetMode,
        questType: result.questType,
      };
    },
  );

  fastify.delete(
    "/admin/users/:id",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureSuperAdmin(request, reply)) return;
      const authUser = request.authUser!;

      const { id } = request.params as { id: string };
      const user = await db.query.users.findFirst({ where: eq(users.id, id) });
      if (!user) return reply.code(404).send({ error: "User not found" });

      if (normalizeEmail(authUser.email) === normalizeEmail(user.email)) {
        return reply.code(403).send({ error: "Cannot delete yourself" });
      }

      await db.transaction(async (tx) => {
        await tx
          .delete(allowedEmails)
          .where(eq(allowedEmails.email, normalizeEmail(user.email)));
        await tx.delete(users).where(eq(users.id, user.id));
      });

      return { success: true, deletedUserId: user.id };
    },
  );

  fastify.get(
    "/admin/emails",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const rows = await db.query.allowedEmails.findMany({
        orderBy: [asc(allowedEmails.email)],
      });
      return {
        emails: rows.map(serializeAllowedEmail),
      };
    },
  );

  fastify.post(
    "/admin/emails",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const authUser = request.authUser!;

      const body = adminAllowedEmailSchema.parse(request.body);
      const normalizedEmail = normalizeEmail(body.email);
      const wantsAdmin = body.isAdmin ?? false;
      const wantsSuperAdmin = body.isSuperAdmin ?? false;

      if ((wantsAdmin || wantsSuperAdmin) && !authUser.isSuperAdmin) {
        return reply
          .code(403)
          .send({ error: "Only super admins can change admin rights" });
      }

      const existing = await db.query.allowedEmails.findFirst({
        where: eq(allowedEmails.email, normalizedEmail),
      });
      if (existing)
        return reply.code(400).send({ error: "Email already in allowlist" });

      const inserted = await db
        .insert(allowedEmails)
        .values({
          id: randomUUID(),
          email: normalizedEmail,
          isAdmin: wantsSuperAdmin ? true : wantsAdmin,
          isSuperAdmin: wantsSuperAdmin,
        })
        .returning()
        .then((rows) => rows[0]);
      return serializeAllowedEmail(inserted);
    },
  );

  fastify.patch(
    "/admin/emails/:id",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const authUser = request.authUser!;

      const { id } = request.params as { id: string };
      const body = adminAllowedEmailUpdateSchema.parse(request.body);
      const existing = await db.query.allowedEmails.findFirst({
        where: eq(allowedEmails.id, id),
      });
      if (!existing)
        return reply.code(404).send({ error: "Allowed email not found" });

      if (
        (body.isAdmin !== undefined || body.isSuperAdmin !== undefined) &&
        !authUser.isSuperAdmin
      ) {
        return reply
          .code(403)
          .send({ error: "Only super admins can change admin rights" });
      }

      if (
        normalizeEmail(authUser.email) === normalizeEmail(existing.email) &&
        (body.isAdmin === false || body.isSuperAdmin === false)
      ) {
        return reply
          .code(403)
          .send({ error: "Cannot remove your own admin rights" });
      }

      const nextIsSuperAdmin = body.isSuperAdmin ?? existing.isSuperAdmin;
      const nextIsAdmin = nextIsSuperAdmin
        ? true
        : body.isAdmin ?? existing.isAdmin;

      await db
        .update(allowedEmails)
        .set({
          isAdmin: nextIsAdmin,
          isSuperAdmin: nextIsSuperAdmin && nextIsAdmin,
        })
        .where(eq(allowedEmails.id, id));

      const updated = await db.query.allowedEmails.findFirst({
        where: eq(allowedEmails.id, id),
      });
      return serializeAllowedEmail(updated!);
    },
  );

  fastify.delete(
    "/admin/emails/:id",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const authUser = request.authUser!;

      const { id } = request.params as { id: string };
      const existing = await db.query.allowedEmails.findFirst({
        where: eq(allowedEmails.id, id),
      });
      if (!existing)
        return reply.code(404).send({ error: "Allowed email not found" });

      if (normalizeEmail(authUser.email) === normalizeEmail(existing.email)) {
        return reply.code(403).send({ error: "Cannot remove yourself" });
      }

      if ((existing.isAdmin || existing.isSuperAdmin) && !authUser.isSuperAdmin) {
        return reply
          .code(403)
          .send({ error: "Only super admins can remove admin entries" });
      }

      await db.delete(allowedEmails).where(eq(allowedEmails.id, id));
      return { success: true };
    },
  );

  fastify.get(
    "/admin/email-requests",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const rows = await db.query.emailAccessRequests.findMany({
        orderBy: [asc(emailAccessRequests.createdAt)],
      });
      const allUsers = await db.query.users.findMany({
        columns: {
          email: true,
        },
      });
      const existingEmails = new Set(
        allUsers.map((user) => normalizeEmail(user.email)),
      );
      return {
        requests: rows
          .map((row) => ({
            id: row.id,
            email: row.email,
            status: row.status,
            hasAccount: existingEmails.has(normalizeEmail(row.email)),
            createdAt: row.createdAt.toISOString(),
          }))
          .filter(
            (row) => !(row.status === "approved" && row.hasAccount),
          ),
      };
    },
  );

  fastify.patch(
    "/admin/email-requests/:id",
    { preHandler: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!ensureAdmin(request, reply)) return;
      const { id } = request.params as { id: string };
      const body = adminEmailRequestActionSchema.parse(request.body);
      const existing = await db.query.emailAccessRequests.findFirst({
        where: eq(emailAccessRequests.id, id),
      });
      if (!existing)
        return reply.code(404).send({ error: "Access request not found" });
      await db
        .update(emailAccessRequests)
        .set({ status: body.status, updatedAt: new Date() })
        .where(eq(emailAccessRequests.id, id));
      if (body.status === "approved") {
        const inAllowlist = await db.query.allowedEmails.findFirst({
          where: eq(allowedEmails.email, existing.email),
        });
        if (!inAllowlist) {
          await db.insert(allowedEmails).values({
            id: randomUUID(),
            email: existing.email,
            isAdmin: false,
            isSuperAdmin: false,
          });
        }
      }
      return { id, status: body.status };
    },
  );
}
