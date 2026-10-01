import type Phaser from 'phaser';
import { cardboardAssets, type CardboardAssetId } from './CardboardAssets';

/** Call from a scene's preload. Optional IDs let callers load only what they use. */
export function preloadCardboardArt(
  scene: Phaser.Scene,
  ids = Object.keys(cardboardAssets) as CardboardAssetId[]
): void {
  for (const id of ids) {
    const asset = cardboardAssets[id];
    if (!scene.textures.exists(asset.key)) scene.load.image(asset.key, asset.url);
  }
}

/** Height means the visible paper object, not its transparent image canvas. */
export function cardboardArt(
  scene: Phaser.Scene,
  id: CardboardAssetId,
  x: number,
  y: number,
  visibleHeight: number
): Phaser.GameObjects.Image {
  const asset = cardboardAssets[id];
  if (!scene.textures.exists(asset.key)) {
    throw new Error(`Cardboard asset "${id}" is not loaded. Call preloadCardboardArt first.`);
  }
  const object = scene.add.image(x, y, asset.key);
  object.setOrigin(asset.origin.x, asset.origin.y);
  object.setScale(visibleHeight / (asset.bounds[3] - asset.bounds[1]));
  return object;
}

/** Paper puppet walk: whole-cutout rocking. Pause with the scene; stop before death. */
export function rockCardboardPuppet(scene: Phaser.Scene, object: Phaser.GameObjects.Image) {
  return scene.tweens.add({
    targets: object,
    angle: { from: -3, to: 3 },
    duration: 180,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });
}
