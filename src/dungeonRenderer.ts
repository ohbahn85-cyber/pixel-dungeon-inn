import {
  ActorArchetypeId,
  PixelSpriteAtlas,
  createPixelSpriteAtlas,
  drawTinyPixelText,
} from './pixelSprites';
import { normalizeReelId, ReelId } from './reelSprites';
import { CombatTickOutcome } from './gameLogic';
import { getHeroCombatStats } from './slotEngine';
import { ActiveDungeonRun, GameSaveData, HeroUnit } from './types';
import {
  ThemeId,
  MonState,
  getMonsterSprite,
  getThemeProp,
  THEME_SKY,
  THEME_FLOOR,
  THEME_PARTICLE,
} from './dungeonArt';
import { getArt } from './artAtlas';

const WORLD_W = 320;
const WORLD_H = 180;

interface FltNum {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
  maxAge: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface Atmos {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  max: number;
  color: string;
}

function drawOutlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 2
): void {
  const tmp = document.createElement('canvas');
  tmp.width = text.length * 4 + 4;
  tmp.height = 8;
  const tctx = tmp.getContext('2d')!;
  tctx.imageSmoothingEnabled = false;
  drawTinyPixelText(tctx, text, 1, 1, '#271c19', '');
  // inflate outline
  const img = tctx.getImageData(0, 0, tmp.width, tmp.height);
  const out = tctx.createImageData(tmp.width, tmp.height);
  for (let py = 0; py < tmp.height; py++) {
    for (let px = 0; px < tmp.width; px++) {
      const i = (py * tmp.width + px) * 4;
      let ink = img.data[i + 3] > 0;
      if (!ink) {
        for (let oy = -1; oy <= 1 && !ink; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const nx = px + ox;
            const ny = py + oy;
            if (nx < 0 || ny < 0 || nx >= tmp.width || ny >= tmp.height) continue;
            if (img.data[(ny * tmp.width + nx) * 4 + 3] > 0) ink = true;
          }
        }
        if (ink) {
          out.data[i] = 39;
          out.data[i + 1] = 28;
          out.data[i + 2] = 25;
          out.data[i + 3] = 255;
        }
      } else {
        const n = parseInt(color.slice(1), 16);
        out.data[i] = (n >> 16) & 255;
        out.data[i + 1] = (n >> 8) & 255;
        out.data[i + 2] = n & 255;
        out.data[i + 3] = 255;
      }
    }
  }
  tctx.putImageData(out, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, Math.round(x), Math.round(y), tmp.width * scale, tmp.height * scale);
}

export class DungeonRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private world: HTMLCanvasElement;
  private wctx: CanvasRenderingContext2D;
  private atlas: PixelSpriteAtlas | null = null;
  private scale = 2;
  private offsetX = 0;
  private offsetY = 0;
  private viewW = 640;
  private viewH = 420;
  private numbers: FltNum[] = [];
  private sparks: Spark[] = [];
  private atmos: Atmos[] = [];
  private partyLunge = 0;
  private monsterHit = 0;
  private monsterLunge = 0;
  private walkIn = 1;
  private monsterWalk = 1;
  private reelOffset = 0;
  private reelSpin = 0;
  private reelFaces: ReelId[] = ['crit', 'heal', 'seven'];
  private reelFlash = 0;
  private lastWave = 1;
  private save: GameSaveData | null = null;
  private run: ActiveDungeonRun | null = null;
  private dying = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('던전 캔버스 초기화 실패');
    this.ctx = ctx;
    this.world = document.createElement('canvas');
    this.world.width = WORLD_W;
    this.world.height = WORLD_H;
    const wctx = this.world.getContext('2d');
    if (!wctx) throw new Error('던전 월드 버퍼 실패');
    this.wctx = wctx;
    this.resize();
  }

  public resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const bar = document.getElementById('dungeon-reel-bar');
    const barH = bar && !bar.classList.contains('hidden')
      ? Math.max(72, Math.round(bar.getBoundingClientRect().height))
      : 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.viewW = rect ? Math.max(320, Math.floor(rect.width)) : 960;
    this.viewH = rect ? Math.max(180, Math.floor(rect.height - barH)) : 540;
    this.canvas.width = Math.round(this.viewW * dpr);
    this.canvas.height = Math.round(this.viewH * dpr);
    this.canvas.style.width = `${this.viewW}px`;
    this.canvas.style.height = `${this.viewH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.scale = Math.max(1, Math.floor(Math.min(this.viewW / WORLD_W, this.viewH / WORLD_H)));
    this.offsetX = Math.floor((this.viewW - WORLD_W * this.scale) / 2);
    this.offsetY = Math.floor((this.viewH - WORLD_H * this.scale) / 2);
  }

  public attach(save: GameSaveData, run: ActiveDungeonRun, fresh = false): void {
    this.save = save;
    if (fresh || !this.run || this.run.zoneId !== run.zoneId) {
      this.walkIn = 1;
      this.monsterWalk = 1;
      this.numbers = [];
      this.sparks = [];
      this.dying = 0;
      this.seedAtmos((run.zoneId as ThemeId) || 'dungeon_1');
    }
    if (this.run && run.wave !== this.lastWave) {
      this.monsterWalk = 1;
      this.walkIn = 0.25;
      this.dying = 0;
      this.numbers = [];
    }
    this.lastWave = run.wave;
    this.run = run;
  }

  public getReelState(): { faces: ReelId[]; spinning: boolean; flash: number } {
    return { faces: this.reelFaces, spinning: this.reelSpin > 0, flash: this.reelFlash };
  }

  public pushOutcome(outcome: CombatTickOutcome): void {
    const run = this.run;
    if (!run) return;
    const mx = 228;
    const my = 108;
    if (outcome.damageToMonster) {
      this.partyLunge = 1;
      this.monsterHit = 1;
      this.numbers.push({
        x: mx + (Math.random() * 18 - 9),
        y: my - 28,
        text: `-${outcome.damageToMonster}`,
        color: '#f2d675',
        age: 0,
        maxAge: 0.95,
      });
      this.burst(mx, my, '#f2d675', 10);
    }
    if (outcome.heroHits) {
      this.monsterLunge = 1;
      for (const h of outcome.heroHits) {
        const px = 62 + h.heroIndex * 28;
        const py = 128 - (h.heroIndex % 2) * 10;
        this.numbers.push({
          x: px,
          y: py - 20,
          text: `-${h.damage}`,
          color: '#e06c62',
          age: 0,
          maxAge: 0.85,
        });
        this.burst(px, py, '#e06c62', 6);
      }
    }
    if (outcome.heals) {
      for (const h of outcome.heals) {
        const px = 62 + h.heroIndex * 28;
        this.numbers.push({
          x: px,
          y: 100,
          text: `+${h.amount}`,
          color: '#a5bd7e',
          age: 0,
          maxAge: 0.95,
        });
      }
    }
    if (outcome.slotType === 'crit' || outcome.slotType === 'jackpot') {
      const amt =
        outcome.slotType === 'jackpot'
          ? Math.round(run.monsterMaxHp * 0.45)
          : Math.round(run.monsterMaxHp * 0.22);
      this.numbers.push({
        x: mx,
        y: my - 40,
        text: `-${amt}`,
        color: outcome.slotType === 'jackpot' ? '#fae078' : '#e38a3b',
        age: 0,
        maxAge: 1.15,
      });
      this.burst(mx, my, '#fae078', 16);
      this.monsterHit = 1;
    }
    if (outcome.waveCleared) {
      this.burst(mx, my, '#f5efe6', 20);
      this.monsterHit = 1;
      this.dying = 1;
    }
  }

  public spinCombatReels(symbols: string[]): void {
    this.reelFaces = symbols.map((s) => normalizeReelId(s, 'combat'));
    this.reelSpin = 0.85;
    this.reelFlash = 1;
  }

  private burst(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 18 + Math.random() * 40;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 10,
        life: 0.35 + Math.random() * 0.25,
        color,
      });
    }
  }

  private seedAtmos(theme: ThemeId): void {
    this.atmos = [];
    const cols = THEME_PARTICLE[theme];
    for (let i = 0; i < 36; i++) {
      this.atmos.push({
        x: Math.random() * WORLD_W,
        y: Math.random() * WORLD_H,
        vx: (Math.random() - 0.5) * 8,
        vy: theme === 'dungeon_4' ? -(8 + Math.random() * 16) : theme === 'dungeon_1' ? -(4 + Math.random() * 8) : (Math.random() - 0.5) * 6,
        size: 1 + (i % 2),
        life: Math.random(),
        max: 4 + Math.random() * 5,
        color: cols[i % cols.length],
      });
    }
  }

  private ensureAtlas(): PixelSpriteAtlas {
    if (!this.atlas) this.atlas = createPixelSpriteAtlas();
    return this.atlas;
  }

  public render(dt: number, timeSec: number): void {
    const ctx = this.wctx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, WORLD_W, WORLD_H);

    const run = this.run;
    const theme: ThemeId = (run?.zoneId as ThemeId) || 'dungeon_1';

    this.walkIn = Math.max(0, this.walkIn - dt * 1.4);
    this.monsterWalk = Math.max(0, this.monsterWalk - dt * 1.2);
    this.partyLunge = Math.max(0, this.partyLunge - dt * 3.2);
    this.monsterHit = Math.max(0, this.monsterHit - dt * 3.5);
    this.monsterLunge = Math.max(0, this.monsterLunge - dt * 3.2);
    this.reelSpin = Math.max(0, this.reelSpin - dt);
    this.reelFlash = Math.max(0, this.reelFlash - dt);
    this.reelOffset += dt * (this.reelSpin > 0 ? 14 : 0);
    if (this.dying > 0) this.dying = Math.min(1.2, this.dying + dt * 1.4);

    this.drawBackdrop(theme, timeSec);
    this.drawFloor(theme);
    this.drawMidProps(theme, timeSec, 'back');
    if (run && this.save) {
      this.drawCombatants(theme, timeSec);
      this.drawBars();
      this.drawWavePips();
    }
    this.drawMidProps(theme, timeSec, 'front');
    this.stepAtmos(dt, theme);
    this.drawAtmos();
    this.drawLighting(theme, timeSec);
    this.stepFx(dt);
    this.drawFx();

    const sctx = this.ctx;
    sctx.imageSmoothingEnabled = false;
    sctx.fillStyle = '#120e18';
    sctx.fillRect(0, 0, this.viewW, this.viewH);
    sctx.drawImage(
      this.world,
      0,
      0,
      WORLD_W,
      WORLD_H,
      this.offsetX,
      this.offsetY,
      WORLD_W * this.scale,
      WORLD_H * this.scale
    );
  }

  private drawBackdrop(theme: ThemeId, t: number): void {
    const ctx = this.wctx;
    const [top, mid, bot] = THEME_SKY[theme];
    const g = ctx.createLinearGradient(0, 0, 0, 100);
    g.addColorStop(0, top);
    g.addColorStop(0.55, mid);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD_W, 110);

    const ground =
      theme === 'dungeon_1'
        ? ['#243326', '#1a241c', '#384a27']
        : theme === 'dungeon_2'
          ? ['#1b2a33', '#15222c', '#2d434d']
          : theme === 'dungeon_3'
            ? ['#3a2a16', '#2c2114', '#5a4320']
            : ['#2a1410', '#1a0e0c', '#5c1d1c'];
    ctx.fillStyle = ground[0];
    ctx.fillRect(0, 88, WORLD_W, WORLD_H - 88);
    for (let y = 88; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        if ((x * 3 + y * 5) % 11 === 0) {
          ctx.fillStyle = ground[1];
          ctx.fillRect(x, y, 1, 1);
        } else if ((x + y * 2) % 13 === 0) {
          ctx.fillStyle = ground[2];
          ctx.fillRect(x, y, 2, 1);
        }
      }
    }

    const par = Math.sin(t * 0.25) * 4;
    ctx.globalAlpha = 0.55;
    this.drawSilhouettes(theme, par - 8, 0.7);
    ctx.globalAlpha = 0.9;
    this.drawSilhouettes(theme, par, 1);
    ctx.globalAlpha = 1;

    // hanging mid-ceiling details
    if (theme === 'dungeon_1') {
      ctx.fillStyle = '#384a27';
      for (const x of [18, 40, 70, 110, 250, 280, 305]) {
        const len = 18 + ((x * 3) % 16);
        ctx.fillRect(x, 0, 3, len);
        ctx.fillStyle = '#566e3d';
        ctx.fillRect(x + 3, 2, 2, len - 6);
        ctx.fillStyle = '#384a27';
      }
    } else if (theme === 'dungeon_2') {
      ctx.fillStyle = '#8fb3bf';
      for (const x of [22, 48, 90, 130, 240, 272, 300]) {
        const len = 22 + ((x * 5) % 18);
        for (let y = 0; y < len; y++) {
          const w = Math.max(1, 4 - Math.floor(y / (len / 4)));
          ctx.fillStyle = y < 4 ? '#d9f0f5' : y % 5 === 0 ? '#cbd5dc' : '#8fb3bf';
          ctx.fillRect(x - Math.floor(w / 2), y, w, 1);
        }
      }
    } else if (theme === 'dungeon_3') {
      ctx.fillStyle = '#8a6a28';
      ctx.fillRect(0, 0, WORLD_W, 10);
      ctx.fillStyle = '#c4a048';
      for (let x = 16; x < WORLD_W; x += 42) {
        ctx.fillRect(x, 10, 4, 16);
        ctx.fillStyle = '#efe0a8';
        ctx.fillRect(x + 1, 10, 1, 16);
        ctx.fillStyle = '#c4a048';
      }
    } else {
      // lava falls
      for (const x of [24, 74, 246, 286]) {
        const flow = Math.floor(t * 28 + x) % 18;
        for (let y = 0; y < 92; y++) {
          const w = y > 80 ? 10 : 6;
          const col = (y + flow) % 6 < 2 ? '#fae078' : (y + flow) % 6 < 4 ? '#e38a3b' : '#b84e22';
          ctx.fillStyle = col;
          ctx.fillRect(x, y, w, 1);
          ctx.fillRect(x + 9, y + 4, 4, 1);
        }
        ctx.fillStyle = 'rgba(227,138,59,0.35)';
        ctx.fillRect(x - 4, 88, 20, 8);
      }
      // chains
      ctx.fillStyle = '#434e59';
      for (const x of [140, 170, 200]) {
        for (let y = 0; y < 36; y += 4) ctx.fillRect(x, y, 2, 3);
      }
    }
  }

  private drawSilhouettes(theme: ThemeId, ox: number, depth: number): void {
    const ctx = this.wctx;
    const yBase = 70 + (1 - depth) * 10;
    if (theme === 'dungeon_1') {
      const dark = depth > 0.8 ? '#1a241c' : '#121810';
      const mid = depth > 0.8 ? '#243326' : '#1a241c';
      const leaf = depth > 0.8 ? '#4e6638' : '#243326';
      const trees = [8, 36, 68, 108, 198, 232, 268, 304];
      for (const tx of trees) {
        const x = Math.round(tx + ox);
        ctx.fillStyle = '#3a2a22';
        ctx.fillRect(x + 8, yBase - 10, 5, 22);
        ctx.fillStyle = mid;
        ctx.fillRect(x, yBase - 28, 22, 14);
        ctx.fillRect(x + 3, yBase - 34, 16, 10);
        ctx.fillStyle = leaf;
        ctx.fillRect(x + 6, yBase - 38, 10, 8);
        ctx.fillRect(x + 2, yBase - 24, 6, 4);
        ctx.fillStyle = dark;
        ctx.fillRect(x + 16, yBase - 20, 6, 8);
      }
    } else if (theme === 'dungeon_2') {
      ctx.fillStyle = depth > 0.8 ? '#15222c' : '#0e181f';
      ctx.beginPath();
      ctx.moveTo(0, 90);
      for (let x = 0; x <= WORLD_W; x += 20) {
        const h = 40 + Math.sin(x * 0.04 + ox * 0.1) * 18;
        ctx.lineTo(x + ox, 90 - h);
      }
      ctx.lineTo(WORLD_W, 90);
      ctx.closePath();
      ctx.fill();
    } else if (theme === 'dungeon_3') {
      ctx.fillStyle = depth > 0.8 ? '#2c2114' : '#1d160e';
      for (const x of [20, 70, 160, 230, 290].map((v) => v + ox)) {
        ctx.fillRect(x, yBase - 50, 18, 60);
        ctx.fillRect(x - 4, yBase - 56, 26, 8);
        ctx.fillStyle = '#5a4320';
        ctx.fillRect(x + 4, yBase - 40, 4, 8);
        ctx.fillRect(x + 10, yBase - 28, 4, 8);
        ctx.fillStyle = depth > 0.8 ? '#2c2114' : '#1d160e';
      }
    } else {
      ctx.fillStyle = depth > 0.8 ? '#1a0e0c' : '#120808';
      ctx.beginPath();
      ctx.moveTo(0, 95);
      ctx.lineTo(40 + ox, 40);
      ctx.lineTo(80 + ox, 70);
      ctx.lineTo(130 + ox, 30);
      ctx.lineTo(180 + ox, 55);
      ctx.lineTo(240 + ox, 24);
      ctx.lineTo(320, 60);
      ctx.lineTo(320, 95);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawFloor(theme: ThemeId): void {
    const ctx = this.wctx;
    const art = getArt();
    if (art) {
      const tw = 32;
      const th = 16;
      const originX = 160;
      const originY = 86;
      for (let gy = 0; gy < 8; gy++) {
        for (let gx = 0; gx < 10; gx++) {
          const sx = originX + (gx - gy) * (tw / 2);
          const sy = originY + (gx + gy) * (th / 2);
          if (sy < 70 || sy > 175 || sx < -24 || sx > 344) continue;
          const v = (gx * 3 + gy * 5) % 4;
          let spr;
          if (theme === 'dungeon_1') {
            spr = art.iso('rpg', v === 0 ? 5 : 5, v === 2 ? 1 : 0);
            if (v === 3) spr = art.iso('rpg', 6, 1);
          } else if (theme === 'dungeon_2') {
            spr = art.iso('caves', 9 + (v % 3), v < 2 ? 0 : 1);
            if (v === 3) spr = art.iso('caves', 1, 10);
          } else if (theme === 'dungeon_3') {
            spr = art.iso('caves', 9 + (v % 3), 5);
            if (v === 0) spr = art.isoTint('caves', 9, 4, 1, 1, 35, 1.15, 1.08);
          } else {
            spr = art.isoTint('caves', 9 + (v % 3), 5, 1, 1, -15, 1.2, 0.82);
            if (v === 2) spr = art.isoTint('tiny', 2, 4, 1, 1, -20, 1.25, 0.9);
          }
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(spr, Math.round(sx - spr.width / 2), Math.round(sy - th / 2));
        }
      }
      return;
    }
    const [hi, mid, lo, out] = THEME_FLOOR[theme];
    const tw = 22;
    const th = 11;
    const originX = 160;
    const originY = 78;
    for (let gy = 0; gy < 8; gy++) {
      for (let gx = 0; gx < 10; gx++) {
        const sx = originX + (gx - gy) * (tw / 2);
        const sy = originY + (gx + gy) * (th / 2);
        if (sy < 70 || sy > 175 || sx < -20 || sx > 340) continue;
        const varn = (gx * 3 + gy * 5) % 4;
        const top = varn === 0 ? hi : varn === 1 ? mid : varn === 2 ? lo : mid;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + tw / 2, sy + th / 2);
        ctx.lineTo(sx, sy + th);
        ctx.lineTo(sx - tw / 2, sy + th / 2);
        ctx.closePath();
        ctx.fillStyle = top;
        ctx.fill();
        ctx.strokeStyle = out;
        ctx.lineWidth = 1;
        ctx.stroke();
        // micro variation
        ctx.fillStyle = varn === 0 ? hi : lo;
        ctx.fillRect(sx - 2, sy + 4, 3, 1);
      }
    }
  }

  private drawMidProps(theme: ThemeId, t: number, layer: 'back' | 'front'): void {
    const ctx = this.wctx;
    const f = Math.floor(t * 3);
    const spots =
      layer === 'back'
        ? [
            { x: 18, y: 84, k: 1, s: 2 },
            { x: 48, y: 76, k: 0, s: 2 },
            { x: 78, y: 88, k: 2, s: 2 },
            { x: 108, y: 80, k: 3, s: 2 },
            { x: 200, y: 78, k: 1, s: 2 },
            { x: 236, y: 72, k: 0, s: 2 },
            { x: 268, y: 84, k: 3, s: 2 },
            { x: 296, y: 76, k: 2, s: 2 },
          ]
        : [
            { x: 4, y: 132, k: 0, s: 3 },
            { x: 28, y: 148, k: 3, s: 2 },
            { x: 52, y: 156, k: 1, s: 2 },
            { x: 250, y: 150, k: 2, s: 2 },
            { x: 276, y: 140, k: 1, s: 3 },
            { x: 302, y: 128, k: 0, s: 2 },
          ];
    const art = getArt();
    for (const s of spots) {
      if (art) {
        let tile;
        // 배경이 네모로 남는 타일(꽃밭, 크리스탈 카드)은 쓰지 않는다.
        if (theme === 'dungeon_1') {
          const picks: [number, number][] = [[0, 3], [1, 3], [2, 3], [0, 4]];
          const [c, r] = picks[s.k % picks.length];
          tile = art.slice('caves', c, r);
        } else if (theme === 'dungeon_2') {
          const picks: [number, number][] = [[0, 5], [1, 5], [2, 5], [3, 5]];
          const [c, r] = picks[s.k % picks.length];
          tile = art.slice('caves', c, r);
        } else if (theme === 'dungeon_3') {
          const picks: [number, number][] = [[8, 16], [9, 16], [6, 7], [7, 7]];
          const [c, r] = picks[s.k % picks.length];
          tile = art.slice('caves', c, r);
        } else {
          const picks: [number, number, 'caves' | 'tiny'][] = [
            [12, 16, 'caves'], [13, 16, 'caves'], [4, 2, 'tiny'], [8, 16, 'caves'],
          ];
          const [c, r, sh] = picks[s.k % picks.length];
          tile = art.slice(sh, c, r);
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tile, 0, 0, tile.width, tile.height, s.x, s.y, tile.width * s.s, tile.height * s.s);
        continue;
      }
      const spr = getThemeProp(theme, s.k, f);
      ctx.drawImage(spr, 0, 0, spr.width, spr.height, s.x, s.y, spr.width * s.s, spr.height * s.s);
    }
  }

  private monState(_t: number): MonState {
    if (this.dying > 0.15) return 'death';
    if (this.monsterHit > 0.35) return 'hit';
    if (this.monsterLunge > 0.25) return 'attack';
    return 'idle';
  }

  private heroArchetype(hero: HeroUnit): ActorArchetypeId {
    const map: Record<string, ActorArchetypeId> = {
      warrior: 'warrior',
      knight: 'knight',
      mage: 'mage',
      priest: 'mage',
      cleric: 'mage',
      ranger: 'archer',
      archer: 'archer',
      rogue: 'rogue',
      thief: 'rogue',
      chef: 'chef',
    };
    return map[hero.classId] || 'knight';
  }

  private drawCombatants(theme: ThemeId, t: number): void {
    const ctx = this.wctx;
    const run = this.run!;
    const save = this.save!;
    const atlas = this.ensureAtlas();
    const walkOff = Math.round(this.walkIn * -70);
    const monOff = Math.round(this.monsterWalk * 80);
    const lunge = Math.round(Math.sin((1 - this.partyLunge) * Math.PI) * (this.partyLunge > 0 ? 10 : 0));
    const mlunge = Math.round(this.monsterLunge * -8);

    run.partyIds.forEach((hid, i) => {
      const hero = save.heroes.find((h) => h.id === hid);
      if (!hero) return;
      const dead = hero.currentHp <= 0;
      const x = 48 + i * 28 + walkOff + lunge;
      const y = 126 - (i % 2) * 12 + (dead ? 6 : 0);
      const state = dead ? 'idle' : this.partyLunge > 0.2 ? 'work' : this.walkIn > 0 ? 'walk' : 'idle';
      const frame = Math.floor(t * (state === 'walk' ? 8 : 4)) & 3;
      const art = getArt();
      const spr = art
        ? art.character(this.heroArchetype(hero), 'se', frame)
        : atlas.getCharacterSprite(this.heroArchetype(hero), state, 'se', frame);
      if (dead) ctx.globalAlpha = 0.45;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(spr, 0, 0, spr.width, spr.height, x, y - spr.height * 2 + 10, spr.width * 2, spr.height * 2);
      ctx.globalAlpha = 1;
    });

    const state = this.monState(t);
    const frame = Math.floor(t * (state === 'idle' ? 4 : 8));
    const art = getArt();
    const mon = art
      ? art.monster(theme, run.isBoss, state, frame)
      : getMonsterSprite(theme, run.isBoss, state, frame);
    const monScale = run.isBoss ? 3 : 2;
    const mw = mon.width * monScale;
    const mh = mon.height * monScale;
    const mx = 200 + monOff + mlunge;
    const my = 128 - mh;
    if (this.monsterHit > 0.4) ctx.filter = 'brightness(1.6)';
    if (this.dying > 0.7) ctx.globalAlpha = Math.max(0, 1.2 - this.dying);
    if (run.status === 'reward_slot') ctx.globalAlpha = 0.25;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mon, mx, my, mw, mh);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  }

  private drawBars(): void {
    const ctx = this.wctx;
    const run = this.run!;
    const save = this.save!;
    const mw = 90;
    const mx = 200;
    const my = 28;
    const pct = Math.max(0, Math.min(1, run.monsterHp / Math.max(1, run.monsterMaxHp)));
    ctx.fillStyle = '#271c19';
    ctx.fillRect(mx - 1, my - 1, mw + 2, 7);
    ctx.fillStyle = '#5c1d1c';
    ctx.fillRect(mx, my, mw, 5);
    ctx.fillStyle = run.isBoss ? '#e06c62' : '#d6ac47';
    ctx.fillRect(mx, my, Math.round(mw * pct), 5);

    run.partyIds.forEach((hid, i) => {
      const hero = save.heroes.find((h) => h.id === hid);
      if (!hero) return;
      const st = getHeroCombatStats(save, hero);
      const p = Math.max(0, Math.min(1, hero.currentHp / Math.max(1, st.maxHp)));
      const x = 48 + i * 28;
      const y = 150;
      ctx.fillStyle = '#271c19';
      ctx.fillRect(x, y, 16, 4);
      ctx.fillStyle = '#5c1d1c';
      ctx.fillRect(x + 1, y + 1, 14, 2);
      ctx.fillStyle = '#7a9658';
      ctx.fillRect(x + 1, y + 1, Math.round(14 * p), 2);
    });
  }

  private drawWavePips(): void {
    const ctx = this.wctx;
    const run = this.run!;
    const total = run.maxWaves || 3;
    const cx = 160 - total * 6;
    for (let i = 0; i < total; i++) {
      ctx.fillStyle = '#271c19';
      ctx.fillRect(cx + i * 12, 8, 8, 8);
      ctx.fillStyle = i + 1 < run.wave ? '#d6ac47' : i + 1 === run.wave ? '#f2d675' : '#3a2a22';
      ctx.fillRect(cx + i * 12 + 1, 9, 6, 6);
    }
  }

  private stepAtmos(dt: number, theme: ThemeId): void {
    if (this.atmos.length === 0) this.seedAtmos(theme);
    for (const p of this.atmos) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life += dt;
      if (p.y < 4 || p.y > WORLD_H || p.x < 0 || p.x > WORLD_W || p.life > p.max) {
        p.x = Math.random() * WORLD_W;
        p.y = theme === 'dungeon_4' || theme === 'dungeon_1' ? WORLD_H - 10 : Math.random() * WORLD_H;
        p.life = 0;
      }
    }
  }

  private drawAtmos(): void {
    const ctx = this.wctx;
    for (const p of this.atmos) {
      const a = Math.min(1, p.life / 0.4, (p.max - p.life) / 0.6) * 0.85;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawLighting(theme: ThemeId, t: number): void {
    const ctx = this.wctx;
    const flicker = 0.75 + Math.sin(t * 7) * 0.08;
    const glow =
      theme === 'dungeon_1'
        ? `rgba(165,189,126,${0.12 * flicker})`
        : theme === 'dungeon_2'
          ? `rgba(217,240,245,${0.14 * flicker})`
          : theme === 'dungeon_3'
            ? `rgba(242,214,117,${0.16 * flicker})`
            : `rgba(227,138,59,${0.2 * flicker})`;
    const lg = ctx.createRadialGradient(230, 110, 10, 230, 110, 110);
    lg.addColorStop(0, glow);
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    const vig = ctx.createRadialGradient(160, 100, 60, 160, 100, 200);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(12,8,10,0.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  private stepFx(dt: number): void {
    for (const n of this.numbers) {
      n.age += dt;
      n.y -= dt * 22;
    }
    this.numbers = this.numbers.filter((n) => n.age < n.maxAge);
    for (const s of this.sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 50 * dt;
      s.life -= dt;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
  }

  private drawFx(): void {
    const ctx = this.wctx;
    for (const s of this.sparks) {
      ctx.globalAlpha = Math.max(0, s.life * 2);
      ctx.fillStyle = s.color;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
    }
    ctx.globalAlpha = 1;
    for (const n of this.numbers) {
      const a = n.age / n.maxAge < 0.65 ? 1 : Math.max(0, 1 - (n.age / n.maxAge - 0.65) / 0.35);
      ctx.globalAlpha = a;
      drawOutlinedText(ctx, n.text, n.x - 8, n.y, n.color, 2);
    }
    ctx.globalAlpha = 1;
  }
}
