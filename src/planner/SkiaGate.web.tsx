import React from 'react';
import { View } from 'react-native';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { C } from '../theme';
import { PText } from '../components/ui';

/** Web: load CanvasKit (served from /canvaskit.wasm) before rendering Skia components. */
export function SkiaGate({ id, sample = false }: { id: string; sample?: boolean }) {
  return (
    <WithSkiaWeb
      opts={{ locateFile: () => '/canvaskit.wasm' }}
      getComponent={() => sample ? import('./SampleScreen') : import('./PlannerScreen')}
      componentProps={{ id }}
      fallback={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.wood }}>
          <PText color={C.parchment} size={18}>Loading planner…</PText>
        </View>
      }
    />
  );
}
