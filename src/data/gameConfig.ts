import rawConfig from './config.json';
import { resolveConfig } from '../core/RunStructure';
import type { GameConfig } from '../core/types';

/** Game config with the run formula expanded into runStructure (6 acts x 7 fights). */
export const gameConfig: GameConfig = resolveConfig(rawConfig as unknown as GameConfig);
