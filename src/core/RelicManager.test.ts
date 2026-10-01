import { describe, it, expect } from 'vitest';
import { RelicManager, RELIC_HOOKS } from './RelicManager';
import type { Relic, PowerType, Suit } from './types';
import relicsData from '../data/relics.json';
import { RNG } from './RNG';

const all = relicsData.relics as Relic[];
const POWERS: PowerType[] = ['CRIT', 'HEAL', 'GUARD', 'GOLD', 'BOMB', 'WILD', 'ECHO'];
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

// The exact lookups the code used before RelicManager (DamageCalculator / GameActions / GameRules).
const legacy = {
  firstChainBonus: (r: Relic[]) => { const x = r.find((v) => v.effect.type === 'firstChainBonus'); return x && typeof x.effect.value === 'number' ? x.effect.value : 0; },
  spade: (r: Relic[]) => { const x = r.find((v) => v.effect.type === 'spadeDamageBonus'); return x && typeof x.effect.value === 'number' ? x.effect.value : 0; },
  rank: (r: Relic[], rank: number) => { const x = r.find((v) => v.effect.type === 'boostedRank' && v.effect.rank === rank); return x && typeof x.effect.bonus === 'number' ? x.effect.bonus : 0; },
  power: (r: Relic[], p: PowerType) => (r.find((v) => v.effect.type === 'doublePower' && v.effect.powerType === p) ? 2 : 1),
  third: (r: Relic[], pos: number) => { const x = r.find((v) => v.effect.type === 'thirdCardMultiplier'); return x && pos % 3 === 0 && typeof x.effect.value === 'number' ? x.effect.value : 1; },
  suit: (r: Relic[], s: Suit) => {
    const type = s === 'hearts' ? 'heartHealBonus' : s === 'clubs' ? 'clubArmorBonus' : s === 'diamonds' ? 'diamondGoldBonus' : null;
    if (!type) return 0;
    const x = r.find((v) => v.effect.type === type); return x && typeof x.effect.value === 'number' ? x.effect.value : 0;
  },
  vampiric: (r: Relic[], d: number) => { const x = r.find((v) => v.effect.type === 'vampiric'); return x && typeof x.effect.ratio === 'number' ? Math.floor(d / x.effect.ratio) : 0; },
  extra: (r: Relic[]) => { const x = r.find((v) => v.effect.type === 'extraPowerCards'); return x && typeof x.effect.value === 'number' ? x.effect.value : 0; },
};

// Extra edge-case relics: duplicate types, non-numeric values.
const odd: Relic[] = [
  { id: 'ace2', name: 'A2', description: '', effect: { type: 'boostedRank', rank: 1, bonus: 9 } },
  { id: 'spade-bool', name: 'S', description: '', effect: { type: 'spadeDamageBonus', value: true } },
  { id: 'third3', name: 'T', description: '', effect: { type: 'thirdCardMultiplier', value: 3 } },
  { id: 'vamp5', name: 'V', description: '', effect: { type: 'vampiric', ratio: 5 } },
  { id: 'unknown', name: 'U', description: '', effect: { type: 'notARealEffect', value: 99 } },
];

describe('RelicManager', () => {
  it('has a hook for every relic effect type in relics.json', () => {
    for (const relic of all) expect(RELIC_HOOKS[relic.effect.type], relic.effect.type).toBeDefined();
  });

  it('matches the legacy relics.find lookups for 400 random relic sets', () => {
    const rng = new RNG('relic-equivalence');
    const pool = [...all, ...odd];
    for (let i = 0; i < 400; i++) {
      const set = rng.shuffle([...pool]).slice(0, rng.nextInt(0, pool.length));
      const m = RelicManager.of(set);
      expect(m.firstChainBonus()).toBe(legacy.firstChainBonus(set));
      expect(m.spadeDamageBonus()).toBe(legacy.spade(set));
      expect(m.extraPowerCards()).toBe(legacy.extra(set));
      for (let rank = 0; rank <= 13; rank++) expect(m.rankBonus(rank)).toBe(legacy.rank(set, rank));
      for (const p of POWERS) expect(m.powerMultiplier(p)).toBe(legacy.power(set, p));
      for (let pos = 1; pos <= 12; pos++) expect(m.chainPositionMultiplier(pos)).toBe(legacy.third(set, pos));
      for (const s of SUITS) expect(m.suitBonus(s)).toBe(legacy.suit(set, s));
      for (const d of [0, 4, 9, 10, 37, 120]) expect(m.chainHeal(d)).toBe(legacy.vampiric(set, d));
    }
  });

  it('no relics = neutral answers', () => {
    const m = RelicManager.of([]);
    expect([m.firstChainBonus(), m.spadeDamageBonus(), m.rankBonus(1), m.suitBonus('hearts'), m.chainHeal(50), m.extraPowerCards()]).toEqual([0, 0, 0, 0, 0, 0]);
    expect([m.powerMultiplier('CRIT'), m.chainPositionMultiplier(3)]).toEqual([1, 1]);
  });
});
