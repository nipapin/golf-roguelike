import { expect, it } from 'vitest';
import { getLayoutMetrics } from './tokens';

it.each([[375, 550], [375, 667], [390, 650], [390, 844], [430, 932]])('keeps battle regions separate at %dx%d', (width, height) => {
  const layout = getLayoutMetrics(width, height);
  expect(layout.relicTop + layout.relicHeight).toBeLessThan(layout.arenaTop);
  expect(layout.arenaTop + layout.arenaHeight).toBeLessThanOrEqual(layout.bannerTop);
  expect(layout.bannerTop + layout.bannerHeight).toBeLessThan(layout.tableTop);
  expect(layout.tableauTop + layout.tableauHeight).toBeLessThan(layout.trayTop);
  expect(layout.trayTop + 12 + layout.activeH + 16).toBeLessThanOrEqual(height - layout.safeBottom);
});

it.each([[375, 667], [390, 844], [430, 932]])('respects notch/home-indicator insets at %dx%d', (width, height) => {
  const plain = getLayoutMetrics(width, height, { top: 0, bottom: 0 });
  const notch = getLayoutMetrics(width, height, { top: 59, bottom: 34 });
  expect(notch.safeTop).toBe(8 + 59);
  expect(notch.safeBottom).toBe(8 + 34);
  expect(notch.hudTop).toBe(plain.hudTop + 59);
  expect(notch.trayTop + notch.trayHeight).toBe(height - 34 - 8);
  expect(notch.relicTop + notch.relicHeight).toBeLessThan(notch.arenaTop);
  expect(notch.tableauTop + notch.tableauHeight).toBeLessThan(notch.trayTop);
  expect(notch.arenaHeight).toBeGreaterThanOrEqual(60);
});
