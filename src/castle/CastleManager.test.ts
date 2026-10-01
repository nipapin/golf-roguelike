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
