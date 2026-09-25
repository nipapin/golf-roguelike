import Phaser from 'phaser';
import { getGameManager } from '../GameManager';

export class EndScene extends Phaser.Scene {
  constructor() {
    super('EndScene');
  }

  create(): void {
    const manager = getGameManager();
    const state = manager.getState();

    if (!state) {
      this.scene.start('StartScene');
      return;
    }

    const width = this.scale.width;
    const height = this.scale.height;
    const cx = width / 2;
    const isVictory = state.phase === 'victory';

    // Background
    this.cameras.main.setBackgroundColor(isVictory ? '#0a1510' : '#150a0a');
    this.drawBackground(width, height, isVictory);

    // Main text
    const titleY = height * 0.25;
    this.add
      .text(cx, titleY, isVictory ? 'RUN COMPLETE' : 'YOU DIED', {
        fontFamily: 'Georgia, serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: isVictory ? '#f0cf68' : '#e85d70',
      })
      .setOrigin(0.5);

    // Stats
    const statsY = titleY + 60;
    this.add
      .text(cx, statsY, `Fight ${state.currentFight + 1}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#8a9bb8',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, statsY + 25, `♦ ${state.player.gold} Gold`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#f0cf68',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, statsY + 50, `${state.player.relics.length} Relics`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#a080c0',
      })
      .setOrigin(0.5);

    // List relics if any
    if (state.player.relics.length > 0) {
      const relicListY = statsY + 80;
      state.player.relics.forEach((relic, i) => {
        this.add
          .text(cx, relicListY + i * 20, `◆ ${relic.name}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '11px',
            color: '#8a9bb8',
          })
          .setOrigin(0.5);
      });
    }

    // Victory message
    if (isVictory) {
      this.add
        .text(cx, height * 0.6, 'THE GOLF KING IS DEFEATED!', {
          fontFamily: 'Georgia, serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#80c080',
        })
        .setOrigin(0.5);
    }

    // New run button
    const buttonY = height * 0.75;
    const newRunBtn = this.add
      .rectangle(cx, buttonY, width - 60, 55, 0xe3bd4f)
      .setStrokeStyle(2, 0xffe798)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(cx, buttonY, 'NEW RUN', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#101725',
      })
      .setOrigin(0.5);

    newRunBtn.on('pointerdown', () => this.startNewRun());
    newRunBtn.on('pointerover', () => newRunBtn.setFillStyle(0xf0d070));
    newRunBtn.on('pointerout', () => newRunBtn.setFillStyle(0xe3bd4f));

    // Pulsing animation
    this.tweens.add({
      targets: newRunBtn,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private drawBackground(width: number, height: number, isVictory: boolean): void {
    const g = this.add.graphics();

    if (isVictory) {
      // Golden celebration particles
      for (let i = 0; i < 40; i++) {
        const x = Phaser.Math.Between(0, width);
        const y = Phaser.Math.Between(0, height);
        g.fillStyle(0xf0cf68, Phaser.Math.FloatBetween(0.03, 0.12));
        g.fillCircle(x, y, Phaser.Math.Between(1, 4));
      }
    } else {
      // Dark red tint
      g.fillStyle(0x200808, 0.3);
      g.fillRect(0, 0, width, height);
    }
  }

  private startNewRun(): void {
    const manager = getGameManager();
    manager.abandonRun();
    manager.startNewRun();
    this.scene.start('BattleScene');
  }
}
