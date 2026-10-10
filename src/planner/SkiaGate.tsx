import React from 'react';
import PlannerScreen from './PlannerScreen';

/** Native: Skia is available synchronously. */
export function SkiaGate({ id }: { id: string }) {
  return <PlannerScreen id={id} />;
}
