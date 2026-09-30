/** Original, quiet dungeon loop. One shared Web Audio clock; no downloaded track. */
export class MusicSequencer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private step = 0;
  private voices = new Set<OscillatorNode>();

  constructor(private context: AudioContext, private output: GainNode) {}

  start(): void {
    if (this.timer) return;
    this.nextBeat = this.context.currentTime + 0.04;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 100);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const voice of this.voices) {
      try { voice.stop(); } catch { /* Already ended. */ }
    }
    this.voices.clear();
  }

  private note(midi: number, when: number, duration: number, volume: number, type: OscillatorType): void {
    const voice = this.context.createOscillator();
    const envelope = this.context.createGain();
    voice.type = type;
    voice.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(0, when);
    envelope.gain.linearRampToValueAtTime(volume, when + 0.025);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    voice.connect(envelope);
    envelope.connect(this.output);
    this.voices.add(voice);
    voice.onended = () => {
      this.voices.delete(voice);
      voice.disconnect();
      envelope.disconnect();
    };
    voice.start(when);
    voice.stop(when + duration + 0.03);
  }

  private schedule(): void {
    if (this.context.state !== 'running') return;
    const eighth = 60 / 104 / 2;
    if (this.nextBeat < this.context.currentTime) this.nextBeat = this.context.currentTime + 0.04;
    while (this.nextBeat < this.context.currentTime + 0.25) {
      const chords = [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]];
      const chord = chords[Math.floor(this.step / 16) % chords.length];
      const offset = this.step % 8;
      this.note(chord[[0, 2, 1, 3, 2, 1, 3, 1][offset]] + 12, this.nextBeat, 0.32, 0.14, 'triangle');
      if (offset % 4 === 0) this.note(chord[0] - 12, this.nextBeat, 0.7, 0.3, 'sine');
      if (offset % 2 === 0) this.note(30, this.nextBeat, 0.09, 0.2, 'sine');
      this.step++;
      this.nextBeat += eighth;
    }
  }
}
