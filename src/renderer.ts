import { GUEST_TYPES, SEAT_SLOTS } from './data';
import {
  CLASS_COMBAT_SKILLS,
  MAP_HEIGHT,
  MAP_WIDTH,
  ROOM_TYPE_META,
} from './innMap';
import { DUNGEON_MAP, HERO_CLASSES, HERO_ROSTER_MAP } from './loopData';
import {
  drawGuestCharacter,
  drawHeroCharacter,
  drawMonsterCharacter,
  drawOrderBubble,
  drawPixelSpeechBubble,
  drawStaffCharacter,
} from './sprites';
import {
  ActiveEvent,
  ActiveExpedition,
  CoinParticle,
  DayPhase,
  ExpeditionResultSummary,
  FloatingText,
  GuestEntity,
  HeroActivityState,
  HeroInteractionEffect,
  HeroRole,
  HeroStatus,
} from './types';

export const CANVAS_WIDTH = MAP_WIDTH; // 480
export const CANVAS_HEIGHT = MAP_HEIGHT; // 288

export const DUNGEON_CANVAS_WIDTH = 480;
export const DUNGEON_CANVAS_HEIGHT = 176;

export interface HeroCanvasEntity {
  heroId: string;
  name: string;
  classIcon: string;
  role: HeroRole;
  personalityIcon: string;
  status: HeroStatus;
  activity: HeroActivityState;
  x: number;
  y: number;
  facing: 'left' | 'right';
  hpPct: number;
  speechText: string | null;
  isSelected: boolean;
  hasPlayerOrder: boolean;
  interactionEffect: HeroInteractionEffect | null;
}

export interface RenderContextState {
  time: number;
  dayNumber?: number;
  dayPhase?: DayPhase;
  dayProgressRatio?: number;
  guests: GuestEntity[];
  floatingTexts: FloatingText[];
  particles: CoinParticle[];
  upgrades: Record<string, number>;
  potionTools?: Record<string, number>;
  blacksmithTools?: Record<string, number>;
  heroEntities?: HeroCanvasEntity[];
  selectedHeroId?: string | null;
  activeEvent: ActiveEvent | null;
  maidPos: { x: number; y: number; facing: 'left' | 'right' };
  innkeeperWaveTimer: number;
  expeditions?: ActiveExpedition[];
  focusedExpeditionId?: string | null;
  lastExpeditionResult?: ExpeditionResultSummary | null;
  pendingLootCount?: number;
  potionStockTotal?: number;
  equipStockTotal?: number;
  unpaidWages?: number;
}

const ROLE_RING_COLORS: Record<HeroRole, string> = {
  tank: 'rgba(98, 132, 171, 0.72)', // 강철 블루
  dps: 'rgba(199, 99, 91, 0.72)', // 코랄 레드
  healer: 'rgba(109, 166, 122, 0.72)', // 에메랄드 그린
  support: 'rgba(217, 154, 78, 0.72)', // 허니 골드
};

const ROLE_BADGE_COLORS: Record<HeroRole, string> = {
  tank: '#6284ab',
  dps: '#c7635b',
  healer: '#6da67a',
  support: '#d99a4e',
};

export class InnRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context를 초기화할 수 없습니다.');
    }
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
  }

  public render(state: RenderContextState): void {
    const ctx = this.ctx;
    const t = state.time;
    ctx.imageSmoothingEnabled = false;

    // 1. 전체 여관 바닥 및 상단 벽면, 낮/밤 창문
    this.drawFloorAndWalls(ctx, t, state);

    // 2. 상단 3개 구역: [좌] 포션 가게 코너 / [중] 주방 화덕 & 바 카운터 / [우] 2층 객실·침대 & 온천
    this.drawPotionShopZone(ctx, t, state);
    this.drawBarAndKitchenZone(ctx, t, state);
    this.drawSecondFloorRoomsZone(ctx, t, state);

    // 3. 중단·하단 구역: [중] 거래 가판대 / [중하] 의뢰 게시판 / [우중] 대장간 / [우하] 던전 입구 아치
    this.drawTradeStallZone(ctx, t, state);
    this.drawQuestBoardZone(ctx, t, state);
    this.drawBlacksmithZone(ctx, t, state);
    this.drawDungeonGateZone(ctx, t, state);

    // 4. 구역 표지판 배지
    this.drawZoneSignboards(ctx, state);

    // 5. 고정 NPC 직원들
    this.drawStationaryStaff(ctx, t, state);

    // 6. 식당 홀 테이블 + 방문 손님 + 메이드 + 걸어다니는 영웅 에이전트 (Y좌표 깊이 정렬)
    this.drawHallAndHeroAgents(ctx, t, state);

    // 7. 낮/밤 조명 분위기 오버레이 및 촛불·화덕·창문 불빛 효과
    this.drawDayNightLighting(ctx, t, state);

    // 8. 영웅 말풍선 레이어
    this.drawHeroSpeechBubbles(ctx, state);

    // 9. 코인 파티클 & 떠오르는 텍스트
    this.drawParticlesAndFloatingTexts(ctx, state);
  }

  private drawFloorAndWalls(
    ctx: CanvasRenderingContext2D,
    t: number,
    state: RenderContextState
  ): void {
    // 상단 벽면
    ctx.fillStyle = '#4e382c';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 52);

    ctx.fillStyle = '#664b3c';
    ctx.fillRect(6, 6, CANVAS_WIDTH - 12, 40);

    // 상단 나무 기둥 및 들보
    ctx.fillStyle = '#3b2920';
    for (const bx of [0, 144, 300, 472]) {
      ctx.fillRect(bx, 0, 8, 92);
    }
    ctx.fillRect(0, 0, CANVAS_WIDTH, 6);
    ctx.fillRect(0, 46, CANVAS_WIDTH, 6);

    // 상단 벽면 여관 창문 (낮/밤 하늘과 불빛 표현)
    this.drawWallWindows(ctx, t, state.dayPhase ?? 'day');

    // 메인 1층 따뜻한 원목 마루 바닥
    ctx.fillStyle = '#876040';
    ctx.fillRect(0, 52, CANVAS_WIDTH, CANVAS_HEIGHT - 52);

    // 부드러운 마루 판자 결
    ctx.fillStyle = '#785336';
    for (let y = 64; y < CANVAS_HEIGHT; y += 16) {
      ctx.fillRect(0, y, CANVAS_WIDTH, 1);
      const offset = (y / 16) % 2 === 0 ? 16 : 32;
      for (let x = offset; x < CANVAS_WIDTH; x += 48) {
        ctx.fillRect(x, y - 15, 1, 15);
      }
    }

    // 2층 객실 구역 마루 바닥
    ctx.fillStyle = '#7a5438';
    ctx.fillRect(308, 16, 164, 78);
    ctx.fillStyle = '#69462d';
    for (let y = 28; y < 94; y += 14) {
      ctx.fillRect(308, y, 164, 1);
    }

    // 좌측 하단 손님 출입문
    ctx.fillStyle = '#3b2920';
    ctx.fillRect(0, 168, 10, 42);
    ctx.fillStyle = '#9c6b43';
    ctx.fillRect(2, 172, 6, 34);
    ctx.fillStyle = '#e6c274';
    ctx.fillRect(6, 188, 2, 3);

    // 출입문 환영 러그
    ctx.fillStyle = '#9e4f46';
    ctx.fillRect(12, 178, 30, 22);
    ctx.fillStyle = '#d9a76a';
    ctx.fillRect(14, 180, 26, 1);
    ctx.fillRect(14, 197, 26, 1);

    // 좌하단 약초 정원 화단
    const gardenLv = state.potionTools?.['pot_fac_garden'] ?? 0;
    ctx.fillStyle = '#5c402c';
    ctx.fillRect(18, 258, 86, 18);
    ctx.fillStyle = '#473121';
    ctx.fillRect(20, 260, 82, 14);
    const herbCount = gardenLv > 0 ? 8 : 4;
    for (let i = 0; i < herbCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#659c78' : '#82b88e';
      ctx.fillRect(24 + i * 10, 256, 5, 6);
      ctx.fillStyle = '#a8cfa8';
      ctx.fillRect(25 + i * 10, 255, 3, 2);
    }

    // 축하연 이벤트 가랜드
    if (state.activeEvent?.def.weather === 'celebration') {
      const colors = ['#d47a72', '#e6c274', '#7eb38a', '#78b2bf', '#b592c9'];
      for (let i = 0; i < 24; i++) {
        const lx = 14 + i * 19;
        const ly = 7 + (i % 2) * 3;
        ctx.fillStyle = colors[(i + Math.floor(t * 4)) % colors.length];
        ctx.fillRect(lx, ly, 5, 4);
      }
    }
  }

  private drawWallWindows(
    ctx: CanvasRenderingContext2D,
    t: number,
    phase: DayPhase
  ): void {
    const winPositions = [118, 204, 280];
    const skyColors: Record<DayPhase, { top: string; bot: string }> = {
      morning: { top: '#86b4cf', bot: '#ebd186' },
      day: { top: '#78b2bf', bot: '#b5d8e6' },
      evening: { top: '#7d608a', bot: '#d68a54' },
      night: { top: '#1e2436', bot: '#2c354d' },
    };
    const sky = skyColors[phase] ?? skyColors.day;

    for (const wx of winPositions) {
      const wy = 16;
      // 창문 나무 틀
      ctx.fillStyle = '#3b261b';
      ctx.fillRect(wx - 2, wy - 2, 20, 24);
      // 창밖 하늘
      ctx.fillStyle = sky.top;
      ctx.fillRect(wx, wy, 16, 10);
      ctx.fillStyle = sky.bot;
      ctx.fillRect(wx, wy + 10, 16, 10);

      if (phase === 'night') {
        // 별빛 또는 달빛
        const twinkle = Math.floor(t * 3 + wx) % 2 === 0;
        ctx.fillStyle = twinkle ? '#ebd186' : '#f6efe2';
        ctx.fillRect(wx + 3, wy + 3, 2, 2);
        ctx.fillRect(wx + 11, wy + 5, 2, 2);
      } else if (phase === 'day' || phase === 'morning') {
        // 뭉게구름
        ctx.fillStyle = '#f6efe2';
        ctx.fillRect(wx + 3, wy + 5, 6, 3);
        ctx.fillRect(wx + 9, wy + 11, 5, 2);
      } else if (phase === 'evening') {
        // 노을 해
        ctx.fillStyle = '#ebd186';
        ctx.fillRect(wx + 6, wy + 12, 4, 4);
      }

      // 창문 십자 격자
      ctx.fillStyle = '#4e3526';
      ctx.fillRect(wx + 7, wy, 2, 20);
      ctx.fillRect(wx, wy + 9, 16, 2);
    }
  }

  private drawDayNightLighting(
    ctx: CanvasRenderingContext2D,
    t: number,
    state: RenderContextState
  ): void {
    const phase = state.dayPhase ?? 'day';
    if (phase === 'day') return;

    ctx.save();
    if (phase === 'morning') {
      ctx.fillStyle = 'rgba(235, 209, 134, 0.06)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else if (phase === 'evening') {
      // 따뜻한 노을 색조
      ctx.fillStyle = 'rgba(180, 95, 55, 0.14)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else if (phase === 'night') {
      // 아늑한 밤 색조
      ctx.fillStyle = 'rgba(18, 24, 42, 0.28)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // 저녁·밤에는 창문 바닥 불빛과 화덕·식탁 촛불·용광로·횃불 주변 따뜻한 조명 후광 표시
    if (phase === 'evening' || phase === 'night') {
      const pulse = Math.sin(t * 5) * 1.5;
      const glowColor =
        phase === 'night'
          ? 'rgba(235, 200, 115, 0.18)'
          : 'rgba(235, 190, 110, 0.12)';
      ctx.fillStyle = glowColor;

      // 창문 아래로 드리우는 은은한 달빛/창문 불빛
      for (const wx of [118, 204, 280]) {
        ctx.fillRect(wx - 2, 52, 20, 14);
      }

      // 화덕, 가마솥, 대장간 화로, 던전 아치 횃불 조명
      const lightSpots = [
        { x: 175, y: 36, r: 26 + pulse }, // 주방 화덕
        { x: 110, y: 44, r: 18 + pulse }, // 연금 가마솥
        { x: 376, y: 126, r: 26 + pulse }, // 대장간 용광로
        { x: 456, y: 224, r: 22 + pulse }, // 던전 입구 횃불
        { x: 70, y: 130, r: 16 }, // 식탁 1
        { x: 150, y: 130, r: 16 }, // 식탁 2
        { x: 70, y: 178, r: 16 }, // 식탁 3
        { x: 150, y: 178, r: 16 }, // 식탁 4
        { x: 70, y: 226, r: 16 }, // 식탁 5
        { x: 150, y: 226, r: 16 }, // 식탁 6
      ];
      for (const ls of lightSpots) {
        ctx.beginPath();
        ctx.arc(ls.x, ls.y, ls.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawPotionShopZone(
    ctx: CanvasRenderingContext2D,
    t: number,
    state: RenderContextState
  ): void {
    ctx.fillStyle = '#546e60';
    ctx.fillRect(18, 54, 118, 34);
    ctx.fillStyle = '#789c86';
    ctx.fillRect(20, 56, 114, 1);
    ctx.fillRect(20, 85, 114, 1);

    ctx.fillStyle = '#452f23';
    ctx.fillRect(20, 12, 74, 34);
    ctx.fillStyle = '#73503a';
    ctx.fillRect(22, 22, 70, 3);
    ctx.fillRect(22, 34, 70, 3);

    const bottleColors = ['#7eb38a', '#78b2bf', '#d47a72', '#e6c274', '#b592c9'];
    for (let i = 0; i < 10; i++) {
      const bx = 26 + (i % 5) * 13;
      const by = i < 5 ? 15 : 27;
      ctx.fillStyle = bottleColors[i % bottleColors.length];
      ctx.fillRect(bx, by, 5, 6);
      ctx.fillStyle = '#f6efe2';
      ctx.fillRect(bx + 1, by - 1, 3, 1);
    }

    ctx.fillStyle = '#4e3526';
    ctx.fillRect(24, 46, 92, 14);
    ctx.fillStyle = '#8c6240';
    ctx.fillRect(22, 44, 96, 4);

    ctx.fillStyle = '#b8c0c7';
    ctx.fillRect(32, 39, 7, 5);
    if ((state.potionTools?.['pot_tool_alembic'] ?? 0) > 0) {
      ctx.fillStyle = '#78b2bf';
      ctx.fillRect(54, 36, 7, 8);
      ctx.fillStyle = '#f6efe2';
      ctx.fillRect(56, 34, 3, 2);
    }

    const cauldronX = 102;
    const cauldronY = 38;
    ctx.fillStyle = '#3b3d4a';
    ctx.fillRect(cauldronX, cauldronY, 16, 12);
    ctx.fillStyle = Math.floor(t * 5) % 2 === 0 ? '#9c78b8' : '#7eb38a';
    ctx.fillRect(cauldronX + 2, cauldronY + 1, 12, 3);
    const bOff = Math.floor(t * 6) % 5;
    ctx.fillStyle = '#d8c2e8';
    ctx.fillRect(cauldronX + 5, cauldronY - 2 - bOff, 2, 2);
    ctx.fillRect(cauldronX + 10, cauldronY - 4 - bOff, 2, 2);
  }

  private drawBarAndKitchenZone(
    ctx: CanvasRenderingContext2D,
    t: number,
    state: RenderContextState
  ): void {
    const fx = 156;
    const fy = 10;

    ctx.fillStyle = '#6b4c3e';
    ctx.fillRect(fx, fy, 38, 42);
    ctx.fillStyle = '#2e201b';
    ctx.fillRect(fx + 6, fy + 16, 26, 24);

    const frame = Math.floor(t * 8) % 3;
    ctx.fillStyle = '#c7635b';
    ctx.fillRect(fx + 9, fy + 26 + (frame % 2), 20, 12);
    ctx.fillStyle = '#d68a54';
    ctx.fillRect(fx + 12, fy + 28 - (frame % 2), 14, 9);
    ctx.fillStyle = '#ebd186';
    ctx.fillRect(fx + 15, fy + 31, 8, 6);

    ctx.fillStyle = '#3d404d';
    ctx.fillRect(fx + 42, fy + 28, 14, 11);
    ctx.fillStyle = '#d68a54';
    ctx.fillRect(fx + 44, fy + 29, 10, 2);

    for (let i = 0; i < 2; i++) {
      const kx = 258 + i * 16;
      const ky = 18;
      ctx.fillStyle = '#7d5332';
      ctx.fillRect(kx, ky, 13, 18);
      ctx.fillStyle = '#453a34';
      ctx.fillRect(kx, ky + 4, 13, 2);
      ctx.fillRect(kx, ky + 12, 13, 2);
    }
    if ((state.upgrades['fac_vault'] ?? 0) > 0) {
      ctx.fillStyle = '#5c6670';
      ctx.fillRect(230, 16, 22, 22);
      ctx.fillStyle = '#e6c274';
      ctx.fillRect(238, 24, 5, 5);
    }

    const cx = 168;
    const cy = 56;
    ctx.fillStyle = '#543824';
    ctx.fillRect(cx, cy, 124, 18);
    ctx.fillStyle = '#996b45';
    ctx.fillRect(cx - 2, cy - 2, 128, 5);
    ctx.fillStyle = '#b3835b';
    ctx.fillRect(cx - 1, cy - 1, 126, 2);

    ctx.fillStyle = '#e6c274';
    ctx.fillRect(cx + 22, cy - 6, 4, 4);
    ctx.fillStyle = '#f6efe2';
    ctx.fillRect(cx + 22, cy - 7, 4, 2);
    ctx.fillStyle = '#78b2bf';
    ctx.fillRect(cx + 64, cy - 6, 4, 5);

    if ((state.upgrades['fac_musicbox'] ?? 0) > 0) {
      const mx = cx + 106;
      const my = cy - 9;
      ctx.fillStyle = '#785032';
      ctx.fillRect(mx, my + 4, 8, 5);
      ctx.fillStyle = '#e6c274';
      ctx.fillRect(mx + 2, my, 6, 4);
    }

    for (const sx of [184, 216, 248, 278]) {
      ctx.fillStyle = '#5c3c24';
      ctx.fillRect(sx - 4, 80, 8, 6);
      ctx.fillStyle = '#9e6d44';
      ctx.fillRect(sx - 5, 78, 10, 3);
    }
  }

  private drawSecondFloorRoomsZone(
    ctx: CanvasRenderingContext2D,
    t: number,
    state: RenderContextState
  ): void {
    for (let step = 0; step < 6; step++) {
      ctx.fillStyle = '#8f623d';
      ctx.fillRect(300 + step * 3, 92 - step * 5, 22, 5);
      ctx.fillStyle = '#5e3f26';
      ctx.fillRect(300 + step * 3, 96 - step * 5, 22, 1);
    }

    ctx.fillStyle = '#5e3f26';
    ctx.fillRect(324, 90, 148, 4);
    ctx.fillStyle = '#996b45';
    ctx.fillRect(324, 86, 148, 3);
    for (let rx = 328; rx < 470; rx += 10) {
      ctx.fillRect(rx, 80, 2, 10);
    }

    const isRoyal = (state.upgrades['room_royal'] ?? 0) > 0;
    const quiltColor = isRoyal ? '#9e4b46' : '#658c75';
    const bedXs = [332, 364, 396, 428];
    for (const bx of bedXs) {
      ctx.fillStyle = '#4f3522';
      ctx.fillRect(bx, 26, 22, 32);
      ctx.fillStyle = '#f2e8d5';
      ctx.fillRect(bx + 2, 29, 18, 26);
      ctx.fillStyle = '#fff9ed';
      ctx.fillRect(bx + 4, 31, 14, 6);
      ctx.fillStyle = quiltColor;
      ctx.fillRect(bx + 2, 39, 18, 16);
      ctx.fillStyle = '#e6c274';
      ctx.fillRect(bx + 2, 39, 18, 2);
    }

    if ((state.upgrades['fac_hotspring'] ?? 0) > 0) {
      ctx.fillStyle = '#4b6375';
      ctx.fillRect(436, 62, 32, 22);
      ctx.fillStyle = '#78b2bf';
      ctx.fillRect(439, 65, 26, 16);
      const steamY = Math.floor(t * 4) % 4;
      ctx.fillStyle = 'rgba(246, 239, 226, 0.65)';
      ctx.fillRect(446, 60 - steamY, 3, 3);
      ctx.fillRect(456, 62 - steamY, 3, 3);
    }
  }

  private drawTradeStallZone(
    ctx: CanvasRenderingContext2D,
    _t: number,
    state: RenderContextState
  ): void {
    const tx = 228;
    const ty = 126;

    ctx.fillStyle = '#6e4d3b';
    ctx.fillRect(tx - 4, ty + 16, 78, 38);
    ctx.fillStyle = '#c99b5b';
    ctx.fillRect(tx - 2, ty + 18, 74, 1);

    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#c7635b' : '#f2e5d0';
      ctx.fillRect(tx + i * 10, ty, 10, 11);
    }
    ctx.fillStyle = '#4e3524';
    ctx.fillRect(tx, ty + 11, 70, 2);

    ctx.fillStyle = '#5c3e28';
    ctx.fillRect(tx + 2, ty + 24, 66, 14);
    ctx.fillStyle = '#996b45';
    ctx.fillRect(tx, ty + 22, 70, 4);

    ctx.fillStyle = '#e6c274';
    ctx.fillRect(tx + 10, ty + 17, 7, 5);
    ctx.fillStyle = '#7eb38a';
    ctx.fillRect(tx + 28, ty + 18, 6, 4);
    ctx.fillStyle = '#78b2bf';
    ctx.fillRect(tx + 40, ty + 18, 6, 4);

    if ((state.pendingLootCount ?? 0) > 0) {
      ctx.fillStyle = '#ebd186';
      ctx.fillRect(tx + 54, ty + 16, 8, 6);
    }
  }

  private drawQuestBoardZone(
    ctx: CanvasRenderingContext2D,
    _t: number,
    state: RenderContextState
  ): void {
    const bx = 246;
    const by = 194;

    ctx.fillStyle = '#4b5e6e';
    ctx.fillRect(bx - 16, by + 22, 86, 42);
    ctx.fillStyle = '#89a7bd';
    ctx.fillRect(bx - 14, by + 24, 82, 1);
    ctx.fillRect(bx - 14, by + 61, 82, 1);

    ctx.fillStyle = '#3d291d';
    ctx.fillRect(bx, by, 54, 28);
    ctx.fillStyle = '#7d5538';
    ctx.fillRect(bx + 3, by + 3, 48, 22);

    const boardLv = state.upgrades['fac_board'] ?? 0;
    const count = Math.min(6, 3 + boardLv);
    const coords = [
      [6, 5],
      [18, 6],
      [30, 5],
      [40, 6],
      [12, 14],
      [26, 14],
    ];
    for (let i = 0; i < count; i++) {
      const [px, py] = coords[i];
      ctx.fillStyle = '#f5ead6';
      ctx.fillRect(bx + px, by + py, 8, 8);
      ctx.fillStyle = i % 2 === 0 ? '#c7635b' : '#5c7a9e';
      ctx.fillRect(bx + px + 3, by + py + 1, 2, 2);
    }
  }

  private drawBlacksmithZone(
    ctx: CanvasRenderingContext2D,
    t: number,
    state: RenderContextState
  ): void {
    const sx = 332;
    const sy = 112;

    ctx.fillStyle = '#5a6069';
    ctx.fillRect(sx, sy + 8, 96, 64);
    ctx.fillStyle = '#494e57';
    ctx.fillRect(sx + 3, sy + 11, 90, 58);

    ctx.fillStyle = '#635954';
    ctx.fillRect(sx + 32, sy, 28, 26);
    ctx.fillStyle = '#362d2a';
    ctx.fillRect(sx + 37, sy + 10, 18, 14);
    ctx.fillStyle = Math.floor(t * 8) % 2 === 0 ? '#d68a54' : '#c7635b';
    ctx.fillRect(sx + 39, sy + 13, 14, 10);
    ctx.fillStyle = '#ebd186';
    ctx.fillRect(sx + 42, sy + 16, 8, 6);

    const isMithril = (state.blacksmithTools?.['smith_anvil'] ?? 0) >= 2;
    ctx.fillStyle = '#333840';
    ctx.fillRect(sx + 14, sy + 34, 14, 5);
    ctx.fillStyle = isMithril ? '#78b2bf' : '#b8c0c7';
    ctx.fillRect(sx + 11, sy + 28, 20, 6);
    ctx.fillRect(sx + 8, sy + 29, 4, 4);

    ctx.fillStyle = '#6e492d';
    ctx.fillRect(sx + 6, sy + 46, 12, 12);
    ctx.fillStyle = '#78b2bf';
    ctx.fillRect(sx + 8, sy + 48, 8, 4);

    if ((state.blacksmithTools?.['smith_grindstone'] ?? 0) > 0) {
      ctx.fillStyle = '#996b45';
      ctx.fillRect(sx + 68, sy + 16, 16, 12);
      ctx.fillStyle = '#b8c0c7';
      ctx.fillRect(sx + 71, sy + 12, 10, 10);
    }

    ctx.fillStyle = '#6e492d';
    ctx.fillRect(sx + 60, sy + 42, 28, 16);
    const stockCnt = Math.min(4, Math.max(2, state.equipStockTotal ?? 2));
    for (let i = 0; i < stockCnt; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#e6c274' : '#b8c0c7';
      ctx.fillRect(sx + 64 + i * 6, sy + 36, 2, 16);
    }
  }

  private drawDungeonGateZone(
    ctx: CanvasRenderingContext2D,
    t: number,
    state: RenderContextState
  ): void {
    const gx = 424;
    const gy = 196;

    ctx.fillStyle = '#686b73';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(322 + i * 17, 220 + (i % 2) * 4, 13, 18);
    }

    ctx.fillStyle = '#555b66';
    ctx.fillRect(gx + 16, gy, 36, 62);
    ctx.fillStyle = '#6d7482';
    ctx.fillRect(gx + 12, gy - 4, 44, 8);

    ctx.fillStyle = '#20242e';
    ctx.fillRect(gx + 22, gy + 8, 24, 52);

    const hasExpedition = (state.expeditions?.length ?? 0) > 0;
    if (hasExpedition) {
      const glow = Math.floor(t * 5) % 2 === 0 ? '#5c859e' : '#47687d';
      ctx.fillStyle = glow;
      ctx.fillRect(gx + 26, gy + 14, 16, 42);
    }

    const torchColor = Math.floor(t * 7) % 2 === 0 ? '#d68a54' : '#ebd186';
    ctx.fillStyle = '#4e3524';
    ctx.fillRect(gx + 17, gy + 24, 3, 7);
    ctx.fillRect(gx + 48, gy + 24, 3, 7);
    ctx.fillStyle = torchColor;
    ctx.fillRect(gx + 17, gy + 20, 3, 4);
    ctx.fillRect(gx + 48, gy + 20, 3, 4);
  }

  private drawZoneSignboards(
    ctx: CanvasRenderingContext2D,
    state: RenderContextState
  ): void {
    const signs: { x: number; y: number; text: string; bg: string }[] = [
      { x: 22, y: 6, text: '⚗️포션가게', bg: '#45354f' },
      { x: 196, y: 6, text: '🍺바·주방', bg: '#573b28' },
      { x: 356, y: 6, text: '🛏️2층 객실', bg: '#3e5446' },
      { x: 64, y: 98, text: '🍲1층 식당', bg: '#573b28' },
      {
        x: 234,
        y: 112,
        text: `💎거래소${(state.pendingLootCount ?? 0) > 0 ? '(!)' : ''}`,
        bg: '#59442a',
      },
      { x: 244, y: 181, text: '📋의뢰게시판', bg: '#384b59' },
      { x: 352, y: 98, text: '⚒️대장간', bg: '#474c54' },
      {
        x: 416,
        y: 181,
        text: `🗺️던전입구(${state.expeditions?.length ?? 0})`,
        bg: '#4f3535',
      },
    ];

    ctx.font = 'bold 8px sans-serif';
    for (const s of signs) {
      const w = Math.ceil(ctx.measureText(s.text).width) + 8;
      ctx.fillStyle = '#33241b';
      ctx.fillRect(s.x - 1, s.y - 1, w + 2, 13);
      ctx.fillStyle = s.bg;
      ctx.fillRect(s.x, s.y, w, 11);
      ctx.fillStyle = '#f6efe2';
      ctx.fillText(s.text, s.x + 4, s.y + 9);
    }
  }

  private drawStationaryStaff(
    ctx: CanvasRenderingContext2D,
    t: number,
    state: RenderContextState
  ): void {
    const upgrades = state.upgrades;
    const bob = Math.sin(t * 4) > 0 ? -1 : 0;

    const waveBob = state.innkeeperWaveTimer > 0 ? -2 : bob;
    drawStaffCharacter(ctx, 'innkeeper', 210, 55, 'left', waveBob);

    drawStaffCharacter(
      ctx,
      'alchemist',
      78,
      45,
      'left',
      Math.cos(t * 5) > 0 ? -1 : 0
    );

    drawStaffCharacter(
      ctx,
      'merchant',
      264,
      148,
      'left',
      Math.sin(t * 4.5) > 0 ? -1 : 0
    );

    drawStaffCharacter(
      ctx,
      'blacksmith',
      362,
      138,
      'left',
      Math.cos(t * 6) > 0 ? -1 : 0
    );

    if ((upgrades['staff_bartender'] ?? 0) > 0) {
      drawStaffCharacter(
        ctx,
        'bartender',
        252,
        55,
        'left',
        Math.cos(t * 5.5) > 0 ? -1 : 0
      );
    }

    if ((upgrades['staff_chef'] ?? 0) > 0) {
      drawStaffCharacter(
        ctx,
        'chef',
        186,
        52,
        'left',
        Math.sin(t * 6.5) > 0 ? -1 : 0
      );
    }

    if ((upgrades['staff_bard'] ?? 0) > 0) {
      drawStaffCharacter(
        ctx,
        'bard',
        142,
        104,
        'right',
        Math.sin(t * 7) > 0 ? -1 : 0
      );
      const noteOffset = Math.floor(t * 4) % 6;
      ctx.fillStyle = '#ebd186';
      ctx.fillRect(148, 86 - noteOffset, 2, 2);
    }
  }

  private drawHallAndHeroAgents(
    ctx: CanvasRenderingContext2D,
    t: number,
    state: RenderContextState
  ): void {
    const tables = [
      { x: 58, y: 128 },
      { x: 138, y: 128 },
      { x: 58, y: 176 },
      { x: 138, y: 176 },
      { x: 58, y: 224 },
      { x: 138, y: 224 },
    ];

    interface Drawable {
      y: number;
      draw: () => void;
    }
    const drawables: Drawable[] = [];

    for (const tb of tables) {
      drawables.push({
        y: tb.y + 10,
        draw: () => {
          ctx.fillStyle = 'rgba(42, 28, 18, 0.22)';
          ctx.fillRect(tb.x - 10, tb.y + 12, 44, 4);

          ctx.fillStyle = '#5e3f26';
          ctx.fillRect(tb.x - 9, tb.y + 3, 7, 10);
          ctx.fillRect(tb.x + 26, tb.y + 3, 7, 10);

          ctx.fillStyle = '#543824';
          ctx.fillRect(tb.x, tb.y + 4, 24, 11);
          ctx.fillStyle = '#996b45';
          ctx.fillRect(tb.x - 2, tb.y, 28, 8);
          ctx.fillStyle = '#b3835b';
          ctx.fillRect(tb.x - 1, tb.y + 1, 26, 5);

          ctx.fillStyle = '#f6efe2';
          ctx.fillRect(tb.x + 11, tb.y - 2, 2, 4);
          ctx.fillStyle =
            Math.floor(t * 7 + tb.x) % 2 === 0 ? '#ebd186' : '#d68a54';
          ctx.fillRect(tb.x + 11, tb.y - 4, 2, 2);
        },
      });
    }

    if ((state.upgrades['staff_maid'] ?? 0) > 0) {
      drawables.push({
        y: state.maidPos.y,
        draw: () => {
          drawStaffCharacter(
            ctx,
            'maid',
            state.maidPos.x,
            state.maidPos.y,
            state.maidPos.facing,
            Math.sin(t * 10) > 0 ? -1 : 0
          );
        },
      });
    }

    for (const guest of state.guests) {
      drawables.push({
        y: guest.y,
        draw: () => {
          this.drawSingleGuest(ctx, t, guest);
        },
      });
    }

    // 살아있는 여관 영웅 에이전트들 (발밑 역할 고유 색 링 + 머리 위 직업 아이콘 & 성격 배지)
    if (state.heroEntities) {
      for (const hEnt of state.heroEntities) {
        if (hEnt.status === 'exploring') continue;
        drawables.push({
          y: hEnt.y,
          draw: () => {
            const rx = Math.round(hEnt.x);
            const ry = Math.round(hEnt.y);

            // 발밑 역할별 고유 색 링 + 선택 하이라이트
            const roleRingColor =
              ROLE_RING_COLORS[hEnt.role] ?? 'rgba(120, 178, 191, 0.65)';
            if (hEnt.isSelected) {
              ctx.fillStyle = 'rgba(235, 209, 134, 0.92)';
              ctx.fillRect(rx - 9, ry - 3, 18, 5);
            }
            ctx.fillStyle = roleRingColor;
            ctx.fillRect(rx - 7, ry - 2, 14, 3);

            const walkPhase =
              hEnt.activity === 'walking' ? t * 13 + rx * 0.2 : t * 2;
            drawHeroCharacter(
              ctx,
              hEnt.heroId,
              hEnt.x,
              hEnt.y,
              hEnt.facing,
              walkPhase,
              hEnt.activity,
              t
            );

            // 머리 위 직업 아이콘 + 이름표 + 미니 체력바
            const roleAccent = ROLE_BADGE_COLORS[hEnt.role] ?? '#78b2bf';
            const tagW = 36;
            const tagX = rx - Math.floor(tagW / 2);
            const tagY = ry - 25;

            ctx.fillStyle = hEnt.isSelected
              ? 'rgba(72, 48, 28, 0.95)'
              : 'rgba(36, 26, 20, 0.86)';
            ctx.fillRect(tagX, tagY, tagW, 10);

            // 좌측 역할 색상 포인트 바
            ctx.fillStyle = roleAccent;
            ctx.fillRect(tagX, tagY, 2, 10);

            // 미니 체력바
            ctx.fillStyle = '#261b15';
            ctx.fillRect(tagX + 3, tagY + 8, tagW - 5, 2);
            ctx.fillStyle =
              hEnt.hpPct < 0.45
                ? '#c7635b'
                : hEnt.hpPct < 0.75
                ? '#e6c274'
                : '#7eb38a';
            ctx.fillRect(
              tagX + 3,
              tagY + 8,
              Math.max(2, Math.round((tagW - 5) * hEnt.hpPct)),
              2
            );

            ctx.fillStyle = hEnt.isSelected
              ? '#ebd186'
              : hEnt.hasPlayerOrder
              ? '#a8e0b4'
              : '#f6efe2';
            ctx.font = 'bold 6px sans-serif';
            ctx.fillText(
              `${hEnt.classIcon}${hEnt.name}`,
              tagX + 3,
              tagY + 6
            );

            // 상호작용 시 짧은 아이템/골드 이펙트
            if (hEnt.interactionEffect) {
              const eff = hEnt.interactionEffect;
              const floatY = ry - 30 - Math.round((1.4 - eff.timer) * 6);
              ctx.fillStyle = 'rgba(42, 30, 23, 0.9)';
              ctx.fillRect(rx - 18, floatY - 7, 38, 10);
              ctx.fillStyle = eff.color;
              ctx.font = 'bold 7px sans-serif';
              ctx.fillText(`${eff.icon}${eff.text}`, rx - 16, floatY);
            }
          },
        });
      }
    }

    drawables.sort((a, b) => a.y - b.y);
    for (const item of drawables) {
      item.draw();
    }
  }

  private drawHeroSpeechBubbles(
    ctx: CanvasRenderingContext2D,
    state: RenderContextState
  ): void {
    if (!state.heroEntities) return;
    const candidates = state.heroEntities.filter(
      (h) => h.status !== 'exploring' && Boolean(h.speechText)
    );
    candidates.sort((a, b) => (b.isSelected ? 1 : 0) - (a.isSelected ? 1 : 0));

    const placed: { x: number; y: number }[] = [];
    for (const h of candidates) {
      if (placed.length >= 3 && !h.isSelected) break;
      const tooClose = placed.some(
        (p) => Math.abs(p.x - h.x) < 72 && Math.abs(p.y - h.y) < 32
      );
      if (tooClose && !h.isSelected) continue;

      drawPixelSpeechBubble(ctx, h.speechText!, h.x, h.y, CANVAS_WIDTH);
      placed.push({ x: h.x, y: h.y });
    }
  }

  private drawSingleGuest(
    ctx: CanvasRenderingContext2D,
    t: number,
    guest: GuestEntity
  ): void {
    if (guest.state === 'waiting') {
      const pulse = Math.sin(t * 6) > 0;
      ctx.fillStyle = pulse
        ? 'rgba(230, 194, 116, 0.55)'
        : 'rgba(214, 138, 84, 0.35)';
      ctx.fillRect(Math.round(guest.x - 7), Math.round(guest.y - 3), 14, 4);
    } else {
      ctx.fillStyle = 'rgba(38, 24, 16, 0.24)';
      ctx.fillRect(Math.round(guest.x - 5), Math.round(guest.y - 2), 10, 3);
    }

    const isWalking = guest.state === 'entering' || guest.state === 'leaving';
    const walkPhase = isWalking ? guest.animTime * 14 : 0;

    drawGuestCharacter(
      ctx,
      guest.typeId,
      guest.x,
      guest.y,
      guest.facing,
      walkPhase,
      guest.state === 'enjoying' && guest.isSleeping
    );

    if (guest.state === 'enjoying') {
      const seat = SEAT_SLOTS.find((s) => s.id === guest.seatId);
      if (seat && seat.tableX !== undefined && seat.tableY !== undefined) {
        const tx = seat.tableX;
        const ty = seat.tableY - 6;
        if (guest.orderType === 'stew') {
          ctx.fillStyle = '#7f4f24';
          ctx.fillRect(tx - 3, ty, 6, 3);
          ctx.fillStyle = '#d68a54';
          ctx.fillRect(tx - 2, ty - 1, 4, 2);
        } else if (guest.orderType === 'ale') {
          ctx.fillStyle = '#e6c274';
          ctx.fillRect(tx - 2, ty - 2, 4, 5);
          ctx.fillStyle = '#f6efe2';
          ctx.fillRect(tx - 2, ty - 3, 4, 2);
        } else if (guest.orderType === 'potion') {
          ctx.fillStyle = '#78b2bf';
          ctx.fillRect(tx - 2, ty - 2, 4, 4);
        }
      }
    }

    if (guest.state === 'waiting') {
      drawOrderBubble(ctx, guest.orderType, guest.x, guest.y, t);
    } else if (guest.quoteText && guest.quoteTimer > 0) {
      const def =
        GUEST_TYPES.find((g) => g.id === guest.typeId) ?? GUEST_TYPES[0];
      const label = `${def.name}: ${guest.quoteText}`;
      const bx = Math.max(
        6,
        Math.min(CANVAS_WIDTH - 135, Math.round(guest.x - 50))
      );
      const by = Math.max(8, Math.round(guest.y - 28));
      ctx.fillStyle = 'rgba(42, 30, 23, 0.88)';
      ctx.fillRect(bx, by, 130, 12);
      ctx.strokeStyle = '#c99b5b';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, 129, 11);
      ctx.fillStyle = '#f6efe2';
      ctx.font = '7px sans-serif';
      ctx.fillText(label.slice(0, 21), bx + 4, by + 9);
    }
  }

  private drawParticlesAndFloatingTexts(
    ctx: CanvasRenderingContext2D,
    state: RenderContextState
  ): void {
    for (const p of state.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }

    ctx.font = 'bold 8px monospace';
    for (const ft of state.floatingTexts) {
      const alpha = Math.max(0, Math.min(1, ft.life / ft.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#2e1f18';
      ctx.fillText(ft.text, Math.round(ft.x + 1), Math.round(ft.y + 1));
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, Math.round(ft.x), Math.round(ft.y));
      ctx.restore();
    }
  }
}

// ============================================================================
// 카이로소프트풍 갈래 방 · 테마별 배경 · 직업 기술 이펙트 던전 탐험 렌더러 (480x176)
// ============================================================================

export class DungeonExpeditionRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvas.width = DUNGEON_CANVAS_WIDTH;
    this.canvas.height = DUNGEON_CANVAS_HEIGHT;
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Dungeon Canvas 2D context를 초기화할 수 없습니다.');
    }
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
  }

  public render(state: RenderContextState): void {
    const ctx = this.ctx;
    const t = state.time;
    ctx.imageSmoothingEnabled = false;

    const exps = state.expeditions ?? [];
    const activeExp =
      exps.find((e) => e.id === state.focusedExpeditionId) ?? exps[0] ?? null;

    if (!activeExp) {
      this.drawStandbyScene(ctx, t, state.lastExpeditionResult ?? null);
      return;
    }

    const dungeon = DUNGEON_MAP[activeExp.dungeonId];
    const totalFloors = activeExp.totalFloors ?? 3;
    const currentFloor = activeExp.currentFloor ?? 1;
    const phase = activeExp.floorPhase ?? 'marching';

    // 1. 던전 7종 고유 시각 테마 배경 및 바닥
    this.drawDungeonThemedEnvironment(
      ctx,
      t,
      dungeon?.id ?? 'dungeon_slime',
      dungeon?.tag ?? 'cave',
      phase === 'marching' ? activeExp.marchProgress ?? 0 : 0,
      activeExp.currentRoomType ?? 'combat'
    );

    // 2. 상단 층/갈래 방 미니맵 헤더 (갈래 노드 그래프 표시)
    this.drawBranchingRoomHeader(
      ctx,
      dungeon?.name ?? '던전',
      currentFloor,
      totalFloors,
      phase,
      activeExp
    );

    // 3. 좌측: 원정 파티 영웅 진형 + 성격 돌진/방어 위치 + 직업 기술 배지 + 전투 말풍선
    this.drawPartyFormation(ctx, t, activeExp);

    // 4. 우측: 현재 방 몬스터(행동 특성 배지 포함) 또는 보물/함정/휴식/이벤트 오브젝트
    this.drawMonstersAndRoomProps(ctx, t, activeExp);

    // 5. 직업 기술 시각 이펙트 (방패막, 치유 빛기둥, 범위 화염구, 관통 화살, 치명타 참격 등)
    this.drawSkillEffects(ctx, t, activeExp);

    // 6. 데미지/회복 숫자 플로팅 텍스트
    this.drawCombatFloats(ctx, activeExp);
  }

  private drawStandbyScene(
    ctx: CanvasRenderingContext2D,
    t: number,
    lastResult: ExpeditionResultSummary | null
  ): void {
    ctx.fillStyle = '#26232b';
    ctx.fillRect(0, 0, DUNGEON_CANVAS_WIDTH, DUNGEON_CANVAS_HEIGHT);

    ctx.fillStyle = '#38343f';
    ctx.fillRect(0, 126, DUNGEON_CANVAS_WIDTH, 50);
    for (let x = 0; x < DUNGEON_CANVAS_WIDTH; x += 32) {
      ctx.fillStyle = '#2d2933';
      ctx.fillRect(x, 126, 2, 50);
    }

    const flicker = Math.floor(t * 6) % 2 === 0 ? '#d68a54' : '#ebd186';
    for (const tx of [90, 240, 390]) {
      ctx.fillStyle = '#5c402c';
      ctx.fillRect(tx, 72, 4, 12);
      ctx.fillStyle = flicker;
      ctx.fillRect(tx - 1, 66, 6, 6);
    }

    ctx.fillStyle = '#ebd186';
    ctx.font = 'bold 10px sans-serif';
    if (lastResult) {
      const statusStr = lastResult.success
        ? '🏆 공략 성공 귀환!'
        : '💥 부상 후퇴 귀환';
      ctx.fillText(
        `${statusStr} [${lastResult.dungeonName}] — 파티: ${lastResult.heroNames.join(' · ')}`,
        24,
        56
      );
      ctx.fillStyle = '#d4bfa8';
      ctx.font = '9px sans-serif';
      const lootText = Object.entries(lastResult.lootDropped)
        .filter(([, c]) => c > 0)
        .map(([k, c]) => `${k.replace('mat_', '')} x${c}`)
        .join(', ');
      ctx.fillText(
        `획득: XP +${lastResult.xpGained}, 골드 +${lastResult.heroGoldGained}G ${
          lootText ? `| 드랍: ${lootText}` : ''
        } (여관에서 정비 후 다음 원정을 준비합니다)`,
        24,
        78
      );
    } else {
      ctx.fillText('🗺️ 현재 던전을 탐험 중인 파티가 없습니다.', 24, 62);
      ctx.fillStyle = '#d4bfa8';
      ctx.font = '9px sans-serif';
      ctx.fillText(
        '영웅들이 여관에서 식사·휴식·쇼핑을 마치고 의뢰 게시판에 모이면 갈래 방 던전으로 출발합니다!',
        24,
        82
      );
    }
  }

  private drawDungeonThemedEnvironment(
    ctx: CanvasRenderingContext2D,
    t: number,
    dungeonId: string,
    tag: string,
    marchOffset: number,
    roomType: string
  ): void {
    const themes: Record<
      string,
      { wall: string; brick: string; floor: string; accent: string }
    > = {
      cave: {
        wall: '#263330',
        brick: '#344742',
        floor: '#425952',
        accent: '#6da67a',
      },
      camp: {
        wall: '#382921',
        brick: '#4d382d',
        floor: '#5e4639',
        accent: '#d68a54',
      },
      forest: {
        wall: '#1f332c',
        brick: '#2d473e',
        floor: '#3b594e',
        accent: '#82b88e',
      },
      magic: {
        wall: '#2b223d',
        brick: '#3c3054',
        floor: '#4e3f6b',
        accent: '#b592c9',
      },
      mine: {
        wall: '#332e2a',
        brick: '#47403a',
        floor: '#595149',
        accent: '#78b2bf',
      },
      sanctum: {
        wall: '#2d2838',
        brick: '#40394f',
        floor: '#534b66',
        accent: '#ebd186',
      },
      volcano: {
        wall: '#3d1f1d',
        brick: '#542b28',
        floor: '#663531',
        accent: '#e07a5f',
      },
    };
    const th = themes[tag] ?? themes.cave;

    // 배경 벽
    ctx.fillStyle = th.wall;
    ctx.fillRect(0, 34, DUNGEON_CANVAS_WIDTH, 96);

    const scrollPx = Math.floor(marchOffset * 64) % 32;
    ctx.fillStyle = th.brick;
    for (let x = -scrollPx; x < DUNGEON_CANVAS_WIDTH; x += 32) {
      ctx.fillRect(x, 42, 28, 18);
      ctx.fillRect(x + 12, 66, 28, 18);
      ctx.fillRect(x, 90, 28, 20);
    }

    // 바닥
    ctx.fillStyle = th.floor;
    ctx.fillRect(0, 128, DUNGEON_CANVAS_WIDTH, 48);
    ctx.fillStyle = th.wall;
    ctx.fillRect(0, 128, DUNGEON_CANVAS_WIDTH, 2);
    for (let x = -scrollPx; x < DUNGEON_CANVAS_WIDTH; x += 24) {
      ctx.fillRect(x, 130, 2, 46);
    }

    // 던전별 고유 시각 테마 디테일
    if (dungeonId === 'dungeon_slime' || tag === 'cave') {
      // 천장 종유석 & 바닥 발광 슬라임 점액 웅덩이
      ctx.fillStyle = '#4f6b61';
      for (let x = 20 - scrollPx; x < DUNGEON_CANVAS_WIDTH; x += 56) {
        ctx.fillRect(x, 34, 8, 10);
        ctx.fillRect(x + 2, 44, 4, 6);
      }
      ctx.fillStyle =
        Math.floor(t * 4) % 2 === 0 ? '#6da67a' : '#558b73';
      for (let x = 60 - scrollPx; x < DUNGEON_CANVAS_WIDTH; x += 110) {
        ctx.fillRect(x, 152, 24, 6);
      }
    } else if (dungeonId === 'dungeon_goblin' || tag === 'camp') {
      // 고블린 통나무 목책 & 해골 깃발
      for (let x = 36 - scrollPx; x < DUNGEON_CANVAS_WIDTH; x += 84) {
        ctx.fillStyle = '#6b482e';
        ctx.fillRect(x, 54, 6, 74);
        ctx.fillRect(x + 8, 58, 6, 70);
        ctx.fillStyle = '#c7635b';
        ctx.fillRect(x - 2, 62, 18, 12);
        ctx.fillStyle = '#f6efe2';
        ctx.fillRect(x + 5, 65, 4, 5);
      }
    } else if (dungeonId === 'dungeon_shadow_forest' || tag === 'forest') {
      // 고대 거목 기둥 & 자욱하게 흐르는 안개 레이어 & 반딧불이
      for (let x = 24 - scrollPx; x < DUNGEON_CANVAS_WIDTH; x += 76) {
        ctx.fillStyle = '#25382f';
        ctx.fillRect(x, 34, 16, 94);
        ctx.fillStyle = '#476e5b';
        ctx.fillRect(x - 6, 34, 28, 16);
      }
      ctx.fillStyle = 'rgba(210, 232, 222, 0.14)';
      const mistShift = Math.floor(t * 14) % 48;
      ctx.fillRect(-mistShift, 108, DUNGEON_CANVAS_WIDTH + 48, 16);
      ctx.fillStyle = '#ebd186';
      for (let i = 0; i < 6; i++) {
        const fx = (i * 83 + Math.floor(t * 18)) % DUNGEON_CANVAS_WIDTH;
        const fy = 64 + Math.floor(Math.sin(t * 3 + i) * 14);
        ctx.fillRect(fx, fy, 2, 2);
      }
    } else if (dungeonId === 'dungeon_ruined_tower' || tag === 'magic') {
      // 부유하는 비전 마력 수정 기둥 & 별빛 아치 창문
      for (let x = 52 - scrollPx; x < DUNGEON_CANVAS_WIDTH; x += 96) {
        ctx.fillStyle = '#1c162b';
        ctx.fillRect(x, 48, 18, 34);
        ctx.fillStyle = '#ebd186';
        ctx.fillRect(x + 5, 56, 2, 2);
        ctx.fillRect(x + 11, 66, 2, 2);
        const bob = Math.floor(Math.sin(t * 4 + x) * 3);
        ctx.fillStyle = '#78b2bf';
        ctx.fillRect(x + 28, 68 + bob, 8, 14);
      }
    } else if (dungeonId === 'dungeon_dwarf_mine' || tag === 'mine') {
      // 광산 나무 버팀목, 미스릴 광맥, 바닥 광차 레일
      for (let x = 32 - scrollPx; x < DUNGEON_CANVAS_WIDTH; x += 88) {
        ctx.fillStyle = '#6b482e';
        ctx.fillRect(x, 36, 8, 92);
        ctx.fillRect(x - 10, 36, 28, 6);
        ctx.fillStyle = '#78b2bf';
        ctx.fillRect(x + 24, 78, 6, 6);
        ctx.fillRect(x + 30, 84, 5, 4);
      }
      ctx.fillStyle = '#8c969e';
      ctx.fillRect(0, 148, DUNGEON_CANVAS_WIDTH, 2);
      ctx.fillRect(0, 158, DUNGEON_CANVAS_WIDTH, 2);
    } else if (dungeonId === 'dungeon_abyss_sanctum' || tag === 'sanctum') {
      // 성소 스테인드글라스 아치와 푸른 영혼 불꽃
      for (let x = 44 - scrollPx; x < DUNGEON_CANVAS_WIDTH; x += 92) {
        ctx.fillStyle = '#6284ab';
        ctx.fillRect(x, 46, 12, 36);
        ctx.fillStyle = '#b592c9';
        ctx.fillRect(x + 12, 46, 12, 36);
        ctx.fillStyle = '#78b2bf';
        ctx.fillRect(x + 42, 68, 6, 8);
      }
    } else if (dungeonId === 'dungeon_dragon_lair' || tag === 'volcano') {
      // 화산 둥지 끓어오르는 마그마 강 & 불티
      ctx.fillStyle = Math.floor(t * 6) % 2 === 0 ? '#c7635b' : '#d68a54';
      ctx.fillRect(0, 164, DUNGEON_CANVAS_WIDTH, 12);
      ctx.fillStyle = '#ebd186';
      for (let x = (Math.floor(t * 25) % 40); x < DUNGEON_CANVAS_WIDTH; x += 40) {
        ctx.fillRect(x, 167, 14, 4);
      }
      for (let i = 0; i < 8; i++) {
        const ex = (i * 67 + Math.floor(t * 22)) % DUNGEON_CANVAS_WIDTH;
        const ey = 120 - ((Math.floor(t * 30) + i * 19) % 70);
        ctx.fillStyle = i % 2 === 0 ? '#ebd186' : '#d68a54';
        ctx.fillRect(ex, ey, 2, 2);
      }
    }

    // 현재 방 타입 표시 배너 (전투/보물/함정/휴식/이벤트/정예/보스)
    const rMeta =
      ROOM_TYPE_META[roomType as keyof typeof ROOM_TYPE_META] ??
      ROOM_TYPE_META.combat;
    ctx.fillStyle = 'rgba(32, 23, 19, 0.82)';
    ctx.fillRect(10, 40, 118, 15);
    ctx.strokeStyle = rMeta.color;
    ctx.strokeRect(10.5, 40.5, 117, 14);
    ctx.fillStyle = rMeta.color;
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText(`${rMeta.icon} 현재 방: ${rMeta.label}`, 15, 50);
  }

  private drawBranchingRoomHeader(
    ctx: CanvasRenderingContext2D,
    dungeonName: string,
    currentFloor: number,
    totalFloors: number,
    phase: string,
    exp: ActiveExpedition
  ): void {
    ctx.fillStyle = 'rgba(28, 20, 16, 0.94)';
    ctx.fillRect(0, 0, DUNGEON_CANVAS_WIDTH, 34);
    ctx.fillStyle = '#5c4333';
    ctx.fillRect(0, 33, DUNGEON_CANVAS_WIDTH, 1);

    const rMeta =
      ROOM_TYPE_META[exp.currentRoomType ?? 'combat'] ?? ROOM_TYPE_META.combat;
    const phaseLabel =
      phase === 'marching'
        ? '🏃 갈래길 이동 중'
        : phase === 'fighting'
        ? `${rMeta.icon} ${rMeta.label} 진행 중`
        : phase === 'floor_clear'
        ? '✨ 방 돌파 완료!'
        : '🗺️ 탐험 중';

    ctx.fillStyle = '#ebd186';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(
      `${dungeonName} [${currentFloor}/${totalFloors}층]`,
      10,
      14
    );
    ctx.fillStyle = '#d4bfa8';
    ctx.font = '8px sans-serif';
    ctx.fillText(
      `${phaseLabel} (남은 시간 ${Math.ceil(exp.remainingSec)}초)`,
      10,
      27
    );

    // 우측: 갈래 방 노드 그래프 미니맵 (1F ~ 5F, 중간층은 위/아래 2갈래 표시)
    const graph = exp.roomGraph ?? [];
    const visited = new Set(exp.visitedRoomIds ?? []);
    const curId = exp.currentRoomId ?? `f${currentFloor}_b0`;

    const startX = 225;
    const stepX = Math.min(52, Math.floor(230 / Math.max(1, totalFloors - 1)));

    // 1. 노드 간 연결선 그리기
    const nodePos = new Map<string, { x: number; y: number }>();
    for (let f = 1; f <= totalFloors; f++) {
      const nodes = graph[f - 1] ?? [];
      const nx = startX + (f - 1) * stepX;
      if (nodes.length === 1) {
        nodePos.set(nodes[0].id, { x: nx, y: 17 });
      } else if (nodes.length >= 2) {
        nodePos.set(nodes[0].id, { x: nx, y: 9 });
        nodePos.set(nodes[1].id, { x: nx, y: 25 });
      }
    }

    ctx.lineWidth = 1;
    for (const floorNodes of graph) {
      for (const node of floorNodes) {
        const from = nodePos.get(node.id);
        if (!from) continue;
        for (const nextId of node.nextIds) {
          const to = nodePos.get(nextId);
          if (!to) continue;
          const isPathTaken =
            visited.has(node.id) && (visited.has(nextId) || curId === nextId);
          ctx.strokeStyle = isPathTaken ? '#ebd186' : '#4e3b2e';
          ctx.beginPath();
          ctx.moveTo(from.x + 8, from.y);
          ctx.lineTo(to.x - 8, to.y);
          ctx.stroke();
        }
      }
    }

    // 2. 각 방 노드 박스 및 아이콘 그리기
    for (const floorNodes of graph) {
      for (const node of floorNodes) {
        const pos = nodePos.get(node.id);
        if (!pos) continue;
        const isCur = node.id === curId;
        const isVis = visited.has(node.id);

        ctx.fillStyle = isCur
          ? '#c9934b'
          : isVis
          ? '#3f6e4d'
          : '#33261e';
        ctx.fillRect(pos.x - 10, pos.y - 6, 20, 12);
        ctx.strokeStyle = isCur
          ? '#fff9ed'
          : isVis
          ? '#7eb38a'
          : '#594335';
        ctx.strokeRect(pos.x - 9.5, pos.y - 5.5, 19, 11);

        ctx.fillStyle = '#f6efe2';
        ctx.font = '8px sans-serif';
        ctx.fillText(node.icon, pos.x - 5, pos.y + 3);
      }
    }
  }

  private drawPartyFormation(
    ctx: CanvasRenderingContext2D,
    t: number,
    exp: ActiveExpedition
  ): void {
    const heroIds = exp.heroIds;
    const phase = exp.floorPhase ?? 'marching';

    heroIds.forEach((hId, idx) => {
      const roster = HERO_ROSTER_MAP[hId];
      if (!roster) return;
      const cls = HERO_CLASSES[roster.classId];
      const skillDef = CLASS_COMBAT_SKILLS[roster.classId];
      const cState = exp.partyCombatState?.[hId];
      const lunge = (cState?.lungeTimer ?? 0) > 0 ? 12 : 0;
      const stance = cState?.stanceOffset ?? 0;
      const baseX = 178 - idx * 40 + lunge + stance;
      const baseY = 144 + (idx % 2) * 9;

      // 역할별 발밑 링
      ctx.fillStyle = ROLE_RING_COLORS[cls.role] ?? 'rgba(20, 14, 10, 0.35)';
      ctx.fillRect(baseX - 8, baseY - 2, 16, 4);

      const walkPhase =
        phase === 'marching' ? t * 14 + idx : (cState?.lungeTimer ?? 0) * 20;
      drawHeroCharacter(
        ctx,
        hId,
        baseX,
        baseY,
        'right',
        walkPhase,
        phase === 'marching' ? 'walking' : 'idle',
        t
      );

      // 영웅 HP 바 & 직업 아이콘 이름표
      const hpPct = cState
        ? Math.max(0, Math.min(1, cState.currentHp / Math.max(1, cState.maxHp)))
        : 1;
      const bx = baseX - 18;
      const by = baseY - 28;
      ctx.fillStyle = 'rgba(32, 23, 19, 0.88)';
      ctx.fillRect(bx, by, 36, 10);
      ctx.fillStyle = '#f6efe2';
      ctx.font = 'bold 6px sans-serif';
      ctx.fillText(`${cls.icon}${roster.name}`, bx + 2, by + 6);

      ctx.fillStyle = '#2b1e17';
      ctx.fillRect(bx + 2, by + 7, 32, 2);
      ctx.fillStyle = hpPct < 0.4 ? '#c7635b' : '#7eb38a';
      ctx.fillRect(bx + 2, by + 7, Math.round(32 * hpPct), 2);

      // 발동 중인 직업 기술 배지
      if ((cState?.skillTimer ?? 0) > 0 && skillDef) {
        ctx.fillStyle = 'rgba(38, 26, 20, 0.92)';
        ctx.fillRect(baseX - 20, by - 11, 42, 10);
        ctx.fillStyle = skillDef.color;
        ctx.font = 'bold 7px sans-serif';
        ctx.fillText(skillDef.shortLabel, baseX - 18, by - 3);
      }

      // 성격 전투 말풍선 (겹치지 않게 상단에 표시)
      if ((cState?.combatSpeechTimer ?? 0) > 0 && cState?.combatSpeech) {
        drawPixelSpeechBubble(
          ctx,
          cState.combatSpeech,
          baseX,
          baseY - 12,
          DUNGEON_CANVAS_WIDTH
        );
      }
    });
  }

  private drawMonstersAndRoomProps(
    ctx: CanvasRenderingContext2D,
    t: number,
    exp: ActiveExpedition
  ): void {
    const roomType = exp.currentRoomType ?? 'combat';
    const phase = exp.floorPhase ?? 'marching';

    // 비전투 특수 방 오브젝트 연출 (보물상자 / 함정 기어 / 휴식 모닥불 / 이벤트 석상)
    if (roomType === 'treasure') {
      const cx = 310;
      const cy = 140;
      ctx.fillStyle = '#5c3c24';
      ctx.fillRect(cx - 12, cy - 14, 24, 14);
      ctx.fillStyle = '#e6c274';
      ctx.fillRect(cx - 12, cy - 16, 24, 4);
      ctx.fillRect(cx - 2, cy - 10, 4, 5);
      ctx.fillStyle = '#ebd186';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('🎁 고대 보물상자', cx - 28, cy - 22);
    } else if (roomType === 'trap') {
      const cx = 285;
      const cy = 144;
      ctx.fillStyle = '#8c969e';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(cx + i * 12, cy - 8, 4, 8);
      }
      ctx.fillStyle = '#e09f67';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('⚙️ 고대 톱니 함정', cx - 10, cy - 16);
    } else if (roomType === 'rest') {
      const cx = 300;
      const cy = 144;
      ctx.fillStyle = '#6b482e';
      ctx.fillRect(cx - 10, cy - 4, 20, 4);
      ctx.fillStyle = Math.floor(t * 7) % 2 === 0 ? '#d68a54' : '#ebd186';
      ctx.fillRect(cx - 6, cy - 14, 12, 10);
      ctx.fillStyle = '#7eb38a';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('🏕️ 안식의 모닥불', cx - 26, cy - 20);
    } else if (roomType === 'event') {
      const cx = 310;
      const cy = 144;
      ctx.fillStyle = '#7c858e';
      ctx.fillRect(cx - 8, cy - 26, 16, 26);
      ctx.fillStyle = '#78b2bf';
      ctx.fillRect(cx - 4, cy - 20, 8, 8);
      ctx.fillStyle = '#78b2bf';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('❓ 신비한 유적 제단', cx - 30, cy - 32);
    }

    // 전투 / 정예 / 보스 몬스터 렌더링
    const monsters = exp.monsters ?? [];
    if (phase !== 'marching' && monsters.length > 0) {
      monsters.forEach((m, idx) => {
        if (m.currentHp <= 0) return;
        const lunge = m.lungeTimer > 0 ? -12 : 0;
        const mx = 294 + idx * 62 + lunge;
        const my = m.isBoss ? 148 : 142 + (idx % 2) * 8;

        ctx.fillStyle = 'rgba(20, 14, 10, 0.38)';
        ctx.fillRect(mx - (m.isBoss ? 12 : 7), my - 2, m.isBoss ? 24 : 14, 4);

        drawMonsterCharacter(
          ctx,
          m.spriteType,
          mx,
          my,
          m.isBoss,
          m.hitFlashTimer > 0,
          t * 6 + idx
        );

        // 몬스터 이름 + 행동 특성 배지 + HP바
        const hpPct = Math.max(
          0,
          Math.min(1, m.currentHp / Math.max(1, m.maxHp))
        );
        const barW = m.isBoss ? 56 : 46;
        const bx = mx - Math.floor(barW / 2);
        const by = my - (m.isBoss ? 36 : 26);

        ctx.fillStyle = 'rgba(28, 20, 16, 0.9)';
        ctx.fillRect(bx, by, barW, 14);
        ctx.fillStyle = m.isBoss ? '#ebd186' : '#f6efe2';
        ctx.font = 'bold 6px sans-serif';
        ctx.fillText(m.name.slice(0, 8), bx + 2, by + 6);

        // 행동 특성 라벨 (돌진/원거리/맹독/무리/브레스)
        ctx.fillStyle = '#e09f67';
        ctx.font = '6px sans-serif';
        ctx.fillText(m.behaviorLabel ?? '⚔️일반', bx + 2, by + 11);

        ctx.fillStyle = '#2b1e17';
        ctx.fillRect(bx + 2, by + 12, barW - 4, 2);
        ctx.fillStyle = '#c7635b';
        ctx.fillRect(bx + 2, by + 12, Math.round((barW - 4) * hpPct), 2);
      });
    }

    // 드랍 전리품 연출
    for (const drop of exp.dropVisuals ?? []) {
      const dx = Math.round(drop.x);
      const dy = Math.round(drop.y);
      ctx.fillStyle = 'rgba(42, 30, 23, 0.94)';
      ctx.fillRect(dx - 26, dy - 10, 68, 13);
      ctx.strokeStyle = '#e6c274';
      ctx.strokeRect(dx - 25.5, dy - 9.5, 67, 12);
      ctx.fillStyle = '#ebd186';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText(`${drop.icon} ${drop.name} +${drop.count}`, dx - 23, dy - 1);
    }
  }

  private drawSkillEffects(
    ctx: CanvasRenderingContext2D,
    _t: number,
    exp: ActiveExpedition
  ): void {
    const effects = exp.skillEffects ?? [];
    for (const eff of effects) {
      const progress = 1 - Math.max(0, Math.min(1, eff.life / eff.maxLife));
      const curX = Math.round(
        eff.startX + (eff.targetX - eff.startX) * progress
      );
      const curY = Math.round(
        eff.startY + (eff.targetY - eff.startY) * progress
      );

      ctx.save();
      if (
        eff.kind === 'shield_taunt' ||
        eff.kind === 'holy_barrier' ||
        eff.kind === 'iron_wall'
      ) {
        // 탱커 전열 방패막 & 도발 파동
        ctx.strokeStyle = eff.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(eff.startX + 8, eff.startY - 22, 6, 22);
        ctx.fillStyle = 'rgba(120, 178, 191, 0.32)';
        ctx.fillRect(eff.startX + 8, eff.startY - 22, 6, 22);
      } else if (eff.kind === 'heal_light') {
        // 사제 치유의 빛기둥
        ctx.fillStyle = 'rgba(126, 179, 138, 0.38)';
        ctx.fillRect(eff.targetX - 8, eff.targetY - 38, 16, 38);
        ctx.fillStyle = '#a8e0b4';
        ctx.fillRect(eff.targetX - 2, eff.targetY - 28, 4, 12);
        ctx.fillRect(eff.targetX - 6, eff.targetY - 24, 12, 4);
      } else if (eff.kind === 'aoe_magic') {
        // 마법사 범위 마법 구체 & 폭발
        ctx.fillStyle = eff.color;
        ctx.beginPath();
        ctx.arc(curX, curY, 4 + progress * 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ebd186';
        ctx.fillRect(curX - 3, curY - 3, 6, 6);
      } else if (eff.kind === 'arrow_shot') {
        // 궁수 관통 화살 투사체
        ctx.fillStyle = '#ebd186';
        ctx.fillRect(curX - 6, curY, 12, 2);
        ctx.fillStyle = '#7eb38a';
        ctx.fillRect(curX + 4, curY - 1, 3, 4);
      } else if (eff.kind === 'crit_slash' || eff.kind === 'cleave_axe') {
        // 도적 급소 치명타 X자 참격 / 광전사 도끼 참격
        ctx.strokeStyle = eff.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(eff.targetX - 10, eff.targetY - 22);
        ctx.lineTo(eff.targetX + 10, eff.targetY - 2);
        ctx.moveTo(eff.targetX + 10, eff.targetY - 22);
        ctx.lineTo(eff.targetX - 10, eff.targetY - 2);
        ctx.stroke();
      } else if (eff.kind === 'trap_disarm' || eff.kind === 'rally_buff') {
        ctx.fillStyle = '#ebd186';
        ctx.fillRect(curX - 4, curY - 18, 8, 8);
      } else if (
        eff.kind === 'monster_projectile' ||
        eff.kind === 'poison_cloud' ||
        eff.kind === 'fire_breath'
      ) {
        ctx.fillStyle = eff.color;
        ctx.beginPath();
        ctx.arc(curX, curY, eff.kind === 'fire_breath' ? 9 : 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawCombatFloats(
    ctx: CanvasRenderingContext2D,
    exp: ActiveExpedition
  ): void {
    ctx.font = 'bold 8px monospace';
    for (const cf of exp.combatFloats ?? []) {
      ctx.fillStyle = '#231712';
      ctx.fillText(cf.text, Math.round(cf.x + 1), Math.round(cf.y + 1));
      ctx.fillStyle = cf.color;
      ctx.fillText(cf.text, Math.round(cf.x), Math.round(cf.y));
    }
  }
}
