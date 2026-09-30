import { MusicSequencer, type MusicScene } from './MusicSequencer';
import type { PowerType } from '../../core/types';

/**
 * AudioSystem - Manages game audio with iOS Safari compatibility
 * Kenney.nl CC0 sounds in public/audio/
 */

export type SoundId =
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
  musicVolume: 0.18,
};

const STORAGE_KEY = 'golf_rogue_audio_settings';

class AudioSystemClass {
  private context: AudioContext | null = null;
  private sounds: Map<SoundId, AudioBuffer> = new Map();
  private settings: AudioSettings = { ...DEFAULT_SETTINGS };
  private soundBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private music: MusicSequencer | null = null;
  private musicScene: MusicScene = 'menu';
  private unlocked: boolean = false;
  private loadPromise: Promise<void> | null = null;
  private initialized: boolean = false;

  constructor() {
    this.loadSettings();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
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
    // Sound file mapping - Kenney.nl CC0 sounds
    const soundFiles: Record<SoundId, string> = {
      card_play: 'card-tap-1',
      card_play_1: 'card-tap-1',
      card_play_2: 'card-tap-2',
      card_play_3: 'card-tap-3',
      card_draw: 'card-tap-2',
      invalid_tap: 'error',
      combo_up: 'combo-up',
      enemy_hit: 'hit-enemy',
      player_hit: 'hit-player',
      shield: 'shield',
      enemy_death: 'death',
      victory: 'victory',
      defeat: 'defeat',
      button_tap: 'click',
      reward_pick: 'reward',
    };

    // Try to create audio context
    try {
      this.ensureContext();
    } catch {
      console.warn('Web Audio API not supported');
      return;
    }

    // Load each sound (gracefully handle missing files)
    const loadPromises = Object.entries(soundFiles).map(async ([id, filename]) => {
      try {
        const buffer = await this.loadSound(`/audio/${filename}`);
        if (buffer) {
          this.sounds.set(id as SoundId, buffer);
        }
      } catch {
        // Silently ignore missing audio files for graceful degradation
      }
    });

    await Promise.all([...loadPromises, this.loadSound('/audio/battle-orchestral').then(buffer => { if (buffer) this.music?.setBuffer(buffer); })]);
    this.initialized = true;
  }

  private async loadSound(basePath: string): Promise<AudioBuffer | null> {
    if (!this.context) return null;

    // Try .ogg first (smaller, better quality), then .mp3 (Safari fallback)
    const extensions = ['.mp3', '.ogg'];
    
    for (const ext of extensions) {
      try {
        const response = await fetch(basePath + ext);
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
      void this.context.resume().then(() => this.updateMix()).catch(() => {});
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
  play(soundId: SoundId, options?: { pitchShift?: number; volume?: number }): void {
    if (!this.settings.soundEnabled || !this.context || !this.unlocked) return;

    const buffer = this.sounds.get(soundId);
    if (!buffer) return;

    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer;

      // Apply pitch shift if specified
      if (options?.pitchShift) {
        source.playbackRate.value = 1 + options.pitchShift;
      }

      // Apply volume
      const gainNode = this.context.createGain();
      gainNode.gain.value = options?.volume ?? 0.65;

      source.connect(gainNode);
      gainNode.connect(this.soundBus!);
      source.onended = () => { source.disconnect(); gainNode.disconnect(); };
      source.start(0);
    } catch (err) {
      console.warn('Error playing sound:', err);
    }
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

  private tone(frequency: number, delay: number, duration: number, type: OscillatorType, volume: number): void {
    if (!this.context || !this.unlocked || !this.settings.soundEnabled) return;
    const at = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, at);
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(volume, at + .008);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(envelope); envelope.connect(this.soundBus!);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(at); oscillator.stop(at + duration + .01);
  }

  playCombo(count: number): void {
    // A semitone step per card: rising energy without stretching the card sample.
    const root = 220 * 2 ** (Math.min(count - 1, 18) / 12);
    this.tone(root, .02, .12, 'triangle', .3);
    this.tone(root * 2, .025, .08, 'sine', .13);
  }

  playPower(power: PowerType | 'RED_JOKER' | 'BLACK_JOKER'): void {
    const phrases: Record<PowerType | 'RED_JOKER' | 'BLACK_JOKER', [number[], OscillatorType, number]> = {
      CRIT: [[130, 520], 'sawtooth', .09], HEAL: [[523, 659, 784], 'sine', .22],
      GUARD: [[180, 270, 360], 'triangle', .15], GOLD: [[1046, 1318], 'sine', .18],
      BOMB: [[90, 55, 35], 'sawtooth', .16], WILD: [[330, 660, 990], 'triangle', .12],
      ECHO: [[440, 440, 440], 'sine', .13], RED_JOKER: [[392, 523, 659, 784], 'sine', .2],
      BLACK_JOKER: [[110, 220, 880], 'sawtooth', .15],
    };
    const [notes, type, duration] = phrases[power];
    notes.forEach((note, i) => this.tone(note, i * .055, duration, type, power === 'BOMB' ? .28 : .18));
  }

  private clampVolume(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
  }

  private ensureContext(): void {
    if (this.context) return;
    const Audio = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) throw new Error('Web Audio unavailable');
    this.context = new Audio();
    this.soundBus = this.context.createGain();
    this.musicBus = this.context.createGain();
    this.soundBus.connect(this.context.destination);
    this.musicBus.connect(this.context.destination);
    this.music = new MusicSequencer(this.context, this.musicBus);
    this.music.setScene(this.musicScene);
    this.updateMix();
  }

  private updateMix(): void {
    if (!this.context || !this.soundBus || !this.musicBus) return;
    this.soundBus.gain.setTargetAtTime(this.settings.soundEnabled ? this.settings.soundVolume : 0, this.context.currentTime, 0.04);
    this.musicBus.gain.setTargetAtTime(this.settings.musicEnabled ? this.settings.musicVolume : 0, this.context.currentTime, 0.08);
    if (this.unlocked && this.settings.musicEnabled && !document.hidden) this.music?.start();
    else this.music?.stop();
  }

  setMusicScene(scene: MusicScene): void { this.musicScene = scene; this.music?.setScene(scene); this.updateMix(); }

  get soundVolume(): number { return this.settings.soundVolume; }
  set soundVolume(value: number) {
    this.settings.soundVolume = this.clampVolume(value, DEFAULT_SETTINGS.soundVolume);
    this.updateMix(); this.saveSettings();
  }
  get musicVolume(): number { return this.settings.musicVolume; }
  set musicVolume(value: number) {
    this.settings.musicVolume = this.clampVolume(value, DEFAULT_SETTINGS.musicVolume);
    this.updateMix(); this.saveSettings();
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
