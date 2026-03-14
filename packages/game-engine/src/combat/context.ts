/* eslint-disable @typescript-eslint/no-explicit-any */
// Battle context loading and state inflation/deflation utilities.
// BattleContext is transient — loaded per-request from the DB, never stored.

import type {
  BattleContext,
  BattleState,
  StoredBattleState,
  StoredPlayerState,
  StoredUnitState,
  PlayerState,
  UnitState,
  TypeName,
  RarityName,
} from "./types";
import { buildAbilityDefinitionMap } from "./abilityDefs";

/**
 * Collect all unique cardIds from a stored battle state's player units.
 */
export function collectCardIds(
  players: StoredBattleState["players"],
): string[] {
  const ids = new Set<string>();
  for (const player of players) {
    for (const unit of [...player.units, ...player.bench]) {
      ids.add(unit.cardId);
    }
  }
  return [...ids];
}

/**
 * Load all card data and ability definitions needed for a set of card IDs.
 * Executes 2 DB queries: one for cards + ability keys, one for ability defs.
 */
export async function loadBattleContext(
  cardIds: string[],
  drizzle: any,
): Promise<BattleContext> {
  const cards = await drizzle.card.findMany({
    where: { id: { in: cardIds } },
    include: {
      rarity: { select: { name: true } },
      abilities: {
        include: {
          passive: { select: { key: true } },
          skill: { select: { key: true } },
          ultimate: { select: { key: true } },
        },
      },
    },
  });

  const cardData: BattleContext["cardData"] = {};
  const cardAbilities: BattleContext["cardAbilities"] = {};
  const abilityKeySet = new Set<string>();

  for (const card of cards) {
    cardData[card.id] = {
      name: card.name,
      character: card.character,
      type: card.type,
      rarity: { name: card.rarity?.name ?? "Common" },
      imageUrl: card.imageUrl,
    };

    const passives = card.abilities?.passive?.key
      ? [card.abilities.passive.key]
      : [];
    const skill = card.abilities?.skill?.key ?? "default.focusedStrike";
    const ultimate = card.abilities?.ultimate?.key ?? "default.battleCry";

    cardAbilities[card.id] = { passives, skill, ultimate };

    for (const key of passives) abilityKeySet.add(key);
    abilityKeySet.add(skill);
    abilityKeySet.add(ultimate);
  }

  const abilityDefRecords = await drizzle.abilityDef.findMany({
    where: { key: { in: [...abilityKeySet] } },
    select: {
      key: true,
      name: true,
      description: true,
      type: true,
      cost: true,
      cooldown: true,
      oncePerMatch: true,
      payload: true,
    },
  });

  return {
    cardData,
    cardAbilities,
    abilityDefinitions: buildAbilityDefinitionMap(abilityDefRecords),
  };
}

/**
 * Inflate a StoredUnitState into a full UnitState using BattleContext.
 * The context provides authoritative card data and ability keys from the DB.
 */
export function inflateUnit(
  stored: StoredUnitState,
  ctx: BattleContext,
): UnitState {
  const card = ctx.cardData[stored.cardId];
  const abilities = ctx.cardAbilities[stored.cardId];

  return {
    ...stored,
    statAuraContributions: stored.statAuraContributions ?? {},
    name: card?.name ?? "Unknown",
    character: card?.character ?? "Unknown",
    type: (card?.type ?? "Hero") as TypeName,
    rarity: (card?.rarity.name ?? "Common") as RarityName,
    imageUrl: card?.imageUrl ?? "",
    passives: abilities?.passives ?? [],
    skill: abilities?.skill ?? "default.focusedStrike",
    ultimate: abilities?.ultimate ?? "default.battleCry",
  };
}

/**
 * Inflate a StoredPlayerState into a full PlayerState.
 */
function inflatePlayerState(
  stored: StoredPlayerState,
  ctx: BattleContext,
): PlayerState {
  return {
    ...stored,
    units: stored.units.map((u) => inflateUnit(u, ctx)),
    bench: stored.bench.map((u) => inflateUnit(u, ctx)),
  };
}

/**
 * Inflate a StoredBattleState into a full BattleState for the engine.
 * Attaches ctx.abilityDefinitions so the engine can look up ability payloads.
 */
export function inflateBattleState(
  stored: StoredBattleState,
  ctx: BattleContext,
): BattleState {
  return {
    ...stored,
    players: [
      inflatePlayerState(stored.players[0], ctx),
      inflatePlayerState(stored.players[1], ctx),
    ],
    abilityDefinitions: ctx.abilityDefinitions,
  };
}

/**
 * Type for turn snapshots stored in the database
 * Map of turn number -> serialized stored state
 */
export type TurnSnapshots = Record<number, StoredBattleState>;

/**
 * Deserialize turn snapshots from JSON string
 */
export function deserializeTurnSnapshots(
  json: string | null | undefined,
): TurnSnapshots {
  if (!json) return {};
  try {
    return JSON.parse(json) as TurnSnapshots;
  } catch {
    console.error(
      "[context] Failed to parse turn snapshots:",
      json.slice(0, 100),
    );
    return {};
  }
}

/**
 * Find the nearest snapshot for a given turn
 * Returns the snapshot with the highest turn number that is <= targetTurn
 */
export function getSnapshotForTurn(
  snapshots: TurnSnapshots,
  targetTurn: number,
): { turn: number; state: StoredBattleState } | null {
  const turns = Object.keys(snapshots)
    .map(Number)
    .filter((t) => t > 0)
    .sort((a, b) => a - b);

  const snapshotTurn = turns.reverse().find((t) => t <= targetTurn);
  if (!snapshotTurn) return null;
  return { turn: snapshotTurn, state: snapshots[snapshotTurn] };
}

/**
 * Get all turns that have snapshots
 */
export function getSnapshotTurns(snapshots: TurnSnapshots): number[] {
  return Object.keys(snapshots)
    .map(Number)
    .filter((t) => t > 0)
    .sort((a, b) => a - b);
}
