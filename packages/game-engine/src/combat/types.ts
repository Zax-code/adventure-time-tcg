// Core types for the PvP Combat System

// Card Types
export type TypeName =
  | "Hero"
  | "Tech"
  | "Royalty"
  | "Candy"
  | "Undead"
  | "Ice"
  | "Fire"
  | "Magic"
  | "Demon"
  | "Cosmic";

export type RarityName = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";

// Status Effects
export type StatusName =
  | "Burn"
  | "Freeze"
  | "Shield"
  | "GuardUp"
  | "Vulnerable"
  | "Weakened"
  | "Haste"
  | "Taunt"
  | "Regeneration"
  | "Silence"
  | "SummoningSickness"
  | "Cover"
  | "Stunned" // Next basic/skill/ultimate costs +1 Energy, then consumed
  | "Poison" // DoT that stacks, 5% max HP per stack
  | "Thorns" // Reflects 15% of melee damage back to attacker
  | "Stealth" // Cannot be targeted, removed when attacking
  | "Empower" // +25% ATK for next attack only
  | "Counter" // Next attack dodged and counter-attacked
  | "Mark" // +15% damage from all sources
  | "Barrier" // Blocks next debuff application
  | "Doom"; // Dies after X turns unless cleansed

export type AbilityTarget =
  | "self"
  | "ally"
  | "enemy"
  | "any"
  | "allAllies"
  | "allEnemies"
  | "allUnits"
  | "all";

export type AbilityTargetSelector =
  | "lowestHp"
  | "highestHp"
  | "lowestAtk"
  | "highestAtk"
  | "lowestDef"
  | "highestDef"
  | "lowestSpd"
  | "highestSpd";

export interface Status {
  name: StatusName;
  duration: number; // original owner-turn duration, -1 for permanent until consumed
  magnitude?: number; // for Shield: amount remaining
  sourceInstanceId?: string; // for Cover: who is providing it
  appliedAt: number; // turn number when applied
  appliedDuringPlayerId?: string | null;
  targetOwnerId?: string | null;
  expiresAt?: "afterOwnerTurnStartEffects" | "afterOwnerTurnEndEffects";
  ownerTurnsSeen?: number;
}

// Ability Types
export type AbilityType = "PASSIVE" | "SKILL" | "ULTIMATE";

export type PassiveTrigger =
  | "onBattleInit"
  | "onBattleStart"
  | "onStartTurn"
  | "onEndTurn"
  | "onDamageTaken"
  | "onDamageDealt"
  | "onDealDamage"
  | "onBelowHp"
  | "onAllyKo"
  | "onEnemyKo"
  | "onAnyKo"
  | "onAllyFatalDamage"
  | "onHealAlly"
  | "onStatusApplied"
  | "onActionStart";

export interface AbilityPayload {
  // Damage
  damageMul?: number; // e.g., 1.2 = 120% of Attack-based damage
  ignoreDefensePct?: number; // 0.5 -> ignore 50% def
  burnBonusMul?: number; // extra damage multiplier vs Burn targets (e.g. 0.3 = +30%)
  splashPct?: number; // e.g., 0.6 for adjacent enemies
  affectsAllEnemies?: boolean; // legacy (use target)
  affectsAllAllies?: boolean; // legacy (use target)
  lineOnly?: boolean;
  hits?: number; // number of times to hit (for multi-hit abilities)
  executeDamageMul?: number; // bonus damage multiplier when target below threshold
  executeThreshold?: number; // HP threshold for execute bonus (e.g., 0.5 = below 50%)
  healPctOfMaxHpOnExecute?: number; // heal self when executing
  target?: AbilityTarget;
  targetSelector?: AbilityTargetSelector;

  // Status application
  applyStatuses?: Array<{
    name: StatusName;
    duration?: number;
    magnitude?: number;
    target?: AbilityTarget;
    targetSelector?: AbilityTargetSelector;
  }>;
  randomDebuffs?: Array<{
    name: StatusName;
    duration?: number;
    magnitude?: number;
  }>;
  randomStatuses?: Array<{
    name: StatusName;
    duration?: number;
    magnitude?: number;
  }>;
  instantKoIfTargetBelowHpPct?: number;
  applyStatusesToAttacker?: Array<{
    name: StatusName;
    duration?: number;
    magnitude?: number;
  }>;
  onBasicOnly?: boolean;
  increaseTargetCooldowns?: number;
  applyStatusChance?: number; // probability to apply status (0-1)
  // Status-specific magnitude for team-wide debuffs (e.g. Doom execute/damage pct)
  teamDebuffsAllEnemies?: Array<{
    name: StatusName;
    duration: number;
    magnitude?: number;
  }>;
  teamBuffs?: Array<{
    name: StatusName;
    duration: number;
    target?: "self" | "allAllies" | "lowestHpAlly";
  }>;
  selfBuffs?: Array<{ name: StatusName; duration: number }>;

  // Healing/Shield
  shieldTarget?: "self" | "target" | "allAllies";
  shieldPctOfMaxHp?: number; // 0.25 -> 25% max HP shield
  healPctOfDamage?: number; // lifesteal
  healPctOfMaxHp?: number; // flat heal
  healLowestAllyPctOfDamage?: number; // heal lowest HP ally based on damage dealt
  healLowestHpAllyPctOfMaxHp?: number; // heal lowest HP ally by max HP pct
  healingBonus?: number; // percentage bonus to healing (e.g., 0.2 = 20% more healing)

  // Cleanse
  cleanse?: {
    count: number;
    target: "self" | "ally" | "allAllies" | "allEnemies" | "allUnits" | "all";
  };
  alsoCleanseAllEnemies?: boolean;
  cleanseAllStatuses?: boolean;

  // Revival
  revivePct?: number; // 0.4 -> 40% HP
  reviveAllyOnEnemyKoPct?: number; // revive a KO'd ally when an enemy is KO'd

  // Cooldown manipulation
  reduceCooldowns?: number; // reduce by this many turns
  reduceEnemyCooldowns?: number; // reduce cooldowns of all enemy units

  // Self-damage
  selfDamagePct?: number; // sacrifice HP (percentage of current HP)
  stealBuffCount?: number; // steal this many buffs from target to self
  swapHpPercentages?: boolean; // swap current HP percentage with target

  // Passive-specific
  trigger?: PassiveTrigger;
  thresholdPct?: number; // for onBelowHp
  belowHpThreshold?: number; // threshold for gaining bonus effect
  once?: boolean; // internal cooldown, can only trigger once per match
  chance?: number; // probability 0-1
  lifestealPct?: number; // percentage of damage dealt to heal
  preventDeath?: boolean; // prevent fatal damage
  allowBarrierOnPreventDeath?: boolean; // allow Barrier to be applied during fatal prevention trigger
  debuffImmunityCount?: number; // number of debuffs to block
  bonusCritChanceBasic?: number; // passive team bonus to basic attack crit chance
  battleStartEnergyBonus?: number; // grant energy before first turn starts
  statBonusTarget?: "self" | "allAllies" | "allEnemies";
  requiredAnyAllyTypes?: TypeName[]; // apply only if any ally matches one of these types
  applyToAllyTypes?: TypeName[]; // apply ally stat bonus only to these ally types
  adjacentAuraStatus?: { name: StatusName; duration: number };
  redirectIncomingChance?: number; // chance to redirect single-target incoming attack
  redirectIfSelfAboveHpPct?: number; // redirect works only above this HP ratio
  bonusDamageVsDebuffedTargetsPct?: number; // bonus outgoing damage vs debuffed targets
  evasionChance?: number; // deprecated: speed-driven evasion now controls miss chance
  statBonus?: {
    hp?: number;
    attack?: number;
    defense?: number;
    speed?: number;
  }; // percentage bonus
  // "whileSourceActive" means applied only while source unit is alive and active
  statBonusDurationMode?: "permanent" | "whileSourceActive";
  damageReduction?: number; // percentage
  hitCountLimit?: number; // for effects that work for first N hits

  // Conditional effects
  conditional?: Array<{
    when: Condition;
    addApplyStatuses?: Array<{
      name: StatusName;
      duration?: number;
      magnitude?: number;
    }>;
    damageMulDelta?: number;
    mergePayload?: Partial<AbilityPayload>;
  }>;

  // Copy mechanics
  copyAbilityType?: "SKILL" | "ULTIMATE"; // which slot to copy from the source
  copyAbilitySource?: "enemy" | "ally" | "either"; // whose units can be sources
}

export interface Condition {
  targetHas?: StatusName;
  selfHas?: StatusName;
  allyType?: TypeName;
  selfBelowHpPct?: number;
  targetBelowHpPct?: number;
}

export interface AbilityDefinition {
  key: string;
  name: string;
  description: string;
  type: AbilityType;
  cost: number;
  cooldown?: number;
  oncePerMatch: boolean;
  payload: AbilityPayload;
}

export interface StatAuraContribution {
  sourceInstanceId: string;
  abilityKey: string;
  hp?: number;
  attack?: number;
  defense?: number;
  speed?: number;
}

// Unit State (a card in battle)
export interface UnitState {
  instanceId: string; // unique per unit in battle
  cardId: string;
  name: string;
  character: string;
  type: TypeName;
  rarity: RarityName;
  imageUrl: string;

  // Stats (with rarity modifiers applied)
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  // Immutable baselines used for UI stat delta display.
  baseMaxHp?: number;
  baseAttack?: number;
  baseDefense?: number;
  baseSpeed?: number;

  // Status effects
  statuses: Status[];

  // Cooldowns: abilityKey -> remaining CD (0 means ready)
  cooldowns: Record<string, number>;
  usedUltimate: boolean;

  // Position: 1, 2, 3 for active; null if benched
  position: 1 | 2 | 3 | null;

  // Abilities
  passives: string[]; // ability keys
  skill: string; // key
  ultimate: string; // key

  // Passive tracking
  passiveTriggered: Record<string, boolean>; // for "once" passives
  hitsTaken: number; // for passives like Frost Armor
  statAuraContributions?: Record<string, StatAuraContribution>;
}

// Player State
export interface PlayerState {
  userId: string;
  name: string;
  energy: number;
  maxEnergy: number;
  units: UnitState[]; // active units (up to 3)
  bench: UnitState[]; // bench units (up to 3)
  initiative: number; // average of active speeds
  hasUsedFreeBasic: boolean; // for Haste's free basic attack
}

// Action Types
export interface BasicAction {
  kind: "basic";
  actorInstanceId: string;
  targetInstanceId: string;
}

export interface SkillAction {
  kind: "skill";
  actorInstanceId: string;
  targetInstanceId?: string;
  abilityKey: string;
}

export interface UltimateAction {
  kind: "ultimate";
  actorInstanceId: string;
  targetInstanceId?: string; // some ultimates don't need a target
  abilityKey: string;
}

export interface SwapAction {
  kind: "swap";
  activeInstanceId: string;
  benchInstanceId: string;
}

export interface PassAction {
  kind: "pass";
}

export interface CopyAction {
  kind: "copy";
  actorInstanceId: string;
  abilityKey: string; // the copy ability's own key (energy/cooldown tracking)
  sourceInstanceId: string; // unit to copy from
  targetInstanceId?: string; // target for the copied ability (omitted for AoE)
}

export type ActionKind =
  | "basic"
  | "skill"
  | "ultimate"
  | "swap"
  | "pass"
  | "copy";

export type Action =
  | BasicAction
  | SkillAction
  | UltimateAction
  | SwapAction
  | PassAction
  | CopyAction;

// Combat Events for logging
export type CombatEventType =
  | "matchStart"
  | "turnStart"
  | "turnEnd"
  | "energyGrant"
  | "statusTick"
  | "statusApply"
  | "statusExpire"
  | "statusCleanse"
  | "abilityStart"
  | "damage"
  | "crit"
  | "shieldAbsorb"
  | "heal"
  | "ko"
  | "swap"
  | "formation"
  | "passiveRoll"
  | "passiveTrigger"
  | "cooldownTick"
  | "gameOver"
  | "freeze_skip"
  | "stun_consume"
  | "revive"
  | "pass"
  | "concede"
  | "timeout"
  | "coverRedirect"
  | "thorns"
  | "counter"
  | "preventDeath"
  | "statusRoll"
  | "randomStatusRoll"
  | "statusSteal"
  | "swapHp";

export interface CombatEvent {
  seq: number; // sequence number
  turn: number;
  type: CombatEventType;
  payload: Record<string, unknown>;
}

// Battle State
export interface BattleState {
  id: string;
  seed: string;
  rngIndex: number; // current position in RNG sequence
  turn: number; // starts at 1
  phase: "active" | "ended";
  currentPlayerId: string;
  players: [PlayerState, PlayerState];
  log: CombatEvent[];
  winnerId?: string;

  // Turn tracking
  actionsThisTurn: Action[];
  turnEnded: boolean;
  // Ability definitions keyed by ability key, loaded from AbilityDef table.
  abilityDefinitions?: Record<string, AbilityDefinition>;
}

// Narrow state shape used by targeting helpers and UI consumers.
export interface TargetingUnitState {
  instanceId: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  statuses: Status[];
}

export interface TargetingPlayerState {
  userId: string;
  units: TargetingUnitState[];
  bench: TargetingUnitState[];
}

export interface TargetingBattleState {
  currentPlayerId: string;
  players: [TargetingPlayerState, TargetingPlayerState];
  abilityDefinitions?: Record<string, AbilityDefinition>;
}

// Match Status
export type MatchStatus =
  | "PENDING"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELED"
  | "EXPIRED";

// API Response types
export interface BattleStateView {
  id: string;
  turn: number;
  phase: "active" | "ended";
  currentPlayerId: string;
  players: [PlayerStateView, PlayerStateView];
  winnerId?: string;
  myUserId: string;
  isMyTurn: boolean;
  log: CombatEvent[];
  abilityDefinitions?: Record<string, AbilityDefinition>;
}

export interface PlayerStateView {
  userId: string;
  name: string;
  energy: number;
  maxEnergy: number;
  units: UnitState[];
  bench: UnitState[];
  initiative: number;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Simulation result
export interface SimulationResult {
  state: BattleState;
  events: CombatEvent[];
  errors: string[];
}

// Damage calculation context
export interface DamageContext {
  attacker: UnitState;
  target: UnitState;
  baseDamage: number;
  typeMultiplier: number;
  critMultiplier: number;
  buffDebuffMultiplier: number;
  ignoreDefensePct: number;
  isCrit: boolean;
  isMiss?: boolean;
  incomingDamageReductionPct?: number;
  finalDamage: number;
  shieldAbsorbed: number;
  actualDamage: number;
}

// Card data for initialization
export interface CardAbilityRef {
  key: string;
  name?: string;
  description?: string;
  type?: AbilityType;
  cost?: number;
  cooldown?: number | null;
  oncePerMatch?: boolean;
  payload?: AbilityPayload;
}

export interface CardAbilityData {
  passive: CardAbilityRef | null;
  skill: CardAbilityRef | null;
  ultimate: CardAbilityRef | null;
}

export interface CardData {
  id: string;
  name: string;
  character: string;
  type: string;
  hp: number;
  attack: number;
  defense: number;
  speed?: number;
  imageUrl: string;
  rarity: {
    name: string;
  };
  // Ability assignments from database
  abilities?: CardAbilityData | null;
}

// --- Lean stored types (what actually gets written to PvpMatch.state) ---

// Only dynamic combat state — no static card data, no ability definitions
export interface StoredUnitState {
  instanceId: string;
  cardId: string;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  baseMaxHp?: number;
  baseAttack?: number;
  baseDefense?: number;
  baseSpeed?: number;
  statuses: Status[];
  cooldowns: Record<string, number>;
  usedUltimate: boolean;
  position: 1 | 2 | 3 | null;
  passiveTriggered: Record<string, boolean>;
  hitsTaken: number;
  statAuraContributions?: Record<string, StatAuraContribution>;
}

export interface StoredPlayerState {
  userId: string;
  name: string;
  energy: number;
  maxEnergy: number;
  units: StoredUnitState[];
  bench: StoredUnitState[];
  initiative: number;
  hasUsedFreeBasic: boolean;
}

// What is actually written to PvpMatch.state — no card data, no ability defs
export interface StoredBattleState {
  id: string;
  seed: string;
  rngIndex: number;
  turn: number;
  phase: "active" | "ended";
  currentPlayerId: string;
  players: [StoredPlayerState, StoredPlayerState];
  log: CombatEvent[];
  winnerId?: string;
  actionsThisTurn: Action[];
  turnEnded: boolean;
}

// Transient per-request context — loaded from DB, never persisted
export interface BattleContext {
  cardData: Record<
    string,
    {
      name: string;
      character: string;
      type: string;
      rarity: { name: string };
      imageUrl: string;
    }
  >;
  cardAbilities: Record<
    string,
    { passives: string[]; skill: string; ultimate: string }
  >;
  abilityDefinitions: Record<string, AbilityDefinition>;
}
