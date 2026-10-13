/** Custom layouts (user images used as a farm background), stored on the device. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { CustomLayout, registerCustomMap, unregisterCustomMap, validateLayout } from '../data/maps';

const KEY = 'sdp:layouts:v1';

type LayoutsState = {
  layouts: CustomLayout[];
  load: () => Promise<void>;
  add: (l: CustomLayout) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const newLayoutId = () => 'custom-' + Math.random().toString(36).slice(2, 10);

export const useLayouts = create<LayoutsState>((set, get) => ({
  layouts: [],
  async load() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const layouts = (raw ? (JSON.parse(raw) as unknown[]) : []).map(validateLayout).filter(Boolean) as CustomLayout[];
      layouts.forEach(registerCustomMap);
      set({ layouts });
    } catch {
      set({ layouts: [] });
    }
  },
  async add(l) {
    registerCustomMap(l);
    const layouts = [l, ...get().layouts.filter((x) => x.id !== l.id)];
    set({ layouts });
    await AsyncStorage.setItem(KEY, JSON.stringify(layouts));
  },
  async remove(id) {
    unregisterCustomMap(id);
    const layouts = get().layouts.filter((x) => x.id !== id);
    set({ layouts });
    await AsyncStorage.setItem(KEY, JSON.stringify(layouts));
  },
}));
