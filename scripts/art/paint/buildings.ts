/** Hand-designed building sprites. Original art; one shared architecture kit (roofs, walls, windows, doors) for all buildings. */
import { mix } from '../png';
import { hash, hex, Img, outline, OUTLINE, SHADOW, tones } from './kit';
import type { RGBA, Season, Tones } from './kit';

export type BuildingSpec = { w: number; h: number; tall: number; roof: string; wall: string };

type B = { img: Img; x: number; y: number; W: number; H: number; snow: boolean; bot: number; spec: BuildingSpec; name: string };
type Fill = (img: Img, x: number, y: number, w: number, h: number) => void;

const INK: RGBA = [38, 20, 48, 255];
const SNOW = hex('#f7fbff'), SNOW2 = hex('#cfe0f2'), SNOW3 = hex('#a7c0de');
const WHITE = tones('#efe6d4');
const STONE = tones('#8f8a90');
const HAY = tones('#e2b84a');
const GOLD = tones('#f0c040');
const DARKWOOD = tones('#7a4a2a');

/** Darkens opaque pixels only (cast shadows on walls). */
function dark(img: Img, x: number, y: number, w: number, h: number, a: number) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (img.alpha(i, j) === 255) img.px(i, j, [INK[0], INK[1], INK[2], Math.round(a * 255)]);
}

// ---------------------------------------------------------------- walls
function planksH(img: Img, x: number, y: number, w: number, h: number, t: Tones, step = 5, seed = 1) {
  img.rect(x, y, w, h, t[3]);
  for (let j = 0; j < h; j++) {
    const r = j % step;
    if (r === step - 1) img.hline(x, y + j, w, t[2]);
    else if (r === 0) for (let i = 0; i < w; i++) if (hash(i >> 2, j, seed) > 0.6) img.px(x + i, y + j, t[4]);
  }
  for (let k = 0; k * step < h; k++) {
    const jx = x + 3 + Math.floor(hash(k, 7, seed) * (w - 6));
    img.vline(jx, y + k * step, Math.min(step - 1, h - k * step), t[2]);
  }
  img.vline(x, y, h, t[4]); img.vline(x + w - 1, y, h, t[2]);
}

function planksV(img: Img, x: number, y: number, w: number, h: number, t: Tones, step = 6, seed = 1) {
  img.rect(x, y, w, h, t[3]);
  for (let i = 0; i < w; i++) {
    const r = i % step;
    if (r === step - 1) img.vline(x + i, y, h, t[2]);
    else if (r === 0) for (let j = 0; j < h; j++) if (hash(i, j >> 2, seed) > 0.62) img.px(x + i, y + j, t[4]);
  }
  for (let k = 0; k < Math.floor((w * h) / 420); k++) {
    const kx = x + 2 + Math.floor(hash(k, 1, seed) * (w - 5)), ky = y + 3 + Math.floor(hash(k, 2, seed) * (h - 6));
    img.px(kx, ky, t[1]); img.px(kx + 1, ky, t[2]);
  }
}

function stoneWall(img: Img, x: number, y: number, w: number, h: number, t: Tones, seed = 1, ch = 5) {
  img.rect(x, y, w, h, t[1]);
  for (let r = 0; r * ch < h; r++) {
    let i = -Math.floor(hash(r, 1, seed) * 5);
    while (i < w) {
      const sw = 5 + Math.floor(hash(i, r, seed) * 5);
      const x0 = Math.max(0, i), x1 = Math.min(w, i + sw - 1), hh = Math.min(ch - 1, h - r * ch);
      if (x1 > x0 && hh > 0) {
        const v = hash(i, r, seed + 3);
        img.rect(x + x0, y + r * ch, x1 - x0, hh, v < 0.25 ? t[2] : v > 0.82 ? t[4] : t[3]);
        img.hline(x + x0, y + r * ch, x1 - x0, v < 0.25 ? t[3] : v > 0.82 ? t[5] : t[4]);
      }
      i += sw;
    }
  }
}

function logWall(img: Img, x: number, y: number, w: number, h: number, t: Tones) {
  const lh = 6, end = tones('#dcb37a');
  for (let j = 0; j < h; j++) {
    const r = j % lh;
    img.hline(x, y + j, w, r === 0 ? t[4] : r < 3 ? t[3] : r < 5 ? t[2] : t[0]);
    if (r === 1) for (let i = 0; i < w; i++) if (hash(i >> 2, j, 5) > 0.7) img.px(x + i, y + j, t[4]);
  }
  for (let k = 0; k * lh + 4 < h; k++) {
    for (const ex of [x - 1, x + w - 4]) {
      img.rect(ex, y + k * lh, 5, 5, t[0]);
      img.rect(ex + 1, y + k * lh, 3, 5, end[3]);
      img.hline(ex + 1, y + k * lh, 3, end[4]); img.hline(ex + 1, y + k * lh + 4, 3, end[2]);
      img.px(ex + 2, y + k * lh + 2, end[1]);
    }
  }
}

function foundation(img: Img, x: number, y: number, w: number, h: number, t: Tones = STONE) {
  stoneWall(img, x, y, w, h, t, 9, 4);
  img.hline(x, y, w, t[5]);
}

// ---------------------------------------------------------------- roofs
type RoofO = { inset?: number; snow?: boolean; rowH?: number; seed?: number; trim?: Tones };

/** Roof slope that faces the viewer (ridge runs left-right): a shingled trapezoid with ridge cap, barge boards and eave. */
function slopeRoof(img: Img, x: number, y: number, w: number, h: number, t: Tones, o: RoofO = {}) {
  const inset = o.inset ?? 4, rowH = o.rowH ?? 5, seed = o.seed ?? 1, tr = o.trim ?? t;
  for (let j = 0; j < h; j++) {
    const ins = Math.round(inset * (1 - j / Math.max(1, h - 1)));
    const x0 = x + ins, x1 = x + w - 1 - ins, k = Math.floor(j / rowH), r = j % rowH;
    for (let i = x0; i <= x1; i++) {
      const li = i - x;
      let c = t[3];
      if (r === rowH - 1) c = t[1];
      else if ((li + k * 3) % 6 === 0) c = t[2];
      else if (r === 0 && hash(li >> 1, k, seed) > 0.45) c = t[4];
      if (i >= x1 - 4 && c === t[3]) c = t[2];
      if (j === h - 1) c = t[0];
      if (o.snow) {
        const sd = h * 0.45 + (hash(li >> 2, 0, seed) - 0.5) * 5 + (hash(li >> 4, 9, seed) - 0.5) * 6;
        if (j < sd) c = j > sd - 1.5 ? SNOW2 : hash(li >> 1, j >> 1, seed) > 0.9 ? SNOW2 : SNOW;
        else if (j >= h - 3 && j < h - 1 && hash(li >> 2, 5, seed) > 0.3) c = j === h - 2 ? SNOW2 : SNOW;
      }
      if (i <= x0 + 1) c = o.snow && j < h * 0.4 ? SNOW : tr[i === x0 ? 4 : 3];
      else if (i >= x1 - 1) c = o.snow && j < h * 0.4 ? SNOW2 : tr[i === x1 ? 1 : 2];
      img.px(i, y + j, c);
    }
    if (j === 0) img.hline(x0, y, x1 - x0 + 1, o.snow ? SNOW : t[5]);
    if (j === 1) img.hline(x0, y + 1, x1 - x0 + 1, o.snow ? SNOW : t[4]);
    if (j === 2 && !o.snow) img.hline(x0 + 2, y + 2, x1 - x0 - 3, t[1]);
  }
}

type GableO = {
  shape?: 'tri' | 'gambrel' | 'round'; depth: number; wallH: number; ov?: number; band?: number;
  roof: Tones; trim: Tones; snow: boolean; fill: Fill; snowAmt?: number;
  /** Optional custom roof surface color: d = distance from the ridge, r = row along the depth. */
  roofPx?: (d: number, r: number, left: boolean) => RGBA;
};

/**
 * Front-gabled building in 3/4 view: the gable face and the wall below it, plus the roof planes going back (up the image).
 * (x, y) is the top-left of the whole thing; w is the roof width; gh is the height of the gable triangle.
 */
function gableRoof(img: Img, x: number, y: number, w: number, gh: number, o: GableO) {
  const { depth, wallH } = o, ov = o.ov ?? 3, band = o.band ?? 3, shape = o.shape ?? 'tri', t = o.roof, tr = o.trim;
  const half = w / 2, H = depth + gh + wallH, tmp = new Img(w, H);
  o.fill(tmp, ov, depth, w - 2 * ov, gh + wallH);
  const jb = gh * 0.42, hb = half * 0.6;
  const ho = (j: number) => j < 0 ? -1 : j >= gh ? half
    : shape === 'tri' ? (half * (j + 1)) / gh
    : shape === 'round' ? half * Math.sqrt(1 - Math.pow(1 - (j + 1) / gh, 2))
    : j < jb ? (hb * (j + 1)) / jb : hb + ((half - hb) * (j + 1 - jb)) / (gh - jb);
  for (let i = 0; i < w; i++) {
    const d = Math.abs(i + 0.5 - half), left = i < half;
    let jf = 0;
    while (jf < gh - 1 && ho(jf) < d) jf++;
    const upper = shape === 'tri' ? false : d < hb;
    for (let r = 0; r < depth; r++) {
      const di = Math.floor(d);
      let c: RGBA;
      if (o.roofPx) c = o.roofPx(d, r, left);
      else {
        const hi = left ? (upper ? t[4] : t[3]) : upper ? t[3] : t[2];
        const lo = left ? (upper ? t[3] : t[2]) : upper ? t[2] : t[1];
        c = di % 4 === 3 || (r + Math.floor(di / 4) * 3) % 6 === 0 ? lo : hi;
        if (d < 1) c = t[5];
        if (r === 0) c = lo;
      }
      if (o.snow) {
        const sd = depth * (o.snowAmt ?? (upper || shape === 'tri' ? 0.62 : 0.3)) + (hash(i >> 2, 3, 2) - 0.5) * 6;
        if (r < sd) c = r > sd - 1.5 || (!left && di % 4 === 3) ? SNOW2 : SNOW;
      }
      img.px(x + i, y + jf + r, c);
    }
    for (let j = jf + depth; j < H; j++) {
      const jj = j - depth;
      let c: RGBA;
      if (jj >= gh) {
        if (i < ov || i >= w - ov) continue;
        c = tmp.get(i, j);
      } else {
        const hin = Math.min(ho(jj) - band, ho(jj - band) - 0.5, half - ov);
        if (d <= hin) {
          c = tmp.get(i, j);
          if (d > hin - 2) c = mix(c, INK, 0.3);
        } else if (jj === jf) c = o.snow ? SNOW : tr[5];
        else if (jj === jf + 1 && o.snow) c = SNOW2;
        else if (d <= hin + 1) c = tr[1];
        else c = left ? tr[4] : tr[2];
      }
      img.px(x + i, y + j, c);
    }
  }
  return { wx: x + ov, wy: y + depth + gh, ww: w - 2 * ov, wh: wallH, faceTop: y + depth, cx: x + Math.floor(half), top: y };
}

type HouseO = { bx: number; bw: number; wallH: number; roofH: number; roof: Tones; trim?: Tones; wall: Fill; inset?: number; ov?: number; base?: number; found?: boolean; seed?: number };

/** Side-gabled block: front wall with the roof slope above it. Returns the wall and roof boxes. */
function house(b: B, o: HouseO) {
  const { img } = b, bot = o.base ?? b.bot, wy = bot - o.wallH + 1, ov = o.ov ?? 2;
  o.wall(img, o.bx, wy, o.bw, o.wallH);
  if (o.found) foundation(img, o.bx, bot - 3, o.bw, 4);
  const ry = wy - o.roofH + 3;
  slopeRoof(img, o.bx - ov, ry, o.bw + 2 * ov, o.roofH, o.roof, { inset: o.inset, snow: b.snow, trim: o.trim, seed: o.seed });
  dark(img, o.bx, wy + 3, o.bw, 2, 0.34); dark(img, o.bx, wy + 5, o.bw, 1, 0.16);
  return { wx: o.bx, wy, ww: o.bw, wh: o.wallH, bot, rx: o.bx - ov, ry, rw: o.bw + 2 * ov, rh: o.roofH };
}

// ---------------------------------------------------------------- parts
type WinO = { trim: Tones; shut?: Tones; box?: boolean; lit?: boolean; snow?: boolean; panes?: 1 | 2 | 4 };
function win(img: Img, x: number, y: number, w: number, h: number, o: WinO) {
  const tr = o.trim;
  if (o.shut) for (const s of [x - 4, x + w + 1]) {
    img.rect(s - 1, y - 1, 5, h + 2, o.shut[0]); img.rect(s, y, 3, h, o.shut[3]);
    for (let j = 1; j < h; j += 2) img.hline(s, y + j, 3, o.shut[2]);
    img.vline(s, y, h, o.shut[4]);
  }
  img.rect(x - 1, y - 1, w + 2, h + 2, tr[0]); img.rect(x, y, w, h, tr[4]);
  const gx = x + 1, gy = y + 1, gw = w - 2, gh = h - 2;
  const g = o.lit ? ['#fff3c0', '#ffd468', '#f2a83e'] : ['#d6f1fb', '#72b8e2', '#4283c0'];
  img.rect(gx, gy, gw, gh, hex(g[1]));
  const split = Math.ceil(gh * 0.55);
  img.rect(gx, gy + split, gw, gh - split, hex(g[2]));
  img.px(gx, gy, hex(g[0])); img.px(gx + 1, gy, hex(g[0])); img.px(gx, gy + 1, hex(g[0]));
  if (gw > 6) img.px(gx + gw - 2, gy + gh - 2, hex(g[1]));
  const panes = o.panes ?? 4;
  if (panes !== 1) img.vline(x + Math.floor(w / 2), y, h, tr[4]);
  if (panes === 4) img.hline(x, y + Math.floor(h / 2), w, tr[4]);
  img.rect(x - 2, y + h, w + 4, 2, tr[0]); img.hline(x - 1, y + h, w + 2, o.snow ? SNOW : tr[5]);
  dark(img, x - 1, y + h + 2, w + 2, 1, 0.25);
  if (o.box) {
    img.rect(x - 2, y + h + 1, w + 4, 4, DARKWOOD[0]); img.rect(x - 1, y + h + 2, w + 2, 2, DARKWOOD[3]);
    img.hline(x - 1, y + h + 2, w + 2, DARKWOOD[4]);
    const fl = ['#e8483c', '#f6d040', '#f08ab0', '#f4f0e0'];
    for (let i = x - 1; i <= x + w; i++) {
      if (o.snow) { img.px(i, y + h + 1, SNOW); if (hash(i, 1, 4) > 0.5) img.px(i, y + h, SNOW); continue; }
      img.px(i, y + h + 1, hex(hash(i, 3, 4) > 0.5 ? '#3f8f3a' : '#57ad45'));
      const v = hash(i, 2, 4);
      img.px(i, y + h, v > 0.45 ? hex(fl[Math.floor(hash(i >> 1, 5, 4) * fl.length)]) : hex('#57ad45'));
      if (v > 0.75) img.px(i, y + h - 1, hex(fl[Math.floor(hash(i >> 1, 6, 4) * fl.length)]));
    }
  }
}

function roundWin(img: Img, cx: number, cy: number, r: number, tr: Tones, lit = false) {
  img.ellipse(cx, cy, r + 1.6, r + 1.6, tr[0]); img.ellipse(cx, cy, r + 0.6, r + 0.6, tr[4]);
  img.ellipse(cx, cy, r - 0.4, r - 0.4, hex(lit ? '#ffd468' : '#72b8e2'));
  img.px(Math.round(cx - r * 0.5), Math.round(cy - r * 0.5), hex(lit ? '#fff3c0' : '#d6f1fb'));
  img.vline(Math.floor(cx), Math.round(cy - r), Math.round(r * 2), tr[4]); img.hline(Math.round(cx - r), Math.floor(cy), Math.round(r * 2), tr[4]);
}

type DoorO = { t: Tones; trim: Tones; glass?: boolean; snow?: boolean };
/** Door; (x, y) is its top-left, the bottom row is y + h - 1. Put the bottom 2 px above the wall bottom: the step uses them. */
function door(img: Img, x: number, y: number, w: number, h: number, o: DoorO) {
  const { t, trim } = o;
  img.rect(x - 2, y - 2, w + 4, h + 2, trim[0]); img.rect(x - 1, y - 1, w + 2, h + 1, trim[4]); img.vline(x + w, y - 1, h + 1, trim[2]);
  img.rect(x, y, w, h, t[3]);
  for (let i = 3; i < w; i += 4) img.vline(x + i, y, h, t[2]);
  img.vline(x, y, h, t[4]); img.hline(x, y, w, t[1]);
  if (o.glass) {
    img.rect(x + 2, y + 3, w - 4, 6, t[0]); img.rect(x + 3, y + 4, w - 6, 4, hex('#72b8e2')); img.px(x + 3, y + 4, hex('#d6f1fb'));
    img.vline(x + Math.floor(w / 2), y + 4, 4, t[1]);
  } else { img.hline(x, y + 4, w, t[1]); img.hline(x, y + 5, w, t[4]); }
  img.hline(x, y + h - 5, w, t[1]); img.hline(x, y + h - 4, w, t[4]);
  img.rect(x + w - 4, y + Math.floor(h / 2), 2, 2, GOLD[4]); img.px(x + w - 3, y + Math.floor(h / 2) + 2, t[0]);
  img.rect(x - 4, y + h, w + 8, 2, STONE[0]); img.hline(x - 3, y + h, w + 6, o.snow ? SNOW : STONE[4]); img.hline(x - 3, y + h + 1, w + 6, STONE[2]);
}

/** Barn double doors with frames and X braces. */
function barnDoors(img: Img, x: number, y: number, w: number, h: number, t: Tones, trim: Tones, leaves = 2) {
  img.rect(x - 2, y - 2, w + 4, h + 2, trim[0]); img.rect(x - 1, y - 1, w + 2, h + 1, trim[4]);
  const lw = Math.floor(w / leaves);
  for (let k = 0; k < leaves; k++) {
    const lx = x + k * lw;
    img.rect(lx, y, lw, h, t[2]);
    for (let i = 3; i < lw; i += 4) img.vline(lx + i, y, h, t[1]);
    img.line(lx + 1, y + 1, lx + lw - 2, y + h - 2, trim[3]); img.line(lx + lw - 2, y + 1, lx + 1, y + h - 2, trim[3]);
    img.line(lx + 2, y + 1, lx + lw - 1, y + h - 2, trim[4]); img.line(lx + lw - 3, y + 1, lx, y + h - 2, trim[4]);
    img.hline(lx, y, lw, trim[4]); img.hline(lx, y + h - 1, lw, trim[3]); img.vline(lx, y, h, trim[4]); img.vline(lx + lw - 1, y, h, trim[3]);
    img.hline(lx, y + 1, lw, trim[4]); img.vline(lx + 1, y, h, trim[4]); img.vline(lx + lw - 2, y, h, trim[4]); img.hline(lx, y + h - 2, lw, trim[4]);
  }
  if (leaves === 2) { img.vline(x + lw - 1, y, h, trim[0]); img.rect(x + lw - 3, y + Math.floor(h / 2), 1, 3, t[0]); img.rect(x + lw + 1, y + Math.floor(h / 2), 1, 3, t[0]); }
}

function chimney(img: Img, x: number, y: number, w: number, h: number, t: Tones, snow: boolean) {
  img.rect(x - 1, y - 1, w + 2, h + 1, t[0]); img.rect(x, y, w, h, t[3]);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (j % 3 === 2) img.px(x + i, y + j, t[1]);
    else if ((i + (Math.floor(j / 3) % 2) * 2) % 4 === 3) img.px(x + i, y + j, t[2]);
  }
  img.vline(x, y, h, t[4]); img.vline(x + w - 1, y, h, t[2]);
  img.rect(x - 2, y - 4, w + 4, 4, t[0]); img.rect(x - 1, y - 3, w + 2, 2, t[4]); img.hline(x - 1, y - 2, w + 2, t[2]);
  img.hline(x, y - 3, w, snow ? SNOW : t[0]);
  if (snow) img.hline(x - 1, y - 4, w + 2, SNOW);
}

function hayBale(img: Img, x: number, y: number, w: number, h: number, snow = false) {
  img.rect(x, y, w, h, HAY[0]); img.rect(x + 1, y + 1, w - 2, h - 2, HAY[3]);
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    const v = hash(i, j >> 1, 11 + x);
    if (v > 0.78) img.px(x + i, y + j, HAY[4]); else if (v < 0.2) img.px(x + i, y + j, HAY[2]);
  }
  img.hline(x + 1, y + 1, w - 2, snow ? SNOW : HAY[5]); img.hline(x + 1, y + h - 2, w - 2, HAY[2]);
  for (const bx of [x + Math.floor(w * 0.28), x + Math.floor(w * 0.7)]) img.vline(bx, y + 1, h - 2, hex('#a8472e'));
}

function barrel(img: Img, x: number, y: number, snow = false) {
  const t = tones('#a86a36'), m = tones('#7d8590');
  img.rect(x + 1, y, 8, 13, t[0]); img.rect(x, y + 2, 10, 9, t[0]);
  img.rect(x + 2, y + 1, 6, 11, t[3]); img.rect(x + 1, y + 3, 8, 7, t[3]);
  img.vline(x + 3, y + 1, 11, t[4]); img.vline(x + 6, y + 2, 10, t[2]); img.vline(x + 8, y + 3, 7, t[2]);
  img.hline(x + 1, y + 3, 8, m[3]); img.hline(x + 1, y + 9, 8, m[3]); img.px(x + 2, y + 3, m[5]); img.px(x + 2, y + 9, m[5]);
  img.hline(x + 2, y + 1, 6, snow ? SNOW : t[5]);
}

function crate(img: Img, x: number, y: number, s = 10) {
  const t = tones('#b98548');
  img.rect(x, y, s, s, t[0]); img.rect(x + 1, y + 1, s - 2, s - 2, t[3]);
  img.hline(x + 1, y + 1, s - 2, t[5]); img.hline(x + 1, y + s - 2, s - 2, t[2]);
  img.vline(x + 1, y + 1, s - 2, t[4]); img.vline(x + s - 2, y + 1, s - 2, t[2]);
  img.line(x + 2, y + 2, x + s - 3, y + s - 3, t[1]); img.hline(x + 2, y + Math.floor(s / 2), s - 4, t[2]);
}

function lantern(img: Img, x: number, y: number) {
  const m = tones('#4a4450');
  img.rect(x, y, 5, 1, m[1]); img.rect(x + 1, y + 1, 3, 1, m[0]);
  img.rect(x, y + 2, 5, 5, m[0]); img.rect(x + 1, y + 3, 3, 3, hex('#ffd468')); img.px(x + 1, y + 3, hex('#fff3c0')); img.px(x + 3, y + 5, hex('#f2a83e'));
}

function flowers(img: Img, x: number, y: number, w: number, seed: number, snow: boolean) {
  const fl = ['#e8483c', '#f6d040', '#f08ab0', '#f4f0e0', '#8a6adc'];
  for (let i = 0; i < w; i++) {
    const v = hash(i, seed, 21);
    if (snow) { if (v > 0.5) img.px(x + i, y, SNOW); continue; }
    img.px(x + i, y, hex(v > 0.5 ? '#3f8f3a' : '#57ad45'));
    if (v > 0.35) img.px(x + i, y - 1, hex(hash(i, seed, 22) > 0.4 ? fl[Math.floor(hash(i >> 1, seed, 23) * fl.length)] : '#57ad45'));
    if (v > 0.8) img.px(x + i, y - 2, hex(fl[Math.floor(hash(i >> 1, seed, 24) * fl.length)]));
  }
}

/** Small cupola with louvres, a pyramid roof and an optional weather vane. cy is the bottom row. */
function cupola(img: Img, cx: number, cy: number, roof: Tones, trim: Tones, snow: boolean, vane = true) {
  img.rect(cx - 6, cy - 7, 13, 8, trim[0]); img.rect(cx - 5, cy - 6, 11, 7, trim[4]);
  img.rect(cx - 3, cy - 5, 7, 5, trim[1]); for (let j = 0; j < 5; j += 2) img.hline(cx - 3, cy - 5 + j, 7, trim[3]);
  img.vline(cx + 5, cy - 6, 7, trim[2]);
  for (let r = 0; r < 6; r++) {
    img.hline(cx - 2 - r * 1.2, cy - 13 + r, Math.round(5 + r * 2.4), r === 5 ? roof[0] : snow && r < 4 ? SNOW : roof[3]);
    if (r < 5) { img.px(Math.round(cx - 2 - r * 1.2), cy - 13 + r, snow ? SNOW : roof[4]); img.px(Math.round(cx - 2 - r * 1.2) + Math.round(5 + r * 2.4) - 1, cy - 13 + r, roof[1]); }
  }
  if (vane) {
    img.vline(cx, cy - 18, 5, OUTLINE); img.hline(cx - 3, cy - 16, 7, OUTLINE);
    img.px(cx + 3, cy - 17, GOLD[4]); img.px(cx + 4, cy - 16, GOLD[4]); img.px(cx - 3, cy - 17, GOLD[3]); img.px(cx, cy - 19, GOLD[4]);
  }
}

// ---------------------------------------------------------------- barns, coops, sheds, stable
function barn(b: B, tier: number) {
  const { img, x, bot, snow } = b;
  const w = tier === 0 ? 92 : 108, gx = x + 2, gh = [28, 32, 32][tier], depth = [24, 28, 28][tier], wallH = [34, 38, 38][tier];
  const red = tones(['#c4452e', '#b83a2c', '#b23c34'][tier]), trim = WHITE;
  const roof = tones(['#8a5a3a', '#59677a', '#51478c'][tier]);
  const top = bot - (depth + gh + wallH) + 1;
  const g = gableRoof(img, gx, top, w, gh, { shape: 'gambrel', depth, wallH, roof, trim, snow, band: 3, fill: (t, fx, fy, fw, fh) => planksV(t, fx, fy, fw, fh, red, 6, tier + 1) });
  foundation(img, g.wx, bot - 2, g.ww, 3);
  img.rect(g.wx, g.wy, 2, wallH - 3, trim[4]); img.rect(g.wx + g.ww - 2, g.wy, 2, wallH - 3, trim[2]);
  img.hline(g.wx + 2, g.wy, g.ww - 4, trim[3]); img.hline(g.wx + 2, g.wy + 1, g.ww - 4, red[1]);
  const dw = tier ? 40 : 34, dh = wallH - 8;
  barnDoors(img, g.cx - dw / 2, bot - 2 - dh, dw, dh, red, trim);
  img.rect(g.cx - dw / 2 - 3, bot - 2, dw + 6, 2, STONE[0]); img.hline(g.cx - dw / 2 - 2, bot - 2, dw + 4, snow ? SNOW : STONE[4]);
  const ly = g.faceTop + Math.round(gh * 0.42);
  if (tier === 0) roundWin(img, g.cx, ly + 6, 4, trim);
  else {
    // hay loft door with a hoist beam
    barnDoors(img, g.cx - 8, ly, 16, 14, red, trim, 1);
    img.rect(g.cx - 2, ly - 6, 4, 3, DARKWOOD[0]); img.rect(g.cx - 1, ly - 5, 2, 1, DARKWOOD[4]);
    img.rect(g.cx - 7, ly + 11, 14, 3, HAY[3]); img.hline(g.cx - 7, ly + 11, 14, HAY[5]); img.px(g.cx - 4, ly + 10, HAY[4]); img.px(g.cx + 3, ly + 10, HAY[4]); img.px(g.cx + 5, ly + 14, HAY[4]);
    for (const wx of [g.wx + 8, g.wx + g.ww - 19]) win(img, wx, g.wy + 9, 11, 11, { trim, snow, box: tier === 2 });
  }
  if (tier === 2) {
    cupola(img, g.cx, top + 12, roof, trim, snow);
    lantern(img, g.cx - dw / 2 - 9, bot - 22); lantern(img, g.cx + dw / 2 + 4, bot - 22);
  } else if (tier === 1) cupola(img, g.cx, top + 12, roof, trim, snow, false);
  if (tier === 0) {
    hayBale(img, x + 95, bot - 11, 15, 12, snow); hayBale(img, x + 97, bot - 21, 12, 10, snow);
  }
}

function coop(b: B, tier: number) {
  const { img, x, bot, snow, spec } = b;
  const bw = [70, 88, 90][tier], bx = x + 3, wallH = [28, 31, 33][tier], roofH = [36, 42, 46][tier];
  const wallT = tones(spec.wall), roof = tones(['#c24a2e', '#a83c2c', '#5d3f86'][tier]), trim = tier === 2 ? WHITE : tones('#f0d9a8');
  const h = house(b, { bx, bw, wallH, roofH, roof, wall: (i, fx, fy, fw, fh) => planksH(i, fx, fy, fw, fh, wallT, 5, tier + 3), found: true, inset: 5, seed: tier });
  img.rect(bx, h.wy + 3, 2, wallH - 7, trim[4]); img.rect(bx + bw - 2, h.wy + 3, 2, wallH - 7, trim[2]);
  // people door on the right
  const dx = bx + bw - 24;
  door(img, dx, bot - 2 - 19, 12, 19, { t: tones('#9a5a30'), trim, snow, glass: tier > 0 });
  // chicken hatch with a ramp
  const hx = bx + 9, hy = bot - 20, rp = tones('#d2a566');
  img.rect(hx - 1, hy - 1, 11, 11, trim[0]); img.rect(hx, hy, 9, 9, trim[4]); img.rect(hx + 1, hy + 1, 7, 8, hex('#2e1c22'));
  img.rect(hx + 1, hy + 1, 7, 2, hex('#4a2c2a'));
  for (let k = 0; k < 15; k++) {
    const px = hx + k, py = hy + 9 + Math.round(k * 0.62);
    img.px(px, py, k % 3 === 2 ? rp[1] : rp[5]); img.px(px, py + 1, k % 3 === 2 ? rp[1] : rp[3]); img.px(px, py + 2, rp[2]); img.px(px, py + 3, OUTLINE);
  }
  // window(s)
  win(img, bx + 30, h.wy + 9, 13, 10, { trim, snow, lit: true, box: tier === 2, shut: tier === 2 ? tones('#5d3f86') : undefined });
  if (tier > 0) win(img, bx + 50, h.wy + 9, 9, 10, { trim, snow, lit: true, panes: 2 });
  // roof details
  if (tier === 1) {
    const d = gableRoof(img, bx + bw / 2 - 11, h.ry + 10, 22, 8, { depth: 7, wallH: 8, roof, trim, snow, ov: 2, band: 2, fill: (i, fx, fy, fw, fh) => planksH(i, fx, fy, fw, fh, wallT, 4) });
    img.rect(d.cx - 3, d.wy - 2, 6, 7, trim[0]); for (let j = 0; j < 6; j += 2) img.hline(d.cx - 2, d.wy - 1 + j, 4, trim[4]);
  }
  if (tier === 2) {
    cupola(img, bx + Math.floor(bw / 2), h.ry + 4, roof, trim, snow);
    const p = tones('#6a6f7a');
    img.rect(bx + 14, h.ry - 5, 5, 14, p[0]); img.rect(bx + 15, h.ry - 4, 3, 13, p[3]); img.vline(bx + 15, h.ry - 4, 13, p[5]);
    img.rect(bx + 13, h.ry - 7, 7, 3, p[0]); img.hline(bx + 14, h.ry - 6, 5, snow ? SNOW : p[4]);
    lantern(img, dx - 8, bot - 21);
  }
  if (tier === 0) {
    hayBale(img, x + 77, bot - 10, 15, 11, snow);
    // feed sack
    const s = tones('#d8c8a0');
    img.ellipse(x + 84, bot - 15, 5, 5, s[0]); img.ellipse(x + 84, bot - 15, 4, 4, s[3]); img.rect(x + 82, bot - 21, 4, 2, s[0]); img.px(x + 82, bot - 17, s[5]); img.hline(x + 82, bot - 14, 5, hex('#b8472e'));
  }
  flowers(img, bx + 24, bot, tier === 2 ? 18 : 8, tier, snow);
}

function shed(b: B, big: boolean) {
  const { img, x, bot, snow, spec } = b;
  const w = big ? 108 : 90, gh = big ? 24 : 20, depth = big ? 26 : 22, wallH = big ? 38 : 34;
  const wallT = tones(spec.wall), roof = tones(big ? '#4e6078' : '#7a5236'), trim = tones(big ? '#e8dcc0' : '#6e4426');
  const top = bot - (depth + gh + wallH) + 1;
  const g = gableRoof(img, x + 2, top, w, gh, { depth, wallH, roof, trim, snow, band: 3, fill: (t, fx, fy, fw, fh) => planksV(t, fx, fy, fw, fh, wallT, 5, big ? 8 : 7) });
  foundation(img, g.wx, bot - 2, g.ww, 3);
  img.rect(g.wx, g.wy, 2, wallH - 3, trim[4]); img.rect(g.wx + g.ww - 2, g.wy, 2, wallH - 3, trim[2]);
  img.hline(g.wx + 2, g.wy, g.ww - 4, wallT[1]);
  // wide double plank door with Z braces
  const dw = big ? 34 : 28, dh = wallH - 9, dx = g.cx - dw / 2, dy = bot - 2 - dh, dt = tones('#8a5630');
  img.rect(dx - 2, dy - 2, dw + 4, dh + 2, trim[0]); img.rect(dx - 1, dy - 1, dw + 2, dh + 1, trim[4]);
  for (let k = 0; k < 2; k++) {
    const lx = dx + (k * dw) / 2, lw = dw / 2;
    planksV(img, lx, dy, lw, dh, dt, 4, 5 + k);
    img.rect(lx + 1, dy + 3, lw - 2, 2, dt[1]); img.rect(lx + 1, dy + dh - 6, lw - 2, 2, dt[1]);
    img.line(k ? lx + 1 : lx + lw - 2, dy + 5, k ? lx + lw - 2 : lx + 1, dy + dh - 7, dt[1]);
    img.px(k ? lx + 2 : lx + lw - 3, dy + Math.floor(dh / 2), GOLD[4]);
  }
  img.vline(g.cx, dy, dh, dt[0]);
  img.rect(dx - 3, bot - 1, dw + 6, 2, STONE[0]); img.hline(dx - 2, bot - 1, dw + 4, snow ? SNOW : STONE[4]);
  // gable vent or window
  if (big) roundWin(img, g.cx, g.faceTop + gh - 8, 4, trim);
  else { img.rect(g.cx - 4, g.faceTop + gh - 9, 8, 7, trim[0]); for (let j = 0; j < 5; j += 2) img.hline(g.cx - 3, g.faceTop + gh - 8 + j, 6, wallT[1]); for (let j = 1; j < 5; j += 2) img.hline(g.cx - 3, g.faceTop + gh - 8 + j, 6, wallT[4]); }
  win(img, g.wx + 9, g.wy + 10, 11, 11, { trim: big ? trim : WHITE, snow });
  if (big) { win(img, g.wx + g.ww - 20, g.wy + 10, 11, 11, { trim, snow }); lantern(img, dx - 9, dy + 3); }
  // tools and props
  const tx = g.wx + g.ww - (big ? 30 : 18);
  if (!big) {
    img.vline(tx, bot - 22, 21, DARKWOOD[4]); img.vline(tx + 1, bot - 22, 21, DARKWOOD[1]);
    img.rect(tx - 2, bot - 25, 6, 5, tones('#8a9098')[0]); img.rect(tx - 1, bot - 24, 4, 3, tones('#8a9098')[4]);
    img.vline(tx + 6, bot - 20, 19, DARKWOOD[4]); img.hline(tx + 4, bot - 21, 5, tones('#8a9098')[4]); for (let k = 0; k < 3; k++) img.vline(tx + 4 + k * 2, bot - 20, 3, tones('#8a9098')[2]);
    crate(img, x + 96, bot - 10, 11); crate(img, x + 98, bot - 19, 9);
  } else barrel(img, g.wx + 23, bot - 13, snow);
}

function stable(b: B) {
  const { img, x, W, bot, snow, spec } = b;
  const bx = x + 3, bw = W - 6, wallH = 30, roofH = 38, wallT = tones(spec.wall), roof = tones(spec.roof), trim = tones('#e6d2a0');
  const h = house(b, { bx, bw, wallH, roofH, roof, wall: (i, fx, fy, fw, fh) => planksV(i, fx, fy, fw, fh, wallT, 5, 4), inset: 4 });
  const ix = bx + 4, iw = bw - 8, iy = h.wy + 7, cx = bx + Math.floor(bw / 2);
  img.rect(ix, iy, iw, bot - iy + 1, hex('#33212a'));
  for (let i = 2; i < iw; i += 5) img.vline(ix + i, iy, bot - iy - 3, hex('#45303a'));
  img.rect(ix, iy, iw, 2, hex('#241720'));
  // straw floor
  img.rect(ix, bot - 3, iw, 4, HAY[2]);
  for (let i = 0; i < iw; i++) { if (hash(i, 1, 6) > 0.4) img.px(ix + i, bot - 4, HAY[3]); if (hash(i, 2, 6) > 0.5) img.px(ix + i, bot - 2, HAY[4]); }
  // hay pile left
  img.ellipse(ix + 9, bot - 4, 9, 7, HAY[1]); img.ellipse(ix + 8, bot - 5, 8, 6, HAY[3]); img.ellipse(ix + 6, bot - 7, 4, 3, HAY[4]);
  for (let k = 0; k < 7; k++) img.px(ix + 2 + Math.floor(hash(k, 3, 6) * 14), bot - 9 + Math.floor(hash(k, 4, 6) * 7), HAY[5]);
  // frame: beam and posts
  img.rect(ix - 1, iy - 2, iw + 2, 3, wallT[0]); img.hline(ix - 1, iy - 2, iw + 2, wallT[4]); img.hline(ix - 1, iy - 1, iw + 2, wallT[2]);
  for (const px of [ix - 2, cx - 1, ix + iw - 1]) { img.rect(px, iy - 2, 3, bot - iy + 3, wallT[1]); img.vline(px, iy - 2, bot - iy + 3, wallT[4]); img.vline(px + 1, iy - 2, bot - iy + 3, wallT[3]); }
  // half door right
  const gx0 = cx + 2, gw = ix + iw - 1 - gx0, gy = bot - 14;
  barnDoors(img, gx0 + 1, gy + 1, gw - 2, 13, tones('#8a5630'), trim, 1);
  // horseshoe on the beam
  const m = tones('#aab2bc');
  img.rect(cx - 3, iy - 9, 7, 6, wallT[0]); img.rect(cx - 2, iy - 8, 5, 5, m[4]); img.rect(cx - 1, iy - 7, 3, 4, wallT[2]); img.px(cx - 2, iy - 8, m[5]);
  lantern(img, ix + iw - 7, iy + 2);
  // bucket
  img.rect(bx + bw - 9, bot - 6, 7, 7, m[0]); img.rect(bx + bw - 8, bot - 5, 5, 5, m[3]); img.hline(bx + bw - 8, bot - 5, 5, hex('#72b8e2')); img.vline(bx + bw - 8, bot - 4, 4, m[5]);
  void snow;
}

// ---------------------------------------------------------------- homes
function cabin(b: B, tier: number, mat: 'stone' | 'plank' | 'log' | 'plain') {
  const { img, x, W, bot, snow, spec } = b;
  const bx = x + 3, bw = W - 6, wallH = [30, 32, 36][tier], roofH = [36, 42, 50][tier];
  const wallT = tones(spec.wall), roof = tones(spec.roof);
  const trim = mat === 'stone' ? tones('#d8dce4') : mat === 'log' ? tones('#e8c890') : WHITE;
  const shut = tones(mat === 'stone' ? '#b8443a' : mat === 'plank' ? '#3f7a8a' : mat === 'log' ? '#3f7a4a' : '#a8472e');
  const fill: Fill = mat === 'stone' ? (i, fx, fy, fw, fh) => stoneWall(i, fx, fy, fw, fh, wallT, 3)
    : mat === 'log' ? (i, fx, fy, fw, fh) => logWall(i, fx, fy, fw, fh, wallT)
    : mat === 'plank' ? (i, fx, fy, fw, fh) => planksH(i, fx, fy, fw, fh, wallT, 5, 6)
    : (i, fx, fy, fw, fh) => planksV(i, fx, fy, fw, fh, wallT, 6, 2);
  const h = house(b, { bx, bw, wallH, roofH, roof, wall: fill, found: mat !== 'stone', inset: 5, seed: tier + 5, rowH: undefined } as HouseO);
  if (mat === 'plank' || mat === 'plain') { img.rect(bx, h.wy + 3, 2, wallH - 7, trim[4]); img.rect(bx + bw - 2, h.wy + 3, 2, wallH - 7, trim[2]); }
  const dt = tones(mat === 'stone' ? '#7a4a2a' : mat === 'plank' ? '#3f7a8a' : '#6e3e22');
  const dh = 20, dy = bot - 2 - dh;
  const chim = mat === 'stone' || mat === 'log' ? STONE : tones('#b0553a');
  if (tier === 0) {
    door(img, bx + 16, dy, 12, dh, { t: dt, trim, snow });
    win(img, bx + 46, h.wy + 9, 13, 12, { trim, snow, shut: mat === 'plain' ? shut : undefined });
    chimney(img, bx + bw - 18, h.ry + 6, 7, 10, chim, snow);
    if (mat === 'log') { // woodpile
      const lw = tones('#a86a36');
      for (let r = 0; r < 2; r++) for (let k = 0; k < 3 - r; k++) { const cx = bx + bw - 13 + k * 5 + r * 2.5, cy = bot - 2 - r * 4; img.ellipse(cx, cy, 2.6, 2.6, lw[0]); img.ellipse(cx, cy, 1.6, 1.6, tones('#dcb37a')[3]); img.px(Math.floor(cx), Math.floor(cy), lw[2]); }
    } else if (mat === 'stone') barrel(img, bx + bw - 13, bot - 13, snow);
    else if (mat === 'plank') crate(img, bx + bw - 13, bot - 10, 10);
    else flowers(img, bx + 44, bot, 18, 3, snow);
  } else {
    const cx = bx + Math.floor(bw / 2);
    door(img, cx - 6, dy, 12, dh, { t: dt, trim, snow, glass: true });
    win(img, bx + 10, h.wy + 9, 12, 12, { trim, snow, shut, box: true });
    win(img, bx + bw - 22, h.wy + 9, 12, 12, { trim, snow, shut, box: tier === 2 });
    // porch roof over the door
    slopeRoof(img, cx - 12, dy - 10, 24, 8, roof, { inset: 3, snow, rowH: 3 });
    dark(img, cx - 8, dy - 2, 16, 2, 0.3);
    for (const px of [cx - 11, cx + 9]) { img.rect(px, dy - 2, 2, dh + 2, trim[1]); img.vline(px, dy - 2, dh + 2, trim[4]); }
    chimney(img, bx + bw - 20, h.ry - 2, 8, tier === 2 ? 18 : 14, chim, snow);
    if (tier === 2) {
      const d = gableRoof(img, cx - 14, h.ry + 12, 28, 10, { depth: 9, wallH: 12, roof, trim, snow, ov: 2, band: 2, fill });
      win(img, d.cx - 5, d.wy - 4, 10, 11, { trim, snow, lit: true });
      lantern(img, cx - 20, dy + 2);
      chimney(img, bx + 10, h.ry + 2, 6, 10, chim, snow);
    }
  }
}

function farmhouse(b: B, tier: number) {
  const { img, x, W, bot, snow, spec } = b;
  const wallT = tones(spec.wall), roof = tones(spec.roof), trim = WHITE;
  const shut = tones(['#3f7a5a', '#3f6f9a', '#34588a'][tier]), dt = tones(['#7a4a2a', '#3f6f9a', '#34588a'][tier]);
  const bx = x + 3, bw = 94, wallH = [36, 36, 60][tier], roofH = [44, 48, 48][tier];
  const fill: Fill = (i, fx, fy, fw, fh) => planksH(i, fx, fy, fw, fh, wallT, 5, 2);
  // right wing first; the main roof overlaps it
  const wx0 = bx + bw - 2, ww = x + W - 3 - wx0, wWall = 30, wRoof = [20, 28, 32][tier];
  const wing = house(b, { bx: wx0, bw: ww, wallH: wWall, roofH: wRoof, roof, wall: fill, found: tier > 0, inset: 3, seed: 9 });
  if (tier === 0) {
    // open porch: recessed back wall, floor, posts, rail
    dark(img, wx0, wing.wy + 3, ww, wWall - 8, 0.42);
    const fl = tones('#a8703c');
    img.rect(wx0, bot - 5, ww, 6, fl[0]); img.rect(wx0, bot - 4, ww, 4, fl[3]); img.hline(wx0, bot - 4, ww, snow ? SNOW : fl[5]);
    for (let i = 5; i < ww; i += 6) img.vline(wx0 + i, bot - 3, 3, fl[2]);
    barrel(img, wx0 + 8, bot - 17, snow);
    crate(img, wx0 + 22, bot - 14, 10);
    for (const px of [wx0 + 3, wx0 + ww - 4]) { img.rect(px - 1, wing.wy + 3, 4, wWall - 7, trim[0]); img.rect(px, wing.wy + 3, 2, wWall - 7, trim[4]); img.vline(px + 1, wing.wy + 3, wWall - 7, trim[2]); }
    img.rect(wx0 + 5, bot - 12, ww - 9, 1, trim[4]); img.rect(wx0 + 5, bot - 11, ww - 9, 1, trim[1]);
    for (let i = 8; i < ww - 6; i += 4) img.vline(wx0 + i, bot - 10, 6, trim[3]);
  } else {
    img.rect(wx0 + ww - 2, wing.wy + 3, 2, wWall - 7, trim[2]);
    win(img, wx0 + 16, wing.wy + 9, 14, 12, { trim, snow, shut, box: true });
    chimney(img, wx0 + ww - 16, wing.ry - 4, 8, 14, tones('#b0553a'), snow);
  }
  const h = house(b, { bx, bw, wallH, roofH, roof, wall: fill, found: true, inset: 6, seed: 3 });
  img.rect(bx, h.wy + 3, 2, wallH - 7, trim[4]); img.rect(bx + bw - 2, h.wy + 3, 2, wallH - 7, trim[2]);
  const dcx = bx + 47, dh = 22, dy = bot - 2 - dh, ly = bot - 28;
  door(img, dcx - 7, dy, 14, dh, { t: dt, trim, snow, glass: true });
  for (const wxx of [bx + 12, bx + 69]) win(img, wxx, ly, 13, 14, { trim, snow, shut, box: tier > 0 || wxx === bx + 12 });
  lantern(img, dcx + 11, dy + 3);
  if (tier === 2) {
    // belt course and upper floor windows
    img.rect(bx + 2, h.wy + 27, bw - 4, 2, trim[4]); img.hline(bx + 2, h.wy + 29, bw - 4, trim[1]); dark(img, bx + 2, h.wy + 30, bw - 4, 1, 0.2);
    for (const wxx of [bx + 12, bx + 69]) win(img, wxx, h.wy + 9, 13, 13, { trim, snow, shut, lit: wxx > bx + 40 });
  }
  // porch roof over the door (base), cross gable (upgrades)
  if (tier === 0) {
    slopeRoof(img, dcx - 14, dy - 10, 28, 8, roof, { inset: 3, snow, rowH: 3 });
    dark(img, dcx - 9, dy - 2, 18, 2, 0.3);
    for (const px of [dcx - 13, dcx + 11]) { img.rect(px, dy - 2, 2, dh + 2, trim[1]); img.vline(px, dy - 2, dh + 2, trim[4]); }
  } else {
    const gw = tier === 2 ? 38 : 32, gh2 = tier === 2 ? 15 : 13, wH = tier === 2 ? 26 : 12, dep = 14;
    const d = gableRoof(img, dcx - gw / 2, h.wy + (tier === 2 ? 25 : 4) - (dep + gh2 + wH), gw, gh2, { depth: dep, wallH: wH, roof, trim, snow, ov: 3, band: 3, fill });
    if (tier === 2) { win(img, d.cx - 6, d.wy + 4, 13, 13, { trim, snow, shut, box: true }); roundWin(img, d.cx, d.wy - 6, 3, trim, true); }
    else roundWin(img, d.cx, d.wy + 1, 4, trim, true);
    // small awning over the door
    img.rect(dcx - 11, dy - 6, 22, 4, roof[0]); img.rect(dcx - 10, dy - 5, 20, 2, roof[3]); img.hline(dcx - 10, dy - 5, 20, snow ? SNOW : roof[4]); dark(img, dcx - 9, dy - 2, 18, 1, 0.3);
  }
  chimney(img, bx + 14, h.ry - 6, 9, 18, tones('#b0553a'), snow);
  flowers(img, bx + 6, bot, 26, 7, snow); flowers(img, bx + 62, bot, 26, 8, snow);
}

// ---------------------------------------------------------------- shape helpers
function masked(img: Img, x: number, y: number, w: number, h: number, fill: Fill, inside: (i: number, j: number) => boolean) {
  const tmp = new Img(w, h);
  fill(tmp, 0, 0, w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (inside(i, j)) { const c = tmp.get(i, j); if (c[3]) img.px(x + i, y + j, c); }
}
/** Tone index across a cylinder, light from the left. u is 0..1. */
const cyl = (u: number) => (u < 0.08 ? 2 : u < 0.22 ? 4 : u < 0.34 ? 5 : u < 0.52 ? 4 : u < 0.74 ? 3 : u < 0.9 ? 2 : 1);
const inEll = (px: number, py: number, cx: number, cy: number, rx: number, ry: number) => ((px + 0.5 - cx) / rx) ** 2 + ((py + 0.5 - cy) / ry) ** 2 <= 1;

// ---------------------------------------------------------------- greenhouse, slime hutch
function greenhouse(b: B, ruined: boolean) {
  const { img, x, bot, snow } = b;
  const w = 108, gh = 26, depth = 60, wallH = 46, top = bot - (depth + gh + wallH) + 1;
  const fr = tones(ruined ? '#8a7458' : '#eef2ea'), kn = tones(ruined ? '#6e6258' : '#a8623c');
  const G = ruined ? ['#c3d2c0', '#93ab9c', '#748f86', '#5f7a74'] : ['#e6f9fb', '#aee4ee', '#84cde0', '#62b4d2'];
  const hole = hex('#2a3436'), hole2 = hex('#3b4a48');
  const broken = (px: number, py: number, id: number, cw: number, chh: number) => {
    if (!ruined || hash(id, 77, 5) > 0.42) return 0;
    const r = Math.abs(px - cw / 2 + (hash(id, 1, 5) - 0.5) * 3) + Math.abs(py - chh / 2 + (hash(id, 2, 5) - 0.5) * 3);
    const lim = 3.5 + hash(id, 3, 5) * 3 + (hash(px >> 1, py >> 1, id) - 0.5) * 2.5;
    return r < lim - 1 ? 2 : r < lim ? 1 : 0;
  };
  const face: Fill = (t, fx, fy, fw, fh) => {
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) {
      const cxp = i % 12, cyp = (fh - 1 - j) % 13, id = Math.floor(i / 12) * 31 + Math.floor((fh - 1 - j) / 13);
      let c = hex(cyp > 6 ? G[1] : G[2]);
      // plants behind the glass (lower panes)
      const ph = ruined ? 0 : 10 + hash(i >> 2, 4, 9) * 16 + hash(i >> 4, 5, 9) * 8;
      if (fh - j - 9 < ph && fh - j > 8) c = hex(hash(i >> 1, j >> 1, 9) > 0.55 ? '#4fae58' : '#3c9450');
      if (!ruined && fh - j - 9 < ph && fh - j - 9 > ph - 3 && hash(i >> 1, 7, 9) > 0.72) c = hex(hash(i >> 1, 8, 9) > 0.5 ? '#f06a6a' : '#f6d040');
      if (cxp + (12 - cyp) === 6 || cxp + (12 - cyp) === 7) c = hex(G[0]);
      const br = broken(cxp, cyp, id, 12, 13);
      if (br) c = br === 2 ? hole : hole2;
      if (cxp === 0 || cyp === 0) c = cxp === 0 ? fr[4] : fr[3];
      if (fh - j <= 8) c = (fh - j) === 8 ? kn[5] : (fh - j) % 4 === 0 ? kn[1] : (i + ((fh - j) >> 2) * 3) % 7 === 0 ? kn[2] : kn[3];
      t.px(fx + i, fy + j, c);
    }
    t.vline(fx, fy, fh, fr[4]); t.vline(fx + fw - 1, fy, fh, fr[2]);
  };
  const g = gableRoof(img, x + 2, top, w, gh, {
    depth, wallH, roof: fr, trim: fr, snow, band: 3, fill: face, snowAmt: 0.28,
    roofPx: (d, r, left) => {
      const pd = Math.floor(d) % 13, pr = r % 15, id = Math.floor(d / 13) * 17 + Math.floor(r / 15) * 3 + (left ? 0 : 100);
      if (d < 1) return fr[5];
      if (pd === 12 || pr === 14) return left ? fr[4] : fr[2];
      const br = broken(pd, pr, id, 12, 14);
      if (br) return br === 2 ? hole : hole2;
      if (pd + pr === 7 || pd + pr === 8) return hex(left ? G[0] : G[1]);
      return hex(left ? G[1] : G[3]);
    },
  });
  // door
  const dw = 18, dh = 30, dx = g.cx - dw / 2, dy = bot - 2 - dh;
  img.rect(dx - 2, dy - 2, dw + 4, dh + 2, fr[0]); img.rect(dx - 1, dy - 1, dw + 2, dh + 1, fr[4]);
  if (ruined) {
    img.rect(dx, dy, dw, dh, hex('#261a24')); img.rect(dx, dy, dw, 3, hex('#18101a'));
    const bd = tones('#9a7044');
    for (const [y0, y1] of [[dy + 5, dy + 10], [dy + 20, dy + 14]]) for (let k = 0; k < 4; k++) img.line(dx - 3, y0 + k, dx + dw + 2, y1 + k, k === 0 ? bd[5] : k === 3 ? bd[0] : bd[3]);
    img.px(dx - 2, dy + 6, bd[0]); img.px(dx + dw + 1, dy + 11, bd[0]); img.px(dx - 2, dy + 21, bd[0]); img.px(dx + dw + 1, dy + 15, bd[0]);
  } else {
    for (let k = 0; k < 2; k++) {
      const lx = dx + k * 9;
      img.rect(lx, dy, 9, dh, fr[3]); img.rect(lx + 1, dy + 1, 7, 16, hex(G[2])); img.rect(lx + 1, dy + 1, 7, 7, hex(G[1])); img.px(lx + 1, dy + 1, hex(G[0])); img.px(lx + 2, dy + 1, hex(G[0])); img.px(lx + 1, dy + 2, hex(G[0]));
      img.rect(lx + 1, dy + 19, 7, 9, fr[4]); img.rect(lx + 2, dy + 20, 5, 7, fr[2]);
    }
    img.vline(g.cx, dy, dh, fr[0]); img.px(g.cx - 2, dy + 17, GOLD[4]); img.px(g.cx + 2, dy + 17, GOLD[4]);
  }
  img.rect(dx - 4, bot - 1, dw + 8, 2, STONE[0]); img.hline(dx - 3, bot - 1, dw + 6, snow ? SNOW : STONE[4]);
  if (ruined) {
    // vines and weeds
    const leaf = snow ? ['#5f8a6a', '#7aa888'] : ['#3c8f3e', '#63b54a'];
    for (let k = 0; k < 9; k++) {
      let vx = g.wx + 3 + Math.floor(hash(k, 1, 31) * (g.ww - 6)), vy = bot - 1;
      const len = 18 + Math.floor(hash(k, 2, 31) * (k % 3 === 0 ? 70 : 36));
      for (let s = 0; s < len; s++) {
        if (Math.abs(vx - g.cx) < 12 && vy > dy) vx += vx < g.cx ? -1 : 1;
        img.px(vx, vy, hex(leaf[0]));
        if (s % 3 === 1) { const sd = hash(k, s, 32) > 0.5 ? 1 : -1; img.px(vx + sd, vy, hex(leaf[1])); img.px(vx + sd, vy - 1, hex(leaf[1])); if (s % 6 === 1) img.px(vx + 2 * sd, vy - 1, hex(leaf[0])); }
        vy--; if (hash(k, s, 33) > 0.66) vx += hash(k, s, 34) > 0.5 ? 1 : -1;
        vx = Math.max(g.wx + 1, Math.min(g.wx + g.ww - 2, vx));
      }
    }
    for (let i = 0; i < g.ww; i += 2) { const hgt = Math.floor(hash(i, 9, 35) * 5); if (Math.abs(g.wx + i - g.cx) > 13) for (let s = 0; s < hgt; s++) img.px(g.wx + i, bot - s, hex(leaf[s === hgt - 1 ? 1 : 0])); }
  } else { flowers(img, g.wx + 4, bot, 34, 12, snow); flowers(img, g.wx + g.ww - 38, bot, 34, 13, snow); }
}

function slimeHutch(b: B) {
  const { img, x, bot, snow } = b;
  const w = 108, gh = 36, depth = 28, wallH = 32, top = bot - (depth + gh + wallH) + 1;
  const st = tones('#7f8c9a'), roof = tones('#3f6f7a'), trim = tones('#56606e'), slime = tones('#6fd44a'), iron = tones('#4a4f5e');
  const g = gableRoof(img, x + 2, top, w, gh, {
    shape: 'round', depth, wallH, roof, trim, snow, band: 4, fill: (t, fx, fy, fw, fh) => stoneWall(t, fx, fy, fw, fh, st, 4, 6),
    roofPx: (d, r, left) => {
      const u = left ? 0.5 - d / w : 0.5 + d / w, k = [1, 2, 3, 4, 5, 4, 3, 3, 2, 2, 1, 1][Math.min(11, Math.floor(u * 12))];
      if (r % 9 === 8) return roof[Math.max(0, k - 2)];
      if (r % 9 === 3 && Math.floor(d) % 6 === 2) return roof[Math.min(5, k + 1)];
      return roof[k];
    },
  });
  // arched iron door
  const dw = 22, dh = 30, dx = g.cx - dw / 2, dy = bot - 1 - dh;
  for (let j = 0; j < dh; j++) for (let i = -2; i < dw + 2; i++) {
    const inA = (rad: number) => j >= 11 ? Math.abs(i + 0.5 - dw / 2) <= rad : inEll(i, j, dw / 2, 11, rad, rad);
    if (!inA(dw / 2 + 2)) continue;
    let c: RGBA = st[0];
    if (inA(dw / 2 + 1)) c = st[5];
    if (inA(dw / 2 - 0.5)) c = iron[0];
    if (inA(dw / 2 - 1.5)) c = i < dw / 2 ? iron[3] : iron[2];
    if (inA(dw / 2 - 1.5) && (j === 13 || j === 24)) c = iron[1];
    if (inA(dw / 2 - 2.5) && (j === 12 || j === 23) && i % 4 === 1) c = iron[5];
    img.px(dx + i, dy + j, c);
  }
  img.vline(g.cx, dy + 1, dh - 1, iron[0]);
  img.rect(g.cx - 5, dy + 5, 10, 4, iron[0]); img.rect(g.cx - 4, dy + 6, 8, 2, slime[4]); img.px(g.cx - 4, dy + 6, slime[5]); img.vline(g.cx - 1, dy + 6, 2, iron[0]); img.vline(g.cx + 2, dy + 6, 2, iron[0]);
  img.rect(g.cx + 3, dy + 17, 2, 3, GOLD[3]);
  // glowing portholes with slime drips
  for (const px of [g.wx + 16, g.wx + g.ww - 17]) {
    const py = g.wy + 8;
    img.ellipse(px + 0.5, py + 0.5, 7.2, 7.2, iron[0]); img.ellipse(px + 0.5, py + 0.5, 6.2, 6.2, iron[4]); img.ellipse(px + 0.5, py + 0.5, 4.6, 4.6, iron[0]);
    img.ellipse(px + 0.5, py + 0.5, 3.8, 3.8, slime[3]); img.ellipse(px - 0.5, py - 0.5, 2.2, 2.2, slime[4]); img.px(px - 2, py - 2, slime[5]);
    for (const [ox, len] of [[-2, 7], [1, 11], [3, 5]] as const) {
      img.vline(px + ox, py + 4, len, slime[3]); img.px(px + ox, py + 4 + len, slime[2]); img.px(px + ox, py + 4, slime[4]);
    }
  }
  // top window in the arch and slime oozing from under the roof
  const ty = g.faceTop + 12;
  img.ellipse(g.cx + 0.5, ty + 0.5, 6.4, 6.4, iron[0]); img.ellipse(g.cx + 0.5, ty + 0.5, 5.4, 5.4, iron[4]); img.ellipse(g.cx + 0.5, ty + 0.5, 3.8, 3.8, slime[3]);
  img.ellipse(g.cx - 0.5, ty - 0.5, 2, 2, slime[4]); img.vline(g.cx, ty - 3, 8, iron[0]); img.hline(g.cx - 3, ty, 8, iron[0]);
  // slime puddle and blob at the front
  img.ellipse(g.wx + 28, bot - 1, 8, 2.4, slime[1]); img.ellipse(g.wx + 27, bot - 2, 6, 1.6, slime[3]); img.px(g.wx + 24, bot - 3, slime[5]);
  const sx = g.wx + g.ww - 30, sy = bot - 5;
  img.ellipse(sx, sy, 6.5, 5.5, slime[0]); img.ellipse(sx, sy, 5.5, 4.5, slime[3]); img.ellipse(sx - 1.5, sy - 1.5, 3, 2, slime[4]); img.px(sx - 3, sy - 3, slime[5]);
  img.px(sx - 2, sy, OUTLINE); img.px(sx + 2, sy, OUTLINE);
  // bent pipe on the roof
  const px0 = g.cx + 26, py0 = top + 2;
  img.rect(px0, py0, 6, 16, iron[0]); img.rect(px0 + 1, py0 + 1, 4, 15, iron[3]); img.vline(px0 + 1, py0 + 1, 15, iron[5]);
  img.rect(px0 - 1, py0 - 1, 8, 3, iron[0]); img.hline(px0, py0, 6, snow ? SNOW : iron[4]);
  img.ellipse(px0 + 3, py0 - 4, 2.6, 2.6, slime[3]); img.px(px0 + 2, py0 - 5, slime[5]); img.px(px0 + 7, py0 - 9, slime[4]); img.px(px0 + 8, py0 - 9, slime[3]); img.px(px0 + 7, py0 - 8, slime[3]);
}

// ---------------------------------------------------------------- silo, well, mill
function silo(b: B) {
  const { img, x, bot, snow, spec } = b;
  const t = tones(spec.wall), m = tones(spec.roof), cx = x + 24, R = 16, topY = bot - 72;
  const sag = (dx: number) => Math.round(3 * (1 - dx * dx));
  for (let i = -R; i < R; i++) {
    const dx = (i + 0.5) / R, u = (i + R) / (2 * R), k = cyl(u), s = sag(dx);
    for (let j = topY; j <= bot - 3 + s; j++) {
      let c = t[k];
      if ((i + R) % 4 === 3) c = t[Math.max(0, k - 1)];
      const hr = (j - topY - s) % 17;
      if (hr === 9) c = m[Math.min(5, k + 1)]; else if (hr === 10) c = m[Math.max(0, k - 2)];
      if (j >= bot - 4 + s) c = STONE[Math.max(1, k - 1)];
      img.px(cx + i, j, c);
    }
  }
  // dome
  const DR = 18.5;
  for (let i = -18; i <= 18; i++) {
    const dx = i / DR, u = (i + 18) / 36, k = cyl(u);
    const y0 = Math.round(topY + 2 - 22 * Math.sqrt(Math.max(0, 1 - dx * dx))), y1 = topY + 1 + Math.round(4 * (1 - dx * dx));
    for (let j = y0; j <= y1; j++) {
      let c = m[k];
      if (Math.abs(i) % 6 === 5) c = m[Math.max(0, k - 1)];
      if (snow && j < y0 + (y1 - y0) * 0.5 + (hash(i >> 1, 1, 3) - 0.5) * 4) c = j > y0 + (y1 - y0) * 0.5 - 2 ? SNOW2 : SNOW;
      if (j === y1) c = m[0]; else if (j === y1 - 1) c = m[Math.min(5, k + 1)];
      img.px(cx + i, j, c);
    }
  }
  dark(img, cx - R, topY + 5, 2 * R, 2, 0.3);
  img.rect(cx - 1, topY - 25, 3, 5, m[0]); img.ellipse(cx + 0.5, topY - 26, 2.4, 2.4, m[0]); img.px(cx, topY - 27, GOLD[4]); img.px(cx, topY - 26, GOLD[3]); img.px(cx + 1, topY - 26, GOLD[2]);
  // ladder
  const lx = cx + 5;
  img.vline(lx, topY + 6, bot - topY - 8, DARKWOOD[0]); img.vline(lx + 5, topY + 6, bot - topY - 8, DARKWOOD[0]);
  for (let j = topY + 8; j < bot - 3; j += 4) img.hline(lx + 1, j, 4, DARKWOOD[2]);
  // hatch
  const hx = cx - 12, hy = bot - 17;
  img.rect(hx - 1, hy - 1, 12, 16, t[0]); img.rect(hx, hy, 10, 14, DARKWOOD[3]); img.vline(hx + 3, hy, 14, DARKWOOD[2]); img.vline(hx + 6, hy, 14, DARKWOOD[2]);
  img.hline(hx, hy, 10, DARKWOOD[5]); img.hline(hx, hy + 3, 10, m[3]); img.hline(hx, hy + 10, 10, m[3]); img.px(hx + 8, hy + 7, GOLD[4]);
  // spilled hay
  img.ellipse(cx - 12, bot, 5, 2, HAY[3]); img.px(cx - 14, bot - 2, HAY[4]); img.px(cx - 10, bot - 1, HAY[5]); img.px(cx - 16, bot, HAY[2]);
}

function well(b: B) {
  const { img, x, y, bot, snow, spec } = b;
  const cx = x + 24, ry0 = bot - 17, RX = 19, RY = 7;
  const wood = tones(spec.roof);
  masked(img, cx - RX, ry0, 2 * RX, 18, (t, fx, fy, fw, fh) => stoneWall(t, fx, fy, fw, fh, STONE, 2), (i, j) => j <= 10 || inEll(i, j, RX, 10, RX, RY));
  for (let i = 0; i < 2 * RX; i++) { const u = i / (2 * RX); if (u < 0.12) dark(img, cx - RX + i, ry0, 1, 18, 0.12); if (u > 0.72) dark(img, cx - RX + i, ry0, 1, 18, u > 0.88 ? 0.4 : 0.22); }
  // rim
  img.ellipse(cx, ry0, RX, RY, STONE[0]); img.ellipse(cx, ry0 - 1, RX, RY, snow ? SNOW : STONE[4]);
  for (let a = 0; a < 12; a++) { const an = (a / 12) * Math.PI * 2 + 0.2; if (!snow) img.line(cx + Math.cos(an) * 14, ry0 - 1 + Math.sin(an) * 4.6, cx + Math.cos(an) * 18, ry0 - 1 + Math.sin(an) * 6.2, STONE[2]); }
  img.ellipse(cx, ry0 - 1, 14, 4.6, STONE[0]); img.ellipse(cx, ry0 - 0.5, 13, 3.8, STONE[1]);
  img.ellipse(cx, ry0 + 0.8, 12.4, 2.6, hex('#2c63a8')); img.ellipse(cx - 1, ry0 + 1.2, 9, 1.6, hex('#3f86cc')); img.hline(cx - 6, ry0 + 1, 4, hex('#9bd0f2'));
  // posts
  const py = y + 14;
  for (const px of [cx - 18, cx + 15]) { img.rect(px - 1, py, 5, ry0 - py, wood[0]); img.rect(px, py, 3, ry0 - py, wood[3]); img.vline(px, py, ry0 - py, wood[5]); img.vline(px + 2, py, ry0 - py, wood[2]); }
  // windlass, rope and bucket
  img.rect(cx - 16, py + 9, 32, 4, wood[0]); img.rect(cx - 15, py + 10, 30, 2, wood[4]); img.hline(cx - 15, py + 11, 30, wood[2]);
  for (let i = -5; i <= 4; i += 2) img.vline(cx + i, py + 9, 4, hex('#d8c08a'));
  img.rect(cx + 18, py + 9, 3, 2, OUTLINE); img.rect(cx + 20, py + 9, 2, 6, OUTLINE);
  img.vline(cx, py + 13, 7, hex('#d8c08a'));
  const bk = tones('#a86a36');
  img.rect(cx - 4, py + 20, 9, 8, bk[0]); img.rect(cx - 3, py + 21, 7, 6, bk[3]); img.vline(cx - 3, py + 21, 6, bk[5]); img.vline(cx + 3, py + 21, 6, bk[2]); img.hline(cx - 3, py + 23, 7, STONE[2]); img.hline(cx - 3, py + 21, 7, hex('#72b8e2'));
  // roof
  slopeRoof(img, cx - 22, y + 2, 44, 15, wood, { inset: 5, snow, rowH: 4 });
  dark(img, cx - 19, y + 17, 38, 2, 0.3);
}

function mill(b: B) {
  const { img, x, y, bot, snow, spec } = b;
  const cx = x + 32, yT = y + 36, t = tones(spec.wall), roof = tones(spec.roof), tim = DARKWOOD;
  const hwAt = (j: number) => 14 + ((j - yT) / (bot - yT)) * 9;
  for (let j = yT; j <= bot; j++) {
    const hw = Math.round(hwAt(j));
    for (let i = -hw; i < hw; i++) {
      const u = (i + hw) / (2 * hw);
      let c = t[u < 0.1 ? 5 : u < 0.55 ? 4 : u < 0.82 ? 3 : 2];
      if (hash((i + 40) >> 2, j >> 1, 8) > 0.9 && (j >> 1) % 2 === 0) c = t[2];
      if (j > bot - 7) c = STONE[u < 0.5 ? 4 : 2]; if (j === bot - 7) c = STONE[5]; if (j > bot - 7 && ((j - bot) % 3 === 0 || (i + (j % 6 < 3 ? 0 : 3) + 60) % 7 === 0)) c = STONE[1];
      if (j === yT + 22 || j === yT + 23) c = j === yT + 22 ? tim[4] : tim[2];
      img.px(cx + i, j, c);
    }
  }
  dark(img, cx - 16, yT, 32, 3, 0.3);
  door(img, cx - 6, bot - 2 - 18, 12, 18, { t: tones('#7a4a2a'), trim: tones('#e8d4a8'), snow });
  win(img, cx - 5, yT + 30, 9, 9, { trim: tones('#7a4a2a'), snow, panes: 4 });
  // cap
  slopeRoof(img, cx - 19, y + 20, 38, 19, roof, { inset: 11, snow, rowH: 4 });
  // sails
  const hx = cx, hy = y + 32, sw = tones('#8a5a34'), cloth = tones('#f2e8cc');
  for (let k = 0; k < 4; k++) {
    const an = (28 + k * 90) * Math.PI / 180, dx = Math.cos(an), dy = Math.sin(an), px = -dy, py = dx;
    for (let s = 0; s <= 30; s += 0.5) {
      for (let p = 0; p <= 7; p += 0.5) {
        if (s < 9 && p > 1) continue;
        const X = Math.round(hx + s * dx + p * px), Y = Math.round(hy + s * dy + p * py);
        let c: RGBA;
        if (p <= 1) c = p < 0.5 ? sw[4] : sw[2];
        else if (p >= 6.5 || s >= 29.5 || s < 9.5) c = sw[3];
        else if (Math.floor(s - 9) % 5 === 4) c = sw[3];
        else c = snow && p > 4 ? SNOW : Math.floor(p) === 3 ? cloth[3] : cloth[4];
        img.px(X, Y, c);
      }
    }
  }
  img.ellipse(hx + 0.5, hy + 0.5, 3.6, 3.6, sw[0]); img.ellipse(hx + 0.5, hy + 0.5, 2.6, 2.6, sw[3]); img.px(hx, hy, GOLD[4]); img.px(hx - 1, hy - 1, sw[5]);
  // flour sacks
  const sk = tones('#e2d6b4');
  for (const [sx, sy] of [[cx + 17, bot - 4], [cx + 23, bot - 3]]) { img.ellipse(sx, sy, 4.6, 4.6, sk[0]); img.ellipse(sx, sy, 3.6, 3.6, sk[3]); img.px(sx - 2, sy - 2, sk[5]); img.rect(sx - 1, sy - 6, 3, 2, sk[0]); img.px(sx, sy - 5, sk[4]); }
}

// ---------------------------------------------------------------- flat things
function fishPond(b: B) {
  const { img, x, y, W, H, snow } = b;
  const rr = (i: number, j: number, ins: number, rad: number) => {
    const x0 = ins, y0 = ins, x1 = W - 1 - ins, y1 = H - 1 - ins;
    if (i < x0 || j < y0 || i > x1 || j > y1) return false;
    const qx = i < x0 + rad ? x0 + rad : i > x1 - rad ? x1 - rad : i, qy = j < y0 + rad ? y0 + rad : j > y1 - rad ? y1 - rad : j;
    return (i - qx) ** 2 + (j - qy) ** 2 <= rad * rad + 1;
  };
  const tmp = new Img(W, H);
  stoneWall(tmp, 0, 0, W, H, STONE, 12, 6);
  const wt = ['#2a67ad', '#3a84c8', '#4f9ddc', '#a8dcf6'];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!rr(i, j, 2, 10)) continue;
    let c: RGBA;
    if (rr(i, j, 8, 7)) {
      if (!rr(i, j - 5, 8, 7)) c = (j % 3 === 0) ? STONE[0] : STONE[1];
      else {
        c = hex(!rr(i, j - 8, 8, 7) ? wt[0] : wt[1]);
        if (rr(i, j - 8, 8, 7) && rr(i - 6, j, 8, 7) && hash(i >> 3, j >> 1, 4) > 0.8 && j % 4 === 1) c = hex(wt[2]);
        if (hash((i + 2) >> 3, j, 6) > 0.93 && rr(i, j - 10, 8, 7)) c = hex(wt[3]);
      }
    } else {
      c = tmp.get(i, j);
      if (!rr(i, j - 1, 2, 10)) c = snow ? SNOW : STONE[5];
      else if (snow && hash(i >> 1, j >> 1, 8) > 0.45 && !rr(i, j + 3, 8, 7)) c = hash(i, j, 9) > 0.8 ? SNOW2 : SNOW;
      if (!rr(i, j + 1, 2, 10) || !rr(i, j + 2, 2, 10)) c = STONE[1];
      if (rr(i, j + 1, 8, 7) && !rr(i, j - 3, 8, 7)) c = STONE[5];
    }
    img.px(x + i, y + j, c);
  }
  // fish
  const f = tones('#f08a2c');
  img.ellipse(x + 50, y + 55, 4.5, 2.2, hex('#24589a')); img.ellipse(x + 50, y + 54, 4, 1.8, f[3]); img.hline(x + 48, y + 53, 3, f[5]);
  img.px(x + 55, y + 53, f[3]); img.px(x + 55, y + 55, f[3]); img.px(x + 56, y + 52, f[2]); img.px(x + 56, y + 56, f[2]); img.px(x + 47, y + 54, OUTLINE);
  img.ellipse(x + 30, y + 34, 3, 1.4, hex('#24589a'));
  // lily pads
  const lp = tones(snow ? '#5f9a78' : '#4aa63e');
  for (const [lx, ly, r] of [[x + 25, y + 52, 6.5], [x + 56, y + 30, 4.5], [x + 33, y + 61, 3.5]] as const) {
    img.ellipse(lx, ly + 1, r, r * 0.62, hex('#24589a')); img.ellipse(lx, ly, r, r * 0.62, lp[3]); img.ellipse(lx - 1, ly - 0.6, r * 0.6, r * 0.3, lp[4]);
    img.line(lx, ly, lx + r, ly + 1, hex(wt[1])); img.line(lx, ly, lx + r, ly + 2, hex(wt[1]));
  }
  const pk = tones('#f58ab4');
  img.ellipse(x + 23.5, y + 50.5, 2.6, 2.2, pk[2]); img.ellipse(x + 23.5, y + 50, 1.8, 1.4, pk[4]); img.px(x + 23, y + 50, GOLD[4]);
  // cattails at the back-left corner
  for (const [rx0, hgt] of [[x + 14, 12], [x + 18, 16], [x + 21, 9]] as const) {
    img.vline(rx0, y + 22 - hgt, hgt, hex('#3c8f3e')); img.rect(rx0 - 1, y + 22 - hgt - 4, 3, 5, OUTLINE); img.vline(rx0, y + 22 - hgt - 3, 3, hex('#8a5a34'));
    img.px(rx0 + 1, y + 22 - Math.floor(hgt / 2), hex('#63b54a')); img.px(rx0 + 2, y + 21 - Math.floor(hgt / 2), hex('#63b54a'));
  }
}

function shippingBin(b: B) {
  const { img, x, bot, snow } = b;
  const t = tones('#b07238'), m = tones('#6c7480'), fy = bot - 13;
  // front
  img.rect(x + 2, fy, 28, 14, t[2]);
  for (let j = 0; j < 14; j++) { if (j % 5 === 4) img.hline(x + 2, fy + j, 28, t[1]); else if (j % 5 === 0) img.hline(x + 2, fy + j, 28, t[3]); }
  img.vline(x + 2, fy, 14, t[3]); img.vline(x + 29, fy, 14, t[1]);
  // lid (seen from above, slightly open at the front)
  const ly = fy - 12;
  img.rect(x + 2, ly + 1, 28, 9, t[4]); img.hline(x + 3, ly, 26, t[4]);
  img.hline(x + 3, ly, 26, snow ? SNOW : t[5]); if (snow) img.rect(x + 3, ly + 1, 26, 3, SNOW);
  img.hline(x + 2, ly + 4, 28, t[3]); img.hline(x + 2, ly + 8, 28, t[3]);
  for (const sx of [x + 11, x + 20]) img.vline(sx, ly + 1, 9, t[3]);
  img.rect(x + 2, ly + 10, 28, 2, t[0]); img.hline(x + 2, ly + 10, 28, t[2]);
  // iron bands and lock
  for (const sx of [x + 6, x + 24]) { img.rect(sx, ly + 1, 2, 9, m[4]); img.rect(sx, fy, 2, 14, m[3]); img.px(sx, fy + 3, m[5]); img.px(sx, fy + 10, m[5]); img.vline(sx + 2, fy, 14, t[0]); }
  img.rect(x + 13, fy - 2, 6, 7, OUTLINE); img.rect(x + 14, fy - 1, 4, 5, GOLD[3]); img.hline(x + 14, fy - 1, 4, GOLD[5]); img.px(x + 15, fy + 1, OUTLINE); img.px(x + 16, fy + 1, OUTLINE); img.px(x + 15, fy + 2, OUTLINE);
  img.hline(x + 2, bot, 28, t[0]);
}

function petBowl(b: B, kind: 'plain' | 'hay' | 'stone') {
  const { img, x, y, snow } = b;
  const cx = x + 16, cy = y + 17;
  // mat
  if (kind === 'plain') {
    const r = tones('#c8483c'), cr = tones('#f0e2c4');
    for (let j = 0; j < 20; j++) for (let i = 0; i < 26; i++) {
      if ((i === 0 || i === 25) && (j === 0 || j === 19)) continue;
      const edge = i < 2 || i > 23 || j < 2 || j > 17;
      img.px(x + 3 + i, y + 8 + j, edge ? r[2] : ((i - 2) >> 2) % 2 === ((j - 2) >> 2) % 2 ? r[3] : cr[4]);
    }
    for (let i = 1; i < 26; i += 2) { img.px(x + 3 + i, y + 7, cr[4]); img.px(x + 3 + i, y + 28, cr[3]); }
  } else if (kind === 'hay') {
    for (let j = 0; j < 20; j++) for (let i = 0; i < 26; i++) {
      if ((i < 2 || i > 23) && (j < 1 || j > 18)) continue;
      const v = hash(i >> 1, j, 3);
      img.px(x + 3 + i, y + 8 + j, j % 4 === 3 ? HAY[2] : v > 0.75 ? HAY[5] : v < 0.2 ? HAY[2] : (i + j) % 7 === 0 ? HAY[4] : HAY[3]);
    }
    for (let i = 0; i < 26; i += 3) { img.px(x + 3 + i, y + 7, HAY[4]); img.px(x + 4 + i, y + 28, HAY[2]); }
    for (const sx of [x + 8, x + 23]) img.vline(sx, y + 8, 20, hex('#a8472e'));
  } else {
    masked(img, x + 3, y + 8, 26, 20, (t, fx, fy, fw, fh) => stoneWall(t, fx, fy, fw, fh, STONE, 5, 7), (i, j) => !((i < 2 || i > 23) && (j < 2 || j > 17)));
    img.hline(x + 5, y + 8, 22, STONE[5]); img.line(x + 20, y + 10, x + 24, y + 15, STONE[1]); img.line(x + 24, y + 15, x + 23, y + 19, STONE[1]);
  }
  // bowl
  const bt = kind === 'plain' ? tones('#7f95b4') : kind === 'hay' ? tones('#a86a36') : tones('#a6a2a8');
  img.ellipse(cx, cy + 4, 9.5, 5, [24, 14, 22, 90]);
  img.ellipse(cx, cy + 2.5, 9, 5, bt[0]); img.ellipse(cx, cy + 1.5, 8, 4.4, bt[2]);
  img.ellipse(cx, cy, 9, 5, bt[0]); img.ellipse(cx, cy, 8, 4.2, bt[4]); img.ellipse(cx, cy + 0.4, 6.4, 3, bt[1]);
  if (kind === 'hay') {
    const k = tones('#9a5a30');
    img.ellipse(cx, cy + 0.8, 5.8, 2.4, k[3]);
    for (let n = 0; n < 9; n++) img.px(cx - 5 + Math.floor(hash(n, 1, 2) * 10), cy + Math.floor(hash(n, 2, 2) * 3), k[n % 2 ? 5 : 1]);
  } else {
    img.ellipse(cx, cy + 0.8, 5.8, 2.4, hex(snow ? '#bfe0f4' : '#3f8fd0')); img.hline(cx - 4, cy, 3, hex('#d6f1fb')); img.px(cx + 2, cy + 2, hex('#8cc8f0'));
  }
  img.px(cx - 6, cy - 2, bt[5]); img.px(cx - 5, cy - 3, bt[5]);
  if (kind === 'plain') { // bone on the bowl front
    const w = hex('#f7f0e0');
    img.hline(cx - 2, cy + 5, 5, w); img.px(cx - 3, cy + 4, w); img.px(cx - 3, cy + 6, w); img.px(cx + 3, cy + 4, w); img.px(cx + 3, cy + 6, w);
  }
}

// ---------------------------------------------------------------- junimo hut, obelisks, clock
function junimoHut(b: B) {
  const { img, x, y, bot, snow, spec } = b;
  const cx = x + 24, wood = tones(spec.wall), lf = tones(snow ? '#5a8f5c' : '#4f9a36');
  // woven wall
  masked(img, x + 9, bot - 24, 30, 25, (t, fx, fy, fw, fh) => { planksV(t, fx, fy, fw, fh, wood, 4, 3); for (let j = 3; j < fh; j += 6) t.hline(fx, fy + j, fw, wood[2]); },
    (i, j) => !((i < 2 || i > 27) && j > 22) && !((i < 1 || i > 28) && j > 20));
  for (let i = 0; i < 30; i++) { const u = i / 30; if (u > 0.75) dark(img, x + 9 + i, bot - 24, 1, 25, u > 0.9 ? 0.35 : 0.18); }
  // leafy dome roof
  const dcy = y + 38, RX = 22, RY = 27;
  for (let j = y + 10; j <= y + 43; j++) for (let i = x + 2; i <= x + 45; i++) {
    const dx = (i + 0.5 - cx) / RX, dy = (j + 0.5 - dcy) / RY;
    const low = j - (y + 37) - (((i - x) % 8 < 4) ? 2 : 0) - Math.abs(dx) * 3;
    if (dx * dx + dy * dy > 1 || (dy > 0 && false) || low > 3) continue;
    if (j > dcy && Math.abs(dx) > 0.98) continue;
    const row = Math.floor((j - y) / 5), u = (i - x) + (row % 2) * 3, cxp = u % 6, cyp = (j - y) % 5;
    const lit = -dx * 0.6 - dy * 0.9; // top-left light
    let k = lit > 0.75 ? 4 : lit > 0.25 ? 3 : lit > -0.25 ? 3 : 2;
    if (cyp === 4 || cxp === 0) k -= 1; else if (cyp === 0 && cxp > 1 && cxp < 5) k += 1;
    if (low > 1) k = 1;
    let c = lf[Math.max(0, Math.min(5, k))];
    if (snow && dy < -0.35 + (hash(i >> 1, 2, 4) - 0.5) * 0.2) c = dy > -0.42 ? SNOW2 : SNOW;
    img.px(i, j, c);
  }
  dark(img, x + 9, bot - 24, 30, 3, 0.0);
  // flowers on the roof
  if (!snow) for (const [fx, fy, col] of [[x + 12, y + 26, '#f6d040'], [x + 31, y + 20, '#f08ab0'], [x + 37, y + 32, '#f4f0e0'], [x + 19, y + 34, '#f08ab0'], [x + 26, y + 29, '#f6d040'], [x + 8, y + 36, '#f4f0e0']] as const) {
    img.px(fx, fy, hex(col)); img.px(fx + 1, fy, hex(col)); img.px(fx, fy + 1, hex(col)); img.px(fx + 1, fy + 1, hex('#e8a030'));
  }
  // sprout on top
  const sp = tones('#7fd04a');
  img.vline(cx, y + 5, 7, sp[1]); img.vline(cx - 1, y + 8, 4, sp[2]);
  img.ellipse(cx - 4, y + 5, 3.4, 2.2, sp[0]); img.ellipse(cx - 4, y + 5, 2.4, 1.3, sp[4]);
  img.ellipse(cx + 5, y + 3.5, 3.4, 2.2, sp[0]); img.ellipse(cx + 5, y + 3.5, 2.4, 1.3, sp[3]); img.px(cx + 4, y + 3, sp[5]);
  // round door and windows
  const dy0 = bot - 16;
  for (let j = 0; j < 16; j++) for (let i = -7; i < 7; i++) {
    const inA = (r: number) => j >= 7 ? Math.abs(i + 0.5) <= r : inEll(i, j, 0, 7, r, r);
    if (!inA(7)) continue;
    img.px(cx + i, dy0 + j, inA(4.6) ? hex(j < 4 ? '#1e1420' : '#33202a') : inA(6) ? (i < 0 ? wood[5] : wood[4]) : wood[0]);
  }
  img.px(cx - 2, dy0 + 8, GOLD[5]); img.px(cx + 1, dy0 + 8, GOLD[5]);
  for (const wx of [cx - 11, cx + 11]) { img.ellipse(wx + 0.5, bot - 12.5, 2.8, 2.8, wood[0]); img.ellipse(wx + 0.5, bot - 12.5, 1.8, 1.8, hex('#ffd468')); img.px(wx, bot - 13, hex('#fff3c0')); }
  // star charm over the door
  img.px(cx, dy0 - 3, GOLD[5]); img.hline(cx - 1, dy0 - 2, 3, GOLD[4]); img.px(cx, dy0 - 1, GOLD[3]);
  flowers(img, x + 4, bot, 6, 17, snow); flowers(img, x + 38, bot, 6, 18, snow);
}

type Theme = 'earth' | 'water' | 'desert' | 'island';
function obelisk(b: B, th: Theme) {
  const { img, x, y, bot, snow } = b;
  const cx = x + 24;
  const st = tones({ earth: '#8c8474', water: '#7689a6', desert: '#d9a862', island: '#8a5f6a' }[th]);
  const ac = tones({ earth: '#58c04a', water: '#3fa0f0', desert: '#f6a020', island: '#f0508c' }[th]);
  const yS = bot - 17, yT = y + 26;
  // stepped base
  const step = (sx: number, sy: number, sw: number, sh: number) => {
    img.rect(sx - 1, sy - 1, sw + 2, sh + 2, st[0]); img.rect(sx, sy, sw, sh, st[3]); img.rect(sx, sy, sw, 2, snow ? SNOW : st[5]);
    img.rect(sx + Math.floor(sw * 0.62), sy + 2, sw - Math.floor(sw * 0.62), sh - 2, st[2]); img.hline(sx, sy + sh - 1, sw, st[1]);
    for (let i = 6; i < sw - 2; i += 8) img.vline(sx + i, sy + 3, sh - 4, st[1]);
  };
  step(x + 6, bot - 8, 36, 9); step(x + 11, bot - 16, 26, 7);
  // shaft
  for (let j = yT; j <= yS; j++) {
    const hw = Math.round(6.5 + ((j - yT) / (yS - yT)) * 3.5), split = Math.round(hw * 0.3);
    for (let i = -hw; i < hw; i++) {
      let c = i < split ? st[3] : st[2];
      if (i === -hw) c = st[5]; else if (i === -hw + 1) c = st[4]; else if (i === hw - 1) c = st[1]; else if (i === split) c = st[4];
      if ((j - yT) % 15 === 14) c = i < split ? st[2] : st[1];
      img.px(cx + i, j, c);
    }
    img.px(cx - hw - 1, j, st[0]); img.px(cx + hw, j, st[0]);
  }
  // top
  if (th === 'earth' || th === 'desert') {
    const ph = th === 'desert' ? 13 : 10, cap = th === 'desert' ? GOLD : st;
    if (th === 'desert') { img.rect(cx - 9, yT - 3, 18, 4, st[0]); img.rect(cx - 8, yT - 2, 16, 2, st[4]); img.rect(cx + 2, yT - 2, 6, 2, st[2]); }
    const base = th === 'desert' ? yT - 3 : yT;
    for (let r = 0; r < ph; r++) {
      const hw = Math.max(1, Math.round(((r + 1) / ph) * 7)), j = base - ph + r;
      for (let i = -hw; i < hw; i++) img.px(cx + i, j, i < Math.round(hw * 0.3) ? (snow && r < ph * 0.5 ? SNOW : cap[i === -hw ? 5 : 4]) : snow && r < ph * 0.4 ? SNOW2 : cap[2]);
      img.px(cx - hw - 1, j, cap[0]); img.px(cx + hw, j, cap[0]);
    }
    img.px(cx - 1, base - ph - 1, cap[0]); img.px(cx, base - ph - 1, cap[0]);
  } else if (th === 'water') {
    img.rect(cx - 9, yT - 4, 18, 5, st[0]); img.rect(cx - 8, yT - 3, 16, 3, st[4]); img.rect(cx + 2, yT - 3, 6, 3, st[2]); img.hline(cx - 8, yT - 3, 16, snow ? SNOW : st[5]);
    img.ellipse(cx, yT - 11, 7.5, 7.5, ac[0]); img.ellipse(cx, yT - 11, 6.5, 6.5, ac[2]); img.ellipse(cx - 1, yT - 12, 5, 5, ac[3]); img.ellipse(cx - 2, yT - 13, 2.6, 2.4, ac[4]); img.px(cx - 4, yT - 15, ac[5]); img.px(cx - 3, yT - 15, hex('#ffffff'));
    img.hline(cx - 4, yT - 8, 3, ac[4]); img.hline(cx, yT - 7, 4, ac[4]);
  } else {
    // island: flared capital with a flame gem and palm leaves
    img.rect(cx - 11, yT - 6, 22, 7, st[0]); img.rect(cx - 10, yT - 5, 20, 5, st[3]); img.rect(cx - 10, yT - 5, 20, 2, snow ? SNOW : st[5]); img.rect(cx + 3, yT - 3, 7, 3, st[2]);
    for (let i = -8; i < 9; i += 4) img.px(cx + i, yT - 2, ac[4]);
    const pl = tones(snow ? '#5f9a78' : '#3fa850');
    for (const s of [-1, 1]) for (let k = 0; k < 11; k++) {
      const lx = cx + s * (2 + k), ly = yT - 9 - Math.round(Math.sin((k / 10) * Math.PI) * 6) + (k > 6 ? (k - 6) : 0);
      img.px(lx, ly, pl[s < 0 ? 4 : 3]); img.px(lx, ly + 1, pl[2]); if (k % 2 === 0) img.px(lx, ly + 2, pl[s < 0 ? 3 : 1]); img.px(lx, ly - 1, pl[0]);
    }
    img.ellipse(cx, yT - 10, 3.6, 4.2, ac[0]); img.ellipse(cx, yT - 10, 2.6, 3.2, ac[3]); img.px(cx - 1, yT - 12, ac[5]); img.px(cx, yT - 9, GOLD[4]);
  }
  // gem in a socket
  const gy = yT + 9;
  for (let r = -5; r <= 5; r++) { const hw = 5 - Math.abs(r); img.hline(cx - hw - 1, gy + r, hw * 2 + 2, st[0]); }
  for (let r = -4; r <= 4; r++) { const hw = 4 - Math.abs(r); for (let i = -hw; i <= hw - 1; i++) img.px(cx + i, gy + r, r < 0 ? (i < 0 ? ac[4] : ac[3]) : i < 0 ? ac[3] : ac[1]); }
  img.px(cx - 2, gy - 2, ac[5]); img.px(cx - 1, gy - 2, hex('#ffffff'));
  // carved glyphs
  for (let k = 0; k < 3; k++) {
    const ry = gy + 12 + k * 10, v = (k + th.length) % 3;
    if (th === 'water') { for (let i = -4; i < 4; i++) img.px(cx + i, ry + ((i + 8) % 4 < 2 ? 0 : 1), ac[4]); for (let i = -4; i < 4; i++) img.px(cx + i, ry + 3 + ((i + 9) % 4 < 2 ? 0 : 1), st[1]); }
    else if (th === 'desert') { img.hline(cx - 4, ry, 8, st[1]); img.rect(cx - 3, ry + 2, 2, 3, ac[2]); img.rect(cx + 1, ry + 2, 2, 3, st[1]); img.px(cx - 1, ry + 3, st[1]); }
    else if (th === 'earth') { img.vline(cx - 1, ry, 5, ac[v === 0 ? 4 : 2]); img.px(cx - 2, ry + 1, ac[4]); img.px(cx - 3, ry, ac[4]); img.px(cx, ry + 2, ac[3]); img.px(cx + 1, ry + 1, ac[3]); }
    else { img.px(cx - 3, ry + 1, ac[4]); img.px(cx - 2, ry, ac[4]); img.px(cx - 1, ry + 1, ac[4]); img.px(cx, ry, ac[4]); img.px(cx + 1, ry + 1, ac[3]); img.rect(cx - 2, ry + 3, 3, 2, st[1]); }
  }
  // theme dressing at the base
  if (th === 'earth') {
    const ms = snow ? ['#7aa888', '#5f8a6a'] : ['#6cc04a', '#3f8f3a'];
    for (let i = 0; i < 36; i++) if (hash(i >> 1, 1, 41) > 0.45) { img.px(x + 6 + i, bot - 8, hex(ms[0])); if (hash(i, 2, 41) > 0.5) img.px(x + 6 + i, bot - 7, hex(ms[1])); }
    for (let i = 0; i < 26; i++) if (hash(i >> 1, 3, 41) > 0.5) img.px(x + 11 + i, bot - 16, hex(ms[0]));
    let vx = cx - 9; for (let j = yS; j > yT + 26; j--) { img.px(vx, j, hex(ms[1])); if (j % 3 === 0) img.px(vx + (j % 2 ? 1 : -1), j, hex(ms[0])); if (j % 5 === 0) vx += 1; }
    flowers(img, x + 3, bot, 8, 43, snow); flowers(img, x + 37, bot, 8, 44, snow);
  } else if (th === 'water') {
    img.rect(x + 12, bot - 15, 24, 1, ac[3]); img.rect(x + 8, bot - 7, 32, 1, ac[2]);
    img.ellipse(cx - 13, bot, 6, 1.8, ac[2]); img.ellipse(cx - 13, bot - 0.5, 4, 1, ac[4]); img.ellipse(cx + 14, bot, 4, 1.4, ac[2]); img.px(cx + 13, bot - 1, ac[5]);
    img.vline(cx - 12, bot - 6, 4, ac[3]); img.vline(cx + 12, bot - 6, 3, ac[3]);
  } else if (th === 'desert') {
    const sd = tones('#e8cc88');
    img.ellipse(cx - 12, bot, 9, 3, sd[2]); img.ellipse(cx - 13, bot - 1, 7, 2, sd[4]); img.ellipse(cx + 13, bot, 8, 2.6, sd[2]); img.ellipse(cx + 12, bot - 1, 6, 1.6, sd[4]);
    const ct = tones('#4f9a4a');
    img.rect(cx + 14, bot - 10, 4, 9, ct[0]); img.rect(cx + 15, bot - 9, 2, 8, ct[3]); img.px(cx + 15, bot - 9, ct[5]); img.rect(cx + 18, bot - 7, 2, 2, ct[0]); img.rect(cx + 19, bot - 9, 2, 3, ct[0]); img.px(cx + 19, bot - 8, ct[3]); img.px(cx + 16, bot - 11, hex('#f08ab0'));
  } else {
    const pk = tones('#f58ab4'), sh = tones('#f4e2c8');
    img.ellipse(cx - 14, bot - 1, 4, 3, sh[0]); img.ellipse(cx - 14, bot - 1, 3, 2, sh[4]); img.px(cx - 15, bot - 1, pk[3]); img.px(cx - 13, bot, pk[3]);
    for (const [fx, fy] of [[cx + 12, bot - 2], [cx + 16, bot], [cx - 8, bot - 9]] as const) { if (snow) continue; img.rect(fx - 1, fy - 1, 3, 3, pk[3]); img.px(fx, fy, GOLD[4]); img.px(fx - 1, fy - 1, pk[5]); }
  }
}

function goldClock(b: B) {
  const { img, x, y, bot, snow } = b;
  const cx = x + 24, g = GOLD, hcy = y + 27, R = 17;
  const slabG = (sx: number, sy: number, sw: number, sh: number) => {
    img.rect(sx - 1, sy - 1, sw + 2, sh + 2, g[0]); img.rect(sx, sy, sw, sh, g[3]); img.rect(sx, sy, sw, 2, snow ? SNOW : g[5]);
    img.rect(sx + Math.floor(sw * 0.65), sy + 2, sw - Math.floor(sw * 0.65), sh - 2, g[2]); img.hline(sx, sy + sh - 1, sw, g[1]); img.vline(sx, sy, sh, g[5]);
  };
  slabG(x + 7, bot - 6, 34, 7); slabG(x + 11, bot - 12, 26, 5);
  // fluted pillar
  const pT = hcy + R - 3;
  for (let j = pT; j < bot - 12; j++) for (let i = -8; i < 8; i++) img.px(cx + i, j, g[[5, 4, 3, 4, 3, 2, 3, 4, 3, 2, 3, 2, 2, 1, 2, 1][i + 8]]);
  img.vline(cx - 9, pT, bot - 12 - pT, g[0]); img.vline(cx + 8, pT, bot - 12 - pT, g[0]);
  slabG(cx - 10, bot - 16, 20, 3);
  // scroll wings
  for (const s of [-1, 1]) {
    const wx = cx + s * 12 - (s < 0 ? 1 : 0), wy = pT + 4;
    img.ellipse(wx + 0.5, wy + 0.5, 4.2, 4.2, g[0]); img.ellipse(wx + 0.5, wy + 0.5, 3.2, 3.2, g[s < 0 ? 4 : 2]); img.ellipse(wx + 0.5, wy + 0.5, 1.4, 1.4, g[1]);
    img.px(wx - 1, wy - 2, g[5]);
  }
  // red gem on the pillar
  const rg = tones('#e83a4a'), bg = tones('#3fa0f0');
  img.rect(cx - 3, pT + 10, 6, 7, g[0]); img.rect(cx - 2, pT + 11, 4, 5, rg[3]); img.px(cx - 2, pT + 11, rg[5]); img.px(cx - 1, pT + 11, rg[4]); img.vline(cx + 1, pT + 12, 4, rg[1]);
  for (const s of [-10, 8]) { img.rect(cx + s, bot - 4, 3, 3, bg[3]); img.px(cx + s, bot - 4, bg[5]); }
  // clock head
  img.ellipse(cx, hcy, R, R, g[0]);
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    const d = Math.hypot(i + 0.5, j + 0.5);
    if (d > R - 1) continue;
    let c: RGBA;
    if (d > R - 5) { const l = (-(i + 0.5) - (j + 0.5)) / d; c = d > R - 2 ? g[l > 0.5 ? 4 : l < -0.5 ? 1 : 3] : d < R - 4 ? g[l > 0 ? 2 : 4] : g[l > 0.6 ? 5 : l > 0 ? 4 : l < -0.6 ? 2 : 3]; }
    else c = hex(j < -6 && d > R - 7 ? '#e6d8b0' : '#fff6dc');
    img.px(cx + i, hcy + j, c);
  }
  for (let a = 0; a < 12; a++) {
    const an = (a / 12) * Math.PI * 2, rr2 = R - 6.6;
    const tx = Math.floor(cx + Math.cos(an) * rr2), ty = Math.floor(hcy + Math.sin(an) * rr2);
    img.px(tx, ty, a % 3 === 0 ? hex('#7a3a1e') : hex('#c08a3a')); if (a % 3 === 0) img.px(tx - (Math.abs(Math.cos(an)) > 0.5 ? Math.sign(Math.cos(an)) : 0), ty - (Math.abs(Math.sin(an)) > 0.5 ? Math.sign(Math.sin(an)) : 0), hex('#7a3a1e'));
  }
  img.line(cx, hcy, cx, hcy - 9, hex('#3a2430')); img.line(cx - 1, hcy, cx - 1, hcy - 9, hex('#3a2430'));
  img.line(cx, hcy, cx + 6, hcy + 3, hex('#3a2430')); img.line(cx, hcy - 1, cx + 6, hcy + 2, hex('#3a2430'));
  img.rect(cx - 2, hcy - 2, 3, 3, hex('#3a2430')); img.px(cx - 1, hcy - 1, g[5]);
  // crown finial
  const fy = hcy - R;
  img.rect(cx - 5, fy - 3, 10, 4, g[0]); img.rect(cx - 4, fy - 2, 8, 2, g[4]); img.rect(cx + 1, fy - 2, 3, 2, g[2]);
  img.ellipse(cx, fy - 6, 3.2, 3.2, g[0]); img.ellipse(cx, fy - 6, 2.2, 2.2, snow ? SNOW : g[4]); img.px(cx - 1, fy - 7, hex('#ffffff'));
  img.px(cx - 6, fy - 4, g[0]); img.px(cx - 6, fy - 5, g[4]); img.px(cx + 5, fy - 4, g[0]); img.px(cx + 5, fy - 5, g[3]);
  // sparkles
  for (const [sx, sy] of [[x + 6, y + 12], [x + 42, y + 40], [x + 40, y + 8]] as const) { img.px(sx, sy, hex('#fff8d0')); img.px(sx - 1, sy, g[5]); img.px(sx + 1, sy, g[5]); img.px(sx, sy - 1, g[5]); img.px(sx, sy + 1, g[5]); }
}

// ---------------------------------------------------------------- dispatcher
/**
 * Draws a building at real size. The box is (x, y, W, H) with W = spec.w * 16 and H = (spec.h + spec.tall) * 16.
 * The footprint is the bottom spec.h * 16 pixels. Returns false when this module has no art for the building.
 */
export function paintBuilding(img: Img, x: number, y: number, W: number, H: number, name: string, spec: BuildingSpec, season: Season): boolean {
  const b: B = { img, x, y, W, H, snow: season === 'winter', bot: y + H - 2, spec, name };
  const n = name.toLowerCase();
  const tier = /deluxe|upgrade 2| 3$/.test(n) ? 2 : /big|upgrade 1| 2$/.test(n) ? 1 : 0;
  if (n.includes('barn')) barn(b, tier);
  else if (n.includes('coop')) coop(b, tier);
  else if (n.includes('shed')) shed(b, tier > 0);
  else if (n === 'stable') stable(b);
  else if (n.includes('cabin')) cabin(b, tier, n.startsWith('stone') ? 'stone' : n.startsWith('plank') ? 'plank' : n.startsWith('log') ? 'log' : 'plain');
  else if (n.startsWith('farmhouse')) farmhouse(b, tier);
  else if (n.startsWith('greenhouse')) greenhouse(b, n.includes('ruined'));
  else if (n.includes('slime')) slimeHutch(b);
  else if (n === 'silo') silo(b);
  else if (n === 'well') well(b);
  else if (n === 'mill') mill(b);
  else if (n.includes('fish pond')) { fishPond(b); return true; }
  else if (n.includes('shipping bin')) { img.ellipse(x + 16, y + H - 2, 14, 2, SHADOW); shippingBin(b); }
  else if (n.includes('pet bowl')) petBowl(b, n.startsWith('hay') ? 'hay' : n.startsWith('stone') ? 'stone' : 'plain');
  else if (n.includes('junimo')) junimoHut(b);
  else if (n.includes('obelisk')) obelisk(b, n.startsWith('earth') ? 'earth' : n.startsWith('water') ? 'water' : n.startsWith('desert') ? 'desert' : 'island');
  else if (n.includes('clock')) goldClock(b);
  else return false;
  void SNOW3;
  outline(img, x, y, W, H);
  return true;
}
