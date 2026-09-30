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
