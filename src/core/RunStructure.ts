/**
 * Run structure: N acts x M fights, generated from a formula in config.json ("run").
 * Each fight carries its tier and the HP / attack multipliers applied to the enemy's base stats.
 */
export type EnemyTier = 'normal' | 'elite' | 'boss';

export interface RunFormula {
  readonly acts: number;
  readonly fightsPerAct: number;
  /** Tier for each fight inside an act (length = fightsPerAct). */
  readonly fightTiers: readonly EnemyTier[];
  /** Enemy HP multiplier = (1 + actGrowth)^(act-1) * (1 + fightGrowth*(fight-1)). */
  readonly hp: { readonly actGrowth: number; readonly fightGrowth: number };
  /** Enemy attack multiplier, same shape as hp. */
  readonly attack: { readonly actGrowth: number; readonly fightGrowth: number };
  /** Applied when the player enters the first fight of a new act (act >= 2). */
  readonly actStart: { readonly maxHpBonus: number; readonly healPercent: number };
}

export interface FightSpec {
  readonly type: 'battle';
  readonly enemyTier: EnemyTier;
  readonly act: number;
  readonly fightInAct: number;
  readonly hpMultiplier: number;
  readonly attackMultiplier: number;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

export function buildRunStructure(formula: RunFormula): FightSpec[] {
  if (formula.fightTiers.length !== formula.fightsPerAct) {
    throw new Error(`run.fightTiers must have ${formula.fightsPerAct} entries`);
  }
  const fights: FightSpec[] = [];
  for (let act = 1; act <= formula.acts; act++) {
    for (let fight = 1; fight <= formula.fightsPerAct; fight++) {
      fights.push({
        type: 'battle',
        enemyTier: formula.fightTiers[fight - 1],
        act,
        fightInAct: fight,
        hpMultiplier: round3(Math.pow(1 + formula.hp.actGrowth, act - 1) * (1 + formula.hp.fightGrowth * (fight - 1))),
        attackMultiplier: round3(Math.pow(1 + formula.attack.actGrowth, act - 1) * (1 + formula.attack.fightGrowth * (fight - 1))),
      });
    }
  }
  return fights;
}

/** Turns the raw JSON config (with "run" formula) into a GameConfig with an expanded runStructure. */
export function resolveConfig<T extends { run?: RunFormula; runStructure?: unknown }>(raw: T): T & { runStructure: FightSpec[] } {
  if (!raw.run) return raw as T & { runStructure: FightSpec[] };
  return { ...raw, runStructure: buildRunStructure(raw.run) };
}

export interface ActInfo { act: number; fightInAct: number; fightsPerAct: number; acts: number }

export function getActInfo(fightIndex: number, runStructure: ReadonlyArray<{ act?: number; fightInAct?: number }>, formula?: RunFormula): ActInfo {
  const spec = runStructure[Math.min(fightIndex, runStructure.length - 1)];
  const fightsPerAct = formula?.fightsPerAct ?? runStructure.length;
  return {
    act: spec?.act ?? 1,
    fightInAct: spec?.fightInAct ?? fightIndex + 1,
    fightsPerAct,
    acts: formula?.acts ?? 1,
  };
}
