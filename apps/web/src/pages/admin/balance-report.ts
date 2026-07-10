import type { AdminCardsResponse } from "@adventure-time/api-client";

export const BALANCE_REPORT_SCHEMA_VERSION = 1;
export const BALANCE_HISTORY_LIMIT = 10;
export const BALANCE_HISTORY_STORAGE_KEY =
  "adventure-time-tcg.web.admin-balance-runs.v1";

export const DEFAULT_BALANCE_WEIGHTS = {
  hp: 0.2,
  attack: 2,
  defense: 1.5,
  speed: 1,
} as const;

export type BalanceScope = "active" | "all";
export type BalanceWeights = Record<keyof typeof DEFAULT_BALANCE_WEIGHTS, number>;
export type BalanceDownloadFormat = "json" | "csv";

type AdminCard = AdminCardsResponse["cards"][number];

export type BalanceGroup = {
  label: string;
  count: number;
  averageScore: number;
  minimumScore: number;
  maximumScore: number;
  dispersionPercent: number;
};

export type BalanceCardMetric = {
  id: string;
  name: string;
  character: string;
  rarity: string;
  type: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  powerScore: number;
  rarityDeltaPercent: number;
  rarityZScore: number;
  signal: "high" | "low" | "within-band";
};

export type BalanceRun = {
  schemaVersion: typeof BALANCE_REPORT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  source: "Phoenix admin card catalog";
  limitation: string;
  scope: BalanceScope;
  catalogFingerprint: string;
  weights: BalanceWeights;
  summary: {
    cardsAnalyzed: number;
    healthScore: number;
    withinRarityDispersion: number;
    typeGap: number;
    rarityProgression: number;
    outlierCount: number;
  };
  rarityBreakdown: BalanceGroup[];
  typeBreakdown: BalanceGroup[];
  outliers: BalanceCardMetric[];
  recommendations: string[];
  cards: BalanceCardMetric[];
};

const REPORT_LIMITATION =
  "Catalog-only diagnostic. It does not use match telemetry, abilities, type matchups, or predict win rates.";

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(
    values.reduce((total, value) => total + (value - mean) ** 2, 0) /
      values.length,
  );
}

function percentDifference(value: number, baseline: number) {
  if (baseline === 0) return 0;
  return ((value - baseline) / baseline) * 100;
}

function scoreCard(card: AdminCard, weights: BalanceWeights) {
  return (
    card.hp * weights.hp +
    card.attack * weights.attack +
    card.defense * weights.defense +
    card.speed * weights.speed
  );
}

function buildGroups(
  entries: Array<{ label: string; score: number }>,
): BalanceGroup[] {
  const groups = new Map<string, number[]>();

  entries.forEach(({ label, score }) => {
    const values = groups.get(label) ?? [];
    values.push(score);
    groups.set(label, values);
  });

  return Array.from(groups, ([label, values]) => {
    const mean = average(values);
    return {
      label,
      count: values.length,
      averageScore: round(mean),
      minimumScore: round(Math.min(...values)),
      maximumScore: round(Math.max(...values)),
      dispersionPercent: round(
        mean === 0 ? 0 : (standardDeviation(values) / mean) * 100,
      ),
    };
  }).sort((left, right) =>
    right.averageScore === left.averageScore
      ? left.label.localeCompare(right.label)
      : right.averageScore - left.averageScore,
  );
}

function groupRangePercent(groups: BalanceGroup[], globalAverage: number) {
  if (groups.length < 2 || globalAverage === 0) return 0;
  const averages = groups.map((group) => group.averageScore);
  return ((Math.max(...averages) - Math.min(...averages)) / globalAverage) * 100;
}

function fingerprintCards(cards: AdminCard[]) {
  const value = [...cards]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((card) =>
      [
        card.id,
        card.rarityId,
        card.type,
        card.hp,
        card.attack,
        card.defense,
        card.speed,
        card.isArchived ? 1 : 0,
      ].join(":"),
    )
    .join("|");
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return `catalog-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function createRunId(generatedAt: string, fingerprint: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${generatedAt}-${fingerprint}-${suffix}`;
}

export function buildBalanceRun(
  catalogCards: AdminCard[],
  options: {
    scope: BalanceScope;
    weights?: BalanceWeights;
    generatedAt?: string;
    id?: string;
  },
): BalanceRun {
  const requestedWeights = options.weights ?? DEFAULT_BALANCE_WEIGHTS;
  const weights: BalanceWeights = {
    hp: clamp(Number.isFinite(requestedWeights.hp) ? requestedWeights.hp : 0, 0, 10),
    attack: clamp(
      Number.isFinite(requestedWeights.attack) ? requestedWeights.attack : 0,
      0,
      10,
    ),
    defense: clamp(
      Number.isFinite(requestedWeights.defense) ? requestedWeights.defense : 0,
      0,
      10,
    ),
    speed: clamp(
      Number.isFinite(requestedWeights.speed) ? requestedWeights.speed : 0,
      0,
      10,
    ),
  };
  const sourceCards =
    options.scope === "active"
      ? catalogCards.filter((card) => !card.isArchived)
      : [...catalogCards];
  const scored = sourceCards.map((card) => ({
    card,
    score: scoreCard(card, weights),
  }));
  const globalScores = scored.map(({ score }) => score);
  const globalAverage = average(globalScores);
  const rarityBreakdown = buildGroups(
    scored.map(({ card, score }) => ({ label: card.rarityName, score })),
  );
  const typeBreakdown = buildGroups(
    scored.map(({ card, score }) => ({ label: card.type, score })),
  );
  const rarityScores = new Map<string, number[]>();

  scored.forEach(({ card, score }) => {
    const values = rarityScores.get(card.rarityName) ?? [];
    values.push(score);
    rarityScores.set(card.rarityName, values);
  });

  const cards = scored
    .map(({ card, score }): BalanceCardMetric => {
      const peerScores = rarityScores.get(card.rarityName) ?? globalScores;
      const comparisonScores =
        peerScores.length >= 3 ? peerScores : globalScores;
      const comparisonMean = average(comparisonScores);
      const comparisonDeviation = standardDeviation(comparisonScores);
      const zScore =
        comparisonDeviation === 0
          ? 0
          : (score - comparisonMean) / comparisonDeviation;
      const signal =
        zScore >= 1.5 ? "high" : zScore <= -1.5 ? "low" : "within-band";

      return {
        id: card.id,
        name: card.name,
        character: card.character,
        rarity: card.rarityName,
        type: card.type,
        hp: card.hp,
        attack: card.attack,
        defense: card.defense,
        speed: card.speed,
        powerScore: round(score),
        rarityDeltaPercent: round(
          percentDifference(score, average(peerScores)),
        ),
        rarityZScore: round(zScore),
        signal,
      };
    })
    .sort((left, right) =>
      right.powerScore === left.powerScore
        ? left.name.localeCompare(right.name)
        : right.powerScore - left.powerScore,
    );
  const outliers = cards
    .filter((card) => card.signal !== "within-band")
    .sort(
      (left, right) =>
        Math.abs(right.rarityZScore) - Math.abs(left.rarityZScore),
    );
  const withinRarityDispersion = sourceCards.length
    ? rarityBreakdown.reduce(
        (total, group) => total + group.dispersionPercent * group.count,
        0,
      ) / sourceCards.length
    : 0;
  const typeGap = groupRangePercent(typeBreakdown, globalAverage);
  const rarityProgression = groupRangePercent(rarityBreakdown, globalAverage);
  const outlierShare = sourceCards.length
    ? (outliers.length / sourceCards.length) * 100
    : 0;
  const healthScore = sourceCards.length && globalAverage > 0
    ? clamp(
        100 -
          Math.min(50, withinRarityDispersion * 1.25) -
          Math.min(30, typeGap * 0.5) -
          Math.min(20, outlierShare * 1.2),
        0,
        100,
      )
    : 0;
  const recommendations: string[] = [];

  if (globalAverage === 0) {
    recommendations.push(
      "Set at least one positive stat weight before interpreting this run.",
    );
  }
  if (withinRarityDispersion >= 15) {
    recommendations.push(
      "Review the widest rarity bands first; their weighted stat scores vary by at least 15%.",
    );
  }
  if (typeGap >= 15) {
    recommendations.push(
      "Compare the highest and lowest type groups; their average weighted scores differ by at least 15%.",
    );
  }
  if (outliers.length) {
    recommendations.push(
      `Inspect ${outliers.length} card${outliers.length === 1 ? "" : "s"} outside the 1.5σ comparison band before the next balance patch.`,
    );
  }
  if (!recommendations.length) {
    recommendations.push(
      "The catalog is compact under these weights; keep monitoring after card-stat changes.",
    );
  }
  recommendations.push(
    "Validate every catalog signal against canonical combat rules and live match telemetry before changing gameplay.",
  );

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const catalogFingerprint = fingerprintCards(sourceCards);

  return {
    schemaVersion: BALANCE_REPORT_SCHEMA_VERSION,
    id: options.id ?? createRunId(generatedAt, catalogFingerprint),
    generatedAt,
    source: "Phoenix admin card catalog",
    limitation: REPORT_LIMITATION,
    scope: options.scope,
    catalogFingerprint,
    weights: { ...weights },
    summary: {
      cardsAnalyzed: sourceCards.length,
      healthScore: round(healthScore),
      withinRarityDispersion: round(withinRarityDispersion),
      typeGap: round(typeGap),
      rarityProgression: round(rarityProgression),
      outlierCount: outliers.length,
    },
    rarityBreakdown,
    typeBreakdown,
    outliers,
    recommendations,
    cards,
  };
}

function isBalanceRun(value: unknown): value is BalanceRun {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const run = value as Partial<BalanceRun>;
  return (
    run.schemaVersion === BALANCE_REPORT_SCHEMA_VERSION &&
    typeof run.id === "string" &&
    typeof run.generatedAt === "string" &&
    run.source === "Phoenix admin card catalog" &&
    (run.scope === "active" || run.scope === "all") &&
    Boolean(run.summary && typeof run.summary.healthScore === "number") &&
    Array.isArray(run.rarityBreakdown) &&
    Array.isArray(run.typeBreakdown) &&
    Array.isArray(run.outliers) &&
    Array.isArray(run.recommendations) &&
    Array.isArray(run.cards)
  );
}

export function loadBalanceHistory(storage?: Pick<Storage, "getItem">) {
  if (!storage) return [];

  try {
    const raw = storage.getItem(BALANCE_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBalanceRun).slice(0, BALANCE_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function saveBalanceHistory(
  history: BalanceRun[],
  storage?: Pick<Storage, "setItem">,
) {
  const bounded = history.slice(0, BALANCE_HISTORY_LIMIT);
  if (!storage) return bounded;

  try {
    storage.setItem(BALANCE_HISTORY_STORAGE_KEY, JSON.stringify(bounded));
  } catch {
    // A report remains usable for the current session if storage is unavailable.
  }

  return bounded;
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeBalanceRun(
  run: BalanceRun,
  format: BalanceDownloadFormat,
) {
  if (format === "json") {
    return JSON.stringify(run, null, 2);
  }

  const headers = [
    "generatedAt",
    "scope",
    "catalogFingerprint",
    "cardId",
    "name",
    "character",
    "rarity",
    "type",
    "hp",
    "attack",
    "defense",
    "speed",
    "weightedScore",
    "rarityDeltaPercent",
    "comparisonZScore",
    "signal",
    "limitation",
  ];
  const rows = run.cards.map((card) => [
    run.generatedAt,
    run.scope,
    run.catalogFingerprint,
    card.id,
    card.name,
    card.character,
    card.rarity,
    card.type,
    card.hp,
    card.attack,
    card.defense,
    card.speed,
    card.powerScore,
    card.rarityDeltaPercent,
    card.rarityZScore,
    card.signal,
    run.limitation,
  ]);

  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

export function downloadBalanceRun(
  run: BalanceRun,
  format: BalanceDownloadFormat,
) {
  const content = serializeBalanceRun(run, format);
  const blob = new Blob([content], {
    type: format === "json" ? "application/json" : "text/csv",
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const timestamp = run.generatedAt.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");

  anchor.download = `adventure-time-balance-${timestamp}.${format}`;
  anchor.href = objectUrl;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
