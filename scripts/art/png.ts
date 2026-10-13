/** Tiny pixel-art raster library used by the build-time art generator. */
import fs from 'node:fs';
import { PNG } from 'pngjs';
import UPNG from 'upng-js';

export type RGBA = [number, number, number, number];

export function hex(h: string, a = 255): RGBA {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16), a];
}

export function mix(a: RGBA, b: RGBA, t: number): RGBA {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round(a[3] + (b[3] - a[3]) * t),
  ];
}

const BLACKISH: RGBA = [30, 18, 24, 255];
const WHITE: RGBA = [255, 250, 235, 255];

/** Shade: t<0 darkens toward a warm black, t>0 lightens toward warm white. */
export function shade(c: RGBA, t: number): RGBA {
  return t < 0 ? mix(c, BLACKISH, -t) : mix(c, WHITE, t);
}

/** 5-step ramp: [outline, dark, base, light, highlight]. */
export type Ramp = [RGBA, RGBA, RGBA, RGBA, RGBA];
export function ramp(base: RGBA | string): Ramp {
  const b = typeof base === 'string' ? hex(base) : base;
  return [shade(b, -0.72), shade(b, -0.32), b, shade(b, 0.28), shade(b, 0.55)];
}

export class Rng {
  private s: number;
  constructor(seed: number | string) {
    this.s = typeof seed === 'number' ? seed >>> 0 : hashStr(seed);
    if (this.s === 0) this.s = 0x9e3779b9;
  }
  next() {
    // xorshift32
    let x = this.s;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    this.s = x;
    return x / 4294967296;
  }
  int(n: number) { return Math.floor(this.next() * n); }
  range(a: number, b: number) { return a + this.next() * (b - a); }
  pick<T>(arr: T[]): T { return arr[this.int(arr.length)]; }
  chance(p: number) { return this.next() < p; }
}

export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Img {
  w: number;
  h: number;
  data: Uint8ClampedArray;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  inb(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x: number, y: number): RGBA {
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }
  alpha(x: number, y: number) { return this.inb(x, y) ? this.data[(y * this.w + x) * 4 + 3] : 0; }
  px(x: number, y: number, c: RGBA) {
    x = Math.round(x); y = Math.round(y);
    if (!this.inb(x, y)) return;
    const i = (y * this.w + x) * 4;
    if (c[3] >= 255) {
      this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = 255;
    } else if (c[3] > 0) {
      const a = c[3] / 255;
      const da = this.data[i + 3] / 255;
      const oa = a + da * (1 - a);
      this.data[i] = (c[0] * a + this.data[i] * da * (1 - a)) / oa;
      this.data[i + 1] = (c[1] * a + this.data[i + 1] * da * (1 - a)) / oa;
      this.data[i + 2] = (c[2] * a + this.data[i + 2] * da * (1 - a)) / oa;
      this.data[i + 3] = oa * 255;
    }
  }
  rect(x: number, y: number, w: number, h: number, c: RGBA) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c);
  }
  /** Rectangle with 1px outline. */
  box(x: number, y: number, w: number, h: number, fill: RGBA, line: RGBA) {
    this.rect(x, y, w, h, line);
    this.rect(x + 1, y + 1, w - 2, h - 2, fill);
  }
  hline(x: number, y: number, w: number, c: RGBA) { this.rect(x, y, w, 1, c); }
  vline(x: number, y: number, h: number, c: RGBA) { this.rect(x, y, 1, h, c); }
  line(x0: number, y0: number, x1: number, y1: number, c: RGBA) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, c);
      }
    }
  }
  /** Shaded sphere-ish blob: light from top-left. */
  blob(cx: number, cy: number, rx: number, ry: number, r: Ramp) {
    this.ellipse(cx, cy, rx, ry, r[1]);
    this.ellipse(cx - rx * 0.15, cy - ry * 0.15, rx * 0.82, ry * 0.8, r[2]);
    this.ellipse(cx - rx * 0.35, cy - ry * 0.38, rx * 0.35, ry * 0.32, r[3]);
  }
  /** Add a 1px outline around opaque pixels inside a region. */
  outline(c: RGBA, x0 = 0, y0 = 0, w = this.w, h = this.h) {
    const marks: number[] = [];
    for (let y = y0 - 1; y <= y0 + h; y++) {
      for (let x = x0 - 1; x <= x0 + w; x++) {
        if (!this.inb(x, y) || this.alpha(x, y) > 0) continue;
        if (this.alpha(x - 1, y) > 128 || this.alpha(x + 1, y) > 128 || this.alpha(x, y - 1) > 128 || this.alpha(x, y + 1) > 128) {
          if (x >= x0 - 1 && x <= x0 + w && y >= y0 - 1 && y <= y0 + h) marks.push(x, y);
        }
      }
    }
    for (let i = 0; i < marks.length; i += 2) this.px(marks[i], marks[i + 1], c);
  }
  blit(src: Img, dx: number, dy: number, sx = 0, sy = 0, sw = src.w, sh = src.h) {
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const c = src.get(sx + x, sy + y);
        if (c[3]) this.px(dx + x, dy + y, c);
      }
    }
  }
  /** Copy with nearest-neighbor scaling (exact replacement, no blending). */
  blitScaled(src: Img, dx: number, dy: number, scale: number) {
    for (let y = 0; y < src.h * scale; y++) {
      for (let x = 0; x < src.w * scale; x++) {
        const c = src.get(Math.floor(x / scale), Math.floor(y / scale));
        if (!c[3]) continue;
        const X = dx + x, Y = dy + y;
        if (!this.inb(X, Y)) continue;
        const i = (Y * this.w + X) * 4;
        this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = c[3];
      }
    }
  }
  /** Bounding box of opaque pixels. */
  bounds() {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.alpha(x, y)) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  /** Save as a palette-quantized PNG (pixel art compresses ~5x better this way). */
  saveQuantized(file: string, colors = 256) {
    const buf = UPNG.encode([this.data.buffer.slice(0) as ArrayBuffer], this.w, this.h, colors);
    fs.writeFileSync(file, Buffer.from(buf));
  }
  save(file: string) {
    const png = new PNG({ width: this.w, height: this.h });
    png.data = Buffer.from(this.data.buffer);
    fs.writeFileSync(file, PNG.sync.write(png, { colorType: 6, deflateLevel: 9, deflateStrategy: 0 }));
  }
}

/** Nearest-neighbor downscale to fit within a box, keeping aspect. */
export function fitInto(src: Img, W: number, H: number): Img {
  const s = Math.min(W / src.w, H / src.h, 1);
  const w = Math.max(1, Math.round(src.w * s)), h = Math.max(1, Math.round(src.h * s));
  const out = new Img(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // Sample the pixel with the most coverage-ish (center sampling).
    const sx = Math.min(src.w - 1, Math.floor((x + 0.5) / s));
    const sy = Math.min(src.h - 1, Math.floor((y + 0.5) / s));
    const c = src.get(sx, sy);
    if (c[3]) out.px(x, y, c);
  }
  return out;
}
