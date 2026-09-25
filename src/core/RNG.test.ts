import { describe, it, expect } from 'vitest';
import { RNG, generateSeed } from './RNG';

describe('RNG', () => {
  it('should produce deterministic results with same seed', () => {
    const rng1 = new RNG('test-seed');
    const rng2 = new RNG('test-seed');

    const results1 = [rng1.next(), rng1.next(), rng1.next()];
    const results2 = [rng2.next(), rng2.next(), rng2.next()];

    expect(results1).toEqual(results2);
  });

  it('should produce different results with different seeds', () => {
    const rng1 = new RNG('seed-a');
    const rng2 = new RNG('seed-b');

    expect(rng1.next()).not.toBe(rng2.next());
  });

  it('should return values in [0, 1)', () => {
    const rng = new RNG('bounds-test');

    for (let i = 0; i < 100; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('should return integers in correct range', () => {
    const rng = new RNG('int-test');

    for (let i = 0; i < 100; i++) {
      const val = rng.nextInt(5, 10);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(10);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('should shuffle arrays deterministically', () => {
    const rng1 = new RNG('shuffle-test');
    const rng2 = new RNG('shuffle-test');

    const arr = [1, 2, 3, 4, 5];
    const shuffled1 = rng1.shuffle(arr);
    const shuffled2 = rng2.shuffle(arr);

    expect(shuffled1).toEqual(shuffled2);
    expect(shuffled1).not.toEqual(arr); // Should be shuffled (statistically)
  });

  it('should pick n elements without replacement', () => {
    const rng = new RNG('pick-test');
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const picked = rng.pick(arr, 3);

    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3); // All unique
    picked.forEach((p) => expect(arr).toContain(p));
  });

  it('should serialize and restore state correctly', () => {
    const rng = new RNG('state-test');
    rng.next();
    rng.next();

    const state = rng.getState();
    const restored = RNG.fromState(state);

    expect(rng.next()).toBe(restored.next());
    expect(rng.next()).toBe(restored.next());
  });
});

describe('generateSeed', () => {
  it('should generate non-empty string', () => {
    const seed = generateSeed();
    expect(seed.length).toBeGreaterThan(0);
  });

  it('should generate different seeds', () => {
    const seeds = new Set<string>();
    for (let i = 0; i < 10; i++) {
      seeds.add(generateSeed());
    }
    expect(seeds.size).toBeGreaterThan(1);
  });
});
