import { BattleState, Card, RunState, Relic } from './types';
import { canConnect, isCardExposed, hasLegalMoves as checkLegalMoves, isTableauEmpty } from './GameState';

/**
 * Check if a card can be played from the tableau
 * A-K wrap is always legal (base rule)
 */
export function isPlayable(
  battle: BattleState,
  cardId: string
): boolean {
  if (!battle.activeCard) return false;

  // Find the card
  let card: Card | null = null;
  for (const col of battle.tableau) {
    const found = col.cards.find((c) => c.id === cardId);
    if (found) {
      card = found;
      break;
    }
  }

  if (!card) return false;

  // Check if exposed
  if (!isCardExposed(battle.tableau, cardId)) return false;

  // Check if can connect (A-K wrap is always legal)
  return canConnect(card, battle.activeCard, battle.wildActive);
}

/**
 * Get all playable cards from the tableau
 */
export function getPlayableCards(battle: BattleState): Card[] {
  const playable: Card[] = [];

  if (!battle.activeCard) return playable;

  for (const col of battle.tableau) {
    if (col.cards.length === 0) continue;
    const topCard = col.cards[col.cards.length - 1];
    if (canConnect(topCard, battle.activeCard, battle.wildActive)) {
      playable.push(topCard);
    }
  }

  return playable;
}

/**
 * Check if the player has any legal moves
 */
export function hasLegalMovesForUI(battle: BattleState): boolean {
  return checkLegalMoves(battle);
}

/**
 * Check if the deck is empty
 */
export function isDeckEmpty(battle: BattleState): boolean {
  return battle.deck.length === 0;
}

/**
 * Check if the tableau is empty (cleared)
 */
export function isTableauCleared(battle: BattleState): boolean {
  return isTableauEmpty(battle.tableau);
}

/**
 * Get the current chain length
 */
export function getChainLength(battle: BattleState): number {
  return battle.chain.length;
}

/**
 * Get the effective chain position (including first chain bonus)
 */
export function getEffectiveChainPosition(
  battle: BattleState,
  relics: Relic[]
): number {
  let position = battle.chain.length + 1;

  if (battle.isFirstChain && battle.chain.length === 0) {
    const bonus = relics.find((r) => r.effect.type === 'firstChainBonus');
    if (bonus && typeof bonus.effect.value === 'number') {
      position += bonus.effect.value;
    }
  }

  return position;
}

/**
 * Check if game is in a valid state (no soft-lock possible)
 */
export function isValidGameState(state: RunState): boolean {
  if (state.phase === 'defeat' || state.phase === 'victory') {
    return true;
  }

  if (state.phase === 'battle' && state.battle) {
    // If deck is empty and no moves, we should be able to reshuffle
    // This is handled by the game actions, so any battle state is valid
    // as long as there are cards somewhere (tableau, deck, or discard)
    const totalCards =
      state.battle.tableau.reduce((sum, col) => sum + col.cards.length, 0) +
      state.battle.deck.length +
      state.battle.discard.length +
      (state.battle.activeCard ? 1 : 0);

    return totalCards > 0;
  }

  return true;
}

/**
 * Get rank display string
 */
export function getRankDisplay(rank: number): string {
  switch (rank) {
    case 1:
      return 'A';
    case 11:
      return 'J';
    case 12:
      return 'Q';
    case 13:
      return 'K';
    default:
      return rank.toString();
  }
}

/**
 * Get suit symbol
 */
export function getSuitSymbol(suit: string): string {
  switch (suit) {
    case 'spades':
      return '♠';
    case 'hearts':
      return '♥';
    case 'diamonds':
      return '♦';
    case 'clubs':
      return '♣';
    default:
      return suit;
  }
}

/**
 * Format card as display string
 */
export function formatCard(card: Card): string {
  return getRankDisplay(card.rank) + getSuitSymbol(card.suit);
}
