import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminCardsResponse } from "@adventure-time/api-client";

import {
  BALANCE_HISTORY_LIMIT,
  BALANCE_HISTORY_STORAGE_KEY,
  buildBalanceRun,
  downloadBalanceRun,
  loadBalanceHistory,
  saveBalanceHistory,
  serializeBalanceRun,
  type BalanceWeights,
} from "./balance-report";

type AdminCard = AdminCardsResponse["cards"][number];

const attackOnlyWeights: BalanceWeights = {
  hp: 0,
  attack: 1,
  defense: 0,
  speed: 0,
};

function card(
  id: string,
  attack: number,
  rarityName: string,
  type: AdminCard["type"],
  isArchived = false,
): AdminCard {
  return {
    id,
    name: id === "special" ? 'Finn, "Hero"' : id,
    character: id,
    rarityName,
    rarityId: rarityName.toLowerCase(),
    isArchived,
    isFeatured: false,
    description: "Test card",
    hp: 100,
    attack,
    defense: 20,
    speed: 30,
    type,
    imageAssetId: null,
  };
}

const catalog: AdminCard[] = [
  card("special", 400, "Legendary", "Hero"),
  card("legend-two", 100, "Legendary", "Hero"),
  card("legend-three", 100, "Legendary", "Magic"),
  card("legend-four", 100, "Legendary", "Magic"),
  card("common-one", 90, "Common", "Hero"),
  card("common-two", 95, "Common", "Hero"),
  card("common-three", 100, "Common", "Magic"),
  card("archived", 1_000, "Common", "Magic", true),
];

function testRun(index = 0) {
  return buildBalanceRun(catalog, {
    generatedAt: `2026-07-09T12:${String(index).padStart(2, "0")}:00.000Z`,
    id: `run-${index}`,
    scope: "active",
    weights: attackOnlyWeights,
  });
}

describe("catalog balance reports", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uses real card stats, excludes archived cards, and flags comparison outliers", () => {
    const run = testRun();

    expect(run.summary.cardsAnalyzed).toBe(7);
    expect(run.cards.some((entry) => entry.id === "archived")).toBe(false);
    expect(run.cards.find((entry) => entry.id === "special")).toMatchObject({
      powerScore: 400,
      signal: "high",
    });
    expect(run.outliers.map((entry) => entry.id)).toContain("special");
    expect(run.limitation).toMatch(/does not use match telemetry/i);
    expect(run.recommendations.at(-1)).toMatch(/live match telemetry/i);
  });

  it("does not label an all-zero weighting as a healthy catalog", () => {
    const run = buildBalanceRun(catalog, {
      generatedAt: "2026-07-09T12:00:00.000Z",
      id: "zero-weight-run",
      scope: "active",
      weights: { hp: 0, attack: 0, defense: 0, speed: 0 },
    });

    expect(run.summary.healthScore).toBe(0);
    expect(run.recommendations[0]).toMatch(/positive stat weight/i);
  });

  it("keeps versioned history bounded and ignores malformed entries", () => {
    const storage = {
      value: "",
      getItem(key: string) {
        return key === BALANCE_HISTORY_STORAGE_KEY ? this.value : null;
      },
      setItem(key: string, value: string) {
        if (key === BALANCE_HISTORY_STORAGE_KEY) this.value = value;
      },
    };
    const runs = Array.from({ length: BALANCE_HISTORY_LIMIT + 3 }, (_, index) =>
      testRun(index),
    );

    const bounded = saveBalanceHistory(runs, storage);
    expect(bounded).toHaveLength(BALANCE_HISTORY_LIMIT);
    expect(loadBalanceHistory(storage)).toHaveLength(BALANCE_HISTORY_LIMIT);

    storage.value = JSON.stringify([
      { schemaVersion: 0, id: "legacy" },
      testRun(20),
      null,
    ]);
    expect(loadBalanceHistory(storage).map((run) => run.id)).toEqual(["run-20"]);

    storage.value = "not-json";
    expect(loadBalanceHistory(storage)).toEqual([]);
  });

  it("exports machine-readable JSON and escaped CSV", () => {
    const run = testRun();
    const json = serializeBalanceRun(run, "json");
    const csv = serializeBalanceRun(run, "csv");

    expect(JSON.parse(json)).toMatchObject({
      schemaVersion: 1,
      source: "Phoenix admin card catalog",
    });
    expect(csv).toContain('"Finn, ""Hero"""');
    expect(csv).toContain("Catalog-only diagnostic");
  });

  it("revokes a download object URL after dispatching the browser download", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:balance-report");
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    downloadBalanceRun(testRun(), "json");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:balance-report");
  });
});
