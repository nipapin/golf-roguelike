import { describe, it, expect } from 'vitest';
import { getEmotion } from './enemyEmotion';
import type { Enemy } from '../../core/types';

const base: Enemy = { id: 'x', name: 'X', maxHp: 100, hp: 100, intents: [{ type: 'attack', value: 4 }, { type: 'attack', value: 8 }], currentIntentIndex: 0, sprite: 'slime', tier: 'normal' };

describe('enemy emotion', () => {
  it('calm by default', () => expect(getEmotion(base)).toBe('calm'));
  it('angry when winding up its biggest attack', () => expect(getEmotion({ ...base, currentIntentIndex: 1 })).toBe('angry'));
  it('normal enemies get scared at low HP, even mid wind-up', () => expect(getEmotion({ ...base, hp: 20, currentIntentIndex: 1 })).toBe('scared'));
  it('elites and bosses get angry when wounded instead', () => {
    expect(getEmotion({ ...base, tier: 'boss', hp: 45 })).toBe('angry');
    expect(getEmotion({ ...base, tier: 'elite', hp: 20 })).toBe('angry');
  });
  it('dead enemies are calm', () => expect(getEmotion({ ...base, hp: 0 })).toBe('calm'));
});
