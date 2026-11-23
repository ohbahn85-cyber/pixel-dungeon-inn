import {
  ActorArchetypeId,
  PixelSpriteAtlas,
  createPixelSpriteAtlas,
} from './pixelSprites';
import { getReelSprite, normalizeReelId, ReelId } from './reelSprites';
import { CombatTickOutcome } from './gameLogic';
import { getHeroCombatStats } from './slotEngine';
import { ActiveDungeonRun, GameSaveData, HeroUnit } from './types';

const WORLD_W = 320;
const WORLD_H = 180;

type ThemeId = 'dungeon_1' | 'dungeon_2' | 'dungeon_3' | 'dungeon_4';

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

function hexRgba(hex: string, a = 255): [number, number, number, number] {
  const c = hex.replace('#', '');
  const n = parseInt(c, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

function bake(rows: string[], map: Record<string, string>): HTMLCanvasElement {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const hex = map[row[x]];
      if (!hex) continue;
      const [r, g, b, a] = hexRgba(hex);
      const i = (y * w + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

const P: Record<string, string> = {
  O: '#271c19', o: '#3a2a22', S: '#1d1526',
  s: '#f4cfa6', d: '#dba87b', p: '#d96b70', e: '#271c19', w: '#f5efe6', g: '#d6cbb9',
  W: '#d4a36a', u: '#b58046', n: '#8c5c2b', m: '#633d19',
  Y: '#f2d675', y: '#d6ac47', k: '#a67c26', K: '#735114',
  I: '#cbd5dc', i: '#98a7b3', j: '#687785', J: '#434e59',
  R: '#e06c62', r: '#b84640', c: '#8a2f2c', C: '#5c1d1c',
  F: '#fae078', f: '#e38a3b', l: '#b84e22', L: '#752b13',
  G: '#a5bd7e', v: '#7a9658', h: '#566e3d', H: '#384a27',
  B: '#8fb3bf', b: '#638896', t: '#466470', T: '#2d434d',
  P: '#c7a4e0', a: '#946eb3', q: '#684a82', Q: '#442f57',
  // theme extras
  M: '#6b8f4a', N: '#4e6a34', A: '#cfe3c0',
  E: '#d9f0f5', U: '#8ec5d4', V: '#3f6f86',
  D: '#c9a44c', X: '#8a6a28', Z: '#efe0a8',
  Lava: '',
};

function spr(rows: string[]): HTMLCanvasElement {
  return bake(rows, P);
}

function themeMonster(zone: ThemeId, boss: boolean, frame: number): HTMLCanvasElement {
  const f = frame & 1;
  if (zone === 'dungeon_1') {
    if (boss) {
      return spr([
        '....GGHHGG....',
        '...GRwwRRHG...',
        '..GHReeRRRHG..',
        '.GHRRRRRRRHG.',
        '.GHvRRRRRvHG.',
        'GHHvvvvvvHHG',
        'HvvGGvGGvvvH',
        '.HvGwwwwGvH.',
        '.HvvvvvvvvH.',
        '..Hn....nH..',
        '..Hn....nH..',
        '...H....H...',
      ]);
    }
    return spr([
      f
        ? [
            '...ORRRRO...',
            '..ORwRRRRO..',
            '.ORRRRcRRO.',
            '.ORRcRRRcO.',
            '..OOOOOOO..',
            '...OvvvO...',
            '...OvGvO...',
            '....OOO....',
          ]
        : [
            '....ORRRO...',
            '...ORwRRRO..',
            '..ORRRRcRO..',
            '..ORRcRRRO..',
            '...OOOOOO...',
            '....OvvO....',
            '....OvGO....',
            '.....OO.....',
          ],
    ].flat());
  }
  if (zone === 'dungeon_2') {
    if (boss) {
      return spr([
        '...wBBBwBBw...',
        '..wBBwwwBBw...',
        '.wBBeewweeBw..',
        '.wBBBBBBBBw...',
        'wwBBBBBBBBww..',
        '.wBBttttBBw...',
        '..wBTTTTBw....',
        '..wT....Tw....',
        '..wT....Tw....',
        '...T....T.....',
      ]);
    }
    return spr([
      '..wBBBw...',
      '.wBwwwBw..',
      '.wBeeeBw..',
      '.wBBBBBw..',
      'wwBttBww..',
      '.wT..Tw...',
      '.wT..Tw...',
      '..T..T....',
    ]);
  }
  if (zone === 'dungeon_3') {
    if (boss) {
      return spr([
        '...YYYYYYYY...',
        '..YYkkkkkkYY..',
        '.YYkYwwYYkYY.',
        '.YkYeeeeYYkY.',
        '.YYYYYYYYYYY.',
        'YYYyyyyyyyYYY',
        '.YYkkkkkkYY.',
        '.Yk......kY.',
        '.Yk......kY.',
        '..Y......Y..',
      ]);
    }
    return spr([
      '..OJJJO..',
      '.OJiiiJO.',
      '.OJeeiJO.',
      '.OJiiiJO.',
      'OJYYYYYJO',
      '.OJjjjJO.',
      '.OJ...JO.',
      '..J...J..',
    ]);
  }
  // lava fortress
  if (boss) {
    return spr([
      '..f..RR..f..',
      '.RfRRRRRRfR.',
      'RRRRwwwwRRRR',
      'RRrReeeeRrRR',
      '.RRRRRRRRRR.',
      'RRRllllllRRR',
      '.RRlFFFFlRR.',
      '.RR......RR.',
      'RfR......RfR',
      'f.R......R.f',
    ]);
  }
  return spr([
    '..ORRRO..',
    '.ORffRRO.',
    '.OReeeRO.',
    '.ORrrrRO.',
    'ORlllllRO',
    '.ORlFlRO.',
    '.OR...RO.',
    '..R...R..',
  ]);
}

function themeProp(zone: ThemeId, kind: 'a' | 'b' | 'c', frame = 0): HTMLCanvasElement {
  if (zone === 'dungeon_1') {
    if (kind === 'a') {
      return spr([
        '.ORRRO.',
        'ORwRRRO',
        'ORRRRcO',
        'OOOOOOO',
        '..OvO..',
        '..OvO..',
      ]);
    }
    if (kind === 'b') {
      return spr([
        '..GGG..',
        '.GvvvG.',
        'GvvvvvG',
        '.hhhhh.',
        '..HHH..',
      ]);
    }
    return spr([
      '...G...',
      '..GvG..',
      '.GvhvG.',
      '..HvH..',
      '...H...',
    ]);
  }
  if (zone === 'dungeon_2') {
    if (kind === 'a') {
      return spr([
        '...w...',
        '..wBw..',
        '.wBBBw.',
        'wBBEBBw',
        '.wBBBw.',
        '..wTw..',
        '...T...',
      ]);
    }
    if (kind === 'b') {
      return spr([
        '.BBBB.',
        'BwwwBB',
        'BBBBBB',
        '.TTTT.',
      ]);
    }
    return spr([
      '..E..',
      '.EbE.',
      'EbBbE',
      '.EbE.',
      '..T..',
    ]);
  }
  if (zone === 'dungeon_3') {
    if (kind === 'a') {
      return spr([
        '.YYYYY.',
        'YYkkkYY',
        'YkYYYkY',
        'YkYYYYk',
        'YkkkkkY',
        '.YkkKY.',
        '..YYY..',
      ]);
    }
    if (kind === 'b') {
      return spr([
        'ZYYYYZ',
        'YXkkXY',
        'YXXXXY',
        'YXkkXY',
        'YYYYYY',
      ]);
    }
    return spr([
      '.YYY.',
      'YkwkY',
      'YkkkY',
      '.YYY.',
    ]);
  }
  // lava
  if (kind === 'a') {
    const glow = frame ? 'F' : 'f';
    return spr([
      '.JJJJJ.',
      'JJoooJJ',
      `JJ${glow}${glow}${glow}JJ`,
      'JJlllJJ',
      'JJLLLJJ',
      '.JJJJJ.',
    ]);
  }
  if (kind === 'b') {
    return spr([
      'CJJJC',
      'JlllJ',
      'JfLfJ',
      'JLLLJ',
      'CJJJC',
    ]);
  }
  return spr([
    '.L.',
    'LfL',
    'fFf',
    'LlL',
  ]);
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
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.viewW = rect ? Math.max(320, Math.floor(rect.width)) : 960;
    this.viewH = rect ? Math.max(220, Math.floor(rect.height)) : 540;
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
    }
    if (this.run && run.wave !== this.lastWave) {
      this.monsterWalk = 1;
      this.walkIn = 0.25;
    }
    this.lastWave = run.wave;
    this.run = run;
  }

  public pushOutcome(outcome: CombatTickOutcome): void {
    const run = this.run;
    if (!run) return;
    const mx = 230;
    const my = 100;
    if (outcome.damageToMonster) {
      this.partyLunge = 1;
      this.monsterHit = 1;
      this.numbers.push({
        x: mx + (Math.random() * 16 - 8),
        y: my - 18,
        text: `-${outcome.damageToMonster}`,
        color: '#f2d675',
        age: 0,
        maxAge: 0.9,
      });
      this.burst(mx, my, '#f2d675', 8);
    }
    if (outcome.heroHits) {
      this.monsterLunge = 1;
      for (const h of outcome.heroHits) {
        const px = 70 + h.heroIndex * 22;
        const py = 118 - (h.heroIndex % 2) * 8;
        this.numbers.push({
          x: px,
          y: py - 16,
          text: `-${h.damage}`,
          color: '#e06c62',
          age: 0,
          maxAge: 0.8,
        });
        this.burst(px, py, '#e06c62', 5);
      }
    }
    if (outcome.heals) {
      for (const h of outcome.heals) {
        const px = 70 + h.heroIndex * 22;
        this.numbers.push({
          x: px,
          y: 96,
          text: `+${h.amount}`,
          color: '#a5bd7e',
          age: 0,
          maxAge: 0.9,
        });
      }
    }
    if (outcome.slotType === 'crit' || outcome.slotType === 'jackpot') {
      const amt = outcome.slotType === 'jackpot'
        ? Math.round(run.monsterMaxHp * 0.45)
        : Math.round(run.monsterMaxHp * 0.22);
      this.numbers.push({
        x: mx,
        y: my - 30,
        text: `-${amt}`,
        color: outcome.slotType === 'jackpot' ? '#fae078' : '#e38a3b',
        age: 0,
        maxAge: 1.1,
      });
      this.burst(mx, my, '#fae078', 14);
      this.monsterHit = 1;
    }
    if (outcome.waveCleared) {
      this.burst(mx, my, '#f5efe6', 18);
      this.monsterHit = 1;
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
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 10,
        life: 0.35 + Math.random() * 0.25,
        color,
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

    this.drawBackdrop(theme, timeSec);
    this.drawFloor(theme);
    this.drawProps(theme, timeSec);
    if (run && this.save) {
      this.drawCombatants(theme, timeSec);
      this.drawBars();
      this.drawWavePips();
      this.drawCombatReels();
    }
    this.stepFx(dt);
    this.drawFx();

    const sctx = this.ctx;
    sctx.imageSmoothingEnabled = false;
    sctx.fillStyle = '#120e18';
    sctx.fillRect(0, 0, this.viewW, this.viewH);
    sctx.drawImage(
      this.world,
      this.offsetX,
      this.offsetY,
      WORLD_W * this.scale,
      WORLD_H * this.scale
    );
  }

  private drawBackdrop(theme: ThemeId, t: number): void {
    const ctx = this.wctx;
    const skies: Record<ThemeId, [string, string]> = {
      dungeon_1: ['#2a3a28', '#6a8450'],
      dungeon_2: ['#1a2c3a', '#4d7a8c'],
      dungeon_3: ['#3a2a18', '#8a6a32'],
      dungeon_4: ['#2a1210', '#6a2a18'],
    };
    const [top, bot] = skies[theme];
    const g = ctx.createLinearGradient(0, 0, 0, 110);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD_W, 120);

    // dither grain
    ctx.fillStyle = 'rgba(39,28,25,0.18)';
    for (let y = 0; y < 120; y += 2) {
      for (let x = (y & 2); x < WORLD_W; x += 4) ctx.fillRect(x, y, 1, 1);
    }

    if (theme === 'dungeon_1') {
      ctx.fillStyle = '#384a27';
      ctx.fillRect(0, 70, WORLD_W, 40);
      this.blob('#566e3d', 40, 80, 50, 30);
      this.blob('#384a27', 200, 74, 70, 36);
    } else if (theme === 'dungeon_2') {
      ctx.fillStyle = '#2d434d';
      ctx.beginPath();
      ctx.moveTo(0, 110);
      ctx.lineTo(40, 40);
      ctx.lineTo(90, 95);
      ctx.lineTo(140, 30);
      ctx.lineTo(200, 100);
      ctx.lineTo(260, 36);
      ctx.lineTo(320, 110);
      ctx.fill();
      ctx.fillStyle = 'rgba(143,179,191,0.35)';
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(30 + i * 36, 20 + ((Math.sin(t + i) * 6) | 0), 2, 2);
      }
    } else if (theme === 'dungeon_3') {
      ctx.fillStyle = '#5c4318';
      ctx.fillRect(0, 50, WORLD_W, 60);
      ctx.fillStyle = '#8a6a28';
      for (let i = 0; i < 7; i++) {
        const x = 16 + i * 46;
        ctx.fillRect(x, 28, 22, 82);
        ctx.fillStyle = '#c9a44c';
        ctx.fillRect(x + 2, 30, 18, 6);
        ctx.fillStyle = '#8a6a28';
      }
    } else {
      ctx.fillStyle = '#3d1a12';
      ctx.fillRect(0, 60, WORLD_W, 50);
      const flicker = 0.45 + Math.sin(t * 6) * 0.1;
      ctx.fillStyle = `rgba(227,138,59,${flicker})`;
      ctx.fillRect(0, 95, WORLD_W, 16);
      ctx.fillStyle = '#752b13';
      ctx.fillRect(0, 108, WORLD_W, 8);
    }
  }

  private blob(color: string, x: number, y: number, w: number, h: number): void {
    const ctx = this.wctx;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.fillRect(x + 8, y - 10, w - 16, 12);
  }

  private drawFloor(theme: ThemeId): void {
    const ctx = this.wctx;
    const pal: Record<ThemeId, [string, string, string]> = {
      dungeon_1: ['#7a9658', '#566e3d', '#384a27'],
      dungeon_2: ['#8fb3bf', '#466470', '#2d434d'],
      dungeon_3: ['#d6ac47', '#a67c26', '#735114'],
      dungeon_4: ['#5c1d1c', '#3a2a22', '#271c19'],
    };
    const [hi, mid, lo] = pal[theme];
    ctx.fillStyle = lo;
    ctx.fillRect(0, 118, WORLD_W, WORLD_H - 118);
    for (let row = 0; row < 7; row++) {
      for (let col = -1; col < 14; col++) {
        const x = col * 28 + (row % 2) * 14 - 8;
        const y = 118 + row * 9;
        ctx.fillStyle = (col + row) % 2 === 0 ? hi : mid;
        ctx.beginPath();
        ctx.moveTo(x + 14, y);
        ctx.lineTo(x + 28, y + 6);
        ctx.lineTo(x + 14, y + 12);
        ctx.lineTo(x, y + 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(39,28,25,0.35)';
        ctx.fillRect(x + 13, y + 1, 1, 10);
      }
    }
  }

  private drawProps(theme: ThemeId, t: number): void {
    const f = Math.floor(t * 4) & 1;
    const spots: { kind: 'a' | 'b' | 'c'; x: number; y: number }[] = [
      { kind: 'a', x: 18, y: 92 },
      { kind: 'b', x: 48, y: 86 },
      { kind: 'c', x: 280, y: 90 },
      { kind: 'a', x: 300, y: 100 },
      { kind: 'b', x: 250, y: 86 },
      { kind: 'c', x: 8, y: 108 },
    ];
    for (const s of spots) {
      const p = themeProp(theme, s.kind, f);
      this.wctx.drawImage(p, s.x, s.y);
    }
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
    const run = this.run!;
    const save = this.save!;
    const atlas = this.ensureAtlas();
    const walkOff = Math.round(this.walkIn * -70);
    const monOff = Math.round(this.monsterWalk * 80);
    const lunge = Math.round(Math.sin((1 - this.partyLunge) * Math.PI) * (this.partyLunge > 0 ? 10 : 0));
    const mhit = this.monsterHit > 0.4 ? 2 : 0;
    const mlunge = Math.round(this.monsterLunge * -8);

    run.partyIds.forEach((hid, i) => {
      const hero = save.heroes.find((h) => h.id === hid);
      if (!hero) return;
      const dead = hero.currentHp <= 0;
      const x = 54 + i * 22 + walkOff + lunge;
      const y = 112 - (i % 2) * 10 + (dead ? 6 : 0);
      const state = dead ? 'idle' : this.partyLunge > 0.2 ? 'work' : this.walkIn > 0 ? 'walk' : 'idle';
      const frame = Math.floor(t * (state === 'walk' ? 8 : 4)) & 3;
      const spr = atlas.getCharacterSprite(
        this.heroArchetype(hero),
        state,
        'se',
        frame
      );
      if (dead) this.wctx.globalAlpha = 0.45;
      this.wctx.drawImage(spr, x, y - spr.height + 8);
      this.wctx.globalAlpha = 1;
    });

    const mon = themeMonster(theme, run.isBoss, Math.floor(t * 4));
    const monScale = run.isBoss ? 3 : 2;
    const mw = mon.width * monScale;
    const mh = mon.height * monScale;
    const mx = 200 + monOff + mlunge + (Math.floor(t * 2) % 2);
    const my = 126 - mh;
    if (mhit) this.wctx.filter = 'brightness(1.8)';
    if (run.status === 'defeat') this.wctx.globalAlpha = 1;
    if (run.status === 'reward_slot') this.wctx.globalAlpha = 0.2;
    this.wctx.imageSmoothingEnabled = false;
    this.wctx.drawImage(mon, mx, my, mw, mh);
    this.wctx.filter = 'none';
    this.wctx.globalAlpha = 1;
  }

  private drawBars(): void {
    const run = this.run!;
    const save = this.save!;
    const ctx = this.wctx;
    // monster HP
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

    // party HP pips under each hero
    run.partyIds.forEach((hid, i) => {
      const hero = save.heroes.find((h) => h.id === hid);
      if (!hero) return;
      const st = getHeroCombatStats(save, hero);
      const p = Math.max(0, Math.min(1, hero.currentHp / Math.max(1, st.maxHp)));
      const x = 54 + i * 22;
      const y = 132;
      ctx.fillStyle = '#271c19';
      ctx.fillRect(x, y, 16, 4);
      ctx.fillStyle = '#5c1d1c';
      ctx.fillRect(x + 1, y + 1, 14, 2);
      ctx.fillStyle = '#7a9658';
      ctx.fillRect(x + 1, y + 1, Math.round(14 * p), 2);
    });
  }

  private drawWavePips(): void {
    const run = this.run!;
    const ctx = this.wctx;
    const total = run.maxWaves;
    const startX = WORLD_W / 2 - (total * 12) / 2;
    for (let i = 1; i <= total; i++) {
      const x = startX + (i - 1) * 14;
      const y = 10;
      const done = i < run.wave || (i === run.wave && run.status !== 'fighting');
      const cur = i === run.wave && run.status === 'fighting';
      const boss = i === total;
      ctx.fillStyle = '#271c19';
      ctx.fillRect(x, y, 10, 10);
      if (boss) {
        ctx.fillStyle = cur ? '#f2d675' : done ? '#d6ac47' : '#735114';
        ctx.fillRect(x + 1, y + 1, 8, 8);
        ctx.fillStyle = '#271c19';
        ctx.fillRect(x + 4, y - 2, 2, 3);
        ctx.fillRect(x + 2, y, 2, 2);
        ctx.fillRect(x + 6, y, 2, 2);
      } else {
        ctx.fillStyle = cur ? '#f2d675' : done ? '#7a9658' : '#3a2a22';
        ctx.fillRect(x + 2, y + 2, 6, 6);
      }
    }
  }

  private drawCombatReels(): void {
    const ctx = this.wctx;
    const bx = WORLD_W / 2 - 42;
    const by = 152;
    ctx.fillStyle = '#130f1f';
    ctx.fillRect(bx - 4, by - 4, 88, 24);
    ctx.strokeStyle = this.reelFlash > 0 ? '#f2d675' : '#b45309';
    ctx.strokeRect(bx - 4, by - 4, 88, 24);
    for (let i = 0; i < 3; i++) {
      const face = this.reelSpin > 0
        ? (['crit', 'heal', 'chest', 'seven', 'spark', 'coin'] as ReelId[])[
            Math.floor(this.reelOffset + i * 2) % 6
          ]
        : this.reelFaces[i];
      const spr = getReelSprite(face);
      const x = bx + i * 28;
      ctx.fillStyle = '#efe6d4';
      ctx.fillRect(x, by, 24, 16);
      ctx.drawImage(spr, x + 4, by, 16, 16);
    }
  }

  private stepFx(dt: number): void {
    for (const n of this.numbers) {
      n.age += dt;
      n.y -= dt * 22;
    }
    this.numbers = this.numbers.filter((n) => n.age < n.maxAge);
    for (const s of this.sparks) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 80 * dt;
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
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    for (const n of this.numbers) {
      ctx.globalAlpha = Math.max(0, 1 - n.age / n.maxAge);
      ctx.strokeStyle = '#271c19';
      ctx.lineWidth = 3;
      const x = Math.round(n.x);
      const y = Math.round(n.y);
      ctx.strokeText(n.text, x, y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, x, y);
    }
    ctx.globalAlpha = 1;
  }
}
