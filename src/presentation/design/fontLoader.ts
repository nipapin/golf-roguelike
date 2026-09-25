/**
 * Font loader - loads custom fonts before Phaser starts
 * Per STYLE.md section 13: use FontFace API, wait for load before scene start
 */

const FONTS = [
  { family: 'Lilita One', url: '/fonts/LilitaOne-Regular.ttf' },
  { family: 'Fredoka', url: '/fonts/Fredoka-Variable.ttf', weight: '300 700' },
  { family: 'Rubik', url: '/fonts/Rubik-Variable.ttf', weight: '300 900' },
];

let fontsLoaded = false;

export async function loadFonts(): Promise<void> {
  if (fontsLoaded) return;

  const loadPromises = FONTS.map(async (font) => {
    const descriptors: FontFaceDescriptors = {};
    if (font.weight) {
      descriptors.weight = font.weight;
    }

    const fontFace = new FontFace(font.family, `url(${font.url})`, descriptors);

    try {
      const loadedFont = await fontFace.load();
      document.fonts.add(loadedFont);
      console.log(`Font loaded: ${font.family}`);
    } catch (error) {
      console.error(`Failed to load font ${font.family}:`, error);
    }
  });

  await Promise.all(loadPromises);
  await document.fonts.ready;
  fontsLoaded = true;
  console.log('All fonts loaded');
}

export function areFontsLoaded(): boolean {
  return fontsLoaded;
}
