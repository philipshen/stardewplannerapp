/** Unit tests for the planner model. Run: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_BY_ID, ITEMS, PLACEABLE, searchItems, SPRITES } from '../src/data/items';
import { flagsAt, MAP_BY_ID, MAPS, terrainAt } from '../src/data/maps';
import {
  buildOcc, canPlace, placementCells, soilForCrops, computeStats, coverage, eraseAt, newPlan, offsetsFor, placeItem, rectTiles, stampPositions, validatePlan,
} from '../src/planner/model';
import { grassTufts, spriteKey } from '../src/planner/render.keys';
import { lightRadius, planLights } from '../src/planner/lighting';
import { placementPreferences } from '../src/store/placementPreferences';

test('saved placement preferences retain the last item and valid hotbar slots', () => {
  const saved = JSON.parse(JSON.stringify({ itemId: 'keg', recent: ['sprinkler', 'keg', 'sprinkler', 'unknown-item'] }));
  assert.deepEqual(placementPreferences(saved), { itemId: 'keg', recent: ['sprinkler', 'keg'] });
});

test('unavailable or non-placeable saved picks safely return to a placeable default', () => {
  for (const saved of [null, [], { itemId: 'unknown-item' }, { itemId: 'rusty-sword', recent: [null, {}, 'rusty-sword'] }]) {
    const prefs = placementPreferences(saved);
    assert.equal(prefs.itemId, 'crop-parsnip');
    assert.ok(prefs.recent.includes(prefs.itemId));
  }
});

const it = (id: string) => {
  const x = ITEM_BY_ID[id];
  assert.ok(x, `missing item ${id}`);
  return x;
};

/** Top-left of a 20x12 block of tiles that are walkable, buildable and tillable. */
function freeTile(mapId: string) {
  const m = MAP_BY_ID[mapId];
  for (let y = 20; y < m.h - 12; y++) for (let x = 5; x < m.w - 20; x++) {
    let ok = true;
    for (let j = 0; j < 12 && ok; j++) for (let i = 0; i < 20; i++) if (flagsAt(m, x + i, y + j) !== 7) { ok = false; break; }
    if (ok) return [x, y] as const;
  }
  throw new Error('no free tile');
}

test('catalog is large, unique and fully illustrated', () => {
  assert.ok(ITEMS.length > 1300);
  assert.ok(PLACEABLE.length > 400);
  assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
  for (const i of ITEMS) assert.ok(SPRITES.icons[i.id], `no icon for ${i.id}`);
});

test('every placeable item has a world sprite', () => {
  for (const i of PLACEABLE) {
    const k = spriteKey({ u: 'x', id: i.id, x: 0, y: 0 }, 'spring');
    const ground = i.place === 'ground' && i.cat !== 'furniture';
    const has = ground ? Object.keys(SPRITES.world).some((w) => w.startsWith(i.id + '#') || w.startsWith(i.id + '@')) : !!SPRITES.world[k];
    assert.ok(has, `no world sprite for ${i.id} (${k})`);
  }
});

test('every map is well formed and default buildings fit', () => {
  for (const m of MAPS) {
    assert.equal(m.grid.length, m.w * m.h, m.id);
    const plan = newPlan('t', m.id, 'spring');
    const occ = buildOcc([]);
    for (const o of plan.objects) {
      // Fixed buildings stand on tiles that the game marks as not buildable, so only bounds and overlaps count.
      const chk = canPlace(plan, occ, it(o.id), o.x, o.y, undefined, true);
      assert.ok(chk.ok, `${m.id}: default ${o.id} invalid: ${!chk.ok && chk.reason}`);
      placeItem(plan, occ, it(o.id), o.x, o.y);
    }
  }
});

test('placement rules: overlap, terrain, crops and walls', () => {
  const plan = newPlan('t', 'standard', 'spring');
  const occ = buildOcc(plan.objects);
  const [x, y] = freeTile('standard');
  const barn = it('barn');
  assert.ok(canPlace(plan, occ, barn, x, y).ok);
  const e1 = placeItem(plan, occ, barn, x, y)!;
  Object.assign(plan, e1);
  assert.equal(canPlace(plan, occ, barn, x + 2, y + 1).ok, false, 'overlapping barns');
  assert.equal(canPlace(plan, occ, it('wood-floor'), x + 1, y + 1).ok, true, 'flooring under buildings is allowed');
  // Crops auto-till and block other objects.
  const crop = it('crop-parsnip');
  const e2 = placeItem(plan, occ, crop, x + 10, y)!;
  Object.assign(plan, e2);
  assert.equal(plan.ground[`${x + 10},${y}`], 'tilled-soil');
  assert.equal(canPlace(plan, occ, it('chest'), x + 10, y).ok, false);
  // Water-only and wall-only items.
  assert.equal(canPlace(plan, occ, it('crab-pot'), x, y + 6).ok, false);
  const pond = MAP_BY_ID.standard;
  let wx = -1, wy = -1;
  for (let j = 0; j < pond.h && wx < 0; j++) for (let i = 0; i < pond.w; i++) if (terrainAt(pond, i, j) === 'w') { wx = i; wy = j; break; }
  assert.ok(canPlace(plan, occ, it('crab-pot'), wx, wy).ok);
  assert.equal(canPlace(plan, occ, it('calico-falls'), x, y + 6).ok, false, 'paintings need walls');
  const room = newPlan('r', 'farmhouse', 'spring');
  const house = MAP_BY_ID.farmhouse;
  const wall = house.grid.indexOf('WW');
  assert.ok(canPlace(room, buildOcc([]), it('calico-falls'), wall % house.w, Math.floor(wall / house.w)).ok);
  const floor = house.grid.indexOf('ffffffff');
  assert.equal(canPlace(room, buildOcc([]), it('barn'), floor % house.w, Math.floor(floor / house.w)).ok, false, 'no buildings indoors');
});

test('erase removes object, then rug, then ground', () => {
  const plan = newPlan('t', 'farmhouse', 'spring');
  const occ = buildOcc([]);
  let e = placeItem(plan, occ, it('wood-floor'), 5, 6)!; Object.assign(plan, e);
  e = placeItem(plan, occ, it('red-rug'), 4, 5)!; Object.assign(plan, e);
  e = placeItem(plan, occ, it('oak-chair'), 5, 6)!; Object.assign(plan, e);
  assert.equal(plan.objects.length, 2);
  e = eraseAt(plan, occ, 5, 6)!; Object.assign(plan, e);
  assert.deepEqual(plan.objects.map((o) => o.id), ['red-rug']);
  e = eraseAt(plan, occ, 5, 6)!; Object.assign(plan, e);
  assert.equal(plan.objects.length, 0);
  e = eraseAt(plan, occ, 5, 6)!; Object.assign(plan, e);
  assert.equal(Object.keys(plan.ground).length, 0);
  assert.equal(eraseAt(plan, occ, 5, 6), null);
});

test('coverage shapes match the game', () => {
  assert.equal(offsetsFor('spr1').length, 4);
  assert.equal(offsetsFor('spr2').length, 8);
  assert.equal(offsetsFor('spr3').length, 24);
  assert.equal(offsetsFor('junimo').length, 17 * 17);
  const scare = offsetsFor('scare8').length;
  assert.ok(scare > 200 && scare < 260, `scarecrow tiles ${scare}`);
  const cov = coverage([{ u: 'a', id: 'quality-sprinkler', x: 10, y: 10 }]);
  assert.ok(cov.water.has('9,9') && cov.water.has('11,11') && !cov.water.has('10,10'));
});

test('stats count crops, watering, cost and materials', () => {
  const plan = newPlan('t', 'standard', 'spring');
  const occ = buildOcc(plan.objects);
  const [x, y] = freeTile('standard');
  let e = placeItem(plan, occ, it('sprinkler'), x + 1, y + 1)!; Object.assign(plan, e);
  for (const [cx, cy] of [[x + 1, y], [x, y + 1], [x + 3, y + 3]]) { e = placeItem(plan, occ, it('crop-parsnip'), cx, cy)!; Object.assign(plan, e); }
  e = placeItem(plan, occ, it('coop'), x + 5, y + 5)!; Object.assign(plan, e);
  const s = computeStats(plan);
  assert.equal(s.crops, 3);
  assert.equal(s.cropsWatered, 2);
  assert.ok(s.gold >= 4000 + 3 * 20, `gold ${s.gold}`);
  assert.ok(s.mats.find((m) => m.name === 'Wood')!.n >= 300);
});

test('area stamping steps multi-tile items by footprint', () => {
  assert.equal(rectTiles(0, 0, 2, 2, false).length, 9);
  assert.equal(rectTiles(0, 0, 3, 3, true).length, 12);
  const keg = it('keg');
  assert.equal(stampPositions(keg, 0, 0, 4, 1, false).length, 10);
  const shed = it('shed');
  assert.deepEqual(stampPositions(shed, 0, 0, 13, 2, false), [[0, 0], [7, 0]]);
});

test('validatePlan sanitizes imported files', () => {
  assert.equal(validatePlan({ map: 'nope' }), null);
  const p = validatePlan({ map: 'standard', name: 'X', season: 'winter', ground: { '1,2': 'wood-floor', bad: 'wood-floor', '3,4': 'not-an-item' }, objects: [{ id: 'chest', x: 3.2, y: 4 }, { id: 'ghost', x: 1, y: 1 }] })!;
  assert.equal(p.season, 'winter');
  assert.deepEqual(Object.keys(p.ground), ['1,2']);
  assert.equal(p.objects.length, 1);
  assert.equal(p.objects[0].x, 3);
});

test('search ranks exact and prefix matches first', () => {
  assert.equal(searchItems('keg')[0].name, 'Keg');
  assert.equal(searchItems('iridium spr')[0].name, 'Iridium Sprinkler');
  assert.ok(searchItems('blue berry').some((i) => i.name === 'Blueberry') || searchItems('blueberry')[0].name.startsWith('Blueberry'));
  assert.ok(searchItems('winter').length > 10, 'season search');
  assert.ok(searchItems('mahgany').some((i) => /Mahogany/.test(i.name)), 'fuzzy');
});

// ---------------------------------------------------------------- new parity features
import { importSaveGame, isSaveGame, parseXml } from '../src/lib/savegame';
import { fitToMap, tileBuildable, tileTillable } from '../src/planner/model';
import { customMapInfo, registerCustomMap, validateLayout } from '../src/data/maps';
import { menuOf, MENUS } from '../src/data/items';

const SAVE = `<?xml version="1.0" encoding="utf-8"?>
<SaveGame xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><player><farmName>Test &amp; Co</farmName></player>
<whichFarm>2</whichFarm><currentSeason>fall</currentSeason>
<locations><GameLocation xsi:type="Farm">
<buildings>
 <Building><indoors xsi:type="AnimalHouse"><objects><item><key><Vector2><X>3</X><Y>3</Y></Vector2></key><value><Object><name>Keg</name></Object></value></item></objects></indoors><tileX>30</tileX><tileY>30</tileY><tilesHigh>3</tilesHigh><buildingType>Coop</buildingType></Building>
 <Building><tileX>59</tileX><tileY>11</tileY><tilesHigh>6</tilesHigh><buildingType>Farmhouse</buildingType></Building>
</buildings>
<objects>
 <item><key><Vector2><X>40</X><Y>40</Y></Vector2></key><value><Object><name>Quality Sprinkler</name><heldObject><name>Pressure Nozzle</name></heldObject></Object></value></item>
 <item><key><Vector2><X>41</X><Y>40</Y></Vector2></key><value><Object><name>Keg</name></Object></value></item>
 <item><key><Vector2><X>42</X><Y>40</Y></Vector2></key><value><Object><name>Totally Unknown Thing</name></Object></value></item>
</objects>
<terrainFeatures>
 <item><key><Vector2><X>39</X><Y>40</Y></Vector2></key><value><TerrainFeature xsi:type="HoeDirt"><crop><indexOfHarvest>24</indexOfHarvest></crop></TerrainFeature></value></item>
 <item><key><Vector2><X>39</X><Y>41</Y></Vector2></key><value><TerrainFeature xsi:type="HoeDirt" /></value></item>
 <item><key><Vector2><X>45</X><Y>45</Y></Vector2></key><value><TerrainFeature xsi:type="Flooring"><whichFloor>8</whichFloor></TerrainFeature></value></item>
 <item><key><Vector2><X>50</X><Y>45</Y></Vector2></key><value><TerrainFeature xsi:type="Tree"><treeType>3</treeType></TerrainFeature></value></item>
 <item><key><Vector2><X>52</X><Y>45</Y></Vector2></key><value><TerrainFeature xsi:type="FruitTree"><treeId>628</treeId></TerrainFeature></value></item>
</terrainFeatures>
<resourceClumps><ResourceClump><parentSheetIndex>672</parentSheetIndex><tile><X>20</X><Y>50</Y></tile></ResourceClump></resourceClumps>
<name>Farm</name></GameLocation><GameLocation><name>Town</name><objects><item><key><Vector2><X>1</X><Y>1</Y></Vector2></key><value><Object><name>Chest</name></Object></value></item></objects></GameLocation></locations></SaveGame>`;

test('xml reader keeps structure and xsi:type', () => {
  const r = parseXml('<a><b xsi:type="T">x</b><c/></a>');
  assert.equal(r.kids[0].kids.length, 2);
  assert.equal(r.kids[0].kids[0].type, 'T');
  assert.equal(r.kids[0].kids[0].text, 'x');
});

test('save game import reads the farm only', () => {
  assert.ok(isSaveGame(SAVE));
  const res = importSaveGame(SAVE)!;
  assert.ok(res);
  const { plan } = res;
  assert.equal(plan.map, 'forest');
  assert.equal(plan.season, 'fall');
  assert.equal(plan.name, 'Test & Co Farm');
  const at = (x: number, y: number) => plan.objects.find((o) => o.x === x && o.y === y)?.id;
  assert.equal(at(30, 30), 'coop');
  assert.equal(at(59, 14), 'farmhouse'); // 6 game rows -> 3 planner rows
  assert.equal(at(40, 40), 'quality-sprinkler-p');
  assert.equal(at(41, 40), 'keg');
  assert.equal(at(39, 40), 'crop-parsnip');
  assert.equal(at(50, 45), 'tree-pine-tree');
  assert.equal(at(52, 45), 'tree-cherry-tree');
  assert.equal(at(20, 50), 'large-rock');
  assert.equal(plan.ground['39,41'], 'tilled-soil');
  assert.equal(plan.ground['45,45'], 'cobblestone-path');
  assert.equal(plan.objects.filter((o) => o.id === 'keg').length, 1); // the keg inside the coop and the town chest are ignored
  assert.ok(!plan.objects.some((o) => o.id === 'chest'));
  assert.equal(res.skipped, 1);
  assert.ok(validatePlan(JSON.parse(JSON.stringify(plan))));
});

test('pressure nozzle sprinkler covers 7x7', () => {
  assert.equal(offsetsFor('spr4').length, 48);
  assert.equal(ITEM_BY_ID['iridium-sprinkler-p'].range, 'spr4');
});

test('giant crops are 3x3 and till their footprint', () => {
  const it = ITEM_BY_ID['crop-giant-pumpkin'];
  assert.equal(it.w * it.h, 9);
  const plan = newPlan('t', 'greenhouse', 'spring');
  const occ = buildOcc(plan.objects);
  assert.ok(canPlace(plan, occ, it, 5, 11).ok);
  const next = placeItem({ ...plan }, occ, it, 5, 11)!;
  assert.equal(Object.keys(next.ground).length, 9);
});

test('place anywhere skips terrain rules but not overlaps', () => {
  const plan = newPlan('t', 'standard', 'spring');
  const occ = buildOcc(plan.objects);
  const keg = ITEM_BY_ID['keg'];
  assert.ok(!canPlace(plan, occ, keg, 0, 0).ok);
  assert.ok(canPlace(plan, occ, keg, 0, 0, undefined, true).ok);
  const house = plan.objects.find((o) => o.id === 'farmhouse')!;
  assert.ok(!canPlace(plan, occ, keg, house.x, house.y, undefined, true).ok);
});

test('custom layouts allow every item and survive a layout change', () => {
  const l = validateLayout({ id: 'custom-abc123', name: 'Mine', w: 30, h: 20, image: 'data:image/png;base64,AAAA' })!;
  assert.ok(l);
  assert.equal(validateLayout({ id: 'custom-x', w: 2, h: 2, image: 'x' }), null);
  registerCustomMap(l);
  const m = customMapInfo(l);
  assert.ok(tileBuildable(m, 3, 3) && tileTillable(m, 3, 3));
  const plan = newPlan('t', l.id, 'spring');
  assert.ok(canPlace(plan, buildOcc([]), ITEM_BY_ID['crab-pot'], 2, 2).ok);
  const big = newPlan('t', 'standard', 'spring');
  const fitted = fitToMap(big, l.id);
  assert.ok(fitted.objects.length < big.objects.length);
});

test('every placeable item belongs to a planner menu', () => {
  const ids = new Set(MENUS.map((m) => m.id));
  for (const it of ITEMS) if (it.place) assert.ok(ids.has(menuOf(it)), it.name);
  assert.equal(menuOf(ITEM_BY_ID['keg']), 'craftables');
  assert.equal(menuOf(ITEM_BY_ID['wood-fence']), 'misc');
});

test('new layouts exist', () => {
  for (const id of ['ginger-island', 'quarry', 'farmhouse-0', 'farmhouse-1m', 'farmhouse-2m', 'barn', 'deluxe-coop', 'slime-hutch']) assert.ok(MAP_BY_ID[id], id);
});

test('ranges match the Stardew Valley Wiki', () => {
  assert.equal(offsetsFor('spr1').length, 4);
  assert.equal(offsetsFor('spr2').length, 8);
  assert.equal(offsetsFor('spr3').length, 24);
  assert.equal(offsetsFor('scare8').length, 248); // 249 with its own tile
  assert.equal(offsetsFor('scare16').length, 888);
  assert.equal(offsetsFor('bee').length, 60);
  assert.equal(offsetsFor('junimo').length, 289); // 17x17 centered on the door
  assert.equal(offsetsFor('log').length, 48); // 7x7
  const size = (id: string) => `${ITEM_BY_ID[id].w}x${ITEM_BY_ID[id].h}`;
  const wiki: Record<string, string> = {
    barn: '7x4', coop: '6x3', 'fish-pond': '5x5', mill: '4x2', shed: '7x3', 'big-shed': '7x3', silo: '3x3', 'slime-hutch': '7x4', stable: '4x2',
    well: '3x3', cabin: '5x3', 'shipping-bin': '2x1', 'pet-bowl': '2x2', 'junimo-hut': '3x2', 'earth-obelisk': '3x2', 'gold-clock': '3x2', greenhouse: '7x6',
  };
  for (const [id, s] of Object.entries(wiki)) assert.equal(size(id), s, id);
});

import { TEMPLATES } from '../src/data/templates';
import { planFromTemplate } from '../src/planner/model';

test('every sample gallery category offers at least two distinct layouts', () => {
  for (const map of ['standard', 'forest', 'four-corners', 'ginger-island', 'big-shed']) {
    const samples = TEMPLATES.filter(t => t.map === map);
    assert.ok(samples.length >= 2, map);
    assert.equal(new Set(samples.map(t => t.name)).size, samples.length, map);
    assert.equal(new Set(samples.map(t => JSON.stringify(t.objects))).size, samples.length, map);
  }
});

test('sample farms are valid plans with no overlaps', () => {
  assert.ok(TEMPLATES.length >= 8);
  for (const tpl of TEMPLATES) {
    const plan = planFromTemplate(tpl, tpl.name);
    assert.ok(validatePlan(JSON.parse(JSON.stringify(plan))), tpl.name);
    assert.ok(plan.objects.length > 20, tpl.name);
    const seen = new Set<string>();
    for (const o of plan.objects) {
      const it = ITEM_BY_ID[o.id];
      assert.ok(it, o.id);
      if (it.place === 'ground') continue;
      for (let j = 0; j < it.h; j++) for (let i = 0; i < it.w; i++) {
        const k = `${o.x + i},${o.y + j}`;
        assert.ok(!seen.has(k), `${tpl.name}: overlap at ${k}`);
        seen.add(k);
      }
    }
  }
});

test('sample copies have independent identities and do not mutate the source layout', () => {
  for (const template of TEMPLATES) {
    if (template.source) assert.match(template.source.url, /^https:\/\/www\.reddit\.com\/r\/(FarmsofStardewValley|StardewHomeDesign)\//);
    const snapshot = JSON.stringify(template);
    const preview = planFromTemplate(template, template.name);
    const copy = planFromTemplate(template, 'My copy');
    assert.notEqual(copy.id, preview.id);
    assert.equal(copy.name, 'My copy');
    assert.deepEqual(copy.ground, preview.ground);
    assert.deepEqual(copy.objects.map(({ id, x, y }) => ({ id, x, y })), preview.objects.map(({ id, x, y }) => ({ id, x, y })));
    copy.objects[0].x++;
    copy.ground['1,1'] = 'wood-floor';
    assert.equal(JSON.stringify(template), snapshot);
    assert.notEqual(copy.objects[0].x, preview.objects[0].x);
  }
});

import { PlayQueue } from '../src/audio/queue';

test('radio shuffle plays every track once in a round and never the same track twice in a row', () => {
  let seed = 7;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const list = Array.from({ length: 20 }, (_, i) => ({ key: 't' + i }));
  const q = new PlayQueue<{ key: string }>(random);
  let last: { key: string } | null = null;
  for (let round = 0; round < 50; round++) {
    const seen = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      const n: { key: string } = q.next('shuffle', list, last)!;
      assert.ok(n);
      assert.notEqual(n.key, last?.key, 'same track twice in a row');
      assert.ok(!seen.has(n.key), 'repeat inside a round');
      seen.add(n.key);
      last = n;
    }
    assert.equal(seen.size, 20);
  }
  // Two tracks alternate; one track repeats; an empty station plays nothing.
  const two = new PlayQueue<{ key: string }>(random);
  let l: { key: string } | null = null;
  for (let i = 0; i < 20; i++) { const n: { key: string } = two.next('s', list.slice(0, 2), l)!; assert.notEqual(n.key, l?.key); l = n; }
  assert.equal(new PlayQueue<{ key: string }>().next('s', list.slice(0, 1), list[0])!.key, 't0');
  assert.equal(new PlayQueue<{ key: string }>().next('s', [], null), null);
});


test('moving and copying crops tills destination soil without changing existing ground or source soil', () => {
  const crop = PLACEABLE.find((it) => it.place === 'crop')!;
  const ground = { '2,2': 'tilled-soil', '5,5': 'watered-soil', '8,8': 'wood-floor' };
  const result = soilForCrops(ground, [{ u: 'moved', id: crop.id, x: 5, y: 5 }, { u: 'copy', id: crop.id, x: 6, y: 5 }]);
  assert.equal(result['6,5'], 'tilled-soil');
  assert.equal(result['5,5'], 'watered-soil');
  assert.equal(result['2,2'], 'tilled-soil');
  assert.equal(result['8,8'], 'wood-floor');
  assert.equal(Object.keys(ground).length, 3);
  assert.equal(soilForCrops(result, []), result);
});


import { parseRadioSettings } from '../src/audio/settings';
test('radio restores valid preferences and safely handles old or malformed storage', () => {
  const parsed = parseRadioSettings({ station: 'soundtrack', volume: 8, sfx: 'yes', mine: [null, {}, { name: 'Song', uri: 'file:///song.m4a' }, { name: 'Duplicate', uri: 'file:///song.m4a' }], next: null }, ['farming']);
  assert.deepEqual(parsed, { station: 'shuffle', volume: 1, sfx: true });
  assert.equal(parseRadioSettings({ station: 'removed', volume: NaN, mine: 'bad' }, []).station, 'auto');
  assert.equal(parseRadioSettings({ volume: NaN }, []).volume, 0.6);
  assert.equal(parseRadioSettings({ station: 'farming', volume: 0, sfx: false }, ['farming']).sfx, false);
  assert.deepEqual(parseRadioSettings(null, []), { station: 'auto', volume: 0.6, sfx: true });
  assert.deepEqual(parseRadioSettings({ station: 'mine', volume: 0.3, sfx: false, mine: [{ name: 'Old song', uri: 'file:///song.m4a' }] }, []), { station: 'auto', volume: 0.3, sfx: false });
});


test('catalogue excludes old placeholders and treats Animal Catalogue as a book', () => {
  assert.ok(!ITEMS.some((i) => i.id === 'pickle-jar-beauty' || i.id === 'circular-rug'));
  assert.ok(ITEM_BY_ID['pickle-jar-beauty'], 'old plans must retain their item lookup');
  assert.equal(ITEM_BY_ID['animal-catalogue'].cat, 'books');
  assert.ok(!PLACEABLE.some((i) => i.id === 'animal-catalogue'));
});


test('placement grid marks only blocked footprint squares red', () => {
  const plan = newPlan('preview', 'standard', 'spring');
  const [x, y] = freeTile('standard');
  const blocker = { u: 'blocker', id: 'chest', x: x + 2, y: y + 1 };
  const occ = buildOcc([blocker]);
  const cells = placementCells(plan, occ, it('barn'), x, y);
  assert.equal(cells.length, it('barn').w * it('barn').h);
  assert.deepEqual(cells.filter(c => !c.ok), [{ x: x + 2, y: y + 1, ok: false }]);
  assert.equal(canPlace(plan, occ, it('barn'), x, y).ok, false);
  assert.ok(placementCells(plan, occ, it('barn'), x, y, new Set(['blocker'])).every(c => c.ok));
  const edge = placementCells(plan, buildOcc([]), it('barn'), -1, y, undefined, true);
  assert.ok(edge.some(c => !c.ok) && edge.some(c => c.ok), 'map edge remains red even with unrestricted terrain');
});

test('grass uses four stable overlapping tufts with reference offsets', () => {
  const tufts = grassTufts(12, 20);
  assert.equal(tufts.length, 4);
  assert.deepEqual(tufts, grassTufts(12, 20));
  assert.notDeepEqual(tufts, grassTufts(13, 20));
  for (const tuft of tufts) {
    assert.ok(tuft.variant >= 0 && tuft.variant < 3);
    assert.ok(tuft.dx >= 0 && tuft.dx <= 9 && tuft.dy >= 0 && tuft.dy <= 9);
  }
});

test('Slime Hutch has the game floor footprint and blocks fixed troughs', () => {
  const map = MAP_BY_ID['slime-hutch'];
  const plan = newPlan('Slimes', map.id, 'spring');
  assert.equal([...map.flags!].filter(f => f === '1').length, 122);
  const incubator = plan.objects.find(o => o.id === 'slime-incubator');
  assert.ok(incubator);
  const occ = buildOcc(plan.objects);
  for (const y of [4, 6, 7, 8, 9, 11]) assert.equal(canPlace(plan, occ, it('keg'), 16, y).ok, false);
  assert.equal(canPlace(plan, occ, it('keg'), 15, 6).ok, true);
  assert.equal(canPlace(plan, occ, it('keg'), 18, 6).ok, false, 'legacy canvas padding is not floor');
  const erased = eraseAt(plan, occ, incubator.x, incubator.y)!;
  assert.ok(erased);
  assert.equal(erased.objects.some(o => o.id === 'slime-incubator'), false, 'the starting incubator can be removed');
});

import { completedPlanningSession, reviewHistory, shouldRequestReview } from '../src/lib/reviewPolicy';
test('reviews wait for productive sessions and three days of use', () => {
  const day = 86_400_000, start = day;
  const empty = reviewHistory(null);
  assert.equal(completedPlanningSession(empty, 4, 120_000, start), empty);
  assert.equal(completedPlanningSession(empty, 5, 119_999, start), empty);
  let history = completedPlanningSession(empty, 5, 120_000, start);
  assert.equal(shouldRequestReview(history, '1.0.0', start + 10 * day), false);
  history = completedPlanningSession(history, 5, 120_000, start + day);
  history = completedPlanningSession(history, 5, 120_000, start + 2 * day);
  assert.equal(shouldRequestReview(history, '1.0.0', start + 2 * day), false);
  assert.equal(shouldRequestReview(history, '1.0.0', start + 3 * day), true);
});
test('review attempts respect version and 120-day cooldown even if the store suppresses them', () => {
  const day = 86_400_000;
  const history = { firstSessionAt: day, sessions: 20, lastRequestedAt: 10 * day, lastRequestedVersion: '1.0.0' };
  assert.equal(shouldRequestReview(history, '1.0.0', 500 * day), false);
  assert.equal(shouldRequestReview(history, '1.1.0', 129 * day), false);
  assert.equal(shouldRequestReview(history, '1.1.0', 130 * day), true);
  assert.equal(shouldRequestReview(history, '1.1.0', 5 * day), false);
});
test('malformed review history cannot immediately trigger a prompt', () => {
  const history = reviewHistory({ sessions: Infinity, firstSessionAt: 'yesterday', lastRequestedAt: -1 });
  assert.equal(shouldRequestReview(history, '1.0.0', Date.now()), false);
});

test('torches stack on sprinklers and fences without losing occupancy or coverage', () => {
  const [x, y] = freeTile('standard');
  for (const base of ITEMS.filter(i => i.kind === 'sprinkler' || i.kind === 'fence')) {
    const plan = { ...newPlan('Lights', 'standard', 'spring'), objects: [], ground: {} };
    const occ = buildOcc([]);
    const placed = placeItem(plan, occ, base, x, y)!;
    assert.equal(canPlace(plan, occ, it('torch'), x, y).ok, true, base.id);
    const stacked = placeItem({ ...plan, ...placed }, occ, it('torch'), x, y)!;
    assert.equal(occ.obj.get(`${x},${y}`)?.id, base.id);
    assert.equal(occ.torch.get(`${x},${y}`)?.id, 'torch');
    assert.equal(canPlace(plan, occ, it('torch'), x, y).ok, false, 'no double torch');
    assert.equal(canPlace(plan, occ, it('keg'), x, y).ok, false);
    assert.deepEqual(coverage(stacked.objects), coverage(placed.objects));
    const saved = validatePlan(JSON.parse(JSON.stringify({ ...plan, ...stacked })))!;
    const restored = buildOcc(saved.objects.reverse());
    assert.equal(restored.obj.get(`${x},${y}`)?.id, base.id);
    assert.equal(restored.torch.get(`${x},${y}`)?.id, 'torch');
    const erased = eraseAt(stacked, occ, x, y)!;
    assert.deepEqual(erased.objects, placed.objects);
    assert.equal(occ.obj.get(`${x},${y}`)?.id, base.id);
    assert.equal(occ.torch.size, 0);
    assert.equal(eraseAt(erased, occ, x, y)!.objects.length, 0);
  }
});

test('ground torches block ordinary objects but allow a sprinkler or fence underneath', () => {
  const [x, y] = freeTile('standard');
  const plan = { ...newPlan('Lights', 'standard', 'spring'), objects: [], ground: {} };
  const occ = buildOcc([]);
  const placed = placeItem(plan, occ, it('torch'), x, y)!;
  for (const id of ['keg', 'crop-parsnip', 'torch', 'gate', 'barn']) {
    assert.equal(canPlace(plan, occ, it(id), x, y).ok, false, id);
  }
  for (const id of ['sprinkler', 'wood-fence']) assert.equal(canPlace(plan, occ, it(id), x, y).ok, true);
  assert.equal(canPlace(plan, occ, it('torch'), x + 1, y).ok, true);
  assert.equal(canPlace(plan, occ, it('torch'), x, y, new Set([placed.objects[0].u])).ok, true);
  const kegOcc = buildOcc([{ u: 'k', id: 'keg', x, y }]);
  assert.equal(canPlace(plan, kegOcc, it('torch'), x, y).ok, false);
});


test('lighting recognizes fixtures without making ordinary objects glow', () => {
  for (const fixture of ITEMS.filter(i => i.cat === 'lighting' || i.kind === 'lamp' || i.kind === 'fireplace')) {
    assert.ok(lightRadius(fixture) > 0, fixture.id);
  }
  assert.equal(lightRadius(it('keg')), 0);
  assert.equal(lightRadius(it('sprinkler')), 0);
  const torch = { u: 'torch', id: 'torch', x: 10, y: 10 };
  const base = { u: 'base', id: 'sprinkler', x: 10, y: 10 };
  assert.deepEqual(planLights([torch], buildOcc([torch])), [{ x: 10.5, y: 10.5, radius: 3 }]);
  assert.deepEqual(planLights([torch, base], buildOcc([torch, base])), [{ x: 10.5, y: 10, radius: 3 }]);
});

test('game save import retains a torch mounted on a sprinkler', () => {
  const xml = SAVE.replace('Pressure Nozzle', 'Torch');
  const result = importSaveGame(xml)!;
  const stack = result.plan.objects.filter(o => o.x === 40 && o.y === 40);
  assert.deepEqual(stack.map(o => o.id).sort(), ['quality-sprinkler', 'torch']);
  const occ = buildOcc(result.plan.objects);
  assert.equal(occ.obj.get('40,40')?.id, 'quality-sprinkler');
  assert.equal(occ.torch.get('40,40')?.id, 'torch');
});
