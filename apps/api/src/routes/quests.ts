import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";

import { dailyQuests, db, speedCalculusDailyRuns, users, wordleDailyAttempts } from "@adventure-time/db";
import { claimQuestSchema, speedAnswerSchema, speedFinishSchema, wordleSubmitSchema } from "@adventure-time/shared";

import { buildQuestList, cashoutSpeedCalculus, claimQuestReward, getSpeedCalculusState, materializeDailyQuestsForUser, resumeSpeedCalculusRun, syncSpeedCalculusQuestFromRuns } from "../services/quest-service";
import { SPEED_CALCULUS_RESUME_PAUSE_SECONDS, calculateSpeedCalculusReward, evaluateSpeedCalculusAnswers } from "../lib/speed-calculus";
import { completeWordleQuest, evaluateGuess, getDailyFrenchWord, getWordleAttempts, getWordleDateKey, isValidFrenchWord, normalizeFrenchWord } from "../lib/wordle";

const WORDLE_MAX_ATTEMPTS = 6;

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
    const questRow = await db.query.dailyQuests.findFirst({
      where: and(eq(dailyQuests.userId, request.authUser.id), eq(dailyQuests.date, date), eq(dailyQuests.questType, "wordle_daily")),
    });
    let resetByName: string | null = null;
    if (questRow?.resetByUserId) {
      const adminUser = await db.query.users.findFirst({ where: eq(users.id, questRow.resetByUserId) });
      resetByName = adminUser?.displayName ?? null;
    }
    return { date, resetTimezone: "Europe/Paris", guesses, solved, questVersion: questRow?.id ?? null, resetByName, ...(targetWord ? { targetWord } : {}) };
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

  // ── Speed Calculus ──────────────────────────────────────────────────

  fastify.get("/quests/speed-calculus", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    return getSpeedCalculusState(request.authUser.id);
  });

  fastify.post("/quests/speed-calculus/start", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const date = getWordleDateKey();
    const state = await getSpeedCalculusState(request.authUser.id, date);
    if (state.activeRun) return state;
    if (!state.canStartRun) {
      return reply.code(400).send({ error: "Cannot start a new run" });
    }
    const runNumber = state.runsUsed + 1;
    const seed = randomUUID();
    await db.insert(speedCalculusDailyRuns).values({
      id: randomUUID(),
      userId: request.authUser.id,
      date,
      runNumber,
      seed,
      answers: "[]",
      status: "in_progress",
      pauseExpiresAt: new Date(Date.now() + SPEED_CALCULUS_RESUME_PAUSE_SECONDS * 1000),
    });
    return getSpeedCalculusState(request.authUser.id, date);
  });

  fastify.post("/quests/speed-calculus/answer", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const body = speedAnswerSchema.parse(request.body);
    const run = await db.query.speedCalculusDailyRuns.findFirst({ where: eq(speedCalculusDailyRuns.id, body.runId) });
    if (!run || run.userId !== request.authUser.id) return reply.code(404).send({ error: "Run not found" });
    if (run.status !== "in_progress") return reply.code(400).send({ error: "Run is not active" });
    if (run.pauseExpiresAt && run.pauseExpiresAt.getTime() > Date.now()) {
      return reply.code(400).send({ error: "Run is paused" });
    }
    const answers = JSON.parse(run.answers) as number[];
    answers.push(body.answer);
    await db.update(speedCalculusDailyRuns).set({ answers: JSON.stringify(answers) }).where(eq(speedCalculusDailyRuns.id, run.id));
    return getSpeedCalculusState(request.authUser.id, run.date);
  });

  fastify.post("/quests/speed-calculus/resume", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    return resumeSpeedCalculusRun(request.authUser.id);
  });

  fastify.post("/quests/speed-calculus/finish", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    const body = speedFinishSchema.parse(request.body);
    const run = await db.query.speedCalculusDailyRuns.findFirst({ where: eq(speedCalculusDailyRuns.id, body.runId) });
    if (!run || run.userId !== request.authUser.id) return reply.code(404).send({ error: "Run not found" });
    if (run.status !== "in_progress") return reply.code(400).send({ error: "Run is not active" });
    const { correctAnswers } = evaluateSpeedCalculusAnswers(run.seed, run.answers);
    const reward = calculateSpeedCalculusReward(correctAnswers);
    await db.update(speedCalculusDailyRuns).set({
      status: "completed",
      score: correctAnswers,
      reward,
      finishedAt: new Date(),
    }).where(eq(speedCalculusDailyRuns.id, run.id));
    await syncSpeedCalculusQuestFromRuns(request.authUser.id, run.date);
    const state = await getSpeedCalculusState(request.authUser.id, run.date);
    return { ...state, correctAnswers, reward, locked: state.locked };
  });

  fastify.post("/quests/speed-calculus/cashout", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Unauthorized" });
    try {
      return await cashoutSpeedCalculus(request.authUser.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to cash out";
      return reply.code(400).send({ error: message });
    }
  });
}
