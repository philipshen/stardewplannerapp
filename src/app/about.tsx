import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ITEMS, PLACEABLE } from '../data/items';
import { MAPS } from '../data/maps';
import { C } from '../theme';
import { IconButton, Panel, PText, WoodBackground } from '../components/ui';

export default function About() {
  const insets = useSafeAreaInsets();
  return (
    <WoodBackground>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, gap: 14, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton glyph="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <PText size={26} weight="bold" color={C.parchmentLight} shadowed>About</PText>
        </View>
        <Panel inner={{ padding: 16, gap: 10 }}>
          <PText size={18} weight="bold">Stardew Planner</PText>
          <PText>
            An unofficial, fan-made farm planner for Stardew Valley. Plan layouts on {MAPS.filter((m) => m.kind === 'farm').length} farm types and {MAPS.filter((m) => m.kind === 'interior').length} interiors, with {PLACEABLE.length} placeable items and a searchable index of {ITEMS.length.toLocaleString()} items.
          </PText>
          <PText>Your farms are stored only on this device. Export a plan file to back it up or move it to another device.</PText>
        </Panel>
        <Panel inner={{ padding: 16, gap: 8 }}>
          <PText size={18} weight="bold">How to plan</PText>
          <PText>• Pick an item with the item button, then tap or drag on the map.</PText>
          <PText>• Switch the shape to Area to fill a rectangle, or Outline for fence lines.</PText>
          <PText>• Pinch or drag with two fingers to zoom and pan in any tool.</PText>
          <PText>• Long-press anything to select it. Drag selected items to move them.</PText>
          <PText>• Use Layers to show sprinkler, scarecrow, Junimo Hut and Bee House ranges.</PText>
          <PText>• The summary lists every item, its cost, and the materials you need.</PText>
        </Panel>
        <Panel inner={{ padding: 16, gap: 8 }}>
          <PText size={18} weight="bold">Credits & notes</PText>
          <PText>Item facts (names, prices, seasons, recipes) come from the MIT-licensed “stardew-valley-data” package, plus a hand-curated furniture and decor list.</PText>
          <PText>All artwork in this app is original procedural pixel art generated for this project. No game sprites are used. Farm layouts are approximations drawn to be useful for planning, not exact copies.</PText>
          <PText color={C.inkSoft}>Stardew Valley is a trademark of ConcernedApe LLC. This app is not affiliated with or endorsed by ConcernedApe.</PText>
        </Panel>
      </ScrollView>
    </WoodBackground>
  );
}
