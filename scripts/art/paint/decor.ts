/** Hand-designed world sprites: statues, signs, decor, fences, gates and ground tiles. */
import { mix } from '../png';
import { groundShadow, hash, hex, Img, OUTLINE, SHADOW, stamp, tones } from './kit';
import type { Ctx, Painter, Pal, RGBA, Season, Tones } from './kit';

// ------------------------------------------------------------------------------------------------ toolkit

type Col = string | RGBA;
const rgb = (c: Col): RGBA => (typeof c === 'string' ? hex(c) : c);

/**
 * Palette for stamps. Each color you pass becomes a 5-step ramp (dark -> highlight) on a fixed key set:
 * 1st: 12345, 2nd: abcde, 3rd: ABCDE, 4th: vwxyz, 5th: VWXYZ, 6th: lmnpq.
 * Fixed keys: o outline, k near-black, # warm white, + cream.
 */
const KEYS = ['12345', 'abcde', 'ABCDE', 'vwxyz', 'VWXYZ', 'lmnpq'];
function P(...cols: Col[]): Pal {
  const pal: Pal = { o: OUTLINE, k: hex('#1d1420'), '#': hex('#fff8e8'), '+': hex('#f1dfb8') };
  cols.forEach((c, i) => {
    // a leading "!" gives a deeper ramp, for saturated things whose fill must not look washed out
    const deep = typeof c === 'string' && c[0] === '!';
    const t = tones(deep ? (c as string).slice(1) : c);
    const ramp = deep ? [t[1], t[2], mix(t[2], t[3], 0.5), t[3], t[4]] : [t[1], t[2], t[3], t[4], t[5]];
    [...KEYS[i]].forEach((ch, j) => { pal[ch] = ramp[j]; });
  });
  return pal;
}

/** Outline in a dark version of the neighbor color, so that every material keeps its own hue at the rim. */
function rim(t: Img, strength = 0.72) {
  const marks: [number, number, RGBA][] = [];
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
    if (t.alpha(x, y) > 0) continue;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      if (t.alpha(x + dx, y + dy) > 128) {
        const n = t.get(x + dx, y + dy);
        const m = mix(n, OUTLINE, strength); m[3] = 255;
        marks.push([x, y, m]);
        break;
      }
    }
  }
  for (const [x, y, m] of marks) t.px(x, y, m);
}

type SpriteOpt = { shadow?: boolean; line?: boolean };
/** Draws on a private layer, adds the rim and a ground shadow, then puts the layer into the box. */
function sprite(img: Img, x: number, y: number, w: number, h: number, draw: (t: Img) => void, o: SpriteOpt = {}) {
  const t = new Img(w, h);
  draw(t);
  if (o.line !== false) rim(t);
  const b = t.bounds();
  if (b && o.shadow !== false) groundShadow(img, x + b.x + b.w / 2, y + b.y + b.h - 1, Math.max(2, b.w / 2 - 0.5), 2);
  img.blit(t, x, y);
}

/** Puts a grid on a layer: centered, standing on the bottom (1 px is kept free for the rim). */
function put(t: Img, rows: string[], pal: Pal, dx = 0, lift = 1) {
  const gw = Math.max(...rows.map((r) => r.length));
  stamp(t, Math.floor((t.w - gw) / 2) + dx, t.h - rows.length - lift, rows, pal);
}

/** A whole sprite from one grid. */
function art(img: Img, x: number, y: number, w: number, h: number, rows: string[], pal: Pal, o: SpriteOpt & { dx?: number; lift?: number } = {}) {
  sprite(img, x, y, w, h, (t) => put(t, rows, pal, o.dx ?? 0, o.lift ?? 1), o);
}

const has = (c: Ctx, re: RegExp) => re.test(c.name);

// ------------------------------------------------------------------------------------------------ fences

const WOOD = '#c8924f';
const HARDWOOD = '#7d4528';
const STONE = '#9da3a6';
const IRON = '#5d6373';

function fenceMaterial(name: string): 'wood' | 'stone' | 'iron' | 'hard' {
  return /iron/i.test(name) ? 'iron' : /stone/i.test(name) ? 'stone' : /hardwood/i.test(name) ? 'hard' : 'wood';
}

/** One wooden board: light left edge, dark right edge. */
function board(t: Img, x0: number, wd: number, top: number, bot: number, T: Tones, pointed = false) {
  for (let i = 0; i < wd; i++) t.vline(x0 + i, top, bot - top + 1, i === 0 ? T[4] : i === wd - 1 && wd > 2 ? T[2] : T[3]);
  if (pointed) t.px(x0 + Math.floor((wd - 1) / 2), top - 1, T[4]);
}

/** Stone wall pattern, periodic over the 16 px tile. rr = row below the wall top. */
function wallPx(x: number, rr: number, T: Tones): RGBA {
  if (rr === 0) return x === 12 || x === 13 || x === 3 ? hex('#7fa650') : T[5];
  const course = rr <= 2 ? 0 : rr <= 6 ? 1 : 2;
  if (rr === 3 || rr === 7) return T[1];
  const joints = [[2, 13], [15, 7], [3, 11]][course];
  if (joints.includes(x)) return T[1];
  const first = rr === 1 || rr === 4 || rr === 8;
  const id = joints.filter((j) => x > j).length + course * 3;
  const dark = hash(id, 7, 3) < 0.4;
  if (rr === 10) return T[2];
  return first ? (dark ? T[3] : T[4]) : dark ? T[2] : T[3];
}

const fence: Painter = (img, x, y, w, h, c) => {
  const m = c.mask ?? 10;
  const mat = fenceMaterial(c.name);
  const B = h - 3; // lowest row of the post
  const N = m & 1, E = m & 2, S = m & 4, W = m & 8;
  const t = new Img(w, h);
  const sides: [number, (i: number) => number][] = [];
  if (E) sides.push([2, (i) => 10 + i]);
  if (W) sides.push([8, (i) => 5 - i]);

  if (mat === 'wood') {
    const T = tones(WOOD);
    const sep = mix(T[1], OUTLINE, 0.55);
    if (N) { t.vline(7, 0, B - 15, T[3]); t.vline(8, 0, B - 15, T[1]); for (const r of [1, 5]) { t.rect(6, r + 1, 4, 2, T[3]); t.px(6, r + 1, T[4]); t.px(9, r + 1, T[2]); t.px(9, r + 2, T[2]); t.px(7, r, T[5]); t.px(8, r, T[4]); } }
    for (const [, X] of sides) {
      const lo = Math.min(X(1), X(3));
      t.vline(X(0), B - 11, 11, sep);
      board(t, lo, 3, B - 11, B - 1, T, true);
      t.vline(X(4), B - 10, 10, sep);
      t.vline(X(5), B - 10, 10, X(5) === 15 ? T[4] : T[2]);
      // rails show as two darker bands with nails
      for (const ry of [B - 8, B - 3]) { t.hline(lo, ry, 3, T[2]); t.px(lo + 1, ry, T[1]); t.px(X(5), ry, T[2]); }
    }
    t.rect(6, B - 14, 4, 15, T[3]); t.vline(6, B - 14, 15, T[4]); t.vline(9, B - 14, 15, T[2]);
    t.hline(6, B - 14, 4, T[5]); t.hline(7, B - 15, 2, T[5]);
    t.hline(6, B, 4, T[2]);
    for (const ry of [B - 8, B - 3]) t.px(8, ry, T[2]);
    if (S) { t.rect(6, B + 1, 4, h - B - 1, T[3]); t.vline(6, B + 1, h - B - 1, T[4]); t.vline(9, B + 1, h - B - 1, T[2]); }
    rim(t);
  } else if (mat === 'hard') {
    const T = tones(HARDWOOD);
    if (N) { t.rect(6, 0, 4, B - 13, T[2]); t.vline(6, 0, B - 13, T[3]); t.vline(9, 0, B - 13, T[1]); for (let r = 2; r < B - 13; r += 5) t.hline(6, r, 4, T[1]); }
    for (const [, X] of sides) {
      const lo = Math.min(X(0), X(5));
      for (const ry of [B - 11, B - 5]) { t.rect(lo, ry, 6, 3, T[3]); t.hline(lo, ry, 6, T[4]); t.hline(lo, ry + 2, 6, T[2]); t.px(X(3), ry + 1, T[2]); t.px(X(4), ry + 1, T[2]); }
    }
    t.rect(5, B - 13, 6, 14, T[3]); t.vline(5, B - 13, 14, T[4]); t.vline(10, B - 13, 14, T[1]); t.vline(9, B - 13, 14, T[2]);
    t.rect(4, B - 15, 8, 2, T[4]); t.hline(4, B - 15, 8, T[5]); t.hline(4, B - 13, 8, T[1]);
    t.px(7, B - 8, T[2]); t.px(7, B - 7, T[2]); t.px(8, B - 3, T[2]);
    for (const ry of [B - 10, B - 4]) { t.px(6, ry, T[5]); t.px(9, ry, T[1]); }
    if (S) { t.rect(5, B + 1, 6, h - B - 1, T[3]); t.vline(5, B + 1, h - B - 1, T[4]); t.vline(10, B + 1, h - B - 1, T[1]); }
    rim(t);
  } else if (mat === 'stone') {
    const T = tones(STONE);
    if (N) for (let r = 0; r < B - 13; r++) for (let i = 6; i <= 9; i++) t.px(i, r, r % 3 === 2 ? T[1] : i === 6 ? T[4] : i === 9 ? T[2] : (i === 7 && r % 6 < 3) || (i === 8 && r % 6 >= 3) ? T[2] : T[3]);
    for (const [bit] of sides) for (let i = 0; i < 5; i++) { const px = bit === 2 ? 11 + i : i; for (let rr = 0; rr <= 10; rr++) t.px(px, B - 10 + rr, wallPx(px, rr, T)); }
    for (let r = B - 13; r <= B; r++) for (let i = 5; i <= 10; i++) {
      const rr = r - (B - 13);
      t.px(i, r, rr % 5 === 4 && r < B ? T[1] : i === 5 ? T[4] : i === 10 ? T[1] : i === 9 ? T[2] : (rr % 10 < 5 ? i === 7 : i === 8) && rr % 5 < 4 ? T[2] : T[3]);
    }
    t.rect(4, B - 15, 8, 2, T[4]); t.hline(4, B - 15, 8, T[5]); t.hline(4, B - 13, 8, T[1]); t.px(11, B - 14, T[2]);
    if (S) { t.rect(5, B + 1, 6, h - B - 1, T[3]); t.vline(5, B + 1, h - B - 1, T[4]); t.vline(10, B + 1, h - B - 1, T[1]); }
    rim(t);
  } else {
    const T = tones(IRON);
    // post with a ball finial
    t.rect(7, B - 12, 2, 13, T[3]); t.vline(7, B - 12, 13, T[4]); t.rect(6, B - 1, 4, 2, T[2]); t.hline(6, B - 1, 4, T[4]);
    t.rect(6, B - 15, 4, 3, T[3]); t.px(6, B - 15, [0, 0, 0, 0]); t.hline(7, B - 16, 2, T[4]); t.px(7, B - 15, T[5]); t.px(9, B - 13, T[1]); t.px(8, B - 13, T[2]);
    if (S) t.rect(7, B + 1, 2, h - B - 1, T[2]);
    rim(t, 0.8);
    const bar = T[1], dark = mix(T[0], OUTLINE, 0.5);
    if (N) { t.vline(7, 0, B - 16, T[2]); t.vline(8, 0, B - 16, dark); for (let r = 1; r < B - 17; r += 3) t.px(7, r, T[5]); }
    for (const [, X] of sides) {
      const lo = Math.min(X(0), X(5));
      for (const bx of [X(1), X(4)]) { t.vline(bx, B - 11, 11, bar); t.px(bx, B - 12, T[4]); t.px(bx, B - 13, T[5]); t.px(bx, B, dark); }
      for (const ry of [B - 9, B - 2]) { t.hline(lo, ry, 6, T[3]); t.hline(lo, ry + 1, 6, dark); t.px(X(1), ry, T[5]); t.px(X(4), ry, T[5]); }
    }
  }
  if (!S) img.ellipse(x + 8, y + B + 0.5, mat === 'iron' ? 3 : 4.5, 1.6, SHADOW);
  for (const [bit] of sides) img.hline(x + (bit === 2 ? 10 : 0), y + B + 1, 6, SHADOW);
  img.blit(t, x, y);
};

const gate: Painter = (img, x, y, w, h, c) => {
  const B = h - 3;
  const kind = has(c, /iron/i) ? 'iron' : has(c, /stone/i) ? 'stone' : has(c, /hardwood/i) ? 'hard' : has(c, /wood/i) ? 'wood' : 'plain';
  sprite(img, x, y, w, h, (t) => {
    const post = (T: Tones, px: number, top: number) => { t.rect(px, top, 3, B - top + 1, T[3]); t.vline(px, top, B - top + 1, T[4]); t.vline(px + 2, top, B - top + 1, T[2]); t.hline(px, top, 3, T[5]); t.hline(px, B, 3, T[2]); };
    if (kind === 'plain') {
      const T = tones('#efe8dc');
      // whitewashed open frame gate with a cross brace
      t.line(5, B - 8, 10, B - 3, T[2]);
      for (const ry of [B - 10, B - 2]) { t.rect(3, ry, 10, 2, T[3]); t.hline(3, ry, 10, T[5]); }
      t.rect(3, B - 10, 2, 10, T[3]); t.vline(3, B - 10, 10, T[4]);
      t.rect(11, B - 10, 2, 10, T[3]); t.vline(12, B - 10, 10, T[2]);
      post(T, 0, B - 13); post(T, 13, B - 13);
      t.px(10, B - 6, hex('#e8e0d0')); t.px(10, B - 5, hex('#8a8690'));
    } else if (kind === 'wood') {
      const T = tones('#dcaa66'), sep = mix(T[1], OUTLINE, 0.55);
      // picket gate with a dipped top
      t.rect(3, B - 9, 10, 9, sep);
      board(t, 4, 2, B - 11, B - 1, T, true); board(t, 7, 2, B - 9, B - 1, T); board(t, 10, 2, B - 11, B - 1, T, true);
      for (const ry of [B - 7, B - 2]) { t.hline(4, ry, 2, T[2]); t.hline(7, ry, 2, T[2]); t.hline(10, ry, 2, T[2]); }
      t.px(11, B - 6, hex('#f2d35b')); t.px(11, B - 5, hex('#b58a2c'));
      post(T, 0, B - 14); post(T, 13, B - 14); t.px(1, B - 15, T[5]); t.px(14, B - 15, T[5]);
    } else if (kind === 'hard') {
      const T = tones(HARDWOOD), M = tones('#8f96a3');
      t.rect(3, B - 11, 10, 11, T[3]); t.hline(3, B - 11, 10, T[4]);
      for (const sx of [5, 8, 10]) t.vline(sx, B - 10, 10, T[1]);
      t.line(4, B - 8, 11, B - 3, T[4]); t.rect(3, B - 9, 10, 1, T[2]); t.rect(3, B - 2, 10, 1, T[2]);
      t.hline(3, B - 9, 3, M[3]); t.hline(3, B - 2, 3, M[3]); t.px(3, B - 9, M[5]); t.px(3, B - 2, M[5]);
      t.px(11, B - 6, M[5]); t.px(11, B - 5, M[2]);
      post(T, 0, B - 14); post(T, 13, B - 14);
      t.hline(0, B - 14, 3, T[5]); t.hline(13, B - 14, 3, T[5]);
    } else if (kind === 'stone') {
      const T = tones(STONE), Wd = tones('#a8703a'), M = tones('#6b7180');
      // wooden door with a round top between stone pillars
      t.rect(3, B - 10, 10, 10, Wd[3]); t.rect(4, B - 11, 8, 1, Wd[4]); t.rect(5, B - 12, 6, 1, Wd[4]);
      for (const sx of [5, 8, 10]) t.vline(sx, B - 10, 10, Wd[1]);
      t.vline(3, B - 10, 10, Wd[4]);
      for (const ry of [B - 8, B - 3]) { t.hline(3, ry, 10, M[2]); t.hline(3, ry - 1, 10, M[4]); }
      t.px(10, B - 5, hex('#f2d35b'));
      for (const px of [0, 13]) {
        for (let r = B - 13; r <= B; r++) for (let i = 0; i < 3; i++) t.px(px + i, r, (r - B + 13) % 5 === 4 && r < B ? T[1] : i === 0 ? T[4] : i === 2 ? T[2] : T[3]);
        t.hline(px, B - 14, 3, T[5]);
      }
    } else {
      const T = tones(IRON), dark = mix(T[0], OUTLINE, 0.5);
      const tops: [number, number][] = [[4, B - 10], [6, B - 12], [9, B - 12], [11, B - 10]];
      for (const [bx, top] of tops) { t.vline(bx, top, B - top, T[2]); t.px(bx, top - 1, T[5]); }
      t.rect(7, B - 13, 2, 13, T[3]); t.vline(7, B - 13, 13, T[4]); t.hline(7, B - 14, 2, T[5]);
      for (const ry of [B - 8, B - 2]) { t.hline(3, ry, 10, T[4]); t.hline(3, ry + 1, 10, dark); }
      t.rect(7, B - 6, 2, 2, hex('#f2d35b')); t.px(8, B - 5, hex('#b58a2c'));
      for (const px of [1, 13]) { t.rect(px, B - 12, 2, 13, T[3]); t.vline(px, B - 12, 13, T[4]); t.rect(px, B - 15, 2, 2, T[4]); t.px(px, B - 15, T[5]); t.hline(px - (px === 1 ? 1 : 0), B, 3, T[2]); }
    }
  });
};

// ------------------------------------------------------------------------------------------------ ground tiles

type TileFn = (i: number, j: number, v: number, c: Ctx) => RGBA | null;
const tilePainter = (f: (c: Ctx) => TileFn): Painter => (img, x, y, _w, _h, c) => {
  const fn = f(c), v = (c.variant ?? 0) & 3;
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const p = fn(i, j, v, c); if (p) img.px(x + i, y + j, p); }
};

/** Voronoi cells on a 16 px torus. Returns the cell id and whether the pixel is in the gap between cells. */
function cells(seeds: [number, number][], gapW: number) {
  const at = (i: number, j: number) => {
    let d1 = 1e9, d2 = 1e9, id = 0;
    seeds.forEach(([sx, sy], k) => {
      let dx = Math.abs(i + 0.5 - sx), dy = Math.abs(j + 0.5 - sy);
      dx = Math.min(dx, 16 - dx); dy = Math.min(dy, 16 - dy);
      const d = Math.sqrt(dx * dx + dy * dy * 1.15);
      if (d < d1) { d2 = d1; d1 = d; id = k; } else if (d < d2) d2 = d;
    });
    return { id, gap: d2 - d1 < gapW };
  };
  const grid: { id: number; gap: boolean }[][] = [];
  for (let j = 0; j < 16; j++) { grid.push([]); for (let i = 0; i < 16; i++) grid[j].push(at(i, j)); }
  return (i: number, j: number) => grid[(j + 16) & 15][(i + 16) & 15];
}

const COBBLE = cells([[3, 2.5], [10.5, 1.5], [15, 6.5], [6.5, 7.5], [1.5, 11], [11, 12], [6, 14.5]], 1.2);
const PAVERS = cells([[3.5, 3], [11.5, 2], [7, 8.5], [15, 9], [3, 13.5], [11, 14]], 1.3);
const SHARDS = cells([[3, 2.5], [10.5, 3.5], [15, 8], [6.5, 9], [2, 14], [11, 13.5]], 1.15);

/** Shades a Voronoi stone: light at its top-left rim, dark at its bottom-right rim. */
function stonePx(C: ReturnType<typeof cells>, i: number, j: number, T: Tones, gap: RGBA | null, tone: number): RGBA | null {
  const p = C(i, j);
  if (p.gap) return gap;
  const up = C(i, j - 1), lf = C(i - 1, j), dn = C(i, j + 1), rt = C(i + 1, j);
  if (up.gap || lf.gap) return T[Math.min(5, tone + 1)];
  if (dn.gap || rt.gap) return T[Math.max(1, tone - 1)];
  return T[tone];
}

const FLAGS: [number, number, number, number][][] = [
  [[0, 0, 10, 8], [10, 0, 6, 8], [0, 8, 6, 8], [6, 8, 10, 8]],
  [[0, 0, 8, 5], [0, 5, 8, 11], [8, 0, 8, 11], [8, 11, 8, 5]],
  [[0, 0, 6, 10], [6, 0, 10, 5], [6, 5, 10, 5], [0, 10, 9, 6], [9, 10, 7, 6]],
  [[0, 0, 9, 9], [9, 0, 7, 4], [9, 4, 7, 5], [0, 9, 5, 7], [5, 9, 11, 7]],
];

const floorFns: Record<string, (c: Ctx) => TileFn> = {
  wood: () => {
    const T = tones('#bd8444'), alt = mix(T[3], T[2], 0.35), gapC = mix(T[1], T[0], 0.3);
    return (i, j, v) => {
      const r = j & 3, row = j >> 2;
      if (r === 3) return gapC;
      const jx = 2 + Math.floor(hash(row, v, 11) * 12);
      if (i === jx) return gapC;
      const sx = 1 + Math.floor(hash(row, v, 5) * 9), sr = 1 + Math.floor(hash(row, v, 6) * 2);
      if (r === sr && i >= sx && i < sx + 4 && i !== jx) return T[2];
      if (r === 0) return T[4];
      return row & 1 ? alt : T[3];
    };
  },
  rustic: () => {
    const T = tones('#80542f'), gapC = mix(T[1], T[0], 0.6);
    return (i, j, v) => {
      const r = j & 7, row = j >> 3;
      if (r === 7) return gapC;
      const jx = 3 + Math.floor(hash(row, v, 21) * 10);
      if (i === jx) return gapC;
      if ((i === jx - 2 || i === jx + 2) && (r === 1 || r === 5)) return T[0];
      const kx = 2 + Math.floor(hash(row, v, 23) * 11);
      if (Math.abs(i - kx) <= 1 && r === 3 && Math.abs(kx - jx) > 3) return i === kx ? T[1] : T[2];
      if (r === 0) return T[4];
      if (r === 6) return T[2];
      const g = hash(i >> 2, j, 31 + v * 0);
      return (r === 2 || r === 4) && hash((i + row * 5) >> 2, r + row * 8, 3) < 0.45 ? T[2] : g < 0 ? T[2] : T[3];
    };
  },
  weathered: () => {
    const T = tones('#94897a'), gapC = mix(T[1], T[0], 0.5);
    return (i, j, v) => {
      const r = i & 3, col = i >> 2;
      if (r === 3) return gapC;
      const jy = 2 + Math.floor(hash(col, v, 41) * 12);
      if (j === jy) return gapC;
      // a crack: short dark streak along the board
      const cy = 1 + Math.floor(hash(col, v, 43) * 9);
      if (r === 1 && j >= cy && j < cy + 4 && j !== jy && hash(col, v, 44) < 0.7) return T[1];
      if (r === 0) return col & 1 ? T[4] : T[5];
      if (r === 2) return T[2];
      return col & 1 ? T[3] : mix(T[3], T[4], 0.5);
    };
  },
  crystal: () => {
    const T = tones('#8fd6e6');
    return (i, j, v) => {
      const a = (i + j) & 7, b = (i - j) & 7;
      const gx = [4, 11, 3, 12][v], gy = [3, 5, 11, 12][v];
      if ((i === gx && Math.abs(j - gy) <= 1) || (j === gy && Math.abs(i - gx) <= 1)) return hex('#ffffff');
      if (b === 0) return hex('#f2fdff');
      if (a === 7) return T[2];
      return a < 3 ? (b >= 4 ? T[5] : T[4]) : b >= 4 ? T[4] : T[3];
    };
  },
  straw: () => {
    const T = tones('#dcb650');
    return (i, j, v) => {
      const horiz = (((i >> 2) + (j >> 2)) & 1) === 0;
      const a = horiz ? j & 3 : i & 3, b = horiz ? i & 3 : j & 3;
      if (hash(i, j, 50 + v) < 0.035 && b !== 3) return T[1];
      if (b === 3) return a & 1 ? T[2] : T[1];
      if (b === 0) return a & 1 ? T[4] : T[5];
      return a & 1 ? T[3] : T[4];
    };
  },
  brick: () => {
    const T = tones('#b9573d'), mortar = hex('#d8c3a0'), mortarD = hex('#b99f7c');
    return (i, j, v) => {
      const r = j & 3, row = j >> 2;
      if (r === 3) return i & 1 ? mortar : mortarD;
      const bx = (i + (row & 1 ? 4 : 0)) & 15;
      if ((bx & 7) === 7) return mortar;
      const wraps = row & 1 && bx >> 3 === 1;
      const k = hash(bx >> 3, row, wraps ? 60 : 61 + v);
      const tone = k < 0.25 ? 2 : k < 0.8 ? 3 : 4;
      if (r === 0) return T[Math.min(5, tone + 1)];
      if (r === 2 && (bx & 7) > 0) return T[tone - 1];
      return T[tone];
    };
  },
  stone: () => {
    const T = tones('#9aa1ad'), mortar = mix(T[1], T[0], 0.4);
    return (i, j, v) => {
      const rects = FLAGS[v];
      const k = rects.findIndex(([rx, ry, rw, rh]) => i >= rx && i < rx + rw && j >= ry && j < ry + rh);
      const [rx, ry, rw, rh] = rects[k];
      if (i === rx + rw - 1 || j === ry + rh - 1) return mortar;
      const tone = hash(k, v, 71) < 0.5 ? 3 : 4;
      if (i === rx || j === ry) return T[tone + 1];
      if (i === rx + rw - 2 || j === ry + rh - 2) return T[tone - 1];
      if (hash(i, j, 73 + v) < 0.05) return T[tone - 1];
      return T[tone];
    };
  },
  walkway: () => {
    const T = tones('#cdb689'), gap = hex('#8f7a58');
    return (i, j, v) => stonePx(PAVERS, i, j, T, gap, hash(PAVERS(i, j).id, v, 81) < 0.5 ? 3 : 4);
  },
};

const floor: Painter = (img, x, y, w, h, c) => {
  const n = c.name.toLowerCase();
  const key = n.includes('rustic') ? 'rustic' : n.includes('weathered') ? 'weathered' : n.includes('crystal') ? 'crystal' : n.includes('straw') ? 'straw'
    : n.includes('brick') ? 'brick' : n.includes('walkway') ? 'walkway' : n.includes('stone') ? 'stone' : 'wood';
  tilePainter(floorFns[key])(img, x, y, w, h, c);
};

const pathFns: Record<string, (c: Ctx) => TileFn> = {
  gravel: () => {
    const T = tones('#aaa293');
    return (i, j, v) => {
      // pebbles: a light pixel pair with a dark pixel under it, on a coarse hashed grid
      const gx = Math.floor(i / 4), gy = Math.floor(j / 4);
      const px = gx * 4 + Math.floor(hash(gx, gy, 90 + v) * 3), py = gy * 4 + Math.floor(hash(gx, gy, 91 + v) * 3);
      const big = hash(gx, gy, 92 + v) < 0.6;
      if (j === py && (i === px || (big && i === px + 1))) return T[5];
      if (j === py + 1 && (i === px || (big && i === px + 1))) return T[2];
      return hash(i >> 1, j, 93) < 0.07 ? T[4] : T[3];
    };
  },
  wood: () => {
    const T = tones('#d2a868'), gapC = mix(T[1], T[0], 0.35);
    return (i, j, v) => {
      const r = j & 7, row = j >> 3;
      const jx = 3 + Math.floor(hash(row, v, 101) * 10);
      // worn corners at the board ends let the ground show through
      if ((i === jx || i === jx - 1 || i === jx + 1) && (r === 0 || r === 6) && i !== jx) return null;
      if (r === 7) return i === jx ? null : gapC;
      if (i === jx) return gapC;
      if (r === 0) return T[5];
      if (r === 6) return T[2];
      if (i === jx + 1) return T[5];
      if (i === jx - 1) return T[2];
      const sx = 1 + Math.floor(hash(row, v, 103) * 10);
      if (r === 3 && i >= sx && i < sx + 4) return T[2];
      return r < 3 ? T[4] : T[3];
    };
  },
  crystal: () => {
    const T = tones('#c98fe6'), gap = hex('#6a3f9a');
    return (i, j, v) => {
      const p = SHARDS(i, j);
      if (p.gap) return gap;
      const gx = [6, 10, 3, 11][v], gy = [9, 3, 13, 13][v];
      if (i === gx && j === gy) return hex('#ffffff');
      const up = SHARDS(i, j - 1), lf = SHARDS(i - 1, j), dn = SHARDS(i, j + 1), rt = SHARDS(i + 1, j);
      if (up.gap || lf.gap) return T[5];
      if (dn.gap || rt.gap) return T[2];
      // facet: a diagonal split through each shard
      return ((i * 2 + j + p.id * 5) & 7) < 4 ? T[4] : T[3];
    };
  },
  cobble: () => {
    const T = tones('#989ba3'), gap = hex('#514d57');
    return (i, j, v) => stonePx(COBBLE, i, j, T, gap, hash(COBBLE(i, j).id, v, 111) < 0.4 ? 3 : 4);
  },
  stepping: () => {
    const T = tones('#a9a8a0'), edge = mix(T[1], OUTLINE, 0.45);
    const shapes: [number, number, number, number][][] = [
      [[7.5, 7.5, 5.6, 4.6]], [[6, 6.5, 4.6, 3.8], [12, 12, 2.4, 1.9]], [[8.5, 8, 5.2, 4.9]], [[9, 8.5, 4.8, 3.8], [3.5, 3.5, 2.3, 1.8]],
    ];
    const inside = (i: number, j: number, v: number, grow = 0) => shapes[v].some(([cx, cy, rx, ry]) => ((i + 0.5 - cx) / (rx + grow)) ** 2 + ((j + 0.5 - cy) / (ry + grow)) ** 2 <= 1);
    return (i, j, v) => {
      if (!inside(i, j, v)) return inside(i, j, v, 1) ? (inside(i, j - 1, v) ? edge : inside(i - 1, j, v) || inside(i + 1, j, v) || inside(i, j + 1, v) ? edge : null) : null;
      if (!inside(i, j - 1, v) || !inside(i - 1, j, v)) return T[5];
      if (!inside(i, j + 1, v) || !inside(i + 1, j, v)) return T[2];
      return hash(i, j, 120 + v) < 0.08 ? T[3] : T[4];
    };
  },
};

const path: Painter = (img, x, y, w, h, c) => {
  const n = c.name.toLowerCase();
  const key = n.includes('gravel') ? 'gravel' : n.includes('crystal') ? 'crystal' : n.includes('cobble') ? 'cobble' : n.includes('stepping') ? 'stepping' : 'wood';
  tilePainter(pathFns[key])(img, x, y, w, h, c);
};

const soil = (wet: boolean): Painter => tilePainter(() => {
  const T = tones(wet ? '#4f3526' : '#7a4f2c');
  const glint = hex(wet ? '#8fa3c9' : '#a87a48');
  return (i, j, v) => {
    const r = j & 3, row = j >> 2;
    // clods: small bumps that differ per variant, kept away from the tile edge
    const cx = 2 + Math.floor(hash(row, v, 131) * 11), on = hash(row, v, 132) < 0.75;
    if (on && r === 1 && (i === cx || i === cx + 1)) return wet ? glint : T[5];
    if (on && r === 2 && (i === cx || i === cx + 1)) return T[1];
    if (r === 0) return hash(i >> 1, row, 133) < (wet ? 0.3 : 0.2) ? (wet ? glint : T[5]) : T[4];
    if (r === 1) return T[3];
    if (r === 2) return T[2];
    return wet ? mix(T[1], T[0], 0.5) : T[1];
  };
});

const grass = (blue: boolean): Painter => (img, x, y, _w, _h, c) => {
  const v = (c.variant ?? 0) & 3;
  const green: Record<Season, string> = { spring: '#3fa536', summer: '#2f8f3a', fall: '#c98f24', winter: '#8fb9c9' };
  const teal: Record<Season, string> = { spring: '#2796c0', summer: '#2488bc', fall: '#4f78c8', winter: '#8fb0e0' };
  const T = tones((blue ? teal : green)[c.season]);
  const t = new Img(16, 16);
  // three clumps of curved blades that fan out from one root; back clumps first
  const clumps: [number, number][] = [
    [3 + Math.floor(hash(0, v, 141) * 3), 8 + Math.floor(hash(0, v, 142) * 2)],
    [11 + Math.floor(hash(1, v, 141) * 2), 9 + Math.floor(hash(1, v, 142) * 3)],
    [6 + Math.floor(hash(2, v, 141) * 4), 14 + Math.floor(hash(2, v, 142) * 2)],
  ];
  clumps.forEach(([bx, by], n) => {
    for (let k = 0; k < 5; k++) {
      // outer blades first, so the tall middle blade sits in front
      const ln = [0, 4, 1, 3, 2][k] - 2, L = 5 + Math.floor(hash(ln + 2, n * 7 + v, 143) * 3) - Math.abs(ln) + (ln === 0 ? 2 : 0);
      for (let s2 = 0; s2 <= L; s2++) {
        const f = s2 / L;
        // blades bend outward more near the tip; the lower half is two pixels wide
        const px = Math.round(bx + ln * 0.6 + ln * 1.5 * f * f), py = by - s2;
        const col = s2 === 0 ? T[1] : f < 0.35 ? T[2] : s2 === L ? (ln <= 0 ? T[5] : T[4]) : ln < 0 ? T[4] : T[3];
        t.px(px, py, col);
        if (f < 0.5 && ln !== 0) t.px(px - Math.sign(ln), py, f < 0.35 ? T[1] : T[2]);
      }
    }
    t.hline(bx - 2, by, 5, T[1]);
    if (blue) { t.px(bx, by - 4, hex('#bff2ff')); t.px(bx - 2, by - 2, hex('#bff2ff')); }
    else if (c.season === 'winter') { t.px(bx, by - 5, hex('#ffffff')); t.px(bx + 2, by - 3, hex('#ffffff')); }
  });
  img.blit(t, x, y);
};

// ------------------------------------------------------------------------------------------------ figure helpers

const darkerKey = (ch: string) => { for (const k of KEYS) { const i = k.indexOf(ch); if (i >= 0) return k[Math.max(0, i - 1)]; } return ch; };
/**
 * Mirrors a half grid to a full, symmetric grid. With odd = true the last column is the shared center column.
 * The two outer pixels of the right half get one tone darker, so the light still comes from the left.
 */
function mir(half: string[], odd = true): string[] {
  const n = half[0].length;
  return half.map((L) => {
    if (L.length !== n) throw new Error(`mir: row "${L}" is not ${n} wide`);
    const R = [...L].reverse().slice(odd ? 1 : 0);
    let seen = 0;
    for (let i = R.length - 1; i >= 0; i--) if (R[i] !== '.') { if (seen < 2) R[i] = darkerKey(R[i]); seen++; }
    return L + R.join('');
  });
}

/** Small plinth at the bottom of a layer. Figures stand on it with lift = hgt + 1. */
function plinth(t: Img, wd: number, col: Col, hgt = 3) {
  const T = tones(col), x0 = Math.floor((t.w - wd) / 2), y0 = t.h - 1 - hgt;
  t.rect(x0, y0, wd, hgt, T[3]); t.hline(x0, y0, wd, T[5]); t.hline(x0, y0 + hgt - 1, wd, T[2]); t.vline(x0 + wd - 1, y0 + 1, hgt - 1, T[2]); t.px(x0, y0 + 1, T[4]);
}

/**
 * A view of a layer that scales the geometry (not the pixels) around (cx, by), so that a figure built from
 * shapes can be made larger and still be drawn at real pixel size.
 */
function zoom(t: Img, k: number, cx: number, by: number): Img {
  const X = (v: number) => Math.round(cx + (v - cx) * k), Y = (v: number) => Math.round(by + (v - by) * k);
  const z = {
    w: t.w, h: t.h,
    px: (x: number, y: number, c: RGBA) => t.px(X(x), Y(y), c),
    rect: (x: number, y: number, w: number, h: number, c: RGBA) => t.rect(X(x), Y(y), Math.max(1, Math.ceil(w * k)), Math.max(1, Math.ceil(h * k)), c),
    hline: (x: number, y: number, w: number, c: RGBA) => t.rect(X(x), Y(y), Math.max(1, Math.ceil(w * k)), 1, c),
    vline: (x: number, y: number, h: number, c: RGBA) => t.rect(X(x), Y(y), 1, Math.max(1, Math.ceil(h * k)), c),
    line: (x0: number, y0: number, x1: number, y1: number, c: RGBA) => t.line(X(x0), Y(y0), X(x1), Y(y1), c),
    ellipse: (ex: number, ey: number, rx: number, ry: number, c: RGBA) => t.ellipse(cx + (ex - cx) * k, by + (ey - by) * k, rx * k, ry * k, c),
  };
  return z as unknown as Img;
}

/** Round shaded body on a layer. */
function orb(t: Img, cx: number, cy: number, rx: number, ry: number, T: Tones) {
  t.ellipse(cx, cy, rx, ry, T[2]);
  t.ellipse(cx - rx * 0.1, cy - ry * 0.12, rx * 0.88, ry * 0.86, T[3]);
  t.ellipse(cx - rx * 0.28, cy - ry * 0.32, rx * 0.5, ry * 0.45, T[4]);
  if (rx >= 3) t.px(Math.round(cx - rx * 0.45), Math.round(cy - ry * 0.5), T[5]);
}

/** Clay pot with a wider rim; returns the row of the rim top. */
function pot(t: Img, cx: number, bottom: number, wd: number, hgt: number, col: Col) {
  const T = tones(col), x0 = cx - Math.floor(wd / 2);
  for (let r = 0; r < hgt; r++) {
    const inset = r === 0 || r === 1 ? 0 : r >= hgt - 2 ? 2 : 1;
    const yy = bottom - hgt + 1 + r;
    for (let i = inset; i < wd - inset; i++) t.px(x0 + i, yy, r === 0 ? T[5] : i === inset ? T[4] : i >= wd - inset - 2 ? T[2] : r === 1 ? T[4] : T[3]);
  }
  t.hline(x0 + 1, bottom - hgt + 3, wd - 2, T[1]);
  return bottom - hgt + 1;
}

// ------------------------------------------------------------------------------------------------ statues

const STONE_FIG = '#a9adab';
const statue: Painter = (img, x, y, w, h, c) => {
  const n = c.name.toLowerCase();
  const fig = (rows: string[], pal: Pal, ped: Col | null = '#8d9294', pedW = 12) =>
    sprite(img, x, y, w, h, (t) => { if (ped) plinth(t, pedW, ped); put(t, rows, pal, 0, ped ? 4 : 1); });
  const S = P(STONE_FIG, '#58b83e');

  if (n.includes('owl')) return fig(mir(['.5.....', '.54.444', '.455555', '4522255', '452k255', '4522251', '.455511', '.445555', '4435555', '4435353', '4435535', '.435353', '.443555', '..44444', '...2.2.']), S);
  if (n.includes('frog')) return fig(mir(['..54...', '.5k54..', '.455444', '4555555', '4211111', '4455555', '.445555', '4434455', '443.333']), P('#9db39a'), '#8d9294', 14);
  if (n.includes('junimo')) return fig(mir(['....b.5', '.....c4', '......3', '...4555', '..45555', '.455555', '.45k555', '.45k555', '4455555', '.455555', '.445555', '..44444', '...3...']), S);
  if (n.includes('parrot')) return fig(['..45.5....', '..4555....', '.455555...', '.45k55222.', '.4555522..', '.445552...', '.444555...', '.4445555..', '..444555..', '..3444555.', '...344455.', '...3.3445.', '......344.', '.......34.'], P('#b3ad9c'));
  if (n.includes('obelisk')) return sprite(img, x, y, w, h, (t) => {
    const T = tones('#5d6a86'), G = hex('#7fe6ea'), B = t.h - 2;
    t.rect(3, B - 2, 10, 3, T[3]); t.hline(3, B - 2, 10, T[5]); t.hline(3, B, 10, T[2]);
    t.rect(4, B - 4, 8, 2, T[3]); t.hline(4, B - 4, 8, T[4]);
    for (let r = 5; r <= B - 5; r++) { const wd = r < B - 12 ? 4 : 6, x0 = 8 - wd / 2; t.hline(x0, r, wd, T[3]); t.px(x0, r, T[5]); t.px(x0 + 1, r, T[4]); t.px(x0 + wd - 1, r, T[2]); }
    t.hline(7, 2, 2, hex('#ffe680')); t.hline(7, 3, 2, hex('#f2c33d')); t.hline(6, 4, 4, hex('#f2c33d')); t.px(9, 4, hex('#b9862a'));
    for (const [gx, gy] of [[7, 8], [8, 9], [7, 11], [8, 14], [7, 15], [8, 15], [7, 18], [8, 19], [7, 20]]) t.px(gx, gy, G);
  });
  if (n.includes('capsule')) {
    const empty = n.includes('empty');
    const rows = mir(['...344', '..3455', '..2333', '..cdee', '.cdeee', '.cdeek', '.cdekk', '.cdeek', '.cdekk', '.cdeek', '.cddee', '..2333', '.34555', '.23444']);
    const pal = P('#7c8696', empty ? '#b9d2cf' : '#62d6a8');
    if (empty) { pal.k = pal.e; }
    return sprite(img, x, y, w, h, (t) => { put(t, rows, pal); if (empty) { t.px(9, t.h - 9, pal.c as RGBA); t.px(10, t.h - 8, pal.c as RGBA); t.px(9, t.h - 7, pal.c as RGBA); } else { t.px(8, t.h - 10, hex('#e94b6a')); } t.px(5, t.h - 11, hex('#ffffff')); t.px(5, t.h - 10, hex('#ffffff')); });
  }
  if (n.includes('lewis')) return fig(mir(['...4555', '..45555', '.444444', '...4555', '...4k55', '...4555', '..11115', '...4555', '..44552', '.455525', '45.4525', '45.4525', '.4.4555', '...2222', '...455.', '...455.', '..4455.']), P('!#f2bd2e'), '#6b4a34', 12);
  if (n.includes('trophy')) return fig(mir(['.555555', '4444555', '4.4455#', '4.44555', '.444455', '...3455', '....345', '.....34', '.....34', '....344', '...3444', '..bbbbb', '..bcccc']), P('#f0bf30', '#7a4a2c'), null);
  if (n.includes('skeleton')) return fig(mir(['....455', '...4555', '...4k55', '...4555', '....4k4', '......4', '..44444', '.4.4444', '.4...k4', '.4.4444', '.4...k4', '.4.4444', '.4....4', '...4444', '...4...', '...4...', '...4...', '..44...']), P('#e9e2cc'), '#6b4a34', 12);
  if (n.includes('armor')) return fig(mir(['......c', '.....cd', '....345', '...3455', '...4kkk', '...4455', '.445555', '4554455', '45.4555', '45.4455', '.4.3333', '...455.', '...45..', '...45..', '..445..']), P('#a9b4c6', '#d8433e'), '#6b4a34', 12);
  if (n.includes('flamingo')) {
    sprite(img, x, y, w, h, (t) => put(t, ['.455.....', '45k5.....', 'kk45.....', '..45.....', '..45.....', '...45....', '...4555..', '..455555.', '..4555554', '..3445543', '...33444.'], P('#f58fae'), 0, 7), { shadow: false });
    img.ellipse(x + 8, y + h - 2, 3, 1.4, SHADOW);
    img.vline(x + 8, y + h - 8, 7, hex('#3a2a34')); img.vline(x + 10, y + h - 8, 3, hex('#3a2a34')); img.px(x + 9, y + h - 5, hex('#3a2a34'));
    return;
  }
  if (n.includes('grave')) return fig(mir(['...4555', '..45555', '.455555', '.452225', '.455555', '.455225', '.455555', '.455555', '.445555', '.c45555', 'cdc4d55']), S, null);
  if (n.includes('pedestal')) return fig(mir(['..ccccc', '.bddddd', '.455555', '.344444', '..34555', '..34555', '..34555', '..34555', '..34555', '.344555', '.455555', '3444444']), P('#dcd6ca', '#c8404a'), null);
  if (n.includes('slime')) return sprite(img, x, y, w, h, (t) => {
    const T = tones('#62cf4c'), B = t.h - 2;
    t.ellipse(8, B - 1, 6.5, 1.8, T[2]); t.px(2, B, T[2]); t.px(13, B - 1, T[3]);
    orb(t, 8, B - 6, 5.6, 5.4, T);
    t.rect(5, B - 10, 2, 2, hex('#f4ffe8')); t.px(7, B - 11, hex('#f4ffe8')); t.px(10, B - 3, T[5]); t.px(11, B - 4, T[5]);
  });
  if (n.includes('teddy')) return fig(mir(['.45.444', '.455555', '..45555', '..4k555', '..455+k', '..445++', '.445555', '4455bbb', '445b+++', '445b+k+', '445b++k', '.45b+++', '.445bbb', '4444555', '.444.44']), P('#b57c48', GOLD), null);
  if (n.includes('bunny')) return fig(mir(['..45...', '..4c5..', '..4c5..', '..4c5..', '..45555', '.455555', '.45k555', '.45555c', '..45555', '.445555', '4455555', '4455555', '.445555', '444.444']), P('#f3eee6', '#f2a0b4'), null);
  if (n.includes('plant')) return sprite(img, x, y, w, h, (t) => {
    const B = t.h - 2, s = c.season;
    const L = tones({ spring: '#58b146', summer: '#3f9a3c', fall: '#d9822b', winter: '#7fa39a' }[s]);
    pot(t, 8, B, 10, 7, '#c2673f');
    orb(t, 8, B - 12, 6.2, 6.2, L);
    for (const [lx, ly] of [[4, B - 9], [12, B - 10], [3, B - 14], [8, B - 18], [12, B - 15]]) t.px(lx, ly, L[2]);
    const dot = { spring: '#ff9ac2', summer: '#ffe04a', fall: '#c7372f', winter: '#ffffff' }[s];
    const dots: [number, number][] = [[5, B - 15], [10, B - 16], [7, B - 11], [11, B - 11], [8, B - 14]];
    for (const [dx, dy] of dots) { t.px(dx, dy, hex(dot)); if (s === 'spring' || s === 'summer') { t.px(dx + 1, dy, hex(dot)); t.px(dx, dy - 1, hex(dot)); t.px(dx, dy + 1, hex(s === 'spring' ? '#e0608f' : '#e09a1a')); } }
    if (s === 'winter') { t.hline(5, B - 18, 6, hex('#ffffff')); t.hline(4, B - 17, 3, hex('#ffffff')); t.px(10, B - 17, hex('#e8f4ff')); t.px(6, B - 10, hex('#d8433e')); t.px(10, B - 13, hex('#d8433e')); }
  });
  if (n.includes('decor')) return sprite(img, x, y, w, h, (t) => {
    const B = t.h - 2, s = c.season;
    if (s === 'spring') { // painted egg in a nest
      const T = tones('#f4a6c8');
      orb(t, 8, B - 8, 4.6, 6, T);
      for (let i = 4; i <= 11; i++) { t.px(i, B - 8 + (i & 1), hex('#6fc8e8')); t.px(i, B - 11 + (i & 1), hex('#fff3a0')); }
      t.px(4, B - 8, T[3]); t.px(12, B - 8, T[2]);
      const N = tones('#b98a4a'); t.rect(2, B - 2, 12, 3, N[3]); for (let i = 2; i < 14; i++) t.px(i, B - 3 + (i % 3 === 0 ? 0 : 1), i & 1 ? N[5] : N[2]); t.hline(3, B, 10, N[2]);
    } else if (s === 'summer') { // sun ornament on a stick
      const T = tones('#ffcf3a');
      t.rect(7, B - 8, 2, 9, hex('#8a5a34')); t.vline(7, B - 8, 9, hex('#b98048'));
      for (const [dx, dy] of [[0, -8], [0, 8], [-8, 0], [8, 0], [-6, -6], [6, -6], [-6, 6], [6, 6]]) t.line(8 + Math.sign(dx) * 0, B - 15, 8 + dx * 0.9, B - 15 + dy * 0.9, T[3]);
      orb(t, 8, B - 15, 4.6, 4.6, T);
      t.px(6, B - 16, hex('#7a4a1c')); t.px(9, B - 16, hex('#7a4a1c')); t.hline(6, B - 13, 4, hex('#c8642a')); t.px(6, B - 14, hex('#c8642a')); t.px(9, B - 14, hex('#c8642a'));
    } else if (s === 'fall') { // pumpkin
      const T = tones('#ee8a2a');
      orb(t, 8, B - 5, 6.4, 5.2, T);
      for (const rx of [5, 8, 11]) for (let r = B - 9; r <= B - 1; r++) if (t.alpha(rx, r)) t.px(rx, r, T[2]);
      t.rect(7, B - 13, 2, 3, hex('#5f8a3a')); t.px(9, B - 13, hex('#5f8a3a')); t.px(7, B - 13, hex('#8fbf55'));
      t.px(5, B - 6, hex('#3a2418')); t.px(6, B - 6, hex('#3a2418')); t.px(10, B - 6, hex('#3a2418')); t.px(11, B - 6, hex('#3a2418'));
      t.hline(6, B - 3, 5, hex('#3a2418')); t.px(5, B - 4, hex('#3a2418')); t.px(11, B - 4, hex('#3a2418'));
    } else { // snowman
      const T = tones('#eef3f8');
      orb(t, 8, B - 4, 5.6, 4.8, T); orb(t, 8, B - 12, 4, 3.8, T);
      t.rect(5, B - 17, 6, 1, hex('#2e2a3a')); t.rect(6, B - 21, 4, 4, hex('#3d3850')); t.hline(6, B - 18, 4, hex('#d8433e')); t.vline(6, B - 21, 3, hex('#5a5470'));
      t.px(7, B - 13, hex('#2e2a3a')); t.px(10, B - 13, hex('#2e2a3a')); t.hline(8, B - 11, 3, hex('#f08a2a'));
      t.hline(5, B - 9, 7, hex('#d8433e')); t.vline(10, B - 8, 3, hex('#b02e36')); t.px(8, B - 6, hex('#2e2a3a')); t.px(8, B - 3, hex('#2e2a3a'));
    }
  });
  return fig(mir(['...4555', '..45555', '..45555', '...4444', '.445555', '4455555', '.445555', '..44444']), S);
};

// ------------------------------------------------------------------------------------------------ signs and blocks

const sign: Painter = (img, x, y, w, h, c) => {
  const n = c.name.toLowerCase();
  sprite(img, x, y, w, h, (t) => {
    const B = t.h - 2;
    if (n.includes('stone')) {
      const T = tones('#a4a8a8');
      // a standing slab with a round top and carved lines
      t.rect(2, B - 11, 12, 12, T[3]); t.rect(3, B - 13, 10, 2, T[3]); t.hline(4, B - 14, 8, T[4]);
      t.hline(3, B - 13, 10, T[5]); t.vline(2, B - 11, 11, T[5]); t.vline(13, B - 11, 12, T[2]); t.hline(2, B, 12, T[2]); t.px(12, B - 13, T[2]);
      for (const [ly, lw] of [[B - 10, 8], [B - 7, 6], [B - 4, 8]]) { t.hline(4, ly, lw, T[1]); t.hline(4, ly + 1, lw, T[5]); }
      t.px(2, B, hex('#6fa64a')); t.px(3, B, hex('#6fa64a')); t.px(2, B - 1, hex('#8fc45a'));
      return;
    }
    const dark = n.includes('dark'), text = n.includes('text');
    const T = tones(dark ? '#5a3d33' : '#c79552'), Pst = tones(dark ? '#3f2a26' : '#8f5f33');
    t.rect(7, B - 7, 2, 8, Pst[3]); t.vline(7, B - 7, 8, Pst[4]);
    const top = B - 16;
    t.rect(1, top, 14, 10, T[3]); t.hline(1, top, 14, T[5]); t.vline(1, top, 10, T[4]); t.hline(1, top + 9, 14, T[2]); t.vline(14, top, 10, T[2]);
    if (text) {
      // paper sheet with writing, pinned on the board
      t.rect(3, top + 1, 10, 8, hex('#f7efd8')); t.hline(3, top + 8, 10, hex('#d8caa6')); t.vline(12, top + 1, 8, hex('#d8caa6'));
      for (const [ly, lw] of [[top + 2, 7], [top + 4, 8], [top + 6, 5]]) t.hline(4, ly, lw, hex('#5a4a52'));
      t.px(8, top + 1, hex('#d8433e'));
    } else if (dark) {
      t.rect(3, top + 2, 10, 6, T[2]); t.hline(3, top + 2, 10, T[1]); t.vline(3, top + 2, 6, T[1]);
      for (const [cx2, cy2] of [[1, top], [14, top], [1, top + 9], [14, top + 9]]) t.px(cx2, cy2, hex('#f2c33d'));
      t.hline(5, top + 4, 6, hex('#f2c33d')); t.hline(5, top + 6, 4, hex('#c9962c'));
    } else {
      t.hline(2, top + 3, 12, T[2]); t.hline(2, top + 6, 12, T[2]); t.hline(2, top + 4, 12, T[4]); t.hline(2, top + 7, 12, T[4]);
      for (const [nx, ny] of [[2, top + 1], [13, top + 1], [2, top + 8], [13, top + 8]]) t.px(nx, ny, T[1]);
    }
  });
};

const block: Painter = (img, x, y, w, h, c) => {
  if (/drum/i.test(c.name)) return art(img, x, y, w, h, mir(['..+++++', '.++++##', 'bcddddd', '4a5555a', '45a55a5', '455aa55', '45a55a5', 'bcddddd', '.bccccc']), P('#c9453c', '#e8b63a'));
  return art(img, x, y, w, h, ['.de..........', '.cd..........', '.cd.de.......', '.cd.cd.......', '.cd.cd.de....', '.cd.cd.cd....', '.cd.cd.cd.de.', 'ABBBBBBBBBBBA', '.cd.cd.cd.cd.', '4555555555553', '45k55k55k5542', '3444444444432'], P('#b9804a', '#e6cf86', '#d8443e'));
};

// ------------------------------------------------------------------------------------------------ decor

type Draw = (t: Img, c: Ctx) => void;
const WD = '#a8703a';
const GOLD = '#ecb93a';
const BONE = '#e6dec6';
const JOJA = '#3f6fd2';
const LEAF = '#58b83e';
const WHITE = hex('#ffffff');

/** Grid drawer: g(rows, palette) stands the grid on the floor; plinthCol adds a small base under it. */
const g = (rows: string[], pal: Pal, plinthCol: Col | null = null, plinthW = 12, dx = 0): Draw => (t) => {
  if (plinthCol) plinth(t, plinthW, plinthCol);
  put(t, rows, pal, dx, plinthCol ? 4 : 1);
};

const COLORS: Record<string, string> = {
  blue: '#4a7fe0', brown: '#9a6238', green: '#4fae4a', purple: '#9a5fd6', red: '#d8443e', yellow: '#f0c83a', orange: '#f08a2e', gray: '#9aa0a8',
  amethyst: '#a968e0', aquamarine: '#4fd0d6', emerald: '#3fc06a', ruby: '#e2445a', topaz: '#f2b838', dark: '#4a3f52',
};
const colorOf = (name: string, d = '#8fb8e8') => { const k = Object.keys(COLORS).find((key) => name.toLowerCase().includes(key)); return k ? COLORS[k] : d; };

const bookUp = (col: string): Draw => g(['45555+.', '45555++', '4bb55++', '45555++', '45555++', '45555++', '4bb55++', '45555++', '34444+.'], P('!' + col, GOLD));
const bookFlat = (col: string): Draw => g(['.4555555555.', '45555bb55554', '455555555554', '3+++++++++43', '.33333333333'], P('!' + col, GOLD));

/** Stack of lying books, bottom first: [color, width, shift]. */
function bookStack(t: Img, cx: number, bottom: number, books: [string, number, number][]) {
  let yy = bottom;
  books.forEach(([col, wd, dx], k) => {
    const T = tones(col), x0 = cx - Math.floor(wd / 2) + dx;
    t.rect(x0, yy - 2, wd, 3, T[3]); t.hline(x0, yy - 2, wd, T[5]); t.hline(x0, yy, wd, T[2]);
    t.hline(x0 + 2, yy - 1, wd - 2, hex('#f6ecd2')); t.px(x0 + wd - 1, yy - 1, hex('#d6c8a4')); t.px(x0 + 1, yy - 1, hex(GOLD));
    if (k === books.length - 1) { t.hline(x0 + 1, yy - 3, wd - 1, T[4]); t.px(x0 + 1, yy - 3, T[5]); }
    yy -= 3;
  });
  return yy;
}
const STACK: [string, number, number][] = [['#d8443e', 11, 0], ['#4a7fe0', 10, 1], ['#4fae4a', 11, -1], ['#9a5fd6', 9, 0], ['#f0c83a', 10, 1], ['#9a6238', 8, 0], ['#4fb8c8', 9, -1]];

const crystalBall = (col: Col): Draw => (t) => {
  const T = tones(col), Gd = tones(GOLD), B = t.h - 2;
  t.rect(4, B - 1, 8, 2, Gd[3]); t.hline(4, B - 1, 8, Gd[5]); t.hline(4, B, 8, Gd[2]); t.rect(5, B - 3, 6, 2, Gd[3]); t.hline(5, B - 3, 6, Gd[4]); t.px(4, B - 4, Gd[4]); t.px(11, B - 4, Gd[2]);
  orb(t, 8, B - 9, 5.4, 5.4, T);
  t.px(9, B - 7, T[5]); t.px(10, B - 8, T[5]); t.px(8, B - 6, T[4]);
  t.rect(5, B - 12, 2, 2, WHITE); t.px(7, B - 13, WHITE);
};

const sleepingJunimo = (col: Col): Draw => (t) => {
  put(t, mir(['...4555', '.455555', '4555555', '45kk555', '4555555', '4455555', '.444444']), P(col));
  const B = t.h - 2, L = tones(LEAF);
  t.vline(8, B - 9, 2, L[2]); t.px(9, B - 10, L[4]); t.px(10, B - 10, L[3]); t.px(7, B - 10, L[4]);
  t.px(7, B - 2, hex('#f29ab0')); t.px(8, B - 2, hex('#f29ab0'));
};

const bottle = (col: string): Draw => (t) => {
  put(t, mir(['...+', '...4', '...4', '..45', '.455', '.455', '.455', '.455', '.455', '.455', '.344']), P('!' + col));
  const B = t.h - 2; t.vline(6, B - 6, 4, WHITE); t.px(6, B - 8, WHITE); t.hline(6, B - 2, 4, hex('#f6ecd2')); t.hline(6, B - 3, 4, hex('#f6ecd2'));
};

function cane(t: Img, x0: number, bottom: number, hgt: number, col: Col, big: boolean, flip = false) {
  const T = tones(col), head = big ? ['..xxxx..', '.xxxxxx.', 'xxx..xxx', 'xxx..xxx', 'xxx...xx', 'xxx.....'] : ['.xxx..', 'xxxxx.', 'xx..xx', 'xx..xx', 'xx....'];
  const wd = head[0].length, shaft = big ? 'xxx.....' : 'xx....';
  for (let j = 0; j < hgt; j++) {
    const row = j < head.length ? head[j] : shaft;
    for (let i = 0; i < wd; i++) {
      if (row[i] !== 'x') continue;
      const stripe = ((i + j) >> 1) & 1, edge = row[i + 1] !== 'x';
      t.px(x0 + (flip ? wd - 1 - i : i), bottom - hgt + 1 + j, stripe ? (edge ? T[2] : T[3]) : edge ? hex('#d9d2dc') : hex('#fff8f0'));
    }
  }
}

function crate(t: Img, x0: number, bottom: number, wd: number, hgt: number, col: Col, style: 'x' | 'joja' | 'slats' = 'x') {
  const T = tones(col), top = bottom - hgt + 1;
  t.rect(x0, top, wd, hgt, T[3]);
  t.rect(x0, top, wd, 3, T[4]); t.hline(x0, top, wd, T[5]); t.hline(x0, top + 3, wd, T[1]);
  for (let i = 3; i < wd - 1; i += 4) t.vline(x0 + i, top + 1, 2, T[3]);
  t.vline(x0, top + 4, hgt - 4, T[4]); t.vline(x0 + wd - 1, top + 4, hgt - 4, T[2]); t.hline(x0, bottom, wd, T[2]);
  t.vline(x0 + 1, top + 4, hgt - 4, T[4]); t.vline(x0 + wd - 2, top + 4, hgt - 5, T[2]); t.hline(x0 + 1, top + 4, wd - 2, T[4]); t.hline(x0 + 1, bottom - 1, wd - 2, T[2]);
  if (style === 'x') { t.line(x0 + 2, top + 5, x0 + wd - 3, bottom - 2, T[2]); t.line(x0 + wd - 3, top + 5, x0 + 2, bottom - 2, T[4]); }
  else if (style === 'slats') for (let r = top + 6; r < bottom - 1; r += 2) t.hline(x0 + 2, r, wd - 4, T[2]);
  else { const m = top + 4 + Math.floor((hgt - 4) / 2); t.rect(x0 + 2, m - 1, wd - 4, 3, hex('#f4f6fb')); t.hline(x0 + 3, m, wd - 6, hex('#d8433e')); t.px(x0 + 2, m - 1, hex(JOJA)); }
  for (const [nx, ny] of [[x0 + 1, top + 5], [x0 + wd - 2, top + 5], [x0 + 1, bottom - 2], [x0 + wd - 2, bottom - 2]]) if (style !== 'joja') t.px(nx, ny, T[1]);
}

function barrel(t: Img, cx: number, bottom: number, col: Col, hoop: Col) {
  const rows = mir(['..4555', '.45544', '.34444', 'bbcddd', '435453', '435453', '435453', '435453', 'bbcddd', '435453', '435453', '.bcddd', '..3443'], false);
  stamp(t, cx - 6, bottom - rows.length + 1, rows, P(col, hoop));
}

function arcade(t: Img, body: Col, marquee: Col, screen: (sx: number, sy: number) => void) {
  const T = tones(body), M = tones(marquee), B = t.h - 2, top = B - 25;
  t.rect(2, top, 12, 26, T[3]); t.vline(2, top, 26, T[4]); t.vline(13, top, 26, T[2]); t.hline(2, top, 12, T[5]);
  t.rect(3, top + 1, 10, 3, M[4]); t.hline(3, top + 1, 10, M[5]); t.hline(3, top + 3, 10, M[2]); for (const i of [4, 6, 7, 9, 11]) t.px(i, top + 2, M[1]);
  t.rect(3, top + 5, 10, 9, hex('#2a2430')); t.rect(4, top + 6, 8, 7, hex('#14121c'));
  screen(4, top + 6);
  t.px(4, top + 6, hex('#5a5466'));
  t.rect(1, top + 14, 14, 3, T[4]); t.hline(1, top + 14, 14, T[5]); t.hline(1, top + 16, 14, T[2]);
  t.px(5, top + 13, hex('#e8443e')); t.px(5, top + 14, hex('#2a2430')); t.px(9, top + 15, hex('#f2d03a')); t.px(11, top + 15, hex('#4fd06a'));
  t.rect(6, top + 19, 4, 4, T[1]); t.px(7, top + 20, hex('#f2d03a')); t.px(8, top + 21, hex('#8a8690'));
  t.vline(3, top + 18, 7, M[3]); t.vline(12, top + 18, 7, M[3]);
  t.hline(2, B, 12, T[1]);
}

function smallDoor(t: Img, locked: boolean) {
  const T = tones(locked ? '#6f4a34' : '#b0733c'), F = tones(locked ? '#4a3a3a' : '#7a4f2e'), B = t.h - 2, top = B - 25;
  t.rect(2, top, 12, 26, F[3]); t.hline(2, top, 12, F[5]); t.vline(2, top, 26, F[4]); t.vline(13, top, 26, F[2]);
  t.rect(3, top + 1, 10, 25, T[3]); t.vline(3, top + 1, 25, T[4]); t.vline(12, top + 1, 25, T[2]);
  for (const [py, ph] of [[top + 3, 9], [top + 14, 10]]) for (const px of [4, 9]) { t.rect(px, py, 3, ph, T[2]); t.vline(px, py, ph, T[1]); t.hline(px, py, 3, T[1]); t.px(px + 2, py + ph - 1, T[4]); }
  if (locked) {
    const I = tones('#8e96a6'), Gd = tones(GOLD);
    for (const sy of [top + 5, top + 20]) { t.rect(2, sy, 12, 2, I[3]); t.hline(2, sy, 12, I[5]); for (const sx of [3, 8, 12]) t.px(sx, sy + 1, I[1]); }
    t.line(3, top + 8, 12, top + 18, I[2]); t.line(12, top + 8, 3, top + 18, I[4]);
    t.rect(6, top + 11, 4, 4, Gd[3]); t.hline(6, top + 11, 4, Gd[5]); t.px(7, top + 13, hex('#2a2430')); t.px(8, top + 13, hex('#2a2430')); t.hline(7, top + 9, 2, I[4]); t.px(6, top + 10, I[4]); t.px(9, top + 10, I[2]);
  } else { t.rect(10, top + 12, 2, 2, hex('#f6d657')); t.px(11, top + 13, hex('#b98a2c')); }
}

function bigDoor(t: Img, style: 'wood' | 'joja' | 'junimo' | 'retro' | 'wizard') {
  const B = t.h - 2, top = B - 46, L = 3, R = 28;
  const spec = { wood: ['#b0733c', '#7a4f2e'], joja: ['#4f7fe0', '#dfe6f2'], junimo: ['#c99a58', '#6aa84a'], retro: ['#58c8b8', '#f4ead0'], wizard: ['#7a4fc0', '#3d2f5a'] }[style];
  const T = tones(spec[0]), F = tones(spec[1]);
  const arch = style === 'junimo' || style === 'wizard';
  const inDoor = (i: number, j: number, inset: number) => {
    if (i < L + inset || i > R - inset || j > B || j < top + inset) return false;
    if (!arch) return true;
    const r = (R - L + 1) / 2 - inset, cx = (L + R + 1) / 2, cy = top + (R - L + 1) / 2;
    return j >= cy || (i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2 <= r * r;
  };
  for (let j = top; j <= B; j++) for (let i = L; i <= R; i++) {
    if (!inDoor(i, j, 0)) continue;
    if (!inDoor(i, j, 2)) { t.px(i, j, !inDoor(i - 1, j, 0) || !inDoor(i, j - 1, 0) ? F[5] : !inDoor(i + 1, j, 0) ? F[2] : F[3]); continue; }
    t.px(i, j, !inDoor(i - 1, j, 2) || !inDoor(i, j - 1, 2) ? T[4] : !inDoor(i + 1, j, 2) ? T[2] : T[3]);
  }
  t.rect(L - 2, B - 1, R - L + 5, 2, hex('#9a9aa2')); t.hline(L - 2, B - 1, R - L + 5, hex('#c8c8ce'));
  const panel = (px: number, py: number, pw: number, ph: number, P2 = T) => { t.rect(px, py, pw, ph, P2[2]); t.hline(px, py, pw, P2[1]); t.vline(px, py, ph, P2[1]); t.hline(px + 1, py + ph - 1, pw - 1, P2[4]); t.vline(px + pw - 1, py + 1, ph - 1, P2[4]); };
  const glass = (px: number, py: number, pw: number, ph: number) => { t.rect(px, py, pw, ph, hex('#9fdcf2')); t.hline(px, py, pw, hex('#4a7896')); t.vline(px, py, ph, hex('#4a7896')); t.line(px + 1, py + Math.min(ph, pw) - 2, px + Math.min(ph, pw) - 2, py + 1, hex('#e8fbff')); };
  if (style === 'wood') {
    glass(8, top + 5, 7, 8); glass(17, top + 5, 7, 8); t.hline(8, top + 9, 16, T[2]);
    panel(7, top + 17, 8, 12); panel(17, top + 17, 8, 12); panel(7, top + 32, 18, 10);
    t.rect(24, top + 28, 2, 3, hex('#f6d657')); t.px(25, top + 30, hex('#b98a2c'));
  } else if (style === 'joja') {
    t.rect(5, top + 2, 22, 6, hex('#f4f6fb')); t.rect(8, top + 4, 10, 2, T[3]); t.rect(20, top + 4, 4, 2, hex('#d8433e')); t.hline(5, top + 7, 22, hex('#c4ccdc'));
    glass(6, top + 10, 9, 26); glass(17, top + 10, 9, 26); t.vline(15, top + 9, B - top - 10, T[1]); t.vline(16, top + 9, B - top - 10, T[5]);
    t.vline(13, top + 20, 5, hex('#e8eef8')); t.vline(18, top + 20, 5, hex('#e8eef8'));
    t.rect(5, B - 8, 22, 2, hex('#d8433e')); t.hline(5, B - 8, 22, hex('#f0766e'));
  } else if (style === 'junimo') {
    for (let j = top + 6; j < B - 1; j += 5) t.hline(6, j, 20, T[2]);
    t.vline(16, top + 3, B - top - 4, T[2]);
    const Lf = tones(LEAF);
    t.ellipse(16, top + 15, 5.5, 5.5, hex('#3a2a20')); t.ellipse(16, top + 15, 4.5, 4.5, hex('#ffe9a0')); t.vline(16, top + 11, 9, hex('#3a2a20')); t.hline(12, top + 15, 9, hex('#3a2a20'));
    for (const [vx, vy] of [[5, top + 12], [6, top + 20], [4, top + 26], [26, top + 16], [27, top + 24], [25, top + 30], [9, top + 3], [22, top + 4]]) { t.rect(vx, vy, 2, 2, Lf[3]); t.px(vx, vy, Lf[5]); t.px(vx + 1, vy + 2, Lf[2]); }
    t.rect(15, top - 3, 2, 3, Lf[2]); t.rect(17, top - 4, 4, 2, Lf[4]); t.rect(11, top - 3, 4, 2, Lf[3]);
    t.rect(22, top + 28, 2, 2, hex('#f6d657'));
    for (const [sx, sy, sc] of [[9, top + 34, '#ff8fb8'], [21, top + 37, '#8fd0ff'], [12, top + 40, '#fff08a']] as [number, number, string][]) { t.px(sx, sy, hex(sc)); t.px(sx - 1, sy, hex(sc)); t.px(sx + 1, sy, hex(sc)); t.px(sx, sy - 1, hex(sc)); t.px(sx, sy + 1, hex(sc)); }
  } else if (style === 'retro') {
    glass(8, top + 5, 6, 6); glass(13, top + 14, 6, 6); glass(18, top + 23, 6, 6);
    const O = hex('#f0902e');
    for (const [dx, dy] of [[0, -4], [0, 4], [-4, 0], [4, 0], [-3, -3], [3, -3], [-3, 3], [3, 3]]) t.line(10, top + 34, 10 + dx, top + 34 + dy, O);
    t.rect(9, top + 33, 3, 3, hex('#ffd24a'));
    t.rect(23, top + 33, 2, 6, hex('#e8eef2')); t.vline(24, top + 33, 6, hex('#9aa4ae'));
    t.hline(6, top + 43, 20, T[2]);
  } else {
    const Gd = tones(GOLD);
    for (const sy of [top + 14, top + 34]) { t.rect(5, sy, 22, 2, F[3]); t.hline(5, sy, 22, F[5]); for (let i = 7; i < 26; i += 4) t.px(i, sy + 1, Gd[4]); }
    // crescent moon and stars
    t.ellipse(16, top + 24, 4.6, 4.6, Gd[4]); t.ellipse(17.6, top + 23, 3.8, 3.8, T[3]); t.px(13, top + 22, Gd[5]);
    for (const [sx, sy] of [[9, top + 20], [23, top + 28], [21, top + 19], [10, top + 29], [16, top + 7]]) { t.px(sx, sy, Gd[5]); t.px(sx - 1, sy, Gd[3]); t.px(sx + 1, sy, Gd[3]); t.px(sx, sy - 1, Gd[3]); t.px(sx, sy + 1, Gd[3]); }
    t.rect(15, top + 39, 2, 3, hex('#7af0c0')); t.px(14, top + 40, hex('#7af0c0')); t.px(17, top + 40, hex('#7af0c0'));
    t.rect(23, top + 24, 2, 2, Gd[4]);
  }
}

const pillar = (col: Col, band: Col): Draw => (t) => {
  const T = tones(col), Bd = tones(band), B = t.h - 2, top = B - 24;
  t.rect(3, top, 10, 2, T[4]); t.hline(3, top, 10, T[5]); t.rect(4, top + 2, 8, 1, T[2]);
  for (let j = top + 3; j <= B - 3; j++) for (let i = 5; i <= 10; i++) t.px(i, j, i === 5 ? T[5] : i === 10 ? T[1] : i & 1 ? T[4] : T[3]);
  for (const by of [top + 4, B - 5]) { t.hline(5, by, 6, Bd[3]); t.px(5, by, Bd[5]); t.px(10, by, Bd[2]); }
  t.rect(4, B - 3, 8, 1, T[4]); t.rect(3, B - 2, 10, 3, T[3]); t.hline(3, B - 2, 10, T[5]); t.hline(3, B, 10, T[2]);
};

const globe = (small: boolean): Draw => (t) => {
  const B = t.h - 2, Gd = tones('#b9853a'), r = small ? 3.6 : 5.4, cy = B - (small ? 7 : 10);
  t.rect(5, B - 1, 6, 2, Gd[3]); t.hline(5, B - 1, 6, Gd[5]); t.hline(5, B, 6, Gd[2]); t.rect(7, B - (small ? 3 : 4), 2, small ? 2 : 3, Gd[3]);
  orb(t, 8, cy, r, r, tones('#4a9ae0'));
  const L = tones('#5fbf4a');
  const land: [number, number][] = small ? [[6, -1], [7, -1], [7, 0], [9, 1], [10, 0], [6, -2]] : [[5, -2], [6, -2], [6, -1], [7, -1], [5, -3], [6, -3], [7, 0], [9, 1], [10, 1], [10, 2], [11, 0], [9, -3], [10, -4], [7, 3], [8, 3]];
  for (const [lx, ly] of land) t.px(lx, cy + ly, ly < 0 ? L[4] : L[3]);
  // brass meridian arm
  for (let a = -1.9; a <= 1.3; a += 0.12) t.px(8 + Math.cos(a) * (r + 1.2), cy + Math.sin(a) * (r + 1.2), Gd[4]);
  t.px(8 - (small ? 1 : 2), cy - (small ? 2 : 3), WHITE);
};

function hut(t: Img, x0: number, bottom: number, wd: number, hgt: number) {
  const Th = tones('#d9b24a'), Wl = tones('#c08a50'), Lf = tones(LEAF), cx = x0 + wd / 2, wallH = Math.max(6, Math.round(hgt * 0.36));
  t.rect(x0 + 2, bottom - wallH + 1, wd - 4, wallH, Wl[3]); t.vline(x0 + 2, bottom - wallH + 1, wallH, Wl[4]); t.vline(x0 + wd - 3, bottom - wallH + 1, wallH, Wl[2]);
  for (let i = x0 + 5; i < x0 + wd - 3; i += 4) t.vline(i, bottom - wallH + 1, wallH, Wl[2]);
  // thatch dome
  const ry = hgt - wallH, cy = bottom - wallH + 1;
  for (let j = cy - ry; j <= cy; j++) for (let i = x0; i < x0 + wd; i++) {
    const dx = (i + 0.5 - cx) / (wd / 2), dy = (j + 0.5 - cy) / ry;
    if (dx * dx + dy * dy > 1) continue;
    const band = Math.floor((j - (cy - ry)) / 3), edge = (j - (cy - ry)) % 3 === 2;
    t.px(i, j, edge ? ((i + band) % 3 === 0 ? Th[1] : Th[2]) : dx < -0.35 && dy < -0.3 ? Th[5] : dx > 0.45 ? Th[2] : (i + band * 2) % 4 === 0 ? Th[3] : Th[4]);
  }
  // round door and windows
  const dw = Math.min(8, Math.floor(wd / 3)), dh = Math.min(wallH + 2, 10);
  t.rect(cx - dw / 2, bottom - dh + 2, dw, dh - 1, hex('#4a2f22')); t.rect(cx - dw / 2 + 1, bottom - dh + 1, dw - 2, 1, hex('#4a2f22'));
  t.rect(cx - dw / 2 + 1, bottom - dh + 3, dw - 2, dh - 2, hex('#7a4a2c')); t.px(cx + dw / 2 - 2, bottom - 3, hex('#f6d657'));
  if (wd >= 28) for (const wx of [x0 + 5, x0 + wd - 8]) { t.rect(wx, bottom - wallH + 2, 3, 3, hex('#ffe9a0')); t.px(wx + 1, bottom - wallH + 3, hex('#f0b040')); }
  // sprout on top
  t.vline(cx, cy - ry - 3, 3, Lf[2]); t.rect(cx + 1, cy - ry - 4, 3, 2, Lf[4]); t.rect(cx - 3, cy - ry - 3, 3, 2, Lf[3]); t.px(cx + 3, cy - ry - 4, Lf[5]);
}

/** Bones for the three sloth skeleton pieces; each piece joins its neighbor at the spine row. */
function sloth(t: Img, part: 'l' | 'm' | 'r') {
  const T = tones(BONE), Wb = tones('#6b4a34'), B = t.h - 2, sp = B - 22;
  t.rect(0, B - 2, 32, 3, Wb[3]); t.hline(0, B - 2, 32, Wb[5]); t.hline(0, B, 32, Wb[2]);
  const bone = (x0: number, y0: number, x1: number, y1: number, th = 2) => { for (let k = 0; k < th; k++) t.line(x0, y0 + k, x1, y1 + k, k === 0 ? T[4] : T[3]); };
  const post = (px: number) => { t.rect(px, sp + 3, 2, B - 2 - sp - 3, Wb[2]); t.vline(px, sp + 3, B - 2 - sp - 3, Wb[4]); };
  if (part === 'l') {
    post(22);
    orb(t, 9, sp - 1, 7, 5.5, T); t.rect(2, sp + 1, 8, 4, T[3]); t.hline(2, sp + 1, 8, T[4]); t.hline(2, sp + 4, 8, T[2]);
    t.rect(8, sp - 3, 3, 3, hex('#3a2a30')); t.px(8, sp - 3, T[2]); t.px(3, sp + 1, hex('#3a2a30'));
    for (let i = 3; i < 10; i += 2) t.px(i, sp + 5, T[5]);
    bone(15, sp, 31, sp, 3);
    bone(20, sp + 3, 14, sp + 12); bone(14, sp + 12, 10, sp + 19);
    for (const cxx of [7, 9, 11]) t.line(cxx + 1, sp + 19, cxx - 1, sp + 23, T[5]);
  } else if (part === 'm') {
    post(8); post(22);
    bone(0, sp, 31, sp, 3);
    for (let i = 3; i < 30; i += 4) { t.px(i, sp - 1, T[5]); for (let j = 0; j < 13; j++) { const bx = i + (j > 9 ? -(j - 9) : 0) + (j < 3 ? 0 : 1); t.px(bx, sp + 3 + j, T[j < 2 ? 5 : 4]); if (j % 4 === 3) t.px(bx + 1, sp + 3 + j, T[2]); } }
    t.hline(4, sp + 16, 22, T[2]);
  } else {
    post(8);
    bone(0, sp, 12, sp, 3); bone(12, sp, 22, sp + 5, 2); bone(22, sp + 5, 30, sp + 14, 2); t.px(30, sp + 16, T[3]);
    orb(t, 12, sp + 4, 5.5, 4.5, T); t.rect(11, sp + 3, 3, 3, hex('#3a2a30'));
    bone(13, sp + 7, 17, sp + 14); bone(17, sp + 14, 14, sp + 20);
    for (const cxx of [11, 13, 15]) t.line(cxx + 1, sp + 20, cxx - 1, sp + 23, T[5]);
  }
}

function plushFlat(t: Img, col: Col, big: boolean, rabbit = false) {
  const T = tones(col), B = t.h - 2, cx = t.w / 2, s = rabbit ? 0.5 : big ? 1.18 : 1;
  const o = (dx: number, dy: number, rx: number, ry: number, TT = T) => orb(t, cx + dx * s, B - dy * s, rx * s, ry * s, TT);
  // seen from above, lying on its back with spread limbs
  o(-9, 4, 3.6, 3); o(9, 4, 3.6, 3); o(-10, 14, 3.4, 2.8); o(10, 14, 3.4, 2.8);
  o(0, 9, 8.5, 8.5);
  if (rabbit) { orb(t, cx - 2.5, B - 20, 1.6, 4.5, T); orb(t, cx + 2.5, B - 20, 1.6, 4.5, T); t.vline(cx - 3, B - 22, 5, hex('#f2a0b4')); t.vline(cx + 2, B - 22, 5, hex('#f2a0b4')); }
  else { o(-6, 26, 2.8, 2.8); o(6, 26, 2.8, 2.8); }
  o(0, 20, 7, 6.2);
  const hy = Math.round(B - 20 * s);
  const M = tones(mix(rgb(col), hex('#fff4e0'), 0.55));
  t.ellipse(cx, B - 8 * s, 4.5 * s, 4.5 * s, M[4]);
  t.ellipse(cx, hy + 2 * s, 3 * s, 2.2 * s, M[5]);
  t.px(cx - Math.max(2, 3 * s), hy - 1, hex('#2a2030')); t.px(cx + Math.max(1, 3 * s - 1), hy - 1, hex('#2a2030')); t.px(cx - 0.5, hy + 1, hex('#2a2030'));
}

function catTree(t: Img, dark: boolean) {
  const C = tones(dark ? '#5a4f6a' : '#e0c79a'), Rp = tones(dark ? '#8a7a6a' : '#c9a46a'), A = tones(dark ? '#9a5fd6' : '#4fb8b0'), B = t.h - 2;
  const post = (px: number, top: number, bot: number) => { for (let j = top; j <= bot; j++) { t.hline(px, j, 4, j % 3 === 0 ? Rp[2] : Rp[4]); t.px(px, j, Rp[5]); t.px(px + 3, j, Rp[2]); } };
  const shelf = (px: number, py: number, wd: number) => { t.rect(px, py, wd, 4, C[3]); t.hline(px, py, wd, C[5]); t.hline(px, py + 1, wd, C[4]); t.hline(px, py + 3, wd, C[2]); };
  shelf(2, B - 3, 28);
  post(6, B - 22, B - 4); post(21, B - 34, B - 4);
  shelf(1, B - 25, 15);
  // cubby house on the tall post
  t.rect(16, B - 44, 14, 11, C[3]); t.hline(16, B - 44, 14, C[5]); t.vline(16, B - 44, 11, C[4]); t.vline(29, B - 44, 11, C[2]); t.hline(16, B - 34, 14, C[2]);
  t.ellipse(23, B - 38.5, 3.6, 3.6, hex('#2a2030')); t.px(22, B - 39, hex('#f6e27a')); t.px(24, B - 39, hex('#f6e27a'));
  // cushion and toy
  t.rect(3, B - 27, 10, 2, A[3]); t.hline(3, B - 27, 10, A[5]);
  t.vline(14, B - 21, 6, hex('#e8e0d0')); orb(t, 14.5, B - 14, 2, 2, tones('#e8443e'));
  t.rect(21, B - 14, 4, 4, A[3]); t.hline(21, B - 14, 4, A[5]);
}

function doghouse(t: Img, dark: boolean) {
  const Wl = tones(dark ? '#5f4a40' : '#c9955a'), Rf = tones(dark ? '#4a5568' : '#d8493e'), B = t.h - 2;
  t.rect(4, B - 20, 24, 21, Wl[3]); t.vline(4, B - 20, 21, Wl[4]); t.vline(27, B - 20, 21, Wl[2]);
  for (let j = B - 16; j < B; j += 4) t.hline(5, j, 22, Wl[2]);
  // gable roof
  for (let k = 0; k < 14; k++) { const yy = B - 34 + k, half = 2 + k; t.hline(16 - half, yy, half * 2, k % 3 === 2 ? Rf[2] : Rf[3]); t.px(16 - half, yy, Rf[5]); t.px(16 - half + 1, yy, Rf[4]); t.px(15 + half, yy, Rf[1]); }
  t.hline(1, B - 20, 30, Rf[1]); t.hline(1, B - 21, 30, Rf[2]);
  for (let k = 0; k < 6; k++) t.hline(16 - k - 1, B - 26 + k, (k + 1) * 2, Wl[4]);
  // arched doorway
  t.rect(10, B - 12, 12, 13, hex('#2a1f26')); t.rect(11, B - 14, 10, 2, hex('#2a1f26')); t.rect(13, B - 15, 6, 1, hex('#2a1f26'));
  t.vline(10, B - 12, 13, Wl[1]); t.vline(21, B - 12, 13, Wl[5]);
  // bone sign
  const Bn = hex('#f6efd8'); t.hline(14, B - 18, 4, Bn); for (const bx of [13, 18]) { t.px(bx, B - 19, Bn); t.px(bx, B - 17, Bn); }
}

const DECOR: [RegExp, Draw][] = [
  // --- books
  [/^fallen /i, (t, c) => bookFlat(colorOf(c.name))(t, c)],
  [/^(blue|brown|green|purple|red|yellow) book$/i, (t, c) => bookUp(colorOf(c.name))(t, c)],
  [/small book stack/i, (t) => { bookStack(t, 8, t.h - 2, STACK.slice(0, 2)); }],
  [/large book stack/i, (t) => { bookStack(t, 8, t.h - 2, STACK.slice(0, 7)); }],
  [/book stack/i, (t) => { bookStack(t, 8, t.h - 2, STACK.slice(1, 5)); }],
  [/small book pile/i, (t) => { bookStack(t, 9, t.h - 2, STACK.slice(0, 2)); bookStack(t, 23, t.h - 2, [['#4fae4a', 10, 0]]); }],
  [/large book pile/i, (t, c) => { bookStack(t, 8, t.h - 2, STACK.slice(0, 5)); bookStack(t, 23, t.h - 2, STACK.slice(3, 7)); stamp(t, 13, t.h - 21, ['45555+.', '45555++', '4bb55++', '45555++', '45555++', '34444+.'], P('#d8443e', GOLD)); void c; }],
  [/book pile/i, (t) => { bookStack(t, 8, t.h - 2, STACK.slice(2, 5)); bookStack(t, 23, t.h - 2, STACK.slice(0, 2)); }],
  [/bookcase/i, (t) => {
    const T = tones(WD), B = t.h - 2, top = B - 26;
    t.rect(1, top, 14, 27, T[3]); t.hline(1, top, 14, T[5]); t.vline(1, top, 27, T[4]); t.vline(14, top, 27, T[2]); t.rect(2, top + 1, 12, 25, T[1]);
    const cols = ['#d8443e', '#4a7fe0', '#f0c83a', '#4fae4a', '#9a5fd6', '#f08a2e', '#4fb8c8'];
    [top + 2, top + 10, top + 18].forEach((sy, s) => {
      for (let i = 0; i < 12; i++) { const k = (i + s * 3) % 7, bh = 5 + ((i * 7 + s) % 3), BT = tones(cols[k]); if ((i + s) % 6 === 5) continue; t.vline(2 + i, sy + 7 - bh, bh, i & 1 ? BT[3] : BT[4]); t.px(2 + i, sy + 8 - bh, BT[5]); }
      t.hline(2, sy + 7, 12, T[4]);
    });
  }],
  // --- gems, balls, bottles
  [/crystal ball/i, (t, c) => crystalBall(colorOf(c.name, '#cfe6f6'))(t, c)],
  [/sleeping junimo/i, (t, c) => sleepingJunimo(colorOf(c.name))(t, c)],
  [/(blue|green) bottle/i, (t, c) => bottle(colorOf(c.name))(t, c)],
  [/two elixirs/i, g(['..+.....+..', '..4.....d..', '..4.....d..', '.454...ded.', '45554.deeed', '4#554.d#eed', '45554.deeed', '.444...ddd.'], P('#e2445a', '#4fd0d6'))],
  [/elixir bundle/i, g(['.+..+..+...', '.4..d..D...', '.4..d..D...', '454ded.DED.', '454dedDEEED', 'vwwwwwwwwwv', '4#4d#dDE#ED', '454dedDEEED', '.4..d..DDD.'], P('#e2445a', '#4fd0d6', '#f0c83a', '#b9853a'))],
  [/small crystal/i, g(['....5......', '...455.....', '...4553.5..', '.5.4553455.', '4544553453.', '4534553453.', '.33455343..'], P('#6fe0e8'))],
  [/standing geode/i, g(mir(['...4444', '..44555', '.44bcde', '.4bcdee', '44bcd#e', '44bccde', '44bbcdd', '.44bccd', '.444bbc', '..44444', '...3444']), P('#8a8078', '#a968e0'))],
  [/singing stone/i, (t) => { put(t, mir(['...4555', '..45555', '.455555', '.455555', '4455555', '4445555', '.444444']), P('#7f9ad0')); const B = t.h - 2; t.vline(12, B - 16, 5, WHITE); t.rect(10, B - 12, 2, 2, WHITE); t.px(13, B - 16, WHITE); t.px(14, B - 15, WHITE); t.hline(5, B - 3, 3, hex('#c8dcff')); }],
  [/stone cairn/i, g(['.....ADD......', '....ADDDB.....', '....BCCCB.....', '..............', '...adddddb....', '..addddddddb..', '..bcccccccb...', '..............', '....ADDDDB....', '....ACCCCB....', '..............', '.455555555553.', '45555555555553', '45555555555553', '.344444444443.'], P('#a9adab', '#cdbfa4', '#a3acc0'))],
  [/stone slab/i, (t) => { const T = tones('#a4a8a8'), B = t.h - 2; t.rect(2, B - 8, 28, 9, T[3]); t.rect(2, B - 8, 28, 5, T[4]); t.hline(2, B - 8, 28, T[5]); t.hline(2, B - 3, 28, T[1]); t.hline(2, B, 28, T[2]); t.vline(29, B - 8, 9, T[2]); for (const [rx, ry] of [[6, B - 6], [11, B - 5], [17, B - 6], [23, B - 5]]) { t.vline(rx, ry - 1, 3, T[1]); t.px(rx + 1, ry, T[1]); } t.line(20, B - 2, 24, B, T[1]); }],
  [/boulder/i, (t) => {
    const T = tones('#9a9a9e'), B = t.h - 2; t = zoom(t, 1.12, 16, B);
    orb(t, 20, B - 9, 10, 9, T); orb(t, 12, B - 12, 10, 12, T); orb(t, 17, B - 19, 8, 8, T);
    t.rect(6, B - 2, 22, 3, T[2]); t.hline(8, B, 18, T[1]);
    t.line(14, B - 24, 16, B - 17, T[1]); t.line(16, B - 17, 14, B - 12, T[1]); t.line(22, B - 14, 26, B - 9, T[2]); t.line(7, B - 9, 10, B - 5, T[2]);
    for (const [mx, my] of [[5, B - 14], [6, B - 15], [7, B - 15], [22, B - 22], [23, B - 21], [9, B - 22]]) t.px(mx, my, hex('#7fae52'));
    t.rect(9, B - 21, 3, 2, T[5]);
  }],
  [/bongo/i, (t) => {
    const T = tones('#c8683a'), M = tones('#8e96a6'), B = t.h - 2;
    const drum = (cx: number, rx: number, hgt: number) => {
      for (let r = 0; r < hgt; r++) { const inset = r > hgt - 3 ? 1 : 0; for (let i = cx - rx + inset; i <= cx + rx - inset; i++) t.px(i, B - hgt + 1 + r, i === cx - rx + inset ? T[5] : i >= cx + rx - inset - 1 ? T[2] : (i - cx) % 2 === 0 ? T[3] : T[4]); }
      t.hline(cx - rx, B - hgt + 2, rx * 2 + 1, M[3]); t.px(cx - rx, B - hgt + 2, M[5]);
      t.ellipse(cx + 0.5, B - hgt + 0.5, rx + 0.6, 1.7, hex('#f6ecd2')); t.hline(cx - rx + 1, B - hgt, rx, WHITE);
    };
    drum(4, 3, 9); drum(11, 3, 7); t.rect(7, B - 4, 2, 2, T[1]);
  }],
  [/ceramic pillar/i, pillar('#f1ece4', '#4a7fe0')], [/gold pillar/i, pillar(GOLD, '#fff3b0')],
  [/small globe/i, globe(true)], [/globe/i, globe(false)],
  // --- canes
  [/big (green|red) cane/i, (t, c) => cane(t, 4, t.h - 2, 24, colorOf(c.name), true)],
  [/mixed cane/i, (t) => { cane(t, 1, t.h - 2, 15, '#d8443e', false); cane(t, 8, t.h - 2, 17, '#4fae4a', false, true); }],
  [/(green|red) canes/i, (t, c) => { cane(t, 1, t.h - 2, 15, colorOf(c.name), false); cane(t, 8, t.h - 2, 17, colorOf(c.name), false, true); }],
  // --- doors
  [/decorative joja door/i, (t) => bigDoor(t, 'joja')], [/decorative junimo door/i, (t) => bigDoor(t, 'junimo')], [/decorative retro door/i, (t) => bigDoor(t, 'retro')],
  [/decorative wizard door/i, (t) => bigDoor(t, 'wizard')], [/decorative door/i, (t) => bigDoor(t, 'wood')],
  [/locked door/i, (t) => smallDoor(t, true)], [/^door$/i, (t) => smallDoor(t, false)],
  [/hatch/i, (t) => { const T = tones(WD), I = tones('#8e96a6'), B = t.h - 2; t.rect(1, B - 11, 14, 12, T[3]); t.hline(1, B - 11, 14, T[5]); t.vline(1, B - 11, 12, T[4]); t.vline(14, B - 11, 12, T[2]); t.hline(1, B, 14, T[2]); for (const i of [4, 8, 11]) t.vline(i, B - 10, 10, T[2]); for (const sy of [B - 9, B - 3]) { t.hline(1, sy, 14, I[3]); t.px(2, sy, I[5]); t.px(13, sy, I[1]); } t.rect(6, B - 7, 4, 3, I[4]); t.rect(7, B - 6, 2, 1, T[1]); }],
  // --- arcade machines
  [/cursed/i, (t) => arcade(t, '#3a3046', '#9a3fd0', (sx, sy) => { t.rect(sx + 2, sy + 1, 4, 4, hex('#d8d0c0')); t.px(sx + 3, sy + 2, hex('#ff3040')); t.px(sx + 5, sy + 2, hex('#ff3040')); t.hline(sx + 3, sy + 5, 2, hex('#d8d0c0')); t.px(sx, sy + 6, hex('#9a3fd0')); t.px(sx + 7, sy + 3, hex('#9a3fd0')); t.px(sx + 6, sy + 6, hex('#9a3fd0')); })],
  [/junimo kart/i, (t) => arcade(t, '#3f8fd0', '#f0c83a', (sx, sy) => { t.rect(sx, sy, 8, 4, hex('#7fd0f2')); t.rect(sx, sy + 4, 8, 3, hex('#7a5a3a')); t.line(sx, sy + 5, sx + 7, sy + 3, hex('#c8a060')); t.rect(sx + 3, sy + 2, 2, 2, hex('#6fd04a')); t.px(sx + 3, sy + 1, hex('#3f9a3c')); t.rect(sx + 2, sy + 4, 4, 1, hex('#e8443e')); t.px(sx + 6, sy + 1, WHITE); })],
  [/prairie king/i, (t) => arcade(t, '#a8623a', '#e8443e', (sx, sy) => { t.rect(sx, sy, 8, 7, hex('#e0b86a')); t.rect(sx + 3, sy + 3, 2, 3, hex('#4a6fd0')); t.hline(sx + 2, sy + 2, 4, hex('#6a3f24')); t.hline(sx + 3, sy + 1, 2, hex('#6a3f24')); t.vline(sx + 6, sy + 3, 4, hex('#3f9a3c')); t.px(sx + 7, sy + 4, hex('#3f9a3c')); t.px(sx + 1, sy + 5, hex('#b02e36')); })],
  // --- junimo things
  [/large junimo hut/i, (t) => { hut(t, 2, t.h - 2, 16, 20); hut(t, 46, t.h - 2, 16, 22); hut(t, 14, t.h - 2, 36, 40); }],
  [/small junimo hut/i, (t) => { hut(t, 1, t.h - 2, 14, 16); hut(t, 33, t.h - 2, 14, 17); hut(t, 13, t.h - 2, 22, 26); }],
  [/small junimo plush/i, (t) => { put(t, mir(['...4555', '..45555', '.45k555', '.455555', '.445555', '..44444', '...3...']), P('#5fc85a')); const B = t.h - 2, L = tones(LEAF); t.vline(8, B - 9, 2, L[2]); t.px(9, B - 9, L[4]); t.px(8, B - 3, hex('#3f8f3f')); t.px(8, B - 5, hex('#f29ab0')); }],
  [/junimo bag/i, (t) => { put(t, mir(['...b...', '..4b455', '...4444', '..45555', '.455555', '4555555', '4555bc5', '455bccc', '4455bc5', '.444444']), P('#d9c08a', '#58b83e')); }],
  [/junimo bundle/i, (t) => { put(t, mir(['.....cb', '....bcd', '.45555c', '455555c', 'bccccdd', '455555c', '455555c', '445555c', '.44444b']), P('#e6cf96', '#58b83e')); }],
  [/junimo pot/i, (t, c) => {
    const B = t.h - 2, small = /small/i.test(c.name);
    pot(t, 8, B, small ? 8 : 12, small ? 6 : 9, '#c2673f');
    const top = B - (small ? 6 : 9);
    // a junimo peeks out of the pot
    orb(t, 8, top - (small ? 1 : 2), small ? 3 : 4.4, small ? 3 : 4, tones(small ? '#f08a2e' : '#5fc85a'));
    t.px(7, top - (small ? 2 : 3), hex('#2a2030')); t.px(9, top - (small ? 2 : 3), hex('#2a2030'));
    const L = tones(LEAF); t.vline(8, top - (small ? 6 : 9), 2, L[2]); t.px(9, top - (small ? 6 : 9), L[4]); t.px(10, top - (small ? 6 : 9), L[3]);
    const T = tones('#c2673f'); t.hline(8 - (small ? 4 : 6), top + 1, small ? 8 : 12, T[5]); t.hline(8 - (small ? 3 : 5), top + 2, small ? 6 : 10, T[4]);
  }],
  // --- joja things and trash
  [/large joja crate/i, (t) => crate(t, 2, t.h - 2, 28, 20, JOJA, 'joja')],
  [/stacked joja boxes/i, (t) => { crate(t, 1, t.h - 2, 14, 11, JOJA, 'joja'); crate(t, 3, t.h - 13, 11, 9, '#5f8fe0', 'joja'); crate(t, 5, t.h - 22, 7, 6, JOJA, 'joja'); }],
  [/joja crate/i, (t) => crate(t, 1, t.h - 2, 14, 14, JOJA, 'joja')],
  [/joja cola cans/i, (t) => { const T = tones(JOJA), B = t.h - 2; const can = (x0: number, bot: number) => { t.rect(x0, bot - 6, 4, 7, T[3]); t.vline(x0, bot - 6, 7, T[5]); t.vline(x0 + 3, bot - 6, 7, T[2]); t.hline(x0, bot - 7, 4, hex('#dfe6f2')); t.hline(x0, bot - 3, 4, hex('#f4f6fb')); t.px(x0 + 1, bot - 4, hex('#d8433e')); t.px(x0 + 2, bot - 7, hex('#8a8f9e')); }; can(2, B - 3); can(10, B - 2); can(6, B); }],
  [/shopping cart/i, (t) => {
    const I = tones('#aab2c2'), B = t.h - 2, Bl = tones(JOJA);
    for (let j = B - 14; j <= B - 5; j++) { const inset = Math.floor((j - (B - 14)) / 4); for (let i = 7 + inset; i <= 27 - inset; i++) t.px(i, j, (i + j) % 3 === 0 || j === B - 14 || j === B - 5 || i === 7 + inset || i === 27 - inset ? (j === B - 14 ? I[5] : I[3]) : [0, 0, 0, 0]); }
    t.hline(7, B - 14, 21, I[5]); t.hline(7, B - 13, 21, I[2]);
    t.line(7, B - 14, 3, B - 18, I[4]); t.rect(1, B - 19, 4, 2, Bl[3]); t.hline(1, B - 19, 4, Bl[5]);
    t.line(10, B - 4, 8, B - 2, I[2]); t.line(24, B - 4, 26, B - 2, I[2]); t.hline(9, B - 3, 17, I[3]);
    for (const wx of [8, 25]) { t.rect(wx - 1, B - 1, 3, 2, hex('#2e2a3a')); t.px(wx, B - 1, hex('#8a8f9e')); }
    t.rect(12, B - 12, 12, 2, Bl[3]); t.hline(12, B - 12, 12, Bl[5]);
  }],
  [/aluminum can/i, g(['.4555553.', '45b455532', '45b545432', '.3444432.'], P('#b9c2cf', '#d8443e'))],
  [/six-pack/i, (t) => { const B = t.h - 2, c1 = hex('#e8f2fa'), c2 = hex('#a8bccc'); for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) { const x0 = 1 + k * 5 - r, y0 = B - 8 + r * 5; t.hline(x0 + 1, y0, 3, c1); t.hline(x0 + 1, y0 + 4, 3, c2); t.vline(x0, y0 + 1, 3, c1); t.vline(x0 + 4, y0 + 1, 3, c2); } }],
  [/plastic bag/i, g(['..5...5...', '..5#..54..', '.5##5#554.', '5####5##54', '5##5###554', '4555#55544', '.44455444.'], P('#e4ebf2'))],
  [/wrapper/i, g(['5........5', '45.bcdc.54', '.4bcd#dc4.', '45.bccc.54', '4........4'], P('#f0c83a', '#d8443e'))],
  [/spilled beverage/i, (t) => { const B = t.h - 2, T = tones('#e8443e'), L = tones('#c8843a'); t.ellipse(10, B - 1, 5, 2, L[3]); t.ellipse(9, B - 1.5, 3, 1, L[4]); t.px(14, B - 3, L[3]); t.px(5, B, L[3]); for (let i = 0; i < 7; i++) { t.vline(1 + i, B - 6 + (i > 4 ? 1 : 0), 5 - (i > 4 ? 1 : 0), i === 0 ? hex('#f4f6fb') : T[i < 3 ? 4 : 3]); } t.hline(1, B - 6, 5, T[5]); t.hline(1, B - 2, 7, T[2]); t.vline(7, B - 5, 3, hex('#5a2a1a')); t.hline(3, B - 4, 3, hex('#f4f6fb')); }],
  [/messy shirt/i, g(['..44....44...', '.4555++5555..', '4555555555554', '455355555535.', '.4.455535544.', '...455555554.', '..4553555554.', '..445555544..'], P('!#2f6fd0'))],
  [/messy shorts/i, g(['455555555554', '45+555555+54', '455555555554', '455555445554', '45555..45554', '45554..45554', '.444....444.'], P('!#6fbf5a'))],
  [/trash can/i, g(mir(['....444', '.455555', '4555555', '.344444', '.453453', '.453453', '.453453', '.453453', '.453453', '.453453', '..33333']), P('#9aa4b2'))],
  [/buried tire/i, (t) => { const B = t.h - 2, T = tones('#4a4a56'); t.ellipse(8, B - 2, 6.5, 7, T[3]); t.ellipse(8, B - 2, 3, 3.6, [0, 0, 0, 0]); for (let j = 0; j < t.h; j++) for (let i = 0; i < 16; i++) { const d = ((i + 0.5 - 8) / 3) ** 2 + ((j + 0.5 - (B - 2)) / 3.6) ** 2; if (d <= 1 || j > B - 1) { const k = (j * 16 + i) * 4; t.data[k + 3] = 0; } } for (let a = 3.3; a < 6.2; a += 0.45) t.px(8 + Math.cos(a) * 5.4, B - 2 + Math.sin(a) * 5.8, T[5]); const D = tones('#7a4f2c'); t.rect(0, B - 1, 16, 2, D[3]); t.hline(1, B - 2, 4, D[4]); t.hline(10, B - 2, 5, D[4]); t.hline(0, B, 16, D[2]); t.px(3, B - 3, hex('#6fbf4a')); t.px(12, B - 3, hex('#6fbf4a')); t.px(13, B - 4, hex('#8fd45a')); }],
  [/tire/i, (t) => { const B = t.h - 2, T = tones('#4a4a56'), cy = B - 7; for (let j = 0; j < t.h; j++) for (let i = 0; i < 16; i++) { const d = ((i + 0.5 - 8) / 6.5) ** 2 + ((j + 0.5 - cy) / 7.5) ** 2, d2 = ((i + 0.5 - 8) / 3) ** 2 + ((j + 0.5 - cy) / 3.6) ** 2; if (d <= 1 && d2 > 1) t.px(i, j, i < 5 || j < cy - 5 ? T[4] : i > 11 || j > cy + 5 ? T[2] : T[3]); else if (d2 <= 1 && d2 > 0.45) t.px(i, j, hex('#b9c2cf')); } for (let a = 0; a < 6.28; a += 0.5) t.px(8 + Math.cos(a) * 5.4, cy + Math.sin(a) * 6.3, a > 2.6 && a < 5 ? T[5] : T[1]); }],
  // --- pots, vases, bowls
  [/elegant vase/i, g(mir(['..45555', '...4444', '....455', '...4555', '.4.4bcd', '4.45555', '4.455#5', '.445555', '..4bcdd', '..45555', '...4444', '..44444']), P('#f1ece4', '#4a7fe0'))],
  [/obsidian vase/i, g(mir(['...4555', '....444', '....455', '...4555', '..45555', '.4b5555', '.4b#555', '.4b5555', '.445555', '..44555', '...4444', '..44444']), P('#3a3446', '#a968e0'))],
  [/decorative pitcher/i, g(['5555554...', '.444443...', '..45553...', '.45555544.', '4555555324', '4cdcdcd3.4', '4555555324', '4555555344', '.4555553..', '..34443...'], P('#f1ece4', '#4a7fe0'))],
  [/decorative bowl/i, (t) => { put(t, mir(['4555555', '4bcbcbc', '.455555', '..45555', '...3444']), P('#f1ece4', '#4a7fe0')); const B = t.h - 2; orb(t, 5, B - 6, 2.4, 2.2, tones('#e8443e')); orb(t, 9, B - 7, 2.6, 2.4, tones('#f0a030')); orb(t, 12, B - 6, 1.8, 1.8, tones('#9a5fd6')); t.px(9, B - 10, hex('#5f8a3a')); }],
  [/(food|water) pet bowl/i, (t, c) => {
    const water = /water/i.test(c.name), T = tones(water ? '#9aa4b4' : '#d8443e'), C = tones(water ? '#4aa8e8' : '#9a6238'), B = t.h - 2;
    for (let r = 0; r < 5; r++) { const inset = r < 2 ? 0 : r - 1; t.hline(2 + inset, B - 4 + r, 12 - inset * 2, r === 4 ? T[2] : T[3]); t.px(2 + inset, B - 4 + r, T[5]); t.px(13 - inset, B - 4 + r, T[2]); }
    t.ellipse(8, B - 5, 6.2, 2.2, T[4]); t.ellipse(8, B - 5, 5, 1.4, C[3]); t.hline(4, B - 6, 4, C[5]);
    if (!water) for (const [kx, ky] of [[6, B - 6], [9, B - 5], [11, B - 6], [5, B - 5]]) t.px(kx, ky, C[1]);
    t.rect(7, B - 2, 2, 1, hex('#fff8e8')); t.px(6, B - 1, hex('#fff8e8')); t.px(9, B - 1, hex('#fff8e8'));
  }],
  [/cauldron/i, (t) => {
    const B = t.h - 2, T = tones('#3f3d4a'), Br = tones('#5fd04a');
    for (const lx of [8, 22]) { t.rect(lx, B - 2, 3, 3, T[2]); t.px(lx, B - 2, T[4]); }
    orb(t, 16, B - 9, 12, 8.5, T);
    t.rect(4, B - 17, 24, 3, T[3]); t.hline(4, B - 17, 24, T[5]); t.hline(4, B - 15, 24, T[1]);
    t.ellipse(16, B - 17, 10, 2.2, Br[3]); t.ellipse(14, B - 17.5, 6, 1.2, Br[4]);
    for (const [bx, by, br] of [[10, B - 19, 1.5], [19, B - 20, 2], [24, B - 23, 1.2], [14, B - 24, 1.4]]) { t.ellipse(bx, by, br, br, Br[4]); t.px(bx - 1, by - 1, Br[5]); }
    t.px(8, B - 11, T[5]); t.px(9, B - 12, T[5]); t.vline(7, B - 9, 3, T[4]);
    t.px(3, B - 13, T[4]); t.px(2, B - 12, T[3]); t.px(28, B - 13, T[2]); t.px(29, B - 12, T[2]);
  }],
  [/tub o/i, (t) => {
    const B = t.h - 2, L = tones('#4aa63e');
    barrelTub(t, B);
    orb(t, 8, B - 9, 6.4, 3.6, L);
    const fl = ['#ff7fae', '#ffd84a', '#ffffff', '#b98cf0', '#ff8a4a'];
    [[3, B - 10], [6, B - 12], [9, B - 11], [12, B - 10], [7, B - 9], [11, B - 13], [4, B - 13]].forEach(([fx, fy], k) => { t.px(fx, fy, hex(fl[k % 5])); t.px(fx + 1, fy, hex(fl[k % 5])); t.px(fx, fy - 1, hex(fl[k % 5])); t.px(fx + 1, fy - 1, mix(hex(fl[k % 5]), hex('#7a3a4a'), 0.25)); });
  }],
  // --- wooden things
  [/decorative barrel/i, (t) => { barrel(t, 8, t.h - 2, '#b0703c', '#d8443e'); const B = t.h - 2; t.rect(7, B - 4, 2, 2, hex('#e8c048')); t.px(8, B - 2, hex('#8a8690')); t.rect(5, B - 8, 6, 2, hex('#f4ead0')); t.hline(6, B - 7, 4, hex('#7a4a2c')); }],
  [/barrel/i, (t) => barrel(t, 8, t.h - 2, WD, '#8e96a6')],
  [/crate/i, (t) => crate(t, 1, t.h - 2, 14, 14, '#c0894a', 'x')],
  [/basic log/i, (t) => { const T = tones('#8a5f3a'), R = tones('#e0b878'), B = t.h - 2; t.rect(3, B - 7, 12, 8, T[3]); t.hline(3, B - 7, 12, T[5]); t.hline(3, B - 6, 12, T[4]); t.hline(3, B, 12, T[2]); t.hline(3, B - 1, 12, T[2]); for (const [bx, by, bl] of [[6, B - 4, 4], [10, B - 2, 3], [9, B - 5, 5]]) t.hline(bx, by, bl, T[1]); t.ellipse(4, B - 3.5, 3.2, 4.2, R[3]); t.ellipse(4, B - 3.5, 2, 3, R[4]); t.ellipse(4, B - 3.5, 0.8, 1.4, R[2]); t.px(12, B - 8, hex('#6fbf4a')); t.px(13, B - 8, hex('#8fd45a')); t.px(15, B - 5, T[2]); }],
  [/log section/i, (t) => { const T = tones('#8a5f3a'), R = tones('#e0b878'), B = t.h - 2; t.rect(2, B - 8, 12, 9, T[3]); t.vline(2, B - 8, 9, T[4]); t.vline(13, B - 8, 9, T[2]); for (const i of [5, 8, 11]) t.vline(i, B - 6, 6, T[2]); t.ellipse(8, B - 1, 6, 2, T[3]); t.ellipse(8, B - 9, 6, 3.4, R[3]); t.ellipse(8, B - 9, 4.4, 2.3, R[4]); t.ellipse(8, B - 9, 2.4, 1.2, R[3]); t.px(8, B - 9, R[1]); t.px(7, B - 9, R[1]); t.line(11, B - 10, 13, B - 11, R[1]); }],
  [/dead tree/i, g(['..1.....2.....', '..12...2...1..', '...2..22..1...', '1..22.2..22...', '.2..222.22....', '..2..2222.....', '...222332..1..', '.....2332.2...', '.....23322....', '.....2332.....', '.....2342.....', '.....2342.....', '.....2342.....', '.....23432....', '....2234322...', '...22.23.222..'], P('#8a7566'))],
  [/wood chair/i, g(mir(['44444', '4.5.5', '4.5.5', '4.5.5', '44444', '55555', '34444', '3....', '3....', '3....']), P(WD))],
  [/ancient stool/i, g(mir(['.455555', '4555555', '3444444', '.3b4b4b', '..34444', '..34...', '..34...']), P('#c9b48a', '#4fb8b0'))],
  [/ancient table/i, g(mir(['4555555', '4555555', '3444444', '.b4b4b4', '.344444', '.34...4', '.34...4', '.34...4', '.34...4', '.34...4']), P('#c9b48a', '#4fb8b0'))],
  [/fancy table/i, (t) => { put(t, mir(['.#######', '########', '+#b##b##', '+###b###', '.+#####+', '..+.+.+.', '....45..', '....45..', '...445..', '..4455..'], false), P(WD, '#d8443e')); const B = t.h - 2; t.rect(7, B - 13, 2, 4, hex('#fff3c0')); t.px(7, B - 14, hex('#ffb030')); t.px(7, B - 15, hex('#ffe070')); t.hline(6, B - 10, 4, hex(GOLD)); }],
  [/table piece/i, (t, c) => {
    const Lp = /\bL$/.test(c.name), T = tones(WD), B = t.h - 2, x0 = Lp ? 1 : 0, wd = 15;
    t.rect(x0, B - 11, wd, 3, T[4]); t.hline(x0, B - 11, wd, T[5]); t.hline(x0, B - 9, wd, T[2]); t.rect(x0 + (Lp ? 1 : 0), B - 8, wd - 1, 2, T[3]); t.hline(x0 + (Lp ? 1 : 0), B - 7, wd - 1, T[2]);
    const lx = Lp ? 2 : 11; t.rect(lx, B - 6, 3, 7, T[3]); t.vline(lx, B - 6, 7, T[4]); t.vline(lx + 2, B - 6, 7, T[2]);
    t.px(Lp ? 4 : 11, B - 10, T[2]); t.hline(Lp ? 7 : 2, B - 10, 6, T[3]);
  }],
  [/floor divider/i, (t, c) => {
    const Lp = /\bL$/.test(c.name), T = tones(WD), B = t.h - 2;
    t.rect(0, B - 12, 16, 13, T[3]); t.hline(0, B - 12, 16, T[5]); t.hline(0, B - 11, 16, T[4]); t.hline(0, B, 16, T[2]);
    for (let i = Lp ? 6 : 2; i < (Lp ? 16 : 12); i += 4) { t.rect(i, B - 9, 3, 8, T[2]); t.vline(i, B - 9, 8, T[1]); t.hline(i, B - 9, 3, T[1]); }
    const px = Lp ? 0 : 12; t.rect(px, B - 16, 4, 17, T[4]); t.vline(px, B - 16, 17, T[5]); t.vline(px + 3, B - 16, 17, T[2]); t.hline(px, B - 16, 4, T[5]); t.rect(px + 1, B - 18, 2, 2, T[4]);
  }],
  [/grandfather clock/i, (t) => {
    const T = tones('#8a5230'), Gd = tones(GOLD), B = t.h - 2, top = B - 27;
    t.rect(3, top + 3, 10, 25, T[3]); t.vline(3, top + 3, 25, T[4]); t.vline(12, top + 3, 25, T[2]);
    t.rect(2, top + 2, 12, 2, T[4]); t.hline(2, top + 2, 12, T[5]); t.rect(5, top, 6, 2, T[3]); t.hline(6, top - 1, 4, T[4]); t.px(7, top - 2, Gd[4]); t.px(8, top - 2, Gd[3]);
    t.ellipse(8, top + 8.5, 3.6, 3.6, hex('#fbf3da')); t.vline(8, top + 6, 3, hex('#2a2030')); t.hline(8, top + 8, 2, hex('#2a2030')); t.px(8, top + 5, Gd[2]); t.px(8, top + 11, Gd[2]); t.px(5, top + 8, Gd[2]); t.px(11, top + 8, Gd[2]);
    t.rect(5, top + 14, 6, 9, hex('#3a2a30')); t.rect(6, top + 15, 4, 7, hex('#5a4650')); t.vline(8, top + 15, 5, Gd[3]); t.rect(7, top + 19, 3, 3, Gd[4]); t.px(7, top + 19, Gd[5]); t.px(6, top + 15, hex('#9fdcf2'));
    t.rect(2, B - 2, 12, 3, T[3]); t.hline(2, B - 2, 12, T[5]); t.hline(2, B, 12, T[2]);
  }],
  [/coat stand/i, (t) => { const T = tones('#8a5230'), B = t.h - 2; t.rect(7, B - 26, 2, 26, T[3]); t.vline(7, B - 26, 26, T[4]); t.rect(4, B - 1, 8, 2, T[3]); t.hline(4, B - 1, 8, T[5]); t.px(3, B, T[3]); t.px(12, B, T[2]); t.px(7, B - 27, T[5]); t.px(8, B - 27, T[4]); for (const [hx, hy, d] of [[5, B - 23, -1], [10, B - 23, 1], [5, B - 19, -1]]) { t.px(hx, hy, T[4]); t.px(hx + d, hy - 1, T[4]); } const C = tones('#4a7fb8'); t.rect(9, B - 22, 4, 12, C[3]); t.vline(9, B - 22, 12, C[5]); t.vline(12, B - 21, 11, C[2]); t.px(13, B - 20, C[3]); t.vline(13, B - 19, 6, C[2]); t.px(10, B - 16, hex(GOLD)); t.px(10, B - 13, hex(GOLD)); const H = tones('#a8623a'); t.rect(2, B - 26, 5, 2, H[3]); t.hline(1, B - 24, 6, H[4]); t.hline(3, B - 26, 3, H[5]); }],
  [/clothesline/i, (t) => {
    const T = tones(WD), B = t.h - 2;
    for (const px of [2, 44]) { t.rect(px, B - 24, 2, 25, T[3]); t.vline(px, B - 24, 25, T[5]); t.hline(px - 1, B - 22, 4, T[4]); }
    for (let i = 4; i < 44; i++) t.px(i, B - 22 + Math.round(2.5 * Math.sin(((i - 4) / 40) * Math.PI)), hex('#f1e8d0'));
    const hang = (x0: number, wd: number, hgt: number, col: Col, yoff: number) => { const C = tones(col); t.rect(x0, B - 20 + yoff, wd, hgt, C[3]); t.vline(x0, B - 20 + yoff, hgt, C[5]); t.vline(x0 + wd - 1, B - 20 + yoff, hgt, C[2]); t.hline(x0, B - 20 + yoff + hgt - 1, wd, C[2]); t.px(x0 + 1, B - 21 + yoff, hex('#b98048')); t.px(x0 + wd - 2, B - 21 + yoff, hex('#b98048')); return C; };
    const s = hang(7, 9, 9, '#e8544e', 1); t.rect(5, B - 19, 2, 4, s[3]); t.rect(16, B - 19, 2, 4, s[2]); t.hline(10, B - 19, 3, s[1]);
    const w = hang(20, 11, 13, '#f4f1e8', 2); for (let j = B - 15; j < B - 6; j += 3) t.hline(21, j, 9, w[2]);
    hang(34, 3, 7, '#4a8fe0', 1); hang(39, 3, 7, '#4a8fe0', 0); t.px(36, B - 13, hex('#4a8fe0')); t.px(41, B - 14, hex('#4a8fe0'));
  }],
  [/bird house/i, g(mir(['.....d', '....cd', '...cdd', '..cddd', '.bcccc', '..4555', '..45kk', '..45kk', '..4555', '..3444', '.....A', '.....A', '.....A', '.....A', '.....A', '.....A', '.....A', '.....A', '....AA']), P('#e8d6a8', '#d8493e', '#8a5a34'))],
  [/hay bale/i, (t) => { put(t, mir(['.455555', '4555555', '4545454', '4454545', '4545454', '4454545', '4545454', '3444444']), P('#e6c24a')); const B = t.h - 2, R = tones('#d8443e'); for (const rx of [5, 10]) { t.vline(rx, B - 7, 8, R[3]); t.px(rx, B - 7, R[5]); } t.px(9, B - 9, R[4]); t.px(11, B - 9, R[4]); t.px(10, B - 8, R[3]); }],
  [/industrial pipe/i, (t) => { const T = tones('#8a94a4'), B = t.h - 2; t.rect(4, B - 12, 7, 13, T[3]); t.vline(4, B - 12, 13, T[5]); t.vline(5, B - 12, 13, T[4]); t.vline(10, B - 12, 13, T[2]); t.rect(4, B - 18, 11, 7, T[3]); t.hline(4, B - 18, 11, T[5]); t.hline(5, B - 17, 10, T[4]); t.hline(8, B - 12, 7, T[2]); t.px(4, B - 18, [0, 0, 0, 0]); for (const fy of [B - 1, B - 8]) { t.rect(3, fy, 9, 2, T[4]); t.hline(3, fy, 9, T[5]); t.px(11, fy + 1, T[2]); } t.rect(13, B - 19, 2, 9, T[4]); t.vline(13, B - 19, 9, T[5]); t.vline(14, B - 19, 9, T[2]); t.px(6, B - 5, T[1]); t.px(8, B - 15, T[1]); t.px(7, B - 4, hex('#b9763a')); t.px(7, B - 3, hex('#b9763a')); }],
  // --- machines and gadgets
  [/camera/i, (t) => {
    const T = tones('#4a4658'), W2 = tones('#b98048'), B = t.h - 2, top = B - 22;
    // wooden tripod
    t.line(8, top + 9, 3, B, W2[4]); t.line(8, top + 9, 13, B, W2[2]); t.vline(8, top + 9, B - top - 10, W2[3]); t.hline(5, top + 16, 7, W2[2]);
    // camera body, flash and lens
    t.rect(2, top + 1, 12, 8, T[3]); t.hline(2, top + 1, 12, hex('#c8ccd6')); t.hline(2, top + 2, 12, hex('#8a8f9e')); t.vline(2, top + 3, 6, T[5]); t.vline(13, top + 3, 6, T[1]); t.hline(2, top + 8, 12, T[1]);
    t.rect(3, top - 2, 4, 3, hex('#e8eef2')); t.px(4, top - 1, hex('#fff7b0')); t.px(5, top - 1, hex('#fff7b0')); t.rect(10, top, 2, 1, hex('#e8443e'));
    t.ellipse(8.5, top + 5.5, 3.2, 3.2, hex('#1d1826')); t.ellipse(8.5, top + 5.5, 2.2, 2.2, hex('#4a9ae0')); t.px(7, top + 4, WHITE); t.px(9, top + 6, hex('#8fd0f2')); t.px(4, top + 4, hex('#f2d03a'));
  }],
  [/boombox/i, (t) => { const T = tones('#5a6072'), B = t.h - 2; t.rect(1, B - 8, 14, 9, T[3]); t.hline(1, B - 8, 14, T[5]); t.vline(1, B - 8, 9, T[4]); t.vline(14, B - 8, 9, T[2]); t.hline(1, B, 14, T[2]); t.hline(4, B - 11, 8, T[4]); t.px(4, B - 10, T[4]); t.px(4, B - 9, T[4]); t.px(11, B - 10, T[3]); t.px(11, B - 9, T[3]); for (const sx of [4, 11.5]) { t.ellipse(sx, B - 3.5, 2.6, 2.6, hex('#2a2430')); t.ellipse(sx, B - 3.5, 1.2, 1.2, hex('#8a8f9e')); } t.rect(6, B - 7, 4, 2, hex('#9fe0b0')); t.px(7, B - 4, hex('#e8443e')); t.px(8, B - 4, hex('#f0c83a')); t.px(7, B - 2, T[1]); t.px(8, B - 2, T[1]); t.line(13, B - 9, 15, B - 15, hex('#c8ccd6')); }],
  [/mini-fridge/i, (t) => { const T = tones('#e6ebf0'), B = t.h - 2; t.rect(2, B - 16, 12, 17, T[3]); t.rect(2, B - 16, 12, 3, T[4]); t.hline(2, B - 16, 12, T[5]); t.hline(2, B - 13, 12, T[1]); t.vline(2, B - 12, 13, T[5]); t.vline(13, B - 12, 13, T[2]); t.hline(2, B, 12, T[2]); t.hline(3, B - 8, 10, T[2]); t.vline(11, B - 11, 2, hex('#8a94a4')); t.vline(11, B - 6, 3, hex('#8a94a4')); t.rect(4, B - 11, 2, 2, hex('#e8443e')); t.px(7, B - 10, hex('#f0c83a')); t.px(5, B - 5, hex('#4a9ae0')); }],
  [/cash register/i, (t) => {
    const T = tones('#c8443e'), M = tones('#5a6072'), Gd = tones(GOLD), B = t.h - 2;
    t.rect(1, B - 4, 14, 5, M[3]); t.hline(1, B - 4, 14, M[5]); t.hline(1, B, 14, M[2]); t.vline(14, B - 4, 5, M[2]); t.rect(6, B - 2, 4, 1, Gd[4]);
    for (let r = 0; r < 7; r++) { const inset = r < 3 ? 3 - r : 0; t.hline(2 + inset, B - 11 + r, 12 - inset, T[3]); t.px(2 + inset, B - 11 + r, T[5]); t.px(13, B - 11 + r, T[2]); }
    t.hline(5, B - 11, 9, T[5]);
    for (const [kx, ky, kc] of [[5, B - 9, '#fff8e8'], [7, B - 9, '#fff8e8'], [9, B - 9, '#fff8e8'], [4, B - 7, '#fff8e8'], [6, B - 7, '#fff8e8'], [8, B - 7, '#f2d03a'], [11, B - 8, '#4fd06a']] as [number, number, string][]) t.px(kx, ky, hex(kc));
    t.rect(7, B - 16, 7, 5, M[2]); t.hline(7, B - 16, 7, M[4]); t.rect(8, B - 15, 5, 3, hex('#16241c')); t.px(9, B - 14, hex('#6ff08a')); t.px(11, B - 14, hex('#6ff08a')); t.px(12, B - 14, hex('#6ff08a'));
    t.hline(2, B - 5, 12, Gd[3]); t.px(14, B - 9, M[4]); t.px(15, B - 10, M[4]); t.px(15, B - 11, Gd[4]);
  }],
  [/model ship/i, (t) => { const B = t.h - 2, H = tones('#8a5230'), S = tones('#f4ecd8'); t.rect(7, B - 2, 2, 3, H[2]); t.rect(4, B, 8, 1, H[3]); for (let k = 0; k < 4; k++) t.hline(1 + k, B - 6 + k, 14 - k * 2, k === 0 ? H[5] : k === 3 ? H[2] : H[3]); t.px(14, B - 7, H[4]); t.px(1, B - 7, H[4]); t.hline(3, B - 5, 9, hex(GOLD)); t.vline(8, B - 20, 14, H[2]); t.vline(4, B - 15, 9, H[2]); for (let j = 0; j < 6; j++) t.hline(9, B - 19 + j, 1 + Math.ceil(j * 0.8), j === 0 ? S[5] : S[4]); for (let j = 0; j < 5; j++) t.hline(9, B - 12 + j, 5 - Math.floor(j / 3), S[3]); t.hline(9, B - 13, 5, S[5]); for (let j = 0; j < 6; j++) t.hline(5, B - 14 + j, 3, j < 2 ? S[5] : S[4]); t.px(8, B - 21, hex('#d8443e')); t.px(9, B - 21, hex('#d8443e')); t.px(9, B - 20, hex('#d8443e')); }],
  // --- figures
  [/mannequin \(male\)/i, g(mir(['.....45', '.....45', '.455555', '4555555', '4555555', '.455555', '.455555', '..45555', '..45555', '..34444', '......c', '......c', '......c', '......c', '...bccc']), P('#e6d6ba', '#8a5a34'))],
  [/mannequin/i, g(mir(['.....45', '.....45', '..45555', '.455555', '.455555', '..45555', '...4555', '..45555', '.455555', '.344444', '......c', '......c', '......c', '......c', '...bccc']), P('#f0c8c0', '#8a5a34'))],
  [/serpent statue/i, (t, c) => g(['...4555....', '..45k555...', '..455555c..', '..44555....', '....455....', '....455....', '...4455....', '.44555555..', '4455555555.', '44544444554', '.4455555544', '..3444444..'], P(colorOf(c.name), '#e8443e'), '#8d9294', 13)(t, c)],
  [/calico statue/i, (t) => { put(t, mir(['.4...4.', '.45.45.', '.455555', '.45k555', '.455551', '..45555', '.455555', '.455555', '4455555', '4455555', '.44.455']), P('#f4efe6', '#f08a2e'), 0, 4); plinth(t, 12, '#d8443e'); const B = t.h - 2; t.rect(3, B - 14, 3, 2, hex('#f08a2e')); t.rect(9, B - 14, 3, 3, hex('#3a3040')); t.rect(4, B - 8, 2, 3, hex('#3a3040')); t.rect(9, B - 6, 3, 2, hex('#f08a2e')); t.hline(6, B - 9, 4, hex('#d8443e')); t.px(8, B - 8, hex(GOLD)); t.rect(11, B - 13, 2, 4, hex('#f4efe6')); }],
  [/chicken statue/i, g(['...bb.....', '..4bc.....', '.45555....', 'CC5k55....', '.C4555....', '..45555..5', '..4555555 5'.replace(' ', ''), '.455555555', '.455555554', '.445555544', '..4444444.', '...C..C...', '..CC.CC...'], P('#f0c060', '#d8443e', '#f08a2e'), '#8d9294', 12)],
  [/squirrel/i, g(['.........45.', '........4555', '.4.4....4555', '.455...45554', '45k55..45554', 'k5555..4554.', '.4555..454..', '.455554554..', '.45555454...', '.4455544....', '.44.444.....'], P('#c8743a'), '#8a5a34', 12)],
  [/leah/i, g(['....455...', '...45555..', '...453555.', '....45535.', '..4..4555.', '.455..455.', '.4535.455.', '.45555355.', '.4555.4555', '.453...455', '.4555.4535', '..4555555.', '...45555..'], P('#c08a4a'), '#8d9294', 10)],
  [/sign of the vessel/i, (t) => { put(t, mir(['..45555', '.455555', '.455b55', '.45bbdd', '.455bcd', '.45bcdd', '.45bcdd', '.455bcc', '.4555bb', '.455555', '.445555', '4444444']), P('#8a8fa8', '#f0c83a')); }],
  [/totem pole/i, (t) => { const B = t.h - 2; const face = (yy: number, col: Col, eyes: string) => { const T = tones(col); t.rect(4, yy, 8, 7, T[3]); t.vline(4, yy, 7, T[5]); t.vline(11, yy, 7, T[2]); t.hline(4, yy, 8, T[5]); t.hline(4, yy + 6, 8, T[1]); t.rect(5, yy + 2, 2, 2, hex('#fff8e8')); t.rect(9, yy + 2, 2, 2, hex('#fff8e8')); t.px(6, yy + 3, hex('#2a2030')); t.px(9, yy + 3, hex('#2a2030')); t.hline(6, yy + 5, 4, hex(eyes)); t.px(7, yy + 4, T[1]); t.px(8, yy + 4, T[1]); }; face(B - 6, '#b0703c', '#fff8e8'); face(B - 13, '#3fa8a0', '#e8443e'); face(B - 20, '#d8443e', '#f0c83a'); const Wg = tones('#f0c83a'); t.rect(0, B - 19, 4, 3, Wg[3]); t.rect(12, B - 19, 4, 3, Wg[3]); t.hline(0, B - 19, 4, Wg[5]); t.hline(12, B - 19, 4, Wg[5]); t.px(0, B - 16, Wg[2]); t.px(15, B - 16, Wg[2]); t.rect(6, B - 23, 4, 3, Wg[3]); t.hline(7, B - 24, 2, Wg[5]); }],
  [/ritual mask/i, g(mir(['..c.E.c', '..c.E.c', '.455555', '4555555', '45kk555', '45kk55b', '455555b', '.4#k#k#', '.455555', '..44444', '......A', '......A', '......A', '...AAAA']), P('#b0703c', '#e8443e', '#3fa8a0'))],
  [/wicked statue/i, g(mir(['..5....', '..54...', '..45555', '..4c555', '..45551', '5..4#k#', '54.4555', '5444555', '4434555', '4.34455', '...4455', '..444..']), P('#6a6278', '#ff3a4a'), '#4a4456', 12)],
  [/decorative spears/i, (t) => { const B = t.h - 2, Wd = tones('#9a6238'), St = tones('#c2ccd8'); for (const [x0, x1, hi] of [[3, 12, St], [12, 3, St]] as [number, number, Tones][]) { t.line(x0, B - 1, x1, B - 22, Wd[3]); t.line(x0 + (x0 < x1 ? 1 : -1), B - 1, x1 + (x0 < x1 ? 1 : -1), B - 22, Wd[2]); const d = x0 < x1 ? 1 : -1; t.px(x1 + d, B - 25, hi[5]); t.rect(x1 + (d > 0 ? 0 : -1), B - 24, 2, 2, hi[4]); t.px(x1 + d, B - 23, hi[2]); t.px(x1 - d, B - 20, hex('#e8443e')); t.px(x1 - d * 2, B - 19, hex('#e8443e')); } t.rect(5, B - 12, 6, 2, hex('#e8c048')); t.rect(3, B - 1, 10, 2, Wd[2]); t.hline(3, B - 1, 10, Wd[4]); }],
  [/^skeleton$/i, g(['....45555....', '...4555555...', '...4kk5kk5...', '...4kk5kk5...', '...455k555...', '....45555....', '45..4k4k4..54', '455.......554', '..4555.5554..', '....45554....', '..4555.5554..', '455.......554', '45.........54'], P(BONE))],
  [/dusty skull/i, (t) => { const B = t.h - 2, T = tones('#d9d0b8'), D = hex('#3a2a30'); t = zoom(t, 1.14, 16, B); orb(t, 16, B - 17, 12.5, 11.5, T); t.rect(8, B - 9, 16, 8, T[3]); t.vline(8, B - 9, 8, T[4]); t.vline(23, B - 9, 8, T[2]); t.hline(8, B - 1, 16, T[2]); t.ellipse(10.5, B - 15, 3.6, 4, D); t.ellipse(21.5, B - 15, 3.6, 4, D); t.px(9, B - 17, hex('#6a5a60')); t.px(20, B - 17, hex('#6a5a60')); t.rect(15, B - 11, 2, 3, D); t.px(14, B - 9, D); t.px(17, B - 9, D); for (let i = 10; i < 23; i += 3) t.vline(i, B - 5, 4, T[1]); t.hline(9, B - 6, 14, T[1]); t.line(20, B - 28, 23, B - 23, T[1]); t.line(23, B - 23, 21, B - 21, T[1]); for (const [dx, dy] of [[6, B - 24], [12, B - 27], [26, B - 14], [5, B - 12]]) t.px(dx, dy, hex('#b8a98a')); t.hline(3, B, 5, hex('#b8a98a')); t.hline(24, B, 5, hex('#b8a98a')); }],
  [/sloth skeleton l/i, (t) => sloth(t, 'l')], [/sloth skeleton m/i, (t) => sloth(t, 'm')], [/sloth skeleton r/i, (t) => sloth(t, 'r')],
  [/lg\. futan bear/i, (t) => plushFlat(t, '#e8a0b8', true)], [/futan bear/i, (t) => plushFlat(t, '#b9824a', false)], [/futan rabbit/i, (t) => plushFlat(t, '#f4efe6', false, true)],
  [/dark cat tree/i, (t) => catTree(t, true)], [/cat tree/i, (t) => catTree(t, false)],
  [/dark doghouse/i, (t) => doghouse(t, true)], [/doghouse/i, (t) => doghouse(t, false)],
  // --- big statues
  [/bear statue/i, (t) => { const T = tones('#a39c92'), B = t.h - 2; plinth(t, 30, '#8d9294', 4); const b = B - 4; t = zoom(t, 1.2, 16, b); orb(t, 9, b - 25, 3, 3, T); orb(t, 23, b - 25, 3, 3, T); orb(t, 16, b - 9, 10, 10, T); orb(t, 7, b - 11, 3.2, 5.5, T); orb(t, 25, b - 11, 3.2, 5.5, T); orb(t, 10, b - 1.5, 4.5, 2.5, T); orb(t, 22, b - 1.5, 4.5, 2.5, T); orb(t, 16, b - 21, 8, 7, T); t.ellipse(16, b - 18.5, 3.6, 2.6, T[5]); t.rect(15, b - 20, 2, 1, T[1]); t.px(15, b - 18, T[1]); t.px(16, b - 18, T[1]); t.px(12, b - 23, T[0]); t.px(19, b - 23, T[0]); t.ellipse(16, b - 8, 5, 6, T[4]); t.px(9, b - 25, T[2]); t.px(23, b - 25, T[2]); }],
  [/gourmand/i, (t) => { const T = tones('#86b06a'), B = t.h - 2; plinth(t, 30, '#8d9294', 4); const b = B - 4; t = zoom(t, 1.05, 16, b); orb(t, 16, b - 10, 14, 10.5, T); orb(t, 8, b - 22, 4.5, 4.5, T); orb(t, 24, b - 22, 4.5, 4.5, T); t.ellipse(8, b - 22.5, 2.4, 2.4, hex('#fff8e0')); t.ellipse(24, b - 22.5, 2.4, 2.4, hex('#fff8e0')); t.rect(8, b - 23, 2, 2, T[0]); t.rect(23, b - 23, 2, 2, T[0]); t.ellipse(16, b - 6, 9, 6, T[5]); t.hline(5, b - 14, 22, T[0]); t.px(4, b - 15, T[0]); t.px(27, b - 15, T[0]); t.rect(13, b - 13, 6, 2, hex('#e8546a')); orb(t, 5, b - 2, 4, 2.4, T); orb(t, 27, b - 2, 4, 2.4, T); const Gd = tones(GOLD); t.rect(12, b - 25, 8, 3, Gd[3]); for (const cx2 of [12, 15, 19]) t.px(cx2, b - 26, Gd[5]); t.hline(12, b - 23, 8, Gd[2]); t.px(16, b - 24, hex('#e8443e')); }],
  [/bobo/i, (t) => { const T = tones('#d0903e'), B = t.h - 2; plinth(t, 30, '#6b4a34', 4); const b = B - 4; t = zoom(t, 1.15, 16, b); orb(t, 5, b - 22, 4, 5, T); orb(t, 27, b - 22, 4, 5, T); t.ellipse(5, b - 22, 2, 3, T[1]); t.ellipse(27, b - 22, 2, 3, T[1]); orb(t, 16, b - 6, 8, 6.5, T); orb(t, 16, b - 20, 10.5, 10, T); t.ellipse(16, b - 16, 7, 5, T[5]); t.ellipse(12, b - 23, 2, 2.4, hex('#fff8e0')); t.ellipse(20, b - 23, 2, 2.4, hex('#fff8e0')); t.px(12, b - 23, T[0]); t.px(20, b - 23, T[0]); t.hline(11, b - 15, 10, T[0]); t.px(10, b - 16, T[0]); t.px(21, b - 16, T[0]); t.hline(12, b - 14, 8, hex('#fff8e0')); t.px(15, b - 18, T[1]); t.px(17, b - 18, T[1]); t.vline(16, b - 33, 3, T[2]); t.px(15, b - 33, T[4]); t.px(17, b - 32, T[2]); orb(t, 9, b - 1, 3.5, 2, T); orb(t, 23, b - 1, 3.5, 2, T); }],
  [/wumbus/i, (t) => { const T = tones('#8f80d8'), B = t.h - 2; plinth(t, 28, '#6a6278', 4); const b = B - 4; t = zoom(t, 1.1, 16, b); for (const [ax, d] of [[11, -1], [21, 1]]) { t.line(ax, b - 27, ax + d * 3, b - 34, T[2]); orb(t, ax + d * 3 + 0.5, b - 35, 2, 2, tones('#f0c83a')); } orb(t, 16, b - 14, 10, 14, T); t.ellipse(16, b - 8, 6, 6, T[5]); t.ellipse(11.5, b - 20, 3.4, 4, hex('#fff8e8')); t.ellipse(20.5, b - 20, 3.4, 4, hex('#fff8e8')); t.rect(12, b - 20, 2, 3, T[0]); t.rect(19, b - 20, 2, 3, T[0]); t.rect(14, b - 13, 4, 2, T[0]); t.hline(15, b - 12, 2, hex('#e8546a')); orb(t, 11, b - 1, 3.4, 2, T); orb(t, 21, b - 1, 3.4, 2, T); orb(t, 5, b - 12, 2, 3.5, T); orb(t, 27, b - 12, 2, 3.5, T); }],
  [/krobus/i, (t) => { const T = tones('#8a52d8'), B = t.h - 2; plinth(t, 30, '#3d3550', 4); const b = B - 4; t = zoom(t, 1.2, 16, b); t.rect(6, b - 16, 20, 17, T[3]); t.vline(6, b - 16, 17, T[4]); t.rect(22, b - 16, 4, 17, T[2]); orb(t, 16, b - 17, 10.4, 11, T); for (let i = 9; i < 26; i += 5) t.vline(i, b - 4, 5, T[1]); t.ellipse(11.5, b - 18, 2.6, 3.4, hex('#fff8ff')); t.ellipse(20.5, b - 18, 2.6, 3.4, hex('#fff8ff')); t.px(12, b - 17, hex('#c8a8f0')); t.px(21, b - 17, hex('#c8a8f0')); for (const [sx, sy] of [[9, b - 24], [10, b - 25], [8, b - 12], [8, b - 11], [22, b - 8]]) t.px(sx, sy, T[5]); t.px(13, b - 27, WHITE); t.px(12, b - 26, WHITE); t.px(24, b - 22, hex('#ffd0ff')); }],
  [/butterfly hutch/i, (t) => { const Wd = tones('#c08a50'), B = t.h - 2, Gl: RGBA = [176, 226, 240, 235]; t.rect(3, B - 26, 26, 27, Gl); for (let k = 0; k < 12; k++) { t.hline(16 - k * 1.2 - 2, B - 38 + k, k * 2.4 + 4, Gl); } for (let k = 0; k < 13; k++) { t.px(15 - k * 1.2, B - 38 + k, Wd[5]); t.px(14 - k * 1.2, B - 38 + k, Wd[4]); t.px(16 + k * 1.2, B - 38 + k, Wd[2]); t.px(17 + k * 1.2, B - 38 + k, Wd[2]); } for (const px of [2, 15, 28]) { t.rect(px, B - 26, 2, 27, Wd[3]); t.vline(px, B - 26, 27, Wd[5]); } t.rect(1, B - 27, 30, 2, Wd[4]); t.hline(1, B - 27, 30, Wd[5]); t.rect(2, B - 13, 28, 1, Wd[3]); t.rect(2, B - 2, 28, 3, Wd[3]); t.hline(2, B - 2, 28, Wd[5]); t.hline(2, B, 28, Wd[2]); const L = tones(LEAF); for (const [fx, fc] of [[6, '#ff7fae'], [10, '#ffd84a'], [20, '#b98cf0'], [25, '#ff8a4a']] as [number, string][]) { t.vline(fx, B - 7, 5, L[2]); t.px(fx + 1, B - 5, L[4]); t.rect(fx - 1, B - 9, 3, 2, hex(fc)); t.px(fx, B - 10, hex(fc)); } for (const [bx, by, bc] of [[8, B - 20, '#f08a2e'], [22, B - 18, '#4a9ae0'], [12, B - 31, '#e8546a'], [21, B - 30, '#f0c83a'], [24, B - 23, '#9a5fd6']] as [number, number, string][]) { t.px(bx - 1, by, hex(bc)); t.px(bx + 1, by, hex(bc)); t.px(bx - 1, by - 1, hex(bc)); t.px(bx + 1, by - 1, hex(bc)); t.px(bx, by, hex('#2a2030')); } t.line(5, B - 24, 9, B - 16, WHITE); t.line(18, B - 24, 20, B - 20, WHITE); }],
  [/exotic palace/i, (t) => {
    const S = tones('#e6cf9a'), Dm = tones('#3fb0b8'), Gd = tones(GOLD), B = t.h - 2;
    const dome = (cx: number, cy: number, r: number) => { orb(t, cx, cy, r, r * 1.05, Dm); t.rect(cx - 1, cy - r * 1.05 - 3, 2, 3, Gd[4]); t.px(cx - 1, cy - r * 1.05 - 5, Gd[5]); t.px(cx, cy - r * 1.05 - 4, Gd[3]); for (let k = -r + 2; k < r; k += 3) t.vline(cx + k, cy - r * 0.6, r * 1.2, Dm[2]); };
    const tower = (x0: number, wd: number, top: number) => { t.rect(x0, top, wd, B - top + 1, S[3]); t.vline(x0, top, B - top + 1, S[5]); t.vline(x0 + 1, top, B - top + 1, S[4]); t.rect(x0 + wd - 2, top, 2, B - top + 1, S[2]); t.rect(x0 - 1, top, wd + 2, 2, S[4]); t.hline(x0 - 1, top, wd + 2, S[5]); t.hline(x0 - 1, top + 2, wd + 2, S[1]); };
    dome(8, B - 38, 5); dome(40, B - 38, 5); dome(24, B - 44, 9);
    tower(3, 10, B - 36); tower(35, 10, B - 36); tower(10, 28, B - 38);
    for (const [wx, wy] of [[6, B - 30], [38, B - 30], [6, B - 18], [38, B - 18], [14, B - 31], [22, B - 31], [30, B - 31]]) { t.rect(wx, wy + 1, 4, 6, hex('#3a4a78')); t.rect(wx + 1, wy, 2, 1, hex('#3a4a78')); t.px(wx + 1, wy + 2, hex('#8fd0f2')); t.hline(wx - 1, wy + 7, 6, S[5]); }
    t.hline(10, B - 22, 28, Gd[3]); t.hline(10, B - 21, 28, S[1]); for (let i = 11; i < 38; i += 3) t.px(i, B - 23, hex('#e8546a'));
    // great arched door and steps
    t.rect(18, B - 14, 12, 15, hex('#4a2f22')); t.rect(19, B - 16, 10, 2, hex('#4a2f22')); t.rect(21, B - 17, 6, 1, hex('#4a2f22'));
    t.rect(19, B - 13, 10, 14, hex('#8a3a4a')); t.rect(20, B - 15, 8, 2, hex('#8a3a4a')); t.vline(24, B - 15, 16, hex('#4a2f22')); t.px(22, B - 7, Gd[5]); t.px(26, B - 7, Gd[5]);
    for (let i = 18; i < 30; i += 2) t.px(i, B - 18, Gd[4]);
    t.rect(14, B - 1, 20, 2, S[4]); t.hline(14, B - 1, 20, S[5]);
    for (const px of [1, 46]) { const L = tones('#3f9a3c'); t.rect(px, B - 5, 1, 6, hex('#8a5a34')); t.rect(px - 1, B - 9, 3, 4, L[3]); t.px(px - 1, B - 9, L[5]); }
  }],
];

/** Half barrel used as a planter. */
function barrelTub(t: Img, B: number) {
  const rows = mir(['bbcddd', '435453', '435453', '435453', 'bbcddd', '.34543', '..3443'], false);
  stamp(t, 2, B - rows.length + 1, rows, P(WD, '#8e96a6'));
}

const decor: Painter = (img, x, y, w, h, c) => {
  const hit = DECOR.find(([re]) => re.test(c.name));
  // every listed name has a drawing; an unknown name gets a labeled wooden crate rather than a blob
  const draw: Draw = hit ? hit[1] : (t) => crate(t, Math.floor(t.w / 2) - 7, t.h - 2, 14, 14, c.base, 'slats');
  const flat = /six-pack|hatch|futan|messy|wrapper|spilled/i.test(c.name);
  sprite(img, x, y, w, h, (t) => draw(t, c), { shadow: !flat, line: !/six-pack/i.test(c.name) });
};

/** Painters by item kind. They draw at real size into the box (x, y, w, h). */
export const painters: Record<string, Painter> = {
  fence, gate, floor, path, tilled: soil(false), watered: soil(true), grassplant: grass(false), bluegrass: grass(true),
  statue, sign, block, decor,
};

/** Pixels that a kind rises above its footprint (the sprite box is footprint height + rise). */
export const rise: Record<string, number> = { fence: 10, gate: 10, statue: 12, sign: 6, block: 4, decor: 16 };
