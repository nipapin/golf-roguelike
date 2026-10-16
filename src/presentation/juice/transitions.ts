/**
 * Scene transition effects for smooth, polished gameplay.
 */

import type Phaser from 'phaser';
import { viewport } from '../design/viewport';
import { isShakeReduced } from './fxSettings';

export interface TransitionOptions {
  duration?: number;
  color?: number;
  ease?: string;
}

/** Fade the camera out, then call onComplete (which should start the next scene). */
export function fadeOut(
  scene: Phaser.Scene,
  onComplete: () => void,
  options: TransitionOptions = {}
): void {
  const { duration = 300, color = 0x142638 } = options;
  const reduced = isShakeReduced();
  
  if (reduced) {
    onComplete();
    return;
  }
  
  scene.cameras.main.fadeOut(duration, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff);
  scene.cameras.main.once('camerafadeoutcomplete', onComplete);
}

/** Fade the camera in from a color. */
export function fadeIn(scene: Phaser.Scene, options: TransitionOptions = {}): void {
  const { duration = 300, color = 0x142638 } = options;
  const reduced = isShakeReduced();
  
  if (reduced) return;
  
  scene.cameras.main.fadeIn(duration, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff);
}

/** Wipe transition using a rectangle that slides across. */
export function wipeIn(scene: Phaser.Scene, options: TransitionOptions = {}): void {
  const { duration = 400, color = 0x142638, ease = 'Cubic.out' } = options;
  const reduced = isShakeReduced();
  
  if (reduced) return;
  
  const { width, height } = viewport(scene);
  const wipe = scene.add.rectangle(0, height / 2, width * 2, height, color)
    .setOrigin(0, 0.5)
    .setDepth(9999);
  
  scene.tweens.add({
    targets: wipe,
    x: -width * 2,
    duration,
    ease,
    onComplete: () => wipe.destroy(),
  });
}

/** Flash white on big moments. */
export function screenFlash(
  scene: Phaser.Scene,
  intensity: number = 0.3,
  duration: number = 150
): void {
  const reduced = isShakeReduced();
  if (reduced) return;
  
  scene.cameras.main.flash(duration, 255, 255, 255, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
    // Custom alpha curve - quick flash then fade
    return intensity * Math.sin(progress * Math.PI);
  });
}

/** Victory celebration effect with particles. */
export function celebrationBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  count: number = 24
): void {
  const reduced = isShakeReduced();
  const particleCount = reduced ? Math.ceil(count / 3) : count;
  
  const colors = [0xffd646, 0xff6b84, 0x7ceaff, 0xa8ff7c, 0xffa55c];
  
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const speed = 200 + Math.random() * 200;
    const size = 4 + Math.random() * 6;
    const color = colors[i % colors.length];
    
    const particle = scene.add.circle(x, y, size, color)
      .setDepth(9000)
      .setAlpha(0.9);
    
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 150; // Initial upward bias
    
    scene.tweens.add({
      targets: particle,
      x: x + vx * 0.8,
      y: y + vy * 0.8 + 200, // Gravity
      alpha: 0,
      scale: 0.3,
      duration: reduced ? 400 : 800 + Math.random() * 400,
      ease: 'Quad.out',
      onComplete: () => particle.destroy(),
    });
  }
}

/** Confetti burst for victories. */
export function confettiBurst(scene: Phaser.Scene): void {
  const reduced = isShakeReduced();
  const { width, height } = viewport(scene);
  
  const count = reduced ? 15 : 40;
  const colors = [0xffd646, 0xff6b84, 0x7ceaff, 0xa8ff7c, 0xffa55c, 0xd8b0ff];
  
  for (let i = 0; i < count; i++) {
    const x = Math.random() * width;
    const delay = Math.random() * (reduced ? 100 : 300);
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    const confetti = scene.add.rectangle(x, -10, 6 + Math.random() * 4, 10 + Math.random() * 6, color)
      .setDepth(9000)
      .setAngle(Math.random() * 360)
      .setAlpha(0);
    
    scene.tweens.add({
      targets: confetti,
      y: height + 50,
      angle: confetti.angle + (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360),
      alpha: { from: 0.9, to: 0 },
      delay,
      duration: reduced ? 800 : 1500 + Math.random() * 500,
      ease: 'Quad.in',
      onComplete: () => confetti.destroy(),
    });
  }
}
