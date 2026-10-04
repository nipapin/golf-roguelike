import { describe, expect, it } from 'vitest';
import { canConnect, canConnectInBattle, hasLegalMoves } from './GameState';
import { getPlayableCards, hasLegalMovesForUI, isPlayable } from './GameRules';
import { battleFixture } from '../test/fixtures';
import type { Card } from './types';
const card = (rank: number, suit: Card['suit'] = 'hearts'): Card => ({
  id: `${rank}-${suit}`,
  rank,
  suit,
});

describe('rank policies shared by UI and gameplay', () => {
  it('checks all ordinary rank pairs against the linear castle rule', () => {
    for (let active = 1; active <= 13; active++)
      for (let target = 1; target <= 13; target++) {
        expect(canConnect(card(target), card(active, 'clubs'), false, false)).toBe(
          Math.abs(target - active) === 1
        );
        expect(canConnect(card(target), card(active, 'clubs'), true, false)).toBe(true);
      }
  });
  it.each([
    [1, 13],
    [13, 1],
  ])('keeps generic %i to %i wrap enabled by default', (active, target) => {
    expect(canConnect(card(target), card(active, 'clubs'))).toBe(true);
    const battle = {
      ...battleFixture().battle!,
      activeCard: card(active),
      wildActive: false,
      tableau: [{ cards: [card(target, 'clubs')] }],
    };
    expect(isPlayable(battle, card(target, 'clubs').id)).toBe(true);
  });
  it.each([
    [1, 13],
    [13, 1],
  ])('does not advertise a castle %i to %i move', (active, target) => {
    const battle = {
      ...battleFixture().battle!,
      allowRankWrap: false,
      activeCard: card(active),
      wildActive: false,
      tableau: [{ cards: [card(target, 'clubs')] }],
    };
    expect(canConnectInBattle(card(target, 'clubs'), battle)).toBe(false);
    expect(isPlayable(battle, card(target, 'clubs').id)).toBe(false);
    expect(getPlayableCards(battle)).toEqual([]);
    expect(hasLegalMoves(battle)).toBe(false);
    expect(hasLegalMovesForUI(battle)).toBe(false);
    const wild = { ...battle, wildActive: true };
    expect(getPlayableCards(wild)).toEqual([card(target, 'clubs')]);
    expect(hasLegalMovesForUI(wild)).toBe(true);
  });
  it.each([
    [12, 13],
    [13, 12],
    [1, 2],
    [2, 1],
  ])('allows adjacent castle %i to %i moves', (active, target) => {
    const battle = {
      ...battleFixture().battle!,
      allowRankWrap: false,
      activeCard: card(active),
      wildActive: false,
      tableau: [{ cards: [card(target, 'clubs')] }],
    };
    expect(isPlayable(battle, card(target, 'clubs').id)).toBe(true);
    expect(getPlayableCards(battle)).toEqual([card(target, 'clubs')]);
    expect(hasLegalMovesForUI(battle)).toBe(true);
  });
  it('does not advertise a covered card even when WILD is active', () => {
    const battle = {
      ...battleFixture().battle!,
      allowRankWrap: false,
      activeCard: card(13),
      wildActive: true,
      tableau: [{ cards: [card(1, 'clubs'), card(7, 'spades')] }],
    };
    expect(isPlayable(battle, card(1, 'clubs').id)).toBe(false);
    expect(getPlayableCards(battle)).toEqual([card(7, 'spades')]);
  });
});
