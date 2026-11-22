import { HERO_CLASSES, HERO_ROSTER_MAP } from './loopData';
import { GuestId, OrderType } from './types';

export type PixelGrid = string[];
export type PaletteMap = Record<string, string>;

/**
 * 픽셀 배열(문자열 그리드)을 캔버스에 그립니다.
 * '.' 또는 공백은 투명으로 처리합니다.
 */
export function drawPixelSprite(
  ctx: CanvasRenderingContext2D,
  grid: PixelGrid,
  palette: PaletteMap,
  x: number,
  y: number,
  scale = 1,
  flipX = false
): void {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const startX = Math.round(x - (width * scale) / 2);
  const startY = Math.round(y - height * scale);

  for (let row = 0; row < height; row++) {
    const line = grid[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (!color) continue;
      const drawCol = flipX ? width - 1 - col : col;
      ctx.fillStyle = color;
      ctx.fillRect(
        startX + drawCol * scale,
        startY + row * scale,
        scale,
        scale
      );
    }
  }
}

/**
 * 공통 색상 팔레트
 */
const BASE_PALETTE: PaletteMap = {
  K: '#1a1423', // 외곽선/검정
  S: '#fbd3b4', // 피부톤
  P: '#f4a261', // 볼터치/그림자 피부
  W: '#ffffff', // 흰색
  G: '#ffd166', // 황금색
  O: '#f77f00', // 주황
  R: '#e63946', // 빨강
  D: '#9b2226', // 진홍
  B: '#4361ee', // 파랑
  C: '#4cc9f0', // 하늘/마력
  V: '#7209b7', // 보라
  M: '#b5179e', // 자주
  E: '#2a9d8f', // 초록(여행자/숲)
  L: '#52b788', // 밝은 초록
  N: '#8d5524', // 갈색(나무/가죽)
  T: '#5c3a21', // 진갈색
  I: '#adb5bd', // 철/은색
  H: '#6c757d', // 진회색 금속
  Y: '#ffe066', // 밝은 노랑
};

/**
 * 8종 모험가 도트 스프라이트 (12x16)
 * 각 모험가는 고유한 모자/투구, 망토 색상, 무기 실루엣을 가집니다.
 */
const GUEST_SPRITES: Record<GuestId, { grid: PixelGrid; palette: PaletteMap }> = {
  // 1. 초보 여행자: 초록 후드 망토, 갈색 배낭, 나무 지팡이
  traveler: {
    palette: { ...BASE_PALETTE },
    grid: [
      '....EEEE....',
      '...EEEEEE...',
      '...ESSSSE..N',
      '...SKSSKS..N',
      '...SSSSSS..N',
      '....EEEE...N',
      '..NEEEEEEN.N',
      '.NNEELEEEN.N',
      '.NNEEEEEEN.N',
      '.NNEEEEEEN.N',
      '..NTTTTTT..N',
      '...TT..TT..N',
      '...TT..TT..N',
      '...NN..NN..N',
      '..NNN..NNN..',
      '............',
    ],
  },

  // 2. 강철 전사: 철제 바이저 투구, 붉은 깃털, 강철 갑옷, 대검 실루엣
  warrior: {
    palette: { ...BASE_PALETTE },
    grid: [
      '....RRR.....',
      '...IIIII....',
      '..IIIIIII..I',
      '..IKKIKKI..I',
      '..ISSSSSI..I',
      '...IIIII...I',
      '..HIIIIIH.GI',
      '.HHIGGGIH..I',
      '.HHIIIIIH..I',
      '.HHIHHHIH..I',
      '..HHHHHHH..T',
      '...II..II...',
      '...II..II...',
      '...HH..HH...',
      '..HHH..HHH..',
      '............',
    ],
  },

  // 3. 그림자 도적: 짙은 남색/검은 두건, 붉은 머플러, 쌍단검 실루엣
  rogue: {
    palette: { ...BASE_PALETTE, U: '#2b2d42', Z: '#141522' },
    grid: [
      '....UUUU....',
      '...UUUUUU...',
      '..UUZZZZUU..',
      '..UZKSSKZU..',
      '..UURRRRUU..',
      '...RRRRRR...',
      '..UUUUUUUR..',
      '.IUUUUUUUU.I',
      '.IUUUUUUUU.I',
      'I.UUUUUUUU..I',
      '...ZZZZZZ...',
      '...ZZ..ZZ...',
      '...ZZ..ZZ...',
      '...KK..KK...',
      '..KKK..KKK..',
      '............',
    ],
  },

  // 4. 별빛 마법사: 보라색 큰 고깔모자, 푸른 로브, 빛나는 마법 지팡이
  mage: {
    palette: { ...BASE_PALETTE },
    grid: [
      '.....VV.....',
      '....VVVV....',
      '...VVGGVV.C.',
      '.VVVVVVVVGCG',
      '...SSSSSS.C.',
      '...SKSSKS.N.',
      '....SSSS..N.',
      '..VVBBBBVVN.',
      '.VVBBBBBBVN.',
      '.VVBBGGBBVN.',
      '..BBBBBBBBN.',
      '..BBBBBBBB..',
      '..BBBBBBBB..',
      '...VV..VV...',
      '..VVV..VVV..',
      '............',
    ],
  },

  // 5. 태양의 성기사: 황금 갑옷, 하얀 날개 장식 투구, 성스러운 망치와 방패
  paladin: {
    palette: { ...BASE_PALETTE },
    grid: [
      '.W..GGGG..W.',
      '.WWGGGGGGWW.',
      '..GGGGGGGG..',
      '..GKSKSSKG.I',
      '..GSSSSSSGII',
      '...GGGGGG..T',
      '.WWGGGGGGW.T',
      'WWGWWWWWWG.T',
      'WWGWWGGWWG.T',
      '.WGWWWWWWG..',
      '..GGGGGGGG..',
      '...GG..GG...',
      '...GG..GG...',
      '...YY..YY...',
      '..GGG..GGG..',
      '............',
    ],
  },

  // 6. 난쟁이 용병: 양뿔 바이킹 투구, 풍성한 붉은 수염, 거대한 전투 도끼
  dwarf: {
    palette: { ...BASE_PALETTE },
    grid: [
      '............',
      '.W..IIII..W.',
      '.WWIIIIIIWW.',
      '..IKSSKSSI.I',
      '..ISOOOOOI.I',
      '..OOOOOOOOII',
      '..OOOOOOOO.T',
      '.NOOOOOOOONT',
      '.NNOOOOOONNT',
      '.NNGGGGGGGNT',
      '..TTTTTTTT.T',
      '...TT..TT...',
      '...NN..NN...',
      '..HHH..HHH..',
      '............',
      '............',
    ],
  },

  // 7. 엘프 정찰대장: 금발과 긴 뾰족귀, 에메랄드 망토, 은빛 장궁
  elf: {
    palette: { ...BASE_PALETTE },
    grid: [
      '....YYYY....',
      '...YYYYYY...',
      '.S.YKSKYS.S.',
      '..SSSSSSSS.I',
      '...YYYYYY.I.',
      '...LLLLLL.I.',
      '..LEEEEEE.I.',
      '.LLEEGGEEL.I',
      '.LLEEEEEEL.I',
      '.LLEEEEEEL..',
      '..EEEEEEEE..',
      '...TT..TT...',
      '...TT..TT...',
      '...LL..LL...',
      '..EEE..EEE..',
      '............',
    ],
  },

  // 8. 은퇴한 용왕 (VIP): 황금 용뿔과 왕관, 진홍빛 망토, 불타는 보주
  dragon_lord: {
    palette: { ...BASE_PALETTE },
    grid: [
      '.G..GGGG..G.',
      'GG.GGGGGG.GG',
      '.GGDDDDDDGG.',
      '..DSYSSYSD.O',
      '..DSSSSSSDOR',
      '...DDDDDD..O',
      '.GGDDDDDDG.G',
      'GRDDDDDDDDRG',
      'GRDDGGGGDDRG',
      'GRDDDDDDDDRG',
      '.DDDDDDDDDD.',
      '..DDDDDDDD..',
      '...DD..DD...',
      '...GG..GG...',
      '..GGG..GGG..',
      '............',
    ],
  },
};

/**
 * 여관 주인 및 직원 스프라이트
 */
const STAFF_SPRITES: Record<
  'innkeeper' | 'maid' | 'bartender' | 'chef' | 'bard',
  { grid: PixelGrid; palette: PaletteMap }
> = {
  innkeeper: {
    palette: { ...BASE_PALETTE },
    grid: [
      '....NNNN....',
      '...NNNNNN...',
      '...SKSSKS...',
      '...SSSSSS...',
      '...NNNNNN...',
      '..WWWWWWWW..',
      '.WWNNNNNNWW.',
      '.WWNNNNNNWW.',
      '..WWWWWWWW..',
      '..WWWWWWWW..',
      '...TTTTTT...',
      '...TT..TT...',
      '...NN..NN...',
      '............',
    ],
  },
  maid: {
    palette: { ...BASE_PALETTE },
    grid: [
      '...WWWWWW...',
      '..KKKKKKKK..',
      '..KSKSSKSK..',
      '..KSSSSSSK..',
      '...KKKKKK...',
      '..KWWWWWWK..',
      '.KKWWWWWWKK.',
      '.KKWWWWWWKK.',
      '..WWWWWWWW..',
      '..KWWWWWWK..',
      '...KK..KK...',
      '...WW..WW...',
      '..KKK..KKK..',
      '............',
    ],
  },
  bartender: {
    palette: { ...BASE_PALETTE },
    grid: [
      '....TTTT....',
      '...TTTTTT...',
      '...SKSSKS...',
      '...STTTTS...',
      '...SSSSSS...',
      '..WRRRRRRW..',
      '.WWRRRRRRWW.',
      '.WWRGGGGWW..',
      '..WWWWWWWW..',
      '..WWWWWWWW..',
      '...TTTTTT...',
      '...TT..TT...',
      '..KKK..KKK..',
      '............',
    ],
  },
  chef: {
    palette: { ...BASE_PALETTE },
    grid: [
      '...WWWWWW...',
      '..WWWWWWWW..',
      '...WWWWWW...',
      '...SKSSKS...',
      '...SSSSSS...',
      '..WWWWWWWW..',
      '.WWWGWWGWWW.',
      '.WWWWWWWWWW.',
      '.WWWGWWGWWW.',
      '..WWWWWWWW..',
      '...HHHHHH...',
      '...HH..HH...',
      '..KKK..KKK..',
      '............',
    ],
  },
  bard: {
    palette: { ...BASE_PALETTE },
    grid: [
      '..R.EEEE....',
      '.RR.EEEEEE..',
      '...ESKSSKS..',
      '....SSSSSS..',
      '...YYYYYY...',
      '..EEEEEEEE..',
      '.EEENNNNEEE.',
      '.EEENNNNEEE.',
      '..EENNNNEE..',
      '...TTTTTT...',
      '...TT..TT...',
      '...EE..EE...',
      '..NNN..NNN..',
      '............',
    ],
  },
};

/**
 * 말풍선 내부 주문 아이콘 (8x8 픽셀)
 */
const ORDER_ICONS: Record<OrderType, { grid: PixelGrid; palette: PaletteMap }> = {
  stew: {
    palette: { ...BASE_PALETTE },
    grid: [
      '..W..W..',
      '.W..W...',
      '........',
      '.OOOOOO.',
      'NNNNNNNN',
      'NNNNNNNN',
      '.NNNNNN.',
      '..TTTT..',
    ],
  },
  ale: {
    palette: { ...BASE_PALETTE },
    grid: [
      '.WWWWWW.',
      'WWWWWWW.',
      '.GGGGGGN',
      '.GYGGGGN',
      '.GYGGGGN',
      '.GGGGGGN',
      '.GGGGGG.',
      '.NNNNNN.',
    ],
  },
  potion: {
    palette: { ...BASE_PALETTE },
    grid: [
      '...NN...',
      '..IIII..',
      '...II...',
      '..ICCI..',
      '.ICCCCI.',
      '.ICWCCI.',
      '.ICCCCI.',
      '..IIII..',
    ],
  },
  sleep: {
    palette: { ...BASE_PALETTE },
    grid: [
      'BBBB....',
      '...B....',
      '..B.BBB.',
      '.B....B.',
      'BBBB.B..',
      '....BBB.',
      '........',
      '........',
    ],
  },
  repair: {
    palette: { ...BASE_PALETTE },
    grid: [
      '..IIII..',
      '.IIIIII.',
      '..IIII..',
      '...NN...',
      '...NN...',
      '...NN...',
      '..HHHH..',
      '.HHHHHH.',
    ],
  },
};

export function drawGuestCharacter(
  ctx: CanvasRenderingContext2D,
  typeId: GuestId,
  x: number,
  y: number,
  facing: 'left' | 'right',
  walkPhase: number,
  isSleeping: boolean
): void {
  const def = GUEST_SPRITES[typeId];
  const bobY = Math.sin(walkPhase) > 0.3 ? -1 : 0;
  drawPixelSprite(
    ctx,
    def.grid,
    def.palette,
    x,
    y + bobY,
    1,
    facing === 'left'
  );

  // 잠자는 중이면 머리 위에 작은 Zzz 도트 표시
  if (isSleeping) {
    const zOffset = Math.floor(Date.now() / 350) % 3;
    ctx.fillStyle = '#a5d8ff';
    ctx.font = 'bold 7px monospace';
    ctx.fillText('z', x + 5, y - 16 - zOffset);
    ctx.fillText('Z', x + 9, y - 20 - zOffset);
  }
}

export function drawStaffCharacter(
  ctx: CanvasRenderingContext2D,
  role: 'innkeeper' | 'maid' | 'bartender' | 'chef' | 'bard',
  x: number,
  y: number,
  facing: 'left' | 'right',
  bobOffset = 0
): void {
  const def = STAFF_SPRITES[role];
  drawPixelSprite(
    ctx,
    def.grid,
    def.palette,
    x,
    y + bobOffset,
    1,
    facing === 'left'
  );
}

export function drawOrderBubble(
  ctx: CanvasRenderingContext2D,
  order: OrderType,
  x: number,
  y: number,
  pulse: number
): void {
  const bx = Math.round(x - 7);
  const by = Math.round(y - 29 + Math.sin(pulse * 5) * 1.5);

  // 말풍선 테두리(검정) 및 배경(크림색)
  ctx.fillStyle = '#1a1423';
  ctx.fillRect(bx - 1, by - 1, 16, 14);
  ctx.fillRect(bx + 5, by + 13, 4, 2);

  ctx.fillStyle = '#fff8e7';
  ctx.fillRect(bx, by, 14, 12);
  ctx.fillRect(bx + 6, by + 12, 2, 2);

  // 주문 아이콘 (8x8)
  const icon = ORDER_ICONS[order];
  drawPixelSprite(ctx, icon.grid, icon.palette, bx + 7, by + 10, 1, false);

  // 클릭 유도 황금 느낌표 배지
  ctx.fillStyle = '#ff9f1c';
  ctx.fillRect(bx + 12, by - 2, 4, 6);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bx + 13, by - 1, 2, 2);
  ctx.fillRect(bx + 13, by + 2, 2, 1);
}

const portraitCache: Partial<Record<GuestId, string>> = {};
const heroPortraitCache: Record<string, string> = {};

export function getGuestPortraitDataUrl(typeId: GuestId): string {
  const cached = portraitCache[typeId];
  if (cached) return cached;
  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    const def = GUEST_SPRITES[typeId];
    drawPixelSprite(ctx, def.grid, def.palette, 24, 44, 2, false);
  }
  const url = canvas.toDataURL();
  portraitCache[typeId] = url;
  return url;
}

export function drawHeroCharacter(
  ctx: CanvasRenderingContext2D,
  heroId: string,
  x: number,
  y: number,
  facing: 'left' | 'right',
  walkPhase: number
): void {
  const roster = HERO_ROSTER_MAP[heroId];
  if (!roster) return;
  const cls = HERO_CLASSES[roster.classId];
  const baseDef = GUEST_SPRITES[cls.baseSpriteId] ?? GUEST_SPRITES.warrior;
  const palette = { ...baseDef.palette, ...roster.paletteOverrides };
  const bobY = Math.sin(walkPhase) > 0.3 ? -1 : 0;
  drawPixelSprite(
    ctx,
    baseDef.grid,
    palette,
    x,
    y + bobY,
    1,
    facing === 'left'
  );
}

export function getHeroPortraitDataUrl(heroId: string): string {
  const cached = heroPortraitCache[heroId];
  if (cached) return cached;
  if (typeof document === 'undefined') return '';

  const roster = HERO_ROSTER_MAP[heroId];
  if (!roster) return '';
  const cls = HERO_CLASSES[roster.classId];
  const baseDef = GUEST_SPRITES[cls.baseSpriteId] ?? GUEST_SPRITES.warrior;
  const palette = { ...baseDef.palette, ...roster.paletteOverrides };

  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    drawPixelSprite(ctx, baseDef.grid, palette, 24, 44, 2, false);
  }
  const url = canvas.toDataURL();
  heroPortraitCache[heroId] = url;
  return url;
}

