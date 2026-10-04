import { describe, expect, it } from 'vitest';
import { isDesktopViewport, viewportUiScale } from './desktopLayout';
import { getCardMetrics, getCastleLayoutMetrics } from './tokens';

describe('siege card and resource layout', () => {
  it.each([
    [320, 568, 0, 0], [375, 667, 0, 0], [390, 844, 44, 34], [480, 884, 0, 0],
    [900, 540, 0, 0], [1024, 768, 0, 0], [1280, 720, 20, 24],
    [1920, 1080, 0, 0], [2560, 1080, 0, 0], [3840, 2160, 0, 0],
  ])('fits five rows and the card control tray at %d x %d (insets %d/%d)', (cssWidth, cssHeight, top, bottom) => {
    const scale = viewportUiScale(cssWidth, cssHeight);
    const width = cssWidth / scale, height = cssHeight / scale;
    const insets = { top: top / scale, bottom: bottom / scale };
    const layout = getCastleLayoutMetrics(width, height, insets);
    expect(layout.hudTop).toBeGreaterThanOrEqual(insets.top);
    expect(layout.arenaHeight).toBeGreaterThan(100);
    expect(layout.arenaTop + layout.arenaHeight).toBeLessThan(layout.tableTop);
    expect(layout.stockPileScale).toBe(1);
    expect(layout.stockPileY).toBe(layout.activeY);
    expect(layout.stockPileX + layout.cw + 8).toBeLessThan(layout.activeX);
    expect(layout.activeX + layout.cw).toBeLessThan(width - 8);
    // Include the active card's eight-pixel glow in the separation.
    expect(layout.barsY + 36 + 16).toBeLessThanOrEqual(layout.activeY - 8);
    expect(layout.activeY + layout.ch + 4).toBeLessThanOrEqual(layout.comboY - 12);
    expect(layout.comboY + 13).toBeLessThanOrEqual(layout.rewardY - 12);
    expect(layout.rewardY + 20).toBeLessThanOrEqual(layout.jokerY - 20);
    expect(layout.jokerY + 20).toBeLessThanOrEqual(height - layout.safeBottom);
    expect(layout.undoWidth).toBeGreaterThanOrEqual(36);
    expect(layout.undoX - layout.undoWidth / 2).toBeGreaterThanOrEqual(layout.stockPileX + layout.cw + 8);
    expect(layout.undoX + layout.undoWidth / 2 + 3).toBeLessThan(layout.activeX - 8);
    expect(layout.tableauTop + layout.tableauHeight + 8).toBeLessThanOrEqual(
      layout.desktop ? height - layout.safeBottom : layout.barsY);
    if (layout.desktop) {
      expect(layout.barsY - layout.controlsTop).toBe(16);
      expect(layout.controlsTop + layout.controlsHeight).toBe(height - layout.safeBottom);
      expect(layout.boardX + layout.boardWidth).toBeLessThan(layout.controlsX);
      expect(layout.boardX).toBeCloseTo(width - layout.controlsX - layout.controlsWidth);
    }
    const card = getCardMetrics(width, height, insets);
    expect(card.cw).toBe(layout.cw);
    expect(card.ch).toBe(layout.ch);
    expect(card.ch / card.cw).toBeCloseTo(1.65);
    const fourRows = getCastleLayoutMetrics(width, height, insets, 4);
    expect(fourRows.cw).toBe(layout.cw);
    expect(fourRows.tableauHeight).toBeCloseTo(layout.ch + layout.strip * 3);
    expect(fourRows.activeY).toBe(layout.activeY);
  });
  it('scales Full HD and 4K proportionally', () => {
    expect(viewportUiScale(1280, 720)).toBe(1);
    expect(viewportUiScale(1920, 1080)).toBe(1.5);
    expect(viewportUiScale(3840, 2160)).toBe(3);
  });
  it.each([[375, 667], [390, 844], [430, 932], [480, 720], [899, 720], [1080, 1920]])(
    'retains portrait/compact behavior at %d x %d', (width, height) => {
      expect(isDesktopViewport(width, height)).toBe(false);
      expect(viewportUiScale(width, height)).toBe(1);
    });
});
