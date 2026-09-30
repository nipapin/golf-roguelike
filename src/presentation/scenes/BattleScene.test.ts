import { beforeEach, expect, it, vi } from 'vitest';
import type { BattleState } from '../../core/types';
import { battleFixture } from '../../test/fixtures';
import { getPlayableCards } from '../../core/GameRules';
import { playCard } from '../../core/GameActions';
import { config } from '../../test/fixtures';

const { Visual } = vi.hoisted(() => {
  class Visual {
    card: { id: string };
    state = 'normal';
    destroy = vi.fn();
    setPosition = vi.fn();
    setDepth = vi.fn();
    setInteractive = vi.fn();
    disableInteractive = vi.fn();
    constructor(_scene: unknown, _x: number, _y: number, card: { id: string }) {
      this.card = card;
    }
    getCard() {
      return this.card;
    }
    getState() {
      return this.state;
    }
    setState(state: string) {
      this.state = state;
    }
  }
  return { Visual };
});
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../design/CardVisual', () => ({ CardVisual: Visual }));
vi.mock('../design/ArenaBackground', () => ({}));
vi.mock('../design/HudComponents', () => ({}));
vi.mock('../design/SettingsModal', () => ({}));
vi.mock('../audio/AudioSystem', () => ({}));
import { BattleScene } from './BattleScene';

interface RendererHarness {
  layout: {
    tableauTop: number;
    cw: number;
    strip: number;
    side: number;
    gap: number;
    arenaTop: number;
    arenaHeight: number;
  };
  dealt: boolean;
  cardVisuals: InstanceType<typeof Visual>[];
  scale: { width: number; height: number };
  renderTableau: (battle: BattleState) => void;
  renderEnemy: (battle: BattleState) => void;
  renderedEnemyId: string | null;
  renderedIntentKey: string | null;
  enemyHPBar: { setHp: ReturnType<typeof vi.fn>; setPendingDamage: ReturnType<typeof vi.fn> };
  enemySprite: { destroy: ReturnType<typeof vi.fn> };
}
let scene: RendererHarness;
beforeEach(() => {
  scene = new BattleScene() as unknown as RendererHarness;
  scene.layout = {
    tableauTop: 250,
    cw: 50,
    strip: 30,
    side: 8,
    gap: 4,
    arenaTop: 50,
    arenaHeight: 180,
  };
  scene.dealt = true; // These retention tests isolate action rendering from initial dealing.
  scene.scale = { width: 390, height: 844 };
});

it('retains every remaining card object and its fixed slot after play', () => {
  const state = battleFixture();
  const playable = getPlayableCards(state.battle!)[0];
  expect(playable).toBeDefined();
  scene.renderTableau(state.battle!);
  const before = new Map(scene.cardVisuals.map((visual) => [visual.card.id, visual]));
  const after = playCard(state, playable.id, config).state;
  scene.renderTableau(after.battle!);
  expect(scene.cardVisuals).toHaveLength(34);
  for (const visual of scene.cardVisuals) {
    expect(visual).toBe(before.get(visual.card.id));
    expect(visual.destroy).not.toHaveBeenCalled();
    const positions = visual.setPosition.mock.calls;
    expect(positions[positions.length - 1]).toEqual(positions[0]);
  }
  expect(before.get(playable.id)!.destroy).toHaveBeenCalledOnce();
});

it('updates input eligibility without rebuilding cards on draw', () => {
  const state = battleFixture();
  scene.renderTableau(state.battle!);
  const before = [...scene.cardVisuals];
  const changed = { ...state.battle!, activeCard: { ...state.battle!.activeCard!, rank: 9 } };
  scene.renderTableau(changed);
  expect(scene.cardVisuals).toEqual(before);
  const playable = new Set(getPlayableCards(changed).map((card) => card.id));
  for (const visual of scene.cardVisuals) {
    expect(visual.getState() === 'playable').toBe(playable.has(visual.card.id));
    // Invalid cards also receive taps so the scene can explain and shake the rejected move.
    expect(visual.setInteractive).toHaveBeenCalled();
  }
});

it('keeps the enemy sprite alive while updating health and pending damage', () => {
  const battle = battleFixture().battle!;
  scene.renderedEnemyId = battle.enemy.id;
  const intent = battle.enemy.intents[battle.enemy.currentIntentIndex];
  scene.renderedIntentKey = `${intent.type}:${intent.value}`;
  scene.enemyHPBar = { setHp: vi.fn(), setPendingDamage: vi.fn() };
  scene.enemySprite = { destroy: vi.fn() };
  scene.renderEnemy({ ...battle, accumulatedDamage: 12 });
  expect(scene.enemyHPBar.setPendingDamage).toHaveBeenCalledWith(12);
  expect(scene.enemyHPBar.setHp).toHaveBeenCalledWith(battle.enemy.hp, battle.enemy.maxHp);
  expect(scene.enemySprite.destroy).not.toHaveBeenCalled();
});
