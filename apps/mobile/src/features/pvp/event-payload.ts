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

function pickBoolean(
  payload: CombatEventPayload,
  keys: string[],
): boolean {
  return keys.some((key) => payload[key] === true);
}

export function getEventTargetInstanceId(event: CombatEvent): string | null {
  return pickString(event.payload, ["targetId", "targetInstanceId", "unitId"]);
}

export function getEventAmount(event: CombatEvent): number | null {
  return pickNumber(event.payload, ["amount", "actualDamage", "damage", "absorbed"]);
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
    "userId",
  ]);
}

export function getEventTargetName(event: CombatEvent): string | null {
  return pickString(event.payload, ["targetName", "unitName"]);
}

export function getEventAbilityLabel(event: CombatEvent): string | null {
  return pickString(event.payload, ["abilityName", "abilityKey", "copiedKey", "copyKey"]);
}

export function getEventStatusName(event: CombatEvent): string | null {
  return pickString(event.payload, ["statusName", "status"]);
}

export function getEventWinnerLabel(event: CombatEvent): string | null {
  return pickString(event.payload, ["winnerName", "winnerId"]);
}
