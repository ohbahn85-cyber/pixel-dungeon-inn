export type FacingDir = 'front' | 'back' | 'left' | 'right';
export type AnimState = 'idle' | 'walk' | 'work';

/**
 * Graveyard Keeper & 카이로소프트 감성의 따뜻한 Hue-Shifted 도트 팔레트
 */
export const PIXEL_PALETTE: Record<string, string> = {
  '.': '', // 투명
  K: '#241715', // 따뜻한 다크 에스프레소 외곽선
  // 피부 (3톤)
  s: '#ffe3c6', // 피부 하이라이트
  S: '#f3be90', // 피부 기본
  p: '#ce8c5e', // 피부 그림자
  c: '#ec7474', // 귀여운 볼터치
  // 눈
  E: '#1a110e', // 눈동자
  W: '#ffffff', // 눈 안광 하이라이트
  // 머리카락 & 드워프 수염 (4톤 구리빛 오렌지)
  h: '#fba14d', // 머리/수염 밝은톤
  H: '#e5651a', // 머리/수염 기본톤
  r: '#b43e0f', // 머리/수염 중간음영
  R: '#7c280a', // 머리/수염 깊은음영
  // 대장장이 이마 밴드 & 황금 장식
  b: '#6b6560', // 철제/가죽 밴드 밝음
  B: '#443e3a', // 철제/가죽 밴드 어두움
  g: '#fef08a', // 황금 하이라이트
  G: '#f59e0b', // 황금 기본
  d: '#b45309', // 황금 어두움
  // 상의 튜닉 (붉은 갈색)
  t: '#a8552a', // 튜닉 밝음
  T: '#7c3919', // 튜닉 기본
  u: '#52230e', // 튜닉 그림자
  // 가죽 앞치마
  a: '#d97b29', // 앞치마 하이라이트
  A: '#b45a14', // 앞치마 기본
  q: '#7d3a0a', // 앞치마 그림자
  // 허리 벨트 & 바지 & 가죽 부츠
  L: '#362016', // 가죽 벨트
  n: '#4b5a6e', // 바지
  N: '#2f3a4a', // 바지 그림자
  f: '#63371b', // 부츠 기본
  F: '#3d1f0e', // 부츠 그림자
  // 단조 망치 (나무 자루 + 강철 헤드)
  m: '#9c5a27', // 망치 자루
  i: '#eef4fa', // 강철 하이라이트
  I: '#9fb0c4', // 강철 기본
  j: '#5a6b80', // 강철 그림자
};

// 24x28 정면(FRONT) 기본 스프라이트 (Idle Frame 0)
const FRONT_BASE: string[] = [
  '........................',
  '........................',
  '........KKKKKKKK........',
  '......KKhhHHHHrrKK......',
  '.....KhhHHHHHHHHrrK.....',
  '....KKbbbbGggGbbbbKK....',
  '....KBBBBBGggGBBBBBK....',
  '....KrrHHHHHHHHHHrrK....',
  '...KKSssssssssssssSKK...',
  '...KSssrrrrssrrrrssSK...',
  '...KKSsWESSssSSWESSKK...',
  '....KSSESSppppSSESSK....',
  '....KScSSSpSSpSSScSK....',
  '....KKhhHhhhhhhHhhKK....',
  '....KhHHhHHHHHHhHHhK....',
  '....KrrHHHHHHHHHHrrK....',
  '...KKtKrrHHHHHHrrKtKK...',
  '..KttTKRRrrHHrrRRKTttK..',
  '..KtTTKaaaRRRRaaaKTTtK..',
  '..KTTuKAaaAAAAaaAKuTTK..',
  '..KSSKLLLLGggGLLLLKSSK..',
  '..KppKAAaaAAAAaaAAKppK..',
  '...KK.KqqAAAAAAqqK.KK...',
  '......KKnnnnnnnnKK......',
  '......KnnKK..KKnnK......',
  '......KffK....KffK......',
  '.....KFFfK....KfFFK.....',
  '.....KKKK......KKKK.....',
];

// 정면 망치 오버레이 (오른손에 쥔 드워프 단조 망치)
const FRONT_HAMMER_IDLE: { dx: number; dy: number; grid: string[] } = {
  dx: 17,
  dy: 12,
  grid: [
    '.KKKKK.',
    'KiiiiIK',
    'KIIIjjK',
    '.KKmKK.',
    '...mK..',
    '..KmK..',
    '..KmK..',
    '..KmK..',
    '..KmK..',
    '..KK...',
  ],
};

// 24x28 후면(BACK) 기본 스프라이트
const BACK_BASE: string[] = [
  '........................',
  '........................',
  '........KKKKKKKK........',
  '......KKhhHHHHrrKK......',
  '.....KhhHHHHHHHHrrK.....',
  '....KKbbbbbbbbbbbbKK....',
  '....KBBBBBGGGGbbBBBK....',
  '....KrrHHHGGGGHHHrrK....',
  '...KKrHHHHHHHHHHHHrKK...',
  '...KrrHHHHHHHHHHHHrrK...',
  '...KKrHHHHHHHHHHHHrKK...',
  '....KrHHHHHrrHHHHHrK....',
  '....KrrHHHrrrrHHHrrK....',
  '....KKrrHHHHHHHHrrKK....',
  '.....KKrrHHHHHHrrKK.....',
  '......KKrrrrrrrrKK......',
  '...KKtTTtKKKKKKtTTtKK...',
  '..KttTAAtTTTTTTtAAttTK..',
  '..KtTTtAAtTTTTtAAtTTtK..',
  '..KTTuTTAAtTTtAATTuTTK..',
  '..KSSKLLLLLLLLLLLLKSSK..',
  '..KppKuuTTTTTTTTuuKppK..',
  '...KK.KuuTTTTTTuuK.KK...',
  '......KKnnnnnnnnKK......',
  '......KnnKK..KKnnK......',
  '......KffK....KffK......',
  '.....KFFfK....KfFFK.....',
  '.....KKKK......KKKK.....',
];

// 24x28 좌측면(LEFT - 왼쪽을 바라봄) 기본 스프라이트
const LEFT_BASE: string[] = [
  '........................',
  '........................',
  '........KKKKKKKK........',
  '......KKhhHHHHrrKK......',
  '.....KhhHHHHHHHHrrK.....',
  '....KKGggbbbbbbbbbKK....',
  '....KGGggBBBBBBBBBBK....',
  '....KHHrrHHHHHHHHrrK....',
  '....KSssssHHrrrrHHrK....',
  '....KssrrrHHHHrrHHrK....',
  '....KSWESSSHHHrrHHrK....',
  '...KSSESSSSHHHpSrrKK....',
  '..KSScSSSSSSHHpSKrK.....',
  '...KhhHhhHHHHHHrrK......',
  '..KhhHHHHhHHHHHrrK......',
  '..KrrHHHHHHHHHrrK.......',
  '...KrrHHHHHHHrrKK.......',
  '....KRRrrHHHrtTTtK......',
  '....KaaRRRRtTTttTK......',
  '....KAAaaaaTttTTuK......',
  '....KLLLLLLtSSSuLK......',
  '....KAAaaAAKppKuAK......',
  '.....KqqAAqKKKKqqK......',
  '......KKnnnnnnnKK.......',
  '.......KnnKKnnK.........',
  '......KffK..KffK........',
  '.....KFFfK..KFFfK.......',
  '.....KKKK...KKKK........',
];

const LEFT_HAMMER_IDLE: { dx: number; dy: number; grid: string[] } = {
  dx: 2,
  dy: 12,
  grid: [
    'KKKKK..',
    'KiiiiK.',
    'KIIIjK.',
    '.KKmKK.',
    '..KmK..',
    '..KmK..',
    '..KmK..',
    '..KmK..',
    '..KmK..',
    '..KK...',
  ],
};

function cloneGrid(g: string[]): string[][] {
  return g.map((row) => row.split(''));
}

function overlayGrid(
  base: string[][],
  overlay: string[],
  dx: number,
  dy: number
): void {
  const h = base.length;
  const w = base[0].length;
  for (let r = 0; r < overlay.length; r++) {
    for (let c = 0; c < overlay[r].length; c++) {
      const ch = overlay[r][c];
      if (ch === '.') continue;
      const ty = dy + r;
      const tx = dx + c;
      if (ty >= 0 && ty < h && tx >= 0 && tx < w) {
        base[ty][tx] = ch;
      }
    }
  }
}

function flipHorizontal(grid: string[][]): string[][] {
  return grid.map((row) => [...row].reverse());
}

function shiftRowsDown(grid: string[][], startRow: number, endRow: number, shiftY: number): string[][] {
  const out = grid.map((r) => [...r]);
  if (shiftY === 0) return out;
  for (let r = endRow; r >= startRow; r--) {
    const srcR = r - shiftY;
    if (srcR >= startRow && srcR <= endRow) {
      out[r] = [...grid[srcR]];
    } else {
      out[r] = Array(grid[0].length).fill('.');
    }
  }
  return out;
}

/**
 * 프레임 인덱스(0..3)와 방향(front/back/left/right), 행동(idle/walk/work)에 맞는
 * 24x28 정교한 도트 그리드를 조립해 반환합니다.
 */
export function getBlacksmithPixelFrame(
  dir: FacingDir,
  state: AnimState,
  frameIdx: number
): { grid: string[][]; spark?: { x: number; y: number } } {
  const isRight = dir === 'right';
  const baseDir: 'front' | 'back' | 'left' = isRight ? 'left' : dir;

  let grid =
    baseDir === 'front'
      ? cloneGrid(FRONT_BASE)
      : baseDir === 'back'
      ? cloneGrid(BACK_BASE)
      : cloneGrid(LEFT_BASE);

  let spark: { x: number; y: number } | undefined;

  // 1. 숨쉬기 / 걷기 / 망치질 프레임별 상체 바운스 및 발 교차 픽셀 변형
  if (state === 'idle') {
    const breathDown = frameIdx % 2 === 1 ? 1 : 0;
    if (breathDown) {
      grid = shiftRowsDown(grid, 1, 22, 1);
    }
    // 4프레임 중 1번 자연스러운 눈 깜빡임
    if (frameIdx === 3 && baseDir === 'front') {
      grid[10][7] = 'S';
      grid[10][8] = 'S';
      grid[10][15] = 'S';
      grid[10][16] = 'S';
      grid[11][7] = 'K';
      grid[11][8] = 'K';
      grid[11][15] = 'K';
      grid[11][16] = 'K';
    }
  } else if (state === 'walk') {
    const step = frameIdx % 4;
    // 걷기 상체 바운스 (홀수 프레임에 1픽셀 위로 경쾌하게!)
    if (step === 1 || step === 3) {
      // 발 교체: 한쪽 발을 1픽셀 들어올림
      if (baseDir === 'front' || baseDir === 'back') {
        const liftLeft = step === 1;
        const cStart = liftLeft ? 5 : 13;
        const cEnd = liftLeft ? 10 : 18;
        for (let r = 24; r <= 27; r++) {
          for (let c = cStart; c <= cEnd; c++) {
            grid[r - 1][c] = grid[r][c];
            if (r === 27) grid[r][c] = '.';
          }
        }
      } else {
        // 좌우 측면 걷기: 앞발/뒷발 교차 스트라이드
        const stride = step === 1 ? -2 : 2;
        const footCopy = grid.slice(24, 28).map((r) => [...r]);
        for (let r = 24; r < 28; r++) {
          for (let c = 0; c < 24; c++) grid[r][c] = '.';
        }
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 24; c++) {
            const ch = footCopy[r][c];
            if (ch === '.') continue;
            const isFrontFoot = c < 11;
            const nc = c + (isFrontFoot ? stride : -stride);
            if (nc >= 0 && nc < 24) grid[24 + r][nc] = ch;
          }
        }
      }
    } else {
      grid = shiftRowsDown(grid, 1, 22, 1);
    }
  } else if (state === 'work') {
    const f = frameIdx % 4;
    if (f === 2) {
      // 내려치는 순간 상체 1픽셀 압축(Squash)
      grid = shiftRowsDown(grid, 1, 22, 1);
    }
  }

  // 2. 손에 든 드워프 강철 단조 망치 합성
  const hammerShiftY =
    state === 'work'
      ? frameIdx % 4 === 0
        ? -4
        : frameIdx % 4 === 1
        ? -6
        : frameIdx % 4 === 2
        ? 4
        : 0
      : state === 'walk' && frameIdx % 2 === 1
      ? -1
      : 0;

  if (baseDir === 'front') {
    overlayGrid(
      grid,
      FRONT_HAMMER_IDLE.grid,
      FRONT_HAMMER_IDLE.dx,
      FRONT_HAMMER_IDLE.dy + hammerShiftY
    );
    if (state === 'work' && frameIdx % 4 === 2) {
      spark = { x: 20, y: 15 };
    }
  } else if (baseDir === 'back') {
    // 후면에서는 왼편(캐릭터의 오른손 위치)에 망치가 보임
    overlayGrid(
      grid,
      FRONT_HAMMER_IDLE.grid,
      0,
      FRONT_HAMMER_IDLE.dy + hammerShiftY
    );
    if (state === 'work' && frameIdx % 4 === 2) {
      spark = { x: 3, y: 15 };
    }
  } else {
    overlayGrid(
      grid,
      LEFT_HAMMER_IDLE.grid,
      LEFT_HAMMER_IDLE.dx,
      LEFT_HAMMER_IDLE.dy + hammerShiftY
    );
    if (state === 'work' && frameIdx % 4 === 2) {
      spark = { x: isRight ? 20 : 3, y: 15 };
    }
  }

  if (isRight) {
    grid = flipHorizontal(grid);
  }

  return { grid, spark };
}

/**
 * 정수 배율(pixelSize)로 선명하고 쨍한 진짜 도트(Pixel Art)를 캔버스에 렌더링합니다.
 */
export function renderPixelArtCharacter(
  ctx: CanvasRenderingContext2D,
  dir: FacingDir,
  state: AnimState,
  frameIdx: number,
  centerX: number,
  groundY: number,
  pixelSize = 6
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  const { grid, spark } = getBlacksmithPixelFrame(dir, state, frameIdx);
  const rows = grid.length;
  const cols = grid[0].length;
  const startX = Math.round(centerX - (cols * pixelSize) / 2);
  const startY = Math.round(groundY - rows * pixelSize);

  // 도트 스타일 계단형 발밑 그림자
  ctx.fillStyle = 'rgba(12, 8, 22, 0.42)';
  ctx.fillRect(
    startX + 5 * pixelSize,
    groundY - 2 * pixelSize,
    14 * pixelSize,
    3 * pixelSize
  );
  ctx.fillRect(
    startX + 3 * pixelSize,
    groundY - 1 * pixelSize,
    18 * pixelSize,
    1 * pixelSize
  );

  // 24x28 도트 본체 렌더링
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = grid[r][c];
      const color = PIXEL_PALETTE[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(
        startX + c * pixelSize,
        startY + r * pixelSize,
        pixelSize,
        pixelSize
      );
    }
  }

  // 망치 타격 순간 픽셀 불꽃 스파크!
  if (spark) {
    const sx = startX + spark.x * pixelSize;
    const sy = startY + spark.y * pixelSize;
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(sx, sy - 2 * pixelSize, pixelSize, pixelSize);
    ctx.fillRect(sx - 2 * pixelSize, sy, pixelSize, pixelSize);
    ctx.fillRect(sx + 2 * pixelSize, sy, pixelSize, pixelSize);
    ctx.fillRect(sx, sy + 2 * pixelSize, pixelSize, pixelSize);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(sx - pixelSize, sy - pixelSize, pixelSize, pixelSize);
    ctx.fillRect(sx + pixelSize, sy - pixelSize, pixelSize, pixelSize);
  }

  ctx.restore();
}
