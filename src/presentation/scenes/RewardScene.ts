import Phaser from 'phaser';
import { getGameManager } from '../GameManager';
import { RunState } from '../../core/types';

export class RewardScene extends Phaser.Scene {
  constructor() {
    super('RewardScene');
  }

  create(): void {
    const manager = getGameManager();
    const state = manager.getState();

    if (!state || state.phase !== 'reward') {
      this.scene.start('StartScene');
      return;
    }

    const width = this.scale.width;
    const height = this.scale.height;
    const cx = width / 2;

    // Background
    this.cameras.main.setBackgroundColor('#0a0e17');
    this.drawBackground(width, height);

    // Victory text
    this.add
      .text(cx, height * 0.08, 'VICTORY!', {
        fontFamily: 'Georgia, serif',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#f0cf68',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, height * 0.14, 'CHOOSE A RELIC', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#8a9bb8',
      })
      .setOrigin(0.5);

    // Relic options
    const rewards = state.availableRewards;
    const cardHeight = 90;
    const startY = height * 0.22;
    const gap = 12;

    rewards.forEach((relic, index) => {
      const y = startY + index * (cardHeight + gap);

      const card = this.add
        .rectangle(cx, y + cardHeight / 2, width - 40, cardHeight, 0x1a2535)
        .setStrokeStyle(1, 0x3a5a7a)
        .setInteractive({ useHandCursor: true });

      // Relic icon
      this.add
        .text(30, y + 20, '◆', {
          fontFamily: 'Arial',
          fontSize: '24px',
          color: '#a080c0',
        });

      // Relic name
      this.add
        .text(60, y + 18, relic.name, {
          fontFamily: 'Georgia, serif',
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#e8e0d0',
        });

      // Relic description
      this.add
        .text(60, y + 45, relic.description, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '12px',
          color: '#8a9bb8',
        });

      card.on('pointerdown', () => this.selectRelic(relic.id));
      card.on('pointerover', () => {
        card.setFillStyle(0x2a3545);
        card.setStrokeStyle(2, 0xf0cf68);
      });
      card.on('pointerout', () => {
        card.setFillStyle(0x1a2535);
        card.setStrokeStyle(1, 0x3a5a7a);
      });
    });

    // Skip button
    const skipY = startY + rewards.length * (cardHeight + gap) + 20;
    const skipBtn = this.add
      .rectangle(cx, skipY, 150, 40, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(cx, skipY, 'SKIP', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#8a8a9a',
      })
      .setOrigin(0.5);

    skipBtn.on('pointerdown', () => this.skipReward());
    skipBtn.on('pointerover', () => skipBtn.setFillStyle(0x3a3a4a));
    skipBtn.on('pointerout', () => skipBtn.setFillStyle(0x2a2a3a));

    // Player stats at bottom
    this.drawPlayerStats(width, height, state);
  }

  private drawBackground(width: number, height: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x0c1525, 1);
    g.fillRect(0, 0, width, height);

    // Celebratory particles
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height / 2);
      g.fillStyle(0xf0cf68, Phaser.Math.FloatBetween(0.05, 0.15));
      g.fillCircle(x, y, Phaser.Math.Between(1, 3));
    }
  }

  private drawPlayerStats(width: number, height: number, state: RunState): void {
    const y = height - 50;

    this.add
      .text(20, y, `♥ ${state.player.hp}/${state.player.maxHp}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ff6677',
      });

    this.add
      .text(width / 2, y, `♦ ${state.player.gold}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#f0cf68',
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width - 20, y, `${state.player.relics.length} relics`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#8a9bb8',
      })
      .setOrigin(1, 0);
  }

  private selectRelic(relicId: string): void {
    const manager = getGameManager();
    manager.selectRelic(relicId);
    this.scene.start('ShopScene');
  }

  private skipReward(): void {
    const manager = getGameManager();
    manager.skipReward();
    this.scene.start('ShopScene');
  }
}
