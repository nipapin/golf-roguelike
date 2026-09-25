import { describe, it, expect } from 'vitest';
import { calculateCardDamage, calculateChainDamage } from './DamageCalculator';
import { Card, Relic, GameConfig } from './types';

const mockConfig: GameConfig = {
  player: { startingHp: 30, maxHp: 30 },
  combat: {
    baseSpadeDamageBonus: 1,
    baseHeartHeal: 1,
    baseClubArmor: 1,
    baseDiamondGold: 1,
  },
  powerCards: {
    CRIT: { damageMultiplier: 3 },
    HEAL: { healAmount: 8 },
    GUARD: { armorAmount: 8 },
    GOLD: { goldAmount: 8 },
    BOMB: { flatDamage: 12 },
    WILD: { description: 'Next play connects to any rank' },
    ECHO: { comboBonus: 2 },
  },
  tableau: { columns: 7, rows: 5 },
  shop: { healCost: 10, healAmount: 8, relicBaseCost: 15 },
  runStructure: [],
};

function makeCard(rank: number, suit: 'spades' | 'hearts' | 'diamonds' | 'clubs'): Card {
  return { rank, suit, id: `card-${rank}-${suit}` };
}

describe('calculateCardDamage', () => {
  it('should calculate base damage equal to chain position', () => {
    const card = makeCard(5, 'hearts');
    const result = calculateCardDamage({
      chainPosition: 4,
      card,
      powerType: null,
      relics: [],
      config: mockConfig,
    });

    expect(result.baseDamage).toBe(4);
    expect(result.totalDamage).toBe(4);
  });

  it('should add spade bonus damage', () => {
    const card = makeCard(5, 'spades');
    const result = calculateCardDamage({
      chainPosition: 3,
      card,
      powerType: null,
      relics: [],
      config: mockConfig,
    });

    expect(result.baseDamage).toBe(3);
    expect(result.suitBonus).toBe(1);
    expect(result.totalDamage).toBe(4);
  });

  it('should apply CRIT multiplier', () => {
    const card = makeCard(7, 'spades');
    const result = calculateCardDamage({
      chainPosition: 5,
      card,
      powerType: 'CRIT',
      relics: [],
      config: mockConfig,
    });

    // (5 base + 1 spade) * 3 = 18
    expect(result.totalDamage).toBe(18);
    expect(result.multiplier).toBe(3);
  });

  it('should add BOMB flat damage', () => {
    const card = makeCard(3, 'hearts');
    const result = calculateCardDamage({
      chainPosition: 2,
      card,
      powerType: 'BOMB',
      relics: [],
      config: mockConfig,
    });

    // 2 base + 12 bomb = 14
    expect(result.powerBonus).toBe(12);
    expect(result.totalDamage).toBe(14);
  });

  it('should apply spade bonus relic', () => {
    const card = makeCard(5, 'spades');
    const relics: Relic[] = [
      {
        id: 'spade_bonus',
        name: 'SHARP SPADE',
        description: '+2 spade damage',
        effect: { type: 'spadeDamageBonus', value: 2 },
      },
    ];

    const result = calculateCardDamage({
      chainPosition: 3,
      card,
      powerType: null,
      relics,
      config: mockConfig,
    });

    // 3 base + 1 base spade + 2 relic = 6
    expect(result.suitBonus).toBe(3);
    expect(result.totalDamage).toBe(6);
  });

  it('should apply boosted rank relic', () => {
    const card = makeCard(7, 'hearts');
    const relics: Relic[] = [
      {
        id: 'lucky7',
        name: 'LUCKY SEVEN',
        description: '7s deal +5',
        effect: { type: 'boostedRank', rank: 7, bonus: 5 },
      },
    ];

    const result = calculateCardDamage({
      chainPosition: 2,
      card,
      powerType: null,
      relics,
      config: mockConfig,
    });

    // 2 base + 5 rank bonus = 7
    expect(result.relicBonus).toBe(5);
    expect(result.totalDamage).toBe(7);
  });

  it('should apply third card multiplier', () => {
    const card = makeCard(4, 'hearts');
    const relics: Relic[] = [
      {
        id: 'third',
        name: 'TRIPLE THREAT',
        description: '3rd card 2x',
        effect: { type: 'thirdCardMultiplier', value: 2 },
      },
    ];

    const result = calculateCardDamage({
      chainPosition: 6, // 6 is divisible by 3
      card,
      powerType: null,
      relics,
      config: mockConfig,
    });

    // 6 base * 2 = 12
    expect(result.multiplier).toBe(2);
    expect(result.totalDamage).toBe(12);
  });

  it('should apply double CRIT relic', () => {
    const card = makeCard(5, 'hearts');
    const relics: Relic[] = [
      {
        id: 'double_crit',
        name: 'DOUBLE CRIT',
        description: 'CRIT triggers twice',
        effect: { type: 'doublePower', powerType: 'CRIT' },
      },
    ];

    const result = calculateCardDamage({
      chainPosition: 4,
      card,
      powerType: 'CRIT',
      relics,
      config: mockConfig,
    });

    // 4 base * 6 (3 * 2) = 24
    expect(result.multiplier).toBe(6);
    expect(result.totalDamage).toBe(24);
  });
});

describe('calculateChainDamage', () => {
  it('should calculate total damage for a chain', () => {
    const chain = [
      makeCard(5, 'hearts'),
      makeCard(6, 'spades'),
      makeCard(7, 'hearts'),
    ];

    const total = calculateChainDamage(chain, new Map(), [], mockConfig);

    // Position 1: 1 damage
    // Position 2: 2 + 1 (spade) = 3
    // Position 3: 3 damage
    // Total: 1 + 3 + 3 = 7
    expect(total).toBe(7);
  });

  it('should handle ECHO power card (+2 position)', () => {
    const chain = [
      makeCard(5, 'hearts'),
      makeCard(6, 'hearts'),
      makeCard(7, 'hearts'),
    ];

    const powerCards = new Map([['card-6-hearts', 'ECHO' as const]]);

    const total = calculateChainDamage(chain, powerCards, [], mockConfig);

    // Position 1: 1
    // Position 2 + 2 (ECHO): 4
    // Position 5: 5
    // Total: 1 + 4 + 5 = 10
    expect(total).toBe(10);
  });

  it('should calculate chain of 8 = 36 base damage (1+2+3+4+5+6+7+8)', () => {
    const chain = Array.from({ length: 8 }, (_, i) =>
      makeCard((i % 13) + 1, 'hearts')
    );

    const total = calculateChainDamage(chain, new Map(), [], mockConfig);

    // Sum of 1 to 8 = 36
    expect(total).toBe(36);
  });

  it('should respect start position', () => {
    const chain = [makeCard(5, 'hearts'), makeCard(6, 'hearts')];

    const total = calculateChainDamage(chain, new Map(), [], mockConfig, 3);

    // Position 3: 3
    // Position 4: 4
    // Total: 7
    expect(total).toBe(7);
  });
});
