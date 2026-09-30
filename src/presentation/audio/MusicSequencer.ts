export type MusicScene = 'menu' | 'battle' | 'victory' | 'defeat';
/** Recorded themes share one context; transitions fade, results play once. */
export class MusicSequencer {
  private source: AudioBufferSourceNode | null = null;
  private buffers = new Map<MusicScene, AudioBuffer>();
  private scene: MusicScene = 'menu';
  private wanted = false;
  private finished = false;
  private offset = 0;
  private startedAt = 0;
  constructor(private context: AudioContext, private output: GainNode) {}
  setBuffer(scene: MusicScene, buffer: AudioBuffer): void { this.buffers.set(scene, buffer); if (this.wanted) this.start(); }
  setScene(scene: MusicScene): void {
    if (this.scene === scene) return;
    const wanted = this.wanted;
    this.stop(); this.scene = scene; this.offset = 0; this.finished = false;
    if (wanted) this.start();
  }
  start(): void {
    this.wanted = true;
    const buffer = this.buffers.get(this.scene);
    if (this.source || !buffer || this.finished || this.context.state !== 'running') return;
    const source = this.context.createBufferSource();
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0, this.context.currentTime);
    envelope.gain.linearRampToValueAtTime(1, this.context.currentTime + .3);
    source.buffer = buffer; source.loop = this.scene === 'menu' || this.scene === 'battle';
    source.connect(envelope); envelope.connect(this.output);
    this.startedAt = this.context.currentTime;
    source.start(0, this.offset % buffer.duration);
    this.source = source;
    source.onended = () => {
      source.disconnect(); envelope.disconnect();
      if (this.source === source) { this.source = null; this.finished = true; }
    };
  }
  stop(): void {
    this.wanted = false;
    if (!this.source) return;
    this.offset += this.context.currentTime - this.startedAt;
    const source = this.source; this.source = null;
    source.stop();
  }
}
