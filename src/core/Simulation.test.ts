import { describe, it, expect } from 'vitest';
import { config, enemies } from '../test/fixtures';
import relicsData from '../data/relics.json';
import type { Relic } from './types';
import { simulateRun, runGreedyBattle, setupSimBattle, formatHpTable } from './Simulation';

const relics = relicsData.relics as Relic[];

describe('greedy-bot balance simulation', () => {
  const sim = config.simulation!;
  const rows = simulateRun(config, enemies, sim.seeds, relics);

  it('covers all 42 fights (6 acts x 7)', () => {
    expect(rows).toHaveLength(42);
    expect(rows.filter((r) => r.tier === 'boss').map((r) => r.fight)).toEqual([7, 14, 21, 28, 35, 42]);
    expect(rows.filter((r) => r.tier === 'elite').map((r) => r.fight)).toEqual([6, 13, 20, 27, 34, 41]);
  });

  it('kill rates stay inside the per-tier thresholds from config.simulation', () => {
    const failures = rows.filter((r) => r.killRate < sim.minKillRate[r.tier] || r.killRate > sim.maxKillRate[r.tier]);
    if (failures.length) console.log(formatHpTable(rows));
    expect(failures.map((r) => `#${r.fight} ${r.tier} ${(r.killRate * 100).toFixed(0)}%`)).toEqual([]);
  });

  it('difficulty ramps: enemy HP grows act over act for every tier', () => {
    for (const tier of ['normal', 'elite', 'boss'] as const) {
      const firstOfAct = [1, 2, 3, 4, 5, 6].map((act) => rows.find((r) => r.act === act && r.tier === tier)!.hpMin);
      for (let i = 1; i < firstOfAct.length; i++) expect(firstOfAct[i]).toBeGreaterThan(firstOfAct[i - 1]);
    }
  });

  it('is deterministic for a seed', () => {
    const enemy = enemies.boss[0];
    const a = runGreedyBattle(setupSimBattle(config, enemies, 6, enemy, 'det', relics), config);
    const b = runGreedyBattle(setupSimBattle(config, enemies, 6, enemy, 'det', relics), config);
    expect(a).toEqual(b);
  });
});
