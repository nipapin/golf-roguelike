import { describe, expect, it } from 'vitest';
import { config, memoryStorage } from '../test/fixtures';
import { canConnectInBattle } from '../core/GameState';
import { CastleManager } from './CastleManager';
import { CastleService } from './CastleService';
import { createCastleRun, emptyUpgrades, drawCastleCard, nextCastleCard, playCastleCard } from './CastleDefense';

function fixture(columns: number[][], ranks: number[]) {
  const state = createCastleRun('draw-order', config, emptyUpgrades());
  const battle = state.run.battle!;
  const pool = [...battle.tableau.flatMap(column => column.cards), ...battle.deck, battle.activeCard!];
  const take = (rank: number) => {
    const index = pool.findIndex(card => card.rank === rank);
    expect(index).toBeGreaterThanOrEqual(0);
    return pool.splice(index, 1)[0];
  };
  const activeCard = take(4);
  const tableau = columns.map(column => ({ cards: column.map(take) }));
  while (tableau.length < config.tableau.columns) tableau.push({ cards: [] });
  const deck = ranks.map(take);
  state.run = { ...state.run, battle: { ...battle, activeCard, tableau, deck, discard: pool, powerCards: [] } };
  state.drawAssistAt = 7;
  return state;
}
const draw = (state: ReturnType<typeof fixture>) => drawCastleCard(state, config).state;
const playable = (state: ReturnType<typeof fixture>) => state.run.battle!.tableau.some(column =>
  column.cards.length && canConnectInBattle(column.cards.at(-1)!, state.run.battle!));
const packIds = (state: ReturnType<typeof fixture>) => {
  const b = state.run.battle!;
  return [...b.tableau.flatMap(c => c.cards), ...b.deck, ...b.discard, b.activeCard!].map(c => c.id).sort();
};

describe('stock order after consecutive empty draws', () => {
  it('randomizes assistance across draws three through seven and preserves the remaining pack order', () => {
    const observed = new Set<number>();
    for (let seed = 0; seed < 50; seed++) {
      let state = fixture([[12]], [2, 3, 4, 5, 6, 7, 8, 13]);
      delete state.drawAssistAt;
      state.drawAssistRngState = seed;
      const original = state.run.battle!.deck.map(card => card.id);
      const ids = packIds(state);
      state = draw(state);
      const threshold = state.drawAssistAt!;
      expect(threshold).toBeGreaterThanOrEqual(3);
      expect(threshold).toBeLessThanOrEqual(7);
      observed.add(threshold);
      for (let number = 2; number < threshold; number++) {
        const before = structuredClone(state);
        expect(nextCastleCard(state)!.id).toBe(original[number - 1]);
        expect(state).toEqual(before);
        state = draw(state);
        expect(state.drawAssistAt).toBe(threshold);
        expect(state.run.battle!.activeCard!.id).toBe(original[number - 1]);
      }
      const before = structuredClone(state);
      expect(nextCastleCard(state)!.rank).toBe(13);
      expect(state).toEqual(before);
      state = draw(state);
      expect(state.run.battle!.activeCard!.rank).toBe(13);
      expect(state.run.battle!.deck.map(c => c.id)).toEqual(original.slice(threshold - 1, -1));
      expect(packIds(state)).toEqual(ids);
    }
    expect([...observed].sort()).toEqual([3, 4, 5, 6, 7]);
  });
  it('rolls once per streak and chooses a new threshold after a naturally useful card', () => {
    let state = fixture([[12]], [2, 13, 3, 4, 5, 6, 7, 8, 13]);
    delete state.drawAssistAt;
    state.drawAssistRngState = 25;
    state = draw(state);
    const firstStream = state.drawAssistRngState;
    expect(state.drawAssistAt).toBeGreaterThanOrEqual(3);
    state = draw(state);
    expect(state.emptyDraws).toBe(0);
    expect(state.drawAssistAt).toBeUndefined();
    expect(state.drawAssistRngState).toBe(firstStream);
    state = draw(state);
    expect(state.drawAssistAt).toBeGreaterThanOrEqual(3);
    expect(state.drawAssistAt).toBeLessThanOrEqual(7);
    expect(state.drawAssistRngState).not.toBe(firstStream);
    const threshold = state.drawAssistAt, stream = state.drawAssistRngState;
    state = draw(state);
    expect(state.drawAssistAt).toBe(threshold);
    expect(state.drawAssistRngState).toBe(stream);
  });
  it('preserves the first six draws, then extracts a card for the deepest exposed column', () => {
    let state = fixture([[10], [10], [11, 12]], [2, 3, 4, 5, 6, 7, 8, 9, 13]);
    const ids = packIds(state);
    for (const rank of [2, 3, 4, 5, 6, 7]) {
      state = draw(state);
      expect(state.run.battle!.activeCard!.rank).toBe(rank);
      expect(playable(state)).toBe(false);
    }
    expect(state.emptyDraws).toBe(6);
    const before = structuredClone(state);
    expect(nextCastleCard(state)!.rank).toBe(13);
    expect(state).toEqual(before);
    state = draw(state);
    expect(state.run.battle!.activeCard!.rank).toBe(13);
    expect(state.run.battle!.deck.map(c => c.rank)).toEqual([8, 9]);
    expect(state.emptyDraws).toBe(0);
    expect(state.drawAssistAt).toBeUndefined();
    expect(packIds(state)).toEqual(ids);
  });
  it('keeps a naturally useful seventh card even when a deeper column could be opened', () => {
    const state = fixture([[10], [11, 12]], [9, 13]);
    state.emptyDraws = 6;
    const result = draw(state);
    expect(result.run.battle!.activeCard!.rank).toBe(9);
    expect(result.run.battle!.deck.map(c => c.rank)).toEqual([13]);
  });
  it('does not take cards from discard when the remaining stock cannot open a move', () => {
    let state = fixture([[12]], [2, 3, 4, 5, 6, 7, 8, 2, 3, 4, 5, 6, 7, 8]);
    state.drawAssistAt = 3;
    const expected = state.run.battle!.deck.map(c => c.id);
    const discard = state.run.battle!.discard.map(c => c.id);
    for (const id of expected) {
      state = draw(state);
      expect(state.run.battle!.activeCard!.id).toBe(id);
      expect(playable(state)).toBe(false);
    }
    expect(state.run.battle!.deck).toEqual([]);
    expect(state.run.battle!.discard.map(c => c.id).slice(0, discard.length)).toEqual(discard);
  });
  it.each([[1, 13], [13, 1]])('uses wrap-around rank rules for exposed rank %d connecting to %d', (top, wrap) => {
    const state = fixture([[top]], [wrap, 6, 7]);
    state.emptyDraws = 6;
    const result = draw(state);
    expect(result.run.battle!.activeCard!.rank).toBe(wrap);
    expect(result.run.battle!.deck.map(c => c.rank)).toEqual([6, 7]);
  });
  it('targets only exposed cards and falls back when a larger column has no matching stock card', () => {
    const state = fixture([[12, 10], [6]], [13, 5, 2]);
    state.emptyDraws = 6;
    expect(draw(state).run.battle!.activeCard!.rank).toBe(5);
  });
  it('starts a fresh empty-draw streak after a usable card or accepted play', () => {
    let state = fixture([[10, 10]], [3, 9, 4, 5]);
    state.emptyDraws = 4;
    state = draw(state);
    expect(state.emptyDraws).toBe(5);
    state = draw(state);
    expect(state.emptyDraws).toBe(0);
    state.emptyDraws = 6;
    state = playCastleCard(state, state.run.battle!.tableau[0].cards.at(-1)!.id, config).state;
    expect(state.emptyDraws).toBe(0);
    state = draw(state);
    expect(state.emptyDraws).toBe(1);
  });
  it('previews and draws the same selected card after recycling without mutating RNG', () => {
    const state = fixture([[12]], []);
    state.emptyDraws = 6;
    const before = structuredClone(state);
    const card = nextCastleCard(state)!;
    expect(state).toEqual(before);
    const result = draw(state);
    expect(result.run.battle!.activeCard!.id).toBe(card.id);
    expect(playable(result)).toBe(true);
    expect(packIds(result)).toEqual(packIds(before));
  });
  it('persists the streak and restores both count and stock order on undo', () => {
    const storage = memoryStorage(), manager = new CastleManager(storage);
    manager.state = fixture([[12]], [2, 3, 4, 5, 6, 7, 8, 13]);
    for (let i = 0; i < 6; i++) manager.draw();
    const before = structuredClone(manager.state!);
    const reopened = new CastleManager(storage);
    expect(reopened.resume()).toBe(true);
    expect(reopened.state!.emptyDraws).toBe(6);
    expect(reopened.state!.drawAssistAt).toBe(7);
    expect(reopened.state!.drawAssistRngState).toBe(before.drawAssistRngState);
    const result = reopened.draw()!.state;
    expect(result.run.battle!.activeCard!.rank).toBe(13);
    expect(reopened.undo()).toBe(true);
    expect(reopened.state).toEqual(before);
    expect(reopened.draw()!.state).toEqual(result);
  });
  it('supports older saves without a draw streak', () => {
    const storage = memoryStorage(), service = new CastleService(storage);
    const state = fixture([[12]], [2, 13]);
    delete state.emptyDraws;
    delete state.drawAssistAt;
    delete state.drawAssistRngState;
    service.save(state);
    const result = draw(service.load()!);
    expect(result.run.battle!.activeCard!.rank).toBe(2);
    expect(result.emptyDraws).toBe(1);
  });
  it('cannot reroll a new streak through undo, replay or reload', () => {
    const storage = memoryStorage(), manager = new CastleManager(storage);
    manager.state = fixture([[12]], [2, 3, 4, 5, 6, 7, 8, 13]);
    delete manager.state.drawAssistAt;
    manager.state.drawAssistRngState = 43;
    const initial = structuredClone(manager.state);
    const first = structuredClone(manager.draw()!.state);
    const reopened = new CastleManager(storage);
    expect(reopened.resume()).toBe(true);
    expect(reopened.state!.drawAssistAt).toBe(first.drawAssistAt);
    expect(reopened.state!.drawAssistRngState).toBe(first.drawAssistRngState);
    expect(reopened.undo()).toBe(true);
    expect(reopened.state).toEqual(initial);
    expect(reopened.draw()!.state).toEqual(first);
  });
});
