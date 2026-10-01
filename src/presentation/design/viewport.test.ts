import { afterEach, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { configureViewport, getRenderDensity, setRenderDensity, viewport } from './viewport';
import { getLayoutMetrics } from './tokens';
afterEach(() => setRenderDensity(1));
it.each([1, 2])('keeps layout and camera in CSS coordinates at density %d', density => {
  setRenderDensity(density);
  const camera = { setOrigin: vi.fn(), setZoom: vi.fn(), centerOn: vi.fn() };
  Object.values(camera).forEach(fn => fn.mockReturnValue(camera));
  const scene = { scale: { width: 393 * density, height: 759 * density }, cameras: { main: camera } } as unknown as Phaser.Scene;
  expect(viewport(scene)).toEqual({ width: 393, height: 759 });
  configureViewport(scene);
  expect(camera.setZoom).toHaveBeenCalledWith(density);
  expect(camera.centerOn).toHaveBeenCalledWith(196.5, 379.5);
  const layout = getLayoutMetrics(viewport(scene).width, viewport(scene).height);
  expect(layout.trayTop + layout.trayHeight + layout.safeBottom).toBe(759);
});
it('caps canvas density and rejects invalid values', () => {
  setRenderDensity(5); expect(getRenderDensity()).toBe(2);
  setRenderDensity(3); expect(getRenderDensity()).toBe(2);
  setRenderDensity(NaN); expect(getRenderDensity()).toBe(1);
});
