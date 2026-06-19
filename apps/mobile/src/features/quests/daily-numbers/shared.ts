import type { DailyNumbersMode, DailyNumbersStateResponse } from "@adventure-time/api-client";

import { THEME_COLORS } from "../../../theme/themes";

export const DAILY_NUMBERS_MODES: DailyNumbersMode[] = ["classic", "expert"];

export function getQuestTypeForMode(mode: DailyNumbersMode) {
  return mode === "classic" ? "daily_numbers_classic" : "daily_numbers_expert";
}

export function getModeAccent(
  mode: DailyNumbersMode,
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS],
) {
  return mode === "classic"
    ? {
        border: tc.primaryBorder,
        bg: tc.primaryBg,
        tint: tc.primaryTint,
        text: tc.primaryStrong,
      }
    : {
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
