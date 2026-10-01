export interface ScreenMetrics { innerWidth: number; innerHeight: number; screenWidth: number; screenHeight: number; visualHeight?: number; iosStandalone: boolean }
/** iOS can retain Safari's smaller innerHeight after installation. */
export function viewportHeight(metrics: ScreenMetrics): number {
  if (!metrics.iosStandalone) return metrics.visualHeight ?? metrics.innerHeight;
  const screenHeight = metrics.innerHeight >= metrics.innerWidth
    ? Math.max(metrics.screenHeight, metrics.screenWidth)
    : Math.min(metrics.screenHeight, metrics.screenWidth);
  return Math.max(metrics.innerHeight, screenHeight);
}
export function readSafeArea(): { top: number; bottom: number } {
  if (typeof document === 'undefined') return { top: 0, bottom: 0 };
  const probe = document.getElementById('safe-area-probe');
  if (!probe) return { top: 0, bottom: 0 };
  const style = getComputedStyle(probe);
  return { top: parseFloat(style.paddingTop) || 0, bottom: parseFloat(style.paddingBottom) || 0 };
}
