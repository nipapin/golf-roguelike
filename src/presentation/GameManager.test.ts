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

it('offers a persisted starter relic and begins fight 1 after choosing it', () => {
  const manager = new GameManager();
  manager.startNewRun('starter-build');
  const choices = manager.getState()!;
  expect(choices.phase).toBe('reward');
  expect(choices.rewardKind).toBe('starter');
  expect(choices.availableRewards).toHaveLength(3);
  expect(choices.battle).toBeNull();
  const reloaded = new GameManager();
  expect(reloaded.loadSavedGame()).toBe(true);
  expect(reloaded.getState()).toEqual(choices);
  const chosen = choices.availableRewards[0];
  const result = reloaded.selectRelic(chosen.id)!;
  expect(result.state.phase).toBe('battle');
  expect(result.state.currentFight).toBe(0);
  expect(result.state.player.relics).toContainEqual(chosen);
  expect(result.state.battle?.tableau).toHaveLength(7);
  expect(loadGame()).toEqual(result.state);
});

it('skips a starter upgrade without skipping the first encounter', () => {
  const manager = new GameManager();
  manager.startNewRun('skip-starter');
  const result = manager.skipReward()!;
  expect(result.state.phase).toBe('battle');
  expect(result.state.currentFight).toBe(0);
  expect(result.state.player.relics).toHaveLength(0);
  expect(result.state.battle).not.toBeNull();
});
