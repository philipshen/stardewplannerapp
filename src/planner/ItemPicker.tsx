import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { categoryIcon, Item, ITEM_BY_ID, itemsIn, PLACE_CATEGORIES, PLACEABLE, searchItems, subcategories } from '../data/items';
import { useEditor } from '../store/editor';
import { C } from '../theme';
import { Chip, ItemIcon, PText, SearchField, Sheet, tap } from '../components/ui';

export function ItemPicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const current = useEditor((s) => s.item);
  const recent = useEditor((s) => s.recent);
  const pick = useEditor((s) => s.pick);
  const [cat, setCat] = useState<string>(current?.cat && PLACE_CATEGORIES.some((c) => c.id === current.cat) ? current.cat : 'crops');
  const [sub, setSub] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const { width } = useWindowDimensions();
  const cols = Math.max(3, Math.min(8, Math.floor(Math.min(width, 760) / 96)));

  const list = useMemo(() => {
    if (q.trim()) return searchItems(q, (it) => !!it.place);
    const inCat = itemsIn(cat).filter((i) => i.place);
    return sub ? inCat.filter((i) => i.sub === sub) : inCat;
  }, [q, cat, sub]);
  const subs = useMemo(() => subcategories(itemsIn(cat).filter((i) => i.place)), [cat]);
  const recentItems = recent.map((r) => ITEM_BY_ID[r]).filter(Boolean) as Item[];

  const choose = (it: Item) => {
    tap();
    pick(it);
    setQ('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Choose an item" height="82%" scroll={false}>
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <SearchField value={q} onChangeText={setQ} onClear={() => setQ('')} placeholder={`Search ${PLACEABLE.length} placeable items…`} />
        {!q && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
            {PLACE_CATEGORIES.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => { tap(); setCat(c.id); setSub(null); }}
                style={[styles.catTab, cat === c.id && styles.catTabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: cat === c.id }}
                accessibilityLabel={c.label}
              >
                <ItemIcon id={categoryIcon(c)} size={34} />
                <PText size={12} weight="semibold" color={cat === c.id ? C.white : C.ink} numberOfLines={1}>{c.label}</PText>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {!q && subs.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <Chip label="All" active={!sub} onPress={() => setSub(null)} />
            {subs.map((s) => <Chip key={s} label={s} active={sub === s} onPress={() => setSub(s)} />)}
          </ScrollView>
        )}
        {!q && recentItems.length > 0 && (
          <View>
            <PText size={13} weight="semibold" color={C.inkSoft} style={{ marginBottom: 4 }}>RECENT</PText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {recentItems.map((it) => (
                <Pressable key={it.id} onPress={() => choose(it)} style={[styles.recent, current?.id === it.id && styles.cellActive]} accessibilityLabel={it.name}>
                  <ItemIcon id={it.id} size={36} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
        {q ? <PText size={13} color={C.inkSoft}>{list.length} result{list.length === 1 ? '' : 's'}</PText> : null}
      </View>
      <FlatList
        key={cols}
        data={list}
        numColumns={cols}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
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
        ListEmptyComponent={<PText style={{ textAlign: 'center', marginTop: 30 }} color={C.inkSoft}>No items match “{q}”.</PText>}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  catTab: { width: 78, alignItems: 'center', paddingVertical: 6, borderRadius: 8, borderWidth: 2, borderColor: C.parchmentShadow, backgroundColor: C.parchmentLight, gap: 2 },
  catTabActive: { backgroundColor: C.orange, borderColor: C.outline },
  recent: { padding: 3, borderRadius: 6, borderWidth: 2, borderColor: C.parchmentShadow, backgroundColor: C.parchmentLight },
  cell: { padding: 4, alignItems: 'center' },
  cellBox: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 2, borderColor: C.parchmentShadow, backgroundColor: C.parchmentLight },
  cellActive: { borderColor: C.orange, backgroundColor: '#ffe2b0' },
  sizeTag: { position: 'absolute', right: 3, bottom: 0 },
});
