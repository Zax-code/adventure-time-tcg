export type PackVisualIconKind =
  | "box"
  | "gift-box"
  | "sparkle"
  | "diamond"
  | "crown";
export type PackArtKind =
  | "basic"
  | "standard"
  | "premium"
  | "epic"
  | "legendary";

type PackVisualInput = {
  guaranteedRarity?: string | null;
  name: string;
};

type PackVisualProfile = {
  artKind: PackArtKind;
  iconColor: string;
  iconKind: PackVisualIconKind;
  rarityRank: number;
  sparkCount: number;
};

function getRarityRank(guaranteedRarity?: string | null) {
  switch (guaranteedRarity) {
    case "Legendary":
      return 4;
    case "Epic":
      return 3;
    case "Rare":
      return 2;
    case "Uncommon":
      return 1;
    default:
      return 0;
  }
}

export function getPackOpeningVisualProfile({
  guaranteedRarity,
  name,
}: PackVisualInput): PackVisualProfile {
  const rarityRank = getRarityRank(guaranteedRarity);
  const normalizedName = name.toLowerCase();

  if (normalizedName.includes("legendary") || rarityRank >= 4) {
    return {
      artKind: "legendary",
      iconColor: "#D97706",
      iconKind: "crown",
      rarityRank: 4,
      sparkCount: 24,
    };
  }

  if (normalizedName.includes("epic") || rarityRank >= 3) {
    return {
      artKind: "epic",
      iconColor: "#7C3AED",
      iconKind: "diamond",
      rarityRank: 3,
      sparkCount: 20,
    };
  }

  if (normalizedName.includes("premium") || rarityRank >= 2) {
    return {
      artKind: "premium",
      iconColor: "#8B5CF6",
      iconKind: "sparkle",
      rarityRank: 2,
      sparkCount: 18,
    };
  }

  if (normalizedName.includes("standard")) {
    return {
      artKind: "standard",
      iconColor: "#2563EB",
      iconKind: "gift-box",
      rarityRank: 0,
      sparkCount: 14,
    };
  }

  return {
    artKind: "basic",
    iconColor: "#6B7280",
    iconKind: "box",
    rarityRank: 0,
    sparkCount: 12,
  };
}
