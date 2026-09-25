import Phaser from 'phaser';
import './style.css';

import { loadFonts } from './presentation/design/fontLoader';
import { AudioSystem } from './presentation/audio/AudioSystem';
import { BootScene } from './presentation/scenes/BootScene';
import { StartScene } from './presentation/scenes/StartScene';
import { BattleScene } from './presentation/scenes/BattleScene';
import { RewardScene } from './presentation/scenes/RewardScene';
import { ShopScene } from './presentation/scenes/ShopScene';
import { EndScene } from './presentation/scenes/EndScene';
import { CreditsScene } from './presentation/scenes/CreditsScene';

async function initGame() {
  // Load fonts before Phaser starts (per STYLE.md section 13)
  await loadFonts();

  // Initialize audio system (loads sounds in background)
  AudioSystem.init().catch(() => {
    // Audio initialization failed, game will work without sound
  });

  // Unlock audio on first user interaction (required for iOS Safari)
  const unlockAudio = () => {
    AudioSystem.unlock();
    document.removeEventListener('touchstart', unlockAudio);
    document.removeEventListener('click', unlockAudio);
  };
  document.addEventListener('touchstart', unlockAudio, { once: true });
  document.addEventListener('click', unlockAudio, { once: true });

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#140A2A',
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    scene: [BootScene, StartScene, BattleScene, RewardScene, ShopScene, EndScene, CreditsScene],
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: true,
    },
    input: {
      activePointers: 3,
    },
  };

  new Phaser.Game(config);
}

initGame();
