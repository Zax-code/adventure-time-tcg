// Status effects system for combat
// Handles application, removal, and ticking of status effects

import { Status, StatusName, UnitState, CombatEvent } from "./types";

// Status effect definitions
interface StatusDefinition {
  name: StatusName;
  maxDuration: number;
  isBuff: boolean;
  isDebuff: boolean;
  stackable: boolean; // if false, refreshes duration instead
  ticksAtStartOfTurn: boolean;
  expiresAt?: "ownerTurnEnd";
}

const STATUS_DEFINITIONS: Record<StatusName, StatusDefinition> = {
  Burn: {
    name: "Burn",
    maxDuration: 2,
    isBuff: false,
    isDebuff: true,
    stackable: false,
    ticksAtStartOfTurn: true,
  },
  Freeze: {
    name: "Freeze",
    maxDuration: 1,
    isBuff: false,
    isDebuff: true,
    stackable: false,
    ticksAtStartOfTurn: false, // consumed when action is attempted
  },
  Shield: {
    name: "Shield",
    maxDuration: -1, // permanent until depleted
    isBuff: true,
    isDebuff: false,
    stackable: true, // shields stack in magnitude
    ticksAtStartOfTurn: false,
  },
  GuardUp: {
    name: "GuardUp",
    maxDuration: 2,
    isBuff: true,
    isDebuff: false,
    stackable: false,
    ticksAtStartOfTurn: true,
  },
  Vulnerable: {
    name: "Vulnerable",
    maxDuration: 1,
    isBuff: false,
    isDebuff: true,
    stackable: false,
    ticksAtStartOfTurn: true,
  },
  Weakened: {
    name: "Weakened",
    maxDuration: 2,
    isBuff: false,
    isDebuff: true,
    stackable: false,
    ticksAtStartOfTurn: true,
  },
  Haste: {
    name: "Haste",
    maxDuration: 2,
    isBuff: true,
    isDebuff: false,
    stackable: false,
    ticksAtStartOfTurn: true,
  },
  Taunt: {
    name: "Taunt",
    maxDuration: 2,
    isBuff: false,
    isDebuff: false, // neutral, depends on context
    stackable: false,
    ticksAtStartOfTurn: true,
  },
  Regeneration: {
    name: "Regeneration",
    maxDuration: 2,
    isBuff: true,
    isDebuff: false,
    stackable: false,
    ticksAtStartOfTurn: true,
  },
  Silence: {
    name: "Silence",
    maxDuration: 1,
    isBuff: false,
    isDebuff: true,
    stackable: false,
    ticksAtStartOfTurn: false,
    expiresAt: "ownerTurnEnd",
  },
  SummoningSickness: {
    name: "SummoningSickness",
    maxDuration: 1,
    isBuff: false,
    isDebuff: false,
    stackable: false,
    ticksAtStartOfTurn: true, // expires at start of owner's next turn
  },
  Stunned: {
    name: "Stunned",
    maxDuration: 1,
    isBuff: false,
    isDebuff: true,
    stackable: false,
    ticksAtStartOfTurn: false, // consumed when action is attempted (energy tax)
  },
  Cover: {
    name: "Cover",
    maxDuration: -1, // permanent while source is alive and adjacent
    isBuff: true,
    isDebuff: false,
    stackable: false,
    ticksAtStartOfTurn: false,
  },
  Poison: {
    name: "Poison",
    maxDuration: 3,
    isBuff: false,
    isDebuff: true,
    stackable: true, // stacks increase damage
    ticksAtStartOfTurn: true,
  },
  Thorns: {
    name: "Thorns",
    maxDuration: 2,
    isBuff: true,
    isDebuff: false,
    stackable: false,
    ticksAtStartOfTurn: true,
  },
  Stealth: {
    name: "Stealth",
    maxDuration: 2,
    isBuff: true,
    isDebuff: false,
    stackable: false,
    ticksAtStartOfTurn: true,
  },
  Empower: {
    name: "Empower",
    maxDuration: 1, // consumed on next attack
    isBuff: true,
    isDebuff: false,
    stackable: false,
    ticksAtStartOfTurn: false,
  },
  Counter: {
    name: "Counter",
    maxDuration: 1,
    isBuff: true,
    isDebuff: false,
    stackable: false,
    ticksAtStartOfTurn: true,
  },
  Mark: {
    name: "Mark",
    maxDuration: 2,
    isBuff: false,
    isDebuff: true,
    stackable: false,
    ticksAtStartOfTurn: true,
  },
  Barrier: {
    name: "Barrier",
    maxDuration: 2,
    isBuff: true,
    isDebuff: false,
    stackable: false,
    ticksAtStartOfTurn: true,
  },
  Doom: {
    name: "Doom",
    maxDuration: 3,
    isBuff: false,
    isDebuff: true,
    stackable: false,
    ticksAtStartOfTurn: true,
  },
};

export function isBuffStatus(statusName: StatusName): boolean {
  return !!STATUS_DEFINITIONS[statusName]?.isBuff;
}

export function isDebuffStatus(statusName: StatusName): boolean {
  return !!STATUS_DEFINITIONS[statusName]?.isDebuff;
}

/**
 * Check if unit has a specific status
 */
export function hasStatus(unit: UnitState, statusName: StatusName): boolean {
  return unit.statuses.some((s) => s.name === statusName);
}

/**
 * Get a specific status from unit
 */
export function getStatus(
  unit: UnitState,
  statusName: StatusName,
): Status | undefined {
  return unit.statuses.find((s) => s.name === statusName);
}

/**
 * Get all buffs on a unit
 */
export function getBuffs(unit: UnitState): Status[] {
  return unit.statuses.filter((s) => STATUS_DEFINITIONS[s.name]?.isBuff);
}

/**
 * Get all debuffs on a unit
 */
export function getDebuffs(unit: UnitState): Status[] {
  return unit.statuses.filter((s) => STATUS_DEFINITIONS[s.name]?.isDebuff);
}

/**
 * Apply a status to a unit
 * Handles stacking rules (max 2 offensive debuffs, max 2 defensive buffs)
 */
export function applyStatus(
  unit: UnitState,
  statusName: StatusName,
  duration: number,
  turn: number,
  magnitude?: number,
  sourceInstanceId?: string,
): {
  applied: boolean;
  replacedStatus?: Status;
  events: Partial<CombatEvent>[];
} {
  const def = STATUS_DEFINITIONS[statusName];
  const events: Partial<CombatEvent>[] = [];

  // Barrier blocks the next incoming debuff.
  if (def.isDebuff && hasStatus(unit, "Barrier")) {
    removeStatus(unit, "Barrier");
    events.push({
      type: "statusExpire",
      payload: {
        unitId: unit.instanceId,
        status: "Barrier",
        consumed: true,
      },
    });
    return { applied: false, events };
  }

  // Check if status already exists
  const existingIndex = unit.statuses.findIndex((s) => s.name === statusName);

  if (existingIndex !== -1) {
    const existing = unit.statuses[existingIndex];

    if (statusName === "Shield" && magnitude !== undefined) {
      // Shields stack in magnitude
      existing.magnitude = (existing.magnitude || 0) + magnitude;
      events.push({
        type: "statusApply",
        payload: {
          unitId: unit.instanceId,
          status: statusName,
          duration: existing.duration,
          magnitude: existing.magnitude,
          stacked: true,
        },
      });
      return { applied: true, events };
    }

    if (statusName === "Poison") {
      const addedStacks = Math.max(1, magnitude ?? 1);
      const currentStacks = Math.max(1, existing.magnitude ?? 1);
      existing.magnitude = currentStacks + addedStacks;
      existing.duration = Math.max(existing.duration, duration);
      existing.appliedAt = turn;
      events.push({
        type: "statusApply",
        payload: {
          unitId: unit.instanceId,
          status: statusName,
          duration: existing.duration,
          stacks: existing.magnitude,
          stacked: true,
        },
      });
      return { applied: true, events };
    }

    // Non-stackable: refresh duration
    const consumedDuration = turn - existing.appliedAt;
    const remainingDuration = existing.duration - consumedDuration;
    existing.duration = Math.max(remainingDuration, duration);
    existing.appliedAt = turn;
    if (magnitude !== undefined) existing.magnitude = magnitude;

    events.push({
      type: "statusApply",
      payload: {
        unitId: unit.instanceId,
        status: statusName,
        duration: existing.duration,
        magnitude: existing.magnitude,
        refreshed: true,
      },
    });
    return { applied: true, events };
  }

  // Check buff/debuff limits
  let replacedStatus: Status | undefined;

  if (def.isDebuff) {
    const debuffs = getDebuffs(unit);
    if (debuffs.length >= 3) {
      // Replace oldest debuff
      const oldest = debuffs.reduce((a, b) =>
        a.appliedAt < b.appliedAt ? a : b,
      );
      const oldestIndex = unit.statuses.findIndex((s) => s === oldest);
      replacedStatus = unit.statuses.splice(oldestIndex, 1)[0];
      events.push({
        type: "statusExpire",
        payload: {
          unitId: unit.instanceId,
          status: replacedStatus.name,
          replaced: true,
        },
      });
    }
  } else if (def.isBuff) {
    const buffs = getBuffs(unit);
    if (buffs.length >= 3) {
      // Replace oldest buff
      const oldest = buffs.reduce((a, b) =>
        a.appliedAt < b.appliedAt ? a : b,
      );
      const oldestIndex = unit.statuses.findIndex((s) => s === oldest);
      replacedStatus = unit.statuses.splice(oldestIndex, 1)[0];
      events.push({
        type: "statusExpire",
        payload: {
          unitId: unit.instanceId,
          status: replacedStatus.name,
          replaced: true,
        },
      });
    }
  }

  // Apply new status
  const newStatus: Status = {
    name: statusName,
    duration,
    magnitude,
    sourceInstanceId,
    appliedAt: turn,
  };

  unit.statuses.push(newStatus);

  events.push({
    type: "statusApply",
    payload: {
      unitId: unit.instanceId,
      status: statusName,
      duration,
      magnitude,
    },
  });

  return { applied: true, replacedStatus, events };
}

/**
 * Remove a status from a unit
 */
export function removeStatus(
  unit: UnitState,
  statusName: StatusName,
): { removed: boolean; event?: Partial<CombatEvent> } {
  const index = unit.statuses.findIndex((s) => s.name === statusName);
  if (index === -1) return { removed: false };

  unit.statuses.splice(index, 1);

  return {
    removed: true,
    event: {
      type: "statusExpire",
      payload: {
        unitId: unit.instanceId,
        status: statusName,
      },
    },
  };
}

/**
 * Cleanse debuffs from a unit
 */
export function cleanseDebuffs(
  unit: UnitState,
  count: number,
): { cleansed: StatusName[]; events: Partial<CombatEvent>[] } {
  const debuffs = getDebuffs(unit);
  const priorityDebuffs = [...debuffs].sort((a, b) => {
    if (a.name === "Doom" && b.name !== "Doom") return -1;
    if (a.name !== "Doom" && b.name === "Doom") return 1;
    return a.appliedAt - b.appliedAt;
  });
  const toCleanse = priorityDebuffs.slice(0, count);
  const cleansed: StatusName[] = [];
  const events: Partial<CombatEvent>[] = [];

  for (const status of toCleanse) {
    const { removed, event } = removeStatus(unit, status.name);
    if (removed) {
      cleansed.push(status.name);
      if (event) {
        event.type = "statusCleanse";
        events.push(event);
      }
    }
  }

  return { cleansed, events };
}

/**
 * Tick statuses at start of turn
 * Returns damage dealt, healing done, and expired statuses
 */
export function tickStatuses(
  unit: UnitState,
  turn: number,
): {
  damage: number;
  healing: number;
  expired: StatusName[];
  events: Partial<CombatEvent>[];
  skipAction: boolean;
} {
  void turn;
  let damage = 0;
  let healing = 0;
  const expired: StatusName[] = [];
  const events: Partial<CombatEvent>[] = [];
  const skipAction = false;

  // Process each status
  for (const status of [...unit.statuses]) {
    const def = STATUS_DEFINITIONS[status.name];
    if (!def) continue; // skip unknown/unregistered statuses gracefully

    // Burn: 10% max HP damage
    if (status.name === "Burn") {
      const burnDamage = Math.floor(unit.maxHp * 0.1);
      damage += burnDamage;
      events.push({
        type: "statusTick",
        payload: {
          unitId: unit.instanceId,
          status: "Burn",
          damage: burnDamage,
        },
      });
    }

    // Regeneration: 8% max HP heal
    if (status.name === "Regeneration") {
      const regenHeal = Math.floor(unit.maxHp * 0.08);
      healing += regenHeal;
      events.push({
        type: "statusTick",
        payload: {
          unitId: unit.instanceId,
          status: "Regeneration",
          healing: regenHeal,
        },
      });
    }

    // Poison: 5% max HP damage per stack
    if (status.name === "Poison") {
      const stacks = status.magnitude || 1;
      const poisonDamage = Math.floor(unit.maxHp * 0.05 * stacks);
      damage += poisonDamage;
      events.push({
        type: "statusTick",
        payload: {
          unitId: unit.instanceId,
          status: "Poison",
          damage: poisonDamage,
          stacks,
        },
      });
    }

    // Doom: per-ability execute threshold / max-HP damage percentage.
    if (status.name === "Doom" && status.duration === 0) {
      const doomPct =
        status.magnitude !== undefined
          ? Math.max(0, Math.min(1, status.magnitude))
          : 0;
      if (doomPct > 0) {
        const hpRatio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 0;
        const isFatal = hpRatio <= doomPct;
        if (isFatal) {
          unit.hp = 0;
        } else {
          const doomDamage = Math.floor(unit.maxHp * doomPct);
          damage += doomDamage;
        }

        events.push({
          type: "statusTick",
          payload: {
            unitId: unit.instanceId,
            status: "Doom",
            fatal: isFatal,
            magnitude: doomPct,
          },
        });
      }
    }

    // Decrement duration for statuses that tick
    if (def.ticksAtStartOfTurn) {
      status.duration--;
      if (status.duration < 0) {
        expired.push(status.name);
      }
    }
  }

  // Remove expired statuses
  for (const statusName of expired) {
    const { event } = removeStatus(unit, statusName);
    if (event) events.push(event);
  }

  return { damage, healing, expired, events, skipAction };
}

export function tickOwnerTurnEndStatuses(
  unit: UnitState,
  turn: number,
): {
  expired: StatusName[];
  events: Partial<CombatEvent>[];
} {
  const expired: StatusName[] = [];
  const events: Partial<CombatEvent>[] = [];

  for (const status of [...unit.statuses]) {
    const def = STATUS_DEFINITIONS[status.name];
    if (!def || def.expiresAt !== "ownerTurnEnd") continue;
    if (status.duration < 0 || status.appliedAt >= turn) continue;

    status.duration--;
    if (status.duration <= 0) {
      expired.push(status.name);
    }
  }

  for (const statusName of expired) {
    const { event } = removeStatus(unit, statusName);
    if (event) events.push(event);
  }

  return { expired, events };
}

/**
 * Consume Freeze status when attempting action
 * Returns true if action should be skipped
 */
export function consumeFreeze(unit: UnitState): {
  skipped: boolean;
  event?: Partial<CombatEvent>;
} {
  if (!hasStatus(unit, "Freeze")) return { skipped: false };

  removeStatus(unit, "Freeze");

  return {
    skipped: true,
    event: {
      type: "freeze_skip",
      payload: {
        unitId: unit.instanceId,
      },
    },
  };
}

/**
 * Consume Stunned status when attempting action
 * Returns true if stun was consumed
 */
export function consumeStunned(unit: UnitState): {
  consumed: boolean;
  event?: Partial<CombatEvent>;
} {
  if (!hasStatus(unit, "Stunned")) return { consumed: false };

  removeStatus(unit, "Stunned");

  return {
    consumed: true,
    event: {
      type: "stun_consume",
      payload: {
        unitId: unit.instanceId,
        energyPenalty: 1,
      },
    },
  };
}

/**
 * Get attack modifier from statuses
 */
export function getAttackModifier(unit: UnitState): number {
  let modifier = 1.0;

  // Burn: -10% Attack
  if (hasStatus(unit, "Burn")) {
    modifier *= 0.9;
  }

  // Weakened: -25% Attack
  if (hasStatus(unit, "Weakened")) {
    modifier *= 0.75;
  }

  // Empower: +25% Attack (consumed after attack)
  if (hasStatus(unit, "Empower")) {
    modifier *= 1.25;
  }

  return modifier;
}

/**
 * Get defense modifier from statuses
 */
export function getDefenseModifier(unit: UnitState): number {
  let modifier = 1.0;

  // Guard Up: +25% Defense
  if (hasStatus(unit, "GuardUp")) {
    modifier *= 1.25;
  }

  return modifier;
}

/**
 * Get incoming damage modifier from statuses
 */
export function getIncomingDamageModifier(unit: UnitState): number {
  let modifier = 1.0;

  // Vulnerable: +25% incoming damage
  if (hasStatus(unit, "Vulnerable")) {
    modifier *= 1.25;
  }

  // Freeze: +20% incoming damage while frozen
  if (hasStatus(unit, "Freeze")) {
    modifier *= 1.2;
  }

  // Mark: +15% incoming damage from all sources
  if (hasStatus(unit, "Mark")) {
    modifier *= 1.15;
  }

  return modifier;
}

/**
 * Check if unit is in stealth (cannot be targeted)
 */
export function isStealthed(unit: UnitState): boolean {
  return hasStatus(unit, "Stealth");
}

/**
 * Check if unit has thorns (reflects damage)
 */
export function getThornsDamage(
  unit: UnitState,
  damageReceived: number,
): number {
  if (!hasStatus(unit, "Thorns")) return 0;
  return Math.floor(damageReceived * 0.15);
}

/**
 * Check if unit will counter next attack
 */
export function hasCounter(unit: UnitState): boolean {
  return hasStatus(unit, "Counter");
}

/**
 * Check if unit has barrier (blocks next debuff)
 */
export function hasBarrier(unit: UnitState): boolean {
  return hasStatus(unit, "Barrier");
}

/**
 * Consume Empower status after attacking
 */
export function consumeEmpower(unit: UnitState): {
  consumed: boolean;
  event?: Partial<CombatEvent>;
} {
  if (!hasStatus(unit, "Empower")) return { consumed: false };
  const { removed, event } = removeStatus(unit, "Empower");
  return { consumed: removed, event };
}

/**
 * Consume Counter status after dodging
 */
export function consumeCounter(unit: UnitState): {
  consumed: boolean;
  event?: Partial<CombatEvent>;
} {
  if (!hasStatus(unit, "Counter")) return { consumed: false };
  const { removed, event } = removeStatus(unit, "Counter");
  return { consumed: removed, event };
}

/**
 * Consume Barrier when blocking a debuff
 */
export function consumeBarrier(unit: UnitState): {
  consumed: boolean;
  event?: Partial<CombatEvent>;
} {
  if (!hasStatus(unit, "Barrier")) return { consumed: false };
  const { removed, event } = removeStatus(unit, "Barrier");
  return { consumed: removed, event };
}

/**
 * Apply Poison stacks (stackable)
 */
export function applyPoison(
  unit: UnitState,
  stacks: number,
  turn: number,
): { events: Partial<CombatEvent>[] } {
  const events: Partial<CombatEvent>[] = [];
  const existing = getStatus(unit, "Poison");

  if (existing) {
    existing.magnitude = (existing.magnitude || 1) + stacks;
    existing.duration = 3; // refresh duration
    events.push({
      type: "statusApply",
      payload: {
        unitId: unit.instanceId,
        status: "Poison",
        stacks: existing.magnitude,
        refreshed: true,
      },
    });
  } else {
    const result = applyStatus(unit, "Poison", 3, turn, stacks);
    events.push(...result.events);
  }

  return { events };
}

/**
 * Get speed modifier from statuses
 */
export function getSpeedModifier(unit: UnitState): number {
  let modifier = 1.0;

  // Haste: +20% Speed
  if (hasStatus(unit, "Haste")) {
    modifier *= 1.2;
  }

  return modifier;
}

/**
 * Check if unit is silenced (cannot use Skills or Ultimates)
 */
export function isSilenced(unit: UnitState): boolean {
  return hasStatus(unit, "Silence");
}

/**
 * Check if unit has summoning sickness
 */
export function hasSummoningSickness(unit: UnitState): boolean {
  return hasStatus(unit, "SummoningSickness");
}

/**
 * Get shield amount remaining
 */
export function getShieldAmount(unit: UnitState): number {
  const shield = getStatus(unit, "Shield");
  return shield?.magnitude ?? 0;
}

/**
 * Consume shield and return amount absorbed
 */
export function consumeShield(unit: UnitState, damage: number): number {
  const shield = getStatus(unit, "Shield");
  if (!shield || !shield.magnitude) return 0;

  const absorbed = Math.min(shield.magnitude, damage);
  shield.magnitude -= absorbed;

  // Remove shield if depleted
  if (shield.magnitude <= 0) {
    removeStatus(unit, "Shield");
  }

  return absorbed;
}

/**
 * Find unit with Taunt in enemy team
 */
export function findTaunter(enemies: UnitState[]): UnitState | undefined {
  return enemies.find((u) => u.hp > 0 && hasStatus(u, "Taunt"));
}

/**
 * Check if a unit has Cover from an adjacent ally
 */
export function getCoverSource(
  unit: UnitState,
  allies: UnitState[],
): UnitState | undefined {
  const coverStatus = getStatus(unit, "Cover");
  if (!coverStatus?.sourceInstanceId) return undefined;

  return allies.find(
    (a) => a.instanceId === coverStatus.sourceInstanceId && a.hp > 0,
  );
}
