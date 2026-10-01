// Usage: npx vite-node scripts/sim-report.ts [seeds]
import { gameConfig } from '../src/data/gameConfig';
import enemies from '../src/data/enemies.json';
import relics from '../src/data/relics.json';
import type { Relic } from '../src/core/types';
import { simulateRun, formatHpTable } from '../src/core/Simulation';
import type { EnemiesData } from '../src/core/GameState';
const seeds = Number(process.argv[2] ?? gameConfig.simulation?.seeds ?? 100);
const t = Date.now();
const rows = simulateRun(gameConfig, enemies as unknown as EnemiesData, seeds, relics.relics as Relic[]);
console.log(formatHpTable(rows));
console.log(`\nseeds=${seeds} in ${Date.now() - t} ms`);
