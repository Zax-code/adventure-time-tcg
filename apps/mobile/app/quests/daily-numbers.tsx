import { Redirect, useLocalSearchParams } from "expo-router";

import type { DailyNumbersMode } from "@adventure-time/api-client";

function normalizeDailyNumbersMode(mode: string | undefined): DailyNumbersMode {
  if (mode === "1-5" || mode === "2-4" || mode === "3-3") {
    return mode;
  }

  if (mode === "expert") {
    return "3-3";
  }

  if (mode === "balanced") {
    return "2-4";
  }

  return "1-5";
}

export default function DailyNumbersRedirectScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = normalizeDailyNumbersMode(params.mode);

  return <Redirect href={`/quests/daily-numbers-play?mode=${mode}` as never} />;
}
