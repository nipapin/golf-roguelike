import { describe, expect, it } from 'vitest';
import { battleFixture, config, enemies } from '../test/fixtures';
import { drawCard, leaveShop, playCard, skipReward, startNextBattle } from './GameActions';
import { isSavedRun } from '../services/validateSave';

const physicalIds = (state: ReturnType<typeof battleFixture>) => {
  const b = state.battle!;
  return [...b.tableau.flatMap(c => c.cards), ...b.deck, ...b.discard, b.activeCard!].map(c => c.id).sort();
};

describe('one solitaire per run', () => {
  it('keeps cards, powers, active and armor across a kill, rewards, shop and next enemy', () => {
    const initial = battleFixture('persistent-board');
    const ready = { ...initial, player: { ...initial.player, armor: 7 }, battle: { ...initial.battle!,
      enemy: { ...initial.battle!.enemy, hp: 1 }, accumulatedDamage: 1, chainBaseDamage: 1,
      chain: [initial.battle!.tableau[0].cards[0]] } };
    const won = drawCard(ready, config).state;
    expect(won.phase).toBe('reward');
    expect(isSavedRun(won)).toBe(true);
    const shop = skipReward(won).state;
    expect(isSavedRun(shop)).toBe(true);
    const continued = startNextBattle(leaveShop(shop).state, enemies, config);
    expect(continued.battle!.tableau).toEqual(initial.battle!.tableau);
    expect(continued.battle!.deck).toEqual(initial.battle!.deck);
    expect(continued.battle!.activeCard).toEqual(initial.battle!.activeCard);
    expect(continued.battle!.powerCards).toEqual(initial.battle!.powerCards);
    expect(continued.player.armor).toBe(7);
    expect(continued.battle!.enemy.maxHp).toBeGreaterThan(initial.battle!.enemy.maxHp);
    expect(continued.battle!.mode).toBe('solitaire');
  });

  it('opens the boss only after clearing columns and reuses the same 54 cards', () => {
    const initial = battleFixture('boss-gate');
    const pack = [...initial.battle!.tableau.flatMap(c => c.cards), ...initial.battle!.deck, ...initial.battle!.discard, initial.battle!.activeCard!];
    const active = pack.find(c => c.rank === 7)!;
    const last = pack.find(c => c.rank === 8)!;
    const ready = { ...initial, battle: { ...initial.battle!, activeCard: active,
      tableau: [{ cards: [last] }, ...Array.from({ length: 6 }, () => ({ cards: [] }))],
      deck: pack.filter(c => c.id !== active.id && c.id !== last.id), discard: [] } };
    const clear = playCard(ready, last.id, config);
    expect(clear.events.some(e => e.type === 'tableau_cleared')).toBe(true);
    expect(clear.state.phase).toBe('reward');
    expect(isSavedRun(clear.state)).toBe(true);
    const boss = startNextBattle(leaveShop(skipReward(clear.state).state).state, enemies, config);
    expect(boss.battle!.mode).toBe('boss');
    expect(boss.battle!.tableau.every(c => c.cards.length === 1)).toBe(true);
    expect(physicalIds(boss)).toEqual(physicalIds(initial));
    expect(isSavedRun(boss)).toBe(true);
  });

  it('never spawns an ordinary enemy with more HP than remaining minimum card damage', () => {
    const initial = battleFixture();
    const few = { ...initial, currentFight: 12, battle: { ...initial.battle!, tableau: initial.battle!.tableau.map(c => ({ cards: c.cards.slice(0, 1) })) } };
    const next = startNextBattle(few, enemies, config);
    expect(next.battle!.mode).toBe('solitaire');
    expect(next.battle!.enemy.hp).toBeLessThanOrEqual(few.battle.tableau.flatMap(c => c.cards).filter(c => !c.joker).length);
  });

  it('does not grant victory just because the boss hand is exhausted', () => {
    const initial = battleFixture();
    const active = { id: 'a', rank: 7, suit: 'clubs' as const };
    const last = { id: 'b', rank: 8, suit: 'clubs' as const };
    const boss = { ...initial, battle: { ...initial.battle!, mode: 'boss' as const,
      tableau: [{ cards: [last] }, ...Array.from({ length: 6 }, () => ({ cards: [] }))], deck: [],
      discard: initial.battle!.tableau.flatMap(c => c.cards), activeCard: active,
      enemy: { ...initial.battle!.enemy, hp: 1000, maxHp: 1000 } } };
    const result = playCard(boss, last.id, config);
    expect(result.state.phase).toBe('battle');
    expect(result.state.battle!.enemy.hp).toBeLessThan(1000);
    expect(result.state.battle!.tableau.some(c => c.cards.length > 0)).toBe(true);
    expect(result.events.some(e => e.type === 'run_won')).toBe(false);
  });
});
