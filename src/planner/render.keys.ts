/** Pure helpers mapping placed items to world-sprite keys (no Skia dependency). */
import { ITEM_BY_ID } from '../data/items';
import type { Season } from '../theme';
import { key, Occ, Placed } from './model';

const tileHash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

function fenceMask(o: Placed, occ: Occ) {
  let m = 0;
  const conn = (x: number, y: number) => {
    const n = occ.obj.get(key(x, y));
    if (!n) return false;
    const k = ITEM_BY_ID[n.id]?.kind;
    return k === 'fence' || k === 'gate';
  };
  if (conn(o.x, o.y - 1)) m |= 1;
  if (conn(o.x + 1, o.y)) m |= 2;
  if (conn(o.x, o.y + 1)) m |= 4;
  if (conn(o.x - 1, o.y)) m |= 8;
  return m;
}

export function spriteKey(o: Placed, season: Season, occ?: Occ) {
  const it = ITEM_BY_ID[o.id];
  if (!it) return o.id;
  if (it.kind === 'building') return `${it.id}@${season === 'winter' ? 'winter' : 'spring'}`;
  if (it.kind === 'tree' || it.kind === 'fruittree') return `${it.id}@${season}`;
  if (it.kind === 'fence') return `${it.id}#${occ ? fenceMask(o, occ) : 10}`;
  return it.id;
}

export function groundKey(id: string, x: number, y: number, season: Season) {
  const it = ITEM_BY_ID[id];
  const v = tileHash(x, y) % 4;
  if (it?.kind === 'grassplant' || it?.kind === 'bluegrass') return `${id}@${season}#${v}`;
  return `${id}#${v}`;
}

