import type Phaser from 'phaser';

/** Small canvas gradients keep the scenery readable on both canvas and WebGL renderers. */
export function menuScrim(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
  width: number,
  height: number,
  stops: [number, string][],
  horizontal = false
) {
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, horizontal ? 256 : 2, horizontal ? 2 : 256)!;
    const ctx = texture.context;
    const gradient = ctx.createLinearGradient(0, 0, horizontal ? 256 : 0, horizontal ? 0 : 256);
    stops.forEach(([at, color]) => gradient.addColorStop(at, color));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, texture.width, texture.height);
    texture.refresh();
  }
  return scene.add.image(x, y, key).setOrigin(0).setDisplaySize(width, height);
}
