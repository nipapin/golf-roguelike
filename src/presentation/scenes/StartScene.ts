import Phaser from 'phaser';
import { getGameManager } from '../GameManager';

export class StartScene extends Phaser.Scene {
  constructor() {
    super('StartScene');
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const cx = width / 2;
    const manager = getGameManager();

    // Background
    this.cameras.main.setBackgroundColor('#0a0e17');
    this.drawBackground(width, height);

    // Title
    const titleY = height * 0.12;
    this.add
      .text(cx, titleY, 'GOLF', {
        fontFamily: 'Georgia, serif',
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#f5d56a',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, titleY + 55, 'ROGUE', {
        fontFamily: 'Georgia, serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, titleY + 95, 'ROGUELIKE SOLITAIRE', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#8a9bb8',
      })
      .setOrigin(0.5);

    // Decorative cards
    const cardsY = titleY + 180;
    const cardData: [string, number, number][] = [
      ['A♠', -55, -8],
      ['K♥', 0, 0],
      ['Q♦', 55, 8],
    ];

    cardData.forEach(([label, offsetX, angle]) => {
      const isCenter = offsetX === 0;
      this.add
        .rectangle(cx + offsetX, cardsY, 65, 95, isCenter ? 0xfff7e8 : 0xe8edf7)
        .setStrokeStyle(2, isCenter ? 0xf0cf68 : 0x7e91b5)
        .setAngle(angle);

      const isRed = label.includes('♥') || label.includes('♦');
      this.add
        .text(cx + offsetX, cardsY, label, {
          fontFamily: 'Georgia, serif',
          fontSize: '22px',
          fontStyle: 'bold',
          color: isRed ? '#c84050' : '#1a2540',
        })
        .setOrigin(0.5)
        .setAngle(angle);
    });

    // Tagline
    this.add
      .text(cx, cardsY + 80, 'BUILD CHAINS.  HIT HARD.', {
        fontFamily: 'Georgia, serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#e8dcc0',
      })
      .setOrigin(0.5);

    // Buttons
    const buttonY = height * 0.65;
    const buttonWidth = Math.min(width - 60, 280);

    // Continue button (if save exists)
    if (manager.hasSavedGame()) {
      const continueBtn = this.add
        .rectangle(cx, buttonY - 45, buttonWidth, 50, 0x3a6a3a)
        .setStrokeStyle(2, 0x5a9a5a)
        .setInteractive({ useHandCursor: true });

      this.add
        .text(cx, buttonY - 45, 'CONTINUE RUN', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5);

      continueBtn.on('pointerdown', () => this.continueRun());
      continueBtn.on('pointerover', () => continueBtn.setFillStyle(0x4a8a4a));
      continueBtn.on('pointerout', () => continueBtn.setFillStyle(0x3a6a3a));
    }

    // New run button
    const newRunY = manager.hasSavedGame() ? buttonY + 20 : buttonY;
    const newRunBtn = this.add
      .rectangle(cx, newRunY, buttonWidth, 55, 0xe3bd4f)
      .setStrokeStyle(2, 0xffe798)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(cx, newRunY, 'NEW RUN', {
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

    // Info text
    this.add
      .text(cx, height - 50, '7 POWER CARDS • 7 BATTLES • RELICS', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#6a7a8a',
      })
      .setOrigin(0.5);
  }

  private drawBackground(width: number, height: number): void {
    const g = this.add.graphics();

    // Gradient-like background
    g.fillStyle(0x1a2540, 1);
    g.fillRect(0, 0, width, height);

    // Subtle decorative elements
    g.fillStyle(0x2a3a5a, 0.3);
    g.fillCircle(width * 0.2, height * 0.3, 150);
    g.fillCircle(width * 0.85, height * 0.6, 120);

    // Stars
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.02, 0.1));
      g.fillCircle(x, y, Phaser.Math.Between(1, 2));
    }
  }

  private continueRun(): void {
    const manager = getGameManager();
    if (manager.loadSavedGame()) {
      const state = manager.getState();
      if (state) {
        this.navigateToPhase(state.phase);
      }
    }
  }

  private startNewRun(): void {
    const manager = getGameManager();
    manager.startNewRun();
    this.scene.start('BattleScene');
  }

  private navigateToPhase(phase: string): void {
    switch (phase) {
      case 'battle':
        this.scene.start('BattleScene');
        break;
      case 'reward':
        this.scene.start('RewardScene');
        break;
      case 'shop':
        this.scene.start('ShopScene');
        break;
      case 'victory':
      case 'defeat':
        this.scene.start('EndScene');
        break;
      default:
        this.scene.start('BattleScene');
    }
  }
}
