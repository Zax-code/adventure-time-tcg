// Action validation for combat

import {
  Action,
  CopyAction,
  BattleState,
  TargetingBattleState,
  TargetingPlayerState,
  TargetingUnitState,
  UnitState,
  PlayerState,
  ValidationResult,
} from "./types";
import {
  hasStatus,
  hasSummoningSickness,
  isSilenced,
  findTaunter,
  isStealthed,
} from "./effects";
import { getAbilityDefinition } from "./abilities";
import { getAbilityTarget, requiresTargetSelection } from "./targeting";

/**
 * Get the current player from battle state
 */
export function getCurrentPlayer(state: BattleState): PlayerState {
  return state.players.find((p) => p.userId === state.currentPlayerId)!;
}

/**
 * Get the opponent player from battle state
 */
export function getOpponent(state: BattleState): PlayerState {
  return state.players.find((p) => p.userId !== state.currentPlayerId)!;
}

export function getKoAllies(player: PlayerState): UnitState[] {
  return [...player.units, ...player.bench].filter((u) => u.hp <= 0);
}

function getTargetingCurrentPlayer(
  state: TargetingBattleState,
): TargetingPlayerState {
  return state.players.find((p) => p.userId === state.currentPlayerId)!;
}

function getTargetingOpponent(
  state: TargetingBattleState,
): TargetingPlayerState {
  return state.players.find((p) => p.userId !== state.currentPlayerId)!;
}

function getKoTargetingAllies(
  player: TargetingPlayerState,
): TargetingUnitState[] {
  return [...player.units, ...player.bench].filter((u) => u.hp <= 0);
}

function hasTargetingStatus(
  unit: TargetingUnitState,
  statusName: string,
): boolean {
  return unit.statuses.some((status) => status.name === statusName);
}

function isTargetingStealthed(unit: TargetingUnitState): boolean {
  return hasTargetingStatus(unit, "Stealth");
}

function findTargetingTaunter(
  enemies: TargetingUnitState[],
): TargetingUnitState | undefined {
  return enemies.find((unit) => unit.hp > 0 && hasTargetingStatus(unit, "Taunt"));
}

/**
 * Find a unit by instance ID across both players
 */
export function findUnit(
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

/**
 * Find unit owner
 */
export function findUnitOwner(
  state: BattleState,
  instanceId: string,
): PlayerState | undefined {
  for (const player of state.players) {
    const unit = [...player.units, ...player.bench].find(
      (u) => u.instanceId === instanceId,
    );
    if (unit) return player;
  }
  return undefined;
}

/**
 * Check if a unit belongs to the current player
 */
export function isOwnUnit(state: BattleState, instanceId: string): boolean {
  const currentPlayer = getCurrentPlayer(state);
  return [...currentPlayer.units, ...currentPlayer.bench].some(
    (u) => u.instanceId === instanceId,
  );
}

/**
 * Check if a unit is an enemy
 */
export function isEnemyUnit(state: BattleState, instanceId: string): boolean {
  const opponent = getOpponent(state);
  return [...opponent.units, ...opponent.bench].some(
    (u) => u.instanceId === instanceId,
  );
}

/**
 * Get energy cost for an action
 */
export function getActionEnergyCost(
  action: Action,
  actor: UnitState,
  state: BattleState,
): number {
  let baseCost = 0;

  switch (action.kind) {
    case "basic":
      baseCost = 1;
      // Haste: first basic attack is free
      if (
        hasStatus(actor, "Haste") &&
        !getCurrentPlayer(state).hasUsedFreeBasic
      ) {
        baseCost = 0;
      }
      break;
    case "skill":
      const skillDef = getAbilityDefinition(
        action.abilityKey,
        state.abilityDefinitions,
      );
      baseCost = skillDef?.cost ?? 2;
      break;
    case "ultimate":
      const ultDef = getAbilityDefinition(
        action.abilityKey,
        state.abilityDefinitions,
      );
      baseCost = ultDef?.cost ?? 3;
      break;
    case "swap":
      baseCost = 0;
      break;
    case "pass":
      baseCost = 0;
      break;
    case "copy": {
      const copyDef = getAbilityDefinition(
        action.abilityKey,
        state.abilityDefinitions,
      );
      baseCost = copyDef?.cost ?? 2;
      break;
    }
  }

  // Stunned: next basic/skill/ultimate/copy costs +1 Energy.
  if (
    hasStatus(actor, "Stunned") &&
    (action.kind === "basic" ||
      action.kind === "skill" ||
      action.kind === "ultimate" ||
      action.kind === "copy")
  ) {
    baseCost += 1;
  }

  return baseCost;
}

/**
 * Validate a basic attack action
 */
export function validateBasicAttack(
  state: BattleState,
  actorInstanceId: string,
  targetInstanceId: string,
): ValidationResult {
  const currentPlayer = getCurrentPlayer(state);
  const opponent = getOpponent(state);

  // Check actor exists and belongs to current player
  const actor = currentPlayer.units.find(
    (u) => u.instanceId === actorInstanceId,
  );
  if (!actor) {
    return { valid: false, error: "Actor not found or not active" };
  }

  // Check actor is alive
  if (actor.hp <= 0) {
    return { valid: false, error: "Actor is KO'd" };
  }

  // Check summoning sickness
  if (hasSummoningSickness(actor)) {
    return { valid: false, error: "Actor has summoning sickness" };
  }

  // Check target exists and is enemy
  const target = opponent.units.find((u) => u.instanceId === targetInstanceId);
  if (!target) {
    return { valid: false, error: "Target not found or not active enemy" };
  }

  // Check target is alive
  if (target.hp <= 0) {
    return { valid: false, error: "Target is already KO'd" };
  }
  if (isStealthed(target)) {
    return { valid: false, error: "Target is stealthed" };
  }

  // Check Taunt restriction
  const taunter = findTaunter(opponent.units);
  if (taunter && taunter.instanceId !== targetInstanceId) {
    return { valid: false, error: "Must target the unit with Taunt" };
  }

  // Check energy
  const cost = getActionEnergyCost(
    { kind: "basic", actorInstanceId, targetInstanceId },
    actor,
    state,
  );
  if (currentPlayer.energy < cost) {
    return {
      valid: false,
      error: `Not enough energy (need ${cost}, have ${currentPlayer.energy})`,
    };
  }

  return { valid: true };
}

/**
 * Validate a skill action
 */
export function validateSkill(
  state: BattleState,
  actorInstanceId: string,
  targetInstanceId: string | undefined,
  abilityKey: string,
): ValidationResult {
  const currentPlayer = getCurrentPlayer(state);
  const opponent = getOpponent(state);

  // Check actor exists and belongs to current player
  const actor = currentPlayer.units.find(
    (u) => u.instanceId === actorInstanceId,
  );
  if (!actor) {
    return { valid: false, error: "Actor not found or not active" };
  }

  // Check actor is alive
  if (actor.hp <= 0) {
    return { valid: false, error: "Actor is KO'd" };
  }

  // Check summoning sickness
  if (hasSummoningSickness(actor)) {
    return { valid: false, error: "Actor has summoning sickness" };
  }

  // Check silence
  if (isSilenced(actor)) {
    return { valid: false, error: "Actor is silenced" };
  }

  // Check actor has this skill
  if (actor.skill !== abilityKey) {
    return { valid: false, error: "Actor does not have this skill" };
  }

  // Check cooldown
  const cooldownRemaining = actor.cooldowns[abilityKey] ?? 0;
  if (cooldownRemaining > 0) {
    return {
      valid: false,
      error: `Skill on cooldown (${cooldownRemaining} turns remaining)`,
    };
  }

  // Get ability definition
  const abilityDef = getAbilityDefinition(abilityKey, state.abilityDefinitions);
  if (!abilityDef) {
    return { valid: false, error: "Unknown ability" };
  }

  // Determine if target is required and validate
  const payload = abilityDef.payload;
  const targetMode = getAbilityTarget(payload);

  if (requiresTargetSelection(payload) && !targetInstanceId) {
    return { valid: false, error: "Target is required" };
  }

  if (targetInstanceId) {
    if (payload.revivePct) {
      const target = getKoAllies(currentPlayer).find(
        (u) => u.instanceId === targetInstanceId,
      );
      if (!target) {
        return { valid: false, error: "Target is not a KO'd ally" };
      }
    } else if (targetMode === "enemy") {
      const target = opponent.units.find(
        (u) => u.instanceId === targetInstanceId,
      );
      if (!target) {
        return { valid: false, error: "Target not found or not active enemy" };
      }
      if (target.hp <= 0) {
        return { valid: false, error: "Target is already KO'd" };
      }
      if (isStealthed(target)) {
        return { valid: false, error: "Target is stealthed" };
      }

      // Check Taunt restriction
      const taunter = findTaunter(opponent.units);
      if (taunter && taunter.instanceId !== targetInstanceId) {
        return { valid: false, error: "Must target the unit with Taunt" };
      }
    } else if (targetMode === "ally") {
      const target = [...currentPlayer.units, ...currentPlayer.bench].find(
        (u) => u.instanceId === targetInstanceId,
      );
      if (!target) {
        return { valid: false, error: "Target not found or not an ally" };
      }
      if (target.hp <= 0) {
        return { valid: false, error: "Target is KO'd" };
      }
    } else if (targetMode === "any") {
      const allyTarget = [...currentPlayer.units, ...currentPlayer.bench].find(
        (u) => u.instanceId === targetInstanceId,
      );
      const enemyTarget = opponent.units.find(
        (u) => u.instanceId === targetInstanceId,
      );
      if (!allyTarget && !enemyTarget) {
        return { valid: false, error: "Target not found" };
      }
      if (enemyTarget) {
        if (enemyTarget.hp <= 0) {
          return { valid: false, error: "Target is already KO'd" };
        }
        if (isStealthed(enemyTarget)) {
          return { valid: false, error: "Target is stealthed" };
        }
        const taunter = findTaunter(opponent.units);
        if (taunter && taunter.instanceId !== targetInstanceId) {
          return { valid: false, error: "Must target the unit with Taunt" };
        }
      } else if (allyTarget && allyTarget.hp <= 0) {
        return { valid: false, error: "Target is KO'd" };
      }
    }
  }

  // Check energy
  const cost = getActionEnergyCost(
    { kind: "skill", actorInstanceId, targetInstanceId, abilityKey },
    actor,
    state,
  );
  if (currentPlayer.energy < cost) {
    return {
      valid: false,
      error: `Not enough energy (need ${cost}, have ${currentPlayer.energy})`,
    };
  }

  return { valid: true };
}

/**
 * Validate an ultimate action
 */
export function validateUltimate(
  state: BattleState,
  actorInstanceId: string,
  targetInstanceId: string | undefined,
  abilityKey: string,
): ValidationResult {
  const currentPlayer = getCurrentPlayer(state);
  const opponent = getOpponent(state);

  // Check actor exists and belongs to current player
  const actor = currentPlayer.units.find(
    (u) => u.instanceId === actorInstanceId,
  );
  if (!actor) {
    return { valid: false, error: "Actor not found or not active" };
  }

  // Check actor is alive
  if (actor.hp <= 0) {
    return { valid: false, error: "Actor is KO'd" };
  }

  // Check summoning sickness
  if (hasSummoningSickness(actor)) {
    return { valid: false, error: "Actor has summoning sickness" };
  }

  // Check silence
  if (isSilenced(actor)) {
    return { valid: false, error: "Actor is silenced" };
  }

  // Check actor has this ultimate
  if (actor.ultimate !== abilityKey) {
    return { valid: false, error: "Actor does not have this ultimate" };
  }

  // Check if already used
  if (actor.usedUltimate) {
    return { valid: false, error: "Ultimate already used this match" };
  }

  // Get ability definition
  const abilityDef = getAbilityDefinition(abilityKey, state.abilityDefinitions);
  if (!abilityDef) {
    return { valid: false, error: "Unknown ability" };
  }

  // Determine if target is required and validate
  const payload = abilityDef.payload;
  const targetMode = getAbilityTarget(payload);

  if (requiresTargetSelection(payload) && !targetInstanceId) {
    return { valid: false, error: "Target is required" };
  }

  if (targetInstanceId) {
    if (payload.revivePct) {
      // Revive targets KO'd allies from active or bench.
      const target = getKoAllies(currentPlayer).find(
        (u) => u.instanceId === targetInstanceId,
      );
      if (!target) {
        return { valid: false, error: "Target is not a KO'd ally" };
      }
    } else if (targetMode === "enemy") {
      const target = opponent.units.find(
        (u) => u.instanceId === targetInstanceId,
      );
      if (!target) {
        return { valid: false, error: "Target not found or not active enemy" };
      }
      if (target.hp <= 0) {
        return { valid: false, error: "Target is already KO'd" };
      }
      if (isStealthed(target)) {
        return { valid: false, error: "Target is stealthed" };
      }

      // Check Taunt restriction for single-enemy targeting.
      const taunter = findTaunter(opponent.units);
      if (taunter && taunter.instanceId !== targetInstanceId) {
        return { valid: false, error: "Must target the unit with Taunt" };
      }
    } else if (targetMode === "ally") {
      const target = [...currentPlayer.units, ...currentPlayer.bench].find(
        (u) => u.instanceId === targetInstanceId,
      );
      if (!target) {
        return { valid: false, error: "Target not found or not an ally" };
      }
      if (target.hp <= 0) {
        return { valid: false, error: "Target is KO'd" };
      }
    } else if (targetMode === "any") {
      const allyTarget = [...currentPlayer.units, ...currentPlayer.bench].find(
        (u) => u.instanceId === targetInstanceId,
      );
      const enemyTarget = opponent.units.find(
        (u) => u.instanceId === targetInstanceId,
      );
      if (!allyTarget && !enemyTarget) {
        return { valid: false, error: "Target not found" };
      }
      if (enemyTarget) {
        if (enemyTarget.hp <= 0) {
          return { valid: false, error: "Target is already KO'd" };
        }
        if (isStealthed(enemyTarget)) {
          return { valid: false, error: "Target is stealthed" };
        }
        const taunter = findTaunter(opponent.units);
        if (taunter && taunter.instanceId !== targetInstanceId) {
          return { valid: false, error: "Must target the unit with Taunt" };
        }
      } else if (allyTarget && allyTarget.hp <= 0) {
        return { valid: false, error: "Target is KO'd" };
      }
    }
  }

  // Check energy
  const cost = getActionEnergyCost(
    { kind: "ultimate", actorInstanceId, targetInstanceId, abilityKey },
    actor,
    state,
  );
  if (currentPlayer.energy < cost) {
    return {
      valid: false,
      error: `Not enough energy (need ${cost}, have ${currentPlayer.energy})`,
    };
  }

  return { valid: true };
}

/**
 * Validate a swap action
 */
export function validateSwap(
  state: BattleState,
  activeInstanceId: string,
  benchInstanceId: string,
): ValidationResult {
  const currentPlayer = getCurrentPlayer(state);

  // Check active unit exists
  const activeUnit = currentPlayer.units.find(
    (u) => u.instanceId === activeInstanceId,
  );
  if (!activeUnit) {
    return { valid: false, error: "Active unit not found" };
  }

  // Active unit must be alive (can't swap out a KO'd unit)
  if (activeUnit.hp <= 0) {
    return { valid: false, error: "Cannot swap a KO'd unit" };
  }

  // Check bench unit exists
  const benchUnit = currentPlayer.bench.find(
    (u) => u.instanceId === benchInstanceId,
  );
  if (!benchUnit) {
    return { valid: false, error: "Bench unit not found" };
  }

  // Bench unit must be alive
  if (benchUnit.hp <= 0) {
    return { valid: false, error: "Cannot swap in a KO'd unit" };
  }

  return { valid: true };
}

/**
 * Validate a copy action
 */
export function validateCopy(
  state: BattleState,
  action: CopyAction,
): ValidationResult {
  const currentPlayer = getCurrentPlayer(state);
  const opponent = getOpponent(state);

  // Actor: must be active, alive, not summoning sick, not silenced
  const actor = currentPlayer.units.find(
    (u) => u.instanceId === action.actorInstanceId,
  );
  if (!actor || actor.hp <= 0) {
    return { valid: false, error: "Actor not found or KO'd" };
  }
  if (hasSummoningSickness(actor)) {
    return { valid: false, error: "Actor has summoning sickness" };
  }
  if (isSilenced(actor)) {
    return { valid: false, error: "Actor is silenced" };
  }

  // Copy ability key must be actor's skill or ultimate
  const isSkillCopy = actor.skill === action.abilityKey;
  const isUltimateCopy = actor.ultimate === action.abilityKey;
  if (!isSkillCopy && !isUltimateCopy) {
    return { valid: false, error: "Actor does not have this copy ability" };
  }

  // Cooldown / once-per-match check on the COPY ABILITY itself
  if (isSkillCopy && (actor.cooldowns[action.abilityKey] ?? 0) > 0) {
    return { valid: false, error: "Copy ability is on cooldown" };
  }
  if (isUltimateCopy && actor.usedUltimate) {
    return { valid: false, error: "Copy ultimate already used this match" };
  }

  // Get copy ability definition
  const copyAbilityDef = getAbilityDefinition(
    action.abilityKey,
    state.abilityDefinitions,
  );
  if (!copyAbilityDef?.payload.copyAbilityType) {
    return { valid: false, error: "Ability is not a copy ability" };
  }
  const copyAbilityType = copyAbilityDef.payload.copyAbilityType;
  const copyAbilitySource =
    copyAbilityDef.payload.copyAbilitySource ?? "either";

  // Source unit: must be active (not benched), alive, on correct team
  const allActiveUnits = [...currentPlayer.units, ...opponent.units];
  const sourceUnit = allActiveUnits.find(
    (u) => u.instanceId === action.sourceInstanceId,
  );
  if (!sourceUnit || sourceUnit.hp <= 0) {
    return { valid: false, error: "Source unit is not available" };
  }
  if (sourceUnit.instanceId === actor.instanceId) {
    return { valid: false, error: "Cannot copy from self" };
  }

  const sourceIsEnemy = opponent.units.some(
    (u) => u.instanceId === action.sourceInstanceId,
  );
  if (copyAbilitySource === "enemy" && !sourceIsEnemy) {
    return { valid: false, error: "Can only copy from enemies" };
  }
  if (copyAbilitySource === "ally" && sourceIsEnemy) {
    return { valid: false, error: "Can only copy from allies" };
  }

  // Get copied ability definition from the source
  const copiedKey =
    copyAbilityType === "SKILL" ? sourceUnit.skill : sourceUnit.ultimate;
  const copiedAbilityDef = getAbilityDefinition(
    copiedKey,
    state.abilityDefinitions,
  );
  if (!copiedAbilityDef) {
    return { valid: false, error: "Copied ability definition not found" };
  }
  const copiedPayload = copiedAbilityDef.payload;

  // Validate target using the COPIED ability's targeting rules
  const copiedTargetMode = getAbilityTarget(copiedPayload);
  if (requiresTargetSelection(copiedPayload) && !action.targetInstanceId) {
    return { valid: false, error: "Target is required" };
  }
  if (action.targetInstanceId) {
    if (copiedPayload.revivePct) {
      const target = getKoAllies(currentPlayer).find(
        (u) => u.instanceId === action.targetInstanceId,
      );
      if (!target) {
        return { valid: false, error: "Invalid revive target" };
      }
    } else if (copiedTargetMode === "enemy") {
      const target = opponent.units.find(
        (u) => u.instanceId === action.targetInstanceId,
      );
      if (!target || target.hp <= 0) {
        return { valid: false, error: "Invalid enemy target" };
      }
      if (isStealthed(target)) {
        return { valid: false, error: "Target is stealthed" };
      }
      const visibleEnemies = opponent.units.filter(
        (u) => u.hp > 0 && !isStealthed(u),
      );
      const taunter = findTaunter(visibleEnemies);
      if (taunter && taunter.instanceId !== action.targetInstanceId) {
        return { valid: false, error: "Must target the unit with Taunt" };
      }
    } else if (copiedTargetMode === "ally") {
      const allAllyUnits = [...currentPlayer.units, ...currentPlayer.bench];
      const target = allAllyUnits.find(
        (u) => u.instanceId === action.targetInstanceId,
      );
      if (!target || target.hp <= 0) {
        return { valid: false, error: "Invalid ally target" };
      }
    } else if (copiedTargetMode === "any") {
      const allyTarget = [...currentPlayer.units, ...currentPlayer.bench].find(
        (u) => u.instanceId === action.targetInstanceId,
      );
      const enemyTarget = opponent.units.find(
        (u) => u.instanceId === action.targetInstanceId,
      );
      if (!allyTarget && !enemyTarget) {
        return { valid: false, error: "Target not found" };
      }
      if (enemyTarget) {
        if (enemyTarget.hp <= 0) {
          return { valid: false, error: "Invalid enemy target" };
        }
        if (isStealthed(enemyTarget)) {
          return { valid: false, error: "Target is stealthed" };
        }
        const visibleEnemies = opponent.units.filter(
          (u) => u.hp > 0 && !isStealthed(u),
        );
        const taunter = findTaunter(visibleEnemies);
        if (taunter && taunter.instanceId !== action.targetInstanceId) {
          return { valid: false, error: "Must target the unit with Taunt" };
        }
      } else if (allyTarget && allyTarget.hp <= 0) {
        return { valid: false, error: "Invalid ally target" };
      }
    }
  }

  // Energy check
  const cost = getActionEnergyCost(action, actor, state);
  if (currentPlayer.energy < cost) {
    return {
      valid: false,
      error: `Not enough energy (need ${cost}, have ${currentPlayer.energy})`,
    };
  }

  return { valid: true };
}

/**
 * Validate any action
 */
export function validateAction(
  state: BattleState,
  action: Action,
): ValidationResult {
  // Check game is still active
  if (state.phase !== "active") {
    return { valid: false, error: "Game has ended" };
  }

  switch (action.kind) {
    case "basic":
      return validateBasicAttack(
        state,
        action.actorInstanceId,
        action.targetInstanceId,
      );
    case "skill":
      return validateSkill(
        state,
        action.actorInstanceId,
        action.targetInstanceId,
        action.abilityKey,
      );
    case "ultimate":
      return validateUltimate(
        state,
        action.actorInstanceId,
        action.targetInstanceId,
        action.abilityKey,
      );
    case "swap":
      return validateSwap(
        state,
        action.activeInstanceId,
        action.benchInstanceId,
      );
    case "pass":
      return { valid: true };
    case "copy":
      return validateCopy(state, action);
    default:
      return { valid: false, error: "Unknown action type" };
  }
}

/**
 * Get all valid targets for an action type
 */
export function getValidTargets(
  state: TargetingBattleState,
  actorInstanceId: string,
  actionKind: "basic" | "skill" | "ultimate",
  abilityKey?: string,
): string[] {
  const currentPlayer = getTargetingCurrentPlayer(state);
  const opponent = getTargetingOpponent(state);

  const actor = currentPlayer.units.find(
    (u) => u.instanceId === actorInstanceId,
  );
  if (!actor || actor.hp <= 0) return [];

  if (actionKind === "basic") {
    // Basic attacks target enemies
    const visibleEnemies = opponent.units.filter(
      (u) => u.hp > 0 && !isTargetingStealthed(u),
    );
    const taunter = findTargetingTaunter(visibleEnemies);
    if (taunter) {
      return [taunter.instanceId];
    }
    return visibleEnemies.map((u) => u.instanceId);
  }

  if (actionKind === "skill" || actionKind === "ultimate") {
    if (!abilityKey) return [];
    const abilityDef = getAbilityDefinition(
      abilityKey,
      state.abilityDefinitions,
    );
    if (!abilityDef) return [];

    const payload = abilityDef.payload;
    const targetMode = getAbilityTarget(payload);

    // Revive targets KO'd allies from active or bench.
    if (payload.revivePct) {
      return getKoTargetingAllies(currentPlayer).map((u) => u.instanceId);
    }

    if (!requiresTargetSelection(payload)) {
      return [];
    }

    if (targetMode === "enemy") {
      const visibleEnemies = opponent.units.filter(
        (u) => u.hp > 0 && !isTargetingStealthed(u),
      );
      const taunter = findTargetingTaunter(visibleEnemies);
      if (taunter) {
        return [taunter.instanceId];
      }
      return visibleEnemies.map((u) => u.instanceId);
    }

    if (targetMode === "ally") {
      return [...currentPlayer.units, ...currentPlayer.bench]
        .filter((u) => u.hp > 0)
        .map((u) => u.instanceId);
    }

    if (targetMode === "any") {
      const allies = [...currentPlayer.units, ...currentPlayer.bench].filter(
        (u) => u.hp > 0,
      );
      const enemies = opponent.units.filter((u) => u.hp > 0 && !isTargetingStealthed(u));
      const taunter = findTargetingTaunter(enemies);
      const enemyTargets = taunter ? [taunter] : enemies;
      return [...allies, ...enemyTargets].map((u) => u.instanceId);
    }

    if (
      targetMode === "self" ||
      targetMode === "allAllies" ||
      targetMode === "allEnemies" ||
      targetMode === "all"
    ) {
      return [];
    }

    // Default: enemy targets
    return opponent.units
      .filter((u) => u.hp > 0 && !isTargetingStealthed(u))
      .map((u) => u.instanceId);
  }

  return [];
}

/**
 * Check if game has ended
 */
export function checkGameEnd(state: BattleState): {
  ended: boolean;
  winnerId?: string;
} {
  for (const player of state.players) {
    const allTeamKo = [...player.units, ...player.bench].every(
      (u) => u.hp <= 0,
    );
    if (allTeamKo) {
      const opponent = state.players.find((p) => p.userId !== player.userId)!;
      return { ended: true, winnerId: opponent.userId };
    }
  }
  return { ended: false };
}
