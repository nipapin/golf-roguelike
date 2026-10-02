import { describe, expect, it } from 'vitest';
import { config, memoryStorage } from '../test/fixtures';
import { getPlayableCards } from '../core/GameRules';
import { chooseGreedyCard } from '../core/Simulation';
import { CastleService } from './CastleService';
import {
  createCastleRun,
  emptyUpgrades,
  playCastleCard,
  drawCastleCard,
  nextCastleCard,
  stepSiege,
  type CastleRun,
  type Invader,
  SIEGE_PACING,
  siegeDifficulty,
} from './CastleDefense';
const start = (seed = 'castle-test') => createCastleRun(seed, config, emptyUpgrades());
const enemy = (boss = false, hp = 20): Invader => ({
  id: 100,
  sprite: 'c_orc',
  boss,
  hp,
  maxHp: hp,
  progress: 0.6,
  speed: 0.03,
  damage: 3,
  cooldown: 0,
});
const ids = (s: CastleRun) =>
  [
    ...s.run.battle!.tableau.flatMap((c) => c.cards),
    ...s.run.battle!.deck,
    ...s.run.battle!.discard,
    s.run.battle!.activeCard!,
  ]
    .map((c) => c.id)
    .sort();
function forcedChain(length: number) {
  let state = start();
  const pack = [
    ...state.run.battle!.tableau.flatMap((c) => c.cards),
    ...state.run.battle!.deck,
    state.run.battle!.activeCard!,
  ];
  const active = pack.find((c) => c.rank === 4 && c.suit === 'clubs')!;
  const chain = Array.from({ length }, (_, i) =>
    pack.find((c) => c.rank === i + 5 && c.suit === 'clubs')!
  );
  const rest = pack.filter((c) => c.id !== active.id && !chain.some((x) => x.id === c.id));
  state = {
    ...state,
    run: {
      ...state.run,
      battle: {
        ...state.run.battle!,
        activeCard: active,
        tableau: [
          { cards: chain.slice().reverse() },
          { cards: rest.splice(0, 3) },
          ...Array.from({ length: 5 }, () => ({ cards: [] })),
        ],
        deck: rest,
        discard: [],
        powerCards: [],
      },
    },
  };
  return { state, chain };
}
describe('castle siege', () => {
  it('waits for the first move and preserves all 54 physical cards', () => {
    const state = start();
    expect(stepSiege(state).state).toBe(state);
    let played = state;
    const original = ids(state);
    for (let i = 0; i < 80 && played.run.phase === 'battle'; i++) {
      const card = getPlayableCards(played.run.battle!)[0];
      played = card
        ? playCastleCard(played, card.id, config).state
        : drawCastleCard(played, config).state;
      expect(ids(played)).toEqual(original);
    }
  });
  it('rejects illegal and covered cards without granting a defender', () => {
    const state = start();
    const covered = state.run.battle!.tableau[0].cards[0];
    expect(playCastleCard(state, covered.id, config).state).toBe(state);
    expect(playCastleCard(state, 'missing', config).state).toBe(state);
  });
  it('banks all milestones until drawing, then deploys and fires the laser', () => {
    const fixture = forcedChain(5);
    let state = fixture.state;
    for (let i = 0; i < 4; i++) state = playCastleCard(state, fixture.chain[i].id, config).state;
    expect(state.siege.units).toHaveLength(0);
    state.siege.enemies = [enemy(false), { ...enemy(true, 150), id: 101 }];
    const played = playCastleCard(state, fixture.chain[4].id, config);
    expect(played.events.some((e) => e.type === 'deploy' || e.type === 'laser')).toBe(false);
    expect(played.state.siege.enemies).toHaveLength(2);
    const result = drawCastleCard(played.state, config);
    expect(result.state.siege.units.map((u) => u.kind)).toEqual([
      'soldier',
      'archer',
      'turret',
      'mortar',
    ]);
    expect(result.state.siege.units.find((u) => u.kind === 'turret')?.ammo).toBe(10);
    expect(drawCastleCard(result.state, config).state.siege.units).toHaveLength(4);
    expect(result.state.siege.enemies).toHaveLength(1);
    expect(result.state.siege.enemies[0].hp).toBe(110);
    expect(result.events.some((e) => e.type === 'laser')).toBe(true);
    expect(result.state.run.phase).toBe('battle');
  });
  it('marches a 1 HP / 1 damage soldier forward and loses it in melee', () => {
    const f = forcedChain(1);
    let state = drawCastleCard(playCastleCard(f.state, f.chain[0].id, config).state, config).state;
    state.siege.spawnIn = 1000;
    const soldier = state.siege.units[0];
    expect(soldier.hp).toBe(1);
    expect(soldier.damage).toBe(1);
    state = stepSiege(state).state;
    expect(state.siege.units[0].progress).toBeLessThan(soldier.progress);
    state.siege.enemies = [{ ...enemy(), progress: state.siege.units[0].progress }];
    const result = stepSiege(state);
    expect(result.state.siege.enemies[0].hp).toBe(19);
    expect(result.state.siege.units).toHaveLength(0);
    expect(result.events.some((e) => e.type === 'unit_killed')).toBe(true);
  });
  it('keeps archers stationary with 1 HP and 2 ranged damage', () => {
    const f = forcedChain(2);
    let state = f.state;
    for (const card of f.chain) state = playCastleCard(state, card.id, config).state;
    state = drawCastleCard(state, config).state;
    state.siege.units = state.siege.units.filter((u) => u.kind === 'archer');
    const archer = state.siege.units[0];
    expect(archer).toMatchObject({ hp: 1, maxHp: 1, damage: 2, progress: 0.94 });
    state.siege.spawnIn = 1000;
    state.siege.enemies = [{ ...enemy(false, 100), progress: 0.6, speed: 0 }];
    const result = stepSiege(state);
    expect(result.state.siege.units[0].progress).toBe(0.94);
    expect(result.events).toContainEqual({
      type: 'shot',
      kind: 'archer',
      unit: archer.id,
      target: 100,
      damage: 2,
    });
    result.state.siege.enemies[0].progress = 0.94;
    result.state.siege.enemies[0].cooldown = 0;
    expect(
      stepSiege(result.state).events.some(
        (e) => e.type === 'unit_killed' && e.unit.kind === 'archer'
      )
    ).toBe(true);
  });
  it('exhausts the base turret after ten shots and retains the empty cannon', () => {
    const f = forcedChain(3);
    let state = f.state;
    for (const card of f.chain) state = playCastleCard(state, card.id, config).state;
    state = drawCastleCard(state, config).state;
    state.siege.units = state.siege.units.filter((u) => u.kind === 'turret');
    state.siege.spawnIn = 1000;
    state.siege.enemies = [{ ...enemy(false, 100), progress: 0.5, speed: 0 }];
    let shots = 0;
    for (let i = 0; i < 20; i++) {
      const result = stepSiege(state);
      shots += result.events.filter((e) => e.type === 'shot').length;
      state = result.state;
    }
    expect(shots).toBe(10);
    expect(state.siege.units[0].ammo).toBe(0);
    expect(state.siege.enemies[0].hp).toBe(80);
  });
  it('applies 40 laser damage to regular enemies instead of deleting them', () => {
    const f = forcedChain(5);
    let state = f.state;
    for (const card of f.chain) state = playCastleCard(state, card.id, config).state;
    state.siege.enemies = [enemy(false, 90), { ...enemy(true, 150), id: 101 }];
    const result = drawCastleCard(state, config);
    expect(result.state.siege.enemies.map((e) => e.hp)).toEqual([50, 110]);
    expect(result.events).toContainEqual({ type: 'laser', final: false, damage: 40 });
  });
  it('creates a dense stream of invaders in the first ten seconds', () => {
    let state = drawCastleCard(start(), config).state;
    for (let i = 0; i < 40; i++) state = stepSiege(state).state;
    expect(state.siege.enemies.length).toBeGreaterThanOrEqual(15);
  });
  it('lets a group enter the field before ranged weapons can fire', () => {
    const f = forcedChain(4);
    let state = f.state;
    for (const card of f.chain) state = playCastleCard(state, card.id, config).state;
    state = drawCastleCard(state, config).state;
    state.siege.spawnIn = 0;
    let result = stepSiege(state);
    expect(result.events.filter((e) => e.type === 'spawn')).toHaveLength(3);
    expect(result.events.filter((e) => e.type === 'shot')).toHaveLength(0);
    expect(result.state.siege.enemies).toHaveLength(3);
    state = result.state;
    state.siege.spawnIn = 1000;
    state.siege.enemies = [{ ...enemy(), progress: 0.41 }];
    result = stepSiege(state);
    expect(result.events.some((e) => e.type === 'shot' && e.kind === 'turret')).toBe(true);
  });
  it('keeps an approaching horde visible even when a turret is already deployed', () => {
    const f = forcedChain(3);
    let state = f.state;
    for (const card of f.chain) state = playCastleCard(state, card.id, config).state;
    state = drawCastleCard(state, config).state;
    for (let i = 0; i < 40; i++) state = stepSiege(state).state;
    expect(state.siege.enemies.length).toBeGreaterThanOrEqual(10);
    expect(state.siege.enemies.some((e) => e.progress > 0.2)).toBe(true);
  });
  it('grows groups and HP over time and never exceeds the saveable enemy cap', () => {
    const state = start();
    state.siege.started = true;
    state.siege.elapsed = 60;
    state.siege.spawnIn = 0;
    const group = stepSiege(state).state.siege.enemies;
    expect(group).toHaveLength(5);
    expect(group.every((e) => e.maxHp === 10)).toBe(true);
    state.siege.enemies = Array.from({ length: 47 }, (_, i) => ({
      ...enemy(),
      id: i + 200,
      progress: 0,
    }));
    const result = stepSiege(state);
    expect(result.state.siege.enemies).toHaveLength(SIEGE_PACING.maxEnemies);
    expect(result.events.filter((e) => e.type === 'spawn')).toHaveLength(1);
  });
  it('an undefended horde reaches and destroys the castle', () => {
    let state = drawCastleCard(start(), config).state;
    for (let i = 0; i < 240 && state.run.phase === 'battle'; i++) state = stepSiege(state).state;
    expect(state.run.phase).toBe('defeat');
    expect(state.siege.elapsed).toBeLessThan(60);
  });
  it('deploys the reached tiers only after drawing at lengths one through four', () => {
    for (let length = 1; length <= 4; length++) {
      const f = forcedChain(length);
      let state = f.state;
      for (const card of f.chain) {
        const result = playCastleCard(state, card.id, config);
        expect(result.events.some((e) => e.type === 'deploy')).toBe(false);
        state = result.state;
      }
      expect(state.siege.units).toHaveLength(0);
      const result = drawCastleCard(state, config);
      expect(result.state.siege.units.map((u) => u.kind)).toEqual(
        ['soldier', 'archer', 'turret', 'mortar'].slice(0, length)
      );
    }
  });
  it('upgrades soldier squad size without increasing individual HP or damage', () => {
    const f = forcedChain(1);
    f.state.upgrades.soldier = 3;
    const state = drawCastleCard(
      playCastleCard(f.state, f.chain[0].id, config).state,
      config
    ).state;
    expect(state.siege.units).toHaveLength(4);
    expect(state.siege.units.every((u) => u.hp === 1 && u.damage === 1)).toBe(true);
  });
  it('keeps exactly one empty turret and reloads that same cannon to the upgraded capacity', () => {
    const f = forcedChain(3);
    f.state.upgrades.magazine = 3;
    let state = f.state;
    for (const card of f.chain) state = playCastleCard(state, card.id, config).state;
    state = drawCastleCard(state, config).state;
    const id = state.siege.units.find((u) => u.kind === 'turret')!.id;
    state.siege.units = state.siege.units.filter((u) => u.kind === 'turret');
    state.siege.units[0].ammo = 0;
    state.siege.units[0].ttl = 0;
    state.siege.spawnIn = 1000;
    state = stepSiege(state).state;
    expect(state.siege.units).toHaveLength(1);
    const next = forcedChain(3);
    next.state.siege = state.siege;
    next.state.upgrades.magazine = 3;
    state = next.state;
    for (const card of next.chain) state = playCastleCard(state, card.id, config).state;
    expect(state.siege.units[0].ammo).toBe(0);
    const result = drawCastleCard(state, config);
    const turrets = result.state.siege.units.filter((u) => u.kind === 'turret');
    expect(turrets).toHaveLength(1);
    expect(turrets[0]).toMatchObject({ id, ammo: 25 });
    expect(result.events).toContainEqual({ type: 'reload', id, ammo: 25 });
  });
  it('increases health, speed and wave pressure between new sieges', () => {
    const first = createCastleRun('pressure', config, emptyUpgrades(), 'first', 1);
    const later = createCastleRun('pressure', config, emptyUpgrades(), 'later', 8);
    for (const state of [first, later]) {
      state.siege.started = true;
      state.siege.spawnIn = 0;
    }
    const a = stepSiege(first).state,
      b = stepSiege(later).state;
    expect(b.siege.enemies[0].maxHp).toBeGreaterThan(a.siege.enemies[0].maxHp);
    expect(b.siege.enemies[0].speed).toBeGreaterThan(a.siege.enemies[0].speed);
    expect(b.siege.spawnIn).toBeLessThan(a.siege.spawnIn);
    expect(siegeDifficulty(1).hp).toBe(1);
  });
  it('spawns a supermonster after every twenty regular invaders', () => {
    const state = start();
    state.siege.started = true;
    state.siege.spawned = 20;
    state.siege.spawnIn = 0;
    const result = stepSiege(state);
    expect(result.state.siege.enemies[0].boss).toBe(true);
    expect(result.state.siege.enemies[0].maxHp).toBeGreaterThan(80);
  });
  it('enemy contact damages castle armor first, then causes defeat', () => {
    let state = start();
    state.siege.started = true;
    state.siege.enemies = [{ ...enemy(), progress: 0.94, damage: 9 }];
    state.run = { ...state.run, player: { ...state.run.player, armor: 4, hp: 5 } };
    state = stepSiege(state).state;
    expect(state.run.player.armor).toBe(0);
    expect(state.run.player.hp).toBe(0);
    expect(state.run.phase).toBe('defeat');
  });
  it('exhausted stock releases the banked chain once without recycling cards', () => {
    let state = start();
    state = {
      ...state,
      run: {
        ...state.run,
        battle: {
          ...state.run.battle!,
          deck: [],
          discard: state.run.battle!.deck,
          chain: [state.run.battle!.tableau[0].cards[0]],
        },
      },
    };
    const original = ids(state),
      board = state.run.battle!.tableau;
    const result = drawCastleCard(state, config);
    expect(result.state.run.battle!.chain).toHaveLength(0);
    expect(result.state.run.battle!.tableau).toEqual(board);
    expect(ids(result.state)).toEqual(original);
    expect(result.state.run.battle!.deck).toHaveLength(0);
    expect(result.events.some((e) => e.type === 'draw' && e.recycled)).toBe(false);
    expect(
      drawCastleCard(result.state, config).events.filter((e) => e.type === 'deploy')
    ).toHaveLength(0);
  });

  it('ECHO unlocks two extra defense links without copying cards or farming deployments', () => {
    const fixture = forcedChain(1);
    const card = fixture.chain[0];
    fixture.state.run = {
      ...fixture.state.run,
      battle: { ...fixture.state.run.battle!, powerCards: [{ cardId: card.id, type: 'ECHO' }] },
    };
    const played = playCastleCard(fixture.state, card.id, config);
    expect(played.state.run.battle!.chain).toHaveLength(1);
    expect(played.events.some((e) => e.type === 'card' && e.chain === 3)).toBe(true);
    const drawn = drawCastleCard(played.state, config);
    expect(
      drawn.events.filter((e) => e.type === 'deploy').map((e) => e.type === 'deploy' && e.kind)
    ).toEqual(['soldier', 'archer', 'turret']);
    expect(drawCastleCard(drawn.state, config).events.some((e) => e.type === 'deploy')).toBe(false);
  });
  it('deterministically resumes a siege including movement, shots and RNG', () => {
    let state = drawCastleCard(start(), config).state;
    for (let i = 0; i < 40; i++) state = stepSiege(state).state;
    const restored = JSON.parse(JSON.stringify(state)) as CastleRun;
    expect(stepSiege(restored)).toEqual(stepSiege(state));
    expect(state.siege.elapsed).toBe(10); // stepping never mutates the input
  });
});
describe('persistent castle upgrades', () => {
  it('banks a terminal run once across reloads, includes diamond coins, and spends atomically', () => {
    const storage = memoryStorage(),
      service = new CastleService(storage);
    const state = start();
    state.siege.coins = 11;
    state.run = { ...state.run, phase: 'victory', player: { ...state.run.player, gold: 4 } };
    expect(service.settle(state)).toBe(true);
    expect(new CastleService(storage).settle(state)).toBe(true);
    expect(service.readMeta().coins).toBe(25);
    expect(service.readMeta().victories).toBe(1);
    expect(service.purchase('magazine')).toBe(true);
    expect(service.readMeta().coins).toBe(15);
    expect(service.purchase('magazine')).toBe(false);
    expect(service.readMeta().coins).toBe(15);
    expect(service.readMeta().upgrades.magazine).toBe(1);
  });
  it('validates saved armies and roundtrips the complete board', () => {
    const storage = memoryStorage(),
      service = new CastleService(storage),
      f = forcedChain(1);
    const state = playCastleCard(f.state, f.chain[0].id, config).state;
    service.save(state);
    expect(service.load()).toEqual(state);
    storage.setItem(
      'golf-castle-run-v1',
      JSON.stringify({
        ...state,
        siege: { ...state.siege, enemies: [{ ...enemy(), progress: 12 }] },
      })
    );
    expect(service.load()).toBeNull();
  });
  it('migrates legacy stationary troops without losing the solitaire', () => {
    const storage = memoryStorage(),
      service = new CastleService(storage),
      f = forcedChain(1);
    const state = drawCastleCard(
      playCastleCard(f.state, f.chain[0].id, config).state,
      config
    ).state;
    const old = JSON.parse(JSON.stringify(state));
    delete old.siege.units[0].hp;
    delete old.siege.units[0].maxHp;
    delete old.siege.units[0].progress;
    old.siege.units[0].damage = 3;
    storage.setItem('golf-castle-run-v1', JSON.stringify(old));
    const restored = service.load()!;
    expect(restored.run).toEqual(state.run);
    expect(restored.siege.units[0]).toMatchObject({ hp: 1, maxHp: 1, damage: 1, progress: 0.94 });
  });
  it('persists the new-siege count and preserves difficulty when reopening a save', () => {
    const storage = memoryStorage(),
      service = new CastleService(storage);
    expect(service.beginSiege().siegesStarted).toBe(1);
    expect(new CastleService(storage).beginSiege().siegesStarted).toBe(2);
    const state = createCastleRun('saved-pressure', config, emptyUpgrades(), 'save', 2);
    service.save(state);
    expect(service.load()?.siegeNumber).toBe(2);
    expect(service.readMeta().siegesStarted).toBe(2);
  });
  it('merges old duplicate turrets without adding their ammunition', () => {
    const storage = memoryStorage(),
      service = new CastleService(storage),
      f = forcedChain(3);
    let state = f.state;
    for (const card of f.chain) state = playCastleCard(state, card.id, config).state;
    state = drawCastleCard(state, config).state;
    const turret = state.siege.units.find((u) => u.kind === 'turret')!;
    state.siege.units.push({ ...turret, id: 90, ammo: 30 });
    turret.ammo = 45;
    service.save(state);
    const restored = service.load()!;
    expect(restored.siege.units.filter((u) => u.kind === 'turret')).toHaveLength(1);
    expect(restored.siege.units.find((u) => u.kind === 'turret')!.ammo).toBe(45);
  });
  it('converts saved knights and old turret ammunition without resetting progress', () => {
    const storage = memoryStorage(),
      service = new CastleService(storage),
      f = forcedChain(3);
    let state = f.state;
    for (const card of f.chain) state = playCastleCard(state, card.id, config).state;
    state = drawCastleCard(state, config).state;
    const legacy = JSON.parse(JSON.stringify(state));
    delete legacy.balanceVersion;
    const archer = legacy.siege.units.find((u: { kind: string }) => u.kind === 'archer');
    Object.assign(archer, { kind: 'knight', hp: 6, maxHp: 6, damage: 6, progress: 0.5 });
    legacy.siege.units.find((u: { kind: string }) => u.kind === 'turret').ammo = 100;
    storage.setItem('golf-castle-run-v1', JSON.stringify(legacy));
    const restored = service.load()!;
    expect(restored.run.battle).toEqual(state.run.battle);
    expect(restored.siege.units.find((u) => u.kind === 'archer')).toMatchObject({
      hp: 1,
      damage: 2,
      progress: 0.94,
    });
    expect(restored.siege.units.find((u) => u.kind === 'turret')!.ammo).toBe(10);
    service.save(restored);
    expect(service.load()).toEqual(restored);
  });
  it('permanent levels apply at the next siege and leave existing snapshots unchanged', () => {
    const upgrades = { ...emptyUpgrades(), walls: 2, magazine: 3 };
    const state = createCastleRun('upgrades', config, upgrades);
    upgrades.walls = 10;
    expect(state.run.player.maxHp).toBe(46);
    expect(state.upgrades.walls).toBe(2);
    const f = forcedChain(3);
    f.state.upgrades.magazine = 3;
    let next = f.state;
    for (const card of f.chain) next = playCastleCard(next, card.id, config).state;
    next = drawCastleCard(next, config).state;
    expect(next.siege.units.find((u) => u.kind === 'turret')?.ammo).toBe(25);
  });
});
describe('siege progression balance', () => {
  it('gives workshop levels a measurable advantage against later siege pressure', () => {
    const wins = [0, 0, 0];
    for (let seed = 0; seed < 20; seed++)
      for (let sample = 0; sample < 3; sample++) {
        const levels =
          sample === 2
            ? { walls: 5, soldier: 5, knight: 5, magazine: 5, mortar: 5, laser: 5 }
            : emptyUpgrades();
        let state = createCastleRun(
          `progression-${seed}`,
          config,
          levels,
          `sample-${seed}`,
          sample === 0 ? 1 : 8
        );
        for (let action = 0; action < 400 && state.run.phase === 'battle'; action++) {
          const id = chooseGreedyCard(state.run, config);
          state = id
            ? playCastleCard(state, id, config).state
            : drawCastleCard(state, config).state;
          for (let tick = 0; tick < 8 && state.run.phase === 'battle'; tick++)
            state = stepSiege(state).state;
        }
        if (state.run.phase === 'victory') wins[sample]++;
      }
    console.log(
      JSON.stringify({
        progressionSamples: 20,
        actionSeconds: 2,
        firstSiege: wins[0],
        eighthSiege: wins[1],
        upgradedEighthSiege: wins[2],
      })
    );
    expect(wins[1]).toBeLessThan(wins[0]);
    expect(wins[2]).toBeGreaterThan(wins[1]);
  });
});
describe('deterministic castle balance sample', () => {
  it('allows a deliberate player to complete a useful proportion of runs without upgraded gear', () => {
    let wins = 0,
      totalCards = 0,
      bossRuns = 0;
    for (let seed = 0; seed < 40; seed++) {
      let state = start(`siege-balance-${seed}`),
        count = 0;
      for (let action = 0; action < 400 && state.run.phase === 'battle'; action++) {
        const id = chooseGreedyCard(state.run, config);
        if (id) {
          state = playCastleCard(state, id, config).state;
          count++;
        } else state = drawCastleCard(state, config).state;
        // One action per second, not a frame-perfect tapping bot.
        for (let step = 0; step < 4 && state.run.phase === 'battle'; step++)
          state = stepSiege(state).state;
      }
      if (state.run.phase === 'victory') wins++;
      if (state.siege.spawned >= SIEGE_PACING.bossEvery) bossRuns++;
      totalCards += count;
    }
    console.log(JSON.stringify({ seeds: 40, wins, averageCards: totalCards / 40, bossRuns }));
    let slowWins = 0,
      upgradedWins = 0;
    for (let seed = 0; seed < 40; seed++) {
      for (const upgraded of [false, true]) {
        const levels = upgraded
          ? { walls: 5, soldier: 5, knight: 5, magazine: 5, mortar: 5, laser: 5 }
          : emptyUpgrades();
        let state = createCastleRun(`siege-balance-${seed}`, config, levels);
        for (let action = 0; action < 400 && state.run.phase === 'battle'; action++) {
          const id = chooseGreedyCard(state.run, config);
          state = id
            ? playCastleCard(state, id, config).state
            : drawCastleCard(state, config).state;
          for (let step = 0; step < 12 && state.run.phase === 'battle'; step++)
            state = stepSiege(state).state;
        }
        if (state.run.phase === 'victory') {
          if (upgraded) upgradedWins++;
          else slowWins++;
        }
      }
    }
    console.log(JSON.stringify({ slowWins, upgradedWins, actionSeconds: 3 }));
    expect(upgradedWins).toBeGreaterThanOrEqual(slowWins);
    // Finite-stock experiment: a quick greedy policy should win 20–80% of seeds.
    expect(wins).toBeGreaterThanOrEqual(8);
    expect(wins).toBeLessThanOrEqual(32);
    expect(bossRuns).toBeGreaterThan(0);
    expect(totalCards / 40).toBeGreaterThan(20);
  });
});

describe('stock preview', () => {
  it('previews only remaining stock without advancing RNG', () => {
    const state = start();
    expect(drawCastleCard(state, config).state.run.battle!.activeCard).toEqual(
      nextCastleCard(state)
    );
    const recycled = {
      ...state,
      run: {
        ...state.run,
        battle: { ...state.run.battle!, deck: [], discard: state.run.battle!.deck },
      },
    };
    const rng = recycled.run.rngState;
    const card = nextCastleCard(recycled);
    expect(card).toBeUndefined();
    expect(nextCastleCard(recycled)).toBeUndefined();
    expect(recycled.run.rngState).toBe(rng);
    expect(drawCastleCard(recycled, config).state.run.battle!.activeCard).toEqual(
      recycled.run.battle!.activeCard
    );
  });
});
