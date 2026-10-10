import rawItems from './generated/items.json';
import sprites from './generated/sprites.json';

export type Place = 'object' | 'ground' | 'building' | 'wall' | 'water' | 'crop' | 'tree' | null;

export type Item = {
  id: string;
  name: string;
  cat: string;
  sub: string;
  kind: string;
  w: number;
  h: number;
  place?: Place;
  range?: string;
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
};

export const ITEMS = rawItems as unknown as Item[];
export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
const BY_NAME: Record<string, Item> = {};
for (const it of ITEMS) if (!BY_NAME[it.name.toLowerCase()]) BY_NAME[it.name.toLowerCase()] = it;
export const itemByName = (n: string) => BY_NAME[n.toLowerCase()];

export type SpriteRec = [sheet: number, x: number, y: number, w: number, h: number, ox: number, oy: number];
export const SPRITES = sprites as unknown as {
  cell: number;
  cols: number;
  icons: Record<string, [number, number, number]>;
  world: Record<string, SpriteRec>;
};

export type CategoryMeta = { id: string; label: string; icon: string; placeable: boolean };

/** Categories shown in the planner's item picker, in order. */
export const PLACE_CATEGORIES: CategoryMeta[] = [
  { id: 'buildings', label: 'Buildings', icon: 'barn', placeable: true },
  { id: 'crops', label: 'Crops', icon: 'crop-parsnip', placeable: true },
  { id: 'trees', label: 'Trees', icon: 'tree-apple-tree', placeable: true },
  { id: 'farming', label: 'Farming', icon: 'quality-sprinkler', placeable: true },
  { id: 'machines', label: 'Machines', icon: 'keg', placeable: true },
  { id: 'storage', label: 'Storage', icon: 'chest', placeable: true },
  { id: 'fences', label: 'Fences', icon: 'wood-fence', placeable: true },
  { id: 'flooring', label: 'Floors & Paths', icon: 'cobblestone-path', placeable: true },
  { id: 'lighting', label: 'Lighting', icon: 'iron-lamp-post', placeable: true },
  { id: 'decor', label: 'Decor', icon: 'rarecrow-3', placeable: true },
  { id: 'furniture', label: 'Furniture', icon: 'red-armchair', placeable: true },
  { id: 'fishing', label: 'Water', icon: 'crab-pot', placeable: true },
];

/** All categories for the item index. */
export const ALL_CATEGORIES: CategoryMeta[] = [
  ...PLACE_CATEGORIES,
  { id: 'produce', label: 'Produce', icon: 'pumpkin', placeable: false },
  { id: 'seeds', label: 'Seeds', icon: 'parsnip-seeds', placeable: false },
  { id: 'forage', label: 'Forage', icon: 'daffodil', placeable: false },
  { id: 'fish', label: 'Fish', icon: 'pufferfish', placeable: false },
  { id: 'artisan', label: 'Artisan', icon: 'wine', placeable: false },
  { id: 'cooking', label: 'Cooking', icon: 'pizza', placeable: false },
  { id: 'minerals', label: 'Minerals', icon: 'emerald', placeable: false },
  { id: 'artifacts', label: 'Artifacts', icon: 'ancient-doll', placeable: false },
  { id: 'resources', label: 'Resources', icon: 'wood', placeable: false },
  { id: 'tools', label: 'Tools', icon: 'iridium-pickaxe', placeable: false },
  { id: 'weapons', label: 'Weapons', icon: 'galaxy-sword', placeable: false },
  { id: 'rings', label: 'Rings', icon: 'iridium-band', placeable: false },
  { id: 'hats', label: 'Hats', icon: 'cowboy-hat', placeable: false },
  { id: 'footwear', label: 'Footwear', icon: 'space-boots', placeable: false },
  { id: 'trinkets', label: 'Trinkets', icon: 'fairy-box', placeable: false },
  { id: 'books', label: 'Books', icon: 'stardew-valley-almanac', placeable: false },
  { id: 'consumables', label: 'Consumables', icon: 'mega-bomb', placeable: false },
  { id: 'animals', label: 'Animals', icon: 'animal-white-cow', placeable: false },
  { id: 'special', label: 'Special', icon: 'stardrop', placeable: false },
  { id: 'misc', label: 'Misc', icon: 'golden-egg', placeable: false },
];
export const CATEGORY_BY_ID: Record<string, CategoryMeta> = Object.fromEntries(ALL_CATEGORIES.map((c) => [c.id, c]));

export function categoryIcon(c: CategoryMeta) {
  if (SPRITES.icons[c.icon]) return c.icon;
  return ITEMS.find((i) => i.cat === c.id)?.id ?? ITEMS[0].id;
}

export const PLACEABLE = ITEMS.filter((i) => !!i.place);

export function itemsIn(cat: string) {
  return ITEMS.filter((i) => i.cat === cat);
}

export function subcategories(list: Item[]) {
  const seen = new Map<string, number>();
  for (const it of list) seen.set(it.sub, (seen.get(it.sub) ?? 0) + 1);
  return [...seen.keys()];
}

// ---------------------------------------------------------------- search
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const INDEX = ITEMS.map((it) => ({
  it,
  name: norm(it.name),
  hay: norm([it.name, it.sub, it.cat, CATEGORY_BY_ID[it.cat]?.label ?? '', ...(it.tags ?? []), ...(it.seasons ?? []), it.src ?? ''].join(' ')),
}));

/** Ranked search: exact > prefix > word-prefix > substring > fuzzy subsequence; all words must match. */
export function searchItems(query: string, pool?: (it: Item) => boolean): Item[] {
  const q = norm(query);
  const base = pool ? INDEX.filter((e) => pool(e.it)) : INDEX;
  if (!q) return base.map((e) => e.it);
  const words = q.split(' ');
  const scored: [number, Item][] = [];
  for (const e of base) {
    let score = 0;
    let ok = true;
    for (const w of words) {
      let s = 0;
      if (e.name === w) s = 100;
      else if (e.name.startsWith(w)) s = 60;
      else if ((' ' + e.name).includes(' ' + w)) s = 45;
      else if (e.name.includes(w)) s = 30;
      else if ((' ' + e.hay).includes(' ' + w)) s = 18;
      else if (e.hay.includes(w)) s = 10;
      else if (w.length > 2 && subseq(w, e.name)) s = 4;
      if (!s) { ok = false; break; }
      score += s;
    }
    if (q === e.name) score += 200;
    if (ok) scored.push([score - e.name.length * 0.05, e.it]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.map((s) => s[1]);
}

function subseq(needle: string, hay: string) {
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j++) if (hay[j] === needle[i]) i++;
  return i === needle.length;
}

export function money(n?: number | null) {
  if (n === undefined || n === null) return '';
  return `${n.toLocaleString('en-US')}g`;
}
