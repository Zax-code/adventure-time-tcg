export const DUST_SACRIFICE_BY_RARITY: Record<string, number> = {
  common: 1, uncommon: 5, rare: 20, epic: 50, legendary: 100,
};
const CRAFT_COST_MULTIPLIER = 5;

export function getDustSacrificeValue(rarityName: string): number {
  const key = rarityName.trim().toLowerCase();
  return DUST_SACRIFICE_BY_RARITY[key] ?? 1;
}

export function getDustCraftCost(rarityName: string): number {
  return getDustSacrificeValue(rarityName) * CRAFT_COST_MULTIPLIER;
}
