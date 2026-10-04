export interface SoundOverride {
  url?: string;
  volume?: number;
  rate?: number;
  muted?: boolean;
}

export interface AssetConfig {
  version: 1;
  assets: Record<string, string>;
  sounds: Record<string, SoundOverride>;
  mix: { sound: number; music: number };
  colors: Record<string, string>;
}

export const emptyConfig = (): AssetConfig => ({
  version: 1, assets: {}, sounds: {}, mix: { sound: 1, music: 1 }, colors: {},
});

export function isLocalAssetUrl(value: unknown): value is string {
  return typeof value === 'string' && /^\/(assets|audio|fonts|icons)\/[a-zA-Z0-9_./-]+$/.test(value)
    && !value.includes('..') && !value.includes('//');
}

/** Used by both the local server and game; malformed presets never reach the loaders. */
export function validateConfig(value: unknown): AssetConfig {
  if (!value || typeof value !== 'object') throw new Error('Некорректный конфиг');
  const config = value as AssetConfig;
  const record = (v: unknown) => v && typeof v === 'object' && !Array.isArray(v);
  const number = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  if (config.version !== 1 || !record(config.assets) || !record(config.sounds) || !record(config.mix) || !record(config.colors))
    throw new Error('Неподдерживаемый формат: ожидается конфиг версии 1');
  for (const [key, url] of Object.entries(config.assets)) {
    if (!(isLocalAssetUrl(key) || key === '/icon.svg' || key === '/apple-touch-icon.png') || !isLocalAssetUrl(url))
      throw new Error('Недопустимый путь ассета');
  }
  for (const [id, sound] of Object.entries(config.sounds)) {
    if (!/^[a-z0-9_]+$/.test(id) || !record(sound) ||
      (sound.url !== undefined && (!isLocalAssetUrl(sound.url) || !/\.(mp3|ogg|wav|m4a)$/.test(sound.url))) ||
      (sound.volume !== undefined && !number(sound.volume, 0, 2)) ||
      (sound.rate !== undefined && !number(sound.rate, 0.25, 4)) ||
      (sound.muted !== undefined && typeof sound.muted !== 'boolean')) throw new Error('Некорректная настройка звука: ' + id);
  }
  if (!number(config.mix.sound, 0, 2) || !number(config.mix.music, 0, 2)) throw new Error('Некорректная громкость микшера');
  for (const [key, color] of Object.entries(config.colors)) {
    if (!/^[a-zA-Z0-9]+$/.test(key) || typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color))
      throw new Error('Некорректный цвет');
  }
  return config;
}
