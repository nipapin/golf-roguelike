import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../presentation/design/CardVisual', () => ({}));
vi.mock('../presentation/design/SettingsModal', () => ({}));
vi.mock('../presentation/design/GamePopup', () => ({}));
vi.mock('../presentation/design/CombatVFX', () => ({}));
vi.mock('./CastleArt', () => ({}));
const manager = vi.hoisted(() => ({ start: vi.fn(), resume: vi.fn() }));
vi.mock('./CastleManager', () => ({ castleManager: () => manager }));
vi.mock('./CastleTutorial', () => ({ completeTraining: vi.fn() }));
vi.mock('../presentation/audio/AudioSystem', () => ({ AudioSystem: { play: vi.fn() } }));
import { AudioSystem } from '../presentation/audio/AudioSystem';
import { createCastleRun, emptyUpgrades, type SiegeEvent } from './CastleDefense';
import { gameConfig } from '../data/gameConfig';
import { CastleScene } from './CastleScene';

it('switches stationary soldiers to idle without interrupting attack or hurt clips', () => {
  const scene = new CastleScene() as unknown as { soldierAnimation: (body: unknown, walking: boolean) => void };
  const body = { anims: { currentAnim: { key: 'c_angel1-walk' }, isPlaying: true },
    play: vi.fn(), setAngle: vi.fn() };
  body.play.mockReturnValue(body);
  scene.soldierAnimation(body, false);
  expect(body.play).toHaveBeenLastCalledWith('c_angel1-idle', true);
  scene.soldierAnimation(body, true);
  expect(body.play).toHaveBeenLastCalledWith('c_angel1-walk', true);
  body.play.mockClear();
  for (const key of ['c_angel1-attack', 'c_angel1-hurt']) {
    body.anims.currentAnim.key = key;
    scene.soldierAnimation(body, false);
  }
  expect(body.play).not.toHaveBeenCalled();
});

function stockHarness() {
  const widget = () => {
    const data = new Map<string, unknown>();
    const node = { alpha: 0, visible: false, text: '', input: { enabled: true, cursor: '' },
      setData: (key: string, value: unknown) => { data.set(key, value); return node; },
      getData: (key: string) => data.get(key),
      setAlpha: (value: number) => { node.alpha = value; return node; },
      setVisible: (value: boolean) => { node.visible = value; return node; },
      setText: (value: string) => { node.text = value; return node; },
      setColor: () => node, setStyle: () => node, setFontSize: () => node, setX: () => node,
    }; return node;
  };
  const state = createCastleRun('stock-ui-qa', gameConfig, emptyUpgrades()), pile = widget(), halo = widget(),
    price = widget(), stop = vi.fn();
  const addTween = vi.fn(() => ({ stop })), draw = vi.fn();
  const scene = new CastleScene();
  Object.assign(scene, { manager: { state, draw }, stockPile: pile, stockPileBacks: [], stockHalo: halo,
    stockPlaceholder: widget(), recyclePrice: price,
    layout: { desktop: true }, tweens: { add: addTween } });
  return { state, pile, halo, price, stop, addTween, draw,
    refresh: () => (scene as unknown as { refreshStock: () => void }).refreshStock() };
}

describe('manual stock action and legal-move hint', () => {
  it('keeps a queen playable on a king after the stock is empty, without auto shuffling', () => {
    const h = stockHarness(), battle = h.state.run.battle!;
    Object.assign(battle, { deck: [], activeCard: { id: 'king', rank: 13, suit: 'spades' },
      tableau: [{ cards: [{ id: 'queen', rank: 12, suit: 'hearts' }] }] });
    h.refresh();
    expect(h.pile.getData('noLegalMoves')).toBe(false);
    expect(h.halo.alpha).toBe(0); expect(h.draw).not.toHaveBeenCalled();
    expect(h.pile.getData('action')).toBe('shuffle');
    expect(h.price.visible).toBe(true);
  });
  it('highlights only an exposed dead end and clears the hint when WILD makes it playable', () => {
    const h = stockHarness(), battle = h.state.run.battle!;
    Object.assign(battle, { activeCard: { id: 'five', rank: 5, suit: 'spades' },
      tableau: [{ cards: [{ id: 'covered-four', rank: 4, suit: 'clubs' },
        { id: 'two', rank: 2, suit: 'hearts' }] }] });
    h.refresh(); h.refresh();
    expect(h.pile.getData('noLegalMoves')).toBe(true);
    expect(h.halo.alpha).toBe(1); expect(h.addTween).toHaveBeenCalledOnce();
    Object.assign(battle, { wildActive: true }); h.refresh();
    expect(h.pile.getData('noLegalMoves')).toBe(false);
    expect(h.halo.alpha).toBe(0); expect(h.stop).toHaveBeenCalledOnce();
    expect(h.draw).not.toHaveBeenCalled();
  });
});

it.each(['soldier', 'archer', 'turret', 'mortar'] as const)('uses the correct deployment sound for %s', (kind) => {
  vi.mocked(AudioSystem.play).mockClear();
  const scene = new CastleScene() as unknown as {
    manager: { state: { siege: { units: [] } } };
    time: { now: number };
    nextFootstep: number;
    handleEvents: (events: SiegeEvent[]) => void;
  };
  scene.manager = { state: { siege: { units: [] } } };
  scene.time = { now: 100 };
  scene.handleEvents([{ type: 'deploy', id: 1, kind }]);
  const id = vi.mocked(AudioSystem.play).mock.calls[0][0];
  if (kind === 'soldier') {
    expect(['footstep_1', 'footstep_2']).toContain(id);
    expect(scene.nextFootstep).toBe(530);
  } else expect(id).toBe('unit_deploy');
});

interface ExitHarness {
  training?: object;
  locked: boolean;
  tutorialFinish: 'menu' | 'start' | 'resume';
  sys: { settings: { data: { tutorial: boolean } } };
  lessonUI: { destroy: ReturnType<typeof vi.fn> };
  scene: { start: ReturnType<typeof vi.fn>; restart: ReturnType<typeof vi.fn> };
  finishTraining: () => void;
}
describe('training exit lifecycle', () => {
  it.each(['menu', 'start', 'resume'] as const)(
    'clears retained Phaser data before exiting to %s',
    (destination) => {
      manager.start.mockClear();
      manager.resume.mockClear();
      const scene = new CastleScene() as unknown as ExitHarness;
      scene.training = {};
      scene.locked = false;
      scene.tutorialFinish = destination;
      scene.sys = { settings: { data: { tutorial: true } } };
      scene.lessonUI = { destroy: vi.fn() };
      scene.scene = { start: vi.fn(), restart: vi.fn() };
      scene.finishTraining();
      expect(scene.sys.settings.data).toEqual({ tutorial: false });
      expect(scene.training).toBeUndefined();
      if (destination === 'menu') expect(scene.scene.start).toHaveBeenCalledWith('StartScene');
      else {
        expect(scene.scene.restart).toHaveBeenCalledWith({ tutorial: false });
        expect(manager[destination]).toHaveBeenCalledOnce();
      }
      // Duplicate taps must not create an extra real siege.
      scene.finishTraining();
      expect(scene.scene.start.mock.calls.length + scene.scene.restart.mock.calls.length).toBe(1);
    }
  );
});
