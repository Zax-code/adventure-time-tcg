import outlineCandyCommon from "../../assets/card-outlines/final-selected/card-outline-candy-common.png";
import outlineCandyEpic from "../../assets/card-outlines/final-selected/card-outline-candy-epic.png";
import outlineCandyLegendary from "../../assets/card-outlines/final-selected/card-outline-candy-legendary.png";
import outlineCandyRare from "../../assets/card-outlines/final-selected/card-outline-candy-rare.png";
import outlineCandyUncommon from "../../assets/card-outlines/final-selected/card-outline-candy-uncommon.png";
import outlineIceCommon from "../../assets/card-outlines/final-selected/card-outline-ice-common.png";
import outlineIceEpic from "../../assets/card-outlines/final-selected/card-outline-ice-epic.png";
import outlineIceLegendary from "../../assets/card-outlines/final-selected/card-outline-ice-legendary.png";
import outlineIceRare from "../../assets/card-outlines/final-selected/card-outline-ice-rare.png";
import outlineIceUncommon from "../../assets/card-outlines/final-selected/card-outline-ice-uncommon.png";

import type { CardBackcoverRarityName } from "./card-back-cover-art";
import type { ThemeName } from "../theme/themes";

type CardOutlineSource = string | number;

const CARD_OUTLINE_SOURCES: Record<
  ThemeName,
  Partial<Record<CardBackcoverRarityName, CardOutlineSource>>
> = {
  candy: {
    Common: outlineCandyCommon,
    Uncommon: outlineCandyUncommon,
    Rare: outlineCandyRare,
    Epic: outlineCandyEpic,
    Legendary: outlineCandyLegendary,
  },
  ice: {
    Common: outlineIceCommon,
    Uncommon: outlineIceUncommon,
    Rare: outlineIceRare,
    Epic: outlineIceEpic,
    Legendary: outlineIceLegendary,
  },
  // Nightosphere frames are still pending, so we fall back to candy for now.
  nightosphere: {},
};

const CARD_OUTLINE_FALLBACK_THEME: Record<ThemeName, ThemeName> = {
  candy: "candy",
  ice: "ice",
  nightosphere: "candy",
};

export const CARD_OUTLINE_SAFE_AREA = {
  left: "14.8%",
  right: "14.8%",
  top: "19.2%",
  bottom: "7.8%",
} as const;

export function getCardOutlineSource(
  themeName: ThemeName,
  rarityName: CardBackcoverRarityName,
) {
  const themeSource = CARD_OUTLINE_SOURCES[themeName][rarityName];
  if (themeSource) {
    return themeSource;
  }

  return CARD_OUTLINE_SOURCES[CARD_OUTLINE_FALLBACK_THEME[themeName]][rarityName];
}
