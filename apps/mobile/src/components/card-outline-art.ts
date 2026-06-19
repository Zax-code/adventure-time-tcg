import candyCommonOutline from "../../assets/card-outlines/final-selected/card-outline-candy-common.png";
import candyEpicOutline from "../../assets/card-outlines/final-selected/card-outline-candy-epic.png";
import candyLegendaryOutline from "../../assets/card-outlines/final-selected/card-outline-candy-legendary.png";
import candyRareOutline from "../../assets/card-outlines/final-selected/card-outline-candy-rare.png";
import candyUncommonOutline from "../../assets/card-outlines/final-selected/card-outline-candy-uncommon.png";
import iceCommonOutline from "../../assets/card-outlines/final-selected/card-outline-ice-common.png";
import iceEpicOutline from "../../assets/card-outlines/final-selected/card-outline-ice-epic.png";
import iceLegendaryOutline from "../../assets/card-outlines/final-selected/card-outline-ice-legendary.png";
import iceRareOutline from "../../assets/card-outlines/final-selected/card-outline-ice-rare.png";
import iceUncommonOutline from "../../assets/card-outlines/final-selected/card-outline-ice-uncommon.png";

import type { ThemeName } from "../theme/themes";

export type CardOutlineRarityName =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Epic"
  | "Legendary";

type CardOutlineSource = string | number;

type CardOutlineThemeMap = Partial<
  Record<ThemeName, Partial<Record<CardOutlineRarityName, CardOutlineSource>>>
>;

export const CARD_OUTLINE_SAFE_AREA = {
  left: 0.124,
  right: 0.126,
  top: 0.1,
  bottom: 0.069,
} as const;

const CARD_OUTLINE_SOURCE: CardOutlineThemeMap = {
  candy: {
    Common: candyCommonOutline,
    Uncommon: candyUncommonOutline,
    Rare: candyRareOutline,
    Epic: candyEpicOutline,
    Legendary: candyLegendaryOutline,
  },
  ice: {
    Common: iceCommonOutline,
    Uncommon: iceUncommonOutline,
    Rare: iceRareOutline,
    Epic: iceEpicOutline,
    Legendary: iceLegendaryOutline,
  },
};

export function getCardOutlineSource(
  themeName: ThemeName,
  rarityName: string,
): CardOutlineSource | null {
  const themeOutline = CARD_OUTLINE_SOURCE[themeName];
  if (!themeOutline) {
    return null;
  }

  if (rarityName in themeOutline) {
    return themeOutline[rarityName as CardOutlineRarityName] ?? null;
  }

  return themeOutline.Common ?? null;
}
