/**
 * Design tokens from visual/STYLE.md
 * "Яркий мультяшный премиум в духе Supercell"
 */

export const colors = {
  // Ink & neutrals
  ink: 0x1b1030,
  ink2: 0x2e1f52,
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
  felt: 0x3a2a96,
  feltHi: 0x5140c0,
  feltLo: 0x22176a,
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
  backHi: 0x8a4dff,
  backLo: 0x4420a8,
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
export function getCardMetrics(screenWidth: number) {
  const side = 8;
  const gap = 4;
  const cw = Math.min((screenWidth - 2 * side - 6 * gap) / 7, 56);
  const ch = cw * 1.4;
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
 */
export function getLayoutMetrics(width: number, height: number) {
  const isCompact = height <= 760;
  const metrics = getCardMetrics(width);

  // Safe areas (approximate for now, real values from env())
  const safeTop = height >= 800 ? 47 : 20;
  const safeBottom = height >= 800 ? 34 : 6;

  const hudHeight = isCompact ? 40 : 44;
  const bannerHeight = isCompact ? 50 : 56;
  const tableauHeight = 4 * metrics.strip + metrics.ch + 14;

  // Active card in tray
  const activeScale = isCompact ? 1.3 : 1.42;
  const activeW = metrics.cw * activeScale;
  const activeH = metrics.ch * activeScale;

  // Tray height (draw pile + active card + player HP)
  const trayHeight = activeH + 40;

  // Table = tableau + tray
  const tableHeight = tableauHeight + trayHeight;

  // Arena fills remaining space
  const arenaTop = safeTop + hudHeight;
  const arenaHeight = height - safeTop - hudHeight - bannerHeight - tableHeight - safeBottom;

  // Enemy sprite
  const maxEnemyHeight = 250;
  const enemyHeight = Math.min(arenaHeight * 0.66, maxEnemyHeight);

  return {
    safeTop,
    safeBottom,
    hudHeight,
    arenaTop,
    arenaHeight,
    bannerTop: arenaTop + arenaHeight,
    bannerHeight,
    tableTop: arenaTop + arenaHeight + bannerHeight,
    tableHeight,
    tableauTop: arenaTop + arenaHeight + bannerHeight + 30,
    tableauHeight,
    trayTop: arenaTop + arenaHeight + bannerHeight + 30 + tableauHeight,
    trayHeight,
    enemyHeight,
    activeScale,
    activeW,
    activeH,
    isCompact,
    ...metrics,
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
