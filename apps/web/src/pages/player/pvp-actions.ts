import type {
  PvpAction,
  PvpParticipantBattleState,
  PvpPlayerState,
  PvpUnitState,
} from "@adventure-time/api-client";
import {
  getAbilityTarget,
  getValidTargets,
  requiresTargetSelection,
  type AbilityDefinition as TargetingAbilityDefinition,
  type AbilityPayload,
  type StatusName,
  type TargetingBattleState,
  type TargetingPlayerState,
  type TargetingUnitState,
} from "@adventure-time/game-engine";

export type BattleActionSlot = "basic" | "skill" | "ultimate";
export type BattleActionKind = BattleActionSlot | "copy";

type AbilityDefinitions = NonNullable<
  PvpParticipantBattleState["abilityDefinitions"]
>;
type ApiAbilityDefinition = AbilityDefinitions[string];

export interface PreparedBattleAction {
  actionKind: BattleActionKind;
  actorInstanceId: string;
  abilityKey?: string;
  sourceInstanceId?: string;
  copiedAbilityKey?: string;
  stage: "target" | "copy-source";
  targetLabel: string;
  validTargetIds: string[];
  requiresTargetSelection: boolean;
}

export interface BattleActionOption {
  slot: BattleActionSlot;
  label: string;
  description: string;
  cost: number;
  prepared: PreparedBattleAction | null;
  disabledReason?: string;
}

const validStatusNames = new Set<StatusName>([
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

function hasStatus(unit: PvpUnitState, name: string) {
  return unit.statuses.some((status) => status.name === name);
}

function getMyPlayer(state: PvpParticipantBattleState) {
  return state.players.find((player) => player.userId === state.myUserId);
}

function getOpponent(state: PvpParticipantBattleState) {
  return state.players.find((player) => player.userId !== state.myUserId);
}

function getAbilityDefinition(
  state: PvpParticipantBattleState,
  abilityKey: string | null | undefined,
) {
  return abilityKey ? state.abilityDefinitions?.[abilityKey] : undefined;
}

function normalizeAbilityPayload(payload: unknown): AbilityPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  return payload as AbilityPayload;
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
      validStatusNames.has(status.name)
        ? [{
            ...status,
            name: status.name,
            magnitude: status.magnitude ?? undefined,
          }]
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
  definition: ApiAbilityDefinition,
): TargetingAbilityDefinition | null {
  const payload = normalizeAbilityPayload(definition.payload);
  if (!payload) return null;
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

function toTargetingBattleState(
  state: PvpParticipantBattleState,
): TargetingBattleState {
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
  state: PvpParticipantBattleState,
  abilityKey: string | null | undefined,
) {
  return normalizeAbilityPayload(getAbilityDefinition(state, abilityKey)?.payload);
}

function validTargetsForAbility(
  state: PvpParticipantBattleState,
  actorInstanceId: string,
  abilityKey: string,
) {
  return getValidTargets(
    toTargetingBattleState(state),
    actorInstanceId,
    "skill",
    abilityKey,
  );
}

function targetLabelForPayload(payload: AbilityPayload) {
  if (payload.revivePct !== undefined) return "a knocked-out ally to revive";

  const target = getAbilityTarget(payload);
  if (target === "self") return "self";
  if (target === "ally") return "a living ally (active or bench)";
  if (target === "enemy") return "a visible active enemy";
  if (target === "any") return "a living ally or visible enemy";
  if (target === "allAllies") return "all living allies";
  if (target === "allEnemies") return "all visible enemies";
  if (target === "allUnits" || target === "all") return "the whole field";
  return "a legal target";
}

function copiedAbilityKey(
  source: PvpUnitState,
  copyType: "SKILL" | "ULTIMATE",
) {
  return copyType === "SKILL" ? source.skill : source.ultimate;
}

function validCopySources(
  state: PvpParticipantBattleState,
  actorInstanceId: string,
  payload: AbilityPayload,
) {
  const me = getMyPlayer(state);
  const opponent = getOpponent(state);
  const copyType = payload.copyAbilityType;
  if (!me || !opponent || !copyType) return [];

  const sourceMode = payload.copyAbilitySource ?? "either";
  const candidates = [
    ...(sourceMode === "enemy" ? [] : me.units),
    ...(sourceMode === "ally" ? [] : opponent.units),
  ];

  return candidates.flatMap((unit) => {
    if (unit.hp <= 0 || unit.instanceId === actorInstanceId) return [];
    const abilityKey = copiedAbilityKey(unit, copyType);
    const copiedPayload = getAbilityPayload(state, abilityKey);
    if (!abilityKey || !copiedPayload) return [];
    if (
      requiresTargetSelection(copiedPayload) &&
      validTargetsForAbility(state, actorInstanceId, abilityKey).length === 0
    ) {
      return [];
    }
    return [unit.instanceId];
  });
}

export function prepareBattleAction(
  state: PvpParticipantBattleState,
  actorInstanceId: string,
  slot: BattleActionSlot,
): PreparedBattleAction | null {
  const me = getMyPlayer(state);
  const opponent = getOpponent(state);
  const actor = me?.units.find((unit) => unit.instanceId === actorInstanceId);
  if (!me || !opponent || !actor || actor.hp <= 0) return null;

  if (slot === "basic") {
    return {
      actionKind: "basic",
      actorInstanceId,
      stage: "target",
      targetLabel: "a visible active enemy",
      validTargetIds: getValidTargets(
        toTargetingBattleState(state),
        actorInstanceId,
        "basic",
      ),
      requiresTargetSelection: true,
    };
  }

  const abilityKey = slot === "skill" ? actor.skill : actor.ultimate;
  const payload = getAbilityPayload(state, abilityKey);
  if (!abilityKey || !payload) return null;

  if (payload.copyAbilityType) {
    const sourceMode = payload.copyAbilitySource ?? "either";
    return {
      actionKind: "copy",
      actorInstanceId,
      abilityKey,
      stage: "copy-source",
      targetLabel:
        sourceMode === "ally"
          ? "an active ally to copy"
          : sourceMode === "enemy"
            ? "an active enemy to copy"
            : "an active ally or enemy to copy",
      validTargetIds: validCopySources(state, actorInstanceId, payload),
      requiresTargetSelection: true,
    };
  }

  return {
    actionKind: slot,
    actorInstanceId,
    abilityKey,
    stage: "target",
    targetLabel: targetLabelForPayload(payload),
    validTargetIds: getValidTargets(
      toTargetingBattleState(state),
      actorInstanceId,
      slot,
      abilityKey,
    ),
    requiresTargetSelection: requiresTargetSelection(payload),
  };
}

export function prepareCopyFollowUp(
  state: PvpParticipantBattleState,
  prepared: PreparedBattleAction,
  sourceInstanceId: string,
): PreparedBattleAction | null {
  if (
    prepared.actionKind !== "copy" ||
    prepared.stage !== "copy-source" ||
    !prepared.abilityKey ||
    !prepared.validTargetIds.includes(sourceInstanceId)
  ) {
    return null;
  }

  const copyPayload = getAbilityPayload(state, prepared.abilityKey);
  const copyType = copyPayload?.copyAbilityType;
  const source = state.players
    .flatMap((player) => player.units)
    .find((unit) => unit.instanceId === sourceInstanceId);
  if (!copyType || !source) return null;

  const abilityKey = copiedAbilityKey(source, copyType);
  const payload = getAbilityPayload(state, abilityKey);
  if (!abilityKey || !payload) return null;

  return {
    actionKind: "copy",
    actorInstanceId: prepared.actorInstanceId,
    abilityKey: prepared.abilityKey,
    sourceInstanceId,
    copiedAbilityKey: abilityKey,
    stage: "target",
    targetLabel: targetLabelForPayload(payload),
    validTargetIds: validTargetsForAbility(
      state,
      prepared.actorInstanceId,
      abilityKey,
    ),
    requiresTargetSelection: requiresTargetSelection(payload),
  };
}

export function buildPvpAction(
  prepared: PreparedBattleAction,
  targetInstanceId?: string,
): PvpAction | null {
  if (prepared.stage === "copy-source") return null;
  if (
    prepared.requiresTargetSelection &&
    (!targetInstanceId || !prepared.validTargetIds.includes(targetInstanceId))
  ) {
    return null;
  }

  if (prepared.actionKind === "basic") {
    return targetInstanceId
      ? {
          kind: "basic",
          actorInstanceId: prepared.actorInstanceId,
          targetInstanceId,
        }
      : null;
  }

  if (
    prepared.actionKind === "skill" ||
    prepared.actionKind === "ultimate"
  ) {
    if (!prepared.abilityKey) return null;
    return {
      kind: prepared.actionKind,
      actorInstanceId: prepared.actorInstanceId,
      abilityKey: prepared.abilityKey,
      ...(targetInstanceId ? { targetInstanceId } : {}),
    };
  }

  if (!prepared.abilityKey || !prepared.sourceInstanceId) return null;
  return {
    kind: "copy",
    actorInstanceId: prepared.actorInstanceId,
    abilityKey: prepared.abilityKey,
    sourceInstanceId: prepared.sourceInstanceId,
    ...(targetInstanceId ? { targetInstanceId } : {}),
  };
}

function commonActorBlockReason(unit: PvpUnitState) {
  if (unit.hp <= 0 || unit.knockedOut) return "This unit is knocked out.";
  if (hasStatus(unit, "SummoningSickness")) {
    return "This unit has summoning sickness.";
  }
  return undefined;
}

function actionCost(
  state: PvpParticipantBattleState,
  actor: PvpUnitState,
  definition?: ApiAbilityDefinition,
) {
  const me = getMyPlayer(state);
  const freeBasic = hasStatus(actor, "Haste") && !me?.hasUsedFreeBasic;
  const base = definition ? definition.cost : freeBasic ? 0 : 1;
  return base + (hasStatus(actor, "Stunned") ? 1 : 0);
}

export function getBattleActionOptions(
  state: PvpParticipantBattleState,
  actorInstanceId: string | undefined,
): BattleActionOption[] {
  const me = getMyPlayer(state);
  const actor = me?.units.find((unit) => unit.instanceId === actorInstanceId);
  if (!me || !actor) return [];

  const slots: BattleActionSlot[] = ["basic"];
  if (actor.skill) slots.push("skill");
  if (actor.ultimate) slots.push("ultimate");

  return slots.map((slot) => {
    const abilityKey =
      slot === "skill"
        ? actor.skill
        : slot === "ultimate"
          ? actor.ultimate
          : undefined;
    const definition = getAbilityDefinition(state, abilityKey);
    const prepared = prepareBattleAction(state, actor.instanceId, slot);
    const cost = actionCost(state, actor, definition);
    let disabledReason = commonActorBlockReason(actor);

    if (!disabledReason && slot !== "basic") {
      if (!definition?.payload) {
        disabledReason = "This ability definition is unavailable.";
      } else if (hasStatus(actor, "Silence")) {
        disabledReason = "This unit is silenced.";
      } else if ((actor.cooldowns[abilityKey ?? ""] ?? 0) > 0) {
        const turns = actor.cooldowns[abilityKey ?? ""];
        disabledReason = `On cooldown for ${turns} more turn${turns === 1 ? "" : "s"}.`;
      } else if (slot === "ultimate" && actor.usedUltimate) {
        disabledReason = "This ultimate was already used.";
      }
    }

    if (!disabledReason && me.energy < cost) {
      disabledReason = `Needs ${cost} energy; ${me.energy} available.`;
    }
    if (
      !disabledReason &&
      prepared?.requiresTargetSelection &&
      prepared.validTargetIds.length === 0
    ) {
      disabledReason = "No legal target is available.";
    }
    if (!disabledReason && !prepared) {
      disabledReason = "This action is not available.";
    }

    return {
      slot,
      label:
        slot === "basic"
          ? "Basic attack"
          : definition?.name ?? (slot === "skill" ? "Skill" : "Ultimate"),
      description:
        slot === "basic"
          ? "Strike one legal enemy."
          : definition?.description ?? "Ability details are unavailable.",
      cost,
      prepared,
      ...(disabledReason ? { disabledReason } : {}),
    };
  });
}
