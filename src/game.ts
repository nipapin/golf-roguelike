/**
 * Main game initialization module.
 * This is lazy-loaded after the loading screen is shown.
 */

import { assetUrl } from './configurator/runtime';
import { applyConfiguredColors } from './presentation/design/tokens';
import { viewportHeight } from './presentation/design/safeArea';
import Phaser from 'phaser';
import './style.css';
import { setRenderDensity, getRenderDensity } from './presentation/design/viewport';

import { AudioSystem } from './presentation/audio/AudioSystem';
import { initPWAUpdateHandler } from './pwa/updateHandler';
import { BootScene } from './presentation/scenes/BootScene';
import { CastleMenuScene } from './castle/CastleMenuScene';
import { CastleScene } from './castle/CastleScene';

export async function initGame(onProgress?: (progress: number, text: string) => void) {
  onProgress?.(0.1, 'Applying theme...');
  applyConfiguredColors();
  
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')) {
    link.href = assetUrl(new URL(link.href).pathname);
  }

  onProgress?.(0.2, 'Setting up PWA...');
  initPWAUpdateHandler();

  onProgress?.(0.3, 'Loading audio...');
  AudioSystem.init().catch(() => {
    // Audio initialization failed, game will work without sound
  });

  const unlockAudio = () => {
    AudioSystem.unlock();
    document.removeEventListener('touchstart', unlockAudio);
    document.removeEventListener('click', unlockAudio);
  };
  document.addEventListener('touchstart', unlockAudio, { once: true });
  document.addEventListener('click', unlockAudio, { once: true });

  onProgress?.(0.5, 'Creating game...');

  const host = document.getElementById('game')!;
  const syncViewportHeight = () => {
    const height = viewportHeight({ 
      innerWidth: window.innerWidth, 
      innerHeight: window.innerHeight, 
      screenWidth: screen.width, 
      screenHeight: screen.height, 
      visualHeight: window.visualViewport?.height, 
      iosStandalone: (navigator as Navigator & { standalone?: boolean }).standalone === true 
    });
    document.documentElement.style.setProperty('--viewport-height', height + 'px');
  };
  syncViewportHeight();
  
  setRenderDensity(window.devicePixelRatio || 1);
  const density = getRenderDensity();
  const bounds = host.getBoundingClientRect();

  onProgress?.(0.7, 'Starting Phaser...');

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
    scene: [BootScene, CastleMenuScene, CastleScene],
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
  
  onProgress?.(0.9, 'Finishing setup...');
  
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
      }
      game.scale.updateBounds();
      const display = game.scale.canvasBounds;
      if (display.width > 0 && display.height > 0) {
        game.scale.displayScale.set(game.scale.baseSize.width / display.width, game.scale.baseSize.height / display.height);
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

  onProgress?.(1, 'Ready!');
}
