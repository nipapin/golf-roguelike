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
  threshold = new AudioParamStub();
  knee = new AudioParamStub();
  ratio = new AudioParamStub();
  attack = new AudioParamStub();
  release = new AudioParamStub();
  frequency = new AudioParamStub();
  Q = new AudioParamStub();
  playbackRate = new AudioParamStub();
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn(() => this.onended?.());
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
  filters: AudioNodeStub[] = [];
  sources: AudioNodeStub[] = [];
  compressors: AudioNodeStub[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  constructor() {
    ContextStub.instances.push(this);
  }
  createGain() {
    const node = new AudioNodeStub();
    this.gains.push(node);
    return node;
  }
  createBiquadFilter() {
    const node = new AudioNodeStub();
    this.filters.push(node);
    return node;
  }
  createDynamicsCompressor() {
    const node = new AudioNodeStub();
    this.compressors.push(node);
    return node;
  }
  createOscillator() {
    const node = new AudioNodeStub();
    this.voices.push(node);
    return node;
  }
  createBufferSource() {
    const node = new AudioNodeStub();
    this.sources.push(node);
    return node;
  }
  createBuffer() {
    return {};
  }
  decodeAudioData = vi.fn(async () => ({ duration: 114 }));
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  ContextStub.instances = [];
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('window', { AudioContext: ContextStub });
  vi.stubGlobal('document', { hidden: false, addEventListener: vi.fn() });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }))
  );
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('mixes quieter SFX and actually starts one music loop after a gesture', async () => {
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init();
  AudioSystem.unlock();
  AudioSystem.unlock();
  expect(ContextStub.instances).toHaveLength(1);
  const context = ContextStub.instances[0];
  expect(context.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.22, 0, 0.04);
  expect(context.gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.18, 0, 0.08);
  expect(
    context.sources.filter((source) => (source as AudioNodeStub & { loop?: boolean }).loop)
  ).toHaveLength(1);
  expect(context.voices).toHaveLength(0);
  AudioSystem.play('card_play');
  expect(context.sources.at(-1)!.connect).toHaveBeenCalled();
  AudioSystem.isMusicEnabled = false;
  expect(vi.getTimerCount()).toBe(0);
  expect(
    context.sources.find((source) => (source as AudioNodeStub & { loop?: boolean }).loop)!.stop
  ).toHaveBeenCalledOnce();
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

it('keeps one soundtrack playing and filters it outside battle', async () => {
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init();
  AudioSystem.unlock();
  const context = ContextStub.instances[0];
  const music = context.sources.find(
    (source) => (source as AudioNodeStub & { loop?: boolean }).loop
  )!;
  const filter = context.filters[0];
  AudioSystem.setMusicScene('battle');
  expect(filter.frequency.setTargetAtTime).toHaveBeenLastCalledWith(18000, 0, 0.25);
  AudioSystem.setMusicScene('defeat');
  expect(filter.frequency.setTargetAtTime).toHaveBeenLastCalledWith(650, 0, 0.25);
  AudioSystem.setMusicScene('menu');
  expect(music.stop).not.toHaveBeenCalled();
  expect(
    context.sources.filter((source) => (source as AudioNodeStub & { loop?: boolean }).loop)
  ).toHaveLength(1);
});

it('uses recorded rising combo and distinct power buffers without oscillators', async () => {
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init();
  AudioSystem.unlock();
  const context = ContextStub.instances[0];
  AudioSystem.playCombo(2);
  const first = context.sources.at(-1)!.playbackRate.value;
  context.currentTime += 0.1;
  AudioSystem.playCombo(6);
  const sixth = context.sources.at(-1)!.playbackRate.value;
  expect(sixth).toBeGreaterThan(first);
  AudioSystem.playPower('HEAL');
  const heal = context.sources.at(-1)!.buffer;
  AudioSystem.playPower('BOMB');
  const bomb = context.sources.at(-1)!.buffer;
  expect(heal).not.toBe(bomb);
  expect(context.voices).toHaveLength(0);
});
it('loads the replacement music and versioned recorded cues instead of cached legacy beeps', async () => {
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init();
  const urls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
  expect(urls).toContain('/audio/hd-v3/hope-battle.mp3');
  expect(urls).toContain('/audio/ci-v1/card-1.mp3');
  expect(urls.filter((url) => url.includes('/ci-v1/'))).toHaveLength(31);
  expect(new Set(urls).size).toBe(urls.length);
  expect(urls).not.toContain('/audio/heartfelt-battle.mp3');
  expect(urls).not.toContain('/audio/combo-up.mp3');
});

it('keeps different weapons audible in one tick and coalesces multi-target mortar hits', async () => {
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init();
  AudioSystem.unlock();
  const context = ContextStub.instances[0];
  const before = context.sources.length;
  AudioSystem.play('turret_shot');
  AudioSystem.play('archer_shot');
  AudioSystem.play('mortar_shot');
  AudioSystem.play('mortar_shot');
  AudioSystem.play('mortar_shot');
  expect(context.sources.length - before).toBe(3);
  context.currentTime += 0.25;
  AudioSystem.play('turret_shot');
  expect(context.sources.length - before).toBe(4);
});

it('coalesces castle damage bursts and limits overlapping laser tails', async () => {
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init();
  AudioSystem.unlock();
  const context = ContextStub.instances[0];
  const before = context.sources.length;
  for (let i = 0; i < 48; i++) AudioSystem.play('player_hit');
  expect(context.sources.length - before).toBe(1);
  AudioSystem.play('laser_blast');
  const first = context.sources.at(-1)!;
  AudioSystem.play('laser_blast');
  expect(first.stop).not.toHaveBeenCalled();
  context.currentTime += 0.2;
  AudioSystem.play('laser_blast');
  expect(first.stop).toHaveBeenCalledOnce();
});

it('routes both buses through master compression with headroom', async () => {
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init();
  const context = ContextStub.instances[0];
  const master = context.compressors[0];
  expect(context.gains[0].connect).toHaveBeenCalledWith(master);
  expect(context.gains[1].connect).toHaveBeenCalledWith(master);
  expect(master.ratio.value).toBe(20);
  expect(context.gains[2].gain.value).toBe(0.85);
});

it('leaves the first card as foley and grows later combo accents', async () => {
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init();
  AudioSystem.unlock();
  const context = ContextStub.instances[0];
  const before = context.sources.length;
  AudioSystem.playCombo(1);
  expect(context.sources).toHaveLength(before);
  AudioSystem.playCombo(2);
  const firstLevel = context.gains.at(-1)!.gain.value;
  context.currentTime += 0.1;
  AudioSystem.playCombo(20);
  expect(context.gains.at(-1)!.gain.value).toBeGreaterThan(firstLevel);
});
