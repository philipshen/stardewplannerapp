import rawMaps from './generated/maps.json';
import rawPresets from './generated/layoutPresets.json';

export type MapInfo = {
  id: string;
  name: string;
  kind: 'farm' | 'interior';
  w: number;
  h: number;
  blurb: string;
  grid: string;
  defaults: { id: string; x: number; y: number }[];
  seasons: string[];
  /** Rule digit per tile from the game's maps: 1 walkable + 2 buildable + 4 tillable. */
  flags?: string;
  /** Community layouts credit their author. */
  author?: string;
  /** Custom layouts carry their own background image (data or file URI). */
  image?: string;
};

export const MAPS = rawMaps as MapInfo[];

/** Sizes of community layouts. Used as presets when the user adds their own map image. */
export const LAYOUT_PRESETS = rawPresets as { name: string; author: string; w: number; h: number }[];
export const MAP_BY_ID: Record<string, MapInfo> = Object.fromEntries(MAPS.map((m) => [m.id, m]));

/** A layout the user made from their own image. Every tile allows every item. */
export type CustomLayout = { id: string; name: string; w: number; h: number; image: string };
export const MAX_CUSTOM_TILES = 200;

export function customMapInfo(l: CustomLayout): MapInfo {
  return { id: l.id, name: l.name, kind: 'farm', w: l.w, h: l.h, blurb: 'Custom layout from your own image.', grid: 'g'.repeat(l.w * l.h), defaults: [], seasons: ['spring'], image: l.image };
}

export function registerCustomMap(l: CustomLayout) {
  MAP_BY_ID[l.id] = customMapInfo(l);
}

export function unregisterCustomMap(id: string) {
  if (MAP_BY_ID[id]?.image) delete MAP_BY_ID[id];
}

export function validateLayout(x: any): CustomLayout | null {
  if (!x || typeof x !== 'object' || typeof x.image !== 'string' || !/^custom-[a-z0-9]+$/.test(String(x.id))) return null;
  const w = Math.round(Number(x.w)), h = Math.round(Number(x.h));
  if (!(w >= 4 && w <= MAX_CUSTOM_TILES && h >= 4 && h <= MAX_CUSTOM_TILES)) return null;
  return { id: x.id, name: String(x.name ?? 'Custom layout').slice(0, 60), w, h, image: x.image };
}

/** Terrain characters (see scripts/art/maps.ts CODE_CHARS). */
export const TERRAIN = {
  void: '.', grass: 'g', dirt: 'd', water: 'w', sand: 's', cliff: 'C', forest: 'F', rock: 'R', bridge: 'B',
  high: 'h', floor: 'f', wall: 'W', soil: 't', deep: 'D', stone: 'S',
} as const;

/** Rule bits of a tile (1 walkable, 2 buildable, 4 tillable), or -1 when the map has no rule data. */
export const flagsAt = (m: MapInfo, x: number, y: number) =>
  !m.flags ? -1 : x < 0 || y < 0 || x >= m.w || y >= m.h ? 0 : m.flags.charCodeAt(y * m.w + x) - 48;

export const terrainAt = (m: MapInfo, x: number, y: number) =>
  x < 0 || y < 0 || x >= m.w || y >= m.h ? '.' : m.grid[y * m.w + x];

export const TERRAIN_LABEL: Record<string, string> = {
  '.': 'Out of bounds', g: 'Grass', d: 'Dirt path', w: 'Water', s: 'Sand', C: 'Cliff', F: 'Forest', R: 'Rocky ground',
  B: 'Bridge', h: 'Grass', f: 'Floor', W: 'Wall', t: 'Soil', D: 'Deep water', S: 'Stone floor',
};
