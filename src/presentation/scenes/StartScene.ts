import Phaser from 'phaser';
import { getGameManager } from '../GameManager';
import { colors, getLayoutMetrics } from '../design/tokens';

export class StartScene extends Phaser.Scene {
  constructor() {
    super('StartScene');
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const cx = width / 2;
    const manager = getGameManager();

    // Draw background
    this.drawBackground(width, height);

    // Logo
    const logoY = height * 0.12;

    // "GOLF" text
    const golfText = this.add
      .text(cx, logoY, 'GOLF', {
        fontFamily: 'Lilita One',
        fontSize: '92px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 14)
      .setShadow(0, 8, '#1B1030', 0, true, true);

    // "ROGUE" text
    const rogueText = this.add
      .text(cx, logoY + 80, 'ROGUE', {
        fontFamily: 'Lilita One',
        fontSize: '104px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 14)
      .setShadow(0, 8, '#1B1030', 0, true, true);

    // Subtitle banner
    const bannerY = logoY + 160;
    const bannerWidth = 220;
    const bannerHeight = 32;

    const banner = this.add.graphics();
    banner.fillGradientStyle(0xff5050, 0xff5050, 0xd02040, 0xd02040, 1);
    banner.fillRoundedRect(cx - bannerWidth / 2, bannerY - bannerHeight / 2, bannerWidth, bannerHeight, 6);
    banner.lineStyle(3, colors.ink, 1);
    banner.strokeRoundedRect(cx - bannerWidth / 2, bannerY - bannerHeight / 2, bannerWidth, bannerHeight, 6);

    this.add
      .text(cx, bannerY, 'SOLITAIRE • ROGUELIKE', {
        fontFamily: 'Lilita One',
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 3);

    // Cards illustration
    const cardsY = bannerY + 100;
    this.drawCardsIllustration(cx, cardsY);

    // Enemy character (goblin attacking)
    const enemyY = cardsY + 20;
    const enemyX = cx + 110;
    if (this.textures.exists('enemy-goblin')) {
      const goblin = this.add.sprite(enemyX, enemyY, 'enemy-goblin');
      goblin.setOrigin(0.5, 0.5);
      goblin.setScale(0.9);
      goblin.setFlipX(true);
      
      const attackKey = 'goblin-attack';
      if (this.anims.exists(attackKey)) {
        goblin.play({ key: attackKey, repeat: -1 });
      }
    }

    // Tagline
    this.add
      .text(cx, cardsY + 100, 'Chain cards. Smash monsters.', {
        fontFamily: 'Fredoka',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 4);

    // START RUN button
    const buttonY = height - 180;
    this.createStartButton(cx, buttonY, manager.hasSavedGame());

    // Bottom buttons row
    const bottomY = height - 100;

    // Settings button
    this.createSecondaryButton(cx - 60, bottomY, 'SETTINGS', colors.blue, colors.blueLo, () => {
      // Settings not implemented yet
    });

    // Credits button
    this.createSecondaryButton(cx + 60, bottomY, 'CREDITS', colors.blue, colors.blueLo, () => {
      this.scene.start('CreditsScene');
    });

    // Mascot (small slime in corner)
    if (this.textures.exists('enemy-slime')) {
      const mascot = this.add.sprite(40, height - 60, 'enemy-slime');
      mascot.setOrigin(0.5, 1);
      mascot.setScale(0.4);
      const idleKey = 'slime-idle';
      if (this.anims.exists(idleKey)) {
        mascot.play(idleKey);
      }
    }
  }

  private drawBackground(width: number, height: number): void {
    const g = this.add.graphics();

    // Purple gradient sky
    const skyStops = [0x3f2ab8, 0x6030c0, 0x8040d0, 0xa050d8, 0xc060e0];
    const stopHeight = height / (skyStops.length - 1);
    for (let i = 0; i < skyStops.length - 1; i++) {
      g.fillGradientStyle(skyStops[i], skyStops[i], skyStops[i + 1], skyStops[i + 1], 1);
      g.fillRect(0, i * stopHeight, width, stopHeight + 1);
    }

    // Radial light in center
    const centerX = width / 2;
    const centerY = height * 0.4;
    g.fillStyle(0xffffff, 0.08);
    g.fillCircle(centerX, centerY, Math.min(width, height) * 0.6);
    g.fillStyle(0xffffff, 0.05);
    g.fillCircle(centerX, centerY, Math.min(width, height) * 0.4);

    // Mountains silhouette at bottom
    const mountainY = height * 0.75;
    g.fillStyle(0x5030a0, 0.5);
    g.beginPath();
    g.moveTo(0, height);
    g.lineTo(0, mountainY + 50);
    g.lineTo(width * 0.2, mountainY);
    g.lineTo(width * 0.35, mountainY + 30);
    g.lineTo(width * 0.5, mountainY - 20);
    g.lineTo(width * 0.65, mountainY + 20);
    g.lineTo(width * 0.8, mountainY - 10);
    g.lineTo(width, mountainY + 40);
    g.lineTo(width, height);
    g.closePath();
    g.fill();
  }

  private drawCardsIllustration(cx: number, cy: number): void {
    const cardW = 65;
    const cardH = 90;
    const cards = [
      { rank: 'Q', suit: '♣', color: colors.club, offsetX: -70, angle: -15, power: 'BOMB' },
      { rank: '5', suit: '♠', color: colors.spade, offsetX: -25, angle: -5, power: 'WILD' },
      { rank: 'A', suit: '♠', color: colors.spade, offsetX: 30, angle: 8, power: 'CRIT' },
    ];

    cards.forEach((card) => {
      const x = cx + card.offsetX;
      const y = cy;

      const container = this.add.container(x, y);
      container.setAngle(card.angle);

      // Card background
      const bg = this.add.graphics();
      bg.fillGradientStyle(colors.faceHi, colors.faceHi, colors.faceLo, colors.faceLo, 1);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 10);
      bg.fillStyle(colors.bevel, 1);
      bg.fillRoundedRect(-cardW / 2, cardH / 2 - 6, cardW, 6, { bl: 10, br: 10, tl: 0, tr: 0 });
      bg.lineStyle(3, colors.ink, 1);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 10);
      container.add(bg);

      // Rank
      const rankText = this.add
        .text(-cardW / 2 + 8, -cardH / 2 + 6, card.rank, {
          fontFamily: 'Lilita One',
          fontSize: '28px',
          color: '#' + card.color.toString(16).padStart(6, '0'),
        });
      container.add(rankText);

      // Big suit
      const suitText = this.add
        .text(0, 10, card.suit, {
          fontFamily: 'Arial',
          fontSize: '32px',
          color: '#' + card.color.toString(16).padStart(6, '0'),
        })
        .setOrigin(0.5);
      container.add(suitText);

      // Power badge
      if (card.power) {
        const badgeY = cardH / 2 + 2;
        const powerColors: Record<string, number[]> = {
          CRIT: [0xff9a00, 0xff3a1a],
          WILD: [0x39d9ff, 0xff3db8],
          BOMB: [0xff3b30, 0x1b1030],
        };
        const [pwHi, pwLo] = powerColors[card.power] || [0xffcc00, 0xff8800];

        const badge = this.add.graphics();
        badge.fillGradientStyle(pwHi, pwHi, pwLo, pwLo, 1);
        badge.fillRoundedRect(-22, badgeY - 10, 44, 18, 6);
        badge.lineStyle(2, colors.ink, 1);
        badge.strokeRoundedRect(-22, badgeY - 10, 44, 18, 6);
        container.add(badge);

        const badgeText = this.add
          .text(0, badgeY, card.power, {
            fontFamily: 'Lilita One',
            fontSize: '10px',
            color: '#ffffff',
          })
          .setOrigin(0.5)
          .setStroke('#1B1030', 2);
        container.add(badgeText);
      }
    });
  }

  private createStartButton(x: number, y: number, hasSave: boolean): void {
    const buttonWidth = 280;
    const buttonHeight = 64;

    const container = this.add.container(x, y);

    // Button background with 3D effect
    const bg = this.add.graphics();

    // Bottom shadow
    bg.fillStyle(colors.ink, 1);
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2 + 8, buttonWidth, buttonHeight, 20);

    // Main button body
    bg.fillGradientStyle(colors.goldHi, colors.goldHi, colors.gold, colors.gold, 1);
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight - 6, 20);

    // Bottom lip
    bg.fillStyle(colors.goldLo, 1);
    bg.fillRoundedRect(-buttonWidth / 2, buttonHeight / 2 - 18, buttonWidth, 12, { bl: 20, br: 20, tl: 0, tr: 0 });

    // Top highlight
    bg.fillStyle(0xffffff, 0.35);
    bg.fillRoundedRect(-buttonWidth / 2 + 12, -buttonHeight / 2 + 5, buttonWidth - 24, 10, 6);

    // Outline
    bg.lineStyle(4, colors.ink, 1);
    bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight - 6, 20);

    container.add(bg);

    // Button text
    const text = hasSave ? 'CONTINUE' : 'START RUN';
    const buttonText = this.add
      .text(0, -3, text, {
        fontFamily: 'Lilita One',
        fontSize: '38px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 6)
      .setShadow(0, 3, '#1B1030', 0, true, true);
    container.add(buttonText);

    // Glow behind button
    const glow = this.add.graphics();
    glow.fillStyle(colors.gold, 0.3);
    glow.fillEllipse(0, buttonHeight / 2 + 10, buttonWidth + 40, 30);
    container.addAt(glow, 0);

    // Breathing animation
    this.tweens.add({
      targets: container,
      scaleX: 1.03,
      scaleY: 1.03,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    // Interactivity
    container.setInteractive(
      new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight),
      Phaser.Geom.Rectangle.Contains
    );

    container.on('pointerdown', () => {
      this.tweens.killTweensOf(container);
      container.setScale(0.95);

      const manager = getGameManager();
      if (hasSave && manager.loadSavedGame()) {
        const state = manager.getState();
        if (state) {
          this.navigateToPhase(state.phase);
          return;
        }
      }

      manager.startNewRun();
      this.scene.start('BattleScene');
    });

    container.on('pointerup', () => {
      container.setScale(1);
    });

    container.on('pointerout', () => {
      container.setScale(1);
    });
  }

  private createSecondaryButton(
    x: number,
    y: number,
    text: string,
    colorHi: number,
    colorLo: number,
    callback: () => void
  ): void {
    const buttonWidth = 100;
    const buttonHeight = 44;

    const container = this.add.container(x, y);

    const bg = this.add.graphics();

    // Shadow
    bg.fillStyle(colors.ink, 1);
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2 + 5, buttonWidth, buttonHeight, 14);

    // Body
    bg.fillGradientStyle(colorHi, colorHi, colorLo, colorLo, 1);
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight - 5, 14);

    // Outline
    bg.lineStyle(3, colors.ink, 1);
    bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight - 5, 14);

    container.add(bg);

    const buttonText = this.add
      .text(0, -2, text, {
        fontFamily: 'Lilita One',
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 3);
    container.add(buttonText);

    container.setInteractive(
      new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight),
      Phaser.Geom.Rectangle.Contains
    );

    container.on('pointerdown', () => {
      container.setScale(0.95);
      callback();
    });

    container.on('pointerup', () => {
      container.setScale(1);
    });

    container.on('pointerout', () => {
      container.setScale(1);
    });
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
