import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SkiaGate } from '../../planner/SkiaGate';

export default function PlannerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SkiaGate id={String(id)} />;
}
