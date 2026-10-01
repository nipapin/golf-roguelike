import { gameConfig } from '../data/gameConfig';
import enemiesData from '../data/enemies.json';
import { startRun, startNextBattle } from '../core/GameActions';
import type { GameConfig } from '../core/types';
import type { EnemiesData } from '../core/GameState';

export const config: GameConfig = gameConfig;
export const enemies = enemiesData as EnemiesData;
export function battleFixture(seed = 'foundation-test') {
  return startNextBattle(startRun(seed, config), enemies, config);
}
export function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };
}
