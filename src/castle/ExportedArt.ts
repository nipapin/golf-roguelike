import type Phaser from 'phaser';
import { assetUrl } from '../configurator/runtime';
import manifest from './exportedArt.json';
import config from './siegeArtConfig.json';
import { anchorActorAnimations } from './GeneratedActors';

export const siegeArtConfig = config;
export type ExportedAssetId = keyof typeof manifest.assets;
export const exportedActors: Record<string, ExportedAssetId | undefined> = {
  c_angel1: 'knight', c_angel2: 'archer',
};
export const exportedFrame = (index: number) => `frame-${String(index).padStart(4, '0')}`;

export function preloadExportedArt(scene: Phaser.Scene): void {
  for (const asset of Object.values(manifest.assets)) {
    if (!scene.textures.exists(asset.key))
      scene.load.multiatlas(asset.key, assetUrl(asset.atlas), '/assets/ae-export/');
  }
  for (const name of ['background', 'castle-cover', 'castle-gate']) {
    if (!scene.textures.exists(`ae-${name}`))
      scene.load.image(`ae-${name}`, assetUrl(`/assets/ae-export/${name}.webp`));
  }
  for (const [name, style] of Object.entries(config.projectiles)) {
    const file = style.file as string | null;
    if (file && !scene.textures.exists(projectileTexture(name)))
      scene.load.image(projectileTexture(name), assetUrl(file));
  }
}

export function createExportedAnimations(scene: Phaser.Scene): void {
  for (const [id, asset] of Object.entries(manifest.assets)) {
    const aliases = [asset.key, ...Object.keys(exportedActors).filter(key => exportedActors[key] === id)];
    for (const prefix of aliases) {
      for (const [action, animation] of Object.entries(asset.animations)) {
        const key = `${prefix}-${action}`;
        if (!scene.anims.exists(key)) scene.anims.create({
          key,
          frames: Array.from({ length: animation.end - animation.start + 1 }, (_, i) => ({
            key: asset.key, frame: exportedFrame(animation.start + i),
          })),
          frameRate: animation.frameRate, repeat: animation.repeat,
        });
      }
      for (const action of ['walk', 'hurt', 'dead']) {
        const key = `${prefix}-${action}`;
        if (!scene.anims.exists(key)) scene.anims.create({
          key, frames: [{ key: asset.key, frame: exportedFrame(asset.animations.idle.start) }],
          duration: action === 'hurt' ? 180 : 500, repeat: action === 'walk' ? -1 : 0,
        });
      }
    }
  }
}

export function exportedSprite(
  scene: Phaser.Scene, id: ExportedAssetId, x: number, y: number, height: number,
): Phaser.GameObjects.Sprite {
  const asset = manifest.assets[id];
  const [left, top, right, bottom] = asset.bounds;
  const sprite = scene.add.sprite(x, y, asset.key, exportedFrame(asset.animations.idle.start))
    .setOrigin((left + right) / 2 / asset.frameWidth, bottom / asset.frameHeight)
    .setScale(height / (bottom - top));
  if (id === 'knight' || id === 'archer') anchorActorAnimations(scene, sprite, height);
  sprite.on('animationcomplete', (animation: Phaser.Animations.Animation) => {
    if (!sprite.active || !/-(attack|reveal|hurt)$/.test(animation.key)) return;
    const idle = animation.key.replace(/-(attack|reveal|hurt)$/, '-idle');
    if (scene.anims.exists(idle)) sprite.play(idle);
  });
  return sprite;
}

export function attackReleaseDelay(id: 'archer' | 'cannon'): number {
  const attack = manifest.assets[id].animations.attack;
  return Math.max(0, config.attacks[id].releaseFrame - attack.start) * 1000 / attack.frameRate;
}

export function projectileTexture(name: string): string {
  const style = config.projectiles[name as keyof typeof config.projectiles];
  return style.file ? `ae-projectile-${name}` : style.texture ?? '';
}

export type ProjectileStyle = {
  texture: string | null; file: string | null; animation: string | null;
  width: number; height: number; angleOffset: number; arc: number; duration: number; tint: string;
};
export function createSiegeProjectile(scene: Phaser.Scene, name: keyof typeof config.projectiles,
  x: number, y: number): Phaser.GameObjects.Sprite | Phaser.GameObjects.Container {
  const style: ProjectileStyle = config.projectiles[name];
  const texture = projectileTexture(name);
  if (texture && scene.textures.exists(texture)) {
    const sprite = scene.add.sprite(x, y, texture)
      .setTint(Number.parseInt(style.tint.slice(1), 16)).setDepth(100);
    if (style.animation && scene.anims.exists(style.animation)) sprite.play(style.animation);
    return sprite.setDisplaySize(style.width, style.height);
  }
  const radius = style.width / 2;
  return scene.add.container(x, y, [
    scene.add.circle(0, 0, radius, 0x263640).setStrokeStyle(1, 0x111e26),
    scene.add.circle(-radius * 0.3, -radius * 0.3, radius * 0.3, 0x758c98),
  ]).setDepth(100);
}
