import React, { ReactNode, useEffect, useState } from 'react';
import {
  Animated,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Asset } from 'expo-asset';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, shadow } from '../theme';
import { GLYPH_CELL, GLYPH_NAMES, GLYPH_SHEET, ICON_PAGE_SIZE, ICON_PAGES, WOOD_TEXTURE } from '../data/generated/assets';
import { SPRITES } from '../data/items';
import { sfx, unlockAudio } from '../audio';
import { useT } from '../i18n';

export type GlyphName = (typeof GLYPH_NAMES)[number];

export function tap() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  unlockAudio();
  sfx('tap');
}

// ---------------------------------------------------------------- text
export function PText({ style, size = 16, weight = 'regular', color = C.ink, shadowed, ...rest }: TextProps & { size?: number; weight?: keyof typeof F; color?: string; shadowed?: boolean }) {
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: F[weight], fontSize: size, color, lineHeight: Math.round(size * 1.25) },
        shadowed && styles.textShadow,
        style as StyleProp<TextStyle>,
      ]}
    />
  );
}

// ---------------------------------------------------------------- panels
/** Bevelled pixel frame: dark outline, light top-left, dark bottom-right. */
export function Panel({ children, style, inner, tone = 'parchment' }: { children?: ReactNode; style?: StyleProp<ViewStyle>; inner?: StyleProp<ViewStyle>; tone?: 'parchment' | 'wood' | 'dark' }) {
  const fill = tone === 'wood' ? C.woodLight : tone === 'dark' ? C.woodDark : C.parchment;
  const hi = tone === 'parchment' ? C.parchmentLight : '#a8693c';
  const lo = tone === 'parchment' ? C.parchmentShadow : '#3a1c0c';
  return (
    <View style={[styles.panelOuter, shadow, style]}>
      <View style={[styles.panelInner, { backgroundColor: fill, borderTopColor: hi, borderLeftColor: hi, borderBottomColor: lo, borderRightColor: lo }, inner]}>{children}</View>
    </View>
  );
}

export function WoodBackground({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  const safeSides = { paddingLeft: insets.left, paddingRight: insets.right };
  if (Platform.OS === 'web') {
    // react-native-web does not tile ImageBackground; use a CSS background instead.
    const uri = typeof WOOD_TEXTURE === 'string' ? WOOD_TEXTURE : Asset.fromModule(WOOD_TEXTURE).uri;
    const css = { backgroundImage: `url(${uri})`, backgroundRepeat: 'repeat', imageRendering: 'pixelated' } as object;
    return <View style={[{ flex: 1, backgroundColor: C.wood }, css, safeSides, style]}>{children}</View>;
  }
  return (
    <ImageBackground source={WOOD_TEXTURE} resizeMode="repeat" style={[{ flex: 1, backgroundColor: C.wood }, safeSides, style]}>
      {children}
    </ImageBackground>
  );
}

// ---------------------------------------------------------------- glyph & item icons
export function Glyph({ name, size = 24, style }: { name: GlyphName; size?: number; style?: StyleProp<ViewStyle> }) {
  const idx = GLYPH_NAMES.indexOf(name);
  const scale = size / GLYPH_CELL;
  return (
    <View style={[{ width: size, height: size, overflow: 'hidden' }, style]}>
      <Image
        source={GLYPH_SHEET}
        style={{ width: GLYPH_NAMES.length * GLYPH_CELL * scale, height: size, position: 'absolute', left: -idx * GLYPH_CELL * scale, top: 0 }}
        resizeMode="stretch"
      />
    </View>
  );
}

export const ItemIcon = React.memo(function ItemIcon({ id, size = 40, style }: { id: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const rec = SPRITES.icons[id];
  if (!rec) return <View style={[{ width: size, height: size }, style]} />;
  const [page, col, row] = rec;
  const scale = size / SPRITES.cell;
  return (
    <View style={[{ width: size, height: size, overflow: 'hidden' }, style]}>
      <Image
        source={ICON_PAGES[page]}
        style={{ width: ICON_PAGE_SIZE * scale, height: ICON_PAGE_SIZE * scale, position: 'absolute', left: -col * SPRITES.cell * scale, top: -row * SPRITES.cell * scale }}
        resizeMode="stretch"
      />
    </View>
  );
});

// ---------------------------------------------------------------- buttons
type BtnTone = 'parchment' | 'green' | 'orange' | 'red' | 'blue' | 'wood';
const TONES: Record<BtnTone, [string, string, string, string]> = {
  // fill, highlight, shadow, text
  parchment: [C.parchment, C.parchmentLight, C.parchmentShadow, C.ink],
  green: [C.green, C.greenLight, C.greenDark, C.white],
  orange: [C.orange, '#f8a860', C.orangeDark, C.white],
  red: [C.red, '#e86a5a', C.redDark, C.white],
  blue: [C.blue, '#6a9ae8', C.blueDark, C.white],
  wood: [C.woodLight, '#a8693c', '#3a1c0c', C.parchmentLight],
};

export function PixelButton({
  label, onPress, tone = 'parchment', glyph, icon, style, small, disabled, active, accessibilityLabel, children, onLongPress, radio,
}: {
  label?: string; onPress?: () => void; tone?: BtnTone; glyph?: GlyphName; icon?: string; style?: StyleProp<ViewStyle>;
  small?: boolean; disabled?: boolean; active?: boolean; radio?: boolean; accessibilityLabel?: string; children?: ReactNode; onLongPress?: () => void;
}) {
  const t = TONES[active ? 'orange' : tone];
  return (
    <Pressable
      accessibilityRole={radio ? "radio" : "button"}
      accessibilityState={radio ? { checked: !!active, disabled } : { selected: active, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={() => { tap(); onPress?.(); }}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.btnOuter, { opacity: disabled ? 0.45 : 1, transform: [{ translateY: pressed ? 2 : 0 }] }, !pressed && shadow, style]}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.btnInner,
            small && styles.btnSmall,
            { backgroundColor: t[0], borderTopColor: pressed ? t[2] : t[1], borderLeftColor: pressed ? t[2] : t[1], borderBottomColor: pressed ? t[1] : t[2], borderRightColor: pressed ? t[1] : t[2] },
          ]}
        >
          {glyph && <Glyph name={glyph} size={small ? 18 : 22} />}
          {icon && <ItemIcon id={icon} size={small ? 22 : 28} />}
          {label ? <PText size={small ? 14 : 17} weight="semibold" color={t[3]} style={t[3] === C.white ? styles.textShadowSoft : undefined}>{label}</PText> : null}
          {children}
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({ glyph, onPress, active, disabled, label, size = 44, tone = 'parchment' }: { glyph: GlyphName; onPress?: () => void; active?: boolean; disabled?: boolean; label: string; size?: number; tone?: BtnTone }) {
  return (
    <PixelButton glyph={glyph} onPress={onPress} active={active} disabled={disabled} accessibilityLabel={label} tone={tone} style={{ width: size, height: size }} small />
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: string }) {
  return (
    <Pressable onPress={() => { tap(); onPress?.(); }} style={[styles.chip, active && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: !!active }}>
      {icon && <ItemIcon id={icon} size={22} />}
      <PText size={14} weight={active ? 'semibold' : 'medium'} color={active ? C.white : C.ink}>{label}</PText>
    </Pressable>
  );
}

export function SearchField(props: TextInputProps & { onClear?: () => void }) {
  const t = useT();
  return (
    <View style={styles.search}>
      <Glyph name="search" size={20} />
      <TextInput
        placeholderTextColor={C.inkSoft}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        {...props}
        style={[styles.searchInput, props.style]}
      />
      {props.value ? (
        <Pressable onPress={props.onClear} hitSlop={10} accessibilityLabel={t('common.clearSearch')}>
          <Glyph name="close" size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function TextField(props: TextInputProps) {
  return <TextInput placeholderTextColor={C.inkSoft} {...props} style={[styles.textField, props.style]} />;
}

// ---------------------------------------------------------------- sheets & dialogs
export function Sheet({ visible, onClose, title, children, height = '72%', scroll = true, right }: { visible: boolean; onClose: () => void; title?: string; children?: ReactNode; height?: `${number}%` | number; scroll?: boolean; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const availableWidth = Math.max(1, width - insets.left - insets.right);
  const sheetWidth = Math.min(760, availableWidth);
  const t = useT();
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (visible) Animated.spring(anim, { toValue: 1, useNativeDriver: Platform.OS !== 'web', damping: 18, stiffness: 180 }).start();
    else anim.setValue(0);
  }, [visible, anim]);
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + 8, paddingLeft: insets.left, paddingRight: insets.right }}>
        <Animated.View
          style={[
            styles.sheet,
            { width: sheetWidth },
            { height, paddingBottom: insets.bottom + 8, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }] },
          ]}
        >
          <View style={styles.sheetHandle} />
          {title ? (
            <View style={styles.sheetHeader}>
              <PText size={22} weight="bold" style={{ flex: 1, marginRight: 8 }} numberOfLines={2}>{title}</PText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {right}
                <IconButton glyph="close" label={t('common.close')} onPress={onClose} size={40} />
              </View>
            </View>
          ) : null}
          {scroll ? <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4 }} keyboardShouldPersistTaps="handled">{children}</ScrollView> : <View style={{ flex: 1 }}>{children}</View>}
        </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Dialog({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.dialogWrap, { paddingLeft: insets.left + 20, paddingRight: insets.right + 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Panel style={[styles.dialog, { maxHeight: '100%' }]} inner={{ padding: 18, flexShrink: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }} style={{ flexGrow: 0 }}>
          <PText size={22} weight="bold" style={{ marginBottom: 12, textAlign: 'center' }}>{title}</PText>
          {children}
          </ScrollView>
        </Panel>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Divider() {
  return <View style={{ height: 2, backgroundColor: C.parchmentDark, marginVertical: 10 }} />;
}

export function Row({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={styles.row}>
      <PText size={15} color={C.inkSoft}>{label}</PText>
      {typeof value === 'string' || typeof value === 'number' ? <PText size={15} weight="semibold" style={{ flexShrink: 1, textAlign: 'right' }}>{value}</PText> : value}
    </View>
  );
}

const styles = StyleSheet.create({
  textShadow: { textShadowColor: 'rgba(42,20,10,0.8)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  textShadowSoft: { textShadowColor: 'rgba(42,20,10,0.45)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 },
  panelOuter: { borderWidth: 3, borderColor: C.outline, borderRadius: 6, backgroundColor: C.outline },
  panelInner: { borderWidth: 3, borderRadius: 3, flexGrow: 1 },
  btnOuter: { borderWidth: 2, borderColor: C.outline, borderRadius: 6, backgroundColor: C.outline },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 3, borderRadius: 4, paddingHorizontal: 14, minHeight: 44, flexGrow: 1 },
  btnSmall: { paddingHorizontal: 8, minHeight: 36 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 2, borderColor: C.outline, backgroundColor: C.parchmentLight, minHeight: 36 },
  chipActive: { backgroundColor: C.orange, borderColor: C.orangeDark },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 3, borderColor: C.outline, backgroundColor: C.parchmentLight, borderRadius: 6, paddingHorizontal: 10, minHeight: 46 },
  searchInput: { flex: 1, fontFamily: F.medium, fontSize: 17, color: C.ink, paddingVertical: 8, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) },
  textField: { borderWidth: 3, borderColor: C.outline, backgroundColor: C.parchmentLight, borderRadius: 6, paddingHorizontal: 12, minHeight: 48, fontFamily: F.medium, fontSize: 18, color: C.ink },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: C.overlay },
  sheet: { backgroundColor: C.parchment, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 3, borderBottomWidth: 0, borderColor: C.outline, overflow: 'hidden', maxWidth: 760, alignSelf: 'center', width: '100%' },
  sheetHandle: { alignSelf: 'center', width: 54, height: 6, borderRadius: 3, backgroundColor: C.parchmentShadow, marginTop: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  dialogWrap: { flex: 1, backgroundColor: C.overlay, alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 420 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, gap: 12, borderBottomWidth: 1, borderBottomColor: C.parchmentDark },
});
