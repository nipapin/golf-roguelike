import { createDeck, setupBattle, isTableauEmpty, canConnectInBattle, findCardColumn, isCardExposed, getPowerType } from '../core/GameState';
import { RNG } from '../core/RNG';
import type { RunState, GameConfig, GameEvent, Card } from '../core/types';
import { startRun } from '../core/GameActions';
import { CASTLE_XP, castleLevel, MODULES, type CastleProgression, type ModuleKey } from './CastleProgression';
import { PerkManager } from './PerkManager';

export type UnitKind = 'soldier' | 'archer' | 'turret' | 'mortar';
// Keep the legacy 'knight' upgrade key so paid levels survive the archer replacement.
export type UpgradeKey = 'walls' | 'soldier' | 'knight' | 'magazine' | 'mortar' | 'laser';
export type Upgrades = Record<UpgradeKey, number>;
export const DEFENDER_STATS: Record<
  UnitKind,
  { damage: number; interval: number; range: number; ttl: number; ammo: number }
> = {
  soldier: { damage: 2, interval: 1, range: 0.52, ttl: 18, ammo: 100 },
  archer: { damage: 2, interval: 1.5, range: 0.55, ttl: 24, ammo: 100 },
  turret: { damage: 2, interval: 0.25, range: 0.4, ttl: 600, ammo: 10 },
  mortar: { damage: 9, interval: 2, range: 0.65, ttl: 45, ammo: 12 },
};
export const UPGRADE_VALUES: Record<UpgradeKey, { base: number; step: number }> = {
  walls: { base: 40, step: 8 },
  soldier: { base: 1, step: 1 },
  knight: { base: 2, step: 1 },
  magazine: { base: 10, step: 5 },
  mortar: { base: 9, step: 2 },
  laser: { base: 40, step: 10 },
};
export const upgradeValue = (key: UpgradeKey, level: number) =>
  UPGRADE_VALUES[key].base + UPGRADE_VALUES[key].step * level;
export const SIEGE_PACING = {
  firstSpawn: 0,
  interval: 5,
  bossEvery: 20,
  enemyHp: 6,
  hpGrowth: 2,
  groupSize: 5,
  maxEnemies: 300,
};
export const CASTLE_RECYCLE_HP_COST = 5;
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
export const MELEE_RANGE = 0.06;
/** Soldiers hold the last quarter of the approach to the castle. */
export const SOLDIER_HOLD_PROGRESS = 0.75;
const MIN_ASSIST_DRAW = 3;
const MAX_ASSIST_DRAW = 7;
export const CASTLE_ABILITIES = {
  HEAL: { cost: 30, title: 'HEAL' },
  BOMB: { cost: 100, title: 'BOMB' },
  ECHO: { cost: 50, title: 'ECHO' },
} as const;
export type CastleAbility = keyof typeof CASTLE_ABILITIES;
export const CHAIN_REWARD_ORDER = ['soldier', 'archer', 'turret', 'mortar', 'laser'] as const;
export const CASTLE_GUARD_CARD_COUNT = 2;
export const CASTLE_GUARD_REWARD = { normal: 1, bonus: 5, bonusChance: 0.2 } as const;
/** Each reward repeats once per five cards, starting at its own tier. */
export function chainRewardCounts(chain: number): Record<typeof CHAIN_REWARD_ORDER[number], number> {
  return Object.fromEntries(
    CHAIN_REWARD_ORDER.map((kind, index) => [kind, Math.max(0, Math.floor((chain + 4 - index) / 5))])
  ) as Record<typeof CHAIN_REWARD_ORDER[number], number>;
}
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
  burning?: number;
  burnDamage?: number;
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
export function soldierIsMarching(unit: Defender, enemies: readonly Invader[]): boolean {
  return unit.kind === 'soldier' && !unit.engaged && unit.progress > SOLDIER_HOLD_PROGRESS &&
    unit.hp > 0 && unit.ttl > 0 && unit.ammo > 0 &&
    !enemies.some(enemy => enemy.hp > 0 && Math.abs(enemy.progress - unit.progress) <= MELEE_RANGE);
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
export interface CastleRunStats {
  roundsWon: number;
  enemiesDefeated: number;
  bossesDefeated: number;
  cardsPlayed: number;
  seconds: number;
  goldEarned: number;
}
export const emptyCastleRunStats = (): CastleRunStats => ({
  roundsWon: 0, enemiesDefeated: 0, bossesDefeated: 0,
  cardsPlayed: 0, seconds: 0, goldEarned: 0,
});
export interface CastleRun {
  version: 1;
  balanceVersion?: 2 | 3;
  id: string;
  siegeNumber: number;
  run: RunState;
  siege: SiegeState;
  upgrades: Upgrades;
  progression: CastleProgression;
  reserve: { red: number; black: number };
  usedPowers?: string[];
  abilitiesUsed?: CastleAbility[];
  emptyDraws?: number;
  drawAssistAt?: number;
  drawAssistRngState?: number;
  /** Legacy save field; undo availability now depends only on move history. */
  undoRemaining?: number;
  inheritedCoins?: number;
  runStats?: CastleRunStats;
  /** Owned perks with stack counts, persists for the run */
  perks?: { id: string; stacks: number }[];
  /** Perk round state (resets each round) */
  perkRoundState?: {
    heartHealUsed: number;
    trinityBombs: number;
    ranksPlayed: [number, number][];
    fireArrows: number;
    masonsElapsed: number;
    masonsHealUsed: number;
  };
  /** Rerolls used this run for perk offers */
  perkRerollsUsed?: number;
  /** Free rerolls used this run */
  perkFreeRerollsUsed?: number;
  /** Consecutive offers without rare+ (for pity) */
  perkRareStreak?: number;
}
export type SiegeEvent =
  | { type: 'ability'; ability: CastleAbility }
  | { type: 'melee'; enemy: number; unit: number }
  | { type: 'spawn'; enemy: Invader }
  | { type: 'deploy'; kind: UnitKind; id: number }
  | { type: 'reload'; id: number; ammo: number }
  | { type: 'boost'; effect: 'heal' | 'armor' | 'gold'; amount: number }
  | { type: 'shot'; kind: UnitKind; unit: number; target: number; damage: number; fire?: boolean }
  | { type: 'killed'; enemy: Invader; coins: number }
  | { type: 'level_up'; level: number }
  | { type: 'module_bought'; key: ModuleKey; cost: number }
  | { type: 'joker'; color: 'red' | 'black' }
  | { type: 'detonation'; enemy: number; damage: number }
  | { type: 'unit_killed'; unit: Defender }
  | { type: 'castle_hit'; damage: number; enemy: number }
  | { type: 'laser'; final: boolean; damage: number }
  | { type: 'card'; chain: number; events: GameEvent[] }
  | { type: 'draw'; recycled: boolean }
  | { type: 'ended'; victory: boolean }
  | { type: 'perk_heal'; amount: number }
  | { type: 'perk_coins'; amount: number }
  | { type: 'perk_armor'; amount: number }
  | { type: 'perk_bomb'; damage: number }
  | { type: 'perk_laser'; damage: number }
  | { type: 'perk_salvo'; damage: number; targets: number };
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

export function createCastleRun(
  seed: string,
  config: GameConfig,
  upgrades: Upgrades,
  id = seed,
  siegeNumber = 1
): CastleRun {
  const maxHp = upgradeValue('walls', upgrades.walls);
  const dealConfig = { ...config, tableau: { ...config.tableau, rows: 5 } };
  // Reserve jokers before shuffling/dealing so every tableau cell receives a card.
  const initial = setupBattle(startRun(seed, config), sentinel, CASTLE_GUARD_CARD_COUNT + 1, dealConfig, {}, createDeck().filter((card) => !card.joker));
  const battle = initial.battle!;
  const ordinaryDeck = battle.deck.filter((card) => !card.joker);
  const activeCard = battle.activeCard?.joker ? ordinaryDeck.shift()! : battle.activeCard;
  return {
    version: 1,
    balanceVersion: 3,
    id,
    siegeNumber,
    upgrades: { ...upgrades },
    progression: { xp: 0, level: 1, modules: [] },
    reserve: { red: 0, black: 0 },
    abilitiesUsed: [],
    emptyDraws: 0,
    drawAssistRngState: new RNG(seed + ':stock-assist').getState(),
    undoRemaining: 3,
    runStats: emptyCastleRunStats(),
    run: { ...initial, player: { ...initial.player, hp: maxHp, maxHp }, battle: {
      ...battle, allowRankWrap: true, activeCard, deck: ordinaryDeck,
      tableau: battle.tableau.map((column) => ({ cards: column.cards.filter((card) => !card.joker) })),
      powerCards: battle.powerCards.map((power, i) => ({ ...power, type: i === 0 ? 'WILD' : 'GUARD' })),
      jokerMultiplier: 1, lifestealMultiplier: 0,
    } },
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
  };
};

/** Get PerkManager from state with proper round state hydration */
export function getPerkManager(state: CastleRun): PerkManager {
  const manager = PerkManager.fromOwned(state.perks ?? []);
  if (state.perkRoundState) {
    const rs = manager.getRoundState();
    rs.heartHealUsed = state.perkRoundState.heartHealUsed;
    rs.trinityBombs = state.perkRoundState.trinityBombs;
    rs.fireArrows = state.perkRoundState.fireArrows;
    rs.masonsElapsed = state.perkRoundState.masonsElapsed;
    rs.masonsHealUsed = state.perkRoundState.masonsHealUsed;
    for (const [k, v] of state.perkRoundState.ranksPlayed) {
      rs.ranksPlayed.set(k, v);
    }
  }
  return manager;
}

/** Serialize perk round state for saving */
function serializePerkRoundState(manager: PerkManager): CastleRun['perkRoundState'] {
  const rs = manager.getRoundState();
  return {
    heartHealUsed: rs.heartHealUsed,
    trinityBombs: rs.trinityBombs,
    ranksPlayed: Array.from(rs.ranksPlayed.entries()),
    fireArrows: rs.fireArrows,
    masonsElapsed: rs.masonsElapsed,
    masonsHealUsed: rs.masonsHealUsed,
  };
}
const clone = (state: CastleRun): CastleRun => ({
  ...state,
  runStats: state.runStats ? { ...state.runStats } : emptyCastleRunStats(),
  run: { ...state.run, player: { ...state.run.player } },
  progression: { ...state.progression, modules: [...state.progression.modules] },
  reserve: { ...state.reserve },
  siege: {
    ...state.siege,
    enemies: state.siege.enemies.map((e) => ({ ...e })),
    units: state.siege.units.map((u) => ({ ...u })),
  },
  perks: state.perks ? state.perks.map(p => ({ ...p })) : undefined,
  perkRoundState: state.perkRoundState ? { ...state.perkRoundState, ranksPlayed: [...state.perkRoundState.ranksPlayed] } : undefined,
});

function gainXp(state: CastleRun, amount: number, events: SiegeEvent[]) {
  const previous = state.progression.level;
  state.progression.xp += amount;
  state.progression.level = castleLevel(state.progression.xp);
  for (let level = previous + 1; level <= state.progression.level; level++) events.push({ type: 'level_up', level });
}
export function buyCastleModule(current: CastleRun, key: ModuleKey): SiegeResult {
  const module = MODULES.find((item) => item.id === key);
  if (current.run.phase !== 'battle' || !module || current.progression.level < module.level ||
    current.progression.modules.includes(key) || current.siege.coins < module.cost) return { state: current, events: [] };
  const state = clone(current);
  state.siege.coins -= module.cost;
  state.progression.modules.push(key);
  if (key === 'shieldSoldiers') for (const unit of state.siege.units.filter((u) => u.kind === 'soldier')) {
    unit.hp += 3; unit.maxHp += 3;
  }
  return { state, events: [{ type: 'module_bought', key, cost: module.cost }] };
}
export function activateCastleJoker(current: CastleRun, _color: 'red' | 'black'): SiegeResult {
  return { state: current, events: [] };
}
function killDead(state: CastleRun, events: SiegeEvent[]) {
  const dead = state.siege.enemies.filter((e) => e.hp <= 0);
  for (const enemy of dead) {
    state.siege.kills++;
    const coins = enemy.boss ? 5 : 1;
    state.siege.coins += coins;
    const stats = state.runStats ??= emptyCastleRunStats();
    stats.enemiesDefeated++;
    stats.bossesDefeated += enemy.boss ? 1 : 0;
    stats.goldEarned += coins;
    gainXp(state, enemy.boss ? CASTLE_XP.boss : CASTLE_XP.kill, events);
    events.push({ type: 'killed', enemy: { ...enemy }, coins });
  }
  state.siege.enemies = state.siege.enemies.filter((e) => e.hp > 0);
}
function laser(state: CastleRun, events: SiegeEvent[], final = false, charge = 1) {
  const perkManager = getPerkManager(state);
  const baseDamage = upgradeValue('laser', state.upgrades.laser) + perkManager.getLaserDamageBonus();
  const damage = Math.round(baseDamage * charge * perkManager.getDamageMultiplier());
  const burning = !final && state.progression.modules.includes('volatileLaser')
    ? state.siege.enemies.filter((enemy) => (enemy.burning ?? 0) > 0) : [];
  for (const enemy of state.siege.enemies) enemy.hp = final ? 0 : Math.max(0, enemy.hp - damage);
  for (const source of burning) {
    for (const target of state.siege.enemies) if (Math.abs(target.progress - source.progress) <= .12) target.hp -= 12;
    source.burning = 0;
    events.push({ type: 'detonation', enemy: source.id, damage: 12 });
  }
  events.push({ type: 'laser', damage, final });
  killDead(state, events);
  state.siege.laserCharge = 0;
}
function deploy(state: CastleRun, kind: UnitKind, events: SiegeEvent[], charge = 1) {
  const perkManager = getPerkManager(state);
  const stats = DEFENDER_STATS[kind];
  const baseDamage = kind === 'turret' || kind === 'soldier'
    ? stats.damage
    : kind === 'archer'
      ? upgradeValue('knight', state.upgrades.knight) + perkManager.getArcherDamageBonus()
      : upgradeValue('mortar', state.upgrades.mortar) + perkManager.getMortarDamageBonus();
  const damageMultiplier = perkManager.getDamageMultiplier();
  
  let soldierHp = state.progression.modules.includes('shieldSoldiers') ? 6 : 3;
  let soldierTtl = stats.ttl;
  if (kind === 'soldier') {
    soldierHp += perkManager.getSoldierHpBonus();
    soldierTtl += perkManager.getSoldierLifetimeBonus();
  }
  
  const turretAmmo = kind === 'turret' ? upgradeValue('magazine', state.upgrades.magazine) + perkManager.getTurretMagBonus() : stats.ammo;
  
  const unit: Defender = {
    id:
      kind === 'turret' || kind === 'mortar'
        ? (state.siege.units.find((u) => u.kind === kind)?.id ?? state.siege.nextId++)
        : state.siege.nextId++,
    kind,
    damage: Math.round(baseDamage * damageMultiplier * (kind === 'mortar' ? charge : 1)),
    heal: 0,
    cooldown: 0,
    engaged: false,
    hp: kind === 'soldier' ? soldierHp : kind === 'archer' ? 2 : 6,
    maxHp: kind === 'soldier' ? soldierHp : kind === 'archer' ? 2 : 6,
    progress: 0.94,
    ttl: kind === 'soldier' ? soldierTtl : stats.ttl,
    ammo: kind === 'turret' ? Math.round(turretAmmo * charge) : stats.ammo,
  };
  if (kind === 'turret') {
    const turret = state.siege.units.find((u) => u.kind === 'turret');
    if (turret) {
      const keepLeftover = perkManager.shouldKeepTurretLeftover();
      const newAmmo = keepLeftover ? turret.ammo + unit.ammo : unit.ammo;
      Object.assign(turret, unit, { cooldown: Math.max(0, turret.cooldown), ammo: newAmmo });
      events.push({ type: 'reload', id: turret.id, ammo: turret.ammo });
      return;
    }
  }
  if (kind === 'mortar') {
    const cannon = state.siege.units.find((u) => u.kind === 'mortar');
    if (cannon) {
      Object.assign(cannon, unit, { cooldown: Math.max(0, cannon.cooldown) });
      events.push({ type: 'deploy', kind, id: cannon.id });
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
export function playCastleCard(
  current: CastleRun,
  cardId: string,
  _config: GameConfig
): SiegeResult {
  if (current.run.phase !== 'battle') return { state: current, events: [] };
  const battle = current.run.battle!;
  const columnIndex = findCardColumn(battle.tableau, cardId);
  const card = columnIndex >= 0 ? battle.tableau[columnIndex].cards.at(-1) : undefined;
  if (!card || card.joker || !isCardExposed(battle.tableau, cardId) ||
    !canConnectInBattle(card, { ...battle, allowRankWrap: true }))
    return { state: current, events: [] };
  const state = clone(current);
  const perkManager = getPerkManager(state);
  const perkRng = new RNG(current.run.seed + ':perks:' + Date.now());
  const used = new Set(current.usedPowers ?? []);
  state.emptyDraws = 0;
  state.drawAssistAt = undefined;
  (state.runStats ??= emptyCastleRunStats()).cardsPlayed++;
  const configuredPower = getPowerType(battle.powerCards, cardId);
  const power = used.has(cardId) ? null : configuredPower === 'GUARD' || configuredPower === 'WILD' ? configuredPower : null;
  
  const linkBonus = perkManager.getLinkBonus(card, battle.activeCard, battle.chain.length);
  const chain = [...battle.chain, card];
  
  state.run = { ...current.run, battle: { ...battle, allowRankWrap: true,
    tableau: battle.tableau.map((column, index) => index === columnIndex ? { cards: column.cards.slice(0, -1) } : column),
    discard: battle.activeCard ? [...battle.discard, battle.activeCard] : battle.discard,
    activeCard: card, chain, castleJokerExit: undefined, wildActive: power === 'WILD',
    castleCritical: false,
    powerCards: battle.powerCards.map((item) => item.type === 'GOLD' ? { ...item, type: 'GUARD' } : item),
  } };
  const cardEvents: GameEvent[] = [{ type: 'card_played', card, chainPosition: chain.length, damage: 0 }];
  if (power) {
    cardEvents.push({ type: 'power_activated', powerType: power, card });
    if (power === 'WILD') cardEvents.push({ type: 'wild_activated' });
    used.add(cardId);
  }
  state.usedPowers = [...used];
  state.siege.started = true;
  const events: SiegeEvent[] = [{ type: 'card', chain: chain.length + linkBonus, events: cardEvents }];
  gainXp(state, CASTLE_XP.card, events);
  
  if (power === 'GUARD') {
    const rng = RNG.fromState(state.run.rngState);
    const amount = rng.next() < CASTLE_GUARD_REWARD.bonusChance ? CASTLE_GUARD_REWARD.bonus : CASTLE_GUARD_REWARD.normal;
    state.run = { ...state.run, rngState: rng.getState(), player: { ...state.run.player, armor: state.run.player.armor + amount } };
    events.push({ type: 'boost', effect: 'armor', amount });
  }

  // Perk: Suit effects
  if (!card.joker) {
    const suitEffects = perkManager.onSuitPlayed(card.suit);
    if (suitEffects.heal > 0) {
      const newHp = Math.min(state.run.player.maxHp, state.run.player.hp + suitEffects.heal);
      if (newHp > state.run.player.hp) {
        const healed = newHp - state.run.player.hp;
        state.run = { ...state.run, player: { ...state.run.player, hp: newHp } };
        events.push({ type: 'perk_heal', amount: healed });
      }
    }
    if (suitEffects.coins > 0) {
      state.siege.coins += suitEffects.coins;
      events.push({ type: 'perk_coins', amount: suitEffects.coins });
    }
    if (suitEffects.armor > 0) {
      const armorCap = perkManager.getArmorCap();
      const newArmor = Math.min(armorCap, state.run.player.armor + suitEffects.armor);
      if (newArmor > state.run.player.armor) {
        const added = newArmor - state.run.player.armor;
        state.run = { ...state.run, player: { ...state.run.player, armor: newArmor } };
        events.push({ type: 'perk_armor', amount: added });
      }
    }
    
    // Perk: Spade Salvo
    if (perkManager.shouldFireSalvo(card.suit) && state.siege.units.some(u => u.kind === 'mortar')) {
      const targets = perkManager.getSalvoTargets();
      const mortarDmg = DEFENDER_STATS.mortar.damage + perkManager.getMortarDamageBonus();
      const damage = Math.round(mortarDmg * perkManager.getDamageMultiplier());
      const hit = state.siege.enemies.filter(e => e.hp > 0).sort((a, b) => b.progress - a.progress).slice(0, targets);
      for (const enemy of hit) enemy.hp -= damage;
      if (hit.length > 0) events.push({ type: 'perk_salvo', damage, targets: hit.length });
      killDead(state, events);
    }
    
    // Perk: Rank effects (royal_court, ace_flare, lucky_seven, trinity)
    const rankEffects = perkManager.onRankPlayed(card.rank, perkRng);
    if (rankEffects.deployUnit) {
      deploy(state, rankEffects.deployUnit, events);
    }
    if (rankEffects.turretRounds > 0) {
      const turret = state.siege.units.find(u => u.kind === 'turret');
      if (turret) {
        turret.ammo += rankEffects.turretRounds;
        events.push({ type: 'reload', id: turret.id, ammo: turret.ammo });
      } else {
        deploy(state, 'turret', events, rankEffects.turretRounds / 10);
      }
    }
    if (rankEffects.laserDamage !== 0) {
      if (rankEffects.laserDamage === -1) {
        const baseLaser = upgradeValue('laser', state.upgrades.laser) + perkManager.getLaserDamageBonus();
        const damage = Math.round(baseLaser * perkManager.getDamageMultiplier());
        for (const enemy of state.siege.enemies) enemy.hp -= damage;
        events.push({ type: 'perk_laser', damage });
        killDead(state, events);
      } else {
        const damage = Math.round(rankEffects.laserDamage * perkManager.getDamageMultiplier());
        for (const enemy of state.siege.enemies) enemy.hp -= damage;
        events.push({ type: 'perk_laser', damage });
        killDead(state, events);
      }
    }
    if (rankEffects.coins > 0) {
      state.siege.coins += rankEffects.coins;
      events.push({ type: 'perk_coins', amount: rankEffects.coins });
    }
    if (rankEffects.armor > 0) {
      state.run = { ...state.run, player: { ...state.run.player, armor: state.run.player.armor + rankEffects.armor } };
      events.push({ type: 'perk_armor', amount: rankEffects.armor });
    }
    if (rankEffects.freeBomb) {
      const damage = 12;
      for (const enemy of state.siege.enemies) enemy.hp -= damage;
      events.push({ type: 'perk_bomb', damage });
      killDead(state, events);
    }
  }

  state.perkRoundState = serializePerkRoundState(perkManager);
  state.siege.laserCharge = chainRewardCounts(chain.length + linkBonus).laser;
  
  if (isTableauEmpty(state.run.battle!.tableau)) {
    laser(state, events, true);
    (state.runStats ??= emptyCastleRunStats()).roundsWon++;
    state.run = { ...state.run, phase: 'victory' };
    events.push({ type: 'ended', victory: true });
  }
  return { state, events };
}
/** A separate seeded stream keeps assistance rolls independent of the pack order. */
function drawAssistRoll(current: CastleRun) {
  const rng = current.drawAssistRngState === undefined
    ? new RNG(current.run.seed + ':stock-assist') : RNG.fromState(current.drawAssistRngState);
  const at = current.drawAssistAt ?? rng.nextInt(MIN_ASSIST_DRAW, MAX_ASSIST_DRAW);
  return { at, rngState: rng.getState() };
}
/** Extract at most one card; every other stock card keeps its relative order. */
function castleDrawIndex(current: CastleRun, deck: readonly Card[]): number {
  const battle = current.run.battle!;
  const opensMove = (candidate: Card, card: Card) => canConnectInBattle(card, {
    ...battle, activeCard: candidate, wildActive: false, castleJokerExit: undefined, allowRankWrap: true,
  });
  const columns = battle.tableau.filter(column => column.cards.length);
  if ((current.emptyDraws ?? 0) + 1 < drawAssistRoll(current).at || !deck.length ||
    columns.some(column => canConnectInBattle(column.cards.at(-1)!, battle)) ||
    columns.some(column => opensMove(deck[0], column.cards.at(-1)!))) return 0;
  for (const column of [...columns].sort((a, b) => b.cards.length - a.cards.length)) {
    const index = deck.findIndex(candidate => opensMove(candidate, column.cards.at(-1)!));
    if (index >= 0) return index;
  }
  return 0;
}
/** Preview uses the same draw selection and a cloned RNG without changing state. */
export function nextCastleCard(current: CastleRun) {
  const battle = current.run.battle;
  if (!battle) return undefined;
  const deck = battle.deck.length ? battle.deck : RNG.fromState(current.run.rngState).shuffle(battle.discard);
  return deck[castleDrawIndex(current, deck)];
}
export function useCastleAbility(current: CastleRun, ability: CastleAbility, config: GameConfig): SiegeResult {
  if (current.run.phase !== 'battle' || (current.abilitiesUsed ?? []).includes(ability) ||
    current.siege.coins < CASTLE_ABILITIES[ability].cost ||
    (ability === 'HEAL' && current.run.player.hp >= current.run.player.maxHp) ||
    (ability === 'BOMB' && !current.siege.enemies.length) ||
    (ability === 'ECHO' && !current.run.battle!.chain.length)) return { state: current, events: [] };
  const state = clone(current);
  state.siege.coins -= CASTLE_ABILITIES[ability].cost;
  state.abilitiesUsed = [...(current.abilitiesUsed ?? []), ability];
  const events: SiegeEvent[] = [{ type: 'ability', ability }];
  if (ability === 'HEAL') {
    const hp = Math.min(state.run.player.maxHp, state.run.player.hp + config.powerCards.HEAL.healAmount);
    events.push({ type: 'boost', effect: 'heal', amount: hp - state.run.player.hp });
    state.run = { ...state.run, player: { ...state.run.player, hp } };
  } else if (ability === 'BOMB') {
    for (const enemy of state.siege.enemies) enemy.hp -= config.powerCards.BOMB.flatDamage;
    killDead(state, events);
  } else {
    const battle = state.run.battle!;
    const chain = [...battle.chain, ...Array.from({ length: config.powerCards.ECHO.comboBonus }, () => battle.activeCard!)];
    state.run = { ...state.run, battle: { ...battle, chain } };
    state.siege.laserCharge = chainRewardCounts(chain.length).laser;
  }
  return { state, events };
}
export function drawCastleCard(current: CastleRun, _config: GameConfig): SiegeResult {
  if (current.run.phase !== 'battle') return { state: current, events: [] };
  const state = clone(current);
  const events: SiegeEvent[] = [];
  const perkManager = getPerkManager(state);
  const chain = state.run.battle?.chain.length ?? 0;
  const chainEndBonus = perkManager.getChainEndBonus(chain);
  const bloodPriceCost = perkManager.getShortChainDrawCost(chain);
  if (bloodPriceCost > 0) {
    state.run = { ...state.run, player: { ...state.run.player, hp: state.run.player.hp - bloodPriceCost } };
  }
  const effectiveChain = chain + chainEndBonus;
  const rewards = chainRewardCounts(effectiveChain);
  // Release all reached rewards once, before drawing resets joker/chain effects.
  for (let i = 0; i < rewards.soldier * upgradeValue('soldier', state.upgrades.soldier); i++)
    deploy(state, 'soldier', events);
  for (let i = 0; i < rewards.archer; i++) deploy(state, 'archer', events);
  if (rewards.turret) deploy(state, 'turret', events, rewards.turret);
  if (rewards.mortar) deploy(state, 'mortar', events, rewards.mortar);
  if (rewards.laser) laser(state, events, false, rewards.laser);
  let run = state.run;
  const recycled = !!run.battle && run.battle.deck.length === 0 && run.battle.discard.length > 0;
  if (recycled && run.battle) {
    const tableauIds = new Set(run.battle.tableau.flatMap(column => column.cards.map(card => card.id)));
    const rng = RNG.fromState(run.rngState);
    run = {
      ...run,
      rngState: rng.getState(),
      battle: { ...run.battle, deck: rng.shuffle(run.battle.discard), discard: [] },
    };
    run = { ...run, rngState: rng.getState() };
    // Unplayed cards on the field retain their powers; recycled waste loses them.
    run = { ...run, battle: { ...run.battle!,
      powerCards: run.battle!.powerCards.filter(power => tableauIds.has(power.cardId)), wildActive: false,
      castleCritical: false, jokerMultiplier: 1, lifestealMultiplier: 0, castleJokerExit: undefined } };
    state.usedPowers = (state.usedPowers ?? []).filter(id => tableauIds.has(id));
    run = { ...run, player: { ...run.player, hp: Math.max(0, run.player.hp - CASTLE_RECYCLE_HP_COST) } };
  }
  const battle = run.battle!;
  const deck = [...battle.deck];
  const assist = drawAssistRoll(current);
  const [drawn] = deck.splice(castleDrawIndex(current, deck), 1);
  const activeCard = drawn ?? battle.activeCard;
  const discard = activeCard !== battle.activeCard && battle.activeCard ? [...battle.discard, battle.activeCard] : battle.discard;
  state.run = { ...run, battle: { ...battle, deck, activeCard, discard, chain: [], accumulatedDamage: 0,
    chainBaseDamage: 0, jokerMultiplier: 1, lifestealMultiplier: 0, castleJokerExit: undefined,
    castleCritical: false,
    wildActive: false, isFirstChain: false, turnNumber: battle.turnNumber + 1 } };
  const nextBattle = state.run.battle!;
  const playable = nextBattle.tableau.some(column => column.cards.length &&
    canConnectInBattle(column.cards.at(-1)!, nextBattle));
  state.emptyDraws = playable ? 0 : Math.min(MAX_ASSIST_DRAW - 1, (current.emptyDraws ?? 0) + (drawn ? 1 : 0));
  state.drawAssistAt = playable ? undefined : assist.at;
  state.drawAssistRngState = assist.rngState;
  state.siege.started = true;
  state.siege.laserCharge = 0;
  events.push({ type: 'draw', recycled });
  if (state.run.player.hp <= 0) {
    state.run = { ...state.run, phase: 'defeat' };
    events.push({ type: 'ended', victory: false });
  }
  return { state, events };
}

/** Fixed-step simulation. UI does not call this while paused or hidden. */
export function stepSiege(current: CastleRun): SiegeResult {
  if (current.run.phase !== 'battle' || !current.siege.started)
    return { state: current, events: [] };
  const state = clone(current),
    siege = state.siege,
    events: SiegeEvent[] = [];
  const perkManager = getPerkManager(state);
  const difficulty = siegeDifficulty(state.siegeNumber);
  siege.elapsed += STEP;
  
  // Perk: Masons castle regen
  const masonsHeal = perkManager.tickMasons(STEP, state.run.player.hp, state.run.player.maxHp);
  if (masonsHeal > 0) {
    state.run = { ...state.run, player: { ...state.run.player, hp: state.run.player.hp + masonsHeal } };
    events.push({ type: 'perk_heal', amount: masonsHeal });
    state.perkRoundState = serializePerkRoundState(perkManager);
  }
  (state.runStats ??= emptyCastleRunStats()).seconds += STEP;
  siege.spawnIn -= STEP;
  if (siege.spawnIn <= 0) {
    const level = Math.floor(siege.elapsed / 30);
    const size = SIEGE_PACING.groupSize * Math.max(1, state.siegeNumber);
    const rng = RNG.fromState(siege.rngState);
    for (let i = 0; i < size && siege.enemies.length < SIEGE_PACING.maxEnemies; i++) {
      siege.spawned++;
      const boss = siege.spawned % SIEGE_PACING.bossEvery === 0;
      const hp = Math.ceil(
        (boss ? 100 + level * 20 : SIEGE_PACING.enemyHp + level * SIEGE_PACING.hpGrowth) *
          difficulty.hp
      );
      const sprites = boss ? ['c_ogre', 'c_reaper1'] : ['c_orc', 'c_goblin', 'c_reaper2'];
      const baseSpeed = ((boss ? 0.025 : 0.032) + rng.next() * 0.006) * difficulty.speed;
      const enemy: Invader = {
        id: siege.nextId++,
        sprite: rng.pickOne(sprites),
        boss,
        hp,
        maxHp: hp,
        // World coordinates occupy 78% of the screen; ports span screen x=10–50%.
        progress: (0.1 + rng.next() * 0.4) / 0.78,
        speed: baseSpeed * perkManager.getEnemySpeedMultiplier(boss),
        damage: boss ? 4 : 1 + Math.floor(level / 2),
        cooldown: 0,
      };
      siege.enemies.push(enemy);
      events.push({ type: 'spawn', enemy: { ...enemy } });
    }
    siege.rngState = rng.getState();
    siege.spawnIn = SIEGE_PACING.interval;
  }
  for (const enemy of siege.enemies) if ((enemy.burning ?? 0) > 0) {
    enemy.hp -= (enemy.burnDamage ?? 2) * Math.min(STEP, enemy.burning!);
    enemy.burning = Math.max(0, enemy.burning! - STEP);
  }
  killDead(state, events);
  for (const unit of siege.units) {
    if (unit.engaged && unit.kind !== 'turret' && unit.kind !== 'mortar') unit.ttl -= STEP;
    unit.cooldown -= STEP;
    const mobile = unit.kind === 'soldier';
    if (mobile) unit.progress = Math.max(SOLDIER_HOLD_PROGRESS, unit.progress);
    const nearby = siege.enemies.some(
      (e) => e.hp > 0 && Math.abs(e.progress - unit.progress) <= MELEE_RANGE
    );
    if (mobile && nearby) unit.engaged = true;
    if (soldierIsMarching(unit, siege.enemies))
      unit.progress = Math.max(SOLDIER_HOLD_PROGRESS, unit.progress - 0.065 * STEP);
    if (unit.hp <= 0 || unit.ttl <= 0 || unit.ammo <= 0 || unit.cooldown > 0) continue;
    const stats = DEFENDER_STATS[unit.kind];
    const range = stats.range;
    const targets = siege.enemies
      .filter(
        (e) =>
          e.hp > 0 && (mobile ? Math.abs(e.progress - unit.progress) <= MELEE_RANGE : e.progress >= range)
      )
      .sort((a, b) => b.progress - a.progress);
    if (!targets.length) continue;
    const interval = unit.kind === 'archer' 
      ? stats.interval * perkManager.getArcherSpeedMultiplier()
      : stats.interval;
    unit.cooldown = interval;
    unit.ammo--;
    unit.engaged = true;
    const mortarTargets = perkManager.getMortarTargets();
    const hit = unit.kind === 'mortar' ? targets.slice(0, mortarTargets) : targets.slice(0, 1);
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
      // Fire from module or heartfire perk
      const moduleFireArrows = state.progression.modules.includes('fireArrows');
      const perkFireArrows = unit.kind === 'archer' && perkManager.consumeFireArrow();
      const fire = (unit.kind === 'archer' && moduleFireArrows) || perkFireArrows;
      if (fire) { target.burning = 4; target.burnDamage = 2; }
      events.push({ type: 'shot', kind: unit.kind, unit: unit.id, target: target.id, damage, ...(fire ? { fire: true } : {}) });
    }
    if (unit.kind === 'archer' && perkManager.consumeFireArrow()) {
      state.perkRoundState = serializePerkRoundState(perkManager);
    }
  }
  killDead(state, events);
  for (const unit of siege.units) {
    if (unit.kind !== 'turret' && unit.kind !== 'mortar' && (unit.ttl <= 0 || unit.ammo <= 0))
      events.push({ type: 'unit_killed', unit: { ...unit } });
  }
  siege.units = siege.units.filter(
    (u) => u.hp > 0 && (u.kind === 'turret' || u.kind === 'mortar' || (u.ttl > 0 && u.ammo > 0))
  );
  for (const enemy of siege.enemies) {
    const opponent = siege.units.find(
      (u) =>
        u.hp > 0 &&
        u.kind === 'soldier' &&
        Math.abs(u.progress - enemy.progress) <= MELEE_RANGE
    );
    enemy.cooldown -= STEP;
    if (opponent) {
      opponent.engaged = true;
      if (enemy.cooldown <= 0) {
        enemy.cooldown = 1;
        events.push({ type: 'melee', enemy: enemy.id, unit: opponent.id });
        opponent.hp = Math.max(0, opponent.hp - enemy.damage);
        if (opponent.hp === 0) events.push({ type: 'unit_killed', unit: { ...opponent } });
      }
      continue;
    }
    enemy.progress = Math.min(0.94, enemy.progress + enemy.speed * STEP);
    if (enemy.progress >= 0.94 && enemy.cooldown <= 0) {
      enemy.cooldown = enemy.boss ? 3 : 3.5;
      const blocked = enemy.boss ? 0 : Math.min(state.run.player.armor, enemy.damage);
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
  state.siege.coins;
