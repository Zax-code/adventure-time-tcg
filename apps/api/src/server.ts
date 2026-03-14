import Fastify from "fastify";

import authPlugin from "./plugins/auth";
import { env } from "./lib/env";
import { appRoutes } from "./routes/app";
import { authRoutes } from "./routes/auth";

async function main() {
  const fastify = Fastify({ logger: true });

  await fastify.register(authPlugin);
  await fastify.register(authRoutes);
  await fastify.register(appRoutes);

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
