/**
 * Fullscreen API wrapper for mobile and desktop browsers.
 * iOS Safari doesn't support the Fullscreen API, so we detect this and hide the button.
 */

type FullscreenElement = Element & {
  webkitRequestFullscreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
};

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  return !!(
    doc.fullscreenEnabled ||
    (doc as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled ||
    (doc as { msFullscreenEnabled?: boolean }).msFullscreenEnabled
  );
}

export function isFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
}

export async function enterFullscreen(element?: Element): Promise<boolean> {
  if (!isFullscreenSupported()) return false;
  const el = (element ?? document.documentElement) as FullscreenElement;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
      await el.msRequestFullscreen();
    }
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen(): Promise<boolean> {
  if (!isFullscreenSupported()) return false;
  const doc = document as FullscreenDocument;
  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
    }
    return true;
  } catch {
    return false;
  }
}

export async function toggleFullscreen(): Promise<boolean> {
  if (isFullscreen()) {
    return exitFullscreen();
  }
  return enterFullscreen();
}

export function onFullscreenChange(callback: (isFullscreen: boolean) => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const handler = () => callback(isFullscreen());
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  document.addEventListener('MSFullscreenChange', handler);
  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
    document.removeEventListener('MSFullscreenChange', handler);
  };
}
