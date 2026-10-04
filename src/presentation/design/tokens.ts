import { configuredColors } from '../../configurator/runtime';
import { getSafeInsets, type SafeInsets } from './viewport';
import { desktopCastleGeometry, isDesktopViewport } from './desktopLayout';

/**
 * Design tokens from visual/STYLE.md
 * "Яркий мультяшный премиум в духе Supercell"
 */

export const colors = {
  // Ink & neutrals
  ink: 0x19313c,
  ink2: 0x31535e,
  white: 0xffffff,

  // Card face
  faceHi: 0xfffdf6,
  face: 0xfff6e2,
  faceLo: 0xf3e4c4,
  bevel: 0xd9bf8e,
  faceDim: 0xcfc3b4,

  // Suits = effects
  spade: 0x2c2160,
  spadeFx: 0xff5a36,
  heart: 0xf2324e,
  heartFx: 0xff4d6a,
  club: 0x1683f0,
  clubFx: 0x3fb0ff,
  diamond: 0xf29a00,
  diamondTxt: 0xe67e00,
  diamondFx: 0xffc629,

  // UI accents
  gold: 0xffcc1f,
  goldLo: 0xe88a00,
  goldHi: 0xfff08a,
  goldRing: 0xffe35a,
  blue: 0x3aa0ff,
  blueLo: 0x1c5fd1,
  red: 0xff3b4e,
  redLo: 0xb8163a,
  green: 0x3ed66b,
  greenLo: 0x1a9444,
  violet: 0x7b4dff,

  // Table
  felt: 0x315c63,
  feltHi: 0x44747c,
  feltLo: 0x213e48,
  rim: 0x8c4a22,
  rimHi: 0xd2803c,

  // Combo tiers
  tier1: 0xffe45c,
  tier2: 0xff9a1f,
  tier3: 0xff3d2e,
  tier4: 0xd23bff,

  // HP bar
  hpTrackHi: 0x3a0e26,
  hpTrackLo: 0x57163a,
  hpFillHi: 0xff8a97,
  hpFill: 0xff3b4e,
  hpFillLo: 0xd61f3c,
  hpPreviewHi: 0xfff3b0,
  hpPreviewLo: 0xffd24a,
  playerHp: 0xff3d7f,

  // Card back
  backHi: 0x5288ba,
  backLo: 0x29536f,
  backGold: 0xffd34a,

  // Arena (goblin camp sunset)
  skyTop: 0x3f2ab8,
  skyMid: 0x8c3fd0,
  skyPink: 0xf0508e,
  skyOrange: 0xff8a5c,
  skyBottom: 0xffc27a,
  sunGlow: 0xfff1b8,
  mountainHi: 0xb067e0,
  mountainLo: 0xe77ab0,
  mountainOutline: 0x7a3398,
  groundHi: 0xffc983,
  groundMid: 0xf3a763,
  groundLo: 0xd9824a,
  groundOutline: 0xa4552c,
  arenaDisk: 0xe89456,
} as const;

export const powerColors = {
  crit: { pw1: 0xff3a1a, pw2: 0xff9a00, pw3: 0xfff07a },
  heal: { pw1: 0x12b76a, pw2: 0x3df5a0, pw3: 0xe0fff0 },
  guard: { pw1: 0x1d5bff, pw2: 0x45c8ff, pw3: 0xe6faff },
  gold: { pw1: 0xd98a00, pw2: 0xffd23f, pw3: 0xfffbd0 },
  bomb: { pw1: 0x1b1030, pw2: 0xff3b30, pw3: 0xff9f6b },
  wild: { pw1: 0xff3db8, pw2: 0x39d9ff, pw3: 0xfff15c },
  echo: { pw1: 0x8a2bff, pw2: 0xe05cff, pw3: 0xffd6ff },
} as const;

export const fonts = {
  display: 'Lilita One',
  ui: 'Fredoka',
  fallback: 'Rubik',
} as const;

/**
 * Calculate card dimensions based on screen width
 */
export function getCardMetrics(screenWidth: number, screenHeight?: number, insets: SafeInsets = getSafeInsets()) {
  const desktop = screenHeight !== undefined && isDesktopViewport(screenWidth, screenHeight)
    ? desktopCastleGeometry(screenWidth, screenHeight, insets) : null;
  const side = desktop?.boardX ?? 8;
  const gap = desktop?.gap ?? 4;
  const cw = desktop?.cw ?? Math.min((screenWidth - 2 * side - 6 * gap) / 7, 56);
  const ch = cw * 1.65;
  const strip = cw * 0.58;
  const r = cw * 0.16;

  return {
    side,
    gap,
    cw,
    ch,
    strip,
    radius: r,
    outline: 2.5,
    bevelHeight: cw * 0.07,
    rankSize: cw * 0.47,
    rankSize10: cw * 0.43,
    pipSize: cw * 0.3,
    bigSuitSize: cw * 0.7,
    glyphSize: cw * 0.7 * 0.44,
  };
}

/**
 * Get layout metrics for different screen sizes
 * Based on STYLE.md section 9 exact measurements:
 * - 390×844: HUD 44, Arena 336, Banner 56, Tableau 200, Tray 133
 * - 375×667: HUD 40, Arena 260, Banner 50, Tableau 188, Tray 109
 * - 430×932: HUD 44, Arena 391, Banner 56, Tableau 221, Tray 145
 */
export function getLayoutMetrics(
  width: number,
  height: number,
  insets: SafeInsets = getSafeInsets()
) {
  const metrics = getCardMetrics(width);
  // The canvas covers the full screen; backgrounds paint from y=0 to height,
  // interactive UI starts below the notch and ends above the home indicator.
  const insetTop = insets.top;
  const insetBottom = insets.bottom;
  const safeTop = 8 + insetTop;
  const safeBottom = 8 + insetBottom;
  const hudHeight = 40;
  const playerHudHeight = 30;
  const relicHeight = 28;
  const bannerHeight = 34;
  const strip = metrics.cw * 0.48;
  const tableauHeight = 4 * strip + metrics.ch;
  const activeScale = 1.08;
  const activeW = metrics.cw * activeScale;
  const activeH = metrics.ch * activeScale;
  const trayHeight = activeH + 28;
  const hudTop = safeTop;
  const playerHudTop = hudTop + hudHeight;
  const relicTop = playerHudTop + playerHudHeight;
  const arenaTop = relicTop + relicHeight + 4;
  const trayTop = height - safeBottom - trayHeight;
  const tableauTop = trayTop - 12 - tableauHeight;
  const tableTop = tableauTop - 8;
  const bannerTop = tableTop - bannerHeight - 6;
  const arenaHeight = Math.max(60, bannerTop - arenaTop - 6);
  return {
    ...metrics,
    strip,
    insetTop,
    insetBottom,
    safeTop,
    safeBottom,
    hudHeight,
    hudTop,
    playerHudTop,
    playerHudHeight,
    relicTop,
    relicHeight,
    arenaTop,
    arenaHeight,
    bannerTop,
    bannerHeight,
    tableTop,
    tableHeight: height - safeBottom - tableTop,
    tableauTop,
    tableauHeight,
    trayTop,
    trayHeight,
    enemyHeight: Math.max(40, Math.min(arenaHeight - 66, 185)),
    activeScale,
    activeW,
    activeH,
    isCompact: height <= 760,
  };
}

export const comboTiers = [
  { min: 2, max: 3, color: colors.tier1, label: 'NICE' },
  { min: 4, max: 5, color: colors.tier2, label: 'GREAT!' },
  { min: 6, max: 7, color: colors.tier3, label: 'BRUTAL!!' },
  { min: 8, max: 999, color: colors.tier4, label: 'MONSTER CHAIN' },
] as const;

export function getComboTier(chainLength: number) {
  for (const tier of comboTiers) {
    if (chainLength >= tier.min && chainLength <= tier.max) {
      return tier;
    }
  }
  return comboTiers[0];
}

export const suitColors = {
  spades: { suit: colors.spade, fx: colors.spadeFx },
  hearts: { suit: colors.heart, fx: colors.heartFx },
  clubs: { suit: colors.club, fx: colors.clubFx },
  diamonds: { suit: colors.diamond, fx: colors.diamondFx },
} as const;

export type Suit = keyof typeof suitColors;

/** Compact siege arena; reclaim excess sky for readable, less overlapped cards. */
export function getCastleLayoutMetrics(width: number, height: number, insets?: SafeInsets, tableauRows = 5) {
  if (isDesktopViewport(width, height)) {
    const desktop = desktopCastleGeometry(width, height, insets ?? getSafeInsets(), tableauRows);
    return { ...getLayoutMetrics(width, height, insets), ...getCardMetrics(width, height, insets), ...desktop };
  }
  const base = getLayoutMetrics(width, height, insets);
  const { cw, ch, strip } = base;
  const trayHeight = ch + 172, trayTop = height - base.safeBottom - trayHeight;
  const tableauHeight = ch + strip * (tableauRows - 1);
  const tableauTop = trayTop - 12 - tableauHeight;
  const tableTop = tableauTop - 8, arenaTop = base.safeTop + 42;
  const span = Math.min(280, width - 32), activeY = trayTop + 60;
  const comboY = activeY + ch + 18, rewardY = comboY + 29;
  return {
    ...base, desktop: false, arenaTop, arenaHeight: Math.max(40, tableTop - arenaTop - 6),
    tableauTop, tableauHeight, tableTop, tableHeight: height - tableTop,
    trayTop, trayHeight, bannerTop: tableTop, bannerHeight: 0,
    boardX: base.side, boardWidth: width - 16,
    bannerX: 8, bannerWidth: width - 16,
    controlsX: 0, controlsWidth: width, controlsTop: trayTop, controlsHeight: trayHeight,
    rewardX: (width - Math.min(240, width - 32)) / 2,
    rewardY, rewardWidth: Math.min(240, width - 32), jokerY: rewardY + 40,
    activeX: width / 2 + span * .31 - cw / 2, activeY,
    stockPileX: width / 2 - span * .31 - cw / 2,
    stockPileY: activeY, stockPileScale: 1,
    barsX: width / 2 - span / 2 + 24, barsY: trayTop, barsWidth: span - 32,
    comboX: (width - span) / 2, comboValueX: (width + span) / 2, comboY,
    undoX: width / 2, undoY: activeY + ch / 2,
    undoWidth: 36, undoHeight: 36,
    activeScale: 1, activeW: cw, activeH: ch,
  };
}

/** Cards and UI are drawn in code. Their palette is editable alongside file assets. */
export function applyConfiguredColors(): void {
  for (const [key, value] of Object.entries(configuredColors())) {
    if (Object.hasOwn(colors, key)) Object.assign(colors, { [key]: parseInt(value.slice(1), 16) });
  }
  for (const [index, tier] of comboTiers.entries()) Object.assign(tier, { color: colors[`tier${index + 1}` as 'tier1'] });
  Object.assign(suitColors.spades, { suit: colors.spade, fx: colors.spadeFx });
  Object.assign(suitColors.hearts, { suit: colors.heart, fx: colors.heartFx });
  Object.assign(suitColors.clubs, { suit: colors.club, fx: colors.clubFx });
  Object.assign(suitColors.diamonds, { suit: colors.diamond, fx: colors.diamondFx });
}
