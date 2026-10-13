import React, { useState } from 'react';
import { Image, ScrollView, useWindowDimensions, View } from 'react-native';
import { PixelButton, PText, Sheet } from '../components/ui';
import { useT } from '../i18n';
import { C } from '../theme';

const STEPS = [0, 1, 2, 3, 4] as const;

export function GestureTutorial({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const [step, setStep] = useState(0);
  const page = STEPS[step];
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  return (
    <Sheet visible={visible} onClose={onClose} title={t('tutorial.title')} height={landscape ? "96%" : "82%"} scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: landscape ? 'row' : 'column', alignItems: 'center', gap: 16 }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Image source={require('../../assets/game/robin-happy.png')} style={{ width: 128, height: 128 }} accessibilityLabel={t('tutorial.robin')} />
          <PText size={20} weight="bold">Robin</PText>
        </View>
        <View style={{ flex: landscape ? 1 : undefined, gap: 14 }}>
        <PText size={24} weight="bold" style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">{t(`tutorial.${page}.title`)}</PText>
        <PText size={18} style={{ textAlign: 'center' }}>{t(`tutorial.${page}.body`)}</PText>
        <PText size={15} color={C.inkSoft} style={{ textAlign: 'center' }}>{t(`tutorial.${page}.hint`)}</PText>
        <View style={{ flexDirection: 'row', gap: 8 }} accessibilityLabel={t('tutorial.step', { step: step + 1, total: STEPS.length })}>
          {STEPS.map((_, i) => <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === step ? C.orange : C.parchmentShadow }} />)}
        </View>
        </View>
      </View>
      </ScrollView>
      <View style={{ padding: 16, flexDirection: 'row', gap: 10 }}>
        <PixelButton label={t(step ? 'common.back' : 'common.skip')} onPress={() => step ? setStep(step - 1) : onClose()} style={{ flex: 1 }} />
        <PixelButton label={t(step === STEPS.length - 1 ? 'tutorial.start' : 'common.next')} tone="green" onPress={() => step === STEPS.length - 1 ? onClose() : setStep(step + 1)} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}
