import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGame, saveGame, hasSave } from './SaveService';
import { battleFixture, config, enemies, memoryStorage } from '../test/fixtures';
import { drawCard, playCard, setupRewards, startNextBattle } from '../core/GameActions';
import { getPlayableCards } from '../core/GameRules';
import relicsData from '../data/relics.json';
import type { Relic, RunState } from '../core/types';

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('saved battle', () => {
  it('continues exactly like an uninterrupted seeded battle, including future RNG draws', () => {
    let uninterrupted = battleFixture();
    let resumed = battleFixture();
    for (let step = 0; step < 80; step++) {
      expect(saveGame(resumed)).toBe(true);
      const loaded = loadGame();
      expect(loaded).toEqual(uninterrupted);
      expect(loaded).not.toBeNull();
      resumed = loaded!;
      if (!uninterrupted.battle) break;
      const playable = getPlayableCards(uninterrupted.battle)[0];
      const action = (state: RunState) =>
        playable ? playCard(state, playable.id, config) : drawCard(state, config);
      const snapshot = structuredClone(uninterrupted);
      const expected = action(uninterrupted);
      const actual = action(resumed);
      expect(actual).toEqual(expected);
      expect(uninterrupted).toEqual(snapshot); // actions must not mutate input
      uninterrupted = expected.state;
      resumed = actual.state;
    }
    // Reward selection and a new deal consume RNG after a reload too.
    uninterrupted = setupRewards(
      { ...uninterrupted, phase: 'reward', battle: null, player: { ...uninterrupted.player, hp: uninterrupted.player.maxHp } },
      relicsData.relics as Relic[]
    );
    expect(saveGame(uninterrupted)).toBe(true);
    resumed = loadGame()!;
    expect(resumed).not.toBeNull();
    expect(startNextBattle({ ...resumed, currentFight: 1 }, enemies, config)).toEqual(
      startNextBattle({ ...uninterrupted, currentFight: 1 }, enemies, config)
    );
  });

  it.each([
    null,
    { version: 999, state: battleFixture() },
    { version: 1, state: { seed: 'partial' } },
    { version: 1, state: { ...battleFixture(), rngState: null } },
    { version: 1, state: { ...battleFixture(), phase: 'unknown' } },
    { version: 1, state: { ...battleFixture(), battle: null } },
    { version: 1, state: { ...battleFixture(), currentFight: 999 } },
  ])('rejects an incompatible or incomplete save', (data) => {
    localStorage.setItem('golf-rogue-save', JSON.stringify(data));
    expect(hasSave()).toBe(false);
    expect(loadGame()).toBeNull();
    expect(localStorage.getItem('golf-rogue-save')).toBeNull();
  });

  it('rejects invalid intent indices and duplicated physical cards', () => {
    const state = battleFixture();
    const battle = state.battle!;
    for (const corrupt of [
      { ...battle, enemy: { ...battle.enemy, currentIntentIndex: 999 } },
      { ...battle, deck: [battle.activeCard!, ...battle.deck.slice(1)] },
    ]) {
      localStorage.setItem(
        'golf-rogue-save',
        JSON.stringify({ version: 1, state: { ...state, battle: corrupt } })
      );
      expect(loadGame()).toBeNull();
    }
  });

  it('handles malformed JSON and unavailable storage', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('golf-rogue-save', '{');
    expect(loadGame()).toBeNull();
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('full');
      },
      removeItem() {
        throw new Error('denied');
      },
    });
    expect(saveGame(battleFixture())).toBe(false);
    expect(loadGame()).toBeNull();
    expect(hasSave()).toBe(false);
    vi.restoreAllMocks();
  });
});
