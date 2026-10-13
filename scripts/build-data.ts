/**
 * Builds src/data/generated/items.json — the unified, searchable item index.
 *
 * Sources: the MIT-licensed `stardew-valley-data` npm package (structured facts only —
 * names, prices, seasons, recipes) plus scripts/supplemental.ts. No game artwork or
 * flavor text is copied; summaries are generated from the facts.
 *
 * Run: npm run gen:data
 */
import fs from 'node:fs';
import path from 'node:path';
import { BUILDING_SIZES, EXTRA_PLACEABLES, FURNITURE, GROUND_TILES, RANGES } from './supplemental';
import { EXTRA_BUILDINGS, EXTRA_CROPS, EXTRA_FURNITURE, EXTRA_GROUPS, EXTRA_TREES } from './supplemental-extra';

const DATA = path.join(__dirname, '..', 'node_modules', 'stardew-valley-data', 'data');
const OUT = path.join(__dirname, '..', 'src', 'data', 'generated', 'items.json');

const load = (f: string): any => JSON.parse(fs.readFileSync(path.join(DATA, f + '.json'), 'utf8'));

export type Place = 'object' | 'ground' | 'building' | 'wall' | 'water' | 'crop' | 'tree' | null;

export type Item = {
  id: string;
  name: string;
  cat: string;
  sub: string;
  kind: string;
  w: number;
  h: number;
  place: Place;
  range?: string;
  /** Short factual summary. */
  d: string;
  sell?: number;
  buy?: number;
  seasons?: string[];
  src?: string;
  mats?: [string, number][];
  gold?: number;
  grow?: number;
  regrow?: number | null;
  trellis?: boolean;
  tall?: number;
  tags?: string[];
  /** Game ids, used to read game save files: harvest/sapling id and seed id. */
  legacy?: boolean;
  gid?: string;
  sid?: string;
};

const slug = (s: string) =>
  s.toLowerCase().replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const items = new Map<string, Item>();

function add(it: Omit<Item, 'id'> & { id?: string }) {
  const id = it.id ?? slug(it.name);
  const prev = items.get(id);
  if (prev) {
    // Merge: keep the first (more specific) record, fill gaps from the new one.
    for (const [k, v] of Object.entries(it)) {
      if (v === undefined || v === null) continue;
      const cur = (prev as any)[k];
      if (cur === undefined || cur === null || cur === '') (prev as any)[k] = v;
    }
    return prev;
  }
  const full: Item = { ...it, id } as Item;
  items.set(id, full);
  return full;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const seasonText = (s?: string[]) => (s && s.length ? s.map(cap).join(', ') : '');
const g = (n?: number | null) => (n || n === 0 ? `${n.toLocaleString('en-US')}g` : '');
const matsText = (m?: [string, number][]) => (m && m.length ? m.map(([n, q]) => `${q} ${n}`).join(', ') : '');

// ---------------------------------------------------------------- Buildings
for (const b of load('buildings')) {
  const size = BUILDING_SIZES[b.name] ?? { w: 3, h: 3, tall: 2 };
  const mats: [string, number][] = (b.materials ?? []).map((m: any) => [m.item, m.quantity]);
  add({
    name: b.name,
    cat: 'buildings',
    sub: b.magical ? 'Magical' : b.animalCapacity ? 'Animal' : 'Farm',
    kind: 'building',
    w: size.w,
    h: size.h,
    tall: size.tall,
    place: 'building',
    range: RANGES[b.name],
    gold: b.buildCost ?? undefined,
    mats,
    src: b.builder ? `Built by ${b.builder}${b.buildDays ? ` in ${b.buildDays} day${b.buildDays > 1 ? 's' : ''}` : ' instantly'}` : undefined,
    d: [
      `${size.w}×${size.h} building`,
      b.animalCapacity ? `houses up to ${b.animalCapacity} animals` : '',
      b.upgradeFrom ? `upgrade of ${String(b.upgradeFrom).replace(/-/g, ' ')}` : '',
    ].filter(Boolean).join(', ') + '.',
  });
}
{
  const fh = BUILDING_SIZES['Farmhouse'];
  add({ name: 'Farmhouse', cat: 'buildings', sub: 'Farm', kind: 'building', w: fh.w, h: fh.h, tall: fh.tall, place: 'building', d: 'Your home. Upgraded by Robin; one per farm.' });
}

for (const [name, b] of Object.entries(EXTRA_BUILDINGS)) {
  add({ name, cat: 'buildings', sub: b.sub, kind: 'building', w: b.w, h: b.h, tall: b.tall, place: 'building', d: b.d });
}

// ---------------------------------------------------------------- Crops (placeable) + produce/seeds (catalog)
for (const c of load('crops')) {
  if (c.name === 'Fiber') {
    add({ name: 'Fiber Plant', cat: 'crops', sub: 'Special', kind: 'crop', w: 1, h: 1, place: 'crop', seasons: ['spring', 'summer', 'fall', 'winter'], grow: c.growDays, d: 'Grown from Fiber Seeds in any season.' });
    continue;
  }
  if (c.name === 'Tea Leaves') continue; // Tea Bush is handled below.
  const sub = c.category === 'flower' ? 'Flowers' : c.category === 'fruit' ? 'Fruits' : c.category === 'vegetable' ? 'Vegetables' : 'Special';
  const buy = c.seedBuyPrices?.[0]?.price;
  const src = (c.seedBuyPrices ?? []).map((p: any) => `${p.place} (${g(p.price)})`).join(', ');
  const cropName = c.name === 'Coffee Bean' ? 'Coffee Plant' : c.name;
  add({
    id: 'crop-' + slug(cropName),
    name: cropName,
    cat: 'crops',
    sub,
    kind: 'crop',
    w: 1,
    h: 1,
    place: 'crop',
    seasons: c.seasons,
    gid: c.id ? String(c.id) : undefined,
    sid: c.seedId ? String(c.seedId) : undefined,
    grow: c.growDays,
    regrow: c.regrowDays,
    trellis: c.trellis,
    sell: c.cropSellPrice,
    buy,
    src: src ? `Seeds: ${src}` : undefined,
    tags: [c.seedName, c.giant ? 'giant crop' : '', c.trellis ? 'trellis' : ''].filter(Boolean),
    d: [
      `${seasonText(c.seasons)} crop`,
      c.growDays ? `matures in ${c.growDays} days` : '',
      c.regrowDays ? `regrows every ${c.regrowDays} days` : '',
      c.trellis ? 'grows on a trellis (blocks walking)' : '',
      c.giant ? 'can become a giant crop' : '',
    ].filter(Boolean).join(', ') + '.',
  });
  add({
    name: c.name, cat: 'produce', sub, kind: c.category === 'flower' ? 'flower' : 'produce', w: 1, h: 1, place: null,
    sell: c.cropSellPrice, seasons: c.seasons,
    d: `${cap(c.category)} harvested from ${c.seedName}. Sells for ${g(c.cropSellPrice)}.`,
  });
  if (c.seedName) {
    add({
      name: c.seedName, cat: 'seeds', sub: 'Seeds', kind: 'seed', w: 1, h: 1, place: null,
      sell: c.seedSellPrice, buy, seasons: c.seasons, src: src || undefined,
      d: `Plant in ${seasonText(c.seasons) || 'season'}. Grows into ${c.name} in ${c.growDays} days.`,
    });
  }
}
add({ id: 'crop-tea-bush', name: 'Tea Bush', cat: 'crops', sub: 'Special', kind: 'teabush', w: 1, h: 1, place: 'crop', seasons: ['spring', 'summer', 'fall'], grow: 20, d: 'Planted from a Tea Sapling. Produces Tea Leaves the last 7 days of spring, summer and fall. Does not need watering.' });
add({ id: 'crop-mixed-seeds', name: 'Mixed Crop', cat: 'crops', sub: 'Special', kind: 'crop', w: 1, h: 1, place: 'crop', d: 'Placeholder for a crop grown from Mixed Seeds.' });
add({ name: 'Trellis Marker', cat: 'crops', sub: 'Special', kind: 'trellis', w: 1, h: 1, place: 'crop', d: 'Marks a tile reserved for a trellis crop (Hops, Grape, Green Bean).' });

for (const c of EXTRA_CROPS) {
  add({ id: 'crop-' + slug(c.name), name: c.name, cat: 'crops', sub: c.sub, kind: c.kind, w: c.w, h: c.w, place: 'crop', seasons: c.seasons, d: c.d });
}

// ---------------------------------------------------------------- Trees
for (const name of EXTRA_TREES) {
  add({ id: 'tree-' + slug(name), name, cat: 'trees', sub: 'Wild Trees', kind: 'tree', w: 1, h: 1, tall: 5, place: 'tree', d: 'Wild tree that grows after green rain. Covered in moss and ferns.' });
}
for (const t of load('trees')) {
  // Wiki: the fern tree is Green Rain Tree type 3. It is added below with the other two types.
  if (t.name === 'Fiddlehead Stalk') continue;
  const fruit = t.type === 'fruit-tree';
  add({
    id: 'tree-' + slug(t.name),
    name: t.name,
    cat: 'trees',
    sub: fruit ? 'Fruit Trees' : 'Wild Trees',
    kind: fruit ? 'fruittree' : 'tree',
    w: 1,
    h: 1,
    tall: fruit ? 4 : 5,
    place: 'tree',
    gid: fruit && t.saplingId ? String(t.saplingId) : undefined,
    seasons: t.seasons ?? undefined,
    buy: t.saplingBuyPrices?.[0]?.price,
    sell: t.saplingSellPrice,
    grow: t.daysToMature,
    src: (t.saplingBuyPrices ?? []).map((p: any) => `${p.place} (${g(p.price)})`).join(', ') || undefined,
    tags: [t.saplingName].filter(Boolean),
    d: fruit
      ? `Fruit tree. Matures in ${t.daysToMature} days and fruits in ${seasonText(t.seasons)}. Needs the surrounding 8 tiles clear to grow.`
      : `Wild tree. ${t.daysToMature ? `Matures in about ${t.daysToMature} days. ` : ''}Can be tapped for syrup or resin.`,
  });
  if (t.saplingName) {
    add({ name: t.saplingName, cat: 'seeds', sub: fruit ? 'Saplings' : 'Tree Seeds', kind: fruit ? 'sapling' : 'treeseed', w: 1, h: 1, place: null, buy: t.saplingBuyPrices?.[0]?.price, sell: t.saplingSellPrice, d: `Plants a ${t.name}.` });
  }
}

// ---------------------------------------------------------------- Crafting (placeables + consumables)
const CRAFT_CAT: Record<string, { cat: string; sub: string; kind: string; place: Place }> = {
  'Sprinklers': { cat: 'farming', sub: 'Sprinklers', kind: 'sprinkler', place: 'object' },
  'Farming': { cat: 'farming', sub: 'Farming', kind: 'scarecrow', place: 'object' },
  'Artisan Equipment': { cat: 'machines', sub: 'Artisan', kind: 'machine', place: 'object' },
  'Refining Equipment': { cat: 'machines', sub: 'Refining', kind: 'machine', place: 'object' },
  'Storage': { cat: 'storage', sub: 'Storage', kind: 'chest', place: 'object' },
  'Lighting': { cat: 'lighting', sub: 'Lighting', kind: 'light', place: 'object' },
  'Fences': { cat: 'fences', sub: 'Fences', kind: 'fence', place: 'object' },
  'Flooring': { cat: 'flooring', sub: 'Floors', kind: 'floor', place: 'ground' },
  'Paths': { cat: 'flooring', sub: 'Paths', kind: 'path', place: 'ground' },
  'Signs': { cat: 'decor', sub: 'Signs', kind: 'sign', place: 'object' },
  'Decor': { cat: 'decor', sub: 'Decor', kind: 'decor', place: 'object' },
  'Instruments': { cat: 'decor', sub: 'Instruments', kind: 'block', place: 'object' },
  'Misc': { cat: 'machines', sub: 'Misc', kind: 'machine', place: 'object' },
  'Fishing': { cat: 'fishing', sub: 'Bait & Tackle', kind: 'tackle', place: null },
  'Bombs': { cat: 'consumables', sub: 'Bombs', kind: 'bomb', place: null },
  'Totems': { cat: 'consumables', sub: 'Totems', kind: 'totem', place: null },
  'Rings': { cat: 'rings', sub: 'Crafted Rings', kind: 'ring', place: null },
  'Combat': { cat: 'consumables', sub: 'Combat', kind: 'potion', place: null },
  'Food': { cat: 'cooking', sub: 'Crafted Food', kind: 'food', place: null },
  'Seeds & Fertilizer': { cat: 'seeds', sub: 'Fertilizer & Seeds', kind: 'fertilizer', place: null },
};
const NON_PLACEABLE_MISC = new Set(['Staircase', 'Transmute (Au)', 'Transmute (Fe)', 'Cookout Kit', 'Tent Kit']);
for (const c of load('crafting')) {
  const m = CRAFT_CAT[c.category] ?? { cat: 'misc', sub: c.category, kind: 'misc', place: null };
  let { cat, sub, kind, place } = m;
  let name: string = c.name;
  if (name === 'Oil Of Garlic') name = 'Oil of Garlic';
  if (name === 'Statue Of Blessings') name = 'Statue of Blessings';
  if (name === 'Statue Of The Dwarf King') name = 'Statue of the Dwarf King';
  if (c.category === 'Farming') {
    if (/Scarecrow/.test(name)) { sub = 'Scarecrows'; kind = 'scarecrow'; }
    else if (name === 'Garden Pot') kind = 'gardenpot';
    else if (name === 'Hopper') { cat = 'machines'; sub = 'Misc'; kind = 'machine'; }
    else if (name === "Tub o' Flowers") { cat = 'decor'; sub = 'Decor'; kind = 'flowertub'; }
  }
  if (c.category === 'Fishing' && name === 'Crab Pot') { cat = 'fishing'; sub = 'Crab Pots'; kind = 'crabpot'; place = 'water'; }
  if (c.category === 'Fences' && name === 'Gate') kind = 'gate';
  if (c.category === 'Seeds & Fertilizer' && /Seed|Sapling|Starter/.test(name)) kind = 'seed';
  if (NON_PLACEABLE_MISC.has(name)) { cat = 'consumables'; sub = 'Misc'; kind = 'misc'; place = null; }
  if (/Lamp-post/.test(name)) kind = 'lamppost';
  if (/Brazier|Campfire/.test(name)) kind = 'brazier';
  if (name === 'Torch') kind = 'torch';
  if (name === 'Jack-O-Lantern') kind = 'jackolantern';
  const mats: [string, number][] = (c.ingredients ?? []).map((i: any) => [i.name, i.quantity]);
  add({
    name, cat, sub, kind, w: 1, h: 1, place,
    range: RANGES[name],
    mats,
    src: c.source ? `Recipe: ${c.source}` : undefined,
    d: craftSummary(name, sub, mats),
  });
}

function craftSummary(name: string, sub: string, mats: [string, number][]) {
  const r = RANGES[name];
  const rangeText: Record<string, string> = {
    spr1: 'Waters the 4 adjacent tiles each morning',
    spr2: 'Waters the 8 surrounding tiles each morning',
    spr3: 'Waters a 5×5 area (24 tiles) each morning',
    spr4: 'Waters a 7×7 area (48 tiles) each morning',
    scare8: 'Protects crops within an 8-tile radius from crows',
    scare16: 'Protects crops within a 16-tile radius from crows',
    bee: 'Makes honey; flowers within 5 tiles flavor it',
    log: 'Grows mushrooms; nearby trees improve output',
  };
  const parts = [r ? rangeText[r] : `${sub.replace(/s$/, '')} item`];
  if (mats.length) parts.push(`Crafted from ${matsText(mats)}`);
  return parts.join('. ') + '.';
}

// Fences: give HP/durability-free footprints; Gate is a fence-like piece.
// ---------------------------------------------------------------- Supplemental furniture + placeables
for (const grp of [...FURNITURE, ...EXTRA_PLACEABLES, ...EXTRA_FURNITURE, ...EXTRA_GROUPS]) {
  for (const entry of grp.items) {
    const [name, w, h] = entry.split('|');
    const W = w ? Number(w) : grp.w;
    const H = h ? Number(h) : grp.h;
    add({
      name, cat: grp.cat, sub: grp.sub, kind: grp.kind, w: W, h: H, place: grp.place,
      range: RANGES[name],
      src: grp.source,
      d: grp.cat === 'furniture'
        ? `${grp.sub.replace(/s$/, '').replace(/ie$/, 'y')} furniture, ${W}×${H} tiles.${grp.place === 'wall' ? ' Hangs on a wall.' : ''}`
        : `${grp.sub.replace(/s$/, '')}, ${W}×${H} tile${W * H > 1 ? 's' : ''}.${RANGES[name]?.startsWith('scare') ? ' Works like a Scarecrow (8-tile radius).' : ''}`,
    });
  }
}
for (const gt of GROUND_TILES) {
  add({ name: gt.name, cat: 'flooring', sub: 'Ground', kind: gt.kind, w: 1, h: 1, place: 'ground', d: gt.desc });
}

// ---------------------------------------------------------------- Catalog-only collections
for (const f of load('fish')) {
  add({
    name: f.name, cat: 'fish', sub: f.catchType === 'crab-pot' ? 'Crab Pot' : f.category?.startsWith('legendary') ? 'Legendary' : f.category === 'night-market' ? 'Night Market' : 'Fishing',
    kind: f.catchType === 'crab-pot' ? 'shellfish' : 'fish', w: 1, h: 1, place: null,
    sell: f.sellPrice, seasons: f.seasons,
    d: [
      `Found in ${Array.isArray(f.location) ? f.location.join(', ') : f.location ?? 'various waters'}`,
      f.seasons?.length ? `during ${seasonText(f.seasons)}` : '',
      f.time ? `(${Array.isArray(f.time) ? f.time.join(', ') : f.time})` : '',
      f.weather ? `in ${Array.isArray(f.weather) ? f.weather.join('/') : f.weather} weather` : '',
    ].filter(Boolean).join(' ') + '.',
    tags: [f.difficulty ? `difficulty ${f.difficulty}` : ''].filter(Boolean),
  });
}
for (const m of load('minerals')) {
  const sub = { bar: 'Bars', geode: 'Geodes', mineral: 'Minerals', resource: 'Resources', ore: 'Ores', node: 'Nodes' }[m.kind as string] ?? 'Minerals';
  add({
    name: m.name, cat: 'minerals', sub, kind: m.kind === 'bar' ? 'bar' : m.kind === 'geode' ? 'geode' : m.kind === 'ore' ? 'ore' : m.kind === 'node' ? 'node' : m.kind === 'resource' ? 'resource' : 'gem',
    w: 1, h: 1, place: null, sell: m.sellPrice,
    d: `${sub.replace(/s$/, '')}${m.locations?.length ? `. Found: ${[].concat(m.locations).slice(0, 4).join(', ')}` : ''}.`,
  });
}
for (const a of load('artifacts')) {
  add({ name: a.name, cat: 'artifacts', sub: 'Artifacts', kind: 'artifact', w: 1, h: 1, place: null, sell: a.sellPrice, d: `Artifact for the Museum${a.locations?.length ? `. Found: ${[].concat(a.locations).slice(0, 4).join(', ')}` : ''}.` });
}
for (const c of load('cooking')) {
  const ing: [string, number][] = (c.ingredients ?? []).map((i: any) => [i.name, i.quantity]);
  add({ name: c.name, cat: 'cooking', sub: 'Dishes', kind: 'food', w: 1, h: 1, place: null, sell: c.sellPrice, mats: ing, d: `Cooked dish. Ingredients: ${matsText(ing)}.` });
}
for (const a of load('artisan-goods')) {
  add({ name: a.name, cat: 'artisan', sub: 'Artisan Goods', kind: 'artisan', w: 1, h: 1, place: null, sell: typeof a.sellPrice === 'number' ? a.sellPrice : undefined, d: `Artisan good${a.equipment ? ` made in a ${a.equipment}` : ''}.` });
}
for (const f of load('forageables')) {
  add({ name: f.name, cat: 'forage', sub: 'Forage', kind: 'forage', w: 1, h: 1, place: null, sell: f.sellPrice, seasons: f.seasons, d: `Forageable${f.seasons?.length ? ` in ${seasonText(f.seasons)}` : ''}${f.locations?.length ? `. Found: ${[].concat(f.locations).slice(0, 4).join(', ')}` : ''}.` });
}
for (const h of load('hats')) add({ name: h.name, cat: 'hats', sub: 'Hats', kind: 'hat', w: 1, h: 1, place: null, d: h.obtain ? `Hat. ${String(h.obtain).split('.')[0]}.` : 'Wearable hat.' });
for (const f of load('footwear')) add({ name: f.name, cat: 'footwear', sub: 'Boots', kind: 'boots', w: 1, h: 1, place: null, sell: f.sellPrice, d: `Footwear. +${f.defense ?? 0} defense, +${f.immunity ?? 0} immunity.` });
for (const r of load('rings')) add({ name: r.name, cat: 'rings', sub: 'Rings', kind: 'ring', w: 1, h: 1, place: null, sell: r.sellPrice, d: 'Ring. Can be equipped in one of two ring slots.' });
for (const wpn of load('weapons')) add({ name: wpn.name, cat: 'weapons', sub: cap(String(wpn.type ?? 'weapon')), kind: wpn.type === 'dagger' ? 'dagger' : wpn.type === 'club' ? 'club' : wpn.type === 'slingshot' ? 'slingshot' : 'sword', w: 1, h: 1, place: null, sell: wpn.sellPrice, d: `${cap(String(wpn.type ?? 'weapon'))}. Damage ${wpn.damageMin ?? '?'}–${wpn.damageMax ?? '?'}${wpn.level ? `, level ${wpn.level}` : ''}.` });
for (const t of load('tools')) {
  if (t.levels && t.type === 'upgradeable') {
    for (const tier of ['', 'Copper ', 'Steel ', 'Gold ', 'Iridium '].slice(0, t.levels.length)) {
      add({ name: tier + t.name, cat: 'tools', sub: t.name, kind: 'tool', w: 1, h: 1, place: null, d: `${tier ? tier.trim() + '-tier' : 'Basic'} ${t.name.toLowerCase()}. Upgraded at Clint's.` });
    }
  } else if (t.type === 'fishing-rod') {
    for (const l of t.levels) add({ name: l.name, cat: 'tools', sub: 'Fishing Rods', kind: 'rod', w: 1, h: 1, place: null, d: 'Fishing rod sold by Willy.' });
  } else {
    add({ name: t.name, cat: 'tools', sub: t.type === 'backpack' ? 'Backpacks' : 'Tools', kind: t.type === 'backpack' ? 'backpack' : 'tool', w: 1, h: 1, place: null, d: 'Tool.' });
  }
}
for (const t of load('trinkets')) add({ name: t.name, cat: 'trinkets', sub: 'Trinkets', kind: 'trinket', w: 1, h: 1, place: null, sell: t.sellPrice, d: `Trinket${t.forgeable ? ' (can be re-forged)' : ''}.` });
for (const b of load('bait')) add({ name: b.name, cat: 'fishing', sub: 'Bait', kind: 'bait', w: 1, h: 1, place: null, sell: b.sellPrice, d: 'Fishing bait.' });
for (const t of load('tackle')) add({ name: t.name, cat: 'fishing', sub: 'Tackle', kind: 'tackle', w: 1, h: 1, place: null, sell: t.sellPrice, d: 'Fishing tackle; attaches to a rod.' });
for (const b of load('lost-books')) add({ name: b.name, cat: 'books', sub: 'Lost Books', kind: 'book', w: 1, h: 1, place: null, d: 'Lost Book for the Library.' });
for (const b of load('bookseller-shop').items) add({ name: b.name, cat: 'books', sub: 'Power Books', kind: 'book', w: 1, h: 1, place: null, d: 'Book sold by the traveling Bookseller.' });
for (const s of load('special-items')) add({ name: s.name, cat: 'special', sub: 'Special Items', kind: 'special', w: 1, h: 1, place: null, d: 'Special item kept in your wallet or inventory.' });
for (const s of load('stardrops')) add({ name: s.name, cat: 'special', sub: 'Stardrops', kind: 'stardrop', w: 1, h: 1, place: null, d: `Permanently increases max energy.${s.source ? ` Source: ${String(s.source).split('.')[0]}.` : ''}` });
for (const m of load('monster-loot')) add({ name: m.name, cat: 'resources', sub: 'Monster Loot', kind: 'loot', w: 1, h: 1, place: null, sell: m.sellPrice, d: 'Dropped by monsters.' });
for (const a of load('animals')) {
  const nm = a.variant ? `${a.name} (${a.variant})` : a.name;
  add({ id: 'animal-' + slug(nm), name: nm, cat: 'animals', sub: a.type === 'pet' ? 'Pets' : 'Farm Animals', kind: 'animal', w: 1, h: 1, place: null, buy: a.purchasePrice ?? undefined, d: a.type === 'pet' ? 'Pet.' : `Farm animal${a.purchasePrice ? `, sold by Marnie for ${g(a.purchasePrice)}` : ''}.` });
}
for (const s of [...load('pierre-shop'), ...load('joja-shop'), ...load('krobus-shop'), ...load('qi-shop'), ...load('marnie-shop'), ...load('willy-shop'), ...load('oasis-shop'), ...load('dwarf-shop'), ...load('desert-trader-shop'), ...load('island-trader-shop'), ...load('casino-shop'), ...load('guild-shop'), ...load('carpenter-shop')]) {
  if (s.isRecipe || /Recipe/.test(s.name)) continue;
  const id = slug(s.name);
  if (items.has(id)) {
    const it = items.get(id)!;
    if (!it.buy && typeof s.price === 'number') it.buy = s.price;
    continue;
  }
  if (s.category === 'furniture') {
    add({ name: s.name, cat: 'furniture', sub: 'Decorative', kind: 'decor', w: 1, h: 1, place: 'object', buy: s.price, d: 'Furniture.' });
    continue;
  }
  add({ name: s.name, cat: 'misc', sub: 'Shop Items', kind: 'misc', w: 1, h: 1, place: null, buy: typeof s.price === 'number' ? s.price : undefined, d: 'Item sold in shops.' });
}
// Raw resources that might be missing.
for (const [n, sell] of [['Wood', 2], ['Stone', 2], ['Hardwood', 15], ['Fiber', 1], ['Clay', 20], ['Sap', 2], ['Coal', 15], ['Battery Pack', 500], ['Refined Quartz', 50], ['Moss', 5], ['Mystic Syrup', 1000]] as const) {
  if (!items.has(slug(n))) add({ name: n, cat: 'resources', sub: 'Resources', kind: 'resource', w: 1, h: 1, place: null, sell, d: 'Crafting resource.' });
}

// ---------------------------------------------------------------- Post-process
// Bundles: tag items with the bundles they belong to so search for "bundle" works.
for (const b of load('bundles')) {
  for (const bi of b.items ?? []) {
    const it = items.get(slug(bi.name ?? bi.item ?? ''));
    if (it) (it.tags ??= []).includes('bundle') || it.tags!.push('bundle');
  }
}

// These early placeholder names are not game furniture. Keep their IDs readable
// in existing plans, but never offer them when making a new plan.
for (const id of ['pickle-jar-beauty', 'circular-rug']) {
  const item = items.get(id);
  if (item) item.legacy = true;
}
// Animal Catalogue is a power book, not a placeable furniture catalogue.
const animalCatalogue = items.get('animal-catalogue');
if (animalCatalogue) Object.assign(animalCatalogue, {
  cat: 'books', sub: 'Power Books', kind: 'book', place: null,
  d: "Read to access Marnie's shop when she is away from the counter. Available from Year 2.",
});

const list = [...items.values()].sort((a, b) => a.cat.localeCompare(b.cat) || a.sub.localeCompare(b.sub) || a.name.localeCompare(b.name));
for (const it of list) {
  for (const k of Object.keys(it) as (keyof Item)[]) {
    const v = it[k] as any;
    if (v === undefined || v === null || (Array.isArray(v) && v.length === 0) || v === '') delete it[k];
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(list));
const byCat: Record<string, number> = {};
for (const it of list) byCat[it.cat] = (byCat[it.cat] ?? 0) + 1;
console.log(`Wrote ${list.length} items to ${path.relative(process.cwd(), OUT)}`);
console.log(byCat);
console.log('placeable:', list.filter((i) => i.place).length);
