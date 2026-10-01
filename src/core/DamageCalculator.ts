import { RelicManager } from './RelicManager';
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
  const baseDamage = card.joker ? 0 : chainPosition;

  const relicManager = RelicManager.of(relics);
  // (First-chain bonus is applied at chain level, see getEffectiveChainPosition.)

  // Suit bonus (spades only add to damage)
  let suitBonus = 0;
  if (!card.joker && card.suit === 'spades') {
    suitBonus = config.combat.baseSpadeDamageBonus;
    suitBonus += relicManager.spadeDamageBonus();
  }

  // Boosted rank bonus
  let relicBonus = 0;
  relicBonus += relicManager.rankBonus(card.rank);

  // Power card bonus
  let powerBonus = 0;
  let multiplier = 1;

  if (powerType) {
    const powerMultiplier = relicManager.powerMultiplier(powerType);

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
  multiplier *= relicManager.chainPositionMultiplier(chainPosition);

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
  let jokerMultiplier = 1;
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
    if (card.joker === 'black') jokerMultiplier *= 5;
    position++;
  }

  return Math.floor(total * jokerMultiplier);
}
