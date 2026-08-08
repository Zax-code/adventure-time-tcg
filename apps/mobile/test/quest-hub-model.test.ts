import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildQuestHubItems,
  claimQuestsSequentially,
  DEFAULT_QUEST_HUB_ORDER,
  getNextQuestHubItem,
  getQuestHubItemLifecycle,
  getQuestHubItemStats,
  getQuestHubSummary,
  getQuestProgressDisplay,
  getQuestLifecycle,
  isQuestShareable,
  moveQuestHubPreference,
  normalizeQuestHubOrder,
  type Quest,
} from "../src/features/quests/quest-hub-model.ts";

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: "quest-1",
    version: "quest-1",
    type: "steps_10k",
    title: "steps_10k",
    description: "steps_10k_desc",
    target: 10_000,
    progress: 0,
    completed: false,
    claimed: false,
    reward: 75,
    icon: "walking",
    actionPath: null,
    failed: false,
    ...overrides,
  };
}

describe("quest hub presentation model", () => {
  it("groups the canonical eight-quest payload into five ordered hub entries", () => {
    const items = buildQuestHubItems([
      makeQuest({
        id: "steps",
        type: "steps_10k",
      }),
      makeQuest({
        id: "speed",
        type: "speed_calculus_daily",
        actionPath: "/quests/speed-calculus",
        reward: 0,
        target: 3,
      }),
      makeQuest({
        id: "perfect-timing",
        type: "perfect_timing_daily",
        actionPath: "/quests/perfect-timing",
        reward: 0,
        target: 6_500,
        maxAttempts: 3,
      }),
      makeQuest({
        id: "wordle-en",
        type: "wordle_daily_en",
        actionPath: "/quests/wordle?language=en",
        reward: 35,
        target: 1,
      }),
      makeQuest({
        id: "wordle-fr",
        type: "wordle_daily_fr",
        actionPath: "/quests/wordle?language=fr",
        reward: 35,
        target: 1,
      }),
      makeQuest({
        id: "numbers-1-5",
        type: "daily_numbers_1_5",
        actionPath: "/quests/daily-numbers?mode=1-5",
        reward: 45,
        target: 1,
      }),
      makeQuest({
        id: "numbers-2-4",
        type: "daily_numbers_2_4",
        actionPath: "/quests/daily-numbers?mode=2-4",
        reward: 60,
        target: 1,
      }),
      makeQuest({
        id: "numbers-3-3",
        type: "daily_numbers_3_3",
        actionPath: "/quests/daily-numbers?mode=3-3",
        reward: 75,
        target: 1,
      }),
    ]);

    assert.deepEqual(
      items.map((item) => item.id),
      ["wordle", "dailyNumbers", "perfect-timing", "speed", "steps"],
    );

    const wordle = items.find((item) => item.kind === "wordle");
    assert.ok(wordle);
    assert.deepEqual(
      wordle.quests.map((quest) => quest.type),
      ["wordle_daily_fr", "wordle_daily_en"],
    );

    const dailyNumbers = items.find((item) => item.kind === "dailyNumbers");
    assert.ok(dailyNumbers);
    assert.deepEqual(
      dailyNumbers.quests.map((quest) => quest.type),
      ["daily_numbers_1_5", "daily_numbers_2_4", "daily_numbers_3_3"],
    );
  });

  it("uses backend completion for a non-exact Daily Numbers reward", () => {
    const quest = makeQuest({
      type: "daily_numbers_1_5",
      completed: true,
      score: 64,
      distance: 7,
      finalValue: 421,
    });

    assert.equal(getQuestLifecycle(quest), "ready");
    assert.equal(isQuestShareable(quest), true);
  });

  it("keeps a zero-score submitted Daily Numbers result finished without reward", () => {
    const quest = makeQuest({
      type: "daily_numbers_1_5",
      failed: true,
      score: 0,
      distance: 100,
      finalValue: 321,
    });

    assert.equal(getQuestLifecycle(quest), "failed");
    assert.equal(isQuestShareable(quest), true);
  });

  it("does not make one finished variant hide a fresh family variant", () => {
    const items = buildQuestHubItems([
      makeQuest({
        id: "fr",
        type: "wordle_daily_fr",
        claimed: true,
      }),
      makeQuest({
        id: "en",
        type: "wordle_daily_en",
        progress: 0,
      }),
    ]);
    const wordle = items.find((item) => item.kind === "wordle");

    assert.ok(wordle);
    assert.equal(getQuestHubItemLifecycle(wordle), "fresh");
    assert.deepEqual(getQuestHubItemStats(wordle), {
      claimableQuests: [],
      completedCount: 1,
      finishedCount: 1,
      readyReward: 0,
      shareableCount: 1,
      totalCount: 2,
      totalReward: 150,
    });
  });

  it("moves a mixed ready and fresh family back to fresh after its reward is claimed", async () => {
    const readyQuest = makeQuest({
      id: "en",
      type: "wordle_daily_en",
      completed: true,
      reward: 60,
    });
    const freshQuest = makeQuest({
      id: "fr",
      type: "wordle_daily_fr",
      reward: 75,
    });
    const before = buildQuestHubItems([readyQuest, freshQuest])[0];

    assert.ok(before);
    assert.equal(before.kind, "wordle");
    assert.equal(getQuestHubItemLifecycle(before), "ready");
    assert.equal(getQuestHubItemStats(before).readyReward, 60);

    const claimResult = await claimQuestsSequentially(
      [readyQuest],
      async () => ({ newBalance: 160 }),
    );
    assert.equal(claimResult.claimedCount, 1);
    assert.equal(claimResult.failedCount, 0);

    const after = buildQuestHubItems([
      { ...readyQuest, claimed: true },
      freshQuest,
    ])[0];
    assert.ok(after);
    assert.equal(after.kind, "wordle");
    assert.equal(getQuestHubItemLifecycle(after), "fresh");
    assert.equal(getQuestHubItemStats(after).readyReward, 0);
  });

  it("represents zero, partial, and complete step progress", () => {
    const zero = makeQuest({ id: "zero", progress: 0 });
    const partial = makeQuest({ id: "partial", progress: 4_250 });
    const complete = makeQuest({
      id: "complete",
      progress: 9_800,
      completed: true,
    });

    assert.deepEqual(getQuestProgressDisplay(zero), {
      percentage: 0,
      progress: 0,
      target: 10_000,
    });
    assert.deepEqual(getQuestProgressDisplay(partial), {
      percentage: 42.5,
      progress: 4_250,
      target: 10_000,
    });
    assert.deepEqual(getQuestProgressDisplay(complete), {
      percentage: 100,
      progress: 10_000,
      target: 10_000,
    });
    assert.equal(getQuestLifecycle(zero), "fresh");
    assert.equal(getQuestLifecycle(partial), "in_progress");
    assert.equal(getQuestLifecycle(complete), "ready");
  });

  it("keeps two in-progress Wordle variants together and resumes the family", () => {
    const items = buildQuestHubItems([
      makeQuest({
        id: "fr",
        type: "wordle_daily_fr",
        attemptsUsed: 2,
      }),
      makeQuest({
        id: "en",
        type: "wordle_daily_en",
        attemptsUsed: 4,
      }),
    ]);

    assert.equal(items.length, 1);
    const wordle = items[0];
    assert.ok(wordle);
    assert.equal(wordle.kind, "wordle");
    assert.equal(getQuestHubItemLifecycle(wordle), "in_progress");
    assert.deepEqual(
      wordle.quests.map((quest) => quest.attemptsUsed),
      [2, 4],
    );
    assert.equal(getNextQuestHubItem(items), wordle);
  });

  it("keeps the preferred order across different quest lifecycles", () => {
    const items = buildQuestHubItems([
      makeQuest({ id: "steps", claimed: true }),
      makeQuest({
        id: "speed",
        type: "speed_calculus_daily",
        actionPath: "/quests/speed-calculus",
        progress: 1,
        runsUsed: 1,
        maxRuns: 3,
      }),
      makeQuest({
        id: "fr",
        type: "wordle_daily_fr",
        actionPath: "/quests/wordle?language=fr",
      }),
      makeQuest({
        id: "numbers",
        type: "daily_numbers_1_5",
        actionPath: "/quests/daily-numbers?mode=1-5",
        completed: true,
      }),
    ]);

    assert.deepEqual(
      items.map((item) => item.id),
      ["wordle", "dailyNumbers", "speed", "steps"],
    );
    assert.deepEqual(
      items.map((item) => getQuestHubItemLifecycle(item)),
      ["fresh", "ready", "in_progress", "claimed"],
    );
  });

  it("uses a custom order for both the cards and the next hub action", () => {
    const items = buildQuestHubItems(
      [
        makeQuest({ id: "steps", progress: 2_000 }),
        makeQuest({
          id: "speed",
          type: "speed_calculus_daily",
          actionPath: "/quests/speed-calculus",
          progress: 1,
          runsUsed: 1,
          maxRuns: 3,
        }),
        makeQuest({
          id: "wordle-fr",
          type: "wordle_daily_fr",
          actionPath: "/quests/wordle?language=fr",
        }),
      ],
      ["steps", "speedCalculus", "wordle", "dailyNumbers"],
    );

    assert.deepEqual(
      items.map((item) => item.id),
      ["steps", "speed", "wordle"],
    );
    assert.equal(getNextQuestHubItem(items)?.id, "steps");
  });

  it("normalizes persisted orders and supports bounded moves", () => {
    assert.deepEqual(normalizeQuestHubOrder(["steps", "wordle", "steps"]), [
      "steps",
      "wordle",
      "dailyNumbers",
      "perfectTiming",
      "speedCalculus",
    ]);
    assert.deepEqual(
      normalizeQuestHubOrder(["unknown"]),
      DEFAULT_QUEST_HUB_ORDER,
    );
    assert.deepEqual(
      moveQuestHubPreference(DEFAULT_QUEST_HUB_ORDER, "steps", "up"),
      ["wordle", "dailyNumbers", "perfectTiming", "steps", "speedCalculus"],
    );
    assert.deepEqual(
      moveQuestHubPreference(DEFAULT_QUEST_HUB_ORDER, "wordle", "up"),
      DEFAULT_QUEST_HUB_ORDER,
    );
  });

  it("chooses in-progress playable work instead of a passive step quest", () => {
    const items = buildQuestHubItems([
      makeQuest({ id: "steps", progress: 3_000 }),
      makeQuest({
        id: "speed",
        type: "speed_calculus_daily",
        actionPath: "/quests/speed-calculus",
        progress: 1,
        runsUsed: 1,
        maxRuns: 3,
      }),
    ]);

    const next = getNextQuestHubItem(items);
    assert.ok(next);
    assert.equal(next.kind, "single");
    assert.equal(next.quest.type, "speed_calculus_daily");
  });

  it("falls through from passive step progress to a fresh playable family", () => {
    const items = buildQuestHubItems([
      makeQuest({ id: "steps", progress: 3_000 }),
      makeQuest({
        id: "fr",
        type: "wordle_daily_fr",
        actionPath: "/quests/wordle?language=fr",
      }),
    ]);

    const next = getNextQuestHubItem(items);
    assert.ok(next);
    assert.equal(next.kind, "wordle");
  });

  it("summarizes independently claimable rewards without changing quest rules", () => {
    const summary = getQuestHubSummary([
      makeQuest({ id: "ready-1", completed: true, reward: 35 }),
      makeQuest({ id: "ready-2", completed: true, reward: 60 }),
      makeQuest({ id: "claimed", claimed: true, reward: 75 }),
      makeQuest({ id: "failed", failed: true, reward: 45 }),
    ]);

    assert.equal(summary.finishedCount, 4);
    assert.equal(summary.readyReward, 95);
    assert.equal(summary.claimableQuests.length, 2);
    assert.equal(summary.totalCount, 4);
  });

  it("gates Wordle sharing until a terminal result exists", () => {
    assert.equal(
      isQuestShareable(makeQuest({ type: "wordle_daily_en", attemptsUsed: 3 })),
      false,
    );
    assert.equal(
      isQuestShareable(
        makeQuest({
          type: "wordle_daily_en",
          attemptsUsed: 6,
          failed: true,
        }),
      ),
      true,
    );
  });

  it("claims rewards sequentially and reports partial failures", async () => {
    const quests = [
      makeQuest({ id: "one", reward: 35 }),
      makeQuest({ id: "two", reward: 60 }),
      makeQuest({ id: "three", reward: 75 }),
    ];
    let activeClaims = 0;
    let maximumActiveClaims = 0;

    const staleClaimError = new Error("stale claim");
    const result = await claimQuestsSequentially(quests, async (quest) => {
      activeClaims += 1;
      maximumActiveClaims = Math.max(maximumActiveClaims, activeClaims);
      await Promise.resolve();
      activeClaims -= 1;

      if (quest.id === "two") {
        throw staleClaimError;
      }

      return { newBalance: quest.id === "one" ? 135 : 210 };
    });

    assert.equal(maximumActiveClaims, 1);
    assert.deepEqual(result, {
      claimedCount: 2,
      claimedReward: 110,
      failedCount: 1,
      failures: [{ quest: quests[1], error: staleClaimError }],
      newBalance: 210,
      requestedCount: 3,
    });
  });

  it("reports every failed claim and handles an empty claim request", async () => {
    const quests = [
      makeQuest({ id: "one", completed: true }),
      makeQuest({ id: "two", completed: true }),
    ];
    const errors = [new Error("already claimed"), new Error("offline")];
    let attempt = 0;

    const failed = await claimQuestsSequentially(quests, async () => {
      throw errors[attempt++];
    });

    assert.deepEqual(failed, {
      claimedCount: 0,
      claimedReward: 0,
      failedCount: 2,
      failures: [
        { quest: quests[0], error: errors[0] },
        { quest: quests[1], error: errors[1] },
      ],
      newBalance: null,
      requestedCount: 2,
    });

    const empty = await claimQuestsSequentially([], async () => {
      throw new Error("claim callback must not run");
    });
    assert.deepEqual(empty, {
      claimedCount: 0,
      claimedReward: 0,
      failedCount: 0,
      failures: [],
      newBalance: null,
      requestedCount: 0,
    });
  });

  it("keeps an all-failed family terminal and shareable", () => {
    const items = buildQuestHubItems([
      makeQuest({
        id: "fr",
        type: "wordle_daily_fr",
        attemptsUsed: 6,
        failed: true,
      }),
      makeQuest({
        id: "en",
        type: "wordle_daily_en",
        attemptsUsed: 6,
        failed: true,
      }),
    ]);

    assert.equal(items.length, 1);
    assert.equal(getQuestHubItemLifecycle(items[0]), "failed");
    assert.equal(getQuestHubItemStats(items[0]).shareableCount, 2);
  });
});
