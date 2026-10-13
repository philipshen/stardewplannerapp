/**
 * Reads a Stardew Valley save file (XML) and builds a plan from the Farm location.
 * Only positions and item names/ids are read. The app's farm maps are approximations,
 * so imported items keep their game coordinates and ignore terrain rules.
 */
import { Item, ITEM_BY_ID, ITEMS, itemByName } from '../data/items';
import { MAP_BY_ID } from '../data/maps';
import { buildOcc, canPlace, key, layerOf, Placed, Plan, uid } from '../planner/model';
import type { Season } from '../theme';

// ---------------------------------------------------------------- tiny XML reader
export type XNode = { tag: string; type?: string; kids: XNode[]; text: string };

const ENT: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENT[m]);

/** Non-validating parser: tags, the xsi:type attribute and text. Enough for save files. */
export function parseXml(src: string): XNode {
  const root: XNode = { tag: '#root', kids: [], text: '' };
  const stack: XNode[] = [root];
  const re = /<([^>]+)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m.index > last && !top.kids.length) top.text += src.slice(last, m.index);
    last = re.lastIndex;
    const body = m[1];
    if (body[0] === '?' || body[0] === '!') continue;
    if (body[0] === '/') {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const selfClose = body[body.length - 1] === '/';
    const sp = body.search(/[\s/]/);
    const tag = sp < 0 ? body : body.slice(0, sp);
    const type = /xsi:type="([^"]*)"/.exec(body)?.[1];
    const node: XNode = { tag, type, kids: [], text: '' };
    top.kids.push(node);
    if (!selfClose) stack.push(node);
  }
  return root;
}

const kid = (n: XNode | undefined, tag: string) => n?.kids.find((k) => k.tag === tag);
const kids = (n: XNode | undefined, tag: string) => n?.kids.filter((k) => k.tag === tag) ?? [];
const txt = (n: XNode | undefined, tag: string) => {
  const k = kid(n, tag);
  return k ? decode(k.text.trim()) : undefined;
};
/** Net fields are sometimes wrapped, for example <tileX><int>5</int></tileX>. */
const num = (n: XNode | undefined, tag: string) => {
  const k = kid(n, tag);
  if (!k) return undefined;
  const raw = k.kids.length ? k.kids[0].text : k.text;
  const v = Number(raw.trim());
  return Number.isFinite(v) ? v : undefined;
};
function vec(n: XNode | undefined): [number, number] | null {
  if (!n) return null;
  const v = kid(n, 'Vector2') ?? n;
  const x = num(v, 'X'), y = num(v, 'Y');
  return x === undefined || y === undefined ? null : [Math.round(x), Math.round(y)];
}

// ---------------------------------------------------------------- game id tables
const FARM_TYPES = ['standard', 'riverland', 'forest', 'hilltop', 'wilderness', 'four-corners', 'beach', 'meadowlands'];
const FLOORS = ['wood-floor', 'stone-floor', 'weathered-floor', 'crystal-floor', 'straw-floor', 'gravel-path', 'wood-path', 'crystal-path', 'cobblestone-path', 'stepping-stone-path', 'brick-floor', 'rustic-plank-floor', 'stone-walkway-floor'];
const TREES: Record<string, string> = {
  '1': 'tree-oak-tree', '2': 'tree-maple-tree', '3': 'tree-pine-tree', '6': 'tree-palm-tree', '7': 'tree-mushroom-tree', '8': 'tree-mahogany-tree', '9': 'tree-palm-tree',
  '10': 'tree-green-rain-tree-1', '11': 'tree-green-rain-tree-2', '12': 'tree-green-rain-tree-3', '13': 'tree-mystic-tree',
};
/** Fruit tree indexes used by saves made before game version 1.6. */
const OLD_FRUIT_TREES = ['tree-cherry-tree', 'tree-apricot-tree', 'tree-orange-tree', 'tree-peach-tree', 'tree-pomegranate-tree', 'tree-apple-tree', '', 'tree-banana-tree', 'tree-mango-tree'];
const CLUMPS: Record<string, string> = { '600': 'large-stump', '602': 'large-log', '672': 'large-rock', '622': 'meteorite' };
const GIANT: Record<string, string> = {
  '190': 'crop-giant-cauliflower', '254': 'crop-giant-melon', '276': 'crop-giant-pumpkin',
  cauliflower: 'crop-giant-cauliflower', melon: 'crop-giant-melon', pumpkin: 'crop-giant-pumpkin', powdermelon: 'crop-giant-powdermelon', qifruit: 'crop-giant-qi-fruit',
};
const NAME_ALIAS: Record<string, string> = {
  'weathered floor': 'Weathered Floor', 'log cabin': 'Log Cabin', 'stone cabin': 'Stone Cabin', 'plank cabin': 'Plank Cabin', cabin: 'Cabin',
  'twig': 'Twig', 'stone': 'Stone Debris', 'weeds': 'Weeds',
};

const BY_GID: Record<string, Item> = {};
const BY_SID: Record<string, Item> = {};
for (const it of ITEMS) {
  if (it.gid && !BY_GID[it.gid]) BY_GID[it.gid] = it;
  if (it.sid && !BY_SID[it.sid]) BY_SID[it.sid] = it;
}
/** Ids can be bare ("24") or qualified ("(O)24"). */
const bare = (s?: string) => (s ?? '').replace(/^\([A-Z]+\)/, '').trim();

function placeable(name?: string): Item | undefined {
  if (!name) return undefined;
  const it = itemByNamePlaceable(name) ?? itemByNamePlaceable(NAME_ALIAS[name.toLowerCase()] ?? '');
  return it;
}
const PLACE_BY_NAME: Record<string, Item> = {};
for (const it of ITEMS) if (it.place && !PLACE_BY_NAME[it.name.toLowerCase()]) PLACE_BY_NAME[it.name.toLowerCase()] = it;
const itemByNamePlaceable = (n: string) => PLACE_BY_NAME[n.toLowerCase()] ?? (itemByName(n)?.place ? itemByName(n) : undefined);

// ---------------------------------------------------------------- import
export type SaveImport = { plan: Plan; placed: number; skipped: number; farmName: string };

/** Finds the <GameLocation xsi:type="Farm"> block without parsing the whole file. */
function farmBlock(xml: string): string | null {
  const start = xml.search(/<GameLocation[^>]*xsi:type="Farm"/);
  if (start < 0) return null;
  const re = /<(\/?)GameLocation[\s>]/g;
  re.lastIndex = start;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return xml.slice(start, xml.indexOf('>', m.index) + 1);
  }
  return null;
}

const firstTag = (xml: string, tag: string) => {
  const m = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml);
  return m ? decode(m[1].trim()) : undefined;
};

export function isSaveGame(text: string) {
  return /<SaveGame[\s>]/.test(text.slice(0, 2000)) || (text.trimStart().startsWith('<') && /<GameLocation[^>]*xsi:type="Farm"/.test(text));
}

export function importSaveGame(xml: string): SaveImport | null {
  const block = farmBlock(xml);
  if (!block) return null;
  const farm = parseXml(block).kids[0];
  if (!farm) return null;

  const which = firstTag(xml, 'whichFarm') ?? '0';
  const mapId = /meadow/i.test(which) ? 'meadowlands' : FARM_TYPES[Number(which)] ?? 'standard';
  const map = MAP_BY_ID[mapId];
  const seasonRaw = (firstTag(xml, 'currentSeason') ?? 'spring').toLowerCase();
  const season = (['spring', 'summer', 'fall', 'winter'].includes(seasonRaw) ? seasonRaw : 'spring') as Season;
  const farmName = firstTag(xml, 'farmName') ?? 'Imported';

  const objects: Placed[] = [];
  const ground: Record<string, string> = {};
  const occ = buildOcc(objects);
  const probe = { map: mapId, ground };
  let skipped = 0;

  const put = (it: Item | undefined, x: number, y: number) => {
    if (!it || !it.place) { skipped++; return; }
    if (layerOf(it) === 'ground') {
      if (x >= 0 && y >= 0 && x < map.w && y < map.h) ground[key(x, y)] = it.id; else skipped++;
      return;
    }
    if (!canPlace(probe, occ, it, x, y, undefined, true).ok) { skipped++; return; }
    const o: Placed = { u: uid(), id: it.id, x, y };
    objects.push(o);
    const m = layerOf(it) === 'rug' ? occ.rug : occ.obj;
    for (let j = 0; j < it.h; j++) for (let i = 0; i < it.w; i++) m.set(key(x + i, y + j), o);
  };

  // Buildings. The game stores the top-left tile of the footprint.
  for (const b of kids(kid(farm, 'buildings'), 'Building')) {
    const x = num(b, 'tileX'), y = num(b, 'tileY');
    const type = txt(b, 'buildingType');
    if (x === undefined || y === undefined || !type) continue;
    const it = placeable(type);
    if (!it) { skipped++; continue; }
    // The game counts more rows for a building than the planner footprint does.
    const gameH = num(b, 'tilesHigh');
    put(it, x, gameH && gameH > it.h ? y + gameH - it.h : y);
  }
  // Saves from before 1.6 do not list the farmhouse, greenhouse or bin as buildings.
  if (!objects.some((o) => o.id.startsWith('farmhouse'))) for (const d of map.defaults) put(ITEM_BY_ID[d.id], d.x, d.y);

  // Terrain features: tilled soil with crops, flooring, grass, trees.
  for (const item of kids(kid(farm, 'terrainFeatures'), 'item')) {
    const pos = vec(kid(item, 'key'));
    const f = kid(item, 'value')?.kids[0];
    if (!pos || !f) continue;
    const [x, y] = pos;
    switch (f.type) {
      case 'HoeDirt': {
        ground[key(x, y)] = 'tilled-soil';
        const crop = kid(f, 'crop');
        if (crop) {
          const it = BY_GID[bare(txt(crop, 'indexOfHarvest'))] ?? BY_SID[bare(txt(crop, 'netSeedIndex'))] ?? BY_SID[bare(txt(crop, 'seedIndex'))];
          const o = it ?? ITEM_BY_ID['crop-mixed-seeds'];
          if (o) { objects.push({ u: uid(), id: o.id, x, y }); occ.obj.set(key(x, y), objects[objects.length - 1]); }
        }
        break;
      }
      case 'Flooring': put(ITEM_BY_ID[FLOORS[Number(bare(txt(f, 'whichFloor')))] ?? ''], x, y); break;
      case 'Grass': put(ITEM_BY_ID[txt(f, 'grassType') === '7' ? 'blue-grass' : 'grass'], x, y); break;
      case 'Tree': put(ITEM_BY_ID[TREES[bare(txt(f, 'treeType'))] ?? 'tree-oak-tree'], x, y); break;
      case 'FruitTree': {
        const id = bare(txt(f, 'treeId'));
        const old = OLD_FRUIT_TREES[Number(txt(f, 'treeType'))];
        put(BY_GID[id]?.kind === 'fruittree' ? BY_GID[id] : ITEM_BY_ID[old ?? ''], x, y);
        break;
      }
      case 'Bush': put(ITEM_BY_ID['crop-tea-bush'], x, y); break;
      default: skipped++;
    }
  }

  // Objects: craftables, machines, fences, sprinklers.
  for (const item of kids(kid(farm, 'objects'), 'item')) {
    const pos = vec(kid(item, 'key'));
    const o = kid(item, 'value')?.kids[0];
    if (!pos || !o) continue;
    let name = txt(o, 'name') ?? txt(o, 'Name');
    const held = txt(kid(o, 'heldObject'), 'name');
    if (name && /sprinkler/i.test(name) && held && /pressure nozzle/i.test(held)) name = `${name} (P)`;
    put(placeable(name), pos[0], pos[1]);
  }

  // Large debris and giant crops.
  for (const c of kids(kid(farm, 'resourceClumps'), 'ResourceClump')) {
    const pos = vec(kid(c, 'netTile') ?? kid(c, 'tile') ?? kid(c, 'Tile'));
    if (!pos) continue;
    const id = c.type === 'GiantCrop'
      ? GIANT[bare(txt(c, 'which') ?? txt(c, 'parentSheetIndex'))] ?? GIANT[(txt(c, 'id') ?? '').toLowerCase().replace(/[^a-z]/g, '')]
      : CLUMPS[bare(txt(c, 'parentSheetIndex'))];
    const it = ITEM_BY_ID[id ?? ''];
    if (it?.place === 'crop') for (let j = 0; j < it.h; j++) for (let i = 0; i < it.w; i++) ground[key(pos[0] + i, pos[1] + j)] ??= 'tilled-soil';
    put(it, pos[0], pos[1]);
  }

  // Outdoor furniture.
  for (const f of kids(kid(farm, 'furniture'), 'Furniture')) {
    const pos = vec(kid(f, 'tileLocation'));
    if (pos) put(placeable(txt(f, 'name')), pos[0], pos[1]);
  }

  const now = Date.now();
  const plan: Plan = { v: 1, id: uid(), name: `${farmName} Farm`.slice(0, 60), map: mapId, season, createdAt: now, updatedAt: now, ground, objects };
  return { plan, placed: objects.length + Object.keys(ground).length, skipped, farmName };
}
