import type { Enemy } from '../../core/types';
import type { EmotionThresholds } from '../../core/GameState';

export type Emotion = 'calm' | 'angry' | 'scared';

const DEFAULTS: EmotionThresholds = { scaredBelow: 0.3, angryBelow: 0.5, angryAttackRatio: 1.4 };

/**
 * Presentation-only mood. Scared wins over angry: a normal enemy at low HP cowers,
 * while elites/bosses get angry when wounded or when winding up their biggest attack.
 */
export function getEmotion(enemy: Enemy, thresholds: EmotionThresholds = DEFAULTS): Emotion {
  if (enemy.hp <= 0) return 'calm';
  const ratio = enemy.hp / enemy.maxHp;
  const strong = enemy.tier === 'elite' || enemy.tier === 'boss';
  if (ratio <= thresholds.scaredBelow && !strong) return 'scared';
  if (strong && ratio <= thresholds.angryBelow) return 'angry';
  const attacks = enemy.intents.filter((i) => i.type === 'attack').map((i) => i.value);
  const next = enemy.intents[enemy.currentIntentIndex];
  if (next?.type === 'attack' && attacks.length > 1 && next.value >= Math.min(...attacks) * thresholds.angryAttackRatio) return 'angry';
  if (ratio <= thresholds.scaredBelow) return 'scared';
  return 'calm';
}
