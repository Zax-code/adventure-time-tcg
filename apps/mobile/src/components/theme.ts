export const CARD_TYPE_COLORS: Record<string, { frame: string; light: string; dark: string }> = {
  Hero:    { frame: "#60A5FA", light: "#DBEAFE", dark: "#1E40AF" },
  Tech:    { frame: "#2DD4BF", light: "#CCFBF1", dark: "#0F766E" },
  Royalty: { frame: "#F472B6", light: "#FCE7F3", dark: "#9D174D" },
  Candy:   { frame: "#FB7185", light: "#FFE4E6", dark: "#BE123C" },
  Undead:  { frame: "#A78BFA", light: "#EDE9FE", dark: "#5B21B6" },
  Ice:     { frame: "#22D3EE", light: "#CFFAFE", dark: "#0E7490" },
  Fire:    { frame: "#FB923C", light: "#FFEDD5", dark: "#C2410C" },
  Magic:   { frame: "#C084FC", light: "#F3E8FF", dark: "#7C3AED" },
  Demon:   { frame: "#F87171", light: "#FEE2E2", dark: "#B91C1C" },
  Cosmic:  { frame: "#818CF8", light: "#E0E7FF", dark: "#4338CA" },
};

export const SECONDARY_TINT = "rgba(253, 224, 71, 0.15)";

export const RARITY_COLORS: Record<string, { from: string; to: string; ring: string }> = {
  Common:    { from: "#9CA3AF", to: "#6B7280", ring: "#9CA3AF" },
  Uncommon:  { from: "#34D399", to: "#059669", ring: "#10B981" },
  Rare:      { from: "#60A5FA", to: "#2563EB", ring: "#3B82F6" },
  Epic:      { from: "#C084FC", to: "#7C3AED", ring: "#8B5CF6" },
  Legendary: { from: "#FCD34D", to: "#D97706", ring: "#F59E0B" },
};
