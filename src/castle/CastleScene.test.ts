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
import { completeTraining } from './CastleTutorial';
import { CastleScene } from './CastleScene';

interface ExitHarness {
  training?: object;
  locked: boolean;
  tutorialFinish: 'menu' | 'start' | 'resume';
  sys: { settings: { data: { tutorial: boolean } } };
  lessonUI: { destroy: ReturnType<typeof vi.fn> };
  scene: { start: ReturnType<typeof vi.fn>; restart: ReturnType<typeof vi.fn> };
  finishTraining: (completed?: boolean) => void;
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
  it('skips training without marking it completed or starting a siege', () => {
    vi.mocked(completeTraining).mockClear();
    manager.start.mockClear();
    manager.resume.mockClear();
    const scene = new CastleScene() as unknown as ExitHarness;
    scene.training = {};
    scene.locked = false;
    scene.tutorialFinish = 'menu';
    scene.sys = { settings: { data: { tutorial: true } } };
    scene.lessonUI = { destroy: vi.fn() };
    scene.scene = { start: vi.fn(), restart: vi.fn() };
    scene.finishTraining(false);
    expect(completeTraining).not.toHaveBeenCalled();
    expect(scene.scene.start).toHaveBeenCalledWith('StartScene');
    expect(scene.sys.settings.data).toEqual({ tutorial: false });
    expect(scene.training).toBeUndefined();
    expect(manager.start).not.toHaveBeenCalled();
    expect(manager.resume).not.toHaveBeenCalled();
  });
});
