import { describe, expect, it } from 'vitest';
import { CastleManager } from './CastleManager';
import { createTraining } from './CastleTutorial';
import { createCastleRun, emptyUpgrades, stepSiege, CASTLE_RECYCLE_HP_COST } from './CastleDefense';
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

describe('castle move undo', () => {
  it('undoes more than three mixed steps through drawing and reloading', () => {
    const storage = memoryStorage(), manager = new CastleManager(storage);
    const training = createTraining();
    manager.state = training.manager.state;
    // A spent quota in an old save must not disable the new unlimited undo.
    manager.state!.undoRemaining = 0;
    const snapshots: NonNullable<CastleManager['state']>[] = [];
    const play = (index: number) => {
      snapshots.push(structuredClone(manager.state!));
      const before = manager.state;
      manager.play(training.ids[index]);
      expect(manager.state).not.toBe(before);
    };
    play(0); play(1); play(2);
    snapshots.push(structuredClone(manager.state!));
    manager.draw();
    play(7); // 10 follows drawn 9 (GUARD gives armor).
    play(6); // 10 -> J
    play(5); play(4); // J -> Q -> K
    const reopened = new CastleManager(storage);
    expect(reopened.resume()).toBe(true);
    expect(reopened.undoDepth).toBe(8);
    for (const snapshot of snapshots.reverse()) {
      expect(reopened.canUndo).toBe(true);
      const hpBefore = reopened.state!.run.player.hp;
      const result = reopened.undo();
      expect(result.success).toBe(true);
      expect(result.damage).toBe(1);
      expect(reopened.state!.run.player.hp).toBe(hpBefore - 1);
      const expected = { ...snapshot, run: { ...snapshot.run, player: { ...snapshot.run.player, hp: reopened.state!.run.player.hp } } };
      expect(reopened.state).toEqual(expected);
    }
    expect(reopened.canUndo).toBe(false);
    expect(reopened.undo().success).toBe(false);
  });
  it('restores the complete state before a play, including intervening siege time, but deducts undo HP cost', () => {
    const manager = prepare();
    const before = structuredClone(manager.state!);
    manager.play(chooseGreedyCard(manager.state!.run, config)!);
    manager.state = stepSiege(manager.state!).state;
    const hpBefore = manager.state!.run.player.hp;
    expect(manager.canUndo).toBe(true);
    const result = manager.undo();
    expect(result.success).toBe(true);
    expect(result.damage).toBe(1);
    expect(manager.state!.run.player.hp).toBe(hpBefore - 1);
    const expected = { ...before, run: { ...before.run, player: { ...before.run.player, hp: manager.state!.run.player.hp } } };
    expect(manager.state).toEqual(expected);
  });
  it('undoes draws and released deployments, then continues undoing earlier plays', () => {
    const { manager, ids } = createTraining();
    manager.state!.progression = { xp: 20, level: 3, modules: [] };
    manager.play(ids[0]);
    manager.play(ids[1]);
    manager.play(ids[2]);
    const beforeDraw = structuredClone(manager.state!);
    const firstDraw = manager.draw()!;
    expect(manager.state!.siege.units).toHaveLength(3);
    const hpBeforeUndo = manager.state!.run.player.hp;
    expect(manager.undo().success).toBe(true);
    expect(manager.state!.run.player.hp).toBe(hpBeforeUndo - 1);
    const expectedBeforeDraw = { ...beforeDraw, run: { ...beforeDraw.run, player: { ...beforeDraw.run.player, hp: manager.state!.run.player.hp } } };
    expect(manager.state).toEqual(expectedBeforeDraw);
    // Replaying a draw neither duplicates soldiers nor reload rewards.
    expect(manager.draw()!.events).toEqual(firstDraw.events);
    expect(manager.state!.siege.units).toHaveLength(3);
    expect(manager.undo().success).toBe(true);
    expect(manager.undo().success).toBe(true);
    expect(manager.undoDepth).toBe(2);
    expect(manager.state!.run.battle!.chain).toHaveLength(2);
    expect(manager.undo().success).toBe(true);
    expect(manager.undo().success).toBe(true);
    expect(manager.undo().success).toBe(false);
  });
  it('blocks undo at low HP to prevent castle death from undo cost', () => {
    const { manager } = createTraining();
    manager.state!.run = { ...manager.state!.run, player: { ...manager.state!.run.player, hp: 1 } };
    manager.draw();
    expect(manager.canUndo).toBe(false);
    expect(manager.undo().success).toBe(false);
    expect(manager.state!.run.player.hp).toBe(1);
    expect(manager.undoDepth).toBe(1);
  });
  it('allows undo at HP above the cost threshold', () => {
    const { manager } = createTraining();
    manager.state!.run = { ...manager.state!.run, player: { ...manager.state!.run.player, hp: 2 } };
    manager.draw();
    expect(manager.canUndo).toBe(true);
    const result = manager.undo();
    expect(result.success).toBe(true);
    expect(result.damage).toBe(1);
    expect(manager.state!.run.player.hp).toBe(1);
    expect(manager.undoDepth).toBe(0);
  });
  it('restores a GUARD card and its armor instead of stacking it on replay', () => {
    const manager = prepare();
    const card = chooseGreedyCard(manager.state!.run, config)!;
    manager.state!.run = {
      ...manager.state!.run,
      battle: { ...manager.state!.run.battle!, powerCards: [{ cardId: card, type: 'GUARD' }] },
    };
    const armor = manager.state!.run.player.armor;
    manager.play(card);
    const awarded = manager.state!.run.player.armor - armor;
    expect([1, 5]).toContain(awarded);
    expect(manager.undo().success).toBe(true);
    expect(manager.state!.run.player.armor).toBe(armor);
    manager.play(card);
    expect(manager.state!.run.player.armor).toBe(armor + awarded);
  });
  it('ignores illegal plays without losing earlier history', () => {
    const { manager, ids } = createTraining();
    const before = structuredClone(manager.state!);
    manager.play(ids[0]);
    const accepted = manager.state;
    expect(manager.play('missing')!.state).toBe(accepted);
    const hpBefore = manager.state!.run.player.hp;
    expect(manager.undo().success).toBe(true);
    expect(manager.state!.run.player.hp).toBe(hpBefore - 1);
    const expected = { ...before, run: { ...before.run, player: { ...before.run.player, hp: manager.state!.run.player.hp } } };
    expect(manager.state).toEqual(expected);
  });
  it('restores the deck, discard and RNG before a reshuffle, minus undo HP cost', () => {
    const { manager } = createTraining();
    while (manager.state!.run.battle!.deck.length) manager.draw();
    const before = structuredClone(manager.state!);
    const drawn = manager.draw()!;
    expect(drawn.events).toContainEqual({ type: 'draw', recycled: true });
    expect(drawn.state.run.player.hp).toBe(before.run.player.hp - CASTLE_RECYCLE_HP_COST);
    const hpBeforeUndo = manager.state!.run.player.hp;
    expect(manager.undo().success).toBe(true);
    expect(manager.state!.run.player.hp).toBe(hpBeforeUndo - 1);
    const hpAfterUndo = manager.state!.run.player.hp;
    const expectedBefore = { ...before, run: { ...before.run, player: { ...before.run.player, hp: hpAfterUndo } } };
    expect(manager.state).toEqual(expectedBefore);
    const replayed = manager.draw()!;
    expect(replayed.state.run.battle).toEqual(drawn.state.run.battle);
    expect(replayed.state.run.rngState).toBe(drawn.state.run.rngState);
    expect(replayed.state.run.player.hp).toBe(hpAfterUndo - CASTLE_RECYCLE_HP_COST);
  });
  it('keeps history after reopening a saved siege', () => {
    const storage = memoryStorage();
    const manager = new CastleManager(storage);
    const training = createTraining();
    manager.state = training.manager.state;
    const initialHp = manager.state!.run.player.hp;
    const initial = structuredClone(manager.state!);
    manager.play(training.ids[0]);
    manager.play(training.ids[1]);
    manager.draw();
    manager.undo();
    const reopened = new CastleManager(storage);
    expect(reopened.resume()).toBe(true);
    expect(reopened.canUndo).toBe(true);
    expect(reopened.undo().success).toBe(true);
    expect(reopened.undo().success).toBe(true);
    const expectedHp = initialHp - 3;
    const expectedInitial = { ...initial, run: { ...initial.run, player: { ...initial.run.player, hp: expectedHp } } };
    expect(reopened.state).toEqual(expectedInitial);
    expect(reopened.undo().success).toBe(false);
    const saved = JSON.parse(storage.getItem('golf-castle-run-v1')!);
    expect(saved.undoHistory.entries).toHaveLength(0);
  });
  it('loads older saves without history and records subsequent moves', () => {
    const storage = memoryStorage();
    const manager = new CastleManager(storage);
    const initial = createTraining().manager.state!;
    manager.service.save(initial);
    expect(manager.resume()).toBe(true);
    expect(manager.canUndo).toBe(false);
    manager.draw();
    const hpBeforeUndo = manager.state!.run.player.hp;
    expect(manager.undo().success).toBe(true);
    expect(manager.state!.run.player.hp).toBe(hpBeforeUndo - 1);
    const expectedInitial = { ...initial, run: { ...initial.run, player: { ...initial.run.player, hp: manager.state!.run.player.hp } } };
    expect(manager.state).toEqual(expectedInitial);
  });
  it('rejects damaged or cross-siege history without discarding the current board', () => {
    const storage = memoryStorage();
    const manager = new CastleManager(storage);
    manager.state = createTraining().manager.state;
    manager.draw();
    const saved = JSON.parse(storage.getItem('golf-castle-run-v1')!);
    saved.undoHistory.entries[0].state.id = 'another-siege';
    storage.setItem('golf-castle-run-v1', JSON.stringify(saved));
    const reopened = new CastleManager(storage);
    expect(reopened.resume()).toBe(true);
    expect(reopened.state!.run.battle).toEqual(manager.state!.run.battle);
    expect(reopened.canUndo).toBe(false);
  });
  it('clears history when starting another siege', () => {
    const { manager } = createTraining();
    manager.draw();
    expect(manager.canUndo).toBe(true);
    manager.start();
    expect(manager.canUndo).toBe(false);
    expect(manager.undo().success).toBe(false);
  });
});

describe('irreversible castle resources', () => {
  it('ignores removed jokers without altering the board or undo history', () => {
    const manager = prepare();
    manager.draw();
    const before = manager.state;
    manager.joker('black');
    expect(manager.state).toBe(before);
    expect(manager.state!.reserve).toEqual({ red: 0, black: 0 });
    expect(manager.canUndo).toBe(true);
  });
  it('records module purchases without losing history on a rejected purchase', () => {
    const manager = prepare();
    manager.play(chooseGreedyCard(manager.state!.run, config)!);
    manager.state!.progression = { xp: 8, level: 2, modules: [] };
    manager.state!.siege.coins = 10;
    manager.buyModule('volatileLaser');
    expect(manager.canUndo).toBe(true);
    manager.buyModule('fireArrows');
    expect(manager.state!.progression.modules).toContain('fireArrows');
    expect(manager.state!.siege.coins).toBe(4);
    expect(manager.canUndo).toBe(true);
    manager.draw();
    expect(manager.undo().success).toBe(true);
    expect(manager.state!.siege.coins).toBe(4);
    expect(manager.state!.progression.modules).toContain('fireArrows');
    expect(manager.undo().success).toBe(true);
    expect(manager.state!.siege.coins).toBe(10);
    expect(manager.state!.progression.modules).not.toContain('fireArrows');
  });
  it('retains undo through enemy kills and rolls back loot to prevent duplication', () => {
    const storage = memoryStorage();
    const manager = new CastleManager(storage);
    manager.state = createCastleRun('committed-loot', config, emptyUpgrades());
    manager.state!.siege.enemies = [
      {
        id: 91,
        sprite: 'c_orc',
        boss: false,
        hp: 1,
        maxHp: 1,
        progress: 0.7,
        speed: 0,
        damage: 1,
        cooldown: 10,
      },
    ];
    manager.state!.siege.units = [
      {
        id: 90,
        kind: 'archer',
        damage: 2,
        heal: 0,
        cooldown: 0,
        ttl: 20,
        ammo: 100,
        engaged: false,
        hp: 1,
        maxHp: 1,
        progress: 0.94,
      },
    ];
    const before = structuredClone(manager.state!);
    manager.draw();
    const result = manager.step()!;
    expect(result.events.some((event) => event.type === 'killed')).toBe(true);
    expect(manager.state!.siege.coins).toBeGreaterThan(0);
    expect(manager.canUndo).toBe(true);
    const reopened = new CastleManager(storage);
    expect(reopened.resume()).toBe(true);
    expect(reopened.state!.siege.coins).toBe(manager.state!.siege.coins);
    expect(reopened.state!.siege.enemies.some((enemy) => enemy.id === 91)).toBe(false);
    expect(reopened.canUndo).toBe(true);
    const earned = structuredClone(reopened.state!);
    const hpBeforeUndo = reopened.state!.run.player.hp;
    expect(reopened.undo().success).toBe(true);
    expect(reopened.state!.run.player.hp).toBe(hpBeforeUndo - 1);
    const expectedBefore = { ...before, run: { ...before.run, player: { ...before.run.player, hp: reopened.state!.run.player.hp } } };
    expect(reopened.state).toEqual(expectedBefore);
    reopened.draw();
    reopened.step();
    expect(reopened.state!.siege.coins).toBe(earned.siege.coins);
    expect(reopened.state!.siege.kills).toBe(earned.siege.kills);
    expect(reopened.state!.progression).toEqual(earned.progression);
  });
  it('keeps legacy wallet records but starts new sieges with base gear', () => {
    const storage = memoryStorage();
    const manager = new CastleManager(storage);
    const previous = createCastleRun('old-wallet', config, emptyUpgrades());
    previous.siege.coins = 100;
    previous.run = { ...previous.run, phase: 'victory' };
    manager.service.settle(previous);
    expect(manager.service.purchase('walls')).toBe(true);
    manager.start();
    expect(manager.state!.upgrades).toEqual(emptyUpgrades());
    expect(manager.state!.progression.level).toBe(1);
    expect(manager.service.readMeta().upgrades.walls).toBe(1);
  });
});

describe('resources across consecutive victorious rounds', () => {
  it('starts a playable fresh game when storage is unavailable', () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('Storage unavailable');
    };
    const manager = new CastleManager(storage);
    expect(manager.start()).toBe(true);
    expect(manager.state!.run.phase).toBe('battle');
    expect(manager.state!.siegeNumber).toBe(1);
    expect(manager.state!.siege.coins).toBe(0);
    expect(manager.state!.run.player).toMatchObject({ hp: 40, maxHp: 40, armor: 0 });
  });
  it('carries current coins, HP and armor across three rounds, including spending and reloading', () => {
    const storage = memoryStorage(),
      manager = new CastleManager(storage);
    expect(manager.start()).toBe(true);
    manager.state!.siege.coins = 150;
    manager.state!.run = {
      ...manager.state!.run,
      phase: 'victory',
      player: { ...manager.state!.run.player, hp: 20, armor: 5 },
    };
    manager.save();
    const first = structuredClone(manager.state!);
    // Starting the next round settles the victory, even if no popup settled it yet.
    expect(manager.start()).toBe(true);
    expect(manager.state!.siegeNumber).toBe(2);
    expect(manager.state!.siege.coins).toBe(150);
    expect(manager.state!.run.player).toMatchObject({ hp: 20, maxHp: 40, armor: 5 });
    expect(manager.state!.inheritedCoins).toBe(150);
    expect(manager.state!.abilitiesUsed).toEqual([]);
    expect(manager.undoDepth).toBe(0);
    expect(manager.service.readMeta().coins).toBe(150);
    manager.useAbility('HEAL');
    expect(manager.state!.siege.coins).toBe(120);
    expect(manager.state!.run.player.hp).toBe(28);
    manager.state!.siege.coins += 13;
    manager.state!.run = {
      ...manager.state!.run,
      phase: 'victory',
      player: { ...manager.state!.run.player, hp: 11, armor: 3 },
    };
    manager.state!.undoRemaining = 0;
    manager.save();
    const reopened = new CastleManager(storage);
    expect(reopened.resume()).toBe(true);
    expect(reopened.service.readMeta().continuation).toMatchObject({
      coins: 133,
      hp: 11,
      armor: 3,
    });
    expect(reopened.start()).toBe(true);
    expect(reopened.state!.siegeNumber).toBe(3);
    expect(reopened.state!.siege.coins).toBe(133);
    expect(reopened.state!.run.player).toMatchObject({ hp: 11, maxHp: 40, armor: 3 });
    expect(reopened.state!.inheritedCoins).toBe(133);
    expect(reopened.state!.abilitiesUsed).toEqual([]);
    expect(reopened.undoDepth).toBe(0);
    expect(reopened.service.readMeta().coins).toBe(150);
    // Reopening an earlier settled victory cannot create a new carryover.
    expect(reopened.service.settle(first)).toBe(true);
    expect(reopened.service.readMeta().continuation).toBeUndefined();
    expect(reopened.service.readMeta().currentStreak).toBe(3);
    reopened.save();
    const again = new CastleManager(storage);
    expect(again.resume()).toBe(true);
    expect(again.state!.siege.coins).toBe(133);
    expect(again.state!.inheritedCoins).toBe(133);
    expect(again.state!.run.player).toMatchObject({ hp: 11, armor: 3 });
  });
  it('resets combat resources after defeat while retaining records and the separate wallet', () => {
    const manager = new CastleManager(memoryStorage());
    manager.start();
    manager.state!.siege.coins = 100;
    manager.state!.run = {
      ...manager.state!.run,
      phase: 'victory',
      player: { ...manager.state!.run.player, hp: 19, armor: 8 },
    };
    manager.start();
    manager.state!.siege.coins = 115;
    manager.state!.run = {
      ...manager.state!.run,
      phase: 'defeat',
      player: { ...manager.state!.run.player, hp: 0, armor: 2 },
    };
    manager.start();
    expect(manager.state!.siegeNumber).toBe(1);
    expect(manager.state!.siege.coins).toBe(0);
    expect(manager.state!.run.player).toMatchObject({ hp: 40, maxHp: 40, armor: 0 });
    expect(manager.service.readMeta()).toMatchObject({ coins: 115, bestSiege: 2 });
    expect(manager.service.readMeta().continuation).toBeUndefined();
  });
  it('preserves the winning run when storage refuses atomic continuation consumption', () => {
    const storage = memoryStorage(),
      manager = new CastleManager(storage);
    manager.start();
    manager.state!.siege.coins = 67;
    manager.state!.run = {
      ...manager.state!.run,
      phase: 'victory',
      player: { ...manager.state!.run.player, hp: 12, armor: 4 },
    };
    manager.service.settle(manager.state!);
    manager.save();
    const before = manager.state;
    const setItem = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      if (key === 'golf-castle-meta-v1') throw new Error('Storage refused');
      setItem(key, value);
    };
    expect(manager.start()).toBe(false);
    expect(manager.state).toBe(before);
    expect(manager.service.readMeta().continuation).toMatchObject({ coins: 67, hp: 12, armor: 4 });
    storage.setItem = setItem;
    expect(manager.start()).toBe(true);
    expect(manager.state!.siegeNumber).toBe(2);
    expect(manager.state!.siege.coins).toBe(67);
    expect(manager.service.readMeta().continuation).toBeUndefined();
  });
});

describe('statistics across the complete run', () => {
  it('carries statistics across victories and reload, then starts at zero after defeat', () => {
    const storage = memoryStorage(),
      manager = new CastleManager(storage);
    manager.start();
    expect(manager.state!.runStats).toEqual({
      roundsWon: 0,
      enemiesDefeated: 0,
      bossesDefeated: 0,
      cardsPlayed: 0,
      seconds: 0,
      goldEarned: 0,
    });
    const firstStats = {
      roundsWon: 1,
      enemiesDefeated: 16,
      bossesDefeated: 1,
      cardsPlayed: 28,
      seconds: 65.25,
      goldEarned: 33,
    };
    manager.state!.runStats = { ...firstStats };
    manager.state!.run = { ...manager.state!.run, phase: 'victory' };
    manager.state!.siege.coins = 23;
    manager.save();
    manager.start();
    expect(manager.state!.siegeNumber).toBe(2);
    expect(manager.state!.runStats).toEqual(firstStats);
    const secondStats = {
      roundsWon: 2,
      enemiesDefeated: 35,
      bossesDefeated: 2,
      cardsPlayed: 56,
      seconds: 124.5,
      goldEarned: 70,
    };
    manager.state!.runStats = { ...secondStats };
    manager.state!.run = { ...manager.state!.run, phase: 'victory' };
    manager.save();
    const reopened = new CastleManager(storage);
    expect(reopened.resume()).toBe(true);
    expect(reopened.state!.runStats).toEqual(secondStats);
    reopened.start();
    expect(reopened.state!.siegeNumber).toBe(3);
    expect(reopened.state!.runStats).toEqual(secondStats);
    reopened.state!.run = {
      ...reopened.state!.run,
      phase: 'defeat',
      player: { ...reopened.state!.run.player, hp: 0 },
    };
    reopened.save();
    const lost = new CastleManager(storage);
    expect(lost.resume()).toBe(true);
    expect(lost.state!.runStats).toEqual(secondStats);
    lost.start();
    expect(lost.state!.siegeNumber).toBe(1);
    expect(lost.state!.runStats).toEqual({
      roundsWon: 0,
      enemiesDefeated: 0,
      bossesDefeated: 0,
      cardsPlayed: 0,
      seconds: 0,
      goldEarned: 0,
    });
  });
  it('recovers legacy winning statistics when an older continuation lacks its stats', () => {
    const storage = memoryStorage(),
      manager = new CastleManager(storage);
    manager.start();
    const winner = manager.state!;
    winner.run = { ...winner.run, phase: 'victory' };
    winner.siege.kills = 8;
    winner.siege.elapsed = 15.25;
    winner.siege.coins = 18;
    manager.save();
    const saved = JSON.parse(storage.getItem('golf-castle-run-v1')!);
    delete saved.runStats;
    storage.setItem('golf-castle-run-v1', JSON.stringify(saved));
    const meta = {
      ...manager.service.readMeta(),
      currentStreak: 1,
      claimed: [winner.id],
      continuation: {
        sourceSiege: winner.id,
        siegeNumber: 1,
        coins: 18,
        hp: 40,
        maxHp: 40,
        armor: 0,
      },
    };
    storage.setItem('golf-castle-meta-v1', JSON.stringify(meta));
    const reopened = new CastleManager(storage);
    expect(reopened.resume()).toBe(true);
    expect(reopened.start()).toBe(true);
    expect(reopened.state!.runStats).toEqual({
      roundsWon: 1,
      enemiesDefeated: 8,
      bossesDefeated: 0,
      cardsPlayed: 0,
      seconds: 15.25,
      goldEarned: 18,
    });
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
    storage.setItem('castle-interactive-training-v2', 'yes');
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
    expect(storage.getItem('castle-interactive-training-v2')).toBeNull();
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
    storage.setItem('castle-interactive-training-v2', 'yes');
    const removeItem = storage.removeItem.bind(storage);
    storage.removeItem = (key) => {
      if (key === 'castle-interactive-training-v2') throw new Error('Storage denied');
      removeItem(key);
    };
    expect(manager.resetProgress()).toBe(false);
    expect(manager.state).toBe(before);
    expect(storage.getItem('golf-castle-run-v1')).toBe(saved);
    expect(storage.getItem('castle-interactive-training-v2')).toBe('yes');
  });
});
