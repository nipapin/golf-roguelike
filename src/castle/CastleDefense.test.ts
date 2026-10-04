import { describe, expect, it } from 'vitest';
import { config, memoryStorage } from '../test/fixtures';
import { getPlayableCards } from '../core/GameRules';
import { canConnectInBattle } from '../core/GameState';
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
  CASTLE_RECYCLE_HP_COST,
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
  state.progression = { xp: 56, level: 5, modules: [] };
  const pack = [
    ...state.run.battle!.tableau.flatMap((c) => c.cards),
    ...state.run.battle!.deck,
    state.run.battle!.activeCard!,
  ];
  const active = pack.find((c) => c.rank === 4 && c.suit === 'clubs')!;
  const chain: typeof pack = [];
  let rank = active.rank;
  let direction = 1;
  for (let i = 0; i < length; i++) {
    if (rank === 13 || rank === 1) direction *= -1;
    rank += direction;
    const matches = pack.filter((c) => c.rank === rank && c.id !== active.id && !chain.includes(c));
    const card = matches.find((c) => c.suit === 'clubs') ?? matches[0];
    if (!card) throw new Error(`No physical card left at rank ${rank}`);
    chain.push(card);
  }
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
function rankFixture(activeRank: number, targetRank: number, wild = false) {
  const state = start(),
    battle = state.run.battle!;
  const pack = [
    ...battle.tableau.flatMap((column) => column.cards),
    ...battle.deck,
    battle.activeCard!,
  ];
  const active = pack.find((card) => card.rank === activeRank && card.suit === 'clubs')!;
  const target = pack.find((card) => card.rank === targetRank && card.suit === 'hearts')!;
  state.run = {
    ...state.run,
    battle: {
      ...battle,
      activeCard: active,
      tableau: [{ cards: [target] }, ...Array.from({ length: 6 }, () => ({ cards: [] }))],
      deck: pack.filter((card) => card !== active && card !== target),
      discard: [],
      powerCards: [],
      wildActive: wild,
    },
  };
  return { state, target };
}

describe('castle linear rank sequence', () => {
  it.each([
    [1, 13],
    [13, 1],
  ])('rejects %i to %i without modifying the battle', (active, target) => {
    const fixture = rankFixture(active, target),
      before = structuredClone(fixture.state);
    expect(fixture.state.run.battle!.allowRankWrap).toBe(false);
    expect(canConnectInBattle(fixture.target, fixture.state.run.battle!)).toBe(false);
    expect(playCastleCard(fixture.state, fixture.target.id, config)).toEqual({
      state: fixture.state,
      events: [],
    });
    expect(fixture.state).toEqual(before);
    // Direct callers cannot re-enable the old rule through a stale save flag.
    fixture.state.run = {
      ...fixture.state.run,
      battle: { ...fixture.state.run.battle!, allowRankWrap: true },
    };
    expect(playCastleCard(fixture.state, fixture.target.id, config).state).toBe(fixture.state);
  });
  it.each([
    [12, 13],
    [13, 12],
    [1, 2],
    [2, 1],
  ])('accepts ordinary %i to %i', (active, target) => {
    const fixture = rankFixture(active, target);
    const result = playCastleCard(fixture.state, fixture.target.id, config);
    expect(result.state).not.toBe(fixture.state);
    expect(result.state.run.battle!.activeCard).toEqual(fixture.target);
    expect(result.state.run.battle!.chain).toHaveLength(1);
    expect(result.state.runStats!.cardsPlayed).toBe(1);
    expect(fixture.state.runStats!.cardsPlayed).toBe(0);
  });
  it.each([
    [1, 13],
    [13, 1],
  ])('permits WILD %i to %i and consumes its rank exception', (active, target) => {
    const fixture = rankFixture(active, target, true);
    const result = playCastleCard(fixture.state, fixture.target.id, config);
    expect(result.state.run.battle!.activeCard).toEqual(fixture.target);
    expect(result.state.run.battle!.wildActive).toBe(false);
    expect(result.state.run.battle!.allowRankWrap).toBe(false);
  });
  it('continues an empty-stock chain until the player explicitly clicks reshuffle', () => {
    const state = start(),
      battle = state.run.battle!;
    const pack = [
      ...battle.tableau.flatMap((column) => column.cards),
      ...battle.deck,
      battle.activeCard!,
    ];
    const take = (rank: number) =>
      pack.find((card) => card.rank === rank && card.suit === 'hearts')!;
    const active = take(5),
      first = take(6),
      second = take(7),
      spare = take(9);
    state.run = {
      ...state.run,
      battle: {
        ...battle,
        activeCard: active,
        deck: [],
        discard: pack.filter((card) => ![active, first, second, spare].includes(card)),
        tableau: [
          { cards: [second, first] },
          { cards: [spare] },
          ...Array.from({ length: 5 }, () => ({ cards: [] })),
        ],
        powerCards: [
          { cardId: first.id, type: 'GUARD' },
          { cardId: second.id, type: 'WILD' },
        ],
      },
    };
    state.siege.spawnIn = 1000;
    const original = ids(state),
      hp = state.run.player.hp;
    let played = playCastleCard(state, first.id, config).state;
    for (let i = 0; i < 8; i++) played = stepSiege(played).state;
    expect(played.run.player.hp).toBe(hp);
    expect(played.run.battle!.deck).toEqual([]);
    expect(played.run.battle!.chain).toHaveLength(1);
    expect(getPlayableCards(played.run.battle!).map((card) => card.id)).toContain(second.id);
    played = playCastleCard(played, second.id, config).state;
    expect(played.run.player.hp).toBe(hp);
    expect(played.run.battle!.wildActive).toBe(true);
    expect(played.run.battle!.chain).toHaveLength(2);
    expect(played.run.battle!.deck).toEqual([]);
    const shuffled = drawCastleCard(played, config);
    expect(shuffled.events).toContainEqual({ type: 'draw', recycled: true });
    expect(shuffled.state.run.player.hp).toBe(hp - CASTLE_RECYCLE_HP_COST);
    expect(shuffled.state.run.battle!.chain).toEqual([]);
    expect(shuffled.state.run.battle!.wildActive).toBe(false);
    expect(shuffled.state.run.battle!.powerCards).toEqual([]);
    expect(ids(shuffled.state)).toEqual(original);
  });
});

describe('castle siege', () => {
  it('deals five complete rows and 16 stock cards without jokers and with one WILD across 500 seeds', () => {
    for (let seed = 0; seed < 500; seed++) {
      const state = start(`stock-${seed}`);
      const battle = state.run.battle!;
      expect(battle.tableau).toHaveLength(7);
      expect(battle.tableau.flatMap((column) => column.cards)).toHaveLength(35);
      expect(battle.activeCard).toBeDefined();
      expect(battle.activeCard!.joker).toBeUndefined();
      expect(battle.tableau.every((column) => column.cards.length === 5)).toBe(true);
      expect(battle.deck).toHaveLength(16);
      expect(battle.powerCards).toHaveLength(3);
      expect(battle.powerCards.filter((power) => power.type === 'WILD')).toHaveLength(1);
      expect(battle.powerCards.filter((power) => power.type === 'GUARD')).toHaveLength(2);
      expect(
        battle.powerCards.every((power) =>
          battle.tableau.some((column) => column.cards.some((card) => card.id === power.cardId))
        )
      ).toBe(true);
      expect(ids(state)).toHaveLength(52);
      expect(new Set(ids(state)).size).toBe(52);
    }
  });
  it.each([1, 2, 8])(
    'spawns siege %i times five every exact five seconds, independently of castle XP',
    (number) => {
      let state = createCastleRun(`wave-${number}`, config, emptyUpgrades(), 'wave', number);
      expect(stepSiege(state).events).toHaveLength(0);
      state = drawCastleCard(state, config).state;
      const before = structuredClone(state);
      const times: number[] = [],
        sizes: number[] = [];
      for (let tick = 0; tick < 42; tick++) {
        const result = stepSiege(state);
        state = result.state;
        const spawned = result.events.filter((event) => event.type === 'spawn');
        if (spawned.length) {
          times.push(state.siege.elapsed);
          sizes.push(spawned.length);
        }
      }
      expect(times).toEqual([0.25, 5.25, 10.25]);
      expect(sizes).toEqual([number * 5, number * 5, number * 5]);
      expect(state.progression.level).toBe(1);
      expect(before.siege.elapsed).toBe(0);
      expect(before.siege.enemies).toHaveLength(0);
    }
  );
  it('retains the five-second schedule while the battlefield cap prevents a wave', () => {
    let state = drawCastleCard(start(), config).state;
    state.siege.enemies = Array.from({ length: SIEGE_PACING.maxEnemies }, (_, i) => ({
      ...enemy(),
      id: i + 500,
      progress: 0,
      speed: 0,
    }));
    const capped = stepSiege(state);
    expect(capped.events.filter((event) => event.type === 'spawn')).toHaveLength(0);
    expect(capped.state.siege.spawnIn).toBe(5);
    state = capped.state;
    state.siege.enemies = [];
    for (let tick = 0; tick < 19; tick++) {
      const next = stepSiege(state);
      expect(next.events.filter((event) => event.type === 'spawn')).toHaveLength(0);
      state = next.state;
    }
    expect(stepSiege(state).events.filter((event) => event.type === 'spawn')).toHaveLength(5);
  });
  it('waits for the first move and preserves all 52 physical cards', () => {
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
  it('marches a 3 HP / 2 damage soldier forward and loses it in melee', () => {
    const f = forcedChain(1);
    let state = drawCastleCard(playCastleCard(f.state, f.chain[0].id, config).state, config).state;
    state.siege.spawnIn = 1000;
    const soldier = state.siege.units[0];
    expect(soldier.hp).toBe(3);
    expect(soldier.damage).toBe(2);
    state = stepSiege(state).state;
    expect(state.siege.units[0].progress).toBeLessThan(soldier.progress);
    state.siege.enemies = [{ ...enemy(), progress: state.siege.units[0].progress }];
    const result = stepSiege(state);
    expect(result.state.siege.enemies[0].hp).toBe(18);
    expect(result.state.siege.units).toHaveLength(0);
    expect(result.events.some((e) => e.type === 'unit_killed')).toBe(true);
  });
  it('lets a soldier strike inside the same contact range that enables enemy melee', () => {
    const f = forcedChain(1);
    const state = drawCastleCard(playCastleCard(f.state, f.chain[0].id, config).state, config).state;
    state.siege.spawnIn = 1000;
    const soldier = state.siege.units[0];
    state.siege.enemies = [{ ...enemy(), progress: soldier.progress - 0.05, speed: 0 }];
    const result = stepSiege(state);
    expect(result.events).toContainEqual({
      type: 'shot',
      kind: 'soldier',
      unit: soldier.id,
      target: 100,
      damage: 2,
    });
    expect(result.events).toContainEqual({ type: 'melee', enemy: 100, unit: soldier.id });
    expect(
      result.events.some((event) => event.type === 'unit_killed' && event.unit.id === soldier.id)
    ).toBe(true);
    expect(result.state.siege.enemies[0].hp).toBe(18);
    expect(result.state.siege.units).toEqual([]);
  });
  it.each([
    [6, 2, 1, 10, 9, 40],
    [7, 2, 2, 10, 9, 40],
    [8, 2, 2, 20, 9, 40],
    [9, 2, 2, 20, 18, 40],
    [10, 2, 2, 20, 18, 80],
    [11, 3, 2, 20, 18, 80],
    [14, 3, 3, 30, 27, 80],
    [15, 3, 3, 30, 27, 120],
    [40, 8, 8, 80, 72, 320],
  ])(
    'releases the five-card cycle at chain %i',
    (length, soldiers, archers, ammo, cannonDamage, laserDamage) => {
      const fixture = forcedChain(length);
      let state = fixture.state;
      const originalCards = ids(state);
      for (const card of fixture.chain) {
        const played = playCastleCard(state, card.id, config);
        expect(
          played.events.some((event) => event.type === 'deploy' || event.type === 'laser')
        ).toBe(false);
        state = played.state;
      }
      expect(state.run.battle!.chain).toHaveLength(length);
      expect(state.siege.units).toHaveLength(0);
      state.siege.enemies = [enemy(true, 1000)];
      const before = structuredClone(state);
      const result = drawCastleCard(state, config);
      const units = result.state.siege.units;
      expect(units.filter((unit) => unit.kind === 'soldier')).toHaveLength(soldiers);
      expect(units.filter((unit) => unit.kind === 'archer')).toHaveLength(archers);
      expect(units.filter((unit) => unit.kind === 'turret')).toHaveLength(1);
      expect(units.find((unit) => unit.kind === 'turret')).toMatchObject({ ammo, damage: 2 });
      expect(units.filter((unit) => unit.kind === 'mortar')).toHaveLength(1);
      expect(units.find((unit) => unit.kind === 'mortar')).toMatchObject({
        ammo: 12,
        damage: cannonDamage,
      });
      expect(result.events.filter((event) => event.type === 'laser')).toEqual([
        { type: 'laser', final: false, damage: laserDamage },
      ]);
      expect(result.state.siege.enemies[0].hp).toBe(1000 - laserDamage);
      expect(result.state.run.battle!.chain).toHaveLength(0);
      expect(ids(result.state)).toEqual(originalCards);
      expect(state).toEqual(before);
      const secondDraw = drawCastleCard(result.state, config);
      expect(
        secondDraw.events.some((event) => ['deploy', 'reload', 'laser'].includes(event.type))
      ).toBe(false);
      expect(secondDraw.state.siege.units).toEqual(units);
    }
  );
  it('ignores retired joker multipliers while applying existing workshop values', () => {
    const fixture = forcedChain(10);
    let state = fixture.state;
    state.upgrades = {
      ...emptyUpgrades(),
      soldier: 2,
      knight: 2,
      magazine: 2,
      mortar: 2,
      laser: 3,
    };
    for (const card of fixture.chain) state = playCastleCard(state, card.id, config).state;
    state.run = {
      ...state.run,
      battle: { ...state.run.battle!, jokerMultiplier: 5, lifestealMultiplier: 5 },
      player: { ...state.run.player, hp: 1 },
    };
    state.siege.enemies = [enemy(true, 1000)];
    const result = drawCastleCard(state, config);
    const units = result.state.siege.units;
    expect(units.filter((unit) => unit.kind === 'soldier')).toHaveLength(6);
    expect(
      units
        .filter((unit) => unit.kind === 'soldier')
        .every((unit) => unit.damage === 2 && unit.hp === 3)
    ).toBe(true);
    expect(units.filter((unit) => unit.kind === 'archer')).toHaveLength(2);
    expect(units.find((unit) => unit.kind === 'archer')?.damage).toBe(4);
    expect(units.find((unit) => unit.kind === 'turret')).toMatchObject({ ammo: 40, damage: 2 });
    expect(units.find((unit) => unit.kind === 'mortar')).toMatchObject({ ammo: 12, damage: 26 });
    expect(result.events.filter((event) => event.type === 'laser')).toEqual([
      { type: 'laser', final: false, damage: 140 },
    ]);
    expect(result.state.siege.enemies[0].hp).toBe(860);
    expect(result.state.run.player.hp).toBe(1);
  });
  it('loads both magazines into the existing turret and fires all twenty rounds', () => {
    const initial = forcedChain(3);
    let state = initial.state;
    for (const card of initial.chain) state = playCastleCard(state, card.id, config).state;
    state = drawCastleCard(state, config).state;
    const turret = state.siege.units.find((unit) => unit.kind === 'turret')!;
    turret.ammo = 0;
    const fixture = forcedChain(8);
    fixture.state.siege.units = [turret];
    fixture.state.siege.nextId = state.siege.nextId;
    state = fixture.state;
    for (const card of fixture.chain) state = playCastleCard(state, card.id, config).state;
    const release = drawCastleCard(state, config);
    expect(release.events).toContainEqual({ type: 'reload', id: turret.id, ammo: 20 });
    state = release.state;
    state.siege.units = state.siege.units.filter((unit) => unit.kind === 'turret');
    expect(state.siege.units).toHaveLength(1);
    expect(state.siege.units[0].id).toBe(turret.id);
    state.siege.spawnIn = 1000;
    state.siege.enemies = [{ ...enemy(false, 100), progress: 0.5, speed: 0 }];
    let shots = 0;
    for (let tick = 0; tick < 30; tick++) {
      const result = stepSiege(state);
      shots += result.events.filter((event) => event.type === 'shot').length;
      state = result.state;
    }
    expect(shots).toBe(20);
    expect(state.siege.units[0].ammo).toBe(0);
    expect(state.siege.enemies[0].hp).toBe(60);
  });
  it('ignores removed CRIT bonuses when long chains fill the army cap', () => {
    const fixture = forcedChain(16);
    let state = fixture.state;
    state.run = {
      ...state.run,
      battle: { ...state.run.battle!, powerCards: [{ cardId: fixture.chain[0].id, type: 'CRIT' }] },
    };
    state.upgrades.soldier = 10;
    for (const card of fixture.chain) state = playCastleCard(state, card.id, config).state;
    state.run = {
      ...state.run,
      battle: {
        ...state.run.battle!,
        powerCards: [{ cardId: fixture.chain[0].id, type: 'CRIT' }],
      },
    };
    const result = drawCastleCard(state, config);
    expect(result.state.siege.units).toHaveLength(32);
    for (const unit of result.state.siege.units) {
      const base =
        unit.kind === 'soldier' ? 2 : unit.kind === 'turret' ? 2 : unit.kind === 'archer' ? 2 : 27;
      expect(unit.damage).toBe(base);
    }
  });
  it('persists stacked ammunition and cannon damage across a reload', () => {
    const fixture = forcedChain(10);
    let state = fixture.state;
    for (const card of fixture.chain) state = playCastleCard(state, card.id, config).state;
    state = drawCastleCard(state, config).state;
    const storage = memoryStorage();
    new CastleService(storage).save(state);
    const restored = new CastleService(storage).load()!;
    expect(restored).toEqual(state);
    expect(restored.siege.units.find((unit) => unit.kind === 'turret')?.ammo).toBe(20);
    expect(restored.siege.units.find((unit) => unit.kind === 'mortar')?.damage).toBe(18);
    expect(stepSiege(restored)).toEqual(stepSiege(state));
  });
  it('keeps archers stationary with 2 HP and 2 ranged damage', () => {
    const f = forcedChain(2);
    let state = f.state;
    for (const card of f.chain) state = playCastleCard(state, card.id, config).state;
    state = drawCastleCard(state, config).state;
    state.siege.units = state.siege.units.filter((u) => u.kind === 'archer');
    const archer = state.siege.units[0];
    expect(archer).toMatchObject({ hp: 2, maxHp: 2, damage: 2, progress: 0.94 });
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
    ).toBe(false); // Wall-mounted archers cannot be reached in melee.
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
  it('gives the first siege five enemies immediately and another five after five seconds', () => {
    let state = drawCastleCard(start(), config).state;
    for (let i = 0; i < 40; i++) state = stepSiege(state).state;
    expect(state.siege.enemies.length).toBe(10);
    expect(state.siege.enemies.some((enemy) => enemy.boss)).toBe(false);
  });
  it('spawns through random positions in the first half while cannons wait for range', () => {
    const f = forcedChain(4);
    let state = f.state;
    for (const card of f.chain) state = playCastleCard(state, card.id, config).state;
    state = drawCastleCard(state, config).state;
    state.siege.spawnIn = 0;
    let result = stepSiege(state);
    expect(result.events.filter((e) => e.type === 'spawn')).toHaveLength(5);
    const spawned = result.events.filter((event) => event.type === 'spawn');
    expect(
      spawned.every(
        (event) => event.enemy.progress * 0.78 >= 0.1 && event.enemy.progress * 0.78 <= 0.5
      )
    ).toBe(true);
    expect(new Set(spawned.map((event) => event.enemy.progress)).size).toBeGreaterThan(1);
    expect(
      result.events.filter((event) => event.type === 'shot' && event.kind === 'mortar')
    ).toHaveLength(0);
    expect(result.state.siege.enemies).toHaveLength(5);
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
    expect(state.siege.enemies.length).toBeGreaterThanOrEqual(2);
    expect(state.siege.enemies.some((e) => e.progress > 0.2)).toBe(true);
  });
  it('keeps group size fixed, grows HP over time and never exceeds the saveable enemy cap', () => {
    const state = start();
    state.siege.started = true;
    state.siege.elapsed = 60;
    state.siege.spawnIn = 0;
    const group = stepSiege(state).state.siege.enemies;
    expect(group).toHaveLength(5);
    expect(group.every((e) => e.maxHp === 10)).toBe(true);
    state.siege.enemies = Array.from({ length: SIEGE_PACING.maxEnemies - 1 }, (_, i) => ({
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
    expect(state.siege.units.every((u) => u.hp === 3 && u.damage === 2)).toBe(true);
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
    expect(b.siege.spawnIn).toBe(SIEGE_PACING.interval);
    expect(a.siege.enemies).toHaveLength(5);
    expect(b.siege.enemies).toHaveLength(40);
    expect(siegeDifficulty(1).hp).toBe(1);
  });
  it('spawns every twentieth invader as a boss even at level one in the opening', () => {
    const state = start();
    state.siege.started = true;
    state.siege.spawned = 19;
    state.siege.spawnIn = 0;
    const result = stepSiege(state);
    expect(result.state.siege.enemies[0].boss).toBe(true);
    expect(result.state.siege.enemies[0].maxHp).toBeGreaterThan(80);
    expect(result.state.siege.enemies.slice(1).every((enemy) => !enemy.boss)).toBe(true);
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
  it('boss attacks bypass armor while preserving its shield for ordinary enemies', () => {
    const state = start();
    state.siege.started = true;
    state.siege.spawnIn = 1000;
    state.siege.enemies = [{ ...enemy(true, 100), progress: 0.94, speed: 0, damage: 9 }];
    state.run = { ...state.run, player: { ...state.run.player, armor: 12, hp: 20 } };
    const result = stepSiege(state);
    expect(result.state.run.player).toMatchObject({ hp: 11, armor: 12 });
    expect(result.events).toContainEqual({ type: 'castle_hit', damage: 9, enemy: 100 });
    expect(state.run.player).toMatchObject({ hp: 20, armor: 12 });
  });
  it('stock recycle keeps the tableau and resets the chain even with playable moves', () => {
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
  it('banks a terminal run once across reloads, excludes card and completion gold, and spends atomically', () => {
    const storage = memoryStorage(),
      service = new CastleService(storage);
    const state = start();
    state.siege.coins = 11;
    state.run = { ...state.run, phase: 'victory', player: { ...state.run.player, gold: 4 } };
    expect(service.settle(state)).toBe(true);
    expect(new CastleService(storage).settle(state)).toBe(true);
    expect(service.readMeta().coins).toBe(11);
    expect(service.readMeta().victories).toBe(1);
    expect(service.purchase('magazine')).toBe(true);
    expect(service.readMeta().coins).toBe(1);
    expect(service.purchase('magazine')).toBe(false);
    expect(service.readMeta().coins).toBe(1);
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
    old.balanceVersion = 2;
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
    expect(state.run.player.maxHp).toBe(56);
    expect(state.upgrades.walls).toBe(2);
    const f = forcedChain(3);
    f.state.upgrades.magazine = 3;
    let next = f.state;
    for (const card of f.chain) next = playCastleCard(next, card.id, config).state;
    next = drawCastleCard(next, config).state;
    expect(next.siege.units.find((u) => u.kind === 'turret')?.ammo).toBe(25);
  });
});
describe('round pressure without castle leveling', () => {
  it('raises later round pressure while every chain reward remains available from the start', () => {
    const first = createCastleRun('round-pressure', config, emptyUpgrades(), 'first', 1);
    const later = createCastleRun('round-pressure', config, emptyUpgrades(), 'later', 8);
    for (const state of [first, later]) {
      const active = state.run.battle!.activeCard!;
      state.run = {
        ...state.run,
        battle: { ...state.run.battle!, chain: Array.from({ length: 5 }, () => active) },
      };
    }
    const a = drawCastleCard(first, config),
      b = drawCastleCard(later, config);
    expect(a.state.siege.units.map((unit) => unit.kind)).toEqual([
      'soldier',
      'archer',
      'turret',
      'mortar',
    ]);
    expect(b.state.siege.units.map((unit) => unit.kind)).toEqual(
      a.state.siege.units.map((unit) => unit.kind)
    );
    expect(a.events.some((event) => event.type === 'laser')).toBe(true);
    expect(b.events.some((event) => event.type === 'laser')).toBe(true);
    a.state.siege.units = [];
    b.state.siege.units = [];
    const firstWave = stepSiege(a.state).state.siege.enemies;
    const laterWave = stepSiege(b.state).state.siege.enemies;
    expect(firstWave).toHaveLength(5);
    expect(laterWave).toHaveLength(40);
    expect(laterWave[0].maxHp).toBeGreaterThan(firstWave[0].maxHp);
    expect(laterWave[0].speed).toBeGreaterThan(firstWave[0].speed);
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
    expect(wins).toBeGreaterThanOrEqual(12);
    expect(bossRuns).toBeGreaterThan(0);
    expect(totalCards / 40).toBeGreaterThan(20);
  });
});

describe('stock preview', () => {
  it('charges five castle HP only when reshuffling, bypasses armor and does not mutate its input', () => {
    let state = start();
    const ordinary = drawCastleCard(state, config);
    expect(ordinary.state.run.player.hp).toBe(state.run.player.hp);
    const battle = state.run.battle!;
    state = {
      ...state,
      run: {
        ...state.run,
        player: { ...state.run.player, armor: 9 },
        battle: { ...battle, deck: [], discard: battle.deck },
      },
    };
    const before = structuredClone(state);
    const preview = nextCastleCard(state);
    expect(state).toEqual(before);
    const recycled = drawCastleCard(state, config);
    expect(recycled.state.run.player.hp).toBe(state.run.player.hp - CASTLE_RECYCLE_HP_COST);
    expect(recycled.state.run.player.armor).toBe(9);
    expect(recycled.state.run.battle!.activeCard).toEqual(preview);
    expect(state).toEqual(before);
    const next = drawCastleCard(recycled.state, config);
    expect(next.state.run.player.hp).toBe(recycled.state.run.player.hp);
    expect(ids(next.state)).toEqual(ids(state));
  });
  it('ends the siege if reshuffling spends the last castle HP', () => {
    const state = start(),
      battle = state.run.battle!;
    const lowHp = {
      ...state,
      run: {
        ...state.run,
        player: { ...state.run.player, hp: 4, armor: 12 },
        battle: { ...battle, deck: [], discard: battle.deck },
      },
    };
    const result = drawCastleCard(lowHp, config);
    expect(result.state.run.phase).toBe('defeat');
    expect(result.state.run.player).toMatchObject({ hp: 0, armor: 12 });
    expect(result.events).toContainEqual({ type: 'draw', recycled: true });
    expect(result.events).toContainEqual({ type: 'ended', victory: false });
    expect(drawCastleCard(result.state, config).state).toBe(result.state);
    expect(ids(result.state)).toEqual(ids(state));
  });
  it('predicts both ordinary draws and recycled stock without advancing RNG', () => {
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
    expect(nextCastleCard(recycled)).toEqual(card);
    expect(recycled.run.rngState).toBe(rng);
    expect(drawCastleCard(recycled, config).state.run.battle!.activeCard).toEqual(card);
  });
});
