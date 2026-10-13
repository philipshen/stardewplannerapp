/**
 * Pixel-art kit for hand-designed sprites.
 *
 * Sprites are drawn at their real size: 16 px per tile, never scaled. Two ways to draw:
 *  - stamp(): place a hand-drawn ASCII pixel grid with a palette (best for small, iconic items)
 *  - Img primitives from ../png (rect, line, ellipse, px) plus the helpers below (best for big or varied items)
 *
 * House style (keep every category consistent):
 *  - Light comes from the top-left. Highlights sit top-left, shadows bottom-right.
 *  - 1 px outline in a dark, warm color taken from the object (never pure black). Use OUTLINE or a darker ramp step.
 *  - 3 to 5 tones per material with a hue shift: shadows lean cool/purple, lights lean warm/yellow. Use tones().
 *  - Chunky, readable silhouettes. No gradients, no anti-aliasing, no single stray pixels of noise.
 *  - A soft drop shadow on the ground under free-standing objects (groundShadow()).
 */
import { hex, Img, RGBA } from '../png';
import type { Ctx, Painter, Season } from '../painters';

export type { Ctx, Painter, Season };
export { hex, Img };
export type { RGBA };

export const OUTLINE: RGBA = hex('#2b1b24');
export const SHADOW: RGBA = [24, 14, 22, 72];
export const CLEAR: RGBA = [0, 0, 0, 0];

function toHsl([r, g, b]: RGBA): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h: number, s: number, l: number): RGBA {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255), 255];
}

/**
 * Hue-shifted tone ramp from one base color: [outline, shadow, mid-shadow, base, light, highlight].
 * Shadows shift toward blue-purple and lose lightness; lights shift toward yellow.
 */
export type Tones = [RGBA, RGBA, RGBA, RGBA, RGBA, RGBA];
export function tones(base: string | RGBA): Tones {
  const [h, s, l] = toHsl(typeof base === 'string' ? hex(base) : base);
  // Move the hue toward 260 (cool) for shadows and toward 55 (warm) for lights, along the short arc.
  const toward = (target: number, amt: number) => { let d = ((target - h + 540) % 360) - 180; return h + d * amt; };
  return [
    fromHsl(toward(265, 0.28), Math.min(1, s * 0.9 + 0.08), l * 0.26),
    fromHsl(toward(265, 0.18), Math.min(1, s * 1.05), l * 0.52),
    fromHsl(toward(265, 0.09), Math.min(1, s * 1.02), l * 0.76),
    fromHsl(h, s, l),
    fromHsl(toward(55, 0.1), s * 0.95, l + (1 - l) * 0.28),
    fromHsl(toward(55, 0.18), s * 0.8, l + (1 - l) * 0.58),
  ];
}

/** Palette for stamp(): each key is one character of the ASCII grid. '.' and ' ' are always transparent. */
export type Pal = Record<string, string | RGBA>;

/**
 * Builds a palette from named materials. Each material gets 5 characters: a letter and the digits you list.
 * Example: pal({ w: '#a8743e' }) gives  w0 outline, w1 shadow ... but grids use ONE char per pixel, so use
 * palFrom() below for the common case.
 */
export function palFrom(spec: Record<string, string | RGBA>): Pal {
  return { ...spec };
}

/**
 * Palette where a material's 6 tones map to 6 characters.
 * tonePal({ abcdef: '#a8743e', ghijkl: '#5aa83a' }) -> a = outline tone ... f = highlight of wood; g..l for green.
 */
export function tonePal(spec: Record<string, string | RGBA>, extra: Pal = {}): Pal {
  const out: Pal = { ...extra };
  for (const [chars, base] of Object.entries(spec)) {
    const t = tones(base);
    [...chars].forEach((ch, i) => { if (t[i]) out[ch] = t[i]; });
  }
  return out;
}

/** Stamps an ASCII pixel grid at (x, y). Returns the grid size. Unknown characters throw, so typos are caught. */
export function stamp(img: Img, x: number, y: number, rows: string[], pal: Pal, flipX = false): { w: number; h: number } {
  const w = Math.max(...rows.map((r) => r.length));
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.' || ch === ' ') continue;
      const c = pal[ch];
      if (c === undefined) throw new Error(`stamp: no palette entry for "${ch}" in row ${j}: ${row}`);
      img.px(x + (flipX ? w - 1 - i : i), y + j, typeof c === 'string' ? hex(c) : c);
    }
  });
  return { w, h: rows.length };
}

/** Stamps a grid so that its bottom edge sits on the bottom of the box and it is centered horizontally. */
export function stampBottom(img: Img, x: number, y: number, w: number, h: number, rows: string[], pal: Pal, lift = 0) {
  const gw = Math.max(...rows.map((r) => r.length));
  stamp(img, x + Math.floor((w - gw) / 2), y + h - rows.length - lift, rows, pal);
}

/** Soft oval shadow on the ground. (cx, cy) is the center; draw it BEFORE the object. */
export function groundShadow(img: Img, cx: number, cy: number, rx: number, ry = 2) {
  img.ellipse(cx, cy, rx, ry, SHADOW);
}

/** 1 px outline around everything opaque inside the box, in the given color. Call it AFTER drawing the body. */
export function outline(img: Img, x: number, y: number, w: number, h: number, color: RGBA = OUTLINE) {
  img.outline(color, x, y, w, h);
}

/** Filled rectangle with tone shading: light top/left edge, dark bottom/right edge. */
export function slab(img: Img, x: number, y: number, w: number, h: number, t: Tones, line = true) {
  img.rect(x, y, w, h, t[3]);
  img.hline(x, y, w, t[4]); img.vline(x, y, h, t[4]);
  img.hline(x, y + h - 1, w, t[2]); img.vline(x + w - 1, y, h, t[2]);
  if (line) { img.hline(x, y - 1, w, t[0]); img.hline(x, y + h, w, t[0]); img.vline(x - 1, y, h, t[0]); img.vline(x + w, y, h, t[0]); }
}

/** Shaded ball / rounded body. */
export function ball(img: Img, cx: number, cy: number, rx: number, ry: number, t: Tones) {
  img.ellipse(cx, cy, rx, ry, t[1]);
  img.ellipse(cx - rx * 0.12, cy - ry * 0.14, rx * 0.86, ry * 0.84, t[3]);
  img.ellipse(cx - rx * 0.3, cy - ry * 0.34, rx * 0.45, ry * 0.4, t[4]);
  if (rx >= 3) img.px(Math.round(cx - rx * 0.45), Math.round(cy - ry * 0.5), t[5]);
}

/** Ordered 2x2 dither test, for texture such as soil or stone. */
export const dither = (x: number, y: number) => ((x + y) & 1) === 0;

/** Deterministic per-pixel hash in [0, 1). */
export function hash(x: number, y: number, seed = 0) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Leaf colors for a season. */
export function leafTones(season: Season, kind: 'broad' | 'pine' | 'crop' = 'broad'): Tones {
  if (kind === 'pine') return tones(season === 'winter' ? '#3f7168' : '#2f7a45');
  if (kind === 'crop') return tones(season === 'winter' ? '#5f9a78' : '#4aa63e');
  return tones({ spring: '#58b146', summer: '#3f9a3c', fall: '#d9822b', winter: '#9fb7c4' }[season]);
}
