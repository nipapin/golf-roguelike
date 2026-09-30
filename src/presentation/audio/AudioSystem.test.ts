import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { memoryStorage } from '../../test/fixtures';

class AudioParamStub {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  setTargetAtTime = vi.fn();
}
class AudioNodeStub {
  gain = new AudioParamStub();
  frequency = new AudioParamStub();
  playbackRate = new AudioParamStub();
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  buffer: unknown;
  type = '';
  onended: (() => void) | null = null;
}
class ContextStub {
  static instances: ContextStub[] = [];
  currentTime = 0;
  state = 'running';
  destination = {};
  gains: AudioNodeStub[] = [];
  voices: AudioNodeStub[] = [];
  sources: AudioNodeStub[] = [];
  resume = vi.fn(async () => { this.state = 'running'; });
  constructor() { ContextStub.instances.push(this); }
  createGain() { const node = new AudioNodeStub(); this.gains.push(node); return node; }
  createOscillator() { const node = new AudioNodeStub(); this.voices.push(node); return node; }
  createBufferSource() { const node = new AudioNodeStub(); this.sources.push(node); return node; }
  createBuffer() { return {}; }
  decodeAudioData = vi.fn(async () => ({ duration: 114 }));
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  ContextStub.instances = [];
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('window', { AudioContext: ContextStub });
  vi.stubGlobal('document', { hidden: false, addEventListener: vi.fn() });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) })));
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('mixes quieter SFX and actually starts one music loop after a gesture', async () => {
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init();
  AudioSystem.unlock();
  AudioSystem.unlock();
  expect(ContextStub.instances).toHaveLength(1);
  const context = ContextStub.instances[0];
  expect(context.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.22, 0, 0.04);
  expect(context.gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.18, 0, 0.08);
  expect(context.sources.filter(source => (source as AudioNodeStub & {loop?: boolean}).loop)).toHaveLength(1);
  expect(context.voices).toHaveLength(0);
  AudioSystem.play('card_play');
  expect(context.sources.at(-1)!.connect).toHaveBeenCalled();
  AudioSystem.isMusicEnabled = false;
  expect(vi.getTimerCount()).toBe(0);
  expect(context.sources.find(source => (source as AudioNodeStub & {loop?: boolean}).loop)!.stop).toHaveBeenCalledOnce();
  expect(AudioSystem.isSoundEnabled).toBe(true);
});

it('persists independent volumes and resumes a suspended context on a new gesture', async () => {
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init();
  AudioSystem.soundVolume = 2;
  AudioSystem.musicVolume = -1;
  expect(AudioSystem.soundVolume).toBe(1);
  expect(AudioSystem.musicVolume).toBe(0);
  const settings = JSON.parse(localStorage.getItem('golf_rogue_audio_settings')!);
  expect(settings.soundVolume).toBe(1);
  expect(settings.musicVolume).toBe(0);
  const context = ContextStub.instances[0];
  context.state = 'suspended';
  AudioSystem.unlock();
  await Promise.resolve();
  expect(context.resume).toHaveBeenCalledOnce();
  expect(context.state).toBe('running');
});

it('switches recorded themes without overlapping loops and plays results once', async () => {
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init(); AudioSystem.unlock();
  const context = ContextStub.instances[0];
  const menu = context.sources.find(source => (source as AudioNodeStub & { loop?: boolean }).loop)!;
  AudioSystem.setMusicScene('battle');
  expect(menu.stop).toHaveBeenCalledOnce();
  const battle = context.sources.at(-1)!;
  expect((battle as AudioNodeStub & { loop?: boolean }).loop).toBe(true);
  AudioSystem.setMusicScene('defeat');
  expect(battle.stop).toHaveBeenCalledOnce();
  const result = context.sources.at(-1)!;
  expect((result as AudioNodeStub & { loop?: boolean }).loop).toBe(false);
  result.onended?.();
  AudioSystem.unlock();
  expect(context.sources.at(-1)).not.toBe(result); // Only the silent unlock buffer was created.
  expect(context.sources.filter(source => source.buffer === result.buffer && source !== result && !(source as AudioNodeStub & { loop?: boolean }).loop)).toHaveLength(0);
});
