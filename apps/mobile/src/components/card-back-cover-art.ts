import backcoverCandyCommon from "../../assets/backcovers/backcover-candy-common.png";
import backcoverCandyEpic from "../../assets/backcovers/backcover-candy-epic.png";
import backcoverCandyLegendary from "../../assets/backcovers/backcover-candy-legendary.png";
import backcoverCandyRare from "../../assets/backcovers/backcover-candy-rare.png";
import backcoverCandyUncommon from "../../assets/backcovers/backcover-candy-uncommon.png";
import backcoverIceCommon from "../../assets/backcovers/backcover-ice-common.png";
import backcoverIceEpic from "../../assets/backcovers/backcover-ice-epic.png";
import backcoverIceLegendary from "../../assets/backcovers/backcover-ice-legendary.png";
import backcoverIceRare from "../../assets/backcovers/backcover-ice-rare.png";
import backcoverIceUncommon from "../../assets/backcovers/backcover-ice-uncommon.png";
import backcoverNightosphereCommon from "../../assets/backcovers/backcover-nightosphere-common.png";
import backcoverNightosphereEpic from "../../assets/backcovers/backcover-nightosphere-epic.png";
import backcoverNightosphereLegendary from "../../assets/backcovers/backcover-nightosphere-legendary.png";
import backcoverNightosphereRare from "../../assets/backcovers/backcover-nightosphere-rare.png";
import backcoverNightosphereUncommon from "../../assets/backcovers/backcover-nightosphere-uncommon.png";

import { getCatalogImageUrl } from "../lib/catalog-images";
import type { ThemeName } from "../theme/themes";

export type CardBackcoverRarityName =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Epic"
  | "Legendary";

export const CARD_ART_RATIO = 1024 / 1536;
export const CARD_BACKCOVER_RATIO = CARD_ART_RATIO;

type CardBackcoverSource = string | number;

const CARD_BACKCOVER_SOURCE: Record<
  ThemeName,
  Record<CardBackcoverRarityName, CardBackcoverSource>
> = {
  candy: {
    Common: backcoverCandyCommon,
    Uncommon: backcoverCandyUncommon,
    Rare: backcoverCandyRare,
    Epic: backcoverCandyEpic,
    Legendary: backcoverCandyLegendary,
  },
  ice: {
    Common: backcoverIceCommon,
    Uncommon: backcoverIceUncommon,
    Rare: backcoverIceRare,
    Epic: backcoverIceEpic,
    Legendary: backcoverIceLegendary,
  },
  nightosphere: {
    Common: backcoverNightosphereCommon,
    Uncommon: backcoverNightosphereUncommon,
    Rare: backcoverNightosphereRare,
    Epic: backcoverNightosphereEpic,
    Legendary: backcoverNightosphereLegendary,
  },
};

export function getCardBackcoverSource(
  themeName: ThemeName,
  rarityName: CardBackcoverRarityName,
  imageAssetId?: string | null,
) {
  if (imageAssetId) {
    return getCatalogImageUrl(imageAssetId);
  }

  return CARD_BACKCOVER_SOURCE[themeName][rarityName];
}
