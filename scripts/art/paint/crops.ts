/** Hand-designed world sprites: crops, trees, giant crops and debris. */
import { mix } from '../png';
import { hash, hex, Img, OUTLINE, SHADOW, stamp, tonePal, tones } from './kit';
import type { Ctx, Painter, Pal, RGBA, Tones } from './kit';

// ------------------------------------------------------------------ shared tools

type Draw = (t: Img, G: number, c: Ctx) => void;

const GR = tones('#4aa63e'); // plain leaf green
const GD = tones('#2f8a46'); // dark glossy green
const GL = tones('#7cc043'); // lime green
const GB = tones('#3f9a7a'); // blue green
const WOOD = tones('#a8743e');
const BARK = tones('#8a5a3a');
const SOIL = tones('#7a4e2e');
const WHITE = hex('#fbf6e8');
const SNOW = tones('#e6eef6');

/** Shaded ellipse: light from the top-left. The center is on a pixel corner, like Img.ellipse. */
function orb(t: Img, cx: number, cy: number, rx: number, ry: number, T: Tones, hi = false) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const v = dx * 0.55 + dy * 0.8;
      t.px(x, y, v < -0.5 ? T[4] : v < 0.2 ? T[3] : v < 0.62 ? T[2] : T[1]);
    }
  }
  if (hi) t.px(Math.floor(cx - rx * 0.45), Math.floor(cy - ry * 0.5), T[5]);
}

/** Pointed leaf from the base (x0, y0) to the tip (x1, y1); wd is the half width. */
function leaf(t: Img, x0: number, y0: number, x1: number, y1: number, wd: number, T: Tones, vein = false) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const lit = nx * -0.6 + ny * -0.8;
  for (let y = Math.floor(Math.min(y0, y1) - wd); y <= Math.ceil(Math.max(y0, y1) + wd); y++) {
    for (let x = Math.floor(Math.min(x0, x1) - wd); x <= Math.ceil(Math.max(x0, x1) + wd); x++) {
      const px = x - x0, py = y - y0;
      const s = (px * dx + py * dy) / (len * len);
      if (s < 0 || s > 1) continue;
      const d = px * nx + py * ny;
      const hw = Math.max(0.5, wd * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.75)), 0.7));
      if (Math.abs(d) > hw) continue;
      const side = d * (lit >= 0 ? 1 : -1);
      let col = side > 0.6 ? T[4] : side < -0.6 ? T[2] : T[3];
      if (vein && Math.abs(d) < 0.5 && s > 0.1 && s < 0.85) col = T[5];
      t.px(x, y, col);
    }
  }
}

/** Quadratic curve, 1 px wide. */
function curve(t: Img, x0: number, y0: number, mx: number, my: number, x1: number, y1: number, col: RGBA) {
  let lx = x0, ly = y0;
  for (let i = 1; i <= 12; i++) {
    const s = i / 12, a = (1 - s) * (1 - s), b = 2 * s * (1 - s), cc = s * s;
    const X = Math.round(a * x0 + b * mx + cc * x1), Y = Math.round(a * y0 + b * my + cc * y1);
    t.line(lx, ly, X, Y, col); lx = X; ly = Y;
  }
}

/** Leafy mass: a shaded ellipse with small leaf marks. */
function bush(t: Img, cx: number, cy: number, rx: number, ry: number, T: Tones, seed = 1, density = 0.4) {
  orb(t, cx, cy, rx, ry, T);
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 2) {
    for (let x = Math.floor(cx - rx) + (y & 2 ? 1 : 0); x <= cx + rx; x += 2) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 0.72 || hash(x, y, seed) > density) continue;
      const v = dx * 0.55 + dy * 0.8;
      if (v < -0.1) { t.px(x, y, T[5]); t.px(x + 1, y, T[4]); }
      else if (v < 0.35) { t.px(x, y, T[4]); t.px(x, y + 1, T[2]); }
      else { t.px(x, y, T[2]); t.px(x, y + 1, T[0]); }
    }
  }
}

/** Outline tinted by the color it touches (darker version of the neighbor). */
function ink(t: Img, k = 0.68) {
  const marks: [number, number, RGBA][] = [];
  for (let y = 0; y < t.h; y++) {
    for (let x = 0; x < t.w; x++) {
      if (t.alpha(x, y) >= 128) continue;
      for (const [ox, oy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        if (t.alpha(x + ox, y + oy) >= 128) { marks.push([x, y, mix(t.get(x + ox, y + oy), OUTLINE, k)]); break; }
      }
    }
  }
  for (const [x, y, c] of marks) { const i = (y * t.w + x) * 4; t.data[i] = c[0]; t.data[i + 1] = c[1]; t.data[i + 2] = c[2]; t.data[i + 3] = 255; }
}

/** Palette for stamps: 0-5 leaf, a-f main color, u-z second color, m-r wood, W white, Y yellow, K dark. */
function mk(main: string, second = '#f2c53d', leafCol: string | RGBA = GR[3]): Pal {
  return tonePal({ '012345': leafCol, abcdef: main, uvwxyz: second, mnopqr: '#a8743e' }, { W: WHITE, Y: hex('#ffd84a'), K: OUTLINE });
}
const S = (t: Img, x: number, y: number, rows: string[], pal: Pal, flip = false) => stamp(t, x, y, rows, pal, flip);

/** Small soil mound under a plant, drawn straight on the sheet (no outline). */
function mound(img: Img, cx: number, by: number, rx = 5) {
  img.ellipse(cx, by - 1, rx, 2, SOIL[1]);
  img.ellipse(cx, by - 1.5, rx - 1, 1.2, SOIL[2]);
  img.hline(Math.round(cx - rx / 2), by - 3, 2, SOIL[3]);
}

/** Runs a draw function on a private layer, inks it and puts it in the box. */
function layer(img: Img, x: number, y: number, w: number, h: number, draw: (t: Img) => void, k = 0.68) {
  const t = new Img(w, h);
  draw(t);
  ink(t, k);
  img.blit(t, x, y);
}

// ------------------------------------------------------------------ crop parts

const TULIP = ['e.e.d', 'eeddc', 'edddc', 'edddc', '.dcb.'];
const POPPY = ['.eed.d.', 'eeedddc', 'edKKKdc', 'ddYKdcc', '.dccc..'];
const SPANGLE = ['...e...', '.e.e.d.', '..eed..', 'eeeyydd', '..dyc..', '.d.c.c.', '...c...'];
const ROSE = ['.eed.', 'efdcd', 'edbdc', 'dcddc', '.ccb.'];
const STAR = ['...f...', '..eed..', 'feeeddc', '.eeddc.', '.eedcc.', 'ee...cc', 'e.....c'];
const GEM = ['..eee..', '.effed.', 'efeeddc', 'eeedddc', '.edddc.', '.eddcc.', '..dcc..', '...c...'];
const BERRY = ['.32.', 'edYc', 'dddc', '.dc.'];
const PEPPER = ['3.', 'ed', 'ed', 'dc', '.c'];
const EGGPLANT = ['.3.', '323', 'edc', 'edc', 'edb', '.c.'];
const CONE = ['.e.', 'fed', 'ecd', '.c.'];
const GRAPES = ['eddcd', 'dfdcc', 'eddcb', '.dfc.', '.dc..', '..c..'];
const SHROOM = ['.eed..', 'eeYddc', 'edddYc', '..WW..', '..Wy..'];
const HEART = ['.44.33.', '4443332', '4433322', '.43322.', '..332..', '...2...'];
const CROCUS = ['e.d.', 'eddc', 'eYdc', '.dc.'];
const PEA = ['.ee.', 'eedd', 'xxdc', '.wx.'];
const DAFF = ['.e.d.', 'eexdd', '.xwx.', 'ddxcc', '.d.c.'];

function trellisFrame(t: Img, G: number, top = 25) {
  for (const px of [2, 13]) {
    t.vline(px, G - top, top + 1, WOOD[3]); t.vline(px + (px < 8 ? 1 : -1), G - top + 1, top, px < 8 ? WOOD[2] : WOOD[4]);
  }
  t.vline(2, G - top, top + 1, WOOD[4]); t.vline(3, G - top + 1, top, WOOD[2]);
  t.vline(12, G - top + 1, top, WOOD[4]); t.vline(13, G - top, top + 1, WOOD[2]);
  for (const ry of [G - top + 3, G - top + 11, G - top + 19]) { t.hline(1, ry, 14, WOOD[4]); t.hline(1, ry + 1, 14, WOOD[1]); }
  t.vline(7, G - top + 4, top - 4, WOOD[2]); t.vline(8, G - top + 4, top - 4, WOOD[1]);
}

function vineCover(t: Img, G: number, T: Tones, seed: number) {
  curve(t, 8, G, 3, G - 8, 9, G - 14, T[1]);
  curve(t, 9, G - 14, 13, G - 20, 6, G - 25, T[1]);
  const spots: [number, number][] = [[4, 5], [11, 7], [7, 10], [3, 13], [12, 14], [8, 17], [4, 20], [11, 21], [7, 24], [12, 26], [3, 26]];
  spots.forEach(([lx, ly], i) => { if (hash(i, seed) < 0.9) orb(t, lx + 0.5, G - ly + 0.5, 2.5, 2.2, i % 3 === 0 ? tones(T[2]) : T, false); });
}

function rootTop(t: Img, G: number, col: string, rx = 3, ry = 2.5) {
  orb(t, 8, G - ry + 1, rx, ry, tones(col), true);
}

function flowerStem(t: Img, x: number, G: number, top: number, T: Tones = GR) {
  t.vline(x, G - top, top + 1, T[2]);
}

// ------------------------------------------------------------------ crops

const CROPS: Record<string, Draw> = {
  Parsnip(t, G) {
    leaf(t, 7, G - 3, 2, G - 10, 2.2, GR, true); leaf(t, 8, G - 3, 13, G - 10, 2.2, GR, true);
    leaf(t, 7, G - 3, 5, G - 14, 2, GL, true); leaf(t, 8, G - 3, 10, G - 13, 2, GL, true);
    rootTop(t, G, '#efdca8', 3.5, 2.5); t.hline(6, G, 3, hex('#c9a878'));
  },
  Carrot(t, G) {
    const T = tones('#5fb53c');
    for (const [ex, ey] of [[2, 9], [5, 14], [8, 16], [11, 14], [13, 9]]) {
      curve(t, 8, G - 3, (8 + ex) / 2, G - ey, ex, G - ey, T[3]);
      for (let i = 2; i < ey - 3; i += 2) { const fx = Math.round(8 + (ex - 8) * (i / ey) ** 0.8); t.px(fx - 1, G - 3 - i, T[4]); t.px(fx + 1, G - 4 - i, T[2]); }
    }
    rootTop(t, G, '#f08a24', 3, 2.5); t.hline(6, G - 1, 3, hex('#c96a1c'));
  },
  Radish(t, G) {
    const st = hex('#e88aa0');
    t.line(7, G - 4, 4, G - 9, st); t.line(8, G - 4, 11, G - 9, st); t.vline(8, G - 11, 7, st);
    orb(t, 4, G - 10, 3, 3.5, GR); orb(t, 12, G - 10, 3, 3.5, GR); orb(t, 8, G - 14, 3, 3.5, GL);
    t.vline(4, G - 12, 4, GR[5]); t.vline(11, G - 12, 4, GR[5]); t.vline(8, G - 16, 4, GL[5]);
    rootTop(t, G, '#e2456e', 4, 3); t.hline(7, G, 2, WHITE);
  },
  Beet(t, G) {
    const st = hex('#c2356a'), T = tones('#3f8f45');
    leaf(t, 7, G - 4, 2, G - 12, 2.4, T); leaf(t, 8, G - 4, 13, G - 12, 2.4, T); leaf(t, 8, G - 4, 8, G - 17, 2.6, T);
    t.line(7, G - 3, 2, G - 12, st); t.line(8, G - 3, 13, G - 12, st); t.vline(8, G - 16, 13, st);
    rootTop(t, G, '#96285a', 4, 3);
  },
  Garlic(t, G) {
    const T = tones('#5aa88a');
    for (const [ex, ey, m] of [[3, 15, 5], [6, 19, 7], [9, 20, 8], [13, 14, 11]]) { curve(t, 8, G - 3, m, G - ey + 4, ex, G - ey, T[3]); curve(t, 8, G - 3, m + 1, G - ey + 4, ex + 1, G - ey + 1, T[2]); }
    curve(t, 9, G - 20, 11, G - 23, 13, G - 20, T[4]);
    rootTop(t, G, '#f3ecdf', 4, 3); t.vline(6, G - 3, 3, hex('#c9a3c9')); t.vline(9, G - 3, 3, hex('#d9c0d9'));
  },
  Potato(t, G) {
    bush(t, 4.5, G - 5, 3.5, 3.5, GD, 3); bush(t, 11.5, G - 5, 3.5, 3.5, GD, 4); bush(t, 8, G - 8, 4.5, 4, GD, 5);
    for (const [fx, fy] of [[5, 9], [10, 11], [12, 6]]) { t.px(fx, G - fy, WHITE); t.px(fx + 1, G - fy, hex('#ffd84a')); t.px(fx, G - fy - 1, WHITE); }
    orb(t, 4, G, 2.5, 1.6, tones('#d9b070'), true); orb(t, 11.5, G - 0.5, 2.5, 2, tones('#c99a5a'), true);
  },
  Yam(t, G) {
    const p = mk('#a04a6a', '#f2c53d', hex('#3f9a4a'));
    curve(t, 8, G - 2, 2, G - 6, 4, G - 12, GD[2]); curve(t, 8, G - 2, 14, G - 5, 11, G - 13, GD[2]);
    S(t, 1, G - 9, HEART, p); S(t, 8, G - 8, HEART, p, true); S(t, 4, G - 15, HEART, p);
    orb(t, 8, G - 1, 4, 2.2, tones('#b0527a'), true);
  },
  'Taro Root'(t, G) {
    const p = mk('#8a6a4a', '#f2c53d', hex('#3fa05a'));
    const st = hex('#7ab86a');
    t.line(8, G - 2, 4, G - 12, st); t.line(8, G - 2, 12, G - 14, st); t.vline(8, G - 20, 18, st);
    S(t, 0, G - 14, HEART, p); S(t, 8, G - 17, HEART, p, true); S(t, 4, G - 24, HEART, p);
    orb(t, 8, G - 1, 3.5, 2.5, tones('#8a6444'), true); t.hline(5, G - 1, 6, hex('#5f4230'));
  },
  Cauliflower(t, G) {
    leaf(t, 6, G - 1, 1, G - 9, 3, GB); leaf(t, 10, G - 1, 14, G - 9, 3, GB); leaf(t, 8, G - 2, 8, G - 12, 3.5, GB);
    const W = tones('#f4eedc');
    orb(t, 8, G - 4, 5, 4, W, true);
    for (const [bx, by] of [[5, 5], [8, 3], [10, 6], [7, 7], [11, 3], [6, 2]]) { t.px(bx, G - by, W[2]); t.px(bx + 1, G - by - 1, W[5]); }
    leaf(t, 3, G, 2, G - 5, 1.6, GB); leaf(t, 12, G, 13, G - 5, 1.6, GB);
  },
  Broccoli(t, G) {
    const T = tones('#2f8a5a'), stT = tones('#8cc46a');
    leaf(t, 7, G - 1, 1, G - 6, 2.4, GR); leaf(t, 9, G - 1, 14, G - 6, 2.4, GR);
    t.rect(7, G - 7, 3, 7, stT[3]); t.vline(7, G - 7, 7, stT[4]); t.vline(9, G - 7, 7, stT[2]);
    bush(t, 4.5, G - 9, 3, 3, T, 2, 0.7); bush(t, 11.5, G - 9, 3, 3, T, 3, 0.7); bush(t, 8, G - 11.5, 4, 3.5, T, 4, 0.7);
  },
  Kale(t, G) {
    const T = tones('#2f7a5c'), rib = hex('#cfe8c0');
    const frill = (cx: number, cy: number, rx: number, ry: number, seed: number) => {
      for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; orb(t, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 1.3, 1.3, T); }
      orb(t, cx, cy, rx, ry, T);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283, ex = cx + Math.cos(a) * (rx + 0.4) - 0.5, ey = cy + Math.sin(a) * (ry + 0.4) - 0.5; if (Math.sin(a) < 0.3) t.px(ex, ey, hex('#9fe0b4')); else if (i % 2) t.px(ex, ey, T[1]); const ix = cx + Math.cos(a) * (rx - 0.9) - 0.5, iy = cy + Math.sin(a) * (ry - 0.9) - 0.5; if (i % 2 === 0) t.px(ix, iy, T[1]); }
      for (let i = 0; i < 4; i++) t.px(cx - 1 + (hash(i, seed) < 0.5 ? -1 : 1), cy - ry + 2 + i * 2, T[2]);
    };
    frill(4, G - 9, 2.6, 4, 1); frill(12, G - 9, 2.6, 4, 2);
    t.line(7, G, 4, G - 9, rib); t.line(9, G, 11, G - 9, rib);
    frill(8, G - 13, 3, 4.5, 3);
    t.vline(8, G - 14, 15, rib); t.vline(7, G - 3, 4, hex('#a8d0a0')); t.px(9, G - 1, hex('#a8d0a0'));
  },
  'Red Cabbage'(t, G) {
    const O = tones('#5f7a96'), P = tones('#8f3f96');
    leaf(t, 6, G, 1, G - 8, 3.2, O, true); leaf(t, 10, G, 14, G - 8, 3.2, O, true);
    orb(t, 8, G - 5, 5, 5, P, true);
    curve(t, 8, G - 1, 5, G - 5, 8, G - 9, P[5]); curve(t, 8, G - 1, 11, G - 5, 9, G - 8, P[1]); t.px(8, G - 6, P[4]);
    leaf(t, 4, G, 2, G - 4, 1.6, O); leaf(t, 12, G, 14, G - 4, 1.6, O);
  },
  'Bok Choy'(t, G) {
    const W = tones('#eaf0d8'), T = tones('#3f9a46');
    orb(t, 3.5, G - 9, 3, 4, T); orb(t, 12.5, G - 9, 3, 4, T); orb(t, 8, G - 12, 3.5, 4.5, tones('#4fb04a'));
    t.line(7, G - 2, 4, G - 9, W[3]); t.line(9, G - 2, 12, G - 9, W[3]); t.vline(8, G - 13, 10, W[4]); t.vline(7, G - 9, 6, W[3]);
    orb(t, 8, G - 2, 4, 3, W, true); t.vline(8, G - 4, 4, W[2]); t.vline(6, G - 3, 3, W[2]);
  },
  Artichoke(t, G) {
    const L = tones('#7fb09a');
    leaf(t, 7, G, 1, G - 9, 2, L, true); leaf(t, 9, G, 14, G - 9, 2, L, true); leaf(t, 7, G, 3, G - 3, 1.6, L); leaf(t, 9, G, 13, G - 3, 1.6, L);
    t.rect(7, G - 10, 2, 10, GR[3]); t.vline(8, G - 10, 10, GR[2]);
    S(t, 4, G - 19, ['...e...', '..eed..', '.eeedw.', 'eewedxd', 'eeddddc', 'ewddwdc', 'edddcdc', '.dwdcc.', '..dcc..'], mk('#6aa858', '#8a5aa0'));
  },
  Rhubarb(t, G) {
    const R = tones('#d63a52');
    for (const [bx, ex, ey] of [[6, 2, 11], [8, 8, 14], [10, 13, 11]]) { t.line(bx, G, ex, G - ey, R[3]); t.line(bx + 1, G, ex + 1, G - ey, R[2]); t.px(bx, G - 2, R[5]); }
    t.line(7, G, 5, G - 12, R[4]); t.line(9, G, 11, G - 12, R[1]);
    bush(t, 3, G - 13, 2.8, 2.8, GR, 1, 0.5); bush(t, 13, G - 13, 2.8, 2.8, GR, 2, 0.5); bush(t, 8, G - 17, 4, 3.2, GL, 3, 0.5);
  },
  Tulip(t, G) {
    leaf(t, 5, G, 2, G - 9, 1.8, GB); leaf(t, 6, G, 8, G - 8, 1.6, GB); leaf(t, 11, G, 13, G - 8, 1.8, GB);
    flowerStem(t, 5, G, 12); flowerStem(t, 10, G, 9);
    S(t, 3, G - 17, TULIP, mk('#e8455e')); S(t, 8, G - 13, TULIP, mk('#f2a03a'));
  },
  'Blue Jazz'(t, G) {
    const B = tones('#4f7fe8');
    leaf(t, 7, G, 3, G - 6, 1.5, GR); leaf(t, 9, G, 13, G - 6, 1.5, GR);
    curve(t, 7, G, 4, G - 6, 4, G - 11, GR[2]); flowerStem(t, 8, G, 15); curve(t, 9, G, 12, G - 5, 12, G - 9, GR[2]);
    for (const [fx, fy, r] of [[4.5, 12, 2.5], [8.5, 17, 3], [12, 10.5, 2.5]]) {
      orb(t, fx, G - fy, r, r, B, true); t.px(Math.floor(fx), G - Math.floor(fy), B[5]); t.px(Math.floor(fx) + 1, G - Math.floor(fy) + 1, B[1]); t.px(Math.floor(fx) - 1, G - Math.floor(fy) + 1, hex('#ffe9a0'));
    }
  },
  Poppy(t, G) {
    leaf(t, 7, G, 2, G - 5, 1.6, GR); leaf(t, 9, G, 13, G - 4, 1.6, GR);
    curve(t, 7, G, 5, G - 6, 6, G - 12, GR[2]); curve(t, 9, G, 12, G - 4, 11, G - 8, GR[2]); curve(t, 8, G, 9, G - 12, 12, G - 16, GR[2]);
    orb(t, 12.5, G - 16, 1.5, 2, tones('#5a9a4a'));
    S(t, 2, G - 16, POPPY, mk('#ee4a2a')); S(t, 8, G - 11, ['.ed.', 'eKdc', '.dc.'], mk('#ee4a2a'));
  },
  'Summer Spangle'(t, G) {
    leaf(t, 7, G, 2, G - 7, 1.4, GR); leaf(t, 9, G, 14, G - 8, 1.4, GR); leaf(t, 8, G, 5, G - 10, 1.4, GL); leaf(t, 8, G, 11, G - 11, 1.4, GL);
    flowerStem(t, 8, G, 14); curve(t, 8, G - 4, 12, G - 6, 12, G - 9, GR[2]);
    S(t, 4, G - 20, SPANGLE, mk('#f47a3a', '#ffe060')); S(t, 10, G - 12, ['.e.d.', '.eyd.', 'eyydc', '.d.c.'], mk('#f0509a', '#ffe060'));
  },
  Sunflower(t, G) {
    const Y = tones('#f6c42a'), Br = tones('#7a4a2a');
    t.rect(7, G - 18, 2, 19, GR[3]); t.vline(8, G - 18, 19, GR[2]);
    leaf(t, 7, G - 5, 1, G - 10, 2.6, GR, true); leaf(t, 9, G - 8, 14, G - 12, 2.6, GR, true); leaf(t, 7, G - 1, 3, G - 3, 1.5, GD);
    const cy = G - 21;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; t.line(8 + Math.cos(a) * 2.5 - 0.5, cy + Math.sin(a) * 2.5 - 0.5, 8 + Math.cos(a) * 6 - 0.5, cy + Math.sin(a) * 6 - 0.5, i % 2 ? Y[3] : Y[4]); }
    for (let i = 0; i < 12; i++) { const a = ((i + 0.5) / 12) * Math.PI * 2; t.px(8 + Math.cos(a) * 4.6 - 0.5, cy + Math.sin(a) * 4.6 - 0.5, i > 1 && i < 8 ? Y[2] : Y[5]); }
    orb(t, 8, cy, 3, 3, Br); t.px(7, cy - 2, Br[5]); t.px(8, cy, Br[1]); t.px(6, cy, Br[4]); t.px(9, cy - 1, Br[1]); t.px(7, cy + 1, Br[1]);
  },
  'Fairy Rose'(t, G) {
    bush(t, 8, G - 5, 6, 5, GD, 7, 0.3);
    t.vline(8, G - 13, 6, GD[2]);
    S(t, 6, G - 17, ROSE, mk('#f27ab0')); S(t, 1, G - 10, ROSE, mk('#f59ac4')); S(t, 10, G - 9, ROSE, mk('#e85a9a'));
  },
  'Sweet Pea'(t, G) {
    const T = tones('#6ab86a');
    curve(t, 8, G, 2, G - 6, 6, G - 12, T[2]); curve(t, 6, G - 12, 12, G - 16, 7, G - 21, T[2]); curve(t, 8, G, 14, G - 4, 12, G - 9, T[2]);
    curve(t, 7, G - 21, 4, G - 24, 6, G - 25, T[4]); t.px(13, G - 11, T[4]); t.px(14, G - 12, T[4]);
    for (const [lx, ly] of [[3, 5], [12, 4], [9, 9], [4, 15], [11, 18]]) orb(t, lx + 0.5, G - ly, 1.6, 1.2, T);
    S(t, 1, G - 12, PEA, mk('#f08ac8', '#b05ad0')); S(t, 9, G - 15, PEA, mk('#f4b0d8', '#d05a9a')); S(t, 5, G - 22, PEA, mk('#c890f0', '#8a5ad0')); S(t, 11, G - 9, ['ed', 'xc'], mk('#f08ac8', '#b05ad0'));
  },
  Crocus(t, G) {
    const T = tones('#4f9a5a');
    for (const [ex, ey] of [[2, 6], [5, 9], [9, 10], [12, 7], [14, 4], [7, 5]]) { t.line(8, G, ex, G - ey, T[3]); t.px(ex, G - ey, T[5]); }
    S(t, 2, G - 12, CROCUS, mk('#9a5ae0')); S(t, 8, G - 14, CROCUS, mk('#b47af0')); S(t, 11, G - 9, CROCUS, mk('#8048c8'));
    t.vline(4, G - 8, 5, T[2]); t.vline(10, G - 10, 7, T[2]); t.vline(12, G - 5, 4, T[2]);
  },
  Melon(t, G) { groundFruit(t, G, '#f08a9a', '#f8c0c4', GR, 'stripe'); },
  Pumpkin(t, G) { groundFruit(t, G, '#f08a1e', '#c8601a', GD, 'rib'); },
  Powdermelon(t, G) { groundFruit(t, G, '#f6dce4', '#ffffff', tones('#6aa8a0'), 'powder'); },
  'Summer Squash'(t, G) {
    const Y = tones('#f4cc3a');
    bush(t, 4, G - 9, 3.5, 3.5, GR, 1, 0.3); bush(t, 11.5, G - 10, 4, 4, GR, 2, 0.3); bush(t, 8, G - 13, 3.5, 3, GL, 3, 0.3);
    t.vline(5, G - 6, 6, GR[2]); t.vline(11, G - 6, 6, GR[2]);
    leaf(t, 2, G - 4, 13, G, 2.8, Y); t.px(4, G - 4, Y[5]); t.px(1, G - 5, GD[3]); t.px(2, G - 5, GD[3]);
    S(t, 6, G - 9, ['.e.e.', 'eexdd', '.ddc.'], mk('#f8b02a', '#e8781a'));
  },
  Tomato(t, G) {
    t.vline(8, G - 23, 24, WOOD[3]); t.vline(9, G - 23, 24, WOOD[2]); t.px(8, G - 23, WOOD[5]);
    bush(t, 8, G - 7, 6, 5.5, GR, 1); bush(t, 8, G - 15, 4.5, 4.5, GR, 2);
    const R = tones('#e83a2e');
    for (const [fx, fy] of [[4, 5], [11, 8], [7, 11], [10, 16], [5, 15]]) { orb(t, fx + 1, G - fy, 2, 2, R, true); t.px(fx, G - fy - 2, GD[3]); t.px(fx + 1, G - fy - 2, GD[2]); }
  },
  Blueberry(t, G) {
    t.vline(8, G - 3, 4, BARK[2]);
    bush(t, 8, G - 9, 6.5, 6.5, GD, 9);
    const B = tones('#4a62d8');
    for (const [fx, fy] of [[3, 9], [6, 5], [10, 7], [12, 11], [7, 12], [10, 14], [4, 13]]) { t.rect(fx, G - fy, 2, 2, B[3]); t.px(fx, G - fy, B[5]); t.px(fx + 1, G - fy + 1, B[1]); }
  },
  'Hot Pepper'(t, G) {
    t.vline(8, G - 5, 6, GR[1]);
    bush(t, 8, G - 11, 6, 5.5, GR, 5);
    const p = mk('#e62e2a', '#f2c53d', GD[3]);
    S(t, 3, G - 9, PEPPER, p); S(t, 7, G - 8, PEPPER, p, true); S(t, 11, G - 10, PEPPER, p); S(t, 5, G - 14, PEPPER, mk('#f0a02a', '#f2c53d', GD[3]));
  },
  Cranberries(t, G) {
    bush(t, 8, G - 4, 6.5, 4.5, tones('#2f7f4a'), 3, 0.3);
    const R = tones('#d8284a');
    for (const [fx, fy] of [[2, 3], [4, 6], [6, 2], [7, 7], [9, 4], [11, 6], [12, 2], [13, 4], [5, 4], [9, 8]]) { t.px(fx, G - fy, R[3]); t.px(fx, G - fy - 1, R[5]); t.px(fx + 1, G - fy, R[2]); }
  },
  'Coffee Plant'(t, G) {
    t.vline(8, G - 20, 21, BARK[3]); t.vline(7, G - 12, 13, BARK[4]);
    const R = tones('#d8343a');
    for (const [ly, sp] of [[4, 6], [9, 6], [14, 5], [19, 4]]) {
      leaf(t, 7, G - ly, 8 - sp, G - ly - 3, 1.7, GD, true); leaf(t, 9, G - ly, 8 + sp, G - ly - 3, 1.7, GD, true);
      t.px(6, G - ly + 1, R[3]); t.px(6, G - ly, R[5]); t.px(10, G - ly + 1, R[3]); t.px(10, G - ly, R[4]); t.px(9, G - ly + 2, R[2]);
    }
    leaf(t, 8, G - 20, 8, G - 25, 1.7, GD, true);
  },
  Eggplant(t, G) {
    t.vline(8, G - 4, 5, GR[1]);
    bush(t, 8, G - 11, 6, 6, GR, 8);
    const p = mk('#6a3aa0', '#f2c53d', GL[3]);
    S(t, 2, G - 9, EGGPLANT, p); S(t, 7, G - 8, EGGPLANT, p); S(t, 11, G - 11, EGGPLANT, p, true);
  },
  Strawberry(t, G) {
    for (const [lx, ly] of [[3, 6], [8, 8], [12, 6], [5, 3], [11, 3]]) { orb(t, lx + 0.5, G - ly, 2.5, 2.2, GR); t.px(lx, G - ly, GR[1]); }
    const p = mk('#e8283a', '#f2c53d', GD[3]);
    S(t, 1, G - 3, BERRY, p); S(t, 6, G - 4, BERRY, p); S(t, 11, G - 3, BERRY, p);
    t.px(9, G - 10, WHITE); t.px(10, G - 11, WHITE); t.px(10, G - 9, WHITE); t.px(11, G - 10, WHITE); t.px(10, G - 10, hex('#ffd84a'));
  },
  Starfruit(t, G) {
    t.rect(7, G - 8, 2, 9, GR[2]);
    leaf(t, 7, G - 2, 1, G - 6, 2.2, GR, true); leaf(t, 9, G - 2, 14, G - 6, 2.2, GR, true); leaf(t, 7, G - 6, 2, G - 11, 2, GL, true); leaf(t, 9, G - 6, 13, G - 11, 2, GL, true);
    S(t, 4, G - 17, STAR, mk('#f4d02a'));
  },
  'Ancient Fruit'(t, G) {
    const T = tones('#3fa890'), B = tones('#3f8ae8');
    curve(t, 8, G, 2, G - 4, 3, G - 10, T[2]); curve(t, 3, G - 10, 3, G - 14, 6, G - 13, T[4]);
    curve(t, 8, G, 14, G - 5, 12, G - 12, T[2]); curve(t, 12, G - 12, 11, G - 16, 9, G - 14, T[4]);
    t.vline(8, G - 12, 13, T[3]);
    leaf(t, 8, G - 2, 3, G - 5, 1.8, T); leaf(t, 8, G - 2, 13, G - 6, 1.8, T); leaf(t, 8, G - 8, 5, G - 12, 1.5, T); leaf(t, 8, G - 8, 11, G - 11, 1.5, T);
    orb(t, 8.5, G - 16, 3.5, 3.5, B, true); curve(t, 6, G - 15, 8, G - 17, 10, G - 15, B[5]); t.px(8, G - 20, T[3]); t.px(9, G - 20, T[4]);
    orb(t, 4, G - 7, 1.6, 1.6, B, true); orb(t, 13, G - 8, 1.6, 1.6, B, true);
  },
  'Sweet Gem Berry'(t, G) {
    const T = tones('#8a3a5a');
    t.rect(7, G - 9, 2, 10, tones('#6a8a4a')[3]); t.vline(8, G - 9, 10, tones('#6a8a4a')[1]);
    leaf(t, 7, G - 1, 1, G - 5, 2.4, T, true); leaf(t, 9, G - 1, 14, G - 5, 2.4, T, true); leaf(t, 7, G - 6, 2, G - 10, 2, T, true); leaf(t, 9, G - 6, 13, G - 10, 2, T, true);
    S(t, 4, G - 18, GEM, mk('#e83a9a'));
    t.px(2, G - 16, WHITE); t.px(13, G - 14, WHITE);
  },
  'Qi Fruit'(t, G) {
    const T = tones('#6a5ab0'), Q = tones('#4fd0c0');
    leaf(t, 7, G, 1, G - 7, 2.2, T, true); leaf(t, 9, G, 14, G - 7, 2.2, T, true); leaf(t, 7, G - 1, 4, G - 12, 1.8, T); leaf(t, 9, G - 1, 12, G - 12, 1.8, T);
    orb(t, 8, G - 8, 3.5, 5.5, Q, true); t.px(9, G - 6, Q[5]); t.px(7, G - 4, Q[5]); t.px(9, G - 10, Q[5]); t.px(6, G - 8, WHITE);
    t.px(8, G - 14, T[2]); t.px(8, G - 15, T[3]); t.px(3, G - 15, hex('#b8fff0')); t.px(13, G - 15, hex('#b8fff0')); t.px(12, G - 17, hex('#b8fff0'));
  },
  'Cactus Fruit'(t, G) {
    const C = tones('#4f9f5a'), F = tones('#f04a8a');
    const col = (x0: number, y0: number, y1: number) => { t.rect(x0, y0 + 1, 4, y1 - y0, C[3]); t.hline(x0 + 1, y0, 2, C[4]); t.vline(x0, y0 + 1, y1 - y0, C[4]); t.vline(x0 + 3, y0 + 1, y1 - y0, C[1]); t.vline(x0 + 2, y0 + 1, y1 - y0, C[2]); for (let yy = y0 + 2; yy < y1; yy += 3) t.px(x0 + 1, yy, C[5]); };
    t.hline(3, G - 7, 4, C[2]); t.hline(9, G - 10, 4, C[2]); t.hline(3, G - 8, 4, C[3]); t.hline(9, G - 11, 4, C[3]);
    col(1, G - 14, G - 7); col(11, G - 17, G - 10); col(6, G - 20, G);
    orb(t, 8, G - 22, 2, 2, F, true); orb(t, 3, G - 16, 1.6, 1.6, F, true); orb(t, 13, G - 19, 1.6, 1.6, F, true);
  },
  Pineapple(t, G) {
    const T = tones('#3f8f6a'), Y = tones('#e8a82a');
    for (const [ex, ey] of [[1, 5], [14, 5], [2, 10], [13, 10], [4, 2], [12, 2]]) leaf(t, 8, G, ex, G - ey, 1.5, T, true);
    orb(t, 8, G - 8, 3.5, 5, Y);
    for (let yy = G - 12; yy <= G - 4; yy++) for (let xx = 5; xx <= 10; xx++) if ((xx + yy) % 3 === 0 && t.alpha(xx, yy)) t.px(xx, yy, (xx + yy) % 2 ? Y[1] : Y[5]);
    for (const [ex, ey] of [[5, 17], [11, 17], [8, 20], [6, 19], [10, 19]]) leaf(t, 8, G - 12, ex, G - ey, 1.2, GL);
  },
  Hops(t, G) {
    trellisFrame(t, G); vineCover(t, G, GL, 1);
    const p = mk('#c8d85a');
    for (const [fx, fy] of [[2, 10], [9, 9], [5, 16], [11, 18], [7, 23], [3, 22]]) S(t, fx, G - fy, CONE, p);
  },
  Grape(t, G) {
    trellisFrame(t, G); vineCover(t, G, GR, 2);
    const p = mk('#7a3fb0');
    S(t, 2, G - 12, GRAPES, p); S(t, 9, G - 18, GRAPES, p, true); S(t, 8, G - 8, GRAPES, mk('#8f4fc0')); S(t, 3, G - 22, ['edc', 'dfc', '.c.'], p);
  },
  'Green Bean'(t, G) {
    trellisFrame(t, G); vineCover(t, G, GR, 3);
    const B = tones('#a4dc58');
    for (const [fx, fy, l, bend] of [[4, 13, 7, 1], [9, 11, 8, -1], [6, 23, 7, 1], [11, 22, 6, -1]]) {
      t.rect(fx - 1, G - fy - 1, 3, l + 2, GD[1]);
      t.vline(fx, G - fy, l, B[3]); t.px(fx, G - fy, B[5]); t.px(fx, G - fy + 1, B[4]);
      for (let i = 3; i < l; i += 2) t.px(fx, G - fy + i, B[2]);
      t.px(fx + bend, G - fy + l, B[2]); t.px(fx + bend, G - fy + l + 1, GD[1]);
    }
    t.px(3, G - 16, WHITE); t.px(12, G - 13, WHITE); t.px(8, G - 25, WHITE);
  },
  Corn(t, G) {
    const T = tones('#5fb040'), Y = tones('#f4cc3a');
    t.rect(7, G - 24, 2, 25, T[3]); t.vline(8, G - 24, 25, T[2]);
    curve(t, 7, G - 4, 2, G - 10, 1, G - 3, T[3]); curve(t, 7, G - 5, 3, G - 11, 2, G - 4, T[4]);
    curve(t, 9, G - 6, 14, G - 13, 14, G - 6, T[3]); curve(t, 9, G - 7, 13, G - 13, 13, G - 7, T[2]);
    curve(t, 7, G - 13, 2, G - 21, 1, G - 14, T[3]); curve(t, 7, G - 14, 3, G - 21, 2, G - 15, T[4]);
    curve(t, 9, G - 16, 14, G - 23, 14, G - 17, T[3]); curve(t, 9, G - 17, 13, G - 23, 13, G - 18, T[2]);
    S(t, 9, G - 15, ['.Wy.', '.de3', 'ede3', 'edc3', 'ede2', '3dc2', '332.'], mk('#f4cc3a', '#f4e8a0', T[3]));
    S(t, 4, G - 11, ['.W.', '3ed', '3de', '3dc', '23c', '.2.'], mk('#f4cc3a', '#f4e8a0', T[3]));
    t.vline(8, G - 28, 4, Y[2]); t.line(7, G - 25, 5, G - 28, Y[3]); t.line(9, G - 25, 11, G - 28, Y[3]); t.px(6, G - 26, Y[5]);
  },
  Wheat(t, G) {
    const Y = tones('#e2b040'), T = tones('#b8b84a');
    const ear = ['.e.', 'ede', 'dec', 'ede', 'dec', 'edc', '.d.'];
    const p = mk('#e2b040');
    for (const [sx, top, lean] of [[3, 18, -1], [6, 23, 0], [9, 21, 0], [12, 17, 1], [8, 14, 0]]) {
      t.line(sx - lean * 2 + (sx < 8 ? 1 : -1), G, sx, G - top + 6, Y[2]);
      S(t, sx - 1, G - top, ear, p);
      t.px(sx, G - top - 1, Y[5]); t.px(sx - 1, G - top - 2, Y[4]); t.px(sx + 1, G - top - 2, Y[4]);
    }
    for (const [ex, ey] of [[1, 7], [14, 6], [5, 9], [11, 8]]) curve(t, 8, G, (8 + ex) / 2, G - ey - 1, ex, G - ey + 2, T[3]);
  },
  Amaranth(t, G) {
    const R = tones('#b82a5a'), T = tones('#5a8a3a');
    t.rect(7, G - 16, 2, 17, R[2]); t.vline(7, G - 16, 17, R[3]);
    leaf(t, 7, G - 3, 1, G - 8, 2.2, T, true); leaf(t, 9, G - 5, 14, G - 10, 2.2, T, true); leaf(t, 7, G - 9, 2, G - 14, 2, T, true); leaf(t, 9, G - 11, 13, G - 16, 2, T, true);
    for (const [fx, fy, r] of [[8, 19, 2.6], [8, 22.5, 2.3], [8, 25.5, 1.8], [8.5, 27.5, 1.2], [4.5, 18, 1.8], [3.5, 15.5, 1.4], [11.5, 19, 1.8], [12.5, 16.5, 1.4]]) bush(t, fx, G - fy, r, r, R, 4, 0.6);
  },
  'Unmilled Rice'(t, G) {
    const T = tones('#6cba43'), Y = tones('#e8bc3a');
    const stalk = (sx: number, top: number, dir: number) => {
      t.vline(sx, G - top, top + 1, T[3]); t.px(sx, G - top + 4, T[5]); t.px(sx, G - 2, T[2]);
      t.line(sx, G - 4, sx - dir * 2, G - 9, T[4]); t.px(sx - dir * 2, G - 10, T[5]);
      const pts: [number, number][] = [[1, -1], [2, -1], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4]];
      pts.forEach(([ox, oy], i) => { const xx = sx + dir * ox, yy = G - top + oy; t.px(xx, yy, i < 2 ? T[4] : Y[3]); if (i >= 2) { t.px(xx + dir, yy + 1, i % 2 ? Y[5] : Y[4]); t.px(xx, yy + 1, Y[2]); } });
    };
    stalk(4, 14, -1); stalk(11, 15, 1); stalk(7, 22, 1);
  },
  'Fiber Plant'(t, G) {
    const T = tones('#8fb04a'), D = tones('#6a9a3a');
    for (const [ex, ey, m] of [[1, 6, 2], [3, 11, 4], [6, 14, 6], [9, 15, 9], [12, 12, 12], [14, 7, 13], [5, 6, 6], [10, 7, 10]]) curve(t, 8, G, m, G - ey / 2 - 2, ex, G - ey, ex % 2 ? T[3] : D[3]);
    for (const [ex, ey] of [[3, 11], [9, 15], [12, 12]]) { t.px(ex, G - ey, hex('#e8d8a0')); t.px(ex, G - ey - 1, hex('#f4ecc8')); t.px(ex + 1, G - ey, hex('#c8b070')); }
    t.px(6, G - 14, T[5]);
  },
  'Mixed Crop'(t, G) {
    flowerStem(t, 3, G, 7); S(t, 1, G - 11, TULIP, mk('#e8455e')); leaf(t, 3, G, 5, G - 4, 1.2, GR);
    leaf(t, 8, G, 7, G - 12, 1.8, GL, true); leaf(t, 8, G, 10, G - 9, 1.6, GL, true);
    for (const ex of [11, 13, 14]) curve(t, 12, G - 2, ex, G - 6, ex, G - 8, tones('#5fb53c')[3]);
    orb(t, 12.5, G - 0.5, 2, 1.6, tones('#f08a24'), true);
    S(t, 6, G - 17, ['.ee.', 'eYdc', '.dc.'], mk('#5a8ae8'));
  },
  'Spring Seeds'(t, G) {
    for (const [ex, ey] of [[2, 8], [6, 11], [11, 10], [14, 6]]) leaf(t, 8, G, ex, G - ey, 1.3, GR);
    flowerStem(t, 5, G, 11); flowerStem(t, 11, G, 8);
    S(t, 3, G - 16, DAFF, mk('#f8e04a', '#f29a2a')); S(t, 9, G - 12, ['.ee.', 'eeed', 'eddc', '.dc.'], mk('#f4d030'));
    t.px(13, G - 13, WHITE); t.px(14, G - 15, WHITE);
  },
  'Summer Seeds'(t, G) {
    t.vline(8, G - 4, 5, BARK[2]);
    bush(t, 8, G - 9, 6, 5.5, GR, 11);
    const R = tones('#e8442e');
    for (const [fx, fy] of [[3, 8], [6, 12], [10, 7], [12, 11], [7, 6]]) { t.px(fx, G - fy, R[3]); t.px(fx + 1, G - fy, R[2]); t.px(fx, G - fy - 1, R[5]); t.px(fx + 1, G - fy - 1, R[3]); }
    S(t, 6, G - 18, PEA, mk('#f08ac8', '#b05ad0')); S(t, 10, G - 5, ['edc', 'dfc', '.c.'], mk('#7a3fb0'));
  },
  'Fall Seeds'(t, G) {
    const T = tones('#c8782a');
    curve(t, 9, G, 12, G - 8, 9, G - 14, BARK[2]);
    for (const [lx, ly] of [[12, 5], [9, 9], [13, 11], [10, 15]]) orb(t, lx, G - ly, 2.4, 2, ly % 2 ? T : tones('#d8a02a'));
    for (const [fx, fy] of [[10, 6], [12, 9], [9, 12]]) { t.rect(fx, G - fy, 2, 2, hex('#3a2a5a')); t.px(fx, G - fy, hex('#8a7ac0')); }
    S(t, 1, G - 6, ['.eeed.', 'eeYddc', 'edddYc', '.bccb.', '..WW..', '..Wy..', '..WW..'], mk('#b8562a', '#d8c8a8'));
    orb(t, 6.5, G - 0.5, 1.6, 1.5, tones('#a8703a'), true);
  },
  'Winter Seeds'(t, G) {
    const T = tones('#6aa8a8'), I = tones('#7ac8f0');
    leaf(t, 7, G, 2, G - 6, 1.8, T, true); leaf(t, 9, G, 14, G - 6, 1.8, T, true); t.vline(8, G - 9, 10, T[2]);
    S(t, 5, G - 17, ['..f..', '.fee.', 'feedd', 'eeddc', '.edc.', '.dcc.', '..c..'], mk('#7ac8f0'));
    S(t, 11, G - 9, CROCUS, mk('#9a5ae0')); t.vline(12, G - 5, 5, T[2]);
    orb(t, 3.5, G - 0.5, 2.5, 1.5, SNOW); t.px(2, G - 12, WHITE); t.px(13, G - 14, WHITE); t.px(4, G - 15, I[5]);
  },
};

function groundFruit(t: Img, G: number, col: string, second: string, L: Tones, style: 'stripe' | 'rib' | 'powder') {
  const F = tones(col), S2 = hex(second);
  curve(t, 8, G - 8, 4, G - 12, 3, G - 9, L[2]); curve(t, 8, G - 8, 11, G - 13, 13, G - 10, L[2]);
  orb(t, 3.5, G - 10, 3, 2.6, L); t.hline(2, G - 10, 3, L[5]); orb(t, 12.5, G - 11, 3, 2.6, L); t.hline(11, G - 11, 3, L[5]);
  curve(t, 8, G - 9, 7, G - 15, 9, G - 16, L[4]); t.px(10, G - 15, L[4]);
  const cy = G - 4, rx = style === 'rib' ? 6.5 : 6, ry = style === 'rib' ? 4.5 : 5;
  orb(t, 8, cy, rx, ry, F, true);
  if (style === 'stripe') meridians(t, 8, cy, rx, ry, [-0.6, -0.1, 0.4, 0.8], (k) => (k > 0.2 ? F[1] : S2));
  if (style === 'rib') { meridians(t, 8, cy, rx, ry, [-0.55, 0.05, 0.6], (k) => (k < 0 ? F[2] : F[1])); t.rect(7, G - 10, 2, 2, hex('#6a7a2a')); t.px(7, G - 11, hex('#9aaa4a')); t.px(4, cy - 2, F[5]); }
  if (style === 'powder') { for (let yy = cy - 5; yy <= cy + 4; yy++) for (let xx = 2; xx <= 13; xx++) if (t.alpha(xx, yy) && hash(xx, yy, 5) < 0.18) t.px(xx, yy, WHITE); t.px(8, G - 10, L[2]); t.hline(6, cy - 5, 4, WHITE); }
  leaf(t, 2, G, 1, G - 4, 1.4, L); leaf(t, 13, G, 14, G - 4, 1.4, L);
}

const cropPainter: Painter = (img, x, y, w, h, c) => {
  const G = h - 2;
  const draw = CROPS[c.name];
  if (c.name === 'Unmilled Rice') { img.ellipse(x + 8, y + h - 2.5, 6.5, 2, hex('#4a8ad0')); img.hline(x + 4, y + h - 4, 3, hex('#9ac8f0')); }
  else mound(img, x + 8, y + h, /Hops|Grape|Green Bean/.test(c.name) ? 6.5 : 5);
  layer(img, x, y, w, h, (t) => {
    if (draw) draw(t, G, c);
    else { t.vline(8, G - 4, 5, GR[1]); bush(t, 8, G - 9, 6, 6, GR, 1); const F = tones(c.base); for (const [fx, fy] of [[4, 8], [10, 6], [8, 12]]) orb(t, fx, G - fy, 1.6, 1.6, F, true); }
  });
};

const teabush: Painter = (img, x, y, w, h) => {
  const G = h - 2;
  img.ellipse(x + 8, y + h - 2, 7, 2, SHADOW);
  layer(img, x, y, w, h, (t) => {
    const T = tones('#3f9a52');
    t.rect(7, G - 3, 2, 4, BARK[2]); t.px(5, G - 2, BARK[2]); t.px(10, G - 2, BARK[2]);
    bush(t, 4.5, G - 8, 3.5, 4, T, 1); bush(t, 11.5, G - 8, 3.5, 4, T, 2); bush(t, 8, G - 11, 5, 5, T, 3); bush(t, 8, G - 6, 5.5, 3.5, T, 4);
    for (const [lx, ly] of [[4, 13], [8, 17], [12, 13], [6, 16], [10, 15]]) { t.px(lx, G - ly, hex('#b8e86a')); t.px(lx + 1, G - ly - 1, hex('#d8f08a')); t.px(lx - 1, G - ly - 1, hex('#9ad85a')); }
  });
};

const trellis: Painter = (img, x, y, w, h) => {
  const G = h - 2;
  img.ellipse(x + 8, y + h - 2, 7, 1.5, SHADOW);
  layer(img, x, y, w, h, (t) => {
    trellisFrame(t, G, 25);
    t.line(3, G - 4, 7, G - 9, WOOD[2]); t.line(8, G - 9, 12, G - 4, WOOD[2]); t.line(3, G - 12, 7, G - 17, WOOD[2]); t.line(8, G - 17, 12, G - 12, WOOD[2]);
    t.px(2, G - 25, WOOD[5]); t.px(13, G - 25, WOOD[5]);
    curve(t, 3, G, 5, G - 3, 4, G - 6, GR[3]); t.px(5, G - 5, GR[4]); t.px(3, G - 3, GR[4]);
  });
};

// ------------------------------------------------------------------ giant crops

/** Big shaded ball with dithered tone steps and a soft highlight. */
function sphere(t: Img, cx: number, cy: number, rx: number, ry: number, T: Tones) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const v = dx * 0.55 + dy * 0.8 + (hash(x, y, 77) - 0.5) * 0.07;
      let col = v < -0.5 ? T[4] : v < 0.12 ? T[3] : v < 0.55 ? T[2] : T[1];
      if (d2 > 0.86 && v > 0.5) col = T[2];
      t.px(x, y, col);
    }
  }
  t.ellipse(cx - rx * 0.42, cy - ry * 0.48, Math.max(1.5, rx * 0.14), Math.max(1, ry * 0.09), T[5]);
}

/** Curved lines from pole to pole of a ball. */
function meridians(t: Img, cx: number, cy: number, rx: number, ry: number, ks: number[], col: (k: number) => RGBA, wide = 1) {
  for (const k of ks) for (let yy = -ry + 1; yy < ry - 1; yy++) {
    const xx = Math.round(cx + k * rx * Math.sqrt(Math.max(0, 1 - (yy / ry) ** 2)) - 0.5);
    for (let o = 0; o < wide; o++) if (t.alpha(xx + o, Math.round(cy + yy))) t.px(xx + o, Math.round(cy + yy), col(k));
  }
}

const sparkle = (t: Img, x: number, y: number, c: RGBA) => { t.px(x, y, WHITE); t.px(x - 1, y, c); t.px(x + 1, y, c); t.px(x, y - 1, c); t.px(x, y + 1, c); };

const GIANTS: Record<string, Draw> = {
  'Giant Cauliflower'(t, G) {
    const L = tones('#3f9a6a'), W = tones('#f2ecd8');
    leaf(t, 18, G, 1, G - 36, 8, L, true); leaf(t, 30, G, 46, G - 36, 8, L, true);
    leaf(t, 24, G - 10, 10, G - 54, 7, tones(L[2]), true); leaf(t, 24, G - 10, 38, G - 54, 7, tones(L[2]), true);
    sphere(t, 24, G - 27, 19, 20, W);
    const bumps: [number, number, number][] = [[12, 38, 6], [24, 42, 7], [36, 37, 6], [9, 26, 6], [20, 30, 7], [31, 29, 7], [40, 24, 5], [14, 16, 6], [26, 17, 7], [36, 14, 5]];
    for (const [bx, by, r] of bumps) { orb(t, bx, G - by, r, r * 0.9, W); for (let i = 0; i < 5; i++) { const a = hash(bx, i, 3) * 6.28, d = hash(i, by, 4) * r * 0.6; t.px(bx + Math.cos(a) * d, G - by + Math.sin(a) * d * 0.9, i % 2 ? W[2] : W[5]); } }
    leaf(t, 22, G + 2, 4, G - 16, 6, L, true); leaf(t, 26, G + 2, 43, G - 16, 6, L, true); leaf(t, 24, G + 3, 24, G - 11, 5, tones('#4fb07a'), true);
  },
  'Giant Melon'(t, G) {
    const F = tones('#f08a9a');
    sphere(t, 24, G - 24, 21, 24, F);
    meridians(t, 24, G - 24, 21, 24, [-0.8, -0.45, -0.08, 0.3, 0.62, 0.86], (k) => (k < 0.2 ? hex('#fbd0d0') : F[1]), 2);
    t.rect(22, G - 52, 4, 5, hex('#6a8a3a')); t.vline(22, G - 52, 5, hex('#9ab85a')); t.hline(21, G - 53, 6, hex('#8aa84a'));
    leaf(t, 26, G - 50, 39, G - 57, 4, GR, true); curve(t, 22, G - 51, 14, G - 58, 10, G - 52, GR[2]); curve(t, 10, G - 52, 9, G - 48, 12, G - 49, GR[2]);
    leaf(t, 6, G, 0, G - 10, 3.5, GR, true); leaf(t, 42, G, 47, G - 10, 3.5, GR, true);
  },
  'Giant Pumpkin'(t, G) {
    const F = tones('#f08a1e'), D = tones('#d86a18');
    const cy = G - 21;
    orb(t, 7.5, cy, 6.5, 17, D); orb(t, 40.5, cy, 6.5, 17, tones(D[2]));
    sphere(t, 14, cy, 9, 20, F); sphere(t, 34, cy, 9, 20, D);
    sphere(t, 24, cy + 1, 10, 21, F);
    for (let yy = cy - 17; yy < cy + 19; yy++) { t.px(14 + Math.round(1.5 * Math.cos((yy - cy) / 13)), yy, F[1]); t.px(33 - Math.round(1.5 * Math.cos((yy - cy) / 13)), yy, D[1]); }
    const St = tones('#7a8a3a');
    S(t, 19, G - 54, ['....4443..', '...445432.', '...44332..', '...4332...', '...4332...', '..443322..', '.44433222.', '4443332221'], tonePal({ '012345': St[3] }));
    curve(t, 28, G - 46, 38, G - 56, 42, G - 48, GD[2]); curve(t, 42, G - 48, 44, G - 44, 40, G - 44, GD[3]);
    leaf(t, 18, G - 45, 5, G - 52, 4.5, GD, true);
    leaf(t, 5, G, 0, G - 8, 3, GD, true); leaf(t, 43, G, 47, G - 8, 3, GD, true);
  },
  'Giant Powdermelon'(t, G) {
    const F = tones('#f4d4de'), L = tones('#6aa8a0'); F[1] = hex('#c890b0'); F[2] = hex('#e4b4cc');
    sphere(t, 24, G - 23, 21, 23, F);
    meridians(t, 24, G - 23, 21, 23, [-0.7, -0.25, 0.25, 0.7], (k) => (k < 0 ? hex('#ffffff') : F[2]), 1);
    for (let y = G - 46; y <= G; y++) for (let x = 3; x <= 45; x++) if (t.alpha(x, y) && hash(x, y, 9) < 0.035) { t.px(x, y, WHITE); if (hash(y, x, 2) < 0.4) t.px(x + 1, y, WHITE); }
    t.ellipse(24, G - 46, 9, 2.5, SNOW[4]); t.ellipse(22, G - 47, 6, 1.5, WHITE);
    t.rect(23, G - 51, 3, 4, L[2]); t.vline(23, G - 51, 4, L[4]);
    leaf(t, 26, G - 49, 38, G - 55, 3.5, L, true); leaf(t, 6, G, 0, G - 9, 3.2, L, true); leaf(t, 42, G, 47, G - 9, 3.2, L, true);
    sparkle(t, 5, G - 44, hex('#bfe4ff')); sparkle(t, 43, G - 50, hex('#bfe4ff')); sparkle(t, 41, G - 12, hex('#ffffff'));
  },
  'Giant Qi Fruit'(t, G) {
    const Q = tones('#3fc8b8'), L = tones('#6a5ab0');
    leaf(t, 16, G - 2, 1, G - 24, 6, L, true); leaf(t, 32, G - 2, 46, G - 24, 6, L, true);
    sphere(t, 24, G - 28, 17, 28, Q);
    for (const [sx, sy, r] of [[16, 40, 2.5], [30, 44, 2], [33, 28, 3], [14, 22, 2], [24, 14, 2.5], [22, 32, 1.5], [34, 12, 1.5]]) { t.ellipse(sx, G - sy, r, r, Q[5]); t.px(sx, G - sy + r, Q[1]); }
    curve(t, 24, G - 56, 27, G - 61, 31, G - 58, L[3]); t.rect(23, G - 58, 2, 3, L[2]);
    leaf(t, 10, G + 1, 2, G - 9, 4, tones(L[4]), true); leaf(t, 38, G + 1, 46, G - 9, 4, tones(L[4]), true); leaf(t, 24, G + 2, 24, G - 10, 4, L, true);
    sparkle(t, 4, G - 50, hex('#9ffff0')); sparkle(t, 43, G - 44, hex('#9ffff0')); sparkle(t, 40, G - 60, hex('#9ffff0')); sparkle(t, 7, G - 32, hex('#d8c8ff'));
  },
};

const giantcrop: Painter = (img, x, y, w, h, c) => {
  img.ellipse(x + w / 2, y + h - 4, w / 2 - 2, 4, SHADOW);
  layer(img, x, y, w, h, (t) => { (GIANTS[c.name] ?? GIANTS['Giant Melon'])(t, h - 3, c); clip(t, h - 2); });
};

function clip(t: Img, maxY: number) {
  for (let y = maxY + 1; y < t.h; y++) for (let x = 0; x < t.w; x++) t.data[(y * t.w + x) * 4 + 3] = 0;
  for (let y = 0; y < t.h; y++) { t.data[(y * t.w) * 4 + 3] = 0; t.data[(y * t.w + t.w - 1) * 4 + 3] = 0; }
  for (let x = 0; x < t.w; x++) t.data[x * 4 + 3] = 0;
}

// ------------------------------------------------------------------ debris

const STONE = tones('#9a9aa8');

const DEBRIS: Record<string, Draw> = {
  'Large Rock'(t, G) {
    const T = STONE, M = tones('#5aa84a');
    orb(t, 9, G - 7, 8, 9, tones(T[2])); orb(t, 24, G - 8, 7, 10, tones(T[2]));
    sphere(t, 16, G - 13, 12, 15, T);
    t.ellipse(14, G - 23, 7, 3, T[4]); t.ellipse(12, G - 24, 4, 1.5, T[5]);
    t.line(20, G - 26, 23, G - 17, T[1]); t.line(23, G - 17, 21, G - 10, T[1]); t.line(23, G - 17, 27, G - 14, T[1]); t.line(21, G - 26, 24, G - 17, T[4]);
    t.line(7, G - 14, 11, G - 9, T[1]); t.line(11, G - 9, 10, G - 4, T[1]); t.line(8, G - 14, 12, G - 9, T[4]);
    t.ellipse(8, G - 18, 4, 2, M[3]); t.ellipse(7, G - 19, 2.5, 1, M[4]); t.px(11, G - 16, M[2]); t.px(5, G - 15, M[2]); t.px(26, G - 4, M[3]); t.px(27, G - 5, M[4]);
    orb(t, 4, G - 1, 2.5, 2, T, true); orb(t, 28, G - 1, 2, 1.6, T, true);
  },
  'Large Stump'(t, G) {
    const B = BARK, C = tones('#e2c088');
    for (let yy = G - 16; yy <= G; yy++) {
      const fl = G - yy < 5 ? (5 - (G - yy)) * 0.9 : 0, x0 = Math.round(6 - fl), x1 = Math.round(25 + fl);
      for (let xx = x0; xx <= x1; xx++) {
        const f = (xx - x0) / (x1 - x0); let col = f < 0.15 ? B[4] : f < 0.55 ? B[3] : f < 0.82 ? B[2] : B[1];
        const hs = hash(xx, Math.floor(yy / 4), 2); if (hs < 0.2 && f > 0.1) col = f < 0.55 ? B[2] : B[0]; else if (hs > 0.92 && f < 0.6) col = B[4];
        t.px(xx, yy, col);
      }
    }
    orb(t, 3, G - 1, 3, 2, B); orb(t, 29, G - 1, 3, 2, tones(B[2])); orb(t, 13, G, 3, 1.6, B);
    t.ellipse(16, G - 17, 10.5, 5.5, B[2]); t.ellipse(16, G - 17.5, 9.5, 4.5, C[3]); t.ellipse(15, G - 18, 8, 3.5, C[4]);
    for (const [rx, ry] of [[6.5, 2.8], [3.5, 1.5]]) for (let a = 0; a < 40; a++) { const an = (a / 40) * 6.283; if (hash(a, rx * 10, 1) < 0.8) t.px(15.5 + Math.cos(an) * rx - 0.5, G - 17.5 + Math.sin(an) * ry - 0.5, C[2]); }
    t.px(15, G - 18, C[1]); t.line(20, G - 17, 24, G - 16, C[1]); t.px(9, G - 20, C[5]); t.px(10, G - 21, C[5]);
    S(t, 22, G - 9, ['.ee..', 'eYdd.', 'edddc', '..W..', '..W..'], mk('#d8482a'));
    curve(t, 7, G - 21, 4, G - 26, 3, G - 23, GR[3]); leaf(t, 5, G - 25, 2, G - 28, 1.6, GL, true); leaf(t, 6, G - 23, 9, G - 27, 1.4, GR);
    t.ellipse(8, G - 9, 2.5, 1.5, tones('#5aa84a')[3]); t.px(7, G - 10, tones('#5aa84a')[4]);
  },
  'Large Log'(t, G) {
    const B = BARK, C = tones('#e2c088'), M = tones('#5aa84a');
    const top = G - 15;
    for (let yy = top; yy <= G; yy++) for (let xx = 6; xx <= 29; xx++) {
      const f = (yy - top) / 15, rr = Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2));
      if (xx > 26 + rr * 3) continue;
      let col = f < 0.14 ? B[4] : f < 0.5 ? B[3] : f < 0.8 ? B[2] : B[1];
      const hs = hash(Math.floor(xx / 4), yy, 3); if (hs < 0.22 && f > 0.1) col = f < 0.5 ? B[2] : B[0]; else if (hs > 0.92 && f < 0.5) col = B[5];
      t.px(xx, yy, col);
    }
    t.ellipse(7, G - 7, 5, 8, B[1]); t.ellipse(6.5, G - 7.5, 4.2, 7, C[3]); t.ellipse(6, G - 8, 3.2, 5.5, C[4]);
    for (let a = 0; a < 30; a++) { const an = (a / 30) * 6.283; if (hash(a, 1, 7) < 0.8) t.px(6 + Math.cos(an) * 2 - 0.5, G - 7.5 + Math.sin(an) * 3.8 - 0.5, C[2]); }
    t.px(5, G - 8, C[1]); t.px(6, G - 8, C[1]);
    t.rect(18, top - 4, 5, 5, B[3]); t.vline(18, top - 4, 5, B[4]); t.vline(22, top - 4, 5, B[1]); t.ellipse(20.5, top - 4, 2.5, 1.5, C[3]); t.px(20, top - 4, C[1]);
    t.ellipse(13, top + 1, 4, 2, M[3]); t.ellipse(12, top, 2.5, 1, M[4]); t.px(16, top + 3, M[2]); t.px(10, top + 3, M[2]); t.px(26, top + 1, M[3]); t.px(27, top + 2, M[2]);
    t.ellipse(22, G - 7, 2, 1.5, B[0]); t.px(22, G - 8, B[2]);
    S(t, 24, G - 4, ['.ee.', 'eYdc', '.W..', '.W..'], mk('#e0a03a'));
  },
  Meteorite(t, G) {
    const T = tones('#6a5078'), Hot = hex('#ff8a3a'), Yl = hex('#ffe070');
    orb(t, 8, G - 7, 7, 8, tones(T[2])); orb(t, 25, G - 6, 6, 7, tones(T[2]));
    sphere(t, 16, G - 13, 12.5, 14, T);
    orb(t, 20, G - 25, 4, 3, T); orb(t, 9, G - 22, 3.5, 3, T);
    for (const [cx, cy, r] of [[11, 14, 3], [21, 19, 2.5], [22, 7, 2], [7, 5, 1.6]]) { t.ellipse(cx, G - cy, r, r * 0.8, T[0]); t.ellipse(cx + 0.5, G - cy + 0.6, r - 0.8, r * 0.8 - 0.8, T[1]); t.px(cx + r - 1, G - cy + r * 0.8, T[4]); }
    const crack = (pts: number[]) => { for (let i = 0; i + 3 < pts.length; i += 2) t.line(pts[i], G - pts[i + 1], pts[i + 2], G - pts[i + 3], Hot); t.px(pts[2], G - pts[3], Yl); };
    crack([14, 26, 16, 21, 14, 18, 17, 14]); crack([16, 21, 19, 22]); crack([26, 12, 23, 13, 24, 9]); crack([5, 11, 8, 9, 7, 5]); crack([15, 6, 17, 3, 20, 4]);
    sparkle(t, 27, G - 24, Hot); sparkle(t, 4, G - 20, hex('#d090ff')); t.px(29, G - 17, Yl); t.px(2, G - 13, Yl);
  },
  'Stone Debris'(t, G) {
    S(t, 2, G - 8, ['....eee.....', '..eeffeed...', '.eefeedddc..', 'eeeedddcdcc.', 'eedddcddccb.', 'edddccdccbb.', '.dccccbbbb..', '..ccbbbb....'], tonePal({ abcdef: STONE[3] }));
    t.line(8, G - 7, 9, G - 4, STONE[1]); t.px(10, G - 3, STONE[1]); t.px(13, G, STONE[3]); t.px(14, G, STONE[2]);
  },
  Twig(t, G) {
    S(t, 1, G - 9, ['..........q...', '.q.......qp...', '..qp....qpo...', '...qp..qpo....', '....qpqpo.....', '.....qpo......', '....qpo.......', '..rqpo........', '.rqpo.........', 'qpo...........'], tonePal({ mnopqr: '#8a5a3a' }));
    leaf(t, 10, G - 9, 13, G - 11, 1.4, GR); leaf(t, 4, G - 7, 2, G - 10, 1.2, GL);
  },
  Weeds(t, G) {
    const T = tones('#4f9a3a'), D = tones('#3a7f3a');
    for (const [ex, ey, m] of [[2, 6, 3], [4, 10, 5], [7, 12, 7], [10, 11, 9], [13, 7, 12], [14, 3, 12]]) { curve(t, 8, G, m, G - ey / 2 - 1, ex, G - ey, ex % 2 ? D[3] : T[3]); curve(t, 8 + (ex < 8 ? -1 : 1), G, m + (ex < 8 ? -1 : 1), G - ey / 2, ex, G - ey + 1, ex % 2 ? D[2] : T[4]); }
    leaf(t, 7, G, 5, G - 5, 1.6, T, true); leaf(t, 9, G, 12, G - 4, 1.5, D);
    t.px(7, G - 13, hex('#f4ecc8')); t.px(4, G - 11, hex('#e8d8a0'));
  },
  Truffle(t, G) {
    S(t, 3, G - 7, ['...eed....', '.eefeddd..', 'eedydcedc.', 'edddccddcc', 'dcdydccdbb', 'dccccbcbb.', '.ccbbbbb..', '...bb.....'], tonePal({ abcdef: '#6a4a3a' }, { y: hex('#c8a070') }));
  },
};

const debris: Painter = (img, x, y, w, h, c) => {
  const big = c.tw > 1;
  if (c.name === 'Meteorite') img.ellipse(x + w / 2, y + h - 3, w / 2 - 1, 3.5, [40, 24, 30, 150]);
  else img.ellipse(x + w / 2, y + h - (big ? 3 : 2), big ? 14 : 6, big ? 3 : 1.5, SHADOW);
  layer(img, x, y, w, h, (t) => { DEBRIS[c.name]?.(t, h - (big ? 3 : 2), c); clip(t, h - (big ? 3 : 2)); });
};

// ------------------------------------------------------------------ trees

const darker = (T: Tones): Tones => [T[0], mix(T[0], T[1], 0.5), T[1], T[2], T[3], T[4]];

/** Tree crown built from leaf clumps, upper rows first so that lower clumps sit in front. */
function canopy(t: Img, cx: number, cy: number, rx: number, ry: number, T: Tones, seed: number, r = Math.max(5, Math.min(rx, ry) * 0.42)) {
  t.ellipse(cx, cy, rx - 2, ry - 2, T[1]);
  const D = darker(T);
  const rows = Math.max(2, Math.round((2 * ry) / (r * 1.1)));
  for (let k = 0; k < rows; k++) {
    const fy = -1 + (2 * k) / (rows - 1), yy = cy + fy * (ry - r * 0.85);
    const half = Math.sqrt(Math.max(0, 1 - fy * fy * 0.85)) * (rx - r * 0.8);
    const n = Math.max(1, Math.round((2 * half) / (r * 1.2)) + 1);
    for (let i = 0; i < n; i++) {
      const fx = n === 1 ? 0 : -1 + (2 * i) / (n - 1);
      const jx = (hash(i, k, seed) - 0.5) * 2.4, jy = (hash(k, i, seed + 3) - 0.5) * 2.4;
      const v = fx * 0.5 + fy * 0.7;
      bush(t, cx + fx * half + jx, yy + jy, r * (0.92 + hash(i, k, seed + 9) * 0.22), r * 0.86, v > 0.4 ? D : T, seed + k * 7 + i, 0.36);
    }
  }
}

function trunk(t: Img, cx: number, y0: number, y1: number, w0: number, w1: number, T: Tones, seed = 1, flare = 1.2) {
  for (let y = y0; y <= y1; y++) {
    const s = (y - y0) / (y1 - y0 || 1), fl = y1 - y;
    const wd = w0 + (w1 - w0) * s * s + (fl < 4 ? (4 - fl) * flare : 0);
    const xl = Math.round(cx - wd / 2), n = Math.max(2, Math.round(wd));
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      let col = f < 0.18 ? T[4] : f < 0.6 ? T[3] : f < 0.85 ? T[2] : T[1];
      const hs = hash(xl + i, Math.floor((y + (xl + i) * 2) / 4), seed);
      if (hs < 0.2 && f > 0.1 && f < 0.95) col = f < 0.5 ? T[2] : T[0]; else if (hs > 0.9 && f < 0.6 && f > 0.1) col = T[5];
      t.px(xl + i, y, col);
    }
  }
}

type LimbO = { spread: number; shrink: number; snow: number; droop?: number };

/** Bare branch that splits into smaller branches. Pass o = false for one plain branch. */
function limb(t: Img, x: number, y: number, ang: number, len: number, wd: number, T: Tones, depth: number, seed: number, o: LimbO | false) {
  const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
  for (let k = 0; k < wd; k++) t.line(x + k, y, x1 + k, y1, k === 0 ? (wd > 1 ? T[4] : T[3]) : k === wd - 1 ? T[2] : T[3]);
  if (depth > 0 && o) {
    const ks = depth > 1 ? [-1, 0.15, 1] : [-1, 1], out = Math.cos(ang) >= 0 ? 1 : -1;
    ks.forEach((k, i) => limb(t, x1, y1, ang + k * (o.spread + hash(i, depth, seed) * 0.3) + (o.droop ?? 0) * out, len * (o.shrink + hash(depth, i, seed) * 0.14), Math.max(1, wd - 1), T, depth - 1, seed + i * 13 + 1, o));
  }
  if (o && hash(depth, 7, seed) < o.snow && Math.abs(Math.cos(ang)) > 0.3) {
    const a = 0.2 + hash(depth, 5, seed) * 0.3;
    t.line(x + (x1 - x) * a, y + (y1 - y) * a - 1, x1, y1 - 1, SNOW[4]); t.px(x1, y1 - 2, WHITE);
    if (wd > 1) t.line(x + (x1 - x) * (a + 0.2), y + (y1 - y) * (a + 0.2) - 2, x1, y1 - 2, WHITE);
  }
}

/** Winter shape of one species: trunk, main limbs [angle from vertical, length, width] and twig rules. */
type Bare = { top: number; w0: number; w1: number; bark: string; limbs: [number, number, number][]; depth: number; o: LimbO; stems?: boolean; bands?: boolean; pile?: number };

function bareTree(t: Img, base: number, b: Bare, seed: number) {
  const T = tones(b.bark);
  if (!b.stems) trunk(t, 24, b.top, base, b.w0, b.w1, T, seed);
  if (b.bands) for (let y = b.top + 4; y < base - 4; y += 6) { t.hline(22, y, 3, T[5]); t.px(26, y + 3, T[1]); }
  b.limbs.forEach(([a, len, wd], i) => {
    const sx = b.stems ? 24 + Math.round(a * 5) : 24 - Math.floor(wd / 2) + Math.round(Math.max(-1, Math.min(1, a * 1.4)) * (b.w0 / 2 - 1));
    limb(t, sx, b.stems ? base : b.top + 2, -Math.PI / 2 + a, len, wd, T, b.depth, seed + i * 5, b.o);
  });
  const pile = b.pile ?? 9;
  t.ellipse(24, base, pile, 1.6, SNOW[4]); t.hline(24 - Math.round(pile * 0.6), base - 1, Math.round(pile * 0.6), WHITE);
}

const BARE: Record<string, Bare> = {
  'Oak Tree': { top: 52, w0: 9, w1: 11, bark: '#7f5a3c', limbs: [[-1.15, 17, 3], [-0.45, 20, 3], [0.35, 20, 3], [1.1, 17, 3]], depth: 2, o: { spread: 0.55, shrink: 0.6, snow: 0.95 }, pile: 12 },
  'Maple Tree': { top: 48, w0: 6, w1: 8, bark: '#8a6a5a', limbs: [[-0.5, 19, 2], [0, 22, 3], [0.5, 19, 2]], depth: 3, o: { spread: 0.4, shrink: 0.56, snow: 0.3 }, pile: 8 },
  'Apple Tree': { top: 50, w0: 7, w1: 9, bark: '#7a5238', limbs: [[-1.2, 13, 3], [-0.35, 13, 2], [0.55, 14, 3], [1.25, 12, 2]], depth: 2, o: { spread: 0.6, shrink: 0.58, snow: 0.85, droop: 0.15 }, pile: 11 },
  'Apricot Tree': { top: 52, w0: 5, w1: 6, bark: '#a0704a', limbs: [[-0.8, 21, 2], [-0.28, 24, 2], [0.28, 24, 2], [0.8, 21, 2]], depth: 1, o: { spread: 0.3, shrink: 0.5, snow: 0.5 }, pile: 8 },
  'Cherry Tree': { top: 46, w0: 5, w1: 7, bark: '#7a3a44', limbs: [[-0.4, 15, 2], [0, 18, 2], [0.4, 15, 2]], depth: 3, o: { spread: 0.42, shrink: 0.56, snow: 0.25 }, bands: true, pile: 8 },
  'Orange Tree': { top: 44, w0: 4, w1: 5, bark: '#8a6a4a', limbs: [[-1, 8, 2], [-0.35, 10, 2], [0.35, 10, 2], [1, 8, 2]], depth: 2, o: { spread: 0.75, shrink: 0.72, snow: 1 }, pile: 7 },
  'Peach Tree': { top: 54, w0: 6, w1: 7, bark: '#8a5a48', limbs: [[-1.0, 18, 3], [1.0, 18, 3], [-0.15, 11, 2]], depth: 2, o: { spread: 0.5, shrink: 0.6, snow: 0.7, droop: 0.35 }, pile: 10 },
  'Pomegranate Tree': { top: 70, w0: 3, w1: 3, bark: '#a88a64', limbs: [[-0.62, 27, 2], [-0.22, 31, 2], [0.2, 31, 2], [0.6, 27, 2]], depth: 2, o: { spread: 0.4, shrink: 0.42, snow: 0.5 }, stems: true, pile: 10 },
};

/** Winter mahogany: one straight leader with short side branches in tiers. */
function bareMahogany(t: Img, base: number) {
  const T = tones('#9a4a36');
  trunk(t, 24, 10, base, 2, 7, T, 21);
  let i = 0;
  for (let y = 76; y > 16; y -= 8, i++) {
    const left = i % 2 === 0, len = 5 + (y - 12) * 0.17;
    limb(t, left ? 22 : 25, y, left ? Math.PI + 0.5 : -0.5, len, y > 44 ? 2 : 1, T, 1, 40 + i, { spread: 0.45, shrink: 0.5, snow: i % 3 === 1 ? 0 : 1 });
  }
  t.px(24, 8, T[3]); t.px(24, 9, T[3]); t.ellipse(24, base, 8, 1.6, SNOW[4]); t.hline(20, base - 1, 5, WHITE);
}

/** Feather frond along a curve: a spine with leaflets on both sides. */
function frond(t: Img, x0: number, y0: number, mx: number, my: number, x1: number, y1: number, T: Tones, L = 5) {
  const N = 44;
  let lx = x0, ly = y0;
  for (let i = 1; i <= N; i++) {
    const s = i / N, a = (1 - s) * (1 - s), b = 2 * s * (1 - s), cc = s * s;
    const X = a * x0 + b * mx + cc * x1, Y = a * y0 + b * my + cc * y1;
    const dx = X - lx, dy = Y - ly, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
    const ll = 1 + L * Math.pow(Math.sin(Math.PI * Math.min(1, s * 0.92 + 0.06)), 0.6);
    const up = ny < 0 ? 1 : -1;
    const l2 = Math.round(ll * (i % 4 === 3 ? 0.7 : 1));
    for (const o of [0, 0.5]) {
      t.line(X + o, Y, X + o + nx * up * l2 * 0.5, Y + ny * up * l2 * 0.5, T[4]);
      t.line(X + o, Y, X + o - nx * up * l2, Y - ny * up * l2, i % 4 === 3 ? T[1] : i % 4 === 1 ? T[3] : T[2]);
    }
    t.px(X, Y, T[5]);
    lx = X; ly = Y;
  }
}

/** Broad banana-style leaf along a curve, with a light midrib and torn edges. */
function paddle(t: Img, x0: number, y0: number, mx: number, my: number, x1: number, y1: number, wd: number, T: Tones) {
  const N = 40;
  let lx = x0, ly = y0;
  for (let i = 1; i <= N; i++) {
    const s = i / N, a = (1 - s) * (1 - s), b = 2 * s * (1 - s), cc = s * s;
    const X = a * x0 + b * mx + cc * x1, Y = a * y0 + b * my + cc * y1;
    const dx = X - lx, dy = Y - ly, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl, up = ny < 0 ? 1 : -1;
    const hw = wd * Math.pow(Math.sin(Math.PI * Math.min(1, s * 0.9 + 0.08)), 0.6), tear = i % 9 === 5 && s > 0.25;
    if (s > 0.12) {
      t.line(X, Y, X + nx * up * hw, Y + ny * up * hw, T[4]); t.line(X + 0.5, Y, X + 0.5 + nx * up * hw, Y + ny * up * hw, T[4]);
      const lo = tear ? hw * 0.35 : hw;
      t.line(X, Y, X - nx * up * lo, Y - ny * up * lo, i % 9 === 6 ? T[1] : T[2]); t.line(X + 0.5, Y, X + 0.5 - nx * up * lo, Y - ny * up * lo, T[2]);
    }
    t.px(X, Y, T[5]);
    lx = X; ly = Y;
  }
}

function fruitDot(t: Img, x: number, y: number, F: Tones, dark: RGBA, r = 2) {
  t.ellipse(x, y, r + 1.05, r + 1.05, dark);
  orb(t, x, y, r, r, F, true);
}

type Sp = { leaf: Record<string, string>; bark: string; cy: number; rx: number; ry: number; top: number; w0: number; w1: number; r?: number };
const WILD: Record<string, Sp> = {
  'Oak Tree': { leaf: { spring: '#5cb548', summer: '#3f9a3c', fall: '#e08a2a' }, bark: '#8a5a3a', cy: 36, rx: 22, ry: 22, top: 50, w0: 8, w1: 10 },
  'Maple Tree': { leaf: { spring: '#74c44a', summer: '#4aa440', fall: '#d8402a' }, bark: '#7a5a48', cy: 37, rx: 18, ry: 27, top: 54, w0: 6, w1: 8, r: 7 },
  'Mahogany Tree': { leaf: { spring: '#3fa05a', summer: '#2f8a4c', fall: '#b89a2a' }, bark: '#9a4a36', cy: 30, rx: 13, ry: 25, top: 44, w0: 5, w1: 7, r: 6 },
};

function pine(t: Img, base: number, winter: boolean) {
  const T = tones(winter ? '#2f7462' : '#2f7f48');
  trunk(t, 24, base - 18, base, 5, 6, tones('#7a4f38'), 4);
  for (let i = 4; i >= 0; i--) {
    const apex = 4 + i * 12.5, hgt = 24, hw = 8 + i * 3.3;
    for (let j = 0; j <= hgt; j++) {
      const wd = 1 + (j / hgt) * hw, yy = Math.round(apex + j);
      for (let xx = Math.floor(-wd); xx <= Math.ceil(wd); xx++) {
        if (j > hgt - 3 && ((xx + i * 2 + 400) % 5 < (j - (hgt - 3)))) continue;
        const f = xx / wd;
        let k = f < -0.5 ? 4 : f < 0.2 ? 3 : f < 0.7 ? 2 : 1;
        if (j > hgt - 5) k = Math.max(1, k - 1);
        const hs = hash(xx, yy, 5 + i);
        if (hs < 0.14) k = Math.max(1, k - 1); else if (hs > 0.88) k = Math.min(5, k + 1);
        let col = T[k];
        if (winter && ((j >= hgt - 12 && j <= hgt - 10 + Math.floor(hash(Math.floor(xx / 2), i, 8) * 3) && f < 0.55 && f > -0.95) || (i === 0 && j < 6))) col = f < 0 ? WHITE : SNOW[3];
        t.px(24 + xx, yy, col);
      }
    }
  }
}

function palm(t: Img, base: number) {
  const B = tones('#b08a5a'), T = tones('#3fa046');
  const cxAt = (y: number) => 24 + Math.round(5 * Math.sin(((base - y) / (base - 30)) * 2.2) - 2);
  for (let y = 30; y <= base; y++) {
    const cx = cxAt(y), wd = y > base - 4 ? 7 : 5, x0 = cx - Math.floor(wd / 2);
    for (let i = 0; i < wd; i++) { const f = i / (wd - 1); t.px(x0 + i, y, (y % 5 === 0) ? B[1] : f < 0.25 ? B[4] : f < 0.65 ? B[3] : B[2]); }
    if (y % 5 === 1) t.px(x0 + 1, y, B[5]);
  }
  const tx = cxAt(30), ty = 30;
  const ends: [number, number, number, number][] = [[-22, 22, -20, -6], [22, 20, 20, -8], [-22, 2, -12, -14], [22, 0, 12, -16], [-14, -18, -8, -20], [14, -20, 9, -22], [0, -26, -1, -14], [-12, 26, -17, 6], [13, 27, 17, 4]];
  ends.forEach(([ex, ey, mx, my], i) => frond(t, tx, ty, tx + mx, ty + my, tx + ex, ty + ey, i % 3 === 0 ? tones(T[2]) : T, 5));
  const C = tones('#7a5236');
  orb(t, tx - 2, ty + 2, 2.5, 2.5, C, true); orb(t, tx + 3, ty + 3, 2.5, 2.5, C, true); orb(t, tx + 1, ty + 5, 2.2, 2.2, tones(C[2]), true);
}

function mushroomTree(t: Img, base: number, winter: boolean) {
  const St = tones('#eadcc0'), C = tones('#d8382e'), Gl = tones('#f0c8b0');
  trunk(t, 24, 44, base, 9, 12, St, 6, 0.8);
  for (let y = 50; y < base - 4; y += 9) { t.px(22, y, St[2]); t.px(23, y + 1, St[2]); t.px(27, y + 4, St[1]); }
  t.ellipse(24, 43, 21, 6, Gl[2]);
  for (let xx = 5; xx <= 42; xx += 2) for (let yy = 40; yy <= 48; yy++) if (((xx - 24) / 20) ** 2 + ((yy - 43) / 5.5) ** 2 < 1) t.px(xx, yy, yy > 44 ? Gl[1] : Gl[4]);
  for (let y = 14; y <= 43; y++) for (let x = 1; x <= 46; x++) {
    const dx = (x + 0.5 - 24) / 22.5, dy = (y + 0.5 - 42) / 27;
    if (dx * dx + dy * dy > 1 || y > 42 - Math.round(2 * (1 - dx * dx)) + 2) continue;
    const v = dx * 0.6 + dy * 0.9 + 0.55 + (hash(x, y, 4) - 0.5) * 0.06;
    t.px(x, y, v < -0.12 ? C[4] : v < 0.38 ? C[3] : v < 0.72 ? C[2] : C[1]);
  }
  const W = tones('#f6ecd8');
  for (const [sx, sy, rx, ry] of [[12, 26, 4, 3], [25, 20, 4.5, 3], [36, 29, 3.5, 3], [19, 34, 3, 2.2], [31, 37, 3.5, 2.2], [7, 37, 2.5, 2], [42, 38, 2, 1.8], [17, 18, 2, 1.4]]) { t.ellipse(sx, sy, rx, ry, W[2]); t.ellipse(sx - 0.5, sy - 0.5, rx - 0.7, ry - 0.7, W[4]); }
  t.ellipse(15, 21, 4, 1.5, C[5]);
  if (winter) { t.ellipse(24, 16, 9, 2.5, SNOW[4]); t.ellipse(22, 15, 6, 1.5, WHITE); t.ellipse(24, base, 9, 1.6, SNOW[4]); }
}

function mysticTree(t: Img, base: number) {
  const B = tones('#4a3a78'), T = tones('#8a4ad8'), Glow = hex('#7ff0ff');
  for (let y = 50; y <= base; y++) {
    const cx = 24 + Math.round(2.2 * Math.sin(y / 6)), wd = 6 + (y > base - 5 ? (y - base + 5) * 1.4 : 0) + (base - y) * 0.02, x0 = Math.round(cx - wd / 2);
    for (let i = 0; i < Math.round(wd); i++) { const f = i / (wd - 1); t.px(x0 + i, y, (y + i * 2) % 7 === 0 ? B[1] : f < 0.2 ? B[4] : f < 0.6 ? B[3] : B[2]); }
  }
  for (const [gx, gy] of [[24, 62], [25, 70], [22, 78], [24, 85]]) { t.px(gx, gy, Glow); t.px(gx + 1, gy + 1, hex('#3fb0e0')); }
  limb(t, 22, 52, -2.2, 9, 2, B, 0, 1, false); limb(t, 25, 52, -0.9, 9, 2, B, 0, 2, false);
  canopy(t, 12, 40, 11, 10, tones('#7a3ac8'), 31, 5.5); canopy(t, 36, 39, 11, 10, tones('#7a3ac8'), 32, 5.5);
  canopy(t, 24, 26, 17, 17, T, 33, 7);
  const P = tones('#f07ae0');
  for (const [sx, sy] of [[14, 20], [28, 14], [33, 28], [20, 32], [9, 38], [38, 40], [24, 22], [16, 44], [31, 44]]) { t.px(sx, sy, P[5]); t.px(sx + 1, sy, P[4]); t.px(sx, sy + 1, P[3]); }
  for (const [sx, sy] of [[18, 16], [34, 20], [11, 30], [27, 34], [39, 34], [22, 42]]) sparkle(t, sx, sy, Glow);
  for (const [sx, sy] of [[4, 22], [44, 14], [42, 52], [6, 54], [24, 5]]) { t.px(sx, sy, Glow); }
}

function mossTree(t: Img, base: number) {
  const T = tones('#74c83a'), M = tones('#9ad83a'), B = tones('#6a5a3a');
  trunk(t, 24, 50, base, 8, 10, B, 9);
  for (let y = 54; y < base; y++) for (let x = 19; x < 30; x++) if (t.alpha(x, y) && hash(Math.floor(x / 2), Math.floor(y / 3), 12) < 0.3 && x < 26) t.px(x, y, hash(x, y, 1) < 0.5 ? M[3] : M[2]);
  for (let x = 4; x <= 43; x += 2) {
    const d = (x - 24) / 21, bot = 38 + Math.sqrt(Math.max(0, 1 - d * d)) * 17, len = 3 + Math.floor(hash(x, 3, 5) * 9);
    if (hash(x, 9, 2) < 0.75) { t.vline(x, Math.round(bot) - 2, len, x % 4 === 0 ? M[2] : M[3]); t.px(x, Math.round(bot) - 2 + len, M[4]); }
  }
  canopy(t, 24, 35, 22, 21, T, 41);
  for (const [sx, sy, rx] of [[14, 20, 6], [28, 16, 5], [34, 30, 5], [10, 34, 4], [22, 30, 5]]) { t.ellipse(sx, sy, rx, 2, M[4]); t.ellipse(sx - 1, sy - 0.5, rx - 2, 1, M[5]); for (let i = -rx + 1; i < rx; i += 2) t.vline(sx + i, sy + 1, 1 + Math.floor(hash(sx + i, sy, 3) * 4), M[3]); }
}

function fernTree(t: Img, base: number) {
  const B = tones('#6a4a34'), T = tones('#4fb84a');
  for (let y = 40; y <= base; y++) {
    const wd = y > base - 4 ? 9 : 7, x0 = 24 - Math.floor(wd / 2);
    for (let i = 0; i < wd; i++) { const f = i / (wd - 1); t.px(x0 + i, y, ((y + i) % 4 === 0) ? B[1] : f < 0.25 ? B[4] : f < 0.65 ? B[3] : B[2]); }
    if (y % 4 === 0) { t.px(x0 - 1, y, B[3]); t.px(x0 + wd, y + 2, B[2]); }
  }
  const tx = 24, ty = 40;
  const ends: [number, number, number, number][] = [[-23, 26, -22, -4], [23, 24, 22, -6], [-23, 4, -14, -16], [23, 2, 14, -18], [-16, -22, -9, -24], [16, -24, 10, -26], [-13, 34, -19, 8], [14, 36, 19, 6], [-4, -34, -6, -18], [6, -32, 5, -16]];
  ends.forEach(([ex, ey, mx, my], i) => frond(t, tx, ty, tx + mx, ty + my, tx + ex, ty + ey, i % 3 === 1 ? tones('#3a9a50') : i % 3 === 2 ? tones('#74c83a') : T, 6));
  curve(t, 24, 40, 23, 28, 26, 26, tones('#9ad83a')[3]); curve(t, 26, 26, 28, 25, 27, 28, tones('#9ad83a')[4]);
  orb(t, 24, 41, 4, 3, tones('#7a5a34'));
}

function shaggyTree(t: Img, base: number) {
  const T = tones('#2fa878'), L = tones('#5ac87a'), B = tones('#5a4a40');
  trunk(t, 24, 40, base, 8, 10, B, 15);
  canopy(t, 24, 26, 19, 16, T, 51, 7);
  for (let x = 3; x <= 44; x++) {
    const d = (x - 23.5) / 21.5, topY = 28 - Math.sqrt(Math.max(0, 1 - d * d)) * 12;
    const len = 26 + Math.sqrt(Math.max(0, 1 - d * d)) * 14 + (hash(x, 1, 6) - 0.5) * 12 - (Math.abs(x - 24) < 5 ? 14 : 0);
    const grp = Math.floor(x / 2) % 3, col = grp === 0 ? T[3] : grp === 1 ? T[2] : L[3];
    for (let y = Math.round(topY); y < topY + len; y++) {
      const s = (y - topY) / len;
      if (s < 0.25 && t.alpha(x, y)) continue;
      t.px(x, y, s > 0.9 ? (grp === 2 ? L[4] : T[4]) : hash(x, Math.floor(y / 3), 8) < 0.2 ? (grp === 2 ? L[2] : T[1]) : col);
    }
  }
  for (const [sx, sy] of [[12, 22], [22, 14], [32, 20], [18, 26], [28, 28]]) { t.px(sx, sy, L[5]); t.px(sx + 1, sy, L[4]); }
}

const tree: Painter = (img, x, y, w, h, c) => {
  const base = h - 3, winter = c.season === 'winter', n = c.name;
  img.ellipse(x + w / 2, y + h - 3, 12, 3, SHADOW);
  layer(img, x, y, w, h, (t) => {
    if (/Pine/.test(n)) pine(t, base, winter);
    else if (/Palm/.test(n)) palm(t, base);
    else if (/Mushroom/.test(n)) mushroomTree(t, base, winter);
    else if (/Mystic/.test(n)) mysticTree(t, base);
    else if (/Rain Tree 1/.test(n)) mossTree(t, base);
    else if (/Rain Tree 2/.test(n)) fernTree(t, base);
    else if (/Rain Tree 3/.test(n)) shaggyTree(t, base);
    else {
      const sp = WILD[n] ?? WILD['Oak Tree'], B = tones(sp.bark), seed = n.length * 7;
      if (winter) { if (n === 'Mahogany Tree') bareMahogany(t, base); else bareTree(t, base, BARE[n] ?? BARE['Oak Tree'], seed); clip(t, h - 2); return; }
      trunk(t, 24, sp.top, base, sp.w0, sp.w1, B, seed);
      const T = tones(sp.leaf[c.season]);
      canopy(t, 24, sp.cy, sp.rx, sp.ry, T, seed, sp.r);
      if (n === 'Maple Tree') { bush(t, 24, sp.cy - sp.ry + 3, 6, 6, T, 3); }
      if (n === 'Oak Tree' && c.season !== 'spring') for (const [ax, ay] of [[12, 40], [30, 46], [36, 30], [20, 26]]) { t.px(ax, ay, hex('#6a4a2a')); t.px(ax, ay + 1, hex('#c89a4a')); t.px(ax, ay + 2, hex('#a87a3a')); }
    }
    clip(t, h - 2);
  }, 0.7);
};

// ------------------------------------------------------------------ fruit trees

type Ft = { fruit: string; blossom: string; fall: string; bark: string; lobes: [number, number, number, number][]; top: number; w0: number; w1: number; r?: number; fork?: [number, number, number] };
const FRUIT: Record<string, Ft> = {
  'Apple Tree': { fruit: '#e03a34', blossom: '#fbe4ea', fall: '#dca22a', bark: '#7a5238', lobes: [[24, 31, 21, 17]], top: 44, w0: 7, w1: 9, r: 7 },
  'Apricot Tree': { fruit: '#f6a43a', blossom: '#fff2e4', fall: '#e8b830', bark: '#a0704a', lobes: [[24, 23, 12, 11], [12, 35, 10, 9], [36, 34, 10, 9]], top: 34, w0: 5, w1: 6, r: 5.5, fork: [48, 13, 2.45] },
  'Cherry Tree': { fruit: '#c81e3c', blossom: '#f8a8c8', fall: '#d85a36', bark: '#7a3a44', lobes: [[24, 28, 14, 22]], top: 44, w0: 5, w1: 7, r: 6 },
  'Orange Tree': { fruit: '#f88a1e', blossom: '#ffffff', fall: '#a8a832', bark: '#8a6a4a', lobes: [[24, 30, 15, 15]], top: 40, w0: 4, w1: 5, r: 5 },
  'Peach Tree': { fruit: '#f89a8a', blossom: '#f88ab0', fall: '#e08830', bark: '#8a5a48', lobes: [[24, 20, 13, 8], [24, 28, 22, 11]], top: 40, w0: 6, w1: 7, r: 6, fork: [52, 17, 2.15] },
  'Pomegranate Tree': { fruit: '#c8283a', blossom: '#f0502e', fall: '#e8c436', bark: '#a88a64', lobes: [[24, 27, 12, 9], [24, 37, 19, 14]], top: 46, w0: 3, w1: 4, r: 6 },
  'Mango Tree': { fruit: '#f8a02a', blossom: '#f4e8a0', fall: '#3f8a46', bark: '#7a5a40', lobes: [[24, 28, 17, 22]], top: 46, w0: 6, w1: 8, r: 6.5 },
};

function fruitShape(t: Img, name: string, fx: number, fy: number, F: Tones, dark: RGBA) {
  if (/Cherry/.test(name)) { t.line(fx, fy - 3, fx - 2, fy, dark); t.line(fx, fy - 3, fx + 2, fy + 1, dark); fruitDot(t, fx - 2, fy + 1, F, dark, 1.5); fruitDot(t, fx + 3, fy + 2, F, dark, 1.5); }
  else if (/Mango/.test(name)) { t.ellipse(fx, fy, 2.6, 3.6, dark); orb(t, fx, fy, 1.8, 2.8, F, true); t.px(fx, fy + 1, hex('#e8503a')); t.px(fx - 1, fy + 2, hex('#e8503a')); }
  else if (/Pomegranate/.test(name)) { fruitDot(t, fx, fy, F, dark, 2.1); t.px(fx - 1, fy + 3, F[2]); t.px(fx, fy + 3, F[4]); t.px(fx + 1, fy + 3, F[2]); }
  else if (/Peach/.test(name)) { fruitDot(t, fx, fy, F, dark, 2.1); t.vline(fx, fy - 1, 3, F[2]); t.px(fx + 1, fy - 3, hex('#5aa84a')); }
  else if (/Apricot/.test(name)) { fruitDot(t, fx, fy, F, dark, 1.8); }
  else if (/Orange/.test(name)) { fruitDot(t, fx, fy, F, dark, 2.1); t.px(fx, fy - 2, hex('#3f7a3a')); }
  else { fruitDot(t, fx, fy, F, dark, 2.1); t.px(fx, fy - 3, hex('#6a4a2a')); t.px(fx + 1, fy - 3, hex('#5aa84a')); }
}

function bananaTree(t: Img, base: number, c: Ctx) {
  const P = tones('#9aa84a'), T = tones(c.season === 'fall' ? '#7aa83a' : c.season === 'winter' ? '#5a9a5a' : '#4fae46');
  for (let y = 34; y <= base; y++) {
    const wd = 6 + (y > base - 4 ? (y - base + 4) : 0) + (y - 34) * 0.03, x0 = Math.round(24 - wd / 2);
    for (let i = 0; i < Math.round(wd); i++) { const f = i / (wd - 1); t.px(x0 + i, y, (y % 8 === 0 && f > 0.2) ? P[1] : f < 0.22 ? P[4] : f < 0.6 ? P[3] : P[2]); }
  }
  t.vline(23, 40, 20, tones('#7a5a3a')[3]); t.vline(26, 52, 14, tones('#7a5a3a')[2]);
  const leaves: [number, number, number, number, number, Tones][] = [[-16, -26, -22, 10, 5, tones(T[2])], [17, -28, 22, 8, 5, tones(T[2])], [-14, -32, -22, -12, 5.5, T], [14, -34, 22, -14, 5.5, T], [-3, -22, -9, -30, 4.5, tones(T[4])], [4, -22, 10, -29, 4.5, T]];
  for (const [mx, my, ex, ey, wd, L] of leaves) paddle(t, 24, 34, 24 + mx, 34 + my, 24 + ex, 34 + ey, wd, L);
  if (c.season === 'summer') {
    const Y = tones('#f6d43a');
    t.vline(28, 36, 5, P[1]);
    for (const [bx, by] of [[25, 41], [28, 41], [31, 41], [26, 46], [29, 46], [28, 50]]) { t.rect(bx, by, 2, 5, Y[3]); t.vline(bx, by, 5, Y[4]); t.px(bx, by, Y[5]); t.px(bx + 1, by + 4, Y[1]); t.px(bx, by + 5, hex('#6a5a2a')); }
    t.px(28, 56, hex('#8a3a5a')); t.px(28, 57, hex('#6a2a4a'));
  }
  if (c.season === 'spring') { orb(t, 28, 42, 2.5, 4, tones('#9a3a6a'), true); t.vline(28, 36, 4, P[1]); }
}

const fruittree: Painter = (img, x, y, w, h, c) => {
  const base = h - 3, n = c.name, s = c.season;
  img.ellipse(x + w / 2, y + h - 3, 11, 3, SHADOW);
  layer(img, x, y, w, h, (t) => {
    if (/Banana/.test(n)) { bananaTree(t, base, c); clip(t, h - 2); return; }
    const sp = FRUIT[n] ?? FRUIT['Apple Tree'], B = tones(sp.bark), seed = n.length * 11 + 3;
    const tropical = /Mango/.test(n);
    if (s === 'winter' && !tropical) { bareTree(t, base, BARE[n] ?? BARE['Apple Tree'], seed); clip(t, h - 2); return; }
    if (/Pomegranate/.test(n)) { trunk(t, 20, sp.top, base, 3, 4, B, seed, 0.6); trunk(t, 24, sp.top, base, 2, 3, tones(B[2]), seed + 2, 0.4); trunk(t, 28, sp.top, base, 3, 4, tones(B[2]), seed + 1, 0.6); }
    else trunk(t, 24, sp.top, base, sp.w0, sp.w1, B, seed);
    if (/Cherry/.test(n)) for (let yy = 52; yy < base - 4; yy += 6) { t.hline(22, yy, 3, B[5]); t.px(26, yy + 3, B[1]); }
    const [fy, fl, fa] = sp.fork ?? [sp.top + 6, 8, 2.3];
    limb(t, 23, fy, -fa, fl, 2, B, 0, 1, false); limb(t, 25, fy, -Math.PI + fa, fl, 2, B, 0, 2, false);
    const col = tropical ? (s === 'winter' ? '#3a8a52' : '#2f8f46') : /Orange/.test(n) && s !== 'fall' ? (s === 'spring' ? '#3f9a4a' : '#2f8a44') : s === 'spring' ? '#66bb4c' : s === 'summer' ? '#3f9f40' : sp.fall;
    const T = tones(col);
    const cv = new Img(t.w, t.h);
    sp.lobes.forEach(([lx, ly, rx, ry], i) => canopy(cv, lx, ly, rx, ry, T, seed + i * 17, sp.r ?? 6.5));
    t.blit(cv, 0, 0);
    const inside = (px: number, py: number, m: number) => cv.alpha(px, py) > 0 && cv.alpha(px - m, py) > 0 && cv.alpha(px + m, py) > 0 && cv.alpha(px, py - m) > 0 && cv.alpha(px, py + m) > 0;
    const spots: [number, number][] = [];
    for (let i = 0; i < 160 && spots.length < 9; i++) {
      const px = 3 + Math.floor(hash(i, 1, seed) * 42), py = 6 + Math.floor(hash(i, 2, seed) * 48);
      if (inside(px, py, 4) && spots.every(([qx, qy]) => Math.abs(qx - px) + Math.abs(qy - py) > 10)) spots.push([px, py]);
    }
    if (s === 'summer') { const F = tones(sp.fruit); for (const [fx, fy2] of spots.slice(0, tropical ? 6 : 8)) fruitShape(t, n, fx, fy2, F, T[0]); }
    if (s === 'spring') {
      const Bl = tones(sp.blossom), heavy = /Cherry|Peach/.test(n);
      let placed = 0;
      for (let i = 0; i < 400 && placed < (heavy ? 40 : 22); i++) {
        const px = 2 + Math.floor(hash(i, 5, seed) * 44), py = 5 + Math.floor(hash(i, 6, seed) * 50);
        if (!inside(px, py, 1)) continue;
        placed++;
        t.px(px, py, Bl[4]); t.px(px + 1, py, Bl[3]); t.px(px, py + 1, Bl[3]); t.px(px + 1, py + 1, Bl[2]); if (i % 3 === 0) t.px(px, py, hex('#fff6c8'));
      }
    }
    clip(t, h - 2);
  }, 0.7);
};

/** Painters by item kind. They draw at real size into the box (x, y, w, h). */
export const painters: Record<string, Painter> = { crop: cropPainter, teabush, trellis, giantcrop, debris, tree, fruittree };

/** Pixels that a kind rises above its footprint (the sprite box is footprint height + rise). */
export const rise: Record<string, number> = { crop: 16, teabush: 8, trellis: 16, giantcrop: 16, debris: 6 };
