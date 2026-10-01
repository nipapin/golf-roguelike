/**
 * Seeded greedy-bot balance simulation (pure, deterministic; used by tests and scripts/sim-report).
 * Bot policy: while a card is playable, play the one that keeps the most follow-up plays open
 * (ties: power cards first, then the deepest column); when nothing is playable, draw/end turn.
 */
import type { GameConfig, RunState, PlayerState, Relic } from './types';
import type { EnemiesData, EnemyData } from './GameState';
import { createEnemy, setupBattle, enemiesForAct } from './GameState';
import { getPlayableCards } from './GameRules';
import { playCard, drawCard } from './GameActions';
import { RNG } from './RNG';

export interface BattleOutcome { won: boolean; turns: number; hpLeft: number }

const MAX_ACTIONS = 2000;

/** Greedy choice among the currently playable cards. */
export function chooseGreedyCard(state: RunState, config: GameConfig): string | null {
  const battle = state.battle;
  if (!battle) return null;
  const playable = getPlayableCards(battle);
  if (!playable.length) return null;
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const card of playable) {
    const next = playCard(state, card.id, config).state;
    const follow = next.battle ? getPlayableCards(next.battle).length : 99;
    const isPower = battle.powerCards.some((p) => p.cardId === card.id) ? 1 : 0;
    const depth = battle.tableau.find((col) => col.cards.some((c) => c.id === card.id))?.cards.length ?? 0;
    const score = follow * 100 + isPower * 10 + depth;
    if (score > bestScore) { bestScore = score; best = card.id; }
  }
  return best;
}

/** Plays one battle to completion with the greedy bot. */
export function runGreedyBattle(start: RunState, config: GameConfig): BattleOutcome {
  let state = start;
  let turns = 0;
  for (let i = 0; i < MAX_ACTIONS && state.phase === 'battle' && state.battle; i++) {
    const cardId = chooseGreedyCard(state, config);
    if (cardId) state = playCard(state, cardId, config).state;
    else { state = drawCard(state, config).state; turns++; }
  }
  const won = state.phase === 'reward' || state.phase === 'victory';
  return { won, turns, hpLeft: Math.max(0, state.player.hp) };
}

/**
 * Reference player for an act: full HP including act max-HP bonuses, plus the first
 * (act-1) * relicsPerAct relics of config.simulation.referenceBuild (models a typical build).
 */
export function referencePlayer(config: GameConfig, act: number, allRelics: Relic[] = []): PlayerState {
  const bonus = config.run?.actStart.maxHpBonus ?? 0;
  const maxHp = config.player.maxHp + (act - 1) * bonus;
  const build = config.simulation?.referenceBuild ?? [];
  const count = Math.min(build.length, (act - 1) * (config.simulation?.relicsPerAct ?? 0));
  const relics = build.slice(0, count).map((id) => allRelics.find((r) => r.id === id)).filter((r): r is Relic => !!r);
  return { hp: maxHp, maxHp, armor: 0, gold: 0, relics };
}

/** Battle for fight `fightIndex` against a specific enemy, reference player, given seed. */
export function setupSimBattle(config: GameConfig, enemies: EnemiesData, fightIndex: number, enemy: EnemyData, seed: string, allRelics: Relic[] = []): RunState {
  const spec = config.runStructure[fightIndex];
  const act = spec.act ?? 1;
  const base: RunState = {
    seed, currentFight: fightIndex, player: referencePlayer(config, act, allRelics), battle: null, phase: 'battle',
    availableRewards: [], rngState: new RNG(seed).getState(),
  };
  const powerCount = enemy.powerCardCount ?? enemies.defaults.powerCardCount[spec.enemyTier];
  return setupBattle(base, enemy, powerCount, config, { tier: spec.enemyTier, act, hpMultiplier: spec.hpMultiplier, attackMultiplier: spec.attackMultiplier });
}

export interface FightReport {
  fight: number; act: number; fightInAct: number; tier: 'normal' | 'elite' | 'boss';
  hpMin: number; hpMax: number; attackMultiplier: number; killRate: number; avgTurns: number;
}

/** Kill rate per fight: each seed fights every enemy eligible for that act/tier in rotation. */
export function simulateRun(config: GameConfig, enemies: EnemiesData, seeds: number, allRelics: Relic[] = []): FightReport[] {
  return config.runStructure.map((spec, index) => {
    const act = spec.act ?? 1;
    const pool = enemiesForAct(enemies[spec.enemyTier], act);
    let wins = 0; let turns = 0;
    for (let s = 0; s < seeds; s++) {
      const enemy = pool[s % pool.length];
      const outcome = runGreedyBattle(setupSimBattle(config, enemies, index, enemy, `sim-${index}-${s}`, allRelics), config);
      if (outcome.won) wins++;
      turns += outcome.turns;
    }
    const hps = pool.map((enemy) => createEnemy(enemy, { hpMultiplier: spec.hpMultiplier }).maxHp);
    return {
      fight: index + 1, act, fightInAct: spec.fightInAct ?? index + 1, tier: spec.enemyTier,
      hpMin: Math.min(...hps), hpMax: Math.max(...hps), attackMultiplier: spec.attackMultiplier ?? 1,
      killRate: wins / seeds, avgTurns: turns / seeds,
    };
  });
}

export function formatHpTable(rows: FightReport[]): string {
  const lines = ['| # | Act | Fight | Tier | Enemy HP | Atk × | Kill rate | Avg turns |', '|---|---|---|---|---|---|---|---|'];
  for (const r of rows) {
    lines.push(`| ${r.fight} | ${r.act} | ${r.fightInAct}/7 | ${r.tier} | ${r.hpMin === r.hpMax ? r.hpMin : `${r.hpMin}–${r.hpMax}`} | ${r.attackMultiplier.toFixed(2)} | ${(r.killRate * 100).toFixed(0)}% | ${r.avgTurns.toFixed(1)} |`);
  }
  return lines.join('\n');
}
