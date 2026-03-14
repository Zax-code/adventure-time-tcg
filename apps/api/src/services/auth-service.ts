import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db, authSessions, emailAuthCredentials, users } from "@adventure-time/db";
import type { AuthUser } from "@adventure-time/shared";

import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/tokens";

function mapAuthUser(user: typeof users.$inferSelect): AuthUser {
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
}

async function issueSession(user: typeof users.$inferSelect, userAgent?: string, ipAddress?: string | null) {
  const sessionId = uuid();
  const refreshToken = await signRefreshToken(sessionId, user.id);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await db.insert(authSessions).values({
    id: sessionId,
    userId: user.id,
    refreshTokenHash,
    userAgent: userAgent ?? null,
    ipAddress: ipAddress ?? null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return {
    user: mapAuthUser(user),
    tokens: {
      accessToken: await signAccessToken({ id: user.id, email: user.email, isAdmin: user.isAdmin }),
      refreshToken,
      expiresInSeconds: 15 * 60,
    },
  };
}

export async function register(input: { email: string; password: string; displayName: string; userAgent?: string; ipAddress?: string | null }) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email.toLowerCase()) });
  if (existing) {
    throw new Error("An account already exists for this email.");
  }

  const userId = uuid();
  const now = new Date();
  await db.insert(users).values({
    id: userId,
    email: input.email.toLowerCase(),
    displayName: input.displayName,
    updatedAt: now,
  });

  await db.insert(emailAuthCredentials).values({
    id: uuid(),
    userId,
    passwordHash: await bcrypt.hash(input.password, 12),
    updatedAt: now,
  });

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    throw new Error("Failed to create user.");
  }

  return issueSession(user, input.userAgent, input.ipAddress);
}

export async function login(input: { email: string; password: string; userAgent?: string; ipAddress?: string | null }) {
  const user = await db.query.users.findFirst({ where: eq(users.email, input.email.toLowerCase()) });
  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const credential = await db.query.emailAuthCredentials.findFirst({ where: eq(emailAuthCredentials.userId, user.id) });
  if (!credential) {
    throw new Error("Invalid email or password.");
  }

  const isValid = await bcrypt.compare(input.password, credential.passwordHash);
  if (!isValid) {
    throw new Error("Invalid email or password.");
  }

  return issueSession(user, input.userAgent, input.ipAddress);
}

export async function refresh(refreshToken: string, userAgent?: string, ipAddress?: string | null) {
  const payload = await verifyRefreshToken(refreshToken);
  const session = await db.query.authSessions.findFirst({
    where: and(eq(authSessions.id, payload.sid), eq(authSessions.userId, payload.sub), isNull(authSessions.revokedAt)),
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  const matches = await bcrypt.compare(refreshToken, session.refreshTokenHash);
  if (!matches) {
    throw new Error("Invalid refresh token.");
  }

  await db.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.id, session.id));
  const user = await db.query.users.findFirst({ where: eq(users.id, payload.sub) });
  if (!user) {
    throw new Error("User not found.");
  }

  return issueSession(user, userAgent, ipAddress);
}

export async function logout(refreshToken: string) {
  const payload = await verifyRefreshToken(refreshToken);
  await db.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.id, payload.sid));
}
