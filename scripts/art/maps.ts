/**
 * Farm & interior layouts (approximations of the game's farm types, authored from
 * scratch as tile grids) and a seasonal terrain renderer.
 */
import { hex, Img, mix, ramp, RGBA, Rng, shade } from './png';
import type { Season } from './painters';

export const T = {
  VOID: 0, GRASS: 1, DIRT: 2, WATER: 3, SAND: 4, CLIFF: 5, FOREST: 6, ROCK: 7, BRIDGE: 8, HIGH: 9,
  FLOOR: 10, WALL: 11, SOIL: 12, DEEP: 13, STONEFLOOR: 14,
} as const;
export const CODE_CHARS = '.gdwsCFRBhfWtDS';

export type MapDef = {
  id: string;
  name: string;
  kind: 'farm' | 'interior';
  w: number;
  h: number;
  grid: Uint8Array;
  defaults: { id: string; x: number; y: number }[];
  blurb: string;
};

// ------------------------------------------------------------------ helpers
function noise2(seed: number) {
  const rng = new Rng(seed);
  const perm = Array.from({ length: 256 }, () => rng.next());
  const at = (x: number, y: number) => perm[((x * 73856093) ^ (y * 19349663)) & 255];
  return (x: number, y: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

class Grid {
  g: Uint8Array;
  constructor(public w: number, public h: number, fillCode: number = T.GRASS) {
    this.g = new Uint8Array(w * h).fill(fillCode);
  }
  get(x: number, y: number) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : this.g[y * this.w + x]; }
  set(x: number, y: number, c: number) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y * this.w + x] = c; }
  rect(x: number, y: number, w: number, h: number, c: number) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number, wobble = 0, seed = 1) {
    const n = noise2(seed);
    for (let j = Math.floor(cy - ry - 3); j <= cy + ry + 3; j++) for (let i = Math.floor(cx - rx - 3); i <= cx + rx + 3; i++) {
      const dx = (i + 0.5 - cx) / rx, dy = (j + 0.5 - cy) / ry;
      const d = Math.sqrt(dx * dx + dy * dy) - wobble * (n(i * 0.35, j * 0.35) - 0.5);
      if (d <= 1) this.set(i, j, c);
    }
  }
  /** Thick polyline (rivers, paths). */
  stroke(pts: [number, number][], width: number, c: number, wobble = 0, seed = 2) {
    const n = noise2(seed);
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      for (let s = 0; s <= len; s += 0.5) {
        const t = s / len, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        const ww = width / 2 + wobble * (n(x * 0.2, y * 0.2) - 0.5);
        for (let j = Math.floor(y - ww); j <= y + ww; j++) for (let i = Math.floor(x - ww); i <= x + ww; i++) {
          if (Math.hypot(i + 0.5 - x, j + 0.5 - y) <= ww) this.set(i, j, c);
        }
      }
    }
  }
  /** Noisy border of forest with gaps (exits). */
  border(thick: number, seed: number, gaps: { side: 'n' | 's' | 'e' | 'w'; from: number; to: number }[] = []) {
    const n = noise2(seed);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const t = thick + Math.round(n(x * 0.25, y * 0.25) * 2.5);
      const inGap = (side: string, v: number) => gaps.some((g) => g.side === side && v >= g.from && v <= g.to);
      if ((x < t && !inGap('w', y)) || (x >= this.w - t && !inGap('e', y)) || (y < t && !inGap('n', x)) || (y >= this.h - t && !inGap('s', x))) this.set(x, y, T.FOREST);
    }
  }
  /** Raise a region to HIGH ground; add 2-row cliff faces on its south edge and 1-col on east/west edges. */
  plateau(x: number, y: number, w: number, h: number, stairs: [number, number][] = []) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.get(i, j) === T.GRASS) this.set(i, j, T.HIGH);
    for (let i = x; i < x + w; i++) for (let k = 0; k < 2; k++) {
      const yy = y + h + k;
      if (stairs.some(([a, b]) => i >= a && i <= b)) { if (this.get(i, yy) !== T.FOREST) this.set(i, yy, T.DIRT); continue; }
      if (this.get(i, yy) !== T.FOREST) this.set(i, yy, T.CLIFF);
    }
  }
  vcliff(x: number, y0: number, y1: number, gaps: [number, number][] = []) {
    for (let j = y0; j <= y1; j++) if (!gaps.some(([a, b]) => j >= a && j <= b) && this.get(x, j) !== T.FOREST) this.set(x, j, T.CLIFF);
  }
  hcliff(y: number, x0: number, x1: number, gaps: [number, number][] = []) {
    for (let i = x0; i <= x1; i++) for (let k = 0; k < 2; k++) if (!gaps.some(([a, b]) => i >= a && i <= b) && this.get(i, y + k) !== T.FOREST) this.set(i, y + k, T.CLIFF);
  }
  scatter(code: number, on: number, count: number, seed: number, x0 = 0, y0 = 0, x1 = this.w, y1 = this.h) {
    const r = new Rng(seed);
    for (let k = 0; k < count; k++) {
      const x = x0 + r.int(x1 - x0), y = y0 + r.int(y1 - y0);
      if (this.get(x, y) === on) this.set(x, y, code);
    }
  }
}

const W = 80, H = 65;
const HOUSE = { id: 'farmhouse', x: 59, y: 11 };
const BIN = { id: 'shipping-bin', x: 69, y: 13 };
const PATH_HOME = (g: Grid) => { g.stroke([[63, 15], [63, 17], [79, 17]], 3, T.DIRT, 0.8, 9); };

function farmCommon(g: Grid, greenhouse = { x: 14, y: 8 }) {
  // Flatten ground under fixed buildings so they're valid.
  for (const [x, y, w, h] of [[HOUSE.x - 1, HOUSE.y - 1, 11, 6], [BIN.x, BIN.y, 2, 1], [greenhouse.x - 1, greenhouse.y - 1, 9, 9]] as const) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const c = g.get(i, j);
      if (c === T.FOREST || c === T.WATER || c === T.CLIFF || c === T.ROCK) g.set(i, j, T.GRASS);
    }
  }
  return [HOUSE, BIN, { id: 'greenhouse', x: greenhouse.x, y: greenhouse.y }];
}

// ------------------------------------------------------------------ farms
function standard(): MapDef {
  const g = new Grid(W, H);
  g.border(3, 11, [{ side: 'e', from: 15, to: 19 }, { side: 'n', from: 39, to: 43 }, { side: 's', from: 38, to: 42 }]);
  g.plateau(3, 3, 33, 17, [[20, 22]]);
  g.vcliff(36, 3, 21, []);
  g.ellipse(12, 50, 4.5, 3.2, T.WATER, 0.5, 4);
  g.ellipse(68, 56, 5, 3, T.WATER, 0.5, 5);
  PATH_HOME(g);
  g.stroke([[41, 0], [41, 6]], 3, T.DIRT, 0.5, 3);
  g.stroke([[40, 58], [40, 64]], 3, T.DIRT, 0.5, 6);
  const defaults = farmCommon(g);
  return { id: 'standard', name: 'Standard Farm', kind: 'farm', w: W, h: H, grid: g.g, defaults, blurb: 'The largest open area for crops and buildings.' };
}

function riverland(): MapDef {
  const g = new Grid(W, H);
  g.border(3, 21, [{ side: 'e', from: 15, to: 19 }, { side: 'n', from: 39, to: 43 }, { side: 's', from: 38, to: 42 }]);
  g.stroke([[0, 31], [14, 29], [26, 33], [40, 30], [52, 34], [66, 30], [80, 32]], 5, T.WATER, 2.2, 7);
  g.stroke([[24, 22], [26, 40], [22, 55], [25, 65]], 4, T.WATER, 2, 8);
  g.stroke([[52, 21], [54, 42], [50, 65]], 4, T.WATER, 2, 9);
  g.stroke([[38, 40], [44, 50], [36, 60]], 3.5, T.WATER, 1.5, 10);
  g.stroke([[3, 22], [40, 21], [79, 22]], 3, T.WATER, 1.6, 12);
  g.ellipse(10, 48, 5, 4, T.WATER, 0.6, 13);
  // bridges
  for (const [x, y, w, h] of [[40, 19, 3, 5], [60, 19, 3, 5], [31, 27, 3, 8], [45, 27, 3, 8], [16, 26, 3, 8], [70, 27, 3, 8], [22, 44, 7, 3], [48, 46, 8, 3]] as const) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g.get(i, j) === T.WATER) g.set(i, j, T.BRIDGE);
  }
  g.plateau(3, 3, 30, 14, [[18, 20]]);
  PATH_HOME(g);
  const defaults = farmCommon(g, { x: 14, y: 6 });
  return { id: 'riverland', name: 'Riverland Farm', kind: 'farm', w: W, h: H, grid: g.g, defaults, blurb: 'Islands split by rivers. Great fishing, less farmland.' };
}

function forest(): MapDef {
  const g = new Grid(W, H);
  g.border(3, 31, [{ side: 'e', from: 15, to: 19 }, { side: 'n', from: 39, to: 43 }, { side: 's', from: 38, to: 42 }]);
  const n = noise2(32);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const left = x < 16 + n(x * 0.15, y * 0.15) * 6;
    const bottom = y > 50 + n(x * 0.12, y * 0.2) * 5 && x < 60;
    if ((left || bottom) && g.get(x, y) === T.GRASS && n(x * 0.5 + 9, y * 0.5) > 0.32) g.set(x, y, T.FOREST);
  }
  g.ellipse(10, 30, 3, 4, T.GRASS, 0.5, 33);
  g.ellipse(30, 57, 4, 2.5, T.GRASS, 0.5, 34);
  g.stroke([[3, 8], [20, 10], [35, 6], [50, 9]], 2.5, T.WATER, 1, 35);
  g.ellipse(70, 52, 4, 3, T.WATER, 0.6, 36);
  g.plateau(20, 3, 18, 12, [[27, 29]]);
  PATH_HOME(g);
  g.stroke([[40, 58], [40, 64]], 3, T.DIRT, 0.5, 37);
  const defaults = farmCommon(g, { x: 25, y: 5 });
  return { id: 'forest', name: 'Forest Farm', kind: 'farm', w: W, h: H, grid: g.g, defaults, blurb: 'Woodland with regrowing stumps and forage; less open land.' };
}

function hilltop(): MapDef {
  const g = new Grid(W, H);
  g.border(3, 41, [{ side: 'e', from: 15, to: 19 }, { side: 'n', from: 39, to: 43 }, { side: 's', from: 38, to: 42 }]);
  g.stroke([[5, 0], [7, 18], [4, 36], [8, 52], [6, 65]], 4, T.WATER, 1.6, 42);
  g.plateau(10, 3, 26, 15, [[20, 22]]);
  // quarry
  g.ellipse(26, 44, 13, 9, T.ROCK, 1, 43);
  g.ellipse(26, 44, 15, 11, T.GRASS, 0, 0);
  g.ellipse(26, 44, 13, 9, T.ROCK, 1, 43);
  for (let i = 12; i < 40; i++) { if (g.get(i, 33) === T.GRASS) g.set(i, 33, T.CLIFF); if (g.get(i, 34) === T.GRASS) g.set(i, 34, T.CLIFF); }
  g.plateau(50, 40, 26, 21, [[60, 62]]);
  g.vcliff(49, 40, 62, [[48, 50]]);
  g.ellipse(68, 50, 3.5, 2.5, T.WATER, 0.5, 44);
  PATH_HOME(g);
  const defaults = farmCommon(g, { x: 16, y: 6 });
  return { id: 'hilltop', name: 'Hill-top Farm', kind: 'farm', w: W, h: H, grid: g.g, defaults, blurb: 'Multi-level farm with a mining quarry that spawns ore.' };
}

function wilderness(): MapDef {
  const g = new Grid(W, H);
  g.border(3, 51, [{ side: 'e', from: 15, to: 19 }, { side: 'n', from: 39, to: 43 }, { side: 's', from: 38, to: 42 }]);
  g.plateau(3, 3, 38, 18, [[24, 26]]);
  g.vcliff(41, 3, 22, []);
  g.plateau(44, 38, 33, 23, [[58, 60]]);
  g.vcliff(43, 38, 62, [[50, 52]]);
  g.ellipse(14, 45, 7, 5, T.WATER, 0.7, 52);
  g.stroke([[3, 33], [12, 36], [16, 40]], 3, T.WATER, 1, 53);
  g.ellipse(66, 28, 4, 2.5, T.WATER, 0.5, 54);
  g.stroke([[44, 30], [52, 30]], 2, T.DIRT, 0.4, 55);
  PATH_HOME(g);
  const defaults = farmCommon(g, { x: 18, y: 8 });
  return { id: 'wilderness', name: 'Wilderness Farm', kind: 'farm', w: W, h: H, grid: g.g, defaults, blurb: 'Cliffs and ponds; monsters spawn at night.' };
}

function fourCorners(): MapDef {
  const g = new Grid(W, H);
  g.border(3, 61, [{ side: 'e', from: 15, to: 19 }, { side: 'n', from: 39, to: 43 }, { side: 's', from: 38, to: 42 }]);
  // NW quadrant raised (greenhouse), SE quadrant raised
  g.plateau(3, 3, 36, 28, [[18, 20]]);
  g.vcliff(39, 3, 32, [[22, 24]]);
  g.plateau(42, 36, 35, 25, [[60, 62]]);
  g.vcliff(41, 36, 62, [[46, 48]]);
  g.ellipse(64, 28, 6, 4, T.WATER, 0.6, 62);
  g.ellipse(20, 50, 4, 3, T.WATER, 0.5, 63);
  // SW quadrant: forest edge for foraging
  const n = noise2(64);
  for (let y = 38; y < 62; y++) for (let x = 3; x < 14; x++) if (n(x * 0.4, y * 0.4) > 0.55 && g.get(x, y) === T.GRASS) g.set(x, y, T.FOREST);
  PATH_HOME(g);
  const defaults = farmCommon(g, { x: 14, y: 8 });
  return { id: 'four-corners', name: 'Four Corners Farm', kind: 'farm', w: W, h: H, grid: g.g, defaults, blurb: 'Four distinct quadrants; designed for co-op.' };
}

function beach(): MapDef {
  const g = new Grid(W, H);
  g.border(3, 71, [{ side: 'e', from: 15, to: 19 }, { side: 'n', from: 39, to: 43 }, { side: 's', from: 0, to: 79 }, { side: 'e', from: 25, to: 64 }]);
  const n = noise2(72);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const shore = 44 + n(x * 0.1, 1) * 6 - Math.max(0, x - 50) * 0.35;
    if (y > shore + 7) g.set(x, y, T.DEEP);
    else if (y > shore + 3) g.set(x, y, T.WATER);
    else if (y > shore - 7 && g.get(x, y) !== T.FOREST) g.set(x, y, T.SAND);
  }
  g.ellipse(22, 22, 4, 3, T.WATER, 0.6, 73);
  g.stroke([[30, 30], [46, 42]], 2, T.DIRT, 0.5, 74);
  g.plateau(3, 3, 30, 12, [[16, 18]]);
  PATH_HOME(g);
  const defaults = farmCommon(g, { x: 14, y: 5 });
  return { id: 'beach', name: 'Beach Farm', kind: 'farm', w: W, h: H, grid: g.g, defaults, blurb: 'Sandy shores and ocean fishing; sprinklers do not work on sand.' };
}

function meadowlands(): MapDef {
  const g = new Grid(W, H);
  g.border(3, 81, [{ side: 'e', from: 15, to: 19 }, { side: 'n', from: 39, to: 43 }, { side: 's', from: 38, to: 42 }]);
  g.ellipse(22, 44, 7, 4.5, T.WATER, 0.8, 82);
  g.ellipse(58, 50, 4, 3, T.WATER, 0.5, 83);
  const n = noise2(84);
  for (let y = 25; y < 62; y++) for (let x = 3; x < 77; x++) if (n(x * 0.3, y * 0.3) > 0.78 && g.get(x, y) === T.GRASS) g.set(x, y, T.FOREST);
  g.plateau(3, 3, 30, 14, [[18, 20]]);
  PATH_HOME(g);
  g.stroke([[40, 58], [40, 64]], 3, T.DIRT, 0.5, 85);
  const defaults = farmCommon(g, { x: 14, y: 6 });
  return { id: 'meadowlands', name: 'Meadowlands Farm', kind: 'farm', w: W, h: H, grid: g.g, defaults, blurb: 'Rolling grassland; starts with a coop and chickens.' };
}

// ------------------------------------------------------------------ interiors
function room(id: string, name: string, w: number, h: number, wallRows: number, floor: number, blurb: string, extra?: (g: Grid) => void): MapDef {
  const g = new Grid(w, h, floor);
  for (let x = 0; x < w; x++) { g.set(x, 0, T.VOID); g.set(x, h - 1, T.VOID); }
  for (let y = 0; y < h; y++) { g.set(0, y, T.VOID); g.set(w - 1, y, T.VOID); }
  g.rect(1, 1, w - 2, wallRows, T.WALL);
  extra?.(g);
  return { id, name, kind: 'interior', w, h, grid: g.g, defaults: [], blurb };
}

function greenhouse(): MapDef {
  return room('greenhouse', 'Greenhouse', 20, 22, 3, T.STONEFLOOR, 'Grow any crop in any season. Fruit trees fit around the edges.', (g) => {
    g.rect(4, 6, 12, 10, T.SOIL);
  });
}

const shed = () => room('shed', 'Shed', 13, 14, 3, T.FLOOR, 'Indoor space for machines, kegs and decor.');
const bigShed = () => room('big-shed', 'Big Shed', 19, 19, 3, T.FLOOR, 'An upgraded shed with much more room.');
const farmhouse = () => room('farmhouse', 'Farmhouse', 26, 18, 3, T.FLOOR, 'Plan furniture, rugs and wall decor for your home.', (g) => {
  // inner wall dividing bedroom
  for (let y = 4; y < 11; y++) g.set(17, y, T.WALL);
});
const cellar = () => room('cellar', 'Cellar', 22, 16, 3, T.STONEFLOOR, 'Plan cask rows for aging wine and cheese.');
const cabinRoom = () => room('cabin', 'Cabin', 14, 12, 3, T.FLOOR, 'A small farmhand cabin interior.');

export const MAPS: (() => MapDef)[] = [standard, riverland, forest, hilltop, wilderness, fourCorners, beach, meadowlands, greenhouse, shed, bigShed, farmhouse, cellar, cabinRoom];

// ------------------------------------------------------------------ terrain renderer
type Pal = { grass: RGBA[]; high: RGBA[]; dirt: RGBA[]; water: RGBA[]; deep: RGBA[]; sand: RGBA[]; forest: RGBA[]; leaves: RGBA[][]; rock: RGBA[]; cliff: RGBA[]; snow: boolean };

const P = (...h: string[]) => h.map((x) => hex(x));
const PALETTES: Record<Season, Pal> = {
  spring: { grass: P('#4f9e34', '#5cad3a', '#6abf44', '#7acb4e'), high: P('#58a838', '#66b740', '#74c64a', '#84d256'), dirt: P('#9a6c40', '#ab7c4a', '#bc8c56', '#cc9c64'), water: P('#2f74c0', '#3a86d2', '#4a98e0', '#8ac8f4'), deep: P('#1e4f96', '#255ca8', '#2c68b8', '#5a98d8'), sand: P('#d8c080', '#e4cc8e', '#eed89c', '#f6e4b0'), forest: P('#244a26', '#2d5a2e', '#376a36'), leaves: [P('#2a6a2e', '#3a8a3a', '#4aa046', '#62b852'), P('#2d6e34', '#3e8e42', '#52a24c', '#6cba5c')], rock: P('#6e6a68', '#807c78', '#94908a', '#a8a49c'), cliff: P('#5c4430', '#71553c', '#866848', '#9a7a56'), snow: false },
  summer: { grass: P('#3a8a2e', '#469a34', '#52aa3c', '#62b848'), high: P('#409232', '#4ca23a', '#5ab244', '#6ac050'), dirt: P('#9a6c40', '#ab7c4a', '#bc8c56', '#cc9c64'), water: P('#2a6eba', '#3480cc', '#4292dc', '#86c4f2'), deep: P('#1a4890', '#2256a2', '#2a64b4', '#5694d4'), sand: P('#dcc282', '#e8ce90', '#f0da9e', '#f8e6b2'), forest: P('#1e4220', '#26522a', '#2e6232'), leaves: [P('#235e28', '#2e7a32', '#3a903c', '#4ea84a'), P('#26622c', '#327e36', '#409440', '#56aa4e')], rock: P('#6e6a68', '#807c78', '#94908a', '#a8a49c'), cliff: P('#5c4430', '#71553c', '#866848', '#9a7a56'), snow: false },
  fall: { grass: P('#8a7a2e', '#9c8a36', '#ae9a40', '#c0aa4c'), high: P('#94822e', '#a69238', '#b8a242', '#c8b250'), dirt: P('#8e623a', '#9f7244', '#b08250', '#c0925e'), water: P('#2a66aa', '#3478bc', '#428acc', '#84bce6'), deep: P('#1a4486', '#225296', '#2a60a6', '#568ec8'), sand: P('#d0b478', '#dcc086', '#e6cc94', '#f0d8a8'), forest: P('#3a3420', '#4a4228', '#5a5030'), leaves: [P('#7a3a1a', '#a8501e', '#cc6a24', '#e4902e'), P('#6a4a1a', '#9a6a1e', '#c08a26', '#dcaa34'), P('#6a2a1a', '#96361e', '#b84a26', '#d46a34')], rock: P('#6a6662', '#7c7872', '#908a84', '#a49e96'), cliff: P('#584030', '#6c523a', '#806446', '#947654'), snow: false },
  winter: { grass: P('#c4d4e2', '#d4e2ee', '#e2ecf6', '#f2f6fc'), high: P('#cad8e6', '#dae6f0', '#e8f0f8', '#f6f9fd'), dirt: P('#a8a4a8', '#b8b6bc', '#c8c8d0', '#dadce4'), water: P('#4a86c0', '#5a98d0', '#6eaade', '#b4dcf4'), deep: P('#2a5a98', '#3468aa', '#3e76ba', '#78a8d8'), sand: P('#d4ccc0', '#e0dad0', '#eae6de', '#f4f2ee'), forest: P('#2e3e3e', '#364a48', '#3e5652'), leaves: [P('#24423a', '#2e5648', '#3a6a56', '#e8f0f6'), P('#2a4a40', '#36604e', '#44745e', '#f0f4f8')], rock: P('#8a8a92', '#9c9ca4', '#b0b0b8', '#c4c4cc'), cliff: P('#5e5450', '#70645e', '#84766e', '#988a80'), snow: true },
};

const TS = 16;
const SOFT = [T.GRASS, T.HIGH, T.DIRT, T.SAND, T.WATER, T.DEEP, T.ROCK, T.SOIL];
const isSoft = (c: number) => SOFT.includes(c as any);
const isWaterish = (c: number) => c === T.WATER || c === T.DEEP;

function hash2(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Renders a map's terrain to an image at 16px per tile. */
export function renderMap(def: MapDef, season: Season): Img {
  const { w, h, grid } = def;
  const W = w * TS, H = h * TS;
  const img = new Img(W, H);
  const pal = PALETTES[season];
  const code = (x: number, y: number) => grid[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  const rng = new Rng(def.id + season);
  const n = noise2(def.id.length * 97 + 5);
  const n2 = noise2(def.id.length * 31 + 7);

  // ---- 1. per-pixel material from smoothed tile fields (rounded, organic edges)
  const mat = new Uint8Array(W * H);
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) {
    const tx = Math.floor(gx / TS), ty = Math.floor(gy / TS);
    const own = code(tx, ty);
    if (!isSoft(own)) { mat[gy * W + gx] = own; continue; }
    const fx = (gx + 0.5) / TS - 0.5, fy = (gy + 0.5) / TS - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
    const corners: [number, number][] = [[x0, y0], [x0 + 1, y0], [x0, y0 + 1], [x0 + 1, y0 + 1]];
    const wts = [(1 - ax) * (1 - ay), ax * (1 - ay), (1 - ax) * ay, ax * ay];
    const score = new Map<number, number>();
    for (let k = 0; k < 4; k++) {
      let c = code(corners[k][0], corners[k][1]);
      if (!isSoft(c)) c = own; // hard neighbors don't bleed
      score.set(c, (score.get(c) ?? 0) + wts[k]);
    }
    let best = own, bv = -1;
    const wob = (n2(gx * 0.11, gy * 0.11) - 0.5) * 0.35;
    for (const [c, v0] of score) {
      const v = v0 + (c === own ? 0.02 : 0) + (c === T.WATER || c === T.DIRT || c === T.SAND ? wob : 0);
      if (v > bv) { bv = v; best = c; }
    }
    mat[gy * W + gx] = best;
  }
  const M = (x: number, y: number) => mat[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))];

  // ---- 2. base colors (2px blocks keep a crisp pixel-art grain and compress well)
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) {
    const c = mat[gy * W + gx];
    const bx = gx >> 1, by = gy >> 1;
    const r = hash2(bx, by);
    const patch = n(gx * 0.035, gy * 0.035);
    const pick4 = (p: RGBA[]) => p[patch > 0.55 ? (r < 0.15 ? 3 : r < 0.85 ? 2 : 1) : (r < 0.12 ? 2 : r < 0.88 ? 1 : 0)];
    let col: RGBA;
    const tx = Math.floor(gx / TS), ty = Math.floor(gy / TS), px = gx % TS, py = gy % TS;
    switch (c) {
      case T.GRASS: col = pick4(pal.grass); break;
      case T.HIGH: col = pick4(pal.high); break;
      case T.DIRT: col = pick4(pal.dirt); break;
      case T.SAND: col = pick4(pal.sand); break;
      case T.ROCK: col = pick4(pal.rock); break;
      case T.WATER: col = pal.water[patch > 0.5 ? 2 : 1]; break;
      case T.DEEP: col = pal.deep[patch > 0.5 ? 2 : 1]; break;
      case T.FOREST: col = pal.forest[r < 0.5 ? 1 : patch > 0.5 ? 2 : 0]; break;
      case T.CLIFF: {
        const stripe = Math.floor((gx + Math.floor(n(gx * 0.3, 3) * 6)) / 4) % 3;
        col = pal.cliff[Math.min(3, stripe + (py > 10 ? 0 : 1))];
        if (gy % 8 === 0 && hash2(gx >> 2, gy) < 0.7) col = pal.cliff[0];
        break;
      }
      case T.BRIDGE: {
        const vertical = isWaterish(code(tx - 1, ty)) && isWaterish(code(tx + 1, ty));
        const v = vertical ? py : px;
        col = hex(Math.floor(v / 4) % 2 ? '#a07040' : '#b4844e');
        if (v % 4 === 3) col = hex('#6a4626');
        if ((vertical ? px : py) === 0 || (vertical ? px : py) === 15) col = hex('#5a3a20');
        break;
      }
      case T.FLOOR: {
        const plank = Math.floor(gy / 5);
        const off = (plank * 7) % 16;
        col = hex(plank % 2 ? '#b8865a' : '#c49464');
        if (gy % 5 === 4 || (gx + off) % 16 === 0) col = hex('#8a5e3a');
        break;
      }
      case T.STONEFLOOR: {
        col = hex((Math.floor(gx / 8) + Math.floor(gy / 8)) % 2 ? '#a8a8ae' : '#b6b6bc');
        if (gx % 8 === 0 || gy % 8 === 0) col = hex('#86868e');
        break;
      }
      case T.WALL: {
        col = (Math.floor(gx / 4) % 2) ? hex('#d8c098') : hex('#e2cca6');
        if (code(tx, ty + 1) !== T.WALL && py >= 12) col = py === 12 ? hex('#6a4626') : hex('#8a5e3a');
        if (code(tx, ty - 1) !== T.WALL && py < 2) col = hex('#6a4626');
        break;
      }
      case T.SOIL: {
        col = (gy % 4 === 1) ? hex('#5a3a22') : hex('#6e4a2c');
        if (hash2(gx, gy) < 0.04) col = hex('#8a6040');
        break;
      }
      default: col = hex('#1a1014');
    }
    img.px(gx, gy, col);
  }

  // ---- 3. pixel-level edges: shorelines, path lips
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) {
    const c = mat[gy * W + gx];
    if (isWaterish(c)) {
      let d = 9;
      for (let k = 1; k <= 3 && d === 9; k++) {
        for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) {
          const o = M(gx + dx, gy + dy);
          if (!isWaterish(o) && o !== T.BRIDGE) { d = k; break; }
        }
      }
      if (d === 1) img.px(gx, gy, pal.water[3]);
      else if (d === 2) img.px(gx, gy, mix(pal.water[2], pal.water[3], 0.4));
      else if (c === T.WATER) {
        // ripples
        if (hash2(gx >> 2, gy) < 0.03 && (gy % 3 === 0)) img.hline(gx, gy, 3, pal.water[3]);
      }
      continue;
    }
    if (c === T.GRASS || c === T.HIGH || c === T.DIRT || c === T.SAND) {
      // wet edge next to water
      let near = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) if (isWaterish(M(gx + dx, gy + dy))) { near = true; break; }
      if (near) { img.px(gx, gy, c === T.SAND ? pal.sand[0] : shade(pal.dirt[1], -0.1)); continue; }
    }
    if (c === T.GRASS || c === T.HIGH) {
      const below = M(gx, gy + 1), right = M(gx + 1, gy), left = M(gx - 1, gy), above = M(gx, gy - 1);
      const soft = (o: number) => o === T.DIRT || o === T.SAND || o === T.ROCK;
      if (soft(below)) img.px(gx, gy, (c === T.HIGH ? pal.high : pal.grass)[0]);
      else if (soft(right) || soft(left) || soft(above)) img.px(gx, gy, (c === T.HIGH ? pal.high : pal.grass)[1]);
    }
  }

  // ---- 4. tile details
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    const c = code(tx, ty);
    const X = tx * TS, Y = ty * TS;
    if (c === T.GRASS || c === T.HIGH) {
      const p = c === T.HIGH ? pal.high : pal.grass;
      if (rng.chance(0.55)) {
        // grass tuft (a little "w" of blades)
        const gx = X + 3 + rng.int(10), gy = Y + 4 + rng.int(9);
        if (mat[gy * W + gx] === c) {
          if (pal.snow) { img.px(gx, gy, hex('#b4c4d6')); img.px(gx + 1, gy, hex('#c4d2e2')); }
          else {
            img.px(gx, gy, p[0]); img.px(gx, gy - 1, p[3]); img.px(gx + 2, gy, p[0]); img.px(gx + 2, gy - 1, p[3]); img.px(gx + 1, gy - 2, p[3]); img.px(gx + 1, gy - 1, p[0]);
          }
        }
      }
      if (!pal.snow && rng.chance(season === 'spring' ? 0.06 : season === 'summer' ? 0.035 : 0.02)) {
        const fc = season === 'fall' ? rng.pick([hex('#e07a2a'), hex('#c84a2a')]) : rng.pick([hex('#f0e070'), hex('#f4f0f8'), hex('#e87aa0'), hex('#8ab0f0')]);
        const fx = X + 3 + rng.int(10), fy = Y + 3 + rng.int(10);
        img.px(fx, fy - 1, fc); img.px(fx - 1, fy, fc); img.px(fx + 1, fy, fc); img.px(fx, fy + 1, fc); img.px(fx, fy, hex('#f8f0a0'));
      }
      if (season === 'fall' && rng.chance(0.3)) { const lx = X + rng.int(15), ly = Y + rng.int(15); img.px(lx, ly, hex('#c8602a')); img.px(lx + 1, ly, hex('#a8481e')); }
    }
    if ((c === T.DIRT || c === T.SAND || c === T.ROCK) && rng.chance(0.5)) {
      const gx = X + 3 + rng.int(10), gy = Y + 3 + rng.int(10);
      const pc = c === T.ROCK ? pal.rock : c === T.SAND ? pal.sand : pal.dirt;
      if (mat[gy * W + gx] === c) { img.px(gx, gy, pc[3]); img.px(gx + 1, gy, pc[3]); img.px(gx, gy + 1, pc[0]); img.px(gx + 1, gy + 1, pc[0]); }
      if (c === T.ROCK && rng.chance(0.3)) { img.blob(X + 8, Y + 8, 4 + rng.int(2), 3, ramp(pal.rock[2])); img.hline(X + 4, Y + 11, 8, pal.rock[0]); }
      if (c === T.SAND && rng.chance(0.08)) { img.px(gx + 3, gy + 2, hex('#f4ecf0')); img.px(gx + 4, gy + 2, hex('#e8a8b8')); }
    }
    if (c === T.CLIFF) {
      const up = code(tx, ty - 1), dn = code(tx, ty + 1);
      if (up === T.HIGH || up === T.GRASS) {
        const p = up === T.HIGH ? pal.high : pal.grass;
        for (let i = 0; i < TS; i++) { const j = 2 + ((i * 7 + tx) % 3); img.vline(X + i, Y, j, p[1]); img.px(X + i, Y + j, p[0]); }
      }
      if (dn !== T.CLIFF) img.rect(X, Y + TS - 2, TS, 2, shade(pal.cliff[0], -0.25));
      if (code(tx - 1, ty) !== T.CLIFF && code(tx - 1, ty) !== T.FOREST) img.vline(X, Y, TS, pal.cliff[3]);
      if (code(tx + 1, ty) !== T.CLIFF && code(tx + 1, ty) !== T.FOREST) img.vline(X + TS - 1, Y, TS, pal.cliff[0]);
      if (rng.chance(0.2) && !pal.snow) { img.px(X + 4 + rng.int(8), Y + 6 + rng.int(6), hex('#4a8a3a')); }
    }
    if ((c === T.GRASS || c === T.DIRT || c === T.SAND) && (code(tx, ty - 1) === T.CLIFF || code(tx, ty - 1) === T.FOREST) && ty > 0) {
      img.rect(X, Y, TS, 3, [10, 20, 10, 50]);
      img.rect(X, Y, TS, 1, [10, 20, 10, 40]);
    }
  }

  // ---- 5. forest canopies (back-to-front)
  const crng = new Rng(def.id + 'trees');
  const trees: [number, number, number, number][] = [];
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    if (grid[ty * w + tx] !== T.FOREST) continue;
    if ((tx + ty * 3) % 2 === 0 || crng.chance(0.35)) trees.push([tx * TS + 8 + crng.int(8) - 4, ty * TS + 8 + crng.int(8) - 4, 9 + crng.int(6), crng.int(pal.leaves.length)]);
  }
  trees.sort((a, b) => a[1] - b[1]);
  for (const [cx, cy, r, li] of trees) {
    const lr = pal.leaves[li];
    img.ellipse(cx + 2, cy + r * 0.55, r * 0.9, r * 0.45, [10, 16, 10, 90]);
    img.ellipse(cx, cy, r, r * 0.9, lr[0]);
    img.ellipse(cx - 1, cy - 1, r - 1.2, r * 0.9 - 1.2, lr[1]);
    img.ellipse(cx - r * 0.25, cy - r * 0.3, r * 0.6, r * 0.5, lr[2]);
    img.ellipse(cx - r * 0.4, cy - r * 0.45, r * 0.28, r * 0.22, lr[3]);
    if (pal.snow) img.ellipse(cx - 1, cy - r * 0.55, r * 0.6, r * 0.25, hex('#f4f8fc'));
  }
  return img;
}
