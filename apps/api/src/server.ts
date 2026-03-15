import Fastify from "fastify";
import multipart from "@fastify/multipart";

import authPlugin from "./plugins/auth";
import { env } from "./lib/env";
import { adminRoutes } from "./routes/admin";
import { adminUsersRoutes } from "./routes/admin-users";
import { appRoutes } from "./routes/app";
import { authRoutes } from "./routes/auth";
import { economyRoutes } from "./routes/economy";
import { pvpRoutes } from "./routes/pvp";
import { pvpLoadoutRoutes } from "./routes/pvp-loadouts";
import { questRoutes } from "./routes/quests";
import { socialRoutes } from "./routes/social";

async function main() {
  const fastify = Fastify({ logger: true });

  await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await fastify.register(authPlugin);
  await fastify.register(authRoutes);
  await fastify.register(appRoutes);
  await fastify.register(questRoutes);
  await fastify.register(economyRoutes);
  await fastify.register(socialRoutes);
  await fastify.register(pvpRoutes);
  await fastify.register(pvpLoadoutRoutes);
  await fastify.register(adminRoutes);
  await fastify.register(adminUsersRoutes);

  fastify.setErrorHandler((error, _request, reply) => {
    if ((error as { name?: string }).name === "ZodError") {
      reply.code(400).send({ error: "Invalid request payload" });
      return;
    }

    fastify.log.error(error);
    reply.code(500).send({ error: "Internal server error" });
  });

  await fastify.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
