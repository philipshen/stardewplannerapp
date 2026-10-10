/** Local persistence for named saves (no backend). */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { newPlan, Plan, uid, validatePlan } from '../planner/model';
import type { Season } from '../theme';

export type SaveMeta = {
  id: string;
  name: string;
  map: string;
  season: Season;
  createdAt: number;
  updatedAt: number;
  count: number;
  thumb?: string;
};

const INDEX_KEY = 'sdp:index:v1';
const planKey = (id: string) => `sdp:plan:v1:${id}`;
const thumbKey = (id: string) => `sdp:thumb:v1:${id}`;

type SavesState = {
  loaded: boolean;
  saves: SaveMeta[];
  load: () => Promise<void>;
  create: (name: string, map: string, season: Season) => Promise<Plan>;
  get: (id: string) => Promise<Plan | null>;
  write: (plan: Plan) => Promise<void>;
  setThumb: (id: string, thumb: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  duplicate: (id: string) => Promise<SaveMeta | null>;
  remove: (id: string) => Promise<void>;
  importPlan: (data: unknown) => Promise<Plan | null>;
};

const metaOf = (p: Plan, thumb?: string): SaveMeta => ({
  id: p.id, name: p.name, map: p.map, season: p.season, createdAt: p.createdAt, updatedAt: p.updatedAt,
  count: p.objects.length + Object.keys(p.ground).length, thumb,
});

async function persistIndex(saves: SaveMeta[]) {
  // Thumbnails live under their own keys to keep the index small.
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(saves.map(({ thumb, ...m }) => m)));
}

export const useSaves = create<SavesState>((set, get) => ({
  loaded: false,
  saves: [],
  async load() {
    try {
      const raw = await AsyncStorage.getItem(INDEX_KEY);
      const list: SaveMeta[] = raw ? JSON.parse(raw) : [];
      const thumbs = list.length ? await AsyncStorage.multiGet(list.map((s) => thumbKey(s.id))) : [];
      const tmap = Object.fromEntries(thumbs.map(([k, v]) => [k, v ?? undefined]));
      set({ loaded: true, saves: list.map((s) => ({ ...s, thumb: tmap[thumbKey(s.id)] })).sort((a, b) => b.updatedAt - a.updatedAt) });
    } catch {
      set({ loaded: true, saves: [] });
    }
  },
  async create(name, map, season) {
    const plan = newPlan(name.trim() || 'My Farm', map, season);
    await AsyncStorage.setItem(planKey(plan.id), JSON.stringify(plan));
    const saves = [metaOf(plan), ...get().saves];
    set({ saves });
    await persistIndex(saves);
    return plan;
  },
  async get(id) {
    const raw = await AsyncStorage.getItem(planKey(id));
    if (!raw) return null;
    try {
      const p = validatePlan(JSON.parse(raw));
      if (p) p.id = id;
      return p;
    } catch {
      return null;
    }
  },
  async write(plan) {
    await AsyncStorage.setItem(planKey(plan.id), JSON.stringify(plan));
    const prev = get().saves.find((s) => s.id === plan.id);
    const meta = metaOf(plan, prev?.thumb);
    const saves = [meta, ...get().saves.filter((s) => s.id !== plan.id)];
    set({ saves });
    await persistIndex(saves);
  },
  async setThumb(id, thumb) {
    await AsyncStorage.setItem(thumbKey(id), thumb);
    set({ saves: get().saves.map((s) => (s.id === id ? { ...s, thumb } : s)) });
  },
  async rename(id, name) {
    const plan = await get().get(id);
    if (!plan) return;
    plan.name = name.trim().slice(0, 60) || plan.name;
    plan.updatedAt = Date.now();
    await get().write(plan);
  },
  async duplicate(id) {
    const plan = await get().get(id);
    if (!plan) return null;
    const copy: Plan = { ...plan, id: uid(), name: `${plan.name} (copy)`.slice(0, 60), createdAt: Date.now(), updatedAt: Date.now() };
    await get().write(copy);
    const thumb = get().saves.find((s) => s.id === id)?.thumb;
    if (thumb) await get().setThumb(copy.id, thumb);
    return get().saves.find((s) => s.id === copy.id) ?? null;
  },
  async remove(id) {
    await AsyncStorage.multiRemove([planKey(id), thumbKey(id)]);
    const saves = get().saves.filter((s) => s.id !== id);
    set({ saves });
    await persistIndex(saves);
  },
  async importPlan(data) {
    const plan = validatePlan(data);
    if (!plan) return null;
    plan.id = uid();
    await get().write(plan);
    return plan;
  },
}));
