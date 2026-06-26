// Spoiler-safe share model for the daily Numbers quest.
//
// This module intentionally never accepts or exposes the player's solution
// steps or the official solution, so it is structurally impossible for the
// route to the answer to leak into a shared image. The daily target and
// starting board are identical for every player on a given mode/day, so only
// the player's outcome (final value, distance, score, time) is surfaced.

import type { DailyNumbersMode } from "@adventure-time/api-client";

export type DailyNumbersShareResult = {
  questTitle: string;
  modeLabel: string;
  mode: DailyNumbersMode;
  date?: string;
  target: number;
  finalValue: number | null;
  distance: number | null;
  score: number | null;
  elapsedTime: string;
  exact: boolean;
  completed: boolean;
};

export type BuildDailyNumbersShareResultInput = {
  questTitle: string;
  modeLabel: string;
  mode: DailyNumbersMode;
  date?: string | null;
  target: number;
  finalValue: number | null;
  distance: number | null;
  score: number | null;
  elapsedTime: string;
  exact: boolean;
  completed: boolean;
};

/**
 * Convert the finished Daily Numbers quest state into a sanitized, spoiler-safe
 * share result. The returned object contains only the outcome metadata and
 * never the solution steps.
 */
export function buildDailyNumbersShareResult(
  input: BuildDailyNumbersShareResultInput,
): DailyNumbersShareResult {
  return {
    questTitle: input.questTitle,
    modeLabel: input.modeLabel,
    mode: input.mode,
    date: input.date ?? undefined,
    target: input.target,
    finalValue: input.finalValue,
    distance: input.distance,
    score: input.score,
    elapsedTime: input.elapsedTime,
    exact: input.exact,
    completed: input.completed,
  };
}

/**
 * Build a human-readable, filesystem-safe file name for the shared result
 * image, e.g. "adventure-time-numbers-2026-06-26-1-5-exact-100.png".
 */
export function buildDailyNumbersShareFileName(
  result: DailyNumbersShareResult,
): string {
  const parts = ["adventure-time-numbers"];

  if (result.date) {
    parts.push(result.date);
  }

  parts.push(result.mode);

  if (result.exact) {
    parts.push("exact");
  } else if (result.completed) {
    parts.push("solved");
  } else {
    parts.push("missed");
  }

  if (result.score != null) {
    parts.push(`${result.score}`);
  }

  const slug = parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${slug || "adventure-time-numbers"}.png`;
}
