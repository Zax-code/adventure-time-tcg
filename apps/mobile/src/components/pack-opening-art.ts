import basicPackArt from "../../assets/pack-opening/basic-pack.png";
import epicPackArt from "../../assets/pack-opening/epic-pack.png";
import legendaryPackArt from "../../assets/pack-opening/legendary-pack.png";
import premiumPackArt from "../../assets/pack-opening/premium-pack.png";
import standardPackArt from "../../assets/pack-opening/standard-pack.png";

import {
  getPackOpeningVisualProfile,
  type PackArtKind,
} from "./pack-opening-visuals";

type PackArtInput = {
  guaranteedRarity?: string | null;
  name: string;
};

export const PACK_OPENING_ART_SOURCE = {
  basic: basicPackArt,
  epic: epicPackArt,
  legendary: legendaryPackArt,
  premium: premiumPackArt,
  standard: standardPackArt,
} satisfies Record<PackArtKind, string | number>;

export function getPackOpeningArtSource(pack: PackArtInput) {
  return PACK_OPENING_ART_SOURCE[getPackOpeningVisualProfile(pack).artKind];
}
