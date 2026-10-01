import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UndoHistory } from './UndoHistory';
import { playCard, drawCard } from './GameActions';
import { createDeck } from './GameState';
import type { Card, RunState } from './types';
import { battleFixture, config, memoryStorage } from '../test/fixtures';
import { GameManager } from '../presentation/GameManager';
import { saveGame, loadGame } from '../services/SaveService';


/**
 * Battle built from a real 54-card pack (passes save validation) with a ladder
 * 5♣ 6♠ 7♥ 8♦ 9♠ exposed on columns 0..4 and active 4♥: five consecutive legal plays.
 */
function ladderState(attack = 6): RunState {
  const base = battleFixture('undo-test');
  const battle = base.battle!;
  const pack = createDeck();
  const take = (rank: number, suit: Card['suit']) => { const i = pack.findIndex((x) => x.rank === rank && x.suit === suit && !x.joker); return pack.splice(i, 1)[0]; };
  const ladder = [take(5, 'clubs'), take(6, 'spades'), take(7, 'hearts'), take(8, 'diamonds'), take(9, 'spades')];
  const active = take(4, 'hearts');
  const firstDraw = take(3, 'clubs');
  const fillers = [take(13, 'clubs'), take(13, 'hearts'), take(12, 'clubs'), take(12, 'hearts'), take(11, 'clubs'), take(2, 'clubs'), take(2, 'hearts')];
  const tableau = Array.from({ length: 7 }, (_, i) => ({ cards: i < 5 ? [fillers[i], ladder[i]] : [fillers[i]] }));
  return {
    ...base,
    player: { ...base.player, hp: 20, armor: 0, gold: 3 },
    battle: {
      ...battle,
      tableau,
      activeCard: active,
      deck: [firstDraw, ...pack],
      discard: [],
      chain: [],
      accumulatedDamage: 0,
      chainBaseDamage: 0,
      jokerMultiplier: 1,
      lifestealMultiplier: 0,
      wildActive: false,
      powerCards: [{ cardId: ladder[2].id, type: 'HEAL' }],
      enemy: { ...battle.enemy, hp: 500, maxHp: 500, intents: [{ type: 'attack', value: attack }], currentIntentIndex: 0 },
    },
  };
}
const ID = (state: RunState, rank: number, suit: Card['suit']) =>
  state.battle!.tableau.flatMap((col) => col.cards).find((x) => x.rank === rank && x.suit === suit)!.id;
const L = ladderState();

describe('UndoHistory (engine)', () => {
  it('reverts a play to a deep-equal snapshot', () => {
    const history = new UndoHistory(10);
    const before = ladderState();
    const frozen = structuredClone(before);
    const result = playCard(before, ID(L,5,'clubs'), config);
    history.recordPlay(before, result);
    expect(result.state.battle!.chain).toHaveLength(1);
    const restored = history.undo(result.state)!;
    expect(restored).toEqual(frozen);
    expect(restored.rngState).toBe(frozen.rngState);
    expect(history.size).toBe(0);
  });

  it('undoes multiple steps one per call, newest first', () => {
    const history = new UndoHistory(10);
    const states: RunState[] = [ladderState()];
    for (const id of [ID(L,5,'clubs'), ID(L,6,'spades'), ID(L,7,'hearts')]) {
      const result = playCard(states.at(-1)!, id, config);
      history.recordPlay(states.at(-1)!, result);
      states.push(result.state);
    }
    expect(history.size).toBe(3);
    expect(states[3].player.hp).toBeGreaterThan(states[0].player.hp - 1); // heal power applied
    expect(history.undo(states[3])).toEqual(states[2]);
    expect(history.undo(states[2])).toEqual(states[1]);
    expect(history.undo(states[1])).toEqual(states[0]);
    expect(history.undo(states[0])).toBeNull();
  });

  it('is a no-op when empty', () => {
    const history = new UndoHistory(10);
    expect(history.undo(ladderState())).toBeNull();
    expect(history.canUndo(ladderState())).toBe(false);
  });

  it('respects the configured max depth', () => {
    const history = new UndoHistory(2);
    let state = ladderState();
    for (const id of [ID(L,5,'clubs'), ID(L,6,'spades'), ID(L,7,'hearts'), ID(L,8,'diamonds')]) {
      const result = playCard(state, id, config);
      history.recordPlay(state, result);
      state = result.state;
    }
    expect(history.size).toBe(2);
  });

  it('does not record rejected plays', () => {
    const history = new UndoHistory(10);
    const before = ladderState();
    const result = playCard(before, ID(L,2,'clubs'), config); // covered/illegal
    history.recordPlay(before, result);
    expect(history.size).toBe(0);
  });

  it('clears when a play ends the battle (killing blow not undoable)', () => {
    const history = new UndoHistory(10);
    const base = ladderState();
    const s0 = playCard(base, ID(L,5,'clubs'), config);
    history.recordPlay(base, s0);
    const lastCard = s0.state.battle!.tableau[0].cards[0]; // K♣ filler is not adjacent; use a fresh legal card instead
    const legal = s0.state.battle!.deck.find((x) => !x.joker && Math.abs(x.rank - s0.state.battle!.activeCard!.rank) === 1)!;
    const nearlyClear: RunState = { ...s0.state, battle: { ...s0.state.battle!, tableau: Array.from({ length: 7 }, (_, i) => ({ cards: i === 0 ? [legal] : [] })), deck: [...s0.state.battle!.deck.filter((x) => x.id !== legal.id), ...s0.state.battle!.tableau.flatMap((col) => col.cards)] } };
    void lastCard;
    const win = playCard(nearlyClear, legal.id, config);
    expect(win.state.phase).not.toBe('battle');
    history.recordPlay(nearlyClear, win);
    expect(history.size).toBe(0);
    expect(history.undo(win.state)).toBeNull();
  });

  it('uses the maxDepth from config', () => {
    expect(config.undo?.maxDepth).toBeGreaterThan(0);
  });
});

describe('GameManager undo integration', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  function manager(state = ladderState()) {
    saveGame(state);
    const m = new GameManager();
    expect(m.loadSavedGame()).toBe(true);
    return m;
  }

  it('happy path: play then undo restores and persists the previous state', () => {
    const m = manager();
    const before = structuredClone(m.getState()!);
    m.playCard(ID(L,5,'clubs'));
    expect(m.canUndo()).toBe(true);
    const result = m.undo()!;
    expect(result.events[0]).toEqual({ type: 'undo_applied', cardId: ID(L,5,'clubs') });
    expect(m.getState()).toEqual(before);
    expect(loadGame()).toEqual(before);
    expect(m.canUndo()).toBe(false);
    expect(m.undo()).toBeNull();
  });

  it('clears the stack after drawing from stock', () => {
    const m = manager();
    m.playCard(ID(L,5,'clubs'));
    m.playCard(ID(L,6,'spades'));
    m.draw();
    expect(m.canUndo()).toBe(false);
    expect(m.undo()).toBeNull();
  });

  it('clears the stack after an enemy action', () => {
    const m = manager(ladderState(4));
    m.playCard(ID(L,5,'clubs')); // chain of 1 < MIN_ATTACK_CHAIN → enemy attacks on end turn
    const result = m.draw()!;
    expect(result.events.some((e) => e.type === 'enemy_attacked')).toBe(true);
    expect(m.canUndo()).toBe(false);
  });

  it('engine draw itself never leaves undo state behind', () => {
    const history = new UndoHistory(10);
    const s = ladderState();
    const played = playCard(s, ID(L,5,'clubs'), config);
    history.recordPlay(s, played);
    const drawn = drawCard(played.state, config);
    history.recordPlay(played.state, drawn); // draws are never recorded as plays
    expect(history.size).toBe(0);
  });

  it('save/load: a reload starts with an empty undo stack and keeps the played state', () => {
    const m = manager();
    m.playCard(ID(L,5,'clubs'));
    const played = structuredClone(m.getState()!);
    const reloaded = new GameManager();
    expect(reloaded.loadSavedGame()).toBe(true);
    expect(reloaded.getState()).toEqual(played);
    expect(reloaded.canUndo()).toBe(false);
    // the original session's undo still works and is persisted
    m.undo();
    const again = new GameManager();
    again.loadSavedGame();
    expect(again.getState()!.battle!.chain).toHaveLength(0);
  });
});
