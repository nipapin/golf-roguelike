import type Phaser from 'phaser';
import { isShakeReduced } from '../presentation/juice/fxSettings';

/** Short-lived entrance, grounded at the actor's feet and drawn behind the invader. */
export function enemyPortal(scene: Phaser.Scene, x: number, y: number, size = 64): Phaser.GameObjects.Container {
  const reduced = isShakeReduced();
  const root = scene.add.container(x, y).setDepth(31).setName('enemy-portal');
  const glow = scene.add.graphics();
  glow.fillStyle(0xa044ff, 0.12).fillEllipse(0, -size * 0.49, size * 0.86, size * 1.12);
  glow.fillStyle(0x772cd5, 0.22).fillEllipse(0, -size * 0.49, size * 0.7, size);
  glow.fillStyle(0x211237, 0.92).fillEllipse(0, -size * 0.49, size * 0.49, size * 0.92);
  glow.lineStyle(3, 0xc478ff, 0.9).strokeEllipse(0, -size * 0.49, size * 0.55, size * 0.97);
  glow.lineStyle(1.5, 0xffccff, 0.85).strokeEllipse(0, -size * 0.49, size * 0.48, size * 0.9);
  glow.fillStyle(0xbd65ff, 0.2).fillEllipse(0, -1, size * 0.78, size * 0.13);
  root.add(glow);
  if (!reduced) {
    const sparks = scene.add.graphics();
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7;
      const sx = Math.cos(angle) * size * 0.28, sy = -size * 0.49 + Math.sin(angle) * size * 0.46;
      sparks.fillStyle(i % 2 ? 0xe3b2ff : 0x9f61ff, 0.85).fillCircle(sx, sy, i % 2 ? 1.6 : 2.4);
    }
    root.add(sparks);
    scene.tweens.add({ targets: sparks, alpha: 0.3, duration: 280, yoyo: true, repeat: 1 });
  }
  root.setScale(reduced ? 1 : 0.15, reduced ? 1 : 0.7).setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, scaleX: 1, scaleY: 1,
    duration: reduced ? 100 : 220, ease: 'Sine.out',
    onComplete: () => scene.tweens.add({ targets: root, alpha: 0,
      scaleX: reduced ? 1 : 0.18, delay: reduced ? 350 : 650,
      duration: reduced ? 160 : 280, ease: 'Sine.in', onComplete: () => root.destroy() }),
  });
  root.once('destroy', () => {
    scene.tweens.killTweensOf(root);
    scene.tweens.killTweensOf(glow);
    for (const child of root.list) scene.tweens.killTweensOf(child);
  });
  return root;
}
