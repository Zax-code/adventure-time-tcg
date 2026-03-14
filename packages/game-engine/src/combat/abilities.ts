import type { AbilityDefinition } from "./types";

/**
 * Resolve an ability definition from battle-state DB-backed definitions.
 */
export function getAbilityDefinition(
  key: string,
  abilityDefinitions?: Record<string, AbilityDefinition>,
): AbilityDefinition | undefined {
  return abilityDefinitions?.[key];
}
