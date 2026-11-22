import { GUEST_TYPES, SEAT_SLOTS } from './data';
import { MAP_HEIGHT, MAP_WIDTH } from './innMap';
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
  ExpeditionResultSummary,
  FloatingText,
  GuestEntity,
  HeroActivityState,
  HeroInteractionEffect,
  HeroStatus,
} from './types';

export const CANVAS_WIDTH = MAP_WIDTH; // 480
export const CANVAS_HEIGHT = MAP_HEIGHT; // 288

export const DUNGEON_CANVAS_WIDTH = 480;
export const DUNGEON_CANVAS_HEIGHT = 136;

export interface HeroCanvasEntity {
  heroId: string;
  name: string;
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
}

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

    // 1. 전체 여관 바닥 및 상단 벽면, 구역 카펫
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

    // 4. 구역 표지판 배지 (카이로소프트풍 아늑한 구역 라벨)
    this.drawZoneSignboards(ctx, state);

    // 5. 고정 NPC 직원들 (주인장, 바텐더, 요리사, 음유시인, 연금술사, 대장장이, 상인)
    this.drawStationaryStaff(ctx, t, state);

    // 6. 식당 홀 테이블 + 방문 손님 + 메이드 + 걸어다니는 영웅 에이전트 (Y좌표 깊이 정렬)
    this.drawHallAndHeroAgents(ctx, t, state);

    // 7. 영웅 말풍선 레이어 (겹침 방지 처리된 한국어 말구름)
    this.drawHeroSpeechBubbles(ctx, state);

    // 8. 코인 파티클 & 떠오르는 텍스트
    this.drawParticlesAndFloatingTexts(ctx, state);
  }

  private drawFloorAndWalls(
    ctx: CanvasRenderingContext2D,
    t: number,
    state: RenderContextState
  ): void {
    // 상단 벽면 (따뜻하고 채도를 낮춘 회벽과 원목 기둥)
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

    // 메인 1층 따뜻한 원목 마루 바닥 (y: 52..288)
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

    // 2층 객실 구역 마루 바닥 (우상단 x: 308..472, y: 16..94)
    ctx.fillStyle = '#7a5438';
    ctx.fillRect(308, 16, 164, 78);
    ctx.fillStyle = '#69462d';
    for (let y = 28; y < 94; y += 14) {
      ctx.fillRect(308, y, 164, 1);
    }

    // 좌측 하단 손님 출입문 (x: 0..12, y: 168..210)
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

    // 좌하단 약초 정원 화단 (x: 16..108, y: 256..278)
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

  private drawPotionShopZone(
    ctx: CanvasRenderingContext2D,
    t: number,
    state: RenderContextState
  ): void {
    // 좌상단 포션 가게 코너 (x: 14..140, y: 14..90)
    // 포션 구역 바닥 세이지 러그
    ctx.fillStyle = '#546e60';
    ctx.fillRect(18, 54, 118, 34);
    ctx.fillStyle = '#789c86';
    ctx.fillRect(20, 56, 114, 1);
    ctx.fillRect(20, 85, 114, 1);

    // 뒷벽 약초/포션 진열 선반
    ctx.fillStyle = '#452f23';
    ctx.fillRect(20, 12, 74, 34);
    ctx.fillStyle = '#73503a';
    ctx.fillRect(22, 22, 70, 3);
    ctx.fillRect(22, 34, 70, 3);

    // 선반 위 알록달록 포션 병들
    const bottleColors = ['#7eb38a', '#78b2bf', '#d47a72', '#e6c274', '#b592c9'];
    for (let i = 0; i < 10; i++) {
      const bx = 26 + (i % 5) * 13;
      const by = i < 5 ? 15 : 27;
      ctx.fillStyle = bottleColors[i % bottleColors.length];
      ctx.fillRect(bx, by, 5, 6);
      ctx.fillStyle = '#f6efe2';
      ctx.fillRect(bx + 1, by - 1, 3, 1);
    }

    // 연금 제작대 카운터 (x: 24..116, y: 46..60)
    ctx.fillStyle = '#4e3526';
    ctx.fillRect(24, 46, 92, 14);
    ctx.fillStyle = '#8c6240';
    ctx.fillRect(22, 44, 96, 4);

    // 약초 절구 & 마력 증류기
    ctx.fillStyle = '#b8c0c7';
    ctx.fillRect(32, 39, 7, 5);
    if ((state.potionTools?.['pot_tool_alembic'] ?? 0) > 0) {
      ctx.fillStyle = '#78b2bf';
      ctx.fillRect(54, 36, 7, 8);
      ctx.fillStyle = '#f6efe2';
      ctx.fillRect(56, 34, 3, 2);
    }

    // 룬 무쇠 가마솥 (보글보글)
    const cauldronX = 102;
    const cauldronY = 38;
    ctx.fillStyle = '#3b3d4a';
    ctx.fillRect(cauldronX, cauldronY, 16, 12);
    ctx.fillStyle =
      Math.floor(t * 5) % 2 === 0 ? '#9c78b8' : '#7eb38a';
    ctx.fillRect(cauldronX + 2, cauldronY + 1, 12, 3);
    // 방울 이펙트
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
    // 중상단 주방 화덕 & 바 카운터 (x: 152..296, y: 12..90)
    const fx = 156;
    const fy = 10;

    // 따뜻한 벽돌 화덕
    ctx.fillStyle = '#6b4c3e';
    ctx.fillRect(fx, fy, 38, 42);
    ctx.fillStyle = '#2e201b';
    ctx.fillRect(fx + 6, fy + 16, 26, 24);

    // 부드럽게 타오르는 모닥불
    const frame = Math.floor(t * 8) % 3;
    ctx.fillStyle = '#c7635b';
    ctx.fillRect(fx + 9, fy + 26 + (frame % 2), 20, 12);
    ctx.fillStyle = '#d68a54';
    ctx.fillRect(fx + 12, fy + 28 - (frame % 2), 14, 9);
    ctx.fillStyle = '#ebd186';
    ctx.fillRect(fx + 15, fy + 31, 8, 6);

    // 화덕 옆 스튜 가마솥
    ctx.fillStyle = '#3d404d';
    ctx.fillRect(fx + 42, fy + 28, 14, 11);
    ctx.fillStyle = '#d68a54';
    ctx.fillRect(fx + 44, fy + 29, 10, 2);

    // 오크 술통과 비밀 금고
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

    // 바 카운터 본체 (x: 168..292, y: 56..74)
    const cx = 168;
    const cy = 56;
    ctx.fillStyle = '#543824';
    ctx.fillRect(cx, cy, 124, 18);
    ctx.fillStyle = '#996b45';
    ctx.fillRect(cx - 2, cy - 2, 128, 5);
    ctx.fillStyle = '#b3835b';
    ctx.fillRect(cx - 1, cy - 1, 126, 2);

    // 카운터 위 맥주잔과 요리 접시
    ctx.fillStyle = '#e6c274';
    ctx.fillRect(cx + 22, cy - 6, 4, 4);
    ctx.fillStyle = '#f6efe2';
    ctx.fillRect(cx + 22, cy - 7, 4, 2);
    ctx.fillStyle = '#78b2bf';
    ctx.fillRect(cx + 64, cy - 6, 4, 5);

    // 태엽 오르골
    if ((state.upgrades['fac_musicbox'] ?? 0) > 0) {
      const mx = cx + 106;
      const my = cy - 9;
      ctx.fillStyle = '#785032';
      ctx.fillRect(mx, my + 4, 8, 5);
      ctx.fillStyle = '#e6c274';
      ctx.fillRect(mx + 2, my, 6, 4);
    }

    // 카운터 앞 바 스툴 4개
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
    // 우상단 2층 객실·침대 구역 (x: 308..472, y: 14..94)
    // 1층-2층 연결 나무 계단 (x: 298..324, y: 66..98)
    for (let step = 0; step < 6; step++) {
      ctx.fillStyle = '#8f623d';
      ctx.fillRect(300 + step * 3, 92 - step * 5, 22, 5);
      ctx.fillStyle = '#5e3f26';
      ctx.fillRect(300 + step * 3, 96 - step * 5, 22, 1);
    }

    // 2층 객실 난간 (x: 326..472, y: 90)
    ctx.fillStyle = '#5e3f26';
    ctx.fillRect(324, 90, 148, 4);
    ctx.fillStyle = '#996b45';
    ctx.fillRect(324, 86, 148, 3);
    for (let rx = 328; rx < 470; rx += 10) {
      ctx.fillRect(rx, 80, 2, 10);
    }

    // 아늑한 침대 4개 (x: 334, 366, 398, 430, y: 28..56)
    const isRoyal = (state.upgrades['room_royal'] ?? 0) > 0;
    const quiltColor = isRoyal ? '#9e4b46' : '#658c75';
    const bedXs = [332, 364, 396, 428];
    for (const bx of bedXs) {
      // 침대 나무 프레임
      ctx.fillStyle = '#4f3522';
      ctx.fillRect(bx, 26, 22, 32);
      // 매트리스 & 베개
      ctx.fillStyle = '#f2e8d5';
      ctx.fillRect(bx + 2, 29, 18, 26);
      ctx.fillStyle = '#fff9ed';
      ctx.fillRect(bx + 4, 31, 14, 6);
      // 따뜻한 이불
      ctx.fillStyle = quiltColor;
      ctx.fillRect(bx + 2, 39, 18, 16);
      ctx.fillStyle = '#e6c274';
      ctx.fillRect(bx + 2, 39, 18, 2);
    }

    // 지하 마력 온천탕 해금 시 우측 온천 코너 표시
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
    // 중앙 거래/시장 가판대 (x: 224..304, y: 120..180)
    const tx = 228;
    const ty = 126;

    // 가판대 바닥 러그
    ctx.fillStyle = '#6e4d3b';
    ctx.fillRect(tx - 4, ty + 16, 78, 38);
    ctx.fillStyle = '#c99b5b';
    ctx.fillRect(tx - 2, ty + 18, 74, 1);

    // 줄무늬 천막 지붕 (따뜻한 크림 & 테라코타)
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#c7635b' : '#f2e5d0';
      ctx.fillRect(tx + i * 10, ty, 10, 11);
    }
    ctx.fillStyle = '#4e3524';
    ctx.fillRect(tx, ty + 11, 70, 2);

    // 가판대 나무 매대
    ctx.fillStyle = '#5c3e28';
    ctx.fillRect(tx + 2, ty + 24, 66, 14);
    ctx.fillStyle = '#996b45';
    ctx.fillRect(tx, ty + 22, 70, 4);

    // 황금 저울과 보석/전리품 상자
    ctx.fillStyle = '#e6c274';
    ctx.fillRect(tx + 10, ty + 17, 7, 5);
    ctx.fillStyle = '#7eb38a';
    ctx.fillRect(tx + 28, ty + 18, 6, 4);
    ctx.fillStyle = '#78b2bf';
    ctx.fillRect(tx + 40, ty + 18, 6, 4);

    // 매입 대기 전리품이 있으면 반짝이는 보따리 표시
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
    // 중하단 의뢰 게시판 집결 광장 (x: 226..322, y: 194..268)
    const bx = 246;
    const by = 194;

    // 파티 집결 원형/사각 양탄자
    ctx.fillStyle = '#4b5e6e';
    ctx.fillRect(bx - 16, by + 22, 86, 42);
    ctx.fillStyle = '#89a7bd';
    ctx.fillRect(bx - 14, by + 24, 82, 1);
    ctx.fillRect(bx - 14, by + 61, 82, 1);

    // 대형 원목 의뢰 게시판
    ctx.fillStyle = '#3d291d';
    ctx.fillRect(bx, by, 54, 28);
    ctx.fillStyle = '#7d5538';
    ctx.fillRect(bx + 3, by + 3, 48, 22);

    // 붙어 있는 의뢰서 양피지들
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
    // 우중단 드워프 대장간 (x: 326..436, y: 108..186)
    const sx = 332;
    const sy = 112;

    // 대장간 석재 타일 패드
    ctx.fillStyle = '#5a6069';
    ctx.fillRect(sx, sy + 8, 96, 64);
    ctx.fillStyle = '#494e57';
    ctx.fillRect(sx + 3, sy + 11, 90, 58);

    // 드워프 고열 용광로(화로)
    ctx.fillStyle = '#635954';
    ctx.fillRect(sx + 32, sy, 28, 26);
    ctx.fillStyle = '#362d2a';
    ctx.fillRect(sx + 37, sy + 10, 18, 14);
    ctx.fillStyle = Math.floor(t * 8) % 2 === 0 ? '#d68a54' : '#c7635b';
    ctx.fillRect(sx + 39, sy + 13, 14, 10);
    ctx.fillStyle = '#ebd186';
    ctx.fillRect(sx + 42, sy + 16, 8, 6);

    // 강철·미스릴 모루 (Anvil)
    const isMithril = (state.blacksmithTools?.['smith_anvil'] ?? 0) >= 2;
    ctx.fillStyle = '#333840';
    ctx.fillRect(sx + 14, sy + 34, 14, 5);
    ctx.fillStyle = isMithril ? '#78b2bf' : '#b8c0c7';
    ctx.fillRect(sx + 11, sy + 28, 20, 6);
    ctx.fillRect(sx + 8, sy + 29, 4, 4);

    // 담금질 오일 통 & 룬 숫돌
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

    // 완성 장비 무기 진열대
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
    // 우하단 던전으로 가는 입구 아치 (x: 416..478, y: 192..274)
    const gx = 424;
    const gy = 196;

    // 게시판에서 던전 입구로 이어지는 돌길
    ctx.fillStyle = '#686b73';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(322 + i * 17, 220 + (i % 2) * 4, 13, 18);
    }

    // 석조 던전 출입 아치문
    ctx.fillStyle = '#555b66';
    ctx.fillRect(gx + 16, gy, 36, 62);
    ctx.fillStyle = '#6d7482';
    ctx.fillRect(gx + 12, gy - 4, 44, 8);

    // 아치 내부 신비로운 던전 통로
    ctx.fillStyle = '#20242e';
    ctx.fillRect(gx + 22, gy + 8, 24, 52);

    // 원정 중인 파티가 있으면 포털 룬이 은은하게 빛남
    const hasExpedition = (state.expeditions?.length ?? 0) > 0;
    if (hasExpedition) {
      const glow = Math.floor(t * 5) % 2 === 0 ? '#5c859e' : '#47687d';
      ctx.fillStyle = glow;
      ctx.fillRect(gx + 26, gy + 14, 16, 42);
    }

    // 양옆 횃불
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

    // 1. 여관 주인 (바 카운터 중앙)
    const waveBob = state.innkeeperWaveTimer > 0 ? -2 : bob;
    drawStaffCharacter(ctx, 'innkeeper', 210, 55, 'left', waveBob);

    // 2. 포션 가게 연금술사 벨라
    drawStaffCharacter(
      ctx,
      'alchemist',
      78,
      45,
      'left',
      Math.cos(t * 5) > 0 ? -1 : 0
    );

    // 3. 거래 가판대 상인
    drawStaffCharacter(
      ctx,
      'merchant',
      264,
      148,
      'left',
      Math.sin(t * 4.5) > 0 ? -1 : 0
    );

    // 4. 대장간 장인 토르가
    drawStaffCharacter(
      ctx,
      'blacksmith',
      362,
      138,
      'left',
      Math.cos(t * 6) > 0 ? -1 : 0
    );

    // 5. 바텐더 브롬
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

    // 6. 수석 요리사 고든
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

    // 7. 음유시인 엘리
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
    // 1층 식당 식탁 6개
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
          // 부드러운 바닥 그림자
          ctx.fillStyle = 'rgba(42, 28, 18, 0.22)';
          ctx.fillRect(tb.x - 10, tb.y + 12, 44, 4);

          // 의자
          ctx.fillStyle = '#5e3f26';
          ctx.fillRect(tb.x - 9, tb.y + 3, 7, 10);
          ctx.fillRect(tb.x + 26, tb.y + 3, 7, 10);

          // 식탁 상판
          ctx.fillStyle = '#543824';
          ctx.fillRect(tb.x, tb.y + 4, 24, 11);
          ctx.fillStyle = '#996b45';
          ctx.fillRect(tb.x - 2, tb.y, 28, 8);
          ctx.fillStyle = '#b3835b';
          ctx.fillRect(tb.x - 1, tb.y + 1, 26, 5);

          // 따뜻한 촛불
          ctx.fillStyle = '#f6efe2';
          ctx.fillRect(tb.x + 11, tb.y - 2, 2, 4);
          ctx.fillStyle =
            Math.floor(t * 7 + tb.x) % 2 === 0 ? '#ebd186' : '#d68a54';
          ctx.fillRect(tb.x + 11, tb.y - 4, 2, 2);
        },
      });
    }

    // 견습 메이드 리나
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

    // 일반 방문 손님
    for (const guest of state.guests) {
      drawables.push({
        y: guest.y,
        draw: () => {
          this.drawSingleGuest(ctx, t, guest);
        },
      });
    }

    // 살아있는 여관 영웅 에이전트들
    if (state.heroEntities) {
      for (const hEnt of state.heroEntities) {
        if (hEnt.status === 'exploring') continue; // 던전 탐험 중에는 여관 맵에서 사라짐
        drawables.push({
          y: hEnt.y,
          draw: () => {
            const rx = Math.round(hEnt.x);
            const ry = Math.round(hEnt.y);

            // 선택된 영웅 하이라이트 링 또는 기본 그림자
            if (hEnt.isSelected) {
              ctx.fillStyle = 'rgba(235, 209, 134, 0.85)';
              ctx.fillRect(rx - 8, ry - 3, 16, 5);
              ctx.fillStyle = '#5c3c24';
              ctx.fillRect(rx - 6, ry - 2, 12, 3);
            } else if (hEnt.hasPlayerOrder) {
              ctx.fillStyle = 'rgba(126, 179, 138, 0.7)';
              ctx.fillRect(rx - 7, ry - 3, 14, 4);
            } else {
              ctx.fillStyle = 'rgba(38, 24, 16, 0.28)';
              ctx.fillRect(rx - 5, ry - 2, 10, 3);
            }

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

            // 영웅 미니 HP 바 & 이름표
            const tagW = 26;
            const tagX = rx - Math.floor(tagW / 2);
            const tagY = ry - 24;
            ctx.fillStyle = hEnt.isSelected
              ? 'rgba(92, 60, 36, 0.92)'
              : 'rgba(42, 30, 23, 0.82)';
            ctx.fillRect(tagX, tagY, tagW, 9);

            // 미니 체력바
            ctx.fillStyle = '#33241b';
            ctx.fillRect(tagX + 2, tagY + 7, tagW - 4, 2);
            ctx.fillStyle =
              hEnt.hpPct < 0.45
                ? '#c7635b'
                : hEnt.hpPct < 0.75
                ? '#e6c274'
                : '#7eb38a';
            ctx.fillRect(
              tagX + 2,
              tagY + 7,
              Math.max(2, Math.round((tagW - 4) * hEnt.hpPct)),
              2
            );

            ctx.fillStyle = hEnt.isSelected
              ? '#ebd186'
              : hEnt.hasPlayerOrder
              ? '#a8e0b4'
              : '#f6efe2';
            ctx.font = '6px sans-serif';
            ctx.fillText(hEnt.name, tagX + 3, tagY + 6);

            // 상호작용 시 짧은 아이템/골드 이펙트
            if (hEnt.interactionEffect) {
              const eff = hEnt.interactionEffect;
              const floatY = ry - 28 - Math.round((1.4 - eff.timer) * 6);
              ctx.fillStyle = 'rgba(42, 30, 23, 0.88)';
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
    // 화면에 동시에 최대 2~3개만, 서로 너무 가깝지 않게 말풍선 표시
    const candidates = state.heroEntities.filter(
      (h) => h.status !== 'exploring' && Boolean(h.speechText)
    );
    // 선택된 영웅을 최우선으로 정렬
    candidates.sort((a, b) => (b.isSelected ? 1 : 0) - (a.isSelected ? 1 : 0));

    const placed: { x: number; y: number }[] = [];
    for (const h of candidates) {
      if (placed.length >= 2 && !h.isSelected) break;
      const tooClose = placed.some(
        (p) => Math.abs(p.x - h.x) < 76 && Math.abs(p.y - h.y) < 34
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
// 카이로소프트풍 층별 던전 탐험 & 자동 전투 전용 렌더러 (480x136)
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

    // 1. 던전 태그별 배경 복도 & 바닥 타일
    this.drawDungeonCorridor(
      ctx,
      t,
      dungeon?.tag ?? 'cave',
      phase === 'marching' ? activeExp.marchProgress ?? 0 : 0
    );

    // 2. 상단 층 진행 미니맵 바 (1F -> 2F -> 3F BOSS)
    this.drawFloorProgressHeader(
      ctx,
      dungeon?.name ?? '던전',
      currentFloor,
      totalFloors,
      phase,
      activeExp.remainingSec
    );

    // 3. 좌측: 원정 파티 영웅 대열 + 공격 모션 + HP바
    this.drawPartyFormation(ctx, t, activeExp);

    // 4. 우측: 현재 층 몬스터 / 보스 + 공격 모션 + HP바 + 드랍 아이템
    this.drawMonstersAndDrops(ctx, t, activeExp);

    // 5. 데미지 숫자 및 전투 플로팅 텍스트
    this.drawCombatFloats(ctx, activeExp);
  }

  private drawStandbyScene(
    ctx: CanvasRenderingContext2D,
    t: number,
    lastResult: ExpeditionResultSummary | null
  ): void {
    ctx.fillStyle = '#26232b';
    ctx.fillRect(0, 0, DUNGEON_CANVAS_WIDTH, DUNGEON_CANVAS_HEIGHT);

    // 돌바닥
    ctx.fillStyle = '#38343f';
    ctx.fillRect(0, 94, DUNGEON_CANVAS_WIDTH, 42);
    for (let x = 0; x < DUNGEON_CANVAS_WIDTH; x += 32) {
      ctx.fillStyle = '#2d2933';
      ctx.fillRect(x, 94, 2, 42);
    }

    // 횃불
    const flicker = Math.floor(t * 6) % 2 === 0 ? '#d68a54' : '#ebd186';
    for (const tx of [90, 240, 390]) {
      ctx.fillStyle = '#5c402c';
      ctx.fillRect(tx, 52, 4, 12);
      ctx.fillStyle = flicker;
      ctx.fillRect(tx - 1, 46, 6, 6);
    }

    ctx.fillStyle = '#ebd186';
    ctx.font = 'bold 10px sans-serif';
    if (lastResult) {
      const statusStr = lastResult.success ? '🏆 공략 성공 귀환!' : '💥 부상 후퇴 귀환';
      ctx.fillText(
        `${statusStr} [${lastResult.dungeonName}] — 파티: ${lastResult.heroNames.join(' · ')}`,
        24,
        42
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
        62
      );
    } else {
      ctx.fillText(
        '🗺️ 현재 던전을 탐험 중인 파티가 없습니다.',
        24,
        50
      );
      ctx.fillStyle = '#d4bfa8';
      ctx.font = '9px sans-serif';
      ctx.fillText(
        '영웅들이 여관에서 식사·휴식·쇼핑을 마치고 의뢰 게시판에 모이면 던전으로 출발합니다!',
        24,
        68
      );
    }
  }

  private drawDungeonCorridor(
    ctx: CanvasRenderingContext2D,
    t: number,
    tag: string,
    marchOffset: number
  ): void {
    const themes: Record<string, { wall: string; brick: string; floor: string }> = {
      cave: { wall: '#2b303a', brick: '#39414f', floor: '#474f5e' },
      camp: { wall: '#382b24', brick: '#4d3b31', floor: '#5e493d' },
      forest: { wall: '#25362e', brick: '#334a3f', floor: '#435e51' },
      magic: { wall: '#2e2640', brick: '#3f3457', floor: '#52456e' },
      mine: { wall: '#36322e', brick: '#4a453f', floor: '#5c564f' },
      sanctum: { wall: '#332e3d', brick: '#474054', floor: '#5b536b' },
      volcano: { wall: '#3d2220', brick: '#54302c', floor: '#693c37' },
    };
    const th = themes[tag] ?? themes.cave;

    ctx.fillStyle = th.wall;
    ctx.fillRect(0, 0, DUNGEON_CANVAS_WIDTH, 94);

    const scrollPx = Math.floor(marchOffset * 64) % 32;
    ctx.fillStyle = th.brick;
    for (let x = -scrollPx; x < DUNGEON_CANVAS_WIDTH; x += 32) {
      ctx.fillRect(x, 28, 28, 16);
      ctx.fillRect(x + 12, 48, 28, 16);
      ctx.fillRect(x, 68, 28, 18);
    }

    // 횃불
    const flicker = Math.floor(t * 8) % 2 === 0 ? '#d68a54' : '#ebd186';
    for (let x = 48 - scrollPx; x < DUNGEON_CANVAS_WIDTH; x += 96) {
      ctx.fillStyle = '#5c402c';
      ctx.fillRect(x, 48, 3, 9);
      ctx.fillStyle = flicker;
      ctx.fillRect(x - 1, 43, 5, 5);
    }

    // 바닥
    ctx.fillStyle = th.floor;
    ctx.fillRect(0, 94, DUNGEON_CANVAS_WIDTH, 42);
    ctx.fillStyle = th.wall;
    ctx.fillRect(0, 94, DUNGEON_CANVAS_WIDTH, 2);
    for (let x = -scrollPx; x < DUNGEON_CANVAS_WIDTH; x += 24) {
      ctx.fillRect(x, 96, 2, 40);
    }
  }

  private drawFloorProgressHeader(
    ctx: CanvasRenderingContext2D,
    dungeonName: string,
    currentFloor: number,
    totalFloors: number,
    phase: string,
    remainingSec: number
  ): void {
    ctx.fillStyle = 'rgba(32, 23, 19, 0.86)';
    ctx.fillRect(0, 0, DUNGEON_CANVAS_WIDTH, 22);

    const phaseLabel =
      phase === 'marching'
        ? '🏃 복도 전진 중'
        : phase === 'fighting'
        ? '⚔️ 몬스터 교전 중!'
        : phase === 'floor_clear'
        ? '✨ 층 클리어! 전리품 획득'
        : '🗺️ 탐험 중';

    ctx.fillStyle = '#ebd186';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(
      `${dungeonName} — [${currentFloor}/${totalFloors}층] ${phaseLabel} (${Math.ceil(
        remainingSec
      )}초)`,
      10,
      14
    );

    // 우측 층별 노드 표시
    const startX = 330;
    for (let f = 1; f <= totalFloors; f++) {
      const nx = startX + (f - 1) * 28;
      if (f < totalFloors) {
        ctx.fillStyle = f < currentFloor ? '#7eb38a' : '#5c4a3e';
        ctx.fillRect(nx + 16, 10, 12, 2);
      }
      ctx.fillStyle =
        f < currentFloor
          ? '#4a7856'
          : f === currentFloor
          ? '#c9934b'
          : '#3d3028';
      ctx.fillRect(nx, 5, 18, 12);
      ctx.fillStyle = '#f6efe2';
      ctx.font = 'bold 7px monospace';
      ctx.fillText(f === totalFloors ? 'BOSS' : `${f}F`, nx + 2, 14);
    }
  }

  private drawPartyFormation(
    ctx: CanvasRenderingContext2D,
    t: number,
    exp: ActiveExpedition
  ): void {
    const heroIds = exp.heroIds;
    const phase = exp.floorPhase ?? 'marching';

    // 전열(탱커)이 오른쪽(몬스터 쪽, x=176)에 서고 후열이 왼쪽(x=76)에 서도록 배치
    const count = heroIds.length;
    heroIds.forEach((hId, idx) => {
      const roster = HERO_ROSTER_MAP[hId];
      if (!roster) return;
      const cls = HERO_CLASSES[roster.classId];
      const cState = exp.partyCombatState?.[hId];
      const lunge = (cState?.lungeTimer ?? 0) > 0 ? 10 : 0;
      const baseX = 175 - idx * 38 + lunge;
      const baseY = 108 + (idx % 2) * 8;

      // 그림자
      ctx.fillStyle = 'rgba(20, 14, 10, 0.35)';
      ctx.fillRect(baseX - 7, baseY - 2, 14, 4);

      // 캐릭터 (2배 크기 대신 선명하게 1배 + 전투 모션, 또는 scale 1.5 대신 정수 1배/2배: 1배가 주변 비율과 딱 맞음)
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

      // 공격 이펙트 (검기 / 마법탄)
      if ((cState?.lungeTimer ?? 0) > 0) {
        ctx.fillStyle =
          cls.role === 'healer'
            ? '#7eb38a'
            : cls.id === 'mage'
            ? '#78b2bf'
            : '#ebd186';
        ctx.fillRect(baseX + 10, baseY - 12, 8, 3);
        ctx.fillRect(baseX + 14, baseY - 15, 3, 9);
      }

      // 영웅 HP 바 & 이름
      const hpPct = cState
        ? Math.max(0, Math.min(1, cState.currentHp / Math.max(1, cState.maxHp)))
        : 1;
      const bx = baseX - 15;
      const by = baseY - 27;
      ctx.fillStyle = 'rgba(32, 23, 19, 0.85)';
      ctx.fillRect(bx, by, 30, 10);
      ctx.fillStyle = '#f6efe2';
      ctx.font = '6px sans-serif';
      ctx.fillText(roster.name, bx + 2, by + 6);

      ctx.fillStyle = '#2b1e17';
      ctx.fillRect(bx + 2, by + 7, 26, 2);
      ctx.fillStyle = hpPct < 0.4 ? '#c7635b' : '#7eb38a';
      ctx.fillRect(bx + 2, by + 7, Math.round(26 * hpPct), 2);
    });

    if (count > 0 && phase === 'marching') {
      ctx.fillStyle = '#ebd186';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('▶ 전진 중...', 198, 86);
    }
  }

  private drawMonstersAndDrops(
    ctx: CanvasRenderingContext2D,
    t: number,
    exp: ActiveExpedition
  ): void {
    const monsters = exp.monsters ?? [];
    const phase = exp.floorPhase ?? 'marching';

    if (phase !== 'marching') {
      monsters.forEach((m, idx) => {
        if (m.currentHp <= 0) return;
        const lunge = m.lungeTimer > 0 ? -10 : 0;
        const mx = 290 + idx * 58 + lunge;
        const my = m.isBoss ? 114 : 108 + (idx % 2) * 7;

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

        // 몬스터 HP바
        const hpPct = Math.max(0, Math.min(1, m.currentHp / Math.max(1, m.maxHp)));
        const barW = m.isBoss ? 46 : 34;
        const bx = mx - Math.floor(barW / 2);
        const by = my - (m.isBoss ? 32 : 22);

        ctx.fillStyle = 'rgba(32, 23, 19, 0.88)';
        ctx.fillRect(bx, by, barW, 10);
        ctx.fillStyle = m.isBoss ? '#ebd186' : '#f6efe2';
        ctx.font = '6px sans-serif';
        ctx.fillText(m.name.slice(0, 7), bx + 2, by + 6);

        ctx.fillStyle = '#2b1e17';
        ctx.fillRect(bx + 2, by + 7, barW - 4, 2);
        ctx.fillStyle = '#c7635b';
        ctx.fillRect(bx + 2, by + 7, Math.round((barW - 4) * hpPct), 2);
      });
    }

    // 승리/처치 시 눈에 보이는 전리품 드랍 아이콘 연출
    for (const drop of exp.dropVisuals ?? []) {
      const dx = Math.round(drop.x);
      const dy = Math.round(drop.y);
      ctx.fillStyle = 'rgba(42, 30, 23, 0.92)';
      ctx.fillRect(dx - 24, dy - 10, 62, 13);
      ctx.strokeStyle = '#e6c274';
      ctx.strokeRect(dx - 23.5, dy - 9.5, 61, 12);
      ctx.fillStyle = '#ebd186';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText(`${drop.icon} ${drop.name} +${drop.count}`, dx - 21, dy - 1);
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
