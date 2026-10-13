import { useImportIntroduction } from '../components/ImportIntroduction';
import React, { useCallback, useState } from 'react';
import { Alert, AppState, FlatList, Image, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { cancelPendingReview, requestPendingReview } from '../lib/reviews';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAP_BY_ID } from '../data/maps';
import { mapThumb } from '../data/mapImages';
import { exportable, SaveMeta, useSaves } from '../store/saves';
import { TEMPLATE_IMAGES } from '../data/generated/templateImages';
import { TEMPLATES } from '../data/templates';
import { C, SEASONS, Season } from '../theme';
import { Chip, Dialog, Glyph, PixelButton, PText, Panel, Sheet, TextField, WoodBackground } from '../components/ui';
import { afterSheetCloses, pickText, shareJSON } from '../lib/files';
import { importSaveGame, isSaveGame } from '../lib/savegame';
import { LayoutPicker } from '../components/LayoutPicker';
import { SettingsButton } from '../components/SettingsButton';
import { t as tt, useT } from '../i18n';

const SAMPLE_LAYOUTS = Array.from(new Set(TEMPLATES.map(tpl => tpl.map)));

export default function Home() {
  const insets = useSafeAreaInsets();
  const { saves, loaded } = useSaves();
  const t = useT();
  const { width } = useWindowDimensions();
  const [sampleLayout, setSampleLayout] = useState(SAMPLE_LAYOUTS[0]);
  const [creating, setCreating] = useState(false);
  const [actions, setActions] = useState<SaveMeta | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  useFocusEffect(useCallback(() => {
    let focused = true;
    const timer = setTimeout(() => void requestPendingReview(() => focused && AppState.currentState === 'active'), 1500);
    return () => { focused = false; clearTimeout(timer); cancelPendingReview(); };
  }, []));
  const cols = width > 900 ? 3 : width > 600 ? 2 : 1;

  const openSample = (i: number) => router.push(`/sample/${i}`);

  const doImport = async () => {
    try {
      const f = await pickText();
      if (!f) return;
      // A game save file (XML) or a plan file (JSON).
      if (isSaveGame(f.text)) {
        const res = importSaveGame(f.text);
        if (!res) return notify(t('home.badSave'));
        await useSaves.getState().write(res.plan);
        router.push(`/planner/${res.plan.id}`);
        return;
      }
      const plan = await useSaves.getState().importPlan(JSON.parse(f.text));
      if (!plan) return notify(t('home.badPlan'));
      router.push(`/planner/${plan.id}`);
    } catch {
      notify(t('home.badFile'));
    }
  };

  const { startImport, introduction } = useImportIntroduction(doImport);

  return (
    <View style={{ flex: 1 }} onTouchStart={cancelPendingReview}>
    <WoodBackground>
      {introduction}
            <View style={[styles.hero, { paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12, maxWidth: 1100, width: '100%', alignSelf: 'center' }]}>
              <Image source={require('../../assets/robin-icon.png')} style={styles.logo} />
              <View style={{ flex: 1 }}>
                <PText size={26} weight="bold" color={C.parchmentLight} shadowed>Stardew Planner</PText>
                <PText size={16} color={C.parchmentDark}>{t('home.tagline')}</PText>
              </View>
              <SettingsButton />
            </View>
      <FlatList
        key={cols}
        data={saves}
        numColumns={cols}
        keyExtractor={(s) => s.id}
        columnWrapperStyle={cols > 1 ? { gap: 12 } : undefined}
        contentContainerStyle={[styles.list, { paddingTop: 4, paddingBottom: insets.bottom + 120 }]}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 14 }}>
            <View style={styles.actions}>
              <PixelButton glyph="plus" label={t('home.new')} tone="green" onPress={() => setCreating(true)} style={{ flexGrow: 2 }} />
              <PixelButton glyph="folder" label={t('home.import')} onPress={startImport} style={{ flexGrow: 1 }} accessibilityLabel={t('home.importHint')} />
            </View>
            {saves.length > 0 && <PText size={20} weight="bold" color={C.parchmentLight} shadowed style={{ marginTop: 6 }}>{t('home.yourFarms', { n: saves.length })}</PText>}
          </View>
        }
        ListEmptyComponent={
          loaded ? (
            <Panel inner={{ padding: 20, alignItems: 'center', gap: 10 }}>
              <PText size={22} weight="bold">{t('home.emptyTitle')}</PText>
              <PText style={{ textAlign: 'center' }} color={C.inkSoft}>
                {t('home.emptyBody')}
              </PText>
              <PixelButton glyph="plus" label={t('home.first')} tone="green" onPress={() => setCreating(true)} style={{ alignSelf: 'stretch', marginTop: 6 }} />
            </Panel>
          ) : null
        }
        renderItem={({ item }) => <SaveCard save={item} onMore={() => setActions(item)} />}
        ListFooterComponent={
          <View>
            <PText size={20} weight="bold" color={C.parchmentLight} shadowed style={{ marginTop: 18 }}>{t('home.samples')}</PText>
            <PText size={13} color={C.parchmentDark} style={{ marginBottom: 8 }}>{t('home.sampleHint')}</PText>
            <View accessibilityRole="radiogroup" accessibilityLabel={t('gallery.layout')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {SAMPLE_LAYOUTS.map(map => <PixelButton key={map} small radio
                label={t(`gallery.${map}` as Parameters<typeof t>[0])} active={sampleLayout === map}
                onPress={() => setSampleLayout(map)} style={{ flexGrow: 1 }} />)}
            </View>
            {TEMPLATES.map((tpl, i) => tpl.map !== sampleLayout ? null : (
              <Pressable key={tpl.name} onPress={() => openSample(i)} style={({ pressed }) => [{ marginBottom: 10, transform: [{ translateY: pressed ? 2 : 0 }] }]} accessibilityLabel={`${t('home.sampleOpen')}: ${tpl.name}`}>
                <Panel inner={styles.card}>
                  <View style={styles.thumbWrap}><Image source={TEMPLATE_IMAGES[i]} style={styles.thumb} resizeMode="contain" /></View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <PText size={18} weight="bold" numberOfLines={1}>{tpl.name}</PText>
                    <PText size={13} color={C.inkSoft} numberOfLines={3}>{tpl.blurb}</PText>
                  </View>
                </Panel>
              </Pressable>
            ))}
          <View style={{ alignItems: 'center', marginTop: 24, gap: 4 }}>
            <Pressable onPress={() => router.push('/about')} style={{ padding: 8 }}>
              <PText size={13} color={C.parchmentDark}>{t('home.about')}</PText>
            </Pressable>
          </View>
          </View>
        }
      />

      <NewFarmSheet visible={creating} onClose={() => setCreating(false)} />
      <Sheet visible={!!actions} onClose={() => setActions(null)} title={actions?.name} height="56%">
        {actions && (
          <View style={{ gap: 10 }}>
            <PixelButton glyph="pencil" label={t('home.open')} tone="green" onPress={() => { const id = actions.id; setActions(null); router.push(`/planner/${id}`); }} />
            <PixelButton glyph="edit" label={t('home.rename')} onPress={() => { setRenaming({ id: actions.id, name: actions.name }); setActions(null); }} />
            <PixelButton glyph="copy" label={t('home.duplicate')} onPress={async () => { await useSaves.getState().duplicate(actions.id); setActions(null); }} />
            <PixelButton glyph="share" label={t('home.exportFile')} onPress={async () => { const p = await useSaves.getState().get(actions.id); setActions(null); await afterSheetCloses(); if (p) shareJSON(await exportable(p), p.name).catch(() => {}); }} />
            <PixelButton glyph="trash" tone="red" label={t('home.delete')} onPress={() => { const s = actions; setActions(null); confirmDelete(s); }} />
          </View>
        )}
      </Sheet>

      <Dialog visible={!!renaming} onClose={() => setRenaming(null)} title={t('home.renameTitle')}>
        <TextField value={renaming?.name ?? ''} onChangeText={(name) => setRenaming((r) => (r ? { ...r, name } : r))} autoFocus maxLength={60} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <PixelButton label={t('common.cancel')} onPress={() => setRenaming(null)} style={{ flex: 1 }} />
          <PixelButton label={t('common.save')} tone="green" onPress={async () => { if (renaming) await useSaves.getState().rename(renaming.id, renaming.name); setRenaming(null); }} style={{ flex: 1 }} />
        </View>
      </Dialog>
    </WoodBackground>
    </View>
  );
}

function notify(msg: string) {
  if (Platform.OS === 'web') window.alert(msg);
  else Alert.alert('Stardew Planner', msg);
}

function confirmDelete(s: SaveMeta) {
  const run = () => useSaves.getState().remove(s.id);
  if (Platform.OS === 'web') { if (window.confirm(`${tt('home.deleteTitle')} ${tt('home.deleteBody', { name: s.name })}`)) run(); return; }
  Alert.alert(tt('home.deleteTitle'), tt('home.deleteBody', { name: s.name }), [{ text: tt('common.cancel'), style: 'cancel' }, { text: tt('home.delete'), style: 'destructive', onPress: run }]);
}

function SaveCard({ save, onMore }: { save: SaveMeta; onMore: () => void }) {
  const map = MAP_BY_ID[save.map];
  const t = useT();
  return (
    <Pressable onPress={() => router.push(`/planner/${save.id}`)} onLongPress={onMore} style={({ pressed }) => [{ flex: 1, marginBottom: 12, transform: [{ translateY: pressed ? 2 : 0 }] }]} accessibilityLabel={`Open ${save.name}`}>
      <Panel inner={styles.card}>
        <View style={styles.thumbWrap}>
          <Image source={save.thumb ? { uri: save.thumb } : mapThumb(save.map)} style={styles.thumb} resizeMode="cover" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <PText size={19} weight="bold" numberOfLines={1}>{save.name}</PText>
          <PText size={14} color={C.inkSoft} numberOfLines={1}>{map?.name ?? save.map}{map?.kind === 'farm' && !map.image ? ` · ${t(`season.${save.season}`)}` : ''}</PText>
        </View>
        <Pressable onPress={onMore} hitSlop={12} style={styles.more} accessibilityLabel={`More actions for ${save.name}`}>
          <Glyph name="menu" size={22} />
        </Pressable>
      </Panel>
    </Pressable>
  );
}

function NewFarmSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [mapId, setMapId] = useState('standard');
  const [season, setSeason] = useState<Season>('spring');
  const [busy, setBusy] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const { width, height } = useWindowDimensions();
  const compactInput = width > height && nameFocused;
  const t = useT();
  const map = MAP_BY_ID[mapId] ?? MAP_BY_ID.standard;
  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const plan = await useSaves.getState().create(name || (map.kind === 'farm' ? t('new.defaultName') : map.name), mapId, season);
      onClose();
      setName('');
      await afterSheetCloses();
      router.push(`/planner/${plan.id}`);
    } catch {
      notify(t('planner.saveFailed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('new.title')} height={width > height ? "96%" : "88%"} scroll={false}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {!compactInput && <PText size={14} weight="semibold" color={C.inkSoft} style={styles.label}>{t('new.name')}</PText>}
        <TextField value={name} onChangeText={setName} accessibilityLabel={t('new.name')} onFocus={() => setNameFocused(true)} onBlur={() => setNameFocused(false)} placeholder={map.kind === 'farm' ? t('new.defaultName') : map.name} maxLength={60} returnKeyType="done" submitBehavior="blurAndSubmit" />
        {!compactInput && map.kind === 'farm' && !map.image && (
          <>
            <PText size={14} weight="semibold" color={C.inkSoft} style={styles.label}>{t('new.season')}</PText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SEASONS.map((s) => <Chip key={s} label={t(`season.${s}`)} active={season === s} onPress={() => setSeason(s)} />)}
            </View>
          </>
        )}
        {!compactInput && <>
        <LayoutPicker value={mapId} onChange={setMapId} />
        <Panel style={{ marginTop: 12 }} inner={{ padding: 10 }}>
          <PText size={16} weight="bold">{map.name}</PText>
          <PText size={14} color={C.inkSoft}>{map.blurb}</PText>
        </Panel>
        </>}
      </ScrollView>
      {!compactInput && <View style={{ padding: 16, gap: 8, borderTopWidth: 2, borderTopColor: C.parchmentShadow }}>
        <PText size={14} weight="semibold" numberOfLines={1}>{map.name}{map.kind === 'farm' && !map.image ? ` · ${t(`season.${season}`)}` : ''}</PText>
        <PixelButton glyph="check" label={busy ? t('new.creating') : t('new.create')} tone="green" onPress={create} disabled={busy} />
      </View>}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 64, height: 64, borderRadius: 12 },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  thumbWrap: { width: 96, height: 78, borderRadius: 6, overflow: 'hidden', borderWidth: 2, borderColor: C.outline, backgroundColor: '#2a1a10' },
  thumb: { width: '100%', height: '100%' },
  more: { padding: 6, alignSelf: 'flex-start' },
  label: { marginTop: 14, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mapOpt: { width: '23%', minWidth: 76, flexGrow: 1, padding: 5, borderRadius: 8, borderWidth: 3, borderColor: C.parchmentShadow, backgroundColor: C.parchmentLight, gap: 4 },
  mapOptActive: { borderColor: C.orange, backgroundColor: '#ffe2b0' },
  mapThumb: { width: '100%', borderRadius: 4, overflow: 'hidden', backgroundColor: '#2a1a10' },
});
