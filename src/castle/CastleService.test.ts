import { describe, expect, it } from 'vitest';
import { CastleService } from './CastleService';
import {
  createCastleRun,
  drawCastleCard,
  emptyUpgrades,
  stepSiege,
  SIEGE_PACING,
  CASTLE_RECYCLE_HP_COST,
} from './CastleDefense';
import { config, memoryStorage } from '../test/fixtures';
import type { Card } from '../core/types';

const KEY = 'golf-castle-run-v1';
const initial = () => createCastleRun('manual-reserve', config, emptyUpgrades());
const joker = (color: 'red' | 'black'): Card => ({
  id: `joker-${color}`,
  rank: 0,
  joker: color,
  suit: color === 'red' ? 'hearts' : 'spades',
});
describe('castle saves and retired-resource migration', () => {
  it('round trips a complete capped horde and preserves its next-wave timer', () => {
    const service = new CastleService(memoryStorage());
    let state = createCastleRun('horde-save', config, emptyUpgrades(), 'horde', 60);
    state = stepSiege(drawCastleCard(state, config).state).state;
    expect(state.siege.enemies).toHaveLength(SIEGE_PACING.maxEnemies);
    expect(state.siege.enemies.filter((enemy) => enemy.boss)).toHaveLength(15);
    expect(
      state.siege.enemies.every((enemy) => enemy.progress >= 0 && enemy.progress <= 0.94)
    ).toBe(true);
    expect(service.save(state)).toBe(true);
    expect(service.load()).toEqual(state);
    expect(stepSiege(service.load()!)).toEqual(stepSiege(state));
  });
  it('persists HP charged by a reshuffle and keeps the shuffled pack intact on reload', () => {
    const service = new CastleService(memoryStorage()),
      state = initial(),
      battle = state.run.battle!;
    state.run = { ...state.run, battle: { ...battle, deck: [], discard: battle.deck } };
    const recycled = drawCastleCard(state, config).state;
    expect(recycled.run.player.hp).toBe(state.run.player.hp - CASTLE_RECYCLE_HP_COST);
    expect(service.save(recycled)).toBe(true);
    expect(service.load()).toEqual(recycled);
  });
  it('round trips the 52-card board, ability usage, undo quota and purchased modules', () => {
    const storage = memoryStorage();
    const service = new CastleService(storage);
    const state = initial();
    state.progression = { xp: 20, level: 3, modules: ['fireArrows'] };
    state.abilitiesUsed = ['HEAL'];
    state.undoRemaining = 1;
    service.save(state);
    expect(service.load()).toEqual(state);
  });
  it.each([
    ['balanceVersion', 99],
    ['inheritedCoins', -1],
    ['inheritedCoins', '30'],
    ['undoRemaining', -1],
    ['undoRemaining', 4],
    ['undoRemaining', 1.5],
    ['undoRemaining', null],
    ['emptyDraws', -1],
    ['emptyDraws', 7],
    ['emptyDraws', 1.5],
    ['emptyDraws', '6'],
    ['drawAssistAt', 2],
    ['drawAssistAt', 8],
    ['drawAssistAt', 3.5],
    ['drawAssistAt', '3'],
    ['drawAssistRngState', -1],
    ['drawAssistRngState', 0x100000000],
    ['drawAssistRngState', 1.5],
    ['abilitiesUsed', ['HEAL', 'HEAL']],
    ['abilitiesUsed', ['CRIT']],
    ['abilitiesUsed', [['HEAL']]],
    ['abilitiesUsed', null],
    ['reserve', { red: -1, black: 1 }],
    ['reserve', { red: 2, black: 1 }],
    ['reserve', { red: '1', black: 1 }],
    ['progression', { xp: 20, level: 5, modules: [] }],
    ['progression', { xp: 20, level: 3, modules: ['unknown'] }],
    ['progression', { xp: 20, level: 3, modules: ['fireArrows', 'fireArrows'] }],
    ['progression', { xp: 0, level: 1, modules: ['volatileLaser'] }],
  ])('rejects malformed current %s', (field, value) => {
    const storage = memoryStorage();
    const state = { ...initial(), [field]: value };
    storage.setItem(KEY, JSON.stringify(state));
    expect(new CastleService(storage).load()).toBeNull();
  });
  it('removes unused legacy jokers and drops obsolete undo history', () => {
    const storage = memoryStorage();
    const state = initial();
    const legacy = {
      ...state,
      balanceVersion: 2,
      reserve: undefined,
      progression: undefined,
      undoHistory: { cost: 0, entries: [{ cost: 0, state }] },
    };
    legacy.run = {
      ...state.run,
      battle: {
        ...state.run.battle!,
        deck: [...state.run.battle!.deck, joker('red')],
        tableau: state.run.battle!.tableau.map((column, i) =>
          i === 0 ? { cards: [...column.cards.slice(0, -1), joker('black')] } : column
        ),
        // Preserve the regular card displaced by the joker below.
      },
    };
    legacy.run.battle!.deck.push(state.run.battle!.tableau[0].cards.at(-1)!);
    storage.setItem(KEY, JSON.stringify(legacy));
    const service = new CastleService(storage);
    const restored = service.load()!;
    expect(restored.balanceVersion).toBe(3);
    expect(restored.reserve).toEqual({ red: 0, black: 0 });
    expect(restored.progression).toEqual({ xp: 0, level: 1, modules: [] });
    expect(restored.run.battle!.tableau[0].cards).toHaveLength(
      state.run.battle!.tableau[0].cards.length - 1
    );
    expect(restored.run.battle!.deck.every((card) => !card.joker)).toBe(true);
    expect(service.loadUndoHistory(restored).entries).toHaveLength(0);
  });
  it('does not restore a consumed legacy joker from discard or active card', () => {
    const storage = memoryStorage();
    const state = initial();
    const legacy = { ...state, balanceVersion: 2, reserve: undefined, progression: undefined };
    legacy.run = {
      ...state.run,
      battle: {
        ...state.run.battle!,
        activeCard: joker('red'),
        discard: [state.run.battle!.activeCard!, joker('black')],
        chain: [joker('black')],
      },
    };
    storage.setItem(KEY, JSON.stringify(legacy));
    const restored = new CastleService(storage).load()!;
    expect(restored.reserve).toEqual({ red: 0, black: 0 });
    expect(restored.run.battle!.activeCard!.joker).toBeUndefined();
    expect(restored.run.battle!.castleJokerExit).toBeUndefined();
    expect(restored.run.battle!.chain).toHaveLength(0);
  });
  it('keeps multiple turret magazines intact when reopening current saves', () => {
    const storage = memoryStorage();
    const state = initial();
    state.progression = { xp: 20, level: 3, modules: [] };
    state.siege.units = [
      {
        id: 10,
        kind: 'turret',
        damage: 2,
        heal: 0,
        cooldown: 0,
        ttl: 600,
        ammo: 30,
        engaged: false,
        hp: 6,
        maxHp: 6,
        progress: 0.94,
      },
    ];
    const service = new CastleService(storage);
    service.save(state);
    expect(service.load()!.siege.units[0].ammo).toBe(30);
  });
  it('rejects malformed saved burn effects instead of poisoning enemy health', () => {
    const storage = memoryStorage();
    const state = initial();
    state.siege.enemies = [
      {
        id: 1,
        sprite: 'c_orc',
        boss: false,
        hp: 6,
        maxHp: 6,
        progress: 0.5,
        speed: 0.1,
        damage: 1,
        cooldown: 1,
      },
    ];
    const invalid = JSON.parse(JSON.stringify(state));
    invalid.siege.enemies[0].burnDamage = '2';
    storage.setItem(KEY, JSON.stringify(invalid));
    expect(new CastleService(storage).load()).toBeNull();
  });
  it('removes a legacy CRIT already banked in the current chain', () => {
    const storage = memoryStorage();
    const state = initial();
    const active = state.run.battle!.activeCard!;
    const legacy = { ...state, balanceVersion: 2, reserve: undefined, progression: undefined };
    legacy.run = {
      ...state.run,
      battle: {
        ...state.run.battle!,
        chain: [active],
        powerCards: [{ cardId: active.id, type: 'CRIT' as const }],
      },
    };
    storage.setItem(KEY, JSON.stringify(legacy));
    const restored = new CastleService(storage).load()!;
    expect(restored.run.battle!.castleCritical).toBeFalsy();
    expect(restored.run.battle!.powerCards).toEqual([]);
    const ordinary = structuredClone(restored);
    ordinary.run = { ...ordinary.run, battle: { ...ordinary.run.battle!, castleCritical: false } };
    const charged = drawCastleCard(restored, config).state.siege.units[0].damage;
    const base = drawCastleCard(ordinary, config).state.siege.units[0].damage;
    expect(charged).toBe(base);
  });
  it('merges mounted legacy cannons using damage first and ammo as the tie breaker', () => {
    const storage = memoryStorage();
    const state = initial();
    const cannon = {
      id: 1,
      kind: 'mortar' as const,
      damage: 9,
      heal: 0,
      cooldown: 0,
      ttl: 45,
      ammo: 12,
      engaged: false,
      hp: 6,
      maxHp: 6,
      progress: 0.94,
    };
    state.siege.units = [
      cannon,
      { ...cannon, id: 2, damage: 18, ammo: 2 },
      { ...cannon, id: 3, damage: 18, ammo: 4 },
    ];
    storage.setItem(
      KEY,
      JSON.stringify({ ...state, balanceVersion: 2, reserve: undefined, progression: undefined })
    );
    const restored = new CastleService(storage).load()!;
    expect(restored.siege.units).toHaveLength(1);
    expect(restored.siege.units[0]).toMatchObject({ id: 3, damage: 18, ammo: 4 });
    expect(restored.progression.level).toBe(4);
  });
  it('migrates retired current-save powers without losing cards or paid ability usage', () => {
    const storage = memoryStorage(),
      service = new CastleService(storage);
    const state = initial(),
      battle = state.run.battle!;
    const cards = battle.tableau.flatMap((column) => column.cards);
    state.abilitiesUsed = ['ECHO'];
    state.undoRemaining = 1;
    state.reserve = { red: 1, black: 1 };
    state.run = {
      ...state.run,
      battle: {
        ...battle,
        powerCards: [
          { cardId: cards[0].id, type: 'WILD' },
          { cardId: cards[1].id, type: 'WILD' },
          { cardId: cards[2].id, type: 'GUARD' },
          { cardId: cards[3].id, type: 'CRIT' },
          { cardId: cards[4].id, type: 'HEAL' },
          { cardId: cards[5].id, type: 'BOMB' },
          { cardId: cards[6].id, type: 'ECHO' },
        ],
        jokerMultiplier: 5,
        lifestealMultiplier: 5,
        castleCritical: true,
        castleJokerExit: 'black',
      },
    };
    service.save(state, { cost: 0, entries: [{ cost: 0, state: initial() }] });
    const restored = service.load()!;
    expect(restored.run.battle!.tableau).toEqual(battle.tableau);
    expect(restored.run.battle!.deck).toEqual(battle.deck);
    expect(restored.run.battle!.activeCard).toEqual(battle.activeCard);
    expect(restored.run.battle!.powerCards).toEqual([
      { cardId: cards[0].id, type: 'WILD' },
      { cardId: cards[2].id, type: 'GUARD' },
    ]);
    expect(restored.run.battle!.jokerMultiplier).toBe(1);
    expect(restored.run.battle!.lifestealMultiplier).toBe(0);
    expect(restored.run.battle!.castleCritical).toBe(false);
    expect(restored.run.battle!.castleJokerExit).toBeUndefined();
    expect(restored.reserve).toEqual({ red: 0, black: 0 });
    expect(restored.abilitiesUsed).toEqual(['ECHO']);
    expect(restored.undoRemaining).toBe(1);
    expect(service.loadUndoHistory(restored)).toEqual({ cost: 0, entries: [] });
  });
  it('defaults old saves to three undos and removes their obsolete HP-cost history', () => {
    const storage = memoryStorage(),
      service = new CastleService(storage);
    const state = initial();
    const old = {
      ...state,
      abilitiesUsed: undefined,
      undoRemaining: undefined,
      undoHistory: { cost: 1, entries: [{ cost: 0, state }] },
    };
    storage.setItem(KEY, JSON.stringify(old));
    const restored = service.load()!;
    expect(restored.undoRemaining).toBe(3);
    expect(restored.abilitiesUsed).toEqual([]);
    expect(service.loadUndoHistory(restored)).toEqual({ cost: 0, entries: [] });
  });
  it('restores undo snapshots from before an ability purchase', () => {
    const storage = memoryStorage(),
      service = new CastleService(storage),
      state = initial();
    state.abilitiesUsed = ['HEAL'];
    service.save(state, { cost: 0, entries: [{ cost: 0, state: initial() }] });
    const history = service.loadUndoHistory(service.load()!);
    expect(history.entries).toHaveLength(1);
    expect(history.entries[0].state.abilitiesUsed).toEqual([]);
  });
  it('caps migrated GUARD cards at two without removing already earned armor', () => {
    const service = new CastleService(memoryStorage()),
      state = initial();
    state.run = { ...state.run, player: { ...state.run.player, armor: 33 } };
    const cards = state.run.battle!.tableau.flatMap((column) => column.cards);
    state.run = {
      ...state.run,
      battle: {
        ...state.run.battle!,
        powerCards: cards.slice(0, 6).map((card) => ({ cardId: card.id, type: 'GUARD' })),
      },
    };
    service.save(state, { cost: 0, entries: [{ cost: 0, state: initial() }] });
    const restored = service.load()!;
    expect(restored.run.player.armor).toBe(33);
    expect(restored.run.battle!.powerCards).toEqual(state.run.battle!.powerCards.slice(0, 2));
    expect(service.loadUndoHistory(restored).entries).toEqual([]);
  });
});

describe('one-time round continuation', () => {
  it('consumes a victorious snapshot once and never returns it from later starts', () => {
    const service = new CastleService(memoryStorage()),
      state = initial();
    service.beginSiege();
    state.siege.coins = 80;
    state.run = {
      ...state.run,
      phase: 'victory',
      player: { ...state.run.player, hp: 17, armor: 9 },
    };
    expect(service.settle(state)).toBe(true);
    expect(service.settle(state)).toBe(true);
    expect(service.readMeta().coins).toBe(80);
    const next = service.beginSiege();
    expect(next.currentStreak).toBe(2);
    expect(next.carryover).toEqual({
      sourceSiege: state.id,
      siegeNumber: 1,
      coins: 80,
      hp: 17,
      maxHp: 40,
      armor: 9,
      stats: state.runStats,
    });
    expect(service.readMeta().continuation).toBeUndefined();
    expect(service.beginSiege().carryover).toBeUndefined();
    expect(service.settle(state)).toBe(true);
    expect(service.readMeta().continuation).toBeUndefined();
    expect(service.readMeta().coins).toBe(80);
  });
  it('credits only new net gold when a round inherits an earlier balance', () => {
    const service = new CastleService(memoryStorage()),
      state = initial();
    state.inheritedCoins = 100;
    state.siege.coins = 125;
    state.run = { ...state.run, phase: 'victory' };
    service.settle(state);
    expect(service.readMeta().coins).toBe(25);
    expect(service.readMeta().continuation!.coins).toBe(125);
    service.settle(state);
    expect(service.readMeta().coins).toBe(25);
  });
  it('does not reduce the separate wallet when inherited gold was spent', () => {
    const service = new CastleService(memoryStorage()),
      state = initial();
    state.inheritedCoins = 100;
    state.siege.coins = 70;
    state.run = { ...state.run, phase: 'victory' };
    service.settle(state);
    expect(service.readMeta().coins).toBe(0);
    expect(service.readMeta().continuation!.coins).toBe(70);
  });
  it('loads an old wallet without requiring a continuation snapshot', () => {
    const storage = memoryStorage();
    storage.setItem(
      'golf-castle-meta-v1',
      JSON.stringify({
        version: 1,
        coins: 50,
        upgrades: emptyUpgrades(),
        claimed: ['old'],
        bestKills: 4,
        victories: 1,
      })
    );
    const service = new CastleService(storage);
    expect(service.readMeta()).toMatchObject({ coins: 50, bestKills: 4, victories: 1 });
    expect(service.beginSiege().carryover).toBeUndefined();
    expect(service.readMeta().coins).toBe(50);
  });
  it.each([
    { sourceSiege: 'claimed', siegeNumber: 1, coins: -1, hp: 10, maxHp: 40, armor: 0 },
    { sourceSiege: 'claimed', siegeNumber: 1, coins: 10, hp: 0, maxHp: 40, armor: 0 },
    { sourceSiege: 'claimed', siegeNumber: 1, coins: 10, hp: 41, maxHp: 40, armor: 0 },
    { sourceSiege: 'claimed', siegeNumber: 1, coins: 10, hp: 10, maxHp: 40, armor: '8' },
    { sourceSiege: 'unknown', siegeNumber: 1, coins: 10, hp: 10, maxHp: 40, armor: 0 },
    { sourceSiege: 'claimed', siegeNumber: 8, coins: 10, hp: 10, maxHp: 40, armor: 0 },
  ])('ignores malformed or stale continuation %j while keeping the wallet', (continuation) => {
    const storage = memoryStorage(),
      service = new CastleService(storage);
    storage.setItem(
      'golf-castle-meta-v1',
      JSON.stringify({
        ...service.readMeta(),
        coins: 50,
        currentStreak: 1,
        claimed: ['claimed'],
        continuation,
      })
    );
    expect(service.beginSiege().carryover).toBeUndefined();
    expect(service.readMeta().coins).toBe(50);
  });
  it('preserves cumulative statistics in a one-time victory continuation', () => {
    const service = new CastleService(memoryStorage()),
      state = initial();
    state.run = { ...state.run, phase: 'victory' };
    state.runStats = {
      roundsWon: 3,
      enemiesDefeated: 57,
      bossesDefeated: 2,
      cardsPlayed: 74,
      seconds: 125.75,
      goldEarned: 108,
    };
    service.settle(state);
    expect(service.readMeta().continuation!.stats).toEqual(state.runStats);
    const next = service.beginSiege();
    expect(next.carryover!.stats).toEqual(state.runStats);
    state.runStats.enemiesDefeated++;
    expect(next.carryover!.stats!.enemiesDefeated).toBe(57);
    expect(service.beginSiege().carryover).toBeUndefined();
  });
});

describe('castle rank-policy migration', () => {
  it.each([undefined, true])(
    'loads legacy wrap=%s as linear ranks without replacing the board',
    (allowRankWrap) => {
      const storage = memoryStorage(),
        service = new CastleService(storage),
        state = initial(),
        battle = state.run.battle!;
      state.run = { ...state.run, battle: { ...battle, allowRankWrap } };
      storage.setItem(KEY, JSON.stringify(state));
      const loaded = service.load()!;
      expect(loaded.run.battle!.allowRankWrap).toBe(false);
      expect(loaded.run.battle!.tableau).toEqual(battle.tableau);
      expect(loaded.run.battle!.deck).toEqual(battle.deck);
      expect(loaded.run.battle!.activeCard).toEqual(battle.activeCard);
      expect(loaded.run.player).toEqual(state.run.player);
      expect(loaded.run.rngState).toBe(state.run.rngState);
    }
  );
  it('normalizes current and undo snapshot flags when saving without changing the caller state', () => {
    const storage = memoryStorage(),
      service = new CastleService(storage),
      state = initial();
    state.run = { ...state.run, battle: { ...state.run.battle!, allowRankWrap: true } };
    const before = structuredClone(state);
    service.save(state, { cost: 0, entries: [{ cost: 0, state }] });
    const saved = JSON.parse(storage.getItem(KEY)!);
    expect(saved.run.battle.allowRankWrap).toBe(false);
    expect(saved.undoHistory.entries[0].state.run.battle.allowRankWrap).toBe(false);
    expect(state).toEqual(before);
    // Even a history written by the previous app is normalized during loading.
    saved.run.battle.allowRankWrap = true;
    saved.undoHistory.entries[0].state.run.battle.allowRankWrap = true;
    storage.setItem(KEY, JSON.stringify(saved));
    const loaded = service.load()!;
    expect(loaded.run.battle!.allowRankWrap).toBe(false);
    const history = service.loadUndoHistory(loaded);
    expect(history.entries).toHaveLength(1);
    expect(history.entries[0].state.run.battle!.allowRankWrap).toBe(false);
  });
});

describe('saved run statistics', () => {
  it('preserves an existing four-row board and its resources when resuming', () => {
    const storage = memoryStorage(),
      service = new CastleService(storage),
      state = initial();
    const battle = state.run.battle!;
    const extra = battle.tableau.flatMap((column) => column.cards.slice(4));
    state.run = {
      ...state.run,
      player: { ...state.run.player, hp: 17, armor: 9 },
      battle: {
        ...battle,
        tableau: battle.tableau.map((column) => ({ cards: column.cards.slice(0, 4) })),
        deck: [...battle.deck, ...extra],
      },
    };
    state.siege.coins = 75;
    state.progression = { xp: 20, level: 3, modules: [] };
    storage.setItem(KEY, JSON.stringify(state));
    const loaded = service.load()!;
    expect(loaded).toEqual(state);
    expect(loaded.run.battle!.tableau.map((column) => column.cards.length)).toEqual([
      4, 4, 4, 4, 4, 4, 4,
    ]);
    expect(loaded.run.battle!.deck).toHaveLength(23);
    expect(loaded.run.player).toMatchObject({ hp: 17, armor: 9 });
    expect(loaded.siege.coins).toBe(75);
  });
  it('reconstructs available legacy statistics without losing the physical pack', () => {
    const storage = memoryStorage(),
      service = new CastleService(storage),
      state = initial();
    // This fixture is a legacy four-row save, independent of the current deal.
    const current = state.run.battle!;
    const fifthRow = current.tableau.flatMap((column) => column.cards.slice(4));
    const battle = {
      ...current,
      tableau: current.tableau.map((column) => ({ cards: column.cards.slice(0, 4) })),
      deck: [...current.deck, ...fifthRow],
    };
    const removed = battle.tableau[0].cards.slice(-2);
    const legacy = {
      ...state,
      runStats: undefined,
      siegeNumber: 3,
      inheritedCoins: 20,
      siege: { ...state.siege, kills: 9, elapsed: 12.75, coins: 35 },
      run: {
        ...state.run,
        phase: 'victory',
        battle: {
          ...battle,
          tableau: battle.tableau.map((column, i) =>
            i === 0 ? { cards: column.cards.slice(0, -2) } : column
          ),
          deck: [...battle.deck, ...removed],
        },
      },
    };
    storage.setItem(KEY, JSON.stringify(legacy));
    const loaded = service.load()!;
    expect(loaded.runStats).toEqual({
      roundsWon: 3,
      enemiesDefeated: 9,
      bossesDefeated: 0,
      cardsPlayed: 2,
      seconds: 12.75,
      goldEarned: 15,
    });
    expect(loaded.run.battle!.deck).toHaveLength(25);
    service.settle(loaded);
    expect(service.readMeta().continuation!.stats).toEqual(loaded.runStats);
  });
  it.each([
    { seconds: -1 },
    { seconds: null },
    { seconds: '5' },
    { roundsWon: -1 },
    { enemiesDefeated: 1.5 },
    { bossesDefeated: '2' },
    { cardsPlayed: -2 },
    { goldEarned: 1.5 },
  ])('rejects malformed saved statistics %j', (invalid) => {
    const storage = memoryStorage(),
      state = initial();
    storage.setItem(KEY, JSON.stringify({ ...state, runStats: { ...state.runStats, ...invalid } }));
    expect(new CastleService(storage).load()).toBeNull();
  });
  it('keeps a legacy continuation usable when its optional statistics are absent', () => {
    const storage = memoryStorage(),
      service = new CastleService(storage);
    storage.setItem(
      'golf-castle-meta-v1',
      JSON.stringify({
        ...service.readMeta(),
        currentStreak: 1,
        claimed: ['old-win'],
        continuation: {
          sourceSiege: 'old-win',
          siegeNumber: 1,
          coins: 25,
          hp: 14,
          maxHp: 40,
          armor: 4,
        },
      })
    );
    expect(service.beginSiege().carryover).toMatchObject({ coins: 25, hp: 14, armor: 4 });
  });
  it('does not admit malformed optional continuation statistics', () => {
    const storage = memoryStorage(),
      service = new CastleService(storage);
    storage.setItem(
      'golf-castle-meta-v1',
      JSON.stringify({
        ...service.readMeta(),
        currentStreak: 1,
        claimed: ['old-win'],
        continuation: {
          sourceSiege: 'old-win',
          siegeNumber: 1,
          coins: 25,
          hp: 14,
          maxHp: 40,
          armor: 4,
          stats: { seconds: 'bad' },
        },
      })
    );
    expect(service.beginSiege().carryover).toBeUndefined();
  });
});
