import { afterEach, describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import {
  getLanguage,
  readLanguage,
  setLanguage,
  translate,
  installSceneLocalization,
} from './i18n';
import { memoryStorage } from '../test/fixtures';
afterEach(() => setLanguage('ru', memoryStorage()));

describe('language selection', () => {
  it('persists English and Russian and remains usable when storage is blocked', () => {
    const storage = memoryStorage();
    expect(readLanguage(storage)).toBe('ru');
    setLanguage('en', storage);
    expect(readLanguage(storage)).toBe('en');
    setLanguage('ru', storage);
    expect(readLanguage(storage)).toBe('ru');
    const blocked = {
      ...storage,
      setItem: () => {
        throw new Error('Blocked');
      },
    };
    expect(() => setLanguage('en', blocked)).not.toThrow();
    expect(getLanguage()).toBe('en');
  });
  it('translates changing HUD values and preserves their numeric meaning', () => {
    expect(translate('CASTLE 25 / 30', 'ru')).toBe('ЗАМОК 25 / 30');
    expect(translate('ARMOR 8\nENEMIES 12', 'ru')).toBe('БРОНЯ 8\nВРАГИ 12');
    expect(translate('DRAW TO DEPLOY\n18 stock · 35 cards left', 'ru')).toBe(
      'ДОБОР ДЛЯ ПРИЗЫВА\nЗапас: 18 · На поле: 35'
    );
    expect(translate('NO MOVES · −5 HP · NEW DEAL', 'ru')).toBe(
      'НЕТ ХОДОВ · −5 HP · НОВЫЙ РАСКЛАД'
    );
    expect(translate('BUY UPGRADE · 34 COINS', 'ru')).toBe('УЛУЧШИТЬ · 34 ЗОЛОТА');
    expect(translate('3/14 · Try UNDO', 'ru')).toBe('3/14 · Попробуй отмену');
    expect(translate('CASTLE 25 / 30', 'en')).toBe('CASTLE 25 / 30');
  });
});

function fakeFactory() {
  return {
    text: (
      x: number,
      y: number,
      value: string | string[],
      input = { fontSize: '20px', fontFamily: 'Fredoka' }
    ) => {
      const style = { ...input, fontStyle: '', strokeThickness: 0, wordWrapWidth: 0 };
      const context = {
        font: '20px Fredoka',
        save() {},
        restore() {},
        measureText(s: string) {
          return { width: s.length * parseFloat(this.font.replace(/^bold /, '')) * 0.6 };
        },
      };
      const text = {
        x,
        y,
        style,
        context,
        width: 0,
        value: '',
        setText(v: string | string[]) {
          this.value = Array.isArray(v) ? v.join('\n') : v;
          this.width =
            Math.max(...this.value.split('\n').map((s) => s.length)) *
            parseFloat(style.fontSize) *
            0.6;
          return this;
        },
        setFontSize(size: number) {
          style.fontSize = `${size}px`;
          this.width = Math.max(...this.value.split('\n').map((s) => s.length)) * size * 0.6;
          return this;
        },
        setFontFamily(family: string) {
          style.fontFamily = family;
          return this;
        },
        setFontStyle(fontStyle: string) {
          style.fontStyle = fontStyle;
          return this;
        },
      };
      return text.setText(value);
    },
  };
}
describe('fixed scene geometry', () => {
  it('fits a longer Russian label within the old width and keeps coordinates through HUD updates', () => {
    setLanguage('ru', memoryStorage());
    const add = fakeFactory();
    const baseline = add.text(70, 100, 'BOOSTERS');
    const scene = { add } as unknown as Phaser.Scene;
    installSceneLocalization(scene);
    installSceneLocalization(scene); // Scene restarts must not stack translation wrappers.
    const localized = add.text(70, 100, 'BOOSTERS');
    expect(localized.value).toBe('УСИЛИТЕЛИ');
    expect(localized.width).toBeLessThanOrEqual(baseline.width);
    expect([localized.x, localized.y]).toEqual([70, 100]);
    localized.setText('CASTLE 25 / 30');
    expect(localized.value).toBe('ЗАМОК 25 / 30');
    const width = localized.width;
    localized.setText('CASTLE 25 / 30');
    expect(localized.width).toBe(width);
  });
});
