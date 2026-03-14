import Fastify from "fastify";

import authPlugin from "./plugins/auth";
import { env } from "./lib/env";
import { adminRoutes } from "./routes/admin";
import { appRoutes } from "./routes/app";
import { authRoutes } from "./routes/auth";
import { pvpRoutes } from "./routes/pvp";
import { pvpLoadoutRoutes } from "./routes/pvp-loadouts";
import { questRoutes } from "./routes/quests";

async function main() {
  const fastify = Fastify({ logger: true });

  await fastify.register(authPlugin);
  await fastify.register(authRoutes);
  await fastify.register(appRoutes);
  await fastify.register(questRoutes);
  await fastify.register(pvpRoutes);
  await fastify.register(pvpLoadoutRoutes);
  await fastify.register(adminRoutes);

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
