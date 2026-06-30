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
