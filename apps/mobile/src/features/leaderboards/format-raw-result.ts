import type { LeaderboardRow } from "@adventure-time/api-client";

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export function formatLeaderboardRawResult(
  raw: LeaderboardRow["rawResult"],
  locale: "en" | "fr",
  t: Translate,
) {
  if (raw.kind === "duration_error_ms") return `${raw.absoluteErrorMs} ms`;
  if (raw.kind === "steps") {
    return t("rankings.results.steps", {
      count: raw.steps.toLocaleString(locale === "fr" ? "fr-FR" : "en-US"),
    });
  }
  if (raw.kind === "correct_answers") return String(raw.correctAnswers);
  if (raw.kind === "wordle_outcome") {
    return t(
      raw.guesses === 1
        ? "rankings.results.oneGuess"
        : "rankings.results.guesses",
      { count: raw.guesses },
    );
  }
  if (raw.kind === "exact_completion_time") {
    if (!raw.exact) return t("rankings.results.notExact");

    const seconds = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(raw.elapsedMs / 1_000);

    return t("rankings.results.seconds", { seconds });
  }
  if (raw.kind === "member_breakdown") return t("rankings.modes.combined");
  return "—";
}
