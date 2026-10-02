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
  it('keeps playing with empty stock while a legal card exists, then loses immediately', () => {
    const { state, playable } = board();
    expect(drawCastleCard(state, config).state.run.phase).toBe('battle');
    const result = playCastleCard(state, playable.id, config);
    expect(result.state.run.phase).toBe('defeat');
    expect(result.state.run.player.hp).toBe(0);
    expect(result.events).toContainEqual({ type: 'ended', victory: false });
    expect(result.state.run.battle!.deck).toHaveLength(0);
  });
  it('loses on the last draw and on reopening an exhausted board', () => {
    const { state } = board();
    const b = state.run.battle!;
    const next = b.discard.find((c) => c.rank === 11)!;
    state.run = {
      ...state.run,
      battle: { ...b, deck: [next], discard: b.discard.filter((c) => c.id !== next.id) },
    };
    const result = drawCastleCard(state, config);
    expect(result.state.run.phase).toBe('defeat');
    expect(result.state.run.battle!.deck).toHaveLength(0);
    const resumed = { ...result.state, run: { ...result.state.run, phase: 'battle' as const } };
    expect(stepSiege(resumed).state.run.phase).toBe('defeat');
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
