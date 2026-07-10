import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PvpParticipantBattleState,
  PvpUnitState,
} from "@adventure-time/api-client";

import { PvpMatchPage } from "@/pages/player/pvp-pages";

const apiMocks = vi.hoisted(() => ({
  actPvpMatch: vi.fn(),
  concedePvpMatch: vi.fn(),
  endTurnPvpMatch: vi.fn(),
  pvpMatch: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  configureWebApiAuth: vi.fn(),
  isAuthenticationError: vi.fn(() => false),
  webApiClient: apiMocks,
  webJsonRequest: vi.fn(),
}));

function unit(
  instanceId: string,
  overrides: Partial<PvpUnitState> = {},
): PvpUnitState {
  return {
    instanceId,
    cardId: `${instanceId}-card`,
    name: instanceId,
    character: instanceId,
    type: "Hero",
    rarity: "Common",
    imageUrl: null,
    hp: 100,
    maxHp: 100,
    attack: 10,
    defense: 10,
    speed: 10,
    statuses: [],
    cooldowns: {},
    usedUltimate: false,
    position: 1,
    skill: null,
    ultimate: null,
    passives: [],
    knockedOut: false,
    ...overrides,
  };
}

function copyBattleState(): PvpParticipantBattleState {
  return {
    id: "match-1",
    turn: 3,
    phase: "active",
    currentPlayerId: "me",
    winnerId: null,
    players: [
      {
        userId: "me",
        name: "Me",
        energy: 5,
        maxEnergy: 5,
        hasUsedFreeBasic: false,
        units: [
          unit("Mimic", { skill: "mimic" }),
          unit("Healer", { position: 2, skill: "ally-heal" }),
        ],
        bench: [unit("Bench friend", { position: null })],
      },
      {
        userId: "them",
        name: "Them",
        energy: 5,
        maxEnergy: 5,
        hasUsedFreeBasic: false,
        units: [unit("Enemy")],
        bench: [],
      },
    ],
    log: [],
    abilityDefinitions: {
      mimic: {
        key: "mimic",
        name: "Borrow a trick",
        description: "Copy an ally skill.",
        type: "SKILL",
        cost: 1,
        cooldown: 0,
        oncePerMatch: false,
        payload: {
          copyAbilityType: "SKILL",
          copyAbilitySource: "ally",
        },
      },
      "ally-heal": {
        key: "ally-heal",
        name: "Shared snack",
        description: "Heal a living ally.",
        type: "SKILL",
        cost: 1,
        cooldown: 0,
        oncePerMatch: false,
        payload: { target: "ally", healPctOfMaxHp: 0.2 },
      },
    },
    isMyTurn: true,
    myUserId: "me",
  };
}

function renderMatch(state: PvpParticipantBattleState) {
  apiMocks.pvpMatch.mockResolvedValue({ battleState: state });
  apiMocks.actPvpMatch.mockResolvedValue({ battleState: state, events: [] });
  apiMocks.endTurnPvpMatch.mockResolvedValue({ battleState: state, events: [] });
  apiMocks.concedePvpMatch.mockResolvedValue({ success: true });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/pvp/match/match-1"]}>
        <Routes>
          <Route path="/pvp/match/:matchId" element={<PvpMatchPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PvpMatchPage action selection", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes copy-source and ally-bench target selection", async () => {
    renderMatch(copyBattleState());

    fireEvent.click(await screen.findByRole("button", { name: "Mimic" }));
    fireEvent.click(screen.getByRole("button", { name: /Borrow a trick/ }));

    expect(screen.getByRole("heading", {
      name: /Choose an active ally to copy/i,
    })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Enemy, legal selection/ }))
      .not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", {
      name: "Healer, legal selection",
    }));
    expect(screen.getByRole("heading", {
      name: /Choose a living ally/i,
    })).toBeVisible();

    fireEvent.click(screen.getByRole("button", {
      name: "Bench friend, legal selection",
    }));

    await waitFor(() => {
      expect(apiMocks.actPvpMatch).toHaveBeenCalledWith("match-1", {
        kind: "copy",
        actorInstanceId: "Mimic",
        abilityKey: "mimic",
        sourceInstanceId: "Healer",
        targetInstanceId: "Bench friend",
      });
    });
  });

  it("enables a knocked-out bench card only for a legal revive", async () => {
    const state = copyBattleState();
    state.players[0].units[0].skill = null;
    state.players[0].units[0].ultimate = "revive";
    state.players[0].bench[0].hp = 0;
    state.players[0].bench[0].knockedOut = true;
    state.abilityDefinitions = {
      revive: {
        key: "revive",
        name: "Bring them back",
        description: "Revive a knocked-out ally.",
        type: "ULTIMATE",
        cost: 2,
        cooldown: 0,
        oncePerMatch: true,
        payload: { revivePct: 0.4 },
      },
    };
    renderMatch(state);

    fireEvent.click(await screen.findByRole("button", { name: "Mimic" }));
    fireEvent.click(screen.getByRole("button", { name: /Bring them back/ }));
    const reviveTarget = screen.getByRole("button", {
      name: "Bench friend, legal selection",
    });
    expect(reviveTarget).toBeEnabled();
    fireEvent.click(reviveTarget);

    await waitFor(() => {
      expect(apiMocks.actPvpMatch).toHaveBeenCalledWith("match-1", {
        kind: "ultimate",
        actorInstanceId: "Mimic",
        abilityKey: "revive",
        targetInstanceId: "Bench friend",
      });
    });
  });

  it("submits an explicit living active-to-bench swap", async () => {
    renderMatch(copyBattleState());

    fireEvent.click(await screen.findByRole("button", { name: "Mimic" }));
    fireEvent.click(screen.getByRole("button", { name: "Swap & end turn" }));
    fireEvent.click(screen.getByRole("button", {
      name: "Bench friend, legal selection",
    }));

    await waitFor(() => {
      expect(apiMocks.endTurnPvpMatch).toHaveBeenCalledWith("match-1", {
        swap: {
          activeInstanceId: "Mimic",
          benchInstanceId: "Bench friend",
        },
      });
    });
  });

  it("normalizes API-prefixed battle artwork for same-origin production media", async () => {
    const state = copyBattleState();
    state.players[0].units[1].imageUrl = "/api/media/card/healer-art";
    const { container } = renderMatch(state);

    await screen.findByRole("button", { name: "Healer" });

    expect(
      container.querySelector(
        '.battle-unit-art img[src="/media/card/healer-art"]',
      ),
    ).toBeInTheDocument();
  });
});
