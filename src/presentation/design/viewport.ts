import type Phaser from 'phaser';

// Phaser 3 uses physical canvas pixels. Keep scene geometry in CSS pixels,
// then let the camera render it at the display's density.
let renderDensity = 1;
export function setRenderDensity(value: number): void {
  renderDensity = Math.max(1, Math.min(3, Number.isFinite(value) ? value : 1));
}
export function getRenderDensity(): number { return renderDensity; }
export function viewport(scene: Pick<Phaser.Scene, 'scale'>) {
  return { width: scene.scale.width / renderDensity, height: scene.scale.height / renderDensity };
}
export function configureViewport(scene: Phaser.Scene): void {
  const size = viewport(scene);
  scene.cameras.main.setOrigin(.5, .5).setZoom(renderDensity).centerOn(size.width / 2, size.height / 2);
}
