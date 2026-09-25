/**
 * HUD Components - Chips, HP bars, Combo banner, Intent bubble
 * Per STYLE.md section 7: dark semi-transparent pills, outlined text
 */

import Phaser from 'phaser';
import { colors, getComboTier, comboTiers } from './tokens';

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
      fontFamily: 'Lilita One',
      fontSize: '18px',
      color: '#ffffff',
    })
    .setOrigin(0, 0.5)
    .setStroke('#1B1030', 5)
    .setShadow(0, 1.5, '#1B1030', 0, true, true);

  const width = iconSize + valueText.width + padding;

  // Background pill
  const bg = scene.add.graphics();
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
      fontFamily: 'Arial',
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

    // Track background
    const trackBg = scene.add.graphics();
    trackBg.fillGradientStyle(colors.hpTrackHi, colors.hpTrackHi, colors.hpTrackLo, colors.hpTrackLo, 1);
    trackBg.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    trackBg.lineStyle(3, colors.ink, 1);
    trackBg.strokeRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    this.container.add(trackBg);

    // Preview (pending damage) fill
    this.previewGraphics = scene.add.graphics();
    this.container.add(this.previewGraphics);

    // HP fill
    this.fillGraphics = scene.add.graphics();
    this.container.add(this.fillGraphics);

    // HP text
    this.hpText = scene.add
      .text(0, 1, `${maxHp}/${maxHp}`, {
        fontFamily: 'Lilita One',
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
        fontFamily: 'Lilita One',
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
    this.currentHp = Math.max(0, Math.min(current, this.maxHp));
    this.updateFill();
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
      const fillColor = this.isPlayer ? colors.playerHp : colors.hpFill;
      const fillColorHi = this.isPlayer ? 0xffa0b8 : colors.hpFillHi;
      const fillColorLo = this.isPlayer ? 0xd02060 : colors.hpFillLo;

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
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  destroy(): void {
    this.container.destroy();
  }
}

/**
 * Combo Banner - shows current chain multiplier and tier
 */
export class ComboBanner {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private multiplierText: Phaser.GameObjects.Text;
  private tierText: Phaser.GameObjects.Text;
  private damageText: Phaser.GameObjects.Text;
  private tierIndicators: Phaser.GameObjects.Graphics;
  private currentChain: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    this.scene = scene;
    this.container = scene.add.container(x, y);

    // Banner background gradient
    const bg = scene.add.graphics();
    bg.fillGradientStyle(0xff8a2a, 0xff8a2a, 0xc8252e, 0xc8252e, 1);
    bg.fillRoundedRect(-width / 2, 0, width, height, 18);
    bg.lineStyle(3, colors.ink, 1);
    bg.strokeRoundedRect(-width / 2, 0, width, height, 18);
    this.container.add(bg);

    // Flame medallion on left
    const medallionX = -width / 2 + 40;
    const medallionY = height / 2;

    const medallion = scene.add.graphics();
    medallion.fillGradientStyle(0xffa030, 0xffa030, 0xff4020, 0xff4020, 1);
    medallion.fillCircle(medallionX, medallionY, 30);
    medallion.lineStyle(3, colors.ink, 1);
    medallion.strokeCircle(medallionX, medallionY, 30);
    this.container.add(medallion);

    // Multiplier text
    this.multiplierText = scene.add
      .text(medallionX, medallionY + 2, 'x1', {
        fontFamily: 'Lilita One',
        fontSize: '28px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 7)
      .setShadow(0, 2, '#1B1030', 0, true, true);
    this.container.add(this.multiplierText);

    // "COMBO" text
    const comboLabel = scene.add
      .text(0, height * 0.3, 'COMBO', {
        fontFamily: 'Lilita One',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 4);
    this.container.add(comboLabel);

    // Tier text (NICE, GREAT!, etc)
    this.tierText = scene.add
      .text(0, height * 0.65, '', {
        fontFamily: 'Lilita One',
        fontSize: '14px',
        color: '#FFE45C',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 3);
    this.container.add(this.tierText);

    // Tier progress indicators
    this.tierIndicators = scene.add.graphics();
    this.container.add(this.tierIndicators);

    // Damage preview on right
    const damageX = width / 2 - 50;
    this.damageText = scene.add
      .text(damageX, height / 2, '0', {
        fontFamily: 'Lilita One',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 6)
      .setShadow(0, 2, '#1B1030', 0, true, true);
    this.container.add(this.damageText);

    // Sword icon next to damage
    const swordIcon = scene.add
      .text(damageX - 30, height / 2, '⚔', {
        fontSize: '20px',
        color: '#FFD070',
      })
      .setOrigin(0.5);
    this.container.add(swordIcon);

    this.setVisible(false);
  }

  update(chainLength: number, totalDamage: number): void {
    this.currentChain = chainLength;
    const tier = getComboTier(chainLength);

    this.multiplierText.setText(`x${chainLength}`);
    this.tierText.setText(tier.label);
    this.tierText.setColor('#' + tier.color.toString(16).padStart(6, '0'));
    this.damageText.setText(totalDamage.toString());

    // Draw tier indicators
    this.tierIndicators.clear();
    const indicatorY = 42;
    const indicatorWidth = 25;
    const indicatorGap = 4;
    const startX = -((4 * indicatorWidth + 3 * indicatorGap) / 2);

    for (let i = 0; i < 4; i++) {
      const tierThreshold = comboTiers[i];
      const x = startX + i * (indicatorWidth + indicatorGap);
      const isFilled = chainLength >= tierThreshold.min;
      const isPartial = chainLength >= tierThreshold.min - 1 && chainLength < tierThreshold.min;

      this.tierIndicators.fillStyle(isFilled ? tierThreshold.color : 0x1b1030, isFilled ? 1 : 0.3);
      this.tierIndicators.fillRoundedRect(x, indicatorY, indicatorWidth, 10, 3);
      this.tierIndicators.lineStyle(1.5, colors.ink, 1);
      this.tierIndicators.strokeRoundedRect(x, indicatorY, indicatorWidth, 10, 3);
    }

    this.setVisible(chainLength > 0);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  destroy(): void {
    this.container.destroy();
  }
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
      fontFamily: 'Fredoka',
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
      fontFamily: 'Lilita One',
      fontSize: '26px',
      color: '#' + intentColors[intentType].toString(16).padStart(6, '0'),
    })
    .setOrigin(0.5)
    .setStroke('#1B1030', 5);
  container.add(valueText);

  return container;
}
