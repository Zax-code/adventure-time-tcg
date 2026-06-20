import cardOutlineCandyCommon from "../../assets/card-outlines/final-selected/card-outline-candy-common.png";
import cardOutlineCandyEpic from "../../assets/card-outlines/final-selected/card-outline-candy-epic.png";
import cardOutlineCandyLegendary from "../../assets/card-outlines/final-selected/card-outline-candy-legendary.png";
import cardOutlineCandyRare from "../../assets/card-outlines/final-selected/card-outline-candy-rare.png";
import cardOutlineCandyUncommon from "../../assets/card-outlines/final-selected/card-outline-candy-uncommon.png";
import cardOutlineIceCommon from "../../assets/card-outlines/final-selected/card-outline-ice-common.png";
import cardOutlineIceEpic from "../../assets/card-outlines/final-selected/card-outline-ice-epic.png";
import cardOutlineIceLegendary from "../../assets/card-outlines/final-selected/card-outline-ice-legendary.png";
import cardOutlineIceRare from "../../assets/card-outlines/final-selected/card-outline-ice-rare.png";
import cardOutlineIceUncommon from "../../assets/card-outlines/final-selected/card-outline-ice-uncommon.png";

import type { ThemeName } from "../theme/themes";

export type CardOutlineRarityName =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Epic"
  | "Legendary";

// Outlines are authored around ~965x1490, which sits very close to the legacy
// card art ratio (1024/1536). We reuse the legacy ratio for the card box so
// existing layouts keep their stable dimensions; the outline image itself is
// stretched with contentFit="fill" to absorb the ~3% difference.
export const CARD_OUTLINE_RATIO = 1024 / 1536;

type CardOutlineSource = string | number;

const CARD_OUTLINE_SOURCE: Record<
  ThemeName,
  Record<CardOutlineRarityName, CardOutlineSource>
> = {
  candy: {
    Common: cardOutlineCandyCommon,
    Uncommon: cardOutlineCandyUncommon,
    Rare: cardOutlineCandyRare,
    Epic: cardOutlineCandyEpic,
    Legendary: cardOutlineCandyLegendary,
  },
  ice: {
    Common: cardOutlineIceCommon,
    Uncommon: cardOutlineIceUncommon,
    Rare: cardOutlineIceRare,
    Epic: cardOutlineIceEpic,
    Legendary: cardOutlineIceLegendary,
  },
  // NOTE: nightosphere outlines are not authored yet. We intentionally fall
  // back to the candy outlines so the card still renders with a real frame
  // graphic instead of a blank box. Swap in dedicated nightosphere assets once
  // they are generated.
  nightosphere: {
    Common: cardOutlineCandyCommon,
    Uncommon: cardOutlineCandyUncommon,
    Rare: cardOutlineCandyRare,
    Epic: cardOutlineCandyEpic,
    Legendary: cardOutlineCandyLegendary,
  },
};

function resolveOutlineRarity(
  rarityName: string,
): CardOutlineRarityName {
  switch (rarityName) {
    case "Common":
    case "Uncommon":
    case "Rare":
    case "Epic":
    case "Legendary":
      return rarityName;
    default:
      return "Common";
  }
}

export function getCardOutlineSource(
  themeName: ThemeName,
  rarityName: string,
): CardOutlineSource {
  return CARD_OUTLINE_SOURCE[themeName][resolveOutlineRarity(rarityName)];
}
