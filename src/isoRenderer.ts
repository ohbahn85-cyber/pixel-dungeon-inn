import {
  ActorAnimState,
  ActorArchetypeId,
  PixelSpriteAtlas,
  createPixelSpriteAtlas,
} from './pixelSprites';
import {
  DUNGEON_DOOR,
  ENTRANCE,
  FLOOR_MAX,
  GRID,
  ROOM_ZONES,
  RoomZone,
  getZoneName,
  zoneAt,
} from './innMap';
import {
  ActiveDungeonRun,
  FacilityId,
  FloatingPop,
  GameSaveData,
  MapActor,
} from './types';

export { ROOM_ZONES, getZoneName };
export type { RoomZone };

const WORLD_W = 384;
const WORLD_H = 256;
const TILE_W = 24;
const TILE_H = 12;
const ORIGIN_X = 192;
const ORIGIN_Y = 50;

type PropBlit = {
  sprite: HTMLCanvasElement;
  gx: number;
  gy: number;
  gz?: number;
  occlude?: boolean;
};

type DrawItem = {
  depth: number;
  order: number;
  draw: () => void;
};

export class IsoRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private world: HTMLCanvasElement;
  private worldCtx: CanvasRenderingContext2D;
  private atlas: PixelSpriteAtlas | null = null;
  private scale = 2;
  private offsetX = 0;
  private offsetY = 0;
  private viewW = 640;
  private viewH = 420;

  public roomScreenBounds: {
    id: FacilityId | 'dungeon_gate';
    cx: number;
    cy: number;
    radius: number;
  }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D Context 초기화 실패');
    this.ctx = ctx;
    this.world = document.createElement('canvas');
    this.world.width = WORLD_W;
    this.world.height = WORLD_H;
    const wctx = this.world.getContext('2d');
    if (!wctx) throw new Error('월드 버퍼 초기화 실패');
    this.worldCtx = wctx;
    this.resize();
  }

  private ensureAtlas(): PixelSpriteAtlas {
    if (!this.atlas) this.atlas = createPixelSpriteAtlas();
    return this.atlas;
  }

  public resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.viewW = rect ? Math.max(320, Math.floor(rect.width)) : 960;
    this.viewH = rect ? Math.max(240, Math.floor(rect.height)) : 560;
    this.canvas.width = Math.round(this.viewW * dpr);
    this.canvas.height = Math.round(this.viewH * dpr);
    this.canvas.style.width = `${this.viewW}px`;
    this.canvas.style.height = `${this.viewH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.scale = Math.max(
      1,
      Math.floor(Math.min(this.viewW / WORLD_W, this.viewH / WORLD_H))
    );
    this.offsetX = Math.floor((this.viewW - WORLD_W * this.scale) / 2);
    this.offsetY = Math.floor((this.viewH - WORLD_H * this.scale) / 2);
  }

  public isoToScreen(gx: number, gy: number, gz = 0): { x: number; y: number } {
    return this.worldToScreen(this.isoToWorld(gx, gy, gz));
  }

  private isoToWorld(gx: number, gy: number, gz = 0): { x: number; y: number } {
    const x = ORIGIN_X + (gx - gy) * (TILE_W * 0.5);
    const y = ORIGIN_Y + (gx + gy) * (TILE_H * 0.5) - gz;
    return { x, y };
  }

  private worldToScreen(p: { x: number; y: number }): { x: number; y: number } {
    return {
      x: this.offsetX + p.x * this.scale,
      y: this.offsetY + p.y * this.scale,
    };
  }

  public screenToIso(clientX: number, clientY: number): { gx: number; gy: number } {
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const wx = (px - this.offsetX) / this.scale;
    const wy = (py - this.offsetY) / this.scale;
    const a = (wx - ORIGIN_X) / (TILE_W * 0.5);
    const b = (wy - ORIGIN_Y) / (TILE_H * 0.5);
    return { gx: (a + b) / 2, gy: (b - a) / 2 };
  }

  public getClickedRoom(
    clientX: number,
    clientY: number
  ): FacilityId | 'dungeon_gate' | null {
    const { gx, gy } = this.screenToIso(clientX, clientY);
    const z = zoneAt(gx, gy);
    if (z) return z;
    // 벽 장식(던전 문) 근처 클릭 보정
    if (Math.abs(gx - DUNGEON_DOOR.gx) < 1.6 && gy < 1.8) return 'dungeon_gate';
    return null;
  }

  public render(
    _save: GameSaveData,
    actors: MapActor[],
    pops: FloatingPop[],
    activeDungeon: ActiveDungeonRun | null,
    timeSec: number
  ): void {
    this.resize();
    const atlas = this.ensureAtlas();
    const wctx = this.worldCtx;
    const frame = Math.floor(timeSec * 6) & 3;
    const torchFrame = Math.floor(timeSec * 8) % atlas.props.wallTorch.length;
    const candleFrame = Math.floor(timeSec * 5) % atlas.props.candleFrames.length;

    wctx.imageSmoothingEnabled = false;
    wctx.fillStyle = '#1c1528';
    wctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // 어두운 바깥 석재 디더
    for (let y = 0; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        if ((x + y * 3) % 7 === 0) {
          wctx.fillStyle = '#2a2038';
          wctx.fillRect(x, y, 1, 1);
        }
      }
    }

    // 연속 나무 바닥 + 구역 러그
    for (let depth = 0; depth <= (GRID - 1) * 2; depth++) {
      for (let gx = 0; gx <= FLOOR_MAX; gx++) {
        const gy = depth - gx;
        if (gy < 0 || gy > FLOOR_MAX) continue;
        this.blitTile(atlas, gx, gy);
      }
    }

    // 창문 빛줄기 (바닥 위, 가구 아래)
    this.drawLightShafts(wctx);

    // 뒷벽 (두 면) + 장식
    this.drawBackWalls(atlas, activeDungeon);

    // 소품 + 낮은 칸막이 + 캐릭터를 깊이 순으로
    const props = this.collectProps(atlas, frame, torchFrame, candleFrame, activeDungeon);
    const items: DrawItem[] = [];
    let order = 0;
    for (const p of props) {
      const depth = p.gx + p.gy + (p.occlude ? 0 : -0.05);
      items.push({
        depth,
        order: order++,
        draw: () => this.blitProp(p),
      });
    }
    for (const actor of actors) {
      items.push({
        depth: actor.gridX + actor.gridY + 0.2,
        order: order++,
        draw: () => this.blitActor(atlas, actor, timeSec),
      });
    }
    items.sort((a, b) => a.depth - b.depth || a.order - b.order);
    for (const it of items) it.draw();

    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#140f1c';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.drawImage(
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

    this.roomScreenBounds = [];
    for (const room of ROOM_ZONES) {
      const c = this.isoToScreen((room.gx1 + room.gx2) / 2, (room.gy1 + room.gy2) / 2, 0);
      this.roomScreenBounds.push({
        id: room.id as FacilityId,
        cx: c.x,
        cy: c.y,
        radius: 40 * this.scale * 0.5,
      });
    }
    const gate = this.isoToScreen(DUNGEON_DOOR.gx, DUNGEON_DOOR.gy, 10);
    this.roomScreenBounds.push({
      id: 'dungeon_gate',
      cx: gate.x,
      cy: gate.y - 8 * this.scale,
      radius: 20 * this.scale,
    });

    for (const actor of actors) {
      if (actor.speechText && actor.speechTimer > 0) {
        this.drawSpeechBubbleScreen(actor);
      }
    }
    for (const pop of pops) this.drawFloatingPopScreen(pop);
  }

  private blitTile(atlas: PixelSpriteAtlas, gx: number, gy: number): void {
    const checker = (gx + gy) % 2 === 0;
    let spr = checker ? atlas.tiles.innLight : atlas.tiles.innDark;

    // 구역 악센트(러그)만 다른 타일 — 건물 전체는 원목 바닥
    const diningRug = gx >= 3 && gx <= 5 && gy >= 3 && gy <= 5;
    const smithPad = gx >= 8 && gx <= 11 && gy >= 1 && gy <= 3;
    const potionRug = gx >= 2 && gx <= 4 && gy >= 8 && gy <= 10;
    const tradeRug = gx >= 8 && gx <= 10 && gy >= 8 && gy <= 10;
    const mat = gx >= 6 && gx <= 7 && gy >= 11 && gy <= 12;

    if (diningRug) spr = checker ? atlas.tiles.innCarpetLight : atlas.tiles.innCarpetDark;
    else if (smithPad) spr = checker ? atlas.tiles.bsLight : atlas.tiles.bsDark;
    else if (potionRug) spr = checker ? atlas.tiles.potLight : atlas.tiles.potDark;
    else if (tradeRug) spr = checker ? atlas.tiles.tradeLight : atlas.tiles.tradeDark;
    else if (mat) spr = checker ? atlas.tiles.corridorDark : atlas.tiles.innDark;

    const p = this.isoToWorld(gx, gy, 0);
    this.worldCtx.drawImage(spr, Math.round(p.x - TILE_W / 2), Math.round(p.y - TILE_H / 2));
  }

  private drawLightShafts(wctx: CanvasRenderingContext2D): void {
    // 뒷벽·옆벽 창문에서 사선으로 내려오는 따뜻한 빛
    const windows: { gx: number; gy: number; dir: 'fromBack' | 'fromLeft' }[] = [
      { gx: 2, gy: 0.6, dir: 'fromBack' },
      { gx: 4, gy: 0.6, dir: 'fromBack' },
      { gx: 8, gy: 0.6, dir: 'fromBack' },
      { gx: 10, gy: 0.6, dir: 'fromBack' },
      { gx: 0.6, gy: 3, dir: 'fromLeft' },
      { gx: 0.6, gy: 5, dir: 'fromLeft' },
      { gx: 0.6, gy: 8, dir: 'fromLeft' },
      { gx: 0.6, gy: 10, dir: 'fromLeft' },
    ];
    wctx.save();
    for (const w of windows) {
      const start = this.isoToWorld(w.gx, w.gy, 6);
      for (let i = 0; i < 18; i++) {
        const t = i / 18;
        // 실내 쪽으로만 (뒷벽: +gy, 왼쪽벽: +gx)
        const fall = w.dir === 'fromBack' ? { dx: 0.15, dy: 0.95 } : { dx: 0.9, dy: 0.55 };
        const x = Math.round(start.x + fall.dx * i * 2);
        const y = Math.round(start.y + fall.dy * i * 2);
        wctx.fillStyle = `rgba(242, 214, 117, ${0.28 * (1 - t)})`;
        const wdt = 3 + Math.floor(t * 7);
        for (let px = -wdt; px <= wdt; px++) {
          if (((px + i) & 1) === 0) wctx.fillRect(x + px, y, 1, 2);
        }
      }
    }
    wctx.restore();
  }

  private blitWall(
    spr: HTMLCanvasElement,
    gx: number,
    gy: number,
    side: 'left' | 'right'
  ): void {
    const p = this.isoToWorld(gx, gy, 0);
    const x = side === 'right' ? Math.round(p.x - 2) : Math.round(p.x - 10);
    const y = Math.round(p.y - 38);
    this.worldCtx.drawImage(spr, x, y);
  }

  private drawBackWalls(
    atlas: PixelSpriteAtlas,
    activeDungeon: ActiveDungeonRun | null
  ): void {
    const w = atlas.innWalls;
    // 뒷벽 (gy ≈ 0, gx를 따라) — 오른쪽 면
    const rightDecor: Record<number, HTMLCanvasElement> = {
      2: w.rightWindow,
      4: w.rightWindow,
      3: w.rightBanner,
      8: w.rightWindow,
      9: w.rightBanner,
      10: w.rightWindow,
      5: activeDungeon ? w.rightDungeonActive : w.rightDungeon,
      6: activeDungeon ? w.rightDungeonActive : w.rightDungeon,
    };
    for (let gx = 0; gx <= FLOOR_MAX; gx++) {
      const spr = rightDecor[gx] || w.rightPlain;
      this.blitWall(spr, gx, 0, 'right');
    }
    // 왼쪽 벽 (gx ≈ 0, gy를 따라)
    const leftDecor: Record<number, HTMLCanvasElement> = {
      2: w.leftShelf,
      3: w.leftWindow,
      5: w.leftWindow,
      8: w.leftWindow,
      9: w.leftShelf,
      10: w.leftWindow,
    };
    for (let gy = 0; gy <= FLOOR_MAX; gy++) {
      const spr = leftDecor[gy] || w.leftPlain;
      this.blitWall(spr, 0, gy, 'left');
    }
  }

  private collectProps(
    atlas: PixelSpriteAtlas,
    frame: number,
    torchFrame: number,
    candleFrame: number,
    activeDungeon: ActiveDungeonRun | null
  ): PropBlit[] {
    const a = atlas.props;
    const w = atlas.innWalls;
    const hearth = a.innHearth[frame % a.innHearth.length];
    const slot = a.slotCabinet[frame % a.slotCabinet.length];
    const furnace = a.bsFurnace[frame % a.bsFurnace.length];
    const altar = a.bsRuneAltar[frame % a.bsRuneAltar.length];
    const cauldron = a.potCauldron[frame % a.potCauldron.length];
    const torch = a.wallTorch[torchFrame];
    const candle = a.candleFrames[candleFrame];
    const list: PropBlit[] = [
      // —— 식당·부엌 (뒷왼쪽) ——
      { sprite: hearth, gx: 2.2, gy: 1.15, gz: 4, occlude: true },
      { sprite: a.barCounter, gx: 1.35, gy: 3.4, gz: 1, occlude: true },
      { sprite: a.innTable, gx: 4.05, gy: 3.7, gz: 1, occlude: true },
      { sprite: a.chair, gx: 3.35, gy: 3.5, gz: 1, occlude: true },
      { sprite: a.chair, gx: 4.75, gy: 3.55, gz: 1, occlude: true },
      { sprite: a.chair, gx: 4.05, gy: 4.45, gz: 1, occlude: true },
      { sprite: candle, gx: 4.05, gy: 3.55, gz: 12 },
      { sprite: a.innTable, gx: 5.3, gy: 2.15, gz: 1, occlude: true },
      { sprite: a.chair, gx: 5.3, gy: 2.7, gz: 1, occlude: true },
      { sprite: a.treasureChest, gx: 5.5, gy: 1.3, gz: 1, occlude: true },
      { sprite: slot, gx: 2.15, gy: 5.15, gz: 1, occlude: true },
      { sprite: a.barrel, gx: 1.25, gy: 4.7, gz: 1, occlude: true },
      { sprite: a.plant, gx: 5.9, gy: 1.9, gz: 1, occlude: true },
      { sprite: torch, gx: 1.15, gy: 1.2, gz: 16 },
      { sprite: a.roomSigns.inn, gx: 3.4, gy: 0.85, gz: 16 },

      // —— 대장간 코너 (뒷오른쪽) ——
      { sprite: a.chimneyFlue, gx: 9.35, gy: 0.42, gz: 22 },
      { sprite: a.chimneyHood, gx: 9.3, gy: 1.02, gz: 14 },
      { sprite: a.chimneySmoke[frame % a.chimneySmoke.length], gx: 9.35, gy: 0.28, gz: 36 },
      { sprite: furnace, gx: 9.3, gy: 1.28, gz: 3, occlude: true },
      { sprite: a.bsAnvil, gx: 8.95, gy: 3.05, gz: 1, occlude: true },
      { sprite: a.bsWeaponRack, gx: 11.4, gy: 1.35, gz: 2, occlude: true },
      { sprite: altar, gx: 11.2, gy: 3.85, gz: 1, occlude: true },
      { sprite: a.barrel, gx: 11.4, gy: 4.85, gz: 1, occlude: true },
      { sprite: torch, gx: 7.9, gy: 1.15, gz: 16 },
      { sprite: a.roomSigns.blacksmith, gx: 10.3, gy: 0.85, gz: 16 },

      // —— 포션 공방 (앞왼쪽) ——
      { sprite: a.potShelf, gx: 1.2, gy: 8.6, gz: 2, occlude: true },
      { sprite: a.potShelf, gx: 1.2, gy: 10.3, gz: 2, occlude: true },
      { sprite: cauldron, gx: 3.25, gy: 9.45, gz: 1, occlude: true },
      { sprite: a.herbRack, gx: 2.05, gy: 11.45, gz: 2, occlude: true },
      { sprite: a.potCrystal, gx: 4.85, gy: 11.2, gz: 1, occlude: true },
      { sprite: a.plant, gx: 5.05, gy: 7.9, gz: 1, occlude: true },
      { sprite: torch, gx: 1.15, gy: 7.3, gz: 16 },
      { sprite: a.roomSigns.potion, gx: 3.2, gy: 7.35, gz: 8 },

      // —— 교역소·출입구 (앞오른쪽) ——
      { sprite: a.tradeCounter, gx: 9.5, gy: 9.05, gz: 1, occlude: true },
      { sprite: a.tradeCrates, gx: 11.25, gy: 10.4, gz: 1, occlude: true },
      { sprite: a.treasureChest, gx: 11.25, gy: 8.2, gz: 1, occlude: true },
      { sprite: a.tradeMushroom, gx: 8.15, gy: 11.25, gz: 1, occlude: true },
      { sprite: a.plant, gx: 11.4, gy: 11.4, gz: 1, occlude: true },
      { sprite: a.doormat, gx: ENTRANCE.gx, gy: 12.42, gz: 0 },
      { sprite: a.entranceDoor, gx: ENTRANCE.gx, gy: 12.08, gz: 1, occlude: true },
      { sprite: a.entranceLamp[torchFrame % a.entranceLamp.length], gx: 5.45, gy: 12.0, gz: 16 },
      { sprite: a.barrel, gx: 8.2, gy: 8.3, gz: 1, occlude: true },
      { sprite: torch, gx: 7.9, gy: 7.3, gz: 16 },
      { sprite: a.roomSigns.trade, gx: 10.2, gy: 7.35, gz: 8 },

      // —— 공용: 계단, 기둥, 낮은 칸막이 ——
      { sprite: a.stairs, gx: 2.35, gy: 5.85, gz: 3, occlude: true },
      { sprite: a.pillar, gx: 6.15, gy: 6.15, gz: 2, occlude: true },
      { sprite: a.pillar, gx: 7.7, gy: 6.15, gz: 2, occlude: true },

      // 식당↔대장간 낮은 칸막이 (홀 쪽은 틔움)
      { sprite: w.lowRailRight, gx: 6.45, gy: 1.4, gz: 1, occlude: true },
      { sprite: w.lowRailRight, gx: 6.45, gy: 2.4, gz: 1, occlude: true },
      { sprite: w.lowRailRight, gx: 6.45, gy: 3.4, gz: 1, occlude: true },
      // 식당↔공방 낮은 칸막이
      { sprite: w.lowRailLeft, gx: 2.6, gy: 6.45, gz: 1, occlude: true },
      { sprite: w.lowRailLeft, gx: 3.6, gy: 6.45, gz: 1, occlude: true },

      // 앞쪽 잘라낸 낮은 난간 (출입구는 비움)
      { sprite: w.lowRailRight, gx: 1.0, gy: 12.1, gz: 1 },
      { sprite: w.lowRailRight, gx: 2.0, gy: 12.1, gz: 1 },
      { sprite: w.lowRailRight, gx: 3.0, gy: 12.1, gz: 1 },
      { sprite: w.lowRailRight, gx: 4.0, gy: 12.1, gz: 1 },
      { sprite: w.lowRailRight, gx: 5.0, gy: 12.1, gz: 1 },
      { sprite: w.lowRailRight, gx: 8.0, gy: 12.1, gz: 1 },
      { sprite: w.lowRailRight, gx: 9.0, gy: 12.1, gz: 1 },
      { sprite: w.lowRailRight, gx: 10.0, gy: 12.1, gz: 1 },
      { sprite: w.lowRailRight, gx: 11.0, gy: 12.1, gz: 1 },
      { sprite: w.lowRailRight, gx: 12.0, gy: 12.1, gz: 1 },
      { sprite: w.lowRailLeft, gx: 12.1, gy: 1.0, gz: 1 },
      { sprite: w.lowRailLeft, gx: 12.1, gy: 2.0, gz: 1 },
      { sprite: w.lowRailLeft, gx: 12.1, gy: 3.0, gz: 1 },
      { sprite: w.lowRailLeft, gx: 12.1, gy: 4.0, gz: 1 },
      { sprite: w.lowRailLeft, gx: 12.1, gy: 5.0, gz: 1 },
      { sprite: w.lowRailLeft, gx: 12.1, gy: 6.0, gz: 1 },
      { sprite: w.lowRailLeft, gx: 12.1, gy: 8.0, gz: 1 },
      { sprite: w.lowRailLeft, gx: 12.1, gy: 9.0, gz: 1 },
      { sprite: w.lowRailLeft, gx: 12.1, gy: 10.0, gz: 1 },
      { sprite: w.lowRailLeft, gx: 12.1, gy: 11.0, gz: 1 },
      { sprite: w.lowRailLeft, gx: 12.1, gy: 12.0, gz: 1 },

      { sprite: candle, gx: 1.6, gy: 3.2, gz: 12 },
      { sprite: candle, gx: 9.5, gy: 8.7, gz: 12 },
    ];

    if (activeDungeon) {
      // 던전 문은 벽 장식으로 이미 점멸. 아치를 추가로 올리지 않음.
      void a.dungeonArchActive;
    }
    return list;
  }

  private blitProp(p: PropBlit): void {
    const pos = this.isoToWorld(p.gx, p.gy, p.gz ?? 0);
    const x = Math.round(pos.x - p.sprite.width / 2);
    const y = Math.round(pos.y - p.sprite.height + 6);
    this.worldCtx.drawImage(p.sprite, x, y);
  }

  private actorArchetype(actor: MapActor): ActorArchetypeId {
    if (actor.archetype) return actor.archetype;
    if (actor.kind === 'staff') return 'chef';
    if (actor.kind === 'hero') return 'knight';
    return 'rogue';
  }

  private animState(actor: MapActor): ActorAnimState {
    if (actor.state === 'walk') return 'walk';
    if (actor.state === 'work') return 'work';
    return 'idle';
  }

  private blitActor(
    atlas: PixelSpriteAtlas,
    actor: MapActor,
    timeSec: number
  ): void {
    const state = this.animState(actor);
    const speed = state === 'walk' ? 8 : state === 'work' ? 7 : 3;
    const frame = Math.floor(timeSec * speed + actor.bouncePhase) & 3;
    const spr = atlas.getCharacterSprite(
      this.actorArchetype(actor),
      state,
      actor.facing,
      frame,
      actor.weaponType
    );
    const pos = this.isoToWorld(actor.gridX, actor.gridY, 2);
    const x = Math.round(pos.x - spr.width / 2);
    const y = Math.round(pos.y - spr.height + 4);
    this.worldCtx.drawImage(spr, x, y);
  }

  private drawSpeechBubbleScreen(actor: MapActor): void {
    const text = actor.speechText;
    if (!text) return;
    const pos = this.isoToScreen(actor.gridX, actor.gridY, 22);
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `bold ${Math.max(10, 6 + this.scale)}px "Noto Sans KR", sans-serif`;
    const padX = 6;
    const w = Math.ceil(ctx.measureText(text).width + padX * 2);
    const h = 14 + this.scale;
    const bx = Math.round(pos.x - w / 2);
    const by = Math.round(pos.y - h - 6);
    ctx.fillStyle = '#f6efe2';
    ctx.strokeStyle = '#3a2a22';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const r = 5;
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + w - r, by);
    ctx.quadraticCurveTo(bx + w, by, bx + w, by + r);
    ctx.lineTo(bx + w, by + h - r);
    ctx.quadraticCurveTo(bx + w, by + h, bx + w - r, by + h);
    ctx.lineTo(bx + w / 2 + 5, by + h);
    ctx.lineTo(bx + w / 2, by + h + 5);
    ctx.lineTo(bx + w / 2 - 5, by + h);
    ctx.lineTo(bx + r, by + h);
    ctx.quadraticCurveTo(bx, by + h, bx, by + h - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#271c19';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pos.x, by + h / 2);
    ctx.restore();
  }

  private drawFloatingPopScreen(pop: FloatingPop): void {
    const ratio = pop.age / pop.maxAge;
    const pos = this.isoToScreen(pop.gridX, pop.gridY, 16 + ratio * 18);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - ratio);
    ctx.font = `bold ${Math.max(10, 5 + this.scale)}px "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#271c19';
    ctx.fillStyle = pop.color || '#f2d675';
    ctx.strokeText(pop.text, pos.x, pos.y);
    ctx.fillText(pop.text, pos.x, pos.y);
    ctx.restore();
  }
}
