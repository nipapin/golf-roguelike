import { getRenderDensity } from './viewport';
/**
 * HUD Components - Chips, HP bars, Combo banner, Intent bubble
 * Per STYLE.md section 7: dark semi-transparent pills, outlined text
 */

import Phaser from 'phaser';
import { colors, getComboTier } from './tokens';
import { JUICE } from '../juice/juiceConfig';

/**
 * Chip - small stat display (gold, armor, etc)
 */
export function createChip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  iconColor: number,
  iconChar: string,
  value: number
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const height = 30;
  const padding = 10;
  const iconSize = 26;

  const valueText = scene.add
    .text(iconSize / 2, 0, value.toString(), {
      resolution: getRenderDensity(), fontFamily: 'Lilita One',
      fontSize: '18px',
      color: '#ffffff',
    })
    .setOrigin(0, 0.5)
    .setStroke('#1B1030', 5)
    .setShadow(0, 1.5, '#1B1030', 0, true, true);

  const width = iconSize + valueText.width + padding;

  // Background pill
  const bg = scene.add.graphics();
  bg.fillStyle(0x281450, 1);
  bg.fillGradientStyle(0x281450, 0x281450, 0x1b1030, 0x1b1030, 0.85);
  bg.fillRoundedRect(-iconSize / 2 - 6, -height / 2, width + 12, height, height / 2);
  bg.lineStyle(2.5, colors.ink, 1);
  bg.strokeRoundedRect(-iconSize / 2 - 6, -height / 2, width + 12, height, height / 2);

  // Icon circle
  const iconBg = scene.add.graphics();
  iconBg.fillStyle(iconColor, 1);
  iconBg.fillCircle(-iconSize / 2, 0, iconSize / 2);
  iconBg.lineStyle(2, colors.ink, 1);
  iconBg.strokeCircle(-iconSize / 2, 0, iconSize / 2);

  // Icon text/symbol
  const iconText = scene.add
    .text(-iconSize / 2, -1, iconChar, {
      resolution: getRenderDensity(), fontFamily: 'Arial',
      fontSize: `${iconSize * 0.6}px`,
      color: '#ffffff',
    })
    .setOrigin(0.5)
    .setStroke('#1B1030', 2);

  container.add([bg, iconBg, iconText, valueText]);
  return container;
}

/**
 * HP Bar - enemy or player health display
 */
export class HPBar {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private fillGraphics: Phaser.GameObjects.Graphics;
  private previewGraphics: Phaser.GameObjects.Graphics;
  private ghostGraphics: Phaser.GameObjects.Graphics;
  /** Delayed "ghost" value that drains after a chunk of HP is lost. */
  private ghost = { hp: 0 };
  private ghostTween: Phaser.Tweens.Tween | null = null;
  private baseX: number;
  private hpText: Phaser.GameObjects.Text;
  private previewText: Phaser.GameObjects.Text;
  private width: number;
  private height: number;
  private maxHp: number;
  private currentHp: number;
  private pendingDamage: number = 0;
  private isPlayer: boolean;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    maxHp: number,
    isPlayer: boolean = false
  ) {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.isPlayer = isPlayer;

    this.container = scene.add.container(x, y);
    this.baseX = x;
    this.ghost.hp = maxHp;

    // Track background
    const trackBg = scene.add.graphics();
    trackBg.fillStyle(colors.hpTrackHi, 1);
    trackBg.fillGradientStyle(colors.hpTrackHi, colors.hpTrackHi, colors.hpTrackLo, colors.hpTrackLo, 1);
    trackBg.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    trackBg.lineStyle(3, colors.ink, 1);
    trackBg.strokeRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    this.container.add(trackBg);

    // Ghost (recently lost HP) fill, drawn behind the live fill
    this.ghostGraphics = scene.add.graphics();
    this.container.add(this.ghostGraphics);

    // Preview (pending damage) fill
    this.previewGraphics = scene.add.graphics();
    this.container.add(this.previewGraphics);

    // HP fill
    this.fillGraphics = scene.add.graphics();
    this.container.add(this.fillGraphics);

    // HP text
    this.hpText = scene.add
      .text(0, 1, `${maxHp}/${maxHp}`, {
        resolution: getRenderDensity(), fontFamily: 'Lilita One',
        fontSize: '17px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 6)
      .setShadow(0, 1, '#1B1030', 0, true, true);
    this.container.add(this.hpText);

    // Preview damage text (right side)
    this.previewText = scene.add
      .text(width / 2 - 8, 1, '', {
        resolution: getRenderDensity(), fontFamily: 'Lilita One',
        fontSize: '15px',
        color: '#FFF3B0',
      })
      .setOrigin(1, 0.5)
      .setStroke('#1B1030', 4);
    this.previewText.setVisible(false);
    this.container.add(this.previewText);

    this.updateFill();
  }

  setHp(current: number, max?: number): void {
    if (max !== undefined) this.maxHp = max;
    const previous = this.currentHp;
    this.currentHp = Math.max(0, Math.min(current, this.maxHp));
    if (this.currentHp < previous) {
      // Chunk drain: the live bar drops now, the ghost lingers then drains.
      this.ghost.hp = Math.max(this.ghost.hp, previous);
      this.ghostTween?.stop();
      const cfg = JUICE.hpBar;
      this.ghostTween = this.scene.tweens.add({
        targets: this.ghost, hp: this.currentHp, delay: cfg.ghostDelayMs, duration: cfg.ghostDrainMs, ease: 'Quad.in',
        onUpdate: () => this.drawGhost(),
        onComplete: () => { this.ghostTween = null; this.drawGhost(); },
      });
    } else if (this.currentHp > this.ghost.hp || !this.ghostTween) {
      this.ghost.hp = this.currentHp;
    }
    this.updateFill();
  }

  /** Short horizontal shake (player getting hit). */
  shake(): void {
    const cfg = JUICE.hpBar;
    this.scene.tweens.killTweensOf(this.container);
    this.container.x = this.baseX;
    this.scene.tweens.add({ targets: this.container, x: this.baseX + cfg.shakePx, duration: cfg.shakeMs, yoyo: true, repeat: 2, ease: 'Sine.inOut', onComplete: () => { this.container.x = this.baseX; } });
  }

  private drawGhost(): void {
    this.ghostGraphics.clear();
    if (!this.scene || this.ghost.hp <= this.currentHp) return;
    const innerWidth = this.width - 6;
    const innerHeight = this.height - 6;
    const ghostWidth = innerWidth * (this.ghost.hp / this.maxHp);
    this.ghostGraphics.fillStyle(JUICE.hpBar.ghostColor, 0.95);
    this.ghostGraphics.fillRoundedRect(-this.width / 2 + 3, -this.height / 2 + 3, ghostWidth, innerHeight, { tl: innerHeight / 2, bl: innerHeight / 2, tr: 0, br: 0 });
  }

  setPendingDamage(damage: number): void {
    this.pendingDamage = damage;
    this.updateFill();
  }

  private updateFill(): void {
    const innerWidth = this.width - 6;
    const innerHeight = this.height - 6;
    const fillRatio = this.currentHp / this.maxHp;
    const fillWidth = innerWidth * fillRatio;

    // HP fill gradient
    this.fillGraphics.clear();
    if (fillWidth > 0) {
      const fillColorHi = this.isPlayer ? 0xffa0b8 : colors.hpFillHi;
      const fillColorLo = this.isPlayer ? 0xd02060 : colors.hpFillLo;

      this.fillGraphics.fillStyle(fillColorHi, 1);

      this.fillGraphics.fillGradientStyle(fillColorHi, fillColorHi, fillColorLo, fillColorLo, 1);
      this.fillGraphics.fillRoundedRect(
        -this.width / 2 + 3,
        -this.height / 2 + 3,
        fillWidth,
        innerHeight,
        { tl: innerHeight / 2, bl: innerHeight / 2, tr: 0, br: 0 }
      );
    }

    // Preview fill (striped pattern for pending damage)
    this.previewGraphics.clear();
    if (this.pendingDamage > 0 && this.currentHp > 0) {
      const previewRatio = Math.min(this.pendingDamage, this.currentHp) / this.maxHp;
      const previewWidth = innerWidth * previewRatio;
      const previewX = -this.width / 2 + 3 + fillWidth - previewWidth;

      // Yellow striped area
      this.previewGraphics.fillStyle(colors.hpPreviewLo, 1);
      this.previewGraphics.fillRect(previewX, -this.height / 2 + 3, previewWidth, innerHeight);

      // Stripes
      this.previewGraphics.lineStyle(2, colors.hpPreviewHi, 0.8);
      for (let i = 0; i < previewWidth + innerHeight; i += 8) {
        this.previewGraphics.lineBetween(
          previewX + i,
          -this.height / 2 + 3,
          previewX + i - innerHeight,
          this.height / 2 - 3
        );
      }

      this.previewText.setText(`-${this.pendingDamage}`);
      this.previewText.setVisible(true);
    } else {
      this.previewText.setVisible(false);
    }

    // Update text
    this.hpText.setText(`${this.currentHp}/${this.maxHp}`);
    this.drawGhost();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  setPosition(x: number, y: number): void {
    this.baseX = x;
    this.container.setPosition(x, y);
  }

  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  destroy(): void {
    this.ghostTween?.stop();
    this.container.destroy();
  }
}

/**
 * Combo Banner - shows current chain multiplier and tier
 */
export class ComboBanner {
  private scene: Phaser.Scene;
  private lastChain = 0;
  private container: Phaser.GameObjects.Container;
  private chainText: Phaser.GameObjects.Text;
  private damageText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    this.scene = scene;
    this.container = scene.add.container(x, y);
    const bg = scene.add.graphics();
    bg.fillStyle(0x211740, 1);
    bg.fillRoundedRect(-width / 2, 0, width, height, 10);
    bg.lineStyle(1, 0x9271bc, 0.6);
    bg.strokeRoundedRect(-width / 2, 0, width, height, 10);
    this.chainText = scene.add.text(-width / 2 + 12, height / 2, 'MAKE A CHAIN', {
      resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '14px', fontStyle: 'bold', color: '#fff4d6',
    }).setOrigin(0, 0.5);
    this.damageText = scene.add.text(width / 2 - 12, height / 2, '±1  •  A ↔ K', {
      resolution: getRenderDensity(), fontFamily: 'Fredoka', fontSize: '13px', color: '#c6b7dd',
    }).setOrigin(1, 0.5);
    this.container.add([bg, this.chainText, this.damageText]);
  }

  update(chainLength: number, totalDamage: number): void {
    this.chainText.setText(chainLength ? `CHAIN ${chainLength}` : 'MAKE A CHAIN');
    // Colour shifts with the combo tier (tokens.comboTiers).
    const tierColor = chainLength >= 2 ? '#' + getComboTier(chainLength).color.toString(16).padStart(6, '0') : '#fff4d6';
    this.chainText.setColor(tierColor);
    if (chainLength > this.lastChain && chainLength > 0) {
      // Chain counter pop, stronger with length.
      const cfg = JUICE.chain;
      const boost = Math.min(0.25, (chainLength - 1) * 0.03);
      this.scene.tweens.killTweensOf([this.chainText, this.damageText]);
      this.chainText.setScale(1); this.damageText.setScale(1);
      this.scene.tweens.add({ targets: [this.chainText, this.damageText], scale: cfg.counterPopScale + boost, duration: cfg.counterPopMs, yoyo: true, ease: 'Back.out' });
    }
    this.lastChain = chainLength;
    this.damageText.setText(chainLength ? `DAMAGE ${totalDamage}` : '±1  •  A ↔ K');
    this.container.setVisible(true);
  }
  setVisible(visible: boolean): void { this.container.setVisible(visible); }
  setPosition(x: number, y: number): void { this.container.setPosition(x, y); }
  setDepth(depth: number): void { this.container.setDepth(depth); }
  getContainer(): Phaser.GameObjects.Container { return this.container; }
  destroy(): void { this.container.destroy(); }
}

/**
 * Intent Bubble - shows enemy's next action
 */
export function createIntentBubble(
  scene: Phaser.Scene,
  x: number,
  y: number,
  intentType: 'attack' | 'defend' | 'buff' | 'debuff',
  value: number
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);

  const intentColors: Record<string, number> = {
    attack: colors.red,
    defend: colors.blue,
    buff: 0xb04bdb,
    debuff: 0xffb800,
  };

  const intentIcons: Record<string, string> = {
    attack: '⚔',
    defend: '🛡',
    buff: '⬆',
    debuff: '⬇',
  };

  // Bubble background
  const bg = scene.add.graphics();
  bg.fillStyle(0xffffff, 1);
  bg.fillGradientStyle(0xffffff, 0xffffff, 0xffe9ec, 0xffe9ec, 1);
  bg.fillRoundedRect(-35, -25, 70, 50, 18);
  bg.lineStyle(3, colors.ink, 1);
  bg.strokeRoundedRect(-35, -25, 70, 50, 18);

  // Tail pointing down
  bg.fillStyle(0xffe9ec, 1);
  bg.beginPath();
  bg.moveTo(-8, 25);
  bg.lineTo(0, 38);
  bg.lineTo(8, 25);
  bg.closePath();
  bg.fill();
  bg.lineStyle(3, colors.ink, 1);
  bg.lineBetween(-8, 25, 0, 38);
  bg.lineBetween(0, 38, 8, 25);

  container.add(bg);

  // "NEXT TURN" label
  const label = scene.add
    .text(0, -35, 'NEXT TURN', {
      resolution: getRenderDensity(), fontFamily: 'Fredoka',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffffff',
    })
    .setOrigin(0.5);

  const labelBg = scene.add.graphics();
  labelBg.fillStyle(colors.ink, 1);
  labelBg.fillRoundedRect(-32, -42, 64, 16, 4);
  container.add(labelBg);
  container.add(label);

  // Intent icon
  const icon = scene.add
    .text(-12, 0, intentIcons[intentType], {
      fontSize: '28px',
      color: '#' + intentColors[intentType].toString(16).padStart(6, '0'),
    })
    .setOrigin(0.5);
  container.add(icon);

  // Value
  const valueText = scene.add
    .text(14, 0, value.toString(), {
      resolution: getRenderDensity(), fontFamily: 'Lilita One',
      fontSize: '26px',
      color: '#' + intentColors[intentType].toString(16).padStart(6, '0'),
    })
    .setOrigin(0.5)
    .setStroke('#1B1030', 5);
  container.add(valueText);

  return container;
}
