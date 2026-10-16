import { describe, expect, it } from 'vitest';
import { config } from '../test/fixtures';
import { chooseGreedyCard } from '../core/Simulation';
import { MODULES, XP_THRESHOLDS } from './CastleProgression';
import {
  activateCastleJoker,
  buyCastleModule,
  createCastleRun,
  drawCastleCard,
  emptyUpgrades,
  playCastleCard,
  stepSiege,
  type CastleRun,
  type Invader,
} from './CastleDefense';
const fresh = () => createCastleRun('td-contract', config, emptyUpgrades());
const invader = (id = 100, hp = 100, progress = 0.6): Invader => ({
  id,
  sprite: 'c_orc',
  boss: false,
  hp,
  maxHp: hp,
  progress,
  speed: 0,
  damage: 1,
  cooldown: 0,
});
function fixture(length = 5, level = 5) {
  const state = fresh();
  state.progression = { xp: XP_THRESHOLDS[level - 1], level, modules: [] };
  const active = state.run.battle!.activeCard!;
  state.run = {
    ...state.run,
    battle: { ...state.run.battle!, chain: Array.from({ length }, () => active) },
  };
  state.siege.spawnIn = 1000;
  return state;
}
describe('TD progression and specializations', () => {
  it.each([1, 2, 3, 4, 5])('deploys every earned chain reward at castle level %i', (level) => {
    const result = drawCastleCard(fixture(10, level), config);
    expect(result.state.siege.units.filter((unit) => unit.kind === 'soldier')).toHaveLength(2);
    expect(result.state.siege.units.filter((unit) => unit.kind === 'archer')).toHaveLength(2);
    expect(result.state.siege.units.some((unit) => unit.kind === 'turret')).toBe(true);
    expect(result.state.siege.units.some((unit) => unit.kind === 'mortar')).toBe(true);
    expect(result.events.some((event) => event.type === 'laser')).toBe(true);
  });
  it('has no passive suit healing, armor, coins or card damage', () => {
    for (const suit of ['hearts', 'clubs', 'diamonds', 'spades'] as const) {
      const state = fresh(),
        battle = state.run.battle!;
      const physical = [
        ...battle.tableau.flatMap((column) => column.cards),
        ...battle.deck,
        battle.activeCard!,
      ];
      const card = physical.find((card) => card.suit === suit && card.rank === 5)!;
      const active = physical.find((card) => card.rank === 4)!;
      const remaining = physical.filter((item) => item !== card && item !== active);
      state.run = {
        ...state.run,
        player: { ...state.run.player, hp: 10 },
        battle: {
          ...battle,
          activeCard: active,
          tableau: [
            { cards: [card] },
            { cards: remaining.splice(0, 3) },
            ...Array.from({ length: 5 }, () => ({ cards: [] })),
          ],
          deck: remaining,
          discard: [],
          powerCards: [],
        },
      };
      const result = playCastleCard(state, card.id, config);
      expect(result.state.run.player).toEqual(state.run.player);
      expect(result.state.siege.coins).toBe(0);
      expect(result.state.progression.xp).toBeGreaterThan(0);
    }
  });
  it('buys modules once, enforces level and charges only the enemy wallet', () => {
    const state = fixture(0, 1);
    state.siege.coins = 30;
    expect(buyCastleModule(state, 'fireArrows').state).toBe(state);
    state.progression = { xp: 8, level: 2, modules: [] };
    const bought = buyCastleModule(state, 'fireArrows').state;
    expect(bought.siege.coins).toBe(24);
    expect(state.siege.coins).toBe(30);
    expect(buyCastleModule(bought, 'fireArrows').state).toBe(bought);
  });
  it('refreshes a single mounted cannon across successive chains', () => {
    let state = drawCastleCard(fixture(4), config).state;
    const cannon = state.siege.units.find((unit) => unit.kind === 'mortar')!;
    state.run = {
      ...state.run,
      battle: {
        ...state.run.battle!,
        chain: Array.from({ length: 9 }, () => state.run.battle!.activeCard!),
      },
    };
    state = drawCastleCard(state, config).state;
    expect(state.siege.units.filter((unit) => unit.kind === 'mortar')).toHaveLength(1);
    expect(state.siege.units.find((unit) => unit.kind === 'mortar')).toMatchObject({
      id: cannon.id,
      damage: 18,
      ammo: 12,
    });
  });
  it('fire arrows apply persistent burning and tick real damage', () => {
    let state = fixture(2);
    state.progression.modules = ['fireArrows'];
    state = drawCastleCard(state, config).state;
    state.siege.units = state.siege.units.filter((unit) => unit.kind === 'archer');
    state.siege.enemies = [invader()];
    const shot = stepSiege(state);
    expect(shot.events.some((event) => event.type === 'shot' && event.fire)).toBe(true);
    expect(shot.state.siege.enemies[0]).toMatchObject({ hp: 98, burning: 4 });
    const burn = stepSiege(shot.state);
    expect(burn.state.siege.enemies[0].hp).toBe(97.5);
    expect(state.siege.enemies[0].hp).toBe(100);
  });
  it('shield soldiers hold enemies after ordinary soldiers would die', () => {
    const run = (shield: boolean) => {
      let state = fixture(1);
      state.progression.modules = shield ? ['shieldSoldiers'] : [];
      state = drawCastleCard(state, config).state;
      state.siege.enemies = [{ ...invader(100, 100, 0.94), damage: 3 }];
      return stepSiege(state);
    };
    expect(run(false).state.siege.units).toHaveLength(0);
    const shield = run(true).state;
    expect(shield.siege.units[0].hp).toBe(3);
    expect(shield.siege.enemies[0].progress).toBe(0.94);
  });
  it('a single laser detonates burning sources including those killed by its beam', () => {
    const state = fixture(5);
    state.progression.modules = ['volatileLaser'];
    state.siege.enemies = [
      { ...invader(100, 20), burning: 4 },
      invader(101, 100, 0.7),
      invader(102, 100, 0.9),
    ];
    const result = drawCastleCard(state, config);
    expect(result.events.filter((event) => event.type === 'laser')).toHaveLength(1);
    expect(result.events.filter((event) => event.type === 'detonation')).toHaveLength(1);
    expect(result.state.siege.enemies.map((enemy) => enemy.hp)).toEqual([48, 60]);
    expect(result.state.siege.coins).toBe(1);
  });
});
describe('removed joker contract', () => {
  it('keeps no reserve and makes legacy activations harmless', () => {
    const state = fresh();
    expect(state.reserve).toEqual({ red: 0, black: 0 });
    expect(activateCastleJoker(state, 'black').state).toBe(state);
    expect(activateCastleJoker(state, 'red').state).toBe(state);
    expect(state.run.battle!.jokerMultiplier).toBe(1);
    expect(state.run.battle!.lifestealMultiplier).toBe(0);
  });
});
it('measures fresh-run pressure with a boss every twentieth spawn, independently of core unlocks', () => {
  const samples: { seconds: number; wins: number; coreBeforeBoss: number; bosses: number }[] = [];
  for (const seconds of [1, 2, 3]) {
    let wins = 0,
      coreBeforeBoss = 0,
      bosses = 0;
    for (let seed = 0; seed < 40; seed++) {
      let state: CastleRun = createCastleRun(`td-sample-${seed}`, config, emptyUpgrades());
      let firstBoss = false,
        spawns = 0;
      for (let action = 0; action < 400 && state.run.phase === 'battle'; action++) {
        const card = chooseGreedyCard(state.run, config);
        state = card
          ? playCastleCard(state, card, config).state
          : drawCastleCard(state, config).state;
        for (const module of MODULES) state = buyCastleModule(state, module.id).state;
        for (let tick = 0; tick < seconds * 4 && state.run.phase === 'battle'; tick++) {
          const result = stepSiege(state);
          state = result.state;
          for (const event of result.events)
            if (event.type === 'spawn') {
              spawns++;
              expect(event.enemy.boss).toBe(spawns % 20 === 0);
            }
          if (
            !firstBoss &&
            result.events.some((event) => event.type === 'spawn' && event.enemy.boss)
          ) {
            firstBoss = true;
            bosses++;
            if (state.progression.level === 5) coreBeforeBoss++;
          }
        }
      }
      if (state.run.phase === 'victory') wins++;
    }
    samples.push({ seconds, wins, coreBeforeBoss, bosses });
    expect(bosses).toBe(40);
    expect(coreBeforeBoss).toBeLessThan(bosses);
  }
  console.log(JSON.stringify({ tdBalance: samples }));
  expect(samples[0].wins).toBeGreaterThan(samples[2].wins);
  expect(samples[0].wins).toBeGreaterThanOrEqual(20);
  expect(samples[1].wins).toBeGreaterThanOrEqual(samples[2].wins);
});
