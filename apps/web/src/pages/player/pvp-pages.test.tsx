import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { PvpMatchDetailResponse } from "@adventure-time/api-client";

import { PvpReferencePage, replayStateAtCursor } from "./pvp-pages";

describe("PvP reference and replay helpers", () => {
  it("renders the canonical combat status names", () => {
    render(
      <MemoryRouter>
        <PvpReferencePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Burn" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Barrier" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "BURNING" })).not.toBeInTheDocument();
  });

  it("reconstructs a battle board from the opening state and event cursor", () => {
    const replay = {
      initialState: {
        id: "match-1",
        seed: "seed-1",
        rngIndex: 0,
        turn: 1,
        phase: "active",
        currentPlayerId: "player-a",
        winnerId: null,
        players: [
          {
            userId: "player-a",
            name: "Finn",
            energy: 1,
            maxEnergy: 1,
            units: [{ instanceId: "unit-a", hp: 10, maxHp: 10, statuses: [] }],
            bench: [],
          },
          {
            userId: "player-b",
            name: "Jake",
            energy: 1,
            maxEnergy: 1,
            units: [{ instanceId: "unit-b", hp: 10, maxHp: 10, statuses: [] }],
            bench: [],
          },
        ],
        log: [],
      },
      finalState: null,
      log: [
        {
          seq: 1,
          turn: 1,
          type: "damage",
          payload: { targetId: "unit-b", hpAfter: 4 },
        },
      ],
      seed: "seed-1",
      totalTurns: 1,
    } as NonNullable<PvpMatchDetailResponse["replay"]>;

    const state = replayStateAtCursor(replay, 1);

    expect(state?.players[1]?.units[0]?.hp).toBe(4);
    expect(state?.log).toHaveLength(1);
  });
});
