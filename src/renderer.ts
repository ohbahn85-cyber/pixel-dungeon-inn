import { GUEST_TYPES, SEAT_SLOTS } from './data';
import {
  drawGuestCharacter,
  drawOrderBubble,
  drawStaffCharacter,
} from './sprites';
import {
  ActiveEvent,
  CoinParticle,
  FloatingText,
  GuestEntity,
} from './types';

export const CANVAS_WIDTH = 320;
export const CANVAS_HEIGHT = 192;

export interface RenderContextState {
  time: number;
  guests: GuestEntity[];
  floatingTexts: FloatingText[];
  particles: CoinParticle[];
  upgrades: Record<string, number>;
  activeEvent: ActiveEvent | null;
  maidPos: { x: number; y: number; facing: 'left' | 'right' };
  innkeeperWaveTimer: number;
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

    // 1. 배경 벽면과 나무 바닥
    this.drawWallsAndFloor(ctx, t, state.upgrades, state.activeEvent);

    // 2. 창밖 풍경 (밤하늘 + 던전 입구)
    this.drawWindowAndDungeon(ctx, t, state.activeEvent);

    // 3. 벽난로(깜빡임) 및 주방 가마솥
    this.drawFireplace(ctx, t, state.upgrades);

    // 4. 2층 계단 및 객실 입구 / 온천 입구
    this.drawStairsAndRooms(ctx, t, state.upgrades);

    // 5. 시설물: 의뢰 게시판, 금고, 카운터, 술통, 오르골, 대장간
    this.drawFacilitiesAndCounter(ctx, t, state);

    // 6. 직원 (주방 요리사, 카운터 바텐더, 여관 주인, 음유시인)
    this.drawStationaryStaff(ctx, t, state);

    // 7. 홀 테이블과 의자 + 손님 + 메이드 (Y좌표 기준 깊이 정렬)
    this.drawHallEntities(ctx, t, state);

    // 8. 코인 파티클 & 떠오르는 골드 숫자
    this.drawParticlesAndFloatingTexts(ctx, state);
  }

  private drawWallsAndFloor(
    ctx: CanvasRenderingContext2D,
    t: number,
    upgrades: Record<string, number>,
    activeEvent: ActiveEvent | null
  ): void {
    // 상단 벽 (석재 및 목재 기둥)
    ctx.fillStyle = '#3b2820';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 72);

    // 회벽 패널
    ctx.fillStyle = '#52382c';
    ctx.fillRect(8, 8, 304, 54);

    // 나무 기둥들
    ctx.fillStyle = '#2a1b15';
    for (const bx of [0, 64, 120, 184, 244, 312]) {
      ctx.fillRect(bx, 0, 8, 72);
    }
    // 상단 가로 들보
    ctx.fillRect(0, 0, CANVAS_WIDTH, 8);
    ctx.fillRect(0, 64, CANVAS_WIDTH, 8);

    // 나무 바닥 (y: 72..192)
    ctx.fillStyle = '#6b442a';
    ctx.fillRect(0, 72, CANVAS_WIDTH, 120);

    // 바닥 판자 줄무늬와 이음새
    ctx.fillStyle = '#56341f';
    for (let y = 78; y < CANVAS_HEIGHT; y += 10) {
      ctx.fillRect(0, y, CANVAS_WIDTH, 1);
      const offset = (y / 10) % 2 === 0 ? 14 : 30;
      for (let x = offset; x < CANVAS_WIDTH; x += 36) {
        ctx.fillRect(x, y - 9, 1, 9);
      }
    }

    // 왼쪽 여관 출입문 (모험가 입장 문)
    ctx.fillStyle = '#2a1b15';
    ctx.fillRect(0, 98, 12, 44);
    ctx.fillStyle = '#8d5524';
    ctx.fillRect(2, 102, 8, 36);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(7, 118, 2, 3); // 문고리

    // 출입문 앞 환영 카펫(러그)
    ctx.fillStyle = '#9b2226';
    ctx.fillRect(14, 112, 42, 20);
    ctx.fillStyle = '#e09f3e';
    ctx.fillRect(16, 114, 38, 2);
    ctx.fillRect(16, 128, 38, 2);

    // 스위트룸/객실 업그레이드가 높으면 중앙 홀에도 고급 카펫 추가
    if ((upgrades['room_wool'] ?? 0) > 0 || (upgrades['room_royal'] ?? 0) > 0) {
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(94, 118, 52, 24);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(96, 120, 48, 1);
      ctx.fillRect(96, 139, 48, 1);
    }

    // 축하연 이벤트 중이면 천장에 알록달록 가랜드 장식 표시
    if (activeEvent?.def.weather === 'celebration') {
      const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
      for (let i = 0; i < 18; i++) {
        const lx = 14 + i * 17;
        const ly = 8 + (i % 2) * 3;
        ctx.fillStyle = colors[(i + Math.floor(t * 4)) % colors.length];
        ctx.fillRect(lx, ly, 5, 5);
      }
    }
  }

  private drawWindowAndDungeon(
    ctx: CanvasRenderingContext2D,
    t: number,
    activeEvent: ActiveEvent | null
  ): void {
    const wx = 128;
    const wy = 14;
    const ww = 54;
    const wh = 42;

    // 창틀 외곽
    ctx.fillStyle = '#231610';
    ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);

    // 밤하늘 배경
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(wx, wy, ww, wh);

    // 초승달
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(wx + 40, wy + 6, 7, 7);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(wx + 38, wy + 5, 5, 5);

    // 반짝이는 별들
    const stars = [
      [8, 7],
      [20, 5],
      [31, 11],
      [12, 16],
      [46, 17],
    ];
    stars.forEach(([sx, sy], idx) => {
      const twinkle = Math.sin(t * 3 + idx * 1.7) > 0;
      ctx.fillStyle = twinkle ? '#ffffff' : '#64748b';
      ctx.fillRect(wx + sx, wy + sy, 2, 2);
    });

    // 멀리 보이는 산과 던전 언덕 실루엣
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(wx, wy + 26, ww, 16);
    ctx.fillRect(wx + 6, wy + 22, 28, 6);
    ctx.fillRect(wx + 12, wy + 18, 18, 6);

    // 던전 석조 아치 입구 (창밖으로 보이는 던전!)
    ctx.fillStyle = '#475569';
    ctx.fillRect(wx + 14, wy + 22, 16, 18);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(wx + 16, wy + 20, 12, 3);
    // 던전 어두운 입구 내부
    ctx.fillStyle = '#020617';
    ctx.fillRect(wx + 17, wy + 25, 10, 15);
    // 던전 입구 해골 장식과 양옆 횃불
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(wx + 21, wy + 21, 3, 3);
    const torchFlicker = Math.floor(t * 8) % 2 === 0 ? '#f97316' : '#facc15';
    ctx.fillStyle = torchFlicker;
    ctx.fillRect(wx + 13, wy + 28, 2, 3);
    ctx.fillRect(wx + 30, wy + 28, 2, 3);

    // 폭우 이벤트 시 창밖에 빗줄기 애니메이션
    if (activeEvent?.def.weather === 'rain') {
      ctx.fillStyle = '#60a5fa';
      for (let i = 0; i < 12; i++) {
        const rx = wx + ((i * 11 + Math.floor(t * 45)) % (ww - 2));
        const ry = wy + ((i * 17 + Math.floor(t * 90)) % (wh - 5));
        ctx.fillRect(rx, ry, 1, 4);
      }
    }

    // 창문 십자 나무 프레임
    ctx.fillStyle = '#3b2416';
    ctx.fillRect(wx + Math.floor(ww / 2) - 1, wy, 3, wh);
    ctx.fillRect(wx, wy + Math.floor(wh / 2) - 1, ww, 3);
  }

  private drawFireplace(
    ctx: CanvasRenderingContext2D,
    t: number,
    upgrades: Record<string, number>
  ): void {
    const fx = 74;
    const fy = 16;

    // 벽돌 굴뚝 및 화덕 몸체
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(fx, fy, 42, 54);
    ctx.fillStyle = '#4a3228';
    ctx.fillRect(fx + 4, fy - 8, 34, 10);

    // 벽돌 무늬 디테일
    ctx.fillStyle = '#3d2820';
    for (let by = fy + 4; by < fy + 50; by += 8) {
      ctx.fillRect(fx + 2, by, 38, 1);
    }

    // 화덕 선반(맨틀피스)
    ctx.fillStyle = '#2a1b15';
    ctx.fillRect(fx - 2, fy + 16, 46, 4);

    // 선반 위 장식 (황금 트로피 & 촛대)
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(fx + 6, fy + 11, 4, 5);
    ctx.fillStyle = '#e63946';
    ctx.fillRect(fx + 30, fy + 10, 3, 6);
    ctx.fillStyle = '#ffbe0b';
    ctx.fillRect(fx + 30, fy + 8, 2, 2);

    // 화덕 내부 아치
    ctx.fillStyle = '#161010';
    ctx.fillRect(fx + 7, fy + 26, 28, 24);

    // 장작
    ctx.fillStyle = '#6b3e26';
    ctx.fillRect(fx + 10, fy + 45, 22, 4);

    // 깜빡이는 불꽃 애니메이션
    const frame = Math.floor(t * 10) % 4;
    ctx.fillStyle = '#e63946';
    ctx.fillRect(fx + 11, fy + 34 + (frame % 2), 20, 12);
    ctx.fillStyle = '#f77f00';
    ctx.fillRect(fx + 13, fy + 36 - (frame % 2), 16, 10);
    ctx.fillStyle = '#fcbf49';
    ctx.fillRect(fx + 16, fy + 39 + ((frame + 1) % 2), 10, 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(fx + 19, fy + 42, 4, 3);

    // 튀어오르는 불똥 도트
    const sparkY = fy + 30 - (Math.floor(t * 14) % 8);
    ctx.fillStyle = '#ffbe0b';
    ctx.fillRect(fx + 15 + (frame * 3), sparkY, 2, 2);

    // 바닥에 비치는 따뜻한 벽난로 불빛
    const glowAlpha = 0.14 + Math.sin(t * 7) * 0.04;
    ctx.fillStyle = `rgba(255, 165, 50, ${glowAlpha.toFixed(3)})`;
    ctx.fillRect(fx - 6, 72, 54, 18);

    // 화덕 옆 스튜 가마솥 (메뉴나 요리사가 있으면 보글보글 끓음)
    const kx = 118;
    const ky = 56;
    ctx.fillStyle = '#2b2d42';
    ctx.fillRect(kx, ky, 14, 12);
    ctx.fillStyle = '#495057';
    ctx.fillRect(kx - 1, ky, 16, 2);
    // 황금빛 스튜 내용물
    ctx.fillStyle = (upgrades['menu_stew'] ?? 0) > 0 ? '#f77f00' : '#e09f3e';
    ctx.fillRect(kx + 2, ky + 1, 10, 2);
    // 김(스팀) 애니메이션
    const steamOffset = Math.floor(t * 5) % 4;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(kx + 4, ky - 4 - steamOffset, 2, 2);
    ctx.fillRect(kx + 9, ky - 2 - steamOffset, 2, 2);
  }

  private drawStairsAndRooms(
    ctx: CanvasRenderingContext2D,
    t: number,
    upgrades: Record<string, number>
  ): void {
    // 우측 상단 2층 객실 발코니 및 계단
    const sx = 248;
    const sy = 10;

    // 2층 방문 2개 (201호, 202호)
    ctx.fillStyle = '#3b2216';
    ctx.fillRect(sx + 10, sy + 6, 18, 28);
    ctx.fillRect(sx + 36, sy + 6, 18, 28);

    // 방문 안쪽 따뜻한 불빛 (객실 업그레이드 시 밝게 빛남)
    const roomLevel =
      (upgrades['room_straw'] ?? 0) +
      (upgrades['room_oak'] ?? 0) +
      (upgrades['room_wool'] ?? 0) +
      (upgrades['room_magic'] ?? 0) +
      (upgrades['room_royal'] ?? 0);

    ctx.fillStyle = roomLevel > 0 ? '#78350f' : '#451a03';
    ctx.fillRect(sx + 12, sy + 8, 14, 24);
    ctx.fillRect(sx + 38, sy + 8, 14, 24);

    // 문 아래 새어나오는 노란 불빛
    if (roomLevel > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(sx + 12, sy + 31, 14, 2);
      ctx.fillRect(sx + 38, sy + 31, 14, 2);
    }

    // 왕실 스위트룸 해금 시 방문 위 황금 왕관 문양
    if ((upgrades['room_royal'] ?? 0) > 0) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(sx + 16, sy + 3, 6, 3);
      ctx.fillRect(sx + 42, sy + 3, 6, 3);
    }

    // 2층 난간
    ctx.fillStyle = '#8d5524';
    ctx.fillRect(sx + 6, sy + 34, 56, 3);
    for (let rx = sx + 8; rx < sx + 60; rx += 6) {
      ctx.fillRect(rx, sy + 26, 2, 8);
    }

    // 1층에서 2층으로 올라가는 나무 계단
    for (let step = 0; step < 6; step++) {
      ctx.fillStyle = '#7f4f24';
      ctx.fillRect(sx - 2 + step * 3, sy + 56 - step * 4, 14, 4);
      ctx.fillStyle = '#582f0e';
      ctx.fillRect(sx - 2 + step * 3, sy + 59 - step * 4, 14, 1);
    }

    // 객실이 활성화되어 있으면 2층에서 평화로운 Zzz 도트가 떠오름
    if (roomLevel > 0) {
      const zY = sy + 14 - (Math.floor(t * 4) % 8);
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 7px monospace';
      ctx.fillText('Zzz', sx + 22, zY);
    }

    // 지하 마력 온천탕 (fac_hotspring) 해금 시 우측 벽면 온천 입구와 김 표시
    if ((upgrades['fac_hotspring'] ?? 0) > 0) {
      const hx = 286;
      const hy = 52;
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(hx, hy, 22, 20);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(hx + 2, hy + 4, 8, 16);
      ctx.fillRect(hx + 12, hy + 4, 8, 16);
      // 온천 표지판
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(hx + 4, hy - 5, 14, 6);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(hx + 9, hy - 4, 4, 4);
    }
  }

  private drawFacilitiesAndCounter(
    ctx: CanvasRenderingContext2D,
    t: number,
    state: RenderContextState
  ): void {
    const upgrades = state.upgrades;

    // 1. 모험가 의뢰 게시판 (좌측 벽면: x=16, y=18)
    const bx = 18;
    const by = 18;
    ctx.fillStyle = '#3b2216';
    ctx.fillRect(bx, by, 40, 32);
    ctx.fillStyle = '#7f4f24';
    ctx.fillRect(bx + 2, by + 2, 36, 28);

    // 기본 의뢰서 + 게시판 레벨에 따라 붙은 양피지 증가
    const boardLv = upgrades['fac_board'] ?? 0;
    const paperCount = Math.min(6, 2 + boardLv);
    const paperCoords = [
      [5, 5],
      [16, 6],
      [27, 5],
      [6, 16],
      [17, 17],
      [27, 16],
    ];
    for (let i = 0; i < paperCount; i++) {
      const [px, py] = paperCoords[i];
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(bx + px, by + py, 8, 9);
      // 붉은 인장/압정
      ctx.fillStyle = i % 2 === 0 ? '#e63946' : '#2563eb';
      ctx.fillRect(bx + px + 3, by + py + 1, 2, 2);
      // 글씨 줄
      ctx.fillStyle = '#78350f';
      ctx.fillRect(bx + px + 1, by + py + 4, 6, 1);
      ctx.fillRect(bx + px + 1, by + py + 6, 5, 1);
    }

    // 2. 강철 비밀 금고 (fac_vault 해금 시 카운터 뒤 벽면)
    if ((upgrades['fac_vault'] ?? 0) > 0) {
      const vx = 188;
      const vy = 22;
      ctx.fillStyle = '#334155';
      ctx.fillRect(vx, vy, 22, 22);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(vx + 2, vy + 2, 18, 18);
      // 황금 다이얼
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(vx + 9, vy + 8, 5, 5);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(vx + 15, vy + 9, 2, 4);
    }

    // 3. 오크 술통들 (카운터 우측 뒤: x=216, y=26)
    for (let i = 0; i < 2; i++) {
      const kx = 216 + i * 14;
      const ky = 30;
      ctx.fillStyle = '#7f4f24';
      ctx.fillRect(kx, ky, 12, 16);
      ctx.fillStyle = '#2b2d42';
      ctx.fillRect(kx, ky + 3, 12, 2);
      ctx.fillRect(kx, ky + 11, 12, 2);
      ctx.fillStyle = '#e09f3e';
      ctx.fillRect(kx + 5, ky + 8, 2, 3);
    }

    // 4. 메인 바 카운터 (x=166, y=58, w=76, h=20)
    const cx = 166;
    const cy = 58;
    ctx.fillStyle = '#4a2c18';
    ctx.fillRect(cx, cy, 76, 20);
    // 카운터 상판
    ctx.fillStyle = '#8d5524';
    ctx.fillRect(cx - 2, cy - 2, 80, 5);
    ctx.fillStyle = '#a66e38';
    ctx.fillRect(cx - 1, cy - 1, 78, 2);

    // 카운터 위 맥주잔과 포션병
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(cx + 18, cy - 6, 4, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx + 18, cy - 7, 4, 2);

    if ((upgrades['menu_potion'] ?? 0) > 0) {
      ctx.fillStyle = '#4cc9f0';
      ctx.fillRect(cx + 42, cy - 6, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx + 43, cy - 8, 2, 2);
    }

    // 5. 마법 태엽 오르골 (fac_musicbox 해금 시 카운터 우측 끝에 설치)
    if ((upgrades['fac_musicbox'] ?? 0) > 0) {
      const mx = cx + 64;
      const my = cy - 10;
      ctx.fillStyle = '#78350f';
      ctx.fillRect(mx, my + 4, 8, 5);
      // 황금 나팔관
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(mx + 2, my, 6, 4);
      ctx.fillRect(mx + 6, my - 2, 3, 5);
      // 떠오르는 음표
      const noteY = my - 4 - (Math.floor(t * 6) % 8);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(mx + 3, noteY, 3, 2);
      ctx.fillRect(mx + 5, noteY - 3, 1, 3);
    }

    // 6. 드워프 간이 대장간 (fac_smithy 해금 시 우측 하단 구역: x=262, y=106)
    if ((upgrades['fac_smithy'] ?? 0) > 0) {
      const smX = 266;
      const smY = 104;
      // 대장간 돌 바닥 패드
      ctx.fillStyle = '#475569';
      ctx.fillRect(smX - 8, smY + 10, 50, 32);
      ctx.fillStyle = '#334155';
      ctx.fillRect(smX - 6, smY + 12, 46, 28);

      // 미니 용광로(화로)
      ctx.fillStyle = '#57534e';
      ctx.fillRect(smX + 20, smY - 2, 18, 22);
      ctx.fillStyle = Math.floor(t * 8) % 2 === 0 ? '#f97316' : '#ef4444';
      ctx.fillRect(smX + 24, smY + 8, 10, 8);

      // 강철 모루 (Anvil)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(smX + 2, smY + 18, 12, 4);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(smX, smY + 13, 16, 5);
      ctx.fillRect(smX - 3, smY + 14, 4, 3);

      // 무기 걸이
      ctx.fillStyle = '#78350f';
      ctx.fillRect(smX + 22, smY + 26, 16, 10);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(smX + 25, smY + 22, 2, 12);
      ctx.fillRect(smX + 31, smY + 22, 2, 12);
    }
  }

  private drawStationaryStaff(
    ctx: CanvasRenderingContext2D,
    t: number,
    state: RenderContextState
  ): void {
    const upgrades = state.upgrades;
    const bob = Math.sin(t * 5) > 0 ? -1 : 0;

    // 1. 여관 주인 (플레이어 캐릭터 - 카운터 좌측 뒤 상시 대기)
    const waveBob = state.innkeeperWaveTimer > 0 ? -2 : bob;
    drawStaffCharacter(ctx, 'innkeeper', 180, 57, 'left', waveBob);

    // 2. 베테랑 바텐더 브롬 (staff_bartender 고용 시 카운터 우측 뒤 등장)
    if ((upgrades['staff_bartender'] ?? 0) > 0) {
      drawStaffCharacter(
        ctx,
        'bartender',
        210,
        57,
        'left',
        Math.cos(t * 6) > 0 ? -1 : 0
      );
    }

    // 3. 수석 요리사 고든 (staff_chef 고용 시 화덕 가마솥 옆 등장)
    if ((upgrades['staff_chef'] ?? 0) > 0) {
      drawStaffCharacter(
        ctx,
        'chef',
        134,
        66,
        'left',
        Math.sin(t * 7) > 0 ? -1 : 0
      );
    }

    // 4. 낭만 음유시인 엘리 (staff_bard 고용 시 벽난로 좌측 무대 등장)
    if ((upgrades['staff_bard'] ?? 0) > 0) {
      drawStaffCharacter(
        ctx,
        'bard',
        56,
        74,
        'right',
        Math.sin(t * 8) > 0 ? -1 : 0
      );
      // 음유시인 주변 음표 이펙트
      const noteOffset = Math.floor(t * 5) % 6;
      ctx.fillStyle = '#a7f3d0';
      ctx.fillRect(63, 56 - noteOffset, 2, 2);
      ctx.fillRect(65, 54 - noteOffset, 1, 3);
    }
  }

  private drawHallEntities(
    ctx: CanvasRenderingContext2D,
    t: number,
    state: RenderContextState
  ): void {
    // 카운터 스툴 3개 그리기
    for (const sx of [184, 206, 226]) {
      ctx.fillStyle = '#582f0e';
      ctx.fillRect(sx - 4, 80, 8, 6);
      ctx.fillStyle = '#99582a';
      ctx.fillRect(sx - 5, 78, 10, 3);
    }

    // 홀 식탁 4개 정의
    const tables = [
      { idPrefix: 't1', x: 54, y: 98 },
      { idPrefix: 't2', x: 128, y: 98 },
      { idPrefix: 't3', x: 70, y: 140 },
      { idPrefix: 't4', x: 160, y: 140 },
    ];

    // 깊이 정렬을 위해 그리기 명령 리스트 구성
    interface Drawable {
      y: number;
      draw: () => void;
    }
    const drawables: Drawable[] = [];

    // 식탁 추가
    for (const tb of tables) {
      drawables.push({
        y: tb.y + 10,
        draw: () => {
          // 왼쪽/오른쪽 의자
          ctx.fillStyle = '#582f0e';
          ctx.fillRect(tb.x - 10, tb.y + 2, 7, 10);
          ctx.fillRect(tb.x + 27, tb.y + 2, 7, 10);

          // 식탁 다리 및 상판
          ctx.fillStyle = '#4a2c18';
          ctx.fillRect(tb.x, tb.y + 4, 24, 12);
          ctx.fillStyle = '#8d5524';
          ctx.fillRect(tb.x - 2, tb.y, 28, 8);
          ctx.fillStyle = '#a66e38';
          ctx.fillRect(tb.x - 1, tb.y + 1, 26, 5);

          // 식탁 중앙 촛불
          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(tb.x + 11, tb.y - 2, 2, 4);
          ctx.fillStyle = Math.floor(t * 8 + tb.x) % 2 === 0 ? '#fbbf24' : '#f97316';
          ctx.fillRect(tb.x + 11, tb.y - 4, 2, 2);
        },
      });
    }

    // 견습 메이드 리나 (staff_maid 고용 시 홀을 돌아다니며 서빙)
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
            Math.sin(t * 12) > 0 ? -1 : 0
          );
        },
      });
    }

    // 손님들 추가
    for (const guest of state.guests) {
      drawables.push({
        y: guest.y,
        draw: () => {
          this.drawSingleGuest(ctx, t, guest);
        },
      });
    }

    // Y좌표 오름차순 정렬 후 렌더링
    drawables.sort((a, b) => a.y - b.y);
    for (const item of drawables) {
      item.draw();
    }
  }

  private drawSingleGuest(
    ctx: CanvasRenderingContext2D,
    t: number,
    guest: GuestEntity
  ): void {
    // 대기 중인 손님은 발밑에 황금빛 클릭 가능 표시 원(타원) 렌더링
    if (guest.state === 'waiting') {
      const pulse = Math.sin(t * 6) > 0;
      ctx.fillStyle = pulse
        ? 'rgba(255, 209, 102, 0.55)'
        : 'rgba(255, 159, 28, 0.35)';
      ctx.fillRect(Math.round(guest.x - 7), Math.round(guest.y - 3), 14, 4);
    } else {
      // 일반 그림자
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
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

    // 식사/음주/수리 중인 손님 앞에 음식/맥주/불꽃 표시
    if (guest.state === 'enjoying') {
      const seat = SEAT_SLOTS.find((s) => s.id === guest.seatId);
      if (seat && seat.tableX !== undefined && seat.tableY !== undefined) {
        const tx = seat.tableX;
        const ty = seat.tableY - 6;
        if (guest.orderType === 'stew') {
          ctx.fillStyle = '#7f4f24';
          ctx.fillRect(tx - 3, ty, 6, 3);
          ctx.fillStyle = '#f77f00';
          ctx.fillRect(tx - 2, ty - 1, 4, 2);
        } else if (guest.orderType === 'ale') {
          ctx.fillStyle = '#ffd166';
          ctx.fillRect(tx - 2, ty - 2, 4, 5);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(tx - 2, ty - 3, 4, 2);
        } else if (guest.orderType === 'potion') {
          ctx.fillStyle = '#4cc9f0';
          ctx.fillRect(tx - 2, ty - 2, 4, 5);
        } else if (guest.orderType === 'repair') {
          // 모루 위 망치질 불꽃
          if (Math.floor(t * 12) % 2 === 0) {
            ctx.fillStyle = '#fde047';
            ctx.fillRect(tx - 2, ty - 4, 2, 2);
            ctx.fillRect(tx + 3, ty - 6, 2, 2);
          }
        }
      }
    }

    // 대기 중이면 머리 위에 주문 말풍선 표시
    if (guest.state === 'waiting') {
      drawOrderBubble(ctx, guest.orderType, guest.x, guest.y, t);
    }

    // 대사 말풍선이 활성화된 경우 표시
    if (guest.quoteText && guest.quoteTimer > 0) {
      const def = GUEST_TYPES.find((g) => g.id === guest.typeId);
      const label = def ? `${def.name}` : '';
      this.drawMiniSpeechBanner(ctx, guest.x, guest.y - 20, label);
    }
  }

  private drawMiniSpeechBanner(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string
  ): void {
    if (!text) return;
    const bx = Math.max(4, Math.min(CANVAS_WIDTH - 48, Math.round(x - 20)));
    const by = Math.max(4, Math.round(y - 10));
    ctx.fillStyle = 'rgba(26, 20, 35, 0.82)';
    ctx.fillRect(bx, by, 42, 10);
    ctx.fillStyle = '#ffd166';
    ctx.font = '7px sans-serif';
    ctx.fillText(text, bx + 3, by + 8);
  }

  private drawParticlesAndFloatingTexts(
    ctx: CanvasRenderingContext2D,
    state: RenderContextState
  ): void {
    // 코인 도트 파티클
    for (const p of state.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }

    // 떠오르는 골드 숫자
    for (const ft of state.floatingTexts) {
      const alpha = Math.max(0, Math.min(1, ft.life / ft.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 9px monospace, sans-serif';
      // 검은 외곽선 효과
      ctx.fillStyle = '#1a1423';
      ctx.fillText(ft.text, Math.round(ft.x) + 1, Math.round(ft.y) + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, Math.round(ft.x), Math.round(ft.y));
      ctx.restore();
    }
  }
}
