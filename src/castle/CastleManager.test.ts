import { describe, expect, it } from 'vitest';
import { CastleManager } from './CastleManager';
import { createCastleRun, emptyUpgrades, stepSiege } from './CastleDefense';
import { chooseGreedyCard } from '../core/Simulation';
const nextPlay = (m: CastleManager) => {
  for (let i = 0; i < 20; i++) {
    const id = chooseGreedyCard(m.state!.run, config);
    if (id) return id;
    m.draw();
  }
  throw new Error('No legal card in fixture');
};
import { config, memoryStorage } from '../test/fixtures';
const prepare = () => {
  const manager = new CastleManager(memoryStorage());
  manager.state = createCastleRun('castle-test', config, emptyUpgrades());
  nextPlay(manager);
  return manager;
};
describe('castle card undo', () => {
  it('restores only the last card, charges one HP and preserves live siege progress', () => {
    const manager = prepare();
    const before = manager.state!.run.battle!;
    manager.play(chooseGreedyCard(manager.state!.run, config)!);
    manager.state = stepSiege(manager.state!).state;
    const siege = manager.state!.siege;
    const hp = manager.state!.run.player.hp;
    expect(manager.canUndo).toBe(true);
    expect(manager.undo()).toBe(true);
    expect(manager.state!.run.battle).toEqual(before);
    expect(manager.state!.siege).toEqual(siege);
    expect(manager.state!.run.player.hp).toBe(hp - 1);
    expect(manager.undo()).toBe(false);
  });
  it('cannot undo a released deployment or kill the castle with its cost', () => {
    const manager = prepare();
    manager.play(nextPlay(manager));
    manager.draw();
    expect(manager.canUndo).toBe(false);
    manager.play(nextPlay(manager));
    manager.state!.run = { ...manager.state!.run, player: { ...manager.state!.run.player, hp: 1 } };
    expect(manager.undo()).toBe(false);
  });
  it('does not farm an immediate power when the undone card is replayed', () => {
    const manager = prepare();
    const card = chooseGreedyCard(manager.state!.run, config)!;
    manager.state!.run = {
      ...manager.state!.run,
      battle: { ...manager.state!.run.battle!, powerCards: [{ cardId: card, type: 'GOLD' }] },
    };
    const first = manager.play(card)!;
    expect(
      first.events.some(
        (e) => e.type === 'card' && e.events.some((p) => p.type === 'power_activated')
      )
    ).toBe(true);
    const gold = manager.state!.run.player.gold;
    manager.undo();
    manager.play(card);
    expect(manager.state!.run.player.gold).toBe(gold);
  });
});

describe('progress reset', () => {
  it('clears the run, wallet, upgrades, records and undo without erasing preferences', () => {
    const storage = memoryStorage();
    const manager = new CastleManager(storage);
    manager.start();
    manager.play(nextPlay(manager));
    manager.state!.siege.coins = 150;
    manager.state!.run = { ...manager.state!.run, phase: 'victory' };
    manager.service.settle(manager.state!);
    manager.service.purchase('magazine');
    manager.save();
    storage.setItem('castle-interactive-training-v1', 'yes');
    storage.setItem('golf-castle-rules-v1', 'yes');
    storage.setItem('golf_rogue_audio_settings', '{"musicVolume":0.2}');
    expect(manager.resetProgress()).toBe(true);
    expect(manager.state).toBeNull();
    expect(manager.canUndo).toBe(false);
    expect(manager.resume()).toBe(false);
    expect(manager.service.readMeta()).toMatchObject({
      coins: 0,
      bestSiege: 0,
      bestKills: 0,
      victories: 0,
      siegesStarted: 0,
      currentStreak: 0,
      upgrades: emptyUpgrades(),
    });
    expect(storage.getItem('castle-interactive-training-v1')).toBeNull();
    expect(storage.getItem('golf-castle-rules-v1')).toBeNull();
    expect(storage.getItem('golf_rogue_audio_settings')).toBe('{"musicVolume":0.2}');
    manager.start();
    expect(manager.state!.siegeNumber).toBe(1);
  });
  it('preserves the current session and saved data when storage rejects deletion', () => {
    const storage = memoryStorage();
    const manager = new CastleManager(storage);
    manager.start();
    const before = manager.state;
    const saved = storage.getItem('golf-castle-run-v1');
    storage.removeItem = () => {
      throw new Error('Storage denied');
    };
    expect(manager.resetProgress()).toBe(false);
    expect(manager.state).toBe(before);
    expect(storage.getItem('golf-castle-run-v1')).toBe(saved);
  });
});
