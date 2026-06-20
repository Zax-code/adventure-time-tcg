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
  packArtAssetId?: string | null;
  packArtUrl?: string | null;
};

type PackOpeningArtDimensions = {
  height: number;
  width: number;
};

export type PackOpeningArtLayout = PackOpeningArtDimensions & {
  x: number;
  y: number;
};

export const PACK_OPENING_ART_SOURCE = {
  basic: basicPackArt,
  epic: epicPackArt,
  legendary: legendaryPackArt,
  premium: premiumPackArt,
  standard: standardPackArt,
} satisfies Record<PackArtKind, string | number>;

export const PACK_OPENING_ART_DIMENSIONS = {
  basic: { height: 1438, width: 861 },
  epic: { height: 1440, width: 863 },
  legendary: { height: 1439, width: 861 },
  premium: { height: 1438, width: 861 },
  standard: { height: 1438, width: 861 },
} satisfies Record<PackArtKind, PackOpeningArtDimensions>;

export function getPackOpeningArtSource(pack: PackArtInput) {
  if (pack.packArtUrl) {
    return pack.packArtUrl;
  }

  return PACK_OPENING_ART_SOURCE[getPackOpeningVisualProfile(pack).artKind];
}

export function getPackOpeningArtDimensions(pack: PackArtInput) {
  return PACK_OPENING_ART_DIMENSIONS[getPackOpeningVisualProfile(pack).artKind];
}

export function getContainedPackOpeningArtLayout(
  containerWidth: number,
  containerHeight: number,
  artDimensions: PackOpeningArtDimensions,
): PackOpeningArtLayout {
  const containerRatio = containerWidth / containerHeight;
  const artRatio = artDimensions.width / artDimensions.height;
  const layout =
    artRatio > containerRatio
      ? {
          width: containerWidth,
          height: containerWidth / artRatio,
        }
      : {
          width: containerHeight * artRatio,
          height: containerHeight,
        };

  return {
    ...layout,
    x: (containerWidth - layout.width) / 2,
    y: (containerHeight - layout.height) / 2,
  };
}
