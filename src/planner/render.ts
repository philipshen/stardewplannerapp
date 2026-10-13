/** Builds Skia sprite batches for a plan and draws plans offscreen (export/thumbnails). */
import { BlendMode, FilterMode, MipmapMode, Skia, SkCanvas, SkImage, SkRect, SkRSXform } from '@shopify/react-native-skia';
import { ITEM_BY_ID, SPRITES, SpriteRec } from '../data/items';
import { Occ, Plan, torchLift } from './model';
import { grassTufts, groundKey, spriteKey } from './render.keys';

import { planLights } from './lighting';
import { drawNight } from './night';

export { groundKey, spriteKey };

export const TILE = 16;
export const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;

export type Batch = { sprites: SkRect[]; xf: SkRSXform[] };
export type DrawData = { ground: Batch; rugs: Batch; objects: Batch; lights: ReturnType<typeof planLights> };

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
  const foliage: { rec: SpriteRec; x: number; y: number; depth: number }[] = [];
  for (const [k, id] of Object.entries(plan.ground)) {
    const [x, y] = k.split(',').map(Number);
    const item = ITEM_BY_ID[id];
    if (item?.kind === 'grassplant' || item?.kind === 'bluegrass') {
      for (const tuft of grassTufts(x, y)) {
        const rec = SPRITES.world[`${id}@${plan.season}#${tuft.variant}`];
        if (rec) foliage.push({ rec, x: x + tuft.dx / TILE, y: y - tuft.dy / TILE, depth: y + 1 });
      }
      continue;
    }
    push(ground, SPRITES.world[groundKey(id, x, y, plan.season)], x, y);
  }
  const sorted = [...plan.objects].sort((a, b) => {
    const ia = ITEM_BY_ID[a.id], ib = ITEM_BY_ID[b.id];
    return a.y + (ia?.h ?? 1) - (b.y + (ib?.h ?? 1)) || a.x - b.x || Number(a.id === 'torch') - Number(b.id === 'torch');
  });
  let grassIndex = 0;
  foliage.sort((a, b) => a.depth - b.depth || a.x - b.x);
  for (const o of sorted) {
    if (hide?.has(o.u)) continue;
    const it = ITEM_BY_ID[o.id];
    if (!it) continue;
    while (grassIndex < foliage.length && foliage[grassIndex].depth <= o.y + it.h) {
      const g = foliage[grassIndex++];
      push(objects, g.rec, g.x, g.y);
    }
    const target = it.place === 'ground' && it.cat === 'furniture' ? rugs : objects;
    push(target, SPRITES.world[spriteKey(o, plan.season, occ)], o.x, o.y - torchLift(o, occ) / TILE);
  }
  for (; grassIndex < foliage.length; grassIndex++) {
    const g = foliage[grassIndex];
    push(objects, g.rec, g.x, g.y);
  }
  return { ground, rugs, objects, lights: planLights(plan.objects, occ) };
}

/** Draws terrain + plan into any Skia canvas (used for PNG export and thumbnails). */
export function drawPlan(canvas: SkCanvas, terrain: SkImage, sheet: SkImage, data: DrawData, scale: number, worldW = terrain.width(), worldH = terrain.height(), night = false) {
  const paint = Skia.Paint();
  canvas.save();
  canvas.scale(scale, scale);
  canvas.drawImageRectOptions(terrain, Skia.XYWHRect(0, 0, terrain.width(), terrain.height()), Skia.XYWHRect(0, 0, worldW, worldH), FilterMode.Nearest, MipmapMode.None, paint);
  for (const b of [data.ground, data.rugs, data.objects]) {
    if (b.sprites.length) canvas.drawAtlas(sheet, b.sprites, b.xf, paint, BlendMode.SrcOver, undefined, NEAREST);
  }
  if (night) drawNight(canvas, data.lights, worldW, worldH);
  canvas.restore();
}

export function renderPlanPNG(terrain: SkImage, sheet: SkImage, data: DrawData, scale: number, worldW = terrain.width(), worldH = terrain.height(), night = false): string | null {
  const w = Math.round(worldW * scale), h = Math.round(worldH * scale);
  // CPU raster surface: offscreen GPU surfaces would each claim a WebGL context on web,
  // and browsers evict the oldest context (the live canvas) once too many exist.
  const surface = Skia.Surface.Make(w, h);
  if (!surface) return null;
  try {
    const canvas = surface.getCanvas();
    drawPlan(canvas, terrain, sheet, data, scale, worldW, worldH, night);
    surface.flush();
    const img = surface.makeImageSnapshot();
    const out = img.encodeToBase64();
    img.dispose?.();
    return out;
  } finally {
    surface.dispose?.();
  }
}
