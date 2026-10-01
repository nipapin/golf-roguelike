/**
 * RelicManager: every relic effect is a hook table keyed by `effect.type`.
 * Game code asks the manager a question ("spade bonus?", "power multiplier for CRIT?") instead of
 * searching `relics` for magic strings. Resolution matches the previous `relics.find(...)` calls
 * exactly: the FIRST owned relic whose hook answers (non-null) wins; otherwise the default applies.
 * Adding a relic type = add an entry to RELIC_HOOKS (+ relics.json); no edits in damage/actions.
 */
import type { Relic, RelicEffect, PowerType, Suit } from './types';

const num = (value: unknown): number => (typeof value === 'number' ? value : 0);

export interface RelicHooks {
  /** Extra chain positions for the first card of the first chain. */
  firstChainBonus?(effect: RelicEffect): number | null;
  /** Extra damage on spade cards. */
  spadeDamageBonus?(effect: RelicEffect): number | null;
  /** Extra damage for a card rank (null = this relic does not apply to that rank). */
  rankBonus?(effect: RelicEffect, rank: number): number | null;
  /** Multiplier for a power card's effect (null = not this power). */
  powerMultiplier?(effect: RelicEffect, power: PowerType): number | null;
  /** Damage multiplier for a chain position. */
  chainPositionMultiplier?(effect: RelicEffect, position: number): number | null;
  /** Extra heal / armor / gold for a suit (null = other suit). */
  suitBonus?(effect: RelicEffect, suit: Suit): number | null;
  /** Healing when a chain resolves for `damage`. */
  chainHeal?(effect: RelicEffect, damage: number): number | null;
  /** Extra power cards dealt per battle. */
  extraPowerCards?(effect: RelicEffect): number | null;
}

export const RELIC_HOOKS: Readonly<Record<string, RelicHooks>> = {
  firstChainBonus: { firstChainBonus: (e) => num(e.value) },
  spadeDamageBonus: { spadeDamageBonus: (e) => num(e.value) },
  boostedRank: { rankBonus: (e, rank) => (e.rank === rank ? num(e.bonus) : null) },
  doublePower: { powerMultiplier: (e, power) => (e.powerType === power ? 2 : null) },
  thirdCardMultiplier: { chainPositionMultiplier: (e, position) => (position % 3 === 0 && typeof e.value === 'number' ? e.value : 1) },
  heartHealBonus: { suitBonus: (e, suit) => (suit === 'hearts' ? num(e.value) : null) },
  clubArmorBonus: { suitBonus: (e, suit) => (suit === 'clubs' ? num(e.value) : null) },
  diamondGoldBonus: { suitBonus: (e, suit) => (suit === 'diamonds' ? num(e.value) : null) },
  vampiric: { chainHeal: (e, damage) => (typeof e.ratio === 'number' ? Math.floor(damage / e.ratio) : 0) },
  extraPowerCards: { extraPowerCards: (e) => num(e.value) },
};

type HookName = keyof RelicHooks;
type HookArgs<K extends HookName> = NonNullable<RelicHooks[K]> extends (effect: RelicEffect, ...args: infer A) => unknown ? A : never;

export class RelicManager {
  constructor(private readonly relics: readonly Relic[]) {}

  static of(relics: readonly Relic[]): RelicManager {
    return new RelicManager(relics);
  }

  /** First non-null answer from an owned relic's hook, or `fallback`. */
  query<K extends HookName>(hook: K, fallback: number, ...args: HookArgs<K>): number {
    for (const relic of this.relics) {
      const fn = RELIC_HOOKS[relic.effect.type]?.[hook] as ((effect: RelicEffect, ...rest: unknown[]) => number | null) | undefined;
      if (!fn) continue;
      const result = fn(relic.effect, ...args);
      if (result !== null) return result;
    }
    return fallback;
  }

  firstChainBonus(): number { return this.query('firstChainBonus', 0); }
  spadeDamageBonus(): number { return this.query('spadeDamageBonus', 0); }
  rankBonus(rank: number): number { return this.query('rankBonus', 0, rank); }
  powerMultiplier(power: PowerType): number { return this.query('powerMultiplier', 1, power); }
  chainPositionMultiplier(position: number): number { return this.query('chainPositionMultiplier', 1, position); }
  suitBonus(suit: Suit): number { return this.query('suitBonus', 0, suit); }
  chainHeal(damage: number): number { return this.query('chainHeal', 0, damage); }
  extraPowerCards(): number { return this.query('extraPowerCards', 0); }
}
