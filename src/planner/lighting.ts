/** Planner lighting estimates in tiles; all placed light fixtures are previewed lit. */
import { Item, ITEM_BY_ID } from '../data/items';
import { Occ, Placed, torchLift } from './model';

export function lightRadius(it: Item): number {
  if (it.id === 'torch') return 3;
  if (it.kind === 'lamppost') return 6;
  if (it.kind === 'brazier' || it.kind === 'fireplace') return 4;
  if (it.kind === 'lamp' || it.kind === 'jackolantern' || it.id === 'wall-sconce' || it.id.endsWith('-lamp-end-table')) return 3;
  return 0;
}

export function planLights(objects: Placed[], occ: Occ) {
  return objects.flatMap(o => {
    const it = ITEM_BY_ID[o.id];
    const radius = it ? lightRadius(it) : 0;
    if (!radius) return [];
    const lift = torchLift(o, occ);
    return [{ x: o.x + it.w / 2, y: o.y + it.h - 0.5 - lift / 16, radius }];
  });
}
