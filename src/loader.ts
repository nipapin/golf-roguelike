/**
 * Lightweight loader that shows the loading screen immediately,
 * then lazy-loads Phaser and the game.
 */
export {};

const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loader-bar');
const loaderText = document.getElementById('loader-text');

function setProgress(percent: number, text?: string) {
  if (loaderBar) {
    loaderBar.style.width = `${percent}%`;
  }
  if (loader) {
    loader.setAttribute('aria-valuenow', String(Math.round(percent)));
  }
  if (loaderText && text) {
    loaderText.textContent = text;
  }
}

function hideLoader() {
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => {
      loader.remove();
    }, 400);
  }
}

async function loadGame() {
  try {
    setProgress(5, 'Loading fonts...');
    
    // Load fonts early (they're needed for Phaser text)
    const { loadFonts } = await import('./presentation/design/fontLoader');
    await loadFonts();
    setProgress(15, 'Loading configuration...');
    
    // Load asset configuration
    const { loadAssetConfig } = await import('./configurator/runtime');
    await loadAssetConfig();
    setProgress(25, 'Loading game engine...');
    
    // Dynamically import the game module (which imports Phaser)
    const gameModule = await import('./game');
    setProgress(70, 'Initializing game...');
    
    // Initialize the game
    await gameModule.initGame((progress, text) => {
      setProgress(70 + progress * 0.3, text);
    });
    
    setProgress(100, 'Ready!');
    
    // Small delay to show 100% before hiding
    await new Promise(resolve => setTimeout(resolve, 200));
    hideLoader();
    
  } catch (error) {
    console.error('Failed to load game:', error);
    setProgress(0, 'Failed to load. Tap to retry.');
    if (loader) {
      loader.addEventListener('click', () => {
        setProgress(0, 'Retrying...');
        loadGame();
      }, { once: true });
    }
  }
}

// Start loading immediately
loadGame();
