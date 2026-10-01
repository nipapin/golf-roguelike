import { describe, expect, it } from 'vitest';
import { CastleService } from './CastleService';
import { createCastleRun, emptyUpgrades } from './CastleDefense';
import { config, memoryStorage } from '../test/fixtures';
import { getCastleLayoutMetrics } from '../presentation/design/tokens';
describe('castle progression resets', () => {
  it('keeps the record and wallet but starts at difficulty one after a defeat', () => {
    const service = new CastleService(memoryStorage());
    service.beginSiege();
    service.beginSiege();
    service.beginSiege();
    const state = createCastleRun('defeat', config, emptyUpgrades(), 'defeat', 3);
    state.run = { ...state.run, phase: 'defeat', player: { ...state.run.player, hp: 0 } };

    service.settle(state);
    expect(service.readMeta()).toMatchObject({ currentStreak: 0, bestSiege: 3 });
    expect(service.beginSiege().currentStreak).toBe(1);
    expect(service.readMeta().bestSiege).toBe(3);
    service.settle(state); // Reopening a settled defeat must not reset the new attempt.
    expect(service.readMeta().currentStreak).toBe(1);
  });
  it('advances after a victory and preserves permanent upgrades', () => {
    const storage = memoryStorage();
    const service = new CastleService(storage);
    service.beginSiege();
    const state = createCastleRun('win', config, emptyUpgrades(), 'win', 1);
    state.run = { ...state.run, phase: 'victory' };
    state.siege.coins = 50;
    service.settle(state);
    service.purchase('magazine');
    expect(service.beginSiege().currentStreak).toBe(2);
    state.id = 'lost';
    state.siegeNumber = 2;
    state.run = { ...state.run, phase: 'defeat', player: { ...state.run.player, hp: 0 } };

    service.settle(state);
    expect(service.readMeta().upgrades.magazine).toBe(1);
    expect(service.beginSiege().currentStreak).toBe(1);
  });
});
describe('compact castle arena', () => {
  it.each([
    [390, 844],
    [430, 932],
    [375, 667],
  ])('uses spare sky for cards at %i×%i', (w, h) => {
    const layout = getCastleLayoutMetrics(w, h, { top: 0, bottom: 0 });
    expect(layout.arenaHeight).toBeLessThanOrEqual(205);
    expect(layout.arenaHeight).toBeGreaterThan(60);
    expect(layout.tableauTop + layout.tableauHeight).toBeLessThan(layout.trayTop);
    expect(layout.trayTop + layout.trayHeight).toBeLessThanOrEqual(h - 8);
    expect(layout.strip).toBeLessThan(layout.ch);
  });
});
