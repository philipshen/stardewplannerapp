import { useT } from '../i18n';
import { SettingsButton } from '../components/SettingsButton';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';
import { IconButton, Panel, PixelButton, PText, WoodBackground } from '../components/ui';

export default function About() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [linkError, setLinkError] = useState<string | null>(null);
  const openLink = async (url: string) => {
    setLinkError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setLinkError(t('common.linkError'));
    }
  };
  return (
    <WoodBackground>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 12 }}>
          <IconButton glyph="back" label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <PText size={26} weight="bold" color={C.parchmentLight} shadowed style={{ flex: 1 }}>{t('about.title')}</PText>
          <SettingsButton />
        </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: insets.bottom + 40, gap: 14, maxWidth: 760, width: '100%', alignSelf: 'center' }}>

        <Panel inner={{ padding: 18, gap: 14 }}>
          <PText size={24} weight="bold">made by phil</PText>
          <PText>{t('about.intro')}</PText>
          <PText>{t('about.free')}</PText>
          <PixelButton label="Twitter · @thicc__cheney" onPress={() => void openLink('https://x.com/thicc__cheney')} />
          <PixelButton label={t('about.coffee')} onPress={() => void openLink('https://buymeacoffee.com/thicc_cheney')} />
          {linkError && <PText>{linkError}</PText>}
        </Panel>
        <Panel inner={{ padding: 18, gap: 12 }}>
          <PText size={18} weight="bold">{t('about.fanTitle')}</PText>
          <PText>{t('about.fan')}</PText>
          <PText color={C.inkSoft}>{t('about.rights')}</PText>
        </Panel>
        <Panel inner={{ padding: 18, gap: 12 }}>
          <PText size={18} weight="bold">{t('about.localTitle')}</PText>
          <PText>{t('about.local')}</PText>
          <PixelButton label={t('privacy.title')} onPress={() => router.push('/privacy')} />
        </Panel>
      </ScrollView>
    </WoodBackground>
  );
}
