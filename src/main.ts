import Phaser from 'phaser';
import './style.css';

import { loadFonts } from './presentation/design/fontLoader';
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

  // Get device pixel ratio for crisp text at DPR 3
  const dpr = Math.min(window.devicePixelRatio || 1, 3);

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
  };

  new Phaser.Game(config);
}

initGame();
