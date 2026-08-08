import type {
  PerfectTimingDirection,
  PerfectTimingTier,
} from "@adventure-time/api-client";

import type { Locale } from "../../../i18n/types";

const BASE_REWARD = 50;

const TIER_RULES: ReadonlyArray<{
  tier: Exclude<PerfectTimingTier, "miss">;
  maximumDeviationMs: number;
  bonusPercent: number;
}> = [
  { tier: "perfect", maximumDeviationMs: 10, bonusPercent: 100 },
  { tier: "amazing", maximumDeviationMs: 50, bonusPercent: 50 },
  { tier: "great", maximumDeviationMs: 150, bonusPercent: 25 },
  { tier: "close", maximumDeviationMs: 300, bonusPercent: 10 },
];

export type PerfectTimingLocalResult = {
  deviationMs: number;
  direction: PerfectTimingDirection;
  tier: PerfectTimingTier;
  reward: number;
};

export function elapsedMilliseconds(startedAt: number, stoppedAt: number) {
  return Math.max(0, Math.round(stoppedAt - startedAt));
}

export function formatPerfectTimingMilliseconds(
  milliseconds: number,
  locale: Locale,
) {
  const formatter = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    useGrouping: false,
  });

  return `${formatter.format(milliseconds / 1_000)} s`;
}

export function visibleTimerText(
  startedAt: number,
  currentTime: number,
  locale: Locale,
) {
  const elapsed = Math.max(0, currentTime - startedAt);
  if (elapsed >= 1_000) {
    return "???";
  }

  return formatPerfectTimingMilliseconds(Math.floor(elapsed), locale);
}

export function calculatePerfectTimingResult(
  targetMs: number,
  elapsedMs: number,
): PerfectTimingLocalResult {
  const deviationMs = Math.abs(elapsedMs - targetMs);
  const rule = TIER_RULES.find(
    ({ maximumDeviationMs }) => deviationMs <= maximumDeviationMs,
  );
  const direction: PerfectTimingDirection =
    elapsedMs < targetMs ? "early" : elapsedMs > targetMs ? "late" : "exact";

  if (!rule) {
    return { deviationMs, direction, tier: "miss", reward: 0 };
  }

  return {
    deviationMs,
    direction,
    tier: rule.tier,
    reward: Math.floor(
      (BASE_REWARD * (100 + rule.bonusPercent) + 99) / 100,
    ),
  };
}
