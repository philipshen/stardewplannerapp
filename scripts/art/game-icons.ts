/** Inventory sprites supplied by the pinned game-data package. */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { Img } from './png';

const root = path.join(__dirname, '../../node_modules/stardew-valley-data');
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const sources = new Map<string, string>();
function inventory(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) inventory(full);
    else if (entry.name.endsWith('.png')) sources.set(norm(entry.name.slice(0, -4)), full);
  }
}
inventory(path.join(root, 'images'));
function visit(value: unknown) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(visit); return; }
  const rec = value as Record<string, unknown>;
  for (const [nameKey, imageKey] of [['name', 'image'], ['seedName', 'seedImage']]) {
    const name = rec[nameKey], image = rec[imageKey];
    if (typeof name === 'string' && typeof image === 'string' && image.startsWith('images/') && image.endsWith('.png')) {
      const file = path.join(root, image);
      if (fs.existsSync(file)) sources.set(norm(name), file);
    }
  }
  Object.values(rec).forEach(visit);
}
for (const file of fs.readdirSync(path.join(root, 'data'))) {
  if (file.endsWith('.json')) visit(JSON.parse(fs.readFileSync(path.join(root, 'data', file), 'utf8')));
}
export function gameIcon(name: string): Img | null {
  const aliases: Record<string, string> = { 'Pan': 'Copper Pan', 'Turtle (1)': 'Turtle', 'Iridium Turtle (2)': 'Iridium Turtle' };
  const file = sources.get(norm(aliases[name] ?? name));
  if (!file) return null;
  const source = PNG.sync.read(fs.readFileSync(file));
  const img = new Img(source.width, source.height);
  img.data.set(source.data);
  return img;
}
