export type PackVisualIconKind =
  | "box"
  | "gift-box"
  | "sparkle"
  | "diamond"
  | "crown";

type PackVisualInput = {
  guaranteedRarity?: string | null;
  name: string;
};

type PackVisualProfile = {
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

  if (name.includes("Legendary") || rarityRank >= 4) {
    return {
      iconColor: "#D97706",
      iconKind: "crown",
      rarityRank: 4,
      sparkCount: 58,
    };
  }

  if (name.includes("Epic") || rarityRank >= 3) {
    return {
      iconColor: "#7C3AED",
      iconKind: "diamond",
      rarityRank: 3,
      sparkCount: 48,
    };
  }

  if (name.includes("Premium") || rarityRank >= 2) {
    return {
      iconColor: "#8B5CF6",
      iconKind: "sparkle",
      rarityRank: 2,
      sparkCount: 40,
    };
  }

  if (name.includes("Standard")) {
    return {
      iconColor: "#2563EB",
      iconKind: "gift-box",
      rarityRank: 0,
      sparkCount: 30,
    };
  }

  return {
    iconColor: "#6B7280",
    iconKind: "box",
    rarityRank: 0,
    sparkCount: 28,
  };
}
