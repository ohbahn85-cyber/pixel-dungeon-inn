import {
  AnimActionId,
  ARCHETYPES,
  ArchetypeMeta,
  buildSmoothCharacterLayers,
  CharacterArchetypeId,
  computeAnimPose,
  renderSpriteStackCharacter,
} from './spriteStack';
import './style.css';

interface SandboxWalker {
  meta: ArchetypeMeta;
  gx: number;
  gy: number;
  tx: number;
  ty: number;
  angleRad: number;
  targetAngleRad: number;
  action: AnimActionId;
  timer: number;
  speech: string | null;
  speechTimer: number;
  phase: number;
}

class SpriteStackCharacterStudio {
  private selectedId: CharacterArchetypeId = 'blacksmith';
  private selectedAction: AnimActionId = 'work';
  private rotationDeg = 20;
  private autoRotate = true;
  private explodeFactor = 1.0;
  private pixelScale = 5;
  private showOutline = true;

  private mainCanvas!: HTMLCanvasElement;
  private mainCtx!: CanvasRenderingContext2D;

  private sliceCanvas!: HTMLCanvasElement;
  private sliceCtx!: CanvasRenderingContext2D;

  private sandboxCanvas!: HTMLCanvasElement;
  private sandboxCtx!: CanvasRenderingContext2D;

  private walkers: SandboxWalker[] = [];
  private lastTime = performance.now();

  public init(): void {
    this.mainCanvas = document.getElementById('studio-main-canvas') as HTMLCanvasElement;
    this.mainCtx = this.mainCanvas.getContext('2d')!;

    this.sliceCanvas = document.getElementById('studio-slice-canvas') as HTMLCanvasElement;
    this.sliceCtx = this.sliceCanvas.getContext('2d')!;

    this.sandboxCanvas = document.getElementById('studio-sandbox-canvas') as HTMLCanvasElement;
    this.sandboxCtx = this.sandboxCanvas.getContext('2d')!;

    this.initSandboxWalkers();
    this.renderArchetypeButtons();
    this.bindControls();
    this.updateMetaLabels();

    requestAnimationFrame((now) => this.loop(now));
  }

  private initSandboxWalkers(): void {
    const startPositions = [
      { gx: 1.6, gy: 1.7, speech: '네모 각진 곳이 하나도 없네!' },
      { gx: 4.4, gy: 1.7, speech: '그레이브야드 키퍼 느낌!' },
      { gx: 1.6, gy: 4.4, speech: '묵직한 망치질 손맛!' },
      { gx: 4.4, gy: 4.4, speech: '스테이크가 노릇노릇~' },
      { gx: 3.0, gy: 3.0, speech: '360도 회전이 매끄러워!' },
    ];
    const picks: CharacterArchetypeId[] = [
      'blacksmith',
      'knight',
      'chef',
      'mage',
      'alchemist',
    ];

    this.walkers = picks.map((id, idx) => {
      const meta = ARCHETYPES.find((a) => a.id === id) || ARCHETYPES[0];
      const pos = startPositions[idx];
      return {
        meta,
        gx: pos.gx,
        gy: pos.gy,
        tx: pos.gx,
        ty: pos.gy,
        angleRad: 0.35,
        targetAngleRad: 0.35,
        action: idx === 0 || idx === 2 ? 'work' : 'walk',
        timer: 1 + idx * 0.8,
        speech: pos.speech,
        speechTimer: 3.5,
        phase: idx * 1.4,
      };
    });
  }

  private renderArchetypeButtons(): void {
    const container = document.getElementById('archetype-list');
    if (!container) return;

    container.innerHTML = ARCHETYPES.map((a) => {
      const active = a.id === this.selectedId ? 'active' : '';
      return `
        <button class="arch-card ${active}" data-arch-id="${a.id}">
          <span class="arch-icon">${a.badgeIcon}</span>
          <div class="arch-info">
            <strong>${a.name}</strong>
            <small>${a.roleLabel}</small>
          </div>
        </button>
      `;
    }).join('');

    container.querySelectorAll('[data-arch-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedId = btn.getAttribute('data-arch-id') as CharacterArchetypeId;
        this.renderArchetypeButtons();
        this.updateMetaLabels();
      });
    });
  }

  private bindControls(): void {
    document.querySelectorAll('[data-action-id]').forEach((btn) => {
      const act = btn.getAttribute('data-action-id') as AnimActionId;
      btn.classList.toggle('active', act === this.selectedAction);
      btn.addEventListener('click', () => {
        this.selectedAction = act;
        document.querySelectorAll('[data-action-id]').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
      });
    });

    const angleSlider = document.getElementById('slider-angle') as HTMLInputElement;
    angleSlider?.addEventListener('input', () => {
      this.autoRotate = false;
      const autoCheck = document.getElementById('check-autorotate') as HTMLInputElement;
      if (autoCheck) autoCheck.checked = false;
      this.rotationDeg = Number(angleSlider.value);
      const valEl = document.getElementById('label-angle-val');
      if (valEl) valEl.textContent = `${Math.round(this.rotationDeg)}°`;
    });

    const autoCheck = document.getElementById('check-autorotate') as HTMLInputElement;
    autoCheck?.addEventListener('change', () => {
      this.autoRotate = autoCheck.checked;
    });

    const explodeSlider = document.getElementById('slider-explode') as HTMLInputElement;
    explodeSlider?.addEventListener('input', () => {
      this.explodeFactor = Number(explodeSlider.value);
      const valEl = document.getElementById('label-explode-val');
      if (valEl) valEl.textContent = `${this.explodeFactor.toFixed(1)}x`;
    });

    const scaleSlider = document.getElementById('slider-scale') as HTMLInputElement;
    scaleSlider?.addEventListener('input', () => {
      this.pixelScale = Number(scaleSlider.value);
      const valEl = document.getElementById('label-scale-val');
      if (valEl) valEl.textContent = `${this.pixelScale}x`;
    });

    const outlineCheck = document.getElementById('check-outline') as HTMLInputElement;
    outlineCheck?.addEventListener('change', () => {
      this.showOutline = outlineCheck.checked;
    });

    let dragging = false;
    let lastX = 0;
    this.mainCanvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      this.autoRotate = false;
      if (autoCheck) autoCheck.checked = false;
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      this.rotationDeg = (this.rotationDeg + dx * 1.1 + 360) % 360;
      if (angleSlider) angleSlider.value = String(Math.round(this.rotationDeg));
      const valEl = document.getElementById('label-angle-val');
      if (valEl) valEl.textContent = `${Math.round(this.rotationDeg)}°`;
    });
    window.addEventListener('pointerup', () => {
      dragging = false;
    });
  }

  private updateMetaLabels(): void {
    const meta =
      ARCHETYPES.find((a) => a.id === this.selectedId) || ARCHETYPES[0];
    const titleEl = document.getElementById('char-detail-title');
    const descEl = document.getElementById('char-detail-desc');
    const toolEl = document.getElementById('char-detail-tool');

    if (titleEl) titleEl.textContent = `${meta.badgeIcon} ${meta.name}`;
    if (descEl) descEl.textContent = meta.desc;
    if (toolEl) toolEl.textContent = `장착 무기/도구: ${meta.toolName}`;
  }

  private loop(now: number): void {
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const tSec = now / 1000;

    if (this.autoRotate) {
      this.rotationDeg = (this.rotationDeg + dt * 36) % 360;
      const angleSlider = document.getElementById('slider-angle') as HTMLInputElement;
      if (angleSlider) angleSlider.value = String(Math.round(this.rotationDeg));
      const valEl = document.getElementById('label-angle-val');
      if (valEl) valEl.textContent = `${Math.round(this.rotationDeg)}°`;
    }

    const meta =
      ARCHETYPES.find((a) => a.id === this.selectedId) || ARCHETYPES[0];
    const pose = computeAnimPose(this.selectedAction, tSec);

    this.renderMainTurntable(meta, pose);
    this.renderSliceInspector(meta, pose);
    this.updateAndRenderSandbox(dt, tSec);

    requestAnimationFrame((n) => this.loop(n));
  }

  private renderMainTurntable(
    meta: ArchetypeMeta,
    pose: ReturnType<typeof computeAnimPose>
  ): void {
    const ctx = this.mainCtx;
    const w = this.mainCanvas.width;
    const h = this.mainCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = Math.floor(w * 0.5);
    const groundY = Math.floor(h * 0.77);
    const rotRad = (this.rotationDeg * Math.PI) / 180;

    this.drawSmoothPedestal(ctx, cx, groundY + 10, this.pixelScale * 10);

    const baseStep = this.pixelScale * 2.2;
    const stats = renderSpriteStackCharacter(ctx, meta, pose, cx, groundY, {
      scale: this.pixelScale,
      rotationRad: rotRad,
      layerStepPx: baseStep * this.explodeFactor,
      showOutline: this.showOutline,
      showShadow: true,
    });

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 12px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `Graveyard Keeper 2 스타일 2.5D 곡면 슬라이스: ${stats.sliceCount}층 · 유기적 레이어: ${stats.voxelCount}개`,
      14,
      22
    );
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11.5px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText(
      '💡 네모난 픽셀/박스를 완전히 제거하고 매끄러운 곡면 슬라이스와 2톤 셀 쉐이딩으로 적층했습니다.',
      14,
      h - 12
    );
  }

  private drawSmoothPedestal(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number
  ): void {
    ctx.save();
    // 아랫면 두께
    ctx.beginPath();
    ctx.ellipse(cx, cy + 9, radius, radius * 0.46, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#451a03';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#231512';
    ctx.stroke();

    // 상판 황금 원형 석판
    const grad = ctx.createRadialGradient(
      cx - radius * 0.2,
      cy - radius * 0.15,
      4,
      cx,
      cy,
      radius
    );
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.65, '#f59e0b');
    grad.addColorStop(1, '#b45309');

    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * 0.46, 0, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#231512';
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 둥근 타원/캡슐 단면 슬라이스(Z0 발끝 ~ Z27 모자 끝)가 어떻게 생겼는지 보여주는 단면 인스펙터
   */
  private renderSliceInspector(
    meta: ArchetypeMeta,
    pose: ReturnType<typeof computeAnimPose>
  ): void {
    const ctx = this.sliceCtx;
    const w = this.sliceCanvas.width;
    const h = this.sliceCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const layers = buildSmoothCharacterLayers(meta, pose);
    const cols = 7;
    const cellW = Math.floor(w / cols);
    const cellH = Math.floor(h / 3);

    for (let idx = 0; idx < 21; idx++) {
      const targetZ = Math.round((idx / 20) * 26);
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = col * cellW + Math.floor(cellW * 0.5);
      const cy = row * cellH + Math.floor(cellH * 0.56);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.strokeRect(col * cellW + 2, row * cellH + 2, cellW - 4, cellH - 4);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Z${targetZ}`, col * cellW + 6, row * cellH + 13);

      const matching = layers.filter((l) => Math.abs(l.z - targetZ) < 1.1);
      for (const l of matching) {
        ctx.beginPath();
        ctx.ellipse(
          cx + l.x * 1.8,
          cy + l.y * 1.4,
          Math.max(2, l.rx * 1.9),
          Math.max(2, l.ry * 1.6),
          0,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = l.colorTop;
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#231512';
        ctx.stroke();
      }
    }
  }

  private updateAndRenderSandbox(dt: number, tSec: number): void {
    const ctx = this.sandboxCtx;
    const w = this.sandboxCanvas.width;
    const h = this.sandboxCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const tileW = 48;
    const tileH = 24;
    const originX = Math.floor(w * 0.5);
    const originY = 44;

    const isoToScr = (gx: number, gy: number) => ({
      x: originX + (gx - gy) * (tileW * 0.5),
      y: originY + (gx + gy) * (tileH * 0.5),
    });

    // 6x6 여관 타일 바닥
    for (let gx = 0; gx < 6; gx++) {
      for (let gy = 0; gy < 6; gy++) {
        const pTop = isoToScr(gx, gy);
        const pRight = isoToScr(gx + 1, gy);
        const pBottom = isoToScr(gx + 1, gy + 1);
        const pLeft = isoToScr(gx, gy + 1);

        const checker = (gx + gy) % 2 === 0;
        const isCarpet = gx >= 2 && gx <= 3 && gy >= 1 && gy <= 4;
        ctx.beginPath();
        ctx.moveTo(pTop.x, pTop.y);
        ctx.lineTo(pRight.x, pRight.y);
        ctx.lineTo(pBottom.x, pBottom.y);
        ctx.lineTo(pLeft.x, pLeft.y);
        ctx.closePath();
        ctx.fillStyle = isCarpet
          ? checker
            ? '#e11d48'
            : '#be123c'
          : checker
          ? '#eab308'
          : '#ca8a04';
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    for (const wk of this.walkers) {
      if (wk.speechTimer > 0) {
        wk.speechTimer -= dt;
        if (wk.speechTimer <= 0) wk.speech = null;
      }

      if (wk.action === 'walk') {
        const dx = wk.tx - wk.gx;
        const dy = wk.ty - wk.gy;
        const dist = Math.hypot(dx, dy);
        const speed = 1.4;
        if (dist <= speed * dt) {
          wk.gx = wk.tx;
          wk.gy = wk.ty;
          wk.action =
            wk.meta.id === 'blacksmith' || wk.meta.id === 'chef'
              ? 'work'
              : 'idle';
          wk.timer = 2.4 + Math.random() * 2.0;
        } else {
          wk.gx += (dx / dist) * speed * dt;
          wk.gy += (dy / dist) * speed * dt;
          const scrDeltaX = (dx - dy) * (tileW * 0.5);
          const scrDeltaY = (dx + dy) * (tileH * 0.5);
          wk.targetAngleRad = Math.atan2(scrDeltaX, scrDeltaY);
        }
      } else {
        wk.timer -= dt;
        if (wk.timer <= 0) {
          wk.tx = 0.8 + Math.random() * 4.4;
          wk.ty = 0.8 + Math.random() * 4.4;
          wk.action = 'walk';
          if (Math.random() < 0.55) {
            const lines = [
              '둥글둥글하고 입체감 최고!',
              '수염이랑 망치 모션 보소!',
              '네모 도트가 없어서 깔끔해!',
              '슬롯 돌리러 가자!',
              'Ugh... 스테이크 먹고 싶다',
            ];
            wk.speech = lines[Math.floor(Math.random() * lines.length)];
            wk.speechTimer = 3.0;
          }
        }
      }

      const diff = Math.atan2(
        Math.sin(wk.targetAngleRad - wk.angleRad),
        Math.cos(wk.targetAngleRad - wk.angleRad)
      );
      wk.angleRad += diff * Math.min(1, dt * 10);
    }

    const sorted = [...this.walkers].sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
    for (const wk of sorted) {
      const pos = isoToScr(wk.gx, wk.gy);
      const pose = computeAnimPose(wk.action, tSec, wk.phase);
      renderSpriteStackCharacter(ctx, wk.meta, pose, pos.x, pos.y, {
        scale: 2.35,
        rotationRad: -wk.angleRad,
        showOutline: this.showOutline,
        showShadow: true,
      });

      if (wk.speech) {
        this.drawKairoBubble(ctx, pos.x, pos.y - 56, wk.speech);
      }
    }
  }

  private drawKairoBubble(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string
  ): void {
    ctx.font = 'bold 11px "Pretendard", "Noto Sans KR", sans-serif';
    const tw = ctx.measureText(text).width;
    const bw = tw + 16;
    const bh = 20;
    const bx = x - bw * 0.5;
    const by = y - bh;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 9);
    ctx.fillStyle = text.includes('Ugh') ? '#e0e7ff' : '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = text.includes('Ugh') ? '#6366f1' : '#231512';
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, by + bh * 0.5);
    ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const studio = new SpriteStackCharacterStudio();
  studio.init();
});
