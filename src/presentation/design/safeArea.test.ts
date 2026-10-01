import { expect, it } from 'vitest';
import { viewportHeight } from './safeArea';
const screen = { innerWidth: 393, innerHeight: 759, screenWidth: 393, screenHeight: 852, visualHeight: 759, iosStandalone: true };
it('uses full iOS standalone screen despite stale Safari viewport height', () => expect(viewportHeight(screen)).toBe(852));
it('preserves the visible Safari height in browser mode', () => expect(viewportHeight({ ...screen, iosStandalone: false })).toBe(759));
it('uses the rotated screen dimension in landscape', () => expect(viewportHeight({ ...screen, innerWidth: 852, innerHeight: 393 })).toBe(393));
