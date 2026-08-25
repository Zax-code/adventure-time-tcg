export type SpeedCalculusShareRun = {
  runNumber: number;
  incorrectAnswers: number;
  correctAnswers: number;
  accuracyPercentage: number;
  score: number;
};

export type SpeedCalculusShareResult = {
  questTitle: string;
  date?: string;
  runs: SpeedCalculusShareRun[];
};

type BuildSpeedCalculusShareResultInput = {
  questTitle: string;
  date?: string | null;
  runs: ReadonlyArray<{
    runNumber: number;
    score: number;
    totalAnswered: number;
    correctAnswers: number;
  }>;
};

export function buildSpeedCalculusShareResult(
  input: BuildSpeedCalculusShareResultInput,
): SpeedCalculusShareResult {
  return {
    questTitle: input.questTitle,
    date: input.date ?? undefined,
    runs: [...input.runs]
      .sort((left, right) => left.runNumber - right.runNumber)
      .map((run) => ({
        runNumber: run.runNumber,
        incorrectAnswers: Math.max(0, run.totalAnswered - run.correctAnswers),
        correctAnswers: run.correctAnswers,
        accuracyPercentage:
          run.totalAnswered === 0
            ? 0
            : Math.round((run.correctAnswers / run.totalAnswered) * 100),
        score: run.score,
      })),
  };
}

export function buildSpeedCalculusShareFileName(
  result: SpeedCalculusShareResult,
) {
  const slug = ["adventure-time-speed-calculus", result.date]
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${slug || "adventure-time-speed-calculus"}.png`;
}
