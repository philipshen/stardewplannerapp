import { MAP_IMAGES } from './generated/assets';

export function mapImage(id: string, season: string) {
  const m = MAP_IMAGES[id];
  return m?.[season] ?? m?.spring;
}

export function mapThumb(id: string) {
  return MAP_IMAGES[id]?.thumb;
}
