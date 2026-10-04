import Phaser from 'phaser';

export const VFX_KEYS = ['slash', 'heal', 'shield', 'smoke', 'reward', 'stagger', 'magic'] as const;
export type CombatEffect = typeof VFX_KEYS[number];
const activeEffects = new WeakMap<Phaser.Scene, number>();

export function createCombatAnimations(scene: Phaser.Scene): void {
  for (const key of VFX_KEYS) {
    const texture = 'vfx-' + key;
    if (!scene.textures.exists(texture) || scene.anims.exists(texture)) continue;
    const frames = scene.textures.get(texture).getFrameNames().sort((a, b) => Number(a.split('-').at(-1)) - Number(b.split('-').at(-1)));
    scene.anims.create({ key: texture, frames: frames.map(frame => ({ key: texture, frame })), frameRate: key === 'slash' ? 40 : 28, repeat: 0 });
  }
}

/** A one-shot flipbook, cleaned up at completion and confined to the arena/HUD. */
export function playCombatVFX(scene: Phaser.Scene, key: CombatEffect, x: number, y: number, size: number, tint?: number, angle = 0): void {
  const texture = 'vfx-' + key;
  if (!scene.anims.exists(texture) || (activeEffects.get(scene) ?? 0) >= 16) return;
  const sprite = scene.add.sprite(x, y, texture).setDisplaySize(size, size).setDepth(185).setAngle(angle).setAlpha(0.72);
  activeEffects.set(scene, (activeEffects.get(scene) ?? 0) + 1);
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => activeEffects.set(scene, Math.max(0, (activeEffects.get(scene) ?? 1) - 1)));
  if (tint !== undefined) sprite.setTint(tint);
  const animation = scene.anims.get(texture);
  scene.tweens.add({ targets: sprite, alpha: 0, delay: Math.max(80, animation.duration - 200), duration: 200 });
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
  sprite.play(texture);
}
