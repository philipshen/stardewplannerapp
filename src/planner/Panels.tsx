import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { ITEM_BY_ID, money } from '../data/items';
import { MAP_BY_ID } from '../data/maps';
import { Layers, useEditor } from '../store/editor';
import { C, SEASONS } from '../theme';
import { Chip, Divider, ItemIcon, PixelButton, PText, Row, Sheet } from '../components/ui';
import { computeStats, Placed, RANGE_STYLE } from './model';
import { LANGUAGES, useLang, useT } from '../i18n';

export function StatsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const plan = useEditor((s) => s.plan);
  const stats = useMemo(() => (plan && visible ? computeStats(plan) : null), [plan, visible]);
  if (!plan || !stats) return <Sheet visible={false} onClose={onClose} />;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  return (
    <Sheet visible={visible} onClose={onClose} title={t('counts.title')} height="80%">
      <View style={styles.tiles}>
        <StatTile label={t('counts.objects')} value={plan.objects.length.toLocaleString()} />
        <StatTile label={t('counts.ground')} value={stats.tiles.toLocaleString()} />
        <StatTile label={t('counts.crops')} value={stats.crops.toLocaleString()} />
        <StatTile label={t('counts.cost')} value={money(stats.gold) || '0g'} />
      </View>
      {stats.crops > 0 && (
        <>
          <PText size={18} weight="bold" style={styles.h}>{t('counts.care')}</PText>
          <Row label={t('counts.watered')} value={`${stats.cropsWatered} / ${stats.crops} (${pct(stats.cropsWatered, stats.crops)})`} />
          <Row label={t('counts.protected')} value={`${stats.cropsProtected} / ${stats.crops} (${pct(stats.cropsProtected, stats.crops)})`} />
          {Object.entries(stats.bySeason).map(([s, n]) => <Row key={s} label={`${s[0].toUpperCase()}${s.slice(1)}`} value={String(n)} />)}
        </>
      )}
      {stats.mats.length > 0 && (
        <>
          <PText size={18} weight="bold" style={styles.h}>{t('counts.materials')}</PText>
          {stats.mats.map((m) => (
            <View key={m.name} style={styles.line}>
              {m.it ? <ItemIcon id={m.it.id} size={28} /> : <View style={{ width: 28 }} />}
              <PText size={15} style={{ flex: 1 }}>{m.name}</PText>
              <PText size={15} weight="semibold">×{m.n.toLocaleString()}</PText>
            </View>
          ))}
        </>
      )}
      <PText size={18} weight="bold" style={styles.h}>{t('counts.everything')}</PText>
      {stats.counts.length === 0 && <PText color={C.inkSoft}>{t('counts.nothing')}</PText>}
      {stats.counts.map(({ it, n }) => (
        <View key={it.id} style={styles.line}>
          <ItemIcon id={it.id} size={32} />
          <View style={{ flex: 1 }}>
            <PText size={15} weight="medium">{it.name}</PText>
            <PText size={12} color={C.inkSoft}>{it.sub}{it.gold ? ` · ${money(it.gold)} each` : it.buy ? ` · ${money(it.buy)} each` : ''}</PText>
          </View>
          <PText size={16} weight="bold">×{n.toLocaleString()}</PText>
        </View>
      ))}
      <PText size={12} color={C.inkSoft} style={{ marginTop: 12 }}>
        {t('counts.note')}
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

function T({ k, label, hint, color }: { k: keyof Layers; label: string; hint?: string; color?: string }) {
  const on = useEditor((s) => s.layers[k]);
  const setLayers = useEditor((s) => s.setLayers);
  return (
    <Pressable style={styles.toggle} onPress={() => setLayers({ [k]: !on })} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label}>
      {color ? <View style={[styles.swatch, { backgroundColor: color }]} /> : null}
      <View style={{ flex: 1 }}>
        <PText size={16} weight="medium">{label}</PText>
        {hint ? <PText size={12} color={C.inkSoft}>{hint}</PText> : null}
      </View>
      <Switch value={on} onValueChange={(v) => setLayers({ [k]: v })} trackColor={{ true: C.green, false: C.parchmentShadow }} thumbColor={C.parchmentLight} />
    </Pressable>
  );
}

/** Display preferences inside the editor’s single options menu. */
export function OptionsContent() {
  const plan = useEditor((s) => s.plan);
  const setSeason = useEditor((s) => s.setSeason);
  const t = useT();
  const map = plan ? MAP_BY_ID[plan.map] : null;
  return (
    <>
      <T k="wildlife" label={t('options.wildlife')} hint={t('options.wildlifeHint')} />
      {map?.kind === 'farm' && !map.image && (
        <>
          <PText size={18} weight="bold" style={styles.h}>{t('options.season')}</PText>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {SEASONS.map((s) => (
              <PixelButton key={s} small label={t(`season.${s}`)} active={plan?.season === s} onPress={() => setSeason(s)} style={{ flexGrow: 1 }} />
            ))}
          </View>
          <Divider />
        </>
      )}
      <PText size={18} weight="bold" style={styles.h}>{t('options.highlights')}</PText>
      <T k="water" label={t('options.sprinkler')} color={RANGE_STYLE.spr2.color} />
      <T k="crow" label={t('options.scarecrow')} color={RANGE_STYLE.scare8.color} />
      <T k="bee" label={t('options.bee')} hint={t('options.beeHint')} color={RANGE_STYLE.bee.color} />
      <T k="junimo" label={t('options.junimo')} color={RANGE_STYLE.junimo.color} />
      <T k="warnings" label={t('options.warnings')} hint={t('options.warningsHint')} />
      <Divider />
      <PText size={18} weight="bold" style={styles.h}>{t('options.map')}</PText>
      <T k="grid" label={t('options.grid')} hint={t('options.gridHint')} />
      <T k="buildable" label={t('options.buildable')} hint={t('options.buildableHint')} color="rgba(60,200,90,0.6)" />
      <T k="tillable" label={t('options.tillable')} hint={t('options.tillableHint')} color="rgba(240,190,40,0.7)" />
      <T k="anywhere" label={t('options.anywhere')} hint={t('options.anywhereHint')} />

    </>
  );
}

export function LanguagePreferences() {
  const t = useT();
  const lang = useLang(s => s.lang);
  const setLang = useLang(s => s.setLang);
  return <>
    <PText size={18} weight="bold">{t('options.language')}</PText>
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {LANGUAGES.map(l => <Chip key={l.id} label={l.label} active={lang === l.id} onPress={() => setLang(l.id)} />)}
    </View>
  </>;
}

const HELP = ['place', 'shape', 'build', 'move', 'erase', 'select', 'multi', 'undo', 'high', 'save', 'game'] as const;

export function HelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('help.title')} height="82%">
      {HELP.map((k) => (
        <View key={k} style={{ paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.parchmentDark }}>
          <PText size={16} weight="bold">{t(`help.${k}.t`)}</PText>
          <PText size={14} color={C.inkSoft}>{t(`help.${k}.b`)}</PText>
        </View>
      ))}
    </Sheet>
  );
}

export function InfoCard({ obj, onClose, onDuplicate, onDelete, onUse }: { obj: Placed; onClose: () => void; onDuplicate: () => void; onDelete: () => void; onUse: () => void }) {
  const it = ITEM_BY_ID[obj.id];
  const count = useEditor((s) => s.selection.size);
  const t = useT();
  if (!it) return null;
  return (
    <View style={styles.card}>
      <ItemIcon id={it.id} size={44} />
      <View style={{ flex: 1 }}>
        <PText size={16} weight="bold" numberOfLines={1}>{count > 1 ? t('sel.many', { n: count }) : it.name}</PText>
        <PText size={12} color={C.inkSoft} numberOfLines={2}>
          {count > 1 ? t('sel.manyHint') : `${it.sub} · ${it.w}×${it.h} · ${t('sel.dragHint')}`}
        </PText>
      </View>
      <PixelButton small glyph="copy" onPress={onDuplicate} accessibilityLabel={t('sel.duplicate')} />
      {count === 1 && <PixelButton small glyph="pencil" onPress={onUse} accessibilityLabel={t('sel.placeMore')} />}
      <PixelButton small glyph="trash" tone="red" onPress={onDelete} accessibilityLabel={t('sel.delete')} />
      <PixelButton small glyph="close" onPress={onClose} accessibilityLabel={t('sel.deselect')} />
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
