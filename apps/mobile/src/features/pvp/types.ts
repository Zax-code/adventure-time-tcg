import {
  getAbilityTarget,
  getValidTargets,
  requiresTargetSelection,
  type AbilityPayload,
  type BattleState,
} from "@adventure-time/game-engine";
import type { PvpBattleState, PvpPlayerState, PvpUnitState } from "@adventure-time/shared";

export type { PvpBattleState, PvpPlayerState, PvpUnitState };

export interface MyMatchView {
  id: string;
  battleState: PvpBattleState;
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
  sourceInstanceId?: string;
  copiedAbilityKey?: string;
  stage?: "target" | "copy-source";
  targetLabel?: string;
  validTargetIds: string[];
}

export type SwapSelection = { activeInstanceId: string } | null;

export interface FloatingEvent {
  seq: number;
  targetInstanceId: string;
  type: "damage" | "crit" | "shieldCrit" | "heal" | "miss";
  amount: number;
}

export interface PreparedBattleAction {
  actionKind: "basic" | "skill" | "ultimate" | "copy";
  actorInstanceId: string;
  abilityKey?: string;
  validTargetIds: string[];
  requiresTargetSelection: boolean;
  stage?: "target" | "copy-source";
  sourceInstanceId?: string;
  copiedAbilityKey?: string;
  targetLabel?: string;
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
    battleState: state,
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

function asBattleState(state: PvpBattleState): BattleState {
  return state as unknown as BattleState;
}

function getAbilityPayload(
  state: PvpBattleState,
  abilityKey: string | undefined,
): AbilityPayload | null {
  if (!abilityKey) return null;
  const payload = state.abilityDefinitions?.[abilityKey]?.payload;
  return payload ? (payload as AbilityPayload) : null;
}

export function prepareBattleAction(
  state: PvpBattleState,
  actorInstanceId: string,
  actionKind: "basic" | "skill" | "ultimate",
  abilityKey?: string,
): PreparedBattleAction | null {
  if (actionKind === "basic") {
    const validTargetIds = getValidTargets(asBattleState(state), actorInstanceId, "basic");
    return {
      actionKind,
      actorInstanceId,
      validTargetIds,
      requiresTargetSelection: true,
      targetLabel: "enemy",
    };
  }

  const payload = getAbilityPayload(state, abilityKey);
  if (!payload) {
    return null;
  }

  if (payload.copyAbilityType) {
    const me = state.players.find((player) => player.userId === state.myUserId);
    const opponent = state.players.find((player) => player.userId !== state.myUserId);
    if (!me || !opponent) {
      return null;
    }

    const source = payload.copyAbilitySource ?? "either";
    const allySources = me.units
      .filter((unit) => unit.hp > 0 && unit.instanceId !== actorInstanceId)
      .map((unit) => unit.instanceId);
    const enemySources = opponent.units.filter((unit) => unit.hp > 0).map((unit) => unit.instanceId);

    return {
      actionKind: "copy",
      actorInstanceId,
      abilityKey,
      validTargetIds:
        source === "ally"
          ? allySources
          : source === "enemy"
            ? enemySources
            : [...allySources, ...enemySources],
      requiresTargetSelection: true,
      stage: "copy-source",
      targetLabel: source === "ally" ? "copy ally" : source === "enemy" ? "copy enemy" : "copy source",
    };
  }

  return {
    actionKind,
    actorInstanceId,
    abilityKey,
    validTargetIds: getValidTargets(asBattleState(state), actorInstanceId, actionKind, abilityKey),
    requiresTargetSelection: requiresTargetSelection(payload),
    targetLabel: getAbilityTarget(payload),
  };
}

export function prepareCopyFollowUp(
  state: PvpBattleState,
  actorInstanceId: string,
  copyAbilityKey: string,
  sourceInstanceId: string,
): PreparedBattleAction | null {
  const actorSide = state.players.find((player) => player.userId === state.myUserId);
  const opponentSide = state.players.find((player) => player.userId !== state.myUserId);
  if (!actorSide || !opponentSide) {
    return null;
  }

  const sourceUnit = [...actorSide.units, ...opponentSide.units].find((unit) => unit.instanceId === sourceInstanceId);
  if (!sourceUnit) {
    return null;
  }

  const copyPayload = getAbilityPayload(state, copyAbilityKey);
  if (!copyPayload?.copyAbilityType) {
    return null;
  }

  const copiedAbilityKey = copyPayload.copyAbilityType === "SKILL" ? sourceUnit.skill : sourceUnit.ultimate;
  const copiedPayload = getAbilityPayload(state, copiedAbilityKey);
  if (!copiedPayload) {
    return null;
  }

  const targetMode = getAbilityTarget(copiedPayload);
  const me = actorSide;
  const enemy = opponentSide;

  let validTargetIds: string[] = [];
  if (copiedPayload.revivePct !== undefined) {
    validTargetIds = [...me.units, ...me.bench].filter((unit) => unit.hp <= 0).map((unit) => unit.instanceId);
  } else if (targetMode === "enemy") {
    validTargetIds = getValidTargets(asBattleState(state), actorInstanceId, "skill", copiedAbilityKey);
  } else if (targetMode === "ally") {
    validTargetIds = [...me.units, ...me.bench].filter((unit) => unit.hp > 0).map((unit) => unit.instanceId);
  } else if (targetMode === "any") {
    const allyTargets = [...me.units, ...me.bench].filter((unit) => unit.hp > 0).map((unit) => unit.instanceId);
    const enemyTargets = getValidTargets(asBattleState(state), actorInstanceId, "skill", copiedAbilityKey);
    validTargetIds = [...allyTargets, ...enemyTargets];
  }

  return {
    actionKind: "copy",
    actorInstanceId,
    abilityKey: copyAbilityKey,
    sourceInstanceId,
    copiedAbilityKey,
    validTargetIds,
    requiresTargetSelection: requiresTargetSelection(copiedPayload),
    stage: "target",
    targetLabel: copiedPayload.revivePct !== undefined ? "ally" : targetMode,
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
