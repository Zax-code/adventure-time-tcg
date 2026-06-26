// Spoiler-safe share model for the daily Wordle quest.
//
// This module intentionally never accepts or exposes guessed letters, raw guess
// strings, or the answer. The builder only consumes per-tile evaluation
// statuses, so it is structurally impossible for letters to leak into a shared
// image.

export type WordleTileStatus = "correct" | "present" | "absent" | "empty";

export type WordleShareAttempt = {
  statuses: WordleTileStatus[];
};

export type WordleQuestShareResult = {
  questTitle: string;
  date?: string;
  attempts: WordleShareAttempt[];
  solved: boolean;
  attemptCount: number;
  maxAttempts: number;
  wordLength: number;
};

// Only tile evaluations are accepted here — never guess strings or the answer.
type WordleEvaluationStatus = "correct" | "present" | "absent";

export type BuildWordleShareResultInput = {
  questTitle: string;
  date?: string | null;
  solved: boolean;
  maxAttempts: number;
  wordLength: number;
  evaluations: ReadonlyArray<ReadonlyArray<WordleEvaluationStatus>>;
};

function normalizeStatus(status: WordleEvaluationStatus | undefined): WordleTileStatus {
  if (status === "correct" || status === "present" || status === "absent") {
    return status;
  }
  return "empty";
}

/**
 * Convert the current Wordle quest state into a sanitized, spoiler-safe share
 * result. The returned object contains only tile statuses and display metadata.
 */
export function buildWordleShareResult(
  input: BuildWordleShareResultInput,
): WordleQuestShareResult {
  const attempts: WordleShareAttempt[] = [];

  for (let row = 0; row < input.maxAttempts; row += 1) {
    const evaluation = input.evaluations[row];
    attempts.push({
      statuses: Array.from({ length: input.wordLength }, (_, col) =>
        evaluation ? normalizeStatus(evaluation[col]) : "empty",
      ),
    });
  }

  return {
    questTitle: input.questTitle,
    date: input.date ?? undefined,
    attempts,
    solved: input.solved,
    attemptCount: input.evaluations.length,
    maxAttempts: input.maxAttempts,
    wordLength: input.wordLength,
  };
}
