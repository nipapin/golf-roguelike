import { describe, expect, it } from 'vitest';
import {
  createCastleRun,
  emptyUpgrades,
  drawCastleCard,
  playCastleCard,
  stepSiege,
} from './CastleDefense';
import { CastleManager } from './CastleManager';
import { CastleService } from './CastleService';
import { config, memoryStorage } from '../test/fixtures';

function board() {
  const state = createCastleRun('exhaustion', config, emptyUpgrades());
  const battle = state.run.battle!;
  const pack = [...battle.tableau.flatMap((c) => c.cards), ...battle.deck, battle.activeCard!];
  const active = pack.find((c) => c.rank === 4)!;
  const playable = pack.find((c) => c.rank === 5)!;
  const blocked = pack.find((c) => c.rank === 9)!;
  state.run = {
    ...state.run,
    battle: {
      ...battle,
      activeCard: active,
      deck: [],
      tableau: [
        { cards: [playable] },
        { cards: [blocked] },
        ...Array.from({ length: 5 }, () => ({ cards: [] })),
      ],
      discard: pack.filter((c) => ![active.id, playable.id, blocked.id].includes(c.id)),
      powerCards: [],
      chain: [],
    },
  };
  return { state, playable };
}
describe('finite pack balance', () => {
  it('keeps legal moves with empty stock, then charges 5 HP and deals a fresh pack', () => {
    const { state, playable } = board();
    expect(drawCastleCard(state, config).state.run.phase).toBe('battle');
    const result = playCastleCard(state, playable.id, config);
    expect(result.state.run.phase).toBe('battle');
    expect(result.state.run.player.hp).toBe(state.run.player.hp - 5);
    expect(result.events).toContainEqual({ type: 'redeal', hpCost: 5 });
    expect(result.state.run.battle!.deck).toHaveLength(18);
    expect(result.state.run.battle!.tableau.map((c) => c.cards.length)).toEqual([
      5, 5, 5, 5, 5, 5, 5,
    ]);
    expect(result.state.run.battle!.chain).toHaveLength(0);
    expect(result.state.siege).toEqual({ ...state.siege, started: true });
    expect(result.state.run.rngState).not.toBe(state.run.rngState);
    expect(playCastleCard(state, playable.id, config)).toEqual(result);
  });
  it('redeals after the last draw and does not charge again on the next tick', () => {
    const { state } = board();
    const b = state.run.battle!;
    const next = b.discard.find((c) => c.rank === 11)!;
    state.run = {
      ...state.run,
      battle: { ...b, deck: [next], discard: b.discard.filter((c) => c.id !== next.id) },
    };
    const result = drawCastleCard(state, config);
    expect(result.state.run.phase).toBe('battle');
    expect(result.state.run.player.hp).toBe(25);
    expect(result.state.run.battle!.deck).toHaveLength(18);
    expect(stepSiege(result.state).state.run.player.hp).toBe(25);
  });

  it.each([1, 5])('falls at %i HP when it cannot pay for another deal, even with armor', (hp) => {
    const { state, playable } = board();
    state.run = { ...state.run, player: { ...state.run.player, hp, armor: 50 } };
    const result = playCastleCard(state, playable.id, config);
    expect(result.state.run.phase).toBe('defeat');
    expect(result.state.run.player.hp).toBe(0);
    expect(result.state.run.player.armor).toBe(50);
    expect(result.events.some((e) => e.type === 'redeal')).toBe(false);
    expect(result.events).toContainEqual({ type: 'ended', victory: false });
  });
  it('saves a paid deal without settling the wallet or allowing undo into the old board', () => {
    const storage = memoryStorage();
    const manager = new CastleManager(storage);
    const { state, playable } = board();
    state.usedPowers = ['old-card'];
    state.run = { ...state.run, player: { ...state.run.player, armor: 17, gold: 12 } };
    state.siege.coins = 9;
    manager.state = state;
    manager.play(playable.id);
    expect(manager.canUndo).toBe(false);
    expect(manager.state!.run.player).toMatchObject({ hp: 25, armor: 17, gold: 13 });
    expect(manager.state!.siege.coins).toBe(9);
    expect(manager.state!.usedPowers).toEqual([]);
    expect(manager.service.readMeta().claimed).toEqual([]);
    const saved = manager.state;
    expect(manager.resume()).toBe(true);
    expect(manager.state).toEqual(saved);
  });
  it('wins when the last playable card clears the tableau, even with empty stock', () => {
    const { state, playable } = board();
    const b = state.run.battle!;
    state.run = {
      ...state.run,
      battle: {
        ...b,
        discard: [...b.discard, ...b.tableau[1].cards],
        tableau: b.tableau.map((c, i) => (i === 1 ? { cards: [] } : c)),
      },
    };
    expect(playCastleCard(state, playable.id, config).state.run.phase).toBe('victory');
  });
  it('deals 3 or 4 bonuses and preserves the 54-card pack', () => {
    const counts = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const b = createCastleRun(`powers-${i}`, config, emptyUpgrades()).run.battle!;
      counts.add(b.powerCards.length);
      expect([3, 4]).toContain(b.powerCards.length);
      expect(b.tableau.flatMap((c) => c.cards).length + b.deck.length + 1).toBe(54);
    }
    expect(counts).toEqual(new Set([3, 4]));
  });
});
describe('wave rewards and repair costs', () => {
  it('persists three distinct choices, prevents skipping/double claiming, and applies the chosen bonus', () => {
    const storage = memoryStorage();
    const manager = new CastleManager(storage);
    manager.start();
    manager.state!.run = { ...manager.state!.run, phase: 'victory' };
    manager.service.settle(manager.state!);
    const offer = manager.service.readMeta().pendingReward!;
    expect(new Set(offer.choices).size).toBe(3);
    const reopened = new CastleService(storage);
    expect(reopened.readMeta().pendingReward).toEqual(offer);
    manager.start();
    expect(manager.state!.run.phase).toBe('victory');
    const key = offer.choices[0];
    expect(reopened.chooseReward(key)).toBe(true);
    expect(reopened.chooseReward(key)).toBe(false);
    manager.service.settle(manager.state!);
    expect(reopened.readMeta().pendingReward).toBeNull();
    manager.start();
    expect(manager.state!.siegeNumber).toBe(2);
    expect(manager.state!.upgrades[key]).toBe(1);
    manager.save();
    expect(reopened.load()).toEqual(manager.state);
  });
  it('halves the whole wallet including current earnings exactly once and resets only run bonuses', () => {
    const storage = memoryStorage();
    const service = new CastleService(storage);
    const win = createCastleRun('win', config, emptyUpgrades());
    win.run = { ...win.run, phase: 'victory' };
    win.siege.coins = 90;
    service.settle(win); // 100 gold
    service.purchase('walls'); // 90 gold
    service.chooseReward(service.readMeta().pendingReward!.choices[0]);
    const lost = createCastleRun('lost', config, emptyUpgrades());
    lost.run = { ...lost.run, phase: 'defeat', player: { ...lost.run.player, gold: 3 } };
    lost.siege.coins = 10;

    service.settle(lost);
    expect(service.readMeta()).toMatchObject({
      coins: 51,
      currentStreak: 0,
      upgrades: { walls: 1 },
      runUpgrades: emptyUpgrades(),
      pendingReward: null,
    });
    service.settle(lost);
    expect(service.readMeta().coins).toBe(51);
  });
});
