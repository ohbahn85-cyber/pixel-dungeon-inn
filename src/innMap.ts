import {
  DungeonDef,
  ExpeditionMonsterUnit,
  InnZoneId,
  MonsterSpriteType,
  PersonalityId,
} from './types';

export const MAP_WIDTH = 480;
export const MAP_HEIGHT = 288;
export const TILE_SIZE = 16;
export const GRID_COLS = 30; // 480 / 16
export const GRID_ROWS = 18; // 288 / 16

export interface GridSpot {
  col: number;
  row: number;
  facing: 'left' | 'right';
}

export const ZONE_LABELS: Record<InnZoneId, string> = {
  dining: '1층 식당',
  bar: '바 카운터',
  room: '2층 객실',
  potion: '포션 가게',
  blacksmith: '대장간',
  trade: '거래 가판대',
  board: '의뢰 게시판',
  gate: '던전 입구',
  hall: '여관 홀',
};

/**
 * 여관 전체 맵(30x18 타일)의 구역별 상호작용 좌석/타일 정의
 */
export const ZONE_SPOTS: Record<InnZoneId, GridSpot[]> = {
  // 좌상단: 포션 가게 코너 (선반, 증류기, 가마솥)
  potion: [
    { col: 2, row: 5, facing: 'right' },
    { col: 4, row: 5, facing: 'left' },
    { col: 6, row: 5, facing: 'right' },
    { col: 7, row: 5, facing: 'left' },
  ],
  // 중상단: 바 카운터 & 주방 화덕 앞 스툴
  bar: [
    { col: 11, row: 5, facing: 'left' },
    { col: 13, row: 5, facing: 'left' },
    { col: 15, row: 5, facing: 'left' },
    { col: 17, row: 5, facing: 'left' },
  ],
  // 우상단: 2층 객실 & 침대 구역 (계단 col 19..20을 통해 연결)
  room: [
    { col: 21, row: 3, facing: 'left' },
    { col: 23, row: 3, facing: 'left' },
    { col: 25, row: 3, facing: 'left' },
    { col: 27, row: 3, facing: 'left' },
    { col: 22, row: 5, facing: 'right' },
    { col: 26, row: 5, facing: 'left' },
  ],
  // 좌중하단: 1층 식당 홀 (6개 테이블 양옆 의자 12석)
  dining: [
    { col: 3, row: 8, facing: 'right' },
    { col: 5, row: 8, facing: 'left' },
    { col: 8, row: 8, facing: 'right' },
    { col: 10, row: 8, facing: 'left' },
    { col: 3, row: 11, facing: 'right' },
    { col: 5, row: 11, facing: 'left' },
    { col: 8, row: 11, facing: 'right' },
    { col: 10, row: 11, facing: 'left' },
    { col: 3, row: 14, facing: 'right' },
    { col: 5, row: 14, facing: 'left' },
    { col: 8, row: 14, facing: 'right' },
    { col: 10, row: 14, facing: 'left' },
  ],
  // 중앙: 거래/시장 가판대
  trade: [
    { col: 15, row: 10, facing: 'right' },
    { col: 16, row: 10, facing: 'left' },
    { col: 17, row: 10, facing: 'left' },
    { col: 15, row: 11, facing: 'right' },
    { col: 17, row: 11, facing: 'left' },
  ],
  // 중하단: 모험가 의뢰 게시판 집결 광장
  board: [
    { col: 15, row: 14, facing: 'right' },
    { col: 16, row: 14, facing: 'left' },
    { col: 17, row: 14, facing: 'right' },
    { col: 18, row: 14, facing: 'left' },
    { col: 15, row: 15, facing: 'right' },
    { col: 17, row: 15, facing: 'left' },
    { col: 19, row: 14, facing: 'left' },
  ],
  // 우중단: 대장간 (화로, 모루, 무기 진열대)
  blacksmith: [
    { col: 21, row: 9, facing: 'right' },
    { col: 21, row: 10, facing: 'right' },
    { col: 24, row: 9, facing: 'left' },
    { col: 24, row: 10, facing: 'left' },
    { col: 23, row: 11, facing: 'left' },
  ],
  // 우하단 아치: 던전으로 가는 입구
  gate: [
    { col: 28, row: 14, facing: 'right' },
    { col: 27, row: 14, facing: 'right' },
    { col: 27, row: 13, facing: 'right' },
    { col: 27, row: 15, facing: 'right' },
  ],
  // 여관 중앙 통로 대기 지점
  hall: [
    { col: 12, row: 7, facing: 'right' },
    { col: 13, row: 9, facing: 'left' },
    { col: 12, row: 12, facing: 'right' },
    { col: 19, row: 7, facing: 'left' },
    { col: 19, row: 11, facing: 'right' },
    { col: 13, row: 15, facing: 'right' },
    { col: 7, row: 6, facing: 'right' },
    { col: 11, row: 13, facing: 'left' },
  ],
};

/**
 * 캔버스 클릭 시 해당 픽셀 좌표가 어느 주요 구역에 해당하는지 판별
 */
export function detectZoneAtPixel(
  px: number,
  py: number
): 'potion' | 'blacksmith' | 'trade' | 'dungeon' | 'menu' | 'room' | null {
  // 포션 가게 (좌상단)
  if (px >= 14 && px <= 140 && py >= 18 && py <= 92) return 'potion';
  // 2층 객실 (우상단)
  if (px >= 316 && px <= 468 && py >= 14 && py <= 88) return 'room';
  // 바/주방 (중상단)
  if (px >= 156 && px <= 296 && py >= 22 && py <= 88) return 'menu';
  // 거래 가판대 (중앙)
  if (px >= 224 && px <= 300 && py >= 120 && py <= 184) return 'trade';
  // 대장간 (우중단)
  if (px >= 324 && px <= 432 && py >= 110 && py <= 194) return 'blacksmith';
  // 의뢰 게시판 또는 던전 입구 (중하단 ~ 우하단)
  if (
    (px >= 224 && px <= 324 && py >= 190 && py <= 264) ||
    (px >= 412 && px <= 478 && py >= 184 && py <= 268)
  ) {
    return 'dungeon';
  }
  return null;
}

export function tileToPixel(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE - 2,
  };
}

export function pixelToTile(x: number, y: number): { col: number; row: number } {
  const col = Math.max(1, Math.min(GRID_COLS - 2, Math.floor(x / TILE_SIZE)));
  const row = Math.max(2, Math.min(GRID_ROWS - 2, Math.floor(y / TILE_SIZE)));
  return { col, row };
}

/**
 * 30x18 타일 이동 가능 그리드 생성 (벽, 카운터, 식탁 중앙, 화로 등은 장애물 처리)
 */
function buildWalkableGrid(): boolean[][] {
  const grid: boolean[][] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      // 외곽 벽 및 상단 배경 벽
      if (r <= 1 || r >= GRID_ROWS - 1 || c <= 0 || c >= GRID_COLS - 1) {
        row.push(false);
      } else if (r === 2 && c < 20) {
        // 1층 상단 벽면 (2층 객실 구역 c>=20은 row 3부터 침대 배치)
        row.push(false);
      } else {
        row.push(true);
      }
    }
    grid.push(row);
  }

  // 던전 입구 우측 아치 열기
  grid[14][28] = true;
  grid[13][28] = true;
  grid[15][28] = true;

  // 포션 가게 작업대 선반 (row 3, col 2..7)
  for (let c = 2; c <= 7; c++) {
    grid[3][c] = false;
  }

  // 바 카운터 본체 (row 3..4, col 10..17)
  for (let c = 10; c <= 17; c++) {
    grid[3][c] = false;
    grid[4][c] = false;
  }

  // 2층 난간 분리벽 (row 6, col 21..28 — 계단 col 19..20으로만 오르내림!)
  for (let c = 21; c <= 28; c++) {
    grid[6][c] = false;
  }

  // 1층 식당 테이블 6개 중앙 타일 장애물 (영웅이 테이블을 뚫고 지나가지 않고 통로로 걷도록)
  const tableCenters = [
    [4, 8],
    [9, 8],
    [4, 11],
    [9, 11],
    [4, 14],
    [9, 14],
  ];
  for (const [tc, tr] of tableCenters) {
    grid[tr][tc] = false;
  }

  // 중앙 거래 가판대 지붕/매대 (row 9, col 15..17)
  for (let c = 15; c <= 17; c++) {
    grid[9][c] = false;
  }

  // 의뢰 게시판 본체 (row 13, col 16..17)
  grid[13][16] = false;
  grid[13][17] = false;

  // 대장간 화로 및 모루 본체 (row 8..9, col 22..23)
  grid[8][22] = false;
  grid[8][23] = false;
  grid[9][22] = false;
  grid[9][23] = false;

  return grid;
}

export const WALKABLE_GRID = buildWalkableGrid();

const pathCache = new Map<string, { col: number; row: number }[]>();

/**
 * 격자 위 A* / BFS 최단 경로 탐색 (정적 장애물 캐싱으로 30명 동시 이동 시에도 O(1) 재사용)
 */
export function findGridPath(
  startCol: number,
  startRow: number,
  goalCol: number,
  goalRow: number
): { col: number; row: number }[] {
  const sc = Math.max(1, Math.min(GRID_COLS - 2, Math.round(startCol)));
  const sr = Math.max(2, Math.min(GRID_ROWS - 2, Math.round(startRow)));
  const gc = Math.max(1, Math.min(GRID_COLS - 2, Math.round(goalCol)));
  const gr = Math.max(2, Math.min(GRID_ROWS - 2, Math.round(goalRow)));

  if (sc === gc && sr === gr) return [];

  const cacheKey = `${sc},${sr}->${gc},${gr}`;
  const cached = pathCache.get(cacheKey);
  if (cached) {
    return cached.map((step) => ({ col: step.col, row: step.row }));
  }

  // BFS 최단 경로 탐색 (30x18 = 540타일)
  const queue: { col: number; row: number }[] = [{ col: sc, row: sr }];
  const visited = new Set<number>();
  const parent = new Map<number, number>();
  const startIdx = sr * GRID_COLS + sc;
  const goalIdx = gr * GRID_COLS + gc;
  visited.add(startIdx);

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  let found = false;
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curIdx = cur.row * GRID_COLS + cur.col;
    if (curIdx === goalIdx) {
      found = true;
      break;
    }

    for (const [dc, dr] of dirs) {
      const nc = cur.col + dc;
      const nr = cur.row + dr;
      if (nc < 1 || nc >= GRID_COLS - 1 || nr < 2 || nr >= GRID_ROWS - 1) {
        continue;
      }
      const nIdx = nr * GRID_COLS + nc;
      if (visited.has(nIdx)) continue;
      // 목적지 타일이거나 보행 가능 타일이면 통과
      if (!WALKABLE_GRID[nr]?.[nc] && nIdx !== goalIdx) continue;

      visited.add(nIdx);
      parent.set(nIdx, curIdx);
      queue.push({ col: nc, row: nr });
    }
  }

  const result: { col: number; row: number }[] = [];
  if (found) {
    let cur = goalIdx;
    while (cur !== startIdx) {
      const r = Math.floor(cur / GRID_COLS);
      const c = cur % GRID_COLS;
      result.push({ col: c, row: r });
      const p = parent.get(cur);
      if (p === undefined) break;
      cur = p;
    }
    result.reverse();
  } else {
    result.push({ col: gc, row: gr });
  }

  if (pathCache.size > 1200) {
    pathCache.clear();
  }
  pathCache.set(cacheKey, result);
  return result.map((step) => ({ col: step.col, row: step.row }));
}

// ============================================================================
// 상황별 & 성격별 한국어 말풍선 대사 생성기
// ============================================================================

export type SpeechSituation =
  | 'hungry'
  | 'eating'
  | 'price_high'
  | 'price_good'
  | 'loot_price_low'
  | 'loot_sold'
  | 'potion_bought'
  | 'equip_bought'
  | 'enhance_success'
  | 'enhance_fail'
  | 'resting'
  | 'healed'
  | 'pre_dungeon'
  | 'returned_win'
  | 'returned_fail'
  | 'party_banter'
  | 'order_ack';

const PERSONALITY_FLAVOR_QUOTES: Record<
  PersonalityId,
  Partial<Record<SpeechSituation, string[]>>
> = {
  brave: {
    hungry: ['배부터 채우고 선봉에 서겠소!', '전사는 밥심이지!'],
    eating: ['든든하군! 당장 던전으로 가자!', '힘이 솟아오른다!'],
    pre_dungeon: ['두려워 마라, 내가 앞장선다!', '방패를 단단히 들어라!'],
    enhance_success: ['이 검으로 보스를 단숨에 베겠소!', '강철 같은 명검이군!'],
    returned_win: ['승전보를 가져왔소, 주인장!', '우리 파티의 완승이다!'],
    returned_fail: ['크윽... 정비 후 다시 도전한다!', '후퇴는 패배가 아니오!'],
  },
  cautious: {
    hungry: ['공복 상태론 집중력이 떨어지죠.', '식사로 컨디션부터 조절합시다.'],
    eating: ['간이 딱 맞네요. 정신이 맑아집니다.', '따뜻한 국물이 최고군요.'],
    price_high: ['흠, 시세가 평소보다 높은데요...', '예산 계산을 다시 해야겠군.'],
    loot_price_low: ['매입가가 조금 낮군요. 신중히 팔아야지.', '시세가 짠 편이네요.'],
    pre_dungeon: ['함정과 보급품부터 다시 점검하죠.', '무리하지 말고 진형을 유지합시다.'],
    returned_win: ['치밀한 작전 덕분에 무사히 귀환했네요.', '예상대로 완벽한 공략이었어요.'],
    returned_fail: ['위험을 감지하고 제때 후퇴해 다행입니다.', '방어구를 보강해야겠군요.'],
  },
  greedy: {
    hungry: ['금화도 좋지만 금강산도 식후경이지!', '맛있는 냄새가 코를 찌르네!'],
    loot_sold: ['오호, 금화 주머니가 묵직해졌어!', '짭짤한 거래였군!'],
    loot_price_low: ['에이, 주인장! 매입가가 너무 짜잖소!', '이 값엔 팔기 아까운데...'],
    price_high: ['헉, 바가지 아니오 주인장?!', '내 소중한 금화가... 비싸구먼!'],
    price_good: ['오! 오늘 여관 할인 특가인가? 득템이네!', '가성비 최고구먼!'],
    pre_dungeon: ['보물상자는 전부 내 차지다!', '이번엔 대박 전리품을 건져보자고!'],
    returned_win: ['전리품 가방이 터지겠어! 대박이다!', '보물 냄새가 솔솔 나는군!'],
  },
  loyal: {
    hungry: ['동료들을 지키려면 잘 먹어야지.', '식사 후 장비를 점검하겠소.'],
    eating: ['주인장 손맛은 언제나 든든하구먼!', '동료들과 먹는 밥이 제일 맛있지.'],
    pre_dungeon: ['내 방패가 부서지기 전엔 아무도 못 다치게 해!', '뒤는 내가 맡겠소!'],
    party_banter: ['내 등 뒤에만 딱 붙어 있으시오!', '함께라면 어떤 던전도 두렵지 않소!'],
    returned_win: ['모두 무사히 돌아와 기쁘구먼!', '팀워크가 빛난 원정이었소!'],
  },
  hotblooded: {
    hungry: ['배고파서 현기증 난다! 고기 스튜 가져와!', '꼬르륵 소리가 천둥 같군!'],
    eating: ['크으! 화끈하게 맛있는 스튜다!', '한 냄비 더 먹고 싶군!'],
    price_high: ['크악! 물가가 왜 이리 매운 거냐!', '주인장, 에일 값이 올랐잖아!'],
    enhance_success: ['크하하! 모루에서 불꽃 명검이 탄생했다!', '다 부숴버릴 수 있겠어!'],
    pre_dungeon: ['복잡한 작전은 생략하고 돌격이다!', '몸이 근질근질했다고!'],
    returned_win: ['하하하! 몬스터들을 싹 쓸어버렸다!', '시원하게 한판 뛰었군!'],
    returned_fail: ['젠장! 다음엔 꼭 박살 내주마!', '잠깐 쉬고 바로 재도전이다!'],
  },
  cheerful: {
    hungry: ['꼬르륵~ 맛있는 스튜 냄새가 나요!', '밥 먹을 시간이다~!'],
    eating: ['와아~ 입안에서 살살 녹아요!', '주인장님 요리 솜씨 최고예요!'],
    price_good: ['주인장님 인심 최고! 단골 할래요~', '기분 좋은 쇼핑이네요!'],
    pre_dungeon: ['다녀오면 맛있는 간식이 기다린다구요!', '다 같이 힘내서 출발해요!'],
    party_banter: ['오늘 우리 파티 호흡 최고인데요~?', '웃으면서 다녀와요!'],
    returned_win: ['야호! 보물 잔뜩 들고 다녀왔어요~!', '모두 수고하셨어요!'],
  },
  lone_wolf: {
    hungry: ['...간단히 요기나 해야겠군.', '...조용한 구석 자리로.'],
    eating: ['...나쁘지 않군.', '...따뜻하군.'],
    pre_dungeon: ['...소란 피우지 마라. 출발한다.', '...내 발걸음에 맞춰라.'],
    enhance_success: ['...날이 예리하게 섰군.', '...마음에 드는 무기다.'],
    returned_win: ['...임무 완수다.', '...깔끔한 사냥이었군.'],
    returned_fail: ['...실수였군. 상처부터 치료한다.', '...다음엔 놓치지 않는다.'],
  },
  arrogant: {
    hungry: ['이 몸의 품격에 맞는 특선 요리를 내오게!', '출출하군, 식탁을 차려라!'],
    eating: ['흠, 왕성 요리사 못지않은 맛이로군.', '합격점을 주지, 주인장!'],
    price_high: ['흥, 이 몸의 명성을 보고 값을 올린 게냐?', '비싸지만 특별히 사주지!'],
    enhance_success: ['보아라! 이 몸에게 걸맞은 찬란한 장비다!', '감탄해도 좋다!'],
    pre_dungeon: ['내 눈부신 활약이나 똑똑히 보고 배우도록!', '나만 믿고 따라오라고!'],
    returned_win: ['후후, 내가 하드캐리한 원정이었지!', '당연한 승리 아니겠나!'],
  },
  merciful: {
    hungry: ['따뜻한 수프 한 그릇이면 기운이 날 거예요.', '식사부터 챙겨요.'],
    eating: ['마음까지 따뜻해지는 맛이에요.', '정성이 가득 담긴 요리네요.'],
    healed: ['상처가 말끔히 나았어요. 다행이에요!', '포근한 침대 덕분에 회복됐어요.'],
    pre_dungeon: ['아무도 다치지 않고 무사히 돌아와요.', '제가 뒤에서 치유해 드릴게요!'],
    returned_win: ['다들 크게 다치지 않아서 정말 다행이에요!', '축복이 함께한 원정이었어요.'],
  },
  playful: {
    hungry: ['배 속에 거지가 들었나 봐~ 밥 줘요!', '스튜 냄새에 발이 저절로 움직이네!'],
    eating: ['냠냠! 역시 여관 밥이 제일 꿀맛!', '배도 빵빵해졌으니 뛰어볼까!'],
    pre_dungeon: ['이번에 누가 몬스터 더 많이 잡나 내기할래?', '신나는 보물찾기 시간이다!'],
    party_banter: ['뒤처지는 사람이 오늘 에일 쏘기다!', '환상의 콤비 출동~!'],
    returned_win: ['짜잔~ 전리품 한 보따리 가져왔지롱!', '오늘 내기는 내가 이겼다!'],
  },
};

const DEFAULT_SITUATION_QUOTES: Record<SpeechSituation, string[]> = {
  hungry: ['배가 출출하네...', '따뜻한 식사부터 해야겠어.'],
  eating: ['크으, 여관 요리가 최고야!', '든든하게 배를 채웠군!'],
  price_high: ['오늘 물가가 꽤 비싸네...', '가격이 좀 부담되는걸.'],
  price_good: ['오, 가격도 합리적이네!', '주인장 인심이 후하구먼!'],
  loot_price_low: ['매입 시세가 평소보다 낮네...', '조금 아쉽지만 팔아야지.'],
  loot_sold: ['전리품을 팔아 금화를 챙겼어!', '가방이 가벼워졌군!'],
  potion_bought: ['탐험 전 포션 한 병은 필수지!', ' 든든한 비약을 챙겼어!'],
  equip_bought: ['새 장비가 손에 착 감기는군!', '대장간 솜씨가 훌륭해!'],
  enhance_success: ['강화 성공! 무기가 빛난다!', '+강화 대성공이다!'],
  enhance_fail: ['으악! 장비가 깨졌지만 기본 무기가 있다!', '아깝군... 다시 단조해야지.'],
  resting: ['쿨쿨... 침대가 푹신하구나...', '잠시 눈 좀 붙이자...'],
  healed: ['개운하게 회복 완료!', '몸이 한결 가벼워졌어!'],
  pre_dungeon: ['파티 집결 완료! 던전으로 출발하자!', '장비 점검 끝! 원정 출발!'],
  returned_win: ['무사히 공략 성공하고 돌아왔소!', '전리품을 챙겨 귀환했다!'],
  returned_fail: ['부상을 입어 후퇴했다... 치료부터 하자.', '만만치 않은 던전이었군...'],
  party_banter: ['우리 시너지라면 문제없어!', '호흡을 맞춰서 나아가자!'],
  order_ack: ['주인장 지시대로 움직이겠소!', '알겠소, 바로 실행하지!'],
};

export function generateHeroSpeech(
  situation: SpeechSituation,
  personalities: PersonalityId[],
  rng: () => number,
  extraLabel?: string
): string {
  if (situation === 'order_ack' && extraLabel) {
    return `지시 확인: ${extraLabel}!`;
  }
  const primary = personalities[0];
  const pPool = primary ? PERSONALITY_FLAVOR_QUOTES[primary]?.[situation] : undefined;
  const pool =
    pPool && pPool.length > 0 ? pPool : DEFAULT_SITUATION_QUOTES[situation];
  return pool[Math.floor(rng() * pool.length)];
}

// ============================================================================
// 던전 층별 몬스터 & 보스 생성기 (카이로소프트풍 층별 전투 연출용)
// ============================================================================

const DUNGEON_MONSTER_THEMES: Record<
  string,
  {
    minionName: string;
    eliteName: string;
    bossName: string;
    sprite: MonsterSpriteType;
  }
> = {
  dungeon_slime: {
    minionName: '초록 동굴 슬라임',
    eliteName: '맹독 바위 슬라임',
    bossName: '👑 대왕 젤리 슬라임',
    sprite: 'slime',
  },
  dungeon_goblin: {
    minionName: '고블린 정찰병',
    eliteName: '고블린 철갑 투사',
    bossName: '👑 고블린 족장 그룩',
    sprite: 'goblin',
  },
  dungeon_shadow_forest: {
    minionName: '그림자 늑대',
    eliteName: '고대 덩굴 망령',
    bossName: '👑 안개 숲의 알파 펜리르',
    sprite: 'wolf',
  },
  dungeon_ruined_tower: {
    minionName: '룬 경비 골렘',
    eliteName: '비전 마력 구체',
    bossName: '👑 별빛 아크골렘 수호자',
    sprite: 'golem',
  },
  dungeon_dwarf_mine: {
    minionName: '광산 동굴 트롤',
    eliteName: '용암 강철 기갑병',
    bossName: '👑 미스릴 거신 크라그',
    sprite: 'troll',
  },
  dungeon_abyss_sanctum: {
    minionName: '타락한 성소 기사',
    eliteName: '심연의 암흑 집행관',
    bossName: '👑 심연의 대심판관 발타자르',
    sprite: 'knight',
  },
  dungeon_dragon_lair: {
    minionName: '화산 화염 드레이크',
    eliteName: '홍련의 용인 근위병',
    bossName: '👑 고대 화룡 이그니우스',
    sprite: 'dragon',
  },
};

export function getDungeonTotalFloors(dungeon: DungeonDef): number {
  if (dungeon.tier <= 2) return 3;
  if (dungeon.tier <= 5) return 4;
  return 5;
}

export function createFloorMonsters(
  dungeon: DungeonDef,
  floor: number,
  totalFloors: number
): ExpeditionMonsterUnit[] {
  const theme =
    DUNGEON_MONSTER_THEMES[dungeon.id] ?? DUNGEON_MONSTER_THEMES.dungeon_slime;
  const isBossFloor = floor >= totalFloors;
  const baseHp = Math.round(
    (dungeon.requiredStats.hp * 0.42 + dungeon.recommendedPower * 0.45) *
      (0.75 + (floor / totalFloors) * 0.45)
  );
  const baseAtk = Math.max(
    6,
    Math.round(
      (dungeon.requiredStats.atk * 0.35 + dungeon.tier * 8) *
        (0.8 + (floor / totalFloors) * 0.35)
    )
  );

  if (isBossFloor) {
    return [
      {
        id: `${dungeon.id}_f${floor}_boss`,
        name: theme.bossName,
        spriteType: theme.sprite,
        maxHp: Math.round(baseHp * 1.45),
        currentHp: Math.round(baseHp * 1.45),
        atk: Math.round(baseAtk * 1.25),
        isBoss: true,
        hitFlashTimer: 0,
        lungeTimer: 0,
      },
      {
        id: `${dungeon.id}_f${floor}_guard`,
        name: theme.eliteName,
        spriteType: theme.sprite,
        maxHp: Math.round(baseHp * 0.65),
        currentHp: Math.round(baseHp * 0.65),
        atk: Math.round(baseAtk * 0.8),
        isBoss: false,
        hitFlashTimer: 0,
        lungeTimer: 0,
      },
    ];
  }

  const isMidFloor = floor > 1;
  return [
    {
      id: `${dungeon.id}_f${floor}_m1`,
      name: isMidFloor ? theme.eliteName : theme.minionName,
      spriteType: theme.sprite,
      maxHp: Math.round(baseHp * 0.8),
      currentHp: Math.round(baseHp * 0.8),
      atk: baseAtk,
      isBoss: false,
      hitFlashTimer: 0,
      lungeTimer: 0,
    },
    {
      id: `${dungeon.id}_f${floor}_m2`,
      name: theme.minionName,
      spriteType: theme.sprite,
      maxHp: Math.round(baseHp * 0.65),
      currentHp: Math.round(baseHp * 0.65),
      atk: Math.round(baseAtk * 0.85),
      isBoss: false,
      hitFlashTimer: 0,
      lungeTimer: 0,
    },
  ];
}
