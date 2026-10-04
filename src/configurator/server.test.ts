import { it, expect } from 'vitest';
import { createServer } from 'vite';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { configuratorPlugin } from '../../tools/configurator-plugin';
import { emptyConfig } from './config';

it('persists local replacements, preserves originals, rejects stale/unsafe writes and creates backups', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'castle-configurator-test-'));
  const publicRoot = path.join(directory, 'public');
  await fs.mkdir(path.join(publicRoot, 'assets/cardboard-runtime'), { recursive: true });
  await fs.mkdir(path.join(directory, 'src/presentation/design'), { recursive: true });
  await fs.writeFile(path.join(publicRoot, 'assets/cardboard-runtime/castle.webp'), 'original');
  await fs.writeFile(path.join(publicRoot, 'game-assets.json'), JSON.stringify(emptyConfig()));
  await fs.writeFile(path.join(directory, 'src/presentation/design/tokens.ts'), 'export const colors = { face: 0xffffff } as const');
  const server = await createServer({ root: directory, configFile: false, plugins: [configuratorPlugin()],
    server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
  try {
    await server.listen();
    const address = server.httpServer!.address();
    if (!address || typeof address === 'string') throw new Error('Missing server address');
    const base = `http://127.0.0.1:${address.port}/__configurator/`;
    const catalog = await (await fetch(base + 'catalog')).json();
    expect(catalog.entries.some((entry: { id: string }) => entry.id === '/assets/cardboard-runtime/castle.webp')).toBe(true);
    expect(catalog.musicTracks.music_battle.url).toBe('/audio/user-sfx-v1/game.mp3');
    const unauthorized = await fetch(base + 'save', { method: 'POST', body: '{}' });
    expect(unauthorized.status).toBe(403);
    const post = (route: string, body: string) => fetch(base + route, { method: 'POST',
      headers: { 'X-Configurator-Token': catalog.token }, body });
    const wrongType = await post('upload?target=archer_shot&name=file.png', 'invalid');
    expect(wrongType.status).toBe(400);
    const upload = await post('upload?target=archer_shot&name=arrow.wav', 'RIFF-test');
    expect(upload.status).toBe(200);
    const { url } = await upload.json();
    const config = emptyConfig(); config.sounds.archer_shot = { url, volume: 0.5 };
    const battleUpload = await post('upload?target=music_battle&name=battle.mp3', 'ID3-test');
    expect(battleUpload.status).toBe(200);
    config.sounds.music_battle = { url: (await battleUpload.json()).url, volume: 0.75 };
    const saved = await post('save', JSON.stringify({ config, revision: catalog.revision }));
    expect(saved.status).toBe(200);
    expect(JSON.parse(await fs.readFile(path.join(publicRoot, 'game-assets.json'), 'utf8'))).toEqual(config);
    expect(await fs.readFile(path.join(publicRoot, 'assets/cardboard-runtime/castle.webp'), 'utf8')).toBe('original');
    expect((await fs.readdir(path.join(directory, '.local/asset-config-backups'))).length).toBe(1);
    const stale = await post('save', JSON.stringify({ config: emptyConfig(), revision: catalog.revision }));
    expect(stale.status).toBe(409);
    const { revision } = await saved.json();
    const invalid = emptyConfig(); invalid.sounds.archer_shot = { url: '/assets/../secret.wav' };
    expect((await post('save', JSON.stringify({ config: invalid, revision }))).status).toBe(400);
    invalid.sounds.archer_shot = { url: '/assets/custom/nonexistent.wav' };
    expect((await post('save', JSON.stringify({ config: invalid, revision }))).status).toBe(400);
    expect((await post('save', JSON.stringify({ config: emptyConfig(), revision }))).status).toBe(200);
    expect(await fs.readFile(path.join(publicRoot, '.' + url), 'utf8')).toBe('RIFF-test');
  } finally {
    await server.close();
    const actual = await fs.realpath(directory);
    if (actual.toLowerCase().startsWith((await fs.realpath(os.tmpdir())).toLowerCase() + path.sep) && path.basename(actual).startsWith('castle-configurator-test-'))
      await fs.rm(actual, { recursive: true, force: true });
  }
}, 20000);
