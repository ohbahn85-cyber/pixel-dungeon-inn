import { DUNGEON_ZONES } from './data';
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
  badgeText: string;
  gx1: number;
  gy1: number;
  gx2: number;
  gy2: number;
  floorLight: string;
  floorDark: string;
  wallLeft: string;
  wallRight: string;
  wallTop: string;
  borderGold: string;
}

export const ROOM_ZONES: RoomZone[] = [
  {
    id: 'inn',
    name: '모험가 여관 & 주방',
    badgeText: '🏠 여관 · 요리/영웅슬롯',
    gx1: 1,
    gy1: 1,
    gx2: 6,
    gy2: 6,
    floorLight: '#f6c453',
    floorDark: '#e3a83b',
    wallLeft: '#d98a2b',
    wallRight: '#b86d19',
    wallTop: '#fbd377',
    borderGold: '#78350f',
  },
  {
    id: 'blacksmith',
    name: '황금모루 대장간',
    badgeText: '⚒️ 대장간 · 무기3종슬롯',
    gx1: 8,
    gy1: 1,
    gx2: 13,
    gy2: 6,
    floorLight: '#b47b56',
    floorDark: '#9c6340',
    wallLeft: '#78472a',
    wallRight: '#5e341c',
    wallTop: '#d49b72',
    borderGold: '#451a03',
  },
  {
    id: 'potion',
    name: '신비 포션 공방',
    badgeText: '🧪 포션가게 · 연금슬롯',
    gx1: 1,
    gy1: 8,
    gx2: 6,
    gy2: 13,
    floorLight: '#67e8f9',
    floorDark: '#38bdf8',
    wallLeft: '#0284c7',
    wallRight: '#0369a1',
    wallTop: '#bae6fd',
    borderGold: '#0c4a6e',
  },
  {
    id: 'trade',
    name: '왕국 교역소',
    badgeText: '💎 거래처 · 정가상점/교환',
    gx1: 8,
    gy1: 8,
    gx2: 13,
    gy2: 13,
    floorLight: '#86efac',
    floorDark: '#4ade80',
    wallLeft: '#16a34a',
    wallRight: '#15803d',
    wallTop: '#bbf7d0',
    borderGold: '#064e3b',
  },
];

export class IsoRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tileW = 54;
  private tileH = 27;
  private originX = 0;
  private originY = 0;

  // 화면 클릭 감지를 위한 방 중심 좌표 캐시
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
    this.resize();
  }

  public resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = rect ? Math.max(640, rect.width) : 960;
    const h = rect ? Math.max(420, rect.height) : 560;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 화면 크기에 맞춰 타일 크기와 중심점 자동 맞춤
    this.tileW = Math.max(40, Math.min(62, Math.floor(w / 17.5)));
    this.tileH = Math.floor(this.tileW / 2);
    this.originX = Math.floor(w * 0.5);
    this.originY = Math.floor(h * 0.17);
  }

  public isoToScreen(gx: number, gy: number, gz = 0): { x: number; y: number } {
    const x = this.originX + (gx - gy) * (this.tileW * 0.5);
    const y = this.originY + (gx + gy) * (this.tileH * 0.5) - gz;
    return { x, y };
  }

  public getClickedRoom(
    clientX: number,
    clientY: number
  ): FacilityId | 'dungeon_gate' | null {
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    for (const b of this.roomScreenBounds) {
      const dist = Math.hypot(px - b.cx, py - b.cy);
      if (dist <= b.radius) {
        return b.id;
      }
    }
    return null;
  }

  public render(
    save: GameSaveData,
    actors: MapActor[],
    pops: FloatingPop[],
    activeDungeon: ActiveDungeonRun | null,
    timeSec: number
  ): void {
    const ctx = this.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    // 1. 카이로소프트 스타일 어두운 자수정 던전 외곽 배경 & 용암/얼음 장식
    this.drawDungeonBackdrop(ctx, w, h, timeSec);

    // 2. 중앙 십자 복도 바닥 (6..8)
    this.drawCorridors(ctx);

    // 3. 4대 시설 아이소메트릭 방 바닥 & 두꺼운 3D 벽면 & 가구 소품
    this.roomScreenBounds = [];
    for (const room of ROOM_ZONES) {
      this.drawIsoRoom(ctx, room, save, timeSec);
    }

    // 4. 북동쪽 던전 입구 아치 & 용암 불꽃 연출
    this.drawDungeonGateArch(ctx, activeDungeon, timeSec);

    // 5. 모든 캐릭터(영웅, 직원, 손님) 깊이(gx + gy) 정렬 후 렌더링
    const sortedActors = [...actors].sort(
      (a, b) => a.gridX + a.gridY - (b.gridX + b.gridY)
    );
    for (const actor of sortedActors) {
      this.drawChibiActor(ctx, actor, timeSec);
    }

    // 6. 카이로소프트 특유의 둥근 말풍선 ("대박!", "강화 성공!", "Ugh...")
    for (const actor of sortedActors) {
      if (actor.speechText && actor.speechTimer > 0) {
        this.drawSpeechBubble(ctx, actor);
      }
    }

    // 7. 방 이름 & 클릭 유도 플로팅 배지
    this.drawRoomBadges(ctx, save, timeSec);

    // 8. 떠오르는 골드/효과 텍스트
    for (const pop of pops) {
      this.drawFloatingPop(ctx, pop);
    }
  }

  private drawDungeonBackdrop(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number
  ): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2a2139');
    grad.addColorStop(0.5, '#352a47');
    grad.addColorStop(1, '#231c30');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 좌상단 용암 지대 타일 연출 (첨부 이미지의 좌상단 부글거리는 오렌지 용암 느낌!)
    for (let gx = -3; gx <= 0; gx++) {
      for (let gy = 1; gy <= 6; gy++) {
        const pulse = Math.sin(timeSec * 3 + gx + gy) * 0.5 + 0.5;
        const c = pulse > 0.5 ? '#fb923c' : '#f97316';
        this.drawDiamondTile(ctx, gx, gy, c, '#ea580c', -4);
      }
    }
  }

  private drawCorridors(ctx: CanvasRenderingContext2D): void {
    // 전체 1..13 격자 중 복도 영역(gx 6.2~7.8 또는 gy 6.2~7.8)에 어두운 자수정 복도 타일
    for (let gx = 1; gx <= 13; gx++) {
      for (let gy = 1; gy <= 13; gy++) {
        const inVert = gx >= 6 && gx <= 8;
        const inHoriz = gy >= 6 && gy <= 8;
        if (inVert || inHoriz) {
          const checker = (gx + gy) % 2 === 0;
          this.drawDiamondTile(
            ctx,
            gx,
            gy,
            checker ? '#4c3d63' : '#433557',
            '#322742',
            0
          );
        }
      }
    }
  }

  private drawDiamondTile(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    fillColor: string,
    strokeColor: string,
    gz = 0
  ): void {
    const pTop = this.isoToScreen(gx - 0.5, gy - 0.5, gz);
    const pRight = this.isoToScreen(gx + 0.5, gy - 0.5, gz);
    const pBottom = this.isoToScreen(gx + 0.5, gy + 0.5, gz);
    const pLeft = this.isoToScreen(gx - 0.5, gy + 0.5, gz);

    ctx.beginPath();
    ctx.moveTo(pTop.x, pTop.y);
    ctx.lineTo(pRight.x, pRight.y);
    ctx.lineTo(pBottom.x, pBottom.y);
    ctx.lineTo(pLeft.x, pLeft.y);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 슬래브 아래 두께감
    const thickness = 7;
    ctx.beginPath();
    ctx.moveTo(pLeft.x, pLeft.y);
    ctx.lineTo(pBottom.x, pBottom.y);
    ctx.lineTo(pBottom.x, pBottom.y + thickness);
    ctx.lineTo(pLeft.x, pLeft.y + thickness);
    ctx.closePath();
    ctx.fillStyle = strokeColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(pBottom.x, pBottom.y);
    ctx.lineTo(pRight.x, pRight.y);
    ctx.lineTo(pRight.x, pRight.y + thickness);
    ctx.lineTo(pBottom.x, pBottom.y + thickness);
    ctx.closePath();
    ctx.fillStyle = '#1e162b';
    ctx.fill();
  }

  private drawIsoRoom(
    ctx: CanvasRenderingContext2D,
    room: RoomZone,
    _save: GameSaveData,
    timeSec: number
  ): void {
    const wallH = Math.round(this.tileH * 0.95);

    // 1. 뒤쪽 두 벽면 (북서쪽 벽 gy = gy1 - 0.5, 북동쪽 벽 gx = gx1 - 0.5)
    for (let gx = room.gx1; gx <= room.gx2; gx++) {
      this.drawBackWallRight(
        ctx,
        gx,
        room.gy1 - 0.5,
        wallH,
        room.wallRight,
        room.wallTop,
        room.borderGold
      );
    }
    for (let gy = room.gy1; gy <= room.gy2; gy++) {
      this.drawBackWallLeft(
        ctx,
        room.gx1 - 0.5,
        gy,
        wallH,
        room.wallLeft,
        room.wallTop,
        room.borderGold
      );
    }

    // 2. 방 체크무늬 바닥 타일 + 레드 카펫 포인트
    for (let gx = room.gx1; gx <= room.gx2; gx++) {
      for (let gy = room.gy1; gy <= room.gy2; gy++) {
        const checker = (gx + gy) % 2 === 0;
        const isCarpet =
          room.id === 'inn' &&
          gx >= room.gx1 + 1 &&
          gx <= room.gx2 - 1 &&
          gy >= room.gy1 + 2 &&
          gy <= room.gy2 - 1;
        const fill = isCarpet
          ? checker
            ? '#e11d48'
            : '#be123c'
          : checker
          ? room.floorLight
          : room.floorDark;
        this.drawDiamondTile(ctx, gx, gy, fill, room.borderGold, 2);
      }
    }

    // 3. 벽면 횃불 애니메이션
    const torchPos1 = this.isoToScreen(
      (room.gx1 + room.gx2) * 0.5,
      room.gy1 - 0.4,
      wallH * 0.6
    );
    const torchPos2 = this.isoToScreen(
      room.gx1 - 0.4,
      (room.gy1 + room.gy2) * 0.5,
      wallH * 0.6
    );
    this.drawTorchFlame(ctx, torchPos1.x, torchPos1.y, timeSec);
    this.drawTorchFlame(ctx, torchPos2.x, torchPos2.y, timeSec + 1.5);

    // 4. 시설별 아이소메트릭 입체 가구 소품
    if (room.id === 'inn') {
      this.drawInnProps(ctx, room, timeSec);
    } else if (room.id === 'blacksmith') {
      this.drawBlacksmithProps(ctx, room, timeSec);
    } else if (room.id === 'potion') {
      this.drawPotionProps(ctx, room, timeSec);
    } else if (room.id === 'trade') {
      this.drawTradeProps(ctx, room, timeSec);
    }

    // 클릭 판정 영역 저장
    const center = this.isoToScreen(
      (room.gx1 + room.gx2) * 0.5,
      (room.gy1 + room.gy2) * 0.5,
      10
    );
    this.roomScreenBounds.push({
      id: room.id as FacilityId,
      cx: center.x,
      cy: center.y,
      radius: this.tileW * 1.9,
    });
  }

  private drawBackWallRight(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gyEdge: number,
    wallH: number,
    wallColor: string,
    topColor: string,
    strokeColor: string
  ): void {
    const p1 = this.isoToScreen(gx - 0.5, gyEdge, 2);
    const p2 = this.isoToScreen(gx + 0.5, gyEdge, 2);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p2.x, p2.y - wallH);
    ctx.lineTo(p1.x, p1.y - wallH);
    ctx.closePath();
    ctx.fillStyle = wallColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 상단 금테 마감
    ctx.fillStyle = topColor;
    ctx.fillRect(p1.x, p1.y - wallH - 3, p2.x - p1.x, 3);
  }

  private drawBackWallLeft(
    ctx: CanvasRenderingContext2D,
    gxEdge: number,
    gy: number,
    wallH: number,
    wallColor: string,
    topColor: string,
    strokeColor: string
  ): void {
    const p1 = this.isoToScreen(gxEdge, gy - 0.5, 2);
    const p2 = this.isoToScreen(gxEdge, gy + 0.5, 2);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p2.x, p2.y - wallH);
    ctx.lineTo(p1.x, p1.y - wallH);
    ctx.closePath();
    ctx.fillStyle = wallColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = topColor;
    ctx.fillRect(p2.x, p2.y - wallH - 3, p1.x - p2.x, 3);
  }

  private drawTorchFlame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    t: number
  ): void {
    const flicker = Math.sin(t * 10) * 2;
    ctx.fillStyle = '#451a03';
    ctx.fillRect(x - 2, y, 4, 7);

    ctx.beginPath();
    ctx.arc(x, y - 3, 5 + flicker * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y - 3, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#f97316';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y - 4, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
  }

  /**
   * 3D 아이소메트릭 박스 소품 그리기 헬퍼 (테이블, 보물상자, 모루, 진열대 등)
   */
  private drawIsoBox(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    sizeW: number,
    sizeD: number,
    heightPx: number,
    topColor: string,
    leftColor: string,
    rightColor: string,
    outlineColor = '#271c19'
  ): void {
    const pTop = this.isoToScreen(gx - sizeW, gy - sizeD, 2 + heightPx);
    const pRight = this.isoToScreen(gx + sizeW, gy - sizeD, 2 + heightPx);
    const pBottom = this.isoToScreen(gx + sizeW, gy + sizeD, 2 + heightPx);
    const pLeft = this.isoToScreen(gx - sizeW, gy + sizeD, 2 + heightPx);

    const bRight = this.isoToScreen(gx + sizeW, gy - sizeD, 2);
    const bBottom = this.isoToScreen(gx + sizeW, gy + sizeD, 2);
    const bLeft = this.isoToScreen(gx - sizeW, gy + sizeD, 2);

    // 좌측면
    ctx.beginPath();
    ctx.moveTo(pLeft.x, pLeft.y);
    ctx.lineTo(pBottom.x, pBottom.y);
    ctx.lineTo(bBottom.x, bBottom.y);
    ctx.lineTo(bLeft.x, bLeft.y);
    ctx.closePath();
    ctx.fillStyle = leftColor;
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 우측면
    ctx.beginPath();
    ctx.moveTo(pBottom.x, pBottom.y);
    ctx.lineTo(pRight.x, pRight.y);
    ctx.lineTo(bRight.x, bRight.y);
    ctx.lineTo(bBottom.x, bBottom.y);
    ctx.closePath();
    ctx.fillStyle = rightColor;
    ctx.fill();
    ctx.stroke();

    // 윗면
    ctx.beginPath();
    ctx.moveTo(pTop.x, pTop.y);
    ctx.lineTo(pRight.x, pRight.y);
    ctx.lineTo(pBottom.x, pBottom.y);
    ctx.lineTo(pLeft.x, pLeft.y);
    ctx.closePath();
    ctx.fillStyle = topColor;
    ctx.fill();
    ctx.stroke();
  }

  private drawInnProps(
    ctx: CanvasRenderingContext2D,
    room: RoomZone,
    t: number
  ): void {
    // 1. 주방 화덕 & 끓는 스튜 냄비
    this.drawIsoBox(
      ctx,
      room.gx1 + 0.8,
      room.gy1 + 0.8,
      0.55,
      0.55,
      16,
      '#991b1b',
      '#7f1d1d',
      '#450a0a'
    );
    const potPos = this.isoToScreen(room.gx1 + 0.8, room.gy1 + 0.8, 22);
    ctx.beginPath();
    ctx.arc(potPos.x, potPos.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#334155';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();
    // 보글거리는 스튜
    ctx.beginPath();
    ctx.arc(potPos.x, potPos.y - 1, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#f97316';
    ctx.fill();

    // 2. 만찬 테이블 & 황금 보물상자 (첨부 이미지의 빨간 보물상자 감성!)
    this.drawIsoBox(
      ctx,
      room.gx1 + 2.8,
      room.gy1 + 2.5,
      0.7,
      0.5,
      11,
      '#d97706',
      '#b45309',
      '#78350f'
    );
    // 빨간 보물상자 2개
    this.drawTreasureChest(ctx, room.gx2 - 0.8, room.gy1 + 1.4);
    this.drawTreasureChest(ctx, room.gx2 - 0.8, room.gy1 + 2.6);

    // 3. 미니 슬롯머신 아케이드 기기
    this.drawMiniSlotMachineProp(ctx, room.gx1 + 0.9, room.gy2 - 1.0, t);
  }

  private drawBlacksmithProps(
    ctx: CanvasRenderingContext2D,
    room: RoomZone,
    t: number
  ): void {
    // 1. 타오르는 용광로
    this.drawIsoBox(
      ctx,
      room.gx1 + 0.8,
      room.gy1 + 0.8,
      0.6,
      0.6,
      20,
      '#57534e',
      '#44403c',
      '#292524'
    );
    const firePos = this.isoToScreen(room.gx1 + 0.8, room.gy1 + 0.8, 12);
    ctx.beginPath();
    ctx.arc(firePos.x, firePos.y, 6 + Math.sin(t * 8) * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fb923c';
    ctx.fill();

    // 2. 강철 모루 (제작/강화용)
    this.drawIsoBox(
      ctx,
      room.gx1 + 2.6,
      room.gy1 + 2.2,
      0.45,
      0.35,
      12,
      '#94a3b8',
      '#64748b',
      '#334155'
    );

    // 3. 인챈트 보라색 룬 제단
    this.drawIsoBox(
      ctx,
      room.gx2 - 1.0,
      room.gy1 + 1.4,
      0.5,
      0.5,
      14,
      '#c084fc',
      '#9333ea',
      '#581c87'
    );

    // 4. 무기 슬롯머신 기기
    this.drawMiniSlotMachineProp(ctx, room.gx1 + 0.9, room.gy2 - 1.0, t + 1);
  }

  private drawPotionProps(
    ctx: CanvasRenderingContext2D,
    room: RoomZone,
    t: number
  ): void {
    // 1. 얼음/크리스탈 블록 장식 (첨부 이미지 우하단 하늘색 얼음방 감성!)
    this.drawIsoBox(
      ctx,
      room.gx2 - 0.9,
      room.gy1 + 0.9,
      0.55,
      0.55,
      18,
      '#e0f2fe',
      '#7dd3fc',
      '#0284c7',
      '#0369a1'
    );

    // 2. 보글거리는 연금술 가마솥
    const cauldPos = this.isoToScreen(room.gx1 + 2.4, room.gy1 + 2.3, 10);
    ctx.beginPath();
    ctx.arc(cauldPos.x, cauldPos.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cauldPos.x, cauldPos.y - 2, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#a855f7';
    ctx.fill();

    // 마법 거품
    const bY = Math.sin(t * 5) * 3;
    ctx.beginPath();
    ctx.arc(cauldPos.x - 2, cauldPos.y - 5 + bY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f0abfc';
    ctx.fill();

    // 3. 포션 슬롯머신 기기
    this.drawMiniSlotMachineProp(ctx, room.gx1 + 0.9, room.gy2 - 1.0, t + 2);
  }

  private drawTradeProps(
    ctx: CanvasRenderingContext2D,
    room: RoomZone,
    _t: number
  ): void {
    // 1. 빨간 버섯 & 초록 정원 장식 (첨부 이미지 하단 버섯 정원 감성!)
    this.drawMushroomProp(ctx, room.gx1 + 0.8, room.gy2 - 0.8, 1.1);
    this.drawMushroomProp(ctx, room.gx2 - 0.8, room.gy2 - 1.1, 0.85);

    // 2. 교역소 상점 카운터 & 황금 보물상자
    this.drawIsoBox(
      ctx,
      room.gx1 + 2.5,
      room.gy1 + 2.2,
      0.8,
      0.45,
      13,
      '#fbbf24',
      '#d97706',
      '#92400e'
    );
    this.drawTreasureChest(ctx, room.gx2 - 0.9, room.gy1 + 1.2);
  }

  private drawTreasureChest(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number
  ): void {
    this.drawIsoBox(
      ctx,
      gx,
      gy,
      0.38,
      0.32,
      11,
      '#ef4444',
      '#dc2626',
      '#991b1b',
      '#450a0a'
    );
    const lockPos = this.isoToScreen(gx + 0.1, gy + 0.1, 8);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(lockPos.x - 2, lockPos.y - 2, 4, 4);
  }

  private drawMiniSlotMachineProp(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    t: number
  ): void {
    this.drawIsoBox(
      ctx,
      gx,
      gy,
      0.38,
      0.38,
      18,
      '#fbbf24',
      '#f59e0b',
      '#b45309',
      '#451a03'
    );
    const scr = this.isoToScreen(gx, gy, 15);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(scr.x - 7, scr.y - 4, 14, 8);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1;
    ctx.strokeRect(scr.x - 7, scr.y - 4, 14, 8);

    // 반짝이는 777 미니 표시
    ctx.fillStyle = Math.sin(t * 6) > 0 ? '#ef4444' : '#2563eb';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('777', scr.x, scr.y + 3);
  }

  private drawMushroomProp(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    scale: number
  ): void {
    const pos = this.isoToScreen(gx, gy, 4);
    // 기둥
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.5;
    ctx.fillRect(pos.x - 3 * scale, pos.y - 8 * scale, 6 * scale, 8 * scale);
    ctx.strokeRect(pos.x - 3 * scale, pos.y - 8 * scale, 6 * scale, 8 * scale);

    // 빨간 갓
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 9 * scale, 8 * scale, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.stroke();

    // 흰 물방울 무늬
    ctx.beginPath();
    ctx.arc(pos.x - 3 * scale, pos.y - 12 * scale, 2 * scale, 0, Math.PI * 2);
    ctx.arc(pos.x + 3 * scale, pos.y - 11 * scale, 1.8 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  private drawDungeonGateArch(
    ctx: CanvasRenderingContext2D,
    activeDungeon: ActiveDungeonRun | null,
    t: number
  ): void {
    const pos = this.isoToScreen(7, 0.4, 8);

    // 돌 아치 문
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 10, 22, Math.PI, 0);
    ctx.lineTo(pos.x + 22, pos.y + 12);
    ctx.lineTo(pos.x - 22, pos.y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 포탈 내부 빛
    const glow = Math.sin(t * 4) * 0.2 + 0.8;
    ctx.fillStyle = activeDungeon
      ? `rgba(239, 68, 68, ${glow})`
      : `rgba(139, 92, 246, ${glow})`;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 8, 14, Math.PI, 0);
    ctx.lineTo(pos.x + 14, pos.y + 10);
    ctx.lineTo(pos.x - 14, pos.y + 10);
    ctx.closePath();
    ctx.fill();

    this.roomScreenBounds.push({
      id: 'dungeon_gate',
      cx: pos.x,
      cy: pos.y,
      radius: 38,
    });
  }

  /**
   * 카이로소프트 스타일 귀여운 2등신 도트/치비 캐릭터 렌더링
   * 또렷한 다크브라운 외곽선, 통통 튀는 걷기 모션, 귀여운 눈동자와 무기 표현!
   */
  private drawChibiActor(
    ctx: CanvasRenderingContext2D,
    actor: MapActor,
    t: number
  ): void {
    const pos = this.isoToScreen(actor.gridX, actor.gridY, 4);
    const isMoving = actor.state === 'walk';
    const bounce = isMoving
      ? Math.abs(Math.sin(t * 11 + actor.bouncePhase)) * 5
      : Math.sin(t * 3.5 + actor.bouncePhase) * 1.5;

    const x = pos.x;
    const y = pos.y - bounce;

    // 1. 발밑 그림자
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y + 2, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.fill();

    // 2. 다리 (걸을 때 앞뒤로 교차)
    const legSwing = isMoving ? Math.sin(t * 14 + actor.bouncePhase) * 3.5 : 0;
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#1e1b18';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x - 5, y - 5 + legSwing, 4, 6);
    ctx.strokeRect(x - 5, y - 5 + legSwing, 4, 6);
    ctx.fillRect(x + 1, y - 5 - legSwing, 4, 6);
    ctx.strokeRect(x + 1, y - 5 - legSwing, 4, 6);

    // 3. 통통한 몸통 (갑옷 또는 요리사/장인 복장)
    ctx.beginPath();
    ctx.roundRect(x - 7, y - 16, 14, 12, 4);
    ctx.fillStyle = actor.bodyColor;
    ctx.fill();
    ctx.strokeStyle = '#271c19';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // 앞치마나 벨트 포인트
    ctx.fillStyle = actor.accentColor;
    ctx.fillRect(x - 5, y - 9, 10, 3);

    // 4. 큼직하고 귀여운 카이로소프트풍 머리
    ctx.beginPath();
    ctx.arc(x, y - 22, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fde68a'; // 따뜻한 복숭아 피부톤
    ctx.fill();
    ctx.strokeStyle = '#271c19';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // 5. 머리카락 / 모자
    ctx.beginPath();
    ctx.arc(x, y - 24, 8.8, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fillStyle = actor.hairColor;
    ctx.fill();
    ctx.stroke();

    // 요리사나 연금술사 모자
    if (actor.kind === 'staff') {
      ctx.beginPath();
      ctx.roundRect(x - 6, y - 34, 12, 6, 3);
      ctx.fillStyle = actor.accentColor;
      ctx.fill();
      ctx.stroke();
    }

    // 6. 또렷한 눈동자와 볼터치
    const lookOffset = actor.facing === 'se' || actor.facing === 'ne' ? 1.5 : -1.5;
    ctx.fillStyle = '#1e1b18';
    ctx.beginPath();
    ctx.arc(x - 3 + lookOffset, y - 21, 1.5, 0, Math.PI * 2);
    ctx.arc(x + 3 + lookOffset, y - 21, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 귀여운 볼터치
    ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
    ctx.beginPath();
    ctx.arc(x - 5 + lookOffset, y - 19, 1.8, 0, Math.PI * 2);
    ctx.arc(x + 5 + lookOffset, y - 19, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 7. 손에 든 무기나 도구 아이콘
    if (actor.weaponIcon) {
      const toolSwing =
        actor.state === 'work' ? Math.sin(t * 16) * 5 : 0;
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(actor.weaponIcon, x + 11, y - 10 + toolSwing);
    }

    // 8. 캐릭터 발밑 이름표 (깔끔한 가독성!)
    ctx.font = 'bold 11px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    const nameText = actor.roleBadge
      ? `${actor.roleBadge} ${actor.name}`
      : actor.name;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeText(nameText, x, pos.y + 14);
    ctx.fillStyle = actor.kind === 'staff' ? '#fde047' : '#ffffff';
    ctx.fillText(nameText, x, pos.y + 14);
  }

  /**
   * 첨부 레퍼런스 이미지("Ugh...", "Depressed.")와 똑같은 카이로소프트풍 둥근 말풍선!
   */
  private drawSpeechBubble(
    ctx: CanvasRenderingContext2D,
    actor: MapActor
  ): void {
    if (!actor.speechText) return;
    const pos = this.isoToScreen(actor.gridX, actor.gridY, 38);

    ctx.font = 'bold 11.5px "Pretendard", "Noto Sans KR", sans-serif';
    const textWidth = ctx.measureText(actor.speechText).width;
    const padX = 10;
    const bw = Math.max(48, textWidth + padX * 2);
    const bh = 22;
    const bx = pos.x - bw * 0.5;
    const by = pos.y - bh - 8;

    const toneColors: Record<
      MapActor['speechTone'],
      { bg: string; border: string; text: string }
    > = {
      normal: { bg: '#ffffff', border: '#64748b', text: '#1e293b' },
      happy: { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
      ugh: { bg: '#e0e7ff', border: '#6366f1', text: '#1e3a8a' },
      gold: { bg: '#fef08a', border: '#d97706', text: '#78350f' },
    };
    const style = toneColors[actor.speechTone];

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 10);
    ctx.fillStyle = style.bg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = style.border;
    ctx.stroke();

    // 말풍선 꼬리
    ctx.beginPath();
    ctx.moveTo(pos.x - 5, by + bh);
    ctx.lineTo(pos.x, by + bh + 6);
    ctx.lineTo(pos.x + 5, by + bh);
    ctx.closePath();
    ctx.fillStyle = style.bg;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = style.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(actor.speechText, pos.x, by + bh * 0.5);
    ctx.restore();
  }

  private drawRoomBadges(
    ctx: CanvasRenderingContext2D,
    save: GameSaveData,
    t: number
  ): void {
    for (const room of ROOM_ZONES) {
      const fac = save.facilities[room.id as FacilityId];
      const pos = this.isoToScreen(
        (room.gx1 + room.gx2) * 0.5,
        room.gy1 - 0.6,
        38
      );
      const label = `${room.badgeText} (Lv.${fac.level})`;

      ctx.font = 'bold 12px "Pretendard", "Noto Sans KR", sans-serif';
      const tw = ctx.measureText(label).width;
      const bw = tw + 18;
      const bh = 24;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(pos.x - bw * 0.5, pos.y - bh * 0.5, bw, bh, 7);
      ctx.fillStyle = 'rgba(24, 24, 37, 0.88)';
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#fbbf24';
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, pos.x, pos.y);
      ctx.restore();
    }

    // 던전 입구 배지
    const dPos = this.isoToScreen(7, 0.4, 44);
    const dLabel = '⚔️ 던전 원정 출발 (클릭)';
    ctx.font = 'bold 12px "Pretendard", "Noto Sans KR", sans-serif';
    const dw = ctx.measureText(dLabel).width + 18;
    const bounce = Math.sin(t * 4) * 2;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(dPos.x - dw * 0.5, dPos.y - 12 + bounce, dw, 24, 7);
    ctx.fillStyle = '#991b1b';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fca5a5';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dLabel, dPos.x, dPos.y + bounce);
    ctx.restore();
  }

  private drawFloatingPop(
    ctx: CanvasRenderingContext2D,
    pop: FloatingPop
  ): void {
    const ratio = pop.age / pop.maxAge;
    const pos = this.isoToScreen(pop.gridX, pop.gridY, 24 + ratio * 26);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - ratio);
    ctx.font = 'bold 13px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f172a';
    ctx.strokeText(pop.text, pos.x, pos.y);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, pos.x, pos.y);
    ctx.restore();
  }
}

export function getZoneName(zoneId: string): string {
  return DUNGEON_ZONES.find((z) => z.id === zoneId)?.name || '미지의 던전';
}
