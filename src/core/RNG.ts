/**
 * Seeded pseudo-random number generator using Mulberry32 algorithm.
 * Deterministic: same seed always produces same sequence.
 */
export class RNG {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === 'string' ? this.hashString(seed) : seed;
    if (this.state === 0) this.state = 1;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash) || 1;
  }

  /**
   * Returns a float in [0, 1)
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns an integer in [min, max] inclusive
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Shuffles array in place using Fisher-Yates
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Pick n random elements from array without replacement
   */
  pick<T>(array: readonly T[], n: number): T[] {
    const shuffled = this.shuffle([...array]);
    return shuffled.slice(0, Math.min(n, array.length));
  }

  /**
   * Pick one random element from array
   */
  pickOne<T>(array: readonly T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Get current state for serialization
   */
  getState(): number {
    return this.state;
  }

  /**
   * Create RNG from serialized state
   */
  static fromState(state: number): RNG {
    const rng = new RNG(1);
    rng.state = state;
    return rng;
  }
}

/**
 * Generate a random seed string
 */
export function generateSeed(): string {
  return Math.random().toString(36).substring(2, 10);
}
