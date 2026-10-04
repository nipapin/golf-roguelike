export const XP_THRESHOLDS = [0, 8, 20, 36, 56] as const;
export const CASTLE_XP = { card: 2, kill: 2, boss: 10, lockedReward: 1 };
export type ModuleKey = 'fireArrows' | 'shieldSoldiers' | 'volatileLaser';
export interface CastleProgression { xp: number; level: number; modules: ModuleKey[] }
export const MODULES: readonly { id: ModuleKey; title: string; description: string; level: number; cost: number }[] = [
  { id: 'shieldSoldiers', title: 'Щитоносцы', description: 'Солдаты получают щит: 6 HP и удерживают врагов в ближнем бою.', level: 2, cost: 5 },
  { id: 'fireArrows', title: 'Огненные стрелы', description: 'Стрелы поджигают врага на 4 секунды: 2 урона в секунду.', level: 2, cost: 6 },
  { id: 'volatileLaser', title: 'Подрыв горения', description: 'Лазер подрывает горящие цели: 12 урона цели и соседям.', level: 5, cost: 12 },
];
export const castleLevel = (xp: number) => XP_THRESHOLDS.filter((threshold) => xp >= threshold).length;
export function normalizeCastleProgression(value?: Partial<CastleProgression>): CastleProgression {
  const xp = Number.isSafeInteger(value?.xp) && value!.xp! >= 0 ? value!.xp! : 0;
  return { xp, level: castleLevel(xp), modules: [...new Set((value?.modules ?? []).filter((key) => MODULES.some((module) => module.id === key)))] };
}
