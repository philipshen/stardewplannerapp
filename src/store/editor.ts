/** Editing session state for the planner screen (tool, selection, undo history). */
import { create } from 'zustand';
import { Item, ITEM_BY_ID } from '../data/items';
import { buildOcc, Edit, Occ, Placed, Plan } from '../planner/model';
import type { Season } from '../theme';

export type Tool = 'pan' | 'place' | 'erase' | 'select';
export type Shape = 'brush' | 'rect' | 'outline';

export type Layers = {
  grid: boolean;
  coverage: boolean;
  water: boolean;
  crow: boolean;
  junimo: boolean;
  bee: boolean;
  blocked: boolean;
  warnings: boolean;
};

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
  shape: 'brush',
  item: ITEM_BY_ID['crop-parsnip'] ?? null,
  recent: ['crop-parsnip', 'sprinkler', 'scarecrow', 'wood-fence', 'cobblestone-path', 'keg'],
  selection: new Set(),
  layers: { grid: true, coverage: true, water: true, crow: true, junimo: true, bee: true, blocked: false, warnings: true },
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
    const recent = [it.id, ...get().recent.filter((r) => r !== it.id)].slice(0, 12);
    // Fences default to outline when using an area; floors to filled.
    set({ item: it, recent, tool: 'place' });
  },
  select(uids) { set({ selection: new Set(uids) }); },
  setLayers(l) { set({ layers: { ...get().layers, ...l } }); },
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
