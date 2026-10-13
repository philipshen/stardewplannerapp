/**
 * Builds the sample farms that ship with the app (src/data/generated/templates.json).
 * Each farm is laid out by code with the planner's own placement rules, so every item is valid.
 *
 * Run: npx tsx scripts/build-templates.ts
 */
import fs from 'node:fs';
import path from 'node:path';
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
    const map = MAP_BY_ID[this.map];
    if (it.place !== 'water') for (let dy = 0; dy < it.h; dy++) for (let dx = 0; dx < it.w; dx++) {
      if ('wD'.includes(map.grid[(y + dy) * map.w + x + dx])) { this.skipped++; return false; }
    }
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

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, 'sample-fixtures', name + '.json'), 'utf8'));
function trail(b: Builder, points: number[][], floor = 'wood-floor') {
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i-1], [bx, by] = points[i];
    const n = Math.max(Math.abs(bx-ax), Math.abs(by-ay));
    for (let j = 0; j <= n; j++) {
      const x = Math.round(ax+(bx-ax)*j/n), y = Math.round(ay+(by-ay)*j/n);
      b.rect(floor,x,y,x+1,y+1);
    }
  }
}
function garden(b: Builder, x: number, y: number, crop: string) {
  b.rect('wood-floor',x-1,y-1,x+5,y+5,true);
  for(let dy=0;dy<5;dy++)for(let dx=0;dx<5;dx++)b.put(dx===2&&dy===2?'iridium-sprinkler':crop,x+dx,y+dy);
}
function planting(b: Builder, clearings: [number, number, number, number][] = []) {
  const m=MAP_BY_ID[b.map];
  for(let y=8;y<m.h-4;y+=3)for(let x=5;x<m.w-4;x+=3){
    if (clearings.some(([x0,y0,x1,y1]) => x>=x0 && x<=x1 && y>=y0 && y<=y1)) continue;
    if ([-1,0,1,2].some(dx=>b.edit.ground[key(x+dx,y)] || b.edit.ground[key(x,y+dx)])) continue;
    if ([-1,0,1].some(dy => [-1,0,1].some(dx => 'wD'.includes(m.grid[(y+dy)*m.w+x+dx])))) continue;
    if(b.edit.objects.some(o=>{const it=ITEM_BY_ID[o.id];return it.place==='building'&&x>=o.x-1&&x<=o.x+it.w&&y>=o.y+it.h&&y<=o.y+it.h+3;}))continue;
    if((x*7+y*11)%13<9)b.put((x+y)%4===0?'tree-cherry-tree':(x+y)%3===0?'tree-maple-tree':'tree-oak-tree',x,y);
  }
  for(let y=8;y<m.h-4;y++)for(let x=5;x<m.w-4;x++)if(!b.edit.ground[key(x,y)]&&(x*7+y*3)%5!==0)b.put('grass',x,y);
}
function forestGarden() {
  const b=new Builder('forest','spring');
  trail(b,[[40,8],[40,17],[33,21],[27,28],[27,41],[32,48],[43,51],[56,50],[59,43],[59,27],[64,20]]);
  trail(b,[[27,28],[20,24],[20,15],[29,12],[40,17]]);
  trail(b,[[27,41],[20,47],[24,57],[38,59],[43,51]]);
  trail(b,[[59,27],[48,27],[45,21],[40,17]]);
  b.put('deluxe-barn',20,34);b.put('deluxe-coop',23,49);b.put('big-shed',47,19);b.put('mill',33,11);
  garden(b,28,14,'crop-tulip');garden(b,34,22,'crop-strawberry');garden(b,22,27,'crop-blue-jazz');
  garden(b,30,49,'crop-cauliflower');garden(b,47,43,'crop-tulip');
  for(const [x,y] of [[50,32],[54,32],[50,37],[54,37]])b.put('bee-house',x,y);
  b.rect('crop-blue-jazz',51,34,54,35);
  for(const [x,y] of [[21,22],[29,37],[33,47],[42,53],[58,41],[61,25]]){b.put('wood-lamp-post',x,y);b.put('tub-o-flowers',x+1,y);}
  planting(b);
  return b.plan('Clover Hollow','Woodland walks, small flower gardens and a tucked-away spring apiary.');
}
function fourGardens() {
  const b=new Builder('four-corners','summer');
  // Each courtyard has a different purpose, joined through the map's existing crossings.
  trail(b,[[41,10],[41,30],[41,43],[42,57]]);
  trail(b,[[13,29],[29,29],[41,29],[57,29],[69,26]]);
  trail(b,[[15,43],[27,43],[41,43],[53,43],[64,49]]);
  trail(b,[[18,15],[18,29],[18,43],[18,53]]);
  trail(b,[[55,17],[55,29],[55,43],[55,56]]);
  for(const [x,y,c] of [[9,13,'crop-poppy'],[16,13,'crop-melon'],[23,13,'crop-summer-spangle'],[9,21,'crop-blueberry'],[23,21,'crop-starfruit'],[46,38,'crop-summer-spangle'],[53,38,'crop-poppy']] as [number,number,string][])garden(b,x,y,c);
  b.put('big-shed',46,17);b.put('mill',59,20);b.put('deluxe-barn',10,37);b.put('deluxe-coop',23,47);
  b.put('fish-pond',60,39);b.put('fish-pond',66,47);
  for(const x of [47,51,59])for(const y of [49,53])b.put('bee-house',x,y);
  b.rect('crop-summer-spangle',48,51,52,51);
  for(const [x,y] of [[16,32],[26,30],[43,31],[53,31],[20,45],[43,45],[56,57]]){b.put('wood-lamp-post',x,y);b.put('tub-o-flowers',x+1,y);}
  planting(b);
  return b.plan('Sunflower Courtyards','Four leafy courtyards for flowers, orchards, animals and honey.');
}
function workshop(){
 const b=new Builder('big-shed','spring');
 for(const x of [1,2,3,4,5,12,13,14,15,16])b.put('chest',x,4);
 for(const x of [7,8,9])b.put('chest',x,6);
 b.put('workbench',8,7);
 for(const x of [1,2,3,4])for(const y of [7,9])b.put('furnace',x,y);
 for(const x of [13,14,15,16])for(const y of [7,8])b.put('crystalarium',x,y);
 b.put('luxury-bookcase',6,10);b.put('luxury-bookcase',10,10);
 for(const x of [1,2,3,4,5,6])for(const y of [12,13])b.put('keg',x,y);
 for(const x of [11,12,13,14,15,16])for(const y of [12,13])b.put('preserves-jar',x,y);
 for(const [x,y] of [[6,4],[10,4],[6,7],[10,7],[7,11],[10,11],[7,14],[10,14]])b.put('house-plant',x,y);
 for(const x of [6,11])b.put('country-lamp',x,9);
 return {...b.plan('Fern & Copper Workshop','A leafy crafting room with clear aisles, a central workbench and warm reading corners.'),source:{author:'SaturdayNightSwiftie',url:'https://www.reddit.com/r/StardewHomeDesign/comments/w6lcwe/'}};
}
function aquarium(){
 const b=new Builder('big-shed','spring');
 b.put('deluxe-fish-tank',2,4);b.put('deluxe-fish-tank',11,4);
 b.put('oceanic-rug',6,7);
 for(const x of [1,15]){b.put('modern-fish-tank',x,8);b.put('modern-fish-tank',x,11);}
 for(const [x,y] of [[2,7],[5,7],[12,7],[16,7],[2,13],[5,13],[12,13],[16,13]])b.put('house-plant',x,y);
 b.put('oak-bench',7,11);b.put('oak-bench',10,11);
 for(const x of [6,13])b.put('country-lamp',x,10);
 for(const x of [2,5,12,15])b.put('small-fish-tank',x,14);
 return {...b.plan('Tidepool Gallery','An aquarium-inspired shed with a blue reading lounge and planted display alcoves.'),source:{author:'oOFerris_BuellerOo',url:'https://www.reddit.com/r/StardewHomeDesign/comments/1evfkss/'}};
}
function islandGarden(honey = false) {
  const b = new Builder('ginger-island', 'summer');
  trail(b, [[76,43],[76,48],[70,53],[70,64],[64,68]], 'weathered-floor');
  trail(b, [[63,53],[76,53],[94,53]], 'weathered-floor');
  trail(b, [[62,63],[76,63],[94,63]], 'weathered-floor');
  for (const [x,y] of [[78,46],[85,46],[78,56],[85,56],[70,56]]) {
    garden(b,x,y,honey ? 'crop-fairy-rose' : ((x+y)%2 ? 'crop-starfruit' : 'crop-pineapple'));
    if(honey) for(const [dx,dy] of [[-2,0],[-2,2],[-2,4],[6,0],[6,2],[6,4]]) b.put('bee-house',x+dx,y+dy);
  }
  for(const [x,y] of [[92,45],[96,49],[96,56],[94,64],[87,66],[80,67],[72,67],[65,65],[61,60]]) {
    b.put((x+y)%2 ? 'tree-banana-tree':'tree-mango-tree',x,y);
    b.rect('grass',x-1,y,x+1,y+1);
  }
  for(const [x,y] of [[75,47],[72,54],[77,62],[92,53]]) {b.put('wood-lamp-post',x,y);b.put('tub-o-flowers',x+1,y);}
  b.put('chest',74,44);b.put('mini-shipping-bin',75,44);
  return b.plan(honey ? 'Coral Honey Gardens' : 'Mango Cove', honey ? 'Flower courtyards, tropical fruit trees and little honey gardens beside the river.' : 'Pineapple and starfruit gardens along a winding boardwalk, framed by mango and banana trees.');
}
/** A working orchard with a garden lane, animal paddocks and a pond walk. */
function orchardLane() {
  const b = new Builder('standard', 'summer');
  trail(b, [[40,8],[40,16],[45,23],[45,37],[52,44],[62,44],[68,36],[68,20]]);
  trail(b, [[40,16],[21,16],[17,24],[17,44],[26,52],[44,52],[52,44]]);
  trail(b, [[17,33],[31,33],[45,33]]);
  b.put('big-shed',31,11); b.put('mill',46,15);
  b.put('deluxe-barn',54,24); b.put('deluxe-coop',61,33);
  b.put('silo',63,24); b.put('fish-pond',57,49);
  for (const x of [22,27,32]) for (const y of [22,27]) {
    b.put(x === 22 ? 'tree-peach-tree' : x === 27 ? 'tree-orange-tree' : 'tree-pomegranate-tree',x,y);
    b.rect('grass',x-1,y,x+1,y+1);
  }
  for (const [x,y,crop] of [[23,37,'crop-melon'],[30,37,'crop-blueberry'],[37,37,'crop-summer-spangle'],[30,45,'crop-starfruit']] as [number,number,string][]) garden(b,x,y,crop);
  b.rect('wood-floor',52,31,62,39,true);
  for (const [x,y] of [[53,33],[56,36],[59,33]]) b.put('animal-brown-cow',x,y);
  for (const x of [23,26,29,32]) b.put('preserves-jar',x,18);
  for (const [x,y] of [[18,24],[18,42],[36,34],[46,26],[51,45],[65,43]]) { b.put('wood-lamp-post',x,y); b.put('tub-o-flowers',x+1,y); }
  planting(b, [[20,20,35,30],[51,30,65,42]]);
  return b.plan('Peach Blossom Lane','A summer orchard with jam-making corners, cottage gardens and a leafy animal paddock.');
}

/** A flower-and-honey clearing, shaped around the Forest map's ponds. */
function woodlandApiary() {
  const b = new Builder('forest', 'fall');
  trail(b, [[40,8],[40,17],[32,25],[29,36],[29,44],[37,50],[55,50],[60,41],[60,24],[66,20]]);
  trail(b, [[29,36],[20,32],[19,21],[27,17],[40,17]]);
  trail(b, [[29,44],[20,50],[23,58],[38,58],[37,50]]);
  b.put('big-shed',32,11); b.put('mill',46,19); b.put('deluxe-coop',21,41);
  for (const [x,y] of [[22,22],[32,29],[30,51],[49,43]]) {
    garden(b,x,y,'crop-fairy-rose');
    for (const dx of [0,2,4]) { b.put('bee-house',x+dx,y-2); b.put('bee-house',x+dx,y+6); }
  }
  for (const [x,y] of [[17,27],[20,35],[25,38],[42,21],[54,24],[61,35],[42,52]]) {
    b.put('tree-apple-tree',x,y);
  }
  for (const [x,y] of [[28,19],[30,39],[40,50],[57,47],[60,28]]) { b.put('wood-lamp-post',x,y); b.put('tub-o-flowers',x+1,y); }
  b.put('chest',37,16); b.put('preserves-jar',35,16); b.put('preserves-jar',36,16);
  planting(b);
  return b.plan('Foxglove Hollow','Fairy-rose honey gardens and apple trees around a winding woodland loop.');
}

/** Four distinct destinations: flower beds, home workshops, ponds and orchard. */
function pondCourts() {
  const b = new Builder('four-corners', 'spring');
  trail(b, [[41,9],[41,29],[41,44],[41,58]]);
  trail(b, [[17,28],[41,28],[61,28],[67,21]]);
  trail(b, [[18,44],[41,44],[59,44],[66,52]]);
  trail(b, [[18,15],[18,28],[18,44],[18,58]]);
  trail(b, [[57,16],[57,28],[57,44],[57,60]]);
  b.put('big-shed',47,16); b.put('mill',61,20);
  for (const [x,y,crop] of [[9,13,'crop-tulip'],[23,13,'crop-blue-jazz'],[9,21,'crop-strawberry'],[23,21,'crop-cauliflower']] as [number,number,string][]) garden(b,x,y,crop);
  for (const [x,y] of [[9,37],[23,37],[9,48],[23,48]]) {
    b.put('fish-pond',x,y);
    trail(b,[[x+2,y+5],[x+2,y+6],[18,y+6]],'stone-floor');
    b.put('wood-lamp-post',x+5,y+4);
  }
  for (const x of [47,52,62,67]) for (const y of [39,49,56]) b.put((x+y)%2 ? 'tree-cherry-tree':'tree-apricot-tree',x,y);
  b.put('deluxe-coop',46,61);
  for(const [x,y] of [[19,17],[19,33],[42,30],[58,34],[58,54],[28,56]]) b.put('tub-o-flowers',x,y);
  planting(b, [[45,37,70,59],[8,36,29,55]]);
  return b.plan('Willow Pond Courts','Four garden rooms: spring flowers, a workshop lane, fish ponds and a flowering orchard.');
}

const out = [fixture('marigold'),forestGarden(),fourGardens(),islandGarden(),islandGarden(true),fixture('cafe'),workshop(),aquarium(),orchardLane(),woodlandApiary(),pondCourts()];
fs.writeFileSync(path.join(__dirname,'../src/data/generated/templates.json'),JSON.stringify(out));
for(const t of out)console.log(`${t.name}: ${t.objects.length} objects on ${t.map}`);
