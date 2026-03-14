// Combat Engine - Main exports

// Types
export * from "./types";

// RNG
export { SeededRng, generateSeed, createRng } from "./rng";

// Type Chart
export {
  getTypeMultiplier,
  getIncomingDamageModifier,
  hasMixedTypes,
  getHeroSynergyBonus,
  getTypeAdvantageDescription,
  getStrongAgainst,
  getWeakAgainst,
} from "./typeChart";

// Rarity
export {
  getRarityModifiers,
  applyRarityBonuses,
  hasExtraPassiveSlot,
  parseRarity,
} from "./rarity";

// Speed
export {
  deriveSpeed,
  calculateInitiative,
  determineFirstMover,
  getCardSpeed,
  SPEED_OVERRIDES,
} from "./speed";

// Effects
export {
  hasStatus,
  getStatus,
  getBuffs,
  getDebuffs,
  applyStatus,
  removeStatus,
  cleanseDebuffs,
  tickStatuses,
  consumeFreeze,
  getAttackModifier,
  getDefenseModifier,
  getIncomingDamageModifier as getStatusIncomingModifier,
  getSpeedModifier,
  isSilenced,
  hasSummoningSickness,
  getShieldAmount,
  consumeShield,
  findTaunter,
  getCoverSource,
} from "./effects";

// Damage
export {
  calculateDamage,
  applyDamage,
  applyHealing,
  calculateSplashDamage,
  getAdjacentPositions,
  getAdjacentUnits,
  applyCoverRedirect,
  calculateLifesteal,
  previewDamage,
} from "./damage";

// Abilities
export { getAbilityDefinition } from "./abilities";

// Validators
export {
  getCurrentPlayer,
  getOpponent,
  findUnit,
  findUnitOwner,
  getKoAllies,
  isOwnUnit,
  isEnemyUnit,
  getActionEnergyCost,
  validateBasicAttack,
  validateSkill,
  validateUltimate,
  validateSwap,
  validateCopy,
  validateAction,
  getValidTargets,
  checkGameEnd,
} from "./validators";

// Resolution
export {
  startTurn,
  triggerPassives,
  executeBasicAttack,
  executeSkill,
  executeUltimate,
  executeCopy,
  executeSwap,
  endTurn,
  executeAction,
} from "./resolve";

// Simulation
export {
  createUnitState,
  createBattleState,
  simulateActions,
  simulateEndTurn,
  getFallbackAction,
  isTurnTimedOut,
  serializeBattleState,
  deserializeBattleState,
  deserializeStoredBattleState,
  createBattleStateView,
  captureTurnSnapshot,
} from "./simulate";

// Battle context (inflate/deflate layer between DB and engine)
export {
  loadBattleContext,
  collectCardIds,
  inflateUnit,
  inflateBattleState,
  deserializeTurnSnapshots,
  getSnapshotForTurn,
  getSnapshotTurns,
  type TurnSnapshots,
} from "./context";
