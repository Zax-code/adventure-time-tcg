import { Redirect, useLocalSearchParams } from "expo-router";

export default function DailyNumbersRedirectScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = params.mode === "expert" ? "expert" : "classic";

  return <Redirect href={`/quests/daily-numbers-play?mode=${mode}` as never} />;
}
