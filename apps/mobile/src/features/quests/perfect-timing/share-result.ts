import type { PerfectTimingTier } from "@adventure-time/api-client";

export type PerfectTimingShareAttempt = {
  attemptNumber: number;
  elapsedMs: number | null;
  tier: PerfectTimingTier | null;
  unused: boolean;
  finalized: boolean;
};

export type PerfectTimingShareResult = {
  questTitle: string;
  date?: string;
  targetMs: number;
  finalTier: PerfectTimingTier;
  finalizedAttemptNumber: number;
  attempts: PerfectTimingShareAttempt[];
};

export type BuildPerfectTimingShareResultInput = {
  questTitle: string;
  date?: string | null;
  targetMs: number;
  finalTier: PerfectTimingTier;
  finalizedAttemptNumber: number;
  attempts: ReadonlyArray<{
    attemptNumber: number;
    elapsedMs: number | null;
    tier: PerfectTimingTier | null;
  }>;
};

export function buildPerfectTimingShareResult(
  input: BuildPerfectTimingShareResultInput,
): PerfectTimingShareResult {
  return {
    questTitle: input.questTitle,
    date: input.date ?? undefined,
    targetMs: input.targetMs,
    finalTier: input.finalTier,
    finalizedAttemptNumber: input.finalizedAttemptNumber,
    attempts: Array.from({ length: 3 }, (_, index) => {
      const attemptNumber = index + 1;
      const attempt = input.attempts.find(
        (candidate) => candidate.attemptNumber === attemptNumber,
      );

      return {
        attemptNumber,
        elapsedMs: attempt?.elapsedMs ?? null,
        tier: attempt?.tier ?? null,
        unused: !attempt,
        finalized: attemptNumber === input.finalizedAttemptNumber,
      };
    }),
  };
}

export function buildPerfectTimingShareFileName(
  result: PerfectTimingShareResult,
) {
  const parts = [
    "adventure-time-perfect-timing",
    result.date,
    result.finalTier,
    `attempt-${result.finalizedAttemptNumber}`,
  ].filter(Boolean);

  const slug = parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${slug || "adventure-time-perfect-timing"}.png`;
}
