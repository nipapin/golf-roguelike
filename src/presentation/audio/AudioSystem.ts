import { SOUND_CATALOG, SOUND_VARIANTS, MUSIC_CATALOG } from '../../configurator/sounds';
import { assetUrl, soundOverride, configuredMix } from '../../configurator/runtime';
import { MusicSequencer, type MusicScene } from './MusicSequencer';
import type { PowerType } from '../../core/types';

/**
 * AudioSystem - Manages game audio with iOS Safari compatibility
 * User-supplied recordings with archived cues for events outside the new pack.
 */

export type SoundId =
  | 'archer_shot'
  | 'soldier_shot'
  | 'unit_deploy'
  | 'turret_reload'
  | 'power_crit'
  | 'power_heal'
  | 'power_guard'
  | 'power_gold'
  | 'power_bomb'
  | 'power_wild'
  | 'power_echo'
  | 'power_red_joker'
  | 'power_black_joker'
  | 'card_shuffle'
  | 'footstep_1'
  | 'footstep_2'
  | 'orc_growl'
  | 'orc_hit'
  | 'orc_death'
  | 'turret_shot'
  | 'mortar_shot'
  | 'laser_blast'
  | 'card_play'
  | 'card_play_1'
  | 'card_play_2'
  | 'card_play_3'
  | 'card_draw'
  | 'invalid_tap'
  | 'combo_up'
  | 'enemy_hit'
  | 'player_hit'
  | 'shield'
  | 'enemy_death'
  | 'victory'
  | 'defeat'
  | 'button_tap'
  | 'reward_pick';

interface AudioSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  soundVolume: number;
  musicVolume: number;
}

const DEFAULT_SETTINGS: AudioSettings = {
  soundEnabled: true,
  musicEnabled: true,
  soundVolume: 0.22,
  musicVolume: 0.12,
};

interface ActiveVoice {
  soundId: SoundId;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export interface SoundOptions {
  pitchShift?: number;
  volume?: number;
  /** Maximum playback time in seconds, independent of the recording's length. */
  duration?: number;
}

// Event throttles are independent: an arrow must never suppress an arc cannon.
const SOUND_LIMITS: Partial<Record<SoundId, { interval: number; voices: number }>> = {
  turret_shot: { interval: 0.18, voices: 2 },
  mortar_shot: { interval: 0.08, voices: 2 },
  archer_shot: { interval: 0.08, voices: 2 },
  soldier_shot: { interval: 0.08, voices: 2 },
  player_hit: { interval: 0.08, voices: 2 },
  laser_blast: { interval: 0.12, voices: 1 },
  combo_up: { interval: 0.035, voices: 2 },
  unit_deploy: { interval: 0.08, voices: 2 },
  turret_reload: { interval: 0.08, voices: 1 },
  orc_growl: { interval: 5, voices: 1 },
  orc_hit: { interval: 0.4, voices: 1 },
  orc_death: { interval: 0.6, voices: 1 },
};
const SOUND_LEVELS: Partial<Record<SoundId, number>> = {
  button_tap: 0.4,
  invalid_tap: 0.4,
  card_draw: 0.75,
  victory: 0.7,
  defeat: 0.65,
  reward_pick: 0.65,
};

const STORAGE_KEY = 'golf_rogue_audio_settings';

class AudioSystemClass {
  private context: AudioContext | null = null;
  private sounds: Map<SoundId, AudioBuffer[]> = new Map();
  private lastVariant = new Map<SoundId, number>();
  private settings: AudioSettings = { ...DEFAULT_SETTINGS };
  private soundBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private music: MusicSequencer | null = null;
  private musicScene: MusicScene = 'menu';
  private unlocked: boolean = false;
  private loadPromise: Promise<void> | null = null;
  private initialized: boolean = false;
  private activeVoices: ActiveVoice[] = [];
  private lastPlayed = new Map<SoundId, number>();

  constructor() {
    this.loadSettings();
    if (typeof document !== 'undefined')
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.music?.stop();
        else this.updateMix();
      });
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const saved = JSON.parse(stored);
        this.settings = {
          soundEnabled: typeof saved.soundEnabled === 'boolean' ? saved.soundEnabled : true,
          musicEnabled: typeof saved.musicEnabled === 'boolean' ? saved.musicEnabled : true,
          soundVolume: this.clampVolume(saved.soundVolume, DEFAULT_SETTINGS.soundVolume),
          musicVolume: this.clampVolume(saved.musicVolume, DEFAULT_SETTINGS.musicVolume),
        };
      }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage errors
    }
  }

  async init(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.loadAllSounds();
    return this.loadPromise;
  }

  private async loadAllSounds(): Promise<void> {
    // Try to create audio context
    try {
      this.ensureContext();
    } catch {
      console.warn('Web Audio API not supported');
      return;
    }

    // Load each sound (gracefully handle missing files)
    const bufferLoads = new Map<string, Promise<AudioBuffer | null>>();
    const loadBuffer = (url: string) => {
      let pending = bufferLoads.get(url);
      if (!pending) {
        pending = this.loadSound(url);
        bufferLoads.set(url, pending);
      }
      return pending;
    };
    const loadPromises = Object.entries(SOUND_CATALOG).map(async ([id, sound]) => {
      const override = soundOverride(id).url;
      const urls = override ? [override] : [sound.url, ...(SOUND_VARIANTS[id as SoundId] ?? [])].map(assetUrl);
      try {
        const buffers = (await Promise.all(urls.map(loadBuffer))).filter((buffer): buffer is AudioBuffer => buffer !== null);
        if (buffers.length) this.sounds.set(id as SoundId, buffers);
      } catch {
        // Silently ignore missing audio files for graceful degradation
      }
    });

    await Promise.all([
      ...loadPromises,
      ...Object.entries(MUSIC_CATALOG).map(async ([id, track]) => {
        const buffer = await loadBuffer(soundOverride(id).url ?? assetUrl(track.url));
        if (buffer) this.music?.setBuffer(buffer, id === 'music_battle' ? 'battle' : 'menu');
      }),
    ]);
    this.initialized = true;
  }

  private async loadSound(basePath: string): Promise<AudioBuffer | null> {
    if (!this.context) return null;

    // Explicit extensions are used as-is; extensionless paths try MP3 then OGG.
    const candidates = /\.(mp3|ogg|wav|m4a)$/i.test(basePath)
      ? [basePath]
      : [basePath + '.mp3', basePath + '.ogg'];

    for (const url of candidates) {
      try {
        const response = await fetch(url);
        if (!response.ok) continue;

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        return audioBuffer;
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Unlock audio on first user interaction (required for iOS Safari)
   */
  unlock(): void {
    // Create context if not yet created
    if (!this.context) {
      try {
        this.ensureContext();
      } catch {
        return;
      }
    }

    if (!this.context) return;
    // iOS can suspend the context again after backgrounding. Retry on each gesture.
    if (this.context.state === 'suspended') {
      void this.context
        .resume()
        .then(() => this.updateMix())
        .catch(() => {});
    }

    // Play a silent buffer to unlock
    const buffer = this.context.createBuffer(1, 1, 22050);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.start(0);

    this.unlocked = true;
    this.updateMix();

    // Load sounds if not already done
    if (!this.initialized) {
      this.init();
    }
  }

  /**
   * Play a sound effect
   */
  play(soundId: SoundId, options?: SoundOptions): void {
    if (!this.settings.soundEnabled || !this.context || !this.unlocked) return;

    const custom = soundOverride(soundId);
    if (custom.muted) return;
    const buffers = this.sounds.get(soundId);
    if (!buffers?.length) return;

    const limits = SOUND_LIMITS[soundId] ?? { interval: 0.025, voices: 3 };
    const now = this.context.currentTime;
    if (now - (this.lastPlayed.get(soundId) ?? -Infinity) < limits.interval) return;
    this.lastPlayed.set(soundId, now);
    const matching = this.activeVoices.filter((voice) => voice.soundId === soundId);
    if (matching.length >= limits.voices) this.retireVoice(matching[0]);
    if (this.activeVoices.length >= 24) this.retireVoice(this.activeVoices[0]);

    try {
      // Random takes without immediately repeating the previous take.
      const previous = this.lastVariant.get(soundId);
      let variant = Math.floor(Math.random() * Math.max(1, buffers.length - (previous === undefined ? 0 : 1)));
      if (previous !== undefined && variant >= previous) variant++;
      if (buffers.length === 1) variant = 0;
      this.lastVariant.set(soundId, variant);
      const source = this.context.createBufferSource();
      source.buffer = buffers[variant];

      // Apply pitch shift if specified
      source.playbackRate.value = (1 + (options?.pitchShift ?? 0)) * (custom.rate ?? 1);

      // Apply volume
      const gainNode = this.context.createGain();
      gainNode.gain.value = this.clampVolume(options?.volume, SOUND_LEVELS[soundId] ?? 0.65) * (custom.volume ?? 1);

      source.connect(gainNode);
      gainNode.connect(this.soundBus!);
      const voice = { soundId, source, gain: gainNode };
      this.activeVoices.push(voice);
      source.onended = () => {
        this.activeVoices = this.activeVoices.filter((active) => active !== voice);
        source.disconnect();
        gainNode.disconnect();
      };
      source.start(0);
      const duration = options?.duration;
      if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0 &&
        duration < source.buffer.duration / source.playbackRate.value) {
        // A multi-shot recording is a single shot here; fade before its precise cutoff.
        const end = now + duration;
        const fadeStart = end - Math.min(0.015, duration);
        gainNode.gain.setValueAtTime(gainNode.gain.value, fadeStart);
        gainNode.gain.linearRampToValueAtTime(0, end);
        source.stop(end);
      }
    } catch (err) {
      console.warn('Error playing sound:', err);
    }
  }

  private retireVoice(voice: ActiveVoice): void {
    this.activeVoices = this.activeVoices.filter((active) => active !== voice);
    const at = this.context!.currentTime;
    voice.gain.gain.cancelScheduledValues(at);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, at);
    voice.gain.gain.linearRampToValueAtTime(0, at + 0.01);
    voice.source.stop(at + 0.012);
  }

  /** Stop one event channel without interrupting music or other effects. */
  stopSound(soundId: SoundId): void {
    for (const voice of this.activeVoices.filter((active) => active.soundId === soundId))
      this.retireVoice(voice);
  }

  /**
   * Play card sound with combo-based pitch shift
   * Randomly selects from 3 card place variants
   */
  playCardSound(comboCount: number): void {
    const variants: SoundId[] = ['card_play_1', 'card_play_2', 'card_play_3'];
    const soundId = variants[Math.floor(Math.random() * variants.length)];
    const pitchShift = Math.min(comboCount * 0.008, 0.06);
    this.play(soundId, { pitchShift, volume: 1 });
    this.playCombo(comboCount);
  }

  playCombo(count: number): void {
    if (count < 2) return;
    // A short xylophone cue rises with the chain; the first card remains plain foley.
    this.play('combo_up', {
      pitchShift: 2 ** (Math.min(Math.max(0, count - 1), 14) / 24) - 1,
      volume: Math.min(0.35 + (count - 2) * 0.025, 0.6),
    });
  }

  playPower(power: PowerType | 'RED_JOKER' | 'BLACK_JOKER'): void {
    const samples: Record<PowerType | 'RED_JOKER' | 'BLACK_JOKER', SoundId> = {
      CRIT: 'power_crit',
      HEAL: 'power_heal',
      GUARD: 'power_guard',
      GOLD: 'power_gold',
      BOMB: 'power_bomb',
      ECHO: 'power_echo',
      RED_JOKER: 'power_red_joker',
      BLACK_JOKER: 'power_black_joker',
    };
    this.play(samples[power], {
      volume: power === 'BOMB' || power === 'BLACK_JOKER' ? 0.85 : 0.7,
    });
  }

  private clampVolume(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(1, value))
      : fallback;
  }

  private ensureContext(): void {
    if (this.context) return;
    const Audio =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) throw new Error('Web Audio unavailable');
    this.context = new Audio();
    this.soundBus = this.context.createGain();
    this.musicBus = this.context.createGain();
    // Control extreme sums at high slider levels. This is a compressor, not a true-peak ceiling.
    const master = this.context.createDynamicsCompressor();
    master.threshold.value = -6;
    master.knee.value = 3;
    master.ratio.value = 20;
    master.attack.value = 0.003;
    master.release.value = 0.12;
    const headroom = this.context.createGain();
    headroom.gain.value = 0.85;
    this.soundBus.connect(master);
    this.musicBus.connect(master);
    master.connect(headroom);
    headroom.connect(this.context.destination);
    this.music = new MusicSequencer(this.context, this.musicBus);
    this.music.setScene(this.musicScene);
    this.updateMix();
  }

  private updateMix(): void {
    if (!this.context || !this.soundBus || !this.musicBus) return;
    const musicOverride = soundOverride(this.musicScene === 'battle' ? 'music_battle' : 'music');
    this.soundBus.gain.setTargetAtTime(
      this.settings.soundEnabled ? this.settings.soundVolume * configuredMix().sound : 0,
      this.context.currentTime,
      0.04
    );
    this.musicBus.gain.setTargetAtTime(
      this.settings.musicEnabled && !musicOverride.muted ? this.settings.musicVolume * configuredMix().music * (musicOverride.volume ?? 1) : 0,
      this.context.currentTime,
      0.08
    );
    if (this.unlocked && this.settings.musicEnabled && !document.hidden) this.music?.start();
    else this.music?.stop();
  }

  setMusicScene(scene: MusicScene): void {
    this.musicScene = scene;
    this.music?.setScene(scene);
    this.updateMix();
  }

  get soundVolume(): number {
    return this.settings.soundVolume;
  }
  set soundVolume(value: number) {
    this.settings.soundVolume = this.clampVolume(value, DEFAULT_SETTINGS.soundVolume);
    this.updateMix();
    this.saveSettings();
  }
  get musicVolume(): number {
    return this.settings.musicVolume;
  }
  set musicVolume(value: number) {
    this.settings.musicVolume = this.clampVolume(value, DEFAULT_SETTINGS.musicVolume);
    this.updateMix();
    this.saveSettings();
  }

  // Settings getters/setters
  get isSoundEnabled(): boolean {
    return this.settings.soundEnabled;
  }

  set isSoundEnabled(value: boolean) {
    this.settings.soundEnabled = value;
    this.updateMix();
    this.saveSettings();
  }

  get isMusicEnabled(): boolean {
    return this.settings.musicEnabled;
  }

  set isMusicEnabled(value: boolean) {
    this.settings.musicEnabled = value;
    this.updateMix();
    this.saveSettings();
  }

  toggleSound(): boolean {
    this.isSoundEnabled = !this.isSoundEnabled;
    return this.isSoundEnabled;
  }

  toggleMusic(): boolean {
    this.isMusicEnabled = !this.isMusicEnabled;
    return this.isMusicEnabled;
  }

  /**
   * Check if audio has been successfully initialized
   */
  isReady(): boolean {
    return this.initialized && this.unlocked;
  }
}

export const AudioSystem = new AudioSystemClass();
