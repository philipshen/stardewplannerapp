import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Item, ITEM_BY_ID, menuFilters, MenuId, menuItems, menuOf, MENUS, searchItems } from '../data/items';
import { useEditor } from '../store/editor';
import { C } from '../theme';
import { Chip, ItemIcon, PText, SearchField, Sheet, tap } from '../components/ui';
import { Key, useT } from '../i18n';

/** Item menus like the web planner: Crops, Craftables, Buildings, Misc, Furniture + global search and recents. */
export function ItemPicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const current = useEditor((s) => s.item);
  const recent = useEditor((s) => s.recent);
  const pick = useEditor((s) => s.pick);
  const season = useEditor((s) => s.plan?.season);
  const [menu, setMenu] = useState<MenuId>(current ? menuOf(current) : 'crops');
  const [filter, setFilter] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const { width, height } = useWindowDimensions();
  const t = useT();
  const insets = useSafeAreaInsets();
  const cols = Math.max(3, Math.min(8, Math.floor((Math.min(width - insets.left - insets.right, 760) - 26) / 92)));

  const list = useMemo(() => (q.trim() ? searchItems(q, (it) => !!it.place) : menuItems(menu, filter)), [q, menu, filter]);
  const filters = useMemo(() => menuFilters(menu), [menu]);
  const recentItems = recent.map((r) => ITEM_BY_ID[r]).filter((it) => it?.place && !it.legacy) as Item[];

  const choose = (it: Item) => {
    tap();
    pick(it);
    setQ('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('picker.title')} height={width > height ? "96%" : "86%"} scroll={false}>
      <FlatList
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 12, gap: 8 }}>
            <SearchField value={q} onChangeText={setQ} onClear={() => setQ('')} placeholder={t('picker.search')} />
            {!q && (
              <View style={styles.menus}>
                {MENUS.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => { tap(); setMenu(m.id); setFilter(null); }}
                    style={[styles.menuTab, menu === m.id && styles.menuTabActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: menu === m.id }}
                    accessibilityLabel={t(`menus.${m.id}`)}
                  >
                    <ItemIcon id={m.icon} size={30} />
                    <PText size={11} weight="semibold" color={menu === m.id ? C.white : C.ink} numberOfLines={1}>{t(`menus.${m.id}`)}</PText>
                  </Pressable>
                ))}
              </View>
            )}
            {!q && filters.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <Chip label={t('common.all')} active={!filter} onPress={() => setFilter(null)} />
                {menu === 'crops' && season && <Chip label={t('picker.thisSeason')} active={filter?.toLowerCase() === season} onPress={() => setFilter(season[0].toUpperCase() + season.slice(1))} />}
                {filters.map((s) => <Chip key={s} label={menu === 'crops' ? t(`season.${s.toLowerCase()}` as Key) : s} active={filter === s} onPress={() => setFilter(s)} />)}
              </ScrollView>
            )}
            {!q && recentItems.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <PText size={12} weight="semibold" color={C.inkSoft}>{t('picker.recent')}</PText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {recentItems.map((it) => (
                    <Pressable key={it.id} onPress={() => choose(it)} style={[styles.recent, current?.id === it.id && styles.cellActive]} accessibilityLabel={it.name}>
                      <ItemIcon id={it.id} size={34} />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            {q ? <PText size={13} color={C.inkSoft}>{t('picker.results', { n: list.length })}</PText> : null}
          </View>
        }
        key={cols}
        data={list}
        numColumns={cols}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 10, paddingBottom: 40 }}
        initialNumToRender={40}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable onPress={() => choose(item)} style={({ pressed }) => [styles.cell, { width: `${100 / cols}%` as any }, pressed && { opacity: 0.6 }]} accessibilityLabel={item.name}>
            <View style={[styles.cellBox, current?.id === item.id && styles.cellActive]}>
              <ItemIcon id={item.id} size={48} />
              {(item.w > 1 || item.h > 1) && <PText size={11} weight="semibold" color={C.inkSoft} style={styles.sizeTag}>{item.w}×{item.h}</PText>}
            </View>
            <PText size={12} weight="medium" numberOfLines={2} style={{ textAlign: 'center', marginTop: 3 }}>{item.name}</PText>
          </Pressable>
        )}
        ListEmptyComponent={<PText style={{ textAlign: 'center', marginTop: 30 }} color={C.inkSoft}>{q ? t('picker.noMatch', { q }) : t('picker.empty')}</PText>}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  menus: { flexDirection: 'row', gap: 6 },
  menuTab: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, borderWidth: 2, borderColor: C.parchmentShadow, backgroundColor: C.parchmentLight, gap: 2, minHeight: 56 },
  menuTabActive: { backgroundColor: C.orange, borderColor: C.outline },
  recent: { padding: 3, borderRadius: 6, borderWidth: 2, borderColor: C.parchmentShadow, backgroundColor: C.parchmentLight },
  cell: { padding: 4, alignItems: 'center' },
  cellBox: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 2, borderColor: C.parchmentShadow, backgroundColor: C.parchmentLight },
  cellActive: { borderColor: C.orange, backgroundColor: '#ffe2b0' },
  sizeTag: { position: 'absolute', right: 3, bottom: 0 },
});
