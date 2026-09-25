/**
 * ArenaBackground - SVG-based arena backgrounds with encounter palettes
 * Per STYLE.md section 10: data-driven layers, encounter = palette swap
 */

import Phaser from 'phaser';
import { colors } from './tokens';

export type EncounterType =
  | 'forest'
  | 'goblin_camp'
  | 'moonlit'
  | 'crypt'
  | 'dojo'
  | 'castle';

interface EncounterPalette {
  skyGradient: number[];
  sunGlow: number;
  mountainHi: number;
  mountainLo: number;
  mountainOutline: number;
  groundHi: number;
  groundMid: number;
  groundLo: number;
  groundOutline: number;
  arenaDisk: number;
}

const ENCOUNTER_PALETTES: Record<EncounterType, EncounterPalette> = {
  forest: {
    skyGradient: [0x3fb6ff, 0x7fd8ff, 0xa8f0ff],
    sunGlow: 0xffffc0,
    mountainHi: 0x4dbd5c,
    mountainLo: 0x2d8c3a,
    mountainOutline: 0x1a5a24,
    groundHi: 0x8ed96a,
    groundMid: 0x7bd957,
    groundLo: 0x5ab040,
    groundOutline: 0x3a7a28,
    arenaDisk: 0x6bc74a,
  },
  goblin_camp: {
    skyGradient: [0x3f2ab8, 0x8c3fd0, 0xf0508e, 0xff8a5c, 0xffc27a],
    sunGlow: 0xfff1b8,
    mountainHi: 0xb067e0,
    mountainLo: 0xe77ab0,
    mountainOutline: 0x7a3398,
    groundHi: 0xffc983,
    groundMid: 0xf3a763,
    groundLo: 0xd9824a,
    groundOutline: 0xa4552c,
    arenaDisk: 0xe89456,
  },
  moonlit: {
    skyGradient: [0x1e2a78, 0x4a4ab0, 0x6a5ae0],
    sunGlow: 0xd0d8ff,
    mountainHi: 0x6a7ab8,
    mountainLo: 0x8a9ad6,
    mountainOutline: 0x3a4a78,
    groundHi: 0x7888b8,
    groundMid: 0x6070a0,
    groundLo: 0x485888,
    groundOutline: 0x303858,
    arenaDisk: 0x5a6a90,
  },
  crypt: {
    skyGradient: [0x2a7f7a, 0x50b0a8, 0x7fe0c0],
    sunGlow: 0xc0ffd8,
    mountainHi: 0x8a7898,
    mountainLo: 0x9c8aa8,
    mountainOutline: 0x5a4868,
    groundHi: 0xa898b0,
    groundMid: 0x8a7890,
    groundLo: 0x6a5870,
    groundOutline: 0x4a3850,
    arenaDisk: 0x7a6888,
  },
  dojo: {
    skyGradient: [0xffb36b, 0xffd090, 0xffe9a8],
    sunGlow: 0xfffff0,
    mountainHi: 0xc8a070,
    mountainLo: 0xd9b888,
    mountainOutline: 0x8a6840,
    groundHi: 0xe8b870,
    groundMid: 0xd98a4a,
    groundLo: 0xc06830,
    groundOutline: 0x8a4820,
    arenaDisk: 0xd07840,
  },
  castle: {
    skyGradient: [0xb8163a, 0xd84050, 0xff7a3a],
    sunGlow: 0xffa870,
    mountainHi: 0x5a4870,
    mountainLo: 0x6b5a8a,
    mountainOutline: 0x3a2848,
    groundHi: 0x6a5878,
    groundMid: 0x584868,
    groundLo: 0x483858,
    groundOutline: 0x302838,
    arenaDisk: 0x504060,
  },
};

export class ArenaBackground {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
  }

  draw(
    width: number,
    arenaTop: number,
    arenaHeight: number,
    encounter: EncounterType = 'goblin_camp'
  ): void {
    this.container.removeAll(true);

    const palette = ENCOUNTER_PALETTES[encounter];
    const g = this.scene.add.graphics();

    // Sky gradient
    const skyStops = palette.skyGradient;
    const stopHeight = arenaHeight / (skyStops.length - 1);
    for (let i = 0; i < skyStops.length - 1; i++) {
      g.fillGradientStyle(
        skyStops[i],
        skyStops[i],
        skyStops[i + 1],
        skyStops[i + 1],
        1
      );
      g.fillRect(0, arenaTop + i * stopHeight, width, stopHeight + 1);
    }

    // Sun glow behind enemy position
    const sunX = width / 2;
    const sunY = arenaTop + arenaHeight * 0.35;
    const sunRadius = Math.min(width * 0.5, arenaHeight * 0.5);
    g.fillStyle(palette.sunGlow, 0.4);
    g.fillCircle(sunX, sunY, sunRadius);
    g.fillStyle(palette.sunGlow, 0.3);
    g.fillCircle(sunX, sunY, sunRadius * 0.7);
    g.fillStyle(palette.sunGlow, 0.2);
    g.fillCircle(sunX, sunY, sunRadius * 0.5);

    // Mountains (background layer)
    const mountainY = arenaTop + arenaHeight * 0.4;
    const mountainHeight = arenaHeight * 0.35;

    g.fillGradientStyle(
      palette.mountainHi,
      palette.mountainHi,
      palette.mountainLo,
      palette.mountainLo,
      1
    );

    // Draw mountain silhouette
    g.beginPath();
    g.moveTo(0, mountainY + mountainHeight);
    g.lineTo(0, mountainY + mountainHeight * 0.7);
    g.lineTo(width * 0.15, mountainY + mountainHeight * 0.3);
    g.lineTo(width * 0.25, mountainY + mountainHeight * 0.5);
    g.lineTo(width * 0.4, mountainY);
    g.lineTo(width * 0.5, mountainY + mountainHeight * 0.25);
    g.lineTo(width * 0.6, mountainY);
    g.lineTo(width * 0.75, mountainY + mountainHeight * 0.4);
    g.lineTo(width * 0.85, mountainY + mountainHeight * 0.2);
    g.lineTo(width, mountainY + mountainHeight * 0.6);
    g.lineTo(width, mountainY + mountainHeight);
    g.closePath();
    g.fill();

    // Mountain outline
    g.lineStyle(2.5, palette.mountainOutline, 1);
    g.beginPath();
    g.moveTo(0, mountainY + mountainHeight * 0.7);
    g.lineTo(width * 0.15, mountainY + mountainHeight * 0.3);
    g.lineTo(width * 0.25, mountainY + mountainHeight * 0.5);
    g.lineTo(width * 0.4, mountainY);
    g.lineTo(width * 0.5, mountainY + mountainHeight * 0.25);
    g.lineTo(width * 0.6, mountainY);
    g.lineTo(width * 0.75, mountainY + mountainHeight * 0.4);
    g.lineTo(width * 0.85, mountainY + mountainHeight * 0.2);
    g.lineTo(width, mountainY + mountainHeight * 0.6);
    g.strokePath();

    // Ground
    const groundY = arenaTop + arenaHeight * 0.65;
    const groundHeight = arenaHeight * 0.35;

    g.fillGradientStyle(
      palette.groundHi,
      palette.groundHi,
      palette.groundLo,
      palette.groundLo,
      1
    );
    g.fillRect(0, groundY, width, groundHeight);

    // Ground top edge highlight
    g.lineStyle(3, palette.groundOutline, 1);
    g.lineBetween(0, groundY, width, groundY);

    // Arena disk (where enemy stands)
    const diskCenterX = width / 2;
    const diskCenterY = groundY + groundHeight * 0.1;
    const diskRadiusX = width * 0.35;
    const diskRadiusY = groundHeight * 0.15;

    g.fillStyle(palette.arenaDisk, 1);
    g.fillEllipse(diskCenterX, diskCenterY, diskRadiusX * 2, diskRadiusY * 2);
    g.lineStyle(2, palette.groundOutline, 0.5);
    g.strokeEllipse(diskCenterX, diskCenterY, diskRadiusX * 2, diskRadiusY * 2);

    this.container.add(g);
  }

  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  destroy(): void {
    this.container.destroy();
  }
}

export function getEncounterForEnemy(enemyId: string): EncounterType {
  const mapping: Record<string, EncounterType> = {
    slime: 'forest',
    mushroom: 'forest',
    goblin: 'goblin_camp',
    bandit: 'goblin_camp',
    wolf: 'moonlit',
    bat: 'moonlit',
    zombie: 'crypt',
    samurai: 'dojo',
    knight: 'castle',
  };
  return mapping[enemyId] || 'goblin_camp';
}
