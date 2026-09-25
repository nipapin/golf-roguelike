import { Card, PowerType, Relic, GameConfig } from './types';

export interface DamageContext {
  chainPosition: number; // 1-indexed position in chain
  card: Card;
  powerType: PowerType | null;
  relics: Relic[];
  config: GameConfig;
}

export interface DamageResult {
  baseDamage: number;
  suitBonus: number;
  powerBonus: number;
  relicBonus: number;
  multiplier: number;
  totalDamage: number;
}

/**
 * Calculate damage for a single card played in a chain.
 * Base damage = chain position (1st card = 1, 2nd = 2, etc.)
 * Spades add bonus damage.
 * Power cards and relics can modify.
 */
export function calculateCardDamage(ctx: DamageContext): DamageResult {
  const { chainPosition, card, powerType, relics, config } = ctx;

  // Base damage = position in chain
  const baseDamage = chainPosition;

  // Apply first chain bonus from relics
  const firstChainBonus = relics.find((r) => r.effect.type === 'firstChainBonus');
  if (firstChainBonus && chainPosition === 1) {
    // This is handled at chain level, not card level
  }

  // Suit bonus (spades only add to damage)
  let suitBonus = 0;
  if (card.suit === 'spades') {
    suitBonus = config.combat.baseSpadeDamageBonus;
    const spadeBonusRelic = relics.find((r) => r.effect.type === 'spadeDamageBonus');
    if (spadeBonusRelic && typeof spadeBonusRelic.effect.value === 'number') {
      suitBonus += spadeBonusRelic.effect.value;
    }
  }

  // Boosted rank bonus
  let relicBonus = 0;
  const boostedRankRelic = relics.find(
    (r) => r.effect.type === 'boostedRank' && r.effect.rank === card.rank
  );
  if (boostedRankRelic && typeof boostedRankRelic.effect.bonus === 'number') {
    relicBonus += boostedRankRelic.effect.bonus;
  }

  // Power card bonus
  let powerBonus = 0;
  let multiplier = 1;

  if (powerType) {
    const doublePowerRelic = relics.find(
      (r) => r.effect.type === 'doublePower' && r.effect.powerType === powerType
    );
    const powerMultiplier = doublePowerRelic ? 2 : 1;

    switch (powerType) {
      case 'CRIT':
        multiplier = config.powerCards.CRIT.damageMultiplier * powerMultiplier;
        break;
      case 'BOMB':
        powerBonus = config.powerCards.BOMB.flatDamage * powerMultiplier;
        break;
      case 'ECHO':
        // ECHO adds +2 to chain position, handled separately
        break;
      // HEAL, GUARD, GOLD, WILD don't add damage
    }
  }

  // Third card multiplier from relic
  const thirdCardRelic = relics.find((r) => r.effect.type === 'thirdCardMultiplier');
  if (thirdCardRelic && chainPosition % 3 === 0 && typeof thirdCardRelic.effect.value === 'number') {
    multiplier *= thirdCardRelic.effect.value;
  }

  const totalDamage = Math.floor((baseDamage + suitBonus + relicBonus + powerBonus) * multiplier);

  return {
    baseDamage,
    suitBonus,
    powerBonus,
    relicBonus,
    multiplier,
    totalDamage,
  };
}

/**
 * Calculate total damage for an entire chain.
 */
export function calculateChainDamage(
  chain: Card[],
  powerCards: Map<string, PowerType>,
  relics: Relic[],
  config: GameConfig,
  startPosition: number = 1
): number {
  let total = 0;
  let position = startPosition;

  for (const card of chain) {
    const powerType = powerCards.get(card.id) || null;

    // ECHO adds +2 to current position
    if (powerType === 'ECHO') {
      position += config.powerCards.ECHO.comboBonus;
    }

    const result = calculateCardDamage({
      chainPosition: position,
      card,
      powerType,
      relics,
      config,
    });

    total += result.totalDamage;
    position++;
  }

  return total;
}
