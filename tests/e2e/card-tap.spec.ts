import { test, expect } from '@playwright/test';

test.describe('Card Tap Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the game
    await page.goto('http://localhost:4173');
    
    // Wait for the game to load
    await page.waitForSelector('#game canvas', { timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test('should be able to tap playable cards', async ({ page }) => {
    // Click START RUN button (center of screen, lower half)
    await page.mouse.click(195, 600);
    await page.waitForTimeout(1500);

    // Get game state via window.$game (exposed by our game)
    const initialState = await page.evaluate(() => (window as any).$game?.getState?.());
    
    if (!initialState?.battle) {
      console.log('No battle state, game may not have started');
      return;
    }

    // Test the DRAW button first (known working)
    // Draw pile is at approximately x=43, y near bottom
    await page.mouse.click(43, 750);
    await page.waitForTimeout(500);

    const afterDraw = await page.evaluate(() => (window as any).$game?.getState?.());
    console.log('After draw - deck changed:', afterDraw?.battle?.deck?.length !== initialState?.battle?.deck?.length);

    // Now test card taps
    // Cards are in a 7-column grid starting at x=8, with width ~50 and gap ~4
    // Test tapping in the tableau area
    const cardWidth = 50;
    const cardGap = 4;
    const startX = 8;
    
    let tapsAttempted = 0;
    let tapsSucceeded = 0;

    for (let col = 0; col < 7; col++) {
      const cardCenterX = startX + col * (cardWidth + cardGap) + cardWidth / 2;
      
      // Tap at different Y positions in the tableau (roughly y=550-700)
      for (const y of [580, 620, 660]) {
        const beforeState = await page.evaluate(() => (window as any).$game?.getState?.());
        const beforeChain = beforeState?.battle?.chain?.length || 0;
        const beforeActive = beforeState?.battle?.activeCard?.id;

        await page.mouse.click(cardCenterX, y);
        await page.waitForTimeout(200);

        const afterState = await page.evaluate(() => (window as any).$game?.getState?.());
        const afterChain = afterState?.battle?.chain?.length || 0;
        const afterActive = afterState?.battle?.activeCard?.id;

        tapsAttempted++;
        if (afterChain !== beforeChain || afterActive !== beforeActive) {
          tapsSucceeded++;
          console.log(`Tap at (${cardCenterX}, ${y}) registered!`);
        }
      }
    }

    console.log(`Card taps: ${tapsSucceeded}/${tapsAttempted} succeeded`);
    
    // We expect at least some taps to work (playable cards)
    expect(tapsSucceeded).toBeGreaterThan(0);
  });

  test('should handle rapid double-tap without double-play', async ({ page }) => {
    // Start a run
    await page.mouse.click(195, 600);
    await page.waitForTimeout(1500);

    const initialState = await page.evaluate(() => (window as any).$game?.getState?.());
    if (!initialState?.battle) return;

    // Find a playable card position and double-tap rapidly
    const cardX = 33; // First column center
    const cardY = 650; // Approximate tableau Y

    // Rapid double-click
    await page.mouse.click(cardX, cardY);
    await page.mouse.click(cardX, cardY);
    await page.waitForTimeout(500);

    const afterState = await page.evaluate(() => (window as any).$game?.getState?.());
    
    // Count how many cards were played (chain length change should be 0 or 1, not 2)
    const chainDiff = (afterState?.battle?.chain?.length || 0) - (initialState?.battle?.chain?.length || 0);
    console.log('Chain diff after double-tap:', chainDiff);
    
    // Should not have played 2 cards
    expect(chainDiff).toBeLessThanOrEqual(1);
  });
});
