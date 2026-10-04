import { expect, it } from 'vitest';
import { enemyGroundPlacement } from './battlefieldGeometry';

it.each([60, 150, 240, 360])('keeps all lanes on the earth and gives a twofold perspective at arena height %i', height => {
  const lanes = Array.from({ length: 6 }, (_, id) => enemyGroundPlacement(id, 80, height));
  for (const lane of lanes) {
    expect(lane.y).toBeGreaterThanOrEqual(Math.min(80 + height - 14, 80 + height * .78));
    expect(lane.y).toBeLessThanOrEqual(80 + height - 14);
  }
  expect(lanes[0].scale / lanes[5].scale).toBe(2);
  expect(lanes[0].depth).toBeGreaterThan(lanes[5].depth);
});
