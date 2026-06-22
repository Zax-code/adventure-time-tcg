import {
  getAbilityTarget,
  getValidTargets,
  requiresTargetSelection,
  type AbilityDefinition,
  type AbilityPayload,
  type StatusName,
  type TargetingBattleState,
  type TargetingPlayerState,
  type TargetingUnitState,
} from "@adventure-time/game-engine";
import type { PvpBattleState, PvpPlayerState, PvpUnitState } from "@adventure-time/api-client";

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

export type SwapSelection = {
  activeInstanceId?: string;
  benchInstanceId?: string;
} | null;

export interface FloatingEvent {
  seq: number;
  targetInstanceId: string;
  type: "damage" | "crit" | "shieldCrit" | "heal" | "miss";
  amount: number;
  delayMs?: number;
}

export type UnitAnimationEventType =
  | "damage"
  | "heal"
  | "death"
  | "buff"
  | "debuff"
  | "swap-in"
  | "swap-out";

export interface UnitAnimationEvent {
  seq: number;
  targetInstanceId: string;
  type: UnitAnimationEventType;
  delayMs?: number;
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

const VALID_STATUS_NAMES = new Set<StatusName>([
  "Burn",
  "Freeze",
  "Shield",
  "GuardUp",
  "Vulnerable",
  "Weakened",
  "Haste",
  "Taunt",
  "Regeneration",
  "Silence",
  "SummoningSickness",
  "Cover",
  "Stunned",
  "Poison",
  "Thorns",
  "Stealth",
  "Empower",
  "Counter",
  "Mark",
  "Barrier",
  "Doom",
]);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAbilityPayload(payload: unknown): AbilityPayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  return payload as AbilityPayload;
}

function isStatusName(value: string): value is StatusName {
  return VALID_STATUS_NAMES.has(value as StatusName);
}

function toTargetingUnitState(unit: PvpUnitState): TargetingUnitState {
  return {
    instanceId: unit.instanceId,
    hp: unit.hp,
    maxHp: unit.maxHp,
    attack: unit.attack,
    defense: unit.defense,
    speed: unit.speed,
    statuses: unit.statuses.flatMap((status) =>
      isStatusName(status.name)
        ? [
            {
              ...status,
              name: status.name,
              magnitude: status.magnitude ?? undefined,
            },
          ]
        : [],
    ),
  };
}

function toTargetingPlayerState(player: PvpPlayerState): TargetingPlayerState {
  return {
    userId: player.userId,
    units: player.units.map(toTargetingUnitState),
    bench: player.bench.map(toTargetingUnitState),
  };
}

function toTargetingAbilityDefinition(
  definition: NonNullable<PvpBattleState["abilityDefinitions"]>[string],
): AbilityDefinition | null {
  const payload = normalizeAbilityPayload(definition.payload);
  if (!payload) {
    return null;
  }

  return {
    key: definition.key,
    name: definition.name,
    description: definition.description,
    type: definition.type,
    cost: definition.cost,
    cooldown: definition.cooldown ?? undefined,
    oncePerMatch: definition.oncePerMatch,
    payload,
  };
}

function toTargetingBattleState(state: PvpBattleState): TargetingBattleState {
  const abilityDefinitions = state.abilityDefinitions
    ? Object.fromEntries(
        Object.entries(state.abilityDefinitions).flatMap(([key, definition]) => {
          const normalized = toTargetingAbilityDefinition(definition);
          return normalized ? [[key, normalized]] : [];
        }),
      )
    : undefined;

  return {
    currentPlayerId: state.currentPlayerId,
    players: [
      toTargetingPlayerState(state.players[0]),
      toTargetingPlayerState(state.players[1]),
    ],
    abilityDefinitions,
  };
}

function getAbilityPayload(
  state: PvpBattleState,
  abilityKey: string | undefined,
): AbilityPayload | null {
  if (!abilityKey) return null;
  const payload = state.abilityDefinitions?.[abilityKey]?.payload;
  return normalizeAbilityPayload(payload);
}

export function prepareBattleAction(
  state: PvpBattleState,
  actorInstanceId: string,
  actionKind: "basic" | "skill" | "ultimate",
  abilityKey?: string,
): PreparedBattleAction | null {
  const targetingState = toTargetingBattleState(state);

  if (actionKind === "basic") {
    const validTargetIds = getValidTargets(targetingState, actorInstanceId, "basic");
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
    validTargetIds: getValidTargets(targetingState, actorInstanceId, actionKind, abilityKey),
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

  const copiedAbilityKey =
    (copyPayload.copyAbilityType === "SKILL"
      ? sourceUnit.skill
      : sourceUnit.ultimate) ?? undefined;
  if (!copiedAbilityKey) {
    return null;
  }

  const copiedPayload = getAbilityPayload(state, copiedAbilityKey);
  if (!copiedPayload) {
    return null;
  }

  const targetMode = getAbilityTarget(copiedPayload);
  const me = actorSide;
  const enemy = opponentSide;
  const targetingState = toTargetingBattleState(state);

  let validTargetIds: string[] = [];
  if (copiedPayload.revivePct !== undefined) {
    validTargetIds = [...me.units, ...me.bench].filter((unit) => unit.hp <= 0).map((unit) => unit.instanceId);
  } else if (targetMode === "enemy") {
    validTargetIds = getValidTargets(targetingState, actorInstanceId, "skill", copiedAbilityKey);
  } else if (targetMode === "ally") {
    validTargetIds = [...me.units, ...me.bench].filter((unit) => unit.hp > 0).map((unit) => unit.instanceId);
  } else if (targetMode === "any") {
    const allyTargets = [...me.units, ...me.bench].filter((unit) => unit.hp > 0).map((unit) => unit.instanceId);
    const enemyTargets = getValidTargets(targetingState, actorInstanceId, "skill", copiedAbilityKey);
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
