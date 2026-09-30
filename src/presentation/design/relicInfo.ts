import type { Relic } from '../../core/types';

const icons: Record<string, string> = {
  spadeDamageBonus: '♠', heartHealBonus: '♥', diamondGoldBonus: '♦', clubArmorBonus: '♣',
  thirdCardMultiplier: '×2', firstChainBonus: '≫', boostedRank: '7', extraPowerCards: '★',
  doublePower: '×2', vampiric: '†', aceKingWrap: '↔',
};
export function relicIcon(relic: Relic): string { return icons[relic.effect.type] ?? '★'; }
