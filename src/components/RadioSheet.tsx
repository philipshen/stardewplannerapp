import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { RADIO_STATIONS, useRadio } from '../audio';
import { Key, useT } from '../i18n';
import { C } from '../theme';
import { Divider, Glyph, PixelButton, PText, Sheet, tap } from './ui';

/** Dial colours of the stations that are not playlists from the station list. */
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

const DIAL: Record<string, string> = { auto: '#5ab83a', shuffle: '#e0782a', off: '#8a7a6a' };

/** The radio: activity stations, volume and sound effects. */
export function RadioSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  // Do not subscribe a hidden sheet to playback updates while the user edits the farm.
  const t = useT();
  return visible ? <Sheet visible onClose={onClose} title={t('radio.title')} height="88%"><RadioContent /></Sheet> : null;
}

export function RadioContent() {
  const t = useT();
  const { station, volume, sfx, nowPlaying, paused, playing, position, duration, togglePause, next, setStation, setVolume, setSfx } = useRadio();
  const stations: { id: string; label: string; color: string }[] = [
    { id: 'auto', label: t('radio.station.auto'), color: DIAL.auto },
    { id: 'shuffle', label: t('radio.station.shuffle'), color: DIAL.shuffle },
    ...RADIO_STATIONS.map((r) => ({ id: r.id, label: t(`radio.station.${r.id}` as Key), color: r.color })),
    { id: 'off', label: t('radio.station.off'), color: DIAL.off },
  ];
  return (
    <>
      <View style={styles.grid}>
        {stations.map((st) => {
          const on = station === st.id;
          return (
            <Pressable key={st.id} onPress={() => { tap(); setStation(st.id); }} style={[styles.station, on && styles.stationOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={st.label}>
              <View style={[styles.dial, { backgroundColor: st.color }]}>
                <Glyph name={st.id === 'off' ? 'close' : 'music'} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <PText size={14} weight={on ? 'bold' : 'medium'} numberOfLines={2}>{st.label}</PText>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.now}>
        <View>
          <PText size={11} weight="semibold" color={C.inkSoft}>{t(paused ? 'radio.paused' : playing ? 'radio.now' : 'radio.ready').toUpperCase()}</PText>
          <PText size={16} weight="bold" numberOfLines={2}>{station !== 'off' && nowPlaying ? nowPlaying : '—'}</PText>
          {duration > 0 && station !== 'off' && <PText size={12} color={C.inkSoft}>{time(position)} / {time(duration)}</PText>}
          <PText size={12} color={C.inkSoft} numberOfLines={2}>{station === 'auto' ? t('radio.autoHint') : station === 'off' ? t('radio.offHint') : ' '}</PText>
        </View>
        <View style={styles.playbackControls}>
        <PixelButton small style={{ flex: 1 }} label={t(paused ? 'radio.resume' : 'radio.pause')} onPress={togglePause} disabled={station === 'off' || !nowPlaying} />
        <PixelButton small style={{ flex: 1 }} glyph="redo" label={t('radio.next')} onPress={next} disabled={station === 'off'} />
        </View>
      </View>
      <Divider />
      <View style={styles.row}>
        <PText size={16} weight="medium" style={{ flex: 1 }}>{t('radio.volume')}</PText>
        <PixelButton small glyph="minus" onPress={() => setVolume(volume - 0.1)} accessibilityLabel={`${t('radio.volume')} −`} />
        <View style={styles.bars} accessibilityLabel={`${Math.round(volume * 100)}%`}>
          {Array.from({ length: 10 }, (_, i) => <View key={i} style={[styles.bar, { height: 6 + i * 2 }, i < Math.round(volume * 10) && styles.barOn]} />)}
        </View>
        <PixelButton small glyph="plus" onPress={() => setVolume(volume + 0.1)} accessibilityLabel={`${t('radio.volume')} +`} />
      </View>
      <Pressable style={styles.row} onPress={() => setSfx(!sfx)} accessibilityRole="switch" accessibilityState={{ checked: sfx }} accessibilityLabel={t('radio.sfx')}>
        <PText size={16} weight="medium" style={{ flex: 1 }}>{t('radio.sfx')}</PText>
        <Switch value={sfx} onValueChange={setSfx} trackColor={{ true: C.green, false: C.parchmentShadow }} thumbColor={C.parchmentLight} />
      </Pressable>

    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  playbackControls: { flexDirection: 'row', gap: 10 },
  now: { gap: 10, marginTop: 10, padding: 10, borderRadius: 8, borderWidth: 2, borderColor: C.parchmentShadow, backgroundColor: C.parchmentLight },
  station: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, minHeight: 52, borderRadius: 8, borderWidth: 3, borderColor: C.parchmentShadow, backgroundColor: C.parchmentLight },
  stationOn: { borderColor: C.orange, backgroundColor: '#ffe2b0' },
  dial: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: C.outline, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 26 },
  bar: { width: 7, borderRadius: 2, backgroundColor: C.parchmentShadow },
  barOn: { backgroundColor: C.green },
});
