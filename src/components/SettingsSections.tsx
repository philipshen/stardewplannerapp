import { useT } from '../i18n';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { PixelButton } from './ui';

/** Keep one category visible, so options remain manageable on a phone. */
export function SettingsSections({ gameplay, sound, settings }: { gameplay: React.ReactNode; sound: React.ReactNode; settings: React.ReactNode }) {
  const t = useT();
  const [section, setSection] = useState<'gameplay' | 'sound' | 'settings'>('gameplay');
  const sections = { gameplay, sound, settings };
  return <View style={{ flex: 1 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 12 }}>
      {(['gameplay', 'sound', 'settings'] as const).map(key => <PixelButton key={key} small
        label={t(`settings.${key}`)} active={section === key}
        onPress={() => setSection(key)} style={{ flexGrow: 1 }} />)}
    </View>
    <ScrollView key={section} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">{sections[section]}</ScrollView>
  </View>;
}
