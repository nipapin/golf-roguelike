import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.CARD_EXPORT_URL ?? 'http://127.0.0.1:5187';
const output = resolve(process.argv[2] ?? '../game-assets/mobile-readable-deck');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (error) => console.error(error));
  await page.route(`${baseUrl}/__card-export`, (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><body style="margin:0"><div id="export-canvas"></div><script type="module" src="/tools/card-sheet-export.ts"></script></body></html>',
  }));
  await page.goto(`${baseUrl}/__card-export`);
  await page.waitForFunction(() => Boolean(window.cardSheetExport), { timeout: 30000 });
  const { files, manifest } = await page.evaluate(() => window.cardSheetExport.run());
  await mkdir(output, { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    await writeFile(resolve(output, name), Buffer.from(data.split(',')[1], 'base64'));
  }
  for (const [suit, entries] of Object.entries(manifest.frames)) {
    const atlas = { frames: Object.fromEntries(entries.map(({ name, frame }) => [name, {
      frame, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: manifest.cellWidth, h: manifest.cellHeight },
      sourceSize: { w: manifest.cellWidth, h: manifest.cellHeight },
    }])), meta: { image: `${suit}.png`, format: 'RGBA8888',
      size: { w: manifest.cellWidth * 4, h: manifest.cellHeight * 4 }, scale: '1' } };
    await writeFile(resolve(output, `${suit}.json`), JSON.stringify(atlas, null, 2) + '\n');
  }
  await writeFile(resolve(output, 'atlas.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ output, files: Object.keys(files), cardCount: manifest.cardCount,
    cellWidth: manifest.cellWidth, cellHeight: manifest.cellHeight,
    headerChecks: manifest.headerChecks.length }));
} finally {
  await browser.close();
}
