import { VFX_KEYS, createCombatAnimations } from '../design/CombatVFX';
import { viewport, configureViewport, getRenderDensity } from '../design/viewport';
import Phaser from 'phaser';
import { colors } from '../design/tokens';

const ENEMY_SPRITES = ['orc1', 'orc2', 'orc3'];

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

      for (const action of ['idle', 'attack', 'hurt', 'dead']) {
        const names = this.textures.get(atlasKey).getFrameNames().filter(name => name.startsWith(action + '_')).sort();
        if (names.length && !this.anims.exists(`${enemy}-${action}`)) this.anims.create({
          key: `${enemy}-${action}`, frames: names.map(frame => ({ key: atlasKey, frame })),
          frameRate: action === 'idle' ? 7 : 12, repeat: action === 'idle' ? -1 : 0,
        });
      }
    }
  }
}
