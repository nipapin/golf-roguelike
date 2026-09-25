import Phaser from 'phaser';
import { colors } from '../design/tokens';

const ENEMY_SPRITES = [
  'slime',
  'mushroom',
  'bat',
  'wolf',
  'zombie',
  'goblin',
  'bandit',
  'knight',
  'samurai',
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    // Load enemy sprite atlases
    for (const enemy of ENEMY_SPRITES) {
      this.load.atlas(
        `enemy-${enemy}`,
        `/assets/enemies/atlases/${enemy}.webp`,
        `/assets/enemies/atlases/${enemy}.json`
      );
    }

    // Load crown overlay for boss
    this.load.svg('crown', '/assets/enemies/crown.svg');

    // Load game-icons.net icons
    const icons = [
      'lorc_broadsword',
      'lorc_checked-shield',
      'lorc_crossed-swords',
      'delapouite_two-coins',
      'lorc_shining-heart',
      'lorc_sword-wound',
      'lorc_echo-ripples',
      'delapouite_card-joker',
      'lorc_unlit-bomb',
      'lorc_cog',
      'carl-olsen_flame',
      'lorc_horned-skull',
    ];
    for (const icon of icons) {
      this.load.svg(`icon-${icon}`, `/assets/icons/${icon}.svg`);
    }

    // Show loading progress
    const width = this.scale.width;
    const height = this.scale.height;

    // Background
    this.cameras.main.setBackgroundColor(colors.feltLo);

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(colors.ink, 0.8);
    progressBox.fillRoundedRect(width / 2 - 160, height / 2 - 25, 320, 50, 12);

    const loadingText = this.add
      .text(width / 2, height / 2 - 60, 'Loading...', {
        fontFamily: 'Lilita One, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#1B1030', 4)
      .setShadow(0, 2, '#1B1030', 0, true, true);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(colors.gold, 1);
      progressBar.fillRoundedRect(width / 2 - 150, height / 2 - 15, 300 * value, 30, 8);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });
  }

  create(): void {
    // Create enemy animations
    this.createEnemyAnimations();

    this.scene.start('StartScene');
  }

  private createEnemyAnimations(): void {
    for (const enemy of ENEMY_SPRITES) {
      const atlasKey = `enemy-${enemy}`;

      if (!this.textures.exists(atlasKey)) {
        console.warn(`Atlas not loaded: ${atlasKey}`);
        continue;
      }

      const frames = this.textures.get(atlasKey).getFrameNames();
      const frameCount = frames.length;

      if (frameCount > 0) {
        const idleEnd = Math.min(11, frameCount - 1);
        const attackStart = idleEnd + 1;
        const attackEnd = Math.min(attackStart + 7, frameCount - 1);
        const hurtStart = attackEnd + 1;
        const hurtEnd = Math.min(hurtStart + 7, frameCount - 1);
        const deadStart = hurtEnd + 1;
        const deadEnd = frameCount - 1;

        this.createAnimationFromRange(atlasKey, 'idle', enemy, 0, idleEnd, 10, -1);
        this.createAnimationFromRange(atlasKey, 'attack', enemy, attackStart, attackEnd, 12, 0);
        this.createAnimationFromRange(atlasKey, 'hurt', enemy, hurtStart, hurtEnd, 12, 0);
        this.createAnimationFromRange(atlasKey, 'dead', enemy, deadStart, deadEnd, 10, 0);
      }
    }
  }

  private createAnimationFromRange(
    atlasKey: string,
    animName: string,
    enemy: string,
    start: number,
    end: number,
    frameRate: number,
    repeat: number
  ): void {
    const frames: Phaser.Types.Animations.AnimationFrame[] = [];

    for (let i = start; i <= end; i++) {
      const frameName = `${enemy}_${i.toString().padStart(3, '0')}`;
      if (this.textures.get(atlasKey).has(frameName)) {
        frames.push({ key: atlasKey, frame: frameName });
      }
    }

    if (frames.length > 0) {
      const animKey = `${enemy}-${animName}`;
      if (!this.anims.exists(animKey)) {
        this.anims.create({
          key: animKey,
          frames,
          frameRate,
          repeat,
        });
      }
    }
  }
}
