import { describe, it, expect } from 'vitest';
import { createTraining } from './CastleTutorial';
import { nextCastleCard } from './CastleDefense';

describe('interactive training', () => {
  it('uses a complete deck and teaches real undo, deployment and GUARD rules', () => {
    const { manager, ids } = createTraining();
    const battle = manager.state!.run.battle!;
    const cards = [...battle.tableau.flatMap((c) => c.cards), ...battle.deck, battle.activeCard!];
    expect(new Set(cards.map((c) => c.id)).size).toBe(52);
    const before = manager.state;
    manager.play(ids[3]); // Jack cannot follow 7 without a chain.
    expect(manager.state).toBe(before);
    manager.play(ids[0]);
    manager.play(ids[1]);
    const hp = manager.state!.run.player.hp;
    const undoResult = manager.undo();
    expect(undoResult.success).toBe(true);
    expect(undoResult.damage).toBe(1);
    expect(manager.state!.run.player.hp).toBe(hp - 1);
    expect(manager.undoDepth).toBe(1);
    expect(manager.state!.run.battle!.activeCard!.rank).toBe(6);
    manager.play(ids[1]);
    manager.play(ids[2]);
    expect(manager.state!.run.battle!.chain.length).toBe(3);
    const preview = nextCastleCard(manager.state!)!;
    manager.draw();
    expect(manager.state!.run.battle!.activeCard!.id).toBe(preview.id);
    expect(manager.state!.siege.units.some((u) => u.kind === 'turret')).toBe(true);
    // Play 10 (GUARD), J, Q, K, A to reach 5 cards for laser
    manager.play(ids[7]); // 10 (GUARD) from 9
    manager.play(ids[6]); // J from 10
    manager.play(ids[5]); // Q from J
    manager.play(ids[4]); // K from Q
    manager.play(ids[3]); // A from K (wrap)
    expect(manager.state!.run.battle!.chain.length).toBe(5);
    const result = manager.draw()!;
    expect(result.events.some((e) => e.type === 'laser')).toBe(true);
    expect(manager.state!.siege.units.filter((u) => u.kind === 'turret')).toHaveLength(1);
  });
  it('keeps training saves and progress isolated between sessions', () => {
    const first = createTraining();
    first.manager.play(first.ids[0]);
    first.manager.save();
    const second = createTraining();
    expect(second.manager.state!.run.battle!.chain).toHaveLength(0);
    expect(second.manager.service.readMeta().currentStreak).toBe(0);
  });
});
