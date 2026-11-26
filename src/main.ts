import {
  AnimActionId,
  ARCHETYPES,
  ArchetypeMeta,
  buildCharacterVoxelStack,
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
  private selectedId: CharacterArchetypeId = 'knight';
  private selectedAction: AnimActionId = 'walk';
  private rotationDeg = 25;
  private autoRotate = true;
  private explodeFactor = 1.0; // 1.0 = 기본 밀착 스태킹, 2.2 = 층별 슬라이스 분해 보기
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
      { gx: 1.8, gy: 1.8, speech: 'Sprite-Stacking 입체감 최고!' },
      { gx: 4.5, gy: 1.8, speech: '360도 회전이 부드러워!' },
      { gx: 1.8, gy: 4.5, speech: '망치질 손맛 보소!' },
      { gx: 4.5, gy: 4.5, speech: '맛있는 스테이크 굽는 중~' },
      { gx: 3.2, gy: 3.1, speech: 'Ugh... 던전 가고 싶다!' },
    ];
    const picks: CharacterArchetypeId[] = [
      'knight',
      'blacksmith',
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
        angleRad: 0.4,
        targetAngleRad: 0.4,
        action: idx === 1 || idx === 2 ? 'work' : 'idle',
        timer: 1 + idx * 0.7,
        speech: pos.speech,
        speechTimer: 3.5,
        phase: idx * 1.3,
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
    // 행동(애니메이션) 버튼
    document.querySelectorAll('[data-action-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedAction = btn.getAttribute('data-action-id') as AnimActionId;
        document.querySelectorAll('[data-action-id]').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
      });
    });

    // 360도 각도 슬라이더
    const angleSlider = document.getElementById('slider-angle') as HTMLInputElement;
    angleSlider?.addEventListener('input', () => {
      this.autoRotate = false;
      const autoCheck = document.getElementById('check-autorotate') as HTMLInputElement;
      if (autoCheck) autoCheck.checked = false;
      this.rotationDeg = Number(angleSlider.value);
      const valEl = document.getElementById('label-angle-val');
      if (valEl) valEl.textContent = `${Math.round(this.rotationDeg)}°`;
    });

    // 자동 360도 턴테이블 회전 체크박스
    const autoCheck = document.getElementById('check-autorotate') as HTMLInputElement;
    autoCheck?.addEventListener('change', () => {
      this.autoRotate = autoCheck.checked;
    });

    // 슬라이스 층 분해(Explode Z-Step) 슬라이더
    const explodeSlider = document.getElementById('slider-explode') as HTMLInputElement;
    explodeSlider?.addEventListener('input', () => {
      this.explodeFactor = Number(explodeSlider.value);
      const valEl = document.getElementById('label-explode-val');
      if (valEl) valEl.textContent = `${this.explodeFactor.toFixed(1)}x`;
    });

    // 도트 크기(Scale) 슬라이더
    const scaleSlider = document.getElementById('slider-scale') as HTMLInputElement;
    scaleSlider?.addEventListener('input', () => {
      this.pixelScale = Number(scaleSlider.value);
      const valEl = document.getElementById('label-scale-val');
      if (valEl) valEl.textContent = `${this.pixelScale}px`;
    });

    // 외곽선 토글
    const outlineCheck = document.getElementById('check-outline') as HTMLInputElement;
    outlineCheck?.addEventListener('change', () => {
      this.showOutline = outlineCheck.checked;
    });

    // 메인 캔버스 드래그로 직접 360도 돌려보기
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
      this.rotationDeg = (this.rotationDeg + dt * 42) % 360;
      const angleSlider = document.getElementById('slider-angle') as HTMLInputElement;
      if (angleSlider) angleSlider.value = String(Math.round(this.rotationDeg));
      const valEl = document.getElementById('label-angle-val');
      if (valEl) valEl.textContent = `${Math.round(this.rotationDeg)}°`;
    }

    const meta =
      ARCHETYPES.find((a) => a.id === this.selectedId) || ARCHETYPES[0];
    const pose = computeAnimPose(this.selectedAction, tSec);

    // 1. 좌측 메인 360도 Sprite-Stacking 턴테이블 뷰 렌더링
    this.renderMainTurntable(meta, pose, tSec);

    // 2. 우상단 Z-슬라이스 층별 해부도(Z=0 발끝 ~ Z=21 모자 끝) 렌더링
    this.renderSliceInspector(meta, pose);

    // 3. 우하단 카이로소프트풍 쿼터뷰 타일 위에서 실제로 걸어다니며 회전하는 라이브 테스트베드
    this.updateAndRenderSandbox(dt, tSec);

    requestAnimationFrame((n) => this.loop(n));
  }

  private renderMainTurntable(
    meta: ArchetypeMeta,
    pose: ReturnType<typeof computeAnimPose>,
    _tSec: number
  ): void {
    const ctx = this.mainCtx;
    const w = this.mainCanvas.width;
    const h = this.mainCanvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);

    // 배경 격자 및 아이소메트릭 원형 발판(Pedestal)
    const cx = Math.floor(w * 0.5);
    const groundY = Math.floor(h * 0.76);
    const rotRad = (this.rotationDeg * Math.PI) / 180;

    // 회전하는 다이아몬드 타일 발판
    this.drawRotatingPedestal(ctx, cx, groundY + 8, rotRad, this.pixelScale * 8.5);

    // Sprite-Stacking 캐릭터 렌더링
    const baseStep = Math.max(1, Math.round(this.pixelScale * 0.78));
    const stats = renderSpriteStackCharacter(ctx, meta, pose, cx, groundY, {
      scale: this.pixelScale,
      rotationRad: rotRad,
      layerStepPx: Math.round(baseStep * this.explodeFactor),
      showOutline: this.showOutline,
      showShadow: true,
    });

    // 상단 스펙 오버레이
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 12px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `적층 슬라이스: ${stats.sliceCount}층 (Z=0~${stats.sliceCount - 1}) · 활성 복셀: ${stats.voxelCount}개`,
      14,
      22
    );
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11.5px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText('💡 마우스로 캐릭터를 좌우로 드래그해 360도 돌려보세요!', 14, h - 12);
  }

  private drawRotatingPedestal(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rotRad: number,
    radius: number
  ): void {
    const corners = [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
    ];
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);
    const pts = corners.map((c) => {
      const rx = c.x * cos - c.y * sin;
      const ry = c.x * sin + c.y * cos;
      return {
        x: cx + rx * radius,
        y: cy + ry * radius * 0.52,
      };
    });

    // 발판 옆면 두께
    const thick = 10;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.lineTo(pts[3].x, pts[3].y);
    ctx.closePath();

    // 아래 두께 그림자
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(pts[3].x, pts[3].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.lineTo(pts[2].x, pts[2].y + thick);
    ctx.lineTo(pts[3].x, pts[3].y + thick);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.lineTo(pts[2].x, pts[2].y + thick);
    ctx.lineTo(pts[1].x, pts[1].y + thick);
    ctx.closePath();
    ctx.fillStyle = '#451a03';
    ctx.fill();

    // 카이로소프트 황금빛 상판
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.lineTo(pts[3].x, pts[3].y);
    ctx.closePath();
    ctx.fillStyle = '#f6c453';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#78350f';
    ctx.stroke();
  }

  /**
   * 캐릭터를 이루는 2D 단면 슬라이스(Z=0 발바닥 ~ Z=20 투구 끝)를 격자로 펼쳐서 보여줍니다.
   * Sprite-Stacking이 어떻게 층별로 쌓여서 3D 도트 캐릭터가 되는지 한눈에 볼 수 있습니다.
   */
  private renderSliceInspector(
    meta: ArchetypeMeta,
    pose: ReturnType<typeof computeAnimPose>
  ): void {
    const ctx = this.sliceCtx;
    const w = this.sliceCanvas.width;
    const h = this.sliceCanvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);

    const voxels = buildCharacterVoxelStack(meta, pose);
    const cols = 7;
    const cellW = Math.floor(w / cols);
    const cellH = Math.floor(h / 3);

    for (let z = 0; z < 21; z++) {
      const col = z % cols;
      const row = Math.floor(z / cols);
      const cx = col * cellW + Math.floor(cellW * 0.5);
      const cy = row * cellH + Math.floor(cellH * 0.54);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.strokeRect(col * cellW + 2, row * cellH + 2, cellW - 4, cellH - 4);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Z${z}`, col * cellW + 6, row * cellH + 13);

      const layerVoxels = voxels.filter((v) => Math.round(v.z) === z);
      const dot = 2.4;
      for (const v of layerVoxels) {
        ctx.fillStyle = v.color;
        ctx.fillRect(
          Math.round(cx + v.x * dot),
          Math.round(cy + v.y * dot),
          Math.ceil(dot),
          Math.ceil(dot)
        );
      }
    }
  }

  /**
   * 쿼터뷰(Isometric) 여관 바닥 위에서 5명의 Sprite-Stacking 캐릭터가 실제로 걸어다니며
   * 이동 방향에 맞춰 360도 부드럽게 몸을 회전하는 실시간 테스트베드!
   */
  private updateAndRenderSandbox(dt: number, tSec: number): void {
    const ctx = this.sandboxCtx;
    const w = this.sandboxCanvas.width;
    const h = this.sandboxCanvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);

    const tileW = 48;
    const tileH = 24;
    const originX = Math.floor(w * 0.5);
    const originY = 42;

    const isoToScr = (gx: number, gy: number) => ({
      x: originX + (gx - gy) * (tileW * 0.5),
      y: originY + (gx + gy) * (tileH * 0.5),
    });

    // 1. 6x6 카이로소프트풍 황금빛 여관 타일맵 + 중앙 레드 카펫 그리기
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
          ? '#f6c453'
          : '#e3a83b';
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 2. 캐릭터 자율 이동 및 부드러운 회전 각도 보간(Lerp)
    for (const wk of this.walkers) {
      if (wk.speechTimer > 0) {
        wk.speechTimer -= dt;
        if (wk.speechTimer <= 0) wk.speech = null;
      }

      if (wk.action === 'walk') {
        const dx = wk.tx - wk.gx;
        const dy = wk.ty - wk.gy;
        const dist = Math.hypot(dx, dy);
        const speed = 1.45;
        if (dist <= speed * dt) {
          wk.gx = wk.tx;
          wk.gy = wk.ty;
          wk.action =
            wk.meta.id === 'blacksmith' || wk.meta.id === 'chef'
              ? 'work'
              : 'idle';
          wk.timer = 2.0 + Math.random() * 2.5;
        } else {
          wk.gx += (dx / dist) * speed * dt;
          wk.gy += (dy / dist) * speed * dt;
          // 화면상의 이동 벡터에 맞춰 캐릭터가 바라보는 360도 각도를 자연스럽게 회전!
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
          if (Math.random() < 0.5) {
            const lines = [
              '입체 도트 느낌 좋네!',
              '방향 전환이 자연스러워!',
              '슬롯 돌리러 가자!',
              '오늘 컨디션 최고!',
              'Ugh... 배고파~',
            ];
            wk.speech = lines[Math.floor(Math.random() * lines.length)];
            wk.speechTimer = 2.8;
          }
        }
      }

      // 각도 부드러운 보간
      const diff = Math.atan2(
        Math.sin(wk.targetAngleRad - wk.angleRad),
        Math.cos(wk.targetAngleRad - wk.angleRad)
      );
      wk.angleRad += diff * Math.min(1, dt * 10);
    }

    // 3. 깊이(gx + gy) 정렬 후 Sprite-Stacking으로 캐릭터와 말풍선 렌더링
    const sorted = [...this.walkers].sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
    for (const wk of sorted) {
      const pos = isoToScr(wk.gx, wk.gy);
      const pose = computeAnimPose(wk.action, tSec, wk.phase);
      renderSpriteStackCharacter(ctx, wk.meta, pose, pos.x, pos.y, {
        scale: 3,
        rotationRad: -wk.angleRad,
        showOutline: this.showOutline,
        showShadow: true,
      });

      if (wk.speech) {
        this.drawKairoBubble(ctx, pos.x, pos.y - 54, wk.speech);
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
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fillStyle = text.includes('Ugh') ? '#e0e7ff' : '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = text.includes('Ugh') ? '#6366f1' : '#475569';
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
