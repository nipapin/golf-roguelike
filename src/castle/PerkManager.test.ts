import { describe, expect, it } from 'vitest';
import { PerkManager, generatePerkOffer, PERKS, DROP_RULES, GLOBAL_BONUS_LINK_CAP, getPerk } from './PerkManager';
import { RNG } from '../core/RNG';
import type { Card } from '../core/types';

const makeCard = (suit: 'hearts' | 'diamonds' | 'clubs' | 'spades', rank: number): Card => ({
  id: `${suit}-${rank}`, suit, rank,
});

describe('PerkManager', () => {
  describe('suit effects', () => {
    it('heart_mend heals castle when playing hearts', () => {
      const manager = new PerkManager([{ id: 'heart_mend', stacks: 1 }]);
      const result = manager.onSuitPlayed('hearts');
      expect(result.heal).toBe(1);
      expect(result.coins).toBe(0);
      expect(result.armor).toBe(0);
    });

    it('heart_mend respects per-round cap', () => {
      const manager = new PerkManager([{ id: 'heart_mend', stacks: 1 }]);
      for (let i = 0; i < 8; i++) manager.onSuitPlayed('hearts');
      const result = manager.onSuitPlayed('hearts');
      expect(result.heal).toBe(0);
    });

    it('diamond_vein gives coins when playing diamonds', () => {
      const manager = new PerkManager([{ id: 'diamond_vein', stacks: 1 }]);
      const result = manager.onSuitPlayed('diamonds');
      expect(result.coins).toBe(2);
    });

    it('club_bulwark gives armor when playing clubs', () => {
      const manager = new PerkManager([{ id: 'club_bulwark', stacks: 1 }]);
      const result = manager.onSuitPlayed('clubs');
      expect(result.armor).toBe(1);
    });
  });

  describe('link bonuses', () => {
    it('spade_edge gives +1 link for spades', () => {
      const manager = new PerkManager([{ id: 'spade_edge', stacks: 1 }]);
      const card = makeCard('spades', 5);
      const bonus = manager.getLinkBonus(card, makeCard('spades', 4), 3);
      expect(bonus).toBe(1);
    });

    it('ouroboros gives +2 links for K->A or A->K wraps', () => {
      const manager = new PerkManager([{ id: 'ouroboros', stacks: 1 }]);
      const king = makeCard('spades', 13);
      const ace = makeCard('hearts', 1);
      expect(manager.getLinkBonus(ace, king, 3)).toBe(2);
      expect(manager.getLinkBonus(king, ace, 3)).toBe(2);
    });

    it('momentum gives +1 link every 4th card', () => {
      const manager = new PerkManager([{ id: 'momentum', stacks: 1 }]);
      const card = makeCard('hearts', 5);
      expect(manager.getLinkBonus(card, makeCard('hearts', 4), 2)).toBe(0);
      expect(manager.getLinkBonus(card, makeCard('hearts', 4), 3)).toBe(1);
    });

    it('respects global bonus link cap of 5', () => {
      const manager = new PerkManager([
        { id: 'spade_edge', stacks: 1 },
        { id: 'ouroboros', stacks: 1 },
        { id: 'momentum', stacks: 1 },
        { id: 'flush_run', stacks: 2 },
      ]);
      const ace = makeCard('spades', 1);
      const king = makeCard('spades', 13);
      manager.onSuitPlayed('spades');
      manager.onSuitPlayed('spades');
      const bonus = manager.getLinkBonus(ace, king, 3);
      expect(bonus).toBeLessThanOrEqual(GLOBAL_BONUS_LINK_CAP);
    });
  });

  describe('rank effects', () => {
    it('royal_court deploys soldier on Jack', () => {
      const manager = new PerkManager([{ id: 'royal_court', stacks: 1 }]);
      const rng = new RNG('test');
      const result = manager.onRankPlayed(11, rng);
      expect(result.deployUnit).toBe('soldier');
    });

    it('royal_court deploys archer on Queen', () => {
      const manager = new PerkManager([{ id: 'royal_court', stacks: 1 }]);
      const rng = new RNG('test');
      const result = manager.onRankPlayed(12, rng);
      expect(result.deployUnit).toBe('archer');
    });

    it('royal_court loads turret on King', () => {
      const manager = new PerkManager([{ id: 'royal_court', stacks: 1 }]);
      const rng = new RNG('test');
      const result = manager.onRankPlayed(13, rng);
      expect(result.turretRounds).toBe(5);
    });

    it('ace_flare deals damage on Ace', () => {
      const manager = new PerkManager([{ id: 'ace_flare', stacks: 1 }]);
      const rng = new RNG('test');
      const result = manager.onRankPlayed(1, rng);
      expect(result.laserDamage).toBe(10);
    });

    it('trinity triggers free bomb on 3rd card of same rank', () => {
      const manager = new PerkManager([{ id: 'trinity', stacks: 1 }]);
      const rng = new RNG('test');
      manager.onRankPlayed(5, rng);
      manager.onRankPlayed(5, rng);
      const result = manager.onRankPlayed(5, rng);
      expect(result.freeBomb).toBe(true);
    });
  });

  describe('unit stat bonuses', () => {
    it('longbow increases archer damage', () => {
      const manager = new PerkManager([{ id: 'longbow', stacks: 2 }]);
      expect(manager.getArcherDamageBonus()).toBe(2);
    });

    it('extended_mag increases turret magazine', () => {
      const manager = new PerkManager([{ id: 'extended_mag', stacks: 1 }]);
      expect(manager.getTurretMagBonus()).toBe(5);
      expect(manager.shouldKeepTurretLeftover()).toBe(true);
    });

    it('cluster_shells increases mortar targets to 4', () => {
      const manager = new PerkManager([{ id: 'cluster_shells', stacks: 1 }]);
      expect(manager.getMortarTargets()).toBe(4);
    });

    it('veteran_militia improves soldiers', () => {
      const manager = new PerkManager([{ id: 'veteran_militia', stacks: 1 }]);
      expect(manager.getSoldierHpBonus()).toBe(3);
      expect(manager.getSoldierLifetimeBonus()).toBe(6);
    });
  });

  describe('castle effects', () => {
    it('glass_cannon modifies damage and max HP', () => {
      const manager = new PerkManager([{ id: 'glass_cannon', stacks: 1 }]);
      expect(manager.getDamageMultiplier()).toBe(1.4);
      expect(manager.getMaxHpMultiplier()).toBe(0.7);
    });

    it('tar_moat slows enemies', () => {
      const manager = new PerkManager([{ id: 'tar_moat', stacks: 1 }]);
      expect(manager.getEnemySpeedMultiplier(false)).toBeCloseTo(0.88, 2);
      expect(manager.getEnemySpeedMultiplier(true)).toBeCloseTo(0.94, 2);
    });

    it('masons heals over time', () => {
      const manager = new PerkManager([{ id: 'masons', stacks: 1 }]);
      let healed = 0;
      for (let i = 0; i < 15; i++) {
        healed += manager.tickMasons(1, 50, 100);
      }
      expect(healed).toBe(1);
    });
  });

  describe('blood_price', () => {
    it('gives bonus links for chains of 3+', () => {
      const manager = new PerkManager([{ id: 'blood_price', stacks: 1 }]);
      expect(manager.getChainEndBonus(2)).toBe(0);
      expect(manager.getChainEndBonus(3)).toBe(2);
      expect(manager.getChainEndBonus(5)).toBe(2);
    });

    it('costs HP for short chains', () => {
      const manager = new PerkManager([{ id: 'blood_price', stacks: 1 }]);
      expect(manager.getShortChainDrawCost(2)).toBe(1);
      expect(manager.getShortChainDrawCost(3)).toBe(0);
    });
  });
});

describe('perk offer generation', () => {
  it('generates 3 perks from eligible pool', () => {
    const rng = new RNG('offer-test');
    const offer = generatePerkOffer([], 1, 0, 0, 0, rng);
    expect(offer.perks.length).toBe(3);
    expect(offer.canReroll).toBe(true);
  });

  it('respects free reroll on first offer', () => {
    const rng = new RNG('reroll-test');
    const offer = generatePerkOffer([], 1, 0, 0, 0, rng);
    expect(offer.rerollCost).toBe(0);
  });

  it('charges for rerolls after free one is used', () => {
    const rng = new RNG('paid-reroll');
    const offer = generatePerkOffer([], 1, 0, 1, 0, rng);
    expect(offer.rerollCost).toBe(DROP_RULES.rerollBaseCost);
  });

  it('filters out already-owned non-stackable perks', () => {
    const owned = [{ id: 'royal_court', stacks: 1 }];
    for (let i = 0; i < 10; i++) {
      const offer = generatePerkOffer(owned, 3, 0, 0, 0, new RNG(`filter-${i}`));
      expect(offer.perks.every(p => p.id !== 'royal_court')).toBe(true);
    }
  });

  it('allows stackable perks to appear again', () => {
    const owned = [{ id: 'longbow', stacks: 1 }];
    let foundLongbow = false;
    for (let i = 0; i < 20; i++) {
      const offer = generatePerkOffer(owned, 3, 0, 0, 0, new RNG(`stack-${i}`));
      if (offer.perks.some(p => p.id === 'longbow')) foundLongbow = true;
    }
    expect(foundLongbow).toBe(true);
  });
});

describe('perk definitions', () => {
  it('has 32 perks defined', () => {
    expect(PERKS.length).toBe(32);
  });

  it('all perks have required fields', () => {
    for (const perk of PERKS) {
      expect(perk.id).toBeTruthy();
      expect(perk.rarity).toMatch(/^(common|uncommon|rare|legendary)$/);
      expect(perk.category).toMatch(/^(suit|deck|units|castle|economy|synergy|risk)$/);
      expect(perk.name.en).toBeTruthy();
      expect(perk.name.ru).toBeTruthy();
      expect(perk.description.en).toBeTruthy();
      expect(perk.description.ru).toBeTruthy();
    }
  });

  it('starfall requires ace_flare and focusing_lens', () => {
    const starfall = getPerk('starfall');
    expect(starfall?.prerequisites).toContain('ace_flare');
    expect(starfall?.prerequisites).toContain('focusing_lens');
    expect(starfall?.replaces).toBe('ace_flare');
  });
});
