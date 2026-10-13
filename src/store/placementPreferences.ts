import { ITEM_BY_ID } from '../data/items';

export const DEFAULT_RECENT = ['crop-parsnip', 'sprinkler', 'scarecrow', 'wood-fence', 'cobblestone-path', 'keg'];
export function placementPreferences(raw: unknown): { itemId: string; recent: string[] } {
  const valid = (id: unknown): id is string => typeof id === 'string' && !!ITEM_BY_ID[id]?.place && !ITEM_BY_ID[id].legacy;
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const itemId = valid(value.itemId) ? value.itemId : 'crop-parsnip';
  const recent = [...new Set([...(Array.isArray(value.recent) ? value.recent.filter(valid) : DEFAULT_RECENT)])].slice(0, 12);
  if (!recent.includes(itemId)) recent.unshift(itemId);
  return { itemId, recent: recent.slice(0, 12) };
}
