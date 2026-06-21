import outlineCandyCommon from "../../assets/card-outlines/card-outline-candy-common.png";
import outlineCandyEpic from "../../assets/card-outlines/card-outline-candy-epic.png";
import outlineCandyLegendary from "../../assets/card-outlines/card-outline-candy-legendary.png";
import outlineCandyRare from "../../assets/card-outlines/card-outline-candy-rare.png";
import outlineCandyUncommon from "../../assets/card-outlines/card-outline-candy-uncommon.png";
import outlineIceCommon from "../../assets/card-outlines/card-outline-ice-common.png";
import outlineIceEpic from "../../assets/card-outlines/card-outline-ice-epic.png";
import outlineIceLegendary from "../../assets/card-outlines/card-outline-ice-legendary.png";
import outlineIceRare from "../../assets/card-outlines/card-outline-ice-rare.png";
import outlineIceUncommon from "../../assets/card-outlines/card-outline-ice-uncommon.png";

import type { CardBackcoverRarityName } from "./card-back-cover-art";
import type { ThemeName } from "../theme/themes";

type CardOutlineThemeName = Extract<ThemeName, "candy" | "ice">;
type CardOutlineSource = string | number;

const CARD_OUTLINE_SOURCE: Record<
  CardOutlineThemeName,
  Record<CardBackcoverRarityName, CardOutlineSource>
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
};

export function getCardOutlineSource(
  themeName: ThemeName,
  rarityName: CardBackcoverRarityName,
) {
  const outlineThemeName: CardOutlineThemeName =
    themeName === "ice" ? "ice" : "candy";

  return CARD_OUTLINE_SOURCE[outlineThemeName][rarityName];
}
