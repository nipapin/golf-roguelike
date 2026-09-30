import { describe, expect, it } from 'vitest';
import { drawCard, playCard } from './GameActions';
import { isPlayable } from './GameRules';
import { battleFixture, config } from '../test/fixtures';

describe('player turn threshold', () => {
  it.each([0, 1, 2, 3, 4])('chain of %i cards determines enemy response', (count) => {
    const initial = battleFixture();
    const battle = initial.battle!;
    const chain = Array.from({ length: count }, (_, i) => ({ id: `chain-${i}`, rank: i + 3, suit: 'spades' as const }));
    const state = { ...initial, battle: { ...battle, chain, accumulatedDamage: count * 2, enemy: { ...battle.enemy, hp: 100, maxHp: 100, intents: [{ type: 'attack' as const, value: 6 }], currentIntentIndex: 0 } } };
    const result = drawCard(state, config);
    expect(result.events.some(event => event.type === 'enemy_attacked')).toBe(count < 3);
    expect(result.events.some(event => event.type === 'enemy_staggered')).toBe(count >= 3);
    expect(result.state.player.hp).toBe(count < 3 ? initial.player.hp - 6 : initial.player.hp);
    expect(result.state.battle!.chain).toEqual([]);
    expect(result.state.battle!.deck).toHaveLength(battle.deck.length - 1);
  });
  it('rejecting an invalid rank changes neither HP nor the chain', () => {
    const initial = battleFixture();
    const state = { ...initial, battle: { ...initial.battle!, activeCard: { id: 'seven', rank: 7, suit: 'clubs' as const }, wildActive: false, tableau: [{ cards: [{ id: 'ten', rank: 10, suit: 'spades' as const }] }] } };
    expect(isPlayable(state.battle, 'ten')).toBe(false);
    expect(playCard(state, 'ten', config).state).toBe(state);
    expect(isPlayable({ ...state.battle, wildActive: true }, 'ten')).toBe(true);
  });
});
