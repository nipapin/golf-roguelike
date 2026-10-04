import { describe, expect, it } from 'vitest';
import { config, memoryStorage } from '../test/fixtures';
import { createTraining } from './CastleTutorial';
import { CastleService } from './CastleService';
import { stepSiege, SOLDIER_HOLD_PROGRESS, soldierIsMarching, type Invader } from './CastleDefense';

function fixture() {
  const { manager, ids } = createTraining();
  manager.play(ids[0]); manager.draw();
  const state = manager.state!;
  state.siege.spawnIn = 1000;
  state.siege.enemies = [];
  state.siege.units = state.siege.units.filter(u => u.kind === 'soldier');
  return state;
}
const enemy = (progress: number, hp = 2): Invader => ({ id: 90, sprite: 'c_orc', boss: false,
  hp, maxHp: hp, progress, speed: 0.03, damage: 1, cooldown: 10 });

describe('soldiers holding the castle approach', () => {
  it('reaches the defense line and stays there without enemies', () => {
    let state = fixture();
    expect(soldierIsMarching(state.siege.units[0], [])).toBe(true);
    for (let i = 0; i < 240; i++) state = stepSiege(state).state;
    expect(state.siege.units).toHaveLength(1);
    expect(state.siege.units[0].progress).toBe(SOLDIER_HOLD_PROGRESS);
    expect(soldierIsMarching(state.siege.units[0], [])).toBe(false);
  });
  it('holds the combat position after killing an enemy, even before reaching the line', () => {
    let state = fixture();
    const position = state.siege.units[0].progress;
    state.siege.enemies = [enemy(position)];
    expect(soldierIsMarching(state.siege.units[0], state.siege.enemies)).toBe(false);
    state = stepSiege(state).state;
    expect(state.siege.enemies).toEqual([]);
    expect(state.siege.units[0].engaged).toBe(true);
    for (let i = 0; i < 20; i++) state = stepSiege(state).state;
    expect(state.siege.units[0].progress).toBe(position);
    const storage = memoryStorage(), service = new CastleService(storage);
    service.save(state);
    const resumed = stepSiege(service.load()!).state;
    expect(resumed.siege.units[0].progress).toBe(position);
    expect(soldierIsMarching(resumed.siege.units[0], [])).toBe(false);
  });
  it('blocks approaching enemies on the line and resumes attacking new targets', () => {
    let state = fixture();
    state.siege.units[0].progress = SOLDIER_HOLD_PROGRESS;
    state.siege.enemies = [enemy(SOLDIER_HOLD_PROGRESS - .04, 20)];
    const position = state.siege.enemies[0].progress;
    const result = stepSiege(state);
    expect(result.state.siege.enemies[0].progress).toBe(position);
    expect(result.events.some(e => e.type === 'shot' && e.kind === 'soldier')).toBe(true);
    state = result.state;
    state.siege.enemies = [];
    for (let i = 0; i < 5; i++) state = stepSiege(state).state;
    state.siege.enemies = [enemy(SOLDIER_HOLD_PROGRESS)];
    expect(stepSiege(state).events.some(e => e.type === 'killed')).toBe(true);
  });
  it('returns soldiers from old saves to the defense line instead of leaving them offscreen', () => {
    const state = fixture();
    state.siege.units[0].progress = 0;
    state.siege.units[0].engaged = true;
    expect(stepSiege(state).state.siege.units[0].progress).toBe(SOLDIER_HOLD_PROGRESS);
  });
});
