import { describe, it, expect } from 'vitest';
import { createTraining } from './CastleTutorial';
import { nextCastleCard } from './CastleDefense';

describe('interactive training', () => {
  it('uses a complete deck and teaches real undo, deployment and WILD rules', () => {
    const { manager, ids } = createTraining();
    const battle = manager.state!.run.battle!;
    const cards = [...battle.tableau.flatMap((c) => c.cards), ...battle.deck, battle.activeCard!];
    expect(new Set(cards.map((c) => c.id)).size).toBe(54);
    const before = manager.state;
    manager.play(ids[3]); // King cannot follow 7.
    expect(manager.state).toBe(before);
    manager.play(ids[0]);
    manager.play(ids[1]);
    const hp = manager.state!.run.player.hp;
    expect(manager.undo()).toBe(true);
    expect(manager.state!.run.player.hp).toBe(hp - 1);
    expect(manager.state!.run.battle!.activeCard!.rank).toBe(6);
    manager.play(ids[1]);
    manager.play(ids[2]);
    expect(manager.state!.run.battle!.chain.length).toBe(3);
    const preview = nextCastleCard(manager.state!)!;
    manager.draw();
    expect(manager.state!.run.battle!.activeCard!.id).toBe(preview.id);
    expect(manager.state!.siege.units.some((u) => u.kind === 'turret')).toBe(true);
    manager.play(ids[7]);
    expect(manager.state!.run.battle!.wildActive).toBe(true);
    for (const id of ids.slice(3, 7)) manager.play(id);
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
