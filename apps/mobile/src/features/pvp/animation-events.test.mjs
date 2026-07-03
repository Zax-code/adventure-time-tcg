import assert from "node:assert/strict";
import test from "node:test";

import { buildPvpVisualEvents } from "./animation-events.ts";

test("critical marker events do not emit a zero damage float", () => {
  const events = buildPvpVisualEvents([
    {
      turn: 3,
      seq: 11,
      type: "crit",
      payload: {
        attackerId: "attacker-1",
        targetId: "target-1",
      },
    },
    {
      turn: 3,
      seq: 12,
      type: "damage",
      payload: {
        attackerId: "attacker-1",
        targetId: "target-1",
        damage: 42,
        isCrit: true,
      },
    },
  ]);

  assert.deepEqual(events.floatingEvents, [
    {
      key: "3:12:1:damage:float:crit:target-1",
      seq: 12,
      targetInstanceId: "target-1",
      type: "crit",
      amount: 42,
      delayMs: 0,
    },
  ]);
});

test("basic damage animates the attacking unit and the target", () => {
  const events = buildPvpVisualEvents([
    {
      turn: 3,
      seq: 14,
      type: "damage",
      payload: {
        attackerId: "attacker-1",
        targetId: "target-1",
        damage: 16,
      },
    },
  ]);

  assert.deepEqual(events.unitAnimationEvents, [
    {
      key: "3:14:0:damage:unit:attack:attacker-1",
      seq: 14,
      targetInstanceId: "attacker-1",
      type: "attack",
      delayMs: 0,
    },
    {
      key: "3:14:0:damage:unit:damage:target-1",
      seq: 14,
      targetInstanceId: "target-1",
      type: "damage",
      delayMs: 0,
    },
  ]);
});

test("damage and debuff from one ability animate the actor once for offense", () => {
  const events = buildPvpVisualEvents([
    {
      turn: 4,
      seq: 20,
      type: "abilityStart",
      payload: {
        actorId: "attacker-1",
        abilityKey: "combo-hit",
        targetId: "target-1",
      },
    },
    {
      turn: 4,
      seq: 21,
      type: "damage",
      payload: {
        attackerId: "attacker-1",
        targetId: "target-1",
        damage: 24,
        isCrit: false,
      },
    },
    {
      turn: 4,
      seq: 22,
      type: "statusApply",
      payload: {
        sourceId: "attacker-1",
        targetId: "target-1",
        statusName: "Vulnerable",
      },
    },
  ]);

  assert.deepEqual(events.unitAnimationEvents, [
    {
      key: "4:20:0:abilityStart:unit:attack:attacker-1",
      seq: 20,
      targetInstanceId: "attacker-1",
      type: "attack",
      delayMs: 0,
    },
    {
      key: "4:20:0:abilityStart:unit:damage:target-1",
      seq: 20,
      targetInstanceId: "target-1",
      type: "damage",
      delayMs: 0,
    },
  ]);
});

test("debuff-only ability animates the actor once for offense", () => {
  const events = buildPvpVisualEvents([
    {
      turn: 4,
      seq: 24,
      type: "abilityStart",
      payload: {
        actorId: "attacker-1",
        abilityKey: "hex",
        targetId: "target-1",
      },
    },
    {
      turn: 4,
      seq: 25,
      type: "statusApply",
      payload: {
        sourceId: "attacker-1",
        targetId: "target-1",
        statusName: "Poison",
      },
    },
  ]);

  assert.deepEqual(events.unitAnimationEvents, [
    {
      key: "4:24:0:abilityStart:unit:attack:attacker-1",
      seq: 24,
      targetInstanceId: "attacker-1",
      type: "attack",
      delayMs: 0,
    },
    {
      key: "4:24:0:abilityStart:unit:damage:target-1",
      seq: 24,
      targetInstanceId: "target-1",
      type: "damage",
      delayMs: 0,
    },
  ]);
});

test("buff-only ability animates the actor once for support", () => {
  const events = buildPvpVisualEvents([
    {
      turn: 4,
      seq: 26,
      type: "abilityStart",
      payload: {
        actorId: "caster-1",
        abilityKey: "guard",
        targetId: "ally-1",
      },
    },
    {
      turn: 4,
      seq: 27,
      type: "statusApply",
      payload: {
        sourceId: "caster-1",
        targetId: "ally-1",
        statusName: "Shield",
      },
    },
  ]);

  assert.deepEqual(events.unitAnimationEvents, [
    {
      key: "4:26:0:abilityStart:unit:buff-cast:caster-1",
      seq: 26,
      targetInstanceId: "caster-1",
      type: "buff-cast",
      delayMs: 0,
    },
    {
      key: "4:26:0:abilityStart:unit:buff:ally-1",
      seq: 26,
      targetInstanceId: "ally-1",
      type: "buff",
      delayMs: 0,
    },
  ]);
});

test("attack plus buff from one ability animates the actor sequentially", () => {
  const events = buildPvpVisualEvents([
    {
      turn: 5,
      seq: 30,
      type: "abilityStart",
      payload: {
        actorId: "attacker-1",
        abilityKey: "rally-hit",
        targetId: "target-1",
      },
    },
    {
      turn: 5,
      seq: 31,
      type: "damage",
      payload: {
        attackerId: "attacker-1",
        targetId: "target-1",
        damage: 18,
      },
    },
    {
      turn: 5,
      seq: 32,
      type: "statusApply",
      payload: {
        sourceId: "attacker-1",
        targetId: "ally-1",
        statusName: "Shield",
      },
    },
  ]);

  assert.deepEqual(events.unitAnimationEvents, [
    {
      key: "5:30:0:abilityStart:unit:attack:attacker-1",
      seq: 30,
      targetInstanceId: "attacker-1",
      type: "attack",
      delayMs: 0,
    },
    {
      key: "5:30:0:abilityStart:unit:damage:target-1",
      seq: 30,
      targetInstanceId: "target-1",
      type: "damage",
      delayMs: 0,
    },
    {
      key: "5:30:0:abilityStart:unit:buff-cast:attacker-1",
      seq: 30,
      targetInstanceId: "attacker-1",
      type: "buff-cast",
      delayMs: 360,
    },
    {
      key: "5:30:0:abilityStart:unit:buff:ally-1",
      seq: 30,
      targetInstanceId: "ally-1",
      type: "buff",
      delayMs: 360,
    },
  ]);
});
