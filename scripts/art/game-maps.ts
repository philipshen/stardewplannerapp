/** Bundle the source terrain without repainting, recoloring, or stretching tiles. */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { Img, fitInto } from './png';
import layouts from '../data/layouts.json';
import { renderSlimeHutch } from './slime-hutch';

const root = path.join(__dirname, '../..');
const farms: Record<string, string> = {
  standard: 'farm_default', riverland: 'farm_fishing', forest: 'farm_foraging',
  hilltop: 'farm_mining', wilderness: 'farm_combat', 'four-corners': 'farm_fourcorners',
  beach: 'farm_island', meadowlands: 'farm_ranching',
};
const rooms: Record<string, string> = {
  greenhouse: 'greenhouse', shed: 'shed', 'big-shed': 'shed-big', cabin: 'farmhouse',
  'farmhouse-0': 'farmhouse', 'farmhouse-1': 'farmhouse_upgraded_1',
  'farmhouse-1m': 'farmhouse_upgraded_1_marriage', farmhouse: 'farmhouse_upgraded_2',
  'farmhouse-2m': 'farmhouse_upgraded_2_marriage', cellar: 'farmhouse_cellar',
  barn: 'barn', 'big-barn': 'barn-big', 'deluxe-barn': 'barn-deluxe',
  coop: 'coop', 'big-coop': 'coop-big', 'deluxe-coop': 'coop-deluxe',
};
const other: Record<string, string> = {
  'ginger-island': 'ginger_island', quarry: 'quarry',
  'immersive-farm-2-remastered': 'immersive-farm-2-remastered',
  'immersive-farm-2-remastered-no-static': 'immersive-farm-2-remastered-no-static',
  'bigger-standard-farm': 'bigger_standard_farm', 'capitalist-dream-2': 'capitalist_dream_2',
  'more-space-forest': 'more_space_forest', 'omni-farm': 'omni_farm',
};
type MapInfo = { id: string; w: number; h: number; seasons: string[] };

function roomOrigin(name: string) {
  const raw = layouts.find(r => r.name === name);
  if (!raw) throw new Error(`Missing room layout: ${name}`);
  const w = raw.w ?? raw.tw!, h = raw.h ?? raw.th!;
  let x0 = w, y0 = h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = raw.terrain?.[y]?.[x];
    const floor = raw.flags ? !!(Number(raw.flags[y]?.[x] ?? 0) & 1) : c !== undefined && c !== 'k' && c !== 'c';
    if (floor) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); }
  }
  // Match roomFromData's margins so existing plan coordinates stay unchanged.
  return [Math.max(0, x0 - 1) * 16, Math.max(0, y0 - 3) * 16];
}

export function buildGameMaps(maps: MapInfo[]) {
  for (const map of maps) {
    if (map.id === 'slime-hutch') {
      const image = renderSlimeHutch(map.w, map.h);
      image.save(path.join(root, 'assets/gen/maps/slime-hutch-spring.png'));
      fitInto(image, map.w * 4, map.h * 4).save(path.join(root, 'assets/gen/maps/slime-hutch-thumb.png'));
      continue;
    }
    const base = farms[map.id] ?? rooms[map.id] ?? other[map.id];
    if (!base) { console.warn(`No source terrain for ${map.id}; retaining existing asset`); continue; }
    for (const season of map.seasons) {
      const suffix = farms[map.id] && season !== 'spring' ? `_${season}` : '';
      const file = path.join(root, 'assets/game/maps-src', `${base}${suffix}.png`);
      const png = PNG.sync.read(fs.readFileSync(file));
      const source = new Img(png.width, png.height); source.data.set(png.data);
      const width = map.w * 16, height = map.h * 16;
      let x = 0, y = 0;
      if (rooms[map.id] && (source.w !== width || source.h !== height)) [x, y] = roomOrigin(base);
      // Community source maps can omit the final fraction of a tile. Pad only;
      // never resize the entire image, which shifts every placement coordinate.
      const horizontalPadding = map.id === 'cabin' ? 32 : 15;
      if (x + width > source.w + horizontalPadding || y + height > source.h + 15) throw new Error(`Terrain dimensions do not match ${map.id}`);
      const image = new Img(width, height);
      image.blit(source, 0, 0, x, y, Math.min(width, source.w - x), Math.min(height, source.h - y));
      image.save(path.join(root, 'assets/gen/maps', `${map.id}-${season}.png`));
      if (season === 'spring') fitInto(image, map.w * 4, map.h * 4).save(path.join(root, 'assets/gen/maps', `${map.id}-thumb.png`));
    }
    console.log(`source terrain: ${map.id}`);
  }
}
