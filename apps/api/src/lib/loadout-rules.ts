export const LOADOUT_RARITY_LIMITS = {
  Legendary: 1,
  Epic: 2,
} as const;

type RarityValue = string | { name?: string | null } | null | undefined;

export function validateLoadoutRarityCaps(rarities: RarityValue[]) {
  const counts = { Legendary: 0, Epic: 0 };
  for (const rarity of rarities) {
    const rarityName = typeof rarity === "string" ? rarity : (rarity?.name ?? undefined);
    if (rarityName === "Legendary") counts.Legendary += 1;
    if (rarityName === "Epic") counts.Epic += 1;
  }
  if (counts.Legendary > LOADOUT_RARITY_LIMITS.Legendary) {
    return { valid: false, error: "Loadout can include at most 1 Legendary" };
  }
  if (counts.Epic > LOADOUT_RARITY_LIMITS.Epic) {
    return { valid: false, error: "Loadout can include at most 2 Epic cards" };
  }
  return { valid: true };
}
