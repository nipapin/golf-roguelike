import { drawCard, playCard } from '../core/GameActions';
import { setupBattle, isTableauEmpty } from '../core/GameState';
import { RNG } from '../core/RNG';
import type { RunState, GameConfig, GameEvent } from '../core/types';
import { startRun } from '../core/GameActions';

export type UnitKind = 'soldier' | 'knight' | 'turret' | 'mortar';
export type UpgradeKey = 'walls' | 'soldier' | 'knight' | 'magazine' | 'mortar' | 'laser';
export type Upgrades = Record<UpgradeKey, number>;
export const DEFENDER_STATS: Record<
  UnitKind,
  { damage: number; interval: number; range: number; ttl: number; ammo: number }
> = {
  soldier: { damage: 3, interval: 1, range: 0.52, ttl: 18, ammo: 100 },
  knight: { damage: 6, interval: 1.5, range: 0.38, ttl: 24, ammo: 100 },
  turret: { damage: 2, interval: 0.25, range: 0, ttl: 600, ammo: 100 },
  mortar: { damage: 9, interval: 2, range: 0, ttl: 45, ammo: 12 },
};
export const UPGRADE_VALUES: Record<UpgradeKey, { base: number; step: number }> = {
  walls: { base: 30, step: 5 },
  soldier: { base: 3, step: 1 },
  knight: { base: 6, step: 2 },
  magazine: { base: 100, step: 20 },
  mortar: { base: 9, step: 2 },
  laser: { base: 80, step: 20 },
};
export const upgradeValue = (key: UpgradeKey, level: number) =>
  UPGRADE_VALUES[key].base + UPGRADE_VALUES[key].step * level;
export const SIEGE_PACING = {
  firstSpawn: 5,
  interval: 5,
  intervalFloor: 2.5,
  acceleration: 0.05,
  bossEvery: 11,
  enemyHp: 8,
  hpGrowth: 0.65,
};
export const emptyUpgrades = (): Upgrades => ({
  walls: 0,
  soldier: 0,
  knight: 0,
  magazine: 0,
  mortar: 0,
  laser: 0,
});
export const UPGRADE_KEYS: UpgradeKey[] = [
  'walls',
  'soldier',
  'knight',
  'magazine',
  'mortar',
  'laser',
];
export const UPGRADE_LIMIT = 10;
export const upgradeCost = (level: number) => 10 + level * 8;
export const STEP = 0.25;
export interface Invader {
  id: number;
  sprite: string;
  boss: boolean;
  hp: number;
  maxHp: number;
  progress: number;
  speed: number;
  damage: number;
  cooldown: number;
}
export interface Defender {
  id: number;
  kind: UnitKind;
  damage: number;
  heal: number;
  cooldown: number;
  ttl: number;
  ammo: number;
  engaged: boolean;
}
export interface SiegeState {
  started: boolean;
  elapsed: number;
  spawnIn: number;
  spawned: number;
  kills: number;
  coins: number;
  enemies: Invader[];
  units: Defender[];
  nextId: number;
  rngState: number;
  laserCharge: number;
}
export interface CastleRun {
  version: 1;
  id: string;
  run: RunState;
  siege: SiegeState;
  upgrades: Upgrades;
}
export type SiegeEvent =
  | { type: 'spawn'; enemy: Invader }
  | { type: 'deploy'; kind: UnitKind; id: number }
  | { type: 'shot'; kind: UnitKind; unit: number; target: number; damage: number }
  | { type: 'killed'; enemy: Invader }
  | { type: 'castle_hit'; damage: number; enemy: number }
  | { type: 'laser'; final: boolean; damage: number }
  | { type: 'card'; chain: number; events: GameEvent[] }
  | { type: 'draw'; recycled: boolean }
  | { type: 'ended'; victory: boolean };
export interface SiegeResult {
  state: CastleRun;
  events: SiegeEvent[];
}
const sentinel = {
  id: 'siege',
  name: 'CASTLE SIEGE',
  hp: 1_000_000,
  sprite: 'c_orc',
  intents: [{ type: 'defend' as const, value: 0 }],
};
const combatant = () => ({ ...sentinel, maxHp: sentinel.hp, currentIntentIndex: 0 });

export function createCastleRun(
  seed: string,
  config: GameConfig,
  upgrades: Upgrades,
  id = seed
): CastleRun {
  const maxHp = upgradeValue('walls', upgrades.walls);
  const initial = setupBattle(startRun(seed, config), sentinel, 7, config);
  return {
    version: 1,
    id,
    upgrades: { ...upgrades },
    run: { ...initial, player: { ...initial.player, hp: maxHp, maxHp } },
    siege: {
      started: false,
      elapsed: 0,
      spawnIn: SIEGE_PACING.firstSpawn,
      spawned: 0,
      kills: 0,
      coins: 0,
      enemies: [],
      units: [],
      nextId: 1,
      rngState: new RNG(seed + ':siege').getState(),
      laserCharge: 0,
    },
  };
}
const clone = (state: CastleRun): CastleRun => ({
  ...state,
  run: { ...state.run, player: { ...state.run.player } },
  siege: {
    ...state.siege,
    enemies: state.siege.enemies.map((e) => ({ ...e })),
    units: state.siege.units.map((u) => ({ ...u })),
  },
});

function killDead(state: CastleRun, events: SiegeEvent[]) {
  const dead = state.siege.enemies.filter((e) => e.hp <= 0);
  for (const enemy of dead) {
    state.siege.kills++;
    state.siege.coins += enemy.boss ? 5 : 1;
    events.push({ type: 'killed', enemy: { ...enemy } });
  }
  state.siege.enemies = state.siege.enemies.filter((e) => e.hp > 0);
}
function laser(state: CastleRun, events: SiegeEvent[], final = false) {
  const damage =
    upgradeValue('laser', state.upgrades.laser) * (state.run.battle?.jokerMultiplier ?? 1);
  const ratio =
    ((state.run.battle?.lifestealMultiplier ?? 0) / (state.run.battle?.jokerMultiplier ?? 1)) * 0.3;
  let healing = 0;
  for (const enemy of state.siege.enemies) {
    healing += Math.min(enemy.hp, damage) * ratio;
    enemy.hp = final || !enemy.boss ? 0 : Math.max(0, enemy.hp - damage);
  }
  if (healing)
    state.run = {
      ...state.run,
      player: {
        ...state.run.player,
        hp: Math.min(state.run.player.maxHp, state.run.player.hp + healing),
      },
    };
  events.push({ type: 'laser', damage, final });
  killDead(state, events);
  state.siege.laserCharge = 0;
}
function deploy(state: CastleRun, kind: UnitKind, events: SiegeEvent[]) {
  const b = state.run.battle!;
  const multiplier = b.jokerMultiplier ?? 1;
  const stats = DEFENDER_STATS[kind];
  const base = kind === 'turret' ? stats.damage : upgradeValue(kind, state.upgrades[kind]);
  const unit: Defender = {
    id: state.siege.nextId++,
    kind,
    damage: base * multiplier,
    heal: ((b.lifestealMultiplier ?? 0) / multiplier) * 0.3,
    cooldown: 0,
    engaged: false,
    ttl: stats.ttl,
    ammo: kind === 'turret' ? upgradeValue('magazine', state.upgrades.magazine) : stats.ammo,
  };
  // Eight visible defenders maximum. A new deployment refreshes a matching unit
  // once all slots are occupied; it never silently throws away a combo reward.
  if (state.siege.units.length >= 8) {
    const existing = state.siege.units.find((u) => u.kind === kind) ?? state.siege.units[0];
    Object.assign(existing, unit, { id: existing.id });
    events.push({ type: 'deploy', kind, id: existing.id });
  } else {
    state.siege.units.push(unit);
    events.push({ type: 'deploy', kind, id: unit.id });
  }
}
export function playCastleCard(
  current: CastleRun,
  cardId: string,
  config: GameConfig
): SiegeResult {
  if (current.run.phase !== 'battle') return { state: current, events: [] };
  const played = playCard(current.run, cardId, config);
  if (played.state === current.run || !played.state.battle) return { state: current, events: [] };
  const state = clone(current);
  const chain = (current.run.battle?.chain.length ?? 0) + 1;
  // Card legality, powers and joker order come from the same solitaire engine.
  // The legacy duel's completion/reward events do not control this siege.
  state.run = {
    ...played.state,
    phase: 'battle',
    availableRewards: [],
    battle: { ...played.state.battle, mode: 'solitaire', enemy: combatant() },
  };
  state.siege.started = true;
  const events: SiegeEvent[] = [
    {
      type: 'card',
      chain,
      events: played.events.filter(
        (e) => !['tableau_cleared', 'enemy_died', 'battle_won', 'chain_resolved'].includes(e.type)
      ),
    },
  ];
  if (chain === 1) deploy(state, 'soldier', events);
  if (chain === 2) deploy(state, 'knight', events);
  if (chain === 3) deploy(state, 'turret', events);
  if (chain === 4) deploy(state, 'mortar', events);
  if (chain >= 5) {
    state.siege.laserCharge = (chain - 5) % 3;
    if ((chain - 5) % 3 === 0) laser(state, events);
  }
  // BOMB blasts the whole lane; CRIT improves the newly deployed unit.
  if (played.events.some((e) => e.type === 'power_activated' && e.powerType === 'BOMB')) {
    state.siege.enemies.forEach((e) => {
      e.hp -= config.powerCards.BOMB.flatDamage;
    });
    killDead(state, events);
  }
  if (played.events.some((e) => e.type === 'power_activated' && e.powerType === 'CRIT')) {
    const deployed = [...events].reverse().find((e) => e.type === 'deploy');
    if (deployed?.type === 'deploy') {
      const unit = state.siege.units.find((u) => u.id === deployed.id);
      if (unit) unit.damage *= config.powerCards.CRIT.damageMultiplier;
    }
  }
  if (isTableauEmpty(state.run.battle!.tableau)) {
    laser(state, events, true);
    state.run = { ...state.run, phase: 'victory' };
    events.push({ type: 'ended', victory: true });
  }
  return { state, events };
}
export function drawCastleCard(current: CastleRun, config: GameConfig): SiegeResult {
  if (current.run.phase !== 'battle') return { state: current, events: [] };
  let run = current.run;
  const recycled = !!run.battle && run.battle.deck.length === 0 && run.battle.discard.length > 0;
  if (recycled && run.battle) {
    const rng = RNG.fromState(run.rngState);
    run = {
      ...run,
      rngState: rng.getState(),
      battle: { ...run.battle, deck: rng.shuffle(run.battle.discard), discard: [] },
    };
    run = { ...run, rngState: rng.getState() };
  }
  const drawn = drawCard(
    {
      ...run,
      battle: run.battle ? { ...run.battle, accumulatedDamage: 0, chainBaseDamage: 0 } : null,
    },
    config
  );
  const state = clone(current);
  state.run = { ...drawn.state, phase: 'battle' };
  state.siege.started = true;
  state.siege.laserCharge = 0;
  return { state, events: [{ type: 'draw', recycled }] };
}

/** Fixed-step simulation. UI does not call this while paused or hidden. */
export function stepSiege(current: CastleRun): SiegeResult {
  if (current.run.phase !== 'battle' || !current.siege.started)
    return { state: current, events: [] };
  const state = clone(current),
    siege = state.siege,
    events: SiegeEvent[] = [];
  siege.elapsed += STEP;
  siege.spawnIn -= STEP;
  if (siege.spawnIn <= 0 && siege.enemies.length < 16) {
    siege.spawned++;
    const boss = siege.spawned % SIEGE_PACING.bossEvery === 0;
    const hp = boss
      ? 100 + Math.floor(siege.spawned / 11) * 20
      : SIEGE_PACING.enemyHp + Math.floor(siege.spawned * SIEGE_PACING.hpGrowth);
    const rng = RNG.fromState(siege.rngState);
    const sprites = boss ? ['c_ogre', 'c_reaper1'] : ['c_orc', 'c_goblin', 'c_reaper2'];
    const enemy: Invader = {
      id: siege.nextId++,
      sprite: rng.pickOne(sprites),
      boss,
      hp,
      maxHp: hp,
      progress: 0,
      speed: boss ? 0.022 : 0.028 + Math.min(0.014, siege.spawned * 0.0003),
      damage: boss ? 7 : 2 + Math.floor(siege.spawned / 15),
      cooldown: 0,
    };
    siege.enemies.push(enemy);
    siege.rngState = rng.getState();
    siege.spawnIn = Math.max(
      SIEGE_PACING.intervalFloor,
      SIEGE_PACING.interval - siege.spawned * SIEGE_PACING.acceleration
    );
    events.push({ type: 'spawn', enemy: { ...enemy } });
  }
  for (const unit of siege.units) {
    if (unit.engaged) unit.ttl -= STEP;
    unit.cooldown -= STEP;
    if (unit.ttl <= 0 || unit.ammo <= 0 || unit.cooldown > 0) continue;
    const stats = DEFENDER_STATS[unit.kind];
    const range = stats.range;
    const targets = siege.enemies
      .filter((e) => e.hp > 0 && e.progress >= range)
      .sort((a, b) => b.progress - a.progress);
    if (!targets.length) continue;
    unit.cooldown = stats.interval;
    unit.ammo--;
    unit.engaged = true;
    const hit = unit.kind === 'mortar' ? targets.slice(0, 3) : targets.slice(0, 1);
    for (const target of hit) {
      const damage = Math.min(target.hp, unit.damage);
      target.hp -= unit.damage;
      if (unit.heal > 0)
        state.run = {
          ...state.run,
          player: {
            ...state.run.player,
            hp: Math.min(state.run.player.maxHp, state.run.player.hp + damage * unit.heal),
          },
        };
      events.push({ type: 'shot', kind: unit.kind, unit: unit.id, target: target.id, damage });
    }
  }
  killDead(state, events);
  siege.units = siege.units.filter((u) => u.ttl > 0 && u.ammo > 0);
  for (const enemy of siege.enemies) {
    enemy.progress = Math.min(0.94, enemy.progress + enemy.speed * STEP);
    enemy.cooldown -= STEP;
    if (enemy.progress >= 0.94 && enemy.cooldown <= 0) {
      enemy.cooldown = enemy.boss ? 2 : 2.5;
      const blocked = Math.min(state.run.player.armor, enemy.damage);
      const damage = enemy.damage - blocked;
      state.run = {
        ...state.run,
        player: {
          ...state.run.player,
          hp: Math.max(0, state.run.player.hp - damage),
          armor: state.run.player.armor - blocked,
        },
      };
      events.push({ type: 'castle_hit', damage, enemy: enemy.id });
    }
  }
  if (state.run.player.hp <= 0) {
    state.run = { ...state.run, phase: 'defeat' };
    events.push({ type: 'ended', victory: false });
  }
  return { state, events };
}
export const earnedCoins = (state: CastleRun) =>
  state.siege.coins + state.run.player.gold + (state.run.phase === 'victory' ? 10 : 0);
