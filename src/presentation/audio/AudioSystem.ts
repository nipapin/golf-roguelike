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
}

const DEFAULT_SETTINGS: AudioSettings = {
  soundEnabled: true,
  musicEnabled: true,
};

const STORAGE_KEY = 'golf_rogue_audio_settings';

class AudioSystemClass {
  private context: AudioContext | null = null;
  private sounds: Map<SoundId, AudioBuffer> = new Map();
  private settings: AudioSettings = DEFAULT_SETTINGS;
  private unlocked: boolean = false;
  private loadPromise: Promise<void> | null = null;
  private initialized: boolean = false;

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      this.settings = DEFAULT_SETTINGS;
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
      card_play: 'card-place-1',
      card_play_1: 'card-place-1',
      card_play_2: 'card-place-2',
      card_play_3: 'card-place-3',
      card_draw: 'card-slide',
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
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
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

    await Promise.all(loadPromises);
    this.initialized = true;
  }

  private async loadSound(basePath: string): Promise<AudioBuffer | null> {
    if (!this.context) return null;

    // Try .ogg first (smaller, better quality), then .mp3 (Safari fallback)
    const extensions = ['.ogg', '.mp3'];
    
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
    if (this.unlocked) return;
    
    // Create context if not yet created
    if (!this.context) {
      try {
        this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        return;
      }
    }

    // Resume context if suspended
    if (this.context.state === 'suspended') {
      this.context.resume();
    }

    // Play a silent buffer to unlock
    const buffer = this.context.createBuffer(1, 1, 22050);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.start(0);

    this.unlocked = true;
    
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
      gainNode.gain.value = options?.volume ?? 0.5;

      source.connect(gainNode);
      gainNode.connect(this.context.destination);
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
    const pitchShift = Math.min(comboCount * 0.05, 0.4);
    this.play(soundId, { pitchShift, volume: 0.5 });
  }

  // Settings getters/setters
  get isSoundEnabled(): boolean {
    return this.settings.soundEnabled;
  }

  set isSoundEnabled(value: boolean) {
    this.settings.soundEnabled = value;
    this.saveSettings();
  }

  get isMusicEnabled(): boolean {
    return this.settings.musicEnabled;
  }

  set isMusicEnabled(value: boolean) {
    this.settings.musicEnabled = value;
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
