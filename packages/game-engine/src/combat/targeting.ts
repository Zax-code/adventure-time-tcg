import type {
  AbilityPayload,
  AbilityTarget,
  AbilityTargetSelector,
  BattleState,
  PlayerState,
  UnitState,
} from "./types";
import { isBuffStatus, isDebuffStatus, isStealthed, findTaunter } from "./effects";

export function getAbilityTarget(payload: AbilityPayload): AbilityTarget {
  if (payload.target) return payload.target;
  if (payload.affectsAllEnemies) return "allEnemies";
  if (payload.affectsAllAllies) return "allAllies";
  if (payload.cleanse && typeof payload.cleanse === "object") {
    const target = payload.cleanse.target;
    if (target === "allEnemies") return "allEnemies";
    if (target === "allAllies") return "allAllies";
    if (target === "self") return "self";
    if (target === "ally") return "ally";
  }
  if (payload.shieldTarget === "allAllies") return "allAllies";
  if (payload.shieldTarget === "self") return "self";
  if (payload.revivePct !== undefined) return "ally";
  if (payload.damageMul !== undefined || payload.swapHpPercentages) return "enemy";
  if (
    payload.healPctOfMaxHp !== undefined ||
    payload.shieldPctOfMaxHp !== undefined ||
    payload.healLowestAllyPctOfDamage !== undefined ||
    payload.healLowestHpAllyPctOfMaxHp !== undefined
  ) {
    return "ally";
  }
  if (payload.applyStatuses && payload.applyStatuses.length > 0) {
    const hasDebuff = payload.applyStatuses.some((s) => isDebuffStatus(s.name));
    const hasBuff = payload.applyStatuses.some((s) => isBuffStatus(s.name));
    if (hasDebuff && !hasBuff) return "enemy";
    if (hasBuff && !hasDebuff) return "ally";
  }
  return "enemy";
}

export function targetNeedsSelection(target: AbilityTarget): boolean {
  return target === "ally" || target === "enemy" || target === "any";
}

export function requiresTargetSelection(payload: AbilityPayload): boolean {
  const targetMode = getAbilityTarget(payload);
  if (!targetNeedsSelection(targetMode)) return false;
  return !payload.targetSelector;
}

export function getTargetUnits(
  state: BattleState,
  actor: UnitState,
  target: AbilityTarget,
  targetInstanceId?: string,
): UnitState[] {
  const currentPlayer = getCurrentPlayer(state);
  const opponent = getOpponent(state);

  switch (target) {
    case "self":
      return [actor];
    case "allAllies":
      return currentPlayer.units.filter((u) => u.hp > 0);
    case "allEnemies":
      return opponent.units.filter((u) => u.hp > 0);
    case "all":
      return [
        ...currentPlayer.units.filter((u) => u.hp > 0),
        ...opponent.units.filter((u) => u.hp > 0),
      ];
    case "enemy": {
      if (targetInstanceId) {
        const unit = opponent.units.find((u) => u.instanceId === targetInstanceId);
        return unit ? [unit] : [];
      }
      return [];
    }
    case "ally": {
      if (targetInstanceId) {
        const unit = [...currentPlayer.units, ...currentPlayer.bench].find(
          (u) => u.instanceId === targetInstanceId,
        );
        return unit ? [unit] : [];
      }
      return [];
    }
    case "any": {
      if (targetInstanceId) {
        const unit = findUnitById(state, targetInstanceId);
        return unit ? [unit] : [];
      }
      return [];
    }
    default:
      return [];
  }
}

export function getEffectiveTargetUnits(
  state: BattleState,
  actor: UnitState,
  payload: AbilityPayload,
  targetInstanceId?: string,
): UnitState[] {
  const targetMode = getAbilityTarget(payload);
  const baseTargets = getTargetUnits(state, actor, targetMode, targetInstanceId);
  if (baseTargets.length > 0) return baseTargets;
  if (payload.targetSelector) {
    return getContextualTargetUnits(state, actor, targetMode, payload.targetSelector);
  }
  return [];
}

export function getContextualTargetUnits(
  state: BattleState,
  actor: UnitState,
  target: AbilityTarget,
  selector: AbilityTargetSelector | undefined,
): UnitState[] {
  if (!selector) return [];
  const currentPlayer = getCurrentPlayer(state);
  const opponent = getOpponent(state);
  let candidates: UnitState[] = [];

  if (target === "ally") {
    candidates = [...currentPlayer.units, ...currentPlayer.bench].filter(
      (u) => u.hp > 0,
    );
  } else if (target === "enemy") {
    const visibleEnemies = opponent.units.filter(
      (u) => u.hp > 0 && !isStealthed(u),
    );
    const taunter = findTaunter(visibleEnemies);
    candidates = taunter ? [taunter] : visibleEnemies;
  } else if (target === "any") {
    candidates = [
      ...currentPlayer.units.filter((u) => u.hp > 0),
      ...opponent.units.filter((u) => u.hp > 0 && !isStealthed(u)),
    ];
  } else {
    return [];
  }

  if (candidates.length === 0) return [];

  const pick = (cmp: (a: UnitState, b: UnitState) => UnitState) =>
    candidates.reduce(cmp);

  switch (selector) {
    case "lowestHp":
      return [pick((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b))];
    case "highestHp":
      return [pick((a, b) => (a.hp / a.maxHp >= b.hp / b.maxHp ? a : b))];
    case "lowestAtk":
      return [pick((a, b) => (a.attack <= b.attack ? a : b))];
    case "highestAtk":
      return [pick((a, b) => (a.attack >= b.attack ? a : b))];
    case "lowestDef":
      return [pick((a, b) => (a.defense <= b.defense ? a : b))];
    case "highestDef":
      return [pick((a, b) => (a.defense >= b.defense ? a : b))];
    case "lowestSpd":
      return [pick((a, b) => (a.speed <= b.speed ? a : b))];
    case "highestSpd":
      return [pick((a, b) => (a.speed >= b.speed ? a : b))];
    default:
      return [];
  }
}

function getCurrentPlayer(state: BattleState): PlayerState {
  return state.players.find((p) => p.userId === state.currentPlayerId)!;
}

function getOpponent(state: BattleState): PlayerState {
  return state.players.find((p) => p.userId !== state.currentPlayerId)!;
}

export function findUnitById(
  state: BattleState,
  instanceId: string,
): UnitState | undefined {
  for (const player of state.players) {
    const unit = [...player.units, ...player.bench].find(
      (u) => u.instanceId === instanceId,
    );
    if (unit) return unit;
  }
  return undefined;
}

export function getEnemyTargetWithTaunt(
  state: BattleState,
  targetInstanceId?: string,
): UnitState | undefined {
  if (!targetInstanceId) return undefined;
  const opponent = getOpponent(state);
  const target = opponent.units.find((u) => u.instanceId === targetInstanceId);
  if (!target || target.hp <= 0) return undefined;
  if (isStealthed(target)) return undefined;
  const visibleEnemies = opponent.units.filter((u) => u.hp > 0 && !isStealthed(u));
  const taunter = findTaunter(visibleEnemies);
  if (taunter && taunter.instanceId !== targetInstanceId) return undefined;
  return target;
}
