/**
 * Renders part of a layout's terrain, so the terrain art can be checked by eye.
 *   npx tsx scripts/preview-map.ts --map hilltop --season spring --rect 0,0,30,20 --scale 3 --out /tmp/t.png
 * --rect is x,y,w,h in tiles (default: the whole map at scale 1).
 */
import { Img } from './art/png';
import { MAPS, renderMap } from './art/maps';

const arg = (k: string, d?: string) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const id = arg('map', 'standard')!;
const def = MAPS.map((m) => m()).find((m) => m.id === id);
if (!def) { console.log('unknown map. ids:', MAPS.map((m) => m().id).join(', ')); process.exit(1); }
const full = renderMap(def, (arg('season', 'spring') as any));
const [rx, ry, rw, rh] = (arg('rect') ?? `0,0,${def.w},${def.h}`).split(',').map(Number);
const scale = Number(arg('scale', arg('rect') ? '3' : '1'));
const crop = new Img(rw * 16, rh * 16);
crop.blit(full, 0, 0, rx * 16, ry * 16, rw * 16, rh * 16);
const out = new Img(crop.w * scale, crop.h * scale);
out.blitScaled(crop, 0, 0, scale);
out.save(arg('out')!);
console.log(`wrote ${arg('out')} ${out.w}x${out.h} (${def.id} ${def.w}x${def.h} tiles)`);
