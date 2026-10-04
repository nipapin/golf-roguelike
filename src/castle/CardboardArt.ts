import { assetUrl } from '../configurator/runtime';
import type Phaser from 'phaser';
import { cardboardAssets, type CardboardAssetId } from './CardboardAssets';
import runtime from './cardboardRuntime.json';
import { exportedActors, exportedSprite } from './ExportedArt';
import { generatedActorSprite } from './GeneratedActors';

export const siegeActors = {
  c_angel1: 'soldier',
  c_angel2: 'archer',
  c_orc: 'orc',
  c_goblin: 'goblin',
  c_reaper2: 'reaper',
  c_ogre: 'ogre-boss',
  c_reaper1: 'reaper-boss',
} as const;

/** Cropped delivery copies keep the visible base anchored at y. */
export function preloadCardboardArt(scene: Phaser.Scene): void {
  for (const [id, asset] of Object.entries(cardboardAssets)) {
    if (!scene.textures.exists(asset.key))
      scene.load.image(asset.key, assetUrl(`/assets/cardboard-runtime/${id}.webp`));
  }
}

export function cardboardArt(
  scene: Phaser.Scene,
  id: CardboardAssetId,
  x: number,
  y: number,
  height: number
): Phaser.GameObjects.Image {
  return scene.add
    .image(x, y, cardboardAssets[id].key)
    .setOrigin(0.5, 1)
    .setScale(height / artHeight(scene, id));
}

export function cardboardActor(
  scene: Phaser.Scene,
  actor: keyof typeof siegeActors,
  x: number,
  y: number,
  height: number
): Phaser.GameObjects.Sprite {
  const exported = exportedActors[actor];
  if (exported && scene.textures.exists(`ae-${exported}`))
    return exportedSprite(scene, exported, x, y, height);
  const generated = generatedActorSprite(scene, actor, x, y, height);
  if (generated) return generated;
  const id = siegeActors[actor];
  return scene.add
    .sprite(x, y, cardboardAssets[id].key)
    .setOrigin(0.5, 1)
    .setScale(height / artHeight(scene, id));
}

/** Keep existing action names while animating whole paper puppets with transforms. */
export function createCardboardAnimations(scene: Phaser.Scene): void {
  for (const [actor, id] of Object.entries(siegeActors)) {
    for (const action of ['idle', 'walk', 'attack', 'hurt', 'dead']) {
      const key = `${actor}-${action}`;
      if (!scene.anims.exists(key))
        scene.anims.create({
          key,
          frames: [{ key: cardboardAssets[id as CardboardAssetId].key }],
          duration: action === 'attack' ? 240 : action === 'hurt' ? 180 : 500,
          repeat: action === 'idle' || action === 'walk' ? -1 : 0,
        });
    }
  }
}

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

// Replacement images retain the intended visual height even with different dimensions.
function artHeight(scene: Phaser.Scene, id: CardboardAssetId): number {
  const url = `/assets/cardboard-runtime/${id}.webp`;
  return assetUrl(url) === url ? runtime[id].height
    : scene.textures.get(cardboardAssets[id].key).getSourceImage().height;
}
