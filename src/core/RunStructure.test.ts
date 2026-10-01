import { describe, it, expect } from 'vitest';
import { buildRunStructure, getActInfo, resolveConfig } from './RunStructure';
import { config, enemies } from '../test/fixtures';
import { startRun, startNextBattle, leaveShop } from './GameActions';
import { enemiesForAct } from './GameState';
import rawConfig from '../data/config.json';

describe('run structure (6 acts x 7 fights)', () => {
  it('expands the formula from config.json', () => {
    const fights = buildRunStructure(config.run!);
    expect(fights).toHaveLength(42);
    expect(fights[0]).toMatchObject({ act: 1, fightInAct: 1, enemyTier: 'normal', hpMultiplier: 1, attackMultiplier: 1 });
    expect(fights[5].enemyTier).toBe('elite');
    expect(fights[6].enemyTier).toBe('boss');
    expect(fights[41]).toMatchObject({ act: 6, fightInAct: 7, enemyTier: 'boss' });
    const run = config.run!;
    expect(fights[7].hpMultiplier).toBeCloseTo(1 + run.hp.actGrowth, 3);
    expect(fights[41].hpMultiplier).toBeCloseTo(Math.pow(1 + run.hp.actGrowth, 5) * (1 + run.hp.fightGrowth * 6), 2);
  });

  it('resolveConfig keeps the raw JSON free of a hand-written runStructure', () => {
    expect((rawConfig as Record<string, unknown>).runStructure).toBeUndefined();
    expect(resolveConfig(rawConfig as unknown as { run: NonNullable<typeof config.run> }).runStructure).toHaveLength(42);
  });

  it('rejects a tier list that does not match fightsPerAct', () => {
    expect(() => buildRunStructure({ ...config.run!, fightTiers: ['normal'] })).toThrow();
  });

  it('reports ACT n / FIGHT m', () => {
    expect(getActInfo(0, config.runStructure, config.run)).toEqual({ act: 1, fightInAct: 1, fightsPerAct: 7, acts: 6 });
    expect(getActInfo(13, config.runStructure, config.run)).toMatchObject({ act: 2, fightInAct: 7 });
    expect(getActInfo(41, config.runStructure, config.run)).toMatchObject({ act: 6, fightInAct: 7 });
  });

  it('scales the spawned enemy by the fight multipliers and picks from the act pool', () => {
    const state = startNextBattle({ ...startRun('scale', config), currentFight: 22 }, enemies, config);
    const spec = config.runStructure[22];
    const enemy = state.battle!.enemy;
    const pool = enemiesForAct(enemies.normal, spec.act!);
    const base = pool.find((e) => e.id === enemy.id)!;
    expect(base).toBeDefined();
    expect(enemy.maxHp).toBe(Math.round(base.hp * spec.hpMultiplier!));
    expect(enemy.act).toBe(4);
    expect(enemy.tier).toBe('normal');
    const firstAttack = base.intents.find((i) => i.type === 'attack')!;
    expect(enemy.intents.find((i) => i.type === 'attack')!.value).toBe(Math.max(1, Math.round(firstAttack.value * spec.attackMultiplier!)));
  });

  it('every act has a boss and at least two normal enemies', () => {
    for (let act = 1; act <= 6; act++) {
      expect(enemies.boss.filter((e) => e.acts![0] <= act && act <= e.acts![1]).length).toBeGreaterThanOrEqual(1);
      expect(enemies.normal.filter((e) => e.acts![0] <= act && act <= e.acts![1]).length).toBeGreaterThanOrEqual(2);
      expect(enemies.elite.filter((e) => e.acts![0] <= act && act <= e.acts![1]).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('entering a new act raises max HP and heals', () => {
    const s = { ...startRun('act', config), currentFight: 6, phase: 'shop' as const, player: { ...startRun('act', config).player, hp: 5 } };
    const result = leaveShop(s, config);
    expect(result.state.currentFight).toBe(7);
    expect(result.state.player.maxHp).toBe(config.player.maxHp + config.run!.actStart.maxHpBonus);
    expect(result.state.player.hp).toBe(result.state.player.maxHp);
    expect(result.events[0]).toMatchObject({ type: 'act_started', act: 2 });
    const mid = leaveShop({ ...s, currentFight: 2 }, config);
    expect(mid.state.player.maxHp).toBe(config.player.maxHp);
    expect(mid.events).toEqual([]);
  });

});
