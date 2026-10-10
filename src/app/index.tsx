import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Image, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAPS, MAP_BY_ID } from '../data/maps';
import { mapThumb } from '../data/mapImages';
import { ITEMS } from '../data/items';
import { SaveMeta, useSaves } from '../store/saves';
import { C, SEASON_META, SEASONS, Season } from '../theme';
import { Chip, Dialog, Glyph, PixelButton, PText, Panel, Sheet, TextField, WoodBackground } from '../components/ui';
import { pickJSON, shareJSON } from '../lib/files';

function ago(t: number) {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} day${d > 1 ? 's' : ''} ago` : new Date(t).toLocaleDateString();
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { saves, loaded } = useSaves();
  const { width } = useWindowDimensions();
  const [creating, setCreating] = useState(false);
  const [actions, setActions] = useState<SaveMeta | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const cols = width > 900 ? 3 : width > 600 ? 2 : 1;

  const doImport = async () => {
    try {
      const data = await pickJSON();
      if (!data) return;
      const plan = await useSaves.getState().importPlan(data);
      if (!plan) return notify('That file is not a valid farm plan.');
      router.push(`/planner/${plan.id}`);
    } catch {
      notify('Could not read that file.');
    }
  };

  return (
    <WoodBackground>
      <FlatList
        key={cols}
        data={saves}
        numColumns={cols}
        keyExtractor={(s) => s.id}
        columnWrapperStyle={cols > 1 ? { gap: 12 } : undefined}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 }]}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 14 }}>
            <View style={styles.hero}>
              <Image source={require('../../assets/icon.png')} style={styles.logo} />
              <View style={{ flex: 1 }}>
                <PText size={34} weight="bold" color={C.parchmentLight} shadowed>Stardew Planner</PText>
                <PText size={16} color={C.parchmentDark}>Design your dream farm · {ITEMS.length.toLocaleString()} items indexed</PText>
              </View>
            </View>
            <View style={styles.actions}>
              <PixelButton glyph="plus" label="New farm" tone="green" onPress={() => setCreating(true)} style={{ flexGrow: 2 }} />
              <PixelButton glyph="folder" label="Import" onPress={doImport} style={{ flexGrow: 1 }} />
              <PixelButton glyph="book" label="Item index" onPress={() => router.push('/catalog')} style={{ flexGrow: 1 }} />
            </View>
            {saves.length > 0 && <PText size={20} weight="bold" color={C.parchmentLight} shadowed style={{ marginTop: 6 }}>Your farms ({saves.length})</PText>}
          </View>
        }
        ListEmptyComponent={
          loaded ? (
            <Panel inner={{ padding: 20, alignItems: 'center', gap: 10 }}>
              <PText size={22} weight="bold">No farms yet</PText>
              <PText style={{ textAlign: 'center' }} color={C.inkSoft}>
                Start a new plan on any farm layout, or plan an interior like the Greenhouse or a Shed. Everything saves automatically on this device.
              </PText>
              <PixelButton glyph="plus" label="Plan my first farm" tone="green" onPress={() => setCreating(true)} style={{ alignSelf: 'stretch', marginTop: 6 }} />
            </Panel>
          ) : null
        }
        renderItem={({ item }) => <SaveCard save={item} onMore={() => setActions(item)} />}
        ListFooterComponent={
          <Pressable onPress={() => router.push('/about')} style={{ alignSelf: 'center', marginTop: 24, padding: 8 }}>
            <PText size={13} color={C.parchmentDark}>About · Unofficial fan-made tool</PText>
          </Pressable>
        }
      />

      <NewFarmSheet visible={creating} onClose={() => setCreating(false)} />

      <Sheet visible={!!actions} onClose={() => setActions(null)} title={actions?.name} height="56%">
        {actions && (
          <View style={{ gap: 10 }}>
            <PixelButton glyph="pencil" label="Open" tone="green" onPress={() => { const id = actions.id; setActions(null); router.push(`/planner/${id}`); }} />
            <PixelButton glyph="edit" label="Rename" onPress={() => { setRenaming({ id: actions.id, name: actions.name }); setActions(null); }} />
            <PixelButton glyph="copy" label="Duplicate" onPress={async () => { await useSaves.getState().duplicate(actions.id); setActions(null); }} />
            <PixelButton glyph="share" label="Export plan file" onPress={async () => { const p = await useSaves.getState().get(actions.id); setActions(null); if (p) shareJSON(p, p.name).catch(() => {}); }} />
            <PixelButton glyph="trash" tone="red" label="Delete" onPress={() => { const s = actions; setActions(null); confirmDelete(s); }} />
          </View>
        )}
      </Sheet>

      <Dialog visible={!!renaming} onClose={() => setRenaming(null)} title="Rename farm">
        <TextField value={renaming?.name ?? ''} onChangeText={(name) => setRenaming((r) => (r ? { ...r, name } : r))} autoFocus maxLength={60} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <PixelButton label="Cancel" onPress={() => setRenaming(null)} style={{ flex: 1 }} />
          <PixelButton label="Save" tone="green" onPress={async () => { if (renaming) await useSaves.getState().rename(renaming.id, renaming.name); setRenaming(null); }} style={{ flex: 1 }} />
        </View>
      </Dialog>
    </WoodBackground>
  );
}

function notify(msg: string) {
  if (Platform.OS === 'web') window.alert(msg);
  else Alert.alert('Stardew Planner', msg);
}

function confirmDelete(s: SaveMeta) {
  const run = () => useSaves.getState().remove(s.id);
  if (Platform.OS === 'web') { if (window.confirm(`Delete “${s.name}”? This cannot be undone.`)) run(); return; }
  Alert.alert('Delete farm?', `“${s.name}” will be permanently deleted.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: run }]);
}

function SaveCard({ save, onMore }: { save: SaveMeta; onMore: () => void }) {
  const map = MAP_BY_ID[save.map];
  return (
    <Pressable onPress={() => router.push(`/planner/${save.id}`)} onLongPress={onMore} style={({ pressed }) => [{ flex: 1, marginBottom: 12, transform: [{ translateY: pressed ? 2 : 0 }] }]} accessibilityLabel={`Open ${save.name}`}>
      <Panel inner={styles.card}>
        <View style={styles.thumbWrap}>
          <Image source={save.thumb ? { uri: save.thumb } : mapThumb(save.map)} style={styles.thumb} resizeMode="cover" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <PText size={19} weight="bold" numberOfLines={1}>{save.name}</PText>
          <PText size={14} color={C.inkSoft} numberOfLines={1}>{map?.name ?? save.map}{map?.kind === 'farm' ? ` · ${SEASON_META[save.season]?.label ?? ''}` : ''}</PText>
          <PText size={13} color={C.inkSoft}>{save.count.toLocaleString()} placed · edited {ago(save.updatedAt)}</PText>
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
  const farms = useMemo(() => MAPS.filter((m) => m.kind === 'farm'), []);
  const rooms = useMemo(() => MAPS.filter((m) => m.kind === 'interior'), []);
  const map = MAP_BY_ID[mapId];
  const create = async () => {
    setBusy(true);
    const plan = await useSaves.getState().create(name || (map.kind === 'farm' ? 'My Farm' : map.name), mapId, season);
    setBusy(false);
    onClose();
    setName('');
    router.push(`/planner/${plan.id}`);
  };
  const Option = ({ id }: { id: string }) => {
    const m = MAP_BY_ID[id];
    const active = id === mapId;
    return (
      <Pressable onPress={() => setMapId(id)} style={[styles.mapOpt, active && styles.mapOptActive]} accessibilityLabel={m.name} accessibilityState={{ selected: active }}>
        <View style={[styles.mapThumb, { aspectRatio: m.w / m.h }]}>
          <Image source={mapThumb(id)} style={StyleSheet.absoluteFill} resizeMode="cover" />
        </View>
        <PText size={13} weight="semibold" numberOfLines={1} style={{ textAlign: 'center' }}>{m.name.replace(' Farm', '')}</PText>
      </Pressable>
    );
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="New farm plan" height="88%">
      <PText size={14} weight="semibold" color={C.inkSoft} style={styles.label}>NAME</PText>
      <TextField value={name} onChangeText={setName} placeholder={map.kind === 'farm' ? 'My Farm' : map.name} maxLength={60} />
      <PText size={14} weight="semibold" color={C.inkSoft} style={styles.label}>FARM LAYOUT</PText>
      <View style={styles.grid}>{farms.map((m) => <Option key={m.id} id={m.id} />)}</View>
      <PText size={14} weight="semibold" color={C.inkSoft} style={styles.label}>INTERIORS</PText>
      <View style={styles.grid}>{rooms.map((m) => <Option key={m.id} id={m.id} />)}</View>
      <Panel style={{ marginTop: 12 }} inner={{ padding: 10 }}>
        <PText size={16} weight="bold">{map.name}</PText>
        <PText size={14} color={C.inkSoft}>{map.blurb} ({map.w}×{map.h} tiles)</PText>
      </Panel>
      {map.kind === 'farm' && (
        <>
          <PText size={14} weight="semibold" color={C.inkSoft} style={styles.label}>SEASON</PText>
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }} showsHorizontalScrollIndicator={false}>
            {SEASONS.map((s) => <Chip key={s} label={`${SEASON_META[s].icon} ${SEASON_META[s].label}`} active={season === s} onPress={() => setSeason(s)} />)}
          </ScrollView>
        </>
      )}
      <PixelButton glyph="check" label={busy ? 'Creating…' : 'Create & start planning'} tone="green" onPress={create} disabled={busy} style={{ marginTop: 18 }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 76, height: 76, borderRadius: 14, borderWidth: 3, borderColor: C.outline },
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
