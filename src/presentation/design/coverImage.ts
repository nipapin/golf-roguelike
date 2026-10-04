import type Phaser from 'phaser';

/** Fill a region without distorting the artwork; crop the surplus at its edges. */
export function coverImage(scene: Phaser.Scene, key: string, x: number, y: number, width: number, height: number) {
  const image = scene.add.image(x + width / 2, y + height / 2, key);
  image.setScale(Math.max(width / image.width, height / image.height));
  const shape = scene.add.graphics().fillStyle(0xffffff).fillRect(x, y, width, height).setVisible(false);
  const mask = shape.createGeometryMask();
  image.setMask(mask);
  scene.events.once('shutdown', () => mask.destroy());
  return image;
}
