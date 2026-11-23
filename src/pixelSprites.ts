import { FacilityId, HeroClassId, StaffRoleId, WeaponTypeId } from './types';

/**
 * 카이로소프트풍 채도 낮은 따뜻한 팔레트 (순수 검정 #000 금지, 외곽선은 #271c19 / #3a2a22)
 */
export const PAL: Record<string, string> = {
  '.': '', // 투명
  // 외곽선 및 그림자
  O: '#271c19', // 기본 짙은 따뜻한 갈색 외곽선
  o: '#3a2a22', // 부드러운 내부 외곽선
  S: '#1d1526', // 깊은 바닥 그림자

  // 피부 및 얼굴
  s: '#f4cfa6', // 밝은 복숭아 피부 (좌상단 광원)
  d: '#dba87b', // 피부 음영
  p: '#d96b70', // 볼터치 핑크
  e: '#271c19', // 눈동자
  w: '#f5efe6', // 따뜻한 흰색 (모자/하이라이트/앞치마)
  g: '#d6cbb9', // 따뜻한 밝은 회색 (흰색 음영)

  // 원목 & 가구 갈색 톤 (4단 램프)
  W: '#d4a36a', // 원목 하이라이트
  u: '#b58046', // 원목 기본
  n: '#8c5c2b', // 원목 음영
  m: '#633d19', // 원목 깊은 음영

  // 먼지 낀 금 & 황동 (4단 램프)
  Y: '#f2d675', // 밝은 금 하이라이트
  y: '#d6ac47', // 기본 금
  k: '#a67c26', // 금 음영
  K: '#735114', // 깊은 황동

  // 식은 슬레이트 & 강철 (4단 램프)
  I: '#cbd5dc', // 강철 하이라이트
  i: '#98a7b3', // 강철 기본
  j: '#687785', // 강철 음영
  J: '#434e59', // 짙은 철색

  // 따뜻한 벽돌/크림슨 레드 (4단 램프)
  R: '#e06c62', // 밝은 다홍/벽돌
  r: '#b84640', // 차분한 크림슨
  c: '#8a2f2c', // 짙은 와인/벽돌 음영
  C: '#5c1d1c', // 깊은 적갈색

  // 화염 & 용암 (과하지 않은 따뜻한 오렌지)
  F: '#fae078', // 불꽃 중심
  f: '#e38a3b', // 따뜻한 주황 불꽃
  l: '#b84e22', // 식은 용암/석탄
  L: '#752b13', // 굳은 용암 껍질

  // 이끼 & 허브 세이지 그린 (채도 낮춘 자연 톤)
  G: '#a5bd7e', // 밝은 이끼/잎
  v: '#7a9658', // 기본 이끼 그린
  h: '#566e3d', // 이끼 음영
  H: '#384a27', // 깊은 숲 그림자

  // 차분한 슬레이트 블루 & 포션 청록 (형광 시안 제거)
  B: '#8fb3bf', // 차분한 하늘/유리 하이라이트
  b: '#638896', // 슬레이트 블루/틸
  t: '#466470', // 깊은 청회색
  T: '#2d434d', // 어두운 슬레이트

  // 자수정 & 룬 보라 (4단 램프)
  P: '#c7a4e0', // 밝은 자수정 빛
  a: '#946eb3', // 기본 자수정
  q: '#684a82', // 자수정 음영
  Q: '#442f57', // 깊은 자수정 돌
};

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
}

/**
 * 문자열 픽셀 그리드를 오프스크린 캔버스(ImageData)로 미리 구워둡니다.
 */
export function bakeGridSprite(
  rows: string[],
  customPalette?: Record<string, string>
): HTMLCanvasElement {
  const h = rows.length;
  const w = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const data = img.data;

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const hex = customPalette?.[ch] ?? PAL[ch];
      if (!hex) continue;
      const [r, g, b, a] = hexToRgba(hex);
      const idx = (y * w + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * 아이소메트릭 다이아몬드 타일(24x12 윗면 + 5px 두께 슬래브 = 24x17)을 픽셀 단위로 미리 굽습니다.
 * 좌상단 광원 규칙: 좌상단 가장자리 밝은 하이라이트, 내부 디더 패턴, 좌측 슬래브 중간톤, 우측 슬래브 암부, #271c19 외곽선.
 */
export interface TilePaletteSpec {
  topHighlight: string;
  topMain: string;
  topAlt: string;
  topShadow: string;
  leftSlab: string;
  rightSlab: string;
  outline: string;
  pattern: 'wood' | 'woodWorn' | 'carpet' | 'forge' | 'potion' | 'trade' | 'corridor' | 'lava';
}

export function bakeIsoTileSprite(
  spec: TilePaletteSpec,
  frame = 0
): HTMLCanvasElement {
  const W = 24;
  const H = 17;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const data = img.data;

  const setPx = (x: number, y: number, hex: string) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const [r, g, b, a] = hexToRgba(hex);
    const i = (y * W + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  };

  // 1. 다이아몬드 윗면 (y = 0..11)
  // 각 행 y에서 좌우 폭: top half (y=0..5) span = (y+1)*2 each side from center
  for (let y = 0; y < 12; y++) {
    const halfSpan = y < 6 ? (y + 1) * 2 : (12 - y) * 2;
    const xStart = 12 - halfSpan;
    const xEnd = 12 + halfSpan - 1;

    for (let x = xStart; x <= xEnd; x++) {
      const isLeftEdge = x <= xStart + 1;
      const isRightEdge = x >= xEnd - 1;

      if (isLeftEdge || isRightEdge) {
        // 테두리: 좌상단은 따뜻한 어두운 외곽선 바로 안쪽에 하이라이트
        if (y < 6 && isLeftEdge && x === xStart + 1) {
          setPx(x, y, spec.topHighlight);
        } else if (x === xStart || x === xEnd) {
          setPx(x, y, spec.outline);
        } else {
          setPx(x, y, y < 6 ? spec.topHighlight : spec.topShadow);
        }
        continue;
      }

      // 내부 픽셀 텍스처 & 디더링
      let col = spec.topMain;
      if (spec.pattern === 'wood') {
        // 원목 마루결 + 판자 이음새
        if ((x + y * 2) % 6 === 0) col = spec.topShadow;
        else if ((x + y) % 5 === 0) col = spec.topHighlight;
        else if ((x ^ y) % 3 === 0) col = spec.topAlt;
      } else if (spec.pattern === 'woodWorn') {
        // 발자국이 패인 어두운 마루
        if ((x + y * 2) % 5 === 0) col = spec.topShadow;
        else if ((x * 3 + y) % 4 === 0) col = spec.topAlt;
        else col = spec.topMain;
      } else if (spec.pattern === 'carpet') {
        // 금실 자수 테두리가 있는 붉은 양탄자
        const distEdge = Math.min(x - xStart, xEnd - x);
        if (distEdge === 2 || distEdge === 3) {
          col = (x + y) % 2 === 0 ? '#d6ac47' : spec.topHighlight;
        } else if ((x + y) % 2 === 0) {
          col = spec.topAlt;
        }
      } else if (spec.pattern === 'forge') {
        // 대장간 벽돌/석재 바닥 디더
        if (y % 3 === 0 || (x + (y >> 1) * 3) % 5 === 0) col = spec.topShadow;
        else if ((x + y) % 4 === 0) col = spec.topHighlight;
        else if ((x * 3 + y) % 5 === 0) col = spec.topAlt;
      } else if (spec.pattern === 'potion') {
        // 차분한 연금술 석판 + 은은한 룬 점
        if (x === 11 && y === 5) col = spec.topHighlight;
        else if ((x + y) % 4 === 0) col = spec.topAlt;
        else if (x - xStart === 2 || xEnd - x === 2) col = spec.topShadow;
      } else if (spec.pattern === 'trade') {
        // 이끼 낀 석재 & 따뜻한 원목 조화
        if ((x * 2 + y) % 7 === 0) col = '#6f8c51';
        else if ((x + y) % 3 === 0) col = spec.topAlt;
        else if (y < 4 && x < 12) col = spec.topHighlight;
      } else if (spec.pattern === 'corridor') {
        // 자수정 던전 복도 타일
        if ((x + y) % 3 === 0) col = spec.topAlt;
        else if (y <= 3 && x <= 11) col = spec.topHighlight;
      } else if (spec.pattern === 'lava') {
        // 멀리 북서쪽 구석의 은은한 용암 타일 (3프레임 일렁임)
        const wave = (x + y + frame * 2) % 6;
        if (wave === 0) col = spec.topHighlight;
        else if (wave <= 2) col = spec.topMain;
        else if (wave === 4) col = spec.topAlt;
        else col = spec.topShadow;
      }

      // 좌상단 광원 보정
      if (y < 4 && x < 11 && col === spec.topMain && (x + y) % 2 === 0) {
        col = spec.topHighlight;
      }

      setPx(x, y, col);
    }
  }

  // 2. 하단 3D 두께 슬래브 (y = 6..16)
  for (let x = 0; x < W; x++) {
    const bottomEdgeY = x < 12 ? 6 + Math.floor(x / 2) : 6 + Math.floor((23 - x) / 2);
    for (let dy = 1; dy <= 5; dy++) {
      const py = bottomEdgeY + dy;
      if (py >= H) continue;
      if (dy === 5 || x === 0 || x === W - 1 || x === 11 || x === 12) {
        setPx(x, py, spec.outline);
      } else if (x < 12) {
        // 좌하단 면 (광원을 조금 받는 중간 암부)
        setPx(x, py, dy === 1 ? spec.topShadow : spec.leftSlab);
      } else {
        // 우하단 면 (그늘진 암부)
        setPx(x, py, spec.rightSlab);
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * 아이소메트릭 방 뒷벽 1칸 세그먼트 (폭 12px, 높이 22px)
 * side === 'left' (북서쪽 벽: 오른쪽 아래에서 왼쪽 아래로 내려감)
 * side === 'right' (북동쪽 벽: 왼쪽 위에서 오른쪽 아래로 내려감)
 */
export type WallDecor =
  | 'plain'
  | 'window'
  | 'shelf'
  | 'banner'
  | 'dungeon'
  | 'dungeonActive';

export function bakeIsoWallSegment(
  side: 'left' | 'right',
  wallLight: string,
  wallMain: string,
  wallDark: string,
  trimGold: string,
  wainscot: string,
  decor: WallDecor = 'plain'
): HTMLCanvasElement {
  const W = 12;
  const H = 42;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const data = img.data;

  const setPx = (x: number, y: number, hex: string) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const [r, g, b, a] = hexToRgba(hex);
    const i = (y * W + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  };

  const wallH = 32;
  for (let x = 0; x < W; x++) {
    const slopeY = side === 'right' ? Math.floor(x / 2) : Math.floor((W - 1 - x) / 2);
    const topY = slopeY;
    const botY = slopeY + wallH;

    for (let y = topY; y <= botY; y++) {
      const relY = y - topY;
      let col = side === 'left' ? wallMain : wallDark;

      if (relY === 0 || relY === wallH) {
        col = PAL.O;
      } else if (relY === 1 || relY === 2) {
        // 상단 몰딩 금테/원목 마감
        col = relY === 1 ? trimGold : wallLight;
      } else if (relY === 3) {
        col = PAL.o;
      } else if (relY >= wallH - 4) {
        // 하단 웨인스코팅(나무 걸레받이)
        col = relY === wallH - 4 ? PAL.o : wainscot;
      } else {
        // 양쪽 모두 같은 따뜻한 회반죽. 조명만 다름 (왼쪽이 조금 밝음).
        const grain = (x * 3 + relY * 5) % 7;
        if (side === 'left') {
          col = grain === 0 ? wallLight : wallMain;
        } else {
          col = grain === 0 ? wallMain : wallDark;
        }
        if ((x + relY * 2) % 13 === 0 && relY % 2 === 0) {
          col = side === 'left' ? wallMain : wallDark;
        }
      }

      if (x === 0) {
        // 타일 경계 기둥 라인
        if (relY > 2 && relY < wallH - 1 && relY % 2 === 0) col = wallDark;
      }
      setPx(x, y, col);
    }
  }

  const paint = (lx: number, relY: number, hex: string) => {
    const slopeY = side === 'right' ? Math.floor(lx / 2) : Math.floor((W - 1 - lx) / 2);
    setPx(lx, slopeY + relY, hex);
  };

  if (decor === 'window') {
    for (let lx = 2; lx <= 9; lx++) {
      for (let ry = 8; ry <= 21; ry++) {
        const edge = lx === 2 || lx === 9 || ry === 8 || ry === 21 || lx === 5 || ry === 14;
        if (edge) paint(lx, ry, PAL.O);
        else if (ry <= 13 && lx <= 4) paint(lx, ry, '#fae078');
        else if (ry <= 16) paint(lx, ry, '#e8c468');
        else paint(lx, ry, '#d6ac47');
      }
    }
  } else if (decor === 'shelf') {
    for (let lx = 1; lx <= 10; lx++) {
      paint(lx, 16, PAL.O);
      paint(lx, 17, PAL.n);
      paint(lx, 18, PAL.u);
    }
    paint(2, 14, PAL.r);
    paint(2, 15, PAL.R);
    paint(5, 13, PAL.a);
    paint(5, 14, PAL.P);
    paint(5, 15, PAL.q);
    paint(8, 14, PAL.v);
    paint(8, 15, PAL.G);
    paint(3, 15, PAL.Y);
  } else if (decor === 'banner') {
    for (let ry = 6; ry <= 22; ry++) {
      for (let lx = 3; lx <= 8; lx++) {
        if (lx === 3 || lx === 8 || ry === 6 || ry === 22) paint(lx, ry, PAL.O);
        else if ((lx + ry) % 2 === 0) paint(lx, ry, ry < 10 ? PAL.Y : PAL.r);
        else paint(lx, ry, ry < 10 ? PAL.y : PAL.c);
      }
    }
    paint(5, 5, PAL.K);
    paint(6, 5, PAL.K);
  } else if (decor === 'dungeon' || decor === 'dungeonActive') {
    const glow = decor === 'dungeonActive' ? PAL.R : PAL.P;
    const mid = decor === 'dungeonActive' ? PAL.f : PAL.a;
    const deep = decor === 'dungeonActive' ? PAL.C : PAL.Q;
    for (let lx = 0; lx <= 11; lx++) {
      for (let ry = 6; ry <= 32; ry++) {
        const archTop = (lx <= 1 || lx >= 10) && ry < 10;
        if (archTop) continue;
        if (lx === 0 || lx === 11 || ry === 6) paint(lx, ry, PAL.J);
        else if (lx === 1 || lx === 10 || ry === 7) paint(lx, ry, PAL.i);
        else if ((lx + ry) % 3 === 0) paint(lx, ry, glow);
        else if (ry > 22) paint(lx, ry, deep);
        else paint(lx, ry, mid);
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ============================================================================
// 방 가구 및 소품 픽셀 아트 그리드 (손으로 찍은 다중 프레임 도트 스프라이트)
// ============================================================================

/**
 * 1. 여관 화덕 & 끓는 스튜 솥 (24x26, 3프레임 불꽃 + 스튜 거품 애니메이션)
 */
function buildInnHearthFrames(): HTMLCanvasElement[] {
  const makeRows = (f: number): string[] => {
    const steamRow1 =
      f === 0
        ? '........w...g...........'
        : f === 1
        ? '.........g...w..........'
        : '.......w....g...........';
    const steamRow2 =
      f === 0
        ? '.........g.w............'
        : f === 1
        ? '........w...g...........'
        : '.........w.g............';
    const stewTop =
      f === 0
        ? '......OOffFfFFfFOO......'
        : f === 1
        ? '......OOfFFffFFfOO......'
        : '......OOFFfFFffFOO......';
    const fireCore =
      f === 0
        ? '.....OcmOOfFFFfOOmcO....'
        : f === 1
        ? '.....OcmOOFfFFFOOmcO....'
        : '.....OcmOOffFfFOOmcO....';

    return [
      steamRow1,
      steamRow2,
      '.......OOOOOOOOOO.......',
      '......OIIiiiiiiIIO......',
      stewTop,
      '.....OJjffffffffjJO.....',
      '.....OJJiiiiiiiiJJO.....',
      '......OJJJJJJJJJJO......',
      '....OOOOOOOOOOOOOOOO....',
      '...ORRRRRrrrrrrRRRRRO...',
      '..ORrrcRRRRrrRRRRcrrRO..',
      '..ORrrrOOOOOOOOOOrrrRO..',
      '..ORrcrOccccccccOrcrRO..',
      '..ORrrrcrrRRRRrrcrrrRO..',
      '...ORrrOOOOOOOOOOrrRO...',
      '....ORrOLLLLLLLLOrRO....',
      fireCore,
      '....OcmOOlfFFFflOOmcO...',
      '....OccOOllfffllOOccO...',
      '....OcccOOOOOOOOOcccO...',
      '.....OcccccccccccccO....',
      '......OOOOOOOOOOOOO.....',
    ];
  };
  return [0, 1, 2].map((f) => bakeGridSprite(makeRows(f)));
}

/**
 * 2. 여관 만찬 식탁 (28x20: 원목 식탁 + 로스트 치킨 + 맥주잔 + 접시)
 */
function buildInnTableSprite(): HTMLCanvasElement {
  const rows = [
    '..........OOOO....OOOO......',
    '.........OYyyYO..OwwwwO.....',
    '.......OOOyFFyOOOOfrrfOOO...',
    '.....OOWWWWWWWWWWWWWWWWWWO..',
    '...OOWWuuuuuuuuuuuuuuuuWWOO.',
    '..OWWuuOwwOuuOfffOuuOYyOuuWO',
    '.OWWuuuOggOuuOrrrOuuOkkOuuuW',
    '.OWuuuuuuuuuuuuuuuuuuuuuuuuW',
    '..OWWuuuuuuuuuuuuuuuuuuuuWWO',
    '...OOnnnnnnnnnnnnnnnnnnnnOO.',
    '....OOnnnnnmmmmmmnnnnnnOO...',
    '....OmmOOmmmmmmmmmmOOmmO....',
    '....OmmO.OOOOOOOOOO.OmmO....',
    '....OmmO..OmmO.OmmO.OmmO....',
    '....OOOO..OmmO.OmmO.OOOO....',
    '..........OOOO.OOOO.........',
  ];
  return bakeGridSprite(rows);
}

/**
 * 3. 보물상자 (16x14: 붉은 원목 + 황동 장식 + 자물쇠 하이라이트)
 */
function buildTreasureChestSprite(): HTMLCanvasElement {
  const rows = [
    '....OOOOOOOO....',
    '..OOYyRRRRyYOO..',
    '.OYyRRRRRRRRyYO.',
    '.ORyRRRRRRRRyRO.',
    '.OOOOOOOOOOOOOO.',
    '.OYyrrrOOrrryYO.',
    '.ORyrrOYYOrryRO.',
    '.ORyrrOyyOrryRO.',
    '.ORycccOOcccyRO.',
    '.OYyccccccccyYO.',
    '..OOOOOOOOOOOO..',
  ];
  return bakeGridSprite(rows);
}

/**
 * 4. 미니 슬롯머신 캐비닛 (16x22, 3프레임 릴 조명 애니메이션)
 */
function buildSlotCabinetFrames(): HTMLCanvasElement[] {
  const makeRows = (f: number): string[] => {
    const marquee =
      f === 0
        ? '...OYYyRRYyYYO..'
        : f === 1
        ? '...ORRyYYyYRRO..'
        : '...OyYYRRYyYyO..';
    const reel1 =
      f === 0
        ? '..OkyOwRwoFwoykO'
        : f === 1
        ? '..OkyOwBwoRwoykO'
        : '..OkyOwFwoPwoykO';
    const reel2 =
      f === 0
        ? '..OkyOwFwoRwoykO'
        : f === 1
        ? '..OkyOwRwoFwoykO'
        : '..OkyOwRwoRwoykO';

    return [
      '....OOOOOOOO....',
      marquee,
      '..OOyyyyyyyyOO..',
      '.OYYuuuuuuuuYYO.',
      '.OyuOOOOOOOOuyO.',
      reel1,
      reel2,
      '.OkyOOOOOOOOykO.',
      '.OyuunRRRRnuuyO.',
      '.OyuunnnnnnuuyOO',
      '.OOnnnnnnnnnnOOo',
      '..OnnOyyyyOnnORo',
      '..OnnOkkkkOnnOO.',
      '..OnnnnnnnnnnO..',
      '..OmmmmmmmmmmO..',
      '...OOOOOOOOOO...',
    ];
  };
  return [0, 1, 2].map((f) => bakeGridSprite(makeRows(f)));
}

/**
 * 5. 대장간 용광로 & 풀무 (26x26, 3프레임 쇳물/불길 애니메이션)
 */
function buildBlacksmithFurnaceFrames(): HTMLCanvasElement[] {
  const makeRows = (f: number): string[] => {
    const topSmoke =
      f === 0
        ? '........f....g............'
        : f === 1
        ? '.........F..w.............'
        : '.......g....f.............';
    const furnaceCore1 =
      f === 0
        ? '....OjjOllfFFFFfllOjjO....'
        : f === 1
        ? '....OjjOllFFFFFfllOjjO....'
        : '....OjjOllffFFFfllOjjO....';
    const furnaceCore2 =
      f === 0
        ? '....OJJOlfFFFFFFflOJJO....'
        : f === 1
        ? '....OJJOlfffFFFfflOJJO....'
        : '....OJJOlfFFFFFfflOJJO....';

    return [
      topSmoke,
      '.......OOOOOOOOOO.........',
      '......OIIiiiiiiIIO........',
      '......OjjJJJJJJjjO........',
      '.....OOiijjjjjjiiOO.......',
      '....OIIiijjjjjjiiIIO......',
      '....OjjJJiiiiiiJJjjO......',
      '...OOiiOOOOOOOOOOiiOO.....',
      '..OIiiiOLLLLLLLLLiiiIO....',
      '..OjjjjOllffffflljjjjO....',
      furnaceCore1,
      furnaceCore2,
      '...OJJJOllffffffllOJJOOO..',
      '...OjjjOOOOOOOOOOOOjjWuWO.',
      '...OiiiiijjjjjjjiiiiiuuuO.',
      '....OjjjjJJJJJJJjjjjjnnnO.',
      '.....OOOOOOOOOOOOOOOOOOO..',
    ];
  };
  return [0, 1, 2].map((f) => bakeGridSprite(makeRows(f)));
}

/**
 * 6. 대장간 강철 모루 & 담금질 물통 (24x18)
 */
function buildBlacksmithAnvilSprite(): HTMLCanvasElement {
  const rows = [
    '....OOOOOOOOOOOO........',
    '..OOIIIIIIIIIIIIOO......',
    '.OIIiiiiiiiiiiiiIIO.....',
    '..OOjjiiiiiiiiijjOO.....',
    '....OOjjjjjjjjOO..OOOOO.',
    '.....OOiiiiiiOO..OWuuuWO',
    '....OIIiiiiiiIIO.OuBBBuO',
    '...OOJJJJJJJJJJOOOubbbuO',
    '...OWWWuuuuuuWWWOOunnnnf',
    '...OWuuuuuuuuuuWO.OnnnnO',
    '...OnnnnnnnnnnnnO..OOOO.',
    '...OmmmmmmmmmmmmO.......',
    '....OOOOOOOOOOOO........',
  ];
  return bakeGridSprite(rows);
}

/**
 * 7. 대장간 무기 거치대 (20x20: 도트 검, 도끼, 방패 진열)
 */
function buildBlacksmithWeaponRackSprite(): HTMLCanvasElement {
  const rows = [
    '....OO....OO....OO..',
    '...OIIO..OIIO..OYYO.',
    '...OiiO..OIIIO.OyyO.',
    '..OWWWWWWWWWWWWWWWWO',
    '..OWuuOiiOuuOiiOuuWO',
    '..OnnnOiiOnnOiiOnnnO',
    '...OnnOiiOnnOiiOnnO.',
    '...OnnOYYOnnOYYOnnO.',
    '...OnnOkkOnnOkkOnnO.',
    '..OWWWWWWWWWWWWWWWWO',
    '..OnnnnnnnnnnnnnnnnO',
    '..OmmO..........OmmO',
    '..OOOO..........OOOO',
  ];
  return bakeGridSprite(rows);
}

/**
 * 8. 대장간 인챈트 룬 제단 (22x24, 3프레임 부유하는 자수정 수정 & 룬 마법서)
 */
function buildBlacksmithRuneAltarFrames(): HTMLCanvasElement[] {
  const makeRows = (f: number): string[] => {
    const crystalTop =
      f === 0
        ? [
            '.........OOOO.........',
            '........OPwwPO........',
            '.......OPPaqPPO.......',
            '........OPqqPO........',
            '.........OOOO.........',
          ]
        : f === 1
        ? [
            '......................',
            '.........OOOO.........',
            '........OPwwPO........',
            '.......OPPaqPPO.......',
            '........OPqqPO........',
          ]
        : [
            '........P....P........',
            '.........OOOO.........',
            '........OPwwPO........',
            '.......OPPaqPPO.......',
            '........OOOOOO........',
          ];

    return [
      ...crystalTop,
      '.....OOOOOOOOOOOO.....',
      '...OOPPaaaaaaaaPPOO...',
      '..OPPaOwwwOOwwwOaPPO..',
      '..OaqqOwgwOOwgwOqqaO..',
      '...OqqOOOOOOOOOOqqO...',
      '....OQQaPPPPPPaQQO....',
      '....OQQqaaaaaaqQQO....',
      '....OQQqOqOOqOqQQO....',
      '...OOQQqqqqqqqqQQOO...',
      '..OYYQQQQQQQQQQQQYYO..',
      '..OkkkkkkkkkkkkkkkkO..',
      '...OOOOOOOOOOOOOOOO...',
    ];
  };
  return [0, 1, 2].map((f) => bakeGridSprite(makeRows(f)));
}

/**
 * 9. 포션 공방 가마솥 (22x20, 3프레임 보글거리는 연금술 물약)
 */
function buildPotionCauldronFrames(): HTMLCanvasElement[] {
  const makeRows = (f: number): string[] => {
    const bubbles =
      f === 0
        ? '.......P...G..P.......'
        : f === 1
        ? '......G..P.....G......'
        : '........P...P..G......';
    const brewSurface =
      f === 0
        ? '....OIIPPPPGPPaaIIO...'
        : f === 1
        ? '....OIIaaPGPPPaaIIO...'
        : '....OIIPaPPPGPaaIIO...';

    return [
      bubbles,
      '....OOOOOOOOOOOOOO....',
      '...OIIIIiiiiiiIIIIO...',
      brewSurface,
      '...OJjjaaaaaaaaajjJO..',
      '..OJJiiiiiiiiiiiiJJO..',
      '..OJJijjjjjjjjjjiJJO..',
      '..OJJjjjjjjjjjjjjJJO..',
      '...OJJJJJJJJJJJJJJO...',
      '....OOJJJJJJJJJJOO....',
      '....OJO.OfffffO.OJO...',
      '....OOO..OlllO..OOO...',
    ];
  };
  return [0, 1, 2].map((f) => bakeGridSprite(makeRows(f)));
}

/**
 * 10. 포션 공방 약초 & 물약 선반장 (24x22: 다양한 색상의 작은 도트 포션 병들)
 */
function buildPotionShelfSprite(): HTMLCanvasElement {
  const rows = [
    '..OOOOOOOOOOOOOOOOOOOO..',
    '.OWWWWWWWWWWWWWWWWWWWWO.',
    '.OWuuOOuuOOuuOOuuOOuuWO.',
    '.OWuORROOGGOOBBOOPPOuWO.',
    '.OWuOrroOvvoObboOaaoUWO.',
    '.OWuuuuuuuuuuuuuuuuuuWO.',
    '.OnnnnnnnnnnnnnnnnnnnnO.',
    '.OWuuOOuuOOuuOOuuOOuuWO.',
    '.OWuOYYOOBBOORROOGGOuWO.',
    '.OWuOykbObtoOrcoOvhoUWO.',
    '.OWuuuuuuuuuuuuuuuuuuWO.',
    '.OnnnnnnnnnnnnnnnnnnnnO.',
    '.OmmmmmmmmmmmmmmmmmmmmO.',
    '..OOmmOOOOOOOOOOOOmmOO..',
    '...OOOO..........OOOO...',
  ];
  return bakeGridSprite(rows);
}

/**
 * 11. 포션 공방 차분한 수정 & 약초 화분 (20x18: 형광 시안 대신 차분한 슬레이트 블루/이끼)
 */
function buildPotionCrystalPlanterSprite(): HTMLCanvasElement {
  const rows = [
    '.......OO...OO......',
    '......OBBO.OBBO.....',
    '.....OBwbOOBbwBO....',
    '....OBbbtOBtbbBO....',
    '...OOGGGbbttbGGGOO..',
    '..OGvvvvhhhhvvhvvGO.',
    '..OOWWWWWWWWWWWWWOO.',
    '..OWuuuuuuuuuuuuuWO.',
    '..OnnnnnnnnnnnnnnnO.',
    '...OmmmmmmmmmmmmmO..',
    '....OOOOOOOOOOOOO...',
  ];
  return bakeGridSprite(rows);
}

/**
 * 12. 교역소 상점 카운터 & 황동 저울 (28x20)
 */
function buildTradeCounterSprite(): HTMLCanvasElement {
  const rows = [
    '.......OOOOOO...............',
    '......OYYYYYYO....OOOO......',
    '.....OYkOOOOkyO..OYYYYO.....',
    '....OOyyO..OyyOOOOyyyyOO....',
    '..OOWWWWWWWWWWWWWWWWWWWWOO..',
    '.OWWuuuuuuuuRRRRuuuuuuuuWWO.',
    '.OWuuuuuuuuuRRRRuuuuuuuuuWO.',
    '..OWWuuuuuuuccccuuuuuuuWWO..',
    '...OOnnnnnnnccccnnnnnnnOO...',
    '....OnnnYYYYccccYYYYnnnO....',
    '....OnnnkkkkcccckkkkmnnO....',
    '....OmmmmmmmmmmmmmmmmmmO....',
    '.....OOOOOOOOOOOOOOOOOO.....',
  ];
  return bakeGridSprite(rows);
}

/**
 * 13. 교역소 물자 상자 & 오크통 (22x18: 광석·약초·식량 자루)
 */
function buildTradeCratesSprite(): HTMLCanvasElement {
  const rows = [
    '....OOOOOO...OOOOOO...',
    '...OBBBBBBO.OGGGGGGO..',
    '..OOWWWWWWWOWWWWWWWOO.',
    '.OWWuuuuuuuOuuuuuuuWWO',
    '.OWuOnnnnnuOnnnnnuuWO.',
    '.OWuOnuuunuOnuuunuuWO.',
    '.OWuOnnnnnuOnnnnnuuWO.',
    '..OWuuuuuuuOuuuuuuuWO.',
    '...OmmmmmmmOmmmmmmmO..',
    '....OOOOOOOOOOOOOOO...',
  ];
  return bakeGridSprite(rows);
}

/**
 * 14. 교역소 붉은 점박이 버섯 & 이끼 돌 (16x15)
 */
function buildTradeMushroomSprite(): HTMLCanvasElement {
  const rows = [
    '.....OOOOOO.....',
    '...OORRwRRROO...',
    '..ORwwRRRRwwRO..',
    '.ORRRRRwwRRRRRO.',
    '.OcccRRRRRRcccO.',
    '..OOOOwwwwOOOO..',
    '.....OwwwwO.OOO.',
    '.....OwwwwOORwRO',
    '...OOGggggGOcccO',
    '..OGvvvhhhhGOwO.',
    '..OhhhhhhhhhhOO.',
    '...OOOOOOOOOOO..',
  ];
  return bakeGridSprite(rows);
}

/**
 * 15. 벽면 횃불 (8x14, 4프레임 타오르는 픽셀 불꽃)
 */
function buildWallTorchFrames(): HTMLCanvasElement[] {
  const makeRows = (f: number): string[] => {
    const flame =
      f === 0
        ? [
            '...OO...',
            '..OFFO..',
            '.OFWWFO.',
            '.OffffO.',
          ]
        : f === 1
        ? [
            '..OO....',
            '.OFFOO..',
            '.OFWFfO.',
            '.OffffO.',
          ]
        : f === 2
        ? [
            '....OO..',
            '..OOFFO.',
            '.OfFWFO.',
            '.OffffO.',
          ]
        : [
            '...OO...',
            '..OllO..',
            '.OFFWFO.',
            '.OffffO.',
          ];

    return [
      ...flame,
      '..OYYO..',
      '..OnnO..',
      '..OnnO..',
      '...OO...',
    ];
  };
  return [0, 1, 2, 3].map((f) => bakeGridSprite(makeRows(f)));
}

/**
 * 16. 방 뒷벽에 걸리는 작은 나무 간판 스프라이트 (24x13)
 * 방 이름 큰 글씨/이모지 오버레이 대신 아이콘이 새겨진 도트 나무 현판!
 */
function buildRoomSignboardSprite(facility: FacilityId): HTMLCanvasElement {
  const iconRows: Record<FacilityId, string[]> = {
    inn: [
      'OOfffOO',
      'OIIIIIo',
      'OifffiO',
      'OjjjjjO',
      '.OOOOO.',
    ],
    blacksmith: [
      'OOOOOOO',
      'OIIIIIo',
      '.OiiiO.',
      'OIIIIIo',
      'OOOOOOO',
    ],
    potion: [
      '..OOO..',
      '..OBO..',
      '.OBPBO.',
      'OBPPPBO',
      '.OOOOO.',
    ],
    trade: [
      '..OOO..',
      '.OYYYO.',
      'OYYwYYO',
      '.OyyyO.',
      '..OOO..',
    ],
  };

  const ic = iconRows[facility];
  const rows = [
    '...OO..............OO...',
    '...OYYOOOOOOOOOOOOYYO...',
    '..OOWWWWWWWWWWWWWWWWOO..',
    `.OWWu${ic[0]}uuuuuuuuWWO.`,
    `.OWuu${ic[1]}uuuuuuuuuWO.`,
    `.OWuu${ic[2]}uuuuuuuuuWO.`,
    `.OWuu${ic[3]}uuuuuuuuuWO.`,
    `.OWWu${ic[4]}uuuuuuuuWWO.`,
    '..OOnnnnnnnnnnnnnnnnOO..',
    '...OYYOOOOOOOOOOOOYYO...',
  ];
  return bakeGridSprite(rows);
}

/**
 * 17. 북동쪽 던전 입구 석조 아치 & 소용돌이 포탈 (36x30, 4프레임 애니메이션)
 */
function buildDungeonArchFrames(active: boolean): HTMLCanvasElement[] {
  const makeRows = (f: number): string[] => {
    // active일 때는 붉은 화염 포탈, 평소에는 차분한 자수정 포탈
    const c1 = active ? 'F' : 'P';
    const c2 = active ? 'f' : 'a';
    const c3 = active ? 'r' : 'q';
    const c4 = active ? 'C' : 'Q';

    const swirlRow = (rIdx: number) => {
      const shift = (rIdx + f) % 4;
      const pA = shift === 0 ? c1 : shift === 1 ? c2 : c3;
      const pB = shift === 1 ? c1 : shift === 2 ? c2 : c4;
      return `${c4}${c3}${pA}${pB}${c2}${pA}${pB}${c3}${c4}${c3}${pB}${pA}`;
    };

    return [
      '...........OOOOOOOOOOOOOO...........',
      '........OOOIIiiiiiiiiiIIIOOO........',
      '......OOIIiiijjjjjjjjjiiiIIIOO......',
      '.....OIIiijjjOOOOOOOOOOjjjiiIIO.....',
      '....OIijjjOOO' + c4.repeat(10) + 'OOOjjjiIO....',
      '...OIijjOO' + c3 + swirlRow(0) + c3 + 'OOjjiIO...',
      '..OIijjO' + c4 + c3 + swirlRow(1) + c3 + c4 + 'OjjiIO..',
      '..OijjO' + c4 + c3 + c2 + swirlRow(2) + c2 + c3 + c4 + 'OjjiO..',
      '.OFfjjO' + c4 + c3 + c1 + swirlRow(3) + c1 + c3 + c4 + 'OjjfFO.',
      '.OffjjO' + c4 + c3 + c2 + swirlRow(4) + c2 + c3 + c4 + 'OjjffO.',
      '..OYYjO' + c4 + c3 + c2 + swirlRow(5) + c2 + c3 + c4 + 'OjYYO..',
      '..OijjO' + c4 + c3 + c1 + swirlRow(6) + c1 + c3 + c4 + 'OjjiO..',
      '..OijjO' + c4 + c3 + c2 + swirlRow(7) + c2 + c3 + c4 + 'OjjiO..',
      '..OJJjO' + c4 + c4 + c3 + swirlRow(8) + c3 + c4 + c4 + 'OjJJO..',
      '..OvhjO' + c4 + c4 + c4 + c3.repeat(12) + c4 + c4 + c4 + 'OjhvO..',
      '.OOJJJOOOOOOOOOOOOOOOOOOOOOOOOJJJOO.',
      '.OIIIIJJJiiiiiiiiiiiiiiiiiiJJJIIIIO.',
      '.OjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjO.',
      '..OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO..',
    ];
  };
  return [0, 1, 2, 3].map((f) => bakeGridSprite(makeRows(f)));
}

// ============================================================================
// 2등신 치비 캐릭터 도트 스프라이트 생성기 (4방향 × 걷기4/대기4/작업4 프레임)
// 직업·역할별로 모자/투구/헤어, 갑옷/앞치마, 손에 든 도트 무기/도구로 구분!
// ============================================================================

export type ActorArchetypeId = StaffRoleId | HeroClassId;
export type ActorAnimState = 'walk' | 'idle' | 'work';
export type ActorFacing = 'se' | 'sw' | 'ne' | 'nw';

interface ArchetypeStyle {
  hatType: 'toque' | 'bandana' | 'horned' | 'wizard' | 'beret' | 'knight_helm' | 'mane' | 'ranger' | 'hood';
  hatMain: string;
  hatAccent: string;
  hairColor: string;
  bodyMain: string;
  bodyShadow: string;
  trimColor: string;
  tool: 'ladle' | 'hammer' | 'tongs' | 'rune_staff' | 'flask' | WeaponTypeId;
}

const ARCHETYPE_STYLES: Record<ActorArchetypeId, ArchetypeStyle> = {
  // 5대 전담 직원
  chef: {
    hatType: 'toque',
    hatMain: '#f5efe6',
    hatAccent: '#d6cbb9',
    hairColor: '#784828',
    bodyMain: '#d97836',
    bodyShadow: '#a8531d',
    trimColor: '#f5efe6',
    tool: 'ladle',
  },
  forger: {
    hatType: 'bandana',
    hatMain: '#b84640',
    hatAccent: '#d6ac47',
    hairColor: '#4a352a',
    bodyMain: '#8c5c2b',
    bodyShadow: '#633d19',
    trimColor: '#d6ac47',
    tool: 'hammer',
  },
  enhancer: {
    hatType: 'horned',
    hatMain: '#687785',
    hatAccent: '#d6cbb9',
    hairColor: '#c4682b',
    bodyMain: '#a6652c',
    bodyShadow: '#734218',
    trimColor: '#f2d675',
    tool: 'tongs',
  },
  enchanter: {
    hatType: 'wizard',
    hatMain: '#684a82',
    hatAccent: '#d6ac47',
    hairColor: '#c7a4e0',
    bodyMain: '#7d599c',
    bodyShadow: '#513769',
    trimColor: '#f2d675',
    tool: 'rune_staff',
  },
  alchemist: {
    hatType: 'beret',
    hatMain: '#566e3d',
    hatAccent: '#a5bd7e',
    hairColor: '#b58046',
    bodyMain: '#5e8261',
    bodyShadow: '#3f5941',
    trimColor: '#d4a36a',
    tool: 'flask',
  },

  // 5대 영웅 클래스
  knight: {
    hatType: 'knight_helm',
    hatMain: '#98a7b3',
    hatAccent: '#5882a6',
    hairColor: '#d6ac47',
    bodyMain: '#4d779e',
    bodyShadow: '#335270',
    trimColor: '#f2d675',
    tool: 'sword',
  },
  warrior: {
    hatType: 'mane',
    hatMain: '#b84640',
    hatAccent: '#d6ac47',
    hairColor: '#a83832',
    bodyMain: '#9e3b38',
    bodyShadow: '#6e2422',
    trimColor: '#d4a36a',
    tool: 'axe',
  },
  archer: {
    hatType: 'ranger',
    hatMain: '#566e3d',
    hatAccent: '#e06c62',
    hairColor: '#98b056',
    bodyMain: '#527344',
    bodyShadow: '#38522d',
    trimColor: '#d4a36a',
    tool: 'bow',
  },
  mage: {
    hatType: 'wizard',
    hatMain: '#5b4378',
    hatAccent: '#f2d675',
    hairColor: '#b692d4',
    bodyMain: '#6b4e8f',
    bodyShadow: '#483263',
    trimColor: '#f2d675',
    tool: 'staff',
  },
  rogue: {
    hatType: 'hood',
    hatMain: '#434e59',
    hatAccent: '#8fb3bf',
    hairColor: '#638896',
    bodyMain: '#475461',
    bodyShadow: '#2f3842',
    trimColor: '#b84640',
    tool: 'dagger',
  },
};

/**
 * 18x22 캔버스에 2등신 치비 캐릭터 1프레임을 픽셀 단위로 굽습니다.
 * - 순수 검정 없이 #271c19 외곽선
 * - 4방향(se, sw, ne, nw) 지원 (ne/nw는 뒷모습, sw는 좌우 반전)
 * - walk: 4프레임 다리 교차 + 팔 스윙 + 1px 바운스
 * - idle: 4프레임 숨쉬기(머리/어깨 1px 오르내림 + 깜빡임)
 * - work: 4프레임 도구/무기 스윙 액션
 */
export function bakeChibiCharacterFrame(
  archetype: ActorArchetypeId,
  state: ActorAnimState,
  facing: ActorFacing,
  frameIdx: number,
  overrideWeapon?: WeaponTypeId
): HTMLCanvasElement {
  const W = 20;
  const H = 24;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const data = img.data;

  const style = ARCHETYPE_STYLES[archetype];
  const tool = overrideWeapon || style.tool;
  const isBack = facing === 'ne' || facing === 'nw';
  const flipX = facing === 'sw' || facing === 'nw';

  const setPx = (rawX: number, y: number, hex: string) => {
    const x = flipX ? W - 1 - rawX : rawX;
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const [r, g, b, a] = hexToRgba(hex);
    const idx = (y * W + x) * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = a;
  };

  const fillRectPx = (x0: number, y0: number, w: number, h: number, hex: string) => {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        setPx(x0 + dx, y0 + dy, hex);
      }
    }
  };

  // 애니메이션 오프셋 계산
  let bodyBounceY = 0;
  let headBounceY = 0;
  let leftLegY = 0;
  let rightLegY = 0;
  let leftLegX = 0;
  let rightLegX = 0;
  let toolRaiseY = 0;
  let toolStrikeX = 0;

  if (state === 'walk') {
    // 4프레임 워크 사이클: 0(왼발 앞), 1(중간+바운스), 2(오른발 앞), 3(중간+바운스)
    if (frameIdx === 0) {
      leftLegY = -1;
      leftLegX = -1;
      rightLegY = 0;
      rightLegX = 1;
      toolRaiseY = -1;
    } else if (frameIdx === 1) {
      bodyBounceY = -1;
      headBounceY = -1;
    } else if (frameIdx === 2) {
      leftLegY = 0;
      leftLegX = 1;
      rightLegY = -1;
      rightLegX = -1;
      toolRaiseY = 1;
    } else {
      bodyBounceY = -1;
      headBounceY = -1;
    }
  } else if (state === 'idle') {
    // 4프레임 숨쉬기
    if (frameIdx === 1 || frameIdx === 2) {
      headBounceY = 1;
    }
    if (frameIdx === 2) {
      bodyBounceY = 1;
    }
  } else if (state === 'work') {
    // 4프레임 작업 모션 (망치질/국자젓기/연금술)
    if (frameIdx === 0) {
      toolRaiseY = -2;
      headBounceY = -1;
    } else if (frameIdx === 1) {
      toolRaiseY = -3;
      bodyBounceY = -1;
      headBounceY = -1;
    } else if (frameIdx === 2) {
      toolRaiseY = 2;
      toolStrikeX = 1;
      bodyBounceY = 1;
    } else {
      toolRaiseY = 0;
    }
  }

  // 1. 발밑 타원형 픽셀 그림자 (y = 21..22)
  for (let x = 5; x <= 13; x++) setPx(x, 22, '#231b2e');
  for (let x = 4; x <= 14; x++) setPx(x, 21, '#231b2e');

  // 2. 다리 / 부츠 (y = 18..21)
  const lX = 6 + leftLegX;
  const lY = 18 + leftLegY;
  fillRectPx(lX, lY, 3, 3, PAL.O);
  fillRectPx(lX + 1, lY, 1, 2, '#5c3e26');

  const rX = 10 + rightLegX;
  const rY = 18 + rightLegY;
  fillRectPx(rX, rY, 3, 3, PAL.O);
  fillRectPx(rX + 1, rY, 1, 2, '#47301d');

  // 3. 통통한 몸통 / 갑옷 / 앞치마 (y = 12..17 + bodyBounceY)
  const bY = 12 + bodyBounceY;
  for (let dy = 0; dy < 6; dy++) {
    const rowW = dy === 0 || dy === 5 ? 8 : 10;
    const x0 = 9 - (rowW >> 1);
    for (let dx = 0; dx < rowW; dx++) {
      const px = x0 + dx;
      const py = bY + dy;
      if (dy === 0 || dy === 5 || dx === 0 || dx === rowW - 1) {
        setPx(px, py, PAL.O);
      } else {
        let col = dx < rowW - 3 ? style.bodyMain : style.bodyShadow;
        // 벨트/앞치마 포인트
        if (dy === 3 && dx >= 2 && dx <= rowW - 3) {
          col = style.trimColor;
        } else if (archetype === 'chef' && !isBack && dy >= 2 && dx >= 3 && dx <= 6) {
          col = '#f5efe6';
        }
        setPx(px, py, col);
      }
    }
  }

  // 4. 2등신 머리 (y = 5..12 + headBounceY)
  const hY = 5 + headBounceY;
  for (let dy = 0; dy < 8; dy++) {
    const rowW = dy === 0 || dy === 7 ? 8 : 10;
    const x0 = 9 - (rowW >> 1);
    for (let dx = 0; dx < rowW; dx++) {
      const px = x0 + dx;
      const py = hY + dy;
      if (dy === 0 || dy === 7 || dx === 0 || dx === rowW - 1) {
        setPx(px, py, PAL.O);
      } else if (isBack) {
        // 뒷모습은 머리카락/후드로 덮임
        setPx(px, py, dx < 5 ? style.hairColor : PAL.o);
      } else {
        // 앞모습 얼굴 피부 + 좌상단 광원 음영
        const skinCol = dx >= rowW - 3 || dy === 6 ? PAL.d : PAL.s;
        setPx(px, py, skinCol);
      }
    }
  }

  // 앞모습 눈동자 & 볼터치 & 앞머리
  if (!isBack) {
    // 앞머리 라인
    for (let x = 5; x <= 12; x++) {
      setPx(x, hY + 1, style.hairColor);
      if (x === 5 || x === 6 || x === 12) setPx(x, hY + 2, style.hairColor);
    }
    // 눈동자 (idle 프레임 3에서는 살짝 깜빡임)
    const blink = state === 'idle' && frameIdx === 3;
    if (!blink) {
      setPx(7, hY + 4, PAL.O);
      setPx(11, hY + 4, PAL.O);
    }
    // 볼터치
    setPx(6, hY + 5, PAL.p);
    setPx(12, hY + 5, PAL.p);
  }

  // 5. 역할/직업별 모자·투구 (hY 위쪽)
  if (style.hatType === 'toque') {
    // 요리사 높은 흰 모자
    fillRectPx(5, hY - 3, 8, 4, PAL.O);
    fillRectPx(6, hY - 2, 6, 3, style.hatMain);
    setPx(11, hY - 1, style.hatAccent);
  } else if (style.hatType === 'wizard') {
    // 마법사/인챈터 고깔모자
    fillRectPx(4, hY, 10, 2, PAL.O);
    for (let x = 5; x <= 12; x++) setPx(x, hY, style.hatAccent);
    fillRectPx(6, hY - 2, 6, 2, style.hatMain);
    fillRectPx(7, hY - 4, 4, 2, style.hatMain);
    setPx(8, hY - 4, PAL.O);
    setPx(6, hY - 2, PAL.O);
    setPx(11, hY - 2, PAL.O);
  } else if (style.hatType === 'horned' || style.hatType === 'knight_helm') {
    // 투구 + 뿔 또는 바이저
    fillRectPx(5, hY - 1, 8, 3, PAL.O);
    fillRectPx(6, hY, 6, 2, style.hatMain);
    setPx(9, hY - 1, style.hatAccent);
    if (style.hatType === 'horned') {
      setPx(4, hY - 1, '#f5efe6');
      setPx(3, hY - 2, '#f5efe6');
      setPx(13, hY - 1, '#f5efe6');
      setPx(14, hY - 2, '#f5efe6');
    } else {
      setPx(9, hY - 2, style.hatAccent);
    }
  } else if (style.hatType === 'beret' || style.hatType === 'ranger') {
    // 베레모 / 레인저 깃털 모자
    fillRectPx(5, hY - 1, 8, 3, PAL.O);
    fillRectPx(6, hY, 6, 2, style.hatMain);
    setPx(12, hY - 1, style.hatAccent);
    setPx(13, hY - 2, style.hatAccent);
  } else if (style.hatType === 'bandana' || style.hatType === 'mane' || style.hatType === 'hood') {
    fillRectPx(5, hY, 8, 2, style.hatMain);
    setPx(8, hY + 1, style.hatAccent);
    setPx(9, hY + 1, style.hatAccent);
  }

  // 6. 손에 든 도트 무기/도구 (이모지 절대 금지, 순수 픽셀 아트로 렌더링)
  const tX = 14 + toolStrikeX;
  const tY = 12 + bodyBounceY + toolRaiseY;

  if (tool === 'sword') {
    // 도트 장검
    setPx(tX, tY + 3, PAL.O);
    setPx(tX, tY + 2, PAL.y);
    setPx(tX - 1, tY + 2, PAL.y);
    setPx(tX + 1, tY + 2, PAL.y);
    for (let i = -3; i <= 1; i++) {
      setPx(tX, tY + i, PAL.I);
      setPx(tX + 1, tY + i, PAL.O);
    }
    setPx(tX, tY - 4, PAL.O);
  } else if (tool === 'axe') {
    // 도트 전투도끼
    for (let i = -2; i <= 3; i++) setPx(tX, tY + i, PAL.n);
    fillRectPx(tX + 1, tY - 2, 3, 3, PAL.I);
    setPx(tX + 3, tY - 1, PAL.O);
    setPx(tX, tY - 3, PAL.O);
  } else if (tool === 'bow') {
    // 도트 사냥활
    setPx(tX, tY - 3, PAL.u);
    setPx(tX + 1, tY - 2, PAL.u);
    setPx(tX + 2, tY - 1, PAL.u);
    setPx(tX + 2, tY, PAL.u);
    setPx(tX + 1, tY + 1, PAL.u);
    setPx(tX, tY + 2, PAL.u);
    for (let i = -2; i <= 1; i++) setPx(tX, tY + i, PAL.w);
  } else if (tool === 'staff' || tool === 'rune_staff') {
    // 도트 마력 지팡이
    for (let i = -2; i <= 4; i++) setPx(tX, tY + i, PAL.n);
    fillRectPx(tX - 1, tY - 4, 3, 2, PAL.P);
    setPx(tX, tY - 4, PAL.Y);
  } else if (tool === 'dagger') {
    // 도트 단검
    setPx(tX, tY + 1, PAL.y);
    setPx(tX + 1, tY, PAL.I);
    setPx(tX + 2, tY - 1, PAL.I);
    setPx(tX + 3, tY - 2, PAL.O);
  } else if (tool === 'hammer' || tool === 'tongs') {
    // 도트 대장장이 망치
    for (let i = -1; i <= 3; i++) setPx(tX, tY + i, PAL.n);
    fillRectPx(tX - 1, tY - 3, 4, 2, PAL.i);
    setPx(tX - 1, tY - 3, PAL.I);
    setPx(tX + 2, tY - 2, PAL.O);
  } else if (tool === 'ladle') {
    // 도트 요리사 국자
    for (let i = -1; i <= 2; i++) setPx(tX, tY + i, PAL.u);
    fillRectPx(tX, tY - 3, 3, 2, PAL.i);
    setPx(tX + 1, tY - 3, PAL.f);
  } else if (tool === 'flask') {
    // 도트 연금술 플라스크
    setPx(tX + 1, tY - 2, PAL.B);
    fillRectPx(tX, tY - 1, 3, 3, PAL.P);
    setPx(tX + 1, tY, PAL.w);
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}


function bakeIsoLowRail(side: 'left' | 'right'): HTMLCanvasElement {
  const W = 12;
  const H = 14;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const setPx = (x: number, y: number, hex: string) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const [r, g, b, a] = hexToRgba(hex);
    const i = (y * W + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
  };
  const railH = 6;
  for (let x = 0; x < W; x++) {
    const slopeY = side === 'right' ? Math.floor(x / 2) : Math.floor((W - 1 - x) / 2);
    for (let ry = 0; ry <= railH; ry++) {
      let col = side === 'left' ? PAL.u : PAL.n;
      if (ry === 0 || ry === railH || x === 0 || x === W - 1) col = PAL.O;
      else if (ry === 1) col = PAL.W;
      else if (ry >= railH - 1) col = PAL.m;
      setPx(x, slopeY + ry, col);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function buildPillarSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    '...OOOOOO...',
    '..OWuuuuWO..',
    '..OWWuuWWO..',
    '..OWuuuuWO..',
    '..OnuuuunO..',
    '..OWuuuuWO..',
    '..OWWuuWWO..',
    '..OWuuuuWO..',
    '..OnuuuunO..',
    '..OWuuuuWO..',
    '..OWWuuWWO..',
    '.OOWuuuuWOO.',
    '.OmmWWWummO.',
    '.OmmmmmmmmO.',
    '..OOOOOOOO..',
  ]);
}

function buildChairSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    '..OOOO....',
    '.OWuuWO...',
    '.OWuuWO...',
    '.OnuunOOOO',
    '.OWuuWWWuO',
    '.OWuuuuuuO',
    '.OnnunnunO',
    '.OmO..OmO.',
    '.OmO..OmO.',
    '.OOO..OOO.',
  ]);
}

function buildBarrelSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    '...OOOOOO...',
    '..OWuuuuWO..',
    '.OOOOOOOOOO.',
    '.OWuuuuuuuO.',
    '.OWuuYuuuuO.',
    '.OOOOOOOOOO.',
    '.OnuuuuuunO.',
    '.OnuuuuuunO.',
    '.OOOOOOOOOO.',
    '..OmmmmmmO..',
    '...OOOOOO...',
  ]);
}

function buildPlantPotSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    '....G..v.G..',
    '...GvGGvGv..',
    '..GvvhvvvG..',
    '..vGhHGhvG..',
    '...vhhhv....',
    '....OhO.....',
    '...ORrRRO...',
    '...OrccrO...',
    '...OccccO...',
    '....OOOO....',
  ]);
}

function buildCandleFrames(): HTMLCanvasElement[] {
  return [0, 1, 2].map((f) =>
    bakeGridSprite([
      f === 1 ? '...F...' : '..F.f..',
      f === 2 ? '..fYf..' : '...Y...',
      '...w...',
      '..OwwO.',
      '..OwwO.',
      '..OggO.',
      '...OO..',
    ])
  );
}

function buildStairsSprite(): HTMLCanvasElement {
  // 또렷한 아이소 계단: 밝은 디딤판, 어두운 챌판, 왼쪽 난간, 그림자
  return bakeGridSprite([
    'OO............................',
    'OmWOOO........................',
    'OmWWWuWOOO....................',
    'OImnnnnWuWOOO.................',
    'OImWWWWWWuuuWOOO..............',
    'OIImnnnnnnnnnWuWOOO...........',
    'OIImWWWWWWWWWuuuuuWOOO........',
    'OIIImnnnnnnnnnnnnnnWuWOOO.....',
    'OIIImWWWWWWWWWWWWWuuuuuWOO....',
    'OIIIImnnnnnnnnnnnnnnnnnnnWO...',
    'OIIIImWuWWWWWWWWWWWWWuuuuWO...',
    'OIIIIImnnnnnnnnnnnnnnnnnnO....',
    'OIIIIImWWWWWWWWWWWWWWWWWO.....',
    '.OIIIIOnnnnnnnnnnnnnnnnO......',
    '.OIIIIIOOOOOOOOOOOOOOOO.......',
    '..OIIIIO......................',
    '...OIIIO......................',
    '....OOOO......................',
  ]);
}

function buildDoormatSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    '......OOOOOOOOOOOO......',
    '....OOnnnnnnnnnnnnOO....',
    '...OnnWWWuuWWWuuWWnnO...',
    '..OnnuuunnnuuunnnnuunO..',
    '..OnnWWWnnnYYYnnnWWWnO..',
    '..OnnuuunnnuuunnnnuunO..',
    '..OnnWWWuuWWWuuWWWnnO...',
    '...OOnnnnnnnnnnnnnnOO...',
    '.....OOOOOOOOOOOOOO.....',
  ]);
}

function buildHerbRackSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    '.OOOOOOOOOOOOOO.',
    '.OnuuuuuuuuuunO.',
    '.OOOOOOOOOOOOOO.',
    '..v.G.v.h.G.v..',
    '..GvG.hGv.hGv..',
    '..hvh.Gvh.vGh..',
    '...h...h...h...',
    '...H...v...H...',
  ]);
}

function buildChimneyHoodSprite(): HTMLCanvasElement {
  // 용광로 위를 덮는 넓은 철제 후드 + 짧은 연통 소켓
  return bakeGridSprite([
    '.........OOOOOO.........',
    '........OJiiiiJO........',
    '.......OJijjjjiJO.......',
    '......OOOOOOOOOOOO......',
    '....OOJJjjjjjjjjJJOO....',
    '...OJiiiiiiiiiiiiiJO...',
    '..OJijjjjjjjjjjjjjiJO..',
    '.OJjjjjjjjjjjjjjjjjjJO.',
    '.OOOOOOOOOOOOOOOOOOOOOO.',
    '.OJjjjJO........OJjjjJO.',
    '..OOOO............OOOO..',
  ]);
}

function buildChimneyFlueSprite(): HTMLCanvasElement {
  // 뒷벽을 타고 올라가는 굴뚝 연통
  return bakeGridSprite([
    '...OJJJO...',
    '...OJiJO...',
    '...OJjJO...',
    '...OJiJO...',
    '..OOJjJOO..',
    '..OJiiiiO..',
    '..OJjjjjO..',
    '..OJiiiiO..',
    '..OJjjjjO..',
    '..OJiiiiO..',
    '..OJjjjjO..',
    '..OJiiiiO..',
    '..OJjjjjO..',
    '..OOOOOOO..',
  ]);
}

function buildChimneySmokeFrames(): HTMLCanvasElement[] {
  const frames = [
    [
      '....gg.......',
      '...gwwg......',
      '....gw.g.....',
      '..g..g.......',
      '.gwwg........',
      '..gg.........',
      '...g.........',
    ],
    [
      '..g...g......',
      '.gwwg........',
      '...gwwg......',
      '....gg.g.....',
      '...g.........',
      '..gww........',
      '...g.........',
    ],
    [
      '.....gwwg....',
      '....g..g.....',
      '..gwwg.......',
      '.g..g........',
      '..gg..g......',
      '....g........',
      '.............',
    ],
    [
      '...g..gg.....',
      '..gwwg.......',
      '....gwwg.....',
      '.g...g.......',
      '..gww........',
      '...g.........',
      '.............',
    ],
  ];
  return frames.map((rows) => bakeGridSprite(rows));
}

function buildBarCounterSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    '................OOOO........',
    '..............OOYyyYOO......',
    '...........OOOWuuuuuWOOO....',
    '........OOOWWWWWWWWWWWWWOO..',
    '......OOWWuuuuuuuuuuuuuuWWO.',
    '.....OWWuuOwwOuuOYyOuuOfrOW.',
    '....OWuuuuOggOuuOkkOuuOrruO.',
    '....OWuuuuuuuuuuuuuuuuuuuuO.',
    '.....OWWnnnnnnnnnnnnnnnnWWO.',
    '......OOmmmmmmmmmmmmmmmmOO..',
    '......OmO..OOOOOOOO..OmO....',
    '......OmO..OmmOOmmO..OmO....',
    '......OOO..OOOOOOOO..OOO....',
  ]);
}

function buildEntranceDoorSprite(): HTMLCanvasElement {
  // 현관 문: 간판+브래킷, 굵은 문틀, 두 짝 패널, 황동 손잡이, 돌 문턱
  return bakeGridSprite([
    '................OOOO..............',
    '...............OnnnO..............',
    '.......OOOOOOOOnuuuOOOOOO.........',
    '.......ORRRRRROnYYYOnnnO..........',
    '.......ORyyyyROnYYYOnuuO..........',
    '.......ORyYkyROOOOOOnnnO..........',
    '.......ORyyyyR....................',
    '.......ORRRRRO.........OOOOOOOOOOO',
    '.......OOOOOOO........OnuuuuuuuunO',
    '......................OnuWWWWWWuO',
    '..............OOOOOOOOOnuWuWWWWuO',
    '.............OnuuuuuuuunuWuOOOWuO',
    '.............OnuWWWWWWWunuWuOnnWuO',
    '.............OnuWuOOOWunuWuOnYnWuO',
    '.............OnuWuOnnWunuWuOnnnWuO',
    '.............OnuWuOOOWunuWuOOOWuO',
    '.............OnuWuuuuWunuWuuuuuWuO',
    '.............OnuWuOOOWunuWuOOOWuO',
    '.............OnuWuOnnWunuWuOnnWuO',
    '.............OnuWuOnnWunuWuOnYyWuO',
    '.............OnuWuOOOWunuWuOOOWuO',
    '.............OnuWWWWWWWunuWWWWWWuO',
    '.............OnuuuuuuuuunuuuuuuuunO',
    '..............OOOOOOOOOOOOOOOOOOOO',
    '..............OnnnnnnnnnnnnnnnnnO',
    '...............OmmmmmmmmmmmmmmmO.',
    '................OOOOOOOOOOOOOOOO.',
  ]);
}

function buildEntranceLampFrames(): HTMLCanvasElement[] {
  const glow0 = [
    '....YF....',
    '...OYyO...',
    '..OYfFyO..',
    '..OYffyO..',
    '...OkKO...',
    '....OO....',
    '....nO....',
    '....nO....',
  ]
  const glow1 = [
    '...FYF....',
    '..OYYyO...',
    '.OYfFFyO..',
    '.OYfffyO..',
    '..OYkKO...',
    '...OOO....',
    '....nO....',
    '....nO....',
  ]
  return [bakeGridSprite(glow0), bakeGridSprite(glow1)]
}

// ============================================================================
// 마이크로 픽셀 비트맵 숫자/문자 렌더러 (간판 레벨 L1..L9 등 캔버스 내 픽셀 전용)
// ============================================================================

const TINY_FONT_3X5: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '001', '001'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  L: ['100', '100', '100', '100', '111'],
  '+': ['000', '010', '111', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
  G: ['111', '100', '101', '101', '111'],
  x: ['101', '010', '101', '010', '101'],
};

export function drawTinyPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color = '#f2d675',
  shadowColor = '#271c19'
): void {
  let curX = Math.round(x);
  const baseY = Math.round(y);

  for (const ch of text) {
    const glyph = TINY_FONT_3X5[ch];
    if (!glyph) {
      curX += 3;
      continue;
    }
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        if (glyph[gy][gx] === '1') {
          if (shadowColor) {
            ctx.fillStyle = shadowColor;
            ctx.fillRect(curX + gx + 1, baseY + gy + 1, 1, 1);
          }
          ctx.fillStyle = color;
          ctx.fillRect(curX + gx, baseY + gy, 1, 1);
        }
      }
    }
    curX += 4;
  }
}

// ============================================================================
// 전체 프리베이크 스프라이트 아틀라스 번들
// ============================================================================

export interface PixelSpriteAtlas {
  tiles: {
    innLight: HTMLCanvasElement;
    innDark: HTMLCanvasElement;
    innWornLight: HTMLCanvasElement;
    innWornDark: HTMLCanvasElement;
    innCarpetLight: HTMLCanvasElement;
    innCarpetDark: HTMLCanvasElement;
    bsLight: HTMLCanvasElement;
    bsDark: HTMLCanvasElement;
    potLight: HTMLCanvasElement;
    potDark: HTMLCanvasElement;
    tradeLight: HTMLCanvasElement;
    tradeDark: HTMLCanvasElement;
    corridorLight: HTMLCanvasElement;
    corridorDark: HTMLCanvasElement;
    lavaFrames: HTMLCanvasElement[];
  };
  innWalls: {
    leftPlain: HTMLCanvasElement;
    rightPlain: HTMLCanvasElement;
    leftWindow: HTMLCanvasElement;
    rightWindow: HTMLCanvasElement;
    leftShelf: HTMLCanvasElement;
    rightShelf: HTMLCanvasElement;
    leftBanner: HTMLCanvasElement;
    rightBanner: HTMLCanvasElement;
    rightDungeon: HTMLCanvasElement;
    rightDungeonActive: HTMLCanvasElement;
    lowRailLeft: HTMLCanvasElement;
    lowRailRight: HTMLCanvasElement;
  };
  props: {
    innHearth: HTMLCanvasElement[];
    innTable: HTMLCanvasElement;
    treasureChest: HTMLCanvasElement;
    slotCabinet: HTMLCanvasElement[];
    bsFurnace: HTMLCanvasElement[];
    bsAnvil: HTMLCanvasElement;
    bsWeaponRack: HTMLCanvasElement;
    bsRuneAltar: HTMLCanvasElement[];
    potCauldron: HTMLCanvasElement[];
    potShelf: HTMLCanvasElement;
    potCrystal: HTMLCanvasElement;
    tradeCounter: HTMLCanvasElement;
    tradeCrates: HTMLCanvasElement;
    tradeMushroom: HTMLCanvasElement;
    wallTorch: HTMLCanvasElement[];
    roomSigns: Record<FacilityId, HTMLCanvasElement>;
    dungeonArchIdle: HTMLCanvasElement[];
    dungeonArchActive: HTMLCanvasElement[];
    pillar: HTMLCanvasElement;
    chair: HTMLCanvasElement;
    barrel: HTMLCanvasElement;
    plant: HTMLCanvasElement;
    candleFrames: HTMLCanvasElement[];
    stairs: HTMLCanvasElement;
    doormat: HTMLCanvasElement;
    herbRack: HTMLCanvasElement;
    chimneyHood: HTMLCanvasElement;
    chimneyFlue: HTMLCanvasElement;
    chimneySmoke: HTMLCanvasElement[];
    barCounter: HTMLCanvasElement;
    entranceDoor: HTMLCanvasElement;
    entranceLamp: HTMLCanvasElement[];
    barStool: HTMLCanvasElement;
    chairAngle: HTMLCanvasElement;
    sack: HTMLCanvasElement;
    scales: HTMLCanvasElement;
    noticeBoard: HTMLCanvasElement;
    hangingHerbs: HTMLCanvasElement;
    ceilingBeam: HTMLCanvasElement;
    balconyRail: HTMLCanvasElement;
    mugPlate: HTMLCanvasElement;
    anvilStump: HTMLCanvasElement;
    fireplaceMantle: HTMLCanvasElement;
  };
  getCharacterSprite: (
    archetype: ActorArchetypeId,
    state: ActorAnimState,
    facing: ActorFacing,
    frameIdx: number,
    weapon?: WeaponTypeId
  ) => HTMLCanvasElement;
}


function buildBarStoolSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    '..OOOO..',
    '.OWuuWO.',
    '.OnuunO.',
    '.OWuuWO.',
    '..OmO...',
    '..OmO...',
    '.OmOOmO.',
    '.OO..OO.',
  ]);
}

function buildChairAngleSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    '....OOOO.',
    '...OWuuWO',
    '..OWuuuWO',
    '.OnuuuunO',
    '.OWuuuuWO',
    '..OnnnnO.',
    '..OmOOmO.',
    '..OO..OO.',
  ]);
}

function buildSackSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    '...OOOO...',
    '..OWuuuO..',
    '.OWuuuuuO.',
    '.OWuuYuuO.',
    '.OnuuuuunO',
    '.OnnnnnnO.',
    '..OOOOOO..',
  ]);
}

function buildScalesSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    '....Y.....',
    '...OYOyyyy',
    '..OYOYOkkk',
    'OOOYOYOOOO',
    'OwO.O..OwO',
    'OOO....OOO',
    '.O......O.',
  ]);
}

function buildNoticeBoardSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    '.OOOOOOOOOO.',
    '.OnuuuuuuunO',
    '.OuYYuuRRuO.',
    '.OuYYuuRRuO.',
    '.OuuuWWuuuO.',
    '.OuuuWWuuuO.',
    '.OnnnnnnnnO.',
    '.OOOOOOOOOO.',
    '...OmOOmO...',
  ]);
}

function buildHangingHerbsSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    'OOOOOOOOOOOO',
    'OnuuuuuuuunO',
    'OOOOOOOOOOOO',
    '.v.G.v.h.P.',
    '.GvG.hGv.a.',
    '.hvh.Gvh.q.',
    '..h...h..Q.',
    '..H...v..h.',
  ]);
}

function buildCeilingBeamSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    'OOOOOOOOOOOOOOOOOOOOOOOO',
    'OnuuWWWuuunnnWWWuuuunnnO',
    'OmmmmmmmmmmmmmmmmmmmmmmO',
    'OOOOOOOOOOOOOOOOOOOOOOOO',
  ]);
}

function buildBalconyRailSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    'OOOOOOOOOOOOOOOOOOOO',
    'OWWuuWWWuuWWWuuWWWuO',
    'OmO..OmO..OmO..OmO.',
    'OmO..OmO..OmO..OmO.',
    'OWWWWWWWWWWWWWWWWWWO',
    'OnnnnnnnnnnnnnnnnnnO',
    'OOOOOOOOOOOOOOOOOOOO',
  ]);
}

function buildMugPlateSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    '..wO.....',
    '.OwOw.OO.',
    '.OwwOOggO',
    '..OOOgggO',
    '.....OOO.',
  ]);
}

function buildAnvilStumpSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    '..OOOOOOOO..',
    '.OJiiiiiiJO.',
    '.OJjjjjjjJO.',
    '..OJiiiiJO..',
    '...OOOOOO...',
    '...OWuuuO...',
    '...OnuunO...',
    '...OWuuuO...',
    '...OnnnnO...',
    '....OOOO....',
  ]);
}

function buildFireplaceMantleSprite(): HTMLCanvasElement {
  return bakeGridSprite([
    '.OOOOOOOOOOOOOOO.',
    '.OWuuuuuuuuuuuuO.',
    '.OnnnnnnnnnnnnnO.',
    '.OOOOOOOOOOOOOOO.',
    '..OmO.......OmO..',
    '..OmO.......OmO..',
  ]);
}

export function createPixelSpriteAtlas(): PixelSpriteAtlas {
  const charCache = new Map<string, HTMLCanvasElement>();

  return {
    tiles: {
      innLight: bakeIsoTileSprite({
        topHighlight: '#e3b578',
        topMain: '#c9975b',
        topAlt: '#ba884c',
        topShadow: '#996a35',
        leftSlab: '#784e23',
        rightSlab: '#593716',
        outline: '#271c19',
        pattern: 'wood',
      }),
      innDark: bakeIsoTileSprite({
        topHighlight: '#d1a266',
        topMain: '#b8864c',
        topAlt: '#a6763e',
        topShadow: '#875b29',
        leftSlab: '#6e461f',
        rightSlab: '#523214',
        outline: '#271c19',
        pattern: 'wood',
      }),
      innWornLight: bakeIsoTileSprite({
        topHighlight: '#a6763e',
        topMain: '#875b29',
        topAlt: '#6e461f',
        topShadow: '#523214',
        leftSlab: '#3d2518',
        rightSlab: '#2a1a10',
        outline: '#271c19',
        pattern: 'woodWorn',
      }),
      innWornDark: bakeIsoTileSprite({
        topHighlight: '#966a35',
        topMain: '#754d28',
        topAlt: '#5c3a20',
        topShadow: '#3d2518',
        leftSlab: '#322014',
        rightSlab: '#24180e',
        outline: '#271c19',
        pattern: 'woodWorn',
      }),
      innCarpetLight: bakeIsoTileSprite({
        topHighlight: '#c95b58',
        topMain: '#a63e3c',
        topAlt: '#943432',
        topShadow: '#732423',
        leftSlab: '#6e461f',
        rightSlab: '#523214',
        outline: '#271c19',
        pattern: 'carpet',
      }),
      innCarpetDark: bakeIsoTileSprite({
        topHighlight: '#b84f4c',
        topMain: '#963533',
        topAlt: '#852c2b',
        topShadow: '#661e1d',
        leftSlab: '#6e461f',
        rightSlab: '#523214',
        outline: '#271c19',
        pattern: 'carpet',
      }),
      bsLight: bakeIsoTileSprite({
        topHighlight: '#b58465',
        topMain: '#96684b',
        topAlt: '#855a3f',
        topShadow: '#69442e',
        leftSlab: '#543523',
        rightSlab: '#3d2518',
        outline: '#271c19',
        pattern: 'forge',
      }),
      bsDark: bakeIsoTileSprite({
        topHighlight: '#a37456',
        topMain: '#875b40',
        topAlt: '#754d35',
        topShadow: '#5c3a26',
        leftSlab: '#4a2e1e',
        rightSlab: '#362014',
        outline: '#271c19',
        pattern: 'forge',
      }),
      // 포션방: 형광 시안(#67e8f9) 대신 차분한 슬레이트 블루/스톤 톤
      potLight: bakeIsoTileSprite({
        topHighlight: '#88a6b0',
        topMain: '#6b8994',
        topAlt: '#5e7a85',
        topShadow: '#486069',
        leftSlab: '#3a4e57',
        rightSlab: '#2a3940',
        outline: '#271c19',
        pattern: 'potion',
      }),
      potDark: bakeIsoTileSprite({
        topHighlight: '#7a98a3',
        topMain: '#5f7c87',
        topAlt: '#536e78',
        topShadow: '#3f565e',
        leftSlab: '#33454d',
        rightSlab: '#243238',
        outline: '#271c19',
        pattern: 'potion',
      }),
      // 교역소: 형광 초록(#86efac) 대신 차분한 이끼 & 따뜻한 세이지 스톤 톤
      tradeLight: bakeIsoTileSprite({
        topHighlight: '#9bb07d',
        topMain: '#7d9460',
        topAlt: '#6f8553',
        topShadow: '#56693e',
        leftSlab: '#455431',
        rightSlab: '#323d23',
        outline: '#271c19',
        pattern: 'trade',
      }),
      tradeDark: bakeIsoTileSprite({
        topHighlight: '#8da170',
        topMain: '#708554',
        topAlt: '#637848',
        topShadow: '#4b5c35',
        leftSlab: '#3c4a2b',
        rightSlab: '#2b361e',
        outline: '#271c19',
        pattern: 'trade',
      }),
      corridorLight: bakeIsoTileSprite({
        topHighlight: '#8a719e',
        topMain: '#6d577e',
        topAlt: '#5e4a6e',
        topShadow: '#473656',
        leftSlab: '#3a2c47',
        rightSlab: '#2a2034',
        outline: '#271c19',
        pattern: 'corridor',
      }),
      corridorDark: bakeIsoTileSprite({
        topHighlight: '#7a638c',
        topMain: '#5f4b6e',
        topAlt: '#53425f',
        topShadow: '#3d3148',
        leftSlab: '#32283c',
        rightSlab: '#241c2c',
        outline: '#271c19',
        pattern: 'corridor',
      }),
      lavaFrames: [0, 1, 2].map((f) =>
        bakeIsoTileSprite(
          {
            topHighlight: '#e89b48',
            topMain: '#c96b2c',
            topAlt: '#a3491d',
            topShadow: '#6e2c14',
            leftSlab: '#4f2010',
            rightSlab: '#38160b',
            outline: '#271c19',
            pattern: 'lava',
          },
          f
        )
      ),
    },
    innWalls: {
      leftPlain: bakeIsoWallSegment('left', '#d6b07a', '#c49a62', '#9e7540', '#e8c468', '#6e451f'),
      rightPlain: bakeIsoWallSegment('right', '#d6b07a', '#c49a62', '#9e7540', '#e8c468', '#6e451f'),
      leftWindow: bakeIsoWallSegment('left', '#d6b07a', '#c49a62', '#9e7540', '#e8c468', '#6e451f', 'window'),
      rightWindow: bakeIsoWallSegment('right', '#d6b07a', '#c49a62', '#9e7540', '#e8c468', '#6e451f', 'window'),
      leftShelf: bakeIsoWallSegment('left', '#d6b07a', '#c49a62', '#9e7540', '#e8c468', '#6e451f', 'shelf'),
      rightShelf: bakeIsoWallSegment('right', '#d6b07a', '#c49a62', '#9e7540', '#e8c468', '#6e451f', 'shelf'),
      leftBanner: bakeIsoWallSegment('left', '#d6b07a', '#c49a62', '#9e7540', '#e8c468', '#6e451f', 'banner'),
      rightBanner: bakeIsoWallSegment('right', '#d6b07a', '#c49a62', '#9e7540', '#e8c468', '#6e451f', 'banner'),
      rightDungeon: bakeIsoWallSegment('right', '#d6b07a', '#c49a62', '#9e7540', '#e8c468', '#6e451f', 'dungeon'),
      rightDungeonActive: bakeIsoWallSegment('right', '#d6b07a', '#c49a62', '#9e7540', '#e8c468', '#6e451f', 'dungeonActive'),
      lowRailLeft: bakeIsoLowRail('left'),
      lowRailRight: bakeIsoLowRail('right'),
    },
    props: {
      innHearth: buildInnHearthFrames(),
      innTable: buildInnTableSprite(),
      treasureChest: buildTreasureChestSprite(),
      slotCabinet: buildSlotCabinetFrames(),
      bsFurnace: buildBlacksmithFurnaceFrames(),
      bsAnvil: buildBlacksmithAnvilSprite(),
      bsWeaponRack: buildBlacksmithWeaponRackSprite(),
      bsRuneAltar: buildBlacksmithRuneAltarFrames(),
      potCauldron: buildPotionCauldronFrames(),
      potShelf: buildPotionShelfSprite(),
      potCrystal: buildPotionCrystalPlanterSprite(),
      tradeCounter: buildTradeCounterSprite(),
      tradeCrates: buildTradeCratesSprite(),
      tradeMushroom: buildTradeMushroomSprite(),
      wallTorch: buildWallTorchFrames(),
      roomSigns: {
        inn: buildRoomSignboardSprite('inn'),
        blacksmith: buildRoomSignboardSprite('blacksmith'),
        potion: buildRoomSignboardSprite('potion'),
        trade: buildRoomSignboardSprite('trade'),
      },
      dungeonArchIdle: buildDungeonArchFrames(false),
      dungeonArchActive: buildDungeonArchFrames(true),
      pillar: buildPillarSprite(),
      chair: buildChairSprite(),
      barrel: buildBarrelSprite(),
      plant: buildPlantPotSprite(),
      candleFrames: buildCandleFrames(),
      stairs: buildStairsSprite(),
      doormat: buildDoormatSprite(),
      herbRack: buildHerbRackSprite(),
      chimneyHood: buildChimneyHoodSprite(),
      chimneyFlue: buildChimneyFlueSprite(),
      chimneySmoke: buildChimneySmokeFrames(),
      barCounter: buildBarCounterSprite(),
      entranceDoor: buildEntranceDoorSprite(),
      entranceLamp: buildEntranceLampFrames(),
      barStool: buildBarStoolSprite(),
      chairAngle: buildChairAngleSprite(),
      sack: buildSackSprite(),
      scales: buildScalesSprite(),
      noticeBoard: buildNoticeBoardSprite(),
      hangingHerbs: buildHangingHerbsSprite(),
      ceilingBeam: buildCeilingBeamSprite(),
      balconyRail: buildBalconyRailSprite(),
      mugPlate: buildMugPlateSprite(),
      anvilStump: buildAnvilStumpSprite(),
      fireplaceMantle: buildFireplaceMantleSprite(),
    },
    getCharacterSprite(archetype, state, facing, frameIdx, weapon) {
      const f = frameIdx & 3;
      const key = `${archetype}_${state}_${facing}_${f}_${weapon || ''}`;
      let spr = charCache.get(key);
      if (!spr) {
        spr = bakeChibiCharacterFrame(archetype, state, facing, f, weapon);
        charCache.set(key, spr);
      }
      return spr;
    },
  };
}
