import React from 'react';
import PlannerScreen from './PlannerScreen';
import SampleScreen from './SampleScreen';

/** Native: Skia is available synchronously. */
export function SkiaGate({ id, sample = false }: { id: string; sample?: boolean }) {
  return sample ? <SampleScreen id={id} /> : <PlannerScreen id={id} />;
}
