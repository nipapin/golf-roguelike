import type { Relic } from '../../core/types';

const icons: Record<string, string> = {
  spadeDamageBonus: '♠', heartHealBonus: '♥', diamondGoldBonus: '♦', clubArmorBonus: '♣',
  thirdCardMultiplier: '×2', firstChainBonus: '≫', extraPowerCards: '★',
  doublePower: '×2', vampiric: '†', aceKingWrap: '↔',
};
const RANKS: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
export function relicIcon(relic: Relic): string {
  // Rank relics show their own rank (ACE STRIKE → A, LUCKY SEVEN → 7).
  if (relic.effect.type === 'boostedRank' && typeof relic.effect.rank === 'number') return RANKS[relic.effect.rank] ?? String(relic.effect.rank);
  return icons[relic.effect.type] ?? '★';
}
