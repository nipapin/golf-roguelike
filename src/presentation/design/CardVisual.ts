/**
 * CardVisual - Renders individual cards with all visual states
 * Per STYLE.md section 5-6: card anatomy, states, power cards
 */

import Phaser from 'phaser';
import { colors, suitColors, powerColors, getCardMetrics } from './tokens';
import type { Card, PowerType } from '../../core/types';

export type CardState = 'normal' | 'covered' | 'playable' | 'selected' | 'disabled' | 'active';

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '♠',
  hearts: '♥',
  clubs: '♣',
  diamonds: '♦',
};

const RANK_DISPLAY: Record<number, string> = {
  1: 'A',
  11: 'J',
  12: 'Q',
  13: 'K',
};

export class CardVisual {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private cardBg: Phaser.GameObjects.Graphics;
  private outlineGfx: Phaser.GameObjects.Graphics;
  private glowGfx: Phaser.GameObjects.Graphics;
  private rankText: Phaser.GameObjects.Text;
  private pipText: Phaser.GameObjects.Text;
  private bigSuitText: Phaser.GameObjects.Text;
  private tickMark: Phaser.GameObjects.Triangle | null = null;
  private powerFrame: Phaser.GameObjects.Graphics | null = null;
  private powerMedal: Phaser.GameObjects.Container | null = null;
  private powerRibbon: Phaser.GameObjects.Container | null = null;
  private played: boolean = false;

  private card: Card;
  private metrics: ReturnType<typeof getCardMetrics>;
  private state: CardState = 'normal';
  private powerType: PowerType | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, card: Card, powerType: PowerType | null = null) {
    this.scene = scene;
    this.card = card;
    this.powerType = powerType;
    this.metrics = getCardMetrics(scene.scale.width);

    this.container = scene.add.container(x, y);

    const { cw, ch, radius, bevelHeight } = this.metrics;
    const suitKey = card.suit as keyof typeof suitColors;
    const suitColor = suitColors[suitKey]?.suit || colors.spade;

    // Glow layer (behind everything)
    this.glowGfx = scene.add.graphics();
    this.container.add(this.glowGfx);

    // Outline layer
    this.outlineGfx = scene.add.graphics();
    this.container.add(this.outlineGfx);

    // Card background
    this.cardBg = scene.add.graphics();
    this.drawCardFace();
    this.container.add(this.cardBg);

    // Power card frame
    if (powerType) {
      this.createPowerFrame();
    }

    // Rank text
    const rankDisplay = RANK_DISPLAY[card.rank] || card.rank.toString();
    const fontSize = card.rank === 10 ? this.metrics.rankSize10 : this.metrics.rankSize;
    const textColor = card.suit === 'diamonds' ? colors.diamondTxt : suitColor;

    this.rankText = scene.add
      .text(cw * 0.09, cw * 0.06, rankDisplay, {
        fontFamily: 'Lilita One',
        fontSize: `${fontSize}px`,
        color: powerType ? '#1B1030' : this.hexToString(textColor),
      })
      .setOrigin(0, 0);
    if (card.rank === 10) {
      this.rankText.setLetterSpacing(-2);
    }
    this.container.add(this.rankText);

    // Pip (small suit symbol)
    this.pipText = scene.add
      .text(cw - cw * 0.07, cw * 0.1, SUIT_SYMBOLS[card.suit], {
        fontFamily: 'Arial',
        fontSize: `${cw * 0.22}px`,
        color: this.hexToString(suitColor),
      })
      .setOrigin(1, 0);
    if (powerType) {
      this.pipText.setVisible(false);
    }
    this.container.add(this.pipText);

    // Big suit symbol
    this.bigSuitText = scene.add
      .text(cw / 2, ch - cw * 0.35, SUIT_SYMBOLS[card.suit], {
        fontFamily: 'Arial',
        fontSize: `${cw * 0.45}px`,
        color: this.hexToString(suitColor),
      })
      .setOrigin(0.5);
    this.container.add(this.bigSuitText);

    // Power medal and ribbon
    if (powerType) {
      this.createPowerMedal(powerType);
      this.createPowerRibbon(powerType);
    }

    this.updateOutline();
  }

  private drawCardFace(): void {
    const { cw, ch, radius, bevelHeight } = this.metrics;

    this.cardBg.clear();

    if (this.powerType) {
      const pc = powerColors[this.powerType.toLowerCase() as keyof typeof powerColors];
      if (pc) {
        // Tinted face for power cards
        this.cardBg.fillGradientStyle(
          this.blendColor(pc.pw2, colors.faceHi, 0.38),
          this.blendColor(pc.pw2, colors.faceHi, 0.38),
          this.blendColor(pc.pw1, colors.faceLo, 0.30),
          this.blendColor(pc.pw1, colors.faceLo, 0.30),
          1
        );
      }
    } else {
      // Normal cream face
      this.cardBg.fillGradientStyle(colors.faceHi, colors.faceHi, colors.faceLo, colors.faceLo, 1);
    }

    this.cardBg.fillRoundedRect(0, 0, cw, ch, radius);

    // Bottom bevel
    this.cardBg.fillStyle(colors.bevel, 1);
    const bevelY = ch - bevelHeight;
    this.cardBg.fillRoundedRect(0, bevelY, cw, bevelHeight, { bl: radius, br: radius, tl: 0, tr: 0 });

    // Top highlight
    this.cardBg.fillStyle(0xffffff, 0.5);
    this.cardBg.fillRoundedRect(2, 2, cw - 4, 4, 2);
  }

  private createPowerFrame(): void {
    if (!this.powerType) return;

    const { cw, ch, radius } = this.metrics;
    const pc = powerColors[this.powerType.toLowerCase() as keyof typeof powerColors];
    if (!pc) return;

    this.powerFrame = this.scene.add.graphics();

    // Conic gradient simulation with segments
    const frameWidth = cw * 0.1;
    const segments = 12;
    const gradColors = [pc.pw1, pc.pw2, pc.pw3, pc.pw2, pc.pw1];

    for (let i = 0; i < segments; i++) {
      const colorIndex = Math.floor((i / segments) * gradColors.length) % gradColors.length;
      this.powerFrame.fillStyle(gradColors[colorIndex], 1);

      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;

      this.powerFrame.beginPath();
      this.powerFrame.arc(cw / 2, ch / 2, Math.max(cw, ch) * 0.7, angle1, angle2, false);
      this.powerFrame.arc(cw / 2, ch / 2, Math.max(cw, ch) * 0.5, angle2, angle1, true);
      this.powerFrame.closePath();
      this.powerFrame.fill();
    }

    // Mask to card shape
    const mask = this.scene.add.graphics();
    mask.fillStyle(0xffffff);
    mask.fillRoundedRect(frameWidth, frameWidth, cw - frameWidth * 2, ch - frameWidth * 2, radius - frameWidth);

    this.container.add(this.powerFrame);
    this.powerFrame.setMask(mask.createGeometryMask().setInvertAlpha(true));
  }

  private createPowerMedal(powerType: PowerType): void {
    const { cw } = this.metrics;
    const pc = powerColors[powerType.toLowerCase() as keyof typeof powerColors];
    if (!pc) return;

    this.powerMedal = this.scene.add.container(cw + cw * 0.1, -cw * 0.1);

    const size = cw * 0.44;
    const medal = this.scene.add.graphics();
    medal.fillGradientStyle(pc.pw3, pc.pw2, pc.pw2, pc.pw1, 1);
    medal.fillCircle(0, 0, size / 2);
    medal.lineStyle(2, colors.ink, 1);
    medal.strokeCircle(0, 0, size / 2);

    const iconMap: Record<string, string> = {
      CRIT: '⚔',
      HEAL: '❤',
      GUARD: '🛡',
      GOLD: '💰',
      BOMB: '💣',
      WILD: '🃏',
      ECHO: '〰',
    };

    const icon = this.scene.add
      .text(0, 0, iconMap[powerType] || '★', {
        fontSize: `${size * 0.5}px`,
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 2);

    this.powerMedal.add([medal, icon]);
    this.container.add(this.powerMedal);
  }

  private createPowerRibbon(powerType: PowerType): void {
    const { cw, ch } = this.metrics;
    const pc = powerColors[powerType.toLowerCase() as keyof typeof powerColors];
    if (!pc) return;

    this.powerRibbon = this.scene.add.container(cw / 2, ch + cw * 0.05);

    const text = this.scene.add
      .text(0, 0, powerType, {
        fontFamily: 'Lilita One',
        fontSize: `${cw * 0.18}px`,
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 3);

    const padding = 6;
    const ribbonW = text.width + padding * 2;
    const ribbonH = text.height + 4;

    const ribbon = this.scene.add.graphics();
    ribbon.fillGradientStyle(pc.pw2, pc.pw2, pc.pw1, pc.pw1, 1);
    ribbon.fillRoundedRect(-ribbonW / 2, -ribbonH / 2, ribbonW, ribbonH, 5);
    ribbon.lineStyle(2, colors.ink, 1);
    ribbon.strokeRoundedRect(-ribbonW / 2, -ribbonH / 2, ribbonW, ribbonH, 5);

    this.powerRibbon.add([ribbon, text]);
    this.container.add(this.powerRibbon);
  }

  private updateOutline(): void {
    const { cw, ch, radius, outline } = this.metrics;

    this.outlineGfx.clear();
    this.glowGfx.clear();

    // Remove old tick mark
    if (this.tickMark) {
      this.tickMark.destroy();
      this.tickMark = null;
    }

    switch (this.state) {
      case 'playable':
        // Gold ring + glow
        this.glowGfx.fillStyle(0xffd646, 0.4);
        this.glowGfx.fillRoundedRect(-8, -8, cw + 16, ch + 24, radius + 8);

        this.outlineGfx.lineStyle(outline, colors.ink, 1);
        this.outlineGfx.strokeRoundedRect(0, 0, cw, ch, radius);
        this.outlineGfx.lineStyle(2.5, colors.goldRing, 1);
        this.outlineGfx.strokeRoundedRect(-2.5, -2.5, cw + 5, ch + 5, radius + 2);
        this.outlineGfx.lineStyle(1.5, colors.ink, 1);
        this.outlineGfx.strokeRoundedRect(-4, -4, cw + 8, ch + 8, radius + 4);

        // Tick mark below card
        this.tickMark = this.scene.add.triangle(
          cw / 2,
          ch + 10,
          0, 7,
          6, 0,
          12, 7,
          colors.goldRing
        );
        this.tickMark.setStrokeStyle(1.5, colors.ink);
        this.container.add(this.tickMark);
        break;

      case 'selected':
        this.container.setScale(1.1);
        this.container.setAngle(-3);

        this.outlineGfx.lineStyle(outline, colors.ink, 1);
        this.outlineGfx.strokeRoundedRect(0, 0, cw, ch, radius);
        this.outlineGfx.lineStyle(3.5, 0xffffff, 1);
        this.outlineGfx.strokeRoundedRect(-3, -3, cw + 6, ch + 6, radius + 3);

        this.glowGfx.fillStyle(0xfff0aa, 0.5);
        this.glowGfx.fillRoundedRect(-12, -12, cw + 24, ch + 32, radius + 12);
        break;

      case 'disabled':
        this.outlineGfx.lineStyle(outline, colors.ink, 1);
        this.outlineGfx.strokeRoundedRect(0, 0, cw, ch, radius);

        // Dim overlay
        this.outlineGfx.fillStyle(0x4632aa, 0.2);
        this.outlineGfx.fillRoundedRect(0, 0, cw, ch, radius);
        break;

      case 'covered':
        this.outlineGfx.lineStyle(outline, colors.ink, 1);
        this.outlineGfx.strokeRoundedRect(0, 0, cw, ch, radius);
        break;

      case 'active':
        // Larger card in active slot
        this.outlineGfx.lineStyle(4, colors.tier1, 1);
        this.outlineGfx.strokeRoundedRect(-4, -4, cw + 8, ch + 8, radius + 4);
        this.outlineGfx.lineStyle(outline, colors.ink, 1);
        this.outlineGfx.strokeRoundedRect(0, 0, cw, ch, radius);

        this.glowGfx.fillStyle(colors.tier1, 0.3);
        this.glowGfx.fillRoundedRect(-8, -8, cw + 16, ch + 16, radius + 8);
        break;

      default:
        // Normal outline and shadow
        this.outlineGfx.lineStyle(outline, colors.ink, 1);
        this.outlineGfx.strokeRoundedRect(0, 0, cw, ch, radius);
    }
  }

  setState(state: CardState): void {
    this.state = state;

    // Reset transforms
    this.container.setScale(1);
    this.container.setAngle(0);

    // Apply filters
    if (state === 'covered') {
      this.cardBg.setAlpha(0.94);
    } else if (state === 'disabled') {
      this.cardBg.setAlpha(0.8);
    } else {
      this.cardBg.setAlpha(1);
    }

    this.updateOutline();
  }

  getState(): CardState {
    return this.state;
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  setInteractive(callback: () => void): void {
    const { cw, ch } = this.metrics;
    
    // Correct Container hit area setup:
    // 1. Set container size first
    // 2. Then setInteractive with Rectangle at (0,0) - NOT offset by -w/2,-h/2
    this.container.setSize(cw, ch);
    this.container.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, cw, ch),
      Phaser.Geom.Rectangle.Contains
    );
    
    // Use pointerup with played guard to prevent double-tap issues
    this.container.on('pointerup', () => {
      if (this.played) return;
      this.played = true;
      this.container.disableInteractive();
      callback();
    });
  }

  disableInteractive(): void {
    this.container.disableInteractive();
    this.container.removeAllListeners('pointerup');
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  getCard(): Card {
    return this.card;
  }

  destroy(): void {
    this.container.removeAllListeners();
    this.container.destroy();
  }

  private hexToString(hex: number): string {
    return '#' + hex.toString(16).padStart(6, '0');
  }

  private blendColor(color1: number, color2: number, ratio: number): number {
    const r1 = (color1 >> 16) & 0xff;
    const g1 = (color1 >> 8) & 0xff;
    const b1 = color1 & 0xff;
    const r2 = (color2 >> 16) & 0xff;
    const g2 = (color2 >> 8) & 0xff;
    const b2 = color2 & 0xff;

    const r = Math.round(r1 * ratio + r2 * (1 - ratio));
    const g = Math.round(g1 * ratio + g2 * (1 - ratio));
    const b = Math.round(b1 * ratio + b2 * (1 - ratio));

    return (r << 16) | (g << 8) | b;
  }
}

/**
 * Create a card back visual
 */
export function createCardBack(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const metrics = getCardMetrics(scene.scale.width);
  const { cw, ch, radius } = metrics;

  const container = scene.add.container(x, y);

  const bg = scene.add.graphics();

  // Purple gradient
  bg.fillGradientStyle(colors.backHi, colors.backHi, colors.backLo, colors.backLo, 1);
  bg.fillRoundedRect(0, 0, cw, ch, radius);

  // Diagonal pattern
  bg.lineStyle(1, 0xffffff, 0.07);
  for (let i = -ch; i < cw + ch; i += 12) {
    bg.lineBetween(i, 0, i + ch, ch);
    bg.lineBetween(i + ch, 0, i, ch);
  }

  // Gold border
  const borderW = cw * 0.07;
  bg.lineStyle(2, colors.backGold, 1);
  bg.strokeRoundedRect(borderW, borderW, cw - borderW * 2, ch - borderW * 2, radius - borderW);

  // Center diamond
  const cx = cw / 2;
  const cy = ch / 2;
  const size = cw * 0.2;
  bg.fillStyle(colors.backGold, 1);
  bg.beginPath();
  bg.moveTo(cx, cy - size);
  bg.lineTo(cx + size, cy);
  bg.lineTo(cx, cy + size);
  bg.lineTo(cx - size, cy);
  bg.closePath();
  bg.fill();

  // Outline
  bg.lineStyle(2.5, colors.ink, 1);
  bg.strokeRoundedRect(0, 0, cw, ch, radius);

  container.add(bg);

  return container;
}
