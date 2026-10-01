import type Phaser from 'phaser';

/** Highest canvas density we render at. DPR 3 phones look identical at 2 and save ~45% fill-rate. */
export const MAX_RENDER_DENSITY = 2;

// Phaser 3 uses physical canvas pixels. Keep scene geometry in CSS pixels,
// then let the camera render it at the display's density.
let renderDensity = 1;
export function setRenderDensity(value: number): void {
  renderDensity = Math.max(1, Math.min(MAX_RENDER_DENSITY, Number.isFinite(value) ? value : 1));
}
export function getRenderDensity(): number { return renderDensity; }
export function viewport(scene: Pick<Phaser.Scene, 'scale'>) {
  return { width: scene.scale.width / renderDensity, height: scene.scale.height / renderDensity };
}
export function configureViewport(scene: Phaser.Scene): void {
  const size = viewport(scene);
  scene.cameras.main.setOrigin(.5, .5).setZoom(renderDensity).centerOn(size.width / 2, size.height / 2);
}

export interface SafeInsets { top: number; bottom: number }

let insetOverride: SafeInsets | null = null;
/** Tests can pin insets; pass null to read the live CSS values again. */
export function setSafeInsetsOverride(value: SafeInsets | null): void { insetOverride = value; }

/**
 * Safe-area insets in CSS px, read from the --sat/--sab custom properties
 * (env(safe-area-inset-*) in style.css). A probe element resolves var()/env()
 * to real pixels, and lets QA override the vars with plain CSS.
 */
export function getSafeInsets(): SafeInsets {
  if (insetOverride) return insetOverride;
  if (typeof document === 'undefined' || !document.body || typeof getComputedStyle !== 'function') return { top: 0, bottom: 0 };
  let probe = document.getElementById('safe-area-probe');
  if (!probe) {
    probe = document.createElement('div');
    probe.id = 'safe-area-probe';
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:var(--sat,0px);padding-bottom:var(--sab,0px);';
    document.body.appendChild(probe);
  }
  const style = getComputedStyle(probe);
  const read = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : 0; };
  return { top: read(style.paddingTop), bottom: read(style.paddingBottom) };
}

/** Vertical band where interactive UI and text may live (CSS px). */
export function safeArea(scene: Pick<Phaser.Scene, 'scale'>, margin = 8) {
  const { height } = viewport(scene);
  const insets = getSafeInsets();
  const top = insets.top + margin;
  const bottom = height - insets.bottom - margin;
  return { top, bottom, height: Math.max(0, bottom - top), centerY: (top + bottom) / 2, insets };
}

/**
 * For menu-style scenes laid out in a plain 0..height column: shifts the camera
 * so world y=0 sits just below the notch and world y=height ends above the home
 * indicator. Full-bleed backgrounds should be drawn from -insets.top to height + insets.bottom.
 */
export function configureSafeViewport(scene: Phaser.Scene) {
  configureViewport(scene);
  const size = viewport(scene);
  const insets = getSafeInsets();
  scene.cameras.main.centerOn(size.width / 2, size.height / 2 - insets.top);
  return { width: size.width, height: Math.max(0, size.height - insets.top - insets.bottom), fullHeight: size.height, insets };
}
