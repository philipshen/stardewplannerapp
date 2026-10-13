/**
 * Renders a plan (a .stardewplan.json file or a template) as the app draws it, to check the look of a whole farm.
 *   npx tsx scripts/preview-scene.ts --template 0 --out /tmp/farm.png [--rect x,y,w,h] [--scale 2] [--season fall]
 *   npx tsx scripts/preview-scene.ts --plan my.stardewplan.json --out /tmp/farm.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { ITEM_BY_ID, SPRITES } from '../src/data/items';
import { buildOcc } from '../src/planner/model';
import { grassTufts, groundKey, spriteKey } from '../src/planner/render.keys';

const arg = (k: string, d?: string) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const plan = arg('plan')
  ? JSON.parse(fs.readFileSync(arg('plan')!, 'utf8'))
  : JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/generated/templates.json'), 'utf8'))[Number(arg('template', '0'))];
const season = arg('season', plan.season)!;
const read = (f: string) => PNG.sync.read(fs.readFileSync(f));
const mapFile = (s: string) => path.join(ROOT, 'assets/gen/maps', `${plan.map}-${s}.png`);
const terrain = read(fs.existsSync(mapFile(season)) ? mapFile(season) : mapFile('spring'));
const sheet = read(path.join(ROOT, 'assets/gen/world-0.png'));
const out = new PNG({ width: terrain.width, height: terrain.height });
terrain.data.copy(out.data);

function draw(rec: number[] | undefined, tx: number, ty: number) {
  if (!rec) return;
  const [, sx, sy, sw, sh, ox, oy] = rec;
  for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
    const X = tx * 16 + ox + i, Y = ty * 16 + oy + j;
    if (X < 0 || Y < 0 || X >= out.width || Y >= out.height) continue;
    const s = ((sy + j) * sheet.width + sx + i) * 4, d = (Y * out.width + X) * 4;
    const a = sheet.data[s + 3] / 255;
    if (!a) continue;
    for (let c = 0; c < 3; c++) out.data[d + c] = Math.round(sheet.data[s + c] * a + out.data[d + c] * (1 - a));
    out.data[d + 3] = 255;
  }
}
const foliage: {rec: number[]; x: number; y: number; depth: number}[] = [];
for (const [k, id] of Object.entries(plan.ground as Record<string, string>)) {
  const [x, y] = k.split(',').map(Number);
  if (['grassplant', 'bluegrass'].includes(ITEM_BY_ID[id]?.kind)) {
    for (const tuft of grassTufts(x,y)) {
      const rec = SPRITES.world[`${id}@${season}#${tuft.variant}`];
      if(rec) foliage.push({rec,x:x+tuft.dx/16,y:y-tuft.dy/16,depth:y+1});
    }
  } else draw(SPRITES.world[groundKey(id, x, y, season as any)], x, y);
}
const occ = buildOcc(plan.objects);
const sorted = [...plan.objects].sort((a: any, b: any) => a.y + (ITEM_BY_ID[a.id]?.h ?? 1) - (b.y + (ITEM_BY_ID[b.id]?.h ?? 1)) || a.x - b.x);
for (const o of sorted.filter((o: any) => ITEM_BY_ID[o.id]?.place === 'ground')) draw(SPRITES.world[spriteKey(o, season as any, occ)], o.x, o.y);
foliage.sort((a,b)=>a.depth-b.depth || a.x-b.x);
let fi=0;
for (const o of sorted.filter((o: any) => ITEM_BY_ID[o.id]?.place !== 'ground')) {
  while(fi<foliage.length && foliage[fi].depth<=o.y+(ITEM_BY_ID[o.id]?.h??1)) { const g=foliage[fi++]; draw(g.rec,g.x,g.y); }
  draw(SPRITES.world[spriteKey(o, season as any, occ)],o.x,o.y);
}
for(;fi<foliage.length;fi++){const g=foliage[fi];draw(g.rec,g.x,g.y);}

const [rx, ry, rw, rh] = (arg('rect') ?? `0,0,${terrain.width / 16},${terrain.height / 16}`).split(',').map(Number);
const scale = Number(arg('scale', arg('rect') ? '3' : '1'));
const crop = new PNG({ width: rw * 16 * scale, height: rh * 16 * scale });
for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
  const s = ((ry * 16 + Math.floor(y / scale)) * out.width + rx * 16 + Math.floor(x / scale)) * 4, d = (y * crop.width + x) * 4;
  out.data.copy(crop.data, d, s, s + 4);
}
fs.writeFileSync(arg('out')!, PNG.sync.write(crop, { deflateLevel: 9, deflateStrategy: 0 }));
console.log(`wrote ${arg('out')} ${crop.width}x${crop.height}`);
