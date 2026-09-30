import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GameManager } from './GameManager';
import { battleFixture, memoryStorage } from '../test/fixtures';
import { loadGame, saveGame } from '../services/SaveService';

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

it('prepares and persists rewards when the last tableau card wins the battle', () => {
  const state = battleFixture();
  const battle = state.battle!;
  const card = battle.tableau[0].cards[0];
  const allCards = [
    ...battle.tableau.flatMap((col) => col.cards),
    ...battle.deck,
    ...battle.discard,
    battle.activeCard!,
  ];
  const active = allCards.find(
    (item) => item.id !== card.id && Math.abs(item.rank - card.rank) === 1
  )!;
  saveGame({
    ...state,
    battle: {
      ...battle,
      tableau: Array.from({ length: 7 }, (_, index) => ({ cards: index === 0 ? [card] : [] })),
      activeCard: active,
      deck: allCards.filter((item) => item.id !== card.id && item.id !== active.id),
      discard: [],
    },
  });
  const manager = new GameManager();
  expect(manager.loadSavedGame()).toBe(true);
  const result = manager.playCard(card.id)!;
  expect(result.state.phase).toBe('reward');
  expect(result.state.availableRewards).toHaveLength(3);
  expect(result.state).toEqual(manager.getState());
  expect(loadGame()).toEqual(result.state);
});

it('does not save or emit events for a rejected action', () => {
  const manager = new GameManager();
  manager.startNewRun('invalid-action');
  const write = vi.spyOn(localStorage, 'setItem');
  const listener = vi.fn();
  manager.onEvents(listener);
  const before = manager.getState();
  expect(manager.playCard('missing')?.state).toBe(before);
  expect(write).not.toHaveBeenCalled();
  expect(listener).not.toHaveBeenCalled();
});
