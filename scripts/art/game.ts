/** Game artwork atlas rectangles, indexed from the existing local planner atlas. */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import atlas from '../data/game-sprites.json';
import itemImages from '../data/game-item-images.json';
import { Img } from './png';

type Entry = { id: string; name: string; x: number; y: number; width: number; height: number; footprint?: { offsetColumn?: number }; hideInMenu?: boolean };
type Item = { id: string; name: string; w: number; h: number; kind: string; tags?: string[] };
const entries = atlas as Record<string, Entry>;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const byName = new Map(Object.values(entries).filter((e) => !/-((spring|summer|fall|winter)|[nesw]{1,2}|[hv][cnesw])$/.test(e.id)).map((e) => [norm(e.name), e]));
const aliases: Record<string, string> = {
  cabin: 'log-cabin', farmhouse: 'house', 'farmhouse-upgrade-1': 'house-2', 'farmhouse-upgrade-2': 'house-3',
  greenhouse: 'greenhouse-repaired', 'greenhouse-ruined': 'greenhouse',
  'crop-coffee-plant': 'coffee-bean', 'fiber-plant': 'fiber-seeds', 'crop-mixed-seeds': 'spring-seeds',
  'crop-sweet-gem-berry': 'rare-seed', gate: 'wood-gate', 'stone-walkway-floor': 'stone-walkway',
  'wood-floor': 'wooden-floor', 'wood-path': 'wooden-path', 'cobblestone-path': 'cobblestone',
  'tilled-soil': 'hoe-dirt', 'watered-soil': 'hoe-dirt-watered',
  'small-globe': 'globe', 'large-log': 'basic-log',
  'tree-pine-tree': 'pine-tree', 'tree-mushroom-tree': 'mushroom-tree',
  'iridium-sprinkler-p': 'iridium-sprinkler-pressured', 'quality-sprinkler-p': 'quality-sprinkler-pressured', 'stone-debris': 'stone',
  'window': 'basic-window', 'community-fish-tank': 'ccfishtank', 'exotic-palm': 'exotic-tree',
  'monster-danger': 'monster-danglers', 'dining-chair-red': 'red-diner-chair', 'dining-chair-yellow': 'dining-chair',
  'tree-green-rain-tree-1': 'green-tree-1', 'tree-green-rain-tree-2': 'green-tree-2', 'tree-green-rain-tree-3': 'green-tree-3',
};
const png = PNG.sync.read(fs.readFileSync(path.join(__dirname, '../../assets/game/sprites.png')));
const sheet = new Img(png.width, png.height);
sheet.data.set(png.data);
export function gameEntry(it: Item): Entry | undefined {
  const alias = aliases[it.id];
  if (alias) return entries[alias];
  return entries[it.id] ?? byName.get(norm(it.name)) ?? it.tags?.map((t) => byName.get(norm(t))).find(Boolean);
}
const individual = new Map<string, Img>();
for (const [id, entry] of Object.entries(itemImages)) {
  const source = PNG.sync.read(fs.readFileSync(path.join(__dirname, '../../assets/game/items', entry.file)));
  // Wiki images enlarge game pixels; restore native resolution without smoothing.
  const img = new Img(Math.round(source.width / entry.scale), Math.round(source.height / entry.scale));
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const src = (Math.min(source.height - 1, y * entry.scale) * source.width + Math.min(source.width - 1, x * entry.scale)) * 4;
    img.data.set(source.data.subarray(src, src + 4), (y * img.w + x) * 4);
  }
  individual.set(id, img);
}

export function gameSprite(it: Item, season = 'spring', variant = 0, mask?: number) {
  const own = individual.get(it.id);
  if (own) return { img: own, ox: it.kind === 'tree' ? -Math.floor((own.w - 16) / 2) : 0, oy: it.h * 16 - own.h };
  let entry = gameEntry(it);
  if (!entry) return null;
  if (mask !== undefined) {
    const suffix = ['', 'vs', 'hw', 'ne', 'vn', 'vc', 'se', 'vc', 'he', 'nw', 'hc', 'hc', 'sw', 'vc', 'hc', 'hc'][mask];
    entry = entries[`${entry.id}-${suffix}`] ?? entry;
  }
  if (it.kind === 'grassplant' || it.kind === 'bluegrass') entry = entries[`${entry.id}${variant % 3 ? '-' + variant % 3 : ''}`] ?? entry;
  entry = entries[`${entry.id}-${season}`] ?? entry;
  const img = new Img(entry.width, entry.height);
  img.blit(sheet, 0, 0, entry.x, entry.y, entry.width, entry.height);
  return { img, ox: -(entry.footprint?.offsetColumn ?? (it.kind === 'tree' || it.kind === 'fruittree' ? 1 : 0)) * 16, oy: it.h * 16 - entry.height };
}
