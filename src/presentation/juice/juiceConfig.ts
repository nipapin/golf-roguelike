/**
 * Every juice timing/intensity lives here. Feedback hierarchy:
 * routine (card play) < big (strong chain hit) < finisher (killing blow / huge chain).
 */
export const JUICE = {
  tiers: {
    /** Chain-resolve damage that counts as a "big" hit. */
    bigDamage: 12,
    bigChain: 4,
    /** Finisher: killing blow, or a hit this large / this long a chain / this share of max HP. */
    finisherDamage: 30,
    finisherChain: 6,
    finisherHpShare: 0.4,
  },
  hitStop: {
    minMs: 60,
    maxMs: 90,
    perDamageMs: 1.1,
    finisherMs: 120,
    deathMs: 140,
    /** Time scale during hit-stop (0 = full freeze). */
    scale: 0.02,
  },
  slowMo: {
    scale: 0.28,
    ms: 420,
  },
  shake: {
    /** Camera shake intensity is a fraction of the viewport (Phaser semantics). */
    routine: { ms: 70, intensity: 0.0022 },
    hitBase: 0.004,
    perDamage: 0.00018,
    perChainLink: 0.0007,
    max: 0.02,
    hitMs: 150,
    bigMs: 210,
    finisherMs: 320,
    playerBase: 0.005,
    playerPerDamage: 0.0006,
    playerMs: 200,
    /** Multiplier when "Reduce screen shake" is on. */
    reducedFactor: 0.2,
  },
  enemy: {
    flashMs: 70,
    knockbackPx: 8,
    knockbackPerDamage: 0.35,
    knockbackMax: 24,
    squash: 0.14,
    knockbackMs: 80,
    recoverMs: 260,
    routineFlinchPx: 4,
    lowHpShare: 0.3,
    enragedTint: 0xff8a8a,
  },
  sparks: {
    base: 8,
    perDamage: 0.6,
    max: 40,
    speedMin: 140,
    speedMax: 420,
    lifespan: 520,
    finisherExtra: 26,
  },
  numbers: {
    poolSize: 16,
    routineSize: 18,
    baseSize: 34,
    perDamage: 0.75,
    perChainLink: 1.5,
    maxSize: 76,
    popScale: 1.4,
    popMs: 110,
    riseMs: 720,
    risePx: 64,
    arcPx: 26,
    /** Colour by damage (first matching from the top). */
    colors: [
      { min: 45, color: '#ff4dd8' },
      { min: 25, color: '#ff4a3d' },
      { min: 12, color: '#ffa53a' },
      { min: 0, color: '#fff1a8' },
    ],
    critColor: '#c58aff',
    healColor: '#5dffa8',
    playerHitColor: '#ff5a6e',
  },
  hpBar: {
    ghostDelayMs: 300,
    ghostDrainMs: 420,
    ghostColor: 0xfff3d0,
    shakePx: 6,
    shakeMs: 45,
  },
  chain: {
    counterPopScale: 1.22,
    counterPopMs: 120,
    /** Pitch already rises in AudioSystem; tint of the banner per combo tier in tokens.comboTiers. */
  },
  cards: {
    liftPx: 24,
    liftMs: 85,
    liftScale: 1.16,
    flightMs: 250,
    flightArcPx: 60,
    rotateDeg: 12,
    landSquash: 0.18,
    landMs: 150,
    trailFrequency: 16,
    trailLifespan: 260,
    dustCount: 8,
    glowPulseMs: 760,
    glowAlphaMin: 0.35,
    invalidShakePx: 6,
  },
  player: {
    vignetteMs: 420,
    vignetteAlpha: 0.85,
  },
  death: {
    coinCount: 12,
    coinFlightMs: 620,
    coinStaggerMs: 28,
    fallMs: 700,
  },
  screenFlash: {
    finisherAlpha: 0.32,
    ms: 160,
  },
} as const;

export type HitTier = 'routine' | 'big' | 'finisher';

/** Classify a chain-resolve hit for the feedback hierarchy. */
export function classifyHit(damage: number, chainLength: number, enemyMaxHp: number, killing: boolean): HitTier {
  const t = JUICE.tiers;
  if (killing || damage >= t.finisherDamage || chainLength >= t.finisherChain || (enemyMaxHp > 0 && damage >= enemyMaxHp * t.finisherHpShare)) return 'finisher';
  if (damage >= t.bigDamage || chainLength >= t.bigChain) return 'big';
  return 'routine';
}

export function hitStopMs(damage: number, tier: HitTier): number {
  const h = JUICE.hitStop;
  if (tier === 'finisher') return h.finisherMs;
  return Math.round(Math.min(h.maxMs, Math.max(h.minMs, h.minMs + damage * h.perDamageMs)));
}

export function shakeIntensity(damage: number, chainLength: number): number {
  const s = JUICE.shake;
  return Math.min(s.max, s.hitBase + damage * s.perDamage + Math.max(0, chainLength - 1) * s.perChainLink);
}

export function damageColor(damage: number): string {
  for (const entry of JUICE.numbers.colors) if (damage >= entry.min) return entry.color;
  return JUICE.numbers.colors[JUICE.numbers.colors.length - 1].color;
}

export function damageFontSize(damage: number, chainLength: number): number {
  const n = JUICE.numbers;
  return Math.round(Math.min(n.maxSize, n.baseSize + damage * n.perDamage + Math.max(0, chainLength - 1) * n.perChainLink));
}
