import { useT } from '../i18n';
import React, { useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View } from 'react-native';
import { Dialog, PixelButton, PText } from './ui';
import { afterSheetCloses } from '../lib/files';

const KEY = 'sdp:import-introduction:v1';
export function useImportIntroduction(importFile: () => Promise<void>) {
  const t = useT();
  const pending = useRef(false);
  const [visible, setVisible] = useState(false);
  const startImport = async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      const seen = await AsyncStorage.getItem(KEY).catch(() => null);
      if (seen) await importFile();
      else {
        setVisible(true);
        await AsyncStorage.setItem(KEY, '1').catch(() => {});
      }
    } finally { pending.current = false; }
  };
  const continueImport = async () => {
    if (pending.current) return;
    pending.current = true;
    setVisible(false);
    try {
      await afterSheetCloses();
      await importFile();
    } finally { pending.current = false; }
  };
  const introduction = <Dialog visible={visible} onClose={() => setVisible(false)} title={t('import.title')}>
    <PText>{t('import.intro')}</PText>
    <PText style={{ marginTop: 12 }}>{t('import.body')}</PText>
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
      <PixelButton label={t('common.cancel')} onPress={() => setVisible(false)} style={{ flex: 1 }} />
      <PixelButton label={t('import.choose')} tone="green" onPress={continueImport} style={{ flex: 1 }} />
    </View>
  </Dialog>;
  return { startImport, introduction };
}
