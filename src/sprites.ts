import { HERO_CLASSES, HERO_ROSTER_MAP } from './loopData';
import {
  GuestId,
  HeroActivityState,
  MonsterSpriteType,
  OrderType,
} from './types';

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
 * 따뜻하고 채도를 낮춘 카이로소프트풍 아늑한 공통 색상 팔레트
 */
export const BASE_PALETTE: PaletteMap = {
  K: '#3d2c24', // 부드러운 에스프레소 다크브라운 외곽선 (기존 쨍한 검정 대체)
  S: '#f4d5b8', // 따뜻한 복숭아 피부톤
  P: '#dfb08c', // 부드러운 음영 피부톤
  W: '#f6efe2', // 따뜻한 아이보리 크림
  G: '#e6c274', // 부드러운 허니 골드
  O: '#d68a54', // 따뜻한 테라코타 오렌지
  R: '#c7635b', // 차분한 코랄 브릭 레드
  D: '#8f443e', // 따뜻한 버건디
  B: '#5c7a9e', // 차분한 더스티 블루
  C: '#78b2bf', // 부드러운 세이지 스카이
  V: '#7d608a', // 차분한 라벤더 플럼
  M: '#a36884', // 부드러운 로즈 모브
  E: '#558b73', // 포근한 세이지 그린
  L: '#7eb38a', // 부드러운 목초지 그린
  N: '#996b45', // 따뜻한 오크 브라운
  T: '#6b482e', // 깊은 월넛 브라운
  I: '#b8c0c7', // 부드러운 주석/은회색
  H: '#7c858e', // 차분한 슬레이트 금속
  Y: '#ebd186', // 부드러운 버터 옐로
};

/**
 * 영웅 팔레트 오버라이드 색상을 한결 부드러운 톤으로 보정
 */
const SOFT_COLOR_REMAP: Record<string, string> = {
  '#e63946': '#c7635b',
  '#f77f00': '#d68a54',
  '#3b82f6': '#6284ab',
  '#9333ea': '#846594',
  '#fde047': '#ebd186',
  '#f59e0b': '#d99a4e',
  '#22c55e': '#6da67a',
  '#10b981': '#5e9c7e',
  '#06b6d4': '#6ba6b5',
  '#a855f7': '#8b6b9c',
  '#ec4899': '#b57289',
  '#ef4444': '#c7635b',
  '#fbbf24': '#e3be6d',
  '#ffd166': '#e6c274',
  '#4cc9f0': '#78b2bf',
  '#ffffff': '#f6efe2',
};

function softenOverrides(overrides: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(overrides)) {
    out[k] = SOFT_COLOR_REMAP[v.toLowerCase()] ?? v;
  }
  return out;
}

/**
 * 8종 모험가 도트 스프라이트 (12x16)
 */
const GUEST_SPRITES: Record<GuestId, { grid: PixelGrid; palette: PaletteMap }> = {
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
  rogue: {
    palette: { ...BASE_PALETTE, U: '#474b63', Z: '#2f3245' },
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
 * 여관 주인 및 직원 스프라이트 (연금술사·대장장이 추가)
 */
const STAFF_SPRITES: Record<
  'innkeeper' | 'maid' | 'bartender' | 'chef' | 'bard' | 'alchemist' | 'blacksmith' | 'merchant',
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
  alchemist: {
    palette: { ...BASE_PALETTE },
    grid: [
      '....VVVV....',
      '...VVCCVV...',
      '...SKSSKS...',
      '...SSSSSS...',
      '..VVVVVVVV..',
      '.VVCCCCCCVV.',
      '.VVCCGGCCVV.',
      '..VVCCCCVV..',
      '..VVVVVVVV..',
      '...VV..VV...',
      '...KK..KK...',
      '............',
    ],
  },
  blacksmith: {
    palette: { ...BASE_PALETTE },
    grid: [
      '....TTTT....',
      '...SKSSKS...',
      '...SOOOOS...',
      '..OOOOOOOO..',
      '.NNTTTTTTNN.',
      '.NNTGGGGTTN.',
      '.NNTTTTTTNN.',
      '..TTTTTTTT..',
      '...HH..HH...',
      '..KKK..KKK..',
      '............',
    ],
  },
  merchant: {
    palette: { ...BASE_PALETTE },
    grid: [
      '...GGGGGG...',
      '..GGGGGGGG..',
      '...SKSSKS...',
      '...SSSSSS...',
      '..EEEEEEEE..',
      '.EEGEEEEGEE.',
      '.EEEEEEEEEE.',
      '..GGGGGGGG..',
      '...TT..TT...',
      '..NNN..NNN..',
      '............',
    ],
  },
};

/**
 * 던전 몬스터 7종 도트 스프라이트 (층별 전투 연출용)
 */
const MONSTER_SPRITES: Record<
  MonsterSpriteType,
  { grid: PixelGrid; palette: PaletteMap }
> = {
  slime: {
    palette: { ...BASE_PALETTE },
    grid: [
      '....LLLL....',
      '..LLLLLLLL..',
      '.LLLWLLWLLL.',
      '.LLKLLLLKLL.',
      'LLLLLLLLLLLL',
      'LLLEEEEEELLL',
      '.EEEEEEEEEE.',
      '............',
    ],
  },
  goblin: {
    palette: { ...BASE_PALETTE },
    grid: [
      '..L.LLLL.L..',
      '.LLLLLLLLLL.',
      '..LKRLLRKL..',
      '...LLLLLL..I',
      '..NNNNNNNN.I',
      '.NNLLLLLLNNI',
      '..TTTTTTTT..',
      '...LL..LL...',
      '..NNN..NNN..',
      '............',
    ],
  },
  wolf: {
    palette: { ...BASE_PALETTE },
    grid: [
      '.H..HHHH....',
      'HHHHHHHHH...',
      'HRKHHHHHHH..',
      'WWWWHHHHHHH.',
      '..HHHHHHHHHH',
      '..HHHHHHHHH.',
      '..HH.HH.HH..',
      '..KK.KK.KK..',
      '............',
    ],
  },
  golem: {
    palette: { ...BASE_PALETTE },
    grid: [
      '...HHHHHH...',
      '..HIIIIH..',
      '..HICCCCIH..',
      '.HHHHHHHHHH.',
      'HHIIICCCIIHH',
      'HHIIIIIIIIHH',
      '.HHHHHHHHHH.',
      '..HHH..HHH..',
      '..III..III..',
      '............',
    ],
  },
  troll: {
    palette: { ...BASE_PALETTE },
    grid: [
      '...OOOOOO...',
      '..OOKSSKOO.T',
      '..OOOOOOOO.T',
      '.TTTTTTTTTTT',
      'TTOOOOOOOOTT',
      'TTOOGGGGOOTT',
      '.TTTTTTTTTT.',
      '..TTT..TTT..',
      '..NNN..NNN..',
      '............',
    ],
  },
  knight: {
    palette: { ...BASE_PALETTE },
    grid: [
      '..V.HHHH.V..',
      '..HHHHHHHH.I',
      '..HHRKKRHH.I',
      '..HHHHHHHH.I',
      '.VVHHHHHHVVI',
      '.VVHVVVVHVVI',
      '..HHHHHHHH..',
      '...HH..HH...',
      '..KKK..KKK..',
      '............',
    ],
  },
  dragon: {
    palette: { ...BASE_PALETTE },
    grid: [
      'G..DDDDDD..G',
      'GGDDDDDDDDGG',
      '.DDYYDDYYDD.',
      '.DDDDDDDDDD.',
      'OODDDGGDDDOO',
      'ORDDGGGGDDRO',
      '.DDDDDDDDDD.',
      '..DDDDDDDD..',
      '..GGG..GGG..',
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

  if (isSleeping) {
    const zOffset = Math.floor(Date.now() / 350) % 3;
    ctx.fillStyle = '#b5d6e6';
    ctx.font = 'bold 7px monospace';
    ctx.fillText('z', x + 5, y - 16 - zOffset);
    ctx.fillText('Z', x + 9, y - 20 - zOffset);
  }
}

export function drawStaffCharacter(
  ctx: CanvasRenderingContext2D,
  role:
    | 'innkeeper'
    | 'maid'
    | 'bartender'
    | 'chef'
    | 'bard'
    | 'alchemist'
    | 'blacksmith'
    | 'merchant',
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

  ctx.fillStyle = '#3d2c24';
  ctx.fillRect(bx - 1, by - 1, 16, 14);
  ctx.fillRect(bx + 5, by + 13, 4, 2);

  ctx.fillStyle = '#f7efe2';
  ctx.fillRect(bx, by, 14, 12);
  ctx.fillRect(bx + 6, by + 12, 2, 2);

  const icon = ORDER_ICONS[order];
  drawPixelSprite(ctx, icon.grid, icon.palette, bx + 7, by + 10, 1, false);

  ctx.fillStyle = '#d99a4e';
  ctx.fillRect(bx + 12, by - 2, 4, 6);
  ctx.fillStyle = '#f6efe2';
  ctx.fillRect(bx + 13, by - 1, 2, 2);
  ctx.fillRect(bx + 13, by + 2, 2, 1);
}

export function drawHeroCharacter(
  ctx: CanvasRenderingContext2D,
  heroId: string,
  x: number,
  y: number,
  facing: 'left' | 'right',
  walkPhase: number,
  activity: HeroActivityState = 'idle',
  animTime = 0
): void {
  const roster = HERO_ROSTER_MAP[heroId];
  if (!roster) return;
  const cls = HERO_CLASSES[roster.classId];
  const baseDef = GUEST_SPRITES[cls.baseSpriteId] ?? GUEST_SPRITES.warrior;
  const palette = {
    ...baseDef.palette,
    ...softenOverrides(roster.paletteOverrides),
  };

  let bobY = 0;
  let offsetX = 0;
  if (activity === 'walking') {
    bobY = Math.sin(walkPhase) > 0.2 ? -1 : 0;
  } else if (activity === 'eating' || activity === 'drinking') {
    bobY = Math.floor(animTime * 5) % 2 === 0 ? -1 : 0;
  } else if (activity === 'shopping_equip' || activity === 'enhancing') {
    offsetX = Math.floor(animTime * 8) % 2 === 0 ? 1 : 0;
  }

  drawPixelSprite(
    ctx,
    baseDef.grid,
    palette,
    x + offsetX,
    y + bobY,
    1,
    facing === 'left'
  );

  // 상태별 짧은 픽셀 작업/행동 애니메이션
  const rx = Math.round(x);
  const ry = Math.round(y);
  if (activity === 'sleeping') {
    const zOff = Math.floor(animTime * 3) % 4;
    ctx.fillStyle = '#b5d6e6';
    ctx.font = 'bold 7px monospace';
    ctx.fillText('z', rx + 4, ry - 15 - zOff);
    ctx.fillText('Z', rx + 8, ry - 19 - zOff);
  } else if (activity === 'eating') {
    // 앞쪽에 따뜻한 스튜 그릇과 김
    const sx = facing === 'right' ? rx + 6 : rx - 10;
    ctx.fillStyle = '#8c5a36';
    ctx.fillRect(sx, ry - 7, 5, 3);
    ctx.fillStyle = '#d68a54';
    ctx.fillRect(sx + 1, ry - 8, 3, 2);
  } else if (activity === 'drinking') {
    const sx = facing === 'right' ? rx + 6 : rx - 9;
    ctx.fillStyle = '#e6c274';
    ctx.fillRect(sx, ry - 9, 4, 4);
    ctx.fillStyle = '#f6efe2';
    ctx.fillRect(sx, ry - 10, 4, 1);
  } else if (activity === 'shopping_equip' || activity === 'enhancing') {
    // 망치질 불꽃 이펙트
    if (Math.floor(animTime * 8) % 2 === 0) {
      ctx.fillStyle = '#ebd186';
      ctx.fillRect(rx + 6, ry - 12, 2, 2);
      ctx.fillStyle = '#d68a54';
      ctx.fillRect(rx + 8, ry - 14, 2, 2);
    }
  } else if (activity === 'selling_loot' || activity === 'shopping_potion') {
    if (Math.floor(animTime * 6) % 2 === 0) {
      ctx.fillStyle = '#e6c274';
      ctx.fillRect(rx - 2, ry - 18, 3, 3);
    }
  }
}

export function drawMonsterCharacter(
  ctx: CanvasRenderingContext2D,
  spriteType: MonsterSpriteType,
  x: number,
  y: number,
  isBoss = false,
  hitFlash = false,
  bobPhase = 0
): void {
  const def = MONSTER_SPRITES[spriteType] ?? MONSTER_SPRITES.slime;
  const scale = isBoss ? 2 : 1;
  const bobY = Math.sin(bobPhase) > 0.2 ? -1 : 0;
  const palette = hitFlash
    ? Object.fromEntries(Object.keys(def.palette).map((k) => [k, '#f6efe2']))
    : def.palette;

  drawPixelSprite(ctx, def.grid, palette, x, y + bobY, scale, false);
}

/**
 * 영웅 머리 위 픽셀 말풍선(말구름) 렌더링
 */
export function drawPixelSpeechBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  canvasWidth: number
): void {
  ctx.font = 'bold 8px sans-serif';
  const metrics = ctx.measureText(text);
  const padX = 5;
  const boxW = Math.min(148, Math.max(28, Math.ceil(metrics.width) + padX * 2));
  const boxH = 14;

  let bx = Math.round(x - boxW / 2);
  bx = Math.max(4, Math.min(canvasWidth - boxW - 4, bx));
  const by = Math.max(4, Math.round(y - 34));
  const tailX = Math.max(bx + 4, Math.min(bx + boxW - 6, Math.round(x)));

  // 부드러운 그림자
  ctx.fillStyle = 'rgba(42, 28, 20, 0.28)';
  ctx.fillRect(bx + 1, by + 2, boxW, boxH);

  // 따뜻한 다크브라운 외곽선
  ctx.fillStyle = '#4a352a';
  ctx.fillRect(bx - 1, by - 1, boxW + 2, boxH + 2);
  ctx.fillRect(tailX - 1, by + boxH + 1, 4, 2);

  // 양피지 크림색 배경
  ctx.fillStyle = '#f7efe0';
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.fillRect(tailX, by + boxH, 2, 2);

  // 상단 은은한 하이라이트
  ctx.fillStyle = '#fff9ed';
  ctx.fillRect(bx + 1, by + 1, boxW - 2, 1);

  // 텍스트
  ctx.fillStyle = '#38261d';
  ctx.fillText(text, bx + padX, by + 10);
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

export function getHeroPortraitDataUrl(heroId: string): string {
  const cached = heroPortraitCache[heroId];
  if (cached) return cached;
  if (typeof document === 'undefined') return '';

  const roster = HERO_ROSTER_MAP[heroId];
  if (!roster) return '';
  const cls = HERO_CLASSES[roster.classId];
  const baseDef = GUEST_SPRITES[cls.baseSpriteId] ?? GUEST_SPRITES.warrior;
  const palette = {
    ...baseDef.palette,
    ...softenOverrides(roster.paletteOverrides),
  };

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
