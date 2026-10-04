import { fonts } from './tokens';

/** Keep localized display text in the shipped game fonts. Lilita has no Cyrillic glyphs. */
export function gameDisplayStyle(text: string) {
  return /[\u0400-\u04ff]/.test(text)
    ? { fontFamily: `${fonts.display}, ${fonts.fallback}`, fontStyle: '900' }
    : { fontFamily: fonts.display, fontStyle: 'normal' };
}
