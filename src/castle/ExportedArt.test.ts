import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from './exportedArt.json';
import { attackReleaseDelay, exportedFrame, siegeArtConfig } from './ExportedArt';

describe('supplied AE art delivery', () => {
  it('includes every animation frame exactly once on a page small enough for mobile textures', () => {
    for (const asset of Object.values(manifest.assets)) {
      const atlas = JSON.parse(readFileSync(resolve('public', asset.atlas.slice(1)), 'utf8'));
      const names = new Set<string>();
      for (const page of atlas.textures) {
        expect(page.size.w).toBeLessThanOrEqual(2048);
        expect(page.size.h).toBeLessThanOrEqual(2048);
        for (const frame of page.frames) {
          expect(names.has(frame.filename)).toBe(false);
          names.add(frame.filename);
          expect(frame.frame.x + frame.frame.w).toBeLessThanOrEqual(page.size.w);
          expect(frame.frame.y + frame.frame.h).toBeLessThanOrEqual(page.size.h);
          expect(frame.sourceSize).toEqual({ w: asset.frameWidth, h: asset.frameHeight });
        }
      }
      for (const animation of Object.values(asset.animations)) {
        expect(animation.end).toBeLessThan(asset.frameCount);
        for (let frame = animation.start; frame <= animation.end; frame++)
          expect(names.has(exportedFrame(frame))).toBe(true);
      }
    }
  });

  it('places soldiers inside the gate, and mounts behind only their front parapets', () => {
    const d = siegeArtConfig.castle.depths;
    expect(d.gate).toBeLessThan(d.facade);
    expect(d.facade).toBeLessThan(d.gateSoldiers);
    expect(d.gateSoldiers).toBeLessThan(d.gateCover);
    expect(d.gateCover).toBeLessThan(d.mounts);
    expect(d.mounts).toBeLessThan(d.cover);
    expect(d.cover).toBeLessThan(d.fieldSoldiers);
  });

  it('uses only supplied cannon frames and plays reveal once', () => {
    expect(manifest.assets.cannon.animations.idle).toMatchObject({ start:39, end:39 });
    expect(manifest.assets.turret.animations.reveal.repeat).toBe(0);
    expect(attackReleaseDelay('archer')).toBeCloseTo(11000 / 30);
    expect(attackReleaseDelay('cannon')).toBeCloseTo(8000 / 30);
  });
});
