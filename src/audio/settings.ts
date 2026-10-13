export type RadioSettings = { station: string; volume: number; sfx: boolean };
export const RADIO_DEFAULTS: RadioSettings = { station: 'auto', volume: 0.6, sfx: true };

/** Read only supported preferences; stored JSON must never replace store actions. */
export function parseRadioSettings(value: unknown, stationIds: readonly string[]): RadioSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...RADIO_DEFAULTS };
  const raw = value as Record<string, unknown>;
  const station = raw.station === 'soundtrack' ? 'shuffle' : raw.station;
  const allowed = ['auto', 'shuffle', 'off', ...stationIds];
  return {
    station: typeof station === 'string' && allowed.includes(station) ? station : RADIO_DEFAULTS.station,
    volume: typeof raw.volume === 'number' && Number.isFinite(raw.volume) ? Math.max(0, Math.min(1, raw.volume)) : RADIO_DEFAULTS.volume,
    sfx: typeof raw.sfx === 'boolean' ? raw.sfx : RADIO_DEFAULTS.sfx,
  };
}
