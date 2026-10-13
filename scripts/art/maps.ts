/**
 * Farm & interior layouts (approximations of the game's farm types, authored from
 * scratch as tile grids) and a seasonal terrain renderer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { hex, Img, mix, ramp, RGBA, Rng, shade } from './png';
import type { Season } from './painters';
import { hutchFloor } from './slime-hutch';

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
  /** Rule bits per tile: 1 walkable, 2 buildable, 4 tillable. Missing for hand-made rooms. */
  flags?: Uint8Array;
  author?: string;
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

// ------------------------------------------------------------------ layouts from tile data
/**
 * scripts/data/layouts.json holds facts for each layout of the web planner:
 *  - flags:   one digit per tile (1 = walkable, 2 = buildable, 4 = tillable)
 *  - terrain: one class letter per tile (w water, g grass, d bare ground, s sand, f foliage,
 *             c cliff/wall, r rock, p pale stone, k empty)
 * The maps below are drawn from these facts with the app's own art.
 */
type Raw = {
  name: string; pretty: string | null; author: string | null; pw: number; ph: number; official: boolean; seasons: boolean;
  house: [number, number] | null; greenhouse: [number, number] | null; layers: boolean;
  w?: number; h?: number; flags?: string[]; terrain?: string[]; tw?: number; th?: number;
};
const RAW: Raw[] = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'layouts.json'), 'utf8'));
const RAW_BY_NAME: Record<string, Raw> = Object.fromEntries(RAW.map((r) => [r.name, r]));

const F_WALK = 1, F_BUILD = 2, F_TILL = 4;

/** Connected groups of tiles that match `test` (4-neighbour). Returns a group index per tile, -1 for no group. */
function components(w: number, h: number, test: (i: number) => boolean) {
  const id = new Int32Array(w * h).fill(-1);
  const groups: { size: number; edge: boolean; core: number }[] = [];
  for (let s0 = 0; s0 < w * h; s0++) {
    if (id[s0] !== -1 || !test(s0)) continue;
    const g = { size: 0, edge: false, core: 0 };
    const stack = [s0];
    id[s0] = groups.length;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i / w) | 0;
      g.size++;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) g.edge = true;
      let inner = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) { inner++; continue; }
        const j = ny * w + nx;
        if (!test(j)) continue;
        inner++;
        if (id[j] === -1) { id[j] = groups.length; stack.push(j); }
      }
      if (inner === 4) g.core++;
    }
    groups.push(g);
  }
  return { id, groups };
}

function farmFromData(raw: Raw, id: string, name: string, blurb: string, opts: { sandy?: boolean; author?: string } = {}): MapDef {
  const w = raw.w ?? raw.tw!, h = raw.h ?? raw.th!;
  const grid = new Uint8Array(w * h), flags = new Uint8Array(w * h);
  const cls = (x: number, y: number) => raw.terrain?.[y]?.[x];
  const flag = (x: number, y: number) => (raw.flags ? Number(raw.flags[y]?.[x] ?? 0) : -1);
  // Without a terrain class, guess what blocks a tile: thick inner groups are water, thin ones are cliffs.
  const blocked = raw.terrain ? null : components(w, h, (i) => !(Number(raw.flags![(i / w) | 0][i % w]) & F_WALK));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const c = cls(x, y);
    let f = flag(x, y);
    if (f < 0) f = c && 'gdsp'.includes(c) ? F_WALK | F_BUILD | F_TILL : 0; // no rule data: open ground allows everything
    if (c === 'w') f = 0;
    const walk = !!(f & F_WALK), till = !!(f & F_TILL), build = !!(f & F_BUILD);
    let code: number;
    if (c === 'w') code = T.WATER;
    else if (!walk && !till && !build) {
      if (c === undefined) {
        const g = blocked!.groups[blocked!.id[i]];
        code = g.edge ? T.FOREST : g.core / g.size > 0.3 && g.size > 8 ? T.WATER : g.size <= 3 ? T.ROCK : T.CLIFF;
      } else code = c === 'c' || c === 'r' || c === 'p' ? T.CLIFF : c === 's' ? T.SAND : c === 'd' ? T.CLIFF : T.FOREST;
    } else if (c === 's' || (opts.sandy && c === 'd' && !till)) code = T.SAND;
    else if (till) code = c === 's' ? T.SAND : T.GRASS;
    else if (c === 'g' || c === 'f') code = T.HIGH;
    else code = build || walk ? T.DIRT : T.CLIFF;
    grid[i] = code;
    flags[i] = f;
  }
  // Open sea: water far from land is deep.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (grid[y * w + x] !== T.WATER) continue;
    let land = false;
    for (let dy = -3; dy <= 3 && !land; dy++) for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const o = grid[ny * w + nx];
      if (o !== T.WATER && o !== T.DEEP) { land = true; break; }
    }
    if (!land) grid[y * w + x] = T.DEEP;
  }
  // Fixed buildings. The web planner stores the bottom-left tile of the farmhouse and greenhouse.
  const defaults: MapDef['defaults'] = [];
  if (raw.house) {
    defaults.push({ id: 'farmhouse', x: raw.house[0], y: raw.house[1] - 2 });
    defaults.push({ id: 'shipping-bin', x: raw.house[0] + 12, y: raw.house[1] - 2 });
  }
  if (raw.greenhouse) defaults.push({ id: 'greenhouse', x: raw.greenhouse[0] + 1, y: raw.greenhouse[1] - 7 });
  return { id, name, kind: 'farm', w, h, grid, flags, defaults, blurb, author: opts.author };
}

function roomFromData(raw: Raw, id: string, name: string, blurb: string, floorCode: number = T.FLOOR): MapDef {
  const W0 = raw.w ?? raw.tw!, H0 = raw.h ?? raw.th!;
  const cls = (x: number, y: number) => raw.terrain?.[y]?.[x];
  const isFloor = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W0 || y >= H0) return false;
    if (raw.flags) return !!(Number(raw.flags[y]?.[x] ?? 0) & F_WALK);
    const c = cls(x, y);
    return c !== undefined && c !== 'k' && c !== 'c' && !(id === 'greenhouse' && c === 'w');
  };
  // Crop to the room, with a one-tile margin.
  let x0 = W0, y0 = H0, x1 = 0, y1 = 0;
  for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) if (isFloor(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  x0 = Math.max(0, x0 - 1); x1 = Math.min(W0 - 1, x1 + 1); y0 = Math.max(0, y0 - 3); y1 = Math.min(H0 - 1, y1 + 1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const grid = new Uint8Array(w * h), flags = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = x + x0, gy = y + y0, i = y * w + x;
    if (isFloor(gx, gy)) {
      const soil = id === 'greenhouse' && cls(gx, gy) === 'd';
      grid[i] = soil ? T.SOIL : floorCode;
      flags[i] = F_WALK | (soil ? F_TILL : 0);
    } else {
      // Walls are the three rows above a floor tile.
      const wall = isFloor(gx, gy + 1) || isFloor(gx, gy + 2) || isFloor(gx, gy + 3);
      grid[i] = wall ? T.WALL : T.VOID;
    }
  }
  return { id, name, kind: 'interior', w, h, grid, flags, defaults: [], blurb };
}

const farm = (raw: string, id: string, name: string, blurb: string, opts?: { sandy?: boolean }) => () => farmFromData(RAW_BY_NAME[raw], id, name, blurb, opts);
const interior = (raw: string, id: string, name: string, blurb: string, floor?: number) => () => roomFromData(RAW_BY_NAME[raw], id, name, blurb, floor);

export function cabin(): MapDef {
  const source = roomFromData(RAW_BY_NAME.farmhouse, 'cabin', 'Cabin', 'A farmhand cabin with the starter farmhouse interior.');
  // Retain the old canvas width so saved coordinates are never shifted or removed.
  // The two extra columns are outside the room, not additional usable floor.
  const w = 14;
  const grid = new Uint8Array(w * source.h), flags = new Uint8Array(w * source.h);
  for (let y = 0; y < source.h; y++) {
    grid.set(source.grid.subarray(y * source.w, (y + 1) * source.w), y * w);
    flags.set(source.flags!.subarray(y * source.w, (y + 1) * source.w), y * w);
  }
  return { ...source, w, grid, flags };
}

export function slimeHutch(): MapDef {
  const w = 20, h = 15; // Preserve legacy saved coordinates and canvas bounds.
  const grid = new Uint8Array(w * h), flags = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (hutchFloor(x, y)) { grid[y * w + x] = T.FLOOR; flags[y * w + x] = F_WALK; }
    else if (x >= 1 && x <= 16 && y >= 1 && y <= 3) grid[y * w + x] = T.WALL;
  }
  return { id: 'slime-hutch', name: 'Slime Hutch', kind: 'interior', w, h, grid, flags,
    defaults: [{ id: 'slime-incubator', x: 1, y: 4 }], blurb: 'Plan around the water troughs. Holds 20 slimes.' };
}

// ------------------------------------------------------------------ hand-made rooms (no tile data)
function room(id: string, name: string, w: number, h: number, wallRows: number, floor: number, blurb: string, extra?: (g: Grid) => void): MapDef {
  const g = new Grid(w, h, floor);
  for (let x = 0; x < w; x++) { g.set(x, 0, T.VOID); g.set(x, h - 1, T.VOID); }
  for (let y = 0; y < h; y++) { g.set(0, y, T.VOID); g.set(w - 1, y, T.VOID); }
  g.rect(1, 1, w - 2, wallRows, T.WALL);
  extra?.(g);
  return { id, name, kind: 'interior', w, h, grid: g.g, defaults: [], blurb };
}

/** Community layouts that have tile data. Each one credits its author, as the web planner does. */
const COMMUNITY = RAW.filter((r) => !r.official && r.layers && r.author).map((r) => () =>
  farmFromData(r, r.name, r.pretty ?? r.name, `Community layout by ${r.author}.`, { author: r.author! }));

export const MAPS: (() => MapDef)[] = [
  farm('regular', 'standard', 'Standard Farm', 'The largest open area for crops and buildings.'),
  farm('fishing', 'riverland', 'Riverland Farm', 'Islands split by rivers. Great fishing, less farmland.'),
  farm('foraging', 'forest', 'Forest Farm', 'Woodland with regrowing stumps and forage; less open land.'),
  farm('mining', 'hilltop', 'Hill-top Farm', 'Multi-level farm with a mining quarry that spawns ore.'),
  farm('combat', 'wilderness', 'Wilderness Farm', 'Cliffs and ponds; monsters spawn at night.'),
  farm('fourcorners', 'four-corners', 'Four Corners Farm', 'Four distinct quadrants; designed for co-op.'),
  farm('beach', 'beach', 'Beach Farm', 'Sandy shores and ocean fishing; sprinklers do not work on sand.', { sandy: true }),
  farm('ranching', 'meadowlands', 'Meadowlands Farm', 'Rolling grassland; starts with a coop and chickens.'),
  farm('ginger_island', 'ginger-island', 'Ginger Island', 'Tropical island. Crops grow all year here.', { sandy: true }),
  farm('quarry', 'quarry', 'Quarry', 'The mountain quarry, for players who build there.'),
  ...COMMUNITY,
  // The greenhouse is 20x24 tiles with a 12x10 soil bed, as in the game.
  () => room('greenhouse', 'Greenhouse', 20, 24, 4, T.STONEFLOOR, 'Grow any crop in any season. Fruit trees fit around the edges.', (g) => g.rect(4, 10, 12, 10, T.SOIL)),
  interior('shed', 'shed', 'Shed', 'Indoor space for machines, kegs and decor.'),
  interior('shed-big', 'big-shed', 'Big Shed', 'An upgraded shed with much more room.'),
  interior('farmhouse', 'farmhouse-0', 'Farmhouse', 'The starter farmhouse. One room.'),
  interior('farmhouse_upgraded_1', 'farmhouse-1', 'Farmhouse Tier 1', 'First upgrade. Adds a kitchen.'),
  interior('farmhouse_upgraded_1_marriage', 'farmhouse-1m', 'Farmhouse Tier 1 (Marriage)', 'First upgrade with a spouse room.'),
  interior('farmhouse_upgraded_2', 'farmhouse', 'Farmhouse Tier 2', 'Second upgrade. Plan furniture, rugs and wall decor.'),
  interior('farmhouse_upgraded_2_marriage', 'farmhouse-2m', 'Farmhouse Tier 2 (Marriage)', 'Second upgrade with a spouse room.'),
  interior('farmhouse_cellar', 'cellar', 'Cellar', 'Plan cask rows for aging wine and cheese.', T.STONEFLOOR),
  cabin,
  interior('barn', 'barn', 'Barn', 'Barn interior. Houses 4 animals.'),
  interior('barn-big', 'big-barn', 'Big Barn', 'Big Barn interior. Houses 8 animals.'),
  interior('barn-deluxe', 'deluxe-barn', 'Deluxe Barn', 'Deluxe Barn interior. Houses 12 animals.'),
  interior('coop', 'coop', 'Coop', 'Coop interior. Houses 4 animals.'),
  interior('coop-big', 'big-coop', 'Big Coop', 'Big Coop interior. Houses 8 animals.'),
  interior('coop-deluxe', 'deluxe-coop', 'Deluxe Coop', 'Deluxe Coop interior. Houses 12 animals.'),
  slimeHutch,
];

/** Sizes of community layouts without tile data. The app offers them as presets for a custom layout image. */
export const LAYOUT_PRESETS = RAW.filter((r) => !r.official && !r.layers && r.author)
  .map((r) => ({ name: r.pretty ?? r.name, author: r.author!, w: Math.round(r.pw / 16), h: Math.round(r.ph / 16) }));

// ------------------------------------------------------------------ terrain renderer
import { hashStr } from './png';

type Pal = {
  /** 0 dark patch, 1 base, 2 light patch, 3 blade dark, 4 blade light, 5 rim */
  grass: RGBA[]; high: RGBA[];
  /** 0 shadow rim, 1 dark patch, 2 base, 3 light patch, 4 pebble light, 5 pebble dark */
  dirt: RGBA[]; sand: RGBA[];
  /** 0 deep, 1 base, 2 mid, 3 shallow, 4 sparkle, 5 waterline */
  water: RGBA[];
  /** 0 dark, 1 base, 2 light, 3 wave line */
  deep: RGBA[];
  /** rock face: 0 outline, 1 dark, 2 mid, 3 light, 4 highlight */
  cliff: RGBA[];
  /** rock plateau: 0 crack, 1 base, 2 light */
  top: RGBA[];
  /** forest floor: 0 dark, 1 base */
  floor: RGBA[];
  /** tree crowns: 0 outline, 1 dark, 2 mid, 3 light, 4 highlight */
  leaves: RGBA[][];
  pine: RGBA[];
  /** 0 earth, 1 dark earth, 2 bank line */
  bank: RGBA[];
  snow: boolean;
};

const P = (...h: string[]) => h.map((x) => hex(x));
const EVERGREEN = P('#10282a', '#1c4a3c', '#2a6a4c', '#3f8a5a', '#66aa6c');
const ROCKFACE = P('#3b2a26', '#5f4636', '#7b5d45', '#977756', '#b6966e');
const ROCKTOP = P('#7f6a52', '#9a8466', '#b09a7a');
const EARTH = P('#7a5636', '#5a3d28', '#4a3222');
const PALETTES: Record<Season, Pal> = {
  spring: {
    grass: P('#58a63c', '#61b041', '#6aba47', '#3f8a32', '#93d25c', '#357a2e'),
    high: P('#489839', '#50a13e', '#58aa43', '#337a31', '#7cc256', '#2b6a2c'),
    dirt: P('#8a6038', '#ab7d4b', '#b88a54', '#c3965e', '#dcb884', '#6f4a2a'),
    sand: P('#cfae6e', '#e3cc8e', '#ead596', '#efdc9f', '#fcf4de', '#b39058'),
    water: P('#2f6ec0', '#3a80d0', '#4c94de', '#84c4f0', '#d2f0fc', '#1f4a8a'),
    deep: P('#1d4a94', '#2358a6', '#2a66b4', '#4f8fd2'),
    cliff: ROCKFACE, top: ROCKTOP, floor: P('#1f4424', '#28522a'),
    leaves: [
      P('#16361e', '#27622c', '#3a8a38', '#55a845', '#82ca5c'),
      P('#1a3a1c', '#31702a', '#4a9634', '#6ab443', '#9ad45e'),
      P('#16361e', '#2a6a36', '#3e9048', '#5cb05a', '#8cd078'),
      P('#5a2444', '#a8507c', '#d67fa6', '#f0aac8', '#fde0ec'),
    ],
    pine: EVERGREEN, bank: EARTH, snow: false,
  },
  summer: {
    grass: P('#43932f', '#4b9c34', '#54a53a', '#2f7a2a', '#7cc24c', '#286a26'),
    high: P('#37872f', '#3e9034', '#469939', '#266b29', '#66b048', '#205c25'),
    dirt: P('#8a6038', '#ab7d4b', '#b88a54', '#c3965e', '#dcb884', '#6f4a2a'),
    sand: P('#d2b070', '#e6ce90', '#edd798', '#f2dea1', '#fcf4de', '#b39058'),
    water: P('#2a69ba', '#3379ca', '#448dda', '#7ebeee', '#d0eefc', '#1c4686'),
    deep: P('#1a4690', '#2054a2', '#2862b0', '#4c8cd0'),
    cliff: ROCKFACE, top: ROCKTOP, floor: P('#183a20', '#204826'),
    leaves: [
      P('#102e1e', '#1e5228', '#2c7432', '#42903c', '#66ae4e'),
      P('#12301e', '#235a2e', '#33803a', '#4a9c44', '#72b858'),
      P('#122e16', '#2a5c22', '#3e7e2a', '#589a36', '#80b84c'),
    ],
    pine: EVERGREEN, bank: EARTH, snow: false,
  },
  fall: {
    grass: P('#b3a03e', '#b9a641', '#bfac45', '#8a742c', '#e0c860', '#786426'),
    high: P('#9c9038', '#a5993d', '#aea243', '#766a2a', '#c8b854', '#665a25'),
    dirt: P('#845a36', '#a37546', '#b0824f', '#bb8e58', '#d6b07e', '#6a4628'),
    sand: P('#c8a66a', '#dcc488', '#e3cd90', '#e8d499', '#f8f0d8', '#ab8a54'),
    water: P('#2c66ae', '#3676be', '#4689cc', '#80b8e4', '#cce8f6', '#1e447e'),
    deep: P('#1b4488', '#215098', '#285ea8', '#4c88c6'),
    cliff: ROCKFACE, top: ROCKTOP, floor: P('#3a2e1c', '#473a22'),
    leaves: [
      P('#4a2212', '#8c3d18', '#c05e1e', '#e08528', '#f4b040'),
      P('#451616', '#842820', '#b43c26', '#d45c30', '#ec8a44'),
      P('#4a3612', '#8e6a1a', '#c09422', '#e0b830', '#f6dc5c'),
      P('#4a2212', '#963f16', '#cc6a1e', '#e89a2a', '#f8c44a'),
      P('#2a3416', '#4c5e22', '#6e822c', '#8ea23a', '#b2c050'),
    ],
    pine: EVERGREEN, bank: EARTH, snow: false,
  },
  winter: {
    grass: P('#d9e5f1', '#e6eef7', '#f1f6fb', '#b7c9dd', '#ffffff', '#a9bdd4'),
    high: P('#cbdaea', '#d8e4f0', '#e4edf6', '#a8bcd4', '#f6fafd', '#9ab0ca'),
    dirt: P('#857a7c', '#a59a9a', '#b3a9a8', '#c2b9b8', '#e0dcdc', '#6c6164'),
    sand: P('#b9b2a6', '#d2ccc0', '#e0dbd1', '#ebe7df', '#fbfbfb', '#989184'),
    water: P('#5a90c2', '#6ca2d0', '#84b6dc', '#b6dbf0', '#f0f9fe', '#3c6c9c'),
    deep: P('#2c5c9c', '#3468aa', '#3e76b8', '#74a6d6'),
    cliff: P('#34303a', '#56505a', '#6f676e', '#8a8086', '#a69ea2'),
    top: P('#c2d1e2', '#dfe8f2', '#f2f6fb'),
    floor: P('#8296b0', '#90a4bc'),
    leaves: [P('#12262c', '#1e443e', '#2c5e4c', '#3c785c', '#5a9870'), P('#332a2c', '#4e4244', '#685a5a', '#847474', '#a09090')],
    pine: P('#10262c', '#1c463e', '#2a624c', '#3c7e5a', '#5a9c6c'), bank: P('#6e5a50', '#52423c', '#443634'), snow: true,
  },
};

const TS = 16;
const SNOW_C = hex('#f4f8fc'), SNOW_SH = hex('#c6d6e8');
const pk = (c: RGBA) => ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
const PK = (...h: string[]) => h.map((x) => pk(hex(x)));
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Deterministic hash in [0, 1). */
function hh(x: number, y: number, s = 0) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Jittered-cell (Voronoi) id for stone patterns. `brick` offsets every other row. */
function stoneCell(x: number, y: number, sx: number, sy: number, s: number, brick: boolean) {
  const gy = Math.floor(y / sy);
  let best = 1e9, id = 0;
  for (let j = -1; j <= 1; j++) {
    const cy = gy + j, off = brick && (cy & 1) ? 0.5 : 0;
    const gx = Math.floor(x / sx - off);
    for (let i = -1; i <= 1; i++) {
      const cx = gx + i;
      const px = (cx + off + 0.2 + 0.6 * hh(cx, cy, s)) * sx, py = (cy + 0.25 + 0.5 * hh(cx, cy, s + 1)) * sy;
      const dx = (x - px) / sx, dy = (y - py) / sy, d = dx * dx + dy * dy;
      if (d < best) { best = d; id = (Math.imul(cx, 7919) + Math.imul(cy, 104729) + s * 31) & 0x3fff; }
    }
  }
  return id;
}

function art(img: Img, x: number, y: number, rows: string[], pal: Record<string, RGBA>, flip = false) {
  const w = rows[0].length;
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < w; i++) {
    const c = pal[rows[j][i]];
    if (c) img.px(x + (flip ? w - 1 - i : i), y + j, c);
  }
}

const BOULDERS = [
  [
    '....oooooo....',
    '..ooLLLLMMoo..',
    '.oLHHLLLMMMDo.',
    'oLHHLLLMMMMDDo',
    'oLLLLMMMoMMDDo',
    'oLLMMMMMMoDDDo',
    'oMMMMMMDDDDDDo',
    'oMMMDDDDDDDSSo',
    '.oDDDDDDDSSSo.',
    '..oooooooooo..',
  ],
  [
    '......ooooo...',
    '....ooLLLMMo..',
    '..ooLHHLLMMDo.',
    '.oLLHLLLMMMDo.',
    'oLLLLLMMMMDDDo',
    'oLLMMoMMMMDDDo',
    'oMMMMMoMMDDDSo',
    'oMMMMDDDDDDSSo',
    '.oDDDDDDDSSSo.',
    '..oooooooooo..',
  ],
];

/** Round leafy crown made of overlapping leaf clusters, lit from the top-left. */
function drawCrown(img: Img, cx: number, cy: number, R: number, t: RGBA[], rg: Rng, snow: boolean) {
  const lobes: number[][] = [[0, 0, R * 0.6]];
  const k = R >= 11 ? 7 : R >= 9 ? 6 : 5, a0 = rg.next() * 6.283;
  for (let i = 0; i < k; i++) {
    const a = a0 + (i * 6.283) / k + rg.range(-0.2, 0.2), dd = R * rg.range(0.5, 0.6);
    lobes.push([Math.cos(a) * dd, Math.sin(a) * dd * 0.92, R * rg.range(0.38, 0.47)]);
  }
  for (const [lx, ly, r] of lobes) img.ellipse(cx + lx, cy + ly, r + 1, r + 1, t[0]);
  lobes.sort((p, q) => q[0] + q[1] - (p[0] + p[1]));
  for (const [lx, ly, r] of lobes) {
    const s = (lx + ly) / R, x = cx + lx, y = cy + ly;
    img.ellipse(x, y, r, r, t[1]);
    if (s > 0.45) { img.ellipse(x - 1, y - 1, r - 1.7, r - 1.7, t[2]); continue; }
    img.ellipse(x - 0.7, y - 0.7, r - 0.9, r - 0.9, t[2]);
    const lit = snow && s < 0.2;
    img.ellipse(x - r * 0.3, y - r * 0.34, r * 0.55, r * 0.5, lit ? SNOW_SH : t[3]);
    if (lit) img.ellipse(x - r * 0.36, y - r * 0.44, r * 0.42, r * 0.34, SNOW_C);
    else if (s < -0.1) { const hx = Math.round(x - r * 0.5), hy = Math.round(y - r * 0.55); img.px(hx, hy, t[4]); img.px(hx + 1, hy, t[4]); img.px(hx, hy + 1, t[4]); }
  }
}

/** Conifer seen from the front: three tiers with a point. */
function drawPine(img: Img, cx: number, cy: number, R: number, t: RGBA[], snow: boolean) {
  const top = Math.round(cy - R - 3), Ht = 2 * R + 3;
  const tier = (ti: number, grow: number, body: boolean) => {
    const y0 = Math.round(top + ti * Ht * 0.24), y1 = Math.round(top + Ht * (0.46 + ti * 0.27));
    const hw1 = R * (0.52 + ti * 0.2);
    for (let y = y0 - grow; y <= y1 + grow; y++) {
      const f = Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
      const hw = Math.round(0.6 + f * hw1) + grow;
      for (let x = -hw; x <= hw; x++) {
        if (!body) { img.px(cx + x, y, t[0]); continue; }
        if (y >= y1 && ((x + hw) & 3) === 1) continue; // jagged skirt
        let c = x < -hw * 0.3 ? t[3] : x < hw * 0.3 ? t[2] : t[1];
        if (y >= y1 - 1) c = x < 0 ? t[2] : t[1];
        if (snow && f < 0.5 && x <= hw * 0.35) c = x < -hw * 0.2 || f < 0.25 ? SNOW_C : SNOW_SH;
        else if (!snow && f < 0.3 && x < 0 && x >= -hw) c = t[4];
        img.px(cx + x, y, c);
      }
    }
  };
  for (let ti = 2; ti >= 0; ti--) { tier(ti, 1, false); tier(ti, 0, true); }
}

/** Renders a map's terrain to an image at 16px per tile. */
export function renderMap(def: MapDef, season: Season): Img {
  const { w, h, grid } = def;
  const W = w * TS, H = h * TS, N = W * H;
  const img = new Img(W, H);
  const buf = new Uint32Array(img.data.buffer);
  const pal = PALETTES[season];
  const seed = hashStr(def.id) & 0x7fff;
  const n = noise2(seed + 5), n2 = noise2(seed + 77);
  const { VOID, GRASS, DIRT, WATER, SAND, CLIFF, FOREST, ROCK, BRIDGE, HIGH, FLOOR, WALL, SOIL, DEEP, STONEFLOOR } = T;

  // ---- 0. tile grid for the ground (a rock tile is a boulder that sits on grass)
  const tg = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) tg[i] = grid[i] === ROCK ? GRASS : grid[i] === DEEP ? WATER : grid[i];
  const gcode = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : grid[y * w + x]);
  // A narrow strip of bare ground with water on both sides is a wooden bridge. brDir: 1 = you walk north-south, 2 = east-west.
  const brDir = new Uint8Array(w * h);
  const wet = (c: number) => c === WATER || c === DEEP;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = grid[y * w + x];
    if (c !== DIRT && c !== BRIDGE) continue;
    let x0 = x, x1 = x, y0 = y, y1 = y;
    while (x - x0 < 3 && gcode(x0 - 1, y) === c) x0--;
    while (x1 - x < 3 && gcode(x1 + 1, y) === c) x1++;
    while (y - y0 < 3 && gcode(x, y0 - 1) === c) y0--;
    while (y1 - y < 3 && gcode(x, y1 + 1) === c) y1++;
    const ns = x1 - x0 < 3 && wet(gcode(x0 - 1, y)) && wet(gcode(x1 + 1, y)) && !(wet(gcode(x, y - 1)) && wet(gcode(x, y + 1)));
    const ew = y1 - y0 < 3 && wet(gcode(x, y0 - 1)) && wet(gcode(x, y1 + 1)) && !(wet(gcode(x - 1, y)) && wet(gcode(x + 1, y)));
    if (ns) brDir[y * w + x] = 1; else if (ew) brDir[y * w + x] = 2; else if (c === BRIDGE) brDir[y * w + x] = gcode(x - 1, y) === BRIDGE || gcode(x + 1, y) === BRIDGE ? 2 : 1;
  }
  // A bridge must reach land at both ends.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = brDir[y * w + x];
    if (!d) continue;
    const dx = d === 2 ? 1 : 0, dy = d === 2 ? 0 : 1;
    let ok = grid[y * w + x] === BRIDGE;
    if (!ok) {
      let a = 1, b = 1;
      while (gcode(x - dx * a, y - dy * a) >= 0 && brDir[(y - dy * a) * w + x - dx * a] === d) a++;
      while (gcode(x + dx * b, y + dy * b) >= 0 && brDir[(y + dy * b) * w + x + dx * b] === d) b++;
      const e0 = gcode(x - dx * a, y - dy * a), e1 = gcode(x + dx * b, y + dy * b);
      ok = e0 >= 0 && e1 >= 0 && !wet(e0) && !wet(e1) && a + b - 1 >= 2;
    }
    if (ok) tg[y * w + x] = BRIDGE;
  }
  // Deep water: a blurred field, so that the deep area has a soft outline.
  let deepT: Float32Array | null = null;
  if (grid.includes(DEEP)) {
    let a = new Float32Array(w * h), b = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = grid[i] === DEEP ? 1 : 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) sum += a[Math.max(0, Math.min(h - 1, y + j)) * w + Math.max(0, Math.min(w - 1, x + i))];
        b[y * w + x] = sum / 9;
      }
      [a, b] = [b, a];
    }
    deepT = a;
  }
  const deepAt = (gx: number, gy: number) => {
    if (!deepT) return 0;
    const fx = Math.max(0, Math.min(w - 1.001, gx / TS - 0.5)), fy = Math.max(0, Math.min(h - 1.001, gy / TS - 0.5));
    const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0, i = y0 * w + x0;
    const x1 = x0 + 1 < w ? 1 : 0, y1 = y0 + 1 < h ? w : 0;
    return (deepT[i] * (1 - ax) + deepT[i + x1] * ax) * (1 - ay) + (deepT[i + y1] * (1 - ax) + deepT[i + y1 + x1] * ax) * ay;
  };
  const tcode = (x: number, y: number) => tg[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)];
  const SOFT = new Uint8Array(16), WOB = new Float32Array(16);
  for (const c of [GRASS, HIGH, DIRT, SAND, WATER, CLIFF, FOREST]) SOFT[c] = 1;
  WOB[DIRT] = 0.3; WOB[SAND] = 0.28; WOB[WATER] = 0.2; WOB[CLIFF] = 0.1; WOB[FOREST] = 0.2; WOB[HIGH] = 0.4;
  const wob = (k: number, x: number, y: number) => (WOB[k] ? WOB[k] * (n2(x * 0.1 + k * 17.3, y * 0.1 + k * 5.9) - 0.5) : 0);

  // ---- 1. per-pixel material: smoothed tile fields give rounded, organic borders
  const mat = new Uint8Array(N);
  const sc = new Float32Array(16);
  for (let cy = -1; cy < h; cy++) for (let cx = -1; cx < w; cx++) {
    const a = tcode(cx, cy), b = tcode(cx + 1, cy), c = tcode(cx, cy + 1), d = tcode(cx + 1, cy + 1);
    const X0 = cx * TS + 8, Y0 = cy * TS + 8;
    const xs = Math.max(0, X0), xe = Math.min(W, X0 + TS), ys = Math.max(0, Y0), ye = Math.min(H, Y0 + TS);
    if (a === b && b === c && c === d) { for (let y = ys; y < ye; y++) mat.fill(a, y * W + xs, y * W + xe); continue; }
    for (let y = ys; y < ye; y++) {
      const ay = (y - Y0 + 0.5) / TS;
      for (let x = xs; x < xe; x++) {
        const ax = (x - X0 + 0.5) / TS;
        const own = ax < 0.5 ? (ay < 0.5 ? a : c) : (ay < 0.5 ? b : d);
        if (!SOFT[own]) { mat[y * W + x] = own; continue; }
        sc[a] = 0; sc[b] = 0; sc[c] = 0; sc[d] = 0; sc[own] = 0;
        sc[SOFT[a] ? a : own] += (1 - ax) * (1 - ay);
        sc[SOFT[b] ? b : own] += ax * (1 - ay);
        sc[SOFT[c] ? c : own] += (1 - ax) * ay;
        sc[SOFT[d] ? d : own] += ax * ay;
        let best = own, bv = sc[own] + 0.02 + wob(own, x, y);
        for (let q = 0; q < 4; q++) {
          const k = q === 0 ? a : q === 1 ? b : q === 2 ? c : d;
          if (k === own || !SOFT[k] || sc[k] === 0) continue;
          const v = sc[k] + wob(k, x, y);
          if (v > bv) { bv = v; best = k; }
        }
        mat[y * W + x] = best;
      }
    }
  }
  const M = (x: number, y: number) => mat[(y < 0 ? 0 : y >= H ? H - 1 : y) * W + (x < 0 ? 0 : x >= W ? W - 1 : x)];

  // ---- 2. helper fields
  // edge: 1 = touches another material, 2 = one pixel further in
  const edge = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0, i = y * W; x < W; x++, i++) {
    const m = mat[i];
    if (x + 1 < W && mat[i + 1] !== m) { edge[i] = 1; edge[i + 1] = 1; }
    if (y + 1 < H && mat[i + W] !== m) { edge[i] = 1; edge[i + W] = 1; }
  }
  for (let y = 0; y < H; y++) for (let x = 0, i = y * W; x < W; x++, i++) {
    if (edge[i]) continue;
    if ((x > 0 && edge[i - 1] === 1) || (x + 1 < W && edge[i + 1] === 1) || (y > 0 && edge[i - W] === 1) || (y + 1 < H && edge[i + W] === 1)) edge[i] = 2;
  }
  // dW: chamfer distance to the shoreline (in half pixels), on both sides of it
  const isW = new Uint8Array(16); isW[WATER] = 1; isW[BRIDGE] = 1;
  const dW = new Uint8Array(N).fill(80);
  let hasWater = false, hasCliff = false;
  for (let i = 0; i < w * h; i++) { if (isW[tg[i]]) hasWater = true; if (tg[i] === CLIFF) hasCliff = true; }
  if (hasWater) {
    for (let y = 0; y < H; y++) for (let x = 0, i = y * W; x < W; x++, i++) {
      const m = isW[mat[i]];
      if (x + 1 < W && isW[mat[i + 1]] !== m) { dW[i] = 2; dW[i + 1] = 2; }
      if (y + 1 < H && isW[mat[i + W]] !== m) { dW[i] = 2; dW[i + W] = 2; }
    }
    for (let y = 0; y < H; y++) for (let x = 0, i = y * W; x < W; x++, i++) {
      let v = dW[i];
      if (x > 0 && dW[i - 1] + 2 < v) v = dW[i - 1] + 2;
      if (y > 0) {
        if (dW[i - W] + 2 < v) v = dW[i - W] + 2;
        if (x > 0 && dW[i - W - 1] + 3 < v) v = dW[i - W - 1] + 3;
        if (x + 1 < W && dW[i - W + 1] + 3 < v) v = dW[i - W + 1] + 3;
      }
      dW[i] = v;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1, i = y * W + W - 1; x >= 0; x--, i--) {
      let v = dW[i];
      if (x + 1 < W && dW[i + 1] + 2 < v) v = dW[i + 1] + 2;
      if (y + 1 < H) {
        if (dW[i + W] + 2 < v) v = dW[i + W] + 2;
        if (x + 1 < W && dW[i + W + 1] + 3 < v) v = dW[i + W + 1] + 3;
        if (x > 0 && dW[i + W - 1] + 3 < v) v = dW[i + W - 1] + 3;
      }
      dW[i] = v;
    }
  }
  // cliffs: length of the rock above / below each pixel, and a stone-cell id (top bit = front face)
  const FAR = 200, FACE = 24;
  const dTop = hasCliff ? new Uint8Array(N) : mat, dBot = hasCliff ? new Uint8Array(N) : mat;
  const cf = hasCliff ? new Uint16Array(N) : new Uint16Array(1);
  if (hasCliff) {
    for (let x = 0; x < W; x++) {
      let c = FAR;
      for (let y = 0, i = x; y < H; y++, i += W) { if (mat[i] === CLIFF) { dTop[i] = c; if (c < FAR) c++; } else c = 0; }
      c = FAR;
      for (let y = H - 1, i = (H - 1) * W + x; y >= 0; y--, i -= W) { if (mat[i] === CLIFF) { dBot[i] = c; if (c < FAR) c++; } else c = 0; }
    }
    for (let y = 0; y < H; y++) for (let x = 0, i = y * W; x < W; x++, i++) {
      if (mat[i] !== CLIFF) continue;
      const L = dTop[i] + dBot[i] + 1, F = L <= 28 ? L : FACE;
      cf[i] = dBot[i] < F ? 0x8000 | stoneCell(x, y, 11, 6, seed, true) : 0x4000 | stoneCell(x, y, 15, 12, seed + 9, false);
    }
  }
  // low-frequency patches, one value per 4x4 block
  const PW = (W >> 1) + 1, PH = (H >> 1) + 1;
  const patch = new Float32Array(PW * PH);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) patch[y * PW + x] = 0.62 * n((x * 0.8 + y * 0.6) * 0.036, (y * 0.8 - x * 0.6) * 0.036) + 0.38 * n2((x * 0.6 - y * 0.8) * 0.085, (y * 0.6 + x * 0.8) * 0.085);

  // ---- 3. base colors
  const G = pal.grass.map(pk), HG = pal.high.map(pk), D = pal.dirt.map(pk), S = pal.sand.map(pk), WA = pal.water.map(pk), DP = pal.deep.map(pk);
  const C = pal.cliff.map(pk), TP = pal.top.map(pk), FL = pal.floor.map(pk), BK = pal.bank.map(pk);
  const FOAM = pk(hex(pal.snow ? '#ffffff' : '#f4fbff'));
  const TPO = pal.snow ? pk(hex('#8296b0')) : C[0];
  const VOIDC = PK('#1a1216', '#33252a', '#5a4038');
  const PLANK = PK('#c59460', '#ba8956', '#cf9f6a', '#8c6038', '#d8ab78', '#ae7d4c', '#6e4a2c');
  const FLAG = PK('#a8a8b2', '#b2b2bb', '#9e9eaa', '#6c6c7a', '#c6c6ce', '#8c8c98');
  const SOILC = PK('#6b4630', '#553522', '#80583a', '#3a2418', '#94683f');
  const BRIDGEC = PK('#b98a52', '#a97a46', '#c99a60', '#6e4a28', '#553620', '#8c6238', '#3e2718');
  const PAPER = PK('#ecd9b0', '#e3cc9e', '#cfae7c', '#4a2f22', '#8a5a3a', '#6a4428', '#b4885a', '#c89c6c', '#8a6240', '#c9b088');
  const WOODW = PK('#a87848', '#b4844e', '#9c6e42', '#6e4a2c', '#c4945c', '#4a2e1c', '#7a5232', '#8a5e38');
  const STONEW = PK('#7c7c8c', '#868696', '#74748a', '#4e4e5e', '#9a9aaa', '#3a3a48', '#5a5a6a');
  const GLASSW = PK('#a8dcea', '#d4f0f6', '#8ecbe0', '#e8efe6', '#6a8a78', '#4a6a5a', '#bfe6f0');
  const wallStyle = /cellar|slime/.test(def.id) ? 2 : /barn|coop|shed/.test(def.id) ? 1 : def.id === 'greenhouse' ? 3 : 0;
  const plankStart = (k: number, r: number) => { for (let j = k; ; j--) if (hh(j, r, seed) < 0.13 || (j + r * 5) % 14 === 0) return j; };
  const flagSeam = (k: number, r: number) => (k & 1) === 0 || hh(k, r, seed + 3) < 0.4;

  const wallColor = (gx: number, gy: number, tx: number, ty: number) => {
    let ta = 0, tb = 0;
    while (gcode(tx, ty - ta - 1) === WALL) ta++;
    while (gcode(tx, ty + tb + 1) === WALL) tb++;
    const px = gx & 15, py = gy & 15, yT = ta * TS + py, yB = tb * TS + 15 - py, HH = (ta + tb + 1) * TS;
    const sideL = px === 0 && gcode(tx - 1, ty) !== WALL && gcode(tx - 1, ty) !== -1, sideR = px === 15 && gcode(tx + 1, ty) !== WALL && gcode(tx + 1, ty) !== -1;
    if (wallStyle === 1) { // wooden planks
      if (yT < 4) return WOODW[yT === 0 || yT === 3 ? 5 : yT === 1 ? 7 : 6];
      if (yB < 4) return WOODW[yB === 3 ? 5 : yB === 0 ? 5 : 6];
      if (sideL || sideR) return WOODW[5];
      if (HH >= 32 && (yT === (HH >> 1) || yT === (HH >> 1) + 3)) return WOODW[5];
      if (HH >= 32 && yT > (HH >> 1) && yT < (HH >> 1) + 3) return WOODW[yT === (HH >> 1) + 1 ? 7 : 6];
      const b = gx >> 3, u = gx & 7;
      if (u === 7) return WOODW[3];
      if (u === 0) return WOODW[4];
      if (yT === 4) return WOODW[3];
      if (hh(b, (gy + ((b * 5) & 7)) >> 3, seed) < 0.1 && (u === 3 || u === 4) && ((gy + b * 5) & 7) < 4) return WOODW[3]; // grain
      return WOODW[(hh(b, 9, seed) * 3) | 0];
    }
    if (wallStyle === 2 || (wallStyle === 3 && yB < 9)) { // stone blocks
      if (wallStyle === 2 && yT < 2) return STONEW[5];
      if (yB < 2) return STONEW[yB === 0 ? 5 : 6];
      if (sideL || sideR) return STONEW[5];
      const r = yB >> 3, u = gx + (r & 1) * 8, v = yB & 7;
      if (v === 0 || (u & 15) === 15) return STONEW[3];
      if (v === 7) return STONEW[4];
      return STONEW[(hh(u >> 4, r, seed) * 3) | 0];
    }
    if (wallStyle === 3) { // glass panes
      if (yT < 3) return GLASSW[yT === 1 ? 3 : 5];
      if (yB === 9 || sideL || sideR) return GLASSW[5];
      if (px === 0 || px === 15 || yB === 10) return GLASSW[3];
      if (px === 1 || px === 14 || yT === 3 || (yT & 15) === 0) return GLASSW[4];
      if ((yT & 15) === 15) return GLASSW[3];
      const dg = (gx + yT) & 31;
      return GLASSW[dg >= 6 && dg <= 8 ? 1 : dg === 11 ? 6 : yB < 20 ? 2 : 0];
    }
    // wallpaper over wood wainscot
    if (yT < 3) return PAPER[yT === 0 ? 3 : yT === 1 ? 4 : 5];
    if (yB < 4) return PAPER[yB === 3 ? 3 : yB === 0 ? 5 : 4];
    if (sideL || sideR) return PAPER[3];
    if (HH >= 32 && yB < 16) {
      if (yB === 15) return PAPER[5];
      if (yB === 14) return PAPER[7];
      if (yB === 13) return PAPER[8];
      const u = gx & 7;
      return PAPER[u === 0 ? 8 : u === 1 ? 7 : 6];
    }
    if (yT === 3) return PAPER[9];
    const stripe = (gx >> 3) & 1, u = gx & 7, v = (yT + stripe * 4) & 7;
    if ((u === 3 && (v === 2 || v === 4)) || ((u === 2 || u === 4) && v === 3)) return PAPER[2];
    return PAPER[stripe];
  };

  for (let gy = 0; gy < H; gy++) {
    const ty = gy >> 4, py = gy & 15;
    for (let gx = 0, i = gy * W; gx < W; gx++, i++) {
      const m = mat[i];
      const bay = (B4[(gx & 3) | ((gy & 3) << 2)] / 16 - 0.5) * 0.09;
      const pv = patch[(gy >> 1) * PW + (gx >> 1)] + bay;
      const e = edge[i];
      const dw = dW[i] >> 1;
      let col: number;
      switch (m) {
        case GRASS: case HIGH: {
          const g = m === GRASS ? G : HG;
          col = pv > 0.6 ? g[2] : pv < 0.37 ? g[0] : g[1];
          if (dw === 1) col = isW[M(gx, gy + 1)] ? g[5] : BK[2];
          else if (e) {
            const dn = M(gx, gy + 1), rt = M(gx + 1, gy), up = M(gx, gy - 1), lf = M(gx - 1, gy);
            const o = m === GRASS ? HIGH : GRASS;
            if (e === 2) {
              // soft border between the two kinds of grass
              if (((gx + gy) & 3) === 0 && (M(gx, gy + 2) === o || M(gx + 2, gy) === o || M(gx, gy - 2) === o || M(gx - 2, gy) === o)) { const g2 = m === GRASS ? HG : G; col = pv > 0.6 ? g2[2] : pv < 0.37 ? g2[0] : g2[1]; }
            } else if (dn === DIRT || dn === SAND || rt === DIRT || rt === SAND) col = g[5];
            else if (up === DIRT || up === SAND || lf === DIRT || lf === SAND) col = g[3];
            else if (((gx + gy) & 1) === 0 && (dn === o || rt === o || up === o || lf === o)) { const g2 = m === GRASS ? HG : G; col = pv > 0.6 ? g2[2] : pv < 0.37 ? g2[0] : g2[1]; }
          }
          break;
        }
        case DIRT: case SAND: {
          const p = m === DIRT ? D : S;
          col = pv > 0.62 ? p[3] : pv < 0.36 ? p[1] : p[2];
          if (dw <= 3) col = m === SAND ? (dw <= 2 ? p[0] : p[1]) : dw === 1 ? BK[2] : dw === 2 ? p[0] : col;
          else if (e) {
            const u1 = M(gx, gy - 1), u2 = M(gx, gy - 2), lf = M(gx - 1, gy);
            const gr = (o: number) => o === GRASS || o === HIGH || o === FOREST;
            if (gr(u1) || gr(u2) || gr(lf)) col = p[0];
            else if (e === 1 && (gr(M(gx + 1, gy)) || gr(M(gx, gy + 1)))) col = p[1];
          }
          break;
        }
        case WATER: {
          const dv = deepT && dw > 6 ? deepAt(gx, gy) + (pv - 0.5) * 0.3 : 0;
          if (dw <= 6) {
            let k = 1, mk = 0;
            for (; k <= 3 && gy - k >= 0; k++) { const o = mat[i - k * W]; if (!isW[o]) { mk = o; break; } }
            if (mk === GRASS || mk === HIGH || mk === DIRT || mk === FOREST) col = k === 1 ? BK[0] : k === 2 ? BK[1] : WA[5];
            else if (mk === CLIFF && k === 1) col = WA[5];
            else if (dw <= 3) {
              col = WA[3];
              if (dw <= 2) {
                let sandy = false;
                for (let q = 1; q <= 3 && !sandy; q++) sandy = M(gx + q, gy) === SAND || M(gx - q, gy) === SAND || M(gx, gy + q) === SAND || M(gx, gy - q) === SAND || M(gx + q - 1, gy + q - 1) === SAND || M(gx - q + 1, gy - q + 1) === SAND;
                if (sandy && hh(gx >> 1, gy, seed) < (dw === 1 ? 0.8 : 0.3)) col = FOAM;
              }
            } else col = WA[2];
          } else if (dv > 0.5) col = pv > 0.64 ? DP[2] : pv < 0.38 ? DP[0] : DP[1];
          else if (dv > 0.36) col = (dv > 0.43 || ((gx + gy) & 1)) ? DP[2] : WA[0];
          else if (dv > 0.24) col = WA[0];
          else col = pv > 0.66 ? WA[2] : pv < 0.42 && dw >= 10 ? WA[0] : WA[1];
          break;
        }
        case FOREST: col = pv > 0.52 ? FL[1] : FL[0]; break;
        case CLIFF: {
          const dT = dTop[i], dB = dBot[i], id = cf[i];
          const nl = gx > 0 && mat[i - 1] !== CLIFF, nr = gx < W - 1 && mat[i + 1] !== CLIFF;
          const hs = (Math.imul(id & 0x3fff, 40503) >>> 5) & 3;
          if (id & 0x8000) {
            const L = dT + dB + 1, F = L <= 28 ? L : FACE, fy = F - 1 - dB, full = fy === dT;
            col = 0;
            if (nl || nr || dB === 0) col = C[0];
            else if (full) {
              const above = gy - dT - 1 >= 0 ? mat[i - (dT + 1) * W] : CLIFF;
              if (above === GRASS || above === HIGH || above === FOREST) {
                const g = above === HIGH ? HG : G;
                const lip = 3 + ((hh(gx >> 1, 3, seed) * 2.99) | 0);
                if (fy < lip - 1) col = fy === 0 && above !== FOREST ? g[2] : g[1];
                else if (fy === lip - 1) col = g[3];
                else if (fy === lip) col = C[0];
              } else if (fy === 0) col = C[4];
              else if (fy === 1) col = C[3];
            } else if (fy === 0) col = C[4];
            if (!col) {
              const crack = cf[i + W] !== id || (gx < W - 1 && cf[i + 1] !== id);
              let t = hs === 1 ? 3 : 2;
              if (crack) t = 1;
              else if (cf[i - W] !== id) t++;
              if (dB < 4) t--;
              col = C[t];
            }
          } else {
            if (nl || nr || dT === 0) col = TPO;
            else if (dT === 1 || (gx > 1 && mat[i - 2] !== CLIFF)) col = TP[2];
            else if (gx < W - 3 && (mat[i + 2] !== CLIFF || mat[i + 3] !== CLIFF)) col = TP[0];
            else {
              const below = cf[i + W], right = gx < W - 1 ? cf[i + 1] : id;
              const seam = (o: number) => o !== id && !(o & 0x8000) && hh(Math.min(o, id), Math.max(o, id), seed) < 0.55;
              if (seam(below) || seam(right)) col = TP[0];
              else if (seam(cf[i - W]) || (gx > 0 && seam(cf[i - 1]))) col = TP[2];
              else col = TP[1];
            }
          }
          break;
        }
        case BRIDGE: {
          const tx = gx >> 4, px = gx & 15;
          const vertical = brDir[ty * w + tx] !== 2;
          const v = vertical ? gy : gx, u = vertical ? px : py, q = v & 3;
          const tb = (dx: number, dy: number) => { const xx = tx + dx, yy = ty + dy; return xx >= 0 && yy >= 0 && xx < w && yy < h && tg[yy * w + xx] === BRIDGE; };
          const e0 = vertical ? !tb(-1, 0) : !tb(0, -1), e1 = vertical ? !tb(1, 0) : !tb(0, 1);
          if ((u === 0 && e0) || (u === 15 && e1)) col = BRIDGEC[6];
          else if ((u === 1 && e0) || (u === 14 && e1)) col = BRIDGEC[5];
          else if ((u === 2 && e0) || (u === 13 && e1)) col = BRIDGEC[4];
          else if (q === 3) col = BRIDGEC[3];
          else if ((u === 4 || u === 11) && q === 1) col = BRIDGEC[4];
          else col = BRIDGEC[q === 0 ? 2 : hh(v >> 2, vertical ? tx : ty, seed) < 0.4 ? 1 : 0];
          break;
        }
        case FLOOR: {
          const r = gy >> 3, v = gy & 7, k = gx >> 3, u = gx & 7;
          const st = plankStart(k, r);
          if (v === 7) col = PLANK[3];
          else if (u === 0 && st === k) col = PLANK[3];
          else if (v === 0) col = PLANK[4];
          else if (u === 2 && st === k && v === 3) col = PLANK[3];
          else if (hh(gx >> 2, gy, seed + st) < 0.035 && v > 1 && v < 6) col = PLANK[5];
          else col = PLANK[(hh(st, r, seed + 1) * 3) | 0];
          break;
        }
        case STONEFLOOR: {
          const r = gy >> 4, u = gx + (r & 1) * 8, k = u >> 4;
          const sk = flagSeam(k, r) ? k : k - 1, sw = flagSeam(sk + 1, r) ? 16 : 32;
          const lx = u - sk * 16, ly = py;
          const cx0 = lx === 0 || lx === sw - 2, cy0 = ly === 0 || ly === 14;
          if (lx === sw - 1 || ly === 15 || (cx0 && cy0)) col = FLAG[3];
          else if (lx === 0 || ly === 0) col = FLAG[4];
          else if (lx === sw - 2 || ly === 14) col = FLAG[5];
          else if (hh(gx >> 1, gy, seed) < 0.018) col = FLAG[5];
          else col = FLAG[(hh(sk, r, seed + 2) * 3) | 0];
          break;
        }
        case WALL: col = wallColor(gx, gy, gx >> 4, ty); break;
        case SOIL: {
          const tx = gx >> 4, px = gx & 15;
          const dl = gcode(tx - 1, ty) !== SOIL ? px : 9, dr = gcode(tx + 1, ty) !== SOIL ? 15 - px : 9;
          const du = gcode(tx, ty - 1) !== SOIL ? py : 9, dd = gcode(tx, ty + 1) !== SOIL ? 15 - py : 9;
          const de = Math.min(dl, dr, du, dd), q = gy & 3;
          if (de === 0) col = SOILC[3];
          else if (de === 1) col = SOILC[du === 1 || dl === 1 ? 4 : 1];
          else if (q === 3) col = SOILC[1];
          else if (q === 0 && hh(gx >> 2, gy, seed) < 0.7) col = SOILC[2];
          else col = hh(gx, gy, seed) < 0.03 ? SOILC[2] : SOILC[0];
          break;
        }
        default: {
          const tx = gx >> 4, px = gx & 15;
          col = VOIDC[0];
          const up = gcode(tx, ty - 1), dn = gcode(tx, ty + 1), lf = gcode(tx - 1, ty), rt = gcode(tx + 1, ty);
          const solid = (o: number) => o !== VOID && o !== -1;
          if (solid(up) && py < 4) col = VOIDC[py === 0 ? 2 : 1];
          else if ((solid(lf) && px < 3) || (solid(rt) && px > 12) || (solid(dn) && py > 12)) col = VOIDC[1];
        }
      }
      buf[i] = col;
    }
  }

  // ---- 4. small details, placed per tile
  const put = (x: number, y: number, c: number, m: number) => { if (x >= 0 && y >= 0 && x < W && y < H && mat[y * W + x] === m) buf[y * W + x] = c; };
  const clear = (x: number, y: number, m: number) => x >= 2 && y >= 3 && x < W - 5 && y < H - 2 && mat[y * W + x] === m && !edge[y * W + x] && !edge[(y - 2) * W + x + 3] && !edge[y * W + x + 4] && dW[y * W + x] > 8;
  const FLOWERS = PK('#f6e27a', '#f8f4fa', '#ee86aa', '#9ab8f4', '#f2a24e'), FCENTER = pk(hex('#f8d048')), FCENTER2 = pk(hex('#e8843a'));
  const LEAF = PK('#d06a26', '#a8431e', '#e0a030', '#b8862a');
  const DRY = PK('#b89c6c', '#8e7450');
  const SHELL = PK('#fdf6ee', '#eeaab8', '#f6c890');
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    const c = tg[ty * w + tx], X = tx * TS, Y = ty * TS;
    const r = (k: number) => hh(tx, ty, seed + k);
    const at = (k: number) => [X + ((r(k) * 16) | 0), Y + ((r(k + 50) * 16) | 0)];
    if (c === GRASS || c === HIGH) {
      const g = c === GRASS ? G : HG, high = c === HIGH;
      const tickD = pk(mix(pal[high ? 'high' : 'grass'][1], pal[high ? 'high' : 'grass'][3], 0.42));
      // blade ticks: quiet texture
      for (let k = 0; k < (high ? 5 : 3); k++) {
        const [x, y] = at(k);
        if (!clear(x, y, c)) continue;
        if (r(k + 20) < 0.6) { put(x, y, tickD, c); put(x + 1, y - 1, tickD, c); }
        else { put(x, y, g[2], c); put(x, y - 1, g[2], c); put(x + 1, y, g[0], c); }
      }
      // tuft: three blades
      if (r(10) < (high ? 0.55 : 0.2)) {
        const [x, y] = at(11);
        if (clear(x, y, c)) {
          const d = pal.snow ? DRY[1] : g[3], l = pal.snow ? DRY[0] : g[4];
          if (pal.snow) { if (r(12) < 0.4) { put(x, y, d, c); put(x + 1, y - 1, l, c); put(x + 2, y, d, c); put(x + 2, y - 1, d, c); put(x + 3, y - 2, l, c); } }
          else {
            put(x, y - 1, d, c); put(x + 1, y, d, c); put(x + 2, y, d, c); put(x + 2, y - 1, d, c); put(x + 3, y, d, c); put(x + 4, y - 1, d, c);
            put(x, y - 2, l, c); put(x + 2, y - 2, l, c); put(x + 2, y - 3, l, c); put(x + 4, y - 2, l, c);
          }
        }
      }
      if (!pal.snow && season !== 'fall') {
        const pf = season === 'spring' ? 0.075 : 0.035;
        if (r(13) < pf) {
          const [x, y] = at(14);
          if (clear(x, y, c)) {
            const fc = FLOWERS[(r(15) * 4) | 0];
            put(x + 1, y - 2, fc, c); put(x, y - 1, fc, c); put(x + 2, y - 1, fc, c); put(x + 1, y, fc, c); put(x + 1, y - 1, fc === FLOWERS[0] ? FCENTER2 : FCENTER, c);
            put(x + 1, y + 1, g[3], c);
          }
        } else if (r(13) < pf * 2.2) {
          // tiny blossoms in a loose group
          const [x, y] = at(16);
          const fc = FLOWERS[(r(17) * 5) | 0];
          if (clear(x, y, c)) { put(x, y, fc, c); put(x + 3, y - 1, fc, c); put(x + 1, y + 2, fc, c); put(x, y + 1, g[3], c); put(x + 3, y, g[3], c); }
        }
      }
      if (season === 'fall' && r(18) < 0.3) {
        const [x, y] = at(19);
        if (clear(x, y, c)) { const k = ((r(21) * 2) | 0) * 2; put(x, y, LEAF[k], c); put(x + 1, y, LEAF[k], c); put(x + 1, y - 1, LEAF[k], c); put(x + 2, y - 1, LEAF[k + 1], c); put(x, y + 1, LEAF[k + 1], c); }
      }
    } else if (c === DIRT || c === SAND) {
      const p = c === DIRT ? D : S;
      for (let k = 0; k < 2; k++) {
        const [x, y] = at(k);
        if (clear(x, y, c)) { put(x, y, p[k ? 3 : 1], c); put(x + 1, y, p[k ? 3 : 1], c); }
      }
      if (r(5) < (c === DIRT ? 0.32 : 0.1)) {
        const [x, y] = at(6);
        if (clear(x, y, c)) {
          const big = r(7) < 0.35 ? 1 : 0;
          put(x, y - 1, p[4], c); put(x + 1, y - 1, p[4], c); put(x, y, p[5], c); put(x + 1, y, p[5], c);
          if (big) { put(x + 2, y - 1, p[3], c); put(x + 2, y, p[5], c); put(x + 1, y - 2, p[4], c); }
        }
      }
      if (c === SAND) {
        if (r(8) < 0.42) {
          const [x, y] = at(9);
          if (clear(x, y, c) && clear(x + 4, y, c)) { for (let q = 0; q < 3; q++) { put(x + q, y, p[1], c); put(x + 3 + q, y - 1, p[1], c); put(x + 6 + q, y, p[1], c); } for (let q = 0; q < 3; q++) put(x + q + 3, y, p[3], c); }
        }
        if (r(22) < 0.04) {
          const [x, y] = at(23);
          if (clear(x, y, c)) { const sk = r(24) < 0.5 ? 1 : 2; put(x, y - 1, SHELL[0], c); put(x + 1, y - 1, SHELL[0], c); put(x, y, SHELL[0], c); put(x + 1, y, SHELL[sk], c); put(x + 2, y, SHELL[sk], c); put(x, y + 1, p[0], c); put(x + 1, y + 1, p[0], c); put(x + 2, y + 1, p[0], c); }
        }
      }
    } else if (c === WATER) {
      const deep = deepAt(X + 8, Y + 8) > 0.6;
      if (r(1) < (deep ? 0.3 : 0.2)) {
        const [x, y] = at(2);
        const i = y * W + x;
        if (x > 8 && x < W - 16 && mat[i] === c && dW[i] > 16 && mat[i + 10] === c) {
          const col = deep ? DP[3] : WA[3], len = deep ? 6 + ((r(3) * 6) | 0) : 3 + ((r(3) * 3) | 0);
          for (let q = 0; q < len; q++) put(x + q, y, col, c);
          for (let q = 0; q < (len >> 1); q++) put(x + len + q, y + 1, col, c);
          if (deep) for (let q = 0; q < 3; q++) put(x - 4 + q, y + 1, col, c);
          else if (r(4) < 0.4) put(x + 1, y, WA[4], c);
        }
      }
    }
  }

  // ---- 5. cast shadows (one flat step, so the palette stays small)
  type Tree = { x: number; y: number; R: number; kind: number; v: number };
  const trees: Tree[] = [];
  const hasTree = new Uint8Array(w * h);
  const fcode = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? FOREST : grid[y * w + x]);
  const addTree = (x: number, y: number, k: number) => {
    const tx = x >> 4, ty = y >> 4;
    let e = 16;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      if (fcode(tx + i, ty + j) === FOREST) continue;
      const x0 = (tx + i) * TS, y0 = (ty + j) * TS;
      const dx = Math.max(x0 - x, 0, x - (x0 + TS)), dy = Math.max(y0 - y, 0, y - (y0 + TS));
      e = Math.min(e, Math.hypot(dx, dy));
    }
    const R = Math.max(7, Math.min(13, Math.round(e + 5 - hh(x, y, seed) * 2.5)));
    const q = hh(k, 7, seed);
    const kind = q < 0.13 ? 1 : pal.snow && q < 0.36 ? 2 : 0;
    trees.push({ x, y, R, kind, v: (hh(k, 8, seed) * 997) | 0 });
    hasTree[ty * w + tx] = 1;
  };
  const SXT = 14, SYT = 11;
  for (let j = 0; j * SYT < H; j++) for (let i = 0; i * SXT < W + SXT; i++) {
    const x = Math.round(i * SXT + (j & 1) * (SXT / 2) + hh(i, j, seed + 1) * 6 - 3), y = Math.round(j * SYT + 5 + hh(i, j, seed + 2) * 6 - 3);
    if (x < 0 || y < 0 || x >= W || y >= H || grid[(y >> 4) * w + (x >> 4)] !== FOREST) continue;
    addTree(x, y, i * 7919 + j);
  }
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) if (grid[ty * w + tx] === FOREST && !hasTree[ty * w + tx]) addTree(tx * TS + 8, ty * TS + 7, tx * 7919 + ty * 31 + 5);
  trees.sort((a, b) => a.y + a.R - (b.y + b.R) || a.x - b.x);

  const sh = new Uint8Array(N);
  const shEllipse = (cx: number, cy: number, rx: number, ry: number) => {
    for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(H - 1, Math.ceil(cy + ry)); y++) for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(W - 1, Math.ceil(cx + rx)); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) sh[y * W + x] |= 1;
    }
  };
  for (const t of trees) shEllipse(t.x + 2, t.y + t.R * 0.62, t.R + 1, t.R * 0.72);
  const rocks: number[][] = [];
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) if (grid[ty * w + tx] === ROCK) { rocks.push([tx, ty]); shEllipse(tx * TS + 9, ty * TS + 13, 7, 2.6); }
  if (hasCliff) for (let y = 0; y < H - 1; y++) for (let x = 0, i = y * W; x < W; x++, i++) {
    if (mat[i] !== CLIFF) continue;
    if (dBot[i] === 0) for (let k = 1; k <= 3 && y + k < H; k++) sh[i + k * W] |= 2;
    if (x + 2 < W && mat[i + 1] !== CLIFF) { sh[i + 1] |= 2; sh[i + 2] |= 2; }
  }
  for (let ty = 1; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    const c = grid[ty * w + tx];
    if ((c === FLOOR || c === STONEFLOOR || c === SOIL) && grid[(ty - 1) * w + tx] === WALL) for (let y = 0; y < 3; y++) sh.fill(4, (ty * TS + y) * W + tx * TS, (ty * TS + y) * W + tx * TS + TS);
  }
  for (let i = 0; i < N; i++) {
    const s = sh[i];
    if (!s) continue;
    const m = mat[i];
    if (m === FOREST || m === CLIFF) { if (!(s & 1) || m === FOREST) continue; }
    if (isW[m] && !(s & 1)) continue;
    const c = buf[i];
    buf[i] = ((255 << 24) | ((((c >> 16) & 255) * 0.82) << 16) | ((((c >> 8) & 255) * 0.76) << 8) | ((c & 255) * 0.72)) >>> 0;
  }

  // ---- 6. boulders and the forest canopy (back to front)
  const RP = pal.snow ? { o: hex('#34303a'), S: hex('#56505a'), D: hex('#7c7884'), M: hex('#a2a0aa'), L: SNOW_SH, H: SNOW_C } : { o: hex('#3a3238'), S: hex('#5c555c'), D: hex('#7a747a'), M: hex('#989296'), L: hex('#b6b2b0'), H: hex('#d6d2cc') };
  for (const [tx, ty] of rocks) art(img, tx * TS + 1, ty * TS + 4, BOULDERS[hh(tx, ty, seed) < 0.5 ? 0 : 1], RP, hh(tx, ty, seed + 1) < 0.5);
  const BLOSSOM = [hex('#fbe4ee'), hex('#f4b8d0')];
  for (let k = 0; k < trees.length; k++) {
    const t = trees[k];
    const rg = new Rng(seed * 131 + k * 2654435761 + 17);
    if (t.kind === 1) drawPine(img, t.x, t.y, t.R, pal.pine, pal.snow);
    else if (t.kind === 2) drawCrown(img, t.x, t.y, t.R - 1, pal.leaves[1], rg, true);
    else {
      let li = t.v % pal.leaves.length;
      if (pal.snow) li = 0;
      if (season === 'spring' && li === 3 && t.v % 3) li = t.v % 3;
      drawCrown(img, t.x, t.y, t.R, pal.leaves[li], rg, pal.snow);
      if (season === 'spring' && li < 3 && t.v % 5 === 0) for (let q = 0; q < 6; q++) {
        const a = rg.next() * 6.283, rr = rg.next() * t.R * 0.75;
        const bx = t.x + Math.cos(a) * rr - 1, by = t.y + Math.sin(a) * rr - 1;
        img.px(bx, by, BLOSSOM[0]); img.px(bx + 1, by, BLOSSOM[1]);
      }
    }
  }
  return img;
}
