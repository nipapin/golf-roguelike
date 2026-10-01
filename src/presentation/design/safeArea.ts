export interface ScreenMetrics { innerWidth: number; innerHeight: number; screenWidth: number; screenHeight: number; visualHeight?: number; iosStandalone: boolean }
/** iOS can retain Safari's smaller innerHeight after installation. */
export function viewportHeight(metrics: ScreenMetrics): number {
  if (!metrics.iosStandalone) return metrics.visualHeight ?? metrics.innerHeight;
  const screenHeight = metrics.innerHeight >= metrics.innerWidth
    ? Math.max(metrics.screenHeight, metrics.screenWidth)
    : Math.min(metrics.screenHeight, metrics.screenWidth);
  return Math.max(metrics.innerHeight, screenHeight);
}
