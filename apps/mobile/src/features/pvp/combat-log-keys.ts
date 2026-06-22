import type { PvpBattleState } from "./types";

export function getCombatLogEventKey(
  event: PvpBattleState["log"][number],
  index: number,
) {
  return [event.turn, event.seq, index, event.type].join(":");
}
