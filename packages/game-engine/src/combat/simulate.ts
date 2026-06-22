// Battle simulation - core engine for running combat

import {
  BattleState,
  BattleStateView,
  PlayerState,
  UnitState,
  StoredUnitState,
  StoredBattleState,
  Action,
  CombatEvent,
  SimulationResult,
  CardData,
  TypeName,
  AbilityDefinition,
} from "./types";
import { SeededRng, generateSeed } from "./rng";
import { applyRarityBonuses, parseRarity } from "./rarity";
import { getCardSpeed } from "./speed";
import { calculateInitiative, determineFirstMover } from "./speed";
import { validateAction } from "./validators";
import { startTurn, executeAction, endTurn, triggerPassives } from "./resolve";
import { hasStatus } from "./effects";

/**
 * Create a unit state from card data
 * Abilities are loaded from the database (card.abilities) when available
 */
export function createUnitState(
  card: CardData,
  position: 1 | 2 | 3 | null,
  speedOverride?: number | null,
): UnitState {
  const rarity = parseRarity(card.rarity.name);
  const type = card.type as TypeName;

  // Apply rarity bonuses
  const stats = applyRarityBonuses(card.hp, card.attack, card.defense, rarity);

  // Get speed
  const speed = getCardSpeed(
    card.name,
    card.character,
    card.attack,
    card.defense,
    speedOverride ?? card.speed ?? null,
  );

  // Abilities come from database assignments.
  let passives: string[] = [];
  let skill: string;
  let ultimate: string;

  if (card.abilities) {
    passives = card.abilities.passive ? [card.abilities.passive.key] : [];
    skill = card.abilities.skill?.key || "default.focusedStrike";
    ultimate = card.abilities.ultimate?.key || "default.battleCry";
  } else {
    passives = [];
    skill = "default.focusedStrike";
    ultimate = "default.battleCry";
  }

  return {
    instanceId: `${card.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    cardId: card.id,
    name: card.name,
    character: card.character,
    type,
    rarity,
    imageUrl: card.imageUrl,
    maxHp: stats.hp,
    hp: stats.hp,
    attack: stats.attack,
    defense: stats.defense,
    speed,
    baseMaxHp: stats.hp,
    baseAttack: stats.attack,
    baseDefense: stats.defense,
    baseSpeed: speed,
    statuses: [],
    cooldowns: {},
    usedUltimate: false,
    position,
    passives,
    skill,
    ultimate,
    passiveTriggered: {},
    hitsTaken: 0,
    statAuraContributions: {},
  };
}

/**
 * Create initial battle state
 */
export function createBattleState(
  matchId: string,
  player1: {
    userId: string;
    name: string;
    cards: CardData[];
    speedOverrides?: Record<string, number>;
  },
  player2: {
    userId: string;
    name: string;
    cards: CardData[];
    speedOverrides?: Record<string, number>;
  },
  seed?: string,
  abilityDefinitions?: Record<string, AbilityDefinition>,
): BattleState {
  const actualSeed = seed || generateSeed();
  const rng = new SeededRng(actualSeed);

  // Create units for player 1 (first 3 active, last 3 bench)
  const player1Units: UnitState[] = player1.cards
    .slice(0, 3)
    .map((card, i) =>
      createUnitState(
        card,
        (i + 1) as 1 | 2 | 3,
        player1.speedOverrides?.[card.id],
      ),
    );
  const player1Bench: UnitState[] = player1.cards
    .slice(3, 6)
    .map((card) =>
      createUnitState(card, null, player1.speedOverrides?.[card.id]),
    );

  // Create units for player 2
  const player2Units: UnitState[] = player2.cards
    .slice(0, 3)
    .map((card, i) =>
      createUnitState(
        card,
        (i + 1) as 1 | 2 | 3,
        player2.speedOverrides?.[card.id],
      ),
    );
  const player2Bench: UnitState[] = player2.cards
    .slice(3, 6)
    .map((card) =>
      createUnitState(card, null, player2.speedOverrides?.[card.id]),
    );

  // Calculate initiatives
  const player1Initiative = calculateInitiative(
    player1Units.map((u) => u.speed),
  );
  const player2Initiative = calculateInitiative(
    player2Units.map((u) => u.speed),
  );

  // Determine first mover
  const player1GoesFirst = determineFirstMover(
    player1Initiative,
    player2Initiative,
    () => rng.nextBool(),
  );

  const playerState1: PlayerState = {
    userId: player1.userId,
    name: player1.name,
    energy: 1,
    maxEnergy: 1,
    units: player1Units,
    bench: player1Bench,
    initiative: player1Initiative,
    hasUsedFreeBasic: false,
  };

  const playerState2: PlayerState = {
    userId: player2.userId,
    name: player2.name,
    energy: 1,
    maxEnergy: 1,
    units: player2Units,
    bench: player2Bench,
    initiative: player2Initiative,
    hasUsedFreeBasic: false,
  };

  const state: BattleState = {
    id: matchId,
    seed: actualSeed,
    rngIndex: rng.getIndex(),
    turn: 1,
    phase: "active",
    currentPlayerId: player1GoesFirst ? player1.userId : player2.userId,
    players: [playerState1, playerState2],
    log: [],
    actionsThisTurn: [],
    turnEnded: false,
    abilityDefinitions,
  };

  // Log match start
  state.log.push({
    seq: 0,
    turn: 0,
    type: "matchStart",
    payload: {
      player1Id: player1.userId,
      player2Id: player2.userId,
      firstMoverId: state.currentPlayerId,
      seed: actualSeed,
    },
  });

  // Initialize passive effects
  initializePassives(state, rng);

  // Save RNG index
  state.rngIndex = rng.getIndex();

  return state;
}

/**
 * Initialize passive abilities at battle start
 */
function initializePassives(state: BattleState, rng: SeededRng): void {
  for (const player of state.players) {
    triggerPassives(state, rng, "onBattleInit", player);
    triggerPassives(state, rng, "onBattleStart", player);
  }
}

/**
 * Simulate a list of actions
 */
export function simulateActions(
  state: BattleState,
  actions: Action[],
): SimulationResult {
  const rng = new SeededRng(state.seed, state.rngIndex);
  const errors: string[] = [];
  const newEvents: CombatEvent[] = [];

  // Clone state to avoid mutation issues (deep clone)
  const stateCopy = JSON.parse(JSON.stringify(state)) as BattleState;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    // Validate action
    const validation = validateAction(stateCopy, action);
    if (!validation.valid) {
      errors.push(`Action ${i}: ${validation.error}`);
      continue;
    }

    // Execute action
    const logLengthBefore = stateCopy.log.length;
    executeAction(stateCopy, rng, action);

    // Collect new events
    for (let j = logLengthBefore; j < stateCopy.log.length; j++) {
      newEvents.push(stateCopy.log[j]);
    }

    // Check if game ended
    if (stateCopy.phase === "ended") {
      break;
    }
  }

  // Update RNG index
  stateCopy.rngIndex = rng.getIndex();

  return {
    state: stateCopy,
    events: newEvents,
    errors,
  };
}

/**
 * Simulate end of turn
 */
export function simulateEndTurn(
  state: BattleState,
  swapAction?: { activeInstanceId: string; benchInstanceId: string },
): SimulationResult {
  const rng = new SeededRng(state.seed, state.rngIndex);
  const errors: string[] = [];
  const newEvents: CombatEvent[] = [];

  // Clone state
  const stateCopy = JSON.parse(JSON.stringify(state)) as BattleState;
  const logLengthBefore = stateCopy.log.length;

  // Execute swap if provided
  if (swapAction) {
    const validation = validateAction(stateCopy, {
      kind: "swap",
      ...swapAction,
    });

    if (!validation.valid) {
      errors.push(`Swap: ${validation.error}`);
    } else {
      executeAction(stateCopy, rng, { kind: "swap", ...swapAction });
    }
  }

  // End the turn
  endTurn(stateCopy);

  // If game hasn't ended, start the new turn
  if (stateCopy.phase === "active") {
    startTurn(stateCopy, rng);
  }

  // Collect new events
  for (let j = logLengthBefore; j < stateCopy.log.length; j++) {
    newEvents.push(stateCopy.log[j]);
  }

  // Update RNG index
  stateCopy.rngIndex = rng.getIndex();

  return {
    state: stateCopy,
    events: newEvents,
    errors,
  };
}

/**
 * Get the fallback action for timeout (basic attack highest-threat enemy)
 */
export function getFallbackAction(state: BattleState): Action | null {
  const currentPlayer = state.players.find(
    (p) => p.userId === state.currentPlayerId,
  )!;
  const opponent = state.players.find(
    (p) => p.userId !== state.currentPlayerId,
  )!;

  // Find first alive actor without summoning sickness
  const actor = currentPlayer.units.find(
    (u) => u.hp > 0 && !hasStatus(u, "SummoningSickness"),
  );

  if (!actor) return null;

  // Find highest threat enemy (lowest HP, then highest attack)
  const aliveEnemies = opponent.units.filter((u) => u.hp > 0);
  if (aliveEnemies.length === 0) return null;

  aliveEnemies.sort((a, b) => {
    if (a.hp !== b.hp) return a.hp - b.hp; // Lowest HP first
    return b.attack - a.attack; // Highest attack first
  });

  const target = aliveEnemies[0];

  return {
    kind: "basic",
    actorInstanceId: actor.instanceId,
    targetInstanceId: target.instanceId,
  };
}

/**
 * Check if turn has timed out (30 seconds)
 */
export function isTurnTimedOut(turnStartedAt: Date): boolean {
  const now = new Date();
  const elapsed = now.getTime() - turnStartedAt.getTime();
  return elapsed > 30000; // 30 seconds
}

/**
 * Strip a UnitState down to only dynamic combat fields for storage.
 * Removes static card data (name, type, rarity, imageUrl, passives, skill, ultimate)
 * that can be re-loaded from the Card/CardAbility tables via BattleContext.
 */
function deflateUnit(unit: UnitState): StoredUnitState {
  return {
    instanceId: unit.instanceId,
    cardId: unit.cardId,
    maxHp: unit.maxHp,
    hp: unit.hp,
    attack: unit.attack,
    defense: unit.defense,
    speed: unit.speed,
    baseMaxHp: unit.baseMaxHp,
    baseAttack: unit.baseAttack,
    baseDefense: unit.baseDefense,
    baseSpeed: unit.baseSpeed,
    statuses: unit.statuses,
    cooldowns: unit.cooldowns,
    usedUltimate: unit.usedUltimate,
    position: unit.position,
    passiveTriggered: unit.passiveTriggered,
    hitsTaken: unit.hitsTaken,
    statAuraContributions: unit.statAuraContributions ?? {},
  };
}

/**
 * Serialize battle state for storage.
 * Strips static card data and ability definitions — those are re-loaded from
 * the DB on each request via loadBattleContext / inflateBattleState.
 */
export function serializeBattleState(state: BattleState): string {
  const lean: StoredBattleState = {
    id: state.id,
    seed: state.seed,
    rngIndex: state.rngIndex,
    turn: state.turn,
    phase: state.phase,
    currentPlayerId: state.currentPlayerId,
    players: [
      {
        userId: state.players[0].userId,
        name: state.players[0].name,
        energy: state.players[0].energy,
        maxEnergy: state.players[0].maxEnergy,
        initiative: state.players[0].initiative,
        hasUsedFreeBasic: state.players[0].hasUsedFreeBasic,
        units: state.players[0].units.map(deflateUnit),
        bench: state.players[0].bench.map(deflateUnit),
      },
      {
        userId: state.players[1].userId,
        name: state.players[1].name,
        energy: state.players[1].energy,
        maxEnergy: state.players[1].maxEnergy,
        initiative: state.players[1].initiative,
        hasUsedFreeBasic: state.players[1].hasUsedFreeBasic,
        units: state.players[1].units.map(deflateUnit),
        bench: state.players[1].bench.map(deflateUnit),
      },
    ],
    log: state.log,
    winnerId: state.winnerId,
    actionsThisTurn: state.actionsThisTurn,
    turnEnded: state.turnEnded,
  };
  return JSON.stringify(lean);
}

/**
 * Capture a snapshot of the current battle state at a turn boundary.
 * This creates a lean StoredBattleState that can be stored in the database
 * and later inflated for replay navigation.
 */
export function captureTurnSnapshot(state: BattleState): StoredBattleState {
  const lean: StoredBattleState = {
    id: state.id,
    seed: state.seed,
    rngIndex: state.rngIndex,
    turn: state.turn,
    phase: state.phase,
    currentPlayerId: state.currentPlayerId,
    players: [
      {
        userId: state.players[0].userId,
        name: state.players[0].name,
        energy: state.players[0].energy,
        maxEnergy: state.players[0].maxEnergy,
        initiative: state.players[0].initiative,
        hasUsedFreeBasic: state.players[0].hasUsedFreeBasic,
        units: state.players[0].units.map(deflateUnit),
        bench: state.players[0].bench.map(deflateUnit),
      },
      {
        userId: state.players[1].userId,
        name: state.players[1].name,
        energy: state.players[1].energy,
        maxEnergy: state.players[1].maxEnergy,
        initiative: state.players[1].initiative,
        hasUsedFreeBasic: state.players[1].hasUsedFreeBasic,
        units: state.players[1].units.map(deflateUnit),
        bench: state.players[1].bench.map(deflateUnit),
      },
    ],
    log: [], // Don't store log in snapshots to save space
    winnerId: state.winnerId,
    actionsThisTurn: state.actionsThisTurn,
    turnEnded: state.turnEnded,
  };
  return lean;
}

/**
 * Deserialize lean stored battle state from the PvpMatch.state column.
 * Call inflateBattleState(stored, ctx) afterwards to get a full BattleState
 * ready for the engine.
 */
export function deserializeStoredBattleState(json: string): StoredBattleState {
  return JSON.parse(json) as StoredBattleState;
}

/**
 * @deprecated Use deserializeStoredBattleState + inflateBattleState instead.
 * Kept for compatibility during transition.
 */
export function deserializeBattleState(json: string): BattleState {
  return JSON.parse(json) as BattleState;
}

/**
 * Create a view of the battle state for a specific player
 */
export function createBattleStateView(
  state: BattleState,
  viewerId: string,
): BattleStateView {
  return {
    id: state.id,
    turn: state.turn,
    phase: state.phase,
    currentPlayerId: state.currentPlayerId,
    players: [
      {
        userId: state.players[0].userId,
        name: state.players[0].name,
        energy: state.players[0].energy,
        maxEnergy: state.players[0].maxEnergy,
        units: state.players[0].units,
        bench: state.players[0].bench,
        initiative: state.players[0].initiative,
      },
      {
        userId: state.players[1].userId,
        name: state.players[1].name,
        energy: state.players[1].energy,
        maxEnergy: state.players[1].maxEnergy,
        units: state.players[1].units,
        bench: state.players[1].bench,
        initiative: state.players[1].initiative,
      },
    ],
    winnerId: state.winnerId,
    myUserId: viewerId,
    isMyTurn: state.currentPlayerId === viewerId,
    log: state.log,
    abilityDefinitions: state.abilityDefinitions,
  };
}
