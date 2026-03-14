// Speed derivation for combat
// If a card doesn't have an override speed, derive from stats

/**
 * Derive speed from attack and defense stats
 * Formula: speed = clamp(round((attack + defense) / 4 + 30), 20, 80)
 */
export function deriveSpeed(attack: number, defense: number): number {
  const derived = Math.round((attack + defense) / 4 + 30);
  return Math.min(80, Math.max(20, derived));
}

/**
 * Calculate team initiative (average speed of active units)
 */
export function calculateInitiative(speeds: number[]): number {
  if (speeds.length === 0) return 0;
  const sum = speeds.reduce((a, b) => a + b, 0);
  return Math.round(sum / speeds.length);
}

/**
 * Determine who goes first based on initiative
 * Returns true if player1 goes first, false if player2
 * Uses RNG for tiebreaker
 */
export function determineFirstMover(
  initiative1: number,
  initiative2: number,
  tiebreaker: () => boolean,
): boolean {
  if (initiative1 > initiative2) return true;
  if (initiative2 > initiative1) return false;
  // Tied: coin flip
  return tiebreaker();
}

// Known speed overrides for flagship cards
export const SPEED_OVERRIDES: Record<string, number> = {
  // These will be matched by card name/character containing these strings
  Finn: 55,
  Jake: 45,
  "Princess Bubblegum": 40,
  Bubblegum: 40,
  PB: 40,
  "Ice King": 38,
  "Flame Princess": 50,
  "Flame King": 50,
  "The Lich": 48,
  Lich: 48,
  "Huntress Wizard": 52,
  Prismo: 46,
  BMO: 35,
  "Gumball Guardian": 30,
  Guardian: 30,
  Marceline: 52,
  "Marshall Lee": 52,
};

/**
 * Get speed for a card, using override if available
 */
export function getCardSpeed(
  cardName: string,
  cardCharacter: string,
  baseAttack: number,
  baseDefense: number,
  dbOverride?: number | null,
): number {
  // First check database override
  if (dbOverride !== null && dbOverride !== undefined) {
    return dbOverride;
  }

  // Check known overrides by name/character
  for (const [key, speed] of Object.entries(SPEED_OVERRIDES)) {
    if (cardName.includes(key) || cardCharacter.includes(key)) {
      return speed;
    }
  }

  // Fall back to derived speed
  return deriveSpeed(baseAttack, baseDefense);
}
