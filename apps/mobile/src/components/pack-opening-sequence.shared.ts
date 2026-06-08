import {
  getPackOpeningVisualProfile,
  type PackVisualIconKind,
} from "./pack-opening-visuals";
import type { PackAnimationData } from "./pack-opening-sequence.types";

export type PackOpeningCrack = {
  dashLength: number;
  delay: number;
  id: string;
  path: string;
};

export type PackOpeningParticle = {
  color: string;
  id: string;
  size: number;
  spinDeg: number;
  x: number;
  y: number;
};

export type PackOpeningShard = {
  id: string;
  spinDeg: number;
  x: number;
  y: number;
};

export type PackOpeningSparkle = {
  burstDelayProgress: number;
  id: string;
  loadingOffsetProgress: number;
  rotationDeg: number;
  size: number;
  x: number;
  y: number;
};

export type PackOpeningPalette = {
  base: string;
  border: string;
  bright: string;
  dark: string;
  deep: string;
  highlight: string;
  icon: string;
  shadow: string;
  soft: string;
  surface: string;
};

export type PackOpeningPattern = {
  cracks: PackOpeningCrack[];
  particles: PackOpeningParticle[];
  shards: PackOpeningShard[];
  sparkles: PackOpeningSparkle[];
};

export type TreasureRaySpec = {
  angle: number;
  color: string;
  inner: number;
  outer: number;
  spread: number;
};

export const CARD_W = 230;
export const CARD_H = 330;
export const PACK_CARD_RATIO = CARD_W / CARD_H;
const CENTER = { x: CARD_W * 0.5, y: CARD_H * 0.47 };

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string) {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#C96A24";
  return {
    b: Number.parseInt(normalized.slice(5, 7), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    r: Number.parseInt(normalized.slice(1, 3), 16),
  };
}

export function withAlpha(hex: string, alpha: string) {
  if (hex.startsWith("#") && hex.length === 7) {
    return `${hex}${alpha}`;
  }

  return hex;
}

export function mixHex(baseHex: string, targetHex: string, amount: number) {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  const channels: Array<keyof typeof base> = ["r", "g", "b"];

  return `#${channels
    .map((channel) =>
      clampChannel(
        base[channel] + (target[channel] - base[channel]) * amount,
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function shuffleArray<T>(items: T[]) {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((left, right) => left.sort - right.sort)
    .map(({ item }) => item);
}

function getRayToCardEdge(angle: number) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const candidates: number[] = [];

  if (dx > 0) {
    candidates.push((CARD_W - CENTER.x) / dx);
  }
  if (dx < 0) {
    candidates.push((0 - CENTER.x) / dx);
  }
  if (dy > 0) {
    candidates.push((CARD_H - CENTER.y) / dy);
  }
  if (dy < 0) {
    candidates.push((0 - CENTER.y) / dy);
  }

  const distance = Math.min(...candidates.filter((candidate) => candidate > 0));

  return {
    distance,
    dx,
    dy,
    x: CENTER.x + dx * distance,
    y: CENTER.y + dy * distance,
  };
}

function createLightningCrackPath(angle: number) {
  const edge = getRayToCardEdge(angle);
  const normalX = -edge.dy;
  const normalY = edge.dx;
  const points = [CENTER];
  const segments = Math.floor(randomBetween(5, 8));

  for (let index = 1; index < segments; index += 1) {
    const progress = index / segments;
    const baseX = CENTER.x + edge.dx * edge.distance * progress;
    const baseY = CENTER.y + edge.dy * edge.distance * progress;
    const amplitude =
      Math.min(22, edge.distance * 0.11) * Math.sin(Math.PI * progress);
    const offset = randomBetween(-amplitude, amplitude);

    points.push({
      x: baseX + normalX * offset,
      y: baseY + normalY * offset,
    });
  }

  points.push({ x: edge.x, y: edge.y });

  return {
    dashLength: Math.ceil(
      points.slice(1).reduce((length, point, index) => {
        const previousPoint = points[index];
        if (!previousPoint) {
          return length;
        }

        return (
          length +
          Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y)
        );
      }, 0),
    ),
    path: points
      .map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
      )
      .join(" "),
  };
}

function buildCracks(): PackOpeningCrack[] {
  const count = 9;
  const start = randomBetween(0, Math.PI * 2);
  const angles = Array.from({ length: count }, (_, index) => {
    const evenlySpaced = start + (Math.PI * 2 * index) / count;
    return evenlySpaced + randomBetween(-0.24, 0.24);
  });

  return shuffleArray(angles).map((angle, index) => {
    const path = createLightningCrackPath(angle);
    return {
      ...path,
      delay: index * 0.075 + randomBetween(0, 0.045),
      id: `crack-${index}`,
    };
  });
}

function buildParticlePalette(packColor: string, iconColor: string) {
  return [
    mixHex(packColor, "#FFFFFF", 0.74),
    mixHex(packColor, "#FFFFFF", 0.46),
    packColor,
    iconColor,
    mixHex(packColor, "#140707", 0.34),
  ];
}

function buildBurstElements(pack: PackAnimationData) {
  const profile = getPackOpeningVisualProfile(pack);
  const particlePalette = buildParticlePalette(pack.color, profile.iconColor);
  const particles = Array.from({ length: 82 }, (_, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(140, 390);
    return {
      color:
        particlePalette[
          Math.floor(randomBetween(0, particlePalette.length))
        ] ?? particlePalette[0],
      id: `particle-${index}`,
      size: randomBetween(4, 13),
      spinDeg: randomBetween(-540, 540),
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  });

  const shards = Array.from({ length: 18 }, (_, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(120, 330);
    return {
      id: `shard-${index}`,
      spinDeg: randomBetween(-760, 760),
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  });

  return { particles, shards };
}

function buildSparkles(count: number): PackOpeningSparkle[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(44, 215);
    return {
      burstDelayProgress: randomBetween(0.68, 0.84),
      id: `sparkle-${index}`,
      loadingOffsetProgress: randomBetween(0, 1),
      rotationDeg: randomBetween(0, 80),
      size: randomBetween(7, 19),
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  });
}

export function createPackOpeningPattern(
  pack: PackAnimationData,
): PackOpeningPattern {
  const visualProfile = getPackOpeningVisualProfile(pack);
  const burst = buildBurstElements(pack);

  return {
    cracks: buildCracks(),
    particles: burst.particles,
    shards: burst.shards,
    sparkles: buildSparkles(visualProfile.sparkCount),
  };
}

export function createPackOpeningPalette(
  pack: Pick<PackAnimationData, "color">,
  iconColor: string,
): PackOpeningPalette {
  return {
    base: pack.color,
    border: mixHex(pack.color, "#F3C55E", 0.38),
    bright: mixHex(pack.color, "#FFF7DF", 0.52),
    dark: mixHex(pack.color, "#2A1407", 0.56),
    deep: mixHex(pack.color, "#130907", 0.74),
    highlight: mixHex(pack.color, "#FFF6C5", 0.72),
    icon: iconColor,
    shadow: mixHex(pack.color, "#331007", 0.72),
    soft: mixHex(pack.color, "#FFF4EC", 0.28),
    surface: mixHex(pack.color, "#FFF7F3", 0.48),
  };
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

export function createTreasureRaySpecs(
  palette: PackOpeningPalette,
): TreasureRaySpec[] {
  return [
    {
      angle: 16,
      color: withAlpha(palette.highlight, "8F"),
      inner: 0.18,
      outer: 0.48,
      spread: 6,
    },
    {
      angle: 52,
      color: withAlpha(palette.soft, "6B"),
      inner: 0.2,
      outer: 0.44,
      spread: 7,
    },
    {
      angle: 88,
      color: "#FFFFFF80",
      inner: 0.18,
      outer: 0.46,
      spread: 6,
    },
    {
      angle: 124,
      color: withAlpha(palette.base, "61"),
      inner: 0.2,
      outer: 0.42,
      spread: 7,
    },
    {
      angle: 164,
      color: withAlpha(palette.highlight, "80"),
      inner: 0.22,
      outer: 0.46,
      spread: 8,
    },
    {
      angle: 214,
      color: withAlpha(palette.base, "61"),
      inner: 0.2,
      outer: 0.42,
      spread: 7,
    },
    {
      angle: 258,
      color: "#FFFFFF7A",
      inner: 0.19,
      outer: 0.45,
      spread: 6,
    },
    {
      angle: 304,
      color: withAlpha(palette.soft, "6B"),
      inner: 0.2,
      outer: 0.43,
      spread: 7,
    },
  ];
}

export function getPackOpeningIconProps(pack: PackAnimationData): {
  iconColor: string;
  iconKind: PackVisualIconKind;
} {
  const profile = getPackOpeningVisualProfile(pack);
  return {
    iconColor: profile.iconColor,
    iconKind: profile.iconKind,
  };
}
