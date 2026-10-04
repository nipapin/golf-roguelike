import { emptyConfig, validateConfig } from './config';

let config = emptyConfig();

export async function loadAssetConfig(): Promise<void> {
  try {
    const response = await fetch('/game-assets.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Configuration unavailable');
    config = validateConfig(await response.json());
  } catch (error) {
    console.warn('Используются исходные ассеты:', error);
    config = emptyConfig();
  }
}

export const assetUrl = (original: string): string => config.assets[original] ?? original;
export const soundOverride = (id: string) => config.sounds[id] ?? {};
export const configuredMix = () => config.mix;
export const configuredColors = () => config.colors;
