/** Kenney 16×16 스프라이트 시트 로더. 쿼터뷰 바닥은 탑다운 타일을 2:1로 투영한다. */

export type SheetId = 'indoor' | 'rpg' | 'caves' | 'chars' | 'tiny' | 'ui';

const BASE = `${import.meta.env.BASE_URL}art/kenney`;

const SHEETS: Record<SheetId, { src: string; tw: number; margin: number }> = {
  indoor: { src: `${BASE}/indoor/roguelikeIndoor_transparent.png`, tw: 16, margin: 1 },
  rpg: { src: `${BASE}/rpg/roguelikeSheet_transparent.png`, tw: 16, margin: 1 },
  caves: { src: `${BASE}/caves/roguelikeDungeon_transparent.png`, tw: 16, margin: 1 },
  chars: { src: `${BASE}/characters/roguelikeChar_transparent.png`, tw: 16, margin: 1 },
  tiny: { src: `${BASE}/tiny-dungeon/tilemap_packed.png`, tw: 16, margin: 0 },
  ui: { src: `${BASE}/ui/UIpackSheet_transparent.png`, tw: 16, margin: 2 },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`스프라이트 로드 실패: ${src}`));
    img.src = src;
  });
}


function copyCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0);
  return c;
}

/** 탑다운 픽셀을 2:1 아이소 다이아몬드로 투영 (scale=1 → 16px 타일은 32×16). */
export function projectTopDownToIso(src: HTMLCanvasElement, scale = 1): HTMLCanvasElement {
  const sw = src.width;
  const sh = src.height;
  const sctx = src.getContext('2d')!;
  const srcData = sctx.getImageData(0, 0, sw, sh).data;
  const dw = (sw + sh) * scale;
  const dh = Math.floor((sw + sh) * scale / 2) + scale;
  const out = document.createElement('canvas');
  out.width = dw;
  out.height = dh;
  const octx = out.getContext('2d')!;
  const dest = octx.createImageData(dw, dh);
  const dd = dest.data;
  const set = (x: number, y: number, r: number, g: number, b: number, a: number) => {
    if (x < 0 || y < 0 || x >= dw || y >= dh) return;
    const i = (y * dw + x) * 4;
    // later pixels (higher sy) win, good for depth
    dd[i] = r; dd[i + 1] = g; dd[i + 2] = b; dd[i + 3] = a;
  };
  for (let sy = 0; sy < sh; sy++) {
    for (let sx = 0; sx < sw; sx++) {
      const i = (sy * sw + sx) * 4;
      const a = srcData[i + 3];
      if (a === 0) continue;
      const r = srcData[i], g = srcData[i + 1], b = srcData[i + 2];
      const dx = (sx - sy) * scale + sh * scale;
      const dy = Math.floor((sx + sy) * scale / 2);
      for (let oy = 0; oy < scale; oy++) {
        for (let ox = 0; ox < scale; ox++) {
          set(dx + ox, dy + oy, r, g, b, a);
          if (scale === 1) set(dx + ox + 1, dy + oy, r, g, b, a);
        }
      }
    }
  }
  octx.putImageData(dest, 0, 0);
  return out;
}

function flipH(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(c.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

function tintShift(src: HTMLCanvasElement, hueRotate = 0, sat = 1, light = 1): HTMLCanvasElement {
  const c = copyCanvas(src);
  if (hueRotate === 0 && sat === 1 && light === 1) return c;
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const diff = max - min;
    if (diff > 0.0001) {
      s = diff / (1 - Math.abs(2 * l - 1));
      if (max === r) h = ((g - b) / diff) % 6;
      else if (max === g) h = (b - r) / diff + 2;
      else h = (r - g) / diff + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    h = (h + hueRotate) % 360;
    if (h < 0) h += 360;
    s = Math.max(0, Math.min(1, s * sat));
    const ll = Math.max(0, Math.min(1, l * light));
    const c1 = (1 - Math.abs(2 * ll - 1)) * s;
    const x = c1 * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = ll - c1 / 2;
    let r1 = 0, g1 = 0, b1 = 0;
    if (h < 60) { r1 = c1; g1 = x; }
    else if (h < 120) { r1 = x; g1 = c1; }
    else if (h < 180) { g1 = c1; b1 = x; }
    else if (h < 240) { g1 = x; b1 = c1; }
    else if (h < 300) { r1 = x; b1 = c1; }
    else { r1 = c1; b1 = x; }
    d[i] = Math.round((r1 + m) * 255);
    d[i + 1] = Math.round((g1 + m) * 255);
    d[i + 2] = Math.round((b1 + m) * 255);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export class ArtAtlas {
  public ready = false;
  private images = new Map<SheetId, HTMLImageElement>();
  private sliceCache = new Map<string, HTMLCanvasElement>();
  private isoCache = new Map<string, HTMLCanvasElement>();

  public async load(): Promise<void> {
    const entries = Object.entries(SHEETS) as [SheetId, (typeof SHEETS)[SheetId]][];
    const loaded = await Promise.all(entries.map(async ([id, spec]) => {
      const img = await loadImage(spec.src);
      return [id, img] as const;
    }));
    for (const [id, img] of loaded) this.images.set(id, img);
    this.ready = true;
  }

  public slice(sheet: SheetId, col: number, row: number, w = 1, h = 1): HTMLCanvasElement {
    const key = `${sheet}:${col},${row},${w}x${h}`;
    const hit = this.sliceCache.get(key);
    if (hit) return hit;
    const spec = SHEETS[sheet];
    const img = this.images.get(sheet);
    if (!img) throw new Error('아트가 아직 로드되지 않았습니다');
    const step = spec.tw + spec.margin;
    const c = document.createElement('canvas');
    const pw = w * spec.tw + (w - 1) * spec.margin;
    const ph = h * spec.tw + (h - 1) * spec.margin;
    c.width = pw;
    c.height = ph;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, col * step, row * step, pw, ph, 0, 0, pw, ph);
    this.sliceCache.set(key, c);
    return c;
  }

  public iso(sheet: SheetId, col: number, row: number, w = 1, h = 1): HTMLCanvasElement {
    const key = `iso:${sheet}:${col},${row},${w}x${h}`;
    const hit = this.isoCache.get(key);
    if (hit) return hit;
    const projected = projectTopDownToIso(this.slice(sheet, col, row, w, h), 1);
    this.isoCache.set(key, projected);
    return projected;
  }

  public character(kind: string, facing: 'nw' | 'ne' | 'sw' | 'se' | string, frame = 0): HTMLCanvasElement {
    const key = `char:${kind}:${facing}:${frame}`;
    const hit = this.sliceCache.get(key);
    if (hit) return hit;
    const [sheet, c, r, hue] = this.charTile(kind);
    let spr = this.slice(sheet, c, r);
    if (hue) spr = tintShift(spr, hue, 1, 1);
    // walk bob is applied by the renderer; here we only flip for west-facing
    if (facing === 'nw' || facing === 'sw') spr = flipH(spr);
    // subtle 2-frame: nudge a copy 1px down on odd frames via a padded canvas
    if (frame & 1) {
      const padded = document.createElement('canvas');
      padded.width = spr.width;
      padded.height = spr.height + 1;
      const ctx = padded.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(spr, 0, 1);
      spr = padded;
    }
    this.sliceCache.set(key, spr);
    return spr;
  }

  private charTile(kind: string): [SheetId, number, number, number] {
    // Tiny Dungeon packed sheet (0 margin): complete 16×16 people & staff
    const map: Record<string, [SheetId, number, number, number]> = {
      mage: ['tiny', 0, 7, 0],
      chef: ['tiny', 2, 7, 0],
      forger: ['tiny', 1, 7, 20],
      enhancer: ['tiny', 1, 7, 0],
      enchanter: ['tiny', 4, 8, 40],
      alchemist: ['tiny', 4, 9, 120],
      knight: ['tiny', 0, 8, 0],
      warrior: ['tiny', 2, 8, 0],
      archer: ['tiny', 3, 8, 0],
      rogue: ['tiny', 2, 8, 0],
      priest: ['tiny', 4, 8, 0],
      guest: ['tiny', 4, 7, 0],
    };
    return map[kind] || ['tiny', 1, 8, 0];
  }

  public monster(zone: string, boss: boolean, _state: string, frame = 0): HTMLCanvasElement {
    const key = `mon:${zone}:${boss}:${_state}:${frame}`;
    const hit = this.sliceCache.get(key);
    if (hit) return hit;
    let col = 0, row = 10, hue = 0, sat = 1, light = 1;
    if (zone === 'dungeon_1') {
      if (boss) { col = 3; row = 10; hue = 35; sat = 1.15; } // 돌얼굴 → 버섯골렘
      else { col = 0; row = 10; hue = 70; sat = 1.1; } // 딱정벌레를 숲 톤으로
    } else if (zone === 'dungeon_2') {
      if (boss) { col = 1; row = 9; hue = 180; sat = 0.85; light = 1.1; }
      else { col = 3; row = 9; hue = 200; sat = 0.8; light = 1.15; }
    } else if (zone === 'dungeon_3') {
      if (boss) { col = 1; row = 10; hue = 40; sat = 1.2; light = 1.08; }
      else { col = 1; row = 10; hue = 0; }
    } else {
      if (boss) { col = 2; row = 9; hue = 0; sat = 1.15; }
      else { col = 2; row = 9; hue = -8; sat = 1.05; light = 0.95; }
    }
    let spr = this.slice('tiny', col, row);
    if (hue || sat !== 1 || light !== 1) spr = tintShift(spr, hue, sat, light);
    this.sliceCache.set(key, spr);
    return spr;
  }
  public tint(src: HTMLCanvasElement, hue = 0, sat = 1, light = 1): HTMLCanvasElement {
    return tintShift(src, hue, sat, light);
  }

  public isoTint(
    sheet: SheetId, col: number, row: number, w = 1, h = 1,
    hue = 0, sat = 1, light = 1
  ): HTMLCanvasElement {
    const key = `isoT:${sheet}:${col},${row},${w}x${h}:${hue}:${sat}:${light}`;
    const hit = this.isoCache.get(key);
    if (hit) return hit;
    const out = tintShift(this.iso(sheet, col, row, w, h), hue, sat, light);
    this.isoCache.set(key, out);
    return out;
  }

}

let singleton: ArtAtlas | null = null;

export function getArt(): ArtAtlas | null {
  return singleton && singleton.ready ? singleton : null;
}

export async function loadArt(): Promise<ArtAtlas> {
  if (singleton?.ready) return singleton;
  const atlas = new ArtAtlas();
  await atlas.load();
  singleton = atlas;
  return atlas;
}
