import type Phaser from 'phaser';
import { assetUrl } from '../configurator/runtime';
import sheets from '../../public/assets/generated-animations-v1/animations.json';
import exported from './exportedArt.json';

type Clip = { start: number; end: number; frameRate: number; repeat: number; asset?: string };
type Sheet = { key: string; file: string; atlas: string; animations: Record<string, Clip> };
const actorSheets: Record<string, string> = {
  c_angel1: 'knight-extra', c_angel2: 'archer-extra', c_orc: 'orc', c_goblin: 'goblin',
  c_reaper2: 'reaper', c_ogre: 'ogre-boss', c_reaper1: 'reaper-boss',
};
const assets: Sheet[] = sheets.map(sheet => ({ ...sheet,
  animations: Object.fromEntries(Object.entries(sheet.animations)
    .filter((entry): entry is [string, Clip] => entry[1] !== undefined)),
}));
const frameName = (index: number) => `frame-${String(index).padStart(4, '0')}`;
export const generatedActorTexture = (key: string) => `generated-actor-${key}`;

export function preloadGeneratedActors(scene: Phaser.Scene): void {
  for (const sheet of assets) {
    const key = generatedActorTexture(sheet.key);
    if (!scene.textures.exists(key)) scene.load.atlas(key,
      assetUrl(`/assets/generated-animations-v1/${sheet.file}`),
      assetUrl(`/assets/generated-animations-v1/${sheet.atlas}`));
  }
}

/** Register before the AE/fallback clips; their walk and attack keep precedence for allies. */
export function createGeneratedActorAnimations(scene: Phaser.Scene): void {
  for (const [actor, sheetKey] of Object.entries(actorSheets)) {
    const sheet = assets.find(asset => asset.key === sheetKey)!;
    const ally = actor === 'c_angel1' || actor === 'c_angel2';
    const aliases = ally ? [actor, actor === 'c_angel1' ? 'ae-knight' : 'ae-archer'] : [actor];
    for (const prefix of aliases) {
      for (const [action, clip] of Object.entries(sheet.animations)) {
        if (ally && action !== 'hurt' && action !== 'dead') continue;
        const key = `${prefix}-${action}`;
        if (!scene.anims.exists(key)) scene.anims.create({
          key, frames: Array.from({ length: clip.end - clip.start + 1 }, (_, i) => ({
            key: generatedActorTexture(clip.asset ?? sheet.key), frame: frameName(clip.start + i),
          })), frameRate: clip.frameRate, repeat: clip.repeat,
        });
      }
      if (!ally && !scene.anims.exists(`${prefix}-idle`)) scene.anims.create({
        key: `${prefix}-idle`,
        frames: [{ key: generatedActorTexture(sheet.key), frame: frameName(0) }],
        frameRate: 6, repeat: -1,
      });
    }
  }
}

export function actorDeathDuration(actor: string): number {
  const clip = assets.find(asset => asset.key === actorSheets[actor])?.animations.dead;
  return clip ? (clip.end - clip.start + 1) * 1000 / clip.frameRate : 500;
}

type Geometry = { center: number; bottom: number; height: number };
function geometry(scene: Phaser.Scene, key: string): Geometry | undefined {
  const ae = Object.values(exported.assets).find(asset => asset.key === key);
  if (ae) {
    const [left, top, right, bottom] = ae.bounds;
    return { center: (left + right) / 2, bottom, height: bottom - top };
  }
  if (!key.startsWith('generated-actor-')) return;
  const frame = scene.textures.get(key).get(frameName(0));
  return { center: frame.x + frame.width / 2, bottom: frame.y + frame.height, height: frame.height };
}

/** A new sheet has a different canvas/padding; use its upright pose to preserve visible size/feet. */
export function anchorActorAnimations(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite,
  height: number): void {
  sprite.setData('actorHeight', height);
  const apply = () => {
    const bounds = geometry(scene, sprite.texture.key);
    if (!bounds) return;
    // Generated poses were padded independently. Their foot/corpse baseline moves inside
    // the source cell, so anchor its current trimmed bottom without enlarging a collapsed pose.
    const bottom = sprite.texture.key.startsWith('generated-actor-')
      ? sprite.frame.y + sprite.frame.height : bounds.bottom;
    sprite.setOrigin(bounds.center / sprite.frame.realWidth, bottom / sprite.frame.realHeight)
      .setScale(height / bounds.height);
  };
  apply();
  sprite.on('animationstart', apply);
  sprite.on('animationupdate', apply);
}

export function generatedActorSprite(scene: Phaser.Scene, actor: string, x: number, y: number,
  height: number): Phaser.GameObjects.Sprite | undefined {
  const sheet = actorSheets[actor];
  const key = generatedActorTexture(sheet);
  if (!sheet || !scene.textures.exists(key)) return;
  const sprite = scene.add.sprite(x, y, key, frameName(0));
  anchorActorAnimations(scene, sprite, height);
  return sprite;
}
