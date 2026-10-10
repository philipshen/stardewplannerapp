/** Builds Skia sprite batches for a plan and draws plans offscreen (export/thumbnails). */
import { BlendMode, FilterMode, MipmapMode, Skia, SkCanvas, SkImage, SkRect, SkRSXform } from '@shopify/react-native-skia';
import { ITEM_BY_ID, SPRITES, SpriteRec } from '../data/items';
import type { Season } from '../theme';
import { key, Occ, Placed, Plan } from './model';

export const TILE = 16;
export const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;

export type Batch = { sprites: SkRect[]; xf: SkRSXform[] };
export type DrawData = { ground: Batch; rugs: Batch; objects: Batch };

const tileHash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

function fenceMask(o: Placed, occ: Occ) {
  const it = ITEM_BY_ID[o.id];
  let m = 0;
  const conn = (x: number, y: number) => {
    const n = occ.obj.get(key(x, y));
    if (!n) return false;
    const k = ITEM_BY_ID[n.id]?.kind;
    return k === 'fence' || k === 'gate';
  };
  if (conn(o.x, o.y - 1)) m |= 1;
  if (conn(o.x + 1, o.y)) m |= 2;
  if (conn(o.x, o.y + 1)) m |= 4;
  if (conn(o.x - 1, o.y)) m |= 8;
  void it;
  return m;
}

export function spriteKey(o: Placed, season: Season, occ?: Occ) {
  const it = ITEM_BY_ID[o.id];
  if (!it) return o.id;
  if (it.kind === 'building') return `${it.id}@${season === 'winter' ? 'winter' : 'spring'}`;
  if (it.kind === 'tree' || it.kind === 'fruittree') return `${it.id}@${season}`;
  if (it.kind === 'fence') return `${it.id}#${occ ? fenceMask(o, occ) : 10}`;
  return it.id;
}

export function groundKey(id: string, x: number, y: number, season: Season) {
  const it = ITEM_BY_ID[id];
  const v = tileHash(x, y) % 4;
  if (it?.kind === 'grassplant' || it?.kind === 'bluegrass') return `${id}@${season}#${v}`;
  return `${id}#${v}`;
}

function push(b: Batch, rec: SpriteRec | undefined, x: number, y: number) {
  if (!rec) return;
  const [, sx, sy, sw, sh, ox, oy] = rec;
  b.sprites.push(Skia.XYWHRect(sx, sy, sw, sh));
  b.xf.push(Skia.RSXform(1, 0, x * TILE + ox, y * TILE + oy));
}

export function buildDrawData(plan: Pick<Plan, 'ground' | 'objects' | 'season'>, occ: Occ, hide?: Set<string>): DrawData {
  const ground: Batch = { sprites: [], xf: [] };
  const rugs: Batch = { sprites: [], xf: [] };
  const objects: Batch = { sprites: [], xf: [] };
  for (const [k, id] of Object.entries(plan.ground)) {
    const [x, y] = k.split(',').map(Number);
    push(ground, SPRITES.world[groundKey(id, x, y, plan.season)], x, y);
  }
  const sorted = [...plan.objects].sort((a, b) => {
    const ia = ITEM_BY_ID[a.id], ib = ITEM_BY_ID[b.id];
    return a.y + (ia?.h ?? 1) - (b.y + (ib?.h ?? 1)) || a.x - b.x;
  });
  for (const o of sorted) {
    if (hide?.has(o.u)) continue;
    const it = ITEM_BY_ID[o.id];
    if (!it) continue;
    const target = it.place === 'ground' && it.cat === 'furniture' ? rugs : objects;
    push(target, SPRITES.world[spriteKey(o, plan.season, occ)], o.x, o.y);
  }
  return { ground, rugs, objects };
}

/** Draws terrain + plan into any Skia canvas (used for PNG export and thumbnails). */
export function drawPlan(canvas: SkCanvas, terrain: SkImage, sheet: SkImage, data: DrawData, scale: number) {
  const paint = Skia.Paint();
  canvas.save();
  canvas.scale(scale, scale);
  canvas.drawImageRectOptions(terrain, Skia.XYWHRect(0, 0, terrain.width(), terrain.height()), Skia.XYWHRect(0, 0, terrain.width(), terrain.height()), FilterMode.Nearest, MipmapMode.None, paint);
  for (const b of [data.ground, data.rugs, data.objects]) {
    if (b.sprites.length) canvas.drawAtlas(sheet, b.sprites, b.xf, paint, BlendMode.SrcOver, undefined, NEAREST);
  }
  canvas.restore();
}

export function renderPlanPNG(terrain: SkImage, sheet: SkImage, data: DrawData, scale: number): string | null {
  const w = Math.round(terrain.width() * scale), h = Math.round(terrain.height() * scale);
  // CPU raster surface: offscreen GPU surfaces would each claim a WebGL context on web,
  // and browsers evict the oldest context (the live canvas) once too many exist.
  const surface = Skia.Surface.Make(w, h);
  if (!surface) return null;
  try {
    const canvas = surface.getCanvas();
    drawPlan(canvas, terrain, sheet, data, scale);
    surface.flush();
    const img = surface.makeImageSnapshot();
    const out = img.encodeToBase64();
    img.dispose?.();
    return out;
  } finally {
    surface.dispose?.();
  }
}
