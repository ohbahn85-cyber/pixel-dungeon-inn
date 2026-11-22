/**
 * Web Audio API 기반 8비트 레트로 효과음 합성기 (외부 음원 파일 없음)
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (!this.muted) {
      this.playCoin();
    }
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'square',
    delaySec = 0,
    volume = 0.06
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const startTime = ctx.currentTime + delaySec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + durationSec);
    } catch {
      // 오디오 재생 제한 무시
    }
  }

  /** 코인/서빙 효과음 */
  public playCoin(): void {
    this.playTone(987.77, 0.06, 'square', 0, 0.05); // B5
    this.playTone(1318.51, 0.11, 'square', 0.05, 0.05); // E6
  }

  /** 전리품 팁 획득 효과음 */
  public playLoot(): void {
    this.playTone(783.99, 0.06, 'triangle', 0, 0.07); // G5
    this.playTone(987.77, 0.06, 'triangle', 0.05, 0.07); // B5
    this.playTone(1174.66, 0.06, 'triangle', 0.1, 0.07); // D6
    this.playTone(1567.98, 0.16, 'square', 0.15, 0.06); // G6
  }

  /** 업그레이드 구매 효과음 */
  public playUpgrade(): void {
    this.playTone(523.25, 0.07, 'square', 0, 0.05); // C5
    this.playTone(659.25, 0.07, 'square', 0.06, 0.05); // E5
    this.playTone(783.99, 0.12, 'square', 0.12, 0.06); // G5
  }

  /** 여관 등급 상승 팡파르 */
  public playLevelUp(): void {
    this.playTone(523.25, 0.08, 'square', 0, 0.06); // C5
    this.playTone(659.25, 0.08, 'square', 0.08, 0.06); // E5
    this.playTone(783.99, 0.08, 'square', 0.16, 0.06); // G5
    this.playTone(1046.5, 0.22, 'square', 0.24, 0.07); // C6
  }

  /** 랜덤 이벤트 발생 효과음 */
  public playEvent(): void {
    this.playTone(587.33, 0.08, 'triangle', 0, 0.07); // D5
    this.playTone(880.0, 0.14, 'triangle', 0.08, 0.07); // A5
  }
}
