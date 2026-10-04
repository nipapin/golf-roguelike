import { expect, it, vi, afterEach } from 'vitest';
import { emptyConfig, validateConfig } from './config';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('rejects remote paths, traversal and non-finite sound settings', () => {
  for (const url of ['https://evil.test/a.mp3', '/assets/../secret.mp3', '/assets//a.mp3', '/assets/a.mp3?x=1']) {
    const config = emptyConfig(); config.sounds.archer_shot = { url };
    expect(() => validateConfig(config)).toThrow();
  }
  for (const volume of [NaN, Infinity, -1, 3]) {
    const config = emptyConfig(); config.sounds.archer_shot = { volume };
    expect(() => validateConfig(config)).toThrow();
  }
  const config = emptyConfig(); config.assets['/assets/cardboard-runtime/castle.webp'] = '/assets/custom/castle.png';
  config.sounds.archer_shot = { url: '/assets/custom/arrow.wav', volume: 0, muted: true, rate: 0.5 };
  config.colors.face = '#00ff00';
  expect(validateConfig(config)).toEqual(config);
});

it('loads persisted configuration before resolving game files and gracefully falls back', async () => {
  const config = emptyConfig();
  config.assets['/assets/cardboard-runtime/castle.webp'] = '/assets/custom/replacement.png';
  config.sounds.archer_shot = { url: '/assets/custom/arrow.wav', muted: true };
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => config })));
  const runtime = await import('./runtime');
  await runtime.loadAssetConfig();
  expect(runtime.assetUrl('/assets/cardboard-runtime/castle.webp')).toBe('/assets/custom/replacement.png');
  expect(runtime.assetUrl('/fonts/Rubik-Variable.ttf')).toBe('/fonts/Rubik-Variable.ttf');
  expect(runtime.soundOverride('archer_shot').muted).toBe(true);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ version: 900 }) })));
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  await runtime.loadAssetConfig();
  expect(runtime.assetUrl('/assets/cardboard-runtime/castle.webp')).toBe('/assets/cardboard-runtime/castle.webp');
  expect(runtime.soundOverride('archer_shot')).toEqual({});
  warning.mockRestore();
});
