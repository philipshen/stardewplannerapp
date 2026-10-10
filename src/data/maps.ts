import rawMaps from './generated/maps.json';
import { MAP_IMAGES } from './generated/assets';

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
};

export const MAPS = rawMaps as MapInfo[];
export const MAP_BY_ID: Record<string, MapInfo> = Object.fromEntries(MAPS.map((m) => [m.id, m]));

export function mapImage(id: string, season: string) {
  const m = MAP_IMAGES[id];
  return m?.[season] ?? m?.spring;
}
export function mapThumb(id: string) {
  return MAP_IMAGES[id]?.thumb;
}

/** Terrain characters (see scripts/art/maps.ts CODE_CHARS). */
export const TERRAIN = {
  void: '.', grass: 'g', dirt: 'd', water: 'w', sand: 's', cliff: 'C', forest: 'F', rock: 'R', bridge: 'B',
  high: 'h', floor: 'f', wall: 'W', soil: 't', deep: 'D', stone: 'S',
} as const;

export const terrainAt = (m: MapInfo, x: number, y: number) =>
  x < 0 || y < 0 || x >= m.w || y >= m.h ? '.' : m.grid[y * m.w + x];

export const TERRAIN_LABEL: Record<string, string> = {
  '.': 'Out of bounds', g: 'Grass', d: 'Dirt path', w: 'Water', s: 'Sand', C: 'Cliff', F: 'Forest', R: 'Rocky ground',
  B: 'Bridge', h: 'Grass', f: 'Floor', W: 'Wall', t: 'Soil', D: 'Deep water', S: 'Stone floor',
};
