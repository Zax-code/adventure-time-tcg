import { randomUUID } from "node:crypto";

import { and, desc, eq, or } from "drizzle-orm";

import { db, dailyQuests, questDefinitions, speedCalculusDailyRuns, userStepSnapshots, users, wordleDailyAttempts } from "@adventure-time/db";

import { getResetDateKey } from "../lib/reset-clock";
import { SPEED_CALCULUS_MAX_RUNS, SPEED_CALCULUS_QUEST_TYPE, calculateSpeedCalculusReward } from "../lib/speed-calculus";

const DEFAULT_DEFINITIONS = [
  { questType: "steps_10k", titleKey: "steps_10k", descriptionKey: "steps_10k_desc", icon: "walking", target: 10000, reward: 150, requiresFitbit: false },
  { questType: "wordle_daily", titleKey: "wordle_daily", descriptionKey: "wordle_daily_desc", icon: "wordle", target: 1, reward: 120, requiresFitbit: false },
  { questType: SPEED_CALCULUS_QUEST_TYPE, titleKey: SPEED_CALCULUS_QUEST_TYPE, descriptionKey: "speed_calculus_daily_desc", icon: "sparkles", target: 3, reward: 0, requiresFitbit: false },
] as const;

export async function ensureQuestDefinitions() {
  for (const definition of DEFAULT_DEFINITIONS) {
    const existing = await db.query.questDefinitions.findFirst({ where: eq(questDefinitions.questType, definition.questType) });
    if (existing) {
      await db.update(questDefinitions).set({
        titleKey: definition.titleKey,
        descriptionKey: definition.descriptionKey,
        icon: definition.icon,
        target: definition.target,
        reward: definition.reward,
        requiresFitbit: definition.requiresFitbit,
        isActive: true,
      }).where(eq(questDefinitions.id, existing.id));
      continue;
    }
    await db.insert(questDefinitions).values({ id: randomUUID(), ...definition, isActive: true });
  }
}

export async function materializeDailyQuestsForUser(userId: string, date = getResetDateKey(new Date())) {
  await ensureQuestDefinitions();
  const definitions = await db.query.questDefinitions.findMany({ orderBy: [questDefinitions.createdAt] as any });
  for (const definition of definitions.filter((entry) => entry.isActive)) {
    const existing = await db.query.dailyQuests.findFirst({
      where: and(eq(dailyQuests.userId, userId), eq(dailyQuests.date, date), eq(dailyQuests.questType, definition.questType)),
    });
    if (existing) {
      const nextReward = definition.questType === SPEED_CALCULUS_QUEST_TYPE ? existing.reward : definition.reward;
      await db.update(dailyQuests).set({ target: definition.target, reward: nextReward, updatedAt: new Date() }).where(eq(dailyQuests.id, existing.id));
      continue;
    }
    await db.insert(dailyQuests).values({
      id: randomUUID(),
      userId,
      date,
      questType: definition.questType,
      target: definition.target,
      reward: definition.reward,
      progress: 0,
      completed: false,
      claimed: false,
    });
  }
}

export async function syncStepsQuest(userId: string, date = getResetDateKey(new Date())) {
  const latest = await db.query.userStepSnapshots.findFirst({
    where: eq(userStepSnapshots.userId, userId),
    orderBy: [desc(userStepSnapshots.recordedFor), desc(userStepSnapshots.updatedAt)],
  });
  const quest = await db.query.dailyQuests.findFirst({
    where: and(eq(dailyQuests.userId, userId), eq(dailyQuests.date, date), eq(dailyQuests.questType, "steps_10k")),
  });
  if (!quest) return;
  const progress = latest?.recordedFor === date ? latest.stepCount : 0;
  const completed = progress >= quest.target;
  await db.update(dailyQuests).set({
    progress,
    completed: quest.completed || completed,
    completedAt: quest.completedAt ?? (completed ? new Date() : null),
    updatedAt: new Date(),
  }).where(eq(dailyQuests.id, quest.id));
}

export async function getSpeedCalculusState(userId: string, date = getResetDateKey(new Date())) {
  const runs = await db.query.speedCalculusDailyRuns.findMany({
    where: and(eq(speedCalculusDailyRuns.userId, userId), eq(speedCalculusDailyRuns.date, date)),
    orderBy: [speedCalculusDailyRuns.runNumber] as any,
  });
  const settledRuns = runs.filter((run) => run.status !== "in_progress");
  const latestSettled = settledRuns.at(-1);
  const activeRun = runs.find((run) => run.status === "in_progress") ?? null;
  return {
    date,
    runsUsed: settledRuns.length,
    maxRuns: SPEED_CALCULUS_MAX_RUNS,
    latestScore: latestSettled?.score ?? 0,
    rewardPreview: latestSettled?.reward ?? 0,
    locked: settledRuns.length >= SPEED_CALCULUS_MAX_RUNS,
    activeRun,
    history: runs.map((run) => ({ runId: run.id, runNumber: run.runNumber, status: run.status, score: run.score, reward: run.reward })),
  };
}

export async function claimQuestReward(userId: string, questId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const quest = await db.query.dailyQuests.findFirst({ where: eq(dailyQuests.id, questId) });
  if (!user) throw new Error("User not found");
  if (!quest) throw new Error("Quest not found");
  if (quest.userId !== userId) throw new Error("Not your quest");
  if (!quest.completed) throw new Error("Quest not completed yet");
  if (quest.claimed) throw new Error("Quest already claimed");

  await db.transaction(async (tx) => {
    await tx.update(dailyQuests).set({ claimed: true, claimedAt: new Date(), updatedAt: new Date() }).where(eq(dailyQuests.id, quest.id));
    await tx.update(users).set({ coins: user.coins + quest.reward, updatedAt: new Date() }).where(eq(users.id, user.id));
  });

  return { reward: quest.reward, newBalance: user.coins + quest.reward };
}

export async function buildQuestList(userId: string, date = getResetDateKey(new Date())) {
  await materializeDailyQuestsForUser(userId, date);
  await syncStepsQuest(userId, date);
  const definitions = await db.query.questDefinitions.findMany({ orderBy: [questDefinitions.createdAt] as any });
  const quests = await db.query.dailyQuests.findMany({
    where: and(eq(dailyQuests.userId, userId), eq(dailyQuests.date, date)),
  });
  const attemptsUsed = await db.query.wordleDailyAttempts.findMany({ where: and(eq(wordleDailyAttempts.userId, userId), eq(wordleDailyAttempts.date, date)) });
  const speedState = await getSpeedCalculusState(userId, date);
  const fitbitConnected = false;

  quests.sort((a, b) => definitions.findIndex((d) => d.questType === a.questType) - definitions.findIndex((d) => d.questType === b.questType));
  return {
    quests: quests.map((quest) => {
      const def = definitions.find((entry) => entry.questType === quest.questType);
      const base = {
        id: quest.id,
        type: quest.questType,
        title: def?.titleKey ?? quest.questType,
        description: def?.descriptionKey ?? `${quest.questType}_desc`,
        target: quest.questType === SPEED_CALCULUS_QUEST_TYPE ? speedState.maxRuns : quest.target,
        progress: quest.questType === SPEED_CALCULUS_QUEST_TYPE ? speedState.runsUsed : quest.progress,
        completed: quest.completed,
        claimed: quest.claimed,
        reward: quest.questType === SPEED_CALCULUS_QUEST_TYPE ? speedState.rewardPreview : quest.reward,
        icon: def?.icon ?? "star",
        actionPath: quest.questType === "wordle_daily" ? "/quests/wordle" : quest.questType === SPEED_CALCULUS_QUEST_TYPE ? "/quests/speed-calculus" : null,
        failed: quest.questType === "wordle_daily" ? !quest.completed && attemptsUsed.length >= 6 : false,
      } as any;
      if (quest.questType === "wordle_daily" && attemptsUsed.length > 0) base.attemptsUsed = attemptsUsed.length;
      if (quest.questType === SPEED_CALCULUS_QUEST_TYPE) {
        base.runsUsed = speedState.runsUsed;
        base.maxRuns = speedState.maxRuns;
        base.latestScore = speedState.latestScore;
        base.rewardPreview = speedState.rewardPreview;
        base.locked = speedState.locked;
      }
      return base;
    }),
    fitbitConnected,
  };
}

export async function syncSpeedCalculusQuestFromRuns(userId: string, date = getResetDateKey(new Date())) {
  const state = await getSpeedCalculusState(userId, date);
  const quest = await db.query.dailyQuests.findFirst({ where: and(eq(dailyQuests.userId, userId), eq(dailyQuests.date, date), eq(dailyQuests.questType, SPEED_CALCULUS_QUEST_TYPE)) });
  if (!quest) return state;
  const completed = state.runsUsed >= SPEED_CALCULUS_MAX_RUNS || state.locked;
  await db.update(dailyQuests).set({
    progress: state.runsUsed,
    target: SPEED_CALCULUS_MAX_RUNS,
    reward: state.rewardPreview,
    completed,
    completedAt: completed ? (quest.completedAt ?? new Date()) : null,
    updatedAt: new Date(),
  }).where(eq(dailyQuests.id, quest.id));
  return state;
}
