import { randomUUID } from "node:crypto";

import {
  REPLAY_VERSION_CURRENT,
  captureTurnSnapshot,
  createBattleState,
  createBattleStateView,
  deserializeTurnSnapshots,
  deserializeStoredBattleState,
  inflateBattleState,
  serializeBattleState,
  simulateActions,
  simulateEndTurn,
  type BattleContext,
  type BattleState,
  type BattleStateView,
  type CardData,
} from "@adventure-time/game-engine";
import { and, eq, inArray, or } from "drizzle-orm";

import { db, cards, ownedCards, pvpMatches, users } from "@adventure-time/db";

import { validateLoadoutRarityCaps } from "../lib/loadout-rules";

function parseLoadout(raw: string) {
  return JSON.parse(raw) as string[];
}

function normalizeCardType(type: string) {
  const normalized = type.trim().toLowerCase();
  const mapped = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  const allowed = new Set(["Hero", "Tech", "Royalty", "Candy", "Undead", "Ice", "Fire", "Magic", "Demon", "Cosmic"]);
  return allowed.has(mapped) ? mapped : "Hero";
}

function toCardData(card: typeof cards.$inferSelect & { rarity?: { name: string } | null }): CardData {
  return {
    id: card.id,
    name: card.name,
    character: card.character,
    type: normalizeCardType(card.type),
    hp: card.hp,
    attack: card.attack,
    defense: card.defense,
    speed: card.speed,
    imageUrl: card.imageAssetId ? `/api/media/card/${card.imageAssetId}` : "",
    rarity: { name: card.rarity?.name ?? "Common" },
    abilities: null,
  };
}

function summarizeCombatEvent(event: BattleStateView["log"][number]) {
  const payload = event.payload as Record<string, unknown>;
  switch (event.type) {
    case "matchStart":
      return "Match started";
    case "turnStart":
      return `Turn ${event.turn} started`;
    case "turnEnd":
      return `Turn ${event.turn} ended`;
    case "damage":
      return `${String(payload.attackerName ?? payload.sourceName ?? "Unit")} dealt ${String(payload.amount ?? payload.damage ?? 0)} damage to ${String(payload.targetName ?? "target")}`;
    case "ko":
      return `${String(payload.targetName ?? "Unit")} was knocked out`;
    case "swap":
      return `${String(payload.playerName ?? payload.userId ?? "Player")} swapped units`;
    case "gameOver":
      return `Winner: ${String(payload.winnerId ?? "unknown")}`;
    default:
      return event.type;
  }
}

function projectBattleState(view: BattleStateView) {
  return {
    currentPlayerId: view.currentPlayerId,
    turn: view.turn,
    phase: view.phase,
    winnerId: view.winnerId ?? null,
    players: view.players.map((player) => ({
      userId: player.userId,
      name: player.name,
      energy: player.energy,
      activeIndex: player.units.findIndex((unit) => unit.position === 1),
      team: [...player.units, ...player.bench].map((unit) => ({
        instanceId: unit.instanceId,
        cardId: unit.cardId,
        name: unit.name,
        hp: unit.hp,
        maxHp: unit.maxHp,
        attack: unit.attack,
        defense: unit.defense,
        knockedOut: unit.hp <= 0,
        position: unit.position,
      })),
    })),
    log: view.log.map((event) => ({
      turn: event.turn,
      actorId: String((event.payload as Record<string, unknown>).actorId ?? (event.payload as Record<string, unknown>).userId ?? view.currentPlayerId),
      type: event.type,
      summary: summarizeCombatEvent(event),
    })),
  };
}

async function loadCardsByIds(cardIds: string[]) {
  return db.query.cards.findMany({
    where: inArray(cards.id, [...new Set(cardIds)]),
    with: { rarity: true },
  });
}

async function loadNativeBattleContext(cardIds: string[]): Promise<BattleContext> {
  const cardRows = await db.query.cards.findMany({
    where: inArray(cards.id, [...new Set(cardIds)]),
    with: {
      rarity: true,
      abilities: {
        with: {
          passive: true,
          skill: true,
          ultimate: true,
        },
      },
    },
  });
  const cardData: BattleContext["cardData"] = {};
  const cardAbilities: BattleContext["cardAbilities"] = {};
  const abilityDefinitions: BattleContext["abilityDefinitions"] = {};

  for (const card of cardRows) {
    cardData[card.id] = {
      name: card.name,
      character: card.character,
      type: normalizeCardType(card.type),
      rarity: { name: card.rarity?.name ?? "Common" },
      imageUrl: card.imageAssetId ? `/api/media/card/${card.imageAssetId}` : "",
    };
    const assignment = card.abilities;
    const passive = assignment?.passive;
    const skill = assignment?.skill;
    const ultimate = assignment?.ultimate;
    cardAbilities[card.id] = {
      passives: passive?.key ? [passive.key] : [],
      skill: skill?.key ?? "default.focusedStrike",
      ultimate: ultimate?.key ?? "default.battleCry",
    };

    for (const def of [passive, skill, ultimate]) {
      if (!def?.key) continue;
      abilityDefinitions[def.key] = {
        key: def.key,
        name: def.name,
        description: def.description,
        type: def.type as "PASSIVE" | "SKILL" | "ULTIMATE",
        cost: def.cost,
        cooldown: def.cooldown ?? undefined,
        oncePerMatch: def.oncePerMatch,
        payload: typeof def.payload === "string" ? JSON.parse(def.payload) : def.payload,
      };
    }
  }

  return {
    cardData,
    cardAbilities,
    abilityDefinitions,
  };
}

async function inflateMatchState(match: typeof pvpMatches.$inferSelect) {
  if (!match.state) {
    return null;
  }
  const stored = deserializeStoredBattleState(match.state);
  const ctx = await loadNativeBattleContext(stored.players.flatMap((player) => [...player.units, ...player.bench].map((unit) => unit.cardId)));
  return inflateBattleState(stored, ctx);
}

function collectReplayCardIds(stateJson: string) {
  const stored = deserializeStoredBattleState(stateJson);
  return stored.players.flatMap((player) => [...player.units, ...player.bench].map((unit) => unit.cardId));
}

function ensureParticipant(match: typeof pvpMatches.$inferSelect, userId: string) {
  if (match.inviterId !== userId && match.inviteeId !== userId) {
    throw new Error("Forbidden");
  }
}

async function persistBattleState(matchId: string, state: BattleState, statusOverride?: typeof pvpMatches.$inferSelect.status) {
  const match = await db.query.pvpMatches.findFirst({ where: eq(pvpMatches.id, matchId) });
  const turnSnapshots = match?.turnSnapshots ? deserializeTurnSnapshots(match.turnSnapshots) : {};
  turnSnapshots[state.turn] = captureTurnSnapshot(state);

  await db.update(pvpMatches).set({
    state: serializeBattleState(state),
    status: statusOverride ?? (state.phase === "ended" ? "COMPLETED" : "IN_PROGRESS"),
    winnerId: state.winnerId ?? null,
    currentTurn: state.turn,
    turnStartedAt: new Date(),
    updatedAt: new Date(),
    matchLog: JSON.stringify(state.log),
    turnSnapshots: JSON.stringify(turnSnapshots),
    replayVersion: REPLAY_VERSION_CURRENT,
  }).where(eq(pvpMatches.id, matchId));
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
  if (loadout.length !== 6 || new Set(loadout).size !== loadout.length) throw new Error("Loadout must contain 6 unique cards");
  const inviterOwned = await db.query.ownedCards.findMany({ where: and(eq(ownedCards.userId, inviterId), inArray(ownedCards.cardId, loadout)) });
  if (inviterOwned.length !== loadout.length) throw new Error("You don't own all selected cards");
  const inviterCardsForValidation = await loadCardsByIds(loadout);
  const inviterValidation = validateLoadoutRarityCaps(inviterCardsForValidation.map((card) => card.rarity));
  if (!inviterValidation.valid) throw new Error(inviterValidation.error);
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
    if (new Set(inviteeLoadout).size !== inviteeLoadout.length) throw new Error("Invitee loadout cannot contain duplicate cards");
    const inviteeOwned = await db.query.ownedCards.findMany({ where: and(eq(ownedCards.userId, userId), inArray(ownedCards.cardId, inviteeLoadout)) });
    if (inviteeOwned.length !== inviteeLoadout.length) throw new Error("Invitee does not own all selected cards");

    const inviterCardsWithRarity = await loadCardsByIds(inviterLoadout);
    const inviteeCardsWithRarity = await loadCardsByIds(inviteeLoadout);
    const inviterRarityValidation = validateLoadoutRarityCaps(inviterCardsWithRarity.map((card) => card.rarity));
    if (!inviterRarityValidation.valid) throw new Error(`Inviter loadout invalid: ${inviterRarityValidation.error}`);
    const inviteeRarityValidation = validateLoadoutRarityCaps(inviteeCardsWithRarity.map((card) => card.rarity));
    if (!inviteeRarityValidation.valid) throw new Error(`Invitee loadout invalid: ${inviteeRarityValidation.error}`);

    const inviterCards = inviterLoadout.map((id) => inviterCardsWithRarity.find((card) => card.id === id)).filter(Boolean).map((card) => toCardData(card!));
    const inviteeCards = inviteeLoadout.map((id) => inviteeCardsWithRarity.find((card) => card.id === id)).filter(Boolean).map((card) => toCardData(card!));

    const battleState = createBattleState(
      matchId,
      { userId: match.inviterId, name: match.inviterId, cards: inviterCards },
      { userId: match.inviteeId, name: match.inviteeId, cards: inviteeCards },
    );

    await db.update(pvpMatches).set({
      status: "IN_PROGRESS",
      inviteeLoadout: JSON.stringify(inviteeLoadout),
      seed: battleState.seed,
      currentTurn: battleState.turn,
      turnStartedAt: new Date(),
      updatedAt: new Date(),
      matchLog: JSON.stringify(battleState.log),
      state: serializeBattleState(battleState),
      initialState: serializeBattleState(battleState),
      replayVersion: REPLAY_VERSION_CURRENT,
      turnSnapshots: JSON.stringify({ 1: captureTurnSnapshot(battleState) }),
    }).where(eq(pvpMatches.id, matchId));
    return;
  }

  if (action === "decline") {
    await db.update(pvpMatches).set({ status: "DECLINED", updatedAt: new Date() }).where(eq(pvpMatches.id, matchId));
    return;
  }

  const state = await inflateMatchState(match);
  const winnerId = match.inviterId === userId ? match.inviteeId : match.inviterId;
  if (state) {
    state.phase = "ended";
    state.winnerId = winnerId;
    await persistBattleState(matchId, state, "COMPLETED");
    return;
  }

  await db.update(pvpMatches).set({ status: "COMPLETED", winnerId, updatedAt: new Date() }).where(eq(pvpMatches.id, matchId));
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
  const state = await inflateMatchState(match);
  const view = state ? createBattleStateView(state, userId) : null;
  const initialState = match.initialState ? inflateBattleState(deserializeStoredBattleState(match.initialState), await loadNativeBattleContext(collectReplayCardIds(match.initialState))) : null;
  const turnSnapshots = match.turnSnapshots ? deserializeTurnSnapshots(match.turnSnapshots) : {};
  return {
    match,
    battleState: view ? projectBattleState(view) : null,
    replay: match.replayVersion === REPLAY_VERSION_CURRENT && match.initialState && match.state
      ? {
          replayVersion: match.replayVersion,
          finalState: view ? projectBattleState(view) : null,
          initialState: initialState ? projectBattleState(createBattleStateView(initialState, userId)) : null,
          availableTurns: Object.keys(turnSnapshots).map(Number).sort((a, b) => a - b),
          turnSnapshots,
        }
      : null,
  };
}

export async function performMatchAction(matchId: string, userId: string, actionType: "attack") {
  const match = await getMatch(matchId, userId);
  if (match.status !== "IN_PROGRESS") throw new Error("Match is not in progress");
  const state = await inflateMatchState(match);
  if (!state) throw new Error("Match state not found");
  if (state.currentPlayerId !== userId) throw new Error("Not your turn");
  if (actionType !== "attack") throw new Error("Unsupported action");

  const currentPlayer = state.players.find((player) => player.userId === userId);
  const opponent = state.players.find((player) => player.userId !== userId);
  const actor = currentPlayer?.units.find((unit) => unit.hp > 0);
  const target = opponent?.units.find((unit) => unit.hp > 0);
  if (!actor || !target) throw new Error("Actor not found or not active");

  const result = simulateActions(state, [{
    kind: "basic",
    actorInstanceId: actor.instanceId,
    targetInstanceId: target.instanceId,
  }]);
  if (result.errors.length > 0) {
    throw new Error(result.errors.join("; "));
  }

  await persistBattleState(matchId, result.state);
  const updatedMatch = await getMatch(matchId, userId);
  return {
    match: updatedMatch,
    battleState: projectBattleState(createBattleStateView(result.state, userId)),
    events: result.events,
  };
}

export async function endTurn(matchId: string, userId: string) {
  const match = await getMatch(matchId, userId);
  if (match.status !== "IN_PROGRESS") throw new Error("Match is not in progress");
  const state = await inflateMatchState(match);
  if (!state) throw new Error("Match state not found");
  if (state.currentPlayerId !== userId) throw new Error("Not your turn");

  const result = simulateEndTurn(state);
  if (result.errors.length > 0) {
    throw new Error(result.errors.join("; "));
  }

  await persistBattleState(matchId, result.state);
  const updatedMatch = await getMatch(matchId, userId);
  return {
    match: updatedMatch,
    battleState: projectBattleState(createBattleStateView(result.state, userId)),
    events: result.events,
  };
}
