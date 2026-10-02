import { drawCard, playCard } from '../core/GameActions';
import { setupBattle, isTableauEmpty, hasLegalMoves } from '../core/GameState';
import { RNG } from '../core/RNG';
import type { RunState, GameConfig, GameEvent, BattleState } from '../core/types';
import { startRun } from '../core/GameActions';

export type UnitKind = 'soldier' | 'archer' | 'turret' | 'mortar';
// Keep the legacy 'knight' upgrade key so paid levels survive the archer replacement.
export type UpgradeKey = 'walls' | 'soldier' | 'knight' | 'magazine' | 'mortar' | 'laser';
export type Upgrades = Record<UpgradeKey, number>;
export const DEFENDER_STATS: Record<
  UnitKind,
  { damage: number; interval: number; range: number; ttl: number; ammo: number }
> = {
  soldier: { damage: 1, interval: 1, range: 0.52, ttl: 18, ammo: 100 },
  archer: { damage: 2, interval: 1.5, range: 0.55, ttl: 24, ammo: 100 },
  turret: { damage: 2, interval: 0.25, range: 0.4, ttl: 600, ammo: 10 },
  mortar: { damage: 9, interval: 2, range: 0.22, ttl: 45, ammo: 12 },
};
export const UPGRADE_VALUES: Record<UpgradeKey, { base: number; step: number }> = {
  walls: { base: 30, step: 8 },
  soldier: { base: 1, step: 1 },
  knight: { base: 2, step: 1 },
  magazine: { base: 10, step: 5 },
  mortar: { base: 9, step: 2 },
  laser: { base: 40, step: 10 },
};
export const upgradeValue = (key: UpgradeKey, level: number) =>
  UPGRADE_VALUES[key].base + UPGRADE_VALUES[key].step * level;
export const SIEGE_PACING = {
  firstSpawn: 1,
  interval: 2,
  intervalFloor: 1.25,
  acceleration: 0.0125,
  bossEvery: 21,
  enemyHp: 6,
  hpGrowth: 2,
  groupSize: 3,
  maxGroupSize: 5,
  maxEnemies: 48,
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
  hp: number;
  maxHp: number;
  progress: number;
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
  balanceVersion?: 2;
  id: string;
  siegeNumber: number;
  run: RunState;
  siege: SiegeState;
  upgrades: Upgrades;
  usedPowers?: string[];
}
export type SiegeEvent =
  | { type: 'spawn'; enemy: Invader }
  | { type: 'deploy'; kind: UnitKind; id: number }
  | { type: 'reload'; id: number; ammo: number }
  | { type: 'boost'; effect: 'heal' | 'armor' | 'gold'; amount: number }
  | { type: 'shot'; kind: UnitKind; unit: number; target: number; damage: number }
  | { type: 'killed'; enemy: Invader }
  | { type: 'unit_killed'; unit: Defender }
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
  id = seed,
  siegeNumber = 1
): CastleRun {
  const maxHp = upgradeValue('walls', upgrades.walls);
  const initial = setupBattle(
    startRun(seed, config),
    sentinel,
    new RNG(seed + ':powers').next() < 0.5 ? 3 : 4,
    config
  );
  return {
    version: 1,
    balanceVersion: 2,
    id,
    siegeNumber,
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
/** Difficulty is saved with the siege; reopening never increases it. */
export const siegeDifficulty = (siegeNumber: number) => {
  const tier = Math.max(0, siegeNumber - 1);
  return {
    hp: 1 + tier * 0.08,
    speed: 1 + Math.min(0.3, tier * 0.015),
    spawn: 1 / (1 + Math.min(0.6, tier * 0.03)),
  };
};
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
  const previousHp = state.run.player.hp;
  let healing = 0;
  for (const enemy of state.siege.enemies) {
    healing += Math.min(enemy.hp, damage) * ratio;
    enemy.hp = final ? 0 : Math.max(0, enemy.hp - damage);
  }
  if (healing)
    state.run = {
      ...state.run,
      player: {
        ...state.run.player,
        hp: Math.min(state.run.player.maxHp, state.run.player.hp + healing),
      },
    };
  const restored = state.run.player.hp - previousHp;
  if (restored > 0) events.push({ type: 'boost', effect: 'heal', amount: restored });
  events.push({ type: 'laser', damage, final });
  killDead(state, events);
  state.siege.laserCharge = 0;
}
function deploy(state: CastleRun, kind: UnitKind, events: SiegeEvent[]) {
  const b = state.run.battle!;
  const multiplier = b.jokerMultiplier ?? 1;
  const stats = DEFENDER_STATS[kind];
  const base =
    kind === 'turret' || kind === 'soldier'
      ? stats.damage
      : kind === 'archer'
        ? upgradeValue('knight', state.upgrades.knight)
        : upgradeValue('mortar', state.upgrades.mortar);
  const unit: Defender = {
    id:
      kind === 'turret'
        ? (state.siege.units.find((u) => u.kind === 'turret')?.id ?? state.siege.nextId++)
        : state.siege.nextId++,
    kind,
    damage: base * multiplier,
    heal: ((b.lifestealMultiplier ?? 0) / multiplier) * 0.3,
    cooldown: 0,
    engaged: false,
    hp: kind === 'soldier' || kind === 'archer' ? 1 : 6,
    maxHp: kind === 'soldier' || kind === 'archer' ? 1 : 6,
    progress: 0.94,
    ttl: stats.ttl,
    ammo: kind === 'turret' ? upgradeValue('magazine', state.upgrades.magazine) : stats.ammo,
  };
  if (kind === 'turret') {
    const turret = state.siege.units.find((u) => u.kind === 'turret');
    if (turret) {
      Object.assign(turret, unit, { cooldown: Math.max(0, turret.cooldown) });
      events.push({ type: 'reload', id: turret.id, ammo: turret.ammo });
      return;
    }
  }
  // Thirty-two visible defenders maximum. A new deployment refreshes a matching unit
  // once all slots are occupied; it never silently throws away a combo reward.
  if (state.siege.units.length >= 32) {
    const existing =
      state.siege.units.find((u) => u.kind === kind) ??
      state.siege.units.find((u) => u.kind !== 'turret') ??
      state.siege.units[0];
    Object.assign(existing, unit, { id: existing.id });
    events.push({ type: 'deploy', kind, id: existing.id });
  } else {
    state.siege.units.push(unit);
    events.push({ type: 'deploy', kind, id: unit.id });
  }
}
/** ECHO contributes virtual links to siege reward thresholds without duplicating cards. */
export function castleChainLength(battle: BattleState | null, echoBonus = 2): number {
  if (!battle) return 0;
  const echoes = battle.chain.filter((card) =>
    battle.powerCards.some((power) => power.cardId === card.id && power.type === 'ECHO')
  ).length;
  return battle.chain.length + echoes * echoBonus;
}
export function playCastleCard(
  current: CastleRun,
  cardId: string,
  config: GameConfig
): SiegeResult {
  if (current.run.phase !== 'battle') return { state: current, events: [] };
  // Immediate powers are consumed once: undo must not farm healing, coins or bombs.
  const used = new Set(current.usedPowers ?? []);
  const battle = current.run.battle!;
  const input = used.has(cardId)
    ? {
        ...current.run,
        battle: { ...battle, powerCards: battle.powerCards.filter((p) => p.cardId !== cardId) },
      }
    : current.run;
  const played = playCard(input, cardId, config);
  if (played.state === input || !played.state.battle) return { state: current, events: [] };
  const state = clone(current);
  const chain = castleChainLength(played.state.battle, config.powerCards.ECHO.comboBonus);
  // Card legality, powers and joker order come from the same solitaire engine.
  // The legacy duel's completion/reward events do not control this siege.
  state.run = {
    ...played.state,
    phase: 'battle',
    availableRewards: [],
    battle: {
      ...played.state.battle,
      powerCards: battle.powerCards,
      mode: 'solitaire',
      enemy: combatant(),
    },
  };
  if (
    played.events.some(
      (e) => e.type === 'power_activated' && ['HEAL', 'GUARD', 'GOLD', 'BOMB'].includes(e.powerType)
    )
  )
    used.add(cardId);
  state.usedPowers = [...used];
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
  const changes = [
    ['heal', state.run.player.hp - current.run.player.hp],
    ['armor', state.run.player.armor - current.run.player.armor],
    ['gold', state.run.player.gold - current.run.player.gold],
  ] as const;
  for (const [effect, amount] of changes)
    if (amount > 0) events.push({ type: 'boost', effect, amount });
  // BOMB blasts the whole lane; CRIT improves the newly deployed unit.
  if (played.events.some((e) => e.type === 'power_activated' && e.powerType === 'BOMB')) {
    state.siege.enemies.forEach((e) => {
      e.hp -= config.powerCards.BOMB.flatDamage;
    });
    killDead(state, events);
  }
  if (isTableauEmpty(state.run.battle!.tableau)) {
    laser(state, events, true);
    state.run = { ...state.run, phase: 'victory' };
    events.push({ type: 'ended', victory: true });
  } else checkExhaustion(state, events);
  return { state, events };
}
function checkExhaustion(state: CastleRun, events: SiegeEvent[]) {
  const battle = state.run.battle;
  if (state.run.phase === 'battle' && battle && !battle.deck.length && !hasLegalMoves(battle)) {
    state.run = { ...state.run, phase: 'defeat', player: { ...state.run.player, hp: 0 } };
    events.push({ type: 'ended', victory: false });
  }
}
/** Only the remaining finite stock is previewed; discarded cards never return. */
export function nextCastleCard(current: CastleRun) {
  const battle = current.run.battle;
  if (!battle) return undefined;
  return battle.deck[0];
}
export function drawCastleCard(current: CastleRun, config: GameConfig): SiegeResult {
  if (current.run.phase !== 'battle') return { state: current, events: [] };
  const state = clone(current);
  const events: SiegeEvent[] = [];
  const chain = castleChainLength(state.run.battle, config.powerCards.ECHO.comboBonus);
  // Release all reached rewards once, before drawing resets joker/chain effects.
  if (chain >= 1) {
    for (let i = 0; i < upgradeValue('soldier', state.upgrades.soldier); i++)
      deploy(state, 'soldier', events);
  }
  if (chain >= 2) deploy(state, 'archer', events);
  if (chain >= 3) deploy(state, 'turret', events);
  if (chain >= 4) deploy(state, 'mortar', events);
  for (let tier = 5; tier <= chain; tier += 3) laser(state, events);
  const critical = state.run.battle?.chain.some((card) =>
    state.run.battle!.powerCards.some((power) => power.cardId === card.id && power.type === 'CRIT')
  );
  if (critical)
    for (const event of events) {
      if (event.type === 'deploy' || event.type === 'reload') {
        const unit = state.siege.units.find((u) => u.id === event.id);
        if (unit) unit.damage *= config.powerCards.CRIT.damageMultiplier;
      }
    }
  const battle = state.run.battle!;
  if (battle.deck.length > 0) {
    const drawn = drawCard(
      {
        ...state.run,
        battle: { ...battle, accumulatedDamage: 0, chainBaseDamage: 0 },
      },
      config
    );
    state.run = { ...drawn.state, phase: 'battle' };
  } else {
    // Release the last banked chain once, without recycling the physical pack.
    state.run = {
      ...state.run,
      battle: {
        ...battle,
        chain: [],
        accumulatedDamage: 0,
        chainBaseDamage: 0,
        jokerMultiplier: battle.activeCard?.joker === 'black' ? 5 : 1,
        lifestealMultiplier: battle.activeCard?.joker === 'red' ? 1 : 0,
      },
    };
  }
  state.siege.started = true;
  state.siege.laserCharge = 0;
  events.push({ type: 'draw', recycled: false });
  checkExhaustion(state, events);
  return { state, events };
}

/** Fixed-step simulation. UI does not call this while paused or hidden. */
export function stepSiege(current: CastleRun): SiegeResult {
  if (current.run.phase !== 'battle') return { state: current, events: [] };
  const battle = current.run.battle;
  if (battle && !battle.deck.length && !hasLegalMoves(battle)) {
    const exhausted = clone(current);
    const exhaustionEvents: SiegeEvent[] = [];
    checkExhaustion(exhausted, exhaustionEvents);
    return { state: exhausted, events: exhaustionEvents };
  }
  if (!current.siege.started) return { state: current, events: [] };
  const state = clone(current),
    siege = state.siege,
    events: SiegeEvent[] = [];
  const difficulty = siegeDifficulty(state.siegeNumber);
  siege.elapsed += STEP;
  siege.spawnIn -= STEP;
  if (siege.spawnIn <= 0 && siege.enemies.length < SIEGE_PACING.maxEnemies) {
    const level = Math.floor(siege.elapsed / 30);
    const size = Math.min(SIEGE_PACING.maxGroupSize, SIEGE_PACING.groupSize + level);
    const rng = RNG.fromState(siege.rngState);
    for (let i = 0; i < size && siege.enemies.length < SIEGE_PACING.maxEnemies; i++) {
      siege.spawned++;
      const boss = siege.spawned % SIEGE_PACING.bossEvery === 0;
      const hp = Math.ceil(
        (boss ? 100 + level * 20 : SIEGE_PACING.enemyHp + level * SIEGE_PACING.hpGrowth) *
          difficulty.hp
      );
      const sprites = boss ? ['c_ogre', 'c_reaper1'] : ['c_orc', 'c_goblin', 'c_reaper2'];
      const enemy: Invader = {
        id: siege.nextId++,
        sprite: rng.pickOne(sprites),
        boss,
        hp,
        maxHp: hp,
        progress: i * 0.035,
        speed: ((boss ? 0.025 : 0.032) + rng.next() * 0.006) * difficulty.speed,
        damage: boss ? 4 : 1 + Math.floor(level / 2),
        cooldown: 0,
      };
      siege.enemies.push(enemy);
      events.push({ type: 'spawn', enemy: { ...enemy } });
    }
    siege.rngState = rng.getState();
    siege.spawnIn =
      difficulty.spawn *
      Math.max(
        SIEGE_PACING.intervalFloor,
        SIEGE_PACING.interval - Math.floor(siege.elapsed / 2) * SIEGE_PACING.acceleration
      );
  }
  for (const unit of siege.units) {
    if (unit.engaged && unit.kind !== 'turret') unit.ttl -= STEP;
    unit.cooldown -= STEP;
    const mobile = unit.kind === 'soldier';
    const nearby = siege.enemies.some(
      (e) => e.hp > 0 && Math.abs(e.progress - unit.progress) <= 0.045
    );
    if (mobile && !nearby) unit.progress = Math.max(0, unit.progress - 0.065 * STEP);
    if (unit.hp <= 0 || unit.ttl <= 0 || unit.ammo <= 0 || unit.cooldown > 0) continue;
    const stats = DEFENDER_STATS[unit.kind];
    const range = stats.range;
    const targets = siege.enemies
      .filter(
        (e) =>
          e.hp > 0 && (mobile ? Math.abs(e.progress - unit.progress) <= 0.045 : e.progress >= range)
      )
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
  siege.units = siege.units.filter(
    (u) => u.hp > 0 && (u.kind === 'turret' || (u.ttl > 0 && u.ammo > 0))
  );
  for (const enemy of siege.enemies) {
    const opponent = siege.units.find(
      (u) =>
        u.hp > 0 &&
        (u.kind === 'soldier' || u.kind === 'archer') &&
        Math.abs(u.progress - enemy.progress) <= 0.06
    );
    enemy.cooldown -= STEP;
    if (opponent) {
      if (enemy.cooldown <= 0) {
        enemy.cooldown = 1;
        opponent.hp = Math.max(0, opponent.hp - enemy.damage);
        if (opponent.hp === 0) events.push({ type: 'unit_killed', unit: { ...opponent } });
      }
      continue;
    }
    enemy.progress = Math.min(0.94, enemy.progress + enemy.speed * STEP);
    if (enemy.progress >= 0.94 && enemy.cooldown <= 0) {
      enemy.cooldown = enemy.boss ? 3 : 3.5;
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
  siege.units = siege.units.filter((u) => u.hp > 0);
  const healing = state.run.player.hp - current.run.player.hp;
  if (healing > 0) events.push({ type: 'boost', effect: 'heal', amount: healing });
  if (state.run.player.hp <= 0) {
    state.run = { ...state.run, phase: 'defeat' };
    events.push({ type: 'ended', victory: false });
  }
  return { state, events };
}
export const earnedCoins = (state: CastleRun) =>
  state.siege.coins + state.run.player.gold + (state.run.phase === 'victory' ? 10 : 0);
