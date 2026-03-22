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

// Card type colors for non-default themes
export const CARD_TYPE_COLORS_ICE: Record<string, { frame: string; light: string; dark: string }> = {
  Hero:    { frame: "#60A5FA", light: "#DBEAFE", dark: "#1E40AF" },
  Tech:    { frame: "#22D3EE", light: "#CFFAFE", dark: "#0E7490" },
  Royalty: { frame: "#818CF8", light: "#E0E7FF", dark: "#3730A3" },
  Candy:   { frame: "#67E8F9", light: "#CFFAFE", dark: "#0E7490" },
  Undead:  { frame: "#A5B4FC", light: "#E0E7FF", dark: "#3730A3" },
  Ice:     { frame: "#38BDF8", light: "#E0F2FE", dark: "#0369A1" },
  Fire:    { frame: "#FB923C", light: "#FFEDD5", dark: "#C2410C" },
  Magic:   { frame: "#C084FC", light: "#F3E8FF", dark: "#7C3AED" },
  Demon:   { frame: "#F87171", light: "#FEE2E2", dark: "#B91C1C" },
  Cosmic:  { frame: "#818CF8", light: "#E0E7FF", dark: "#4338CA" },
};

export const CARD_TYPE_COLORS_NIGHTOSPHERE: Record<string, { frame: string; light: string; dark: string }> = {
  Hero:    { frame: "#EF4444", light: "#2d0f0f", dark: "#B91C1C" },
  Tech:    { frame: "#F97316", light: "#1c0d05", dark: "#C2410C" },
  Royalty: { frame: "#C084FC", light: "#1e0a2e", dark: "#7C3AED" },
  Candy:   { frame: "#FB7185", light: "#1c0505", dark: "#BE123C" },
  Undead:  { frame: "#A78BFA", light: "#1e0a2e", dark: "#5B21B6" },
  Ice:     { frame: "#22D3EE", light: "#022c22", dark: "#0E7490" },
  Fire:    { frame: "#F97316", light: "#1c0d05", dark: "#C2410C" },
  Magic:   { frame: "#C084FC", light: "#1e0a2e", dark: "#7C3AED" },
  Demon:   { frame: "#EF4444", light: "#1c0505", dark: "#B91C1C" },
  Cosmic:  { frame: "#818CF8", light: "#0f0f2e", dark: "#4338CA" },
};

export const RARITY_COLORS_ICE: Record<string, { from: string; to: string; ring: string }> = {
  Common:    { from: "#94A3B8", to: "#64748B", ring: "#94A3B8" },
  Uncommon:  { from: "#34D399", to: "#059669", ring: "#10B981" },
  Rare:      { from: "#60A5FA", to: "#2563EB", ring: "#3B82F6" },
  Epic:      { from: "#818CF8", to: "#4338CA", ring: "#6366F1" },
  Legendary: { from: "#FCD34D", to: "#D97706", ring: "#F59E0B" },
};

export const RARITY_COLORS_NIGHTOSPHERE: Record<string, { from: string; to: string; ring: string }> = {
  Common:    { from: "#4B5563", to: "#374151", ring: "#6B7280" },
  Uncommon:  { from: "#10B981", to: "#059669", ring: "#34D399" },
  Rare:      { from: "#EF4444", to: "#DC2626", ring: "#F87171" },
  Epic:      { from: "#C084FC", to: "#7C3AED", ring: "#A855F7" },
  Legendary: { from: "#F97316", to: "#EA580C", ring: "#FB923C" },
};

export const SECONDARY_TINT = "rgba(253, 224, 71, 0.15)";

export const RARITY_COLORS: Record<string, { from: string; to: string; ring: string }> = {
  Common:    { from: "#9CA3AF", to: "#6B7280", ring: "#9CA3AF" },
  Uncommon:  { from: "#34D399", to: "#059669", ring: "#10B981" },
  Rare:      { from: "#60A5FA", to: "#2563EB", ring: "#3B82F6" },
  Epic:      { from: "#C084FC", to: "#7C3AED", ring: "#8B5CF6" },
  Legendary: { from: "#FCD34D", to: "#D97706", ring: "#F59E0B" },
};
