import fp from "fastify-plugin";
import { eq } from "drizzle-orm";

import { db, allowedEmails, users } from "@adventure-time/db";

import { verifyAccessToken } from "../lib/tokens";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: {
      id: string;
      email: string;
      isAdmin: boolean;
      isSuperAdmin: boolean;
    };
  }
}

export default fp(async (fastify) => {
  fastify.decorateRequest("authUser", undefined);

  fastify.decorate("authenticate", async (request: any, reply: any) => {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    try {
      const token = authorization.replace("Bearer ", "");
      const payload = await verifyAccessToken(token);
      const user = await db.query.users.findFirst({ where: eq(users.id, payload.sub) });
      if (!user) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const allowedEmail = await db.query.allowedEmails.findFirst({ where: eq(allowedEmails.email, user.email.toLowerCase()) });
      const isSuperAdmin = allowedEmail?.isSuperAdmin ?? false;
      const isAdmin = isSuperAdmin || (allowedEmail?.isAdmin ?? false);

      if (user.isAdmin !== isAdmin) {
        await db.update(users).set({ isAdmin, updatedAt: new Date() }).where(eq(users.id, user.id));
      }

      request.authUser = {
        id: user.id,
        email: user.email,
        isAdmin,
        isSuperAdmin,
      };
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });
});
