import * as jose from "jose";

import { env } from "./env";

const accessSecret = new TextEncoder().encode(env.ACCESS_TOKEN_SECRET);
const refreshSecret = new TextEncoder().encode(env.REFRESH_TOKEN_SECRET);

export async function signAccessToken(user: { id: string; email: string; isAdmin: boolean }) {
  return new jose.SignJWT({ sub: user.id, email: user.email, isAdmin: user.isAdmin, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(accessSecret);
}

export async function signRefreshToken(sessionId: string, userId: string) {
  return new jose.SignJWT({ sub: userId, sid: sessionId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(refreshSecret);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jose.jwtVerify(token, accessSecret);
  return payload as { sub: string; email: string; isAdmin: boolean; type: "access" };
}

export async function verifyRefreshToken(token: string) {
  const { payload } = await jose.jwtVerify(token, refreshSecret);
  return payload as { sub: string; sid: string; type: "refresh" };
}
