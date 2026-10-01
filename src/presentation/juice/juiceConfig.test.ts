import { describe, expect, it, vi, afterEach } from 'vitest';
import { JUICE, classifyHit, hitStopMs, shakeIntensity, damageColor, damageFontSize } from './juiceConfig';
import { isShakeReduced, setShakeReduced, resetFxSettingsCache } from './fxSettings';
import { memoryStorage } from '../../test/fixtures';

describe('juice hierarchy', () => {
  it('classifies routine < big < finisher', () => {
    expect(classifyHit(5, 3, 60, false)).toBe('routine');
    expect(classifyHit(JUICE.tiers.bigDamage, 3, 200, false)).toBe('big');
    expect(classifyHit(5, JUICE.tiers.bigChain, 200, false)).toBe('big');
    expect(classifyHit(5, 2, 200, true)).toBe('finisher');
    expect(classifyHit(JUICE.tiers.finisherDamage, 2, 500, false)).toBe('finisher');
    expect(classifyHit(10, 2, 20, false)).toBe('finisher'); // half the enemy's HP
  });
  it('hit-stop scales with damage inside 60-90ms, finisher longer', () => {
    expect(hitStopMs(0, 'routine')).toBe(JUICE.hitStop.minMs);
    expect(hitStopMs(1, 'routine')).toBeLessThanOrEqual(JUICE.hitStop.minMs + 2);
    expect(hitStopMs(999, 'big')).toBe(JUICE.hitStop.maxMs);
    expect(hitStopMs(10, 'big')).toBeGreaterThan(JUICE.hitStop.minMs);
    expect(hitStopMs(10, 'finisher')).toBe(JUICE.hitStop.finisherMs);
  });
  it('escalates shake, size and colour with damage and chain', () => {
    expect(shakeIntensity(20, 1)).toBeGreaterThan(shakeIntensity(5, 1));
    expect(shakeIntensity(20, 6)).toBeGreaterThan(shakeIntensity(20, 1));
    expect(shakeIntensity(1e6, 30)).toBe(JUICE.shake.max);
    expect(damageFontSize(30, 5)).toBeGreaterThan(damageFontSize(5, 1));
    expect(damageFontSize(1e6, 50)).toBe(JUICE.numbers.maxSize);
    expect(damageColor(3)).not.toBe(damageColor(30));
  });
});

describe('fx settings', () => {
  afterEach(() => { vi.unstubAllGlobals(); resetFxSettingsCache(); });
  it('persists reduce-shake', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    resetFxSettingsCache();
    expect(isShakeReduced()).toBe(false);
    setShakeReduced(true);
    resetFxSettingsCache();
    expect(isShakeReduced()).toBe(true);
  });
});
