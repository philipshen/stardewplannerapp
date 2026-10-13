/** Hand-designed world sprites: furniture. */
import { hash, hex, Img, OUTLINE, SHADOW, stamp, tones } from './kit';
import type { Painter, Pal, RGBA, Tones } from './kit';

/** Painters by item kind. They draw at real size into the box (x, y, w, h). */
export const painters: Record<string, Painter> = {};

/** Pixels that a kind rises above its footprint (the sprite box is footprint height + rise). */
export const rise: Record<string, number> = {
  chair: 10, bench: 8, couch: 10, armchair: 10, table: 8, teatable: 4, endtable: 14, bookcase: 24, dresser: 16,
  lamp: 20, bed: 8, fireplace: 24, fishtank: 24, tv: 12, houseplant: 16, piano: 16, catalogue: 12,
  rug: 0, painting: 0, walldecor: 0,
};

// ------------------------------------------------------------------ core helpers

const memo = new Map<string, Tones>();
/** Cached tone ramp. */
function T(col: string): Tones {
  let t = memo.get(col);
  if (!t) { t = tones(col); memo.set(col, t); }
  return t;
}
const GOLD = T('#e6b93e'), STEEL = T('#a9b2bf'), WHITE = T('#e9e3d6'), CHROME = T('#c3ccd6'), GLASS = T('#8fcfea');
const RED = T('#cf463f'), GREEN = T('#4fa651'), LEAF = T('#49a548'), CLAY = T('#c26a3f'), PAPER = T('#efe6cf');
const DARKW = T('#6b4530'), BLACK = T('#4a4350'), NAVY = T('#2c3a6e');
const INK: RGBA = hex('#2b1b24');

type Draw = (g: Img) => void;
/** Draws into a private canvas, adds the outline and the ground shadow, then copies it to the atlas box. */
function sprite(img: Img, x: number, y: number, w: number, h: number, draw: Draw, o: { shadow?: boolean; line?: RGBA; post?: Draw } = {}) {
  const g = new Img(w, h);
  draw(g);
  g.outline(o.line ?? OUTLINE);
  o.post?.(g);
  const s = new Img(w, h);
  if (o.shadow !== false) {
    let x0 = w, x1 = -1;
    for (let j = h - 4; j < h; j++) for (let i = 0; i < w; i++) if (g.alpha(i, j) > 200) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); }
    if (x1 >= 0) s.ellipse((x0 + x1 + 1) / 2, h - 2.5, (x1 - x0) / 2 + 1.5, 2.5, SHADOW);
  }
  s.blit(g, 0, 0);
  img.blit(s, x, y);
}

/** Rounded rectangle (corner radius r, cut corners). */
function rr(g: Img, x: number, y: number, w: number, h: number, col: RGBA, r = 1) {
  for (let j = 0; j < h; j++) {
    const k = Math.max(0, r - j, r - (h - 1 - j));
    g.hline(x + k, y + j, w - 2 * k, col);
  }
}
/** Shaded rounded block: light on top, dark at the bottom. */
function pad(g: Img, x: number, y: number, w: number, h: number, t: Tones, r = 1) {
  rr(g, x, y, w, h, t[3], r);
  g.hline(x + r, y, w - 2 * r, t[4]);
  if (h > 3) g.hline(x + r, y + h - 1, w - 2 * r, t[2]);
  if (w > 5 && h > 3) g.px(x + r + 1, y + 1, t[5]);
}
/** Shaded flat block: light top and left, dark bottom and right. */
function blk(g: Img, x: number, y: number, w: number, h: number, t: Tones) {
  g.rect(x, y, w, h, t[3]);
  g.hline(x, y, w, t[4]);
  if (h > 2) g.hline(x, y + h - 1, w, t[2]);
  if (w > 3) g.vline(x + w - 1, y + 1, h - 1, t[2]);
}
/** Front face of a box: mid tone with a darker foot. */
function face(g: Img, x: number, y: number, w: number, h: number, t: Tones) {
  g.rect(x, y, w, h, t[2]);
  g.hline(x, y, w, t[3]);
  g.hline(x, y + h - 1, w, t[1]);
}
/** A table top seen from above with its front edge. */
function topSlab(g: Img, x: number, y: number, w: number, d: number, edge: number, t: Tones, r = 0) {
  rr(g, x, y, w, d, t[4], r);
  g.rect(x + r, y + 1, w - 2 * r, d - 1, t[3]);
  if (r) { g.rect(x, y + r, r, d - r, t[3]); g.rect(x + w - r, y + r, r, d - r, t[3]); }
  g.hline(x + 1 + r, y + 1, Math.max(2, Math.floor(w / 3)), t[5]);
  g.rect(x, y + d, w, edge, t[2]);
  g.hline(x, y + d + edge - 1, w, t[1]);
}
function leg(g: Img, x: number, y: number, w: number, h: number, t: Tones) {
  g.rect(x, y, w, h, t[3]);
  g.vline(x + w - 1, y, h, t[1]);
  if (w > 2) g.vline(x, y, h, t[4]);
}
function circle(g: Img, cx: number, cy: number, r: number, col: RGBA) { g.ellipse(cx, cy, r, r, col); }
/** Shaded disc. */
function orb(g: Img, cx: number, cy: number, r: number, t: Tones) {
  g.ellipse(cx, cy, r, r, t[2]);
  g.ellipse(cx - 0.4, cy - 0.4, r - 0.6, r - 0.6, t[3]);
  g.ellipse(cx - r * 0.3, cy - r * 0.3, r * 0.5, r * 0.5, t[4]);
  g.px(Math.floor(cx - r * 0.4), Math.floor(cy - r * 0.45), t[5]);
}

const ICONS: Record<string, string[]> = {
  star: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'],
  star5: ['..#..', '#####', '.###.', '.#.#.'],
  skull: ['.#####.', '#######', '#o###o#', '#o###o#', '###o###', '.#####.', '.#o#o#.'],
  moon: ['..###.', '.##...', '##....', '##....', '##....', '.##...', '..###.'],
  heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  anchor: ['..###..', '..#.#..', '..###..', '.#####.', '...#...', '...#...', '#..#..#', '##.#.##', '.#####.'],
  fish: ['..###...#', '.#####.##', '#o#######', '.#####.##', '..###...#'],
  joja: ['#####', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  sun: ['#..#..#', '.#...#.', '..###..', '#.###.#', '..###..', '.#...#.', '#..#..#'],
  flower: ['.#.#.', '##o##', '.ooo.', '##o##', '.#.#.'],
  bloom: ['.#.', '#o#', '.#.'],
  leaf: ['...##', '.####', '####.', '###..', 'o#...'],
  flake: ['#.#.#', '.###.', '#####', '.###.', '#.#.#'],
  diamond: ['..#..', '.###.', '#####', '.###.', '..#..'],
  eye: ['.#####.', '##ooo##', '#oo#oo#', '##ooo##', '.#####.'],
  swirl: ['.#####.', '#.....#', '#.###.#', '#.#.#.#', '#.#...#', '#.####.', '#......'],
  rune1: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  rune2: ['###', '#..', '##.', '#..', '#..'],
  rune3: ['.#.', '###', '.#.', '#.#', '#.#'],
  rune4: ['#..', '##.', '#.#', '##.', '#..'],
  palm: ['.##.##.', '#.###.#', '..###..', '.#.#.#.', '...#...', '...#...', '..##...'],
  tree: ['..###..', '.#####.', '#######', '#######', '.#####.', '...o...', '...o...'],
  drop: ['..#..', '.###.', '#####', '#####', '.###.'],
  bone: ['##.....##', '#########', '##.....##'],
  paw: ['.#.#.', '#.#.#', '.###.', '#####', '.###.'],
  cup: ['####.', '#####', '####.', '.##..'],
  note: ['..##', '..#.', '..#.', '###.', '###.'],
  bolt: ['..##', '.##.', '####', '.##.', '##..'],
  crown: ['#.#.#', '#####', '#####'],
  berry: ['.ooo.', '#####', '#####', '.###.', '..#..'],
  cross: ['.#.', '###', '.#.'],
};
/** Stamps a small one-color symbol, centered on (cx, cy). 'o' pixels use the second color. */
function icon(g: Img, key: string, cx: number, cy: number, col: RGBA, col2: RGBA = INK) {
  const rows = ICONS[key];
  const w = rows[0].length;
  stamp(g, Math.round(cx - w / 2), Math.round(cy - rows.length / 2), rows, { '#': col, o: col2 });
}

const FLAME: Pal = { o: '#e8622a', y: '#f9b93c', Y: '#fff0a0', W: '#ffffff', r: '#b93a2a' };
const FLAMES: Record<string, string[]> = {
  s: ['.o.', 'oyo', 'oYo', '.y.'],
  m: ['..o..', '..oo.', '.oyo.', 'oyYyo', 'oyYyo', '.oyo.'],
  l: ['...o....', '..oo....', '..oyo.o.', '.oyyo.oo', 'ooyYyoyo', 'oyYYyyyo', 'oyYWYYyo', '.oyYYyo.'],
};
/** Flame with its bottom center at (cx, by). pal can recolor it (magic fire). */
function flame(g: Img, size: 's' | 'm' | 'l', cx: number, by: number, pal: Pal = FLAME) {
  const rows = FLAMES[size];
  stamp(g, Math.round(cx - rows[0].length / 2), by - rows.length + 1, rows, pal);
}
const MAGIC: Pal = { o: '#3a9a8a', y: '#6fe0b0', Y: '#d8ffe8', W: '#ffffff', r: '#2a6a7a' };
const BLUEFIRE: Pal = { o: '#3a6ad0', y: '#6fc0f0', Y: '#d8f4ff', W: '#ffffff', r: '#2a3a9a' };

type Mat = { key: string; wood: Tones; cloth: Tones; trim: Tones };
const MATS: [RegExp, string, string, string, string][] = [
  [/gray joja/i, 'grayjoja', '#8d95a8', '#3f6fd2', '#e8eef8'],
  [/joja|j\. /i, 'joja', '#3f6fd2', '#e6ecf7', '#f04a3a'],
  [/junimo/i, 'junimo', '#62b04c', '#f4d44c', '#8a5a34'],
  [/wizard|mystic|diviner|rune|witch/i, 'wizard', '#70509f', '#3f7fd0', '#f0c84a'],
  [/retro|groovy|funky/i, 'retro', '#e2853c', '#3aa79f', '#f6e7b8'],
  [/desert|sandy/i, 'desert', '#d8b274', '#c9563c', '#4aa39a'],
  [/pirate/i, 'pirate', '#5b3b2e', '#8a2f2f', '#e8e0c8'],
  [/tropical|luau|exotic|jungle/i, 'tropical', '#d9b55c', '#e8554a', '#3fae5a'],
  [/dark|midnight|monster/i, 'dark', '#4b4058', '#7c4eb0', '#b9a6d8'],
  [/candy|cute|strawberry/i, 'candy', '#f08fb9', '#fff1f6', '#e8506a'],
  [/crystal/i, 'crystal', '#8fd2f2', '#d8f2ff', '#ffffff'],
  [/stone|neolithic/i, 'stone', '#9b968d', '#7d8a70', '#c9c4b8'],
  [/winter|icy|snowy|frozen/i, 'winter', '#bfe1ef', '#5f90d2', '#ffffff'],
  [/modern|metal|plasma/i, 'modern', '#c5cbd4', '#4b5669', '#e8504a'],
  [/oak/i, 'oak', '#c68b46', '#b9483e', '#f0d9a0'],
  [/walnut/i, 'walnut', '#7b4b2f', '#3f7f70', '#e6cf9a'],
  [/birch/i, 'birch', '#e4ca9c', '#6fa0d2', '#ffffff'],
  [/mahogany/i, 'mahogany', '#a3462f', '#d9b55c', '#f0e0b0'],
  [/luxury|elegant|deluxe|ornate|king/i, 'luxury', '#8a3f3a', '#b02f3a', '#e6b93e'],
];
function mat(name: string): Mat {
  for (const [re, key, a, b, c] of MATS) if (re.test(name)) return { key, wood: T(a), cloth: T(b), trim: T(c) };
  return { key: 'plain', wood: T('#b37c46'), cloth: T('#c0524a'), trim: T('#f0d9a0') };
}
const COLORS: [RegExp, string][] = [
  [/blue/i, '#4f7fd6'], [/red/i, '#cf463f'], [/light green/i, '#9fd487'], [/green/i, '#4fa651'], [/yellow/i, '#e9c040'],
  [/pink/i, '#ee8fb6'], [/purple/i, '#8a5cc2'], [/orange/i, '#e8873a'], [/brown/i, '#9a6a42'], [/black/i, '#4a4350'],
  [/gr[ae]y/i, '#8f96a3'],
];
function colorOf(name: string, d: string): Tones {
  for (const [re, col] of COLORS) if (re.test(name)) return T(col);
  return T(d);
}
/** Stable small integer from a name, for picking a variant. */
function pick(name: string, n: number) {
  let s = 7;
  for (let i = 0; i < name.length; i++) s = (s * 31 + name.charCodeAt(i)) >>> 0;
  return s % n;
}

// ------------------------------------------------------------------ chair

/** Front-facing wooden chair in a 16 px wide box. `back` picks the backrest design. */
function chairWood(g: Img, h: number, t: Tones, o: { back: string; top?: number; cush?: Tones; deco?: Draw }) {
  const b = h - 2, sy = b - 10, top = o.top ?? 4, bh = sy - top;
  const dark = t[1];
  switch (o.back) {
    case 'slats':
      g.rect(5, top, 6, bh, dark); g.vline(6, top, bh, t[3]); g.vline(9, top, bh, t[3]);
      blk(g, 3, top, 10, 3, t);
      break;
    case 'ladder':
      g.rect(5, top, 6, bh, dark);
      for (let j = top; j < sy - 1; j += 4) { g.hline(5, j, 6, t[4]); g.hline(5, j + 1, 6, t[2]); }
      break;
    case 'cross':
      g.rect(5, top, 6, bh, dark);
      for (let i = 0; i < 6; i++) { const j = top + 1 + Math.round(i * (bh - 3) / 5); g.px(5 + i, j, t[4]); g.px(10 - i, j, t[3]); }
      blk(g, 3, top, 10, 2, t);
      break;
    case 'spindle':
      g.rect(5, top + 1, 6, bh - 1, dark); g.vline(5, top + 2, bh, t[3]); g.vline(7, top + 2, bh, t[3]); g.vline(9, top + 2, bh, t[3]);
      rr(g, 3, top, 10, 3, t[3], 1); g.hline(4, top, 8, t[4]);
      break;
    case 'round':
      rr(g, 3, top, 10, bh, t[3], 3); g.hline(6, top, 4, t[4]); g.rect(4, top + 3, 1, bh - 3, t[4]);
      break;
    case 'point':
      for (let j = 0; j < bh; j++) { const k = Math.max(0, 4 - j); g.hline(3 + k, top + j, 10 - 2 * k, j < 2 ? t[4] : t[3]); }
      break;
    case 'padded':
      blk(g, 3, top, 10, bh, t);
      if (o.cush) { pad(g, 5, top + 2, 6, bh - 3, o.cush, 1); }
      break;
    default: // panel
      blk(g, 3, top, 10, bh, t); g.rect(5, top + 2, 6, bh - 4, t[2]); g.hline(5, top + 2, 6, t[1]);
  }
  if (o.back !== 'round' && o.back !== 'point' && o.back !== 'padded' && o.back !== 'panel') {
    g.rect(3, top, 2, bh, t[3]); g.vline(3, top, bh, t[4]);
    g.rect(11, top, 2, bh, t[3]); g.vline(12, top, bh, t[2]);
  }
  // seat, front edge, legs
  g.rect(2, sy, 12, 4, t[3]); g.hline(2, sy, 12, t[4]);
  if (o.cush) { g.rect(3, sy, 10, 3, o.cush[3]); g.hline(3, sy, 10, o.cush[4]); g.hline(3, sy + 2, 10, o.cush[2]); g.px(4, sy + 1, o.cush[5]); }
  g.hline(2, sy + 4, 12, t[2]); g.hline(2, sy + 5, 12, t[1]);
  leg(g, 2, sy + 6, 2, 5, t); leg(g, 12, sy + 6, 2, 5, t);
  g.vline(5, sy + 6, 3, t[1]); g.vline(10, sy + 6, 3, t[1]);
  o.deco?.(g);
}

function floorCushion(g: Img, h: number, t: Tones, style: number, deco?: Draw) {
  const b = h - 2;
  if (style === 1) { // round
    g.ellipse(8, b - 3.5, 6.5, 4.5, t[1]); g.ellipse(8, b - 5, 6.5, 4, t[3]); g.ellipse(7, b - 6, 4, 2, t[4]);
    g.px(5, b - 7, t[5]);
  } else {
    rr(g, 2, b - 8, 12, 9, t[1], 2); rr(g, 2, b - 9, 12, 8, t[3], 2); g.hline(4, b - 9, 8, t[4]); g.hline(3, b - 8, 3, t[5]);
    g.hline(4, b - 2, 8, t[2]);
  }
  deco?.(g);
}

function stool(g: Img, h: number, seat: Tones, legT: Tones, o: { kind?: 'legs' | 'post' | 'tulip' | 'office' | 'trunk'; high?: number; deco?: Draw } = {}) {
  const b = h - 2, sy = b - (o.high ?? 10);
  const kind = o.kind ?? 'legs';
  if (kind === 'legs') {
    for (let j = sy + 3; j <= b; j++) { const k = Math.round((j - sy - 3) / 4); g.rect(4 - k, j, 2, 1, legT[3]); g.px(5 - k, j, legT[1]); g.rect(10 + k, j, 2, 1, legT[3]); g.px(11 + k, j, legT[1]); }
    g.vline(7, sy + 3, b - sy - 4, legT[1]); g.vline(8, sy + 3, b - sy - 4, legT[1]);
    g.hline(4, b - 3, 8, legT[2]);
  } else if (kind === 'post') {
    g.rect(7, sy + 3, 2, b - sy - 4, legT[3]); g.vline(8, sy + 3, b - sy - 4, legT[1]);
    g.ellipse(8, b - 0.5, 5, 1.6, legT[2]); g.hline(4, b - 1, 8, legT[4]);
  } else if (kind === 'tulip') {
    for (let j = sy + 3; j <= b; j++) { const f = (j - sy - 3) / (b - sy - 3); const k = Math.round(1 + f * f * 4); g.hline(8 - k, j, 2 * k, legT[3]); g.px(8 - k, j, legT[4]); g.px(7 + k, j, legT[1]); }
  } else if (kind === 'office') {
    g.rect(7, sy + 3, 2, b - sy - 5, legT[3]); g.vline(8, sy + 3, b - sy - 5, legT[1]);
    g.hline(3, b - 2, 10, legT[3]); g.hline(3, b - 1, 10, legT[1]);
    for (const xx of [3, 7, 11]) { g.rect(xx, b - 1, 2, 2, INK); }
  } else {
    g.rect(4, sy + 3, 8, b - sy - 2, legT[3]); g.vline(4, sy + 3, b - sy - 2, legT[4]); g.rect(10, sy + 3, 2, b - sy - 2, legT[1]);
    g.vline(7, sy + 5, 3, legT[2]); g.px(3, b, legT[2]); g.px(12, b, legT[1]);
  }
  g.ellipse(8, sy + 2, 6, 2.6, seat[1]);
  g.ellipse(8, sy + 0.8, 6, 2.6, seat[3]);
  g.ellipse(7, sy + 0.2, 3.6, 1.2, seat[4]);
  g.px(5, sy, seat[5]);
  o.deco?.(g);
}

painters.chair = (img, x, y, w, h, c) => {
  const n = c.name, m = mat(n), b = h - 2;
  let post: Draw | undefined;
  sprite(img, x, y, w, h, (g) => {
    if (/Cushion/.test(n)) {
      const t = /Dark/.test(n) ? T(m.key === 'junimo' ? '#35603a' : m.key === 'retro' ? '#8a4a3a' : '#3f3463') : /Gray Joja/.test(n) ? T('#8d95a8') : m.key !== 'plain' ? m.wood : colorOf(n, '#c0524a');
      const tr = m.key === 'plain' ? GOLD : m.trim;
      const style = m.key !== 'plain' ? 0 : pick(n, 2);
      floorCushion(g, h, t, /Retro|Red|Green/.test(n) ? 1 : style, (g) => {
        if (/Junimo/.test(n)) icon(g, 'star5', 8, b - 5, m.cloth[4]);
        else if (/Joja/.test(n)) { g.rect(6, b - 7, 4, 1, WHITE[5]); g.rect(8, b - 7, 1, 4, WHITE[5]); g.px(7, b - 4, WHITE[5]); g.px(6, b - 5, WHITE[5]); }
        else if (/Wizard/.test(n)) { icon(g, 'moon', 8, b - 5, GOLD[4]); for (const xx of [2, 13]) g.px(xx, b - 1, GOLD[3]); }
        else if (/Retro/.test(n)) { g.ellipse(8, b - 5, 4, 2.4, m.cloth[3]); g.ellipse(8, b - 5, 2, 1.2, m.trim[3]); }
        else if (/Black/.test(n)) { g.px(8, b - 5, GOLD[4]); for (const xx of [2, 13]) { g.px(xx, b - 1, GOLD[3]); g.px(xx, b - 8, GOLD[3]); } }
        else if (/Blue/.test(n)) { for (let i = 4; i < 12; i += 2) g.vline(i, b - 8, 6, t[4]); }
        else if (/Brown/.test(n)) { g.line(5, b - 7, 10, b - 3, t[1]); g.line(10, b - 7, 5, b - 3, t[1]); g.px(8, b - 5, GOLD[4]); }
        else if (/Green/.test(n)) { icon(g, 'leaf', 8, b - 5, t[5], t[1]); }
        else if (/Red/.test(n)) { g.px(8, b - 5, t[1]); g.px(7, b - 5, t[2]); g.px(9, b - 5, t[2]); g.px(8, b - 6, t[2]); g.px(8, b - 4, t[2]); }
        else { g.rect(4, b - 7, 8, 1, WHITE[5]); g.rect(4, b - 3, 8, 1, WHITE[5]); g.px(8, b - 5, t[1]); }
      });
    } else if (/Plush/.test(n)) {
      const t = colorOf(n, '#ee8fb6');
      rr(g, 2, b - 11, 12, 12, t[2], 3); rr(g, 2, b - 11, 12, 7, t[3], 3); g.hline(5, b - 11, 6, t[4]); g.hline(4, b - 10, 3, t[5]);
      g.hline(2, b - 5, 12, t[1]); g.hline(3, b - 4, 10, t[3]);
      for (const xx of [4, 8, 11]) g.vline(xx, b - 3, 3, t[1]);
      g.px(8, b - 8, t[1]); g.hline(4, b, 8, t[1]);
    } else if (/Stump/.test(n)) {
      const t = T('#8a5a34'), r = T('#e0c48a');
      g.rect(3, b - 8, 10, 9, t[3]); g.vline(3, b - 8, 9, t[4]); g.rect(10, b - 8, 3, 9, t[1]);
      for (const xx of [5, 8]) g.vline(xx, b - 6, 6, t[2]);
      g.px(2, b, t[2]); g.px(13, b, t[1]); g.px(1, b, t[2]);
      g.ellipse(8, b - 9, 5.5, 2.6, r[3]); g.ellipse(8, b - 9, 3.5, 1.4, r[2]); g.ellipse(8, b - 9, 1.6, 0.7, r[4]);
      g.px(12, b - 11, LEAF[3]); g.px(13, b - 12, LEAF[4]); g.px(12, b - 12, LEAF[2]);
    } else if (/Office/.test(n)) {
      const t = colorOf(n, '#8a5cc2');
      if (/Chair/.test(n)) {
        rr(g, 3, 2, 10, 10, t[3], 2); g.hline(5, 2, 6, t[4]); g.hline(5, 11, 6, t[2]); g.hline(4, 3, 3, t[5]);
        g.hline(5, 6, 6, t[2]); g.rect(7, 12, 2, 2, BLACK[2]);
        g.rect(1, b - 12, 2, 5, BLACK[3]); g.rect(13, b - 12, 2, 5, BLACK[2]);
      }
      stool(g, h, t, CHROME, { kind: 'office', high: /Chair/.test(n) ? 10 : 12 });
    } else if (/Stool/.test(n)) {
      if (/Joja/.test(n)) stool(g, h, m.wood, STEEL, { kind: 'post', deco: (g) => g.hline(6, b - 10, 4, WHITE[5]) });
      else if (/Junimo/.test(n)) stool(g, h, m.wood, T('#8a5a34'), { kind: 'trunk', high: 9, deco: (g) => { icon(g, 'star5', 8, b - 8, m.cloth[4]); g.px(13, b - 11, LEAF[4]); g.px(14, b - 12, LEAF[3]); } });
      else if (/Retro/.test(n)) stool(g, h, m.wood, m.trim, { kind: 'tulip', deco: (g) => g.ellipse(8, b - 9.5, 3, 1, m.cloth[3]) });
      else if (/Wizard/.test(n)) stool(g, h, m.wood, T('#3f3463'), { deco: (g) => { icon(g, 'star5', 8, b - 9, GOLD[4]); } });
      else stool(g, h, colorOf(n, '#4f7fd6'), /Green/.test(n) ? T('#e4ca9c') : T('#7b4b2f'), { high: /Green/.test(n) ? 8 : 11 });
    } else if (/Diner/.test(n)) {
      const t = colorOf(n, '#cf463f');
      g.rect(3, 6, 1, 10, CHROME[3]); g.rect(12, 6, 1, 10, CHROME[2]);
      rr(g, 3, 3, 10, 8, t[3], 2); g.hline(5, 3, 6, t[4]); g.hline(3, 6, 10, WHITE[5]); g.hline(3, 7, 10, WHITE[3]); g.hline(4, 10, 8, t[2]);
      g.rect(2, 14, 12, 3, t[3]); g.hline(2, 14, 12, t[4]); g.hline(2, 17, 12, CHROME[4]); g.hline(2, 18, 12, CHROME[2]);
      g.rect(7, 19, 2, 4, CHROME[3]); g.vline(8, 19, 4, CHROME[1]); g.hline(4, b - 1, 8, CHROME[4]); g.hline(3, b, 10, CHROME[2]);
    } else if (/Throne|King/.test(n)) {
      const dark = /Dark/.test(n);
      const f = dark ? T('#4b4058') : GOLD, cu = dark ? T('#7c4eb0') : RED;
      blk(g, 2, 3, 12, 13, f); pad(g, 4, 5, 8, 10, cu, 1);
      if (dark) { for (const xx of [2, 7, 13]) { g.vline(xx, 1, 2, f[3]); } g.px(8, 1, f[3]); g.px(8, 2, f[3]); g.px(7, 2, f[4]); icon(g, 'star5', 8, 9, T('#b9a6d8')[4]); }
      else { g.px(2, 2, f[4]); g.px(13, 2, f[3]); g.rect(6, 1, 4, 2, f[4]); g.px(7, 0, RED[4]); g.px(8, 0, RED[3]); icon(g, 'crown', 8, 8, GOLD[5]); }
      g.rect(1, 13, 3, 6, f[3]); g.vline(1, 13, 6, f[4]); g.rect(12, 13, 3, 6, f[2]); g.hline(1, 13, 3, f[5]); g.hline(12, 13, 3, f[4]);
      g.rect(3, 15, 10, 3, cu[3]); g.hline(3, 15, 10, cu[4]);
      face(g, 1, 19, 14, 3, f); leg(g, 1, 22, 3, 3, f); leg(g, 12, 22, 3, 3, f);
    } else if (/Groovy/.test(n)) {
      const t = m.wood, cu = m.cloth;
      g.ellipse(8, 10, 6.5, 7.5, t[3]); g.ellipse(7, 8, 4.5, 4.5, t[4]); g.px(4, 5, t[5]);
      g.ellipse(8, 12, 4.6, 4.6, cu[1]); g.ellipse(8, 14, 4.2, 2.6, cu[3]); g.hline(6, 13, 4, cu[4]);
      g.rect(7, 18, 2, 4, CHROME[2]); g.ellipse(8, b - 0.5, 4.5, 1.5, CHROME[3]); g.hline(5, b - 1, 5, CHROME[5]);
    } else if (/Lawn/.test(n)) {
      const t = T('#e6e9e4');
      g.rect(3, 4, 10, 10, T('#7d8a8a')[2]);
      for (let j = 4; j < 13; j += 3) { g.rect(3, j, 10, 2, t[4]); g.hline(3, j + 1, 10, t[2]); }
      g.vline(3, 4, 12, t[3]); g.vline(12, 4, 12, t[2]);
      g.rect(1, 11, 2, 2, t[4]); g.rect(13, 11, 2, 2, t[3]); g.vline(1, 13, 5, t[2]); g.vline(14, 13, 5, t[2]);
      g.rect(2, 14, 12, 4, t[4]); g.hline(2, 16, 12, t[2]); g.hline(2, 18, 12, t[2]);
      leg(g, 2, 19, 2, 6, t); leg(g, 12, 19, 2, 6, t); g.vline(5, 19, 3, t[1]); g.vline(10, 19, 3, t[1]);
    } else {
      const k = m.key;
      const cfg: Record<string, { back: string; top?: number; cush?: Tones; deco?: Draw }> = {
        oak: { back: 'slats' }, walnut: { back: 'ladder', top: 3 }, birch: { back: 'cross' }, mahogany: { back: 'padded', top: 3, cush: m.cloth },
        desert: { back: 'panel', top: 5, deco: (g) => { for (let i = 0; i < 6; i++) g.px(5 + i, 8 + (i % 2), m.cloth[3]); g.hline(5, 11, 6, m.trim[3]); } },
        crystal: { back: 'point', top: 2, deco: (g) => { g.line(8, 3, 5, 12, m.wood[5]); g.line(9, 4, 11, 12, m.wood[2]); g.px(6, 15, m.wood[5]); g.px(7, 15, m.wood[5]); } },
        winter: { back: 'round', top: 3, cush: WHITE, deco: (g) => icon(g, 'flake', 8, 8, T('#ffffff')[3], m.cloth[3]) },
        tropical: { back: 'ladder', top: 4, cush: m.cloth, deco: (g) => { g.px(6, 15, GOLD[5]); g.px(10, 15, m.trim[4]); } },
        modern: { back: 'padded', top: 5, cush: m.cloth },
        joja: { back: 'panel', top: 3, deco: (g) => { g.rect(5, 5, 6, 7, m.wood[2]); icon(g, 'joja', 8, 8.5, WHITE[5]); } },
        junimo: { back: 'round', top: 4, cush: m.cloth, deco: (g) => { icon(g, 'star5', 8, 9, m.cloth[4]); g.px(8, 2, LEAF[4]); g.px(9, 1, LEAF[3]); g.px(8, 3, LEAF[2]); g.px(7, 2, LEAF[5]); } },
        wizard: { back: 'point', top: 1, cush: T('#3f3463'), deco: (g) => { icon(g, 'star5', 8, 9, GOLD[4]); g.px(8, 4, GOLD[5]); } },
        retro: { back: 'round', top: 4, cush: m.cloth, deco: (g) => { g.rect(5, 7, 6, 2, m.cloth[3]); g.rect(5, 10, 6, 1, m.trim[3]); } },
        candy: { back: 'round', top: 3, cush: m.cloth, deco: (g) => { icon(g, 'heart', 8, 8.5, m.trim[3]); g.px(6, 7, m.cloth[3]); } },
      };
      if (/Metal/.test(n)) chairWood(g, h, STEEL, { back: 'ladder', top: 5, deco: (g) => { g.px(3, 5, STEEL[5]); g.px(12, 5, STEEL[5]); } });
      else if (/Country/.test(n)) chairWood(g, h, T('#a86a3a'), { back: 'round', top: 3, deco: (g) => { g.rect(7, 7, 2, 2, T('#a86a3a')[1]); g.px(6, 7, T('#a86a3a')[1]); g.px(9, 7, T('#a86a3a')[1]); g.px(7, 9, T('#a86a3a')[1]); g.px(8, 9, T('#a86a3a')[1]); } });
      else if (/Breakfast/.test(n)) chairWood(g, h, T('#d9b06a'), { back: 'spindle', top: 3, cush: T('#e9e3d6'), deco: (g) => { for (let i = 3; i < 13; i += 2) { g.px(i, 14, RED[3]); g.px(i + 1, 15, RED[3]); } } });
      else if (/Dining/.test(n)) chairWood(g, h, T('#8f5a36'), /Red|Yellow/.test(n) ? { back: 'padded', top: 2, cush: colorOf(n, '#cf463f') } : { back: 'panel', top: 2 });
      else chairWood(g, h, m.wood, cfg[k] ?? { back: 'slats' });
    }
  }, { post });
};

// ------------------------------------------------------------------ bench

painters.bench = (img, x, y, w, h, c) => {
  const m = mat(c.name), t = m.wood, b = h - 2, k = m.key;
  sprite(img, x, y, w, h, (g) => {
    const sy = b - 9;
    if (k === 'modern') {
      const cu = m.cloth;
      pad(g, 1, sy - 2, w - 2, 5, cu, 1); for (const xx of [11, 21]) g.vline(xx, sy - 1, 3, cu[1]);
      face(g, 2, sy + 3, w - 4, 2, t);
      for (const xx of [3, w - 5]) { g.rect(xx, sy + 5, 2, 6, STEEL[3]); g.vline(xx + 1, sy + 5, 6, STEEL[1]); }
      g.hline(5, b - 2, w - 10, STEEL[2]);
      return;
    }
    const top = k === 'walnut' ? 2 : 3;
    // backrest
    if (k === 'oak') {
      g.rect(3, top, w - 6, sy - top, t[1]);
      for (let i = 5; i < w - 5; i += 4) { g.rect(i, top, 2, sy - top, t[3]); g.vline(i, top, sy - top, t[4]); }
      blk(g, 2, top, w - 4, 3, t);
    } else if (k === 'walnut') {
      rr(g, 2, top, w - 4, sy - top, t[3], 2); g.hline(4, top, w - 8, t[4]);
      for (const cx of [9, 16, 23]) { g.rect(cx - 1, top + 3, 2, 4, t[1]); g.px(cx - 2, top + 4, t[1]); g.px(cx + 1, top + 4, t[1]); }
    } else if (k === 'birch') {
      g.rect(3, top, w - 6, sy - top, t[1]);
      for (const x0 of [4, 16]) for (let i = 0; i < 12; i++) { const j = top + 2 + Math.round(i * (sy - top - 4) / 11); g.px(x0 + i, j, t[4]); g.px(x0 + 11 - i, j, t[3]); }
      blk(g, 2, top, w - 4, 2, t); g.rect(15, top, 2, sy - top, t[3]);
    } else {
      blk(g, 2, top + 1, w - 4, sy - top - 1, t); rr(g, 8, top - 1, w - 16, 3, t[3], 1); g.hline(9, top - 1, w - 18, t[4]);
      pad(g, 5, top + 3, w - 10, sy - top - 4, m.cloth, 1);
    }
    g.rect(2, top + 1, 2, sy - top, t[3]); g.vline(2, top + 1, sy - top, t[4]); g.rect(w - 4, top + 1, 2, sy - top, t[2]);
    // seat
    g.rect(1, sy, w - 2, 4, t[3]); g.hline(1, sy, w - 2, t[4]); g.hline(1, sy + 2, w - 2, t[2]); g.hline(2, sy + 1, 8, t[5]);
    if (k === 'mahogany') { g.rect(3, sy, w - 6, 3, m.cloth[3]); g.hline(3, sy, w - 6, m.cloth[4]); g.hline(3, sy + 2, w - 6, m.cloth[2]); }
    g.hline(1, sy + 4, w - 2, t[2]); g.hline(1, sy + 5, w - 2, t[1]);
    leg(g, 2, sy + 6, 2, 5, t); leg(g, w - 4, sy + 6, 2, 5, t);
    g.vline(6, sy + 6, 3, t[1]); g.vline(w - 7, sy + 6, 3, t[1]);
    if (k !== 'oak') g.hline(4, sy + 8, w - 8, t[2]);
  });
};

// ------------------------------------------------------------------ couch, armchair

type CouchOpt = {
  t: Tones; frame?: Tones; seats: number; legs?: Tones; wing?: boolean; flatBack?: boolean; boxy?: boolean;
  tuft?: boolean; stripes?: Tones; skirt?: boolean; pillows?: Tones[]; deco?: Draw;
};
function couch(g: Img, w: number, h: number, deep: boolean, o: CouchOpt) {
  const t = o.t, f = o.frame ?? t, b = h - 2;
  const F = deep ? 7 : 5, S = deep ? 11 : 5, B = deep ? 15 : 10;
  const fy = b - 1 - F, sy = fy - S, by = sy - B;
  const aw = 6, r = o.boxy ? 0 : 2;
  // back
  rr(g, 3, by, w - 6, B + 2, f[3], o.flatBack ? 0 : r + 1);
  g.hline(3 + r + 1, by, w - 8 - 2 * r, f[4]);
  if (o.frame) { rr(g, 5, by + 2, w - 10, B, t[3], 1); g.hline(6, by + 2, w - 12, t[4]); }
  else { g.hline(6, by + 1, Math.min(10, w - 14), t[5]); }
  if (o.wing) { g.rect(2, by + 1, 3, B, f[3]); g.vline(2, by + 2, B - 1, f[4]); g.rect(w - 5, by + 1, 3, B, f[2]); }
  // seat cushions
  const sx = 1 + aw, sw = w - 2 - 2 * aw, n = o.seats;
  g.rect(sx, sy, sw, S, t[3]);
  g.hline(sx, sy, sw, t[1]);
  for (let i = 0; i < n; i++) {
    const x0 = sx + Math.round((i * sw) / n), x1 = sx + Math.round(((i + 1) * sw) / n);
    // back cushion
    if (!o.frame || true) { g.vline(x1 - 1, by + 3, B - 3, i < n - 1 ? t[1] : t[3]); g.hline(x0 + 1, sy - 1, x1 - x0 - 2, t[2]); }
    g.hline(x0, sy + 1, x1 - x0 - 1, t[4]); g.px(x0 + 1, sy + 2, t[5]);
    if (i < n - 1) g.vline(x1 - 1, sy + 1, S - 1, t[1]);
    g.hline(x0, sy + S - 1, x1 - x0 - 1, t[2]);
    if (o.tuft) { for (let j = by + 5; j < sy - 2; j += 4) for (let xx = x0 + 3 + ((j - by) % 8 === 5 ? 0 : 2); xx < x1 - 2; xx += 4) g.px(xx, j, t[1]); }
    if (o.stripes) { for (let xx = x0 + 2; xx < x1 - 2; xx += 4) { g.vline(xx, by + 3, B - 4, o.stripes[3]); g.vline(xx, sy + 1, S - 1, o.stripes[3]); } }
  }
  // front
  g.rect(sx, fy, sw, F, t[2]); g.hline(sx, fy, sw, t[1]); g.hline(sx, fy + F - 1, sw, t[1]);
  if (o.skirt) for (let xx = sx; xx < sx + sw; xx += 3) g.vline(xx, fy + 2, F - 2, t[1]);
  // arms
  for (const left of [true, false]) {
    const ax = left ? 1 : w - 1 - aw, ay = sy - (deep ? 4 : 3), ah = b - ay;
    rr(g, ax, ay, aw, ah, f[3], r); g.rect(ax, ay + r, aw, ah - r, f[3]);
    g.hline(ax + r, ay, aw - 2 * r, f[4]); g.hline(ax + 1, ay + 1, aw - 2, f[4]);
    g.rect(ax, fy - 1, aw, F + 1, f[2]); g.hline(ax, fy - 2, aw, f[1]);
    if (!o.boxy) { g.rect(ax + 1, fy, aw - 2, 3, f[3]); g.px(ax + 2, fy + 1, f[4]); }
    g.hline(ax, b - 1, aw, f[1]);
    g.vline(left ? ax + aw - 1 : ax, ay + 2, fy - ay - 3, f[2]);
  }
  // feet
  const lt = o.legs ?? DARKW;
  for (const xx of [2, w - 5]) { g.rect(xx, b, 3, 1, lt[2]); }
  if (w > 40) g.rect(Math.floor(w / 2) - 1, b, 2, 1, lt[2]);
  // pillows
  (o.pillows ?? []).forEach((p, i) => {
    const px0 = i === 0 ? sx : sx + sw - 7, py = sy - 4;
    rr(g, px0, py, 7, 7, p[3], 2); g.hline(px0 + 2, py, 3, p[4]); g.hline(px0 + 2, py + 6, 3, p[1]); g.px(px0 + 3, py + 3, p[1]); g.px(px0 + 2, py + 1, p[5]);
  });
  o.deco?.(g);
}

painters.couch = (img, x, y, w, h, c) => {
  const n = c.name, m = mat(n), deep = c.th >= 2, b = h - 2;
  const by = deep ? b - 1 - 7 - 11 - 15 : b - 1 - 5 - 5 - 10;
  sprite(img, x, y, w, h, (g) => {
    const seats = w > 48 ? 4 : 3;
    if (/Joja/.test(n)) couch(g, w, h, deep, { t: m.wood, frame: T('#8d95a8'), seats, boxy: true, flatBack: true, legs: STEEL, deco: (g) => { g.rect(w / 2 - 5, by + 3, 10, 7, WHITE[4]); icon(g, 'joja', w / 2, by + 6.5, m.wood[2]); } });
    else if (/Junimo/.test(n)) couch(g, w, h, deep, { t: m.wood, seats: 2, pillows: [m.cloth], deco: (g) => { icon(g, 'star5', w / 2, by + 5, m.cloth[4]); g.px(w / 2, by - 1, LEAF[4]); g.px(w / 2 + 1, by - 2, LEAF[5]); g.px(w / 2 - 1, by - 1, LEAF[2]); } });
    else if (/Moldy/.test(n)) couch(g, w, h, deep, { t: T('#8f8a5a'), seats, deco: (g) => {
      const mo = T('#5f8f4a');
      for (const [mx, my, r] of [[10, by + 4, 2.5], [30, by + 6, 2], [38, b - 9, 2.5], [20, b - 4, 2], [5, b - 7, 1.5]]) { g.ellipse(mx, my, r, r * 0.8, mo[2]); g.px(mx, my - 1, mo[4]); g.px(mx - 1, my, mo[3]); }
      g.line(24, by + 2, 27, by + 7, INK); g.px(26, by + 4, T('#e9e3d6')[3]);
    } });
    else if (/Retro/.test(n)) couch(g, w, h, deep, { t: m.wood, seats, stripes: m.cloth, legs: T('#7b4b2f'), flatBack: true, pillows: [m.trim, m.cloth] });
    else if (/Large Brown/.test(n)) couch(g, w, h, deep, { t: T('#9a6a42'), seats, tuft: true, pillows: [T('#d9b55c')] });
    else if (/Wizard/.test(n)) couch(g, w, h, deep, { t: m.wood, frame: T('#3f3463'), seats, pillows: [GOLD, T('#3f7fd0')], deco: (g) => {
      for (const xx of [13, 24, 35]) icon(g, 'star5', xx, by + 7, GOLD[4]);
      g.rect(w / 2 - 2, by - 2, 4, 2, GOLD[3]); g.px(w / 2 - 1, by - 3, GOLD[5]); g.px(w / 2, by - 3, GOLD[4]);
    } });
    else if (/Woodsy/.test(n)) couch(g, w, h, deep, { t: T('#5f9a4a'), frame: T('#8a5a34'), seats, flatBack: true, pillows: [T('#d9a54a')], deco: (g) => {
      for (const xx of [14, 24, 34]) icon(g, 'leaf', xx, by + 8, T('#5f9a4a')[5], T('#5f9a4a')[1]);
    } });
    else if (/Dark/.test(n)) couch(g, w, h, deep, { t: m.wood, seats, pillows: [m.cloth, m.cloth], tuft: true });
    else {
      const t = colorOf(n, '#4f7fd6');
      const v: Record<string, CouchOpt> = {
        Blue: { t, seats, pillows: [WHITE] }, Brown: { t, seats, tuft: true }, Green: { t, seats, stripes: T('#3b8a45'), pillows: [T('#e9c040')] },
        Red: { t, seats, frame: T('#7b4b2f'), wing: true }, Yellow: { t, seats, skirt: true, pillows: [T('#e8873a'), WHITE] },
      };
      couch(g, w, h, deep, v[n.split(' ')[0]] ?? { t, seats });
    }
  });
};

painters.armchair = (img, x, y, w, h, c) => {
  const n = c.name, t = colorOf(n, '#4f7fd6'), b = h - 2, by = b - 34;
  sprite(img, x, y, w, h, (g) => {
    const v: Record<string, CouchOpt> = {
      Blue: { t, seats: 1, tuft: true },
      Brown: { t, seats: 1, boxy: true, flatBack: true, deco: (g) => { for (let xx = 4; xx < w - 3; xx += 3) g.px(xx, by + 1, GOLD[4]); for (const xx of [2, 5, w - 6, w - 3]) g.px(xx, b - 4, GOLD[4]); } },
      Green: { t, seats: 1, stripes: T('#3b8a45'), pillows: [T('#e9c040')] },
      Red: { t, seats: 1, frame: T('#7b4b2f'), wing: true, deco: (g) => { g.rect(w / 2 - 2, by - 1, 4, 2, GOLD[3]); g.px(w / 2 - 1, by - 1, GOLD[5]); } },
      Yellow: { t, seats: 1, skirt: true, pillows: [WHITE], deco: (g) => { for (let xx = 9; xx < w - 9; xx += 4) icon(g, 'bloom', xx + 1, by + 7, T('#e8873a')[3], WHITE[5]); } },
    };
    couch(g, w, h, true, v[n.split(' ')[0]] ?? { t, seats: 1 });
  });
};

// ------------------------------------------------------------------ small props (things that stand on furniture)

const POTIONS = ['#cf463f', '#4fa651', '#8a5cc2', '#3f7fd0', '#e9c040', '#ee8fb6', '#3aa79f', '#e8873a'];
const CORK = hex('#b98a5a');
/** Tall bottle, 3 px wide, standing on row `by`. */
function bottle(g: Img, x: number, by: number, t: Tones, tall = 7) {
  g.rect(x, by - 3, 3, 4, t[3]); g.vline(x, by - 3, 4, t[4]); g.vline(x + 2, by - 3, 4, t[2]);
  g.vline(x + 1, by - tall + 2, tall - 5, t[3]); g.px(x + 1, by - tall + 1, CORK); g.px(x, by - 2, t[5]);
}
/** Round flask, 5 px wide. */
function flask(g: Img, x: number, by: number, t: Tones) {
  rr(g, x, by - 3, 5, 4, t[3], 1); g.hline(x + 1, by, 3, t[2]); g.px(x + 1, by - 2, t[5]);
  g.vline(x + 2, by - 5, 2, GLASS[5]); g.px(x + 2, by - 6, CORK);
}
function candle(g: Img, x: number, by: number, t: Tones = WHITE, tall = 4) {
  g.rect(x, by - tall + 1, 2, tall, t[4]); g.vline(x + 1, by - tall + 1, tall, t[2]);
  g.px(x, by - tall, hex('#f9b93c')); g.px(x, by - tall - 1, hex('#fff0a0')); g.px(x + 1, by - tall, hex('#e8622a'));
}
function plate(g: Img, cx: number, cy: number, t: Tones = WHITE) {
  g.ellipse(cx, cy, 3, 2, t[2]); g.ellipse(cx, cy - 0.4, 3, 1.7, t[5]); g.ellipse(cx, cy - 0.3, 1.5, 0.8, t[3]);
}
function mug(g: Img, x: number, by: number, t: Tones, drink: RGBA = hex('#6b4530')) {
  g.rect(x, by - 3, 3, 4, t[4]); g.vline(x + 2, by - 3, 4, t[2]); g.hline(x, by - 3, 3, drink); g.px(x + 3, by - 2, t[3]); g.px(x + 3, by - 1, t[3]);
}
function teapot(g: Img, x: number, by: number, t: Tones, knob: RGBA) {
  stamp(g, x, by - 5, ['...k...', '..www..', 'hwWwwws', 'hwwwwss', '.wwwwd.', '..ddd..'], { k: knob, w: t[4], W: t[5], h: t[2], s: t[3], d: t[2] });
}
function vase(g: Img, x: number, by: number, t: Tones, fl: Tones = RED) {
  g.rect(x, by - 3, 3, 4, t[3]); g.px(x, by - 2, t[5]); g.vline(x + 2, by - 3, 4, t[2]); g.px(x + 1, by - 4, t[2]);
  g.px(x + 1, by - 5, LEAF[2]); g.px(x, by - 6, LEAF[3]); g.px(x + 2, by - 6, LEAF[3]);
  g.px(x + 1, by - 7, fl[3]); g.px(x - 1, by - 7, fl[4]); g.px(x + 3, by - 7, fl[3]); g.px(x + 1, by - 8, fl[4]); g.px(x, by - 6, fl[3]);
}
function bookFlat(g: Img, x: number, by: number, t: Tones, w = 6) {
  g.rect(x, by - 1, w, 2, t[3]); g.hline(x, by - 1, w, t[4]); g.hline(x + 1, by, w - 1, PAPER[4]); g.px(x, by, t[2]);
}
function openBook(g: Img, cx: number, cy: number) {
  g.rect(cx - 5, cy - 2, 10, 5, PAPER[5]); g.vline(cx, cy - 2, 5, PAPER[1]); g.hline(cx - 5, cy + 2, 10, PAPER[2]);
  for (const j of [-1, 1]) { g.hline(cx - 4, cy + j - 0, 3, PAPER[1]); g.hline(cx + 2, cy + j, 3, PAPER[1]); }
}
function crystalBall(g: Img, cx: number, by: number, t: Tones = T('#9f7fe0')) {
  g.rect(cx - 2, by - 1, 5, 2, GOLD[2]); g.hline(cx - 2, by - 1, 5, GOLD[4]);
  orb(g, cx + 0.5, by - 4.5, 3.4, t);
}
function fruit(g: Img, cx: number, cy: number) {
  g.ellipse(cx, cy + 1, 4.5, 2, T('#8a5a34')[2]); g.hline(cx - 4, cy, 8, T('#8a5a34')[4]);
  g.rect(cx - 3, cy - 2, 2, 2, RED[3]); g.px(cx - 3, cy - 2, RED[5]); g.rect(cx - 1, cy - 3, 2, 3, T('#e8873a')[3]); g.rect(cx + 1, cy - 2, 2, 2, T('#8a5cc2')[3]);
  g.px(cx + 2, cy - 3, LEAF[3]); g.px(cx - 1, cy - 4, LEAF[3]);
}

// ------------------------------------------------------------------ tables

type TableOpt = { round?: boolean; cloth?: Tones; legs?: Tones; pedestal?: boolean; legH?: number; r?: number; edge?: number; glass?: boolean; peg?: boolean };
type Top = { x: number; y: number; w: number; d: number; cx: number; cy: number };
/** Table in 3/4 view. Returns the rectangle of the top surface so things can be put on it. */
function table(g: Img, w: number, h: number, deep: boolean, t: Tones, o: TableOpt = {}): Top {
  const b = h - 2, legH = o.legH ?? (deep ? 12 : 10), edge = o.edge ?? (deep ? 3 : 2), y0 = deep ? 4 : 3;
  const d = b - legH - edge - y0 + 1, lt = o.legs ?? t;
  const top: Top = { x: 1, y: y0, w: w - 2, d, cx: w / 2, cy: y0 + d / 2 };
  const ly = y0 + d + edge;
  if (o.round) {
    const rx = w / 2 - 1, ry = d / 2;
    // pedestal or legs
    if (o.pedestal !== false) {
      g.rect(top.cx - 2, top.cy, 4, b - top.cy - 1, lt[3]); g.vline(top.cx - 2, top.cy, b - top.cy - 1, lt[4]); g.vline(top.cx + 1, top.cy, b - top.cy - 1, lt[1]);
      g.ellipse(top.cx, b - 0.5, Math.min(8, rx * 0.55), 2, lt[2]); g.hline(top.cx - 4, b - 2, 7, lt[4]);
    } else {
      for (const xx of [5, w - 7]) leg(g, xx, top.cy, 2, b - top.cy + 1, lt);
    }
    const c1 = o.cloth ?? t;
    g.ellipse(top.cx, top.cy + edge + (o.cloth ? 3 : 0), rx, ry, c1[1]);
    g.ellipse(top.cx, top.cy + edge - 1 + (o.cloth ? 3 : 0), rx, ry, c1[2]);
    g.ellipse(top.cx, top.cy, rx, ry, c1[4]);
    g.ellipse(top.cx + 0.6, top.cy + 0.6, rx - 0.8, ry - 0.8, c1[3]);
    if (o.cloth) for (let xx = 3; xx < w - 3; xx += 4) g.vline(xx, top.cy + ry * 0.8, 4, c1[1]);
    return top;
  }
  // legs
  if (o.pedestal) {
    g.rect(top.cx - 2, ly, 4, legH - 2, lt[3]); g.vline(top.cx + 1, ly, legH - 2, lt[1]); g.ellipse(top.cx, b - 0.5, 7, 2, lt[2]); g.hline(top.cx - 4, b - 2, 7, lt[4]);
  } else {
    const lw = w > 40 ? 3 : 3;
    if (o.peg) {
      for (let j = 0; j < legH; j++) { const k = Math.round(j / 5); g.rect(3 - k + 1, ly + j, 2, 1, lt[3]); g.px(4 - k + 1, ly + j, lt[1]); g.rect(w - 6 + k, ly + j, 2, 1, lt[3]); g.px(w - 5 + k, ly + j, lt[1]); }
    } else {
      leg(g, 2, ly, lw, legH, lt); leg(g, w - 2 - lw, ly, lw, legH, lt);
      if (deep) { g.rect(6, ly, 2, Math.max(2, legH - 5), lt[1]); g.rect(w - 8, ly, 2, Math.max(2, legH - 5), lt[1]); }
    }
  }
  topSlab(g, 1, y0, w - 2, d, edge, o.glass ? GLASS : t, o.r ?? 0);
  if (o.glass) { g.line(6, y0 + d - 2, 12, y0 + 2, GLASS[5]); g.line(9, y0 + d - 2, 15, y0 + 2, GLASS[4]); }
  if (o.cloth) {
    const cl = o.cloth;
    g.rect(1, y0, w - 2, d, cl[3]); g.hline(1, y0, w - 2, cl[5]); g.hline(1, y0 + 1, w - 2, cl[4]);
    g.rect(1, y0 + d, w - 2, edge + 3, cl[2]); g.hline(1, y0 + d, w - 2, cl[1]);
    for (let xx = 1; xx < w - 1; xx++) if (xx % 4 === 0) g.px(xx, y0 + d + edge + 2, [0, 0, 0, 0]);
  }
  return top;
}
function clearPx(g: Img, x: number, y: number) { if (g.inb(x, y)) g.data[(y * g.w + x) * 4 + 3] = 0; }
/** Decoration band around a rectangular top. */
function inlay(g: Img, p: Top, col: RGBA, m = 2) {
  g.hline(p.x + m, p.y + m, p.w - 2 * m, col); g.hline(p.x + m, p.y + p.d - 1 - m, p.w - 2 * m, col);
  g.vline(p.x + m, p.y + m, p.d - 2 * m, col); g.vline(p.x + p.w - 1 - m, p.y + m, p.d - 2 * m, col);
}
function runner(g: Img, p: Top, t: Tones, wid = 6) {
  const y = Math.round(p.cy - wid / 2);
  g.rect(p.x + 3, y, p.w - 6, wid, t[3]); g.hline(p.x + 3, y, p.w - 6, t[4]); g.hline(p.x + 3, y + wid - 1, p.w - 6, t[2]);
  for (let j = y; j < y + wid; j += 2) { g.px(p.x + 2, j, t[4]); g.px(p.x + p.w - 3, j, t[4]); }
}
function settings(g: Img, p: Top, n: number, t: Tones = WHITE) {
  for (let i = 0; i < n; i++) { const cx = p.x + ((i + 0.5) * p.w) / n; plate(g, cx, p.y + 3, t); plate(g, cx, p.y + p.d - 3, t); }
}

painters.table = (img, x, y, w, h, c) => {
  const n = c.name, m = mat(n), deep = c.th >= 2, b = h - 2, k = m.key, t = m.wood;
  let post: Draw | undefined;
  sprite(img, x, y, w, h, (g) => {
    if (/Dining/.test(n)) {
      if (/Bountiful/.test(n)) {
        const p = table(g, w, h, deep, T('#a86a3a'));
        runner(g, p, T('#d9822b'), 8); settings(g, p, 5);
        g.ellipse(p.cx, p.cy + 1, 7, 4, WHITE[4]); g.ellipse(p.cx, p.cy - 1, 5, 3.4, T('#b0603a')[3]); g.ellipse(p.cx - 1, p.cy - 2, 3, 1.6, T('#b0603a')[4]);
        g.px(p.cx - 6, p.cy - 3, WHITE[5]); g.px(p.cx + 5, p.cy - 3, WHITE[5]); g.px(p.cx - 5, p.cy - 2, T('#b0603a')[2]); g.px(p.cx + 4, p.cy - 2, T('#b0603a')[2]);
        fruit(g, p.cx - 20, p.cy); fruit(g, p.cx + 21, p.cy);
        g.ellipse(p.cx - 32, p.cy, 3, 2, T('#d9a54a')[3]); g.hline(p.cx - 34, p.cy - 1, 3, T('#d9a54a')[5]);
        g.ellipse(p.cx + 32, p.cy, 3, 2, T('#e8873a')[3]); g.px(p.cx + 32, p.cy - 2, LEAF[3]);
      } else if (/Festive/.test(n)) {
        const p = table(g, w, h, deep, T('#8a5a34'), { cloth: RED });
        runner(g, p, GREEN, 6); settings(g, p, 5);
        for (const dx of [-24, 0, 24]) { g.rect(p.cx + dx - 1, p.cy - 1, 3, 2, GOLD[3]); candle(g, p.cx + dx, p.cy - 1, WHITE, 5); }
        for (const dx of [-12, 12]) { g.px(p.cx + dx, p.cy, RED[4]); g.px(p.cx + dx + 1, p.cy, RED[3]); g.px(p.cx + dx - 1, p.cy - 1, LEAF[5]); g.px(p.cx + dx + 2, p.cy + 1, LEAF[5]); }
        for (let xx = 3; xx < w - 3; xx += 4) g.px(xx, p.y + p.d + 3, GOLD[4]);
      } else if (/Winter/.test(n)) {
        const p = table(g, w, h, deep, t, { legs: T('#8fb5d0') });
        runner(g, p, T('#f4f8fb'), 8); settings(g, p, 5, T('#cfe6f2'));
        for (const dx of [-22, 0, 22]) icon(g, 'flake', p.cx + dx, p.cy, m.cloth[3]);
        candle(g, p.cx - 11, p.cy + 1, m.cloth, 5); candle(g, p.cx + 11, p.cy + 1, m.cloth, 5);
      } else if (/Modern/.test(n)) {
        const p = table(g, w, h, deep, T('#e2e5ea'), { legs: STEEL, edge: 2 });
        runner(g, p, m.cloth, 4); settings(g, p, 4, T('#f4f4f4'));
        vase(g, p.cx - 1, p.cy + 1, BLACK, T('#e8504a'));
      } else {
        const p = table(g, w, h, deep, t);
        inlay(g, p, t[2]); runner(g, p, m.cloth, 6); settings(g, p, 5);
        for (const dx of [-16, 16]) { g.rect(p.cx + dx - 2, p.cy, 5, 2, GOLD[3]); candle(g, p.cx + dx - 2, p.cy - 1, WHITE, 3); candle(g, p.cx + dx + 1, p.cy - 1, WHITE, 3); candle(g, p.cx + dx - 1, p.cy - 1, WHITE, 6); }
        fruit(g, p.cx, p.cy + 1);
      }
      return;
    }
    if (/Elixir/.test(n)) {
      const p = table(g, w, h, deep, T('#5b3b6e'), { legs: T('#3f3463') });
      inlay(g, p, GOLD[3], 1);
      const rows = deep ? [p.y + 7, p.y + 13, p.y + 19] : [p.y + 6];
      rows.forEach((by, r) => {
        for (let i = 0; i < 5; i++) {
          const col = T(POTIONS[(i + r * 3 + pick(n, 5)) % POTIONS.length]), xx = 3 + i * 5 + (r % 2);
          if ((i + r) % 2) flask(g, xx, by, col); else bottle(g, xx + 1, by, col, 7);
        }
      });
      return;
    }
    if (/Radio Desk/.test(n)) {
      const p = table(g, w, h, deep, T('#8f5a36'));
      g.rect(3, p.y + p.d + 2, 9, 6, T('#8f5a36')[2]); g.hline(3, p.y + p.d + 4, 9, T('#8f5a36')[1]); g.px(7, p.y + p.d + 3, GOLD[4]); g.px(7, p.y + p.d + 6, GOLD[4]);
      const r = T('#a3462f');
      rr(g, 12, p.y - 3, 14, 9, r[3], 1); g.hline(13, p.y - 3, 12, r[4]); g.rect(14, p.y - 1, 6, 5, T('#d9b55c')[2]);
      for (let j = 0; j < 5; j += 2) g.hline(14, p.y - 1 + j, 6, T('#d9b55c')[4]);
      g.px(22, p.y, GOLD[4]); g.px(22, p.y + 3, GOLD[4]); g.px(23, p.y + 1, WHITE[5]);
      g.line(24, p.y - 4, 28, p.y - 9, STEEL[4]);
      g.rect(4, p.y + 2, 5, 4, PAPER[5]); g.hline(5, p.y + 3, 3, PAPER[1]);
      return;
    }
    if (/Spirits|Wine/.test(n)) {
      const wine = /Wine/.test(n);
      const p = table(g, w, h, deep, wine ? T('#7b4b2f') : T('#4b4058'), wine ? { cloth: WHITE } : {});
      if (wine) {
        for (const [xx, col] of [[5, '#6a1f3a'], [10, '#3f6a3a'], [36, '#6a1f3a'], [41, '#8a2f4a']] as [number, string][]) bottle(g, xx, p.y + 7, T(col), 10);
        for (const xx of [17, 23, 29]) { g.rect(xx, p.y + 1, 3, 3, GLASS[5]); g.hline(xx, p.y + 3, 3, T('#8a2f4a')[3]); g.px(xx + 1, p.y + 4, GLASS[4]); g.px(xx + 1, p.y + 5, GLASS[4]); g.hline(xx, p.y + 6, 3, GLASS[3]); }
        g.rect(15, p.y + 8, 17, 1, T('#6a1f3a')[3]);
      } else {
        const cols = ['#d9a54a', '#3f7f70', '#b0603a', '#e9e3d6', '#8a5cc2', '#d9a54a', '#4f7fd6', '#b0603a'];
        cols.forEach((col, i) => { if (i % 3 === 1) flask(g, 3 + i * 5.4, p.y + 7, T(col)); else bottle(g, 4 + i * 5.4, p.y + 7, T(col), 8 + (i % 2) * 2); });
        g.hline(3, p.y + 8, w - 6, T('#7c4eb0')[3]);
      }
      return;
    }
    const round = /Walnut|Candy|Diviner|Junimo|Modern Table|Moon|Sun|Pub|Retro/.test(n);
    if (/Oak/.test(n)) { const p = table(g, w, h, deep, t); for (const j of [5, 10, 15]) g.hline(p.x, p.y + j, p.w, t[2]); g.px(8, p.y + 3, t[2]); g.px(22, p.y + 12, t[2]); g.px(14, p.y + 8, t[2]); }
    else if (/Walnut/.test(n)) { const p = table(g, w, h, deep, t, { round }); g.ellipse(p.cx, p.cy, 8, 5, t[2]); g.ellipse(p.cx, p.cy, 7, 4, t[3]); }
    else if (/Birch/.test(n)) { const p = table(g, w, h, deep, t); runner(g, p, m.cloth, 8); vase(g, p.cx - 1, p.cy + 2, WHITE, T('#e9c040')); }
    else if (/Mahogany/.test(n)) { const p = table(g, w, h, deep, t, { r: 1 }); inlay(g, p, t[2]); inlay(g, p, GOLD[3], 4); g.ellipse(p.cx, p.cy, 5, 3.4, WHITE[5]); g.ellipse(p.cx, p.cy, 3, 2, WHITE[3]); g.ellipse(p.cx, p.cy, 1.5, 1, WHITE[5]); }
    else if (/Candy/.test(n)) {
      const p = table(g, w, h, deep, t, { round, legs: WHITE });
      for (let a = 0; a < 40; a++) { const r = a * 0.24, an = a * 0.5; g.px(p.cx + Math.cos(an) * r * 1.4, p.cy + Math.sin(an) * r, WHITE[5]); }
      for (let j = p.cy + 2; j < b; j += 3) g.hline(p.cx - 2, j, 4, RED[3]);
      g.px(p.cx - 9, p.cy - 4, RED[3]); g.px(p.cx + 9, p.cy + 3, T('#6fc0f0')[3]); g.px(p.cx + 7, p.cy - 5, GOLD[4]);
    }
    else if (/Dark/.test(n)) { const p = table(g, w, h, deep, t); runner(g, p, m.cloth, 8); g.rect(p.cx - 2, p.cy, 5, 2, STEEL[2]); candle(g, p.cx - 1, p.cy - 1, T('#b9a6d8'), 6); icon(g, 'bloom', 6, p.cy, m.trim[3], m.cloth[1]); icon(g, 'bloom', w - 7, p.cy, m.trim[3], m.cloth[1]); }
    else if (/Desert/.test(n)) {
      const p = table(g, w, h, deep, t);
      for (let xx = 2; xx < w - 2; xx++) g.px(xx, p.y + p.d + 1 - (xx % 4 < 2 ? 0 : 1), m.cloth[3]);
      inlay(g, p, m.trim[3], 2);
      g.rect(p.cx - 3, p.cy, 6, 4, CLAY[3]); g.hline(p.cx - 3, p.cy, 6, CLAY[4]); g.rect(p.cx - 1, p.cy - 6, 3, 6, LEAF[3]); g.vline(p.cx - 1, p.cy - 6, 6, LEAF[4]); g.px(p.cx - 3, p.cy - 3, LEAF[3]); g.px(p.cx - 2, p.cy - 2, LEAF[3]); g.px(p.cx + 3, p.cy - 4, LEAF[2]); g.px(p.cx + 2, p.cy - 3, LEAF[2]); g.px(p.cx, p.cy - 7, T('#ee8fb6')[3]);
    }
    else if (/Diviner/.test(n)) {
      const p = table(g, w, h, deep, t, { round, cloth: T('#5a3f95') });
      for (const [dx, dy] of [[-9, -3], [8, -5], [-6, 5], [10, 3], [0, -7]]) icon(g, 'star5', p.cx + dx, p.cy + dy, GOLD[4]);
      crystalBall(g, p.cx - 1, p.cy + 3, T('#7fd0e8'));
    }
    else if (/Joja/.test(n)) { const p = table(g, w, h, deep, t, { legs: STEEL }); g.rect(p.x + 3, p.y + 3, p.w - 6, p.d - 6, WHITE[5]); g.rect(p.x + 4, p.y + 4, p.w - 8, p.d - 8, t[3]); icon(g, 'joja', p.cx, p.cy, WHITE[5]); }
    else if (/Junimo/.test(n)) {
      const p = table(g, w, h, deep, t, { round, legs: T('#8a5a34') });
      g.ellipse(p.cx, p.cy, 9, 6, t[4]); icon(g, 'star', p.cx, p.cy, m.cloth[4]);
      for (const [dx, dy] of [[-12, -1], [11, 2], [-7, 6], [6, -7]]) g.px(p.cx + dx, p.cy + dy, t[5]);
      g.px(p.cx - 5, b - 4, LEAF[4]); g.px(p.cx - 6, b - 5, LEAF[3]); g.px(p.cx + 4, b - 6, LEAF[4]); g.px(p.cx + 5, b - 7, LEAF[3]);
    }
    else if (/Luau/.test(n)) {
      const p = table(g, w, h, deep, t, { cloth: m.cloth });
      for (let xx = 4; xx < w - 4; xx += 7) for (let j = 3; j < p.d - 2; j += 7) icon(g, 'bloom', xx + ((j % 2) * 3), p.y + j, WHITE[5], GOLD[4]);
      const pi = T('#e9b83a'); rr(g, p.cx - 3, p.cy - 4, 6, 8, pi[3], 2); for (let j = -3; j < 3; j += 2) for (let i = -2; i < 3; i += 2) g.px(p.cx + i, p.cy + j, pi[1]);
      g.px(p.cx - 1, p.cy - 6, LEAF[3]); g.px(p.cx, p.cy - 7, LEAF[4]); g.px(p.cx + 1, p.cy - 6, LEAF[2]); g.px(p.cx - 2, p.cy - 7, LEAF[3]); g.px(p.cx + 2, p.cy - 7, LEAF[3]); g.hline(p.cx - 1, p.cy - 5, 3, LEAF[3]);
      mug(g, 5, p.cy + 6, T('#8a5a34'), hex('#fff1f6')); g.px(7, p.cy + 1, RED[3]);
      for (let j = p.y + p.d + 6; j < b; j += 3) { g.hline(2, j, 3, t[1]); g.hline(w - 5, j, 3, t[1]); }
    }
    else if (/Luxury/.test(n)) {
      const p = table(g, w, h, deep, T('#8a3f3a'), { cloth: T('#f1ece0') });
      inlay(g, p, GOLD[3], 2); for (let xx = 2; xx < w - 2; xx += 2) g.px(xx, p.y + p.d + 4, GOLD[4]);
      g.rect(p.cx - 5, p.cy + 2, 10, 2, GOLD[3]); g.hline(p.cx - 5, p.cy + 2, 10, GOLD[5]); g.rect(p.cx - 1, p.cy - 3, 2, 5, GOLD[3]); g.hline(p.cx - 5, p.cy - 2, 10, GOLD[4]);
      candle(g, p.cx - 5, p.cy - 3, WHITE, 3); candle(g, p.cx + 4, p.cy - 3, WHITE, 3); candle(g, p.cx - 1, p.cy - 4, WHITE, 4);
    }
    else if (/Modern/.test(n)) { table(g, w, h, deep, STEEL, { round, legs: STEEL, glass: true }); g.ellipse(16, 14, 11, 7, GLASS[3]); g.ellipse(15, 13, 10, 6, GLASS[4]); g.line(9, 16, 15, 9, GLASS[5]); g.line(13, 17, 19, 10, GLASS[5]); }
    else if (/Moon|Sun/.test(n)) {
      const sun = /Sun/.test(n);
      const p = table(g, w, h, deep, sun ? T('#e8a53a') : T('#34407e'), { round, legs: sun ? T('#b0603a') : T('#2c3058') });
      if (sun) { for (let a = 0; a < 12; a++) g.line(p.cx, p.cy, p.cx + Math.cos(a * Math.PI / 6) * 12, p.cy + Math.sin(a * Math.PI / 6) * 8, T('#f6d65a')[4]); g.ellipse(p.cx, p.cy, 6, 4.4, T('#e8622a')[3]); g.ellipse(p.cx, p.cy, 4.6, 3.2, T('#f9d54a')[4]); g.px(p.cx - 2, p.cy - 1, INK); g.px(p.cx + 1, p.cy - 1, INK); g.hline(p.cx - 1, p.cy + 1, 2, T('#e8622a')[2]); }
      else { g.ellipse(p.cx, p.cy, 7, 5, T('#f4eeb0')[4]); g.ellipse(p.cx + 3, p.cy - 1, 6, 4.4, T('#34407e')[3]); for (const [dx, dy] of [[6, -4], [9, 2], [-10, -3], [3, 5], [-8, 4], [5, 0]]) g.px(p.cx + dx, p.cy + dy, WHITE[5]); }
    }
    else if (/Neolithic/.test(n)) {
      const s = m.wood;
      for (const x0 of [3, w - 12]) { rr(g, x0, b - 12, 9, 13, s[2], 2); g.rect(x0 + 1, b - 11, 3, 8, s[3]); g.px(x0 + 5, b - 5, s[1]); g.px(x0 + 3, b - 2, s[1]); }
      rr(g, 1, 5, w - 2, 19, s[3], 3); g.hline(4, 5, w - 8, s[5]); g.rect(3, 6, w - 7, 2, s[4]); rr(g, 1, 22, w - 2, 5, s[2], 2); g.hline(3, 26, w - 6, s[1]);
      g.line(8, 9, 12, 13, s[2]); g.line(12, 13, 11, 17, s[2]); g.line(22, 16, 26, 20, s[2]); g.px(20, 10, s[2]); g.px(6, 19, s[4]);
      g.rect(14, 12, 2, 5, T('#e9e3d6')[4]); g.px(13, 11, T('#e9e3d6')[4]); g.px(16, 11, T('#e9e3d6')[4]); g.px(13, 17, T('#e9e3d6')[3]); g.px(16, 17, T('#e9e3d6')[3]);
    }
    else if (/Pub/.test(n)) { const p = table(g, w, h, deep, T('#6b4530'), { round }); g.ellipse(p.cx, p.cy, 11, 7, T('#6b4530')[2]); g.ellipse(p.cx, p.cy, 10, 6, T('#6b4530')[3]); mug(g, p.cx - 6, p.cy + 1, T('#d9b06a'), hex('#fff6dc')); g.px(p.cx - 5, p.cy - 3, hex('#fff6dc')); mug(g, p.cx + 3, p.cy + 3, T('#d9b06a'), hex('#fff6dc')); g.ellipse(p.cx + 6, p.cy - 3, 2, 1.2, T('#6b4530')[1]); }
    else if (/Puzzle/.test(n)) {
      const p = table(g, w, h, deep, T('#b37c46'));
      g.rect(6, p.y + 3, 16, 12, T('#6fb0e0')[3]); g.rect(6, p.y + 9, 16, 6, GREEN[3]); g.rect(14, p.y + 5, 4, 4, GOLD[4]);
      for (let xx = 10; xx < 22; xx += 4) g.vline(xx, p.y + 3, 12, INK); for (let j = 7; j < 15; j += 4) g.hline(6, p.y + j, 16, INK);
      g.rect(18, p.y + 11, 4, 4, T('#b37c46')[2]); g.rect(24, p.y + 13, 4, 4, GREEN[3]); g.px(25, p.y + 12, GREEN[3]); g.rect(25, p.y + 5, 4, 4, T('#6fb0e0')[4]); g.px(24, p.y + 6, T('#6fb0e0')[4]); g.rect(3, p.y + 16, 3, 3, GOLD[3]);
    }
    else if (/Retro/.test(n)) { const p = table(g, w, h, deep, m.trim, { round, pedestal: true, legs: WHITE }); g.ellipse(p.cx, p.cy, 11, 7, t[3]); g.ellipse(p.cx, p.cy, 7, 4.4, m.cloth[3]); g.ellipse(p.cx, p.cy, 3.4, 2, m.trim[4]); }
    else if (/Winter/.test(n)) { const p = table(g, w, h, deep, t, { legs: T('#8fb5d0') }); inlay(g, p, m.cloth[4], 2); icon(g, 'flake', p.cx, p.cy, m.cloth[3]); icon(g, 'flake', p.cx, p.cy, WHITE[5], m.cloth[3]); for (const [dx, dy] of [[-9, -5], [9, 5], [-9, 5], [9, -5]]) icon(g, 'cross', p.cx + dx, p.cy + dy, WHITE[5]); g.px(4, p.y + p.d + 3, WHITE[5]); g.px(12, p.y + p.d + 3, WHITE[5]); g.px(24, p.y + p.d + 3, WHITE[5]); }
    else if (/Wizard/.test(n)) {
      const p = table(g, w, h, deep, t, { legs: T('#3f3463') });
      inlay(g, p, GOLD[3], 1); ['rune1', 'rune2', 'rune3', 'rune4'].forEach((r, i) => icon(g, r, 5 + i * 7.5, p.y + p.d - 4, T('#b9a6d8')[4]));
      openBook(g, 11, p.y + 7); crystalBall(g, 23, p.y + 10, T('#6fe0b0'));
    }
    else table(g, w, h, deep, t);
  }, { post });
};

painters.teatable = (img, x, y, w, h, c) => {
  const n = c.name, m = mat(n), deep = c.th >= 2, k = m.key, t = m.wood;
  sprite(img, x, y, w, h, (g) => {
    const o: TableOpt = { legH: deep ? 7 : 5, edge: 2 };
    if (/Joja Cola/.test(n)) {
      const p = table(g, w, h, deep, T('#3f6fd2'), { ...o, round: true, legs: STEEL });
      g.ellipse(p.cx, p.cy, 10, 7, WHITE[5]); g.ellipse(p.cx, p.cy, 8.6, 5.8, RED[3]); icon(g, 'joja', p.cx, p.cy, WHITE[5]);
      for (const [dx, dy] of [[-11, 2], [10, -3]]) { g.rect(p.cx + dx, p.cy + dy - 4, 3, 5, T('#3f6fd2')[4]); g.hline(p.cx + dx, p.cy + dy - 4, 3, STEEL[5]); g.px(p.cx + dx + 1, p.cy + dy - 2, RED[3]); }
    } else if (/Junimo/.test(n)) {
      const p = table(g, w, h, deep, t, { ...o, round: true, legs: T('#8a5a34') });
      icon(g, 'star', p.cx + 5, p.cy + 2, m.cloth[4]); teapot(g, p.cx - 11, p.cy + 1, T('#f4d44c'), LEAF[3]); g.px(p.cx - 2, p.cy + 5, t[5]); g.px(p.cx + 9, p.cy - 6, t[5]);
    } else if (/Retro/.test(n)) {
      const p = table(g, w, h, deep, t, { ...o, r: 4, peg: true, legs: T('#7b4b2f') });
      g.ellipse(p.cx - 4, p.cy - 2, 6, 4, m.cloth[3]); g.ellipse(p.cx + 6, p.cy + 4, 5, 3.4, m.trim[3]); g.ellipse(p.cx - 4, p.cy - 2, 3, 2, m.cloth[4]);
      mug(g, p.cx + 5, p.cy + 4, WHITE);
    } else if (/Wizard/.test(n)) {
      const p = table(g, w, h, deep, t, { ...o, round: true, legs: T('#3f3463') });
      for (let a = 0; a < 8; a++) g.px(p.cx + Math.cos(a * 0.785) * 11, p.cy + Math.sin(a * 0.785) * 8, GOLD[4]);
      icon(g, 'star', p.cx + 5, p.cy, GOLD[4]); flask(g, p.cx - 10, p.cy + 3, T('#6fe0b0')); teapot(g, p.cx - 5, p.cy - 3, T('#3f3463'), GOLD[4]);
    } else if (/Joja/.test(n)) {
      const p = table(g, w, h, deep, t, { ...o, legs: STEEL });
      g.rect(p.x + 2, p.y + 2, p.w - 4, p.d - 4, k === 'grayjoja' ? T('#3f6fd2')[3] : WHITE[5]); g.rect(p.x + 3, p.y + 3, p.w - 6, p.d - 6, t[3]);
      mug(g, 6, p.y + 6, WHITE); g.rect(18, p.y + 3, 7, 4, PAPER[5]); g.hline(19, p.y + 4, 5, T('#3f6fd2')[3]);
    } else if (/Coffee/.test(n)) {
      const p = table(g, w, h, deep, T('#6b4530'), o);
      g.rect(p.x + 2, p.y + p.d + 2, p.w - 4, 1, T('#6b4530')[1]);
      mug(g, 7, p.y + 6, WHITE); g.px(8, p.y, WHITE[5]); g.px(9, p.y - 1, WHITE[4]); mug(g, 14, p.y + 4, T('#cf463f'));
      g.rect(20, p.y + 3, 7, 5, T('#3f7fd0')[3]); g.hline(20, p.y + 3, 7, T('#3f7fd0')[4]); g.hline(21, p.y + 5, 4, WHITE[5]);
    } else if (k === 'modern') {
      const p = table(g, w, h, deep, STEEL, { ...o, glass: true, legs: STEEL });
      teapot(g, p.cx - 3, p.y + 7, BLACK, RED[3]);
    } else {
      const p = table(g, w, h, deep, t, { ...o, r: k === 'mahogany' ? 2 : 0 });
      if (k === 'oak') { teapot(g, 5, p.y + 7, WHITE, T('#4f7fd6')[3]); mug(g, 16, p.y + 6, WHITE, hex('#9a6a2a')); mug(g, 22, p.y + 4, WHITE, hex('#9a6a2a')); }
      else if (k === 'walnut') { g.rect(4, p.y + 2, p.w - 6, 5, m.cloth[3]); g.hline(4, p.y + 2, p.w - 6, m.cloth[4]); teapot(g, 12, p.y + 6, T('#d9b55c'), RED[3]); }
      else if (k === 'birch') { g.ellipse(p.cx, p.cy, 7, 3, WHITE[5]); teapot(g, p.cx - 4, p.y + 7, T('#6fa0d2'), WHITE[5]); mug(g, 23, p.y + 6, T('#6fa0d2')); }
      else { inlay(g, p, GOLD[3], 1); teapot(g, 6, p.y + 7, WHITE, GOLD[4]); plate(g, 21, p.y + 4); g.px(21, p.y + 3, T('#ee8fb6')[3]); g.px(20, p.y + 3, T('#b0603a')[3]); }
    }
  });
};

// ------------------------------------------------------------------ end tables

function tableLamp(g: Img, cx: number, by: number, shade: Tones, baseT: Tones) {
  g.rect(cx - 2, by, 4, 1, baseT[2]); g.rect(cx - 1, by - 4, 2, 4, baseT[3]); g.px(cx - 1, by - 3, baseT[5]);
  for (let j = 0; j < 6; j++) { const k = 2 + Math.floor((j + 1) / 2); g.hline(cx - k, by - 10 + j, 2 * k, j === 5 ? shade[2] : shade[4]); g.px(cx - k, by - 10 + j, shade[5]); g.px(cx + k - 1, by - 10 + j, shade[3]); }
  g.hline(cx - 2, by - 11, 4, shade[3]);
}
function lampGlow(g: Img, cx: number, cy: number, r: number, col: RGBA = hex('#fff0a0')) {
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    const d = Math.sqrt(i * i + j * j) / r;
    if (d <= 1 && g.alpha(Math.round(cx + i), Math.round(cy + j)) === 0) g.px(cx + i, cy + j, [col[0], col[1], col[2], Math.round(46 * (1 - d))]);
  }
}

painters.endtable = (img, x, y, w, h, c) => {
  const n = c.name, m = mat(n), k = m.key, t = m.wood, b = h - 2, lamp = /Lamp/.test(n);
  const ty = b - 13; // top surface row
  sprite(img, x, y, w, h, (g) => {
    const body = (style: string) => {
      if (style === 'cabinet') { face(g, 2, ty + 5, 12, 8, t); g.rect(4, ty + 7, 8, 5, t[3]); g.hline(4, ty + 7, 8, t[1]); g.px(10, ty + 9, GOLD[4]); g.rect(2, b, 2, 1, t[1]); g.rect(12, b, 2, 1, t[1]); }
      else if (style === 'shelf') { g.rect(3, ty + 5, 10, 6, t[1]); bookFlat(g, 5, ty + 10, RED, 6); bookFlat(g, 5, ty + 8, T('#3f7fd0'), 5); g.hline(2, ty + 11, 12, t[3]); leg(g, 2, ty + 5, 2, 9, t); leg(g, 12, ty + 5, 2, 9, t); }
      else if (style === 'post') { g.rect(7, ty + 5, 2, 7, t[3]); g.vline(8, ty + 5, 7, t[1]); g.ellipse(8, b - 0.5, 4.5, 1.6, t[2]); g.hline(5, b - 1, 5, t[4]); }
      else if (style === 'peg') { face(g, 2, ty + 5, 12, 4, t); g.rect(4, ty + 6, 8, 2, m.cloth[3]); g.px(8, ty + 7, m.trim[4]); for (let j = 0; j < 5; j++) { g.px(3 - (j > 2 ? 1 : 0), ty + 9 + j, t[2]); g.px(12 + (j > 2 ? 1 : 0), ty + 9 + j, t[1]); } }
      else if (style === 'block') { face(g, 2, ty + 5, 12, 9, t); }
      else { face(g, 2, ty + 5, 12, 5, t); g.rect(4, ty + 6, 8, 3, t[3]); g.hline(4, ty + 6, 8, t[4]); g.px(7, ty + 7, GOLD[4]); g.px(8, ty + 7, GOLD[2]); leg(g, 2, ty + 10, 2, 4, t); leg(g, 12, ty + 10, 2, 4, t); g.px(5, ty + 10, t[1]); g.px(10, ty + 10, t[1]); }
    };
    const top = (tt: Tones = t, round = false) => { if (round) { g.ellipse(8, ty + 3.5, 7, 3, tt[2]); g.ellipse(8, ty + 2.5, 7, 3, tt[4]); g.ellipse(8.5, ty + 3, 6.2, 2.4, tt[3]); } else topSlab(g, 1, ty, 14, 4, 1, tt); };
    if (lamp) {
      body(k === 'walnut' ? 'cabinet' : k === 'birch' ? 'shelf' : 'drawer'); top();
      tableLamp(g, 8, ty + 1, k === 'oak' ? T('#f0d9a0') : k === 'walnut' ? T('#e8a05a') : k === 'birch' ? T('#bfe1ef') : T('#f2b8c0'), k === 'mahogany' ? GOLD : k === 'birch' ? WHITE : CLAY);
    } else if (/Grandmother/.test(n)) {
      const tt = T('#8f5a36'); g.rect(7, ty + 5, 2, 7, tt[3]); g.vline(8, ty + 5, 7, tt[1]); g.hline(4, b - 1, 8, tt[3]); g.hline(3, b, 10, tt[2]);
      top(tt, true); g.ellipse(8, ty + 3, 6, 2.6, WHITE[5]); for (let xx = 2; xx < 14; xx += 2) g.px(xx, ty + 5 + (xx % 4 ? 1 : 0), WHITE[5]); g.hline(2, ty + 5, 12, WHITE[3]);
      vase(g, 7, ty + 2, T('#6fa0d2'), T('#ee8fb6'));
    } else if (/Lawn/.test(n)) {
      const tt = T('#e6e9e4'); g.rect(7, ty + 5, 2, 7, tt[3]); g.vline(8, ty + 5, 7, tt[1]); g.hline(4, b - 1, 8, tt[4]); g.hline(3, b, 10, tt[2]); top(tt, true);
      g.rect(6, ty - 2, 3, 4, T('#6fc0f0')[4]); g.hline(6, ty - 2, 3, WHITE[5]); g.line(8, ty - 3, 10, ty - 6, RED[3]); g.px(5, ty - 1, T('#e9c040')[3]);
    } else if (/Desert/.test(n)) {
      body('block'); for (let xx = 3; xx < 13; xx++) g.px(xx, ty + 8 + (xx % 4 < 2 ? 0 : 1), m.cloth[3]); g.hline(3, ty + 11, 10, m.trim[3]); top();
      g.rect(6, ty - 1, 4, 3, CLAY[3]); g.hline(6, ty - 1, 4, CLAY[4]); g.rect(7, ty - 5, 2, 4, LEAF[3]); g.px(7, ty - 5, LEAF[5]); g.px(6, ty - 3, LEAF[3]); g.px(9, ty - 4, LEAF[2]);
    } else if (/Joja/.test(n)) {
      body('block'); g.rect(4, ty + 7, 8, 5, k === 'grayjoja' ? T('#3f6fd2')[3] : WHITE[4]); icon(g, 'joja', 8, ty + 9.5, k === 'grayjoja' ? WHITE[5] : t[2]); top(STEEL);
      mug(g, 9, ty + 2, WHITE);
    } else if (/Junimo/.test(n)) {
      const tr = T('#8a5a34'); g.rect(4, ty + 4, 8, 10, tr[3]); g.vline(4, ty + 4, 10, tr[4]); g.rect(10, ty + 4, 2, 10, tr[1]); g.vline(7, ty + 7, 4, tr[2]); g.px(3, b, tr[2]); g.px(12, b, tr[1]);
      top(t, true); icon(g, 'star5', 8, ty + 3, m.cloth[4]); g.px(13, ty + 6, LEAF[4]); g.px(14, ty + 5, LEAF[3]); g.px(2, ty + 8, LEAF[4]);
    } else if (/Modern/.test(n)) {
      for (const xx of [2, 13]) g.vline(xx, ty + 4, 10, STEEL[2]); g.hline(2, ty + 10, 12, STEEL[3]); top(GLASS); g.line(4, ty + 3, 7, ty + 1, GLASS[5]);
      bookFlat(g, 5, ty + 9, BLACK, 6); g.rect(9, ty - 2, 3, 4, WHITE[5]); g.px(10, ty - 3, LEAF[3]); g.px(9, ty - 4, LEAF[4]); g.px(11, ty - 4, LEAF[2]);
    } else if (/Retro/.test(n)) {
      body('peg'); top(m.trim); g.ellipse(8, ty + 2, 4, 1.4, t[3]);
    } else if (/Winter/.test(n)) {
      body('drawer'); top(WHITE); g.px(1, ty + 5, WHITE[5]); g.px(5, ty + 5, WHITE[5]); g.px(6, ty + 5, WHITE[5]); g.px(11, ty + 5, WHITE[5]); g.px(14, ty + 5, WHITE[5]);
      candle(g, 7, ty + 1, m.cloth, 5);
    } else if (/Wizard/.test(n)) {
      body('cabinet'); icon(g, 'star5', 7, ty + 9.5, GOLD[4]); top(); crystalBall(g, 7, ty + 2, T('#6fe0b0'));
    } else {
      body(k === 'walnut' ? 'cabinet' : k === 'birch' ? 'shelf' : k === 'mahogany' ? 'post' : 'drawer'); top(t, k === 'mahogany');
      if (k === 'oak') bookFlat(g, 5, ty + 2, RED, 6);
      else if (k === 'walnut') { g.rect(6, ty - 2, 4, 4, T('#d9b55c')[3]); g.rect(7, ty - 1, 2, 2, T('#8fcfea')[4]); }
      else if (k === 'mahogany') { g.ellipse(8, ty + 2, 3.5, 1.4, WHITE[5]); vase(g, 7, ty + 2, WHITE, T('#e9c040')); }
      else if (k === 'birch') mug(g, 6, ty + 2, T('#6fa0d2'));
    }
  }, { post: lamp ? (g) => lampGlow(g, 8, ty - 6, 8) : undefined });
};

// ------------------------------------------------------------------ dresser

painters.dresser = (img, x, y, w, h, c) => {
  const n = c.name, m = mat(n), k = m.key, t = m.wood, b = h - 2;
  const ty = b - 21;
  sprite(img, x, y, w, h, (g) => {
    const dt = k === 'joja' ? WHITE : k === 'grayjoja' ? T('#3f6fd2') : k === 'retro' ? m.cloth : k === 'junimo' ? T('#8a5a34') : t;
    const knob = k === 'modern' || k === 'joja' || k === 'grayjoja' ? STEEL : k === 'junimo' ? m.cloth : GOLD;
    face(g, 1, ty + 4, w - 2, 16, t); g.vline(1, ty + 4, 16, t[3]);
    const drawer = (dx: number, dy: number, dw: number, dh: number) => {
      g.rect(dx, dy, dw, dh, dt[3]); g.hline(dx, dy, dw, dt[4]); g.hline(dx, dy + dh - 1, dw, dt[1]); g.vline(dx + dw - 1, dy, dh, dt[2]);
      const cx = dx + Math.floor(dw / 2);
      if (dw > 12) { g.px(cx - 4, dy + Math.floor(dh / 2), knob[4]); g.px(cx + 3, dy + Math.floor(dh / 2), knob[4]); if (k === 'modern') g.hline(cx - 4, dy + Math.floor(dh / 2), 8, knob[4]); }
      else { g.px(cx - 1, dy + Math.floor(dh / 2), knob[4]); g.px(cx, dy + Math.floor(dh / 2), knob[2]); }
    };
    const lay = ({ oak: 0, walnut: 1, birch: 2, mahogany: 3, joja: 0, grayjoja: 1, junimo: 2, retro: 3, wizard: 1 } as Record<string, number>)[k] ?? 0;
    if (lay === 0) { for (let r = 0; r < 3; r++) drawer(3, ty + 5 + r * 5, w - 6, 4); }
    else if (lay === 1) { for (let r = 0; r < 3; r++) { drawer(3, ty + 5 + r * 5, 12, 4); drawer(17, ty + 5 + r * 5, 12, 4); } }
    else if (lay === 2) { drawer(3, ty + 5, 12, 4); drawer(17, ty + 5, 12, 4); drawer(3, ty + 10, w - 6, 4); drawer(3, ty + 15, w - 6, 4); }
    else { drawer(3, ty + 5, 12, 14); drawer(17, ty + 5, 12, 4); drawer(17, ty + 10, 12, 4); drawer(17, ty + 15, 12, 4); g.rect(4, ty + 7, 10, 10, dt[2]); g.hline(4, ty + 7, 10, dt[1]); }
    // feet
    if (k === 'retro') { for (const xx of [3, w - 5]) { g.rect(xx, b - 1, 2, 2, T('#7b4b2f')[2]); } clearRow(g, b - 1, 6, w - 12); }
    else { g.rect(1, b - 1, 4, 2, t[1]); g.rect(w - 5, b - 1, 4, 2, t[1]); g.hline(5, b - 1, w - 10, t[1]); }
    topSlab(g, 0 + 1, ty, w - 2, 4, 1, k === 'joja' || k === 'grayjoja' ? STEEL : t);
    // things on top
    const mirror = (cx: number, fr: Tones, round = true) => {
      if (round) { g.ellipse(cx, ty - 3.5, 5, 6, fr[3]); g.ellipse(cx, ty - 3.5, 3.6, 4.6, GLASS[4]); g.line(cx - 2, ty - 3, cx, ty - 6, GLASS[5]); }
      else { g.rect(cx - 5, ty - 9, 10, 11, fr[3]); g.hline(cx - 5, ty - 9, 10, fr[4]); g.rect(cx - 3, ty - 7, 6, 8, GLASS[4]); g.line(cx - 2, ty - 2, cx + 1, ty - 6, GLASS[5]); }
      g.rect(cx - 3, ty + 1, 6, 1, fr[2]);
    };
    if (k === 'oak') { mirror(16, t); vase(g, 5, ty + 2, T('#6fa0d2'), T('#e9c040')); }
    else if (k === 'walnut') { mirror(10, t, false); candle(g, 22, ty + 2, WHITE, 5); bookFlat(g, 19, ty + 3, RED, 7); }
    else if (k === 'birch') { vase(g, 14, ty + 2, T('#ee8fb6'), WHITE); g.rect(22, ty - 2, 5, 4, t[2]); g.rect(23, ty - 1, 3, 2, T('#bfe1ef')[4]); g.rect(4, ty, 5, 2, T('#6fa0d2')[3]); }
    else if (k === 'mahogany') { mirror(16, GOLD); g.rect(4, ty, 5, 2, RED[3]); g.px(6, ty, GOLD[4]); flask(g, 23, ty + 2, T('#ee8fb6')); }
    else if (k === 'joja') { g.rect(4, ty - 6, 10, 8, STEEL[2]); g.rect(5, ty - 5, 8, 5, T('#3f6fd2')[3]); icon(g, 'joja', 9, ty - 2.5, WHITE[5]); mug(g, 21, ty + 2, WHITE); }
    else if (k === 'grayjoja') { bookFlat(g, 4, ty + 2, T('#3f6fd2'), 8); bookFlat(g, 5, ty, WHITE, 6); g.rect(21, ty - 4, 6, 6, STEEL[3]); g.rect(22, ty - 3, 4, 3, T('#6fe0b0')[3]); }
    else if (k === 'junimo') { g.rect(12, ty - 2, 8, 4, T('#8a5a34')[3]); g.ellipse(16, ty - 5, 5, 4, LEAF[3]); g.ellipse(15, ty - 6, 3, 2, LEAF[4]); icon(g, 'star5', 16, ty - 5, m.cloth[4]); g.px(5, ty + 1, m.cloth[4]); g.px(26, ty + 1, T('#ee8fb6')[3]); }
    else if (k === 'retro') { g.ellipse(9, ty - 3, 4, 5, t[3]); g.ellipse(9, ty - 3, 2.6, 3.6, GLASS[4]); g.rect(8, ty + 1, 2, 1, t[2]); g.rect(20, ty - 3, 7, 5, m.trim[3]); g.rect(21, ty - 2, 3, 3, BLACK[2]); g.px(25, ty - 1, RED[3]); }
    else if (k === 'wizard') { crystalBall(g, 9, ty + 2); candle(g, 20, ty + 2, T('#b9a6d8'), 6); flask(g, 23, ty + 2, T('#6fe0b0')); for (const xx of [9, 23]) icon(g, 'star5', xx, ty + 12, GOLD[4]); }
  });
};
function clearRow(g: Img, y: number, x: number, w: number) { for (let i = x; i < x + w; i++) { clearPx(g, i, y); clearPx(g, i, y + 1); } }

// ------------------------------------------------------------------ bookcase

const BOOKS = ['#c8453d', '#3f7fd0', '#4fa651', '#e9c040', '#8a5cc2', '#e8873a', '#3aa79f', '#b0603a', '#e3dccb', '#7b4b2f'];
/** One shelf compartment filled with book spines. */
function bookRow(g: Img, x: number, y: number, w: number, hh: number, seed: number, pal: string[] = BOOKS, back: RGBA = hex('#3a2630')) {
  g.rect(x, y, w, hh, back);
  let i = x, last = -1;
  while (i < x + w) {
    const r = hash(i, y, seed);
    let bw = r < 0.5 ? 2 : 3;
    if (i + bw > x + w) bw = x + w - i;
    if (bw < 2) break;
    if (hash(i, y, seed + 5) < 0.1 && i > x) { // leaning book
      const t = T(pal[(last + 3) % pal.length]);
      if (i + 4 <= x + w) { for (let j = 0; j < hh - 2; j++) g.px(i + (j < (hh - 2) / 2 ? 2 : 1) + (j < 1 ? 1 : 0) - (j > hh - 4 ? 1 : 0), y + 2 + j, t[3]); g.px(i + 1, y + hh - 1, t[2]); i += 4; continue; }
    }
    let ci = Math.floor(hash(i, y, seed + 3) * pal.length);
    if (ci === last) ci = (ci + 1) % pal.length;
    last = ci;
    const t = T(pal[ci]), bh = hh - 1 - Math.floor(hash(i, y, seed + 9) * 3);
    g.rect(i, y + hh - bh, bw, bh, t[3]); g.vline(i, y + hh - bh, bh, t[4]); if (bw > 2) g.vline(i + bw - 1, y + hh - bh, bh, t[2]);
    g.hline(i, y + hh - bh + 1, bw, t[5]); if (bh > 5) g.hline(i, y + hh - 2, bw, t[1]);
    i += bw;
  }
}
function potionRow(g: Img, x: number, y: number, w: number, hh: number, seed: number, back: RGBA = hex('#3a2630')) {
  g.rect(x, y, w, hh, back);
  let i = x + 1, k = seed;
  while (i + 3 <= x + w) {
    const t = T(POTIONS[k % POTIONS.length]);
    if (k % 3 === 1 && i + 5 <= x + w) { flask(g, i, y + hh - 1, t); i += 6; } else { bottle(g, i, y + hh - 1, t, Math.min(hh, 6 + (k % 2))); i += 4; }
    k += 3;
  }
}
/** Cabinet frame. Returns the interior compartments (rows). */
function caseFrame(g: Img, x0: number, top: number, w: number, b: number, t: Tones, rows: number, o: { crown?: Tones; plinth?: number } = {}) {
  const pl = o.plinth ?? 2;
  g.rect(x0, top, w, b - top + 1, t[3]); g.vline(x0, top, b - top + 1, t[4]); g.vline(x0 + w - 1, top, b - top + 1, t[2]);
  const cr = o.crown ?? t;
  g.rect(x0, top, w, 2, cr[4]); g.hline(x0, top, w, cr[5]); g.hline(x0, top + 2, w, t[1]);
  g.rect(x0, b - pl + 1, w, pl, t[2]); g.hline(x0, b, w, t[1]);
  const iy = top + 3, ih = b - pl - iy, out: { x: number; y: number; w: number; h: number }[] = [];
  for (let r = 0; r < rows; r++) {
    const y0 = iy + Math.round((r * (ih + 1)) / rows), y1 = iy + Math.round(((r + 1) * (ih + 1)) / rows) - 1;
    out.push({ x: x0 + 2, y: y0, w: w - 4, h: y1 - y0 });
    g.hline(x0 + 1, y1, w - 2, t[4]);
  }
  return out;
}

painters.bookcase = (img, x, y, w, h, c) => {
  const n = c.name, m = mat(n), k = m.key, t = m.wood, b = h - 2, seed = pick(n, 97);
  sprite(img, x, y, w, h, (g) => {
    if (/Fridge/.test(n)) {
      const s = T('#3f6fd2');
      rr(g, 2, 3, w - 4, b - 2, s[3], 1); g.vline(2, 4, b - 4, s[4]); g.vline(w - 3, 4, b - 4, s[2]); g.rect(2, b - 2, w - 4, 3, s[1]);
      g.rect(4, 5, w - 8, 7, WHITE[5]); g.rect(5, 6, w - 10, 5, RED[3]); icon(g, 'joja', 10, 8.5, WHITE[5]); for (const xx of [14, 17, 20, 23]) g.vline(xx, 7, 3, WHITE[5]); g.hline(14, 7, 2, WHITE[5]); g.hline(17, 7, 3, WHITE[5]); g.hline(17, 9, 3, WHITE[5]);
      g.rect(4, 14, w - 10, b - 18, T('#1f2a4a')[3]);
      for (let r = 0; r < 3; r++) { const yy = 15 + r * 7; for (let i = 0; i < 5; i++) { const cn = T(['#cf463f', '#3f6fd2', '#e9c040'][(i + r) % 3]); g.rect(5 + i * 4, yy, 3, 5, cn[3]); g.vline(5 + i * 4, yy, 5, cn[5]); g.hline(5 + i * 4, yy, 3, STEEL[5]); } g.hline(4, yy + 5, w - 10, STEEL[4]); }
      g.line(6, 30, 12, 16, [255, 255, 255, 60]); g.line(8, 32, 14, 18, [255, 255, 255, 60]);
      g.rect(w - 5, 16, 2, 12, STEEL[4]); g.vline(w - 4, 16, 12, STEEL[2]);
    } else if (/Vault/.test(n)) {
      const s = T('#8d95a8');
      rr(g, 1, 3, w - 2, b - 2, s[3], 1); g.hline(2, 3, w - 4, s[5]); g.vline(1, 4, b - 4, s[4]); g.rect(1, b - 2, w - 2, 3, s[1]); g.vline(w - 2, 4, b - 4, s[2]);
      for (const [xx, yy] of [[3, 5], [w - 4, 5], [3, b - 4], [w - 4, b - 4], [3, 20], [w - 4, 20]]) g.px(xx, yy, s[1]);
      circle(g, 16, 20, 11, s[1]); circle(g, 16, 20, 10, s[4]); circle(g, 16.5, 20.5, 9, s[3]); circle(g, 16, 20, 5.5, s[1]); circle(g, 16, 20, 4.5, T('#3f6fd2')[3]);
      for (let a = 0; a < 6; a++) g.line(16, 20, 16 + Math.cos(a * 1.047) * 7, 20 + Math.sin(a * 1.047) * 7, s[5]);
      circle(g, 16, 20, 2, GOLD[4]); icon(g, 'joja', 16, 7, T('#3f6fd2')[3]);
      g.rect(27, 14, 2, 4, s[1]); g.rect(27, 24, 2, 4, s[1]);
    } else if (/China/.test(n)) {
      const tt = T('#8f5a36');
      const rows = caseFrame(g, 1, 2, w - 2, b, tt, 2, { plinth: 10 });
      rows.forEach((r, ri) => {
        g.rect(r.x, r.y, r.w, r.h, hex('#4a3640'));
        for (let i = 0; i < 6; i++) { const cx = r.x + 4 + i * 7; if ((i + ri) % 2 === 0) { circle(g, cx, r.y + r.h - 3.5, 3, WHITE[5]); circle(g, cx, r.y + r.h - 3.5, 1.6, T('#6fa0d2')[4]); } else { g.rect(cx - 2, r.y + r.h - 3, 4, 3, WHITE[5]); g.hline(cx - 2, r.y + r.h - 2, 4, T('#ee8fb6')[3]); g.px(cx + 2, r.y + r.h - 2, WHITE[3]); } }
        g.line(r.x + 3, r.y + r.h - 1, r.x + 8, r.y, [255, 255, 255, 70]); g.line(r.x + 27, r.y + r.h - 1, r.x + 32, r.y, [255, 255, 255, 70]);
      });
      g.vline(w / 2 - 1, 5, b - 16, tt[3]); g.vline(w / 2, 5, b - 16, tt[2]);
      for (const x0 of [3, w / 2 + 1]) { g.rect(x0, b - 8, w / 2 - 4, 6, tt[3]); g.hline(x0, b - 8, w / 2 - 4, tt[4]); g.hline(x0, b - 3, w / 2 - 4, tt[1]); }
      g.px(w / 2 - 3, b - 6, GOLD[4]); g.px(w / 2 + 2, b - 6, GOLD[4]); g.rect(8, 0, w - 16, 2, tt[3]); g.hline(8, 0, w - 16, tt[5]);
    } else if (/Brochure/.test(n)) {
      const tt = T('#a87a4a');
      const rows = caseFrame(g, 1, 6, w - 2, b, tt, 3, { plinth: 3 });
      rows.forEach((r, ri) => {
        g.rect(r.x, r.y, r.w, r.h, hex('#4a3640'));
        for (let i = 0; i < 7; i++) { const col = T(BOOKS[(i * 3 + ri * 2 + 1) % 9]); const bx = r.x + 1 + i * 6; g.rect(bx, r.y + 1, 5, r.h - 1, PAPER[5]); g.rect(bx, r.y + 1, 5, 3, col[3]); g.hline(bx + 1, r.y + 5, 3, col[2]); g.hline(bx + 1, r.y + 7, 3, PAPER[1]); }
        g.rect(r.x, r.y + r.h - 2, r.w, 2, tt[3]); g.hline(r.x, r.y + r.h - 2, r.w, tt[4]);
      });
      g.rect(14, 3, w - 28, 4, T('#3f7fd0')[3]); g.hline(16, 5, w - 32, WHITE[5]);
    } else if (/Retro Cabinet/.test(n)) {
      face(g, 1, 14, w - 2, b - 17, t); topSlab(g, 1, 10, w - 2, 4, 1, m.trim);
      for (const x0 of [3, 17]) { g.rect(x0, 16, 12, b - 21, m.cloth[3]); g.hline(x0, 16, 12, m.cloth[4]); g.hline(x0, b - 6, 12, m.cloth[1]); circle(g, x0 + (x0 === 3 ? 9 : 3), 24, 1.5, m.trim[4]); rr(g, x0 + 2, 18, 5, 4, m.cloth[2], 1); }
      for (let j = 0; j < 4; j++) { g.px(4 - (j > 1 ? 1 : 0), b - 3 + j, T('#7b4b2f')[2]); g.px(w - 5 + (j > 1 ? 1 : 0), b - 3 + j, T('#7b4b2f')[2]); }
      g.ellipse(9, 7, 4, 3, m.cloth[3]); g.rect(8, 3, 2, 2, m.cloth[3]); g.px(8, 6, m.cloth[5]); // vase
      g.rect(18, 4, 9, 6, T('#7b4b2f')[3]); g.rect(19, 5, 5, 4, BLACK[2]); g.px(25, 6, GOLD[4]); g.px(25, 8, GOLD[4]); g.line(21, 3, 19, 0, STEEL[4]); g.line(23, 3, 25, 0, STEEL[4]);
    } else if (/Elixir/.test(n)) {
      const tt = T('#6b4a3a'), small = /Small/.test(n), two = c.th >= 2;
      const top = two ? (small ? 14 : 3) : small ? 18 : 6;
      const rows = caseFrame(g, small ? 3 : 1, top, small ? w - 6 : w - 2, b, tt, Math.max(1, Math.round((b - top) / 11)), { plinth: 1 });
      rows.forEach((r, ri) => potionRow(g, r.x, r.y, r.w, r.h, seed + ri * 5));
      if (!small) { g.rect(w / 2 - 4, top - 3, 8, 3, tt[3]); icon(g, 'drop', w / 2, top - 1, T('#6fe0b0')[3]); }
      else { flask(g, 6, top - 1, T('#8a5cc2')); bottle(g, w - 12, top - 1, T('#4fa651'), 8); }
    } else if (/Wizard Study/.test(n)) {
      const rows = caseFrame(g, 1, 2, 22, b, t, 3, { crown: GOLD });
      rows.forEach((r, ri) => (ri === 1 ? potionRow(g, r.x, r.y, r.w, r.h, seed) : bookRow(g, r.x, r.y, r.w, r.h, seed + ri)));
      const dk = T('#3f3463'); // desk
      face(g, 23, 22, w - 24, b - 22, dk); topSlab(g, 23, 18, w - 24, 4, 1, t); g.rect(25, 25, w - 28, 5, t[3]); g.px(w / 2 + 12, 27, GOLD[4]); g.rect(27, 31, w - 32, b - 31, hex('#2a2038'));
      crystalBall(g, 29, 20, T('#6fe0b0')); openBook(g, 39, 17); candle(g, 44, 18, T('#b9a6d8'), 6);
    } else {
      const short = /Short|Small/.test(n) && c.th < 2, two = c.th >= 2;
      const top = short ? 16 : two ? 3 : 3;
      const nrows = short ? 2 : two ? 5 : 3;
      const pal = k === 'joja' ? ['#3f6fd2', '#e3dccb', '#cf463f', '#2c4a9a', '#8d95a8'] : k === 'grayjoja' ? ['#3f6fd2', '#e3dccb', '#5a6272', '#2c4a9a', '#a9b2bf'] : k === 'wizard' ? ['#8a5cc2', '#3f3463', '#3aa79f', '#e9c040', '#4b2f6e', '#c8453d', '#3f7fd0'] : k === 'dark' ? ['#7c4eb0', '#8a2f2f', '#3f3463', '#5a6272', '#2c4a6e'] : k === 'retro' ? ['#e2853c', '#3aa79f', '#f6e7b8', '#c8453d', '#e9c040'] : k === 'junimo' ? ['#4fa651', '#e9c040', '#8a5a34', '#9fd487', '#e8873a', '#ee8fb6'] : k === 'modern' ? ['#e3dccb', '#4b5669', '#cf463f', '#a9b2bf', '#2c3a4e'] : k === 'luxury' ? ['#8a2f2f', '#2f5a3a', '#2c3a6e', '#e6b93e', '#5b3b2e'] : BOOKS;
      const fr = k === 'plain' ? T('#a8703f') : k === 'luxury' ? T('#7a3a2a') : k === 'modern' ? T('#e2e5ea') : t;
      const rows = caseFrame(g, 1, top, w - 2, b, fr, nrows, { crown: k === 'luxury' || k === 'wizard' ? GOLD : fr, plinth: k === 'modern' ? 1 : 2 });
      rows.forEach((r, ri) => {
        if (k === 'modern') { // cube compartments
          g.rect(r.x, r.y, r.w, r.h, hex('#4a4f5c'));
          const cw = Math.floor(r.w / 3);
          for (let i = 0; i < 3; i++) { const cx = r.x + i * cw + (i ? 1 : 0); if ((i + ri) % 3 === 1) { g.rect(cx + 2, r.y + r.h - 4, 4, 4, WHITE[5]); g.px(cx + 3, r.y + r.h - 6, LEAF[3]); g.px(cx + 4, r.y + r.h - 5, LEAF[4]); g.px(cx + 5, r.y + r.h - 6, LEAF[2]); } else bookRow(g, cx, r.y, cw - 1 - ((i + ri) % 2) * 2, r.h, seed + ri * 3 + i, pal, hex('#4a4f5c')); if (i) g.vline(r.x + i * cw, r.y, r.h, fr[3]); }
        } else if (/Artist/.test(n) && ri === 1) {
          g.rect(r.x, r.y, r.w, r.h, hex('#3a2630'));
          ['#cf463f', '#e9c040', '#3f7fd0', '#4fa651'].forEach((col, i) => { g.rect(r.x + 1 + i * 4, r.y + r.h - 4, 3, 4, T(col)[3]); g.hline(r.x + 1 + i * 4, r.y + r.h - 4, 3, WHITE[5]); });
          g.rect(r.x + 19, r.y + r.h - 4, 4, 4, STEEL[3]); g.vline(r.x + 19, r.y + 1, r.h - 4, T('#d9b06a')[3]); g.vline(r.x + 21, r.y, r.h - 3, T('#d9b06a')[3]); g.vline(r.x + 22, r.y + 2, r.h - 5, T('#d9b06a')[2]); g.px(r.x + 19, r.y, RED[3]); g.px(r.x + 22, r.y + 1, T('#3f7fd0')[3]);
          g.rect(r.x + 24, r.y + r.h - 2, 4, 2, PAPER[5]);
        } else if (k === 'wizard' && ri === nrows - 1 && r.w > 16) {
          bookRow(g, r.x, r.y, r.w - 12, r.h, seed + ri, pal); g.rect(r.x + r.w - 12, r.y, 12, r.h, hex('#3a2630'));
          flask(g, r.x + r.w - 11, r.y + r.h - 1, T('#6fe0b0')); icon(g, 'skull', r.x + r.w - 3, r.y + r.h - 3, WHITE[4]); g.rect(r.x + r.w - 6, r.y, 6, r.h - 6, hex('#3a2630'));
          g.rect(r.x + r.w - 5, r.y + r.h - 5, 4, 5, WHITE[4]); g.px(r.x + r.w - 4, r.y + r.h - 3, INK); g.px(r.x + r.w - 2, r.y + r.h - 3, INK); g.rect(r.x + r.w - 6, r.y + r.h - 6, 6, 1, hex('#3a2630'));
        } else if (k === 'junimo' && ri === 0) {
          bookRow(g, r.x, r.y, r.w - 9, r.h, seed, pal); g.rect(r.x + r.w - 9, r.y, 9, r.h, hex('#3a2630')); g.rect(r.x + r.w - 7, r.y + r.h - 3, 5, 3, CLAY[3]); g.ellipse(r.x + r.w - 4.5, r.y + r.h - 5, 3, 2, LEAF[3]); g.px(r.x + r.w - 5, r.y + r.h - 6, LEAF[5]);
        } else if (k === 'luxury' && ri === 1) {
          bookRow(g, r.x, r.y, 10, r.h, seed + 4, pal); g.rect(r.x + 10, r.y, r.w - 10, r.h, hex('#3a2630')); circle(g, r.x + 15, r.y + r.h - 3.5, 3, T('#3f7fd0')[3]); g.px(r.x + 14, r.y + r.h - 5, GREEN[3]); g.px(r.x + 16, r.y + r.h - 3, GREEN[3]); g.hline(r.x + 13, r.y + r.h - 1, 5, GOLD[3]); bookRow(g, r.x + 20, r.y, r.w - 20, r.h, seed + 6, pal);
        } else bookRow(g, r.x, r.y, r.w, r.h, seed + ri * 7, pal);
      });
      if (k === 'wizard') { icon(g, 'star5', w / 2, top - 1, GOLD[4]); g.px(w / 2, top - 3, GOLD[5]); if (two) icon(g, 'moon', w / 2, top + 1, GOLD[5]); }
      else if (k === 'junimo') { for (let xx = 2; xx < w - 2; xx += 3) { g.px(xx, top - 1, LEAF[3 + (xx % 2)]); g.px(xx + 1, top - 2 + (xx % 2), LEAF[4]); } icon(g, 'star5', w / 2, top, m.cloth[4]); }
      else if (k === 'luxury') { rr(g, 6, top - 2, w - 12, 2, GOLD[3], 1); g.px(w / 2, top - 3, GOLD[5]); g.px(w / 2 - 1, top - 3, GOLD[4]); }
      else if (k === 'joja' || k === 'grayjoja') { g.rect(w / 2 - 4, top - 0, 8, 2, WHITE[5]); g.hline(w / 2 - 2, top, 4, T('#3f6fd2')[3]); }
      else if (k === 'retro') { g.ellipse(8, top - 2, 3, 2, m.cloth[3]); g.rect(20, top - 3, 5, 3, m.trim[3]); for (let j = 0; j < 3; j++) { clearPx(g, 1, b - j); clearPx(g, 2, b - j); } }
      else if (k === 'dark') { candle(g, 6, top - 1, T('#b9a6d8'), 4); icon(g, 'skull', w - 9, top - 3, WHITE[3]); }
      else if (/Artist/.test(n)) { g.ellipse(9, top - 2, 5, 2.4, T('#d9b06a')[3]); g.px(6, top - 2, RED[3]); g.px(8, top - 3, T('#3f7fd0')[3]); g.px(10, top - 2, GOLD[4]); g.px(12, top - 3, GREEN[3]); g.line(20, top - 1, 26, top - 4, T('#8a5a34')[3]); g.px(27, top - 4, RED[3]); }
      else if (short) { vase(g, 6, top - 1, T('#6fa0d2'), T('#e9c040')); bookFlat(g, 18, top - 1, RED, 8); bookFlat(g, 19, top - 3, GREEN, 6); }
    }
  });
};

// ------------------------------------------------------------------ lamp

function trapShade(g: Img, cx: number, y: number, a: number, bw: number, hh: number, t: Tones) {
  for (let j = 0; j < hh; j++) {
    const k = Math.round(a + ((bw - a) * j) / (hh - 1));
    g.hline(cx - k, y + j, 2 * k, j === hh - 1 ? t[2] : t[4]); g.px(cx - k, y + j, t[5]); g.rect(cx + k - 2, y + j, 2, 1, t[3]);
  }
}
function lampPole(g: Img, top: number, b: number, t: Tones, x = 7) {
  g.rect(x, top, 2, b - top, t[3]); g.vline(x + 1, top, b - top, t[1]); g.px(x, top + 2, t[5]);
  g.ellipse(8, b - 0.5, 4.5, 1.6, t[2]); g.hline(5, b - 1, 5, t[4]);
}

painters.lamp = (img, x, y, w, h, c) => {
  const n = c.name, m = mat(n), b = h - 2;
  let glow: [number, number, number, RGBA?] | null = [8, 9, 9];
  let post: Draw | undefined;
  const key = n.replace(/ (Lamp|Light|Torch|Lantern)$/, '');
  sprite(img, x, y, w, h, (g) => {
    switch (key) {
      case 'Box': {
        const t = T('#6b4530'), p = T('#f6e2a0');
        glow = [8, 22, 11];
        g.rect(3, 14, 10, b - 15, p[4]); g.rect(5, 17, 6, b - 21, p[5]); g.rect(6, 20, 4, 8, hex('#fff8d8'));
        for (const xx of [3, 12]) g.vline(xx, 13, b - 13, t[3]); g.vline(8, 14, b - 15, t[2]);
        for (const yy of [13, 22, b - 2]) g.hline(3, yy, 10, t[3]); g.hline(2, 12, 12, t[4]); g.hline(2, b - 1, 12, t[2]); g.rect(2, b, 2, 1, t[1]); g.rect(12, b, 2, 1, t[1]);
        break;
      }
      case 'Candle': {
        const t = T('#5a5560');
        lampPole(g, 16, b, t); g.hline(3, 16, 10, t[3]); g.hline(3, 17, 10, t[1]); g.px(3, 15, t[3]); g.px(12, 15, t[3]); g.px(2, 14, t[4]); g.px(13, 14, t[2]);
        for (const [cx, ty] of [[2, 9], [7, 6], [12, 9]]) { g.rect(cx, ty, 2, 14 - ty + (cx === 7 ? 2 : 0), WHITE[4]); g.vline(cx + 1, ty, 14 - ty, WHITE[2]); g.px(cx, ty + 2, WHITE[5]); }
        post = (g) => { for (const [cx, ty] of [[2.5, 8], [7.5, 5], [12.5, 8]]) flame(g, 's', cx + 1, ty); };
        glow = [8, 6, 9];
        break;
      }
      case 'Classic': lampPole(g, 12, b, GOLD); g.rect(6, 18, 4, 2, GOLD[4]); trapShade(g, 8, 3, 3, 6, 9, T('#f0e2b8')); g.hline(4, 9, 8, T('#d9b55c')[3]); break;
      case 'Country': {
        lampPole(g, 12, b, T('#9a6a42')); const s = T('#f1ece0'); trapShade(g, 8, 4, 3, 6, 8, s);
        for (let j = 0; j < 7; j++) for (let i = -6; i < 6; i++) if (g.alpha(8 + i, 4 + j) && ((i + 6 >> 1) + (j >> 1)) % 2 === 0) g.px(8 + i, 4 + j, RED[j === 6 ? 2 : 3]);
        g.rect(6, 22, 4, 2, T('#9a6a42')[4]);
        break;
      }
      case 'Decorative': {
        const t = T('#b03a3a');
        glow = [8, 24, 10];
        g.rect(3, 17, 10, 2, t[3]); g.hline(3, 17, 10, t[4]); g.rect(5, 15, 6, 2, t[2]); g.rect(4, 19, 8, b - 21, hex('#ffe9a0')); g.rect(6, 21, 4, 6, hex('#fff8d8'));
        for (const xx of [4, 8, 11]) g.vline(xx, 19, b - 21, t[xx === 11 ? 2 : 3]);
        g.rect(3, b - 2, 10, 3, t[2]); g.hline(3, b - 2, 10, t[4]); g.hline(4, 24, 8, t[3]);
        g.hline(6, 10, 4, STEEL[3]); g.vline(5, 11, 4, STEEL[3]); g.vline(10, 11, 4, STEEL[2]);
        g.px(8, 25, hex('#f9b93c')); g.px(8, 26, hex('#e8622a'));
        break;
      }
      case 'J. Cola': {
        const t = T('#3f6fd2');
        glow = [8, 18, 11, hex('#a0d0ff')];
        g.rect(7, 5, 2, 3, STEEL[4]); g.hline(6, 5, 4, RED[3]); rr(g, 5, 8, 6, 4, T('#9fd0f0')[4], 2); rr(g, 3, 11, 10, b - 13, T('#9fd0f0')[4], 2); g.vline(4, 13, b - 17, hex('#eaf8ff')); g.rect(10, 12, 2, b - 16, T('#9fd0f0')[3]);
        g.rect(3, 17, 10, 8, RED[3]); g.hline(3, 17, 10, WHITE[5]); g.hline(3, 24, 10, WHITE[5]); icon(g, 'joja', 8, 21, WHITE[5]);
        g.rect(3, b - 2, 10, 3, t[2]); g.hline(3, b - 2, 10, t[4]);
        break;
      }
      case 'Joja': lampPole(g, 11, b, STEEL); g.rect(3, 3, 10, 9, m.wood[3]); g.vline(3, 3, 9, m.wood[4]); g.vline(12, 3, 9, m.wood[2]); g.rect(3, 6, 10, 3, WHITE[5]); g.hline(3, 11, 10, hex('#fff0a0')); g.hline(3, 3, 10, m.wood[5]); g.hline(6, 7, 4, m.wood[3]); break;
      case 'Jungle': {
        const t = T('#c9a85a');
        g.rect(7, 12, 2, b - 11, t[3]); g.vline(8, 12, b - 11, t[1]); for (let j = 16; j < b; j += 5) g.hline(7, j, 2, t[1]);
        for (let j = 0; j < 5; j++) { g.hline(5 + Math.floor(j / 2), 9 + j, 6 - 2 * Math.floor(j / 2) + 0, T('#8a5a34')[3]); }
        g.hline(4, 8, 8, T('#8a5a34')[4]); for (let i = 5; i < 11; i += 2) g.px(i, 10, T('#8a5a34')[1]);
        g.px(4, 14, LEAF[3]); g.px(3, 15, LEAF[4]); g.px(11, 15, LEAF[3]); g.px(12, 16, LEAF[2]);
        post = (g) => flame(g, 'm', 8.5, 7);
        glow = [8, 5, 9];
        break;
      }
      case 'Junimo': {
        const t = T('#62b04c');
        for (let j = 12; j < b; j++) { const xx = 7 + Math.round(Math.sin(j * 0.45) * 1.2); g.rect(xx, j, 2, 1, t[3]); g.px(xx + 1, j, t[1]); }
        g.ellipse(8, b - 0.5, 4.5, 1.6, T('#8a5a34')[2]); g.hline(5, b - 1, 5, T('#8a5a34')[4]);
        for (const [lx, ly, d] of [[10, 22, 1], [4, 26, -1], [10, 16, 1]]) { g.rect(lx, ly, 3, 2, t[4]); g.px(lx + (d > 0 ? 3 : -1), ly, t[3]); g.px(lx + 1, ly + 1, t[2]); }
        const s = T('#f6dc5a'); stamp(g, 2, 1, ['.....##.....', '.....##.....', '....####....', '############', '.##########.', '..########..', '..########..', '.####..####.', '.###....###.', '.##......##.'], { '#': s[4] });
        g.rect(6, 4, 4, 4, hex('#fffbe0')); g.px(6, 6, INK); g.px(9, 6, INK);
        glow = [8, 6, 10];
        break;
      }
      case 'Modern': {
        g.ellipse(9, b - 0.5, 5, 1.6, STEEL[2]); g.hline(5, b - 1, 7, STEEL[5]);
        g.vline(12, 8, b - 8, STEEL[3]); g.px(11, 7, STEEL[3]); g.px(10, 6, STEEL[4]); g.hline(6, 5, 4, STEEL[4]); g.px(5, 6, STEEL[3]);
        orb(g, 5.5, 10, 3.6, T('#f4f1e4')); g.hline(4, 7, 3, STEEL[2]);
        glow = [5, 11, 9];
        break;
      }
      case 'Ornate': {
        lampPole(g, 12, b, GOLD); for (const yy of [16, 22, 27]) { g.rect(6, yy, 4, 2, GOLD[4]); g.hline(6, yy + 1, 4, GOLD[2]); }
        trapShade(g, 8, 2, 2, 6, 10, T('#a03a5a')); for (let i = 2; i < 14; i += 2) g.px(i, 12, GOLD[4]); g.hline(3, 10, 10, GOLD[3]); g.hline(6, 2, 4, GOLD[4]);
        break;
      }
      case 'Retro': {
        lampPole(g, 11, b, m.trim); circle(g, 8, 20, 2, m.cloth[3]); g.px(7, 19, m.cloth[5]);
        g.ellipse(8, 9, 6.5, 6.5, m.wood[3]); for (let j = 10; j < 17; j++) for (let i = 0; i < 16; i++) clearPx(g, i, j);
        g.ellipse(7, 6, 3.5, 2, m.wood[4]); g.px(5, 5, m.wood[5]); g.hline(2, 9, 12, m.wood[2]); g.hline(4, 10, 8, hex('#fff0a0'));
        g.rect(4, 6, 2, 2, m.cloth[3]); g.rect(10, 5, 2, 2, m.trim[4]);
        break;
      }
      case 'Plain': {
        const t = T('#8a5a34');
        g.rect(7, 14, 2, b - 13, t[3]); g.vline(8, 14, b - 13, t[1]); g.rect(6, 11, 4, 4, T('#d9c9a0')[3]); g.hline(6, 12, 4, T('#d9c9a0')[1]); g.hline(6, 14, 4, T('#d9c9a0')[1]); g.px(6, b, t[2]); g.px(9, b, t[2]);
        post = (g) => flame(g, 'm', 8.5, 10);
        glow = [8, 7, 9];
        break;
      }
      case 'Stump': {
        const t = T('#8a5a34'), r = T('#e0c48a');
        g.rect(3, b - 12, 10, 13, t[3]); g.vline(3, b - 12, 13, t[4]); g.rect(10, b - 12, 3, 13, t[1]); for (const xx of [5, 8]) g.vline(xx, b - 9, 8, t[2]);
        g.px(2, b, t[2]); g.px(13, b, t[1]); g.px(1, b, t[2]); g.ellipse(8, b - 13, 5.5, 2.6, r[3]); g.ellipse(8, b - 13, 3, 1.3, t[0]);
        post = (g) => flame(g, 'l', 8, b - 13);
        glow = [8, b - 18, 10];
        break;
      }
      default: { // Wizard
        const t = m.wood;
        for (let j = 13; j < b; j++) { const xx = 7 + ((j >> 1) % 2); g.rect(xx, j, 2, 1, t[3]); g.px(xx + 1, j, t[1]); }
        g.ellipse(8, b - 0.5, 4.5, 1.6, t[2]); g.hline(5, b - 1, 5, t[4]);
        g.px(4, 11, GOLD[4]); g.px(5, 12, GOLD[3]); g.px(11, 11, GOLD[3]); g.px(10, 12, GOLD[2]); g.hline(6, 13, 4, GOLD[3]); g.vline(3, 8, 3, GOLD[4]); g.vline(12, 8, 3, GOLD[2]);
        orb(g, 8, 7.5, 4.5, T('#6fe0b0')); icon(g, 'star5', 8, 8, hex('#e8fff4'));
        g.px(13, 3, GOLD[5]); g.px(2, 4, GOLD[5]);
        glow = [8, 7, 10, hex('#a0ffd8')];
      }
    }
  }, { post: (g) => { if (glow) lampGlow(g, glow[0], glow[1], glow[2], glow[3]); post?.(g); } });
};

// ------------------------------------------------------------------ bed

type Pattern = (g: Img, x0: number, y0: number, w: number, h: number) => void;
type BedOpt = { frame: Tones; quilt: Tones; sheet?: Tones; head?: string; pattern?: Pattern; headDeco?: Draw; pillow?: Tones; extra?: Draw; knobs?: Tones };
function bed(g: Img, w: number, h: number, o: BedOpt) {
  const f = o.frame, q = o.quilt, sh = o.sheet ?? T('#f1ece0'), b = h - 2, dbl = w > 40;
  const head = o.head ?? 'round';
  // headboard
  if (head === 'posts') {
    g.rect(3, 6, w - 6, 11, f[3]); g.hline(3, 6, w - 6, f[4]); g.rect(5, 8, w - 10, 7, f[2]); g.hline(5, 8, w - 10, f[1]);
    for (const xx of [1, w - 4]) { g.rect(xx, 3, 3, 15, f[3]); g.vline(xx, 3, 15, f[4]); g.vline(xx + 2, 3, 15, f[1]); g.rect(xx, 1, 3, 2, (o.knobs ?? f)[4]); }
  } else if (head === 'low') {
    blk(g, 1, 8, w - 2, 9, f); g.hline(1, 8, w - 2, f[5]);
  } else if (head === 'bamboo') {
    for (let xx = 2; xx < w - 3; xx += 4) { const top = 3 + Math.round(Math.abs(xx - w / 2 + 1) / 5); g.rect(xx, top, 3, 17 - top, f[3]); g.vline(xx, top, 17 - top, f[5]); g.vline(xx + 2, top, 17 - top, f[1]); g.hline(xx, top + 4, 3, f[1]); g.hline(xx, top + 9, 3, f[1]); }
    g.hline(1, 11, w - 2, f[2]); g.hline(1, 12, w - 2, f[1]);
  } else if (head === 'heart') {
    g.ellipse(w / 2 - w / 5, 7, w / 4.2, 6, f[3]); g.ellipse(w / 2 + w / 5, 7, w / 4.2, 6, f[3]); g.rect(1, 9, w - 2, 8, f[3]);
    g.ellipse(w / 2 - w / 5 - 1, 5, w / 7, 2.4, f[4]); g.vline(1, 9, 8, f[4]);
  } else {
    rr(g, 1, 2, w - 2, 15, f[3], head === 'flat' ? 0 : 3); g.hline(4, 2, w - 8, f[4]); g.vline(1, 5, 12, f[4]); g.vline(w - 2, 5, 12, f[2]);
    rr(g, 4, 5, w - 8, 10, f[2], 2); g.hline(6, 5, w - 12, f[1]);
  }
  o.headDeco?.(g);
  // mattress and rails
  g.rect(1, 15, w - 2, b - 22, f[3]); g.vline(1, 15, b - 22, f[4]); g.vline(w - 2, 15, b - 22, f[1]);
  g.rect(2, 14, w - 4, b - 21, sh[4]); g.hline(2, 14, w - 4, sh[5]);
  // pillows
  const pl = o.pillow ?? T('#fbf7ee');
  const pill = (px0: number, pw: number) => { rr(g, px0, 15, pw, 7, pl[4], 2); g.hline(px0 + 2, 15, pw - 4, pl[5]); g.hline(px0 + 2, 21, pw - 4, pl[2]); g.vline(px0 + pw - 1, 17, 3, pl[3]); g.hline(px0 + 3, 17, 3, hex('#ffffff')); };
  if (dbl) { pill(4, 18); pill(w - 22, 18); } else pill(7, 18);
  // quilt
  const qy = 25, qh = b - 8 - qy, qx = 2, qw = w - 4;
  g.rect(qx, qy - 2, qw, 2, sh[5]); g.hline(qx, qy - 3, qw, sh[2]);
  g.rect(qx, qy, qw, qh, q[3]); g.hline(qx, qy, qw, q[4]);
  o.pattern?.(g, qx, qy + 1, qw, qh - 1);
  g.vline(qx, qy, qh, q[4]); g.vline(qx + qw - 1, qy, qh, q[2]); g.hline(qx, qy + qh - 1, qw, q[2]);
  // footboard
  face(g, 1, b - 8, w - 2, 7, f); g.hline(1, b - 8, w - 2, f[4]); g.rect(4, b - 6, w - 8, 3, f[3]); g.hline(4, b - 6, w - 8, f[1]);
  g.rect(1, b - 1, 3, 2, f[1]); g.rect(w - 4, b - 1, 3, 2, f[1]);
  if (o.knobs) { g.rect(1, b - 10, 3, 2, o.knobs[4]); g.rect(w - 4, b - 10, 3, 2, o.knobs[3]); }
  o.extra?.(g);
}
const stripesV = (t: Tones, step = 4): Pattern => (g, x0, y0, w, h) => { for (let xx = x0 + 2; xx < x0 + w - 1; xx += step) g.vline(xx, y0, h, t[3]); };
const scatter = (key: string, col: RGBA, col2: RGBA, sx = 10, sy = 9): Pattern => (g, x0, y0, w, h) => {
  let r = 0;
  for (let yy = y0 + 4; yy < y0 + h - 3; yy += sy, r++) for (let xx = x0 + 5 + (r % 2) * (sx / 2); xx < x0 + w - 3; xx += sx) icon(g, key, xx, yy, col, col2);
};
const border = (col: RGBA, inner?: Pattern): Pattern => (g, x0, y0, w, h) => { inner?.(g, x0, y0, w, h); g.hline(x0 + 2, y0 + 1, w - 4, col); g.hline(x0 + 2, y0 + h - 3, w - 4, col); g.vline(x0 + 2, y0 + 1, h - 3, col); g.vline(x0 + w - 3, y0 + 1, h - 3, col); };

painters.bed = (img, x, y, w, h, c) => {
  const n = c.name, b = h - 2;
  sprite(img, x, y, w, h, (g) => {
    const cx = w / 2;
    if (/Pinstripe/.test(n)) bed(g, w, h, { frame: T('#3a4a8a'), quilt: T('#f1f1f4'), head: 'flat', pattern: stripesV(T('#4f7fd6'), 3), pillow: T('#dfe8f8') });
    else if (/Child/.test(n)) bed(g, w, h, { frame: T('#e9c040'), quilt: T('#6fb0e0'), head: 'round', headDeco: (g) => icon(g, 'star', cx, 9, T('#e8873a')[3]),
      pattern: (g, x0, y0, qw, qh) => { const cols = ['#ee8fb6', '#9fd487', '#f6dc5a', '#6fb0e0', '#e8873a']; for (let j = 0; j < qh; j += 7) for (let i = 0; i < qw; i += 7) { const t = T(cols[((i / 7) * 2 + (j / 7) * 3) % 5]); g.rect(x0 + i, y0 + j, Math.min(7, qw - i), Math.min(7, qh - j), t[3]); g.px(x0 + i + 3, y0 + j + 3, t[5]); } },
      extra: (g) => { const t = T('#b07a45'); circle(g, 22, 22, 3, t[3]); g.px(19, 19, t[3]); g.px(24, 19, t[3]); g.px(21, 21, INK); g.px(23, 21, INK); g.px(22, 23, t[1]); g.rect(20, 25, 5, 3, t[3]); g.px(22, 26, t[5]); } });
    else if (/Deluxe/.test(n)) bed(g, w, h, { frame: T('#8a3f3a'), quilt: T('#c23a3a'), head: 'posts', knobs: GOLD, pillow: T('#fbf1d8'),
      pattern: border(GOLD[4], scatter('diamond', GOLD[3], GOLD[5], 12, 9)), headDeco: (g) => { icon(g, 'crown', cx, 11, GOLD[4]); g.hline(6, 7, w - 12, GOLD[3]); } });
    else if (/Birch/.test(n)) bed(g, w, h, { frame: T('#e4ca9c'), quilt: T('#9fd487'), head: 'round', pattern: scatter('leaf', T('#5fae4a')[3], T('#5fae4a')[1], 12, 9) });
    else if (/Exotic/.test(n)) bed(g, w, h, { frame: T('#5b3b2e'), quilt: T('#8a4a9f'), head: 'posts', knobs: T('#e8873a'), pillow: T('#f6dc9a'),
      pattern: (g, x0, y0, qw, qh) => { for (let j = 2; j < qh - 2; j += 6) for (let i = 0; i < qw; i++) { const k = Math.abs((i % 8) - 4); g.px(x0 + i, y0 + j + k, T('#e8873a')[3]); if (j % 12 === 2) g.px(x0 + i, y0 + j + k + 2, GOLD[4]); } },
      headDeco: (g) => { for (let i = 8; i < w - 8; i += 4) icon(g, 'bloom', i, 11, GOLD[3], RED[3]); } });
    else if (/Fisher/.test(n)) bed(g, w, h, { frame: T('#a08a6a'), quilt: T('#3f7fb8'), head: 'flat', pattern: scatter('fish', T('#f6dc9a')[3], INK, 14, 8),
      headDeco: (g) => { circle(g, cx, 9, 5, WHITE[5]); circle(g, cx, 9, 2.4, T('#a08a6a')[2]); g.rect(cx - 1, 4, 2, 2, RED[3]); g.rect(cx - 1, 12, 2, 2, RED[3]); g.rect(cx - 5, 8, 2, 2, RED[3]); g.rect(cx + 3, 8, 2, 2, RED[3]); for (let i = 5; i < w - 5; i += 2) if (Math.abs(i - cx) > 7) g.px(i, 6 + (i % 4 === 1 ? 1 : 0), T('#d9c9a0')[4]); } });
    else if (/Midnight/.test(n)) bed(g, w, h, { frame: T('#c9b89a'), quilt: T('#27336a'), head: 'low', pillow: T('#cfd8f0'),
      pattern: (g, x0, y0, qw, qh) => {
        icon(g, 'moon', x0 + qw - 8, y0 + 5, T('#f4eeb0')[4]); for (const [i, j] of [[4, 3], [10, 7], [qw - 16, 2], [7, 12], [qw - 5, 12], [qw / 2, 5]]) g.px(x0 + i, y0 + j, WHITE[5]);
        g.rect(x0, y0 + qh - 8, qw, 8, T('#3f7fb8')[2]); for (let i = 0; i < qw; i++) { g.px(x0 + i, y0 + qh - 9 + (i % 6 < 3 ? 0 : 1), T('#9fd0f0')[4]); g.px(x0 + i, y0 + qh - 5 + ((i + 2) % 6 < 3 ? 0 : 1), T('#3f7fb8')[4]); }
      } });
    else if (/Modern/.test(n)) bed(g, w, h, { frame: T('#8d95a8'), quilt: T('#4b5669'), head: 'low', pattern: (g, x0, y0, qw, qh) => { g.rect(x0, y0 + 4, qw, 3, T('#e8504a')[3]); g.hline(x0, y0 + 8, qw, T('#4b5669')[4]); } });
    else if (/Pirate/.test(n)) bed(g, w, h, { frame: T('#5b3b2e'), quilt: T('#2f2a36'), head: 'posts', knobs: GOLD, pillow: T('#e8dcc0'),
      pattern: border(RED[3], (g, x0, y0, qw, qh) => { icon(g, 'skull', x0 + qw / 2, y0 + qh / 2 - 2, WHITE[5]); g.line(x0 + qw / 2 - 7, y0 + qh / 2 + 3, x0 + qw / 2 + 6, y0 + qh / 2 + 7, WHITE[4]); g.line(x0 + qw / 2 + 6, y0 + qh / 2 + 3, x0 + qw / 2 - 7, y0 + qh / 2 + 7, WHITE[4]); }),
      headDeco: (g) => { circle(g, cx, 11, 4, T('#8a5a34')[4]); circle(g, cx, 11, 2.4, T('#5b3b2e')[2]); for (let a = 0; a < 8; a++) g.px(cx - 0.5 + Math.cos(a * 0.785) * 5.5, 10.5 + Math.sin(a * 0.785) * 5.5, T('#8a5a34')[4]); } });
    else if (/Starry/.test(n)) bed(g, w, h, { frame: T('#3f3463'), quilt: T('#2c3a7e'), head: 'round', knobs: GOLD, pillow: T('#e0d8f4'), pattern: scatter('star5', GOLD[4], INK, 9, 7),
      headDeco: (g) => { icon(g, 'moon', cx, 9, GOLD[4]); g.px(cx - 9, 7, GOLD[5]); g.px(cx + 9, 11, GOLD[5]); g.px(cx + 7, 6, WHITE[5]); } });
    else if (/Strawberry/.test(n)) bed(g, w, h, { frame: T('#f08fb9'), quilt: T('#fff1f6'), head: 'heart', pillow: T('#ffd8e6'), pattern: border(T('#f08fb9')[3], scatter('berry', RED[3], LEAF[3], 10, 9)) });
    else if (/Tropical/.test(n)) bed(g, w, h, { frame: T('#d9b55c'), quilt: T('#3aa79f'), head: 'bamboo', pillow: T('#fff4c8'),
      pattern: (g, x0, y0, qw, qh) => { scatter('palm', LEAF[4], LEAF[2], 14, 12)(g, x0, y0, qw, qh); scatter('bloom', T('#ee6a8a')[3], GOLD[4], 14, 12)(g, x0 + 7, y0 + 3, qw - 7, qh - 3); } });
    else if (/Wild/.test(n)) bed(g, w, h, { frame: T('#7b5a3a'), quilt: T('#e0b060'), head: 'posts', pillow: T('#f1e4c0'),
      pattern: (g, x0, y0, qw, qh) => { let r = 0; for (let j = 2; j < qh - 3; j += 5, r++) for (let i = 2 + (r % 2) * 3; i < qw - 3; i += 7) { g.rect(x0 + i, y0 + j, 3, 2, T('#5b3b2e')[2]); g.px(x0 + i + 1, y0 + j + 2, T('#5b3b2e')[2]); g.px(x0 + i + 1, y0 + j, T('#b0703a')[3]); } },
      headDeco: (g) => { for (let i = 4; i < w - 4; i += 3) { g.px(i, 5, LEAF[3]); g.px(i + 1, 4, LEAF[4]); } icon(g, 'paw', cx, 11, T('#7b5a3a')[1]); } });
    else if (/Double/.test(n)) bed(g, w, h, { frame: T('#b37c46'), quilt: T('#3f9a8a'), pattern: (g, x0, y0, qw, qh) => { for (let i = 5; i < qw; i += 8) g.rect(x0 + i, y0, 2, qh, T('#3f9a8a')[2]); for (let j = 4; j < qh; j += 8) g.rect(x0, y0 + j, qw, 2, T('#3f9a8a')[4]); for (let i = 5; i < qw; i += 8) for (let j = 4; j < qh; j += 8) g.rect(x0 + i, y0 + j, 2, 2, T('#f1ece0')[4]); } });
    else bed(g, w, h, { frame: T('#b37c46'), quilt: T('#4f7fd6'), pattern: (g, x0, y0, qw, qh) => { g.rect(x0, y0 + 3, qw, 3, T('#f1ece0')[4]); g.rect(x0, y0 + qh - 6, qw, 2, T('#4f7fd6')[2]); } });
    void b;
  });
};

// ------------------------------------------------------------------ fireplace

function masonry(g: Img, x: number, y: number, w: number, h: number, t: Tones, kind: string, seed = 0) {
  if (kind === 'brick') {
    g.rect(x, y, w, h, t[3]);
    for (let j = 0; j < h; j++) {
      const r = Math.floor(j / 4);
      if (j % 4 === 3) { g.hline(x, y + j, w, t[1]); continue; }
      for (let i = 0; i < w; i++) {
        if ((i + (r % 2) * 3) % 6 === 5) g.px(x + i, y + j, t[1]);
        else if (hash(Math.floor((i + (r % 2) * 3) / 6), r, seed) < 0.3) g.px(x + i, y + j, j % 4 === 0 ? t[5] : t[4]);
        else if (j % 4 === 0) g.px(x + i, y + j, t[4]);
      }
    }
  } else if (kind === 'stone') {
    g.rect(x, y, w, h, t[1]);
    for (let r = 0, j = 0; j < h; j += 5, r++) for (let i = -(r % 2) * 3; i < w; ) {
      const sw = 4 + Math.floor(hash(i, r, seed) * 4), x0 = Math.max(0, i), x1 = Math.min(w, i + sw - 1);
      if (x1 > x0) { const tone = hash(i, r, seed + 2) < 0.4 ? 4 : 3; g.rect(x + x0, y + j, x1 - x0, Math.min(4, h - j), t[tone]); g.hline(x + x0, y + j, x1 - x0, t[tone + 1]); if (j + 3 < h) g.hline(x + x0, y + j + 3, x1 - x0, t[2]); }
      i += sw;
    }
  } else {
    g.rect(x, y, w, h, t[3]); g.vline(x, y, h, t[4]); g.vline(x + w - 1, y, h, t[2]);
  }
}

painters.fireplace = (img, x, y, w, h, c) => {
  const n = c.name, m = mat(n), b = h - 2;
  const key = n.replace(' Fireplace', '');
  sprite(img, x, y, w, h, (g) => {
    const fire = (pal: Pal = FLAME, cx = 16, by = b - 2) => {
      const lg = T('#6b4530'); g.rect(cx - 5, by, 10, 2, lg[3]); g.hline(cx - 5, by, 10, lg[4]); g.px(cx - 5, by, PAPER[3]); g.px(cx + 4, by + 1, PAPER[2]); g.line(cx - 4, by - 1, cx + 3, by - 2, lg[2]);
      flame(g, 'l', cx, by - 1, pal);
    };
    const opening = (x0: number, y0: number, ow: number, glowCol = '#7a2a1a', r = 3) => { rr(g, x0, y0, ow, b - y0 + 4, hex('#24161c'), r); g.rect(x0, y0 + r, ow, b - y0 - r - 1, hex('#24161c')); g.rect(x0 + 1, b - 5, ow - 2, 4, hex(glowCol)); };
    const std = (t: Tones, kind: string, mt: Tones, o: { pal?: Pal; glow?: string } = {}) => {
      masonry(g, 3, 11, 26, b - 12, t, kind, pick(n, 50));
      g.rect(1, b - 1, 30, 2, t[2]); g.hline(1, b - 1, 30, t[4]);
      blk(g, 1, 8, 30, 3, mt); g.hline(1, 8, 30, mt[5]);
      opening(9, 19, 14, o.glow); fire(o.pal);
      g.hline(8, 18, 16, t[1]);
    };
    switch (key) {
      case 'Brick': std(T('#b5503a'), 'brick', T('#8a5a34')); g.rect(13, 3, 6, 5, T('#8a5a34')[3]); circle(g, 16, 5.5, 2, WHITE[5]); g.px(16, 5, INK); g.px(16, 4, INK); g.px(17, 5, INK); candle(g, 5, 7, WHITE, 4); vase(g, 24, 7, T('#6fa0d2'), T('#e9c040')); break;
      case 'Stone': std(T('#9b968d'), 'stone', T('#6b4530')); g.rect(5, 4, 7, 4, T('#d9b55c')[3]); g.rect(6, 5, 5, 2, T('#6fb0e0')[4]); candle(g, 20, 7, WHITE, 5); candle(g, 24, 7, WHITE, 3); break;
      case 'Desert': {
        std(m.wood, 'smooth', m.cloth); for (let i = 4; i < 28; i++) g.px(i, 13 + (i % 4 < 2 ? 0 : 1), m.trim[3]); icon(g, 'sun', 16, 15, m.cloth[3]); g.rect(12, 12, 8, 6, m.wood[3]); icon(g, 'sun', 16, 14.5, m.cloth[3]);
        g.rect(4, 4, 4, 4, CLAY[3]); g.hline(4, 4, 4, CLAY[5]); g.rect(24, 3, 3, 5, LEAF[3]); g.px(23, 5, LEAF[3]); g.px(27, 4, LEAF[2]); g.px(24, 3, LEAF[5]);
        break;
      }
      case 'Elegant': {
        const t = T('#ece8e0'); std(t, 'smooth', t); for (const xx of [5, 6, 25, 26]) g.vline(xx, 12, b - 14, t[2]); g.hline(3, 11, 26, GOLD[4]); g.rect(8, 16, 16, 2, GOLD[3]); g.hline(8, 16, 16, GOLD[5]);
        g.rect(11, 1, 10, 7, GOLD[3]); g.rect(12, 2, 8, 5, T('#6fb0e0')[4]); g.rect(12, 5, 8, 2, GREEN[3]); candle(g, 4, 7, WHITE, 5); candle(g, 26, 7, WHITE, 5);
        break;
      }
      case 'Iridium': {
        const t = T('#7a4fc0'); std(t, 'smooth', T('#4b2f8a'), { pal: MAGIC, glow: '#1f5a5a' });
        for (const [xx, yy] of [[5, 14], [26, 14], [5, 28], [26, 28], [16, 14]]) { g.rect(xx - 1, yy - 1, 3, 3, T('#b98af0')[4]); g.px(xx - 1, yy - 1, WHITE[5]); g.px(xx + 1, yy + 1, t[1]); }
        g.vline(8, 12, b - 13, t[2]); g.vline(23, 12, b - 13, t[2]);
        stamp(g, 12, 2, ['...##...', '..#WW#..', '.#WW###.', '.######.', '..####..', '...##...'], { '#': T('#b98af0')[3], W: hex('#f0e0ff') });
        break;
      }
      case 'Joja': {
        const t = T('#8d95a8'), bl = T('#3f6fd2');
        masonry(g, 2, 9, 28, b - 9, t, 'smooth'); g.rect(2, 9, 28, 3, bl[3]); g.hline(2, 9, 28, bl[5]); g.rect(2, b - 1, 28, 2, t[1]);
        g.rect(6, 15, 20, 17, hex('#24161c')); for (let j = 18; j < 31; j += 3) { g.hline(7, j, 18, hex('#f9843c')); g.hline(7, j + 1, 18, hex('#c8402a')); } g.hline(7, 18, 18, hex('#fff0a0'));
        g.rect(5, 14, 22, 1, t[1]); icon(g, 'joja', 16, 5, bl[3]); g.rect(11, 1, 10, 8, WHITE[5]); icon(g, 'joja', 16, 5, bl[3]);
        g.px(4, 34, RED[3]); g.px(6, 34, GREEN[4]); g.rect(22, 33, 5, 2, t[1]);
        break;
      }
      case 'Junimo': {
        const t = m.wood, tr = T('#8a5a34');
        rr(g, 2, 7, 28, b - 6, tr[3], 6); g.rect(2, 20, 28, b - 19, tr[3]); for (const xx of [6, 12, 20, 26]) g.vline(xx, 12, b - 12, tr[2]); g.vline(2, 14, b - 14, tr[4]);
        g.ellipse(16, 8, 13, 5, t[3]); g.ellipse(14, 6.5, 9, 3, t[4]); for (let i = 3; i < 29; i += 4) { g.px(i, 12, t[2]); g.px(i + 1, 13, t[3]); }
        icon(g, 'star', 16, 6, m.cloth[4]); opening(9, 19, 14, '#7a2a1a', 5); fire();
        g.px(4, b, tr[2]); g.px(27, b, tr[1]); g.rect(1, b - 1, 3, 2, tr[2]); g.rect(28, b - 1, 3, 2, tr[1]);
        break;
      }
      case 'Monster': {
        const t = T('#5a8a4a');
        rr(g, 2, 5, 28, b - 4, t[3], 6); g.rect(2, 18, 28, b - 17, t[3]); g.ellipse(12, 9, 8, 3, t[4]); g.vline(2, 12, b - 12, t[4]); g.rect(27, 12, 3, b - 11, t[2]);
        for (const xx of [9, 22]) { circle(g, xx, 13, 3.4, hex('#fff6c0')); circle(g, xx + 0.5, 13.5, 1.5, hex('#c8402a')); g.px(xx, 13, INK); g.line(xx - 4, 9, xx + 3, 10 - (xx > 16 ? 2 : -1), t[1]); }
        g.px(5, 4, t[3]); g.px(4, 3, t[4]); g.px(26, 4, t[3]); g.px(27, 3, t[2]); g.rect(4, 4, 2, 3, t[3]); g.rect(26, 4, 2, 3, t[2]);
        rr(g, 6, 19, 20, b - 15, hex('#24161c'), 3); g.rect(7, b - 5, 18, 4, hex('#7a2a1a')); fire();
        for (let xx = 7; xx < 25; xx += 4) { g.rect(xx, 19, 3, 3, WHITE[5]); g.px(xx + 1, 22, WHITE[5]); g.px(xx + 2, 21, WHITE[3]); }
        for (let xx = 9; xx < 24; xx += 5) { g.rect(xx, b - 2, 3, 2, WHITE[4]); g.px(xx + 1, b - 3, WHITE[5]); }
        break;
      }
      case 'Retro': {
        const t = m.wood;
        g.rect(14, 1, 4, 10, BLACK[3]); g.vline(14, 1, 10, BLACK[4]);
        for (let j = 0; j < 12; j++) { const k = 3 + j; g.hline(16 - k, 10 + j, 2 * k, t[3]); g.px(16 - k, 10 + j, t[5]); g.px(16 - k + 1, 10 + j, t[4]); g.rect(16 + k - 3, 10 + j, 3, 1, t[2]); }
        rr(g, 2, 22, 28, 12, t[3], 3); g.vline(2, 25, 6, t[4]); g.rect(27, 25, 3, 6, t[2]); g.hline(5, 33, 22, t[1]);
        rr(g, 7, 20, 18, 11, hex('#24161c'), 3); g.rect(8, 27, 16, 3, hex('#7a2a1a')); fire(FLAME, 16, 28);
        g.hline(4, 15 + 6, 6, m.cloth[3]);
        for (const xx of [8, 15, 22]) { g.rect(xx, 34, 2, 4, BLACK[3]); } g.hline(6, b, 20, BLACK[2]);
        break;
      }
      case 'Stove': {
        const t = T('#4a4650');
        g.rect(19, 1, 5, 9, t[3]); g.vline(19, 1, 9, t[4]); g.vline(23, 1, 9, t[1]); g.hline(19, 4, 5, t[1]);
        rr(g, 4, 9, 24, 3, t[4], 1); rr(g, 5, 12, 22, b - 15, t[3], 1); g.vline(5, 13, b - 17, t[4]); g.rect(24, 13, 3, b - 17, t[2]); g.hline(4, 9, 24, t[5]);
        rr(g, 9, 15, 14, 13, hex('#24161c'), 2); g.rect(10, 23, 12, 4, hex('#7a2a1a')); fire(FLAME, 16, 25);
        for (const xx of [12, 16, 20]) g.vline(xx, 15, 13, t[2]); g.hline(9, 21, 14, t[2]);
        g.px(24, 20, GOLD[4]); g.rect(8, 30, 16, 2, t[2]); for (let xx = 9; xx < 23; xx += 3) g.px(xx, 30, hex('#f9843c'));
        g.rect(5, b - 3, 3, 4, t[2]); g.rect(24, b - 3, 3, 4, t[1]); g.px(4, b, t[2]); g.px(27, b, t[1]);
        g.rect(8, 6, 7, 3, STEEL[3]); g.hline(8, 6, 7, STEEL[5]); g.px(15, 7, STEEL[2]); g.px(16, 7, STEEL[2]);
        break;
      }
      default: { // Wizard
        const t = T('#6a5a8a');
        std(t, 'stone', T('#3f3463'), { pal: BLUEFIRE, glow: '#1f2a6a' });
        icon(g, 'star', 16, 14, GOLD[4]); crystalBall(g, 6, 7, T('#6fe0b0')); flask(g, 22, 7, T('#ee6ab0')); candle(g, 14, 7, T('#b9a6d8'), 5);
        for (const [xx, yy] of [[5, 22], [26, 26]]) icon(g, pick(n + xx, 2) ? 'rune1' : 'rune3', xx, yy, T('#b9a6d8')[5]);
      }
    }
  });
};

// ------------------------------------------------------------------ fish tank

const FISHC = ['#f08a3a', '#f6dc5a', '#e8506a', '#6fd0f0', '#f4f4f4', '#b98af0', '#8ae06a'];
function tinyFish(g: Img, x: number, y: number, t: Tones, flip: boolean, big = false) {
  const rows = big ? ['..###..#', '.#####.#', '#o######', '.#####.#', '..###..#'] : ['.##.#', '#o###', '.##.#'];
  stamp(g, x, y, rows, { '#': t[3], o: INK }, flip);
  g.px(x + (flip ? (big ? 4 : 2) : (big ? 3 : 2)), y, t[5]);
}
function seaweed(g: Img, x: number, by: number, hh: number, t: Tones) {
  for (let j = 0; j < hh; j++) { const xx = x + ((j >> 1) % 2); g.px(xx, by - j, t[3]); if (j % 3 === 1) g.px(xx + ((j >> 1) % 2 ? -1 : 1), by - j, t[4]); }
}

painters.fishtank = (img, x, y, w, h, c) => {
  const n = c.name, b = h - 2, deep = c.th >= 2;
  const key = n.split(' ')[0];
  sprite(img, x, y, w, h, (g) => {
    const cfg: Record<string, { stand: Tones; rim: Tones; water: string; standH: number }> = {
      Small: { stand: T('#a8703f'), rim: T('#6b4530'), water: '#4fb0e0', standH: 10 },
      Modern: { stand: T('#e2e5ea'), rim: T('#4b5669'), water: '#5fc0e8', standH: 9 },
      Jungle: { stand: T('#7b5a3a'), rim: T('#4f7a3a'), water: '#4fb89a', standH: 9 },
      Deluxe: { stand: T('#8a3f3a'), rim: GOLD, water: '#3f9ae0', standH: 10 },
      Community: { stand: T('#b37c46'), rim: T('#3f6a8a'), water: '#4fa8d8', standH: 9 },
      Large: { stand: T('#7b4b2f'), rim: T('#5b3b2e'), water: '#3f9ad8', standH: 12 },
      Aquatic: { stand: T('#9b968d'), rim: T('#3a8a9a'), water: '#3aa8d0', standH: 12 },
    };
    const o = cfg[key] ?? cfg.Small, st = o.stand, top = deep ? 2 : 3;
    const gy = top + 2, gb = b - o.standH - 1, gx = 2, gw = w - 4, wt = T(o.water);
    // stand
    face(g, 1, gb + 2, w - 2, o.standH - 1, st); g.vline(1, gb + 2, o.standH - 1, st[3]);
    if (key === 'Modern') { g.rect(4, gb + 4, w - 8, o.standH - 5, st[3]); g.hline(4, gb + 4, w - 8, st[5]); g.vline(w / 2, gb + 4, o.standH - 5, st[1]); clearRow(g, b - 1, 4, w - 8); }
    else if (key === 'Aquatic') { masonry(g, 1, gb + 2, w - 2, o.standH - 1, st, 'stone', 3); }
    else { const nd = Math.max(2, Math.round(w / 16)); for (let i = 0; i < nd; i++) { const x0 = 3 + Math.round((i * (w - 6)) / nd), x1 = 3 + Math.round(((i + 1) * (w - 6)) / nd) - 1; g.rect(x0, gb + 4, x1 - x0, o.standH - 5, st[3]); g.hline(x0, gb + 4, x1 - x0, st[4]); g.hline(x0, b - 2, x1 - x0, st[1]); g.px(x0 + Math.floor((x1 - x0) / 2), gb + 4 + Math.floor((o.standH - 5) / 2), GOLD[4]); } }
    // water
    g.rect(gx, gy, gw, gb - gy + 1, wt[3]); g.rect(gx, gy, gw, 2, hex('#d8f2fb')); g.hline(gx, gy + 2, gw, wt[5]);
    g.rect(gx, gy + Math.round((gb - gy) * 0.55), gw, Math.round((gb - gy) * 0.45) + 1, wt[2]);
    for (let i = 0; i < gw; i++) if (hash(i, 3, 5) < 0.5) g.px(gx + i, gy + Math.round((gb - gy) * 0.55), wt[3]);
    // sand
    const sand = T(key === 'Jungle' ? '#8a7a4a' : key === 'Modern' ? '#e8e8e8' : '#e6cf96');
    g.rect(gx, gb - 2, gw, 3, sand[3]); for (let i = 0; i < gw; i++) { if (hash(i, 1, 9) < 0.35) g.px(gx + i, gb - 3, sand[3]); if (hash(i, 2, 9) < 0.2) g.px(gx + i, gb - 1, sand[1]); if (hash(i, 4, 9) < 0.25) g.px(gx + i, gb - 2, sand[5]); }
    const tall = gb - gy - 5, seed = pick(n, 99);
    // ornaments
    if (key === 'Deluxe') { const s = T('#b0a8a0'); g.rect(w / 2 - 5, gb - 10, 10, 8, s[3]); g.rect(w / 2 - 6, gb - 13, 3, 11, s[4]); g.rect(w / 2 + 3, gb - 13, 3, 11, s[2]); g.px(w / 2 - 5, gb - 14, RED[3]); g.px(w / 2 + 4, gb - 14, RED[3]); g.rect(w / 2 - 1, gb - 6, 3, 4, s[0]); for (let i = -4; i < 4; i += 2) g.px(w / 2 + i, gb - 11, s[3]); g.rect(8, gb - 4, 5, 3, T('#8a5a34')[3]); g.hline(8, gb - 4, 5, GOLD[4]); g.px(10, gb - 5, GOLD[5]); }
    if (key === 'Aquatic') {
      const s = T('#c9c4b8');
      for (const cx of [14, w - 16]) { g.rect(cx - 2, gy + 6, 4, gb - gy - 8, s[3]); g.vline(cx - 2, gy + 6, gb - gy - 8, s[5]); g.vline(cx + 1, gy + 6, gb - gy - 8, s[1]); g.rect(cx - 3, gy + 5, 6, 2, s[4]); g.rect(cx - 3, gb - 4, 6, 2, s[2]); }
      for (const [cx, col] of [[30, '#f06a8a'], [w / 2, '#f0a03a'], [w - 34, '#b98af0'], [50, '#f6dc5a']] as [number, string][]) { const t = T(col); for (const d of [-3, -1, 0, 2, 4]) { const hh = 5 + Math.abs(d * 7 % 5); g.vline(cx + d, gb - 2 - hh, hh, t[3]); g.px(cx + d, gb - 2 - hh, t[5]); if (d % 2) g.px(cx + d + 1, gb - hh, t[4]); } }
      rr(g, w / 2 - 14, gb - 8, 9, 7, T('#7d8a8a')[3], 2); g.px(w / 2 - 12, gb - 7, T('#7d8a8a')[5]); g.rect(w / 2 - 12, gb - 4, 3, 3, T('#7d8a8a')[1]);
    }
    if (key === 'Jungle') { const tr = T('#6b4530'); g.line(10, gb - 2, 22, gb - 12, tr[3]); g.line(10, gb - 3, 22, gb - 13, tr[4]); g.line(22, gb - 12, 30, gb - 9, tr[3]); g.line(40, gy + 2, 43, gy + 12, LEAF[2]); g.line(52, gy + 2, 50, gy + 9, LEAF[3]); for (let i = 3; i < gw; i += 2) if (hash(i, 8, 2) < 0.6) g.px(gx + i, gy + 2 + (i % 3), LEAF[4]); }
    if (key === 'Modern') { for (const [cx, r] of [[8, 2.5], [13, 1.8], [23, 2.2]]) { circle(g, cx, gb - 3, r, T('#4b5669')[3]); g.px(cx - 1, gb - 4, T('#4b5669')[5]); } }
    // plants
    const np = Math.round(w / (key === 'Jungle' ? 5 : 11));
    for (let i = 0; i < np; i++) { const px0 = gx + 2 + Math.round(((i + 0.5 * hash(i, 1, seed)) * (gw - 5)) / np); seaweed(g, px0, gb - 3, Math.round(tall * (0.35 + 0.5 * hash(i, 2, seed))), T(i % 3 === 2 && key !== 'Jungle' ? '#e86a8a' : i % 2 ? '#3fae5a' : '#2f8a4a')); }
    // fish and bubbles
    const nf = Math.max(2, Math.round((w * (deep ? 1.6 : 1)) / 14));
    for (let i = 0; i < nf; i++) {
      const big = deep && i % 3 === 0;
      const fx = gx + 2 + Math.round(((i + 0.2 + 0.5 * hash(i, 5, seed)) * (gw - 10)) / nf), fy = gy + 4 + Math.round(hash(i, 6, seed) * (tall - 5));
      tinyFish(g, fx, fy, T(FISHC[(i + seed) % FISHC.length]), hash(i, 7, seed) < 0.5, big);
    }
    for (let i = 0; i < w / 10; i++) { const bx = gx + 3 + Math.round(hash(i, 11, seed) * (gw - 6)), by = gy + 4 + Math.round(hash(i, 12, seed) * (tall - 2)); g.px(bx, by, hex('#e8f8ff')); if (i % 2) g.px(bx + 1, by - 3, hex('#c8ecff')); }
    // glass
    for (let i = 0; i < 2; i++) { const sx = gx + 3 + i * 3; for (let j = 0; j < Math.min(10, tall); j++) g.px(sx + Math.floor((Math.min(10, tall) - j) / 2), gy + 3 + j, [255, 255, 255, 70]); }
    g.vline(gx, gy, gb - gy + 1, [255, 255, 255, 90]); g.vline(gx + gw - 1, gy, gb - gy + 1, [20, 30, 60, 60]);
    if (w > 70) for (const xx of [Math.round(w / 3), Math.round((2 * w) / 3)]) g.vline(xx, gy, gb - gy + 1, o.rim[3]);
    // rims
    g.rect(1, top, w - 2, 2, o.rim[3]); g.hline(1, top, w - 2, o.rim[5]); g.rect(1, gb + 1, w - 2, 1, o.rim[2]);
    g.vline(1, top, gb - top + 1, o.rim[4]); g.vline(w - 2, top, gb - top + 1, o.rim[2]);
    if (key === 'Deluxe') { g.rect(w / 2 - 5, top - 2, 10, 2, GOLD[4]); g.px(w / 2, top - 3, GOLD[5]); g.px(w / 2 - 1, top - 3, GOLD[5]); }
    if (key === 'Jungle') for (let i = 2; i < w - 2; i += 3) { g.px(i, top - 1, LEAF[3 + (i % 2)]); if (i % 2) g.px(i + 1, top + 2, LEAF[3]); }
  });
};

// ------------------------------------------------------------------ tv and radio

function screen(g: Img, x: number, y: number, w: number, h: number, show: string) {
  g.rect(x - 1, y - 1, w + 2, h + 2, hex('#1f1a24'));
  if (show === 'off') { g.rect(x, y, w, h, hex('#2f4a4a')); g.rect(x, y, w, 2, hex('#3f6060')); }
  else if (show === 'sunset') { g.rect(x, y, w, h, hex('#f6a04a')); g.rect(x, y, w, Math.floor(h / 3), hex('#f6c86a')); g.rect(x, y + h - Math.floor(h / 3), w, Math.floor(h / 3), hex('#3f8ac0')); circle(g, x + w / 2, y + h - Math.floor(h / 3), 2.4, hex('#fff0a0')); g.vline(x + 2, y + 2, h - 3, hex('#3a2a20')); g.hline(x + 1, y + 2, 4, hex('#2f7a3a')); g.px(x, y + 3, hex('#2f7a3a')); g.px(x + 4, y + 3, hex('#2f7a3a')); }
  else if (show === 'static') { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g.px(x + i, y + j, hash(i, j, 4) < 0.5 ? hex('#3a3f48') : hex('#6a707c')); }
  else { g.rect(x, y, w, h, hex('#6fc0f0')); g.rect(x, y + h - Math.ceil(h / 3), w, Math.ceil(h / 3), hex('#5fb04a')); g.ellipse(x + w * 0.3, y + h - Math.ceil(h / 3), w * 0.3, 2.4, hex('#5fb04a')); circle(g, x + w - 3, y + 2.5, 1.5, hex('#fff0a0')); g.hline(x + 2, y + 2, 3, hex('#ffffff')); }
  for (let j = 0; j < Math.min(h, 6); j++) g.px(x + 1 + Math.floor((Math.min(h, 6) - j) / 2) + (show === 'off' ? 1 : 0), y + j, [255, 255, 255, show === 'off' ? 80 : 60]);
}
function antenna(g: Img, cx: number, y: number, bent = false) {
  g.line(cx, y, cx - 4, y - 5, STEEL[4]); g.line(cx + 1, y, bent ? cx + 6 : cx + 5, bent ? y - 2 : y - 5, STEEL[3]); g.px(cx - 4, y - 5, STEEL[5]); if (!bent) g.px(cx + 5, y - 5, STEEL[5]);
}

painters.tv = (img, x, y, w, h, c) => {
  const n = c.name, b = h - 2;
  sprite(img, x, y, w, h, (g) => {
    if (/Radio/.test(n)) {
      const t = T('#a3562f'), cl = T('#d9b55c');
      for (let j = 0; j < 4; j++) { g.px(3 - (j > 1 ? 1 : 0), b - 3 + j, T('#7b4b2f')[2]); g.px(12 + (j > 1 ? 1 : 0), b - 3 + j, T('#7b4b2f')[1]); }
      rr(g, 2, 5, 12, b - 8, t[3], 4); g.rect(2, 12, 12, b - 15, t[3]); g.vline(2, 10, b - 13, t[4]); g.rect(12, 10, 2, b - 13, t[2]); g.hline(6, 5, 4, t[5]);
      rr(g, 4, 8, 8, 9, cl[2], 3); for (let j = 9; j < 17; j += 2) g.hline(5, j, 6, cl[4]); g.vline(8, 8, 9, t[2]);
      g.rect(4, 18, 8, 3, hex('#fff0c0')); g.px(7, 19, RED[3]); for (let i = 5; i < 11; i += 2) g.px(i, 20, INK);
      circle(g, 5, 23, 1, GOLD[4]); circle(g, 11, 23, 1, GOLD[4]); g.hline(2, b - 4, 12, t[1]);
      g.line(11, 5, 14, 0, STEEL[4]);
      return;
    }
    if (/Plasma/.test(n)) {
      const t = T('#2f2a36');
      const st = T('#c5cbd4'); face(g, 3, 19, w - 6, 6, st); g.hline(3, 19, w - 6, st[5]); g.vline(w / 2, 20, 5, st[1]); g.rect(3, b - 1, 2, 2, st[1]); g.rect(w - 5, b - 1, 2, 2, st[1]); g.px(8, 22, T('#6fe0b0')[4]);
      g.rect(14, 16, 4, 3, t[3]); g.rect(11, 18, 10, 1, t[4]);
      g.rect(1, 1, w - 2, 15, t[3]); g.hline(1, 1, w - 2, t[5]); screen(g, 3, 3, w - 6, 11, 'show'); g.px(w - 4, 15, RED[4]);
    } else if (/Floor/.test(n)) {
      const t = T('#8f5a36');
      rr(g, 1, 4, w - 2, b - 5, t[3], 1); g.hline(2, 4, w - 4, t[5]); g.vline(1, 5, b - 7, t[4]); g.rect(1, b - 4, w - 2, 3, t[2]); g.vline(w - 2, 5, b - 7, t[2]);
      screen(g, 4, 7, 16, 13, 'show');
      g.rect(22, 6, 7, 9, T('#d9b55c')[2]); for (let j = 7; j < 15; j += 2) g.hline(22, j, 7, T('#d9b55c')[4]);
      circle(g, 24, 18, 1.4, GOLD[4]); circle(g, 28, 18, 1.4, GOLD[3]);
      for (const xx of [3, w - 6]) g.rect(xx, b - 1, 3, 2, t[1]);
    } else if (/Tropical/.test(n)) {
      const t = T('#d9b55c');
      g.rect(3, 4, w - 6, 17, t[3]); for (let i = 5; i < w - 4; i += 4) { g.vline(i, 4, 2, t[1]); g.vline(i, 19, 2, t[1]); } g.hline(3, 4, w - 6, t[5]); g.vline(3, 4, 17, t[5]); g.vline(w - 4, 4, 17, t[2]);
      for (let j = 7; j < 20; j += 4) { g.hline(3, j, 2, t[1]); g.hline(w - 5, j, 2, t[1]); }
      screen(g, 6, 7, w - 12, 11, 'sunset');
      for (const xx of [6, w - 8]) { g.rect(xx, 21, 2, 5, t[3]); g.vline(xx + 1, 21, 5, t[1]); } g.hline(4, b, w - 8, t[2]); g.hline(5, 23, w - 10, t[2]);
      icon(g, 'palm', w - 5, 3, LEAF[3]); icon(g, 'bloom', 4, 4, T('#ee6a8a')[3], GOLD[4]);
    } else if (/Retro/.test(n)) {
      const t = T('#e2853c');
      antenna(g, 15, 5);
      rr(g, 2, 5, w - 4, 16, t[3], 3); g.hline(5, 5, w - 10, t[5]); g.vline(2, 8, 10, t[4]); g.rect(w - 4, 8, 2, 10, t[2]); g.hline(5, 20, w - 10, t[1]);
      rr(g, 4, 7, 17, 12, hex('#1f1a24'), 2); screen(g, 6, 9, 13, 8, 'off');
      circle(g, 25, 10, 2, T('#f6e7b8')[4]); g.px(25, 9, INK); circle(g, 25, 15, 1.4, T('#3aa79f')[3]); g.hline(23, 18, 5, T('#f6e7b8')[2]);
      for (let j = 0; j < 5; j++) { g.rect(6 - Math.floor(j / 2), 21 + j, 2, 1, T('#7b4b2f')[3]); g.rect(w - 8 + Math.floor(j / 2), 21 + j, 2, 1, T('#7b4b2f')[2]); }
    } else {
      const broken = /Broken/.test(n), t = broken ? T('#8a8a80') : T('#a9a39a');
      const st = T('#8f5a36');
      topSlab(g, 4, 20, w - 8, 2, 1, st); leg(g, 5, 23, 2, 4, st); leg(g, w - 7, 23, 2, 4, st);
      antenna(g, 14, 6, broken);
      rr(g, 5, 6, w - 10, 14, t[3], 1); g.hline(6, 6, w - 12, t[5]); g.vline(5, 7, 12, t[4]); g.rect(w - 7, 7, 2, 12, t[2]); g.hline(6, 19, w - 12, t[1]);
      screen(g, 8, 9, 12, 8, broken ? 'static' : 'off');
      if (broken) { g.line(11, 9, 14, 13, INK); g.line(14, 13, 12, 16, INK); g.line(14, 13, 18, 11, INK); g.px(13, 12, WHITE[5]); g.px(23, 9, INK); g.line(7, 17, 5, 20, INK); }
      circle(g, 23.5, 10.5, 1.4, broken ? t[1] : BLACK[3]); g.px(23, 14, broken ? t[1] : RED[3]); for (let j = 16; j < 19; j++) g.hline(22, j, 3, j % 2 ? t[1] : t[2]);
    }
  });
};

// ------------------------------------------------------------------ house plants

/** Flower pot standing on row b. Returns the row of the soil. */
function pot(g: Img, cx: number, b: number, pw: number, ph: number, t: Tones, o: { square?: boolean; band?: RGBA; rim?: Tones } = {}) {
  const x0 = Math.round(cx - pw / 2), rim = o.rim ?? t;
  for (let j = 0; j < ph; j++) {
    const k = o.square ? 0 : j > ph * 0.6 ? 2 : j > 1 ? 1 : 0, yy = b - ph + 1 + j;
    g.hline(x0 + k, yy, pw - 2 * k, t[3]); g.px(x0 + k, yy, t[4]); g.px(x0 + pw - 1 - k, yy, t[1]); if (pw > 6) g.px(x0 + pw - 2 - k, yy, t[2]);
  }
  g.hline(x0, b - ph + 1, pw, rim[4]); g.px(x0 + 1, b - ph + 1, rim[5]); g.hline(x0, b - ph + 2, pw, rim[2]);
  if (o.band) g.hline(x0 + 1, b - Math.floor(ph / 2) + 1, pw - 2, o.band);
  return b - ph;
}
function bush(g: Img, cx: number, cy: number, rx: number, ry: number, t: Tones) {
  g.ellipse(cx, cy, rx, ry, t[2]); g.ellipse(cx - 0.5, cy - 0.7, rx - 0.8, ry - 0.9, t[3]); g.ellipse(cx - rx * 0.3, cy - ry * 0.35, rx * 0.5, ry * 0.42, t[4]);
  g.px(Math.round(cx - rx * 0.45), Math.round(cy - ry * 0.55), t[5]);
  const n = Math.floor((rx * ry) / 5);
  for (let i = 0; i < n; i++) {
    const a = 0.6 + (i * 2.4) % 6.28, r = 0.45 + 0.4 * hash(i, 3, Math.round(cx * 7 + cy));
    const px0 = cx + Math.cos(a) * rx * r, py = cy + Math.sin(a) * ry * r;
    g.px(px0, py, py > cy ? t[1] : t[5]); g.px(px0 + 1, py + (py > cy ? 1 : 0), py > cy ? t[1] : t[4]);
  }
}
/** Arching leaf or frond from (x0, y0). */
function frond(g: Img, x0: number, y0: number, dx: number, dy: number, droop: number, t: Tones, thick = 1) {
  const n = Math.max(Math.abs(dx), Math.abs(dy)) + droop;
  for (let i = 0; i <= n; i++) {
    const f = i / n, xx = x0 + dx * f, yy = y0 + dy * f + droop * f * f;
    g.px(xx, yy, t[3]);
    if (thick > 1 && f > 0.15 && f < 0.9) { g.px(xx, yy - 1, t[4]); if (thick > 2 && f > 0.3 && f < 0.75) g.px(xx, yy + 1, t[2]); }
    else if (thick === 1 && i % 2 === 0 && i > 1) { g.px(xx, yy - 1, t[4]); g.px(xx, yy + 1, t[2]); }
  }
}
function trunk(g: Img, x: number, y0: number, y1: number, t: Tones, wd = 2, wave = 0) {
  for (let j = y0; j <= y1; j++) { const xx = x + Math.round(Math.sin((j - y0) * 0.5) * wave); g.rect(xx, j, wd, 1, t[3]); g.px(xx + wd - 1, j, t[1]); if (wd > 2) g.px(xx, j, t[4]); }
}
function pine(g: Img, cx: number, top: number, bot: number, half: number, t: Tones, tier = 5) {
  const hh = bot - top;
  for (let j = 0; j <= hh; j++) {
    const base = (j / hh) * half, k = Math.max(0.5, base * 0.55 + ((j % tier) / tier) * base * 0.6 + 0.6);
    const x0 = Math.round(cx - k), x1 = Math.round(cx + k);
    g.hline(x0, top + j, x1 - x0, t[3]); g.px(x0, top + j, t[4]); if (x1 - x0 > 3) { g.px(x0 + 1, top + j, t[4]); g.px(x1 - 1, top + j, t[2]); g.px(x1 - 2, top + j, t[2]); }
    if (j % tier === tier - 1) g.hline(x0 + 1, top + j, x1 - x0 - 1, t[1]);
  }
}

painters.houseplant = (img, x, y, w, h, c) => {
  const n = c.name, b = h - 2, cx = w / 2;
  const L = LEAF, D = T('#2f8a4a'), BR = T('#8a5a34');
  sprite(img, x, y, w, h, (g) => {
    switch (n) {
      case 'House Plant': { const s = pot(g, 8, b, 8, 7, CLAY); for (const [dx, dy, dr] of [[-6, -6, 4], [6, -6, 4], [-4, -11, 3], [4, -11, 3], [0, -14, 0], [-2, -8, 0], [2, -9, 0]]) frond(g, 7 + (dx > 0 ? 1 : 0), s, dx, dy, dr, dx % 4 ? L : D, 3); break; }
      case 'Small Plant': { const s = pot(g, 8, b, 6, 5, T('#e9e3d6'), { band: hex('#6fa0d2') }); frond(g, 7, s, -3, -5, 2, L, 2); frond(g, 8, s, 3, -5, 2, D, 2); frond(g, 8, s, 0, -7, 0, L, 2); break; }
      case 'Table Plant': {
        const t = T('#a8703f'); leg(g, 3, b - 7, 2, 8, t); leg(g, 11, b - 7, 2, 8, t); g.hline(4, b - 3, 8, t[2]); topSlab(g, 2, b - 10, 12, 2, 1, t);
        const s = pot(g, 8, b - 10, 6, 4, T('#4f7fd6')); bush(g, 8, s - 3, 5, 4, L); g.px(6, s - 6, T('#ee8fb6')[3]); g.px(10, s - 4, T('#ee8fb6')[4]); g.px(8, s - 2, T('#f6dc5a')[4]);
        break;
      }
      case 'Tall House Plant': { const s = pot(g, 8, b, 8, 6, T('#7d8a9a')); trunk(g, 7, 4, s, D, 2); for (let j = 4; j < s - 1; j += 4) { const d = (j >> 2) % 2 ? 1 : -1; frond(g, 7 + (d > 0 ? 1 : 0), j + 3, d * 5, -3, 3, L, 3); frond(g, 7 + (d < 0 ? 1 : 0), j + 5, -d * 4, -2, 2, D, 2); } g.px(7, 3, L[5]); g.px(8, 2, L[4]); break; }
      case 'Bonsai Tree': {
        pot(g, 8, b, 12, 4, T('#3f6a9a'), { square: true }); g.px(2, b, T('#3f6a9a')[1]); g.px(13, b, T('#3f6a9a')[1]);
        for (let j = 0; j < 10; j++) { const xx = 7 + Math.round(Math.sin(j * 0.7) * 2); g.rect(xx, b - 5 - j, 3 - (j > 6 ? 1 : 0), 1, BR[3]); g.px(xx + 1, b - 5 - j, BR[1]); }
        g.line(9, b - 10, 13, b - 12, BR[2]);
        bush(g, 6, b - 17, 5, 3, L); bush(g, 12, b - 13, 3.4, 2.2, D); bush(g, 3, b - 11, 2.6, 1.8, D); bush(g, 10, b - 20, 3, 2, L);
        break;
      }
      case 'Deluxe Tree': { const s = pot(g, 8, b, 9, 7, GOLD, { band: RED[3] }); trunk(g, 7, 14, s, BR, 2); bush(g, 8, 9, 7, 7, D); for (const [dx, dy] of [[-3, -3], [3, -1], [-1, 2], [4, 4], [-5, 3], [1, -5]]) { g.px(8 + dx, 9 + dy, T('#ee8fb6')[4]); g.px(9 + dx, 9 + dy, T('#ee8fb6')[3]); g.px(8 + dx, 10 + dy, T('#ee8fb6')[3]); } break; }
      case 'Exotic Palm': {
        const s = pot(g, 8, b, 8, 6, T('#d9b55c'), { band: RED[3] }); const tr = T('#a8875a');
        for (let j = s; j > 9; j--) { const xx = 7 + Math.round((s - j) * 0.12); g.rect(xx, j, 2, 1, tr[3]); g.px(xx + 1, j, tr[1]); if (j % 3 === 0) g.hline(xx, j, 2, tr[1]); }
        for (const [dx, dy, dr] of [[-7, -3, 5], [7, -3, 5], [-5, -7, 3], [5, -7, 3], [-7, 1, 5], [6, 1, 6], [0, -8, 0]]) frond(g, 9, 9, dx, dy, dr, dx < 0 ? L : D, 1);
        circle(g, 8, 11, 1.2, T('#7b4b2f')[3]); circle(g, 11, 11, 1.2, T('#7b4b2f')[2]);
        break;
      }
      case 'Exotic Tree': { const s = pot(g, 8, b, 8, 6, T('#7c4eb0'), { band: GOLD[4] }); trunk(g, 7, 14, s, T('#5b3b2e'), 2, 1); const r = T('#d9435a'); bush(g, 5, 11, 4.5, 4.5, r); bush(g, 11, 10, 4.5, 5, r); bush(g, 8, 6, 5, 4, T('#e8873a')); for (const [dx, dy] of [[4, 12], [11, 13], [8, 8]]) g.px(dx, dy, T('#f6dc5a')[5]); break; }
      case 'Indoor Palm': { const s = pot(g, 8, b, 8, 7, T('#e9e3d6')); for (const [dx, dy, dr] of [[-7, -8, 6], [7, -8, 6], [-5, -13, 4], [5, -13, 4], [-2, -17, 1], [2, -18, 1], [-7, -3, 4], [7, -3, 4]]) frond(g, 8, s, dx, dy, dr, (dx + 8) % 3 ? L : D, 1); break; }
      case 'Long Palm': {
        const s = pot(g, 8, b, 6, 5, CLAY); const tr = T('#a8875a');
        for (let j = s; j > 7; j--) { g.rect(7, j, 2, 1, tr[3]); g.px(8, j, tr[1]); if (j % 3 === 0) g.px(7, j, tr[1]); }
        for (const [dx, dy, dr] of [[-6, -3, 4], [6, -3, 4], [-4, -6, 2], [4, -6, 2], [-6, 0, 5], [6, 0, 5], [0, -6, 0]]) frond(g, 8, 7, dx, dy, dr, dx < 0 ? L : D, 1);
        break;
      }
      case 'Tree Column': { const s = pot(g, 8, b, 8, 5, T('#9b968d'), { square: true }); rr(g, 3, 2, 10, s - 1, D[3], 3); rr(g, 3, 2, 6, s - 3, L[3], 3); g.rect(4, 4, 2, s - 8, L[4]); g.px(4, 4, L[5]); for (let j = 5; j < s - 2; j += 3) { g.px(7 + (j % 2), j, L[1]); g.px(10, j + 1, D[1]); g.px(5, j + 1, L[5]); } g.rect(11, 5, 2, s - 6, D[2]); break; }
      case 'Tree of the Winter Star': {
        const tp = T('#2f7a45');
        g.rect(cx - 2, b - 7, 4, 6, BR[3]); g.vline(cx + 1, b - 7, 6, BR[1]);
        pine(g, cx, 6, b - 6, 14, tp, 8);
        const orn = ['#e8504a', '#f6dc5a', '#6fc0f0', '#ee8fb6', '#f4f4f4'];
        for (let i = 0; i < 16; i++) { const j = 12 + i * 2 + (i % 2), half = ((j - 6) / (b - 12)) * 11, ox = cx + Math.round((hash(i, 2, 6) * 2 - 1) * half); circle(g, ox, j, 1.1, T(orn[i % 5])[3]); g.px(ox - 1, j - 1, T(orn[i % 5])[5]); }
        for (let i = 0; i < 3; i++) for (let k = 0; k < 20; k++) { const j = 14 + i * 9 + Math.round(k / 5), xx = cx - 10 + k + i; if (g.alpha(xx, j) && k % 2 === 0) g.px(xx, j, GOLD[5]); }
        icon(g, 'star', cx, 4, GOLD[4]); g.px(cx - 1, 3, GOLD[5]);
        const gift = (gx: number, col: Tones, rb: Tones) => { g.rect(gx, b - 4, 6, 5, col[3]); g.hline(gx, b - 4, 6, col[4]); g.vline(gx + 2, b - 4, 5, rb[4]); g.hline(gx, b - 2, 6, rb[4]); g.px(gx + 1, b - 5, rb[4]); g.px(gx + 3, b - 5, rb[4]); };
        gift(3, RED, WHITE); gift(22, T('#4f7fd6'), GOLD); gift(10, GREEN, RED);
        break;
      }
      case 'Corn Plant': {
        const s = pot(g, 8, b, 8, 6, T('#b0603a')); const tr = T('#b09a6a');
        for (let j = s; j > 9; j--) { g.rect(7, j, 2, 1, tr[3]); g.px(8, j, tr[1]); if (j % 4 === 0) g.hline(7, j, 2, tr[1]); }
        const Y = T('#c8d85a');
        for (const [bx, by, sc] of [[8, 10, 1], [9, 17, 0.6]]) for (const [dx, dy, dr] of [[-6, -4, 6], [6, -4, 6], [-4, -8, 3], [4, -8, 3], [0, -9, 0], [-7, 0, 5], [7, 0, 5]]) frond(g, bx, by, dx * sc, dy * sc, dr * sc, dx % 3 ? D : Y, 2);
        break;
      }
      case 'Curly Tree': {
        const s = pot(g, cx, b, 10, 6, T('#e9e3d6'), { band: hex('#4f7fd6') });
        for (let j = s; j > 12; j--) { const xx = cx - 1 + Math.round(Math.sin((s - j) * 0.8) * 3); g.rect(xx, j, 2, 1, BR[3]); g.px(xx + 1, j, BR[1]); }
        bush(g, cx - 5, 9, 6, 5, L); bush(g, cx + 6, 8, 6, 5.5, D); bush(g, cx, 5, 5, 3.6, L);
        for (const [sx, sy] of [[cx - 6, 9], [cx + 6, 8]]) { g.px(sx, sy, L[1]); g.px(sx + 1, sy - 1, L[1]); g.px(sx + 2, sy, L[1]); g.px(sx + 1, sy + 1, L[1]); g.px(sx - 1, sy + 1, L[1]); }
        break;
      }
      case 'Dried Sunflowers': {
        const v = T('#6a8aa0'); rr(g, 5, b - 8, 6, 9, v[3], 1); g.vline(5, b - 7, 7, v[4]); g.vline(10, b - 7, 7, v[1]); g.rect(6, b - 9, 4, 2, v[2]); g.px(6, b - 6, v[5]);
        const st = T('#8a7a3a'), pe = T('#d9a03a'), ce = T('#5b3b2e');
        for (const [fx, fy] of [[4, 8], [11, 6], [8, 13]]) { g.line(8, b - 9, fx, fy + 2, st[3]); circle(g, fx, fy, 3, pe[3]); g.px(fx - 2, fy - 2, pe[5]); circle(g, fx, fy, 1.4, ce[3]); g.px(fx - 3, fy, pe[2]); g.px(fx + 3, fy + 1, pe[2]); }
        g.px(6, b - 12, st[2]); g.px(5, b - 13, st[3]);
        break;
      }
      case 'Fancy House Plant': {
        const u = T('#e9e3d6'); g.rect(cx - 3, b - 2, 6, 3, u[2]); g.rect(cx - 2, b - 4, 4, 2, u[3]); rr(g, cx - 8, b - 10, 16, 7, u[3], 2); g.hline(cx - 8, b - 10, 16, u[5]); g.hline(cx - 6, b - 5, 12, u[1]); for (let i = -6; i < 7; i += 3) g.px(cx + i, b - 7, GOLD[4]); g.hline(cx - 7, b - 9, 14, T('#4f7fd6')[3]);
        for (const [dx, dy, dr] of [[-13, -8, 7], [13, -8, 7], [-9, -15, 4], [9, -15, 4], [-3, -18, 1], [3, -19, 1], [-13, -2, 6], [13, -2, 6]]) frond(g, cx, b - 10, dx, dy, dr, (dx + 13) % 4 ? L : D, 3);
        for (const [fx, fy] of [[cx - 8, 9], [cx + 9, 11], [cx, 5]]) icon(g, 'bloom', fx, fy, T('#ee6a8a')[3], GOLD[5]);
        break;
      }
      case 'Junimo Flower': {
        const s = pot(g, 8, b, 8, 6, T('#8a5a34'), { band: L[4] }); trunk(g, 7, 12, s, L, 2); frond(g, 8, s - 3, 5, -3, 3, L, 2); frond(g, 7, s - 5, -5, -2, 3, D, 2);
        const pc = ['#e8504a', '#f6dc5a', '#6fc0f0', '#b98af0', '#ee8fb6', '#8ae06a'];
        for (let a = 0; a < 6; a++) circle(g, 8 + Math.cos(a * 1.047) * 4, 7.5 + Math.sin(a * 1.047) * 4, 2.2, T(pc[a])[3]);
        circle(g, 8, 7.5, 2.6, T('#f6dc5a')[4]); g.px(7, 7, INK); g.px(9, 7, INK);
        break;
      }
      case 'Junimo Plant': {
        const t = T('#8a5a34'); rr(g, 3, b - 6, 26, 7, t[3], 1); g.hline(3, b - 6, 26, t[5]); g.hline(4, b - 5, 24, T('#4a3020')[3]); g.vline(3, b - 5, 5, t[4]); g.rect(27, b - 5, 2, 5, t[1]); icon(g, 'star5', cx, b - 2, T('#f6dc5a')[4]);
        const pc = ['#e8504a', '#6fc0f0', '#f6dc5a', '#b98af0', '#8ae06a'];
        pc.forEach((col, i) => { const sx = 6 + i * 5, top = 8 + ((i * 7) % 5) * 2; trunk(g, sx, top + 4, b - 6, L, 1); const jt = T(col); rr(g, sx - 2, top, 5, 5, jt[3], 1); g.px(sx - 1, top + 1, jt[5]); g.px(sx - 1, top + 2, INK); g.px(sx + 1, top + 2, INK); g.px(sx, top - 1, L[3]); g.px(sx + 1, top - 2, L[4]); g.px(sx + 1, top + 7, L[4]); g.px(sx + 2, top + 6, L[3]); });
        break;
      }
      case 'Junimo Tree': {
        const t = T('#8a5a34'); pot(g, cx, b, 14, 6, T('#62b04c'), { band: T('#f6dc5a')[4] });
        g.rect(cx - 2, 14, 4, b - 19, t[3]); g.vline(cx - 2, 14, b - 19, t[4]); g.vline(cx + 1, 14, b - 19, t[1]); g.line(cx - 2, 18, cx - 8, 14, t[3]); g.line(cx + 2, 17, cx + 9, 13, t[2]);
        bush(g, cx - 12, 10, 9, 7, L); bush(g, cx + 12, 10, 9, 7, D); bush(g, cx, 7, 11, 6.5, L);
        const pc = ['#e8504a', '#6fc0f0', '#f6dc5a', '#b98af0', '#ee8fb6', '#f4f4f4'];
        [[-15, 11], [-7, 6], [1, 9], [9, 6], [16, 12], [-10, 13], [10, 13]].forEach(([dx, dy], i) => { const jt = T(pc[i % 6]); rr(g, cx + dx - 2, dy - 2, 4, 4, jt[3], 1); g.px(cx + dx - 1, dy - 1, jt[5]); g.px(cx + dx - 1, dy - 3, L[1]); });
        break;
      }
      case 'Long Cactus': {
        const s = pot(g, 8, b, 8, 5, CLAY), ct = T('#4f9a55');
        rr(g, 6, 3, 5, s - 2, ct[3], 2); g.vline(7, 4, s - 4, ct[4]); g.vline(10, 5, s - 5, ct[2]);
        g.rect(2, 12, 2, 6, ct[3]); g.px(2, 12, ct[4]); g.rect(3, 17, 3, 2, ct[3]); g.rect(12, 9, 2, 6, ct[2]); g.rect(11, 14, 2, 2, ct[2]); g.px(12, 9, ct[3]);
        for (let j = 5; j < s - 2; j += 3) { g.px(8, j, ct[5]); g.px(9, j + 1, ct[1]); }
        g.px(8, 2, T('#ee8fb6')[3]); g.px(7, 1, T('#ee8fb6')[4]); g.px(9, 2, T('#ee8fb6')[3]); g.px(2, 11, T('#f6dc5a')[4]);
        break;
      }
      case 'Manicured Pine': { const s = pot(g, 8, b, 8, 6, T('#7b4b2f'), { square: true }); g.rect(7, s - 2, 2, 3, BR[2]); const p = T('#2f7a45'); for (let j = 0; j < s - 3; j++) { const k = Math.round(1 + (j / (s - 4)) * 5); g.hline(8 - k, 2 + j, 2 * k, p[3]); g.px(8 - k, 2 + j, p[5]); g.px(9 - k, 2 + j, p[4]); g.rect(8 + k - 2, 2 + j, 2, 1, p[2]); } for (let j = 6; j < s - 3; j += 4) { g.px(6, j, p[5]); g.px(9, j + 2, p[1]); } break; }
      case 'Plastic Plant': { const s = pot(g, 8, b, 8, 6, T('#4fa0e0'), { square: true, band: hex('#ffffff') }); const pt = T('#3fc0a0'); for (const [dx, dy] of [[-6, -6], [6, -6], [-4, -11], [4, -11], [0, -14]]) { frond(g, 8, s, dx, dy, 0, pt, 3); g.px(8 + dx, s + dy, pt[5]); } g.px(7, s - 6, hex('#ffffff')); g.px(5, s - 8, hex('#ffffff')); break; }
      case 'Plastic Sapling': { const s = pot(g, 8, b, 6, 5, T('#f1f1f1'), { square: true }); g.vline(8, 9, s - 8, T('#9a8a7a')[3]); g.vline(7, 12, s - 11, T('#9a8a7a')[4]); const pt = T('#5fd070'); for (const [bx, by] of [[5, 13], [11, 10], [8, 6]]) { circle(g, bx, by, 2.6, pt[3]); g.px(bx - 1, by - 2, hex('#ffffff')); g.px(bx + 1, by + 1, pt[1]); } g.line(8, 15, 6, 14, T('#9a8a7a')[3]); g.line(8, 12, 10, 11, T('#9a8a7a')[3]); break; }
      case 'Potted Red Mushroom': {
        const s = pot(g, 8, b, 8, 6, T('#7b5a3a')); const st = T('#f1e8d0'), cp = T('#d93a3a');
        g.rect(6, s - 6, 4, 7, st[4]); g.vline(9, s - 6, 7, st[2]); g.hline(5, s - 6, 6, st[2]);
        g.ellipse(8, s - 10, 7, 5.5, cp[3]); for (let j = s - 6; j < s; j++) for (let i = 0; i < 16; i++) if (i < 6 || i > 9) clearPx(g, i, j);
        g.ellipse(6, s - 12, 3, 2, cp[4]); g.hline(2, s - 7, 12, cp[1]);
        for (const [dx, dy] of [[4, -12], [9, -13], [11, -9], [6, -9], [2, -9]]) { g.rect(dx, s + dy, 2, 2, hex('#fff8ec')); }
        g.px(4, s - 1, L[3]); g.px(3, s - 2, L[4]); g.px(12, s - 1, L[3]);
        break;
      }
      case 'Retro Flower': {
        const s = pot(g, 8, b, 6, 6, T('#3aa79f'), { square: true, band: hex('#f6e7b8') }); trunk(g, 7, 12, s, D, 2); frond(g, 8, s - 3, 4, -2, 2, L, 2);
        const pe = T('#e2853c'); for (let a = 0; a < 8; a++) circle(g, 8 + Math.cos(a * 0.785) * 4.2, 7.5 + Math.sin(a * 0.785) * 4.2, 1.8, pe[a % 2 ? 3 : 4]); circle(g, 8, 7.5, 2.4, T('#f6e7b8')[4]); circle(g, 8, 7.5, 1, T('#7b4b2f')[3]);
        break;
      }
      case 'Retro Plant': {
        const o = T('#e2853c');
        for (let j = 0; j < 7; j++) { g.px(4 - Math.floor(j / 3), b - 6 + j, T('#7b4b2f')[3]); g.px(11 + Math.floor(j / 3), b - 6 + j, T('#7b4b2f')[2]); g.px(8, b - 6 + j, T('#7b4b2f')[1]); }
        for (let j = 0; j < 7; j++) { const k = 6 - Math.floor(j * 0.7); g.hline(8 - k, b - 13 + j, 2 * k, o[3]); g.px(8 - k, b - 13 + j, o[5]); g.px(7 + k, b - 13 + j, o[1]); } g.hline(2, b - 13, 12, o[4]); g.hline(4, b - 10, 8, T('#3aa79f')[3]);
        for (const [bx, by, r] of [[5, 13, 3], [11, 12, 3], [8, 8, 3.4], [4, 7, 2], [12, 6, 2]]) { circle(g, bx, by, r, D[3]); circle(g, bx - 0.5, by - 0.5, r - 1, L[4]); g.px(bx - 1, by - 1, L[5]); }
        break;
      }
      case 'S. Pine': { const s = pot(g, 8, b, 6, 5, T('#b03a3a'), { band: GOLD[4] }); g.rect(7, s - 2, 2, 3, BR[2]); pine(g, 8, 9, s - 2, 6, T('#2f7a45'), 4); break; }
      case 'Swamp Plant': {
        const s = pot(g, 8, b, 9, 6, T('#4a5a4a')); const sw = T('#3a6a4a'), pu = T('#6a4a8a');
        for (const [dx, dy, dr] of [[-7, -5, 9], [7, -5, 9], [-5, -9, 7], [5, -10, 8]]) frond(g, 8, s, dx, dy, dr, dx < 0 ? sw : pu, 2);
        for (const [rx, top] of [[6, 6], [9, 3], [11, 9]]) { g.vline(rx, top, s - top, sw[2]); g.rect(rx - 1, top, 3, 5, T('#6b4530')[3]); g.vline(rx - 1, top, 5, T('#6b4530')[4]); g.px(rx, top - 1, sw[4]); }
        g.px(3, s + 2, T('#6fe0b0')[3]); g.px(13, s - 1, T('#6fe0b0')[3]);
        break;
      }
      case 'Topiary Tree': { const s = pot(g, 8, b, 8, 5, T('#e9e3d6'), { square: true }); g.rect(7, 6, 2, s - 5, BR[3]); g.vline(8, 6, s - 5, BR[1]); bush(g, 8, s - 5, 5.5, 4.5, D); bush(g, 8, s - 13, 4.4, 3.8, L); bush(g, 8, 5, 3.2, 3, D); break; }
      default: { const s = pot(g, cx, b, Math.min(10, w - 6), 6, CLAY); bush(g, cx, s - 6, w / 2 - 2, 7, L); }
    }
  });
};

// ------------------------------------------------------------------ piano

painters.piano = (img, x, y, w, h, c) => {
  const dark = /Dark/.test(c.name), t = dark ? T('#3a3440') : T('#8f5a36'), b = h - 2;
  sprite(img, x, y, w, h, (g) => {
    // upper case
    blk(g, 2, 6, w - 4, 20, t); g.rect(1, 4, w - 2, 3, t[4]); g.hline(1, 4, w - 2, t[5]); g.hline(1, 6, w - 2, t[2]);
    g.rect(5, 10, w - 10, 13, t[2]); g.hline(5, 10, w - 10, t[1]); g.vline(5, 10, 13, t[1]);
    for (const xx of [8, w - 13]) { g.rect(xx, 12, 5, 9, t[3]); g.hline(xx, 12, 5, t[4]); }
    // music stand
    g.rect(16, 13, 16, 9, t[3]); g.hline(16, 22, 16, t[4]);
    g.rect(18, 12, 12, 10, PAPER[5]); g.vline(24, 12, 10, PAPER[2]); for (let j = 14; j < 21; j += 2) { g.hline(19, j, 4, INK); g.hline(26, j, 3, INK); } g.px(21, 15, INK); g.px(27, 17, INK);
    // keyboard
    g.rect(1, 26, w - 2, 2, t[4]); g.hline(1, 26, w - 2, t[5]);
    g.rect(3, 28, w - 6, 5, hex('#fbf7ee')); g.hline(3, 32, w - 6, hex('#c9c2b0'));
    for (let xx = 5; xx < w - 3; xx += 3) g.vline(xx, 28, 5, hex('#b0a898'));
    for (let i = 0, xx = 4; xx < w - 5; xx += 3, i++) if (i % 7 !== 2 && i % 7 !== 6) g.rect(xx, 28, 2, 3, hex('#2a2430'));
    g.rect(1, 28, 2, 6, t[3]); g.rect(w - 3, 28, 2, 6, t[2]); g.rect(1, 33, w - 2, 2, t[3]); g.hline(1, 34, w - 2, t[1]);
    // lower case and legs
    face(g, 3, 35, w - 6, b - 37, t); g.rect(6, 37, w - 12, b - 41, t[3]); g.hline(6, 37, w - 12, t[1]);
    leg(g, 2, 35, 3, b - 34, t); leg(g, w - 5, 35, 3, b - 34, t);
    g.rect(1, b - 1, w - 2, 2, t[1]); g.hline(1, b - 1, w - 2, t[2]);
    for (const xx of [20, 24, 28]) { g.rect(xx, b - 3, 2, 2, GOLD[4]); g.px(xx + 1, b - 2, GOLD[2]); }
    // things on top
    if (dark) { g.rect(8, 2, 6, 2, STEEL[2]); candle(g, 8, 1, T('#b9a6d8'), 3); candle(g, 12, 1, T('#b9a6d8'), 3); candle(g, 10, 1, T('#b9a6d8'), 5); icon(g, 'skull', w - 10, 1, WHITE[4]); g.hline(8, 12, 5, T('#7c4eb0')[3]); g.hline(w - 13, 12, 5, T('#7c4eb0')[3]); }
    else { vase(g, 8, 3, T('#6fa0d2'), T('#e9c040')); const mt = T('#b37c46'); for (let j = 0; j < 5; j++) g.hline(w - 12 + Math.floor((4 - j) / 2), -1 + j, 5 - 2 * Math.floor((4 - j) / 2), mt[3]); g.line(w - 10, 3, w - 9, 0, STEEL[5]); g.px(8, 20, GOLD[4]); g.px(w - 9, 20, GOLD[4]); }
  });
};

// ------------------------------------------------------------------ catalogue

painters.catalogue = (img, x, y, w, h, c) => {
  const n = c.name, m = mat(n), b = h - 2, cx = w / 2;
  let post: Draw | undefined;
  sprite(img, x, y, w, h, (g) => {
    const book = (bx: number, by: number, bw: number, bh: number, t: Tones, ic: string, icol: RGBA, ribbon: RGBA = RED[3]) => {
      g.rect(bx + 1, by + 1, bw, bh, PAPER[3]); for (let j = by + 2; j < by + bh; j += 2) g.px(bx + bw, j, PAPER[1]); g.hline(bx + 2, by + bh, bw - 1, PAPER[1]);
      g.rect(bx, by, bw, bh, t[3]); g.hline(bx, by, bw, t[4]); g.vline(bx, by, bh, t[2]); g.vline(bx + 1, by, bh, t[4]); g.px(bx + 2, by + 1, t[5]);
      g.hline(bx + 3, by + 1, bw - 4, t[2]); g.hline(bx + 3, by + bh - 2, bw - 4, t[2]);
      icon(g, ic, bx + bw / 2 + 1, by + bh / 2, icol, t[1]);
      g.vline(bx + bw - 2, by + bh, 3, ribbon);
    };
    const lectern = (t: Tones) => { g.rect(cx - 6, 16, 12, 2, t[4]); g.hline(cx - 6, 17, 12, t[2]); g.rect(cx - 1, 18, 3, b - 19, t[3]); g.vline(cx + 1, 18, b - 19, t[1]); g.rect(cx - 4, b - 1, 9, 2, t[2]); g.hline(cx - 4, b - 1, 9, t[4]); g.px(cx - 2, 18, t[2]); g.px(cx + 2, 18, t[2]); };
    if (/Furniture Catalogue/.test(n) && w > 16) {
      const t = T('#8f5a36'); face(g, 3, 19, w - 6, b - 19, t); g.rect(6, 21, w - 12, b - 23, t[3]); g.hline(6, 21, w - 12, t[1]); topSlab(g, 2, 15, w - 4, 3, 1, t);
      book(8, 2, 16, 13, T('#b03a3a'), 'crown', GOLD[4]);
      g.rect(13, 6, 7, 2, GOLD[4]); g.rect(13, 4, 2, 6, GOLD[4]); g.rect(18, 8, 2, 3, GOLD[3]); g.rect(13, 8, 2, 3, GOLD[3]); g.rect(12, 3, 9, 1, T('#b03a3a')[3]);
      g.px(14, 25, GOLD[4]); g.px(17, 25, GOLD[4]);
    } else if (/Joja/.test(n)) {
      g.rect(cx - 6, 16, 12, 2, STEEL[4]); g.rect(cx - 1, 18, 2, b - 19, STEEL[3]); g.rect(cx - 5, b - 1, 10, 2, STEEL[2]); g.hline(cx - 5, b - 1, 10, STEEL[5]);
      book(3, 3, 10, 13, m.wood, 'joja', WHITE[5], WHITE[5]);
    } else if (/Junimo/.test(n)) {
      const tr = T('#8a5a34'); g.rect(4, 17, 8, b - 16, tr[3]); g.vline(4, 17, b - 16, tr[4]); g.rect(10, 17, 2, b - 16, tr[1]); g.vline(7, 20, 4, tr[2]); g.px(3, b, tr[2]); g.px(12, b, tr[1]); g.ellipse(8, 16.5, 6, 2, T('#e0c48a')[3]);
      book(3, 3, 10, 13, m.wood, 'star5', m.cloth[4], m.cloth[3]); g.px(13, 18, LEAF[4]); g.px(14, 17, LEAF[3]);
    } else if (/Retro/.test(n)) {
      for (let j = 0; j < b - 17; j++) { const k = Math.round(1 + (j / (b - 18)) ** 2 * 4); g.hline(cx - k, 18 + j, 2 * k, m.trim[3]); g.px(cx - k, 18 + j, m.trim[5]); g.px(cx + k - 1, 18 + j, m.trim[1]); } g.ellipse(cx, 17, 6, 1.6, m.trim[4]);
      book(3, 3, 10, 13, m.wood, 'sun', m.cloth[3], m.cloth[3]);
    } else if (/Trash/.test(n)) {
      const t = T('#8d95a0'); for (let j = 0; j < b - 15; j++) { const k = j > b - 20 ? 5 : 6; g.hline(cx - k, 16 + j, 2 * k, t[3]); g.px(cx - k, 16 + j, t[5]); g.px(cx + k - 1, 16 + j, t[1]); } for (const xx of [5, 8, 11]) g.vline(xx, 19, b - 20, t[2]); g.rect(1, 15, 14, 2, t[4]); g.hline(1, 16, 14, t[2]);
      book(3, 2, 10, 13, T('#7a6a4a'), 'bone', WHITE[4], T('#5a8a3a')[3]); g.rect(4, 11, 3, 3, T('#5a8a3a')[3]); g.px(10, 4, T('#5a4a2a')[3]); g.px(11, 5, T('#5a4a2a')[3]);
      post = (g) => { g.px(14, 5, INK); g.px(1, 9, INK); g.px(15, 4, WHITE[5]); g.px(0, 8, WHITE[5]); };
    } else if (/Wizard/.test(n)) {
      lectern(T('#3f3463')); icon(g, 'star5', cx, 22, GOLD[4]);
      book(3, 2, 10, 13, m.wood, 'moon', GOLD[4], GOLD[4]);
      post = (g) => { lampGlow(g, 8, 8, 10, hex('#c0a0ff')); g.px(1, 3, GOLD[5]); g.px(14, 1, GOLD[5]); g.px(15, 12, hex('#c0a0ff')); };
    } else if (/Animal/.test(n)) {
      lectern(T('#a8703f')); book(3, 3, 10, 13, T('#4f9a55'), 'paw', T('#f6e7b8')[4], GOLD[4]);
    } else {
      lectern(T('#8f5a36')); book(3, 3, 10, 13, T('#3f6fb8'), 'diamond', GOLD[4]);
      g.px(9, 9, T('#3f6fb8')[3]);
    }
  }, { post: (g) => post?.(g) });
};

// ------------------------------------------------------------------ rugs (flat on the floor)

/** Draws into a private canvas without outline or shadow. */
function flat(img: Img, x: number, y: number, w: number, h: number, draw: Draw) {
  const g = new Img(w, h);
  draw(g);
  img.blit(g, x, y);
}
function ring(g: Img, x: number, y: number, w: number, h: number, col: RGBA, th = 1) {
  for (let k = 0; k < th; k++) { g.hline(x + k, y + k, w - 2 * k, col); g.hline(x + k, y + h - 1 - k, w - 2 * k, col); g.vline(x + k, y + k, h - 2 * k, col); g.vline(x + w - 1 - k, y + k, h - 2 * k, col); }
}
/** Rectangular rug with a dark edge, optional border lines and fringe on the short ends. */
function rugRect(g: Img, w: number, h: number, t: Tones, borders: [number, RGBA, number?][] = [], fringe: RGBA | null = hex('#efe2c0')) {
  const fx = fringe ? 1 : 0;
  g.rect(fx, 1, w - 2 * fx, h - 2, t[3]);
  for (const [ins, col, th] of borders) ring(g, fx + ins, 1 + ins, w - 2 * fx - 2 * ins, h - 2 - 2 * ins, col, th ?? 1);
  ring(g, fx, 1, w - 2 * fx, h - 2, t[1]);
  g.hline(fx + 1, 2, w - 2 * fx - 2, t[4]);
  if (fringe) for (let yy = 2; yy < h - 2; yy += 2) { g.px(0, yy, fringe); g.px(w - 1, yy, fringe); }
}
function rugRound(g: Img, w: number, h: number, rings: [number, RGBA][]) {
  const cx = w / 2, cy = h / 2;
  for (const [f, col] of rings) g.ellipse(cx, cy, (w / 2 - 1) * f, (h / 2 - 1) * f, col);
}
function checker(g: Img, x: number, y: number, w: number, h: number, s: number, a: RGBA, b2: RGBA, c2?: RGBA) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const xi = Math.floor(i / s) % 2, yi = Math.floor(j / s) % 2; g.px(x + i, y + j, xi && yi ? (c2 ?? a) : xi || yi ? (c2 ? a : xi === yi ? a : b2) : b2); }
}
function zig(g: Img, x: number, y: number, w: number, amp: number, col: RGBA, th = 1) {
  for (let i = 0; i < w; i++) { const k = Math.abs((i % (2 * amp)) - amp); for (let q = 0; q < th; q++) g.px(x + i, y + k + q, col); }
}

painters.rug = (img, x, y, w, h, c) => {
  const n = c.name, m = mat(n), cx = w / 2, cy = h / 2;
  const cream = hex('#f1e6c8');
  flat(img, x, y, w, h, (g) => {
    if (/Joja/.test(n)) {
      const t = m.wood;
      rugRect(g, w, h, t, [[2, WHITE[5]], [3, t[2]]], WHITE[4]);
      if (/Large/.test(n)) { g.rect(8, 8, w - 16, h - 16, t[2]); ring(g, 8, 8, w - 16, h - 16, WHITE[5]); circle(g, cx, cy, 9, WHITE[5]); circle(g, cx, cy, 7.6, RED[3]); icon(g, 'joja', cx, cy, WHITE[5]); for (const dx of [-24, 24]) icon(g, 'diamond', cx + dx, cy, WHITE[4]); }
      else if (/Square/.test(n)) { circle(g, cx, cy, 9, WHITE[5]); circle(g, cx, cy, 7.6, t[2]); icon(g, 'joja', cx, cy, WHITE[5]); }
      else if (/Small/.test(n)) { icon(g, 'joja', cx, cy, WHITE[5]); g.hline(6, cy, 6, WHITE[4]); g.hline(w - 12, cy, 6, WHITE[4]); }
      else { g.rect(cx - 7, 6, 14, h - 12, WHITE[5]); g.rect(cx - 6, 7, 12, h - 14, RED[3]); icon(g, 'joja', cx, cy, WHITE[5]); for (let yy = 8; yy < h - 7; yy += 4) { g.hline(7, yy, 8, t[4]); g.hline(w - 15, yy, 8, t[4]); } }
    } else if (/Junimo/.test(n)) {
      const t = m.wood, ye = m.cloth;
      if (/Circular/.test(n)) {
        rugRound(g, w, h, [[1, t[1]], [0.96, t[3]], [0.8, ye[4]], [0.74, t[4]], [0.42, t[2]], [0.38, t[3]]]);
        icon(g, 'star', cx, cy, ye[4]);
        for (let a = 0; a < 8; a++) icon(g, 'leaf', cx + Math.cos(a * 0.785) * 14, cy + Math.sin(a * 0.785) * 14, t[2], t[1]);
      } else {
        rugRect(g, w, h, t, [[2, ye[4]], [4, t[2]]], ye[4]);
        if (/Small/.test(n)) { icon(g, 'star5', cx, cy, ye[4]); icon(g, 'leaf', 8, cy, t[5], t[1]); icon(g, 'leaf', w - 8, cy, t[5], t[1]); }
        else if (/Mat/.test(n)) { for (const dx of [-12, 0, 12]) icon(g, 'star', cx + dx, cy, dx ? t[5] : ye[4]); }
        else if (/Square/.test(n)) { g.ellipse(cx, cy, 9, 9, t[4]); icon(g, 'star', cx, cy, ye[4]); for (const [dx, dy] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) icon(g, 'bloom', cx + dx, cy + dy, ye[4], t[1]); }
        else { g.ellipse(cx, cy, 14, 12, t[4]); g.ellipse(cx, cy, 12, 10, t[2]); icon(g, 'star', cx, cy, ye[4]); for (const [dx, dy] of [[-22, -12], [22, -12], [-22, 12], [22, 12], [-22, 0], [22, 0]]) icon(g, 'leaf', cx + dx, cy + dy, t[5], t[1]); const jc = ['#e8504a', '#6fc0f0', '#b98af0', '#f6dc5a']; jc.forEach((col, i) => { const jx = cx + [-12, 12, -12, 12][i], jy = cy + [-13, -13, 13, 13][i]; rr(g, jx - 2, jy - 2, 4, 4, hex(col), 1); }); }
      }
    } else if (/Retro/.test(n)) {
      const o = m.wood, te = m.cloth, cr = m.trim;
      if (/Mat/.test(n)) { rugRect(g, w, h, cr, [], null); for (let i = 0; i < 5; i++) g.rect(2 + i * 6, 2, 3, h - 4, [o[3], te[3], T('#7b4b2f')[3], te[3], o[3]][i]); }
      else if (/Square/.test(n)) { rugRect(g, w, h, te, [], null); for (const [cx2, cy2] of [[9, 9], [23, 9], [9, 23], [23, 23]]) { circle(g, cx2, cy2, 6, cr[4]); circle(g, cx2, cy2, 4.4, o[3]); circle(g, cx2, cy2, 2, T('#7b4b2f')[3]); } }
      else if (/Large/.test(n)) { rugRect(g, w, h, cr, [], null); const cols = [o[3], te[3], T('#7b4b2f')[3], cr[4], o[4]]; cols.forEach((col, i) => rr(g, 4 + i * 4, 4 + i * 4, w - 8 - i * 8, h - 8 - i * 8, col, 5)); }
      else { rugRect(g, w, h, o, [], null); for (let i = 0; i < w; i++) for (const [off, col] of [[8, te[3]], [14, cr[4]], [20, T('#7b4b2f')[3]]] as [number, RGBA][]) { const yy = off + Math.round(Math.sin(i / 7) * 4); g.rect(i, yy, 1, 3, col); } ring(g, 0, 1, w, h - 2, o[1]); }
    } else if (/Cottage|Large Green|Large Red|^Red Rug/.test(n)) {
      if (/Cottage/.test(n)) {
        const t = /Green/.test(n) ? T('#5fa058') : /Red/.test(n) ? T('#c8504a') : T('#5a7fc0');
        rugRect(g, w, h, t, []); checker(g, 4, 4, w - 8, h - 8, 3, t[3], cream, t[2]); ring(g, 3, 3, w - 6, h - 6, cream); ring(g, 4, 4, w - 8, h - 8, t[1]);
        if (/Large/.test(n)) { g.rect(cx - 9, cy - 7, 18, 14, cream); ring(g, cx - 9, cy - 7, 18, 14, t[2]); icon(g, 'heart', cx, cy, RED[3]); }
      } else {
        const t = /Green/.test(n) ? T('#3f8a55') : T('#b03a3a');
        rugRect(g, w, h, t, [[2, GOLD[4]], [3, t[2]], [5, GOLD[3]]]);
        const big = w > 50;
        for (let k = big ? 12 : 8; k >= 0; k--) { const col = k > (big ? 9 : 6) ? GOLD[4] : k > (big ? 7 : 4) ? t[1] : k > 2 ? t[4] : GOLD[4]; g.hline(cx - k * 2, cy - ((big ? 12 : 8) - k), k * 4, col); g.hline(cx - k * 2, cy + ((big ? 12 : 8) - k), k * 4, col); }
        icon(g, 'flower', cx, cy, GOLD[5], t[1]);
        for (const [dx, dy] of [[9, 9], [w - 10, 9], [9, h - 10], [w - 10, h - 10]]) icon(g, 'diamond', dx, dy, GOLD[4]);
        if (big) for (const dx of [-22, 22]) icon(g, 'bloom', cx + dx, cy, GOLD[4], t[1]);
      }
    } else switch (n) {
      case 'Bamboo Mat': { const t = T('#d9c07a'); rugRect(g, w, h, t, [], null); for (let i = 3; i < w - 1; i += 3) g.vline(i, 2, h - 4, t[2]); for (const yy of [4, h - 5]) for (let i = 1; i < w - 1; i++) g.px(i, yy, i % 3 === 0 ? T('#4f8a3a')[2] : T('#4f8a3a')[4]); g.hline(1, 2, w - 2, t[5]); break; }
      case 'Blossom Rug': {
        const t = T('#f2a8c4'); rugRect(g, w, h, t, [[2, hex('#fff1f6')], [4, t[2]]], hex('#fff1f6'));
        for (let a = 0; a < 6; a++) g.ellipse(cx + Math.cos(a * 1.047) * 9, cy + Math.sin(a * 1.047) * 9, 6, 6, hex('#fff1f6')); for (let a = 0; a < 6; a++) g.ellipse(cx + Math.cos(a * 1.047) * 8, cy + Math.sin(a * 1.047) * 8, 4, 4, T('#f07aa8')[4]); circle(g, cx, cy, 4.5, GOLD[4]); circle(g, cx, cy, 2, GOLD[2]);
        for (const [dx, dy] of [[-32, -18], [32, -18], [-32, 18], [32, 18], [-34, 0], [34, 0], [-18, -20], [18, 20], [18, -20], [-18, 20]]) { icon(g, 'flower', cx + dx, cy + dy, hex('#fff1f6'), GOLD[4]); }
        for (const [dx, dy] of [[-25, -9], [25, 9], [-25, 9], [25, -9]]) icon(g, 'leaf', cx + dx, cy + dy, T('#6fb85a')[3], T('#6fb85a')[1]);
        break;
      }
      case 'Bone Rug': {
        const t = T('#efe6d0');
        for (const [bx, by] of [[8, 8], [8, h - 9], [w - 9, 8], [w - 9, h - 9]]) circle(g, bx + 0.5, by + 0.5, 6.5, t[1]);
        g.rect(8, 9, w - 16, h - 18, t[1]);
        for (const [bx, by] of [[8, 8], [8, h - 9], [w - 9, 8], [w - 9, h - 9]]) { circle(g, bx + 0.5, by + 0.5, 5.5, t[3]); circle(g, bx, by, 3.5, t[4]); }
        g.rect(8, 10, w - 16, h - 20, t[3]); g.rect(10, 11, w - 20, 3, t[4]); g.hline(10, h - 12, w - 20, t[2]);
        g.line(18, 15, 22, 18, t[1]); g.line(28, 13, 31, 15, t[2]); g.px(24, 20, t[2]);
        break;
      }
      case 'Burlap Rug': { const t = T('#c9a86a'); g.rect(1, 1, w - 2, h - 2, t[3]); for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) { if ((i + j) % 2 === 0) g.px(i, j, t[4]); else if (i % 4 === 1 && j % 4 === 1) g.px(i, j, t[2]); } ring(g, 1, 1, w - 2, h - 2, t[2]); for (let i = 2; i < w - 2; i += 2) { g.px(i, 0, t[3]); g.px(i + 1, h - 1, t[3]); g.px(0, i, t[3]); g.px(w - 1, i + 1, t[3]); } ring(g, 4, 4, w - 8, h - 8, T('#8a5a34')[3]); break; }
      case 'Circular Rug': rugRound(g, w, h, [[1, T('#b03a3a')[1]], [0.95, T('#b03a3a')[3]], [0.78, cream], [0.7, T('#3f6fb8')[3]], [0.45, cream], [0.38, T('#b03a3a')[3]], [0.15, GOLD[4]]]); for (let a = 0; a < 8; a++) g.px(cx - 0.5 + Math.cos(a * 0.785) * 8.5, cy - 0.5 + Math.sin(a * 0.785) * 8.5, GOLD[4]); break;
      case 'Dark Rug': { const t = m.wood; rugRect(g, w, h, t, [[2, m.cloth[3]], [4, t[2]]], m.trim[3]); for (let k = 7; k >= 0; k--) { g.hline(cx - k * 2, cy - (7 - k), k * 4, k > 5 ? m.cloth[3] : k > 3 ? t[2] : m.cloth[2]); g.hline(cx - k * 2, cy + (7 - k), k * 4, k > 5 ? m.cloth[3] : k > 3 ? t[2] : m.cloth[2]); } icon(g, 'diamond', cx, cy, m.trim[3]); for (const dx of [8, w - 9]) icon(g, 'diamond', dx, cy, m.cloth[4]); break; }
      case 'Desert Rug': { const t = m.wood; rugRect(g, w, h, t, [], cream); const cols = [m.cloth[3], m.trim[3], T('#7b4b2f')[3], m.trim[3], m.cloth[3]]; cols.forEach((col, i) => { const yy = 5 + i * 8; zig(g, 2, yy, w - 4, 4, col, 2); }); g.rect(2, 3, w - 4, 2, m.cloth[2]); g.rect(2, h - 5, w - 4, 2, m.cloth[2]); for (let i = 6; i < w - 4; i += 8) { icon(g, 'diamond', i, cy, GOLD[4]); } break; }
      case 'Fruit Salad Rug': {
        rugRect(g, w, h, T('#f4ecd0'), [[2, T('#8ac85a')[3]]], T('#f08a5a')[3]);
        const fr = (fx: number, fy: number, o: string, i2: string, r = 5) => { circle(g, fx, fy, r, hex(o)); circle(g, fx, fy, r - 1.4, hex(i2)); };
        fr(10, 10, '#e8873a', '#f9c86a'); for (let a = 0; a < 6; a++) g.line(10, 10, 10 + Math.cos(a * 1.047) * 3, 10 + Math.sin(a * 1.047) * 3, hex('#e8873a'));
        fr(24, 20, '#6a9a3a', '#b8e06a'); circle(g, 24, 20, 1.4, cream); for (let a = 0; a < 6; a++) g.px(24 + Math.cos(a * 1.047) * 2.6, 20 + Math.sin(a * 1.047) * 2.6, INK);
        fr(38, 10, '#3f8a45', '#f0506a'); for (const [dx, dy] of [[-1, -1], [2, 0], [0, 2], [-2, 1]]) g.px(38 + dx, 10 + dy, INK);
        fr(11, 23, '#f6dc5a', '#fff6a0', 4); fr(37, 23, '#8a5cc2', '#b98af0', 3.5); fr(24, 8, '#d93a4a', '#f06a7a', 3); g.px(24, 5, LEAF[3]);
        break;
      }
      case 'Funky Rug': {
        rugRect(g, w, h, T('#8a5cc2'), [], null);
        const cols = ['#f6dc5a', '#ee6ab0', '#3ac0b0', '#f08a3a'];
        for (let i = 0; i < w; i++) cols.forEach((col, k2) => { const yy = 8 + k2 * 14 + Math.round(Math.sin(i / 6 + k2 * 1.3) * 5); g.rect(i, yy, 1, 5, hex(col)); });
        for (const [bx, by, r, k2] of [[14, 14, 5, 2], [58, 20, 6, 0], [30, 46, 5, 1], [66, 50, 4, 3], [42, 28, 4, 0]]) { circle(g, bx, by, r + 1.5, hex('#fff6e0')); circle(g, bx, by, r, hex(cols[k2])); }
        ring(g, 0, 1, w, h - 2, T('#8a5cc2')[1]);
        break;
      }
      case 'Icy Rug': case 'Snowy Rug': {
        const icy = n === 'Icy Rug', t = icy ? T('#a8d8f0') : T('#f4f8fb');
        rugRect(g, w, h, t, [[2, icy ? hex('#ffffff') : T('#6fa8e0')[3]], [4, icy ? t[2] : T('#bfe1ef')[3]]], hex('#ffffff'));
        const fl = icy ? hex('#ffffff') : T('#5f90d2')[3];
        icon(g, 'flake', cx, cy, fl); for (const a of [0, 1.57, 3.14, 4.71]) { g.line(cx, cy, cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, fl); g.px(cx + Math.cos(a) * 5 + Math.sin(a) * 2, cy + Math.sin(a) * 5 + Math.cos(a) * 2, fl); g.px(cx + Math.cos(a) * 5 - Math.sin(a) * 2, cy + Math.sin(a) * 5 - Math.cos(a) * 2, fl); } for (const a of [0.785, 2.356, 3.927, 5.498]) g.line(cx, cy, cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, fl);
        for (const [dx, dy] of [[-15, -6], [15, 6], [-15, 6], [15, -6], ...(w > 50 ? [[-24, 12], [24, -12], [-24, -12], [24, 12], [0, -15], [0, 15]] : [])]) icon(g, 'flake', cx + dx, cy + dy, icy ? t[5] : T('#9fc8ee')[3]);
        break;
      }
      case 'Light Green Rug': { const t = T('#a8d88f'); rugRect(g, w, h, t, [[2, t[5]], [5, t[2]]], hex('#f4f8e0')); for (let i = 9; i < w - 8; i += 6) for (let j = 9; j < h - 8; j += 6) g.px(i + (j % 12 === 9 ? 0 : 3), j, t[5]); break; }
      case 'Modern Rug': {
        rugRect(g, w, h, T('#d8dce2'), [], null);
        g.rect(4, 4, 30, 24, T('#4b5669')[3]); g.rect(38, 4, w - 42, 12, T('#e8504a')[3]); g.rect(38, 20, 18, h - 24, T('#a9b2bf')[3]); g.rect(4, 32, 30, h - 36, hex('#f4f4f4')); g.rect(60, 20, w - 64, h - 24, T('#2c3440')[3]); g.rect(12, 38, 14, 14, T('#e9c040')[3]);
        ring(g, 0, 1, w, h - 2, T('#4b5669')[1]);
        break;
      }
      case 'Monster Rug': {
        const t = T('#7a5ab0');
        circle(g, 6, 6, 4.5, t[2]); circle(g, w - 7, 6, 4.5, t[2]); rr(g, 2, 4, w - 4, h - 6, t[1], 7); rr(g, 3, 5, w - 6, h - 8, t[3], 6); g.ellipse(cx - 3, 10, 8, 3, t[4]);
        for (const ex of [10, 21]) { circle(g, ex + 0.5, 13.5, 3.4, hex('#fff6c0')); circle(g, ex + 0.5, 14, 1.5, INK); }
        rr(g, 7, 19, 18, 8, hex('#3a1a2a'), 2); for (let i = 8; i < 24; i += 4) { g.rect(i, 19, 3, 2, hex('#ffffff')); g.px(i + 1, 21, hex('#ffffff')); } g.rect(13, 24, 6, 3, T('#e8506a')[3]);
        for (const [dx, dy] of [[5, 22], [26, 23], [15, 6]]) g.px(dx, dy, t[5]);
        break;
      }
      case 'Mystic Rug': { const t = T('#5a3f95'); rugRect(g, w, h, t, [[2, GOLD[4]], [4, t[2]]], GOLD[3]); g.ellipse(cx, cy, 11, 6.5, GOLD[4]); g.ellipse(cx, cy, 9.6, 5.2, hex('#f4f0ff')); circle(g, cx, cy, 4, T('#3aa79f')[3]); circle(g, cx, cy, 2, INK); g.px(cx - 2, cy - 2, hex('#ffffff')); for (const [dx, dy] of [[-17, -7], [17, -7], [-17, 7], [17, 7]]) icon(g, 'star5', cx + dx, cy + dy, GOLD[4]); icon(g, 'moon', cx - 17, cy, T('#b9a6d8')[4]); icon(g, 'moon', cx + 17, cy, T('#b9a6d8')[4]); break; }
      case 'Nautical Rug': { const t = T('#2c4a8a'); rugRect(g, w, h, t, [], hex('#f4f4f4')); for (let j = 3; j < h - 3; j += 4) g.rect(1, j, w - 2, 2, hex('#f4f4f4')); circle(g, cx, cy, 10, hex('#f4f4f4')); circle(g, cx, cy, 8.6, t[3]); icon(g, 'anchor', cx, cy, GOLD[4]); ring(g, 1, 1, w - 2, h - 2, T('#b03a3a')[3], 2); ring(g, 1, 1, w - 2, h - 2, t[1]); break; }
      case 'Oceanic Rug': { const t = T('#3aa0b8'); rugRect(g, w, h, t, [[2, hex('#e8fbff')]], hex('#e8fbff')); for (let j = 7; j < h - 5; j += 6) for (let i = 4; i < w - 4; i++) g.px(i, j + Math.round(Math.sin(i / 2.5 + j) * 1.4), j % 12 === 7 ? t[5] : t[2]); icon(g, 'fish', 14, 11, T('#f6a03a')[3]); icon(g, 'fish', 33, 21, T('#f6dc5a')[3]); g.px(24, 13, hex('#ffffff')); g.px(25, 11, hex('#ffffff')); icon(g, 'star5', 38, 9, T('#f08a8a')[3]); break; }
      case 'Old World Rug': {
        const t = T('#8a2f2f'); rugRect(g, w, h, t, [[2, GOLD[3]], [3, NAVY[3], 3], [6, GOLD[4]]], cream);
        for (let i = 5; i < w - 5; i += 3) { g.px(i, 5, GOLD[4]); g.px(i, h - 6, GOLD[4]); } for (let j = 5; j < h - 5; j += 3) { g.px(5, j, GOLD[4]); g.px(w - 6, j, GOLD[4]); }
        for (let k = 12; k >= 0; k--) { const col = k > 10 ? GOLD[4] : k > 8 ? NAVY[3] : k > 5 ? cream : k > 3 ? t[4] : NAVY[3]; g.hline(cx - k * 1.6, cy - (12 - k), k * 3.2, col); g.hline(cx - k * 1.6, cy + (12 - k), k * 3.2, col); }
        icon(g, 'flower', cx, cy, GOLD[5], t[1]);
        for (const [dx, dy] of [[-21, -12], [21, -12], [-21, 12], [21, 12]]) { icon(g, 'flower', cx + dx, cy + dy, cream, NAVY[3]); } for (const dx of [-22, 22]) icon(g, 'diamond', cx + dx, cy, GOLD[4]);
        break;
      }
      case 'Patchwork Rug': { rugRect(g, w, h, T('#8a5a34'), [], null); const cols = ['#c8504a', '#4f7fd6', '#e9c040', '#5fa058', '#ee8fb6', '#8a5cc2', '#e8873a', '#3aa79f']; let k2 = 0; for (let j = 2; j < h - 3; j += 7) for (let i = 2; i < w - 3; i += 11, k2++) { const t = T(cols[(k2 * 3 + (j > 10 ? 1 : 0)) % 8]); g.rect(i, j, 10, 6, t[3]); g.hline(i, j, 10, t[4]); if (k2 % 3 === 0) for (let q = 1; q < 9; q += 2) g.px(i + q, j + 3, t[5]); else if (k2 % 3 === 1) { g.px(i + 3, j + 2, t[5]); g.px(i + 6, j + 4, t[5]); g.px(i + 6, j + 2, t[1]); g.px(i + 3, j + 4, t[1]); } for (let q = 0; q < 10; q += 2) g.px(i + q, j + 6, cream); for (let q = 0; q < 6; q += 2) g.px(i + 10, j + q, cream); } break; }
      case 'Pirate Rug': { const t = T('#2f2a36'); rugRect(g, w, h, t, [[2, RED[3]]], null); icon(g, 'skull', cx, cy - 2, hex('#f1ece0')); g.line(cx - 9, cy - 6, cx + 8, cy + 7, hex('#f1ece0')); g.line(cx + 8, cy - 6, cx - 9, cy + 7, hex('#f1ece0')); icon(g, 'skull', cx, cy - 2, hex('#f1ece0')); for (let i = 3; i < w - 2; i += 5) { clearPx(g, i, 1); clearPx(g, i + 2, h - 2); } for (const dx of [8, w - 9]) icon(g, 'cross', dx, cy, GOLD[4]); break; }
      case 'Rune Rug': { const t = T('#3f3463'); rugRect(g, w, h, t, [[2, T('#6fe0b0')[3]]], null); circle(g, cx, cy, 11, T('#6fe0b0')[3]); circle(g, cx, cy, 10, t[3]); circle(g, cx, cy, 5, T('#6fe0b0')[2]); circle(g, cx, cy, 4, t[2]); icon(g, 'star5', cx, cy, T('#6fe0b0')[5]); ['rune1', 'rune2', 'rune3', 'rune4'].forEach((r, i) => icon(g, r, cx + [0, 8, 0, -8][i], cy + [-7.5, 0, 7.5, 0][i], T('#6fe0b0')[4])); break; }
      case 'Sandy Rug': { const t = T('#e6cf96'); rr(g, 1, 1, w - 2, h - 2, t[2], 5); rr(g, 2, 2, w - 4, h - 4, t[3], 5); for (let j = 8; j < h - 6; j += 7) for (let i = 5; i < w - 5; i++) g.px(i, j + Math.round(Math.sin(i / 3 + j) * 1.5), t[4]); stamp(g, cx - 5, cy - 5, ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '.#.....#.'], { '#': T('#f08a6a')[3] }); g.px(cx - 1, cy - 1, T('#f08a6a')[5]); circle(g, 10, 36, 3, hex('#fbf1e0')); g.px(10, 36, t[1]); g.line(8, 37, 12, 37, t[2]); circle(g, 38, 11, 2.5, T('#f2a8c4')[3]); for (const [dx, dy] of [[34, 34], [12, 12], [30, 8]]) g.px(dx, dy, t[1]); break; }
      case 'Starry Moon Rug': { const t = T('#27336a'); rugRect(g, w, h, t, [[2, GOLD[4]], [4, t[2]]], GOLD[3]); circle(g, cx, cy, 13, T('#f4eeb0')[4]); circle(g, cx + 6, cy - 3, 11.5, t[3]); g.px(cx - 8, cy + 2, T('#f4eeb0')[2]); g.px(cx - 6, cy + 7, T('#f4eeb0')[2]); for (let i = 0; i < 12; i++) { const sx = 9 + Math.round(hash(i, 1, 3) * (w - 18)), sy = 8 + Math.round(hash(i, 2, 3) * (h - 16)); if (Math.abs(sx - cx) > 14 || Math.abs(sy - cy) > 14) icon(g, i % 3 ? 'star5' : 'cross', sx, sy, i % 2 ? GOLD[4] : hex('#ffffff')); } icon(g, 'star', cx + 7, cy - 2, GOLD[5]); break; }
      case 'Stone Flooring': { const t = T('#9b968d'); g.rect(0, 0, w, h, t[1]); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const tone = (i * 3 + j * 5) % 3 === 0 ? 4 : 3; g.rect(i * 16 + 1, j * 16 + 1, 14, 14, t[tone]); g.hline(i * 16 + 1, j * 16 + 1, 14, t[tone + 1]); g.vline(i * 16 + 1, j * 16 + 1, 14, t[tone + 1]); g.hline(i * 16 + 1, j * 16 + 14, 14, t[2]); g.vline(i * 16 + 14, j * 16 + 1, 14, t[2]); if ((i + j * 2) % 3 === 1) { g.line(i * 16 + 4, j * 16 + 5, i * 16 + 8, j * 16 + 9, t[2]); g.px(i * 16 + 9, j * 16 + 10, t[2]); } if ((i * 2 + j) % 4 === 2) g.px(i * 16 + 10, j * 16 + 4, t[2]); } break; }
      case 'Swirl Rug': { const t = T('#3aa79f'); rugRect(g, w, h, t, [[2, cream]], cream); for (let a = 0; a < 190; a++) { const an = a * 0.12, r = a * 0.06; g.px(cx + Math.cos(an) * r * 1.5, cy + Math.sin(an) * r, cream); g.px(cx + Math.cos(an) * r * 1.5 + 1, cy + Math.sin(an) * r, cream); } for (const [dx, dy] of [[7, 7], [w - 8, 7], [7, h - 8], [w - 8, h - 8]]) icon(g, 'swirl', dx, dy, t[5]); break; }
      case 'Woodcut Rug': { const t = T('#c9a06a'), bk = T('#6b4530'); circle(g, cx, cy, 15, bk[1]); circle(g, cx, cy, 14, bk[3]); circle(g, cx, cy, 12.4, t[4]); for (const r of [10, 7.4, 5, 2.6]) { circle(g, cx + (r > 6 ? 0.5 : 0), cy, r, t[2]); circle(g, cx + (r > 6 ? 0.5 : 0), cy, r - 0.9, r % 2 > 1 ? t[3] : t[4]); } circle(g, cx, cy, 1, bk[2]); g.line(cx + 3, cy - 2, cx + 12, cy - 6, t[1]); g.px(cx - 13, cy - 4, bk[5]); g.px(cx - 12, cy - 7, bk[4]); break; }
      default: { const t = colorOf(n, '#b03a3a'); rugRect(g, w, h, t, [[2, GOLD[4]], [4, t[2]]]); icon(g, 'diamond', cx, cy, GOLD[4]); }
    }
  });
};

// ------------------------------------------------------------------ paintings (on the wall)

const X = (s: string) => hex(s);
function bands(p: Img, cols: string[], y0 = 0, y1 = p.h) {
  cols.forEach((col, i) => p.rect(0, y0 + Math.round((i * (y1 - y0)) / cols.length), p.w, Math.ceil((y1 - y0) / cols.length) + 1, X(col)));
}
function hills(p: Img, yy: number, amp: number, per: number, col: string, ph = 0) {
  for (let i = 0; i < p.w; i++) { const top = Math.round(yy + Math.sin(((i + ph) / per) * 6.283) * amp); p.vline(i, top, p.h - top, X(col)); }
}
function mount(p: Img, cx: number, top: number, half: number, col: string, cap?: string, bot = p.h) {
  for (let j = top; j < bot; j++) { const k = ((j - top) / (bot - top)) * half; p.hline(Math.round(cx - k), j, Math.round(2 * k) + 1, X(col)); if (cap && j < top + 3) p.hline(Math.round(cx - k), j, Math.round(2 * k) + 1, X(cap)); }
}
function stars(p: Img, n: number, seed: number, yMax = p.h) {
  for (let i = 0; i < n; i++) p.px(Math.floor(hash(i, 1, seed) * p.w), Math.floor(hash(i, 2, seed) * yMax), X(i % 3 ? '#ffffff' : '#ffe9a0'));
}
function treeS(p: Img, cx: number, by: number, r: number, leaf = '#3f9a3c', tr = '#6b4530') {
  p.rect(cx, by - r - 1, r > 3 ? 2 : 1, r + 2, X(tr));
  const t = tones(leaf);
  p.ellipse(cx + 0.5, by - r * 1.9, r, r, t[2]); p.ellipse(cx, by - r * 2.1, r * 0.75, r * 0.7, t[3]); p.px(Math.round(cx - r * 0.3), Math.round(by - r * 2.4), t[5]);
}
function cloud(p: Img, cx: number, cy: number, r: number, col = '#ffffff') {
  p.ellipse(cx, cy, r, r * 0.45, X(col)); p.ellipse(cx - r * 0.35, cy - r * 0.3, r * 0.5, r * 0.4, X(col)); p.ellipse(cx + r * 0.3, cy - r * 0.4, r * 0.42, r * 0.38, X(col));
}
function sunD(p: Img, cx: number, cy: number, r: number, col: string, rays = 0, rcol = col) {
  for (let a = 0; a < rays; a++) p.line(cx, cy, cx + Math.cos((a * 6.283) / rays) * r * 2.1, cy + Math.sin((a * 6.283) / rays) * r * 2.1, X(rcol));
  p.ellipse(cx, cy, r + (rays ? 1 : 0), r + (rays ? 1 : 0), X(rays ? rcol : col)); p.ellipse(cx, cy, r, r, X(col));
}
function house(p: Img, x0: number, by: number, hw: number, hh: number, wall: string, roof: string) {
  p.rect(x0, by - hh, hw, hh, X(wall));
  for (let j = 0; j < Math.ceil(hw / 2) + 1; j++) p.hline(x0 - 1 + j, by - hh - j, hw + 2 - 2 * j, X(roof));
  p.rect(x0 + Math.floor(hw / 2) - 1, by - 3, 2, 3, X('#5b3b2e')); if (hw > 6) p.px(x0 + 1, by - hh + 1, X('#fff0a0'));
}
type Bust = { bg: string; skin?: string; hair: string; shirt: string; style: string; glasses?: boolean; beard?: boolean; extra?: (p: Img, cx: number) => void };
function bust(p: Img, o: Bust) {
  const cx = Math.floor(p.w / 2), sk = tones(o.skin ?? '#f2c49a'), hr = tones(o.hair), st = tones(o.shirt);
  p.rect(0, 0, p.w, p.h, X(o.bg)); for (let i = 0; i < p.w; i++) if (i % 2) p.px(i, (i * 3) % 5, tones(o.bg)[4]);
  if (o.style === 'long' || o.style === 'braid') { p.rect(cx - 6, 5, 12, 11, hr[2]); }
  rr(p, cx - 7, p.h - 6, 14, 7, st[3], 2); p.hline(cx - 5, p.h - 6, 10, st[4]); p.rect(cx - 2, p.h - 8, 4, 3, sk[2]); p.px(cx - 1, p.h - 6, sk[3]); p.px(cx, p.h - 6, sk[3]);
  rr(p, cx - 4, 4, 8, 9, sk[3], 2); p.vline(cx + 3, 6, 5, sk[2]);
  p.px(cx - 2, 8, INK); p.px(cx + 1, 8, INK); p.hline(cx - 1, 11, 2, sk[1]);
  // hair
  rr(p, cx - 5, 2, 10, 4, hr[3], 1); p.hline(cx - 3, 2, 5, hr[4]);
  if (o.style === 'short') { p.vline(cx - 5, 5, 3, hr[3]); p.vline(cx + 4, 5, 3, hr[2]); }
  else if (o.style === 'spiky') { for (const dx of [-4, -2, 0, 2, 4]) { p.px(cx + dx, 1, hr[4]); p.px(cx + dx, 0, hr[3]); } p.vline(cx - 5, 5, 2, hr[3]); p.vline(cx + 4, 5, 2, hr[2]); }
  else if (o.style === 'bun') { p.ellipse(cx, 1.5, 2.5, 2, hr[3]); p.vline(cx - 5, 5, 4, hr[3]); p.vline(cx + 4, 5, 4, hr[2]); }
  else if (o.style === 'braid') { p.vline(cx - 5, 5, 6, hr[3]); p.vline(cx + 4, 5, 5, hr[2]); for (let j = 10; j < 17; j++) p.px(cx + 5 + (j % 2), j, hr[j % 2 ? 3 : 4]); p.rect(cx - 6, 8, 2, 8, X(o.bg)); }
  else if (o.style === 'long') { p.rect(cx - 6, 4, 2, 11, hr[3]); p.rect(cx + 4, 4, 2, 11, hr[2]); p.px(cx - 4, 6, hr[3]); }
  else if (o.style === 'side') { p.rect(cx - 5, 5, 3, 3, hr[3]); p.vline(cx - 5, 5, 5, hr[3]); p.vline(cx + 4, 5, 2, hr[2]); p.px(cx - 2, 6, hr[3]); }
  if (o.glasses) { p.rect(cx - 3, 7, 3, 3, X('#3a3440')); p.rect(cx, 7, 3, 3, X('#3a3440')); p.px(cx - 2, 8, X('#cfe6f2')); p.px(cx + 1, 8, X('#cfe6f2')); }
  if (o.beard) { p.hline(cx - 2, 10, 4, hr[2]); p.px(cx - 3, 11, hr[2]); p.px(cx + 2, 11, hr[2]); }
  o.extra?.(p, cx);
}
type Scene = (p: Img, W: number, H: number) => void;
/** [frame style, scene]. Frame: w wood, g gold, d dark, l light, n none (poster or sign). */
const PAINT: Record<string, [string, Scene]> = {
  "'Volcano' Photo": ['l', (p, W, H) => { bands(p, ['#5a4a6a', '#a8604a', '#e8a05a']); mount(p, W / 2, 5, W * 0.55, '#3a2a30'); p.rect(W / 2 - 2, 5, 5, 2, X('#f9843c')); p.line(W / 2, 6, W / 2 - 4, 14, X('#f9603c')); p.line(W / 2 + 1, 6, W / 2 + 5, 12, X('#f9a03c')); cloud(p, W / 2 + 1, 2, 5, '#6a5a6a'); p.px(W / 2 - 3, 2, X('#f9c23c')); }],
  '1000 Years From Now': ['d', (p, W, H) => { bands(p, ['#3a2a5a', '#6a3a7a', '#c85a7a']); for (const [x0, hh, wd] of [[2, 12, 4], [8, 16, 5], [15, 10, 3], [19, 14, 4]]) { p.rect(x0, H - hh, wd, hh, X('#2a2a3a')); p.px(x0 + 1, H - hh + 2, X('#6fe0b0')); p.rect(x0, H - hh, wd, 1, X('#4fa651')); p.px(x0 + wd - 1, H - hh + 4, X('#4fa651')); } hills(p, H - 3, 1, 9, '#2f6a3a'); sunD(p, W - 5, 4, 2, '#f6dc9a'); }],
  'A Night On Eco-Hill': ['w', (p, W, H) => { bands(p, ['#1f2a5a', '#2c3a7e', '#3f4a9a']); stars(p, 10, 3, H - 8); sunD(p, 5, 4, 2, '#f4eeb0'); hills(p, H - 5, 3, W * 1.6, '#2f7a45', W * 0.9); treeS(p, W - 7, H - 6, 3, '#2f8a4a'); p.px(8, H - 5, X('#f6dc5a')); p.px(12, H - 3, X('#f6dc5a')); }],
  'Abstract': ['d', (p, W, H) => { p.rect(0, 0, W, H, X('#f1ece0')); p.rect(2, 2, 9, 7, X('#cf463f')); p.rect(13, 5, 8, 12, X('#3f6fd2')); p.ellipse(8, 14, 4, 4, X('#e9c040')); p.line(0, H - 3, W, 3, INK); p.line(16, 0, 20, H, INK); }],
  'Art Photo': ['d', (p, W, H) => { bands(p, ['#c8c8c8', '#a8a8a8', '#6a6a6a']); treeS(p, W / 2 - 1, H - 3, 3, '#4a4a4a', '#2a2a2a'); p.hline(0, H - 3, W, X('#3a3a3a')); sunD(p, W - 3, 4, 1.5, '#f4f4f4'); }],
  'Art Photo 2': ['d', (p, W, H) => { bands(p, ['#e0d8c8', '#c8bca8']); p.rect(2, 6, 6, H - 6, X('#5a5248')); for (let j = 8; j < H - 2; j += 3) { p.px(3, j, X('#e0d8c8')); p.px(6, j, X('#e0d8c8')); } p.rect(8, 12, 2, H - 12, X('#7a7268')); }],
  'Binary': ['n', (p, W, H) => { p.rect(0, 0, W, H, X('#101a14')); for (let j = 2; j < H - 1; j += 4) for (let i = 1; i < W - 1; i += 3) { if (hash(i, j, 2) < 0.5) p.vline(i, j, 3, X('#4fe07a')); else { p.rect(i, j, 2, 3, X('#2fa050')); p.px(i, j + 1, X('#101a14')); } } }],
  'Blue City': ['d', (p, W, H) => { bands(p, ['#1f3a7a', '#3f6ab8', '#7fb0e8']); for (const [x0, hh] of [[0, 9], [3, 15], [6, 11], [8, 18]]) { p.rect(x0, H - hh, 3, hh, X('#16244a')); for (let j = H - hh + 2; j < H - 1; j += 3) p.px(x0 + 1, j, X('#fff0a0')); } sunD(p, 2, 3, 1.5, '#f4f4f4'); }],
  'Blueberries': ['w', (p, W, H) => { p.rect(0, 0, W, H, X('#f1e6c8')); p.rect(0, H - 5, W, 5, X('#b07a45')); p.ellipse(W / 2, H - 6, 8, 4, X('#e9e3d6')); p.ellipse(W / 2, H - 5, 7, 2.5, X('#c9c2b0')); for (const [dx, dy] of [[-5, -9], [-1, -10], [3, -9], [-3, -12], [1, -13], [5, -11], [-6, -6], [6, -7]]) { p.ellipse(W / 2 + dx + 0.5, H + dy + 0.5, 2, 2, X('#3f4fb0')); p.px(W / 2 + dx, H + dy - 1, X('#8f9af0')); } p.px(W / 2 + 2, H - 15, X('#4fa651')); p.px(W / 2 + 3, H - 16, X('#4fa651')); }],
  'Boarded Window': ['w', (p, W, H) => { bands(p, ['#2a3a5a', '#3a4a6a']); p.vline(W / 2, 0, H, X('#5b3b2e')); for (const [y0, sl] of [[2, 1], [8, -1], [14, 1]]) for (let i = 0; i < W; i++) { const yy = y0 + Math.round((i / W) * 2 * sl); p.vline(i, yy, 4, X('#b08a5a')); p.px(i, yy, X('#d0aa7a')); p.px(i, yy + 3, X('#7a5a3a')); } for (const [nx, ny] of [[2, 3], [W - 3, 5], [2, 10], [W - 3, 9], [2, 16], [W - 3, 18]]) p.px(nx, ny, X('#3a3440')); }],
  'Boat': ['w', (p, W, H) => { bands(p, ['#8fd0f0', '#bfe6f8']); p.rect(0, H - 7, W, 7, X('#3f8ac0')); for (let i = 0; i < W; i += 4) p.hline(i, H - 5 + (i % 8 ? 0 : 2), 2, X('#9fd0f0')); p.rect(W / 2 - 5, H - 9, 11, 3, X('#8a5a34')); p.px(W / 2 - 5, H - 7, X('#3f8ac0')); p.px(W / 2 + 5, H - 7, X('#3f8ac0')); p.vline(W / 2, 3, H - 12, X('#5b3b2e')); for (let j = 0; j < 7; j++) { p.hline(W / 2 + 1, 4 + j, j + 1, X('#ffffff')); p.hline(W / 2 - 1 - Math.floor(j / 2), 5 + j, Math.floor(j / 2) + 1, X('#f1e6c8')); } p.px(W / 2, 2, X('#cf463f')); cloud(p, 5, 4, 3); }],
  'Bulletin Board': ['w', (p, W, H) => { p.rect(0, 0, W, H, X('#c99a5a')); for (let j = 0; j < H; j += 2) for (let i = (j % 4) / 2; i < W; i += 3) p.px(i, j, X('#b88848')); const notes: [number, number, number, number, string][] = [[2, 2, 9, 7, '#fff6c0'], [13, 3, 8, 10, '#ffffff'], [23, 1, 7, 6, '#bfe1ef'], [32, 3, 6, 8, '#f2a8c4'], [4, 11, 7, 7, '#ffffff'], [23, 9, 8, 9, '#fff6c0'], [33, 12, 6, 6, '#b8e06a']]; notes.forEach(([x0, y0, nw, nh, col], i) => { p.rect(x0, y0, nw, nh, X(col)); for (let j = y0 + 2; j < y0 + nh - 1; j += 2) p.hline(x0 + 1, j, nw - 2 - (j % 3), X('#8a8a8a')); p.px(x0 + Math.floor(nw / 2), y0, X(['#cf463f', '#3f6fd2', '#4fa651'][i % 3])); }); }],
  'Burnt Offering': ['d', (p, W, H) => { bands(p, ['#1a1014', '#3a1a1a', '#5a2a1a']); p.ellipse(W / 2, H - 4, 7, 3, X('#6a6a70')); p.ellipse(W / 2, H - 5, 6, 2, X('#2a2024')); flame(p, 'l', W / 2, H - 5); p.px(4, 5, X('#f9843c')); p.px(W - 5, 8, X('#f9c23c')); p.px(7, 10, X('#f9c23c')); }],
  'Calendar': ['n', (p, W, H) => { p.rect(0, 0, W, H, X('#fbf7ee')); p.rect(0, 0, W, 7, X('#cf463f')); p.rect(2, 2, W - 4, 3, X('#fbf7ee')); p.hline(3, 3, W - 6, X('#cf463f')); for (let j = 9; j < H - 2; j += 3) for (let i = 1; i < W - 1; i += 2) p.px(i, j, X((i + j) % 7 === 0 ? '#cf463f' : '#5a5a6a')); p.rect(5, 14, 3, 3, X('#f6dc5a')); p.px(2, 0, X('#3a3440')); p.px(W - 3, 0, X('#3a3440')); }],
  'Calico Falls': ['w', (p, W, H) => { bands(p, ['#f6c86a', '#f6a04a']); p.rect(0, 5, W, H - 5, X('#b0603a')); p.rect(0, 5, W, 2, X('#d98a5a')); for (let j = 8; j < H; j += 4) p.hline(0, j, W, X('#8a4a2a')); p.rect(W / 2 - 3, 5, 6, H - 8, X('#9fd8f0')); p.vline(W / 2 - 2, 5, H - 8, X('#ffffff')); p.vline(W / 2 + 1, 6, H - 9, X('#6fb8e0')); p.rect(0, H - 4, W, 4, X('#3f9ac0')); p.ellipse(W / 2, H - 4, 5, 1.5, X('#ffffff')); p.rect(3, 2, 2, 4, X('#4f9a55')); p.px(2, 3, X('#4f9a55')); }],
  'Checkers': ['w', (p, W, H) => { checker(p, 0, 0, W, H, 2, X('#b03a3a'), X('#2a2430')); p.ellipse(3, 5, 1.2, 1.2, X('#f1ece0')); p.ellipse(7, 11, 1.2, 1.2, X('#f1ece0')); p.ellipse(5, 17, 1.2, 1.2, X('#e9c040')); }],
  'Clouds': ['l', (p, W, H) => { bands(p, ['#5fa8e8', '#8fc8f4', '#bfe1f8']); cloud(p, 7, 6, 6); cloud(p, 17, 12, 7); cloud(p, 6, 17, 4, '#f1f6fb'); }],
  'Colorful Set': ['n', (p, W, H) => { ['#e8504a', '#f6dc5a', '#4f9ae0'].forEach((col, i) => { const y0 = i * 9; p.rect(1, y0, W - 2, 8, X('#5b3b2e')); p.rect(2, y0 + 1, W - 4, 6, X(col)); p.ellipse(W / 2, y0 + 4, 2, 2, tones(col)[5]); }); }],
  'Community Center': ['w', (p, W, H) => { bands(p, ['#8fd0f0', '#cfeaf8']); hills(p, H - 4, 1, 30, '#5fb04a'); cloud(p, 8, 4, 4); cloud(p, W - 9, 6, 5); p.rect(12, H - 12, W - 24, 10, X('#d9a86a')); for (let j = 0; j < 5; j++) p.hline(10 + j * 2, H - 13 - j, W - 20 - j * 4, X('#8a4a3a')); p.rect(W / 2 - 4, H - 19, 8, 8, X('#d9a86a')); for (let j = 0; j < 4; j++) p.hline(W / 2 - 5 + j, H - 20 - j, 10 - 2 * j, X('#8a4a3a')); p.ellipse(W / 2, H - 15, 2, 2, X('#fbf7ee')); p.px(W / 2, H - 16, INK); p.rect(W / 2 - 2, H - 7, 4, 5, X('#5b3b2e')); for (const dx of [-14, -9, 8, 13]) p.rect(W / 2 + dx, H - 9, 2, 3, X('#fff0a0')); treeS(p, 5, H - 3, 3); treeS(p, W - 6, H - 3, 3, '#2f8a4a'); }],
  'Dancing Grass': ['w', (p, W, H) => { bands(p, ['#f6dc8a', '#f6c86a']); for (let i = 1; i < W; i += 2) { const hh = 6 + Math.round(hash(i, 1, 4) * 8); for (let j = 0; j < hh; j++) p.px(i + Math.round(Math.sin(j / 3 + i) * 1.5), H - 1 - j, X(i % 4 === 1 ? '#3f9a3c' : '#5fb84a')); } sunD(p, W - 5, 4, 2, '#fff6c0'); }],
  'Foliage Print': ['l', (p, W, H) => { p.rect(0, 0, W, H, X('#f4eed8')); for (const [x0, y0, dx, dy] of [[3, H - 2, 6, -12], [W - 3, H - 3, -7, -9], [W / 2, H - 1, 1, -16], [2, 6, 7, 3]]) frond(p, x0, y0, dx, dy, 0, tones(dx > 0 ? '#3f8a45' : '#6fae4a'), 3); p.ellipse(W - 6, 5, 3, 2, X('#8a9a3a')); }],
  'Frozen Dreams': ['l', (p, W, H) => { bands(p, ['#2c3a7e', '#4f6ab8', '#8fb0e0']); for (let i = 0; i < W; i++) p.px(i, 3 + Math.round(Math.sin(i / 3) * 2), X('#6fe0b0')); for (let i = 0; i < W; i += 2) p.px(i, 5 + Math.round(Math.sin(i / 3) * 2), X('#b98af0')); mount(p, 7, 7, 8, '#9fc0e0', '#ffffff'); mount(p, 17, 9, 8, '#7fa0d0', '#ffffff'); p.rect(0, H - 3, W, 3, X('#f4f8fb')); stars(p, 4, 9, 4); }],
  'Groovy': ['n', (p, W, H) => { const cols = ['#e2853c', '#ee6ab0', '#f6dc5a', '#3aa79f', '#8a5cc2']; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const d = Math.sqrt((i - W / 2) ** 2 + (j - H / 2) ** 2) + Math.sin(i / 3) * 2; p.px(i, j, X(cols[Math.abs(Math.floor(d / 2.5)) % 5])); } }],
  'Highway 89': ['w', (p, W, H) => { bands(p, ['#f6a04a', '#f6c86a'], 0, 9); p.rect(0, 9, W, H - 9, X('#d9a86a')); mount(p, 5, 5, 5, '#b0603a', undefined, 9); mount(p, W - 5, 6, 4, '#a85a3a', undefined, 9); for (let j = 9; j < H; j++) { const k = (j - 9) / (H - 9) * 7 + 1; p.hline(W / 2 - k, j, 2 * k, X('#4a4650')); if (j % 3) p.px(W / 2, j, X('#f6dc5a')); } p.vline(W - 4, 10, 6, X('#8a8a90')); p.rect(W - 6, 9, 5, 4, X('#f4f4f4')); p.rect(W - 5, 10, 3, 2, X('#3f6fd2')); p.rect(3, 12, 2, 4, X('#4f9a55')); p.px(2, 13, X('#4f9a55')); }],
  'Hut': ['w', (p, W, H) => { bands(p, ['#8fd0f0', '#cfeaf8'], 0, H - 6); p.rect(0, H - 6, W, 6, X('#5fb04a')); house(p, 2, H - 4, 6, 6, '#c99a5a', '#d9c07a'); p.px(1, H - 9, X('#b09a4a')); p.px(8, H - 9, X('#b09a4a')); sunD(p, W - 3, 3, 1.5, '#fff0a0'); p.px(3, H - 2, X('#f6dc5a')); }],
  'It Howls In The Rain': ['n', (p, W, H) => { bands(p, ['#1f2a4a', '#2c3a5a', '#3a4a6a']); sunD(p, W - 3, 4, 2.4, '#e8ecf4'); hills(p, H - 6, 1, 12, '#101824'); stamp(p, 1, H - 13, ['....#.', '...##.', '..###.', '.####.', '.###..', '####..', '####..', '#.#...'], { '#': '#0a1018' }); for (let i = 0; i < 10; i++) { const rx = Math.floor(hash(i, 1, 5) * W), ry = Math.floor(hash(i, 2, 5) * (H - 6)); p.px(rx, ry, X('#8fb0e0')); p.px(rx - 1, ry + 1, X('#8fb0e0')); } p.hline(1, H - 2, W - 2, X('#cf463f')); }],
  'J Sign': ['n', (p, W, H) => { rr(p, 0, 1, W, H - 2, X('#f4f4f4'), 2); rr(p, 1, 2, W - 2, H - 4, X('#3f6fd2'), 2); p.rect(W / 2 - 4, 4, 9, 3, X('#f4f4f4')); p.rect(W / 2, 4, 4, 14, X('#f4f4f4')); p.rect(W / 2 - 5, 15, 8, 3, X('#f4f4f4')); p.rect(W / 2 - 5, 12, 3, 4, X('#f4f4f4')); p.px(2, 3, X('#9fc0f8')); }],
  'J. Painting': ['l', (p, W, H) => { bands(p, ['#3f6fd2', '#5f8fe8', '#cf463f']); p.ellipse(W / 2, 8, 4, 4, X('#f4f4f4')); icon(p, 'joja', W / 2, 8, X('#3f6fd2')); p.hline(1, 15, W - 2, X('#f4f4f4')); p.hline(1, 17, W - 2, X('#f4f4f4')); }],
  'Jade Hills': ['w', (p, W, H) => { bands(p, ['#cfe8d8', '#e8f4e0']); hills(p, 8, 3, W * 0.8, '#8fc0a0', 4); hills(p, 12, 3, W * 0.6, '#5fa078', 9); hills(p, 16, 2, W * 0.9, '#3f8058', 2); p.hline(0, 11, W, X('#e8f4e8')); sunD(p, W - 5, 4, 2, '#fff6c0'); }],
  'Jade Hills Extended': ['w', (p, W, H) => { bands(p, ['#cfe8d8', '#e8f4e0']); hills(p, 8, 3, 22, '#8fc0a0', 4); hills(p, 12, 3, 16, '#5fa078', 9); hills(p, 16, 2, 26, '#3f8058', 2); for (let i = 0; i < W; i += 3) p.hline(i, 11, 2, X('#e8f4e8')); sunD(p, W - 8, 4, 2.4, '#fff6c0'); treeS(p, 10, H - 2, 2, '#2f6a45'); treeS(p, 36, H - 3, 2, '#2f6a45'); p.px(22, 4, X('#5a6a6a')); p.px(23, 3, X('#5a6a6a')); p.px(24, 4, X('#5a6a6a')); }],
  'Joja Cola Painting': ['l', (p, W, H) => { checker(p, 0, 0, W, H, 12, X('#f6dc5a'), X('#ee6ab0')); for (const cx of [6, 18]) { p.rect(cx - 3, 3, 6, 14, X('#3f6fd2')); p.rect(cx - 3, 3, 6, 2, X('#c3ccd6')); p.rect(cx - 3, 15, 6, 2, X('#c3ccd6')); p.rect(cx - 3, 8, 6, 4, X('#cf463f')); p.vline(cx - 3, 5, 10, X('#7f9ff2')); p.px(cx, 10, X('#ffffff')); p.px(cx - 1, 9, X('#ffffff')); } }],
  'Joja HQ Painting': ['d', (p, W, H) => { bands(p, ['#5f8fe8', '#9fc0f8', '#cfe0f8']); p.rect(W / 2 - 5, 3, 10, H - 3, X('#3f6fd2')); p.vline(W / 2 - 5, 3, H - 3, X('#7f9ff2')); for (let j = 5; j < H - 2; j += 3) for (let i = -3; i < 4; i += 2) p.px(W / 2 + i, j, X('#cfe8ff')); p.rect(W / 2 - 3, 1, 6, 3, X('#f4f4f4')); p.px(W / 2, 2, X('#cf463f')); p.rect(0, H - 2, W, 2, X('#6a7a8a')); p.rect(2, H - 7, 4, 5, X('#5a6a8a')); p.rect(W - 6, H - 9, 4, 7, X('#5a6a8a')); cloud(p, 4, 5, 3); }],
  'Journey Of The Prairie King: The Motion Picture': ['n', (p, W, H) => { bands(p, ['#f6a04a', '#f6c86a', '#d9a86a']); sunD(p, W / 2, 6, 3, '#fff0a0'); p.rect(0, H - 5, W, 5, X('#b07a45')); stamp(p, 1, H - 13, ['..####..', '.######.', '########', '..oooo..', '..oooo..', '.rrrrrr.', '.bbbbbb.', '.bbbbbb.', '.b....b.'], { '#': '#6b4530', o: '#f2c49a', r: '#cf463f', b: '#3f5a9a' }); p.rect(0, 0, W, 2, X('#8a2f2f')); p.hline(1, H - 2, W - 2, X('#fff0a0')); }],
  "Kitemaster '95": ['l', (p, W, H) => { bands(p, ['#5fa8e8', '#9fd0f4']); cloud(p, 5, 15, 4); for (let k = 0; k < 5; k++) { p.hline(15 - k, 3 + k, 2 * k + 1, X(k < 3 ? '#e8504a' : '#f6dc5a')); p.hline(15 - (4 - k), 8 + k, 2 * (4 - k) + 1, X('#f6dc5a')); } p.vline(15, 3, 10, X('#8a2f2f')); for (let j = 0; j < 7; j++) { p.px(14 - j + Math.round(Math.sin(j) * 1), 13 + j, X(j % 2 ? '#e8504a' : '#ffffff')); } hills(p, H - 2, 1, 14, '#5fb04a'); }],
  'Land Of Clay': ['w', (p, W, H) => { bands(p, ['#f6c86a', '#f6dc9a'], 0, 10); p.rect(0, 10, W, H - 10, X('#c8703a')); p.rect(2, 5, 7, 6, X('#b0603a')); p.rect(2, 5, 7, 1, X('#d98a5a')); p.rect(13, 3, 9, 8, X('#a8502a')); p.rect(13, 3, 9, 1, X('#d98a5a')); p.vline(21, 4, 7, X('#7a3a1a')); for (let j = 12; j < H; j += 3) p.hline(0, j, W, X('#a8502a')); p.ellipse(8, 15, 2, 3, X('#8a3a1a')); p.rect(7, 12, 2, 1, X('#8a3a1a')); }],
  'Little Buddies': ['l', (p, W, H) => { bands(p, ['#bfe6f8', '#e8f6fb'], 0, H - 5); p.rect(0, H - 5, W, 5, X('#6fb85a')); [['#e8504a', 7], ['#6fc0f0', 20], ['#f6dc5a', 33]].forEach(([col, cx]) => { const t = tones(col as string); rr(p, (cx as number) - 4, H - 12, 8, 9, t[3], 3); p.hline((cx as number) - 2, H - 12, 4, t[4]); p.px((cx as number) - 2, H - 8, INK); p.px((cx as number) + 1, H - 8, INK); p.px(cx as number, H - 13, X('#4fa651')); p.px((cx as number) + 1, H - 14, X('#4fa651')); p.px((cx as number) - 3, H - 3, t[2]); p.px((cx as number) + 2, H - 3, t[2]); }); }],
  'Little Photos': ['n', (p, W, H) => { [['#8fd0f0', '#5fb04a'], ['#f6a04a', '#3f8ac0'], ['#2c3a7e', '#f4eeb0']].forEach(([a, b2], i) => { const y0 = i * 9; p.rect(0, y0, W, 8, X('#f4f4f4')); p.rect(1, y0 + 1, W - 2, 5, X(a)); p.rect(1, y0 + 4, W - 2, 2, X(b2)); p.px(i === 2 ? 3 : W - 3, y0 + 2, X(i === 2 ? '#f4eeb0' : '#fff0a0')); }); }],
  'Little Tree': ['w', (p, W, H) => { bands(p, ['#bfe6f8', '#e8f6fb']); hills(p, H - 5, 2, W * 1.4, '#6fb85a', W * 0.8); treeS(p, W / 2 - 1, H - 5, 3); p.px(5, H - 3, X('#f6dc5a')); p.px(W - 6, H - 2, X('#ee8fb6')); }],
  'Manager of the Year': ['g', (p, W, H) => { bust(p, { bg: '#e8ecf4', hair: '#5a4a3a', shirt: '#3f6fd2', style: 'side', extra: (p, cx) => { p.rect(cx - 1, p.h - 5, 2, 5, X('#cf463f')); icon(p, 'star5', p.w - 4, 4, GOLD[4]); } }); }],
  'Monster Danger': ['n', (p, W, H) => { for (let j = 0; j < H; j++) { const k = (j / H) * (W / 2); p.hline(W / 2 - k, j, 2 * k, X('#2a2430')); if (j > 2) p.hline(W / 2 - k + 2, j, Math.max(0, 2 * k - 4), X('#f6dc5a')); } p.rect(1, H - 2, W - 2, 2, X('#2a2430')); stamp(p, W / 2 - 4, 8, ['#......#', '##....##', '########', '#o####o#', '########', '#.#..#.#', '########'], { '#': '#2a2430', o: '#f6dc5a' }); }],
  'My First Painting': ['l', (p, W, H) => { p.rect(0, 0, W, H, X('#fbf7ee')); for (let i = 0; i < W; i++) p.px(i, H - 4 + (i % 3 === 0 ? 1 : 0), X('#5fb84a')); house(p, 4, H - 4, 7, 5, '#f2a8c4', '#cf463f'); sunD(p, W - 5, 4, 2, '#f6dc5a', 8, '#f6a03a'); p.vline(17, H - 9, 5, X('#8a5a34')); p.ellipse(17.5, H - 10, 2.5, 2.5, X('#4fa651')); p.px(2, 3, X('#4f7fd6')); p.px(3, 2, X('#4f7fd6')); p.px(4, 3, X('#4f7fd6')); }],
  'Mysterium': ['n', (p, W, H) => { bands(p, ['#2a1a4a', '#4a2a7a', '#2a1a4a']); p.ellipse(W / 2, 8, 4, 2.6, X('#f4f0ff')); p.ellipse(W / 2, 8, 1.6, 1.6, X('#3aa79f')); p.px(W / 2, 8, INK); for (const [dx, dy] of [[1, 2], [W - 2, 3], [2, 13], [W - 3, 15]]) p.px(dx, dy, X('#f6dc5a')); p.rect(W / 2 - 1, 13, 3, 1, X('#b98af0')); p.px(W / 2 + 1, 14, X('#b98af0')); p.px(W / 2, 15, X('#b98af0')); p.px(W / 2, 17, X('#b98af0')); p.hline(1, H - 2, W - 2, X('#f6dc5a')); }],
  'Natural Wonders: Exploring Our Vibrant World': ['n', (p, W, H) => { bands(p, ['#5fa8e8', '#9fd0f4']); mount(p, W / 2, 3, 6, '#7a8a9a', '#ffffff', H - 5); p.vline(W / 2, 7, H - 11, X('#cfeaff')); p.rect(0, H - 6, W, 6, X('#3f9a3c')); p.rect(W / 2 - 1, H - 6, 3, 3, X('#6fc0f0')); treeS(p, 1, H - 3, 2, '#2f7a45'); treeS(p, W - 3, H - 3, 2, '#2f7a45'); p.hline(1, H - 2, W - 2, X('#fff0a0')); }],
  'Needlepoint Flower': ['n', (p, W, H) => { p.ellipse(W / 2, H / 2, W / 2, H / 2 - 3, X('#b07a45')); p.ellipse(W / 2, H / 2, W / 2 - 1, H / 2 - 4, X('#f4eed8')); p.rect(W / 2 - 1, 2, 2, 2, X('#8a8a90')); p.vline(W / 2, H / 2, 6, X('#4fa651')); p.px(W / 2 + 1, H / 2 + 3, X('#4fa651')); p.px(W / 2 - 1, H / 2 + 4, X('#4fa651')); for (let a = 0; a < 6; a++) p.px(W / 2 + Math.cos(a * 1.047) * 2.2, H / 2 - 2 + Math.sin(a * 1.047) * 2.2, X('#e8506a')); p.px(W / 2, H / 2 - 2, X('#f6dc5a')); for (let a = 0; a < 12; a += 2) p.px(W / 2 - 0.5 + Math.cos(a * 0.524) * (W / 2 - 2), H / 2 - 0.5 + Math.sin(a * 0.524) * (H / 2 - 5), X('#6fa0d2')); }],
  'Pathways': ['w', (p, W, H) => { bands(p, ['#8fd0f0', '#cfeaf8'], 0, 7); p.rect(0, 7, W, H - 7, X('#5fb04a')); hills(p, 7, 1, 12, '#5fb04a'); for (let j = 8; j < H; j++) { const cx = W / 2 + Math.sin(j / 2.5) * 5, k = 1 + (j - 8) / 5; p.hline(cx - k, j, 2 * k, X('#d9b87a')); } treeS(p, 4, 10, 2, '#2f8a4a'); treeS(p, W - 5, 12, 2, '#2f8a4a'); p.px(6, 15, X('#f6dc5a')); p.px(W - 4, 17, X('#ee8fb6')); }],
  'Periodic Table': ['n', (p, W, H) => { p.rect(0, 0, W, H, X('#fbf7ee')); p.hline(2, 2, 10, X('#3a3440')); const cols = ['#e8504a', '#f6a03a', '#f6dc5a', '#6fb85a', '#6fc0f0', '#b98af0']; for (let j = 0; j < 5; j++) for (let i = 0; i < 9; i++) { if (j < 2 && i > 1 && i < 6) continue; p.rect(1 + i * 2.5, 5 + j * 3, 2, 2, X(cols[(i < 2 ? 0 : i < 6 ? 2 : 4) + (j % 2)])); } }],
  'Physics 101': ['w', (p, W, H) => { p.rect(0, 0, W, H, X('#2f4a3a')); p.ellipse(8, 9, 6, 2.5, X('#e8f4e8')); p.ellipse(8, 9, 5, 1.6, X('#2f4a3a')); for (let a = 0; a < 20; a++) { p.px(8 + Math.cos(a * 0.314) * 3 + Math.sin(a * 0.314) * 2, 9 + Math.sin(a * 0.314) * 5, X('#e8f4e8')); } p.ellipse(8.5, 9.5, 1.4, 1.4, X('#f6dc5a')); p.hline(15, 4, 7, X('#e8f4e8')); p.hline(15, 7, 5, X('#e8f4e8')); p.line(15, 16, 22, 10, X('#f2a8c4')); p.hline(15, 16, 8, X('#e8f4e8')); p.vline(15, 10, 7, X('#e8f4e8')); p.rect(0, H - 1, W, 1, X('#b07a45')); }],
  'Pickle Jar Beauty': ['g', (p, W, H) => { bands(p, ['#5a3a4a', '#7a4a5a']); p.rect(0, H - 4, W, 4, X('#b07a45')); rr(p, W / 2 - 5, 5, 10, 12, X('#b8e0c0'), 2); p.rect(W / 2 - 4, 3, 8, 3, X('#c3ccd6')); p.hline(W / 2 - 4, 3, 8, X('#f4f4f4')); for (const [dx, dy] of [[-3, 8], [0, 7], [2, 9], [-2, 12], [1, 12]]) { p.rect(W / 2 + dx, dy, 2, 4, X('#5f9a3a')); p.px(W / 2 + dx, dy, X('#9fd06a')); } p.vline(W / 2 - 4, 7, 8, X('#ffffff')); }],
  'Pig Painting': ['g', (p, W, H) => { bands(p, ['#8fd0f0', '#cfeaf8'], 0, H - 6); p.rect(0, H - 6, W, 6, X('#6fb85a')); const t = tones('#f2a0b4'); p.ellipse(W / 2, H - 9, 9, 6, t[3]); p.ellipse(W / 2 - 2, H - 11, 6, 3, t[4]); p.ellipse(W / 2 - 9, H - 10, 4.5, 4.5, t[3]); p.rect(W / 2 - 14, H - 10, 3, 3, t[2]); p.px(W / 2 - 14, H - 9, t[0]); p.px(W / 2 - 10, H - 12, INK); p.rect(W / 2 - 9, H - 16, 2, 2, t[2]); p.rect(W / 2 - 12, H - 15, 2, 2, t[2]); for (const dx of [-6, -3, 3, 6]) p.rect(W / 2 + dx, H - 4, 2, 3, t[2]); p.px(W / 2 + 9, H - 11, t[2]); p.px(W / 2 + 10, H - 12, t[2]); p.px(W / 2 + 11, H - 11, t[2]); p.rect(2, H - 3, 5, 3, X('#8a5a34')); cloud(p, W - 8, 4, 4); sunD(p, 5, 4, 2, '#fff0a0'); }],
  'Portrait Of A Mermaid': ['g', (p, W, H) => { bust(p, { bg: '#3f9ac0', hair: '#3ac0a0', shirt: '#5fd0c0', style: 'long', extra: (p, cx) => { p.px(cx - 3, 3, X('#f2a8c4')); p.px(cx - 4, 4, X('#f6dc5a')); for (let i = 0; i < p.w; i += 4) p.hline(i, p.h - 1, 2, X('#9fd8f0')); p.px(2, 5, X('#e8f8ff')); p.px(p.w - 3, 9, X('#e8f8ff')); p.rect(p.w - 5, p.h - 6, 3, 2, X('#3ac0a0')); p.px(p.w - 6, p.h - 7, X('#3ac0a0')); p.px(p.w - 2, p.h - 7, X('#3ac0a0')); } }); }],
  'Primal Motion': ['w', (p, W, H) => { p.rect(0, 0, W, H, X('#d9a86a')); for (let i = 0; i < 30; i++) p.px(hash(i, 1, 8) * W, hash(i, 2, 8) * H, X('#c9985a')); for (const [x0, y0, col] of [[2, 4, '#8a2f2f'], [12, 9, '#3a2a20'], [4, 13, '#3a2a20']] as [number, number, string][]) stamp(p, x0, y0, ['#.....#.', '.######.', '.#####..', '#.#..#.#'], { '#': col }); p.vline(W - 3, 3, 5, X('#3a2a20')); p.px(W - 4, 4, X('#3a2a20')); p.px(W - 2, 4, X('#3a2a20')); p.px(W - 3, 2, X('#3a2a20')); p.line(W - 4, 8, W - 2, 8, X('#3a2a20')); }],
  'Queen of the Gem Sea': ['g', (p, W, H) => { bands(p, ['#f6a0b4', '#f6c8a0'], 0, 11); p.rect(0, 11, W, H - 11, X('#3aa0b8')); for (let i = 0; i < W; i += 3) p.px(i, 13 + (i % 2) * 3, X('#9fe0f0')); p.rect(W / 2 - 7, 9, 15, 4, X('#6b4530')); p.px(W / 2 - 7, 12, X('#3aa0b8')); p.px(W / 2 + 7, 12, X('#3aa0b8')); p.px(W / 2 - 6, 12, X('#3aa0b8')); p.vline(W / 2 - 3, 2, 7, X('#5b3b2e')); p.vline(W / 2 + 3, 1, 8, X('#5b3b2e')); p.rect(W / 2 - 6, 3, 5, 4, X('#fbf7ee')); p.rect(W / 2, 2, 6, 5, X('#fbf7ee')); icon(p, 'diamond', W / 2 + 3, 4.5, X('#ee6ab0')); p.px(W / 2 + 3, 0, X('#cf463f')); }],
  'Red Eagle': ['d', (p, W, H) => { p.rect(0, 0, W, H, X('#f1e6c8')); stamp(p, W / 2 - 10, 3, ['##................##', '####............####', '.#####...##...#####.', '..######.##.######..', '...##############...', '....############....', '.....##########.....', '......########......', '.......######.......', '......###..###......', '.....##..##..##.....', '.........##.........'], { '#': '#c23a3a' }); p.px(W / 2, 5, X('#f6dc5a')); p.px(W / 2 - 1, 6, INK); p.hline(4, H - 3, W - 8, X('#c23a3a')); }],
  'Runes': ['n', (p, W, H) => { rr(p, 0, 0, W, H, X('#8a857c'), 2); p.rect(1, 1, W - 2, 1, X('#b0aba2')); ['rune1', 'rune3', 'rune2', 'rune4', 'rune3', 'rune1'].forEach((r, i) => icon(p, r, 3 + (i % 2) * 4, 4.5 + Math.floor(i / 2) * 7, X('#3a3440'))); p.line(W - 3, 8, W - 1, 12, X('#5a5650')); }],
  'Skull Poster': ['n', (p, W, H) => { p.rect(0, 0, W, H, X('#1f1a24')); icon(p, 'skull', W / 2, 8, X('#f1ece0')); p.line(1, 13, W - 2, 18, X('#f1ece0')); p.line(W - 2, 13, 1, 18, X('#f1ece0')); p.hline(1, 1, W - 2, X('#cf463f')); p.hline(1, H - 2, W - 2, X('#cf463f')); }],
  'Solar Kingdom': ['g', (p, W, H) => { bands(p, ['#f6a03a', '#f6c85a', '#f6dc8a']); sunD(p, W / 2, 9, 6, '#fff0a0', 12, '#f6843a'); p.rect(0, H - 4, W, 4, X('#8a3a2a')); for (const [x0, hh] of [[4, 6], [8, 9], [W / 2 - 1, 11], [W - 11, 9], [W - 7, 6]]) { p.rect(x0, H - 4 - hh, 3, hh, X('#8a3a2a')); p.px(x0 + 1, H - 5 - hh, X('#8a3a2a')); } }],
  'Spires': ['d', (p, W, H) => { bands(p, ['#4a2a6a', '#8a3a7a', '#f08a5a']); for (const [cx, top, hw, col] of [[4, 6, 3, '#3a2a4a'], [10, 2, 3, '#2a1a3a'], [16, 5, 3, '#3a2a4a'], [21, 9, 2, '#2a1a3a']] as [number, number, number, string][]) mount(p, cx, top, hw, col); sunD(p, W - 4, 13, 2, '#fff0a0'); stars(p, 4, 6, 6); }],
  'Squid Kid': ['d', (p, W, H) => { bands(p, ['#2a1a3a', '#3a2a5a', '#2a1a3a']); const t = tones('#e8603a'); p.ellipse(W / 2, 13, 9, 9, t[3]); p.ellipse(W / 2 - 2, 10, 6, 5, t[4]); p.rect(W / 2 - 6, 18, 12, 8, t[3]); for (const ex of [-4, 3]) { p.rect(W / 2 + ex, 13, 3, 4, X('#fff6e0')); p.px(W / 2 + ex + 1, 15, INK); } p.hline(W / 2 - 1, 20, 3, t[1]); for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) p.px(W / 2 - 6 + i * 4 + Math.round(Math.sin(j / 1.5 + i) * 1), 26 + j, t[i % 2 ? 2 : 3]); p.px(W / 2 - 5, 6, t[5]); p.px(4, 4, X('#b98af0')); p.px(W - 5, 8, X('#b98af0')); p.px(5, 30, X('#b98af0')); }],
  'Stardrop': ['g', (p, W, H) => { bands(p, ['#2a1a4a', '#4a2a7a']); const t = tones('#b05ad0'); stamp(p, W / 2 - 6, 3, ['.....##.....', '.....##.....', '....####....', '############', '.##########.', '..########..', '..########..', '.####..####.', '.###....###.', '.##......##.'], { '#': t[3] }); p.rect(W / 2 - 2, 7, 4, 3, t[4]); p.px(W / 2 - 1, 5, t[5]); p.px(W / 2 - 3, 7, t[5]); for (const [dx, dy] of [[3, 3], [W - 4, 5], [4, H - 4], [W - 5, H - 5]]) p.px(dx, dy, X('#fff0a0')); p.ellipse(W / 2, H - 3, 5, 1, X('#1a1030')); }],
  'Starship': ['d', (p, W, H) => { p.rect(0, 0, W, H, X('#141a3a')); stars(p, 16, 4); p.ellipse(7, 14, 4, 4, X('#e8873a')); p.hline(1, 14, 12, X('#f6dc9a')); p.ellipse(6, 13, 2, 1.4, X('#f6a85a')); rr(p, 17, 7, 16, 6, X('#e3e6ea'), 2); p.rect(31, 8, 3, 4, X('#cf463f')); p.px(34, 9, X('#cf463f')); p.px(34, 10, X('#cf463f')); p.rect(17, 5, 4, 2, X('#cf463f')); p.rect(17, 13, 4, 2, X('#cf463f')); p.ellipse(27, 10, 1.6, 1.6, X('#6fc0f0')); p.hline(19, 12, 12, X('#a9b2bf')); p.rect(13, 8, 4, 4, X('#f9b93c')); p.rect(11, 9, 3, 2, X('#e8622a')); p.px(15, 9, X('#fff0a0')); }],
  'Sun #44': ['w', (p, W, H) => { p.rect(0, 0, W, H, X('#3f7fc8')); sunD(p, W / 2, H / 2, 5, '#f9d54a', 12, '#f6903a'); p.px(W / 2 - 2, H / 2 - 1, INK); p.px(W / 2 + 1, H / 2 - 1, INK); p.hline(W / 2 - 1, H / 2 + 2, 2, X('#c8603a')); }],
  'Sun #45': ['w', (p, W, H) => { bands(p, ['#f6dc5a', '#f6c84a']); sunD(p, W / 2, 8, 3, '#e8504a', 8, '#f6903a'); for (let j = 15; j < H; j += 2) p.hline(1, j, W - 2, X('#f6903a')); }],
  'Sun Dunes': ['w', (p, W, H) => { bands(p, ['#f6a04a', '#f6c86a', '#f6dc9a']); sunD(p, W / 2 + 4, 6, 3, '#fff6c0'); hills(p, 12, 2, W * 0.9, '#e0b060', 3); hills(p, 15, 2, W * 0.7, '#c8904a', 12); hills(p, 18, 1, W * 0.8, '#b07a3a', 0); }],
  'The Brave Little Sapling': ['w', (p, W, H) => { bands(p, ['#3a4a5a', '#5a6a7a', '#7a8a9a']); cloud(p, 6, 4, 5, '#2a3440'); cloud(p, 18, 5, 5, '#2a3440'); p.line(14, 6, 12, 10, X('#fff0a0')); p.line(12, 10, 14, 10, X('#fff0a0')); p.line(14, 10, 12, 14, X('#fff0a0')); hills(p, H - 4, 1, W * 2, '#4a6a3a'); p.vline(W / 2 - 3, H - 9, 6, X('#6b4530')); p.px(W / 2 - 4, H - 10, X('#8ae06a')); p.px(W / 2 - 5, H - 11, X('#8ae06a')); p.px(W / 2 - 2, H - 9, X('#6fd04a')); p.px(W / 2 - 1, H - 10, X('#6fd04a')); for (let i = 0; i < 7; i++) p.px(hash(i, 3, 3) * W, 8 + hash(i, 4, 3) * 8, X('#9fb8d0')); }],
  'The Miracle At Coldstar Ranch': ['n', (p, W, H) => { bands(p, ['#1f2a5a', '#3f4a8a']); icon(p, 'star5', W / 2, 4, X('#fff0a0')); p.vline(W / 2, 6, 4, X('#fff6c0')); p.rect(0, H - 6, W, 6, X('#f4f8fb')); house(p, 2, H - 4, 6, 5, '#b03a3a', '#f4f8fb'); stars(p, 5, 2, 10); p.hline(1, H - 2, W - 2, X('#cf463f')); }],
  'The Muzzamaroo': ['w', (p, W, H) => { bands(p, ['#f6dc9a', '#f6c86a'], 0, H - 5); p.rect(0, H - 5, W, 5, X('#8ab85a')); const t = tones('#9a7ac0'); p.ellipse(W / 2 + 2, H - 9, 6, 4.5, t[3]); p.ellipse(W / 2 - 5, H - 13, 3.5, 3.5, t[3]); p.rect(W / 2 - 8, H - 12, 3, 2, t[4]); p.px(W / 2 - 5, H - 14, INK); p.px(W / 2 - 7, H - 17, X('#f1ece0')); p.px(W / 2 - 3, H - 17, X('#f1ece0')); p.px(W / 2 - 7, H - 16, X('#f1ece0')); p.px(W / 2 - 3, H - 16, X('#f1ece0')); for (const dx of [-2, 1, 4, 6]) p.rect(W / 2 + dx, H - 5, 1, 3, t[1]); for (let j = 0; j < 5; j++) p.px(W / 2 + 8 + (j > 2 ? 1 : 0), H - 10 - j, t[2]); for (const [dx, dy] of [[1, -10], [4, -8], [2, -7]]) p.px(W / 2 + dx, H + dy, X('#f6dc5a')); }],
  'The Serpent': ['d', (p, W, H) => { p.rect(0, 0, W, H, X('#1f3a3a')); const t = tones('#5fd08a'); for (let i = 0; i < 44; i++) { const f = i / 44, sx = 3 + f * (W - 7), sy = H / 2 + Math.sin(f * 9) * 6; p.rect(sx, sy, 2, 2, i % 4 < 2 ? t[3] : t[2]); } p.rect(W - 5, H / 2 + Math.sin(9) * 6 - 2, 4, 4, t[4]); p.px(W - 3, H / 2 + Math.sin(9) * 6 - 1, X('#e8504a')); p.px(W - 1, H / 2 + Math.sin(9) * 6, X('#e8504a')); stars(p, 4, 12); }],
  'The Zuzu City Express': ['n', (p, W, H) => { bands(p, ['#f6a04a', '#f6c86a']); p.rect(0, H - 4, W, 4, X('#5a5a60')); rr(p, 1, 7, W - 2, 11, X('#3f6a9a'), 2); p.rect(2, 9, W - 4, 3, X('#cfe8ff')); p.vline(W / 2, 9, 3, X('#3f6a9a')); p.hline(1, 14, W - 2, X('#f6dc5a')); p.px(2, 16, X('#fff0a0')); p.px(W - 3, 16, X('#fff0a0')); p.rect(3, H - 4, 1, 4, X('#8a8a90')); p.rect(W - 4, H - 4, 1, 4, X('#8a8a90')); p.rect(0, 0, W, 2, X('#8a2f2f')); p.rect(W / 2 - 1, 4, 2, 3, X('#3a3440')); }],
  'Three Trees': ['w', (p, W, H) => { bands(p, ['#bfe6f8', '#e8f6fb']); hills(p, H - 4, 1, W, '#6fb85a'); treeS(p, 4, H - 4, 3, '#3f9a3c'); treeS(p, 11, H - 3, 4, '#2f8a4a'); treeS(p, 19, H - 4, 3, '#5fb04a'); }],
  'Tropical Fish #173': ['l', (p, W, H) => { bands(p, ['#3ac0c0', '#2aa0b0', '#1f8098']); const t = tones('#f6a03a'); p.ellipse(W / 2 - 1, H / 2, 6, 4, t[3]); for (let j = 0; j < 4; j++) { p.vline(W / 2 + 5 + j, H / 2 - j, 2 * j + 1, t[2]); } p.vline(W / 2 - 3, H / 2 - 3, 7, X('#ffffff')); p.vline(W / 2 + 1, H / 2 - 4, 8, X('#2a2430')); p.px(W / 2 - 5, H / 2 - 1, INK); p.px(W / 2 - 1, H / 2 - 5, t[4]); p.px(W / 2, H / 2 - 5, t[4]); seaweed(p, 3, H - 1, 7, tones('#3fae5a')); seaweed(p, W - 4, H - 1, 5, tones('#3fae5a')); p.px(5, 4, X('#e8f8ff')); p.px(7, 2, X('#e8f8ff')); }],
  'UFO': ['d', (p, W, H) => { bands(p, ['#101a3a', '#1f2a5a']); stars(p, 8, 7, 10); for (let j = 9; j < H - 2; j++) { const k = 2 + (j - 9) * 0.6; p.hline(W / 2 - k, j, 2 * k, X(j % 2 ? '#8fe0a0' : '#6fc888')); } p.ellipse(W / 2, 5, 3.5, 3, X('#9fe0f0')); p.ellipse(W / 2, 8, 8, 2.4, X('#a9b2bf')); p.hline(W / 2 - 6, 8, 12, X('#e3e6ea')); for (const dx of [-5, -1, 3]) p.px(W / 2 + dx, 9, X('#f6dc5a')); hills(p, H - 2, 1, W, '#1f3a2a'); p.rect(W / 2 - 1, H - 4, 3, 2, X('#f4f4f4')); p.px(W / 2 - 2, H - 4, X('#3a3440')); }],
  'Vanilla Villa': ['l', (p, W, H) => { bands(p, ['#8fd0f0', '#cfeaf8'], 0, H - 4); p.rect(0, H - 4, W, 4, X('#6fb85a')); p.rect(4, 8, 16, 9, X('#f6ecc8')); p.rect(3, 6, 18, 3, X('#c8603a')); p.rect(8, 3, 8, 4, X('#f6ecc8')); p.rect(7, 2, 10, 2, X('#c8603a')); p.rect(11, 12, 3, 5, X('#8a5a34')); for (const dx of [6, 16]) p.rect(dx, 11, 2, 3, X('#6fb0e0')); p.rect(11, 4, 2, 2, X('#6fb0e0')); treeS(p, 1, H - 3, 2); p.px(21, H - 5, X('#ee8fb6')); p.px(22, H - 4, X('#4fa651')); }],
  'VGA Paradise': ['d', (p, W, H) => { bands(p, ['#3a1a6a', '#b03a9a', '#f66a6a'], 0, 11); sunD(p, W / 2, 9, 5, '#f6dc5a'); p.hline(W / 2 - 5, 8, 10, X('#b03a9a')); p.hline(W / 2 - 5, 10, 10, X('#f66a6a')); p.rect(0, 11, W, H - 11, X('#1a1040')); for (let j = 12; j < H; j += 3) p.hline(0, j, W, X('#3ae0e0')); for (let i = -3; i < 4; i++) p.line(W / 2 + i * 2, 11, W / 2 + i * 7, H, X('#3ae0e0')); p.vline(3, 3, 9, X('#1a1040')); icon(p, 'palm', 3, 5, X('#1a1040')); }],
  'Vista': ['g', (p, W, H) => { bands(p, ['#8fc8f0', '#cfe6f8']); mount(p, 7, 3, 9, '#7a8aa8', '#ffffff', 13); mount(p, 17, 5, 8, '#6a7a98', '#ffffff', 13); p.rect(0, 13, W, 4, X('#5fa8d8')); p.hline(4, 14, 6, X('#cfe6f8')); p.rect(0, 17, W, 3, X('#4f9a45')); treeS(p, 2, 18, 2, '#2f7a45'); treeS(p, W - 4, 19, 2, '#2f7a45'); }],
  'Void Swirls': ['d', (p, W, H) => { p.rect(0, 0, W, H, X('#140a1f')); for (let a = 0; a < 150; a++) { const an = a * 0.14, r = a * 0.075; p.px(W / 2 + Math.cos(an) * r * 1.1, H / 2 + Math.sin(an) * r, X(a % 3 ? '#8a3ad0' : '#d05ae0')); } p.ellipse(W / 2, H / 2, 1.5, 1.5, X('#f4d8ff')); stars(p, 5, 13); }],
  "Wizard's Tower": ['d', (p, W, H) => { bands(p, ['#2a1a5a', '#5a3a8a', '#b05a9a']); stars(p, 7, 5, 9); hills(p, H - 4, 2, W * 1.5, '#2f5a3a', 8); p.rect(W / 2 - 3, 7, 6, H - 10, X('#8a8a9a')); p.vline(W / 2 - 3, 7, H - 10, X('#b0b0c0')); for (let j = 0; j < 5; j++) p.hline(W / 2 - 4 + j, 6 - j, 8 - 2 * j, X('#6a3aa0')); p.px(W / 2, 1, X('#f6dc5a')); p.px(W / 2 - 1, 10, X('#fff0a0')); p.px(W / 2 + 1, 13, X('#fff0a0')); p.rect(W / 2 - 1, H - 6, 2, 3, X('#3a2a20')); sunD(p, W - 4, 4, 2, '#f4eeb0'); p.ellipse(W - 3, 3, 1.6, 1.6, X('#2a1a5a')); }],
  'World Map': ['n', (p, W, H) => { p.rect(0, 0, W, H, X('#e6d8a8')); p.rect(1, 1, W - 2, H - 2, X('#7fb8d8')); for (const [cx, cy, rx, ry] of [[6, 7, 4, 3], [8, 13, 2.5, 4], [16, 6, 5, 3], [17, 11, 3, 3], [21, 15, 2.5, 1.6], [13, 4, 2, 1]]) p.ellipse(cx, cy, rx, ry, X('#6fa85a')); p.px(6, 6, X('#c8b06a')); p.px(17, 6, X('#c8b06a')); p.rect(1, 1, W - 2, 1, X('#f4f8fb')); p.rect(1, H - 2, W - 2, 1, X('#f4f8fb')); for (let i = 2; i < W - 2; i += 4) p.px(i, H / 2, X('#5f98c0')); p.px(20, 4, X('#cf463f')); }],
  'Wumbus': ['w', (p, W, H) => { bands(p, ['#f6dc5a', '#f6a03a']); const t = tones('#5fc07a'); rr(p, W / 2 - 7, 4, 14, 13, t[3], 5); p.ellipse(W / 2 - 2, 7, 4, 2, t[4]); for (const ex of [-4, 2]) { p.rect(W / 2 + ex, 8, 3, 3, X('#ffffff')); p.px(W / 2 + ex + 1, 9, INK); } p.hline(W / 2 - 3, 13, 7, t[0]); p.px(W / 2 - 1, 14, X('#ffffff')); p.px(W / 2 + 2, 14, X('#ffffff')); p.vline(W / 2 - 4, 1, 3, t[2]); p.vline(W / 2 + 4, 1, 3, t[2]); p.px(W / 2 - 4, 0, X('#e8504a')); p.px(W / 2 + 4, 0, X('#e8504a')); p.rect(W / 2 - 5, 17, 3, 2, t[2]); p.rect(W / 2 + 3, 17, 3, 2, t[2]); p.rect(0, H - 1, W, 1, X('#8a2f2f')); }],
};
const BUSTS: Record<string, Bust> = {
  Abigail: { bg: '#d8c8e8', hair: '#8a4ab8', shirt: '#3f7f8a', style: 'long' },
  Alex: { bg: '#cfe0c8', hair: '#8a5a34', shirt: '#3f8a4a', style: 'short', skin: '#e8b88a' },
  Elliott: { bg: '#f1dcc8', hair: '#d98a4a', shirt: '#b03a3a', style: 'long' },
  Emily: { bg: '#f8d8e0', hair: '#3f7fe0', shirt: '#cf463f', style: 'side' },
  Haley: { bg: '#cfe6f8', hair: '#f6d86a', shirt: '#4fb0d0', style: 'long' },
  Harvey: { bg: '#d8e0c8', hair: '#6b4530', shirt: '#4f7a4a', style: 'short', glasses: true, beard: true },
  Leah: { bg: '#d8e8c8', hair: '#e07a3a', shirt: '#4f9a55', style: 'braid' },
  Maru: { bg: '#e8dcc8', hair: '#8a3a4a', shirt: '#3f6a9a', style: 'bun', glasses: true, skin: '#b07a52' },
  Penny: { bg: '#f8e8c8', hair: '#d9603a', shirt: '#e9c040', style: 'bun' },
  Sam: { bg: '#cfe0f8', hair: '#f6d04a', shirt: '#3f6fd2', style: 'spiky' },
  Sebastian: { bg: '#c8c8d8', hair: '#2a2430', shirt: '#4a3a6a', style: 'side' },
  Shane: { bg: '#d8d8c8', hair: '#3a2a4a', shirt: '#3f5a8a', style: 'short', beard: true },
};
const FRAMES: Record<string, string> = { w: '#8f5a36', g: '#e6b93e', d: '#3a3440', l: '#e9e3d6' };

painters.painting = (img, x, y, w, h, c) => {
  const n = c.name, who = n.replace(' Portrait', '');
  const entry: [string, Scene] = PAINT[n] ?? (BUSTS[who] ? [['g', 'w', 'd'][pick(n, 3)], (p) => bust(p, BUSTS[who])] : ['w', (p, W, H) => { bands(p, ['#bfe6f8', '#e8f6fb']); hills(p, H - 5, 2, W, '#6fb85a'); }]);
  sprite(img, x, y, w, h, (g) => {
    const fx = w <= 16 ? 1 : 2, fy = h > 32 ? 4 : w <= 16 ? 3 : 4, fw = w - 2 * fx, fh = h - 2 * fy;
    if (entry[0] === 'n') { const p = new Img(fw, fh); entry[1](p, fw, fh); g.blit(p, fx, fy); return; }
    const t = T(FRAMES[entry[0]]);
    g.rect(fx, fy, fw, fh, t[3]); g.hline(fx, fy, fw, t[5]); g.vline(fx, fy, fh, t[4]); g.hline(fx, fy + fh - 1, fw, t[1]); g.vline(fx + fw - 1, fy, fh, t[2]);
    g.hline(fx + 1, fy + 1, fw - 2, t[4]); g.hline(fx + 1, fy + fh - 2, fw - 2, t[2]);
    if (entry[0] === 'g') for (const [cx2, cy2] of [[fx, fy], [fx + fw - 1, fy], [fx, fy + fh - 1], [fx + fw - 1, fy + fh - 1]]) g.px(cx2, cy2, t[5]);
    const p = new Img(fw - 4, fh - 4);
    entry[1](p, fw - 4, fh - 4);
    g.blit(p, fx + 2, fy + 2);
    for (let i = 0; i < fw - 4; i++) g.px(fx + 2 + i, fy + 2, [20, 12, 20, 60]);
  }, { shadow: false });
};

// ------------------------------------------------------------------ wall decor

type WinOpt = { style?: string; curtain?: Tones; arch?: boolean; night?: boolean };
function windowW(g: Img, x0: number, y0: number, ww: number, wh: number, t: Tones, o: WinOpt = {}) {
  rr(g, x0, y0, ww, wh, t[3], o.arch ? 3 : 0); g.hline(x0 + (o.arch ? 3 : 0), y0, ww - (o.arch ? 6 : 0), t[5]); g.vline(x0, y0 + (o.arch ? 3 : 0), wh - (o.arch ? 3 : 0), t[4]); g.vline(x0 + ww - 1, y0 + 3, wh - 3, t[2]);
  const gx = x0 + 2, gy = y0 + 2, gw = ww - 4, gh = wh - 4;
  rr(g, gx, gy, gw, gh, X(o.night ? '#2c3a7e' : '#8fd0f0'), o.arch ? 2 : 0);
  g.rect(gx, gy + Math.floor(gh / 2), gw, gh - Math.floor(gh / 2), X(o.night ? '#3f4a9a' : '#bfe6f8'));
  if (o.night) { g.px(gx + 2, gy + 3, X('#ffffff')); g.px(gx + gw - 3, gy + 6, X('#fff0a0')); g.px(gx + 4, gy + 9, X('#ffffff')); }
  else { g.hline(gx + 1, gy + gh - 2, gw - 2, X('#8fc86a')); g.hline(gx, gy + gh - 1, gw, X('#6fb85a')); if (gw > 6) { g.hline(gx + gw - 5, gy + 4, 4, X('#ffffff')); g.hline(gx + gw - 4, gy + 3, 2, X('#ffffff')); } }
  for (let j = 0; j < Math.min(gh - 2, 7); j++) g.px(gx + 1 + Math.floor((Math.min(gh - 2, 7) - j) / 2), gy + 1 + j, [255, 255, 255, 110]);
  const st = o.style ?? 'cross';
  if (st === 'cross') { g.vline(x0 + Math.floor(ww / 2), gy, gh, t[3]); g.hline(gx, gy + Math.floor(gh / 2), gw, t[3]); }
  else if (st === 'grid') { g.vline(x0 + Math.floor(ww / 2), gy, gh, t[3]); for (let j = Math.floor(gh / 3); j < gh; j += Math.floor(gh / 3)) g.hline(gx, gy + j, gw, t[3]); }
  else if (st === 'h') g.hline(gx, gy + Math.floor(gh / 2), gw, t[3]);
  if (o.curtain) { const cu = o.curtain; for (let j = 0; j < gh; j++) { const k = Math.max(1, Math.round(gw / 2 - 1 - j * 0.45)); g.hline(gx, gy + j, k, cu[j % 3 === 0 ? 4 : 3]); g.hline(gx + gw - k, gy + j, k, cu[j % 3 === 0 ? 3 : 2]); } g.hline(gx, gy, gw, cu[4]); g.hline(gx, gy + 1, gw, cu[2]); }
  g.rect(x0 - 1, y0 + wh, ww + 2, 2, t[4]); g.hline(x0 - 1, y0 + wh + 1, ww + 2, t[2]);
}
function banner(g: Img, w: number, h: number, t: Tones, trim: Tones, deco: Draw, tail = 'v') {
  const rod = T('#8a5a34');
  g.rect(1, 3, w - 2, 2, rod[3]); g.hline(1, 3, w - 2, rod[5]); g.px(1, 2, GOLD[4]); g.px(w - 2, 2, GOLD[4]); g.px(1, 5, GOLD[3]); g.px(w - 2, 5, GOLD[3]);
  const bx = 3, bw = w - 6, by = 5, bb = h - 9;
  g.rect(bx, by, bw, bb - by, t[3]); g.vline(bx, by, bb - by, t[4]); g.vline(bx + bw - 1, by, bb - by, t[2]);
  for (let j = 0; j < 6; j++) { const k = tail === 'v' ? Math.round((j * bw) / 12) : tail === 'swallow' ? 0 : 0; g.hline(bx + k, bb + j, bw - 2 * k, t[j > 3 ? 2 : 3]); if (tail === 'swallow') for (let q = 0; q <= j; q++) { clearPx(g, Math.floor(w / 2) - 1 - Math.floor(q / 2) + j - j, bb + j); } }
  if (tail === 'swallow') for (let j = 0; j < 6; j++) for (let i = -j; i <= j; i++) { const xx = Math.round(w / 2 - 0.5 + i * 0.5); clearPx(g, xx, bb + 5 - (5 - j)); }
  g.hline(bx, by + 2, bw, trim[4]); g.hline(bx, bb - 2, bw, trim[4]);
  deco(g);
}

painters.walldecor = (img, x, y, w, h, c) => {
  const n = c.name, cx = w / 2, cy = h / 2;
  let post: Draw | undefined;
  sprite(img, x, y, w, h, (g) => {
    const wood = T('#8f5a36'), oak = T('#c68b46'), wal = T('#7b4b2f');
    const handle = (y0: number, y1: number, t: Tones = oak) => { g.rect(7, y0, 2, y1 - y0, t[3]); g.vline(7, y0, y1 - y0, t[4]); g.vline(8, y0, y1 - y0, t[2]); };
    const pegs = (yy: number) => { g.rect(4, yy, 2, 2, wal[2]); g.rect(10, yy, 2, 2, wal[2]); };
    const string = (yy: number, sag = 2) => { for (let i = 0; i < w; i++) g.px(i, yy + Math.round(Math.sin((i / (w - 1)) * Math.PI) * sag), X('#5a4a3a')); };
    const junimo = (jx: number, jy: number, col: string, s = 1) => { const t = T(col); rr(g, jx - 3 * s, jy - 3 * s, 6 * s + 1, 6 * s + 1, t[3], 2 * s); g.hline(jx - s, jy - 3 * s, 2 * s + 1, t[5]); g.px(jx - 2, jy, INK); g.px(jx + 2, jy, INK); g.px(jx, jy - 3 * s - 1, LEAF[3]); g.px(jx + 1, jy - 3 * s - 2, LEAF[4]); g.px(jx - 3 * s, jy + 3 * s + 1, t[2]); g.px(jx + 3 * s, jy + 3 * s + 1, t[2]); };
    switch (n) {
      case 'Anchor': { const t = T('#5a6a80'); circle(g, 8, 6, 3, t[3]); circle(g, 8, 6, 1.4, [0, 0, 0, 0]); for (let j = 4; j < 9; j++) for (let i = 6; i < 10; i++) if (Math.hypot(i + 0.5 - 8, j + 0.5 - 6) < 1.4) clearPx(g, i, j); g.rect(7, 9, 2, 17, t[3]); g.vline(7, 9, 17, t[4]); g.rect(4, 11, 8, 2, t[3]); g.hline(4, 11, 8, t[5]); for (let a = 0; a <= 16; a++) { const an = (a / 16) * Math.PI, px0 = 8 + Math.cos(an) * 5.5 - 0.5, py = 21 + Math.sin(an) * 5; g.rect(px0, py, 2, 2, t[a < 8 ? 2 : 3]); } g.rect(1, 19, 3, 2, t[4]); g.px(2, 18, t[4]); g.rect(12, 19, 3, 2, t[2]); g.px(13, 18, t[3]); g.px(2, 3, X('#d9c9a0')); g.line(3, 4, 5, 6, X('#d9c9a0')); break; }
      case 'Basic Window': windowW(g, 2, 4, 12, 22, wood); break;
      case 'Window': windowW(g, 1, 3, 14, 24, T('#e9e3d6'), { curtain: T('#e8b04a') }); break;
      case 'Carved Window': windowW(g, 1, 3, 14, 24, wal, { arch: true, style: 'cross' }); for (let j = 8; j < 26; j += 4) { g.px(1, j, wal[5]); g.px(14, j, wal[5]); } g.px(7, 3, GOLD[4]); g.px(8, 3, GOLD[4]); break;
      case 'Metal Window': windowW(g, 2, 4, 12, 22, STEEL, { style: 'grid' }); for (const [rx, ry] of [[2, 4], [13, 4], [2, 25], [13, 25]]) g.px(rx, ry, STEEL[1]); break;
      case 'Ornate Window': windowW(g, 1, 2, 14, 25, GOLD, { arch: true, style: 'h', curtain: T('#b03a4a') }); g.px(7, 1, GOLD[5]); g.px(8, 1, GOLD[4]); g.px(4, 16, GOLD[4]); g.px(11, 16, GOLD[4]); break;
      case 'Small Window': windowW(g, 2, 2, 12, 10, wood); break;
      case 'Triangle Window': { for (let j = 0; j < 18; j++) { const k = Math.round((j / 17) * 6.5); g.hline(8 - k - 1, 5 + j, 2 * k + 2, wood[3]); if (j > 2 && j < 16) g.hline(8 - k + 1, 5 + j, Math.max(0, 2 * k - 2), X(j < 10 ? '#8fd0f0' : '#bfe6f8')); } g.rect(1, 22, 14, 2, wood[3]); g.vline(7, 8, 14, wood[3]); g.vline(8, 8, 14, wood[2]); g.rect(0, 24, 16, 2, wood[4]); g.hline(0, 25, 16, wood[2]); g.px(5, 14, [255, 255, 255, 140]); g.px(4, 16, [255, 255, 255, 140]); g.px(7, 5, wood[5]); break; }
      case 'Porthole': { const t = T('#c8a04a'); circle(g, 8, 15, 7, t[3]); circle(g, 7.5, 14.5, 6, t[4]); circle(g, 8, 15, 5, t[1]); circle(g, 8, 15, 4.2, X('#8fd0f0')); for (let j = 16; j < 20; j++) for (let i = 4; i < 12; i++) if (Math.hypot(i + 0.5 - 8, j + 0.5 - 15) < 4.2) g.px(i, j, X(j === 16 && i % 3 ? '#9fe0f0' : '#3f8ac0')); g.px(6, 12, X('#ffffff')); g.px(5, 13, X('#ffffff')); for (let a = 0; a < 6; a++) g.px(7.5 + Math.cos(a * 1.047 + 0.5) * 6, 14.5 + Math.sin(a * 1.047 + 0.5) * 6, t[1]); g.rect(14, 14, 2, 3, t[2]); break; }
      case 'Ceiling Flags': { string(2, 3); [['#cf463f', 3], ['#e9c040', 8], ['#4f7fd6', 13]].forEach(([col, fx]) => { const t = T(col as string); for (let j = 0; j < 5; j++) g.hline((fx as number) - 2 + Math.ceil(j / 2), 5 + j - ((fx as number) === 8 ? 0 : 1), 5 - 2 * Math.ceil(j / 2) + (j % 2 ? 0 : 0), t[j ? 3 : 4]); }); break; }
      case 'Ceiling Leaves': { for (const [vx, len] of [[2, 9], [5, 5], [8, 12], [11, 7], [14, 10]]) { for (let j = 0; j < len; j++) { g.px(vx + ((j >> 1) % 2), j + 1, LEAF[2]); if (j % 3 === 1) { g.px(vx + 1 + ((j >> 1) % 2), j + 1, LEAF[4]); g.px(vx - 1 + ((j >> 1) % 2), j + 2, LEAF[3]); } } g.px(vx, len + 1, LEAF[5]); } g.hline(0, 0, 16, LEAF[3]); g.hline(1, 1, 14, LEAF[2]); break; }
      case 'Chicken Decal': {
        const t = T('#f4f0e6');
        g.ellipse(22, 17, 10, 8, t[3]); g.ellipse(20, 15, 7, 5, t[4]); g.ellipse(12, 10, 5, 5, t[4]); for (let j = 0; j < 9; j++) g.hline(29 + Math.floor(j / 2), 8 + j, 6 - Math.floor(j / 3), t[j < 3 ? 4 : 3]); g.rect(31, 6, 3, 3, t[4]);
        g.rect(10, 4, 2, 2, RED[3]); g.rect(12, 3, 2, 3, RED[3]); g.rect(14, 4, 2, 2, RED[2]); g.rect(6, 10, 2, 2, T('#f0a03a')[3]); g.px(5, 11, T('#f0a03a')[2]); g.rect(9, 13, 2, 3, RED[3]); g.px(11, 9, INK);
        g.line(20, 18, 26, 16, t[1]); g.line(20, 19, 25, 20, t[1]); for (const lx of [19, 24]) { g.vline(lx, 25, 3, T('#f0a03a')[3]); g.hline(lx - 1, 28, 4, T('#f0a03a')[3]); }
        for (const [kx, ky] of [[38, 24], [44, 22]]) { const k = T('#f6dc5a'); circle(g, kx, ky, 2.6, k[3]); circle(g, kx - 2, ky - 2.5, 1.8, k[4]); g.px(kx - 4, ky - 2, T('#f0a03a')[3]); g.px(kx - 3, ky - 3, INK); g.px(kx, ky + 3, T('#f0a03a')[3]); }
        break;
      }
      case 'Cloud Decal': { const t = T('#f4f8fb'); g.ellipse(16, 19, 13, 6, t[2]); g.ellipse(16, 18, 13, 6, t[4]); g.ellipse(10, 13, 6, 5.5, t[4]); g.ellipse(19, 11, 7, 6.5, t[4]); g.ellipse(18, 10, 4, 3, X('#ffffff')); g.ellipse(9, 12, 3, 2, X('#ffffff')); g.hline(8, 22, 16, T('#bfe1ef')[3]); break; }
      case 'Cow Decal': {
        const t = T('#f4f0e6');
        rr(g, 8, 11, 20, 11, t[3], 3); g.hline(10, 11, 16, t[4]); rr(g, 2, 7, 10, 10, t[4], 3); g.rect(3, 13, 8, 4, T('#f2b8c0')[3]); g.px(5, 15, INK); g.px(8, 15, INK); g.px(4, 10, INK); g.px(9, 10, INK);
        g.px(2, 6, t[2]); g.px(1, 5, T('#d9c9a0')[3]); g.px(11, 6, t[2]); g.px(12, 5, T('#d9c9a0')[3]); g.rect(0, 8, 2, 2, t[2]); g.rect(12, 8, 2, 2, T('#3a3440')[3]);
        for (const [sx, sy, sr] of [[18, 14, 3], [24, 18, 2.4], [13, 19, 1.6]]) g.ellipse(sx, sy, sr, sr * 0.8, T('#3a3440')[3]);
        for (const lx of [10, 14, 21, 25]) { g.rect(lx, 22, 2, 5, t[3]); g.rect(lx, 26, 2, 1, T('#3a3440')[3]); } g.line(28, 13, 30, 18, t[2]); g.px(30, 19, T('#3a3440')[3]); g.rect(16, 21, 4, 2, T('#f2b8c0')[3]);
        break;
      }
      case 'Clouds Banner': banner(g, w, h, T('#6fb0e8'), WHITE, (g) => { for (const [bx, by, r] of [[8, 14, 4], [7, 24, 3], [9, 33, 4]]) { g.ellipse(bx, by, r, r * 0.5, X('#ffffff')); g.ellipse(bx - 1, by - 1.5, r * 0.5, r * 0.4, X('#ffffff')); g.ellipse(bx + 1.5, by - 1, r * 0.4, r * 0.35, X('#f4f8fb')); } }); break;
      case 'Icy Banner': banner(g, w, h, T('#a8d8f0'), T('#ffffff'), (g) => { icon(g, 'flake', 8, 14, X('#ffffff')); icon(g, 'diamond', 8, 24, T('#5f90d2')[3]); icon(g, 'flake', 8, 34, X('#ffffff')); }, 'swallow'); break;
      case 'Pastel Banner': banner(g, w, h, T('#f8d8e0'), T('#bfe1ef'), (g) => { ['#f2a8c4', '#bfe1ef', '#f6e7a0', '#b8e0b0', '#d8c0f0'].forEach((col, i) => { g.rect(4, 9 + i * 6, 8, 5, X(col)); }); icon(g, 'heart', 8, 23.5, X('#ffffff')); }); break;
      case 'Retro Banner': banner(g, w, h, T('#f6e7b8'), T('#7b4b2f'), (g) => { circle(g, 8, 16, 4, T('#e2853c')[3]); circle(g, 8, 16, 2.4, T('#3aa79f')[3]); for (let j = 24; j < 38; j += 4) { g.hline(4, j, 8, T('#e2853c')[3]); g.hline(4, j + 1, 8, T('#3aa79f')[3]); } }, 'flat'); break;
      case 'Winter Banner': banner(g, w, h, T('#b03a3a'), GOLD, (g) => { pine(g, 8, 11, 22, 4, T('#2f7a45'), 4); g.px(8, 10, GOLD[5]); g.rect(7, 23, 2, 2, T('#6b4530')[3]); icon(g, 'flake', 8, 32, X('#ffffff')); g.px(5, 15, X('#ffffff')); g.px(11, 28, X('#ffffff')); }); break;
      case 'Dark Leafy Wall Panel': case 'Leafy Wall Panel': case 'Light Leafy Wall Panel': {
        const lf = /Dark/.test(n) ? T('#2f6a45') : /Light/.test(n) ? T('#8fd06a') : T('#4fa651'), fr = /Dark/.test(n) ? wal : /Light/.test(n) ? T('#e4ca9c') : wood;
        g.rect(1, 1, 14, 46, lf[2]);
        for (let j = 3; j < 45; j += 4) for (let i = 0; i < 3; i++) { const lx = 3 + i * 4 + ((j >> 2) % 2) * 2, ly = j; g.rect(lx, ly, 3, 2, lf[3]); g.px(lx, ly, lf[5]); g.px(lx + 1, ly + 2, lf[3]); g.px(lx + 2, ly + 1, lf[1]); }
        if (/Light/.test(n)) for (const [fx, fy] of [[5, 10], [10, 22], [6, 36]]) icon(g, 'bloom', fx, fy, X('#ffffff'), GOLD[4]);
        if (/Dark/.test(n)) for (const [fx, fy] of [[10, 12], [5, 30]]) g.px(fx, fy, T('#b98af0')[3]);
        ring(g, 1, 1, 14, 46, fr[3], 2); g.hline(1, 1, 14, fr[5]); g.vline(1, 1, 46, fr[4]); g.hline(1, 46, 14, fr[1]); g.vline(14, 2, 45, fr[2]);
        break;
      }
      case 'Log Panel': { const t = T('#8a5a34'); for (let j = 1; j < 46; j += 6) { rr(g, 1, j, 14, 6, t[3], 2); g.hline(3, j, 10, t[5]); g.hline(3, j + 1, 10, t[4]); g.hline(3, j + 5, 10, t[1]); g.px(5 + (j % 4), j + 3, t[2]); g.hline(8 + (j % 3), j + 3, 3, t[2]); circle(g, 2.5, j + 3, 1.6, T('#e0c48a')[3]); g.px(2, j + 3, T('#e0c48a')[1]); } break; }
      case 'Wood Panel': { const t = oak; g.rect(1, 1, 14, 46, t[3]); for (const px0 of [5, 10]) g.vline(px0, 2, 44, t[1]); for (const px0 of [2, 6, 11]) g.vline(px0, 3, 42, t[4]); for (const [kx, ky] of [[3, 12], [8, 28], [12, 8], [12, 38], [7, 42]]) { g.px(kx, ky, t[1]); g.px(kx, ky + 1, t[2]); } ring(g, 1, 1, 14, 46, wal[3]); g.hline(1, 1, 14, wal[5]); g.rect(1, 43, 14, 4, wal[3]); g.hline(1, 43, 14, wal[5]); break; }
      case 'Decorative Axe': { pegs(30); handle(8, 44); g.rect(7, 42, 2, 3, wal[3]); stamp(g, 2, 6, ['....hh......', '..sshhSSS...', '.ssshhSSSS..', 'sssshhSSSSS.', 'sssshhSSSSSS', 'sssshhSSSSSS', '.ssshhSSSSS.', '..sshhSSSS..', '....hhSS....'], { h: oak[3], s: STEEL[2], S: STEEL[4] }); g.vline(13, 10, 3, STEEL[5]); g.vline(2, 9, 3, STEEL[5]); pegs(20); break; }
      case 'Decorative Pitchfork': { handle(18, 46); pegs(34); g.rect(3, 16, 10, 2, STEEL[3]); g.hline(3, 16, 10, STEEL[5]); for (const tx of [3, 7, 12]) { g.rect(tx, 3, tx === 7 ? 2 : 1, 13, STEEL[tx === 12 ? 2 : 4]); g.px(tx, 2, STEEL[5]); } g.rect(7, 18, 2, 3, STEEL[2]); break; }
      case 'Decorative Shovel': { handle(8, 30); pegs(18); g.rect(4, 3, 8, 2, oak[3]); g.hline(4, 3, 8, oak[5]); g.rect(4, 5, 2, 4, oak[3]); g.rect(10, 5, 2, 4, oak[2]); g.rect(5, 8, 6, 1, oak[2]); rr(g, 3, 30, 10, 14, STEEL[3], 3); g.rect(3, 30, 10, 3, STEEL[3]); g.vline(4, 31, 9, STEEL[5]); g.vline(8, 31, 11, STEEL[2]); g.rect(10, 32, 2, 8, STEEL[2]); g.hline(3, 30, 10, STEEL[4]); break; }
      case "Witch's Broom": { handle(3, 30, wal); g.rect(5, 28, 6, 3, T('#8a2f8a')[3]); g.hline(5, 28, 6, T('#b05ad0')[3]); const s = T('#d9b55c'); for (let j = 0; j < 14; j++) { const k = 3 + Math.floor(j / 3); g.hline(8 - k, 31 + j, 2 * k, s[3]); g.px(8 - k, 31 + j, s[5]); g.px(7 + k, 31 + j, s[1]); } for (const bx of [5, 7, 10]) g.vline(bx, 33, 11, s[2]); g.px(11, 6, GOLD[5]); g.px(12, 5, GOLD[4]); g.px(4, 10, T('#b05ad0')[4]); break; }
      case "Sam's Skateboard": { const t = T('#3f6fd2'); rr(g, 4, 2, 8, 44, T('#2a2430')[3], 4); rr(g, 5, 3, 6, 42, t[3], 3); g.vline(5, 7, 34, t[4]); icon(g, 'bolt', 8, 14, GOLD[4]); icon(g, 'star5', 8, 24, X('#ffffff')); g.rect(5, 30, 6, 3, RED[3]); g.rect(5, 34, 6, 2, GOLD[4]); for (const wy of [8, 38]) { g.rect(2, wy, 2, 4, X('#f1ece0')); g.rect(12, wy, 2, 4, X('#c9c2b0')); g.hline(4, wy + 2, 8, STEEL[3]); } break; }
      case 'Decorative Oak Ladder': case 'Decorative Walnut Ladder': { const t = /Oak/.test(n) ? oak : wal; for (let j = 6; j < 44; j += 6) { g.rect(4, j, 8, 2, t[4]); g.hline(4, j + 1, 8, t[2]); } for (const lx of [3, 11]) { g.rect(lx, 2, 2, 44, t[3]); g.vline(lx, 2, 44, t[5]); g.vline(lx + 1, 2, 44, t[2]); } if (/Walnut/.test(n)) { g.px(7, 11, LEAF[3]); g.px(8, 10, LEAF[4]); g.rect(5, 26, 6, 4, T('#b03a3a')[3]); g.hline(5, 26, 6, T('#e86a6a')[3]); } break; }
      case 'Decorative Sword': { const pl = wood; rr(g, 2, 3, 12, 26, pl[3], 3); g.hline(5, 3, 6, pl[5]); g.vline(2, 6, 20, pl[4]); g.vline(13, 6, 20, pl[2]); g.rect(7, 5, 2, 4, wal[2]); g.px(7, 4, GOLD[4]); g.px(8, 4, GOLD[3]); g.rect(4, 9, 8, 2, GOLD[4]); g.hline(4, 10, 8, GOLD[2]); g.rect(7, 11, 2, 14, STEEL[4]); g.vline(8, 11, 14, STEEL[2]); g.vline(7, 11, 13, STEEL[5]); g.px(7, 25, STEEL[4]); g.px(8, 25, STEEL[3]); g.px(7, 26, STEEL[3]); break; }
      case 'Wall Sword': { g.rect(2, 7, 4, 2, wal[2]); g.px(1, 7, GOLD[4]); g.px(1, 8, GOLD[3]); g.rect(6, 4, 2, 8, GOLD[4]); g.vline(7, 4, 8, GOLD[2]); g.rect(8, 7, 20, 2, STEEL[4]); g.hline(8, 7, 20, STEEL[5]); g.hline(8, 8, 20, STEEL[2]); g.px(28, 7, STEEL[4]); g.px(28, 8, STEEL[3]); g.px(29, 8, STEEL[3]); g.rect(10, 10, 2, 2, wal[3]); g.rect(22, 10, 2, 2, wal[3]); break; }
      case 'Desert Flags': { string(2, 2); ['#c9563c', '#e9c040', '#4aa39a', '#f1e6c8', '#c9563c', '#8a5cc2', '#e9c040'].forEach((col, i) => { const fx = 3 + i * 9, t = T(col), fy = 3 + Math.round(Math.sin(((fx + 3) / (w - 1)) * Math.PI) * 2); g.rect(fx, fy, 6, 9, t[3]); g.hline(fx, fy, 6, t[5]); g.vline(fx + 5, fy, 9, t[2]); for (let q = 0; q < 6; q++) g.px(fx + q, fy + 4 + (q % 2), t[1]); g.px(fx + 1, fy + 9, t[3]); g.px(fx + 4, fy + 9, t[3]); }); break; }
      case 'Glyph': { const t = T('#8a857c'); rr(g, 2, 2, 12, 12, t[3], 2); g.hline(4, 2, 8, t[5]); g.vline(2, 4, 8, t[4]); g.hline(4, 13, 8, t[1]); const gl = X('#6fe0d0'); g.vline(8, 4, 8, gl); g.line(8, 5, 11, 8, gl); g.line(8, 9, 5, 6, gl); g.px(6, 11, gl); g.px(10, 11, gl); break; }
      case 'Hanging Shield': { const t = T('#b03a3a'); for (let j = 0; j < 13; j++) { const k = j < 6 ? 6 : Math.max(0, 6 - Math.round((j - 6) * 0.9)); g.hline(8 - k, 2 + j, 2 * k, t[j < 2 ? 4 : 3]); if (k > 1) { g.px(8 - k, 2 + j, GOLD[4]); g.px(7 + k, 2 + j, GOLD[2]); } } g.hline(2, 2, 12, GOLD[5]); g.rect(7, 3, 2, 10, GOLD[4]); g.rect(3, 6, 10, 2, GOLD[4]); g.px(8, 6, GOLD[2]); break; }
      case 'Indoor Hanging Basket': { g.px(8, 1, STEEL[3]); g.px(7, 2, STEEL[3]); g.px(8, 2, STEEL[3]); g.line(8, 3, 3, 13, X('#8a7a5a')); g.line(8, 3, 12, 13, X('#8a7a5a')); const t = T('#b08a5a'); for (let j = 0; j < 6; j++) { const k = 6 - Math.floor(j / 2); g.hline(8 - k, 14 + j, 2 * k, t[3]); for (let i = 8 - k; i < 8 + k; i++) if ((i + j) % 2) g.px(i, 14 + j, t[2]); } g.hline(2, 14, 12, t[5]); bush(g, 8, 11, 6, 3.5, LEAF); for (const [vx, len] of [[2, 10], [5, 6], [11, 8], [14, 11]]) for (let j = 0; j < len; j++) { g.px(vx + ((j >> 1) % 2 ? 0 : -1) + 0, 15 + j, LEAF[j % 3 ? 3 : 4]); } g.px(6, 9, T('#ee8fb6')[3]); g.px(10, 10, T('#ee8fb6')[4]); g.px(8, 8, T('#f6dc5a')[4]); break; }
      case 'J. Light': { const t = T('#3f6fd2'); g.rect(3, 4, 10, 3, STEEL[3]); g.hline(3, 4, 10, STEEL[5]); rr(g, 2, 7, 12, 17, t[3], 2); g.vline(2, 9, 13, t[4]); rr(g, 4, 9, 8, 13, X('#fff8d8'), 1); g.rect(6, 11, 5, 2, t[3]); g.rect(8, 11, 2, 8, t[3]); g.rect(5, 17, 4, 2, t[3]); g.px(5, 16, t[3]); g.rect(6, 24, 4, 2, STEEL[2]); post = (g) => lampGlow(g, 8, 15, 12, X('#fff0a0')); break; }
      case 'Joja Cola Ornament': { const t = T('#cf463f'); circle(g, 8, 14, 7, STEEL[3]); for (let a = 0; a < 16; a++) g.px(7.5 + Math.cos(a * 0.393) * 7.4, 13.5 + Math.sin(a * 0.393) * 7.4, STEEL[a % 2 ? 5 : 2]); circle(g, 8, 14, 5.6, t[3]); g.ellipse(7, 12, 3.5, 2, t[4]); icon(g, 'joja', 8, 14, X('#ffffff')); g.rect(7, 22, 2, 5, T('#3f6fd2')[3]); g.px(6, 27, T('#3f6fd2')[3]); g.px(9, 27, T('#3f6fd2')[3]); g.px(7, 6, STEEL[2]); break; }
      case 'Jungle Decal': { const d = T('#2f8a4a'); for (let j = 1; j < 47; j++) { const vx = 8 + Math.round(Math.sin(j / 5) * 3); g.px(vx, j, d[2]); g.px(vx + 1, j, d[3]); } for (const [lx, ly, dir] of [[8, 6, -1], [9, 13, 1], [6, 20, -1], [8, 27, 1], [10, 34, -1], [7, 41, 1]]) { for (let k = 0; k < 6; k++) { const hh = k < 3 ? k + 1 : 6 - k; g.vline(lx + dir * (k + 1), ly - hh + 1, hh * 2 - 1, k % 2 ? LEAF[3] : d[3]); } g.px(lx + dir * 3, ly - 2, LEAF[5]); g.px(lx + dir * 2, ly, d[1]); g.px(lx + dir * 4, ly, d[1]); } const fl = T('#ee6a8a'); for (const [fx, fy] of [[4, 11], [12, 30]]) { circle(g, fx, fy, 2.2, fl[3]); g.px(fx, fy, GOLD[5]); } const pr = T('#e8504a'); rr(g, 2, 23, 4, 6, pr[3], 1); g.px(1, 24, GOLD[4]); g.px(3, 24, INK); g.rect(3, 27, 3, 3, T('#3f7fd0')[3]); g.px(4, 30, T('#f6dc5a')[3]); break; }
      case 'Junimo Plaque': { rr(g, 1, 2, 14, 12, wood[3], 2); g.hline(3, 2, 10, wood[5]); g.hline(3, 13, 10, wood[1]); rr(g, 3, 4, 10, 8, T('#e0c48a')[3], 1); junimo(8, 8, '#62b04c'); break; }
      case 'Junimo Plush': { g.rect(1, 12, 14, 2, wood[4]); g.hline(1, 13, 14, wood[2]); g.px(3, 14, wood[2]); g.px(12, 14, wood[2]); junimo(8, 7, '#f08a3a'); g.px(4, 8, T('#f08a3a')[3]); g.px(12, 8, T('#f08a3a')[2]); g.px(6, 10, T('#f08a3a')[1]); g.px(9, 4, T('#f08a3a')[5]); break; }
      case 'Junimo Star': { const s = T('#f6dc5a'); g.vline(8, 0, 6, X('#8a7a5a')); stamp(g, 1, 5, ['......##......', '......##......', '.....####.....', '.....####.....', '##############', '.############.', '..##########..', '...########...', '...########...', '..####..####..', '..###....###..', '.###......###.', '.##........##.'], { '#': s[3] }); g.rect(6, 9, 4, 5, s[4]); g.px(7, 7, s[5]); g.px(6, 11, INK); g.px(9, 11, INK); g.hline(7, 13, 2, T('#e8873a')[3]); break; }
      case 'Junimo Wall Plaque': { rr(g, 1, 3, 14, 26, wood[3], 3); g.hline(4, 3, 8, wood[5]); g.vline(1, 6, 20, wood[4]); g.hline(4, 28, 8, wood[1]); rr(g, 3, 5, 10, 22, T('#bfe6c8')[3], 2); g.rect(3, 22, 10, 5, T('#6fb85a')[3]); junimo(8, 11, '#b98af0'); junimo(8, 20, '#6fc0f0'); break; }
      case 'L. Light String': { string(3, 4); ['#e8504a', '#f6dc5a', '#6fc0f0', '#8ae06a', '#ee8fb6', '#f6a03a'].forEach((col, i) => { const bx = 3 + i * 5, by = 5 + Math.round(Math.sin((bx / (w - 1)) * Math.PI) * 4), t = T(col); g.px(bx, by - 1, STEEL[2]); rr(g, bx - 1, by, 3, 4, t[3], 1); g.px(bx - 1, by + 1, t[5]); }); post = (g) => { for (let i = 0; i < 6; i++) { const bx = 3 + i * 5, by = 7 + Math.round(Math.sin((bx / (w - 1)) * Math.PI) * 4); lampGlow(g, bx, by, 4, X(['#ff8a80', '#fff0a0', '#a0e0ff', '#c0ffa0', '#ffc0e0', '#ffd0a0'][i])); } }; break; }
      case 'Lifesaver': { const t = T('#f4f0e6'); g.line(8, 2, 8, 6, X('#d9c9a0')); g.px(8, 1, STEEL[3]); circle(g, 8, 15, 7.4, t[2]); circle(g, 7.6, 14.6, 6.8, t[4]); for (let j = 7; j < 23; j++) for (let i = 0; i < 16; i++) { const d = Math.hypot(i + 0.5 - 8, j + 0.5 - 15); if (d < 7.4 && d > 3 && (Math.abs(i + 0.5 - 8) < 1.6 || Math.abs(j + 0.5 - 15) < 1.6)) g.px(i, j, RED[3]); if (d <= 3) clearPx(g, i, j); } g.px(4, 10, X('#ffffff')); g.px(5, 9, X('#ffffff')); break; }
      case 'Light Switch': { const t = T('#f1ece0'); rr(g, 4, 10, 8, 12, t[3], 1); g.hline(5, 10, 6, t[5]); g.vline(11, 11, 10, t[2]); g.hline(5, 21, 6, t[1]); g.rect(7, 13, 2, 6, t[1]); g.rect(7, 13, 2, 3, t[5]); g.px(8, 11, STEEL[2]); g.px(8, 20, STEEL[2]); break; }
      case 'Outlet': { const t = T('#f1ece0'); rr(g, 4, 30, 8, 12, t[3], 1); g.hline(5, 30, 6, t[5]); g.vline(11, 31, 10, t[2]); g.hline(5, 41, 6, t[1]); for (const oy of [32, 37]) { rr(g, 6, oy, 4, 4, t[2], 1); g.px(7, oy + 1, INK); g.px(8, oy + 1, INK); g.px(7, oy + 3, INK); } break; }
      case "Miner's Crest": {
        const t = T('#5a6a80');
        for (let j = 0; j < 26; j++) { const k = j < 12 ? 12 : Math.max(0, 12 - Math.round((j - 12) * 0.9)); g.hline(16 - k, 3 + j, 2 * k, t[j < 2 ? 4 : 3]); if (k > 1) { g.rect(16 - k, 3 + j, 2, 1, GOLD[4]); g.rect(14 + k, 3 + j, 2, 1, GOLD[2]); } } g.rect(4, 3, 24, 2, GOLD[4]); g.hline(4, 3, 24, GOLD[5]);
        for (const d of [1, -1]) { g.line(16 - d * 8, 22, 16 + d * 7, 8, oak[3]); g.line(16 - d * 8 + 1, 22, 16 + d * 7 + 1, 8, oak[2]); for (let a = -4; a <= 4; a++) { const hx = 16 + d * 7 + a * (d > 0 ? 1 : -1) * 0.9 + d * Math.abs(a) * 0.3, hy = 8 + a * 0.9 - Math.abs(a) * -0.4; g.rect(hx, hy, 2, 2, STEEL[a < 0 ? 5 : 3]); } }
        circle(g, 16, 22, 2.6, T('#6fe0f0')[3]); g.px(15, 21, X('#ffffff')); g.px(16, 6, GOLD[5]);
        break;
      }
      case 'Model Planes': { const plane = (px0: number, py: number, col: string, flip: boolean) => { const t = T(col); g.vline(px0 + 7, 0, py, X('#8a8a90')); stamp(g, px0, py, ['......ww......', '......ww......', 'p.....ww......', 'pp..bbbbbbbb..', 'ppbbbbbbbbbbbn', 'pp..bbbbbbbb..', '....wwwwww....', '.....wwww.....'], { b: t[3], w: t[4], p: t[2], n: X('#f6dc5a') }, flip); g.px(px0 + (flip ? 3 : 10), py + 4, X('#cfe8ff')); g.hline(px0 + 5, py + 6, 4, t[5]); }; plane(2, 8, '#cf463f', false); plane(16, 22, '#4f7fd6', true); plane(4, 36, '#4fa651', false); break; }
      case 'Monster Danglers': { string(2, 2); const xs = [4, 11, 18, 26]; xs.forEach((dx, i) => { const top = 3 + Math.round(Math.sin((dx / (w - 1)) * Math.PI) * 2); g.vline(dx, top, 3, X('#5a4a3a')); if (i === 0) { circle(g, dx + 0.5, top + 6.5, 3, X('#f4f0e6')); circle(g, dx + 0.5, top + 7, 1.5, T('#cf463f')[3]); g.px(dx, top + 7, INK); } else if (i === 1) { const t = T('#5fc07a'); rr(g, dx - 3, top + 4, 7, 6, t[3], 2); g.px(dx - 1, top + 6, INK); g.px(dx + 1, top + 6, INK); g.px(dx - 2, top + 5, t[5]); } else if (i === 2) { const t = T('#5a4a6a'); stamp(g, dx - 4, top + 4, ['#..#.#..#', '####.####', '.#######.', '..##o##..', '...###...'], { '#': t[3], o: X('#f6dc5a') }); } else { icon(g, 'skull', dx + 0.5, top + 7, X('#f4f0e6')); } }); break; }
      case 'Moonlight Jellies Banner': { g.rect(1, 2, 30, 2, wood[3]); g.hline(1, 2, 30, wood[5]); const t = T('#27336a'); g.rect(3, 4, 26, 24, t[3]); g.rect(3, 22, 26, 6, T('#1f2a5a')[3]); for (let i = 3; i < 29; i += 4) { g.rect(i, 28, 2, 2, t[3]); } sunD(g, 24, 9, 2.6, '#f4eeb0'); for (const [jx, jy, col] of [[9, 12, '#6fe0f0'], [17, 18, '#b0f0ff'], [23, 21, '#8ae0c0'], [8, 22, '#b98af0']] as [number, number, string][]) { const jt = T(col); rr(g, jx - 2, jy - 2, 5, 3, jt[4], 1); g.px(jx - 1, jy - 2, X('#ffffff')); for (const dx of [-2, 0, 2]) { g.px(jx + dx, jy + 1, jt[3]); g.px(jx + dx + (dx ? 0 : 0), jy + 2, jt[2]); } } for (const [sx, sy] of [[6, 7], [14, 8], [19, 6], [27, 15]]) g.px(sx, sy, X('#ffffff')); ring(g, 3, 4, 26, 24, GOLD[3]); break; }
      case 'Mounted Trout': { g.ellipse(24, 16, 22, 12, wood[2]); g.ellipse(24, 15.5, 21, 11, wood[3]); g.ellipse(22, 12, 15, 5, wood[4]); const t = T('#7a9a6a'); g.ellipse(22, 16, 13, 5.5, t[3]); g.ellipse(21, 14, 10, 3, t[4]); g.ellipse(22, 19, 10, 2.4, T('#f2c8b0')[3]); for (let j = 0; j < 6; j++) { g.vline(35 + j, 15 - j, 2 * j + 2, t[2]); } g.hline(12, 17, 20, T('#e86a7a')[3]); for (let i = 14; i < 32; i += 3) g.px(i, 14 + (i % 2), t[1]); g.px(12, 15, INK); g.px(11, 14, X('#ffffff')); g.line(9, 18, 12, 18, t[1]); for (let k = 0; k < 4; k++) g.hline(20 + k, 10 - k + 1, 6 - k, t[2]); g.rect(21, 21, 4, 2, t[2]); g.rect(20, 25, 9, 2, GOLD[4]); g.hline(21, 26, 7, GOLD[2]); break; }
      case 'Night Sky Decal #1': { icon(g, 'moon', 8, 10, X('#f4eeb0')); g.ellipse(8, 10, 5, 6, X('#f4eeb0')); g.ellipse(10.5, 9, 4.6, 5.4, [0, 0, 0, 0]); for (let j = 3; j < 17; j++) for (let i = 4; i < 16; i++) if (((i + 0.5 - 10.5) / 4.6) ** 2 + ((j + 0.5 - 9) / 5.4) ** 2 <= 1) clearPx(g, i, j); icon(g, 'star5', 11, 22, GOLD[4]); icon(g, 'cross', 4, 26, X('#ffffff')); icon(g, 'cross', 12, 5, X('#ffffff')); break; }
      case 'Night Sky Decal #2': { const t = T('#e8a05a'); circle(g, 8, 13, 5, t[3]); g.ellipse(7, 11, 3, 2, t[4]); g.hline(4, 14, 8, t[2]); for (let i = 0; i < 16; i++) { const yy = 13 + Math.round((i - 8) * -0.35); if (Math.abs(i - 8) > 5 || yy > 13) g.px(i, yy + 1, T('#b98af0')[4]); } icon(g, 'star5', 4, 24, GOLD[4]); icon(g, 'cross', 12, 26, X('#ffffff')); icon(g, 'cross', 3, 5, X('#ffffff')); break; }
      case 'Night Sky Decal #3': { icon(g, 'star', 5, 22, GOLD[4]); g.px(5, 21, X('#ffffff')); for (let k = 0; k < 14; k++) { g.px(7 + k * 0.55, 19 - k, X(k < 5 ? '#fff0a0' : k < 10 ? '#f6c85a' : '#e8a05a')); if (k < 9) g.px(9 + k * 0.55, 20 - k, X('#f6dc8a')); } icon(g, 'cross', 3, 8, X('#ffffff')); icon(g, 'cross', 12, 27, X('#bfe1ef')); break; }
      case 'Palm Wall Ornament': { const tr = T('#a8875a'); for (let j = 6; j < 14; j++) { g.rect(7 + (j > 10 ? 1 : 0), j, 2, 1, tr[3]); if (j % 2) g.px(7 + (j > 10 ? 1 : 0), j, tr[1]); } for (const [dx, dy, dr] of [[-6, -2, 4], [6, -2, 4], [-4, -4, 2], [4, -4, 2], [0, -5, 0]]) frond(g, 8, 6, dx, dy, dr, dx < 0 ? LEAF : T('#2f8a4a'), 1); g.rect(4, 14, 9, 1, T('#e6cf96')[3]); break; }
      case "Pierre's Sign": { g.rect(4, 2, 2, 5, STEEL[3]); g.rect(26, 2, 2, 5, STEEL[2]); g.hline(3, 1, 26, STEEL[4]); rr(g, 2, 7, 28, 20, wood[3], 2); g.hline(4, 7, 24, wood[5]); g.hline(4, 26, 24, wood[1]); rr(g, 4, 9, 24, 16, T('#f1e6c8')[3], 1); const b2 = T('#4f7fd6'); g.rect(7, 11, 2, 12, b2[3]); g.rect(9, 11, 4, 2, b2[3]); g.rect(9, 16, 4, 2, b2[3]); g.rect(12, 12, 2, 5, b2[3]); circle(g, 21, 18, 3.6, RED[3]); g.px(19, 16, RED[5]); g.px(21, 14, wal[3]); g.px(22, 13, LEAF[3]); g.px(23, 13, LEAF[4]); g.hline(16, 23, 10, wal[3]); break; }
      case 'Pirate Flag': { g.rect(2, 2, 2, 28, wal[3]); g.vline(2, 2, 28, wal[5]); g.px(2, 1, GOLD[4]); g.px(3, 1, GOLD[3]); const t = T('#2f2a36'); for (let i = 0; i < 26; i++) { const off = Math.round(Math.sin(i / 4) * 1.5); g.vline(4 + i, 4 + off, 18, t[3]); g.px(4 + i, 4 + off, t[5]); g.px(4 + i, 21 + off, t[1]); } for (let j = 6; j < 22; j += 4) clearPx(g, 29, j); icon(g, 'skull', 17, 11, X('#f1ece0')); g.line(11, 16, 23, 20, X('#f1ece0')); g.line(23, 16, 11, 20, X('#f1ece0')); break; }
      case 'Pyramid Decal': { sunD(g, 23, 8, 4, '#f9d54a', 8, '#f6a03a'); const t = T('#e0b060'); for (let j = 0; j < 17; j++) { const k = j; g.hline(13 - k * 0.75, 9 + j, k * 1.5 + 1, t[3]); g.hline(13 + k * 0.2, 9 + j, k * 0.55 + 1, t[2]); if (j % 4 === 3) g.hline(13 - k * 0.75, 9 + j, k * 0.95, t[4]); } for (let j = 0; j < 9; j++) { g.hline(25 - j * 0.7, 17 + j, j * 1.4 + 1, t[4]); g.hline(25 + j * 0.2, 17 + j, j * 0.5 + 1, t[2]); } g.rect(1, 26, 30, 2, T('#d8b274')[2]); g.rect(4, 22, 2, 4, LEAF[3]); g.px(3, 23, LEAF[3]); g.px(6, 24, LEAF[2]); break; }
      case 'S. Wall Flower': case 'Wall Flower': {
        const small = n[0] === 'S', t = small ? T('#6fa0d2') : CLAY, by = small ? 30 : 34;
        g.rect(7, 2, 2, 4, STEEL[3]); g.px(6, 5, STEEL[2]); g.px(9, 5, STEEL[2]);
        for (let j = 0; j < 8; j++) { const k = 5 - Math.floor(j / 2.5); g.hline(8 - k, by + j, 2 * k, t[3]); g.px(8 - k, by + j, t[5]); g.px(7 + k, by + j, t[1]); } g.hline(2, by, 12, t[4]);
        const fl = small ? ['#f6dc5a', '#ffffff'] : ['#e8506a', '#ee8fb6', '#b98af0'];
        const top = small ? 14 : 8;
        for (let i = 0; i < (small ? 4 : 6); i++) { const fx = 3 + ((i * 5) % 11), fy = top + ((i * 7) % (by - top - 5)); g.line(8, by, fx, fy + 2, LEAF[2]); g.px(fx + 1, fy + 4, LEAF[4]); circle(g, fx + 0.5, fy + 0.5, 2.2, X(fl[i % fl.length])); g.px(fx, fy, X('#f6a03a')); }
        for (const [vx, len] of small ? [[3, 6]] : [[2, 9], [13, 7]]) for (let j = 0; j < len; j++) g.px(vx + (j % 3 === 2 ? 1 : 0), by + 2 + j, LEAF[j % 2 ? 3 : 4]);
        break;
      }
      case 'Small Wall Pumpkin': case 'Wall Pumpkin': {
        const small = /Small/.test(n), t = T('#e8873a'), r = small ? 5 : 7, py = small ? 16 : 15;
        g.vline(8, 2, py - r - 3, X('#8a7a5a')); g.rect(7, py - r - 2, 2, 3, T('#4f7a3a')[3]); g.px(9, py - r - 2, T('#4f7a3a')[4]);
        g.ellipse(8, py, r, r * 0.85, t[2]); g.ellipse(5.5, py, r * 0.55, r * 0.8, t[3]); g.ellipse(10.5, py, r * 0.55, r * 0.8, t[3]); g.ellipse(8, py, r * 0.4, r * 0.85, t[4]); g.px(5, py - r + 2, t[5]);
        if (!small) { g.px(5, 13, INK); g.px(6, 13, INK); g.px(5, 14, INK); g.px(10, 13, INK); g.px(11, 13, INK); g.px(11, 14, INK); for (let i = 4; i < 12; i++) g.px(i, 18 - (i % 2), X('#3a1a10')); g.hline(5, 18, 6, X('#f9c23c')); }
        break;
      }
      case 'Starport Decal': { g.rect(2, 26, 28, 3, STEEL[2]); g.hline(2, 26, 28, STEEL[4]); g.rect(5, 6, 2, 20, STEEL[3]); for (let j = 8; j < 26; j += 4) { g.hline(5, j, 6, STEEL[2]); g.line(5, j, 9, j + 3, STEEL[2]); } g.rect(9, 6, 1, 20, STEEL[2]); const t = T('#e3e6ea'); rr(g, 13, 7, 8, 16, t[3], 2); for (let j = 0; j < 5; j++) g.hline(17 - j, 3 + j, 2 * j, RED[j < 2 ? 4 : 3]); g.vline(13, 9, 13, t[5]); g.vline(20, 9, 13, t[1]); circle(g, 17, 12, 2, T('#6fc0f0')[3]); g.px(16, 11, X('#ffffff')); g.rect(13, 17, 8, 2, RED[3]); g.rect(11, 20, 2, 5, RED[3]); g.rect(21, 20, 2, 5, RED[2]); g.rect(15, 23, 4, 2, STEEL[1]); for (const [sx, sy] of [[26, 5], [28, 12], [24, 16], [2, 3]]) icon(g, 'cross', sx, sy, GOLD[4]); break; }
      case 'Strawberry Decal': { const t = T('#e03a4a'); for (let j = 0; j < 19; j++) { const k = j < 6 ? 7 + j * 0.6 : 10.5 - (j - 6) * 0.8; g.hline(16 - k, 9 + j, 2 * k, t[3]); g.hline(16 - k, 9 + j, k * 0.6, t[4]); g.hline(16 + k * 0.6, 9 + j, k * 0.4, t[2]); } for (let j = 12; j < 25; j += 4) for (let i = 9 + ((j >> 2) % 2) * 2; i < 24; i += 4) if (g.alpha(i, j)) g.px(i, j, X('#f6dc8a')); for (const [dx, dy] of [[-6, 0], [-3, -2], [0, 1], [3, -2], [6, 0], [0, -4]]) { g.rect(16 + dx - 2, 7 + dy, 4, 3, LEAF[3]); g.px(16 + dx - 1, 7 + dy, LEAF[5]); } g.rect(15, 2, 2, 4, LEAF[2]); g.px(10, 12, X('#ffffff')); g.px(9, 14, X('#ffffff')); break; }
      case 'Wall Basket': { const t = T('#c9a06a'); circle(g, 16, 16, 13, t[2]); circle(g, 15.6, 15.6, 12, t[3]); for (const r of [10, 7, 4]) { for (let a = 0; a < 40; a++) { const an = (a / 40) * 6.283; g.px(15.5 + Math.cos(an) * r, 15.5 + Math.sin(an) * r, a % 2 ? t[1] : t[4]); } } circle(g, 16, 16, 2, T('#8a5a34')[3]); for (let a = 0; a < 24; a++) { const an = (a / 24) * 6.283; g.px(15.5 + Math.cos(an) * 12.6, 15.5 + Math.sin(an) * 12.6, a % 3 ? T('#b03a3a')[3] : T('#3aa79f')[3]); } g.px(9, 8, t[5]); g.px(8, 10, t[5]); break; }
      case 'Wall Cactus': { for (let j = 0; j < 5; j++) { const k = 4 - Math.floor(j / 2); g.hline(8 - k, 10 + j, 2 * k, CLAY[3]); g.px(8 - k, 10 + j, CLAY[5]); g.px(7 + k, 10 + j, CLAY[1]); } g.hline(3, 10, 10, CLAY[4]); const ct = T('#4f9a55'); rr(g, 6, 2, 4, 8, ct[3], 1); g.vline(7, 3, 6, ct[5]); g.rect(3, 5, 2, 3, ct[3]); g.px(5, 7, ct[3]); g.rect(11, 4, 2, 3, ct[2]); g.px(10, 6, ct[2]); g.px(8, 1, T('#ee8fb6')[3]); break; }
      case 'Wall Clock': { rr(g, 3, 2, 10, 27, wal[3], 2); g.hline(5, 2, 6, wal[5]); g.vline(3, 4, 23, wal[4]); g.vline(12, 4, 23, wal[2]); circle(g, 8, 9, 4.6, GOLD[3]); circle(g, 8, 9, 3.8, X('#fbf7ee')); g.vline(8, 6, 3, INK); g.hline(8, 9, 2, INK); for (const [dx, dy] of [[0, -3], [3, 0], [0, 3], [-3, 0]]) g.px(7.5 + dx + 0.5, 9 + dy - 0.5, X('#8a2f2f')); g.rect(5, 16, 6, 11, X('#3a2630')); g.vline(8, 16, 7, GOLD[3]); circle(g, 8.5, 24, 1.8, GOLD[4]); g.px(8, 23, GOLD[5]); g.px(7, 1, GOLD[4]); g.px(8, 1, GOLD[3]); break; }
      case 'Wall Palm': { const d = T('#2f8a4a'); g.rect(7, 40, 2, 6, T('#a8875a')[3]); g.vline(8, 6, 36, d[2]); g.vline(7, 6, 36, LEAF[3]); for (let j = 4; j < 40; j += 3) { const len = Math.round(3 + Math.sin(((j - 4) / 36) * Math.PI) * 3); for (let k = 1; k <= len; k++) { g.px(7 - k, j + Math.round(k * 0.6), k % 2 ? LEAF[4] : LEAF[3]); g.px(8 + k, j + Math.round(k * 0.6), k % 2 ? d[3] : d[2]); } } g.px(7, 3, LEAF[5]); g.px(8, 4, LEAF[3]); g.px(7, 5, LEAF[4]); break; }
      case 'Wall Sconce': { const t = T('#5a5560'); g.rect(6, 20, 4, 6, t[3]); g.vline(6, 20, 6, t[5]); g.hline(4, 18, 8, t[4]); g.hline(4, 19, 8, t[2]); g.rect(5, 14, 6, 4, GOLD[3]); g.hline(5, 14, 6, GOLD[5]); g.hline(6, 17, 4, GOLD[1]); g.px(7, 26, t[2]); g.px(8, 27, t[2]); g.rect(7, 11, 2, 3, WHITE[4]); post = (g) => { flame(g, 'm', 8.5, 10); lampGlow(g, 8, 8, 9); }; break; }
      case 'Wallflower Pal': { const pe = T('#f6c83a'); for (let a = 0; a < 10; a++) circle(g, 16 + Math.cos(a * 0.628) * 9, 13 + Math.sin(a * 0.628) * 9, 3.6, pe[a % 2 ? 3 : 4]); const fc = T('#8a5a34'); circle(g, 16, 13, 7, fc[3]); g.ellipse(14.5, 11, 4, 3, fc[4]); g.rect(13, 11, 2, 3, INK); g.rect(18, 11, 2, 3, INK); g.px(13, 11, X('#ffffff')); g.px(18, 11, X('#ffffff')); g.hline(14, 16, 5, INK); g.px(13, 15, INK); g.px(19, 15, INK); g.px(11, 14, T('#f08a8a')[3]); g.px(21, 14, T('#f08a8a')[3]); g.rect(15, 23, 2, 7, LEAF[3]); g.rect(11, 25, 4, 2, LEAF[4]); g.rect(17, 27, 4, 2, LEAF[2]); break; }
      case 'Winter Tree Decal': { g.rect(7, 25, 2, 4, T('#6b4530')[3]); pine(g, 8, 4, 25, 7, T('#3f7168'), 6); for (let j = 4; j < 26; j++) for (let i = 0; i < 16; i++) if (g.alpha(i, j) && (j - 4) % 6 === 0 && g.alpha(i, j - 1) === 0) g.px(i, j, X('#f4f8fb')); for (const [sx, sy] of [[7, 5], [8, 5], [5, 10], [6, 10], [9, 16], [4, 16], [10, 22], [5, 22]]) g.px(sx, sy, X('#f4f8fb')); g.hline(3, 29, 10, X('#e8f4fb')); for (const [sx, sy] of [[2, 6], [13, 9], [1, 18], [14, 20]]) g.px(sx, sy, X('#ffffff')); break; }
      default: { rr(g, 2, 2, w - 4, h - 4, wood[3], 2); g.hline(4, 2, w - 8, wood[5]); icon(g, 'star5', cx, cy, GOLD[4]); }
    }
  }, { shadow: false, post: (g) => post?.(g) });
};

