import Phaser from 'phaser';

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('CreditsScene');
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const cx = width / 2;

    // Background
    this.cameras.main.setBackgroundColor('#0a0e17');

    // Title
    this.add
      .text(cx, 50, 'CREDITS', {
        fontFamily: 'Georgia, serif',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#f0cf68',
      })
      .setOrigin(0.5);

    // Content
    const content = [
      { text: 'Character Art', style: 'header' },
      { text: 'Segel (Segel2D)', style: 'name' },
      { text: 'OpenGameArt.org', style: 'normal' },
      { text: '', style: 'normal' },
      { text: 'CC-BY 3.0 Characters:', style: 'subheader' },
      { text: '• Cave Bat', style: 'item' },
      { text: '• Goblin Thief', style: 'item' },
      { text: '• Highway Bandit', style: 'item' },
      { text: '• Dark Knight', style: 'item' },
      { text: '', style: 'normal' },
      { text: 'CC0 Characters:', style: 'subheader' },
      { text: '• Green Slime', style: 'item' },
      { text: '• Spore Shroom', style: 'item' },
      { text: '• Dire Wolf', style: 'item' },
      { text: '• Undead', style: 'item' },
      { text: '• The Golf King', style: 'item' },
    ];

    let y = 100;
    for (const line of content) {
      const style = this.getTextStyle(line.style);
      this.add.text(cx, y, line.text, style).setOrigin(0.5);
      y += line.style === 'header' ? 35 : line.style === 'subheader' ? 28 : 22;
    }

    // Attribution notice
    this.add
      .text(cx, height - 90, 'CC-BY 3.0 characters licensed under', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '9px',
        color: '#5a6a7a',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, height - 75, 'creativecommons.org/licenses/by/3.0/', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '9px',
        color: '#7090b0',
      })
      .setOrigin(0.5);

    // Back button
    const backBtn = this.add
      .rectangle(cx, height - 35, 120, 40, 0x2a3a4a)
      .setStrokeStyle(1, 0x4a5a6a)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(cx, height - 35, 'BACK', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#c0d0e0',
      })
      .setOrigin(0.5);

    backBtn.on('pointerdown', () => this.scene.start('StartScene'));
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x3a4a5a));
    backBtn.on('pointerout', () => backBtn.setFillStyle(0x2a3a4a));
  }

  private getTextStyle(type: string): Phaser.Types.GameObjects.Text.TextStyle {
    switch (type) {
      case 'header':
        return {
          fontFamily: 'Georgia, serif',
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#e8e0d0',
        };
      case 'subheader':
        return {
          fontFamily: 'Arial, sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#a0b0c0',
        };
      case 'name':
        return {
          fontFamily: 'Georgia, serif',
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#f0cf68',
        };
      case 'item':
        return {
          fontFamily: 'Arial, sans-serif',
          fontSize: '12px',
          color: '#8a9aaa',
        };
      default:
        return {
          fontFamily: 'Arial, sans-serif',
          fontSize: '12px',
          color: '#7a8a9a',
        };
    }
  }
}
