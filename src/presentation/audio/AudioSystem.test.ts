import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { memoryStorage } from '../../test/fixtures';

class AudioParamStub {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  setTargetAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
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
  stop = vi.fn((_when?: number) => this.onended?.());
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
  expect(context.gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.12, 0, 0.08);
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

it('crossfades menu and battle tracks, keeps their positions and reuses the menu loop on results', async () => {
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init();
  AudioSystem.unlock();
  const context = ContextStub.instances[0];
  const music = context.sources.find(
    (source) => (source as AudioNodeStub & { loop?: boolean }).loop
  )!;
  const filter = context.filters[0];
  context.currentTime = 5;
  AudioSystem.setMusicScene('battle');
  const battle = context.sources.at(-1)!;
  expect(battle.buffer).not.toBe(music.buffer);
  expect(music.stop).toHaveBeenCalledWith(5.6);
  expect(filter.frequency.setTargetAtTime).toHaveBeenLastCalledWith(7000, 5, 0.6);
  const before = context.sources.length;
  AudioSystem.setMusicScene('battle');
  expect(context.sources).toHaveLength(before);
  context.currentTime = 12;
  AudioSystem.setMusicScene('defeat');
  const resumedMenu = context.sources.at(-1)!;
  expect(resumedMenu.buffer).toBe(music.buffer);
  expect(resumedMenu.start).toHaveBeenCalledWith(0, 5);
  expect(battle.stop).toHaveBeenCalledWith(12.6);
  expect(filter.frequency.setTargetAtTime).toHaveBeenLastCalledWith(4200, 12, 0.6);
  AudioSystem.setMusicScene('menu');
  expect(context.sources.at(-1)).toBe(resumedMenu);
  context.currentTime = 15;
  AudioSystem.isMusicEnabled = false;
  context.currentTime = 30;
  AudioSystem.setMusicScene('battle');
  expect(context.sources.at(-1)).toBe(resumedMenu);
  AudioSystem.isMusicEnabled = true;
  expect(context.sources.at(-1)!.start).toHaveBeenCalledWith(0, 7);
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
  expect(urls).toContain('/audio/user-sfx-v1/menu.mp3');
  expect(urls).toContain('/audio/user-sfx-v1/game.mp3');
  expect(urls).toContain('/audio/user-sfx-v1/card_01.mp3');
  expect(urls).toContain('/audio/user-sfx-v1/laser.mp3');
  expect(urls).toContain('/audio/user-sfx-v1/arrow_02.mp3');
  expect(urls).toContain('/audio/user-sfx-v1/sword_05.mp3');
  expect(urls).not.toContain('/audio/ci-v1/laser.mp3');
  expect(urls).not.toContain('/audio/lucid-v1/quiet-piano.ogg');
  expect(urls.filter((url) => url.includes('/soft-v1/'))).toHaveLength(2);
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

it('caps a long firing recording to one shot cycle, fades its cutoff and cleans up when it ends', async () => {
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init();
  AudioSystem.unlock();
  const context = ContextStub.instances[0];
  const source = new AudioNodeStub();
  // Web Audio schedules stop in the future; onended arrives only at that deadline.
  source.stop.mockImplementation(() => {});
  const create = vi.spyOn(context, 'createBufferSource').mockReturnValueOnce(source);
  context.currentTime = 10;
  AudioSystem.play('turret_shot', { duration: 0.25, pitchShift: 0.5, volume: 0.8 });
  const gain = context.gains.at(-1)!;
  expect(source.start).toHaveBeenCalledWith(0);
  expect(source.playbackRate.value).toBe(1.5);
  expect(source.stop).toHaveBeenCalledWith(10.25);
  expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.8, 10.235);
  expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 10.25);
  expect(source.disconnect).not.toHaveBeenCalled();
  const system = AudioSystem as unknown as { activeVoices: { soundId: string }[] };
  expect(system.activeVoices.map((voice) => voice.soundId)).toContain('turret_shot');
  source.onended!();
  expect(system.activeVoices).toHaveLength(0);
  expect(source.disconnect).toHaveBeenCalledOnce();
  expect(gain.disconnect).toHaveBeenCalledOnce();
  create.mockRestore();

  // Existing effects retain their full recordings unless their caller supplies a cap.
  AudioSystem.play('mortar_shot');
  expect(context.sources.at(-1)!.stop).not.toHaveBeenCalled();
  expect(context.gains.at(-1)!.gain.linearRampToValueAtTime).not.toHaveBeenCalled();
});

it('stops the turret channel with a short fade, replacing scheduled cutoffs without stopping other effects or music', async () => {
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init();
  AudioSystem.unlock();
  const context = ContextStub.instances[0];
  const music = context.sources.find((source) => (source as AudioNodeStub & { loop?: boolean }).loop)!;
  const first = new AudioNodeStub(), second = new AudioNodeStub();
  first.stop.mockImplementation(() => {});
  second.stop.mockImplementation(() => {});
  const create = vi.spyOn(context, 'createBufferSource').mockReturnValueOnce(first).mockReturnValueOnce(second);
  context.currentTime = 10;
  AudioSystem.play('turret_shot', { duration: 0.25 });
  const firstGain = context.gains.at(-1)!;
  context.currentTime = 10.2;
  AudioSystem.play('turret_shot', { duration: 0.25 });
  const secondGain = context.gains.at(-1)!;
  create.mockRestore();
  AudioSystem.play('laser_blast');
  const laser = context.sources.at(-1)!;
  context.currentTime = 10.21;
  AudioSystem.stopSound('turret_shot');
  for (const [source, gain] of [[first, firstGain], [second, secondGain]]) {
    expect(gain.gain.cancelScheduledValues).toHaveBeenCalledWith(10.21);
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 10.22);
    expect(source.stop.mock.calls.at(-1)![0]).toBeCloseTo(10.222, 6);
    source.onended!();
    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(gain.disconnect).toHaveBeenCalledOnce();
  }
  expect(laser.stop).not.toHaveBeenCalled();
  expect(music.stop).not.toHaveBeenCalled();
  const system = AudioSystem as unknown as { activeVoices: { soundId: string }[] };
  expect(system.activeVoices.map((voice) => voice.soundId)).toEqual(['laser_blast']);
  AudioSystem.stopSound('turret_shot');
  expect(first.stop).toHaveBeenCalledTimes(2);
  expect(second.stop).toHaveBeenCalledTimes(2);
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

it('varies weapon, critical and placement takes without repeating and shares the event throttle', async () => {
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init();
  AudioSystem.unlock();
  const context = ContextStub.instances[0];
  const random = vi.spyOn(Math, 'random').mockReturnValue(0);
  for (const id of ['archer_shot', 'soldier_shot', 'power_crit', 'unit_deploy'] as const) {
    AudioSystem.play(id);
    const first = context.sources.at(-1)!;
    AudioSystem.play(id);
    expect(context.sources.at(-1)).toBe(first);
    context.currentTime += 0.2;
    AudioSystem.play(id);
    expect(context.sources.at(-1)!.buffer).not.toBe(first.buffer);
    context.currentTime += 0.2;
  }
  random.mockRestore();
});

it('applies separate music overrides and mute to the selected scene', async () => {
  const { emptyConfig } = await import('../../configurator/config');
  const config = emptyConfig();
  config.sounds.music = { volume: 0.5 };
  config.sounds.music_battle = { url: '/assets/custom/battle.mp3', muted: true };
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => config,
    arrayBuffer: async () => new ArrayBuffer(0) })));
  const runtime = await import('../../configurator/runtime');
  await runtime.loadAssetConfig();
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init(); AudioSystem.unlock();
  const context = ContextStub.instances[0];
  expect(context.gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.06, 0, 0.08);
  AudioSystem.setMusicScene('battle');
  expect(context.gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.08);
  AudioSystem.setMusicScene('menu');
  expect(context.gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.06, 0, 0.08);
  expect(vi.mocked(fetch).mock.calls.map((call) => String(call[0]))).toContain('/assets/custom/battle.mp3');
});

it('replaces one shared-file event independently and applies its volume, pitch and mute', async () => {
  const { emptyConfig } = await import('../../configurator/config');
  const config = emptyConfig();
  config.sounds.card_play_1 = { url: '/assets/custom/card.wav', volume: 0.5, rate: 0.75 };
  config.sounds.archer_shot = { muted: true };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => config,
    arrayBuffer: async () => Object.assign(new ArrayBuffer(0), { url }) })));
  const runtime = await import('../../configurator/runtime');
  await runtime.loadAssetConfig();
  const { AudioSystem } = await import('./AudioSystem');
  await AudioSystem.init(); AudioSystem.unlock();
  const context = ContextStub.instances[0];
  AudioSystem.play('card_play_1', { volume: 1 });
  const custom = context.sources.at(-1)!;
  expect(custom.playbackRate.value).toBe(0.75);
  expect(context.gains.at(-1)!.gain.value).toBe(0.5);
  AudioSystem.play('card_play');
  expect(context.sources.at(-1)!.buffer).not.toBe(custom.buffer);
  const before = context.sources.length;
  AudioSystem.play('archer_shot');
  expect(context.sources.length).toBe(before);
  expect(vi.mocked(fetch).mock.calls.map((call) => String(call[0]))).toContain('/assets/custom/card.wav');
});
