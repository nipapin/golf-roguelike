import Phaser from 'phaser';

/** Minimum touch target (Apple HIG: 44pt). */
export const MIN_TOUCH = 44;

/** Make a text/image interactive with a hit area of at least MIN_TOUCH×MIN_TOUCH around its visual bounds. */
export function ensureTouchTarget<T extends Phaser.GameObjects.GameObject & { width: number; height: number }>(obj: T, min = MIN_TOUCH): T {
  const w = Math.max(min, obj.width + 16);
  const h = Math.max(min, obj.height + 8);
  obj.setInteractive(new Phaser.Geom.Rectangle((obj.width - w) / 2, (obj.height - h) / 2, w, h), Phaser.Geom.Rectangle.Contains);
  return obj;
}
