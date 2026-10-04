import { describe, expect, it } from 'vitest';
import { config } from '../test/fixtures';
import { createCastleRun, emptyUpgrades, playCastleCard, stepSiege, STEP } from './CastleDefense';

describe('whole-run result statistics', () => {
  it('counts the finishing card, final laser kills and boss loot on top of previous rounds', () => {
    const state = createCastleRun('run-stats', config, emptyUpgrades());
    const battle = state.run.battle!;
    const pack = [...battle.tableau.flatMap(column => column.cards), ...battle.deck, battle.activeCard!];
    const active = pack.find(card => card.rank === 7 && card.suit === 'clubs')!;
    const last = pack.find(card => card.rank === 6 && card.suit === 'clubs')!;
    state.run = { ...state.run, battle: { ...battle, activeCard: active,
      tableau: [{ cards: [last] }, ...Array.from({ length: 6 }, () => ({ cards: [] }))],
      deck: pack.filter(card => card !== active && card !== last), discard: [], powerCards: [] } };
    state.runStats = { roundsWon: 2, enemiesDefeated: 9, bossesDefeated: 1,
      cardsPlayed: 56, seconds: 100, goldEarned: 13 };
    state.siege.enemies = [false, true].map((boss, index) => ({
      id: 100 + index, sprite: boss ? 'c_ogre' : 'c_orc', boss,
      hp: 100, maxHp: 100, progress: .5, speed: 0, damage: 1, cooldown: 100,
    }));
    const result = playCastleCard(state, last.id, config);
    expect(result.state.run.phase).toBe('victory');
    expect(result.state.runStats).toEqual({ roundsWon: 3, enemiesDefeated: 11,
      bossesDefeated: 2, cardsPlayed: 57, seconds: 100, goldEarned: 19 });
    expect(state.runStats.cardsPlayed).toBe(56);
    expect(playCastleCard(result.state, last.id, config).state.runStats).toEqual(result.state.runStats);
  });
  it('accumulates active simulation time without counting inactive or finished frames', () => {
    let state = createCastleRun('stats-clock', config, emptyUpgrades());
    expect(stepSiege(state).state.runStats!.seconds).toBe(0);
    state.siege.started = true;
    state.siege.spawnIn = 100;
    state.runStats!.seconds = 90;
    for (let i = 0; i < 10; i++) state = stepSiege(state).state;
    expect(state.runStats!.seconds).toBeCloseTo(90 + STEP * 10);
    state.run = { ...state.run, phase: 'defeat' };
    expect(stepSiege(state).state.runStats!.seconds).toBeCloseTo(90 + STEP * 10);
  });
});
