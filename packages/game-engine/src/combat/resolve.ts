// Turn resolution for combat

import {
  BattleState,
  PlayerState,
  UnitState,
  Action,
  CombatEvent,
  StatusName,
  AbilityTarget,
} from "./types";
import { SeededRng } from "./rng";
import {
  tickStatuses,
  applyStatus,
  consumeFreeze,
  consumeStunned,
  hasStatus,
  cleanseDebuffs,
  removeStatus,
  getBuffs,
  getDebuffs,
  consumeEmpower,
  hasCounter,
  consumeCounter,
  getThornsDamage,
  getCoverSource,
} from "./effects";
import {
  calculateDamage,
  applyDamage,
  applyHealing,
  getAdjacentUnits,
  calculateLifesteal,
} from "./damage";
import { getAbilityDefinition } from "./abilities";
import {
  getCurrentPlayer,
  getOpponent,
  findUnit,
  getActionEnergyCost,
  checkGameEnd,
  getKoAllies,
} from "./validators";
import {
  getAbilityTarget,
  getTargetUnits,
  getEffectiveTargetUnits,
  requiresTargetSelection,
} from "./targeting";

const PASSIVE_DAMAGE_REDUCTION_CAP = 0.2;
const PER_CAST_SHIELD_CAP_PCT = 0.2;

/**
 * Create a new combat event
 */
function createEvent(
  state: BattleState,
  type: CombatEvent["type"],
  payload: Record<string, unknown>,
): CombatEvent {
  return {
    seq: state.log.length,
    turn: state.turn,
    type,
    payload,
  };
}

/**
 * Add event to state log
 */
function logEvent(
  state: BattleState,
  event: CombatEvent | Partial<CombatEvent>,
): void {
  const fullEvent: CombatEvent = {
    seq: state.log.length,
    turn: state.turn,
    type: event.type || "damage",
    payload: event.payload || {},
  };
  state.log.push(fullEvent);
}

function getAllUnits(player: PlayerState): UnitState[] {
  return [...player.units, ...player.bench];
}

function getOpponentPlayer(
  state: BattleState,
  player: PlayerState,
): PlayerState {
  return state.players.find((p) => p.userId !== player.userId)!;
}

function getIncomingDamageReductionPct(
  state: BattleState,
  target: UnitState,
): number {
  let reduction = 0;
  for (const passiveKey of target.passives) {
    const passive = getAbilityDefinition(passiveKey, state.abilityDefinitions);
    if (!passive || passive.payload.trigger !== "onDamageTaken") continue;
    if (!passive.payload.damageReduction) continue;
    if (
      passive.payload.hitCountLimit !== undefined &&
      target.hitsTaken >= passive.payload.hitCountLimit
    ) {
      continue;
    }
    reduction += passive.payload.damageReduction;
  }
  return Math.min(PASSIVE_DAMAGE_REDUCTION_CAP, Math.max(0, reduction));
}

function getTeamDotDamageReductionPct(
  state: BattleState,
  player: PlayerState,
): number {
  let reduction = 0;
  for (const unit of getAllUnits(player)) {
    if (unit.hp <= 0) continue;
    for (const passiveKey of unit.passives) {
      const passive = getAbilityDefinition(
        passiveKey,
        state.abilityDefinitions,
      );
      if (!passive || passive.payload.trigger !== "onBattleInit") continue;
      if (!passive.payload.damageReduction) continue;
      reduction += passive.payload.damageReduction;
    }
  }
  return Math.min(PASSIVE_DAMAGE_REDUCTION_CAP, Math.max(0, reduction));
}

function tryPreventFatalDamage(
  state: BattleState,
  player: PlayerState,
  target: UnitState,
): boolean {
  for (const ally of player.units) {
    if (ally.instanceId === target.instanceId || ally.hp <= 0) continue;
    for (const passiveKey of ally.passives) {
      const passive = getAbilityDefinition(
        passiveKey,
        state.abilityDefinitions,
      );
      if (!passive || passive.payload.trigger !== "onAllyFatalDamage") continue;
      if (!passive.payload.preventDeath) continue;
      if (passive.payload.once && ally.passiveTriggered[passiveKey]) continue;

      target.hp = 1;
      const allowBarrierOnPreventDeath =
        passive.payload.allowBarrierOnPreventDeath === true;
      if (passive.payload.applyStatuses) {
        for (const statusDef of passive.payload.applyStatuses) {
          if (statusDef.name === "Barrier" && !allowBarrierOnPreventDeath) {
            continue;
          }
          applyStatus(
            target,
            statusDef.name,
            statusDef.duration || 1,
            state.turn,
            statusDef.magnitude,
          );
        }
      }

      if (passive.payload.once) {
        ally.passiveTriggered[passiveKey] = true;
      }

      logEvent(
        state,
        createEvent(state, "passiveTrigger", {
          unitId: ally.instanceId,
          passiveKey,
        }),
      );
      return true;
    }
  }
  return false;
}

function applyFatalPreventionToDamageResult(
  state: BattleState,
  defenderPlayer: PlayerState,
  target: UnitState,
  damageResult: { events: Partial<CombatEvent>[]; isKo: boolean },
): void {
  if (!damageResult.isKo) return;
  const prevented = tryPreventFatalDamage(state, defenderPlayer, target);
  if (!prevented) return;
  damageResult.isKo = false;
  damageResult.events = damageResult.events.filter((e) => e.type !== "ko");
}

function forceKoWithFatalPrevention(
  state: BattleState,
  rng: SeededRng,
  attacker: UnitState,
  defenderPlayer: PlayerState,
  target: UnitState,
): boolean {
  target.hp = 0;
  const prevented = tryPreventFatalDamage(state, defenderPlayer, target);
  if (prevented) return false;

  logEvent(
    state,
    createEvent(state, "ko", {
      unitId: target.instanceId,
      killerId: attacker.instanceId,
    }),
  );
  handleKo(state, rng, target.instanceId, defenderPlayer);
  return true;
}

function maybeRedirectSingleTarget(
  state: BattleState,
  rng: SeededRng,
  defender: PlayerState,
  originalTarget: UnitState,
): UnitState {
  for (const candidate of defender.units) {
    if (
      candidate.hp <= 0 ||
      candidate.instanceId === originalTarget.instanceId
    ) {
      continue;
    }
    for (const passiveKey of candidate.passives) {
      const passive = getAbilityDefinition(
        passiveKey,
        state.abilityDefinitions,
      );
      if (!passive) continue;
      const chance = passive.payload.redirectIncomingChance;
      if (chance === undefined) continue;
      const threshold = passive.payload.redirectIfSelfAboveHpPct ?? 0;
      if (candidate.hp / candidate.maxHp <= threshold) continue;
      const adjacent = getAdjacentUnits(candidate, defender.units).some(
        (u) => u.instanceId === originalTarget.instanceId,
      );
      if (!adjacent) continue;
      if (!rng.nextBool(chance)) continue;
      return candidate;
    }
  }
  return originalTarget;
}

function getCappedShieldAmount(
  sourceMaxHp: number,
  recipientMaxHp: number,
  shieldPct: number,
): number {
  const baseAmount = Math.floor(sourceMaxHp * shieldPct);
  const cappedAmount = Math.floor(recipientMaxHp * PER_CAST_SHIELD_CAP_PCT);
  return Math.min(baseAmount, cappedAmount);
}

function consumeStealthIfPresent(state: BattleState, actor: UnitState): void {
  if (!hasStatus(actor, "Stealth")) return;
  const stealthResult = removeStatus(actor, "Stealth");
  if (stealthResult.event) {
    logEvent(state, { ...stealthResult.event, turn: state.turn });
  }
}

function maybeConsumeEmpower(state: BattleState, actor: UnitState): void {
  const empowerResult = consumeEmpower(actor);
  if (empowerResult.event) {
    logEvent(state, { ...empowerResult.event, turn: state.turn });
  }
}

function applyFlatDamage(
  state: BattleState,
  rng: SeededRng,
  source: UnitState,
  target: UnitState,
  amount: number,
  sourceTag: string,
  ownerOfTarget: PlayerState,
): void {
  if (amount <= 0 || source.hp <= 0 || target.hp <= 0) return;

  const hpBefore = target.hp;
  target.hp = Math.max(0, target.hp - amount);
  logEvent(
    state,
    createEvent(state, "damage", {
      attackerId: source.instanceId,
      targetId: target.instanceId,
      source: sourceTag,
      damage: amount,
      hpBefore,
      hpAfter: target.hp,
      typeMultiplier: 1,
      isCrit: false,
      isMiss: false,
      incomingDamageReductionPct: 0,
      shieldAbsorbed: 0,
    }),
  );

  if (target.hp <= 0) {
    logEvent(
      state,
      createEvent(state, "ko", {
        unitId: target.instanceId,
        killerId: source.instanceId,
        source: sourceTag,
      }),
    );
    handleKo(state, rng, target.instanceId, ownerOfTarget);
  }
}

function maybeApplyCoverRedirect(
  state: BattleState,
  rng: SeededRng,
  target: UnitState,
  defender: PlayerState,
  attacker: UnitState,
  damageResult: { events: Partial<CombatEvent>[]; isKo: boolean },
  damageDealt: number,
): void {
  if (damageDealt <= 0 || target.hp <= 0) return;
  const coverSource = getCoverSource(target, defender.units);
  if (!coverSource || coverSource.instanceId === target.instanceId) return;
  if (coverSource.hp <= 0) return;

  const redirected = Math.floor(damageDealt * 0.3);
  if (redirected <= 0) return;

  target.hp = Math.min(target.maxHp, target.hp + redirected);
  const damageEvent = damageResult.events.find(
    (event) => event.type === "damage",
  );
  if (damageEvent?.payload) {
    damageEvent.payload.damage = Math.max(0, damageDealt - redirected);
    damageEvent.payload.hpAfter = target.hp;
    damageEvent.payload.coverRedirected = redirected;
    damageEvent.payload.coverSourceId = coverSource.instanceId;
  }
  if (target.hp > 0) {
    damageResult.isKo = false;
    damageResult.events = damageResult.events.filter(
      (event) => event.type !== "ko",
    );
  }

  applyFlatDamage(
    state,
    rng,
    attacker,
    coverSource,
    redirected,
    "CoverRedirect",
    defender,
  );
}

function maybeApplyThornsReflection(
  state: BattleState,
  rng: SeededRng,
  attacker: UnitState,
  target: UnitState,
  defender: PlayerState,
  attackerOwner: PlayerState,
  damageDealt: number,
): void {
  if (damageDealt <= 0 || attacker.hp <= 0 || target.hp <= 0) return;
  const reflectedDamage = getThornsDamage(target, damageDealt);
  if (reflectedDamage <= 0) return;
  applyFlatDamage(
    state,
    rng,
    target,
    attacker,
    reflectedDamage,
    "Thorns",
    attackerOwner,
  );
  triggerPassives(state, rng, "onDamageTaken", attackerOwner, {
    targetId: attacker.instanceId,
    damage: reflectedDamage,
    attackerId: target.instanceId,
    source: "Thorns",
  });
  triggerPassives(state, rng, "onBelowHp", attackerOwner, {
    unitId: attacker.instanceId,
  });
  triggerPassives(state, rng, "onDamageDealt", defender, {
    attackerId: target.instanceId,
    targetId: attacker.instanceId,
    damage: reflectedDamage,
    abilityType: "status",
    source: "Thorns",
  });
}

function maybeResolveCounter(
  state: BattleState,
  rng: SeededRng,
  attacker: UnitState,
  defender: UnitState,
  attackerOwner: PlayerState,
  defenderOwner: PlayerState,
): boolean {
  if (!hasCounter(defender) || attacker.hp <= 0 || defender.hp <= 0)
    return false;

  const counterResult = consumeCounter(defender);
  if (counterResult.event) {
    logEvent(state, { ...counterResult.event, turn: state.turn });
  }

  logEvent(
    state,
    createEvent(state, "damage", {
      attackerId: attacker.instanceId,
      targetId: defender.instanceId,
      damage: 0,
      hpBefore: defender.hp,
      hpAfter: defender.hp,
      typeMultiplier: 1,
      isCrit: false,
      isMiss: true,
      incomingDamageReductionPct: 0,
      shieldAbsorbed: 0,
      source: "CounterDodge",
    }),
  );

  const counterDamage = calculateDamage(defender, attacker, rng, {
    damageMul: 1.0,
    incomingDamageReductionPct: getIncomingDamageReductionPct(state, attacker),
  });
  const counterDamageResult = applyDamage(
    attacker,
    counterDamage.actualDamage,
    defender.instanceId,
    counterDamage,
    state.turn,
  );
  for (const event of counterDamageResult.events) {
    logEvent(state, { ...event, turn: state.turn });
  }

  if (counterDamage.actualDamage > 0) {
    triggerPassives(state, rng, "onDamageDealt", defenderOwner, {
      attackerId: defender.instanceId,
      targetId: attacker.instanceId,
      damage: counterDamage.actualDamage,
      abilityType: "status",
      source: "Counter",
    });
    triggerPassives(state, rng, "onDealDamage", defenderOwner, {
      attackerId: defender.instanceId,
      targetId: attacker.instanceId,
      damage: counterDamage.actualDamage,
      abilityType: "status",
      source: "Counter",
    });
    attacker.hitsTaken = (attacker.hitsTaken || 0) + 1;
    triggerPassives(state, rng, "onDamageTaken", attackerOwner, {
      targetId: attacker.instanceId,
      damage: counterDamage.actualDamage,
      attackerId: defender.instanceId,
      source: "Counter",
    });
    triggerPassives(state, rng, "onBelowHp", attackerOwner, {
      unitId: attacker.instanceId,
    });
  }

  if (counterDamageResult.isKo) {
    handleKo(state, rng, attacker.instanceId, attackerOwner);
  }
  return true;
}

function getBonusDamageVsDebuffedTargetsPct(
  state: BattleState,
  actor: UnitState,
  target: UnitState,
): number {
  if (getDebuffs(target).length === 0) return 0;
  let bonus = 0;
  for (const passiveKey of actor.passives) {
    const passive = getAbilityDefinition(passiveKey, state.abilityDefinitions);
    if (!passive?.payload.bonusDamageVsDebuffedTargetsPct) continue;
    bonus += passive.payload.bonusDamageVsDebuffedTargetsPct;
  }
  return Math.max(0, bonus);
}

function applyStatBonusToUnit(
  unit: UnitState,
  statBonus: NonNullable<
    ReturnType<typeof getAbilityDefinition>
  >["payload"]["statBonus"],
): void {
  if (!statBonus) return;

  if (statBonus.hp !== undefined) {
    unit.maxHp = Math.floor(unit.maxHp * (1 + statBonus.hp / 100));
    unit.hp = Math.min(unit.hp, unit.maxHp);
  }
  if (statBonus.attack !== undefined) {
    unit.attack = Math.floor(unit.attack * (1 + statBonus.attack / 100));
  }
  if (statBonus.defense !== undefined) {
    unit.defense = Math.floor(unit.defense * (1 + statBonus.defense / 100));
  }
  if (statBonus.speed !== undefined) {
    unit.speed = Math.floor(unit.speed * (1 + statBonus.speed / 100));
  }
}

function applyTrackedStatAuraToUnit(
  unit: UnitState,
  sourceInstanceId: string,
  abilityKey: string,
  statBonus: NonNullable<
    ReturnType<typeof getAbilityDefinition>
  >["payload"]["statBonus"],
): void {
  if (!statBonus) return;

  if (!unit.statAuraContributions) {
    unit.statAuraContributions = {};
  }
  const contributionKey = `${sourceInstanceId}|${abilityKey}`;
  const existing = unit.statAuraContributions[contributionKey];
  if (existing) {
    if (existing.hp !== undefined) {
      unit.maxHp -= existing.hp;
      unit.hp = Math.min(unit.hp, unit.maxHp);
    }
    if (existing.attack !== undefined) unit.attack -= existing.attack;
    if (existing.defense !== undefined) unit.defense -= existing.defense;
    if (existing.speed !== undefined) unit.speed -= existing.speed;
    delete unit.statAuraContributions[contributionKey];
  }

  const contribution: NonNullable<UnitState["statAuraContributions"]>[string] =
  {
    sourceInstanceId,
    abilityKey,
  };

  if (statBonus.hp !== undefined) {
    const before = unit.maxHp;
    const after = Math.floor(unit.maxHp * (1 + statBonus.hp / 100));
    const delta = after - before;
    unit.maxHp = after;
    unit.hp = Math.min(unit.hp, unit.maxHp);
    if (delta !== 0) contribution.hp = delta;
  }
  if (statBonus.attack !== undefined) {
    const before = unit.attack;
    const after = Math.floor(unit.attack * (1 + statBonus.attack / 100));
    const delta = after - before;
    unit.attack = after;
    if (delta !== 0) contribution.attack = delta;
  }
  if (statBonus.defense !== undefined) {
    const before = unit.defense;
    const after = Math.floor(unit.defense * (1 + statBonus.defense / 100));
    const delta = after - before;
    unit.defense = after;
    if (delta !== 0) contribution.defense = delta;
  }
  if (statBonus.speed !== undefined) {
    const before = unit.speed;
    const after = Math.floor(unit.speed * (1 + statBonus.speed / 100));
    const delta = after - before;
    unit.speed = after;
    if (delta !== 0) contribution.speed = delta;
  }

  if (
    contribution.hp !== undefined ||
    contribution.attack !== undefined ||
    contribution.defense !== undefined ||
    contribution.speed !== undefined
  ) {
    unit.statAuraContributions[contributionKey] = contribution;
  }
}

function removeTrackedAurasFromSource(
  state: BattleState,
  sourceInstanceId: string,
): void {
  for (const team of state.players) {
    for (const unit of getAllUnits(team)) {
      if (!unit.statAuraContributions) continue;
      for (const [key, contribution] of Object.entries(
        unit.statAuraContributions,
      )) {
        if (contribution.sourceInstanceId !== sourceInstanceId) continue;
        if (contribution.hp !== undefined) {
          unit.maxHp -= contribution.hp;
          unit.hp = Math.min(unit.hp, unit.maxHp);
        }
        if (contribution.attack !== undefined)
          unit.attack -= contribution.attack;
        if (contribution.defense !== undefined)
          unit.defense -= contribution.defense;
        if (contribution.speed !== undefined) unit.speed -= contribution.speed;
        delete unit.statAuraContributions[key];
      }
    }
  }
}

function hasActiveSourceStatAuras(
  state: BattleState,
  unit: UnitState,
): boolean {
  for (const passiveKey of unit.passives) {
    const passive = getAbilityDefinition(passiveKey, state.abilityDefinitions);
    if (!passive) continue;
    if (passive.payload.trigger !== "onBattleInit") continue;
    if (!passive.payload.statBonus) continue;
    if (passive.payload.statBonusDurationMode !== "whileSourceActive") continue;
    return true;
  }
  return false;
}

function applySourceActiveStatAuras(
  state: BattleState,
  sourceUnit: UnitState,
  sourceOwner: PlayerState,
): void {
  if (sourceUnit.hp <= 0) return;
  const opponent = getOpponentPlayer(state, sourceOwner);

  for (const passiveKey of sourceUnit.passives) {
    const passive = getAbilityDefinition(passiveKey, state.abilityDefinitions);
    if (!passive) continue;
    const payload = passive.payload;
    if (payload.trigger !== "onBattleInit") continue;
    if (!payload.statBonus) continue;
    if (payload.statBonusDurationMode !== "whileSourceActive") continue;

    if (
      payload.requiredAnyAllyTypes &&
      payload.requiredAnyAllyTypes.length > 0 &&
      !getAllUnits(sourceOwner).some((ally) =>
        payload.requiredAnyAllyTypes!.includes(ally.type),
      )
    ) {
      continue;
    }

    if (payload.statBonusTarget === "allAllies") {
      const allies = getAllUnits(sourceOwner).filter((ally) => ally.hp > 0);
      for (const ally of allies) {
        if (
          payload.applyToAllyTypes &&
          payload.applyToAllyTypes.length > 0 &&
          !payload.applyToAllyTypes.includes(ally.type)
        ) {
          continue;
        }
        applyTrackedStatAuraToUnit(
          ally,
          sourceUnit.instanceId,
          passive.key,
          payload.statBonus,
        );
      }
      continue;
    }

    if (payload.statBonusTarget === "allEnemies") {
      const enemies = getAllUnits(opponent).filter((enemy) => enemy.hp > 0);
      for (const enemy of enemies) {
        applyTrackedStatAuraToUnit(
          enemy,
          sourceUnit.instanceId,
          passive.key,
          payload.statBonus,
        );
      }
      continue;
    }

    applyTrackedStatAuraToUnit(
      sourceUnit,
      sourceUnit.instanceId,
      passive.key,
      payload.statBonus,
    );
  }
}

function applyShieldByTarget(
  actor: UnitState,
  player: PlayerState,
  target: UnitState | undefined,
  shieldPct: number,
  shieldTarget: "self" | "target" | "allAllies" | undefined,
  turn: number,
): void {
  if (shieldTarget === "self") {
    const selfShieldAmount = getCappedShieldAmount(
      actor.maxHp,
      actor.maxHp,
      shieldPct,
    );
    if (selfShieldAmount <= 0) return;

    applyStatus(actor, "Shield", -1, turn, selfShieldAmount);
    return;
  }

  if (shieldTarget === "allAllies") {
    for (const ally of player.units) {
      if (ally.hp <= 0) continue;
      const allyShieldAmount = getCappedShieldAmount(
        actor.maxHp,
        ally.maxHp,
        shieldPct,
      );
      if (allyShieldAmount <= 0) continue;
      applyStatus(ally, "Shield", -1, turn, allyShieldAmount);
    }
    return;
  }

  if (target && target.hp > 0) {
    const targetShieldAmount = getCappedShieldAmount(
      actor.maxHp,
      target.maxHp,
      shieldPct,
    );
    if (targetShieldAmount <= 0) return;
    applyStatus(target, "Shield", -1, turn, targetShieldAmount);
  }
}

function getAdjacentAuraStatuses(
  state: BattleState,
  unit: UnitState,
): Array<{
  name: StatusName;
  duration: number;
}> {
  const statuses: Array<{ name: StatusName; duration: number }> = [];
  for (const passiveKey of unit.passives) {
    const passive = getAbilityDefinition(passiveKey, state.abilityDefinitions);
    if (!passive?.payload.adjacentAuraStatus) continue;
    statuses.push({
      name: passive.payload.adjacentAuraStatus.name,
      duration: passive.payload.adjacentAuraStatus.duration,
    });
  }
  return statuses;
}

function getTeamHealingBonus(state: BattleState, player: PlayerState): number {
  let bonus = 0;
  for (const unit of player.units) {
    if (unit.hp <= 0) continue;
    for (const passiveKey of unit.passives) {
      const passive = getAbilityDefinition(
        passiveKey,
        state.abilityDefinitions,
      );
      if (!passive || passive.payload.trigger !== "onHealAlly") continue;
      bonus += passive.payload.healingBonus || 0;
    }
  }
  return bonus;
}

function applyAllyHealing(
  state: BattleState,
  rng: SeededRng,
  player: PlayerState,
  source: UnitState,
  target: UnitState,
  baseAmount: number,
): void {
  if (baseAmount <= 0 || target.hp <= 0) return;

  const healingBonus = getTeamHealingBonus(state, player);
  const amount = Math.floor(baseAmount * (1 + healingBonus));
  const healResult = applyHealing(target, amount, source.instanceId);
  logEvent(state, { ...healResult.event, turn: state.turn });

  if (target.instanceId !== source.instanceId && healResult.actualHealing > 0) {
    triggerPassives(state, rng, "onHealAlly", player, {
      sourceId: source.instanceId,
      targetId: target.instanceId,
      amount: healResult.actualHealing,
    });
  }
}

function getRandomStatusesFromPayload(
  payload: NonNullable<ReturnType<typeof getAbilityDefinition>>["payload"],
): Array<{ name: StatusName; duration?: number; magnitude?: number }> {
  if (payload.randomStatuses && payload.randomStatuses.length > 0) {
    return payload.randomStatuses;
  }
  if (payload.randomDebuffs && payload.randomDebuffs.length > 0) {
    return payload.randomDebuffs;
  }
  return [];
}

function applyRandomStatusToTarget(
  state: BattleState,
  rng: SeededRng,
  target: UnitState,
  randomStatuses: Array<{
    name: StatusName;
    duration?: number;
    magnitude?: number;
  }>,
): void {
  if (randomStatuses.length === 0 || target.hp <= 0) return;
  const selected = rng.pick(randomStatuses);
  applyStatus(
    target,
    selected.name,
    selected.duration || 1,
    state.turn,
    selected.magnitude,
  );
}

function conditionMatchesTarget(
  condition: Record<string, unknown>,
  target: UnitState,
): boolean {
  const targetHas = condition.targetHas as StatusName | undefined;
  if (targetHas && !hasStatus(target, targetHas)) return false;

  const targetBelowHpPct = condition.targetBelowHpPct as number | undefined;
  if (
    targetBelowHpPct !== undefined &&
    !(target.hp / target.maxHp <= targetBelowHpPct)
  ) {
    return false;
  }

  const allyType = condition.allyType as string | undefined;
  if (allyType && target.type !== allyType) return false;

  return true;
}

type FormationMoveReason = "ko_to_bench" | "bench_fill" | "revive_fill";

interface FormationMove {
  unitId: string;
  from: "active" | "bench";
  to: "active" | "bench";
  fromPosition: 1 | 2 | 3 | null;
  toPosition: 1 | 2 | 3 | null;
  reason: FormationMoveReason;
}

function reconcilePlayerFormation(
  state: BattleState,
  player: PlayerState,
  reasonContext: "normal" | "revive" = "normal",
): void {
  const moves: FormationMove[] = [];

  const koActives = player.units
    .filter((unit) => unit.hp <= 0)
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  for (const koUnit of koActives) {
    const fromPosition = koUnit.position;
    koUnit.position = null;
    player.units = player.units.filter(
      (unit) => unit.instanceId !== koUnit.instanceId,
    );
    player.bench.push(koUnit);
    moves.push({
      unitId: koUnit.instanceId,
      from: "active",
      to: "bench",
      fromPosition,
      toPosition: null,
      reason: "ko_to_bench",
    });
  }

  const occupiedPositions = new Set(
    player.units.filter((unit) => unit.hp > 0).map((unit) => unit.position),
  );
  const openPositions = ([1, 2, 3] as Array<1 | 2 | 3>).filter(
    (position) => !occupiedPositions.has(position),
  );

  for (const position of openPositions) {
    const benchIndex = player.bench.findIndex((unit) => unit.hp > 0);
    if (benchIndex < 0) break;

    const benchUnit = player.bench[benchIndex];
    const fillReason: FormationMoveReason =
      reasonContext === "revive" ? "revive_fill" : "bench_fill";

    const fromPosition = benchUnit.position;
    player.bench.splice(benchIndex, 1);
    benchUnit.position = position;
    player.units.push(benchUnit);

    applyStatus(benchUnit, "SummoningSickness", 1, state.turn);

    const benchAuras = getAdjacentAuraStatuses(state, benchUnit);
    if (benchAuras.length > 0) {
      const adjacents = getAdjacentUnits(benchUnit, player.units);
      for (const adjacent of adjacents) {
        for (const aura of benchAuras) {
          applyStatus(
            adjacent,
            aura.name,
            aura.duration,
            state.turn,
            undefined,
            benchUnit.instanceId,
          );
        }
      }
    }

    if (hasActiveSourceStatAuras(state, benchUnit)) {
      applySourceActiveStatAuras(state, benchUnit, player);
    }

    moves.push({
      unitId: benchUnit.instanceId,
      from: "bench",
      to: "active",
      fromPosition,
      toPosition: position,
      reason: fillReason,
    });
  }

  if (moves.length > 0) {
    logEvent(
      state,
      createEvent(state, "formation", {
        playerId: player.userId,
        moves,
      }),
    );
  }
}

const REVIVE_ON_ENEMY_KO_PREFIX = "pendingReviveOnEnemyKo:";

function armReviveOnEnemyKo(
  unit: UnitState,
  abilityKey: string,
  revivePct: number,
): void {
  const marker = `${REVIVE_ON_ENEMY_KO_PREFIX}${abilityKey}|${revivePct}`;
  unit.passiveTriggered[marker] = true;
}

function triggerPendingEnemyKoRevive(
  state: BattleState,
  player: PlayerState,
): void {
  const allUnits = getAllUnits(player);
  let sourceAbilityKey: string | null = null;
  let revivePct: number | null = null;

  for (const unit of allUnits) {
    const marker = Object.keys(unit.passiveTriggered).find((key) =>
      key.startsWith(REVIVE_ON_ENEMY_KO_PREFIX),
    );
    if (!marker) continue;

    delete unit.passiveTriggered[marker];
    const encoded = marker.slice(REVIVE_ON_ENEMY_KO_PREFIX.length);
    const [abilityKey, pctRaw] = encoded.split("|");
    const parsedPct = Number(pctRaw);
    if (!abilityKey || !Number.isFinite(parsedPct) || parsedPct <= 0) {
      return;
    }

    sourceAbilityKey = abilityKey;
    revivePct = parsedPct;
    break;
  }

  if (!sourceAbilityKey || revivePct === null) return;

  const target = getKoAllies(player)[0];
  if (!target) return;

  target.hp = Math.floor(target.maxHp * revivePct);
  if (target.position !== null) {
    applySourceActiveStatAuras(state, target, player);
  }

  logEvent(
    state,
    createEvent(state, "revive", {
      targetId: target.instanceId,
      hp: target.hp,
      source: sourceAbilityKey,
    }),
  );
}

function handleKo(
  state: BattleState,
  rng: SeededRng,
  koedUnitId: string,
  koedPlayer: PlayerState,
): void {
  const enemyPlayer = state.players.find(
    (p) => p.userId !== koedPlayer.userId,
  )!;

  // Remove aura statuses that were sourced by the KO'd unit.
  for (const team of state.players) {
    for (const unit of team.units) {
      unit.statuses = unit.statuses.filter(
        (status) => status.sourceInstanceId !== koedUnitId,
      );
    }
  }
  removeTrackedAurasFromSource(state, koedUnitId);

  triggerPassives(state, rng, "onAnyKo", enemyPlayer, { koedUnitId });
  triggerPassives(state, rng, "onEnemyKo", enemyPlayer, { koedUnitId });
  triggerPassives(state, rng, "onAnyKo", koedPlayer, { koedUnitId });
  triggerPassives(state, rng, "onAllyKo", koedPlayer, { koedUnitId });

  triggerPendingEnemyKoRevive(state, enemyPlayer);
}

/**
 * Start a new turn
 */
export function startTurn(state: BattleState, rng: SeededRng): void {
  const currentPlayer = getCurrentPlayer(state);

  logEvent(
    state,
    createEvent(state, "turnStart", {
      playerId: currentPlayer.userId,
      turn: state.turn,
    }),
  );

  // Grant energy: 2 on turn 1, 3 thereafter
  const energyGrant = state.turn === 1 ? 2 : 3;
  currentPlayer.energy =
    energyGrant + (state.turn === 1 ? currentPlayer.energy : 0);
  currentPlayer.hasUsedFreeBasic = false;

  logEvent(
    state,
    createEvent(state, "energyGrant", {
      playerId: currentPlayer.userId,
      amount: energyGrant,
    }),
  );

  // Tick statuses for all current player's active units
  const dotReductionPct = getTeamDotDamageReductionPct(state, currentPlayer);
  for (const unit of currentPlayer.units) {
    if (unit.hp <= 0) continue;

    const tickResult = tickStatuses(unit, state.turn);

    // Log events
    for (const event of tickResult.events) {
      logEvent(state, { ...event, turn: state.turn });
    }

    // A fatal Doom tick zeroes HP directly — handle KO before other damage.
    if (unit.hp <= 0) {
      const prevented = tryPreventFatalDamage(state, currentPlayer, unit);
      if (!prevented) {
        logEvent(
          state,
          createEvent(state, "ko", {
            unitId: unit.instanceId,
            cause: "status_damage",
          }),
        );
        handleKo(state, rng, unit.instanceId, currentPlayer);
      }
      continue;
    }

    // Apply damage from burns etc.
    if (tickResult.damage > 0) {
      const hasFatalDoomTick = tickResult.events.some(
        (event) =>
          event.type === "statusTick" &&
          typeof event.payload === "object" &&
          event.payload !== null &&
          "fatal" in event.payload,
      );
      const reducedDamage =
        !hasFatalDoomTick && dotReductionPct > 0
          ? Math.floor(tickResult.damage * (1 - dotReductionPct))
          : tickResult.damage;
      unit.hp = Math.max(0, unit.hp - reducedDamage);
      if (unit.hp <= 0) {
        const prevented = tryPreventFatalDamage(state, currentPlayer, unit);
        if (!prevented) {
          logEvent(
            state,
            createEvent(state, "ko", {
              unitId: unit.instanceId,
              cause: "status_damage",
            }),
          );
          handleKo(state, rng, unit.instanceId, currentPlayer);
        }
      }
    }

    // Apply healing from regeneration
    if (tickResult.healing > 0 && unit.hp > 0) {
      const oldHp = unit.hp;
      unit.hp = Math.min(unit.maxHp, unit.hp + tickResult.healing);
      logEvent(
        state,
        createEvent(state, "heal", {
          targetId: unit.instanceId,
          amount: unit.hp - oldHp,
          hpBefore: oldHp,
          hpAfter: unit.hp,
          source: "Regeneration",
        }),
      );
    }

    // Check threshold passives after status damage/healing adjustments.
    triggerPassives(state, rng, "onBelowHp", currentPlayer, {
      unitId: unit.instanceId,
    });
  }

  reconcilePlayerFormation(state, currentPlayer);
  const opponent = getOpponent(state);
  reconcilePlayerFormation(state, opponent);

  // Decrement cooldowns for current player's units
  for (const unit of [...currentPlayer.units, ...currentPlayer.bench]) {
    for (const key of Object.keys(unit.cooldowns)) {
      if (unit.cooldowns[key] > 0) {
        unit.cooldowns[key]--;
        logEvent(
          state,
          createEvent(state, "cooldownTick", {
            unitId: unit.instanceId,
            abilityKey: key,
            remaining: unit.cooldowns[key],
          }),
        );
      }
    }
  }

  // // Clear summoning sickness for current player's units
  // for (const unit of currentPlayer.units) {
  //   if (hasStatus(unit, "SummoningSickness")) {
  //     removeStatus(unit, "SummoningSickness");
  //   }
  // }

  // Trigger start-of-turn passives
  triggerPassives(state, rng, "onStartTurn", currentPlayer);

  // Reset action tracking
  state.actionsThisTurn = [];
  state.turnEnded = false;
}

/**
 * Trigger passive abilities
 */
export function triggerPassives(
  state: BattleState,
  rng: SeededRng,
  trigger: string,
  player: PlayerState,
  context?: Record<string, unknown>,
): void {
  for (const unit of player.units) {
    if (unit.hp <= 0) continue;

    for (const passiveKey of unit.passives) {
      const passive = getAbilityDefinition(
        passiveKey,
        state.abilityDefinitions,
      );
      if (!passive || passive.payload.trigger !== trigger) continue;

      // Damage-dealt triggers should only evaluate passives for the actual attacker.
      if (
        (trigger === "onDamageDealt" || trigger === "onDealDamage") &&
        typeof context?.attackerId === "string" &&
        unit.instanceId !== context.attackerId
      ) {
        continue;
      }

      // Basic-only passives should never trigger/log on non-basic contexts.
      if (passive.payload.onBasicOnly && context?.abilityType !== "basic") {
        continue;
      }

      // Threshold-based passives (e.g., Brave Heart, Sticky Resolve)
      if (trigger === "onBelowHp") {
        if (
          typeof context?.unitId === "string" &&
          unit.instanceId !== context.unitId
        ) {
          continue;
        }
        const threshold =
          passive.payload.thresholdPct ?? passive.payload.belowHpThreshold;
        if (threshold === undefined) continue;
        if (unit.hp <= 0 || unit.hp / unit.maxHp > threshold) continue;
      }

      // Check if already triggered (for "once" passives)
      if (passive.payload.once && unit.passiveTriggered[passiveKey]) continue;
      if (trigger === "onBelowHp" && unit.passiveTriggered[passiveKey])
        continue;

      // Check chance-based passives
      if (passive.payload.chance !== undefined) {
        if (!rng.nextBool(passive.payload.chance)) continue;
      }

      // Execute passive effect
      executePassive(state, rng, unit, passive, player, context);

      // Mark as triggered if "once"
      if (passive.payload.once) {
        unit.passiveTriggered[passiveKey] = true;
      }
      if (trigger === "onBelowHp") {
        unit.passiveTriggered[passiveKey] = true;
      }

      logEvent(
        state,
        createEvent(state, "passiveTrigger", {
          unitId: unit.instanceId,
          passiveKey,
        }),
      );
    }
  }
}

/**
 * Execute a passive ability effect
 */
function executePassive(
  state: BattleState,
  rng: SeededRng,
  unit: UnitState,
  passive: ReturnType<typeof getAbilityDefinition>,
  player: PlayerState,
  context?: Record<string, unknown>,
): void {
  if (!passive) return;
  const payload = passive.payload;
  const opponent = getOpponentPlayer(state, player);

  // Cleanse effects (e.g., BMO Diagnostics, Prismo Temporal Chill)
  if (payload.cleanse) {
    if (payload.cleanse.target === "self") {
      cleanseDebuffs(unit, payload.cleanse.count);
    } else if (payload.cleanse.target === "ally") {
      const allies = player.units.filter(
        (u) => u.hp > 0 && u.instanceId !== unit.instanceId,
      );
      if (allies.length > 0) {
        const target = rng.pick(allies);
        cleanseDebuffs(target, payload.cleanse.count);
      }
    }
  }

  if (payload.battleStartEnergyBonus && payload.trigger === "onBattleInit") {
    player.energy += payload.battleStartEnergyBonus;
  }

  // Healing effects (e.g., Soul Snack on KO, Ember Core on burn apply)
  if (payload.healPctOfMaxHp) {
    if (
      payload.trigger === "onStartTurn" &&
      payload.healLowestHpAllyPctOfMaxHp
    ) {
      // handled below
    } else {
      const healTargets = getEffectiveTargetUnits(
        state,
        unit,
        payload,
        undefined,
      );
      for (const target of healTargets) {
        if (target.hp <= 0) continue;
        const healAmount = Math.floor(target.maxHp * payload.healPctOfMaxHp);
        if (target.instanceId === unit.instanceId) {
          const healResult = applyHealing(target, healAmount, unit.instanceId);
          logEvent(state, { ...healResult.event, turn: state.turn });
        } else {
          applyAllyHealing(state, rng, player, unit, target, healAmount);
        }
      }
    }
  }

  if (payload.healLowestHpAllyPctOfMaxHp) {
    const allies = player.units.filter((u) => u.hp > 0);
    if (allies.length > 0) {
      const lowestHpAlly = allies.reduce((a, b) =>
        a.hp / a.maxHp <= b.hp / b.maxHp ? a : b,
      );
      const healAmount = Math.floor(
        lowestHpAlly.maxHp * payload.healLowestHpAllyPctOfMaxHp,
      );
      applyAllyHealing(state, rng, player, unit, lowestHpAlly, healAmount);
    }
  }

  // Shield effects (e.g., Finn Brave Heart)
  if (payload.shieldPctOfMaxHp) {
    const shieldAmount = getCappedShieldAmount(
      unit.maxHp,
      unit.maxHp,
      payload.shieldPctOfMaxHp,
    );
    if (shieldAmount > 0) {
      applyStatus(unit, "Shield", -1, state.turn, shieldAmount);
    }
  }

  // Self buffs for passives that grant statuses on trigger.
  if (payload.selfBuffs) {
    for (const buff of payload.selfBuffs) {
      applyStatus(unit, buff.name, buff.duration, state.turn);
    }
  }

  // Debuff immunity stacks are modeled as Barrier charges for now.
  if (payload.debuffImmunityCount && payload.debuffImmunityCount > 0) {
    applyStatus(unit, "Barrier", payload.debuffImmunityCount, state.turn);
  }

  if (payload.adjacentAuraStatus) {
    const adjacents = getAdjacentUnits(unit, player.units);
    for (const adjacent of adjacents) {
      applyStatus(
        adjacent,
        payload.adjacentAuraStatus.name,
        payload.adjacentAuraStatus.duration,
        state.turn,
        undefined,
        unit.instanceId,
      );
    }
  }

  // Stat bonuses can be permanent or active only while source is alive/active.
  if (payload.statBonus) {
    let canApplyStatBonus = true;
    if (
      payload.requiredAnyAllyTypes &&
      payload.requiredAnyAllyTypes.length > 0 &&
      !getAllUnits(player).some((ally) =>
        payload.requiredAnyAllyTypes!.includes(ally.type),
      )
    ) {
      canApplyStatBonus = false;
    }

    if (!canApplyStatBonus) {
      // Condition not met.
    } else if (payload.statBonusTarget === "allAllies") {
      const allies = getAllUnits(player).filter((ally) => ally.hp > 0);
      for (const ally of allies) {
        if (
          payload.applyToAllyTypes &&
          payload.applyToAllyTypes.length > 0 &&
          !payload.applyToAllyTypes.includes(ally.type)
        ) {
          continue;
        }
        if (payload.statBonusDurationMode === "whileSourceActive") {
          applyTrackedStatAuraToUnit(
            ally,
            unit.instanceId,
            passive.key,
            payload.statBonus,
          );
        } else {
          applyStatBonusToUnit(ally, payload.statBonus);
        }
      }
    } else if (payload.statBonusTarget === "allEnemies") {
      const enemies = getAllUnits(opponent).filter((enemy) => enemy.hp > 0);
      for (const enemy of enemies) {
        if (payload.statBonusDurationMode === "whileSourceActive") {
          applyTrackedStatAuraToUnit(
            enemy,
            unit.instanceId,
            passive.key,
            payload.statBonus,
          );
        } else {
          applyStatBonusToUnit(enemy, payload.statBonus);
        }
      }
    } else {
      if (payload.statBonusDurationMode === "whileSourceActive") {
        applyTrackedStatAuraToUnit(
          unit,
          unit.instanceId,
          passive.key,
          payload.statBonus,
        );
      } else {
        applyStatBonusToUnit(unit, payload.statBonus);
      }
    }
  }

  // Generic passive status application (e.g., onBelowHp self buffs like Empower/Barrier).
  if (
    payload.applyStatuses &&
    payload.trigger !== "onDamageDealt" &&
    payload.trigger !== "onHealAlly"
  ) {
    for (const statusDef of payload.applyStatuses) {
      const statusTargetMode = statusDef.target ?? payload.target ?? "self";
      const statusTargets = getEffectiveTargetUnits(
        state,
        unit,
        {
          ...payload,
          target: statusTargetMode,
          targetSelector: statusDef.targetSelector ?? payload.targetSelector,
        },
        undefined,
      );
      for (const targetUnit of statusTargets) {
        if (targetUnit.hp <= 0) continue;
        applyStatus(
          targetUnit,
          statusDef.name,
          statusDef.duration || 1,
          state.turn,
          statusDef.magnitude,
        );
      }
    }
  }

  // Lifesteal-style passive triggered from damage events.
  if (
    payload.lifestealPct &&
    typeof context?.damage === "number" &&
    unit.hp > 0
  ) {
    const healAmount = Math.floor(context.damage * payload.lifestealPct);
    if (healAmount > 0) {
      const healResult = applyHealing(unit, healAmount, unit.instanceId);
      logEvent(state, { ...healResult.event, turn: state.turn });
    }
  }

  // Apply statuses on damage events to either attacker or damage target.
  if (payload.applyStatuses && payload.trigger === "onDamageDealt") {
    if (payload.onBasicOnly && context?.abilityType !== "basic") {
      // skip
    } else if (typeof context?.targetId === "string") {
      const damageTarget = findUnit(state, context.targetId);
      if (damageTarget && damageTarget.hp > 0) {
        for (const statusDef of payload.applyStatuses) {
          applyStatus(
            damageTarget,
            statusDef.name,
            statusDef.duration || 1,
            state.turn,
            statusDef.magnitude,
          );
        }
      }
    }
  }

  if (
    payload.trigger === "onDamageTaken" &&
    typeof context?.attackerId === "string"
  ) {
    const attacker = findUnit(state, context.attackerId);
    if (attacker && attacker.hp > 0) {
      if (payload.applyStatusesToAttacker) {
        for (const statusDef of payload.applyStatusesToAttacker) {
          applyStatus(
            attacker,
            statusDef.name,
            statusDef.duration || 1,
            state.turn,
            statusDef.magnitude,
          );
        }
      }
      const randomStatuses = getRandomStatusesFromPayload(payload);
      if (randomStatuses.length > 0) {
        applyRandomStatusToTarget(state, rng, attacker, randomStatuses);
      }
    }
  }

  if (
    payload.stealBuffCount &&
    payload.trigger === "onDamageDealt" &&
    typeof context?.targetId === "string"
  ) {
    const damageTarget = findUnit(state, context.targetId);
    if (damageTarget && damageTarget.hp > 0) {
      const targetBuffs = getBuffs(damageTarget).slice(
        0,
        payload.stealBuffCount,
      );
      for (const buff of targetBuffs) {
        damageTarget.statuses = damageTarget.statuses.filter((s) => s !== buff);
        applyStatus(unit, buff.name, buff.duration, state.turn, buff.magnitude);
      }
    }
  }

  if (
    payload.applyStatuses &&
    payload.trigger === "onHealAlly" &&
    typeof context?.targetId === "string"
  ) {
    const healTarget = findUnit(state, context.targetId);
    if (healTarget && healTarget.hp > 0) {
      for (const statusDef of payload.applyStatuses) {
        applyStatus(
          healTarget,
          statusDef.name,
          statusDef.duration || 1,
          state.turn,
          statusDef.magnitude,
        );
      }
    }
  }
}

/**
 * Execute a basic attack
 */
export function executeBasicAttack(
  state: BattleState,
  rng: SeededRng,
  actor: UnitState,
  target: UnitState,
): void {
  const currentPlayer = getCurrentPlayer(state);
  const opponent = getOpponent(state);
  target = maybeRedirectSingleTarget(state, rng, opponent, target);

  const stunnedResult = consumeStunned(actor);
  if (stunnedResult.consumed) {
    logEvent(
      state,
      createEvent(state, "stun_consume", {
        unitId: actor.instanceId,
        energyPenalty: 1,
      }),
    );
  }

  // Check freeze (consumes freeze and skips action)
  const freezeResult = consumeFreeze(actor);
  if (freezeResult.skipped) {
    logEvent(
      state,
      createEvent(state, "freeze_skip", {
        unitId: actor.instanceId,
      }),
    );
    return;
  }
  // Log ability start
  logEvent(
    state,
    createEvent(state, "abilityStart", {
      actorId: actor.instanceId,
      targetId: target.instanceId,
      abilityType: "basic",
    }),
  );

  consumeStealthIfPresent(state, actor);

  if (maybeResolveCounter(state, rng, actor, target, currentPlayer, opponent)) {
    maybeConsumeEmpower(state, actor);
    return;
  }

  // Team-wide passive crit bonus for basic attacks.
  let bonusCritChance = 0;
  for (const ally of currentPlayer.units) {
    if (ally.hp <= 0) continue;
    for (const passiveKey of ally.passives) {
      const passive = getAbilityDefinition(
        passiveKey,
        state.abilityDefinitions,
      );
      if (!passive || passive.payload.bonusCritChanceBasic === undefined)
        continue;
      bonusCritChance += passive.payload.bonusCritChanceBasic;
    }
  }

  // Calculate and apply damage
  const debuffBonusPct = getBonusDamageVsDebuffedTargetsPct(
    state,
    actor,
    target,
  );
  const damageContext = calculateDamage(actor, target, rng, {
    damageMul: 1.0 * (1 + debuffBonusPct),
    bonusCritChance,
    incomingDamageReductionPct: getIncomingDamageReductionPct(state, target),
  });

  const damageResult = applyDamage(
    target,
    damageContext.actualDamage,
    actor.instanceId,
    damageContext,
    state.turn,
  );
  applyFatalPreventionToDamageResult(state, opponent, target, damageResult);
  maybeApplyCoverRedirect(
    state,
    rng,
    target,
    opponent,
    actor,
    damageResult,
    damageContext.actualDamage,
  );

  // Log damage events
  for (const event of damageResult.events) {
    logEvent(state, { ...event, turn: state.turn });
  }

  // Trigger damage-based passives
  if (damageContext.actualDamage > 0) {
    triggerPassives(state, rng, "onDamageDealt", currentPlayer, {
      attackerId: actor.instanceId,
      targetId: target.instanceId,
      damage: damageContext.actualDamage,
      abilityType: "basic",
    });
    triggerPassives(state, rng, "onDealDamage", currentPlayer, {
      attackerId: actor.instanceId,
      targetId: target.instanceId,
      damage: damageContext.actualDamage,
      abilityType: "basic",
    });

    target.hitsTaken = (target.hitsTaken || 0) + 1;
    triggerPassives(state, rng, "onDamageTaken", opponent, {
      targetId: target.instanceId,
      damage: damageContext.actualDamage,
      attackerId: actor.instanceId,
    });
    triggerPassives(state, rng, "onBelowHp", opponent, {
      unitId: target.instanceId,
    });
  }

  if (damageContext.actualDamage > 0) {
    maybeApplyThornsReflection(
      state,
      rng,
      actor,
      target,
      opponent,
      currentPlayer,
      damageContext.actualDamage,
    );
  }

  // Handle KO
  if (damageResult.isKo) {
    handleKo(state, rng, target.instanceId, opponent);
  }

  // Check if Haste free basic was used
  if (hasStatus(actor, "Haste") && !currentPlayer.hasUsedFreeBasic) {
    currentPlayer.hasUsedFreeBasic = true;
  }

  maybeConsumeEmpower(state, actor);
}

/**
 * Execute a skill ability
 */
export function executeSkill(
  state: BattleState,
  rng: SeededRng,
  actor: UnitState,
  targetInstanceId: string | undefined,
  abilityKey: string,
  opts?: { skipCooldownTracking?: boolean; skipAbilityStartLog?: boolean },
): void {
  const currentPlayer = getCurrentPlayer(state);
  const opponent = getOpponent(state);
  const ability = getAbilityDefinition(abilityKey, state.abilityDefinitions);
  if (!ability) return;

  const payload = ability.payload;
  const targetMode = getAbilityTarget(payload);
  const primaryTargets = getEffectiveTargetUnits(
    state,
    actor,
    payload,
    targetInstanceId,
  );
  let target = primaryTargets[0] ?? actor;
  let resolvedTargetInstanceId = targetInstanceId;
  const targetIsEnemy = opponent.units.some(
    (u) => u.instanceId === target.instanceId,
  );
  if (targetIsEnemy) {
    target = maybeRedirectSingleTarget(state, rng, opponent, target);
    resolvedTargetInstanceId = target.instanceId;
  }

  const stunnedResult = consumeStunned(actor);
  if (stunnedResult.consumed) {
    logEvent(
      state,
      createEvent(state, "stun_consume", {
        unitId: actor.instanceId,
        energyPenalty: 1,
      }),
    );
  }

  // Check freeze
  const freezeResult = consumeFreeze(actor);
  if (freezeResult.skipped) {
    logEvent(
      state,
      createEvent(state, "freeze_skip", {
        unitId: actor.instanceId,
      }),
    );
    return;
  }

  // Log ability start
  if (!opts?.skipAbilityStartLog) {
    logEvent(
      state,
      createEvent(state, "abilityStart", {
        actorId: actor.instanceId,
        targetId: resolvedTargetInstanceId ?? target.instanceId,
        abilityKey,
        abilityType: "skill",
      }),
    );
  }

  if (payload.revivePct && resolvedTargetInstanceId) {
    const reviveTarget = getKoAllies(currentPlayer).find(
      (unit) => unit.instanceId === resolvedTargetInstanceId,
    );
    if (reviveTarget) {
      reviveTarget.hp = Math.floor(reviveTarget.maxHp * payload.revivePct);
      if (payload.applyStatuses) {
        for (const statusDef of payload.applyStatuses) {
          applyStatus(
            reviveTarget,
            statusDef.name,
            statusDef.duration || 1,
            state.turn,
            statusDef.magnitude,
          );
        }
      }
      if (reviveTarget.position !== null) {
        applySourceActiveStatAuras(state, reviveTarget, currentPlayer);
      }
      logEvent(
        state,
        createEvent(state, "revive", {
          targetId: reviveTarget.instanceId,
          hp: reviveTarget.hp,
          source: abilityKey,
        }),
      );
    }

    if (!opts?.skipCooldownTracking && ability.cooldown) {
      actor.cooldowns[abilityKey] = ability.cooldown;
    }
    return;
  }

  const isOffensiveSkill = payload.damageMul !== undefined;
  if (isOffensiveSkill) {
    consumeStealthIfPresent(state, actor);
  }

  let totalDamageDealt = 0;
  let didExecuteBonus = false;

  // Execute damage if applicable
  if (payload.damageMul !== undefined) {
    const hitCount = payload.hits ?? 1;

    for (let hit = 0; hit < hitCount; hit++) {
      if (target.hp <= 0) break;
      if (actor.hp <= 0) break;
      if (
        maybeResolveCounter(state, rng, actor, target, currentPlayer, opponent)
      ) {
        break;
      }
      const targetHpRatioBeforeHit = target.hp / target.maxHp;

      // Check conditional damage multiplier
      let damageMul = payload.damageMul;
      if (payload.conditional) {
        for (const cond of payload.conditional) {
          if (
            conditionMatchesTarget(cond.when as Record<string, unknown>, target)
          ) {
            damageMul += cond.damageMulDelta || 0;
          }
        }
      }

      // Execute-style override (e.g., Kee-Oth Crimson Lash)
      if (
        payload.executeThreshold !== undefined &&
        payload.executeDamageMul !== undefined
      ) {
        if (target.hp / target.maxHp <= payload.executeThreshold) {
          damageMul = payload.executeDamageMul;
          didExecuteBonus = true;
        }
      }

      const damageContext = calculateDamage(actor, target, rng, {
        damageMul:
          damageMul *
          (1 + getBonusDamageVsDebuffedTargetsPct(state, actor, target)),
        ignoreDefensePct: payload.ignoreDefensePct,
        incomingDamageReductionPct: getIncomingDamageReductionPct(
          state,
          target,
        ),
      });

      const damageResult = applyDamage(
        target,
        damageContext.actualDamage,
        actor.instanceId,
        damageContext,
        state.turn,
      );
      applyFatalPreventionToDamageResult(state, opponent, target, damageResult);
      maybeApplyCoverRedirect(
        state,
        rng,
        target,
        opponent,
        actor,
        damageResult,
        damageContext.actualDamage,
      );

      for (const event of damageResult.events) {
        logEvent(state, { ...event, turn: state.turn });
      }

      totalDamageDealt += damageContext.actualDamage;

      if (damageContext.actualDamage > 0) {
        triggerPassives(state, rng, "onDamageDealt", currentPlayer, {
          attackerId: actor.instanceId,
          targetId: target.instanceId,
          damage: damageContext.actualDamage,
          abilityType: "skill",
        });
        triggerPassives(state, rng, "onDealDamage", currentPlayer, {
          attackerId: actor.instanceId,
          targetId: target.instanceId,
          damage: damageContext.actualDamage,
          abilityType: "skill",
        });

        target.hitsTaken = (target.hitsTaken || 0) + 1;
        triggerPassives(state, rng, "onDamageTaken", opponent, {
          targetId: target.instanceId,
          damage: damageContext.actualDamage,
          attackerId: actor.instanceId,
        });
        triggerPassives(state, rng, "onBelowHp", opponent, {
          unitId: target.instanceId,
        });
        maybeApplyThornsReflection(
          state,
          rng,
          actor,
          target,
          opponent,
          currentPlayer,
          damageContext.actualDamage,
        );
      }

      if (damageResult.isKo) {
        handleKo(state, rng, target.instanceId, opponent);
      } else if (
        payload.instantKoIfTargetBelowHpPct !== undefined &&
        targetHpRatioBeforeHit <= payload.instantKoIfTargetBelowHpPct &&
        target.hp > 0
      ) {
        forceKoWithFatalPrevention(state, rng, actor, opponent, target);
      }
    }

    // Lifesteal
    if (payload.healPctOfDamage && totalDamageDealt > 0 && actor.hp > 0) {
      const healAmount = calculateLifesteal(
        totalDamageDealt,
        payload.healPctOfDamage,
      );
      const healResult = applyHealing(actor, healAmount, actor.instanceId);
      logEvent(state, { ...healResult.event, turn: state.turn });
    }

    // Heal the lowest HP ally based on damage dealt.
    if (payload.healLowestAllyPctOfDamage && totalDamageDealt > 0) {
      const allies = currentPlayer.units.filter((u) => u.hp > 0);
      if (allies.length > 0) {
        const lowestHpAlly = allies.reduce((a, b) =>
          a.hp / a.maxHp <= b.hp / b.maxHp ? a : b,
        );
        const healAmount = Math.floor(
          totalDamageDealt * payload.healLowestAllyPctOfDamage,
        );
        if (healAmount > 0) {
          applyAllyHealing(
            state,
            rng,
            currentPlayer,
            actor,
            lowestHpAlly,
            healAmount,
          );
        }
      }
    }

    // Execute bonus healing (e.g., Kee-Oth Crimson Lash).
    if (didExecuteBonus && payload.healPctOfMaxHpOnExecute && actor.hp > 0) {
      const healAmount = Math.floor(
        actor.maxHp * payload.healPctOfMaxHpOnExecute,
      );
      const healResult = applyHealing(actor, healAmount, actor.instanceId);
      logEvent(state, { ...healResult.event, turn: state.turn });
    }
  }

  if (isOffensiveSkill) {
    maybeConsumeEmpower(state, actor);
  }

  // Apply statuses to target(s)
  if (payload.applyStatuses) {
    for (const statusDef of payload.applyStatuses) {
      const statusTargetMode = statusDef.target ?? targetMode;
      const statusTargets = getEffectiveTargetUnits(
        state,
        actor,
        {
          ...payload,
          target: statusTargetMode,
          targetSelector: statusDef.targetSelector ?? payload.targetSelector,
        },
        resolvedTargetInstanceId,
      );
      for (const statusTarget of statusTargets) {
        if (statusTarget.hp <= 0) continue;
        let applied = false;
        if (
          payload.applyStatusChance === undefined ||
          rng.nextBool(payload.applyStatusChance)
        ) {
          const statusResult = applyStatus(
            statusTarget,
            statusDef.name,
            statusDef.duration || 1,
            state.turn,
            statusDef.magnitude,
          );
          applied = statusResult.applied;
        }

        // Trigger ember core if burn was applied
        if (statusDef.name === "Burn" && applied) {
          triggerPassives(state, rng, "onStatusApplied", currentPlayer, {
            statusName: "Burn",
            targetId: statusTarget.instanceId,
          });
        }
      }
    }
  }

  // Check conditional status application
  if (payload.conditional) {
    for (const cond of payload.conditional) {
      if (
        conditionMatchesTarget(cond.when as Record<string, unknown>, target)
      ) {
        if (cond.addApplyStatuses) {
          for (const statusDef of cond.addApplyStatuses) {
            applyStatus(
              target,
              statusDef.name,
              statusDef.duration || 1,
              state.turn,
            );
          }
        }
      }
    }
  }

  const randomStatuses = getRandomStatusesFromPayload(payload);
  if (randomStatuses.length > 0) {
    for (const statusTarget of primaryTargets) {
      if (statusTarget.hp <= 0) continue;
      applyRandomStatusToTarget(state, rng, statusTarget, randomStatuses);
    }
  }

  if (payload.increaseTargetCooldowns && payload.increaseTargetCooldowns > 0) {
    for (const targetUnit of primaryTargets) {
      for (const key of Object.keys(targetUnit.cooldowns)) {
        targetUnit.cooldowns[key] += payload.increaseTargetCooldowns;
      }
    }
  }

  if (payload.stealBuffCount && payload.stealBuffCount > 0) {
    for (const targetUnit of primaryTargets) {
      const targetBuffs = getBuffs(targetUnit);
      const stolen = targetBuffs.slice(0, payload.stealBuffCount);
      for (const buff of stolen) {
        targetUnit.statuses = targetUnit.statuses.filter((s) => s !== buff);
        applyStatus(
          actor,
          buff.name,
          buff.duration,
          state.turn,
          buff.magnitude,
        );
      }
    }
  }

  if (payload.healPctOfMaxHp) {
    for (const ally of primaryTargets) {
      if (ally.hp <= 0) continue;
      const healAmount = Math.floor(ally.maxHp * payload.healPctOfMaxHp);
      applyAllyHealing(state, rng, currentPlayer, actor, ally, healAmount);
    }
  }

  if (payload.shieldPctOfMaxHp) {
    const shieldTarget = payload.shieldTarget
      ? payload.shieldTarget
      : targetMode === "allAllies"
        ? "allAllies"
        : targetMode === "self"
          ? "self"
          : "target";
    applyShieldByTarget(
      actor,
      currentPlayer,
      target,
      payload.shieldPctOfMaxHp,
      shieldTarget,
      state.turn,
    );
  }

  // Haste to ally (Prismo Time Nudge, BMO Overclock)
  if (payload.applyStatuses?.some((s) => s.name === "Haste")) {
    // Check if target is Hero and should reduce cooldowns
    if (payload.reduceCooldowns) {
      for (const targetUnit of primaryTargets) {
        if (targetUnit.type !== "Hero") continue;
        for (const key of Object.keys(targetUnit.cooldowns)) {
          targetUnit.cooldowns[key] = Math.max(
            0,
            targetUnit.cooldowns[key] - payload.reduceCooldowns,
          );
        }
      }
    }
  }

  // Self-damage after resolving effects (e.g., blood sacrifice skills).
  if (payload.selfDamagePct && actor.hp > 1) {
    const selfDamage = Math.floor(actor.hp * payload.selfDamagePct);
    actor.hp = Math.max(1, actor.hp - selfDamage);
  }

  // Set cooldown (skipped when called by executeCopy which manages it separately)
  if (!opts?.skipCooldownTracking && ability.cooldown) {
    actor.cooldowns[abilityKey] = ability.cooldown;
  }
}

/**
 * Execute an ultimate ability
 */
export function executeUltimate(
  state: BattleState,
  rng: SeededRng,
  actor: UnitState,
  targetInstanceId: string | undefined,
  abilityKey: string,
  opts?: { skipCooldownTracking?: boolean },
): void {
  const currentPlayer = getCurrentPlayer(state);
  const opponent = getOpponent(state);

  const stunnedResult = consumeStunned(actor);
  if (stunnedResult.consumed) {
    logEvent(
      state,
      createEvent(state, "stun_consume", {
        unitId: actor.instanceId,
        energyPenalty: 1,
      }),
    );
  }

  // Check freeze
  const freezeResult = consumeFreeze(actor);
  if (freezeResult.skipped) {
    logEvent(
      state,
      createEvent(state, "freeze_skip", {
        unitId: actor.instanceId,
      }),
    );
    return;
  }

  const ability = getAbilityDefinition(abilityKey, state.abilityDefinitions);
  if (!ability) return;

  // Log ability start
  logEvent(
    state,
    createEvent(state, "abilityStart", {
      actorId: actor.instanceId,
      targetId: targetInstanceId,
      abilityKey,
      abilityType: "ultimate",
    }),
  );

  const payload = ability.payload;
  const targetMode = getAbilityTarget(payload);
  let resolvedTargetInstanceId = targetInstanceId;
  const isOffensiveUltimate = payload.damageMul !== undefined;
  if (isOffensiveUltimate) {
    consumeStealthIfPresent(state, actor);
  }

  if (resolvedTargetInstanceId && !payload.revivePct) {
    const maybeTarget = findUnit(state, resolvedTargetInstanceId);
    const targetIsEnemy =
      maybeTarget &&
      opponent.units.some((u) => u.instanceId === maybeTarget.instanceId);
    if (targetIsEnemy && (targetMode === "enemy" || targetMode === "any")) {
      resolvedTargetInstanceId = maybeRedirectSingleTarget(
        state,
        rng,
        opponent,
        maybeTarget,
      ).instanceId;
    }
  }
  const primaryTargets = getEffectiveTargetUnits(
    state,
    actor,
    payload,
    resolvedTargetInstanceId,
  );
  const primaryTarget = primaryTargets[0];

  // Mark ultimate as used (skipped when called by executeCopy which manages it separately)
  if (!opts?.skipCooldownTracking) {
    actor.usedUltimate = true;
  }
  let totalDamageDealt = 0;

  // Arm delayed revive-on-enemy-KO effects from payload.
  if (payload.reviveAllyOnEnemyKoPct) {
    armReviveOnEnemyKo(actor, abilityKey, payload.reviveAllyOnEnemyKoPct);
  }

  // Self-sacrifice style ultimates.
  if (payload.selfDamagePct && actor.hp > 1) {
    const selfDamage = Math.floor(actor.hp * payload.selfDamagePct);
    actor.hp = Math.max(1, actor.hp - selfDamage);
  }

  // Handle revive (Prismo Rewind)
  if (payload.revivePct && resolvedTargetInstanceId) {
    const target = getKoAllies(currentPlayer).find(
      (u) => u.instanceId === resolvedTargetInstanceId,
    );
    if (target) {
      target.hp = Math.floor(target.maxHp * payload.revivePct);
      if (payload.applyStatuses) {
        for (const statusDef of payload.applyStatuses) {
          applyStatus(
            target,
            statusDef.name,
            statusDef.duration || 1,
            state.turn,
          );
        }
      }
      if (target.position !== null) {
        applySourceActiveStatAuras(state, target, currentPlayer);
      }
      logEvent(
        state,
        createEvent(state, "revive", {
          targetId: target.instanceId,
          hp: target.hp,
        }),
      );
    }
    return;
  }

  if (payload.swapHpPercentages && resolvedTargetInstanceId) {
    const target = findUnit(state, resolvedTargetInstanceId);
    if (target && target.hp > 0) {
      const actorPct = actor.hp / actor.maxHp;
      const targetPct = target.hp / target.maxHp;
      actor.hp = Math.max(1, Math.floor(actor.maxHp * targetPct));
      target.hp = Math.max(1, Math.floor(target.maxHp * actorPct));
    }
  }

  // Handle damage to all enemies
  if (
    payload.damageMul !== undefined &&
    (targetMode === "allEnemies" || targetMode === "all")
  ) {
    for (const enemy of opponent.units) {
      if (enemy.hp <= 0) continue;
      if (actor.hp <= 0) break;
      if (
        maybeResolveCounter(state, rng, actor, enemy, currentPlayer, opponent)
      ) {
        continue;
      }

      const damageContext = calculateDamage(actor, enemy, rng, {
        damageMul:
          payload.damageMul *
          (1 + getBonusDamageVsDebuffedTargetsPct(state, actor, enemy)),
        incomingDamageReductionPct: getIncomingDamageReductionPct(state, enemy),
        isBurnBonus: payload.burnBonusMul !== undefined,
        burnBonusMul: payload.burnBonusMul || 0,
      });

      const damageResult = applyDamage(
        enemy,
        damageContext.actualDamage,
        actor.instanceId,
        damageContext,
        state.turn,
      );
      applyFatalPreventionToDamageResult(state, opponent, enemy, damageResult);

      for (const event of damageResult.events) {
        logEvent(state, { ...event, turn: state.turn });
      }
      totalDamageDealt += damageContext.actualDamage;

      if (damageContext.actualDamage > 0) {
        triggerPassives(state, rng, "onDamageDealt", currentPlayer, {
          attackerId: actor.instanceId,
          targetId: enemy.instanceId,
          damage: damageContext.actualDamage,
          abilityType: "ultimate",
        });
        triggerPassives(state, rng, "onDealDamage", currentPlayer, {
          attackerId: actor.instanceId,
          targetId: enemy.instanceId,
          damage: damageContext.actualDamage,
          abilityType: "ultimate",
        });
        enemy.hitsTaken = (enemy.hitsTaken || 0) + 1;
        triggerPassives(state, rng, "onDamageTaken", opponent, {
          targetId: enemy.instanceId,
          damage: damageContext.actualDamage,
          attackerId: actor.instanceId,
        });
        triggerPassives(state, rng, "onBelowHp", opponent, {
          unitId: enemy.instanceId,
        });
        maybeApplyThornsReflection(
          state,
          rng,
          actor,
          enemy,
          opponent,
          currentPlayer,
          damageContext.actualDamage,
        );
      }

      if (damageResult.isKo) {
        handleKo(state, rng, enemy.instanceId, opponent);
      }
    }
  }

  // Generic single-target ultimate damage.
  if (
    payload.damageMul !== undefined &&
    targetMode !== "allEnemies" &&
    targetMode !== "all" &&
    payload.splashPct === undefined &&
    primaryTarget &&
    primaryTarget.hp > 0
  ) {
    const target = primaryTarget;
    if (
      maybeResolveCounter(state, rng, actor, target, currentPlayer, opponent)
    ) {
      if (isOffensiveUltimate) {
        maybeConsumeEmpower(state, actor);
      }
      return;
    }
    const damageContext = calculateDamage(actor, target, rng, {
      damageMul:
        payload.damageMul *
        (1 + getBonusDamageVsDebuffedTargetsPct(state, actor, target)),
      ignoreDefensePct: payload.ignoreDefensePct,
      incomingDamageReductionPct: getIncomingDamageReductionPct(state, target),
    });

    const damageResult = applyDamage(
      target,
      damageContext.actualDamage,
      actor.instanceId,
      damageContext,
      state.turn,
    );
    applyFatalPreventionToDamageResult(state, opponent, target, damageResult);
    maybeApplyCoverRedirect(
      state,
      rng,
      target,
      opponent,
      actor,
      damageResult,
      damageContext.actualDamage,
    );

    for (const event of damageResult.events) {
      logEvent(state, { ...event, turn: state.turn });
    }
    totalDamageDealt += damageContext.actualDamage;

    if (damageContext.actualDamage > 0) {
      triggerPassives(state, rng, "onDamageDealt", currentPlayer, {
        attackerId: actor.instanceId,
        targetId: target.instanceId,
        damage: damageContext.actualDamage,
        abilityType: "ultimate",
      });
      triggerPassives(state, rng, "onDealDamage", currentPlayer, {
        attackerId: actor.instanceId,
        targetId: target.instanceId,
        damage: damageContext.actualDamage,
        abilityType: "ultimate",
      });
      target.hitsTaken = (target.hitsTaken || 0) + 1;
      triggerPassives(state, rng, "onDamageTaken", opponent, {
        targetId: target.instanceId,
        damage: damageContext.actualDamage,
        attackerId: actor.instanceId,
      });
      triggerPassives(state, rng, "onBelowHp", opponent, {
        unitId: target.instanceId,
      });
      maybeApplyThornsReflection(
        state,
        rng,
        actor,
        target,
        opponent,
        currentPlayer,
        damageContext.actualDamage,
      );
    }

    if (damageResult.isKo) {
      handleKo(state, rng, target.instanceId, opponent);
    }
  }

  // Handle single target damage with splash (Ice King Absolute Zero)
  if (
    payload.damageMul !== undefined &&
    payload.splashPct !== undefined &&
    primaryTarget &&
    primaryTarget.hp > 0 &&
    targetMode !== "allEnemies" &&
    targetMode !== "all"
  ) {
    const target = primaryTarget;
    if (
      maybeResolveCounter(state, rng, actor, target, currentPlayer, opponent)
    ) {
      if (isOffensiveUltimate) {
        maybeConsumeEmpower(state, actor);
      }
      return;
    }
    const damageContext = calculateDamage(actor, target, rng, {
      damageMul:
        payload.damageMul *
        (1 + getBonusDamageVsDebuffedTargetsPct(state, actor, target)),
      incomingDamageReductionPct: getIncomingDamageReductionPct(state, target),
    });

    const damageResult = applyDamage(
      target,
      damageContext.actualDamage,
      actor.instanceId,
      damageContext,
      state.turn,
    );
    applyFatalPreventionToDamageResult(state, opponent, target, damageResult);
    maybeApplyCoverRedirect(
      state,
      rng,
      target,
      opponent,
      actor,
      damageResult,
      damageContext.actualDamage,
    );

    for (const event of damageResult.events) {
      logEvent(state, { ...event, turn: state.turn });
    }
    totalDamageDealt += damageContext.actualDamage;

    if (damageContext.actualDamage > 0) {
      triggerPassives(state, rng, "onDamageDealt", currentPlayer, {
        attackerId: actor.instanceId,
        targetId: target.instanceId,
        damage: damageContext.actualDamage,
        abilityType: "ultimate",
      });
      triggerPassives(state, rng, "onDealDamage", currentPlayer, {
        attackerId: actor.instanceId,
        targetId: target.instanceId,
        damage: damageContext.actualDamage,
        abilityType: "ultimate",
      });
      target.hitsTaken = (target.hitsTaken || 0) + 1;
      triggerPassives(state, rng, "onDamageTaken", opponent, {
        targetId: target.instanceId,
        damage: damageContext.actualDamage,
        attackerId: actor.instanceId,
      });
      triggerPassives(state, rng, "onBelowHp", opponent, {
        unitId: target.instanceId,
      });
      maybeApplyThornsReflection(
        state,
        rng,
        actor,
        target,
        opponent,
        currentPlayer,
        damageContext.actualDamage,
      );
    }
    if (damageResult.isKo) {
      handleKo(state, rng, target.instanceId, opponent);
    }

    // Splash damage to adjacent
    const adjacentUnits = getAdjacentUnits(target, opponent.units);
    for (const adjacent of adjacentUnits) {
      if (adjacent.hp <= 0) continue;
      if (actor.hp <= 0) break;
      if (
        maybeResolveCounter(
          state,
          rng,
          actor,
          adjacent,
          currentPlayer,
          opponent,
        )
      ) {
        continue;
      }

      const splashDamageContext = calculateDamage(actor, adjacent, rng, {
        damageMul:
          payload.damageMul *
          payload.splashPct *
          (1 + getBonusDamageVsDebuffedTargetsPct(state, actor, adjacent)),
        incomingDamageReductionPct: getIncomingDamageReductionPct(
          state,
          adjacent,
        ),
      });

      const splashResult = applyDamage(
        adjacent,
        splashDamageContext.actualDamage,
        actor.instanceId,
        splashDamageContext,
        state.turn,
      );
      applyFatalPreventionToDamageResult(
        state,
        opponent,
        adjacent,
        splashResult,
      );

      for (const event of splashResult.events) {
        logEvent(state, { ...event, turn: state.turn });
      }
      totalDamageDealt += splashDamageContext.actualDamage;

      if (splashDamageContext.actualDamage > 0) {
        triggerPassives(state, rng, "onDamageDealt", currentPlayer, {
          attackerId: actor.instanceId,
          targetId: adjacent.instanceId,
          damage: splashDamageContext.actualDamage,
          abilityType: "ultimate",
        });
        triggerPassives(state, rng, "onDealDamage", currentPlayer, {
          attackerId: actor.instanceId,
          targetId: adjacent.instanceId,
          damage: splashDamageContext.actualDamage,
          abilityType: "ultimate",
        });
        adjacent.hitsTaken = (adjacent.hitsTaken || 0) + 1;
        triggerPassives(state, rng, "onDamageTaken", opponent, {
          targetId: adjacent.instanceId,
          damage: splashDamageContext.actualDamage,
          attackerId: actor.instanceId,
        });
        triggerPassives(state, rng, "onBelowHp", opponent, {
          unitId: adjacent.instanceId,
        });
        maybeApplyThornsReflection(
          state,
          rng,
          actor,
          adjacent,
          opponent,
          currentPlayer,
          splashDamageContext.actualDamage,
        );
      }
      if (splashResult.isKo) {
        handleKo(state, rng, adjacent.instanceId, opponent);
      }
    }
  }
  if (isOffensiveUltimate) {
    maybeConsumeEmpower(state, actor);
  }

  if (payload.cleanse?.count) {
    const cleanseTargetMode =
      (payload.cleanse.target as AbilityTarget | undefined) ?? targetMode;
    const cleanseTargets = getTargetUnits(
      state,
      actor,
      cleanseTargetMode,
      resolvedTargetInstanceId,
    );
    for (const unit of cleanseTargets) {
      if (unit.hp <= 0) continue;
      if (payload.cleanseAllStatuses) {
        unit.statuses = [];
      } else {
        cleanseDebuffs(unit, payload.cleanse.count);
      }
    }
  }
  if (payload.alsoCleanseAllEnemies && payload.cleanse?.count) {
    for (const enemy of opponent.units) {
      if (enemy.hp <= 0) continue;
      if (payload.cleanseAllStatuses) {
        enemy.statuses = [];
      } else {
        cleanseDebuffs(enemy, payload.cleanse.count);
      }
    }
  }

  if (payload.healPctOfMaxHp) {
    for (const ally of primaryTargets) {
      if (ally.hp <= 0) continue;
      const healAmount = Math.floor(ally.maxHp * payload.healPctOfMaxHp);
      applyAllyHealing(state, rng, currentPlayer, actor, ally, healAmount);
    }
  }

  if (payload.healPctOfDamage && totalDamageDealt > 0 && actor.hp > 0) {
    const healAmount = calculateLifesteal(
      totalDamageDealt,
      payload.healPctOfDamage,
    );
    const healResult = applyHealing(actor, healAmount, actor.instanceId);
    logEvent(state, { ...healResult.event, turn: state.turn });
  }

  if (payload.shieldPctOfMaxHp) {
    const shieldTarget = payload.shieldTarget
      ? payload.shieldTarget
      : targetMode === "allAllies"
        ? "allAllies"
        : targetMode === "self"
          ? "self"
          : "target";
    applyShieldByTarget(
      actor,
      currentPlayer,
      primaryTarget,
      payload.shieldPctOfMaxHp,
      shieldTarget,
      state.turn,
    );
  }

  if (payload.applyStatuses) {
    for (const statusDef of payload.applyStatuses) {
      const statusTargetMode = statusDef.target ?? targetMode;
      const statusTargets = getEffectiveTargetUnits(
        state,
        actor,
        {
          ...payload,
          target: statusTargetMode,
          targetSelector: statusDef.targetSelector ?? payload.targetSelector,
        },
        resolvedTargetInstanceId,
      );
      for (const statusTarget of statusTargets) {
        if (statusTarget.hp <= 0) continue;
        applyStatus(
          statusTarget,
          statusDef.name,
          statusDef.duration || 1,
          state.turn,
          statusDef.magnitude,
        );
      }
    }
  }

  const randomStatuses = getRandomStatusesFromPayload(payload);
  if (randomStatuses.length > 0) {
    for (const statusTarget of primaryTargets) {
      if (statusTarget.hp <= 0) continue;
      applyRandomStatusToTarget(state, rng, statusTarget, randomStatuses);
    }
  }

  if (payload.reduceEnemyCooldowns && payload.reduceEnemyCooldowns > 0) {
    for (const enemy of [...opponent.units, ...opponent.bench]) {
      for (const key of Object.keys(enemy.cooldowns)) {
        enemy.cooldowns[key] = Math.max(
          0,
          enemy.cooldowns[key] - payload.reduceEnemyCooldowns,
        );
      }
    }
  }
}

/**
 * Execute a copy action: borrow a skill or ultimate from a source unit and
 * execute its payload as if the actor owned it. Cooldown/usedUltimate tracking
 * is applied to the COPY ability's own key, not the copied ability's key.
 */
export function executeCopy(
  state: BattleState,
  rng: SeededRng,
  actor: UnitState,
  copyAbilityKey: string,
  isUltimateCopyAbility: boolean,
  sourceUnit: UnitState,
  targetInstanceId: string | undefined,
  copyAbilityType: "SKILL" | "ULTIMATE",
): void {
  // Stun check (penalise but continue)
  const stunnedResult = consumeStunned(actor);
  if (stunnedResult.consumed) {
    logEvent(
      state,
      createEvent(state, "stun_consume", {
        unitId: actor.instanceId,
        energyPenalty: 1,
      }),
    );
  }

  // Freeze check (skip execution)
  const freezeResult = consumeFreeze(actor);
  if (freezeResult.skipped) {
    logEvent(
      state,
      createEvent(state, "freeze_skip", {
        unitId: actor.instanceId,
      }),
    );
    return;
  }

  // Fetch copy ability definition early (needed for pre-copy effects and cooldown)
  const copyAbilityDef = getAbilityDefinition(
    copyAbilityKey,
    state.abilityDefinitions,
  );

  // Determine which ability key to copy from the source
  const copiedAbilityKey =
    copyAbilityType === "SKILL" ? sourceUnit.skill : sourceUnit.ultimate;
  const copiedAbilityDef = getAbilityDefinition(
    copiedAbilityKey,
    state.abilityDefinitions,
  );
  if (!copiedAbilityDef) return;

  // Log ability start — include both keys so the UI/replay can show what was copied
  logEvent(
    state,
    createEvent(state, "abilityStart", {
      actorId: actor.instanceId,
      targetId: targetInstanceId,
      abilityKey: copyAbilityKey,
      copiedAbilityKey,
      abilityType: "copy",
    }),
  );

  // Apply this copy ability's own payload as pre-copy effects (damage, statuses,
  // buffs, heals, shield) before the borrowed ability fires. Reuses executeSkill
  // with skipCooldownTracking + skipAbilityStartLog to avoid double-logging and
  // double cooldown writes. Stun/freeze are already consumed above — the internal
  // checks in executeSkill will be harmless no-ops.
  const copyPayload = copyAbilityDef?.payload;
  const canApplyPreEffects =
    !requiresTargetSelection(copyPayload ?? {}) || !!targetInstanceId;
  if (canApplyPreEffects) {
    executeSkill(state, rng, actor, targetInstanceId, copyAbilityKey, {
      skipCooldownTracking: true,
      skipAbilityStartLog: true,
    });
  }

  // Execute the copied ability's payload, skipping its own cooldown tracking
  if (copyAbilityType === "SKILL") {
    if (
      requiresTargetSelection(copiedAbilityDef.payload) &&
      !targetInstanceId
    ) {
      return; // target required but not found
    }
    executeSkill(state, rng, actor, targetInstanceId, copiedAbilityKey, {
      skipCooldownTracking: true,
    });
  } else {
    executeUltimate(state, rng, actor, targetInstanceId, copiedAbilityKey, {
      skipCooldownTracking: true,
    });
  }

  // Apply the COPY ABILITY's own cooldown / usedUltimate tracking
  if (isUltimateCopyAbility) {
    actor.usedUltimate = true;
  } else if (copyAbilityDef?.cooldown) {
    actor.cooldowns[copyAbilityKey] = copyAbilityDef.cooldown;
  }
}

/**
 * Execute a swap action
 */
export function executeSwap(
  state: BattleState,
  activeInstanceId: string,
  benchInstanceId: string,
): void {
  const currentPlayer = getCurrentPlayer(state);

  const activeUnit = currentPlayer.units.find(
    (u) => u.instanceId === activeInstanceId,
  )!;
  const benchUnit = currentPlayer.bench.find(
    (u) => u.instanceId === benchInstanceId,
  )!;

  if (hasActiveSourceStatAuras(state, activeUnit)) {
    removeTrackedAurasFromSource(state, activeUnit.instanceId);
  }

  // Save position
  const position = activeUnit.position;

  // Move active to bench
  activeUnit.position = null;
  const activeIndex = currentPlayer.units.indexOf(activeUnit);
  currentPlayer.units.splice(activeIndex, 1);
  currentPlayer.bench.push(activeUnit);

  // Move bench to active
  benchUnit.position = position;
  const benchIndex = currentPlayer.bench.indexOf(benchUnit);
  currentPlayer.bench.splice(benchIndex, 1);
  currentPlayer.units.push(benchUnit);

  // Apply summoning sickness
  applyStatus(benchUnit, "SummoningSickness", 1, state.turn);

  // Remove adjacent aura statuses coming from the swapped-out unit.
  const activeAuras = getAdjacentAuraStatuses(state, activeUnit);
  if (activeAuras.length > 0) {
    for (const ally of currentPlayer.units) {
      ally.statuses = ally.statuses.filter(
        (status) =>
          !(
            status.sourceInstanceId === activeUnit.instanceId &&
            activeAuras.some((aura) => aura.name === status.name)
          ),
      );
    }
  }

  // Apply adjacent aura statuses from the swapped-in unit.
  const benchAuras = getAdjacentAuraStatuses(state, benchUnit);
  if (benchAuras.length > 0) {
    const adjacents = getAdjacentUnits(benchUnit, currentPlayer.units);
    for (const adjacent of adjacents) {
      for (const aura of benchAuras) {
        applyStatus(
          adjacent,
          aura.name,
          aura.duration,
          state.turn,
          undefined,
          benchUnit.instanceId,
        );
      }
    }
  }

  if (hasActiveSourceStatAuras(state, benchUnit) && benchUnit.hp > 0) {
    applySourceActiveStatAuras(state, benchUnit, currentPlayer);
  }

  logEvent(
    state,
    createEvent(state, "swap", {
      activeOut: activeInstanceId,
      benchIn: benchInstanceId,
      position,
    }),
  );

  // Deduct energy
  currentPlayer.energy -= 1;
}

/**
 * End the current turn
 */
export function endTurn(state: BattleState): void {
  const currentPlayer = getCurrentPlayer(state);

  logEvent(
    state,
    createEvent(state, "turnEnd", {
      playerId: currentPlayer.userId,
      turn: state.turn,
    }),
  );

  // Switch to opponent
  const opponent = getOpponent(state);
  state.currentPlayerId = opponent.userId;
  state.turn++;
  state.turnEnded = true;
  state.actionsThisTurn = [];

  // Check for game end
  const gameEndCheck = checkGameEnd(state);
  if (gameEndCheck.ended) {
    state.phase = "ended";
    state.winnerId = gameEndCheck.winnerId;
    logEvent(
      state,
      createEvent(state, "gameOver", {
        winnerId: gameEndCheck.winnerId,
      }),
    );
  }
}

/**
 * Execute an action and update state
 */
export function executeAction(
  state: BattleState,
  rng: SeededRng,
  action: Action,
): void {
  const currentPlayer = getCurrentPlayer(state);
  const logLengthBeforeAction = state.log.length;

  switch (action.kind) {
    case "basic": {
      const actor = currentPlayer.units.find(
        (u) => u.instanceId === action.actorInstanceId,
      )!;
      const target = getOpponent(state).units.find(
        (u) => u.instanceId === action.targetInstanceId,
      )!;
      const cost = getActionEnergyCost(action, actor, state);
      currentPlayer.energy -= cost;
      executeBasicAttack(state, rng, actor, target);
      break;
    }
    case "skill": {
      const actor = currentPlayer.units.find(
        (u) => u.instanceId === action.actorInstanceId,
      )!;
      const cost = getActionEnergyCost(action, actor, state);
      currentPlayer.energy -= cost;
      executeSkill(
        state,
        rng,
        actor,
        action.targetInstanceId,
        action.abilityKey,
      );
      break;
    }
    case "ultimate": {
      const actor = currentPlayer.units.find(
        (u) => u.instanceId === action.actorInstanceId,
      )!;
      const cost = getActionEnergyCost(action, actor, state);
      currentPlayer.energy -= cost;
      executeUltimate(
        state,
        rng,
        actor,
        action.targetInstanceId,
        action.abilityKey,
      );
      break;
    }
    case "swap": {
      executeSwap(state, action.activeInstanceId, action.benchInstanceId);
      break;
    }
    case "pass": {
      // Do nothing
      break;
    }
    case "copy": {
      const actor = currentPlayer.units.find(
        (u) => u.instanceId === action.actorInstanceId,
      )!;
      const sourceUnit = findUnit(state, action.sourceInstanceId)!;
      const cost = getActionEnergyCost(action, actor, state);
      currentPlayer.energy -= cost;
      const copyAbilityDef = getAbilityDefinition(
        action.abilityKey,
        state.abilityDefinitions,
      );
      const copyAbilityType =
        copyAbilityDef?.payload.copyAbilityType ?? "SKILL";
      const isUltimateCopyAbility = actor.ultimate === action.abilityKey;
      executeCopy(
        state,
        rng,
        actor,
        action.abilityKey,
        isUltimateCopyAbility,
        sourceUnit,
        action.targetInstanceId,
        copyAbilityType,
      );
      break;
    }
  }

  state.actionsThisTurn.push(action);

  const actionEvents = state.log.slice(logLengthBeforeAction);
  const didReviveThisAction = actionEvents.some(
    (event) => event.type === "revive",
  );
  const formationReason: "normal" | "revive" = didReviveThisAction
    ? "revive"
    : "normal";
  reconcilePlayerFormation(state, state.players[0], formationReason);
  reconcilePlayerFormation(state, state.players[1], formationReason);

  // Check for game end after each action
  const gameEndCheck = checkGameEnd(state);
  if (gameEndCheck.ended) {
    state.phase = "ended";
    state.winnerId = gameEndCheck.winnerId;
    logEvent(
      state,
      createEvent(state, "gameOver", {
        winnerId: gameEndCheck.winnerId,
      }),
    );
  }
}
