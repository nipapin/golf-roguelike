import Phaser from 'phaser';
import { colors } from '../design/tokens';

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('CreditsScene');
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const cx = width / 2;

    // Background
    this.cameras.main.setBackgroundColor(colors.feltLo);

    // Title
    this.add
      .text(cx, 50, 'CREDITS', {
        fontFamily: 'Lilita One',
        fontSize: '36px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 6)
      .setShadow(0, 3, '#1B1030', 0, true, true);

    // Content
    const content = [
      { text: 'Character Art', style: 'header' },
      { text: 'Segel (Segel2D)', style: 'name' },
      { text: 'OpenGameArt.org', style: 'normal' },
      { text: '', style: 'spacer' },
      { text: 'CC-BY 3.0 Characters:', style: 'subheader' },
      { text: '• Cave Bat', style: 'item' },
      { text: '• Goblin Thief / Highway Bandit', style: 'item' },
      { text: '• Dark Knight', style: 'item' },
      { text: '', style: 'spacer' },
      { text: 'CC0 Characters:', style: 'subheader' },
      { text: '• Green Slime, Spore Shroom', style: 'item' },
      { text: '• Dire Wolf, Undead', style: 'item' },
      { text: '• The Golf King (Samurai)', style: 'item' },
      { text: '', style: 'spacer' },
      { text: 'Icons', style: 'header' },
      { text: 'game-icons.net', style: 'name' },
      { text: 'Licensed CC-BY 3.0', style: 'normal' },
      { text: '', style: 'spacer' },
      { text: 'Icon Authors:', style: 'subheader' },
      { text: '• Lorc', style: 'item' },
      { text: '• Delapouite', style: 'item' },
      { text: '• sbed', style: 'item' },
      { text: '• Carl Olsen', style: 'item' },
      { text: '', style: 'spacer' },
      { text: 'Fonts', style: 'header' },
      { text: 'Lilita One, Fredoka, Rubik', style: 'name' },
      { text: 'Google Fonts • SIL OFL 1.1', style: 'normal' },
    ];

    let y = 100;
    for (const line of content) {
      if (line.style === 'spacer') {
        y += 8;
        continue;
      }

      const style = this.getTextStyle(line.style);
      const text = this.add.text(cx, y, line.text, style).setOrigin(0.5);

      if (line.style === 'header' || line.style === 'name') {
        text.setStroke('#1B1030', 3);
      }

      y += line.style === 'header' ? 32 : line.style === 'subheader' ? 26 : line.style === 'name' ? 28 : 20;
    }

    // License links
    this.add
      .text(cx, height - 100, 'creativecommons.org/licenses/by/3.0/', {
        fontFamily: 'Fredoka',
        fontSize: '10px',
        color: '#7090b0',
      })
      .setOrigin(0.5);

    // Back button
    this.createBackButton(cx, height - 50);
  }

  private createBackButton(x: number, y: number): void {
    const buttonWidth = 120;
    const buttonHeight = 44;

    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(colors.ink, 1);
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2 + 4, buttonWidth, buttonHeight, 14);
    bg.fillGradientStyle(colors.blue, colors.blue, colors.blueLo, colors.blueLo, 1);
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight - 4, 14);
    bg.lineStyle(3, colors.ink, 1);
    bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight - 4, 14);
    container.add(bg);

    const text = this.add
      .text(0, -2, 'BACK', {
        fontFamily: 'Lilita One',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 3);
    container.add(text);

    container.setInteractive(
      new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight),
      Phaser.Geom.Rectangle.Contains
    );

    container.on('pointerdown', () => {
      container.setScale(0.95);
      this.scene.start('StartScene');
    });

    container.on('pointerup', () => container.setScale(1));
    container.on('pointerout', () => container.setScale(1));
  }

  private getTextStyle(type: string): Phaser.Types.GameObjects.Text.TextStyle {
    switch (type) {
      case 'header':
        return {
          fontFamily: 'Lilita One',
          fontSize: '20px',
          color: '#f0cf68',
        };
      case 'subheader':
        return {
          fontFamily: 'Fredoka',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#a0b0c0',
        };
      case 'name':
        return {
          fontFamily: 'Lilita One',
          fontSize: '18px',
          color: '#ffffff',
        };
      case 'item':
        return {
          fontFamily: 'Fredoka',
          fontSize: '13px',
          color: '#8a9aaa',
        };
      default:
        return {
          fontFamily: 'Fredoka',
          fontSize: '12px',
          color: '#7a8a9a',
        };
    }
  }
}
