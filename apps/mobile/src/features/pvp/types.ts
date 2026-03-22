import type { PvpBattleState, PvpPlayerState, PvpUnitState } from "@adventure-time/shared";

export type { PvpBattleState, PvpPlayerState, PvpUnitState };

export interface MyMatchView {
  id: string;
  myPlayer: PvpPlayerState;
  opponentPlayer: PvpPlayerState;
  isMyTurn: boolean;
  myUserId: string;
  turn: number;
  phase: "active" | "ended";
  winnerId?: string | null;
  abilityDefinitions?: PvpBattleState["abilityDefinitions"];
  log: PvpBattleState["log"];
}

export interface TargetingMode {
  actorInstanceId: string;
  actionKind: "basic" | "skill" | "ultimate" | "copy";
  abilityKey?: string;
  validTargetIds: string[];
}

export type SwapSelection = { activeInstanceId: string } | null;

export interface FloatingEvent {
  seq: number;
  targetInstanceId: string;
  type: "damage" | "crit" | "shieldCrit" | "heal" | "miss";
  amount: number;
}

export function deriveMyMatchView(
  state: PvpBattleState,
  myUserId: string,
): MyMatchView | null {
  const myPlayer = state.players.find((p) => p.userId === myUserId);
  const opponentPlayer = state.players.find((p) => p.userId !== myUserId);
  if (!myPlayer || !opponentPlayer) return null;
  return {
    id: state.id,
    myPlayer,
    opponentPlayer,
    isMyTurn: state.isMyTurn,
    myUserId,
    turn: state.turn,
    phase: state.phase,
    winnerId: state.winnerId,
    abilityDefinitions: state.abilityDefinitions,
    log: state.log,
  };
}

export function deriveValidTargets(
  myPlayer: PvpPlayerState,
  oppPlayer: PvpPlayerState,
  actionKind: TargetingMode["actionKind"],
  abilityKey: string | undefined,
  abilityDefs: PvpBattleState["abilityDefinitions"],
): string[] {
  if (actionKind === "basic") {
    const liveOpp = oppPlayer.units.filter((u) => u.hp > 0);
    const taunters = liveOpp.filter((u) => u.statuses.some((s) => s.name === "Taunt"));
    return (taunters.length > 0 ? taunters : liveOpp).map((u) => u.instanceId);
  }

  if (abilityKey && abilityDefs) {
    const def = abilityDefs[abilityKey];
    if (def) {
      // For AoE/self abilities, no explicit target needed - return empty to mean "submit without target"
      // For targeted abilities, return live opponents
    }
  }

  // Default: live opponents
  return oppPlayer.units.filter((u) => u.hp > 0).map((u) => u.instanceId);
}
