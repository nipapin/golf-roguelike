import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'http://127.0.0.1:5173';
async function ready() {
  try {
    const response = await fetch(base + '/__configurator/catalog', { signal: AbortSignal.timeout(1000) });
    const data = await response.json();
    return response.ok && typeof data.token === 'string' && data.config?.version === 1;
  } catch { return false; }
}
if (!(await ready())) {
  const vite = path.join(root, 'node_modules/vite/bin/vite.js');
  if (!existsSync(vite)) {
    console.error('Зависимости не установлены. Выполните npm ci в папке проекта.'); process.exit(1);
  }
  mkdirSync(path.join(root, '.local'), { recursive: true });
  const logPath = path.join(root, '.local/configurator-server.log');
  const log = openSync(logPath, 'a');
  const child = spawn(process.execPath, [vite, '--host', '127.0.0.1'], {
    cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log, log],
  });
  child.unref(); closeSync(log);
  let started = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await ready()) { started = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!started) {
    console.error('Сервер не запустился. Проверьте порт 5173 и журнал: ' + logPath); process.exit(1);
  }
}
const url = base + (process.argv.includes('--game') ? '/' : '/configurator.html');
if (process.platform === 'win32') {
  const browser = spawn('powershell.exe', ['-NoProfile', '-Command', `Start-Process '${url}'`], { windowsHide: true, stdio: 'ignore' });
  browser.unref();
} else {
  console.log(url);
}
console.log('Castle Studio: ' + url);
