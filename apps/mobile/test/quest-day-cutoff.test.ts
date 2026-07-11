import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getNextQuestDayBoundaryMs,
  isCurrentQuestDay,
  isQuestExperiencePath,
  QuestDayCutoffController,
  type QuestDayCutoffEvent,
} from "../src/features/quests/quest-day-cutoff.ts";

type ScheduledTimer = {
  callback: () => void;
  delayMs: number;
};

function createHarness({
  now,
  pathname,
  timeZone = "America/New_York",
}: {
  now: number;
  pathname: string;
  timeZone?: string;
}) {
  let currentNow = now;
  let currentPathname = pathname;
  let currentArchiveDate: string | null = null;
  let scheduledTimer: ScheduledTimer | null = null;
  const changedEvents: QuestDayCutoffEvent[] = [];
  const modalEvents: QuestDayCutoffEvent[] = [];

  const controller = new QuestDayCutoffController({
    timeZone,
    getNow: () => currentNow,
    getRouteContext: () => ({
      pathname: currentPathname,
      archiveDate: currentArchiveDate,
    }),
    onDayChanged: (event) => changedEvents.push(event),
    onQuestCutoff: (event) => modalEvents.push(event),
    schedule: (callback, delayMs) => {
      scheduledTimer = { callback, delayMs };
      return 1 as never;
    },
    cancel: () => {
      scheduledTimer = null;
    },
  });

  return {
    changedEvents,
    controller,
    modalEvents,
    getScheduledTimer: () => scheduledTimer,
    setNow: (nextNow: number) => {
      currentNow = nextNow;
    },
    setPathname: (nextPathname: string) => {
      currentPathname = nextPathname;
    },
    setArchiveDate: (nextArchiveDate: string | null) => {
      currentArchiveDate = nextArchiveDate;
    },
  };
}

describe("quest day cutoff", () => {
  it("fires at local midnight while an active quest is open", () => {
    const harness = createHarness({
      now: Date.parse("2026-07-11T03:59:59.500Z"),
      pathname: "/quests/wordle",
    });

    harness.controller.start();
    const timer = harness.getScheduledTimer();

    assert.ok(timer);
    assert.ok(timer.delayMs >= 500 && timer.delayMs <= 1_000);

    harness.setNow(Date.parse("2026-07-11T04:00:00.100Z"));
    timer.callback();

    assert.deepEqual(harness.changedEvents, [
      {
        previousDayKey: "2026-07-10",
        currentDayKey: "2026-07-11",
      },
    ]);
    assert.deepEqual(harness.modalEvents, harness.changedEvents);
  });

  it("detects a missed midnight as soon as the app becomes active", () => {
    const harness = createHarness({
      now: Date.parse("2026-07-11T03:55:00.000Z"),
      pathname: "/quests/speed-calculus",
    });

    harness.controller.start();
    harness.setNow(Date.parse("2026-07-11T04:05:00.000Z"));
    harness.controller.checkNow();

    assert.equal(harness.changedEvents.length, 1);
    assert.equal(harness.modalEvents.length, 1);

    harness.controller.checkNow();
    assert.equal(harness.changedEvents.length, 1);
    assert.equal(harness.modalEvents.length, 1);
  });

  it("refreshes the day without showing the cutoff modal outside quests", () => {
    const harness = createHarness({
      now: Date.parse("2026-07-11T03:59:00.000Z"),
      pathname: "/collection",
    });

    harness.controller.start();
    harness.setNow(Date.parse("2026-07-11T04:01:00.000Z"));
    harness.controller.checkNow();

    assert.equal(harness.changedEvents.length, 1);
    assert.equal(harness.modalEvents.length, 0);
  });

  it("scopes the modal to the quest tab and quest routes", () => {
    assert.equal(isQuestExperiencePath({ pathname: "/quests" }), true);
    assert.equal(isQuestExperiencePath({ pathname: "/(tabs)/quests" }), true);
    assert.equal(
      isQuestExperiencePath({ pathname: "/quests/wordle" }),
      true,
    );
    assert.equal(
      isQuestExperiencePath({ pathname: "/quests/speed-calculus" }),
      true,
    );
    assert.equal(
      isQuestExperiencePath({ pathname: "/quests/daily-numbers-play" }),
      true,
    );
    assert.equal(
      isQuestExperiencePath({
        pathname: "/quests/daily-numbers-play",
        archiveDate: "2026-07-01",
      }),
      false,
    );
    assert.equal(
      isQuestExperiencePath({
        pathname: "/quests/daily-numbers-play",
        archiveDate: "not-a-date",
      }),
      true,
    );
    assert.equal(
      isQuestExperiencePath({
        pathname: "/quests/speed-calculus/training",
      }),
      false,
    );
    assert.equal(
      isQuestExperiencePath({ pathname: "/quests/daily-numbers-history" }),
      false,
    );
    assert.equal(isQuestExperiencePath({ pathname: "/" }), false);
    assert.equal(isQuestExperiencePath({ pathname: "/collection" }), false);
    assert.equal(isQuestExperiencePath({ pathname: "/widget-quests" }), false);
  });

  it("uses the route that is active when midnight arrives", () => {
    const harness = createHarness({
      now: Date.parse("2026-07-11T03:59:00.000Z"),
      pathname: "/collection",
    });

    harness.controller.start();
    harness.setPathname("/quests/wordle");
    harness.setNow(Date.parse("2026-07-11T04:01:00.000Z"));
    harness.controller.checkNow();

    assert.equal(harness.modalEvents.length, 1);
  });

  it("does not show the modal when the user leaves quests before midnight", () => {
    const harness = createHarness({
      now: Date.parse("2026-07-11T03:59:00.000Z"),
      pathname: "/quests/wordle",
    });

    harness.controller.start();
    harness.setPathname("/collection");
    harness.setNow(Date.parse("2026-07-11T04:01:00.000Z"));
    harness.controller.checkNow();

    assert.equal(harness.changedEvents.length, 1);
    assert.equal(harness.modalEvents.length, 0);
  });

  it("uses the configured reset timezone instead of the device timezone", () => {
    const harness = createHarness({
      now: Date.parse("2026-07-10T21:59:59.500Z"),
      pathname: "/quests",
      timeZone: "Europe/Paris",
    });

    harness.controller.start();
    const timer = harness.getScheduledTimer();

    assert.ok(timer);
    assert.ok(timer.delayMs >= 500 && timer.delayMs <= 1_000);

    harness.setNow(Date.parse("2026-07-10T22:00:00.100Z"));
    timer.callback();

    assert.deepEqual(harness.modalEvents, [
      {
        previousDayKey: "2026-07-10",
        currentDayKey: "2026-07-11",
      },
    ]);
  });

  it("finds the next midnight across a 25-hour daylight-saving day", () => {
    const now = Date.parse("2026-11-01T04:30:00.000Z");

    assert.equal(
      getNextQuestDayBoundaryMs(now, "America/New_York"),
      Date.parse("2026-11-02T05:00:00.000Z"),
    );
  });

  it("falls back safely when a device cannot resolve the stored timezone", () => {
    const now = Date.parse("2026-07-10T22:00:00.000Z");

    assert.equal(isCurrentQuestDay("2026-07-11", "Not/AZone", now), true);
    assert.equal(
      getNextQuestDayBoundaryMs(now, "Not/AZone"),
      Date.parse("2026-07-11T22:00:00.000Z"),
    );
  });

  it("rejects a late response from the quest day that just ended", () => {
    const afterMidnight = Date.parse("2026-07-11T04:00:00.100Z");

    assert.equal(
      isCurrentQuestDay(
        "2026-07-10",
        "America/New_York",
        afterMidnight,
      ),
      false,
    );
    assert.equal(
      isCurrentQuestDay(
        "2026-07-11",
        "America/New_York",
        afterMidnight,
      ),
      true,
    );
  });

  it("refreshes and re-arms even if presenting the modal throws", () => {
    let currentNow = Date.parse("2026-07-11T03:59:00.000Z");
    let scheduledTimer: ScheduledTimer | null = null;
    let refreshCount = 0;
    let reportedError: unknown;
    const controller = new QuestDayCutoffController({
      timeZone: "America/New_York",
      getNow: () => currentNow,
      getRouteContext: () => ({ pathname: "/quests" }),
      onDayChanged: () => {
        refreshCount += 1;
      },
      onQuestCutoff: () => {
        throw new Error("navigation failed");
      },
      onError: (error) => {
        reportedError = error;
      },
      schedule: (callback, delayMs) => {
        scheduledTimer = { callback, delayMs };
        return 1 as never;
      },
      cancel: () => {
        scheduledTimer = null;
      },
    });

    controller.start();
    currentNow = Date.parse("2026-07-11T04:01:00.000Z");

    controller.checkNow();
    assert.equal(refreshCount, 1);
    assert.match(String(reportedError), /navigation failed/);
    assert.ok(scheduledTimer);
  });

  it("cancels its scheduled cutoff when stopped", () => {
    const harness = createHarness({
      now: Date.parse("2026-07-11T03:59:00.000Z"),
      pathname: "/quests",
    });

    harness.controller.start();
    assert.ok(harness.getScheduledTimer());

    harness.controller.stop();
    assert.equal(harness.getScheduledTimer(), null);
  });

  it("wires the production Date and timer APIs to the cutoff", (context) => {
    context.mock.timers.enable({
      apis: ["Date", "setTimeout"],
      now: new Date("2026-07-11T03:59:59.500Z"),
    });
    const modalEvents: QuestDayCutoffEvent[] = [];
    const controller = new QuestDayCutoffController({
      timeZone: "America/New_York",
      getRouteContext: () => ({ pathname: "/quests" }),
      onDayChanged: () => {},
      onQuestCutoff: (event) => modalEvents.push(event),
    });

    controller.start();
    context.mock.timers.tick(499);
    assert.equal(modalEvents.length, 0);

    context.mock.timers.tick(1);
    assert.equal(modalEvents.length, 1);
    controller.stop();
  });
});
