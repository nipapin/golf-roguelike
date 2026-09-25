import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    // Load card assets
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
    const suits = ['S', 'H', 'D', 'C'];

    for (const rank of ranks) {
      for (const suit of suits) {
        const key = `card-${rank}${suit}`;
        this.load.svg(key, `/assets/cards/${rank}${suit}.svg`);
      }
    }

    // Load enemy assets
    const enemies = ['slime', 'bandit', 'knight', 'mimic', 'witch', 'king'];
    for (const enemy of enemies) {
      this.load.svg(`enemy-${enemy}`, `/assets/enemies/${enemy}.svg`);
    }

    // Show loading progress
    const width = this.scale.width;
    const height = this.scale.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xf0cf68, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
    });
  }

  create(): void {
    this.scene.start('StartScene');
  }
}
