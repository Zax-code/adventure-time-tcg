import { randomUUID } from "node:crypto";

import { and, eq, or } from "drizzle-orm";

import { db, pvpMatches, users } from "@adventure-time/db";

export async function listInvites(userId: string) {
  return db.query.pvpMatches.findMany({
    where: and(eq(pvpMatches.status, "PENDING"), or(eq(pvpMatches.inviterId, userId), eq(pvpMatches.inviteeId, userId))),
  });
}

export async function createInvite(inviterId: string, inviteeEmail: string, loadout: string[]) {
  const invitee = await db.query.users.findFirst({ where: eq(users.email, inviteeEmail.toLowerCase()) });
  if (!invitee) throw new Error("Invitee not found");
  if (invitee.id === inviterId) throw new Error("Cannot invite yourself");
  const existing = await db.query.pvpMatches.findFirst({
    where: and(
      or(
        and(eq(pvpMatches.inviterId, inviterId), eq(pvpMatches.inviteeId, invitee.id)),
        and(eq(pvpMatches.inviterId, invitee.id), eq(pvpMatches.inviteeId, inviterId)),
      ),
      or(eq(pvpMatches.status, "PENDING"), eq(pvpMatches.status, "IN_PROGRESS")),
    ),
  });
  if (existing) throw new Error("An active interaction already exists for these players");
  await db.insert(pvpMatches).values({
    id: randomUUID(),
    inviterId,
    inviteeId: invitee.id,
    status: "PENDING",
    inviterLoadout: JSON.stringify(loadout),
    inviteeLoadout: "[]",
    matchLog: JSON.stringify([{ type: "invite_created", at: new Date().toISOString() }]),
  });
}

export async function setMatchStatus(matchId: string, userId: string, action: "accept" | "decline" | "concede", loadout?: string[]) {
  const match = await db.query.pvpMatches.findFirst({ where: eq(pvpMatches.id, matchId) });
  if (!match) throw new Error("Match not found");
  if (match.inviterId !== userId && match.inviteeId !== userId) throw new Error("Forbidden");
  if (action === "accept") {
    if (match.inviteeId !== userId) throw new Error("Only the invitee can accept");
    await db.update(pvpMatches).set({ status: "IN_PROGRESS", inviteeLoadout: JSON.stringify(loadout ?? []), updatedAt: new Date() }).where(eq(pvpMatches.id, matchId));
    return;
  }
  if (action === "decline") {
    await db.update(pvpMatches).set({ status: "DECLINED", updatedAt: new Date() }).where(eq(pvpMatches.id, matchId));
    return;
  }
  const winnerId = match.inviterId === userId ? match.inviteeId : match.inviterId;
  await db.update(pvpMatches).set({ status: "COMPLETED", winnerId, updatedAt: new Date() }).where(eq(pvpMatches.id, matchId));
}

export async function listMatches(userId: string) {
  return db.query.pvpMatches.findMany({
    where: and(or(eq(pvpMatches.inviterId, userId), eq(pvpMatches.inviteeId, userId)), or(eq(pvpMatches.status, "IN_PROGRESS"), eq(pvpMatches.status, "COMPLETED"))),
  });
}

export async function getMatch(matchId: string, userId: string) {
  const match = await db.query.pvpMatches.findFirst({ where: eq(pvpMatches.id, matchId) });
  if (!match) throw new Error("Match not found");
  if (match.inviterId !== userId && match.inviteeId !== userId) throw new Error("Forbidden");
  return match;
}
