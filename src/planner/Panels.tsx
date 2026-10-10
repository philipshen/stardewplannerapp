import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { ITEM_BY_ID, money } from '../data/items';
import { MAP_BY_ID } from '../data/maps';
import { Layers, useEditor } from '../store/editor';
import { C, SEASON_META, SEASONS } from '../theme';
import { Divider, ItemIcon, PixelButton, PText, Row, Sheet } from '../components/ui';
import { computeStats, Placed, RANGE_STYLE, RangeKind } from './model';

export function StatsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const plan = useEditor((s) => s.plan);
  const stats = useMemo(() => (plan && visible ? computeStats(plan) : null), [plan, visible]);
  if (!plan || !stats) return <Sheet visible={false} onClose={onClose} />;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  return (
    <Sheet visible={visible} onClose={onClose} title="Farm summary" height="80%">
      <View style={styles.tiles}>
        <StatTile label="Objects" value={plan.objects.length.toLocaleString()} />
        <StatTile label="Ground tiles" value={stats.tiles.toLocaleString()} />
        <StatTile label="Crops" value={stats.crops.toLocaleString()} />
        <StatTile label="Est. cost" value={money(stats.gold) || '0g'} />
      </View>
      {stats.crops > 0 && (
        <>
          <PText size={18} weight="bold" style={styles.h}>Crop care</PText>
          <Row label="Watered by sprinklers" value={`${stats.cropsWatered} / ${stats.crops} (${pct(stats.cropsWatered, stats.crops)})`} />
          <Row label="Protected from crows" value={`${stats.cropsProtected} / ${stats.crops} (${pct(stats.cropsProtected, stats.crops)})`} />
          {Object.entries(stats.bySeason).map(([s, n]) => <Row key={s} label={`${s[0].toUpperCase()}${s.slice(1)} crops`} value={String(n)} />)}
        </>
      )}
      {stats.mats.length > 0 && (
        <>
          <PText size={18} weight="bold" style={styles.h}>Materials needed</PText>
          {stats.mats.map((m) => (
            <View key={m.name} style={styles.line}>
              {m.it ? <ItemIcon id={m.it.id} size={28} /> : <View style={{ width: 28 }} />}
              <PText size={15} style={{ flex: 1 }}>{m.name}</PText>
              <PText size={15} weight="semibold">×{m.n.toLocaleString()}</PText>
            </View>
          ))}
        </>
      )}
      <PText size={18} weight="bold" style={styles.h}>Everything placed</PText>
      {stats.counts.length === 0 && <PText color={C.inkSoft}>Nothing placed yet. Pick an item and tap the map!</PText>}
      {stats.counts.map(({ it, n }) => (
        <Pressable key={it.id} style={styles.line} onPress={() => router.push({ pathname: '/catalog', params: { item: it.id } })}>
          <ItemIcon id={it.id} size={32} />
          <View style={{ flex: 1 }}>
            <PText size={15} weight="medium">{it.name}</PText>
            <PText size={12} color={C.inkSoft}>{it.sub}{it.gold ? ` · ${money(it.gold)} each` : it.buy ? ` · ${money(it.buy)} each` : ''}</PText>
          </View>
          <PText size={16} weight="bold">×{n.toLocaleString()}</PText>
        </Pressable>
      ))}
      <PText size={12} color={C.inkSoft} style={{ marginTop: 12 }}>
        Cost includes building prices and the shop price of seeds, saplings and furniture where known. Materials are summed from crafting recipes and building requirements.
      </PText>
    </Sheet>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <PText size={20} weight="bold">{value}</PText>
      <PText size={12} color={C.inkSoft}>{label}</PText>
    </View>
  );
}

export function LayersSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const layers = useEditor((s) => s.layers);
  const setLayers = useEditor((s) => s.setLayers);
  const plan = useEditor((s) => s.plan);
  const setSeason = useEditor((s) => s.setSeason);
  const map = plan ? MAP_BY_ID[plan.map] : null;
  const T = ({ k, label, hint, color }: { k: keyof Layers; label: string; hint?: string; color?: string }) => (
    <View style={styles.toggle}>
      {color ? <View style={[styles.swatch, { backgroundColor: color }]} /> : null}
      <View style={{ flex: 1 }}>
        <PText size={16} weight="medium">{label}</PText>
        {hint ? <PText size={12} color={C.inkSoft}>{hint}</PText> : null}
      </View>
      <Switch value={layers[k]} onValueChange={(v) => setLayers({ [k]: v })} trackColor={{ true: C.green, false: C.parchmentShadow }} thumbColor={C.parchmentLight} />
    </View>
  );
  return (
    <Sheet visible={visible} onClose={onClose} title="View & layers" height="72%">
      {map?.kind === 'farm' && (
        <>
          <PText size={18} weight="bold" style={styles.h}>Season</PText>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {SEASONS.map((s) => (
              <PixelButton key={s} small label={`${SEASON_META[s].icon} ${SEASON_META[s].label}`} active={plan?.season === s} onPress={() => setSeason(s)} style={{ flexGrow: 1 }} />
            ))}
          </View>
          <Divider />
        </>
      )}
      <T k="grid" label="Tile grid" hint="Visible when zoomed in" />
      <T k="coverage" label="Coverage ranges" hint="Show the area each item affects" />
      {layers.coverage && (
        <View style={{ paddingLeft: 12 }}>
          <T k="water" label="Sprinklers" color={RANGE_STYLE.spr2.color} />
          <T k="crow" label="Scarecrows" color={RANGE_STYLE.scare8.color} />
          <T k="junimo" label="Junimo Huts" color={RANGE_STYLE.junimo.color} />
          <T k="bee" label="Bee Houses (flower range)" color={RANGE_STYLE.bee.color} />
        </View>
      )}
      <T k="blocked" label="Unbuildable tiles" hint="Tint water, cliffs and forest in red" />
      <T k="warnings" label="Warnings" hint="Fruit trees without 8 clear tiles around them" />
    </Sheet>
  );
}

export function InfoCard({ obj, onClose, onDuplicate, onDelete, onUse }: { obj: Placed; onClose: () => void; onDuplicate: () => void; onDelete: () => void; onUse: () => void }) {
  const it = ITEM_BY_ID[obj.id];
  const count = useEditor((s) => s.selection.size);
  if (!it) return null;
  const r = it.range as RangeKind | undefined;
  return (
    <View style={styles.card}>
      <ItemIcon id={it.id} size={44} />
      <View style={{ flex: 1 }}>
        <PText size={16} weight="bold" numberOfLines={1}>{count > 1 ? `${count} items selected` : it.name}</PText>
        <PText size={12} color={C.inkSoft} numberOfLines={2}>
          {count > 1 ? 'Drag a selected item to move them all.' : `${it.sub} · ${it.w}×${it.h}${r ? ` · ${RANGE_STYLE[r].label} range` : ''} · drag to move`}
        </PText>
      </View>
      <PixelButton small glyph="copy" onPress={onDuplicate} accessibilityLabel="Duplicate" />
      {count === 1 && <PixelButton small glyph="pencil" onPress={onUse} accessibilityLabel="Place more of this" />}
      <PixelButton small glyph="trash" tone="red" onPress={onDelete} accessibilityLabel="Delete" />
      <PixelButton small glyph="close" onPress={onClose} accessibilityLabel="Deselect" />
    </View>
  );
}

const styles = StyleSheet.create({
  h: { marginTop: 14, marginBottom: 6 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexGrow: 1, minWidth: '45%', padding: 10, borderRadius: 8, borderWidth: 2, borderColor: C.parchmentShadow, backgroundColor: C.parchmentLight },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.parchmentDark },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  swatch: { width: 18, height: 18, borderRadius: 3, borderWidth: 2, borderColor: C.outline },
  card: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10, borderWidth: 3, borderColor: C.outline, backgroundColor: C.parchment },
});
