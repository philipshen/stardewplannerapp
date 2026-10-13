/**
 * Renders a contact sheet of world sprites, so art can be checked by eye.
 *
 *   npx tsx scripts/preview-art.ts --module crops --kinds crop,teabush --out /tmp/crops.png
 *   npx tsx scripts/preview-art.ts --module buildings --out /tmp/b.png [--name "Barn|Coop"] [--season winter]
 *
 * --module   file in scripts/art/paint (only this module is loaded, so broken work elsewhere cannot stop you)
 * --kinds    comma list of item kinds (not needed for buildings)
 * --name     regex filter on the item name
 * --bg       grass (default) | floor | dark
 * --scale    pixel zoom, default 4
 * --cols     sprites per row, default 8
 * The index of each sprite is printed to stdout, row by row.
 */
import fs from 'node:fs';
import path from 'node:path';
import { hex, Img, Rng } from './art/png';
import { accentColor, baseColor } from './art/palette';
import { BUILDING_SIZES } from './supplemental';

const arg = (k: string, d?: string) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const modName = arg('module')!;
const kinds = new Set((arg('kinds') ?? '').split(',').filter(Boolean));
const nameRe = arg('name') ? new RegExp(arg('name')!, 'i') : null;
const season = (arg('season') ?? 'spring') as any;
const scale = Number(arg('scale') ?? 4), cols = Number(arg('cols') ?? 8);
const out = arg('out')!;
const BG: Record<string, [string, string]> = { grass: ['#5cad3a', '#56a436'], floor: ['#c69a62', '#bd905a'], dark: ['#3a2c34', '#33262e'] };
const bg = BG[arg('bg') ?? 'grass'];

type Item = { id: string; name: string; kind: string; w: number; h: number; place: string | null; tall?: number; cat: string };
const items: Item[] = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'generated', 'items.json'), 'utf8'));

(async () => {
  const mod = await import(path.join(__dirname, 'art', 'paint', modName + '.ts'));
  const T = 16;
  const sprites: { name: string; img: Img; foot: [number, number] }[] = [];
  for (const it of items) {
    if (!it.place || (nameRe && !nameRe.test(it.name))) continue;
    if (modName === 'buildings') {
      if (it.kind !== 'building') continue;
      const spec = BUILDING_SIZES[it.name] ?? { w: it.w, h: it.h, tall: 2, roof: '#8a4a2a', wall: '#c9a06a' };
      const img = new Img(it.w * T, (it.h + spec.tall) * T);
      if (!mod.paintBuilding(img, 0, 0, img.w, img.h, it.name, spec, season)) continue;
      sprites.push({ name: it.name, img, foot: [it.w, it.h] });
      continue;
    }
    if (!kinds.has(it.kind)) continue;
    const p = mod.painters[it.kind];
    if (!p) { console.log(`(no painter for kind ${it.kind})`); continue; }
    const ctx = (extra: object = {}) => ({ name: it.name, kind: it.kind, base: baseColor(it.name, it.kind), acc: accentColor(it.name), rng: new Rng(it.id + 'world'), mode: 'world' as const, season, tw: it.w, th: it.h, ...extra });
    if (it.kind === 'tree' || it.kind === 'fruittree') {
      const img = new Img(3 * T, ((it.tall ?? 4) + 1) * T);
      p(img, 0, 0, img.w, img.h, ctx());
      sprites.push({ name: it.name, img, foot: [1, 1] });
    } else if (it.kind === 'fence') {
      const rise = mod.rise.fence ?? 10;
      for (const m of [0, 10, 5, 15, 6]) { const img = new Img(T, T + rise); p(img, 0, 0, T, T + rise, ctx({ mask: m })); sprites.push({ name: `${it.name} mask ${m}`, img, foot: [1, 1] }); }
    } else if (it.place === 'ground' && it.cat !== 'furniture') {
      // 3x3 patch of the tile with its 4 variants
      const img = new Img(3 * T, 3 * T);
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const t = new Img(T, T); p(t, 0, 0, T, T, ctx({ variant: (i + j * 3) % 4 })); img.blit(t, i * T, j * T); }
      sprites.push({ name: it.name + ' (3x3 tiles)', img, foot: [3, 3] });
    } else {
      const rise = it.place === 'wall' || it.kind === 'rug' ? 0 : mod.rise[it.kind] ?? 6;
      const img = new Img(it.w * T, it.h * T + rise);
      p(img, 0, 0, img.w, img.h, ctx());
      sprites.push({ name: it.name, img, foot: [it.w, it.h] });
    }
  }
  if (!sprites.length) { console.log('nothing matched'); return; }
  const cw = Math.max(...sprites.map((s) => s.img.w)) + 8, ch = Math.max(...sprites.map((s) => s.img.h)) + 8;
  const rows = Math.ceil(sprites.length / cols);
  const sheet = new Img(cols * cw * scale, rows * ch * scale);
  for (let y = 0; y < sheet.h; y++) for (let x = 0; x < sheet.w; x++) sheet.px(x, y, hex(bg[(Math.floor(x / (16 * scale)) + Math.floor(y / (16 * scale))) % 2]));
  sprites.forEach((s, i) => {
    const cx = (i % cols) * cw + Math.floor((cw - s.img.w) / 2), cy = Math.floor(i / cols) * ch + (ch - 4 - s.img.h);
    // Blend, so that soft shadows and glows look as they do in the app.
    for (let y = 0; y < s.img.h * scale; y++) for (let x = 0; x < s.img.w * scale; x++) {
      const c = s.img.get(Math.floor(x / scale), Math.floor(y / scale));
      if (c[3]) sheet.px(cx * scale + x, cy * scale + y, c);
    }
    console.log(`${i} (row ${Math.floor(i / cols)}, col ${i % cols}): ${s.name}  ${s.img.w}x${s.img.h}px, footprint ${s.foot.join('x')}`);
  });
  sheet.save(out);
  console.log(`wrote ${out} ${sheet.w}x${sheet.h}`);
})();
