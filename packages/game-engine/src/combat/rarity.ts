// Rarity modifiers for combat stats
// Applied when initializing battle stats

import { RarityName } from "./types";

interface RarityModifiers {
  hpBonus: number; // percentage bonus to HP
  attackBonus: number; // percentage bonus to Attack
  defenseBonus: number; // percentage bonus to Defense (implicit, not in spec but added for completeness)
  extraPassiveSlot: boolean; // Legendary can have 2 passives
}

const RARITY_MODIFIERS: Record<RarityName, RarityModifiers> = {
  Common: {
    hpBonus: 0,
    attackBonus: 0,
    defenseBonus: 0,
    extraPassiveSlot: false,
  },
  Uncommon: {
    hpBonus: 0.02, // +2% HP
    attackBonus: 0,
    defenseBonus: 0,
    extraPassiveSlot: false,
  },
  Rare: {
    hpBonus: 0.02, // +2% HP
    attackBonus: 0.01, // +1% ATK
    defenseBonus: 0,
    extraPassiveSlot: false,
  },
  Epic: {
    hpBonus: 0.04, // +4% HP
    attackBonus: 0.02, // +2% ATK
    defenseBonus: 0,
    extraPassiveSlot: false,
  },
  Legendary: {
    hpBonus: 0.05, // +5% HP
    attackBonus: 0.03, // +3% ATK
    defenseBonus: 0,
    extraPassiveSlot: true, // +1 Passive slot
  },
};

/**
 * Get rarity modifiers for a given rarity
 */
export function getRarityModifiers(rarity: RarityName): RarityModifiers {
  return RARITY_MODIFIERS[rarity] ?? RARITY_MODIFIERS.Common;
}

/**
 * Apply rarity bonuses to base stats
 */
export function applyRarityBonuses(
  baseHp: number,
  baseAttack: number,
  baseDefense: number,
  rarity: RarityName,
): { hp: number; attack: number; defense: number } {
  const mods = getRarityModifiers(rarity);

  return {
    hp: Math.floor(baseHp * (1 + mods.hpBonus)),
    attack: Math.floor(baseAttack * (1 + mods.attackBonus)),
    defense: Math.floor(baseDefense * (1 + mods.defenseBonus)),
  };
}

/**
 * Check if a rarity allows an extra passive slot
 */
export function hasExtraPassiveSlot(rarity: RarityName): boolean {
  return getRarityModifiers(rarity).extraPassiveSlot;
}

/**
 * Parse rarity name from string (case-insensitive)
 */
export function parseRarity(rarityStr: string): RarityName {
  const normalized =
    rarityStr.charAt(0).toUpperCase() + rarityStr.slice(1).toLowerCase();
  if (normalized in RARITY_MODIFIERS) {
    return normalized as RarityName;
  }
  return "Common";
}
