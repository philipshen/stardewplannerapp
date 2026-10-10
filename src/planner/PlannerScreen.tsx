import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ITEM_BY_ID } from '../data/items';
import { MAP_BY_ID } from '../data/maps';
import { useEditor } from '../store/editor';
import { useSaves } from '../store/saves';
import { C, SEASON_META } from '../theme';
import { Dialog, Glyph, IconButton, ItemIcon, PixelButton, PText, Sheet, TextField, tap } from '../components/ui';
import { sharePNG, shareJSON } from '../lib/files';
import { FarmCanvas, FarmCanvasHandle } from './FarmCanvas';
import { ItemPicker } from './ItemPicker';
import { InfoCard, LayersSheet, StatsSheet } from './Panels';
import { buildOcc, canPlace, Placed, uid } from './model';

export default function PlannerScreen({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const saves = useSaves();
  const plan = useEditor((s) => s.plan);
  const tool = useEditor((s) => s.tool);
  const shape = useEditor((s) => s.shape);
  const item = useEditor((s) => s.item);
  const past = useEditor((s) => s.past.length);
  const future = useEditor((s) => s.future.length);
  const dirty = useEditor((s) => s.dirty);
  const toast = useEditor((s) => s.toast);
  const selection = useEditor((s) => s.selection);
  const ed = useEditor.getState;
  const canvas = useRef<FarmCanvasHandle>(null);
  const [picker, setPicker] = useState(false);
  const [stats, setStats] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [missing, setMissing] = useState(false);

  // ---------------------------------------------------------------- load
  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await saves.get(id);
      if (!alive) return;
      if (!p) { setMissing(true); return; }
      ed().open(p);
    })();
    return () => { alive = false; ed().close(); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- autosave (debounced) + thumbnail
  const saveNow = useCallback(async () => {
    const p = ed().plan;
    if (!p) return;
    await saves.write(p);
    const b64 = canvas.current?.exportPNG(0.25);
    if (b64) await saves.setThumb(p.id, `data:image/png;base64,${b64}`);
    setSaved(true);
  }, [saves]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dirty) return;
    setSaved(false);
    const t = setTimeout(saveNow, 900);
    return () => clearTimeout(t);
  }, [dirty, saveNow]);

  // Save on leave.
  useEffect(() => () => { const p = ed().plan; if (p && ed().dirty) saves.write(p); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    setToastMsg(toast.msg);
    const t = setTimeout(() => setToastMsg(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------------------------------------------------------------- keyboard shortcuts (web)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? ed().redo() : ed().undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); ed().redo(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelection();
      else if (e.key === 'Escape') ed().select([]);
      else if (e.key === 'h') ed().setTool('pan');
      else if (e.key === 'b' || e.key === 'p') ed().setTool('place');
      else if (e.key === 'e') ed().setTool('erase');
      else if (e.key === 'v') ed().setTool('select');
      else if (e.key === '/') { e.preventDefault(); setPicker(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- selection actions
  const selected: Placed | null = plan && selection.size ? plan.objects.find((o) => selection.has(o.u)) ?? null : null;

  const deleteSelection = () => {
    const st = ed();
    if (!st.plan || !st.selection.size) return;
    st.commit({ ground: st.plan.ground, objects: st.plan.objects.filter((o) => !st.selection.has(o.u)) });
    st.select([]);
  };

  const duplicateSelection = () => {
    const st = ed();
    if (!st.plan || !st.selection.size) return;
    const sel = st.plan.objects.filter((o) => st.selection.has(o.u));
    const xs = sel.map((o) => o.x), xe = sel.map((o) => o.x + ITEM_BY_ID[o.id].w);
    const width = Math.max(...xe) - Math.min(...xs);
    const ys = sel.map((o) => o.y), ye = sel.map((o) => o.y + ITEM_BY_ID[o.id].h);
    const height = Math.max(...ye) - Math.min(...ys);
    const occ = buildOcc(st.plan.objects);
    for (const [dx, dy] of [[width, 0], [0, height], [-width, 0], [0, -height], [width, height]]) {
      if (sel.every((o) => canPlace(st.plan!, occ, ITEM_BY_ID[o.id], o.x + dx, o.y + dy).ok)) {
        const copies = sel.map((o) => ({ ...o, u: uid(), x: o.x + dx, y: o.y + dy }));
        st.commit({ ground: st.plan.ground, objects: [...st.plan.objects, ...copies] });
        st.select(copies.map((c) => c.u));
        return;
      }
    }
    st.showToast('No room next to the selection');
  };

  // ---------------------------------------------------------------- export
  const exportImage = async () => {
    setMenu(false);
    const b64 = canvas.current?.exportPNG(2);
    if (!b64) return ed().showToast('Export failed');
    try { await sharePNG(b64, plan?.name ?? 'farm'); } catch (e) { ed().showToast('Sharing was cancelled'); }
  };
  const exportFile = async () => {
    setMenu(false);
    if (!plan) return;
    try { await shareJSON(plan, plan.name); } catch { ed().showToast('Sharing was cancelled'); }
  };
  const clearAll = () => {
    setMenu(false);
    const run = () => { const st = ed(); if (st.plan) { st.commit({ ground: {}, objects: [] }); st.select([]); } };
    if (Platform.OS === 'web') { if (window.confirm('Remove everything from this farm? You can undo this.')) run(); }
    else Alert.alert('Clear farm?', 'Remove everything from this farm? You can undo this.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: run }]);
  };

  if (missing) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <PText size={20} weight="bold" color={C.parchment}>This farm could not be found.</PText>
        <PixelButton label="Back to farms" onPress={() => router.replace('/')} style={{ marginTop: 16 }} />
      </View>
    );
  }
  if (!plan) return <View style={styles.center}><PText color={C.parchment}>Loading farm…</PText></View>;

  const map = MAP_BY_ID[plan.map];
  const tools: { t: typeof tool; glyph: 'hand' | 'pencil' | 'eraser' | 'select'; label: string }[] = [
    { t: 'pan', glyph: 'hand', label: 'Pan' },
    { t: 'place', glyph: 'pencil', label: 'Place' },
    { t: 'erase', glyph: 'eraser', label: 'Erase' },
    { t: 'select', glyph: 'select', label: 'Select' },
  ];

  return (
    <View style={styles.root}>
      <FarmCanvas ref={canvas} onSelect={() => {}} />

      {/* top bar */}
      <View style={[styles.top, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <View style={styles.topRow}>
          <IconButton glyph="back" label="Back to farms" onPress={async () => { await saveNow(); router.back(); }} />
          <Pressable style={styles.title} onPress={() => setRenaming(plan.name)} accessibilityLabel="Rename farm">
            <PText size={17} weight="bold" numberOfLines={1}>{plan.name}</PText>
            <PText size={12} color={C.inkSoft} numberOfLines={1}>
              {map.name}{map.kind === 'farm' ? ` · ${SEASON_META[plan.season].label}` : ''} · {saved ? 'Saved ✓' : 'Saving…'}
            </PText>
          </Pressable>
          <IconButton glyph="undo" label="Undo" onPress={() => ed().undo()} disabled={!past} />
          <IconButton glyph="redo" label="Redo" onPress={() => ed().redo()} disabled={!future} />
          <IconButton glyph="menu" label="Menu" onPress={() => setMenu(true)} />
        </View>
      </View>

      {/* side controls */}
      <View style={[styles.side, { top: insets.top + 74 }]} pointerEvents="box-none">
        <IconButton glyph="layers" label="Layers" onPress={() => setLayersOpen(true)} />
        <IconButton glyph="stats" label="Summary" onPress={() => setStats(true)} />
        <IconButton glyph="plus" label="Zoom in" onPress={() => canvas.current?.zoomBy(1.4)} />
        <IconButton glyph="zoom" label="Zoom out" onPress={() => canvas.current?.zoomBy(1 / 1.4)} />
        <IconButton glyph="target" label="Fit map" onPress={() => canvas.current?.fit()} />
      </View>

      {toastMsg && (
        <View style={[styles.toast, { top: insets.top + 74 }]} pointerEvents="none">
          <PText size={15} weight="semibold" color={C.white}>{toastMsg}</PText>
        </View>
      )}

      {/* bottom */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
        {selected && tool === 'select' && (
          <InfoCard
            obj={selected}
            onClose={() => ed().select([])}
            onDelete={deleteSelection}
            onDuplicate={duplicateSelection}
            onUse={() => { const it = ITEM_BY_ID[selected.id]; if (it) ed().pick(it); }}
          />
        )}
        <View style={styles.itemRow}>
          <Pressable style={styles.itemBtn} onPress={() => { tap(); setPicker(true); }} accessibilityLabel={`Selected item: ${item?.name ?? 'none'}. Choose item`}>
            {item ? <ItemIcon id={item.id} size={38} /> : <Glyph name="plus" size={28} />}
            <View style={{ flex: 1 }}>
              <PText size={11} color={C.inkSoft} weight="semibold">TAP TO CHOOSE ITEM</PText>
              <PText size={15} weight="bold" numberOfLines={1}>{item?.name ?? 'Choose…'}</PText>
            </View>
            <Glyph name="search" size={18} />
          </Pressable>
          {(tool === 'place' || tool === 'erase') && (
            <View style={styles.shapeRow}>
              {(['brush', 'rect', 'outline'] as const).map((s) => (
                <Pressable key={s} onPress={() => { tap(); ed().setShape(s); }} style={[styles.shapeBtn, shape === s && styles.shapeActive]} accessibilityLabel={s === 'brush' ? 'Brush' : s === 'rect' ? 'Area' : 'Outline'} accessibilityState={{ selected: shape === s }}>
                  <Glyph name={s === 'brush' ? 'brush' : s === 'rect' ? 'fill' : 'outline'} size={20} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
        <View style={styles.toolbar}>
          {tools.map((t) => (
            <Pressable key={t.t} onPress={() => { tap(); ed().setTool(t.t); }} style={[styles.toolBtn, tool === t.t && styles.toolActive]} accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{ selected: tool === t.t }}>
              <Glyph name={t.glyph} size={24} />
              <PText size={12} weight="semibold" color={tool === t.t ? C.white : C.parchmentLight}>{t.label}</PText>
            </Pressable>
          ))}
        </View>
      </View>

      <ItemPicker visible={picker} onClose={() => setPicker(false)} />
      <StatsSheet visible={stats} onClose={() => setStats(false)} />
      <LayersSheet visible={layersOpen} onClose={() => setLayersOpen(false)} />

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Farm menu" height="62%">
        <View style={{ gap: 10 }}>
          <PixelButton glyph="image" label="Export as image" onPress={exportImage} />
          <PixelButton glyph="share" label="Export plan file" onPress={exportFile} />
          <PixelButton glyph="edit" label="Rename farm" onPress={() => { setMenu(false); setRenaming(plan.name); }} />
          <PixelButton glyph="layers" label="View & layers" onPress={() => { setMenu(false); setLayersOpen(true); }} />
          <PixelButton glyph="book" label="Item index" onPress={() => { setMenu(false); router.push('/catalog'); }} />
          <PixelButton glyph="trash" tone="red" label="Clear farm" onPress={clearAll} />
          <PText size={12} color={C.inkSoft} style={{ marginTop: 6 }}>
            Tips: pinch or use two fingers to zoom and pan. Long-press an object to select it. In Select mode drag on empty ground to box-select a group.
          </PText>
        </View>
      </Sheet>

      <Dialog visible={renaming !== null} onClose={() => setRenaming(null)} title="Rename farm">
        <TextField value={renaming ?? ''} onChangeText={setRenaming} autoFocus maxLength={60} onSubmitEditing={() => { if (renaming) ed().rename(renaming); setRenaming(null); }} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <PixelButton label="Cancel" onPress={() => setRenaming(null)} style={{ flex: 1 }} />
          <PixelButton label="Save" tone="green" onPress={() => { if (renaming) ed().rename(renaming); setRenaming(null); }} style={{ flex: 1 }} />
        </View>
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1e120a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.wood },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 900, alignSelf: 'center', width: '100%' },
  title: { flex: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 3, borderColor: C.outline, backgroundColor: C.parchment, minHeight: 44, justifyContent: 'center' },
  side: { position: 'absolute', right: 10, gap: 8 },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(42,20,10,0.88)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: C.orange },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 10, gap: 8, maxWidth: 760, alignSelf: 'center', width: '100%' },
  itemRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  shapeRow: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: 10, borderWidth: 3, borderColor: C.outline, backgroundColor: C.parchment, alignItems: 'center' },
  shapeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  shapeActive: { backgroundColor: C.orange },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, borderRadius: 12, borderWidth: 3, borderColor: C.outline, backgroundColor: C.woodLight },
  toolBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 6, borderRadius: 8, borderWidth: 2, borderColor: 'transparent', minHeight: 56 },
  toolActive: { backgroundColor: C.orange, borderColor: C.outline },
  itemBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingHorizontal: 8, borderRadius: 10, borderWidth: 3, borderColor: C.outline, backgroundColor: C.parchment },
});
