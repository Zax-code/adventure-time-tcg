import { describe, expect, it } from "vitest";

import type {
  PvpParticipantBattleState,
  PvpUnitState,
} from "@adventure-time/api-client";

import {
  buildPvpAction,
  getBattleActionOptions,
  prepareBattleAction,
  prepareCopyFollowUp,
} from "@/pages/player/pvp-actions";

type AbilityDefinition = NonNullable<
  PvpParticipantBattleState["abilityDefinitions"]
>[string];

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

function ability(
  key: string,
  payload: NonNullable<AbilityDefinition["payload"]>,
  overrides: Partial<AbilityDefinition> = {},
): AbilityDefinition {
  return {
    key,
    name: key,
    description: `${key} description`,
    type: "SKILL",
    cost: 1,
    cooldown: 0,
    oncePerMatch: false,
    payload,
    ...overrides,
  };
}

function battleState({
  abilities = {},
  actor = {},
  energy = 5,
}: {
  abilities?: Record<string, AbilityDefinition>;
  actor?: Partial<PvpUnitState>;
  energy?: number;
} = {}): PvpParticipantBattleState {
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
        energy,
        maxEnergy: 5,
        hasUsedFreeBasic: false,
        units: [
          unit("actor", actor),
          unit("ally"),
          unit("ally-ko", { hp: 0, knockedOut: true, position: 3 }),
        ],
        bench: [
          unit("bench", { position: null }),
          unit("bench-ko", {
            hp: 0,
            knockedOut: true,
            position: null,
          }),
        ],
      },
      {
        userId: "them",
        name: "Them",
        energy: 5,
        maxEnergy: 5,
        hasUsedFreeBasic: false,
        units: [
          unit("enemy"),
          unit("taunter", {
            position: 2,
            statuses: [{ name: "Taunt", duration: 1, appliedAt: 3 }],
          }),
          unit("stealthed", {
            position: 3,
            statuses: [{ name: "Stealth", duration: 1, appliedAt: 3 }],
          }),
        ],
        bench: [unit("enemy-bench", { position: null })],
      },
    ],
    log: [],
    abilityDefinitions: abilities,
    isMyTurn: true,
    myUserId: "me",
  };
}

describe("web PvP action builder", () => {
  it("uses the engine's Stealth and Taunt rules for basic attacks", () => {
    const state = battleState();
    const prepared = prepareBattleAction(state, "actor", "basic");

    expect(prepared?.validTargetIds).toEqual(["taunter"]);
    expect(prepared && buildPvpAction(prepared, "enemy")).toBeNull();
    expect(prepared && buildPvpAction(prepared, "taunter")).toEqual({
      kind: "basic",
      actorInstanceId: "actor",
      targetInstanceId: "taunter",
    });
  });

  it("supports automatic self targeting and ally bench targeting", () => {
    const state = battleState({
      actor: { skill: "self-shield", ultimate: "heal-ally" },
      abilities: {
        "self-shield": ability("self-shield", { target: "self" }),
        "heal-ally": ability(
          "heal-ally",
          { target: "ally", healPctOfMaxHp: 0.25 },
          { type: "ULTIMATE" },
        ),
      },
    });

    const self = prepareBattleAction(state, "actor", "skill");
    expect(self).toMatchObject({
      targetLabel: "self",
      requiresTargetSelection: false,
      validTargetIds: [],
    });
    expect(self && buildPvpAction(self)).toEqual({
      kind: "skill",
      actorInstanceId: "actor",
      abilityKey: "self-shield",
    });

    const ally = prepareBattleAction(state, "actor", "ultimate");
    expect(ally?.validTargetIds).toEqual(["actor", "ally", "bench"]);
    expect(ally && buildPvpAction(ally, "bench")).toEqual({
      kind: "ultimate",
      actorInstanceId: "actor",
      abilityKey: "heal-ally",
      targetInstanceId: "bench",
    });
  });

  it("supports any-side and KO-only revive targets", () => {
    const state = battleState({
      actor: { skill: "wild-magic", ultimate: "revive" },
      abilities: {
        "wild-magic": ability("wild-magic", { target: "any" }),
        revive: ability(
          "revive",
          { revivePct: 0.4 },
          { type: "ULTIMATE" },
        ),
      },
    });

    expect(
      prepareBattleAction(state, "actor", "skill")?.validTargetIds,
    ).toEqual(["actor", "ally", "bench", "taunter"]);
    expect(
      prepareBattleAction(state, "actor", "ultimate")?.validTargetIds,
    ).toEqual(["ally-ko", "bench-ko"]);
  });

  it("builds both stages of copy actions and omits invalid copy sources", () => {
    const state = battleState({
      actor: { skill: "mimic" },
      abilities: {
        mimic: ability("mimic", {
          copyAbilityType: "SKILL",
          copyAbilitySource: "either",
        }),
        "ally-heal": ability("ally-heal", {
          target: "ally",
          healPctOfMaxHp: 0.2,
        }),
        "enemy-blast": ability("enemy-blast", {
          target: "enemy",
          damageMul: 1.2,
        }),
      },
    });
    state.players[0].units[1].skill = "ally-heal";
    state.players[1].units[0].skill = "enemy-blast";

    const copy = prepareBattleAction(state, "actor", "skill");
    expect(copy).toMatchObject({
      actionKind: "copy",
      stage: "copy-source",
      validTargetIds: ["ally", "enemy"],
    });

    const followUp = copy && prepareCopyFollowUp(state, copy, "ally");
    expect(followUp).toMatchObject({
      actionKind: "copy",
      stage: "target",
      sourceInstanceId: "ally",
      copiedAbilityKey: "ally-heal",
      validTargetIds: ["actor", "ally", "bench"],
    });
    expect(followUp && buildPvpAction(followUp, "bench")).toEqual({
      kind: "copy",
      actorInstanceId: "actor",
      abilityKey: "mimic",
      sourceInstanceId: "ally",
      targetInstanceId: "bench",
    });
  });

  it("builds copy actions without a target for self and field abilities", () => {
    const state = battleState({
      actor: { skill: "enemy-mimic" },
      abilities: {
        "enemy-mimic": ability("enemy-mimic", {
          copyAbilityType: "SKILL",
          copyAbilitySource: "enemy",
        }),
        "self-focus": ability("self-focus", { target: "self" }),
      },
    });
    state.players[1].units[0].skill = "self-focus";

    const copy = prepareBattleAction(state, "actor", "skill");
    const followUp = copy && prepareCopyFollowUp(state, copy, "enemy");

    expect(followUp).toMatchObject({
      requiresTargetSelection: false,
      sourceInstanceId: "enemy",
      targetLabel: "self",
    });
    expect(followUp && buildPvpAction(followUp)).toEqual({
      kind: "copy",
      actorInstanceId: "actor",
      abilityKey: "enemy-mimic",
      sourceInstanceId: "enemy",
    });
  });

  it("carries KO active and bench targets through a copied revive", () => {
    const state = battleState({
      actor: { skill: "mimic" },
      abilities: {
        mimic: ability("mimic", {
          copyAbilityType: "ULTIMATE",
          copyAbilitySource: "ally",
        }),
        revive: ability(
          "revive",
          { revivePct: 0.4 },
          { type: "ULTIMATE" },
        ),
      },
    });
    state.players[0].units[1].ultimate = "revive";

    const copy = prepareBattleAction(state, "actor", "skill");
    const followUp = copy && prepareCopyFollowUp(state, copy, "ally");

    expect(followUp?.validTargetIds).toEqual(["ally-ko", "bench-ko"]);
    expect(followUp && buildPvpAction(followUp, "bench-ko")).toEqual({
      kind: "copy",
      actorInstanceId: "actor",
      abilityKey: "mimic",
      sourceInstanceId: "ally",
      targetInstanceId: "bench-ko",
    });
  });

  it("disables illegal commands using energy, status, cooldown, and target state", () => {
    const state = battleState({
      actor: {
        skill: "heal",
        ultimate: "finale",
        cooldowns: { heal: 2 },
        usedUltimate: true,
        statuses: [
          { name: "Haste", duration: 1, appliedAt: 3 },
        ],
      },
      abilities: {
        heal: ability("heal", { target: "ally" }),
        finale: ability("finale", { target: "allEnemies" }, {
          type: "ULTIMATE",
          cost: 4,
        }),
      },
      energy: 0,
    });

    const options = getBattleActionOptions(state, "actor");
    const basic = options.find((option) => option.slot === "basic");
    expect(basic?.cost).toBe(0);
    expect(basic?.disabledReason).toBeUndefined();
    expect(options.find((option) => option.slot === "skill")?.disabledReason)
      .toBe("On cooldown for 2 more turns.");
    expect(
      options.find((option) => option.slot === "ultimate")?.disabledReason,
    ).toBe("This ultimate was already used.");

    state.players[0].units[0].statuses.push({
      name: "Silence",
      duration: 1,
      appliedAt: 3,
    });
    state.players[0].units[0].cooldowns = {};
    state.players[0].units[0].usedUltimate = false;
    state.players[0].energy = 5;
    const silenced = getBattleActionOptions(state, "actor");
    expect(silenced.find((option) => option.slot === "skill")?.disabledReason)
      .toBe("This unit is silenced.");
    expect(
      silenced.find((option) => option.slot === "ultimate")?.disabledReason,
    ).toBe("This unit is silenced.");
  });

  it("omits copy sources whose copied action has no legal target", () => {
    const state = battleState({
      actor: { skill: "mimic" },
      abilities: {
        mimic: ability("mimic", {
          copyAbilityType: "ULTIMATE",
          copyAbilitySource: "ally",
        }),
        revive: ability(
          "revive",
          { revivePct: 0.4 },
          { type: "ULTIMATE" },
        ),
      },
    });
    state.players[0].units[1].ultimate = "revive";
    state.players[0].units[2].hp = 10;
    state.players[0].units[2].knockedOut = false;
    state.players[0].bench[1].hp = 10;
    state.players[0].bench[1].knockedOut = false;

    expect(
      prepareBattleAction(state, "actor", "skill")?.validTargetIds,
    ).toEqual([]);
  });
});
