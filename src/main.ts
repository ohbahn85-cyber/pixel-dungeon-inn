import {
  AnimState,
  drawBlacksmithCharacter,
  FacingDir,
  getBlacksmithPose,
} from './spriteStack';
import './style.css';

class FourWayCharacterSheet {
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
    const t = now / 1000;
    const pose = getBlacksmithPose(this.state, t);

    const dirs: FacingDir[] = ['front', 'back', 'left', 'right'];
    for (const dir of dirs) {
      const canvas = this.canvases[dir];
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const cx = Math.floor(w * 0.5);
      const groundY = Math.floor(h * 0.78);

      // 발판 타일
      this.drawPedestal(ctx, cx, groundY + 6);

      // 캐릭터 4방향 렌더링
      drawBlacksmithCharacter(ctx, dir, pose, cx, groundY, 1.55);
    }

    requestAnimationFrame((n) => this.loop(n));
  }

  private drawPedestal(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + 7, 74, 28, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#451a03';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#231512';
    ctx.stroke();

    const grad = ctx.createRadialGradient(cx - 15, cy - 8, 5, cx, cy, 74);
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.7, '#f59e0b');
    grad.addColorStop(1, '#b45309');

    ctx.beginPath();
    ctx.ellipse(cx, cy, 74, 28, 0, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#231512';
    ctx.stroke();
    ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const sheet = new FourWayCharacterSheet();
  sheet.init();
});
