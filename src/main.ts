import Phaser from 'phaser';
import './style.css';
import { setRenderDensity, getRenderDensity } from './presentation/design/viewport';

import { loadFonts } from './presentation/design/fontLoader';
import { AudioSystem } from './presentation/audio/AudioSystem';
import { initPWAUpdateHandler } from './pwa/updateHandler';
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

  // Initialize PWA update handler (prompt mode with in-app update toast)
  initPWAUpdateHandler();

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

  const host = document.getElementById('game')!;
  const syncViewportHeight = () => {
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    const height = standalone ? window.innerHeight : (window.visualViewport?.height ?? window.innerHeight);
    document.documentElement.style.setProperty('--viewport-height', height + 'px');
  };
  syncViewportHeight();
  setRenderDensity(window.devicePixelRatio || 1);
  const density = getRenderDensity();
  const bounds = host.getBoundingClientRect();

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#140A2A',
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.round(bounds.width * density),
      height: Math.round(bounds.height * density),
      zoom: 1 / density,
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

  const game = new Phaser.Game(config);
  let resizeFrame = 0;
  const resize = () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      syncViewportHeight();
      const rect = host.getBoundingClientRect();
      const width = Math.round(rect.width * density);
      const height = Math.round(rect.height * density);
      if (width > 0 && height > 0 && (game.scale.width !== width || game.scale.height !== height)) {
        game.scale.resize(width, height);
        // Battle has its own resize handler. Rebuild visible menus/popups too.
        for (const scene of game.scene.getScenes(true)) {
          if (scene.scene.key === 'StartScene' || scene.scene.key === 'CreditsScene') scene.scene.restart();
        }
      }
    });
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  window.addEventListener('resize', resize);
  window.addEventListener('pageshow', resize);
  window.visualViewport?.addEventListener('resize', resize);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    observer.disconnect();
    cancelAnimationFrame(resizeFrame);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pageshow', resize);
    window.visualViewport?.removeEventListener('resize', resize);
  });
}

initGame();
