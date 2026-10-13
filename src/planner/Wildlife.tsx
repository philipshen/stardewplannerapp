import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { Atlas, Group, Skia, useImage } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import type { Season } from '../theme';
import { NEAREST } from './render';

/** Ambient wildlife is visual only: it never changes a saved plan or placement rules. */
export function Wildlife({ width, height, season }: { width: number; height: number; season: Season }) {
  const image = useImage(require('../../assets/game/critters.png'));
  const initialReducedMotion = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const time = useSharedValue(0);
  const elapsed = useSharedValue(0);
  useEffect(() => {
    const app = AppState.addEventListener('change', state => setActive(state === 'active'));
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { app.remove(); motion.remove(); };
  }, []);
  const frame = useFrameCallback(info => {
    elapsed.value += Math.min(info.timeSincePreviousFrame ?? 0, 50);
    // 30 visual updates per second, without rerendering React or the farm data.
    if (elapsed.value >= 1000 / 30) { time.value += elapsed.value; elapsed.value = 0; }
  }, false);
  useEffect(() => {
    frame.setActive(active && !reducedMotion && !!image);
    return () => frame.setActive(false);
  }, [active, reducedMotion, image, frame]);
  const critters = useMemo(() => Array.from({ length: season === 'winter' ? 3 : 11 }, (_, i) => ({
    bird: season === 'winter' || i >= 8,
    x: width * (0.15 + ((i * 0.173) % 0.7)),
    y: height * (0.15 + ((i * 0.237) % 0.7)),
    phase: i * 1.73,
    color: (i % 3) * 64,
  })), [width, height, season]);
  const sprites = useDerivedValue(() => critters.map(c => c.bird
    ? { x: 224 + (Math.floor(time.value / 140 + c.phase) % 3) * 32, y: 144, width: 32, height: 32 }
    : { x: 128 + c.color + (Math.floor(time.value / 110 + c.phase) % 4) * 16, y: 96, width: 16, height: 16 }));
  const transforms = useDerivedValue(() => critters.map(c => {
    const t = time.value / 1000;
    return Skia.RSXform(1, 0,
      c.bird ? (((c.x - t * 28) % (width + 64) + width + 64) % (width + 64)) - 32 : c.x + Math.sin(t * 0.8 + c.phase) * 24,
      c.y + Math.sin(t * (c.bird ? 0.6 : 1.1) + c.phase) * (c.bird ? 12 : 16),
    );
  }));
  if (!image || reducedMotion) return null;
  return <Group clip={{ x: 0, y: 0, width, height }}>
    <Atlas image={image} sprites={sprites} transforms={transforms} sampling={NEAREST} />
  </Group>;
}
