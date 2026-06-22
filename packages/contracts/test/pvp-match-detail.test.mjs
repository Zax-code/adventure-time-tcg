import assert from "node:assert/strict";
import test from "node:test";

import { pvpMatchDetailResponseSchema } from "../src/index.ts";

function makeUnit(instanceId) {
  return {
    instanceId,
    cardId: instanceId,
    name: instanceId,
    character: instanceId,
    type: "Hero",
    rarity: "Common",
    hp: 10,
    maxHp: 10,
    attack: 1,
    defense: 1,
    speed: 1,
    statuses: [],
    cooldowns: {},
    usedUltimate: false,
    position: 1,
    passives: [],
    knockedOut: false,
  };
}

function makeStatus(name) {
  return {
    name,
    duration: 1,
    magnitude: null,
    appliedAt: 1,
    appliedDuringPlayerId: "user-1",
    targetOwnerId: "user-2",
    expiresAt: "afterOwnerTurnEndEffects",
    ownerTurnsSeen: 0,
  };
}

test("pvp match detail accepts null payload status magnitude as absent", () => {
  const response = {
    match: {
      id: "match-1",
      inviterId: "user-1",
      inviteeId: "user-2",
      status: "IN_PROGRESS",
      inviterLoadout: [],
      inviteeLoadout: [],
      winnerId: null,
      currentTurn: 1,
      createdAt: "2026-06-22T00:00:00Z",
      updatedAt: "2026-06-22T00:00:00Z",
    },
    battleState: {
      id: "match-1",
      turn: 1,
      phase: "active",
      currentPlayerId: "user-1",
      players: [
        {
          userId: "user-1",
          name: "A",
          energy: 0,
          hasUsedFreeBasic: false,
          units: [makeUnit("u1")],
          bench: [],
        },
        {
          userId: "user-2",
          name: "B",
          energy: 0,
          hasUsedFreeBasic: false,
          units: [
            {
              ...makeUnit("u2"),
              statuses: [makeStatus("Silence")],
            },
          ],
          bench: [],
        },
      ],
      log: [],
      isMyTurn: true,
      myUserId: "user-1",
      abilityDefinitions: {
        "ash.butterflies": {
          key: "ash.butterflies",
          name: "Butterflies of Doom",
          description: "Apply Poison, Vulnerable, and Mark to all enemies.",
          type: "ULTIMATE",
          cost: 3,
          cooldown: null,
          oncePerMatch: true,
          payload: {
            applyStatuses: [
              {
                name: "Poison",
                duration: 3,
                magnitude: null,
                target: "allEnemies",
              },
              {
                name: "Vulnerable",
                duration: 2,
                magnitude: null,
                target: "allEnemies",
              },
              {
                name: "Mark",
                duration: 2,
                magnitude: null,
                target: "allEnemies",
              },
            ],
            target: "allEnemies",
          },
        },
      },
    },
  };

  const parsed = pvpMatchDetailResponseSchema.parse(response);
  const statuses =
    parsed.battleState?.abilityDefinitions?.["ash.butterflies"].payload
      ?.applyStatuses ?? [];

  assert.deepEqual(
    statuses.map((status) => status.magnitude),
    [undefined, undefined, undefined],
  );

  assert.equal(
    parsed.battleState?.players[1].units[0].statuses[0].expiresAt,
    "afterOwnerTurnEndEffects",
  );
});
