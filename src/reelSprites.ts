import { PAL } from './pixelSprites';

export type ReelId =
  | 'cherry'
  | 'bell'
  | 'gem'
  | 'seven'
  | 'star'
  | 'chest'
  | 'mushroom'
  | 'meat'
  | 'cheese'
  | 'steak'
  | 'copper'
  | 'steel'
  | 'mythril'
  | 'orichalcum'
  | 'herb'
  | 'lotus'
  | 'mandrake'
  | 'phoenix'
  | 'sword'
  | 'axe'
  | 'bow'
  | 'staffW'
  | 'dagger'
  | 'hammer'
  | 'spark'
  | 'lock'
  | 'runeAtk'
  | 'runeCrit'
  | 'runeHp'
  | 'runeVamp'
  | 'runeGold'
  | 'runeBoss'
  | 'potion'
  | 'flask'
  | 'hero'
  | 'coin'
  | 'crit'
  | 'heal'
  | 'x15'
  | 'x2'
  | 'x3';

export type ReelTheme =
  | 'cook'
  | 'hero'
  | 'forge'
  | 'enhance'
  | 'enchant'
  | 'potion'
  | 'staff'
  | 'facility'
  | 'combat'
  | 'reward'
  | 'default';

export const REEL_POOLS: Record<ReelTheme, ReelId[]> = {
  cook: ['mushroom', 'meat', 'cheese', 'steak', 'chest', 'seven'],
  hero: ['hero', 'star', 'bell', 'chest', 'seven', 'coin'],
  forge: ['copper', 'steel', 'mythril', 'sword', 'axe', 'seven'],
  enhance: ['hammer', 'spark', 'star', 'seven', 'lock', 'steel'],
  enchant: ['runeAtk', 'runeHp', 'runeGold', 'gem', 'spark', 'seven'],
  potion: ['herb', 'lotus', 'flask', 'potion', 'mandrake', 'seven'],
  staff: ['hero', 'star', 'coin', 'bell', 'seven', 'chest'],
  facility: ['copper', 'star', 'chest', 'coin', 'seven', 'steel'],
  combat: ['crit', 'heal', 'chest', 'seven', 'spark', 'coin'],
  reward: ['x15', 'x2', 'x3', 'seven', 'chest', 'star'],
  default: ['cherry', 'bell', 'gem', 'star', 'chest', 'seven'],
};

/** 티어 결과에 쓰는 대표 심볼 (슬롯 엔진 문자열과 동일) */
export const TIER_FACE: Record<ReelTheme, Record<'C' | 'B' | 'A' | 'S', ReelId>> = {
  cook: { C: 'mushroom', B: 'meat', A: 'cheese', S: 'seven' },
  hero: { C: 'hero', B: 'star', A: 'chest', S: 'seven' },
  forge: { C: 'copper', B: 'steel', A: 'sword', S: 'seven' },
  enhance: { C: 'hammer', B: 'spark', A: 'star', S: 'seven' },
  enchant: { C: 'runeAtk', B: 'gem', A: 'spark', S: 'seven' },
  potion: { C: 'herb', B: 'flask', A: 'potion', S: 'seven' },
  staff: { C: 'hero', B: 'bell', A: 'star', S: 'seven' },
  facility: { C: 'copper', B: 'coin', A: 'chest', S: 'seven' },
  combat: { C: 'crit', B: 'heal', A: 'chest', S: 'seven' },
  reward: { C: 'x15', B: 'x2', A: 'x3', S: 'seven' },
  default: { C: 'cherry', B: 'bell', A: 'gem', S: 'seven' },
};

const EXTRA: Record<string, string> = {
  // 체리/과일
  A: '#c45c5a',
  a: '#8e3332',
  // 벨 메탈
  N: '#f0e2a0',
  // 숫자 7 크림
  Z: '#fff6d0',
  z: '#e8c468',
};

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
}

function colorOf(ch: string): string {
  if (ch === '.') return '';
  if (PAL[ch]) return PAL[ch];
  return EXTRA[ch] || '';
}

export function bakeReelGrid(rows: string[]): HTMLCanvasElement {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const hex = colorOf(row[x]);
      if (!hex) continue;
      const [r, g, b, a] = hexToRgba(hex);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function g(rows: string[]): HTMLCanvasElement {
  return bakeReelGrid(rows);
}

const CACHE = new Map<ReelId, HTMLCanvasElement>();

function buildSymbol(id: ReelId): HTMLCanvasElement {
  switch (id) {
    case 'cherry':
      return g([
        '......HhH.......',
        '.....Hvvh.......',
        '....HvGh.O......',
        '....hG...O.OO...',
        '...OO...OARRRO..',
        '..OARROOARRRAO..',
        '.OARRRAARRRAAaO.',
        '.OARRAAaRRAAaaO.',
        '..OAAaaAAaaAaO..',
        '...OAaaAaaAaO...',
        '....OAaAaAaO....',
        '.....OOOOO......',
      ]);
    case 'bell':
      return g([
        '.......OO.......',
        '......ONNO......',
        '.....ONYYNO.....',
        '....ONYYyYNO....',
        '...ONYyyyyYNO...',
        '...ONyyyyyyNO...',
        '..ONYyyyyyyYNO..',
        '..ONyyyyyyyyNO..',
        '.ONYYYYYYYYYYNO.',
        '.OOOOOOOOOOOOOO.',
        '.....OYyYO......',
        '......OOO.......',
      ]);
    case 'gem':
      return g([
        '......OOOO......',
        '....OOPPPPOO....',
        '...OPPwwaaPPO...',
        '..OPwaaaaaaaPO..',
        '.OPwaaaaaaaaqO.',
        '.OPaaaaaaaqqQO.',
        '..OPaaaaqqQQO..',
        '...OPaaqQQO....',
        '....OPqQO......',
        '.....OOO.......',
        '...............',
        '...............',
      ]);
    case 'seven':
      return g([
        '..OOOOOOOOOOOO..',
        '..OZZZZZZZZZzO..',
        '..OOOOOOOZzZO..',
        '........OZzO...',
        '.......OZzO....',
        '......OYyO.....',
        '.....OYyO......',
        '....OYyO.......',
        '....OkO........',
        '....OO.........',
        '...............',
        '...............',
      ]);
    case 'star':
      return g([
        '........Y.......',
        '.......YyY......',
        '......OYyYO.....',
        'OOOOOOYYyYYOOOOO',
        '.OYYYYYYkYYYYYO.',
        '..OYYYYkYYYYO..',
        '...OYykkyYYO...',
        '...OYkkkkYYO...',
        '..OYkO..OkYO...',
        '.OYO......OYO..',
        'OO..........OO..',
        '...............',
      ]);
    case 'chest':
      return g([
        '....OOOOOOOO....',
        '...OnuuuuuuuO...',
        '..OnuWWWWWWuNO..',
        '.OnuWWWWWWWWuO.',
        '.OOOOOOOOOOOOOO.',
        '.OuYYYYYYYYYYuO.',
        '.OuYOOOOOOOYyO.',
        '.OuYOYkkkkOYuO.',
        '.OuYOOOOOOOYuO.',
        '.OnuuuuuuuuunO.',
        '..OnnnnnnnnnO..',
        '...OOOOOOOO....',
      ]);
    case 'mushroom':
      return g([
        '.....ORRRRRO....',
        '....ORRwRRRRO...',
        '...ORRRRRRRcO...',
        '..ORRRRRcRRcCO..',
        '.ORRRcRRcCCcCO.',
        '.OOOOOOOOOOOOOO.',
        '.....OwwwO......',
        '.....OwggO......',
        '.....OgggO......',
        '......OgO.......',
        '......OOO.......',
        '...............',
      ]);
    case 'meat':
      return g([
        '.....OssssO.....',
        '....OsdsssdO....',
        '...ORrrrrrsO....',
        '..ORrrcrrrRO....',
        '.ORrcrrrRrO.....',
        '.ORrrrrrRO......',
        '..ORrrrRO.OO....',
        '...ORROOssO.....',
        '....OO.OsdO.....',
        '.......OssO.....',
        '........OO......',
        '...............',
      ]);
    case 'cheese':
      return g([
        '......OOOO......',
        '.....OYYyYO.....',
        '....OYywwyYO....',
        '...OYywkyyykO...',
        '..OYyyyykyyyO...',
        '.OYyykyyyyykO...',
        '.OYyyyykyyyyO...',
        '.OkyyyyyyyykO...',
        '..OkkyyyyykO....',
        '...OOkkkOO......',
        '....OOOO........',
        '...............',
      ]);
    case 'steak':
      return g([
        '...OCCCCCCO.....',
        '..OCcrrrrcCO....',
        '.OCrrRRrrrCO....',
        '.OCrrRwwRrCO....',
        '.OCrrrRRrrCO....',
        '..OCrrrrrCO.....',
        '...OCCGCOO......',
        '.....OvO........',
        '.....OhO........',
        '......O.........',
        '...............',
        '...............',
      ]);
    case 'copper':
      return g([
        '......OOOO......',
        '....OOkkykOO....',
        '...OkYYyyykkO...',
        '..OkYywyyyykO...',
        '.OkYyyyyyyykO...',
        '.OkyyyyyyykkO...',
        '.OkkyyyyykkKO...',
        '..OkkkyykkKO....',
        '...OOkkkKOO.....',
        '.....OOOO.......',
        '...............',
        '...............',
      ]);
    case 'steel':
      return g([
        '......OOOO......',
        '....OOIIiiOO....',
        '...OIwwwiiIjO...',
        '..OIwiiiiiiJO...',
        '.OIiiiiiiiJJO...',
        '.OIiiiiiiJJjO...',
        '.OJiiiiiJJJO....',
        '..OJJiiJJJO.....',
        '...OJJJJJO......',
        '....OOOOO.......',
        '...............',
        '...............',
      ]);
    case 'mythril':
      return g([
        '......OPPO......',
        '....OOPBwBPO....',
        '...OPwwBBBaPO...',
        '..OPBBBBaaqPO...',
        '.OPBBaaaaqqQO...',
        '.OPaaaaaqqQO....',
        '.OPaaaqqQQO.....',
        '..OPqqQQQO......',
        '...OQQQO........',
        '....OOO.........',
        '...............',
        '...............',
      ]);
    case 'orichalcum':
      return g([
        '......OYYO......',
        '....OOYFFyYO....',
        '...OYFwwffyYO...',
        '..OYFFffffkYO...',
        '.OYFffffkkKYO...',
        '.OYffffkkKKO....',
        '.OYffkkKKKO.....',
        '..OYkKKKKO......',
        '...OKKKO........',
        '....OOO.........',
        '...............',
        '...............',
      ]);
    case 'herb':
      return g([
        '......GvG.......',
        '.....GvvvG......',
        '....GvGhGvG.....',
        '...OGvhHvGO.....',
        '....OhHvHO......',
        '.....OnnO.......',
        '.....OnuO.......',
        '....OnuuO.......',
        '....OnnO........',
        '.....OO.........',
        '...............',
        '...............',
      ]);
    case 'lotus':
      return g([
        '.......P........',
        '.....PaPaP......',
        '....PwaaawP.....',
        '...PwaPPPawP....',
        '..OpaPwwPaoP....',
        '..OPaaaaaaPO....',
        '...OqPaaPqO.....',
        '....OqGGqO......',
        '.....OvVO.......',
        '......OO........',
        '...............',
        '...............',
      ]);
    case 'mandrake':
      return g([
        '....G..G..G.....',
        '.....v.h.v......',
        '......OvO.......',
        '.....OssSO......',
        '....OsdedsO.....',
        '....OsdddSO.....',
        '.....OSSsO......',
        '....On..nO......',
        '...On....nO.....',
        '...O......O.....',
        '...............',
        '...............',
      ]);
    case 'phoenix':
      return g([
        '....F..f..F.....',
        '...Ff.Ff.fF.....',
        '..OFRRfRRFO.....',
        '.OFRwwRRrrFO....',
        '.OFRrrRrrrFO....',
        '..OFrrrrrFO.....',
        '...OFrrFO.......',
        '....OYFO........',
        '.....OfO........',
        '......O.........',
        '...............',
        '...............',
      ]);
    case 'sword':
      return g([
        '...........IIO..',
        '..........IwIO..',
        '.........IwIO...',
        '........IwIO....',
        '.......IwIO.....',
        '......IwIO......',
        '....OOkO........',
        '...OYkYO........',
        '..OOOO..........',
        '.OnnO...........',
        '..OO............',
        '...............',
      ]);
    case 'axe':
      return g([
        '......OIIIIO....',
        '.....OIwwwIO....',
        '....OIwiiIiO....',
        '...OnOiiiJO.....',
        '..OnuOOOO.......',
        '.OnuuO..........',
        'OnuuO...........',
        'OnnO............',
        '.OO.............',
        '................',
        '................',
        '................',
      ]);
    case 'bow':
      return g([
        '.....OnnO.......',
        '....Onu.nO......',
        '...Onu...nO.....',
        '...Ou.YYY.nO....',
        '...Ou.YkY.uO....',
        '...Ou.YYY.nO....',
        '...Onu...nO.....',
        '....Onu.nO......',
        '.....OnnO.......',
        '................',
        '................',
        '................',
      ]);
    case 'staffW':
      return g([
        '......OPPO......',
        '.....OPwWPO.....',
        '......OPPO......',
        '.......OuO......',
        '.......OuO......',
        '.......OnO......',
        '.......OuO......',
        '.......OnO......',
        '.......OuO......',
        '.......OO.......',
        '................',
        '................',
      ]);
    case 'dagger':
      return g([
        '.........IIO....',
        '........IwIO....',
        '.......IwIO.....',
        '......IwIO......',
        '....OOYOO.......',
        '...OnuuO........',
        '....OOO.........',
        '................',
        '................',
        '................',
        '................',
        '................',
      ]);
    case 'hammer':
      return g([
        '....OIIIIIIO....',
        '...OIwwwiiJO....',
        '...OIiiiiiJO....',
        '...OIIIIIIJO....',
        '......OnO.......',
        '......OuO.......',
        '......OnO.......',
        '......OuO.......',
        '......OnO.......',
        '.......O........',
        '................',
        '................',
      ]);
    case 'spark':
      return g([
        '........F.......',
        '....Y..FfF..Y...',
        '.....YF.f.FY....',
        '......OfffO.....',
        '....OOFFFFOO....',
        '.....OffffO.....',
        '....Y.FfF.Y.....',
        '...Y...F...Y....',
        '................',
        '................',
        '................',
        '................',
      ]);
    case 'lock':
      return g([
        '.....OJJJO......',
        '....OJiiiJO.....',
        '....OJi.iJO.....',
        '....OJiiiJO.....',
        '..OOOOOOOOOOO...',
        '..OYyyyyyyyYO...',
        '..OYyYkkYyyYO...',
        '..OYyyyyyyyYO...',
        '..OYyyyyyykYO...',
        '...OOOOOOOO.....',
        '................',
        '................',
      ]);
    case 'runeAtk':
      return g([
        '....OQQQQQO.....',
        '...OQaPaaQO.....',
        '..OQaPRRPaQO....',
        '..OQPRwwRPQO....',
        '..OQaPRRPaQO....',
        '...OQaPaaQO.....',
        '....OQQQQO......',
        '................',
        '................',
        '................',
        '................',
        '................',
      ]);
    case 'runeCrit':
      return g([
        '....OQQQQQO.....',
        '...OQaYaaQO.....',
        '..OQaYYkYaQO....',
        '..OQYYkkYYQO....',
        '..OQaYYkYaQO....',
        '...OQaYaaQO.....',
        '....OQQQQO......',
        '................',
        '................',
        '................',
        '................',
        '................',
      ]);
    case 'runeHp':
      return g([
        '....OQQQQQO.....',
        '...OQGvGvQO.....',
        '..OQGGvvGGQO....',
        '..OQGvvvvGQO....',
        '..OQaGvvGaQO....',
        '...OQaGGaQO.....',
        '....OQQQQO......',
        '................',
        '................',
        '................',
        '................',
        '................',
      ]);
    case 'runeVamp':
      return g([
        '....OQQQQQO.....',
        '...OQrRrRQO.....',
        '..OQRrrrrRQO....',
        '..OQRrrrrRQO....',
        '..OQaRrrRaQO....',
        '...OQaRRaQO.....',
        '....OQQQQO......',
        '................',
        '................',
        '................',
        '................',
        '................',
      ]);
    case 'runeGold':
      return g([
        '....OQQQQQO.....',
        '...OQYYyYQO.....',
        '..OQYYYYYYQO....',
        '..OQYywwYyQO....',
        '..OQaYYYYaQO....',
        '...OQaYYaQO.....',
        '....OQQQQO......',
        '................',
        '................',
        '................',
        '................',
        '................',
      ]);
    case 'runeBoss':
      return g([
        '....OQQQQQO.....',
        '...OQPPaPQO.....',
        '..OQPPaaPPQO....',
        '..OQPawwaPQO....',
        '..OQaPaaPaQO....',
        '...OQaPPaQO.....',
        '....OQQQQO......',
        '................',
        '................',
        '................',
        '................',
        '................',
      ]);
    case 'potion':
      return g([
        '......OOOO......',
        '.....OwwwwO.....',
        '......OWWO......',
        '.....OPaaPO.....',
        '....OPwaaaPO....',
        '...OPaaaaaqO....',
        '...OPaaaaqQO....',
        '....OPaaqQO.....',
        '.....OPqQO......',
        '......OOO.......',
        '................',
        '................',
      ]);
    case 'flask':
      return g([
        '.....OBBBO......',
        '.....OBbBO......',
        '......OBO.......',
        '.....OBbBO......',
        '....OBwwwBO.....',
        '...OBbbbbbBO....',
        '...OBbbbbtBO....',
        '....OBbbtBO.....',
        '.....OBtBO......',
        '......OOO.......',
        '................',
        '................',
      ]);
    case 'hero':
      return g([
        '......OOOO......',
        '.....OssssO.....',
        '....OsdedsO.....',
        '....OsppppO.....',
        '.....OsssO......',
        '....ORRRRRO.....',
        '...ORYwwYRO.....',
        '...ORrrrrRO.....',
        '....On..nO......',
        '....On..nO......',
        '................',
        '................',
      ]);
    case 'coin':
      return g([
        '.....OYYYYO.....',
        '....OYwwyyYO....',
        '...OYwYYYYYyO...',
        '...OYYykkYyYO...',
        '...OYYykkYyYO...',
        '...OYYyyyyyYO...',
        '....OYyyyyYO....',
        '.....OYYYKO.....',
        '......OOOO......',
        '................',
        '................',
        '................',
      ]);
    case 'crit':
      return g([
        '.........FO.....',
        '........FfO.....',
        '.......FfO.IO...',
        '......FfOIwIO...',
        '....OOfOIwIO....',
        '...ORROIwIO.....',
        '..ORrOIwIO......',
        '.ORROIwIO.......',
        '..OOIwIO........',
        '...OIO..........',
        '................',
        '................',
      ]);
    case 'heal':
      return g([
        '......OvvO......',
        '.....OGwwGO.....',
        '....OGwvwGGO....',
        '.....OGGGGO.....',
        '......OwO.......',
        '.....OwwwO......',
        '....OwwwwwO.....',
        '...OwwwGwwwO....',
        '....OwwwwwO.....',
        '.....OOOOO......',
        '................',
        '................',
      ]);
    case 'x15':
      return g([
        'OOOOOOOOOOOOOOOO',
        'OkkkkkkkkkkkkkkO',
        'OkYYYYYYYYYYYYKO',
        'OkY..........YKO',
        'OkYw.w.Y.YYYYYKO',
        'OkY.w..Y.Y...YKO',
        'OkY.w..Y..YY.YKO',
        'OkY.w..Y....YYKO',
        'OkYw.w.Y.YYYYYKO',
        'OkY..........YKO',
        'OkYYYYYYYYYYYYKO',
        'OkkkkkkkkkkkkkkO',
        'OOOOOOOOOOOOOOOO',
      ]);
    case 'x2':
      return g([
        '.OOOOOOOOOOOOOO.',
        '.OkkkkkkkkkkkkO.',
        '.OkYYYYYYYYYYKO.',
        '.OkY........YKO.',
        '.OkYw.w.YYYYYKO.',
        '.OkY.w.Y....YKO.',
        '.OkY.w...YYY.KO.',
        '.OkY.w.Y....YKO.',
        '.OkYw.w.YYYYYKO.',
        '.OkY........YKO.',
        '.OkYYYYYYYYYYKO.',
        '.OkkkkkkkkkkkkO.',
        '.OOOOOOOOOOOOOO.',
      ]);
    case 'x3':
      return g([
        '.OOOOOOOOOOOOOO.',
        '.OkkkkkkkkkkkkO.',
        '.OkYYYYYYYYYYKO.',
        '.OkY........YKO.',
        '.OkYw.w.YYYYYKO.',
        '.OkY.w.Y....YKO.',
        '.OkY.w...YY..KO.',
        '.OkY.w.Y....YKO.',
        '.OkYw.w.YYYYYKO.',
        '.OkY........YKO.',
        '.OkYYYYYYYYYYKO.',
        '.OkkkkkkkkkkkkO.',
        '.OOOOOOOOOOOOOO.',
      ]);
    default:
      return g(['.O.', 'OwO', '.O.']);
  }
}

export function getReelSprite(id: ReelId): HTMLCanvasElement {
  let spr = CACHE.get(id);
  if (!spr) {
    spr = buildSymbol(id);
    CACHE.set(id, spr);
  }
  return spr;
}

export function overrideReelSprite(id: ReelId, spr: HTMLCanvasElement): void {
  CACHE.set(id, spr);
}

export function isReelId(value: string): value is ReelId {
  return CACHE.has(value as ReelId) || buildable(value);
}

function buildable(value: string): boolean {
  try {
    const spr = getReelSprite(value as ReelId);
    return !!spr;
  } catch {
    return false;
  }
}

export function normalizeReelId(raw: string, theme: ReelTheme = 'default'): ReelId {
  if (REEL_POOLS.default.includes(raw as ReelId) || REEL_POOLS[theme].includes(raw as ReelId)) {
    return raw as ReelId;
  }
  // 레거시 이모지·이전 심볼 호환
  const map: Record<string, ReelId> = {
    '🍒': 'cherry',
    '🔔': 'bell',
    '💎': 'gem',
    '7️⃣': 'seven',
    '⭐': 'star',
    '🔥': 'spark',
    '⚒️': 'hammer',
    '💥': 'spark',
    '🔒': 'lock',
    '✨': 'spark',
    '🔮': 'gem',
    '⚔️': 'crit',
    '🛡️': 'heal',
    '🧪': 'flask',
    '💚': 'heal',
    '💰': 'coin',
  };
  return map[raw] || TIER_FACE[theme].C;
}

export function themeForTab(tab: string | null): ReelTheme {
  switch (tab) {
    case 'inn_cook':
      return 'cook';
    case 'inn_hero':
      return 'hero';
    case 'bs_forge':
      return 'forge';
    case 'bs_enhance':
      return 'enhance';
    case 'bs_enchant':
      return 'enchant';
    case 'potion_brew':
      return 'potion';
    case 'staff_hire':
      return 'staff';
    case 'facility_up':
      return 'facility';
    default:
      return 'default';
  }
}

const VIEW = 28;
const CELL = 20;
const SCALE = 2;

type ReelPhase = 'idle' | 'spin' | 'decel' | 'bounce';

interface ColState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  offset: number;
  vel: number;
  phase: ReelPhase;
  target: number;
  bounce: number;
  pool: ReelId[];
  face: ReelId;
}

export class PixelReelMachine {
  private host: HTMLElement;
  private cols: ColState[] = [];
  private raf = 0;
  private lastT = 0;
  private flash = 0;
  private onDone: (() => void) | null = null;
  private pendingStops = 0;
  private destroyed = false;
  private jackpot = false;
  private theme: ReelTheme;

  constructor(host: HTMLElement, symbols: ReelId[], theme: ReelTheme, jackpot = false) {
    this.host = host;
    this.theme = theme;
    this.jackpot = jackpot;
    host.innerHTML = '';
    host.classList.add('pixel-reels-host');
    const pool = REEL_POOLS[theme];
    for (let i = 0; i < 3; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = VIEW * SCALE;
      canvas.height = VIEW * SCALE;
      canvas.className = 'pixel-reel-col';
      canvas.style.width = '56px';
      canvas.style.height = '56px';
      host.appendChild(canvas);
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      const face = normalizeReelId(symbols[i] || pool[0], theme);
      const col: ColState = {
        canvas,
        ctx,
        offset: pool.indexOf(face) >= 0 ? pool.indexOf(face) : 0,
        vel: 0,
        phase: 'idle',
        target: 0,
        bounce: 0,
        pool,
        face,
      };
      this.cols.push(col);
      this.paintCol(col, 0);
    }
    if (jackpot) host.classList.add('reels-win-flash');
  }

  public setFaces(symbols: ReelId[], jackpot = false): void {
    this.jackpot = jackpot;
    this.host.classList.toggle('reels-win-flash', jackpot);
    for (let i = 0; i < 3; i++) {
      const col = this.cols[i];
      col.face = normalizeReelId(symbols[i] || col.pool[0], this.theme);
      const idx = col.pool.indexOf(col.face);
      col.offset = idx >= 0 ? idx : 0;
      col.phase = 'idle';
      col.vel = 0;
      this.paintCol(col, 0);
    }
  }

  public spinTo(symbols: ReelId[], jackpot: boolean, onDone: () => void): void {
    if (this.destroyed) return;
    this.onDone = onDone;
    this.jackpot = jackpot;
    this.host.classList.remove('reels-win-flash');
    this.pendingStops = 3;
    const now = performance.now();
    this.lastT = now;
    for (let i = 0; i < 3; i++) {
      const col = this.cols[i];
      col.face = normalizeReelId(symbols[i] || col.pool[0], this.theme);
      if (!col.pool.includes(col.face)) {
        col.pool = [...col.pool, col.face];
      }
      col.phase = 'spin';
      col.vel = 18 + i * 1.4;
      col.bounce = 0;
      const targetIdx = col.pool.indexOf(col.face);
      const extra = 8 + i * 3;
      const current = col.offset;
      const dist = extra * col.pool.length + ((targetIdx - (current % col.pool.length)) + col.pool.length) % col.pool.length;
      col.target = current + dist;
      window.setTimeout(() => {
        if (col.phase === 'spin') col.phase = 'decel';
      }, 520 + i * 280);
    }
    this.tick(now);
  }

  public destroy(): void {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.onDone = null;
  }

  private tick = (t: number): void => {
    if (this.destroyed) return;
    const dt = Math.min(0.05, (t - this.lastT) / 1000 || 0.016);
    this.lastT = t;
    let any = false;
    for (const col of this.cols) {
      if (col.phase === 'idle') continue;
      any = true;
      if (col.phase === 'spin') {
        col.offset += col.vel * dt;
      } else if (col.phase === 'decel') {
        const remain = col.target - col.offset;
        if (remain <= 0.02) {
          col.offset = col.target;
          col.phase = 'bounce';
          col.bounce = 0;
          col.vel = 0;
        } else {
          col.vel = Math.max(2.2, remain * 5.5);
          col.offset += col.vel * dt;
          if (col.offset > col.target) col.offset = col.target;
        }
      } else if (col.phase === 'bounce') {
        col.bounce += dt * 3.6;
        if (col.bounce >= 1) {
          col.phase = 'idle';
          col.offset = col.target;
          this.pendingStops = Math.max(0, this.pendingStops - 1);
          if (this.pendingStops === 0) {
            if (this.jackpot) {
              this.host.classList.add('reels-win-flash');
              this.flash = 1;
            }
            const done = this.onDone;
            this.onDone = null;
            done?.();
          }
        }
      }
      this.paintCol(col, dt);
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt);
      any = true;
    }
    if (any) this.raf = requestAnimationFrame(this.tick);
    else this.raf = 0;
  };

  private paintCol(col: ColState, _dt: number): void {
    const ctx = col.ctx;
    const w = VIEW * SCALE;
    const h = VIEW * SCALE;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    // 배경
    ctx.fillStyle = '#efe6d4';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f7f1e4';
    ctx.fillRect(2, 2, w - 4, 8);
    const n = col.pool.length;
    const bounceOff =
      col.phase === 'bounce' ? Math.sin(col.bounce * Math.PI) * -0.18 : 0;
    const pos = col.offset + bounceOff;
    const speed = Math.abs(col.vel);
    const blur = col.phase === 'spin' || (col.phase === 'decel' && speed > 6);
    const center = VIEW / 2;
    for (let k = -2; k <= 2; k++) {
      const idx = Math.floor(pos + k + n * 8) % n;
      const frac = (pos % 1 + 1) % 1;
      const y = center - (k - frac) * CELL;
      const spr = getReelSprite(col.pool[idx]);
      const sx = Math.round((VIEW - spr.width) / 2) * SCALE;
      const sy = Math.round(y - spr.height / 2) * SCALE;
      if (blur) {
        ctx.globalAlpha = 0.28;
        ctx.drawImage(spr, sx, sy - 10, spr.width * SCALE, spr.height * SCALE + 14);
        ctx.globalAlpha = 0.45;
        ctx.drawImage(spr, sx, sy - 5, spr.width * SCALE, spr.height * SCALE + 8);
        ctx.globalAlpha = 0.85;
        ctx.drawImage(spr, sx, sy, spr.width * SCALE, spr.height * SCALE);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 1;
        ctx.drawImage(spr, sx, sy, spr.width * SCALE, spr.height * SCALE);
      }
    }
    // 상하 비네트
    const fade = ctx.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, 'rgba(39,28,25,0.45)');
    fade.addColorStop(0.22, 'rgba(39,28,25,0)');
    fade.addColorStop(0.78, 'rgba(39,28,25,0)');
    fade.addColorStop(1, 'rgba(39,28,25,0.45)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);
    // 테두리
    ctx.strokeStyle = '#3a2a22';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  }
}

export function mountReelFrame(
  host: HTMLElement,
  symbols: string[],
  theme: ReelTheme,
  opts?: { jackpot?: boolean }
): PixelReelMachine {
  const faces = symbols.map((s) => normalizeReelId(s, theme));
  return new PixelReelMachine(host, faces, theme, !!opts?.jackpot);
}

/** 인챈트 룬 아이콘 (미리보기용) */
export function getEnchantRuneSprite(optionId: string): HTMLCanvasElement {
  const map: Record<string, ReelId> = {
    enc_atk: 'runeAtk',
    enc_crit: 'runeCrit',
    enc_hp: 'runeHp',
    enc_vamp: 'runeVamp',
    enc_gold: 'runeGold',
    enc_boss: 'runeBoss',
  };
  return getReelSprite(map[optionId] || 'runeAtk');
}
