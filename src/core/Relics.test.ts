import { describe, it, expect } from 'vitest';
import { calculateCardDamage } from './DamageCalculator';
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

describe('Relic Effects on Damage', () => {
  it('spadeDamageBonus relic adds extra spade damage', () => {
    const card = makeCard(5, 'spades');
    const relics: Relic[] = [
      {
        id: 'spade_bonus',
        name: 'SHARP SPADE',
        description: '♠ deal +2 extra damage',
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

    // Base: 3, Spade base: 1, Spade relic: 2 = 6
    expect(result.suitBonus).toBe(3);
    expect(result.totalDamage).toBe(6);
  });

  it('boostedRank relic adds bonus for specific rank', () => {
    const card = makeCard(7, 'hearts');
    const relics: Relic[] = [
      {
        id: 'boosted_sevens',
        name: 'LUCKY SEVEN',
        description: 'All 7s deal +5 damage',
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

    // Base: 2, Rank bonus: 5 = 7
    expect(result.relicBonus).toBe(5);
    expect(result.totalDamage).toBe(7);
  });

  it('thirdCardMultiplier relic doubles every 3rd card', () => {
    const card = makeCard(4, 'hearts');
    const relics: Relic[] = [
      {
        id: 'third_card',
        name: 'TRIPLE THREAT',
        description: 'Every 3rd card deals 2x',
        effect: { type: 'thirdCardMultiplier', value: 2 },
      },
    ];

    // Position 3 (3rd card)
    const result3 = calculateCardDamage({
      chainPosition: 3,
      card,
      powerType: null,
      relics,
      config: mockConfig,
    });
    expect(result3.multiplier).toBe(2);
    expect(result3.totalDamage).toBe(6); // 3 * 2

    // Position 6 (6th card)
    const result6 = calculateCardDamage({
      chainPosition: 6,
      card,
      powerType: null,
      relics,
      config: mockConfig,
    });
    expect(result6.multiplier).toBe(2);
    expect(result6.totalDamage).toBe(12); // 6 * 2

    // Position 4 (not 3rd)
    const result4 = calculateCardDamage({
      chainPosition: 4,
      card,
      powerType: null,
      relics,
      config: mockConfig,
    });
    expect(result4.multiplier).toBe(1);
    expect(result4.totalDamage).toBe(4);
  });

  it('doublePower relic doubles specific power effect', () => {
    const card = makeCard(5, 'hearts');
    const relics: Relic[] = [
      {
        id: 'double_crit',
        name: 'DOUBLE CRIT',
        description: 'CRIT power triggers twice',
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

    // Base: 4, Multiplier: 3 * 2 = 6, Total: 24
    expect(result.multiplier).toBe(6);
    expect(result.totalDamage).toBe(24);
  });

  it('multiple relics stack correctly', () => {
    const card = makeCard(7, 'spades');
    const relics: Relic[] = [
      {
        id: 'spade_bonus',
        name: 'SHARP SPADE',
        description: '+2 spade',
        effect: { type: 'spadeDamageBonus', value: 2 },
      },
      {
        id: 'boosted_sevens',
        name: 'LUCKY SEVEN',
        description: '7s +5',
        effect: { type: 'boostedRank', rank: 7, bonus: 5 },
      },
      {
        id: 'third_card',
        name: 'TRIPLE THREAT',
        description: '3rd card 2x',
        effect: { type: 'thirdCardMultiplier', value: 2 },
      },
    ];

    // Position 6 (divisible by 3)
    const result = calculateCardDamage({
      chainPosition: 6,
      card,
      powerType: null,
      relics,
      config: mockConfig,
    });

    // Base: 6
    // Spade: 1 + 2 = 3
    // Rank: 5
    // Multiplier: 2
    // Total: (6 + 3 + 5) * 2 = 28
    expect(result.totalDamage).toBe(28);
  });
});
