import Phaser from 'phaser';
import { JUICE, damageColor, damageFontSize } from './juiceConfig';
import { isShakeReduced } from './fxSettings';
import { getRenderDensity, viewport } from '../design/viewport';

/** Procedural particle textures, generated once per game. */
export function ensureFxTextures(scene: Phaser.Scene): void {
  const tex = scene.textures;
  if (!tex.exists('fx-spark')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.beginPath(); g.moveTo(16, 0); g.lineTo(19, 13); g.lineTo(32, 16); g.lineTo(19, 19); g.lineTo(16, 32); g.lineTo(13, 19); g.lineTo(0, 16); g.lineTo(13, 13); g.closePath(); g.fillPath();
    g.generateTexture('fx-spark', 32, 32); g.destroy();
  }
  if (!tex.exists('fx-dot')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    for (let r = 16; r > 0; r -= 2) { g.fillStyle(0xffffff, 0.12 + (1 - r / 16) * 0.5); g.fillCircle(16, 16, r); }
    g.generateTexture('fx-dot', 32, 32); g.destroy();
  }
  if (!tex.exists('fx-shard')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1); g.fillTriangle(0, 4, 20, 0, 20, 8); g.fillStyle(0xffffff, 0.6); g.fillTriangle(20, 0, 24, 4, 20, 8);
    g.generateTexture('fx-shard', 24, 8); g.destroy();
  }
  if (!tex.exists('fx-vignette') && typeof document !== 'undefined') {
    const canvas = tex.createCanvas('fx-vignette', 256, 512);
    const ctx = canvas?.getContext();
    if (canvas && ctx) {
      const grad = ctx.createRadialGradient(128, 256, 60, 128, 256, 300);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.15)');
      grad.addColorStop(1, 'rgba(255,255,255,1)');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 512);
      canvas.refresh();
    }
  }
}

interface TimeEffect { scale: number; until: number }

/**
 * Per-scene juice toolkit. Particles use pooled Phaser emitters; damage numbers,
 * coins and rings come from fixed pools created up front (no per-frame allocation).
 */
export class Juice {
  private scene: Phaser.Scene;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private shards: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private trail: Phaser.GameObjects.Particles.ParticleEmitter;
  private numbers: Phaser.GameObjects.Text[] = [];
  private numberCursor = 0;
  private coins: Phaser.GameObjects.Image[] = [];
  private coinCursor = 0;
  private rings: Phaser.GameObjects.Arc[] = [];
  private ringCursor = 0;
  private vignette: Phaser.GameObjects.Image | null = null;
  private flash: Phaser.GameObjects.Rectangle;
  private timeEffects: TimeEffect[] = [];
  private timeHandle = 0;
  private destroyed = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    ensureFxTextures(scene);
    const { width, height } = viewport(scene);
    const s = JUICE.sparks;
    this.sparks = scene.add.particles(0, 0, 'fx-spark', {
      emitting: false, speed: { min: s.speedMin, max: s.speedMax }, angle: { min: 0, max: 360 },
      lifespan: { min: s.lifespan * 0.6, max: s.lifespan }, scale: { start: 0.7, end: 0 }, alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 }, gravityY: 380, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(420);
    this.shards = scene.add.particles(0, 0, 'fx-shard', {
      emitting: false, speed: { min: 200, max: 560 }, angle: { min: 0, max: 360 }, lifespan: { min: 260, max: 520 },
      scale: { start: 1, end: 0.2 }, alpha: { start: 1, end: 0 }, rotate: { onEmit: (p?: Phaser.GameObjects.Particles.Particle) => (p ? Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)) : 0) },
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(421);
    this.dust = scene.add.particles(0, 0, 'fx-dot', {
      emitting: false, speed: { min: 30, max: 110 }, angle: { min: 180, max: 360 }, lifespan: { min: 260, max: 460 },
      scale: { start: 0.55, end: 0.05 }, alpha: { start: 0.75, end: 0 }, gravityY: -40,
    }).setDepth(190);
    const c = JUICE.cards;
    this.trail = scene.add.particles(0, 0, 'fx-dot', {
      emitting: false, frequency: c.trailFrequency, lifespan: c.trailLifespan, speed: { min: 0, max: 20 },
      scale: { start: 0.9, end: 0 }, alpha: { start: 0.7, end: 0 }, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(179);
    for (let i = 0; i < JUICE.numbers.poolSize; i++) {
      const t = scene.add.text(0, 0, '', { resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '32px', color: '#ffffff' })
        .setOrigin(0.5).setStroke('#1B1030', 7).setShadow(0, 4, '#1B1030', 0, true, true).setDepth(430).setVisible(false);
      this.numbers.push(t);
    }
    for (let i = 0; i < JUICE.death.coinCount + 4; i++) {
      this.coins.push(scene.add.image(0, 0, 'coin').setDisplaySize(22, 22).setDepth(440).setVisible(false));
    }
    for (let i = 0; i < 4; i++) {
      this.rings.push(scene.add.circle(0, 0, 20).setStrokeStyle(4, 0xffffff, 1).setDepth(415).setVisible(false));
    }
    if (scene.textures.exists('fx-vignette')) {
      this.vignette = scene.add.image(width / 2, height / 2, 'fx-vignette').setDisplaySize(width, height).setDepth(950).setAlpha(0).setTint(0xff1a2e);
    }
    this.flash = scene.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 1).setDepth(949).setAlpha(0);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  // ---- time: hit-stop & slow-mo (real-time timers; the game clock itself is scaled) ----
  hitStop(ms: number): void { this.pushTime(JUICE.hitStop.scale, ms); }
  slowMo(ms: number = JUICE.slowMo.ms, scale: number = JUICE.slowMo.scale): void { this.pushTime(scale, ms); }

  private pushTime(scale: number, ms: number): void {
    if (this.destroyed) return;
    const now = performance.now();
    this.timeEffects.push({ scale, until: now + ms });
    this.applyTime();
  }

  private applyTime(): void {
    if (this.destroyed) return;
    const now = performance.now();
    this.timeEffects = this.timeEffects.filter((e) => e.until > now);
    const scale = this.timeEffects.reduce((min, e) => Math.min(min, e.scale), 1);
    this.setTimeScale(scale);
    window.clearTimeout(this.timeHandle);
    if (this.timeEffects.length) {
      const next = Math.min(...this.timeEffects.map((e) => e.until));
      this.timeHandle = window.setTimeout(() => this.applyTime(), Math.max(1, next - now));
    }
  }

  private setTimeScale(scale: number): void {
    const scene = this.scene;
    scene.tweens.timeScale = scale;
    scene.time.timeScale = scale;
    scene.anims.globalTimeScale = scale;
    for (const emitter of [this.sparks, this.shards, this.dust, this.trail]) emitter.timeScale = Math.max(scale, 0.05);
  }

  // ---- camera ----
  shake(intensity: number, ms: number): void {
    if (this.destroyed) return;
    const factor = isShakeReduced() ? JUICE.shake.reducedFactor : 1;
    if (factor <= 0 || intensity <= 0) return;
    this.scene.cameras.main.shake(ms, intensity * factor, true);
  }

  screenFlash(color = 0xffffff, alpha: number = JUICE.screenFlash.finisherAlpha, ms: number = JUICE.screenFlash.ms): void {
    const a = isShakeReduced() ? alpha * 0.5 : alpha;
    this.scene.tweens.killTweensOf(this.flash);
    this.flash.setFillStyle(color, 1).setAlpha(a);
    this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: ms, ease: 'Quad.out' });
  }

  vignetteFlash(color = 0xff1a2e): void {
    if (!this.vignette) return;
    const p = JUICE.player;
    this.scene.tweens.killTweensOf(this.vignette);
    this.vignette.setTint(color).setAlpha(p.vignetteAlpha);
    this.scene.tweens.add({ targets: this.vignette, alpha: 0, duration: p.vignetteMs, ease: 'Quad.in' });
  }

  // ---- particles ----
  sparkBurst(x: number, y: number, count: number, tint = 0xffe08a): void {
    this.sparks.particleTint = tint;
    this.sparks.explode(Math.round(count), x, y);
  }
  shardBurst(x: number, y: number, count: number, tint = 0xffffff): void {
    this.shards.particleTint = tint;
    this.shards.explode(Math.round(count), x, y);
  }
  dustPuff(x: number, y: number, count: number = JUICE.cards.dustCount, tint = 0xfff3d0): void {
    this.dust.particleTint = tint;
    this.dust.explode(count, x, y);
  }
  startTrail(target: Phaser.GameObjects.Container, offsetX: number, offsetY: number, tint = 0xffe7a0): void {
    this.trail.particleTint = tint;
    this.trail.startFollow(target, offsetX, offsetY);
    this.trail.start();
  }
  stopTrail(): void {
    this.trail.stop();
    this.trail.stopFollow();
  }

  ring(x: number, y: number, color: number, toScale = 4, ms = 380, width = 4): void {
    const ring = this.rings[this.ringCursor++ % this.rings.length];
    this.scene.tweens.killTweensOf(ring);
    ring.setPosition(x, y).setScale(0.4).setAlpha(1).setVisible(true).setStrokeStyle(width, color, 1);
    this.scene.tweens.add({ targets: ring, scale: toScale, alpha: 0, duration: ms, ease: 'Cubic.out', onComplete: () => ring.setVisible(false) });
  }

  // ---- numbers ----
  /** Punchy damage number: pop scale, arc, colour by size. */
  damageNumber(x: number, y: number, value: number, opts: { chain?: number; crit?: boolean; color?: string; size?: number; prefix?: string; small?: boolean } = {}): void {
    const n = JUICE.numbers;
    const text = this.numbers[this.numberCursor++ % this.numbers.length];
    this.scene.tweens.killTweensOf(text);
    const size = opts.size ?? (opts.small ? n.routineSize : damageFontSize(value, opts.chain ?? 1));
    const color = opts.color ?? (opts.crit ? n.critColor : damageColor(value));
    text.setText(`${opts.prefix ?? ''}${value}`).setFontSize(size).setColor(color)
      .setStroke('#1B1030', Math.max(4, Math.round(size / 6)))
      .setPosition(x, y).setScale(0.3).setAlpha(1).setAngle(Phaser.Math.Between(-8, 8)).setVisible(true);
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.scene.tweens.add({ targets: text, scale: opts.small ? 1 : n.popScale, duration: n.popMs, ease: 'Back.out', onComplete: () => {
      this.scene.tweens.add({ targets: text, scale: 1, duration: n.popMs, ease: 'Quad.out' });
    } });
    this.scene.tweens.add({ targets: text, x: x + dir * n.arcPx * (opts.small ? 0.5 : 1), duration: n.riseMs, ease: 'Sine.out' });
    this.scene.tweens.add({ targets: text, y: y - n.risePx * (opts.small ? 0.6 : 1), duration: n.riseMs * 0.55, ease: 'Quad.out', onComplete: () => {
      this.scene.tweens.add({ targets: text, y: text.y + 14, alpha: 0, duration: n.riseMs * 0.45, ease: 'Quad.in', onComplete: () => text.setVisible(false) });
    } });
  }

  // ---- coins ----
  coinBurst(fromX: number, fromY: number, toX: number, toY: number, count: number = JUICE.death.coinCount, onArrive?: () => void): void {
    const d = JUICE.death;
    for (let i = 0; i < count; i++) {
      const coin = this.coins[this.coinCursor++ % this.coins.length];
      this.scene.tweens.killTweensOf(coin);
      const angle = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 50;
      coin.setPosition(fromX, fromY).setVisible(true).setAlpha(1).setDisplaySize(22, 22).setAngle(0);
      this.scene.tweens.add({ targets: coin, x: fromX + Math.cos(angle) * r, y: fromY + Math.sin(angle) * r * 0.7 - 20, duration: 160, ease: 'Quad.out', delay: i * d.coinStaggerMs, onComplete: () => {
        this.scene.tweens.add({ targets: coin, x: toX, y: toY, angle: 360, displayWidth: 16, displayHeight: 16, duration: d.coinFlightMs, ease: 'Cubic.in', onComplete: () => { coin.setVisible(false); onArrive?.(); } });
      } });
    }
  }

  // ---- sprites ----
  /** White flash for a sprite, restoring its previous tint afterwards. */
  flashWhite(sprite: Phaser.GameObjects.Sprite, ms: number = JUICE.enemy.flashMs, restoreTint?: number): void {
    sprite.setTintFill(0xffffff);
    window.setTimeout(() => {
      if (!sprite.active) return;
      if (restoreTint !== undefined) sprite.setTint(restoreTint); else sprite.clearTint();
    }, ms);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.clearTimeout(this.timeHandle);
    // Never leave the shared animation manager slowed down.
    this.scene.anims.globalTimeScale = 1;
    this.scene.tweens.timeScale = 1;
    this.scene.time.timeScale = 1;
  }
}
