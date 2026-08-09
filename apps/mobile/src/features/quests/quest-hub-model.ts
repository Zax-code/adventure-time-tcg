import type {
  DailyNumbersMode,
  QuestsResponse,
  WordleLocale,
} from "@adventure-time/api-client";

export type Quest = QuestsResponse["quests"][number];
export type QuestLifecycle =
  "fresh" | "in_progress" | "ready" | "claimed" | "failed";

export type SingleQuestHubItem = {
  id: string;
  kind: "single";
  quest: Quest;
  quests: Quest[];
};

export type WordleQuestHubItem = {
  id: "wordle";
  kind: "wordle";
  quests: Quest[];
  questsByLanguage: Partial<Record<WordleLocale, Quest>>;
};

export type DailyNumbersQuestHubItem = {
  id: "dailyNumbers";
  kind: "dailyNumbers";
  quests: Quest[];
  questsByMode: Partial<Record<DailyNumbersMode, Quest>>;
};

export type QuestHubItem =
  SingleQuestHubItem | WordleQuestHubItem | DailyNumbersQuestHubItem;

export type QuestHubPreferenceId =
  | "wordle"
  | "dailyNumbers"
  | "perfectTiming"
  | "speedCalculus"
  | "steps";

export const DEFAULT_QUEST_HUB_ORDER: QuestHubPreferenceId[] = [
  "wordle",
  "dailyNumbers",
  "perfectTiming",
  "speedCalculus",
  "steps",
];

export const WORDLE_LANGUAGES: WordleLocale[] = ["fr", "en"];
export const DAILY_NUMBERS_MODES: DailyNumbersMode[] = ["1-5", "2-4", "3-3"];

export function isWordleQuest(questType: string) {
  return questType === "wordle_daily_fr" || questType === "wordle_daily_en";
}

export function isSpeedCalculusQuest(questType: string) {
  return questType === "speed_calculus_daily";
}

export function isPerfectTimingQuest(questType: string) {
  return questType === "perfect_timing_daily";
}

export function isDailyNumbersQuest(questType: string) {
  return questType.startsWith("daily_numbers_");
}

export function isStepQuest(questType: string) {
  return questType === "steps_10k";
}

export function isDailyLoginQuest(questType: string) {
  return questType === "daily_login";
}

export function getWordleLanguageFromQuestType(
  questType: string,
): WordleLocale | null {
  if (questType === "wordle_daily_fr") return "fr";
  if (questType === "wordle_daily_en") return "en";
  return null;
}

export function getDailyNumbersModeFromQuestType(
  questType: string,
): DailyNumbersMode | null {
  if (questType === "daily_numbers_1_5") return "1-5";
  if (questType === "daily_numbers_2_4") return "2-4";
  if (questType === "daily_numbers_3_3") return "3-3";
  return null;
}

export function isQuestInProgress(quest: Quest) {
  if (quest.claimed || quest.completed || quest.failed) return false;

  if (isWordleQuest(quest.type)) {
    return (quest.attemptsUsed ?? 0) > 0;
  }

  if (isSpeedCalculusQuest(quest.type)) {
    return (quest.runsUsed ?? quest.progress) > 0;
  }

  if (isPerfectTimingQuest(quest.type)) {
    return (quest.attemptsUsed ?? quest.progress) > 0;
  }

  return quest.progress > 0;
}

export function getQuestLifecycle(quest: Quest): QuestLifecycle {
  if (quest.claimed) return "claimed";
  if (quest.completed) return "ready";
  if (quest.failed) return "failed";
  if (isQuestInProgress(quest)) return "in_progress";
  return "fresh";
}

export function isQuestFinished(quest: Quest) {
  return quest.claimed || quest.completed || quest.failed;
}

export function isQuestShareable(quest: Quest) {
  if (isWordleQuest(quest.type)) {
    return quest.completed || quest.claimed || quest.failed;
  }

  if (isDailyNumbersQuest(quest.type)) {
    return (
      quest.completed ||
      quest.claimed ||
      quest.failed ||
      quest.score != null ||
      quest.distance != null ||
      quest.finalValue != null
    );
  }

  if (isPerfectTimingQuest(quest.type)) {
    return quest.completed || quest.claimed || quest.failed;
  }

  return false;
}

export function getQuestHubItemLifecycle(item: QuestHubItem): QuestLifecycle {
  const lifecycles = item.quests.map(getQuestLifecycle);

  if (lifecycles.includes("ready")) return "ready";
  if (lifecycles.includes("in_progress")) return "in_progress";
  if (lifecycles.includes("fresh")) return "fresh";
  if (lifecycles.every((lifecycle) => lifecycle === "claimed")) {
    return "claimed";
  }
  return "failed";
}

export function getQuestHubItemStats(item: QuestHubItem) {
  const finishedCount = item.quests.filter(isQuestFinished).length;
  const completedCount = item.quests.filter(
    (quest) => quest.completed || quest.claimed,
  ).length;
  const claimableQuests = item.quests.filter(
    (quest) => quest.completed && !quest.claimed,
  );

  return {
    claimableQuests,
    completedCount,
    finishedCount,
    readyReward: claimableQuests.reduce(
      (total, quest) => total + quest.reward,
      0,
    ),
    shareableCount: item.quests.filter(isQuestShareable).length,
    totalCount: item.quests.length,
    totalReward: item.quests.reduce((total, quest) => total + quest.reward, 0),
  };
}

export function getQuestProgressDisplay(quest: Quest) {
  if (isWordleQuest(quest.type)) {
    const progress = quest.attemptsUsed ?? 0;
    return {
      progress,
      target: 6,
      percentage: Math.min(100, (progress / 6) * 100),
    };
  }

  if (isPerfectTimingQuest(quest.type)) {
    const target = quest.maxAttempts ?? 3;
    const progress = quest.attemptsUsed ?? quest.progress;
    return {
      progress,
      target,
      percentage: Math.min(100, (progress / target) * 100),
    };
  }

  const target = Math.max(quest.target, 1);
  const progress = quest.completed ? target : quest.progress;
  return {
    progress,
    target: quest.target,
    percentage: Math.min(100, (progress / target) * 100),
  };
}

export function normalizeQuestHubOrder(
  value: readonly unknown[] | null | undefined,
): QuestHubPreferenceId[] {
  const validIds = new Set<QuestHubPreferenceId>(DEFAULT_QUEST_HUB_ORDER);
  const normalized = (value ?? []).filter(
    (id, index, order): id is QuestHubPreferenceId =>
      typeof id === "string" &&
      validIds.has(id as QuestHubPreferenceId) &&
      order.indexOf(id) === index,
  );

  return [
    ...normalized,
    ...DEFAULT_QUEST_HUB_ORDER.filter((id) => !normalized.includes(id)),
  ];
}

export function moveQuestHubPreference(
  order: readonly QuestHubPreferenceId[],
  id: QuestHubPreferenceId,
  direction: "up" | "down",
) {
  const normalized = normalizeQuestHubOrder(order);
  const currentIndex = normalized.indexOf(id);
  const nextIndex = currentIndex + (direction === "up" ? -1 : 1);
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= normalized.length) {
    return normalized;
  }

  const reordered = [...normalized];
  [reordered[currentIndex], reordered[nextIndex]] = [
    reordered[nextIndex],
    reordered[currentIndex],
  ];
  return reordered;
}

export function getQuestHubPreferenceId(
  item: QuestHubItem,
): QuestHubPreferenceId | null {
  if (item.kind === "wordle") return "wordle";
  if (item.kind === "dailyNumbers") return "dailyNumbers";
  if (isSpeedCalculusQuest(item.quest.type)) return "speedCalculus";
  if (isPerfectTimingQuest(item.quest.type)) return "perfectTiming";
  if (isStepQuest(item.quest.type)) return "steps";
  return null;
}

export function buildQuestHubItems(
  quests: Quest[],
  preferenceOrder: readonly QuestHubPreferenceId[] = DEFAULT_QUEST_HUB_ORDER,
): QuestHubItem[] {
  const wordleQuests: Partial<Record<WordleLocale, Quest>> = {};
  const dailyNumbersQuests: Partial<Record<DailyNumbersMode, Quest>> = {};
  const singleItems: SingleQuestHubItem[] = [];

  quests.forEach((quest) => {
    const language = getWordleLanguageFromQuestType(quest.type);
    if (language) {
      wordleQuests[language] = quest;
      return;
    }

    const mode = getDailyNumbersModeFromQuestType(quest.type);
    if (mode) {
      dailyNumbersQuests[mode] = quest;
      return;
    }

    singleItems.push({
      id: quest.id,
      kind: "single",
      quest,
      quests: [quest],
    });
  });

  const items: QuestHubItem[] = [...singleItems];
  const orderedWordleQuests = WORDLE_LANGUAGES.flatMap((language) => {
    const quest = wordleQuests[language];
    return quest ? [quest] : [];
  });
  if (orderedWordleQuests.length > 0) {
    items.push({
      id: "wordle",
      kind: "wordle",
      quests: orderedWordleQuests,
      questsByLanguage: wordleQuests,
    });
  }

  const orderedDailyNumbersQuests = DAILY_NUMBERS_MODES.flatMap((mode) => {
    const quest = dailyNumbersQuests[mode];
    return quest ? [quest] : [];
  });
  if (orderedDailyNumbersQuests.length > 0) {
    items.push({
      id: "dailyNumbers",
      kind: "dailyNumbers",
      quests: orderedDailyNumbersQuests,
      questsByMode: dailyNumbersQuests,
    });
  }

  const normalizedOrder = normalizeQuestHubOrder(preferenceOrder);
  return items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((left, right) => {
      const leftId = getQuestHubPreferenceId(left.item);
      const rightId = getQuestHubPreferenceId(right.item);
      const leftIndex = leftId
        ? normalizedOrder.indexOf(leftId)
        : normalizedOrder.length;
      const rightIndex = rightId
        ? normalizedOrder.indexOf(rightId)
        : normalizedOrder.length;
      return leftIndex - rightIndex || left.originalIndex - right.originalIndex;
    })
    .map(({ item }) => item);
}

export function getQuestHubSummary(quests: Quest[]) {
  const claimableQuests = quests.filter(
    (quest) => quest.completed && !quest.claimed,
  );

  return {
    claimableQuests,
    finishedCount: quests.filter(isQuestFinished).length,
    readyReward: claimableQuests.reduce(
      (total, quest) => total + quest.reward,
      0,
    ),
    shareableCount: quests.filter(isQuestShareable).length,
    totalCount: quests.length,
  };
}

export function getNextQuestHubItem(items: QuestHubItem[]) {
  return (
    items.find((item) => {
      const lifecycle = getQuestHubItemLifecycle(item);
      const isAvailable = lifecycle === "in_progress" || lifecycle === "fresh";
      const isActionable =
        item.kind !== "single" ||
        Boolean(item.quest.actionPath) ||
        isStepQuest(item.quest.type);
      return isAvailable && isActionable;
    }) ?? null
  );
}

export async function claimQuestsSequentially(
  quests: Quest[],
  claimQuest: (quest: Quest) => Promise<{ newBalance: number }>,
) {
  let claimedCount = 0;
  let claimedReward = 0;
  let failedCount = 0;
  let newBalance: number | null = null;
  const failures: Array<{ quest: Quest; error: unknown }> = [];

  for (const quest of quests) {
    try {
      const response = await claimQuest(quest);
      claimedCount += 1;
      claimedReward += quest.reward;
      newBalance = response.newBalance;
    } catch (error) {
      failedCount += 1;
      failures.push({ quest, error });
    }
  }

  return {
    claimedCount,
    claimedReward,
    failedCount,
    failures,
    newBalance,
    requestedCount: quests.length,
  };
}
