import {
  ActorAnimState,
  ActorArchetypeId,
  PixelSpriteAtlas,
  createPixelSpriteAtlas,
} from './pixelSprites';
import {
  ActiveDungeonRun,
  FacilityId,
  FloatingPop,
  GameSaveData,
  MapActor,
} from './types';

export interface RoomZone {
  id: FacilityId | 'dungeon_gate' | 'courtyard';
  name: string;
  gx1: number;
  gy1: number;
  gx2: number;
  gy2: number;
}

export const ROOM_ZONES: RoomZone[] = [
  { id: 'inn', name: '여관', gx1: 1, gy1: 1, gx2: 5, gy2: 5 },
  { id: 'blacksmith', name: '대장간', gx1: 9, gy1: 1, gx2: 13, gy2: 5 },
  { id: 'potion', name: '공방', gx1: 1, gy1: 9, gx2: 5, gy2: 13 },
  { id: 'trade', name: '교역소', gx1: 9, gy1: 9, gx2: 13, gy2: 13 },
];

const WORLD_W = 384;
const WORLD_H = 256;
const TILE_W = 24;
const TILE_H = 12;
const ORIGIN_X = 192;
const ORIGIN_Y = 36;
const GRID = 14;

type PropBlit = {
  sprite: HTMLCanvasElement;
  gx: number;
  gy: number;
  gz?: number;
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
    const w = this.worldToScreen(this.isoToWorld(gx, gy, gz));
    return w;
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

  public getClickedRoom(
    clientX: number,
    clientY: number
  ): FacilityId | 'dungeon_gate' | null {
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    for (const b of this.roomScreenBounds) {
      if (Math.hypot(px - b.cx, py - b.cy) <= b.radius) return b.id;
    }
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
    const lavaFrame = Math.floor(timeSec * 4) % 3;
    const torchFrame = Math.floor(timeSec * 8) % atlas.props.wallTorch.length;

    wctx.imageSmoothingEnabled = false;
    wctx.fillStyle = '#241832';
    wctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // 먼 자수정 벽 디더 (상단)
    for (let y = 0; y < 28; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        const shade = (x + y * 3) % 5 === 0 ? '#2a2038' : '#231b30';
        wctx.fillStyle = shade;
        wctx.fillRect(x, y, 1, 1);
      }
    }

    // 바닥 타일 (먼 곳부터)
    for (let depth = 0; depth <= (GRID - 1) * 2; depth++) {
      for (let gx = 0; gx < GRID; gx++) {
        const gy = depth - gx;
        if (gy < 0 || gy >= GRID) continue;
        this.blitTile(atlas, gx, gy, lavaFrame);
      }
    }

    // 뒷벽
    this.drawRoomWalls(atlas);

    // 소품
    const props = this.collectProps(atlas, frame, torchFrame, activeDungeon);
    props.sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
    for (const p of props) this.blitProp(p);

    // 캐릭터
    const sorted = [...actors].sort(
      (a, b) => a.gridX + a.gridY - (b.gridX + b.gridY)
    );
    for (const actor of sorted) {
      this.blitActor(atlas, actor, timeSec);
    }

    // 월드 버퍼를 정수배로 화면에
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

    // 한글 말풍선·팝은 스케일 이후 또렷하게
    this.roomScreenBounds = [];
    for (const room of ROOM_ZONES) {
      const c = this.isoToScreen((room.gx1 + room.gx2) / 2, (room.gy1 + room.gy2) / 2, 0);
      this.roomScreenBounds.push({
        id: room.id as FacilityId,
        cx: c.x,
        cy: c.y,
        radius: 52 * this.scale * 0.45,
      });
    }
    const gate = this.isoToScreen(7, 0.2, 8);
    this.roomScreenBounds.push({
      id: 'dungeon_gate',
      cx: gate.x,
      cy: gate.y - 8 * this.scale,
      radius: 22 * this.scale,
    });

    for (const actor of sorted) {
      if (actor.speechText && actor.speechTimer > 0) {
        this.drawSpeechBubbleScreen(actor);
      }
    }
    for (const pop of pops) this.drawFloatingPopScreen(pop);
  }

  private roomAt(gx: number, gy: number): RoomZone | null {
    for (const r of ROOM_ZONES) {
      if (gx >= r.gx1 && gx <= r.gx2 && gy >= r.gy1 && gy <= r.gy2) return r;
    }
    return null;
  }

  private blitTile(
    atlas: PixelSpriteAtlas,
    gx: number,
    gy: number,
    lavaFrame: number
  ): void {
    const room = this.roomAt(gx, gy);
    const checker = (gx + gy) % 2 === 0;
    let spr: HTMLCanvasElement;
    if (!room) {
      if (gx + gy <= 3 && gx <= 2 && gy <= 2) {
        spr = atlas.tiles.lavaFrames[lavaFrame];
      } else {
        spr = checker ? atlas.tiles.corridorLight : atlas.tiles.corridorDark;
      }
    } else if (room.id === 'inn') {
      const carpet = gx >= 3 && gx <= 4 && gy >= 3 && gy <= 4;
      if (carpet) spr = checker ? atlas.tiles.innCarpetLight : atlas.tiles.innCarpetDark;
      else spr = checker ? atlas.tiles.innLight : atlas.tiles.innDark;
    } else if (room.id === 'blacksmith') {
      spr = checker ? atlas.tiles.bsLight : atlas.tiles.bsDark;
    } else if (room.id === 'potion') {
      spr = checker ? atlas.tiles.potLight : atlas.tiles.potDark;
    } else {
      spr = checker ? atlas.tiles.tradeLight : atlas.tiles.tradeDark;
    }
    const p = this.isoToWorld(gx, gy, 0);
    this.worldCtx.drawImage(spr, Math.round(p.x - TILE_W / 2), Math.round(p.y - TILE_H / 2));
  }

  private drawRoomWalls(atlas: PixelSpriteAtlas): void {
    const wctx = this.worldCtx;
    for (const room of ROOM_ZONES) {
      if (room.id === 'dungeon_gate' || room.id === 'courtyard') continue;
      const walls = atlas.walls[room.id as FacilityId];
      // gy = gy1 뒷가장자리 (right wall segments along gx)
      for (let gx = room.gx1; gx <= room.gx2; gx++) {
        const p = this.isoToWorld(gx, room.gy1 - 0.5, 0);
        wctx.drawImage(walls.right, Math.round(p.x - 2), Math.round(p.y - 20));
      }
      // gx = gx1 뒷가장자리 (left wall segments along gy)
      for (let gy = room.gy1; gy <= room.gy2; gy++) {
        const p = this.isoToWorld(room.gx1 - 0.5, gy, 0);
        wctx.drawImage(walls.left, Math.round(p.x - 10), Math.round(p.y - 20));
      }
    }
  }

  private collectProps(
    atlas: PixelSpriteAtlas,
    frame: number,
    torchFrame: number,
    activeDungeon: ActiveDungeonRun | null
  ): PropBlit[] {
    const a = atlas.props;
    const hearth = a.innHearth[frame % a.innHearth.length];
    const slot = a.slotCabinet[frame % a.slotCabinet.length];
    const furnace = a.bsFurnace[frame % a.bsFurnace.length];
    const altar = a.bsRuneAltar[frame % a.bsRuneAltar.length];
    const cauldron = a.potCauldron[frame % a.potCauldron.length];
    const torch = a.wallTorch[torchFrame];
    const arch = activeDungeon
      ? a.dungeonArchActive[frame % a.dungeonArchActive.length]
      : a.dungeonArchIdle[frame % a.dungeonArchIdle.length];

    const list: PropBlit[] = [
      { sprite: hearth, gx: 2.1, gy: 2.0, gz: 2 },
      { sprite: a.innTable, gx: 4.2, gy: 4.1, gz: 1 },
      { sprite: a.treasureChest, gx: 4.8, gy: 2.1, gz: 1 },
      { sprite: a.treasureChest, gx: 2.2, gy: 4.8, gz: 1 },
      { sprite: slot, gx: 4.7, gy: 4.7, gz: 1 },
      { sprite: a.roomSigns.inn, gx: 3.5, gy: 1.15, gz: 10 },
      { sprite: torch, gx: 1.2, gy: 1.3, gz: 12 },

      { sprite: furnace, gx: 9.4, gy: 2.0, gz: 2 },
      { sprite: a.bsAnvil, gx: 10.3, gy: 3.6, gz: 1 },
      { sprite: a.bsWeaponRack, gx: 12.2, gy: 2.0, gz: 1 },
      { sprite: altar, gx: 12.1, gy: 4.6, gz: 1 },
      { sprite: a.roomSigns.blacksmith, gx: 10.5, gy: 1.15, gz: 10 },
      { sprite: torch, gx: 9.2, gy: 1.3, gz: 12 },

      { sprite: a.potShelf, gx: 2.0, gy: 9.4, gz: 1 },
      { sprite: cauldron, gx: 3.4, gy: 10.4, gz: 1 },
      { sprite: a.potCrystal, gx: 5.3, gy: 12.0, gz: 1 },
      { sprite: a.roomSigns.potion, gx: 3.5, gy: 9.15, gz: 10 },
      { sprite: torch, gx: 1.3, gy: 9.2, gz: 12 },

      { sprite: a.tradeCounter, gx: 10.2, gy: 10.2, gz: 1 },
      { sprite: a.tradeCrates, gx: 9.0, gy: 12.0, gz: 1 },
      { sprite: a.tradeMushroom, gx: 12.2, gy: 11.8, gz: 1 },
      { sprite: a.treasureChest, gx: 12.1, gy: 9.0, gz: 1 },
      { sprite: a.roomSigns.trade, gx: 10.5, gy: 9.15, gz: 10 },
      { sprite: torch, gx: 9.2, gy: 9.2, gz: 12 },

      { sprite: arch, gx: 7.0, gy: 0.15, gz: 6 },
    ];
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

export function getZoneName(zoneId: string): string {
  const found = ROOM_ZONES.find((r) => r.id === zoneId);
  if (found) return found.name;
  if (zoneId === 'dungeon_gate') return '던전';
  return zoneId;
}
