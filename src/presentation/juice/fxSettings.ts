/** Player-facing visual-effect preferences (persisted). */
const KEY = 'golf_rogue_fx_settings';
interface FxSettings { reduceShake: boolean }
let cache: FxSettings | null = null;

function load(): FxSettings {
  if (cache) return cache;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const parsed = raw ? JSON.parse(raw) : {};
    cache = { reduceShake: parsed?.reduceShake === true };
  } catch {
    cache = { reduceShake: false };
  }
  return cache;
}

export function isShakeReduced(): boolean { return load().reduceShake; }
export function setShakeReduced(value: boolean): void {
  cache = { ...load(), reduceShake: value };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* ignore */ }
}
/** Test helper. */
export function resetFxSettingsCache(): void { cache = null; }
