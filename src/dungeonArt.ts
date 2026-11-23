/** 던전 전용 도트 아트: 몬스터/보스 프레임, 테마 소품, 배경 레이어 */

export type ThemeId = 'dungeon_1' | 'dungeon_2' | 'dungeon_3' | 'dungeon_4';
export type MonState = 'idle' | 'attack' | 'hit' | 'death';

const P: Record<string, string> = {
  '.': '',
  O: '#271c19', o: '#3a2a22', S: '#1d1526',
  s: '#f4cfa6', d: '#dba87b', p: '#d96b70', e: '#271c19', w: '#f5efe6', g: '#d6cbb9',
  W: '#d4a36a', u: '#b58046', n: '#8c5c2b', m: '#633d19',
  Y: '#f2d675', y: '#d6ac47', k: '#a67c26', K: '#735114',
  I: '#cbd5dc', i: '#98a7b3', j: '#687785', J: '#434e59',
  R: '#e06c62', r: '#b84640', c: '#8a2f2c', C: '#5c1d1c',
  F: '#fae078', f: '#e38a3b', l: '#b84e22', L: '#752b13',
  G: '#a5bd7e', v: '#7a9658', h: '#566e3d', H: '#384a27',
  B: '#8fb3bf', b: '#638896', t: '#466470', T: '#2d434d',
  P: '#c7a4e0', a: '#946eb3', q: '#684a82', Q: '#442f57',
  M: '#6b8f4a', N: '#4e6a34', A: '#cfe3c0',
  E: '#d9f0f5', U: '#8ec5d4', V: '#3f6f86',
  D: '#c9a44c', X: '#8a6a28', Z: '#efe0a8',
};

function hexRgba(hex: string): [number, number, number, number] {
  const c = hex.replace('#', '');
  const n = parseInt(c, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

export function bake(rows: string[]): HTMLCanvasElement {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const hex = P[row[x]];
      if (!hex) continue;
      const [r, g, b, a] = hexRgba(hex);
      const i = (y * w + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

const CACHE = new Map<string, HTMLCanvasElement>();

function pick(key: string, rows: string[]): HTMLCanvasElement {
  let s = CACHE.get(key);
  if (!s) {
    s = bake(rows);
    CACHE.set(key, s);
  }
  return s;
}

/* ---------- 일반 몬스터 ---------- */

function slime(state: MonState, f: number): HTMLCanvasElement {
  const bob = state === 'idle' && (f & 1);
  const atk = state === 'attack';
  const hit = state === 'hit';
  const dead = state === 'death';
  if (dead) {
    return pick('slime-d' + (f % 3), [
      '......................',
      '......................',
      '......................',
      '......OooooooO........',
      '....OORRwwrrRRO.......',
      '...ORRRwwRRRRrRO......',
      '..ORRcRRRcRRRrrO......',
      '..OOOOOOOOOOOOO.......',
      '...OvvvvGvvvvO........',
      '....OOOOOOOO..........',
    ]);
  }
  const eye = hit ? 'RR' : 'ee';
  const top = bob || atk ? '..' : '...';
  return pick('slime-' + state + f, [
    '......................',
    atk ? '......OORRRROO........' : top + '...OORRRROO.......',
    '.....ORRwwRRRRO.......',
    '....ORRRwwRRRrRO......',
    `...ORR${eye}RRRRRrrO.....`,
    '...ORRRRRRRRRrrrO.....',
    '....ORRcRRRcRrrO......',
    hit ? '....OwwwwwwwwwO.......' : '.....OOOOOOOOO.......',
    '......OvvvvvvO........',
    bob ? '......OvGvGGvO........' : '.......OvGvGO.........',
    '.......OOOOOO.........',
    atk ? '......O.....O.........' : '......................',
  ]);
}

function yeti(state: MonState, f: number): HTMLCanvasElement {
  const bob = state === 'idle' && (f & 1);
  const atk = state === 'attack';
  const hit = state === 'hit';
  const dead = state === 'death';
  const eye = hit ? 'RR' : 'ee';
  if (dead) {
    return pick('yeti-d', [
      '........................',
      '......OJJJJJO...........',
      '.....OJiiBBiiJO.........',
      `....OJi${eye}BB${eye}iJO........`,
      '....OJiiiiiiiJO.........',
      '.....OJtttttJO..........',
      '....OJ......JO..........',
      '........................',
    ]);
  }
  return pick('yeti-' + state + f, [
    '.....O.O.O..............',
    '....OJiiiiiJO...........',
    '...OJiiBBBiiJO..........',
    atk ? 'OO.OJiBBBBBBiJO.OO......' : '...OJiBBBBBBiJO.........',
    `...OJi${eye}BBB${eye}iJO.........`,
    '...OJiiiiiiiiJO.........',
    '...OJJittttiJJO.........',
    bob ? '....OJtTTTTtJO..........' : '....OJtTTTtJO...........',
    '....OJ......JO..........',
    '....OJ......JO..........',
    '.....J......J...........',
    '........................',
  ]);
}

function gargoyle(state: MonState, f: number): HTMLCanvasElement {
  const atk = state === 'attack';
  const hit = state === 'hit';
  const dead = state === 'death';
  const eye = hit ? 'YY' : 'ee';
  if (dead) {
    return pick('gar-d', [
      '......................',
      '......OJJJJO..........',
      '.....OJiiiiJO.........',
      `....OJ${eye}iiiJO.........`,
      '....OJiiiiiiJO........',
      '....OJYYYYYYJO........',
      '.....OJjjjjJO.........',
      '......JJ..JJ..........',
      '......................',
    ]);
  }
  return pick('gar-' + state + f, [
    atk ? '...jJ........Jj.......' : '....jJ......Jj........',
    '...jJJOJJJJOJJj.......',
    '....OJiiiiiiJO........',
    `....OJ${eye}ii${eye}JO........`,
    '....OJiiiiiiJO........',
    '....OJYYYYYYJO........',
    '....OJYkkkkYJO........',
    '.....OJjjjjJO.........',
    '.....OJ....JO.........',
    '......J....J..........',
    '......J....J..........',
    '......................',
  ]);
}

function imp(state: MonState, f: number): HTMLCanvasElement {
  const atk = state === 'attack';
  const hit = state === 'hit';
  const dead = state === 'death';
  const eye = hit ? 'FF' : 'ee';
  const flame = (f & 1) ? 'F' : 'f';
  if (dead) {
    return pick('imp-d', [
      '......................',
      '......ORlRRO..........',
      '.....ORffffRO.........',
      `....OR${eye}fffRO.........`,
      '....ORrrrrrRO.........',
      '....ORlllllRO.........',
      '.....ORfLfRO..........',
      '......OOOOO...........',
    ]);
  }
  return pick('imp-' + state + f, [
    `....${flame}..RR..${flame}.........`,
    '...RfRRRRRfR.........',
    '...RRRwwwwRRR........',
    `...RR${eye}ww${eye}RR.........`,
    '...RRRRrrRRRR........',
    '...RRRllllRRR........',
    atk ? '..ORRlFFFlRRO.......' : '...RRlFFFlRR.........',
    '....RR....RR..........',
    '...RfR....RfR.........',
    `...${flame}.R....R.${flame}.........`,
    '......................',
  ]);
}

/* ---------- 보스 ---------- */

function mushGolem(state: MonState, f: number): HTMLCanvasElement {
  const bob = state === 'idle' && (f & 1);
  const atk = state === 'attack';
  const hit = state === 'hit';
  const dead = state === 'death';
  const eye = hit ? 'FF' : 'ee';
  if (dead) {
    return pick('mg-d', [
      '..........................',
      '......GGHHHGGG............',
      '....GHRRRRRRRHG...........',
      '...GHRRwwRRRRRHG..........',
      '...GHRRRRRRRRRHG..........',
      '....GHvvvvvvvvHG..........',
      '....HHvvGGwGGvvHH.........',
      '.....HvvvvvvvvH...........',
      '......Hn....nH............',
    ]);
  }
  return pick('mg-' + state + f, [
    '......GGHHGG..............',
    '....GHRRRRRRHG............',
    '...GHRRwwRRRRHG...........',
    `..GHHR${eye}RRRRRRHG..........`,
    '..GHRRRRRRRRRRHG..........',
    '..GHHvRRRRRRvHHG..........',
    atk ? 'GHHHvvvvvvvvHHHG........' : '.GHHvvvvvvvvHHG.........',
    bob ? 'HHvvGGGwwGGGvvHH........' : '.HHvvGGwGGvvHH..........',
    '.HvGwwwwwwwwGvH...........',
    '.HvvvvvvvvvvvvH...........',
    '..Hn........nH............',
    '..Hn........nH............',
    '...H........H.............',
    atk ? '..HH........HH............' : '..........................',
  ]);
}

function iceLord(state: MonState, f: number): HTMLCanvasElement {
  const atk = state === 'attack';
  const hit = state === 'hit';
  const dead = state === 'death';
  const eye = hit ? 'RR' : 'ee';
  const spark = (f & 1) ? 'E' : 'w';
  if (dead) {
    return pick('il-d', [
      '..........................',
      '.....wBBBBBBBw............',
      '....wBBwwwwBBBw...........',
      `...wBB${eye}www${eye}BBw...........`,
      '...wwBBBBBBBBww...........',
      '....wBBtttttBBw...........',
      '....wT.......Tw...........',
    ]);
  }
  return pick('il-' + state + f, [
    `....${spark}..O.O.O..${spark}..........`,
    '.....OJJJJJJO.............',
    '....OJiiBBBiiJO...........',
    '...OJiiBBBBBiiJO..........',
    `...OJi${eye}BBB${eye}iJO...........`,
    '...OJiiiiiiiiiJO..........',
    atk ? 'OO.OJiitttttiiJO.OO.......' : '...OJiitttttiiJO..........',
    '....OJtTTTTTTJO...........',
    '....OJ........JO..........',
    '....OJ........JO..........',
    '.....J........J...........',
    '..........................',
  ]);
}

function pharaoh(state: MonState, f: number): HTMLCanvasElement {
  const atk = state === 'attack';
  const hit = state === 'hit';
  const dead = state === 'death';
  const eye = hit ? 'RR' : 'ee';
  if (dead) {
    return pick('ph-d', [
      '..........................',
      '....YYYYYYYYYY............',
      '...YYkkkkkkkkYY...........',
      `..YYkY${eye}ww${eye}YkYY..........`,
      '..YYYYYYYYYYYYY...........',
      '..YYYyyyyyyyyYYY..........',
      '...YYkkkkkkkkYY...........',
    ]);
  }
  return pick('ph-' + state + f, [
    '....YYYYYkYYYY............',
    '...YYkkYYYYYYkYY..........',
    '..YYkYYwwwwYYkYY..........',
    `..YkYY${eye}ww${eye}YYkY..........`,
    '..YYYYYYYYYYYYYY..........',
    '..YYYyyyyyyyyYYY..........',
    '..YYYYkkkkkkYYYY..........',
    atk ? 'Y..YYkkkkkkkkYY..Y........' : '...YYkkkkkkkkYY...........',
    '...Yk........kY...........',
    '...Yk........kY...........',
    '....Y........Y............',
    '....Y........Y............',
  ]);
}

function dragon(state: MonState, f: number): HTMLCanvasElement {
  const atk = state === 'attack';
  const hit = state === 'hit';
  const dead = state === 'death';
  const eye = hit ? 'FF' : 'ee';
  const flame = atk ? ((f & 1) ? 'FFF' : 'fff') : '...';
  if (dead) {
    return pick('dr-d', [
      '..............................',
      '....f..RRRR..f................',
      '...RfRRRRRRRRfR...............',
      '...RRRRwwwwRRRR...............',
      `...RRrR${eye}eeRrRR...............`,
      '...RRRRRRRRRRRR...............',
      '...RRRllllllRRR...............',
    ]);
  }
  return pick('dr-' + state + f, [
    '..f....RR....f................',
    '.RfRRRRRRRRRRfR...............',
    'RRRRRwwwwwwRRRRR..............',
    `RRrRR${eye}ww${eye}RRrRR..${flame}.........`,
    '.RRRRRRRRRRRRRR...............',
    'RRRRllllllllRRRR..............',
    '.RRlFFFFFFFlRR................',
    '.RR..........RR...............',
    'RfR..........RfR..............',
    'f.R..........R.f..............',
    '..R..........R................',
    '..............................',
  ]);
}

export function getMonsterSprite(
  zone: ThemeId,
  boss: boolean,
  state: MonState,
  frame: number
): HTMLCanvasElement {
  const f = frame & 3;
  if (zone === 'dungeon_1') return boss ? mushGolem(state, f) : slime(state, f);
  if (zone === 'dungeon_2') return boss ? iceLord(state, f) : yeti(state, f);
  if (zone === 'dungeon_3') return boss ? pharaoh(state, f) : gargoyle(state, f);
  return boss ? dragon(state, f) : imp(state, f);
}

/* ---------- 테마 소품 ---------- */

export function getThemeProp(zone: ThemeId, kind: number, frame = 0): HTMLCanvasElement {
  const f = frame & 1;
  const key = `${zone}-p${kind}-${f}`;
  const cached = CACHE.get(key);
  if (cached) return cached;

  let rows: string[] = ['.'];
  if (zone === 'dungeon_1') {
    if (kind === 0) {
      rows = [
        '..ORRRO.',
        '.ORRwRRO',
        'ORRRRRcO',
        'ORRcRcRO',
        'OOOOOOOO',
        '..OvVO..',
        '..OvO...',
        '..OHO...',
      ];
    } else if (kind === 1) {
      rows = [
        '...G.G..',
        '..GvGvG.',
        '.GvvvvvG',
        'GvvhvvvG',
        '.hhhhhh.',
        '..HHHH..',
      ];
    } else if (kind === 2) {
      rows = [
        '....v...',
        '...GvG..',
        '..GvhvG.',
        '.GvhHvG.',
        '..HvHH..',
        '...HH...',
      ];
    } else {
      rows = [
        '.GGHHG.',
        'GRwwRRG',
        'GRRRRrG',
        'GvvvvvG',
        '.HHHHH.',
        '..HvH..',
      ];
    }
  } else if (zone === 'dungeon_2') {
    if (kind === 0) {
      rows = [
        '...w...',
        '..wBw..',
        '.wBBBw.',
        'wBBEBBw',
        '.wBBBw.',
        '..wTw..',
        '...T...',
        '...T...',
      ];
    } else if (kind === 1) {
      rows = [
        '.EEEEE.',
        'EwwwBBE',
        'EBBBBBE',
        '.ETTTT.',
        '..TTTT.',
      ];
    } else if (kind === 2) {
      rows = [
        '..E..',
        '.EbE.',
        'EbBbE',
        '.EbE.',
        '..T..',
        '..T..',
      ];
    } else {
      rows = [
        '...I.',
        '..IiI',
        '.IiiiI',
        'IiwiiI',
        '.IIII.',
        '..TT..',
      ];
    }
  } else if (zone === 'dungeon_3') {
    if (kind === 0) {
      rows = [
        '.YYYYYY.',
        'YYkkkkYY',
        'YkYYYYkY',
        'YkYwwYkY',
        'YkYYYYkY',
        'YYkkkkYY',
        '.YkkkkY.',
        '..YYYY..',
      ];
    } else if (kind === 1) {
      rows = [
        'ZYYYYYZ',
        'YXkkkXY',
        'YXYwYXY',
        'YXkkkXY',
        'YXXXXXY',
        'YYYYYYY',
      ];
    } else if (kind === 2) {
      rows = [
        '.YYY.',
        'YkwkY',
        'YkkkY',
        'YkykY',
        '.YYY.',
      ];
    } else {
      rows = [
        '..Y..',
        '.YkY.',
        'YkkkY',
        'YkYkY',
        'YkkkY',
        '.YYY.',
      ];
    }
  } else if (kind === 0) {
    const glow = f ? 'F' : 'f';
    rows = [
      '.JJJJJJ.',
      'JJooooJJ',
      `JJ${glow}${glow}${glow}${glow}JJ`,
      'JJllllJJ',
      'JJLLLLJJ',
      'JJJJJJJJ',
      '.JJJJJJ.',
    ];
  } else if (kind === 1) {
    rows = [
      'CJJJJC',
      'JllllJ',
      `Jf${f ? 'F' : 'f'}LfJ`,
      'JLLLLJ',
      'CJJJJC',
    ];
  } else if (kind === 2) {
    rows = [
      '.L.L.',
      'LfLfL',
      `fF${f ? 'F' : 'f'}Ff`,
      'LlLlL',
      '.L.L.',
    ];
  } else {
    rows = [
      'J.J.J',
      'JjJjJ',
      'J.J.J',
      'JjJjJ',
      'J.J.J',
    ];
  }
  return pick(key, rows);
}

export const THEME_SKY: Record<ThemeId, [string, string, string]> = {
  dungeon_1: ['#243326', '#3d5340', '#5a7348'],
  dungeon_2: ['#15222c', '#2a4454', '#4d7388'],
  dungeon_3: ['#2c2114', '#5a4320', '#8a6a32'],
  dungeon_4: ['#1a0e0c', '#3d1a14', '#6a2a18'],
};

export const THEME_FLOOR: Record<ThemeId, [string, string, string, string]> = {
  dungeon_1: ['#8aa464', '#6b8a4c', '#4e6638', '#384a27'],
  dungeon_2: ['#9fc4ce', '#6a93a0', '#3f6574', '#2d434d'],
  dungeon_3: ['#e0c56a', '#c4a048', '#8a6a28', '#5c4318'],
  dungeon_4: ['#7a3a2c', '#5c1d1c', '#3a2a22', '#271c19'],
};

export const THEME_PARTICLE: Record<ThemeId, string[]> = {
  dungeon_1: ['#cfe3c0', '#a5bd7e', '#d6cbb9'],
  dungeon_2: ['#d9f0f5', '#8fb3bf', '#f5efe6'],
  dungeon_3: ['#f2d675', '#efe0a8', '#d6cbb9'],
  dungeon_4: ['#fae078', '#e38a3b', '#e06c62'],
};
