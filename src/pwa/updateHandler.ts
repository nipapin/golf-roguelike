/**
 * PWA Update Handler
 * Shows in-app update prompt for iOS PWA users who can't easily reload
 */

import { registerSW } from 'virtual:pwa-register';
import { saveGame, loadGame } from '../services/SaveService';
import { getGameManager } from '../presentation/GameManager';

let updateCheckInProgress = false;
let toastElement: HTMLDivElement | null = null;
let offlineToastElement: HTMLDivElement | null = null;

export function initPWAUpdateHandler(): void {
  const updateSW = registerSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      // Check for updates every 60 seconds
      setInterval(() => {
        checkForUpdate(registration);
      }, 60 * 1000);

      // Check for updates when app becomes visible (iOS PWAs rarely check on their own)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdate(registration);
        }
      });
    },

    onNeedRefresh() {
      showUpdateToast(() => {
        // Save current game state before reload
        const manager = getGameManager();
        const state = manager.getState();
        if (state) {
          saveGame(state);
        }
        // Trigger skipWaiting + reload
        updateSW(true);
      });
    },

    onOfflineReady() {
      showOfflineReadyToast();
    },
  });
}

function checkForUpdate(registration: ServiceWorkerRegistration): void {
  if (updateCheckInProgress) return;
  if (!navigator.onLine) return;

  updateCheckInProgress = true;
  registration.update()
    .catch(() => {
      // Silently ignore update check errors (offline, network issues)
    })
    .finally(() => {
      updateCheckInProgress = false;
    });
}

function showUpdateToast(onUpdate: () => void): void {
  if (toastElement) return; // Already showing

  toastElement = document.createElement('div');
  toastElement.id = 'pwa-update-toast';
  toastElement.innerHTML = `
    <div class="pwa-toast-content">
      <span class="pwa-toast-text">Есть обновление</span>
      <button class="pwa-toast-btn">Обновить</button>
    </div>
  `;

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    #pwa-update-toast {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 10000;
      padding: 12px;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      pointer-events: none;
    }
    .pwa-toast-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      max-width: 360px;
      margin: 0 auto;
      padding: 12px 16px;
      background: linear-gradient(180deg, #FFFDF6 0%, #FFF6E2 55%, #F3E4C4 100%);
      border-radius: 14px;
      box-shadow: 
        0 0 0 3px #1B1030,
        0 6px 0 3px #1B1030,
        0 8px 20px rgba(27, 16, 48, 0.4);
      pointer-events: auto;
    }
    .pwa-toast-text {
      font-family: 'Lilita One', 'Fredoka', system-ui, sans-serif;
      font-size: 18px;
      color: #1B1030;
    }
    .pwa-toast-btn {
      flex-shrink: 0;
      min-width: 100px;
      min-height: 44px;
      padding: 0 20px;
      font-family: 'Lilita One', 'Fredoka', system-ui, sans-serif;
      font-size: 16px;
      color: #fff;
      background: linear-gradient(180deg, #FFE55C 0%, #FFC21A 50%, #E08600 100%);
      border: none;
      border-radius: 12px;
      box-shadow: 
        0 0 0 3px #1B1030,
        inset 0 2px 0 rgba(255,255,255,0.4),
        inset 0 -4px 0 #C06800;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      -webkit-text-stroke: 2px #1B1030;
      paint-order: stroke fill;
    }
    .pwa-toast-btn:active {
      transform: translateY(2px);
      box-shadow: 
        0 0 0 3px #1B1030,
        inset 0 2px 0 rgba(0,0,0,0.1),
        inset 0 -2px 0 #C06800;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(toastElement);

  const button = toastElement.querySelector('.pwa-toast-btn');
  button?.addEventListener('click', onUpdate);
}

function showOfflineReadyToast(): void {
  if (offlineToastElement) return;

  offlineToastElement = document.createElement('div');
  offlineToastElement.id = 'pwa-offline-toast';
  offlineToastElement.innerHTML = `
    <div class="pwa-offline-content">Готово к офлайн-игре</div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #pwa-offline-toast {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      padding: 12px;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      pointer-events: none;
      animation: pwa-fade-out 0.3s ease-out 2s forwards;
    }
    .pwa-offline-content {
      max-width: 200px;
      margin: 0 auto;
      padding: 10px 16px;
      background: rgba(27, 16, 48, 0.9);
      border-radius: 10px;
      font-family: 'Fredoka', system-ui, sans-serif;
      font-size: 14px;
      color: #fff;
      text-align: center;
    }
    @keyframes pwa-fade-out {
      to { opacity: 0; visibility: hidden; }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(offlineToastElement);

  // Remove after animation
  setTimeout(() => {
    offlineToastElement?.remove();
    offlineToastElement = null;
  }, 2500);
}
