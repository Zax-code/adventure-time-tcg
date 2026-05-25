// Replay engine for reconstructing battle state from logs
// This allows replaying matches turn-by-turn using the combat events

import { BattleState, CombatEvent, CardData, StatusName } from "./types";
import { createBattleState } from "./simulate";

/**
 * A snapshot of the battle state at a specific point in time
 */
export interface ReplaySnapshot {
  turn: number;
  eventIndex: number; // Index of the last event processed
  state: BattleState;
  events: CombatEvent[]; // Events that occurred to reach this state
}

/**
 * Replay data needed to reconstruct a match
 */
export interface ReplayData {
  log: CombatEvent[];
  seed: string;
  inviterCards: CardData[];
  inviteeCards: CardData[];
  inviter: { userId: string; name: string };
  invitee: { userId: string; name: string };
  matchId: string;
}

/**
 * Groups events by turn for easier navigation
 */
export interface TurnEvents {
  turn: number;
  events: CombatEvent[];
  startIndex: number;
  endIndex: number;
}

/**
 * Group combat events by turn
 */
export function groupEventsByTurn(log: CombatEvent[]): TurnEvents[] {
  const turns: TurnEvents[] = [];
  let currentTurn: TurnEvents | null = null;

  for (let i = 0; i < log.length; i++) {
    const event = log[i];

    // Start a new turn group on turnStart or if turn number changes
    if (event.type === "turnStart" || event.type === "matchStart") {
      if (currentTurn) {
        currentTurn.endIndex = i - 1;
        turns.push(currentTurn);
      }
      currentTurn = {
        turn: event.turn,
        events: [event],
        startIndex: i,
        endIndex: i,
      };
    } else if (currentTurn) {
      currentTurn.events.push(event);
      currentTurn.endIndex = i;
    } else {
      // Events before first turnStart (shouldn't happen normally)
      currentTurn = {
        turn: event.turn,
        events: [event],
        startIndex: i,
        endIndex: i,
      };
    }
  }

  // Don't forget the last turn
  if (currentTurn) {
    turns.push(currentTurn);
  }

  return turns;
}

/**
 * Get the total number of turns in a match
 */
export function getTotalTurns(log: CombatEvent[]): number {
  if (log.length === 0) return 0;

  const lastEvent = log[log.length - 1];
  return lastEvent.turn;
}

/**
 * Get events up to a specific turn (inclusive)
 */
export function getEventsUpToTurn(
  log: CombatEvent[],
  turn: number,
): CombatEvent[] {
  return log.filter((event) => event.turn <= turn);
}

/**
 * Get events for a specific turn only
 */
export function getEventsForTurn(
  log: CombatEvent[],
  turn: number,
): CombatEvent[] {
  return log.filter((event) => event.turn === turn);
}

/**
 * Create the initial battle state for replay
 */
export function createInitialReplayState(data: ReplayData): BattleState {
  return createBattleState(
    data.matchId,
    {
      userId: data.inviter.userId,
      name: data.inviter.name,
      cards: data.inviterCards,
    },
    {
      userId: data.invitee.userId,
      name: data.invitee.name,
      cards: data.inviteeCards,
    },
    data.seed,
  );
}

/**
 * Result of applying a single event
 */
export interface ApplyEventResult {
  success: boolean;
  error?: string;
}

/**
 * Apply events to reconstruct state at a specific point
 * Returns the final state and any failed events
 */
export function applyEventsToState(
  initialState: BattleState,
  events: CombatEvent[],
): BattleState {
  // Deep clone the initial state
  const state = JSON.parse(JSON.stringify(initialState)) as BattleState;

  // Apply each event's effects to reconstruct state
  for (const event of events) {
    const result = applyEventToState(state, event);
    if (!result.success) {
      console.warn(
        `[replay] Event ${event.seq} (${event.type}) failed: ${result.error}`,
      );
    }
  }

  return state;
}

/**
 * Apply a single event to update state
 * Returns result indicating success or failure
 */
function applyEventToState(state: BattleState, event: CombatEvent): ApplyEventResult {
  state.log.push(event);
  const payload = event.payload;

  const targetId = pickString(payload, ["targetId", "unitId"]);
  const statusName = pickString(payload, ["statusName", "status", "name"]);

  switch (event.type) {
    case "matchStart":
      // Initial state is already set
      return { success: true };

    case "turnStart":
      if (!payload.playerId) {
        return { success: false, error: "missing playerId" };
      }
      state.turn = event.turn;
      state.currentPlayerId = payload.playerId as string;
      state.actionsThisTurn = [];
      state.turnEnded = false;
      return { success: true };

    case "turnEnd":
      state.turnEnded = true;
      return { success: true };

    case "energyGrant": {
      if (!payload.playerId) {
        return { success: false, error: "missing playerId" };
      }
      const player = state.players.find((p) => p.userId === payload.playerId);
      if (!player) {
        return { success: false, error: `player ${payload.playerId} not found` };
      }
      player.energy = (payload.amount as number) ?? 0;
      return { success: true };
    }

    case "damage": {
      const targetId = pickString(payload, ["targetId", "unitId"]);
      if (!targetId) {
        return { success: false, error: "missing targetId" };
      }
      const target = findUnit(state, targetId);
      if (!target) {
        return { success: false, error: `target unit ${targetId} not found` };
      }
      if (typeof payload.hpAfter !== "number") {
        return { success: false, error: `invalid hpAfter: ${payload.hpAfter}` };
      }
      target.hp = payload.hpAfter;
      return { success: true };
    }

    case "heal": {
      const targetId = pickString(payload, ["targetId", "unitId"]);
      if (!targetId) {
        return { success: false, error: "missing targetId" };
      }
      const target = findUnit(state, targetId);
      if (!target) {
        return { success: false, error: `target unit ${targetId} not found` };
      }
      if (typeof payload.hpAfter === "number") {
        target.hp = payload.hpAfter;
      }
      return { success: true };
    }

    case "shieldAbsorb": {
      const targetId = pickString(payload, ["targetId", "unitId"]);
      if (!targetId) {
        return { success: false, error: "missing targetId" };
      }
      const target = findUnit(state, targetId);
      if (!target) {
        return { success: false, error: `target unit ${targetId} not found` };
      }
      const shieldStatus = target.statuses.find((s) => s.name === "Shield");
      if (shieldStatus && shieldStatus.magnitude !== undefined) {
        const absorbed = pickNumber(payload, ["amount", "absorbed"]);
        const remaining =
          pickNumber(payload, ["remaining"]) ??
          Math.max(0, shieldStatus.magnitude - (absorbed ?? 0));

        shieldStatus.magnitude = remaining;
        if (shieldStatus.magnitude <= 0) {
          target.statuses = target.statuses.filter((s) => s.name !== "Shield");
        }
      }
      return { success: true };
    }

    case "statusApply": {
      if (!targetId) {
        return { success: false, error: "missing targetId/unitId" };
      }
      const target = findUnit(state, targetId);
      if (!target) {
        return { success: false, error: `target unit ${targetId} not found` };
      }
      if (!statusName) {
        return { success: false, error: "missing status name" };
      }
      // Remove existing status of same name
      target.statuses = target.statuses.filter((s) => s.name !== statusName);
      // Add new status
      target.statuses.push({
        name: statusName as StatusName,
        duration: (payload.duration as number) ?? 1,
        magnitude: payload.magnitude as number | undefined,
        appliedAt: event.turn,
      });
      return { success: true };
    }

    case "statusExpire":
    case "statusCleanse": {
      if (!targetId) {
        return { success: false, error: "missing unitId" };
      }
      const target = findUnit(state, targetId);
      if (!target) {
        return { success: false, error: `unit ${targetId} not found` };
      }
      if (statusName) {
        target.statuses = target.statuses.filter((s) => s.name !== statusName);
      }
      return { success: true };
    }

    case "statusTick": {
      // Status tick applies damage/healing from DoT/Regen effects
      if (!targetId) {
        return { success: false, error: "missing unitId" };
      }
      const target = findUnit(state, targetId);
      if (!target) {
        return { success: false, error: `unit ${targetId} not found` };
      }
      const amount = pickNumber(payload, ["amount"]);
      const legacyDamage = pickNumber(payload, ["damage"]);
      const legacyHealing = pickNumber(payload, ["healing"]);
      const inferredDamage = amount && amount > 0 && legacyHealing == null ? amount : null;

      // Apply damage from status tick
      if ((legacyDamage ?? inferredDamage ?? 0) > 0) {
        target.hp = Math.max(0, target.hp - (legacyDamage ?? inferredDamage ?? 0));
      }
      // Apply healing from status tick
      if ((legacyHealing ?? 0) > 0) {
        target.hp = Math.min(target.maxHp, target.hp + (legacyHealing ?? 0));
      }
      return { success: true };
    }

    case "ko": {
      if (!targetId) {
        return { success: false, error: "missing unitId" };
      }
      const unit = findUnit(state, targetId);
      if (!unit) {
        return { success: false, error: `unit ${targetId} not found` };
      }
      unit.hp = 0;
      return { success: true };
    }

    case "swap": {
      if (!payload.activeOut || !payload.benchIn) {
        return { success: false, error: "missing activeOut or benchIn" };
      }
      // Find the player
      for (const player of state.players) {
        const activeUnit = player.units.find(
          (u) => u.instanceId === payload.activeOut,
        );
        const benchUnit = player.bench.find(
          (u) => u.instanceId === payload.benchIn,
        );

        if (activeUnit && benchUnit) {
          const position = activeUnit.position;

          // Swap positions
          activeUnit.position = null;
          benchUnit.position = position;

          // Move between arrays
          player.units = player.units.filter(
            (u) => u.instanceId !== activeUnit.instanceId,
          );
          player.bench = player.bench.filter(
            (u) => u.instanceId !== benchUnit.instanceId,
          );
          player.units.push(benchUnit);
          player.bench.push(activeUnit);
          return { success: true };
        }
      }
      return { success: false, error: "swap units not found" };
    }

    case "formation": {
      const playerId = payload.playerId as string | undefined;
      if (!playerId) {
        return { success: false, error: "missing playerId" };
      }
      const player = state.players.find((p) => p.userId === playerId);
      const moves = Array.isArray(payload.moves)
        ? (payload.moves as Array<{
            unitId?: string;
            from?: "active" | "bench";
            to?: "active" | "bench";
            toPosition?: 1 | 2 | 3 | null;
          }>)
        : [];
      if (!player || moves.length === 0) {
        return { success: false, error: "no player or moves found" };
      }

      for (const move of moves) {
        if (!move.unitId || !move.from || !move.to) continue;
        const fromList = move.from === "active" ? player.units : player.bench;
        const unit = fromList.find((u) => u.instanceId === move.unitId);
        if (!unit) continue;

        if (move.from === "active") {
          player.units = player.units.filter((u) => u.instanceId !== move.unitId);
        } else {
          player.bench = player.bench.filter((u) => u.instanceId !== move.unitId);
        }

        unit.position = move.to === "active" ? (move.toPosition ?? unit.position) : null;
        if (move.to === "active") {
          player.units.push(unit);
        } else {
          player.bench.push(unit);
        }
      }
      return { success: true };
    }

    case "cooldownTick": {
      const targetId = pickString(payload, ["targetId", "unitId"]);
      if (!targetId) {
        return { success: false, error: "missing unitId" };
      }
      const unit = findUnit(state, targetId);
      if (!unit) {
        return { success: false, error: `unit ${targetId} not found` };
      }
      const abilityKey = payload.abilityKey as string;
      if (abilityKey) {
        unit.cooldowns[abilityKey] = (payload.remaining as number) ?? 0;
      }
      return { success: true };
    }

    case "revive": {
      const targetId = pickString(payload, ["targetId", "unitId"]);
      if (!targetId) {
        return { success: false, error: "missing targetId" };
      }
      const target = findUnit(state, targetId);
      if (!target) {
        return { success: false, error: `target unit ${targetId} not found` };
      }
      target.hp = (payload.hp as number) ?? 1;
      return { success: true };
    }

    case "gameOver":
      state.phase = "ended";
      state.winnerId = payload.winnerId as string;
      return { success: true };

    case "abilityStart":
    case "passiveTrigger":
    case "crit":
    case "pass":
    case "concede":
    case "coverRedirect":
    case "thorns":
    case "counter":
    case "preventDeath":
    case "statusSteal":
    case "swapHp":
    case "freeze_skip":
    case "stun_consume":
      // These events don't affect state - they're informational
      return { success: true };

    default:
      return { success: false, error: `unhandled event type: ${(event as CombatEvent).type}` };
  }
}

function pickString(payload: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function pickNumber(payload: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

/**
 * Find a unit across all players
 */
function findUnit(state: BattleState, instanceId: string) {
  for (const player of state.players) {
    const unit = player.units.find((u) => u.instanceId === instanceId);
    if (unit) return unit;
    const benchUnit = player.bench.find((u) => u.instanceId === instanceId);
    if (benchUnit) return benchUnit;
  }
  return null;
}

/**
 * Create snapshots at each turn start for efficient navigation
 */
export function createTurnSnapshots(
  data: ReplayData,
): Map<number, ReplaySnapshot> {
  const snapshots = new Map<number, ReplaySnapshot>();
  const turnGroups = groupEventsByTurn(data.log);

  // Create initial state
  const initialState = createInitialReplayState(data);

  // The initial state already includes turn 1 start
  snapshots.set(0, {
    turn: 0,
    eventIndex: -1,
    state: JSON.parse(JSON.stringify(initialState)),
    events: [],
  });

  const currentState = JSON.parse(JSON.stringify(initialState)) as BattleState;
  currentState.log = []; // Clear log for replay tracking

  for (const turnGroup of turnGroups) {
    // Apply all events for this turn
    for (const event of turnGroup.events) {
      applyEventToState(currentState, event);
    }

    // Save snapshot at end of turn
    snapshots.set(turnGroup.turn, {
      turn: turnGroup.turn,
      eventIndex: turnGroup.endIndex,
      state: JSON.parse(JSON.stringify(currentState)),
      events: turnGroup.events,
    });
  }

  return snapshots;
}

/**
 * Get a summary of what happened in a turn
 */
export function getTurnSummary(events: CombatEvent[]): string[] {
  const summary: string[] = [];

  for (const event of events) {
    switch (event.type) {
      case "damage":
        if (event.payload.isCrit) {
          summary.push(
            `Critical hit for ${event.payload.damage || event.payload.actualDamage} damage!`,
          );
        }
        break;
      case "ko":
        summary.push(`A unit was knocked out!`);
        break;
      case "statusApply":
        summary.push(
          `${event.payload.statusName || event.payload.name} applied`,
        );
        break;
      case "swap":
        summary.push(`A swap was made`);
        break;
      case "formation":
        summary.push(`Team formation changed`);
        break;
      case "gameOver":
        summary.push(`Match ended!`);
        break;
    }
  }

  return summary;
}
