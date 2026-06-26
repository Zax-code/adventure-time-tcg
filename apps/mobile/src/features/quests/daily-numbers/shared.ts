import type { DailyNumbersMode, DailyNumbersStateResponse } from "@adventure-time/api-client";

import { THEME_COLORS } from "../../../theme/themes";

export const DAILY_NUMBERS_MODES: DailyNumbersMode[] = ["1-5", "2-4", "3-3"];

export function formatDailyNumbersElapsedTime(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function getQuestTypeForMode(mode: DailyNumbersMode) {
  if (mode === "1-5") {
    return "daily_numbers_1_5";
  }

  if (mode === "2-4") {
    return "daily_numbers_2_4";
  }

  return "daily_numbers_3_3";
}

export function getModeLabelKey(mode: DailyNumbersMode) {
  if (mode === "1-5") {
    return "quests.dailyNumbers.oneFive";
  }

  if (mode === "2-4") {
    return "quests.dailyNumbers.twoFour";
  }

  return "quests.dailyNumbers.threeThree";
}

export function getModeAccent(
  mode: DailyNumbersMode,
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS],
) {
  if (mode === "1-5") {
    return {
      border: tc.primaryBorder,
      bg: tc.primaryBg,
      tint: tc.primaryTint,
      text: tc.primaryStrong,
    };
  }

  if (mode === "2-4") {
    return {
      border: tc.infoBorder,
      bg: tc.infoTint,
      tint: tc.surfaceMuted,
      text: tc.infoText,
    };
  }

  return {
    border: tc.accentBorder,
    bg: tc.accentTint,
    tint: tc.surfaceMuted,
    text: tc.accentStrong,
  };
}

export function getModeStatusLabel(
  modeState: DailyNumbersStateResponse | undefined,
  isLoading: boolean,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (!modeState) {
    return isLoading ? t("common.loading") : t("quests.dailyNumbers.freshLabel");
  }

  if (modeState.claimed) {
    return t("quests.dailyNumbers.claimedLabel");
  }

  if (modeState.completed) {
    return t("quests.dailyNumbers.completedLabel");
  }

  if (modeState.submission) {
    return t("quests.dailyNumbers.submittedLabel");
  }

  return t("quests.dailyNumbers.freshLabel");
}
