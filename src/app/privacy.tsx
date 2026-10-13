import { SettingsButton } from '../components/SettingsButton';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Panel, PText, WoodBackground } from '../components/ui';
import policy from '../data/privacy.json';
import { C } from '../theme';

export default function Privacy() {
  const insets = useSafeAreaInsets();
  return (
    <WoodBackground>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 12 }}>
          <IconButton glyph="back" label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/about')} />
          <PText size={24} weight="bold" color={C.parchmentLight} style={{ flex: 1 }}>Privacy policy</PText>
          <SettingsButton />
        </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: insets.bottom + 40, gap: 14, maxWidth: 760, width: '100%', alignSelf: 'center' }}>

        <PText color={C.parchmentLight}>Updated {policy.updated}</PText>
        {policy.sections.map((section) => (
          <Panel key={section.title} inner={{ padding: 18, gap: 12 }}>
            <PText size={18} weight="bold">{section.title}</PText>
            <PText>{section.text}</PText>
          </Panel>
        ))}
      </ScrollView>
    </WoodBackground>
  );
}
