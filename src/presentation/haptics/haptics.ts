/**
 * Haptic feedback for mobile devices using the Vibration API.
 * Falls back silently on unsupported devices.
 */

const KEY = 'golf_rogue_haptics_settings';

interface HapticsSettings {
  enabled: boolean;
}

let cache: HapticsSettings | null = null;

function load(): HapticsSettings {
  if (cache) return cache;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const parsed = raw ? JSON.parse(raw) : {};
    cache = { enabled: parsed?.enabled !== false };
  } catch {
    cache = { enabled: true };
  }
  return cache;
}

export function isHapticsEnabled(): boolean {
  return load().enabled;
}

export function setHapticsEnabled(value: boolean): void {
  cache = { enabled: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

function vibrate(pattern: number | number[]): void {
  if (!isHapticsEnabled() || !canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

/** Light tap feedback for button presses and card selections. */
export function tapFeedback(): void {
  vibrate(8);
}

/** Stronger feedback for successful card plays. */
export function playFeedback(): void {
  vibrate(15);
}

/** Quick double-tap for combo increases. */
export function comboFeedback(count: number): void {
  if (count < 2) return;
  const intensity = Math.min(count * 2, 25);
  vibrate([intensity, 30, intensity]);
}

/** Heavy feedback for damage taken or important events. */
export function impactFeedback(): void {
  vibrate(35);
}

/** Success pattern for victories. */
export function successFeedback(): void {
  vibrate([20, 50, 20, 50, 40]);
}

/** Error/invalid action feedback. */
export function errorFeedback(): void {
  vibrate([10, 30, 10]);
}

/** Deploy unit feedback. */
export function deployFeedback(): void {
  vibrate([12, 20, 8]);
}

/** Test helper. */
export function resetHapticsCache(): void {
  cache = null;
}
