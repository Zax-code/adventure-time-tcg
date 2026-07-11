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

export const WORDLE_LANGUAGES: WordleLocale[] = ["fr", "en"];
export const DAILY_NUMBERS_MODES: DailyNumbersMode[] = ["1-5", "2-4", "3-3"];

export function isWordleQuest(questType: string) {
  return questType === "wordle_daily_fr" || questType === "wordle_daily_en";
}

export function isSpeedCalculusQuest(questType: string) {
  return questType === "speed_calculus_daily";
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

  const target = Math.max(quest.target, 1);
  const progress = quest.completed ? target : quest.progress;
  return {
    progress,
    target: quest.target,
    percentage: Math.min(100, (progress / target) * 100),
  };
}

function getSingleItemPriority(questType: string) {
  if (isSpeedCalculusQuest(questType)) return 0;
  if (isStepQuest(questType)) return 3;
  if (isDailyLoginQuest(questType)) return 4;
  return 5;
}

function getItemKindPriority(item: QuestHubItem) {
  if (item.kind === "wordle") return 1;
  if (item.kind === "dailyNumbers") return 2;
  return getSingleItemPriority(item.quest.type);
}

function getLifecyclePriority(lifecycle: QuestLifecycle) {
  if (lifecycle === "ready") return 0;
  if (lifecycle === "in_progress") return 1;
  if (lifecycle === "fresh") return 2;
  if (lifecycle === "failed") return 3;
  return 4;
}

export function buildQuestHubItems(quests: Quest[]): QuestHubItem[] {
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

  return items.sort((left, right) => {
    const lifecycleDifference =
      getLifecyclePriority(getQuestHubItemLifecycle(left)) -
      getLifecyclePriority(getQuestHubItemLifecycle(right));
    return (
      lifecycleDifference ||
      getItemKindPriority(left) - getItemKindPriority(right)
    );
  });
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
  const isPlayable = (item: QuestHubItem) =>
    item.kind !== "single" || Boolean(item.quest.actionPath);

  return (
    items.find(
      (item) =>
        getQuestHubItemLifecycle(item) === "in_progress" && isPlayable(item),
    ) ??
    items.find((item) => {
      if (getQuestHubItemLifecycle(item) !== "fresh") return false;
      return isPlayable(item);
    }) ??
    null
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
