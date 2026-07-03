import * as Haptics from "expo-haptics";

import type {
  CollectionResponse,
  OpenPackResponse,
  PacksResponse,
} from "@adventure-time/api-client";
import { CARD_BACKCOVER_RATIO } from "../../components/card-back-cover-art";
import {
  getContainedPackOpeningArtLayout,
  getPackOpeningArtDimensions,
  type PackOpeningArtLayout,
} from "../../components/pack-opening-art";
import {
  RARITY_COLORS,
  RARITY_COLORS_ICE,
  RARITY_COLORS_NIGHTOSPHERE,
} from "../../components/theme";
import { getCatalogImageUrl } from "../../lib/catalog-images";
import type { ThemeName } from "../../theme/themes";

export type Pack = PacksResponse["packs"][number];
export type CardBackVisual = PacksResponse["cardBackVisuals"][number];
export type OpenedCard = OpenPackResponse["cards"][number];
export type CardTileEntry = CollectionResponse["cards"][number];
export type RarityName = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
export type CardBackVisualMap = Map<string, string>;
type BurstCrack = {
  path: string;
  dashLength: number;
  delay: number;
};
type BurstParticle = {
  id: string;
  travelX: number;
  travelY: number;
  size: number;
  spin: string;
  color: string;
};
type BurstShard = {
  id: string;
  travelX: number;
  travelY: number;
  width: number;
  height: number;
  spin: string;
};
export type PackBurstPattern = {
  cracks: BurstCrack[];
  particles: BurstParticle[];
  shards: BurstShard[];
};
export type LoadingSparkle = {
  id: string;
  travelX: number;
  travelY: number;
  size: number;
  delay: number;
  rotation: number;
};
export type CardBackStackSpec = {
  key: string;
  finalX: number;
  finalY: number;
  finalRotate: string;
  collapsedX: number;
  collapsedY: number;
  collapsedRotate: string;
  scale: number;
  zIndex: number;
};
export type OpeningPhase =
  | "selecting"
  | "shaking"
  | "bursting"
  | "loading"
  | "readyToReveal"
  | "revealing"
  | "complete";

export function isPackLimited(pack: Pack) {
  return pack.availability?.canOpen === false;
}

export function canOpenPackWithBalance(pack: Pack, coins: number) {
  return coins >= pack.cost && !isPackLimited(pack);
}

export function formatPackAvailabilityDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export const PACK_CARD_RATIO = 320 / 460;
export const REVEAL_CARD_RATIO = CARD_BACKCOVER_RATIO;
export const IS_E2E_BUILD = process.env.EXPO_PUBLIC_E2E_AUTH === "1";
export const PACK_OPEN_SHAKE_MS = IS_E2E_BUILD ? 3200 : 950;
export const PACK_OPEN_BURST_MS = IS_E2E_BUILD ? 2400 : 2800;
export const PACK_OPEN_PROGRESS_MS = IS_E2E_BUILD
  ? {
      first: 1400,
      second: 1400,
      final: 720,
    }
  : {
      first: 420,
      second: 420,
      final: 220,
    };
export const REVEAL_FLIP_MS = IS_E2E_BUILD ? 520 : 1120;
export const SPARK_REVEAL_FLIP_MS = IS_E2E_BUILD ? 980 : 2100;
export const REVEAL_START_DELAY_MS = IS_E2E_BUILD ? 200 : 420;
export const SPARK_REVEAL_START_DELAY_MS = IS_E2E_BUILD ? 360 : 920;
const BURST_PARTICLE_COLORS = [
  "#FFF2A8",
  "#FFC247",
  "#FF7622",
  "#FF3B16",
  "#7BD6FF",
];
export const TREASURE_RAY_SPECS = [
  {
    angle: 16,
    spread: 6,
    inner: 0.18,
    outer: 0.48,
    color: "rgba(255, 242, 168, 0.52)",
  },
  {
    angle: 52,
    spread: 7,
    inner: 0.2,
    outer: 0.44,
    color: "rgba(255, 194, 70, 0.42)",
  },
  {
    angle: 88,
    spread: 6,
    inner: 0.18,
    outer: 0.46,
    color: "rgba(255, 255, 210, 0.5)",
  },
  {
    angle: 124,
    spread: 7,
    inner: 0.2,
    outer: 0.42,
    color: "rgba(255, 202, 88, 0.38)",
  },
  {
    angle: 164,
    spread: 8,
    inner: 0.22,
    outer: 0.46,
    color: "rgba(255, 244, 180, 0.5)",
  },
  {
    angle: 214,
    spread: 7,
    inner: 0.2,
    outer: 0.42,
    color: "rgba(255, 177, 54, 0.38)",
  },
  {
    angle: 258,
    spread: 6,
    inner: 0.19,
    outer: 0.45,
    color: "rgba(255, 255, 218, 0.48)",
  },
  {
    angle: 304,
    spread: 7,
    inner: 0.2,
    outer: 0.43,
    color: "rgba(255, 203, 80, 0.42)",
  },
];
export const CARD_BACK_STACK_SPECS: [
  CardBackStackSpec,
  CardBackStackSpec,
  CardBackStackSpec,
] = [
  {
    key: "left",
    finalX: -30,
    finalY: 12,
    finalRotate: "-8deg",
    collapsedX: -6,
    collapsedY: 5,
    collapsedRotate: "-2deg",
    scale: 0.96,
    zIndex: 1,
  },
  {
    key: "right",
    finalX: 30,
    finalY: 12,
    finalRotate: "8deg",
    collapsedX: 6,
    collapsedY: 5,
    collapsedRotate: "2deg",
    scale: 0.96,
    zIndex: 2,
  },
  {
    key: "center",
    finalX: 0,
    finalY: -10,
    finalRotate: "0deg",
    collapsedX: 0,
    collapsedY: 0,
    collapsedRotate: "0deg",
    scale: 1,
    zIndex: 3,
  },
];
export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function slugifyPackName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toCardTileEntry(card: OpenedCard): CardTileEntry {
  return {
    id: `opened-${card.id}`,
    cardId: card.id,
    card,
    obtainedAt: new Date(0).toISOString(),
    quantity: 1,
  };
}

export function getRarityGlowColor(rarityName: string): string {
  switch (rarityName) {
    case "Legendary":
      return "#FFD166";
    case "Epic":
      return "#C084FC";
    case "Rare":
      return "#60A5FA";
    case "Uncommon":
      return "#34D399";
    default:
      return "#F472B6";
  }
}

export function getThemeRarityPalette(
  themeName: ThemeName,
  rarityName: RarityName,
) {
  const paletteMap =
    themeName === "ice"
      ? RARITY_COLORS_ICE
      : themeName === "nightosphere"
        ? RARITY_COLORS_NIGHTOSPHERE
        : RARITY_COLORS;

  return paletteMap[rarityName] ?? paletteMap.Common;
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function shuffleArray<T>(items: T[]) {
  return items
    .map((item) => ({ item, sort: Math.random() }))
    .sort((left, right) => left.sort - right.sort)
    .map(({ item }) => item);
}

function getPathLength(points: Array<{ x: number; y: number }>) {
  let length = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    length += Math.hypot(current.x - previous.x, current.y - previous.y);
  }

  return length;
}

function getRayToPackEdge(
  centerX: number,
  centerY: number,
  angle: number,
  artLayout: PackOpeningArtLayout,
) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const candidates: number[] = [];
  const left = artLayout.x;
  const right = artLayout.x + artLayout.width;
  const top = artLayout.y;
  const bottom = artLayout.y + artLayout.height;

  if (dx > 0) {
    candidates.push((right - centerX) / dx);
  } else if (dx < 0) {
    candidates.push((left - centerX) / dx);
  }

  if (dy > 0) {
    candidates.push((bottom - centerY) / dy);
  } else if (dy < 0) {
    candidates.push((top - centerY) / dy);
  }

  const distance = Math.min(...candidates.filter((candidate) => candidate > 0));

  return {
    x: centerX + dx * distance,
    y: centerY + dy * distance,
    dx,
    dy,
    distance,
  };
}

function createLightningCrackPath(
  centerX: number,
  centerY: number,
  angle: number,
  artLayout: PackOpeningArtLayout,
) {
  const edge = getRayToPackEdge(centerX, centerY, angle, artLayout);
  const normalX = -edge.dy;
  const normalY = edge.dx;
  const points = [{ x: centerX, y: centerY }];
  const segments = Math.floor(randomBetween(5, 8));

  for (let index = 1; index < segments; index += 1) {
    const progress = index / segments;
    const baseX = centerX + edge.dx * edge.distance * progress;
    const baseY = centerY + edge.dy * edge.distance * progress;
    const amplitude =
      Math.min(artLayout.width * 0.1, edge.distance * 0.11) *
      Math.sin(Math.PI * progress);
    const offset = randomBetween(-amplitude, amplitude);

    points.push({
      x: baseX + normalX * offset,
      y: baseY + normalY * offset,
    });
  }

  points.push({ x: edge.x, y: edge.y });

  return {
    path: points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
      )
      .join(" "),
    dashLength: Math.ceil(getPathLength(points)),
  };
}

export function createBurstPattern(
  width: number,
  height: number,
  pack?: Pick<Pack, "guaranteedRarity" | "name" | "packArtAssetId">,
): PackBurstPattern {
  const artDimensions = pack
    ? getPackOpeningArtDimensions(pack)
    : getPackOpeningArtDimensions({ name: "" });
  const artLayout = getContainedPackOpeningArtLayout(
    width,
    height,
    artDimensions,
  );
  const centerX = artLayout.x + artLayout.width * 0.5;
  const centerY = artLayout.y + artLayout.height * 0.47;
  const crackCount = 9;
  const startAngle = randomBetween(0, Math.PI * 2);
  const crackAngles = Array.from({ length: crackCount }, (_, index) => {
    const evenlySpaced = startAngle + (Math.PI * 2 * index) / crackCount;
    return evenlySpaced + randomBetween(-0.24, 0.24);
  });

  const cracks = shuffleArray(crackAngles).map((angle, index) => {
    const crackPath = createLightningCrackPath(
      centerX,
      centerY,
      angle,
      artLayout,
    );

    return {
      ...crackPath,
      delay: index * 0.05 + randomBetween(0, 0.03),
    };
  });

  const particles = Array.from({ length: 82 }, (_, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(140, 390);
    return {
      id: `particle-${index}`,
      travelX: Math.cos(angle) * distance,
      travelY: Math.sin(angle) * distance,
      size: randomBetween(4, 13),
      spin: `${Math.round(randomBetween(-540, 540))}deg`,
      color:
        BURST_PARTICLE_COLORS[
          Math.floor(randomBetween(0, BURST_PARTICLE_COLORS.length))
        ] ?? BURST_PARTICLE_COLORS[0],
    };
  });

  const shards = Array.from({ length: 18 }, (_, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(120, 330);
    return {
      id: `shard-${index}`,
      travelX: Math.cos(angle) * distance,
      travelY: Math.sin(angle) * distance,
      width: randomBetween(18, 28),
      height: randomBetween(30, 48),
      spin: `${Math.round(randomBetween(-760, 760))}deg`,
    };
  });

  return { cracks, particles, shards };
}

export function getPackArtUrl(pack: Pick<Pack, "packArtAssetId">) {
  return pack.packArtAssetId ? getCatalogImageUrl(pack.packArtAssetId) : null;
}

export function createLoadingSparkles(baseSize: number) {
  const maxDistance = baseSize * 0.92;
  const minDistance = baseSize * 0.19;

  return Array.from({ length: 36 }, (_, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(minDistance, maxDistance);

    return {
      id: `sparkle-${index}`,
      travelX: Math.cos(angle) * distance,
      travelY: Math.sin(angle) * distance,
      size: randomBetween(baseSize * 0.028, baseSize * 0.074),
      delay: randomBetween(0, 0.18),
      rotation: randomBetween(0, 80),
    };
  });
}

export function getTreasureRayPath(
  centerX: number,
  centerY: number,
  angleDeg: number,
  innerRadius: number,
  outerRadius: number,
  spreadDeg: number,
) {
  const startAngle = ((angleDeg - spreadDeg) * Math.PI) / 180;
  const endAngle = ((angleDeg + spreadDeg) * Math.PI) / 180;
  const tipAngle = (angleDeg * Math.PI) / 180;

  const startX = centerX + Math.cos(startAngle) * innerRadius;
  const startY = centerY + Math.sin(startAngle) * innerRadius;
  const endX = centerX + Math.cos(endAngle) * innerRadius;
  const endY = centerY + Math.sin(endAngle) * innerRadius;
  const tipX = centerX + Math.cos(tipAngle) * outerRadius;
  const tipY = centerY + Math.sin(tipAngle) * outerRadius;

  return `M ${startX.toFixed(1)} ${startY.toFixed(1)} L ${tipX.toFixed(1)} ${tipY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)} Z`;
}

export function withAlpha(hex: string, alpha: string) {
  if (hex.startsWith("#") && hex.length === 7) {
    return `${hex}${alpha}`;
  }

  return hex;
}

export function getHapticForCard(card: OpenedCard) {
  if (card.revealSource === "spark") {
    return Haptics.NotificationFeedbackType.Success;
  }

  const rarityName = card.rarity?.name ?? "Common";
  if (rarityName === "Legendary") {
    return Haptics.NotificationFeedbackType.Success;
  }
  if (rarityName === "Epic" || rarityName === "Rare") {
    return Haptics.NotificationFeedbackType.Warning;
  }
  return null;
}

export function toRarityName(value: string | undefined): RarityName {
  if (
    value === "Common" ||
    value === "Uncommon" ||
    value === "Rare" ||
    value === "Epic" ||
    value === "Legendary"
  ) {
    return value;
  }

  return "Common";
}

export function getCardBackVisualKey(
  themeName: ThemeName,
  rarityName: RarityName,
) {
  return `${themeName}:${rarityName}`;
}

export function buildCardBackVisualMap(
  visuals: CardBackVisual[],
): CardBackVisualMap {
  return new Map(
    visuals.flatMap((visual) =>
      visual.imageAssetId
        ? [
            [
              getCardBackVisualKey(visual.themeName, visual.rarityName),
              visual.imageAssetId,
            ],
          ]
        : [],
    ),
  );
}
