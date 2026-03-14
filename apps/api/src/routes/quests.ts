import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import { db, speedCalculusDailyRuns, wordleDailyAttempts } from "@adventure-time/db";
import { claimQuestSchema, speedAnswerSchema, speedFinishSchema, wordleSubmitSchema } from "@adventure-time/shared";

import { buildQuestList, claimQuestReward, getSpeedCalculusState, materializeDailyQuestsForUser, syncSpeedCalculusQuestFromRuns } from "../services/quest-service";
import { SPEED_CALCULUS_FINISH_GRACE_SECONDS, SPEED_CALCULUS_MAX_RUNS, buildSpeedCalculusQuestions, calculateSpeedCalculusReward, toPublicQuestions } from "../lib/speed-calculus";
import { completeWordleQuest, evaluateGuess, getDailyFrenchWord, getWordleAttempts, getWordleDateKey, isValidFrenchWord, normalizeFrenchWord } from "../lib/wordle";

const WORDLE_MAX_ATTEMPTS = 6;

function serializeActiveRun(run: typeof speedCalculusDailyRuns.$inferSelect) {
  const answers = JSON.parse(run.answers) as number[];
  const questions = toPublicQuestions(buildSpeedCalculusQuestions(run.seed));
  return {
    runId: run.id,
    runNumber: run.runNumber,
    seed: run.seed,
    questionIndex: answers.length,
    questions,
    answers,
    pauseExpiresAt: run.pauseExpiresAt ? run.pauseExpiresAt.toISOString() : null,
    startedAt: run.startedAt.toISOString(),
  };
}

export async function questRoutes(fastify: FastifyInstance) {
  fastify.get("/quests", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    return buildQuestList(request.authUser.id);
  });

  fastify.post("/quests/claim", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const body = claimQuestSchema.parse(request.body);
    try {
      const result = await claimQuestReward(request.authUser.id, body.questId);
      return { success: true, reward: result.reward, newBalance: result.newBalance, quest: { id: body.questId, type: "daily", completed: true, claimed: true } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to claim quest";
      return reply.code(message.includes("not") || message.includes("already") ? 400 : 404).send({ error: message });
    }
  });

  fastify.get("/wordle", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const date = getWordleDateKey();
    const attempts = await getWordleAttempts(request.authUser.id, date);
    const guesses = attempts.map((attempt) => ({ guess: attempt.guess, evaluation: JSON.parse(attempt.evaluation) }));
    const solved = attempts.some((attempt) => attempt.solved);
    const gameOver = solved || attempts.length >= WORDLE_MAX_ATTEMPTS;
    const targetWord = gameOver && !solved ? await getDailyFrenchWord(date) : undefined;
    return { date, resetTimezone: "Europe/Paris", guesses, solved, ...(targetWord ? { targetWord } : {}) };
  });

  fastify.post("/wordle", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const body = wordleSubmitSchema.parse(request.body);
    const date = getWordleDateKey();
    if (body.expectedDate && body.expectedDate !== date) {
      return reply.code(409).send({ error: "Wordle has reset for a new day", code: "WORDLE_RESET", date });
    }
    const guess = normalizeFrenchWord(body.guess);
    if (!new RegExp(`^[A-Z]{5}$`).test(guess)) return reply.code(400).send({ error: "Guess must be a valid 5-letter word" });
    if (!(await isValidFrenchWord(guess))) return reply.code(400).send({ error: "Word not found in the Wordle dictionary", code: "WORD_NOT_FOUND" });
    const attempts = await getWordleAttempts(request.authUser.id, date);
    if (attempts.some((attempt) => attempt.solved)) return reply.code(409).send({ error: "Puzzle already solved today", code: "WORDLE_ALREADY_SOLVED" });
    if (attempts.length >= WORDLE_MAX_ATTEMPTS) return reply.code(409).send({ error: "No attempts left today", code: "WORDLE_ATTEMPTS_EXHAUSTED" });
    const target = await getDailyFrenchWord(date);
    const evaluation = evaluateGuess(guess, target);
    const solved = guess === target;
    await db.insert(wordleDailyAttempts).values({ id: randomUUID(), userId: request.authUser.id, date, attempt: attempts.length + 1, guess, evaluation: JSON.stringify(evaluation), solved });
    let questJustCompleted = false;
    if (solved) {
      await materializeDailyQuestsForUser(request.authUser.id, date);
      questJustCompleted = await completeWordleQuest(request.authUser.id, date);
    }
    return { evaluation, solved, date, questJustCompleted };
  });

  fastify.get("/quests/speed-calculus", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const state = await getSpeedCalculusState(request.authUser.id);
    return {
      ...state,
      activeRun: state.activeRun ? serializeActiveRun(state.activeRun) : null,
    };
  });

  fastify.post("/quests/speed-calculus/start", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const date = getWordleDateKey();
    await materializeDailyQuestsForUser(request.authUser.id, date);
    const state = await getSpeedCalculusState(request.authUser.id, date);
    if (state.activeRun) {
      return { ...state, activeRun: serializeActiveRun(state.activeRun) };
    }
    if (state.runsUsed >= SPEED_CALCULUS_MAX_RUNS) {
      return reply.code(400).send({ error: "Daily runs exhausted" });
    }
    const runNumber = state.history.length + 1;
    const seed = `${request.authUser.id}:${date}:${runNumber}`;
    await db.insert(speedCalculusDailyRuns).values({
      id: randomUUID(),
      userId: request.authUser.id,
      date,
      runNumber,
      seed,
      answers: "[]",
      status: "in_progress",
      pauseExpiresAt: new Date(Date.now() + SPEED_CALCULUS_FINISH_GRACE_SECONDS * 1000),
    });
    const nextState = await getSpeedCalculusState(request.authUser.id, date);
    return { ...nextState, activeRun: nextState.activeRun ? serializeActiveRun(nextState.activeRun) : null };
  });

  fastify.post("/quests/speed-calculus/answer", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const body = speedAnswerSchema.parse(request.body);
    const run = await db.query.speedCalculusDailyRuns.findFirst({ where: eq(speedCalculusDailyRuns.id, body.runId) });
    if (!run || run.userId !== request.authUser.id) return reply.code(404).send({ error: "Run not found" });
    if (run.status !== "in_progress") return reply.code(400).send({ error: "Run is not active" });
    const pauseValid = !run.pauseExpiresAt || run.pauseExpiresAt.getTime() >= Date.now();
    if (!pauseValid) return reply.code(400).send({ error: "Run is paused too long" });
    const answers = JSON.parse(run.answers) as number[];
    answers.push(body.answer);
    await db.update(speedCalculusDailyRuns).set({ answers: JSON.stringify(answers) }).where(eq(speedCalculusDailyRuns.id, run.id));
    const refreshed = await db.query.speedCalculusDailyRuns.findFirst({ where: eq(speedCalculusDailyRuns.id, run.id) });
    return { ok: true, activeRun: refreshed ? serializeActiveRun(refreshed) : null };
  });

  fastify.post("/quests/speed-calculus/finish", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const body = speedFinishSchema.parse(request.body);
    const run = await db.query.speedCalculusDailyRuns.findFirst({ where: eq(speedCalculusDailyRuns.id, body.runId) });
    if (!run || run.userId !== request.authUser.id) return reply.code(404).send({ error: "Run not found" });
    const answers = JSON.parse(run.answers) as number[];
    const questions = buildSpeedCalculusQuestions(run.seed);
    let correct = 0;
    answers.forEach((answer, index) => {
      if (questions[index]?.answer === answer) correct += 1;
    });
    const reward = calculateSpeedCalculusReward(correct);
    await db.update(speedCalculusDailyRuns).set({ status: "completed", score: correct, reward, finishedAt: new Date() }).where(eq(speedCalculusDailyRuns.id, run.id));
    await syncSpeedCalculusQuestFromRuns(request.authUser.id, run.date);
    return getSpeedCalculusState(request.authUser.id, run.date).then((state) => ({ ...state, activeRun: state.activeRun ? serializeActiveRun(state.activeRun) : null }));
  });
}
