import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SkiaGate } from '../../planner/SkiaGate';

export default function SampleRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SkiaGate id={String(id)} sample />;
}
