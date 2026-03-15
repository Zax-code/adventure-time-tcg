import { FastifyInstance } from "fastify";

import { googleAuthSchema, registerSchema, loginSchema } from "@adventure-time/shared";

import { AuthError, login, loginWithGoogle, logout, refresh, register } from "../services/auth-service";

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    try {
      const result = await register({
        ...body,
        userAgent: request.headers["user-agent"],
        ipAddress: request.ip,
      });
      return reply.code(201).send(result);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Registration failed" });
    }
  });

  fastify.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    try {
      return await login({
        ...body,
        userAgent: request.headers["user-agent"],
        ipAddress: request.ip,
      });
    } catch (error) {
      return reply.code(401).send({ error: error instanceof Error ? error.message : "Authentication failed" });
    }
  });

  fastify.post("/auth/google", async (request, reply) => {
    const body = googleAuthSchema.parse(request.body);
    try {
      return await loginWithGoogle({
        ...body,
        userAgent: request.headers["user-agent"],
        ipAddress: request.ip,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.code(error.statusCode).send({ error: error.message, code: error.code });
      }

      return reply.code(401).send({ error: error instanceof Error ? error.message : "Google authentication failed" });
    }
  });

  fastify.post("/auth/refresh", async (request, reply) => {
    const body = request.body as { refreshToken?: string };
    if (!body.refreshToken) {
      return reply.code(400).send({ error: "Missing refresh token" });
    }

    try {
      return await refresh(body.refreshToken, request.headers["user-agent"], request.ip);
    } catch (error) {
      return reply.code(401).send({ error: error instanceof Error ? error.message : "Refresh failed" });
    }
  });

  fastify.post("/auth/logout", async (request, reply) => {
    const body = request.body as { refreshToken?: string };
    if (!body.refreshToken) {
      return reply.code(400).send({ error: "Missing refresh token" });
    }

    try {
      await logout(body.refreshToken);
      return reply.code(204).send();
    } catch {
      return reply.code(204).send();
    }
  });
}
