import Phaser from 'phaser';
import './style.css';

import { BootScene } from './presentation/scenes/BootScene';
import { StartScene } from './presentation/scenes/StartScene';
import { BattleScene } from './presentation/scenes/BattleScene';
import { RewardScene } from './presentation/scenes/RewardScene';
import { ShopScene } from './presentation/scenes/ShopScene';
import { EndScene } from './presentation/scenes/EndScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#080b12',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  scene: [BootScene, StartScene, BattleScene, RewardScene, ShopScene, EndScene],
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
  },
};

new Phaser.Game(config);
