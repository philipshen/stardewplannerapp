import { useT } from '../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TEMPLATES } from '../data/templates';
import { useEditor } from '../store/editor';
import { useSaves } from '../store/saves';
import { planFromTemplate } from './model';
import { FarmCanvas } from './FarmCanvas';
import { Dialog, IconButton, PixelButton, PText, TextField } from '../components/ui';
import { SettingsButton } from '../components/SettingsButton';
import { afterSheetCloses } from '../lib/files';
import { setRadioSeason } from '../audio';
import { C } from '../theme';

/** A transient editor session: no autosave, editing controls or save-index writes. */
export default function SampleScreen({ id }: { id: string }) {
  const t = useT();
  const index = Number(id);
  const template = Number.isInteger(index) ? TEMPLATES[index] : undefined;
  const preview = useMemo(() => template ? planFromTemplate(template, template.name) : null, [template]);
  const plan = useEditor(s => s.plan);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height || width - insets.left - insets.right >= 600;
  const hudWidth = landscape ? Math.min(420, (width - insets.left - insets.right) * 0.55) : undefined;
  const [headerHeight, setHeaderHeight] = useState(70);
  const [footerHeight, setFooterHeight] = useState(52);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(template?.name ?? t('new.defaultName'));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (preview) useEditor.getState().open(preview);
    return () => { if (useEditor.getState().plan?.id === preview?.id) useEditor.getState().close(); };
  }, [preview]);
  useEffect(() => { setRadioSeason(plan?.season ?? null); return () => setRadioSeason(null); }, [plan?.season]);
  const customize = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      const copy = await useSaves.getState().createFromTemplate(index, name);
      if (!copy) throw new Error('Missing sample');
      setNaming(false);
      await afterSheetCloses();
      router.replace(`/planner/${copy.id}`);
    } catch { Alert.alert(t('sample.saveError'), t('common.tryAgain')); }
    finally { setBusy(false); }
  };
  if (!preview || !template) return <View style={styles.missing}><PText>{t('sample.missing')}</PText><PixelButton label={t('planner.back')} onPress={() => router.back()} /></View>;
  return <View style={{ flex: 1, backgroundColor: C.wood }}>
    {plan?.id === preview.id && <FarmCanvas readOnly viewInsets={{ top: insets.top + 18 + headerHeight, bottom: insets.bottom + 24 + footerHeight }} />}
    <View onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)} style={[styles.header, { top: insets.top + 6, left: insets.left + 12, right: landscape ? undefined : insets.right + 12, width: hudWidth }]}>
      <IconButton glyph="back" label={t('planner.back')} onPress={() => router.back()} />
      <View style={{ flex: 1 }}><PText weight="bold" numberOfLines={1}>{template.name}</PText>{template.source ? <Pressable accessibilityRole="link" accessibilityLabel={t('sample.source', { author: template.source.author })} onPress={() => void Linking.openURL(template.source!.url)}><PText size={12} numberOfLines={1} style={{ textDecorationLine: 'underline' }}>{t('sample.preview')} · u/{template.source.author}</PText></Pressable> : <PText size={12}>{t('sample.preview')}</PText>}</View>
      <SettingsButton />
    </View>
    <View onLayout={event => setFooterHeight(event.nativeEvent.layout.height)} style={[styles.footer, { bottom: insets.bottom + 12, left: insets.left + 16, right: landscape ? undefined : insets.right + 16, width: hudWidth }]}>
      <PixelButton label={t('sample.customize')} glyph="pencil" tone="green" onPress={() => setNaming(true)} />
    </View>
    <Dialog visible={naming} onClose={() => { if (!busy) setNaming(false); }} title={t('sample.title')}>
      <PText style={{ marginBottom: 12 }}>{t('sample.body')}</PText>
      <TextField accessibilityLabel={t('sample.name')} value={name} onChangeText={setName} autoFocus maxLength={60} onSubmitEditing={customize} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <PixelButton label={t('common.cancel')} disabled={busy} onPress={() => setNaming(false)} style={{ flex: 1 }} />
        <PixelButton label={t(busy ? 'new.creating' : 'sample.create')} disabled={busy || !name.trim()} onPress={customize} tone="green" style={{ flex: 1 }} />
      </View>
    </Dialog>
  </View>;
}
const styles = StyleSheet.create({
  header: { position: 'absolute', flexDirection: 'row', gap: 10, alignItems: 'center', padding: 8, borderRadius: 8, backgroundColor: C.parchment, borderWidth: 2, borderColor: C.outline },
  footer: { position: 'absolute', gap: 10 },
  missing: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
});
