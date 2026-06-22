import {
  applyEventsToState,
  groupEventsByTurn,
  type BattleState,
  type CombatEvent,
  type StatusName,
} from "@adventure-time/game-engine";
import type {
  PvpBattleState,
  PvpMatchDetailResponse,
  PvpPlayerState,
  PvpSpectateBattleState,
  PvpUnitState,
} from "@adventure-time/api-client";

import type { MyMatchView } from "./types";

export interface ReplayTurnView {
  turn: number;
  events: PvpBattleState["log"];
  matchView: MyMatchView;
}

const VALID_STATUS_NAMES = new Set<StatusName>([
  "Burn",
  "Freeze",
  "Shield",
  "GuardUp",
  "Vulnerable",
  "Weakened",
  "Haste",
  "Taunt",
  "Regeneration",
  "Silence",
  "SummoningSickness",
  "Cover",
  "Stunned",
  "Poison",
  "Thorns",
  "Stealth",
  "Empower",
  "Counter",
  "Mark",
  "Barrier",
  "Doom",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asOptionalNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

function isStatusName(value: string): value is StatusName {
  return VALID_STATUS_NAMES.has(value as StatusName);
}

function normalizeStatus(
  value: unknown,
): BattleState["players"][number]["units"][number]["statuses"][number] | null {
  const status = asRecord(value);
  if (!status) {
    return null;
  }

  const name = asString(status.name);
  if (!isStatusName(name)) {
    return null;
  }

  return {
    name,
    duration: asNumber(status.duration),
    magnitude:
      typeof status.magnitude === "number" && Number.isFinite(status.magnitude)
        ? status.magnitude
        : undefined,
    appliedAt: asNumber(status.appliedAt),
    appliedDuringPlayerId: asOptionalString(status.appliedDuringPlayerId),
    targetOwnerId: asOptionalString(status.targetOwnerId),
    expiresAt:
      status.expiresAt === "afterOwnerTurnStartEffects" ||
      status.expiresAt === "afterOwnerTurnEndEffects"
        ? status.expiresAt
        : undefined,
    ownerTurnsSeen: asOptionalNonNegativeInteger(status.ownerTurnsSeen),
  };
}

function normalizeCombatEvent(value: unknown): CombatEvent | null {
  const event = asRecord(value);
  const payload = asRecord(event?.payload);

  if (!event || !payload) {
    return null;
  }

  return {
    seq: asNumber(event.seq),
    turn: asNumber(event.turn),
    type: asString(event.type) as CombatEvent["type"],
    payload,
  };
}

function normalizeReplayUnit(
  value: unknown,
): BattleState["players"][number]["units"][number] | null {
  const unit = asRecord(value);
  if (!unit) {
    return null;
  }

  const cooldowns = asRecord(unit.cooldowns) ?? {};
  const passiveTriggered = asRecord(unit.passiveTriggered) ?? {};
  const statuses =
    Array.isArray(unit.statuses)
      ? unit.statuses
          .map(normalizeStatus)
          .filter((status): status is NonNullable<typeof status> => status !== null)
      : [];

  return {
    instanceId: asString(unit.instanceId),
    cardId: asString(unit.cardId),
    name: asString(unit.name),
    character: asString(unit.character),
    type: asString(unit.type) as BattleState["players"][number]["units"][number]["type"],
    rarity: asString(unit.rarity) as BattleState["players"][number]["units"][number]["rarity"],
    imageUrl: asString(unit.imageUrl),
    hp: asNumber(unit.hp),
    maxHp: asNumber(unit.maxHp),
    attack: asNumber(unit.attack),
    defense: asNumber(unit.defense),
    speed: asNumber(unit.speed),
    baseMaxHp:
      typeof unit.baseMaxHp === "number" && Number.isFinite(unit.baseMaxHp)
        ? unit.baseMaxHp
        : undefined,
    baseAttack:
      typeof unit.baseAttack === "number" && Number.isFinite(unit.baseAttack)
        ? unit.baseAttack
        : undefined,
    baseDefense:
      typeof unit.baseDefense === "number" && Number.isFinite(unit.baseDefense)
        ? unit.baseDefense
        : undefined,
    baseSpeed:
      typeof unit.baseSpeed === "number" && Number.isFinite(unit.baseSpeed)
        ? unit.baseSpeed
        : undefined,
    statuses,
    cooldowns: Object.fromEntries(
      Object.entries(cooldowns).map(([key, value]) => [key, asNumber(value)]),
    ),
    usedUltimate: Boolean(unit.usedUltimate),
    position:
      unit.position === 1 || unit.position === 2 || unit.position === 3
        ? unit.position
        : null,
    passives: Array.isArray(unit.passives)
      ? unit.passives.filter((entry): entry is string => typeof entry === "string")
      : [],
    skill: asString(unit.skill),
    ultimate: asString(unit.ultimate),
    passiveTriggered: Object.fromEntries(
      Object.entries(passiveTriggered).map(([key, value]) => [key, Boolean(value)]),
    ),
    hitsTaken: asNumber(unit.hitsTaken),
  };
}

function normalizeReplayPlayer(value: unknown): BattleState["players"][number] | null {
  const player = asRecord(value);
  if (!player) {
    return null;
  }

  const units =
    Array.isArray(player.units)
      ? player.units
          .map(normalizeReplayUnit)
          .filter((unit): unit is NonNullable<typeof unit> => unit !== null)
      : [];
  const bench =
    Array.isArray(player.bench)
      ? player.bench
          .map(normalizeReplayUnit)
          .filter((unit): unit is NonNullable<typeof unit> => unit !== null)
      : [];

  return {
    userId: asString(player.userId),
    name: asString(player.name || player.displayName || player.userId),
    energy: asNumber(player.energy),
    units,
    bench,
    initiative: asNumber(player.initiative),
    hasUsedFreeBasic: Boolean(player.hasUsedFreeBasic),
  };
}

function normalizeAbilityDefinitions(
  value: unknown,
): PvpBattleState["abilityDefinitions"] | undefined {
  const defs = asRecord(value);
  if (!defs) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(defs).flatMap(([key, raw]) => {
      const def = asRecord(raw);
      if (!def) {
        return [];
      }

      return [
        [
          key,
          {
            key: asString(def.key, key),
            name: asString(def.name),
            description: asString(def.description),
            type: asString(def.type) as NonNullable<
              PvpBattleState["abilityDefinitions"]
            >[string]["type"],
            cost: asNumber(def.cost),
            cooldown:
              typeof def.cooldown === "number" && Number.isFinite(def.cooldown)
                ? def.cooldown
                : null,
            oncePerMatch: Boolean(def.oncePerMatch),
            payload: (asRecord(def.payload) ?? undefined) as NonNullable<
              PvpBattleState["abilityDefinitions"]
            >[string]["payload"],
          },
        ],
      ];
    }),
  );
}

export function normalizeReplayState(value: unknown): BattleState | null {
  const state = asRecord(value);
  if (!state || !Array.isArray(state.players) || state.players.length !== 2) {
    return null;
  }

  const players = state.players
    .map(normalizeReplayPlayer)
    .filter((player): player is NonNullable<typeof player> => player !== null);

  if (players.length !== 2) {
    return null;
  }

  return {
    id: asString(state.id),
    seed: asString(state.seed),
    rngIndex: asNumber(state.rngIndex),
    turn: asNumber(state.turn, 1),
    phase: state.phase === "ended" ? "ended" : "active",
    currentPlayerId: asString(state.currentPlayerId),
    winnerId: typeof state.winnerId === "string" ? state.winnerId : undefined,
    players: [players[0], players[1]],
    log: Array.isArray(state.log)
      ? state.log
          .map(normalizeCombatEvent)
          .filter((event): event is CombatEvent => event !== null)
      : [],
    actionsThisTurn: Array.isArray(state.actionsThisTurn)
      ? (state.actionsThisTurn as BattleState["actionsThisTurn"])
      : [],
    turnEnded: Boolean(state.turnEnded),
    abilityDefinitions: normalizeAbilityDefinitions(state.abilityDefinitions) as BattleState["abilityDefinitions"],
  };
}

function toPvpUnitState(unit: BattleState["players"][number]["units"][number]): PvpUnitState {
  return {
    instanceId: unit.instanceId,
    cardId: unit.cardId,
    name: unit.name,
    character: unit.character,
    type: unit.type,
    rarity: unit.rarity,
    imageUrl: unit.imageUrl || null,
    hp: unit.hp,
    maxHp: unit.maxHp,
    attack: unit.attack,
    defense: unit.defense,
    speed: unit.speed,
    baseMaxHp: unit.baseMaxHp,
    baseAttack: unit.baseAttack,
    baseDefense: unit.baseDefense,
    baseSpeed: unit.baseSpeed,
    statuses: unit.statuses.map((status) => ({
      name: status.name,
      duration: status.duration,
      magnitude: status.magnitude ?? null,
      appliedAt: status.appliedAt,
      appliedDuringPlayerId: status.appliedDuringPlayerId,
      targetOwnerId: status.targetOwnerId,
      expiresAt: status.expiresAt,
      ownerTurnsSeen: status.ownerTurnsSeen,
    })),
    cooldowns: unit.cooldowns,
    usedUltimate: unit.usedUltimate,
    position: unit.position,
    skill: unit.skill || null,
    ultimate: unit.ultimate || null,
    passives: unit.passives,
    knockedOut: unit.hp <= 0,
  };
}

function toPvpPlayerState(player: BattleState["players"][number]): PvpPlayerState {
  return {
    userId: player.userId,
    name: player.name,
    energy: player.energy,
    hasUsedFreeBasic: player.hasUsedFreeBasic,
    units: player.units.map(toPvpUnitState),
    bench: player.bench.map(toPvpUnitState),
  };
}

function toReplayBattleState(
  state: BattleState,
  myUserId: string,
): PvpBattleState | null {
  const me = state.players.find((player) => player.userId === myUserId);
  const opponent = state.players.find((player) => player.userId !== myUserId);

  if (!me || !opponent) {
    return null;
  }

  return {
    id: state.id,
    turn: state.turn,
    phase: state.phase,
    currentPlayerId: state.currentPlayerId,
    winnerId: state.winnerId ?? null,
    players: [toPvpPlayerState(me), toPvpPlayerState(opponent)],
    log: state.log,
    abilityDefinitions: normalizeAbilityDefinitions(state.abilityDefinitions),
    myUserId,
    isMyTurn: state.currentPlayerId === myUserId,
  };
}

function buildMatchViewFromBattleState(
  state: BattleState,
  myUserId: string,
): MyMatchView | null {
  const battleState = toReplayBattleState(state, myUserId);
  if (!battleState) {
    return null;
  }

  const [myPlayer, opponentPlayer] = battleState.players;

  return {
    id: battleState.id,
    battleState,
    myPlayer,
    opponentPlayer,
    isMyTurn: battleState.isMyTurn,
    myUserId,
    turn: battleState.turn,
    phase: battleState.phase,
    winnerId: battleState.winnerId,
    abilityDefinitions: battleState.abilityDefinitions,
    log: battleState.log,
  };
}

export function buildReplayTurnViews(
  replay: NonNullable<PvpMatchDetailResponse["replay"]> | null | undefined,
  currentUserId: string,
): ReplayTurnView[] {
  if (!replay || !currentUserId) {
    return [];
  }

  const initialState = normalizeReplayState(replay.initialState);
  if (!initialState) {
    return [];
  }

  const groupedTurns = groupEventsByTurn(replay.log);
  if (groupedTurns.length === 0) {
    const fallbackState =
      normalizeReplayState(replay.finalState ?? null) ?? initialState;
    const matchView = buildMatchViewFromBattleState(fallbackState, currentUserId);

    return matchView
      ? [
          {
            turn: fallbackState.turn,
            events: [],
            matchView,
          },
        ]
      : [];
  }

  const emptyInitialState = { ...initialState, log: [] };
  const cumulativeEvents: CombatEvent[] = [];

  return groupedTurns.flatMap((group) => {
    cumulativeEvents.push(...group.events);
    const state = applyEventsToState(emptyInitialState, cumulativeEvents);
    const matchView = buildMatchViewFromBattleState(state, currentUserId);

    return matchView
      ? [
          {
            turn: group.turn,
            events: group.events,
            matchView,
          },
        ]
      : [];
  });
}

export function buildSpectateMatchView(
  battleState: PvpSpectateBattleState | null | undefined,
): MyMatchView | null {
  if (!battleState) {
    return null;
  }

  const [myPlayer, opponentPlayer] = battleState.players;
  if (!myPlayer || !opponentPlayer) {
    return null;
  }

  return {
    id: battleState.id,
    battleState: {
      ...battleState,
      myUserId: myPlayer.userId,
      isMyTurn: false,
      players: [myPlayer, opponentPlayer],
    } as PvpBattleState,
    myPlayer,
    opponentPlayer,
    isMyTurn: false,
    myUserId: myPlayer.userId,
    turn: battleState.turn,
    phase: battleState.phase,
    winnerId: battleState.winnerId ?? null,
    abilityDefinitions: battleState.abilityDefinitions,
    log: battleState.log,
  };
}
