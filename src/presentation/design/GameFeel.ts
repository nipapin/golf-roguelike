import type Phaser from 'phaser';
import { isShakeReduced } from '../juice/fxSettings';

/** Thin brass edge and shaded glass, without heavy nested frames. */
export function gildedPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number, compact = false) {
  const key = `glass-panel-${Math.round(width)}-${Math.round(height)}-${compact}`;
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, Math.ceil(width + 16) * 2, Math.ceil(height + 16) * 2)!;
    const ctx = texture.context;
    ctx.scale(2, 2);
    ctx.shadowColor = '#07172388'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 3;
    ctx.beginPath(); ctx.roundRect(8, 8, width, height, compact ? 12 : 18);
    const fill = ctx.createLinearGradient(8, 8, width + 8, height + 8);
    fill.addColorStop(0, '#355b68'); fill.addColorStop(.46, '#203747'); fill.addColorStop(1, '#122332');
    ctx.fillStyle = fill; ctx.fill(); ctx.shadowColor = 'transparent';
    const rim = ctx.createLinearGradient(8, 8, width + 8, height + 8);
    rim.addColorStop(0, '#dbbf8799'); rim.addColorStop(.5, '#77a8bb44'); rim.addColorStop(1, '#aa875866');
    ctx.strokeStyle = rim; ctx.lineWidth = 1.2; ctx.stroke();
    texture.refresh();
  }
  return scene.add.image(x - 8, y - 8, key).setOrigin(0).setDisplaySize(Math.ceil(width + 16), Math.ceil(height + 16));
}

export function siegeBackdrop(scene: Phaser.Scene, width: number, height: number) {
  const key = 'siege-felt-depth-v2';
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, 256, 256)!;
    const ctx = texture.context;
    const base = ctx.createLinearGradient(0, 0, 256, 256);
    base.addColorStop(0, '#284f60'); base.addColorStop(.55, '#1d3448'); base.addColorStop(1, '#111d35');
    ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
    const glow = ctx.createRadialGradient(90, 95, 0, 90, 95, 170);
    glow.addColorStop(0, '#398f8b66'); glow.addColorStop(1, '#398f8b00');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 256, 256); texture.refresh();
  }
  const image = scene.add.image(0, 0, key).setOrigin(0).setDisplaySize(width, height).setDepth(-10);
  if (!scene.textures.exists('siege-shimmer-v2')) {
    const texture = scene.textures.createCanvas('siege-shimmer-v2', 256, 256)!;
    const ctx = texture.context, glow = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    glow.addColorStop(0, '#6ba4d866'); glow.addColorStop(.55, '#ad79c522'); glow.addColorStop(1, '#ad79c500');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 256, 256); texture.refresh();
  }
  const sheen = scene.add.image(width * .6, height * .76, 'siege-shimmer-v2')
    .setDisplaySize(width, height * .85).setAlpha(.25).setDepth(-9);
  if (!isShakeReduced()) scene.tweens.add({ targets: sheen, x: width * .4, alpha: .5,
    duration: 7000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  return image;
}

export type Mood = 'happy' | 'angry' | 'worried' | 'surprised';

/** Sparse, bounded feedback. Effects never change game state or block card input. */
export class GameFeel {
  private live = new Set<Phaser.GameObjects.GameObject>();
  private reactions = new Map<string, number>();
  constructor(private scene: Phaser.Scene) {
    scene.events.once('shutdown', () => {
      for (const object of this.live) object.destroy();
      this.live.clear(); this.reactions.clear();
    });
  }
  motes(x: number, y: number, width: number, height: number, count = 12): void {
    if (isShakeReduced()) return;
    for (let i = 0; i < count; i++) {
      const px = x + width * (i + 0.5) / count;
      const py = y + height * (0.18 + (i * 0.37 % 0.7));
      const dust = this.scene.add.ellipse(px, py, i % 3 ? 2 : 3, 2, 0xffe9a1, 0.2).setDepth(2);
      this.scene.tweens.add({ targets: dust, x: px + 26, y: py - 12, alpha: 0.04,
        duration: 3500 + i * 270, delay: i * 170, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }
  burst(x: number, y: number, color: number, count = 7): void {
    for (let i = 0; i < Math.min(count, 14) && this.live.size < 60; i++) {
      const angle = i * Math.PI * 2 / count;
      const distance = 12 + (i % 3) * 7;
      const spark = this.scene.add.circle(x, y, i % 2 ? 1.4 : 2.2, color, 0.8).setDepth(186);
      this.live.add(spark);
      this.scene.tweens.add({ targets: spark, x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 8, alpha: 0, scale: 0.3,
        duration: 480 + i * 25, ease: 'Sine.out', onComplete: () => this.remove(spark) });
    }
  }
  emotion(x: number, y: number, mood: Mood, tag: string): void {
    const now = this.scene.time.now;
    if (now - (this.reactions.get(tag) ?? -Infinity) < 3600 || this.live.size >= 60) return;
    this.reactions.set(tag, now);
    const root = this.scene.add.container(x, y).setDepth(188).setScale(0.75).setAlpha(0);
    this.live.add(root);
    const face = this.scene.add.graphics();
    const color = mood === 'angry' ? 0xffb28b : mood === 'worried' ? 0xc1e7ee : 0xffeab1;
    face.fillStyle(0x142c34, 0.6).fillRoundedRect(-18, -15, 36, 28, 10);
    face.fillStyle(color).fillRoundedRect(-17, -17, 34, 27, 10);
    face.fillTriangle(-4, 8, 4, 8, 1, 14);
    face.fillStyle(0x29404a).fillCircle(-6, -6, 1.6).fillCircle(6, -6, 1.6);
    face.lineStyle(1.7, 0x29404a);
    if (mood === 'happy') face.beginPath().moveTo(-6, 0).lineTo(0, 4).lineTo(6, 0).strokePath();
    else if (mood === 'worried') face.beginPath().moveTo(-5, 3).lineTo(0, 0).lineTo(5, 3).strokePath();
    else if (mood === 'angry') {
      face.lineBetween(-9, -11, -3, -9).lineBetween(3, -9, 9, -11).lineBetween(-4, 2, 4, 2);
    } else face.strokeCircle(0, 2, 3);
    root.add(face);
    this.scene.tweens.add({ targets: root, alpha: 1, scale: 1, duration: 180, ease: 'Back.out' });
    this.scene.tweens.add({ targets: root, y: y - 7, alpha: 0, delay: 1000,
      duration: 320, ease: 'Sine.in', onComplete: () => this.remove(root) });
  }
  private remove(object: Phaser.GameObjects.GameObject): void {
    this.live.delete(object); object.destroy();
  }
}
