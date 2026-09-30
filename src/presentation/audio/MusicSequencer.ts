export type MusicScene = 'menu' | 'battle' | 'victory' | 'defeat';
/** One uninterrupted soundtrack; noncombat scenes sound like the room next door. */
export class MusicSequencer {
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private filter: BiquadFilterNode;
  private roomGain: GainNode;
  private wanted = false;
  private offset = 0;
  private startedAt = 0;
  constructor(private context: AudioContext, output: GainNode) {
    this.filter = context.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.Q.value = .65;
    this.roomGain = context.createGain(); this.filter.connect(this.roomGain); this.roomGain.connect(output);
    this.setScene('menu');
  }
  setBuffer(buffer: AudioBuffer): void { this.buffer = buffer; if (this.wanted) this.start(); }
  setScene(scene: MusicScene): void {
    const battle = scene === 'battle';
    this.filter.frequency.setTargetAtTime(battle ? 18000 : 650, this.context.currentTime, .25);
    this.roomGain.gain.setTargetAtTime(battle ? 1 : .48, this.context.currentTime, .25);
  }
  start(): void {
    this.wanted = true;
    if (this.source || !this.buffer || this.context.state !== 'running') return;
    const source = this.context.createBufferSource();
    source.buffer = this.buffer; source.loop = true; source.connect(this.filter);
    this.startedAt = this.context.currentTime;
    source.start(0, this.offset % this.buffer.duration); this.source = source;
    source.onended = () => source.disconnect();
  }
  stop(): void {
    this.wanted = false;
    if (!this.source) return;
    this.offset += this.context.currentTime - this.startedAt;
    const source = this.source; this.source = null; source.stop();
  }
}
