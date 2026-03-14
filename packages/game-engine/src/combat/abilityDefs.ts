import type { AbilityDefinition, AbilityPayload, UnitState } from "./types";

type AbilityDefRecord = {
  key: string;
  name: string;
  description: string;
  type: string;
  cost: number;
  cooldown: number | null;
  oncePerMatch: boolean;
  payload: string | AbilityPayload | null;
};

export function toAbilityDefinition(
  record: AbilityDefRecord,
): AbilityDefinition {
  const payload =
    typeof record.payload === "string"
      ? (JSON.parse(record.payload) as AbilityPayload)
      : (record.payload ?? {});

  return {
    key: record.key,
    name: record.name,
    description: record.description,
    type: record.type as AbilityDefinition["type"],
    cost: record.cost,
    cooldown: record.cooldown ?? undefined,
    oncePerMatch: record.oncePerMatch,
    payload,
  };
}

export function buildAbilityDefinitionMap(
  records: AbilityDefRecord[],
): Record<string, AbilityDefinition> {
  const map: Record<string, AbilityDefinition> = {};
  for (const record of records) {
    map[record.key] = toAbilityDefinition(record);
  }
  return map;
}

export function collectAbilityKeysFromUnits(units: UnitState[]): string[] {
  const keys = new Set<string>();
  for (const unit of units) {
    for (const passive of unit.passives) keys.add(passive);
    keys.add(unit.skill);
    keys.add(unit.ultimate);
  }
  return [...keys];
}
