import type Phaser from 'phaser';
import ru from './ru.json';

export type Language = 'ru' | 'en';
const KEY = 'golf-rogue-language';
function browserStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
export function readLanguage(storage = browserStorage()): Language {
  try {
    return storage?.getItem(KEY) === 'en' ? 'en' : 'ru';
  } catch {
    return 'ru';
  }
}
let language = readLanguage();
export const getLanguage = (): Language => language;
export function setLanguage(next: Language, storage = browserStorage()): void {
  language = next;
  try {
    storage?.setItem(KEY, next);
  } catch {
    /* The session still switches in private mode. */
  }
}
const dictionary: Record<string, string> = ru;
const patterns: [RegExp, (...matches: string[]) => string][] = [
  [/^CASTLE (\d+) \/ (\d+)$/, (_, hp, max) => `ЗАМОК ${hp} / ${max}`],
  [/^ARMOR (\d+)$/, (_, n) => `БРОНЯ ${n}`],
  [/^ENEMIES (\d+)$/, (_, n) => `ВРАГИ ${n}`],
  [/^LEVEL (\d+) \/ (\d+)$/, (_, n, max) => `УРОВЕНЬ ${n} / ${max}`],
  [/^UPGRADED! · LEVEL (\d+) \/ (\d+)$/, (_, n, max) => `УЛУЧШЕНО! · УРОВЕНЬ ${n} / ${max}`],
  [/^BUY UPGRADE · (\d+) COINS$/, (_, n) => `УЛУЧШИТЬ · ${n} ЗОЛОТА`],
  [/^NEED (\d+) MORE COINS$/, (_, n) => `НУЖНО ЕЩЁ ${n} ЗОЛОТА`],
  [/^SIEGE #(\d+)$/, (_, n) => `ОСАДА №${n}`],
  [/^NEXT SIEGE #(\d+) · ENEMY HP \+(\d+)%$/, (_, n, hp) => `ДАЛЕЕ №${n} · HP ВРАГОВ +${hp}%`],
  [
    /^BEST RUN · SIEGE #(\d+) · (\d+) KILLS$/,
    (_, n, kills) => `РЕКОРД · ОСАДА №${n} · УБИЙСТВ: ${kills}`,
  ],
  [/^CHAIN (\d+) · DRAW TO DEPLOY$/, (_, n) => `КОМБО ${n} · ДОБОР ДЛЯ ПРИЗЫВА`],
  [/^(\d+) stock · (\d+) cards left$/, (_, stock, cards) => `Запас: ${stock} · На поле: ${cards}`],
  [/^(\d+) TROOPS DEPLOYED$/, (_, n) => `БОЙЦОВ ПРИЗВАНО: ${n}`],
  [/^NO MOVES · −(\d+) HP · NEW DEAL$/, (_, n) => `НЕТ ХОДОВ · −${n} HP · НОВЫЙ РАСКЛАД`],
  [/^(\d+) ENEMIES DEFEATED$/, (_, n) => `ВРАГОВ УБИТО: ${n}`],
  [
    /^\+(\d+) COINS (BANKED|TO SAVE)$/,
    (_, n, status) => `+${n} ЗОЛОТА ${status === 'BANKED' ? 'СОХРАНЕНО' : 'К СОХРАНЕНИЮ'}`,
  ],
  [
    /^(\d+) GOLD (REMAINING|· REPAIR NOT SAVED)$/,
    (_, n, status) => `${n} ЗОЛОТА ${status === 'REMAINING' ? 'ОСТАЛОСЬ' : '· НЕ СОХРАНЕНО'}`,
  ],
  [
    /^SIEGE #(\d+) · (\d+)s · (\d+) invaders$/,
    (_, n, seconds, enemies) => `ОСАДА №${n} · ${seconds}с · ВРАГОВ: ${enemies}`,
  ],
  [/^(\d+)\/(\d+) · (.+)$/, (_, n, total, title) => `${n}/${total} · ${translate(title, 'ru')}`],
  [/^RUN BONUS \+(\d+)$/, (_, n) => `БОНУС ЗАБЕГА +${n}`],
  [/^CRIT BANKED · NEXT DEPLOY ×(\d+)$/, (_, n) => `КРИТ ГОТОВ · ПРИЗЫВ ×${n}`],
  [/^BOMB · (\d+) DAMAGE$/, (_, n) => `БОМБА · УРОН ${n}`],
  [/^LEVEL (\d+)\/(\d+)$/, (_, n, max) => `УРОВЕНЬ ${n}/${max}`],
  [/^UPGRADE · (\d+) COINS$/, (_, n) => `УЛУЧШИТЬ · ${n} ЗОЛОТА`],
  [
    /^(\d+) soldiers march from the castle\..+$/,
    (_, n) => `${n} бойцов идут от замка. У каждого 1 HP и 1 урон. Улучшения увеличивают отряд.`,
  ],
  [
    /^A stationary archer has 1 HP and deals (\d+) damage per arrow\..+$/,
    (_, n) =>
      `Лучник стоит у замка: 1 HP, ${n} урона стрелой. Враги могут его убить. Улучшения повышают урон.`,
  ],
  [
    /^One turret only\..+magazine to (\d+) rounds\..+$/,
    (_, n) =>
      `Одна турель. Первый призыв строит её, следующие заряжают ${n} патронов. 4 выстрела в секунду, 2 базового урона. Улучшение: +5 патронов.`,
  ],
  [
    /^An arc cannon \(mortar\) fires 12 explosive shells for (\d+) base damage.+$/,
    (_, n) => `Пушка стреляет 12 снарядами: ${n} урона по трём целям. Улучшения повышают урон.`,
  ],
  [
    /^The laser deals (\d+) base damage to every enemy\..+$/,
    (_, n) =>
      `Лазер наносит ${n} урона каждому врагу. Сильные могут выжить. Каждые 3 звена сверх 5 дают ещё один луч.`,
  ],
];
export function translate(text: string, locale: Language = getLanguage()): string {
  if (locale === 'en' || !text) return text;
  if (dictionary[text] !== undefined) return dictionary[text];
  for (const [pattern, render] of patterns) {
    const match = text.match(pattern);
    if (match) return render(...match);
  }
  if (text.includes('\n'))
    return text
      .split('\n')
      .map((line) => translate(line, locale))
      .join('\n');
  return text;
}

/** Keep the existing geometry: translate creation and later HUD updates, fit labels in their English width. */
const installed = new WeakSet<object>();
export function installSceneLocalization(scene: Phaser.Scene): void {
  const factory = scene.add;
  if (!factory?.text || installed.has(factory)) return;
  installed.add(factory);
  const create = factory.text;
  factory.text = (x, y, source, style) => {
    const text = create.call(factory, x, y, source, style);
    const setText = text.setText.bind(text);
    const baseSize = parseFloat(String(text.style.fontSize));
    const baseFamily = text.style.fontFamily;
    const baseStyle = text.style.fontStyle;
    let previousSource: string | undefined;
    let previousLanguage: Language | undefined;
    text.setText = (value) => {
      const english = Array.isArray(value) ? value.join('\n') : String(value);
      const locale = getLanguage();
      if (english === previousSource && locale === previousLanguage) return text;
      previousSource = english;
      previousLanguage = locale;
      const localized = translate(english, locale);
      if (localized === english) return setText(value);
      const context = text.context;
      context.save();
      context.font = `${baseStyle} ${baseSize}px ${baseFamily}`.trim();
      const maxWidth =
        Math.max(...english.split('\n').map((line) => context.measureText(line).width)) +
        text.style.strokeThickness * 2;
      const localizedStyle = baseFamily.includes('Lilita') ? 'bold' : baseStyle;
      context.font = `${localizedStyle} ${baseSize}px Rubik`.trim();
      const translatedWidth =
        Math.max(...localized.split('\n').map((line) => context.measureText(line).width)) +
        text.style.strokeThickness * 2;
      context.restore();
      const size =
        !text.style.wordWrapWidth && maxWidth > 0 && translatedWidth > maxWidth
          ? Math.max(6, Math.floor((baseSize * maxWidth) / translatedWidth))
          : baseSize;
      if (text.style.fontFamily !== 'Rubik') text.setFontFamily('Rubik');
      if (text.style.fontStyle !== localizedStyle) text.setFontStyle(localizedStyle);
      if (parseFloat(String(text.style.fontSize)) !== size) text.setFontSize(size);
      setText(localized);
      return text;
    };
    return text.setText(source);
  };
}
