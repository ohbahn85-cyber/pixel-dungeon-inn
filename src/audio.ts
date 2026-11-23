class SoundEffects {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getCtx(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playTone(freq: number, durationMs: number, type: OscillatorType = 'square', vol = 0.06): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  }

  public playClick(): void {
    this.playTone(660, 45, 'triangle', 0.05);
  }

  public playSlotTick(): void {
    this.playTone(440 + Math.random() * 220, 30, 'square', 0.035);
  }

  public playSlotStop(): void {
    this.playTone(587.33, 70, 'triangle', 0.07);
  }

  public playSuccess(): void {
    this.playTone(523.25, 80, 'triangle', 0.07);
    setTimeout(() => this.playTone(659.25, 80, 'triangle', 0.07), 70);
    setTimeout(() => this.playTone(783.99, 130, 'triangle', 0.08), 140);
  }

  public playJackpot(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 140, 'square', 0.08), i * 80);
    });
  }

  public playFailStop(): void {
    this.playTone(311.13, 120, 'sawtooth', 0.06);
    setTimeout(() => this.playTone(233.08, 200, 'sawtooth', 0.06), 110);
  }

  public playCoin(): void {
    this.playTone(987.77, 50, 'sine', 0.05);
    setTimeout(() => this.playTone(1318.51, 90, 'sine', 0.06), 45);
  }
}

export const sfx = new SoundEffects();
