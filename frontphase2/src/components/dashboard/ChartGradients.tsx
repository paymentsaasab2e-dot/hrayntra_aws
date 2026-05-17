'use client';

import React, { useId } from 'react';
import { CHART_COLORS, CHART_COLOR_TOP } from '../../lib/dashboard/chartTheme';

type Props = { count?: number };

/** SVG gradient defs for 3D-style colorful Recharts fills */
export function ChartGradients({ count = CHART_COLORS.length }: Props) {
  const uid = useId().replace(/:/g, '');
  return (
    <defs>
      {Array.from({ length: count }, (_, i) => {
        const base = CHART_COLORS[i % CHART_COLORS.length];
        const top = CHART_COLOR_TOP[i % CHART_COLOR_TOP.length];
        return (
          <linearGradient key={i} id={`${uid}-bar-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={top} />
            <stop offset="55%" stopColor={base} />
            <stop offset="100%" stopColor={base} stopOpacity={0.75} />
          </linearGradient>
        );
      })}
      <linearGradient id={`${uid}-line`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="50%" stopColor="#ec4899" />
        <stop offset="100%" stopColor="#06b6d4" />
      </linearGradient>
      <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.55} />
        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
      </linearGradient>
    </defs>
  );
}

export function barGradientId(uid: string, index: number) {
  return `${uid}-bar-${index % CHART_COLORS.length}`;
}

export function useChartGradientUid() {
  return useId().replace(/:/g, '');
}
