/** Pinned original TMX + tilesheets, rendered at the game's 16px tile scale. */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { Img } from './png';

const root = path.join(__dirname, '../../assets/game/slime-hutch');
const xml = fs.readFileSync(path.join(root, 'SlimeHutch.tmx'), 'utf8');
const attr = (text: string, name: string) => text.match(new RegExp(`${name}="([^"]+)"`))?.[1];
const map = xml.match(/<map\s+([^>]+)>/)![1];
export const HUTCH_WIDTH = Number(attr(map, 'width'));
export const HUTCH_HEIGHT = Number(attr(map, 'height'));
const layers = new Map([...xml.matchAll(/<layer\s+([^>]+)>([\s\S]*?)<\/layer>/g)].map(m => {
  const data = m[2].match(/<data encoding="csv">([\s\S]*?)<\/data>/)?.[1];
  if (!data) throw new Error('Expected CSV map layer');
  const tiles = data.split(',').map(s => Number(s.trim()));
  if (tiles.length !== HUTCH_WIDTH * HUTCH_HEIGHT) throw new Error('Invalid Slime Hutch layer size');
  return [attr(m[1], 'name')!, tiles] as const;
}));
export function hutchFloor(x: number, y: number) {
  return x >= 1 && x <= 16 && y >= 4 && y <= 11 && layers.get('Buildings')![y * HUTCH_WIDTH + x] === 0;
}
export function renderSlimeHutch(width: number, height: number) {
  const sheets = [...xml.matchAll(/<tileset\s+([^>]+)>([\s\S]*?)<\/tileset>/g)].map(m => ({
    first: Number(attr(m[1], 'firstgid')), columns: Number(attr(m[1], 'columns')),
    name: attr(m[2].match(/<image\s+([^>]+)\/>/)![1], 'source')!,
  })).filter(s => s.name !== 'paths').map(s => {
    const png = PNG.sync.read(fs.readFileSync(path.join(root, `${s.name}.png`)));
    const image = new Img(png.width, png.height); image.data.set(png.data);
    return { ...s, image };
  }).sort((a, b) => b.first - a.first);
  const image = new Img(width * 16, height * 16);
  for (const name of ['Back', 'Back2', 'Buildings', 'Front']) {
    for (const [i, gid] of layers.get(name)!.entries()) {
      if (!gid) continue;
      if (gid >= 0x10000000) throw new Error('Unsupported flipped map tile');
      const sheet = sheets.find(s => s.first <= gid);
      if (!sheet) throw new Error(`Missing tilesheet for ${gid}`);
      const tile = gid - sheet.first;
      image.blit(sheet.image, i % HUTCH_WIDTH * 16, Math.floor(i / HUTCH_WIDTH) * 16,
        tile % sheet.columns * 16, Math.floor(tile / sheet.columns) * 16, 16, 16);
    }
  }
  return image;
}
