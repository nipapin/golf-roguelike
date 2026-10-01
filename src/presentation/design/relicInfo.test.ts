import { expect, it } from 'vitest';
import { relicIcon } from './relicInfo';
import relics from '../../data/relics.json';
import type { Relic } from '../../core/types';

it('shows the boosted rank on rank relics (ACE STRIKE → A, LUCKY SEVEN → 7)', () => {
  const all = relics.relics as Relic[];
  expect(relicIcon(all.find((r) => r.name === 'ACE STRIKE')!)).toBe('A');
  expect(relicIcon(all.find((r) => r.name === 'LUCKY SEVEN')!)).toBe('7');
});
