/** Unit tests for the planner model. Run: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_BY_ID, ITEMS, PLACEABLE, searchItems, SPRITES } from '../src/data/items';
import { MAP_BY_ID, MAPS, terrainAt } from '../src/data/maps';
import {
  buildOcc, canPlace, computeStats, coverage, eraseAt, newPlan, offsetsFor, placeItem, rectTiles, stampPositions, validatePlan,
} from '../src/planner/model';
import { spriteKey } from '../src/planner/render.keys';

const it = (id: string) => {
  const x = ITEM_BY_ID[id];
  assert.ok(x, `missing item ${id}`);
  return x;
};

function freeTile(mapId: string) {
  const m = MAP_BY_ID[mapId];
  for (let y = 25; y < m.h; y++) for (let x = 5; x < m.w; x++) if (terrainAt(m, x, y) === 'g' && terrainAt(m, x + 8, y + 8) === 'g') return [x, y] as const;
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
      const chk = canPlace(plan, occ, it(o.id), o.x, o.y);
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
  assert.ok(canPlace(room, buildOcc([]), it('calico-falls'), 3, 1).ok);
  assert.equal(canPlace(room, buildOcc([]), it('barn'), 3, 5).ok, false, 'no buildings indoors');
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
