import { VFX_KEYS, createCombatAnimations } from '../design/CombatVFX';
import { viewport, configureViewport, getRenderDensity } from '../design/viewport';
import Phaser from 'phaser';
import { colors } from '../design/tokens';

import { preloadCardboardArt, createCardboardAnimations } from '../../castle/CardboardArt';
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    configureViewport(this);
    for (const key of VFX_KEYS)
      this.load.atlas('vfx-' + key, '/assets/vfx/' + key + '.webp', '/assets/vfx/' + key + '.json');

    preloadCardboardArt(this);

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
        resolution: getRenderDensity(),
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
    configureViewport(this);
    // Create enemy animations
    createCardboardAnimations(this);
    createCombatAnimations(this);

    this.scene.start('StartScene');
  }
}
