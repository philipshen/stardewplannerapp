/**
 * Radio and sound effects.
 *
 * The bundled soundtrack stations are indexed by scripts/gen-radio.ts. The app mixes with other
 * audio apps, so a user can keep their own music app playing and switch the radio off.
 */
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { create } from 'zustand';
import type { Season } from '../theme';

import { RADIO_STATIONS, RadioTrack } from './stations.generated';
import { PlayQueue } from './queue';
import { parseRadioSettings, RADIO_DEFAULTS, RadioSettings } from './settings';

export { RADIO_STATIONS };
/**
 * `auto` plays the track of the farm's season. `shuffle` plays every track in random order.
 * Other values are station ids from RADIO_STATIONS.
 */
export type StationId = string;
export const SPECIAL_STATIONS = ['auto', 'shuffle', 'off'] as const;

const SFX = {
  place: require('../../assets/sfx/place.wav'),
  erase: require('../../assets/sfx/erase.wav'),
  tap: require('../../assets/sfx/tap.wav'),
  select: require('../../assets/sfx/select.wav'),
  undo: require('../../assets/sfx/undo.wav'),
  error: require('../../assets/sfx/error.wav'),
  build: require('../../assets/sfx/build.wav'),
} as const;
export type SfxName = keyof typeof SFX;

type Settings = RadioSettings;
type RadioState = Settings & {
  /** Title of the track that plays now. */
  nowPlaying: string | null;
  paused: boolean;
  playing: boolean;
  position: number;
  duration: number;
  togglePause: () => void;
  /** Skips to the next track of the station. */
  next: () => void;
  setStation: (s: StationId) => void;
  setVolume: (v: number) => void;
  setSfx: (on: boolean) => void;
  load: () => Promise<void>;
};

const KEY = 'sdp:radio:v1';
const DEFAULTS = RADIO_DEFAULTS;

export const useRadio = create<RadioState>((set, get) => {
  const save = (patch: Partial<Settings>) => {
    set(patch);
    const { station, volume, sfx } = get();
    AsyncStorage.setItem(KEY, JSON.stringify({ station, volume, sfx })).catch(() => {});
    apply();
  };
  return {
    ...DEFAULTS,
    nowPlaying: null,
    paused: false,
    playing: false,
    position: 0,
    duration: 0,
    togglePause: () => { unlockAudio(); set({ paused: !get().paused }); apply(); },
    next: () => { skip(); },
    setStation: (station) => { unlockAudio(); queue.reset(); set({ paused: false }); save({ station }); },
    setVolume: (v) => save({ volume: Math.max(0, Math.min(1, Math.round(v * 10) / 10)) }),
    setSfx: (sfx) => save({ sfx }),
    async load() {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const settings = parseRadioSettings(JSON.parse(raw), RADIO_STATIONS.map((s) => s.id));
          set(settings);
          await AsyncStorage.setItem(KEY, JSON.stringify(settings));
        }
      } catch { /* keep defaults */ }
      apply();
    },
  };
});

// ---------------------------------------------------------------- music engine
type Playable = { key: string; source: number | string; title: string };

let music: AudioPlayer | null = null;
let playingKey: string | null = null;
/** Play order of the current station. */
const queue = new PlayQueue<Playable>();
let current: Playable | null = null;
let season: Season = 'spring';
/** Browsers allow sound only after the first touch or click. */
let unlocked = Platform.OS !== 'web';
let active = true;
let modeSet = false;

/** The farm that is open sets the season for the `auto` station. */
export function setRadioSeason(s: Season | null) {
  season = s ?? 'spring';
  if (useRadio.getState().station === 'auto') queue.reset();
  apply();
}

/** Call on the first user action. It starts the radio in browsers. */
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  apply();
}

const playable = (t: RadioTrack): Playable => ({ key: 'b:' + t.title, source: t.source, title: t.title });

/** Tracks of a station. */
function playlist(station: StationId): Playable[] {
  const all = RADIO_STATIONS.flatMap((s) => s.tracks);
  if (station === 'shuffle') return all.map(playable);
  if (station === 'auto') {
    const seasonal = all.filter((t) => t.season === season);
    if (seasonal.length) return seasonal.map(playable);
    const farming = RADIO_STATIONS.find((r) => r.id === 'farming')?.tracks ?? all;
    const match = farming.filter((t) => t.season === season || !t.season);
    return (match.length ? match : all).map(playable);
  }
  return (RADIO_STATIONS.find((s) => s.id === station)?.tracks ?? []).map(playable);
}

/** The next track of the current station. */
function nextTrack(): Playable | null {
  const { station } = useRadio.getState();
  return queue.next(station, playlist(station), current);
}

function skip() {
  unlockAudio();
  useRadio.setState({ paused: false });
  apply(true);
}

function apply(advance = false) {
  try {
    const { station, volume, paused } = useRadio.getState();
    const on = unlocked && active && !paused && station !== 'off' && volume > 0;
    if (!on) {
      music?.pause();
      return;
    }
    // Keep the playing track when it still belongs to the station.
    const list = playlist(station);
    if (advance || !current || !list.some((t) => t.key === current!.key)) current = nextTrack();
    if (!current) {
      music?.pause();
      useRadio.setState({ nowPlaying: null, playing: false, position: 0, duration: 0 });
      return;
    }
    if (!modeSet) {
      modeSet = true;
      // Respect the silent switch and let other music apps keep playing.
      setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
    if (!music) {
      music = createAudioPlayer(current.source);
      playingKey = current.key;
      music.addListener('playbackStatusUpdate', (st) => {
        useRadio.setState({ playing: st.playing, position: Math.floor(st.currentTime), duration: Math.floor(st.duration) });
        if (st.didJustFinish && !music?.loop) apply(true);
      });
    } else if (playingKey !== current.key) {
      music.replace(current.source);
      playingKey = current.key;
    } else if (advance) {
      music.seekTo(0).catch(() => {});
    }
    // A station with one track loops it without a gap.
    music.loop = list.length === 1;
    music.volume = volume;
    music.play();
    if (useRadio.getState().nowPlaying !== current.title) useRadio.setState({ nowPlaying: current.title });
  } catch { /* audio is optional: never break the app */ }
}

AppState.addEventListener('change', (s) => {
  active = s === 'active';
  apply();
});

// ---------------------------------------------------------------- sound effects
const sfxPlayers: Partial<Record<SfxName, AudioPlayer>> = {};
let lastSfx = 0;

/** Plays a short interface sound. Rapid repeats (a paint stroke) are thinned out. */
export function sfx(name: SfxName) {
  if (!unlocked || !useRadio.getState().sfx) return;
  const now = Date.now();
  if (now - lastSfx < 70) return;
  lastSfx = now;
  try {
    const p = (sfxPlayers[name] ??= createAudioPlayer(SFX[name]));
    p.volume = Math.min(1, 0.35 + useRadio.getState().volume * 0.5);
    p.seekTo(0).catch(() => {});
    p.play();
  } catch { /* ignore */ }
}
