// Damage calculation for combat

import { UnitState, DamageContext, CombatEvent } from "./types";
import {
  getTypeMultiplier,
  getIncomingDamageModifier as getTypeIncomingModifier,
} from "./typeChart";
import {
  getAttackModifier,
  getDefenseModifier,
  getSpeedModifier,
  getIncomingDamageModifier as getStatusIncomingModifier,
  consumeShield,
  getShieldAmount,
} from "./effects";
import { SeededRng } from "./rng";

// Constants
const BASE_CRIT_CHANCE = 0.1; // 10%
const CRIT_MULTIPLIER = 1.5;
const BASE_DAMAGE_SCALAR = 0.6;
const BASE_MISS_CHANCE = 0.05;
const SPEED_TO_MISS_CHANCE = 0.004;
const SPEED_TO_CRIT_CHANCE = 0.002;
const MIN_MISS_CHANCE = 0.02;
const MAX_MISS_CHANCE = 0.45;
const MIN_CRIT_CHANCE = 0.0;
const MAX_CRIT_CHANCE = 0.35;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function getEffectiveSpeed(unit: UnitState): number {
  const speedMod = getSpeedModifier(unit);
  return Math.max(1, Math.floor(unit.speed * speedMod));
}

function calculateBaseDamage(effectiveAttack: number, effectiveDefense: number): number {
  // Ratio-based mitigation avoids frequent 1-damage hits when stats are close.
  const denominator = Math.max(1, effectiveAttack + effectiveDefense);
  const rawDamage =
    (effectiveAttack * effectiveAttack * BASE_DAMAGE_SCALAR) / denominator;
  return Math.max(1, Math.floor(rawDamage));
}

function calculateSpeedDrivenChances(
  attacker: UnitState,
  target: UnitState,
  bonusCritChance: number,
  legacyMissChanceBonus: number,
): { hitChance: number; missChance: number; critChance: number } {
  const attackerSpeed = getEffectiveSpeed(attacker);
  const targetSpeed = getEffectiveSpeed(target);
  const speedDelta = targetSpeed - attackerSpeed;

  // Faster defenders evade more often; slower defenders evade less.
  const missChance = clamp(
    BASE_MISS_CHANCE + speedDelta * SPEED_TO_MISS_CHANCE + legacyMissChanceBonus,
    MIN_MISS_CHANCE,
    MAX_MISS_CHANCE,
  );
  const hitChance = 1 - missChance;

  // Defender speed suppresses attacker crit chance; attacker speed improves it.
  const critChance = clamp(
    (BASE_CRIT_CHANCE + bonusCritChance - speedDelta * SPEED_TO_CRIT_CHANCE) *
      hitChance,
    MIN_CRIT_CHANCE,
    MAX_CRIT_CHANCE,
  );

  return { hitChance, missChance, critChance };
}

/**
 * Calculate damage for an attack
 */
export function calculateDamage(
  attacker: UnitState,
  target: UnitState,
  rng: SeededRng,
  options: {
    damageMul?: number;
    ignoreDefensePct?: number;
    bonusCritChance?: number;
    incomingDamageReductionPct?: number;
    missChance?: number; // legacy compatibility; treated as additive miss chance
    isBurnBonus?: boolean; // for abilities that deal more to burning targets
    burnBonusMul?: number;
  } = {},
): DamageContext {
  const {
    damageMul = 1.0,
    ignoreDefensePct = 0,
    bonusCritChance = 0,
    incomingDamageReductionPct = 0,
    missChance = 0,
    isBurnBonus = false,
    burnBonusMul = 0,
  } = options;

  // Get effective attack (with status modifiers)
  const attackMod = getAttackModifier(attacker);
  const effectiveAttack = Math.floor(attacker.attack * attackMod);

  // Get effective defense (with status modifiers and ignore defense)
  const defenseMod = getDefenseModifier(target);
  const effectiveDefense = Math.floor(
    target.defense * defenseMod * (1 - ignoreDefensePct),
  );

  // Base damage
  const baseDamage = calculateBaseDamage(effectiveAttack, effectiveDefense);

  // Type multiplier
  const typeMultiplier = getTypeMultiplier(attacker.type, target.type);

  // Incoming damage modifiers (type-specific + status-based)
  const typeIncomingMod = getTypeIncomingModifier(target.type, attacker.type);
  const statusIncomingMod = getStatusIncomingModifier(target);
  const buffDebuffMultiplier = typeIncomingMod * statusIncomingMod;

  // Speed-driven hit/evasion/crit checks.
  const { missChance: finalMissChance, critChance } = calculateSpeedDrivenChances(
    attacker,
    target,
    bonusCritChance,
    missChance,
  );
  const isMiss = rng.nextBool(finalMissChance);
  const isCrit = !isMiss && rng.nextBool(critChance);
  const critMultiplier = isCrit ? CRIT_MULTIPLIER : 1.0;

  // Calculate damage with ability multiplier
  let damage = Math.floor(
    baseDamage *
      damageMul *
      typeMultiplier *
      critMultiplier *
      buffDebuffMultiplier,
  );

  if (isMiss) {
    damage = 0;
  }

  if (incomingDamageReductionPct > 0) {
    damage = Math.floor(damage * (1 - incomingDamageReductionPct));
  }

  // Apply burn bonus if applicable
  if (isBurnBonus && burnBonusMul > 0) {
    const hasBurn = target.statuses.some((s) => s.name === "Burn");
    if (hasBurn) {
      damage = Math.floor(damage * (1 + burnBonusMul));
    }
  }

  // Ensure non-miss hits always deal at least 1 damage before shields.
  if (!isMiss) {
    damage = Math.max(1, damage);
  }

  // Shield absorption
  const shieldAbsorbed = consumeShield(target, damage);
  const actualDamage = damage - shieldAbsorbed;

  return {
    attacker,
    target,
    baseDamage,
    typeMultiplier,
    critMultiplier,
    buffDebuffMultiplier,
    ignoreDefensePct,
    isCrit,
    isMiss,
    incomingDamageReductionPct,
    finalDamage: damage,
    shieldAbsorbed,
    actualDamage,
  };
}

/**
 * Apply damage to a unit and return events
 */
export function applyDamage(
  target: UnitState,
  damage: number,
  attackerInstanceId: string,
  context: DamageContext,
  turn: number,
): {
  events: Partial<CombatEvent>[];
  isKo: boolean;
} {
  void turn;
  const events: Partial<CombatEvent>[] = [];

  // Shield absorption event
  if (context.shieldAbsorbed > 0) {
    events.push({
      type: "shieldAbsorb",
      payload: {
        targetId: target.instanceId,
        absorbed: context.shieldAbsorbed,
        remaining: getShieldAmount(target),
      },
    });
  }

  // Crit event
  if (context.isCrit) {
    events.push({
      type: "crit",
      payload: {
        attackerId: attackerInstanceId,
        targetId: target.instanceId,
      },
    });
  }

  // Apply damage
  const hpBefore = target.hp;
  target.hp = Math.max(0, target.hp - damage);

  // Damage event
  events.push({
    type: "damage",
    payload: {
      attackerId: attackerInstanceId,
      targetId: target.instanceId,
      damage: damage,
      hpBefore,
      hpAfter: target.hp,
      typeMultiplier: context.typeMultiplier,
      isCrit: context.isCrit,
      isMiss: context.isMiss,
      incomingDamageReductionPct: context.incomingDamageReductionPct,
      shieldAbsorbed: context.shieldAbsorbed,
    },
  });

  // KO check
  const isKo = target.hp <= 0;
  if (isKo) {
    events.push({
      type: "ko",
      payload: {
        unitId: target.instanceId,
        killerId: attackerInstanceId,
      },
    });
  }

  return { events, isKo };
}

/**
 * Apply healing to a unit
 */
export function applyHealing(
  target: UnitState,
  amount: number,
  sourceInstanceId: string,
): {
  actualHealing: number;
  event: Partial<CombatEvent>;
} {
  if (target.hp <= 0) {
    return {
      actualHealing: 0,
      event: { type: "heal", payload: { sourceId: sourceInstanceId, targetId: target.instanceId, amount: 0, hpBefore: target.hp, hpAfter: target.hp } },
    };
  }
  const hpBefore = target.hp;
  const maxHeal = target.maxHp - target.hp;
  const actualHealing = Math.min(amount, maxHeal);

  target.hp = Math.min(target.maxHp, target.hp + actualHealing);

  return {
    actualHealing,
    event: {
      type: "heal",
      payload: {
        sourceId: sourceInstanceId,
        targetId: target.instanceId,
        amount: actualHealing,
        hpBefore,
        hpAfter: target.hp,
      },
    },
  };
}

/**
 * Calculate splash damage (for abilities that hit adjacent targets)
 */
export function calculateSplashDamage(
  baseDamage: number,
  splashPct: number,
): number {
  return Math.floor(baseDamage * splashPct);
}

/**
 * Get adjacent positions for a given position
 */
export function getAdjacentPositions(position: 1 | 2 | 3): (1 | 2 | 3)[] {
  switch (position) {
    case 1:
      return [2];
    case 2:
      return [1, 3];
    case 3:
      return [2];
    default:
      return [];
  }
}

/**
 * Get units adjacent to a given unit
 */
export function getAdjacentUnits(
  unit: UnitState,
  allUnits: UnitState[],
): UnitState[] {
  if (!unit.position) return [];

  const adjacentPositions = getAdjacentPositions(unit.position);
  return allUnits.filter(
    (u) => u.position && adjacentPositions.includes(u.position) && u.hp > 0,
  );
}

/**
 * Apply Cover redirect (30% of single-target damage redirected to covering ally)
 */
export function applyCoverRedirect(
  target: UnitState,
  coverSource: UnitState,
  damage: number,
  rng: SeededRng,
): {
  targetDamage: number;
  redirectedDamage: number;
  events: Partial<CombatEvent>[];
} {
  void target;
  void coverSource;
  void rng;
  const redirectPct = 0.3;
  const redirectedDamage = Math.floor(damage * redirectPct);
  const targetDamage = damage - redirectedDamage;

  // Cover source takes redirected damage (after their own mitigation)
  // For simplicity, we apply raw damage to cover source
  const events: Partial<CombatEvent>[] = [];

  return {
    targetDamage,
    redirectedDamage,
    events,
  };
}

/**
 * Calculate lifesteal healing
 */
export function calculateLifesteal(
  damageDealt: number,
  lifestealPct: number,
): number {
  return Math.floor(damageDealt * lifestealPct);
}

/**
 * Preview damage without applying (for UI)
 */
export function previewDamage(
  attacker: UnitState,
  target: UnitState,
  options: {
    damageMul?: number;
    ignoreDefensePct?: number;
  } = {},
): {
  minDamage: number;
  maxDamage: number;
  avgDamage: number;
  typeMultiplier: number;
} {
  const { damageMul = 1.0, ignoreDefensePct = 0 } = options;

  // Get effective attack (with status modifiers)
  const attackMod = getAttackModifier(attacker);
  const effectiveAttack = Math.floor(attacker.attack * attackMod);

  // Get effective defense (with status modifiers and ignore defense)
  const defenseMod = getDefenseModifier(target);
  const effectiveDefense = Math.floor(
    target.defense * defenseMod * (1 - ignoreDefensePct),
  );

  // Base damage
  const baseDamage = calculateBaseDamage(effectiveAttack, effectiveDefense);

  // Type multiplier
  const typeMultiplier = getTypeMultiplier(attacker.type, target.type);

  // Incoming damage modifiers
  const typeIncomingMod = getTypeIncomingModifier(target.type, attacker.type);
  const statusIncomingMod = getStatusIncomingModifier(target);
  const buffDebuffMultiplier = typeIncomingMod * statusIncomingMod;
  const { hitChance, missChance, critChance } = calculateSpeedDrivenChances(
    attacker,
    target,
    0,
    0,
  );

  // Calculate min (no crit) and max (crit) damage
  const landedDamage = Math.floor(
    baseDamage * damageMul * typeMultiplier * 1.0 * buffDebuffMultiplier,
  );
  const critDamage = Math.floor(
    baseDamage *
      damageMul *
      typeMultiplier *
      CRIT_MULTIPLIER *
      buffDebuffMultiplier,
  );

  const clampedLandedDamage = Math.max(1, landedDamage);
  const clampedCritDamage = Math.max(1, critDamage);
  const clampedMinDamage = missChance > 0 ? 0 : clampedLandedDamage;
  const clampedMaxDamage = clampedCritDamage;

  // Average using speed-driven miss and crit chances.
  const normalHitChance = Math.max(0, hitChance - critChance);
  const avgDamage = Math.floor(
    normalHitChance * clampedLandedDamage + critChance * clampedCritDamage,
  );

  return {
    minDamage: clampedMinDamage,
    maxDamage: clampedMaxDamage,
    avgDamage,
    typeMultiplier,
  };
}
