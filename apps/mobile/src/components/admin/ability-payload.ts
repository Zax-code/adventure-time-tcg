export const STATUS_NAMES = [
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
] as const;

const CONSUMPTION_ONLY_STATUS_NAMES = ["Freeze", "Stunned"] as const;

export const TYPE_NAMES = [
  "Hero",
  "Tech",
  "Royalty",
  "Candy",
  "Undead",
  "Ice",
  "Fire",
  "Magic",
  "Demon",
  "Cosmic",
] as const;

export const PASSIVE_TRIGGERS = [
  "onBattleInit",
  "onBattleStart",
  "onStartTurn",
  "onEndTurn",
  "onDamageTaken",
  "onDamageDealt",
  "onDealDamage",
  "onBelowHp",
  "onAllyKo",
  "onEnemyKo",
  "onAnyKo",
  "onAllyFatalDamage",
  "onHealAlly",
  "onStatusApplied",
  "onActionStart",
] as const;

export const ABILITY_TARGETS = [
  "self",
  "ally",
  "enemy",
  "any",
  "allAllies",
  "allEnemies",
  "all",
] as const;

export const ABILITY_TARGET_SELECTORS = [
  "lowestHp",
  "highestHp",
  "lowestAtk",
  "highestAtk",
  "lowestDef",
  "highestDef",
  "lowestSpd",
  "highestSpd",
] as const;

export type StatusName = (typeof STATUS_NAMES)[number];
export type TypeName = (typeof TYPE_NAMES)[number];
export type PassiveTrigger = (typeof PASSIVE_TRIGGERS)[number];

export function isConsumptionOnlyStatus(name: StatusName | string) {
  return CONSUMPTION_ONLY_STATUS_NAMES.includes(
    name as (typeof CONSUMPTION_ONLY_STATUS_NAMES)[number],
  );
}

function statusDurationFormValue(name: StatusName, duration: unknown) {
  if (isConsumptionOnlyStatus(name)) {
    return "";
  }

  return typeof duration === "number" ? String(duration) : "";
}

function statusSpecToPayload(status: {
  name: StatusName;
  duration: string;
  magnitude: string;
}) {
  const next: { name: string; duration?: number; magnitude?: number } = {
    name: status.name,
  };

  if (isConsumptionOnlyStatus(status.name)) {
    next.duration = -1;
  } else if (status.duration) {
    next.duration = parseInt(status.duration, 10);
  }

  if (status.magnitude) next.magnitude = parseFloat(status.magnitude);
  return next;
}

export interface PayloadFormState {
  damageMul: string;
  burnBonusMul: string;
  bonusDamageVsDebuffedTargetsPct: string;
  instantKoIfTargetBelowHpPct: string;
  applyStatusChance: string;
  hits: string;
  executeDamageMul: string;
  executeThreshold: string;
  healPctOfMaxHpOnExecute: string;
  ignoreDefensePct: string;
  splashPct: string;
  lineOnly: boolean;
  target: "" | "self" | "ally" | "enemy" | "any" | "allAllies" | "allEnemies" | "all";
  targetSelector:
    | ""
    | "lowestHp"
    | "highestHp"
    | "lowestAtk"
    | "highestAtk"
    | "lowestDef"
    | "highestDef"
    | "lowestSpd"
    | "highestSpd";
  applyStatuses: Array<{
    name: StatusName;
    duration: string;
    magnitude: string;
    target: PayloadFormState["target"];
    targetSelector: PayloadFormState["targetSelector"];
  }>;
  randomStatuses: Array<{
    name: StatusName;
    duration: string;
    magnitude: string;
  }>;
  applyStatusesToAttacker: Array<{
    name: StatusName;
    duration: string;
    magnitude: string;
  }>;
  shieldTarget: "" | "self" | "target" | "allAllies";
  shieldPctOfMaxHp: string;
  healPctOfDamage: string;
  healLowestAllyPctOfDamage: string;
  healPctOfMaxHp: string;
  lifestealPct: string;
  healLowestHpAllyPctOfMaxHp: string;
  cleanseAllStatuses: boolean;
  alsoCleanseAllEnemies: boolean;
  cleanseCount: string;
  cleanseTarget: "" | "self" | "ally" | "allAllies" | "allEnemies";
  revivePct: string;
  reviveAllyOnEnemyKoPct: string;
  reduceCooldowns: string;
  increaseTargetCooldowns: string;
  reduceEnemyCooldowns: string;
  trigger: PassiveTrigger | "";
  thresholdPct: string;
  belowHpThreshold: string;
  once: boolean;
  chance: string;
  damageReduction: string;
  hitCountLimit: string;
  preventDeath: boolean;
  onBasicOnly: boolean;
  healingBonus: string;
  debuffImmunityCount: string;
  bonusCritChanceBasic: string;
  battleStartEnergyBonus: string;
  redirectIncomingChance: string;
  redirectIfSelfAboveHpPct: string;
  evasionChance: string;
  selfDamagePct: string;
  stealBuffCount: string;
  swapHpPercentages: boolean;
  statBonusHp: string;
  statBonusAttack: string;
  statBonusDefense: string;
  statBonusSpeed: string;
  statBonusTarget: "" | "self" | "allAllies" | "allEnemies";
  statBonusDurationMode: "" | "permanent" | "whileSourceActive";
  requiredAnyAllyTypes: TypeName[];
  applyToAllyTypes: TypeName[];
  adjacentAuraStatusName: "" | StatusName;
  adjacentAuraStatusDuration: string;
  conditionalRaw: string;
  copyAbilityType: "" | "SKILL" | "ULTIMATE";
  copyAbilitySource: "" | "enemy" | "ally" | "either";
}

export const emptyPayloadForm: PayloadFormState = {
  damageMul: "",
  burnBonusMul: "",
  bonusDamageVsDebuffedTargetsPct: "",
  instantKoIfTargetBelowHpPct: "",
  applyStatusChance: "",
  hits: "",
  executeDamageMul: "",
  executeThreshold: "",
  healPctOfMaxHpOnExecute: "",
  ignoreDefensePct: "",
  splashPct: "",
  lineOnly: false,
  target: "",
  targetSelector: "",
  applyStatuses: [],
  randomStatuses: [],
  applyStatusesToAttacker: [],
  shieldTarget: "",
  shieldPctOfMaxHp: "",
  healPctOfDamage: "",
  healLowestAllyPctOfDamage: "",
  healPctOfMaxHp: "",
  lifestealPct: "",
  healLowestHpAllyPctOfMaxHp: "",
  cleanseAllStatuses: false,
  alsoCleanseAllEnemies: false,
  cleanseCount: "",
  cleanseTarget: "",
  revivePct: "",
  reviveAllyOnEnemyKoPct: "",
  reduceCooldowns: "",
  increaseTargetCooldowns: "",
  reduceEnemyCooldowns: "",
  trigger: "",
  thresholdPct: "",
  belowHpThreshold: "",
  once: false,
  chance: "",
  damageReduction: "",
  hitCountLimit: "",
  preventDeath: false,
  onBasicOnly: false,
  healingBonus: "",
  debuffImmunityCount: "",
  bonusCritChanceBasic: "",
  battleStartEnergyBonus: "",
  redirectIncomingChance: "",
  redirectIfSelfAboveHpPct: "",
  evasionChance: "",
  selfDamagePct: "",
  stealBuffCount: "",
  swapHpPercentages: false,
  statBonusHp: "",
  statBonusAttack: "",
  statBonusDefense: "",
  statBonusSpeed: "",
  statBonusTarget: "",
  statBonusDurationMode: "",
  requiredAnyAllyTypes: [],
  applyToAllyTypes: [],
  adjacentAuraStatusName: "",
  adjacentAuraStatusDuration: "",
  conditionalRaw: "",
  copyAbilityType: "",
  copyAbilitySource: "",
};

export function payloadToForm(payload: Record<string, unknown>): PayloadFormState {
  const form = { ...emptyPayloadForm };

  if (payload.damageMul !== undefined) form.damageMul = String(payload.damageMul);
  if (payload.burnBonusMul !== undefined) form.burnBonusMul = String(payload.burnBonusMul);
  if (payload.bonusDamageVsDebuffedTargetsPct !== undefined) form.bonusDamageVsDebuffedTargetsPct = String(payload.bonusDamageVsDebuffedTargetsPct);
  if (payload.instantKoIfTargetBelowHpPct !== undefined) form.instantKoIfTargetBelowHpPct = String(payload.instantKoIfTargetBelowHpPct);
  if (payload.applyStatusChance !== undefined) form.applyStatusChance = String(payload.applyStatusChance);
  if (payload.hits !== undefined) form.hits = String(payload.hits);
  if (payload.executeDamageMul !== undefined) form.executeDamageMul = String(payload.executeDamageMul);
  if (payload.executeThreshold !== undefined) form.executeThreshold = String(payload.executeThreshold);
  if (payload.healPctOfMaxHpOnExecute !== undefined) form.healPctOfMaxHpOnExecute = String(payload.healPctOfMaxHpOnExecute);
  if (payload.ignoreDefensePct !== undefined) form.ignoreDefensePct = String(payload.ignoreDefensePct);
  if (payload.splashPct !== undefined) form.splashPct = String(payload.splashPct);
  if (payload.lineOnly) form.lineOnly = true;
  if (payload.target) form.target = payload.target as PayloadFormState["target"];
  else if (payload.affectsAllEnemies) form.target = "allEnemies";
  else if (payload.affectsAllAllies) form.target = "allAllies";
  if (payload.targetSelector) form.targetSelector = payload.targetSelector as PayloadFormState["targetSelector"];

  if (Array.isArray(payload.applyStatuses)) {
    form.applyStatuses = payload.applyStatuses.map((status) => {
      const entry = status as {
        name: string;
        duration?: number;
        magnitude?: number;
        target?: string;
        targetSelector?: string;
      };
      const name = entry.name as StatusName;
      return {
        name,
        duration: statusDurationFormValue(name, entry.duration),
        magnitude: entry.magnitude !== undefined ? String(entry.magnitude) : "",
        target: (entry.target ?? "") as PayloadFormState["target"],
        targetSelector: (entry.targetSelector ?? "") as PayloadFormState["targetSelector"],
      };
    });
  }
  if (Array.isArray(payload.randomStatuses)) {
    form.randomStatuses = payload.randomStatuses.map((status) => {
      const entry = status as { name: string; duration?: number; magnitude?: number };
      const name = entry.name as StatusName;
      return {
        name,
        duration: statusDurationFormValue(name, entry.duration),
        magnitude: entry.magnitude !== undefined ? String(entry.magnitude) : "",
      };
    });
  } else if (Array.isArray(payload.randomDebuffs)) {
    form.randomStatuses = payload.randomDebuffs.map((status) => {
      const entry = status as { name: string; duration?: number; magnitude?: number };
      const name = entry.name as StatusName;
      return {
        name,
        duration: statusDurationFormValue(name, entry.duration),
        magnitude: entry.magnitude !== undefined ? String(entry.magnitude) : "",
      };
    });
  }
  if (Array.isArray(payload.applyStatusesToAttacker)) {
    form.applyStatusesToAttacker = payload.applyStatusesToAttacker.map((status) => {
      const entry = status as { name: string; duration?: number; magnitude?: number };
      const name = entry.name as StatusName;
      return {
        name,
        duration: statusDurationFormValue(name, entry.duration),
        magnitude: entry.magnitude !== undefined ? String(entry.magnitude) : "",
      };
    });
  }

  if (payload.shieldTarget) form.shieldTarget = payload.shieldTarget as PayloadFormState["shieldTarget"];
  if (payload.shieldPctOfMaxHp !== undefined) form.shieldPctOfMaxHp = String(payload.shieldPctOfMaxHp);
  if (payload.healPctOfDamage !== undefined) form.healPctOfDamage = String(payload.healPctOfDamage);
  if (payload.healLowestAllyPctOfDamage !== undefined) form.healLowestAllyPctOfDamage = String(payload.healLowestAllyPctOfDamage);
  if (payload.healPctOfMaxHp !== undefined) form.healPctOfMaxHp = String(payload.healPctOfMaxHp);
  if (payload.lifestealPct !== undefined) form.lifestealPct = String(payload.lifestealPct);
  if (payload.healLowestHpAllyPctOfMaxHp !== undefined) form.healLowestHpAllyPctOfMaxHp = String(payload.healLowestHpAllyPctOfMaxHp);

  if (payload.cleanse && typeof payload.cleanse === "object") {
    const cleanse = payload.cleanse as { count?: number; target?: string };
    form.cleanseCount = cleanse.count !== undefined ? String(cleanse.count) : "";
    form.cleanseTarget = (cleanse.target ?? "") as PayloadFormState["cleanseTarget"];
  }
  if (payload.cleanseAllStatuses) form.cleanseAllStatuses = true;
  if (payload.alsoCleanseAllEnemies) form.alsoCleanseAllEnemies = true;

  if (payload.revivePct !== undefined) form.revivePct = String(payload.revivePct);
  if (payload.reviveAllyOnEnemyKoPct !== undefined) form.reviveAllyOnEnemyKoPct = String(payload.reviveAllyOnEnemyKoPct);
  if (payload.reduceCooldowns !== undefined) form.reduceCooldowns = String(payload.reduceCooldowns);
  if (payload.increaseTargetCooldowns !== undefined) form.increaseTargetCooldowns = String(payload.increaseTargetCooldowns);
  if (payload.reduceEnemyCooldowns !== undefined) form.reduceEnemyCooldowns = String(payload.reduceEnemyCooldowns);

  if (payload.trigger) form.trigger = payload.trigger as PassiveTrigger;
  if (payload.thresholdPct !== undefined) form.thresholdPct = String(payload.thresholdPct);
  if (payload.belowHpThreshold !== undefined) form.belowHpThreshold = String(payload.belowHpThreshold);
  if (payload.once) form.once = true;
  if (payload.chance !== undefined) form.chance = String(payload.chance);
  if (payload.damageReduction !== undefined) form.damageReduction = String(payload.damageReduction);
  if (payload.hitCountLimit !== undefined) form.hitCountLimit = String(payload.hitCountLimit);
  if (payload.preventDeath) form.preventDeath = true;
  if (payload.onBasicOnly) form.onBasicOnly = true;
  if (payload.healingBonus !== undefined) form.healingBonus = String(payload.healingBonus);
  if (payload.debuffImmunityCount !== undefined) form.debuffImmunityCount = String(payload.debuffImmunityCount);
  if (payload.bonusCritChanceBasic !== undefined) form.bonusCritChanceBasic = String(payload.bonusCritChanceBasic);
  if (payload.battleStartEnergyBonus !== undefined) form.battleStartEnergyBonus = String(payload.battleStartEnergyBonus);
  if (payload.redirectIncomingChance !== undefined) form.redirectIncomingChance = String(payload.redirectIncomingChance);
  if (payload.redirectIfSelfAboveHpPct !== undefined) form.redirectIfSelfAboveHpPct = String(payload.redirectIfSelfAboveHpPct);
  if (payload.evasionChance !== undefined) form.evasionChance = String(payload.evasionChance);
  if (payload.selfDamagePct !== undefined) form.selfDamagePct = String(payload.selfDamagePct);
  if (payload.stealBuffCount !== undefined) form.stealBuffCount = String(payload.stealBuffCount);
  if (payload.swapHpPercentages) form.swapHpPercentages = true;

  if (payload.statBonus && typeof payload.statBonus === "object") {
    const statBonus = payload.statBonus as {
      hp?: number;
      attack?: number;
      defense?: number;
      speed?: number;
    };
    if (statBonus.hp !== undefined) form.statBonusHp = String(statBonus.hp);
    if (statBonus.attack !== undefined) form.statBonusAttack = String(statBonus.attack);
    if (statBonus.defense !== undefined) form.statBonusDefense = String(statBonus.defense);
    if (statBonus.speed !== undefined) form.statBonusSpeed = String(statBonus.speed);
  }
  if (payload.statBonusTarget) form.statBonusTarget = payload.statBonusTarget as PayloadFormState["statBonusTarget"];
  if (payload.statBonusDurationMode) form.statBonusDurationMode = payload.statBonusDurationMode as PayloadFormState["statBonusDurationMode"];
  if (Array.isArray(payload.requiredAnyAllyTypes)) form.requiredAnyAllyTypes = payload.requiredAnyAllyTypes as TypeName[];
  if (Array.isArray(payload.applyToAllyTypes)) form.applyToAllyTypes = payload.applyToAllyTypes as TypeName[];
  if (payload.adjacentAuraStatus && typeof payload.adjacentAuraStatus === "object") {
    const aura = payload.adjacentAuraStatus as { name?: StatusName; duration?: number };
    form.adjacentAuraStatusName = aura.name ?? "";
    form.adjacentAuraStatusDuration = aura.duration !== undefined ? String(aura.duration) : "";
  }
  if (payload.conditional !== undefined) form.conditionalRaw = JSON.stringify(payload.conditional, null, 2);
  if (payload.copyAbilityType) form.copyAbilityType = payload.copyAbilityType as PayloadFormState["copyAbilityType"];
  if (payload.copyAbilitySource) form.copyAbilitySource = payload.copyAbilitySource as PayloadFormState["copyAbilitySource"];

  return form;
}

export function formToPayload(form: PayloadFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (form.damageMul) payload.damageMul = parseFloat(form.damageMul);
  if (form.burnBonusMul) payload.burnBonusMul = parseFloat(form.burnBonusMul);
  if (form.bonusDamageVsDebuffedTargetsPct) payload.bonusDamageVsDebuffedTargetsPct = parseFloat(form.bonusDamageVsDebuffedTargetsPct);
  if (form.instantKoIfTargetBelowHpPct) payload.instantKoIfTargetBelowHpPct = parseFloat(form.instantKoIfTargetBelowHpPct);
  if (form.applyStatusChance) payload.applyStatusChance = parseFloat(form.applyStatusChance);
  if (form.hits) payload.hits = parseInt(form.hits, 10);
  if (form.executeDamageMul) payload.executeDamageMul = parseFloat(form.executeDamageMul);
  if (form.executeThreshold) payload.executeThreshold = parseFloat(form.executeThreshold);
  if (form.healPctOfMaxHpOnExecute) payload.healPctOfMaxHpOnExecute = parseFloat(form.healPctOfMaxHpOnExecute);
  if (form.ignoreDefensePct) payload.ignoreDefensePct = parseFloat(form.ignoreDefensePct);
  if (form.splashPct) payload.splashPct = parseFloat(form.splashPct);
  if (form.lineOnly) payload.lineOnly = true;
  if (form.target) payload.target = form.target;
  if (form.targetSelector) payload.targetSelector = form.targetSelector;

  if (form.applyStatuses.length > 0) {
    payload.applyStatuses = form.applyStatuses.map((status) => {
      const next: {
        name: string;
        duration?: number;
        magnitude?: number;
        target?: string;
        targetSelector?: string;
      } = statusSpecToPayload(status);
      if (status.target) next.target = status.target;
      if (status.targetSelector) next.targetSelector = status.targetSelector;
      return next;
    });
  }
  if (form.randomStatuses.length > 0) {
    payload.randomStatuses = form.randomStatuses.map(statusSpecToPayload);
  }
  if (form.applyStatusesToAttacker.length > 0) {
    payload.applyStatusesToAttacker =
      form.applyStatusesToAttacker.map(statusSpecToPayload);
  }

  if (form.shieldTarget) payload.shieldTarget = form.shieldTarget;
  if (form.shieldPctOfMaxHp) payload.shieldPctOfMaxHp = parseFloat(form.shieldPctOfMaxHp);
  if (form.healPctOfDamage) payload.healPctOfDamage = parseFloat(form.healPctOfDamage);
  if (form.healLowestAllyPctOfDamage) payload.healLowestAllyPctOfDamage = parseFloat(form.healLowestAllyPctOfDamage);
  if (form.healPctOfMaxHp) payload.healPctOfMaxHp = parseFloat(form.healPctOfMaxHp);
  if (form.lifestealPct) payload.lifestealPct = parseFloat(form.lifestealPct);
  if (form.healLowestHpAllyPctOfMaxHp) payload.healLowestHpAllyPctOfMaxHp = parseFloat(form.healLowestHpAllyPctOfMaxHp);

  if (form.cleanseCount && form.cleanseTarget) {
    payload.cleanse = {
      count: parseInt(form.cleanseCount, 10),
      target: form.cleanseTarget,
    };
  }
  if (form.cleanseAllStatuses) payload.cleanseAllStatuses = true;
  if (form.alsoCleanseAllEnemies) payload.alsoCleanseAllEnemies = true;

  if (form.revivePct) payload.revivePct = parseFloat(form.revivePct);
  if (form.reviveAllyOnEnemyKoPct) payload.reviveAllyOnEnemyKoPct = parseFloat(form.reviveAllyOnEnemyKoPct);
  if (form.reduceCooldowns) payload.reduceCooldowns = parseInt(form.reduceCooldowns, 10);
  if (form.increaseTargetCooldowns) payload.increaseTargetCooldowns = parseInt(form.increaseTargetCooldowns, 10);
  if (form.reduceEnemyCooldowns) payload.reduceEnemyCooldowns = parseInt(form.reduceEnemyCooldowns, 10);

  if (form.trigger) payload.trigger = form.trigger;
  if (form.thresholdPct) payload.thresholdPct = parseFloat(form.thresholdPct);
  if (form.belowHpThreshold) payload.belowHpThreshold = parseFloat(form.belowHpThreshold);
  if (form.once) payload.once = true;
  if (form.chance) payload.chance = parseFloat(form.chance);
  if (form.damageReduction) payload.damageReduction = parseFloat(form.damageReduction);
  if (form.hitCountLimit) payload.hitCountLimit = parseInt(form.hitCountLimit, 10);
  if (form.preventDeath) payload.preventDeath = true;
  if (form.onBasicOnly) payload.onBasicOnly = true;
  if (form.healingBonus) payload.healingBonus = parseFloat(form.healingBonus);
  if (form.debuffImmunityCount) payload.debuffImmunityCount = parseInt(form.debuffImmunityCount, 10);
  if (form.bonusCritChanceBasic) payload.bonusCritChanceBasic = parseFloat(form.bonusCritChanceBasic);
  if (form.battleStartEnergyBonus) payload.battleStartEnergyBonus = parseInt(form.battleStartEnergyBonus, 10);
  if (form.redirectIncomingChance) payload.redirectIncomingChance = parseFloat(form.redirectIncomingChance);
  if (form.redirectIfSelfAboveHpPct) payload.redirectIfSelfAboveHpPct = parseFloat(form.redirectIfSelfAboveHpPct);
  if (form.evasionChance) payload.evasionChance = parseFloat(form.evasionChance);
  if (form.selfDamagePct) payload.selfDamagePct = parseFloat(form.selfDamagePct);
  if (form.stealBuffCount) payload.stealBuffCount = parseInt(form.stealBuffCount, 10);
  if (form.swapHpPercentages) payload.swapHpPercentages = true;

  const statBonus: { hp?: number; attack?: number; defense?: number; speed?: number } = {};
  if (form.statBonusHp !== "") statBonus.hp = parseFloat(form.statBonusHp);
  if (form.statBonusAttack !== "") statBonus.attack = parseFloat(form.statBonusAttack);
  if (form.statBonusDefense !== "") statBonus.defense = parseFloat(form.statBonusDefense);
  if (form.statBonusSpeed !== "") statBonus.speed = parseFloat(form.statBonusSpeed);
  if (Object.keys(statBonus).length > 0) payload.statBonus = statBonus;
  if (form.statBonusTarget) payload.statBonusTarget = form.statBonusTarget;
  if (form.statBonusDurationMode) payload.statBonusDurationMode = form.statBonusDurationMode;
  if (form.requiredAnyAllyTypes.length > 0) payload.requiredAnyAllyTypes = form.requiredAnyAllyTypes;
  if (form.applyToAllyTypes.length > 0) payload.applyToAllyTypes = form.applyToAllyTypes;
  if (form.adjacentAuraStatusName && form.adjacentAuraStatusDuration) {
    payload.adjacentAuraStatus = {
      name: form.adjacentAuraStatusName,
      duration: parseInt(form.adjacentAuraStatusDuration, 10),
    };
  }
  if (form.conditionalRaw.trim()) {
    try {
      payload.conditional = JSON.parse(form.conditionalRaw);
    } catch {
      // Validation happens before save.
    }
  }
  if (form.copyAbilityType) payload.copyAbilityType = form.copyAbilityType;
  if (form.copyAbilitySource) payload.copyAbilitySource = form.copyAbilitySource;

  return payload;
}

const STRUCTURED_PAYLOAD_KEYS = new Set([
  "damageMul",
  "burnBonusMul",
  "bonusDamageVsDebuffedTargetsPct",
  "instantKoIfTargetBelowHpPct",
  "applyStatusChance",
  "hits",
  "executeDamageMul",
  "executeThreshold",
  "healPctOfMaxHpOnExecute",
  "ignoreDefensePct",
  "splashPct",
  "lineOnly",
  "target",
  "targetSelector",
  "applyStatuses",
  "randomDebuffs",
  "randomStatuses",
  "applyStatusesToAttacker",
  "shieldTarget",
  "shieldPctOfMaxHp",
  "healPctOfDamage",
  "healPctOfMaxHp",
  "healLowestAllyPctOfDamage",
  "lifestealPct",
  "healLowestHpAllyPctOfMaxHp",
  "cleanse",
  "cleanseAllStatuses",
  "alsoCleanseAllEnemies",
  "revivePct",
  "reviveAllyOnEnemyKoPct",
  "reduceCooldowns",
  "increaseTargetCooldowns",
  "reduceEnemyCooldowns",
  "trigger",
  "thresholdPct",
  "belowHpThreshold",
  "once",
  "chance",
  "damageReduction",
  "hitCountLimit",
  "preventDeath",
  "onBasicOnly",
  "healingBonus",
  "debuffImmunityCount",
  "bonusCritChanceBasic",
  "battleStartEnergyBonus",
  "redirectIncomingChance",
  "redirectIfSelfAboveHpPct",
  "evasionChance",
  "selfDamagePct",
  "stealBuffCount",
  "swapHpPercentages",
  "statBonusTarget",
  "statBonusDurationMode",
  "requiredAnyAllyTypes",
  "applyToAllyTypes",
  "adjacentAuraStatus",
  "conditional",
  "statBonus",
  "copyAbilityType",
  "copyAbilitySource",
]);

export function stripStructuredPayloadKeys(payload: Record<string, unknown>): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!STRUCTURED_PAYLOAD_KEYS.has(key)) {
      extra[key] = value;
    }
  }
  return extra;
}
