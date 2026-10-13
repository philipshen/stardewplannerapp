import { recordPlanningSession } from '../lib/reviews';
import { useImportIntroduction } from '../components/ImportIntroduction';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ITEM_BY_ID } from '../data/items';
import { MAP_BY_ID } from '../data/maps';
import { useEditor } from '../store/editor';
import { exportable, useSaves } from '../store/saves';
import { C } from '../theme';
import { Dialog, Glyph, IconButton, ItemIcon, PixelButton, PText, Sheet, TextField, tap } from '../components/ui';
import { afterSheetCloses, pickText, sharePNG, shareJSON } from '../lib/files';
import { importSaveGame, isSaveGame } from '../lib/savegame';
import { FarmCanvas, FarmCanvasHandle } from './FarmCanvas';
import { ItemPicker } from './ItemPicker';
import { HelpSheet, InfoCard, LanguagePreferences, OptionsContent, StatsSheet } from './Panels';
import { GestureTutorial } from './GestureTutorial';
import { SettingsSections } from '../components/SettingsSections';
import { RadioContent } from '../components/RadioSheet';
import { setRadioSeason, sfx } from '../audio';
import { buildOcc, canPlace, Placed, soilForCrops, uid } from './model';
import { useT } from '../i18n';

export default function PlannerScreen({ id }: { id: string }) {
  const sessionStartedAt = useRef(0);
  const leaving = useRef(false);
  const insets = useSafeAreaInsets();
  const t = useT();
  const { width, height } = useWindowDimensions();
  const landscape = width > height || width - insets.left - insets.right >= 600;
  const hudWidth = landscape ? Math.min(420, (width - insets.left - insets.right) * 0.55) : undefined;
  // Actions are stable; subscribing to the save index would restart autosave on every write.
  const saves = useRef(useSaves.getState()).current;
  const plan = useEditor((s) => s.plan);
  const tool = useEditor((s) => s.tool);
  const shape = useEditor((s) => s.shape);
  const item = useEditor((s) => s.item);
  const recent = useEditor((s) => s.recent);
  const past = useEditor((s) => s.past.length);
  const future = useEditor((s) => s.future.length);
  const dirty = useEditor((s) => s.dirty);
  const toast = useEditor((s) => s.toast);
  const selection = useEditor((s) => s.selection);
  const ed = useEditor.getState;
  const canvas = useRef<FarmCanvasHandle>(null);
  const [contextItem, setContextItem] = useState<Placed | null>(null);
  const [itemDetails, setItemDetails] = useState(false);
  const [picker, setPicker] = useState(false);
  const [stats, setStats] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [help, setHelp] = useState(false);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  /** The `dirty` counter value that is already on disk. */
  const [savedAt, setSavedAt] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const saved = dirty === savedAt;
  const [missing, setMissing] = useState(false);

  // ---------------------------------------------------------------- load
  useEffect(() => { ed().loadOptions(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Record completion only when the walkthrough is dismissed.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem('sdp:gestures:v2').then((seen) => {
      if (alive && !seen) setTutorial(true);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const closeTutorial = () => {
    setTutorial(false);
    void AsyncStorage.setItem('sdp:gestures:v2', '1').catch(() => {});
  };

  // The radio's "Farm season" station follows the open farm.
  const season = plan?.season ?? null;
  useEffect(() => { setRadioSeason(season); return () => setRadioSeason(null); }, [season]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await saves.get(id);
      if (!alive) return;
      if (!p) { setMissing(true); return; }
      ed().open(p);
      sessionStartedAt.current = Date.now();
      leaving.current = false;
      setSavedAt(0);
      setSaveError(false);
    })();
    return () => {
      alive = false;
      // Snapshot before closing: later effect cleanups see an empty editor.
      const state = ed();
      if (state.plan?.id === id && state.dirty) {
        saves.write(state.plan).catch(() => {});
      }
      state.close();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- autosave (debounced) + thumbnail
  const saveNow = useCallback(async () => {
    const p = ed().plan;
    const at = ed().dirty;
    if (!p) return;
    try {
      await saves.write(p);
      setSavedAt(at);
      setSaveError(false);
    } catch {
      setSaveError(true);
      ed().showToast(t('planner.saveFailed'));
      return false;
    }
    // A thumbnail failure must not make a successfully saved plan look unsaved.
    try {
      const b64 = canvas.current?.exportPNG(0.25);
      if (b64) await saves.setThumb(p.id, `data:image/png;base64,${b64}`);
    } catch { /* the plan itself is safely stored */ }
    return true;
  }, [saves]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const flush = () => { if (ed().dirty) void saveNow(); };
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') flush(); });
    if (Platform.OS === 'web') window.addEventListener('pagehide', flush);
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') window.removeEventListener('pagehide', flush);
    };
  }, [saveNow, ed]);

  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(saveNow, 900);
    return () => clearTimeout(timer);
  }, [dirty, saveNow]);


  // ---------------------------------------------------------------- toast
  const [toastDone, setToastDone] = useState(0);
  const toastMsg = toast && toast.at !== toastDone ? toast.msg : null;
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToastDone(toast.at), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

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
      if (sel.every((o) => canPlace(st.plan!, occ, ITEM_BY_ID[o.id], o.x + dx, o.y + dy, undefined, st.layers.anywhere).ok)) {
        const copies = sel.map((o) => ({ ...o, u: uid(), x: o.x + dx, y: o.y + dy }));
        st.commit({ ground: soilForCrops(st.plan.ground, copies), objects: [...st.plan.objects, ...copies] });
        st.select(copies.map((c) => c.u));
        return;
      }
    }
    st.showToast(t('toast.noRoom'));
  };

  // ---------------------------------------------------------------- keyboard shortcuts (web)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      if (picker || stats || tutorial || help || menu || renaming !== null) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) ed().redo(); else ed().undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); ed().redo(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); }
      else if (e.key === 'Escape') ed().select([]);
      else if (e.key === 'h') ed().setTool('pan');
      else if (e.key === 'b' || e.key === 'p') ed().setTool('place');
      else if (e.key === 'e') ed().setTool('erase');
      else if (e.key === 'v') ed().setTool('select');
      else if (e.key === '/') { e.preventDefault(); setPicker(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picker, stats, tutorial, help, menu, renaming]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- export
  const exportImage = async () => {
    setMenu(false);
    await afterSheetCloses();
    const b64 = canvas.current?.exportPNG(2);
    if (!b64) return ed().showToast(t('toast.exportFailed'));
    try { await sharePNG(b64, plan?.name ?? 'farm'); } catch { ed().showToast(t('toast.shareCancelled')); }
  };
  const exportFile = async () => {
    setMenu(false);
    if (!plan) return;
    await afterSheetCloses();
    try { await shareJSON(await exportable(plan), plan.name); } catch { ed().showToast(t('toast.shareCancelled')); }
  };
  /** Like the web planner's "Upload save game": loads the farm from a game save into a new plan. */
  const importGameSave = async () => {
    setMenu(false);
    await afterSheetCloses();
    try {
      const f = await pickText();
      if (!f) return;
      if (!await saveNow()) return;
      const res = isSaveGame(f.text) ? importSaveGame(f.text) : null;
      const imported = res?.plan ?? (!isSaveGame(f.text) ? await saves.importPlan(JSON.parse(f.text)) : null);
      if (!imported) return ed().showToast(t('toast.notSave'));
      if (res) await saves.write(imported);
      router.replace(`/planner/${imported.id}`);
    } catch {
      ed().showToast(t('toast.badFile'));
    }
  };
  const { startImport, introduction } = useImportIntroduction(importGameSave);
  const leaveFarm = async () => {
    if (leaving.current) return;
    leaving.current = true;
    if (!await saveNow()) { leaving.current = false; return; }
    await recordPlanningSession(ed().dirty, Date.now() - sessionStartedAt.current);
    router.back();
  };
  const clearAll = () => {
    setMenu(false);
    const run = () => { const st = ed(); if (st.plan) { st.commit({ ground: {}, objects: [] }); st.select([]); } };
    if (Platform.OS === 'web') { if (window.confirm(t('menu.clearBody'))) run(); }
    else Alert.alert(t('menu.clearTitle'), t('menu.clearBody'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('menu.clearDo'), style: 'destructive', onPress: run }]);
  };

  if (missing) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <PText size={20} weight="bold" color={C.parchment}>{t('planner.missing')}</PText>
        <PixelButton label={t('planner.back')} onPress={() => router.replace('/')} style={{ marginTop: 16 }} />
      </View>
    );
  }
  if (!plan) return <View style={styles.center}><PText color={C.parchment}>{t('planner.loading')}</PText></View>;
  if (!MAP_BY_ID[plan.map]) {
    return (
      <View style={[styles.center, { paddingTop: insets.top, padding: 24 }]}>
        <PText size={20} weight="bold" color={C.parchment} style={{ textAlign: 'center' }}>{t('planner.noLayout')}</PText>
        <PixelButton label={t('planner.useStandard')} tone="green" onPress={() => ed().setMap('standard')} style={{ marginTop: 16 }} />
        <PixelButton label={t('planner.back')} onPress={() => router.replace('/')} style={{ marginTop: 10 }} />
      </View>
    );
  }

  const map = MAP_BY_ID[plan.map];
  const tools: { t: typeof tool; glyph: 'hand' | 'pencil' | 'eraser' | 'select'; label: string }[] = [
    { t: 'pan', glyph: 'hand', label: t('tool.pan') },
    { t: 'place', glyph: 'pencil', label: t('tool.place') },
    { t: 'erase', glyph: 'eraser', label: t('tool.erase') },
    { t: 'select', glyph: 'select', label: t('tool.select') },
  ];

  return (
    <View style={styles.root}>
      <FarmCanvas ref={canvas} onContextMenu={(o) => { setItemDetails(false); setContextItem(o); }} />
      <Sheet visible={!!contextItem} onClose={() => setContextItem(null)} title={contextItem ? ITEM_BY_ID[contextItem.id]?.name : undefined} height="56%">
        {contextItem && <View style={{ gap: 12 }}>
          <ItemIcon id={contextItem.id} size={64} />
          <PixelButton glyph="copy" label={t('sel.duplicate')} onPress={() => { duplicateSelection(); setContextItem(null); }} />
          <PixelButton glyph="trash" tone="red" label={t('sel.delete')} onPress={() => { deleteSelection(); setContextItem(null); }} />
          <PixelButton label={t('sel.info')} onPress={() => setItemDetails(v => !v)} />
          {itemDetails && <View style={{ gap: 8 }}>
            <PText>{ITEM_BY_ID[contextItem.id]?.d}</PText>
            <PText color={C.inkSoft}>{ITEM_BY_ID[contextItem.id]?.sub} · {ITEM_BY_ID[contextItem.id]?.w}×{ITEM_BY_ID[contextItem.id]?.h}</PText>
          </View>}
        </View>}
      </Sheet>

      {/* top bar */}
      <View style={[styles.top, { paddingTop: insets.top + 6, left: insets.left, right: landscape ? undefined : insets.right, width: hudWidth }]} pointerEvents="box-none">
        <View style={[styles.topRow, landscape && { alignSelf: 'flex-start' }]}>
          <IconButton glyph="back" label={t('planner.back')} onPress={leaveFarm} />
          <Pressable style={styles.title} onPress={() => { if (saveError) void saveNow(); else setRenaming(plan.name); }} accessibilityLabel={t(saveError ? 'planner.saveFailed' : 'menu.rename')}>
            <PText size={17} weight="bold" numberOfLines={1}>{plan.name}</PText>
            <PText size={12} color={C.inkSoft} numberOfLines={1}>
              {map.name}{map.kind === 'farm' && !map.image ? ` · ${t(`season.${plan.season}`)}` : ''} · {saveError ? t('planner.saveFailed') : saved ? t('planner.saved') : t('planner.saving')}
            </PText>
          </Pressable>
          <IconButton glyph="undo" label={t('tool.undo')} onPress={() => { sfx('undo'); ed().undo(); }} disabled={!past} />
          <IconButton glyph="redo" label={t('tool.redo')} onPress={() => { sfx('undo'); ed().redo(); }} disabled={!future} />
          <IconButton glyph="gear" label={t('settings.title')} onPress={() => setMenu(true)} />
        </View>
      </View>

      {toastMsg && (
        <View style={[styles.toast, { top: insets.top + 74 }]} pointerEvents="none">
          <PText size={15} weight="semibold" color={C.white}>{toastMsg}</PText>
        </View>
      )}

      {/* bottom */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 8, left: insets.left, right: landscape ? undefined : insets.right, width: hudWidth, gap: landscape ? 4 : 8 }]} pointerEvents="box-none">
        {selected && tool === 'select' && (
          <InfoCard
            obj={selected}
            onClose={() => ed().select([])}
            onDelete={deleteSelection}
            onDuplicate={duplicateSelection}
            onUse={() => { const it = ITEM_BY_ID[selected.id]; if (it) ed().pick(it); }}
          />
        )}
        {tool === 'place' && recent.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hotbar} contentContainerStyle={styles.hotbarInner} keyboardShouldPersistTaps="handled">
            {recent.map((id) => ITEM_BY_ID[id]).filter((it) => it?.place && !it.legacy).map((it) => (
              <Pressable key={it.id} onPress={() => { tap(); ed().pick(it); }} style={[styles.hotSlot, item?.id === it.id && styles.hotActive]} accessibilityLabel={it.name} accessibilityState={{ selected: item?.id === it.id }}>
                <ItemIcon id={it.id} size={34} />
              </Pressable>
            ))}
          </ScrollView>
        )}
        <View style={styles.itemRow}>
          <Pressable style={styles.itemBtn} onPress={() => { tap(); setPicker(true); }} accessibilityLabel={t('planner.selected', { name: item?.name ?? t('planner.chooseNone') })}>
            {item ? <ItemIcon id={item.id} size={38} /> : <Glyph name="plus" size={28} />}
            <View style={{ flex: 1 }}>
              {!landscape && <PText size={11} color={C.inkSoft} weight="semibold" numberOfLines={1}>{t('planner.choose')}</PText>}
              <PText size={15} weight="bold" numberOfLines={1}>{item?.name ?? t('planner.chooseNone')}</PText>
            </View>
            <Glyph name="search" size={18} />
          </Pressable>
          {(tool === 'place' || tool === 'erase') && (
            <View style={styles.shapeRow}>
              {(['single', 'brush', 'rect'] as const).map((s) => (
                <Pressable key={s} onPress={() => { tap(); ed().setShape(s); }} style={[styles.shapeBtn, shape === s && styles.shapeActive]} accessibilityRole="button" accessibilityLabel={s === 'single' ? t('shape.single') : s === 'brush' ? t('shape.brush') : t('shape.area')} accessibilityState={{ selected: shape === s }}>
                  <Glyph name={s === 'single' ? 'pencil' : s === 'brush' ? 'brush' : 'fill'} size={18} />
                  <PText size={10} numberOfLines={1}>{s === 'single' ? t('shape.single') : s === 'brush' ? t('shape.brush') : t('shape.area')}</PText>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        <View style={styles.toolbar}>
          {tools.map((b) => (
            <Pressable key={b.t} onPress={() => { tap(); ed().setTool(b.t); }} style={[styles.toolBtn, landscape && { minHeight: 44, paddingVertical: 3 }, tool === b.t && styles.toolActive]} accessibilityRole="button" accessibilityLabel={b.label} accessibilityState={{ selected: tool === b.t }}>
              <Glyph name={b.glyph} size={landscape ? 20 : 24} />
              <PText size={12} weight="semibold" numberOfLines={1} color={tool === b.t ? C.white : C.parchmentLight}>{b.label}</PText>
            </Pressable>
          ))}
        </View>
      </View>

      <ItemPicker visible={picker} onClose={() => setPicker(false)} />
      <StatsSheet visible={stats} onClose={() => setStats(false)} />
      {tutorial && <GestureTutorial visible onClose={closeTutorial} />}
      <HelpSheet visible={help} onClose={() => setHelp(false)} />

      <Sheet visible={menu} onClose={() => setMenu(false)} title={t('settings.title')} height="86%" scroll={false}>
        {menu && <SettingsSections gameplay={<>
          <OptionsContent />
          <PixelButton glyph="target" label={t('options.resetView')} onPress={() => { setMenu(false); canvas.current?.fit(); }} />
          <PixelButton glyph="stats" label={t('menu.counts')} onPress={async () => { setMenu(false); await afterSheetCloses(); setStats(true); }} />
          <PixelButton glyph="hand" label={t('settings.tutorial')} onPress={async () => { setMenu(false); await afterSheetCloses(); setTutorial(true); }} />
          <PixelButton glyph="help" label={t('menu.help')} onPress={async () => { setMenu(false); await afterSheetCloses(); setHelp(true); }} />
        </>} sound={<RadioContent />} settings={<>
          <LanguagePreferences />
          <PixelButton glyph="image" label={t('menu.saveImage')} onPress={exportImage} />
          <PixelButton glyph="share" label={t('menu.sharePlan')} onPress={exportFile} />
          <PixelButton glyph="folder" label={t('menu.importSave')} onPress={async () => { setMenu(false); await afterSheetCloses(); await startImport(); }} />
          <PixelButton glyph="edit" label={t('menu.rename')} onPress={async () => { setMenu(false); await afterSheetCloses(); setRenaming(plan.name); }} />
          <PixelButton label={t('about.title')} onPress={async () => { setMenu(false); await afterSheetCloses(); router.push('/about'); }} />
          <PixelButton glyph="trash" tone="red" label={t('menu.clear')} onPress={clearAll} />
        </>} />}
      </Sheet>

      {introduction}
      <Dialog visible={renaming !== null} onClose={() => setRenaming(null)} title={t('menu.rename')}>
        <TextField value={renaming ?? ''} onChangeText={setRenaming} autoFocus maxLength={60} onSubmitEditing={() => { if (renaming) ed().rename(renaming); setRenaming(null); }} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <PixelButton label={t('common.cancel')} onPress={() => setRenaming(null)} style={{ flex: 1 }} />
          <PixelButton label={t('common.save')} tone="green" onPress={() => { if (renaming) ed().rename(renaming); setRenaming(null); }} style={{ flex: 1 }} />
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
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(42,20,10,0.88)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: C.orange },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 10, gap: 8, maxWidth: 760, alignSelf: 'center', width: '100%' },
  hotbar: { flexGrow: 0, flexShrink: 0, height: 56, alignSelf: 'flex-start', maxWidth: '100%', borderRadius: 10, borderWidth: 3, borderColor: C.outline, backgroundColor: C.woodLight },
  hotbarInner: { gap: 4, padding: 4 },
  hotSlot: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 2, borderColor: C.parchmentShadow, backgroundColor: C.parchment },
  hotActive: { borderColor: C.orange, backgroundColor: '#ffe2b0' },
  itemRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  shapeRow: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: 10, borderWidth: 3, borderColor: C.outline, backgroundColor: C.parchment, alignItems: 'center' },
  shapeBtn: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  shapeActive: { backgroundColor: C.orange },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, borderRadius: 12, borderWidth: 3, borderColor: C.outline, backgroundColor: C.woodLight },
  toolBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 6, borderRadius: 8, borderWidth: 2, borderColor: 'transparent', minHeight: 56 },
  toolActive: { backgroundColor: C.orange, borderColor: C.outline },
  itemBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingHorizontal: 8, borderRadius: 10, borderWidth: 3, borderColor: C.outline, backgroundColor: C.parchment },
});
