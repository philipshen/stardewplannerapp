import { useT } from '../i18n';
import React, { useState } from 'react';
import { router } from 'expo-router';
import { afterSheetCloses } from '../lib/files';
import { IconButton, PixelButton, Sheet } from './ui';
import { RadioContent } from './RadioSheet';
import { SettingsSections } from './SettingsSections';
import { LanguagePreferences, OptionsContent } from '../planner/Panels';

/** Shared top-right settings entry for screens outside the farm editor. */
export function SettingsButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const navigate = async (route: '/about' | '/privacy') => {
    setOpen(false);
    await afterSheetCloses();
    router.push(route);
  };
  return <>
    <IconButton glyph="gear" label={t('settings.title')} onPress={() => setOpen(true)} />
    <Sheet visible={open} onClose={() => setOpen(false)} title={t('settings.title')} height="80%" scroll={false}>
      {open && <SettingsSections gameplay={<OptionsContent />} sound={<RadioContent />} settings={<>
        <LanguagePreferences />
        <PixelButton label={t('about.title')} onPress={() => void navigate('/about')} />
        <PixelButton label={t('privacy.title')} onPress={() => void navigate('/privacy')} />
      </>} />}
    </Sheet>
  </>;
}
