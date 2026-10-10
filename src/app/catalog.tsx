import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALL_CATEGORIES, CATEGORY_BY_ID, categoryIcon, Item, ITEM_BY_ID, itemByName, ITEMS, money, searchItems, subcategories } from '../data/items';
import { C } from '../theme';
import { Chip, IconButton, ItemIcon, PixelButton, PText, Row, SearchField, Sheet, WoodBackground } from '../components/ui';
import { RANGE_STYLE, RangeKind } from '../planner/model';
import { useEditor } from '../store/editor';

export default function Catalog() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ item?: string; q?: string }>();
  const [q, setQ] = useState(params.q ?? '');
  const [cat, setCat] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [detail, setDetail] = useState<Item | null>(params.item ? ITEM_BY_ID[params.item] ?? null : null);
  const { width } = useWindowDimensions();
  const cols = width > 1000 ? 3 : width > 640 ? 2 : 1;

  useEffect(() => { if (params.item && ITEM_BY_ID[params.item]) setDetail(ITEM_BY_ID[params.item]); }, [params.item]);

  const list = useMemo(() => {
    const pool = cat ? (it: Item) => it.cat === cat && (!sub || it.sub === sub) : undefined;
    return searchItems(q, pool);
  }, [q, cat, sub]);
  const subs = useMemo(() => (cat ? subcategories(ITEMS.filter((i) => i.cat === cat)) : []), [cat]);

  return (
    <WoodBackground>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton glyph="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <View style={{ flex: 1 }}>
            <PText size={26} weight="bold" color={C.parchmentLight} shadowed>Item Index</PText>
            <PText size={13} color={C.parchmentDark}>{ITEMS.length.toLocaleString()} items · {list.length.toLocaleString()} shown</PText>
          </View>
        </View>
        <SearchField value={q} onChangeText={setQ} onClear={() => setQ('')} placeholder="Search items, seasons, sources…" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <Chip label="All" active={!cat} onPress={() => { setCat(null); setSub(null); }} />
          {ALL_CATEGORIES.map((c) => <Chip key={c.id} label={c.label} icon={categoryIcon(c)} active={cat === c.id} onPress={() => { setCat(cat === c.id ? null : c.id); setSub(null); }} />)}
        </ScrollView>
        {subs.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <Chip label="All" active={!sub} onPress={() => setSub(null)} />
            {subs.map((s) => <Chip key={s} label={s} active={sub === s} onPress={() => setSub(s)} />)}
          </ScrollView>
        )}
      </View>
      <FlatList
        key={cols}
        data={list}
        numColumns={cols}
        keyExtractor={(i) => i.id}
        columnWrapperStyle={cols > 1 ? { gap: 8 } : undefined}
        contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 40, maxWidth: 1200, width: '100%', alignSelf: 'center' }}
        initialNumToRender={24}
        windowSize={9}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable onPress={() => setDetail(item)} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]} accessibilityLabel={item.name}>
            <View style={styles.iconBox}><ItemIcon id={item.id} size={44} /></View>
            <View style={{ flex: 1 }}>
              <PText size={17} weight="semibold" numberOfLines={1}>{item.name}</PText>
              <PText size={13} color={C.inkSoft} numberOfLines={1}>{CATEGORY_BY_ID[item.cat]?.label ?? item.cat} · {item.sub}{item.place ? ` · ${item.w}×${item.h}` : ''}</PText>
            </View>
            {item.sell ? <PText size={14} weight="semibold" color={C.orangeDark}>{money(item.sell)}</PText> : null}
          </Pressable>
        )}
        ListEmptyComponent={<PText color={C.parchment} style={{ textAlign: 'center', marginTop: 40 }}>Nothing matches “{q}”.</PText>}
      />
      <ItemDetail item={detail} onClose={() => setDetail(null)} onOpen={setDetail} />
    </WoodBackground>
  );
}

function ItemDetail({ item, onClose, onOpen }: { item: Item | null; onClose: () => void; onOpen: (it: Item) => void }) {
  const editorOpen = useEditor((s) => !!s.plan);
  if (!item) return <Sheet visible={false} onClose={onClose} />;
  const cat = CATEGORY_BY_ID[item.cat];
  const r = item.range as RangeKind | undefined;
  return (
    <Sheet visible onClose={onClose} title={item.name} height="78%">
      <View style={styles.detailHead}>
        <View style={styles.bigIcon}><ItemIcon id={item.id} size={96} /></View>
        <View style={{ flex: 1, gap: 4 }}>
          <PText size={15} color={C.inkSoft}>{cat?.label ?? item.cat} › {item.sub}</PText>
          <PText size={16}>{item.d}</PText>
        </View>
      </View>
      <Row label="Sell price" value={money(item.sell)} />
      <Row label="Buy price" value={money(item.buy)} />
      <Row label="Build cost" value={money(item.gold)} />
      <Row label="Seasons" value={item.seasons?.map((s) => s[0].toUpperCase() + s.slice(1)).join(', ')} />
      <Row label="Grow time" value={item.grow ? `${item.grow} days${item.regrow ? `, regrows every ${item.regrow}` : ''}` : undefined} />
      <Row label="Footprint" value={item.place ? `${item.w}×${item.h} tiles` : undefined} />
      <Row label="Effect range" value={r ? RANGE_STYLE[r].label : undefined} />
      <Row label="Source" value={item.src} />
      {item.tags?.length ? <Row label="Tags" value={item.tags.join(', ')} /> : null}
      {item.mats?.length ? (
        <View style={{ marginTop: 12 }}>
          <PText size={17} weight="bold" style={{ marginBottom: 6 }}>{item.cat === 'cooking' ? 'Ingredients' : item.cat === 'buildings' ? 'Materials' : 'Recipe'}</PText>
          {item.mats.map(([n, qty]) => {
            const ref = itemByName(n);
            return (
              <Pressable key={n} disabled={!ref} onPress={() => ref && onOpen(ref)} style={styles.mat}>
                {ref ? <ItemIcon id={ref.id} size={30} /> : <View style={{ width: 30 }} />}
                <PText size={15} style={{ flex: 1 }} color={ref ? C.ink : C.inkSoft}>{n}</PText>
                <PText size={15} weight="bold">×{qty}</PText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {item.place && editorOpen ? (
        <PixelButton glyph="pencil" tone="green" label="Place on my farm" style={{ marginTop: 16 }} onPress={() => { useEditor.getState().pick(item); onClose(); router.back(); }} />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 12, gap: 10, paddingBottom: 8, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, marginBottom: 8, borderRadius: 8, borderWidth: 3, borderColor: C.outline, backgroundColor: C.parchment },
  iconBox: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: C.parchmentLight, borderWidth: 2, borderColor: C.parchmentShadow },
  detailHead: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 10 },
  bigIcon: { padding: 6, borderRadius: 10, borderWidth: 3, borderColor: C.outline, backgroundColor: C.parchmentLight },
  mat: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.parchmentDark },
});
