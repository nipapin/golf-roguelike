import type { Plugin } from 'vite';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { validateConfig } from '../src/configurator/config';
import { SOUND_CATALOG, MUSIC_URL, MUSIC_CATALOG } from '../src/configurator/sounds';

const types: Record<string, string> = {
  '.mp3': 'audio', '.ogg': 'audio', '.wav': 'audio', '.m4a': 'audio',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image', '.svg': 'image', '.gif': 'image',
  '.ttf': 'font', '.woff': 'font', '.woff2': 'font', '.otf': 'font', '.json': 'data',
};
const names: Record<string, string> = {
  castle: 'Замок', soldier: 'Солдат', archer: 'Лучник', orc: 'Орк', goblin: 'Гоблин', reaper: 'Жнец',
  'ogre-boss': 'Босс: огр', 'reaper-boss': 'Босс: жнец', turret: 'Башня', mortar: 'Мортира', laser: 'Лазер',
  heal: 'Лечение', guard: 'Защита', crit: 'Критический удар', gold: 'Золото', bomb: 'Бомба', wild: 'Дикая карта',
  echo: 'Эхо', crown: 'Корона', arrow: 'Стрела', shell: 'Снаряд', forest: 'Лес', hills: 'Холмы',
  battlefield: 'Поле боя', coin: 'Монета',
};
const revision = (value: string) => createHash('sha256').update(value).digest('hex');

async function body(request: IncomingMessage, limit: number): Promise<Buffer> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('Файл слишком большой. Максимум 30 МБ');
    parts.push(Buffer.from(chunk));
  }
  return Buffer.concat(parts);
}

export function configuratorPlugin(): Plugin {
  return {
    name: 'local-asset-configurator',
    configureServer(server) {
      const root = path.resolve(server.config.root, 'public');
      const configPath = path.join(root, 'game-assets.json');
      const token = randomUUID();
      let queue = Promise.resolve();

      async function catalog() {
        const entries: { id: string; url: string; label: string; kind: string; group: string; active: boolean; bytes: number }[] = [];
        async function scan(directory: string) {
          for (const item of await fs.readdir(directory, { withFileTypes: true })) {
            if (item.isSymbolicLink() || item.name === 'custom' || item.name === 'game-assets.json') continue;
            const file = path.join(directory, item.name);
            if (item.isDirectory()) await scan(file);
            else {
              const extension = path.extname(item.name).toLowerCase();
              if (!types[extension]) continue;
              const url = '/' + path.relative(root, file).replaceAll('\\', '/');
              const stem = path.basename(item.name, extension);
              const active = url.startsWith('/assets/cardboard-runtime/') || url.startsWith('/assets/vfx/')
                || url.startsWith('/audio/') || url.startsWith('/fonts/') || url.startsWith('/icons/')
                || ['/icon.svg', '/apple-touch-icon.png', '/assets/coin.svg', '/assets/enemies/crown.svg'].includes(url);
              const group = url.startsWith('/assets/cardboard-runtime/') || ['/assets/coin.svg', '/assets/enemies/crown.svg'].includes(url) ? 'Графика игры'
                : url.startsWith('/assets/vfx/') ? 'Эффекты и атласы'
                : url.startsWith('/audio/') ? 'Звуковые файлы'
                : url.startsWith('/fonts/') ? 'Шрифты'
                : url.includes('/icons/') || url === '/icon.svg' || url === '/apple-touch-icon.png' ? 'Иконки'
                : 'Архив и исходники';
              entries.push({ id: url, url, label: names[stem] ?? stem, kind: types[extension], group, active, bytes: (await fs.stat(file)).size });
            }
          }
        }
        await scan(root);
        const priority = ['Графика игры', 'Эффекты и атласы', 'Иконки', 'Шрифты', 'Звуковые файлы', 'Архив и исходники'];
        entries.sort((a, b) => priority.indexOf(a.group) - priority.indexOf(b.group) || a.label.localeCompare(b.label, 'ru') || a.url.localeCompare(b.url));
        const source = await fs.readFile(configPath, 'utf8');
        const themeSource = await fs.readFile(path.resolve(root, '../src/presentation/design/tokens.ts'), 'utf8');
        const palette = themeSource.split('export const colors = {')[1].split('} as const')[0];
        const colors = Object.fromEntries([...palette.matchAll(/(\w+): 0x([0-9a-f]{6})/g)].map((match) => [match[1], '#' + match[2]]));
        return { entries, sounds: SOUND_CATALOG, music: MUSIC_URL, musicTracks: MUSIC_CATALOG, colors, config: validateConfig(JSON.parse(source)), revision: revision(source), token };
      }

      server.middlewares.use('/__configurator', (request, response) => {
        const execute = async () => {
          const json = (status: number, data: unknown) => {
            response.statusCode = status;
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.setHeader('Cache-Control', 'no-store');
            response.end(JSON.stringify(data));
          };
          try {
            const url = new URL(request.url ?? '/', 'http://localhost');
            if (request.method === 'GET' && url.pathname === '/catalog') return json(200, await catalog());
            if (request.headers['x-configurator-token'] !== token || request.headers['sec-fetch-site'] === 'cross-site')
              return json(403, { error: 'Откройте конфигуратор на этом ПК' });

            if (request.method === 'POST' && url.pathname === '/upload') {
              const target = url.searchParams.get('target');
              const filename = url.searchParams.get('name') ?? '';
              const extension = path.extname(filename).toLowerCase();
              const current = await catalog();
              const event = Object.hasOwn(MUSIC_CATALOG, target ?? '') ? { kind: 'audio', url: MUSIC_CATALOG[target as keyof typeof MUSIC_CATALOG].url }
                : Object.hasOwn(SOUND_CATALOG, target ?? '') ? { kind: 'audio', url: SOUND_CATALOG[target as keyof typeof SOUND_CATALOG].url }
                : current.entries.find((entry) => entry.id === target);
              if (!event || !types[extension] || types[extension] !== event.kind)
                throw new Error('Выберите файл того же типа, что и исходный ассет');
              if ((path.extname(event.url) === '.svg' || event.kind === 'data') && extension !== path.extname(event.url))
                throw new Error('Для SVG и JSON нужен файл в исходном формате');
              const bytes = await body(request, 30 * 1024 * 1024);
              if (!bytes.length) throw new Error('Файл пустой');
              if (extension === '.json') {
                const data = JSON.parse(bytes.toString('utf8'));
                if (event.url.includes('/atlases/') || event.url.includes('/vfx/')) {
                  if (!data.frames || typeof data.frames !== 'object') throw new Error('Атлас должен содержать frames');
                }
              }
              if (extension === '.svg' && !/<svg[\s>]/i.test(bytes.toString('utf8'))) throw new Error('Неверный SVG');
              const file = randomUUID() + extension;
              const directory = path.join(root, 'assets/custom');
              await fs.mkdir(directory, { recursive: true });
              await fs.writeFile(path.join(directory, file), bytes, { flag: 'wx' });
              return json(200, { url: '/assets/custom/' + file });
            }

            if (request.method === 'POST' && url.pathname === '/save') {
              const input = JSON.parse((await body(request, 1024 * 1024)).toString('utf8'));
              const current = await catalog();
              if (input.revision !== current.revision) return json(409, { error: 'Конфиг изменён в другом окне. Обновите страницу перед сохранением.' });
              const config = validateConfig(input.config);
              for (const key of Object.keys(config.assets)) {
                if (!current.entries.some((entry) => entry.id === key)) throw new Error('Неизвестный ассет: ' + key);
              }
              for (const key of Object.keys(config.sounds)) {
                if (!Object.hasOwn(MUSIC_CATALOG, key) && !Object.hasOwn(SOUND_CATALOG, key)) throw new Error('Неизвестное звуковое событие');
              }
              for (const key of Object.keys(config.colors)) {
                if (!Object.hasOwn(current.colors, key)) throw new Error('Неизвестный цвет');
              }
              for (const [original, url] of Object.entries(config.assets)) {
                const kind = current.entries.find((entry) => entry.id === original)!.kind;
                if (types[path.extname(url)] !== kind || (path.extname(original) === '.svg' && path.extname(url) !== '.svg'))
                  throw new Error('Несовместимый тип замены: ' + original);
              }
              for (const url of [...Object.values(config.assets), ...Object.values(config.sounds).flatMap((sound) => sound.url ? [sound.url] : [])]) {
                const absolute = path.resolve(root, '.' + url);
                const real = await fs.realpath(absolute);
                if (!real.startsWith(root + path.sep) || !(await fs.stat(real)).isFile()) throw new Error('Файл замены отсутствует: ' + url);
              }
              const backup = path.resolve(root, '../.local/asset-config-backups');
              await fs.mkdir(backup, { recursive: true });
              await fs.copyFile(configPath, path.join(backup, Date.now() + '-' + randomUUID() + '.json'));
              const source = JSON.stringify(config, null, 2) + '\n';
              const temporary = configPath + '.tmp';
              await fs.writeFile(temporary, source, 'utf8');
              await fs.rename(temporary, configPath);
              return json(200, { revision: revision(source) });
            }
            json(404, { error: 'Команда не найдена' });
          } catch (error) {
            json(400, { error: error instanceof Error ? error.message : 'Ошибка конфигуратора' });
          }
        };
        queue = queue.then(execute, execute);
      });
    },
  };
}
