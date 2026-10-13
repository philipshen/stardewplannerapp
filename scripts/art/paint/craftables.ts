/** Hand-designed world sprites: sprinklers, scarecrows, machines, chests and lights. */
import { groundShadow, hex, Img, OUTLINE, stamp } from './kit';
import type { Ctx, Pal, Painter, RGBA } from './kit';

/**
 * One shared palette for every grid in this file. One character = one color.
 * Materials run dark -> light in alphabet order.
 */
const P: Pal = {
  '#': OUTLINE,
  // wood (warm brown) and dark wood
  a: '#5e3a26', b: '#8f5a33', c: '#b97d45', d: '#dba666',
  e: '#3f2622', f: '#62392b', g: '#84503a',
  // iron, stone
  h: '#4a4a5c', i: '#77788c', j: '#a4a8b8', k: '#dfe4ec',
  l: '#6b6470', m: '#928c94', n: '#bcb7b6',
  // gold / brass, copper / terracotta, iridium
  o: '#a8691e', p: '#e0a12c', q: '#f7d451', Q: '#fff3a8',
  r: '#8a3f24', s: '#c4663a', t: '#e89a5c',
  u: '#4b2a7a', v: '#7c48c0', w: '#b388ee',
  // leaf green, lime (slime), teal
  x: '#2c6b34', y: '#4aa13e', z: '#8ed35a',
  '7': '#3d8a1e', '8': '#7ccf2e', '9': '#c8f06a',
  G: '#1f6e6a', H: '#34a89a', I: '#84e0c8',
  // fire (these four colors are used only for fire and lights: glow() looks for them)
  R: '#d9481c', O: '#f58a1f', Y: '#ffd23e', W: '#fff6c2',
  // glass / water blue, cloth blue
  A: '#3f7fa6', B: '#7fc1de', C: '#c9eef8',
  J: '#2b3f8a', L: '#4a6fd0', N: '#86a8f0',
  // red, pink
  D: '#8a2230', E: '#cf3b3b', F: '#f0766a',
  M: '#b03a78', '!': '#ee7fb0',
  // straw, white, near-black
  S: '#a8782a', T: '#dcae45', U: '#f4d878',
  V: '#c3c0d0', X: '#f7f3ea', K: '#3a3040',
  // pumpkin orange, bone / burlap, soil
  '0': '#b3531a', '1': '#e8802a', '2': '#f8ae4a',
  '3': '#b5a78f', '4': '#ebe1c8',
  '5': '#3e2a22', '6': '#5e4030',
  // translucent: water, smoke
  '~': [150, 210, 245, 170], '^': [225, 245, 255, 220], '%': [235, 235, 240, 150],
};

const rgba = (v: string | RGBA): RGBA => (typeof v === 'string' ? hex(v) : v);
const FIRE = ['R', 'O', 'Y', 'W'].map((k) => rgba(P[k]));
const LINT = !!process.env.ART_LINT;

/** Palette with some characters pointing at the colors of other characters. */
function swap(map: Record<string, string>): Pal {
  const out: Pal = { ...P };
  for (const [k, v] of Object.entries(map)) out[k] = v.startsWith('#') && v.length === 7 ? v : P[v];
  return out;
}

function lint(rows: string[], name: string) {
  if (!LINT) return;
  const w = rows[0].length;
  rows.forEach((r, j) => { if (r.length !== w) console.warn(`LINT ${name}: row ${j} has ${r.length} chars, row 0 has ${w}: ${r}`); });
  if (w > 16) console.warn(`LINT ${name}: grid is ${w} wide`);
}

/**
 * Stands a grid on the tile: centered, bottom edge `lift` px above the box bottom, with a ground shadow
 * that is as wide as the bottom rows of the grid. Returns the top-left corner of the stamped grid.
 */
function put(img: Img, x: number, y: number, w: number, h: number, c: Ctx, rows: string[], pal: Pal = P, lift = 1, shadow = true) {
  lint(rows, c.name);
  const gw = Math.max(...rows.map((r) => r.length));
  const gx = x + Math.floor((w - gw) / 2), gy = y + h - rows.length - lift;
  if (rows.length > h - lift) console.warn(`craftables: ${c.name} is ${rows.length} rows, box is ${h}`);
  if (shadow) {
    let lo = gw, hi = -1;
    for (const row of rows.slice(-3)) for (let i = 0; i < row.length; i++) if (row[i] !== '.' && row[i] !== ' ') { lo = Math.min(lo, i); hi = Math.max(hi, i); }
    if (hi >= 0) groundShadow(img, gx + (lo + hi + 1) / 2, y + h - lift - 0.5, Math.min(7.5, (hi - lo + 1) / 2 + 1), 1.6);
  }
  stamp(img, gx, gy, rows, pal);
  return { gx, gy, gw };
}

/** Warm glow: 1-2 px of soft light on the empty pixels around fire and lamp colors. */
function glow(img: Img, x: number, y: number, w: number, h: number) {
  const isFire = (px: number, py: number) => {
    if (px < x || py < y || px >= x + w || py >= y + h || img.alpha(px, py) < 255) return false;
    const g = img.get(px, py);
    return FIRE.some((f) => f[0] === g[0] && f[1] === g[1] && f[2] === g[2]);
  };
  const marks: [number, number, number][] = [];
  for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
    if (img.alpha(px, py) > 0) continue;
    let best = 9;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d === 0 || d > 2 || d >= best) continue;
      if (isFire(px + dx, py + dy)) best = d;
    }
    if (best <= 2) marks.push([px, py, best]);
  }
  for (const [px, py, d] of marks) img.px(px, py, [255, 196, 84, d === 1 ? 120 : 52]);
}

// ---------------------------------------------------------------- sprinklers

const SPRINKLER: Record<string, string[]> = {
  basic: [
    '.....###.....',
    '.....#k#.....',
    '.....#j#.....',
    '....##i##....',
    '.####ttt####.',
    '#kjirtQtsijh#',
    '.####sss####.',
    '....##r##....',
    '.....#j#.....',
    '.....#i#.....',
    '.....###.....',
  ],
  quality: [
    '.##..###..##.',
    '#kj#.#k#.#kj#',
    '#ji#.#j#.#ji#',
    '.##i##i##i##.',
    '.###pqqqp###.',
    '#kjipqQqpijh#',
    '.###opqpo###.',
    '.##i##i##i##.',
    '#kj#.#j#.#kj#',
    '#ji#.#i#.#ji#',
    '.##..###..##.',
  ],
  iridium: [
    '.##..###..##.',
    '#wv#.#w#.#wv#',
    '#vu###v###vu#',
    '.##vvwwwvv##.',
    '.##vwwQwvu##.',
    '#wvvwQXwvuvu#',
    '.##vwwwvvu##.',
    '.##uvvvuuu##.',
    '#wv###u###wv#',
    '#vu#.#u#.#vu#',
    '.##..###..##.',
  ],
};
const NOZZLE = [
  '.###.',
  '#qQp#',
  '#pqo#',
  '#opo#',
  '.###.',
];

const sprinkler: Painter = (img, x, y, w, h, c) => {
  const rows = /iridium/i.test(c.name) ? SPRINKLER.iridium : /quality/i.test(c.name) ? SPRINKLER.quality : SPRINKLER.basic;
  const { gx, gy } = put(img, x, y, w, h, c, rows, P, 3);
  if (/\(P\)/.test(c.name)) {
    stamp(img, gx + 4, gy + 1, NOZZLE, P);
    // water droplets thrown out past the nozzles
    const drops: [number, number][] = [[1, -2], [11, -3], [-1, 3], [13, 2], [0, 9], [12, 10], [4, 12], [9, -4]];
    for (const [dx, dy] of drops) { img.px(gx + dx, gy + dy, rgba(P.C)); img.px(gx + dx, gy + dy + 1, rgba(P.B)); }
  }
};

// ---------------------------------------------------------------- scarecrows

/** Body: T-pose shirt with straw hands, belt, straw skirt and pole. N/L/J = shirt light/mid/dark, p = button. */
const CROW_BODY = [
  '.##############.',
  '#UTNNLLLLLLLJTU#',
  '#TSNLLLLLLLLJST#',
  '.###NLLLLLLJ###.',
  '...#NLLpLLLJ#...',
  '...#NLLLLLLJ#...',
  '...#LLLpLLJJ#...',
  '...#aaaqpaaa#...',
  '...#TUTUTSTS#...',
  '...#UTSTUTST#...',
  '....#T#cb#S#....',
  '......#cb#......',
  '......#cb#......',
  '......#cb#......',
  '......#ba#......',
  '.......##.......',
];

type Crow = { head: string[]; shirt: [string, string, string]; pal?: Record<string, string>; overlap?: number };
const CROWS: Record<string, Crow> = {
  'Scarecrow': {
    shirt: ['N', 'L', 'J'],
    head: [
      '....######....',
      '...#UUUUTS#...',
      '...#UUTTTS#...',
      '.###EEEEED###.',
      '#UUUUTTTTTTSS#',
      '.############.',
      '..#44444443#..',
      '..#4#444#43#..',
      '..#44444443#..',
      '..#44a4a443#..',
      '...#333333#...',
      '...#TSUTST#...',
    ],
  },
  'Deluxe Scarecrow': {
    shirt: ['v', 'u', 'u'], pal: { J: '#33205a' },
    head: [
      '...########...',
      '...#KhKKKK#...',
      '...#KhKKKK#...',
      '...#KKKKKK#...',
      '...#pqqqpo#...',
      '.############.',
      '#KKhKKKKKKKKK#',
      '.############.',
      '..#44444443#..',
      '..#4E444E43#..',
      '..#44444443#..',
      '..#4a4a4a43#..',
      '...#333333#...',
      '..#DEE#pEED#..',
    ],
  },
  'Rarecrow 1': { // jester
    shirt: ['F', 'E', 'D'],
    head: [
      '.##........##.',
      '#qp#......#qp#',
      '.#E##....##L#.',
      '.#FEE#..#NLL#.',
      '..#FEE##NLL#..',
      '..#FEEENLLJ#..',
      '..#pqpqpqpo#..',
      '..#XXXXXXXV#..',
      '..#X#XXX#XV#..',
      '..#XXXEEXXV#..',
      '..#X!X##X!V#..',
      '...#XXXXVV#...',
      '..#qpNLqpNL#..',
    ],
  },
  'Rarecrow 2': { // witch
    shirt: ['i', 'h', 'K'],
    head: [
      '........##....',
      '.......#vu#...',
      '......#vvu#...',
      '.....#wvvu#...',
      '.....#wvvu#...',
      '....#wvvvu#...',
      '....#pqQpo#...',
      '.###wvvvvuu##.',
      '#wwvvvvvvvvuu#',
      '.############.',
      '.1#zyyyyyyx#1.',
      '.1#z#yyy#yx#1.',
      '.0#zyyxyyyx#0.',
      '.0#zy####yx#0.',
      '...#yyyyxx#...',
    ],
  },
  'Rarecrow 3': { // star visitor
    shirt: ['k', 'j', 'i'],
    head: [
      '.##........##.',
      '#IH#......#IH#',
      '.##........##.',
      '..#..####..#..',
      '..###zzzz###..',
      '.#zzzzzzzzzy#.',
      '#zzzzzzzzzzyy#',
      '#zKKKzzzKKKyy#',
      '#zXKKzzzXKKyx#',
      '#zzKKzyzzKKyx#',
      '.#zzzyyyyyyx#.',
      '..#yyy##yyx#..',
      '...#yyyyxx#...',
    ],
  },
  'Rarecrow 4': { // snowman
    shirt: ['X', 'X', 'V'], pal: { p: 'K' },
    head: [
      '....######....',
      '....#KhKK#....',
      '....#KhKK#....',
      '....#EEED#....',
      '..##########..',
      '...#XXXXXV#...',
      '..#XXXXXXXV#..',
      '..#XKXXXKXV#..',
      '..#XXXX1100#..',
      '..#XXXXXXXV#..',
      '..#XKXKXKVV#..',
      '...#VVVVVV#...',
      '..#FEEEEEED#..',
    ],
  },
  'Rarecrow 5': { // painted mask
    shirt: ['t', 's', 'r'],
    head: [
      '......##......',
      '.....#FE#.....',
      '..##.#FE#.##..',
      '.#IH##ED##IH#.',
      '.#IHG#ED#IHG#.',
      '.############.',
      '.#dccccccccb#.',
      '.#dXXXccXXXb#.',
      '.#dX#XccX#Xb#.',
      '.#EEEcqqcEEE#.',
      '.#dcccqpcccb#.',
      '.#dc######cb#.',
      '.#dc#XXXX#cb#.',
      '..#bccccccb#..',
    ],
  },
  'Rarecrow 6': { // bearded miner
    shirt: ['c', 'b', 'a'], overlap: 3,
    head: [
      '#X#........#X#',
      '#4X#.####.#X4#',
      '.#4X#jkjj#X4#.',
      '..##jkjjih##..',
      '..#jkjjjjih#..',
      '..#hhhpqhhh#..',
      '..#4#44#443#..',
      '..#114FF411#..',
      '.#2111111110#.',
      '.#2112111010#.',
      '.#2111211100#.',
      '..#21111100#..',
      '...#211100#...',
      '....#2100#....',
      '.....####.....',
    ],
  },
  'Rarecrow 7': { // masked bandit critter
    shirt: ['y', 'x', 'x'],
    head: [
      '..##......##..',
      '.#jh#....#jh#.',
      '.#j!h####h!h#.',
      '.#jjjjjjjjih#.',
      '#jjjjjjjjjiih#',
      '#KKKKjjjKKKKh#',
      '#KXKKKjKKXKKh#',
      '#jKKKXXXKKKih#',
      '.#jjXXKXXXih#.',
      '..#jXXXXXih#..',
      '...#iXXXih#...',
    ],
  },
  'Rarecrow 8': { // turnip head
    shirt: ['d', 'c', 'b'],
    head: [
      '...##.##.##...',
      '..#zy#zy#yx#..',
      '...#zyzyyx#...',
      '....#yyyx#....',
      '...##wwww##...',
      '..#wwvvvvvu#..',
      '.#wwvvvvvvvu#.',
      '.#XXwvvvvvVu#.',
      '.#XXXXXXXXVV#.',
      '.#XX#XXX#XVV#.',
      '.#XXXXXXXXVV#.',
      '..#XX###XVV#..',
      '...#XXXXVV#...',
    ],
  },
};

const scarecrow: Painter = (img, x, y, w, h, c) => {
  const d = CROWS[c.name] ?? CROWS['Scarecrow'];
  const pal = swap({ N: d.shirt[0], L: d.shirt[1], J: d.shirt[2], ...(d.pal ?? {}) });
  const { gy } = put(img, x, y, w, h, c, CROW_BODY, pal, 0);
  lint(d.head, c.name + ' head');
  stamp(img, x + 1, gy - d.head.length + (d.overlap ?? 0), d.head, P);
};

// ---------------------------------------------------------------- chests

const CHESTS: Record<string, string[]> = {
  'Chest': [
    '.############.',
    '#cjddddddddjc#',
    '#cicccccccckc#',
    '#bibbbbbbbbib#',
    '######pq######',
    '#cjcccpocccjc#',
    '#cicccc##ccic#',
    '#bicccccccbib#',
    '#bibbbbbbbbib#',
    '#ahaaaaaaaaha#',
    '.############.',
  ],
  'Big Chest': [
    '.##############.',
    '#cjdddddddddjdc#',
    '#cicccccccccicc#',
    '#bibbbbbbbbbibb#',
    '################',
    '#cjdddddddddjdc#',
    '#bibbbbbbbbbibb#',
    '#####pq##pq#####',
    '#cjccpo##pocjcc#',
    '#cicc##cc##cicc#',
    '#bicccccccccibc#',
    '#bibbbbbbbbbibb#',
    '#ahaaaaaaaaahaa#',
    '.##############.',
  ],
  'Stone Chest': [
    '.############.',
    '#nnnnnnnnnnnm#',
    '#nmmmmmmmmmml#',
    '#mllllllllllm#',
    '######AC######',
    '#nmmmmBAmmmml#',
    '#nmlmm##mmlml#',
    '#nmmmmmmmmmml#',
    '#mmmlmmmmlmml#',
    '#llllllllllll#',
    '.############.',
  ],
  'Big Stone Chest': [
    '.##############.',
    '#nnnnnnnnnnnnnm#',
    '#nmmmmmmmmmmmml#',
    '#mlllllllllllll#',
    '################',
    '#nnnnnnnnnnnnnm#',
    '#mlllllllllllll#',
    '#####AC##AC#####',
    '#nmmmBA##BAmmml#',
    '#nmlm##mm##mlml#',
    '#nmmmmmmmmmmmml#',
    '#mmlmmmmmmmmlml#',
    '#llllllllllllll#',
    '.##############.',
  ],
  'Junimo Chest': [
    '....#....#....',
    '...#z#..#z#...',
    '..#zy####yz#..',
    '.#zzyyzzzyyx#.',
    '#zyyzzyyyyyxx#',
    '#yyyyyyyyyyxx#',
    '#####qQq######',
    '#zyy#qXq#yyyx#',
    '#yyyx#q#xyyxx#',
    '#yxyyy#yyyxyx#',
    '#xyyyyyyyxyxx#',
    '#xxxxxxxxxxxx#',
    '.############.',
  ],
  'Mini-Shipping Bin': [
    '..############',
    '.#EFFFFFFFFFD#',
    '#EFFFFFFFFFED#',
    '#EEEEEEEEEEDD#',
    '##############',
    '#dccbccbccbca#',
    '#dccbcXXccbca#',
    '#dccbXXXXcbca#',
    '#dccbcXXccbca#',
    '#dccbcXXccbca#',
    '#baababbabbaa#',
    '.############.',
  ],
  'Auto-Grabber': [
    '..##......##..',
    '.#kj#....#ji#.',
    '.#j#......#i#.',
    '.#ji#....#ih#.',
    '..#ji#..#ih#..',
    '...#ji##ih#...',
    '....#jiih#....',
    '.....#ih#.....',
    '.############.',
    '#kjjjjjjjjjih#',
    '#jiiEEiiiiiih#',
    '#jiiEDiipqiih#',
    '#jiiiiiiiiihh#',
    '#j#h#h#h#h#hh#',
    '#ihhhhhhhhhhh#',
    '.############.',
  ],
};

const chest: Painter = (img, x, y, w, h, c) => {
  put(img, x, y, w, h, c, CHESTS[c.name] ?? CHESTS['Chest']);
};

// ---------------------------------------------------------------- lights

const FLAME = [
  '...R....',
  '...RR...',
  '..ROR...',
  '..ROOR..',
  '.ROYOR..',
  '.ROYYOR.',
  'ROYYWYOR',
  'ROYWWYOR',
  '.ROYYOR.',
];
const FLAME_TWIN = [
  '.R...R..',
  '.RR..R..',
  '.ROR.RR.',
  '.ROORROR',
  'ROYOROOR',
  'ROYYOYOR',
  'ROYWYYOR',
  'ROYWWYOR',
  '.ROYYOR.',
];
const FLAME_WISP = [
  '....R...',
  '.....RR.',
  '....ROR.',
  '..RROOR.',
  '.ROOYOR.',
  'ROYYYOR.',
  'ROYWWYOR',
  'ROYWWYOR',
  '.ROYYOR.',
];
const FLAME_SMALL = [
  '..R..',
  '..RR.',
  '.ROR.',
  '.ROOR',
  'ROYOR',
  'ROWYR',
  '.RYR.',
];
const FLAME_BIG = [
  '.....R......',
  '....RR...R..',
  '....ROR.....',
  '...ROOR.R...',
  '..ROOYORR...',
  '..ROYYOROR..',
  '.ROYYYOOYOR.',
  '.ROYWYYOYOR.',
  'ROYYWWYYYYOR',
  'ROYWWWWYWYOR',
  'ROYYWWWWWYOR',
  '.ROYYWWYYOR.',
  '..ROOYYOOR..',
];

type Stand = { rows: string[]; flame?: string[]; sink?: number; pal?: Pal };
const BRAZIERS: Record<string, Stand> = {
  'Wooden Brazier': { sink: 2, rows: [
    '############',
    '#dROYYYYORa#',
    '#dccbccbcba#',
    '#dccbccbcba#',
    '.#dcbccbca#.',
    '.#bbbaabba#.',
    '..########..',
    '..#c#..#b#..',
    '..#c#..#b#..',
    '.#c#....#b#.',
    '.#b#....#a#.',
    '.##......##.',
  ] },
  'Stone Brazier': { flame: FLAME_TWIN, sink: 2, rows: [
    '.############.',
    '#nROYYYYYYORl#',
    '#nnmmmmmmmmml#',
    '.#nmmlmmlmml#.',
    '..##########..',
    '....#nmml#....',
    '....#nmml#....',
    '....#nmll#....',
    '...#nmmmml#...',
    '..#nnmmmmml#..',
    '..##########..',
  ] },
  'Gold Brazier': { flame: FLAME_TWIN, sink: 2, rows: [
    '.############.',
    '#QROYYYYYYORo#',
    '#qqqqppppppoo#',
    '.#qqppppppoo#.',
    '..###qppo###..',
    '.....#po#.....',
    '....#qEDo#....',
    '.....#po#.....',
    '.....#po#.....',
    '....#qppo#....',
    '..#qqqppppo#..',
    '..##########..',
  ] },
  'Carved Brazier': { sink: 2, rows: [
    '.##########.',
    '#dROYYYYORa#',
    '#dccccccbba#',
    '.##########.',
    '..#dccccb#..',
    '..#d#cc#b#..',
    '..#dccccb#..',
    '..#dc##cb#..',
    '..#c#XX#b#..',
    '..#cccbbb#..',
    '.#EEEEEEED#.',
    '..#dccbbb#..',
    '..#d#cc#a#..',
    '.#dccccbba#.',
    '.##########.',
  ] },
  'Stump Brazier': { flame: FLAME_WISP, sink: 2, rows: [
    '..########..',
    '.#dROYYORb#.',
    '.#cddddccb#.',
    '.#cbcbccba#.',
    '.#cbccbcba#.',
    '.#ccbcbcba#.',
    '.#cbccbbba#.',
    '#ccbcbccbaa#',
    '#cb#bcab#ba#',
    '.##.####.##.',
  ] },
  'Barrel Brazier': { flame: FLAME_TWIN, sink: 2, rows: [
    '..########..',
    '.#cROYYORb#.',
    '.#jjkjjiih#.',
    '#ddcbccbcba#',
    '#ddcbccbcba#',
    '#ddcbccbcba#',
    '#jjkjjjiiih#',
    '#ddcbccbcba#',
    '#ddcbccbcba#',
    '.#jjkjiihh#.',
    '.#dcbccbba#.',
    '..########..',
  ] },
  'Skull Brazier': { flame: FLAME_WISP, sink: 2, rows: [
    '...######...',
    '..#4ROOR3#..',
    '.#44444443#.',
    '#4444444433#',
    '#4KKK44KKK3#',
    '#4KOK44KOK3#',
    '#44KK##KK33#',
    '.#44444433#.',
    '..#4#4#43#..',
    '...######...',
    '....#43#....',
    '....#43#....',
    '....#43#....',
    '..##4433##..',
    '.#44#33#43#.',
    '.##########.',
  ] },
  'Marble Brazier': { flame: FLAME_TWIN, sink: 2, rows: [
    '.############.',
    '#XROYYYYYYORV#',
    '#XXXXXXXXXVVV#',
    '.############.',
    '..#XXVXVXVV#..',
    '...#XVXVXV#...',
    '...#XVXVXV#...',
    '...#XVXVXV#...',
    '...#XVXVXV#...',
    '...#XVXVXV#...',
    '...#XVXVXV#...',
    '..#XXVXVXVV#..',
    '.#XXXXXXXVVV#.',
    '.############.',
  ] },
  'Campfire': { flame: FLAME_WISP, sink: 3, rows: [
    '....######....',
    '.###dROYORb##.',
    '#nm#ccOYObb#m#',
    '#mlddc###ccbl#',
    '.#nm###nm##ml#',
    '..##########..',
  ] },
  'Bonfire': { flame: FLAME_BIG, sink: 6, rows: [
    '.....####.....',
    '....#dccb#....',
    '...#dc##cb#...',
    '..#dc#OY#cb#..',
    '..#dc#YO#cb#..',
    '.#dc##OY##cb#.',
    '.#dc#cROb#cb#.',
    '#dcb#cbbb#cba#',
    '#dc#dcb#cba#a#',
    '#cb#ccb#cba#a#',
    '.############.',
  ] },
  'Tall Torch': { flame: FLAME_WISP, sink: 1, rows: [
    '..######..',
    '.#kjROijh#',
    '..#jiih#..',
    '...#cb#...',
    '...#cb#...',
    '...#cb#...',
    '...#cb#...',
    '..#qppo#..',
    '...#cb#...',
    '...#cb#...',
    '...#cb#...',
    '...#cb#...',
    '...#cb#...',
    '...#cb#...',
    '...#cb#...',
    '...#cb#...',
    '...#cb#...',
    '...#ba#...',
    '..#mnml#..',
    '..######..',
  ] },
};

const brazier: Painter = (img, x, y, w, h, c) => {
  const d = BRAZIERS[c.name] ?? BRAZIERS['Wooden Brazier'];
  const { gy } = put(img, x, y, w, h, c, d.rows, d.pal ?? P);
  const fl = d.flame ?? FLAME;
  lint(fl, 'flame');
  stamp(img, x + Math.floor((w - fl[0].length) / 2), gy - fl.length + (d.sink ?? 2), fl, P);
  glow(img, x, y, w, h);
};

const TORCH = [
  '.####.',
  '#jROi#',
  '.#cb#.',
  '.#cb#.',
  '.#cb#.',
  '.#cb#.',
  '.#ba#.',
  '..##..',
];
const torch: Painter = (img, x, y, w, h, c) => {
  const { gy } = put(img, x, y, w, h, c, TORCH, P, 2);
  stamp(img, x + 6, gy - FLAME_SMALL.length + 2, FLAME_SMALL, P);
  glow(img, x, y, w, h);
};

const LAMP_WOOD = [
  '......####......',
  '.....#dccb#.....',
  '....#dccccb#....',
  '...#ddcccbba#...',
  '...##########...',
  '....#YWWYYO#....',
  '....#YWWWYO#....',
  '....#YYWYYO#....',
  '....#OYYYOO#....',
  '...##########...',
  '...#dccccbba#...',
  '....###cb###....',
  '......#cb#......',
  '......#cb#......',
  '......#cb#......',
  '......#db#......',
  '......#cb#......',
  '......#cb#......',
  '......#cb#......',
  '......#cb#......',
  '......#cb#......',
  '......#db#......',
  '......#cb#......',
  '......#cb#......',
  '......#cb#......',
  '......#cb#......',
  '......#cb#......',
  '......#cb#......',
  '......#cb#......',
  '.....#dcba#.....',
  '....#dccbba#....',
  '....########....',
];
const LAMP_IRON = [
  '.......##.......',
  '.......##.......',
  '......#ih#......',
  '.....#ihhK#.....',
  '....#ihhhKK#....',
  '...##########...',
  '....#YW#WYO#....',
  '....#YW#YYO#....',
  '....#YY#YOO#....',
  '....#OY#YOO#....',
  '....########....',
  '.....#ihhK#.....',
  '..##..#hK#..##..',
  '.#ih###hK###hK#.',
  '..##..#hK#..##..',
  '......#hK#......',
  '......#hK#......',
  '......#hK#......',
  '.....#ihhK#.....',
  '......#hK#......',
  '......#iK#......',
  '......#hK#......',
  '......#hK#......',
  '......#hK#......',
  '......#hK#......',
  '......#iK#......',
  '......#hK#......',
  '......#hK#......',
  '......#hK#......',
  '.....#ihhK#.....',
  '......#hK#......',
  '.....#ihhK#.....',
  '....#ihhhKK#....',
  '....########....',
];
const lamppost: Painter = (img, x, y, w, h, c) => {
  put(img, x, y, w, h, c, /iron/i.test(c.name) ? LAMP_IRON : LAMP_WOOD);
  glow(img, x, y, w, h);
};

const PUMPKIN = [
  '......##......',
  '.....#yx#.....',
  '..####yx####..',
  '.#2221111100#.',
  '#221511115100#',
  '#215W5115W510#',
  '#21WWW11WWW10#',
  '#21111WW11100#',
  '#2W5W5555W5W0#',
  '#2WWWWWWWWWW0#',
  '#21WYWYYWYW10#',
  '.#1111111100#.',
  '..##########..',
];
const jackolantern: Painter = (img, x, y, w, h, c) => {
  put(img, x, y, w, h, c, PUMPKIN);
  glow(img, x, y, w, h);
};

const CRABPOT = [
  '...........##...',
  '..........#EF#..',
  '..........#XX#..',
  '..........#ED#..',
  '...........c....',
  '.##########c###.',
  '#dccccccccccccb#',
  '#c############b#',
  '#c#jAjAjAjAjA#b#',
  '#c#AjAjAjAjAj#b#',
  '#c#jAjAjAjAjA#b#',
  '#c############a#',
  '#cbbbbbbbbbbbba#',
  '.##############.',
  '.~^^~~~~~~~~^^~.',
  '...~~^^^^^~~....',
];
const crabpot: Painter = (img, x, y, w, h, c) => {
  put(img, x, y, w, h, c, CRABPOT, P, 1, false);
};

const GARDENPOT = [
  '.############.',
  '#ttttttttttss#',
  '#ts66566656sr#',
  '#ts########sr#',
  '.#ttsssssssr#.',
  '.#ttsssssssr#.',
  '.#tsssssssrr#.',
  '..#tssssssr#..',
  '..#tsssssrr#..',
  '..#ssssssrr#..',
  '...########...',
];
const gardenpot: Painter = (img, x, y, w, h, c) => {
  put(img, x, y, w, h, c, GARDENPOT);
};

// ---------------------------------------------------------------- machines

/** Grid from a text block: one row per line. */
const g = (s: string) => s.trim().split('\n').map((r) => r.trim());

const INCUBATOR = g(`
.....####.....
....#jiih#....
...###YY###...
..#CCCYYCCB#..
.#CXCC##CCBB#.
.#CXC#XX#CBB#.
.#CC#XXXV#BB#.
.#CC#XXVV#BB#.
.#CTT#VV#TSB#.
.#TUTT##TUTS#.
##############
#kjjjjjjjjjih#
#jiiiqiiEiiih#
#ihhhhhhhhhhh#
.############.`);

const CAT_STATUE = g(`
..##......##..
.#Qq#....#qp#.
.#qqq####qpo#.
.#Qqqqqqqqpo#.
.#qq#qqq#qpo#.
.#qqqqDqqqpo#.
.#qqq#q#qppo#.
..#qqqqqqpo#..
...#qqqppo#...
..#Qqqqqppo#..
.#qqqqqqqppo#.
.#qq#qqq#ppo#.
.#qq#qpp#poo#.
.############.
#nnnnnnnnnnnm#
#nmmmmmmmmmml#
.#mmmmmmmmml#.
.############.`);

const TAPPER = g(`
...########...
...#kjjiih#...
...###ji###...
.....#ji#.....
......##......
......pq......
..#.######.#..
.#.#......#.#.
.############.
.#kqqqqqqpih#.
.#jjjjjiiihh#.
..#jjjiiihh#..
..#kkkkkkjj#..
..#jjjiiihh#..
...#jiiihh#...
...########...`);

const MACHINES: Record<string, { rows: string[]; pal?: Pal; glow?: boolean }> = {
  'Keg': { rows: g(`
...########...
..#cddddddc#..
.#cbbccccbbc#.
.#jjkjjjiiih#.
.#dcbccbccba#.
#ddcbccbccbba#
#jjkjjjjiiihh#
#ddcbccbccbba#
#ddcb####cbba#
#ddcb#pq#cbba#
#ddcb#po#cbba#
#jjkj#o##iihh#
#ddcbc##ccbba#
.#dcbccbccba#.
.#jjkjjiiihh#.
.#dcbccbccba#.
..##########..`) },
  'Cask': { rows: g(`
.....######.....
...##jjkjji##...
..#jigggggghi#..
.#jgggggggggfh#.
.#igfffffffffh#.
#jgggggggggggfh#
#jgggggggggggfh#
#jffffpqfffffeh#
#iggggpoggggffh#
#igggggggggggfh#
.#ifffffffffeh#.
.#iggggggggffh#.
..#hgggggggfh#..
...##hhhhhh##...
.#b#.######.#b#.
.#cb########ba#.
.#c#........#a#.
.###........###.`) },
  'Preserves Jar': { rows: g(`
...######...
..#XXXXXV#..
.#XXVXXVXV#.
.#pppppppo#.
..#CBBBBA#..
.#CBBBBBBA#.
#CCBBBBBBBA#
#CFEEEEEEDA#
#CFEFEEEEDA#
#CFEEEEFEDA#
#CFEEEEEEDA#
#CEEEFEEEDA#
#BEEEEEEDDA#
.#BDDDDDDA#.
..########..`) },
  'Cheese Press': { rows: g(`
...########...
...#jkjjih#...
...###ji###...
.....#ji#.....
.############.
.#dccccccccb#.
.#####ji#####.
.#c#.#ji#.#b#.
.#c#.#ji#.#b#.
.#c########b#.
.#c#jkjjih#b#.
.#c#Qqqqqp#b#.
.#c#qqpqpo#b#.
.############.
#ddccccccccba#
#cbbbbbbbbbaa#
.############.`) },
  'Dehydrator': { rows: g(`
....######....
...#hKhKhK#...
.############.
#kjjjjjjjjjih#
#j##########h#
#j#12K12K12#h#
#j#aaaaaaaa#h#
#j#21K21K21#h#
#j#aaaaaaaa#h#
#j#12K12K12#h#
#j##########h#
#jiiiiEiiqiih#
#ihhhhhhhhhhh#
.############.
.#K#......#K#.`) },
  'Fish Smoker': { rows: g(`
.........%%...
........%%%...
.........%%...
........####..
..#######ih#..
.#kjjjjjjiih#.
#j##########h#
#j#KKBBBKKA#h#
#j#KB#BBBAA#h#
#j#KKBBBKKA#h#
#j##########h#
#jiiiiiiiiihh#
#ji##RORO##hh#
#ji##OYOY##hh#
#ihhhhhhhhhhh#
.############.
.#K#......#K#.`) },
  'Loom': { rows: g(`
.############.
#dccccccccccb#
.#cXVXVXVXVb#.
.#cXVXVXVXVb#.
.#cXVXVXVXVb#.
.#cjjjjjjiib#.
.#cXVXVXVXVb#.
.#cXVXVXVXVb#.
.#cFEFEFEFEb#.
.#cEFEFEFEFb#.
.#cLNLNLNLNb#.
.#cFEFEFEFEb#.
#dccccccccccb#
#cbbbbbbbbbba#
.#c#......#b#.
.#b#......#a#.
.###......###.`) },
  'Mayonnaise Machine': { rows: g(`
.....####.....
....#XXXV#....
....#XXVV#....
..##########..
..#jjjjjiih#..
...#jjiiih#...
.############.
#XXXXXXXXXXVV#
#XX######XXVV#
#XX#CUUB#XVVV#
#XX#CUUB#XEVV#
#XX#LNNL#XVVV#
#XX#CUUB#XVVV#
#XV######VVVV#
#VVVVVVVVVVVV#
.############.
.#K#......#K#.`) },
  'Oil Maker': { rows: g(`
...########...
...#jkjjih#...
...###ji###...
.....#ji#.....
.############.
.#ttttttsssr#.
.#####ji#####.
.#t#jkjjih#r#.
.#t#zyyyyx#r#.
.#t#yxyyxx#r#.
.#t#aaaaaa#r#.
.#t###qq###r#.
.############.
#Qqqqqqqqqqpo#
#tsssssssssrr#
.############.`) },
  'Bee House': { rows: g(`
......##......
....##qq##....
..##qqqppp##..
.#qqqqppppoo#.
#qqqppppppooo#
##############
.#dccccccccb#.
.#dcccKKcccb#.
.#dccKKKKccb#.
#dccccccccccb#
.#dccccccccb#.
.#qqqqqqqqpo#.
.#dccccccccb#.
.############.
..#c#....#b#..
..#b#....#a#..
..###....###..`) },
  'Auto-Petter': { rows: g(`
....######....
...#XXXXXV#...
..#XX!!XXVV#..
..#X!!!!XVV#..
..#XX!!XXVV#..
...#XXXVVV#...
....######....
.....#ji#.....
....#jiih#....
.....#ji#.....
.....#ji#.....
.############.
#kjjjjjjjjjih#
#jiiEEiEEiiih#
#jiiEEEEEiiih#
#jiiiEEEiiihh#
#jiiiiEiiiihh#
#ihhhhhhhhhhh#
.############.`) },
  'Coffee Maker': { rows: g(`
.############.
#ihhhhhhhhhhK#
#hhhhhhhhhEKK#
##############
#h#..#ji#..#K#
#h#.######.#K#
#h##CBBBBA##K#
#h##CffffA##K#
#h##gfffee##K#
#h##gfffee##K#
#h#.######.#K#
##############
#ihhhhhhhhhKK#
#hKKKKKKKKKKK#
.############.`) },
  'Deconstructor': { rows: g(`
.############.
#kXjXjXjXjXjh#
#jKKKKKKKKKKh#
#jjjjjjjjjjih#
#jiiiiqqiiiih#
#jiipqqqqpiih#
#jiiqqppqqiih#
#jiqqp##pqoih#
#jiqqp##pooih#
#jiiqqppooiih#
#jiipoooopiih#
#jiiiiooiiiih#
#qKqKqKqKqKqK#
#KqKqKqKqKqKq#
.############.`) },
  'Feed Hopper': { rows: g(`
....######....
..##UUTUTT##..
.#UTUUTTUTTS#.
##############
#dccbccbccbca#
#jjkjjjjiiihh#
.#dcbccbccba#.
.#dcbccbccba#.
..#dbccbcba#..
..#dbccbcba#..
...########...
....#jiih#....
....#UTTS#....
...#UTUTTS#...
...########...`) },
  'Heater': { glow: true, rows: g(`
....######....
..##hhhhhh##..
.#ihhhhhhhhK#.
#ihhhhhhhhhhK#
#ih#########K#
#ih#Y#Y#Y#Y#K#
#ih#W#W#W#W#K#
#ih#Y#Y#Y#Y#K#
#ih#O#O#O#O#K#
#ih#R#R#R#R#K#
#ih#########K#
#ihhhhhqhhhhK#
#hKKKKKKKKKKK#
.############.
.#K#......#K#.`) },
  'Incubator': { rows: INCUBATOR },
  'Slime Incubator': { rows: g(`
....######....
...#wvvvvu#...
..##########..
..#CBBBBBBA#..
..#CXB##BBA#..
..#CX#98#BA#..
..#C#9887#A#..
..#C#8887#A#..
..#C#8877#A#..
..#88#77#87#..
..#89888877#..
.############.
#wvvvvvvvvvuu#
#vuu8uuuuquuu#
#uuuuuuuuuuuu#
.############.`) },
  'Ostrich Incubator': { rows: g(`
.....####.....
....#qppo#....
...###YY###...
..#CCCYYCCB#..
.#CXC####CBB#.
.#CX#4444#BB#.
.#C#444443#B#.
.#C#4s4443#B#.
.#C#44443s#B#.
.#C#444433#B#.
.#CT#4433#SB#.
.#TUT####UTS#.
##############
#dccccccccccb#
#cbbqbbbbEbba#
#baaaaaaaaaaa#
.############.`) },
  'Mushroom Box': { rows: g(`
....####......
...#FXEE#.....
..#FEEEXD#.##.
..###XV###ccb#
.....#XV#.#X#.
.####XV###X##.
#d6656656656b#
##############
#dccbccbccbca#
#dccbccbccbca#
#cbbabbabbaba#
.############.`) },
  'Sewing Machine': { rows: g(`
.........##...
........#EF#..
........#ED#..
.###########..
#KhhKKKKKKKK#.
#KKKqpqpqKKK##
#KKK#####KKKj#
.#i#....#KKK##
.#i#....#KpK#.
..#.....#KKK#.
##############
#dccccccccccb#
.############.
.#c#......#b#.
.#c########b#.
.#c#......#b#.
.###......###.`) },
  'Soda Machine': { rows: g(`
.############.
#FEEEEEEEEEED#
#F##########D#
#F#XXXXXXXV#D#
#F#XEEXXLLV#D#
#F#XEDXXLJV#D#
#F#XXXXXXXV#D#
#F#XyyXX11V#D#
#F#XyxXX10V#D#
#F#XXXXXXXV#D#
#F##########D#
#FEEEEEEE##ED#
#FXXXEEEE#K#D#
#FEXXXEEE##ED#
#FEEXXXEEEEED#
#FE########ED#
#FE#KKKKKK#ED#
#FE########ED#
#DDDDDDDDDDDD#
.############.`) },
  'Statue of Perfection': { rows: CAT_STATUE },
  'Statue of True Perfection': {
    rows: ['......##......', '.....#CB#.....', '......##......', ...CAT_STATUE],
    pal: swap({ Q: 'X', q: 'w', p: 'v', o: 'u', D: 'I', n: 'q', m: 'p', l: 'o' }),
  },
  'Statue of Endless Fortune': { rows: g(`
..###....###..
.#zXz#..#zXz#.
.#zKz####zKy#.
#zzzzzzzzzzyy#
#z##########x#
#zzzzzzzzyyyx#
.#zzzqQqzyyx#.
.#zzzqppzyyx#.
#zz#zzzzyy#yx#
#zy#zzyyyy#xx#
.############.
#qqpqqpqqpqqo#
#poopoopoopoo#
.############.`) },
  'Statue of Blessings': { rows: g(`
.....####.....
....#qQQq#....
.....####.....
....#XXXV#....
....#XXXV#....
...##XXVV##...
..#XXXXXXVV#..
..#XXV##XVV#..
..#XX#CB#VV#..
..#XX#BA#VV#..
..#XXX##XVV#..
..#XXVXXVXV#..
..#XXVXXVXV#..
.#XXXVXXVXVV#.
.#XXXVXXVXVV#.
.############.
#nnnnnnnnnnnm#
#nmmmmmmmmmml#
.############.`) },
  'Statue of the Dwarf King': { rows: g(`
...#..##..#...
..#q##qq##q#..
..#qpqEDqpo#..
..##########..
..#nnmmmmml#..
..#n#mnm#ml#..
.#nnnmmmmmml#.
.#nmnmmmlmml#.
.#nnmnmmmlml#.
#nn#nmmmml#ml#
#nm#nmnmml#ml#
.##.#nmml#.##.
..#nnmmmmml#..
.############.
#nnnnnnnnnnnm#
#mlllllllllll#
.############.`) },
  'Telephone': { rows: g(`
..##########..
.#EFFEEEEEED#.
.#ED######ED#.
..###EEEE###..
...#FEEEED#...
..#FE#XX#ED#..
..#EE#XK#ED#..
.#FEEE##EEDD#.
.#DDDDDDDDDD#.
##############
#dccccccccccb#
.############.
..#c#....#b#..
..#c#....#b#..
..#b#....#a#..
..###....###..`) },
  'Wood Chipper': { rows: g(`
....######....
...#dddddc#...
...#dcbcba#...
...#dcbcba#...
.############.
.#XzXzXzXzXx#.
..#zyyyyyyx#..
.############.
#zzyyyyyyyyyx#
#zqKqKqKqKqyx#
#zy########yx#
#zy#dcdbdc#yx#
#zy#cdcdcb#yx#
#yx########xx#
.############.
.#KK#....#KK#.
..##......##..`) },
  'Workbench': { rows: g(`
################
#aaaaaaaaaaaaaa#
#a#jj#aajjjjjca#
#aa#c#aa#j#j#ca#
#aaacaaaaaaaaaa#
#aaacaaaaaaaaaa#
################
#ddddddddddddcc#
#dccccccccccccb#
################
#cb#bbbbbbbb#cb#
#cb#bbpqbbbb#cb#
#cb##########cb#
#cb#........#ba#
#ba#........#ba#
####........####`) },
  'Anvil': { rows: g(`
..###########.
.#kkjjjjjjjih#
#kjjiiiiiiihh#
.###iiiiihh##.
....#jiih#....
....#jiih#....
...#jiiihh#...
..#jiiiiihh#..
..##########..
.#dcbccbccba#.
.#dcbccbccba#.
.#cbbcbbcbba#.
.############.`) },
  'Farm Computer': { rows: g(`
.........##...
........#EF#..
.........##...
.........#j#..
.############.
#XXXXXXXXXXXV#
#X##########V#
#X#GGGGGGGG#V#
#X#GzzGGzGG#V#
#X#GGGGGGGG#V#
#X#GzGzzzGG#V#
#X#GGGGGGGz#V#
#X##########V#
#XVVVVVVEVqVV#
.############.
....#VVVV#....
.############.
#XkXkXkXkXkXV#
#VVVVVVVVVVVV#
.############.`) },
  'Hopper': { rows: g(`
##############
#kjjjjjjjjjih#
#jKKKKKKKKKKh#
#jjjjjjjjjiih#
.#jjiiiiiihh#.
.#jiiiiiiihh#.
..#jiiiiihh#..
..#jiiiiihh#..
...#jiiihh#...
...########...
..#i##ji##h#..
..#h#.##.#h#..
..##......##..`) },
  'Mini-Forge': { glow: true, rows: g(`
......RR......
.....ROOR.....
..###OYYO###..
.#KROYWWYORK#.
#hKKRROORRKKK#
#hhKKKKKKKKKK#
#hKKOKKKKRKKK#
#hKKROKKOOKKK#
#hKKKOYYOKKKK#
#hKKKKYOKKKKK#
#hKKKKORKKKKK#
#KKKKKKKKKKKK#
.############.`) },
  'Mini-Jukebox': { rows: g(`
....######....
..##qqqqqq##..
.#qqEEEEEEpp#.
.#qE######Ep#.
#qE#NNKKNN#Ep#
#qE#NKqKKN#Ep#
#qE#NNKKNN#Ep#
#qE########Ep#
#qEIEzE!EqEEp#
#qE########Ep#
#qE#aKaKaK#Ep#
#qE#KaKaKa#Ep#
#qE########Ep#
#pooooooooooo#
.############.`) },
  'Mini-Obelisk': { rows: g(`
......##......
.....#nl#.....
....#nnml#....
...#nnmmll#...
...########...
....#nmml#....
....#nHIl#....
....#nIHl#....
....#nmml#....
....#nmHl#....
....#nHml#....
....#nmml#....
....#nIHl#....
....#nmml#....
...#nnmmll#...
..#nnmmmmll#..
..##########..`) },
  'Solar Panel': { rows: g(`
################
#NNLLkNNLLkNNLL#
#NLLJkNLLJkNLLJ#
#kkkkkkkkkkkkkk#
#NNLLkNNLLkNNLL#
#NLLJkNLLJkNLLJ#
#kkkkkkkkkkkkkk#
#NNLLkNNLLkNNLL#
#NLLJkNLLJkNLLJ#
################
......#ji#......
......#ji#......
.....#jiih#.....
....########....`) },
  'Bait Maker': { rows: g(`
.....####.....
....#!!!!#....
...##!##!##...
...#jj!iih#...
.############.
#IHHHHHHHHHHG#
#IHHH####HHHG#
#IHH#EEFE#HHG#
#IHH#EEEE#HHG#
#IHH#XXXX#HHG#
#IHH#XXXV#HHG#
#IHHH####HHHG#
#HGGGGGGGGGGG#
.############.
.#K#......#K#.`) },
  'Bone Mill': { rows: g(`
....##.##.....
...#44#44#....
....#444#.....
....#443#.....
.############.
#nnnn#43#nnnm#
#nmmmmmmmmmml#
#nmlmmmmlmmml#
#nmmmmmmmmmml#
#nm########ml#
#nm#X4X44X#ml#
#nm#4X4X44#ml#
#nm########ml#
#mlllllllllll#
.############.`) },
  'Charcoal Kiln': { rows: g(`
......%%......
.....%%%......
.....####.....
....#KKKK#....
..##########..
.#ttssrtssrs#.
#tssrtssrtssr#
#srtssrtssrts#
#tss######ssr#
#sr#KROORK#ts#
#ts#ROYYOR#sr#
#sr#OYWWYO#ts#
#rr########rr#
.############.`) },
  'Crystalarium': { rows: g(`
....######....
...#kjjiih#...
..##########..
..#CBB##BBA#..
..#CX#wv#BA#..
..#CX#wv#BA#..
..#C#wXvu#A#..
..#C#wwvu#A#..
..#C#wvvu#A#..
..#CB#vu#BA#..
..#CBB##BBA#..
.############.
#kjjjjjjjjjih#
#jiiEiiiiqiih#
#ihhhhhhhhhhh#
.############.`) },
  'Worm Bin': { rows: g(`
...####.......
..#!!!!#..##..
..#!##M#.#!M#.
.##!##M###!###
#d6!566M56!5b#
##############
#dccbccbccbca#
#jjkjjjjiiihh#
#dccbccbccbca#
#cbbabbabbaba#
.############.`) },
  'Deluxe Worm Bin': { rows: g(`
...####.......
..#!!!!#..##..
..#!##M#.#!M#.
.##!##M###!###
#d6!566M56!5b#
##############
#dccbccbccbca#
#qqQqqqqpppoo#
#dc########ca#
#dc#65!!56#ca#
#dc#6!56!5#ca#
#dc########ca#
#qqQqqqqpppoo#
#cbbabbabbaba#
.############.`) },
  'Furnace': { rows: g(`
....######....
....#nmml#....
....#nmml#....
..##########..
.#nnmmmmmmml#.
#nmmlmmmmlmml#
#nmm######mml#
#nm#ROOOOR#ml#
#nm#OYYYYO#ml#
#nm#OYWWYO#ml#
#nm#KKKKKK#ml#
#nmm######mml#
#mlllllllllll#
.############.`) },
  'Heavy Furnace': { rows: g(`
...####..####...
...#hK#..#hK#...
...#hK#..#hK#...
.##############.
#mnnnnnnnnnnnml#
#hhhkhhhhhhhhhK#
#lmm########mml#
#lm#ROOOOOOR#ml#
#lm#OYYYYYYO#ml#
#lm#OYWWWWYO#ml#
#lm#OYWWWWYO#ml#
#lm#K#K#K#K##ml#
#lmm########mml#
#hhhkhhhhhhhhhK#
#llllllllllllll#
.##############.`) },
  'Geode Crusher': { rows: g(`
.....####.....
.....#ji#.....
..##########..
..#kjjjjiih#..
..#jiiiihhh#..
..##########..
..Q........Q..
...########...
..#nnwwwwnm#..
.#nnwXwvwvmm#.
.#nmwvvXvuml#.
.############.
#kjjjjjjjjjih#
#ihhhhhhhhhhh#
.############.`) },
  'Lightning Rod': { rows: g(`
......##......
.....#Qq#.....
.....#qp#.....
.....#ji#.....
.....#ji#.....
.....#ji#.....
....######....
...#ttssrr#...
....######....
...#ttssrr#...
....######....
...#ttssrr#...
....######....
.....#ji#.....
.....#ji#.....
.....#ji#.....
.....#ji#.....
.....#ji#.....
.....#ji#.....
....#jiih#....
...#jjiihh#...
..#jjiiiihh#..
..##########..`) },
  'Mushroom Log': { rows: g(`
....###.........
...#FXE#...##...
..#FEEXD#.#21#..
..###X###.#210#.
....#XV#..##X##.
.####XV#####X##.
#dcd#cyycccccbb#
#cbc#cbccccbcba#
#dcd#ccccbcccba#
#cdc#bbcbbbbbaa#
.##############.`) },
  'Recycling Machine': { rows: g(`
.....####.....
.....#CB#.....
....#CBBA#....
.############.
#zyyyyyyyyyyx#
#zy########yx#
#zy#KKKKKK#yx#
#zy########yx#
#zyyyyXXyyyyx#
#zyyyXyyXyyyx#
#zyyXyyyyXyyx#
#zyyXXXXXXyyx#
#zyyyyyyyyyyx#
#yxxxxxxxxxxx#
.############.
.#K#......#K#.`) },
  'Seed Maker': { rows: g(`
...########...
...#qqqppo#...
....#qppo#....
.############.
#UTTTTTTTTTTS#
#UTTzzTTzzTTS#
#UTTTzyyzTTTS#
#UTTTTyyTTTTS#
#UT########TS#
#UT#dKdKdK#TS#
#UT#KdKdKd#TS#
#UT########TS#
#TSSSSSSSSSSS#
.############.
.#K#......#K#.`) },
  'Slime Egg-Press': { rows: g(`
...########...
...#jkjjih#...
...###ji###...
.....#ji#.....
.############.
.#wvvvvvvvvu#.
.#####ji#####.
.#v#.#ji#.#u#.
.#v#jkjjih#u#.
.#v#988887#u#.
.#v98888887u#.
.#v#8#88#7#u#.
.############.
#wvvvvvvvvvuu#
#vuuuuuuuuuuu#
.############.`) },
  'Tapper': { rows: TAPPER },
  'Heavy Tapper': { rows: g(`
..##########..
..#wwwvvvvu#..
..####vu####..
.....#vu#.....
......pq......
.############.
#kjjjjjjjjjih#
#jqqqqqqqqpih#
.#jjjjjiiihh#.
.#wwwwvvvvuu#.
.#jjj####ihh#.
.#jjj#Qq#ihh#.
.#jjj#qp#ihh#.
.#jjj####ihh#.
.#wwwwvvvvuu#.
..#jjiiiihh#..
..##########..`) },
};

const machine: Painter = (img, x, y, w, h, c) => {
  const d = MACHINES[c.name];
  if (!d) return;
  put(img, x, y, w, h, c, d.rows, d.pal ?? P);
  if (d.glow) glow(img, x, y, w, h);
};

/** Painters by item kind. They draw at real size into the box (x, y, w, h). */
export const painters: Record<string, Painter> = {
  sprinkler, scarecrow, rarecrow: scarecrow, machine, chest, lamppost, brazier, torch, jackolantern, crabpot, gardenpot,
};

/** Pixels that a kind rises above its footprint (the sprite box is footprint height + rise). */
export const rise: Record<string, number> = {
  sprinkler: 4, scarecrow: 16, rarecrow: 16, machine: 16, chest: 8, lamppost: 24, brazier: 16, torch: 8,
  jackolantern: 4, crabpot: 4, gardenpot: 4,
};
