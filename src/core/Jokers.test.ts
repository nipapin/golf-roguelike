import { describe, it, expect } from 'vitest';
import { createDeck, canConnect } from './GameState';
import { playCard, drawCard } from './GameActions';
import { battleFixture, config } from '../test/fixtures';
import { isSavedRun } from '../services/validateSave';
import type { Card, RunState } from './types';
const red: Card = { id: 'joker-red', rank: 0, suit: 'hearts', joker: 'red' };
const black: Card = { id: 'joker-black', rank: 0, suit: 'spades', joker: 'black' };
const ordinary = (rank: number, suit: Card['suit']): Card => ({ id: `${rank}-${suit}`, rank, suit });

it('creates a 54-card deck with exactly two distinct jokers', () => {
  const deck = createDeck();
  expect(deck).toHaveLength(54);
  expect(deck.filter(card => card.joker)).toEqual([red, black]);
  expect(new Set(deck.map(card => card.id)).size).toBe(54);
  expect(isSavedRun(battleFixture())).toBe(true);
});

it('keeps ordinary ±1 rules without WILD', () => {
  for (let rank = 1; rank <= 13; rank++) {
    const accepted = [6, 8].includes(rank);
    expect(canConnect(ordinary(rank, 'spades'), ordinary(7, 'clubs'), false)).toBe(accepted);
  }
});

it('allows joker entry, matching color exit and both joker orders', () => {
  expect(canConnect(red, ordinary(7, 'clubs'))).toBe(true);
  expect(canConnect(black, red)).toBe(true);
  expect(canConnect(red, black)).toBe(true);
  for (const suit of ['hearts', 'diamonds', 'spades', 'clubs'] as const) {
    const isRed = suit === 'hearts' || suit === 'diamonds';
    expect(canConnect(ordinary(10, suit), red)).toBe(isRed);
    expect(canConnect(ordinary(10, suit), black)).toBe(!isRed);
  }
});

function fixture(first: Card, second: Card): RunState {
  const initial = battleFixture();
  return { ...initial, player: { ...initial.player, hp: 1, maxHp: 100 }, battle: {
    ...initial.battle!, activeCard: ordinary(7, 'clubs'), accumulatedDamage: 10, chainBaseDamage: 10,
    chain: [ordinary(6, 'diamonds')], jokerMultiplier: 1, lifestealMultiplier: 0,
    tableau: [{ cards: [ordinary(2, 'spades'), first] }, { cards: [ordinary(4, 'clubs'), second] }],
    enemy: { ...initial.battle!.enemy, hp: 100, maxHp: 100 },
  } };
}

describe('ordered joker chain effects', () => {
  it.each([[red, black, 3], [black, red, 15]] as const)('%s then %s preserves requested damage/healing order', (first, second, healing) => {
    const one = playCard(fixture(first, second), first.id, config);
    const two = playCard(one.state, second.id, config);
    expect(two.state.battle!.accumulatedDamage).toBe(50);
    expect(two.state.player.hp).toBe(1); // Vampirism resolves when the damage lands.
    const restored = JSON.parse(JSON.stringify(two.state));
    const result = drawCard(restored, config);
    expect(result.state.battle!.enemy.hp).toBe(50);
    expect(result.state.player.hp).toBe(1 + healing);
    expect(result.events.some(event => event.type === 'enemy_attacked')).toBe(false);
    expect(result.state.battle!.jokerMultiplier).toBe(result.state.battle!.activeCard?.joker === 'black' ? 5 : 1);
  });
  it('restores a real shuffled deck and its joker modifiers', () => {
    let state = battleFixture('joker-save');
    const physical = [...state.battle!.tableau.flatMap(col => col.cards), ...state.battle!.deck, state.battle!.activeCard!];
    const ordinaryCards = physical.filter(card => !card.joker);
    state = { ...state, battle: { ...state.battle!, activeCard: ordinaryCards.shift()!, tableau: [
      { cards: [ordinaryCards.shift()!, red] }, { cards: [ordinaryCards.shift()!, black] },
      ...Array.from({ length: 5 }, () => ({ cards: ordinaryCards.splice(0, 5) })),
    ], deck: ordinaryCards, discard: [], powerCards: [] } };
    state = playCard(state, black.id, config).state;
    state = playCard(state, red.id, config).state;
    expect(isSavedRun(JSON.parse(JSON.stringify(state)))).toBe(true);
    expect(state.battle!.lifestealMultiplier).toBe(5);
  });
});
