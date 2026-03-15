import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db, allowedEmails, authSessions, emailAccessRequests, emailAuthCredentials, ownedCards, users } from "@adventure-time/db";
import type { AuthUser } from "@adventure-time/shared";

import { env } from "../lib/env";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/tokens";

const STARTER_CARD_ID = "finn-hero";

export class AuthError extends Error {
  constructor(message: string, public readonly statusCode: number, public readonly code?: string) {
    super(message);
    this.name = "AuthError";
  }
}

interface GoogleProfile {
  email: string;
  name: string | null;
  picture: string | null;
}

interface GoogleTokenInfo {
  aud?: string;
  email?: string;
  email_verified?: string;
  verified_email?: string;
  name?: string;
  picture?: string;
}

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

async function getAllowedEmailRecord(email: string) {
  return db.query.allowedEmails.findFirst({ where: eq(allowedEmails.email, email.toLowerCase()) });
}

async function syncUserAdminStatus(user: typeof users.$inferSelect) {
  const allowedEmail = await getAllowedEmailRecord(user.email);
  const isAdmin = allowedEmail?.isAdmin ?? false;

  if (user.isAdmin === isAdmin) {
    return user;
  }

  await db.update(users).set({ isAdmin, updatedAt: new Date() }).where(eq(users.id, user.id));
  return { ...user, isAdmin };
}

async function ensureStarterCard(userId: string) {
  const existingStarter = await db.query.ownedCards.findFirst({
    where: and(eq(ownedCards.userId, userId), eq(ownedCards.cardId, STARTER_CARD_ID)),
  });

  if (existingStarter) {
    return;
  }

  await db.insert(ownedCards).values({
    id: uuid(),
    userId,
    cardId: STARTER_CARD_ID,
    quantity: 1,
    obtainedAt: new Date(),
  });
}

async function ensurePendingAccessRequest(email: string) {
  const normalizedEmail = email.toLowerCase();
  const existing = await db.query.emailAccessRequests.findFirst({
    where: eq(emailAccessRequests.email, normalizedEmail),
  });

  if (!existing) {
    await db.insert(emailAccessRequests).values({
      id: uuid(),
      email: normalizedEmail,
      status: "pending",
      updatedAt: new Date(),
    });
    return;
  }

  if (existing.status === "pending") {
    return;
  }

  await db.update(emailAccessRequests).set({ status: "pending", updatedAt: new Date() }).where(eq(emailAccessRequests.id, existing.id));
}

async function createGoogleUser(profile: GoogleProfile) {
  const now = new Date();
  const userId = uuid();

  await db.insert(users).values({
    id: userId,
    email: profile.email,
    displayName: profile.name,
    updatedAt: now,
  });

  await ensureStarterCard(userId);

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    throw new Error("Failed to create user.");
  }

  return user;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) {
    throw new AuthError("Google authentication failed.", 401, "GOOGLE_AUTH_FAILED");
  }

  const payload = (await response.json()) as GoogleTokenInfo;

  return getGoogleProfileFromTokenInfo(payload);
}

function getAllowedGoogleAudiences() {
  return [
    env.AUTH_GOOGLE_ID,
    env.GOOGLE_IOS_CLIENT_ID,
    env.GOOGLE_ANDROID_CLIENT_ID,
  ].filter((value): value is string => Boolean(value));
}

function getGoogleProfileFromTokenInfo(payload: GoogleTokenInfo): GoogleProfile {
  const allowedAudiences = getAllowedGoogleAudiences();

  if (!payload.aud || !allowedAudiences.includes(payload.aud)) {
    throw new AuthError("Google authentication failed.", 401, "GOOGLE_AUTH_FAILED");
  }

  const emailVerified = payload.email_verified === "true" || payload.verified_email === "true";

  if (!payload.email || !emailVerified) {
    throw new AuthError("Your Google account does not have a verified email.", 401, "GOOGLE_EMAIL_UNVERIFIED");
  }

  return {
    email: payload.email.toLowerCase(),
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}

export async function verifyGoogleAccessToken(accessToken: string): Promise<GoogleProfile> {
  const tokenInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  if (!tokenInfoResponse.ok) {
    throw new AuthError("Google authentication failed.", 401, "GOOGLE_AUTH_FAILED");
  }

  const tokenInfo = (await tokenInfoResponse.json()) as GoogleTokenInfo;
  const baseProfile = getGoogleProfileFromTokenInfo(tokenInfo);

  const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userInfoResponse.ok) {
    return baseProfile;
  }

  const userInfo = (await userInfoResponse.json()) as GoogleTokenInfo;
  return {
    email: baseProfile.email,
    name: typeof userInfo.name === "string" ? userInfo.name : baseProfile.name,
    picture: typeof userInfo.picture === "string" ? userInfo.picture : baseProfile.picture,
  };
}

async function issueSession(user: typeof users.$inferSelect, userAgent?: string, ipAddress?: string | null) {
  const syncedUser = await syncUserAdminStatus(user);
  const sessionId = uuid();
  const refreshToken = await signRefreshToken(sessionId, user.id);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await db.insert(authSessions).values({
    id: sessionId,
    userId: syncedUser.id,
    refreshTokenHash,
    userAgent: userAgent ?? null,
    ipAddress: ipAddress ?? null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return {
    user: mapAuthUser(syncedUser),
    tokens: {
      accessToken: await signAccessToken({ id: syncedUser.id, email: syncedUser.email, isAdmin: syncedUser.isAdmin }),
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

  await db.insert(ownedCards).values({
    id: uuid(),
    userId,
    cardId: STARTER_CARD_ID,
    quantity: 1,
    obtainedAt: now,
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

export async function loginWithGoogle(input: { idToken?: string; accessToken?: string; userAgent?: string; ipAddress?: string | null }) {
  const profile = input.idToken
    ? await verifyGoogleIdToken(input.idToken)
    : input.accessToken
      ? await verifyGoogleAccessToken(input.accessToken)
      : (() => {
          throw new AuthError("Google authentication failed.", 400, "GOOGLE_AUTH_MISSING_TOKEN");
        })();
  const allowedEmail = await getAllowedEmailRecord(profile.email);

  if (!allowedEmail) {
    await ensurePendingAccessRequest(profile.email);
    throw new AuthError(
      "This Google account is not approved yet. An access request has been submitted.",
      403,
      "ACCESS_REQUEST_PENDING",
    );
  }

  let user = await db.query.users.findFirst({ where: eq(users.email, profile.email) });
  if (!user) {
    user = await createGoogleUser(profile);
  } else if (profile.name && user.displayName !== profile.name) {
    await db.update(users).set({ displayName: profile.name, updatedAt: new Date() }).where(eq(users.id, user.id));
    user = { ...user, displayName: profile.name };
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
