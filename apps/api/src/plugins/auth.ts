import fp from "fastify-plugin";
import { eq } from "drizzle-orm";

import { db, users } from "@adventure-time/db";

import { verifyAccessToken } from "../lib/tokens";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: {
      id: string;
      email: string;
      isAdmin: boolean;
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

      request.authUser = {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      };
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });
});
