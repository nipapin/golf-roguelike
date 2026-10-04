import type { SafeInsets } from './viewport';

/** Keep this breakpoint aligned with the #game media query. */
export function isDesktopViewport(width: number, height: number): boolean {
  return width >= 900 && width / height >= 1.2;
}

/** UI units are independent of physical canvas pixels; artwork keeps its aspect ratio. */
export function viewportUiScale(width: number, height: number): number {
  return isDesktopViewport(width, height) ? Math.max(0.5, Math.min(width / 1280, height / 720)) : 1;
}

export function desktopCastleGeometry(width: number, height: number, insets: SafeInsets, tableauRows = 5) {
  const safeTop = insets.top + 16;
  const safeBottom = insets.bottom + 16;
  const margin = 24;
  const controlsWidth = 288;
  const controlsGap = 24;
  const boardRegionWidth = width - margin * 2 - controlsWidth - controlsGap;
  const tableTop = Math.round(height * 0.44);
  const bannerHeight = 0;
  const tableauTop = tableTop + 24;
  const gap = 12;
  const cw = Math.min(94, (boardRegionWidth - gap * 6) / 7,
    (height - safeBottom - tableauTop - 8) / (1.65 + 4 * 0.48));
  const ch = cw * 1.65;
  const strip = cw * 0.48;
  const boardWidth = cw * 7 + gap * 6;
  // Center the board and controls together; extra monitor width stays outside the pair.
  const boardX = (width - boardWidth - controlsGap - controlsWidth) / 2;
  const controlsX = boardX + boardWidth + controlsGap;
  const arenaTop = safeTop + 43;
  const abilityY = height - safeBottom - 29;
  const rewardY = abilityY - 46;
  const comboY = rewardY - 31;
  const activeY = comboY - 23 - ch;
  const stockPileScale = 1;
  const stockPileX = controlsX + 20;
  const activeX = controlsX + controlsWidth - 20 - cw;
  const barsY = activeY - 64;
  const controlsTop = barsY - 16;
  return {
    desktop: true,
    safeTop, safeBottom, hudTop: safeTop, playerHudTop: safeTop + 48,
    relicTop: safeTop + 78, arenaTop, arenaHeight: tableTop - arenaTop - 10,
    tableTop, tableHeight: height - tableTop, tableauTop, strip,
    tableauHeight: ch + strip * (tableauRows - 1), cw, ch, gap, side: boardX,
    boardX, boardWidth, bannerX: boardX, bannerWidth: boardWidth, bannerTop: tableTop + 10, bannerHeight,
    controlsX, controlsWidth, controlsTop, controlsHeight: height - safeBottom - controlsTop,
    rewardX: controlsX + 16, rewardY, rewardWidth: controlsWidth - 32,
    jokerY: abilityY,
    activeX, activeY,
    stockPileX, stockPileY: activeY, stockPileScale,
    barsX: controlsX + 35, barsY, barsWidth: controlsWidth - 51,
    comboX: controlsX + 16, comboValueX: controlsX + controlsWidth - 16, comboY,
    undoX: (stockPileX + cw + activeX) / 2, undoY: activeY + ch / 2, undoWidth: 36, undoHeight: 36,
    trayTop: tableTop + 24, trayHeight: height - safeBottom - tableTop - 24,
    activeScale: 1, activeW: cw, activeH: ch, isCompact: false,
  };
}
