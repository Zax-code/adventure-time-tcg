export const SPEED_CALCULUS_QUEST_TYPE = "speed_calculus_daily";
export const SPEED_CALCULUS_RUN_DURATION_SECONDS = 30;
export const SPEED_CALCULUS_MAX_RUNS = 3;
export const SPEED_CALCULUS_REWARD_PER_ANSWER = 4;
export const SPEED_CALCULUS_FINISH_GRACE_SECONDS = 5;
export const SPEED_CALCULUS_QUESTION_COUNT = 120;

export type SpeedCalculusOperator = "+" | "-";
export type SpeedCalculusQuestion = {
  index: number;
  left: number;
  right: number;
  operator: SpeedCalculusOperator;
  answer: number;
};

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomInt(random: () => number, min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function buildSpeedCalculusQuestions(seed: string, count = SPEED_CALCULUS_QUESTION_COUNT): SpeedCalculusQuestion[] {
  const random = createSeededRandom(seed);
  const questions: SpeedCalculusQuestion[] = [];
  for (let index = 0; index < count; index += 1) {
    const operator: SpeedCalculusOperator = random() >= 0.5 ? "+" : "-";
    const left = randomInt(random, 0, 20);
    const right = randomInt(random, 0, 20);
    if (operator === "+") {
      questions.push({ index, left, right, operator, answer: left + right });
    } else {
      const high = Math.max(left, right);
      const low = Math.min(left, right);
      questions.push({ index, left: high, right: low, operator, answer: high - low });
    }
  }
  return questions;
}

export function toPublicQuestions(questions: SpeedCalculusQuestion[]) {
  return questions.map(({ answer: _answer, ...rest }) => rest);
}

export function calculateSpeedCalculusReward(correctAnswers: number) {
  return Math.max(0, correctAnswers) * SPEED_CALCULUS_REWARD_PER_ANSWER;
}

export const SPEED_CALCULUS_RESUME_PAUSE_SECONDS = 5;

export type SpeedCalculusRunHistoryEntry = {
  index: number;
  left: number;
  right: number;
  operator: SpeedCalculusOperator;
  userAnswer: number | null;
  wasAnswered: boolean;
  isCorrect: boolean;
  correctAnswer: number | null;
};

export function buildSpeedCalculusRunHistory(
  seed: string,
  answersJson: string,
): SpeedCalculusRunHistoryEntry[] {
  const questions = buildSpeedCalculusQuestions(seed);
  let answers: number[];
  try {
    answers = JSON.parse(answersJson) as number[];
  } catch {
    answers = [];
  }
  const answerCount = Math.min(answers.length, questions.length);

  return questions.slice(0, answerCount).map((question, index) => {
    const wasAnswered = index < answerCount;
    const userAnswer = wasAnswered ? (answers[index] ?? null) : null;
    const isCorrect = wasAnswered && userAnswer === question.answer;

    return {
      index: question.index,
      left: question.left,
      right: question.right,
      operator: question.operator,
      userAnswer,
      wasAnswered,
      isCorrect,
      correctAnswer: !wasAnswered || !isCorrect ? question.answer : null,
    };
  });
}

export function evaluateSpeedCalculusAnswers(
  seed: string,
  answersJson: string,
): { correctAnswers: number; totalAnswered: number } {
  const questions = buildSpeedCalculusQuestions(seed);
  let answers: number[];
  try {
    answers = JSON.parse(answersJson) as number[];
  } catch {
    answers = [];
  }
  let correctAnswers = 0;
  const limited = answers.slice(0, questions.length);
  limited.forEach((answer, index) => {
    if (questions[index]?.answer === answer) correctAnswers += 1;
  });
  return { correctAnswers, totalAnswered: limited.length };
}
