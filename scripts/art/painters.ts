/**
 * Procedural pixel-art painters. Every item kind has one painter that draws into an
 * arbitrary box, so the same code produces 16px UI icons and full-size world sprites.
 * All art here is original; it only evokes a cozy farm-game style.
 */
import { hex, Img, mix, ramp, Ramp, RGBA, Rng, shade } from './png';
import { accentColor, baseColor, hueColor, woodColor } from './palette';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export type Ctx = {
  name: string;
  kind: string;
  base: RGBA;
  acc: RGBA;
  rng: Rng;
  mode: 'icon' | 'world';
  season: Season;
  /** Footprint in tiles (world mode). */
  tw: number;
  th: number;
  /** Fence connection mask (N=1,E=2,S=4,W=8). */
  mask?: number;
  variant?: number;
};

export type Painter = (img: Img, x: number, y: number, w: number, h: number, c: Ctx) => void;

const OUT: RGBA = hex('#2a1a1e');
const SHADOW: RGBA = [20, 12, 16, 70];
const GLASS: RGBA = hex('#a8d8f0');
const FLAME: Ramp = ramp('#f0a02a');

function shadowEllipse(img: Img, x: number, y: number, w: number, h: number) {
  img.ellipse(x + w / 2, y + h - 2, w * 0.45, Math.max(1.5, h * 0.12), SHADOW);
}

function fallbackLeaf(season: Season): Ramp {
  return season === 'fall' ? ramp('#d0782a') : season === 'winter' ? ramp('#5a7a5a') : season === 'summer' ? ramp('#3a9a3a') : ramp('#5ab83a');
}

// ------------------------------------------------------------------ furniture
const chair: Painter = (img, x, y, w, h, c) => {
  const r = ramp(woodColor(c.name));
  const seat = /plush|office|diner|dining|groovy|cute|throne|king/i.test(c.name) ? ramp(c.base) : r;
  const cx = x + Math.floor(w / 2);
  const bw = Math.max(6, Math.floor(w * 0.6));
  const bx = cx - Math.floor(bw / 2);
  shadowEllipse(img, x, y, w, h);
  // back
  img.box(bx, y + Math.floor(h * 0.1), bw, Math.floor(h * 0.45), seat[2], OUT);
  img.hline(bx + 1, y + Math.floor(h * 0.1) + 1, bw - 2, seat[3]);
  // seat
  img.box(bx - 1, y + Math.floor(h * 0.5), bw + 2, Math.max(3, Math.floor(h * 0.2)), seat[3], OUT);
  // legs
  img.rect(bx, y + Math.floor(h * 0.68), 1, Math.floor(h * 0.25), r[0]);
  img.rect(bx + bw - 1, y + Math.floor(h * 0.68), 1, Math.floor(h * 0.25), r[0]);
  if (/throne|king/i.test(c.name)) { img.px(bx, y + Math.floor(h * 0.1) - 1, hex('#e8b830')); img.px(bx + bw - 1, y + Math.floor(h * 0.1) - 1, hex('#e8b830')); }
};

const bench: Painter = (img, x, y, w, h, c) => {
  const r = ramp(woodColor(c.name));
  shadowEllipse(img, x, y, w, h);
  const top = y + Math.floor(h * 0.25);
  img.box(x + 1, top, w - 2, Math.floor(h * 0.25), r[2], OUT);
  img.box(x + 1, top + Math.floor(h * 0.3), w - 2, Math.floor(h * 0.22), r[3], OUT);
  img.rect(x + 2, top + Math.floor(h * 0.5), 2, Math.floor(h * 0.3), r[0]);
  img.rect(x + w - 4, top + Math.floor(h * 0.5), 2, Math.floor(h * 0.3), r[0]);
};

const couch: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  shadowEllipse(img, x, y, w, h);
  const top = y + Math.floor(h * 0.12);
  img.box(x + 1, top, w - 2, Math.floor(h * 0.55), r[2], OUT); // back
  img.box(x, top + Math.floor(h * 0.35), Math.max(3, Math.floor(w * 0.14)), Math.floor(h * 0.5), r[1], OUT); // arm L
  img.box(x + w - Math.max(3, Math.floor(w * 0.14)), top + Math.floor(h * 0.35), Math.max(3, Math.floor(w * 0.14)), Math.floor(h * 0.5), r[1], OUT); // arm R
  const sx = x + Math.max(3, Math.floor(w * 0.14)) - 1, sw = w - 2 * (Math.max(3, Math.floor(w * 0.14)) - 1);
  img.box(sx, top + Math.floor(h * 0.45), sw, Math.floor(h * 0.3), r[3], OUT); // seat
  const n = w > 24 ? 3 : 2;
  for (let i = 1; i < n; i++) img.vline(sx + Math.floor((sw * i) / n), top + Math.floor(h * 0.45) + 1, Math.floor(h * 0.3) - 2, r[1]);
  img.hline(x + 2, top + 1, w - 4, r[3]);
};

const armchair: Painter = (img, x, y, w, h, c) => couch(img, x + Math.floor(w * 0.05), y, Math.ceil(w * 0.9), h, c);

const table: Painter = (img, x, y, w, h, c) => {
  const r = ramp(/sun|moon|puzzle|candy|luau|diviner|neolithic|pub/i.test(c.name) ? c.base : woodColor(c.name));
  shadowEllipse(img, x, y, w, h);
  const topH = Math.max(4, Math.floor(h * 0.45));
  const ty = y + Math.floor(h * 0.15);
  img.box(x, ty, w, topH, r[2], OUT);
  img.hline(x + 1, ty + 1, w - 2, r[3]);
  img.rect(x + 1, ty + topH - 2, w - 2, 1, r[1]);
  img.rect(x + 1, ty + topH, 2, Math.floor(h * 0.35), r[0]);
  img.rect(x + w - 3, ty + topH, 2, Math.floor(h * 0.35), r[0]);
  if (/sun/i.test(c.name)) img.ellipse(x + w / 2, ty + topH / 2, 2.5, 1.6, hex('#f0c02a'));
  if (/moon/i.test(c.name)) img.ellipse(x + w / 2, ty + topH / 2, 2.5, 1.6, hex('#e8e8f8'));
  if (/puzzle/i.test(c.name)) { img.rect(x + 3, ty + 2, 3, 2, hex('#e04a5a')); img.rect(x + 6, ty + 2, 3, 2, hex('#4a8ae0')); }
  if (/luxury|pub|diviner/i.test(c.name) && w > 12) img.rect(x + Math.floor(w / 2) - 2, ty + 1, 4, topH - 3, shade(c.acc, -0.1));
};

const teatable: Painter = (img, x, y, w, h, c) => table(img, x, y + Math.floor(h * 0.2), w, Math.ceil(h * 0.8), c);

const endtable: Painter = (img, x, y, w, h, c) => {
  const r = ramp(woodColor(c.name));
  shadowEllipse(img, x, y, w, h);
  const bx = x + Math.floor(w * 0.18), bw = Math.ceil(w * 0.64);
  img.box(bx, y + Math.floor(h * 0.42), bw, Math.floor(h * 0.5), r[2], OUT);
  img.hline(bx + 1, y + Math.floor(h * 0.42) + 1, bw - 2, r[3]);
  img.hline(bx + 2, y + Math.floor(h * 0.68), bw - 4, r[1]);
  if (/lamp/i.test(c.name)) lampShade(img, bx + Math.floor(bw / 2), y + Math.floor(h * 0.08), Math.max(5, Math.floor(w * 0.45)), Math.floor(h * 0.3), c);
  else if (w >= 12) { img.ellipse(bx + bw / 2, y + h * 0.36, 2, 2, hex('#e86a8a')); img.px(bx + bw / 2, y + h * 0.4, hex('#3a8a3a')); }
};

function lampShade(img: Img, cx: number, y: number, sw: number, sh: number, c: Ctx) {
  const lr = ramp(/modern|box/i.test(c.name) ? '#f0e8d0' : /candle/i.test(c.name) ? '#f0d8a0' : /ornate|classic/i.test(c.name) ? '#e8b0a0' : '#f0d890');
  for (let j = 0; j < sh; j++) {
    const ww = Math.round(sw * (0.6 + 0.4 * (j / Math.max(1, sh - 1))));
    img.hline(cx - Math.floor(ww / 2), y + j, ww, j === 0 ? lr[4] : lr[2]);
    img.px(cx - Math.floor(ww / 2) - 1, y + j, OUT);
    img.px(cx - Math.floor(ww / 2) + ww, y + j, OUT);
  }
  img.hline(cx - Math.floor((sw * 0.6) / 2), y - 1, Math.round(sw * 0.6), OUT);
  img.hline(cx - Math.floor(sw / 2), y + sh, sw, OUT);
  // glow
  img.ellipse(cx, y + sh / 2, sw * 0.9, sh * 0.9, [255, 230, 150, 40]);
}

const lamp: Painter = (img, x, y, w, h, c) => {
  shadowEllipse(img, x, y, w, h);
  const cx = x + Math.floor(w / 2);
  if (/torch/i.test(c.name)) return torch(img, x, y, w, h, c);
  const pole = /modern/i.test(c.name) ? hex('#5a5a6a') : /country|j\. cola/i.test(c.name) ? hex('#8a5a3a') : hex('#6a4a3a');
  img.rect(cx - 1, y + Math.floor(h * 0.35), 2, Math.floor(h * 0.55), pole);
  img.vline(cx - 2, y + Math.floor(h * 0.35), Math.floor(h * 0.55), OUT);
  img.vline(cx + 1, y + Math.floor(h * 0.35), Math.floor(h * 0.55), OUT);
  img.box(cx - 3, y + h - 4, 6, 3, shade(pole, 0.15), OUT);
  if (/j\. cola/i.test(c.name)) {
    img.box(cx - 3, y + 1, 6, Math.floor(h * 0.35), hex('#3a7ad6'), OUT);
    img.hline(cx - 2, y + 3, 4, hex('#e8e8f0'));
    return;
  }
  lampShade(img, cx, y + Math.floor(h * 0.08), Math.max(7, Math.floor(w * 0.6)), Math.max(4, Math.floor(h * 0.28)), c);
};

const bookcase: Painter = (img, x, y, w, h, c) => {
  const r = ramp(/luxury/i.test(c.name) ? '#8a3a2a' : /modern/i.test(c.name) ? '#8a8a96' : /dark/i.test(c.name) ? '#3a2a30' : /artist/i.test(c.name) ? '#c8a87a' : woodColor(c.name));
  img.box(x + 1, y, w - 2, h - 1, r[1], OUT);
  const shelves = h > 20 ? 4 : 3;
  const sh = Math.floor((h - 3) / shelves);
  for (let s = 0; s < shelves; s++) {
    const sy = y + 1 + s * sh;
    img.hline(x + 2, sy + sh - 1, w - 4, r[3]);
    let bx = x + 3;
    while (bx < x + w - 3) {
      const bw = 1 + c.rng.int(2);
      const bh = Math.max(2, sh - 2 - c.rng.int(2));
      img.rect(bx, sy + sh - 1 - bh, bw, bh, hueColor(c.rng.int(360), 0.5, 0.5));
      bx += bw + (c.rng.chance(0.2) ? 1 : 0);
    }
  }
};

const dresser: Painter = (img, x, y, w, h, c) => {
  const r = ramp(woodColor(c.name));
  shadowEllipse(img, x, y, w, h);
  img.box(x + 1, y + Math.floor(h * 0.2), w - 2, Math.floor(h * 0.72), r[2], OUT);
  img.hline(x + 2, y + Math.floor(h * 0.2) + 1, w - 4, r[3]);
  const rows = 2;
  for (let i = 0; i < rows; i++) {
    const dy = y + Math.floor(h * 0.32) + i * Math.floor(h * 0.27);
    img.rect(x + 3, dy, w - 6, Math.floor(h * 0.22), r[1]);
    img.rect(x + Math.floor(w / 2) - 1, dy + Math.floor(h * 0.08), 2, 1, hex('#e8c86a'));
  }
};

const bed: Painter = (img, x, y, w, h, c) => {
  const frame = ramp(woodColor(c.name));
  const sheet = ramp(/birch|modern/i.test(c.name) ? accentColor(c.name) : c.base);
  shadowEllipse(img, x, y, w, h);
  img.box(x + 1, y, w - 2, Math.floor(h * 0.25), frame[2], OUT); // headboard
  img.hline(x + 2, y + 1, w - 4, frame[3]);
  img.box(x + 1, y + Math.floor(h * 0.2), w - 2, Math.floor(h * 0.75), frame[1], OUT); // frame
  img.rect(x + 2, y + Math.floor(h * 0.22), w - 4, Math.floor(h * 0.72), shade(sheet[2], 0.6)); // mattress
  const pillows = w > 36 ? 2 : 1;
  const pw = Math.floor((w - 6) / pillows) - 1;
  for (let i = 0; i < pillows; i++) img.box(x + 3 + i * (pw + 2), y + Math.floor(h * 0.24), pw, Math.max(3, Math.floor(h * 0.12)), hex('#f4f0e8'), shade(hex('#f4f0e8'), -0.3));
  img.rect(x + 2, y + Math.floor(h * 0.42), w - 4, Math.floor(h * 0.52), sheet[2]); // blanket
  img.hline(x + 2, y + Math.floor(h * 0.42), w - 4, sheet[3]);
  for (let i = x + 4; i < x + w - 4; i += 4) img.vline(i, y + Math.floor(h * 0.48), Math.floor(h * 0.4), sheet[1]);
};

const fireplace: Painter = (img, x, y, w, h, c) => {
  const st = ramp(/brick/i.test(c.name) ? '#b05a3a' : /iridium/i.test(c.name) ? '#9a5ad6' : /elegant/i.test(c.name) ? '#e8e0d0' : /stove/i.test(c.name) ? '#4a4a52' : /monster/i.test(c.name) ? '#5a4a6a' : '#8a8a90');
  img.box(x, y + Math.floor(h * 0.05), w, Math.floor(h * 0.9), st[2], OUT);
  img.hline(x + 1, y + Math.floor(h * 0.05) + 1, w - 2, st[3]);
  // stones/bricks
  for (let j = y + 3; j < y + h - 2; j += 3) for (let i = x + 1 + ((j / 3) % 2) * 2; i < x + w - 1; i += 4) img.px(i, j, st[1]);
  const ow = Math.floor(w * 0.5), oh = Math.floor(h * 0.45);
  const ox = x + Math.floor((w - ow) / 2), oy = y + h - oh - 2;
  img.box(ox, oy, ow, oh, hex('#1a1014'), OUT);
  img.ellipse(ox + ow / 2, oy + oh - 2, ow * 0.3, oh * 0.4, FLAME[2]);
  img.ellipse(ox + ow / 2, oy + oh - 1.5, ow * 0.15, oh * 0.25, FLAME[4]);
  if (/monster/i.test(c.name)) { img.px(x + 3, y + 3, hex('#e83a3a')); img.px(x + w - 4, y + 3, hex('#e83a3a')); }
};

const fishtank: Painter = (img, x, y, w, h, c) => {
  const fr = ramp(/aquatic/i.test(c.name) ? '#8a5a3a' : '#6a6a7a');
  img.box(x, y + Math.floor(h * 0.15), w, Math.floor(h * 0.6), hex('#4aa8d8'), OUT);
  img.rect(x + 1, y + Math.floor(h * 0.15) + 1, w - 2, 2, hex('#8ad0f0'));
  img.rect(x + 1, y + Math.floor(h * 0.15) + Math.floor(h * 0.6) - 3, w - 2, 2, hex('#e8d090'));
  for (let i = 0; i < Math.max(1, Math.floor(w / 8)); i++) {
    const fx = x + 3 + c.rng.int(Math.max(1, w - 7)), fy = y + Math.floor(h * 0.3) + c.rng.int(Math.max(1, Math.floor(h * 0.25)));
    const fc = hueColor(c.rng.int(360), 0.7, 0.6);
    img.rect(fx, fy, 3, 1, fc); img.px(fx - 1, fy, shade(fc, -0.3));
  }
  img.vline(x + 3, y + Math.floor(h * 0.4), Math.floor(h * 0.3), hex('#3a9a3a'));
  img.box(x + 1, y + Math.floor(h * 0.75), w - 2, Math.ceil(h * 0.22), fr[2], OUT);
};

const tv: Painter = (img, x, y, w, h, c) => {
  const body = ramp(/tropical/i.test(c.name) ? '#3ab89a' : /budget/i.test(c.name) ? '#8a5a3a' : '#3a3a46');
  shadowEllipse(img, x, y, w, h);
  img.box(x + 1, y + Math.floor(h * 0.1), w - 2, Math.floor(h * 0.62), body[2], OUT);
  img.rect(x + 3, y + Math.floor(h * 0.1) + 2, w - 6, Math.floor(h * 0.62) - 4, hex('#3a5a7a'));
  img.rect(x + 4, y + Math.floor(h * 0.1) + 3, Math.floor(w * 0.3), 1, hex('#8ab8d8'));
  img.box(x + Math.floor(w * 0.25), y + Math.floor(h * 0.72), Math.ceil(w * 0.5), Math.floor(h * 0.22), body[1], OUT);
};

const houseplant: Painter = (img, x, y, w, h, c) => {
  shadowEllipse(img, x, y, w, h);
  const pot = ramp(/winter star/i.test(c.name) ? '#c83a3a' : /bonsai/i.test(c.name) ? '#5a5a6a' : '#c8683a');
  const pw = Math.max(5, Math.floor(w * 0.5)), ph = Math.max(3, Math.floor(h * 0.25));
  const px = x + Math.floor((w - pw) / 2), py = y + h - ph - 1;
  img.box(px, py, pw, ph, pot[2], OUT);
  img.hline(px + 1, py + 1, pw - 2, pot[3]);
  const leaf = ramp(/palm|tropical/i.test(c.name) ? '#3a9a5a' : /winter star/i.test(c.name) ? '#2a6a3a' : '#4a9a3a');
  const cx = x + w / 2;
  if (/palm/i.test(c.name)) {
    img.vline(Math.floor(cx), y + Math.floor(h * 0.3), Math.floor(h * 0.45), hex('#8a6a3a'));
    for (const dx of [-1, 1]) for (let i = 0; i < Math.floor(w * 0.4); i++) img.px(cx + dx * i, y + Math.floor(h * 0.3) + Math.floor(i * i * 0.08), leaf[2 + (i % 2)]);
  } else if (/winter star|tree|column/i.test(c.name)) {
    for (let j = 0; j < Math.floor(h * 0.7); j++) {
      const ww = Math.max(1, Math.floor((j / (h * 0.7)) * w * 0.8));
      img.hline(Math.floor(cx - ww / 2), y + 1 + j, ww, leaf[j % 3 === 0 ? 3 : 2]);
    }
    if (/winter star/i.test(c.name)) {
      img.px(cx, y, hex('#f0d02a'));
      for (let i = 0; i < 5; i++) img.px(cx - w * 0.25 + c.rng.int(Math.floor(w * 0.5)), y + 3 + c.rng.int(Math.floor(h * 0.5)), hueColor(c.rng.int(360), 0.8, 0.6));
    }
  } else {
    img.blob(cx, y + h * 0.42, w * 0.32, h * 0.3, leaf);
    img.blob(cx - w * 0.18, y + h * 0.52, w * 0.2, h * 0.2, leaf);
    img.blob(cx + w * 0.18, y + h * 0.52, w * 0.2, h * 0.2, leaf);
  }
};

const rug: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base), a = ramp(c.acc);
  if (/circular/i.test(c.name)) {
    img.ellipse(x + w / 2, y + h / 2, w / 2 - 0.5, h / 2 - 0.5, OUT);
    img.ellipse(x + w / 2, y + h / 2, w / 2 - 1.5, h / 2 - 1.5, r[2]);
    img.ellipse(x + w / 2, y + h / 2, w / 3, h / 3, a[2]);
    img.ellipse(x + w / 2, y + h / 2, w / 6, h / 6, r[3]);
    return;
  }
  img.box(x, y, w, h, r[2], OUT);
  img.rect(x + 2, y + 2, w - 4, h - 4, r[1]);
  img.rect(x + 3, y + 3, w - 6, h - 6, r[2]);
  if (w > 10 && h > 8) {
    // central medallion / pattern
    if (/starry|moon|mystic/i.test(c.name)) for (let i = 0; i < (w * h) / 40; i++) img.px(x + 3 + c.rng.int(w - 6), y + 3 + c.rng.int(h - 6), hex('#f0e8a0'));
    else if (/nautical|oceanic/i.test(c.name)) for (let j = y + 4; j < y + h - 4; j += 3) for (let i = x + 4; i < x + w - 4; i++) img.px(i, j + Math.round(Math.sin(i / 2)), a[3]);
    else if (/fruit|blossom|funky|swirl|monster/i.test(c.name)) for (let i = 0; i < (w * h) / 60; i++) img.blob(x + 5 + c.rng.int(w - 10), y + 5 + c.rng.int(h - 10), 2, 2, ramp(hueColor(c.rng.int(360), 0.7, 0.6)));
    else if (/bamboo|burlap/i.test(c.name)) for (let i = x + 2; i < x + w - 2; i += 2) img.vline(i, y + 2, h - 4, r[1]);
    else {
      img.box(x + Math.floor(w * 0.3), y + Math.floor(h * 0.3), Math.ceil(w * 0.4), Math.ceil(h * 0.4), a[2], a[1]);
      img.rect(x + Math.floor(w * 0.45), y + Math.floor(h * 0.45), Math.max(1, Math.ceil(w * 0.1)), Math.max(1, Math.ceil(h * 0.1)), r[3]);
    }
  }
  for (let i = x + 1; i < x + w - 1; i += 2) { img.px(i, y - 1, r[3]); img.px(i, y + h, r[3]); } // fringe
};

const painting: Painter = (img, x, y, w, h, c) => {
  const fr = ramp(/luxury|ornate|gold/i.test(c.name) ? '#c8a02a' : '#8a5a32');
  img.box(x, y, w, h, fr[2], OUT);
  img.hline(x + 1, y + 1, w - 2, fr[3]);
  const ix = x + 2, iy = y + 2, iw = w - 4, ih = h - 4;
  const sky = mix(accentColor(c.name), hex('#a8d0f0'), 0.5);
  img.rect(ix, iy, iw, ih, sky);
  const ground = ramp(c.base);
  // little landscape / abstract
  const style = c.rng.int(4);
  if (style === 0) {
    for (let i = 0; i < iw; i++) { const hh = Math.floor(ih * 0.4 + Math.sin(i / 3 + c.rng.next()) * ih * 0.12); img.vline(ix + i, iy + ih - hh, hh, ground[2]); }
    img.ellipse(ix + iw * 0.75, iy + ih * 0.25, Math.max(1, iw * 0.1), Math.max(1, iw * 0.1), hex('#f0e070'));
  } else if (style === 1) {
    img.ellipse(ix + iw / 2, iy + ih / 2, iw * 0.3, ih * 0.3, ground[2]);
    img.ellipse(ix + iw / 2 - 1, iy + ih / 2 - 1, iw * 0.12, ih * 0.12, ground[4]);
  } else if (style === 2) {
    for (let i = 0; i < 4; i++) img.rect(ix + c.rng.int(Math.max(1, iw - 3)), iy + c.rng.int(Math.max(1, ih - 3)), 1 + c.rng.int(3), 1 + c.rng.int(3), hueColor(c.rng.int(360), 0.7, 0.55));
  } else {
    img.rect(ix, iy + Math.floor(ih * 0.6), iw, Math.ceil(ih * 0.4), ground[1]);
    img.vline(ix + Math.floor(iw / 2), iy + Math.floor(ih * 0.25), Math.floor(ih * 0.4), hex('#6a4a2a'));
    img.ellipse(ix + iw / 2, iy + ih * 0.3, iw * 0.2, ih * 0.18, hex('#4a9a3a'));
  }
};

const walldecor: Painter = (img, x, y, w, h, c) => {
  if (/window/i.test(c.name)) {
    const fr = ramp(/ornate/i.test(c.name) ? '#c8a02a' : '#e8e0d0');
    img.box(x + 1, y + 1, w - 2, h - 2, GLASS, OUT);
    img.rect(x + 2, y + 2, w - 4, Math.max(1, Math.floor((h - 4) / 2) - 1), hex('#c8e8f8'));
    img.vline(x + Math.floor(w / 2), y + 1, h - 2, fr[2]);
    img.hline(x + 1, y + Math.floor(h / 2), w - 2, fr[2]);
    img.hline(x, y + h - 2, w, fr[1]);
    return;
  }
  if (/sword/i.test(c.name)) return sword(img, x, y, w, h, c);
  if (/cactus/i.test(c.name)) { img.box(x + Math.floor(w * 0.35), y + 2, Math.ceil(w * 0.3), h - 4, hex('#4a9a4a'), OUT); return; }
  if (/palm/i.test(c.name)) { houseplant(img, x, y, w, h, c); return; }
  if (/plush/i.test(c.name)) { img.blob(x + w / 2, y + h * 0.55, w * 0.32, h * 0.32, ramp('#6ab84a')); img.outline(OUT, x, y, w, h); return; }
  // banners & decals
  const r = ramp(c.base);
  img.box(x + 1, y, w - 2, h - 2, r[2], OUT);
  for (let i = x + 1; i < x + w - 1; i += 2) img.px(i, y + h - 2, r[1]);
  img.ellipse(x + w / 2, y + h * 0.45, w * 0.22, h * 0.2, ramp(c.acc)[3]);
};

const decor: Painter = (img, x, y, w, h, c) => {
  const n = c.name;
  shadowEllipse(img, x, y, w, h);
  if (/globe/i.test(n)) {
    img.box(x + Math.floor(w / 2) - 2, y + h - 4, 4, 3, hex('#8a5a3a'), OUT);
    img.blob(x + w / 2, y + h * 0.45, w * 0.32, w * 0.32, ramp('#3a8ad8'));
    img.rect(x + w * 0.35, y + h * 0.35, 2, 2, hex('#4aa84a'));
    img.outline(OUT, x, y, w, h);
    return;
  }
  if (/pillar|pipe/i.test(n)) {
    const r = ramp(c.base);
    img.box(x + Math.floor(w * 0.3), y + 1, Math.ceil(w * 0.4), h - 2, r[2], OUT);
    img.vline(x + Math.floor(w * 0.3) + 1, y + 2, h - 4, r[3]);
    img.box(x + Math.floor(w * 0.2), y + 1, Math.ceil(w * 0.6), 2, r[3], OUT);
    img.box(x + Math.floor(w * 0.2), y + h - 3, Math.ceil(w * 0.6), 2, r[1], OUT);
    return;
  }
  if (/hay bale/i.test(n)) { const r = ramp('#e0c070'); img.box(x + 1, y + Math.floor(h * 0.3), w - 2, Math.ceil(h * 0.65), r[2], OUT); img.hline(x + 2, y + Math.floor(h * 0.5), w - 4, r[1]); img.hline(x + 2, y + Math.floor(h * 0.75), w - 4, r[1]); return; }
  if (/doghouse|bird house|cat tree|hutch/i.test(n)) {
    const r = ramp(c.base);
    img.box(x + Math.floor(w * 0.12), y + Math.floor(h * 0.4), Math.ceil(w * 0.76), Math.ceil(h * 0.55), r[2], OUT);
    for (let j = 0; j < Math.floor(h * 0.4); j++) { const ww = Math.round((j / (h * 0.4)) * w); img.hline(x + Math.floor((w - ww) / 2), y + j, ww, ramp('#a83a2a')[j % 3 === 0 ? 3 : 2]); }
    img.ellipse(x + w / 2, y + h * 0.72, w * 0.14, h * 0.14, hex('#1a1014'));
    return;
  }
  if (/clothesline/i.test(n)) {
    img.vline(x + 1, y + 2, h - 3, hex('#6a4a2a')); img.vline(x + w - 2, y + 2, h - 3, hex('#6a4a2a'));
    img.hline(x + 1, y + 3, w - 2, hex('#e8e0d0'));
    for (let i = x + 3; i < x + w - 4; i += 4) img.rect(i, y + 4, 3, 4, hueColor(c.rng.int(360), 0.5, 0.65));
    return;
  }
  if (/coat stand|mannequin/i.test(n)) {
    img.vline(x + Math.floor(w / 2), y + 2, h - 4, hex('#6a4a2a'));
    img.hline(x + Math.floor(w / 2) - 3, y + h - 2, 7, hex('#6a4a2a'));
    if (/mannequin/i.test(n)) { img.box(x + Math.floor(w / 2) - 3, y + Math.floor(h * 0.3), 7, Math.floor(h * 0.4), hex('#e8d0b0'), OUT); img.blob(x + w / 2, y + h * 0.2, 2.5, 2.5, ramp('#e8d0b0')); }
    else { img.px(x + Math.floor(w / 2) - 2, y + 3, hex('#6a4a2a')); img.px(x + Math.floor(w / 2) + 2, y + 3, hex('#6a4a2a')); img.rect(x + Math.floor(w / 2) - 3, y + 4, 3, 5, hex('#5a7ac8')); }
    return;
  }
  if (/fridge/i.test(n)) { img.box(x + Math.floor(w * 0.2), y + 1, Math.ceil(w * 0.6), h - 2, hex('#e8e8f0'), OUT); img.hline(x + Math.floor(w * 0.2) + 1, y + Math.floor(h * 0.4), Math.ceil(w * 0.6) - 2, hex('#a8a8b8')); img.vline(x + Math.floor(w * 0.7), y + 3, 3, hex('#7a7a8a')); return; }
  if (/boombox/i.test(n)) { img.box(x + 1, y + Math.floor(h * 0.35), w - 2, Math.ceil(h * 0.55), hex('#5a5a6a'), OUT); img.ellipse(x + w * 0.3, y + h * 0.62, 2, 2, hex('#2a2a32')); img.ellipse(x + w * 0.7, y + h * 0.62, 2, 2, hex('#2a2a32')); return; }
  if (/skeleton|bone/i.test(n)) {
    const r = ramp('#e8dcc0');
    img.hline(x + 2, y + Math.floor(h * 0.45), w - 4, r[2]);
    for (let i = x + 3; i < x + w - 3; i += 2) img.vline(i, y + Math.floor(h * 0.45), Math.floor(h * 0.25), r[1]);
    img.blob(x + w * 0.2, y + h * 0.38, 3, 2.5, r);
    img.outline(OUT, x, y, w, h);
    return;
  }
  // generic statue/figurine/plush
  statue(img, x, y, w, h, c);
};

const piano: Painter = (img, x, y, w, h, c) => {
  const r = ramp(/dark/i.test(c.name) ? '#2a2026' : '#6a3a2a');
  shadowEllipse(img, x, y, w, h);
  img.box(x + 1, y + Math.floor(h * 0.1), w - 2, Math.floor(h * 0.6), r[2], OUT);
  img.hline(x + 2, y + Math.floor(h * 0.1) + 1, w - 4, r[3]);
  img.rect(x + 2, y + Math.floor(h * 0.55), w - 4, 3, hex('#f4f0e8'));
  for (let i = x + 3; i < x + w - 2; i += 2) img.px(i, y + Math.floor(h * 0.55), hex('#2a2026'));
  img.rect(x + 2, y + Math.floor(h * 0.7), 2, Math.floor(h * 0.25), r[0]);
  img.rect(x + w - 4, y + Math.floor(h * 0.7), 2, Math.floor(h * 0.25), r[0]);
};

const catalogue: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  shadowEllipse(img, x, y, w, h);
  // a lectern with an open book
  img.box(x + Math.floor(w * 0.3), y + Math.floor(h * 0.45), Math.ceil(w * 0.4), Math.ceil(h * 0.5), ramp('#8a5a3a')[2], OUT);
  img.box(x + 1, y + Math.floor(h * 0.15), w - 2, Math.floor(h * 0.35), r[2], OUT);
  img.rect(x + 2, y + Math.floor(h * 0.15) + 1, Math.floor((w - 4) / 2), Math.floor(h * 0.35) - 2, hex('#f4ecd8'));
  img.rect(x + 2 + Math.ceil((w - 4) / 2), y + Math.floor(h * 0.15) + 1, Math.floor((w - 4) / 2), Math.floor(h * 0.35) - 2, hex('#e8dcc0'));
  for (let j = y + Math.floor(h * 0.15) + 2; j < y + Math.floor(h * 0.45); j += 2) { img.hline(x + 3, j, Math.floor(w / 2) - 4, hex('#a89a8a')); }
};

// ------------------------------------------------------------------ farm objects
const chest: Painter = (img, x, y, w, h, c) => {
  const stone = /stone/i.test(c.name);
  const r = ramp(c.base);
  shadowEllipse(img, x, y, w, h);
  if (/shipping bin|grabber/i.test(c.name)) {
    img.box(x + 1, y + Math.floor(h * 0.35), w - 2, Math.ceil(h * 0.6), r[2], OUT);
    img.box(x, y + Math.floor(h * 0.25), w, Math.max(3, Math.floor(h * 0.18)), r[3], OUT);
    if (/grabber/i.test(c.name)) img.ellipse(x + w / 2, y + h * 0.6, 2, 2, hex('#e83a3a'));
    return;
  }
  const big = /big/i.test(c.name);
  const bx = x + (big ? 0 : 1), bw = w - (big ? 0 : 2);
  const top = y + Math.floor(h * (big ? 0.2 : 0.3));
  img.box(bx, top, bw, h - (top - y) - 1, r[2], OUT);
  img.rect(bx + 1, top + 1, bw - 2, Math.floor((h - (top - y)) * 0.35), r[3]);
  img.hline(bx + 1, top + Math.floor((h - (top - y)) * 0.4), bw - 2, r[0]);
  if (!stone) for (let i = bx + 3; i < bx + bw - 2; i += 4) img.vline(i, top + 1, h - (top - y) - 3, r[1]);
  const lock = /junimo/i.test(c.name) ? hex('#f0e070') : hex('#e8c040');
  img.rect(x + Math.floor(w / 2) - 1, top + Math.floor((h - (top - y)) * 0.35), 2, 3, lock);
  img.px(x + Math.floor(w / 2) - 1, top + Math.floor((h - (top - y)) * 0.35) + 3, OUT);
};

const MACHINE_STYLE: [RegExp, (img: Img, x: number, y: number, w: number, h: number, c: Ctx) => void][] = [
  [/keg|cask|barrel/i, (img, x, y, w, h, c) => {
    const r = ramp(c.base);
    img.box(x + Math.floor(w * 0.15), y + Math.floor(h * 0.15), Math.ceil(w * 0.7), Math.ceil(h * 0.8), r[2], OUT);
    img.rect(x + Math.floor(w * 0.15) + 1, y + Math.floor(h * 0.15) + 1, 2, Math.ceil(h * 0.8) - 2, r[3]);
    for (const t of [0.3, 0.75]) img.hline(x + Math.floor(w * 0.15) + 1, y + Math.floor(h * t), Math.ceil(w * 0.7) - 2, hex('#6a6a7a'));
    if (/keg/i.test(c.name)) img.rect(x + Math.floor(w / 2), y + Math.floor(h * 0.55), 2, 2, hex('#c8a02a'));
  }],
  [/jar/i, (img, x, y, w, h) => {
    img.box(x + Math.floor(w * 0.2), y + Math.floor(h * 0.25), Math.ceil(w * 0.6), Math.ceil(h * 0.7), GLASS, OUT);
    img.rect(x + Math.floor(w * 0.2) + 1, y + Math.floor(h * 0.5), Math.ceil(w * 0.6) - 2, Math.ceil(h * 0.44), hex('#d84a6a'));
    img.box(x + Math.floor(w * 0.15), y + Math.floor(h * 0.15), Math.ceil(w * 0.7), 3, hex('#c89a5a'), OUT);
    img.vline(x + Math.floor(w * 0.2) + 1, y + Math.floor(h * 0.3), 3, hex('#f0f8ff'));
  }],
  [/furnace|kiln|forge|smoker|anvil/i, (img, x, y, w, h, c) => {
    const r = ramp(c.base);
    img.box(x + 1, y + Math.floor(h * 0.2), w - 2, Math.ceil(h * 0.75), r[2], OUT);
    for (let j = y + Math.floor(h * 0.2) + 2; j < y + h - 2; j += 3) for (let i = x + 2 + (j % 2) * 2; i < x + w - 2; i += 4) img.px(i, j, r[1]);
    if (!/anvil/i.test(c.name)) {
      img.box(x + Math.floor(w * 0.3), y + Math.floor(h * 0.55), Math.ceil(w * 0.4), Math.ceil(h * 0.3), hex('#1a1014'), OUT);
      img.ellipse(x + w / 2, y + h * 0.75, w * 0.12, h * 0.08, FLAME[3]);
      img.box(x + Math.floor(w * 0.6), y, Math.max(3, Math.floor(w * 0.22)), Math.floor(h * 0.25), r[1], OUT);
    }
  }],
  [/crystalarium/i, (img, x, y, w, h) => {
    img.box(x + 1, y + Math.floor(h * 0.6), w - 2, Math.ceil(h * 0.35), hex('#8a8a96'), OUT);
    img.box(x + Math.floor(w * 0.2), y + Math.floor(h * 0.1), Math.ceil(w * 0.6), Math.ceil(h * 0.52), GLASS, OUT);
    img.rect(x + Math.floor(w * 0.4), y + Math.floor(h * 0.3), 3, 4, hex('#c84ad8'));
  }],
  [/bee house/i, (img, x, y, w, h) => {
    const r = ramp('#d8b070');
    img.box(x + 1, y + Math.floor(h * 0.35), w - 2, Math.ceil(h * 0.6), r[2], OUT);
    for (let j = y + Math.floor(h * 0.45); j < y + h - 2; j += 3) img.hline(x + 2, j, w - 4, r[1]);
    for (let j = 0; j < Math.floor(h * 0.3); j++) { const ww = Math.round((j / (h * 0.3)) * (w + 2)); img.hline(x + Math.floor((w - ww) / 2), y + Math.floor(h * 0.05) + j, ww, ramp('#c8783a')[2]); }
    img.rect(x + Math.floor(w / 2) - 1, y + h - 5, 2, 2, hex('#1a1014'));
  }],
  [/lightning rod/i, (img, x, y, w, h) => {
    img.vline(x + Math.floor(w / 2), y, h - 3, hex('#c8c8d0'));
    img.vline(x + Math.floor(w / 2) + 1, y + 1, h - 4, hex('#7a7a8a'));
    img.box(x + Math.floor(w * 0.25), y + h - 5, Math.ceil(w * 0.5), 4, hex('#5a5a6a'), OUT);
    img.px(x + Math.floor(w / 2) - 1, y + 2, hex('#f0e070'));
  }],
  [/tapper/i, (img, x, y, w, h, c) => {
    const r = ramp(c.base);
    img.box(x + Math.floor(w * 0.25), y + Math.floor(h * 0.3), Math.ceil(w * 0.5), Math.ceil(h * 0.55), r[2], OUT);
    img.hline(x + Math.floor(w * 0.25) + 1, y + Math.floor(h * 0.3) + 1, Math.ceil(w * 0.5) - 2, r[3]);
    img.vline(x + Math.floor(w / 2), y + Math.floor(h * 0.15), Math.floor(h * 0.15), hex('#7a7a8a'));
  }],
  [/solar/i, (img, x, y, w, h) => {
    img.vline(x + Math.floor(w / 2), y + Math.floor(h * 0.5), Math.floor(h * 0.45), hex('#5a5a6a'));
    for (let j = 0; j < Math.floor(h * 0.45); j++) img.hline(x + 1 + Math.floor(j * 0.2), y + Math.floor(h * 0.1) + j, w - 2 - Math.floor(j * 0.4), j % 3 === 0 ? hex('#8ab8f0') : hex('#3a5aa8'));
    img.outline(OUT, x, y, w, h);
  }],
  [/obelisk|statue|perfection|fortune/i, (img, x, y, w, h, c) => statue(img, x, y, w, h, c)],
  [/worm bin|mushroom log/i, (img, x, y, w, h, c) => {
    const r = ramp(c.base);
    img.box(x, y + Math.floor(h * 0.45), w, Math.ceil(h * 0.5), r[2], OUT);
    for (let i = x + 2; i < x + w - 2; i += 3) img.vline(i, y + Math.floor(h * 0.45) + 1, Math.ceil(h * 0.5) - 2, r[1]);
    if (/mushroom/i.test(c.name)) { img.blob(x + w * 0.35, y + h * 0.4, 2.5, 2, ramp('#c84a3a')); img.blob(x + w * 0.65, y + h * 0.38, 2, 1.6, ramp('#e8c8a0')); }
  }],
  [/incubator|egg-press/i, (img, x, y, w, h, c) => {
    const r = ramp(c.base);
    img.box(x + 1, y + Math.floor(h * 0.5), w - 2, Math.ceil(h * 0.45), r[1], OUT);
    img.ellipse(x + w / 2, y + h * 0.45, w * 0.32, h * 0.3, GLASS);
    img.ellipse(x + w / 2, y + h * 0.5, w * 0.15, h * 0.15, r[3]);
    img.outline(OUT, x, y, w, h);
  }],
  [/jukebox|telephone|computer|soda/i, (img, x, y, w, h, c) => {
    const r = ramp(c.base);
    img.box(x + 1, y + Math.floor(h * 0.15), w - 2, Math.ceil(h * 0.8), r[2], OUT);
    img.rect(x + 3, y + Math.floor(h * 0.25), w - 6, Math.floor(h * 0.25), /computer/i.test(c.name) ? hex('#5ad88a') : hex('#e8c86a'));
    img.rect(x + 3, y + Math.floor(h * 0.6), 2, 2, hex('#e83a3a'));
    img.rect(x + 6, y + Math.floor(h * 0.6), 2, 2, hex('#3ad83a'));
  }],
];

const machine: Painter = (img, x, y, w, h, c) => {
  shadowEllipse(img, x, y, w, h);
  for (const [re, fn] of MACHINE_STYLE) if (re.test(c.name)) { fn(img, x, y, w, h, c); return; }
  // Generic: a sturdy box with a hopper and a dial.
  const r = ramp(c.base);
  img.box(x + 1, y + Math.floor(h * 0.25), w - 2, Math.ceil(h * 0.7), r[2], OUT);
  img.hline(x + 2, y + Math.floor(h * 0.25) + 1, w - 4, r[3]);
  img.rect(x + 2, y + h - 4, w - 4, 2, r[1]);
  img.box(x + Math.floor(w * 0.3), y + Math.floor(h * 0.05), Math.ceil(w * 0.4), Math.floor(h * 0.25), r[1], OUT);
  img.ellipse(x + w * 0.5, y + h * 0.55, Math.max(1.5, w * 0.14), Math.max(1.5, w * 0.14), shade(c.acc, 0.2));
  img.px(x + w * 0.5, y + h * 0.55, OUT);
};

const sprinkler: Painter = (img, x, y, w, h, c) => {
  const tier = /iridium/i.test(c.name) ? hex('#9a5ad6') : /quality/i.test(c.name) ? hex('#e8b830') : hex('#a8b0b8');
  const r = ramp(tier);
  const cx = x + w / 2, cy = y + h / 2 + 1;
  img.ellipse(cx, cy + 1, w * 0.36, h * 0.24, SHADOW);
  img.ellipse(cx, cy, w * 0.32, h * 0.22, r[1]);
  img.ellipse(cx, cy - 0.5, w * 0.24, h * 0.15, r[2]);
  img.rect(cx - 1, cy - h * 0.35, 2, h * 0.32, r[3]);
  img.px(cx - 1, cy - h * 0.38, r[4]);
  img.outline(OUT, x, y, w, h);
  img.px(cx - 3, cy - h * 0.35, hex('#8ad0f8'));
  img.px(cx + 3, cy - h * 0.32, hex('#8ad0f8'));
  if (/\(P\)/.test(c.name)) { img.rect(cx - 2, cy - h * 0.42, 4, 2, hex('#e0782a')); img.px(cx - 4, cy - h * 0.2, hex('#8ad0f8')); img.px(cx + 4, cy - h * 0.18, hex('#8ad0f8')); }
};

const scarecrow: Painter = (img, x, y, w, h, c) => {
  const deluxe = /deluxe/i.test(c.name);
  const cx = x + Math.floor(w / 2);
  shadowEllipse(img, x, y, w, h);
  img.vline(cx, y + Math.floor(h * 0.35), Math.floor(h * 0.62), hex('#7a5a32'));
  img.hline(cx - Math.floor(w * 0.38), y + Math.floor(h * 0.45), Math.ceil(w * 0.76), hex('#7a5a32'));
  const shirt = ramp(deluxe ? '#c83a3a' : c.kind === 'rarecrow' ? c.acc : '#5a8ac8');
  img.box(cx - Math.floor(w * 0.22), y + Math.floor(h * 0.4), Math.ceil(w * 0.44), Math.floor(h * 0.3), shirt[2], OUT);
  img.px(cx - Math.floor(w * 0.38), y + Math.floor(h * 0.45) + 1, hex('#e0c070'));
  img.px(cx + Math.floor(w * 0.38) - 1, y + Math.floor(h * 0.45) + 1, hex('#e0c070'));
  img.blob(cx + 0.5, y + h * 0.26, w * 0.18, h * 0.13, ramp(c.kind === 'rarecrow' ? c.base : '#e8c890'));
  img.outline(OUT, cx - Math.floor(w * 0.2), y + Math.floor(h * 0.1), Math.ceil(w * 0.4), Math.floor(h * 0.28));
  img.px(cx - 1, y + Math.floor(h * 0.25), OUT); img.px(cx + 2, y + Math.floor(h * 0.25), OUT);
  // hat
  const hat = ramp(deluxe ? '#3a3440' : '#9a6a3a');
  img.rect(cx - Math.floor(w * 0.28), y + Math.floor(h * 0.13), Math.ceil(w * 0.56), 1, hat[1]);
  img.rect(cx - Math.floor(w * 0.16), y + Math.floor(h * 0.04), Math.ceil(w * 0.32), Math.max(2, Math.floor(h * 0.09)), hat[2]);
  if (deluxe) img.rect(cx - Math.floor(w * 0.16), y + Math.floor(h * 0.1), Math.ceil(w * 0.32), 1, hex('#e8b830'));
};

const light: Painter = (img, x, y, w, h, c) => brazier(img, x, y, w, h, c);

const brazier: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  shadowEllipse(img, x, y, w, h);
  const bw = Math.ceil(w * 0.7), bx = x + Math.floor((w - bw) / 2);
  if (/campfire/i.test(c.name)) {
    img.line(x + 2, y + h - 3, x + w - 3, y + h - 6, hex('#6a4a2a'));
    img.line(x + 2, y + h - 6, x + w - 3, y + h - 3, hex('#7a5a32'));
  } else if (/stump/i.test(c.name)) {
    img.box(bx, y + Math.floor(h * 0.55), bw, Math.ceil(h * 0.4), ramp('#8a5a32')[2], OUT);
    img.ellipse(bx + bw / 2, y + h * 0.57, bw / 2 - 1, 1.5, ramp('#c89a5a')[2]);
  } else {
    img.box(bx, y + Math.floor(h * 0.5), bw, Math.floor(h * 0.25), r[2], OUT);
    img.hline(bx + 1, y + Math.floor(h * 0.5) + 1, bw - 2, r[3]);
    img.box(bx + Math.floor(bw * 0.3), y + Math.floor(h * 0.73), Math.ceil(bw * 0.4), Math.ceil(h * 0.22), r[1], OUT);
  }
  const fy = y + Math.floor(h * 0.48);
  img.ellipse(x + w / 2, fy - h * 0.1, w * 0.22, h * 0.18, FLAME[2]);
  img.ellipse(x + w / 2, fy - h * 0.18, w * 0.12, h * 0.15, FLAME[3]);
  img.ellipse(x + w / 2, fy - h * 0.06, w * 0.08, h * 0.08, FLAME[4]);
  img.ellipse(x + w / 2, fy - h * 0.1, w * 0.6, h * 0.4, [255, 200, 100, 30]);
};

const torch: Painter = (img, x, y, w, h) => {
  const cx = x + Math.floor(w / 2);
  img.rect(cx - 1, y + Math.floor(h * 0.4), 2, Math.ceil(h * 0.55), hex('#8a5a32'));
  img.outline(OUT, cx - 1, y + Math.floor(h * 0.4), 2, Math.ceil(h * 0.55));
  img.ellipse(cx, y + h * 0.3, w * 0.18, h * 0.15, FLAME[2]);
  img.ellipse(cx, y + h * 0.25, w * 0.1, h * 0.1, FLAME[4]);
};

const lamppost: Painter = (img, x, y, w, h, c) => {
  const cx = x + Math.floor(w / 2);
  const pole = /iron/i.test(c.name) ? hex('#4a4a56') : hex('#7a5a32');
  shadowEllipse(img, x, y, w, h);
  img.rect(cx - 1, y + Math.floor(h * 0.25), 2, Math.ceil(h * 0.7), pole);
  img.outline(OUT, cx - 1, y + Math.floor(h * 0.25), 2, Math.ceil(h * 0.7));
  img.box(cx - 3, y + h - 3, 6, 3, shade(pole, 0.2), OUT);
  img.box(cx - 3, y + Math.floor(h * 0.06), 6, Math.max(5, Math.floor(h * 0.2)), hex('#f8e8a0'), OUT);
  img.hline(cx - 4, y + Math.floor(h * 0.06), 8, pole);
  img.ellipse(cx, y + h * 0.15, w * 0.6, h * 0.14, [255, 230, 150, 40]);
};

const jackolantern: Painter = (img, x, y, w, h) => {
  img.blob(x + w / 2, y + h * 0.6, w * 0.4, h * 0.32, ramp('#e0782a'));
  img.outline(OUT, x, y, w, h);
  img.rect(x + w / 2 - 0.5, y + h * 0.22, 2, 3, hex('#4a7a2a'));
  img.px(x + w * 0.35, y + h * 0.55, FLAME[4]); img.px(x + w * 0.65, y + h * 0.55, FLAME[4]);
  img.hline(x + w * 0.35, y + h * 0.72, Math.ceil(w * 0.3), FLAME[4]);
};

const fence: Painter = (img, x, y, w, h, c) => {
  const r = ramp(/iron/i.test(c.name) ? '#7a7a8a' : /stone/i.test(c.name) ? '#9a9aa0' : /hardwood/i.test(c.name) ? '#7a4a2a' : '#b08048');
  const m = c.mask ?? 0b1010;
  const cx = x + Math.floor(w / 2);
  const postTop = y + Math.floor(h * 0.15), postH = Math.ceil(h * 0.75);
  const stone = /stone/i.test(c.name);
  // rails
  const railY = [y + Math.floor(h * 0.35), y + Math.floor(h * 0.6)];
  if (m & 8) for (const ry of railY) img.box(x - 1, ry, cx - x + 1, 3, r[2], OUT);
  if (m & 2) for (const ry of railY) img.box(cx, ry, x + w - cx + 1, 3, r[2], OUT);
  if (m & 1) img.box(cx - 1, y - 6, 4, postTop - y + 8, r[1], OUT);
  if (m & 4) img.box(cx - 1, postTop, 4, h - (postTop - y) + 6, r[1], OUT);
  // post
  if (stone) img.box(cx - 3, postTop - 1, 7, postH, r[2], OUT);
  else img.box(cx - 2, postTop, 5, postH, r[2], OUT);
  img.vline(cx - 1, postTop + 1, postH - 2, r[3]);
  img.hline(cx - 1, postTop + 1, 3, r[4]);
};

const gate: Painter = (img, x, y, w, h, c) => {
  const r = ramp('#b08048');
  const top = y + Math.floor(h * 0.25);
  img.box(x + 1, top, 3, Math.ceil(h * 0.7), r[1], OUT);
  img.box(x + w - 4, top, 3, Math.ceil(h * 0.7), r[1], OUT);
  img.box(x + 3, top + 2, w - 6, Math.ceil(h * 0.5), r[2], OUT);
  for (let i = x + 5; i < x + w - 4; i += 3) img.vline(i, top + 3, Math.ceil(h * 0.5) - 2, r[1]);
  img.line(x + 4, top + 3, x + w - 5, top + Math.ceil(h * 0.5), r[3]);
};

const floor: Painter = (img, x, y, w, h, c) => {
  const n = c.name, rng = c.rng;
  const r = ramp(c.base);
  if (/crystal/i.test(n)) {
    img.rect(x, y, w, h, hex('#8ad0e8'));
    for (let i = 0; i < 5; i++) img.line(x + rng.int(w), y + rng.int(h), x + rng.int(w), y + rng.int(h), hex('#c8f0ff'));
    img.rect(x, y, w, 1, hex('#6ab0d0'));
    return;
  }
  if (/stepping/i.test(n)) {
    for (let i = 0; i < 3; i++) img.blob(x + 3 + rng.int(w - 6), y + 3 + rng.int(h - 6), 2.5 + rng.next(), 2 + rng.next(), ramp('#9a9aa0'));
    img.outline(hex('#5a5a62'), x, y, w, h);
    return;
  }
  if (/gravel/i.test(n)) {
    img.rect(x, y, w, h, hex('#a8a090'));
    for (let i = 0; i < 26; i++) img.px(x + rng.int(w), y + rng.int(h), rng.chance(0.5) ? hex('#8a8272') : hex('#c8c0b0'));
    return;
  }
  if (/cobble/i.test(n)) {
    img.rect(x, y, w, h, hex('#6a6a72'));
    for (let j = 0; j < h; j += 4) for (let i = (j / 4) % 2 ? -2 : 0; i < w; i += 5) img.box(x + i, y + j, 5, 4, hex('#9a9aa2'), hex('#5a5a62'));
    return;
  }
  if (/brick/i.test(n)) {
    img.rect(x, y, w, h, hex('#7a3a2a'));
    for (let j = 0; j < h; j += 4) for (let i = (j / 4) % 2 ? -4 : 0; i < w; i += 8) img.rect(x + i + 1, y + j + 1, 7, 3, j % 8 ? hex('#b85a3a') : hex('#c86a4a'));
    return;
  }
  if (/stone walkway/i.test(n)) {
    img.rect(x, y, w, h, hex('#7a7a80'));
    img.box(x, y, Math.floor(w / 2), Math.floor(h / 2), hex('#a8a8b0'), hex('#6a6a70'));
    img.box(x + Math.floor(w / 2), y, Math.ceil(w / 2), Math.floor(h / 2), hex('#9a9aa2'), hex('#6a6a70'));
    img.box(x, y + Math.floor(h / 2), Math.floor(w / 2), Math.ceil(h / 2), hex('#9a9aa2'), hex('#6a6a70'));
    img.box(x + Math.floor(w / 2), y + Math.floor(h / 2), Math.ceil(w / 2), Math.ceil(h / 2), hex('#a8a8b0'), hex('#6a6a70'));
    return;
  }
  if (/stone/i.test(n)) {
    img.rect(x, y, w, h, hex('#8a8a92'));
    img.box(x, y, w, h, hex('#9a9aa2'), hex('#6a6a72'));
    for (let i = 0; i < 4; i++) img.px(x + 2 + rng.int(w - 4), y + 2 + rng.int(h - 4), hex('#7a7a82'));
    img.hline(x + 1, y + 1, w - 2, hex('#b0b0b8'));
    return;
  }
  if (/straw/i.test(n)) {
    img.rect(x, y, w, h, hex('#d8b860'));
    for (let i = 0; i < 18; i++) { const sx = x + rng.int(w), sy = y + rng.int(h); img.line(sx, sy, sx + 2 - rng.int(5), sy + 1, rng.chance(0.5) ? hex('#b89840') : hex('#f0d880')); }
    return;
  }
  if (/weathered/i.test(n)) {
    img.rect(x, y, w, h, hex('#6a5a4a'));
    for (let j = 0; j < h; j += 4) img.rect(x, y + j, w, 3, j % 8 ? hex('#8a7a6a') : hex('#7a6a5a'));
    for (let i = 0; i < 6; i++) img.px(x + rng.int(w), y + rng.int(h), hex('#4a3a2a'));
    return;
  }
  // wood floor, rustic plank, wood path
  const wood = ramp(/rustic/i.test(n) ? '#9a6a3a' : '#b88a50');
  img.rect(x, y, w, h, wood[1]);
  const planks = /path/i.test(n) ? 3 : 4;
  for (let i = 0; i < planks; i++) {
    const py = y + Math.floor((h * i) / planks), ph = Math.floor(h / planks) - 1;
    img.rect(x, py, w, ph, i % 2 ? wood[2] : wood[3]);
    img.px(x + 1 + rng.int(w - 2), py + Math.floor(ph / 2), wood[0]);
  }
  if (/path/i.test(n)) img.rect(x + 1, y + h - 1, w - 2, 1, wood[0]);
  void r;
};

const ground: Painter = (img, x, y, w, h, c) => {
  const rng = c.rng;
  if (c.kind === 'tilled' || c.kind === 'watered') {
    const r = ramp(c.kind === 'watered' ? '#5a3422' : '#8a5a34');
    img.rect(x, y, w, h, r[2]);
    for (let j = y + 2; j < y + h; j += 4) img.hline(x + 1, j, w - 2, r[1]);
    for (let i = 0; i < 6; i++) img.px(x + rng.int(w), y + rng.int(h), r[3]);
    img.rect(x, y, w, 1, r[3]);
    return;
  }
  // planted grass tufts
  const leaf = ramp(c.kind === 'bluegrass' ? '#3a9ab8' : c.season === 'fall' ? '#c8902a' : c.season === 'winter' ? '#8aa8a0' : '#4aa83a');
  for (let i = 0; i < 5; i++) {
    const gx = x + 2 + rng.int(w - 4), gy = y + 4 + rng.int(h - 5);
    img.vline(gx, gy - 3, 4, leaf[1]);
    img.vline(gx - 1, gy - 2, 3, leaf[2]);
    img.vline(gx + 1, gy - 2, 3, leaf[3]);
  }
};

const sign: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  shadowEllipse(img, x, y, w, h);
  img.rect(x + Math.floor(w / 2) - 1, y + Math.floor(h * 0.5), 2, Math.ceil(h * 0.45), shade(r[1], -0.1));
  img.box(x + 1, y + Math.floor(h * 0.15), w - 2, Math.floor(h * 0.42), r[2], OUT);
  img.hline(x + 2, y + Math.floor(h * 0.15) + 1, w - 4, r[3]);
  img.hline(x + 3, y + Math.floor(h * 0.32), w - 6, r[0]);
};

const block: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  img.box(x + 1, y + Math.floor(h * 0.3), w - 2, Math.ceil(h * 0.65), r[2], OUT);
  img.hline(x + 2, y + Math.floor(h * 0.3) + 1, w - 4, r[3]);
  img.px(x + w / 2, y + h * 0.6, r[4]);
  img.px(x + w / 2 + 2, y + h * 0.5, r[4]);
};

const flowertub: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  img.box(x + 1, y + Math.floor(h * 0.55), w - 2, Math.ceil(h * 0.4), r[2], OUT);
  for (let i = 0; i < 4; i++) img.blob(x + 3 + (i * (w - 6)) / 3, y + h * 0.45 - (i % 2) * 2, 2, 2, ramp(hueColor((i * 90 + 10) % 360, 0.75, 0.6)));
};

const gardenpot: Painter = (img, x, y, w, h) => {
  const r = ramp('#c8683a');
  img.box(x + Math.floor(w * 0.18), y + Math.floor(h * 0.45), Math.ceil(w * 0.64), Math.ceil(h * 0.5), r[2], OUT);
  img.box(x + Math.floor(w * 0.12), y + Math.floor(h * 0.4), Math.ceil(w * 0.76), 3, r[3], OUT);
  img.rect(x + Math.floor(w * 0.2), y + Math.floor(h * 0.4) + 1, Math.ceil(w * 0.6), 1, hex('#5a3422'));
};

const crabpot: Painter = (img, x, y, w, h) => {
  const r = ramp('#a8743e');
  img.box(x + 2, y + Math.floor(h * 0.35), w - 4, Math.ceil(h * 0.5), r[2], OUT);
  for (let i = x + 4; i < x + w - 3; i += 2) img.vline(i, y + Math.floor(h * 0.35) + 1, Math.ceil(h * 0.5) - 2, r[0]);
  img.hline(x + 1, y + Math.floor(h * 0.6), w - 2, [180, 220, 255, 140]);
  img.px(x + w / 2, y + h * 0.25, hex('#e83a3a'));
};

const statue: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  shadowEllipse(img, x, y, w, h);
  const pw = Math.ceil(w * 0.7), px = x + Math.floor((w - pw) / 2);
  img.box(px, y + h - Math.max(4, Math.floor(h * 0.22)) - 1, pw, Math.max(4, Math.floor(h * 0.22)), shade(r[1], -0.05), OUT);
  if (/obelisk/i.test(c.name)) {
    for (let j = 0; j < Math.floor(h * 0.7); j++) { const ww = Math.max(2, Math.round(pw * 0.3 + (j / (h * 0.7)) * pw * 0.4)); img.hline(x + Math.floor((w - ww) / 2), y + 1 + j, ww, r[j % 4 === 0 ? 3 : 2]); }
    img.outline(OUT, x, y, w, h);
    return;
  }
  if (/capsule/i.test(c.name)) { img.blob(x + w / 2, y + h * 0.45, w * 0.3, h * 0.32, ramp('#a8c8d8')); img.outline(OUT, x, y, w, h); img.rect(x + w / 2 - 1, y + h * 0.45, 2, 2, hex('#5ad88a')); return; }
  if (/owl/i.test(c.name)) {
    img.blob(x + w / 2, y + h * 0.48, w * 0.28, h * 0.3, r);
    img.outline(OUT, x, y, w, h);
    img.px(x + w / 2 - 2, y + h * 0.4, hex('#f0d02a')); img.px(x + w / 2 + 2, y + h * 0.4, hex('#f0d02a'));
    return;
  }
  // figure
  img.blob(x + w / 2, y + h * 0.55, w * 0.25, h * 0.22, r);
  img.blob(x + w / 2, y + h * 0.28, w * 0.18, h * 0.14, r);
  img.outline(OUT, x, y, w, h);
  if (/perfection|fortune|gold/i.test(c.name)) img.px(x + w / 2, y + h * 0.1, hex('#fff8c0'));
};

// ------------------------------------------------------------------ crops & trees
const crop: Painter = (img, x, y, w, h, c) => {
  const leaf = ramp(c.season === 'winter' && c.name !== 'Powdermelon' ? '#5a8a5a' : '#4aa83a');
  const prod = ramp(c.base);
  const cx = x + w / 2, by = y + h - 2;
  if (c.mode === 'world') img.ellipse(cx, by, w * 0.35, 1.6, [60, 30, 15, 90]);
  if (/trellis|hops|grape|green bean/i.test(c.name)) {
    img.vline(Math.floor(cx) - 3, y + 1, h - 3, hex('#8a5a32'));
    img.vline(Math.floor(cx) + 3, y + 1, h - 3, hex('#8a5a32'));
    for (let j = y + 3; j < by; j += 4) img.hline(Math.floor(cx) - 3, j, 7, hex('#8a5a32'));
    if (c.name === 'Trellis Marker') return;
    for (let i = 0; i < 8; i++) img.blob(cx - 3 + c.rng.int(7), y + 3 + c.rng.int(h - 7), 1.6, 1.4, leaf);
    for (let i = 0; i < 4; i++) img.blob(cx - 2 + c.rng.int(5), y + 4 + c.rng.int(h - 8), 1.3, 1.3, prod);
    return;
  }
  if (/corn|wheat|sunflower|amaranth|rice|fiber/i.test(c.name)) {
    for (let i = -1; i <= 1; i++) img.vline(Math.floor(cx + i * 3), y + Math.floor(h * 0.25) + Math.abs(i) * 2, h - Math.floor(h * 0.25) - 2, leaf[i === 0 ? 2 : 1]);
    for (let i = -1; i <= 1; i += 2) img.line(cx, y + h * 0.6, cx + i * 4, y + h * 0.45, leaf[3]);
    if (/sunflower/i.test(c.name)) { img.blob(cx, y + h * 0.22, 3.5, 3.5, ramp('#f0c02a')); img.ellipse(cx, y + h * 0.22, 1.5, 1.5, hex('#6a3a1a')); }
    else img.blob(cx, y + h * 0.28, 1.8, 3.2, prod);
    return;
  }
  if (/melon|pumpkin|cabbage|cauliflower|powdermelon|kale|bok choy|broccoli|squash/i.test(c.name)) {
    for (let i = 0; i < 3; i++) img.blob(cx - 4 + i * 4, by - 4, 3, 2.5, leaf);
    img.blob(cx, by - 4, w * 0.27, h * 0.2, prod);
    img.outline(shade(prod[0], 0), x, y, w, h);
    return;
  }
  if (c.kind === 'teabush') {
    img.blob(cx, by - h * 0.3, w * 0.42, h * 0.32, ramp('#3a8a3a'));
    for (let i = 0; i < 5; i++) img.px(cx - 4 + c.rng.int(9), by - h * 0.5 + c.rng.int(Math.floor(h * 0.35)), hex('#8ad05a'));
    img.outline(OUT, x, y, w, h);
    return;
  }
  // leafy plant with fruits/flowers
  img.vline(Math.floor(cx), y + Math.floor(h * 0.4), Math.ceil(h * 0.55), leaf[1]);
  img.blob(cx - 3, y + h * 0.55, 3, 2, leaf);
  img.blob(cx + 3, y + h * 0.5, 3, 2, leaf);
  img.blob(cx, y + h * 0.4, 3, 2.5, leaf);
  const flower = /tulip|jazz|poppy|spangle|rose|flower|sweet pea|crocus/i.test(c.name);
  if (flower) { img.blob(cx, y + h * 0.22, 3, 3, prod); img.px(cx, y + h * 0.22, hex('#f8f0a0')); }
  else for (let i = 0; i < 3; i++) img.blob(cx - 3 + i * 3, y + h * 0.45 + (i % 2) * 2, 1.7, 1.7, prod);
};

const fruittree: Painter = (img, x, y, w, h, c) => tree(img, x, y, w, h, { ...c, kind: 'fruittree' });

const tree: Painter = (img, x, y, w, h, c) => {
  const n = c.name;
  const cx = x + w / 2, by = y + h - 3;
  const isPine = /pine/i.test(n), isPalm = /palm/i.test(n), isMush = /mushroom/i.test(n), isMystic = /mystic/i.test(n), isFiddle = /fiddlehead/i.test(n);
  const trunk = ramp(isPalm ? '#a8844a' : /birch/i.test(n) ? '#e0d8c8' : '#7a5232');
  img.ellipse(cx, by + 1, w * 0.28, Math.max(2, h * 0.04), SHADOW);
  const tw = Math.max(2, Math.round(w * 0.13));
  img.rect(cx - tw / 2, y + h * 0.45, tw, h * 0.55 - 3, trunk[2]);
  img.vline(Math.floor(cx - tw / 2), Math.floor(y + h * 0.45), Math.floor(h * 0.55 - 3), trunk[1]);
  img.outline(OUT, Math.floor(cx - tw / 2), Math.floor(y + h * 0.45), tw, Math.floor(h * 0.55 - 3));
  let leaf = fallbackLeaf(c.season);
  if (/maple/i.test(n)) leaf = c.season === 'fall' ? ramp('#d8482a') : c.season === 'winter' ? ramp('#8a6a5a') : ramp('#5aa83a');
  if (/mahogany/i.test(n)) leaf = c.season === 'winter' ? ramp('#5a6a4a') : ramp('#3a7a3a');
  if (isMystic) leaf = ramp('#8a5ad6');
  if (/green rain/i.test(n)) leaf = ramp(/1/.test(n) ? '#2f8a5a' : /2/.test(n) ? '#3a9a4a' : '#4a8a2a');
  if (isMush) leaf = ramp('#c84a3a');
  if (c.season === 'winter' && c.kind === 'fruittree') leaf = ramp('#7a6a5a');
  if (isPine) {
    const pr = c.season === 'winter' ? ramp('#3a6a5a') : ramp('#2f7a3a');
    for (let k = 0; k < 4; k++) {
      const ty = y + h * (0.05 + k * 0.17), th = h * 0.25, tw2 = w * (0.3 + k * 0.12);
      for (let j = 0; j < th; j++) { const ww = Math.round((j / th) * tw2 * 2); img.hline(Math.floor(cx - ww / 2), Math.floor(ty + j), ww, pr[j < 2 ? 3 : j % 3 === 0 ? 1 : 2]); }
    }
    if (c.season === 'winter') for (let k = 0; k < 4; k++) img.hline(Math.floor(cx - w * (0.1 + k * 0.08)), Math.floor(y + h * (0.06 + k * 0.17) + 2), Math.ceil(w * (0.2 + k * 0.16)), hex('#f0f4f8'));
    img.outline(OUT, x, y, w, h);
    return;
  }
  if (isPalm) {
    for (const [dx, dy] of [[-1, 0.15], [1, 0.12], [-0.7, -0.05], [0.7, -0.08], [0, -0.1]]) {
      for (let i = 0; i < w * 0.42; i++) {
        const px = cx + dx * i, py = y + h * 0.18 + dy * i * 2 + (i * i) * 0.025;
        img.px(px, py, leaf[2]); img.px(px, py + 1, leaf[1]);
      }
    }
    img.blob(cx, y + h * 0.18, 3, 2.5, leaf);
    img.outline(OUT, x, y, w, h);
    return;
  }
  if (isMush) {
    img.blob(cx, y + h * 0.3, w * 0.42, h * 0.2, leaf);
    for (let i = 0; i < 6; i++) img.ellipse(cx - w * 0.3 + c.rng.int(Math.floor(w * 0.6)), y + h * 0.22 + c.rng.int(Math.floor(h * 0.12)), 1.6, 1.4, hex('#f4ecd8'));
    img.outline(OUT, x, y, w, h);
    return;
  }
  if (isFiddle) {
    for (let i = -1; i <= 1; i++) { img.vline(Math.floor(cx + i * 4), y + h * 0.35, h * 0.6, ramp('#4a9a3a')[2]); img.blob(cx + i * 4, y + h * 0.33, 2.5, 2.5, ramp('#5ab84a')); }
    img.outline(OUT, x, y, w, h);
    return;
  }
  // round canopy (wild or fruit)
  const R = w * 0.44;
  const cyy = y + h * 0.33;
  const blobs: [number, number, number][] = [[0, 0, 1], [-0.55, 0.25, 0.7], [0.55, 0.25, 0.7], [-0.3, -0.35, 0.65], [0.3, -0.35, 0.65], [0, 0.4, 0.7]];
  for (const [bx, byy, br] of blobs) img.ellipse(cx + bx * R, cyy + byy * R, R * br * 0.75 + 1, R * br * 0.7 + 1, leaf[0]);
  for (const [bx, byy, br] of blobs) img.ellipse(cx + bx * R, cyy + byy * R, R * br * 0.75, R * br * 0.7, leaf[1]);
  for (const [bx, byy, br] of blobs) img.ellipse(cx + bx * R - 1, cyy + byy * R - 1.5, R * br * 0.58, R * br * 0.52, leaf[2]);
  for (const [bx, byy, br] of blobs.slice(3, 5)) img.ellipse(cx + bx * R - 2, cyy + byy * R - 2, R * br * 0.3, R * br * 0.25, leaf[3]);
  if (c.season === 'winter' && c.kind !== 'fruittree') for (const [bx, byy, br] of blobs.slice(3)) img.ellipse(cx + bx * R - 1, cyy + byy * R - R * br * 0.5, R * br * 0.5, 1.5, hex('#f0f4f8'));
  if (c.kind === 'fruittree') {
    const fruitSeason = !c.season || /apricot|cherry/i.test(n) ? c.season === 'spring' : /orange|peach|banana|mango/i.test(n) ? c.season === 'summer' : c.season === 'fall';
    if (c.mode === 'icon' || fruitSeason) {
      const fr = ramp(baseColor(n.replace(' Tree', ''), 'produce'));
      for (let i = 0; i < 6; i++) img.blob(cx - R * 0.7 + c.rng.int(Math.floor(R * 1.4)), cyy - R * 0.4 + c.rng.int(Math.floor(R * 1.0)), 1.6, 1.6, fr);
    }
    if (c.season === 'spring' && /cherry|apricot|peach|apple/i.test(n)) for (let i = 0; i < 8; i++) img.px(cx - R + c.rng.int(Math.floor(2 * R)), cyy - R * 0.5 + c.rng.int(Math.floor(R)), hex('#f8c8d8'));
  }
};

// ------------------------------------------------------------------ buildings
export type BuildingSpec = { w: number; h: number; tall: number; roof: string; wall: string };

export function paintBuilding(img: Img, x: number, y: number, W: number, H: number, name: string, spec: BuildingSpec, rng: Rng, season: Season) {
  const wall = ramp(spec.wall), roof = ramp(spec.roof);
  const n = name;
  const snowy = season === 'winter';
  const footTop = y + H - spec.h * 16 * (W / (spec.w * 16));
  void footTop;
  const s = W / (spec.w * 16); // scale (1 for world, <1 for icons)
  const T = 16 * s;
  if (/fish pond/i.test(n)) {
    img.ellipse(x + W / 2, y + H / 2, W / 2 - 0.5, H / 2 - 0.5, hex('#7a7a80'));
    img.ellipse(x + W / 2, y + H / 2, W / 2 - 2 * s - 1, H / 2 - 2 * s - 1, hex('#9a9aa2'));
    img.ellipse(x + W / 2, y + H / 2, W / 2 - 4 * s - 1, H / 2 - 4 * s - 1, hex('#3a7ac8'));
    img.ellipse(x + W / 2 - W * 0.12, y + H / 2 - H * 0.12, W * 0.12, H * 0.05, hex('#7ab8f0'));
    img.outline(OUT, x, y, W, H);
    return;
  }
  if (/pet bowl/i.test(n)) {
    img.ellipse(x + W / 2, y + H * 0.6, W * 0.42, H * 0.3, hex('#5a7ab8'));
    img.ellipse(x + W / 2, y + H * 0.55, W * 0.3, H * 0.18, hex('#8ab8e8'));
    img.outline(OUT, x, y, W, H);
    return;
  }
  if (/well/i.test(n)) {
    const by = y + H * 0.45;
    img.box(x + T * 0.3, by, W - T * 0.6, H - (by - y) - 1, hex('#9aa0a6'), OUT);
    for (let j = by + 2; j < y + H - 2; j += 3 * Math.max(1, s)) for (let i = x + T * 0.3 + 2; i < x + W - T * 0.3 - 2; i += 4 * Math.max(1, s)) img.px(i + ((j / 3) % 2) * 2, j, hex('#7a8086'));
    img.ellipse(x + W / 2, by + 1, W / 2 - T * 0.35, Math.max(1.5, T * 0.2), hex('#1a3a5a'));
    img.vline(x + T * 0.4, y + H * 0.1, H * 0.4, hex('#6a4a2a'));
    img.vline(x + W - T * 0.4 - 1, y + H * 0.1, H * 0.4, hex('#6a4a2a'));
    roofTri(img, x + T * 0.1, y, W - T * 0.2, H * 0.22, roof, snowy);
    return;
  }
  if (/silo/i.test(n)) {
    const sx = x + T * 0.4, sw = W - T * 0.8;
    img.box(sx, y + H * 0.22, sw, H * 0.76, wall[2], OUT);
    for (let j = y + H * 0.3; j < y + H - 2; j += T * 0.5) img.hline(sx + 1, j, sw - 2, wall[1]);
    img.vline(sx + 2, y + H * 0.24, H * 0.7, wall[3]);
    img.ellipse(x + W / 2, y + H * 0.22, sw / 2, H * 0.14, roof[1]);
    img.ellipse(x + W / 2 - 1, y + H * 0.2, sw / 2 - 2, H * 0.11, snowy ? hex('#f0f4f8') : roof[2]);
    img.outline(OUT, x, y, W, H);
    return;
  }
  if (/obelisk/i.test(n)) {
    const pw = W * 0.5;
    img.box(x + W * 0.2, y + H - T * 0.6, W * 0.6, T * 0.55, wall[2], OUT);
    for (let j = 0; j < H * 0.78; j++) { const ww = Math.max(2, Math.round(pw * (0.35 + (j / (H * 0.78)) * 0.65))); img.hline(x + Math.floor((W - ww) / 2), y + 1 + j, ww, roof[j < 3 ? 4 : j % 5 === 0 ? 3 : 2]); }
    img.outline(OUT, x, y, W, H);
    img.ellipse(x + W / 2, y + H * 0.3, W * 0.5, H * 0.3, [255, 255, 255, 20]);
    return;
  }
  if (/gold clock/i.test(n)) {
    img.box(x + W * 0.3, y + H * 0.35, W * 0.4, H * 0.6, roof[1], OUT);
    img.blob(x + W / 2, y + H * 0.3, W * 0.28, W * 0.28, roof);
    img.outline(OUT, x, y, W, H);
    img.ellipse(x + W / 2, y + H * 0.3, W * 0.18, W * 0.18, hex('#f8f0d0'));
    img.line(x + W / 2, y + H * 0.3, x + W / 2, y + H * 0.2, OUT);
    img.line(x + W / 2, y + H * 0.3, x + W * 0.58, y + H * 0.3, OUT);
    return;
  }
  if (/shipping bin/i.test(n)) {
    img.box(x, y + H * 0.35, W, H * 0.62, wall[2], OUT);
    img.box(x - 0, y + H * 0.15, W, H * 0.3, roof[2], OUT);
    for (let i = x + 4 * s; i < x + W - 2; i += 6 * s) img.vline(i, y + H * 0.38, H * 0.55, wall[1]);
    return;
  }
  if (/greenhouse/i.test(n)) {
    const wy = y + H * 0.42;
    img.box(x, wy, W, H - (wy - y) - 1, wall[2], OUT);
    for (let i = x + 3; i < x + W - 3; i += Math.max(3, T * 0.5)) img.box(i, wy + 3, Math.max(2, T * 0.4), H * 0.3, hex('#a8e0f0'), OUT);
    roofTri(img, x - 1, y, W + 2, H * 0.45, ramp('#a8e0f0'), snowy);
    for (let i = x + T * 0.5; i < x + W; i += T * 0.75) img.line(i, y + H * 0.44, x + W / 2, y + 2, hex('#e8f8ff'));
    door(img, x + W / 2 - T * 0.5, y + H - T * 1.1, T, T, hex('#6a4a2a'));
    return;
  }
  // Generic barn/coop/shed/house/cabin/hutch/stable/mill/junimo hut
  const roofH = Math.max(4, H * (spec.tall > 2 ? 0.48 : 0.42));
  const wy = y + roofH * 0.82;
  img.box(x + 1, wy, W - 2, H - (wy - y) - 1, wall[2], OUT);
  img.rect(x + 2, wy + 1, W - 4, 2, wall[1]);
  // wall planks / texture
  for (let i = x + 4 * s; i < x + W - 3; i += 5 * Math.max(1, s)) img.vline(i, wy + 3, H - (wy - y) - 5, mix(wall[2], wall[1], 0.5));
  roofTri(img, x - Math.max(1, s), y, W + 2 * Math.max(1, s), roofH, roof, snowy, /barn/i.test(n));
  // doors & windows
  if (/barn/i.test(n)) {
    const dw = T * 2, dh = Math.min(T * 1.8, H - (wy - y) - 2);
    door(img, x + W / 2 - dw / 2, y + H - dh - 1, dw, dh, wall[1], true);
  } else if (/coop/i.test(n)) {
    door(img, x + T * 1.2, y + H - T * 1.2 - 1, T * 0.9, T * 1.2, hex('#6a4a2a'));
    window2(img, x + W - T * 2.2, wy + (H - (wy - y)) * 0.3, T * 0.9, T * 0.8);
  } else if (/shed/i.test(n)) {
    door(img, x + W / 2 - T, y + H - T * 1.4 - 1, T * 2, T * 1.4, wall[1], true);
    window2(img, x + T * 0.8, wy + 4 * s, T * 0.9, T * 0.8);
    window2(img, x + W - T * 1.7, wy + 4 * s, T * 0.9, T * 0.8);
  } else if (/stable/i.test(n)) {
    img.rect(x + T * 0.6, wy + 3, W - T * 1.2, H - (wy - y) - 4, hex('#3a2a20'));
    img.hline(x + T * 0.6, y + H - T * 0.5, W - T * 1.2, wall[3]);
  } else if (/mill/i.test(n)) {
    door(img, x + W / 2 - T * 0.45, y + H - T - 1, T * 0.9, T, hex('#6a4a2a'));
    const hx = x + W / 2, hy = y + roofH * 0.55;
    for (let a = 0; a < 4; a++) { const ang = (a * Math.PI) / 2 + 0.4; img.line(hx, hy, hx + Math.cos(ang) * W * 0.55, hy + Math.sin(ang) * W * 0.55, hex('#e8e0d0')); }
    img.ellipse(hx, hy, 1.5 * Math.max(1, s), 1.5 * Math.max(1, s), OUT);
  } else if (/slime hutch/i.test(n)) {
    for (let i = 0; i < 3; i++) window2(img, x + T * (1 + i * 3.4), wy + 4 * s, T * 1.2, T * 0.9);
    door(img, x + W / 2 - T * 0.5, y + H - T * 1.2 - 1, T, T * 1.2, hex('#3a5a4a'));
  } else if (/junimo hut/i.test(n)) {
    img.ellipse(x + W / 2, y + H - T * 0.5, T * 0.45, T * 0.45, hex('#1a1014'));
    img.px(x + W / 2 - 1, y + H - T * 0.55, hex('#f0e070'));
    img.px(x + W / 2 + 1, y + H - T * 0.55, hex('#f0e070'));
  } else {
    // houses & cabins
    door(img, x + W / 2 - T * 0.5, y + H - T * 1.3 - 1, T, T * 1.3, hex('#6a3a2a'));
    window2(img, x + T * 0.8, wy + (H - (wy - y)) * 0.25, T, T * 0.9);
    window2(img, x + W - T * 1.8, wy + (H - (wy - y)) * 0.25, T, T * 0.9);
    if (/farmhouse/i.test(n) && s >= 1) {
      img.box(x + W * 0.7, y + 2, T * 0.8, roofH * 0.5, hex('#8a5a4a'), OUT);
      window2(img, x + W / 2 - T * 0.5, y + roofH * 0.35, T, T * 0.7);
    }
  }
  void rng;
}

function roofTri(img: Img, x: number, y: number, w: number, h: number, r: Ramp, snowy: boolean, gambrel = false) {
  for (let j = 0; j < h; j++) {
    const t = j / Math.max(1, h - 1);
    const ww = gambrel ? Math.round(w * (t < 0.4 ? 0.55 + t * 1.1 : 1)) : Math.round(w * (0.35 + t * 0.65));
    const col = snowy && j < h * 0.6 ? (j % 4 === 0 ? hex('#d8e4f0') : hex('#f0f4f8')) : j % 4 === 0 ? r[1] : j % 4 === 1 ? r[3] : r[2];
    img.hline(Math.floor(x + (w - ww) / 2), Math.floor(y + j), ww, col);
  }
  img.outline(OUT, Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
  img.hline(Math.floor(x), Math.floor(y + h - 1), Math.ceil(w), r[0]);
}

function door(img: Img, x: number, y: number, w: number, h: number, c: RGBA, double = false) {
  const r = ramp(c);
  img.box(x, y, w, h, r[2], OUT);
  if (double) {
    img.vline(x + w / 2, y + 1, h - 2, r[0]);
    img.line(x + 1, y + 1, x + w / 2 - 1, y + h - 2, r[3]);
    img.line(x + w / 2 + 1, y + 1, x + w - 2, y + h - 2, r[3]);
  } else {
    img.px(x + w - 3, y + h / 2, hex('#e8c040'));
    img.hline(x + 1, y + 1, w - 2, r[3]);
  }
}

function window2(img: Img, x: number, y: number, w: number, h: number) {
  img.box(x, y, w, h, hex('#7ab8e0'), OUT);
  img.rect(x + 1, y + 1, Math.max(1, w / 2 - 1), Math.max(1, h / 2 - 1), hex('#c8e8f8'));
  img.vline(x + w / 2, y + 1, h - 2, hex('#e8e0d0'));
}

// ------------------------------------------------------------------ catalog-only icons
const fish: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  const cx = x + w * 0.45, cy = y + h * 0.5;
  img.ellipse(cx, cy, w * 0.34, h * 0.2, r[2]);
  img.ellipse(cx, cy - h * 0.06, w * 0.28, h * 0.1, r[3]);
  for (let j = -3; j <= 3; j++) img.hline(x + w * 0.75, cy + j, 3 - Math.abs(j) * 0.4 + 1, r[1]);
  img.px(cx - w * 0.22, cy - 1, OUT);
  img.hline(cx - w * 0.05, cy - h * 0.2, w * 0.15, r[1]);
  img.outline(OUT, x, y, w, h);
};

const shellfish: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  if (/crab|lobster|crayfish|shrimp/i.test(c.name)) {
    img.blob(x + w / 2, y + h * 0.55, w * 0.3, h * 0.22, r);
    img.blob(x + w * 0.18, y + h * 0.35, 2, 2, r); img.blob(x + w * 0.82, y + h * 0.35, 2, 2, r);
    for (let i = 0; i < 3; i++) { img.px(x + w * 0.25 - i, y + h * 0.7 + i, r[1]); img.px(x + w * 0.75 + i, y + h * 0.7 + i, r[1]); }
  } else {
    for (let j = 0; j < h * 0.5; j++) { const ww = Math.round(w * 0.7 * Math.sin((j / (h * 0.5)) * Math.PI * 0.9 + 0.2)); img.hline(x + (w - ww) / 2, y + h * 0.25 + j, ww, r[j % 3 === 0 ? 1 : 2]); }
  }
  img.outline(OUT, x, y, w, h);
};

const gem: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  const cx = x + w / 2, cy = y + h / 2;
  const pts = [[0, -0.42], [0.36, -0.12], [0.24, 0.38], [-0.24, 0.38], [-0.36, -0.12]];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const px = (i - w / 2) / w, py = (j - h / 2) / h;
    if (inPoly(px, py, pts)) img.px(x + i, y + j, px + py < -0.1 ? r[3] : px + py < 0.15 ? r[2] : r[1]);
  }
  img.px(cx - 2, cy - 3, r[4]); img.px(cx - 1, cy - 3, r[4]);
  img.outline(OUT, x, y, w, h);
  if (/prismatic/i.test(c.name)) for (let i = 0; i < 4; i++) img.px(cx - 2 + i, cy + i - 1, hueColor(i * 80, 0.9, 0.6));
};

function inPoly(x: number, y: number, pts: number[][]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const bar: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  for (let j = 0; j < h * 0.35; j++) img.hline(x + w * 0.15 + j * 0.4, y + h * 0.35 + j, w * 0.7 - j * 0.8, j < 2 ? r[4] : r[2]);
  img.rect(x + w * 0.15 + h * 0.14, y + h * 0.35 + h * 0.35, w * 0.7 - h * 0.28, h * 0.12, r[1]);
  img.outline(OUT, x, y, w, h);
};

const ore: Painter = (img, x, y, w, h, c) => {
  img.blob(x + w / 2, y + h * 0.55, w * 0.38, h * 0.3, ramp('#7a7a80'));
  for (let i = 0; i < 4; i++) img.rect(x + w * 0.3 + c.rng.int(Math.floor(w * 0.4)), y + h * 0.4 + c.rng.int(Math.floor(h * 0.3)), 2, 2, ramp(c.base)[3]);
  img.outline(OUT, x, y, w, h);
};

const geode: Painter = (img, x, y, w, h, c) => {
  img.blob(x + w / 2, y + h / 2, w * 0.36, h * 0.34, ramp(c.base));
  img.ellipse(x + w * 0.55, y + h * 0.55, w * 0.12, h * 0.12, hueColor(c.rng.int(360), 0.6, 0.6));
  img.outline(OUT, x, y, w, h);
};

const artifact: Painter = (img, x, y, w, h, c) => {
  const n = c.name;
  const r = ramp(c.base);
  if (/bone|skull|fossil|rib|spine|tooth|claw/i.test(n)) { img.blob(x + w / 2, y + h / 2, w * 0.3, h * 0.18, ramp('#e8dcc0')); img.blob(x + w * 0.25, y + h * 0.45, 2.5, 2.5, ramp('#e8dcc0')); img.blob(x + w * 0.75, y + h * 0.55, 2.5, 2.5, ramp('#e8dcc0')); }
  else if (/coin|medal|amulet|ring|crown/i.test(n)) { img.blob(x + w / 2, y + h / 2, w * 0.3, h * 0.3, ramp('#c8a02a')); img.ellipse(x + w / 2, y + h / 2, w * 0.14, h * 0.14, hex('#a8801a')); }
  else if (/doll|figure|statue|idol|totem/i.test(n)) { img.blob(x + w / 2, y + h * 0.6, w * 0.22, h * 0.28, r); img.blob(x + w / 2, y + h * 0.3, w * 0.16, h * 0.14, r); }
  else if (/arrowhead|spear|knife|axe|blade/i.test(n)) { img.line(x + w * 0.2, y + h * 0.8, x + w * 0.75, y + h * 0.25, ramp('#8a8a90')[2]); img.line(x + w * 0.25, y + h * 0.8, x + w * 0.8, y + h * 0.25, ramp('#8a8a90')[3]); }
  else { // pottery
    for (let j = 0; j < h * 0.65; j++) { const ww = Math.round(w * (0.3 + 0.35 * Math.sin((j / (h * 0.65)) * Math.PI))); img.hline(x + (w - ww) / 2, y + h * 0.22 + j, ww, j % 4 === 0 ? r[3] : r[2]); }
    img.hline(x + w * 0.3, y + h * 0.2, w * 0.4, r[1]);
  }
  img.outline(OUT, x, y, w, h);
};

const food: Painter = (img, x, y, w, h, c) => {
  const plate = /soup|stew|chowder|broth|bisque|gumbo/i.test(c.name);
  if (plate) { img.ellipse(x + w / 2, y + h * 0.6, w * 0.42, h * 0.26, hex('#e8e0d8')); img.ellipse(x + w / 2, y + h * 0.56, w * 0.32, h * 0.16, ramp(c.base)[2]); }
  else if (/cake|pie|cookie|bread|muffin|pancake|tortilla|pizza/i.test(c.name)) { img.ellipse(x + w / 2, y + h * 0.7, w * 0.42, h * 0.16, hex('#e8e0d8')); img.blob(x + w / 2, y + h * 0.55, w * 0.32, h * 0.2, ramp(c.base)); }
  else if (/coffee|espresso|tea|juice|drink|tonic|cola|ale|milk/i.test(c.name)) { img.box(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.55, ramp(c.base)[2], OUT); img.hline(x + w * 0.3 + 1, y + h * 0.3 + 1, w * 0.4 - 2, ramp(c.base)[4]); }
  else { img.ellipse(x + w / 2, y + h * 0.66, w * 0.44, h * 0.2, hex('#e8e0d8')); for (let i = 0; i < 3; i++) img.blob(x + w * 0.35 + i * w * 0.15, y + h * 0.5 + (i % 2), w * 0.15, h * 0.13, ramp(i === 1 ? c.acc : c.base)); }
  img.outline(OUT, x, y, w, h);
};

const artisan: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  const n = c.name;
  if (/cheese/i.test(n)) { for (let j = 0; j < h * 0.4; j++) img.hline(x + w * 0.15, y + h * 0.4 + j, w * 0.7 * (0.4 + j / (h * 0.66)), j < 2 ? r[3] : r[2]); img.ellipse(x + w * 0.4, y + h * 0.62, 1.2, 1, r[1]); }
  else if (/cloth/i.test(n)) { img.box(x + w * 0.15, y + h * 0.3, w * 0.7, h * 0.45, r[2], r[0]); for (let i = x + w * 0.2; i < x + w * 0.85; i += 2) img.vline(i, y + h * 0.32, h * 0.4, r[1]); }
  else if (/mayonnaise|honey|jelly|pickles|roe|caviar|truffle oil|oil|syrup|resin|tar/i.test(n)) { img.box(x + w * 0.25, y + h * 0.3, w * 0.5, h * 0.6, r[2], OUT); img.box(x + w * 0.22, y + h * 0.22, w * 0.56, h * 0.12, hex('#c89a5a'), OUT); img.vline(x + w * 0.32, y + h * 0.36, h * 0.3, r[4]); }
  else if (/dried|smoked|raisins/i.test(n)) { img.blob(x + w / 2, y + h * 0.55, w * 0.32, h * 0.22, r); }
  else { // bottle
    img.box(x + w * 0.32, y + h * 0.35, w * 0.36, h * 0.58, r[2], OUT);
    img.box(x + w * 0.42, y + h * 0.12, w * 0.16, h * 0.25, r[1], OUT);
    img.rect(x + w * 0.34, y + h * 0.55, w * 0.32, h * 0.18, hex('#f0e8d0'));
    img.vline(x + w * 0.38, y + h * 0.4, h * 0.12, r[4]);
  }
  img.outline(OUT, x, y, w, h);
};

const forage: Painter = (img, x, y, w, h, c) => {
  const n = c.name;
  const r = ramp(c.base);
  if (/mushroom|morel|chanterelle|truffle/i.test(n)) { img.box(x + w * 0.42, y + h * 0.45, w * 0.16, h * 0.4, hex('#f0e8d8'), OUT); img.blob(x + w / 2, y + h * 0.4, w * 0.32, h * 0.2, /red/i.test(n) ? ramp('#d83a2a') : /purple/i.test(n) ? ramp('#8a4ab8') : ramp('#c8884a')); }
  else if (/berry|grape|plum|cherry/i.test(n)) { for (let i = 0; i < 4; i++) img.blob(x + w * 0.35 + (i % 2) * w * 0.25, y + h * 0.45 + Math.floor(i / 2) * h * 0.2, w * 0.13, h * 0.13, r); img.line(x + w / 2, y + h * 0.2, x + w / 2, y + h * 0.4, hex('#3a7a2a')); }
  else if (/shell|coral|urchin|nautilus|clam/i.test(n)) shellfish(img, x, y, w, h, c);
  else { // leaf / root / flower
    img.blob(x + w / 2, y + h * 0.55, w * 0.3, h * 0.3, r);
    img.line(x + w * 0.3, y + h * 0.8, x + w * 0.7, y + h * 0.3, r[0]);
  }
  img.outline(OUT, x, y, w, h);
};

const produce: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  if (c.kind === 'flower') { img.line(x + w / 2, y + h * 0.5, x + w / 2, y + h * 0.9, hex('#3a8a2a')); for (let a = 0; a < 5; a++) img.blob(x + w / 2 + Math.cos(a * 1.26) * w * 0.15, y + h * 0.35 + Math.sin(a * 1.26) * h * 0.15, w * 0.12, h * 0.12, r); img.ellipse(x + w / 2, y + h * 0.35, 1.5, 1.5, hex('#f8e870')); }
  else { img.blob(x + w / 2, y + h * 0.58, w * 0.32, h * 0.3, r); img.rect(x + w / 2, y + h * 0.18, 2, h * 0.14, hex('#4a8a2a')); img.blob(x + w * 0.62, y + h * 0.22, w * 0.1, h * 0.06, ramp('#5ab84a')); }
  img.outline(OUT, x, y, w, h);
};

const seed: Painter = (img, x, y, w, h, c) => {
  const r = ramp(baseColor(c.name.replace(/ (Seeds|Starter|Bulb|Sapling|Seed)$/i, ''), 'produce'));
  img.box(x + w * 0.2, y + h * 0.15, w * 0.6, h * 0.7, hex('#e8dcc0'), OUT);
  img.rect(x + w * 0.2 + 1, y + h * 0.15 + 1, w * 0.6 - 2, h * 0.18, r[2]);
  img.blob(x + w / 2, y + h * 0.58, w * 0.16, h * 0.14, r);
};

const sapling: Painter = (img, x, y, w, h, c) => {
  img.ellipse(x + w / 2, y + h * 0.82, w * 0.3, h * 0.08, hex('#7a4a2a'));
  img.vline(x + w / 2, y + h * 0.35, h * 0.47, hex('#7a5232'));
  img.blob(x + w * 0.38, y + h * 0.35, w * 0.16, h * 0.12, fallbackLeaf('spring'));
  img.blob(x + w * 0.62, y + h * 0.3, w * 0.16, h * 0.12, fallbackLeaf('spring'));
  img.outline(OUT, x, y, w, h);
  void c;
};

const fertilizer: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  img.box(x + w * 0.2, y + h * 0.25, w * 0.6, h * 0.65, r[2], OUT);
  img.hline(x + w * 0.25, y + h * 0.25, w * 0.5, r[0]);
  img.rect(x + w * 0.3, y + h * 0.5, w * 0.4, h * 0.15, r[4]);
};

const hat: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  img.ellipse(x + w / 2, y + h * 0.68, w * 0.45, h * 0.12, r[1]);
  img.blob(x + w / 2, y + h * 0.48, w * 0.28, h * 0.25, r);
  img.hline(x + w * 0.24, y + h * 0.58, w * 0.52, ramp(c.acc)[2]);
  img.outline(OUT, x, y, w, h);
};

const boots: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  for (const ox of [0.15, 0.52]) {
    img.box(x + w * ox, y + h * 0.25, w * 0.22, h * 0.5, r[2], OUT);
    img.box(x + w * ox, y + h * 0.65, w * 0.34, h * 0.18, r[1], OUT);
  }
};

const ring: Painter = (img, x, y, w, h, c) => {
  const r = ramp(/band|iridium|ring of yoba|wedding/i.test(c.name) ? c.base : '#e8b830');
  img.ellipse(x + w / 2, y + h * 0.6, w * 0.32, h * 0.26, r[2]);
  img.ellipse(x + w / 2, y + h * 0.62, w * 0.2, h * 0.15, [0, 0, 0, 0]);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const dx = (i + 0.5 - w / 2) / (w * 0.2), dy = (j + 0.5 - h * 0.62) / (h * 0.15); if (dx * dx + dy * dy <= 1) img.data[((y + j) * img.w + x + i) * 4 + 3] = 0; }
  img.blob(x + w / 2, y + h * 0.3, w * 0.13, h * 0.12, ramp(baseColor(c.name.replace(' Ring', ''), 'gem')));
  img.outline(OUT, x, y, w, h);
};

const sword: Painter = (img, x, y, w, h, c) => {
  const blade = ramp(/galaxy/i.test(c.name) ? '#c84ad8' : /lava/i.test(c.name) ? '#e8582a' : /bone/i.test(c.name) ? '#e8dcc0' : /wood/i.test(c.name) ? '#b08048' : '#c8d0d8');
  const dagger = c.kind === 'dagger';
  const len = dagger ? 0.55 : 0.8;
  for (let i = 0; i < w * len; i++) { img.px(x + w * 0.15 + i, y + h * 0.85 - i, blade[3]); img.px(x + w * 0.15 + i + 1, y + h * 0.85 - i, blade[2]); }
  img.line(x + w * 0.08, y + h * 0.72, x + w * 0.3, y + h * 0.95, hex('#c8a02a'));
  img.line(x + w * 0.05, y + h * 0.95, x + w * 0.15, y + h * 0.85, hex('#6a4a2a'));
  img.outline(OUT, x, y, w, h);
};

const club: Painter = (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  img.line(x + w * 0.2, y + h * 0.85, x + w * 0.6, y + h * 0.4, hex('#7a5232'));
  img.blob(x + w * 0.65, y + h * 0.32, w * 0.2, h * 0.18, r);
  img.outline(OUT, x, y, w, h);
};

const slingshot: Painter = (img, x, y, w, h) => {
  const r = ramp('#8a6a4a');
  img.line(x + w / 2, y + h * 0.9, x + w / 2, y + h * 0.5, r[2]);
  img.line(x + w / 2, y + h * 0.5, x + w * 0.25, y + h * 0.15, r[2]);
  img.line(x + w / 2, y + h * 0.5, x + w * 0.75, y + h * 0.15, r[2]);
  img.line(x + w * 0.25, y + h * 0.15, x + w * 0.75, y + h * 0.15, hex('#c84a3a'));
  img.outline(OUT, x, y, w, h);
};

const tool: Painter = (img, x, y, w, h, c) => {
  const n = c.name;
  const head = ramp(/iridium/i.test(n) ? '#9a5ad6' : /gold/i.test(n) ? '#e8b830' : /steel/i.test(n) ? '#c8d0d8' : /copper/i.test(n) ? '#d07a3a' : '#9aa4ae');
  if (/watering/i.test(n)) { img.box(x + w * 0.2, y + h * 0.4, w * 0.5, h * 0.42, head[2], OUT); img.line(x + w * 0.7, y + h * 0.55, x + w * 0.92, y + h * 0.3, head[1]); img.hline(x + w * 0.3, y + h * 0.3, w * 0.3, OUT); }
  else if (/trash/i.test(n)) { img.box(x + w * 0.25, y + h * 0.3, w * 0.5, h * 0.6, head[2], OUT); img.box(x + w * 0.2, y + h * 0.22, w * 0.6, h * 0.1, head[3], OUT); }
  else if (/pan/i.test(n)) { img.ellipse(x + w * 0.45, y + h * 0.55, w * 0.32, h * 0.22, head[2]); img.line(x + w * 0.75, y + h * 0.5, x + w * 0.95, y + h * 0.4, hex('#7a5232')); img.outline(OUT, x, y, w, h); }
  else if (/scythe/i.test(n)) { img.line(x + w * 0.2, y + h * 0.9, x + w * 0.5, y + h * 0.15, hex('#7a5232')); for (let i = 0; i < w * 0.45; i++) img.px(x + w * 0.5 + i, y + h * 0.15 + i * i * 0.04, head[3]); img.outline(OUT, x, y, w, h); }
  else if (/pail|shears|heater|grabber|petter/i.test(n)) { img.box(x + w * 0.25, y + h * 0.35, w * 0.5, h * 0.5, head[2], OUT); img.hline(x + w * 0.3, y + h * 0.42, w * 0.4, head[4]); }
  else {
    img.line(x + w * 0.2, y + h * 0.9, x + w * 0.65, y + h * 0.2, hex('#7a5232'));
    img.line(x + w * 0.22, y + h * 0.9, x + w * 0.67, y + h * 0.2, hex('#9a7242'));
    if (/axe/i.test(n) && !/pick/i.test(n)) img.box(x + w * 0.55, y + h * 0.12, w * 0.3, h * 0.25, head[2], OUT);
    else if (/pick/i.test(n)) { img.line(x + w * 0.35, y + h * 0.1, x + w * 0.9, y + h * 0.35, head[2]); img.line(x + w * 0.35, y + h * 0.12, x + w * 0.9, y + h * 0.37, head[1]); }
    else img.box(x + w * 0.5, y + h * 0.12, w * 0.32, h * 0.14, head[2], OUT);
    img.outline(OUT, x, y, w, h);
  }
};

const rod: Painter = (img, x, y, w, h, c) => {
  const r = ramp(/iridium/i.test(c.name) ? '#9a5ad6' : /fiberglass/i.test(c.name) ? '#5a8ad8' : /bamboo/i.test(c.name) ? '#c8b060' : '#a8743e');
  img.line(x + w * 0.15, y + h * 0.9, x + w * 0.85, y + h * 0.1, r[2]);
  img.line(x + w * 0.85, y + h * 0.1, x + w * 0.85, y + h * 0.6, hex('#e8e8f0'));
  img.ellipse(x + w * 0.28, y + h * 0.72, 1.6, 1.6, hex('#5a5a6a'));
  img.outline(OUT, x, y, w, h);
};

const simpleObj = (shape: 'bag' | 'book' | 'star' | 'potion' | 'bomb' | 'totem' | 'animal' | 'tackle' | 'trinket' | 'bait' | 'loot' | 'resource'): Painter => (img, x, y, w, h, c) => {
  const r = ramp(c.base);
  switch (shape) {
    case 'book':
      img.box(x + w * 0.2, y + h * 0.15, w * 0.6, h * 0.72, r[2], OUT);
      img.vline(x + w * 0.28, y + h * 0.17, h * 0.68, r[0]);
      img.rect(x + w * 0.38, y + h * 0.3, w * 0.3, h * 0.12, hex('#f0e0a0'));
      break;
    case 'star':
      for (let a = 0; a < 5; a++) img.line(x + w / 2, y + h / 2, x + w / 2 + Math.cos(a * 1.2566 - 1.57) * w * 0.4, y + h / 2 + Math.sin(a * 1.2566 - 1.57) * h * 0.4, r[2]);
      img.blob(x + w / 2, y + h / 2, w * 0.2, h * 0.2, r);
      img.outline(OUT, x, y, w, h);
      break;
    case 'potion':
      img.ellipse(x + w / 2, y + h * 0.62, w * 0.3, h * 0.28, r[2]);
      img.rect(x + w * 0.42, y + h * 0.18, w * 0.16, h * 0.2, GLASS);
      img.ellipse(x + w * 0.42, y + h * 0.55, 1.2, 1.5, r[4]);
      img.outline(OUT, x, y, w, h);
      break;
    case 'bomb':
      img.blob(x + w / 2, y + h * 0.6, w * 0.32, h * 0.3, ramp(/mega/i.test(c.name) ? '#5a5a7a' : /cherry/i.test(c.name) ? '#c83a3a' : '#3a3a4a'));
      img.line(x + w * 0.6, y + h * 0.3, x + w * 0.75, y + h * 0.15, hex('#c8a87a'));
      img.px(x + w * 0.78, y + h * 0.12, FLAME[4]);
      img.outline(OUT, x, y, w, h);
      break;
    case 'totem':
      img.box(x + w * 0.3, y + h * 0.15, w * 0.4, h * 0.75, ramp('#a8743e')[2], OUT);
      img.rect(x + w * 0.35, y + h * 0.3, w * 0.3, h * 0.15, r[3]);
      img.rect(x + w * 0.35, y + h * 0.55, w * 0.3, h * 0.12, ramp(c.acc)[2]);
      break;
    case 'animal': {
      const body = ramp(/brown/i.test(c.name) ? '#a8784a' : /black|void/i.test(c.name) ? '#3a3440' : /golden/i.test(c.name) ? '#e8b830' : /blue/i.test(c.name) ? '#8ab0d8' : /pig/i.test(c.name) ? '#e8a8a8' : /dinosaur/i.test(c.name) ? '#6ab84a' : /turtle/i.test(c.name) ? '#5a9a4a' : /horse/i.test(c.name) ? '#8a5a32' : '#f0e8e0');
      img.blob(x + w * 0.52, y + h * 0.58, w * 0.3, h * 0.22, body);
      img.blob(x + w * 0.25, y + h * 0.4, w * 0.16, h * 0.15, body);
      img.vline(x + w * 0.38, y + h * 0.75, h * 0.15, body[0]);
      img.vline(x + w * 0.68, y + h * 0.75, h * 0.15, body[0]);
      img.outline(OUT, x, y, w, h);
      img.px(x + w * 0.22, y + h * 0.38, OUT);
      break;
    }
    case 'tackle':
      img.ellipse(x + w / 2, y + h * 0.45, w * 0.22, h * 0.22, r[2]);
      img.hline(x + w * 0.28, y + h * 0.45, w * 0.44, hex('#f4f0e8'));
      img.line(x + w / 2, y + h * 0.67, x + w * 0.4, y + h * 0.88, hex('#8a8a96'));
      img.outline(OUT, x, y, w, h);
      break;
    case 'trinket':
      img.blob(x + w / 2, y + h * 0.55, w * 0.25, h * 0.25, r);
      img.line(x + w / 2, y + h * 0.3, x + w * 0.35, y + h * 0.12, hex('#c8a02a'));
      img.line(x + w / 2, y + h * 0.3, x + w * 0.65, y + h * 0.12, hex('#c8a02a'));
      img.outline(OUT, x, y, w, h);
      break;
    case 'bait':
      for (let i = 0; i < 3; i++) img.blob(x + w * 0.3 + i * w * 0.2, y + h * 0.55 - (i % 2) * 2, w * 0.12, h * 0.12, r);
      img.outline(OUT, x, y, w, h);
      break;
    case 'loot':
      img.blob(x + w / 2, y + h * 0.55, w * 0.3, h * 0.25, r);
      img.outline(OUT, x, y, w, h);
      img.px(x + w * 0.42, y + h * 0.48, r[4]);
      break;
    case 'resource':
      if (/wood|hardwood/i.test(c.name)) { img.box(x + w * 0.15, y + h * 0.35, w * 0.7, h * 0.35, r[2], OUT); img.ellipse(x + w * 0.2, y + h * 0.52, 2, 3, ramp('#e0c89a')[2]); }
      else img.blob(x + w / 2, y + h * 0.55, w * 0.32, h * 0.28, r);
      img.outline(OUT, x, y, w, h);
      break;
    default: // bag
      img.blob(x + w / 2, y + h * 0.6, w * 0.32, h * 0.3, r);
      img.box(x + w * 0.38, y + h * 0.2, w * 0.24, h * 0.14, r[1], OUT);
      img.outline(OUT, x, y, w, h);
  }
};

/** 3x3 giant crops: one big round fruit on a bed of leaves. */
const giantcrop: Painter = (img, x, y, w, h, c) => {
  const prod = ramp(c.base), leaf = ramp('#4aa83a');
  const cx = x + w / 2, cy = y + h * 0.52;
  img.ellipse(cx, y + h * 0.86, w * 0.42, h * 0.1, SHADOW);
  for (let a = 0; a < 6; a++) img.blob(cx + Math.cos(a * 1.05) * w * 0.34, y + h * 0.78 + Math.sin(a * 1.05) * h * 0.08, w * 0.14, h * 0.08, leaf);
  img.blob(cx, cy, w * 0.4, h * 0.36, prod);
  if (/pumpkin|melon/i.test(c.name)) for (let i = -2; i <= 2; i++) if (i) img.line(cx + i * w * 0.09, cy - h * 0.3, cx + i * w * 0.13, cy + h * 0.3, prod[1]);
  if (/cauliflower/i.test(c.name)) for (let i = 0; i < 9; i++) img.blob(cx - w * 0.22 + c.rng.int(Math.max(1, Math.floor(w * 0.44))), cy - h * 0.2 + c.rng.int(Math.max(1, Math.floor(h * 0.3))), w * 0.07, h * 0.06, ramp('#fbfbf0'));
  img.rect(cx - 1, cy - h * 0.42, Math.max(2, w * 0.05), h * 0.1, hex('#4a8a2a'));
  img.outline(OUT, x, y, w, h);
};

/** Natural debris: boulders, stumps, logs, meteorite, small stones, twigs, weeds, truffle. */
const debris: Painter = (img, x, y, w, h, c) => {
  const n = c.name, cx = x + w / 2, by = y + h - 2;
  img.ellipse(cx, by, w * 0.4, Math.max(1.5, h * 0.08), SHADOW);
  if (/stump/i.test(n)) {
    const r = ramp('#8a5a32');
    img.box(x + w * 0.2, y + h * 0.4, w * 0.6, h * 0.5, r[2], OUT);
    img.ellipse(cx, y + h * 0.4, w * 0.3, h * 0.14, hex('#d8b07a'));
    img.ellipse(cx, y + h * 0.4, w * 0.16, h * 0.07, hex('#b88a52'));
    for (let i = 0; i < 3; i++) img.vline(Math.floor(x + w * (0.3 + i * 0.18)), Math.floor(y + h * 0.55), Math.floor(h * 0.3), r[1]);
  } else if (/log/i.test(n)) {
    const r = ramp('#7a5232');
    img.box(x + w * 0.08, y + h * 0.45, w * 0.84, h * 0.38, r[2], OUT);
    img.ellipse(x + w * 0.14, y + h * 0.64, w * 0.08, h * 0.17, hex('#d8b07a'));
    for (let i = 1; i < 5; i++) img.hline(x + w * 0.25, y + h * (0.48 + i * 0.07), w * 0.6, r[i % 2 ? 1 : 3]);
  } else if (/twig/i.test(n)) {
    img.line(x + w * 0.2, y + h * 0.75, x + w * 0.8, y + h * 0.4, hex('#7a5232'));
    img.line(x + w * 0.5, y + h * 0.57, x + w * 0.62, y + h * 0.8, hex('#7a5232'));
    img.line(x + w * 0.45, y + h * 0.6, x + w * 0.35, y + h * 0.4, hex('#9a6a3a'));
  } else if (/weeds/i.test(n)) {
    const r = ramp(c.season === 'fall' ? '#b8922a' : c.season === 'winter' ? '#8aa8a0' : '#4a9a34');
    for (let i = -2; i <= 2; i++) img.line(cx, by - 1, cx + i * w * 0.14, y + h * (0.3 + Math.abs(i) * 0.1), r[i % 2 ? 3 : 2]);
  } else if (/truffle/i.test(n)) {
    img.blob(cx, y + h * 0.62, w * 0.26, h * 0.22, ramp('#5a4030'));
    img.px(cx - 1, y + h * 0.55, hex('#8a6a50')); img.px(cx + 2, y + h * 0.68, hex('#8a6a50'));
    img.outline(OUT, x, y, w, h);
  } else {
    const r = ramp(/meteor/i.test(n) ? '#7a4ab8' : '#8a8a90');
    img.blob(cx, y + h * 0.58, w * 0.4, h * 0.32, r);
    img.blob(cx - w * 0.14, y + h * 0.44, w * 0.2, h * 0.16, r);
    img.line(cx - w * 0.1, y + h * 0.5, cx + w * 0.12, y + h * 0.72, r[0]);
    if (/meteor/i.test(n)) { img.px(cx + w * 0.15, y + h * 0.45, hex('#e8c8ff')); img.px(cx - w * 0.2, y + h * 0.66, hex('#e8c8ff')); }
    img.outline(OUT, x, y, w, h);
  }
};

export const PAINTERS: Record<string, Painter> = {
  giantcrop, debris,
  chair, bench, couch, armchair, table, teatable, endtable, bookcase, lamp, bed, fireplace, fishtank, tv,
  houseplant, rug, painting, walldecor, decor, piano, catalogue, dresser,
  chest, machine, sprinkler, scarecrow, rarecrow: scarecrow, light, lamppost, brazier, torch, jackolantern,
  fence, gate, floor, path: floor, tilled: ground, watered: ground, grassplant: ground, bluegrass: ground,
  sign, block, flowertub, gardenpot, crabpot, statue,
  crop, teabush: crop, trellis: crop, fruittree, tree,
  fish, shellfish, gem, bar, ore, node: ore, geode, artifact, food, artisan, forage, produce, flower: produce,
  seed, sapling, treeseed: sapling, fertilizer, hat, boots, ring, sword, dagger: sword, club, slingshot, tool, rod,
  book: simpleObj('book'), special: simpleObj('star'), stardrop: simpleObj('star'), potion: simpleObj('potion'),
  bomb: simpleObj('bomb'), totem: simpleObj('totem'), animal: simpleObj('animal'), tackle: simpleObj('tackle'),
  trinket: simpleObj('trinket'), bait: simpleObj('bait'), loot: simpleObj('loot'), resource: simpleObj('resource'),
  misc: simpleObj('bag'), backpack: simpleObj('bag'),
};

/** Vertical rise (px at 1x) above the footprint for world sprites, by kind. */
export const RISE: Record<string, number> = {
  machine: 12, chest: 4, lamp: 14, lamppost: 22, scarecrow: 14, rarecrow: 14, statue: 12, brazier: 10, light: 10,
  torch: 8, sign: 6, fence: 10, gate: 8, block: 2, flowertub: 4, gardenpot: 2, houseplant: 12, bookcase: 18,
  dresser: 10, fireplace: 14, tv: 10, couch: 8, armchair: 8, chair: 8, bench: 6, bed: 6, decor: 8, piano: 14,
  catalogue: 10, table: 4, teatable: 2, endtable: 6, fishtank: 10, crop: 8, teabush: 8, trellis: 14,
  jackolantern: 2, giantcrop: 8, debris: 2, sprinkler: 0, crabpot: 0, walldecor: 0, painting: 0,
};

// ---------------------------------------------------------------- hand-designed art (scripts/art/paint/*)
// Each category module replaces painters by kind and may change the rise of a kind.
// These painters draw world sprites at their real size; icons are made from the world sprite.
import * as cropsArt from './paint/crops';
import * as craftArt from './paint/craftables';
import * as decorArt from './paint/decor';
import * as furnitureArt from './paint/furniture';
import * as buildingArt from './paint/buildings';

/** Kinds whose painter is hand-designed for real-size world sprites. */
export const NATIVE_KINDS = new Set<string>();
for (const mod of [cropsArt, craftArt, decorArt, furnitureArt]) {
  Object.assign(PAINTERS, mod.painters);
  Object.assign(RISE, mod.rise);
  for (const k of Object.keys(mod.painters)) NATIVE_KINDS.add(k);
}
/** Hand-designed building art; returns false for a building it does not draw. */
export const paintBuildingArt = buildingArt.paintBuilding;
