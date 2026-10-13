/**
 * Builds the farm and interior fixtures used in store/creative-2026-10.
 * Each farm is laid out by code with the planner's own placement rules, so every item is valid.
 *
 * Run: node --import tsx scripts/build-marketing-plan.ts
 */
import fs from 'node:fs';

import { ITEM_BY_ID } from '../src/data/items';
import { MAP_BY_ID } from '../src/data/maps';
import { buildOcc, canPlace, Edit, key, Occ, placeItem } from '../src/planner/model';

type Season = 'spring' | 'summer' | 'fall' | 'winter';

class Builder {
  edit: Edit;
  occ: Occ;
  skipped = 0;
  constructor(public map: string, public season: Season) {
    const m = MAP_BY_ID[map];
    // Deterministic ids: templates get new ids when a player opens one.
    this.edit = { ground: {}, objects: m.defaults.map((d, i) => ({ u: 'd' + i, id: d.id, x: d.x, y: d.y })) };
    this.occ = buildOcc(this.edit.objects);
  }
  private n = 0;
  put(id: string, x: number, y: number): boolean {
    const it = ITEM_BY_ID[id];
    if (!it) throw new Error('unknown item ' + id);
    if (!canPlace({ map: this.map, ground: this.edit.ground }, this.occ, it, x, y).ok) { this.skipped++; return false; }
    const next = placeItem({ ...this.edit, map: this.map }, this.occ, it, x, y);
    if (!next) return false;
    // placeItem makes random ids; replace them so the output file is stable.
    next.objects = next.objects.map((o) => (/^[dt]\d+$/.test(o.u) ? o : { ...o, u: 't' + this.n++ }));
    this.edit = next;
    this.occ = buildOcc(this.edit.objects);
    return true;
  }
  rect(id: string, x0: number, y0: number, x1: number, y1: number, outline = false) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (outline && x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
      this.put(id, x, y);
    }
  }
  free(x: number, y: number) { return !this.occ.obj.has(key(x, y)); }
  /** A field of 5x5 blocks: sprinkler in the middle, crops around it, a scarecrow in the middle block. */
  field(x0: number, y0: number, cols: number, rows: number, sprinkler: string, crops: string[]) {
    const r = sprinkler.startsWith('iridium') ? 2 : 1, size = r * 2 + 1;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const cx = x0 + i * size + r, cy = y0 + j * size + r;
      const mid = i === Math.floor(cols / 2) && j === Math.floor(rows / 2);
      this.put('tilled-soil', cx, cy); // soil under the sprinkler, so the field has no grass holes
      this.put(mid ? 'scarecrow' : sprinkler, cx, cy);
      const crop = crops[(i + j * cols) % crops.length];
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx || dy) this.put(crop, cx + dx, cy + dy);
    }
  }
  plan(name: string, blurb: string) {
    return { name, blurb, map: this.map, season: this.season, ground: this.edit.ground, objects: this.edit.objects };
  }
}


// Marketing-only adaptation of u/mondaymarigolds' top community farm.
const b = new Builder('standard', 'spring');
b.edit.objects = b.edit.objects.filter(o=>o.id!=='greenhouse'); b.occ=buildOcc(b.edit.objects);
const trail = (points: number[][]) => { for(let i=1;i<points.length;i++){const [ax,ay]=points[i-1],[bx,by]=points[i]; const n=Math.max(Math.abs(bx-ax),Math.abs(by-ay));for(let j=0;j<=n;j++){const x=Math.round(ax+(bx-ax)*j/n),y=Math.round(ay+(by-ay)*j/n);b.rect('wood-floor',x,y,x+1,y+1);}}};
// Winding connected lanes, with three crop gardens at the heart.
trail([[40,7],[40,12],[34,12],[34,29],[30,37],[31,43],[37,46],[52,46],[60,42],[62,30],[57,24],[62,20],[70,20]]);
trail([[34,21],[21,21],[17,27],[19,36],[25,44],[27,52],[25,60]]);
trail([[34,29],[49,29],[54,34],[56,42]]);
trail([[40,12],[51,12],[53,18],[57,24]]);
trail([[18,27],[10,27],[9,43],[13,55],[25,60],[52,60],[62,54],[69,44],[69,35]]);
trail([[34,37],[45,37],[49,40],[52,46]]);
for(const [id,x,y] of [['big-shed',18,15],['big-shed',15,29],['big-shed',31,29],['big-shed',48,29],['greenhouse',35,36],['deluxe-barn',11,38],['deluxe-barn',18,46],['deluxe-barn',10,53],['deluxe-coop',62,34],['deluxe-coop',68,40],['log-cabin',69,49],['mill',48,16],['silo',6,37],['silo',6,44],['silo',6,51],['fish-pond',58,51],['fish-pond',64,55]] as [string,number,number][]) b.put(id,x,y);
for (const [x,y,c] of [[36,15,'crop-cauliflower'],[42,15,'crop-strawberry'],[36,21,'crop-kale'],[42,21,'crop-tulip']] as [number,number,string][]) {b.rect('wood-floor',x-1,y-1,x+5,y+5,true);for(let dy=0;dy<5;dy++)for(let dx=0;dx<5;dx++)b.put(dx===2&&dy===2?'iridium-sprinkler':c,x+dx,y+dy);}
b.put('scarecrow',41,20);
['earth-obelisk','water-obelisk','desert-obelisk','island-obelisk'].forEach((id,i)=>b.put(id,6,12+i*5));
b.put('gold-clock',16,23);
for(const [x,y] of [[30,49],[33,47],[37,47],[42,47],[46,49],[48,53],[46,58],[42,60],[37,60],[32,58],[30,54]]){b.put('tub-o-flowers',x,y);}
for(const [x,y] of [[22,23],[28,23],[50,23],[54,26],[56,43],[30,42],[12,32],[63,46],[30,56]])b.put('wood-lamp-post',x,y);
// Dense, irregular orchard belts: keep both walking lanes and building fronts open.
for(let y=10;y<=61;y+=3)for(let x=5;x<=75;x+=3){
 if(b.edit.ground[key(x,y)] || b.edit.ground[key(x+1,y)] || b.edit.ground[key(x,y+1)] || b.edit.ground[key(x-1,y)])continue;
 const front=b.edit.objects.some(o=>{const it=ITEM_BY_ID[o.id];return it.place==='building'&&x>=o.x-1&&x<=o.x+it.w&&y>=o.y+it.h&&y<=o.y+it.h+3;});
 if(front)continue;
 if((x*7+y*11)%13<11)b.put((x+y)%4===0?'tree-cherry-tree':(x+y)%3===0?'tree-maple-tree':'tree-oak-tree',x,y);
}
for(let y=10;y<=61;y++)for(let x=5;x<=75;x++)if(!b.edit.ground[key(x,y)]&&(x*7+y*3)%5!==0)b.put('grass',x,y);
const p={v:1,id:'marketing-garden-20261013',createdAt:1791882000000,updatedAt:1791882000000,...b.plan('Marigold Gardens','Tree-lined paths and garden courtyards.'),notes:'Layout adapted from u/mondaymarigolds: https://www.reddit.com/r/FarmsofStardewValley/comments/1n3bii8/'};
fs.mkdirSync('store/creative-2026-10/plans',{recursive:true});fs.writeFileSync('store/creative-2026-10/plans/marigold.stardewplan.json',JSON.stringify(p,null,2));
console.log(p.objects.length, Object.keys(p.ground).length);
const room = new Builder('big-shed','spring');
for(const [id,x,y] of [
 ['large-green-rug',2,5],['large-cottage-rug',11,5],['large-red-rug',2,10],['large-green-rug',11,10],
 ['luxury-bookcase',2,4],['luxury-bookcase',4,4],['brick-fireplace',8,4],['luxury-bookcase',12,4],['luxury-bookcase',14,4],
 ['house-plant',1,4],['house-plant',17,4],['oak-table',3,6],['oak-table',12,6],['oak-table',3,11],['oak-table',12,11],
 ['oak-chair',2,8],['oak-chair',5,8],['oak-chair',11,8],['oak-chair',14,8],['oak-chair',2,13],['oak-chair',5,13],['oak-chair',11,13],['oak-chair',14,13],
 ['house-plant',1,9],['house-plant',17,9],['house-plant',1,14],['house-plant',17,14],
 ['oak-bench',7,8],['oak-bench',9,8],['birch-tea-table',8,10],['country-lamp',7,10],['country-lamp',10,10],
 ['tea-sapling',7,13],['tea-sapling',10,13],['keg',16,5],['keg',16,6],['keg',16,7],
] as [string,number,number][])room.put(id,x,y);
const rp={v:1,id:'marketing-cafe-20261013',createdAt:1791882000000,updatedAt:1791882000000,...room.plan('The Garden Cafe','A cozy reading cafe in a big shed.')};
fs.writeFileSync('store/creative-2026-10/plans/cafe.stardewplan.json',JSON.stringify(rp,null,2));
console.log('Cafe',rp.objects.length,'skipped',room.skipped);
