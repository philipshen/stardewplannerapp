import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PNG } from 'pngjs';
import items from '../src/data/generated/items.json';
import sprites from '../src/data/generated/sprites.json';
import maps from '../src/data/generated/maps.json';
import { gameSprite } from './art/game';

test('game sprites keep their original visible pixels in the shipped atlas', () => {
  const atlas = PNG.sync.read(fs.readFileSync('assets/gen/world-0.png'));
  let checked = 0;
  for (const item of items) {
    if (!item.place) continue;
    const source = gameSprite(item);
    if (!source) continue;
    const key = item.kind === 'building' || item.kind === 'tree' || item.kind === 'fruittree' ? `${item.id}@spring`
      : item.kind === 'fence' ? `${item.id}#0`
      : item.place === 'ground' && item.cat !== 'furniture' ? `${item.id}${['grassplant', 'bluegrass'].includes(item.kind) ? '@spring' : ''}#0` : item.id;
    const rec = (sprites.world as Record<string, number[]>)[key];
    assert.ok(rec, `Missing ${key}`);
    assert.equal(rec[0], 0, 'Add support for additional atlas pages before using them');
    assert.equal(rec[3], source.img.w, key);
    assert.equal(rec[4], source.img.h, key);
    for (let y = 0; y < source.img.h; y++) for (let x = 0; x < source.img.w; x++) {
      const a: number = (y * source.img.w + x) * 4;
      if (!source.img.data[a + 3]) continue;
      const b = ((rec[2] + y) * atlas.width + rec[1] + x) * 4;
      assert.deepEqual([...atlas.data.subarray(b, b + 4)], [...source.img.data.subarray(a, a + 4)], `${key} pixel ${x},${y}`);
    }
    checked++;
  }
  assert.ok(checked > 500, `Only checked ${checked} source sprites`);
});

test('all eight farm types ship source terrain in all four seasons', () => {
  const names = { standard: 'default', riverland: 'fishing', forest: 'foraging', hilltop: 'mining', wilderness: 'combat', 'four-corners': 'fourcorners', beach: 'island', meadowlands: 'ranching' };
  for (const [id, source] of Object.entries(names)) for (const season of ['spring', 'summer', 'fall', 'winter']) {
    const original = PNG.sync.read(fs.readFileSync(`assets/game/maps-src/farm_${source}${season === 'spring' ? '' : '_' + season}.png`));
    const shipped = PNG.sync.read(fs.readFileSync(`assets/gen/maps/${id}-${season}.png`));
    assert.equal(shipped.width, original.width, id);
    assert.equal(shipped.height, original.height, id);
    assert.deepEqual(shipped.data, original.data, `${id} ${season} must not be repainted or recolored`);
  }
});

test('cabin uses original farmhouse pixels and rules without shifting saved coordinates', () => {
  const source = PNG.sync.read(fs.readFileSync('assets/game/maps-src/farmhouse.png'));
  const cabin = PNG.sync.read(fs.readFileSync('assets/gen/maps/cabin-spring.png'));
  const room = maps.find(m => m.id === 'farmhouse-0')!;
  const map = maps.find(m => m.id === 'cabin')!;
  assert.equal(map.w, 14, 'Keep the legacy canvas width');
  assert.equal(cabin.width, map.w * 16);
  assert.equal(cabin.height, source.height);
  for (let y = 0; y < source.height; y++) {
    assert.deepEqual(cabin.data.subarray(y * cabin.width * 4, (y * cabin.width + source.width) * 4), source.data.subarray(y * source.width * 4, (y + 1) * source.width * 4));
  }
  for (let y = 0; y < room.h; y++) {
    assert.equal(map.grid.slice(y * map.w, y * map.w + room.w), room.grid.slice(y * room.w, (y + 1) * room.w));
    assert.equal(map.flags!.slice(y * map.w, y * map.w + room.w), room.flags!.slice(y * room.w, (y + 1) * room.w));
    assert.equal(map.flags!.slice(y * map.w + room.w, (y + 1) * map.w), '00');
  }
});
