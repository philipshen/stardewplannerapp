import { MAP_IMAGES } from './generated/assets';
import { MAP_BY_ID } from './maps';

/** Source for Skia's useImage: a bundled module id, or a URI for custom layouts. */
export function mapImage(id: string, season: string): number | string | undefined {
  const custom = MAP_BY_ID[id]?.image;
  if (custom) return custom;
  const m = MAP_IMAGES[id];
  return m?.[season] ?? m?.spring;
}

/** Source for React Native's Image. */
export function mapThumb(id: string) {
  const custom = MAP_BY_ID[id]?.image;
  if (custom) return { uri: custom };
  return MAP_IMAGES[id]?.thumb;
}
