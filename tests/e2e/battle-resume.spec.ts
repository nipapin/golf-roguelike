import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { startRun, startNextBattle } from '../../src/core/GameActions';
import type { GameConfig } from '../../src/core/types';
import type { EnemiesData } from '../../src/core/GameState';
const config = JSON.parse(
  readFileSync(new URL('../../src/data/config.json', import.meta.url), 'utf8')
) as GameConfig;
const enemies = JSON.parse(
  readFileSync(new URL('../../src/data/enemies.json', import.meta.url), 'utf8')
) as EnemiesData;
import type { RunState } from '../../src/core/types';
import type { GameManager, TestHook } from '../../src/presentation/GameManager';

declare global {
  interface Window {
    $game: GameManager;
    __GOLF_TEST__: TestHook | null;
  }
}

for (const size of [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`tap, save and resume a seeded battle at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    const initial = startNextBattle(startRun('foundation-test', config), enemies, config);
    await page.addInitScript((state: RunState) => {
      if (!localStorage.getItem('foundation-fixture-loaded')) {
        localStorage.setItem(
          'golf-rogue-save',
          JSON.stringify({ version: 1, state, savedAt: Date.now() })
        );
        localStorage.setItem('foundation-fixture-loaded', 'yes');
      }
    }, initial);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await page.waitForFunction(() => !!window.$game);
    await page.touchscreen.tap(size.width / 2, size.height - 180);
    await page.waitForFunction(() => window.__GOLF_TEST__?.isActive === true);
    expect(await page.evaluate(() => window.$game.getState())).toEqual(initial);
    const playable = await page.evaluate(() => window.__GOLF_TEST__!.getPlayableCards()[0]);
    expect(playable).toBeDefined();
    const { x, y, width, height } = playable.bounds;
    await page.touchscreen.tap(x + width / 2, y + height / 2);
    await page.waitForFunction(
      (id) => window.$game.getState()?.battle?.activeCard?.id === id,
      playable.cardId
    );
    const after = await page.evaluate(() => window.$game.getState());
    expect(after!.battle!.tableau.flatMap((column) => column.cards)).toHaveLength(34);
    expect(after!.battle!.chain).toHaveLength(1);
    await page.reload();
    await page.waitForFunction(() => !!window.$game);
    await page.touchscreen.tap(size.width / 2, size.height - 180);
    await page.waitForFunction(() => window.__GOLF_TEST__?.isActive === true);
    expect(await page.evaluate(() => window.$game.getState())).toEqual(after);
    const draw = await page.evaluate(() => window.__GOLF_TEST__!.getDrawPileBounds());
    await page.touchscreen.tap(draw.x + draw.width / 2, draw.y + draw.height / 2);
    await page.waitForFunction(
      (previous) => window.$game.getState()?.battle?.turnNumber === previous + 1,
      after!.battle!.turnNumber
    );
    expect(errors).toEqual([]);
  });
}
