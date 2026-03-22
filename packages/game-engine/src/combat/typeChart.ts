// Type advantage chart for combat
// Strong vs = 1.5x, Weak vs = 0.75x, Neutral = 1.0x

import { TypeName } from "./types";

// Type relationships as defined in spec
// Fire > Ice, Undead
// Ice > Demon, Magic
// Magic > Fire, Tech
// Tech > Candy, Royalty
// Royalty > Demon, Undead (moderate advantage)
// Candy: resists Fire and Magic (0.85x incoming), no direct attack weakness
// Undead > Candy; weak to Fire and Royalty
// Demon > Cosmic; weak to Ice and Royalty
// Cosmic > Magic; weak to Demon
// Hero: no strongs; global 0.9x damage taken

type TypeChart = Record<TypeName, Record<TypeName, number>>;

// Attacker -> Defender -> Multiplier
const TYPE_CHART: TypeChart = {
  Hero: {
    Hero: 1.0,
    Tech: 1.0,
    Royalty: 1.0,
    Candy: 1.0,
    Undead: 1.0,
    Ice: 1.0,
    Fire: 1.0,
    Magic: 1.0,
    Demon: 1.0,
    Cosmic: 1.0,
  },
  Tech: {
    Hero: 1.0,
    Tech: 1.0,
    Royalty: 1.5,
    Candy: 1.5,
    Undead: 1.0,
    Ice: 1.0,
    Fire: 1.0,
    Magic: 0.75,
    Demon: 1.0,
    Cosmic: 1.0,
  },
  Royalty: {
    Hero: 1.0,
    Tech: 0.75,
    Royalty: 1.0,
    Candy: 1.0,
    Undead: 1.25,
    Ice: 1.0,
    Fire: 1.0,
    Magic: 1.0,
    Demon: 1.25,
    Cosmic: 1.0,
  },
  Candy: {
    Hero: 1.0,
    Tech: 1.0,
    Royalty: 1.0,
    Candy: 1.0,
    Undead: 1.0,
    Ice: 1.0,
    Fire: 1.0,
    Magic: 1.0,
    Demon: 1.0,
    Cosmic: 1.0,
  },
  Undead: {
    Hero: 1.0,
    Tech: 1.0,
    Royalty: 0.75,
    Candy: 1.5,
    Undead: 1.0,
    Ice: 1.0,
    Fire: 0.75,
    Magic: 1.0,
    Demon: 1.0,
    Cosmic: 1.0,
  },
  Ice: {
    Hero: 1.0,
    Tech: 1.0,
    Royalty: 1.0,
    Candy: 1.0,
    Undead: 0.75,
    Ice: 1.0,
    Fire: 0.75,
    Magic: 1.5,
    Demon: 1.5,
    Cosmic: 1.0,
  },
  Fire: {
    Hero: 1.0,
    Tech: 1.0,
    Royalty: 1.0,
    Candy: 1.0,
    Undead: 1.5,
    Ice: 1.5,
    Fire: 1.0,
    Magic: 0.75,
    Demon: 1.0,
    Cosmic: 1.0,
  },
  Magic: {
    Hero: 1.0,
    Tech: 1.5,
    Royalty: 1.0,
    Candy: 1.0,
    Undead: 1.0,
    Ice: 0.75,
    Fire: 1.5,
    Magic: 1.0,
    Demon: 1.0,
    Cosmic: 0.75,
  },
  Demon: {
    Hero: 1.0,
    Tech: 1.0,
    Royalty: 0.75,
    Candy: 1.0,
    Undead: 1.0,
    Ice: 0.75,
    Fire: 1.0,
    Magic: 1.0,
    Demon: 1.0,
    Cosmic: 1.5,
  },
  Cosmic: {
    Hero: 1.0,
    Tech: 1.0,
    Royalty: 1.0,
    Candy: 1.0,
    Undead: 1.0,
    Ice: 1.0,
    Fire: 1.0,
    Magic: 1.5,
    Demon: 0.75,
    Cosmic: 1.0,
  },
};

/**
 * Get the type multiplier for attacker -> defender
 */
export function getTypeMultiplier(
  attackerType: TypeName,
  defenderType: TypeName,
): number {
  return TYPE_CHART[attackerType]?.[defenderType] ?? 1.0;
}

/**
 * Get incoming damage multiplier for a defender based on type-specific resistances
 * This is applied in addition to the type chart
 */
export function getIncomingDamageModifier(
  defenderType: TypeName,
  attackerType: TypeName,
): number {
  let modifier = 1.0;

  // Hero: global 0.95x damage taken
  if (defenderType === "Hero") {
    modifier *= 0.95;
  }

  // Candy: resists Fire and Magic (0.85x incoming from these types)
  if (
    defenderType === "Candy" &&
    (attackerType === "Fire" || attackerType === "Magic")
  ) {
    modifier *= 0.85;
  }

  return modifier;
}

/**
 * Check if a team has mixed types (for Hero synergy bonus)
 */
export function hasMixedTypes(units: { type: TypeName }[]): boolean {
  const types = new Set(units.map((u) => u.type));
  return types.size > 1;
}

/**
 * Get Hero synergy bonus (+5% all stats if at least one ally of different type is active)
 */
export function getHeroSynergyBonus(
  heroUnit: { type: TypeName },
  allyUnits: { type: TypeName }[],
): number {
  if (heroUnit.type !== "Hero") return 1.0;

  const hasOtherType = allyUnits.some((u) => u.type !== "Hero");
  return hasOtherType ? 1.05 : 1.0;
}

/**
 * Get description of type advantage
 */
export function getTypeAdvantageDescription(
  attackerType: TypeName,
  defenderType: TypeName,
): string {
  const mult = getTypeMultiplier(attackerType, defenderType);
  if (mult > 1) return "Super effective!";
  if (mult < 1) return "Not very effective...";
  return "";
}

/**
 * Get types that the given type is strong against
 */
export function getStrongAgainst(type: TypeName): TypeName[] {
  const chart = TYPE_CHART[type];
  if (!chart) return [];
  return (Object.entries(chart) as [TypeName, number][])
    .filter(([, mult]) => mult > 1)
    .map(([t]) => t);
}

/**
 * Get types that the given type is weak against
 */
export function getWeakAgainst(type: TypeName): TypeName[] {
  const chart = TYPE_CHART[type];
  if (!chart) return [];
  return (Object.entries(chart) as [TypeName, number][])
    .filter(([, mult]) => mult < 1)
    .map(([t]) => t);
}
