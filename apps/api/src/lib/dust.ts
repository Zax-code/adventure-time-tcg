export const DUST_SACRIFICE_BY_RARITY = {
  common: 1,
  uncommon: 5,
  rare: 20,
  epic: 50,
  legendary: 100,
} as const;

const CRAFT_COST_MULTIPLIER = 5;

function normalizeRarityName(rarityName: string) {
  const normalized = rarityName.trim().toLowerCase();
  if (normalized in DUST_SACRIFICE_BY_RARITY) {
    return normalized as keyof typeof DUST_SACRIFICE_BY_RARITY;
  }
  return "common" as const;
}

export function getDustSacrificeValue(rarityName: string) {
  return DUST_SACRIFICE_BY_RARITY[normalizeRarityName(rarityName)];
}

export function getDustCraftCost(rarityName: string) {
  return getDustSacrificeValue(rarityName) * CRAFT_COST_MULTIPLIER;
}
