import { describe, expect, it } from 'vitest';
import { createTraining } from './CastleTutorial';
import { playCastleCard } from './CastleDefense';
import { config } from '../test/fixtures';

describe('scarce castle armor cards', () => {
  it('awards only 1 or 5 armor, with approximately 20% enhanced awards', () => {
    const { manager, ids } = createTraining();
    const before = manager.state!;
    before.run = { ...before.run,
      battle: { ...before.run.battle!, powerCards: [{ cardId: ids[0], type: 'GUARD' }] },
      player: { ...before.run.player, armor: 0 } };
    let enhanced = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const state = structuredClone(before);
      state.run = { ...state.run, rngState: seed };
      const result = playCastleCard(state, ids[0], config);
      const amount = result.state.run.player.armor;
      expect([1, 5]).toContain(amount);
      expect(result.events).toContainEqual({ type: 'boost', effect: 'armor', amount });
      expect(state.run.player.armor).toBe(0);
      if (amount === 5) enhanced++;
    }
    expect(enhanced).toBeGreaterThan(150);
    expect(enhanced).toBeLessThan(250);
  });
  it('replays the same armor award after undo without stacking armor', () => {
    const { manager, ids } = createTraining();
    manager.state!.run = { ...manager.state!.run,
      battle: { ...manager.state!.run.battle!, powerCards: [{ cardId: ids[0], type: 'GUARD' }] } };
    const initial = manager.state!.run.player.armor;
    manager.play(ids[0]);
    const armor = manager.state!.run.player.armor;
    const rng = manager.state!.run.rngState;
    expect([1, 5]).toContain(armor - initial);
    expect(manager.undo()).toBe(true);
    expect(manager.state!.run.player.armor).toBe(initial);
    manager.play(ids[0]);
    expect(manager.state!.run.player.armor).toBe(armor);
    expect(manager.state!.run.rngState).toBe(rng);
  });
});
