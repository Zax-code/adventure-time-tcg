// Deterministic seeded PRNG using mulberry32 algorithm
// This ensures battles can be replayed identically

export function createRng(seed: string): () => number {
  // Convert string seed to number using simple hash
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }

  let a = h >>> 0;

  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SeededRng {
  private seed: string;
  private index: number;
  private rng: () => number;

  constructor(seed: string, startIndex: number = 0) {
    this.seed = seed;
    this.index = 0;
    this.rng = createRng(seed);

    // Advance to the start index
    for (let i = 0; i < startIndex; i++) {
      this.rng();
      this.index++;
    }
  }

  // Get the current index (for saving state)
  getIndex(): number {
    return this.index;
  }

  // Get next random number between 0 and 1
  next(): number {
    this.index++;
    return this.rng();
  }

  // Get random integer between min (inclusive) and max (exclusive)
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  // Get random boolean with given probability (0-1)
  nextBool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  // Pick random element from array
  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length)];
  }

  // Shuffle array in place
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

// Generate a random seed string
export function generateSeed(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi) {
    throw new Error("Secure random generator is not available");
  }

  const bytes = new Uint8Array(32);
  cryptoApi.getRandomValues(bytes);
  for (let i = 0; i < 32; i++) {
    result += chars[bytes[i] % chars.length];
  }

  return result;
}
