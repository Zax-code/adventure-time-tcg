import { createHash, randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";

import { db, dailyQuests, questDefinitions, wordleDailyAttempts, wordleDailyWords, wordleDictionaryWords } from "@adventure-time/db";

import { getResetDateKey } from "./reset-clock";

export type LetterState = "correct" | "present" | "absent";

const TARGET_WORD_LENGTH = 5;
const DAILY_WORD_CACHE = new Map<string, string>();

export function getWordleDateKey(date = new Date()) {
  return getResetDateKey(date);
}

export function normalizeFrenchWord(word: string) {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
}

export async function isValidFrenchWord(guess: string) {
  const normalizedGuess = normalizeFrenchWord(guess);
  if (normalizedGuess.length !== TARGET_WORD_LENGTH) {
    return false;
  }

  const rows = await db.query.wordleDictionaryWords.findMany({
    where: and(eq(wordleDictionaryWords.locale, "fr"), eq(wordleDictionaryWords.word, normalizedGuess)),
  });
  return rows.length > 0;
}

function selectWordForDate(words: string[], dateKey: string) {
  const hash = createHash("sha256").update(dateKey).digest("hex");
  const index = Number.parseInt(hash.slice(0, 8), 16) % words.length;
  return words[index];
}

export async function getDailyFrenchWord(dateKey: string) {
  const cached = DAILY_WORD_CACHE.get(dateKey);
  if (cached) {
    return cached;
  }

  const existing = await db.query.wordleDailyWords.findFirst({ where: eq(wordleDailyWords.date, dateKey) });
  if (existing) {
    DAILY_WORD_CACHE.set(dateKey, existing.word);
    return existing.word;
  }

  const candidates = await db.query.wordleDictionaryWords.findMany({
    where: and(eq(wordleDictionaryWords.locale, "fr"), eq(wordleDictionaryWords.length, TARGET_WORD_LENGTH), eq(wordleDictionaryWords.isSolutionCandidate, true)),
    orderBy: [asc(wordleDictionaryWords.word)],
  });
  if (candidates.length === 0) {
    throw new Error("WORDLE_DICTIONARY_UNAVAILABLE");
  }

  const selectedWord = selectWordForDate(candidates.map((entry) => entry.word), dateKey);
  await db.insert(wordleDailyWords).values({
    id: randomUUID(),
    date: dateKey,
    word: selectedWord,
    source: "wordle_dictionary_words",
  }).onConflictDoNothing();

  DAILY_WORD_CACHE.set(dateKey, selectedWord);
  return selectedWord;
}

export function evaluateGuess(guess: string, target: string): LetterState[] {
  const guessChars = guess.toUpperCase().split("");
  const targetChars = target.toUpperCase().split("");
  const result: LetterState[] = Array(guessChars.length).fill("absent");
  const counts = new Map<string, number>();

  for (const char of targetChars) {
    counts.set(char, (counts.get(char) || 0) + 1);
  }

  for (let index = 0; index < guessChars.length; index += 1) {
    if (guessChars[index] === targetChars[index]) {
      result[index] = "correct";
      counts.set(guessChars[index], (counts.get(guessChars[index]) || 1) - 1);
    }
  }

  for (let index = 0; index < guessChars.length; index += 1) {
    if (result[index] === "correct") {
      continue;
    }
    const char = guessChars[index];
    const remaining = counts.get(char) || 0;
    if (remaining > 0) {
      result[index] = "present";
      counts.set(char, remaining - 1);
    }
  }

  return result;
}

export async function getWordleAttempts(userId: string, dateKey: string) {
  return db.query.wordleDailyAttempts.findMany({
    where: and(eq(wordleDailyAttempts.userId, userId), eq(wordleDailyAttempts.date, dateKey)),
    orderBy: [asc(wordleDailyAttempts.attempt)],
  });
}

export async function completeWordleQuest(userId: string, dateKey: string) {
  const definition = await db.query.questDefinitions.findFirst({ where: eq(questDefinitions.questType, "wordle_daily") });
  const target = definition?.target ?? 1;
  const reward = definition?.reward ?? 120;
  const existing = await db.query.dailyQuests.findFirst({
    where: and(eq(dailyQuests.userId, userId), eq(dailyQuests.date, dateKey), eq(dailyQuests.questType, "wordle_daily")),
  });

  if (!existing) {
    await db.insert(dailyQuests).values({
      id: randomUUID(),
      userId,
      date: dateKey,
      questType: "wordle_daily",
      target,
      reward,
      progress: target,
      completed: true,
      claimed: false,
      completedAt: new Date(),
    });
    return true;
  }

  if (existing.completed) {
    return false;
  }

  await db.update(dailyQuests).set({ progress: target, completed: true, completedAt: new Date(), updatedAt: new Date() }).where(eq(dailyQuests.id, existing.id));
  return true;
}
