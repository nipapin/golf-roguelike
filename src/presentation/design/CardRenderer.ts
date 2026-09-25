/**
 * CardRenderer - Pre-renders card textures for all ranks/suits/states
 * Per STYLE.md: render cards once to RenderTexture rather than rebuilding per frame
 */

import Phaser from 'phaser';
import { colors, suitColors, getCardMetrics, powerColors } from './tokens';
import type { Card, PowerType } from '../../core/types';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: Array<'spades' | 'hearts' | 'clubs' | 'diamonds'> = [
  'spades',
  'hearts',
  'clubs',
  'diamonds',
];

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '♠',
  hearts: '♥',
  clubs: '♣',
  diamonds: '♦',
};

export class CardRenderer {
  private scene: Phaser.Scene;
  private metrics: ReturnType<typeof getCardMetrics>;
  private texturesGenerated = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.metrics = getCardMetrics(scene.scale.width);
  }

  generateAllTextures(): void {
    if (this.texturesGenerated) return;

    const { cw, ch } = this.metrics;

    // Generate textures for each rank/suit combination
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const key = `card-${rank}-${suit}`;
        this.generateCardTexture(key, rank, suit);
      }
    }

    // Generate card back texture
    this.generateCardBackTexture();

    this.texturesGenerated = true;
  }

  private generateCardTexture(
    key: string,
    rank: string,
    suit: 'spades' | 'hearts' | 'clubs' | 'diamonds'
  ): void {
    const { cw, ch, radius, bevelHeight, rankSize, rankSize10 } = this.metrics;
    const w = Math.ceil(cw);
    const h = Math.ceil(ch);

    const graphics = this.scene.make.graphics({ x: 0, y: 0 });

    // Card face gradient (cream)
    graphics.fillGradientStyle(colors.faceHi, colors.faceHi, colors.faceLo, colors.faceLo, 1);
    graphics.fillRoundedRect(0, 0, w, h, radius);

    // Bottom bevel
    graphics.fillStyle(colors.bevel, 1);
    graphics.fillRoundedRect(0, h - bevelHeight, w, bevelHeight, { bl: radius, br: radius, tl: 0, tr: 0 });

    // Top highlight
    graphics.fillStyle(0xffffff, 0.6);
    graphics.fillRoundedRect(2, 2, w - 4, 4, 2);

    // Generate texture from graphics
    graphics.generateTexture(key, w, h);
    graphics.destroy();

    // Now add text elements using a container rendered to texture
    const container = this.scene.add.container(0, 0);

    // Rank text
    const suitColor = suitColors[suit].suit;
    const displayRank = rank === '10' ? '10' : rank;
    const fontSize = rank === '10' ? rankSize10 : rankSize;

    const rankText = this.scene.add.text(cw * 0.09, cw * 0.04, displayRank, {
      fontFamily: 'Lilita One',
      fontSize: `${fontSize}px`,
      color: this.hexToString(suit === 'diamonds' ? colors.diamondTxt : suitColor),
    });
    container.add(rankText);

    // Small pip (suit symbol) in top right
    const pipText = this.scene.add.text(cw - cw * 0.07, cw * 0.08, SUIT_SYMBOLS[suit], {
      fontFamily: 'Arial',
      fontSize: `${cw * 0.25}px`,
      color: this.hexToString(suitColor),
    });
    pipText.setOrigin(1, 0);
    container.add(pipText);

    // Big suit in center-bottom
    const bigSuit = this.scene.add.text(cw / 2, ch - cw * 0.35, SUIT_SYMBOLS[suit], {
      fontFamily: 'Arial',
      fontSize: `${cw * 0.5}px`,
      color: this.hexToString(suitColor),
    });
    bigSuit.setOrigin(0.5, 0.5);
    container.add(bigSuit);

    // Render container to the existing texture
    const rt = this.scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
    if (rt) {
      const ctx = rt.getContext('2d');
      if (ctx) {
        // Draw rank
        ctx.font = `${fontSize}px "Lilita One"`;
        ctx.fillStyle = this.hexToString(suit === 'diamonds' ? colors.diamondTxt : suitColor);
        ctx.textBaseline = 'top';
        ctx.fillText(displayRank, cw * 0.09, cw * 0.06);

        // Draw pip
        ctx.font = `${cw * 0.22}px Arial`;
        ctx.textAlign = 'right';
        ctx.fillText(SUIT_SYMBOLS[suit], cw - cw * 0.07, cw * 0.1);

        // Draw big suit
        ctx.font = `${cw * 0.45}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(SUIT_SYMBOLS[suit], cw / 2, ch - cw * 0.35);
      }
    }

    container.destroy();
  }

  private generateCardBackTexture(): void {
    const { cw, ch, radius } = this.metrics;
    const w = Math.ceil(cw);
    const h = Math.ceil(ch);

    const graphics = this.scene.make.graphics({ x: 0, y: 0 });

    // Purple gradient background
    graphics.fillGradientStyle(colors.backHi, colors.backHi, colors.backLo, colors.backLo, 1);
    graphics.fillRoundedRect(0, 0, w, h, radius);

    // Gold inner border
    const borderWidth = cw * 0.07;
    graphics.lineStyle(2, colors.backGold, 1);
    graphics.strokeRoundedRect(
      borderWidth,
      borderWidth,
      w - borderWidth * 2,
      h - borderWidth * 2,
      radius - borderWidth
    );

    // Diagonal pattern
    graphics.lineStyle(1, 0xffffff, 0.07);
    for (let i = -h; i < w + h; i += 12) {
      graphics.lineBetween(i, 0, i + h, h);
      graphics.lineBetween(i, h, i + h, 0);
    }

    // Center diamond emblem
    const cx = w / 2;
    const cy = h / 2;
    const size = w * 0.24;
    graphics.fillStyle(colors.backGold, 1);
    graphics.beginPath();
    graphics.moveTo(cx, cy - size);
    graphics.lineTo(cx + size, cy);
    graphics.lineTo(cx, cy + size);
    graphics.lineTo(cx - size, cy);
    graphics.closePath();
    graphics.fill();

    graphics.generateTexture('card-back', w, h);
    graphics.destroy();
  }

  private hexToString(hex: number): string {
    return '#' + hex.toString(16).padStart(6, '0');
  }

  getCardTextureKey(card: Card): string {
    const rankMap: Record<number, string> = {
      1: 'A',
      10: '10',
      11: 'J',
      12: 'Q',
      13: 'K',
    };
    const rank = rankMap[card.rank] || card.rank.toString();
    return `card-${rank}-${card.suit}`;
  }
}
