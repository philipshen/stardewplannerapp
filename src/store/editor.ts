/** Editing session state for the planner screen (tool, selection, undo history). */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { Item, ITEM_BY_ID } from '../data/items';
import { MAP_BY_ID } from '../data/maps';
import { buildOcc, Edit, fitToMap, Occ, Placed, Plan } from '../planner/model';
import { DEFAULT_RECENT, placementPreferences } from './placementPreferences';
import type { Season } from '../theme';

export type Tool = 'pan' | 'place' | 'erase' | 'select';
export type Shape = 'single' | 'brush' | 'rect';

export type Layers = {
  night: boolean;
  wildlife: boolean;
  grid: boolean;
  coverage: boolean;
  water: boolean;
  crow: boolean;
  junimo: boolean;
  bee: boolean;
  /** Tint the tiles where buildings may stand. */
  buildable: boolean;
  /** Tint the tiles where crops may grow. */
  tillable: boolean;
  /** Ignore terrain rules when placing ("Allow placing anywhere"). */
  anywhere: boolean;
  warnings: boolean;
};

const PLACEMENT_KEY = 'sdp:placement:v1';
let pickRevision = 0;
let placementWrites = Promise.resolve();
let optionsLoad: Promise<void> | null = null;

const LAYERS_KEY = 'sdp:options:v1';
const DEFAULT_LAYERS: Layers = { night: false, wildlife: true, grid: true, coverage: true, water: true, crow: true, junimo: true, bee: true, buildable: false, tillable: false, anywhere: false, warnings: true };

type EditorState = {
  plan: Plan | null;
  occ: Occ;
  past: Edit[];
  future: Edit[];
  dirty: number;
  tool: Tool;
  shape: Shape;
  item: Item | null;
  recent: string[];
  selection: Set<string>;
  layers: Layers;
  toast: { msg: string; at: number } | null;

  open: (plan: Plan) => void;
  close: () => void;
  /** Apply an edit, optionally recording undo (strokes record once at start). */
  commit: (next: Edit, record?: boolean) => void;
  /** Snapshot for undo before a multi-step stroke. */
  checkpoint: () => void;
  /** Revert to the latest checkpoint without keeping it (used to cancel a stroke). */
  rollback: () => void;
  undo: () => void;
  redo: () => void;
  setTool: (t: Tool) => void;
  setShape: (s: Shape) => void;
  pick: (it: Item) => void;
  select: (uids: string[]) => void;
  setLayers: (l: Partial<Layers>) => void;
  loadOptions: () => Promise<void>;
  /** Switch the plan to another layout. Items outside the new map are removed. */
  setMap: (map: string) => void;
  setSeason: (s: Season) => void;
  rename: (name: string) => void;
  showToast: (msg: string) => void;
};

const snap = (p: Plan): Edit => ({ ground: p.ground, objects: p.objects });

export const useEditor = create<EditorState>((set, get) => ({
  plan: null,
  occ: buildOcc([]),
  past: [],
  future: [],
  dirty: 0,
  tool: 'place',
  shape: 'single',
  item: ITEM_BY_ID['crop-parsnip'] ?? null,
  recent: DEFAULT_RECENT,
  selection: new Set(),
  layers: DEFAULT_LAYERS,
  toast: null,

  open(plan) {
    set({ plan, occ: buildOcc(plan.objects), past: [], future: [], selection: new Set(), dirty: 0 });
  },
  close() {
    set({ plan: null, past: [], future: [], selection: new Set() });
  },
  commit(next, record = true) {
    const { plan, past } = get();
    if (!plan) return;
    const newPlan: Plan = { ...plan, ...next, updatedAt: Date.now() };
    set({
      plan: newPlan,
      occ: next.objects === plan.objects ? get().occ : buildOcc(next.objects),
      past: record ? [...past.slice(-99), snap(plan)] : past,
      future: record ? [] : get().future,
      dirty: get().dirty + 1,
    });
  },
  checkpoint() {
    const { plan, past } = get();
    if (!plan) return;
    set({ past: [...past.slice(-99), snap(plan)], future: [] });
  },
  rollback() {
    const { plan, past } = get();
    if (!plan || !past.length) return;
    const prev = past[past.length - 1];
    set({ plan: { ...plan, ...prev }, occ: buildOcc(prev.objects), past: past.slice(0, -1), dirty: get().dirty + 1 });
  },
  undo() {
    const { plan, past, future } = get();
    if (!plan || !past.length) return;
    const prev = past[past.length - 1];
    set({ plan: { ...plan, ...prev, updatedAt: Date.now() }, occ: buildOcc(prev.objects), past: past.slice(0, -1), future: [snap(plan), ...future].slice(0, 100), selection: new Set(), dirty: get().dirty + 1 });
  },
  redo() {
    const { plan, past, future } = get();
    if (!plan || !future.length) return;
    const next = future[0];
    set({ plan: { ...plan, ...next, updatedAt: Date.now() }, occ: buildOcc(next.objects), past: [...past, snap(plan)], future: future.slice(1), selection: new Set(), dirty: get().dirty + 1 });
  },
  setTool(tool) {
    set({ tool, selection: tool === 'select' ? get().selection : new Set() });
  },
  setShape(shape) { set({ shape }); },
  pick(it) {
    // Items already on the hotbar keep their slot.
    const recent = get().recent.includes(it.id) ? get().recent : [it.id, ...get().recent].slice(0, 12);
    pickRevision++;
    set({ item: it, recent, tool: 'place' });
    const saved = JSON.stringify({ itemId: it.id, recent });
    placementWrites = placementWrites.then(() => AsyncStorage.setItem(PLACEMENT_KEY, saved)).catch(() => {});
  },
  select(uids) { set({ selection: new Set(uids) }); },
  setLayers(l) {
    const layers = { ...get().layers, ...l };
    set({ layers });
    AsyncStorage.setItem(LAYERS_KEY, JSON.stringify(layers)).catch(() => {});
  },
  loadOptions() {
    // Hydrate once; a slow storage read must never overwrite a new user pick.
    if (optionsLoad) return optionsLoad;
    const revision = pickRevision;
    optionsLoad = Promise.all([
      AsyncStorage.getItem(LAYERS_KEY).then(raw => {
        if (raw) set({ layers: { ...DEFAULT_LAYERS, ...JSON.parse(raw) } });
      }).catch(() => {}),
      AsyncStorage.getItem(PLACEMENT_KEY).then(raw => {
        if (revision !== pickRevision) return;
        const saved = placementPreferences(raw ? JSON.parse(raw) : null);
        set({ item: ITEM_BY_ID[saved.itemId], recent: saved.recent });
      }).catch(() => {}),
    ]).then(() => {});
    return optionsLoad;
  },

  setMap(map) {
    const { plan } = get();
    if (!plan || plan.map === map || !MAP_BY_ID[map]) return;
    const next = fitToMap(plan, map);
    // A layout change clears undo history: older snapshots belong to the old map.
    set({ plan: { ...plan, ...next, map, updatedAt: Date.now() }, occ: buildOcc(next.objects), past: [], future: [], selection: new Set(), dirty: get().dirty + 1 });
  },
  setSeason(season) {
    const { plan } = get();
    if (!plan) return;
    set({ plan: { ...plan, season, updatedAt: Date.now() }, dirty: get().dirty + 1 });
  },
  rename(name) {
    const { plan } = get();
    if (!plan) return;
    set({ plan: { ...plan, name: name.trim().slice(0, 60) || plan.name, updatedAt: Date.now() }, dirty: get().dirty + 1 });
  },
  showToast(msg) { set({ toast: { msg, at: Date.now() } }); },
}));

export function selectedObjects(): Placed[] {
  const { plan, selection } = useEditor.getState();
  return plan ? plan.objects.filter((o) => selection.has(o.u)) : [];
}
