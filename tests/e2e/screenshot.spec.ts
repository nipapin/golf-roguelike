import { test, expect, Page, BrowserContext } from '@playwright/test';
import * as path from 'path';

const VIEWPORT_SIZES = [
  { name: '390x844', width: 390, height: 844 },
  { name: '375x667', width: 375, height: 667 },
  { name: '430x932', width: 430, height: 932 },
];

const ARTIFACT_DIR = '/opt/cursor/artifacts';

async function waitForGameReady(page: Page) {
  // Wait for the game canvas to be present
  await page.waitForSelector('#game canvas', { timeout: 15000 });
  // Wait for fonts and initial rendering
  await page.waitForTimeout(2000);
}

async function startBattle(page: Page) {
  // The START RUN button is in the lower portion of the screen
  // Button is at y = height - 180, centered horizontally (280px wide)
  const { width, height } = page.viewportSize()!;
  const buttonY = height - 180;
  
  // Use touchscreen tap for mobile simulation
  await page.touchscreen.tap(width / 2, buttonY);
  
  // Wait for scene transition and battle to load
  await page.waitForTimeout(3000);
  
  // Check if we're in the battle scene by looking for tableau
  const inBattle = await page.evaluate(() => {
    return !!(window as any).$game?.getState?.()?.battle;
  });
  
  if (!inBattle) {
    console.log('First tap did not start battle, trying alternative positions');
    // Try clicking directly on the START RUN area at different Y positions
    for (const yOffset of [-30, -10, 10, 30]) {
      await page.touchscreen.tap(width / 2, buttonY + yOffset);
      await page.waitForTimeout(600);
      const checkBattle = await page.evaluate(() => {
        return !!(window as any).$game?.getState?.()?.battle;
      });
      if (checkBattle) {
        console.log(`Battle started with yOffset ${yOffset}`);
        await page.waitForTimeout(1500);
        return;
      }
    }
    // If all taps failed, try mouse click as fallback
    console.log('Touch taps failed, trying mouse click');
    await page.mouse.click(width / 2, buttonY);
    await page.waitForTimeout(2500);
  }
}

test.describe('Battle Scene Screenshots', () => {
  for (const viewport of VIEWPORT_SIZES) {
    test(`screenshot at ${viewport.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      });
      
      const page = await context.newPage();
      
      await page.goto('http://localhost:4173');
      await waitForGameReady(page);
      
      // Start a battle
      await startBattle(page);
      
      // Take battle screenshot
      const battlePath = path.join(ARTIFACT_DIR, `battle-${viewport.name}.png`);
      await page.screenshot({ path: battlePath, fullPage: false });
      console.log(`Saved battle screenshot: ${battlePath}`);
      
      await context.close();
    });
  }

  test('settings modal screenshot at 390x844', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    
    const page = await context.newPage();
    
    await page.goto('http://localhost:4173');
    await waitForGameReady(page);
    await startBattle(page);
    
    // Click the gear button (top-right area of HUD)
    // HUD is at top, gear button is at width - 30, around y = 47 + 22 = ~70
    await page.mouse.click(360, 70);
    await page.waitForTimeout(500);
    
    const settingsPath = path.join(ARTIFACT_DIR, 'settings-modal-390x844.png');
    await page.screenshot({ path: settingsPath, fullPage: false });
    console.log(`Saved settings modal screenshot: ${settingsPath}`);
    
    await context.close();
  });

  test('verify playable card taps', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    
    const page = await context.newPage();
    
    await page.goto('http://localhost:4173');
    await waitForGameReady(page);
    await startBattle(page);
    
    // Get test hook data
    const testHook = await page.evaluate(() => (window as any).__GOLF_TEST__);
    
    if (!testHook || !testHook.isActive) {
      console.log('Test hook not active');
      await context.close();
      return;
    }
    
    // Get playable cards
    const playableCards = await page.evaluate(() => {
      const hook = (window as any).__GOLF_TEST__;
      return hook?.getPlayableCards?.() || [];
    });
    
    console.log(`Found ${playableCards.length} playable cards`);
    
    // Try to tap up to 5 playable cards
    let tapsSucceeded = 0;
    for (let i = 0; i < Math.min(5, playableCards.length); i++) {
      const card = playableCards[i];
      const centerX = card.bounds.x + card.bounds.width / 2;
      const centerY = card.bounds.y + card.bounds.height / 2;
      
      const beforeActive = await page.evaluate(() => {
        const hook = (window as any).__GOLF_TEST__;
        return hook?.getActiveCardId?.();
      });
      
      await page.mouse.click(centerX, centerY);
      await page.waitForTimeout(300);
      
      const afterActive = await page.evaluate(() => {
        const hook = (window as any).__GOLF_TEST__;
        return hook?.getActiveCardId?.();
      });
      
      if (afterActive !== beforeActive) {
        tapsSucceeded++;
        console.log(`Card tap at (${centerX}, ${centerY}) succeeded`);
      }
    }
    
    console.log(`${tapsSucceeded}/${Math.min(5, playableCards.length)} card taps succeeded`);
    expect(tapsSucceeded).toBeGreaterThan(0);
    
    // Test draw button
    const drawBounds = await page.evaluate(() => {
      const hook = (window as any).__GOLF_TEST__;
      return hook?.getDrawPileBounds?.();
    });
    
    if (drawBounds) {
      const beforeDeck = await page.evaluate(() => {
        const hook = (window as any).__GOLF_TEST__;
        return hook?.getDeckCount?.() || 0;
      });
      
      await page.mouse.click(
        drawBounds.x + drawBounds.width / 2,
        drawBounds.y + drawBounds.height / 2
      );
      await page.waitForTimeout(300);
      
      const afterDeck = await page.evaluate(() => {
        const hook = (window as any).__GOLF_TEST__;
        return hook?.getDeckCount?.() || 0;
      });
      
      if (afterDeck !== beforeDeck) {
        console.log('Draw button tap succeeded');
      }
    }
    
    await context.close();
  });
});
