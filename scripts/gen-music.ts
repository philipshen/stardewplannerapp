/**
 * Generates the app's ORIGINAL background music and UI sound effects by pure synthesis
 * (no samples, no downloads; every note below was written for this project).
 *
 *  - assets/music/{spring,summer,fall,winter,rain,night}.m4a   seamless loops, AAC stereo 44.1 kHz
 *  - assets/music/{forage,fishing,mining,fighting}.m4a          activity stations, same format
 *  - assets/music/{chores,harvest,mossy,berry,blade,hero,tide,catch,echoes,glowstone}.m4a
 *  - assets/sfx/{place,erase,tap,select,undo,error,build}.wav  16-bit mono 22.05 kHz
 *
 * Run:  npx tsx scripts/gen-music.ts            render + encode + check everything
 *       npx tsx scripts/gen-music.ts --only spring,rain,forage,fishing,mining,fighting
 *       npx tsx scripts/gen-music.ts --sheet    print the lead sheets + melody/harmony lint only
 *       npx tsx scripts/gen-music.ts --check    measure the files that already exist
 *       npx tsx scripts/gen-music.ts --sfx      sound effects only
 *
 * Deterministic: a seeded PRNG drives all humanisation and noise, so output is reproducible.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..');
const MUSIC_DIR = path.join(ROOT, 'assets', 'music');
const SFX_DIR = path.join(ROOT, 'assets', 'sfx');
const SCRATCH = path.join(ROOT, '.scratch', 'music');
const AFCONVERT = '/usr/bin/afconvert';
const FFMPEG = '/opt/homebrew/bin/ffmpeg';

const SR = 44100;
const TAU = Math.PI * 2;
const TAIL_SEC = 8; // reverb / release tail rendered past the loop end, then folded onto the start
const TARGET_LUFS = -16;
const CEILING = 0.7; // sample-peak ceiling of the limiter (leaves room for AAC overshoot)
const AAC_BITRATE = 112000;

// ───────────────────────────── utilities ─────────────────────────────

type Rng = () => number;
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: Rng) => (r() + r() + r() + r() - 2) * 1.732;
const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const db = (x: number) => 20 * Math.log10(Math.max(x, 1e-12));
const undb = (d: number) => Math.pow(10, d / 20);
const smooth = (x: number) => {
  const c = clamp(x, 0, 1);
  return c * c * (3 - 2 * c);
};

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const PC_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
function pcOf(name: string): number {
  const base = PC[name[0]];
  if (base === undefined) throw new Error(`bad pitch class "${name}"`);
  const acc = name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0;
  return (base + acc + 12) % 12;
}
function noteToMidi(s: string): number {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(s);
  if (!m) throw new Error(`bad note "${s}"`);
  return 12 * (parseInt(m[2], 10) + 1) + pcOf(m[1]);
}
const midiName = (m: number) => `${PC_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

type FilterType = 'lp' | 'hp' | 'bp' | 'peak' | 'hs' | 'ls';
class Biquad {
  b0 = 1; b1 = 0; b2 = 0; a1 = 0; a2 = 0;
  x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  constructor(type: FilterType, f: number, q: number, gainDb = 0, sr = SR) {
    const w = (TAU * clamp(f, 5, sr * 0.45)) / sr;
    const cs = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    const A = Math.pow(10, gainDb / 40);
    let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
    else {
      const s = 2 * Math.sqrt(A) * al;
      if (type === 'hs') {
        b0 = A * (A + 1 + (A - 1) * cs + s); b1 = -2 * A * (A - 1 + (A + 1) * cs); b2 = A * (A + 1 + (A - 1) * cs - s);
        a0 = A + 1 - (A - 1) * cs + s; a1 = 2 * (A - 1 - (A + 1) * cs); a2 = A + 1 - (A - 1) * cs - s;
      } else {
        b0 = A * (A + 1 - (A - 1) * cs + s); b1 = 2 * A * (A - 1 - (A + 1) * cs); b2 = A * (A + 1 - (A - 1) * cs - s);
        a0 = A + 1 + (A - 1) * cs + s; a1 = -2 * (A - 1 + (A + 1) * cs); a2 = A + 1 + (A - 1) * cs - s;
      }
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  tick(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
  run(buf: Float32Array): Float32Array {
    for (let i = 0; i < buf.length; i++) buf[i] = this.tick(buf[i]);
    return buf;
  }
}

/** Short raised-cosine fade on the last samples of a note buffer so truncation never clicks. */
function fadeEnds(out: Float32Array, inS: number, outS: number): Float32Array {
  const a = Math.min(Math.floor(inS * SR), out.length >> 1);
  const r = Math.min(Math.floor(outS * SR), out.length >> 1);
  for (let i = 0; i < a; i++) out[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / a);
  for (let i = 0; i < r; i++) out[out.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / r);
  return out;
}

// ───────────────────────────── instruments ─────────────────────────────

/** A voice renders one note (mono), including its own release tail. */
type Voice = (f: number, dur: number, vel: number, rng: Rng) => Float32Array;

/** Karplus-Strong plucked string with tuned all-pass, pick-position comb and damped release. */
function pluck(o: { t60: number; bright: number; pick?: number; rel?: number; tone?: number }): Voice {
  return (f, dur, vel, rng) => {
    const period = SR / f;
    const S = clamp(0.5 - 0.42 * o.bright * (0.45 + 0.55 * vel), 0.04, 0.5);
    const D = period - S;
    let N = Math.floor(D);
    let frac = D - N;
    if (frac < 0.2) { N -= 1; frac += 1; }
    N = Math.max(2, N);
    const C = (1 - frac) / (1 + frac);
    const t60 = o.t60 * Math.pow(196 / f, 0.4);
    const rho = Math.pow(10, -3 / (f * t60));
    const rel = o.rel ?? 0.2;
    const rhoRel = Math.pow(10, -3 / (f * rel));
    const onN = Math.floor(dur * SR);
    const total = Math.max(64, Math.min(Math.floor((dur + rel * 1.6) * SR), Math.floor(t60 * 1.3 * SR)));
    const exc = new Float32Array(N);
    const k = clamp(0.12 + 0.8 * o.bright * (0.3 + 0.7 * vel), 0.05, 1);
    let lp = 0, mean = 0;
    for (let i = 0; i < N; i++) { lp += k * (rng() * 2 - 1 - lp); exc[i] = lp; mean += lp; }
    mean /= N;
    const buf = new Float32Array(N);
    const pickN = Math.max(1, Math.round(N * (o.pick ?? 0.18)));
    let pk = 0;
    for (let i = 0; i < N; i++) {
      buf[i] = exc[i] - mean - 0.85 * (exc[(i - pickN + N) % N] - mean);
      pk = Math.max(pk, Math.abs(buf[i]));
    }
    const g = Math.pow(vel, 1.3) / (pk || 1);
    for (let i = 0; i < N; i++) buf[i] *= g;
    const out = new Float32Array(total);
    let p = 0, prev = 0, apx = 0, apy = 0;
    for (let i = 0; i < total; i++) {
      const y = buf[p];
      const l = (1 - S) * y + S * prev;
      prev = y;
      const ap = C * l + apx - C * apy;
      apx = l; apy = ap;
      buf[p] = ap * (i < onN ? rho : rhoRel);
      p++; if (p >= N) p = 0;
      out[i] = y;
    }
    if (o.tone) { new Biquad('lp', o.tone * (0.6 + 0.6 * vel), 0.7).run(out); }
    return fadeEnds(out, 0.0006, 0.01);
  };
}

interface Partial { r: number; a: number; t: number }
/** Modal synthesis: a bank of exponentially damped sine resonators (bars, bells, piano, bass). */
function modal(o: {
  partials: Partial[]; attack?: number; rel?: number; pitchT?: number; refF?: number; hard?: number;
  noise?: number; noiseHz?: number; noiseT?: number; trem?: [number, number]; maxT?: number;
}): Voice {
  return (f, dur, vel, rng) => {
    const rel = o.rel ?? 0.25;
    const scale = Math.pow((o.refF ?? 440) / f, o.pitchT ?? 0.5);
    let longest = 0;
    for (const p of o.partials) longest = Math.max(longest, p.t * scale);
    longest = Math.min(longest, o.maxT ?? 12);
    const onN = Math.floor(dur * SR);
    const total = Math.max(64, Math.min(Math.floor((dur + rel * 1.3) * SR), Math.floor(longest * 1.1 * SR)));
    const out = new Float32Array(total);
    const hard = o.hard ?? 0.6;
    for (const p of o.partials) {
      const fp = f * p.r;
      if (fp > SR * 0.4) continue;
      const t60 = Math.max(0.01, p.t * scale);
      const R = Math.pow(10, -3 / (t60 * SR));
      const w = (TAU * fp) / SR;
      const amp = p.a * Math.pow(vel, 1 + hard * Math.log2(Math.max(1, p.r)));
      const c = 2 * R * Math.cos(w);
      const R2 = R * R;
      let y2 = 0;
      let y1 = amp * R * Math.sin(w);
      out[1] += y1;
      for (let i = 2; i < total; i++) {
        const y = c * y1 - R2 * y2;
        y2 = y1; y1 = y;
        out[i] += y;
      }
    }
    if (o.noise) {
      const n = Math.min(total, Math.floor((o.noiseT ?? 0.012) * SR));
      const lp = new Biquad('lp', o.noiseHz ?? 2500, 0.7);
      for (let i = 0; i < n; i++) {
        const e = 1 - i / n;
        out[i] += lp.tick(rng() * 2 - 1) * e * e * o.noise * vel;
      }
    }
    const a = Math.max(2, Math.floor((o.attack ?? 0.002) * SR));
    const relK = Math.exp(-6.9 / (rel * SR));
    let rg = 1;
    const tr = o.trem;
    const ph0 = rng() * TAU;
    for (let i = 0; i < total; i++) {
      let g = i < a ? 0.5 - 0.5 * Math.cos((Math.PI * i) / a) : 1;
      if (i >= onN) { rg *= relK; g *= rg; }
      if (tr) g *= 1 - tr[1] * (0.5 + 0.5 * Math.sin((TAU * tr[0] * i) / SR + ph0));
      out[i] *= g;
    }
    return fadeEnds(out, 0, 0.012);
  };
}

/** Two-operator-pair FM electric piano (body + tine). */
function epiano(o: { t60: number; bark: number; tine: number; rel?: number }): Voice {
  return (f, dur, vel, rng) => {
    const rel = o.rel ?? 0.16;
    const t60 = o.t60 * Math.pow(261 / f, 0.35);
    const onN = Math.floor(dur * SR);
    const total = Math.max(64, Math.min(Math.floor((dur + rel * 1.3) * SR), Math.floor(t60 * SR)));
    const out = new Float32Array(total);
    const w = (TAU * f * Math.pow(2, (gauss(rng) * 1.5) / 1200)) / SR;
    const w2 = w * 1.0015;
    const dec = Math.exp(-6.9 / (t60 * SR));
    const relK = Math.exp(-6.9 / (rel * SR));
    const kI = Math.exp(-1 / (0.3 * SR));
    const kT = Math.exp(-1 / (0.045 * SR));
    let ph = 0, ph2 = rng() * TAU, amp = 1, iEnv = 1, tEnv = 1, rg = 1;
    const a = Math.floor(0.004 * SR);
    for (let i = 0; i < total; i++) {
      const I1 = vel * o.bark * (0.22 + 1.5 * iEnv);
      const body = Math.sin(ph + I1 * Math.sin(ph)) * 0.6 + Math.sin(ph2 + I1 * 0.8 * Math.sin(ph2)) * 0.4;
      const tine = Math.sin(ph + vel * 0.9 * tEnv * Math.sin(14 * ph));
      let g = amp * (i < a ? i / a : 1);
      if (i >= onN) { rg *= relK; g *= rg; }
      out[i] = (body * 0.85 + tine * o.tine * tEnv) * g * Math.pow(vel, 1.2);
      ph += w; ph2 += w2;
      if (ph > TAU) ph -= TAU;
      if (ph2 > TAU) ph2 -= TAU;
      amp *= dec; iEnv *= kI; tEnv *= kT;
    }
    return fadeEnds(out, 0, 0.012);
  };
}

/** Additive wind instrument with breath noise, pitch scoop, chiff and delayed vibrato. */
function wind(o: {
  harm: number[]; attack: number; rel: number; vib: number; vibRate?: number; vibDelay?: number;
  breath: number; chiff: number; scoop?: number;
}): Voice {
  return (f, dur, vel, rng) => {
    const onN = Math.max(1, Math.floor(dur * SR));
    const total = onN + Math.floor(o.rel * 1.2 * SR);
    const out = new Float32Array(total);
    const rate = (o.vibRate ?? 5.1) * (1 + 0.06 * gauss(rng));
    const vd = o.vibDelay ?? 0.22;
    const lph = rng() * TAU;
    const bp = new Biquad('bp', clamp(f * 2.2, 900, 3600), 1.1);
    const aK = Math.exp(-1 / ((o.attack / 3) * SR));
    const rK = Math.exp(-6.9 / (o.rel * SR));
    const bright = 0.5 + 0.7 * vel;
    const scoop = o.scoop ?? 0.012;
    const nh = o.harm.length;
    let ph = rng() * TAU, env = 0, rg = 1;
    for (let i = 0; i < total; i++) {
      const t = i / SR;
      const va = smooth((t - vd) / 0.35);
      const lfo = Math.sin(TAU * rate * t + lph);
      const fi = f * (1 + o.vib * va * lfo - scoop * Math.exp(-t / 0.03));
      ph += (TAU * fi) / SR;
      if (ph > TAU) ph -= TAU;
      let s = o.harm[0] * Math.sin(ph);
      for (let k = 1; k < nh; k++) {
        if (fi * (k + 1) < SR * 0.4) s += o.harm[k] * bright * Math.sin((k + 1) * ph);
      }
      env += (1 - env) * (1 - aK);
      let g = env * (0.84 + 0.16 * Math.min(1, t / 0.45)) * (1 + 0.07 * va * lfo);
      if (i >= onN) { rg *= rK; g *= rg; }
      const br = bp.tick(rng() * 2 - 1) * (o.breath + o.chiff * Math.exp(-t / 0.045));
      out[i] = (s + br) * g * Math.pow(vel, 1.1);
    }
    return fadeEnds(out, 0.002, 0.01);
  };
}

function blep(t: number, dt: number): number {
  if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
  if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
  return 0;
}

/** Bowed string: two detuned band-limited saws, low-pass, delayed vibrato, slow bow attack. */
function bowed(o: { attack: number; rel: number; vib: number; cutoff: number }): Voice {
  return (f, dur, vel, rng) => {
    const onN = Math.max(1, Math.floor(dur * SR));
    const total = onN + Math.floor(o.rel * 1.3 * SR);
    const out = new Float32Array(total);
    const lp = new Biquad('lp', clamp(f * o.cutoff * (0.7 + 0.5 * vel), 300, 6000), 0.75);
    const body = new Biquad('peak', 330, 1.0, 3);
    const rate = 5.3 * (1 + 0.05 * gauss(rng));
    const lph = rng() * TAU;
    let p1 = rng(), p2 = rng(), env = 0, rg = 1;
    const d1 = Math.pow(2, 4 / 1200), d2 = Math.pow(2, -4 / 1200);
    const aK = Math.exp(-1 / ((o.attack / 3) * SR));
    const rK = Math.exp(-6.9 / (o.rel * SR));
    for (let i = 0; i < total; i++) {
      const t = i / SR;
      const va = smooth((t - 0.25) / 0.4);
      const fi = f * (1 + o.vib * va * Math.sin(TAU * rate * t + lph));
      const dp1 = (fi * d1) / SR, dp2 = (fi * d2) / SR;
      p1 += dp1; if (p1 >= 1) p1 -= 1;
      p2 += dp2; if (p2 >= 1) p2 -= 1;
      const s = 2 * p1 - 1 - blep(p1, dp1) + (2 * p2 - 1 - blep(p2, dp2));
      env += (1 - env) * (1 - aK);
      let g = env;
      if (i >= onN) { rg *= rK; g *= rg; }
      out[i] = body.tick(lp.tick(s * 0.5)) * g * Math.pow(vel, 1.1);
    }
    return fadeEnds(out, 0.003, 0.012);
  };
}

/** Warm pad: three detuned saws through a 4-pole low-pass with slow attack and release. */
function pad(o: { cutoff: number; attack: number; rel: number; detune: number }): Voice {
  return (f, dur, vel, rng) => {
    const onN = Math.max(1, Math.floor(dur * SR));
    const relN = Math.floor(o.rel * SR);
    const total = onN + relN;
    const out = new Float32Array(total);
    const fc = o.cutoff * (0.8 + 0.4 * vel);
    const lp1 = new Biquad('lp', fc, 0.6);
    const lp2 = new Biquad('lp', fc, 0.6);
    const cents = [-o.detune, o.detune * 0.23, o.detune];
    const ph = [rng(), rng(), rng()];
    const dp = cents.map((c) => (f * Math.pow(2, (c + gauss(rng) * 1.5) / 1200)) / SR);
    const aN = Math.min(onN, Math.floor(o.attack * SR));
    const lfoR = 0.13 + 0.12 * rng();
    const lph = rng() * TAU;
    for (let i = 0; i < total; i++) {
      let s = 0;
      for (let k = 0; k < 3; k++) {
        ph[k] += dp[k]; if (ph[k] >= 1) ph[k] -= 1;
        s += 2 * ph[k] - 1 - blep(ph[k], dp[k]);
      }
      let g = i < aN ? 0.5 - 0.5 * Math.cos((Math.PI * i) / aN) : 1;
      if (i >= onN) g *= 0.5 + 0.5 * Math.cos((Math.PI * (i - onN)) / relN);
      g *= 1 + 0.08 * Math.sin((TAU * lfoR * i) / SR + lph);
      out[i] = lp2.tick(lp1.tick(s / 3)) * g * vel;
    }
    return out;
  };
}

/** Percussion from filtered noise and pitch-swept sines. */
function perc(kind: string): Voice {
  return (_f, _dur, vel, rng) => {
    const mk = (sec: number) => new Float32Array(Math.floor(sec * SR));
    let out: Float32Array;
    const noise = () => rng() * 2 - 1;
    switch (kind) {
      case 'kick': {
        out = mk(0.36);
        let ph = 0;
        const lp = new Biquad('lp', 900, 0.7);
        for (let i = 0; i < out.length; i++) {
          const t = i / SR;
          ph += (TAU * (47 + 75 * Math.exp(-t / 0.028))) / SR;
          out[i] = Math.sin(ph) * Math.exp(-t / 0.085) + lp.tick(noise()) * 0.25 * Math.exp(-t / 0.006);
        }
        break;
      }
      case 'lokick': {
        out = mk(0.4);
        let ph = 0;
        for (let i = 0; i < out.length; i++) {
          const t = i / SR;
          ph += (TAU * (52 + 48 * Math.exp(-t / 0.045))) / SR;
          out[i] = Math.tanh(Math.sin(ph) * 1.6 * Math.exp(-t / 0.11));
        }
        break;
      }
      case 'shaker': case 'hat': case 'brush': case 'snare': case 'tamb': case 'sleigh': case 'ride': {
        const cfg: Record<string, [number, FilterType, number, number, number, number]> = {
          // [length, filter, freq, q, attack, decay]
          shaker: [0.14, 'hp', 5200, 0.7, 0.01, 0.035],
          hat: [0.08, 'hp', 7000, 0.8, 0.001, 0.016],
          brush: [0.34, 'bp', 2600, 0.6, 0.03, 0.075],
          snare: [0.3, 'bp', 1900, 0.6, 0.002, 0.06],
          tamb: [0.25, 'hp', 6000, 0.8, 0.002, 0.05],
          sleigh: [0.4, 'hp', 6500, 0.8, 0.004, 0.09],
          ride: [0.4, 'hp', 4800, 0.7, 0.001, 0.04],
        };
        const [len, ft, fq, q, att, decay] = cfg[kind];
        out = mk(len);
        const flt = new Biquad(ft, fq, q);
        const soft = new Biquad('lp', kind === 'brush' || kind === 'snare' ? 8000 : 11000, 0.7);
        const jf = [5230, 6890, 8410, 9770];
        const jp = jf.map(() => rng() * TAU);
        for (let i = 0; i < out.length; i++) {
          const t = i / SR;
          const e = Math.min(1, t / att) * Math.exp(-Math.max(0, t - att) / decay);
          let s = soft.tick(flt.tick(noise())) * e;
          if (kind === 'snare') s += Math.sin(TAU * 185 * t) * 0.5 * Math.exp(-t / 0.045);
          if (kind === 'tamb' || kind === 'sleigh' || kind === 'ride') {
            let j = 0;
            for (let k = 0; k < jf.length; k++) j += Math.sin(TAU * jf[k] * t + jp[k]);
            s = s * 0.5 + j * 0.12 * Math.exp(-t / (kind === 'ride' ? 0.11 : decay * 1.6)) * (kind === 'sleigh' ? 0.6 + 0.4 * Math.sin(TAU * 31 * t) : 1);
          }
          out[i] = s;
        }
        break;
      }
      case 'congaH': case 'congaL': {
        out = mk(0.32);
        const f0 = kind === 'congaH' ? 300 : 196;
        const bp = new Biquad('bp', 1300, 1.2);
        let ph = 0;
        for (let i = 0; i < out.length; i++) {
          const t = i / SR;
          ph += (TAU * f0 * (1 + 0.12 * Math.exp(-t / 0.02))) / SR;
          out[i] = Math.sin(ph) * Math.exp(-t / 0.075) + 0.3 * Math.sin(ph * 1.59) * Math.exp(-t / 0.035) +
            bp.tick(noise()) * 0.5 * Math.exp(-t / 0.008);
        }
        break;
      }
      case 'snareM': {
        // tight marching snare: bright wire noise over a short drum tone
        out = mk(0.2);
        const hp = new Biquad('hp', 1400, 0.7), lp = new Biquad('lp', 9500, 0.7);
        for (let i = 0; i < out.length; i++) {
          const t = i / SR;
          out[i] = lp.tick(hp.tick(noise())) * Math.exp(-t / 0.045) + 0.45 * Math.sin(TAU * 215 * t) * Math.exp(-t / 0.03);
        }
        break;
      }
      case 'pickH': case 'pickL': {
        // pick-axe on stone: inharmonic metallic ping with a hard click
        out = mk(0.22);
        const base = kind === 'pickH' ? 2650 : 1980;
        const ratios = [1, 1.63, 2.41, 3.37], decs = [0.04, 0.028, 0.016, 0.009];
        for (let i = 0; i < out.length; i++) {
          const t = i / SR;
          let s2 = 0;
          for (let k = 0; k < 4; k++) s2 += Math.sin(TAU * base * ratios[k] * t) * Math.exp(-t / decs[k]) / (k + 1);
          out[i] = s2 + noise() * 0.6 * Math.exp(-t / 0.0015);
        }
        break;
      }
      case 'tomH': case 'tomL': {
        out = mk(0.34);
        const f0 = kind === 'tomH' ? 150 : 104;
        const lp = new Biquad('lp', 1500, 0.7);
        let ph = 0;
        for (let i = 0; i < out.length; i++) {
          const t = i / SR;
          ph += (TAU * f0 * (1 + 0.35 * Math.exp(-t / 0.03))) / SR;
          out[i] = Math.sin(ph) * Math.exp(-t / 0.085) + lp.tick(noise()) * 0.3 * Math.exp(-t / 0.012);
        }
        break;
      }
      case 'wood': case 'rim': {
        out = mk(0.14);
        const f0 = kind === 'wood' ? 1180 : 1650;
        for (let i = 0; i < out.length; i++) {
          const t = i / SR;
          out[i] = Math.sin(TAU * f0 * t) * Math.exp(-t / 0.014) + 0.4 * Math.sin(TAU * f0 * 1.71 * t) * Math.exp(-t / 0.008) +
            (kind === 'rim' ? 0.4 * Math.sin(TAU * 410 * t) * Math.exp(-t / 0.02) : 0);
        }
        break;
      }
      default:
        throw new Error(`unknown percussion "${kind}"`);
    }
    const g = Math.pow(vel, 1.2);
    for (let i = 0; i < out.length; i++) out[i] *= g;
    return fadeEnds(out, 0.0005, 0.01);
  };
}

/** Brass-like lead: detuned saws through a low-pass that opens with the attack (horn "blat"). */
function brass(o: { attack: number; rel: number; bright: number }): Voice {
  return (f, dur, vel, rng) => {
    const onN = Math.max(1, Math.floor(dur * SR));
    const total = onN + Math.floor(o.rel * 1.3 * SR);
    const out = new Float32Array(total);
    const rate = 5.4 * (1 + 0.05 * gauss(rng));
    const lph = rng() * TAU;
    const d1 = Math.pow(2, 3 / 1200), d2 = Math.pow(2, -3 / 1200);
    const aK = Math.exp(-1 / ((o.attack / 3) * SR));
    const rK = Math.exp(-6.9 / (o.rel * SR));
    const form = new Biquad('peak', 1150, 1.2, 3.5);
    let p1 = rng(), p2 = rng(), env = 0, rg = 1, l1 = 0, l2 = 0;
    for (let i = 0; i < total; i++) {
      const t = i / SR;
      const va = smooth((t - 0.22) / 0.3);
      const fi = f * (1 + 0.003 * va * Math.sin(TAU * rate * t + lph) - 0.012 * Math.exp(-t / 0.02));
      const dp1 = (fi * d1) / SR, dp2 = (fi * d2) / SR;
      p1 += dp1; if (p1 >= 1) p1 -= 1;
      p2 += dp2; if (p2 >= 1) p2 -= 1;
      const s = (2 * p1 - 1 - blep(p1, dp1) + (2 * p2 - 1 - blep(p2, dp2))) * 0.5;
      env += (1 - env) * (1 - aK);
      let g = env;
      if (i >= onN) { rg *= rK; g *= rg; }
      const fc = clamp(f * (1.3 + o.bright * (0.4 + vel) * g * (0.7 + 0.3 * Math.exp(-t / 0.3))), 150, 8000);
      const a = 1 - Math.exp((-TAU * fc) / SR);
      l1 += a * (s - l1); l2 += a * (l1 - l2);
      out[i] = form.tick(l2) * g * Math.pow(vel, 1.1);
    }
    return fadeEnds(out, 0.002, 0.01);
  };
}

/** Plucked synth bass: saw through a low-pass whose cutoff snaps shut after the attack. */
function synthBass(o: { cut: number; decay: number }): Voice {
  return (f, dur, vel, rng) => {
    const onN = Math.max(1, Math.floor(dur * SR));
    const total = onN + Math.floor(0.07 * SR);
    const out = new Float32Array(total);
    const dp = f / SR;
    let p = rng(), l1 = 0, l2 = 0;
    for (let i = 0; i < total; i++) {
      const t = i / SR;
      p += dp; if (p >= 1) p -= 1;
      const s = 2 * p - 1 - blep(p, dp) + 0.6 * Math.sin(TAU * p);
      const fc = clamp(f * (1.6 + o.cut * vel * Math.exp(-t / o.decay)), 60, 5000);
      const a = 1 - Math.exp((-TAU * fc) / SR);
      l1 += a * (s - l1); l2 += a * (l1 - l2);
      let g = Math.min(1, t / 0.004) * (0.75 + 0.25 * Math.exp(-t / 0.2));
      if (i >= onN) g *= Math.max(0, 1 - (i - onN) / (0.06 * SR));
      out[i] = l2 * g * Math.pow(vel, 1.1);
    }
    return fadeEnds(out, 0, 0.004);
  };
}

/** FM bell / crystal: sine carrier with an inharmonic modulator whose index decays. */
function fmBell(o: { ratio: number; index: number; t60: number; rel: number }): Voice {
  return (f, dur, vel, rng) => {
    const t60 = o.t60 * Math.pow(523 / f, 0.3);
    const onN = Math.floor(dur * SR);
    const total = Math.max(64, Math.min(Math.floor((dur + o.rel * 1.3) * SR), Math.floor(t60 * SR)));
    const out = new Float32Array(total);
    const w = (TAU * f) / SR, wm = w * o.ratio;
    const dec = Math.exp(-6.9 / (t60 * SR)), relK = Math.exp(-6.9 / (o.rel * SR)), kI = Math.exp(-1 / (0.28 * SR));
    let ph = 0, pm = rng() * 0.2, amp = 1, iEnv = 1, rg = 1;
    const a = Math.floor(0.002 * SR);
    for (let i = 0; i < total; i++) {
      const I = vel * o.index * (0.12 + iEnv);
      let g = amp * (i < a ? i / a : 1);
      if (i >= onN) { rg *= relK; g *= rg; }
      out[i] = (Math.sin(ph + I * Math.sin(pm)) * 0.75 + Math.sin(ph) * 0.3) * g * Math.pow(vel, 1.2);
      ph += w; pm += wm;
      if (ph > TAU) ph -= TAU;
      if (pm > TAU) pm -= TAU;
      amp *= dec; iEnv *= kI;
    }
    return fadeEnds(out, 0, 0.012);
  };
}

/** Chiptune oscillator: band-limited pulse or triangle with the stepped envelope of old sound chips. */
function chip(o: { wave: 'sq' | 'tri'; duty?: number; vib?: number }): Voice {
  return (f, dur, vel, rng) => {
    const onN = Math.max(1, Math.floor(dur * SR));
    const relN = Math.floor(0.035 * SR);
    const out = new Float32Array(onN + relN);
    const duty = o.duty ?? 0.5;
    const lph = rng() * TAU;
    const lp = new Biquad('lp', 8500, 0.7);
    let p = rng();
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const fi = f * (1 + (o.vib ?? 0) * smooth((t - 0.16) / 0.2) * Math.sin(TAU * 6 * t + lph));
      const dp = fi / SR;
      p += dp; if (p >= 1) p -= 1;
      let s: number;
      if (o.wave === 'sq') {
        let p2 = p + duty; if (p2 >= 1) p2 -= 1;
        s = (2 * p - 1 - blep(p, dp) - (2 * p2 - 1 - blep(p2, dp))) * 0.5;
      } else s = 4 * Math.abs(p - 0.5) - 1;
      let g = Math.min(1, t / 0.003) * (0.72 + 0.28 * Math.exp(-t / 0.07));
      if (i >= onN) g *= 1 - (i - onN) / relN;
      out[i] = lp.tick(s) * g * Math.pow(vel, 1.1);
    }
    return fadeEnds(out, 0, 0.003);
  };
}

// Instrument presets (all synthesized).
const V = {
  flute: wind({ harm: [1, 0.42, 0.17, 0.07, 0.03], attack: 0.05, rel: 0.09, vib: 0.0045, breath: 0.035, chiff: 0.16 }),
  softFlute: wind({ harm: [1, 0.28, 0.1, 0.03], attack: 0.07, rel: 0.14, vib: 0.006, vibRate: 4.6, breath: 0.05, chiff: 0.1 }),
  whistle: wind({ harm: [1, 0.2, 0.06, 0.02], attack: 0.022, rel: 0.06, vib: 0.0035, vibRate: 5.6, vibDelay: 0.15, breath: 0.03, chiff: 0.22, scoop: 0.02 }),
  clarinet: wind({ harm: [1, 0.04, 0.42, 0.03, 0.2, 0.02, 0.09], attack: 0.04, rel: 0.1, vib: 0.002, vibDelay: 0.4, breath: 0.012, chiff: 0.03, scoop: 0.004 }),
  harp: pluck({ t60: 3.2, bright: 0.62, pick: 0.3, rel: 0.5 }),
  guitar: pluck({ t60: 2.4, bright: 0.5, pick: 0.17, rel: 0.2, tone: 3800 }),
  nylon: pluck({ t60: 2.6, bright: 0.42, pick: 0.22, rel: 0.25, tone: 3400 }),
  mandolin: pluck({ t60: 1.1, bright: 0.8, pick: 0.12, rel: 0.12 }),
  piano: modal({
    partials: Array.from({ length: 12 }, (_, i) => {
      const n = i + 1;
      return [
        { r: n * Math.sqrt(1 + 0.0004 * n * n), a: Math.exp(-0.1 * (n - 1)) / Math.pow(n, 1.1), t: 6.5 / (1 + 0.32 * (n - 1)) },
        { r: n * Math.sqrt(1 + 0.0004 * n * n) * 1.0009, a: (0.45 * Math.exp(-0.1 * (n - 1))) / Math.pow(n, 1.1), t: 4.5 / (1 + 0.32 * (n - 1)) },
      ];
    }).flat(),
    attack: 0.004, rel: 0.28, pitchT: 0.55, refF: 262, hard: 0.55, noise: 0.25, noiseHz: 1400, noiseT: 0.02,
  }),
  celesta: modal({
    partials: [{ r: 1, a: 1, t: 2.2 }, { r: 2, a: 0.13, t: 1.1 }, { r: 4, a: 0.2, t: 0.45 }, { r: 6.27, a: 0.05, t: 0.18 }],
    attack: 0.002, rel: 0.5, pitchT: 0.4, hard: 0.5, refF: 660,
  }),
  bell: modal({
    partials: [{ r: 1, a: 1, t: 2.8 }, { r: 2.76, a: 0.4, t: 1.6 }, { r: 5.4, a: 0.2, t: 0.8 }, { r: 8.93, a: 0.07, t: 0.4 }],
    attack: 0.0015, rel: 1.2, pitchT: 0.3, hard: 0.5, refF: 1000,
  }),
  vibes: modal({
    partials: [{ r: 1, a: 1, t: 4.2 }, { r: 4, a: 0.4, t: 1.6 }, { r: 10, a: 0.1, t: 0.35 }],
    attack: 0.002, rel: 0.45, pitchT: 0.35, hard: 0.4, refF: 440, trem: [4.3, 0.22], noise: 0.14, noiseHz: 3000,
  }),
  marimba: modal({
    partials: [{ r: 1, a: 1, t: 0.75 }, { r: 3.93, a: 0.26, t: 0.2 }, { r: 9.4, a: 0.07, t: 0.06 }],
    attack: 0.0015, rel: 0.2, pitchT: 0.75, hard: 0.6, refF: 440, noise: 0.12, noiseHz: 1500, noiseT: 0.01,
  }),
  softBass: modal({
    partials: [{ r: 1, a: 1, t: 3.2 }, { r: 2, a: 0.5, t: 1.6 }, { r: 3, a: 0.26, t: 0.9 }, { r: 4, a: 0.12, t: 0.5 }, { r: 5, a: 0.06, t: 0.3 }],
    attack: 0.008, rel: 0.12, pitchT: 0.3, hard: 0.5, refF: 80,
  }),
  roundBass: modal({
    partials: [{ r: 1, a: 1, t: 4 }, { r: 2, a: 0.32, t: 1.4 }, { r: 3, a: 0.16, t: 0.6 }, { r: 4, a: 0.05, t: 0.3 }],
    attack: 0.014, rel: 0.14, pitchT: 0.3, hard: 0.4, refF: 80,
  }),
  upright: modal({
    partials: [{ r: 1, a: 1, t: 2.4 }, { r: 2, a: 0.6, t: 1.2 }, { r: 3, a: 0.34, t: 0.7 }, { r: 4, a: 0.2, t: 0.45 }, { r: 5, a: 0.1, t: 0.3 }, { r: 6, a: 0.06, t: 0.2 }],
    attack: 0.006, rel: 0.1, pitchT: 0.3, hard: 0.6, refF: 80, noise: 0.08, noiseHz: 900, noiseT: 0.012,
  }),
  ep: epiano({ t60: 5, bark: 1.0, tine: 0.22 }),
  softEp: epiano({ t60: 4, bark: 0.6, tine: 0.1 }),
  cello: bowed({ attack: 0.09, rel: 0.2, vib: 0.0045, cutoff: 5 }),
  viola: bowed({ attack: 0.12, rel: 0.25, vib: 0.004, cutoff: 3.2 }),
  pad: pad({ cutoff: 950, attack: 0.7, rel: 1.4, detune: 9 }),
  widePad: pad({ cutoff: 1250, attack: 1.1, rel: 2.2, detune: 11 }),
  // voices added for the activity stations
  ocarina: wind({ harm: [1, 0.11, 0.06, 0.015], attack: 0.03, rel: 0.07, vib: 0.004, vibRate: 5, breath: 0.05, chiff: 0.24, scoop: 0.015 }),
  pizz: pluck({ t60: 0.6, bright: 0.42, pick: 0.3, rel: 0.1, tone: 3200 }),
  kalimba: modal({
    partials: [{ r: 1, a: 1, t: 1.5 }, { r: 2, a: 0.09, t: 0.6 }, { r: 6.27, a: 0.3, t: 0.16 }, { r: 11.6, a: 0.08, t: 0.06 }],
    attack: 0.0015, rel: 0.3, pitchT: 0.5, hard: 0.5, refF: 523, noise: 0.1, noiseHz: 2500, noiseT: 0.008,
  }),
  crystal: fmBell({ ratio: 3.5, index: 2.0, t60: 3.2, rel: 0.8 }),
  brass: brass({ attack: 0.035, rel: 0.09, bright: 5.5 }),
  stab: bowed({ attack: 0.018, rel: 0.09, vib: 0, cutoff: 5.5 }),
  synthBass: synthBass({ cut: 5, decay: 0.09 }),
  // voices added for the second and third track of each station
  banjo: pluck({ t60: 0.9, bright: 0.8, pick: 0.08, rel: 0.1, tone: 6000 }),
  uke: pluck({ t60: 1.0, bright: 0.6, pick: 0.25, rel: 0.12, tone: 4600 }),
  fiddle: bowed({ attack: 0.045, rel: 0.09, vib: 0.004, cutoff: 6.5 }),
  accordion: bowed({ attack: 0.03, rel: 0.07, vib: 0.0006, cutoff: 7 }),
  melodica: bowed({ attack: 0.03, rel: 0.07, vib: 0.0022, cutoff: 4.5 }),
  breathFlute: wind({ harm: [1, 0.3, 0.12, 0.04], attack: 0.08, rel: 0.16, vib: 0.0055, vibRate: 4.7, breath: 0.1, chiff: 0.12 }),
  xylo: modal({
    partials: [{ r: 1, a: 1, t: 0.42 }, { r: 3, a: 0.3, t: 0.14 }, { r: 6.1, a: 0.15, t: 0.06 }, { r: 10.2, a: 0.06, t: 0.03 }],
    attack: 0.001, rel: 0.15, pitchT: 0.6, hard: 0.5, refF: 523, noise: 0.2, noiseHz: 4500, noiseT: 0.006,
  }),
  dryVibes: modal({
    partials: [{ r: 1, a: 1, t: 3.2 }, { r: 4, a: 0.36, t: 1.3 }, { r: 10, a: 0.1, t: 0.3 }],
    attack: 0.002, rel: 0.4, pitchT: 0.35, hard: 0.45, refF: 440, noise: 0.14, noiseHz: 3200,
  }),
  sqLead: chip({ wave: 'sq', duty: 0.5, vib: 0.004 }),
  sqThin: chip({ wave: 'sq', duty: 0.25 }),
  tri: chip({ wave: 'tri', vib: 0.003 }),
};

// ───────────────────────────── music theory helpers ─────────────────────────────

/** Chord qualities: intervals in voicing-priority order (guide tones first, root last). */
const QUALITIES: Record<string, number[]> = {
  '': [4, 7, 0], m: [3, 7, 0], '6': [4, 9, 7, 0], m6: [3, 9, 7, 0], '7': [4, 10, 7, 0], maj7: [4, 11, 7, 0],
  m7: [3, 10, 7, 0], m7b5: [3, 10, 6, 0], dim7: [3, 9, 6, 0], sus4: [5, 7, 0], sus2: [2, 7, 0], '7sus4': [5, 10, 7, 0],
  add9: [4, 2, 7, 0], madd9: [3, 2, 7, 0], maj9: [4, 11, 2, 7, 0], m9: [3, 10, 2, 7, 0], '9': [4, 10, 2, 7, 0],
  '9sus4': [5, 10, 2, 7, 0], '7b9': [4, 10, 1, 7, 0],
};
interface Chord { name: string; root: number; bass: number; ivs: number[]; pcs: number[]; slash: boolean }
function parseChord(name: string): Chord {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(name);
  if (!m) throw new Error(`bad chord "${name}"`);
  const ivs = QUALITIES[m[2]];
  if (!ivs) throw new Error(`unknown chord quality "${m[2]}" in "${name}"`);
  const root = pcOf(m[1]);
  return { name, root, bass: m[3] ? pcOf(m[3]) : root, ivs, pcs: ivs.map((i) => (root + i) % 12), slash: !!m[3] };
}
/** Close voicing around a fixed centre: common tones stay put, the rest move by step. */
function voicing(ch: Chord, center: number, voices: number): number[] {
  const out: number[] = [];
  for (const pc of ch.pcs.slice(0, voices)) {
    let n = center - 6;
    while (((n % 12) + 12) % 12 !== pc) n++;
    out.push(n);
  }
  return out.sort((a, b) => a - b);
}

interface NoteEv { beat: number; dur: number; midi: number; acc: number }
/** Melody notation: bars split by "|", tokens "E5:1.5" (pitch:beats), "r:1" rest, "~:2" tie, "!"/"?" accents. */
function parseMelody(src: string, bpb: number, startBeat: number, bars: number, ctx: string): NoteEv[] {
  const out: NoteEv[] = [];
  const barsSrc = src.split('|').map((s) => s.trim()).filter((s) => s.length > 0);
  if (barsSrc.length !== bars) throw new Error(`${ctx}: expected ${bars} bars, got ${barsSrc.length}`);
  barsSrc.forEach((bar, bi) => {
    let pos = 0;
    for (const tok of bar.split(/\s+/)) {
      const m = /^([A-G][#b]?-?\d|r|~):([\d.]+)([!?]?)$/.exec(tok);
      if (!m) throw new Error(`${ctx} bar ${bi + 1}: bad token "${tok}"`);
      const dur = parseFloat(m[2]);
      if (m[1] === '~') {
        const last = out[out.length - 1];
        if (!last) throw new Error(`${ctx} bar ${bi + 1}: tie without a note`);
        last.dur += dur;
      } else if (m[1] !== 'r') {
        out.push({ beat: startBeat + bi * bpb + pos, dur, midi: noteToMidi(m[1]), acc: m[3] === '!' ? 1.18 : m[3] === '?' ? 0.8 : 1 });
      }
      pos += dur;
    }
    if (Math.abs(pos - bpb) > 1e-6) throw new Error(`${ctx} bar ${bi + 1}: ${pos} beats, expected ${bpb}`);
  });
  return out;
}

// ───────────────────────────── track model ─────────────────────────────

interface Inst {
  voice: Voice;
  /** target level in dBFS: RMS over the active frames ("level") or the peak ("peak", percussion) */
  level?: number; peak?: number;
  pan?: number; spread?: number; rev?: number; del?: number; hp?: number; lp?: number;
  wide?: boolean; legato?: number; jitter?: number; lay?: number; oct?: number;
}
interface Layer {
  kind: 'chord' | 'bass' | 'perc' | 'pad';
  inst?: string; center?: number; voices?: number; lo?: number; strum?: number; vel?: number;
  pat?: string | string[];
  /** bass only: keep the pattern in bars that have two chords (default: state each root) */
  splitPat?: boolean;
}
interface Section {
  name: string; bars: number; chords: string; layers: string;
  parts?: Record<string, string>; dyn?: [number, number];
}
interface TrackDef {
  id: string; title: string; key: string; idea: string; seed: number;
  bpm: number; bpb: number; swing?: number; scale: number[];
  rev: { t60: number; damp: number; gain: number }; del: { gain: number; fb: number };
  inst: Record<string, Inst>; layers: Record<string, Layer>; sections: Section[];
  rain?: number; shelf?: number; presence?: number;
  /** compound metres: display text, strong positions in the bar and the length (in beats) of a "long" note */
  meter?: string; strong?: number[]; unit?: number; water?: number;
}
interface Span { b0: number; b1: number; ch: Chord }
interface Song {
  def: TrackDef; spans: Span[]; totalBeats: number;
  secs: { sec: Section; b0: number; b1: number }[];
  parts: { inst: string; sec: string; notes: NoteEv[] }[];
}

function buildSong(def: TrackDef): Song {
  const spans: Span[] = [];
  const secs: Song['secs'] = [];
  const parts: Song['parts'] = [];
  let beat = 0;
  for (const sec of def.sections) {
    const bars = sec.chords.split('|').map((s) => s.trim()).filter((s) => s.length > 0);
    if (bars.length !== sec.bars) throw new Error(`${def.id}/${sec.name}: ${bars.length} chord bars, expected ${sec.bars}`);
    bars.forEach((bar, bi) => {
      const names = bar.split(/\s+/);
      const len = def.bpb / names.length;
      names.forEach((nm, k) => {
        const b0 = beat + bi * def.bpb + k * len;
        spans.push({ b0, b1: b0 + len, ch: parseChord(nm) });
      });
    });
    for (const [inst, src] of Object.entries(sec.parts ?? {})) {
      if (!def.inst[inst]) throw new Error(`${def.id}/${sec.name}: unknown instrument "${inst}"`);
      parts.push({ inst, sec: sec.name, notes: parseMelody(src, def.bpb, beat, sec.bars, `${def.id}/${sec.name}/${inst}`) });
    }
    secs.push({ sec, b0: beat, b1: beat + sec.bars * def.bpb });
    beat += sec.bars * def.bpb;
  }
  return { def, spans, totalBeats: beat, secs, parts };
}
function spanAt(song: Song, beat: number): number {
  const b = ((beat % song.totalBeats) + song.totalBeats) % song.totalBeats;
  let lo = 0, hi = song.spans.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (song.spans[mid].b0 <= b + 1e-9) lo = mid; else hi = mid - 1;
  }
  return lo;
}

// ───────────────────────────── effects & mastering ─────────────────────────────

/** 8-line feedback delay network reverb (Householder mixing, damped, with input diffusion). */
function reverb(inL: Float32Array, inR: Float32Array, t60: number, damp: number): [Float32Array, Float32Array] {
  const n = inL.length;
  const lens = [1423, 1637, 1873, 2087, 2311, 2543, 2789, 3019];
  const lines = lens.map((l) => new Float32Array(l));
  const idx = new Int32Array(8);
  const g = lens.map((l) => Math.pow(10, (-3 * l) / (t60 * SR)));
  const lpState = new Float64Array(8);
  const outL = new Float32Array(n), outR = new Float32Array(n);
  const pre = Math.floor(0.018 * SR);
  const apLens = [225, 341, 441, 556];
  const apBuf = [0, 1, 2, 3].map((k) => new Float32Array(apLens[k]));
  const apIdx = new Int32Array(4);
  const ap = (k: number, x: number) => {
    const buf = apBuf[k];
    const d = buf[apIdx[k]];
    const y = d - 0.6 * x;
    buf[apIdx[k]] = x + 0.6 * y;
    apIdx[k] = (apIdx[k] + 1) % buf.length;
    return y;
  };
  const v = new Float64Array(8);
  for (let i = 0; i < n; i++) {
    const xl = i >= pre ? ap(1, ap(0, inL[i - pre])) : 0;
    const xr = i >= pre ? ap(3, ap(2, inR[i - pre])) : 0;
    let sum = 0;
    for (let k = 0; k < 8; k++) {
      const y = lines[k][idx[k]];
      lpState[k] += (1 - damp) * (y - lpState[k]);
      v[k] = lpState[k] * g[k];
      sum += v[k];
    }
    sum *= 0.25;
    for (let k = 0; k < 8; k++) {
      lines[k][idx[k]] = v[k] - sum + (k % 2 === 0 ? xl : xr) * 0.5;
      idx[k]++; if (idx[k] >= lens[k]) idx[k] = 0;
    }
    outL[i] = v[0] - v[3] + v[4] - v[7];
    outR[i] = v[1] - v[2] + v[5] - v[6];
  }
  for (const b of [outL, outR]) {
    new Biquad('hp', 220, 0.7).run(b);
    new Biquad('lp', 8000, 0.7).run(b);
  }
  return [outL, outR];
}

/** Tempo-synced ping-pong delay with a darkened feedback path. */
function pingPong(inp: Float32Array, tL: number, tR: number, fb: number): [Float32Array, Float32Array] {
  const n = inp.length;
  const nL = Math.max(1, Math.round(tL * SR)), nR = Math.max(1, Math.round(tR * SR));
  const bl = new Float32Array(nL), br = new Float32Array(nR);
  const outL = new Float32Array(n), outR = new Float32Array(n);
  let il = 0, ir = 0, lpl = 0, lpr = 0;
  for (let i = 0; i < n; i++) {
    const dl = bl[il], dr = br[ir];
    lpl += 0.3 * (dl - lpl); lpr += 0.3 * (dr - lpr);
    bl[il] = inp[i] + lpr * fb;
    br[ir] = lpl * fb + inp[i] * 0.3;
    il++; if (il >= nL) il = 0;
    ir++; if (ir >= nR) ir = 0;
    outL[i] = lpl; outR[i] = lpr;
  }
  return [outL, outR];
}

/** Seamlessly looping rain bed: band-limited noise with slow swells, droplets and a little crackle. */
function rainBed(n: number, rng: Rng): [Float32Array, Float32Array] {
  const X = Math.floor(2 * SR);
  const make = (): Float32Array => {
    const buf = new Float32Array(n + X);
    const hp = new Biquad('hp', 700, 0.6), lp = new Biquad('lp', 6500, 0.6), lp2 = new Biquad('lp', 9000, 0.7);
    const p1 = rng() * TAU, p2 = rng() * TAU;
    for (let i = 0; i < buf.length; i++) {
      const t = i / SR;
      const sw = 1 + 0.22 * Math.sin((TAU * t) / 9.7 + p1) + 0.12 * Math.sin((TAU * t) / 3.9 + p2);
      buf[i] = lp2.tick(lp.tick(hp.tick(rng() * 2 - 1))) * sw;
    }
    const drops = Math.floor((buf.length / SR) * 9);
    for (let d = 0; d < drops; d++) {
      const at = Math.floor(rng() * (buf.length - 2000));
      const f = 1500 + rng() * 3200, tau = 0.002 + rng() * 0.006, a = 0.25 + rng() * 0.6;
      const len = Math.floor(tau * 7 * SR);
      for (let i = 0; i < len; i++) buf[at + i] += a * Math.sin((TAU * f * i) / SR) * Math.exp(-i / (tau * SR)) * Math.min(1, i / 20);
    }
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (i < X) {
        const x = (i / X) * (Math.PI / 2);
        out[i] = buf[i] * Math.sin(x) + buf[n + i] * Math.cos(x);
      } else out[i] = buf[i];
    }
    return out;
  };
  const L = make(), R = make();
  // vinyl-style crackle, very sparse
  const clicks = Math.floor((n / SR) * 5);
  for (let c = 0; c < clicks; c++) {
    const at = 8 + Math.floor(rng() * (n - 16));
    const a = (0.4 + rng() * 1.2) * (rng() < 0.5 ? -1 : 1);
    const ch = rng() < 0.5 ? L : R;
    ch[at] += a; ch[at + 1] += a * 0.5; ch[at + 2] -= a * 0.3;
  }
  return [L, R];
}

/** Seamlessly looping water bed: slow lapping swells of soft noise plus faint high glints. */
function waterBed(n: number, rng: Rng): [Float32Array, Float32Array] {
  const X = Math.floor(2.5 * SR);
  const make = (): Float32Array => {
    const buf = new Float32Array(n + X);
    const hp = new Biquad('hp', 350, 0.6), lp = new Biquad('lp', 2400, 0.6), lp2 = new Biquad('lp', 4500, 0.7);
    const p1 = rng() * TAU, p2 = rng() * TAU, per1 = 5.1 + rng() * 1.5, per2 = 3.3 + rng();
    for (let i = 0; i < buf.length; i++) {
      const t = i / SR;
      const w1 = Math.sin((Math.PI * t) / per1 + p1), w2 = Math.sin((Math.PI * t) / per2 + p2);
      buf[i] = lp2.tick(lp.tick(hp.tick(rng() * 2 - 1))) * (0.25 + 0.5 * w1 * w1 + 0.25 * w2 * w2);
    }
    const glints = Math.floor((buf.length / SR) * 2.2);
    for (let d = 0; d < glints; d++) {
      const at = Math.floor(rng() * (buf.length - 12000));
      const f = 2800 + rng() * 3600, tau = 0.03 + rng() * 0.06, a = 0.06 + rng() * 0.1;
      const len = Math.floor(tau * 5 * SR);
      for (let i = 0; i < len; i++) buf[at + i] += a * Math.sin((TAU * f * i) / SR) * Math.exp(-i / (tau * SR)) * Math.min(1, i / 200);
    }
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (i < X) {
        const x = (i / X) * (Math.PI / 2);
        out[i] = buf[i] * Math.sin(x) + buf[n + i] * Math.cos(x);
      } else out[i] = buf[i];
    }
    return out;
  };
  return [make(), make()];
}

/** ITU-R BS.1770 integrated loudness (K-weighting + gating). */
function lufs(L: Float32Array, R: Float32Array, sr = SR): number {
  const kw = (x: Float32Array): Float64Array => {
    const out = new Float64Array(x.length);
    const mk = (f0: number, Q: number, G: number | null) => {
      const K = Math.tan((Math.PI * f0) / sr);
      const a0 = 1 + K / Q + K * K;
      if (G === null) return [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
      const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
      return [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
    };
    const s1 = mk(1681.974450955533, 0.7071752369554196, 3.999843853973347);
    const s2 = mk(38.13547087602444, 0.5003270373238773, null);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, u1 = 0, u2 = 0, v1 = 0, v2 = 0;
    for (let i = 0; i < x.length; i++) {
      const x0 = x[i];
      const y0 = s1[0] * x0 + s1[1] * x1 + s1[2] * x2 - s1[3] * y1 - s1[4] * y2;
      x2 = x1; x1 = x0; y2 = y1; y1 = y0;
      const v0 = s2[0] * y0 + s2[1] * u1 + s2[2] * u2 - s2[3] * v1 - s2[4] * v2;
      u2 = u1; u1 = y0; v2 = v1; v1 = v0;
      out[i] = v0;
    }
    return out;
  };
  const kl = kw(L), kr = kw(R);
  const blk = Math.floor(0.4 * sr), hop = Math.floor(0.1 * sr);
  const z: number[] = [];
  for (let s = 0; s + blk <= kl.length; s += hop) {
    let a = 0;
    for (let i = s; i < s + blk; i++) a += kl[i] * kl[i] + kr[i] * kr[i];
    z.push(a / blk);
  }
  const lk = (p: number) => -0.691 + 10 * Math.log10(Math.max(p, 1e-12));
  const g1 = z.filter((p) => lk(p) > -70);
  if (g1.length === 0) return -70;
  const rel = lk(g1.reduce((a, b) => a + b, 0) / g1.length) - 10;
  const g2 = g1.filter((p) => lk(p) > rel);
  return lk(g2.reduce((a, b) => a + b, 0) / Math.max(1, g2.length));
}

/** Look-ahead peak limiter computed circularly, so the gain curve itself loops seamlessly. */
function limitLoop(L: Float32Array, R: Float32Array, ceiling: number): { maxDb: number; activePct: number } {
  const n = L.length;
  const W = 264; // 6 ms
  const need = new Float32Array(n).fill(1);
  let touched = 0;
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (p > ceiling) {
      const g = ceiling / p;
      touched++;
      for (let j = i - W; j <= i + W; j++) {
        const k = ((j % n) + n) % n;
        if (need[k] > g) need[k] = g;
      }
    }
  }
  if (touched === 0) return { maxDb: 0, activePct: 0 };
  let minG = 1, active = 0;
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + need[i];
  const sumRange = (a: number, b: number) => { // inclusive, circular
    if (a < 0) return pre[n] - pre[a + n] + pre[b + 1];
    if (b >= n) return pre[n] - pre[a] + pre[b - n + 1];
    return pre[b + 1] - pre[a];
  };
  const h = W >> 1;
  for (let i = 0; i < n; i++) {
    const g = sumRange(i - h, i + h) / (2 * h + 1);
    if (g < minG) minG = g;
    if (g < 0.944) active++;
    L[i] *= g; R[i] *= g;
  }
  return { maxDb: -db(minG), activePct: (100 * active) / n };
}

// ───────────────────────────── renderer ─────────────────────────────

interface Pat3 { pos: number; a: string; dur: number; vel: number }
const patCache = new Map<string, Pat3[]>();
function parsePat(src: string, kind: Layer['kind']): Pat3[] {
  const key = kind + '|' + src;
  let p = patCache.get(key);
  if (!p) {
    p = src.trim().split(/\s+/).map((tok) => {
      const f = tok.split(':');
      if (kind === 'perc') return { pos: parseFloat(f[0]), a: f[1], dur: 0, vel: f[2] ? parseFloat(f[2]) : 0.6 };
      return { pos: parseFloat(f[0]), a: f[1], dur: parseFloat(f[2]), vel: f[3] ? parseFloat(f[3]) : 0.7 };
    });
    patCache.set(key, p);
  }
  return p;
}

interface Rendered { L: Float32Array; R: Float32Array; stems: Record<string, number>; sections: string[]; limiter: { maxDb: number; activePct: number } }

function renderTrack(def: TrackDef): Rendered {
  const song = buildSong(def);
  const rng = mulberry32(def.seed);
  const spb = 60 / def.bpm;
  const loopLen = Math.round(song.totalBeats * spb * SR);
  const N = loopLen + TAIL_SEC * SR;
  // The loop point sits a 16th before bar 1, inside the sustained end of the last bar, so the
  // file boundary never coincides with a note attack (forgiving for AAC priming / players).
  const shift = 0.25 * spb;
  const sw = def.swing ?? 0.5;
  const sec = (b: number) => {
    const w = Math.floor(b), fr = b - w;
    const f2 = fr < 0.5 ? fr * (sw / 0.5) : sw + (fr - 0.5) * ((1 - sw) / 0.5);
    return (w + f2) * spb;
  };
  const buses: Record<string, { L: Float32Array; R: Float32Array }> = {};
  for (const name of Object.keys(def.inst)) buses[name] = { L: new Float32Array(N), R: new Float32Array(N) };

  const play = (name: string, beat: number, durBeats: number, midi: number, vel: number, offMs = 0) => {
    const inst = def.inst[name];
    if (!inst) throw new Error(`${def.id}: unknown instrument "${name}"`);
    const bus = buses[name];
    const t0 = sec(beat) + shift + ((inst.lay ?? 0) + offMs + gauss(rng) * (inst.jitter ?? 6)) / 1000;
    const t1 = sec(beat + durBeats) + shift;
    const dur = Math.max(0.05, (t1 - t0) * (inst.legato ?? 0.95) * (0.96 + 0.06 * rng()));
    const v = clamp(vel * (1 + 0.07 * gauss(rng)), 0.05, 1);
    const f = mtof(midi + (inst.oct ?? 0) * 12);
    let start = Math.round(t0 * SR);
    if (start < 0) start += loopLen;
    const pan = clamp((inst.pan ?? 0) + (rng() - 0.5) * (inst.spread ?? 0), -1, 1);
    const mix = (buf: Float32Array, p: number, g: number) => {
      const th = ((p + 1) * Math.PI) / 4;
      const gl = Math.cos(th) * g, gr = Math.sin(th) * g;
      const end = Math.min(N, start + buf.length);
      for (let i = start, j = 0; i < end; i++, j++) { bus.L[i] += buf[j] * gl; bus.R[i] += buf[j] * gr; }
    };
    if (inst.wide) {
      mix(inst.voice(f, dur, v, rng), -0.75, 0.75);
      mix(inst.voice(f, dur, v, rng), 0.75, 0.75);
    } else mix(inst.voice(f, dur, v, rng), pan, 1);
  };

  const bassNote = (pc: number, lo: number) => { let n = lo; while (n % 12 !== pc) n++; return n; };
  const inScale = (m: number) => def.scale.includes(((m % 12) + 12) % 12);

  for (const s of song.secs) {
    const dyn = s.sec.dyn ?? [1, 1];
    const dynAt = (b: number) => dyn[0] + (dyn[1] - dyn[0]) * ((b - s.b0) / (s.b1 - s.b0));
    // written parts
    for (const part of song.parts.filter((p) => p.sec === s.sec.name)) {
      const mean = part.notes.reduce((a, n) => a + n.midi, 0) / Math.max(1, part.notes.length);
      for (const n of part.notes) {
        const inBar = (n.beat - s.b0) % def.bpb;
        const strong = inBar === 0 ? 1.07 : def.strong && !def.strong.includes(inBar) ? 0.94 : inBar % 1 === 0 ? 1 : 0.92;
        const contour = 1 + clamp((n.midi - mean) / 12, -1, 1) * 0.1;
        play(part.inst, n.beat, n.dur, n.midi, 0.72 * n.acc * strong * contour * dynAt(n.beat));
      }
    }
    // generated layers
    for (const tok of s.sec.layers.trim().split(/\s+/).filter((t) => t.length > 0)) {
      const [lname, multS] = tok.split('*');
      const layer = def.layers[lname];
      if (!layer) throw new Error(`${def.id}/${s.sec.name}: unknown layer "${lname}"`);
      const mult = (multS ? parseFloat(multS) : 1) * (layer.vel ?? 1);
      if (layer.kind === 'pad') {
        for (const sp of song.spans) {
          if (sp.b0 < s.b0 - 1e-9 || sp.b0 >= s.b1 - 1e-9) continue;
          for (const m of voicing(sp.ch, layer.center ?? 60, layer.voices ?? 4)) {
            play(layer.inst!, sp.b0, sp.b1 - sp.b0, m, 0.6 * mult * dynAt(sp.b0));
          }
        }
        continue;
      }
      for (let bar = 0; bar < s.sec.bars; bar++) {
        const b0 = s.b0 + bar * def.bpb;
        const pats = Array.isArray(layer.pat) ? layer.pat : [layer.pat ?? ''];
        const pat = parsePat(pats[bar % pats.length], layer.kind);
        if (layer.kind === 'perc') {
          for (const e of pat) play(e.a, b0 + e.pos, 0.25, 60, e.vel * mult * dynAt(b0 + e.pos));
        } else if (layer.kind === 'chord') {
          for (const e of pat) {
            const beat = b0 + e.pos;
            const v = voicing(song.spans[spanAt(song, beat)].ch, layer.center ?? 60, layer.voices ?? 4);
            const down = e.a.startsWith('d');
            const sel = e.a.replace('d', '');
            const idxs = sel === 'x' ? v.map((_, i) => i) : sel.split('').map((c) => parseInt(c, 10));
            const order = down ? [...idxs].reverse() : idxs;
            order.forEach((ix, k) => {
              const m = v[ix % v.length] + 12 * Math.floor(ix / v.length);
              const vel = e.vel * mult * dynAt(beat) * (idxs.length > 1 ? 0.92 - 0.03 * k : 1);
              play(layer.inst!, beat, e.dur, m, vel, k * (layer.strum ?? 12));
            });
          }
        } else {
          // bass: follow the pattern, but in bars with two chords just state each root
          const lo = layer.lo ?? 36;
          const si = spanAt(song, b0);
          const split = !layer.splitPat && song.spans[si].b1 < b0 + def.bpb - 1e-9;
          const evs: Pat3[] = split
            ? song.spans.filter((sp) => sp.b0 >= b0 - 1e-9 && sp.b0 < b0 + def.bpb - 1e-9).map((sp, k) => ({ pos: sp.b0 - b0, a: 'R', dur: sp.b1 - sp.b0, vel: k === 0 ? 0.8 : 0.7 }))
            : pat;
          for (const e of evs) {
            const beat = b0 + e.pos;
            const ci = spanAt(song, beat);
            const ch = song.spans[ci].ch;
            const root = bassNote(ch.bass, lo);
            let m = root;
            const fifthIv = ch.ivs.includes(7) ? 7 : ch.ivs.includes(6) ? 6 : 7;
            const fifth = () => {
              if (ch.slash) return bassNote(ch.root, lo);
              return root + fifthIv - 12 >= lo - 3 ? root + fifthIv - 12 : root + fifthIv;
            };
            if (e.a === '5') m = fifth();
            else if (e.a === '8') m = root + 12;
            else if (e.a === 'A') {
              const next = song.spans[(ci + 1) % song.spans.length].ch;
              if (next.bass === ch.bass) m = fifth();
              else {
                let target = bassNote(next.bass, lo);
                if (target - root > 6) target -= 12; else if (root - target > 6) target += 12;
                const dir = target >= root ? -1 : 1;
                m = inScale(target + dir) ? target + dir : inScale(target + 2 * dir) ? target + 2 * dir : target + dir;
              }
            }
            play(layer.inst!, beat, e.dur, m, e.vel * mult * dynAt(beat));
          }
        }
      }
    }
  }

  // ── mix ──
  const dryL = new Float32Array(N), dryR = new Float32Array(N);
  const revL = new Float32Array(N), revR = new Float32Array(N), delIn = new Float32Array(N);
  const stems: Record<string, number> = {};
  for (const [name, inst] of Object.entries(def.inst)) {
    const bus = buses[name];
    let pk = 0;
    for (const ch of [bus.L, bus.R]) {
      if (inst.hp) { new Biquad('hp', inst.hp, 0.707).run(ch); }
      if (inst.lp) { new Biquad('lp', inst.lp, 0.707).run(ch); }
      for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(ch[i]));
    }
    if (pk < 1e-9) continue;
    let gain: number;
    if (inst.peak !== undefined) gain = undb(inst.peak) / pk;
    else {
      // RMS over the frames in which the instrument is actually playing
      const F = 2205;
      const pw: number[] = [];
      for (let s = 0; s + F <= N; s += F) {
        let a = 0;
        for (let i = s; i < s + F; i++) a += bus.L[i] * bus.L[i] + bus.R[i] * bus.R[i];
        pw.push(a / F);
      }
      const mx = Math.max(...pw);
      const act = pw.filter((p) => p > mx * 0.001);
      const rms = Math.sqrt(act.reduce((a, b) => a + b, 0) / act.length);
      gain = undb(inst.level ?? -24) / rms;
    }
    const rv = inst.rev ?? 0, dl = inst.del ?? 0;
    for (let i = 0; i < N; i++) {
      const l = bus.L[i] * gain, r = bus.R[i] * gain;
      dryL[i] += l; dryR[i] += r;
      if (rv) { revL[i] += l * rv; revR[i] += r * rv; }
      if (dl) delIn[i] += (l + r) * 0.5 * dl;
      bus.L[i] = l; bus.R[i] = r;
    }
    stems[name] = lufs(bus.L, bus.R);
  }
  const [dL, dR] = pingPong(delIn, 0.75 * spb, spb, def.del.fb);
  for (let i = 0; i < N; i++) {
    dryL[i] += dL[i] * def.del.gain; dryR[i] += dR[i] * def.del.gain;
    revL[i] += dL[i] * def.del.gain * 0.4; revR[i] += dR[i] * def.del.gain * 0.4;
  }
  const [wL, wR] = reverb(revL, revR, def.rev.t60, def.rev.damp);
  for (let i = 0; i < N; i++) { dryL[i] += wL[i] * def.rev.gain; dryR[i] += wR[i] * def.rev.gain; }
  // master EQ: sub-sonic high-pass (also removes DC), gentle top roll-off
  for (const ch of [dryL, dryR]) {
    new Biquad('hp', 32, 0.707).run(ch);
    new Biquad('hs', 7000, 0.7, def.shelf ?? -1).run(ch);
    if (def.presence) { new Biquad('peak', 2500, 0.8, def.presence).run(ch); }
    new Biquad('lp', 15000, 0.6).run(ch);
  }
  // fold the tail onto the beginning → seamless loop
  const L = new Float32Array(loopLen), R = new Float32Array(loopLen);
  for (let i = 0; i < N; i++) { L[i % loopLen] += dryL[i]; R[i % loopLen] += dryR[i]; }
  if (def.rain !== undefined) {
    const [rl, rr] = rainBed(loopLen, rng);
    let a = 0;
    for (let i = 0; i < loopLen; i++) a += rl[i] * rl[i] + rr[i] * rr[i];
    const g = undb(def.rain) / Math.sqrt(a / (2 * loopLen));
    for (let i = 0; i < loopLen; i++) { L[i] += rl[i] * g; R[i] += rr[i] * g; }
  }
  if (def.water !== undefined) {
    const [wl, wr] = waterBed(loopLen, mulberry32(def.seed + 77));
    let a = 0;
    for (let i = 0; i < loopLen; i++) a += wl[i] * wl[i] + wr[i] * wr[i];
    const g = undb(def.water) / Math.sqrt(a / (2 * loopLen));
    for (let i = 0; i < loopLen; i++) { L[i] += wl[i] * g; R[i] += wr[i] * g; }
  }
  // loudness-normalise, then limit (both loop-invariant), iterating to land on the target
  const srcL = L.slice(), srcR = R.slice();
  let g = undb(TARGET_LUFS - lufs(srcL, srcR));
  let limiter = { maxDb: 0, activePct: 0 };
  for (let it = 0; it < 4; it++) {
    for (let i = 0; i < loopLen; i++) { L[i] = srcL[i] * g; R[i] = srcR[i] * g; }
    limiter = limitLoop(L, R, CEILING);
    const l = lufs(L, R);
    if (Math.abs(l - TARGET_LUFS) < 0.05) break;
    g *= undb(TARGET_LUFS - l);
  }
  const sections = song.secs.map((s) => {
    const a = Math.min(loopLen, Math.round((sec(s.b0) + shift) * SR)), b = Math.min(loopLen, Math.round((sec(s.b1) + shift) * SR));
    let e = 0;
    for (let i = a; i < b; i++) e += L[i] * L[i] + R[i] * R[i];
    return `${s.sec.name} ${db(Math.sqrt(e / (2 * Math.max(1, b - a)))).toFixed(1)}`;
  });
  return { L, R, stems, sections, limiter };
}

// ───────────────────────────── WAV / encoding ─────────────────────────────

function writeWav(file: string, chans: Float32Array[], sr: number, ditherSeed = 1): void {
  const n = chans[0].length, nc = chans.length;
  const buf = Buffer.alloc(44 + n * nc * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * nc * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(nc, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * nc * 2, 28); buf.writeUInt16LE(nc * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * nc * 2, 40);
  const rng = mulberry32(ditherSeed);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nc; c++) {
      const d = rng() - rng(); // TPDF dither, ±1 LSB
      buf.writeInt16LE(clamp(Math.round(chans[c][i] * 32767 + d * 0.5), -32768, 32767), o);
      o += 2;
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}
function readWav(file: string): { sr: number; chans: Float32Array[] } {
  const b = fs.readFileSync(file);
  let p = 12, sr = 44100, nc = 2, bits = 16;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') { nc = b.readUInt16LE(p + 10); sr = b.readUInt32LE(p + 12); bits = b.readUInt16LE(p + 22); }
    else if (id === 'data') {
      if (bits !== 16) throw new Error(`${file}: expected 16-bit PCM`);
      const n = Math.floor(Math.min(size, b.length - p - 8) / (2 * nc));
      const chans = Array.from({ length: nc }, () => new Float32Array(n));
      let o = p + 8;
      for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { chans[c][i] = b.readInt16LE(o) / 32768; o += 2; }
      return { sr, chans };
    }
    p += 8 + size + (size & 1);
  }
  throw new Error(`${file}: no data chunk`);
}
function encodeAac(wav: string, m4a: string): void {
  fs.mkdirSync(path.dirname(m4a), { recursive: true });
  execFileSync(AFCONVERT, ['-f', 'm4af', '-d', 'aac', '-b', String(AAC_BITRATE), '-q', '127', '-s', '0', wav, m4a]);
}

// ───────────────────────────── analysis (--check) ─────────────────────────────

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; const u = im[i]; im[i] = im[j]; im[j] = u; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -TAU / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b2 = a + len / 2;
        const xr = re[b2] * cr - im[b2] * ci, xi = re[b2] * ci + im[b2] * cr;
        re[b2] = re[a] - xr; im[b2] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
function spectralShares(L: Float32Array, R: Float32Array, sr: number): [number, number, number, number] {
  const n = 8192;
  const win = new Float64Array(n);
  for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos((TAU * i) / n);
  const band = [0, 0, 0, 0];
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let s = 0; s + n <= L.length; s += n) {
    for (let i = 0; i < n; i++) { re[i] = (L[s + i] + R[s + i]) * 0.5 * win[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 1; k < n / 2; k++) {
      const f = (k * sr) / n, p = re[k] * re[k] + im[k] * im[k];
      band[f < 200 ? 0 : f < 4000 ? 1 : 2] += p;
      if (f >= 1000 && f < 4000) band[3] += p;
    }
  }
  const tot = band[0] + band[1] + band[2] || 1;
  return [band[0] / tot, band[1] / tot, band[2] / tot, band[3] / tot];
}
/** 4x oversampled peak (Lanczos interpolation) near the loudest samples. */
function truePeak(x: Float32Array): number {
  let pk = 0;
  for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]));
  const A = 8;
  const kern = [0.25, 0.5, 0.75].map((fr) => {
    const k: number[] = [];
    for (let j = -A + 1; j <= A; j++) {
      const t = j - fr;
      k.push(t === 0 ? 1 : (A * Math.sin(Math.PI * t) * Math.sin((Math.PI * t) / A)) / (Math.PI * Math.PI * t * t));
    }
    return k;
  });
  let tp = pk;
  const n = x.length;
  for (let i = 0; i < n; i++) {
    if (Math.abs(x[i]) < pk * 0.7) continue;
    for (const k of kern) {
      let s = 0;
      for (let j = -A + 1; j <= A; j++) s += x[(((i + j) % n) + n) % n] * k[j + A - 1];
      tp = Math.max(tp, Math.abs(s));
    }
  }
  return tp;
}
interface Metrics {
  dur: number; peakDb: number; tpDb: number; rmsDb: number; lufs: number; dc: number; clip: number;
  step: number; stepRef: number; rmsEnd: number; rmsStart: number; shares: [number, number, number, number];
  gaps: number; longestGap: number; corrLR: number;
}
function analyze(L: Float32Array, R: Float32Array, sr: number): Metrics {
  const n = L.length;
  let pk = 0, sq = 0, dcL = 0, dcR = 0, clip = 0, lr = 0, ll = 0, rr = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (a > pk) pk = a;
    if (a >= 0.999) clip++;
    sq += L[i] * L[i] + R[i] * R[i]; dcL += L[i]; dcR += R[i];
    lr += L[i] * R[i]; ll += L[i] * L[i]; rr += R[i] * R[i];
  }
  const w = Math.floor(0.05 * sr);
  const rmsOf = (a: number, b: number) => {
    let s = 0;
    for (let i = a; i < b; i++) s += L[i] * L[i] + R[i] * R[i];
    return Math.sqrt(s / (2 * (b - a)));
  };
  // adjacent-sample differences: the wrap-around step vs. what is normal inside the track
  const diffs = new Float32Array(Math.floor(n / 7));
  for (let k = 0; k < diffs.length; k++) { const i = k * 7; diffs[k] = Math.abs(L[i + 1] - L[i]); }
  diffs.sort();
  const stepRef = diffs[Math.floor(diffs.length * 0.99)];
  const step = Math.max(Math.abs(L[0] - L[n - 1]), Math.abs(R[0] - R[n - 1]));
  // silence gaps: 100 ms windows below -50 dBFS
  const g = Math.floor(0.1 * sr);
  let gaps = 0, run = 0, longest = 0;
  for (let s = 0; s + g <= n; s += g) {
    if (rmsOf(s, s + g) < undb(-50)) { run++; longest = Math.max(longest, run); } else { if (run > 0) gaps++; run = 0; }
  }
  if (run > 0) gaps++;
  return {
    dur: n / sr, peakDb: db(pk), tpDb: db(Math.max(truePeak(L), truePeak(R))), rmsDb: db(Math.sqrt(sq / (2 * n))),
    lufs: lufs(L, R, sr), dc: Math.max(Math.abs(dcL / n), Math.abs(dcR / n)), clip,
    step, stepRef, rmsEnd: db(rmsOf(n - w, n)), rmsStart: db(rmsOf(0, w)), shares: spectralShares(L, R, sr),
    gaps, longestGap: longest * 0.1, corrLR: lr / Math.sqrt(ll * rr || 1),
  };
}
function ffmpegLoudness(file: string): { i: number; tp: number } | null {
  if (!fs.existsSync(FFMPEG)) return null;
  const r = spawnSync(FFMPEG, ['-nostats', '-hide_banner', '-i', file, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const txt = r.stderr ?? '';
  const tail = txt.slice(txt.lastIndexOf('Summary:'));
  const i = /I:\s+(-?[\d.]+) LUFS/.exec(tail), tp = /Peak:\s+(-?[\d.]+) dBFS/.exec(tail);
  return i && tp ? { i: parseFloat(i[1]), tp: parseFloat(tp[1]) } : null;
}
/** Lag (in samples) at which the decoded file best matches the source: 0 means no priming offset. */
function bestLag(src: Float32Array, dec: Float32Array): number {
  const from = SR, len = SR >> 1, range = 3000;
  let best = 0, bestV = -Infinity;
  for (let lag = -range; lag <= range; lag++) {
    let s = 0;
    for (let i = 0; i < len; i += 3) s += src[from + i] * (dec[from + i + lag] ?? 0);
    if (s > bestV) { bestV = s; best = lag; }
  }
  return best;
}

function checkTrack(id: string): string[] {
  const wav = path.join(SCRATCH, `${id}.wav`), m4a = path.join(MUSIC_DIR, `${id}.m4a`);
  const dec = path.join(SCRATCH, `${id}.decoded.wav`);
  const src = readWav(wav);
  execFileSync(AFCONVERT, ['-f', 'WAVE', '-d', 'LEI16', m4a, dec]);
  const d = readWav(dec);
  const a = analyze(src.chans[0], src.chans[1], src.sr);
  const b = analyze(d.chans[0], d.chans[1], d.sr);
  const ff = ffmpegLoudness(m4a);
  const lag = bestLag(src.chans[0], d.chans[0]);
  const size = fs.statSync(m4a).size;
  const pct = (x: number) => (x * 100).toFixed(1).padStart(5);
  const row = (tag: string, m: Metrics) =>
    `  ${tag.padEnd(8)} dur ${m.dur.toFixed(3)}s  peak ${m.peakDb.toFixed(2)} dBFS  truePeak ${m.tpDb.toFixed(2)}  rms ${m.rmsDb.toFixed(1)}  LUFS ${m.lufs.toFixed(2)}  dc ${m.dc.toExponential(1)}  clip ${m.clip}\n` +
    `           loop: step ${m.step.toFixed(5)} (p99 adjacent diff ${m.stepRef.toFixed(5)})  rms last50ms ${m.rmsEnd.toFixed(1)} dB / first50ms ${m.rmsStart.toFixed(1)} dB (diff ${(m.rmsStart - m.rmsEnd).toFixed(1)})\n` +
    `           spectrum: <200Hz ${pct(m.shares[0])}%  200Hz-4k ${pct(m.shares[1])}%  >4k ${pct(m.shares[2])}%  (1k-4k ${pct(m.shares[3])}%)   silence gaps ${m.gaps} (longest ${m.longestGap.toFixed(1)}s)  L/R corr ${m.corrLR.toFixed(2)}`;
  const out = [
    `${id}.m4a  ${(size / 1024).toFixed(0)} KB  (${((size * 8) / b.dur / 1000).toFixed(0)} kbps)`,
    row('source', a),
    row('decoded', b),
    `  decoded vs source: ${d.chans[0].length - src.chans[0].length} samples length difference, alignment lag ${lag} samples` +
      (ff ? `; ffmpeg ebur128: I ${ff.i.toFixed(1)} LUFS, true peak ${ff.tp.toFixed(1)} dBFS` : ''),
  ];
  const warn: string[] = [];
  if (b.dur < 70 || b.dur > 100) warn.push('duration outside 70-100 s');
  if (b.tpDb > -1 || (ff && ff.tp > -1)) warn.push('true peak above -1 dBFS');
  if (Math.abs(b.lufs - TARGET_LUFS) > 0.75) warn.push('loudness off target');
  if (b.clip > 0) warn.push('clipping');
  if (b.step > 4 * b.stepRef + 0.002) warn.push('loop step larger than normal sample motion');
  if (Math.abs(b.rmsStart - b.rmsEnd) > 6) warn.push('level jump across loop');
  if (b.shares[0] > 0.45) warn.push('bass heavy');
  if (b.shares[2] > 0.12) warn.push('shrill');
  if (b.gaps > 0) warn.push('silence gap');
  if (d.chans[0].length !== src.chans[0].length || lag !== 0) warn.push('decoded length/alignment differs');
  out.push(warn.length ? `  WARN: ${warn.join('; ')}` : '  OK');
  return out;
}

// ───────────────────────────── lead sheet + lint (--sheet) ─────────────────────────────

function lintSong(song: Song, verbose: boolean): { errors: number; warns: number; lines: string[] } {
  const { def } = song;
  const lines: string[] = [];
  let errors = 0, warns = 0;
  const where = (beat: number) => `bar ${Math.floor(beat / def.bpb) + 1} beat ${((beat % def.bpb) + 1).toFixed(2).replace(/\.?0+$/, '')}`;
  const chordPcs = (ch: Chord) => new Set([...ch.pcs, ch.bass]);
  for (const part of song.parts) {
    const ns = part.notes;
    let steps = 0, skips = 0, leaps = 0, reps = 0;
    let runDir = 0, runLen = 1, runKind = '';
    const runs: string[] = [];
    for (let i = 0; i < ns.length; i++) {
      const n = ns[i];
      const ch = song.spans[spanAt(song, n.beat)].ch;
      const pcs = chordPcs(ch);
      const pc = n.midi % 12;
      const prev = i > 0 && Math.abs(ns[i - 1].beat + ns[i - 1].dur - n.beat) < 0.76 ? ns[i - 1] : null;
      const next = i + 1 < ns.length && Math.abs(n.beat + n.dur - ns[i + 1].beat) < 0.76 ? ns[i + 1] : null;
      if (i > 0) {
        const iv = n.midi - ns[i - 1].midi, ai = Math.abs(iv);
        if (ai === 0) reps++; else if (ai <= 2) steps++; else if (ai <= 4) skips++; else leaps++;
        const kind = ai === 0 ? '' : ai <= 2 ? 'scale' : 'arp';
        const dir = Math.sign(iv);
        if (kind && kind === runKind && dir === runDir) runLen++;
        else {
          if ((runKind === 'scale' && runLen >= 5) || (runKind === 'arp' && runLen >= 4)) runs.push(`${runKind} run of ${runLen + 1} notes ending ${where(ns[i - 1].beat)}`);
          runKind = kind; runDir = dir; runLen = 1;
        }
      }
      const inBar = n.beat % def.bpb;
      const unit = def.unit ?? 1;
      const strong = (def.strong ? def.strong.includes(inBar) : def.bpb === 4 ? inBar % 2 === 0 : inBar === 0) || n.dur >= 1.5 * unit;
      const tag = `${part.sec}/${part.inst} ${where(n.beat)}: ${midiName(n.midi)} (${n.dur}) over ${ch.name}`;
      if (pcs.has(pc)) {
        // chord tone a semitone above another chord tone, held (e.g. root over maj7): only worth a note
        if (n.dur >= 1 && strong && [...pcs].some((c) => (pc - c + 12) % 12 === 1) && !ch.name.includes('b9')) {
          if (verbose) lines.push(`  note   ${tag}: chord tone a semitone above another chord tone`);
        }
        continue;
      }
      const stepTo = (o: NoteEv | null) => o !== null && Math.abs(o.midi - n.midi) <= 2 && o.midi !== n.midi;
      const nextCh = next ? chordPcs(song.spans[spanAt(song, next.beat)].ch) : null;
      const resolves = stepTo(next) && nextCh!.has(next!.midi % 12);
      const anticip = next !== null && next.midi === n.midi && nextCh!.has(pc);
      const iv = (pc - ch.root + 12) % 12;
      const third = ch.ivs.includes(4) ? 'maj' : ch.ivs.includes(3) ? 'min' : 'sus';
      const softTension = iv === 2 || (iv === 9 && third !== 'min') || (iv === 5 && third !== 'maj') || (iv === 9 && ch.ivs.includes(10)) ||
        (iv === 11 && third === 'maj' && !ch.ivs.includes(10)) || (iv === 10 && third === 'min');
      if (!strong) {
        if (stepTo(prev) || stepTo(next) || anticip) continue; // passing / neighbour / escape / anticipation
        if (softTension) { if (verbose) lines.push(`  note   ${tag}: weak-beat colour tone left by leap`); continue; }
        warns++; lines.push(`  WARN   ${tag}: weak-beat non-chord tone approached and left by leap`);
      } else if (resolves || anticip) {
        if (verbose) lines.push(`  ok     ${tag}: accented non-chord tone, ${anticip ? 'anticipation' : 'resolves by step to ' + midiName(next!.midi)}`);
      } else if (softTension && n.dur <= unit) {
        if (verbose) lines.push(`  note   ${tag}: colour tone (${['R', 'b9', '9', 'b3', '3', '11', '#11', '5', 'b13', '6/13', 'b7', 'maj7'][iv]}) not resolved by step`);
      } else if (softTension) {
        warns++; lines.push(`  WARN   ${tag}: long unresolved colour tone (${['R', 'b9', '9', 'b3', '3', '11', '#11', '5', 'b13', '6/13', 'b7', 'maj7'][iv]})`);
      } else {
        errors++; lines.push(`  ERROR  ${tag}: strong-beat dissonance that does not resolve by step`);
      }
    }
    if ((runKind === 'scale' && runLen >= 5) || (runKind === 'arp' && runLen >= 4)) runs.push(`${runKind} run of ${runLen + 1} notes at the end`);
    const tot = Math.max(1, steps + skips + leaps + reps);
    const lo = Math.min(...ns.map((n) => n.midi)), hi = Math.max(...ns.map((n) => n.midi));
    lines.push(`  shape  ${part.sec}/${part.inst}: ${ns.length} notes, range ${midiName(lo)}-${midiName(hi)}, steps ${Math.round((steps / tot) * 100)}% skips ${Math.round((skips / tot) * 100)}% leaps ${Math.round((leaps / tot) * 100)}% repeats ${Math.round((reps / tot) * 100)}%` +
      (runs.length ? `  [${runs.join('; ')}]` : ''));
    for (const r of runs) { void r; warns += 0; }
  }
  // simultaneous written parts: sustained minor seconds / major sevenths between voices
  for (const s of song.secs) {
    const ps = song.parts.filter((p) => p.sec === s.sec.name);
    for (let a = 0; a < ps.length; a++) for (let b = a + 1; b < ps.length; b++) {
      for (const x of ps[a].notes) for (const y of ps[b].notes) {
        const ov = Math.min(x.beat + x.dur, y.beat + y.dur) - Math.max(x.beat, y.beat);
        const iv = Math.abs(x.midi - y.midi) % 12;
        if (ov >= 0.5 && (iv === 1 || iv === 11) && Math.abs(x.midi - y.midi) < 14) {
          warns++;
          lines.push(`  WARN   ${s.sec.name} ${where(Math.max(x.beat, y.beat))}: ${ps[a].inst} ${midiName(x.midi)} against ${ps[b].inst} ${midiName(y.midi)} (semitone clash, ${ov} beats)`);
        }
      }
    }
  }
  return { errors, warns, lines };
}

function printSheet(def: TrackDef, verbose: boolean): number {
  const song = buildSong(def);
  const bars = song.totalBeats / def.bpb;
  const secs = (song.totalBeats * 60) / def.bpm;
  console.log(`\n=== ${def.id}: "${def.title}" — ${def.key}, ${def.meter ?? `${def.bpm} BPM, ${def.bpb}/4`}${def.swing ? `, swing ${(def.swing * 100).toFixed(0)}%` : ''}, ${bars} bars, ${secs.toFixed(1)} s`);
  console.log(`    form: ${def.sections.map((s) => `${s.name}(${s.bars})`).join(' → ')} → loop`);
  let bar = 1;
  for (const s of def.sections) {
    console.log(`  [${s.name}] bars ${bar}-${bar + s.bars - 1}  layers: ${s.layers}${s.parts ? '  parts: ' + Object.keys(s.parts).join(', ') : ''}`);
    console.log(`     | ${s.chords.split('|').map((c) => c.trim()).filter((c) => c).join(' | ')} |`);
    if (verbose) for (const [inst, src] of Object.entries(s.parts ?? {})) console.log(`     ${inst}: ${src.replace(/\s+/g, ' ').trim()}`);
    bar += s.bars;
  }
  const lint = lintSong(song, verbose);
  for (const l of lint.lines) if (verbose || !l.startsWith('  shape')) console.log(l);
  console.log(`  lint: ${lint.errors} errors, ${lint.warns} warnings`);
  return lint.errors;
}

// ───────────────────────────── the compositions ─────────────────────────────

const SHAKER8 = '0:shaker:.42 .5:shaker:.22 1:shaker:.5 1.5:shaker:.22 2:shaker:.4 2.5:shaker:.24 3:shaker:.5 3.5:shaker:.26';

const TRACKS: TrackDef[] = [
  {
    id: 'spring', title: 'Spring Morning', key: 'D major', seed: 1101, bpm: 104, bpb: 4,
    idea: 'A falling-third flute motif that tips into the next chord a beat early, sequenced up and answered by a climb to a high D; the last cadence is deceptive and only resolves when the loop restarts.',
    scale: [2, 4, 6, 7, 9, 11, 1],
    rev: { t60: 1.9, damp: 0.35, gain: 0.5 }, del: { gain: 0.5, fb: 0.28 },
    inst: {
      flute: { voice: V.flute, level: -19, pan: -0.12, rev: 0.34, del: 0.12, hp: 250, legato: 0.97, jitter: 7 },
      harp: { voice: V.harp, level: -25, pan: 0.35, spread: 0.4, rev: 0.3, del: 0.08, hp: 140, legato: 1.6 },
      guitar: { voice: V.guitar, level: -26, pan: -0.4, rev: 0.2, hp: 120, legato: 0.9 },
      viola: { voice: V.viola, level: -27, pan: 0.2, rev: 0.4, hp: 180, legato: 1.02, jitter: 10 },
      celesta: { voice: V.celesta, level: -26, pan: 0.5, rev: 0.45, del: 0.3, hp: 400 },
      glock: { voice: V.celesta, level: -29, pan: 0.3, rev: 0.5, hp: 500, oct: 1 },
      bass: { voice: V.softBass, level: -21.5, rev: 0.04, legato: 0.9, lp: 1800 },
      pad: { voice: V.pad, level: -29, wide: true, rev: 0.4, hp: 200, legato: 1 },
      kick: { voice: perc('kick'), peak: -13, rev: 0.03 },
      shaker: { voice: perc('shaker'), peak: -18, pan: 0.3, rev: 0.12, jitter: 4 },
      rim: { voice: perc('wood'), peak: -17, pan: -0.3, rev: 0.2 },
    },
    layers: {
      arpI: { kind: 'chord', inst: 'harp', center: 64, pat: ['0:0:2 1:1:1.5 1.5:2:1 2.5:3:1.5', '0:0:2 1:2:1.5 2:1:1 2.5:3:1.5'] },
      arp: { kind: 'chord', inst: 'harp', center: 64, pat: ['0:0:1:.75 .5:2:.5:.5 1:1:.5:.6 1.5:2:.5:.5 2:3:1:.7 2.5:2:.5:.5 3:1:.5:.6 3.5:2:.5:.5', '0:0:1:.75 .5:1:.5:.5 1:2:.5:.6 1.5:3:.5:.55 2:2:1:.65 2.5:1:.5:.5 3:2:.5:.6 3.5:3:.5:.55'] },
      strum: { kind: 'chord', inst: 'guitar', center: 55, strum: 14, pat: ['0:x:1.5:.7 1.5:dx:.5:.42 2.5:x:1:.6', '0:x:1.5:.7 1.5:dx:.5:.42 2.5:x:.5:.6 3.5:dx:.5:.4'] },
      bass: { kind: 'bass', inst: 'bass', lo: 38, pat: ['0:R:1.4:.8 1.5:5:.5:.5 2:R:1:.68 3:A:.9:.6', '0:R:1.4:.8 1.5:R:.5:.5 2:5:1:.68 3:A:.9:.6'] },
      bassI: { kind: 'bass', inst: 'bass', lo: 38, pat: '0:R:3.8:.7' },
      pad: { kind: 'pad', inst: 'pad', center: 60 },
      perc1: { kind: 'perc', pat: `0:kick:.7 2.5:kick:.5 ${SHAKER8}` },
      perc2: { kind: 'perc', pat: [`0:kick:.72 2.5:kick:.52 1:rim:.5 3:rim:.55 ${SHAKER8}`, `0:kick:.72 2.5:kick:.52 1:rim:.5 3:rim:.55 3.5:rim:.3 ${SHAKER8}`] },
      shake: { kind: 'perc', pat: SHAKER8 },
    },
    sections: [
      { name: 'Intro', bars: 4, layers: 'arpI pad*0.8 bassI', dyn: [0.75, 0.95],
        chords: 'Dadd9 | G/D | Dadd9 | A7sus4',
        parts: { celesta: `r:4 | r:4 | F#6:1.5 E6:.5 D6:1 B5:1 | A5:2 r:2` } },
      { name: 'A', bars: 8, layers: 'arp bass pad perc1*0.8',
        chords: 'D | Bm7 | G | A7sus4 A | D/F# | G E7/G# | A7sus4 | A7',
        parts: { flute: `F#5:1.5 E5:.5 D5:.5 A4:.5 B4:1 | D5:1.5 B4:.5 A4:1 r:1 | G5:1.5 F#5:.5 D5:.5 B4:.5 E5:1 | E5:2 r:.5 A4:.5 D5:.5 E5:.5 |
                         A5:1.5 F#5:.5 E5:.5 D5:.5 F#5:1 | G5:.5 A5:.5 B5:1 D6:1! B5:1 | A5:1.5 G5:.5 E5:1 D5:1 | C#5:1.5 D5:.5 E5:2` } },
      { name: "A'", bars: 8, layers: 'arp strum*0.7 bass pad perc2', dyn: [1, 1.08],
        chords: 'D | Bm7 | G | F#7 | Bm | Gm6 | D/A A7 | D',
        parts: {
          flute: `F#5:1.5 E5:.5 D5:.5 A4:.5 B4:1 | D5:1.5 B4:.5 A4:.5 B4:.5 D5:1 | G5:1.5 F#5:.5 D5:.5 B4:.5 E5:1 | C#5:1.5 E5:.5 F#5:1 A#5:1 |
                  B5:1.5! A5:.5 F#5:.5 E5:.5 F#5:1 | G5:1.5 Bb5:.5 A5:.5 G5:.5 E5:1 | F#5:1 A5:1 G5:.5 F#5:.5 E5:1 | D5:3 r:1`,
          viola: `D4:2 F#4:2 | F#4:3 D4:1 | B3:2 D4:2 | C#4:2 E4:2 | D4:2 F#4:2 | E4:2 D4:2 | D4:2 C#4:2 | D4:1 F#4:1 A4:2`,
        } },
      { name: 'B', bars: 8, layers: 'strum bass pad shake*0.8 arpI*0.7', dyn: [0.88, 1.02],
        chords: 'G | A/G | F#m7 | B7 | Em7 | Gm6 | A7sus4 | A7',
        parts: {
          flute: `r:1 B4:.5 D5:.5 G5:1.5 F#5:.5 | E5:2.5 C#5:.5 E5:1 | r:1 A4:.5 C#5:.5 F#5:1.5 E5:.5 | D#5:2.5 B4:.5 D#5:1 |
                  r:.5 E5:.5 G5:.5 B5:.5 A5:1 G5:1 | Bb5:1.5 A5:.5 G5:1 E5:1 | D5:1 E5:.5 G5:.5 A5:2 | G5:1.5 F#5:.5 E5:1 A4:.5 E5:.5`,
          celesta: `r:4 | r:1.5 C#6:.5 A5:1 E6:1 | r:4 | r:1.5 B5:.5 F#5:1 B5:1 | r:4 | r:4 | r:2.5 E6:.5 D6:1 | r:4`,
        } },
      { name: "A''", bars: 6, layers: 'arp strum*0.8 bass pad perc2', dyn: [1.05, 1.1],
        chords: 'D | Bm7 | G | E7/G# | D/A Bm7 | Em7 A7',
        parts: {
          flute: `F#5:1.5 E5:.5 D5:.5 A4:.5 B4:1 | D5:1.5 B4:.5 A4:1 r:.5 D5:.5 | G5:1.5 F#5:.5 D5:.5 B4:.5 E5:1 | E5:1.5 D5:.5 E5:.5 G#5:.5 B5:1 |
                  A5:1.5! F#5:.5 D5:.5 E5:.5 F#5:1 | G5:1 E5:1 E5:.5 D5:.5 C#5:1`,
          viola: `D4:2 F#4:2 | F#4:3 D4:1 | B3:2 D4:2 | D4:2 E4:2 | F#4:4 | G4:4`,
          glock: `F#5:1.5 E5:.5 D5:.5 A4:.5 B4:1 | D5:1.5 B4:.5 A4:1 r:1 | G5:1.5 F#5:.5 D5:.5 B4:.5 E5:1 | E5:1.5 D5:.5 E5:.5 G#5:.5 B5:1 |
                  A5:1.5 F#5:.5 D5:.5 E5:.5 F#5:1 | G5:1 E5:1 E5:.5 D5:.5 C#5:1`,
        } },
      { name: 'Turn', bars: 2, layers: 'arpI pad bassI shake*0.5', dyn: [0.9, 0.7],
        chords: 'Gmaj7 | A7sus4',
        parts: { flute: `D5:2 B4:1 A4:1 | A4:3 r:1`, viola: `F#4:2 D4:2 | D4:2 E4:2` } },
    ],
  },
  {
    id: 'summer', title: 'Summer Fields', key: 'G major (mixolydian touches)', seed: 2202, bpm: 120, bpb: 4,
    idea: 'A pentatonic "skip-and-lean" marimba tune over a walking-down bass and tresillo strumming, with a minor-key whistle episode that climbs by sequence and tumbles back with a turn figure.',
    scale: [7, 9, 11, 0, 2, 4, 6],
    rev: { t60: 1.3, damp: 0.4, gain: 0.42 }, del: { gain: 0.4, fb: 0.22 },
    inst: {
      marimba: { voice: V.marimba, level: -18, pan: -0.1, spread: 0.15, rev: 0.28, del: 0.1, hp: 160, legato: 1.3, jitter: 5 },
      whistle: { voice: V.whistle, level: -22.5, pan: 0.2, rev: 0.34, del: 0.14, hp: 350, legato: 0.96 },
      fiddle: { voice: V.viola, level: -28, pan: 0.4, rev: 0.3, hp: 180, legato: 1.02, jitter: 10 },
      guitar: { voice: V.guitar, level: -25, pan: -0.38, rev: 0.16, hp: 110, legato: 0.85 },
      mando: { voice: V.mandolin, level: -28.5, pan: 0.45, spread: 0.2, rev: 0.22, hp: 250, legato: 1.2 },
      bass: { voice: V.softBass, level: -21.5, rev: 0.04, legato: 0.85, lp: 1800 },
      kick: { voice: perc('kick'), peak: -15, rev: 0.03 },
      congaH: { voice: perc('congaH'), peak: -15, pan: 0.25, rev: 0.16 },
      congaL: { voice: perc('congaL'), peak: -14, pan: 0.1, rev: 0.14 },
      shaker: { voice: perc('shaker'), peak: -18, pan: -0.3, rev: 0.1, jitter: 4 },
      wood: { voice: perc('wood'), peak: -17, pan: -0.5, rev: 0.2 },
    },
    layers: {
      strum: { kind: 'chord', inst: 'guitar', center: 57, strum: 11, pat: ['0:x:1:.8 1:dx:.5:.34 1.5:x:1:.7 2.5:dx:.5:.34 3:x:.5:.75 3.5:dx:.5:.4', '0:x:1:.8 1:dx:.5:.34 1.5:x:1:.7 2.5:dx:.5:.34 3:x:1:.75'] },
      mando: { kind: 'chord', inst: 'mando', center: 69, pat: '0:0:.5:.7 .5:1:.5:.5 1:2:.5:.55 1.5:0:.5:.68 2:1:.5:.5 2.5:2:.5:.55 3:1:.5:.66 3.5:2:.5:.55' },
      bass: { kind: 'bass', inst: 'bass', lo: 40, pat: ['0:R:1.3:.82 1.5:5:1.3:.62 3:A:.9:.66', '0:R:1.3:.82 1.5:R:.5:.5 2:5:.9:.62 3:A:.9:.66'] },
      bassT: { kind: 'bass', inst: 'bass', lo: 40, pat: '0:R:3.5:.7' },
      percA: { kind: 'perc', pat: [`0:kick:.7 2:kick:.5 0:congaL:.55 1.5:congaH:.6 3:congaH:.55 3.5:congaL:.4 ${SHAKER8}`, `0:kick:.7 2:kick:.5 0:congaL:.55 1.5:congaH:.6 2.5:congaL:.4 3:congaH:.55 3.5:congaH:.4 ${SHAKER8}`] },
      percF: { kind: 'perc', pat: [`0:kick:.72 2:kick:.52 0:congaL:.55 1.5:congaH:.6 3:congaH:.55 3.5:congaL:.4 1:wood:.45 2.5:wood:.45 ${SHAKER8}`, `0:kick:.72 2:kick:.52 0:congaL:.55 1.5:congaH:.6 2.5:congaL:.4 3:congaH:.55 3.5:congaH:.4 1:wood:.45 3:wood:.4 ${SHAKER8}`] },
      percB: { kind: 'perc', pat: `0:congaL:.5 1.5:congaH:.5 3:congaH:.45 ${SHAKER8}` },
      shake: { kind: 'perc', pat: SHAKER8 },
    },
    sections: [
      { name: 'Intro', bars: 2, layers: 'strum*0.9 shake bassT*0.8', dyn: [0.85, 0.95], chords: 'G | F/G' },
      { name: 'Intro2', bars: 2, layers: 'strum*0.9 bass percB', dyn: [0.9, 1], chords: 'G | Dsus4 D' },
      { name: 'A', bars: 8, layers: 'strum bass percA',
        chords: 'G | D/F# | Em7 | G/D | C | G/B | A7 | D7sus4 D7',
        parts: { marimba: `B4:.5 D5:.5 E5:1 D5:.5 B4:.5 G4:1 | A4:.5 D5:.5 E5:1 F#5:.5 E5:.5 D5:1 | D5:.5 E5:.5 G5:1 A5:.5 G5:.5 E5:1 | D5:1.5 B4:.5 D5:2 |
                           E5:.5 G5:.5 A5:1 G5:.5 E5:.5 C5:1 | D5:.5 G5:.5 A5:1 B5:.5 A5:.5 G5:1 | C#6:1.5! B5:.5 A5:.5 G5:.5 E5:1 | G5:1.5 A5:.5 F#5:1 D5:1` } },
      { name: "A'", bars: 8, layers: 'strum bass percF mando*0.8', dyn: [1, 1.06],
        chords: 'G | D/F# | Em7 | G/D | C | G/B | F D7 | G',
        parts: {
          marimba: `B4:.5 D5:.5 E5:1 D5:.5 B4:.5 G4:.5 B4:.5 | A4:.5 D5:.5 E5:1 F#5:.5 E5:.5 D5:1 | D5:.5 E5:.5 G5:1 A5:.5 G5:.5 E5:.5 G5:.5 | D5:1.5 B4:.5 D5:1 r:.5 D5:.5 |
                    E5:.5 G5:.5 A5:1 G5:.5 E5:.5 C5:1 | D5:.5 G5:.5 A5:1 B5:.5 A5:.5 G5:1 | A5:1 C6:.5! A5:.5 F#5:1 A5:1 | G5:3 r:1`,
          fiddle: `B3:2 D4:2 | A3:2 D4:2 | G3:2 B3:2 | B3:4 | C4:2 E4:2 | D4:2 B3:2 | C4:2 C4:1 A3:1 | B3:4`,
        } },
      { name: 'B', bars: 8, layers: 'strum*0.75 bass percB mando*0.6', dyn: [0.9, 1.05],
        chords: 'Em | B7/D# | Em/D | A7/C# | C | G/B | Am7 | D7',
        parts: {
          whistle: `E5:1.5 F#5:.5 G5:2 | F#5:1.5 G5:.5 A5:2 | G5:1.5 A5:.5 B5:2 | C#6:1.5! B5:.5 A5:1 G5:1 |
                    G5:1 A5:.5 G5:.5 E5:2 | D5:1 E5:.5 D5:.5 B4:2 | C5:1 D5:.5 C5:.5 A4:1 C5:1 | D5:1.5 E5:.5 F#5:1 A5:1`,
          marimba: `r:2.5 B4:.5 E5:.5 B4:.5 | r:4 | r:2.5 D5:.5 G5:.5 D5:.5 | r:4 | r:3 C5:.5 G4:.5 | r:3 B4:.5 G4:.5 | r:4 | r:4`,
        } },
      { name: "A''", bars: 8, layers: 'strum bass percF mando', dyn: [1.06, 1.12],
        chords: 'G | D/F# | Em7 | G/D | C | G/B | F D7 | G',
        parts: {
          marimba: `B4:.5 D5:.5 E5:1 D5:.5 B4:.5 G4:1 | A4:.5 D5:.5 E5:1 F#5:.5 E5:.5 D5:1 | D5:.5 E5:.5 G5:1 A5:.5 G5:.5 E5:.5 G5:.5 | D5:1.5 B4:.5 D5:2 |
                    E5:.5 G5:.5 A5:1 G5:.5 E5:.5 C5:1 | D5:.5 G5:.5 A5:1 B5:.5 A5:.5 G5:1 | A5:1 C6:.5! A5:.5 F#5:1 A5:1 | G5:3 r:1`,
          whistle: `r:4 | r:2.5 A5:.5 F#5:1 | r:4 | r:2 B4:.5 D5:.5 E5:.5 D5:.5 |
                    E5:.5 G5:.5 A5:1 G5:.5 E5:.5 C5:1 | D5:.5 G5:.5 A5:1 B5:.5 A5:.5 G5:1 | C6:2 D6:1 C6:1 | B5:3 r:1`,
          fiddle: `B3:2 D4:2 | A3:2 D4:2 | G3:2 B3:2 | B3:4 | C4:2 E4:2 | D4:2 B3:2 | C4:2 C4:1 A3:1 | B3:4`,
        } },
      { name: 'Turn', bars: 4, layers: 'strum*0.65 bassT shake*0.7', dyn: [0.9, 0.7],
        chords: 'Cadd9 | G/B | Am7 | D7sus4',
        parts: { marimba: `E5:.5 G5:.5 A5:1 G5:2 | D5:.5 G5:.5 A5:1 G5:2 | C5:.5 E5:.5 G5:1 E5:2 | D5:4` } },
    ],
  },
  {
    id: 'fall', title: 'Autumn Leaves', key: 'D minor (dorian colour)', seed: 3303, bpm: 90, bpb: 3,
    idea: 'A slow waltz: the same three falling piano notes are re-harmonised each time and end on a different tail note (the dorian B natural), the cello sings the middle section, and the last phrase lands on a major third.',
    scale: [2, 4, 5, 7, 9, 10, 0],
    rev: { t60: 2.4, damp: 0.38, gain: 0.55 }, del: { gain: 0.35, fb: 0.25 },
    shelf: 2.5, presence: 1.5,
    inst: {
      piano: { voice: V.piano, level: -19, pan: -0.06, rev: 0.3, del: 0.1, hp: 120, legato: 1.05, jitter: 8 },
      pianoL: { voice: V.piano, level: -25, pan: -0.22, spread: 0.2, rev: 0.3, hp: 100, legato: 1.5, jitter: 8 },
      cello: { voice: V.cello, level: -22, pan: 0.18, rev: 0.3, legato: 1.0, jitter: 9, lp: 3500 },
      celloLead: { voice: V.cello, level: -20, pan: 0.15, rev: 0.36, del: 0.08, hp: 90, legato: 1.0, jitter: 9 },
      harp: { voice: V.harp, level: -25.5, pan: 0.4, spread: 0.3, rev: 0.34, hp: 150, legato: 1.6 },
      clarinet: { voice: V.clarinet, level: -26.5, pan: -0.35, rev: 0.4, hp: 150, legato: 1.0 },
      pizz: { voice: V.upright, level: -22, rev: 0.08, legato: 0.9, lp: 1800 },
      pad: { voice: V.pad, level: -29, wide: true, rev: 0.4, hp: 180, legato: 1 },
      brush: { voice: perc('brush'), peak: -19, pan: 0.2, rev: 0.25 },
    },
    layers: {
      lh: { kind: 'chord', inst: 'pianoL', center: 56, pat: ['0:0:1:.7 .5:1:.5:.5 1:2:.5:.58 1.5:3:.5:.6 2:2:.5:.55 2.5:1:.5:.5', '0:0:1:.7 .5:2:.5:.5 1:1:.5:.55 1.5:2:.5:.55 2:3:.5:.6 2.5:2:.5:.5'] },
      lhI: { kind: 'chord', inst: 'pianoL', center: 56, pat: '0:0:3:.6 1:1:2:.5 2:2:1:.55' },
      block: { kind: 'chord', inst: 'pianoL', center: 58, strum: 22, pat: '0:x:2.8:.5' },
      harp: { kind: 'chord', inst: 'harp', center: 68, pat: ['0:0:1:.7 .5:2:.5:.5 1:1:1:.6 1.5:3:.5:.55 2:2:1:.6 2.5:1:.5:.5', '0:0:1:.7 .5:1:.5:.5 1:2:1:.6 1.5:3:.5:.55 2:2:1:.6 2.5:3:.5:.5'] },
      pizz: { kind: 'bass', inst: 'pizz', lo: 38, pat: '0:R:2:.7' },
      pad: { kind: 'pad', inst: 'pad', center: 58 },
      brush: { kind: 'perc', pat: '1:brush:.5 2:brush:.36' },
    },
    sections: [
      { name: 'Intro', bars: 4, layers: 'lhI pad*0.8', dyn: [0.75, 0.9],
        chords: 'Dmadd9 | G/D | Dm | A7sus4',
        parts: { cello: `D3:3 | D3:3 | D3:3 | A2:3` } },
      { name: 'A', bars: 8, layers: 'lh pad*0.7',
        chords: 'Dm | Bbmaj7 | F/A | G | Dm/F | Gm6 | A7sus4 | A7',
        parts: {
          piano: `A5:1.5 G5:.5 F5:1 | D5:2 F5:1 | A5:1.5 G5:.5 F5:1 | D5:2 B4:1 | F5:1.5 E5:.5 D5:1 | Bb4:2 D5:1 | E5:1 D5:2 | C#5:2 A4:1`,
          cello: `D3:2 A2:1 | Bb2:2 A2:1 | A2:2 C3:1 | G2:2 B2:1 | F2:2 A2:1 | G2:2 Bb2:1 | A2:3 | A2:2 C#3:1`,
        } },
      { name: "A'", bars: 8, layers: 'lh pad brush', dyn: [1, 1.1],
        chords: 'Dm | Bbmaj7 | F/A | G | Bb | C | Dm | Dm',
        parts: {
          piano: `A5:1.5 G5:.5 F5:.5 E5:.5 | D5:2 F5:1 | A5:1.5 G5:.5 F5:1 | D5:1.5 B4:.5 D5:1 | F5:1.5 G5:.5 A5:1 | G5:1.5 A5:.5 C6:1 | D6:2! A5:1 | G5:.5 F5:.5 D5:2`,
          cello: `D3:2 A2:1 | Bb2:2 A2:1 | A2:2 C3:1 | G2:2 A2:1 | Bb2:2 F2:1 | C3:2 G2:1 | D3:2 A2:1 | D2:3`,
        } },
      { name: 'B', bars: 8, layers: 'harp pizz pad block*0.8', dyn: [0.92, 1.08],
        chords: 'Bb | F/A | Gm7 | D/F# | Gm | Eb | A7sus4 | A7',
        parts: {
          celloLead: `F4:2 G4:1 | A4:2 F4:1 | Bb4:1.5 A4:.5 G4:1 | A4:2 D4:1 | G4:2 A4:1 | Bb4:2! G4:1 | A4:1.5 G4:.5 E4:1 | E4:2 C#4:1`,
          piano: `r:3 | r:1.5 C6:.5 A5:1 | r:3 | r:1.5 D6:.5 A5:1 | r:3 | r:1.5 Eb6:.5 Bb5:1 | r:3 | r:1 E5:1 A5:1`,
        } },
      { name: "A''", bars: 8, layers: 'lh pad brush', dyn: [1.08, 1.15],
        chords: 'Dm | Bbmaj7 | F/A | G | Bb | C | Dsus4 | D',
        parts: {
          piano: `A5:1.5 G5:.5 F5:.5 E5:.5 | D5:2 F5:1 | A5:1.5 G5:.5 F5:1 | D5:1.5 B4:.5 D5:1 | F5:1.5 G5:.5 A5:1 | G5:1.5 A5:.5 C6:1 | D6:2! A5:1 | F#5:3`,
          cello: `D3:2 A2:1 | Bb2:2 A2:1 | A2:2 C3:1 | G2:2 A2:1 | Bb2:2 F2:1 | C3:2 G2:1 | D3:2 A2:1 | D2:3`,
          clarinet: `A4:3 | A4:3 | C5:3 | B4:3 | D5:3 | C5:3 | G4:3 | F#4:3`,
        } },
      { name: 'Coda', bars: 4, layers: 'lhI pad*0.9', dyn: [0.95, 0.7],
        chords: 'Gm6/D | Dm | Bbmaj7 | A7sus4',
        parts: {
          piano: `r:1 D5:1 E5:1 | F5:2 D5:1 | A4:2 D5:1 | E5:3`,
          cello: `D3:3 | D3:3 | Bb2:3 | A2:3`,
        } },
    ],
  },
  {
    id: 'winter', title: 'Winter Hearth', key: 'Eb major', seed: 4404, bpm: 72, bpb: 4,
    idea: 'A lullaby for celesta: a three-note stepwise sigh that is turned upside down, then sequenced down three times over a wide pad, with a darker middle and a backdoor (bVII) cadence home.',
    scale: [3, 5, 7, 8, 10, 0, 2],
    rev: { t60: 3.2, damp: 0.3, gain: 0.62 }, del: { gain: 0.45, fb: 0.32 },
    inst: {
      celesta: { voice: V.celesta, level: -19.5, pan: -0.05, rev: 0.42, del: 0.18, hp: 250, legato: 1.3, jitter: 9 },
      bell: { voice: V.bell, level: -27, pan: 0.5, spread: 0.6, rev: 0.6, del: 0.4, hp: 600 },
      harp: { voice: V.harp, level: -25, pan: -0.35, spread: 0.3, rev: 0.36, hp: 140, legato: 1.8, jitter: 9 },
      cello: { voice: V.cello, level: -26.5, pan: 0.25, rev: 0.4, hp: 100, legato: 1.02, jitter: 12 },
      pad: { voice: V.widePad, level: -24.5, wide: true, rev: 0.45, hp: 160, legato: 1.02 },
      bass: { voice: V.roundBass, level: -22, rev: 0.05, legato: 0.95, lp: 1500 },
      sleigh: { voice: perc('sleigh'), peak: -21, pan: 0.3, rev: 0.3 },
    },
    layers: {
      harp: { kind: 'chord', inst: 'harp', center: 60, pat: ['0:0:1:.7 .5:1:1:.5 1:2:1:.56 1.5:3:1:.6 2:2:1:.56 2.5:1:1:.5 3:2:1:.55 3.5:1:.5:.45', '0:0:1:.7 .5:2:1:.5 1:1:1:.56 1.5:2:1:.55 2:3:1:.6 2.5:2:1:.5 3:1:1:.55 3.5:2:.5:.45'] },
      harpI: { kind: 'chord', inst: 'harp', center: 60, pat: '0:0:2:.62 1:1:2:.5 2:2:2:.55 3:3:1:.56' },
      twinkle: { kind: 'chord', inst: 'bell', center: 84, voices: 3, pat: ['1.5:2:1:.5 3.5:1:.5:.4', '2.5:0:1:.5', '0.5:1:1:.45 3:2:1:.5', '2:0:1:.5'] },
      bass: { kind: 'bass', inst: 'bass', lo: 39, pat: '0:R:2.9:.75 3:A:.95:.5' },
      bassI: { kind: 'bass', inst: 'bass', lo: 39, pat: '0:R:3.9:.7' },
      pad: { kind: 'pad', inst: 'pad', center: 60 },
      sleigh: { kind: 'perc', pat: '1:sleigh:.5 3:sleigh:.42' },
    },
    sections: [
      { name: 'Intro', bars: 2, layers: 'harpI pad*0.85 bassI twinkle*0.8', dyn: [0.8, 0.95], chords: 'Ebadd9 | Abmaj7/Eb' },
      { name: 'A', bars: 8, layers: 'harp pad bass',
        chords: 'Ebadd9 | Ab/Eb | Gm7 | Cm7 | Abadd9 | Eb/G | Fm7 | Bb7sus4',
        parts: { celesta: `G5:1.5 F5:.5 Eb5:1 Bb5:1 | Ab5:1.5 G5:.5 Eb5:2 | D5:1.5 Eb5:.5 F5:1 Bb5:1 | G5:3 r:1 |
                           C6:1.5! Bb5:.5 Ab5:1 G5:1 | Bb5:1.5 Ab5:.5 G5:1 Eb5:1 | Ab5:1.5 G5:.5 F5:1 C5:1 | F5:2 Eb5:2` } },
      { name: 'B', bars: 4, layers: 'harpI pad*1.1 bass twinkle*0.7', dyn: [0.9, 1.05],
        chords: 'Cm | G/B | Bbm7 Eb7 | Abmaj7',
        parts: {
          celesta: `Eb5:2 D5:1 C5:1 | D5:3 G5:1 | F5:1 Ab5:1 G5:1.5 F5:.5 | Eb5:3 r:1`,
          cello: `G3:4 | G3:2 B3:2 | Ab3:2 G3:2 | G3:2 Ab3:1 C4:1`,
        } },
      { name: "A'", bars: 8, layers: 'harp pad bass twinkle sleigh', dyn: [1.02, 1.1],
        chords: 'Ebadd9 | Ab/Eb | Gm7 | C7 | Fm7 | Dbmaj7 | Bb7sus4 Bb7 | Eb',
        parts: {
          celesta: `G5:1.5 F5:.5 Eb5:1 Bb5:1 | Ab5:1.5 G5:.5 Eb5:2 | D5:1.5 Eb5:.5 F5:1 Bb5:1 | G5:2 E5:1 Bb5:1 |
                    Ab5:1.5 G5:.5 F5:1 C6:1 | C6:2! Ab5:1 F5:1 | Ab5:1 Eb5:1 D5:1.5 F5:.5 | Eb5:3 r:1`,
          cello: `G3:2 Bb3:2 | Ab3:2 C4:2 | Bb3:2 D4:2 | C4:2 Bb3:2 | Ab3:2 C4:2 | Ab3:2 F3:2 | Ab3:4 | G3:4`,
        } },
      { name: 'Turn', bars: 2, layers: 'harpI pad bassI', dyn: [0.9, 0.75],
        chords: 'Ab/Bb | Bb7sus4',
        parts: { celesta: `r:2 C5:1 Eb5:1 | F5:4` } },
    ],
  },
  {
    id: 'rain', title: 'Rainy Day', key: 'A major', seed: 5505, bpm: 78, bpb: 4, swing: 0.62,
    idea: 'Lazy swung guitar phrases built from a three-note pick-up into a held note, over warm ninth chords that slide down from IV; a borrowed minor iv and a passing diminished chord colour the middle.',
    scale: [9, 11, 1, 2, 4, 6, 8],
    rev: { t60: 1.8, damp: 0.45, gain: 0.5 }, del: { gain: 0.5, fb: 0.3 },
    rain: -33.5, shelf: -2,
    inst: {
      guitar: { voice: V.nylon, level: -19.5, pan: 0.12, rev: 0.32, del: 0.22, hp: 140, legato: 1.25, jitter: 9, lay: 12 },
      ep: { voice: V.ep, level: -22, pan: -0.15, spread: 0.3, rev: 0.25, del: 0.06, hp: 130, legato: 1.0, jitter: 8, lp: 7000 },
      flute: { voice: V.softFlute, level: -22.5, pan: -0.25, rev: 0.4, del: 0.2, hp: 250, legato: 0.98, lp: 4500 },
      bass: { voice: V.roundBass, level: -22.5, rev: 0.03, legato: 0.9, lp: 1300, lay: 8 },
      pad: { voice: V.pad, level: -31, wide: true, rev: 0.4, hp: 200 },
      kick: { voice: perc('lokick'), peak: -13.5, rev: 0.02, lay: 4 },
      snare: { voice: perc('snare'), peak: -15, pan: 0.05, rev: 0.22, lay: 16 },
      rim: { voice: perc('rim'), peak: -17, pan: -0.2, rev: 0.25, lay: 14 },
      hat: { voice: perc('hat'), peak: -18, pan: 0.3, rev: 0.1, jitter: 7, lay: 6 },
    },
    layers: {
      ep: { kind: 'chord', inst: 'ep', center: 61, strum: 20, pat: ['0:x:2.4:.7 2.5:x:1.4:.5', '0:x:1.4:.66 1.5:x:2.4:.52'] },
      bass: { kind: 'bass', inst: 'bass', lo: 40, pat: ['0:R:1.4:.8 1.5:R:.5:.45 2.5:5:.9:.6 3.5:A:.5:.5', '0:R:1.9:.8 2.5:R:.9:.55 3.5:A:.5:.5'] },
      bassI: { kind: 'bass', inst: 'bass', lo: 40, pat: '0:R:3.5:.7' },
      pad: { kind: 'pad', inst: 'pad', center: 62 },
      hats: { kind: 'perc', pat: '0:hat:.42 .5:hat:.24 1:hat:.5 1.5:hat:.24 2:hat:.42 2.5:hat:.26 3:hat:.5 3.5:hat:.3' },
      drums: { kind: 'perc', pat: ['0:kick:.8 2.5:kick:.58 1:snare:.6 3:snare:.66', '0:kick:.8 1.5:kick:.42 2.5:kick:.58 1:snare:.6 3:snare:.66'] },
      drumsB: { kind: 'perc', pat: ['0:kick:.7 2.5:kick:.5 1:rim:.5 3:rim:.55', '0:kick:.7 2.5:kick:.5 1:rim:.5 3:rim:.55 3.5:rim:.3'] },
    },
    sections: [
      { name: 'Intro', bars: 2, layers: 'ep*0.9 pad', dyn: [0.8, 0.9], chords: 'Dmaj9 | C#m7' },
      { name: 'Intro2', bars: 2, layers: 'ep bassI hats*0.8 pad', dyn: [0.9, 1], chords: 'Bm9 | E9sus4' },
      { name: 'A', bars: 8, layers: 'ep bass hats drums pad',
        chords: 'Dmaj9 | C#m7 | Bm9 | E9sus4 | Amaj7 | G#m7b5 C#7 | F#m9 | Bm7 E9',
        parts: { guitar: `r:1 C#5:.5 E5:.5 F#5:1.5 E5:.5 | E5:2 r:1 B4:.5 C#5:.5 | D5:1.5 C#5:.5 A4:1 F#4:1 | A4:1 B4:2 r:1 |
                          r:1 C#5:.5 E5:.5 G#5:1.5 F#5:.5 | F#5:1 D5:1 F5:1.5 C#5:.5 | F#5:1.5 E5:.5 C#5:1 A4:1 | B4:1 D5:1 F#5:1.5 E5:.5` } },
      { name: 'B', bars: 8, layers: 'ep*0.9 bass hats drumsB pad*1.2', dyn: [0.92, 1.05],
        chords: 'F#m9 | B9 | Dmaj7 | Dm6 | C#m7 | Cdim7 | Bm9 | E9sus4',
        parts: {
          flute: `A5:2 G#5:1 E5:1 | F#5:3 D#5:1 | E5:1 F#5:1 A5:2 | A5:1.5 F5:.5 D5:2 | E5:1.5 F#5:.5 G#5:1 B5:1 | A5:2! F#5:1 D#5:1 | D5:1.5 C#5:.5 B4:1 D5:1 | F#5:1 E5:3`,
          guitar: `r:4 | r:4 | r:4 | r:2.5 B4:.5 D5:.5 F5:.5 | r:4 | r:4 | r:4 | r:2.5 A4:.5 B4:1`,
        } },
      { name: "A'", bars: 6, layers: 'ep bass hats drums pad', dyn: [1.02, 1.06],
        chords: 'Dmaj9 | C#m7 | Bm9 | E9sus4 | Amaj7 | G#m7b5 C#7',
        parts: { guitar: `r:1 C#5:.5 E5:.5 F#5:1.5 E5:.5 | E5:1.5 G#5:.5 E5:1 B4:.5 C#5:.5 | D5:1.5 C#5:.5 A4:1 F#4:1 | A4:1 B4:2 r:1 |
                          r:1 C#5:.5 E5:.5 G#5:1.5 F#5:.5 | F#5:1 D5:1 F5:1.5 C#5:.5` } },
      { name: 'Turn', bars: 2, layers: 'ep*0.9 bassI hats*0.7 pad', dyn: [0.95, 0.75],
        chords: 'F#m9 B9 | Bm9 E9sus4',
        parts: { guitar: `F#5:1 A5:1 F#5:1 D#5:1 | D5:1 C#5:1 B4:2` } },
    ],
  },
  {
    id: 'night', title: 'Night Lanterns', key: 'C dorian', seed: 6606, bpm: 86, bpb: 4, swing: 0.6,
    idea: 'A rising-fourth "lantern" call on vibraphone answered by a falling line a step lower each time, over a dorian vamp; a clarinet guide-tone line slides down by semitones underneath and then takes the bridge.',
    scale: [0, 2, 3, 5, 7, 9, 10],
    rev: { t60: 2.6, damp: 0.4, gain: 0.58 }, del: { gain: 0.5, fb: 0.3 },
    shelf: 1.5, presence: 4,
    inst: {
      vibes: { voice: V.vibes, level: -19.5, pan: -0.1, spread: 0.2, rev: 0.4, del: 0.2, hp: 180, legato: 1.5, jitter: 9, lay: 8 },
      clarinet: { voice: V.clarinet, level: -23.5, pan: 0.3, rev: 0.4, del: 0.1, hp: 120, legato: 1.0, jitter: 9 },
      ep: { voice: V.ep, level: -23.5, pan: 0.2, spread: 0.3, rev: 0.3, hp: 150, legato: 1, lp: 6000 },
      bass: { voice: V.upright, level: -23, rev: 0.06, legato: 0.92, lp: 1600, lay: 6 },
      pad: { voice: V.pad, level: -28.5, wide: true, rev: 0.45, hp: 170 },
      brush: { voice: perc('brush'), peak: -14.5, pan: -0.2, rev: 0.25, lay: 10 },
      hat: { voice: perc('ride'), peak: -20, pan: 0.35, rev: 0.2, jitter: 7 },
      rim: { voice: perc('rim'), peak: -19, pan: 0.15, rev: 0.3, lay: 10 },
    },
    layers: {
      comp: { kind: 'chord', inst: 'ep', center: 60, strum: 16, pat: ['1.5:x:1.5:.55', '0:x:1.5:.5 2.5:x:1:.42'] },
      vcomp: { kind: 'chord', inst: 'vibes', center: 62, voices: 3, strum: 28, pat: ['0:x:3:.4', '1.5:x:2:.36'] },
      bass: { kind: 'bass', inst: 'bass', lo: 36, pat: ['0:R:1.9:.8 2:5:.95:.6 3:A:.95:.62', '0:R:1.4:.8 1.5:R:.5:.42 2:5:.95:.6 3:A:.95:.62'] },
      bassI: { kind: 'bass', inst: 'bass', lo: 36, pat: '0:R:2.9:.72 3:A:.95:.5' },
      pad: { kind: 'pad', inst: 'pad', center: 60 },
      brush: { kind: 'perc', pat: ['1:brush:.5 3:brush:.55', '1:brush:.5 3:brush:.55 3.5:rim:.3'] },
      ride: { kind: 'perc', pat: '0:hat:.4 1:hat:.5 1.5:hat:.28 2:hat:.4 3:hat:.5 3.5:hat:.28' },
    },
    sections: [
      { name: 'Intro', bars: 4, layers: 'pad bassI comp*0.9 ride*0.8', dyn: [0.8, 0.95],
        chords: 'Cm9 | F9 | Cm9 | F9',
        parts: { vibes: `r:4 | r:4 | r:2 D5:1 C5:1 | A4:3 r:1` } },
      { name: 'A', bars: 8, layers: 'pad bass brush ride*0.7',
        chords: 'Cm9 | F9 | Bbmaj9 | Ebmaj7 | Am7b5 | Abmaj7 | G7sus4 | G7b9',
        parts: { vibes: `r:1 G4:.5 C5:.5 D5:2 | r:1 Eb5:.5 D5:.5 C5:1 A4:1 | r:1 F4:.5 Bb4:.5 C5:2 | r:1 D5:.5 C5:.5 Bb4:1 G4:1 |
                         r:.5 C5:.5 Eb5:.5 G5:.5 F5:1 Eb5:1 | G5:1.5! Eb5:.5 C5:2 | r:1 D5:.5 F5:.5 G5:1 F5:1 | Ab5:1.5 G5:.5 D5:1 B4:1` } },
      { name: "A'", bars: 8, layers: 'pad bass brush ride comp', dyn: [1, 1.08],
        chords: 'Cm9 | F9 | Bbmaj9 | Ebmaj7 | Am7b5 | Ab7 | G7sus4 G7 | Cm6',
        parts: {
          vibes: `r:1 G4:.5 C5:.5 D5:1.5 Eb5:.5 | r:.5 F5:.5 Eb5:.5 D5:.5 C5:1 A4:1 | r:1 F4:.5 Bb4:.5 C5:1.5 D5:.5 | r:1 D5:.5 C5:.5 Bb4:1 G4:1 |
                  r:.5 C5:.5 Eb5:.5 G5:.5 F5:1 Eb5:1 | Gb5:1.5! Eb5:.5 C5:2 | C5:1 D5:1 F5:1 D5:.5 B4:.5 | C5:3 r:1`,
          clarinet: `Bb3:4 | A3:4 | F3:4 | G3:4 | G3:4 | Gb3:4 | F3:4 | Eb3:2 A3:2`,
        } },
      { name: 'B', bars: 8, layers: 'pad bass brush vcomp', dyn: [0.92, 1.06],
        chords: 'Fm9 | Bb9 | Ebmaj7 | C7/E | Fm9 | F#dim7 | G7sus4 | G7',
        parts: {
          clarinet: `C5:2 Bb4:.5 Ab4:.5 G4:1 | Ab4:2 r:1 D4:.5 F4:.5 | G4:2 F4:.5 Eb4:.5 D4:1 | E4:2 r:1 G4:.5 Bb4:.5 |
                     C5:1.5 Eb5:.5 G5:2! | F#5:1.5 Eb5:.5 C5:2 | D5:1.5 C5:.5 G4:2 | B4:1.5 D5:.5 F5:2`,
        } },
      { name: 'Turn', bars: 2, layers: 'pad bassI ride*0.6', dyn: [0.9, 0.75],
        chords: 'Abmaj7 | G7sus4',
        parts: { vibes: `r:1 G4:.5 C5:.5 Eb5:2 | D5:3 r:1` } },
    ],
  },
  // ───────── activity stations ─────────
  {
    id: 'forage', title: 'Forest Trail', key: 'F major (lydian touches)', seed: 7707, bpm: 102, bpb: 4,
    idea: 'A curious "step, step, hop and drop" ocarina figure that is repeated a tone higher on the raised fourth; a clarinet walks the middle section into the dominant key before a flat-seven chord drops it back home.',
    scale: [5, 7, 9, 10, 0, 2, 4],
    rev: { t60: 1.5, damp: 0.42, gain: 0.45 }, del: { gain: 0.45, fb: 0.24 },
    shelf: 3, presence: 1,
    inst: {
      ocarina: { voice: V.ocarina, level: -19, pan: -0.1, rev: 0.34, del: 0.14, hp: 300, legato: 0.9, jitter: 7 },
      clarinet: { voice: V.clarinet, level: -22.5, pan: 0.25, rev: 0.34, del: 0.06, hp: 120, legato: 0.98, jitter: 9 },
      clarLow: { voice: V.clarinet, level: -27.5, pan: 0.25, rev: 0.36, hp: 120, legato: 1.0, jitter: 10 },
      kalimba: { voice: V.kalimba, level: -24, pan: 0.38, spread: 0.3, rev: 0.3, del: 0.16, hp: 250, legato: 1.5 },
      pizz: { voice: V.pizz, level: -25.5, pan: -0.36, spread: 0.15, rev: 0.26, hp: 130, legato: 1.2 },
      bass: { voice: V.upright, level: -20.5, rev: 0.06, legato: 0.85, lp: 1700 },
      pad: { voice: V.pad, level: -30, wide: true, rev: 0.4, hp: 200 },
      congaH: { voice: perc('congaH'), peak: -16, pan: 0.2, rev: 0.2 },
      congaL: { voice: perc('congaL'), peak: -14.5, pan: -0.05, rev: 0.18 },
      shaker: { voice: perc('shaker'), peak: -16, pan: -0.35, rev: 0.12, jitter: 4 },
      wood: { voice: perc('wood'), peak: -15.5, pan: 0.45, rev: 0.25 },
    },
    layers: {
      kal: { kind: 'chord', inst: 'kalimba', center: 72, pat: ['0:0:1:.7 .5:2:.5:.5 1.5:1:.5:.6 2:2:1:.6 3:0:.5:.55 3.5:1:.5:.5', '0:0:1:.7 1:2:.5:.55 1.5:1:.5:.6 2.5:2:.5:.55 3:1:.5:.6 3.5:2:.5:.5'] },
      pizz: { kind: 'chord', inst: 'pizz', center: 58, strum: 6, pat: ['1:x:.5:.6 2.5:x:.5:.55 3:x:.5:.45', '1:x:.5:.6 2.5:x:.5:.55'] },
      bass: { kind: 'bass', inst: 'bass', lo: 38, pat: ['0:R:1:.82 1.5:5:.5:.5 2:R:.9:.66 3:A:.9:.6', '0:R:1:.82 2:5:.9:.62 3:A:.9:.6'] },
      bassT: { kind: 'bass', inst: 'bass', lo: 38, pat: '0:R:3.5:.7' },
      pad: { kind: 'pad', inst: 'pad', center: 60 },
      drum: { kind: 'perc', pat: ['0:congaL:.62 1.5:congaL:.4 2.5:congaH:.52 3:congaL:.45', '0:congaL:.62 1.5:congaH:.45 2.5:congaH:.52 3.5:congaL:.4'] },
      drumF: { kind: 'perc', pat: ['0:congaL:.64 1.5:congaL:.4 2.5:congaH:.52 3:congaL:.45 1:wood:.4 3:wood:.45', '0:congaL:.64 1.5:congaH:.45 2.5:congaH:.52 3.5:congaL:.4 1:wood:.4 3:wood:.45 3.5:wood:.28'] },
      shake: { kind: 'perc', pat: SHAKER8 },
    },
    sections: [
      { name: 'Intro', bars: 2, layers: 'kal*0.9 pizz*0.8 shake*0.6 bassT*0.8', dyn: [0.8, 0.95], chords: 'F | F' },
      { name: 'A', bars: 8, layers: 'kal pizz bass drum shake*0.7',
        chords: 'F | G/F | Bbmaj7 | C7sus4 C7 | Dm7 | G7 | Bb/C | C7',
        parts: { ocarina: `F5:.5 G5:.5 A5:1 C5:1 r:1 | G5:.5 A5:.5 B5:1 D5:1 r:1 | A5:1.5 G5:.5 F5:1 D5:1 | F5:1 G5:1 E5:1.5 C5:.5 |
                           F5:.5 G5:.5 A5:1 D5:1 r:1 | G5:.5 A5:.5 B5:1 D6:1.5! B5:.5 | C6:1.5 Bb5:.5 F5:1 D5:1 | E5:1.5 F5:.5 G5:2` } },
      { name: "A'", bars: 8, layers: 'kal pizz bass drumF shake*0.8', dyn: [1, 1.07],
        chords: 'F | G/F | Bbmaj7 | A7 | Dm | Db | Gm7 C7 | F',
        parts: {
          ocarina: `F5:.5 G5:.5 A5:1 C5:1 r:.5 C5:.5 | G5:.5 A5:.5 B5:1 D5:1 r:1 | A5:1.5 G5:.5 F5:1 D5:1 | C#5:1 E5:1 G5:1.5 A5:.5 |
                    D6:1.5! C6:.5 A5:1 F5:1 | Ab5:1.5 F5:.5 Eb5:.5 F5:.5 Ab5:1 | G5:1 Bb5:1 A5:.5 G5:.5 E5:1 | F5:3 r:1`,
          clarLow: `A3:4 | B3:4 | D4:4 | C#4:4 | D4:2 F4:2 | F4:4 | F4:2 E4:2 | F4:4`,
        } },
      { name: 'B', bars: 8, layers: 'pizz bass drum*0.8 pad kal*0.6', dyn: [0.9, 1.05],
        chords: 'Dm7 | G7 | C | Am7 | Eb | Bb/D | C7sus4 | C7',
        parts: {
          clarinet: `A4:1.5 G4:.5 F4:1 D4:1 | F4:1 G4:.5 A4:.5 B4:2 | G4:1.5 F4:.5 E4:1 C4:1 | E4:1 F4:.5 G4:.5 A4:2 |
                     G4:1 Bb4:1 C5:.5 Bb4:.5 G4:1 | F4:1 Bb4:1 A4:.5 G4:.5 F4:1 | G4:2 F4:1 G4:1 | E4:1.5 G4:.5 Bb4:1 C5:1`,
          ocarina: `r:4 | r:2.5 D6:.5 B5:1 | r:4 | r:2.5 C6:.5 A5:1 | r:4 | r:4 | r:2 C6:1 Bb5:1 | r:4`,
        } },
      { name: "A''", bars: 6, layers: 'kal pizz bass drumF shake', dyn: [1.05, 1.1],
        chords: 'F | G/F | Bbmaj7 | A7 | Dm7 Db | Gm7 C7',
        parts: {
          ocarina: `F5:.5 G5:.5 A5:1 C5:1 r:1 | G5:.5 A5:.5 B5:1 D5:1 r:1 | A5:1.5 G5:.5 F5:1 D5:1 | C#5:1 E5:1 G5:1.5 A5:.5 |
                    D6:1.5! C6:.5 Ab5:1 F5:1 | G5:1 Bb5:1 A5:.5 G5:.5 E5:1`,
          clarLow: `A3:4 | B3:4 | D4:4 | C#4:4 | D4:2 F4:2 | F4:2 E4:2`,
        } },
      { name: 'Turn', bars: 2, layers: 'kal*0.8 pizz*0.7 bassT shake*0.5', dyn: [0.9, 0.72],
        chords: 'Fadd9 | Bb/C',
        parts: { ocarina: `F5:2 r:2 | r:4`, clarLow: `F4:2 G4:2 | F4:3 r:1` } },
    ],
  },
  {
    id: 'fishing', title: 'Quiet Pier', key: 'E major (mixolydian and borrowed colours)', seed: 8808, bpm: 192, bpb: 6,
    meter: '64 BPM (dotted quarter), 6/8', strong: [0, 3], unit: 2,
    idea: 'A long flute line that drifts down four notes and floats back up over a rocking guitar arpeggio; the cello answers in the middle with a three-note sigh that rises by sequence, and a flat-seven and a borrowed C major chord ripple the surface.',
    scale: [4, 6, 8, 9, 11, 1, 3],
    rev: { t60: 2.8, damp: 0.34, gain: 0.58 }, del: { gain: 0.45, fb: 0.3 },
    water: -35,
    inst: {
      flute: { voice: V.softFlute, level: -19.5, pan: -0.08, rev: 0.4, del: 0.14, hp: 250, legato: 1.0, jitter: 10 },
      cello: { voice: V.cello, level: -21.5, pan: 0.18, rev: 0.38, del: 0.06, hp: 90, legato: 1.0, jitter: 11 },
      celloLow: { voice: V.cello, level: -27, pan: 0.2, rev: 0.4, hp: 90, legato: 1.02, jitter: 12 },
      guitar: { voice: V.nylon, level: -25, pan: -0.3, spread: 0.25, rev: 0.3, del: 0.08, hp: 110, legato: 1.7, jitter: 8 },
      harp: { voice: V.harp, level: -27, pan: 0.42, spread: 0.3, rev: 0.4, del: 0.2, hp: 200, legato: 2 },
      bell: { voice: V.celesta, level: -29, pan: 0.5, spread: 0.6, rev: 0.6, del: 0.5, hp: 700 },
      bass: { voice: V.roundBass, level: -22.5, rev: 0.05, legato: 0.96, lp: 1500 },
      pad: { voice: V.widePad, level: -27, wide: true, rev: 0.45, hp: 170 },
    },
    layers: {
      gtr: { kind: 'chord', inst: 'guitar', center: 57, pat: ['0:0:3:.72 1:1:2:.5 2:2:2:.56 3:3:3:.64 4:2:2:.52 5:1:1:.48', '0:0:3:.72 1:2:2:.5 2:1:2:.54 3:3:3:.64 4:1:2:.5 5:2:1:.5'] },
      gtrI: { kind: 'chord', inst: 'guitar', center: 57, pat: '0:0:6:.66 1:1:5:.48 2:2:4:.54 3:3:3:.58' },
      harp: { kind: 'chord', inst: 'harp', center: 71, pat: ['0:0:3:.6 2:2:2:.5 3:1:3:.55 5:3:1:.5', '1:1:2:.5 3:2:3:.56 4:3:2:.5'] },
      glint: { kind: 'chord', inst: 'bell', center: 86, voices: 3, pat: ['4:1:2:.5', '2:2:2:.45', '5:0:1:.45', '1:2:2:.5 4:0:2:.4'] },
      bass: { kind: 'bass', inst: 'bass', lo: 40, pat: ['0:R:5.6:.75', '0:R:2.9:.75 3:5:2.7:.5'] },
      pad: { kind: 'pad', inst: 'pad', center: 61 },
    },
    sections: [
      { name: 'Intro', bars: 4, layers: 'gtrI pad*0.85 bass*0.8 glint*0.8', dyn: [0.78, 0.95], chords: 'Eadd9 | Eadd9 | Amaj7/E | Amaj7/E' },
      { name: 'A', bars: 8, layers: 'gtr pad bass',
        chords: 'Eadd9 | G#m7 | Amaj7 | B7sus4 | C#m7 | Amaj7 | F#m7 | B7sus4',
        parts: { flute: `B5:3 A5:1 G#5:1 F#5:1 | F#5:4 D#5:2 | E5:3 F#5:1 G#5:1 A5:1 | F#5:4 B5:2 |
                         G#5:3 F#5:1 E5:1 D#5:1 | E5:3 A5:2 G#5:1 | A5:2 B5:1 C#6:3! | B5:4 A5:2` } },
      { name: "A'", bars: 8, layers: 'gtr pad bass glint harp*0.7', dyn: [1, 1.07],
        chords: 'Eadd9 | G#m7 | Amaj7 | G#7 | C#m7 | D | A/B | E',
        parts: {
          flute: `B5:3 A5:1 G#5:1 F#5:1 | F#5:3 D#5:2 F#5:1 | E5:3 F#5:1 G#5:1 A5:1 | G#5:3 F#5:1 D#5:1 C5:1 |
                  C#5:2 E5:1 G#5:3 | A5:3! G#5:1 F#5:1 D5:1 | C#5:2 E5:1 A5:2 B5:1 | G#5:5 r:1`,
        } },
      { name: 'B', bars: 8, layers: 'gtr*0.9 harp pad*1.1 bass', dyn: [0.92, 1.06],
        chords: 'C#m7 | B/D# | E | A | F#m7 | Cmaj7 | B7sus4 | B7',
        parts: {
          cello: `E4:3 D#4:1 C#4:2 | D#4:3 F#4:3 | G#4:3 F#4:1 E4:2 | C#4:3 E4:3 | A4:3! G#4:1 F#4:2 | G4:3 E4:2 G4:1 | F#4:3 E4:3 | D#4:3 F#4:2 A4:1`,
          flute: `r:6 | r:3 B5:1 F#5:2 | r:6 | r:3 A5:1 E5:2 | r:6 | r:3 B5:1 G5:2 | r:6 | r:6`,
        } },
      { name: "A''", bars: 8, layers: 'gtr pad bass glint harp', dyn: [1.05, 1.1],
        chords: 'Eadd9 | G#m7 | Amaj7 | G#7 | C#m7 | D | A/B | E',
        parts: {
          flute: `B5:3 A5:1 G#5:1 F#5:1 | F#5:3 D#5:2 F#5:1 | E5:3 F#5:1 G#5:1 A5:1 | G#5:3 F#5:1 D#5:1 C5:1 |
                  C#5:2 E5:1 G#5:3 | A5:3! G#5:1 F#5:1 D5:1 | C#5:2 E5:1 A5:2 B5:1 | G#5:5 r:1`,
          celloLow: `G#3:6 | B3:6 | C#4:6 | C4:3 D#4:3 | E4:6 | F#4:6 | E4:6 | E4:3 B3:3`,
        } },
      { name: 'Turn', bars: 4, layers: 'gtrI pad bass*0.9 glint*0.7', dyn: [0.92, 0.72],
        chords: 'Amaj7 | E/G# | F#m7 | B7sus4',
        parts: { flute: `E5:3 C#5:3 | B4:6 | r:6 | r:6`, celloLow: `r:6 | r:6 | A3:3 C#4:3 | B3:6` } },
    ],
  },
  {
    id: 'mining', title: 'Crystal Caves', key: 'A phrygian (B-flat lydian colour)', seed: 9909, bpm: 108, bpb: 4,
    idea: 'A crystal-bell call (up a fourth, hold) answered by a falling semitone figure that is moved to new chord degrees over a pulsing A pedal; the middle opens into B-flat lydian with its raised fourth and ends on a glowing A major chord.',
    scale: [9, 10, 0, 2, 4, 5, 7],
    rev: { t60: 3.0, damp: 0.3, gain: 0.6 }, del: { gain: 0.6, fb: 0.38 },
    shelf: 0.5,
    inst: {
      crystal: { voice: V.crystal, level: -20.5, pan: -0.05, rev: 0.45, del: 0.26, hp: 250, legato: 1.3, jitter: 7 },
      glass: { voice: V.bell, level: -27.5, pan: 0.45, spread: 0.7, rev: 0.55, del: 0.5, hp: 500 },
      cello: { voice: V.cello, level: -25.5, pan: 0.25, rev: 0.4, hp: 90, legato: 1.02, jitter: 10 },
      pulse: { voice: V.softBass, level: -21, rev: 0.05, legato: 0.72, lp: 1700, jitter: 3 },
      pad: { voice: V.widePad, level: -26.5, wide: true, rev: 0.45, hp: 150 },
      tomL: { voice: perc('tomL'), peak: -14, pan: -0.15, rev: 0.3, del: 0.35 },
      rim: { voice: perc('rim'), peak: -13.5, pan: 0.3, rev: 0.3, del: 0.6 },
      hat: { voice: perc('hat'), peak: -17, pan: -0.4, rev: 0.15, del: 0.25, jitter: 4 },
    },
    layers: {
      pulse: { kind: 'bass', inst: 'pulse', lo: 43, pat: '0:R:.5:.85 .5:R:.5:.5 1:R:.5:.62 1.5:8:.5:.6 2:R:.5:.78 2.5:R:.5:.5 3:8:.5:.62 3.5:R:.5:.52' },
      pulseI: { kind: 'bass', inst: 'pulse', lo: 43, pat: '0:R:.5:.8 1:R:.5:.5 1.5:R:.5:.5 2:R:.5:.7 3:R:.5:.5 3.5:R:.5:.45' },
      glass: { kind: 'chord', inst: 'glass', center: 77, pat: ['.5:2:1:.55 1.5:1:1:.5 3:3:1:.55', '1:0:1:.5 2.5:2:1:.55 3.5:1:.5:.45'] },
      pad: { kind: 'pad', inst: 'pad', center: 60 },
      perc: { kind: 'perc', pat: ['0:tomL:.6 2.5:rim:.45', '1.5:rim:.4 3:tomL:.42'] },
      percF: { kind: 'perc', pat: ['0:tomL:.62 2.5:rim:.45 1:hat:.4 3:hat:.4 3.5:hat:.25', '1.5:rim:.4 3:tomL:.44 1:hat:.4 2:hat:.25 3:hat:.4'] },
    },
    sections: [
      { name: 'Intro', bars: 4, layers: 'pulseI pad*0.85 perc*0.8', dyn: [0.78, 0.95], chords: 'Am | Am | Bb/A | Am',
        parts: { crystal: `r:4 | r:4 | r:2 F5:1 D5:1 | E5:3 r:1` } },
      { name: 'A', bars: 8, layers: 'pulse pad perc glass*0.7',
        chords: 'Am | Bb/A | Am | Gm7 | Dm | Bbmaj7 | Gm7 | Am',
        parts: { crystal: `E5:1 A5:2 E5:1 | F5:1.5 E5:.5 D5:2 | E5:1 A5:2 C6:1 | Bb5:1.5 A5:.5 G5:2 |
                           D6:1.5! C6:.5 A5:2 | r:1 Bb5:1 A5:1 F5:1 | G5:1.5 F5:.5 D5:2 | E5:3 r:1` } },
      { name: "A'", bars: 8, layers: 'pulse pad percF glass', dyn: [1, 1.07],
        chords: 'Am | Bb/A | Am | Gm7 | F | C/E | Bbmaj7 | Asus4',
        parts: { crystal: `E5:1 A5:2 E5:1 | F5:1.5 E5:.5 D5:1 F5:1 | E5:1 A5:2 C6:1 | Bb5:1.5 A5:.5 G5:1 D6:1 |
                           C6:1.5! Bb5:.5 A5:2 | E5:1 G5:1 C6:2 | Bb5:1.5 A5:.5 F5:2 | E5:1 A5:3` } },
      { name: 'B', bars: 8, layers: 'pulseI*0.9 pad*1.1 glass perc*0.7', dyn: [0.92, 1.08],
        chords: 'Bbmaj7 | C/Bb | Am7 | Dm7 | Bbmaj7 | C/Bb | Gm6 | A',
        parts: {
          crystal: `D6:1.5 C6:.5 A5:2 | E6:1.5 D6:.5 C6:2 | C6:1 E6:1.5 D6:.5 C6:1 | A5:3 r:1 |
                    D6:1.5 C6:.5 A5:1 F5:1 | E6:1.5! D6:.5 C6:1 G5:1 | G5:1 Bb5:1 E6:1 D6:1 | C#6:3 r:1`,
          cello: `F3:4 | G3:4 | G3:2 E3:2 | F3:4 | F3:4 | G3:4 | G3:2 Bb3:2 | A3:4`,
        } },
      { name: "A''", bars: 6, layers: 'pulse pad percF glass', dyn: [1.05, 1.1],
        chords: 'Am | Bb/A | Am | Gm7 | F | C/E',
        parts: {
          crystal: `E5:1 A5:2 E5:1 | F5:1.5 E5:.5 D5:1 F5:1 | E5:1 A5:2 C6:1 | Bb5:1.5 A5:.5 G5:1 D6:1 | C6:1.5! Bb5:.5 A5:2 | E5:1 G5:1 C6:2`,
          cello: `E3:4 | F3:4 | E3:4 | D3:2 F3:2 | F3:2 A3:2 | G3:4`,
        } },
      { name: 'Turn', bars: 2, layers: 'pulseI pad perc*0.7', dyn: [0.9, 0.72],
        chords: 'Bbmaj7 | Asus4',
        parts: { crystal: `Bb5:1.5 A5:.5 F5:2 | E5:1 A5:2 r:1` } },
    ],
  },
  {
    id: 'fighting', title: 'Into the Dark', key: 'E minor', seed: 10010, bpm: 140, bpb: 4,
    idea: 'A horn call that springs up a fourth and steps on to the third, sequenced down over a galloping bass; the middle lifts into C and G with a raised-sixth A7, and the reprise adds a second horn in sixths and contrary motion.',
    scale: [4, 6, 7, 9, 11, 0, 2],
    rev: { t60: 1.4, damp: 0.42, gain: 0.42 }, del: { gain: 0.35, fb: 0.22 },
    shelf: 2, presence: 1.5,
    inst: {
      brass: { voice: V.brass, level: -19, pan: -0.08, rev: 0.3, del: 0.1, hp: 180, legato: 0.92, jitter: 6 },
      horn2: { voice: V.brass, level: -23.5, pan: 0.22, rev: 0.32, hp: 180, legato: 0.92, jitter: 7 },
      viola: { voice: V.viola, level: -27, pan: 0.3, rev: 0.34, hp: 180, legato: 1.02, jitter: 9 },
      stab: { voice: V.stab, level: -21, pan: 0.3, spread: 0.3, rev: 0.28, hp: 160, legato: 0.9, jitter: 4 },
      bass: { voice: V.synthBass, level: -20.5, rev: 0.03, legato: 0.78, lp: 2200, jitter: 3 },
      pad: { voice: V.pad, level: -28.5, wide: true, rev: 0.36, hp: 160 },
      kick: { voice: perc('kick'), peak: -10.5, rev: 0.03 },
      snare: { voice: perc('snare'), peak: -11.5, pan: 0.05, rev: 0.2 },
      tomH: { voice: perc('tomH'), peak: -14, pan: 0.3, rev: 0.2 },
      tomL: { voice: perc('tomL'), peak: -13, pan: -0.3, rev: 0.2 },
      hat: { voice: perc('hat'), peak: -15, pan: 0.35, rev: 0.08, jitter: 4 },
    },
    layers: {
      bass: { kind: 'bass', inst: 'bass', lo: 40, splitPat: true, pat: ['0:R:.5:.88 .5:R:.5:.55 1:R:.5:.7 1.5:8:.5:.62 2:R:.5:.8 2.5:R:.5:.55 3:8:.5:.7 3.5:5:.5:.62', '0:R:.5:.88 .5:R:.5:.55 1:8:.5:.66 1.5:R:.5:.6 2:R:.5:.8 2.5:8:.5:.6 3:R:.5:.7 3.5:A:.5:.64'] },
      bassI: { kind: 'bass', inst: 'bass', lo: 40, splitPat: true, pat: '0:R:.5:.85 .5:R:.5:.5 1:R:.5:.6 1.5:R:.5:.5 2:R:.5:.75 2.5:R:.5:.5 3:R:.5:.6 3.5:R:.5:.5' },
      stab: { kind: 'chord', inst: 'stab', center: 62, strum: 2, pat: ['0:x:.35:.8 1.5:x:.35:.68 3:x:.35:.7', '0:x:.35:.8 1.5:x:.35:.68 2.5:x:.35:.6 3:x:.35:.7'] },
      stabB: { kind: 'chord', inst: 'stab', center: 62, strum: 2, pat: ['1:x:.35:.6 2.5:x:.35:.6', '1:x:.35:.6 2.5:x:.35:.6 3.5:x:.3:.5'] },
      pad: { kind: 'pad', inst: 'pad', center: 57 },
      hats: { kind: 'perc', pat: '0:hat:.45 .5:hat:.25 1:hat:.5 1.5:hat:.25 2:hat:.45 2.5:hat:.28 3:hat:.5 3.5:hat:.3' },
      drums: { kind: 'perc', pat: ['0:kick:.82 1:snare:.6 1.5:kick:.5 2.5:kick:.62 3:snare:.66', '0:kick:.82 1:snare:.6 2:kick:.6 2.5:kick:.45 3:snare:.66', '0:kick:.82 1:snare:.6 1.5:kick:.5 2.5:kick:.62 3:snare:.66', '0:kick:.82 1:snare:.6 2:tomH:.6 2.5:tomH:.5 3:tomL:.66 3.5:tomL:.5'] },
      drumsI: { kind: 'perc', pat: ['0:kick:.75 2:tomL:.5 3:tomL:.4', '0:kick:.75 1.5:tomH:.4 2:tomL:.5 3:tomL:.45 3.5:tomH:.4'] },
      drumsB: { kind: 'perc', pat: ['0:kick:.78 1.5:kick:.45 3:snare:.6', '0:kick:.78 2:kick:.5 3:snare:.6 3.5:tomL:.4'] },
    },
    sections: [
      { name: 'Intro', bars: 4, layers: 'bassI drumsI stabB*0.8 pad*0.8', dyn: [0.8, 1], chords: 'Em | Em | C/E | Em' },
      { name: 'A', bars: 8, layers: 'bass drums hats*0.8 stab pad',
        chords: 'Em | C | D | B7/D# | Em | Am7 | F | B7',
        parts: { brass: `B4:1 E5:1.5 F#5:.5 G5:1 | G5:1.5 F#5:.5 E5:2 | A4:1 D5:1.5 E5:.5 F#5:1 | F#5:1.5 E5:.5 D#5:2 |
                         B4:1 E5:1.5 F#5:.5 G5:1 | A5:2! G5:1 E5:1 | F5:1.5 G5:.5 A5:2 | B5:1.5! A5:.5 F#5:2` } },
      { name: "A'", bars: 8, layers: 'bass drums hats stab pad', dyn: [1, 1.06],
        chords: 'Em | C | D | B7/D# | G | D/F# | C D | Em',
        parts: {
          brass: `B4:1 E5:1.5 F#5:.5 G5:1 | G5:1.5 F#5:.5 E5:2 | A4:1 D5:1.5 E5:.5 F#5:1 | F#5:1.5 E5:.5 D#5:1 F#5:1 |
                  G5:1.5 A5:.5 B5:2! | A5:1.5 G5:.5 F#5:2 | G5:1 E5:1 F#5:1 A5:1 | G5:3 r:1`,
          viola: `E4:4 | E4:4 | F#4:4 | F#4:2 A4:2 | D4:2 G4:2 | A4:4 | G4:2 A4:2 | B4:4`,
        } },
      { name: 'B', bars: 8, layers: 'bass*0.9 drumsB hats*0.7 stabB pad*1.15', dyn: [0.92, 1.08],
        chords: 'C | G/B | Am7 | D | C | G/B | A7 | B7sus4 B7',
        parts: {
          brass: `E5:1.5 D5:.5 E5:1 G5:1 | D5:2 B4:1 D5:1 | C5:1.5 B4:.5 C5:1 E5:1 | D5:1 F#5:1 A5:2 |
                  G5:1.5 F#5:.5 G5:1 C6:1! | B5:2 G5:1 D5:1 | C#5:1 E5:1 G5:1.5 A5:.5 | B5:2 A5:1 F#5:1`,
          viola: `G4:4 | G4:4 | E4:4 | F#4:4 | E4:4 | D4:4 | E4:4 | E4:2 D#4:2`,
        } },
      { name: 'Break', bars: 4, layers: 'bassI drumsI stab*0.85 hats*0.6', dyn: [0.85, 1.05],
        chords: 'Em | Em | F | B7',
        parts: { brass: `r:4 | r:4 | r:4 | r:2 B4:1 D#5:1` } },
      { name: "A''", bars: 8, layers: 'bass drums hats stab pad', dyn: [1.06, 1.12],
        chords: 'Em | C | D | B7/D# | G | D/F# | C D | Em',
        parts: {
          brass: `B4:1 E5:1.5 F#5:.5 G5:1 | G5:1.5 F#5:.5 E5:2 | A4:1 D5:1.5 E5:.5 F#5:1 | F#5:1.5 E5:.5 D#5:1 F#5:1 |
                  G5:1.5 A5:.5 B5:2! | A5:1.5 G5:.5 F#5:2 | G5:1 E5:1 F#5:1 A5:1 | G5:3 r:1`,
          horn2: `G4:1 B4:1.5 D5:.5 E5:1 | E5:1.5 D5:.5 C5:2 | F#4:1 A4:2 D5:1 | A4:2 B4:1 D#5:1 |
                  B4:1.5 C5:.5 D5:2 | F#4:1.5 G4:.5 A4:2 | E5:1 C5:1 D5:1 F#5:1 | B4:3 r:1`,
        } },
      { name: 'Turn', bars: 4, layers: 'bassI*0.85 drumsB*0.8 pad stabB*0.7', dyn: [0.95, 0.75],
        chords: 'Em | C | Am7 | B7sus4',
        parts: { brass: `E5:3 r:1 | r:4 | r:4 | r:4`, viola: `G4:4 | G4:4 | E4:4 | E4:4` } },
    ],
  },
  // ───────── second and third tracks of each station ─────────
  {
    id: 'chores', title: 'Morning Chores', key: 'C major', seed: 11011, bpm: 112, bpb: 4,
    idea: 'A whistled walking tune (step-step-skip) that is lifted a third on to a bright E7, over a rolling banjo and an oom-pah bass; the banjo itself picks the middle section while the whistle answers.',
    scale: [0, 2, 4, 5, 7, 9, 11],
    rev: { t60: 1.6, damp: 0.38, gain: 0.46 }, del: { gain: 0.4, fb: 0.2 },
    shelf: 0,
    inst: {
      whistle: { voice: V.whistle, level: -19, pan: -0.08, rev: 0.32, del: 0.1, hp: 400, legato: 0.92, jitter: 7 },
      banjo: { voice: V.banjo, level: -25.5, pan: 0.38, spread: 0.2, rev: 0.2, hp: 220, legato: 1.3, jitter: 5 },
      banjoLead: { voice: V.banjo, level: -20.5, pan: 0.15, rev: 0.26, del: 0.08, hp: 220, legato: 1.3, jitter: 6 },
      uke: { voice: V.uke, level: -25, pan: -0.4, rev: 0.2, hp: 200, legato: 0.8 },
      clarLow: { voice: V.clarinet, level: -27.5, pan: 0.2, rev: 0.34, hp: 120, legato: 1.0, jitter: 10 },
      bass: { voice: V.softBass, level: -20.5, rev: 0.05, legato: 0.85, lp: 1800 },
      kick: { voice: perc('kick'), peak: -15.5, rev: 0.03 },
      pad: { voice: V.pad, level: -29, wide: true, rev: 0.4, hp: 200 },
      brush: { voice: perc('brush'), peak: -17, pan: 0.15, rev: 0.15, jitter: 4 },
      shaker: { voice: perc('shaker'), peak: -17, pan: -0.3, rev: 0.1, jitter: 4 },
      wood: { voice: perc('wood'), peak: -16, pan: 0.4, rev: 0.2 },
    },
    layers: {
      roll: { kind: 'chord', inst: 'banjo', center: 65, pat: ['0:0:.5:.7 .5:2:.5:.5 1:1:.5:.58 1.5:3:.5:.6 2:0:.5:.66 2.5:2:.5:.5 3:1:.5:.58 3.5:3:.5:.6', '0:0:.5:.7 .5:1:.5:.5 1:3:.5:.6 1.5:2:.5:.55 2:1:.5:.62 2.5:3:.5:.55 3:2:.5:.58 3.5:1:.5:.5'] },
      uke: { kind: 'chord', inst: 'uke', center: 62, strum: 9, pat: ['1:x:.5:.7 1.5:dx:.4:.4 3:x:.5:.7 3.5:dx:.4:.42', '1:x:.5:.7 3:x:.5:.7 3.5:dx:.4:.42'] },
      bass: { kind: 'bass', inst: 'bass', lo: 36, pat: ['0:R:.9:.85 2:5:.9:.7', '0:R:.9:.85 2:5:.9:.7 3.5:A:.5:.6'] },
      bassT: { kind: 'bass', inst: 'bass', lo: 36, pat: '0:R:3:.7' },
      train: { kind: 'perc', pat: [
        '0:kick:.7 2:kick:.55 0:brush:.3 .5:brush:.2 1:brush:.62 1.5:brush:.22 2:brush:.3 2.5:brush:.2 3:brush:.62 3.5:brush:.26',
        '0:kick:.7 2:kick:.55 0:brush:.3 .5:brush:.2 1:brush:.62 1.5:brush:.3 2:brush:.3 2.5:brush:.2 3:brush:.62 3.5:brush:.26 3.5:wood:.3',
        '0:kick:.7 2:kick:.55 0:brush:.3 .5:brush:.2 1:brush:.62 1.5:brush:.22 2:brush:.3 2.5:brush:.2 3:brush:.62 3.5:brush:.26',
        '0:kick:.7 2:kick:.55 0:brush:.3 .5:brush:.2 1:brush:.62 1.5:brush:.22 2:brush:.34 2.5:wood:.45 3:wood:.5 3.5:brush:.4'] },
      shake: { kind: 'perc', pat: SHAKER8 },
      pad: { kind: 'pad', inst: 'pad', center: 60 },
      clip: { kind: 'perc', pat: ['1:wood:.4 3:wood:.45', '1:wood:.4 2.5:wood:.3 3:wood:.45'] },
    },
    sections: [
      { name: 'Intro', bars: 4, layers: 'roll uke*0.8 bassT shake*0.8 clip*0.8 pad', dyn: [0.9, 1.05], chords: 'C | C | F/C | G7' },
      { name: 'A', bars: 8, layers: 'roll uke bass train pad',
        chords: 'C | E7 | Am | F | C/G | A7 | Dm7 | G7',
        parts: { whistle: `C5:.5 D5:.5 E5:1 G5:1 E5:1 | E5:.5 F#5:.5 G#5:1 B5:1 G#5:1 | A5:1.5 G5:.5 E5:1 C5:1 | F5:1 G5:.5 A5:.5 C6:2 |
                           C6:1 B5:.5 A5:.5 G5:1 E5:1 | C#5:.5 E5:.5 G5:1 A5:1 G5:1 | F5:1.5 E5:.5 D5:1 A5:1 | G5:1.5 A5:.5 B5:1 D6:1!` } },
      { name: "A'", bars: 8, layers: 'roll uke bass train shake*0.6 pad', dyn: [1, 1.06],
        chords: 'C | E7 | Am | F | C/G | A7 | Dm7 G7 | C',
        parts: {
          whistle: `C5:.5 D5:.5 E5:1 G5:1 E5:.5 G5:.5 | E5:.5 F#5:.5 G#5:1 B5:1 G#5:1 | A5:1.5 G5:.5 E5:1 C5:1 | F5:1 G5:.5 A5:.5 C6:2 |
                    C6:1 B5:.5 A5:.5 G5:1 E5:1 | C#5:.5 E5:.5 G5:1 A5:1 G5:1 | F5:1 A5:1 G5:.5 F5:.5 D5:1 | C5:3 r:1`,
          clarLow: `E4:4 | D4:4 | C4:4 | C4:4 | E4:4 | E4:2 C#4:2 | D4:2 B3:2 | C4:4`,
        } },
      { name: 'B', bars: 8, layers: 'uke bass train*0.9 roll*0.6 pad*1.2', dyn: [1, 1.08],
        chords: 'F | F#dim7 | C/G | A7 | Dm7 | Ab | G7sus4 | G7',
        parts: {
          banjoLead: `A4:.5 C5:.5 F5:1 E5:.5 D5:.5 C5:1 | A4:.5 C5:.5 Eb5:1 D5:.5 C5:.5 A4:1 | E5:1 G5:1 E5:.5 D5:.5 C5:1 | C#5:1 E5:.5 G5:.5 A5:2 |
                      A5:.5 G5:.5 F5:1 D5:1 F5:1 | Ab5:.5 G5:.5 Eb5:1 C5:1 Eb5:1 | D5:1 F5:1 G5:2 | F5:1.5 E5:.5 D5:1 B4:1`,
          whistle: `r:4 | r:4 | r:4 | r:2 E6:1 C#6:1 | r:4 | r:4 | r:4 | r:2 G5:.5 A5:.5 B5:1`,
        } },
      { name: "A''", bars: 6, layers: 'roll uke bass train shake*0.8 pad', dyn: [1.05, 1.1],
        chords: 'C | E7 | Am | F | C/G A7 | Dm7 G7',
        parts: {
          whistle: `C5:.5 D5:.5 E5:1 G5:1 E5:1 | E5:.5 F#5:.5 G#5:1 B5:1 G#5:1 | A5:1.5 G5:.5 E5:1 C5:1 | F5:1 G5:.5 A5:.5 C6:2 |
                    C6:1! G5:1 A5:1 G5:1 | F5:1 A5:1 G5:.5 F5:.5 D5:1`,
          clarLow: `E4:4 | D4:4 | C4:4 | C4:4 | E4:2 E4:2 | D4:2 B3:2`,
        } },
      { name: 'Turn', bars: 2, layers: 'roll*0.9 bassT shake*0.6 clip*0.6 pad*1.2', dyn: [0.95, 0.8],
        chords: 'C | G7sus4',
        parts: { whistle: `C5:2 r:2 | r:4`, clarLow: `E4:4 | D4:3 r:1` } },
    ],
  },
  {
    id: 'harvest', title: 'Harvest Dance', key: 'A major', seed: 12012, bpm: 378, bpb: 6,
    meter: '126 BPM (dotted quarter), 6/8', strong: [0, 3], unit: 2,
    idea: 'A three-part jig: a fiddle tune that rocks between E and A with a leading-note flick, a second strain that starts in F-sharp minor and jumps to a surprise G chord, and a broad accordion strain over a mixolydian G.',
    scale: [9, 11, 1, 2, 4, 6, 8],
    rev: { t60: 1.2, damp: 0.4, gain: 0.4 }, del: { gain: 0.3, fb: 0.18 },
    shelf: 1.5,
    inst: {
      fiddle: { voice: V.fiddle, level: -19, pan: -0.1, rev: 0.3, del: 0.06, hp: 250, legato: 0.95, jitter: 5 },
      mando: { voice: V.mandolin, level: -26, pan: -0.5, rev: 0.2, hp: 250, legato: 1.2, jitter: 5 },
      accLead: { voice: V.accordion, level: -20, pan: 0.12, rev: 0.28, hp: 200, legato: 0.96, jitter: 6 },
      acc: { voice: V.accordion, level: -26, pan: 0.35, spread: 0.5, rev: 0.22, hp: 220, legato: 0.85, lp: 5000 },
      bass: { voice: V.softBass, level: -21.5, rev: 0.04, legato: 0.8, lp: 1800 },
      congaL: { voice: perc('congaL'), peak: -14, pan: -0.15, rev: 0.16 },
      congaH: { voice: perc('congaH'), peak: -17, pan: -0.05, rev: 0.16 },
      tamb: { voice: perc('tamb'), peak: -17, pan: 0.35, rev: 0.15, jitter: 3 },
      shaker: { voice: perc('shaker'), peak: -19, pan: -0.4, rev: 0.1, jitter: 3 },
    },
    layers: {
      acc: { kind: 'chord', inst: 'acc', center: 62, strum: 3, pat: ['0:x:1.6:.5 2:x:.8:.7 3:x:1.6:.46 5:x:.8:.66', '0:x:1.6:.5 2:x:.8:.7 3:x:.8:.46 4:x:.8:.5 5:x:.8:.66'] },
      accI: { kind: 'chord', inst: 'acc', center: 62, strum: 3, pat: '0:x:2.6:.55 3:x:2.6:.5' },
      bass: { kind: 'bass', inst: 'bass', lo: 40, pat: ['0:R:2:.85 3:5:2:.68', '0:R:2:.85 3:5:1.8:.68 5:A:1:.6'] },
      bod: { kind: 'perc', pat: [
        '0:congaL:.7 2:congaH:.4 3:congaL:.55 5:congaH:.45',
        '0:congaL:.7 2:congaH:.4 3:congaL:.55 4:congaH:.3 5:congaH:.45',
        '0:congaL:.7 2:congaH:.4 3:congaL:.55 5:congaH:.45',
        '0:congaL:.7 1:congaH:.3 2:congaH:.42 3:congaL:.6 4:congaL:.4 5:congaH:.5'] },
      tamb: { kind: 'perc', pat: ['2:tamb:.5 5:tamb:.55', '2:tamb:.5 4:tamb:.3 5:tamb:.55'] },
      shake: { kind: 'perc', pat: '0:shaker:.5 1:shaker:.24 2:shaker:.3 3:shaker:.46 4:shaker:.24 5:shaker:.3' },
    },
    sections: (() => {
      const CH_A = 'A | A | D | E7 | A | F#m | D E7 | A';
      const CH_B = 'F#m | C#m | D | A | Bm | F#m | G | E7';
      const CH_C = 'A | G | D | A | A | G | D E7 | A';
      const JIG_A = `E5:2 A5:1 A5:1 G#5:1 A5:1 | C#6:1 B5:1 A5:1 E5:2 C#5:1 | D5:1 E5:1 F#5:1 A5:2 F#5:1 | B5:1 G#5:1 E5:1 D5:1 E5:1 G#5:1 |
                     E5:2 A5:1 A5:1 G#5:1 A5:1 | C#6:2! A5:1 F#5:2 A5:1 | D5:1 F#5:1 A5:1 G#5:1 F#5:1 E5:1 | A5:3 A5:2 r:1`;
      const JIG_A2 = `E5:2 A5:1 A5:1 G#5:1 A5:1 | C#6:2 A5:1 B5:1 A5:1 E5:1 | D5:1 E5:1 F#5:1 A5:2 F#5:1 | B5:1 G#5:1 E5:1 D5:1 E5:1 G#5:1 |
                      E5:2 A5:1 A5:1 G#5:1 A5:1 | C#6:2! A5:1 F#5:2 A5:1 | D5:1 F#5:1 A5:1 G#5:1 F#5:1 E5:1 | A5:3 r:3`;
      const JIG_B = `C#6:2 B5:1 A5:2 F#5:1 | G#5:1 A5:1 G#5:1 E5:2 C#5:1 | F#5:2 E5:1 D5:2 F#5:1 | E5:1 A5:1 G#5:1 A5:3 |
                     B5:2 A5:1 F#5:2 D5:1 | C#5:1 F#5:1 A5:1 C#6:3 | D6:2! B5:1 G5:2 B5:1 | B5:2 G#5:1 E5:2 G#5:1`;
      const JIG_C = `A4:2 C#5:1 E5:3 | D5:2 B4:1 G4:3 | F#4:2 A4:1 D5:2 E5:1 | E5:3 C#5:3 | A4:2 C#5:1 E5:2 F#5:1 | G5:3! D5:2 B4:1 | A4:2 D5:1 B4:2 D5:1 | C#5:3 A4:3`;
      const secs: Section[] = [
        { name: 'Intro', bars: 4, layers: 'accI bass*0.8 bod*0.8', dyn: [0.8, 1], chords: 'A | A | D/A | E7' },
        { name: 'A1', bars: 8, layers: 'acc bass bod', chords: CH_A, parts: { fiddle: JIG_A } },
        { name: 'A2', bars: 8, layers: 'acc bass bod tamb', dyn: [1, 1.05], chords: CH_A, parts: { fiddle: JIG_A2 } },
        { name: 'B1', bars: 8, layers: 'acc bass bod shake', chords: CH_B, parts: { fiddle: JIG_B } },
        { name: 'B2', bars: 8, layers: 'acc bass bod shake tamb', dyn: [1, 1.06], chords: CH_B, parts: { fiddle: JIG_B, mando: JIG_B } },
        { name: 'C1', bars: 8, layers: 'accI bass bod*0.8', dyn: [0.9, 1], chords: CH_C, parts: { accLead: JIG_C } },
        { name: 'C2', bars: 8, layers: 'accI bass bod tamb*0.8', dyn: [1, 1.06], chords: CH_C,
          parts: { accLead: JIG_C, fiddle: `E5:6 | D5:6 | F#5:6 | E5:6 | E5:6 | D5:6 | F#5:3 G#5:3 | A5:6` } },
        { name: 'A3', bars: 8, layers: 'acc bass bod tamb', dyn: [1.04, 1.08], chords: CH_A, parts: { fiddle: JIG_A, mando: JIG_A } },
        { name: 'A4', bars: 8, layers: 'acc bass bod tamb shake', dyn: [1.08, 1.12], chords: CH_A, parts: { fiddle: JIG_A2, mando: JIG_A2 } },
        { name: 'B3', bars: 8, layers: 'acc bass bod shake tamb', dyn: [1.08, 1.12], chords: CH_B, parts: { fiddle: JIG_B, mando: JIG_B } },
        { name: 'Turn', bars: 4, layers: 'accI bass*0.85 bod*0.7', dyn: [0.95, 0.72], chords: 'D | A/C# | Bm | E7',
          parts: { fiddle: `F#5:6 | E5:6 | D5:6 | E5:3 r:3` } },
      ];
      return secs;
    })(),
  },
  {
    id: 'mossy', title: 'Mossy Path', key: 'G lydian', seed: 13013, bpm: 76, bpb: 4,
    idea: 'A breathy flute phrase that climbs twice to the raised fourth (C-sharp) and then lets go downward, over slow harp arpeggios and a wide pad; the same three notes return over a new chord halfway through.',
    scale: [7, 9, 11, 1, 2, 4, 6],
    rev: { t60: 3.4, damp: 0.3, gain: 0.62 }, del: { gain: 0.45, fb: 0.32 },
    shelf: 2,
    inst: {
      flute: { voice: V.breathFlute, level: -19.5, pan: -0.06, rev: 0.44, del: 0.18, hp: 250, legato: 1.0, jitter: 10 },
      harp: { voice: V.harp, level: -24, pan: -0.32, spread: 0.35, rev: 0.36, del: 0.1, hp: 140, legato: 1.9, jitter: 9 },
      bell: { voice: V.celesta, level: -28, pan: 0.5, spread: 0.6, rev: 0.6, del: 0.45, hp: 600 },
      cello: { voice: V.cello, level: -26.5, pan: 0.25, rev: 0.4, hp: 100, legato: 1.02, jitter: 12 },
      pad: { voice: V.widePad, level: -25.5, wide: true, rev: 0.45, hp: 160 },
      bass: { voice: V.roundBass, level: -20.5, rev: 0.05, legato: 0.96, lp: 1500 },
      sleigh: { voice: perc('sleigh'), peak: -26, pan: 0.3, rev: 0.4 },
    },
    layers: {
      harp: { kind: 'chord', inst: 'harp', center: 62, pat: ['0:0:1:.7 .5:1:1:.5 1:2:1:.56 1.5:3:1:.6 2:2:1:.54 2.5:3:1:.56 3:1:1:.52 3.5:2:.5:.46', '0:0:1:.7 .5:2:1:.5 1:1:1:.54 1.5:3:1:.6 2:2:1:.54 2.5:1:1:.5 3:3:1:.56 3.5:2:.5:.46'] },
      harpI: { kind: 'chord', inst: 'harp', center: 62, pat: '0:0:2:.62 1:1:2:.5 2:2:2:.55 3:3:1:.56' },
      glint: { kind: 'chord', inst: 'bell', center: 85, voices: 3, pat: ['2.5:1:1:.5', '1.5:2:1:.45 3.5:0:.5:.4', '3:1:1:.5', '0.5:0:1:.45 2:2:1:.45'] },
      bass: { kind: 'bass', inst: 'bass', lo: 40, pat: '0:R:3.8:.72' },
      pad: { kind: 'pad', inst: 'pad', center: 62 },
      dew: { kind: 'perc', pat: ['3:sleigh:.4', '1:sleigh:.3'] },
    },
    sections: [
      { name: 'Intro', bars: 2, layers: 'harpI pad*0.85 bass*0.8 glint*0.8', dyn: [0.8, 0.95], chords: 'Gmaj7 | A/G' },
      { name: 'A', bars: 8, layers: 'harp pad bass',
        chords: 'Gmaj7 | A/G | F#m7 | Bm7 | Em9 | A7sus4 | Dmaj7 | D/F#',
        parts: { flute: `F#5:1.5 G5:.5 B5:2 | A5:1.5 B5:.5 C#6:2! | C#6:1 A5:1 F#5:1.5 E5:.5 | D5:3 r:1 |
                         F#5:1.5 G5:.5 B5:2 | D6:2 B5:1 A5:1 | A5:1.5 F#5:.5 E5:1 D5:1 | F#5:3 r:1` } },
      { name: 'B', bars: 4, layers: 'harpI pad*1.1 bass glint dew', dyn: [0.92, 1.06],
        chords: 'Em9 | F#m7 | Gmaj7 | A',
        parts: {
          flute: `B5:1.5 A5:.5 G5:2 | C#6:1.5 B5:.5 A5:2 | D6:1.5! C#6:.5 B5:1 F#5:1 | E5:1 A5:1 C#6:2`,
          cello: `G3:4 | A3:4 | B3:4 | A3:2 C#4:2`,
        } },
      { name: "A'", bars: 8, layers: 'harp pad bass glint dew', dyn: [1.02, 1.1],
        chords: 'Gmaj7 | A/G | F#m7 | Bm7 | Em9 | A7sus4 | Dmaj7 | D/F#',
        parts: {
          flute: `F#5:1.5 G5:.5 B5:1.5 A5:.5 | A5:1.5 B5:.5 C#6:2! | C#6:1 A5:1 F#5:1 E5:1 | D5:3 r:.5 E5:.5 |
                  F#5:1.5 G5:.5 B5:2 | D6:2 B5:1 A5:1 | A5:1.5 F#5:.5 E5:1 D5:1 | F#5:3 r:1`,
          cello: `B3:4 | A3:4 | A3:4 | F#3:2 A3:2 | G3:4 | G3:4 | F#3:4 | A3:4`,
        } },
      { name: 'Turn', bars: 2, layers: 'harpI pad bass*0.9', dyn: [0.9, 0.75],
        chords: 'Bm7 | A7sus4',
        parts: { flute: `r:2 D5:1 F#5:1 | E5:4` } },
    ],
  },
  {
    id: 'berry', title: 'Berry Picking', key: 'B-flat major', seed: 14014, bpm: 116, bpb: 4,
    idea: 'A xylophone hook of two repeated notes and a wiggle that hops up a step each time, over a bouncing pizzicato bass; a clarinet strolls through the middle while the xylophone tosses three-note answers back.',
    scale: [10, 0, 2, 3, 5, 7, 9],
    rev: { t60: 1.6, damp: 0.38, gain: 0.46 }, del: { gain: 0.35, fb: 0.2 },
    shelf: 3,
    inst: {
      xylo: { voice: V.xylo, level: -17.5, pan: -0.1, spread: 0.15, rev: 0.3, del: 0.1, hp: 250, legato: 1.2, jitter: 5 },
      clarinet: { voice: V.clarinet, level: -21.5, pan: 0.22, rev: 0.32, del: 0.05, hp: 120, legato: 0.96, jitter: 8 },
      clarLow: { voice: V.clarinet, level: -27, pan: 0.22, rev: 0.34, hp: 120, legato: 1.0, jitter: 10 },
      pizz: { voice: V.pizz, level: -24.5, pan: 0.38, spread: 0.15, rev: 0.26, hp: 150, legato: 1.2 },
      bass: { voice: V.upright, level: -22, rev: 0.08, legato: 0.85, lp: 1800 },
      pad: { voice: V.pad, level: -29.5, wide: true, rev: 0.4, hp: 220 },
      kick: { voice: perc('kick'), peak: -16.5, rev: 0.03 },
      wood: { voice: perc('wood'), peak: -15.5, pan: 0.42, rev: 0.22 },
      rim: { voice: perc('rim'), peak: -16.5, pan: -0.25, rev: 0.22 },
      shaker: { voice: perc('shaker'), peak: -15, pan: -0.4, rev: 0.1, jitter: 4 },
      tamb: { voice: perc('tamb'), peak: -19, pan: 0.2, rev: 0.15 },
    },
    layers: {
      pizz: { kind: 'chord', inst: 'pizz', center: 60, strum: 5, pat: ['.5:x:.5:.5 1.5:x:.5:.62 2.5:x:.5:.5 3.5:x:.5:.62', '.5:x:.5:.5 1.5:x:.5:.62 3:x:.5:.55 3.5:x:.5:.6'] },
      bass: { kind: 'bass', inst: 'bass', lo: 39, pat: ['0:R:.8:.85 1:R:.5:.5 2:5:.8:.7 3:A:.8:.62', '0:R:.8:.85 1.5:5:.5:.55 2:R:.8:.7 3:5:.5:.55 3.5:A:.5:.6'] },
      bassT: { kind: 'bass', inst: 'bass', lo: 39, pat: '0:R:1.9:.75 2:5:1.9:.6' },
      pad: { kind: 'pad', inst: 'pad', center: 62 },
      perc: { kind: 'perc', pat: [
        `0:kick:.68 2:kick:.5 1:rim:.5 3:rim:.55 1.5:wood:.3 ${SHAKER8}`,
        `0:kick:.68 2:kick:.5 1:rim:.5 3:rim:.55 2.5:wood:.4 3.5:wood:.3 ${SHAKER8}`,
        `0:kick:.68 2:kick:.5 1:rim:.5 3:rim:.55 1.5:wood:.3 ${SHAKER8}`,
        `0:kick:.68 2:kick:.5 1:rim:.5 2.5:wood:.4 3:wood:.5 3.5:wood:.55 3:tamb:.5 ${SHAKER8}`] },
      percL: { kind: 'perc', pat: [`1:rim:.42 3:rim:.46 ${SHAKER8}`, `1:rim:.42 3:rim:.46 3.5:wood:.3 ${SHAKER8}`] },
    },
    sections: [
      { name: 'Intro', bars: 2, layers: 'pizz bassT percL*0.8 pad', dyn: [0.82, 0.96], chords: 'Bb | Bb' },
      { name: 'A', bars: 8, layers: 'pizz bass perc pad',
        chords: 'Bb | Gm7 | Cm7 | F7 | Bb/D | Eb Edim7 | Bb/F | F7',
        parts: { xylo: `F5:.5 F5:.5 G5:.5 F5:.5 D5:1 Bb4:1 | G5:.5 G5:.5 A5:.5 G5:.5 D5:1 Bb4:1 | Bb5:1 G5:.5 Eb5:.5 F5:.5 G5:.5 Eb5:1 | C5:.5 D5:.5 Eb5:1 F5:2 |
                         F5:.5 F5:.5 G5:.5 F5:.5 D5:1 Bb4:1 | Eb5:.5 G5:.5 Bb5:1 Bb5:.5 G5:.5 E5:1 | F5:1 D6:1! C6:.5 Bb5:.5 F5:1 | A5:1 G5:.5 F5:.5 Eb5:1 C5:1` } },
      { name: "A'", bars: 8, layers: 'pizz bass perc pad', dyn: [1, 1.06],
        chords: 'Bb | Gm7 | Cm7 | F7 | Bb/D | Eb Edim7 | Bb/F F7 | Bb',
        parts: {
          xylo: `F5:.5 F5:.5 G5:.5 F5:.5 D5:1 Bb4:1 | G5:.5 G5:.5 A5:.5 G5:.5 D5:1 Bb4:1 | Bb5:1 G5:.5 Eb5:.5 F5:.5 G5:.5 Eb5:1 | C5:.5 D5:.5 Eb5:.5 F5:.5 A5:1 F5:1 |
                 F5:.5 F5:.5 G5:.5 F5:.5 D5:1 Bb4:1 | Eb5:.5 G5:.5 Bb5:1 Bb5:.5 G5:.5 E5:1 | F5:1 D6:1! C6:.5 A5:.5 F5:.5 A5:.5 | Bb5:2 r:2`,
          clarLow: `D4:4 | D4:4 | Eb4:4 | C4:2 Eb4:2 | D4:4 | Eb4:2 E4:2 | F4:2 Eb4:2 | D4:4`,
        } },
      { name: 'B', bars: 8, layers: 'pizz*0.9 bass percL pad', dyn: [0.92, 1.05],
        chords: 'Eb | F/Eb | Dm7 | G7 | Cm7 | Ab7 | F7sus4 | F7',
        parts: {
          clarinet: `G4:1.5 Ab4:.5 Bb4:2 | A4:1.5 Bb4:.5 C5:2 | D5:1.5 C5:.5 A4:1 F4:1 | B4:2 D5:1 F5:1 |
                     Eb5:1.5 D5:.5 C5:1 G4:1 | C5:1 Eb5:1 Gb5:1.5! Eb5:.5 | F5:2 Eb5:1 C5:1 | C5:1.5 D5:.5 Eb5:1 F5:1`,
          xylo: `r:4 | r:2.5 C6:.5 A5:.5 F5:.5 | r:4 | r:2.5 D6:.5 B5:.5 G5:.5 | r:4 | r:2.5 Eb6:.5 C6:.5 Ab5:.5 | r:4 | r:4`,
        } },
      { name: "A''", bars: 8, layers: 'pizz bass perc pad', dyn: [1.06, 1.12],
        chords: 'Bb | Gm7 | Cm7 | F7 | Bb/D | Eb Edim7 | Bb/F F7 | Bb',
        parts: {
          xylo: `F5:.5 F5:.5 G5:.5 F5:.5 D5:1 Bb4:1 | G5:.5 G5:.5 A5:.5 G5:.5 D5:1 Bb4:1 | Bb5:1 G5:.5 Eb5:.5 F5:.5 G5:.5 Eb5:1 | C5:.5 D5:.5 Eb5:.5 F5:.5 A5:1 F5:1 |
                 F5:.5 F5:.5 G5:.5 F5:.5 D5:1 Bb4:1 | Eb5:.5 G5:.5 Bb5:1 Bb5:.5 G5:.5 E5:1 | F5:1 D6:1! C6:.5 A5:.5 F5:.5 A5:.5 | Bb5:2 r:2`,
          clarinet: `r:3 Bb4:.5 D5:.5 | r:3 D5:.5 G5:.5 | r:4 | r:4 | r:3 D5:.5 F5:.5 | r:4 | r:4 | r:2 D5:.5 F5:.5 Bb5:1`,
          clarLow: `D4:4 | D4:4 | Eb4:4 | C4:2 Eb4:2 | D4:4 | Eb4:2 E4:2 | F4:2 Eb4:2 | D4:4`,
        } },
      { name: 'Turn', bars: 4, layers: 'pizz*0.8 bassT percL*0.7 pad', dyn: [0.92, 0.72],
        chords: 'Eb | Bb/D | Cm7 | F7sus4',
        parts: { xylo: `G5:.5 G5:.5 Bb5:1 G5:2 | F5:.5 F5:.5 Bb5:1 F5:2 | Eb5:.5 Eb5:.5 G5:1 Eb5:2 | F5:3 r:1` } },
    ],
  },
  {
    id: 'blade', title: 'Lantern and Blade', key: 'C minor (C major middle)', seed: 15015, bpm: 124, bpb: 4, swing: 0.64,
    idea: 'A shuffling march: a horn theme that falls a fourth and climbs back by step, with a marching snare; the middle turns the same motif into C major on a fife before an F minor chord pulls it back into the dark.',
    scale: [0, 2, 3, 5, 7, 8, 10],
    rev: { t60: 1.5, damp: 0.4, gain: 0.44 }, del: { gain: 0.3, fb: 0.2 },
    shelf: 3, presence: 1.5,
    inst: {
      horn: { voice: V.brass, level: -19, pan: -0.1, rev: 0.32, del: 0.08, hp: 150, legato: 0.92, jitter: 6 },
      hornLow: { voice: V.brass, level: -24.5, pan: -0.2, rev: 0.34, hp: 120, legato: 1.0, jitter: 8 },
      fife: { voice: V.whistle, level: -19.5, pan: 0.1, rev: 0.34, del: 0.1, hp: 400, legato: 0.92, jitter: 6 },
      viola: { voice: V.viola, level: -26, pan: 0.3, rev: 0.34, hp: 160, legato: 1.02, jitter: 9 },
      stab: { voice: V.stab, level: -21.5, pan: 0.32, spread: 0.2, rev: 0.28, hp: 150, legato: 0.9, jitter: 4 },
      cello: { voice: V.cello, level: -22, pan: 0.05, rev: 0.12, legato: 0.6, lp: 2500, jitter: 5 },
      pad: { voice: V.pad, level: -29, wide: true, rev: 0.36, hp: 160 },
      kick: { voice: perc('kick'), peak: -12.5, rev: 0.03 },
      snare: { voice: perc('snareM'), peak: -10.5, pan: 0.08, rev: 0.2, jitter: 3 },
      tomL: { voice: perc('tomL'), peak: -14, pan: -0.3, rev: 0.2 },
      tamb: { voice: perc('tamb'), peak: -19, pan: 0.4, rev: 0.15 },
    },
    layers: {
      march: { kind: 'bass', inst: 'cello', lo: 36, pat: ['0:R:.9:.85 1:5:.9:.62 2:R:.9:.75 3:5:.9:.62', '0:R:.9:.85 1:5:.9:.62 2:R:.9:.75 3:A:.9:.66'] },
      marchI: { kind: 'bass', inst: 'cello', lo: 36, pat: '0:R:.9:.8 1:R:.9:.5 2:R:.9:.66 3:R:.9:.5' },
      stab: { kind: 'chord', inst: 'stab', center: 60, strum: 2, pat: ['1:x:.4:.66 3:x:.4:.7', '1:x:.4:.66 2.5:x:.3:.5 3:x:.4:.7'] },
      pad: { kind: 'pad', inst: 'pad', center: 58 },
      drum: { kind: 'perc', pat: [
        '0:kick:.8 2:kick:.66 0:snare:.3 1:snare:.7 1.5:snare:.28 2:snare:.3 2.5:snare:.3 3:snare:.72 3.5:snare:.3',
        '0:kick:.8 2:kick:.66 0:snare:.3 1:snare:.7 1.5:snare:.28 2.5:snare:.34 3:snare:.72 3.25:snare:.26 3.5:snare:.4',
        '0:kick:.8 2:kick:.66 0:snare:.3 1:snare:.7 1.5:snare:.28 2:snare:.3 2.5:snare:.3 3:snare:.72 3.5:snare:.3',
        '0:kick:.8 2:kick:.66 1:snare:.7 1.5:snare:.34 2:snare:.4 2.25:snare:.3 2.5:snare:.5 3:snare:.76 3.5:tomL:.6'] },
      drumI: { kind: 'perc', pat: ['0:kick:.72 1:snare:.4 2.5:snare:.26 3:snare:.44', '0:kick:.72 1:snare:.4 2:tomL:.4 3:snare:.44 3.5:snare:.3'] },
      drumB: { kind: 'perc', pat: ['0:kick:.74 2:kick:.56 1:snare:.5 3:snare:.54 1:tamb:.5 3:tamb:.5', '0:kick:.74 2:kick:.56 1:snare:.5 2.5:snare:.26 3:snare:.54 1:tamb:.5 3:tamb:.5 3.5:tamb:.3'] },
    },
    sections: [
      { name: 'Intro', bars: 4, layers: 'marchI drumI stab*0.7 pad', dyn: [0.95, 1.1], chords: 'Cm | Cm | Ab/C | G7' },
      { name: 'A', bars: 8, layers: 'march drum stab pad',
        chords: 'Cm | Ab | Bb | Eb | Fm | Cm/Eb | Dm7b5 | G7',
        parts: { horn: `C5:1.5 G4:.5 C5:1 D5:1 | Eb5:1.5 D5:.5 C5:2 | D5:1.5 Bb4:.5 D5:1 F5:1 | G5:2.5! F5:.5 Eb5:1 |
                        F5:1.5 C5:.5 F5:1 G5:1 | G5:2 Eb5:1 C5:1 | Ab5:1.5! F5:.5 D5:1 F5:1 | G5:1.5 F5:.5 D5:1 B4:1` } },
      { name: "A'", bars: 8, layers: 'march drum stab pad', dyn: [1, 1.06],
        chords: 'Cm | Ab | Bb | Eb | Fm | Db | G7sus4 G7 | Cm',
        parts: {
          horn: `C5:1.5 G4:.5 C5:1 D5:1 | Eb5:1.5 D5:.5 C5:2 | D5:1.5 Bb4:.5 D5:1 F5:1 | G5:2.5! F5:.5 Eb5:1 |
                 F5:1.5 C5:.5 F5:1 G5:1 | Ab5:2! F5:1 Db5:1 | C5:1 D5:1 B4:1 D5:1 | C5:3 r:1`,
          viola: `G4:4 | C4:4 | D4:4 | Eb4:4 | C4:4 | Db4:2 F4:2 | D4:4 | Eb4:4`,
        } },
      { name: 'B', bars: 8, layers: 'march*0.9 drumB stab*0.8 pad*1.15', dyn: [0.95, 1.1],
        chords: 'C | G/B | Am7 | F | C/E | F | Fm6 | G7',
        parts: {
          fife: `E5:1.5 D5:.5 E5:1 G5:1 | G5:1.5 A5:.5 G5:1 D5:1 | C5:1.5 B4:.5 C5:1 E5:1 | F5:1.5 G5:.5 A5:2 |
                 G5:1.5 A5:.5 G5:1 C6:1! | A5:2 G5:.5 F5:.5 A5:1 | Ab5:2 G5:.5 F5:.5 D5:1 | G5:1.5 F5:.5 D5:1 B4:1`,
          hornLow: `E4:4 | D4:4 | E4:4 | C4:2 A3:2 | E4:4 | F4:4 | F4:2 D4:2 | D4:4`,
        } },
      { name: "A''", bars: 8, layers: 'march drum stab pad', dyn: [1.08, 1.14],
        chords: 'Cm | Ab | Bb | Eb | Fm | Db | G7sus4 G7 | Cm',
        parts: {
          horn: `C5:1.5 G4:.5 C5:1 D5:1 | Eb5:1.5 D5:.5 C5:2 | D5:1.5 Bb4:.5 D5:1 F5:1 | G5:2.5! F5:.5 Eb5:1 |
                 F5:1.5 C5:.5 F5:1 G5:1 | Ab5:2! F5:1 Db5:1 | C5:1 D5:1 B4:1 D5:1 | C5:3 r:1`,
          fife: `r:2 Eb5:1 G5:1 | C6:2 r:2 | r:2 F5:1 Ab5:1 | Bb5:2.5 r:1.5 | r:2 Ab5:1 C6:1 | Db6:2 Ab5:2 | G5:2 G5:2 | G5:3 r:1`,
          viola: `G4:4 | C4:4 | D4:4 | Eb4:4 | C4:4 | Db4:2 F4:2 | D4:4 | Eb4:4`,
        } },
      { name: 'Turn', bars: 4, layers: 'marchI drumI*0.8 pad', dyn: [0.95, 0.74],
        chords: 'Cm | Ab | Fm | G7sus4',
        parts: { horn: `C5:3 r:1 | r:4 | r:4 | r:4`, viola: `Eb4:4 | Eb4:4 | C4:4 | D4:4` } },
    ],
  },
  {
    id: 'hero', title: 'Brave Little Hero', key: 'A major', seed: 16016, bpm: 156, bpb: 4,
    idea: 'A square-wave theme that bounces off the fifth to a high third and tumbles back, repeated on D; it ends with a flat-six, flat-seven, tonic climb, and a triangle-wave strain in F-sharp minor gives it a breather.',
    scale: [9, 11, 1, 2, 4, 6, 8],
    rev: { t60: 1.0, damp: 0.42, gain: 0.34 }, del: { gain: 0.35, fb: 0.2 },
    shelf: 1,
    inst: {
      sq: { voice: V.sqLead, level: -20, pan: -0.06, rev: 0.2, del: 0.12, hp: 200, legato: 0.86, jitter: 3, lp: 7000 },
      sq2: { voice: V.sqThin, level: -27, pan: -0.45, rev: 0.2, hp: 200, legato: 0.95, jitter: 3, lp: 6000 },
      tri: { voice: V.tri, level: -19, pan: 0.05, rev: 0.22, del: 0.1, hp: 150, legato: 0.92, jitter: 3 },
      arp: { voice: V.sqThin, level: -28, pan: 0.3, spread: 0.9, rev: 0.16, del: 0.1, hp: 300, legato: 0.8, jitter: 2, lp: 6000 },
      bass: { voice: V.softBass, level: -23, rev: 0.03, legato: 0.75, lp: 2000, jitter: 3 },
      kick: { voice: perc('kick'), peak: -13.5, rev: 0.03 },
      snare: { voice: perc('snareM'), peak: -14, pan: 0.05, rev: 0.18 },
      hat: { voice: perc('hat'), peak: -17, pan: 0.35, rev: 0.08, jitter: 3 },
      tomH: { voice: perc('tomH'), peak: -14.5, pan: 0.3, rev: 0.18 },
      tomL: { voice: perc('tomL'), peak: -14, pan: -0.3, rev: 0.18 },
    },
    layers: {
      arp: { kind: 'chord', inst: 'arp', center: 69, voices: 3, pat: Array.from({ length: 16 }, (_, i) => `${i * 0.25}:${[0, 1, 2, 1][i % 4]}:.25:${i % 4 === 0 ? '.7' : '.5'}`).join(' ') },
      arp8: { kind: 'chord', inst: 'arp', center: 69, voices: 3, pat: '0:0:.5:.65 .5:1:.5:.5 1:2:.5:.55 1.5:1:.5:.5 2:0:.5:.62 2.5:1:.5:.5 3:2:.5:.55 3.5:1:.5:.5' },
      bass: { kind: 'bass', inst: 'bass', lo: 40, splitPat: true, pat: ['0:R:.5:.88 .5:8:.5:.55 1:R:.5:.7 1.5:8:.5:.55 2:R:.5:.82 2.5:8:.5:.55 3:5:.5:.7 3.5:8:.5:.58', '0:R:.5:.88 .5:8:.5:.55 1:R:.5:.7 1.5:8:.5:.55 2:R:.5:.82 2.5:5:.5:.6 3:8:.5:.7 3.5:A:.5:.64'] },
      bassC: { kind: 'bass', inst: 'bass', lo: 40, splitPat: true, pat: '0:R:1.4:.82 1.5:R:.5:.5 2:5:.9:.66 3:8:.9:.6' },
      drums: { kind: 'perc', pat: [
        '0:kick:.84 1:snare:.66 1.5:kick:.5 2:kick:.7 3:snare:.7 0:hat:.5 .5:hat:.28 1:hat:.5 1.5:hat:.28 2:hat:.5 2.5:hat:.3 3:hat:.5 3.5:hat:.34',
        '0:kick:.84 1:snare:.66 2:kick:.7 2.5:kick:.5 3:snare:.7 0:hat:.5 .5:hat:.28 1:hat:.5 1.5:hat:.28 2:hat:.5 2.5:hat:.3 3:hat:.5 3.5:hat:.34',
        '0:kick:.84 1:snare:.66 1.5:kick:.5 2:kick:.7 3:snare:.7 0:hat:.5 .5:hat:.28 1:hat:.5 1.5:hat:.28 2:hat:.5 2.5:hat:.3 3:hat:.5 3.5:hat:.34',
        '0:kick:.84 1:snare:.66 2:kick:.7 2.5:snare:.4 3:tomH:.6 3.5:tomL:.62 0:hat:.5 .5:hat:.28 1:hat:.5 1.5:hat:.28 2:hat:.5'] },
      drumsC: { kind: 'perc', pat: ['0:kick:.74 2.5:kick:.5 3:snare:.5 0:hat:.42 1:hat:.42 2:hat:.42 3:hat:.42', '0:kick:.74 2:kick:.5 3:snare:.5 0:hat:.42 1:hat:.42 2:hat:.42 3:hat:.42 3.5:hat:.3'] },
      drumsI: { kind: 'perc', pat: ['0:kick:.76 2:kick:.6 0:hat:.44 1:hat:.44 2:hat:.44 3:hat:.44', '0:kick:.76 2:kick:.6 1:hat:.44 2:tomH:.5 3:tomL:.54 3.5:snare:.4'] },
    },
    sections: [
      { name: 'Intro', bars: 4, layers: 'arp8 bassC drumsI', dyn: [0.8, 1], chords: 'A | A | D/A | E' },
      { name: 'A', bars: 8, layers: 'arp bass drums',
        chords: 'A | C#m | D | E | F#m | D | Bm7 | E',
        parts: { sq: `E5:1 A5:.5 E5:.5 C#6:1 B5:.5 A5:.5 | G#5:1.5 E5:.5 G#5:1 B5:1 | A5:1 F#5:.5 A5:.5 D6:1 C#6:.5 B5:.5 | B5:2 G#5:1 B5:1 |
                      A5:1 F#5:.5 A5:.5 C#6:1 B5:.5 A5:.5 | D6:1.5! C#6:.5 A5:1 F#5:1 | B5:1 D6:.5 B5:.5 A5:1 F#5:1 | G#5:.5 A5:.5 B5:1 E6:2` } },
      { name: "A'", bars: 8, layers: 'arp bass drums', dyn: [1, 1.06],
        chords: 'A | C#m | D | E | F#m | F G | A | A',
        parts: { sq: `E5:1 A5:.5 E5:.5 C#6:1 B5:.5 A5:.5 | G#5:1.5 E5:.5 G#5:1 B5:1 | A5:1 F#5:.5 A5:.5 D6:1 C#6:.5 B5:.5 | B5:2 G#5:1 B5:1 |
                      A5:1 F#5:.5 A5:.5 C#6:1 B5:.5 A5:.5 | C6:1 A5:1 D6:1 B5:1 | C#6:1 E6:1! C#6:1 A5:1 | A5:3 r:1` } },
      { name: 'B', bars: 8, layers: 'arp8 bass drums', dyn: [0.95, 1.08],
        chords: 'D | E/D | C#m7 | F#m | Bm7 | C#7 | F#m | E',
        parts: { sq: `A5:1.5 G#5:.5 F#5:1 A5:1 | B5:1.5 A5:.5 G#5:1 B5:1 | C#6:1.5 B5:.5 G#5:1 E5:1 | A5:3 r:1 |
                      D6:1.5 C#6:.5 B5:1 A5:1 | B5:1.5 G#5:.5 F5:1 G#5:1 | F#5:1 A5:1 C#6:2! | B5:2 G#5:.5 A5:.5 B5:1` } },
      { name: 'C', bars: 8, layers: 'arp8*0.8 bassC drumsC', dyn: [0.86, 1.02],
        chords: 'F#m | D | E | C#7 | F#m | D | Bm7 | E7sus4 E7',
        parts: { tri: `F#4:1 A4:1 C#5:1.5 B4:.5 | A4:2 F#4:1 A4:1 | G#4:1 B4:1 E5:1.5 D5:.5 | C#5:2 B4:1 G#4:1 |
                       A4:1 C#5:1 F#5:1.5 E5:.5 | D5:2 A4:1 D5:1 | F#5:1.5 E5:.5 D5:1 B4:1 | E5:1 A5:1 G#5:1 B5:1` } },
      { name: "A''", bars: 8, layers: 'arp bass drums', dyn: [1.08, 1.14],
        chords: 'A | C#m | D | E | F#m | F G | A | A',
        parts: {
          sq: `E5:1 A5:.5 E5:.5 C#6:1 B5:.5 A5:.5 | G#5:1.5 E5:.5 G#5:1 B5:1 | A5:1 F#5:.5 A5:.5 D6:1 C#6:.5 B5:.5 | B5:2 G#5:1 B5:1 |
               A5:1 F#5:.5 A5:.5 C#6:1 B5:.5 A5:.5 | C6:1 A5:1 D6:1 B5:1 | C#6:1 E6:1! C#6:1 A5:1 | A5:3 r:1`,
          sq2: `C#5:4 | E5:4 | F#5:4 | G#5:4 | A5:4 | A5:2 B5:2 | E5:4 | E5:3 r:1`,
        } },
      { name: 'Turn', bars: 4, layers: 'arp8*0.8 bassC drumsC*0.85', dyn: [0.95, 0.76],
        chords: 'D | E | F#m | E7sus4',
        parts: { sq: `F#5:2 A5:2 | G#5:2 B5:2 | A5:4 | r:4`, sq2: `A4:4 | B4:4 | C#5:4 | D5:2 E5:2` } },
    ],
  },
  {
    id: 'tide', title: 'Rippling Tide', key: 'D major', seed: 17017, bpm: 92, bpb: 4,
    idea: 'A vibraphone phrase that enters off the beat, rises through the chord and leans on the sixth, stepping up with the harmony over a swaying nylon-guitar pattern; the guitar answers with its own falling sequence.',
    scale: [2, 4, 6, 7, 9, 11, 1],
    rev: { t60: 2.0, damp: 0.38, gain: 0.5 }, del: { gain: 0.4, fb: 0.26 },
    shelf: 3, water: -39,
    inst: {
      vibes: { voice: V.dryVibes, level: -19.5, pan: 0.08, spread: 0.15, rev: 0.38, del: 0.16, hp: 180, legato: 1.4, jitter: 8, lay: 6 },
      gtrLead: { voice: V.nylon, level: -20, pan: -0.1, rev: 0.32, del: 0.14, hp: 140, legato: 1.3, jitter: 8, lay: 6 },
      gtr: { voice: V.nylon, level: -23.5, pan: -0.32, spread: 0.1, rev: 0.24, hp: 120, legato: 0.95, jitter: 6 },
      bass: { voice: V.upright, level: -23.5, rev: 0.06, legato: 0.9, lp: 1600 },
      pad: { voice: V.pad, level: -30, wide: true, rev: 0.4, hp: 200 },
      rim: { voice: perc('rim'), peak: -17, pan: 0.3, rev: 0.25 },
      shaker: { voice: perc('shaker'), peak: -15, pan: -0.4, rev: 0.1, jitter: 4 },
      kick: { voice: perc('lokick'), peak: -17, rev: 0.03 },
      tri: { voice: V.bell, level: -31, pan: 0.5, rev: 0.6, hp: 1500, oct: 2 },
    },
    layers: {
      gtr: { kind: 'chord', inst: 'gtr', center: 59, strum: 10, pat: ['0:x:.9:.66 1.5:x:.9:.6 3:x:.45:.5 3.5:x:.9:.62', '1:x:.9:.6 2.5:x:.9:.62'] },
      bass: { kind: 'bass', inst: 'bass', lo: 38, pat: ['0:R:1.4:.82 1.5:5:.5:.5 2:5:1.4:.68 3.5:R:.5:.5', '0:R:1.4:.82 1.5:5:.5:.5 2:5:1.4:.68 3.5:A:.5:.55'] },
      bassT: { kind: 'bass', inst: 'bass', lo: 38, pat: '0:R:1.9:.72 2:5:1.8:.55' },
      pad: { kind: 'pad', inst: 'pad', center: 62 },
      clave: { kind: 'perc', pat: ['0:rim:.5 1.5:rim:.45 3:rim:.5 0:kick:.6 2:kick:.45', '1:rim:.45 2.5:rim:.5 0:kick:.6 2:kick:.45'] },
      shake: { kind: 'perc', pat: ['0:shaker:.46 .5:shaker:.22 1:shaker:.3 1.5:shaker:.46 2:shaker:.3 2.5:shaker:.22 3:shaker:.46 3.5:shaker:.28', '0:shaker:.3 .5:shaker:.22 1:shaker:.46 1.5:shaker:.24 2:shaker:.3 2.5:shaker:.46 3:shaker:.3 3.5:shaker:.28'] },
    },
    sections: [
      { name: 'Intro', bars: 2, layers: 'gtr bassT shake*0.8 pad', dyn: [0.82, 0.96], chords: 'Dmaj9 | A9sus4' },
      { name: 'A', bars: 8, layers: 'gtr bass clave shake pad',
        chords: 'Dmaj9 | D#dim7 | Em9 | A9 | F#m7 | Fdim7 | Em9 | A9sus4',
        parts: { vibes: `r:.5 F#5:.5 A5:1 C#6:1.5 B5:.5 | A5:2 F#5:1 r:1 | r:.5 G5:.5 B5:1 D6:1.5 C#6:.5 | B5:2 G5:1 r:1 |
                         r:.5 A5:.5 C#6:1 E6:1! C#6:1 | D6:1.5 B5:.5 G#5:2 | G5:1 F#5:.5 E5:.5 G5:1 B5:1 | A5:3 r:1` } },
      { name: "A'", bars: 8, layers: 'gtr bass clave shake pad', dyn: [1, 1.06],
        chords: 'Dmaj9 | D#dim7 | Em9 | A9 | F#m7 | B7b9 | Em9 A9 | D6',
        parts: {
          vibes: `r:.5 F#5:.5 A5:1 C#6:1.5 B5:.5 | A5:1.5 F#5:.5 A5:1 r:1 | r:.5 G5:.5 B5:1 D6:1.5 C#6:.5 | B5:2 G5:1 r:1 |
                  r:.5 A5:.5 C#6:1 E6:1! C#6:1 | D#6:1.5 C6:.5 A5:2 | G5:1 B5:1 A5:.5 G5:.5 E5:1 | F#5:3 r:1`,
          gtrLead: `r:4 | r:3 A4:.5 C5:.5 | r:4 | r:3 E5:.5 C#5:.5 | r:4 | r:4 | r:4 | r:1 A4:.5 B4:.5 D5:1 F#5:1`,
        } },
      { name: 'B', bars: 8, layers: 'gtr*0.85 bass clave*0.8 shake pad*1.2', dyn: [0.94, 1.06],
        chords: 'Gmaj7 | C9 | F#m7 | B7b9 | Em9 | Gm6 | D/F# | A9sus4',
        parts: {
          gtrLead: `B4:1 C#5:.5 D5:.5 F#5:2 | E5:1.5 D5:.5 Bb4:2 | A4:1 B4:.5 C#5:.5 E5:2 | D#5:1.5 C5:.5 A4:2 |
                    B4:1 D5:.5 E5:.5 F#5:2 | G5:1.5! E5:.5 D5:1 Bb4:1 | A4:1 D5:1 F#5:1.5 E5:.5 | E5:3 r:1`,
          vibes: `r:4 | r:2.5 G5:.5 Bb5:1 | r:4 | r:2.5 F#5:.5 A5:1 | r:4 | r:4 | r:4 | r:2 B5:1 A5:1`,
        } },
      { name: 'Turn', bars: 4, layers: 'gtr*0.85 bassT shake*0.7 pad', dyn: [0.92, 0.74],
        chords: 'Dmaj9 | Bm7 | Em9 | A9sus4',
        parts: { vibes: `r:.5 F#5:.5 A5:1 C#6:2 | B5:2 A5:1 F#5:1 | G5:3 r:1 | r:4` } },
    ],
  },
  {
    id: 'catch', title: 'Morning Catch', key: 'G major', seed: 18018, bpm: 100, bpb: 4,
    idea: 'A hummable melodica tune built on a little turn around D that is answered a fourth higher, with a raised-fourth chord (C-sharp half-diminished) for a moment of sunshine; the middle walks down the scale in three matching steps.',
    scale: [7, 9, 11, 0, 2, 4, 6],
    rev: { t60: 1.8, damp: 0.38, gain: 0.48 }, del: { gain: 0.35, fb: 0.2 },
    shelf: 2,
    inst: {
      melodica: { voice: V.melodica, level: -19, pan: -0.06, rev: 0.3, del: 0.08, hp: 200, legato: 0.95, jitter: 7 },
      viola: { voice: V.viola, level: -27.5, pan: 0.3, rev: 0.34, hp: 160, legato: 1.02, jitter: 10 },
      uke: { voice: V.uke, level: -23.5, pan: -0.36, rev: 0.24, hp: 180, legato: 1.3 },
      pad: { voice: V.pad, level: -28.5, wide: true, rev: 0.4, hp: 200 },
      kal: { voice: V.kalimba, level: -27, pan: 0.42, spread: 0.3, rev: 0.3, del: 0.2, hp: 300, legato: 1.5 },
      bass: { voice: V.upright, level: -21.5, rev: 0.06, legato: 0.88, lp: 1700 },
      shaker: { voice: perc('shaker'), peak: -16, pan: 0.35, rev: 0.1, jitter: 4 },
      congaL: { voice: perc('congaL'), peak: -17, pan: -0.1, rev: 0.18 },
      congaH: { voice: perc('congaH'), peak: -19, pan: 0.1, rev: 0.18 },
    },
    layers: {
      uke: { kind: 'chord', inst: 'uke', center: 62, strum: 12, pat: ['0:x:.9:.72 1:dx:.4:.36 1.5:x:.9:.6 2.5:dx:.4:.4 3:x:.5:.62 3.5:dx:.4:.42', '0:x:.9:.72 1.5:x:.9:.6 2.5:dx:.4:.4 3:x:.9:.62'] },
      kal: { kind: 'chord', inst: 'kal', center: 74, voices: 3, pat: ['1:2:1:.5 2.5:1:1:.5', '0.5:0:1:.45 3:2:1:.5'] },
      bass: { kind: 'bass', inst: 'bass', lo: 40, pat: ['0:R:1.4:.82 2:5:1.2:.66 3.5:A:.5:.55', '0:R:1.4:.82 1.5:R:.5:.45 2:5:1.4:.66'] },
      bassT: { kind: 'bass', inst: 'bass', lo: 40, pat: '0:R:1.9:.7 2:5:1.9:.55' },
      pad: { kind: 'pad', inst: 'pad', center: 62 },
      shake: { kind: 'perc', pat: ['0:shaker:.3 .5:shaker:.2 1:shaker:.5 1.5:shaker:.22 2:shaker:.3 2.5:shaker:.2 3:shaker:.5 3.5:shaker:.26', '0:shaker:.3 .5:shaker:.2 1:shaker:.5 1.5:shaker:.3 2:shaker:.3 2.5:shaker:.2 3:shaker:.5 3.5:shaker:.36'] },
      hand: { kind: 'perc', pat: ['0:congaL:.5 2.5:congaH:.4', '0:congaL:.5 1.5:congaH:.3 2.5:congaH:.4 3.5:congaL:.3'] },
    },
    sections: [
      { name: 'Intro', bars: 2, layers: 'uke*0.9 bassT shake*0.8 pad', dyn: [0.95, 1.05], chords: 'G | C/G' },
      { name: 'A', bars: 8, layers: 'uke bass shake hand pad',
        chords: 'G | Em7 | C | D7 | G/B | C | C#m7b5 | D7',
        parts: { melodica: `D5:1.5 E5:.5 D5:1 B4:1 | G5:2 E5:1 D5:1 | E5:1.5 F#5:.5 G5:1 E5:1 | D5:3 r:.5 D5:.5 |
                            G5:1.5 A5:.5 G5:1 D5:1 | C6:1.5! B5:.5 G5:1 E5:1 | E5:1 G5:1 B5:2 | A5:2 F#5:1 D5:1` } },
      { name: "A'", bars: 8, layers: 'uke bass shake hand kal pad', dyn: [1, 1.06],
        chords: 'G | Em7 | C | D7 | G/B | C | Am7 D7 | G',
        parts: {
          melodica: `D5:1.5 E5:.5 D5:1 B4:1 | G5:2 E5:1 D5:1 | E5:1.5 F#5:.5 G5:1 E5:1 | D5:3 r:.5 D5:.5 |
                     G5:1.5 A5:.5 G5:1 D5:1 | C6:1.5! B5:.5 G5:1 E5:1 | E5:1 G5:1 F#5:1 A5:1 | G5:3 r:1`,
          viola: `B3:4 | B3:2 D4:2 | E4:4 | D4:2 C4:2 | D4:4 | E4:4 | E4:2 F#4:2 | D4:4`,
        } },
      { name: 'B', bars: 8, layers: 'uke*0.9 bass shake hand*0.8 kal pad', dyn: [0.94, 1.06],
        chords: 'C | Bm7 | Am7 | G | C | B7 | Em A7 | D7',
        parts: {
          melodica: `G5:1.5 F#5:.5 E5:1 C5:1 | F#5:1.5 E5:.5 D5:1 B4:1 | E5:1.5 D5:.5 C5:1 A4:1 | B4:1 D5:1 G5:2 |
                     E5:1 G5:1 C6:1.5! B5:.5 | A5:1.5 F#5:.5 D#5:2 | E5:1 G5:1 A5:1 G5:1 | F#5:1.5 E5:.5 D5:2`,
          viola: `E4:4 | D4:4 | C4:4 | B3:4 | E4:4 | D#4:4 | E4:2 E4:2 | D4:2 C4:2`,
        } },
      { name: "A''", bars: 4, layers: 'uke bass shake hand kal pad', dyn: [1.05, 1.08],
        chords: 'G | Em7 | C | D7',
        parts: { melodica: `D5:1.5 E5:.5 D5:1 B4:1 | G5:2 E5:1 D5:1 | E5:1.5 F#5:.5 G5:1 E5:1 | D5:2 F#5:1 A5:1` } },
      { name: 'Turn', bars: 2, layers: 'uke*0.8 bassT shake*0.7 pad', dyn: [0.92, 0.74],
        chords: 'G | D7sus4',
        parts: { melodica: `G5:2 r:2 | r:4`, viola: `B3:4 | C4:3 r:1` } },
    ],
  },
  {
    id: 'echoes', title: 'Deep Echoes', key: 'F-sharp minor', seed: 19019, bpm: 64, bpb: 4,
    idea: 'A lonely bell that waits a beat, reaches up and hangs, each time on a different degree while the chords change above a held low F-sharp; the drone itself sinks to D and C-sharp in the middle.',
    scale: [6, 8, 9, 11, 1, 2, 4],
    rev: { t60: 5.0, damp: 0.26, gain: 0.75 }, del: { gain: 0.7, fb: 0.45 },
    shelf: 5, presence: 3,
    inst: {
      bell: { voice: V.bell, level: -19.5, pan: -0.05, rev: 0.5, del: 0.4, hp: 250, legato: 1.5, jitter: 9 },
      glass: { voice: V.crystal, level: -26, pan: 0.5, spread: 0.7, rev: 0.6, del: 0.6, hp: 600 },
      drone: { voice: V.cello, level: -22.5, pan: 0.0, rev: 0.3, legato: 1.04, lp: 1800, jitter: 12 },
      drone5: { voice: V.cello, level: -27, pan: 0.2, rev: 0.36, legato: 1.04, lp: 2200, jitter: 12 },
      pad: { voice: V.widePad, level: -27, wide: true, rev: 0.5, hp: 150 },
      boom: { voice: perc('tomL'), peak: -16, pan: -0.1, rev: 0.5, del: 0.5 },
      pick: { voice: perc('pickH'), peak: -17, pan: 0.45, rev: 0.6, del: 0.7 },
    },
    layers: {
      drone: { kind: 'bass', inst: 'drone', lo: 37, pat: '0:R:4:.7' },
      drone5: { kind: 'bass', inst: 'drone5', lo: 37, pat: '0:5:4:.6' },
      glass: { kind: 'chord', inst: 'glass', center: 81, voices: 3, pat: ['3:1:1:.45', '1.5:2:1:.4', '2.5:0:1:.45', '0.5:1:1:.4 3.5:2:.5:.36'] },
      pad: { kind: 'pad', inst: 'pad', center: 61 },
      cave: { kind: 'perc', pat: ['0:boom:.55', '2.5:pick:.5', '0:boom:.45 3:pick:.4', '1.5:pick:.45'] },
    },
    sections: [
      { name: 'Intro', bars: 2, layers: 'drone pad*0.85 cave*0.8', dyn: [0.8, 0.95], chords: 'F#madd9 | F#madd9' },
      { name: 'A', bars: 6, layers: 'drone drone5*0.8 pad cave glass*0.7',
        chords: 'F#madd9 | D/F# | E/F# | F#m7 | Bm/F# | C#7sus4',
        parts: { bell: `r:1 C#5:1 F#5:2 | r:1 A5:2 F#5:1 | r:1 G#5:2 B5:1 | A5:3 r:1 | r:1 B5:1.5 A5:.5 F#5:1 | G#5:3 r:1` } },
      { name: 'B', bars: 4, layers: 'drone drone5 pad*1.1 glass', dyn: [0.94, 1.08],
        chords: 'Dmaj7 | E/D | C#m7 | Dmaj7',
        parts: { bell: `C#6:2! A5:1 F#5:1 | B5:2 G#5:1 E5:1 | E5:1 G#5:1 B5:2 | A5:3 r:1` } },
      { name: "A'", bars: 6, layers: 'drone drone5 pad cave glass', dyn: [1.02, 1.08],
        chords: 'F#madd9 | D/F# | E/F# | F#m7 | Bm/F# | E/F#',
        parts: { bell: `r:1 C#5:1 F#5:1.5 G#5:.5 | r:1 A5:2 F#5:1 | r:1 G#5:2 B5:1 | C#6:3! r:1 | r:1 B5:1.5 A5:.5 F#5:1 | E5:3 r:1` } },
      { name: 'Turn', bars: 2, layers: 'drone pad cave*0.7', dyn: [0.92, 0.76],
        chords: 'Dmaj7 | C#7sus4',
        parts: { bell: `r:1 F#5:1 A5:2 | G#5:3 r:1` } },
    ],
  },
  {
    id: 'glowstone', title: 'Glowstone Shaft', key: 'D dorian', seed: 20020, bpm: 106, bpb: 4,
    idea: 'A pentatonic marimba riff that pushes on to the off-beat A and falls back, answered with the dorian B natural, over a syncopated bass and pick-axe clinks; vibraphone takes a slower line in the middle before an A7 points back to D.',
    scale: [2, 4, 5, 7, 9, 11, 0],
    rev: { t60: 1.6, damp: 0.36, gain: 0.46 }, del: { gain: 0.5, fb: 0.3 },
    shelf: 3, presence: 2,
    inst: {
      marimba: { voice: V.marimba, level: -18.5, pan: -0.1, spread: 0.15, rev: 0.26, del: 0.12, hp: 160, legato: 1.3, jitter: 4 },
      xy: { voice: V.xylo, level: -25.5, pan: 0.35, rev: 0.3, del: 0.2, hp: 300, legato: 1.2, jitter: 4 },
      vibes: { voice: V.dryVibes, level: -20, pan: 0.15, rev: 0.4, del: 0.2, hp: 180, legato: 1.3, jitter: 7 },
      ep: { voice: V.ep, level: -22.5, pan: 0.3, spread: 0.2, rev: 0.25, del: 0.1, hp: 180, legato: 0.9, lp: 6500 },
      bass: { voice: V.synthBass, level: -19.5, rev: 0.03, legato: 0.85, lp: 1800, jitter: 3 },
      pad: { voice: V.pad, level: -29.5, wide: true, rev: 0.4, hp: 180 },
      kick: { voice: perc('kick'), peak: -13, rev: 0.03 },
      rim: { voice: perc('rim'), peak: -13, pan: -0.2, rev: 0.24 },
      hat: { voice: perc('hat'), peak: -13.5, pan: 0.35, rev: 0.08, jitter: 3 },
      pickH: { voice: perc('pickH'), peak: -13.5, pan: 0.5, rev: 0.4, del: 0.5 },
      pickL: { voice: perc('pickL'), peak: -14.5, pan: -0.5, rev: 0.4, del: 0.4 },
    },
    layers: {
      bass: { kind: 'bass', inst: 'bass', lo: 38, pat: ['0:R:.9:.86 1.5:R:.4:.6 2.5:8:.4:.6 3.5:5:.4:.6', '0:R:.9:.86 1.5:5:.4:.55 2:8:.4:.6 3:R:.4:.56 3.5:A:.5:.62'] },
      bassI: { kind: 'bass', inst: 'bass', lo: 38, pat: '0:R:.9:.8 1.5:R:.4:.55 2.5:R:.4:.5' },
      ep: { kind: 'chord', inst: 'ep', center: 62, strum: 4, pat: ['1.5:x:.4:.6 3:x:.4:.55', '.5:x:.4:.5 1.5:x:.4:.6 3.5:x:.4:.55'] },
      pad: { kind: 'pad', inst: 'pad', center: 60 },
      groove: { kind: 'perc', pat: [
        '0:kick:.82 2.5:kick:.6 1:rim:.56 3:rim:.6 0:hat:.46 .5:hat:.26 1:hat:.4 1.5:hat:.3 2:hat:.46 2.5:hat:.26 3:hat:.4 3.5:hat:.32 1.75:hat:.2',
        '0:kick:.82 1.5:kick:.5 2.5:kick:.6 1:rim:.56 3:rim:.6 0:hat:.46 .5:hat:.26 1:hat:.4 1.5:hat:.3 2:hat:.46 2.5:hat:.26 3:hat:.4 3.5:hat:.32 3.25:hat:.2',
        '0:kick:.82 2.5:kick:.6 1:rim:.56 3:rim:.6 0:hat:.46 .5:hat:.26 1:hat:.4 1.5:hat:.3 2:hat:.46 2.5:hat:.26 3:hat:.4 3.5:hat:.32 1.75:hat:.2',
        '0:kick:.82 1.5:kick:.5 2.5:kick:.6 1:rim:.56 3:rim:.6 3.5:rim:.4 0:hat:.46 .5:hat:.26 1:hat:.4 1.5:hat:.3 2:hat:.46 2.5:hat:.26 3:hat:.4'] },
      grooveL: { kind: 'perc', pat: ['0:kick:.74 2.5:kick:.5 3:rim:.5 0:hat:.42 1:hat:.36 2:hat:.42 3:hat:.36', '0:kick:.74 2.5:kick:.5 1:rim:.4 3:rim:.5 0:hat:.42 1:hat:.36 2:hat:.42 3:hat:.36 3.5:hat:.28'] },
      picks: { kind: 'perc', pat: ['1.5:pickH:.5', '2.5:pickL:.45 3.5:pickH:.36', '1.5:pickH:.5 3:pickL:.36', '0.5:pickL:.4 2.5:pickH:.5'] },
    },
    sections: [
      { name: 'Intro', bars: 2, layers: 'bassI grooveL picks pad*0.8', dyn: [0.82, 0.98], chords: 'Dm7 | Dm7' },
      { name: 'A', bars: 8, layers: 'bass groove picks ep*0.8 pad',
        chords: 'Dm7 | G9 | Dm7 | G9 | Fmaj7 | Em7 | Dm7 | Am7',
        parts: { marimba: `D5:.5 F5:.5 G5:.5 A5:1 G5:.5 F5:.5 D5:.5 | D5:.5 F5:.5 G5:.5 A5:1 B5:.5 A5:.5 G5:.5 | A5:.5 C6:.5 D6:1! C6:.5 A5:.5 G5:.5 F5:.5 | D5:.5 G5:1 A5:.5 B5:1 r:1 |
                            A5:.5 C6:1 A5:.5 G5:.5 F5:.5 A5:1 | G5:.5 B5:1 G5:.5 E5:.5 D5:.5 G5:1 | F5:.5 A5:1 F5:.5 D5:.5 C5:.5 F5:1 | E5:1 G5:.5 A5:.5 C6:2` } },
      { name: "A'", bars: 8, layers: 'bass groove picks ep pad', dyn: [1, 1.06],
        chords: 'Dm7 | G9 | Dm7 | G9 | Fmaj7 | Em7 | Bbmaj7 | A7sus4',
        parts: { marimba: `D5:.5 F5:.5 G5:.5 A5:1 G5:.5 F5:.5 D5:.5 | D5:.5 F5:.5 G5:.5 A5:1 B5:.5 A5:.5 G5:.5 | A5:.5 C6:.5 D6:1! C6:.5 A5:.5 G5:.5 F5:.5 | D5:.5 G5:1 A5:.5 B5:1 r:1 |
                            A5:.5 C6:1 A5:.5 G5:.5 F5:.5 A5:1 | G5:.5 B5:1 G5:.5 E5:.5 D5:.5 G5:1 | D5:.5 F5:1 A5:.5 Bb5:1 A5:1 | G5:1 E5:.5 D5:.5 A5:2` } },
      { name: 'B', bars: 8, layers: 'bass*0.9 grooveL picks*0.8 ep pad*1.2', dyn: [0.94, 1.06],
        chords: 'Fmaj7 | G | Am7 | C/E | Fmaj7 | G | Bbmaj7 | A7',
        parts: {
          vibes: `A5:2 G5:.5 F5:.5 E5:1 | D5:2 r:1 B4:.5 D5:.5 | E5:2 D5:.5 C5:.5 A4:1 | C5:2 r:1 E5:.5 G5:.5 |
                  A5:2 G5:.5 F5:.5 E5:1 | D5:1 G5:1 B5:2! | A5:1.5 F5:.5 D5:2 | E5:1.5 C#5:.5 E5:1 A5:1`,
          marimba: `r:4 | r:2 G5:.5 B5:1 G5:.5 | r:4 | r:2 G5:.5 C6:1 G5:.5 | r:4 | r:4 | r:4 | r:4`,
        } },
      { name: "A''", bars: 6, layers: 'bass groove picks ep pad', dyn: [1.06, 1.1],
        chords: 'Dm7 | G9 | Dm7 | G9 | Fmaj7 | Em7',
        parts: {
          marimba: `D5:.5 F5:.5 G5:.5 A5:1 G5:.5 F5:.5 D5:.5 | D5:.5 F5:.5 G5:.5 A5:1 B5:.5 A5:.5 G5:.5 | A5:.5 C6:.5 D6:1! C6:.5 A5:.5 G5:.5 F5:.5 | D5:.5 G5:1 A5:.5 B5:1 r:1 |
                    A5:.5 C6:1 A5:.5 G5:.5 F5:.5 A5:1 | G5:.5 B5:1 G5:.5 E5:.5 D5:.5 G5:1`,
          xy: `D5:.5 F5:.5 G5:.5 A5:1 G5:.5 F5:.5 D5:.5 | D5:.5 F5:.5 G5:.5 A5:1 B5:.5 A5:.5 G5:.5 | A5:.5 C6:.5 D6:1! C6:.5 A5:.5 G5:.5 F5:.5 | D5:.5 G5:1 A5:.5 B5:1 r:1 |
                    A5:.5 C6:1 A5:.5 G5:.5 F5:.5 A5:1 | G5:.5 B5:1 G5:.5 E5:.5 D5:.5 G5:1`,
          vibes: `r:3 A5:1 | r:4 | r:3 D6:1 | r:2 D6:1 B5:1 | r:4 | r:2 B5:1 G5:1`,
        } },
      { name: 'Turn', bars: 2, layers: 'bassI grooveL*0.85 picks*0.7 pad', dyn: [0.92, 0.76],
        chords: 'Bbmaj7 | A7sus4',
        parts: { marimba: `D5:.5 F5:1 A5:.5 Bb5:1 A5:1 | G5:1 E5:.5 D5:.5 A5:1 r:1` } },
    ],
  },
];

// ───────────────────────────── sound effects ─────────────────────────────

const SFX_SR = 22050;
function sfx(dur: number, peak: number, fn: (t: number, rng: Rng) => number, seed: number): Float32Array {
  const n = Math.floor(dur * SFX_SR);
  const out = new Float32Array(n);
  const rng = mulberry32(seed);
  let pk = 0, mean = 0;
  for (let i = 0; i < n; i++) { out[i] = fn(i / SFX_SR, rng); mean += out[i]; }
  mean /= n;
  const fi = Math.floor(0.002 * SFX_SR), fo = Math.floor(0.012 * SFX_SR);
  for (let i = 0; i < n; i++) {
    out[i] -= mean;
    if (i < fi) out[i] *= i / fi;
    if (i >= n - fo) out[i] *= 0.5 - 0.5 * Math.cos((Math.PI * (n - 1 - i)) / fo);
    pk = Math.max(pk, Math.abs(out[i]));
  }
  for (let i = 0; i < n; i++) out[i] *= peak / (pk || 1);
  return out;
}
/** Mallet-like note for the effects: fundamental + quick 4th-harmonic ping. */
const ping = (t: number, t0: number, f: number, tau: number) => {
  const x = t - t0;
  if (x < 0) return 0;
  return (Math.sin(TAU * f * x) * Math.exp(-x / tau) + 0.22 * Math.sin(TAU * f * 3.93 * x) * Math.exp(-x / (tau * 0.3))) * Math.min(1, x / 0.002);
};
function buildSfx(): Record<string, Float32Array> {
  const mkBp = (f: number) => new Biquad('bp', f, 1.0, 0, SFX_SR);
  let phase = 0;
  const sweep = (f: number) => { phase += (TAU * f) / SFX_SR; return Math.sin(phase); };
  const out: Record<string, Float32Array> = {};
  // place: soft water-drop "plop" — pitch rises quickly while the level falls
  phase = 0;
  out.place = sfx(0.15, 0.62, (t) =>
    sweep(260 + 430 * (1 - Math.exp(-t / 0.028))) * Math.exp(-t / 0.04) * Math.min(1, t / 0.003) + 0.35 * Math.sin(TAU * 140 * t) * Math.exp(-t / 0.018), 11);
  // erase: a falling pluck with a soft brush of noise
  phase = 0;
  const eb = mkBp(2400);
  out.erase = sfx(0.19, 0.5, (t, r) =>
    sweep(540 * Math.exp(-t / 0.16)) * Math.exp(-t / 0.055) * Math.min(1, t / 0.003) + eb.tick(r() * 2 - 1) * 0.9 * Math.min(1, t / 0.02) * Math.exp(-Math.max(0, t - 0.02) / 0.05), 12);
  // tap: tiny tick
  out.tap = sfx(0.06, 0.4, (t) => Math.sin(TAU * 1500 * t) * Math.exp(-t / 0.008) + 0.3 * Math.sin(TAU * 3100 * t) * Math.exp(-t / 0.004), 13);
  // select: gentle two notes up (a perfect fifth)
  out.select = sfx(0.26, 0.55, (t) => ping(t, 0, 659.26, 0.06) + ping(t, 0.085, 987.77, 0.07), 14);
  // undo: reverse blip — the level swells while the pitch slides down, then stops softly
  phase = 0;
  out.undo = sfx(0.18, 0.5, (t) => {
    const x = t / 0.18;
    return (sweep(900 - 330 * x) + 0.2 * Math.sin(2 * phase)) * Math.pow(x, 2.2) * (x > 0.9 ? (1 - x) / 0.1 : 1);
  }, 15);
  // error: soft low "nope" — two round notes stepping down a major third
  out.error = sfx(0.32, 0.5, (t) => {
    const note = (t0: number, f: number, len: number) => {
      const x = t - t0;
      if (x < 0 || x > len + 0.06) return 0;
      const e = Math.min(1, x / 0.012) * (x > len ? Math.max(0, 1 - (x - len) / 0.06) : 1) * Math.exp(-x / 0.25);
      return (Math.sin(TAU * f * x) + 0.3 * Math.sin(TAU * 2 * f * x) + 0.12 * Math.sin(TAU * 3 * f * x)) * e;
    };
    return note(0, 293.66, 0.1) + note(0.13, 233.08, 0.12);
  }, 16);
  // build: three-note rising fanfare-let (G-C-E) with a sparkle on the last note
  out.build = sfx(0.4, 0.6, (t) =>
    ping(t, 0, 783.99, 0.07) + ping(t, 0.09, 1046.5, 0.07) + ping(t, 0.18, 1318.5, 0.09) + 0.35 * ping(t, 0.18, 1568, 0.08) + 0.3 * ping(t, 0.185, 783.99, 0.1), 17);
  return out;
}
function writeSfx(): void {
  fs.mkdirSync(SFX_DIR, { recursive: true });
  for (const [name, buf] of Object.entries(buildSfx())) writeWav(path.join(SFX_DIR, `${name}.wav`), [buf], SFX_SR, 99);
}
function checkSfx(): string[] {
  const lines: string[] = [];
  for (const name of ['place', 'erase', 'tap', 'select', 'undo', 'error', 'build']) {
    const file = path.join(SFX_DIR, `${name}.wav`);
    const w = readWav(file);
    const x = w.chans[0];
    let pk = 0, dc = 0, sq = 0;
    for (let i = 0; i < x.length; i++) { pk = Math.max(pk, Math.abs(x[i])); dc += x[i]; sq += x[i] * x[i]; }
    const size = fs.statSync(file).size;
    const dur = x.length / w.sr;
    const ok = w.chans.length === 1 && w.sr === SFX_SR && dur >= 0.05 && dur <= 0.4 && size < 20000 && Math.abs(x[0]) < 0.01 && Math.abs(x[x.length - 1]) < 0.01;
    lines.push(`  ${name.padEnd(7)} ${dur.toFixed(3)}s  ${String(size).padStart(5)} B  ${w.sr} Hz ${w.chans.length}ch  peak ${db(pk).toFixed(1)} dBFS  rms ${db(Math.sqrt(sq / x.length)).toFixed(1)}  dc ${(dc / x.length).toExponential(1)}  first/last ${x[0].toFixed(4)}/${x[x.length - 1].toFixed(4)}  ${ok ? 'OK' : 'WARN'}`);
  }
  return lines;
}

// ───────────────────────────── main ─────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const has = (f: string) => args.includes(f);
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1].split(',') : null;
  const tracks = TRACKS.filter((t) => !only || only.includes(t.id));

  if (has('--sheet')) {
    let errs = 0;
    for (const t of tracks) errs += printSheet(t, true);
    if (errs > 0) process.exitCode = 1;
    return;
  }
  if (!has('--check')) {
    if (!has('--sfx')) {
      fs.mkdirSync(SCRATCH, { recursive: true });
      for (const t of tracks) {
        const t0 = Date.now();
        if (printSheet(t, false) > 0) throw new Error(`${t.id}: fix the melody/harmony errors above`);
        const r = renderTrack(t);
        const wav = path.join(SCRATCH, `${t.id}.wav`), m4a = path.join(MUSIC_DIR, `${t.id}.m4a`);
        // afconvert stamps the creation time into the container, so only re-encode when the PCM changed
        const before = fs.existsSync(wav) ? fs.readFileSync(wav) : null;
        writeWav(wav, [r.L, r.R], SR, t.seed);
        if (!before || !fs.existsSync(m4a) || !before.equals(fs.readFileSync(wav))) encodeAac(wav, m4a);
        else console.log('  PCM unchanged, kept the existing .m4a');
        console.log(`  rendered in ${((Date.now() - t0) / 1000).toFixed(1)} s; limiter max reduction ${r.limiter.maxDb.toFixed(1)} dB (more than 0.5 dB for ${r.limiter.activePct.toFixed(2)}% of the time)\n  stem loudness (LUFS before master): ${Object.entries(r.stems).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}\n  section RMS (dBFS): ${r.sections.join(', ')}`);
      }
    }
    if (!only || has('--sfx')) writeSfx();
  }
  console.log('\n──────── measurements ────────');
  for (const t of tracks) {
    if (has('--sfx') && !has('--check')) break;
    if (!fs.existsSync(path.join(SCRATCH, `${t.id}.wav`)) || !fs.existsSync(path.join(MUSIC_DIR, `${t.id}.m4a`))) { console.log(`${t.id}: not rendered yet`); continue; }
    for (const l of checkTrack(t.id)) console.log(l);
  }
  if (fs.existsSync(path.join(SFX_DIR, 'place.wav'))) {
    console.log('sound effects');
    for (const l of checkSfx()) console.log(l);
  }
}

export { V, perc, SR, mtof };

if (require.main === module) main();
