import type { PvpBattleState } from "./types";

type CombatEvent = PvpBattleState["log"][number];
type CombatEventPayload = CombatEvent["payload"];

function pickString(
  payload: CombatEventPayload,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

function pickNumber(
  payload: CombatEventPayload,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function pickBoolean(payload: CombatEventPayload, keys: string[]): boolean {
  return keys.some((key) => payload[key] === true);
}

export function getEventTargetInstanceId(event: CombatEvent): string | null {
  return pickString(event.payload, ["targetId", "targetInstanceId", "unitId"]);
}

export function getEventAmount(event: CombatEvent): number | null {
  return pickNumber(event.payload, [
    "amount",
    "actualDamage",
    "damage",
    "absorbed",
  ]);
}

export function getEventRemaining(event: CombatEvent): number | null {
  return pickNumber(event.payload, ["remaining"]);
}

export function getEventRoll(event: CombatEvent): number | null {
  return pickNumber(event.payload, ["roll", "initiativeTieRoll"]);
}

export function getEventChance(event: CombatEvent): number | null {
  return pickNumber(event.payload, ["chance", "initiativeTieChance"]);
}

export function getEventMissRoll(event: CombatEvent): number | null {
  return pickNumber(event.payload, ["missRoll"]);
}

export function getEventMissChance(event: CombatEvent): number | null {
  return pickNumber(event.payload, ["missChance"]);
}

export function getEventCritRoll(event: CombatEvent): number | null {
  return pickNumber(event.payload, ["critRoll"]);
}

export function getEventCritChance(event: CombatEvent): number | null {
  return pickNumber(event.payload, ["critChance"]);
}

export function getEventSelectedIndex(event: CombatEvent): number | null {
  return pickNumber(event.payload, ["selectedIndex"]);
}

export function getEventOptionCount(event: CombatEvent): number | null {
  return pickNumber(event.payload, ["optionCount"]);
}

export function didEventRollPass(event: CombatEvent): boolean {
  return pickBoolean(event.payload, ["passed"]);
}

export function isMissEvent(event: CombatEvent): boolean {
  return pickBoolean(event.payload, ["isMiss"]);
}

export function isCritEvent(event: CombatEvent): boolean {
  return event.type === "crit" || pickBoolean(event.payload, ["isCrit"]);
}

export function getEventActorName(event: CombatEvent): string | null {
  return pickString(event.payload, [
    "actorName",
    "attackerName",
    "sourceName",
    "playerName",
  ]);
}

export function getEventTargetName(event: CombatEvent): string | null {
  return pickString(event.payload, ["targetName", "unitName"]);
}

export function getEventAbilityLabel(event: CombatEvent): string | null {
  return pickString(event.payload, [
    "abilityName",
    "abilityKey",
    "passiveKey",
    "copiedKey",
    "copyKey",
  ]);
}

export function getEventStatusName(event: CombatEvent): string | null {
  return pickString(event.payload, ["statusName", "status"]);
}

export function getEventWinnerLabel(event: CombatEvent): string | null {
  return pickString(event.payload, ["winnerName"]);
}

export function isDrawEvent(event: CombatEvent): boolean {
  return event.payload.result === "draw" || event.payload.winnerId === null;
}

export function getEventSourceName(event: CombatEvent): string | null {
  return pickString(event.payload, ["sourceName", "fromName"]);
}

export function getEventDestinationName(event: CombatEvent): string | null {
  return pickString(event.payload, [
    "destinationName",
    "redirectedToName",
    "toName",
  ]);
}

export function getEventActorId(event: CombatEvent): string | null {
  return pickString(event.payload, [
    "actorId",
    "attackerId",
    "playerId",
    "unitId",
    "userId",
  ]);
}

export function getEventTargetId(event: CombatEvent): string | null {
  return getEventTargetInstanceId(event);
}

export function getEventWinnerId(event: CombatEvent): string | null {
  return pickString(event.payload, ["winnerId"]);
}

export function getEventSourceId(event: CombatEvent): string | null {
  return pickString(event.payload, [
    "sourceId",
    "sourceUnitId",
    "fromId",
    "originalTargetId",
  ]);
}

export function getEventDestinationId(event: CombatEvent): string | null {
  return pickString(event.payload, ["destinationId", "redirectedToId", "toId"]);
}
