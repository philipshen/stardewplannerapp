import React, { useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { MAP_BY_ID, MAPS, MAX_CUSTOM_TILES } from '../data/maps';
import { mapThumb } from '../data/mapImages';
import { pickLayoutImage } from '../lib/files';
import { newLayoutId, useLayouts } from '../store/layouts';
import { C } from '../theme';
import { Dialog, PixelButton, PText, TextField } from './ui';
import { useT } from '../i18n';

type Draft = { uri: string; name: string; w: string; h: string };

const clampTiles = (s: string) => Math.max(4, Math.min(MAX_CUSTOM_TILES, Math.round(Number(s) || 0)));

/** Grid of all layouts: farms, interiors and the user's own uploaded layouts. */
export function LayoutPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const layouts = useLayouts((s) => s.layouts);
  const [draft, setDraft] = useState<Draft | null>(null);
  const t = useT();
  const farms = useMemo(() => MAPS.filter((m) => m.kind === 'farm' && !m.author), []);
  const rooms = useMemo(() => MAPS.filter((m) => m.kind === 'interior'), []);

  const upload = async () => {
    try {
      const img = await pickLayoutImage();
      if (!img) return;
      // The usual farm image has 16 pixels for each tile.
      setDraft({ uri: img.uri, name: t('layout.defaultName'), w: String(clampTiles(String(img.width / 16))), h: String(clampTiles(String(img.height / 16))) });
    } catch {
      const msg = t('layout.badImage');
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert(t('layout.customTitle'), msg);
    }
  };
  const saveDraft = async () => {
    if (!draft) return;
    const id = newLayoutId();
    await useLayouts.getState().add({ id, name: draft.name.trim().slice(0, 60) || t('layout.defaultName'), w: clampTiles(draft.w), h: clampTiles(draft.h), image: draft.uri });
    setDraft(null);
    onChange(id);
  };
  const removeCustom = (id: string) => {
    const run = () => { if (value === id) onChange('standard'); useLayouts.getState().remove(id); };
    const msg = t('layout.removeBody');
    if (Platform.OS === 'web') { if (window.confirm(msg)) run(); }
    else Alert.alert(t('layout.removeTitle'), msg, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('layout.remove'), style: 'destructive', onPress: run }]);
  };

  const option = (id: string, custom = false) => {
    const m = MAP_BY_ID[id];
    if (!m) return null;
    const active = id === value;
    return (
      <Pressable key={id} onPress={() => onChange(id)} onLongPress={custom ? () => removeCustom(id) : undefined} style={[styles.opt, active && styles.optActive]} accessibilityLabel={m.name} accessibilityState={{ selected: active }}>
        <View style={styles.thumb}>
          <Image source={mapThumb(id)} style={StyleSheet.absoluteFill} resizeMode="cover" />
        </View>
        <PText size={12} weight="semibold" numberOfLines={2} style={{ textAlign: 'center' }}>{m.name.replace(/ Farm$/, '')}</PText>
        {m.author ? <PText size={10} color={C.inkSoft} numberOfLines={1} style={{ textAlign: 'center' }}>{t('layout.by', { author: m.author })}</PText> : null}
      </Pressable>
    );
  };

  return (
    <View>
      <PText size={14} weight="semibold" color={C.inkSoft} style={styles.label}>{t('layout.farms')}</PText>
      <View style={styles.grid}>{farms.map((m) => option(m.id))}</View>
      <PText size={14} weight="semibold" color={C.inkSoft} style={styles.label}>{t('layout.interiors')}</PText>
      <View style={styles.grid}>{rooms.map((m) => option(m.id))}</View>
      <PText size={14} weight="semibold" color={C.inkSoft} style={styles.label}>{t('layout.custom')}</PText>
      {layouts.length > 0 && <View style={[styles.grid, { marginBottom: 8 }]}>{layouts.map((l) => option(l.id, true))}</View>}
      <PixelButton glyph="image" label={t('layout.upload')} onPress={upload} />
      <PText size={12} color={C.inkSoft} style={{ marginTop: 4 }}>
        {t('layout.uploadHint')} {layouts.length > 0 ? t('layout.removeHint') : ''}
      </PText>

      <Dialog visible={!!draft} onClose={() => setDraft(null)} title={t('layout.customTitle')}>
        {draft && (
          <View style={{ gap: 8 }}>
            <Image source={{ uri: draft.uri }} style={styles.preview} resizeMode="contain" />
            <PText size={13} weight="semibold" color={C.inkSoft}>{t('new.name')}</PText>
            <TextField value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} maxLength={60} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <PText size={13} weight="semibold" color={C.inkSoft}>{t('layout.wide')}</PText>
                <TextField value={draft.w} onChangeText={(w) => setDraft({ ...draft, w: w.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={3} />
              </View>
              <View style={{ flex: 1 }}>
                <PText size={13} weight="semibold" color={C.inkSoft}>{t('layout.high')}</PText>
                <TextField value={draft.h} onChangeText={(h) => setDraft({ ...draft, h: h.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={3} />
              </View>
            </View>
            <PText size={12} color={C.inkSoft}>{t('layout.gridHint')}</PText>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <PixelButton label={t('common.cancel')} onPress={() => setDraft(null)} style={{ flex: 1 }} />
              <PixelButton label={t('layout.add')} tone="green" onPress={saveDraft} style={{ flex: 1 }} />
            </View>
          </View>
        )}
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 14, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { width: '31%', minWidth: 92, flexGrow: 1, maxWidth: 170, padding: 5, borderRadius: 8, borderWidth: 3, borderColor: C.parchmentShadow, backgroundColor: C.parchmentLight, gap: 4 },
  optActive: { borderColor: C.orange, backgroundColor: '#ffe2b0' },
  thumb: { width: '100%', aspectRatio: 1.3, borderRadius: 4, overflow: 'hidden', backgroundColor: '#2a1a10' },
  preview: { width: '100%', height: 140, borderRadius: 6, backgroundColor: '#2a1a10' },
});
