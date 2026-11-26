import {
  AnimState,
  FacingDir,
  renderPixelArtCharacter,
} from './spriteStack';
import './style.css';

class FourWayPixelArtSheet {
  private state: AnimState = 'idle';
  private canvases: Record<FacingDir, HTMLCanvasElement> = {} as Record<
    FacingDir,
    HTMLCanvasElement
  >;

  public init(): void {
    this.canvases = {
      front: document.getElementById('canvas-front') as HTMLCanvasElement,
      back: document.getElementById('canvas-back') as HTMLCanvasElement,
      left: document.getElementById('canvas-left') as HTMLCanvasElement,
      right: document.getElementById('canvas-right') as HTMLCanvasElement,
    };

    document.querySelectorAll('[data-state]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state = btn.getAttribute('data-state') as AnimState;
        document.querySelectorAll('[data-state]').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
      });
    });

    requestAnimationFrame((now) => this.loop(now));
  }

  private loop(now: number): void {
    const fps = this.state === 'idle' ? 3.2 : this.state === 'walk' ? 6.5 : 5.5;
    const frameIdx = Math.floor((now / 1000) * fps) % 4;

    const dirs: FacingDir[] = ['front', 'back', 'left', 'right'];
    for (const dir of dirs) {
      const canvas = this.canvases[dir];
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const w = canvas.width;
      const h = canvas.height;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);

      // 1. 확대 검수용 (6배 정수 픽셀 스케일)
      renderPixelArtCharacter(
        ctx,
        dir,
        this.state,
        frameIdx,
        Math.floor(w * 0.5),
        Math.floor(h * 0.72),
        6
      );

      // 2. 하단 우측에 실제 인게임 크기(2배 픽셀 스케일) 비교 미니 프리뷰 표시
      ctx.fillStyle = 'rgba(20, 15, 32, 0.72)';
      ctx.fillRect(w - 76, h - 76, 68, 68);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w - 76, h - 76, 68, 68);
      renderPixelArtCharacter(
        ctx,
        dir,
        this.state,
        frameIdx,
        w - 42,
        h - 14,
        2
      );

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px "Pretendard", "Noto Sans KR", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('24×28 도트 (6x 확대)', 12, h - 14);
    }

    requestAnimationFrame((n) => this.loop(n));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const sheet = new FourWayPixelArtSheet();
  sheet.init();
});
