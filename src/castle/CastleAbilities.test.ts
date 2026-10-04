import { describe, expect, it } from 'vitest';
import { config, memoryStorage } from '../test/fixtures';
import {
  createCastleRun,
  emptyUpgrades,
  useCastleAbility,
  drawCastleCard,
  playCastleCard,
  CASTLE_ABILITIES,
  type CastleAbility,
  type Invader,
} from './CastleDefense';
import { CastleManager } from './CastleManager';
import { createTraining } from './CastleTutorial';

const enemy = (id: number, hp: number): Invader => ({
  id,
  sprite: 'c_orc',
  boss: false,
  hp,
  maxHp: hp,
  progress: 0.5,
  speed: 0,
  damage: 1,
  cooldown: 10,
});
function usable(ability: CastleAbility) {
  const state = createCastleRun(`ability-${ability}`, config, emptyUpgrades());
  state.siege.coins = 300;
  state.run = {
    ...state.run,
    player: { ...state.run.player, hp: 20 },
    battle: { ...state.run.battle!, chain: [state.run.battle!.activeCard!] },
  };
  state.siege.enemies = [enemy(101, 100)];
  return state;
}

describe('one-use paid round abilities', () => {
  it('uses the requested prices', () => {
    expect(
      Object.fromEntries(Object.entries(CASTLE_ABILITIES).map(([key, value]) => [key, value.cost]))
    ).toEqual({ HEAL: 30, BOMB: 100, ECHO: 50 });
  });
  it.each(['HEAL', 'BOMB', 'ECHO'] as const)(
    'charges %s once and preserves its input',
    (ability) => {
      const state = usable(ability),
        before = structuredClone(state);
      const result = useCastleAbility(state, ability, config);
      expect(result.state).not.toBe(state);
      expect(result.state.siege.coins).toBe(300 - CASTLE_ABILITIES[ability].cost);
      expect(result.state.abilitiesUsed).toEqual([ability]);
      expect(result.events).toContainEqual({ type: 'ability', ability });
      expect(state).toEqual(before);
      expect(useCastleAbility(result.state, ability, config).state).toBe(result.state);
    }
  );
  it.each(['HEAL', 'BOMB', 'ECHO'] as const)(
    'rejects unaffordable %s without spending it',
    (ability) => {
      const state = usable(ability);
      state.siege.coins = CASTLE_ABILITIES[ability].cost - 1;
      expect(useCastleAbility(state, ability, config)).toEqual({ state, events: [] });
      expect(state.abilitiesUsed).toEqual([]);
      state.siege.coins++;
      expect(useCastleAbility(state, ability, config).state.siege.coins).toBe(0);
    }
  );
  it('HEAL restores eight health and caps it at the castle maximum', () => {
    const state = usable('HEAL');
    expect(useCastleAbility(state, 'HEAL', config).state.run.player.hp).toBe(28);
    state.run = { ...state.run, player: { ...state.run.player, hp: state.run.player.maxHp - 2 } };
    expect(useCastleAbility(state, 'HEAL', config).state.run.player.hp).toBe(
      state.run.player.maxHp
    );
    state.run = { ...state.run, player: { ...state.run.player, hp: state.run.player.maxHp } };
    expect(useCastleAbility(state, 'HEAL', config).state).toBe(state);
  });
  it('BOMB damages every enemy, commits kills and pays loot exactly once', () => {
    const state = usable('BOMB');
    state.siege.coins = 100;
    state.siege.enemies = [enemy(101, 6), enemy(102, 50)];
    const result = useCastleAbility(state, 'BOMB', config);
    expect(result.state.siege.enemies).toHaveLength(1);
    expect(result.state.siege.enemies[0].hp).toBe(38);
    expect(result.state.siege.kills).toBe(1);
    expect(result.state.siege.coins).toBe(1);
    expect(result.events.filter((event) => event.type === 'killed')).toHaveLength(1);
    expect(useCastleAbility(result.state, 'BOMB', config).state).toBe(result.state);
    state.siege.enemies = [];
    expect(useCastleAbility(state, 'BOMB', config).state).toBe(state);
  });
  it('ECHO adds two chain positions and releases the next reward on DRAW', () => {
    const state = usable('ECHO');
    expect(state.run.battle!.chain).toHaveLength(1);
    const result = useCastleAbility(state, 'ECHO', config).state;
    expect(result.run.battle!.chain).toHaveLength(3);
    expect(result.siege.units).toEqual([]);
    expect(drawCastleCard(result, config).state.siege.units.map((unit) => unit.kind)).toEqual([
      'soldier',
      'archer',
      'turret',
    ]);
    state.run = { ...state.run, battle: { ...state.run.battle!, chain: [] } };
    expect(useCastleAbility(state, 'ECHO', config).state).toBe(state);
  });
  it.each(['HEAL', 'BOMB', 'ECHO'] as const)(
    'persists %s spending through undo and reload',
    (ability) => {
      const storage = memoryStorage(),
        manager = new CastleManager(storage);
      const { manager: training, ids } = createTraining();
      manager.state = training.state;
      manager.state!.siege.coins = 300;
      manager.state!.siege.enemies = [enemy(101, 100)];
      manager.state!.run = {
        ...manager.state!.run,
        player: { ...manager.state!.run.player, hp: 20 },
      };
      manager.play(ids[0]);
      expect(manager.canUndo).toBe(true);
      manager.useAbility(ability);
      const coins = manager.state!.siege.coins;
      expect(manager.canUndo).toBe(true);
      manager.draw();
      expect(manager.undo()).toBe(true);
      expect(manager.undoDepth).toBe(2);
      expect(manager.state!.siege.coins).toBe(coins);
      expect(manager.state!.abilitiesUsed).toContain(ability);
      const reopened = new CastleManager(storage);
      expect(reopened.resume()).toBe(true);
      expect(reopened.undoDepth).toBe(2);
      const before = reopened.state;
      reopened.useAbility(ability);
      expect(reopened.state).toBe(before);
      expect(reopened.state!.siege.coins).toBe(coins);
      expect(reopened.undo()).toBe(true);
      expect(reopened.state!.siege.coins).toBe(300);
      expect(reopened.state!.abilitiesUsed).not.toContain(ability);
      reopened.start();
      expect(reopened.state!.abilitiesUsed).toEqual([]);
      expect(reopened.undoDepth).toBe(0);
    }
  );
  it.each(['HEAL', 'BOMB', 'ECHO', 'CRIT'] as const)(
    'does not activate a retired %s card power',
    (power) => {
      const { manager, ids } = createTraining();
      const state = manager.state!;
      state.siege.enemies = [enemy(101, 100)];
      state.run = {
        ...state.run,
        player: { ...state.run.player, hp: 20 },
        battle: { ...state.run.battle!, powerCards: [{ cardId: ids[0], type: power }] },
      };
      const result = playCastleCard(state, ids[0], config);
      expect(result.state.run.player).toEqual(state.run.player);
      expect(result.state.siege.enemies).toEqual(state.siege.enemies);
      expect(result.state.run.battle!.chain).toHaveLength(1);
      expect(result.state.abilitiesUsed).toEqual([]);
      expect(
        result.events.some(
          (event) =>
            event.type === 'card' && event.events.some((item) => item.type === 'power_activated')
        )
      ).toBe(false);
    }
  );
  it('keeps unlimited step history through abilities and reload', () => {
    const storage = memoryStorage(),
      manager = new CastleManager(storage);
    const { manager: training, ids } = createTraining();
    manager.state = training.state;
    manager.play(ids[0]);
    expect(manager.undo()).toBe(true);
    expect(manager.undoDepth).toBe(0);
    manager.play(ids[0]);
    manager.state!.siege.coins = 30;
    manager.state!.run = {
      ...manager.state!.run,
      player: { ...manager.state!.run.player, hp: 20 },
    };
    manager.useAbility('HEAL');
    expect(manager.canUndo).toBe(true);
    expect(manager.undoDepth).toBe(2);
    manager.draw();
    manager.undo();
    expect(manager.undoDepth).toBe(2);
    const reopened = new CastleManager(storage);
    expect(reopened.resume()).toBe(true);
    expect(reopened.undoDepth).toBe(2);
    reopened.draw();
    expect(reopened.undo()).toBe(true);
    expect(reopened.undoDepth).toBe(2);
    reopened.draw();
    expect(reopened.undo()).toBe(true);
    reopened.save();
    const exhausted = new CastleManager(storage);
    expect(exhausted.resume()).toBe(true);
    expect(exhausted.undoDepth).toBe(2);
    expect(exhausted.undo()).toBe(true);
    expect(exhausted.state!.abilitiesUsed).toEqual([]);
    expect(exhausted.undo()).toBe(true);
    expect(exhausted.undo()).toBe(false);
  });
  it('clears powers from recycled waste and consumed GUARD cannot activate again', () => {
    const { manager, ids } = createTraining();
    let state = manager.state!;
    state.run = {
      ...state.run,
      battle: { ...state.run.battle!, powerCards: [{ cardId: ids[0], type: 'GUARD' }] },
    };
    state = playCastleCard(state, ids[0], config).state;
    const armor = state.run.player.armor;
    state.run = {
      ...state.run,
      battle: {
        ...state.run.battle!,
        deck: [],
        discard: [...state.run.battle!.discard, ...state.run.battle!.deck],
      },
    };
    const recycled = drawCastleCard(state, config).state;
    expect(recycled.run.battle!.powerCards).toEqual([]);
    expect(recycled.run.battle!.wildActive).toBe(false);
    expect(recycled.run.player.armor).toBe(armor);
    const battle = recycled.run.battle!;
    const pack = [
      ...battle.tableau.flatMap((column) => column.cards),
      ...battle.deck,
      ...battle.discard,
      battle.activeCard!,
    ];
    expect(new Set(pack.map((card) => card.id)).size).toBe(52);
    const formerGuard = pack.find((card) => card.id === ids[0])!;
    const active = pack.find((card) => card.rank === formerGuard.rank - 1)!;
    const rest = pack.filter((card) => card !== formerGuard && card !== active);
    recycled.run = {
      ...recycled.run,
      battle: {
        ...battle,
        activeCard: active,
        tableau: [{ cards: [formerGuard] }, ...Array.from({ length: 6 }, () => ({ cards: [] }))],
        deck: rest,
        discard: [],
      },
    };
    const replayed = playCastleCard(recycled, formerGuard.id, config);
    expect(replayed.state).not.toBe(recycled);
    expect(replayed.state.run.player.armor).toBe(armor);
    expect(
      replayed.events.some((event) => event.type === 'boost' && event.effect === 'armor')
    ).toBe(false);
  });
  it('keeps GUARD and WILD on the field through reshuffle and save, then activates them normally', () => {
    const { manager, ids } = createTraining();
    const battle = manager.state!.run.battle!;
    const powers = [{ cardId: ids[3], type: 'GUARD' as const },
      { cardId: ids[2], type: 'GUARD' as const },
      { cardId: ids[7], type: 'WILD' as const }];
    manager.state!.run = { ...manager.state!.run, battle: { ...battle,
      deck: [], discard: [...battle.discard, ...battle.deck], powerCards: powers } };
    const before = structuredClone(manager.state!);
    manager.draw();
    expect(manager.state!.run.battle!.powerCards).toEqual(powers);
    const storage = memoryStorage(), reopened = new CastleManager(storage);
    reopened.service.save(manager.state!);
    expect(reopened.resume()).toBe(true);
    expect(reopened.state!.run.battle!.powerCards).toEqual(powers);
    reopened.state!.run = { ...reopened.state!.run,
      battle: { ...reopened.state!.run.battle!, wildActive: true } };
    const armor = reopened.state!.run.player.armor;
    reopened.play(ids[3]);
    expect([1, 5]).toContain(reopened.state!.run.player.armor - armor);
    reopened.state!.run = { ...reopened.state!.run,
      battle: { ...reopened.state!.run.battle!, wildActive: true } };
    reopened.play(ids[7]);
    expect(reopened.state!.usedPowers).toContain(ids[7]);
    expect(reopened.state!.run.battle!.wildActive).toBe(true);
    expect(manager.undo()).toBe(true);
    expect(manager.state).toEqual(before);
  });
  it('strips the recycled GUARD while preserving unused GUARD and WILD on the field', () => {
    const { manager, ids } = createTraining();
    const battle = manager.state!.run.battle!;
    manager.state!.run = { ...manager.state!.run, battle: { ...battle,
      powerCards: [{ cardId: ids[0], type: 'GUARD' }, { cardId: ids[3], type: 'GUARD' },
        { cardId: ids[7], type: 'WILD' }] } };
    manager.play(ids[0]);
    const current = manager.state!.run.battle!;
    manager.state!.run = { ...manager.state!.run, battle: { ...current,
      deck: [], discard: [...current.discard, ...current.deck] } };
    const armor = manager.state!.run.player.armor;
    manager.draw();
    expect(manager.state!.run.battle!.powerCards).toEqual([
      { cardId: ids[3], type: 'GUARD' }, { cardId: ids[7], type: 'WILD' },
    ]);
    expect(manager.state!.usedPowers).not.toContain(ids[0]);
    expect(manager.state!.run.player.armor).toBe(armor);
  });
});
