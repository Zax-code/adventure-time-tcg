import { randomUUID } from "node:crypto";

import { and, eq, inArray, or } from "drizzle-orm";

import { db, cards, pvpMatches, users } from "@adventure-time/db";

type BattleUnit = {
  cardId: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  knockedOut: boolean;
};

type BattlePlayerState = {
  userId: string;
  activeIndex: number;
  team: BattleUnit[];
};

type BattleLogEvent = {
  turn: number;
  actorId: string;
  type: string;
  summary: string;
};

type BattleState = {
  currentPlayerId: string;
  turn: number;
  players: [BattlePlayerState, BattlePlayerState];
  log: BattleLogEvent[];
  phase: "active" | "ended";
  winnerId: string | null;
};

function parseLoadout(raw: string) {
  return JSON.parse(raw) as string[];
}

function serializeBattleState(state: BattleState) {
  return JSON.stringify(state);
}

function deserializeBattleState(raw: string | null) {
  return raw ? (JSON.parse(raw) as BattleState) : null;
}

function firstAliveIndex(team: BattleUnit[]) {
  const index = team.findIndex((unit) => !unit.knockedOut && unit.hp > 0);
  return index === -1 ? 0 : index;
}

function buildBattleState(params: {
  inviterId: string;
  inviteeId: string;
  inviterCards: Array<typeof cards.$inferSelect>;
  inviteeCards: Array<typeof cards.$inferSelect>;
}): BattleState {
  const toUnit = (card: typeof cards.$inferSelect): BattleUnit => ({
    cardId: card.id,
    name: card.name,
    hp: card.hp,
    maxHp: card.hp,
    attack: card.attack,
    defense: card.defense,
    knockedOut: false,
  });

  return {
    currentPlayerId: params.inviterId,
    turn: 1,
    players: [
      { userId: params.inviterId, activeIndex: 0, team: params.inviterCards.map(toUnit) },
      { userId: params.inviteeId, activeIndex: 0, team: params.inviteeCards.map(toUnit) },
    ],
    log: [{ turn: 1, actorId: params.inviterId, type: "match_started", summary: "Match started" }],
    phase: "active",
    winnerId: null,
  };
}

async function buildStateFromStoredLoadouts(match: typeof pvpMatches.$inferSelect) {
  const inviterLoadout = parseLoadout(match.inviterLoadout);
  const inviteeLoadout = parseLoadout(match.inviteeLoadout);
  if (inviterLoadout.length !== 6 || inviteeLoadout.length !== 6) {
    return null;
  }

  const allCardIds = [...inviterLoadout, ...inviteeLoadout];
  const loadoutCards = await db.query.cards.findMany({ where: inArray(cards.id, [...new Set(allCardIds)]) });
  const cardMap = new Map(loadoutCards.map((card) => [card.id, card]));
  const inviterCards = inviterLoadout.map((id) => cardMap.get(id)).filter(Boolean) as Array<typeof cards.$inferSelect>;
  const inviteeCards = inviteeLoadout.map((id) => cardMap.get(id)).filter(Boolean) as Array<typeof cards.$inferSelect>;
  if (inviterCards.length !== 6 || inviteeCards.length !== 6) {
    return null;
  }

  return buildBattleState({ inviterId: match.inviterId, inviteeId: match.inviteeId, inviterCards, inviteeCards });
}

async function ensureBattleState(match: typeof pvpMatches.$inferSelect) {
  const existing = deserializeBattleState(match.state);
  if (existing) {
    return existing;
  }

  if (match.status !== "IN_PROGRESS") {
    return null;
  }

  const rebuilt = await buildStateFromStoredLoadouts(match);
  if (!rebuilt) {
    return null;
  }

  await db.update(pvpMatches).set({
    state: serializeBattleState(rebuilt),
    matchLog: JSON.stringify(rebuilt.log),
    currentTurn: rebuilt.turn,
    turnStartedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(pvpMatches.id, match.id));

  return rebuilt;
}

function ensureParticipant(match: typeof pvpMatches.$inferSelect, userId: string) {
  if (match.inviterId !== userId && match.inviteeId !== userId) {
    throw new Error("Forbidden");
  }
}

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
    currentTurn: 1,
  });
}

export async function setMatchStatus(matchId: string, userId: string, action: "accept" | "decline" | "concede", loadout?: string[]) {
  const match = await db.query.pvpMatches.findFirst({ where: eq(pvpMatches.id, matchId) });
  if (!match) throw new Error("Match not found");
  ensureParticipant(match, userId);
  if (action === "accept") {
    if (match.inviteeId !== userId) throw new Error("Only the invitee can accept");
    const inviterLoadout = parseLoadout(match.inviterLoadout);
    const inviteeLoadout = loadout ?? [];
    if (inviterLoadout.length !== 6 || inviteeLoadout.length !== 6) throw new Error("Loadouts must contain exactly 6 cards");
    const loadoutCardIds = [...inviterLoadout, ...inviteeLoadout];
    const loadoutCards = await db.query.cards.findMany({ where: inArray(cards.id, [...new Set(loadoutCardIds)]) });
    const cardMap = new Map(loadoutCards.map((card) => [card.id, card]));
    const inviterCards = inviterLoadout.map((id) => cardMap.get(id)).filter(Boolean) as Array<typeof cards.$inferSelect>;
    const inviteeCards = inviteeLoadout.map((id) => cardMap.get(id)).filter(Boolean) as Array<typeof cards.$inferSelect>;
    if (inviterCards.length !== 6 || inviteeCards.length !== 6) throw new Error("Loadout cards not found");
    const battleState = buildBattleState({ inviterId: match.inviterId, inviteeId: match.inviteeId, inviterCards, inviteeCards });
    await db.update(pvpMatches).set({
      status: "IN_PROGRESS",
      inviteeLoadout: JSON.stringify(inviteeLoadout),
      state: serializeBattleState(battleState),
      currentTurn: 1,
      turnStartedAt: new Date(),
      updatedAt: new Date(),
      matchLog: JSON.stringify(battleState.log),
    }).where(eq(pvpMatches.id, matchId));
    return;
  }
  if (action === "decline") {
    await db.update(pvpMatches).set({ status: "DECLINED", updatedAt: new Date() }).where(eq(pvpMatches.id, matchId));
    return;
  }
  const winnerId = match.inviterId === userId ? match.inviteeId : match.inviterId;
  const state = deserializeBattleState(match.state);
  const nextLog = state?.log ?? [];
  nextLog.push({ turn: state?.turn ?? match.currentTurn, actorId: userId, type: "concede", summary: `${userId} conceded` });
  await db.update(pvpMatches).set({ status: "COMPLETED", winnerId, updatedAt: new Date(), matchLog: JSON.stringify(nextLog), state: state ? serializeBattleState({ ...state, phase: "ended", winnerId, log: nextLog }) : match.state }).where(eq(pvpMatches.id, matchId));
}

export async function listMatches(userId: string) {
  return db.query.pvpMatches.findMany({
    where: and(or(eq(pvpMatches.inviterId, userId), eq(pvpMatches.inviteeId, userId)), or(eq(pvpMatches.status, "IN_PROGRESS"), eq(pvpMatches.status, "COMPLETED"))),
  });
}

export async function listHistory(userId: string) {
  return db.query.pvpMatches.findMany({
    where: and(or(eq(pvpMatches.inviterId, userId), eq(pvpMatches.inviteeId, userId)), eq(pvpMatches.status, "COMPLETED")),
  });
}

export async function getMatch(matchId: string, userId: string) {
  const match = await db.query.pvpMatches.findFirst({ where: eq(pvpMatches.id, matchId) });
  if (!match) throw new Error("Match not found");
  ensureParticipant(match, userId);
  return match;
}

export async function getMatchDetail(matchId: string, userId: string) {
  const match = await getMatch(matchId, userId);
  return {
    match,
    battleState: await ensureBattleState(match),
  };
}

export async function performMatchAction(matchId: string, userId: string, actionType: "attack") {
  const match = await getMatch(matchId, userId);
  if (match.status !== "IN_PROGRESS") throw new Error("Match is not in progress");
  const state = await ensureBattleState(match);
  if (!state) throw new Error("Match state not found");
  if (state.currentPlayerId !== userId) throw new Error("Not your turn");
  if (actionType !== "attack") throw new Error("Unsupported action");

  const actorIndex = state.players.findIndex((player) => player.userId === userId);
  const targetIndex = actorIndex === 0 ? 1 : 0;
  const actor = state.players[actorIndex];
  const target = state.players[targetIndex];
  actor.activeIndex = firstAliveIndex(actor.team);
  target.activeIndex = firstAliveIndex(target.team);
  const attacker = actor.team[actor.activeIndex];
  const defender = target.team[target.activeIndex];
  if (!attacker || attacker.knockedOut) throw new Error("Actor not found or not active");
  if (!defender || defender.knockedOut) throw new Error("Defender not found or already knocked out");

  const damage = Math.max(1, attacker.attack - Math.floor(defender.defense / 2));
  defender.hp = Math.max(0, defender.hp - damage);
  if (defender.hp === 0) {
    defender.knockedOut = true;
    target.activeIndex = firstAliveIndex(target.team);
  }

  const logEntry = { turn: state.turn, actorId: userId, type: "attack", summary: `${attacker.name} hit ${defender.name} for ${damage}` };
  state.log.push(logEntry);
  const targetAlive = target.team.some((unit) => !unit.knockedOut && unit.hp > 0);
  if (!targetAlive) {
    state.phase = "ended";
    state.winnerId = userId;
  }

  await db.update(pvpMatches).set({
    state: serializeBattleState(state),
    status: state.phase === "ended" ? "COMPLETED" : match.status,
    winnerId: state.winnerId,
    updatedAt: new Date(),
    matchLog: JSON.stringify(state.log),
  }).where(eq(pvpMatches.id, matchId));

  return { match: await getMatch(matchId, userId), battleState: state, events: [logEntry] };
}

export async function endTurn(matchId: string, userId: string) {
  const match = await getMatch(matchId, userId);
  if (match.status !== "IN_PROGRESS") throw new Error("Match is not in progress");
  const state = await ensureBattleState(match);
  if (!state) throw new Error("Match state not found");
  if (state.currentPlayerId !== userId) throw new Error("Not your turn");
  state.currentPlayerId = state.players.find((player) => player.userId !== userId)?.userId ?? userId;
  state.turn += 1;
  const logEntry = { turn: state.turn, actorId: userId, type: "end_turn", summary: `${userId} ended turn` };
  state.log.push(logEntry);
  await db.update(pvpMatches).set({
    state: serializeBattleState(state),
    currentTurn: state.turn,
    turnStartedAt: new Date(),
    updatedAt: new Date(),
    matchLog: JSON.stringify(state.log),
  }).where(eq(pvpMatches.id, matchId));
  return { match: await getMatch(matchId, userId), battleState: state, events: [logEntry] };
}
