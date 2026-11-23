import { FacilityId } from './types';

/** 실내 바닥 타일 범위 (벽은 gx=0, gy=0) */
export const FLOOR_MIN = 1;
export const FLOOR_MAX = 12;
export const GRID = 13;

export interface RoomZone {
  id: FacilityId | 'dungeon_gate' | 'courtyard';
  name: string;
  gx1: number;
  gy1: number;
  gx2: number;
  gy2: number;
}

/** 한 건물 안의 코너 구역 (연속 바닥) */
export const ROOM_ZONES: RoomZone[] = [
  { id: 'inn', name: '식당', gx1: 1, gy1: 1, gx2: 6, gy2: 6 },
  { id: 'blacksmith', name: '대장간', gx1: 7, gy1: 1, gx2: 12, gy2: 5 },
  { id: 'potion', name: '공방', gx1: 1, gy1: 7, gx2: 5, gy2: 12 },
  { id: 'trade', name: '교역소', gx1: 7, gy1: 7, gx2: 12, gy2: 12 },
];

export const DUNGEON_DOOR = { gx: 6, gy: 0.15 };
export const ENTRANCE = { gx: 6.5, gy: 12.05 };

/** 가구·기둥·계단이 차지하는 정수 타일 (길찾기용) */
export const BLOCKED: ReadonlySet<string> = new Set([
  // 벽난로·바
  '2,1',
  '1,2',
  '1,3',
  '1,4',
  '1,5',
  // 식탁·작은 탁자
  '4,3',
  '4,4',
  '5,2',
  // 슬롯 캐비닛
  '3,5',
  // 용광로·모루·무기랙·제단
  '9,1',
  '10,1',
  '8,3',
  '11,1',
  '11,2',
  '11,4',
  // 포션 선반·가마솥
  '1,8',
  '1,9',
  '1,10',
  '1,11',
  '3,9',
  '3,10',
  // 거래 카운터·상자
  '8,9',
  '9,9',
  '11,8',
  '11,10',
  // 계단·기둥
  '1,6',
  '2,6',
  '6,6',
  '8,6',
]);

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function isWalkable(gx: number, gy: number): boolean {
  const x = Math.round(gx);
  const y = Math.round(gy);
  if (x < FLOOR_MIN || y < FLOOR_MIN || x > FLOOR_MAX || y > FLOOR_MAX) return false;
  return !BLOCKED.has(tileKey(x, y));
}

export function nearestWalkable(gx: number, gy: number): { x: number; y: number } {
  const sx = Math.round(gx);
  const sy = Math.round(gy);
  if (isWalkable(sx, sy)) return { x: sx, y: sy };
  for (let r = 1; r <= 6; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        if (isWalkable(sx + dx, sy + dy)) return { x: sx + dx, y: sy + dy };
      }
    }
  }
  return { x: 6, y: 7 };
}

export function findPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number
): { x: number; y: number }[] {
  const start = nearestWalkable(sx, sy);
  const goal = nearestWalkable(tx, ty);
  if (start.x === goal.x && start.y === goal.y) return [goal];

  const q: { x: number; y: number }[] = [start];
  const prev = new Map<string, string | null>();
  prev.set(tileKey(start.x, start.y), null);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  let found = false;
  while (q.length) {
    const cur = q.shift()!;
    if (cur.x === goal.x && cur.y === goal.y) {
      found = true;
      break;
    }
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const k = tileKey(nx, ny);
      if (prev.has(k) || !isWalkable(nx, ny)) continue;
      prev.set(k, tileKey(cur.x, cur.y));
      q.push({ x: nx, y: ny });
    }
  }

  if (!found) return [goal];

  const path: { x: number; y: number }[] = [];
  let k: string | null = tileKey(goal.x, goal.y);
  while (k) {
    const [x, y] = k.split(',').map(Number);
    path.push({ x, y });
    k = prev.get(k) ?? null;
  }
  path.reverse();
  return path;
}

export function zoneAt(gx: number, gy: number): FacilityId | 'dungeon_gate' | null {
  if (Math.abs(gx - DUNGEON_DOOR.gx) < 1.2 && gy < 1.4) return 'dungeon_gate';
  if (Math.abs(gx - ENTRANCE.gx) < 1.4 && gy > 11.2) return 'trade';
  for (const r of ROOM_ZONES) {
    if (gx >= r.gx1 && gx <= r.gx2 && gy >= r.gy1 && gy <= r.gy2) return r.id as FacilityId;
  }
  // 중앙 홀은 가장 가까운 구역으로
  if (gx >= FLOOR_MIN && gx <= FLOOR_MAX && gy >= FLOOR_MIN && gy <= FLOOR_MAX) {
    if (gx < 7 && gy < 7) return 'inn';
    if (gx >= 7 && gy < 7) return 'blacksmith';
    if (gx < 7) return 'potion';
    return 'trade';
  }
  return null;
}

export function getZoneName(zoneId: string): string {
  const found = ROOM_ZONES.find((r) => r.id === zoneId);
  if (found) return found.name;
  if (zoneId === 'dungeon_gate') return '던전';
  return zoneId;
}

export const HERO_WAYPOINTS: { gx: number; gy: number; lines: string[] }[] = [
  { gx: 3.4, gy: 2.8, lines: ['맛있는 냄새!', '푹 쉬었다~', '아늑하다!'] },
  { gx: 5.2, gy: 5.4, lines: ['한잔 할까?', '슬롯 돌려볼까!'] },
  { gx: 8.2, gy: 3.4, lines: ['새 무기!', '강화 대박!', '모루 소리!'] },
  { gx: 3.4, gy: 8.2, lines: ['포션 챙겨가자!', '보글보글 신기해'] },
  { gx: 8.4, gy: 8.2, lines: ['재료 산다!', '가루 교환!', '시세 좋다!'] },
  { gx: 6.5, gy: 7.2, lines: ['던전 가고 싶다!', '컨디션 최고!', 'Ugh... 배고파'] },
  { gx: 6.5, gy: 10.5, lines: ['문 앞이다', '다녀올게!'] },
];

export const STAFF_HOME: Record<string, { gx: number; gy: number }> = {
  chef: { gx: 2.6, gy: 3.4 },
  forger: { gx: 8.4, gy: 2.6 },
  enhancer: { gx: 10.2, gy: 3.4 },
  enchanter: { gx: 10.6, gy: 4.6 },
  alchemist: { gx: 3.6, gy: 8.4 },
};
