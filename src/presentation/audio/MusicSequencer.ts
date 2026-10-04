export type MusicScene = 'menu' | 'battle' | 'victory' | 'defeat';
export type MusicTrack = 'menu' | 'battle';

interface PlayingTrack {
  track: MusicTrack;
  source: AudioBufferSourceNode;
  gain: GainNode;
  startedAt: number;
}

/** Scene-specific loops with crossfades and independent playback positions. */
export class MusicSequencer {
  private buffers = new Map<MusicTrack, AudioBuffer>();
  private offsets: Record<MusicTrack, number> = { menu: 0, battle: 0 };
  private active: PlayingTrack | null = null;
  private playing = new Set<PlayingTrack>();
  private filter: BiquadFilterNode;
  private roomGain: GainNode;
  private wanted = false;
  private track: MusicTrack = 'menu';

  constructor(private context: AudioContext, output: GainNode) {
    this.filter = context.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 0.65;
    this.roomGain = context.createGain();
    this.filter.connect(this.roomGain);
    this.roomGain.connect(output);
    this.setScene('menu');
  }

  setBuffer(buffer: AudioBuffer, track: MusicTrack = 'menu'): void {
    this.buffers.set(track, buffer);
    if (this.wanted) this.start();
  }

  setScene(scene: MusicScene): void {
    const battle = scene === 'battle';
    this.track = battle ? 'battle' : 'menu';
    this.filter.frequency.setTargetAtTime(battle ? 7000 : 4200, this.context.currentTime, 0.6);
    this.roomGain.gain.setTargetAtTime(battle ? 0.65 : 0.48, this.context.currentTime, 0.6);
    if (this.wanted) this.start();
  }

  start(): void {
    this.wanted = true;
    const buffer = this.buffers.get(this.track);
    if (this.active?.track === this.track || !buffer || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    // Finish older fades before another transition, such as rapid pause taps.
    for (const old of this.playing) {
      if (old !== this.active) old.source.stop();
    }
    if (this.active) {
      const old = this.active;
      this.offsets[old.track] += now - old.startedAt;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + 0.6);
      old.source.stop(now + 0.6);
    }
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 0.6);
    source.connect(gain);
    gain.connect(this.filter);
    const playing = { track: this.track, source, gain, startedAt: now };
    this.active = playing;
    this.playing.add(playing);
    source.onended = () => {
      this.playing.delete(playing);
      source.disconnect();
      gain.disconnect();
    };
    source.start(0, this.offsets[this.track] % buffer.duration);
  }

  stop(): void {
    this.wanted = false;
    if (this.active) this.offsets[this.active.track] += this.context.currentTime - this.active.startedAt;
    this.active = null;
    for (const playing of this.playing) playing.source.stop();
    this.playing.clear();
  }
}
