export type SpeedCalculusShareRun = {
  runNumber: number;
  correctAnswers: number;
  errorAnswers: number;
  totalAnswers: number;
  accuracyPercentage: number;
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
        correctAnswers: run.correctAnswers,
        errorAnswers: Math.max(0, run.totalAnswered - run.correctAnswers),
        totalAnswers: run.totalAnswered,
        accuracyPercentage:
          run.totalAnswered === 0
            ? 0
            : Math.round((run.correctAnswers / run.totalAnswered) * 100),
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
