import './style.css';
import { validateConfig, emptyConfig, type AssetConfig } from './config';
import { paletteLabels } from './palette';

interface Entry {
  id: string; url: string; label: string; kind: string; group: string; active: boolean; bytes: number;
}
interface Catalog {
  entries: Entry[]; sounds: Record<string, { url: string; label: string }>; music: string;
  musicTracks: Record<string, { url: string; label: string }>;
  colors: Record<string, string>; config: AssetConfig; revision: string; token: string;
}
const root = document.querySelector<HTMLDivElement>('#studio')!;
let catalog: Catalog;
let config: AssetConfig;
let selected = '';
let section = 'sounds';
let query = '';
let changedOnly = false;
let dirty = false;
let busy = false;
let previewAudio: HTMLAudioElement | null = null;
let gameVisible = false;
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const bytes = (value: number) => value > 1024 * 1024 ? (value / 1024 / 1024).toFixed(1) + ' МБ' : Math.round(value / 1024) + ' КБ';
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;

function soundEntries(): Entry[] {
  return [...Object.entries(catalog.sounds).map(([id, sound]) => ({ id, ...sound, kind: 'audio', group: 'Звуковые события', active: true, bytes: 0 })),
    ...Object.entries(catalog.musicTracks).map(([id, track]) => ({ id, ...track, kind: 'audio', group: 'Музыка', active: true, bytes: 0 }))];
}
function entries(): Entry[] {
  if (section === 'sounds') return soundEntries();
  if (section === 'colors') return Object.entries(catalog.colors).map(([id, url]) => ({ id, url, label: paletteLabels[id] ?? id, kind: 'color', group: 'Палитра', active: true, bytes: 0 }));
  return catalog.entries.filter((entry) => section === 'all' ||
    (section === 'images' && entry.kind === 'image' && entry.active) ||
    (section === 'fonts' && entry.kind === 'font') ||
    (section === 'atlases' && entry.kind === 'data') ||
    (section === 'archive' && !entry.active));
}
function isEvent(entry: Entry) { return section === 'sounds' && entry.kind === 'audio'; }
function isChanged(entry: Entry) {
  return entry.kind === 'color' ? !!config.colors[entry.id] : isEvent(entry) ? !!config.sounds[entry.id] : !!config.assets[entry.id];
}
function currentUrl(entry: Entry) {
  return entry.kind === 'color' ? config.colors[entry.id] ?? entry.url
    : isEvent(entry) ? config.sounds[entry.id]?.url ?? config.assets[entry.url] ?? entry.url
    : config.assets[entry.id] ?? entry.url;
}
function markDirty() {
  dirty = true;
  $('#save-state').textContent = 'Есть несохранённые изменения';
  $('#save-state').classList.add('dirty');
  $('#save').removeAttribute('disabled');
  renderList();
}
function toast(message: string, error = false) {
  $('#toast').textContent = message;
  $('#toast').className = 'toast show' + (error ? ' error' : '');
  window.setTimeout(() => $('#toast').classList.remove('show'), 5000);
}
async function api(route: string, data?: BodyInit): Promise<Record<string, string>> {
  const response = await fetch('/__configurator/' + route, {
    method: 'POST', headers: { 'X-Configurator-Token': catalog.token }, body: data,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Не удалось выполнить действие');
  return result;
}
function stopAudio() { previewAudio?.pause(); previewAudio = null; }

function renderList() {
  const matching = entries().filter((entry) => `${entry.label} ${entry.id} ${entry.group}`.toLowerCase().includes(query.toLowerCase()) && (!changedOnly || isChanged(entry)));
  $('#count').textContent = `${matching.length} элементов`;
  $('#list').innerHTML = matching.map((entry) => {
    const thumb = entry.kind === 'image' ? `<img loading="lazy" src="${escape(currentUrl(entry))}" alt="" />`
      : entry.kind === 'color' ? `<span class="swatch" style="background:${escape(currentUrl(entry))}"></span>`
      : `<span class="asset-symbol">${entry.kind === 'audio' ? '♫' : entry.kind === 'font' ? 'Aa' : '{}'}</span>`;
    return `<button class="asset-row ${selected === entry.id ? 'selected' : ''}" data-id="${escape(entry.id)}">
      <span class="thumb">${thumb}</span><span class="row-text"><strong>${escape(entry.label)}</strong><small>${escape(entry.group)}${entry.bytes ? ' · ' + bytes(entry.bytes) : ''}</small></span>
      ${isChanged(entry) ? '<span class="changed-dot" title="Изменено"></span>' : '<span class="row-arrow">↗</span>'}</button>`;
  }).join('') || '<div class="empty">Ничего не найдено.<br />Попробуйте другой запрос.</div>';
  for (const button of root.querySelectorAll<HTMLButtonElement>('.asset-row')) button.onclick = () => {
    if (busy) return;
    selected = button.dataset.id!;
    stopAudio(); renderList(); renderInspector();
  };
}

function renderInspector() {
  const entry = entries().find((item) => item.id === selected);
  if (!entry) { $('#inspector').innerHTML = '<div class="empty">Выберите ассет слева</div>'; return; }
  const event = isEvent(entry);
  const url = currentUrl(entry);
  const custom = config.sounds[entry.id] ?? {};
  let preview = '';
  if (entry.kind === 'image') preview = `<div class="image-stage"><img src="${escape(url)}" alt="${escape(entry.label)}" id="preview-image" /></div><div id="dimensions" class="preview-caption">Прозрачность показана на шахматном фоне</div>`;
  if (entry.kind === 'audio') preview = `<div class="audio-stage"><span class="audio-rings">♫</span><strong>${entry.id.startsWith('music') ? 'Фоновая музыка' : 'Прослушать звук'}</strong><p>Предпросмотр файла с выбранной громкостью</p><audio id="audio" controls preload="metadata" src="${escape(url)}"></audio></div>`;
  if (entry.kind === 'font') preview = '<div class="font-stage" id="font-preview">Castle Solitaire<br /><span>Карты, замок и приключения</span><br /><small>АБВГДЕ · AaBbCc · 0123456789</small></div>';
  if (entry.kind === 'data') preview = '<pre id="json-preview" class="json-preview">Загрузка JSON…</pre>';
  if (entry.kind === 'color') preview = `<div class="color-stage" style="background:${escape(url)}"><div class="sample-card">A<span>♥</span></div></div>`;
  const accept = entry.kind === 'audio' ? '.mp3,.ogg,.wav,.m4a' : entry.kind === 'font' ? '.ttf,.woff,.woff2,.otf'
    : entry.kind === 'data' ? '.json' : entry.url.endsWith('.svg') ? '.svg' : '.png,.webp,.jpg,.jpeg,.gif';
  $('#inspector').innerHTML = `<div class="inspector-heading"><div><span class="eyebrow">${escape(entry.group)}</span><h2>${escape(entry.label)}</h2></div><span class="badge ${isChanged(entry) ? 'custom' : ''}">${isChanged(entry) ? 'Изменён' : 'Оригинал'}</span></div>
    ${preview}
    <div class="detail-body">
      ${entry.kind === 'color' ? `<label class="color-control">Цвет элемента <input id="color" type="color" value="${escape(url)}" /><code id="hex">${escape(url)}</code></label><p class="hint">Карты и часть интерфейса рисуются программно. Палитра меняет их цвета.</p>` : `
      <div class="file-meta"><span>Идентификатор</span><code>${escape(entry.id)}</code><span>Текущий файл</span><code>${escape(url)}</code></div>
      ${!entry.active ? '<p class="notice">Архивный ассет. В текущем режиме игры он не используется. Рабочие изображения находятся в разделе «Графика игры».</p>' : ''}
      ${entry.url.includes('/vfx/') || entry.url.includes('/atlases/') ? '<p class="notice">Атлас: изображение и JSON должны иметь совместимые размеры, координаты и имена кадров. При смене раскладки замените оба файла.</p>' : ''}
      ${event ? `<label class="field-label">Файл из библиотеки<select id="library"><option value="">Исходный файл</option>${catalog.entries.filter((item) => item.kind === 'audio').map((item) => `<option value="${escape(item.url)}" ${custom.url === item.url ? 'selected' : ''}>${escape(item.url.split('/').slice(-2).join('/'))}</option>`).join('')}${custom.url?.startsWith('/assets/custom/') ? `<option selected value="${escape(custom.url)}">Загруженный файл</option>` : ''}</select></label>
      <label class="slider-label">Громкость события <output id="volume-value">${Math.round((custom.volume ?? 1) * 100)}%</output><input id="volume" type="range" min="0" max="2" step="0.01" value="${custom.volume ?? 1}" /></label>
      ${!entry.id.startsWith('music') ? `<label class="slider-label">Высота / скорость <output id="rate-value">${(custom.rate ?? 1).toFixed(2)}×</output><input id="rate" type="range" min="0.25" max="2" step="0.01" value="${custom.rate ?? 1}" /></label><p class="hint">Изменение скорости также меняет высоту звука.</p>` : ''}
      <label class="check"><input type="checkbox" id="muted" ${custom.muted ? 'checked' : ''} /> Отключить это событие в игре</label>` : ''}
      <label class="dropzone" id="dropzone"><span class="upload-icon">↑</span><strong>Выбрать новый файл</strong><span>или перетащить сюда · до 30 МБ</span><small>${escape(accept.replaceAll('.', '').toUpperCase())}</small><input type="file" id="file" accept="${accept}" /></label>
      <div class="original-link"><a href="${escape(entry.url)}" target="_blank" rel="noopener">Открыть оригинал ↗</a><span>Оригинал сохранён</span></div>`}
      <button class="secondary reset" id="reset-one" ${isChanged(entry) ? '' : 'disabled'}>Восстановить этот элемент</button>
    </div>`;
  $('#reset-one').onclick = () => {
    if (busy) return;
    if (entry.kind === 'color') delete config.colors[entry.id];
    else if (event) delete config.sounds[entry.id];
    else delete config.assets[entry.id];
    stopAudio(); markDirty(); renderInspector();
  };
  if (entry.kind === 'color') {
    $<HTMLInputElement>('#color').oninput = (e) => {
      const color = (e.target as HTMLInputElement).value;
      config.colors[entry.id] = color;
      $('#hex').textContent = color;
      $('.color-stage').style.background = color;
      markDirty(); $('#reset-one').removeAttribute('disabled');
    };
    return;
  }
  if (entry.kind === 'image') {
    const image = $<HTMLImageElement>('#preview-image');
    image.onload = () => { $('#dimensions').textContent = `${image.naturalWidth} × ${image.naturalHeight} px · прозрачность на шахматном фоне`; };
    image.onerror = () => { $('#dimensions').textContent = 'Изображение не удалось прочитать. Выберите другой файл.'; };
  }
  if (entry.kind === 'audio') {
    previewAudio = $<HTMLAudioElement>('#audio');
    updateAudio();
  }
  if (entry.kind === 'font') {
    void new FontFace('StudioPreview', `url(${url})`).load().then((font) => {
      document.fonts.add(font);
      const panel = root.querySelector<HTMLElement>('#font-preview');
      if (panel && selected === entry.id) panel.style.fontFamily = 'StudioPreview';
    }).catch(() => toast('Шрифт не удалось загрузить', true));
  }
  if (entry.kind === 'data') void fetch(url).then((r) => r.json()).then((data) => {
    if (selected === entry.id) $('#json-preview').textContent = JSON.stringify(data, null, 2);
  }).catch(() => { if (selected === entry.id) $('#json-preview').textContent = 'JSON не удалось прочитать'; });
  if (event) {
    $<HTMLSelectElement>('#library').onchange = (e) => {
      const value = (e.target as HTMLSelectElement).value;
      const sound = config.sounds[entry.id] ??= {};
      if (value) sound.url = value; else delete sound.url;
      stopAudio(); markDirty(); renderInspector();
    };
    for (const key of ['volume', 'rate'] as const) {
      const input = root.querySelector<HTMLInputElement>('#' + key);
      if (input) input.oninput = () => {
        (config.sounds[entry.id] ??= {})[key] = Number(input.value);
        $('#' + key + '-value').textContent = key === 'volume' ? Math.round(Number(input.value) * 100) + '%' : Number(input.value).toFixed(2) + '×';
        updateAudio(); markDirty(); $('#reset-one').removeAttribute('disabled');
      };
    }
    $<HTMLInputElement>('#muted').onchange = (e) => {
      (config.sounds[entry.id] ??= {}).muted = (e.target as HTMLInputElement).checked;
      markDirty(); $('#reset-one').removeAttribute('disabled');
    };
  }
  $<HTMLInputElement>('#file').onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) void upload(entry, file);
  };
  const drop = $('#dropzone');
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('dragging'); };
  drop.ondragleave = () => drop.classList.remove('dragging');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('dragging'); const file = e.dataTransfer?.files[0]; if (file) void upload(entry, file); };
}

function updateAudio() {
  if (!previewAudio) return;
  const sound = config.sounds[selected] ?? {};
  // HTML audio caps volume at 1; preview is scaled to leave headroom for 200%.
  previewAudio.volume = Math.min(1, (sound.volume ?? 1) * 0.5);
  previewAudio.playbackRate = selected.startsWith('music') ? 1 : sound.rate ?? 1;
  previewAudio.preservesPitch = false;
}
async function checkFile(entry: Entry, file: File) {
  if (file.size > 30 * 1024 * 1024) throw new Error('Файл больше 30 МБ');
  const url = URL.createObjectURL(file);
  try {
    if (entry.kind === 'image') await new Promise<void>((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(); image.onerror = () => reject(new Error('Изображение повреждено или формат не поддерживается')); image.src = url;
    });
    if (entry.kind === 'audio') await new Promise<void>((resolve, reject) => {
      const audio = new Audio(); audio.preload = 'metadata'; audio.onloadedmetadata = () => { audio.removeAttribute('src'); audio.load(); resolve(); };
      audio.onerror = () => { audio.removeAttribute('src'); reject(new Error('Аудиофайл не воспроизводится в этом браузере')); }; audio.src = url;
    });
    if (entry.kind === 'font') await new FontFace('CheckUpload', `url(${url})`).load();
    if (entry.kind === 'data') JSON.parse(await file.text());
  } finally { URL.revokeObjectURL(url); }
}
async function upload(entry: Entry, file: File) {
  if (busy) return;
  busy = true;
  $('#inspector').classList.add('busy');
  try {
    toast('Проверяю и загружаю ' + file.name + '…');
    await checkFile(entry, file);
    const result = await api('upload?target=' + encodeURIComponent(entry.id) + '&name=' + encodeURIComponent(file.name), file);
    if (isEvent(entry)) (config.sounds[entry.id] ??= {}).url = result.url;
    else config.assets[entry.id] = result.url;
    stopAudio(); markDirty(); renderInspector(); toast('Файл загружен. Нажмите «Сохранить», чтобы применить в игре.');
  } catch (error) { toast((error as Error).message, true); }
  finally { busy = false; $('#inspector').classList.remove('busy'); }
}
async function save(): Promise<boolean> {
  if (busy) return false;
  busy = true; root.classList.add('busy'); $('#save').setAttribute('disabled', '');
  try {
    const result = await api('save', JSON.stringify({ config, revision: catalog.revision }));
    catalog.revision = result.revision;
    dirty = false;
    $('#save-state').textContent = 'Все изменения сохранены'; $('#save-state').classList.remove('dirty');
    toast('Сохранено в проект. Игра при следующем запуске использует новые настройки.');
    if (gameVisible) $<HTMLIFrameElement>('#game-preview').src = '/?studio=' + Date.now();
    return true;
  } catch (error) { toast((error as Error).message, true); return false; }
  finally { busy = false; root.classList.remove('busy'); if (dirty) $('#save').removeAttribute('disabled'); }
}
function render() {
  root.innerHTML = `<aside class="sidebar"><a class="brand" href="/configurator.html"><span class="brand-mark">♜</span><span>Castle <b>Studio</b><small>КОНФИГУРАТОР ИГРЫ</small></span></a>
    <div class="project-pill"><span></span>Golf Roguelike <small>LOCAL</small></div><p class="nav-title">БИБЛИОТЕКА</p><nav id="navigation"></nav>
    <div class="sidebar-footer"><p>Ваша игра. Ваш стиль.</p><small>Заменяйте файлы и слушайте звуки.<br />Оригиналы всегда можно вернуть.</small><div class="preset-actions"><button id="export">Экспорт</button><label>Импорт<input type="file" id="import" accept=".json" /></label></div><button class="reset-all" id="reset-all">Восстановить всё</button></div></aside>
    <main class="workspace"><header class="topbar"><div><span class="eyebrow">CASTLE SOLITAIRE / ASSET STUDIO</span><h1 id="page-title">Звуки и музыка</h1></div><div class="topbar-actions"><span id="save-state">Все изменения сохранены</span><button class="secondary" id="open-game">▷ Проверить в игре</button><button class="primary" id="save" disabled>Сохранить</button></div></header>
    <div class="intro"><span class="intro-icon">✦</span><p><strong>Настройте игру под себя.</strong> Выберите элемент, загрузите замену и сохраните изменения. Звук можно назначить отдельно для каждого события.</p></div>
    <div class="editor"><section class="library"><div class="library-tools"><label class="search"><span>⌕</span><input id="search" type="search" placeholder="Поиск по имени или пути…" aria-label="Поиск ассетов" /></label><div class="list-options"><span id="count"></span><label><input id="changed-only" type="checkbox" /> Только изменённые</label></div></div><div id="list" class="asset-list"></div></section><section id="inspector" class="inspector"></section></div>
    <footer class="workspace-footer"><span>● Локальное сохранение · public/game-assets.json</span><span>После сохранения игра перезапускается с новыми ассетами</span></footer></main>
    <div id="toast" class="toast" role="status" aria-live="polite"></div>
    <dialog id="game-dialog"><div class="dialog-bar"><strong>Проверка в игре</strong><span>Сохранённые настройки</span><div class="preview-modes" role="group" aria-label="Размер экрана игры"><button id="preview-desktop" aria-pressed="false">ПК</button><button id="preview-phone" aria-pressed="false">Телефон</button></div><button id="close-game" aria-label="Закрыть игру">✕</button></div><div class="game-shell"><iframe id="game-preview" title="Castle Solitaire" allow="autoplay"></iframe></div></dialog>`;
  const sections = [
    ['sounds', '♫', 'Звуки и музыка'], ['images', '▧', 'Графика игры'], ['atlases', '✧', 'Атласы и данные'],
    ['fonts', 'Aa', 'Шрифты'], ['colors', '◉', 'Цвета интерфейса'], ['all', '▦', 'Все файлы'], ['archive', '▣', 'Архив и исходники'],
  ];
  function navigate(id: string) {
    if (busy) return;
    stopAudio(); section = id; selected = entries()[0]?.id ?? ''; query = ''; changedOnly = false;
    $<HTMLInputElement>('#search').value = ''; $<HTMLInputElement>('#changed-only').checked = false;
    $('#page-title').textContent = sections.find((item) => item[0] === id)![2];
    $('#navigation').innerHTML = sections.map(([key, icon, label]) => `<button data-section="${key}" class="nav-item ${key === id ? 'active' : ''}"><span>${icon}</span>${label}${key === 'sounds' ? '<small>' + soundEntries().length + '</small>' : ''}</button>`).join('');
    for (const button of root.querySelectorAll<HTMLButtonElement>('.nav-item')) button.onclick = () => navigate(button.dataset.section!);
    renderList(); renderInspector();
  }
  navigate(section);
  $<HTMLInputElement>('#search').oninput = (e) => { query = (e.target as HTMLInputElement).value; renderList(); };
  $<HTMLInputElement>('#changed-only').onchange = (e) => { changedOnly = (e.target as HTMLInputElement).checked; renderList(); };
  $('#save').onclick = () => { void save(); };
  const previewMode = (desktop: boolean) => {
    $('#game-dialog').classList.toggle('desktop-preview', desktop);
    $('#preview-desktop').setAttribute('aria-pressed', String(desktop));
    $('#preview-phone').setAttribute('aria-pressed', String(!desktop));
  };
  previewMode(window.innerWidth >= 1000);
  $('#preview-desktop').onclick = () => previewMode(true);
  $('#preview-phone').onclick = () => previewMode(false);
  $('#open-game').onclick = async () => {
    if (busy || (dirty && !(await save()))) return;
    stopAudio(); gameVisible = true;
    $<HTMLIFrameElement>('#game-preview').src = '/?studio=' + Date.now();
    $<HTMLDialogElement>('#game-dialog').showModal();
  };
  const closeGame = () => { gameVisible = false; $<HTMLIFrameElement>('#game-preview').src = 'about:blank'; };
  $('#close-game').onclick = () => { $<HTMLDialogElement>('#game-dialog').close(); closeGame(); };
  $<HTMLDialogElement>('#game-dialog').onclose = closeGame;
  $('#export').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'castle-assets-preset.json'; a.click(); URL.revokeObjectURL(url);
    toast('Пресет экспортирован. Файлы замен хранятся в папке проекта public/assets/custom.');
  };
  $<HTMLInputElement>('#import').onchange = async (e) => {
    if (busy) return;
    const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
    try { config = structuredClone(validateConfig(JSON.parse(await file.text()))); stopAudio(); markDirty(); renderInspector(); toast('Пресет импортирован. Сохраните, чтобы применить.'); }
    catch (error) { toast((error as Error).message, true); }
    (e.target as HTMLInputElement).value = '';
  };
  $('#reset-all').onclick = () => { if (busy) return; config = emptyConfig(); stopAudio(); markDirty(); renderInspector(); toast('Выбраны исходные настройки. Нажмите «Сохранить», чтобы применить.'); };
  window.addEventListener('beforeunload', (e) => { if (dirty || busy) { e.preventDefault(); e.returnValue = ''; } });
}

async function init() {
  try {
    const response = await fetch('/__configurator/catalog', { cache: 'no-store' });
    if (!response.ok) throw new Error('Для конфигуратора нужен локальный сервер. Запустите «Запустить конфигуратор.cmd» в папке проекта.');
    catalog = await response.json(); config = structuredClone(catalog.config); render();
  } catch (error) { root.innerHTML = `<div class="boot-error"><h1>Castle Studio</h1><p>${escape((error as Error).message)}</p><button onclick="location.reload()">Повторить</button></div>`; }
}
void init();
