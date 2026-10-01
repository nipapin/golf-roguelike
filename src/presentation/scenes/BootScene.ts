import { VFX_KEYS, createCombatAnimations } from '../design/CombatVFX';
import { viewport, configureViewport, getRenderDensity } from '../design/viewport';
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
    configureViewport(this);
    for (const key of VFX_KEYS) this.load.atlas('vfx-' + key, '/assets/vfx/' + key + '.webp', '/assets/vfx/' + key + '.json');

    // Load enemy sprite atlases
    for (const enemy of ENEMY_SPRITES) {
      this.load.atlas(
        `enemy-${enemy}`,
        `/assets/enemies/atlases/${enemy}.webp`,
        `/assets/enemies/atlases/${enemy}.json`
      );
    }

    this.load.svg('coin', '/assets/coin.svg', { width: 96, height: 96 });

    // Load crown overlay for boss
    // Explicit size: SVGs without intrinsic width/height fail WebGL upload ("texImage2D: bad image data").
    this.load.svg('crown', '/assets/enemies/crown.svg', { width: 128, height: 96 });

    // (game-icons.net SVGs are not used by any scene; they are no longer loaded at boot.)

    // Show loading progress
    const width = viewport(this).width;
    const height = viewport(this).height;

    // Background
    this.cameras.main.setBackgroundColor(colors.feltLo);

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(colors.ink, 0.8);
    progressBox.fillRoundedRect(width / 2 - 160, height / 2 - 25, 320, 50, 12);

    const loadingText = this.add
      .text(width / 2, height / 2 - 60, 'Loading...', {
        resolution: getRenderDensity(), fontFamily: 'Lilita One, sans-serif',
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
    configureViewport(this);
    // Create enemy animations
    this.createEnemyAnimations();
    createCombatAnimations(this);

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
        // Goblin's generated atlas has repeated placeholder frames after frame 8.
        // Keep idle out of the death pose; all actors also receive motion tweens.
        const ranges = enemy === 'goblin'
          ? { idle: [0, 3], attack: [4, 7], hurt: [7, 7], dead: [8, 8] }
          : { idle: [0, Math.min(11, frameCount - 1)], attack: [12, Math.min(19, frameCount - 1)], hurt: [20, Math.min(27, frameCount - 1)], dead: [28, frameCount - 1] };
        for (const [name, [start, end]] of Object.entries(ranges)) {
          this.createAnimationFromRange(atlasKey, name, enemy, start, end, name === 'idle' ? 8 : 12, name === 'idle' ? -1 : 0);
        }
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
