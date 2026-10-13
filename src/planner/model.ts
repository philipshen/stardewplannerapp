/** Pure planner model: plan data, placement rules, coverage and stats. */
import { Item, ITEM_BY_ID, itemByName } from '../data/items';
import { flagsAt, MAP_BY_ID, MapInfo, terrainAt } from '../data/maps';
import type { Season } from '../theme';

export type Placed = { u: string; id: string; x: number; y: number };

export type Plan = {
  v: 1;
  id: string;
  name: string;
  map: string;
  season: Season;
  createdAt: number;
  updatedAt: number;
  /** 1×1 ground layer: "x,y" -> item id (floors, paths, tilled soil, grass). */
  ground: Record<string, string>;
  /** Everything else (objects, buildings, crops, trees, rugs). */
  objects: Placed[];
  notes?: string;
};

export type Layer = 'ground' | 'rug' | 'object';

export const key = (x: number, y: number) => `${x},${y}`;
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function layerOf(it: Item): Layer {
  if (it.place === 'ground') return it.cat === 'furniture' ? 'rug' : 'ground';
  return 'object';
}

export function newPlan(name: string, mapId: string, season: Season): Plan {
  const map = MAP_BY_ID[mapId];
  const now = Date.now();
  return {
    v: 1, id: uid(), name, map: mapId, season, createdAt: now, updatedAt: now,
    ground: {},
    objects: (map?.defaults ?? []).filter((d) => ITEM_BY_ID[d.id]).map((d) => ({ u: uid(), id: d.id, x: d.x, y: d.y })),
  };
}

/** A sample farm that ships with the app. */
export type Template = { source?: { author: string; url: string }; name: string; blurb: string; map: string; season: Season; ground: Record<string, string>; objects: Placed[] };

export function planFromTemplate(t: Template, name: string): Plan {
  const now = Date.now();
  return {
    v: 1, id: uid(), name, map: t.map, season: t.season, createdAt: now, updatedAt: now,
    ground: { ...t.ground },
    objects: t.objects.filter((o) => ITEM_BY_ID[o.id]).map((o) => ({ ...o, u: uid() })),
  };
}

// ---------------------------------------------------------------- terrain rules
const OUTDOOR = 'gdsh';
const INDOOR = 'fSt';
const RULES: Record<string, string> = {
  building: OUTDOOR,
  object: OUTDOOR + INDOOR + 'B',
  tree: OUTDOOR + INDOOR,
  crop: 'ghsdt',
  ground: OUTDOOR + INDOOR,
  rug: OUTDOOR + INDOOR,
  wall: 'W',
  water: 'wD',
};

/** Tiles where buildings may stand / where crops may grow (for the area overlays). */
export const tileBuildable = (map: MapInfo, x: number, y: number) => !!map.image || (map.flags ? (flagsAt(map, x, y) & 2) !== 0 : RULES.building.includes(terrainAt(map, x, y)));
export const tileTillable = (map: MapInfo, x: number, y: number) => !!map.image || (map.flags ? (flagsAt(map, x, y) & 4) !== 0 : RULES.crop.includes(terrainAt(map, x, y)));

export function terrainOk(it: Item, map: MapInfo, x: number, y: number) {
  if (map.image) return true; // custom layouts have no terrain data
  const place = it.place === 'ground' && it.cat === 'furniture' ? 'rug' : (it.place ?? 'object');
  const ok = RULES[place] ?? RULES.object;
  // Maps with rule data use the same three layers as the web planner: buildings need a buildable tile,
  // crops a tillable tile, everything else a walkable tile. Wall and water items still use the terrain.
  const bit = !map.flags || place === 'wall' || place === 'water' ? 0 : place === 'building' ? 2 : place === 'crop' ? 4 : 1;
  for (let j = 0; j < it.h; j++) for (let i = 0; i < it.w; i++) {
    if (bit ? !(flagsAt(map, x + i, y + j) & bit) : !ok.includes(terrainAt(map, x + i, y + j))) return false;
  }
  return true;
}

// ---------------------------------------------------------------- occupancy
export type Occ = { obj: Map<string, Placed>; rug: Map<string, Placed>; torch: Map<string, Placed> };

export const supportsTorch = (it: Item) => it.kind === 'sprinkler' || it.kind === 'fence';
export const torchLift = (o: Placed, occ: Occ) => o.id === 'torch' && occ.obj.has(key(o.x, o.y)) ? 8 : 0;

export function buildOcc(objects: Placed[]): Occ {
  const obj = new Map<string, Placed>(), rug = new Map<string, Placed>(), torch = new Map<string, Placed>();
  for (const o of objects) {
    const it = ITEM_BY_ID[o.id];
    if (!it) continue;
    const m = it.id === 'torch' ? torch : layerOf(it) === 'rug' ? rug : obj;
    for (let j = 0; j < it.h; j++) for (let i = 0; i < it.w; i++) m.set(key(o.x + i, o.y + j), o);
  }
  return { obj, rug, torch };
}

export type PlaceCheck = { ok: true } | { ok: false; reason: string };

/** Validate each footprint square with the same rules used to commit placement. */
export function placementCells(plan: Pick<Plan, 'map' | 'ground'>, occ: Occ, it: Item, x: number, y: number, ignore?: Set<string>, anywhere = false) {
  const tileItem = { ...it, w: 1, h: 1 };
  const cells: { x: number; y: number; ok: boolean }[] = [];
  for (let j = 0; j < it.h; j++) for (let i = 0; i < it.w; i++) {
    cells.push({ x: x + i, y: y + j, ok: canPlace(plan, occ, tileItem, x + i, y + j, ignore, anywhere).ok });
  }
  return cells;
}

/** `anywhere` skips the terrain rules (the "Allow placing anywhere" option). */
export function canPlace(plan: Pick<Plan, 'map' | 'ground'>, occ: Occ, it: Item, x: number, y: number, ignore?: Set<string>, anywhere = false): PlaceCheck {
  const map = MAP_BY_ID[plan.map];
  if (!map) return { ok: false, reason: 'Unknown map' };
  if (x < 0 || y < 0 || x + it.w > map.w || y + it.h > map.h) return { ok: false, reason: 'Outside the map' };
  if (!anywhere && !terrainOk(it, map, x, y)) {
    if (it.place === 'wall') return { ok: false, reason: 'Wall decor goes on interior walls' };
    if (it.place === 'water') return { ok: false, reason: 'Must be placed in water' };
    if (it.place === 'building' && map.kind === 'interior') return { ok: false, reason: 'Buildings go on the farm' };
    if (it.place === 'crop') return { ok: false, reason: "Crops need tillable ground" };
    return { ok: false, reason: "Can't build on that terrain" };
  }
  const layer = layerOf(it);
  if (layer === 'ground') {
    const o = occ.obj.get(key(x, y));
    if (o && ITEM_BY_ID[o.id]?.place === 'crop' && it.kind !== 'tilled' && it.kind !== 'watered') return { ok: false, reason: 'A crop is planted here' };
    return { ok: true };
  }
  const m = layer === 'rug' ? occ.rug : occ.obj;
  for (let j = 0; j < it.h; j++) for (let i = 0; i < it.w; i++) {
    const o = m.get(key(x + i, y + j));
    if (o && !ignore?.has(o.u) && !(it.id === 'torch' && supportsTorch(ITEM_BY_ID[o.id]))) return { ok: false, reason: `${ITEM_BY_ID[o.id]?.name ?? 'Something'} is in the way` };
    const torch = layer === 'object' ? occ.torch.get(key(x + i, y + j)) : undefined;
    if (torch && !ignore?.has(torch.u) && !supportsTorch(it)) return { ok: false, reason: 'Torch is in the way' };
    if (it.place === 'crop') {
      const g = plan.ground[key(x + i, y + j)];
      if (g && !anywhere && !/^(tilled-soil|watered-soil)$/.test(g)) return { ok: false, reason: 'Remove the flooring first' };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------- edits (immutable)
export type Edit = { ground: Record<string, string>; objects: Placed[] };

/** Newly placed, moved and copied crops all need soil across their full footprint. */
export function soilForCrops(ground: Record<string, string>, objects: Placed[]): Record<string, string> {
  let result = ground;
  for (const o of objects) {
    const it = ITEM_BY_ID[o.id];
    if (it?.place !== 'crop') continue;
    for (let j = 0; j < it.h; j++) for (let i = 0; i < it.w; i++) {
      const k = key(o.x + i, o.y + j);
      if (result[k]) continue;
      if (result === ground) result = { ...ground };
      result[k] = 'tilled-soil';
    }
  }
  return result;
}

export function placeItem(plan: Edit & { map: string }, occ: Occ, it: Item, x: number, y: number): Edit | null {
  const layer = layerOf(it);
  if (layer === 'ground') {
    const k = key(x, y);
    if (plan.ground[k] === it.id) return null;
    return { ground: { ...plan.ground, [k]: it.id }, objects: plan.objects };
  }
  const o: Placed = { u: uid(), id: it.id, x, y };
  const objects = [...plan.objects, o];
  const ground = soilForCrops(plan.ground, [o]);
  for (let j = 0; j < it.h; j++) for (let i = 0; i < it.w; i++) occ[it.id === 'torch' ? 'torch' : layer === 'rug' ? 'rug' : 'obj'].set(key(x + i, y + j), o);
  return { ground, objects };
}

/** Removes the top-most thing at a tile: object > rug > ground. */
export function eraseAt(plan: Edit, occ: Occ, x: number, y: number, only?: Layer): Edit | null {
  const k = key(x, y);
  if (!only || only === 'object') {
    const torch = occ.torch.get(k);
    if (torch) {
      removeOcc(occ.torch, torch);
      return { ground: plan.ground, objects: plan.objects.filter(p => p.u !== torch.u) };
    }
    const o = occ.obj.get(k);
    if (o) {
      removeOcc(occ.obj, o);
      return { ground: plan.ground, objects: plan.objects.filter((p) => p.u !== o.u) };
    }
  }
  if (!only || only === 'rug') {
    const r = occ.rug.get(k);
    if (r) {
      removeOcc(occ.rug, r);
      return { ground: plan.ground, objects: plan.objects.filter((p) => p.u !== r.u) };
    }
  }
  if ((!only || only === 'ground') && plan.ground[k]) {
    const g = { ...plan.ground };
    delete g[k];
    return { ground: g, objects: plan.objects };
  }
  return null;
}

function removeOcc(m: Map<string, Placed>, o: Placed) {
  const it = ITEM_BY_ID[o.id];
  if (!it) return;
  for (let j = 0; j < it.h; j++) for (let i = 0; i < it.w; i++) if (m.get(key(o.x + i, o.y + j))?.u === o.u) m.delete(key(o.x + i, o.y + j));
}

export function objectAt(occ: Occ, x: number, y: number): Placed | undefined {
  return occ.torch.get(key(x, y)) ?? occ.obj.get(key(x, y)) ?? occ.rug.get(key(x, y));
}

export function rectTiles(x0: number, y0: number, x1: number, y1: number, outline: boolean) {
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1);
  const out: [number, number][] = [];
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    if (outline && x !== xa && x !== xb && y !== ya && y !== yb) continue;
    out.push([x, y]);
  }
  return out;
}

/** Positions for stamping an item repeatedly over a rectangle (multi-tile items step by footprint). */
export function stampPositions(it: Item, x0: number, y0: number, x1: number, y1: number, outline: boolean) {
  if (it.w === 1 && it.h === 1) return rectTiles(x0, y0, x1, y1, outline);
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1);
  const out: [number, number][] = [];
  for (let y = ya; y + it.h - 1 <= yb || y === ya; y += it.h) for (let x = xa; x + it.w - 1 <= xb || x === xa; x += it.w) {
    out.push([x, y]);
    if (x + it.w > xb) break;
  }
  return out;
}

export function lineTiles(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return out;
}

// ---------------------------------------------------------------- coverage
export type RangeKind = 'spr1' | 'spr2' | 'spr3' | 'spr4' | 'scare8' | 'scare16' | 'junimo' | 'bee' | 'log';

export const RANGE_STYLE: Record<RangeKind, { color: string; label: string; group: 'water' | 'crow' | 'junimo' | 'bee' | 'log' }> = {
  spr1: { color: 'rgba(70,150,255,0.38)', label: 'Sprinkler', group: 'water' },
  spr2: { color: 'rgba(70,150,255,0.38)', label: 'Quality Sprinkler', group: 'water' },
  spr3: { color: 'rgba(70,150,255,0.38)', label: 'Iridium Sprinkler', group: 'water' },
  spr4: { color: 'rgba(70,150,255,0.38)', label: 'Iridium Sprinkler + Nozzle', group: 'water' },
  scare8: { color: 'rgba(255,190,60,0.26)', label: 'Scarecrow', group: 'crow' },
  scare16: { color: 'rgba(255,190,60,0.26)', label: 'Deluxe Scarecrow', group: 'crow' },
  junimo: { color: 'rgba(120,220,90,0.24)', label: 'Junimo Hut', group: 'junimo' },
  bee: { color: 'rgba(255,230,80,0.3)', label: 'Bee House', group: 'bee' },
  log: { color: 'rgba(170,110,60,0.3)', label: 'Mushroom Log', group: 'log' },
};

/** Tiles covered by an item's effect, relative to its top-left tile. */
export function rangeOffsets(r: RangeKind): [number, number][] {
  const out: [number, number][] = [];
  const sq = (rad: number, cx = 0, cy = 0, skipCenter = true) => {
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (!(skipCenter && x === 0 && y === 0)) out.push([cx + x, cy + y]);
  };
  switch (r) {
    case 'spr1': return [[0, -1], [1, 0], [0, 1], [-1, 0]];
    case 'spr2': sq(1); return out;
    case 'spr3': sq(2); return out;
    case 'spr4': sq(3); return out;
    case 'scare8':
    case 'scare16': {
      const rad = r === 'scare8' ? 8 : 16;
      // Wiki: a circle of 249 tiles with the scarecrow (888 around a Deluxe Scarecrow), which is every tile
      // closer than radius + 1 to the center: 8 tiles in a straight line and 6 on the diagonal.
      for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (x * x + y * y < (rad + 1) * (rad + 1) && !(x === 0 && y === 0)) out.push([x, y]);
      return out;
    }
    case 'junimo': sq(8, 1, 1, false); return out;
    case 'bee':
      for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (Math.abs(x) + Math.abs(y) <= 5 && !(x === 0 && y === 0)) out.push([x, y]);
      return out;
    case 'log': sq(3); return out;
  }
}

const OFFSETS_CACHE: Partial<Record<RangeKind, [number, number][]>> = {};
export const offsetsFor = (r: RangeKind) => (OFFSETS_CACHE[r] ??= rangeOffsets(r));

export function coverage(objects: Placed[], groups?: Set<string>) {
  const res: Record<string, Set<string>> = { water: new Set(), crow: new Set(), junimo: new Set(), bee: new Set(), log: new Set() };
  for (const o of objects) {
    const it = ITEM_BY_ID[o.id];
    const r = it?.range as RangeKind | undefined;
    if (!r || !RANGE_STYLE[r]) continue;
    const g = RANGE_STYLE[r].group;
    if (groups && !groups.has(g)) continue;
    for (const [dx, dy] of offsetsFor(r)) res[g].add(key(o.x + dx, o.y + dy));
  }
  return res;
}

// ---------------------------------------------------------------- warnings
/** Fruit trees whose 8 neighbors aren't clear. */
export function blockedTrees(objects: Placed[], occ: Occ) {
  const out = new Set<string>();
  for (const o of objects) {
    const it = ITEM_BY_ID[o.id];
    if (it?.kind !== 'fruittree') continue;
    for (let dy = -1; dy <= 1 && !out.has(o.u); dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const n = occ.obj.get(key(o.x + dx, o.y + dy)) ?? occ.torch.get(key(o.x + dx, o.y + dy));
      if (n && n.u !== o.u) { out.add(o.u); break; }
    }
  }
  return out;
}

// ---------------------------------------------------------------- stats
export type Stats = {
  counts: { it: Item; n: number }[];
  gold: number;
  mats: { name: string; n: number; it?: Item }[];
  tiles: number;
  crops: number;
  cropsWatered: number;
  cropsProtected: number;
  bySeason: Record<string, number>;
};

export function computeStats(plan: Pick<Plan, 'ground' | 'objects'>): Stats {
  const cnt = new Map<string, number>();
  for (const o of plan.objects) cnt.set(o.id, (cnt.get(o.id) ?? 0) + 1);
  for (const g of Object.values(plan.ground)) cnt.set(g, (cnt.get(g) ?? 0) + 1);
  const counts = [...cnt.entries()].map(([id, n]) => ({ it: ITEM_BY_ID[id], n })).filter((c) => c.it).sort((a, b) => b.n - a.n || a.it.name.localeCompare(b.it.name));
  let gold = 0;
  const mats = new Map<string, number>();
  for (const { it, n } of counts) {
    if (it.id === 'farmhouse' || it.id === 'greenhouse') continue;
    if (it.gold) gold += it.gold * n;
    else if (it.buy && (it.place === 'crop' || it.place === 'tree' || it.cat === 'furniture')) gold += it.buy * n;
    if (it.mats && (it.cat !== 'cooking')) for (const [m, q] of it.mats) mats.set(m, (mats.get(m) ?? 0) + q * n);
  }
  const cov = coverage(plan.objects);
  let crops = 0, cropsWatered = 0, cropsProtected = 0;
  const bySeason: Record<string, number> = {};
  for (const o of plan.objects) {
    const it = ITEM_BY_ID[o.id];
    if (it?.place !== 'crop') continue;
    crops++;
    const k = key(o.x, o.y);
    if (cov.water.has(k) || it.kind === 'teabush') cropsWatered++;
    if (cov.crow.has(k)) cropsProtected++;
    for (const s of it.seasons ?? ['any']) if (s !== 'ginger island') bySeason[s] = (bySeason[s] ?? 0) + 1;
  }
  return {
    counts, gold,
    mats: [...mats.entries()].map(([name, n]) => ({ name, n, it: itemByName(name) })).sort((a, b) => b.n - a.n),
    tiles: Object.keys(plan.ground).length,
    crops, cropsWatered, cropsProtected, bySeason,
  };
}

// ---------------------------------------------------------------- layout change
/** Moves a plan to another layout. Keeps everything that is still inside the new map. */
export function fitToMap(plan: Pick<Plan, 'ground' | 'objects'>, mapId: string): Edit {
  const map = MAP_BY_ID[mapId];
  if (!map) return { ground: plan.ground, objects: plan.objects };
  const objects = plan.objects.filter((o) => {
    const it = ITEM_BY_ID[o.id];
    return it && o.x >= 0 && o.y >= 0 && o.x + it.w <= map.w && o.y + it.h <= map.h;
  });
  const ground: Record<string, string> = {};
  for (const [k, v] of Object.entries(plan.ground)) {
    const [x, y] = k.split(',').map(Number);
    if (x >= 0 && y >= 0 && x < map.w && y < map.h) ground[k] = v;
  }
  return { ground, objects };
}

// ---------------------------------------------------------------- serialization
export function validatePlan(x: any): Plan | null {
  if (!x || typeof x !== 'object' || !MAP_BY_ID[x.map] || !Array.isArray(x.objects) || typeof x.ground !== 'object') return null;
  const objects: Placed[] = x.objects
    .filter((o: any) => o && ITEM_BY_ID[o.id] && Number.isFinite(o.x) && Number.isFinite(o.y))
    .map((o: any) => ({ u: String(o.u ?? uid()), id: String(o.id), x: Math.round(o.x), y: Math.round(o.y) }));
  const ground: Record<string, string> = {};
  for (const [k, v] of Object.entries(x.ground)) if (typeof v === 'string' && ITEM_BY_ID[v] && /^-?\d+,-?\d+$/.test(k)) ground[k] = v;
  const season = ['spring', 'summer', 'fall', 'winter'].includes(x.season) ? x.season : 'spring';
  return {
    v: 1, id: String(x.id ?? uid()), name: String(x.name ?? 'Imported Farm').slice(0, 60), map: x.map, season,
    createdAt: Number(x.createdAt) || Date.now(), updatedAt: Date.now(), ground, objects, notes: typeof x.notes === 'string' ? x.notes : undefined,
  };
}
