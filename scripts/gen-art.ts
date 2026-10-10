/**
 * Generates all app artwork procedurally (no game assets are used):
 *  - assets/gen/icons-N.png   UI icon pages (24px art upscaled 2x)
 *  - assets/gen/world-N.png   world sprite sheets (1x, 16px per tile)
 *  - assets/gen/maps/*.png    farm & interior terrain per season
 *  - assets/*.png             app icon, adaptive icon, splash, favicon
 *  - src/data/generated/{sprites.json,maps.json,assets.ts}
 *
 * Run: npm run gen:art  (after gen:data)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fitInto, hex, Img, ramp, Rng } from './art/png';
import { accentColor, baseColor } from './art/palette';
import { Ctx, paintBuilding, PAINTERS, RISE, Season } from './art/painters';
import { CODE_CHARS, MAPS, renderMap } from './art/maps';
import { BUILDING_SIZES } from './supplemental';
import { GLYPHS } from './art/glyphs';

const ROOT = path.join(__dirname, '..');
const GEN = path.join(ROOT, 'assets', 'gen');
const OUTDATA = path.join(ROOT, 'src', 'data', 'generated');
fs.mkdirSync(path.join(GEN, 'maps'), { recursive: true });

type Item = { id: string; name: string; cat: string; sub: string; kind: string; w: number; h: number; place: string | null; tall?: number };
const items: Item[] = JSON.parse(fs.readFileSync(path.join(OUTDATA, 'items.json'), 'utf8'));

const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];
const ICON = 24;
const ICON_SCALE = 2;
const CELL = ICON * ICON_SCALE;
const PAGE_COLS = 21;
const PER_PAGE = PAGE_COLS * PAGE_COLS;

function ctxFor(it: Item, mode: 'icon' | 'world', season: Season = 'spring', extra: Partial<Ctx> = {}): Ctx {
  return {
    name: it.name, kind: it.kind, base: baseColor(it.name, it.kind), acc: accentColor(it.name), rng: new Rng(it.id + mode + (extra.mask ?? '') + (extra.variant ?? '')),
    mode, season, tw: it.w, th: it.h, ...extra,
  };
}

function paint(img: Img, it: Item, x: number, y: number, w: number, h: number, c: Ctx) {
  if (it.kind === 'building') {
    const spec = BUILDING_SIZES[it.name] ?? { w: it.w, h: it.h, tall: 2, roof: '#8a4a2a', wall: '#c9a06a' };
    paintBuilding(img, x, y, w, h, it.name, spec, c.rng, c.season);
    return;
  }
  const p = PAINTERS[it.kind] ?? PAINTERS.misc;
  p(img, x, y, w, h, c);
}

// ------------------------------------------------------------------ icons
function iconFor(it: Item): Img {
  const img = new Img(ICON, ICON);
  const c = ctxFor(it, 'icon', 'summer');
  if (it.place && it.kind !== 'tree' && it.kind !== 'fruittree' && (it.w > 1 || it.h > 1 || it.kind === 'building')) {
    // Keep the footprint's aspect ratio inside the icon.
    const tall = it.kind === 'building' ? (it.tall ?? 2) : (RISE[it.kind] ?? 0) / 16;
    const aw = it.w, ah = it.h + tall;
    const s = Math.min((ICON - 2) / aw, (ICON - 2) / ah);
    const w = Math.max(6, Math.round(aw * s)), h = Math.max(6, Math.round(ah * s));
    paint(img, it, Math.floor((ICON - w) / 2), Math.floor((ICON - h) / 2), w, h, c);
  } else if (it.kind === 'tree' || it.kind === 'fruittree') {
    paint(img, it, 1, 0, ICON - 2, ICON, c);
  } else if (it.kind === 'floor' || it.kind === 'path' || ['tilled', 'watered', 'grassplant', 'bluegrass'].includes(it.kind)) {
    const tile = new Img(16, 16);
    paint(tile, it, 0, 0, 16, 16, c);
    // 2x2 tile swatch with a frame
    const sw = new Img(ICON, ICON);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) sw.blit(fitInto(tile, 10, 10), 2 + i * 10, 2 + j * 10);
    sw.outline(hex('#2a1a1e'));
    return sw;
  } else {
    paint(img, it, 2, 2, ICON - 4, ICON - 4, c);
  }
  return img;
}

const iconIndex: Record<string, [number, number, number]> = {};
const pages: Img[] = [];
items.forEach((it, i) => {
  const page = Math.floor(i / PER_PAGE), k = i % PER_PAGE;
  if (!pages[page]) pages[page] = new Img(PAGE_COLS * CELL, PAGE_COLS * CELL);
  const col = k % PAGE_COLS, row = Math.floor(k / PAGE_COLS);
  pages[page].blitScaled(iconFor(it), col * CELL, row * CELL, ICON_SCALE);
  iconIndex[it.id] = [page, col, row];
});
pages.forEach((p, i) => p.saveQuantized(path.join(GEN, `icons-${i}.png`)));
console.log(`icons: ${items.length} in ${pages.length} pages`);

// ------------------------------------------------------------------ world sprites
type Sprite = { key: string; img: Img; ox: number; oy: number };
const sprites: Sprite[] = [];
const T = 16;

for (const it of items) {
  if (!it.place) continue;
  if (it.kind === 'building') {
    const spec = BUILDING_SIZES[it.name] ?? { w: it.w, h: it.h, tall: 2, roof: '#8a4a2a', wall: '#c9a06a' };
    for (const season of ['spring', 'winter'] as Season[]) {
      const W = it.w * T, H = (it.h + spec.tall) * T;
      const img = new Img(W, H);
      paintBuilding(img, 0, 0, W, H, it.name, spec, new Rng(it.id), season);
      sprites.push({ key: `${it.id}@${season}`, img, ox: 0, oy: -spec.tall * T });
    }
    continue;
  }
  if (it.kind === 'tree' || it.kind === 'fruittree') {
    const tall = it.tall ?? 4;
    for (const season of SEASONS) {
      const W = 3 * T, H = (tall + 1) * T;
      const img = new Img(W, H);
      paint(img, it, 0, 0, W, H, ctxFor(it, 'world', season));
      sprites.push({ key: `${it.id}@${season}`, img, ox: -T, oy: -(H - T) });
    }
    continue;
  }
  if (it.kind === 'fence') {
    for (let m = 0; m < 16; m++) {
      const rise = RISE.fence;
      const img = new Img(T, T + rise);
      paint(img, it, 0, 0, T, T + rise, ctxFor(it, 'world', 'spring', { mask: m }));
      sprites.push({ key: `${it.id}#${m}`, img, ox: 0, oy: -rise });
    }
    continue;
  }
  if (it.place === 'ground' && it.cat !== 'furniture') {
    const seasons: Season[] = it.kind === 'grassplant' || it.kind === 'bluegrass' ? SEASONS : ['spring'];
    for (const season of seasons) for (let v = 0; v < 4; v++) {
      const img = new Img(T, T);
      paint(img, it, 0, 0, T, T, ctxFor(it, 'world', season, { variant: v }));
      sprites.push({ key: `${it.id}${seasons.length > 1 ? '@' + season : ''}#${v}`, img, ox: 0, oy: 0 });
    }
    continue;
  }
  const rise = it.place === 'wall' || it.kind === 'rug' ? 0 : RISE[it.kind] ?? 6;
  const W = it.w * T, H = it.h * T + rise;
  const img = new Img(W, H);
  paint(img, it, 0, 0, W, H, ctxFor(it, 'world'));
  sprites.push({ key: it.id, img, ox: 0, oy: -rise });
}

// Shelf-pack sprites into 2048-wide sheets.
const SHEET = 2048;
sprites.sort((a, b) => b.img.h - a.img.h || b.img.w - a.img.w);
const world: Record<string, [number, number, number, number, number, number, number]> = {};
const sheets: Img[] = [];
let sheet = 0, cx = 0, cy = 0, rowH = 0;
const layout: { s: Sprite; sheet: number; x: number; y: number }[] = [];
for (const s of sprites) {
  const w = s.img.w + 2, h = s.img.h + 2;
  if (cx + w > SHEET) { cx = 0; cy += rowH; rowH = 0; }
  if (cy + h > SHEET) { sheet++; cx = 0; cy = 0; rowH = 0; }
  layout.push({ s, sheet, x: cx + 1, y: cy + 1 });
  cx += w; rowH = Math.max(rowH, h);
}
const usedH: number[] = [];
for (const l of layout) usedH[l.sheet] = Math.max(usedH[l.sheet] ?? 0, l.y + l.s.img.h + 1);
for (const l of layout) {
  if (!sheets[l.sheet]) sheets[l.sheet] = new Img(SHEET, Math.min(SHEET, nextPow2(usedH[l.sheet])));
  sheets[l.sheet].blit(l.s.img, l.x, l.y);
  world[l.s.key] = [l.sheet, l.x, l.y, l.s.img.w, l.s.img.h, l.s.ox, l.s.oy];
}
sheets.forEach((s, i) => s.saveQuantized(path.join(GEN, `world-${i}.png`)));
console.log(`world sprites: ${sprites.length} in ${sheets.length} sheets`);

function nextPow2(n: number) { let p = 64; while (p < n) p *= 2; return p; }

// ------------------------------------------------------------------ maps
const mapsOut: any[] = [];
for (const make of MAPS) {
  const def = make();
  const seasons = def.kind === 'farm' ? SEASONS : (['spring'] as Season[]);
  for (const season of seasons) renderMap(def, season).saveQuantized(path.join(GEN, 'maps', `${def.id}-${season}.png`));
  // Small preview thumbnail (4px per tile -> quarter-size).
  const full = renderMap(def, 'spring');
  fitInto(full, def.w * 4, def.h * 4).saveQuantized(path.join(GEN, 'maps', `${def.id}-thumb.png`));
  mapsOut.push({
    id: def.id, name: def.name, kind: def.kind, w: def.w, h: def.h, blurb: def.blurb,
    grid: Array.from(def.grid, (c) => CODE_CHARS[c]).join(''),
    defaults: def.defaults,
    seasons,
  });
  console.log(`map ${def.id} ${def.w}x${def.h}`);
}

// ------------------------------------------------------------------ app icon & splash (original art)
function appArt(size: number, withBg: boolean) {
  const base = 64;
  const img = new Img(base, base);
  if (withBg) {
    for (let y = 0; y < base; y++) img.hline(0, y, base, y < 40 ? (y % 6 < 3 ? hex('#8fd0f4') : hex('#9ad6f6')) : hex('#5aae3c'));
    img.ellipse(50, 13, 6, 6, hex('#f8e070'));
    img.ellipse(50, 13, 4, 4, hex('#fff4b0'));
    img.ellipse(14, 12, 7, 3, hex('#f4fbff'));
    img.ellipse(20, 10, 5, 3, hex('#f4fbff'));
    img.ellipse(32, 44, 40, 8, hex('#6abf44'));
    for (let i = 0; i < 64; i += 3) img.px(i, 50 + ((i * 7) % 5), hex('#4a9a34'));
  }
  // farmhouse
  paintBuilding(img, 14, 18, 30, 26, 'Farmhouse', { w: 9, h: 3, tall: 4, roof: '#c0402e', wall: '#e0b070' }, new Rng(1), 'spring');
  // crops in front
  for (let i = 0; i < 4; i++) {
    const x = 10 + i * 12, y = 50;
    img.rect(x - 4, y + 4, 9, 4, hex('#8a5a34'));
    img.blob(x, y + 2, 3, 2.5, ramp('#4aa83a'));
    img.blob(x, y - 1, 2, 2, ramp(['#f0882a', '#e03a2a', '#f0d03a', '#e86a8a'][i]));
  }
  const out = new Img(size, size);
  out.blitScaled(img, 0, 0, size / base);
  return out;
}
appArt(1024, true).save(path.join(ROOT, 'assets', 'icon.png'));
appArt(1024, false).save(path.join(ROOT, 'assets', 'android-icon-foreground.png'));
{
  const bg = new Img(1024, 1024);
  bg.rect(0, 0, 1024, 1024, hex('#8fd0f4'));
  bg.rect(0, 640, 1024, 384, hex('#5aae3c'));
  bg.save(path.join(ROOT, 'assets', 'android-icon-background.png'));
  const mono = appArt(1024, false);
  for (let i = 0; i < mono.data.length; i += 4) if (mono.data[i + 3]) { mono.data[i] = 255; mono.data[i + 1] = 255; mono.data[i + 2] = 255; }
  mono.save(path.join(ROOT, 'assets', 'android-icon-monochrome.png'));
}
appArt(512, false).save(path.join(ROOT, 'assets', 'splash-icon.png'));
appArt(64, true).save(path.join(ROOT, 'assets', 'favicon.png'));

// ------------------------------------------------------------------ UI glyphs & textures
const GLYPH_NAMES = Object.keys(GLYPHS);
const GS = 12, GSCALE = 4;
{
  const sheet = new Img(GLYPH_NAMES.length * GS * GSCALE, GS * GSCALE);
  GLYPH_NAMES.forEach((name, gi) => {
    const g = new Img(GS, GS);
    GLYPHS[name].forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '#') g.px(x, y, hex('#2a140a'));
      else if (ch === '+') g.px(x, y, hex('#fff1c8'));
      else if (ch === 'o') g.px(x, y, hex('#e0782a'));
    }));
    sheet.blitScaled(g, gi * GS * GSCALE, 0, GSCALE);
  });
  sheet.saveQuantized(path.join(GEN, 'glyphs.png'));
}
{
  // Wood plank texture for screen backgrounds (64x64 tile, 2x pixels).
  const t = new Img(32, 32);
  const rng = new Rng('wood');
  for (let y = 0; y < 32; y++) {
    const plank = Math.floor(y / 8);
    const base = ramp(['#6b3d22', '#73422a', '#663a20', '#70402a'][plank]);
    for (let x = 0; x < 32; x++) t.px(x, y, y % 8 === 7 ? base[0] : (x + plank * 11) % 32 === 0 ? base[1] : rng.chance(0.025) ? base[1] : rng.chance(0.015) ? base[3] : base[2]);
  }
  const big = new Img(64, 64);
  big.blitScaled(t, 0, 0, 2);
  big.saveQuantized(path.join(GEN, 'wood.png'));
  const gr = new Img(32, 32);
  const g2 = new Rng('grass');
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) gr.px(x, y, g2.chance(0.1) ? hex('#4f9e34') : g2.chance(0.08) ? hex('#7acb4e') : hex('#5cad3a'));
  for (let k = 0; k < 10; k++) { const x = g2.int(30) + 1, y = g2.int(29) + 2; gr.px(x, y, hex('#3a7a24')); gr.px(x, y - 1, hex('#86d05a')); gr.px(x + 1, y - 2, hex('#86d05a')); }
  const gbig = new Img(64, 64);
  gbig.blitScaled(gr, 0, 0, 2);
  gbig.saveQuantized(path.join(GEN, 'grass.png'));
}

// ------------------------------------------------------------------ data outputs
fs.writeFileSync(path.join(OUTDATA, 'sprites.json'), JSON.stringify({ cell: CELL, cols: PAGE_COLS, icons: iconIndex, world }));
fs.writeFileSync(path.join(OUTDATA, 'maps.json'), JSON.stringify(mapsOut));
const rel = (p: string) => '../../../assets/gen/' + p;
const lines = [
  '/* eslint-disable */',
  '// AUTO-GENERATED by scripts/gen-art.ts — do not edit.',
  `export const ICON_PAGES = [${pages.map((_, i) => `require('${rel(`icons-${i}.png`)}')`).join(', ')}];`,
  `export const WORLD_SHEETS = [${sheets.map((_, i) => `require('${rel(`world-${i}.png`)}')`).join(', ')}];`,
  `export const WORLD_SHEET_SIZES: [number, number][] = [${sheets.map((s) => `[${s.w}, ${s.h}]`).join(', ')}];`,
  `export const ICON_PAGE_SIZE = ${PAGE_COLS * CELL};`,
  `export const GLYPH_SHEET = require('${rel('glyphs.png')}');`,
  `export const GLYPH_NAMES = ${JSON.stringify(GLYPH_NAMES)} as const;`,
  `export const GLYPH_CELL = ${GS * GSCALE};`,
  `export const WOOD_TEXTURE = require('${rel('wood.png')}');`,
  `export const GRASS_TEXTURE = require('${rel('grass.png')}');`,
  'export const MAP_IMAGES: Record<string, Record<string, number>> = {',
  ...mapsOut.map((m) => `  '${m.id}': { ${m.seasons.map((s: string) => `${s}: require('${rel(`maps/${m.id}-${s}.png`)}')`).join(', ')}, thumb: require('${rel(`maps/${m.id}-thumb.png`)}') },`),
  '};',
  '',
];
fs.writeFileSync(path.join(OUTDATA, 'assets.ts'), lines.join('\n'));
console.log('done');
