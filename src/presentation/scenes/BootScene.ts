import Phaser from 'phaser';

// Enemy sprite configuration
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
    // Load card assets
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
    const suits = ['S', 'H', 'D', 'C'];

    for (const rank of ranks) {
      for (const suit of suits) {
        const key = `card-${rank}${suit}`;
        this.load.svg(key, `/assets/cards/${rank}${suit}.svg`);
      }
    }

    // Load enemy sprite atlases (WebP with PNG fallback)
    for (const enemy of ENEMY_SPRITES) {
      // Try WebP first, fallback to PNG handled by browser
      this.load.atlas(
        `enemy-${enemy}`,
        `/assets/enemies/atlases/${enemy}.webp`,
        `/assets/enemies/atlases/${enemy}.json`
      );
    }

    // Load crown overlay for boss
    this.load.svg('crown', '/assets/enemies/crown.svg');

    // Show loading progress
    const width = this.scale.width;
    const height = this.scale.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const loadingText = this.add
      .text(width / 2, height / 2 - 50, 'Loading...', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xf0cf68, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
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

      // Check if atlas was loaded
      if (!this.textures.exists(atlasKey)) {
        console.warn(`Atlas not loaded: ${atlasKey}`);
        continue;
      }

      // Get animation data from the atlas JSON
      const atlasData = this.cache.json.get(atlasKey);
      if (!atlasData?.animations) {
        // Create default animations based on frame count
        const frames = this.textures.get(atlasKey).getFrameNames();
        const frameCount = frames.length;

        if (frameCount > 0) {
          // Assume standard layout: idle(~10), attack(~8), hurt(~8), dead(~8)
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
        continue;
      }

      // Use animation data from JSON
      const anims = atlasData.animations;

      if (anims.idle) {
        this.createAnimationFromRange(
          atlasKey,
          'idle',
          enemy,
          anims.idle.start,
          anims.idle.end,
          anims.idle.frameRate || 10,
          anims.idle.repeat ?? -1
        );
      }

      if (anims.attack) {
        this.createAnimationFromRange(
          atlasKey,
          'attack',
          enemy,
          anims.attack.start,
          anims.attack.end,
          anims.attack.frameRate || 12,
          anims.attack.repeat ?? 0
        );
      }

      if (anims.hurt) {
        this.createAnimationFromRange(
          atlasKey,
          'hurt',
          enemy,
          anims.hurt.start,
          anims.hurt.end,
          anims.hurt.frameRate || 12,
          anims.hurt.repeat ?? 0
        );
      }

      if (anims.dead) {
        this.createAnimationFromRange(
          atlasKey,
          'dead',
          enemy,
          anims.dead.start,
          anims.dead.end,
          anims.dead.frameRate || 10,
          anims.dead.repeat ?? 0
        );
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
